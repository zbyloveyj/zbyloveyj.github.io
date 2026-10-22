"""A deliberately small MCP stdio teaching subset, pinned to 2025-06-18.

Implements initialize, initialized notification, tools/list and tools/call only.
No network transport, resources, prompts, authorization, cancellation or full conformance claim.
"""
import json
import sys
from .core import TOOLS, call_tool

VERSION = "2025-06-18"


def serve():
    initialized = False
    ready = False
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            if not isinstance(request, dict) or request.get("jsonrpc") != "2.0":
                raise ValueError("JSON-RPC 2.0 object required")
            method = request.get("method")
            if method == "notifications/initialized":
                ready = initialized
                continue
            request_id = request.get("id")
            if method == "initialize":
                initialized = True
                result = {"protocolVersion": VERSION, "capabilities": {"tools": {}},
                          "serverInfo": {"name": "agent-course-teaching-subset", "version": "1.0"}}
            elif not ready:
                raise ValueError("initialize and notifications/initialized are required")
            elif method == "tools/list":
                result = {"tools": [{"name": t["name"], "description": t["description"], "inputSchema": t["parameters"]} for t in TOOLS]}
            elif method == "tools/call":
                params = request.get("params", {})
                if not isinstance(params, dict):
                    raise ValueError("params must be an object")
                try:
                    value = call_tool(params.get("name"), params.get("arguments"))
                    result = {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False)}], "isError": False}
                except ValueError as exc:
                    result = {"content": [{"type": "text", "text": str(exc)}], "isError": True}
            else:
                raise ValueError("unsupported method in this teaching subset")
            response = {"jsonrpc": "2.0", "id": request_id, "result": result}
        except (ValueError, TypeError) as exc:
            response = {"jsonrpc": "2.0", "id": request.get("id") if isinstance(locals().get("request"), dict) else None,
                        "error": {"code": -32600, "message": str(exc)}}
        print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    serve()
