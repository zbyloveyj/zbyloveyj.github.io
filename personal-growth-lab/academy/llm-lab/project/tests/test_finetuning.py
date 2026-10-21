import unittest

import torch

from curatemicrobiota.finetuning import (dpo_loss, load_sft_pairs, pack_sft_batch,
                                        response_log_probabilities, response_loss)
from curatemicrobiota.language import GPTConfig, TinyGPT
from curatemicrobiota.lora import inject_lora


class FineTuningContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)

    def test_prompt_padding_mask_and_response_terminator(self):
        pairs = [{"id": "test", "prompt": "Q:A", "response": " Yes."}]
        x, labels, records = pack_sft_batch(pairs, 24)
        record = records[0]
        start, length = record["first_supervised_position"], record["input_length"]
        self.assertEqual(start, 2)
        self.assertTrue(bool((labels[0, :start] == -100).all()))
        self.assertTrue(bool((labels[0, length:] == -100).all()))
        self.assertEqual(int(labels[0, length - 1]), 10)
        self.assertEqual(int((labels != -100).sum()), len(" Yes.\n".encode()))
        logits = torch.randn(1, 24, 256)
        changed = logits.clone()
        changed[labels == -100] += torch.randn_like(changed[labels == -100]) * 100
        self.assertTrue(torch.allclose(response_loss(logits, labels), response_loss(changed, labels)))
        logp, count = response_log_probabilities(logits, labels)
        self.assertAlmostEqual(float(-logp.sum() / count.sum()), float(response_loss(logits, labels)), places=5)

    def test_lora_sft_step_preserves_all_frozen_tensors(self):
        model = TinyGPT(GPTConfig(context=64, width=16, heads=4, layers=1, dropout=0))
        inject_lora(model, rank=2, alpha=4)
        before = {name: p.detach().clone() for name, p in model.named_parameters() if not p.requires_grad}
        x, labels, _ = pack_sft_batch([{"prompt": "Q: Kind?\nA:", "response": " Toy."}], 64)
        optimizer = torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=0.01)
        logits, _ = model(x)
        loss = response_loss(logits, labels)
        loss.backward()
        self.assertGreater(sum(float(p.grad.abs().sum()) for name, p in model.named_parameters()
                               if "lora_b" in name), 0)
        optimizer.step()
        for name, parameter in model.named_parameters():
            if name in before:
                self.assertTrue(torch.equal(before[name], parameter), name)

    def test_dpo_advantage_and_gradient_direction(self):
        chosen = torch.tensor([-2.0], requires_grad=True)
        rejected = torch.tensor([-3.0], requires_grad=True)
        reference_chosen = torch.tensor([-2.0], requires_grad=True)
        reference_rejected = torch.tensor([-3.0], requires_grad=True)
        loss = dpo_loss(chosen, rejected, reference_chosen, reference_rejected, beta=0.5)
        improved = dpo_loss(chosen + 0.2, rejected - 0.2, reference_chosen, reference_rejected, beta=0.5)
        self.assertLess(float(improved.detach()), float(loss.detach()))
        self.assertAlmostEqual(float(loss.detach()), 0.693147, places=5)
        loss.backward()
        self.assertLess(float(chosen.grad), 0)
        self.assertGreater(float(rejected.grad), 0)
        self.assertIsNone(reference_chosen.grad)
        self.assertIsNone(reference_rejected.grad)

    def test_fixed_sft_split_fits_context_and_has_no_repeated_pairs(self):
        split, _ = load_sft_pairs()
        self.assertEqual(len(split["train"]), 10)
        self.assertEqual(len(split["validation"]), 4)
        self.assertFalse({p["prompt"] for p in split["train"]} & {p["prompt"] for p in split["validation"]})
        for name, pairs in split.items():
            x, labels, _ = pack_sft_batch(pairs, 64)
            self.assertEqual(x.shape[0], len(pairs))
            self.assertTrue(bool(((labels != -100).sum(dim=1) > 0).all()), name)


if __name__ == "__main__":
    unittest.main()
