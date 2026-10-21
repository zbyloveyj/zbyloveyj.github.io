"""Contract checks for the actual TinyGPT loopback inference entry point."""
import json
import tempfile
import threading
import unittest
from dataclasses import asdict
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import torch

from curatemicrobiota.language import ByteTokenizer, GPTConfig, TinyGPT
from curatemicrobiota.local_service import LocalEngine, make_server, validate_request
from curatemicrobiota.lora import inject_lora


class LocalServiceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(1)
        torch.manual_seed(17)
        cls.temp = tempfile.TemporaryDirectory()
        cls.config = GPTConfig(context=32, width=8, heads=2, layers=1, dropout=0.0)
        model = TinyGPT(cls.config)
        optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
        # One genuine update, solely a checkpoint fixture, not a competence test.
        x = torch.tensor([ByteTokenizer.encode("Microbes ")])
        _, loss = model(x[:, :-1], x[:, 1:])
        loss.backward()
        optimizer.step()
        cls.path = Path(cls.temp.name) / "model.pt"
        cls.checkpoint = {"format": "curatemicrobiota-tinygpt-v1", "config": asdict(cls.config),
                          "tokenizer": "utf8-bytes-256", "state_dict": model.state_dict()}
        torch.save(cls.checkpoint, cls.path)
        cls.engine = LocalEngine(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_context_uses_utf8_bytes_not_characters(self):
        good = validate_request({"prompt": "菌" * 8, "max_new_tokens": 8}, 32)
        self.assertEqual(len(good["prompt_ids"]), 24)
        with self.assertRaises(ValueError):
            validate_request({"prompt": "菌" * 9, "max_new_tokens": 8}, 32)

    def test_invalid_contract_fields_and_ranges_fail(self):
        cases = [{"prompt": "a", "seed": True}, {"prompt": "a", "max_new_tokens": 0},
                 {"prompt": "a", "temperature": float("nan")}, {"prompt": "a", "timeout_seconds": 0},
                 {"prompt": "a", "top_k": 257}, {"prompt": "a", "stream": "true"},
                 {"prompt": "a", "checkpoint": "elsewhere.pt"}, {"prompt": ""}, ["a"]]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                validate_request(case, 32)

    def test_request_rng_is_reproducible_and_does_not_mutate_global_rng(self):
        request = {"prompt": "Microbes ", "max_new_tokens": 8, "seed": 100}
        rng = torch.get_rng_state().clone()
        first = list(self.engine.events(request))[-1]
        list(self.engine.events({**request, "seed": 7}))
        second = list(self.engine.events(request))[-1]
        self.assertEqual(first["completion_token_ids"], second["completion_token_ids"])
        self.assertTrue(torch.equal(rng, torch.get_rng_state()))
        self.assertFalse(self.engine.model.training)

    def test_generator_does_not_leak_thread_local_inference_mode(self):
        self.assertFalse(torch.is_inference_mode_enabled())
        request = {"prompt": "A ", "max_new_tokens": 3}
        for event in self.engine.events(request):
            self.assertFalse(torch.is_inference_mode_enabled(), event["event"])
        paused = self.engine.events(request)
        next(paused)  # start
        next(paused)  # a token; generator is suspended here
        self.assertFalse(torch.is_inference_mode_enabled())
        paused.close()
        self.assertFalse(torch.is_inference_mode_enabled())
        # A caller that already enabled inference mode keeps its own context.
        with torch.inference_mode():
            for event in self.engine.events(request):
                self.assertTrue(torch.is_inference_mode_enabled(), event["event"])
        self.assertFalse(torch.is_inference_mode_enabled())

    def test_stream_events_reassemble_exact_returned_completion(self):
        events = list(self.engine.events({"prompt": "A ", "max_new_tokens": 8}))
        self.assertEqual(events[0]["event"], "start")
        self.assertEqual(events[-1]["event"], "done")
        tokens = [e for e in events if e["event"] == "token"]
        final = events[-1]
        text = "".join(e["text_delta"] for e in tokens) + final["final_text_delta"]
        self.assertEqual(text, final["completion"])
        self.assertEqual(text, ByteTokenizer.decode(final["completion_token_ids"]))
        self.assertEqual(final["completion_tokens"], len(tokens))
        self.assertEqual(final["finish_reason"], "length")
        self.assertEqual({e["request_id"] for e in events}, {final["request_id"]})

    def test_deadline_is_an_explicit_terminal_state(self):
        events = list(self.engine.events({"prompt": "A ", "max_new_tokens": 8, "timeout_seconds": 1e-12}))
        self.assertEqual(events[-1]["finish_reason"], "deadline")
        self.assertEqual(events[-1]["completion_tokens"], 0)
        self.assertIsNone(events[-1]["metrics"]["engine_ttft_seconds"])
        self.assertIsNone(events[-1]["metrics"]["engine_tpot_seconds"])

    def test_reject_wrong_tokenizer_and_wrong_checkpoint(self):
        path = Path(self.temp.name) / "bad.pt"
        for field, value in [("tokenizer", "some-other-vocab"), ("format", "adapter-only")]:
            torch.save({**self.checkpoint, field: value}, path)
            with self.assertRaises(ValueError):
                LocalEngine(path)

    def test_project_full_lora_checkpoint_is_supported(self):
        model = TinyGPT(self.config)
        model.load_state_dict(self.checkpoint["state_dict"])
        config = {"rank": 2, "alpha": 4.0, "target_names": ["qkv"]}
        inject_lora(model, **config)
        path = Path(self.temp.name) / "lora.pt"
        torch.save({**self.checkpoint, "state_dict": model.state_dict(), "lora": config}, path)
        adapter_engine = LocalEngine(path)
        request = {"prompt": "A ", "max_new_tokens": 4, "top_k": 1}
        self.assertEqual(list(adapter_engine.events(request))[-1]["completion_token_ids"],
                         list(self.engine.events(request))[-1]["completion_token_ids"])

    def test_real_http_json_stream_and_invalid_request(self):
        try:
            server = make_server(self.engine, 0)
        except PermissionError:
            self.skipTest("The execution sandbox forbids sockets; run this actual HTTP contract test in GitHub CI or locally.")
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        origin = f"http://127.0.0.1:{server.server_port}"
        try:
            with urlopen(origin + "/health", timeout=5) as response:
                self.assertEqual(json.load(response)["status"], "ready")
            for stream in [False, True]:
                payload = {"prompt": "A ", "max_new_tokens": 3, "stream": stream}
                request = Request(origin + "/generate", data=json.dumps(payload).encode(),
                                  headers={"Content-Type": "application/json"})
                with urlopen(request, timeout=5) as response:
                    final = [json.loads(line) for line in response][-1] if stream else json.load(response)
                    self.assertEqual(final["completion_tokens"], 3)
                    self.assertEqual(final["event"], "done")
            request = Request(origin + "/generate", data=b'{"prompt":"x","seed":true}',
                              headers={"Content-Type": "application/json"})
            with self.assertRaises(HTTPError) as caught:
                urlopen(request, timeout=5)
            self.assertEqual(caught.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
