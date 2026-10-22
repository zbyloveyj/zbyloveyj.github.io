"""Thirty distinct, executable lessons. Main path uses only Python's standard library."""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

from . import core
from .providers import answer

TITLES = [
    "任务边界与验收卡", "工具输入契约", "模型与离线基线", "结构化输出校验", "函数调用与错误分支",
    "有界 Agent 循环", "证据卡与来源", "导入与内容哈希", "分块与词项检索", "有引用的 RAG 基线",
    "检索评估", "检查点与恢复", "记忆隔离与过期", "第一个证据助手项目", "依赖图与调度",
    "重试与截止时间", "审批绑定与幂等写入", "MCP stdio 协议", "状态图与框架对照", "研究与审查角色",
    "交付质量门", "合成 CSV 数值分析", "不可信资料与工具边界", "公开测试集评估", "运行轨迹与预算观测",
    "本地 Web 服务", "并发缓存与调用预算", "可复现交付清单", "困难样例与拒答", "毕业项目验收",
]
LIVE_DAYS = {3, 6, 14, 25, 30}


def attempt(name, arguments):
    try:
        return {"ok": True, "result": core.call_tool(name, arguments)}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}


def bounded_int(value, name, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{name} must be an integer from {low} to {high}")
    return value


def checkpoint_demo(config):
    path = core.OUTPUT / "checkpoint.json"
    question = config["question"]
    errors = core.validate_search({"question": question, "top_k": 3})
    if errors:
        raise ValueError("; ".join(errors))
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() and config["resume"] else None
    loaded = bool(isinstance(existing, dict) and existing.get("question") == question and existing.get("corpus_sha256") == core.digest(core.corpus()))
    if loaded:
        checkpoint = existing
    else:
        checkpoint = {"schema_version": 1, "phase": "retrieved", "question": question,
                      "corpus_sha256": core.digest(core.corpus()), "evidence_ids": [r["id"] for r in core.search(question)]}
        core.dump(path, checkpoint)
    # Continue from saved IDs rather than re-running the retrieval node.
    records = [core.call_tool("read_evidence", {"evidence_id": item}) for item in checkpoint["evidence_ids"]]
    state = {"phase": "completed", "question": question, "evidence_ids": checkpoint["evidence_ids"],
             "answer": "\n".join("["+r["id"]+"] "+r["text"] for r in records) if records else "No supporting teaching note.",
             "resumed_from": checkpoint["phase"], "checkpoint_path": "outputs/checkpoint.json"}
    return {"loaded_existing": loaded, "checkpoint": checkpoint, "state": state}


def memory_demo(config):
    ttl = bounded_int(config["ttl_minutes"], "ttl_minutes", 1, 525600)
    elapsed = bounded_int(config["elapsed_minutes"], "elapsed_minutes", 0, 1051200)
    owner, visitor = config["user_id"], config["lookup_user"]
    if not all(isinstance(s, str) and 1 <= len(s) <= 100 for s in (owner, visitor)):
        raise ValueError("user identifiers must be nonempty strings of at most 100 characters")
    base = datetime(2026, 10, 21, tzinfo=timezone.utc)
    now, expires = base + timedelta(minutes=elapsed), base + timedelta(minutes=ttl)
    records = [{"id": "pref-001", "owner": owner, "value": "Prefer one hour of study each day", "expires_at": expires.isoformat()}]
    if config["delete"]:
        records = [r for r in records if r["owner"] != owner]
    core.dump(core.OUTPUT / "memory.json", records)
    def lookup(user):
        return [r for r in records if r["owner"] == user and datetime.fromisoformat(r["expires_at"]) > now]
    return {"owner_visible": lookup(owner), "other_user_visible": lookup(visitor), "expired": now >= expires,
            "deleted": bool(config["delete"]), "memory_path": "outputs/memory.json", "logical_now": now.isoformat(),
            "scope": "Deterministic teaching clock and local JSON; not an authentication service."}


def retry_demo(config):
    failures = bounded_int(config["failures_before_success"], "failures_before_success", 0, 10)
    maximum = bounded_int(config["max_attempts"], "max_attempts", 1, 10)
    delay = bounded_int(config["work_delay_ms"], "work_delay_ms", 0, 200)
    deadline = bounded_int(config["deadline_ms"], "deadline_ms", 1, 500)
    history = []
    for number in range(1, maximum+1):
        try:
            if number <= failures:
                raise OSError("simulated transient read failure")
            history.append({"attempt": number, "ok": True})
            break
        except OSError as exc:
            history.append({"attempt": number, "ok": False, "error": str(exc)})
    success = history[-1]["ok"]
    start = time.perf_counter()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    job = executor.submit(time.sleep, delay/1000)
    try:
        job.result(timeout=deadline/1000)
        deadline_status = "completed"
    except concurrent.futures.TimeoutError:
        deadline_status = "deadline_exceeded"
        job.cancel()
    finally:
        executor.shutdown(wait=False, cancel_futures=True)
    return {"retry": {"attempts": history, "status": "succeeded" if success else "exhausted",
                      "error": None if success else history[-1]["error"]},
            "deadline": {"status": deadline_status, "elapsed_ms": round((time.perf_counter()-start)*1000, 3),
                         "limit_ms": deadline, "cancellation_limit": "A running Python thread is not forcibly killed; timeout stops waiting."}}


def approval_demo(config):
    draft = config["draft_text"]
    if not isinstance(draft, str) or not 1 <= len(draft) <= 20000:
        raise ValueError("draft_text must have 1..20000 characters")
    content = {"path": "outputs/approved_report.txt", "text": draft}
    approval_hash = core.digest(content)
    supplied = config["approved_digest"]
    path = core.OUTPUT / "approved_report.txt"
    if not supplied:
        status = "needs_approval"
    elif supplied != approval_hash:
        status = "approval_mismatch"
    elif path.exists() and path.read_text(encoding="utf-8") == draft:
        status = "already_applied"
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(draft, encoding="utf-8")
        status = "written"
    return {"status": status, "digest": approval_hash, "preview": draft, "path": content["path"],
            "approval_scope": "Hash binds text and fixed target. Copying it is a local teaching approval, not identity authentication."}


def mcp_demo(config):
    errors = core.validate_search(config)
    if errors:
        raise ValueError("; ".join(errors))
    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "lesson-client", "version": "1.0"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "search_evidence", "arguments": config}},
    ]
    process = subprocess.run([sys.executable, "-m", "agentkit.mcp_stdio"], cwd=core.ROOT,
                             input="".join(json.dumps(r)+"\n" for r in requests), text=True, encoding="utf-8",
                             capture_output=True, timeout=5, check=True)
    responses = [json.loads(line) for line in process.stdout.splitlines() if line.strip()]
    if [r.get("id") for r in responses] != [1, 2, 3] or responses[0].get("result", {}).get("protocolVersion") != "2025-06-18":
        raise ValueError("MCP teaching subprocess returned an invalid handshake")
    return {"requests": requests, "responses": responses, "stderr": process.stderr,
            "scope": "Actual stdio JSON-RPC exchange; a four-method teaching subset, not a complete MCP SDK."}


def state_graph_demo(config):
    state = {"question": config["question"], "top_k": config["top_k"]}
    trace = []
    def retrieve(value):
        value["evidence"] = core.search(value["question"], value["top_k"])
    def draft(value):
        records = value["evidence"]
        value["candidate"] = {"status": "answered" if records else "abstained",
                              "answer": "\n".join(r["text"] for r in records) or "No support in the teaching notes.",
                              "citations": [{"evidence_id": r["id"], "quote": r["text"], "source_url": r["source_url"]} for r in records],
                              "uncertainty": "Rule-based excerpts, requiring human review."}
    def check(value):
        value["check"] = core.check_answer(value["candidate"])
    nodes = {"retrieve": retrieve, "draft": draft, "check": check}
    for name in core.topological_order({"retrieve": [], "draft": ["retrieve"], "check": ["draft"]}):
        nodes[name](state)
        trace.append({"node": name, "state_keys": sorted(state)})
    return {"state": state, "node_trace": trace, "engine": "standard-library state graph; optional/langgraph_demo.py uses the real framework"}


def cached_demo(config):
    queries = config["queries"]
    if not isinstance(queries, list) or not 1 <= len(queries) <= 20:
        raise ValueError("queries must be a list with 1..20 items")
    workers = bounded_int(config["max_workers"], "max_workers", 1, 4)
    budget = bounded_int(config["max_calls"], "max_calls", 0, 20)
    for query in queries:
        if core.validate_search({"question": query, "top_k": 3}):
            raise ValueError("each query must be a nonempty string with at most 4000 characters")
    pending, cache, cache_hits, calls = [], {}, 0, 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for query in queries:
            key = core.digest({"question": query, "top_k": 3, "corpus": core.digest(core.corpus())})
            if config["cache"] and key in cache:
                pending.append((query, cache[key], True))
                cache_hits += 1
            elif calls >= budget:
                pending.append((query, None, False))
            else:
                future = pool.submit(core.search, query, 3)
                calls += 1
                pending.append((query, future, False))
                if config["cache"]:
                    cache[key] = future
        results = [{"question": q, "status": "completed" if f is not None else "budget_exhausted",
                    "cache_hit": hit, "evidence_ids": [r["id"] for r in f.result()] if f is not None else []}
                   for q, f, hit in pending]
    return {"results": results, "actual_calls": calls, "cache_hits": cache_hits,
            "budget_exhausted": any(r["status"] == "budget_exhausted" for r in results), "max_workers": workers}


def manifest_demo(config):
    files = []
    for path in sorted(core.ROOT.rglob("*")):
        rel = path.relative_to(core.ROOT)
        if not path.is_file() or any(part.startswith(".") or part in {"outputs", "__pycache__", "node_modules", "venv"} for part in rel.parts):
            continue
        if not config["include_tests"] and rel.parts[0] == "tests":
            continue
        if path.suffix.lower() not in {".py", ".json", ".csv", ".md", ".txt"}:
            continue
        files.append({"path": rel.as_posix(), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    return {"manifest": {"files": files, "sha256": core.digest(files)},
            "instructions": ["Keep Python version, source files and experiments.json together.",
                             "Run python -m unittest discover -s tests -v.", "Run python run.py day 30.",
                             "Outputs, credentials and virtual environments are intentionally excluded from this manifest."]}


def lesson(day, config, provider="offline", model=None, allow_network=False):
    if provider != "offline" and day not in LIVE_DAYS:
        raise ValueError("Live providers are supported only by day 3, 6, 14, 25, 30 or ask")
    def run_answer():
        return answer(config["question"], config.get("top_k", 3), config.get("max_steps", 6), provider, model, allow_network)
    if day == 1:
        goal = config["goal"]
        if not isinstance(goal, str) or not goal.strip():
            raise ValueError("goal must be a nonempty string")
        steps = bounded_int(config["max_steps"], "max_steps", 1, 20)
        result = {"task_card": {"goal": goal, "max_steps": steps,
                              "allowed_actions": [t["name"] for t in core.TOOLS],
                              "stop_conditions": ["goal answered with inspected evidence", "no supporting note", "step budget exhausted"],
                              "deliverable": "A short answer with evidence IDs, exact excerpts and uncertainty."}}
    elif day == 2:
        errors = core.validate_search(config)
        result = {"accepted": not errors, "validation": {"valid": not errors, "errors": errors},
                  "invalid_examples": [{"arguments": a, "errors": core.validate_search(a)} for a in
                                       ({"question": "", "top_k": 3}, {"question": "tool", "top_k": True}, {"question": "tool", "top_k": "3"})]}
    elif day == 3:
        result = {"provider": provider, "answer": run_answer()}
    elif day == 4:
        candidate = core.offline_answer(config["question"])
        candidate = {k: candidate[k] for k in ("status", "answer", "citations", "uncertainty")}
        if config["remove_field"]:
            candidate.pop(config["remove_field"], None)
        result = {"candidate": candidate, "check": core.check_answer(candidate)}
    elif day == 5:
        result = {"valid_call": attempt("search_evidence", {"question": config["question"], "top_k": config["top_k"]}),
                  "invalid_call": attempt("search_evidence", {"question": config["question"], "top_k": config["invalid_top_k"]})}
    elif day in {6, 10}:
        result = {"answer": run_answer()}
    elif day == 7:
        record = core.call_tool("read_evidence", {"evidence_id": config["evidence_id"]})
        result = {"evidence_card": {"evidence_id": record["id"], "claim": config["claim"], "source_url": record["source_url"],
                                   "quote": record["text"], "source_kind": record["kind"], "checked_at": record["checked_at"],
                                   "limitations": "Quote is from an original teaching note. Open the further-reading source and inspect claim support yourself.",
                                   "requires_human_review": True}}
    elif day == 8:
        if not all(isinstance(config[k], str) and config[k].strip() for k in ("record_title", "record_text")):
            raise ValueError("record_title and record_text must be nonempty strings")
        imported = {"id": "E09", "title": config["record_title"], "text": config["record_text"],
                    "source_url": "local:learner-note", "kind": "learner-supplied unverified teaching note"}
        records = core.corpus()
        before = len(records)
        records.append(imported)
        result = {"imported_record": imported, "content_sha256": core.digest(imported), "records_before": before, "records_after": len(records),
                  "persistence": "This run only; original data/evidence.json is not changed."}
    elif day == 9:
        chunks = core.chunk_records(core.corpus(), config["chunk_size"], config["overlap"])
        result = {"chunks": chunks, "retrieved": core.search(config["query"], config["top_k"], chunks), "method": "character chunks + lexical overlap"}
    elif day in {11, 24}:
        result = {"evaluation": core.evaluate(config["split"], config["top_k"])}
    elif day == 12:
        result = checkpoint_demo(config)
    elif day == 13:
        result = memory_demo(config)
    elif day == 14:
        output = run_answer()
        result = {"answer": output, "project_checks": {"answer_contract": core.check_answer(output), "bounded": len(output["trace"]) <= config["max_steps"] * 5,
                                                       "human_review_required": True}}
    elif day == 15:
        graph = {"retrieve": [], "analyze": ["retrieve"], "draft": ["retrieve", "analyze"], "review": ["draft"]}
        if config["force_cycle"]:
            graph["retrieve"] = ["review"]
        try:
            order, error = core.topological_order(graph), None
        except ValueError as exc:
            order, error = [], str(exc)
        result = {"graph": graph, "execution_order": order, "valid": error is None, "error": error}
    elif day == 16:
        result = retry_demo(config)
    elif day == 17:
        result = approval_demo(config)
    elif day == 18:
        result = mcp_demo(config)
    elif day == 19:
        result = state_graph_demo(config)
    elif day == 20:
        research = core.offline_answer(config["question"], config["top_k"])
        critic = core.check_answer(research)
        citation_gate = bool(research["citations"]) if config["require_citations"] else True
        result = {"researcher": research, "critic": critic,
                  "reviewer": {"decision": "ready_for_human_review" if critic["valid"] and citation_gate else "needs_revision",
                               "requires_citations": config["require_citations"], "citation_gate_passed": citation_gate},
                  "mode": "Three deterministic roles with separate responsibilities; not three model agents."}
    elif day == 21:
        report = core.offline_answer(config["question"], config["top_k"])
        if config["remove_citations"]:
            report["citations"] = []
        result = {"report": report, "gate": core.check_answer(report)}
    elif day == 22:
        result = {"analysis": core.analyze_csv(config["column"], config["missing_policy"]), "synthetic_data": True}
    elif day == 23:
        name = config["requested_tool"]
        args = {"search_evidence": {"question": "tool contract", "top_k": 3}, "read_evidence": {"evidence_id": "E03"}, "analyze_csv": {"column": "abundance"}}.get(name, {})
        result = {"untrusted_data": config["untrusted_text"], "tool_result": attempt(name, args),
                  "policy": {"allowed_tools": [t["name"] for t in core.TOOLS], "text_is_data": True,
                             "limitation": "The demonstration does not pass untrusted text to an LLM; this is not a prompt-injection robustness benchmark."}}
    elif day == 25:
        output = run_answer()
        result = {"answer": output, "observability": {"elapsed_ms": output["elapsed_ms"], "usage": output["usage"],
                                                      "trace": output["trace"], "stop_status": output["status"],
                                                      "trace_kind": "tool outcomes and transitions, not hidden chain of thought"}}
    elif day == 26:
        from .web import handle_ask
        request = {"question": config["question"], "top_k": 3}
        result = {"request": request, "response": handle_ask(request), "local_url": "http://127.0.0.1:8765/",
                  "next_command": "python run.py serve --port 8765"}
    elif day == 27:
        result = cached_demo(config)
    elif day == 28:
        result = manifest_demo(config)
    elif day == 29:
        unknown = core.offline_answer(config["question"])
        notes = [{"id": "C01", "text": "The synthetic sample increased."}, {"id": "C02", "text": "The synthetic sample did not increase."}] if config["include_conflict"] else []
        alert = len(notes) > 1 and any("not " in n["text"] for n in notes)
        result = {"unknown_answer": unknown, "conflict_review": {"notes": notes, "needs_human_review": alert,
                                                                "rule": "Negation keyword in a supplied pair; not semantic contradiction detection."},
                  "attack_check": attempt("read_private_file", {"path": "private.env"})}
    elif day == 30:
        output = run_answer()
        evaluation = core.evaluate("test", config["top_k"])
        result = {"answer": output, "evaluation": evaluation,
                  "capability_card": {"supports": ["lexical evidence retrieval", "exact excerpt checks", "fixed CSV analysis", "bounded tools", "local offline web"],
                                      "optional": ["Ollama/OpenAI tool calling", "LangGraph example", "MCP SDK v1 example"],
                                      "limits": ["8 original teaching notes", "16 public evaluation cases", "no semantic/scientific validity guarantee", "no clinical decisions"],
                                      "provider_used": provider, "live_inference_verified_by_this_run": provider != "offline"},
                  "project_checks": {"answer_contract": core.check_answer(output),
                                     "public_eval_passed": all(item["passed"] for item in evaluation["items"]),
                                     "public_case_count": len(evaluation["items"]), "human_review_required": True}}
    else:
        raise ValueError("day must be 1..30")
    return {"day": day, "title": TITLES[day-1], "mode": provider if provider != "offline" else "offline", "result": result}
