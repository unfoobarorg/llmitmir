"""Trusted-AI-Zentrale in einem echten Home Assistant: Freigaben entziehen, Agent anhalten, Export, Auffälligkeiten."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


async def test_admin_revokes_approvals_centrally(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    cred = await _ok(admin, "credential/save", credential={"name": "Wolke", "type": "bearer", "scope": "dedicated",
                                                           "fields": {"url": "https://x.example", "token": "t" * 24}})
    st = await m.user_store(hass_admin_user.id)
    chat = await _ok(admin, "chat/create", kind="cowork")
    c = await st.async_get_chat(chat["id"])
    c["cred_ok"] = [cred["id"]]
    await st.async_save_chat(c)
    st.meta["tasks"]["t1"] = {"id": "t1", "name": "A", "cred_allow": [cred["id"]]}
    st.meta["projects"]["p1"] = {"id": "p1", "name": "P", "credentials": [cred["id"]]}
    res = await _ok(admin, "admin/revoke", user_id=hass_admin_user.id, credential_id=cred["id"], projects=True)
    assert res == {"chats": 1, "tasks": 1, "projects": 1}
    assert (await st.async_get_chat(chat["id"]))["cred_ok"] == [] and st.meta["tasks"]["t1"]["cred_allow"] == []
    ev = (await _ok(admin, "admin/audit", filters={"kind": "admin_action"}))["events"]
    assert ev[0]["tool"] == "revoke" and ev[0]["target"]["object"] == "Wolke"


async def test_stop_export_and_anomalies(hass, llmitmir, hass_ws_client, hass_read_only_user, hass_read_only_access_token):
    admin = await hass_ws_client(hass)
    assert (await _ok(admin, "admin/agent_stop", agent_id="agt-nichts"))["stopped"] == 0
    view = await _ok(admin, "admin/save", config={"audit": {"export": {
        "webhook": {"enabled": True, "url": "https://siem.example.org/in", "token": "geheim"}, "kinds": ["tool", "admin_action"]}}})
    assert view["audit"]["export"]["webhook"]["token"] == "•••" and view["audit"]["retention_days"] == 180
    # die Frist zu ändern lässt den Export stehen
    view = await _ok(admin, "admin/save", config={"audit": {"retention_days": 30}})
    assert view["audit"]["export"]["webhook"]["url"] == "https://siem.example.org/in"
    from custom_components.llmitmir import auditexport as AX

    with patch.object(AX, "send_webhook", AsyncMock()) as send:
        res = await _ok(admin, "admin/audit_export_test")
    assert res["state"]["webhook"]["error"] is None and send.call_args.args[2][0]["tool"] == "export_test"
    with patch.object(AX, "send_webhook", AsyncMock(side_effect=ValueError("HTTP 500"))):
        res = await _ok(admin, "admin/audit_export_test")
    assert "HTTP 500" in res["state"]["webhook"]["error"]
    assert (await _ok(admin, "admin/anomalies"))["items"] == []
    await _ok(admin, "admin/save", config={"allowed_users": [hass_read_only_user.id]})
    other = await hass_ws_client(hass, hass_read_only_access_token)
    for typ, kw in (("admin/revoke", {"user_id": "x"}), ("admin/agent_stop", {"agent_id": "x"}), ("admin/anomalies", {}),
                    ("admin/audit_export_test", {})):
        msg = await _ws(other, typ, **kw)
        assert not msg["success"] and msg["error"]["code"] == "unauthorized"
