"""Nutzerverwaltung mit AD/LDAP (idm.py): Einstellungen, Einträge, Plan, Schutz des letzten Admins."""
from __future__ import annotations

import pytest
from _lm import load

IDM = load("idm")

MAPS = [{"group": "CN=HA-Nutzer,OU=Gruppen,DC=example,DC=org", "admin": False, "llmitmir": True},
        {"group": "CN=HA-Admins,OU=Gruppen,DC=example,DC=org", "admin": True, "llmitmir": True},
        {"group": "CN=Nur-HA,OU=Gruppen,DC=example,DC=org", "admin": False, "llmitmir": False}]


def test_settings_are_validated_and_the_password_masked():
    cfg = IDM.clean({"enabled": True, "server": "ldaps://dc.example.org", "bind_dn": "CN=svc", "bind_password": "pw",
                     "base_dn": "DC=example,DC=org", "mappings": MAPS + [{"group": " "}]})
    assert len(cfg["mappings"]) == 3 and cfg["attr_username"] == "sAMAccountName" and cfg["auth_provider"] == "command_line"
    assert IDM.view(cfg)["bind_password"] == "•••"
    assert IDM.clean(dict(cfg, bind_password="•••"), cfg)["bind_password"] == "pw"
    for bad, msg in [({"enabled": True, "server": "ldap://dc"}, "ldaps"),
                     ({"enabled": True, "server": "ldaps://dc", "mappings": []}, "Gruppen-Zuordnung"),
                     ({"enabled": True, "server": "ldaps://dc", "mappings": MAPS}, "Bind-Konto")]:
        with pytest.raises(ValueError, match=msg):
            IDM.clean(bad)
    assert IDM.clean({})["enabled"] is False


def test_ldap_entries():
    e = IDM.entry_from_ldap({"sAMAccountName": ["Niko"], "displayName": "Niko M.", "memberOf": [MAPS[0]["group"]],
                             "userAccountControl": "514"}, {})
    assert e == {"username": "niko", "name": "Niko M.", "groups": [MAPS[0]["group"]], "disabled": True}
    assert IDM.entry_from_ldap({"displayName": "ohne Konto"}, {}) is None


def test_wanted_by_group():
    assert IDM.wanted({"groups": [MAPS[1]["group"].upper()]}, MAPS) == {"admin": True, "llmitmir": True}
    assert IDM.wanted({"groups": [MAPS[2]["group"]]}, MAPS) == {"admin": False, "llmitmir": False}
    assert IDM.wanted({"groups": ["CN=Andere"]}, MAPS) is None
    assert IDM.wanted({"groups": [MAPS[0]["group"]], "disabled": True}, MAPS) is None


def _entry(user, *groups, name=None, disabled=False):
    return {"username": user, "name": name or user.title(), "groups": [MAPS[i]["group"] for i in groups], "disabled": disabled}


def test_plan():
    cfg = {"mappings": MAPS, "managed": {"anna": "u-anna", "bernd": "u-bernd", "carla": "u-carla", "weg": "u-weg"}}
    users = [{"id": "u-niko", "name": "Niko", "is_admin": True, "is_active": True, "usernames": ["Niko"]},  # von Hand
             {"id": "u-anna", "name": "Anna", "is_admin": False, "is_active": True},
             {"id": "u-bernd", "name": "Bernd", "is_admin": False, "is_active": False},
             {"id": "u-carla", "name": "Carla", "is_admin": True, "is_active": True},
             {"id": "u-weg", "name": "Weg", "is_admin": False, "is_active": True}]
    entries = [_entry("niko", 0), _entry("anna", 1, name="Anna B."), _entry("bernd", 2), _entry("carla", 0, disabled=True),
               _entry("dora", 0)]
    acts = {(a["action"], a["username"]): a for a in IDM.plan(entries, cfg, users, ["u-anna"])}
    assert ("create", "dora") in acts and acts[("create", "dora")]["llmitmir"] and not acts[("create", "dora")]["admin"]
    assert acts[("update", "anna")]["admin"] is True and acts[("update", "anna")]["name"] == "Anna B."
    assert ("reactivate", "bernd") in acts and ("allow", "bernd") not in acts       # Gruppe ohne LLMitMir
    assert acts[("deactivate", "carla")]["reason"] == "im Verzeichnis gesperrt"
    assert acts[("deactivate", "weg")]["reason"] == "nicht mehr im Verzeichnis"
    assert [a for a in acts if a[1] == "niko"] == [("skip", "niko")]                  # unverwaltet: nie angefasst
    assert ("disallow", "anna") not in acts


def test_the_last_admin_is_protected():
    cfg = {"mappings": MAPS, "managed": {"carla": "u-carla"}}
    users = [{"id": "u-carla", "name": "Carla", "is_admin": True, "is_active": True}]
    acts = IDM.plan([_entry("carla", 0)], cfg, users, [])
    assert acts[0]["action"] == "skip" and "letzter aktiver Admin" in acts[0]["reason"]
    acts = IDM.plan([], cfg, users, [])
    assert acts[0]["action"] == "skip"
    two = users + [{"id": "u-x", "name": "X", "is_admin": True, "is_active": True}]
    assert IDM.plan([], cfg, two, [])[0]["action"] == "deactivate"
