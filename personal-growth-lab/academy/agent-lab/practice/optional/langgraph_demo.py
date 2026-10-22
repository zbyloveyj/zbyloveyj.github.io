"""Real LangGraph StateGraph, deterministic nodes, no model/API key required."""
import json
import sys
from pathlib import Path
from typing import TypedDict
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from langgraph.graph import StateGraph, START, END
from agentkit.core import search, check_answer


class State(TypedDict, total=False):
    question: str
    evidence: list
    candidate: dict
    check: dict
    node_trace: list


def retrieve(state: State):
    return {"evidence": search(state["question"], 3), "node_trace": ["retrieve"]}


def draft(state: State):
    records = state["evidence"]
    candidate = {"status": "answered" if records else "abstained",
                 "answer": "\n".join(r["text"] for r in records) or "No supporting note.",
                 "citations": [{"evidence_id": r["id"], "quote": r["text"], "source_url": r["source_url"]} for r in records],
                 "uncertainty": "Original teaching notes, not a scientific review."}
    return {"candidate": candidate, "node_trace": state["node_trace"]+["draft"]}


def review(state: State):
    return {"check": check_answer(state["candidate"]), "node_trace": state["node_trace"]+["review"]}


def main():
    builder = StateGraph(State)
    builder.add_node("retrieve", retrieve)
    builder.add_node("draft", draft)
    builder.add_node("review", review)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "draft")
    builder.add_edge("draft", "review")
    builder.add_edge("review", END)
    graph = builder.compile()
    result = graph.invoke({"question": "What does relative abundance measure?"})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["check"]["valid"]:
        raise RuntimeError("LangGraph output failed the evidence contract")


if __name__ == "__main__":
    main()
