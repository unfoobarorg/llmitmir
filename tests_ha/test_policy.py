"""Zugänge in einem echten Home Assistant: Freigabe je Agent (einmal, für den Chat, nicht), Vorab-Freigabe im Projekt,
geplante Aufgaben ohne Rückfrage, Teilaufgaben, zentrale Zugänge nur mit Erlaubnis des Admins."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

DOMAIN = "llmitmir"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _call(cred: str = "Wetter", cid: str = "t1") -> dict:
    args = {"methode": "GET", "url": "https://api.wetter.example/v1", "zugang": cred}
    return {"id": cid, "type": "function", "function": {"name": "http_request", "arguments": json.dumps(args)}}


@pytest.fixture
async def setup(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import Run, ToolContext

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    cred = await _ok(admin, "credential/save", credential={"name": "Wetter", "type": "bearer", "scope": "dedicated",
                                                           "fields": {"url": "https://api.wetter.example", "token": "t" * 24}})
    st = await m.user_store(hass_admin_user.id)

    def ctx(chat: dict, task: dict | None = None) -> ToolContext:
        chat.setdefault("model", "glm-5.3")
        chat.setdefault("messages", [])
        run = Run(id="r-" + chat["id"], user_id=hass_admin_user.id, chat_id=chat["id"], kind=chat["kind"])
        return ToolContext(m, hass_admin_user, st, chat, run, task)

    return {"m": m, "admin": admin, "cred": cred, "st": st, "ctx": ctx}


async def test_a_credential_needs_approval_once_per_call_or_for_the_chat(setup):
    m, ctx = setup["m"], setup["ctx"]
    chat = {"id": "pc1", "kind": "cowork"}
    c = ctx(chat)
    asked = AsyncMock(side_effect=["once", "always"])
    with patch.object(m, "ask_permission", asked):
        first = await c.execute(_call())
        info = asked.call_args.args[1]
        assert info["cred"] == "Wetter" and info["cred_id"] == setup["cred"]["id"]
        assert first["status"] != "denied"                      # erlaubt (die Anfrage selbst scheitert ohne Netz)
        await c.execute(_call(cid="t2"))                        # „einmal“ gilt nur für einen Aufruf: wieder gefragt
        assert asked.call_count == 2 and chat["cred_ok"] == [setup["cred"]["id"]]
        await c.execute(_call(cid="t3"))                        # „für diesen Chat“: nicht mehr gefragt
        assert asked.call_count == 2
        await ctx(chat).execute(_call(cid="t4"))                # auch nicht im nächsten Lauf desselben Chats
        assert asked.call_count == 2
    res = await _ok(setup["admin"], "admin/audit", filters={"kind": "cred_approval", "agent": "agt-pc1"})
    assert [e["decision"] for e in res["events"]] == ["always", "once"]


async def test_not_allowed_means_working_on_without_it_in_this_run(setup):
    m, ctx = setup["m"], setup["ctx"]
    chat = {"id": "pc2", "kind": "cowork"}
    c = ctx(chat)
    asked = AsyncMock(return_value="deny")
    with patch.object(m, "ask_permission", asked):
        first = await c.execute(_call())
        assert first["status"] == "denied" and "ohne ihn weiterarbeiten" in first["content"].lower()
        again = await c.execute(_call(cid="t2"))                # derselbe Lauf: nicht wieder gefragt
        assert again["status"] == "denied" and asked.call_count == 1
        await ctx(chat).execute(_call(cid="t3"))                # nächster Lauf: neue Frage
        assert asked.call_count == 2
    assert "cred_ok" not in chat


async def test_project_credentials_are_pre_approved(setup):
    m, ctx, st = setup["m"], setup["ctx"], setup["st"]
    st.meta["projects"]["p1"] = {"id": "p1", "name": "Wetter", "credentials": [setup["cred"]["id"]]}
    asked = AsyncMock(return_value="deny")
    with patch.object(m, "ask_permission", asked):
        res = await ctx({"id": "pc3", "kind": "cowork", "project_id": "p1"}).execute(_call())
    assert res["status"] != "denied" and asked.call_count == 0


async def test_scheduled_runs_never_ask_and_use_only_allowed_credentials(setup):
    m, ctx = setup["m"], setup["ctx"]
    asked = AsyncMock(return_value="once")
    with patch.object(m, "ask_permission", asked):
        denied = await ctx({"id": "pc4", "kind": "task_run"}, {"id": "t1", "name": "Wetterbericht"}).execute(_call())
        assert denied["status"] == "denied" and "unbeaufsichtigter Lauf" in denied["content"]
        ok = await ctx({"id": "pc5", "kind": "task_run"},
                       {"id": "t1", "name": "Wetterbericht", "cred_allow": [setup["cred"]["id"]]}).execute(_call())
        assert ok["status"] != "denied"
    assert asked.call_count == 0


async def test_subtasks_use_and_extend_the_approvals_of_their_main_chat(setup):
    m, ctx, st = setup["m"], setup["ctx"], setup["st"]
    root = {"id": "pc6", "kind": "cowork", "messages": [], "model": "glm-5.3"}
    await st.async_save_chat(root)
    asked = AsyncMock(return_value="always")
    with patch.object(m, "ask_permission", asked):
        await ctx({"id": "pc7", "kind": "cowork", "parent_id": "pc6"}).execute(_call())
        assert root["cred_ok"] == [setup["cred"]["id"]]          # gilt für den Hauptchat
        await ctx({"id": "pc8", "kind": "cowork", "parent_id": "pc6"}).execute(_call())
    assert asked.call_count == 1                                # zweite Teilaufgabe: schon erlaubt


async def test_central_credentials_only_with_the_admins_permission(setup):
    admin, ctx = setup["admin"], setup["ctx"]
    bad = await _ws(admin, "credential/save", credential={"name": "System", "type": "bearer", "scope": "central",
                                                          "fields": {"url": "https://x.example", "token": "s" * 24}})
    assert not bad["success"] and "nicht erlaubt" in bad["error"]["message"]
    await _ok(admin, "admin/save", config={"credentials_policy": {"allow_central": True}})
    central = await _ok(admin, "credential/save", credential={"name": "System", "type": "bearer", "scope": "central",
                                                              "fields": {"url": "https://x.example", "token": "s" * 24}})
    assert central["id"] in ctx({"id": "pc9", "kind": "cowork"}).creds
    view = await _ok(admin, "admin/save", config={"credentials_policy": {"allow_central": False}})
    assert view["credentials_policy"]["allow_central"] is False
    assert central["id"] not in ctx({"id": "pc9", "kind": "cowork"}).creds   # gesperrt: kein Modell sieht ihn
    boot = await _ok(admin, "bootstrap")
    assert boot["cred_policy"]["allow_central"] is False and "dedicated" in boot["cred_policy"]["scopes"]


async def test_the_model_must_name_the_kind_of_a_new_credential(setup):
    from custom_components.llmitmir.tools import manage as TM

    c = setup["ctx"]({"id": "pc10", "kind": "chat"})
    with pytest.raises(ValueError, match="Art des Zugangs"):
        TM._cred_plan(c, {"name": "Neu", "typ": "bearer", "felder": {"url": "https://n.example", "token": "x" * 24}})
    ch = await TM.credential_save_preview(c, {"name": "Neu", "typ": "bearer", "art": "eigener",
                                              "felder": {"url": "https://n.example", "token": "x" * 24}})
    assert "Token" in ch["hinweis"] and any(f.get("feld") == "Art" or "Art" in json.dumps(f, ensure_ascii=False)
                                            for f in ch["felder"])
