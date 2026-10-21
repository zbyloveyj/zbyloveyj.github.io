"""Install only the exact checked journal data release, then validate in a temp dir."""
from pathlib import Path, PurePosixPath
import gzip
import hashlib
import io
import json
import re
import shutil
import subprocess
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[2]
PROJECT=ROOT/'personal-growth-lab/academy/journals'
RELEASE=PROJECT/'release'
manifest=json.loads((RELEASE/'manifest.json').read_text())
assert manifest['schema']==1 and manifest['catalogJournals']==70419
blocks=[]
for c in manifest['chunks']:
    assert re.fullmatch(r'data-\d{2}\.part',c['name'])
    b=(RELEASE/c['name']).read_bytes()
    assert len(b)==c['size'] and hashlib.sha256(b).hexdigest()==c['sha256']
    blocks.append(b)
archive=b''.join(blocks)
assert len(archive)==manifest['archiveBytes']
assert hashlib.sha256(archive).hexdigest()==manifest['archiveSHA256']
expected={r['path']:r for r in manifest['files']}
assert len(expected)==len(manifest['files'])==110
prefix='personal-growth-lab/academy/journals/data/'
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    assert set(z.namelist())==set(expected)
    for name in z.namelist():
        p=PurePosixPath(name)
        assert name.startswith(prefix) and not p.is_absolute() and '..' not in p.parts
        assert name.endswith(('.json','.json.gz'))
        b=z.read(name)
        assert len(b)==expected[name]['size']
        assert hashlib.sha256(b).hexdigest()==expected[name]['sha256']
        dest=ROOT.joinpath(*p.parts)
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(b)
with tempfile.TemporaryDirectory(prefix='journal-validation-') as temp:
    data=Path(temp)/'data'
    for p in (PROJECT/'data').rglob('*.json.gz'):
        target=data/p.relative_to(PROJECT/'data').with_suffix('')
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(gzip.decompress(p.read_bytes()))
    subprocess.run(['python',str(PROJECT/'tools/validate_catalog.py'),'--data-dir',str(data)],check=True)
print('Installed and verified 70,419 journals in 110 exact data files.')
