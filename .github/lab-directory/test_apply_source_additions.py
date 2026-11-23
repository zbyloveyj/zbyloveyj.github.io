#!/usr/bin/env python3
"""Fixture tests for immutable, idempotent source-manifest batches."""
import json
import tempfile
import unittest
from pathlib import Path
from apply_source_additions import apply, apply_all


class SourceAdditionTests(unittest.TestCase):
    def test_add_refresh_and_idempotency_without_rewinding_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.json"
            additions = root / "lab-source-additions-2026-10-26.json"
            manifest.write_text(json.dumps({"schemaVersion": 1, "sources": [
                {"url": "https://example.org/existing", "sourceId": "existing", "verifiedAt": "2026-01-01"}
            ]}))
            additions.write_text(json.dumps({
                "schemaVersion": 1, "verifiedAt": "2026-10-26", "reviewId": "review-1",
                "refresh": [{"url": "https://example.org/existing", "scope": "Reviewed official page."}],
                "sources": [{"url": "https://example.org/new", "sourceId": "new", "verifiedAt": "2026-10-26", "provenance": {"scope": "New official page."}}],
                "editorialReviewLog": {"reviewId": "review-1", "date": "2026-10-26"}
            }))
            first = apply(manifest, additions)
            second = apply(manifest, additions)
            result = json.loads(manifest.read_text())
            self.assertEqual(first["added"], 1)
            self.assertEqual(second["added"], 0)
            self.assertTrue(second["skipped"])
            self.assertEqual(len(result["sources"]), 2)
            self.assertEqual(result["sources"][0]["verifiedAt"], "2026-10-26")
            self.assertEqual(len(result["editorialReviewLog"]), 1)
            result["sources"][0]["verifiedAt"] = "2026-11-23"
            manifest.write_text(json.dumps(result))
            apply(manifest, additions)
            after = json.loads(manifest.read_text())
            self.assertEqual(after["sources"][0]["verifiedAt"], "2026-11-23")

    def test_apply_all_discovers_multiple_immutable_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"schemaVersion": 1, "sources": []}))
            for day, rid in [("2026-10-26", "old"), ("2026-11-23", "new")]:
                (root / f"lab-source-additions-{day}.json").write_text(json.dumps({
                    "schemaVersion": 1, "verifiedAt": day, "reviewId": rid,
                    "sources": [{"url": f"https://example.org/{rid}", "sourceId": rid, "verifiedAt": day}],
                    "editorialReviewLog": {"reviewId": rid, "date": day}
                }))
            results = apply_all(manifest, root)
            data = json.loads(manifest.read_text())
            self.assertEqual([r["reviewId"] for r in results], ["old", "new"])
            self.assertEqual(len(data["sources"]), 2)
            self.assertEqual(len(data["editorialReviewLog"]), 2)


if __name__ == "__main__":
    unittest.main()
