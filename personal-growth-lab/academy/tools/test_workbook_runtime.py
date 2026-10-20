"""Execute every delivered Python example; do not mistake syntax checks for execution."""
from pathlib import Path
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import time

out=Path(os.environ.get('WORKBOOK_QA_DIR','/tmp/academy-workbook-qa'))
expected={'base':24,'solutions':24,'visual':11}
results=[]
for category,count in expected.items():
    programs=sorted((out/'programs'/category).glob('*.py'))
    if len(programs)!=count:
        raise RuntimeError(f'{category}: expected {count}, got {len(programs)}')
    for program in programs:
        cwd=out/'runs'/category/program.stem
        cwd.mkdir(parents=True,exist_ok=True)
        started=time.monotonic()
        compiled=subprocess.run([sys.executable,'-m','py_compile',str(program)],capture_output=True,text=True,timeout=30)
        if compiled.returncode: raise RuntimeError(f'Syntax error {program}: {compiled.stderr}')
        proc=subprocess.run([sys.executable,str(program)],cwd=cwd,capture_output=True,text=True,timeout=45,
                            env={**os.environ,'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','MPLCONFIGDIR':str(out/'mpl-config')})
        row={'category':category,'file':program.name,'returncode':proc.returncode,'seconds':round(time.monotonic()-started,3),
             'stdout':proc.stdout.strip(),'stderr':proc.stderr.strip()}
        results.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
        if proc.returncode:
            (out/'runtime-report.json').write_text(json.dumps({'status':'failed','results':results},ensure_ascii=False,indent=2),encoding='utf-8')
            raise RuntimeError(f'Execution failed: {program.name}')
        if category=='visual':
            png=list(cwd.glob('*.png'));svg=list(cwd.glob('*.svg'))
            if len(png)!=1 or len(svg)!=1 or min(png[0].stat().st_size,svg[0].stat().st_size)<100:
                raise RuntimeError(f'Chart output missing: {program.name}')
report={'status':'passed','counts':expected,'executed':len(results),'python':platform.python_version(),
        'packages':{name:importlib.metadata.version(name) for name in ['numpy','scikit-learn','matplotlib','torch']},'results':results}
(out/'runtime-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('ALL 59 PROGRAMS EXECUTED SUCCESSFULLY',flush=True)
