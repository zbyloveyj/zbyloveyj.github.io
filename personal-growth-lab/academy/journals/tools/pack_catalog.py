#!/usr/bin/env python3
"""Pack the completed journal catalog after all enrichment importers finish.

Creates deterministic .json.gz siblings (gzip mtime=0, no stored filename),
a small first-render featured.json, and a byte-size/checksum manifest.
Uncompressed files are retained locally for development and validation.
Production publishes the full catalog/details only as gzip; modern browsers
with DecompressionStream are required. Small preview/metadata JSON remain public.

    python tools/pack_catalog.py

The featured subset is a loading preview, not a journal quality ranking or a
submission recommendation. It favors documented metrics, balances fields, and
includes explicitly priced low-APC candidates when such metadata exist.
Unknown APC is never treated as zero. No network access is performed.
"""

from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def ensure_inside_project(path: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(PROJECT_ROOT)
    except ValueError:
        raise ValueError("All input and output paths must stay inside this journal project") from None
    return resolved


def read_json(path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path, value):
    path = ensure_inside_project(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                     suffix=".tmp", delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        handle.write("\n")
        temporary = Path(handle.name)
    os.replace(temporary, path)


def number(value):
    # bool is a subclass of int; an OA flag must never become a numeric price.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) else None


def metric(row):
    value = number(row.get("jifValue"))
    return value if value is not None and value >= 0 else None


def priority(row):
    impact = metric(row)
    return (
        not bool(row.get("curated")),
        impact is None,
        -(impact or 0),
        row.get("name", "").casefold(),
        row["id"],
    )


def choose_featured(journals, fields, low_cost, limit):
    by_id = {row["id"]: row for row in journals}
    if len(by_id) != len(journals):
        raise ValueError("Catalog contains duplicate journal IDs")
    ordered = sorted(journals, key=priority)
    documented = [row for row in ordered if row.get("curated") or metric(row) is not None]
    pool = documented or ordered
    by_field = collections.defaultdict(list)
    for row in pool:
        for field in row.get("fields", []):
            by_field[field].append(row)
    field_names = [field["name"] for field in fields if field.get("name") != "Unclassified"]
    selected, reasons = {}, {}

    def add(row, reason):
        if row["id"] not in selected and len(selected) < limit:
            selected[row["id"]] = row
            reasons[row["id"]] = reason
            return True
        return False

    # Establish cross-disciplinary coverage before filling with familiar titles.
    for field in field_names:
        if by_field[field]:
            add(by_field[field][0], "field_coverage")
    curated_added = 0
    for row in pool:
        if row.get("curated"):
            curated_added += add(row, "publisher_verified_or_curated")
        if curated_added >= 60:
            break

    # APC is source metadata, not a fresh publisher quote. We select only
    # explicit numeric USD prices; null/missing values are never 'free'.
    priced = [row for row in pool if row["id"] in low_cost]
    priced.sort(key=lambda row: (low_cost[row["id"]], priority(row)))
    cheap_added = 0
    for row in priced:
        cheap_added += add(row, "explicit_apc_metadata_at_most_1000_usd")
        if cheap_added >= 20:
            break

    # Round-robin fields rather than allowing large biomedical disciplines to
    # consume the whole first-render subset.
    for offset in range(1, 5):
        for field in field_names:
            candidates = by_field[field]
            if len(candidates) > offset:
                add(candidates[offset], "balanced_field_sample")
    for row in pool:
        add(row, "documented_metric_preview" if metric(row) is not None else "catalog_preview")
        if len(selected) == limit:
            break
    # With few enriched rows, allow a smaller preview instead of inventing
    # evidence or filling it with unrelated unverified titles.
    rows = sorted(selected.values(), key=priority)
    return rows, {
        "selectionCounts": dict(collections.Counter(reasons.values())),
        "documentedMetricOrCuratedPoolCount": len(documented),
        "fieldsRepresented": len({field for row in rows for field in row.get("fields", []) if field != "Unclassified"}),
        "lowCostMetadataAvailable": len(priced),
        "method": "Representative loading preview: field coverage, curated records, documented JIF, and explicit APC metadata <=1000 USD; not a quality ranking or submission recommendation.",
        "apcCaution": "APC values are bibliographic source metadata and may be old; publisher currency, taxes, article type and waivers must be checked. Unknown values are never interpreted as free.",
    }


def pack_one(raw_path, data_dir, level):
    raw_path = ensure_inside_project(raw_path)
    target_path = ensure_inside_project(raw_path.with_suffix(raw_path.suffix + ".gz"))
    source_digest = hashlib.sha256()
    raw_bytes = 0
    with tempfile.NamedTemporaryFile("wb", dir=target_path.parent, suffix=".tmp", delete=False) as target:
        temporary = Path(target.name)
        with gzip.GzipFile(filename="", mode="wb", compresslevel=level, fileobj=target, mtime=0) as packed:
            with raw_path.open("rb") as source:
                while True:
                    block = source.read(1024 * 1024)
                    if not block:
                        break
                    raw_bytes += len(block)
                    source_digest.update(block)
                    packed.write(block)
    os.replace(temporary, target_path)
    compressed_digest = hashlib.sha256()
    with target_path.open("rb") as source:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            compressed_digest.update(block)
    gzip_bytes = target_path.stat().st_size
    return {
        "path": raw_path.relative_to(data_dir).as_posix(),
        "gzipPath": target_path.relative_to(data_dir).as_posix(),
        "rawBytes": raw_bytes, "gzipBytes": gzip_bytes,
        "rawSHA256": source_digest.hexdigest(), "gzipSHA256": compressed_digest.hexdigest(),
        "gzipRatio": round(gzip_bytes / raw_bytes, 6) if raw_bytes else None,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=PROJECT_ROOT / "data")
    parser.add_argument("--featured-limit", type=int, default=200)
    parser.add_argument("--gzip-level", type=int, choices=range(1, 10), default=9)
    args = parser.parse_args()
    if not 1 <= args.featured_limit <= 200:
        parser.error("--featured-limit must be between 1 and 200")
    try:
        data_dir = ensure_inside_project(args.data_dir)
    except ValueError as error:
        parser.error(str(error))
    catalog_path = data_dir / "catalog.json"
    catalog = read_json(catalog_path)
    journals = catalog.get("journals", [])
    if not journals:
        raise SystemExit("Catalog is empty; packing was not performed")
    low_cost = {}
    for row in journals:
        price = number(row.get("apcUSD"))
        if price is not None and 0 <= price <= 1000:
            low_cost[row["id"]] = price
    detail_paths = sorted((data_dir / "details").glob("*.json"))
    for path in detail_paths:
        for journal_id, row in read_json(ensure_inside_project(path)).items():
            price = number(row.get("apcUSD"))
            if price is not None and 0 <= price <= 1000:
                low_cost[journal_id] = price
    featured_rows, selection = choose_featured(journals, catalog.get("fields", []), low_cost, args.featured_limit)
    featured_meta = {
        **catalog.get("meta", {}),
        "isFeaturedSubset": True,
        "loadedJournalCount": len(featured_rows),
        "totalJournalCount": len(journals),
        "featuredSelection": selection,
        "featuredNotice": "当前为快速加载的精选预览；完整目录在后台加载，预览结果不代表全库筛选结果。",
    }
    write_json_atomic(data_dir / "featured.json", {
        "meta": featured_meta, "fields": catalog.get("fields", []), "journals": featured_rows,
    })
    raw_paths = [catalog_path, data_dir / "featured.json"]
    if (data_dir / "catalog-meta.json").exists():
        raw_paths.append(data_dir / "catalog-meta.json")
    raw_paths.extend(detail_paths)
    for name in ('metric-evidence.json','publisher-evidence.json'):
        if (data_dir/name).exists():raw_paths.append(data_dir/name)
    files = []
    for i, path in enumerate(raw_paths, 1):
        files.append(pack_one(path, data_dir, args.gzip_level))
        if i % 20 == 0:
            print(f"Packed {i}/{len(raw_paths)} JSON files", flush=True)
    manifest = {
        "schemaVersion": "1.0",
        "catalogJournalCount": len(journals), "featuredJournalCount": len(featured_rows),
        "detailShardCount": len(detail_paths),
        "snapshotDate": catalog.get("meta", {}).get("snapshotDate"),
        "checkedAt": catalog.get("meta", {}).get("checkedAt"),
        "compression": {"format": "gzip", "level": args.gzip_level, "mtime": 0, "storedFilename": ""},
        "loadingOrder": ["featured.json", "catalog.json.gz", "details/{shard}.json.gz"],
        "fallback": "Raw full JSON is local-development only. Production requires DecompressionStream('gzip'); unsupported browsers receive an update-browser message.",
        "totalRawBytes": sum(item["rawBytes"] for item in files),
        "totalGzipBytes": sum(item["gzipBytes"] for item in files),
        "featuredSelection": selection,
        "files": files,
    }
    write_json_atomic(data_dir / "index-manifest.json", manifest)
    print(json.dumps({
        "journalCount": len(journals), "featuredCount": len(featured_rows),
        "files": len(files), "rawBytes": manifest["totalRawBytes"],
        "gzipBytes": manifest["totalGzipBytes"],
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
