#!/usr/bin/env python3
"""Idempotently merge reviewed public source additions into the large source manifest."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "personal-growth-lab/academy/data/lab-sources.json"
ADDITIONS = ROOT / "personal-growth-lab/academy/data/lab-source-additions-2026-10-26.json"


def apply(manifest_path=MANIFEST, additions_path=ADDITIONS):
    manifest_path, additions_path = Path(manifest_path), Path(additions_path)
    manifest = json.loads(manifest_path.read_text())
    additions = json.loads(additions_path.read_text())
    if manifest.get("schemaVersion") != 1 or additions.get("schemaVersion") != 1:
        raise ValueError("Unsupported source-manifest schema")
    sources = manifest.setdefault("sources", [])
    by_url = {row.get("url"): row for row in sources if row.get("url")}
    added = refreshed = 0
    stamp = additions["verifiedAt"]
    for item in additions.get("refresh", []):
        row = by_url.get(item["url"])
        if row is None:
            continue
        latest = {"date": stamp, "readMethod": "web_open", "scope": item["scope"]}
        row["verifiedAt"] = stamp
        row["reviewedAt"] = stamp
        row["latestReview"] = latest
        row["provenance"] = {**row.get("provenance", {}), "latestReview": latest}
        refreshed += 1
    for item in additions.get("sources", []):
        url = item["url"]
        row = by_url.get(url)
        if row is None:
            sources.append(item)
            by_url[url] = item
            added += 1
        else:
            latest = {"date": stamp, "readMethod": "web_open", "scope": item.get("provenance", {}).get("scope", "Reviewed official source.")}
            row["verifiedAt"] = stamp
            row["reviewedAt"] = stamp
            row["latestReview"] = latest
            row["provenance"] = {**row.get("provenance", {}), "latestReview": latest}
            refreshed += 1
    log = additions.get("editorialReviewLog")
    if log:
        history = manifest.setdefault("editorialReviewLog", [])
        if not any(item.get("reviewId") == log.get("reviewId") for item in history):
            history.append(log)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    return {"added": added, "refreshed": refreshed, "total": len(sources), "reviewId": additions.get("reviewId")}


if __name__ == "__main__":
    print(json.dumps(apply(), ensure_ascii=False))
