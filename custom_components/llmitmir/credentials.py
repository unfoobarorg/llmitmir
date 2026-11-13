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
    # Exchange Web Services als eigener Typ: beliebiger Exchange-Server mit eigenen Endpunkten (Kalender, Kontakte).
    # Wer nur einen Exchange hat (nicht die GWDG), trägt Adresse, Benutzer und Passwort selbst ein.
    "ews": {"label": "Exchange (EWS)", "fields": ["url", "username", "password"], "secret": {"password"},
            "services": {"mail": "E-Mail-Postfach", "calendar": "Kalender", "contacts": "Kontakte"},
            "service_fields": {},
            "default_services": ["mail", "calendar", "contacts"],
            "labels": {"url": "EWS-Adresse", "username": "Benutzername", "password": "Passwort"},
            "placeholders": {"url": "https://server.example.org/EWS/Exchange.asmx",
                             "username": "z. B. vorname.nachname@example.org oder DOMAIN\\benutzer"},
            "hint": "Exchange Web Services: die Adresse der Exchange.asmx deines Servers, dazu Benutzername und Passwort. "
                    "Postfach, Kalender und Kontakte laufen alle über diese eine Schnittstelle – kein IMAP, kein SMTP."},
    # GWDG-Exchange (Uni-Konto) – wie in calmerge gibt die Person nur E-Mail-Adresse und Passwort an und wählt, wofür der
    # Zugang gilt (Postfach, Kalender, Kontakte). Kalender und Kontakte laufen über EWS mit den Endpunkten der GWDG,
    # das Postfach über IMAP/SMTP – alles setzt LLMitMir beim Speichern selbst.
    "gwdg": {"label": "GWDG-Exchange (Uni-Konto)", "fields": ["username", "login", "password"],
             "secret": {"password"},
             "services": {"mail": "E-Mail-Postfach", "calendar": "Kalender", "contacts": "Kontakte"},
             "service_fields": {"mail": ["ews_url"], "calendar": ["ews_url"], "contacts": ["ews_url"]},
             "default_services": ["calendar"],
             "readonly": ["ews_url"],
             # die Adresse setzt LLMitMir selbst – sie steht im Hinweis, nicht als Feld im Formular
             "hidden": ["ews_url"],
             # Felder früherer Versionen (DavMail-Kalender und -Kontakte, IMAP/SMTP): nicht anzeigen, beim Speichern weg
             "obsolete": ["url", "contacts_url", "imap_host", "smtp_host"],
             "labels": {"username": "GWDG-E-Mail-Adresse", "login": "Benutzerkennung", "password": "Passwort",
                        "ews_url": "EWS-Adresse"},
             "placeholders": {"username": "vorname.nachname@gwdg.de", "login": "z. B. nkopp1",
                              "ews_url": "Wird automatisch gesetzt"},
             "hint": "Dein Konto im GWDG-Exchange. Trag deine GWDG-E-Mail-Adresse, deine Benutzerkennung und dein "
                     "Passwort ein und wähl, wofür der Zugang gilt – ohne @ wird bei der Adresse @gwdg.de ergänzt. "
                     "Die Benutzerkennung ist der Teil vor dem @, wenn sie bei dir anders lautet (z. B. nkopp1), trag "
                     "sie hier ein: Angemeldet wird als gwdg\\kennung. Alles läuft über Exchange Web Services "
                     "(email.gwdg.de/EWS/Exchange.asmx): Postfach, Kalender und Kontakte – so wie die GWDG es für "
                     "Exchange-Konten beschreibt. Weitere Adressen brauchst du nicht."},
}

GWDG_DAVMAIL = "https://davmail.gwdg.de:1080"
GWDG_EWS = "https://email.gwdg.de/EWS/Exchange.asmx"  # Exchange Web Services der GWDG
# IMAP/SMTP der GWDG – nur noch für ältere Zugänge, die diese Felder schon haben (neue laufen ganz über EWS)
GWDG_IMAP = "email.gwdg.de:993"
GWDG_SMTP = "email.gwdg.de:587"
ACCESS_LABELS = {"read": "nur lesen", "write": "lesen und schreiben"}
GWDG_USAGE = ("Postfach: mail_folders, mail_list, mail_read; mail_send und mail_change nur bei „lesen und schreiben“. "
              "Kalender: ews_events (auch caldav_events), anlegen/ändern/löschen mit ews_save. "
              "Kontakte: ews_contacts. Das Passwort gibt LLMitMir nicht heraus (kein {{cred:…:password}}, "
              "kein http_request) – so gilt die Einstellung „nur lesen“ wirklich.")
GWDG_NO_SECRET = ("Das Passwort eines Exchange-Zugangs gibt LLMitMir nicht heraus – damit „nur lesen“ wirklich gilt. "
                  "Nutze mail_*, ews_events, ews_contacts und ews_save mit zugang.")


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


def is_ews(cred: dict) -> bool:
    """Läuft dieser Zugang über Exchange Web Services?

    Ja beim Typ ``ews`` (beliebiger Exchange) und beim GWDG-Exchange, solange dort keine alte DavMail-Adresse steht –
    die GWDG nutzt EWS mit ihren eigenen Endpunkten, ältere Zugänge bleiben über DavMail erreichbar.
    """
    t = cred.get("type")
    if t == "ews":
        return True
    if t != "gwdg":
        return False
    f = cred.get("fields") or {}
    return not str(f.get("url") or "").startswith("http") or "davmail.gwdg.de" not in str(f.get("url") or "")


def ews_endpoint(cred: dict) -> str:
    """EWS-Adresse (…/EWS/Exchange.asmx): beim GWDG-Zugang fest gesetzt, beim Typ ``ews`` selbst eingetragen."""
    f = cred.get("fields") or {}
    if cred.get("type") == "gwdg":
        return str(f.get("ews_url") or GWDG_EWS)
    return str(f.get("ews_url") or f.get("url") or "").strip()


def ews_account(cred: dict) -> tuple[str, str]:
    r"""(Benutzername, Passwort) für die EWS-Anmeldung.

    Beim GWDG-Zugang ist der Benutzername die **Kennung** (``nkopp1``), nicht die E-Mail-Adresse: Angemeldet wird als
    ``gwdg\kennung``. Steht keine Kennung im Zugang, gilt der Teil der Adresse vor dem @.
    """
    f = cred.get("fields") or {}
    if cred.get("type") == "gwdg":
        login = str(f.get("login") or "").strip()
        if login:
            return login, str(f.get("password") or "")
        return gwdg_email(f.get("username") or "").partition("@")[0], str(f.get("password") or "")
    return str(f.get("username") or "").strip(), str(f.get("password") or "")


def ews_sender(cred: dict) -> str:
    """Absenderadresse für gesendete Nachrichten – beim GWDG-Zugang die E-Mail-Adresse, nicht die Kennung."""
    f = cred.get("fields") or {}
    if cred.get("type") == "gwdg":
        return gwdg_email(f.get("username") or "")
    return str(f.get("username") or "").strip()


def ews_domain(cred: dict) -> str:
    r"""Domäne für die NTLM-Anmeldung.

    Der GWDG-Exchange nimmt nur NTLM an und erwartet dort ``gwdg\userid`` – die Domäne ist also ``gwdg``.
    Steht im Benutzernamen schon eine Domäne (``DOMAIN\benutzer``), gilt die. Bei anderen Exchange-Servern
    bleibt sie leer, dann entscheidet der Server über die Domäne des Kontos.
    """
    f = cred.get("fields") or {}
    raw = str(f.get("username") or "").strip()
    if "\\" in raw:
        return raw.partition("\\")[0].strip()
    if cred.get("type") == "gwdg" or "gwdg.de" in str(f.get("url") or "") + str(f.get("ews_url") or ""):
        return "gwdg"
    return ""


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
    """Wofür ein Zugang gilt (Postfach, Kalender, Kontakte).

    GWDG-Exchange: die angehakten Dienste. Typ ``ews``: Kalender und/oder Kontakte. Ältere WebDAV-Zugänge mit
    DavMail-URL: Kalender.
    """
    t = cred.get("type")
    if t == "ews":
        known = TYPES["ews"]["services"]
        picked = cred.get("services")
        if picked is None:
            picked = TYPES["ews"]["default_services"]
        return [k for k in known if k in picked]
    known = TYPES["gwdg"]["services"]
    if t != "gwdg":
        return ["calendar"] if is_gwdg(cred) else []
    picked = cred.get("services")
    if picked is None:
        picked = TYPES["gwdg"]["default_services"]
    return [k for k in known if k in picked]


def access(cred: dict, service: str) -> str:
    """Recht eines Zugangs für einen Dienst: "" (nicht freigegeben), "read" oder "write".

    GWDG-Exchange: je angehaktem Dienst, ohne Angabe nur lesen. Ältere WebDAV-Zugänge mit DavMail-URL: Kalender, nur
    lesen. Ein gewöhnlicher IMAP/SMTP-Zugang darf im Postfach alles (dort gibt es keine Einstellung).
    """
    t = cred.get("type")
    if t == "imap":
        return "write" if service == "mail" else ""
    if service not in services(cred):
        return ""
    if t not in ("gwdg", "ews"):
        return "read"
    return "write" if (cred.get("access") or {}).get(service) == "write" else "read"


def access_text(cred: dict) -> dict[str, str]:
    """{"E-Mail-Postfach": "nur lesen", …} für Modell und Änderungsvorschau."""
    names = TYPES["ews" if cred.get("type") == "ews" else "gwdg"]["services"]
    return {names.get(s, s): ACCESS_LABELS[access(cred, s)] for s in services(cred)}


def normalize_fields(typ: str, fields: dict, picked: list[str] | None = None) -> dict:
    """Felder vor dem Speichern vereinheitlichen.

    GWDG: E-Mail-Adresse normalisieren und die EWS-Adresse der GWDG setzen, sobald ein Dienst gewählt ist –
    Postfach, Kalender und Kontakte laufen alle über diesen einen Endpunkt.
    Typ ``ews``: nur die Felder des Typs behalten, die EWS-Adresse bleibt wie eingetragen (eigener Server).
    """
    if typ == "ews":
        t = TYPES["ews"]
        return {k: v for k, v in fields.items() if k in t["fields"] or str(v or "").strip()}
    if typ != "gwdg":
        return fields
    t = TYPES["gwdg"]
    auto = {k for ks in t["service_fields"].values() for k in ks} | set(t.get("obsolete") or [])
    # leere Reste eines anderen Typs, alle automatisch erzeugten Felder und die Adressen früherer Versionen weg –
    # die gewählten kommen gleich neu dazu
    out = {k: v for k, v in fields.items() if k in t["fields"] or (k not in auto and str(v or "").strip())}
    email = gwdg_email(out.get("username") or "")
    out["username"] = email
    # Benutzerkennung: ohne Angabe die aus der Adresse – gespeichert wird sie immer, damit die Anmeldung eindeutig ist
    login = str(out.get("login") or "").strip()
    out["login"] = login or email.partition("@")[0]
    picked = t["default_services"] if picked is None else picked
    if email and picked:
        out["ews_url"] = GWDG_EWS
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
            # wofür die Person den GWDG-Zugang freigegeben hat, mit welchem Recht – und womit das Modell ihn nutzt
            item["dienste"] = access_text(c)
            item["nutzung"] = GWDG_USAGE
        out.append(item)
    return out


def resolve_placeholders(text: str, creds: dict[str, dict], allowed: set[str] | None = None) -> str:
    def rep(m: re.Match) -> str:
        c = find(creds, m.group(1))
        if not c or (allowed is not None and c["id"] not in allowed):
            raise PermissionError(f"Zugang „{m.group(1)}“ nicht verfügbar")
        if is_gwdg(c) and m.group(2) in secret_fields(c):
            # mit dem Passwort ließe sich jede Lese-/Schreib-Einstellung umgehen (IMAP, SMTP, DavMail direkt)
            raise PermissionError(GWDG_NO_SECRET)
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
