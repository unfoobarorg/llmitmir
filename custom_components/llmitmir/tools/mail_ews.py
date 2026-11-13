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


def _check(out: dict, what: str) -> dict:
    """Antwort prüfen: Exchange meldet Fehler im SOAP-Body, nicht nur über den HTTP-Status."""
    if not out.get("ok"):
        raise MailEwsError(f"{what} fehlgeschlagen: {out.get('message') or out.get('code') or 'unbekannter Fehler'}")
    return out


async def folders(ctx, cred: dict) -> dict:
    out = _check(await call(ctx, cred, E.find_folders()), "Ordner lesen")
    return {"ordner": [{"name": f["name"], "art": f.get("art") or None, "anzahl": f.get("anzahl", 0),
                        "ungelesen": f.get("ungelesen", 0)} for f in E.parse_folders(out.get("raw") or "")]}


async def list_messages(ctx, cred: dict, a: dict) -> dict:
    ordner = str(a.get("ordner") or "inbox")
    anzahl = max(1, min(int(a.get("anzahl") or 20), 100))
    out = _check(await call(ctx, cred, E.find_messages(
        ordner, a.get("suche"), a.get("von"), a.get("bis"), bool(a.get("ungelesen")), anzahl)), "Nachrichten lesen")
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


async def change_messages(ctx, cred: dict, a: dict, uids: list[str]) -> dict:
    aktion = str(a.get("aktion") or "")
    flags = {"gelesen": {"gelesen": True}, "ungelesen": {"gelesen": False},
             "markieren": {"markiert": True}, "entmarkieren": {"markiert": False}}
    if aktion in flags:
        for uid in uids:
            _check(await call(ctx, cred, E.update_message(uid, **flags[aktion])), f"„{aktion}“")
        return {"ok": True, "aktion": aktion, "uids": uids}
    if aktion == "verschieben":
        ziel = str(a.get("ziel") or "").strip()
        if not ziel:
            raise MailEwsError("ziel (Ordnername aus mail_folders) fehlt")
        _check(await call(ctx, cred, E.move_items(uids, ziel)), "Verschieben")
        return {"ok": True, "aktion": "verschoben", "ziel": ziel, "uids": uids}
    if aktion == "loeschen":  # in den Papierkorb, nicht endgültig
        _check(await call(ctx, cred, E.delete_messages(uids)), "Löschen")
        return {"ok": True, "aktion": "in den Papierkorb verschoben", "uids": uids}
    raise MailEwsError(f"Unbekannte aktion „{aktion}“")
