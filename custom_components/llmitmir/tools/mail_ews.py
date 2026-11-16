"""E-Mail über Exchange Web Services (EWS) – dieselben Werkzeuge wie über IMAP, nur ein anderer Weg.

Die GWDG dokumentiert EWS als Weg für Exchange-Konten (Apple Mail, „manuell konfigurieren“); IMAP nennt sie nur als
eingeschränkte Alternative. Deshalb läuft bei einem Exchange-Zugang alles über eine Schnittstelle: Ordner, Nachrichten,
Senden, Zustände und Verschieben. Der MIME-Inhalt kommt als base64 zurück und geht durch denselben Parser wie bei
IMAP (``mailbox.parse_message``) – Text, Anhänge und Kopfzeilen verhalten sich also gleich.

Die Rechteprüfung bleibt in ``tools/mail.py``: Ist das Postfach nur lesend freigegeben, kommt hier keine schreibende
Operation an.
"""
from __future__ import annotations

import base64
import email
from email.policy import default as POLICY

from .. import credentials as C
from .. import ews as E
from .. import mailbox as MB

MAX_ATTACH = 25_000_000


class MailEwsError(Exception):
    """Fehler, der so wie er ist an das Modell geht."""


async def call(ctx, cred: dict, body: str) -> dict:
    """SOAP-Anfrage mit den Zugangsdaten des Exchange-Kontos."""
    user, password = C.ews_account(cred)
    try:
        return await E.call(ctx.session, C.ews_endpoint(cred), user, password, body, domain=C.ews_domain(cred))
    except E.EwsError as e:
        raise MailEwsError(str(e)) from e


def _server_key(cred: dict) -> str:
    """Schlüssel für das Gelernte über einen Server: EWS-Adresse plus Benutzername."""
    user, _ = C.ews_account(cred)
    return f"{C.ews_endpoint(cred)}|{user}"


async def _mail_fields(ctx, cred: dict) -> dict[str, str]:
    """Die Feld-Schreibweise dieses Servers – gemerkt oder jetzt ausgehandelt.

    Exchange-Server unterscheiden sich darin, ob sie Nachrichtenfelder unter ``item:`` oder ``message:``
    erwarten (der GWDG-Exchange nimmt eine Mischung). Statt eine Schreibweise zu raten, wird sie einmal
    ausgehandelt und je Server festgehalten.
    """
    store = getattr(ctx.manager, "ews", None)
    key = _server_key(cred)
    known = store.fields(key) if store else {}
    user, password = C.ews_account(cred)
    try:
        chosen = await E.negotiate_mail_fields(ctx.session, C.ews_endpoint(cred), user, password,
                                               domain=C.ews_domain(cred), known=known)
    except E.EwsError:
        return known
    if store and chosen != known:
        store.remember(key, chosen)
        await store.async_save()
    return chosen


def _check(out: dict, what: str) -> dict:
    """Antwort prüfen: Exchange meldet Fehler im SOAP-Body, nicht nur über den HTTP-Status."""
    if not out.get("ok"):
        raise MailEwsError(f"{what} fehlgeschlagen: {out.get('message') or out.get('code') or 'unbekannter Fehler'}")
    return out


async def folders(ctx, cred: dict, baum: bool = False, tiefe: int | None = None) -> dict:
    """Alle Ordner mit vollem Pfad (aus der Elternkette), Trennzeichen, ID und Zählern."""
    out = _check(await call(ctx, cred, E.find_folders()), "Ordner lesen")
    return MB.folder_out(E.folder_paths(E.parse_folders(out.get("raw") or "")), baum=baum, tiefe=tiefe)


async def _folder_list(ctx, cred: dict) -> list[dict]:
    """Ordner mit vollem Pfad – Grundlage für jede Namensauflösung."""
    out = await call(ctx, cred, E.find_folders())
    if not out.get("ok"):
        return []
    return E.folder_paths(E.parse_folders(out.get("raw") or ""))


async def list_messages(ctx, cred: dict, a: dict) -> dict:
    ordner = str(a.get("ordner") or "inbox")
    anzahl = max(1, min(int(a.get("anzahl") or 20), 100))
    if a.get("alle_ordner"):
        return await _list_all(ctx, cred, a, anzahl)
    folder_id = await _folder_id(ctx, cred, ordner, a.get("ordner_id"))
    fields = await _mail_fields(ctx, cred)
    out = _check(await call(ctx, cred, E.find_messages(
        folder_id, a.get("suche"), a.get("von"), a.get("bis"), bool(a.get("ungelesen")), anzahl,
        fields=fields)), "Nachrichten lesen")
    rows = E.parse_messages(out.get("raw") or "")
    # Absender filtert der Client: EWS kann „From“ nicht zuverlässig serverseitig durchsuchen
    who = str(a.get("absender") or "").strip().casefold()
    if who:
        rows = [r for r in rows if who in f"{r.get('von', '')} {r.get('von_name', '')}".casefold()]
    return {"ordner": ordner, "treffer": out.get("total") or len(rows), "gezeigt": len(rows), "nachrichten": rows}


async def read_message(ctx, cred: dict, a: dict) -> dict:
    uid = str(a.get("uid") or "").strip()
    out = _check(await call(ctx, cred, E.get_mime(uid, str(a.get("change_key") or ""))), "Nachricht lesen")
    raw = E.mime_content(out.get("raw") or "")
    if not raw:
        raise MailEwsError("Exchange hat keinen Inhalt zu dieser Nachricht geliefert (uid aus mail_list verwenden)")
    msg = MB.parse_message(raw)
    msg.update(uid=uid, ordner=str(a.get("ordner") or "inbox"))
    if a.get("anhaenge_speichern"):
        saved = []
        for att in MB.attachments(email.message_from_bytes(raw, policy=POLICY)):
            if len(att["data"]) > MAX_ATTACH:
                saved.append({"name": att["name"], "fehler": "größer als 25 MB"})
                continue
            saved.append(await ctx.store.async_write_file("chat", ctx.chat_id, att["name"], att["data"]))
        await ctx.emit_files()
        msg["gespeichert"] = saved
    return msg


async def send_message(ctx, cred: dict, a: dict, files: list[tuple[str, bytes]], reply: dict | None) -> dict:
    """Nachricht bauen und über Exchange senden; die Kopie legt der Server in „Gesendete Elemente“ ab."""
    # Absender ist die E-Mail-Adresse, nicht die Benutzerkennung (angemeldet wird als gwdg\kennung)
    sender = str((cred.get("fields") or {}).get("from") or (cred.get("fields") or {}).get("absender")
                 or C.ews_sender(cred))
    ref = None
    if reply and reply.get("uid"):
        out = _check(await call(ctx, cred, E.get_mime(str(reply["uid"]))), "Ursprungsnachricht lesen")
        raw = E.mime_content(out.get("raw") or "")
        if raw:
            orig = email.message_from_bytes(raw, policy=POLICY)
            ref = {"message_id": str(orig.get("Message-ID") or ""), "references": str(orig.get("References") or "")}
    msg = MB.build_message(sender, str(a.get("an") or ""), str(a.get("betreff") or ""), str(a.get("text") or ""),
                           str(a.get("cc") or ""), str(a.get("bcc") or ""), ref, files)
    mime = base64.b64encode(bytes(msg)).decode()
    _check(await call(ctx, cred, E.create_message_mime(mime)), "Senden")
    return {"ok": True, "an": str(a.get("an") or ""), "betreff": msg["Subject"], "message_id": msg["Message-ID"],
            "kopie": "in „Gesendete Elemente“ abgelegt"}


async def _update_fields(ctx, cred: dict, uid: str, change_key: str) -> dict[str, str]:
    """Wie dieser Server IsRead und Flag beim Ändern erwartet – gemerkt oder jetzt ausgehandelt."""
    store = getattr(ctx.manager, "ews", None)
    key = f"{_server_key(cred)}|update"
    known = store.fields(key) if store else {}
    user, password = C.ews_account(cred)
    try:
        chosen = await E.negotiate_update_fields(ctx.session, C.ews_endpoint(cred), user, password, uid,
                                                 change_key, domain=C.ews_domain(cred), known=known)
    except E.EwsError:
        return known
    if store and chosen != known:
        store.remember(key, chosen)
        await store.async_save()
    return chosen


async def _folder_id(ctx, cred: dict, ziel: str, ordner_id: str | None = None) -> str:
    """Ordner in eine FolderId auflösen – über die ID, den vollen Pfad oder ein eindeutiges letztes Segment.

    Exchange kennt nur wenige Standardordner (Posteingang, Gesendet, Papierkorb …). Alle anderen – etwa
    „Archiv“ oder „Microsoft 365/MPG“ – haben eine eigene FolderId; der Name allein führt zu „Id is malformed“.
    Deshalb wird der Ordner über die Ordnerliste gesucht, und zwar über den ganzen Baum: Ein Ordner, der unter
    „Microsoft 365“ hängt, ist über seinen Namen allein nicht eindeutig.
    """
    if str(ordner_id or "").strip():
        return str(ordner_id).strip()
    if ziel.casefold() in E.DISTINGUISHED:
        return ziel
    folders = await _folder_list(ctx, cred)
    if not folders:
        return ziel
    try:
        found = MB.resolve_folder(ziel, folders)
    except MB.FolderNotFound as e:
        raise MailEwsError(e.text()) from e
    return str(found.get("id") or ziel)


async def _list_all(ctx, cred: dict, a: dict, anzahl: int) -> dict:
    """Suche über alle Ordner: je Ordner eine Anfrage, Treffer mit Ordnerpfad.

    Robuster als jede Pfadauflösung – greift auch, wenn die Mail inzwischen woanders einsortiert ist. Kalender,
    Kontakte und Aufgaben bleiben außen vor; nicht lesbare Ordner werden übersprungen.
    """
    # Nur Mail-Ordner: Kalender, Kontakte und Aufgaben tragen eine eigene FolderClass (IPF.Appointment …)
    folders = [f for f in await _folder_list(ctx, cred)
               if str(f.get("art") or "IPF.Note") in ("", "IPF.Note")]
    fields = await _mail_fields(ctx, cred)
    who = str(a.get("absender") or "").strip().casefold()
    rows, total = [], 0
    for folder in folders[:80]:
        try:
            out = await call(ctx, cred, E.find_messages(
                str(folder.get("id") or ""), a.get("suche"), a.get("von"), a.get("bis"), bool(a.get("ungelesen")),
                anzahl, fields=fields))
        except (MailEwsError, E.EwsError):
            continue
        if not out.get("ok"):
            continue
        found = E.parse_messages(out.get("raw") or "")
        if who:
            found = [r for r in found if who in f"{r.get('von', '')} {r.get('von_name', '')}".casefold()]
        total += int(out.get("total") or len(found))
        rows += [{**r, "ordner": folder.get("pfad") or folder.get("name")} for r in found]
    rows.sort(key=lambda r: str(r.get("datum") or ""), reverse=True)
    return {"ordner": "*", "treffer": total, "gezeigt": len(rows[:anzahl]), "nachrichten": rows[:anzahl]}


async def _change_key(ctx, cred: dict, uid: str) -> str:
    """ChangeKey einer Nachricht holen – nötig für UpdateItem, sonst antwortet Exchange mit einem Fehler."""
    out = await call(ctx, cred, E.get_item(uid, shape="IdOnly"))
    if not out.get("ok"):
        return ""
    found = E.item_ids(out.get("raw") or "")
    return (found[0].get("change_key") or "") if found else ""


async def change_messages(ctx, cred: dict, a: dict, uids: list[str]) -> dict:
    aktion = str(a.get("aktion") or "")
    flags = {"gelesen": {"gelesen": True}, "ungelesen": {"gelesen": False},
             "markieren": {"markiert": True}, "entmarkieren": {"markiert": False}}
    if aktion in flags:
        for uid in uids:
            # Exchange verlangt beim Aendern einen ChangeKey (ErrorChangeKeyRequiredForWriteOperations).
            # Er wird mit einem GetItem geholt, damit die Person ihn nicht selbst mitliefern muss.
            key = await _change_key(ctx, cred, uid)
            fields = await _update_fields(ctx, cred, uid, key)
            # Die Aushandlung ändert die Nachricht selbst (sie probiert IsRead und Flag aus) und macht damit den
            # ChangeKey ungültig. Deshalb ihn danach neu holen – sonst antwortet Exchange mit
            # ErrorIrresolvableConflict („change key does not match“).
            key = await _change_key(ctx, cred, uid) or key
            _check(await call(ctx, cred, E.update_message(uid, key, fields=fields, **flags[aktion])),
                   f"„{aktion}“")
        return {"ok": True, "aktion": aktion, "uids": uids}
    if aktion == "verschieben":
        ziel = str(a.get("ziel") or "").strip()
        if not ziel and not str(a.get("ziel_id") or "").strip():
            raise MailEwsError("ziel (Ordnername aus mail_folders) fehlt")
        folder_id = await _folder_id(ctx, cred, ziel, a.get("ziel_id"))
        _check(await call(ctx, cred, E.move_items(uids, folder_id)), "Verschieben")
        return {"ok": True, "aktion": "verschoben", "ziel": ziel, "uids": uids}
    if aktion == "loeschen":  # in den Papierkorb, nicht endgültig
        _check(await call(ctx, cred, E.delete_messages(uids)), "Löschen")
        return {"ok": True, "aktion": "in den Papierkorb verschoben", "uids": uids}
    raise MailEwsError(f"Unbekannte aktion „{aktion}“")
