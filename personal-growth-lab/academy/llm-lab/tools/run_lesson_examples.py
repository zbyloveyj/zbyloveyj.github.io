"""Execute the course's Python examples with explicit project prerequisites.

This runner executes trusted, repository-owned lesson source. It does not run
terminal/R snippets or downloaded material. Every block gets a fresh directory
and process so examples cannot depend accidentally on earlier notebook state.
Three core snippets inspect files from the real quick pipeline; their declared
prerequisites are copied from an actual executed pipeline, never mocked reports.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", default="/tmp/curatemicrobiota-examples.json")
    parser.add_argument("--from-unit", type=int, default=1)
    parser.add_argument("--to-unit", type=int, default=30)
    parser.add_argument("--fixture-run", help="Existing actual quick-pipeline directory; otherwise run one when required.")
    args = parser.parse_args()
    records = []
    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT / "project") + os.pathsep + env.get("PYTHONPATH", "")
    env["OMP_NUM_THREADS"] = "1"
    env["MKL_NUM_THREADS"] = "1"
    fixture_directory = tempfile.TemporaryDirectory(prefix="cm-example-fixtures-")
    fixture = Path(args.fixture_run) if args.fixture_run else Path(fixture_directory.name) / "run"
    for day in range(args.from_unit, args.to_unit + 1):
        lesson = json.loads((ROOT / "course" / f"day{day:02d}.json").read_text(encoding="utf-8"))
        blocks = [s for s in lesson["sections"] if s.get("code", {}).get("language", "").lower() == "python"]
        for section in blocks:
            started = time.monotonic()
            with tempfile.TemporaryDirectory(prefix=f"cm-unit-{day:02d}-") as directory:
                requirements = section["code"].get("requires", [])
                if requirements:
                    if not (fixture / "report.json").exists():
                        if args.fixture_run:
                            raise ValueError("--fixture-run does not contain an actual quick-pipeline report.")
                        subprocess.run([sys.executable, "-m", "curatemicrobiota", "pipeline", "--quick", "--out", str(fixture)],
                                       cwd=ROOT / "project", env=env, check=True, capture_output=True, text=True, timeout=120)
                    target = Path(directory)
                    for requirement in requirements:
                        if requirement in {"demo_data", "microbiome_preprocessor"}:
                            shutil.copytree(fixture / "data", target / "data/demo", dirs_exist_ok=True)
                        if requirement == "microbiome_preprocessor":
                            (target / "runs/microbiome").mkdir(parents=True)
                            shutil.copyfile(fixture / "microbiome/preprocessor.json", target / "runs/microbiome/preprocessor.json")
                        elif requirement == "quick_pipeline":
                            shutil.copytree(fixture, target / "runs/demo")
                        elif requirement != "demo_data":
                            raise ValueError(f"Unknown declared example prerequisite: {requirement}")
                try:
                    result = subprocess.run([sys.executable, "-c", section["code"]["text"]],
                                            cwd=directory, env=env, text=True, capture_output=True, timeout=45)
                    record = {"unit": day, "section": section["id"], "passed": result.returncode == 0,
                              "returncode": result.returncode, "stdout": result.stdout[-4000:], "stderr": result.stderr[-4000:]}
                except subprocess.TimeoutExpired:
                    record = {"unit": day, "section": section["id"], "passed": False, "error": "45-second timeout"}
            record["seconds"] = round(time.monotonic() - started, 3)
            record["declared_prerequisites"] = requirements
            records.append(record)
        print(f"Unit {day:02d}: {len(blocks)} Python blocks checked", flush=True)
    report = {"status": "passed" if all(r["passed"] for r in records) else "failed",
              "python": sys.version, "units": [args.from_unit, args.to_unit], "blocks": len(records),
              "passed": sum(r["passed"] for r in records), "records": records,
              "scope": "Python examples in fresh processes; declared project-file prerequisites come from an actual quick pipeline. Terminal commands, R exports and GPU/distributed extensions are separate."}
    path = Path(args.report)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fixture_directory.cleanup()
    print(json.dumps({k: report[k] for k in ["status", "blocks", "passed"]}))
    if report["status"] != "passed":
        for record in records:
            if not record["passed"]:
                print(json.dumps(record, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
