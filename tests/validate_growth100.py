#!/usr/bin/env python3
"""Audit the 100-day curriculum, evidence links, browser rendering and interactions."""
from __future__ import annotations

from pathlib import Path
from urllib.request import urlopen
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "personal-growth-lab" / "100-days"

for rel in ("index.html", "assets/app.js", "assets/style.css",
            "data/program.js", "data/support.js", "data/guides.js", "assets/edition.css", "README.md"):
    if not (PROJECT / rel).is_file():
        raise AssertionError(f"Missing required course file: {rel}")

for path in (PROJECT / "assets/app.js", PROJECT / "data/program.js", PROJECT / "data/support.js", PROJECT / "data/guides.js",
             ROOT / "personal-growth-lab" / "assets/app.js"):
    subprocess.run(["node", "--check", str(path)], cwd=ROOT, check=True, capture_output=True, text=True)

js = r"""
global.window = {};
require('./personal-growth-lab/100-days/data/program.js');
require('./personal-growth-lab/100-days/data/support.js');
require('./personal-growth-lab/100-days/data/guides.js');
const p=window.RESET100,s=window.RESET100_SUPPORT,g=window.RESET100_GUIDES;
if(!p || p.version!==2 || !s || s.version!==2)throw Error('Missing versioned course data');
if(p.days.length!==100 || p.phases.length!==5 || p.dimensions.length!==8)throw Error('Wrong course dimensions');
if(s.weeklyObjectives.length!==15)throw Error('Expected exactly 15 curriculum-week objectives');
if(!g || g.guides.length!==100 || new Set(g.guides.map(x=>x.template)).size!==100)throw Error('Missing or duplicated daily notebook guides');
if(g.guides.some((x,i)=>x.day!==i+1||!x.materials||!x.avoid||x.template.length<12))throw Error('Incomplete daily guide');
if(new Set(p.days.map(x=>x.title)).size!==100)throw Error('Daily titles duplicated');
if(new Set(p.days.map(x=>x.proof)).size!==100)throw Error('100 deliverables must be unique');
if(s.banks.length!==5)throw Error('Five banks required');
let supports=0;
for(let i=0;i<100;i++){
  const d=p.days[i];
  if(d.n!==i+1 || d.phase!==Math.floor(i/20))throw Error('Day index/phase mismatch '+d.n);
  if(!p.categories[d.category])throw Error('Unknown domain day '+d.n);
  if(d.link===undefined || d.link<0 || (d.n===1?d.link!==0:d.link>=d.n))
    throw Error('Broken prerequisite day '+d.n);
  if(!d.proof || !d.question || !Array.isArray(d.steps)||d.steps.length!==3)
    throw Error('Incomplete steps day '+d.n);
  if(d.steps.some(x=>x.trim().length<9)||d.proof.trim().length<10)
    throw Error('Not actionable day '+d.n);
  const a=s.choose(d);
  if(a.length!==2 || a[0].category===a[1].category ||
     a.some(x=>x.category===d.category || !x.action || !x.check))
    throw Error('Invalid complement day '+d.n);
  supports+=a.length;
  if(i>0){
    const prev=p.days[i-1],pr=s.choose(prev);
    const now=d.steps.join('|')+a.map(x=>x.action).join('|');
    const past=prev.steps.join('|')+pr.map(x=>x.action).join('|');
    if(now===past)throw Error('Duplicated adjacent lesson day '+d.n);
  }
}
for(const [pnum,group] of s.banks.entries()){
  if(Object.keys(group).length!==8)throw Error('Missing coverage in support bank '+pnum);
  for(const [cat,items] of Object.entries(group)){
    if(items.length!==4 || items.some(x=>x.split('|').length!==3))
      throw Error('Malformed bank '+pnum+':'+cat);
  }
}
if(supports!==200)throw Error('Expected 200 daily supporting task assignments');
console.log('PASS: 100 unique outcomes and day guides, 99 prerequisite links, 160 support variations, 200 complementary tasks');
"""
out = subprocess.run(["node", "-e", js], cwd=ROOT, check=True, capture_output=True, text=True)
print(out.stdout.strip())

page = (PROJECT / "index.html").read_text(encoding="utf-8")
for fragment in ("data/program.js?v=2", "data/support.js?v=2", "data/guides.js?v=3", "assets/app.js?v=3", "assets/edition.css?v=3",
                 'id="day-map"', 'id="day-content"', 'id="export-data"',
                 'id="import-file"', 'id="evidence"', 'id="resume-day"', 'id="course-search"', 'id="course-list"', 'id="jump-day-btn"', 'id="save-status"'):
    if fragment not in page:
        raise AssertionError(f"Missing content/link: {fragment}")
for domain in ("cdc.gov", "who.int", "nccih.nih.gov", "doi.org/10.1038"):
    if domain not in page:
        raise AssertionError(f"Missing factual reference {domain}")
styling = (PROJECT / "assets/style.css").read_text(encoding="utf-8")
if "#2467B8" not in styling or ".weekly-brief" not in styling or ".outcome-card" not in styling:
    raise AssertionError("Blue design or revised practice styling missing")
edition=(PROJECT / "assets/edition.css").read_text(encoding="utf-8")
if ".home-dashboard" not in edition or ".mobile-dock" not in edition or ".course-entry" not in edition:
    raise AssertionError("Final responsive product styling missing")
root_page = (ROOT / "personal-growth-lab" / "index.html").read_text(encoding="utf-8")
if 'href="100-days/"' not in root_page:
    raise AssertionError("Original speaking course no longer links to 100 days")
print("PASS: references, new guides, dashboard, filter markup and blue responsive styles")

BROWSER = next((p for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
                if (p := shutil.which(name))), None)
if not BROWSER:
    print("SKIP: headless browser unavailable")
    sys.exit(0)

server = subprocess.Popen([sys.executable, "-m", "http.server", "18579", "--bind", "127.0.0.1"],
                          cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    base = "http://127.0.0.1:18579/"
    for _ in range(45):
        try:
            with urlopen(base+"personal-growth-lab/100-days/", timeout=1):
                break
        except Exception:
            time.sleep(0.16)
    else:
        raise AssertionError("Cannot start local QA server")

    tests = [
       ("personal-growth-lab/100-days/?day=1",
        ['DAY 001', '今天只聚焦一件事', '四行现状记录', 'data-task="core1"',
         'data-task="support2"', '起点日', '今天要留下什么', '验收：'], "first day's guided training"),
       ("personal-growth-lab/100-days/?day=100",
        ['DAY 100', '给未来的自己一份交接', '一封100天交接信', '第15周',
         'data-task="core3"'], "final day and 15-week continuity"),
       ("personal-growth-lab/",
        ['growth-series-card', '进入100天成长计划'], "original speaking course"),
       ("tests/growth100_interactions.html",
        ['data-status="pass"', 'PASS: 5 varying tasks'], "interactive task and persistence suite"),
       ("tests/growth100_final_ux.html",
        ['data-status="pass"', 'PASS: dashboard, 100 course filters'], "complete dashboard/search/resume/mobile UX suite"),
    ]
    for suffix, markers, label in tests:
        cmd = [BROWSER, "--headless=new", "--no-sandbox", "--disable-gpu",
               "--disable-dev-shm-usage", "--no-first-run", "--virtual-time-budget=14000",
               "--dump-dom", base+suffix]
        run = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=95)
        if run.returncode:
            raise AssertionError(f"{label}: Chrome failed: {run.stderr[-650:]}")
        missing=[x for x in markers if x not in run.stdout]
        if missing:
            if "interactive" in label:
                pos=run.stdout.find('id="result"')
                print("INTERACTIVE DOM:",run.stdout[pos:pos+1050])
            raise AssertionError(f"{label}: missing {missing} in {len(run.stdout)}-char DOM")
        print("PASS: "+label)
finally:
    server.terminate()
    try:
        server.wait(timeout=4)
    except subprocess.TimeoutExpired:
        server.kill()
