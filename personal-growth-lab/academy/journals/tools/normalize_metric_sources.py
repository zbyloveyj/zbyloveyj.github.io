#!/usr/bin/env python3
"""Normalize public institutional journal tables, preserving source semantics.

Requires PyMuPDF, xlrd and Poppler's pdftotext. Supply the original source directory:
  python tools/normalize_metric_sources.py --source-dir /path/to/sources

Expected files: jif2026.pdf, quartiles2025.pdf, cas2025.xls.
No network access; source PDFs are not redistributed. JCR rows are recovered
from rotation-corrected PDF coordinates and the actual horizontal table rules,
so wrapped journal names and subject categories remain in their own cells.
"""
from __future__ import annotations

import argparse
import bisect
import collections
import datetime as dt
import json
from pathlib import Path
import re
import subprocess

import fitz
import xlrd

ROOT = Path(__file__).resolve().parents[1]
JIF_URL = 'https://www.niic.nsc.ru/phocadownload/publications/2025/JCR_JournalImpactFactor_2026.pdf'
JCR_URL = 'https://uefiscdi.gov.ro/resource-832709-JCR-2025.iunie-2026.site.pdf'
CAS_URL = 'https://ylxy.nwafu.edu.cn/docs//2026-10/a5ebc6d7a914485e89d9edd5f5b6d6e7.xls'
ISSN = re.compile(r'[0-9]{4}-[0-9]{3}[0-9X]|N/A')


def atomic_json(path, data):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def extract_quartiles(path):
    entries = []
    doc = fitz.open(path)
    bad = []
    # Poppler preserves a final narrow "I" that PyMuPDF drops in 29 crowded
    # triple-index cells. Cross-check only these cells by the exact page/ISSNs.
    text = subprocess.run(['pdftotext','-layout',str(path),'-'], capture_output=True, text=True, check=True).stdout
    index_lookup = {}
    pattern = re.compile(r'(?P<p>[0-9]{4}-[0-9]{3}[0-9X]|N/A)\s+(?P<e>[0-9]{4}-[0-9]{3}[0-9X]|N/A)\s+.*?\s+(?P<index>(?:(?:SCIE|SSCI|ESCI|AHCI)[, ]*)+)\s+(?:Q[1-4]|N/A)\s+(?:Q[1-4]|N/A)\s*$')
    for page_number, page_text in enumerate(text.split('\f'), 1):
        for line in page_text.splitlines():
            match = pattern.search(line)
            if match:
                index_lookup[(page_number,match['p'],match['e'])] = match['index'].strip()
    for page_index, page in enumerate(doc):
        matrix = page.rotation_matrix
        words = []
        for word in page.get_text('words'):
            rect = fitz.Rect(word[:4]) * matrix
            words.append((rect.x0, rect.y0, rect.x1, rect.y1, word[4]))
        lines = []
        for drawing in page.get_drawings():
            rect = drawing['rect'] * matrix
            if rect.width > 700 and rect.height <= 1.1:
                lines.append((rect.y0 + rect.y1) / 2)
        lines.sort()
        borders = []
        for y in lines:
            if not borders or abs(y - borders[-1]) > 0.5:
                borders.append(y)
        anchors = sorted((w for w in words if 350 <= (w[0]+w[2])/2 < 410
                          and ISSN.fullmatch(w[4])), key=lambda w: w[1])
        for anchor in anchors:
            y = (anchor[1] + anchor[3]) / 2
            position = bisect.bisect_right(borders, y)
            if position == 0 or position >= len(borders):
                bad.append({'page': page_index+1, 'issn': anchor[4], 'reason': 'row_without_table_bounds'})
                continue
            lower, upper = borders[position-1], borders[position]
            row = [w for w in words if lower < (w[1]+w[3])/2 < upper]

            def cell(left, right):
                chosen = [w for w in row if left <= (w[0]+w[2])/2 < right]
                chosen.sort(key=lambda w: (round(w[1], 1), w[0]))
                return ' '.join(w[4] for w in chosen).strip()

            name, p, e = cell(20, 285), cell(285, 350), cell(350, 410)
            category_words = [w for w in row if 410 <= (w[0]+w[2])/2 < 615
                              and not (w[0]>595 and re.fullmatch(r'(?:AHCI|SCIE|SSCI|ESCI|SSC),?',w[4]))]
            category_words.sort(key=lambda w:(round(w[1],1),w[0]))
            category = ' '.join(w[4] for w in category_words)
            index = cell(595, 665)
            if not re.fullmatch(r'(?:SCIE|SSCI|ESCI|AHCI)(?:[, ]+(?:SCIE|SSCI|ESCI|AHCI))*', index):
                index = index_lookup.get((page_index+1,p,e), index)
            q, aq = cell(665, 740), cell(740, 825)
            if (not name or not category or not ISSN.fullmatch(p) or not ISSN.fullmatch(e)
                or not re.fullmatch(r'Q[1-4]|N/A', q) or not re.fullmatch(r'Q[1-4]|N/A', aq)
                or not re.fullmatch(r'(?:SCIE|SSCI|ESCI|AHCI)(?:[, ]+(?:SCIE|SSCI|ESCI|AHCI))*', index)):
                bad.append({'page': page_index+1, 'name': name, 'issns': [p,e],
                            'category': category, 'index': index, 'quartile': q, 'ais': aq})
                continue
            entries.append({'name': name, 'issns': list(dict.fromkeys(x for x in (p,e) if x!='N/A')),
                            'category': category, 'indexes': re.findall(r'SCIE|SSCI|ESCI|AHCI', index),
                            'quartile': None if q=='N/A' else q, 'aisQuartile': None if aq=='N/A' else aq,
                            'page': page_index+1})
    if bad:
        raise RuntimeError('JCR geometry rejected rows: '+json.dumps(bad[:12], ensure_ascii=False)+f'; total={len(bad)}')
    if len(entries) != 32215:
        raise RuntimeError(f'Unexpected JCR row count: {len(entries)}; source layout/version requires review')
    return entries


def extract_jif(path):
    doc = fitz.open(path)
    entries = []
    for page_index, page in enumerate(doc):
        words = page.get_text('words')
        anchors = [w for w in words if 376 <= w[0] < 442 and ISSN.fullmatch(w[4])]
        for anchor in anchors:
            same = [w for w in words if abs(w[1]-anchor[1]) < 1.7]

            def column(lo, hi):
                return ' '.join(w[4] for w in sorted(same, key=lambda w:w[0]) if lo <= (w[0]+w[2])/2 < hi)

            def value(lo, hi):
                tokens = [w[4] for w in same if lo <= (w[0]+w[2])/2 < hi
                          and re.fullmatch(r'(?:\d+(?:\.\d+)?|<0\.1|N/A)', w[4])]
                return tokens[0] if len(tokens)==1 else None

            indexes = re.findall(r'SCIE|SSCI|ESCI|AHCI', column(443,510))
            if not indexes:
                continue
            entries.append({'name': column(0,376), 'issn': None if anchor[4]=='N/A' else anchor[4],
                            'indexes': indexes, 'jif2025': value(578,643), 'jif2024': value(643,708),
                            'page': page_index+1})
    if len(entries) < 21000:
        raise RuntimeError('Too few JIF rows; source layout/version requires review')
    return entries


def extract_cas(path):
    sheet = xlrd.open_workbook(path).sheet_by_index(0)
    if sheet.row_values(0) != ['刊名','分区','是否TOP期刊']:
        raise RuntimeError('CAS attachment columns changed; inspect before import')
    entries = []
    for row_index in range(1,sheet.nrows):
        name, zone, top = sheet.row_values(row_index)
        if str(zone).strip() and float(zone) in (1,2,3,4):
            entries.append({'name':name.strip(), 'zone':int(zone), 'top':str(top).strip()=='是', 'row':row_index+1})
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT/'data/metric-evidence.json')
    parser.add_argument('--checked-at', default=dt.date.today().isoformat())
    args = parser.parse_args()
    dt.date.fromisoformat(args.checked_at)
    old = json.loads(args.output.read_text()) if args.output.exists() else {}
    sources = old.get('sources') or {
        'jif': {'url':JIF_URL, 'provider':'Nikolaev Institute of Inorganic Chemistry, public JCR transcription',
                'metricYears':[2024,2025], 'releaseYear':2026},
        'jcr': {'url':JCR_URL, 'provider':'UEFISCDI, Romania', 'metricYear':2025, 'release':'2026-06'},
        'cas': {'url':CAS_URL, 'provider':'西北农林科技大学风景园林艺术学院公开附件', 'year':2025,
                'note':'历史参考表；只有刊名、分区、TOP，没有 ISSN 或大类/小类层级。'},
    }
    for source in sources.values():
        source['checkedAt'] = args.checked_at
    quartiles = extract_quartiles(args.source_dir/'quartiles2025.pdf')
    impact = extract_jif(args.source_dir/'jif2026.pdf')
    cas = extract_cas(args.source_dir/'cas2025.xls')
    result = {'checkedAt':args.checked_at, 'sources':sources, 'jif':impact, 'jcr':quartiles, 'cas':cas,
              'extraction': {'jcr':'rotation-corrected PDF word coordinates and horizontal row borders; wrapped names/categories retained',
                             'jif':'eISSN-anchored fixed columns; <0.1 and N/A remain literal source strings',
                             'cas':'original spreadsheet rows; no inferred ISSN or category level'}}
    atomic_json(args.output, result)
    print(json.dumps({'jcrRows':len(quartiles), 'jcrCategories':len({r['category'] for r in quartiles}),
                      'emptyCategories':sum(not r['category'] for r in quartiles),
                      'emptyTitles':sum(not r['name'] for r in quartiles),
                      'jifRows':len(impact), 'casRows':len(cas)}, ensure_ascii=False))


if __name__=='__main__':
    main()
