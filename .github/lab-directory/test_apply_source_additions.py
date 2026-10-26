#!/usr/bin/env python3
"""Small fixture test for idempotent source-manifest additions."""
import json
import tempfile
import unittest
from pathlib import Path
from apply_source_additions import apply


class SourceAdditionTests(unittest.TestCase):
    def test_add_refresh_and_idempotency(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.json"
            additions = root / "additions.json"
            manifest.write_text(json.dumps({"schemaVersion": 1, "sources": [
                {"url": "https://example.org/existing", "sourceId": "existing", "verifiedAt": "2026-01-01"}
            ]}))
            additions.write_text(json.dumps({
                "schemaVersion": 1, "verifiedAt": "2026-10-26",
                "refresh": [{"url": "https://example.org/existing", "scope": "Reviewed official page."}],
                "sources": [{"url": "https://example.org/new", "sourceId": "new", "verifiedAt": "2026-10-26", "provenance": {"scope": "New official page."}}],
                "editorialReviewLog": {"reviewId": "review-1", "date": "2026-10-26"}
            }))
            first = apply(manifest, additions)
            second = apply(manifest, additions)
            result = json.loads(manifest.read_text())
            self.assertEqual(first["added"], 1)
            self.assertEqual(second["added"], 0)
            self.assertEqual(len(result["sources"]), 2)
            self.assertEqual(result["sources"][0]["verifiedAt"], "2026-10-26")
            self.assertEqual(len(result["editorialReviewLog"]), 1)


if __name__ == "__main__":
    unittest.main()
