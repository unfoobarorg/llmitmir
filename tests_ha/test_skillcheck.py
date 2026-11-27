"""Zentrale Skills und Skill-Richtlinien in einem echten Home Assistant."""
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


def _ctx(m, user, st, cid="sc1"):
    from custom_components.llmitmir.agent import Run, ToolContext

    chat = {"id": cid, "kind": "chat", "model": "glm-5.3", "messages": []}
    return ToolContext(m, user, st, chat, Run(id="r-" + cid, user_id=user.id, chat_id=cid, kind="chat"), None)


async def _checks() -> None:
    """Auf die Skill-Prüfungen im Hintergrund warten (auch auf die, die eine Prüfung anstößt)."""
    import asyncio

    from custom_components.llmitmir import skillcheck as SK

    for _ in range(5):
        if not SK.RUNNING:
            return
        await asyncio.gather(*list(SK.RUNNING))


def _load(name: str) -> dict:
    return {"id": "t1", "type": "function", "function": {"name": "skill_load", "arguments": json.dumps({"name": name})}}


async def test_central_skills_apply_to_everybody_and_cannot_be_shadowed(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"central_skills": [
        {"name": "Stil", "body": "Sprich die Person immer mit Sie an.", "mode": "always"},
        {"name": "Quellen", "description": "Wie Quellen genannt werden", "body": "Immer mit Link.", "mode": "on_demand"}]})
    assert [s["name"] for s in view["central_skills"]] == ["Stil", "Quellen"]
    boot = await _ok(admin, "bootstrap")
    assert "central_skills" not in boot and not any(s["name"] == "Stil" for s in boot["skills"])  # unsichtbar
    bad = await _ws(admin, "skill/save", skill={"name": "stil", "body": "Duze alle."})
    assert not bad["success"] and "zentralen Vorgabe" in bad["error"]["message"]

    st = await m.user_store(hass_admin_user.id)
    ctx = _ctx(m, hass_admin_user, st)
    prompt = ctx.system_prompt()
    assert "## Verbindliche Vorgaben" in prompt and "immer mit Sie an" in prompt and "**Quellen** (zentral)" in prompt
    assert prompt.index("Verbindliche Vorgaben") < prompt.index("## Skills")
    res = await ctx.execute(_load("quellen"))
    assert res["status"] == "ok" and "Immer mit Link." in res["content"]


async def test_a_blocking_rule_locks_a_skill_and_tells_the_person(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"skill_policies": [
        {"name": "Kein FTP", "kind": "regex", "pattern": r"ftp://\S+", "action": "block"}]})
    skill = await _ok(admin, "skill/save", skill={"name": "Upload", "description": "Dateien hochladen",
                                                  "body": "Lade nach ftp://files.example hoch."})
    await _checks()
    st = await m.user_store(hass_admin_user.id)
    s = st.meta["skills"][skill["id"]]
    assert s["check"]["state"] == "blocked" and s["check"]["findings"][0]["name"] == "Kein FTP"
    ctx = _ctx(m, hass_admin_user, st, "sc2")
    assert "**Upload**" not in ctx.system_prompt()
    res = await ctx.execute(_load("Upload"))
    assert "Richtlinie des Admins sperrt ihn" in res["content"]
    assert any("gesperrt" in e["title"] for e in st.meta["inbox"])
    rows = (await _ok(admin, "admin/skill_checks"))["rows"]
    assert rows[0]["skill"] == "Upload" and rows[0]["state"] == "blocked" and "ftp://" not in json.dumps(rows[0].get("body", ""))
    ev = (await _ok(admin, "admin/audit", filters={"kind": "skill_check"}))["events"]
    assert ev and ev[0]["tool"] == "Kein FTP" and ev[0]["outcome"] == "denied"

    # Richtlinie entfernt: neu geprüft, wieder nutzbar
    await _ok(admin, "admin/save", config={"skill_policies": []})
    await _checks()
    assert st.meta["skills"][skill["id"]]["check"]["state"] == "ok"


async def test_model_checks_run_on_the_main_provider_and_fail_closed(hass, llmitmir, hass_ws_client, hass_admin_user):
    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"central_skills": [{"name": "Stil", "body": "Immer Sie."}],
                                           "skill_policies": [{"name": "Widerspruch", "kind": "model",
                                                               "prompt": "Widerspricht er den Vorgaben?", "action": "block"}]})
    st = await m.user_store(hass_admin_user.id)
    with patch.object(m, "default_model", return_value="glm-5.3"), \
            patch.object(m, "complete", AsyncMock(return_value='{"verstoss": true, "grund": "verlangt Duzen"}')) as comp:
        skill = await _ok(admin, "skill/save", skill={"name": "Locker", "body": "Duze alle."})
        await _checks()
    assert comp.call_args.args[1] == "glm-5.3" and comp.call_args.kwargs["task"] is True
    assert "Immer Sie." in comp.call_args.args[2][1]["content"]
    c = st.meta["skills"][skill["id"]]["check"]
    assert c["state"] == "blocked" and c["findings"][0]["reason"] == "verlangt Duzen"

    with patch.object(m, "default_model", return_value="glm-5.3"), \
            patch.object(m, "complete", AsyncMock(side_effect=RuntimeError("Anbieter weg"))):
        skill2 = await _ok(admin, "skill/save", skill={"name": "Harmlos", "body": "Sei freundlich."})
        await _checks()
    c2 = st.meta["skills"][skill2["id"]]["check"]
    assert c2["state"] == "pending" and "Anbieter weg" in c2["error"]  # bis zur Prüfung gesperrt
    assert "**Harmlos**" not in _ctx(m, hass_admin_user, st, "sc3").system_prompt()


async def test_admin_suggests_a_task_and_the_person_sets_it_up_in_a_chat(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import Run, ToolContext
    from custom_components.llmitmir.tools import REGISTRY

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    view = await _ok(admin, "admin/save", config={"central_skills": [
        {"name": "Postfach-Board", "description": "Mails ins Taskboard", "body": "Ablauf: Labels lesen …", "mode": "on_demand",
         "suggestion": {"title": "Mails ins Taskboard", "description": "Übernimmt neue Mails als Aufgaben.",
                        "prompt": "Übertrage neue Mails ins Board.", "setup": "Frag nach dem GitLab-Board.",
                        "schedule": {"type": "weekdays", "time": "07:30"}}}]})
    sid = view["central_skills"][0]["id"]
    assert view["central_skills"][0]["suggestion"]["title"] == "Mails ins Taskboard"
    boot = await _ok(admin, "bootstrap")
    assert [s["title"] for s in boot["task_suggestions"]] == ["Mails ins Taskboard"]
    assert "Ablauf" not in json.dumps(boot["task_suggestions"]) and boot["used_central_skills"] == []

    with patch.object(type(m), "send", AsyncMock(return_value="r1")) as send:
        chat = await _ok(admin, "task/suggestion_chat", skill_id=sid)
    assert chat["task_setup"] == {"skill_id": sid} and chat["title"] == "Einrichtung: Mails ins Taskboard"
    assert "Mails ins Taskboard" in send.await_args.args[2]
    st = await m.user_store(hass_admin_user.id)
    full = await st.async_get_chat(chat["id"])
    ctx = ToolContext(m, hass_admin_user, st, full, Run(id="r-ts", user_id=hass_admin_user.id, chat_id=chat["id"], kind="chat"), None)
    prompt = ctx.system_prompt()
    assert "Einrichtung der vorgeschlagenen Aufgabe" in prompt and "GitLab-Board" in prompt and "zentraler_skill" in prompt
    assert "task_save" in {t["function"]["name"] for t in ctx.tool_specs()}

    args = {"name": "Meine Mails", "auftrag": "Übertrage neue Mails ins Board „Haus“.", "zentraler_skill": "Postfach-Board",
            "zeitplan": {"type": "weekdays", "time": "07:30"}}
    ch = await REGISTRY["task_save"].preview(ctx, args)
    assert {"feld": "Zentraler Skill", "alt": None, "neu": "Postfach-Board"} in ch["felder"]
    await REGISTRY["task_save"].handler(ctx, args)
    boot = await _ok(admin, "bootstrap")
    task = next(t for t in boot["tasks"] if t["name"] == "Meine Mails")
    assert task["central_skill_id"] == sid and task["central_skill_name"] == "Postfach-Board"
    assert [(s["name"], s["body"], s["tasks"]) for s in boot["used_central_skills"]] == [
        ("Postfach-Board", "Ablauf: Labels lesen …", ["Meine Mails"])]
    assert boot["task_suggestions"][0]["tasks"] == ["Meine Mails"]

    # Das Panel kann die Verknüpfung nicht lösen; der Lauf baut auf dem zentralen Skill auf
    saved = await _ok(admin, "task/save", task=dict(task, central_skill_id=None, enabled=False))
    assert saved["central_skill_id"] == sid
    run_chat = {"id": "tr1", "kind": "task_run", "model": "glm-5.3", "messages": []}
    tctx = ToolContext(m, hass_admin_user, st, run_chat, Run(id="r-tr1", user_id=hass_admin_user.id, chat_id="tr1", kind="task_run"),
                       st.meta["tasks"][task["id"]])
    assert "zentralen Skill „Postfach-Board“" in tctx.system_prompt()

    # Ausblenden gilt nur für diese Person; ein zurückgezogener Vorschlag lässt sich nicht mehr einrichten
    await _ok(admin, "task/suggestion_hide", skill_id=sid)
    assert (await _ok(admin, "bootstrap"))["task_suggestions"][0]["hidden"] is True
    cs = view["central_skills"]
    await _ok(admin, "admin/save", config={"central_skills": [dict(cs[0], suggestion=dict(cs[0]["suggestion"], enabled=False))]})
    gone = await _ws(admin, "task/suggestion_chat", skill_id=sid)
    assert not gone["success"] and "nicht mehr" in gone["error"]["message"]
    assert (await _ok(admin, "bootstrap"))["used_central_skills"]  # wer die Aufgabe hat, sieht den Skill weiter
