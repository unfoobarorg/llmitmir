"""LLMitMir-Werkbank: runs commands for LLMitMir in isolated, per-chat sandbox containers.

Talks to the local Docker Engine over its unix socket. One sandbox container per session key
(LLMitMir uses the chat id), created on demand from SANDBOX_IMAGE, removed after IDLE_TIMEOUT.

API (all endpoints need "Authorization: Bearer <WERKBANK_TOKEN>"):
  GET    /v1/health                           version, limits, running sessions
  POST   /v1/sessions/{key}                   create/resume the sandbox of a session
  POST   /v1/sessions/{key}/exec              {"cmd": "...", "timeout": 120, "workdir": "/workspace"}
  GET    /v1/sessions/{key}/files?path=...    download one file
  PUT    /v1/sessions/{key}/files?path=...    upload one file (raw body)
  GET    /v1/sessions/{key}/list?path=...     list a directory (recursive, max 2000 entries)
  DELETE /v1/sessions/{key}                   remove the sandbox
"""
from __future__ import annotations

import asyncio
import hmac
import io
import json
import logging
import os
import re
import tarfile
import time
from posixpath import normpath

import aiohttp
from aiohttp import web

VERSION = "0.1.0"
TOKEN = os.environ.get("WERKBANK_TOKEN", "")
SANDBOX_IMAGE = os.environ.get("SANDBOX_IMAGE", "llmitmir-werkbank-sandbox:latest")
MEMORY = os.environ.get("SANDBOX_MEMORY", "3g")
CPUS = float(os.environ.get("SANDBOX_CPUS", "2"))
PIDS = int(os.environ.get("SANDBOX_PIDS", "512"))
NETWORK = os.environ.get("SANDBOX_NETWORK", "bridge")          # "bridge" (Internet) or "none"
IDLE = int(os.environ.get("IDLE_TIMEOUT", "7200"))              # seconds without use until removal
MAX_SESSIONS = int(os.environ.get("MAX_SESSIONS", "6"))
MAX_TIMEOUT = int(os.environ.get("MAX_EXEC_TIMEOUT", "3600"))
MAX_OUTPUT = int(os.environ.get("MAX_OUTPUT", "200000"))
DOCKER = "http://docker/v1.43"
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

log = logging.getLogger("werkbank")
last_used: dict[str, float] = {}
locks: dict[str, asyncio.Lock] = {}


def _bytes(v: str) -> int:
    m = re.fullmatch(r"(\d+(?:\.\d+)?)([kmg]?)b?", v.strip().lower())
    if not m:
        raise ValueError(v)
    return int(float(m.group(1)) * {"": 1, "k": 1024, "m": 1024 ** 2, "g": 1024 ** 3}[m.group(2)])


def _path(p: str) -> str:
    p = normpath("/workspace/" + p) if not str(p).startswith("/") else normpath(p)
    if not (p == "/workspace" or p.startswith("/workspace/") or p.startswith("/tmp/")):
        raise web.HTTPBadRequest(text="Pfad muss unter /workspace oder /tmp liegen")
    return p


class Docker:
    def __init__(self) -> None:
        self.s = aiohttp.ClientSession(connector=aiohttp.UnixConnector(path="/var/run/docker.sock"))

    async def req(self, method: str, path: str, ok=(200, 201, 204), **kw):
        async with self.s.request(method, DOCKER + path, **kw) as r:
            body = await r.read()
            if r.status not in ok:
                raise web.HTTPBadGateway(text=f"Docker {method} {path}: {r.status} {body[:300].decode(errors='ignore')}")
            if r.content_type == "application/json" and body:
                return json.loads(body)
            return body

    async def container(self, key: str) -> dict | None:
        try:
            return await self.req("GET", f"/containers/lmwb-{key}/json")
        except web.HTTPBadGateway as e:
            if " 404 " in str(e.text):
                return None
            raise

    async def sessions(self) -> list[dict]:
        flt = json.dumps({"label": ["llmitmir.werkbank=1"]})
        return await self.req("GET", "/containers/json", params={"all": "1", "filters": flt})

    async def ensure(self, key: str) -> tuple[str, bool]:
        c = await self.container(key)
        if c and c["State"]["Running"]:
            return c["Id"], False
        if not c:
            running = [x for x in await self.sessions() if x["State"] == "running"]
            if len(running) >= MAX_SESSIONS:
                oldest = min(running, key=lambda x: last_used.get(x["Labels"].get("llmitmir.session", ""), 0))
                await self.req("DELETE", f"/containers/{oldest['Id']}", params={"force": "1"})
            body = {
                "Image": SANDBOX_IMAGE, "Cmd": ["sleep", "infinity"], "User": "1000:1000", "WorkingDir": "/workspace",
                "Labels": {"llmitmir.werkbank": "1", "llmitmir.session": key},
                "Env": ["HOME=/workspace/.home", "PIP_CACHE_DIR=/cache/pip", "HF_HOME=/cache/hf", "XDG_CACHE_HOME=/cache",
                        "PYTHONUSERBASE=/workspace/.home/.local", "LANG=C.UTF-8", "TZ=" + os.environ.get("TZ", "Europe/Berlin")],
                "HostConfig": {
                    "Memory": _bytes(MEMORY), "NanoCpus": int(CPUS * 1e9), "PidsLimit": PIDS,
                    "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"], "NetworkMode": NETWORK,
                    "Mounts": [{"Type": "volume", "Source": "llmitmir-werkbank-cache", "Target": "/cache"}],
                    "Tmpfs": {"/tmp": "rw,nosuid,size=2g"}, "Init": True,
                },
            }
            await self.req("POST", "/containers/create", params={"name": f"lmwb-{key}"}, json=body)
        await self.req("POST", f"/containers/lmwb-{key}/start", ok=(204, 304))
        await self.exec(key, "mkdir -p /workspace/.home /workspace/skills", 30)
        return f"lmwb-{key}", True

    async def exec(self, key: str, cmd: str, timeout: int, workdir: str = "/workspace", stdin: bytes | None = None) -> dict:
        timeout = max(1, min(int(timeout), MAX_TIMEOUT))
        e = await self.req("POST", f"/containers/lmwb-{key}/exec", json={
            "Cmd": ["timeout", "--signal=KILL", str(timeout), "bash", "-lc", cmd], "AttachStdout": True,
            "AttachStderr": True, "WorkingDir": workdir, "Tty": False})
        t0 = time.monotonic()
        out, err = bytearray(), bytearray()
        async with self.s.post(f"{DOCKER}/exec/{e['Id']}/start", json={"Detach": False, "Tty": False},
                               timeout=aiohttp.ClientTimeout(total=timeout + 30)) as r:
            buf = b""
            async for chunk in r.content.iter_any():
                buf += chunk
                while len(buf) >= 8:
                    kind, size = buf[0], int.from_bytes(buf[4:8], "big")
                    if len(buf) < 8 + size:
                        break
                    data, buf = buf[8:8 + size], buf[8 + size:]
                    target = out if kind == 1 else err
                    if len(target) < MAX_OUTPUT:
                        target += data[: MAX_OUTPUT - len(target)]
        info = await self.req("GET", f"/exec/{e['Id']}/json")
        code = info.get("ExitCode")
        return {"exit_code": code, "timed_out": code == 137 and time.monotonic() - t0 >= timeout - 1,
                "seconds": round(time.monotonic() - t0, 2),
                "stdout": out.decode("utf-8", "replace"), "stderr": err.decode("utf-8", "replace"),
                "truncated": len(out) >= MAX_OUTPUT or len(err) >= MAX_OUTPUT}

    async def put_file(self, key: str, path: str, data: bytes) -> None:
        d, name = path.rsplit("/", 1)
        await self.exec(key, f"mkdir -p '{d}'", 30)
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tar:
            ti = tarfile.TarInfo(name)
            ti.size, ti.uid, ti.gid, ti.mode, ti.mtime = len(data), 1000, 1000, 0o644, int(time.time())
            tar.addfile(ti, io.BytesIO(data))
        await self.req("PUT", f"/containers/lmwb-{key}/archive", params={"path": d}, data=buf.getvalue(),
                       headers={"Content-Type": "application/x-tar"})

    async def get_file(self, key: str, path: str) -> bytes:
        raw = await self.req("GET", f"/containers/lmwb-{key}/archive", params={"path": path})
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            m = next((x for x in tar.getmembers() if x.isfile()), None)
            if m is None:
                raise web.HTTPBadRequest(text="Keine Datei (Ordner?)")
            return tar.extractfile(m).read()


def auth(handler):
    async def wrapped(request: web.Request):
        got = request.headers.get("Authorization", "")
        if not TOKEN or not hmac.compare_digest(got, f"Bearer {TOKEN}"):
            raise web.HTTPUnauthorized(text="Token fehlt oder falsch")
        return await handler(request)
    return wrapped


def _key(request: web.Request) -> str:
    key = request.match_info["key"]
    if not KEY_RE.match(key):
        raise web.HTTPBadRequest(text="Ungültiger Sitzungsname")
    last_used[key] = time.time()
    return key


@auth
async def health(request):
    d: Docker = request.app["docker"]
    img = await d.req("GET", f"/images/{SANDBOX_IMAGE}/json", ok=(200, 404))
    sess = await d.sessions()
    return web.json_response({"ok": True, "version": VERSION, "sandbox_image": SANDBOX_IMAGE,
                              "sandbox_image_ready": isinstance(img, dict) and "Id" in img,
                              "sessions": len([s for s in sess if s["State"] == "running"]), "max_sessions": MAX_SESSIONS,
                              "limits": {"memory": MEMORY, "cpus": CPUS, "network": NETWORK, "idle_timeout": IDLE,
                                         "max_exec_timeout": MAX_TIMEOUT}})


@auth
async def create(request):
    key = _key(request)
    async with locks.setdefault(key, asyncio.Lock()):
        cid, created = await request.app["docker"].ensure(key)
    return web.json_response({"session": key, "created": created})


@auth
async def run(request):
    key = _key(request)
    body = await request.json()
    d: Docker = request.app["docker"]
    async with locks.setdefault(key, asyncio.Lock()):
        await d.ensure(key)
    res = await d.exec(key, str(body.get("cmd") or "true"), int(body.get("timeout") or 120), _path(body.get("workdir") or "/workspace"))
    last_used[key] = time.time()
    return web.json_response(res)


async def _ensure(request, key):
    async with locks.setdefault(key, asyncio.Lock()):
        await request.app["docker"].ensure(key)


@auth
async def files_get(request):
    key = _key(request)
    await _ensure(request, key)
    data = await request.app["docker"].get_file(key, _path(request.query.get("path", "")))
    return web.Response(body=data, content_type="application/octet-stream")


@auth
async def files_put(request):
    key = _key(request)
    d: Docker = request.app["docker"]
    async with locks.setdefault(key, asyncio.Lock()):
        await d.ensure(key)
    data = await request.read()
    path = _path(request.query.get("path", ""))
    await d.put_file(key, path, data)
    return web.json_response({"ok": True, "path": path, "size": len(data)})


@auth
async def listing(request):
    key = _key(request)
    p = _path(request.query.get("path", "/workspace"))
    await _ensure(request, key)
    r = await request.app["docker"].exec(key, f"find '{p}' -path '*/.home' -prune -o -printf '%y\\t%s\\t%T@\\t%p\\n' | head -2000", 60)
    items = []
    for line in r["stdout"].splitlines():
        parts = line.split("\t", 3)
        if len(parts) == 4:
            items.append({"type": "dir" if parts[0] == "d" else "file", "size": int(parts[1]),
                          "modified": int(float(parts[2])), "path": parts[3]})
    return web.json_response({"path": p, "items": items})


@auth
async def remove(request):
    key = _key(request)
    await request.app["docker"].req("DELETE", f"/containers/lmwb-{key}", ok=(204, 404), params={"force": "1"})
    last_used.pop(key, None)
    return web.json_response({"ok": True})


async def janitor(app):
    d: Docker = app["docker"]
    while True:
        try:
            now = time.time()
            for c in await d.sessions():
                key = c["Labels"].get("llmitmir.session", "")
                seen = last_used.get(key) or c.get("Created", now)
                if now - seen > IDLE:
                    await d.req("DELETE", f"/containers/{c['Id']}", ok=(204, 404), params={"force": "1"})
                    last_used.pop(key, None)
                    log.info("removed idle session %s", key)
        except Exception:  # noqa: BLE001
            log.exception("janitor")
        await asyncio.sleep(300)


async def on_start(app):
    app["docker"] = Docker()
    app["janitor"] = asyncio.create_task(janitor(app))


async def on_stop(app):
    app["janitor"].cancel()
    await app["docker"].s.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if len(TOKEN) < 24:
        raise SystemExit("WERKBANK_TOKEN fehlt oder ist zu kurz (mindestens 24 Zeichen).")
    app = web.Application(client_max_size=200 * 1024 * 1024)
    app.add_routes([web.get("/v1/health", health), web.post("/v1/sessions/{key}", create),
                    web.post("/v1/sessions/{key}/exec", run), web.get("/v1/sessions/{key}/files", files_get),
                    web.put("/v1/sessions/{key}/files", files_put), web.get("/v1/sessions/{key}/list", listing),
                    web.delete("/v1/sessions/{key}", remove)])
    app.on_startup.append(on_start)
    app.on_cleanup.append(on_stop)
    web.run_app(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8787")), access_log=None)


if __name__ == "__main__":
    main()
