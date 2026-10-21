"""Checks for provenance and refusal behavior of the offline retrieval module."""
import unittest
from curatemicrobiota.evidence import load_cards, retrieve, validate_citations, build_prompt


class EvidenceTests(unittest.TestCase):
    def test_no_query_is_not_evidence(self):
        self.assertEqual(retrieve("", load_cards()), [])

    def test_retrieves_primary_source(self):
        docs = retrieve("LoRA 冻结 低秩", load_cards())
        self.assertTrue(docs)
        self.assertEqual(docs[0]["id"], "SRC-LORA")
        self.assertTrue(all(d["url"].startswith("https://") for d in docs))

    def test_unknown_citation_rejected_without_claiming_semantic_support(self):
        docs = retrieve("LoRA", load_cards())
        good = validate_citations("低秩更新 [SRC-LORA]", docs)
        self.assertTrue(good["all_ids_in_retrieved_context"])
        self.assertFalse(good["semantic_support_checked"])
        bad = validate_citations("不存在的证据 [SRC-FAKE]", docs)
        self.assertFalse(bad["all_ids_in_retrieved_context"])
        self.assertEqual(bad["unknown"], ["SRC-FAKE"])

    def test_prompt_preserves_provenance_and_corpus_status(self):
        docs = retrieve("跨队列 数据泄漏", load_cards())
        prompt = build_prompt("跨队列 数据泄漏", docs)
        self.assertIn("不是论文全文", prompt)
        self.assertIn(docs[0]["url"], prompt)


if __name__ == "__main__":
    unittest.main()
