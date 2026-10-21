"""A bounded loopback-only TinyGPT teaching service, not a production server.

Run ``python -m curatemicrobiota.local_service serve --checkpoint runs/lm/model.pt``.
The service loads a trusted local checkpoint once. It never accepts model paths,
Python code, URLs, or arbitrary tools in an inference request. Deadlines are
cooperative at token boundaries; they cannot interrupt an in-flight CPU kernel.
"""
from __future__ import annotations

import argparse
import codecs
import hashlib
import io
import json
import math
import time
import uuid
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import torch

from .language import ByteTokenizer, GPTConfig, TinyGPT

MAX_BODY_BYTES = 16_384
MAX_CHECKPOINT_BYTES = 64 * 1024 * 1024
ALLOWED_REQUEST_FIELDS = {
    "prompt", "max_new_tokens", "temperature", "top_k", "seed", "timeout_seconds", "stream"
}


def _integer(value, name, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{name} must be an integer in [{low}, {high}]")
    return value


def validate_request(payload, context):
    """Validate before returning HTTP 200 or allocating the generation input."""
    if not isinstance(payload, dict):
        raise ValueError("request must be a JSON object")
    extra = set(payload) - ALLOWED_REQUEST_FIELDS
    if extra:
        raise ValueError("unknown request field: " + ", ".join(sorted(extra)))
    prompt = payload.get("prompt")
    if not isinstance(prompt, str) or not prompt:
        raise ValueError("prompt must be a nonempty string")
    ids = ByteTokenizer.encode(prompt)
    count = _integer(payload.get("max_new_tokens", 16), "max_new_tokens", 1, 256)
    if len(ids) + count > context:
        raise ValueError("prompt UTF-8 bytes plus reserved output exceed model context")
    temperature = payload.get("temperature", 0.8)
    deadline = payload.get("timeout_seconds", 10.0)
    for value, name, upper in [(temperature, "temperature", 4.0), (deadline, "timeout_seconds", 30.0)]:
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= upper:
            raise ValueError(f"{name} must be finite and in (0, {upper}]")
    top_k = _integer(payload.get("top_k", 40), "top_k", 1, 256)
    seed = _integer(payload.get("seed", 42), "seed", 0, 2**63 - 1)
    stream = payload.get("stream", False)
    if type(stream) is not bool:
        raise ValueError("stream must be a boolean")
    return {"prompt": prompt, "prompt_ids": ids, "max_new_tokens": count,
            "temperature": float(temperature), "top_k": top_k, "seed": seed,
            "timeout_seconds": float(deadline), "stream": stream}


def _validate_model_config(raw):
    if not isinstance(raw, dict) or set(raw) != set(asdict(GPTConfig())):
        raise ValueError("unexpected TinyGPT configuration fields")
    if raw["vocabulary"] != 256:
        raise ValueError("this service requires the project's 256-byte tokenizer")
    for name, upper in [("context", 2048), ("width", 512), ("heads", 64), ("layers", 8)]:
        _integer(raw[name], name, 1, upper)
    if raw["width"] % raw["heads"]:
        raise ValueError("width must be divisible by heads")
    dropout = raw["dropout"]
    if type(dropout) not in (int, float) or not math.isfinite(dropout) or not 0 <= dropout < 1:
        raise ValueError("invalid dropout")
    # Compute the exact parameter count before constructing this architecture.
    c, layers = raw["width"], raw["layers"]
    count = (512 + raw["context"]) * c + layers * (12 * c * c + 13 * c) + 2 * c
    if count > 2_000_000:
        raise ValueError("checkpoint exceeds this CPU teaching service's parameter budget")
    return GPTConfig(**raw)


class LocalEngine:
    def __init__(self, checkpoint_path):
        path = Path(checkpoint_path)
        if not path.is_file() or path.stat().st_size > MAX_CHECKPOINT_BYTES:
            raise ValueError("missing checkpoint or checkpoint exceeds 64 MiB")
        # Locally created/trusted files only. weights_only limits the unpickler;
        # it is not a promise to make every untrusted file safe.
        raw_checkpoint = path.read_bytes()
        if len(raw_checkpoint) > MAX_CHECKPOINT_BYTES:
            raise ValueError("checkpoint exceeds 64 MiB")
        checkpoint = torch.load(io.BytesIO(raw_checkpoint), map_location="cpu", weights_only=True)
        if not isinstance(checkpoint, dict) or checkpoint.get("format") != "curatemicrobiota-tinygpt-v1":
            raise ValueError("expected a CurateMicrobiota TinyGPT checkpoint")
        if checkpoint.get("tokenizer") != "utf8-bytes-256":
            raise ValueError("checkpoint tokenizer does not match ByteTokenizer")
        self.model = TinyGPT(_validate_model_config(checkpoint["config"]))
        if checkpoint.get("lora"):
            from .lora import inject_lora
            lora = checkpoint["lora"]
            if not isinstance(lora, dict) or set(lora) - {"rank", "alpha", "target_names"}:
                raise ValueError("unexpected LoRA configuration")
            targets = lora.get("target_names", ["qkv"])
            if not isinstance(targets, (list, tuple)) or list(targets) != ["qkv"]:
                raise ValueError("this service supports only the project qkv adapter")
            _integer(lora.get("rank", 2), "rank", 1, 64)
            alpha = lora.get("alpha", 4.0)
            if type(alpha) not in (int, float) or not math.isfinite(alpha) or alpha <= 0:
                raise ValueError("invalid LoRA alpha")
            inject_lora(self.model, **lora)
        self.model.load_state_dict(checkpoint["state_dict"], strict=True)
        if not all(torch.isfinite(p).all() for p in self.model.parameters()):
            raise ValueError("checkpoint contains non-finite parameters")
        self.model.eval().requires_grad_(False)
        self.checkpoint_sha256 = hashlib.sha256(raw_checkpoint).hexdigest()
        self.context = self.model.config.context

    def health(self):
        return {"status": "ready", "model": "curatemicrobiota-tinygpt-v1",
                "checkpoint_sha256": self.checkpoint_sha256, "context_bytes": self.context,
                "device": "cpu", "kv_cache": False,
                "scope": "loopback teaching inference; not a validated scientific assistant"}

    def events(self, payload):
        request = validate_request(payload, self.context)
        start = time.perf_counter()
        request_id = uuid.uuid4().hex
        generator = torch.Generator(device="cpu").manual_seed(request["seed"])
        ids = torch.tensor([request["prompt_ids"]], dtype=torch.long)
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        generated, parts = [], []
        first_token = None
        last_token = None
        reason = "length"
        yield {"event": "start", "request_id": request_id,
               "checkpoint_sha256": self.checkpoint_sha256,
               "prompt_tokens": len(request["prompt_ids"]), "reserved_output_tokens": request["max_new_tokens"]}
        # Never keep a thread-local inference context open across yield: the
        # caller may perform unrelated autograd work while this generator pauses.
        for index in range(request["max_new_tokens"]):
            if time.perf_counter() - start >= request["timeout_seconds"]:
                reason = "deadline"
                break
            with torch.inference_mode():
                logits, _ = self.model(ids)
                if time.perf_counter() - start >= request["timeout_seconds"]:
                    reason = "deadline"
                    break
                values, choices = torch.topk(logits[0, -1] / request["temperature"], request["top_k"])
                selected = torch.multinomial(values.softmax(-1), 1, generator=generator)
                token = int(choices[selected].item())
                ids = torch.cat([ids, torch.tensor([[token]], dtype=torch.long)], dim=1)
            generated.append(token)
            delta = decoder.decode(bytes([token]), final=False)
            parts.append(delta)
            elapsed = time.perf_counter() - start
            if first_token is None:
                first_token = elapsed
            last_token = elapsed
            yield {"event": "token", "request_id": request_id, "index": index,
                   "token_id": token, "text_delta": delta, "elapsed_seconds": elapsed}
        tail = decoder.decode(b"", final=True)
        parts.append(tail)
        total = time.perf_counter() - start
        tpot = None if len(generated) < 2 else (last_token - first_token) / (len(generated) - 1)
        yield {"event": "done", "request_id": request_id, "finish_reason": reason,
               "completion": "".join(parts), "final_text_delta": tail,
               "completion_token_ids": generated, "prompt_tokens": len(request["prompt_ids"]),
               "completion_tokens": len(generated), "checkpoint_sha256": self.checkpoint_sha256,
               "metrics": {"engine_seconds": total, "engine_ttft_seconds": first_token,
                           "engine_tpot_seconds": tpot},
               "metrics_scope": "engine wall time includes event-consumer waits; excludes request upload/queue and delivery of final event"}


def _strict_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError("JSON non-finite constants are forbidden")


def make_server(engine, port=8765):
    """Always bind to IPv4 loopback; port 0 is useful for isolated tests."""
    _integer(port, "port", 0, 65535)

    class Handler(BaseHTTPRequestHandler):
        server_version = "CurateMicrobiotaLocal/1"
        # One request per connection simplifies bounded streaming and cleanup.
        protocol_version = "HTTP/1.0"

        def setup(self):
            super().setup()
            self.connection.settimeout(5.0)

        def log_message(self, fmt, *args):
            pass  # Do not put user prompts in access logs.

        def reply(self, status, data):
            body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def allowed_origin(self):
            return self.headers.get("Origin") is None

        def do_GET(self):
            if not self.allowed_origin():
                self.reply(403, {"error": "browser-origin requests are not supported"})
            elif self.path == "/health":
                self.reply(200, engine.health())
            else:
                self.reply(404, {"error": "unknown endpoint"})

        def do_POST(self):
            if not self.allowed_origin():
                self.reply(403, {"error": "browser-origin requests are not supported"})
                return
            if self.path != "/generate":
                self.reply(404, {"error": "unknown endpoint"})
                return
            if self.headers.get("Transfer-Encoding") is not None:
                self.reply(400, {"error": "chunked request bodies are not supported"})
                return
            if self.headers.get_content_type() != "application/json":
                self.reply(415, {"error": "application/json required"})
                return
            try:
                length = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                length = -1
            if length < 1:
                self.reply(411, {"error": "positive Content-Length required"})
                return
            if length > MAX_BODY_BYTES:
                self.reply(413, {"error": "request body exceeds 16 KiB"})
                return
            try:
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError("incomplete request body")
                payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_strict_pairs, parse_constant=_reject_constant)
                validated = validate_request(payload, engine.context)
            except (ValueError, UnicodeError):
                self.reply(400, {"error": "invalid request; check fields, UTF-8 byte budget, ranges and JSON"})
                return
            except TimeoutError:
                self.reply(408, {"error": "request body read timed out"})
                return
            events = engine.events(payload)
            if not validated["stream"]:
                result = None
                for result in events:
                    pass
                self.reply(200, result)
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                for event in events:
                    self.wfile.write((json.dumps(event, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                # Closing the generator cancels subsequent token steps. This is
                # not an interrupt of an already-running PyTorch operation.
                events.close()

    return HTTPServer(("127.0.0.1", port), Handler)


def client(port, payload):
    _integer(port, "port", 1, 65535)
    request = Request(f"http://127.0.0.1:{port}/generate",
                      data=json.dumps(payload, allow_nan=False).encode("utf-8"),
                      headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=40) as response:
            if payload.get("stream"):
                for line in response:
                    print(json.dumps(json.loads(line), ensure_ascii=False, allow_nan=False))
            else:
                print(json.dumps(json.load(response), ensure_ascii=False, indent=2, allow_nan=False))
    except HTTPError as exc:
        raise SystemExit(f"HTTP {exc.code}: {exc.read().decode('utf-8')}") from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    serve = commands.add_parser("serve", help="load trusted checkpoint and listen only on 127.0.0.1")
    serve.add_argument("--checkpoint", type=Path, required=True)
    serve.add_argument("--port", type=int, default=8765)
    request = commands.add_parser("client", help="send one bounded local inference request")
    request.add_argument("--port", type=int, default=8765)
    request.add_argument("--prompt", default="Microbes ")
    request.add_argument("--max-new-tokens", type=int, default=16)
    request.add_argument("--seed", type=int, default=42)
    request.add_argument("--stream", action="store_true")
    args = parser.parse_args()
    if args.command == "client":
        client(args.port, {"prompt": args.prompt, "max_new_tokens": args.max_new_tokens,
                           "seed": args.seed, "stream": args.stream})
        return
    torch.set_num_threads(2)
    engine = LocalEngine(args.checkpoint)
    with make_server(engine, args.port) as server:
        print(json.dumps({"url": f"http://127.0.0.1:{server.server_port}", **engine.health()}, ensure_ascii=False), flush=True)
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
