"""Zugriffsprotokoll in einem echten Home Assistant: Werkzeugaufrufe landen ohne Inhalte im Protokoll, nur Admins
sehen es, die Aufbewahrungsfrist wird geprüft."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"
SECRET = "Kontostand-4711-vertraulich"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _call(name: str, args: dict, cid: str = "t1") -> dict:
    return {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


async def test_tool_calls_are_logged_per_agent_without_contents(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import Run, ToolContext

    m = llmitmir["manager"]
    uid = hass_admin_user.id
    admin = await hass_ws_client(hass)
    await _ok(admin, "credential/save", credential={"name": "Wetter-API", "type": "bearer",
                                                    "fields": {"url": "https://api.wetter.example", "token": "t" * 24},
                                                    "secret_fields": ["token"]})
    hass.states.async_set("light.kueche", "on")
    st = await m.user_store(uid)
    chat = {"id": "ac1", "kind": "chat", "model": "glm-5.3", "title": SECRET, "messages": []}
    run = Run(id="r1", user_id=uid, chat_id="ac1", kind="chat")
    ctx = ToolContext(m, hass_admin_user, st, chat, run, None)
    assert ctx.agent == {"id": "agt-ac1", "kind": "chat", "owner": uid}

    ok = await ctx.execute(_call("ha_states", {"filter": SECRET}))
    assert ok["status"] == "ok"
    # HTTP ist in Chats nicht eingeschaltet: LLMitMir fragt – die Person lehnt ab
    with patch.object(m, "ask_permission", AsyncMock(return_value="deny")):
        denied = await ctx.execute(_call("http_request", {
            "methode": "GET", "url": f"https://api.wetter.example/v2/data?q={SECRET}",
            "header": {"Authorization": "Bearer {{cred:Wetter-API:token}}"}}, "t2"))
    assert denied["status"] == "denied"
    await ctx.execute(_call("progress_update", {"schritte": [SECRET]}, "t3"))  # intern: nicht protokolliert

    res = await _ok(admin, "admin/audit", filters={"agent": "agt-ac1", "kind": "tool"})
    events = res["events"]
    assert [e["tool"] for e in events] == ["http_request", "ha_states"]
    http, states = events
    assert http["outcome"] == "denied" and http["decision"] == "denied" and http["group"] == "http"
    assert http["creds"][0]["name"] == "Wetter-API"
    assert http["target"] == {"host": "api.wetter.example", "path": "/v2/data", "method": "GET"}
    assert states["outcome"] == "ok" and states["decision"] == "auto" and states["model_class"] == "main"
    assert all(e["agent"] == "agt-ac1" and e["user"] == uid and e["run"] == "r1" for e in events)
    assert SECRET not in json.dumps(res)
    assert res["names"][uid] and res["summary"]["denied"] == 1 and res["agents"]["agt-ac1"]["calls"] == 2
    assert [e["tool"] for e in (await _ok(admin, "admin/audit", filters={"only_creds": True, "agent": "agt-ac1",
                                                                         "kind": "tool"}))["events"]] == ["http_request"]
    # der Zugang brauchte eine Freigabe im Chat (1.3.0): auch diese Entscheidung steht im Protokoll
    cred = (await _ok(admin, "admin/audit", filters={"agent": "agt-ac1", "kind": "cred_approval"}))["events"]
    assert [(e["decision"], e["creds"][0]["name"]) for e in cred] == [("denied", "Wetter-API")]

    agents = await _ok(admin, "admin/audit_agents")
    assert "agt-ac1" in [a["id"] for a in agents["agents"]] and next(a for a in agents["agents"] if a["id"] == "agt-ac1")["creds"]


async def test_audit_is_for_admins_only_and_retention_is_checked(hass, llmitmir, hass_ws_client, hass_admin_user,
                                                                 hass_read_only_user, hass_read_only_access_token):
    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"allowed_users": [hass_admin_user.id, hass_read_only_user.id]})
    other = await hass_ws_client(hass, hass_read_only_access_token)
    for typ in ("admin/audit", "admin/audit_agents"):
        msg = await _ws(other, typ)
        assert not msg["success"] and msg["error"]["code"] == "unauthorized"
    assert (await _ok(admin, "admin/get"))["audit"] == {"retention_days": 180}
    assert (await _ok(admin, "admin/save", config={"audit": {"retention_days": 30}}))["audit"] == {"retention_days": 30}
    bad = await _ws(admin, "admin/save", config={"audit": {"retention_days": 2}})
    assert not bad["success"] and "Aufbewahrungsfrist" in bad["error"]["message"]
