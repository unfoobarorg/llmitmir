"""Generic HTTP requests with credential placeholders."""
from __future__ import annotations

import json
import re

import aiohttp

from .. import credentials as C
from . import Tool, obj, read_body, register


async def http_request(ctx, a: dict):
    methode = str(a.get("methode") or "GET").upper()
    url = C.resolve_placeholders(str(a.get("url") or ""), ctx.creds, ctx.allowed_creds)
    if not re.match(r"^https?://", url):
        return "Fehler: nur http(s)"
    from .web import blocked_url

    if (b := blocked_url(ctx, url)):
        return b
    headers = {str(k): C.resolve_placeholders(str(v), ctx.creds, ctx.allowed_creds) for k, v in (a.get("header") or {}).items()}
    auth = None
    if a.get("zugang"):
        c = C.find(ctx.creds, a["zugang"])
        if not c or (ctx.allowed_creds is not None and c["id"] not in ctx.allowed_creds):
            return f"Fehler: Zugang „{a['zugang']}“ nicht verfügbar"
        if C.is_gwdg(c):  # sonst ließe sich „nur lesen“ mit einer freien Anfrage umgehen
            return "Fehler: " + C.GWDG_NO_SECRET
        h, auth = C.auth_for(c)
        headers.update(h)
    body = a.get("inhalt")
    kw = {}
    if isinstance(body, (dict, list)):
        kw["data"] = C.resolve_placeholders(json.dumps(body, ensure_ascii=False), ctx.creds, ctx.allowed_creds)
        headers.setdefault("Content-Type", "application/json")
    elif body is not None:
        kw["data"] = C.resolve_placeholders(str(body), ctx.creds, ctx.allowed_creds)
    async with ctx.session.request(methode, url, headers=headers, auth=auth, timeout=aiohttp.ClientTimeout(total=90),
                                   **kw) as r:
        raw, cut = await read_body(r, 5_000_000)
        ctype = r.headers.get("content-type", "")
        status = r.status
    if a.get("speichern_als"):
        info = await ctx.store.async_write_file("chat", ctx.chat_id, a["speichern_als"], raw)
        await ctx.emit_files()
        return {"status": status, "gespeichert": info, **({"gekuerzt": "nach 5 MB abgeschnitten"} if cut else {})}
    if "json" in ctype:
        try:
            return {"status": status, "json": json.loads(raw)}
        except ValueError:
            pass
    if ctype.startswith(("image/", "application/pdf")):
        from .files import extract_document

        return {"status": status, "inhalt": await extract_document(ctx, url.rsplit("/", 1)[-1], raw, ctype)}
    return {"status": status, "content_type": ctype, "antwort": raw.decode("utf-8", "ignore")[:60_000]}


register(Tool("http_request", "http",
              "HTTP-Anfrage an eine API. Authentifizierung über „zugang“ (Name) oder Platzhalter {{cred:Name:feld}} in URL, Header oder Inhalt – Geheimnisse nie selbst einsetzen.",
              obj({"methode": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]},
                   "url": {"type": "string"}, "header": {"type": "object"}, "inhalt": {},
                   "zugang": {"type": "string"}, "speichern_als": {"type": "string"}}, ["url"]),
              http_request, write=lambda a: str(a.get("methode") or "GET").upper() not in ("GET", "HEAD"),
              label="HTTP-Anfrage", icon="mdi:api"))
