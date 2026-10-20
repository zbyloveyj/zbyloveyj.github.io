#!/usr/bin/env python3
"""Validate the complete 100-day growth curriculum and smoke-test the static UI.

No third-party packages required; Chromium is used if installed.
"""
from __future__ import annotations

from pathlib import Path
from urllib.request import urlopen
import shutil
import subprocess
import sys
import time
import json

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "personal-growth-lab" / "100-days"

for rel in ("index.html", "assets/app.js", "assets/style.css", "data/program.js", "README.md"):
    if not (PROJECT / rel).is_file():
        raise AssertionError(f"Missing required file: {rel}")

for path in (PROJECT / "assets/app.js", PROJECT / "data/program.js",
             ROOT / "personal-growth-lab" / "assets/app.js"):
    subprocess.run(["node", "--check", str(path)], cwd=ROOT, check=True, capture_output=True, text=True)

js = """
global.window = {};
require('./personal-growth-lab/100-days/data/program.js');
const {days, phases, dimensions} = global.window.RESET100 || {};
if (!Array.isArray(days) || days.length !== 100) throw Error('Course must include exactly 100 days');
if (!Array.isArray(phases) || phases.length !== 5) throw Error('Five phases required');
if (!Array.isArray(dimensions) || dimensions.length !== 8) throw Error('Eight dimensions required');
if (new Set(days.map(x=>x.title)).size !== 100) throw Error('Duplicate daily theme title');
for (let i=0;i<100;i++) {
  const d=days[i];
  if(d.n!==i+1 || d.phase!==Math.floor(i/20)) throw Error('Incorrect day numbering or phase');
  if(!d.title || !d.question || !Array.isArray(d.steps) || d.steps.length!==3 || d.steps.some(s=>!s.trim())) throw Error('Empty day content '+d.n);
}
console.log('PASS: 100 unique detailed days, 5 phases, 8 dimensions');
"""
out = subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True)
print(out.stdout.strip())

page = (PROJECT / "index.html").read_text(encoding="utf-8")
for expected in ("data/program.js", "assets/app.js", "id=\"day-map\"", "id=\"day-content\"",
                 "id=\"export-data\"", "id=\"import-file\""):
    if expected not in page:
        raise AssertionError(f"Missing UI element: {expected}")
root_page = (ROOT / "personal-growth-lab" / "index.html").read_text(encoding="utf-8")
if 'href="100-days/"' not in root_page:
    raise AssertionError("Existing 21-day practice lab has no link to the second course")
print("PASS: page assets and companion-course navigation")

BROWSER = next((p for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
                if (p := shutil.which(name))), None)
if not BROWSER:
    print("SKIP: browser smoke test (Chromium/Chrome unavailable)")
    sys.exit(0)

server = subprocess.Popen([sys.executable, "-m", "http.server", "18579", "--bind", "127.0.0.1"],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    base = "http://127.0.0.1:18579/personal-growth-lab/"
    for _ in range(45):
        try:
            with urlopen(base + "100-days/", timeout=1):
                break
        except Exception:
            time.sleep(0.16)
    else:
        raise AssertionError("Local test server failed to start")

    for url, markers, label in (
        (base + "100-days/", ["今天的七件小事", "第 100 天", "个人成长", "data-task=\"sleep\""], "100-day homepage"),
        (base + "100-days/?day=100", ["给未来的自己一份交接", "DAY 100", "毕业"], "100-day final lesson"),
        (base, ["growth-series-card", "进入100天成长计划"], "original lab links second course"),
    ):
        run = subprocess.run(
            [BROWSER, "--headless=new", "--no-sandbox", "--disable-gpu",
             "--disable-dev-shm-usage", "--no-first-run", "--virtual-time-budget=7500",
             "--dump-dom", url],
            cwd=ROOT, capture_output=True, text=True, timeout=90)
        if run.returncode:
            raise AssertionError(f"{label}: browser exit {run.returncode}: {run.stderr[-400:]}")
        missing=[marker for marker in markers if marker not in run.stdout]
        if missing:
            raise AssertionError(f"{label}: unrendered markers {missing}; DOM length {len(run.stdout)}")
        print("PASS: "+label)
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
