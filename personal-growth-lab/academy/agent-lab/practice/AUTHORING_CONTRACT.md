# Runtime contract (for lesson authors)
CLI: python run.py day N [--config experiments.json]. Output: outputs/dayNN.json = {day,title,mode:"offline",result:{...}}. Main dependencies: Python3.10+ standard library. Commands: ask QUESTION [--top-k 3], evaluate --split dev|test --top-k 3, serve --port 8765. Live providers optional only day3/6/14/25/30, or ask, with --provider ollama|openai --model NAME --allow-network. No live inference claimed.

All config keys in experiments.json are used. JSON schema is strict at tool boundary (day2): question string nonempty, top_k integer 1..5, extra fields rejected; bool is not integer.

Result keys by day:
1 task_card (goal,max_steps,allowed_actions,stop_conditions).
2 accepted, validation (day02 config checked as tool args); invalid examples returned separately.
3 provider, answer.
4 candidate (answer,citations,uncertainty), check(valid,errors); remove_field removes named field, no automatic repair.
5 valid_call, invalid_call; invalid_top_k passed to actual tool validation.
6 answer(status,answer,citations,trace,usage), bounded rule workflow.
7 evidence_card(evidence_id,claim,source_url,quote,limitations,requires_human_review); teaches card not paper extraction.
8 imported_record, content_sha256, records_before,records_after; only current in-memory corpus copy.
9 chunks, retrieved; character chunk_size/overlap, lexical ranking not embeddings.
10 answer.
11 evaluation(retrieval_recall,answerable_accuracy,abstention_accuracy,items), public dev set; top_k used by retrieval AND answer.
12 loaded_existing,checkpoint,state; outputs/checkpoint.json reused only if same question.
13 owner_visible,other_user_visible,expired,deleted,memory_path; outputs/memory.json, deterministic elapsed time, tenant isolation.
14 answer,project_checks.
15 graph,execution_order,valid,error; force_cycle creates real cycle rejected by topological sort.
16 retry(attempts,status,error),deadline(status,elapsed_ms); actual retries, small bounded delay/timeout.
17 status(needs_approval/written/already_applied/approval_mismatch),digest,preview,path; copy digest into approved_digest, change draft_text invalidates old approval. outputs/approved_report.txt only write path.
18 requests,responses,stderr; actual stdio process, fixed small protocol subset with initialize/list/call and initialized notification.
19 state,node_trace; main uses standard-library graph; optional/langgraph_demo.py uses LangGraph separately, fixed query.
20 researcher,critic,reviewer,mode; rule role separation, not three language models.
21 report,gate(valid,errors); remove_citations invalidates actual gate.
22 analysis(rows_total,rows_valid,rows_missing,mean,min,max),synthetic_data; missing_policy exclude/error; inspect actual data, no fixed numbers assumed.
23 untrusted_data,tool_result,policy; requested_tool must be allowlisted, no execution of content directives. Not proof prompt injection solved.
24 evaluation; public test set, not blind/secret benchmark.
25 answer,observability; real elapsed, reported model tokens or null, cost_usd null offline/unknown, trace not chain of thought.
26 request,response,local_url; request contract validation; run serve separately for actual local webpage.
27 results,actual_calls,cache_hits,budget_exhausted; bounded concurrent lexical retrieval with cache and call budget.
28 manifest(files,sha256),instructions; hashes actual source/data files, never packages outputs/.env.
29 unknown_answer,conflict_review,attack_check; conflict check is a limited keyword/rule alert; no semantic contradiction solver.
30 answer,evaluation,capability_card,project_checks.
