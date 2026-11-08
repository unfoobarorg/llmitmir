"""Credentials ("Zugänge"): types, placeholder resolution and scrubbing.

The model never sees secret values. Tools take the *name* of a credential and inject
authentication server-side; free-form requests may contain placeholders
``{{cred:<name>:<field>}}`` which are replaced right before the request is sent.
Every tool result is scrubbed of all secret values of the user.
"""
from __future__ import annotations

import re
from typing import Any

# type -> (fields in order, secret fields)
TYPES: dict[str, dict[str, Any]] = {
    "webdav": {"label": "Nextcloud / WebDAV / CalDAV", "fields": ["url", "username", "password", "share_token"],
               "secret": {"password"}, "hint": "url = Basis-URL, z. B. https://cloud.example.org (oder Freigabe-Link)"},
    "basic": {"label": "HTTP Basic Auth", "fields": ["url", "username", "password"], "secret": {"password"}},
    "bearer": {"label": "Bearer-Token", "fields": ["url", "token"], "secret": {"token"}},
    "header": {"label": "API-Key im Header", "fields": ["url", "header", "key"], "secret": {"key"}},
    "telegram": {"label": "Telegram-Bot", "fields": ["token", "chat_ids"], "secret": {"token"}},
    "imap": {"label": "E-Mail (IMAP/SMTP)", "fields": ["imap_host", "smtp_host", "username", "password"], "secret": {"password"}},
    "other": {"label": "Sonstiges (Schlüssel/Wert)", "fields": [], "secret": set()},
}

PLACEHOLDER = re.compile(r"\{\{\s*cred:([^:}]+):([A-Za-z0-9_]+)\s*\}\}")


def secret_fields(cred: dict) -> set[str]:
    t = TYPES.get(cred.get("type") or "other", TYPES["other"])
    extra = set(cred.get("secret_fields") or [])
    return set(t["secret"]) | extra


def find(creds: dict[str, dict], name_or_id: str) -> dict | None:
    if not name_or_id:
        return None
    if name_or_id in creds:
        return creds[name_or_id]
    low = str(name_or_id).strip().casefold()
    for c in creds.values():
        if str(c.get("name", "")).casefold() == low:
            return c
    return None


def describe_for_model(creds: dict[str, dict], allowed: set[str] | None = None) -> list[dict]:
    """Non-secret overview for the system prompt."""
    out = []
    for c in creds.values():
        if allowed is not None and c["id"] not in allowed:
            continue
        sec = secret_fields(c)
        out.append({"name": c.get("name"), "typ": c.get("type"),
                    "felder": {k: (v if k not in sec else "(geheim)") for k, v in (c.get("fields") or {}).items() if v},
                    "notiz": (c.get("notes") or "")[:300]})
    return out


def resolve_placeholders(text: str, creds: dict[str, dict], allowed: set[str] | None = None) -> str:
    def rep(m: re.Match) -> str:
        c = find(creds, m.group(1))
        if not c or (allowed is not None and c["id"] not in allowed):
            raise PermissionError(f"Zugang „{m.group(1)}“ nicht verfügbar")
        val = (c.get("fields") or {}).get(m.group(2))
        if val is None:
            raise KeyError(f"Zugang „{m.group(1)}“ hat kein Feld „{m.group(2)}“")
        return str(val)

    return PLACEHOLDER.sub(rep, text) if isinstance(text, str) else text


def secret_values(creds: dict[str, dict]) -> list[str]:
    vals = []
    for c in creds.values():
        for k in secret_fields(c):
            v = (c.get("fields") or {}).get(k)
            if v and len(str(v)) >= 4:
                vals.append(str(v))
    return sorted(set(vals), key=len, reverse=True)


def scrub(text: str, secrets_: list[str]) -> str:
    if not isinstance(text, str):
        return text
    for s in secrets_:
        if s in text:
            text = text.replace(s, "•••")
    return text


def scrub_obj(obj: Any, secrets_: list[str]) -> Any:
    """``scrub`` for every string in a nested structure (requests to external models)."""
    if not secrets_:
        return obj
    if isinstance(obj, str):
        return scrub(obj, secrets_)
    if isinstance(obj, list):
        return [scrub_obj(x, secrets_) for x in obj]
    if isinstance(obj, dict):
        return {k: (v if k in ("signature", "data") else scrub_obj(v, secrets_)) for k, v in obj.items()}
    return obj


def auth_for(cred: dict) -> tuple[dict, Any]:
    """Headers and aiohttp BasicAuth for a credential."""
    import aiohttp

    f = cred.get("fields") or {}
    t = cred.get("type")
    if t in ("webdav", "basic", "imap"):
        user = f.get("username") or f.get("share_token") or ""
        return {}, aiohttp.BasicAuth(user, f.get("password") or "")
    if t == "bearer":
        return {"Authorization": f"Bearer {f.get('token', '')}"}, None
    if t == "header":
        return {f.get("header") or "X-API-Key": f.get("key", "")}, None
    return {}, None
