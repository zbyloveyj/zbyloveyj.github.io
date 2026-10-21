#!/usr/bin/env python3
"""Read and validate the complete directory, including versioned data parts."""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_catalog(path=None, verify=True):
    path = Path(path or ROOT / 'data/labs.json')
    data = json.loads(path.read_text())
    labs = list(data['labs'])
    seen_paths = set()
    for part in data.get('dataParts', []):
        name = part['path']
        if not re.fullmatch(r'data/[A-Za-z0-9_.-]+\.json', name) or name in seen_paths:
            raise ValueError('Unsafe or duplicate directory part: ' + name)
        seen_paths.add(name)
        raw = (path.parent.parent / name).read_bytes()
        if verify and part.get('sha256') != hashlib.sha256(raw).hexdigest():
            raise ValueError('Directory part checksum mismatch: ' + name)
        document = json.loads(raw)
        if document.get('edition') != data['edition'] or len(document['labs']) != part['count']:
            raise ValueError('Directory part version/count mismatch: ' + name)
        labs.extend(document['labs'])
        if verify and part.get('compressedPath'):
            zipped = (path.parent.parent / part['compressedPath']).read_bytes()
            if gzip.decompress(zipped) != raw:
                raise ValueError('Compressed part differs: ' + name)
    ids = [row['id'] for row in labs]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate stable record IDs')
    if data.get('totalRecords', len(labs)) != len(labs):
        raise ValueError('Directory total mismatch')
    data['labs'] = labs
    return data


def write_catalog(data, output_dir, part_size=2000):
    """Keep the first 18 stable detail cards in the manifest, partition the rest."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    all_labs = data['labs']
    manifest = {**data, 'labs': all_labs[:18], 'totalRecords': len(all_labs),
                'storageFormat': 'partitioned-v1', 'dataParts': []}
    version = re.sub('[^a-zA-Z0-9_-]', '-', data['edition'])
    written = []
    for index, start in enumerate(range(18, len(all_labs), part_size), 1):
        rows = all_labs[start:start + part_size]
        filename = f'lab-records-{version}-{index:02d}.json'
        document = {'schemaVersion': 1, 'edition': data['edition'], 'labs': rows}
        raw = (json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        zipped = gzip.compress(raw, compresslevel=9, mtime=0)
        (output_dir / filename).write_bytes(raw)
        (output_dir / (filename + '.gz')).write_bytes(zipped)
        manifest['dataParts'].append({'path': 'data/' + filename,
            'compressedPath': 'data/' + filename + '.gz', 'count': len(rows),
            'bytes': len(raw), 'compressedBytes': len(zipped),
            'sha256': hashlib.sha256(raw).hexdigest()})
        written.extend([filename, filename + '.gz'])
    raw = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (output_dir / 'labs.json').write_bytes(raw)
    (output_dir / 'labs.json.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    return manifest, written


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'data/labs.json')
    parser.add_argument('--output', type=Path, help='Write a complete unpartitioned review snapshot.')
    args = parser.parse_args()
    data = load_catalog(args.input)
    if args.output:
        # A full review snapshot is standalone; do not re-append its parts.
        data.pop('dataParts', None)
        data.pop('storageFormat', None)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'edition': data['edition'], 'records': len(data['labs']),
                     'parts': len(data.get('dataParts', []))}))


if __name__ == '__main__':
    main()
