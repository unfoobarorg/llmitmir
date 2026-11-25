"""Chats mit internen Daten für externe Modelle sperren (datalock.py) in einem echten Home Assistant: Markierung durch
Werkzeuge, Sperre beim Modellwechsel, Teilaufgaben, Skills nur für interne Modelle, alte Verläufe, Admin-Schalter."""
from __future__ import annotations

import json
import time
from unittest.mock import AsyncMock, patch

import pytest

DOMAIN = "llmitmir"
EXT = "openai-gpt-5.2"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _call(name: str, args: dict, cid: str = "t1") -> dict:
    return {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


async def _setup(hass, llmitmir, hass_ws_client, hass_admin_user):
    """Ein offenes und ein externes Modell (für die Person freigegeben, zugestimmt), ein gesperrter und ein für externe
    Modelle freigegebener Zugang, beide im Projekt vorab erlaubt."""
    from custom_components.llmitmir import models as MS

    m = llmitmir["manager"]
    uid = hass_admin_user.id
    fresh = [{"id": "glm-5.3", "name": "GLM 5.3", "status": "ready", "demand": 0, "input": ["text"], "output": ["text"]},
             {"id": EXT, "name": "GPT-5.2 (External)", "status": "ready", "demand": 0, "input": ["text"], "output": ["text"]}]
    known, _ = MS.merge_known([], fresh, time.time())
    m.config.data["models"] = {"known": known, "enabled": [x["id"] for x in known]}
    m._models_at = time.time()
    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"model_access": {EXT: [uid]}})
    await _ok(admin, "external/consent", accept=True)
    intern = await _ok(admin, "credential/save", credential={
        "name": "Nextcloud", "type": "webdav", "fields": {"url": "https://cloud.example.org", "username": "niko",
                                                          "password": "app-pw-123456"}})
    frei = await _ok(admin, "credential/save", credential={
        "name": "Wetter", "type": "webdav", "fields": {"url": "https://wetter.example.org", "username": "w",
                                                       "password": "app-pw-654321"}, "external": True})
    st = await m.user_store(uid)
    st.meta["projects"]["p1"] = {"id": "p1", "name": "Büro", "credentials": [intern["id"], frei["id"]]}
    return m, admin, st, intern


def _ctx(m, user, st, chat):
    from custom_components.llmitmir.agent import Run, ToolContext

    return ToolContext(m, user, st, chat, Run(id="r-" + chat["id"], user_id=user.id, chat_id=chat["id"],
                                              kind=chat["kind"]), None)


async def test_an_internal_credential_locks_the_chat_for_external_models(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import QuotaError
    from custom_components.llmitmir.tools import REGISTRY

    m, admin, st, intern = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user)
    uid = hass_admin_user.id
    assert m.external_view(uid)["lock_chats"]
    chat = await m.create_chat(uid, "cowork", "p1")
    ctx = _ctx(m, hass_admin_user, st, chat)
    with patch.object(REGISTRY["dav_read"], "handler", AsyncMock(return_value="GEHALTSLISTE")):
        res = await ctx.execute(_call("dav_read", {"zugang": "Wetter", "pfad": "/wetter.txt"}))
        assert res["status"] == "ok" and not m.chat_lock(st, chat)  # freigegebener Zugang: frei
        res = await ctx.execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/gehalt.txt"}, "t2"))
    assert res["status"] == "ok" and res["cred_ids"] == [intern["id"]]
    chat["messages"] += [{"id": "a1", "role": "assistant", "content": "Die Gehaltsliste zeigt 4.200 € für Anna.",
                          "created": time.time()}, res]
    await st.async_save_chat(chat)
    assert st.meta["chats"][chat["id"]]["internal_only"]["reasons"][0] == {
        "kind": "cred", "name": "Nextcloud", "ts": chat["internal_only"]["since"]}

    # kein externes Modell mehr: von Hand, als Notfall-Ausweichmodell, als Angebot
    with pytest.raises(QuotaError, match="nicht an externe Modelle"):
        await m.switch_model(uid, chat["id"], EXT)
    assert m._fallback_for(uid, {}, st, chat) is None and m._offer(uid, st, chat) is None
    assert chat["model"] == "glm-5.3"
    # ein Chat ohne interne Daten darf weiterhin
    other = await m.create_chat(uid, "cowork", "p1")
    assert (await m.switch_model(uid, other["id"], EXT))["switched"] == "idle"

    # letzte Schranke: auch wenn das Modell anders dorthin käme, geht keine Anfrage hinaus
    chat["model"] = EXT
    with pytest.raises(QuotaError, match="nicht an externe Modelle"):
        _ctx(m, hass_admin_user, st, chat).api_messages()
    with pytest.raises(QuotaError):
        _ctx(m, hass_admin_user, st, chat).claude_request([], False)
    chat["model"] = "glm-5.3"

    # Teilaufgaben teilen den Arbeitsbereich: gesperrt, solange der Hauptchat es ist
    sub = await m.create_sub(uid, chat["id"], "Zusammenfassung schreiben")
    assert m.chat_lock(st, sub)
    with pytest.raises(QuotaError):
        m._check_chat_external(uid, st, sub, EXT)

    # Admin schaltet die Sperre ab: nur noch Herausfiltern wie bisher – auch nach dem Umbenennen des Zugangs
    view = await _ok(admin, "admin/get")
    assert view["credentials_policy"]["lock_chats"] is True
    await _ok(admin, "admin/save", config={"credentials_policy": {"lock_chats": False}})
    assert not m.chat_lock(st, chat) and not m.external_view(uid)["lock_chats"]
    m._check_chat_external(uid, st, chat, EXT)
    st.meta["credentials"][intern["id"]]["name"] = "Cloud intern"
    chat["model"] = EXT
    text = json.dumps(_ctx(m, hass_admin_user, st, chat).api_messages(), ensure_ascii=False)
    assert "GEHALTSLISTE" not in text and "für externe Modelle gesperrt" in text
    assert "4.200 €" in text  # genau das fängt nur die Sperre ab


async def test_a_subtask_marks_its_main_chat(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.tools import REGISTRY

    m, admin, st, intern = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user)
    uid = hass_admin_user.id
    root = await m.create_chat(uid, "cowork", "p1")
    sub = await m.create_sub(uid, root["id"], "Dateien lesen", title="Lesen")
    with patch.object(REGISTRY["dav_read"], "handler", AsyncMock(return_value="INHALT")):
        await _ctx(m, hass_admin_user, st, sub).execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/a.txt"}))
    root = await st.async_get_chat(root["id"])
    assert root["internal_only"]["reasons"][0]["name"] == "Nextcloud"
    assert st.meta["chats"][root["id"]]["internal_only"]
    assert m.chat_lock(st, root) and m.chat_lock(st, sub)


async def test_skills_for_internal_models_only(hass, llmitmir, hass_ws_client, hass_admin_user):
    m, admin, st, intern = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user)
    uid = hass_admin_user.id
    skill = await _ok(admin, "skill/save", skill={"name": "Personalakte", "description": "Abläufe der Personalabteilung",
                                                  "body": "GEHEIMER ABLAUF", "internal_only": True})
    assert skill["internal_only"]
    await _ok(admin, "skill/save", skill={"name": "Stil", "description": "Schreibstil", "body": "kurz"})

    ext_chat = await m.create_chat(uid, "cowork", None)
    ext_chat["model"] = EXT
    out = _ctx(m, hass_admin_user, st, ext_chat)
    assert skill["id"] not in out.allowed_skills
    assert "Personalakte" not in out.system_prompt() and "Stil" in out.system_prompt()
    res = await out.execute(_call("skill_load", {"name": "Personalakte"}))
    assert "GEHEIMER" not in res["content"] and "nicht gefunden" in res["content"]
    res = await out.execute(_call("llmitmir_info", {"teil": "skill", "name": "Personalakte"}, "t2"))
    assert "GEHEIMER" not in res["content"]
    res = await out.execute(_call("skill_save", {"name": "Personalakte", "anleitung": "neu"}, "t3"))
    assert res["status"] == "error" and "nur für interne Modelle" in res["content"]
    assert st.meta["skills"][skill["id"]]["body"] == "GEHEIMER ABLAUF"

    # ein internes Modell lädt ihn: der Chat ist danach gesperrt
    chat = await m.create_chat(uid, "cowork", None)
    inside = _ctx(m, hass_admin_user, st, chat)
    res = await inside.execute(_call("skill_load", {"name": "Personalakte"}))
    assert "GEHEIMER ABLAUF" in res["content"]
    assert chat["internal_only"]["reasons"] == [{"kind": "skill", "name": "Personalakte",
                                                 "ts": chat["internal_only"]["since"]}]
    # eine Änderung im Chat (ohne das Feld) lässt die Einstellung stehen
    from custom_components.llmitmir import manage as M

    saved = await M.save_skill(m, uid, st, {"id": skill["id"], "name": "Personalakte", "body": "anders"})
    assert saved["internal_only"]


async def test_old_chats_are_scanned_when_opened(hass, llmitmir, hass_ws_client, hass_admin_user):
    m, admin, st, intern = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user)
    uid = hass_admin_user.id
    chat = await m.create_chat(uid, "chat", None)
    chat.pop("internal_only")  # wie ein Chat von vor dieser Version
    chat["messages"] = [{"id": "m1", "role": "tool", "name": "dav_read", "status": "ok", "tool_call_id": "t1",
                         "args": {"zugang": "Nextcloud", "pfad": "/a.txt"}, "content": "INHALT"}]
    await st.async_save_chat(chat)
    assert not st.meta["chats"][chat["id"]]["internal_only"]
    got = await _ok(admin, "chat/get", chat_id=chat["id"])
    assert got["chat"]["internal_only"]["reasons"][0]["name"] == "Nextcloud"
    assert st.meta["chats"][chat["id"]]["internal_only"]
    assert m.chat_lock(st, chat)
