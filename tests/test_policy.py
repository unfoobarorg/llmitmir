"""Zugänge: Freigabe je Agent und Einstufung (policy.py)."""
from __future__ import annotations

import pytest
from _lm import load

P = load("policy")


def test_scope_is_required_for_new_credentials_and_kept_for_old_ones():
    with pytest.raises(ValueError, match="Art des Zugangs"):
        P.clean_scope(None, False)
    assert P.clean_scope(None, False, required=False) is None
    assert P.clean_scope("", False, old="personal") == "personal"
    assert P.clean_scope("eigener", False) == "dedicated"
    assert P.clean_scope("Persoenlich", False) == "personal"
    assert P.clean_scope("dedicated", False) == "dedicated"
    with pytest.raises(ValueError, match="Unbekannte Art"):
        P.clean_scope("geteilt", False)


def test_central_credentials_need_the_admins_permission():
    with pytest.raises(ValueError, match="nicht erlaubt"):
        P.clean_scope("zentral", False)
    assert P.clean_scope("zentral", True) == "central"
    # ein vorhandener zentraler Zugang lässt sich weiter bearbeiten (er bleibt gesperrt, solange es verboten ist)
    assert P.clean_scope("central", False, old="central") == "central"
    assert P.locked({"scope": "central"}, False) and not P.locked({"scope": "central"}, True)
    assert not P.locked({"scope": "personal"}, False) and not P.locked({}, False)


def test_hints_name_the_type_and_warn_about_personal_and_central():
    assert "App-Passwort" in P.scope_hint("webdav", "dedicated")
    assert "alle deine Rechte" in P.scope_hint("bearer", "personal")
    assert "Notfall" in P.scope_hint("unbekannt", "central")


@pytest.mark.parametrize("kw,expected", [
    ({}, (P.ASK, "")),
    ({"chat": {"cred_ok": ["k1"]}}, (P.ALLOW, "chat")),
    ({"root": {"cred_ok": ["k1"]}}, (P.ALLOW, "chat")),                         # Teilaufgabe: Hauptchat hat erlaubt
    ({"chat": {"cred_ok": ["k2"]}}, (P.ASK, "")),
    ({"project": {"credentials": ["k1"]}}, (P.ALLOW, "project")),
    ({"task": {"cred_allow": ["k1"]}}, (P.ALLOW, "task")),
    ({"task": {}}, (P.DENY, "task")),                                             # unbeaufsichtigt: nie fragen
    ({"task": {}, "project": {"credentials": ["k1"]}}, (P.ALLOW, "project")),     # Projekt gilt auch für Aufgaben
    ({"chat": {"cred_ok": ["k1"]}, "run_no": {"k1"}}, (P.DENY, "run")),           # in diesem Lauf abgelehnt
    ({"run_ok": {"k1"}}, (P.ALLOW, "run")),
])
def test_cred_verdict(kw, expected):
    assert P.cred_verdict("k1", **kw) == expected


def test_grant_and_revoke_for_a_chat():
    chat: dict = {}
    assert P.grant(chat, "k1") and not P.grant(chat, "k1")
    assert chat["cred_ok"] == ["k1"]
    assert P.revoke(chat, "k1") and not P.revoke(chat, "k1") and chat["cred_ok"] == []


def test_existing_tasks_keep_their_credentials_after_the_update():
    meta = {"credentials": {"k2": {"id": "k2"}, "k1": {"id": "k1"}},
            "tasks": {"t1": {"id": "t1"}, "t2": {"id": "t2", "cred_allow": []}}}
    assert P.migrate_tasks(meta) == 1
    assert meta["tasks"]["t1"]["cred_allow"] == ["k1", "k2"] and meta["tasks"]["t1"]["cred_allow_migrated"]
    assert meta["tasks"]["t2"] == {"id": "t2", "cred_allow": []}
    assert P.migrate_tasks(meta) == 0  # nur einmal
    empty = {"credentials": {}, "tasks": {"t": {"id": "t"}}}
    assert P.migrate_tasks(empty) == 1 and "cred_allow_migrated" not in empty["tasks"]["t"]


def test_task_credential_lists_accept_names_and_ids():
    creds = {"k1": {"id": "k1", "name": "Wolke"}, "k2": {"id": "k2", "name": "Post"}}
    assert P.clean_cred_allow(["wolke", "k2", "Wolke"], creds) == ["k1", "k2"]
    assert P.clean_cred_allow(None, creds) == []
    with pytest.raises(ValueError, match="gibt es nicht"):
        P.clean_cred_allow(["Bank"], creds)
