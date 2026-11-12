"""Credentials ("Zugänge"): types, placeholder resolution and scrubbing.

The model never sees secret values. Tools take the *name* of a credential and inject
authentication server-side; free-form requests may contain placeholders
``{{cred:<name>:<field>}}`` which are replaced right before the request is sent.
Every tool result is scrubbed of all secret values of the user.
"""
from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

# So viele Tage vor dem Ablaufdatum warnt die Oberfläche (und ein fehlgeschlagener Aufruf nennt den Grund)
EXPIRY_WARN_DAYS = 14

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
    # GWDG-Exchange (Uni-Konto) – wie in calmerge gibt die Person nur E-Mail-Adresse und Passwort an und wählt, wofür der
    # Zugang gilt (Postfach, Kalender, Kontakte). Die Adressen dazu (DavMail, IMAP/SMTP) ergänzt LLMitMir beim Speichern.
    "gwdg": {"label": "GWDG-Exchange (Uni-Konto)", "fields": ["username", "password"], "secret": {"password"},
             "services": {"mail": "E-Mail-Postfach", "calendar": "Kalender", "contacts": "Kontakte"},
             "service_fields": {"mail": ["imap_host", "smtp_host"], "calendar": ["url"], "contacts": ["contacts_url"]},
             "default_services": ["calendar"],
             "readonly": ["url", "contacts_url", "imap_host", "smtp_host"],
             "labels": {"username": "GWDG-E-Mail-Adresse", "password": "Passwort", "url": "Kalender-Adresse (DavMail)",
                        "contacts_url": "Kontakte-Adresse (DavMail)", "imap_host": "IMAP-Server", "smtp_host": "SMTP-Server"},
             "placeholders": {"username": "vorname.nachname@gwdg.de", "url": "Wird automatisch aus deiner E-Mail-Adresse erzeugt",
                              "contacts_url": "Wird automatisch aus deiner E-Mail-Adresse erzeugt"},
             "hint": "Dein Konto im GWDG-Exchange. Trag nur deine GWDG-E-Mail-Adresse und dein Passwort ein und wähl, wofür "
                     "der Zugang gilt – ohne @ wird @gwdg.de ergänzt, die Server-Adressen setzt LLMitMir selbst."},
}

GWDG_DAVMAIL = "https://davmail.gwdg.de:1080"
GWDG_IMAP = "email.gwdg.de:993"  # Exchange-IMAP der GWDG (SSL)
GWDG_SMTP = "email.gwdg.de:587"  # Versand mit STARTTLS
GWDG_USAGE = ("Kalender: caldav_events (ohne kalender). Kontakte: dav_request REPORT/PROPFIND auf contacts/. "
              "Postfach: IMAP/SMTP in der Werkbank mit {{cred:<Name>:username}} und {{cred:<Name>:password}}.")


def gwdg_email(value: str) -> str:
    """GWDG-Benutzername als E-Mail-Adresse: ohne @ wird @gwdg.de ergänzt, alles klein (wie calmerge)."""
    v = str(value or "").strip()
    if not v:
        return ""
    if "@" not in v:
        v += "@gwdg.de"
    return v.lower()


def gwdg_root(email: str) -> str:
    """DavMail-Stamm eines GWDG-Kontos (darunter liegen calendar/, contacts/, inbox/ …)."""
    import urllib.parse

    return f"{GWDG_DAVMAIL}/users/{urllib.parse.quote(email, safe='@')}/"


def gwdg_url(email: str) -> str:
    """Kalender-Adresse im DavMail-Gateway der GWDG – dieselbe, die calmerge erzeugt."""
    return gwdg_root(email) + "calendar/"


def is_gwdg(cred: dict) -> bool:
    """GWDG-Exchange-Zugang: eigener Typ oder (ältere Zugänge) eine DavMail-Adresse der GWDG als URL."""
    return cred.get("type") == "gwdg" or "davmail.gwdg.de:1080" in str((cred.get("fields") or {}).get("url") or "")


def gwdg_account(cred: dict) -> tuple[str, str]:
    """(E-Mail, DavMail-Stamm) eines GWDG-Zugangs. Bei älteren WebDAV-Zugängen mit DavMail-URL kommt die Adresse aus der
    URL, falls kein Benutzername eingetragen ist."""
    f = cred.get("fields") or {}
    email = gwdg_email(f.get("username") or "")
    if not email:
        m = re.search(r"davmail\.gwdg\.de:1080/users/([^/]+)", str(f.get("url") or ""))
        if m:
            import urllib.parse

            email = gwdg_email(urllib.parse.unquote(m.group(1)))
    return email, (gwdg_root(email) if email else "")


def services(cred: dict) -> list[str]:
    """Wofür ein GWDG-Zugang gilt (Postfach, Kalender, Kontakte). Ältere WebDAV-Zugänge mit DavMail-URL: Kalender."""
    known = TYPES["gwdg"]["services"]
    if cred.get("type") != "gwdg":
        return ["calendar"] if is_gwdg(cred) else []
    picked = cred.get("services")
    if picked is None:
        picked = TYPES["gwdg"]["default_services"]
    return [k for k in known if k in picked]


def normalize_fields(typ: str, fields: dict, picked: list[str] | None = None) -> dict:
    """Felder vor dem Speichern vereinheitlichen. GWDG: E-Mail-Adresse normalisieren, die Adressen der gewählten Dienste
    daraus erzeugen und die der abgewählten entfernen."""
    if typ != "gwdg":
        return fields
    t = TYPES["gwdg"]
    auto = {k for ks in t["service_fields"].values() for k in ks}
    # leere Reste eines anderen Typs und alle automatisch erzeugten Felder weg – die gewählten kommen gleich neu dazu
    out = {k: v for k, v in fields.items() if k in t["fields"] or (k not in auto and str(v or "").strip())}
    email = gwdg_email(out.get("username") or "")
    out["username"] = email
    picked = t["default_services"] if picked is None else picked
    if email:
        if "calendar" in picked:
            out["url"] = gwdg_url(email)
        if "contacts" in picked:
            out["contacts_url"] = gwdg_root(email) + "contacts/"
        if "mail" in picked:
            out["imap_host"], out["smtp_host"] = GWDG_IMAP, GWDG_SMTP
    return out


PLACEHOLDER = re.compile(r"\{\{\s*cred:([^:}]+):([A-Za-z0-9_]+)\s*\}\}")


def secret_fields(cred: dict) -> set[str]:
    t = TYPES.get(cred.get("type") or "other", TYPES["other"])
    extra = set(cred.get("secret_fields") or [])
    return set(t["secret"]) | extra


def expiry(cred: dict, today: "date | None" = None) -> dict:
    """Ablauf eines Zugangs: {"date": "JJJJ-MM-TT", "days": n, "expired": bool, "soon": bool}.

    ``days`` ist negativ, wenn das Datum vorbei ist. Ohne Ablaufdatum ist alles None/False.
    """
    raw = str(cred.get("valid_until") or "").strip()
    if not raw:
        return {"date": "", "days": None, "expired": False, "soon": False}
    try:
        until = date.fromisoformat(raw[:10])
    except ValueError:
        return {"date": raw, "days": None, "expired": False, "soon": False}
    days = (until - (today or date.today())).days
    return {"date": until.isoformat(), "days": days, "expired": days < 0, "soon": 0 <= days <= EXPIRY_WARN_DAYS}


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
        item = {"name": c.get("name"), "typ": c.get("type"),
                "felder": {k: (v if k not in sec else "(geheim)") for k, v in (c.get("fields") or {}).items() if v},
                "notiz": (c.get("notes") or "")[:300]}
        if is_gwdg(c):
            # wofür die Person den GWDG-Zugang freigegeben hat – und womit das Modell ihn nutzt
            item["dienste"] = [TYPES["gwdg"]["services"][k] for k in services(c)]
            item["nutzung"] = GWDG_USAGE
        out.append(item)
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


def variants(value: str) -> set[str]:
    """The forms in which a secret can come back from a service: as is, URL-encoded, JSON- or HTML-escaped and in
    Base64 (standard and URL-safe, with and without padding)."""
    import base64
    import html
    import urllib.parse

    v = str(value)
    out = {v, urllib.parse.quote(v, safe=""), urllib.parse.quote_plus(v), json.dumps(v)[1:-1], html.escape(v)}
    raw = v.encode()
    for enc in (base64.b64encode(raw).decode(), base64.urlsafe_b64encode(raw).decode()):
        out |= {enc, enc.rstrip("=")}
    return {x for x in out if len(x) >= 4}


def secret_values(creds: dict[str, dict]) -> list[str]:
    """Everything to black out: each secret in all its forms, plus Basic-Auth credentials (user:password in Base64)."""
    import base64

    vals: set[str] = set()
    for c in creds.values():
        f = c.get("fields") or {}
        for k in secret_fields(c):
            v = f.get(k)
            if v and len(str(v)) >= 4:
                vals |= variants(str(v))
        if c.get("type") in ("webdav", "basic", "imap", "gwdg") and f.get("password"):
            user = f.get("username") or f.get("share_token") or ""
            pair = base64.b64encode(f"{user}:{f['password']}".encode()).decode()
            vals |= {pair, pair.rstrip("=")}
    return sorted(vals, key=len, reverse=True)


def note_use(cred: dict, model: str | None = None, external: bool = False, ts: float | None = None) -> dict:
    """Zaehlt eine Nutzung des Zugangs fuer die Anzeige auf der Seite „Zugaenge“.

    ``uses``/``last_used`` zaehlen jede Nutzung durch ein Werkzeug, ``ext_uses``/``ext_last`` nur die durch
    kostenpflichtige externe Modelle (dort zusaetzlich ``ext_uses_since`` seit der letzten Geheimnis-Aenderung).
    """
    import time

    ts = round(time.time(), 3) if ts is None else ts
    cred["uses"] = int(cred.get("uses") or 0) + 1
    cred["last_used"] = ts
    if model:
        cred["last_model"] = model
    if external:
        cred["ext_uses_since"] = int(cred.get("ext_uses_since", cred.get("ext_uses")) or 0) + 1
        cred["ext_uses"] = int(cred.get("ext_uses") or 0) + 1
        cred["ext_last"] = ts
        cred["ext_last_since"] = ts
        if model:
            cred["ext_last_model"] = model
    return cred


def secret_changes(old: dict, new: dict) -> bool:
    """True if a secret field of a Zugang got another value (or was removed): the old form is no longer valid."""
    sec = secret_fields(old) | secret_fields(new)
    of, nf = old.get("fields") or {}, new.get("fields") or {}
    return any((of.get(k) or "") != (nf.get(k) or "") for k in sec if of.get(k))


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
    if t == "gwdg":
        return {}, aiohttp.BasicAuth(gwdg_email(f.get("username") or ""), f.get("password") or "")
    if t in ("webdav", "basic", "imap"):
        user = f.get("username") or f.get("share_token") or ""
        return {}, aiohttp.BasicAuth(user, f.get("password") or "")
    if t == "bearer":
        return {"Authorization": f"Bearer {f.get('token', '')}"}, None
    if t == "header":
        return {f.get("header") or "X-API-Key": f.get("key", "")}, None
    return {}, None
