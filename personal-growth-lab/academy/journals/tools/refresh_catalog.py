#!/usr/bin/env python3
"""Refresh an evidence-labelled OpenAlex journal snapshot without inventing metrics.

Python 3 standard library only. By default this downloads the anonymous public
CC0 sources snapshot (only the sources entity, not the full works database).
Optional --mode api uses a user-provided OPENALEX_API_KEY for cursor pagination.
No account is created and no email is sent. API failures leave the last complete
published snapshot untouched. Use --cache-dir to resume an interrupted retrieval.

  python tools/refresh_catalog.py --cache-dir /tmp/journal-catalog-cache

OpenAlex data are CC0: https://help.openalex.org/data/how-its-built/
This file deliberately does not compute JIF, JCR/CAS quartiles, submission
numbers, acceptance rates, or review durations from bibliographic metadata.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.openalex.org"
SNAPSHOT_MANIFEST = "https://openalex.s3.amazonaws.com/data/jsonl/sources/manifest.json"
FIELDS = [
    "id", "display_name", "issn_l", "issn", "host_organization_name",
    "country_code", "homepage_url", "topics", "is_oa", "is_in_doaj",
    "listed_in", "apc_usd", "apc_prices", "works_count", "counts_by_year",
    "first_publication_year", "last_publication_year", "alternate_titles",
    "is_in_scielo", "is_core", "updated_date",
]
FIELD_ZH = {
    "Agricultural and Biological Sciences": "农业与生物科学",
    "Arts and Humanities": "艺术与人文学科",
    "Biochemistry, Genetics and Molecular Biology": "生物化学、遗传与分子生物学",
    "Business, Management and Accounting": "商业、管理与会计",
    "Chemical Engineering": "化学工程", "Chemistry": "化学",
    "Computer Science": "计算机科学", "Decision Sciences": "决策科学",
    "Dentistry": "口腔医学", "Earth and Planetary Sciences": "地球与行星科学",
    "Economics, Econometrics and Finance": "经济、计量与金融",
    "Energy": "能源", "Engineering": "工程学", "Environmental Science": "环境科学",
    "Health Professions": "健康专业", "Immunology and Microbiology": "免疫学与微生物学",
    "Materials Science": "材料科学", "Mathematics": "数学", "Medicine": "医学",
    "Neuroscience": "神经科学", "Nursing": "护理学",
    "Pharmacology, Toxicology and Pharmaceutics": "药理、毒理与药剂学",
    "Physics and Astronomy": "物理与天文学", "Psychology": "心理学",
    "Social Sciences": "社会科学", "Veterinary": "兽医学",
    "Multidisciplinary": "综合学科", "Unclassified": "尚未分类",
}
SUMMARY_BASE = {
    "id", "name", "issnL", "issns", "publisher", "country", "fields",
    "isOA", "isDOAJ", "listedIn", "lastYear", "worksCount", "latestAnnual",
    "warnings", "detailShard", "topics",
}
DETAIL_BASE = SUMMARY_BASE | {
    "homepage", "subfields", "topics", "apcUSD", "apcPrices", "annual",
    "firstYear", "source", "checkedAt", "sourceUpdatedAt", "alternateTitles",
    "isSciELO", "isCore", "sourceIds", "metadataBasis", "activityStatus",
    "sourceSnapshotDate",
}


def json_read(path, default=None):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     delete=False, suffix=".tmp") as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, path)


def get_json(path, params=None, retries=4):
    query = dict(params or {})
    key = os.environ.get("OPENALEX_API_KEY")
    if key:
        query["api_key"] = key
    url = API + path
    if query:
        url += "?" + urllib.parse.urlencode(query)
    request = urllib.request.Request(url, headers={
        "User-Agent": "GrowthAcademyJournalCatalog/1.0 (public research metadata)",
        "Accept": "application/json", "Accept-Encoding": "gzip",
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
                if response.headers.get("Content-Encoding") == "gzip":
                    payload = gzip.decompress(payload)
                return json.loads(payload)
        except urllib.error.HTTPError as exc:
            # Never print the request URL, because it could contain a user key.
            if exc.code in (401, 403):
                raise RuntimeError(f"OpenAlex returned HTTP {exc.code}; current snapshot was not replaced") from None
            if exc.code == 429 and attempt == retries - 1:
                raise RuntimeError("OpenAlex budget/rate limit reached; retain the previous snapshot and retry later") from None
            if exc.code not in (429, 500, 502, 503, 504) or attempt == retries - 1:
                raise RuntimeError(f"OpenAlex returned HTTP {exc.code}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == retries - 1:
                raise RuntimeError("Public metadata retrieval failed; previous snapshot was not replaced") from None
        time.sleep(min(2 ** attempt, 8))
    raise RuntimeError("Metadata retrieval failed")


def read_public_json(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)


def download_snapshot_file(entry, cache):
    url = entry["url"].replace("s3://openalex/", "https://openalex.s3.amazonaws.com/")
    # Manifest URLs, rather than guessed or privileged bucket paths, are used.
    if not url.startswith("https://openalex.s3.amazonaws.com/data/jsonl/sources/"):
        raise RuntimeError("Unexpected snapshot URL")
    local = cache / hashlib.sha256(url.encode()).hexdigest()[:24]
    expected = entry["meta"]["content_length"]
    if local.exists() and local.stat().st_size == expected:
        return local
    for attempt in range(4):
        temporary = local.with_suffix(".part")
        try:
            with urllib.request.urlopen(url, timeout=60) as response, temporary.open("wb") as target:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    target.write(block)
            if temporary.stat().st_size != expected:
                raise RuntimeError("Snapshot file length mismatch")
            os.replace(temporary, local)
            return local
        except (urllib.error.URLError, TimeoutError, RuntimeError):
            if attempt == 3:
                raise RuntimeError("Snapshot download incomplete; public files were not replaced") from None
            time.sleep(min(2 ** attempt, 8))


def snapshot_records(args, cache_root, current_year):
    cache = cache_root / "snapshot"
    cache.mkdir(parents=True, exist_ok=True)
    manifest_path = cache / "manifest.json"
    if args.offline:
        manifest = json_read(manifest_path)
        if not manifest:
            raise SystemExit("No cached snapshot manifest")
    else:
        manifest = read_public_json(SNAPSHOT_MANIFEST)
        atomic_json(manifest_path, manifest)
    print(f"Public sources snapshot {manifest['date']}: {manifest['record_count']:,} sources; "
          f"{manifest['content_length'] / 1024**2:.1f} MiB compressed", flush=True)
    files = manifest["files"]
    if args.offline:
        local_files = []
        for entry in files:
            url = entry["url"].replace("s3://openalex/", "https://openalex.s3.amazonaws.com/")
            local = cache / hashlib.sha256(url.encode()).hexdigest()[:24]
            if not local.exists() or local.stat().st_size != entry["meta"]["content_length"]:
                raise SystemExit("Snapshot cache incomplete; no published files were changed")
            local_files.append(local)
    else:
        local_files = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(download_snapshot_file, entry, cache) for entry in files]
            for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                local_files.append(future.result())
                if i % 20 == 0:
                    print(f"Downloaded {i}/{len(files)} source partitions", flush=True)
    records, source_count = [], 0
    for index, path in enumerate(local_files, 1):
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                raw = json.loads(line)
                source_count += 1
                if (raw.get("type") != "journal"
                    or not raw.get("issn")
                    or (raw.get("last_publication_year") or 0) < args.since_year
                    or (raw.get("works_count") or 0) < args.minimum_works):
                    continue
                record = normalize(raw, args.checked_at, args.since_year, current_year)
                record["sourceSnapshotDate"] = manifest["date"]
                record["metadataBasis"] = f"OpenAlex public sources snapshot {manifest['date']}; indexed works, not official publication or submission counts"
                records.append(record)
        if index % 20 == 0:
            print(f"Processed {source_count:,} source records; {len(records):,} qualifying journals", flush=True)
    if source_count != manifest["record_count"]:
        raise RuntimeError("Snapshot record-count mismatch; no published files were changed")
    if not args.offline and read_public_json(SNAPSHOT_MANIFEST) != manifest:
        raise RuntimeError("Public snapshot changed during retrieval; retry before publishing")
    return records, manifest


def distinct(items):
    return list(dict.fromkeys(x for x in items if x is not None and x != ""))


def valid_issn(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{3}[\dX]", value):
        return False
    digits = [10 if x == "X" else int(x) for x in value.replace("-", "")]
    return sum(x * (8 - i) for i, x in enumerate(digits)) % 11 == 0


def normalize(raw, checked_at, since_year, current_year):
    source_id = raw["id"].rsplit("/", 1)[-1]
    issns = distinct([raw.get("issn_l")] + raw.get("issn", []))
    topics = raw.get("topics") or []
    # Use all available OpenAlex top topics to avoid excluding interdisciplinary
    # journals from filters. Topic classification is not a JCR/CAS category.
    fields = distinct(t.get("field", {}).get("display_name") for t in topics)
    subfields = distinct(t.get("subfield", {}).get("display_name") for t in topics)
    annual = [
        {"year": int(y["year"]), "count": y.get("works_count", 0),
         "citations": y.get("cited_by_count", 0)}
        for y in raw.get("counts_by_year", [])
        if 2016 <= int(y["year"]) <= current_year
    ]
    annual.sort(key=lambda y: y["year"])
    warnings = []
    if any(not valid_issn(x) for x in issns):
        warnings.append("ISSN 格式或校验位存在异常，需核对官方刊物身份")
    if (raw.get("first_publication_year") or 9999) < 1665:
        warnings.append("索引最早年份早于现代学术期刊出现年代，可能存在记录归并或年份错误")
    if any(y["count"] > 100000 for y in annual):
        warnings.append("某年索引量超过 100,000 条，需排查记录归并或文献类型异常")
    if (raw.get("works_count") or 0) > 1000000:
        warnings.append("累计索引量超过 1,000,000 条，需核对期刊身份与记录归并")
    if (raw.get("last_publication_year") or 0) > current_year:
        warnings.append("索引最新出版年晚于当前年份，可能含提前编期或元数据年份错误")
    if not any(y["year"] >= since_year and y["count"] > 0 for y in annual):
        warnings.append("最近出版年字段与年度计数未完全对应；当前征稿状态待核验")
    if not raw.get("homepage_url"):
        warnings.append("OpenAlex 未提供期刊主页，请按 ISSN 核对出版社官网")
    complete = [y for y in annual if y["year"] < current_year]
    latest = complete[-1] if complete else (annual[-1] if annual else None)
    record = {
        "id": source_id, "name": raw["display_name"], "issnL": raw.get("issn_l"),
        "issns": issns, "publisher": raw.get("host_organization_name"),
        "country": raw.get("country_code"), "homepage": raw.get("homepage_url"),
        "fields": fields or ["Unclassified"], "subfields": subfields,
        "topics": [t.get("display_name") for t in topics[:10] if t.get("display_name")],
        "isOA": raw.get("is_oa"), "isDOAJ": raw.get("is_in_doaj"),
        "isSciELO": raw.get("is_in_scielo"), "isCore": raw.get("is_core"),
        "listedIn": raw.get("listed_in", []), "apcUSD": raw.get("apc_usd"),
        "apcPrices": raw.get("apc_prices", []), "worksCount": raw.get("works_count"),
        "annual": annual, "latestAnnual": ({"year": latest["year"], "count": latest["count"]} if latest else None),
        "firstYear": raw.get("first_publication_year"), "lastYear": raw.get("last_publication_year"),
        "source": f"{API}/sources/{source_id}", "checkedAt": checked_at,
        "sourceUpdatedAt": raw.get("updated_date"), "alternateTitles": raw.get("alternate_titles", []),
        "warnings": warnings, "sourceIds": [source_id],
        "metadataBasis": "OpenAlex bibliographic metadata; indexed works are not publisher submission or acceptance counts",
        "activityStatus": "recent_indexed_activity_unverified_submission_status",
        "detailShard": f"details/{int(source_id[1:]) % 100:02}.json",
    }
    return record


def deduplicate(records):
    """Merge duplicate OpenAlex source IDs sharing ISSN identities, without sums.

    The best populated record is retained as a representative. Bibliographic
    counts from aliases must never be summed, because works may overlap.
    """
    parent = list(range(len(records)))
    owner = {}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for index, record in enumerate(records):
        for issn in record["issns"]:
            if issn in owner:
                parent[find(index)] = find(owner[issn])
            else:
                owner[issn] = index
    groups = collections.defaultdict(list)
    for index, record in enumerate(records):
        groups[find(index)].append(record)
    representatives = []
    for group in groups.values():
        group.sort(key=lambda r: (-(r.get("worksCount") or 0), r["id"]))
        keeper = group[0]
        for record in group[1:]:
            keeper["sourceIds"] = distinct(keeper["sourceIds"] + record["sourceIds"])
            keeper["issns"] = distinct(keeper["issns"] + record["issns"])
            keeper["alternateTitles"] = distinct(keeper["alternateTitles"] + [record["name"]] + record["alternateTitles"])
        if len(group) > 1:
            keeper["warnings"] = distinct(keeper["warnings"] + ["多个 OpenAlex 来源记录共享 ISSN；已合并身份，年度数量未相加"])
        representatives.append(keeper)
    return sorted(representatives, key=lambda r: r["id"]), len(records) - len(representatives)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent.parent / "data")
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--since-year", type=int, default=2023)
    parser.add_argument("--minimum-works", type=int, default=100)
    parser.add_argument("--checked-at", default=dt.date.today().isoformat())
    parser.add_argument("--offline", action="store_true", help="Rebuild only from a complete cache")
    parser.add_argument("--mode", choices=["snapshot", "api"], default="snapshot")
    args = parser.parse_args()
    checked = dt.date.fromisoformat(args.checked_at)
    current_year = checked.year
    filters = f"type:journal,last_publication_year:>{args.since_year - 1},has_issn:true,works_count:>{args.minimum_works - 1}"
    query = {"filter": filters, "sort": "works_count:desc", "select": ",".join(FIELDS), "per_page": 200}
    cache_root = args.cache_dir or Path(tempfile.mkdtemp(prefix="journal-catalog-"))
    cache = cache_root / hashlib.sha256(json.dumps(query, sort_keys=True).encode()).hexdigest()[:12]
    cache.mkdir(parents=True, exist_ok=True)
    source_lists_path = cache / "source-lists.json"
    if args.offline:
        if not source_lists_path.exists():
            raise SystemExit("No cached source-list metadata")
    else:
        atomic_json(source_lists_path, get_json("/source-lists", {"per_page": 100}))
    source_lists = json_read(source_lists_path)["results"]
    snapshot_manifest = None
    if args.mode == "snapshot":
        all_records, snapshot_manifest = snapshot_records(args, cache_root, current_year)
        reported_count = len(all_records)
        cursor, page = None, 0
    else:
        if not os.environ.get("OPENALEX_API_KEY"):
            raise SystemExit("API cursor paging requires your own OPENALEX_API_KEY; use the default anonymous public snapshot mode instead")
        cursor, page, all_records, reported_count = "*", 0, [], None
    while cursor:
        page += 1
        page_path = cache / f"page-{page:05}.json"
        response = json_read(page_path)
        if response is None:
            if args.offline:
                raise SystemExit(f"Cache incomplete at page {page}; no published files were changed")
            response = get_json("/sources", {**query, "cursor": cursor})
            atomic_json(page_path, response)
        if response.get("error"):
            raise SystemExit("OpenAlex rejected the query; no published files were changed")
        if reported_count is None:
            reported_count = response["meta"]["count"]
            print(f"OpenAlex reports {reported_count:,} qualifying source records", flush=True)
        all_records.extend(normalize(r, args.checked_at, args.since_year, current_year) for r in response.get("results", []))
        next_cursor = response.get("meta", {}).get("next_cursor")
        if not response.get("results"):
            break
        if next_cursor == cursor:
            raise SystemExit("Cursor did not advance; no published files were changed")
        cursor = next_cursor
        if page % 10 == 0:
            print(f"Retrieved {len(all_records):,} source records ({page} pages)", flush=True)
    if not all_records or len(all_records) < reported_count * 0.98:
        raise SystemExit("Incomplete or empty catalog; no published files were changed")
    journals, duplicates = deduplicate(all_records)
    old_catalog = json_read(args.output_dir / "catalog.json", {}) or {}
    old_summaries = {r["id"]: r for r in old_catalog.get("journals", [])}
    old_shards = {}
    shard_records = collections.defaultdict(dict)
    summary_records = []
    field_counts, country_counts, list_counts = collections.Counter(), collections.Counter(), collections.Counter()
    for record in journals:
        old_summary = old_summaries.get(record["id"], {})
        old_path = old_summary.get("detailShard")
        if old_path and old_path not in old_shards:
            old_shards[old_path] = json_read(args.output_dir / old_path, {}) or {}
        old_detail = old_shards.get(old_path, {}).get(record["id"], {})
        # Preserve publisher/JCR/manual enrichment produced by other importers.
        for key, value in old_detail.items():
            if key not in DETAIL_BASE:
                record[key] = value
        summary = {key: record.get(key) for key in sorted(SUMMARY_BASE)}
        summary["topics"] = record["topics"][:3]
        for key, value in old_summary.items():
            if key not in SUMMARY_BASE:
                summary[key] = value
        summary_records.append(summary)
        shard_records[record["detailShard"]][record["id"]] = record
        field_counts.update(record["fields"])
        country_counts.update([record["country"]] if record["country"] else [])
        list_counts.update(record["listedIn"])
    field_metadata = [{"name": name, "zh": FIELD_ZH.get(name, name), "count": count}
                      for name, count in sorted(field_counts.items())]
    meta = {
        **old_catalog.get("meta", {}),
        "schemaVersion": "1.0", "checkedAt": args.checked_at,
        "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "OpenAlex", "license": "CC0", "licenseURL": "https://help.openalex.org/data/how-its-built/",
        "query": f"{API}/sources?" + urllib.parse.urlencode(query),
        "filter": filters, "sourceCountReported": reported_count,
        "retrievalMode": args.mode,
        "snapshotDate": snapshot_manifest["date"] if snapshot_manifest else None,
        "snapshotManifest": SNAPSHOT_MANIFEST if snapshot_manifest else None,
        "snapshotSourceCount": snapshot_manifest["record_count"] if snapshot_manifest else None,
        "sourceListMetadataCheckedAt": args.checked_at,
        "sourceRecordsFetched": len(all_records), "journalCount": len(journals),
        "duplicateSourceRecordsMerged": duplicates,
        "fieldCount": len([x for x in field_metadata if x["name"] != "Unclassified"]),
        "countryCount": len(country_counts), "snapshotCompleteForFilter": True,
        "detailShardCount": len(shard_records), "annualYears": [2016, current_year],
        "currentYearIncomplete": current_year,
        "scope": f"OpenAlex 标记为 journal、有 ISSN、最近出版年不早于 {args.since_year}、累计索引作品至少 {args.minimum_works} 条的候选记录；按 ISSN 去重。",
        "coverageNote": "目录覆盖多个学科，但不是全球全部期刊或经人工验证的征稿白名单；新刊、小刊、缺失 ISSN 的期刊可能未纳入。",
        "countDefinition": "年度数量为 OpenAlex 当前快照预计算的索引作品数，可能包含评论、勘误、社论等，并受索引延迟与来源归并影响；不是出版社官方发文量、JIF 分母、投稿量或录用量。",
        "topicDefinition": "学科与主题来自 OpenAlex 自动分类，不是 JCR 学科或中科院分区。",
        "indexingDefinition": "listedIn 为 OpenAlex 转录的外部名单成员关系；来源名单名称、维护者和版次见 sourceLists。缺失成员关系不等于未收录。",
        "apcDefinition": "APC 为 OpenAlex 元数据中记录的目录价格；币种、税费、减免、文章类型和报价年份需向出版社复核，缺失值不等于免费。",
        "activityDefinition": "最近存在索引记录不保证该刊仍然征稿；投稿前核对出版社官网、刊名变更及收录状态。",
        "metricsNotInferred": ["Journal Impact Factor", "JCR quartile", "CAS partition", "SCIE", "SSCI", "Scopus", "acceptance rate", "submission count", "review duration"],
    }
    full_meta = {**meta, "fields": field_metadata,
                 "countries": [{"code": k, "count": v} for k, v in sorted(country_counts.items())],
                 "sourceLists": source_lists,
                 "sourceListCounts": dict(sorted(list_counts.items())),
                 "warningCount": sum(bool(r["warnings"]) for r in journals),
                 "unclassifiedCount": field_counts.get("Unclassified", 0)}
    # Complete all network work before touching the public snapshot.
    for path, records in sorted(shard_records.items()):
        atomic_json(args.output_dir / path, records)
    atomic_json(args.output_dir / "catalog-meta.json", full_meta)
    atomic_json(args.output_dir / "catalog.json", {"meta": meta, "fields": field_metadata, "journals": summary_records})
    print(json.dumps({"journals": len(journals), "sourceRecords": len(all_records), "duplicates": duplicates,
                      "fields": len(field_metadata), "countries": len(country_counts),
                      "sourceLists": len(source_lists), "shards": len(shard_records),
                      "catalogBytes": (args.output_dir / "catalog.json").stat().st_size}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
