#!/usr/bin/env python3
"""Headless browser smoke test for the research handbook's JavaScript pages."""
from __future__ import annotations
import shutil
import subprocess
import sys
import time
from urllib.request import urlopen

BROWSER = next((p for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
                if (p := shutil.which(name))), None)
if not BROWSER:
    print("SKIP browser smoke: Chromium/Chrome is unavailable on the runner")
    sys.exit(0)

server = subprocess.Popen([sys.executable, "-m", "http.server", "18577", "--bind", "127.0.0.1"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    url = "http://127.0.0.1:18577/graduate-research-handbook/"
    for attempt in range(40):
        try:
            with urlopen(url, timeout=1):
                break
        except Exception:
            time.sleep(0.15)
    else:
        raise AssertionError("Cannot start local HTTP server")

    tests = [
        ("?chapter=17", ['id="text-body"', '<h2 id="sec-', '第17章'], "chapter reader"),
        ("workshop.html", ['id="lab-raw">3.39', 'id="lab-adjusted">2.05'], "simulated data workshop"),
        ("print-book.html", ['id="chapter-50"', '已排版 50 章'], "book print layout"),
    ]
    for path, expected, label in tests:
        cmd = [BROWSER, "--headless=new", "--no-sandbox", "--disable-gpu",
               "--disable-dev-shm-usage", "--no-first-run",
               "--virtual-time-budget=7000", "--dump-dom", url + path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=80)
        if result.returncode:
            raise AssertionError(f"{label} Chromium returned {result.returncode}: {result.stderr[-400:]}")
        for fragment in expected:
            if fragment not in result.stdout:
                raise AssertionError(f"{label} did not render {fragment!r}; DOM contains {len(result.stdout)} chars")
        if "章节载入失败" in result.stdout:
            raise AssertionError(f"{label} showed a loading failure")
        print(f"PASS: {label}")
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
