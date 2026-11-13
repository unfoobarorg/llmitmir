"""Exchange Web Services (EWS): Kalender und Kontakte direkt am Exchange, ohne DavMail.

Reine Funktionen zum Bauen und Auswerten der SOAP-Nachrichten (ohne Home Assistant testbar) und ein schlanker
Client. Die Rechteprüfung (nur lesen / lesen und schreiben) macht ``tools/ews.py`` – hier steht nur das Protokoll.

Warum EWS: Zeitbereichsabfragen beantwortet der Server selbst (FindItem + CalendarView), Einträge haben eine
stabile ItemId samt ChangeKey, und Teilnehmer, Einladungen und Antwortstände kommen sauber mit. Über CalDAV
(DavMail) musste dafür jedes Mal der ganze Kalender geholt und lokal gefiltert werden.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from typing import Any

import aiohttp

NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/"
NS_T = "http://schemas.microsoft.com/exchange/services/2006/types"
NS_M = "http://schemas.microsoft.com/exchange/services/2006/messages"
VERSION = "Exchange2013"
TIMEOUT = 60
MAX_ENTRIES = 500

# Antworten, die ein Werkzeug als abgelehnte Anmeldung werten darf (credcheck.AUTH_MARKERS)
ITEM_TAGS = ("CalendarItem", "Contact", "Message", "Task", "MeetingRequest", "MeetingCancellation")


def _esc(value: Any) -> str:
    return (str(value if value is not None else "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def envelope(body: str, version: str = VERSION) -> str:
    """SOAP-Umschlag um einen Body (die Operation selbst)."""
    return ('<?xml version="1.0" encoding="utf-8"?>'
            f'<soap:Envelope xmlns:soap="{NS_SOAP}" xmlns:t="{NS_T}" xmlns:m="{NS_M}">'
            f'<soap:Header><t:RequestServerVersion Version="{_esc(version)}"/></soap:Header>'
            f"<soap:Body>{body}</soap:Body></soap:Envelope>")


def _utc(value: str | datetime | None, fallback: datetime | None = None) -> datetime:
    """Datum/Zeit als bewusst einfacher Leser: ISO mit Offset, ISO ohne Offset (Ortszeit) oder JJJJ-MM-TT."""
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value or "").strip()
        if not raw:
            dt = fallback or datetime.now(timezone.utc)
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            dt = datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
        else:
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                dt = fallback or datetime.now(timezone.utc)
    return dt if dt.tzinfo else dt.astimezone()


def iso(value: str | datetime | None, fallback: datetime | None = None) -> str:
    """EWS-Zeitstempel in UTC (…Z) – so versteht CalendarView den Zeitraum eindeutig."""
    return _utc(value, fallback).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def window(von: str | None, bis: str | None) -> tuple[str, str]:
    """Zeitraum für CalendarView: von (Standard heute) bis (Standard 14 Tage später), immer UTC."""
    start = _utc(von, datetime.now(timezone.utc))
    if str(bis or "").strip():
        end = _utc(bis, start + timedelta(days=14))
    else:
        end = start + timedelta(days=14)
    if end <= start:
        end = start + timedelta(days=1)
    return iso(start), iso(end)


def _field(uri: str) -> str:
    return f'<t:FieldURI FieldURI="{_esc(uri)}"/>'


CALENDAR_FIELDS = ("item:Subject", "calendar:Start", "calendar:End", "calendar:Location", "calendar:IsAllDayEvent",
                   "calendar:Organizer", "calendar:RequiredAttendees", "calendar:OptionalAttendees",
                   "calendar:LegacyFreeBusyStatus", "item:Categories", "item:ItemClass")
CONTACT_FIELDS = ("contacts:DisplayName", "contacts:GivenName", "contacts:Surname", "contacts:CompanyName",
                  "contacts:JobTitle", "contacts:BusinessPhoneNumber", "contacts:MobilePhoneNumber")


def find_calendar(von: str | None = None, bis: str | None = None, max_entries: int = 200,
                  folder: str = "calendar") -> str:
    """Termine im Zeitraum – der Server filtert (CalendarView), es kommt kein Archiv mit."""
    start, end = window(von, bis)
    props = "".join(_field(f) for f in CALENDAR_FIELDS)
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>IdOnly</t:BaseShape><t:AdditionalProperties>{props}</t:AdditionalProperties></m:ItemShape>"
        f'<m:CalendarView MaxEntriesReturned="{max(1, min(int(max_entries or 200), MAX_ENTRIES))}" '
        f'StartDate="{start}" EndDate="{end}"/>'
        f'<m:ParentFolderIds><t:DistinguishedFolderId Id="{_esc(folder or "calendar")}"/></m:ParentFolderIds>'
        "</m:FindItem>")


def find_contacts(max_entries: int = 100, folder: str = "contacts") -> str:
    """Kontakte des Postfachs (Adressbuch-Ordner), ohne Volltextsuche – die macht der Aufrufer lokal."""
    props = "".join(_field(f) for f in CONTACT_FIELDS)
    props += '<t:IndexedFieldURI FieldURI="contacts:EmailAddress" FieldIndex="EmailAddress1"/>'
    props += '<t:IndexedFieldURI FieldURI="contacts:EmailAddress" FieldIndex="EmailAddress2"/>'
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>IdOnly</t:BaseShape><t:AdditionalProperties>{props}</t:AdditionalProperties></m:ItemShape>"
        f'<m:IndexedPageItemView MaxEntriesReturned="{max(1, min(int(max_entries or 100), MAX_ENTRIES))}" '
        'Offset="0" BasePoint="Beginning"/>'
        f'<m:ParentFolderIds><t:DistinguishedFolderId Id="{_esc(folder or "contacts")}"/></m:ParentFolderIds>'
        "</m:FindItem>")


def get_item(item_id: str, change_key: str = "", shape: str = "AllProperties") -> str:
    """Einen Eintrag vollständig lesen (Body, Teilnehmer, Zeiten …)."""
    ck = f' ChangeKey="{_esc(change_key)}"' if change_key else ""
    return envelope(
        "<m:GetItem>"
        f"<m:ItemShape><t:BaseShape>{_esc(shape)}</t:BaseShape></m:ItemShape>"
        f'<m:ItemIds><t:ItemId Id="{_esc(item_id)}"{ck}/></m:ItemIds>'
        "</m:GetItem>")


def _attendees(tag: str, people: list[str]) -> str:
    if not people:
        return ""
    inner = "".join(f"<t:Attendee><t:Mailbox><t:EmailAddress>{_esc(p)}</t:EmailAddress></t:Mailbox></t:Attendee>"
                    for p in people if str(p or "").strip())
    return f"<t:{tag}>{inner}</t:{tag}>" if inner else ""


def create_appointment(subject: str, start: str, end: str, body: str = "", location: str = "",
                       all_day: bool = False, required: list[str] | None = None,
                       optional: list[str] | None = None, categories: list[str] | None = None,
                       send_invitations: str = "SendToNone") -> str:
    """Termin anlegen. ``start``/``end`` sind ISO-Zeiten (mit Offset) oder JJJJ-MM-TT bei ganztägig."""
    cats = ("<t:Categories>" + "".join(f"<t:String>{_esc(c)}</t:String>" for c in categories or [] if str(c).strip())
            + "</t:Categories>") if categories else ""
    return envelope(
        f'<m:CreateItem SendMeetingInvitations="{_esc(send_invitations)}"><m:Items><t:CalendarItem>'
        f"<t:Subject>{_esc(subject)}</t:Subject>"
        + (f'<t:Body BodyType="Text">{_esc(body)}</t:Body>' if body else "")
        + f"<t:Start>{_esc(start)}</t:Start><t:End>{_esc(end)}</t:End>"
        + (f"<t:Location>{_esc(location)}</t:Location>" if location else "")
        + f"<t:IsAllDayEvent>{'true' if all_day else 'false'}</t:IsAllDayEvent>"
        + cats + _attendees("RequiredAttendees", required or []) + _attendees("OptionalAttendees", optional or [])
        + "</t:CalendarItem></m:Items></m:CreateItem>")


# Feldname -> (FieldURI, Element im CalendarItem)
UPDATE_FIELDS = {
    "betreff": ("item:Subject", "Subject"),
    "subject": ("item:Subject", "Subject"),
    "ort": ("calendar:Location", "Location"),
    "location": ("calendar:Location", "Location"),
    "start": ("calendar:Start", "Start"),
    "ende": ("calendar:End", "End"),
    "end": ("calendar:End", "End"),
    "text": ("item:Body", "Body"),
    "body": ("item:Body", "Body"),
    "ganztaegig": ("calendar:IsAllDayEvent", "IsAllDayEvent"),
    "all_day": ("calendar:IsAllDayEvent", "IsAllDayEvent"),
}


def update_appointment(item_id: str, change_key: str, fields: dict, send_invitations: str = "SendToNone") -> str:
    """Termin ändern: nur die angegebenen Felder (SetItemField), adressiert über die ItemId."""
    sets = []
    for key, value in (fields or {}).items():
        spec = UPDATE_FIELDS.get(str(key).strip().casefold())
        if not spec:
            continue
        uri, element = spec
        if element == "IsAllDayEvent":
            inner = f"<t:IsAllDayEvent>{'true' if value else 'false'}</t:IsAllDayEvent>"
        elif element == "Body":
            inner = f'<t:Body BodyType="Text">{_esc(value)}</t:Body>'
        else:
            inner = f"<t:{element}>{_esc(value)}</t:{element}>"
        sets.append(f'<t:SetItemField><t:FieldURI FieldURI="{uri}"/><t:CalendarItem>{inner}</t:CalendarItem></t:SetItemField>')
    if not sets:
        raise ValueError("Keine änderbaren Felder angegeben (betreff, ort, start, ende, text, ganztaegig)")
    ck = f' ChangeKey="{_esc(change_key)}"' if change_key else ""
    return envelope(
        f'<m:UpdateItem ConflictResolution="AutoResolve" SendMeetingInvitationsOrCancellations="{_esc(send_invitations)}">'
        f'<m:ItemChanges><t:ItemChange><t:ItemId Id="{_esc(item_id)}"{ck}/><t:Updates>'
        + "".join(sets)
        + "</t:Updates></t:ItemChange></m:ItemChanges></m:UpdateItem>")


def delete_item(item_id: str, change_key: str = "", mode: str = "MoveToDeletedItems",
                send_cancellations: str = "SendToNone") -> str:
    """Eintrag löschen (Standard: in den Papierkorb des Postfachs, nicht endgültig)."""
    ck = f' ChangeKey="{_esc(change_key)}"' if change_key else ""
    return envelope(
        f'<m:DeleteItem DeleteType="{_esc(mode)}" SendMeetingCancellations="{_esc(send_cancellations)}">'
        f'<m:ItemIds><t:ItemId Id="{_esc(item_id)}"{ck}/></m:ItemIds></m:DeleteItem>')


def get_folder(folder: str = "calendar") -> str:
    """Ordner lesen – billigste Anfrage für die Prüfung eines Zugangs."""
    return envelope(
        "<m:GetFolder><m:FolderShape><t:BaseShape>IdOnly</t:BaseShape></m:FolderShape>"
        f'<m:FolderIds><t:DistinguishedFolderId Id="{_esc(folder or "calendar")}"/></m:FolderIds></m:GetFolder>')


# ---------------------------------------------------------------- auswerten
def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _kids(el: ET.Element, name: str) -> list[ET.Element]:
    return [c for c in list(el) if _local(c.tag) == name]


def _kid(el: ET.Element, name: str) -> ET.Element | None:
    for c in list(el):
        if _local(c.tag) == name:
            return c
    return None


def _text(el: ET.Element | None, name: str) -> str:
    if el is None:
        return ""
    c = _kid(el, name)
    return (c.text or "").strip() if c is not None else ""


def _mailbox(el: ET.Element | None) -> dict:
    """Mailbox-Element (Organizer, Attendee) als {"name", "email"}."""
    if el is None:
        return {}
    box = _kid(el, "Mailbox") or el
    return {"name": _text(box, "Name"), "email": _text(box, "EmailAddress")}


def _attendees_of(el: ET.Element, name: str) -> list[dict]:
    out = []
    for group in _kids(el, name):
        for att in _kids(group, "Attendee"):
            box = _mailbox(att)
            if box.get("email") or box.get("name"):
                box["art"] = _text(att, "ResponseType") or _text(att, "AttendeeType")
                out.append(box)
    return out


def _item(el: ET.Element) -> dict:
    """Ein CalendarItem/Contact aus FindItem oder GetItem als flaches Wörterbuch."""
    out: dict[str, Any] = {"art": _local(el.tag)}
    iid = _kid(el, "ItemId")
    if iid is not None:
        out["item_id"] = iid.get("Id") or ""
        out["change_key"] = iid.get("ChangeKey") or ""
    for key, name in (("betreff", "Subject"), ("start", "Start"), ("ende", "End"), ("ort", "Location"),
                      ("ganztaegig", "IsAllDayEvent"), ("status", "LegacyFreeBusyStatus"), ("text", "Body"),
                      ("name", "DisplayName"), ("vorname", "GivenName"), ("nachname", "Surname"),
                      ("firma", "CompanyName"), ("position", "JobTitle"), ("telefon", "BusinessPhoneNumber"),
                      ("mobil", "MobilePhoneNumber"), ("item_class", "ItemClass")):
        value = _text(el, name)
        if value:
            out[key] = value
    org = _kid(el, "Organizer")
    if org is not None:
        out["organisator"] = _mailbox(org)
    for key, name in (("teilnehmer", "RequiredAttendees"), ("optionale", "OptionalAttendees")):
        people = _attendees_of(el, name)
        if people:
            out[key] = people
    cats = _kid(el, "Categories")
    if cats is not None:
        out["kategorien"] = [(c.text or "").strip() for c in _kids(cats, "String") if (c.text or "").strip()]
    mails = []
    for entry in _kids(el, "EmailAddresses"):
        for e in _kids(entry, "Entry"):
            value = (e.text or "").strip()
            if value:
                mails.append({"art": e.get("Key") or "", "adresse": value})
    if mails:
        out["adressen"] = mails
    return out


def parse(xml: str | bytes) -> dict:
    """Antwort auswerten: {"ok", "code", "message", "items", "total"}.

    ``ok`` ist False, sobald eine ResponseMessage nicht „NoError“ meldet – der Code (z. B.
    ErrorItemNotFound, ErrorAccessDenied) geht so an das Modell weiter, statt als Verbindungsfehler zu gelten.
    """
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        return {"ok": False, "code": "ParseError", "message": f"Antwort nicht lesbar: {e}", "items": [], "total": 0}
    fault = next((el for el in root.iter() if _local(el.tag) == "Fault"), None)
    if fault is not None:
        return {"ok": False, "code": _text(fault, "faultcode") or "SoapFault",
                "message": _text(fault, "faultstring") or "Exchange meldet einen SOAP-Fehler", "items": [], "total": 0}
    items: list[dict] = []
    total, code, message, ok = 0, "", "", True
    for msg in (el for el in root.iter() if _local(el.tag).endswith("ResponseMessage")):
        cls = msg.get("ResponseClass") or ""
        c = _text(msg, "ResponseCode")
        m = _text(msg, "MessageText")
        if cls and cls != "Success":
            ok = False
            code, message = c or code, m or message
        elif c and c != "NoError" and not code:
            code = c
        root_folder = _kid(msg, "RootFolder")
        if root_folder is not None:
            try:
                total = max(total, int(root_folder.get("TotalItemsInView") or 0))
            except ValueError:
                pass
        for holder in (el for el in msg.iter() if _local(el.tag) == "Items"):
            for child in list(holder):
                if _local(child.tag) in ITEM_TAGS:
                    items.append(_item(child))
    return {"ok": ok, "code": code, "message": message, "items": items, "total": total or len(items)}


def item_ids(xml: str | bytes) -> list[dict]:
    """ItemId/ChangeKey aus CreateItem/UpdateItem (für „angelegt“/„geändert“)."""
    out = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return out
    for el in root.iter():
        if _local(el.tag) == "ItemId" and el.get("Id"):
            out.append({"item_id": el.get("Id"), "change_key": el.get("ChangeKey") or ""})
    return out


# ---------------------------------------------------------------- Client
class EwsError(Exception):
    """Fehler, der so wie er ist an das Modell geht (Anmeldung, Adresse, Serverfehler)."""


async def call(session: aiohttp.ClientSession, endpoint: str, username: str, password: str, body: str,
               timeout: int = TIMEOUT) -> dict:
    """SOAP-Anfrage an den EWS-Endpunkt. Gibt ``parse()`` zurück, ergänzt um ``status``.

    HTTP 401/403 werden als abgelehnte Anmeldung gemeldet (nicht als Verbindungsfehler), 404 als falscher
    Endpunkt; nur echte Transportfehler (DNS, TLS, Zeitüberschreitung) heißen „keine Verbindung“.
    """
    if not endpoint:
        raise EwsError("Im Zugang fehlt die EWS-Adresse (z. B. https://email.gwdg.de/EWS/Exchange.asmx).")
    headers = {"Content-Type": "text/xml; charset=utf-8", "Accept": "text/xml, application/xml"}
    auth = aiohttp.BasicAuth(username, password) if username else None
    try:
        async with session.post(endpoint, data=body.encode("utf-8"), headers=headers, auth=auth,
                                timeout=aiohttp.ClientTimeout(total=timeout)) as r:
            raw = await r.read()
            status = r.status
    except aiohttp.ClientConnectorError as e:
        raise EwsError(f"Keine Verbindung zu {endpoint} ({type(e).__name__})") from e
    except aiohttp.ClientSSLError as e:
        raise EwsError(f"TLS-Fehler bei {endpoint} ({type(e).__name__})") from e
    except (aiohttp.ServerTimeoutError, TimeoutError) as e:
        raise EwsError(f"Zeitüberschreitung bei {endpoint}") from e
    except aiohttp.ClientError as e:
        raise EwsError(f"Keine Verbindung zu {endpoint} ({type(e).__name__}: {e})") from e
    text = raw.decode("utf-8", "ignore")
    if status in (401, 407):
        raise EwsError(f"HTTP {status}: Exchange hat Benutzername oder Passwort abgelehnt")
    if status == 403:
        raise EwsError("HTTP 403: Zugriff verweigert – das Konto darf EWS nicht nutzen")
    if status == 404:
        raise EwsError(f"HTTP 404: {endpoint} ist kein EWS-Endpunkt – stimmt die Adresse?")
    if status >= 500:
        raise EwsError(f"HTTP {status}: Exchange meldet einen Serverfehler")
    out = parse(text)
    out["status"] = status
    if not out["ok"] and out["code"] in ("ErrorAccessDenied", "ErrorInvalidCredentials", "ErrorMissingEmailAddress"):
        raise EwsError(f"{out['code']}: {out['message'] or 'Zugriff verweigert'}")
    return out


def describe_error(out: dict) -> str:
    """Kurzform für das Modell, wenn Exchange eine Operation abgelehnt hat."""
    return f"{out.get('code') or 'Fehler'}: {out.get('message') or 'Exchange hat die Anfrage abgelehnt'}"


def day(value: str) -> str:
    """JJJJ-MM-TT aus einem EWS-Zeitstempel (für Anzeige und Vergleiche)."""
    raw = str(value or "")
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else raw[:10]


def today() -> str:
    return date.today().isoformat()
