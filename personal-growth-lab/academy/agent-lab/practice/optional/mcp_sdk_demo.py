"""Real MCP v1 client/server stdio exchange; independent of the small day18 subset."""
import asyncio
import json
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    params = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).with_name("mcp_sdk_server.py"))])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            initialized = await session.initialize()
            listing = await session.list_tools()
            response = await session.call_tool("search_evidence", {"question": "What is a tool contract?", "top_k": 2})
            result = {"sdk": "mcp==1.30.0", "protocol_version": initialized.protocolVersion,
                      "tools": [tool.name for tool in listing.tools], "response": response.model_dump(mode="json")}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            if response.isError:
                raise RuntimeError("MCP server returned a tool error")


if __name__ == "__main__":
    asyncio.run(asyncio.wait_for(main(), timeout=20))
