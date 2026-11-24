"""MCP-Client (mcp.py): eingefrorene Werkzeuge, JSON und Ereignisstrom, Sitzung, Fehler."""
from __future__ import annotations

import asyncio
import json

import pytest
from _lm import load

MCP = load("mcp")


def test_tool_names_and_frozen_lists():
    assert MCP.tool_name({"name": "GitLab Uni"}, "list-merge-requests") == "mcp_gitlab_uni_list_merge_requests"
    assert len(MCP.tool_name({"name": "x" * 50}, "y" * 80)) <= 64
    tools = MCP.clean_tools([{"name": "a", "description": "d" * 3000, "inputSchema": {"type": "object",
                                                                                      "properties": {"q": {"type": "string"}}}},
                             {"name": "a"}, {"name": ""}, {"name": "b", "input_schema": "kaputt", "write": True}])
    assert [t["name"] for t in tools] == ["a", "b"] and len(tools[0]["description"]) == MCP.DESC_MAX
    assert tools[0]["input_schema"]["properties"] == {"q": {"type": "string"}}
    assert tools[1]["input_schema"] == {"type": "object", "properties": {}} and tools[1]["write"]
    prop = MCP.from_server([{"name": "lesen", "annotations": {"readOnlyHint": True}}, {"name": "schreiben"}])
    assert [(t["name"], t["write"], t["enabled"]) for t in prop] == [("lesen", False, False), ("schreiben", True, False)]
    assert MCP.clean_arguments({"q": 1, "zugang": "X", "_x": 2}, {"properties": {"q": {}, "_x": {}}}) == {"q": 1}


def test_result_text():
    assert MCP.result_text({"content": [{"type": "text", "text": "a"}, {"type": "image", "mimeType": "image/png"},
                                        {"type": "resource", "resource": {"text": "r"}}]}) == "a\n[image: image/png]\nr"
    assert MCP.result_text({"structuredContent": {"n": 1}}) == '{"n": 1}'


class _Resp:
    def __init__(self, status=200, body="", ctype="application/json", headers=None):
        self.status, self._body = status, body
        self.headers = {"Content-Type": ctype, **(headers or {})}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def text(self):
        return self._body


class _Session:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def post(self, url, **kw):
        self.calls.append((url, kw))
        return self.answers.pop(0)


def test_client_lists_and_calls_tools_with_session_and_sse():
    async def go():
        init = _Resp(body=json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"protocolVersion": MCP.PROTOCOL}}),
                     headers={"Mcp-Session-Id": "s-1"})
        sse = ('event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n'
               'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"suche"}],"nextCursor":"c"}}\n\n')
        page2 = _Resp(body=json.dumps({"jsonrpc": "2.0", "id": 3, "result": {"tools": [{"name": "lesen"}]}}))
        s = _Session([init, _Resp(202, ""), _Resp(body=sse, ctype="text/event-stream"), page2])
        cl = MCP.Client(s, "https://mcp.example.org/mcp", {"type": "bearer", "fields": {"token": "geheim"}})
        tools = await cl.list_tools()
        assert [t["name"] for t in tools] == ["suche", "lesen"]
        url, kw = s.calls[0]
        assert kw["headers"]["Authorization"] == "Bearer geheim" and kw["allow_redirects"] is False
        assert "Mcp-Session-Id" not in kw["headers"] and s.calls[1][1]["headers"]["Mcp-Session-Id"] == "s-1"
        assert s.calls[3][1]["json"]["params"] == {"cursor": "c"}
        call = _Session([_Resp(body=json.dumps({"jsonrpc": "2.0", "id": 4, "result": {
            "content": [{"type": "text", "text": "kaputt"}], "isError": True}}))])
        cl.session = call
        assert await cl.call("lesen", {"x": 1}) == ("kaputt", True)
        assert call.calls[0][1]["json"]["params"] == {"name": "lesen", "arguments": {"x": 1}}

    asyncio.run(go())


def test_client_errors():
    async def go():
        with pytest.raises(MCP.McpError, match="https"):
            MCP.Client(_Session([]), "http://mcp.example.org", None)
        s = _Session([_Resp(401)])
        with pytest.raises(MCP.McpError, match="Token"):
            await MCP.Client(s, "https://mcp.example.org", None).open()
        s = _Session([_Resp(body=json.dumps({"jsonrpc": "2.0", "id": 1, "error": {"code": -32601, "message": "nö"}}))])
        with pytest.raises(MCP.McpError, match="-32601"):
            await MCP.Client(s, "https://mcp.example.org", None).request("x")

    asyncio.run(go())
