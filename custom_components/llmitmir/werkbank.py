"""Client for the optional LLMitMir-Werkbank (sandboxed command execution on a separate machine)."""
from __future__ import annotations

import urllib.parse

import aiohttp


class WerkbankError(Exception):
    pass


class Werkbank:
    def __init__(self, session: aiohttp.ClientSession, url: str, token: str) -> None:
        self.s = session
        self.url = url.rstrip("/")
        self.h = {"Authorization": f"Bearer {token}"}

    async def _req(self, method: str, path: str, timeout: float = 60, raw: bool = False, **kw):
        try:
            async with self.s.request(method, f"{self.url}{path}", headers=self.h,
                                      timeout=aiohttp.ClientTimeout(total=timeout), **kw) as r:
                body = await r.read()
                if r.status >= 400:
                    raise WerkbankError(f"Werkbank HTTP {r.status}: {body[:300].decode(errors='ignore')}")
                if raw:
                    return body
                return await r.json(content_type=None) if body else {}
        except (aiohttp.ClientError, TimeoutError) as e:
            raise WerkbankError(f"Werkbank nicht erreichbar ({type(e).__name__}: {e})") from e

    async def health(self) -> dict:
        return await self._req("GET", "/v1/health", timeout=15)

    async def session(self, key: str) -> dict:
        return await self._req("POST", f"/v1/sessions/{key}", timeout=120)

    async def exec(self, key: str, cmd: str, timeout: int, workdir: str = "/workspace") -> dict:
        return await self._req("POST", f"/v1/sessions/{key}/exec", timeout=timeout + 90,
                               json={"cmd": cmd, "timeout": timeout, "workdir": workdir})

    async def put(self, key: str, path: str, data: bytes) -> dict:
        return await self._req("PUT", f"/v1/sessions/{key}/files?path={urllib.parse.quote(path)}", timeout=300, data=data)

    async def get(self, key: str, path: str) -> bytes:
        return await self._req("GET", f"/v1/sessions/{key}/files?path={urllib.parse.quote(path)}", timeout=300, raw=True)

    async def list(self, key: str, path: str) -> dict:
        return await self._req("GET", f"/v1/sessions/{key}/list?path={urllib.parse.quote(path)}", timeout=60)

    async def delete(self, key: str) -> None:
        await self._req("DELETE", f"/v1/sessions/{key}", timeout=30)
