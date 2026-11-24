"""MCP-Konnektoren in einem echten Home Assistant: freigegebene Werkzeuge erscheinen je Person, laufen mit deren
Zugang, durch Freigabe und Protokoll."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"
TOOLS = [{"name": "issues", "description": "Listet Issues", "input_schema": {"type": "object", "properties": {
    "projekt": {"type": "string"}}}, "write": False, "enabled": True},
         {"name": "loeschen", "description": "Löscht alles", "input_schema": {}, "write": True, "enabled": False}]


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


async def test_frozen_mcp_tools_run_with_the_persons_token(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir import mcp as MCP
    from custom_components.llmitmir.agent import Run, ToolContext

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    bad = await _ws(admin, "admin/save", config={"connectors": [{"name": "Git", "type": "webdav", "mcp": {"tools": TOOLS},
                                                                  "fixed": {"url": "https://git.example.org/mcp"}}]})
    assert not bad["success"] and "MCP-Server" in bad["error"]["message"]
    view = await _ok(admin, "admin/save", config={"connectors": [{"name": "Git", "type": "bearer", "mcp": {"tools": TOOLS},
                                                                   "fixed": {"url": "https://git.example.org/mcp"}}]})
    k = view["connectors"][0]
    boot = await _ok(admin, "bootstrap")
    assert boot["connectors"][0]["mcp_tools"] == ["issues"]
    await _ok(admin, "connector/connect", connector_id=k["id"], fields={"token": "glp-" + "x" * 20})
    st = await m.user_store(hass_admin_user.id)
    chat = {"id": "mc1", "kind": "cowork", "model": "glm-5.3", "messages": []}
    ctx = ToolContext(m, hass_admin_user, st, chat, Run(id="r1", user_id=hass_admin_user.id, chat_id="mc1", kind="cowork"), None)
    names = [s["function"]["name"] for s in ctx.tool_specs()]
    assert "mcp_git_issues" in names and "mcp_git_loeschen" not in names
    spec = next(s for s in ctx.tool_specs() if s["function"]["name"] == "mcp_git_issues")["function"]
    assert spec["description"].startswith("[Git – MCP-Server] Listet Issues")

    call = AsyncMock(return_value=("3 offene Issues", False))
    asked = AsyncMock(side_effect=["once", "always"])
    with patch.object(MCP.Client, "call", call), patch.object(m, "ask_permission", asked):
        res = await ctx.execute({"id": "t1", "type": "function", "function": {
            "name": "mcp_git_issues", "arguments": json.dumps({"projekt": "llmitmir", "fremd": 1})}})
    assert res["status"] == "ok" and res["content"] == "3 offene Issues"
    assert asked.call_args_list[0].args[1]["cred"] == "Git"            # MCP mit Zugang: Freigabe je Agent
    assert asked.call_args_list[1].args[1]["group"] == "mcp"           # Werkzeuggruppe im Cowork erst einschalten
    assert call.call_args.args == ("issues", {"projekt": "llmitmir"})   # nur Argumente aus dem eingefrorenen Schema
    ev = (await _ok(admin, "admin/audit", filters={"agent": "agt-mc1", "kind": "tool"}))["events"]
    assert ev[0]["tool"] == "mcp_git_issues" and ev[0]["group"] == "mcp" and ev[0]["creds"][0]["name"] == "Git"


async def test_admin_fetches_tools_as_a_proposal(hass, llmitmir, hass_ws_client):
    from custom_components.llmitmir import mcp as MCP

    admin = await hass_ws_client(hass)
    with patch.object(MCP.Client, "list_tools", AsyncMock(return_value=[
            {"name": "issues", "description": "Listet", "annotations": {"readOnlyHint": True}}, {"name": "push"}])):
        res = await _ok(admin, "admin/mcp_tools", url="https://git.example.org/mcp", auth_type="bearer", fields={"token": "x"})
    assert [(t["name"], t["write"], t["enabled"]) for t in res["tools"]] == [("issues", False, False), ("push", True, False)]
