#!/usr/bin/env python3
"""AI Agent 30-day course practice CLI. Python 3.10+, standard library."""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

from agentkit import core
from agentkit.lessons import lesson
from agentkit.providers import answer


def model_options(parser):
    parser.add_argument("--provider", choices=("offline", "ollama", "openai"), default="offline")
    parser.add_argument("--model", help="A tool-capable model already installed or accessible to your account")
    parser.add_argument("--allow-network", action="store_true", help="Explicitly permit model endpoint requests, including localhost Ollama")


def main(argv=None):
    parser = argparse.ArgumentParser(description="30-day AI Agent course: each day performs a distinct practical exercise.")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("day", help="Run one lesson and write outputs/dayNN.json")
    p.add_argument("number", type=int, choices=range(1, 31))
    p.add_argument("--config", type=Path, default=core.ROOT / "experiments.json")
    model_options(p)
    p = sub.add_parser("ask", help="Ask using supplied teaching evidence")
    p.add_argument("question")
    p.add_argument("--top-k", type=int, default=3)
    p.add_argument("--max-steps", type=int, default=6)
    model_options(p)
    p = sub.add_parser("evaluate", help="Run the small public dev or test cases offline")
    p.add_argument("--split", choices=("dev", "test"), default="dev")
    p.add_argument("--top-k", type=int, default=3)
    p = sub.add_parser("serve", help="Start the offline web interface bound to 127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    try:
        if args.command == "serve":
            from agentkit.web import serve
            serve(args.port)
            return 0
        if args.command == "day":
            all_config = json.loads(args.config.read_text(encoding="utf-8"))
            key = f"day{args.number:02d}"
            if not isinstance(all_config, dict) or not isinstance(all_config.get(key), dict):
                raise ValueError("Configuration must contain an object named " + key)
            result = lesson(args.number, all_config[key], args.provider, args.model, args.allow_network)
            path = core.OUTPUT / f"day{args.number:02d}.json"
        elif args.command == "ask":
            result = answer(args.question, args.top_k, args.max_steps, args.provider, args.model, args.allow_network)
            path = core.OUTPUT / "ask.json"
        else:
            result = core.evaluate(args.split, args.top_k)
            path = core.OUTPUT / ("evaluation_"+args.split+".json")
        core.dump(path, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("Saved " + str(path.relative_to(core.ROOT)), file=sys.stderr)
        return 0
    except KeyboardInterrupt:
        return 0
    except (ValueError, OSError, RuntimeError, KeyError, TypeError) as exc:
        print(json.dumps({"error": str(exc), "command": args.command, "fallback_used": False}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
