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
    # außerhalb der Konnektor-Seite lässt sich der Zugang weder ändern noch löschen
    for typ, kw in (("credential/save", {"credential": {"id": cred["id"], "name": "Anders"}}),
                    ("credential/delete", {"credential_id": cred["id"]})):
        bad = await _ws(admin, typ, **kw)
        assert not bad["success"] and "Konnektoren" in bad["error"]["message"]
    # das Formular (über die Konnektor-Seite) kann die festen Felder nicht ändern
    edited = await _ok(admin, "credential/save", credential={"id": cred["id"], "fields": {"url": "https://evil.example"}},
                       via_connector=True)
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


async def test_several_connections_options_skill_and_disconnect(hass, llmitmir, hass_ws_client, hass_admin_user):
    """Ein Konnektor mehrfach, Rechte direkt nach dem Verbinden, Skill der Verbindung gesperrt außerhalb der Konnektor-Seite."""
    from custom_components.llmitmir import manage as M

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    gitlab = {"name": "GitLab", "type": "bearer", "fixed": {"url": "https://git.example.org"},
              "setup": "Token unter Einstellungen → Access Tokens anlegen, Scope read_api."}
    view = await _ok(admin, "admin/save", config={"connectors": [gitlab]})
    kid = view["connectors"][0]["id"]
    assert view["connectors"][0]["setup"].startswith("Token")
    boot = await _ok(admin, "bootstrap")
    assert boot["connectors"][0]["has_setup"] is True and "setup" not in boot["connectors"][0]

    a = await _ok(admin, "connector/connect", connector_id=kid, fields={"token": "a" * 24}, name="GitLab Projekt A")
    b = await _ok(admin, "connector/connect", connector_id=kid, fields={"token": "b" * 24}, name="GitLab Projekt B")
    assert a["id"] != b["id"] and {a["name"], b["name"]} == {"GitLab Projekt A", "GitLab Projekt B"}
    # Anmeldedaten einer bestehenden Verbindung erneuern: keine dritte Verbindung
    again = await _ok(admin, "connector/connect", connector_id=kid, fields={"token": "c" * 24}, credential_id=a["id"])
    assert again["id"] == a["id"]
    st = await m.user_store(hass_admin_user.id)
    assert len([c for c in st.meta["credentials"].values() if c.get("connector_id") == kid]) == 2

    opt = await _ok(admin, "connector/options", credential_id=a["id"], readonly=True, valid_until="2027-01-31")
    assert opt["readonly"] is True and opt["valid_until"] == "2027-01-31"
    bad = await _ws(admin, "connector/options", credential_id=a["id"], valid_until="morgen")
    assert not bad["success"]

    skill = await M.save_skill(m, hass_admin_user.id, st, {"name": "Projekt A", "description": "GitLab A", "body": "# A"},
                               connection=st.meta["credentials"][a["id"]])
    assert skill["connection_id"] == a["id"] and skill["credentials"] == [a["id"]]
    for typ, kw in (("skill/save", {"skill": dict(skill, body="# anders")}), ("skill/delete", {"skill_id": skill["id"]})):
        bad = await _ws(admin, typ, **kw)
        assert not bad["success"] and "Konnektoren" in bad["error"]["message"]
    saved = await _ok(admin, "skill/save", skill=dict(skill, body="# anders", credentials=[]), via_connector=True)
    assert saved["body"] == "# anders" and saved["credentials"] == [a["id"]]

    # Trennen löscht Zugang und Skill der Verbindung
    await _ok(admin, "connector/disconnect", credential_id=a["id"])
    assert a["id"] not in st.meta["credentials"] and skill["id"] not in st.meta["skills"]
    assert b["id"] in st.meta["credentials"]


async def test_read_only_connection_blocks_writes_and_the_chat_shows_the_connector(hass, llmitmir, hass_ws_client,
                                                                                  hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [WETTER]})
    cred = await _ok(admin, "connector/connect", connector_id=view["connectors"][0]["id"], fields={"token": "t" * 24},
                     name="Wetter Büro")
    await _ok(admin, "connector/options", credential_id=cred["id"], readonly=True)
    st = await m.user_store(hass_admin_user.id)
    ctx = _ctx(m, hass_admin_user, st, "kc5")
    assert ctx._connector_label({"zugang": "Wetter Büro"}) == "Wetter · Wetter Büro"
    assert ctx._connector_label({"url": "https://x.example"}) == ""
    from custom_components.llmitmir.tools import REGISTRY

    msg: dict = {}
    denied = ctx._read_only_guard(msg, REGISTRY["http_request"], {"zugang": "Wetter Büro", "methode": "POST", "url": "https://api.wetter.example"})
    assert denied and denied["status"] == "denied" and "nur lesen" in denied["content"]
    assert ctx._read_only_guard({}, REGISTRY["http_request"], {"zugang": "Wetter Büro", "methode": "GET",
                                                               "url": "https://api.wetter.example"}) is None
    assert ctx._read_only_guard({}, REGISTRY["shell"], {"befehl": "curl -H 'X: {{cred:Wetter Büro:token}}' x"})


async def test_setup_chat_guides_with_the_admin_instructions(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [dict(WETTER, setup="Den Token gibt es im Kundenportal.")]})
    kid = view["connectors"][0]["id"]
    with patch.object(type(m), "send", AsyncMock(return_value="r1")) as send:
        chat = await _ok(admin, "connector/setup_chat", connector_id=kid)
    assert chat["connector_setup"]["connector_id"] == kid and chat["title"] == "Einrichtung: Wetter"
    assert "einrichten" in send.await_args.args[2]
    st = await m.user_store(hass_admin_user.id)
    full = await st.async_get_chat(chat["id"])
    from custom_components.llmitmir.agent import Run, ToolContext

    ctx = ToolContext(m, hass_admin_user, st, full, Run(id="r-s", user_id=hass_admin_user.id, chat_id=chat["id"], kind="chat"), None)
    assert "konnektor" in ctx.groups()
    prompt = ctx.system_prompt()
    assert "Kundenportal" in prompt and "konnektor_verbinden" in prompt
    names = {t["function"]["name"] for t in ctx.tool_specs()}
    assert {"konnektor_verbinden", "konnektor_skill"} <= names
    # in einem gewöhnlichen Chat gibt es die Werkzeuge nicht
    assert "konnektor_verbinden" not in {t["function"]["name"] for t in _ctx(m, hass_admin_user, st, "kc6").tool_specs()}


async def test_connect_form_in_the_setup_chat_reports_without_secrets(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir import credcheck as CK
    from custom_components.llmitmir.agent import Run, ToolContext
    from custom_components.llmitmir.tools import REGISTRY

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [WETTER]})
    kid = view["connectors"][0]["id"]
    st = await m.user_store(hass_admin_user.id)
    chat = {"id": "ks1", "kind": "chat", "model": "glm-5.3", "messages": [],
            "connector_setup": {"connector_id": kid, "credential_id": None}}
    ctx = ToolContext(m, hass_admin_user, st, chat, Run(id="r-ks1", user_id=hass_admin_user.id, chat_id="ks1", kind="chat"), None)
    task = hass.async_create_task(REGISTRY["konnektor_verbinden"].handler(ctx, {"name": "Wetter Haus"}))
    for _ in range(50):
        await asyncio.sleep(0)
        pid = next((p for p, (_, _, info) in m.permissions.items() if info.get("connector_form")), None)
        if pid:
            break
    assert pid and m.permissions[pid][2]["connector_form"]["name"] == "Wetter Haus"
    with patch.object(CK, "check_credential", AsyncMock(return_value={"ok": True, "message": "ok", "at": 1})):
        cred = await _ok(admin, "connector/connect", connector_id=kid, fields={"token": "s" * 24}, name="Wetter Haus",
                         check=True, permission_id=pid)
    assert cred["check"]["ok"] is True
    await _ok(admin, "connector/options", credential_id=cred["id"], readonly=False, permission_id=pid)
    text = await task
    assert "Verbunden" in text and "Wetter Haus" in text and "lesen und schreiben" in text and "s" * 24 not in text
    assert chat["connector_setup"]["credential_id"] == cred["id"]
    # danach: Skill der Verbindung mit Bestätigung
    ch = await REGISTRY["konnektor_skill"].preview(ctx, {"name": "Wetter Haus nutzen", "anleitung": "# Nur Vorhersagen"})
    assert ch["felder"] and "Konnektoren" in ch["hinweis"]
    await REGISTRY["konnektor_skill"].handler(ctx, {"name": "Wetter Haus nutzen", "anleitung": "# Nur Vorhersagen"})
    skill = next(s for s in st.meta["skills"].values() if s["name"] == "Wetter Haus nutzen")
    assert skill["connection_id"] == cred["id"] and skill["connector_id"] == kid
