"""Konnektoren: vom Admin vorbereitete Anbindungen an andere Systeme, die jede Person mit dem eigenen Konto verbindet.

Ein Konnektor ist eine Vorlage für einen Zugang: Typ (wie bei Zugängen), feste Felder, die der Admin vorgibt (z. B. die
Adresse der Nextcloud), erlaubte Server, eine Anmeldeart (Formular oder Nextcloud Login Flow v2) und optional eine
Anleitung für das Modell. Verbindet eine Person den Konnektor, entsteht ein Zugang der Art „eigener LLMitMir-Zugang“
mit ``connector_id`` – die festen Felder setzt LLMitMir bei jedem Speichern und Laden neu, die Person trägt nur ihre
eigenen Felder ein (oder bekommt sie vom Login Flow: ein App-Passwort in ihrem Nutzerkontext).

Eine Person kann denselben Konnektor mehrfach verbinden (z. B. GitLab mit je einem Token für mehrere Projekte): jede
Verbindung ist ein eigener Zugang mit eigenem Namen. Zu jeder Verbindung kann ein Skill gehören (``connection_id`` am
Skill), der festhält, wie dieser Zugang immer verwendet wird. Zugang und Skill einer Verbindung ändert die Person nur über
die Seite „Plugins → Konnektoren“ – in den Listen „Zugänge“ und „Skills“ sind sie ausgegraut, damit nichts versehentlich verloren geht.

Eingerichtet wird ein Konnektor in einem geführten Chat: Der Admin hinterlegt dafür eine Einrichtungsanleitung
(``setup``), das Modell führt Frage für Frage durch, Geheimnisse trägt die Person in ein Formular ein (``konnektor_verbinden``),
nie in den Chat. Direkt nach einer erfolgreichen Verbindung legt sie fest, wofür der Zugang verwendet werden darf.

Ist ein Konnektor ausgeschaltet oder gelöscht, sind seine Zugänge gesperrt (kein Modell sieht sie). Ob Personen
daneben noch freie Zugänge anlegen dürfen, entscheidet der Admin (``credentials_policy.free_credentials``).

HA-frei; ``flow_*`` bekommen die HTTP-Sitzung von außen.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
from typing import Any

from . import credentials as C
from . import datarules as DR

LOGIN_FORM, LOGIN_NEXTCLOUD = "form", "nextcloud_flow"
LOGINS = (LOGIN_FORM, LOGIN_NEXTCLOUD)
MAX_CONNECTORS = 30
MAX_CONNECTIONS = 10          # Verbindungen je Person und Konnektor
FLOW_TIMEOUT = 20 * 60        # so lange wartet LLMitMir auf die Anmeldung im Login Flow
FLOW_INTERVAL = 3             # Sekunden zwischen zwei Abfragen
INSTRUCTIONS_MAX = 8000


def _clip(v: Any, n: int) -> str:
    return str(v or "").strip()[:n]


def _cid(raw: dict, i: int) -> str:
    v = str(raw.get("id") or "").strip()
    if re.match(r"^[A-Za-z0-9_-]{1,40}$", v):
        return v
    return f"kn{i}-" + hashlib.sha1(json.dumps(raw, sort_keys=True, default=str).encode()).hexdigest()[:6]


def user_fields(typ: str, fixed: dict) -> list[str]:
    """Felder, die die Person selbst einträgt: alle Felder des Typs, die der Admin nicht fest vorgibt."""
    spec = C.TYPES.get(typ) or {}
    hidden = set(spec.get("hidden") or []) | set(spec.get("obsolete") or [])
    return [f for f in spec.get("fields") or [] if f not in fixed and f not in hidden]


def clean(raw: Any) -> list[dict]:
    """Konnektoren aus den Admin-Einstellungen prüfen. Geheime Felder lassen sich nicht fest vorgeben."""
    out: list[dict] = []
    seen: set[str] = set()
    for i, k in enumerate(raw if isinstance(raw, list) else []):
        if not isinstance(k, dict):
            continue
        name = _clip(k.get("name"), 80)
        typ = k.get("type")
        if not name:
            raise ValueError("Ein Konnektor braucht einen Namen.")
        if name.casefold() in seen:
            raise ValueError(f"Den Konnektor „{name}“ gibt es doppelt.")
        seen.add(name.casefold())
        if typ not in C.TYPES:
            raise ValueError(f"„{name}“: unbekannter Typ (möglich: {', '.join(C.TYPES)}).")
        spec = C.TYPES[typ]
        secret = set(spec.get("secret") or [])
        fixed = {}
        for f, v in (k.get("fixed") or {}).items():
            v = _clip(v, 500)
            if not v:
                continue
            if f in secret:
                raise ValueError(f"„{name}“: das geheime Feld „{f}“ trägt jede Person selbst ein.")
            if f not in spec.get("fields", []) and typ != "other":
                raise ValueError(f"„{name}“: Feld „{f}“ gibt es beim Typ {spec['label']} nicht.")
            fixed[str(f)[:60]] = v
        login = k.get("login") if k.get("login") in LOGINS else LOGIN_FORM
        if login == LOGIN_NEXTCLOUD and (typ != "webdav" or not fixed.get("url")):
            raise ValueError(f"„{name}“: Der Nextcloud Login Flow braucht den Typ Nextcloud/WebDAV mit fester Adresse.")
        mcp = None
        if k.get("mcp"):
            from . import mcp as MCP

            if typ not in MCP.TYPES or not str(fixed.get("url") or "").startswith("https://"):
                raise ValueError(f"„{name}“: Ein MCP-Server braucht den Typ Bearer-Token, API-Key oder Basic Auth und eine "
                                 "feste https-Adresse.")
            mcp = {"tools": MCP.clean_tools((k.get("mcp") or {}).get("tools") if isinstance(k.get("mcp"), dict) else [])}
        services = None
        if spec.get("services"):
            services = [s for s in (k.get("services") or spec.get("default_services") or []) if s in spec["services"]]
            if not services:
                raise ValueError(f"„{name}“: wähl aus, wofür der Konnektor gilt.")
        out.append({"id": _cid(k, i), "name": name, "type": typ, "description": _clip(k.get("description"), 500),
                    "fixed": fixed, "login": login, "hosts": C.clean_hosts(k.get("hosts") or []),
                    "services": services, "instructions": _clip(k.get("instructions"), INSTRUCTIONS_MAX),
                    # Einrichtungsanleitung für den geführten Chat (nur das Modell im Einrichtungs-Chat sieht sie)
                    "setup": _clip(k.get("setup"), INSTRUCTIONS_MAX),
                    "rules": DR.clean_rules(k.get("rules"), name), "mcp": mcp,
                    "enabled": k.get("enabled", True) is not False})
    if len(out) > MAX_CONNECTORS:
        raise ValueError(f"Höchstens {MAX_CONNECTORS} Konnektoren.")
    return out


def by_id(cfg: dict, cid: str | None) -> dict | None:
    return next((k for k in cfg.get("connectors") or [] if k["id"] == cid), None) if cid else None


def enabled(cfg: dict) -> list[dict]:
    return [k for k in cfg.get("connectors") or [] if k.get("enabled", True)]


def free_allowed(cfg: dict) -> bool:
    return (cfg.get("credentials_policy") or {}).get("free_credentials", True) is not False


def locked(cred: dict, cfg: dict) -> bool:
    """Zugang eines Konnektors, den es nicht (mehr) gibt oder der ausgeschaltet ist: gesperrt."""
    cid = cred.get("connector_id")
    if not cid:
        return False
    k = by_id(cfg, cid)
    return k is None or not k.get("enabled", True)


def public_view(k: dict) -> dict:
    """Was jede Person vom Konnektor sieht (ohne Anleitung für das Modell)."""
    return {"id": k["id"], "name": k["name"], "type": k["type"], "description": k.get("description", ""),
            "login": k["login"], "fixed": dict(k.get("fixed") or {}), "user_fields": user_fields(k["type"], k.get("fixed") or {}),
            "services": k.get("services"), "has_setup": bool(k.get("setup")),
            # Datenregeln: Personen sehen, dass es welche gibt und wofür (Name und Bereich), nicht als Schalter
            "rules": [{"name": r["name"], "scope": r.get("scope", "")} for r in k.get("rules") or [] if r.get("enabled", True)],
            "mcp_tools": [t["name"] for t in (k.get("mcp") or {}).get("tools") or [] if t.get("enabled", True)]
            if k.get("mcp") else None}


def connection_raw(k: dict, fields: dict, existing: dict | None = None, name: str | None = None) -> dict:
    """Eingabe für ``manage.build_credential``: feste Felder des Konnektors, eigene Felder der Person."""
    own = {f: str(v) for f, v in (fields or {}).items() if f in user_fields(k["type"], k.get("fixed") or {})}
    raw = {"id": (existing or {}).get("id"), "name": name or (existing or {}).get("name") or k["name"], "type": k["type"],
           "fields": {**own, **(k.get("fixed") or {})}, "scope": "dedicated", "hosts": list(k.get("hosts") or []),
           "notes": (existing or {}).get("notes") or f"Verbunden über den Konnektor „{k['name']}“."}
    if k.get("services") is not None:
        raw["services"] = list(k["services"])
    return raw


def enforce(cred: dict, k: dict) -> bool:
    """Feste Felder, Server, Art und Dienste des Konnektors am Zugang durchsetzen. True, wenn sich etwas änderte."""
    before = json.dumps([cred.get("fields"), cred.get("hosts"), cred.get("scope"), cred.get("services")], sort_keys=True)
    cred["fields"] = {**(cred.get("fields") or {}), **(k.get("fixed") or {})}
    cred["hosts"] = list(k.get("hosts") or [])
    cred["scope"] = "dedicated"
    if k.get("services") is not None:
        cred["services"] = list(k["services"])
        cred["access"] = {s: (cred.get("access") or {}).get(s, "read") for s in k["services"]}
    return json.dumps([cred.get("fields"), cred.get("hosts"), cred.get("scope"), cred.get("services")], sort_keys=True) != before


def sync(meta: dict, cfg: dict) -> int:
    """Alle Zugänge einer Person an ihre Konnektoren angleichen (nach Änderungen des Admins). Zahl der geänderten."""
    n = 0
    for cred in (meta.get("credentials") or {}).values():
        k = by_id(cfg, cred.get("connector_id"))
        if k and enforce(cred, k):
            cred.pop("check", None)  # andere Adresse: die alte Prüfung sagt nichts mehr aus
            n += 1
    return n


def connection_of(creds: dict, cid: str) -> dict | None:
    return next((c for c in creds.values() if c.get("connector_id") == cid), None)


def connections_of(creds: dict, cid: str) -> list[dict]:
    """Alle Verbindungen einer Person mit diesem Konnektor (ältere zuerst)."""
    return sorted((c for c in creds.values() if c.get("connector_id") == cid), key=lambda c: c.get("created") or 0)


def skill_of(skills: dict, cred_id: str) -> dict | None:
    """Der Skill, der zu einer Verbindung gehört (höchstens einer)."""
    return next((s for s in skills.values() if s.get("connection_id") == cred_id), None)


def owner_hint(cred_or_skill: dict, cfg: dict, what: str) -> str:
    """Meldung, wenn ein Zugang oder Skill eines Konnektors außerhalb der Konnektor-Seite geändert werden soll."""
    k = by_id(cfg, cred_or_skill.get("connector_id"))
    name = k["name"] if k else "einem Konnektor"
    return (f"{what} „{cred_or_skill.get('name')}“ gehört zum Konnektor „{name}“ und lässt sich nur auf der Seite "
            "„Konnektoren“ ändern oder löschen – sonst funktioniert der Konnektor nicht mehr.")


def clean_options(k: dict, cred: dict, opts: dict) -> dict:
    """Wofür eine Verbindung verwendet werden darf – direkt nach dem Verbinden gewählt (Assistent der Konnektoren).

    Exchange-Typen: je Dienst des Konnektors „read“ oder „write“. Andere Typen: ``readonly`` (nur lesen) ja/nein.
    Dazu die Freigabe für externe Modelle und ein Ablaufdatum. Nicht genannte Einstellungen bleiben, wie sie sind."""
    out: dict[str, Any] = {}
    svc = cred.get("services") if cred.get("services") is not None else k.get("services")
    if isinstance(opts.get("access"), dict) and svc:
        out["access"] = {s: ("write" if opts["access"].get(s) == "write" else "read") for s in svc}
    if "readonly" in opts and not (C.TYPES.get(k["type"]) or {}).get("services"):
        out["readonly"] = bool(opts["readonly"])
    if "external" in opts:
        out["external"] = bool(opts["external"])
    if "valid_until" in opts:
        v = str(opts.get("valid_until") or "").strip()
        if v and not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Ablaufdatum bitte als JJJJ-MM-TT.")
        out["valid_until"] = v
    return out


def options_text(cred: dict) -> str:
    """Kurz, wofür die Verbindung verwendet werden darf (für das Modell im Einrichtungs-Chat)."""
    if cred.get("services"):
        acc = C.access_text(cred)
        rights = ", ".join(f"{n}: {r}" for n, r in acc.items())
    else:
        rights = "nur lesen" if C.read_only(cred) else "lesen und schreiben"
    parts = [f"Rechte: {rights}"]
    parts.append("für externe Modelle freigegeben" if cred.get("external") else "für externe Modelle gesperrt")
    if cred.get("valid_until"):
        parts.append(f"gültig bis {cred['valid_until']}")
    return "; ".join(parts)


def setup_prompt(k: dict, cred: dict | None, skill: dict | None, person: str) -> str:
    """Abschnitt im Systemprompt des geführten Einrichtungs-Chats."""
    spec = C.TYPES.get(k["type"]) or {}
    labels = spec.get("labels") or {}
    own = [labels.get(f, f) for f in user_fields(k["type"], k.get("fixed") or {})]
    fixed = [f"{labels.get(f, f)} = {v}" for f, v in (k.get("fixed") or {}).items()]
    lines = [
        f"## Einrichtung des Konnektors „{k['name']}“",
        f"Dieser Chat ist ein geführter Einrichtungs-Assistent: Du richtest mit {person} den Konnektor „{k['name']}“ "
        f"({spec.get('label', k['type'])}) ein" + (f" – genauer: die bestehende Verbindung „{cred['name']}“ ändern" if cred else "")
        + ". So gehst du vor:",
        "1. Begrüße kurz und erkläre in ein, zwei Sätzen, was der Konnektor kann. Dann führe Schritt für Schritt durch "
        "die Anleitung unten: **immer nur eine Frage oder ein Schritt pro Nachricht**, warte auf die Antwort, hilf bei "
        "Problemen. Kurze, klare Sätze, nummerierte Klickwege mit den Namen, die die Person auf dem Bildschirm sieht.",
        "2. Passwörter, Tokens und Schlüssel schreibt die Person **nie** in den Chat. Sobald sie die Anmeldedaten bereit "
        "hat, rufe `konnektor_verbinden` auf: Dann erscheint ein Formular, in das sie sie einträgt – du siehst sie nie. "
        "Schreibt sie trotzdem ein Geheimnis in den Chat, bitte sie, es zu widerrufen bzw. zu ändern und das neue ins "
        "Formular einzutragen. Im Formular wählt sie nach erfolgreicher Verbindung auch, wofür der Zugang verwendet werden "
        "darf (nur lesen oder auch schreiben, externe Modelle). Schlägt die Prüfung fehl, hilf bei der Fehlersuche und "
        "rufe das Werkzeug erneut auf.",
        "3. Nach erfolgreicher Verbindung frag, ob ein Skill hinterlegt werden soll, damit LLMitMir diesen Zugang immer "
        "auf eine bestimmte Art verwendet (z. B. welches Projekt, welche Ordner, welche Regeln). Wenn ja: Erfrage das "
        "Nötige, formuliere den Skill und lege ihn mit `konnektor_skill` an – die Person bestätigt ihn. Der Skill gehört "
        "dann fest zu dieser Verbindung.",
        "4. Fasse zum Schluss in zwei, drei Sätzen zusammen, was eingerichtet ist. Zugang und Skill findet die Person "
        "später auf der Seite „Plugins → Konnektoren“.",
        f"Die Person trägt selbst ein: {', '.join(own) or 'nichts (Anmeldung im Browser)'}."
        + (f" Fest vorgegeben vom Admin: {'; '.join(fixed)}." if fixed else ""),
    ]
    if k.get("login") == LOGIN_NEXTCLOUD:
        lines.append("Anmeldung über den Nextcloud Login Flow: Im Formular klickt die Person auf „Mit Nextcloud anmelden“, "
                     "meldet sich im neuen Fenster an und erlaubt den Zugriff; LLMitMir bekommt ein eigenes App-Passwort.")
    if spec.get("hint"):
        lines.append(f"Hinweis zum Typ: {spec['hint']}")
    if k.get("description"):
        lines.append(f"Beschreibung des Admins: {k['description']}")
    lines.append("### Einrichtungsanleitung des Admins\n" + (k.get("setup") or "(Keine eigene Anleitung hinterlegt – "
                 "erkläre allgemein, woher die Person die Anmeldedaten bekommt, z. B. ein App-Passwort oder ein eigener "
                 "Token mit möglichst wenigen Rechten.)"))
    if cred:
        lines.append(f"Bestehende Verbindung „{cred['name']}“: {options_text(cred)}."
                     + (f" Zugehöriger Skill: „{skill['name']}“ – ändern mit `konnektor_skill`." if skill else ""))
    return "\n".join(lines)


def unique_name(creds: dict, base: str, own_id: str | None = None) -> str:
    names = {c["name"].casefold() for c in creds.values() if c.get("id") != own_id}
    if base.casefold() not in names:
        return base
    for n in range(2, 100):
        cand = f"{base} ({n})"
        if cand.casefold() not in names:
            return cand
    raise ValueError("Zu viele Zugänge mit diesem Namen")


def prompt_section(creds: dict, cfg: dict) -> str:
    """Anleitungen der verbundenen Konnektoren für den Systemprompt (nur für sichtbare Zugänge)."""
    parts = []
    for c in creds.values():
        k = by_id(cfg, c.get("connector_id"))
        if not k or not k.get("enabled", True):
            continue
        rules = DR.prompt_lines([r for r in k.get("rules") or [] if r.get("enabled", True)])
        body = "\n\n".join(x for x in (k.get("instructions") or "", rules) if x)
        if body:
            parts.append(f"### {k['name']} (Zugang „{c['name']}“)\n{body}")
    if not parts:
        return ""
    return ("## Konnektoren\nDiese Anbindungen hat der Admin vorbereitet; die Anleitungen gelten für die Arbeit mit "
            "dem jeweiligen Zugang.\n\n" + "\n\n".join(parts))


# ------------------------------------------------------------------ Nextcloud Login Flow v2

def nextcloud_base(url: str) -> str:
    """Basisadresse der Nextcloud aus der WebDAV-Adresse (alles vor /remote.php)."""
    u = str(url or "").strip().rstrip("/")
    i = u.find("/remote.php")
    if i >= 0:
        u = u[:i]
    parts = urllib.parse.urlsplit(u)
    if parts.scheme != "https" or not parts.hostname:
        raise ValueError("Der Login Flow braucht eine https-Adresse der Nextcloud.")
    return u


async def flow_start(session, base: str) -> dict:
    """Login Flow beginnen → {"login": URL für den Browser, "endpoint", "token"} (nur an die Nextcloud selbst)."""
    async with session.post(f"{base}/index.php/login/v2", headers={"User-Agent": "LLMitMir", "OCS-APIRequest": "true"},
                            timeout=20) as r:
        if r.status != 200:
            raise ValueError(f"Die Nextcloud lehnt den Login Flow ab (HTTP {r.status}).")
        data = await r.json(content_type=None)
    poll = data.get("poll") or {}
    login, endpoint, token = data.get("login"), poll.get("endpoint"), poll.get("token")
    if not (login and endpoint and token):
        raise ValueError("Unerwartete Antwort der Nextcloud auf den Login Flow.")
    for u in (login, endpoint):
        if not str(u).startswith("https://") or C.host_of(u) != C.host_of(base):
            raise ValueError("Die Nextcloud verweist für den Login auf einen anderen Server – abgebrochen.")
    return {"login": login, "endpoint": endpoint, "token": token}


async def flow_poll(session, endpoint: str, token: str) -> dict | None:
    """Einmal nachfragen: None, solange die Person sich noch nicht angemeldet hat; sonst loginName und appPassword."""
    async with session.post(endpoint, data={"token": token}, headers={"User-Agent": "LLMitMir"}, timeout=20) as r:
        if r.status == 404:
            return None
        if r.status != 200:
            raise ValueError(f"Login Flow: HTTP {r.status}")
        data = await r.json(content_type=None)
    if not data.get("loginName") or not data.get("appPassword"):
        raise ValueError("Login Flow: Antwort ohne Anmeldedaten.")
    return {"username": data["loginName"], "password": data["appPassword"]}


def flow_expired(started: float, now_ts: float | None = None) -> bool:
    return (now_ts or time.time()) - started > FLOW_TIMEOUT
