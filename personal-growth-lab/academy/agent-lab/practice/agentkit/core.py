from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
STOP = set("a an the is are to of and or in on for what why how does do can with from this that it be as i my by which".split())


def dump(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def corpus():
    return json.loads((ROOT / "data/evidence.json").read_text(encoding="utf-8"))


def words(text):
    text = str(text).lower()
    english = re.findall(r"[a-z0-9_]+", text)
    chinese = re.findall(r"[\u4e00-\u9fff]", text)
    return set(x for x in english if x not in STOP) | {"".join(chinese[i:i+2]) for i in range(len(chinese)-1)}


def validate_search(args):
    errors = []
    if not isinstance(args, dict):
        return ["arguments must be a JSON object"]
    if set(args) - {"question", "top_k"}:
        errors.append("unexpected fields: " + ", ".join(sorted(set(args)-{"question", "top_k"})))
    if not isinstance(args.get("question"), str) or not args["question"].strip():
        errors.append("question must be a nonempty string")
    if isinstance(args.get("question"), str) and len(args["question"]) > 4000:
        errors.append("question exceeds 4000 characters")
    k = args.get("top_k")
    if type(k) is not int or not 1 <= k <= 5:
        errors.append("top_k must be an integer from 1 to 5; bool and strings are rejected")
    return errors


def search(question, top_k=3, records=None):
    errors = validate_search({"question": question, "top_k": top_k})
    if errors:
        raise ValueError("; ".join(errors))
    terms = words(question)
    results = []
    for record in corpus() if records is None else records:
        haystack = words(record.get("title", "") + " " + record["text"])
        hits = terms & haystack
        if hits:
            score = len(hits) / math.sqrt(max(1, len(haystack)))
            results.append({**record, "score": round(score, 6), "matched_terms": sorted(hits)})
    return sorted(results, key=lambda r: (-r["score"], r["id"]))[:top_k]


def chunk_records(records, chunk_size=80, overlap=16):
    if type(chunk_size) is not int or not 20 <= chunk_size <= 1000:
        raise ValueError("chunk_size must be 20..1000 characters")
    if type(overlap) is not int or not 0 <= overlap < chunk_size:
        raise ValueError("overlap must be nonnegative and smaller than chunk_size")
    output = []
    for record in records:
        for offset in range(0, len(record["text"]), chunk_size-overlap):
            output.append({**record, "parent_id": record["id"], "id": record["id"] + ":" + str(offset),
                           "text": record["text"][offset:offset+chunk_size], "offset": offset})
            if offset + chunk_size >= len(record["text"]):
                break
    return output


def analyze_csv(column="abundance", missing_policy="exclude"):
    if column not in {"age", "abundance", "score"}:
        raise ValueError("column must be age, abundance or score")
    if missing_policy not in {"exclude", "error"}:
        raise ValueError("missing_policy must be exclude or error")
    with (ROOT / "data/participants.csv").open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    values, invalid = [], []
    for i, row in enumerate(rows, 2):
        try:
            value = float(row[column])
            if not math.isfinite(value):
                raise ValueError("nonfinite")
            values.append(value)
        except (ValueError, KeyError):
            invalid.append(i)
    if invalid and missing_policy == "error":
        raise ValueError("missing/invalid numeric values at CSV lines " + str(invalid))
    return {"rows_total": len(rows), "rows_valid": len(values), "rows_missing": len(invalid),
            "invalid_lines": invalid, "column": column, "missing_policy": missing_policy,
            "mean": sum(values)/len(values) if values else None,
            "min": min(values) if values else None, "max": max(values) if values else None,
            "data_kind": "fictional teaching data; not clinical observations"}


TOOLS = [
    {"name": "search_evidence", "description": "Search the supplied teaching notes using lexical overlap.",
     "parameters": {"type": "object", "properties": {"question": {"type": "string"}, "top_k": {"type": "integer", "minimum": 1, "maximum": 5}}, "required": ["question", "top_k"], "additionalProperties": False}},
    {"name": "read_evidence", "description": "Read a known evidence note by its E01..E08 identifier.",
     "parameters": {"type": "object", "properties": {"evidence_id": {"type": "string"}}, "required": ["evidence_id"], "additionalProperties": False}},
    {"name": "analyze_csv", "description": "Compute descriptive values for the fixed fictional CSV.",
     "parameters": {"type": "object", "properties": {"column": {"type": "string", "enum": ["age", "abundance", "score"]}}, "required": ["column"], "additionalProperties": False}},
]


def call_tool(name, args):
    if not isinstance(args, dict):
        raise ValueError("tool arguments must be an object")
    if name == "search_evidence":
        errors = validate_search(args)
        if errors:
            raise ValueError("; ".join(errors))
        return search(args["question"], args.get("top_k", 3))
    if name == "read_evidence":
        if set(args) != {"evidence_id"} or not isinstance(args["evidence_id"], str):
            raise ValueError("read_evidence accepts only evidence_id")
        found = next((r for r in corpus() if r["id"] == args["evidence_id"]), None)
        if found is None:
            raise ValueError("unknown evidence identifier")
        return found
    if name == "analyze_csv":
        if set(args) != {"column"}:
            raise ValueError("analyze_csv accepts only column")
        return analyze_csv(args["column"])
    raise ValueError("tool is not allowlisted: " + str(name))


def check_answer(candidate, records=None):
    errors = []
    if not isinstance(candidate, dict):
        return {"valid": False, "errors": ["answer must be an object"]}
    for field in ("answer", "citations", "uncertainty"):
        if field not in candidate:
            errors.append("missing field: " + field)
    if not isinstance(candidate.get("answer"), str):
        errors.append("answer must be a string")
    if not isinstance(candidate.get("uncertainty"), str):
        errors.append("uncertainty must be a string")
    citations = candidate.get("citations")
    if not isinstance(citations, list):
        errors.append("citations must be a list")
    else:
        by_id = {r["id"]: r for r in (corpus() if records is None else records)}
        if candidate.get("status") != "abstained" and not citations:
            errors.append("supported answer needs citations")
        for citation in citations:
            if not isinstance(citation, dict) or citation.get("evidence_id") not in by_id:
                errors.append("unknown citation identifier")
                continue
            quote = citation.get("quote")
            if not isinstance(quote, str) or not quote or quote not in by_id[citation["evidence_id"]]["text"]:
                errors.append("quote is not an exact excerpt of the cited teaching note")
    return {"valid": not errors, "errors": errors,
            "limitation": "Exact excerpt checking does not establish semantic support or scientific truth."}


def offline_answer(question, top_k=3, max_steps=6):
    if type(max_steps) is not int or not 1 <= max_steps <= 20:
        raise ValueError("max_steps must be an integer from 1 to 20")
    start = time.perf_counter()
    trace = []
    hits = call_tool("search_evidence", {"question": question, "top_k": top_k})
    trace.append({"step": 1, "action": "search_evidence", "evidence_ids": [r["id"] for r in hits]})
    if max_steps < 2:
        return {"status": "budget_exhausted", "answer": "Stopped before evidence inspection.", "citations": [],
                "uncertainty": "Increase the step budget only after inspecting the trace.", "trace": trace,
                "usage": {"input_tokens": None, "output_tokens": None, "cost_usd": None}, "elapsed_ms": round((time.perf_counter()-start)*1000, 3)}
    if not hits:
        result = {"status": "abstained", "answer": "The supplied teaching notes do not support an answer to this query.",
                  "citations": [], "uncertainty": "No lexical evidence match; ask a narrower question or add vetted material."}
        trace.append({"step": 2, "action": "stop_without_evidence"})
    else:
        citations = [{"evidence_id": r["id"], "quote": r["text"], "source_url": r["source_url"],
                      "source_kind": r["kind"]} for r in hits]
        result = {"status": "answered", "answer": "Teaching-note excerpts:\n" + "\n".join("["+r["id"]+"] "+r["text"] for r in hits),
                  "citations": citations, "uncertainty": "Rule-based excerpt assembly; relevance and conclusions require human review."}
        trace.append({"step": 2, "action": "assemble_exact_excerpts", "count": len(citations)})
    result.update({"trace": trace, "usage": {"input_tokens": None, "output_tokens": None, "cost_usd": None},
                   "elapsed_ms": round((time.perf_counter()-start)*1000, 3), "provider": "offline",
                   "mode": "deterministic educational workflow, not a language model"})
    return result


def evaluate(split="dev", top_k=3):
    if split not in {"dev", "test"}:
        raise ValueError("split must be dev or test")
    cases = json.loads((ROOT / ("data/eval_"+split+".json")).read_text(encoding="utf-8"))
    items = []
    recalls, answerable, unanswerable = [], [], []
    for case in cases:
        hits = search(case["question"], top_k)
        retrieved = {r["id"] for r in hits}
        answer = offline_answer(case["question"], top_k)
        expected = set(case["evidence_ids"])
        if expected:
            recall = len(retrieved & expected)/len(expected)
            recalls.append(recall)
            correct = answer["status"] == "answered" and expected <= {c["evidence_id"] for c in answer["citations"]}
            answerable.append(correct)
        else:
            recall = None
            correct = answer["status"] == "abstained"
            unanswerable.append(correct)
        items.append({"id": case["id"], "question": case["question"], "expected": sorted(expected),
                      "retrieved": sorted(retrieved), "recall": recall, "answer_status": answer["status"], "passed": correct})
    mean = lambda x: sum(x)/len(x) if x else None
    return {"split": split, "top_k": top_k, "retrieval_recall": mean(recalls), "answerable_accuracy": mean(answerable),
            "abstention_accuracy": mean(unanswerable), "items": items,
            "scope": "Small public teaching cases; neither blind testing nor semantic/scientific validation."}


def topological_order(graph):
    graph = {key: set(value) for key, value in graph.items()}
    if set().union(*graph.values()) - set(graph):
        raise ValueError("unknown dependency")
    order = []
    while graph:
        ready = sorted(k for k, deps in graph.items() if not deps)
        if not ready:
            raise ValueError("cycle detected; no executable node remains")
        for key in ready:
            order.append(key)
            del graph[key]
        for deps in graph.values():
            deps.difference_update(ready)
    return order
