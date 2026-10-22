"""Real MCP SDK v1 server. Install optional/requirements.txt first."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mcp.server.fastmcp import FastMCP
from agentkit.core import call_tool

app = FastMCP("course-evidence-v1")


@app.tool()
def search_evidence(question: str, top_k: int = 3) -> list:
    """Search original course teaching notes, with top_k from 1 to 5."""
    return call_tool("search_evidence", {"question": question, "top_k": top_k})


@app.tool()
def read_evidence(evidence_id: str) -> dict:
    """Read an existing course note identified by E01 through E08."""
    return call_tool("read_evidence", {"evidence_id": evidence_id})


if __name__ == "__main__":
    app.run(transport="stdio")
