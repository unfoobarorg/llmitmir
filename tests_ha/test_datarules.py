"""Datenregeln in einem echten Home Assistant: Wächter vor dem Abruf, Markierung für externe Modelle, Rohzugriffe."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _call(name: str, args: dict, cid: str = "t1") -> dict:
    return {"id": cid, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


async def _setup(hass, llmitmir, hass_ws_client, hass_admin_user, applies: str):
    from custom_components.llmitmir.agent import Run, ToolContext

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"connectors": [{
        "name": "Nextcloud", "type": "webdav", "fixed": {"url": "https://cloud.example.org"},
        "rules": [{"name": "Finanzen", "scope": "/Gruppen/Finanzen/**", "applies": applies,
                   "instruction": "Nur Dateien mit Tag public oder internal; ungelabelte sind gesperrt."}]}]})
    kid = view["connectors"][0]["id"]
    cred = await _ok(admin, "connector/connect", connector_id=kid, fields={"username": "niko", "password": "app-pw-123456"})
    st = await m.user_store(hass_admin_user.id)
    st.meta["projects"]["p1"] = {"id": "p1", "name": "Cloud", "credentials": [cred["id"]]}  # Zugang vorab erlaubt

    def ctx(cid: str, model: str = "glm-5.3"):
        chat = {"id": cid, "kind": "cowork", "model": model, "messages": [], "project_id": "p1"}
        return ToolContext(m, hass_admin_user, st, chat, Run(id="r-" + cid, user_id=hass_admin_user.id, chat_id=cid,
                                                             kind="cowork"), None)

    return m, admin, cred, ctx


async def test_the_guard_decides_before_any_content_is_fetched(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import ToolContext

    m, admin, cred, ctx = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user, "all")
    meta = AsyncMock(return_value={"werkzeug": "dav_read", "path": "Gruppen/Finanzen/plan.xlsx", "tags": []})
    guard = AsyncMock(return_value='{"erlaubt": false, "grund": "Datei ist nicht gelabelt"}')
    handler = AsyncMock(return_value="INHALT")
    from custom_components.llmitmir.tools import REGISTRY

    with patch.object(ToolContext, "_resource_meta", meta), patch.object(m, "complete", guard), \
            patch.object(m, "default_model", return_value="glm-5.3"), patch.object(REGISTRY["dav_read"], "handler", handler):
        c = ctx("dc1")
        res = await c.execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/Gruppen/Finanzen/plan.xlsx"}))
        assert res["status"] == "denied" and "Datei ist nicht gelabelt" in res["content"] and handler.call_count == 0
        assert "Gehalt" not in guard.call_args.args[2][1]["content"]
        # außerhalb des Bereichs: kein Wächter
        ok = await c.execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/Privat/notiz.txt"}, "t2"))
        assert ok["status"] == "ok" and guard.call_count == 1
        # dieselbe Ressource im selben Lauf: Entscheidung aus dem Zwischenspeicher
        await c.execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/Gruppen/Finanzen/plan.xlsx"}, "t3"))
        assert guard.call_count == 1
    ev = (await _ok(admin, "admin/audit", filters={"kind": "data_rule"}))["events"]
    assert ev and ev[0]["outcome"] == "denied" and ev[0]["target"]["object"] == "Finanzen"


async def test_guard_errors_block(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import ToolContext
    from custom_components.llmitmir.tools import REGISTRY

    m, admin, cred, ctx = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user, "all")
    with patch.object(ToolContext, "_resource_meta", AsyncMock(side_effect=ValueError("HTTP 500"))), \
            patch.object(REGISTRY["dav_read"], "handler", AsyncMock(return_value="INHALT")) as handler:
        res = await ctx("dc2").execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/Gruppen/Finanzen/a.txt"}))
    assert res["status"] == "denied" and handler.call_count == 0


async def test_external_only_rules_mark_results_for_later(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.tools import REGISTRY

    m, admin, cred, ctx = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user, "external")
    with patch.object(m, "complete", AsyncMock()) as guard, \
            patch.object(REGISTRY["dav_read"], "handler", AsyncMock(return_value="GEHALTSLISTE")):
        c = ctx("dc3")
        res = await c.execute(_call("dav_read", {"zugang": "Nextcloud", "pfad": "/Gruppen/Finanzen/a.txt"}))
    assert res["status"] == "ok" and res["ext_block"] == "Finanzen" and guard.call_count == 0
    msgs = [{"id": "m1", "role": "assistant", "content": "", "tool_calls": [{"id": "t1"}]}, dict(res)]
    assert c._tool_content(res, set(), False) == "GEHALTSLISTE"
    assert "Datenregel „Finanzen“" in c._tool_content(res, set(), True) and "GEHALT" not in c._tool_content(res, set(), True)
    assert msgs  # Verlauf mit markiertem Ergebnis


async def test_raw_access_is_blocked_for_connectors_with_rules(hass, llmitmir, hass_ws_client, hass_admin_user):
    m, admin, cred, ctx = await _setup(hass, llmitmir, hass_ws_client, hass_admin_user, "external")
    res = await ctx("dc4").execute(_call("http_request", {"methode": "GET", "url": "https://cloud.example.org/x",
                                                          "zugang": "Nextcloud"}))
    assert res["status"] == "denied" and "Rohzugriffe" in res["content"]
