"""Command-line entry point. No command downloads data or pretrained weights."""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import platform
import sys
from pathlib import Path


def environment():
    versions = {}
    for package in ["torch", "numpy", "scikit-learn"]:
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            versions[package] = None
    return {"python": platform.python_version(), "executable": sys.executable, "platform": platform.platform(), "packages": versions}


def build_parser():
    parser = argparse.ArgumentParser(description="CurateMicrobiota: a small, runnable language and microbiome modelling laboratory.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor", help="Show Python, package versions and available PyTorch devices.")
    demo = sub.add_parser("make-demo", help="Write a clearly labelled synthetic 240-sample microbiome dataset.")
    demo.add_argument("--out", default="data/demo")
    demo.add_argument("--seed", type=int, default=42)
    inspect = sub.add_parser("inspect-data", help="Validate a CSV dataset and its study/subject partitions.")
    inspect.add_argument("--data", default="data/demo")
    lm = sub.add_parser("train-lm", help="Train the byte-tokenized TinyGPT from random initialization.")
    lm.add_argument("--out", default="runs/lm")
    lm.add_argument("--steps", type=int, default=100)
    lm.add_argument("--seed", type=int, default=42)
    lm.add_argument("--text", help="Optional UTF-8 file with at least five blank-line-separated documents.")
    generate = sub.add_parser("generate", help="Generate bytes from a saved TinyGPT checkpoint.")
    generate.add_argument("--checkpoint", default="runs/lm/model.pt")
    generate.add_argument("--prompt", default="Microbes ")
    generate.add_argument("--tokens", type=int, default=80)
    generate.add_argument("--temperature", type=float, default=0.8)
    generate.add_argument("--top-k", type=int, default=40)
    generate.add_argument("--seed", type=int, default=42)
    pretrain = sub.add_parser("pretrain", help="Pretrain a masked continuous-abundance Transformer on train studies only.")
    pretrain.add_argument("--data", default="data/demo")
    pretrain.add_argument("--out", default="runs/microbiome")
    pretrain.add_argument("--steps", type=int, default=100)
    pretrain.add_argument("--max-taxa", type=int, default=64)
    pretrain.add_argument("--mask-rate", type=float, default=0.25)
    pretrain.add_argument("--seed", type=int, default=42)
    evaluate = sub.add_parser("evaluate", help="Compare simple, random-encoder and pretrained-encoder probes on held-out subjects.")
    evaluate.add_argument("--data", default="data/demo")
    evaluate.add_argument("--run", default="runs/microbiome")
    evaluate.add_argument("--seed", type=int, default=42)
    lora = sub.add_parser("lora-demo", help="Run a small LoRA regression experiment with a frozen base layer.")
    lora.add_argument("--out", default="runs/lora")
    lora.add_argument("--steps", type=int, default=100)
    lora.add_argument("--seed", type=int, default=42)
    finetune = sub.add_parser("finetune", help="Run response-only full SFT or LoRA-SFT from a real TinyGPT checkpoint.")
    finetune.add_argument("--checkpoint", required=True)
    finetune.add_argument("--out", default="runs/sft")
    finetune.add_argument("--steps", type=int, default=30)
    finetune.add_argument("--lora", action="store_true", help="Freeze the base and train rank-2 qkv adapters only.")
    finetune.add_argument("--pairs", help="Optional JSONL with fixed train/validation prompt-response pairs.")
    finetune.add_argument("--seed", type=int, default=42)
    alignment = sub.add_parser("alignment-demo", help="Differentiate the DPO loss on fixed synthetic sequence log probabilities.")
    alignment.add_argument("--out", default="runs/alignment")
    pipeline = sub.add_parser("pipeline", help="Generate demo data, train both models, evaluate and write one report.")
    pipeline.add_argument("--quick", action="store_true", help="Use 40 LM steps, 60 microbiome steps and 100 LoRA steps.")
    pipeline.add_argument("--out", default="runs/demo")
    pipeline.add_argument("--seed", type=int, default=42)
    return parser


def dispatch(args):
    if args.command == "doctor":
        report = environment()
        try:
            import torch
            report["devices"] = {"cpu": True, "cuda": torch.cuda.is_available(),
                                 "mps": bool(hasattr(torch.backends, "mps") and torch.backends.mps.is_available())}
            report["default_training_device"] = "cpu"
        except ImportError:
            report["next_step"] = "Install dependencies: python -m pip install -r requirements.txt"
        return report
    if args.command == "make-demo":
        from .data import make_demo
        return make_demo(args.out, args.seed)
    if args.command == "inspect-data":
        from .data import load_cohort
        cohort = load_cohort(args.data)
        split = cohort.indices()
        return {"samples": len(cohort.metadata), "taxa": len(cohort.taxa), "split": cohort.split,
                "samples_per_split": {k: len(v) for k, v in split.items()},
                "subjects_per_split": {k: len({cohort.metadata[i]["subject_id"] for i in idx}) for k, idx in split.items()},
                "labelled_samples_per_split": {k: sum(cohort.metadata[i]["label"] != "" for i in idx) for k, idx in split.items()},
                "units": "relative abundance proportions", "study_and_subject_disjoint": True}
    if args.command == "train-lm":
        from .language import train_language
        return train_language(args.out, args.steps, args.seed, args.text)
    if args.command == "generate":
        from .language import generate_from_checkpoint
        return {"text": generate_from_checkpoint(args.checkpoint, args.prompt, args.tokens, args.temperature, args.top_k, args.seed),
                "note": "Tiny teaching model output; it is not a factual answer."}
    if args.command == "pretrain":
        from .microbiome import pretrain_microbiome
        return pretrain_microbiome(args.data, args.out, args.steps, args.seed, args.max_taxa, args.mask_rate)
    if args.command == "evaluate":
        from .evaluation import evaluate_microbiome
        return evaluate_microbiome(args.data, args.run, args.seed)
    if args.command == "lora-demo":
        from .lora import lora_demo
        return lora_demo(args.out, args.steps, args.seed)
    if args.command == "finetune":
        from .finetuning import train_sft
        return train_sft(args.checkpoint, args.out, args.steps, args.lora, args.seed, args.pairs)
    if args.command == "alignment-demo":
        from .finetuning import alignment_demo
        return alignment_demo(args.out)
    if args.command == "pipeline":
        from .common import write_json
        from .data import make_demo
        from .evaluation import evaluate_microbiome
        from .language import train_language
        from .lora import lora_demo
        from .microbiome import pretrain_microbiome
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        print("[1/5] Generate synthetic data", file=sys.stderr, flush=True)
        data_report = make_demo(out / "data", args.seed)
        print("[2/5] Train TinyGPT", file=sys.stderr, flush=True)
        lm_report = train_language(out / "language", 40 if args.quick else 400, args.seed)
        print("[3/5] Pretrain microbiome encoder", file=sys.stderr, flush=True)
        microbe_report = pretrain_microbiome(out / "data", out / "microbiome", 60 if args.quick else 500, args.seed)
        print("[4/5] Evaluate held-out study and baseline controls", file=sys.stderr, flush=True)
        evaluation_report = evaluate_microbiome(out / "data", out / "microbiome", args.seed)
        print("[5/5] Verify LoRA mechanics", file=sys.stderr, flush=True)
        lora_report = lora_demo(out / "lora", 100 if args.quick else 200, args.seed)
        report = {"project": "CurateMicrobiota", "version": "1.0.0", "status": "completed", "quick": args.quick,
                  "source_kind": "synthetic_teaching_fixture", "seed": args.seed, "environment": environment(),
                  "data": data_report, "language": lm_report, "microbiome": microbe_report,
                  "evaluation": evaluation_report, "lora": lora_report,
                  "report_file": str(out / "report.json")}
        write_json(out / "report.json", report)
        return report
    raise ValueError("Unknown command")


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        result = dispatch(args)
    except (ValueError, OSError, ImportError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
