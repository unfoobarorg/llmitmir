"""Nextcloud / WebDAV / CalDAV / CardDAV tools. Authentication comes from a stored credential."""
from __future__ import annotations

import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

import aiohttp

from .. import credentials as C
from . import Tool, obj, read_body, register

NS = {"d": "DAV:", "oc": "http://owncloud.org/ns", "cal": "urn:ietf:params:xml:ns:caldav"}
READ_METHODS = {"GET", "PROPFIND", "REPORT", "OPTIONS", "HEAD"}


def _cred(ctx, name: str) -> dict:
    c = C.find(ctx.creds, name)
    if not c or (ctx.allowed_creds is not None and c["id"] not in ctx.allowed_creds):
        raise PermissionError(f"Zugang „{name}“ ist hier nicht verfügbar. Verfügbar: "
                              + ", ".join(x["name"] for x in ctx.creds.values()
                                          if ctx.allowed_creds is None or x["id"] in ctx.allowed_creds))
    return c


def _q(path: str) -> str:
    return "/".join(urllib.parse.quote(p) for p in path.split("/"))


GWDG_NO_FILES = ("Ein GWDG-Exchange-Zugang hat keine Dateiablage – Termine mit caldav_events lesen, sonst dav_request "
                 "relativ zum DavMail-Stamm (z. B. PROPFIND calendar/).")


def files_base(cred: dict) -> str:
    if C.is_gwdg(cred):
        raise ValueError(GWDG_NO_FILES)
    f = cred.get("fields") or {}
    url = (f.get("url") or "").rstrip("/")
    if "/remote.php/dav/files/" in url or "/public.php/dav/files/" in url or url.endswith("/webdav"):
        return url
    m = re.search(r"/s/([A-Za-z0-9]+)", url)  # share link https://host/s/<token>
    token = f.get("share_token") or (m.group(1) if m else "")
    host = re.sub(r"/s/[A-Za-z0-9]+.*$", "", url)
    if token:
        return f"{host}/public.php/dav/files/{token}"
    return f"{host}/remote.php/dav/files/{_q(f.get('username') or '')}"


def dav_root(cred: dict) -> str:
    if C.is_gwdg(cred):  # https://davmail.gwdg.de:1080/users/<E-Mail> – darunter calendar/, contacts/ …
        root = C.gwdg_account(cred)[1]
        if not root:
            raise ValueError("Im GWDG-Zugang fehlt die GWDG-E-Mail-Adresse.")
        return root.rstrip("/")
    url = (cred.get("fields") or {}).get("url", "").rstrip("/")
    return re.sub(r"/(remote|public)\.php/.*$", "", re.sub(r"/s/[A-Za-z0-9]+.*$", "", url)) + "/remote.php/dav"


def _auth(cred: dict) -> aiohttp.BasicAuth:
    f = cred.get("fields") or {}
    if C.is_gwdg(cred):
        return aiohttp.BasicAuth(C.gwdg_account(cred)[0], f.get("password") or "")
    m = re.search(r"/s/([A-Za-z0-9]+)", f.get("url") or "")
    user = f.get("share_token") or (m.group(1) if m and not f.get("username") else "") or f.get("username") or ""
    return aiohttp.BasicAuth(user, f.get("password") or "")


PROPFIND = ('<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop>'
            '<d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getetag/><oc:fileid/><d:getcontenttype/>'
            '</d:prop></d:propfind>')


async def dav_list(ctx, a: dict):
    cred = _cred(ctx, a.get("zugang", ""))
    base = files_base(cred)
    pfad = str(a.get("pfad") or "").strip("/")
    tiefe = max(1, min(int(a.get("tiefe") or 1), 4))
    out, todo = [], [(pfad, 1)]
    while todo and len(out) < 2000:
        rel, lvl = todo.pop(0)
        url = f"{base}/{_q(rel)}/" if rel else f"{base}/"
        async with ctx.session.request("PROPFIND", url, data=PROPFIND, auth=_auth(cred), headers={"Depth": "1"},
                                       timeout=aiohttp.ClientTimeout(total=60)) as r:
            if r.status >= 400:
                return f"Fehler: HTTP {r.status} bei {rel or '/'}"
            xml = await r.read()
        for resp in ET.fromstring(xml).findall("d:response", NS)[1:]:
            href = urllib.parse.unquote(resp.findtext("d:href", "", NS)).rstrip("/")
            name = href.rsplit("/", 1)[-1]
            prop = resp.find("d:propstat/d:prop", NS)
            is_dir = prop is not None and prop.find("d:resourcetype/d:collection", NS) is not None
            rp = f"{rel}/{name}" if rel else name
            item = {"pfad": rp + ("/" if is_dir else ""), "ordner": is_dir}
            if prop is not None and not is_dir:
                item.update({"groesse": int(prop.findtext("d:getcontentlength", "0", NS) or 0),
                             "geaendert": prop.findtext("d:getlastmodified", "", NS),
                             "etag": (prop.findtext("d:getetag", "", NS) or "").strip('"'),
                             "fileid": prop.findtext("oc:fileid", "", NS)})
            out.append(item)
            if is_dir and lvl < tiefe:
                todo.append((rp, lvl + 1))
    return {"basis": pfad or "/", "eintraege": out}


async def dav_read(ctx, a: dict):
    cred = _cred(ctx, a.get("zugang", ""))
    pfad = str(a.get("pfad") or "").strip("/")
    url = f"{files_base(cred)}/{_q(pfad)}"
    async with ctx.session.get(url, auth=_auth(cred), timeout=aiohttp.ClientTimeout(total=120)) as r:
        if r.status >= 400:
            return f"Fehler: HTTP {r.status}"
        data, _ = await read_body(r, 30_000_000)
        ctype = r.headers.get("content-type", "")
    if a.get("speichern_als"):
        info = await ctx.store.async_write_file("chat", ctx.chat_id, a["speichern_als"], data)
        await ctx.emit_files()
        return {"ok": True, "gespeichert": info}
    from .files import extract_document

    return await extract_document(ctx, pfad.rsplit("/", 1)[-1], data, ctype, frage=a.get("frage"), bild=a.get("bild"))


async def dav_write(ctx, a: dict):
    cred = _cred(ctx, a.get("zugang", ""))
    pfad = str(a.get("pfad") or "").strip("/")
    if a.get("aus_arbeitsbereich"):
        data = await ctx.store.async_read_file("chat", ctx.chat_id, a["aus_arbeitsbereich"])
    else:
        data = str(a.get("inhalt") or "").encode("utf-8")
    headers = {} if a.get("ueberschreiben") else {"If-None-Match": "*"}
    async with ctx.session.put(f"{files_base(cred)}/{_q(pfad)}", data=data, auth=_auth(cred), headers=headers,
                               timeout=aiohttp.ClientTimeout(total=120)) as r:
        if r.status == 412:
            return "Fehler: Datei existiert schon (ueberschreiben=true setzen, wenn gewollt)."
        if r.status >= 400:
            return f"Fehler: HTTP {r.status} {(await r.text())[:200]}"
    return {"ok": True, "pfad": pfad, "bytes": len(data)}


GWDG_FOLDERS = {"calendar": "calendar/", "contacts": "contacts/"}


def gwdg_allowed(cred: dict, url: str, write: bool = False) -> str:
    """Leer, wenn ein GWDG-Zugang diese Adresse nutzen darf – sonst der Grund. Erlaubt sind nur die Ordner der
    Dienste, die die Person beim Zugang angehakt hat (Kalender → calendar/, Kontakte → contacts/), und schreibend
    nur dort, wo sie „lesen und schreiben“ gewählt hat."""
    root = dav_root(cred) + "/"
    svc = C.services(cred)
    if not url.startswith(root):
        return "Fehler: nur Adressen im DavMail-Konto dieses GWDG-Zugangs erlaubt"
    rel = url[len(root):].split("?", 1)[0]
    if any(seg in (".", "..") for seg in urllib.parse.unquote(rel).split("/")):
        return "Fehler: Pfade mit . oder .. sind bei GWDG-Exchange nicht erlaubt"
    for name, folder in GWDG_FOLDERS.items():
        if (rel + "/").startswith(folder):
            label = C.TYPES["gwdg"]["services"][name]
            acc = C.access(cred, name)
            if not acc:
                return f"Fehler: Der GWDG-Zugang „{cred.get('name')}“ ist nicht für {label} freigegeben (Seite „Zugänge“)."
            if write and acc != "write":
                return (f"Fehler: Der GWDG-Zugang „{cred.get('name')}“ darf {label} nur lesen – schreiben, ändern und "
                        "löschen sind gesperrt. Die Person kann das auf der Seite „Zugänge“ ändern.")
            return ""
    allowed = [f for n, f in GWDG_FOLDERS.items() if n in svc]
    return ("Fehler: Bei GWDG-Exchange nur " + (" oder ".join(allowed) if allowed else "keine DAV-Ordner")
            + " (relativ zum Konto)")


async def dav_request(ctx, a: dict):
    cred = _cred(ctx, a.get("zugang", ""))
    methode = str(a.get("methode") or "PROPFIND").upper()
    pfad = str(a.get("pfad") or "")
    url = pfad if pfad.startswith("http") else f"{dav_root(cred)}/{pfad.lstrip('/')}"
    root_host = urllib.parse.urlparse(dav_root(cred)).netloc
    if urllib.parse.urlparse(url).netloc != root_host:
        return "Fehler: nur Adressen auf dem Server des Zugangs erlaubt"
    headers = {str(k): str(v) for k, v in (a.get("header") or {}).items()}
    if C.is_gwdg(cred):
        if (why := gwdg_allowed(cred, url, write=methode not in READ_METHODS)):
            return why
        # MOVE/COPY: auch das Ziel muss im Konto liegen und beschreibbar sein
        dest = next((v for k, v in headers.items() if k.lower() == "destination"), "")
        if dest:
            r = urllib.parse.urlparse(dav_root(cred))
            dest_url = (dest if dest.startswith("http") else f"{r.scheme}://{r.netloc}{dest}" if dest.startswith("/")
                        else f"{dav_root(cred)}/{dest}")
            if (why := gwdg_allowed(cred, dest_url, write=True)):
                return why
    body = a.get("inhalt")
    body = C.resolve_placeholders(body, ctx.creds, ctx.allowed_creds) if isinstance(body, str) else body
    try:
        async with ctx.session.request(methode, url, data=(body or None), auth=_auth(cred), headers=headers,
                                       timeout=aiohttp.ClientTimeout(total=90)) as r:
            raw, _ = await read_body(r, 2_000_000)
            text = raw.decode("utf-8", "ignore")
            etag = r.headers.get("ETag")
            return {"status": r.status, "etag": etag, "antwort": text[:60_000]}
    except aiohttp.ClientError as e:
        return f"Fehler: Keine Verbindung zu {root_host} ({type(e).__name__}: {e})"


def _ics_events(text: str) -> list[dict]:
    events = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", text.replace("\r\n ", "").replace("\n ", ""), re.S):
        ev = {}
        for line in block.strip().splitlines():
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            key = k.split(";")[0].upper()
            if key in ("SUMMARY", "DTSTART", "DTEND", "LOCATION", "UID", "STATUS", "RRULE", "TRANSP", "DESCRIPTION"):
                ev[key.lower()] = v.replace("\\n", "\n").replace("\\,", ",")[:500]
        events.append(ev)
    return events


def _day(value: str) -> str:
    """JJJJMMTT aus einem ICS- oder ISO-Datum (für den Vergleich reicht der Tag)."""
    return re.sub(r"\D", "", str(value or ""))[:8]


def in_range(ev: dict, von: str, bis: str) -> bool:
    """Liegt ein Termin (ganz oder teilweise) zwischen von und bis (JJJJ-MM-TT, bis exklusiv)?

    Wiederkehrende Termine zählen, solange sie vor ``bis`` beginnen und ihr UNTIL nicht vor ``von`` liegt – ihre
    einzelnen Wiederholungen rechnet das Modell aus der RRULE selbst aus.
    """
    start, lo, hi = _day(ev.get("dtstart")), _day(von), _day(bis)
    if not start or start >= hi:
        return False
    if ev.get("rrule"):
        until = re.search(r"UNTIL=(\d{8})", ev["rrule"])
        return not until or until.group(1) >= lo
    end = _day(ev.get("dtend")) or start
    return end >= lo if end == start else end > lo


async def _gwdg_events(ctx, cred: dict, kal: str, von: str, bis: str):
    """GWDG-Exchange über DavMail: den ganzen Kalender per GET holen und den Zeitraum hier filtern – genau so,
    wie calmerge ihn abruft. Eigene Kalender-REPORTs an DavMail sind dafür nicht nötig."""
    url = f"{dav_root(cred)}/{_q(kal)}/"
    try:
        async with ctx.session.get(url, auth=_auth(cred), timeout=aiohttp.ClientTimeout(total=120),
                                   headers={"Accept": "text/calendar, text/plain, */*"}) as r:
            if r.status in (401, 403):
                return f"Fehler: HTTP {r.status} – GWDG hat E-Mail-Adresse oder Passwort abgelehnt"
            if r.status >= 400:
                return f"Fehler: HTTP {r.status} – Kalender „{kal}“ im GWDG-Exchange nicht gefunden"
            raw, _ = await read_body(r, 30_000_000)
    except aiohttp.ClientError as e:
        return f"Fehler: Keine Verbindung zum DavMail-Server der GWDG ({type(e).__name__}: {e})"
    text = raw.decode("utf-8", "ignore")
    if "BEGIN:VCALENDAR" not in text:
        return "Fehler: DavMail hat keinen Kalender geliefert (stimmt die GWDG-E-Mail-Adresse?)"
    out = [ev for ev in _ics_events(text) if in_range(ev, von, bis)]
    return {"kalender": kal, "von": von, "bis": bis, "termine": sorted(out, key=lambda e: e.get("dtstart", ""))}


async def caldav_events(ctx, a: dict):
    cred = _cred(ctx, a.get("zugang", ""))
    user = (cred.get("fields") or {}).get("username") or ""
    gwdg = C.is_gwdg(cred)
    kal = str(a.get("kalender") or ("calendar" if gwdg else "personal")).strip("/")
    von = a.get("von") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bis = a.get("bis") or (datetime.now(timezone.utc) + timedelta(days=14)).strftime("%Y-%m-%d")
    if gwdg:
        if not C.access(cred, "calendar"):
            return (f"Fehler: Der GWDG-Zugang „{cred.get('name')}“ ist nicht für den Kalender freigegeben "
                    "(auf der Seite „Zugänge“ „Kalender“ anhaken).")
        return await _gwdg_events(ctx, cred, kal, von, bis)
    f = lambda d: re.sub(r"[-:]", "", d)[:8] + "T000000Z"  # noqa: E731
    body = (f'<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
            f'<d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR">'
            f'<c:comp-filter name="VEVENT"><c:time-range start="{f(von)}" end="{f(bis)}"/></c:comp-filter>'
            f'</c:comp-filter></c:filter></c:calendar-query>')
    url = f"{dav_root(cred)}/calendars/{_q(user)}/{_q(kal)}/"
    async with ctx.session.request("REPORT", url, data=body, auth=_auth(cred),
                                   headers={"Depth": "1", "Content-Type": "application/xml"},
                                   timeout=aiohttp.ClientTimeout(total=60)) as r:
        if r.status >= 400:
            return f"Fehler: HTTP {r.status} – Kalender „{kal}“ vorhanden? (dav_request PROPFIND calendars/{user}/ listet sie)"
        xml = await r.read()
    out = []
    for resp in ET.fromstring(xml).findall("d:response", NS):
        data = resp.findtext("d:propstat/d:prop/cal:calendar-data", "", NS)
        for ev in _ics_events(data):
            ev["href"] = resp.findtext("d:href", "", NS)
            ev["etag"] = (resp.findtext("d:propstat/d:prop/d:getetag", "", NS) or "").strip('"')
            out.append(ev)
    return {"kalender": kal, "von": von, "bis": bis, "termine": sorted(out, key=lambda e: e.get("dtstart", ""))}


Z = {"type": "string", "description": "Name des Zugangs (siehe Liste der Zugänge)"}
register(Tool("dav_list", "dav", "Listet einen Ordner in Nextcloud/WebDAV (Name, Größe, Datum, ETag).",
              obj({"zugang": Z, "pfad": {"type": "string", "description": "relativ zum Dateistamm, z. B. „Hof Share/Imkerei“"},
                   "tiefe": {"type": "integer", "description": "1–4 Ebenen"}}, ["zugang"]),
              dav_list, label="Ordner auflisten", icon="mdi:folder-network-outline"))
register(Tool("dav_read", "dav", "Liest eine Datei aus Nextcloud/WebDAV (Text, PDF, Bild per Bildmodell) oder speichert sie in den Arbeitsbereich.",
              obj({"zugang": Z, "pfad": {"type": "string"}, "frage": {"type": "string"}, "bild": {"type": "boolean"},
                   "speichern_als": {"type": "string", "description": "nur herunterladen in den Arbeitsbereich"}}, ["zugang", "pfad"]),
              dav_read, label="Datei aus Cloud lesen", icon="mdi:cloud-download-outline"))
register(Tool("dav_write", "dav", "Lädt eine Datei nach Nextcloud/WebDAV hoch (Inhalt als Text oder aus dem Arbeitsbereich).",
              obj({"zugang": Z, "pfad": {"type": "string"}, "inhalt": {"type": "string"},
                   "aus_arbeitsbereich": {"type": "string"}, "ueberschreiben": {"type": "boolean"}}, ["zugang", "pfad"]),
              dav_write, write=True, label="Datei in Cloud schreiben", icon="mdi:cloud-upload-outline"))
register(Tool("dav_request", "dav", "Freie WebDAV/CalDAV/CardDAV-Anfrage relativ zu /remote.php/dav/ (z. B. PROPFIND calendars/<user>/, REPORT, PUT .ics mit If-Match, DELETE); bei GWDG-Exchange-Zugängen relativ zum DavMail-Stamm des Kontos (calendar/, contacts/ …). Platzhalter {{cred:Name:feld}} im Inhalt erlaubt.",
              obj({"zugang": Z, "methode": {"type": "string"}, "pfad": {"type": "string"},
                   "header": {"type": "object"}, "inhalt": {"type": "string"}}, ["zugang", "methode", "pfad"]),
              dav_request, write=lambda a: str(a.get("methode") or "").upper() not in READ_METHODS,
              label="DAV-Anfrage", icon="mdi:calendar-sync-outline"))
register(Tool("caldav_events", "dav", "Liest Termine eines Nextcloud- oder GWDG-Exchange-Kalenders in einem Zeitraum.",
              obj({"zugang": Z, "kalender": {"type": "string", "description": "Kalender-ID, z. B. personal (Nextcloud); bei GWDG-Exchange weglassen"},
                   "von": {"type": "string", "description": "JJJJ-MM-TT"}, "bis": {"type": "string"}}, ["zugang"]),
              caldav_events, label="Termine lesen", icon="mdi:calendar-month-outline"))
