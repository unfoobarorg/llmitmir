"""MCP-Server als Konnektortyp: ein kleiner Client für entfernte Server (Streamable HTTP, JSON-RPC 2.0).

Der Admin richtet einen Konnektor mit der Adresse eines MCP-Servers ein, ruft dessen Werkzeuge einmal ab und gibt sie
einzeln frei – die Liste ist danach **eingefroren**: Beschreibungen und Parameter kommen aus der Freigabe, nicht vom
Server, sodass ein veränderter Server weder neue Werkzeuge noch neue Texte (Prompt-Injection) einschleusen kann. Je
Werkzeug legt der Admin fest, ob es schreibt (dann fragt LLMitMir wie bei anderen schreibenden Werkzeugen).

Jede Person verbindet den Konnektor mit ihrem eigenen Token (Nutzerkontext). Aufrufe laufen wie alle anderen durch
Freigabe je Agent, Datenregeln und Zugriffsprotokoll. Nur entfernte Server über https – keine lokalen Prozesse.

HA-frei; die HTTP-Sitzung kommt von außen.
"""
from __future__ import annotations

import json
import re
from typing import Any

from . import credentials as C

PROTOCOL = "2025-06-18"
TYPES = ("bearer", "header", "basic")   # Zugangstypen, mit denen ein MCP-Konnektor angemeldet wird
MAX_TOOLS = 40
DESC_MAX = 1024
RESULT_MAX = 60_000


class McpError(Exception):
    pass


def slug(text: str, n: int = 20) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", str(text or "").lower()).strip("_")
    return s[:n] or "x"


def tool_name(connector: dict, tool: str) -> str:
    """Name des Werkzeugs für das Modell: mcp_<Konnektor>_<Werkzeug>, höchstens 64 Zeichen."""
    return f"mcp_{slug(connector['name'], 16)}_{slug(tool, 40)}"[:64]


def _schema(raw: Any) -> dict:
    if not isinstance(raw, dict) or raw.get("type") != "object":
        return {"type": "object", "properties": {}}
    return {"type": "object", "properties": raw.get("properties") or {}, "required": list(raw.get("required") or [])}


def clean_tools(raw: Any) -> list[dict]:
    """Eingefrorene Werkzeugliste aus der Freigabe des Admins."""
    out, seen = [], set()
    for t in raw if isinstance(raw, list) else []:
        if not isinstance(t, dict) or not str(t.get("name") or "").strip():
            continue
        name = str(t["name"]).strip()[:100]
        if name in seen:
            continue
        seen.add(name)
        out.append({"name": name, "description": str(t.get("description") or "")[:DESC_MAX],
                    "input_schema": _schema(t.get("input_schema") or t.get("inputSchema")),
                    "write": bool(t.get("write")), "enabled": t.get("enabled", True) is not False})
    if len(out) > MAX_TOOLS:
        raise ValueError(f"Höchstens {MAX_TOOLS} Werkzeuge je MCP-Server.")
    return out


def from_server(tools: list[dict]) -> list[dict]:
    """Werkzeuge, wie der Server sie meldet → Vorschlag für die Freigabe (schreibend, außer readOnlyHint)."""
    out = []
    for t in tools:
        ann = t.get("annotations") or {}
        out.append({"name": t.get("name"), "description": t.get("description") or "", "input_schema": t.get("inputSchema"),
                    "write": not bool(ann.get("readOnlyHint")), "enabled": False})
    return clean_tools(out)


def headers_for(cred: dict | None) -> tuple[dict, Any]:
    if not cred:
        return {}, None
    return C.auth_for(cred)


def _parse_body(text: str, ctype: str, want_id: int) -> dict:
    """JSON oder Server-Sent Events: die Antwort mit der passenden ID."""
    if "text/event-stream" in (ctype or ""):
        for block in re.split(r"\r?\n\r?\n", text):
            data = "\n".join(line[5:].lstrip() for line in block.splitlines() if line.startswith("data:"))
            if not data:
                continue
            try:
                msg = json.loads(data)
            except ValueError:
                continue
            if isinstance(msg, dict) and msg.get("id") == want_id:
                return msg
        raise McpError("Keine Antwort im Ereignisstrom des Servers.")
    msg = json.loads(text or "{}")
    if isinstance(msg, list):
        msg = next((m for m in msg if isinstance(m, dict) and m.get("id") == want_id), {})
    return msg


class Client:
    """Eine MCP-Sitzung: initialize, dann tools/list oder tools/call."""

    def __init__(self, session, url: str, cred: dict | None = None, timeout: int = 120) -> None:
        if not str(url or "").startswith("https://"):
            raise McpError("MCP-Server nur über https.")
        self.session, self.url, self.timeout = session, url, timeout
        self.headers, self.auth = headers_for(cred)
        self.sid: str | None = None
        self._id = 0

    async def _post(self, payload: dict, notify: bool = False) -> dict | None:
        h = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
             "MCP-Protocol-Version": PROTOCOL, "User-Agent": "LLMitMir", **self.headers}
        if self.sid:
            h["Mcp-Session-Id"] = self.sid
        async with self.session.post(self.url, json=payload, headers=h, auth=self.auth, timeout=self.timeout,
                                     allow_redirects=False) as r:
            if r.headers.get("Mcp-Session-Id"):
                self.sid = r.headers["Mcp-Session-Id"]
            if r.status in (401, 403):
                raise McpError(f"Der MCP-Server lehnt die Anmeldung ab (HTTP {r.status}) – Token prüfen.")
            if notify:
                return None
            if r.status >= 400:
                raise McpError(f"MCP-Server: HTTP {r.status}")
            text = await r.text()
            msg = _parse_body(text, r.headers.get("Content-Type", ""), payload["id"])
        if msg.get("error"):
            err = msg["error"]
            raise McpError(f"MCP-Fehler {err.get('code')}: {str(err.get('message') or '')[:300]}")
        return msg.get("result") or {}

    async def request(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        return await self._post({"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}) or {}

    async def open(self) -> dict:
        res = await self.request("initialize", {"protocolVersion": PROTOCOL, "capabilities": {},
                                                "clientInfo": {"name": "LLMitMir", "version": "1"}})
        await self._post({"jsonrpc": "2.0", "method": "notifications/initialized"}, notify=True)
        return res

    async def list_tools(self) -> list[dict]:
        await self.open()
        tools, cursor = [], None
        for _ in range(10):
            res = await self.request("tools/list", {"cursor": cursor} if cursor else {})
            tools += [t for t in res.get("tools") or [] if isinstance(t, dict)]
            cursor = res.get("nextCursor")
            if not cursor:
                break
        return tools

    async def call(self, name: str, arguments: dict) -> tuple[str, bool]:
        if not self.sid:
            await self.open()
        res = await self.request("tools/call", {"name": name, "arguments": arguments})
        return result_text(res), bool(res.get("isError"))


def result_text(res: dict) -> str:
    """Ergebnis eines Werkzeugs als Text (Text-Teile, strukturierte Daten; Bilder und Dateien nur genannt)."""
    parts = []
    for c in res.get("content") or []:
        if not isinstance(c, dict):
            continue
        if c.get("type") == "text":
            parts.append(str(c.get("text") or ""))
        elif c.get("type") == "resource" and isinstance(c.get("resource"), dict) and c["resource"].get("text"):
            parts.append(str(c["resource"]["text"]))
        else:
            parts.append(f"[{c.get('type')}: {c.get('mimeType') or c.get('uri') or ''}]")
    if not parts and res.get("structuredContent") is not None:
        parts.append(json.dumps(res["structuredContent"], ensure_ascii=False))
    text = "\n".join(parts)
    return text[:RESULT_MAX] + ("\n… (gekürzt)" if len(text) > RESULT_MAX else "")


def clean_arguments(args: dict, schema: dict) -> dict:
    """Nur Argumente, die das eingefrorene Schema kennt (und nichts von LLMitMir selbst)."""
    props = (schema or {}).get("properties") or {}
    return {k: v for k, v in (args or {}).items() if k in props and not k.startswith("_")}
