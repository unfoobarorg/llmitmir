"""Konnektoren (connectors.py): Katalog des Admins, Verbindung je Person, Sperre, Login Flow v2."""
from __future__ import annotations

import asyncio

import pytest
from _lm import load

CN = load("connectors")
C = load("credentials")

NC = {"name": "Nextcloud", "type": "webdav", "fixed": {"url": "https://cloud.example.org"}, "login": "nextcloud_flow",
      "hosts": ["office.example.org"], "instructions": "Teamordner liegen unter /Gruppen."}


def test_catalog_is_validated():
    out = CN.clean([NC, {"name": "Wetter", "type": "bearer", "fixed": {"url": "https://api.wetter.example"}}])
    assert [k["login"] for k in out] == ["nextcloud_flow", "form"] and out[0]["hosts"] == ["office.example.org"]
    assert CN.user_fields("webdav", out[0]["fixed"]) == ["username", "password", "share_token"]
    assert CN.user_fields("bearer", out[1]["fixed"]) == ["token"]
    for bad, msg in [({"name": "X", "type": "webdav", "fixed": {"password": "geheim"}}, "geheime Feld"),
                     ({"name": "X", "type": "nix"}, "unbekannter Typ"), ({"type": "webdav"}, "Namen"),
                     ({"name": "X", "type": "bearer", "login": "nextcloud_flow"}, "Login Flow"),
                     ({"name": "X", "type": "bearer", "fixed": {"quatsch": "1"}}, "gibt es beim Typ")]:
        with pytest.raises(ValueError, match=msg):
            CN.clean([bad])
    with pytest.raises(ValueError, match="doppelt"):
        CN.clean([NC, dict(NC)])
    gw = CN.clean([{"name": "Uni", "type": "gwdg", "services": ["calendar", "nix"]}])[0]
    assert gw["services"] == ["calendar"]


def test_connection_uses_fixed_fields_and_own_fields_only():
    k = CN.clean([NC])[0]
    raw = CN.connection_raw(k, {"username": "niko", "password": "app-pw", "url": "https://evil.example"})
    assert raw["fields"] == {"username": "niko", "password": "app-pw", "url": "https://cloud.example.org"}
    assert raw["scope"] == "dedicated" and raw["hosts"] == ["office.example.org"] and raw["name"] == "Nextcloud"


def test_enforce_and_sync_follow_the_admin():
    cfg = {"connectors": CN.clean([NC])}
    k = cfg["connectors"][0]
    meta = {"credentials": {"k1": {"id": "k1", "name": "Nextcloud", "connector_id": k["id"], "scope": "personal",
                                   "fields": {"url": "https://alt.example", "username": "niko"}, "hosts": [], "check": {"ok": True}},
                            "k2": {"id": "k2", "name": "Frei", "fields": {"url": "https://x"}}}}
    assert CN.sync(meta, cfg) == 1
    c = meta["credentials"]["k1"]
    assert c["fields"]["url"] == "https://cloud.example.org" and c["scope"] == "dedicated" and "check" not in c
    assert c["hosts"] == ["office.example.org"] and CN.sync(meta, cfg) == 0
    assert meta["credentials"]["k2"]["fields"] == {"url": "https://x"}


def test_locked_free_and_names():
    cfg = {"connectors": CN.clean([NC, dict(NC, name="Aus", enabled=False)])}
    on, off = cfg["connectors"]
    assert not CN.locked({"connector_id": on["id"]}, cfg)
    assert CN.locked({"connector_id": off["id"]}, cfg) and CN.locked({"connector_id": "weg"}, cfg)
    assert not CN.locked({}, cfg)
    assert CN.free_allowed({}) and not CN.free_allowed({"credentials_policy": {"free_credentials": False}})
    assert [k["name"] for k in CN.enabled(cfg)] == ["Nextcloud"]
    creds = {"a": {"id": "a", "name": "Nextcloud"}}
    assert CN.unique_name(creds, "Nextcloud") == "Nextcloud (2)" and CN.unique_name(creds, "Nextcloud", "a") == "Nextcloud"


def test_prompt_section_and_public_view():
    cfg = {"connectors": CN.clean([NC])}
    k = cfg["connectors"][0]
    text = CN.prompt_section({"k1": {"id": "k1", "name": "Meine Cloud", "connector_id": k["id"]}}, cfg)
    assert "### Nextcloud (Zugang „Meine Cloud“)" in text and "/Gruppen" in text
    assert CN.prompt_section({"k2": {"id": "k2", "name": "Frei"}}, cfg) == ""
    view = CN.public_view(k)
    assert "instructions" not in view and view["user_fields"] == ["username", "password", "share_token"]


def test_several_connections_skill_and_owner_hint():
    k = CN.clean([NC])[0]
    creds = {"a": {"id": "a", "name": "Cloud B", "connector_id": k["id"], "created": 2},
             "b": {"id": "b", "name": "Cloud A", "connector_id": k["id"], "created": 1}, "c": {"id": "c", "name": "Frei"}}
    assert [c["id"] for c in CN.connections_of(creds, k["id"])] == ["b", "a"]
    skills = {"s1": {"id": "s1", "name": "Cloud A nutzen", "connection_id": "b"}, "s2": {"id": "s2", "name": "frei"}}
    assert CN.skill_of(skills, "b")["id"] == "s1" and CN.skill_of(skills, "a") is None
    hint = CN.owner_hint(dict(creds["a"]), {"connectors": [k]}, "Der Zugang")
    assert "„Cloud B“" in hint and "„Nextcloud“" in hint and "Konnektoren" in hint


def test_options_after_connecting():
    nc = CN.clean([NC])[0]
    cred = {"type": "webdav", "connector_id": nc["id"]}
    assert CN.clean_options(nc, cred, {"readonly": 1, "external": 0, "valid_until": "2027-03-01", "access": {"mail": "write"}}) == \
        {"readonly": True, "external": False, "valid_until": "2027-03-01"}
    with pytest.raises(ValueError, match="JJJJ"):
        CN.clean_options(nc, cred, {"valid_until": "1.3.2027"})
    gw = CN.clean([{"name": "Uni", "type": "gwdg", "services": ["mail", "calendar"]}])[0]
    gcred = {"type": "gwdg", "services": ["mail", "calendar"]}
    out = CN.clean_options(gw, gcred, {"access": {"mail": "write", "contacts": "write"}, "readonly": True})
    assert out == {"access": {"mail": "write", "calendar": "read"}}  # Exchange: je Dienst, kein „readonly“
    assert CN.options_text({**gcred, **out}) .startswith("Rechte: E-Mail-Postfach: lesen und schreiben, Kalender: nur lesen")
    assert "nur lesen" in CN.options_text({"type": "webdav", "readonly": True})
    assert C.read_only({"type": "webdav", "readonly": True}) and not C.read_only({"type": "gwdg", "readonly": True})


def test_setup_prompt_uses_the_admin_guide_and_type_labels():
    gw = CN.clean([{"name": "Uni-Mail", "type": "gwdg", "services": ["mail"], "setup": "Kennung steht im Uni-Portal."}])[0]
    text = CN.setup_prompt(gw, None, None, "Niko")
    assert "Uni-Portal" in text and "E-Mail-Adresse, Benutzerkennung, Passwort" in text
    assert "konnektor_verbinden" in text and "konnektor_skill" in text and "nur eine Frage" in text
    nc = CN.clean([NC])[0]
    cred = {"id": "k1", "name": "Meine Cloud", "type": "webdav", "readonly": True}
    text = CN.setup_prompt(nc, cred, {"name": "Cloud-Regeln"}, "Niko")
    assert "Login Flow" in text and "„Meine Cloud“" in text and "Cloud-Regeln" in text and "Keine eigene Anleitung" in text


def test_nextcloud_base():
    assert CN.nextcloud_base("https://cloud.example.org/remote.php/dav/") == "https://cloud.example.org"
    assert CN.nextcloud_base("https://example.org/nc/") == "https://example.org/nc"
    with pytest.raises(ValueError, match="https"):
        CN.nextcloud_base("http://cloud.example.org")


class _Resp:
    def __init__(self, status, data=None):
        self.status, self._data = status, data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def json(self, content_type=None):
        return self._data


class _Session:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def post(self, url, **kw):
        self.calls.append((url, kw))
        return self.answers.pop(0)


def test_login_flow_start_and_poll():
    async def go():
        start = _Session([_Resp(200, {"poll": {"token": "tok", "endpoint": "https://cloud.example.org/login/v2/poll"},
                                      "login": "https://cloud.example.org/login/v2/flow/abc"})])
        info = await CN.flow_start(start, "https://cloud.example.org")
        assert info == {"login": "https://cloud.example.org/login/v2/flow/abc",
                        "endpoint": "https://cloud.example.org/login/v2/poll", "token": "tok"}
        assert start.calls[0][0] == "https://cloud.example.org/index.php/login/v2"
        evil = _Session([_Resp(200, {"poll": {"token": "t", "endpoint": "https://evil.example/poll"},
                                     "login": "https://cloud.example.org/x"})])
        with pytest.raises(ValueError, match="anderen Server"):
            await CN.flow_start(evil, "https://cloud.example.org")
        for login, endpoint in (("javascript://cloud.example.org/%0Aalert(1)", "https://cloud.example.org/poll"),
                                ("https://cloud.example.org/x", "http://cloud.example.org/poll")):
            odd = _Session([_Resp(200, {"poll": {"token": "t", "endpoint": endpoint}, "login": login})])
            with pytest.raises(ValueError, match="anderen Server"):
                await CN.flow_start(odd, "https://cloud.example.org")
        poll = _Session([_Resp(404), _Resp(200, {"server": "https://cloud.example.org", "loginName": "niko",
                                                 "appPassword": "app-123"})])
        assert await CN.flow_poll(poll, info["endpoint"], "tok") is None
        assert await CN.flow_poll(poll, info["endpoint"], "tok") == {"username": "niko", "password": "app-123"}
        assert poll.calls[0][1]["data"] == {"token": "tok"}
        with pytest.raises(ValueError):
            await CN.flow_poll(_Session([_Resp(500)]), info["endpoint"], "tok")

    asyncio.run(go())
    assert CN.flow_expired(0, now_ts=CN.FLOW_TIMEOUT + 1) and not CN.flow_expired(0, now_ts=10)
