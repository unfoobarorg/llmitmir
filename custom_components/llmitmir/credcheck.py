"""Pruefen, ob ein Zugang wirklich funktioniert (Seite „Zugaenge“).

Ein abgelaufenes Passwort oder ein zurueckgezogener Token faellt sonst erst auf, wenn ein Werkzeug ihn
braucht – und dann mitten in einer Aufgabe. Deshalb prueft LLMitMir die Zugangsdaten mit einer harmlosen
Leseanfrage (PROPFIND, GET, getMe, IMAP-LOGIN; Exchange je gewähltem Dienst über EWS) und merkt sich das Ergebnis am Zugang (``check``).
Die Einordnung einer Antwort steckt in ``verdict`` und ist ohne Home Assistant testbar.
"""
from __future__ import annotations

import asyncio
import socket
import ssl
import time
from typing import Any

import aiohttp

CHECK_TIMEOUT = 20
# Felder, ohne die eine Pruefung gar nicht erst losgeht
REQUIRED: dict[str, tuple[str, ...]] = {
    "webdav": ("url",),
    "basic": ("url", "username", "password"),
    "bearer": ("url", "token"),
    "header": ("url", "key"),
    "telegram": ("token",),
    "imap": ("imap_host", "username", "password"),
    "gwdg": ("username", "password"),
    "ews": ("url", "username", "password"),
}
# Antworten, die ein Werkzeug als abgelehnte Anmeldung zurueckgibt (dann gilt der Zugang als kaputt)
AUTH_MARKERS = ("HTTP 401", "HTTP 407", "401 Unauthorized", "Unauthorized", "Anmeldung abgelehnt",
                "invalid_grant", "invalid_client", "token expired", "Token abgelaufen", "Zugriff verweigert")


def _now() -> float:
    return round(time.time(), 3)


def verdict(status: int | None, error: str = "", reachable_404: bool = False) -> tuple[bool, str]:
    """Klartext zu einer Antwort: (funktioniert, Meldung)."""
    if error:
        return False, error
    if status is None:
        return False, "keine Antwort"
    if status in (401, 407):
        return False, f"HTTP {status}: Benutzername, Passwort oder Token wurde abgelehnt"
    if status == 403:
        return False, "HTTP 403: Zugriff verweigert – Token ohne passende Rechte?"
    if status == 404:
        if reachable_404:
            return True, "HTTP 404: erreichbar, die Adresse liefert aber nichts (Anmeldung nicht geprüft)"
        return False, "HTTP 404: Adresse nicht gefunden – stimmt die URL?"
    if status == 429:
        return True, "HTTP 429: erreichbar, gerade aber zu viele Anfragen"
    if status >= 500:
        return False, f"HTTP {status}: Der Dienst meldet einen Fehler"
    if status >= 400:
        return False, f"HTTP {status}"
    return True, f"HTTP {status}: erreichbar"


def _result(ok: bool, message: str, status: int | None = None) -> dict:
    return {"ok": bool(ok), "message": message, "status": status, "at": _now()}


def _missing(cred: dict) -> str:
    """Erstes Pflichtfeld, das leer ist (leerer Text = Pruefung nicht moeglich)."""
    f = cred.get("fields") or {}
    for k in REQUIRED.get(cred.get("type") or "", ()):
        if not str(f.get(k) or "").strip():
            return k
    return ""


def _hostport(value: str, default_port: int) -> tuple[str, int]:
    v = str(value or "").strip()
    if ":" in v:
        host, _, port = v.rpartition(":")
        if port.isdigit():
            return host, int(port)
    return v, default_port


def _imap_quote(value: str) -> bytes:
    return b'"' + str(value).replace("\\", "\\\\").replace('"', '\\"').encode() + b'"'


async def _http(session: aiohttp.ClientSession, method: str, url: str, **kw: Any) -> int:
    async with session.request(method, url, timeout=aiohttp.ClientTimeout(total=CHECK_TIMEOUT), **kw) as r:
        await r.read()  # Body lesen, damit die Verbindung sauber schliesst
        return r.status


async def _check_webdav(session: aiohttp.ClientSession, cred: dict) -> dict:
    from .tools import dav as D

    base = D.files_base(cred)
    status = await _http(session, "PROPFIND", f"{base}/", data=D.PROPFIND, auth=D._auth(cred),
                         headers={"Depth": "0"})
    ok, msg = verdict(status)
    if status == 404:
        msg = "HTTP 404: Ordner nicht gefunden – stimmt die URL bzw. der Freigabe-Link?"
    return _result(ok, msg, status)


DAV_PING = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>'


async def _check_ews(session: aiohttp.ClientSession, cred: dict, folder: str = "calendar") -> dict:
    """Exchange Web Services: ein GetFolder auf den Kalender- bzw. Kontaktordner – die billigste echte Anfrage."""
    from . import credentials as C
    from . import ews as E

    user, password = C.ews_account(cred)
    try:
        out = await E.call(session, C.ews_endpoint(cred), user, password, E.get_folder(folder),
                           timeout=CHECK_TIMEOUT, domain=C.ews_domain(cred))
    except E.EwsError as e:
        msg = str(e)
        ok = not any(m in msg for m in ("401", "403", "abgelehnt", "verweigert"))
        return _result(ok, msg, 401 if "401" in msg else None)
    if not out["ok"]:
        return _result(False, E.describe_error(out), out.get("status"))
    return _result(True, "EWS antwortet", out.get("status"))


async def ews_diagnose(session: aiohttp.ClientSession, cred: dict) -> dict:
    """Was der Exchange auf die einzelnen Anfragen antwortet – für die Fehlersuche bei 500ern.

    Gibt je Anfrage Status, Antwortcode und – wenn der Server einen Fehler meldet – seine Meldung zurück.
    """
    from . import credentials as C
    from . import ews as E

    user, password = C.ews_account(cred)
    endpoint = C.ews_endpoint(cred)
    domain = C.ews_domain(cred)
    probes = {
        "kalender": E.find_calendar(None, None, 5),
        "postfach": E.find_messages("inbox", None, None, None, False, 5),
        "ordner": E.find_folders(),
        "kontakte": E.find_contacts(5),
    }
    out: dict = {}
    for name, body in probes.items():
        try:
            res = await E.call(session, endpoint, user, password, body, timeout=CHECK_TIMEOUT, domain=domain)
            out[name] = {"status": res.get("status"), "ok": res.get("ok"), "code": res.get("code"),
                         "message": res.get("message"), "anzahl": len(res.get("items") or [])}
        except E.EwsError as e:
            out[name] = {"fehler": str(e)}
    return out


async def _check_gwdg(session: aiohttp.ClientSession, cred: dict) -> dict:
    """GWDG-Exchange: jeden angehakten Dienst einzeln prüfen.

    Kalender, Kontakte und Postfach laufen über EWS (GetFolder auf den jeweiligen Ordner) – so prüft die GWDG
    selbst den Zugang (Apple Mail, „manuell konfigurieren“). Ältere Zugänge mit DavMail-Adresse werden weiterhin per
    PROPFIND auf den DavMail-Ordner geprüft.
    """
    from . import credentials as C
    from .tools import dav as D

    names = C.TYPES["gwdg"]["services"]
    picked = C.services(cred)
    if not picked:
        return _result(False, "Kein Dienst gewählt (E-Mail-Postfach, Kalender oder Kontakte)")
    ews = C.is_ews(cred)
    parts, ok_all, status = [], True, None
    for svc in picked:
        if ews:  # Exchange: alle drei Dienste über dieselbe Schnittstelle
            r = await _check_ews(session, cred, {"mail": "inbox", "contacts": "contacts"}.get(svc, "calendar"))
        elif svc == "mail":
            r = await _check_imap(cred)
        else:
            try:
                st = await _http(session, "PROPFIND", D.dav_root(cred) + "/" + D.GWDG_FOLDERS[svc], data=DAV_PING,
                                 auth=D._auth(cred), headers={"Depth": "0", "Content-Type": "application/xml"})
            except asyncio.TimeoutError:
                r = _result(False, "Zeitüberschreitung – DavMail der GWDG antwortet nicht")
            except aiohttp.ClientError as e:
                r = _result(False, f"Keine Verbindung zu DavMail der GWDG ({type(e).__name__})")
            else:
                ok, msg = verdict(st)
                if st in (401, 403):
                    msg = f"HTTP {st}: GWDG hat E-Mail-Adresse oder Passwort abgelehnt"
                r = _result(ok, msg, st)
                status = status or st
        ok_all = ok_all and r["ok"]
        parts.append(f"{names[svc]}: {r['message'] if not r['ok'] else 'ok'}")
    return _result(ok_all, " · ".join(parts), status)


async def _check_http(session: aiohttp.ClientSession, cred: dict) -> dict:
    from . import credentials as C

    url = str((cred.get("fields") or {}).get("url") or "").strip()
    if not url.lower().startswith(("http://", "https://")):
        return _result(False, "Die URL muss mit http:// oder https:// beginnen")
    headers, auth = C.auth_for(cred)
    status = await _http(session, "GET", url, headers=headers, auth=auth)
    ok, msg = verdict(status, reachable_404=True)
    return _result(ok, msg, status)


async def _check_telegram(session: aiohttp.ClientSession, cred: dict) -> dict:
    token = str((cred.get("fields") or {}).get("token") or "").strip()
    async with session.get(f"https://api.telegram.org/bot{token}/getMe",
                           timeout=aiohttp.ClientTimeout(total=CHECK_TIMEOUT)) as r:
        status = r.status
        try:
            data = await r.json(content_type=None)
        except ValueError:
            data = {}
    if status == 200 and isinstance(data, dict) and data.get("ok"):
        name = str((data.get("result") or {}).get("username") or "").strip()
        return _result(True, f"Bot @{name} antwortet" if name else "Bot antwortet", status)
    if status in (401, 404):
        return _result(False, "Der Bot-Token wurde abgelehnt", status)
    ok, msg = verdict(status)
    return _result(ok, msg, status)


async def _dns(host: str, port: int):
    """Namensaufloesung – eigene Funktion, damit die Pruefung ohne Netz testbar bleibt."""
    return await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)


async def _imap_connect(host: str, port: int) -> tuple[asyncio.StreamReader, asyncio.StreamWriter, str, bytes | None]:
    """Verbindung zum Postfach, Stufe fuer Stufe: DNS, TCP, dann TLS (Port 993) bzw. STARTTLS (Port 143).

    Die Stufen sind absichtlich getrennt: „TimeoutError“ allein sagt nicht, ob der Name nicht aufloest, der Port
    gesperrt ist oder nur der TLS-Handshake haengt – und genau das ist bei einer Firewall auf dem Weg die Frage.
    Klappt 993 nicht, wird 143 mit STARTTLS versucht (Exchange kann beides); die Rueckgabe nennt den Weg.
    """
    try:
        infos = await _dns(host, port)
    except socket.gaierror as e:
        raise _ImapFehler(f"DNS: {host} laesst sich nicht aufloesen ({e.strerror or e})") from e
    if not infos:
        raise _ImapFehler(f"DNS: {host} laesst sich nicht aufloesen")
    ctx = ssl.create_default_context()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port, ssl=ctx, server_hostname=host), CHECK_TIMEOUT)
        return reader, writer, f"TLS auf Port {port}", None
    except asyncio.TimeoutError:
        fehler = (f"TCP/TLS: Port {port} antwortet nicht innerhalb von {CHECK_TIMEOUT} s "
                  f"(Port gesperrt oder Firewall auf dem Weg?)")
    except (ssl.SSLError, OSError) as e:
        fehler = f"TLS auf Port {port}: {type(e).__name__}: {e}"
    if port != 993:
        raise _ImapFehler(fehler)
    # 993 geht nicht: Exchange spricht auch 143 mit STARTTLS – lieber so als gar kein Postfach
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, 143), CHECK_TIMEOUT)
    except (asyncio.TimeoutError, OSError) as e:
        raise _ImapFehler(f"{fehler}; auch Port 143 nicht erreichbar ({type(e).__name__})") from e
    try:
        greet = await asyncio.wait_for(reader.readline(), CHECK_TIMEOUT)
        if not greet.startswith(b"* OK"):
            raise _ImapFehler(f"{fehler}; Port 143 spricht kein IMAP")
        writer.write(b"s1 STARTTLS\r\n")
        await writer.drain()
        antwort = await asyncio.wait_for(reader.readline(), CHECK_TIMEOUT)
        if not antwort.startswith(b"s1 OK"):
            raise _ImapFehler(f"{fehler}; Port 143 lehnt STARTTLS ab")
        await writer.start_tls(ctx, server_hostname=host)
        # Die Begruessung kam schon vor STARTTLS – nach dem Handshake schickt IMAP keine neue
        return reader, writer, "STARTTLS auf Port 143", greet
    except asyncio.TimeoutError as e:
        raise _ImapFehler(f"{fehler}; STARTTLS auf Port 143 antwortet nicht") from e
    except (ssl.SSLError, OSError) as e:
        raise _ImapFehler(f"{fehler}; STARTTLS auf Port 143: {type(e).__name__}: {e}") from e


class _ImapFehler(Exception):
    """Verbindungsaufbau zum Postfach gescheitert – die Meldung nennt die Stufe."""


async def _check_imap(cred: dict) -> dict:
    f = cred.get("fields") or {}
    host, port = _hostport(f.get("imap_host") or "", 993)
    user, pw = str(f.get("username") or ""), str(f.get("password") or "")
    try:
        reader, writer, weg, greet = await _imap_connect(host, port)
    except _ImapFehler as e:
        return _result(False, f"Keine Verbindung zu {host}:{port} – {e}")
    try:
        if greet is None:
            greet = await asyncio.wait_for(reader.readline(), CHECK_TIMEOUT)
        if not greet.startswith(b"* OK"):
            return _result(False, f"Kein IMAP-Server auf {host}:{port} ({weg})")
        writer.write(b"a1 LOGIN " + _imap_quote(user) + b" " + _imap_quote(pw) + b"\r\n")
        await writer.drain()
        while True:
            line = await asyncio.wait_for(reader.readline(), CHECK_TIMEOUT)
            if not line:
                return _result(False, "Der Server hat die Verbindung ohne Antwort beendet")
            if line.startswith(b"a1 "):
                if b" OK" in line:
                    return _result(True, f"Anmeldung an {host} erfolgreich ({weg})")
                return _result(False, f"Anmeldung abgelehnt: {line.decode('utf-8', 'ignore').strip()[:160]}")
    except asyncio.TimeoutError:
        return _result(False, f"Zeitueberschreitung bei der Anmeldung an {host} ({weg})")
    except OSError as e:
        return _result(False, f"Verbindung zu {host} abgebrochen ({type(e).__name__})")
    finally:
        try:
            writer.write(b"a2 LOGOUT\r\n")
            await writer.drain()
        except OSError:
            pass
        writer.close()
        try:
            await writer.wait_closed()
        except OSError:
            pass


async def check_credential(session: aiohttp.ClientSession, cred: dict) -> dict:
    """Prueft einen Zugang und liefert das Ergebnis (ohne es zu speichern)."""
    typ = cred.get("type") or "other"
    if typ == "other":
        return _result(True, "Für diesen Typ gibt es keine automatische Prüfung")
    missing = _missing(cred)
    if missing:
        return _result(False, f"Feld „{missing}“ fehlt")
    try:
        if typ == "gwdg":
            return await _check_gwdg(session, cred)
        if typ == "ews":
            return await _check_ews(session, cred)
        if typ == "webdav":
            from . import credentials as C

            if C.is_gwdg(cred):  # ältere Zugänge mit DavMail-URL: wie GWDG-Exchange (Kalender) prüfen
                return await _check_gwdg(session, cred)
            return await _check_webdav(session, cred)
        if typ == "telegram":
            return await _check_telegram(session, cred)
        if typ == "imap":
            return await _check_imap(cred)
        return await _check_http(session, cred)
    except asyncio.TimeoutError:
        return _result(False, "Zeitüberschreitung – der Dienst antwortet nicht")
    except aiohttp.ClientError as e:
        return _result(False, f"Keine Verbindung: {type(e).__name__}")
    except Exception as e:  # noqa: BLE001 – eine Pruefung darf nie die Oberflaeche stoeren
        return _result(False, f"Prüfung fehlgeschlagen: {type(e).__name__}: {e}")


def failed(cred: dict) -> bool:
    """Der letzte Prueflauf hat den Zugang als kaputt erkannt."""
    c = cred.get("check") or {}
    return bool(c) and not c.get("ok")


def summary(cred: dict) -> str:
    """Kurzform fuer den Systemprompt: leer, wenn alles in Ordnung ist."""
    c = cred.get("check") or {}
    if not c or c.get("ok"):
        return ""
    return str(c.get("message") or "Prüfung fehlgeschlagen")


def looks_like_auth_error(text: str) -> bool:
    """Ein Werkzeugfehler, der nach abgelehnter Anmeldung aussieht (dann ist der Zugang das Problem)."""
    t = str(text or "")
    return any(m in t for m in AUTH_MARKERS)
