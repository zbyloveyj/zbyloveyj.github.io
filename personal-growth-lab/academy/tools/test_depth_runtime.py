"""Run the extracted teaching examples; successful import is not enough."""
from pathlib import Path
import json
import os
import platform
import subprocess
import sys
import time

root = Path(os.environ.get('DEPTH_TEST_OUTPUT', '/tmp/academy-depth-qa'))
examples = sorted((root / 'python').glob('coding-*.py'))
if len(examples) != 24:
    raise RuntimeError(f'Expected 24 examples, got {len(examples)}')
results = []
for example in examples:
    started = time.monotonic()
    compiled = subprocess.run([sys.executable, '-m', 'py_compile', str(example)], capture_output=True, text=True, timeout=30)
    if compiled.returncode:
        raise RuntimeError(f'Syntax failure {example.name}: {compiled.stderr}')
    result = subprocess.run([sys.executable, str(example)], capture_output=True, text=True, timeout=45,
                            env={**os.environ, 'OMP_NUM_THREADS': '1', 'MKL_NUM_THREADS': '1'})
    row = {'example': example.name, 'returncode': result.returncode,
           'seconds': round(time.monotonic()-started, 3), 'stdout': result.stdout.strip(), 'stderr': result.stderr.strip()}
    results.append(row)
    print(json.dumps(row, ensure_ascii=False), flush=True)
    if result.returncode:
        (root / 'python-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        raise RuntimeError(f'Example failed: {example.name}')
report = {'status': 'passed', 'examples_executed': len(results), 'python': platform.python_version(), 'results': results}
(root / 'python-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PYTHON EXAMPLES: 24/24 PASSED', flush=True)
