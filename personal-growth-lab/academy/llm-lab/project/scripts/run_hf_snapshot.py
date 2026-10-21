"""Optional CPU adapter for a user-selected, trusted local Hugging Face snapshot.

Not part of the default dependency set. No automatic download or remote code.
Install compatible transformers/torch/safetensors separately and lock versions.
"""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--prompt", default="Explain why an external cohort matters.")
    parser.add_argument("--max-new-tokens", type=int, default=24)
    parser.add_argument("--context-budget", type=int, default=256)
    parser.add_argument("--max-weight-mib", type=int, default=512)
    args = parser.parse_args()
    snapshot = args.snapshot.resolve()
    if not snapshot.is_dir() or not (snapshot / "config.json").is_file():
        parser.error("provide an existing local snapshot with config.json")
    weights = sorted(snapshot.glob("*.safetensors"))
    if not weights:
        parser.error("this optional exercise requires safetensors weights")
    if args.max_weight_mib < 1 or sum(p.stat().st_size for p in weights) > args.max_weight_mib * 1024**2:
        parser.error("weight file size exceeds the explicitly selected CPU budget")
    if not args.prompt or not 1 <= args.max_new_tokens <= 128 or not 1 <= args.context_budget <= 4096:
        parser.error("invalid prompt or token budget")
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as exc:
        raise SystemExit("Optional dependency missing: install compatible torch, transformers and safetensors in a separate environment.") from exc
    torch.set_num_threads(2)
    tokenizer = AutoTokenizer.from_pretrained(snapshot, local_files_only=True, trust_remote_code=False)
    if tokenizer.chat_template:
        prompt = tokenizer.apply_chat_template([{"role": "user", "content": args.prompt}],
                                               tokenize=False, add_generation_prompt=True)
        encoded = tokenizer(prompt, return_tensors="pt", add_special_tokens=False)
        input_kind = "snapshot_chat_template"
    else:
        encoded = tokenizer(args.prompt, return_tensors="pt")
        input_kind = "raw_text_continuation"
    input_tokens = encoded["input_ids"].shape[1]
    if input_tokens + args.max_new_tokens > args.context_budget:
        parser.error("input plus reserved output exceed selected context budget; no silent truncation")
    model = AutoModelForCausalLM.from_pretrained(snapshot, local_files_only=True, trust_remote_code=False,
                                               use_safetensors=True, dtype=torch.float32)
    maximum = getattr(model.config, "max_position_embeddings", None)
    if maximum is not None and input_tokens + args.max_new_tokens > maximum:
        parser.error("request exceeds the snapshot model's configured context")
    model.eval()
    generation_overrides = {"do_sample": False, "max_new_tokens": args.max_new_tokens,
                            "num_beams": 1, "num_return_sequences": 1, "return_dict_in_generate": False}
    with torch.inference_mode():
        generated = model.generate(**encoded, **generation_overrides)
    # The caller retains a revision/download manifest. File hashes record what
    # was loaded here; they do not independently prove provenance or a license.
    files = sorted(p for p in snapshot.iterdir() if p.is_file() and
                   (p.suffix in {".json", ".safetensors", ".model", ".txt", ".jinja"}))
    digests = {}
    for path in files:
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        digests[path.name] = digest.hexdigest()
    report = {"kind": "optional_local_snapshot_inference", "input_kind": input_kind,
              "input_tokens": input_tokens, "completion_tokens": int(generated.shape[1] - input_tokens),
              "completion": tokenizer.decode(generated[0, input_tokens:], skip_special_tokens=True),
              "device": "cpu", "dtype": "float32", "snapshot_files_sha256": digests,
              "generation_overrides": generation_overrides,
              "snapshot_generation_config": model.generation_config.to_dict(),
              "versions": {name: importlib.metadata.version(name) for name in ["torch", "transformers", "safetensors"]},
              "scope": "one locally selected snapshot; no scientific accuracy or general benchmark claim"}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
