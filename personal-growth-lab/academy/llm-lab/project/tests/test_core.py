"""Scientific invariants that catch errors a successful training loop can hide."""
import tempfile
import unittest

import numpy as np
import torch

from curatemicrobiota.data import Preprocessor, align_abundance, load_cohort, make_demo, validate_split
from curatemicrobiota.evaluation import aggregate_subjects
from curatemicrobiota.language import ByteTokenizer, GPTConfig, TinyGPT, sample_batch
from curatemicrobiota.lora import LoRALinear, inject_lora
from curatemicrobiota.microbiome import MaskedMicrobiomeEncoder, MicrobiomeConfig, make_mask, masked_mse


class ModelContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_byte_tokenizer_roundtrip(self):
        text = "Microbes 微生物 α-diversity 🧬"
        self.assertEqual(ByteTokenizer.decode(ByteTokenizer.encode(text)), text)

    def test_next_token_shift(self):
        data = torch.arange(100)
        x, y = sample_batch(data, 4, 12, torch.Generator().manual_seed(1))
        self.assertTrue(torch.equal(y, x + 1))

    def test_future_tokens_do_not_change_past_logits(self):
        model = TinyGPT(GPTConfig(context=12, width=16, heads=4, layers=2, dropout=0)).eval()
        x = torch.randint(0, 256, (2, 12))
        changed = x.clone()
        changed[:, 6:] = (changed[:, 6:] + 7) % 256
        a, _ = model(x)
        b, _ = model(changed)
        self.assertTrue(torch.allclose(a[:, :6], b[:, :6], atol=1e-6))

    def test_masked_loss_ignores_visible_entries_and_has_gradients(self):
        prediction = torch.tensor([[1., 100., 2.]], requires_grad=True)
        target = torch.tensor([[0., -999., 0.]])
        mask = torch.tensor([[True, False, True]])
        loss = masked_mse(prediction, target, mask)
        self.assertAlmostEqual(float(loss.detach()), 2.5)
        loss.backward()
        self.assertEqual(float(prediction.grad[0, 1]), 0.0)
        self.assertGreater(float(prediction.grad[0, 0]), 0)

    def test_masked_values_cannot_enter_encoder(self):
        model = MaskedMicrobiomeEncoder(MicrobiomeConfig(taxa=8, width=16, heads=4, layers=1, dropout=0)).eval()
        x = torch.randn(3, 8)
        mask = make_mask(3, 8, generator=torch.Generator().manual_seed(2))
        changed = x.clone()
        changed[mask] += 1000
        a, _ = model(x, mask)
        b, _ = model(changed, mask)
        self.assertTrue(torch.allclose(a, b, atol=1e-6))

    def test_encoder_is_equivariant_to_joint_taxon_value_permutation(self):
        model = MaskedMicrobiomeEncoder(MicrobiomeConfig(taxa=8, width=16, heads=4, layers=1, dropout=0)).eval()
        values = torch.randn(2, 8)
        perm = torch.tensor([5, 2, 7, 0, 1, 6, 4, 3])
        original, pool_a = model(values)
        changed, pool_b = model(values[:, perm], taxon_ids=perm)
        self.assertTrue(torch.allclose(original[:, perm], changed, atol=1e-6))
        self.assertTrue(torch.allclose(pool_a, pool_b, atol=1e-6))

    def test_masks_hide_at_least_two_and_leave_context(self):
        mask = make_mask(10, 8, rate=0.01)
        self.assertTrue(bool((mask.sum(dim=1) == 2).all()))
        self.assertFalse(bool(mask.all(dim=1).any()))

    def test_lora_initial_identity_and_frozen_base(self):
        base = torch.nn.Linear(8, 4)
        x = torch.randn(10, 8)
        expected = base(x).detach().clone()
        model = LoRALinear(base, rank=2)
        before = base.weight.detach().clone()
        self.assertTrue(torch.equal(expected, model(x)))
        optimizer = torch.optim.SGD([p for p in model.parameters() if p.requires_grad], lr=0.05)
        model(x).square().mean().backward()
        self.assertIsNone(base.weight.grad)
        self.assertGreater(float(model.lora_b.grad.abs().sum()), 0)
        optimizer.step()
        self.assertTrue(torch.equal(before, base.weight))

    def test_gpt_lora_targets_only_adapters(self):
        model = TinyGPT(GPTConfig(context=8, width=16, heads=4, layers=1))
        names = inject_lora(model)
        self.assertEqual(names, ["blocks.0.attention.qkv"])
        trainable_names = [name for name, p in model.named_parameters() if p.requires_grad]
        self.assertEqual(len(trainable_names), 2)
        self.assertTrue(all("lora_" in name for name in trainable_names))


class DataContracts(unittest.TestCase):
    def test_study_and_subject_separation(self):
        metadata = [{"study": "a", "subject_id": "same"}, {"study": "b", "subject_id": "same"},
                    {"study": "c", "subject_id": "third"}]
        with self.assertRaisesRegex(ValueError, "Subject leakage"):
            validate_split(metadata, {"train": ["a"], "val": ["b"], "test": ["c"]})

    def test_vocabulary_alignment_not_column_position(self):
        x = np.array([[0.1, 0.2, 0.3, 0.4]])
        aligned, report = align_abundance(x, ["a", "b", "c", "novel"], ["c", "a", "b"])
        np.testing.assert_allclose(aligned, [[0.3, 0.1, 0.2]])
        self.assertEqual(report["excluded_input_taxa"], ["novel"])
        with self.assertRaisesRegex(ValueError, "Missing"):
            align_abundance(x, ["a", "b", "c", "novel"], ["a", "not_measured"])

    def test_preprocessor_statistics_stay_training_only(self):
        train = np.array([[0.2, 0.3, 0.5], [0.3, 0.3, 0.4]])
        preprocessor = Preprocessor.fit(train, ["a", "b", "c"])
        before_mean, before_scale = preprocessor.mean.copy(), preprocessor.scale.copy()
        preprocessor.transform(np.array([[0.99, 0.005, 0.005]]), ["a", "b", "c"])
        self.assertEqual(preprocessor.mean, before_mean)
        self.assertEqual(preprocessor.scale, before_scale)

    def test_fixture_alignment_and_subject_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            make_demo(directory)
            cohort = load_cohort(directory)
            self.assertEqual(cohort.values.shape, (240, 48))
            split = cohort.indices()
            self.assertEqual([len(split[k]) for k in ["train", "val", "test"]], [160, 40, 40])
            self.assertEqual(len({r["subject_id"] for r in cohort.metadata}), 120)

    def test_subject_aggregation_does_not_count_visits_as_people(self):
        metadata = [{"subject_id": "a", "label": "0"}, {"subject_id": "a", "label": "0"},
                    {"subject_id": "b", "label": "1"}]
        subjects, labels, probabilities = aggregate_subjects(metadata, [0, 1, 2], [0.1, 0.3, 0.9])
        self.assertEqual(subjects, ["a", "b"])
        np.testing.assert_allclose(probabilities, [0.2, 0.9])
        np.testing.assert_array_equal(labels, [0, 1])


if __name__ == "__main__":
    unittest.main()
