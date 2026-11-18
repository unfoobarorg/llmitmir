"""Generic HTTP requests with credential placeholders.

Zugangsdaten gehen nur an die Server des Zugangs (credentials.hosts). Für jeden anderen Server fragt LLMitMir im Chat
vorher nach (``gate`` → agent.execute); was dort erlaubt wurde, steht in ``ctx.approved_hosts``. Unbeaufsichtigte Läufe
fragen nicht. Der Handler prüft selbst noch einmal – ohne Freigabe verlässt kein Geheimnis LLMitMir.
"""
from __future__ import annotations

import json
import re

import aiohttp

from .. import credentials as C
from . import Tool, obj, register


def _used(ctx, a: dict) -> list[dict]:
    return C.creds_in(ctx.creds, a.get("url"), a.get("header"), a.get("inhalt"), zugang=a.get("zugang") or None)


def _target(ctx, a: dict) -> str:
    """Die Adresse, an die die Anfrage geht (Platzhalter in der Adresse aufgelöst, damit der Server feststeht)."""
    return C.resolve_placeholders(str(a.get("url") or ""), ctx.creds, ctx.allowed_creds)


def gate(ctx, a: dict) -> dict | None:
    """Zugänge für einen Server, der für sie (noch) nicht erlaubt ist? Dann vorher fragen."""
    try:
        url = _target(ctx, a)
    except (PermissionError, KeyError):
        return None  # der Handler meldet den Fehler
    foreign = C.foreign_creds(_used(ctx, a), url, getattr(ctx, "approved_hosts", None))
    if not foreign:
        return None
    return {"host": C.host_of(url), "url": url, "creds": foreign}


async def http_request(ctx, a: dict):
    methode = str(a.get("methode") or "GET").upper()
    url = _target(ctx, a)
    if not re.match(r"^https?://", url):
        return "Fehler: nur http(s)"
    from . import web as W

    if (b := await W.blocked(ctx, url)):
        return b
    used = _used(ctx, a)
    if a.get("zugang"):
        c = C.find(ctx.creds, a["zugang"])
        if not c or (ctx.allowed_creds is not None and c["id"] not in ctx.allowed_creds):
            return f"Fehler: Zugang „{a['zugang']}“ nicht verfügbar"
        if C.is_gwdg(c):  # sonst ließe sich „nur lesen“ mit einer freien Anfrage umgehen
            return "Fehler: " + C.GWDG_NO_SECRET
    foreign = C.foreign_creds(used, url, getattr(ctx, "approved_hosts", None))
    if foreign:
        raise PermissionError(C.foreign_host_error(foreign, url))
    headers = {str(k): C.resolve_placeholders(str(v), ctx.creds, ctx.allowed_creds) for k, v in (a.get("header") or {}).items()}
    auth = None
    if a.get("zugang"):
        h, auth = C.auth_for(C.find(ctx.creds, a["zugang"]))
        headers.update(h)
    body = a.get("inhalt")
    kw = {}
    if isinstance(body, (dict, list)):
        kw["data"] = C.resolve_placeholders(json.dumps(body, ensure_ascii=False), ctx.creds, ctx.allowed_creds)
        headers.setdefault("Content-Type", "application/json")
    elif body is not None:
        kw["data"] = C.resolve_placeholders(str(body), ctx.creds, ctx.allowed_creds)
    res = await W.fetch(ctx, methode, url, limit=5_000_000, credentialed=bool(used), headers=headers, auth=auth,
                        timeout=aiohttp.ClientTimeout(total=90), **kw)
    if res.get("error"):
        return res["error"]
    raw, cut, ctype, status = res["data"], res["cut"], res["ctype"], res["status"]
    extra = {}
    if res.get("redirect_not_followed"):
        extra["weiterleitung"] = res["redirect_not_followed"]
        extra["hinweis"] = "Weiterleitung auf einen anderen Server nicht gefolgt – dorthin gehen keine Zugangsdaten."
    if a.get("speichern_als"):
        info = await ctx.store.async_write_file("chat", ctx.files_id, a["speichern_als"], raw)
        await ctx.emit_files()
        return {"status": status, "gespeichert": info, **({"gekuerzt": "nach 5 MB abgeschnitten"} if cut else {}), **extra}
    if "json" in ctype:
        try:
            return {"status": status, "json": json.loads(raw), **extra}
        except ValueError:
            pass
    if ctype.startswith(("image/", "application/pdf")):
        from .files import extract_document

        return {"status": status, "inhalt": await extract_document(ctx, url.rsplit("/", 1)[-1], raw, ctype), **extra}
    return {"status": status, "content_type": ctype, "antwort": raw.decode("utf-8", "ignore")[:60_000], **extra}


register(Tool("http_request", "http",
              "HTTP-Anfrage an eine API. Authentifizierung über „zugang“ (Name) oder Platzhalter {{cred:Name:feld}} in URL, "
              "Header oder Inhalt – Geheimnisse nie selbst einsetzen. Ein Zugang geht nur an seine Server (siehe "
              "credentials_list, „server“); für einen anderen fragt LLMitMir die Person vorher.",
              obj({"methode": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]},
                   "url": {"type": "string"}, "header": {"type": "object"}, "inhalt": {},
                   "zugang": {"type": "string"}, "speichern_als": {"type": "string"}}, ["url"]),
              http_request, write=lambda a: str(a.get("methode") or "GET").upper() not in ("GET", "HEAD"),
              label="HTTP-Anfrage", icon="mdi:api", gate=gate))
