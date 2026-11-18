"""Werkbank-Dienst (werkbank/server.py): Anmeldung, Pfade, Sandbox-Härtung – ohne Docker.

Tests mit ``xfail(strict=True)`` beschreiben bekannte Befunde aus der Prüfung vor Version 1.0.0 (IDs wie S5).
"""
from __future__ import annotations

import asyncio
import importlib.util
import shlex
import sys

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from _lm import ROOT

TOKEN = "t" * 32


def _server():
    spec = importlib.util.spec_from_file_location("lm_werkbank_server", ROOT / "werkbank" / "server.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    mod.TOKEN = TOKEN
    return mod


S = _server()


class FakeDocker:
    """Nimmt auf, was an die Docker-Engine ginge."""

    def __init__(self):
        self.calls, self.cmds = [], []

    async def req(self, method, path, ok=(200, 201, 204), **kw):
        self.calls.append((method, path, kw))
        if path.startswith("/containers/json"):
            return []
        if path.endswith("/json") and path.startswith("/containers/"):
            return None
        if path.startswith("/images/"):
            return {"Id": "sha256:x"}
        return {}

    async def container(self, key):
        return None

    async def sessions(self):
        return []

    async def exec(self, key, cmd, timeout, workdir="/workspace", stdin=None):
        self.cmds.append(cmd)
        return {"exit_code": 0, "stdout": "", "stderr": "", "timed_out": False, "seconds": 0, "truncated": False}

    ensure = S.Docker.ensure
    put_file = S.Docker.put_file


def _app(docker):
    app = web.Application()
    app["docker"] = docker
    app.add_routes([web.get("/v1/health", S.health), web.post("/v1/sessions/{key}/exec", S.run),
                    web.get("/v1/sessions/{key}/list", S.listing), web.put("/v1/sessions/{key}/files", S.files_put)])
    return app


async def _call(method, path, headers=None, **kw):
    docker = FakeDocker()
    async with TestClient(TestServer(_app(docker))) as client:
        resp = await client.request(method, path, headers=headers or {}, **kw)
        return resp.status, await resp.text(), docker


AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer falsch"}, {"Authorization": TOKEN},
                                     {"Authorization": f"Basic {TOKEN}"}])
def test_every_endpoint_needs_the_token(headers):
    status, _body, docker = asyncio.run(_call("GET", "/v1/health", headers))
    assert status == 401 and docker.calls == []
    status, _body, docker = asyncio.run(_call("POST", "/v1/sessions/c1/exec", headers, json={"cmd": "id"}))
    assert status == 401 and docker.cmds == []


def test_with_the_token_it_answers():
    status, body, _ = asyncio.run(_call("GET", "/v1/health", AUTH))
    assert status == 200 and '"ok": true' in body


def test_an_empty_token_never_lets_anybody_in(monkeypatch):
    monkeypatch.setattr(S, "TOKEN", "")
    status, _body, _ = asyncio.run(_call("GET", "/v1/health", {"Authorization": "Bearer "}))
    assert status == 401


def test_session_names_cannot_escape():
    status, _body, docker = asyncio.run(_call("POST", "/v1/sessions/..%2Fx/exec", AUTH, json={"cmd": "id"}))
    assert status in (400, 404) and docker.cmds == []
    for bad in ("../x", "a b", "a/b", "x" * 65, ""):
        assert not S.KEY_RE.match(bad)


@pytest.mark.parametrize("path", ["../../etc/passwd", "/etc/passwd", "/workspace/../etc", "/tmp/../root", "/"])
def test_paths_stay_in_workspace_or_tmp(path):
    with pytest.raises(web.HTTPBadRequest):
        S._path(path)


def test_relative_paths_land_in_the_workspace():
    assert S._path("a/b.txt") == "/workspace/a/b.txt"
    assert S._path("/tmp/x") == "/tmp/x" and S._path("") == "/workspace"


def test_sandbox_containers_are_locked_down():
    docker = FakeDocker()
    asyncio.run(S.Docker.ensure(docker, "c1"))
    body = next(kw["json"] for m, p, kw in docker.calls if p == "/containers/create")
    hc = body["HostConfig"]
    assert body["User"] == "1000:1000"
    assert hc["CapDrop"] == ["ALL"] and "no-new-privileges" in hc["SecurityOpt"]
    assert hc["Memory"] > 0 and hc["PidsLimit"] > 0 and hc["NanoCpus"] > 0
    assert not hc.get("Privileged") and hc["NetworkMode"] in ("bridge", "none")
    assert not any("docker.sock" in str(m) for m in hc.get("Mounts") or [])
    assert not hc.get("Binds")


@pytest.mark.xfail(strict=True, reason="S5: alle Sandboxen (aller Personen) teilen sich das Volume /cache")
def test_sandboxes_do_not_share_a_writable_cache():
    sources = []
    for key in ("chatA", "chatB"):
        docker = FakeDocker()
        asyncio.run(S.Docker.ensure(docker, key))
        body = next(kw["json"] for m, p, kw in docker.calls if p == "/containers/create")
        sources += [m["Source"] for m in body["HostConfig"].get("Mounts") or [] if not m.get("ReadOnly")]
    assert len(sources) == len(set(sources))


@pytest.mark.xfail(strict=True, reason="S9: Pfade werden ungeschützt in Shell-Befehle eingesetzt (listing, put_file)")
def test_paths_with_quotes_are_passed_to_the_shell_safely():
    path = "/workspace/it's here"
    status, _body, docker = asyncio.run(_call("GET", "/v1/sessions/c1/list", AUTH, params={"path": path}))
    assert status == 200
    find = [c for c in docker.cmds if c.startswith("find")][0]
    assert path in shlex.split(find.split("|")[0])


def test_bytes_parser_for_memory_limits():
    assert S._bytes("3g") == 3 * 1024 ** 3 and S._bytes("512m") == 512 * 1024 ** 2 and S._bytes("100") == 100
    with pytest.raises(ValueError):
        S._bytes("viel")
