#!/usr/bin/env python3
r"""Download/normalize the public DOAJ journal CSV using Python's standard library.

Online:
  python tools/normalize_doaj.py --download --csv /tmp/journal-cache/doaj.csv \
    --output /tmp/journal-cache/doaj-enrichment.json
Offline, with a known export date:
  python tools/normalize_doaj.py --csv /tmp/journal-cache/doaj.csv \
    --snapshot-at 2026-09-20T23:37:09Z \
    --output /tmp/journal-cache/doaj-enrichment.json

No login or premium API is used. Signed redirect URLs are neither printed nor
stored. Output is written atomically after all records pass validation. The
CSV export date comes from HTTP Last-Modified, a matching download sidecar, or
--snapshot-at; it remains null when unknown. Metadata licensing was reviewed
2026-10-21; refreshing records does not automatically re-audit future terms.
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
from email.utils import parsedate_to_datetime
import hashlib
import json
import os
import pathlib
import re
import tempfile
import time
import urllib.error
import urllib.request

SOURCE_URL = 'https://doaj.org/csv'
REQUIRED_HEADERS = (
    'Journal title',
    'Journal URL',
    'URL in DOAJ',
    'When did the journal start to publish all content using an open license?',
    'Alternative title',
    'Journal ISSN (print version)',
    'Journal EISSN (online version)',
    'Keywords',
    'Languages in which the journal accepts manuscripts',
    'Publisher',
    'Country of publisher',
    'Other organisation',
    'Country of other organisation',
    'Journal license',
    'License attributes',
    'URL for license terms',
    'Machine-readable CC licensing information embedded or displayed in articles',
    'Author holds copyright without restrictions',
    'Copyright information URL',
    'Review process',
    'Review process information URL',
    'Journal plagiarism screening policy',
    "URL for journal's aims & scope",
    'URL for the Editorial Board page',
    "URL for journal's instructions for authors",
    'Average number of weeks between article submission and publication',
    'APC',
    'APC information URL',
    'APC amount',
    'Journal waiver policy (for developing country authors etc)',
    'Waiver policy information URL',
    'Has other fees',
    'Other fees information URL',
    'Preservation Services',
    'Preservation Service: national library',
    'Preservation information URL',
    'Deposit policy directory',
    'URL for deposit policy',
    'Persistent article identifiers',
    "Does the journal comply to DOAJ's definition of open access?",
    'Continues',
    'Continued By',
    'LCC Codes',
    'Subscribe to Open',
    'Mirror Journal',
    'Open Journals Collective',
    'Subjects',
    'Added on Date',
    'Last updated Date',
    'Last Full Review Date',
)


def optional(value):
    return value.strip() or None


def yes_no(value):
    return {'Yes': True, 'No': False}.get(value.strip())


def split_values(value, separator=','):
    return [part.strip() for part in value.split(separator) if part.strip()]


def issn_valid(value):
    digits = value.replace('-', '').upper()
    if not re.fullmatch(r'\d{7}[\dX]', digits):
        return False
    last = 10 if digits[7] == 'X' else int(digits[7])
    return (sum(int(char) * (8 - i) for i, char in enumerate(digits[:7])) + last) % 11 == 0


def prices(value):
    parsed = []
    for part in split_values(value, ';'):
        match = re.fullmatch(r'(\d+(?:\.\d+)?)\s+([A-Z]{3})', part)
        if not match:
            raise ValueError(f'Unrecognized APC format: {part!r}')
        amount = float(match.group(1))
        if amount.is_integer():
            amount = int(amount)
        parsed.append({'amount': amount, 'currency': match.group(2)})
    return parsed


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent,
                                         suffix='.tmp', delete=False) as handle:
            temporary = pathlib.Path(handle.name)
            json.dump(value, handle, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            handle.write('\n')
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def normalize_snapshot_date(value):
    if not value:
        return None
    if len(value) == 10:
        return dt.date.fromisoformat(value).isoformat()
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('--snapshot-at timestamps must include a timezone, or use YYYY-MM-DD')
    return parsed.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def download_csv(path, timeout):
    path.parent.mkdir(parents=True, exist_ok=True)
    # A fresh public request avoids stale cached redirects with expired S3 signatures.
    public_request = SOURCE_URL + '?download=1&refresh=' + str(int(time.time()))
    request = urllib.request.Request(public_request, headers={
        'User-Agent': 'GrowthAcademyJournalCatalog/1.0 (public research metadata)',
        'Cache-Control': 'no-cache',
        'Accept': 'text/csv,application/octet-stream;q=0.9,*/*;q=0.5',
    })
    temporary = None
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            modified = response.headers.get('Last-Modified')
            snapshot = None
            if modified:
                try:
                    timestamp = parsedate_to_datetime(modified)
                    if timestamp.tzinfo is not None:
                        snapshot = timestamp.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
                except (TypeError, ValueError, OverflowError):
                    pass
            with tempfile.NamedTemporaryFile('wb', dir=path.parent, suffix='.part', delete=False) as handle:
                temporary = pathlib.Path(handle.name)
                digest = hashlib.sha256()
                size = 0
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    handle.write(block)
                    digest.update(block)
                    size += len(block)
        if not size:
            raise ValueError('DOAJ public download was empty')
        with temporary.open(encoding='utf-8-sig', newline='') as handle:
            header = next(csv.reader(handle), [])
        if not set(REQUIRED_HEADERS).issubset(header):
            raise ValueError('Public download is not the expected DOAJ CSV; existing input was retained')
        os.replace(temporary, path)
        info = {
            'source': SOURCE_URL,
            'downloadedAt': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z'),
            'sourceLastModified': modified,
            'snapshotAt': snapshot,
            'sourceByteLength': size,
            'sourceSha256': digest.hexdigest(),
        }
        atomic_json(path.with_suffix(path.suffix + '.download.json'), info)
        return info
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def normalize_file(csv_path, checked_at, snapshot_at, snapshot_basis):
    source_path = csv_path
    source_bytes = source_path.read_bytes()
    with source_path.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        missing = sorted(set(REQUIRED_HEADERS) - set(reader.fieldnames or []))
        if missing:
            raise ValueError('DOAJ CSV is missing columns: ' + ', '.join(missing))
        rows = list(reader)
    if not rows:
        raise ValueError('DOAJ CSV contains no journal records')

    journals = []
    issn_map = collections.defaultdict(list)
    for row in rows:
        source = row['URL in DOAJ'].strip()
        issns = list(dict.fromkeys(filter(None, (
            row['Journal ISSN (print version)'].strip().upper(),
            row['Journal EISSN (online version)'].strip().upper(),
        ))))
        if not issns or not all(issn_valid(issn) for issn in issns):
            raise ValueError('Invalid or missing ISSN in DOAJ record: ' + row['Journal title'])
        average = float(row['Average number of weeks between article submission and publication'])
        if average.is_integer():
            average = int(average)
        if average <= 0:
            raise ValueError('Publication time must be positive: ' + row['Journal title'])
        apc_charged = yes_no(row['APC'])
        other_fees = yes_no(row['Has other fees'])
        journal = {
            'name': row['Journal title'],
            'alternativeTitle': optional(row['Alternative title']),
            'issns': issns,
            'printIssn': optional(row['Journal ISSN (print version)']),
            'electronicIssn': optional(row['Journal EISSN (online version)']),
            'homepage': row['Journal URL'].strip(),
            'doajUrl': source,
            'source': source,
            'checkedAt': checked_at,
            'languages': split_values(row['Languages in which the journal accepts manuscripts']),
            'publisher': row['Publisher'],
            'publisherCountry': optional(row['Country of publisher']),
            'otherOrganization': optional(row['Other organisation']),
            'otherOrganizationCountry': optional(row['Country of other organisation']),
            'keywords': split_values(row['Keywords']),
            'subjects': split_values(row['Subjects'], '|'),
            'lccCodes': split_values(row['LCC Codes']),
            'apc': {
                'charged': apc_charged,
                'prices': prices(row['APC amount']),
                'amountRaw': optional(row['APC amount']),
                'informationUrl': optional(row['APC information URL']),
                'waiversDeclared': yes_no(row['Journal waiver policy (for developing country authors etc)']),
                'waiverInformationUrl': optional(row['Waiver policy information URL']),
            },
            'otherFees': {
                'charged': other_fees,
                'informationUrl': optional(row['Other fees information URL']),
            },
            'noAuthorFeesDeclared': apc_charged is False and other_fees is False,
            'publicationTime': {
                'averageWeeks': average,
                'stage': 'submission_to_publication',
                'statistic': 'publisher_reported_average',
                'period': None,
            },
            'review': {
                'models': split_values(row['Review process']),
                'informationUrl': optional(row['Review process information URL']),
            },
            'authorInstructionsUrl': optional(row["URL for journal's instructions for authors"]),
            'aimsScopeUrl': optional(row["URL for journal's aims & scope"]),
            'editorialBoardUrl': optional(row['URL for the Editorial Board page']),
            'licenses': split_values(row['Journal license']),
            'licenseAttributes': optional(row['License attributes']),
            'licenseTermsUrl': optional(row['URL for license terms']),
            'authorRetainsCopyright': yes_no(row['Author holds copyright without restrictions']),
            'copyrightInformationUrl': optional(row['Copyright information URL']),
            'machineReadableCcLicense': yes_no(row['Machine-readable CC licensing information embedded or displayed in articles']),
            'plagiarismScreeningDeclared': yes_no(row['Journal plagiarism screening policy']),
            'openContentSince': optional(row['When did the journal start to publish all content using an open license?']),
            'compliesWithDoajOaDefinition': yes_no(row["Does the journal comply to DOAJ's definition of open access?"]),
            'preservation': {
                'services': split_values(row['Preservation Services']),
                'nationalLibrary': optional(row['Preservation Service: national library']),
                'informationUrl': optional(row['Preservation information URL']),
            },
            'depositPolicy': {
                'directories': split_values(row['Deposit policy directory']),
                'informationUrl': optional(row['URL for deposit policy']),
            },
            'persistentArticleIdentifiers': split_values(row['Persistent article identifiers']),
            'continues': optional(row['Continues']),
            'continuedBy': optional(row['Continued By']),
            'subscribeToOpen': yes_no(row['Subscribe to Open']),
            'mirrorJournal': yes_no(row['Mirror Journal']),
            'openJournalsCollective': yes_no(row['Open Journals Collective']),
            'metadataAddedAt': optional(row['Added on Date']),
            'metadataUpdatedAt': optional(row['Last updated Date']),
            'lastFullReviewAt': optional(row['Last Full Review Date']),
        }
        journals.append(journal)
        for issn in issns:
            issn_map[issn].append({'name': journal['name'], 'source': source})

    duplicates = {issn: records for issn, records in issn_map.items() if len(records) > 1}
    metadata = {
        'name': 'DOAJ public journal metadata enrichment',
        'schemaVersion': 1,
        'provider': 'Directory of Open Access Journals (DOAJ)',
        'source': 'https://doaj.org/csv',
        'documentation': 'https://doaj.org/docs/journal-csv',
        'snapshotAt': snapshot_at,
        'snapshotDate': snapshot_at[:10] if snapshot_at else None,
        'snapshotAtBasis': snapshot_basis,
        'checkedAt': checked_at,
        'snapshotAgeDaysAtCheck': (dt.date.fromisoformat(checked_at) - dt.date.fromisoformat(snapshot_at[:10])).days if snapshot_at else None,
        'license': 'CC0-1.0',
        'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'licenseSource': 'https://doaj.org/terms/',
        'licenseSourceVersion': '1.6 (2025-12-08)',
        'licenseReviewedAt': '2026-10-21',
        'attribution': f'Journal-level metadata from the Directory of Open Access Journals (DOAJ), public CSV snapshot {snapshot_at or "date unknown"}, accessed {checked_at}. Normalized for display; record links and update dates retained.',
        'licenseNote': 'DOAJ current terms explicitly license journal-level metadata under CC0. The historical 2020 announcement describing CC BY-SA 4.0 is superseded by these current terms. The generic website-content license is separate from the journal-metadata license.',
        'sourceByteLength': len(source_bytes),
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'counts': {
            'journals': len(journals),
            'uniqueIssns': len(issn_map),
            'apcDeclared': sum(j['apc']['charged'] is True for j in journals),
            'noApcDeclared': sum(j['apc']['charged'] is False for j in journals),
            'otherFeesDeclared': sum(j['otherFees']['charged'] is True for j in journals),
            'noAuthorFeesDeclared': sum(j['noAuthorFeesDeclared'] for j in journals),
            'publicationTimeAvailable': sum(j['publicationTime']['averageWeeks'] is not None for j in journals),
            'continuedTitles': sum(j['continuedBy'] is not None for j in journals),
            'metadataUpdatedBefore2023': sum(bool(j['metadataUpdatedAt']) and j['metadataUpdatedAt'][:4] < '2023' for j in journals),
            'duplicateIssnKeys': len(duplicates),
        },
        'duplicateIssns': duplicates,
        'fieldDefinitions': {
            'source': 'All normalized record fields originate from the public DOAJ journal CSV; each record links to its DOAJ page. Linked publisher pages have not been independently fetched for every record.',
            'checkedAt': 'Date the public DOAJ CSV was fetched and normalized, not the date all publisher policies were individually re-verified.',
            'metadataUpdatedAt': 'Last updated Date from DOAJ. This is not an observation-period year for acceptance rates, review time, fees, or output.',
            'publicationTime': 'DOAJ field: Average number of weeks between article submission and publication. This is a publisher-reported average for the entire submission-to-publication process. It is not a first-decision, peer-review, or submission-to-acceptance metric; sampling method and statistical period are unspecified in the CSV.',
            'apc.prices': 'Amounts and currencies are preserved from DOAJ. Currency entries are not added together or converted. Tax inclusion, current eligibility, article-type variation, and final payable charges are not established by this CSV.',
            'noAuthorFeesDeclared': 'True only when DOAJ explicitly says No to both APC and Has other fees. This is a metadata declaration, not a guarantee of a zero invoice for every manuscript.',
            'publisherCountry': 'Country of publisher, not necessarily the editorial office, editorial-board country, or all journal affiliations.',
            'licenses': 'Journal article/content licenses reported in DOAJ; separate from the CC0 license of this metadata dataset.',
            'review.models': 'Reported review models, potentially more than one; no inference about acceptance probability is made.',
            'continuedBy': 'A nonempty value identifies a successor title in the source metadata; listing in this snapshot does not by itself prove the old title currently accepts submissions.',
            'indexing': 'Presence in this public snapshot establishes a DOAJ record as of the snapshot. It does not establish SCIE, SSCI, ESCI, PubMed, MEDLINE, Scopus, JCR quartiles, or CAS tiers.',
            'articleCounts': 'DOAJ Number of Article Records is omitted because it is not annual journal publication volume.',
        },
        'warnings': [
            'Snapshot date, retrieval date, and individual metadataUpdatedAt are different. Display all available dates; an unknown snapshot date must not be replaced with the download date.',
            'Do not overwrite duplicate ISSN keys silently. Inspect metadata.duplicateIssns and exclude conflicting title identities from automatic merging.',
            'DOAJ coverage is open-access journals, not all journals worldwide. Publication-time and fee metadata are publisher declarations, not verified applicant outcomes.',
        ],
    }


    return {'metadata': metadata, 'journals': journals}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--csv', type=pathlib.Path, required=True,
                        help='Public CSV input; also the download cache path with --download')
    parser.add_argument('--output', type=pathlib.Path, required=True, help='Normalized enrichment JSON output')
    parser.add_argument('--download', action='store_true', help='Fetch the public CSV before normalization')
    parser.add_argument('--checked-at', default=dt.date.today().isoformat(), help='Retrieval/check date, YYYY-MM-DD')
    parser.add_argument('--snapshot-at', help='Known export timestamp or YYYY-MM-DD; never inferred from file mtime')
    parser.add_argument('--timeout', type=float, default=60, help='Download socket timeout in seconds (default: 60)')
    args = parser.parse_args()
    try:
        checked_at = dt.date.fromisoformat(args.checked_at).isoformat()
        snapshot_at = normalize_snapshot_date(args.snapshot_at)
        if args.timeout <= 0:
            raise ValueError('--timeout must be positive')
        if args.csv.resolve() == args.output.resolve():
            raise ValueError('--csv and --output must be different paths')
        download_info = download_csv(args.csv, args.timeout) if args.download else None
        snapshot_basis = 'explicit_cli_argument' if snapshot_at else 'unknown'
        if not download_info:
            sidecar = args.csv.with_suffix(args.csv.suffix + '.download.json')
            if sidecar.exists():
                cached_info = json.loads(sidecar.read_text(encoding='utf-8'))
                if cached_info.get('sourceSha256') == hashlib.sha256(args.csv.read_bytes()).hexdigest():
                    download_info = cached_info
        if not snapshot_at and download_info and download_info.get('snapshotAt'):
            snapshot_at = normalize_snapshot_date(download_info['snapshotAt'])
            snapshot_basis = 'matching_download_http_last_modified'
        result = normalize_file(args.csv, checked_at, snapshot_at, snapshot_basis)
        if download_info:
            result['metadata']['download'] = download_info
        atomic_json(args.output, result)
    except urllib.error.HTTPError as error:
        parser.exit(1, f'DOAJ public download returned HTTP {error.code}; normalized output was not replaced.\n')
    except (urllib.error.URLError, TimeoutError):
        parser.exit(1, 'DOAJ public download failed; normalized output was not replaced.\n')
    except (ValueError, KeyError, OSError, csv.Error, UnicodeError) as error:
        parser.exit(1, f'Normalization failed: {error}\n')
    print(json.dumps({
        'output': str(args.output), 'bytes': args.output.stat().st_size,
        'snapshotAt': snapshot_at, 'checkedAt': checked_at,
        'counts': result['metadata']['counts'],
        'sourceSha256': result['metadata']['sourceSha256'],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
