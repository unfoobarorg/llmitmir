"""Konnektoren in einem echten Home Assistant: Katalog, Verbinden, feste Felder, Sperre, freie Zugänge, Login Flow."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"
NC = {"name": "Nextcloud", "type": "webdav", "fixed": {"url": "https://cloud.example.org"}, "login": "nextcloud_flow",
      "instructions": "Teamordner liegen unter /Gruppen."}
WETTER = {"name": "Wetter", "type": "bearer", "fixed": {"url": "https://api.wetter.example"}}


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _ctx(m, user, st, cid="kc1"):
    from custom_components.llmitmir.agent import Run, ToolContext

    chat = {"id": cid, "kind": "cowork", "model": "glm-5.3", "messages": []}
    return ToolContext(m, user, st, chat, Run(id="r-" + cid, user_id=user.id, chat_id=cid, kind="cowork"), None)


async def test_people_connect_with_their_own_account_and_the_admin_keeps_control(hass, llmitmir, hass_ws_client,
                                                                                 hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [NC, WETTER]})
    wid = next(k["id"] for k in view["connectors"] if k["name"] == "Wetter")
    boot = await _ok(admin, "bootstrap")
    pub = {k["name"]: k for k in boot["connectors"]}
    assert pub["Wetter"]["user_fields"] == ["token"] and "instructions" not in pub["Nextcloud"]

    cred = await _ok(admin, "connector/connect", connector_id=wid,
                     fields={"token": "t" * 24, "url": "https://evil.example"})
    assert cred["fields"]["url"] == "https://api.wetter.example" and cred["scope"] == "dedicated"
    assert cred["connector_id"] == wid and cred["fields"]["token"] == "•••"
    # das Formular kann die festen Felder nicht ändern
    edited = await _ok(admin, "credential/save", credential={"id": cred["id"], "fields": {"url": "https://evil.example"}})
    assert edited["fields"]["url"] == "https://api.wetter.example"

    st = await m.user_store(hass_admin_user.id)
    assert cred["id"] in _ctx(m, hass_admin_user, st).creds
    # Admin ändert die Adresse: der Zugang folgt
    view = await _ok(admin, "admin/save", config={"connectors": [dict(k, fixed={"url": "https://neu.wetter.example"})
                                                                 if k["name"] == "Wetter" else k for k in view["connectors"]]})
    assert st.meta["credentials"][cred["id"]]["fields"]["url"] == "https://neu.wetter.example"
    # Admin schaltet den Konnektor aus: der Zugang ist gesperrt
    await _ok(admin, "admin/save", config={"connectors": [dict(k, enabled=False) for k in view["connectors"]]})
    assert cred["id"] not in _ctx(m, hass_admin_user, st, "kc2").creds


async def test_free_credentials_can_be_switched_off(hass, llmitmir, hass_ws_client):
    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"credentials_policy": {"free_credentials": False}, "connectors": [WETTER]})
    bad = await _ws(admin, "credential/save", credential={"name": "Frei", "type": "bearer", "scope": "dedicated",
                                                          "fields": {"url": "https://x.example", "token": "x" * 24}})
    assert not bad["success"] and "Konnektor" in bad["error"]["message"]
    boot = await _ok(admin, "bootstrap")
    assert boot["cred_policy"]["free_credentials"] is False
    await _ok(admin, "connector/connect", connector_id=boot["connectors"][0]["id"], fields={"token": "t" * 24})


async def test_connector_instructions_reach_the_model(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [NC]})
    st = await m.user_store(hass_admin_user.id)
    assert "## Konnektoren" not in _ctx(m, hass_admin_user, st).system_prompt()
    await _ok(admin, "connector/connect", connector_id=view["connectors"][0]["id"],
              fields={"username": "niko", "password": "app-pw-123456"})
    prompt = _ctx(m, hass_admin_user, st, "kc3").system_prompt()
    assert "## Konnektoren" in prompt and "/Gruppen" in prompt


async def test_nextcloud_login_flow_creates_an_app_password_connection(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir import connectors as CN

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [NC]})
    start = AsyncMock(return_value={"login": "https://cloud.example.org/login/v2/flow/x",
                                    "endpoint": "https://cloud.example.org/login/v2/poll", "token": "tok"})
    poll = AsyncMock(side_effect=[None, {"username": "niko", "password": "app-pw-abcdef"}])
    with patch.object(CN, "flow_start", start), patch.object(CN, "flow_poll", poll), patch.object(CN, "FLOW_INTERVAL", 0):
        res = await _ok(admin, "connector/flow_start", connector_id=view["connectors"][0]["id"])
        assert res["login"].endswith("/flow/x")
        for _ in range(50):
            await asyncio.sleep(0)
            status = await _ok(admin, "connector/flow_status", flow_id=res["flow_id"])
            if status["status"] != "waiting":
                break
    assert status["status"] == "done"
    st = await m.user_store(hass_admin_user.id)
    cred = st.meta["credentials"][status["credential_id"]]
    assert cred["fields"] == {"url": "https://cloud.example.org", "username": "niko", "password": "app-pw-abcdef"}
    assert cred["connector_id"] == view["connectors"][0]["id"]
