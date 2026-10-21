#!/usr/bin/env python3
"""Extract relevant public UCAS interdisciplinary supervisor entries for review.

The programme track is an association, not a personal research profile or a
promise of an available position. Raw HTML is kept outside the public site.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = 'https://sais.ucas.ac.cn/index.php/zh/szdw/rhjs'


class DirectoryTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.links, self.row_links = [], [], [], [], []
        self.in_cell = False

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row, self.row_links = [], []
        if tag in ('td', 'th'):
            self.in_cell, self.cell, self.links = True, [], []
        if tag == 'a' and self.in_cell:
            url = dict(attrs).get('href', '')
            if url.startswith(('http://', 'https://')):
                self.links.append(url)

    def handle_data(self, data):
        if self.in_cell:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th'):
            self.row.append(' '.join(' '.join(self.cell).split()))
            self.row_links.append(self.links[:])
            self.in_cell = False
        if tag == 'tr' and len(self.row) >= 6:
            self.rows.append((self.row[:], self.row_links[:]))


def parse(raw):
    parser = DirectoryTable()
    parser.feed(raw.decode('utf-8'))
    grouped = {}
    for row, links in parser.rows:
        track, name, unit, homepage, subject, code = row[:6]
        name = re.sub(r'\s*（[^）]*）\s*', '', name).strip()
        relevant = track in ('脑机接口', '生物制造') or (
            track == '人工智能' and any(word in subject for word in
                ('生物', '医学', '心理', '药学', '生态', '公共卫生')))
        if not relevant or not re.fullmatch(r'[\u3400-\u9fff·]{2,10}', name):
            continue
        url = next(iter(links[3]), homepage).strip()
        # A missing scheme or descriptive link label is not a verified URL.
        if not url.startswith(('http://', 'https://')) or any(c.isspace() for c in url):
            url = SOURCE
        key = (name, unit)
        item = grouped.setdefault(key, {
            'name': name, 'institution': unit if unit.startswith('中国科学院') else '中国科学院' + unit,
            'country': '中国', 'profileUrl': url, 'tracks': [], 'subjects': [],
            'sourceUrl': SOURCE, 'sourceKind': 'official_directory',
            'recordType': 'listed_supervisor',
            'evidenceScope': '国科大交叉学院2026年10月选题库列名导师及共同培养单位；关联选题方向不等于已逐人核查的全部研究方向，接收名额需另行确认。'
        })
        if track not in item['tracks']:
            item['tracks'].append(track)
        if subject not in item['subjects']:
            item['subjects'].append(subject)
        if item['profileUrl'] == SOURCE and url != SOURCE:
            item['profileUrl'] = url
    if len(grouped) < 100:
        raise ValueError('Official directory structure or coverage changed; review before publication.')
    return list(grouped.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path)
    parser.add_argument('--retrieved-at', help='Actual fetch timestamp for an existing HTML snapshot.')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.html:
        if not args.retrieved_at:
            parser.error('Cached HTML requires --retrieved-at; parsing is not a new verification.')
        raw, fetched_at = args.html.read_bytes(), args.retrieved_at
    else:
        request = Request(SOURCE, headers={'User-Agent': 'ResearchDirectory/1.0'})
        with urlopen(request, timeout=45) as response:
            raw = response.read(6_000_000)
        fetched_at = datetime.now(timezone.utc).isoformat(timespec='seconds')
    records = parse(raw)
    payload = {'source': SOURCE, 'retrievedAt': fetched_at,
               'parsedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
               'sha256': hashlib.sha256(raw).hexdigest(), 'count': len(records),
               'records': records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'records': len(records), 'source': SOURCE}, ensure_ascii=False))


if __name__ == '__main__':
    main()
