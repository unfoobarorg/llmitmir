"""E-Mail-Werkzeuge: Exchange über EWS, alles andere über IMAP/SMTP.

Welcher Weg gilt, entscheidet der Zugang (``credentials.is_ews``): Ein Exchange-Konto läuft vollständig über EWS –
so dokumentiert es die GWDG für Exchange-Konten (Apple Mail, „manuell konfigurieren“), IMAP ist dort nur die
eingeschränkte Alternative. Gmail, Posteo und Co. bleiben bei IMAP/SMTP.

Das Recht kommt aus dem Zugang (``credentials.access(cred, "mail")``): Ist das Postfach nur lesend freigegeben,
öffnet ``mailbox.Mailbox`` Ordner nur mit EXAMINE und lehnt jede Änderung ab; ``mail_send`` und ``mail_change``
brechen schon vor der Verbindung ab – beim EWS-Weg prüft dieselbe Stelle, bevor eine SOAP-Anfrage rausgeht.
Das Passwort selbst bekommt das Modell nie.
"""
from __future__ import annotations

import asyncio
import imaplib
import smtplib

from .. import credentials as C
from .. import mailbox as MB
from . import Tool, obj, register
from . import mail_ews as EW
from .dav import _cred

MAX_ATTACH = 25_000_000


class MailError(Exception):
    """Fehler, der so wie er ist an das Modell geht."""


def _account(ctx, name: str, write: bool = False) -> dict:
    cred = _cred(ctx, name)
    acc = C.access(cred, "mail")
    if not acc:
        raise MailError(f"Der Zugang „{cred.get('name')}“ ist nicht für das E-Mail-Postfach freigegeben"
                        + (" (Seite „Zugänge“: „E-Mail-Postfach“ anhaken)." if C.is_gwdg(cred) else "."))
    if write and acc != "write":
        raise MailError(f"Der Zugang „{cred.get('name')}“ darf das E-Mail-Postfach nur lesen – senden, verschieben, "
                        "markieren und löschen sind gesperrt. Die Person kann das auf der Seite „Zugänge“ ändern.")
    f = cred.get("fields") or {}
    ews = C.is_ews(cred)
    user = C.gwdg_email(f.get("username") or "") if cred.get("type") == "gwdg" else str(f.get("username") or "")
    if not user or not f.get("password"):
        raise MailError(f"Im Zugang „{cred.get('name')}“ fehlen Benutzername oder Passwort.")
    if not ews and not f.get("imap_host"):
        raise MailError(f"Im Zugang „{cred.get('name')}“ fehlt der IMAP-Server.")
    return {"cred": cred, "ews": ews, "imap": f.get("imap_host") or "", "smtp": f.get("smtp_host") or "",
            "user": user, "password": f["password"], "writable": acc == "write",
            "sender": str(f.get("from") or f.get("absender") or user)}


async def _run(fn):
    """IMAP/SMTP blockieren – im Thread ausführen und Fehler in Klartext übersetzen."""
    try:
        return await asyncio.to_thread(fn)
    except MailError as e:
        return f"Fehler: {e}"
    except MB.ReadOnly as e:
        return f"Fehler: {e}"
    except EW.MailEwsError as e:
        return f"Fehler: {e}"
    except (imaplib.IMAP4.error, smtplib.SMTPAuthenticationError) as e:
        text = str(e)
        if "LOGIN" in text.upper() or "AUTH" in text.upper() or isinstance(e, smtplib.SMTPAuthenticationError):
            return f"Fehler: Anmeldung abgelehnt ({text[:200]})"
        return f"Fehler: {text[:300]}"
    except smtplib.SMTPException as e:
        return f"Fehler beim Senden: {type(e).__name__}: {str(e)[:300]}"
    except (LookupError, ValueError) as e:
        return f"Fehler: {e}"
    except OSError as e:
        return f"Fehler: Keine Verbindung zum Mailserver ({type(e).__name__}: {e})"


async def _ews(fn):
    """EWS-Aufruf ausführen und Fehler in Klartext übersetzen (die EWS-Funktionen sind selbst async)."""
    try:
        return await fn()
    except MailError as e:
        return f"Fehler: {e}"
    except EW.MailEwsError as e:
        return f"Fehler: {e}"


def _safe(fn):
    """Fehler aus der Rechte- und Eingabeprüfung als Klartext statt als Ausnahme."""
    async def run(ctx, a: dict):
        try:
            return await fn(ctx, a)
        except MailError as e:
            return f"Fehler: {e}"

    run.__name__ = fn.__name__
    return run


def _box(acc: dict) -> MB.Mailbox:
    return MB.Mailbox(acc["imap"], acc["user"], acc["password"], acc["writable"], connect=_CONNECT.get("imap"))


_CONNECT: dict = {}  # Tests setzen hier Ersatz-Verbindungen ein


def _uids(a: dict, ews: bool = False) -> list[str]:
    """uids aus mail_list. Über IMAP sind das Zahlen, über EWS die ItemIds (lange Zeichenketten)."""
    raw = a.get("uids") if a.get("uids") is not None else [a.get("uid")]
    out = [str(x).strip() for x in (raw if isinstance(raw, list) else [raw]) if str(x or "").strip()]
    if not out or (not ews and not all(x.isdigit() for x in out)):
        raise MailError("uid bzw. uids (Zahlen aus mail_list) angeben" if not ews
                        else "uid bzw. uids (die Kennungen aus mail_list) angeben")
    return out


async def mail_folders(ctx, a: dict):
    acc = _account(ctx, a.get("zugang", ""))
    if acc["ews"]:
        return await _ews(lambda: EW.folders(ctx, acc["cred"]))

    def work():
        with _box(acc) as box:
            return {"ordner": [{"name": f["name"], "art": " ".join(x for x in f["flags"] if x.lower() in (
                "\\sent", "\\trash", "\\drafts", "\\junk", "\\archive", "\\inbox")) or None} for f in box.folders()]}

    return await _run(work)


async def mail_list(ctx, a: dict):
    acc = _account(ctx, a.get("zugang", ""))
    ordner = str(a.get("ordner") or "INBOX")
    anzahl = max(1, min(int(a.get("anzahl") or 20), 100))
    if acc["ews"]:
        out = await _ews(lambda: EW.list_messages(ctx, acc["cred"], a))
        if isinstance(out, dict):
            out["recht"] = C.ACCESS_LABELS["write" if acc["writable"] else "read"]
        return out

    def work():
        crit, literal = MB.search_criteria(a.get("suche"), a.get("absender"), a.get("von"), a.get("bis"),
                                           bool(a.get("ungelesen")))
        with _box(acc) as box:
            total, rows = box.search(ordner, crit, literal, anzahl)
        return {"ordner": ordner, "treffer": total, "gezeigt": len(rows), "nachrichten": rows,
                "recht": C.ACCESS_LABELS["write" if acc["writable"] else "read"]}

    return await _run(work)


async def mail_read(ctx, a: dict):
    acc = _account(ctx, a.get("zugang", ""))
    ordner = str(a.get("ordner") or "INBOX")
    uid = _uids(a, acc["ews"])[0]
    if acc["ews"]:
        return await _ews(lambda: EW.read_message(ctx, acc["cred"], a))

    def work():
        with _box(acc) as box:
            return box.fetch(ordner, uid)

    raw = await _run(work)
    if isinstance(raw, str):
        return raw
    out = MB.parse_message(raw)
    out.update(uid=uid, ordner=ordner)
    if a.get("anhaenge_speichern"):
        import email
        from email.policy import default as POLICY

        saved = []
        for att in MB.attachments(email.message_from_bytes(raw, policy=POLICY)):
            if len(att["data"]) > MAX_ATTACH:
                saved.append({"name": att["name"], "fehler": "größer als 25 MB"})
                continue
            saved.append(await ctx.store.async_write_file("chat", ctx.chat_id, att["name"], att["data"]))
        await ctx.emit_files()
        out["gespeichert"] = saved
    return out


async def mail_send(ctx, a: dict):
    acc = _account(ctx, a.get("zugang", ""), write=True)
    if not acc["ews"] and not acc["smtp"]:
        return f"Fehler: Im Zugang „{acc['cred'].get('name')}“ fehlt der SMTP-Server."
    an = str(a.get("an") or "").strip()
    if not an:
        return "Fehler: Empfänger (an) fehlt"
    files = []
    for name in a.get("anhaenge") or []:
        files.append((str(name).rsplit("/", 1)[-1], await ctx.store.async_read_file("chat", ctx.chat_id, str(name))))
    reply = a.get("antwort_auf") if isinstance(a.get("antwort_auf"), dict) else None
    if acc["ews"]:  # Exchange: senden über EWS, die Kopie legt der Server in „Gesendete Elemente“ ab
        return await _ews(lambda: EW.send_message(ctx, acc["cred"], a, files, reply))

    def work():
        ref = None
        if reply and reply.get("uid"):
            with _box(acc) as box:
                import email
                from email.policy import default as POLICY

                orig = email.message_from_bytes(box.fetch(str(reply.get("ordner") or "INBOX"), str(reply["uid"])),
                                                policy=POLICY)
                ref = {"message_id": str(orig.get("Message-ID") or ""), "references": str(orig.get("References") or "")}
        msg = MB.build_message(acc["sender"], an, str(a.get("betreff") or ""), str(a.get("text") or ""),
                               str(a.get("cc") or ""), str(a.get("bcc") or ""), ref, files)
        refused = MB.smtp_send(acc["smtp"], acc["user"], acc["password"], msg, connect=_CONNECT.get("smtp"))
        out = {"ok": True, "an": an, "betreff": msg["Subject"], "message_id": msg["Message-ID"]}
        if refused:
            out["abgelehnt"] = {k: str(v) for k, v in refused.items()}
        if a.get("kopie_in_gesendet", True):
            try:
                with _box(acc) as box:
                    sent = MB.find_special(box.folders(), "\\Sent", MB.SENT_NAMES)
                    if sent:
                        box.append(sent, bytes(msg))
                    out["kopie"] = f"in „{sent}“ abgelegt" if sent else "kein Ordner für Gesendetes gefunden"
            except Exception as e:  # noqa: BLE001 – die Mail ist raus, die Kopie ist Zugabe
                out["kopie"] = f"nicht abgelegt ({type(e).__name__})"
        return out

    return await _run(work)


ACTIONS = {"gelesen": ("+FLAGS", "\\Seen"), "ungelesen": ("-FLAGS", "\\Seen"),
           "markieren": ("+FLAGS", "\\Flagged"), "entmarkieren": ("-FLAGS", "\\Flagged")}


async def mail_change(ctx, a: dict):
    acc = _account(ctx, a.get("zugang", ""), write=True)
    ordner = str(a.get("ordner") or "INBOX")
    aktion = str(a.get("aktion") or "")
    uids = _uids(a, acc["ews"])
    if acc["ews"]:
        return await _ews(lambda: EW.change_messages(ctx, acc["cred"], a, uids))

    def work():
        with _box(acc) as box:
            if aktion in ACTIONS:
                box.store(ordner, uids, *ACTIONS[aktion])
                return {"ok": True, "aktion": aktion, "uids": uids}
            if aktion == "verschieben":
                ziel = str(a.get("ziel") or "").strip()
                if not ziel:
                    raise MailError("ziel (Ordnername aus mail_folders) fehlt")
                return {"ok": True, "aktion": box.move(ordner, uids, ziel), "ziel": ziel, "uids": uids}
            if aktion == "loeschen":  # in den Papierkorb, nicht endgültig
                trash = MB.find_special(box.folders(), "\\Trash", MB.TRASH_NAMES)
                if not trash:
                    raise MailError("Kein Papierkorb-Ordner gefunden – mit verschieben und ziel arbeiten")
                return {"ok": True, "aktion": f"in den Papierkorb „{trash}“ " + box.move(ordner, uids, trash),
                        "uids": uids}
            raise MailError(f"Unbekannte aktion „{aktion}“")

    return await _run(work)


Z = {"type": "string", "description": "Name des Zugangs (E-Mail- oder Exchange-Zugang mit Postfach)"}
O = {"type": "string", "description": "Ordner, Standard INBOX (Namen aus mail_folders)"}
register(Tool("mail_folders", "mail", "Listet die Ordner eines E-Mail-Postfachs.", obj({"zugang": Z}, ["zugang"]),
              _safe(mail_folders), label="Mail-Ordner", icon="mdi:folder-outline"))
register(Tool("mail_list", "mail",
              "Sucht Nachrichten in einem Ordner (neueste zuerst; ändert nichts, markiert nichts als gelesen).",
              obj({"zugang": Z, "ordner": O, "suche": {"type": "string", "description": "Text in Betreff/Inhalt"},
                   "absender": {"type": "string"}, "von": {"type": "string", "description": "ab JJJJ-MM-TT"},
                   "bis": {"type": "string", "description": "vor JJJJ-MM-TT"}, "ungelesen": {"type": "boolean"},
                   "anzahl": {"type": "integer", "description": "1–100, Standard 20"}}, ["zugang"]),
              _safe(mail_list), label="Mails suchen", icon="mdi:email-search-outline"))
register(Tool("mail_read", "mail",
              "Liest eine Nachricht (Kopf, Text, Anhänge) – ohne sie als gelesen zu markieren. Anhänge auf Wunsch in den Arbeitsbereich.",
              obj({"zugang": Z, "ordner": O, "uid": {"type": "string", "description": "UID bzw. Kennung aus mail_list"},
                   "anhaenge_speichern": {"type": "boolean"}}, ["zugang", "uid"]),
              _safe(mail_read), label="Mail lesen", icon="mdi:email-open-outline"))
register(Tool("mail_send", "mail",
              "Sendet eine E-Mail (nur wenn das Postfach des Zugangs „lesen und schreiben“ hat). Kopie landet in Gesendet.",
              obj({"zugang": Z, "an": {"type": "string", "description": "Empfänger, mehrere mit Komma"},
                   "betreff": {"type": "string"}, "text": {"type": "string"}, "cc": {"type": "string"},
                   "bcc": {"type": "string"},
                   "antwort_auf": {"type": "object", "description": "{ordner, uid} der Nachricht, auf die geantwortet wird"},
                   "anhaenge": {"type": "array", "items": {"type": "string"}, "description": "Dateien aus dem Arbeitsbereich"},
                   "kopie_in_gesendet": {"type": "boolean"}}, ["zugang", "an", "betreff", "text"]),
              _safe(mail_send), write=True, label="Mail senden", icon="mdi:send-outline"))
register(Tool("mail_change", "mail",
              "Ändert Nachrichten (nur bei „lesen und schreiben“): gelesen/ungelesen, markieren/entmarkieren, verschieben, "
              "loeschen (= in den Papierkorb).",
              obj({"zugang": Z, "ordner": O, "uids": {"type": "array", "items": {"type": "string"}},
                   "aktion": {"type": "string", "enum": [*ACTIONS, "verschieben", "loeschen"]},
                   "ziel": {"type": "string", "description": "Zielordner bei verschieben"}}, ["zugang", "uids", "aktion"]),
              _safe(mail_change), write=True, label="Mails ändern", icon="mdi:email-edit-outline"))
