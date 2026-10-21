import tempfile
import unittest
from pathlib import Path

from curatemicrobiota.advanced import ByteBPE, merge_pair, memory_budget, resume_experiment


class AdvancedLabTests(unittest.TestCase):
    def test_unicode_roundtrip_and_serialized_merges(self):
        tokenizer = ByteBPE.train(["微生物微生物 🧬", "train train brain brain"], 280)
        text = "未见过的菌群 café\n🧬 𠮷"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tokenizer.json"
            tokenizer.save(path)
            loaded = ByteBPE.load(path)
            self.assertEqual(loaded.encode(text), tokenizer.encode(text))
            self.assertEqual(loaded.decode(loaded.encode(text)), text)

    def test_bpe_does_not_merge_across_documents_or_fit_on_encoding(self):
        tokenizer = ByteBPE.train(["a", "b", "a", "b"], 300)
        self.assertEqual(tokenizer.merges, [])
        trained = ByteBPE.train(["ab ab ab", "cd cd cd"], 270)
        original = list(trained.merges)
        trained.encode("zzzzzzzzzzzzzz")
        self.assertEqual(trained.merges, original)
        self.assertEqual(original, ByteBPE.train(["ab ab ab", "cd cd cd"], 270).merges)

    def test_overlapping_pair_is_replaced_nonoverlapping(self):
        self.assertEqual(merge_pair([97] * 5, (97, 97), 256), [256, 256, 97])

    def test_resume_recovers_stochastic_optimizer_trajectory(self):
        with tempfile.TemporaryDirectory() as directory:
            report = resume_experiment(directory, steps=6, interrupt_at=2)
        self.assertTrue(report["loss_sequences_exactly_equal"])
        self.assertTrue(report["parameters_exactly_equal"])
        self.assertTrue(report["learning_rate_equal"])

    def test_kv_cache_tracks_keys_values_heads_batch_and_length(self):
        args = dict(parameters=7_000_000_000, layers=32, kv_heads=8,
                    head_dim=128, context=8192, batch=1)
        report = memory_budget(**args)
        self.assertEqual(report["kv_cache_bytes"], 2**30)
        self.assertEqual(memory_budget(**{**args, "batch": 2})["kv_cache_bytes"], 2**31)
        self.assertEqual(memory_budget(**{**args, "kv_heads": 32})["kv_cache_bytes"], 4 * 2**30)
        with self.assertRaises(ValueError):
            memory_budget(**{**args, "context": 0})


if __name__ == "__main__":
    unittest.main()
