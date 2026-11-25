"""Trusted-AI-Zentrale (auditexport.py): Export-Einstellungen, Syslog-Format, Senden, Auffälligkeiten, Entzug."""
from __future__ import annotations

import asyncio
import json

import pytest
from _lm import load

AX = load("auditexport")


def test_export_settings_are_validated_and_the_token_masked():
    cfg = AX.clean({"webhook": {"enabled": True, "url": "https://siem.example.org/in", "token": "Bearer abc"},
                    "syslog": {"enabled": True, "host": "log.example.org", "protocol": "tls"}, "kinds": ["tool", "nix"]})
    assert cfg["syslog"]["port"] == 6514 and cfg["kinds"] == ["tool"] and cfg["webhook"]["header"] == "Authorization"
    assert AX.view(cfg)["webhook"]["token"] == "•••" and cfg["webhook"]["token"] == "Bearer abc"
    again = AX.clean({"webhook": {"enabled": True, "url": "https://siem.example.org/in", "token": "•••"}}, cfg)
    assert again["webhook"]["token"] == "Bearer abc" and again["kinds"] == list(AX.KINDS)
    for bad, msg in [({"webhook": {"enabled": True, "url": "http://x"}}, "https"), ({"syslog": {"enabled": True}}, "Server"),
                     ({"syslog": {"port": "viel"}}, "Zahl")]:
        with pytest.raises(ValueError, match=msg):
            AX.clean(bad)


def test_syslog_line_is_rfc5424():
    ev = {"ts": 0, "kind": "tool", "outcome": "denied", "user": "u1", "tool": "dav_read"}
    line = AX.syslog_line(ev, "ha host")
    assert line.startswith("<132>1 1970-01-01T00:00:00.000Z hahost llmitmir - tool - {")
    assert json.loads(line.split(" - tool - ", 1)[1]) == ev
    assert AX.syslog_line({"ts": 0, "kind": "run"}, "h").startswith("<134>")
    assert AX.wanted({"kinds": ["tool"]}, [ev, {"kind": "run"}]) == [ev]


def test_syslog_over_tcp_uses_octet_counting():
    async def go():
        got = []

        async def handle(reader, writer):
            got.append(await reader.read(65536))
            writer.close()

        server = await asyncio.start_server(handle, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        await AX.send_syslog({"host": "127.0.0.1", "port": port, "protocol": "tcp"}, [{"ts": 0, "kind": "tool"}], "h")
        await asyncio.sleep(0.05)
        server.close()
        await server.wait_closed()
        data = b"".join(got).decode()
        n, rest = data.split(" ", 1)
        assert int(n) == len(rest.encode()) and rest.startswith("<134>1 ")

    asyncio.run(go())


class _Resp:
    def __init__(self, status):
        self.status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, status):
        self.status, self.calls = status, []

    def post(self, url, **kw):
        self.calls.append((url, kw))
        return _Resp(self.status)


def test_webhook():
    async def go():
        s = _Session(204)
        await AX.send_webhook(s, {"url": "https://siem.example.org", "token": "t", "header": "X-Key"}, [{"kind": "tool"}])
        assert s.calls[0][1]["headers"]["X-Key"] == "t" and s.calls[0][1]["json"]["events"] == [{"kind": "tool"}]
        with pytest.raises(ValueError, match="500"):
            await AX.send_webhook(_Session(500), {"url": "https://x"}, [])

    asyncio.run(go())


def _ev(ts, user="u1", **kw):
    return {"ts": ts, "kind": kw.pop("kind", "tool"), "user": user, **kw}


def test_anomalies():
    now = 100 * 86400.0
    before = [_ev(now - 2 * 86400 - i, target={"host": "alt.example"}) for i in range(14)]
    recent = [_ev(now - 100 - i, agent_kind="cowork") for i in range(80)]
    recent += [_ev(now - 50, outcome="denied") for _ in range(25)]
    recent += [_ev(now - 60, target={"host": "neu.example"})]
    found = {a["kind"]: a for a in AX.anomalies(before + recent, now, tz_hour=lambda ts: 3)}
    assert set(found) == {"volume", "denied", "new_hosts", "night"}
    assert "neu.example" in found["new_hosts"]["text"] and "alt.example" not in found["new_hosts"]["text"]
    quiet = AX.anomalies(before + [_ev(now - 10)], now, tz_hour=lambda ts: 12)
    assert quiet == []


def test_revoke():
    chat = {"cred_ok": ["k1", "k2"]}
    assert AX.revoke(chat, {"k1"}, "cred_ok") and chat["cred_ok"] == ["k2"]
    assert not AX.revoke(chat, {"k9"}, "cred_ok")
