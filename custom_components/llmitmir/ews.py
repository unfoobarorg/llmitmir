"""Exchange Web Services (EWS): Postfach, Kalender und Kontakte direkt am Exchange.

Reine Funktionen zum Bauen und Auswerten der SOAP-Nachrichten (ohne Home Assistant testbar) und ein schlanker
Client. Die Rechteprüfung (nur lesen / lesen und schreiben) macht ``tools/ews.py`` bzw. ``tools/mail.py`` – hier
steht nur das Protokoll.

Warum EWS: Zeitbereichsabfragen beantwortet der Server selbst (FindItem + CalendarView), Einträge haben eine
stabile ItemId samt ChangeKey, und Teilnehmer, Einladungen und Antwortstände kommen sauber mit. Über CalDAV
(DavMail) musste dafür jedes Mal der ganze Kalender geholt und lokal gefiltert werden. Für das Postfach gilt
dasselbe: Die GWDG dokumentiert EWS als Weg für Exchange-Konten (Apple Mail, „manuell konfigurieren“), IMAP nur
als eingeschränkte Alternative – deshalb laufen Mails, Kalender und Kontakte über eine Schnittstelle.
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
            # Ein reines Datum ist ein Kalendertag in der Ortszeit, nicht in UTC: 24.11. heißt in Berlin
            # 00:00 Ortszeit (= 23:00 UTC am Vortag). Mit UTC-Mitternacht landet ein ganztägiger Termin
            # einen Tag zu früh im Kalender.
            dt = datetime.fromisoformat(raw).replace(tzinfo=_zone())
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


def indexed(uri: str, index: str) -> str:
    """Feld mit Index, z. B. die Telefonnummern eines Kontakts (contacts:PhoneNumber + FieldIndex)."""
    return f'<t:IndexedFieldURI FieldURI="{_esc(uri)}" FieldIndex="{_esc(index)}"/>'


CALENDAR_FIELDS = ("item:Subject", "calendar:Start", "calendar:End", "calendar:Location", "calendar:IsAllDayEvent",
                   "calendar:Organizer", "calendar:RequiredAttendees", "calendar:OptionalAttendees",
                   "calendar:LegacyFreeBusyStatus", "item:Categories", "item:ItemClass")
# Kontaktfelder. Telefonnummern sind indizierte Felder: ``contacts:BusinessPhoneNumber`` lehnt der GWDG-Exchange
# mit HTTP 500 ab, ``contacts:PhoneNumber`` mit FieldIndex nimmt er an (einzeln gegen den Server geprüft).
CONTACT_FIELDS = ("contacts:DisplayName", "contacts:GivenName", "contacts:Surname", "contacts:CompanyName",
                  "contacts:JobTitle")
CONTACT_PHONES = (("BusinessPhone", "telefon"), ("MobilePhone", "mobil"), ("HomePhone", "privat"))

# Telefonnummern sind in EWS immer indizierte Felder (contacts:PhoneNumber mit FieldIndex). Manche Server nehmen
# stattdessen eigene Feldnamen – deshalb wird auch hier ausgehandelt statt geraten.
CONTACT_PHONE_VARIANTS: dict[str, tuple[str, ...]] = {
    "telefon": ("contacts:PhoneNumber#BusinessPhone", "contacts:BusinessPhoneNumber", "contacts:PhoneNumber#HomePhone"),
    "mobil": ("contacts:PhoneNumber#MobilePhone", "contacts:MobilePhoneNumber"),
    "privat": ("contacts:PhoneNumber#HomePhone", "contacts:HomePhoneNumber"),
}


def probe_contact_phone(field: str, folder: str = "contacts") -> str:
    """FindItem auf Kontakte mit genau einem Telefonfeld – um eine Schreibweise einzeln zu prüfen."""
    if "#" in field:
        uri, index = field.split("#", 1)
        extra = f'<t:IndexedFieldURI FieldURI="{uri}" FieldIndex="{index}"/>'
    else:
        extra = _field(field)
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>Default</t:BaseShape><t:AdditionalProperties>{extra}"
        "</t:AdditionalProperties></m:ItemShape>"
        '<m:IndexedPageItemView MaxEntriesReturned="1" Offset="0" BasePoint="Beginning"/>'
        f"<m:ParentFolderIds>{folder_ref(folder)}</m:ParentFolderIds>"
        "</m:FindItem>")


def contact_props(phones: dict[str, str] | None = None) -> str:
    """Die Zusatzfelder für FindItem auf Kontakte (``phones`` = Ergebnis der Aushandlung)."""
    props = "".join(_field(f) for f in CONTACT_FIELDS)
    props += '<t:IndexedFieldURI FieldURI="contacts:EmailAddress" FieldIndex="EmailAddress1"/>'
    props += '<t:IndexedFieldURI FieldURI="contacts:EmailAddress" FieldIndex="EmailAddress2"/>'
    for key, variants in CONTACT_PHONE_VARIANTS.items():
        choice = (phones or {}).get(key) or variants[0]
        if "#" in choice:  # indiziertes Feld: contacts:PhoneNumber#BusinessPhone
            uri, index = choice.split("#", 1)
            props += f'<t:IndexedFieldURI FieldURI="{uri}" FieldIndex="{index}"/>'
        else:  # eigener Feldname
            props += _field(choice)
    return props

CONTACT_FIELD_CANDIDATES = tuple(CONTACT_FIELDS) + tuple(
    indexed("contacts:PhoneNumber", i) for i, _ in CONTACT_PHONES)


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


def find_contacts(max_entries: int = 100, folder: str = "contacts",
                  phones: dict[str, str] | None = None) -> str:
    """Kontakte des Postfachs (Adressbuch-Ordner), ohne Volltextsuche – die macht der Aufrufer lokal.

    ``phones`` ist das Ergebnis der Aushandlung (negotiate_contact_phones) – ohne Angabe gilt die Vorgabe.
    """
    props = contact_props(phones)
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>Default</t:BaseShape><t:AdditionalProperties>{props}</t:AdditionalProperties></m:ItemShape>"
        f'<m:IndexedPageItemView MaxEntriesReturned="{max(1, min(int(max_entries or 100), MAX_ENTRIES))}" '
        'Offset="0" BasePoint="Beginning"/>'
        f"<m:ParentFolderIds>{folder_ref(folder or 'contacts')}</m:ParentFolderIds>"
        "</m:FindItem>")


async def negotiate_update_fields(session, endpoint: str, username: str, password: str, item_id: str,
                                  change_key: str, domain: str = "", known: dict[str, str] | None = None,
                                  timeout: int = TIMEOUT) -> dict[str, str]:
    """Herausfinden, welche Feld-Schreibweise dieser Server beim Ändern einer Nachricht nimmt.

    Probiert an einer echten Nachricht die Varianten für IsRead und Flag durch. Der Aufruf setzt dabei den
    Lesestatus bzw. die Markierung – der Aufrufer stellt danach den gewünschten Zustand, das ist unkritisch.
    """
    chosen = dict(known or {})
    # Ist fuer jede Gruppe schon eine gueltige Variante gemerkt, ist nichts zu tun – dann wird die Nachricht
    # nicht angefasst und der ChangeKey bleibt gueltig.
    if all(chosen.get(k) in v for k, v in UPDATE_FIELD_VARIANTS.items()):
        return chosen
    for key, variants in UPDATE_FIELD_VARIANTS.items():
        current = chosen.get(key) or variants[0]
        if current not in variants:
            continue
        for variant in variants[variants.index(current):]:
            candidate = dict(chosen)
            candidate[key] = variant
            # gelesen=True ist der harmloseste Test: eine ungelesene Mail wird gelesen, mehr nicht
            body = update_message(item_id, change_key, gelesen=True if key == "read" else None,
                                  markiert=False if key == "flag" else None, fields=candidate)
            try:
                out = await call(session, endpoint, username, password, body, timeout=timeout, domain=domain)
            except EwsError:
                continue
            if out.get("ok"):
                chosen = candidate
                break
    return chosen


async def negotiate_contact_phones(session, endpoint: str, username: str, password: str, domain: str = "",
                                   known: dict[str, str] | None = None, timeout: int = TIMEOUT) -> dict[str, str]:
    """Herausfinden, wie dieser Server Telefonnummern in Kontakten liefert.

    Vorgabe ist das indizierte Feld (``contacts:PhoneNumber`` mit FieldIndex). Nimmt der Server das nicht, werden
    je Nummer die Alternativen probiert. Ergebnis: Nummer-Art -> Feldangabe.
    """
    chosen = dict(known or {})
    # Jede Nummer-Art einzeln prüfen – ein Fehler bei „mobil“ darf nicht verdecken, dass „telefon“ passt.
    for key, variants in CONTACT_PHONE_VARIANTS.items():
        current = chosen.get(key) or variants[0]
        order = [current] + [v for v in variants if v != current]
        for variant in order:
            try:
                out = await call(session, endpoint, username, password, probe_contact_phone(variant),
                                 timeout=timeout, domain=domain)
            except EwsError:
                continue
            if out.get("ok"):
                chosen[key] = variant
                break
    return chosen


def probe_field(folder: str, field: str) -> str:
    """Eine FindItem-Anfrage mit genau einem Zusatzfeld – für die Fehlersuche, welches Feld der Server ablehnt.

    ``field`` ist entweder eine Feld-URI (``item:Subject``) oder bereits ein fertiges XML-Fragment
    (``<t:IndexedFieldURI …/>``).
    """
    inner = field if str(field).lstrip().startswith("<") else _field(field)
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>IdOnly</t:BaseShape><t:AdditionalProperties>{inner}"
        "</t:AdditionalProperties></m:ItemShape>"
        '<m:IndexedPageItemView MaxEntriesReturned="1" Offset="0" BasePoint="Beginning"/>'
        f"<m:ParentFolderIds>{folder_ref(folder)}</m:ParentFolderIds>"
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
                       send_invitations: str = "SendToNone", time_zone: str = "") -> str:
    """Termin anlegen. ``start``/``end`` sind ISO-Zeiten (mit Offset) oder JJJJ-MM-TT bei ganztägig.

    ``time_zone`` ist eine Windows-Zeitzonen-ID (z. B. ``W. Europe Standard Time``). Sie wird als
    ``StartTimeZone``/``EndTimeZone`` mitgeschickt und ist bei **ganztägigen** Terminen nötig: Ohne sie liest
    Exchange die lokale Mitternacht als UTC-Datum und legt den Termin einen Tag zu früh ab.
    """
    cats = ("<t:Categories>" + "".join(f"<t:String>{_esc(c)}</t:String>" for c in categories or [] if str(c).strip())
            + "</t:Categories>") if categories else ""
    zones = ""
    if time_zone:
        zones = (f'<t:StartTimeZone Id="{_esc(time_zone)}"/><t:EndTimeZone Id="{_esc(time_zone)}"/>')
    return envelope(
        f'<m:CreateItem SendMeetingInvitations="{_esc(send_invitations)}"><m:Items><t:CalendarItem>'
        f"<t:Subject>{_esc(subject)}</t:Subject>"
        + (f'<t:Body BodyType="Text">{_esc(body)}</t:Body>' if body else "")
        + f"<t:Start>{_esc(start)}</t:Start><t:End>{_esc(end)}</t:End>"
        + (f"<t:Location>{_esc(location)}</t:Location>" if location else "")
        + f"<t:IsAllDayEvent>{'true' if all_day else 'false'}</t:IsAllDayEvent>"
        + zones
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


# ---------------------------------------------------------------- Postfach
# Feld-URIs für FindItem auf Nachrichten (Kopfzeilen und Zustand, ohne den Text).
#
# Exchange kennt für Nachrichtenfelder zwei Namensräume, ``item:`` und ``message:``. Welcher Server welche
# Eigenschaft in welchem Namensraum erwartet, ist nicht einheitlich: Der GWDG-Exchange nimmt Betreff, Größe, Datum
# und Klasse nur unter ``item:``, Lesestatus, Absender und Empfängerlisten dagegen nur unter ``message:``.
# Deshalb wird nicht geraten, sondern ausgehandelt (siehe MAIL_FIELD_GROUPS und negotiate_mail_fields): Diese
# Werte sind der Ausgangspunkt, bei einem Fehler probiert LLMitMir die Alternativen durch und merkt sich das
# Ergebnis je Zugang.
MAIL_FIELDS = ("item:Subject", "item:DateTimeReceived", "item:DateTimeSent", "item:HasAttachments",
               "item:Size", "item:ItemClass", "item:Flag",
               "message:IsRead", "message:From", "message:ToRecipients", "message:CcRecipients")

# Je Eigenschaft die möglichen Schreibweisen, in der Reihenfolge, in der sie probiert werden. Die erste ist die
# Vorgabe (die der GWDG-Exchange nimmt). Wird eine Gruppe abgelehnt, wird die nächste Variante getestet.
MAIL_FIELD_GROUPS: dict[str, tuple[str, ...]] = {
    "subject": ("item:Subject", "message:Subject"),
    "received": ("item:DateTimeReceived", "message:DateTimeReceived"),
    "sent": ("item:DateTimeSent", "message:DateTimeSent"),
    "attachments": ("item:HasAttachments", "message:HasAttachments"),
    "size": ("item:Size", "message:Size"),
    "class": ("item:ItemClass", "message:ItemClass"),
    "flag": ("item:Flag", "message:Flag"),
    "read": ("message:IsRead", "item:IsRead"),
    "from": ("message:From", "item:From"),
    "to": ("message:ToRecipients", "item:ToRecipients"),
    "cc": ("message:CcRecipients", "item:CcRecipients"),
}

# Alle Kandidaten – für die Fehlersuche in der Diagnose
MAIL_FIELD_CANDIDATES = tuple(f for variants in MAIL_FIELD_GROUPS.values() for f in variants)


def mail_fields(chosen: dict[str, str] | None = None) -> tuple[str, ...]:
    """Die Feld-URIs für FindItem aus einer Aushandlung (oder die Vorgabe)."""
    if not chosen:
        return MAIL_FIELDS
    return tuple(chosen.get(group, variants[0]) for group, variants in MAIL_FIELD_GROUPS.items())


def probe_mail_field(field: str, folder: str = "inbox") -> str:
    """FindItem mit genau einem Zusatzfeld – um zu testen, ob der Server diese Schreibweise annimmt.

    BaseShape=Default liefert die Standardfelder; das eine Feld kommt zusätzlich dazu. So lässt sich jede
    Schreibweise einzeln prüfen, ohne dass ein anderes, ebenfalls falsches Feld die Antwort verfälscht.
    """
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        f"<m:ItemShape><t:BaseShape>Default</t:BaseShape><t:AdditionalProperties>{_field(field)}"
        "</t:AdditionalProperties></m:ItemShape>"
        '<m:IndexedPageItemView MaxEntriesReturned="1" Offset="0" BasePoint="Beginning"/>'
        f"<m:ParentFolderIds>{folder_ref(folder)}</m:ParentFolderIds>"
        "</m:FindItem>")


# Ordnernamen, die Exchange selbst kennt (DistinguishedFolderId) – alles andere ist eine FolderId oder ein Name
DISTINGUISHED = {
    "inbox": "inbox", "posteingang": "inbox", "eingang": "inbox",
    "contacts": "contacts", "kontakte": "contacts", "adressbuch": "contacts",
    "sent": "sentitems", "sentitems": "sentitems", "gesendet": "sentitems", "gesendete objekte": "sentitems",
    "gesendete elemente": "sentitems",
    "trash": "deleteditems", "deleteditems": "deleteditems", "papierkorb": "deleteditems",
    "gelöschte elemente": "deleteditems", "geloeschte elemente": "deleteditems",
    "drafts": "drafts", "entwürfe": "drafts", "entwuerfe": "drafts",
    "outbox": "outbox", "postausgang": "outbox", "msgfolderroot": "msgfolderroot", "root": "msgfolderroot",
}


def folder_ref(folder: str | None) -> str:
    """Ordner für eine Anfrage: bekannter Name → DistinguishedFolderId, sonst die FolderId selbst."""
    raw = str(folder or "inbox").strip()
    known = DISTINGUISHED.get(raw.casefold())
    if known:
        return f'<t:DistinguishedFolderId Id="{_esc(known)}"/>'
    return f'<t:FolderId Id="{_esc(raw)}"/>'


def find_folders(root: str = "msgfolderroot") -> str:
    """Alle Ordner des Postfachs (Name, Id, Anzahl, ungelesen) – Grundlage für mail_folders."""
    return envelope(
        '<m:FindFolder Traversal="Deep">'
        "<m:FolderShape><t:BaseShape>Default</t:BaseShape></m:FolderShape>"
        '<m:IndexedPageFolderView MaxEntriesReturned="500" Offset="0" BasePoint="Beginning"/>'
        f"<m:ParentFolderIds>{folder_ref(root)}</m:ParentFolderIds>"
        "</m:FindFolder>")


def _restriction(suche: str | None = None, von: str | None = None, bis: str | None = None,
                 ungelesen: bool = False) -> str:
    """Suchbedingung für FindItem: Text im Betreff, Zeitraum, ungelesen – der Server filtert, nicht der Client."""
    parts = []
    if str(suche or "").strip():
        parts.append('<t:Contains ContainmentMode="Substring" ContainmentComparison="IgnoreCase">'
                     '<t:FieldURI FieldURI="item:Subject"/>'
                     f'<t:Constant Value="{_esc(suche)}"/></t:Contains>')
    if str(von or "").strip():
        parts.append("<t:IsGreaterThanOrEqualTo><t:FieldURI FieldURI=\"item:DateTimeReceived\"/>"
                     f'<t:FieldURIOrConstant><t:Constant Value="{iso(von)}"/></t:FieldURIOrConstant>'
                     "</t:IsGreaterThanOrEqualTo>")
    if str(bis or "").strip():
        parts.append("<t:IsLessThan><t:FieldURI FieldURI=\"item:DateTimeReceived\"/>"
                     f'<t:FieldURIOrConstant><t:Constant Value="{iso(bis)}"/></t:FieldURIOrConstant>'
                     "</t:IsLessThan>")
    if ungelesen:
        parts.append('<t:IsEqualTo><t:FieldURI FieldURI="message:IsRead"/>'
                     '<t:FieldURIOrConstant><t:Constant Value="false"/></t:FieldURIOrConstant></t:IsEqualTo>')
    if not parts:
        return ""
    inner = parts[0] if len(parts) == 1 else "<t:And>" + "".join(parts) + "</t:And>"
    return f"<m:Restriction>{inner}</m:Restriction>"


def find_messages(folder: str | None = "inbox", suche: str | None = None, von: str | None = None,
                  bis: str | None = None, ungelesen: bool = False, max_entries: int = 20,
                  fields: dict[str, str] | None = None) -> str:
    """Nachrichten eines Ordners, neueste zuerst. Der Server filtert und sortiert; der Text bleibt draußen.

    ``fields`` ist das Ergebnis der Aushandlung (negotiate_mail_fields) – ohne Angabe gilt die Vorgabe.
    """
    props = "".join(_field(f) for f in mail_fields(fields))
    return envelope(
        '<m:FindItem Traversal="Shallow">'
        # BaseShape=Default, nicht IdOnly: IsRead, From und die Empfängerlisten gibt es bei IdOnly nicht,
        # Exchange lehnt die Anfrage dann mit HTTP 500 („The request is invalid“) ab.
        f"<m:ItemShape><t:BaseShape>Default</t:BaseShape><t:AdditionalProperties>{props}</t:AdditionalProperties></m:ItemShape>"
        f'<m:IndexedPageItemView MaxEntriesReturned="{max(1, min(int(max_entries or 20), MAX_ENTRIES))}" '
        'Offset="0" BasePoint="Beginning"/>'
        '<m:SortOrder><t:FieldOrder Order="Descending"><t:FieldURI FieldURI="item:DateTimeReceived"/>'
        "</t:FieldOrder></m:SortOrder>"
        + _restriction(suche, von, bis, ungelesen)
        + f"<m:ParentFolderIds>{folder_ref(folder)}</m:ParentFolderIds>"
        "</m:FindItem>")


async def negotiate_mail_fields(session, endpoint: str, username: str, password: str, domain: str = "",
                                known: dict[str, str] | None = None, folder: str = "inbox",
                                timeout: int = TIMEOUT) -> dict[str, str]:
    """Herausfinden, welche Feld-Schreibweise dieser Exchange-Server für Nachrichten nimmt.

    Ausgangspunkt ist ``known`` (die beim letzten Mal gefundene Belegung) oder die Vorgabe. Schlägt die Anfrage
    fehl, wird Gruppe für Gruppe die nächste Variante probiert, bis der Server die Anfrage annimmt. Das Ergebnis
    ist ein Wörterbuch Gruppe -> Feld-URI und wird von der Aufruferseite je Zugang gemerkt.

    Gibt bei einem Server, der gar nicht antwortet, die zuletzt gefundene (oder die Vorgabe-)Belegung zurück –
    dann scheitert der eigentliche Aufruf mit der echten Fehlermeldung, statt hier zu verschwinden.
    """
    chosen = dict(known or {})
    # Jede Gruppe einzeln prüfen: FindItem mit genau diesem einen Feld. Die bekannte (oder Vorgabe-)Variante
    # zuerst; nimmt der Server sie nicht, die Alternativen der Reihe nach. Ein Fehler in einer Gruppe kann so
    # nicht die anderen verdecken.
    for group, variants in MAIL_FIELD_GROUPS.items():
        current = chosen.get(group) or variants[0]
        order = [current] + [v for v in variants if v != current]
        for variant in order:
            try:
                out = await call(session, endpoint, username, password, probe_mail_field(variant, folder),
                                 timeout=timeout, domain=domain)
            except EwsError:
                continue
            if out.get("ok"):
                chosen[group] = variant
                break
    return chosen


def get_mime(item_id: str, change_key: str = "") -> str:
    """Eine Nachricht als vollständige MIME-Datei (base64) – damit gilt derselbe Parser wie bei IMAP."""
    ck = f' ChangeKey="{_esc(change_key)}"' if change_key else ""
    return envelope(
        "<m:GetItem><m:ItemShape><t:BaseShape>IdOnly</t:BaseShape>"
        "<t:IncludeMimeContent>true</t:IncludeMimeContent></m:ItemShape>"
        f'<m:ItemIds><t:ItemId Id="{_esc(item_id)}"{ck}/></m:ItemIds></m:GetItem>')


def create_message_mime(mime_b64: str, disposition: str = "SendAndSaveCopy") -> str:
    """Nachricht aus einer fertigen MIME-Datei senden (Anhänge, Kopfzeilen, Antwortbezug inklusive).

    ``SendAndSaveCopy`` legt die Kopie in „Gesendete Elemente“ ab – wie es ein Mailprogramm tut.
    """
    return envelope(
        f'<m:CreateItem MessageDisposition="{_esc(disposition)}"><m:Items><t:Message>'
        f'<t:MimeContent CharacterSet="UTF-8">{mime_b64}</t:MimeContent>'
        "</t:Message></m:Items></m:CreateItem>")


def probe_update(item_id: str, change_key: str, field: str, inner: str) -> str:
    """Eine UpdateItem-Anfrage mit genau einem Feld – für die Fehlersuche, welche Schreibweise der Server nimmt."""
    return envelope(
        '<m:UpdateItem ConflictResolution="AutoResolve" MessageDisposition="SaveOnly">'
        f'<m:ItemChanges><t:ItemChange><t:ItemId Id="{_esc(item_id)}" ChangeKey="{_esc(change_key)}"/><t:Updates>'
        f'<t:SetItemField><t:FieldURI FieldURI="{_esc(field)}"/><t:Message>{inner}</t:Message></t:SetItemField>'
        "</t:Updates></t:ItemChange></m:ItemChanges></m:UpdateItem>")


# Beim Schreiben (UpdateItem) gilt dieselbe Unsicherheit wie beim Lesen: IsRead nimmt der GWDG-Exchange nur als
# message:IsRead, Flag nur als item:Flag. Andere Server können es andersherum erwarten – deshalb auch hier
# Varianten, die nacheinander probiert werden.
UPDATE_FIELD_VARIANTS: dict[str, tuple[str, ...]] = {
    "read": ("message:IsRead", "item:IsRead"),
    "flag": ("item:Flag", "message:Flag"),
}


def update_message(item_id: str, change_key: str = "", gelesen: bool | None = None,
                  markiert: bool | None = None, fields: dict[str, str] | None = None) -> str:
    """Zustand einer Nachricht setzen: gelesen/ungelesen, markiert/nicht markiert."""
    sets = []
    if gelesen is not None:
        uri = (fields or {}).get("read") or UPDATE_FIELD_VARIANTS["read"][0]
        sets.append(f'<t:SetItemField><t:FieldURI FieldURI="{_esc(uri)}"/><t:Message>'
                    f"<t:IsRead>{'true' if gelesen else 'false'}</t:IsRead></t:Message></t:SetItemField>")
    if markiert is not None:
        flag = ('<t:Flag><t:FlagStatus>Flagged</t:FlagStatus></t:Flag>' if markiert
                else '<t:Flag><t:FlagStatus>NotFlagged</t:FlagStatus></t:Flag>')
        uri = (fields or {}).get("flag") or UPDATE_FIELD_VARIANTS["flag"][0]
        sets.append(f'<t:SetItemField><t:FieldURI FieldURI="{_esc(uri)}"/><t:Message>'
                    f"{flag}</t:Message></t:SetItemField>")
    if not sets:
        raise ValueError("Nichts zu ändern (gelesen oder markiert angeben)")
    ck = f' ChangeKey="{_esc(change_key)}"' if change_key else ""
    return envelope(
        '<m:UpdateItem ConflictResolution="AutoResolve" MessageDisposition="SaveOnly">'
        f'<m:ItemChanges><t:ItemChange><t:ItemId Id="{_esc(item_id)}"{ck}/><t:Updates>'
        + "".join(sets)
        + "</t:Updates></t:ItemChange></m:ItemChanges></m:UpdateItem>")


def move_items(ids: list[str], ziel: str) -> str:
    """Nachrichten in einen anderen Ordner verschieben (Ids als ItemId)."""
    inner = "".join(f'<t:ItemId Id="{_esc(i)}"/>' for i in ids if str(i or "").strip())
    return envelope(
        f"<m:MoveItem><m:ToFolderId>{folder_ref(ziel)}</m:ToFolderId>"
        f"<m:ItemIds>{inner}</m:ItemIds></m:MoveItem>")


def delete_messages(ids: list[str], mode: str = "MoveToDeletedItems") -> str:
    """Nachrichten löschen (Standard: in den Papierkorb, nicht endgültig)."""
    inner = "".join(f'<t:ItemId Id="{_esc(i)}"/>' for i in ids if str(i or "").strip())
    return envelope(f'<m:DeleteItem DeleteType="{_esc(mode)}"><m:ItemIds>{inner}</m:ItemIds></m:DeleteItem>')


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
                      ("firma", "CompanyName"), ("position", "JobTitle"), ("item_class", "ItemClass")):
        value = _text(el, name)
        if value:
            out[key] = value
    # Telefonnummern kommen als indizierte Felder: <PhoneNumbers><Entry FieldIndex="BusinessPhone">...
    entries = [e for box in _kids(el, "PhoneNumbers") for e in _kids(box, "Entry")]
    entries += _kids(el, "PhoneNumber")  # falls der Server sie einzeln liefert
    for entry in entries:
        index = (entry.get("FieldIndex") or "").casefold()
        value = (entry.text or "").strip()
        if not value:
            continue
        for idx, key in CONTACT_PHONES:
            if idx.casefold() == index:
                out[key] = value
                break
        else:
            out.setdefault("telefon", value)
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


def parse_folders(xml: str | bytes) -> list[dict]:
    """Ordner aus FindFolder: {"name", "id", "anzahl", "ungelesen", "art"}."""
    out: list[dict] = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return out
    for el in root.iter():
        if _local(el.tag) != "Folder":
            continue
        fid = _kid(el, "FolderId")
        name = _text(el, "DisplayName")
        if fid is None or not fid.get("Id") or not name:
            continue
        entry = {"name": name, "id": fid.get("Id") or "", "art": _text(el, "FolderClass")}
        for key, tag in (("anzahl", "TotalCount"), ("ungelesen", "UnreadCount")):
            try:
                entry[key] = int(_text(el, tag) or 0)
            except ValueError:
                entry[key] = 0
        out.append(entry)
    return out


def parse_messages(xml: str | bytes) -> list[dict]:
    """Nachrichten aus FindItem: {"uid" (= ItemId), "betreff", "von", "datum", "ungelesen", "anhaenge", "groesse"}."""
    out: list[dict] = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return out
    for el in root.iter():
        if _local(el.tag) != "Message":
            continue
        iid = _kid(el, "ItemId")
        if iid is None or not iid.get("Id"):
            continue
        sender = _mailbox(_kid(el, "From"))
        to = [_mailbox(a) for a in _kids(_kid(el, "ToRecipients") or ET.Element("x"), "Mailbox")]
        entry = {
            "uid": iid.get("Id") or "",
            "change_key": iid.get("ChangeKey") or "",
            "betreff": _text(el, "Subject"),
            "von": sender.get("email") or sender.get("name") or "",
            "von_name": sender.get("name") or "",
            "an": [t.get("email") for t in to if t.get("email")],
            "datum": _local_time(_text(el, "DateTimeReceived") or _text(el, "DateTimeSent")),
            "ungelesen": _text(el, "IsRead").lower() != "true",
            "anhaenge": _text(el, "HasAttachments").lower() == "true",
        }
        size = _text(el, "Size")
        if size.isdigit():
            entry["groesse"] = int(size)
        flag = _kid(el, "Flag")
        if flag is not None and _text(flag, "FlagStatus") == "Flagged":
            entry["markiert"] = True
        out.append(entry)
    return out


def mime_content(xml: str | bytes) -> bytes:
    """MIME-Inhalt (base64) aus GetItem als Bytes – leer, wenn die Antwort keinen enthält."""
    import base64

    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return b""
    for el in root.iter():
        if _local(el.tag) == "MimeContent" and (el.text or "").strip():
            try:
                return base64.b64decode("".join((el.text or "").split()))
            except (ValueError, TypeError):
                return b""
    return b""


def _local_time(value: str) -> str:
    """EWS-Zeitstempel (UTC) in der Zeitzone von Home Assistant (Europe/Berlin), mit Offset."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_zone()).isoformat(timespec="minutes")


def _zone():
    """Zeitzone von Home Assistant, sonst Europe/Berlin – ohne Import auf Modulebene (Tests ohne HA)."""
    try:
        from homeassistant.util import dt as dt_util

        return dt_util.DEFAULT_TIME_ZONE
    except Exception:  # noqa: BLE001
        try:
            from zoneinfo import ZoneInfo

            return ZoneInfo("Europe/Berlin")
        except Exception:  # noqa: BLE001
            return datetime.now().astimezone().tzinfo or timezone.utc


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


async def _post(session: aiohttp.ClientSession, endpoint: str, body: bytes, headers: dict,
                auth: aiohttp.BasicAuth | None, timeout: int):
    """Eine POST-Anfrage; gibt Status, Inhalt und Kopfzeilen zurück (für den NTLM-Handschlag nötig).

    Die Kopfzeilen bleiben als Mehrfach-Wert erhalten: Der Server schickt ``WWW-Authenticate`` zweimal
    (``Negotiate`` und ``NTLM <Challenge>``), und ein einfaches Wörterbuch würde eine davon verlieren.
    """
    try:
        async with session.post(endpoint, data=body, headers=headers, auth=auth,
                                timeout=aiohttp.ClientTimeout(total=timeout)) as r:
            return r.status, await r.read(), r.headers
    except aiohttp.ClientConnectorError as e:
        raise EwsError(f"Keine Verbindung zu {endpoint} ({type(e).__name__})") from e
    except aiohttp.ClientSSLError as e:
        raise EwsError(f"TLS-Fehler bei {endpoint} ({type(e).__name__})") from e
    except (aiohttp.ServerTimeoutError, TimeoutError) as e:
        raise EwsError(f"Zeitüberschreitung bei {endpoint}") from e
    except aiohttp.ClientError as e:
        raise EwsError(f"Keine Verbindung zu {endpoint} ({type(e).__name__}: {e})") from e


def _auth_headers(headers) -> list[str]:
    """Alle ``WWW-Authenticate``-Werte einer Antwort (der Server schickt oft mehrere)."""
    try:
        return [str(v) for v in headers.getall("WWW-Authenticate", [])]
    except AttributeError:
        return [str(v) for k, v in dict(headers or {}).items() if str(k).lower() == "www-authenticate"]


def _ntlm_challenge(headers) -> bytes | None:
    """Die Type-2-Nachricht aus ``WWW-Authenticate: NTLM <base64>`` holen (None, wenn der Server nur „NTLM“ sagt)."""
    import base64

    for value in _auth_headers(headers):
        for part in str(value).split(","):
            piece = part.strip()
            if piece.upper().startswith("NTLM ") and len(piece) > 5:
                try:
                    return base64.b64decode(piece[5:].strip())
                except (ValueError, TypeError):
                    return None
    return None


async def call(session: aiohttp.ClientSession, endpoint: str, username: str, password: str, body: str,
               timeout: int = TIMEOUT, domain: str = "") -> dict:
    """SOAP-Anfrage an den EWS-Endpunkt. Gibt ``parse()`` zurück, ergänzt um ``status``.

    Erst Basic Auth. Antwortet der Server mit 401 und bietet nur ``Negotiate``/``NTLM`` an (so macht es der
    GWDG-Exchange), wird derselbe Aufruf mit NTLMv2 wiederholt – Basic Auth ist dort schlicht abgeschaltet.
    HTTP 401/403 werden als abgelehnte Anmeldung gemeldet (nicht als Verbindungsfehler), 404 als falscher
    Endpunkt; nur echte Transportfehler (DNS, TLS, Zeitüberschreitung) heißen „keine Verbindung“.
    """
    if not endpoint:
        raise EwsError("Im Zugang fehlt die EWS-Adresse (z. B. https://email.gwdg.de/EWS/Exchange.asmx).")
    headers = {"Content-Type": "text/xml; charset=utf-8", "Accept": "text/xml, application/xml"}
    payload = body.encode("utf-8")
    auth = aiohttp.BasicAuth(username, password) if username else None
    status, raw, reply = await _post(session, endpoint, payload, headers, auth, timeout)
    if status == 401 and username:
        offered = " ".join(_auth_headers(reply)).lower()
        if "ntlm" in offered or "negotiate" in offered:
            status, raw, reply = await _ntlm_post(session, endpoint, payload, headers, username, password,
                                                  domain, timeout)
    text = raw.decode("utf-8", "ignore")
    if status in (401, 407):
        raise EwsError(f"HTTP {status}: Exchange hat Benutzername oder Passwort abgelehnt")
    if status == 403:
        raise EwsError("HTTP 403: Zugriff verweigert – das Konto darf EWS nicht nutzen")
    if status == 404:
        raise EwsError(f"HTTP 404: {endpoint} ist kein EWS-Endpunkt – stimmt die Adresse?")
    if status >= 500:
        # Die Antwort enthält oft den Grund (z. B. ErrorInvalidServerVersion) – ohne ihn ist die Meldung nutzlos
        detail = parse(text)
        hint = detail.get("message") or detail.get("code") or ""
        if not hint:
            import re as _re

            found = _re.search(r"<(?:(?:\w+):)?(?:faultstring|MessageText|ResponseCode)>([^<]{1,300})<", text)
            hint = found.group(1).strip() if found else text.strip()[:300]
        raise EwsError(f"HTTP {status}: Exchange meldet einen Serverfehler" + (f" – {hint}" if hint else ""))
    out = parse(text)
    out["status"] = status
    out["raw"] = text  # vollständig: bei vielen Ordnern/Nachrichten reichen 4000 Zeichen nicht
    if not out["ok"] and out["code"] in ("ErrorAccessDenied", "ErrorInvalidCredentials", "ErrorMissingEmailAddress"):
        raise EwsError(f"{out['code']}: {out['message'] or 'Zugriff verweigert'}")
    return out


async def _ntlm_post(session: aiohttp.ClientSession, endpoint: str, payload: bytes, headers: dict,
                     username: str, password: str, domain: str, timeout: int) -> tuple[int, bytes, dict]:
    r"""Anmeldung mit NTLMv2: Type 1 → Type 2 (Challenge) → Type 3 (Beweis), dann die eigentliche Anfrage.

    Die GWDG dokumentiert die Zugangsdaten als ``gwdg\userid`` – Kennung ohne ``@gwdg.de``, Domäne ``gwdg``.
    Genau damit beginnt ``ntlm.candidates``; weitere Schreibweisen folgen nur, falls der Server die erste ablehnt.

    Wichtig: Jeder Versuch braucht einen **eigenen** Handschlag. Eine Challenge ist nach einem 401 verbraucht –
    ein zweiter Type 3 auf dieselbe Challenge scheitert zwangsläufig, auch mit richtigen Zugangsdaten.
    """
    import base64

    from . import ntlm as N

    tried: list[str] = []
    for user, dom in N.candidates(username, domain):
        tried.append(f"{dom}\\{user}" if dom else user)
        h = dict(headers)
        h["Authorization"] = "NTLM " + base64.b64encode(N.type1(dom)).decode()
        status, raw, reply = await _post(session, endpoint, payload, h, None, timeout)
        challenge = _ntlm_challenge(reply)
        if status != 401 or not challenge:
            return status, raw, reply  # angenommen (oder ein anderer Fehler als die Anmeldung)
        info = N.parse_type2(challenge)
        h["Authorization"] = "NTLM " + base64.b64encode(N.type3(
            user, password, dom, info["challenge"], info["target_info"], info["flags"])).decode()
        status, raw, reply = await _post(session, endpoint, payload, h, None, timeout)
        if status != 401:
            return status, raw, reply
    # Alle Schreibweisen abgelehnt: das ist ein Hinweis auf die Zugangsdaten, nicht auf die Verbindung
    raise EwsError(
        "HTTP 401: Exchange hat die Anmeldung abgelehnt (NTLM-Handschlag lief, Kennwort oder Benutzername "
        f"stimmen nicht). Probiert: {', '.join(tried)}"
    )


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
