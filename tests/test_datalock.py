"""Chats mit internen Daten für externe Modelle sperren (datalock.py) – ohne Home Assistant."""
from __future__ import annotations

from _lm import load

DL = load("datalock")

CREDS = {"c1": {"id": "c1", "name": "Nextcloud"}, "c2": {"id": "c2", "name": "Wetter", "external": True}}
SKILLS = {"s1": {"id": "s1", "name": "Personalakte", "internal_only": True}, "s2": {"id": "s2", "name": "Stil"}}


def _tool(name: str, args: dict, status: str = "ok", **kw) -> dict:
    return {"role": "tool", "name": name, "args": args, "status": status, "content": "x", **kw}


def test_mark_is_permanent_and_deduplicated():
    chat: dict = {}
    assert not DL.locked(chat) and DL.summary(chat) is None
    assert DL.mark(chat, DL.KIND_CRED, "Nextcloud", 10.0)
    assert DL.locked(chat) and chat[DL.KEY]["since"] == 10.0
    assert not DL.mark(chat, DL.KIND_CRED, "Nextcloud", 20.0)  # derselbe Grund: keine Änderung
    assert DL.mark(chat, DL.KIND_SKILL, "Personalakte", 30.0)
    assert chat[DL.KEY]["since"] == 10.0 and [r["kind"] for r in DL.reasons(chat)] == ["cred", "skill"]
    assert DL.summary(chat) == {"since": 10.0, "reasons": DL.reasons(chat)}


def test_reasons_are_capped_but_the_mark_stays():
    chat: dict = {}
    for i in range(DL.MAX_REASONS + 5):
        DL.mark(chat, DL.KIND_CRED, f"Z{i}", float(i))
    assert len(DL.reasons(chat)) == DL.MAX_REASONS and DL.locked(chat)
    assert not DL.mark(chat, DL.KIND_CRED, "noch einer", 99.0)


def test_unknown_kind_is_rejected():
    try:
        DL.mark({}, "irgendwas", "x", 1.0)
    except ValueError:
        return
    raise AssertionError("ValueError erwartet")


def test_a_fresh_chat_is_free():
    chat = {DL.KEY: DL.fresh()}
    assert not DL.locked(chat) and DL.summary(chat) is None and DL.reasons(chat) == []


def test_subtask_marks_flow_to_the_main_chat():
    sub, root = {"title": "Teil 1"}, {}
    DL.mark(sub, DL.KIND_RULE, "Finanzen", 5.0)
    assert DL.merge(root, sub, 6.0) and DL.locked(root)
    assert DL.reasons(root)[0]["name"] == "Finanzen"
    assert not DL.merge(root, sub, 7.0)  # schon drin
    assert not DL.merge({}, {"title": "frei"}, 1.0)  # freie Teilaufgabe: nichts zu übernehmen


def test_a_subtask_is_locked_while_its_main_chat_is():
    root = {"title": "Haupt"}
    DL.mark(root, DL.KIND_CRED, "Nextcloud", 1.0)
    sub = {"parent_id": "r", DL.KEY: DL.fresh()}
    assert DL.effective(sub, root)[0]["name"] == "Nextcloud"
    assert DL.effective(sub, {"title": "frei"}) == []
    # auch die Zusammenfassung im Index genügt (chat_summary)
    assert DL.effective(sub, {DL.KEY: DL.summary(root)})


def test_policy_defaults_to_on():
    assert DL.enabled({}) and DL.enabled({"credentials_policy": {"allow_central": True}})
    assert not DL.enabled({"credentials_policy": {"lock_chats": False}})


def test_closed_credentials_by_recorded_id_survive_renaming_and_deleting():
    creds = {"c1": {"id": "c1", "name": "Cloud (umbenannt)"}, "c2": CREDS["c2"]}
    msg = _tool("dav_read", {"zugang": "Nextcloud"}, cred_ids=["c1"])
    assert [c["id"] for c in DL.closed_creds(msg, creds)] == ["c1"]
    # gelöscht: unbekannt, also gesperrt
    assert [c["id"] for c in DL.closed_creds(_tool("dav_read", {}, cred_ids=["weg"]), creds)] == ["weg"]
    # freigegebener Zugang zählt nicht
    assert DL.closed_creds(_tool("dav_read", {"zugang": "Wetter"}, cred_ids=["c2"]), creds) == []


def test_closed_credentials_from_names_and_placeholders_in_older_calls():
    assert [c["id"] for c in DL.closed_creds(_tool("dav_read", {"zugang": "nextcloud"}), CREDS)] == ["c1"]
    msg = _tool("http_request", {"url": "https://x", "headers": {"A": "{{cred:Nextcloud:password}}"}})
    assert [c["id"] for c in DL.closed_creds(msg, CREDS)] == ["c1"]
    assert DL.closed_creds(_tool("web_search", {"q": "x"}), CREDS) == []


def test_hits_only_for_successful_calls():
    assert DL.hits(_tool("dav_read", {"zugang": "Nextcloud"}, status="error"), CREDS, SKILLS) == []
    assert DL.hits(_tool("dav_read", {"zugang": "Nextcloud"}, status="denied"), CREDS, SKILLS) == []
    assert DL.hits({"role": "assistant", "content": "zugang Nextcloud"}, CREDS, SKILLS) == []
    assert DL.hits(_tool("dav_read", {"zugang": "Nextcloud"}), CREDS, SKILLS) == [("cred", "Nextcloud")]
    assert DL.hits(_tool("dav_read", {"zugang": "Wetter"}), CREDS, SKILLS) == []


def test_hits_for_data_rules_and_internal_skills():
    assert DL.hits(_tool("dav_read", {"zugang": "Wetter"}, ext_block="Finanzen"), CREDS, SKILLS) == [("rule", "Finanzen")]
    assert DL.hits(_tool("skill_load", {"name": "personalakte"}), CREDS, SKILLS) == [("skill", "Personalakte")]
    assert DL.hits(_tool("skill_file", {"name": "s1", "datei": "a.txt"}), CREDS, SKILLS) == [("skill", "Personalakte")]
    assert DL.hits(_tool("llmitmir_info", {"teil": "skill", "name": "Personalakte"}), CREDS, SKILLS) == [("skill", "Personalakte")]
    assert DL.hits(_tool("llmitmir_info", {"teil": "projekt", "name": "Personalakte"}), CREDS, SKILLS) == []
    assert DL.hits(_tool("skill_load", {"name": "Stil"}), CREDS, SKILLS) == []


def test_old_histories_are_scanned_once():
    chat = {"messages": [{"role": "user", "content": "hallo"}, _tool("dav_read", {"zugang": "Nextcloud"})]}
    assert DL.scan(chat, CREDS, SKILLS, 3.0) and DL.locked(chat)
    assert not DL.scan(chat, CREDS, SKILLS, 4.0)  # markiert: nichts mehr zu tun
    free = {"messages": [_tool("dav_read", {"zugang": "Wetter"})]}
    assert DL.scan(free, CREDS, SKILLS, 3.0) and not DL.locked(free) and free[DL.KEY] == DL.fresh()
    assert not DL.scan(free, CREDS, SKILLS, 4.0)  # schon durchsucht
    # eine spätere Freigabe des Zugangs hebt die Markierung nicht auf
    DL.scan(chat, {"c1": dict(CREDS["c1"], external=True)}, SKILLS, 5.0)
    assert DL.locked(chat)


def test_plain_language_reason():
    rs = [{"kind": "cred", "name": "Nextcloud"}, {"kind": "skill", "name": "Personalakte"},
          {"kind": "rule", "name": "Finanzen"}, {"kind": "cred", "name": "Mail"}]
    text = DL.why(rs)
    assert "Zugang „Nextcloud“" in text and "Skill „Personalakte“" in text and "1 weitere" in text
    assert "neuen Chat" in text
    assert "Teilaufgabe" in DL.why([{"kind": "sub", "name": ""}])


def test_placeholder_names_are_found_as_they_are_resolved():
    """Platzhalter werden in den Texten selbst gesucht (wie beim Einsetzen), nicht in ihrer JSON-Form."""
    for value in ("{{cred:Nextcloud\t:password}}", "{{cred: nextcloud\n:password}}"):
        msg = _tool("http_request", {"url": "https://x.example/", "header": {"A": value}})
        assert DL.creds_in_args(msg["args"]) and [c["id"] for c in DL.closed_creds(msg, CREDS)] == ["c1"]
        assert DL.hits(msg, CREDS, SKILLS) == [(DL.KIND_CRED, "Nextcloud")]
