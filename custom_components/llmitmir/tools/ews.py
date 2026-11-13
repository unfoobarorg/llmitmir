"""Exchange Web Services: Termine und Kontakte direkt am Exchange (Typ ``ews`` und GWDG-Exchange).

Das Recht kommt aus dem Zugang (``credentials.access(cred, "calendar"|"contacts")``): Ist der Dienst nur lesend
freigegeben, lehnen ``ews_save`` und ``caldav_entry`` jede Änderung ab. Das Passwort bekommt das Modell nie.

Warum EWS statt CalDAV: Der Server filtert den Zeitraum selbst (CalendarView), jeder Eintrag hat eine stabile
ItemId samt ChangeKey, und Ändern/Löschen adressiert genau diesen Eintrag – unabhängig von Dateinamen oder href.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .. import credentials as C
from .. import ews as E
from . import Tool, obj, register
from .dav import _cred

Z = {"type": "string", "description": "Name des Zugangs (siehe Liste der Zugänge)"}
ACTION = {"type": "string", "enum": ["anlegen", "aendern", "loeschen"],
          "description": "anlegen = neuer Termin, aendern/loeschen = bestehender Termin per item_id"}


def _account(ctx, name: str, service: str, write: bool = False) -> dict:
    cred = _cred(ctx, name)
    if not C.is_ews(cred):
        raise E.EwsError(f"Der Zugang „{cred.get('name')}“ läuft nicht über EWS – für Kalender und Kontakte "
                         "eines Nextcloud-Zugangs caldav_events und dav_request nutzen.")
    acc = C.access(cred, service)
    label = C.TYPES["ews" if cred.get("type") == "ews" else "gwdg"]["services"].get(service, service)
    if not acc:
        raise E.EwsError(f"Der Zugang „{cred.get('name')}“ ist nicht für {label} freigegeben "
                         "(Seite „Zugänge“: den Dienst anhaken).")
    if write and acc != "write":
        raise E.EwsError(f"Der Zugang „{cred.get('name')}“ darf {label} nur lesen – anlegen, ändern und löschen sind "
                         "gesperrt. Die Person kann das auf der Seite „Zugänge“ ändern.")
    return cred


async def _call(ctx, cred: dict, body: str) -> dict:
    user, password = C.ews_account(cred)
    return await E.call(ctx.session, C.ews_endpoint(cred), user, password, body, domain=C.ews_domain(cred))


def _tz():
    """Zeitzone von Home Assistant (Europe/Berlin) – ohne Import auf Modulebene, damit die Tests ohne HA laufen."""
    try:
        from homeassistant.util import dt as dt_util

        return dt_util.DEFAULT_TIME_ZONE
    except Exception:  # noqa: BLE001 – außerhalb von Home Assistant gilt die Zeitzone des Systems
        return datetime.now().astimezone().tzinfo or timezone.utc


def _local(value: str) -> str:
    """EWS-Zeitstempel in der Zeitzone von Home Assistant (Europe/Berlin), mit Offset."""
    raw = str(value or "").strip()
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_tz()).isoformat(timespec="minutes")


def _when(value: str) -> str:
    """Zeit für EWS: ``JJJJ-MM-TTTHH:MM:SS+HH:MM``.

    Exchange lehnt ein Datum mit ``ErrorInvalidValueForProperty`` ab, wenn der Offset ohne Doppelpunkt steht
    (``+0100``) – ``%z`` liefert genau das. Deshalb wird der Offset von Hand gesetzt. Ohne Offset gilt die Ortszeit
    von Home Assistant; ``JJJJ-MM-TT`` wird 00:00.
    """
    raw = str(value or "").strip()
    if not raw:
        raise E.EwsError("Start und Ende fehlen (ISO-Zeit wie 2026-11-20T14:00 oder JJJJ-MM-TT bei ganztägig).")
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as e:
        raise E.EwsError(f"„{raw}“ ist keine gültige Zeit (ISO wie 2026-11-20T14:00 erwartet).") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_tz())
    offset = dt.utcoffset() or timedelta(0)
    total = int(offset.total_seconds())
    sign = "+" if total >= 0 else "-"
    hours, minutes = divmod(abs(total) // 60, 60)
    return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}{sign}{hours:02d}:{minutes:02d}"


def _shape(items: list[dict]) -> list[dict]:
    """Termine für das Modell: Zeiten lesbar, ItemId zum Wiederfinden."""
    out = []
    for it in items:
        row = dict(it)
        for key in ("start", "ende"):
            if row.get(key):
                row[key] = _local(row[key])
        if row.get("text"):
            row["text"] = row["text"][:2000]
        out.append(row)
    return out


async def ews_events(ctx, a: dict):
    cred = _account(ctx, a.get("zugang", ""), "calendar")
    von, bis = E.window(a.get("von"), a.get("bis"))
    out = await _call(ctx, cred, E.find_calendar(von, bis, int(a.get("anzahl") or 200)))
    if not out["ok"]:
        return f"Fehler: {E.describe_error(out)}"
    termine = _shape(out["items"])
    return {"zugang": cred.get("name"), "von": _local(von), "bis": _local(bis),
            "anzahl": len(termine), "termine": sorted(termine, key=lambda e: e.get("start") or "")}


async def ews_contacts(ctx, a: dict):
    cred = _account(ctx, a.get("zugang", ""), "contacts")
    out = await _call(ctx, cred, E.find_contacts(int(a.get("anzahl") or 200)))
    if not out["ok"]:
        return f"Fehler: {E.describe_error(out)}"
    needle = str(a.get("suche") or "").strip().casefold()
    rows = []
    for it in out["items"]:
        if needle:
            hay = " ".join(str(it.get(k) or "") for k in ("name", "vorname", "nachname", "firma", "position")).casefold()
            mails = " ".join(m.get("adresse", "") for m in it.get("adressen") or []).casefold()
            if needle not in hay and needle not in mails:
                continue
        rows.append(it)
    return {"zugang": cred.get("name"), "anzahl": len(rows), "kontakte": rows}


async def ews_save(ctx, a: dict):
    """Termin anlegen, ändern oder löschen – geändert und gelöscht wird über die ItemId aus ews_events."""
    cred = _account(ctx, a.get("zugang", ""), "calendar", write=True)
    aktion = str(a.get("aktion") or "anlegen").strip().casefold()
    senden = {"keine": "SendToNone", "alle": "SendToAllAndSaveCopy", "teilnehmer": "SendOnlyToAll"}.get(
        str(a.get("einladungen") or "keine").strip().casefold(), "SendToNone")
    if aktion == "anlegen":
        start, ende = _when(a.get("start")), _when(a.get("ende"))
        body = E.create_appointment(
            str(a.get("betreff") or "").strip() or "(ohne Betreff)", start, ende,
            body=str(a.get("text") or ""), location=str(a.get("ort") or ""),
            all_day=bool(a.get("ganztaegig")),
            required=[x for x in str(a.get("teilnehmer") or "").replace(";", ",").split(",") if x.strip()],
            optional=[x for x in str(a.get("optionale") or "").replace(";", ",").split(",") if x.strip()],
            categories=[x for x in str(a.get("kategorien") or "").replace(";", ",").split(",") if x.strip()],
            send_invitations=senden)
        out = await _call(ctx, cred, body)
        if not out["ok"]:
            return f"Fehler: {E.describe_error(out)}"
        ids = E.item_ids(out.get("raw") or "") or []
        return {"ok": True, "aktion": "angelegt", "betreff": a.get("betreff"), "start": _local(start),
                "ende": _local(ende), "item_id": (ids[0]["item_id"] if ids else ""),
                "hinweis": "Zum Ändern oder Löschen die item_id merken (oder mit ews_events neu holen)."}
    item_id = str(a.get("item_id") or "").strip()
    if not item_id:
        return "Fehler: Für ändern und löschen brauche ich die item_id (aus ews_events)."
    change_key = str(a.get("change_key") or "").strip()
    if aktion == "loeschen":
        out = await _call(ctx, cred, E.delete_item(item_id, change_key, send_cancellations=senden))
        if not out["ok"]:
            return f"Fehler: {E.describe_error(out)}"
        return {"ok": True, "aktion": "geloescht", "item_id": item_id,
                "hinweis": "Der Termin liegt im Papierkorb des Postfachs."}
    if aktion != "aendern":
        return f"Fehler: Unbekannte Aktion „{aktion}“ (anlegen, aendern, loeschen)."
    fields: dict = {}
    for key in ("betreff", "ort", "text"):
        if a.get(key) not in (None, ""):
            fields[key] = a[key]
    if a.get("start"):
        fields["start"] = _when(a.get("start"))
    if a.get("ende"):
        fields["ende"] = _when(a.get("ende"))
    if a.get("ganztaegig") is not None:
        fields["ganztaegig"] = bool(a.get("ganztaegig"))
    if not fields:
        return "Fehler: Nichts zu ändern – betreff, ort, text, start, ende oder ganztaegig angeben."
    out = await _call(ctx, cred, E.update_appointment(item_id, change_key, fields, send_invitations=senden))
    if not out["ok"]:
        return f"Fehler: {E.describe_error(out)}"
    return {"ok": True, "aktion": "geaendert", "item_id": item_id, "felder": sorted(fields)}


register(Tool("ews_events", "ews", "Liest Termine eines Exchange-Kalenders (EWS) in einem Zeitraum – der Server filtert, "
              "es kommt kein Archiv. Liefert je Termin item_id und change_key für Ändern und Löschen.",
              obj({"zugang": Z, "von": {"type": "string", "description": "JJJJ-MM-TT oder ISO-Zeit (Standard heute)"},
                   "bis": {"type": "string", "description": "JJJJ-MM-TT oder ISO-Zeit (Standard 14 Tage später)"},
                   "anzahl": {"type": "integer", "description": "höchstens so viele Termine (Standard 200)"}}, ["zugang"]),
              ews_events, label="Termine lesen (Exchange)", icon="mdi:calendar-month-outline"))
register(Tool("ews_contacts", "ews", "Sucht Kontakte im Exchange-Adressbuch (EWS) – Name, Firma, Telefon, E-Mail.",
              obj({"zugang": Z, "suche": {"type": "string", "description": "Text in Name, Firma oder E-Mail-Adresse"},
                   "anzahl": {"type": "integer", "description": "höchstens so viele Kontakte (Standard 200)"}}, ["zugang"]),
              ews_contacts, label="Kontakte lesen (Exchange)", icon="mdi:account-box-outline"))
register(Tool("ews_save", "ews", "Legt einen Exchange-Termin an oder ändert/löscht einen bestehenden über seine item_id "
              "(aus ews_events). Einladungen an Teilnehmer optional.",
              obj({"zugang": Z, "aktion": ACTION,
                   "item_id": {"type": "string", "description": "nur bei ändern und löschen"},
                   "change_key": {"type": "string", "description": "optional, aus ews_events"},
                   "betreff": {"type": "string"}, "start": {"type": "string", "description": "ISO-Zeit oder JJJJ-MM-TT"},
                   "ende": {"type": "string", "description": "ISO-Zeit oder JJJJ-MM-TT"},
                   "ganztaegig": {"type": "boolean"}, "ort": {"type": "string"}, "text": {"type": "string"},
                   "teilnehmer": {"type": "string", "description": "E-Mail-Adressen, mit Komma getrennt"},
                   "optionale": {"type": "string", "description": "E-Mail-Adressen, mit Komma getrennt"},
                   "kategorien": {"type": "string", "description": "mit Komma getrennt"},
                   "einladungen": {"type": "string", "enum": ["keine", "teilnehmer", "alle"],
                                   "description": "keine (Standard), teilnehmer = nur Einladungen senden, alle = senden und Kopie speichern"}},
                  ["zugang", "aktion"]),
              ews_save, write=True, label="Termin speichern (Exchange)", icon="mdi:calendar-plus"))
