"""Konnektoren (connectors.py): Katalog des Admins, Verbindung je Person, Sperre, Login Flow v2."""
from __future__ import annotations

import asyncio

import pytest
from _lm import load

CN = load("connectors")

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
        poll = _Session([_Resp(404), _Resp(200, {"server": "https://cloud.example.org", "loginName": "niko",
                                                 "appPassword": "app-123"})])
        assert await CN.flow_poll(poll, info["endpoint"], "tok") is None
        assert await CN.flow_poll(poll, info["endpoint"], "tok") == {"username": "niko", "password": "app-123"}
        assert poll.calls[0][1]["data"] == {"token": "tok"}
        with pytest.raises(ValueError):
            await CN.flow_poll(_Session([_Resp(500)]), info["endpoint"], "tok")

    asyncio.run(go())
    assert CN.flow_expired(0, now_ts=CN.FLOW_TIMEOUT + 1) and not CN.flow_expired(0, now_ts=10)
