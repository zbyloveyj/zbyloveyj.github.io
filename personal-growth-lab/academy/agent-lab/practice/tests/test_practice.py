import copy
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

from agentkit import core, lessons, providers
from agentkit.web import make_server

CONFIG = json.loads((core.ROOT / "experiments.json").read_text(encoding="utf-8"))


class CourseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.output = patch.object(core, "OUTPUT", Path(self.folder.name))
        self.output.start()

    def tearDown(self):
        self.output.stop()
        self.folder.cleanup()

    def run_day(self, day, **overrides):
        config = {**CONFIG[f"day{day:02d}"], **overrides}
        return lessons.lesson(day, config)["result"]

    def test_all_thirty_lessons_have_distinct_dispatch_and_contract(self):
        titles, keys = set(), set()
        for day in range(1, 31):
            with self.subTest(day=day):
                record = lessons.lesson(day, copy.deepcopy(CONFIG[f"day{day:02d}"]))
                self.assertEqual(record["day"], day)
                self.assertEqual(record["mode"], "offline")
                self.assertTrue(record["result"])
                titles.add(record["title"])
                keys.add(tuple(sorted(record["result"])))
        self.assertEqual(len(titles), 30)
        self.assertGreater(len(keys), 24)

    def test_tool_boundary_rejects_bool_string_extra_and_missing(self):
        for args in ({"question":"tool","top_k":True}, {"question":"tool","top_k":"3"},
                     {"question":"tool","top_k":0}, {"question":"tool","top_k":3,"path":"private"},
                     {"question":"tool"}, {"question":"","top_k":3}):
            with self.subTest(args=args):
                self.assertTrue(core.validate_search(args))
                with self.assertRaises(ValueError):
                    core.call_tool("search_evidence", args)
        self.assertTrue(core.call_tool("search_evidence", {"question":"tool","top_k":1}))

    def test_structured_output_missing_field_and_fabricated_quote_fail(self):
        invalid = self.run_day(4, remove_field="uncertainty")
        self.assertFalse(invalid["check"]["valid"])
        original = self.run_day(4)["candidate"]
        original["citations"][0]["quote"] = "A fabricated statement absent from the note."
        self.assertFalse(core.check_answer(original)["valid"])

    def test_unknown_question_abstains_and_step_budget_stops(self):
        unknown = core.offline_answer("zxqv nebula recipe")
        self.assertEqual(unknown["status"], "abstained")
        self.assertEqual(unknown["citations"], [])
        bounded = self.run_day(6, max_steps=1)["answer"]
        self.assertEqual(bounded["status"], "budget_exhausted")
        self.assertEqual(len(bounded["trace"]), 1)

    def test_import_hash_binds_title_and_text_without_mutating_corpus(self):
        before = (core.ROOT / "data/evidence.json").read_bytes()
        base = self.run_day(8)
        changed_title = self.run_day(8, record_title="Changed title")
        changed_text = self.run_day(8, record_text="Changed evidence text")
        self.assertEqual(base["content_sha256"], core.digest(base["imported_record"]))
        self.assertNotEqual(base["content_sha256"], changed_title["content_sha256"])
        self.assertNotEqual(base["content_sha256"], changed_text["content_sha256"])
        self.assertEqual((core.ROOT / "data/evidence.json").read_bytes(), before)

    def test_chunk_overlap_and_bounds_are_real(self):
        r = [{"id":"X", "title":"", "text":"0123456789"*5, "source_url":"local:x"}]
        chunks = core.chunk_records(r, 20, 5)
        self.assertEqual([c["offset"] for c in chunks], [0,15,30])
        self.assertEqual(chunks[0]["text"][-5:], chunks[1]["text"][:5])
        with self.assertRaises(ValueError):
            core.chunk_records(r, 20, 20)

    def test_evaluation_uses_same_top_k_and_separate_public_splits(self):
        one, three = core.evaluate("dev", 1), core.evaluate("dev", 3)
        self.assertLess(one["retrieval_recall"], three["retrieval_recall"])
        self.assertLess(one["answerable_accuracy"], three["answerable_accuracy"])
        self.assertTrue(all(len(item["retrieved"]) <= 1 for item in one["items"]))
        test = core.evaluate("test", 3)
        self.assertFalse({i["id"] for i in test["items"]} & {i["id"] for i in three["items"]})

    def test_checkpoint_reuses_only_matching_question_and_corpus(self):
        self.assertFalse(self.run_day(12)["loaded_existing"])
        self.assertTrue(self.run_day(12)["loaded_existing"])
        self.assertFalse(self.run_day(12, question="relative abundance")["loaded_existing"])
        self.assertFalse(self.run_day(12, resume=False)["loaded_existing"])

    def test_memory_isolation_expiration_boundary_and_delete(self):
        value = self.run_day(13)
        self.assertEqual(len(value["owner_visible"]), 1)
        self.assertEqual(value["other_user_visible"], [])
        expired = self.run_day(13, elapsed_minutes=60)
        self.assertTrue(expired["expired"])
        self.assertEqual(expired["owner_visible"], [])
        deleted = self.run_day(13, delete=True)
        self.assertTrue(deleted["deleted"])
        self.assertEqual(json.loads((core.OUTPUT / "memory.json").read_text()), [])

    def test_dag_rejects_cycle(self):
        value = self.run_day(15)
        self.assertTrue(value["valid"])
        self.assertLess(value["execution_order"].index("retrieve"), value["execution_order"].index("draft"))
        self.assertFalse(self.run_day(15, force_cycle=True)["valid"])

    def test_retry_budget_and_timeout_are_effective(self):
        value = self.run_day(16)
        self.assertEqual(value["retry"]["status"], "succeeded")
        self.assertEqual(len(value["retry"]["attempts"]), 3)
        failed = self.run_day(16, max_attempts=1, work_delay_ms=100, deadline_ms=1)
        self.assertEqual(failed["retry"]["status"], "exhausted")
        self.assertEqual(failed["deadline"]["status"], "deadline_exceeded")

    def test_approval_hash_prevents_stale_approval_and_repeated_write(self):
        proposed = self.run_day(17)
        path = core.OUTPUT / "approved_report.txt"
        self.assertEqual(proposed["status"], "needs_approval")
        self.assertFalse(path.exists())
        wrong = self.run_day(17, approved_digest=proposed["digest"], draft_text="Changed draft")
        self.assertEqual(wrong["status"], "approval_mismatch")
        self.assertFalse(path.exists())
        self.assertEqual(self.run_day(17, approved_digest=proposed["digest"])["status"], "written")
        stamp = path.stat().st_mtime_ns
        self.assertEqual(self.run_day(17, approved_digest=proposed["digest"])["status"], "already_applied")
        self.assertEqual(path.stat().st_mtime_ns, stamp)

    def test_actual_mcp_subprocess_handshake_list_and_call(self):
        value = self.run_day(18)
        self.assertEqual(len(value["requests"]), 4)
        self.assertEqual([r["id"] for r in value["responses"]], [1,2,3])
        self.assertFalse(value["responses"][-1]["result"]["isError"])
        found = json.loads(value["responses"][-1]["result"]["content"][0]["text"])
        self.assertLessEqual(len(found), CONFIG["day18"]["top_k"])

    def test_mcp_requires_handshake_and_malformed_json_does_not_reuse_id(self):
        request = {"jsonrpc":"2.0", "id":8, "method":"tools/list"}
        p = subprocess.run([sys.executable,"-m","agentkit.mcp_stdio"], input=json.dumps(request)+"\n{broken\n",
                           cwd=core.ROOT, text=True, capture_output=True, timeout=5, check=True)
        first, second = [json.loads(line) for line in p.stdout.splitlines()]
        self.assertIn("error", first)
        self.assertIsNone(second["id"])

    def test_quality_gate_and_allowlist_reject_unsafe_actions(self):
        self.assertTrue(self.run_day(21)["gate"]["valid"])
        self.assertFalse(self.run_day(21, remove_citations=True)["gate"]["valid"])
        denied = self.run_day(23, requested_tool="run_shell")
        self.assertFalse(denied["tool_result"]["ok"])

    def test_csv_missing_policy_and_denominator(self):
        result = core.analyze_csv()
        self.assertEqual((result["rows_total"],result["rows_valid"],result["rows_missing"]), (9,6,3))
        self.assertAlmostEqual(result["mean"], (0.12+0.15+0.22+0.25+0.20+0.30)/6)
        with self.assertRaises(ValueError):
            core.analyze_csv(missing_policy="error")
        self.assertEqual(core.analyze_csv("age")["rows_valid"], 9)

    def test_cache_deduplicates_and_budget_blocks_new_work(self):
        cached = self.run_day(27)
        self.assertEqual((cached["actual_calls"],cached["cache_hits"]),(2,1))
        uncached = self.run_day(27, cache=False)
        self.assertEqual((uncached["actual_calls"],uncached["cache_hits"]),(3,0))
        limited = self.run_day(27, max_calls=1)
        self.assertTrue(limited["budget_exhausted"])
        self.assertEqual(limited["actual_calls"],1)
        self.assertEqual(limited["results"][1]["status"],"completed")
        self.assertEqual(limited["results"][2]["status"],"budget_exhausted")

    def test_manifest_excludes_generated_and_secret_files(self):
        result = self.run_day(28)["manifest"]
        paths = [f["path"] for f in result["files"]]
        self.assertIn("run.py",paths)
        self.assertFalse(any("outputs/" in p or ".env" in p or "__pycache__" in p for p in paths))
        no_tests = self.run_day(28, include_tests=False)["manifest"]
        self.assertFalse(any(f["path"].startswith("tests/") for f in no_tests["files"]))
        self.assertNotEqual(no_tests["sha256"], result["sha256"])


class ProviderProtocolTests(unittest.TestCase):
    def final(self):
        note = core.corpus()[2]
        return {"status":"answered", "answer":note["text"], "citations":[{"evidence_id":note["id"], "quote":note["text"], "source_url":note["source_url"]}], "uncertainty":"Teaching note only"}

    def test_live_access_requires_explicit_network_and_model(self):
        with patch.object(providers,"post_json") as sender:
            with self.assertRaisesRegex(ValueError,"allow-network"):
                providers.answer("tool contract", provider="ollama", model="test")
            sender.assert_not_called()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError,"OPENAI_API_KEY"):
                providers.answer("tool contract",provider="openai",model="test",allow_network=True)

    def test_ollama_tool_response_round_trip(self):
        calls = []
        def sender(url,payload,headers=None):
            calls.append(copy.deepcopy(payload))
            if len(calls)==1:
                return {"message":{"role":"assistant","content":"", "tool_calls":[{"function":{"name":"search_evidence","arguments":{"question":"tool contract","top_k":2}}}]}, "prompt_eval_count":10,"eval_count":5}
            return {"message":{"role":"assistant","content":json.dumps(self.final())},"prompt_eval_count":20,"eval_count":10}
        with patch.object(providers,"post_json",side_effect=sender):
            result = providers.answer("tool contract",provider="ollama",model="fixture",allow_network=True)
        self.assertEqual(result["status"],"answered")
        self.assertEqual(calls[1]["messages"][-1]["role"],"tool")
        self.assertEqual(calls[1]["messages"][-1]["tool_name"],"search_evidence")
        self.assertEqual(result["usage"]["input_tokens"],30)
        self.assertIsNone(result["usage"]["cost_usd"])

    def test_responses_preserves_reasoning_and_call_id_across_turns(self):
        calls = []
        def sender(url,payload,headers=None):
            calls.append(copy.deepcopy(payload))
            if len(calls)==1:
                return {"output":[{"type":"reasoning","id":"r1","summary":[],"encrypted_content":"fixture"},
                                  {"type":"function_call","name":"search_evidence","call_id":"c1","arguments":json.dumps({"question":"tool contract","top_k":2})}],"usage":{"input_tokens":12,"output_tokens":4}}
            return {"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":json.dumps(self.final())}]}],"usage":{"input_tokens":18,"output_tokens":8}}
        with patch.dict(os.environ,{"OPENAI_API_KEY":"unit-test-placeholder"}), patch.object(providers,"post_json",side_effect=sender):
            result = providers.answer("tool contract",provider="openai",model="fixture",allow_network=True)
        self.assertTrue(result["check"]["valid"])
        self.assertFalse(calls[0]["store"])
        self.assertTrue(any(item.get("type")=="reasoning" for item in calls[1]["input"]))
        self.assertTrue(any(item.get("type")=="function_call_output" and item["call_id"]=="c1" for item in calls[1]["input"]))
        self.assertEqual(result["usage"]["output_tokens"],12)

    def test_model_loop_budget_and_endpoint_failure_do_not_fallback(self):
        response = {"message":{"role":"assistant","content":"", "tool_calls":[{"function":{"name":"search_evidence","arguments":{"question":"tool","top_k":1}}}]}}
        with patch.object(providers,"post_json",return_value=response) as sender:
            result = providers.answer("tool",max_steps=2,provider="ollama",model="fixture",allow_network=True)
            self.assertEqual(sender.call_count,2)
            self.assertEqual(result["status"],"budget_exhausted")
            self.assertEqual(result["provider"],"ollama")
        with patch.object(providers,"post_json",side_effect=RuntimeError("endpoint failed")):
            with self.assertRaisesRegex(RuntimeError,"endpoint failed"):
                providers.answer("tool",provider="ollama",model="fixture",allow_network=True)


class WebIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = make_server(0)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self,method,path,body=None,headers=None):
        connection=http.client.HTTPConnection("127.0.0.1",self.port,timeout=5)
        connection.request(method,path,body,headers or {})
        response=connection.getresponse()
        data=response.read()
        connection.close()
        return response.status,data

    def test_loopback_health_and_actual_question(self):
        status,data=self.request("GET","/health")
        self.assertEqual(status,200)
        self.assertEqual(json.loads(data)["provider"],"offline")
        status,data=self.request("POST","/api/ask",json.dumps({"question":"tool contract","top_k":2}),{"Content-Type":"application/json"})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(data)["status"],"answered")

    def test_cross_origin_bad_host_and_invalid_input_rejected(self):
        data=json.dumps({"question":"tool","top_k":1})
        self.assertEqual(self.request("POST","/api/ask",data,{"Content-Type":"application/json","Origin":"https://foreign.example"})[0],403)
        self.assertEqual(self.request("GET","/health",headers={"Host":"foreign.example"})[0],403)
        self.assertEqual(self.request("POST","/api/ask",json.dumps({"question":"tool","top_k":True}),{"Content-Type":"application/json"})[0],400)
        self.assertEqual(self.request("POST","/api/ask",data,{"Content-Type":"text/plain"})[0],415)


if __name__ == "__main__":
    unittest.main()
