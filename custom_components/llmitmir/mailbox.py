"""E-Mail über IMAP/SMTP für die mail_*-Werkzeuge – ohne Home Assistant testbar.

Lesen und Schreiben sind schon hier getrennt: Ein ``Mailbox``-Objekt ohne Schreibrecht öffnet Ordner nur mit
EXAMINE (der Server selbst verweigert dann jede Änderung), holt Nachrichten mit BODY.PEEK (nichts wird als gelesen
markiert) und lehnt STORE, MOVE, COPY, EXPUNGE und APPEND ab, bevor etwas an den Server geht.
"""
from __future__ import annotations

import base64
import email
import html
import imaplib
import re
import smtplib
import ssl
import time
from datetime import date
from email.message import EmailMessage
from email.policy import default as POLICY
from email.utils import formatdate, make_msgid, parsedate_to_datetime

TIMEOUT = 30
MAX_TEXT = 50_000
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
SENT_NAMES = ("sent items", "gesendete elemente", "gesendete objekte", "sent", "gesendet")
TRASH_NAMES = ("deleted items", "gelöschte elemente", "gelöschte objekte", "trash", "papierkorb")


class ReadOnly(PermissionError):
    """Schreibender Zugriff auf ein Postfach, das nur lesend freigegeben ist."""


def hostport(value: str, default_port: int) -> tuple[str, int]:
    v = str(value or "").strip()
    if ":" in v:
        host, _, port = v.rpartition(":")
        if port.isdigit():
            return host, int(port)
    return v, default_port


# ------------------------------------------------------------------ IMAP-Ordnernamen (modified UTF-7, RFC 3501)
def mutf7_encode(text: str) -> str:
    out: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if buf:
            b64 = base64.b64encode("".join(buf).encode("utf-16-be")).decode().rstrip("=").replace("/", ",")
            out.append(f"&{b64}-")
            buf.clear()

    for ch in text:
        if 0x20 <= ord(ch) <= 0x7E:
            flush()
            out.append("&-" if ch == "&" else ch)
        else:
            buf.append(ch)
    flush()
    return "".join(out)


def mutf7_decode(text: str) -> str:
    def rep(m: re.Match) -> str:
        x = m.group(1)
        if not x:
            return "&"
        x = x.replace(",", "/") + "=" * (-len(x) % 4)
        return base64.b64decode(x).decode("utf-16-be", "replace")

    return re.sub(r"&([A-Za-z0-9+,]*)-", rep, text)


def quote(text: str) -> str:
    return '"' + str(text).replace("\\", "\\\\").replace('"', '\\"') + '"'


def mailbox_arg(folder: str) -> str:
    return quote(mutf7_encode(folder or "INBOX"))


LIST_RE = re.compile(r'^\((?P<flags>[^)]*)\)\s+(?P<delim>"(?:[^"\\]|\\.)*"|NIL)\s+(?P<name>.+)$')


def parse_list(data: list) -> list[dict]:
    """Antwort von LIST → [{"name": "Gesendete Elemente", "flags": ["\\Sent", …]}]."""
    out = []
    for item in data or []:
        if item is None:
            continue
        if isinstance(item, tuple):  # Ordnername als Literal
            head = item[0].decode("utf-8", "ignore")
            line = re.sub(r"\{\d+\}\s*$", "", head) + quote(item[1].decode("utf-8", "ignore"))
        else:
            line = item.decode("utf-8", "ignore") if isinstance(item, bytes) else str(item)
        m = LIST_RE.match(line.strip())
        if not m:
            continue
        name = m.group("name").strip()
        if name.startswith('"') and name.endswith('"'):
            name = name[1:-1].replace('\\"', '"').replace("\\\\", "\\")
        out.append({"name": mutf7_decode(name), "flags": m.group("flags").split()})
    return out


def find_special(folders: list[dict], flag: str, names: tuple[str, ...]) -> str | None:
    for f in folders:
        if flag.lower() in (x.lower() for x in f["flags"]):
            return f["name"]
    for f in folders:
        if f["name"].rsplit("/", 1)[-1].casefold() in names:
            return f["name"]
    return None


# ------------------------------------------------------------------ Suche
def imap_date(value: str) -> str:
    d = date.fromisoformat(str(value)[:10])
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def search_criteria(suche: str | None = None, absender: str | None = None, von: str | None = None,
                    bis: str | None = None, ungelesen: bool = False) -> tuple[list[str], bytes | None]:
    """IMAP-SEARCH-Kriterien und (bei Umlauten) das Literal, das als letztes Argument gesendet wird."""
    crit: list[str] = []
    if ungelesen:
        crit.append("UNSEEN")
    if von:
        crit += ["SINCE", imap_date(von)]
    if bis:
        crit += ["BEFORE", imap_date(bis)]
    literal, lit_key = None, None
    for key, val in (("FROM", absender), ("TEXT", suche)):
        v = str(val or "").strip()
        if not v:
            continue
        if v.isascii():
            crit += [key, quote(v)]
        elif literal is None:
            literal, lit_key = v.encode("utf-8"), key
        else:
            raise ValueError("Nur ein Suchbegriff mit Umlauten auf einmal – den zweiten bitte ohne Umlaute angeben.")
    if lit_key:
        crit = ["CHARSET", "UTF-8", *crit, lit_key]  # das Literal hängt imaplib hinten an
    return (crit or ["ALL"]), literal


# ------------------------------------------------------------------ Nachrichten
def _hdr(msg, name: str) -> str:
    try:
        return str(msg.get(name, "") or "")
    except Exception:  # noqa: BLE001 – kaputte Kopfzeilen sollen keine Liste verhindern
        return str(msg.get_all(name, [""])[0] if hasattr(msg, "get_all") else "")


def _date(value: str) -> str:
    try:
        return parsedate_to_datetime(value).isoformat()
    except (TypeError, ValueError, IndexError):
        return value or ""


def header_summary(raw: bytes) -> dict:
    msg = email.message_from_bytes(raw or b"", policy=POLICY)
    return {"datum": _date(_hdr(msg, "Date")), "von": _hdr(msg, "From"), "an": _hdr(msg, "To"),
            "cc": _hdr(msg, "Cc"), "betreff": _hdr(msg, "Subject")}


def parse_fetch(data: list) -> list[dict]:
    """Antwort von UID FETCH → [{"uid", "flags", "size", "body"}] (body = das angeforderte Literal)."""
    out = []
    items = list(data or [])
    for i, item in enumerate(items):
        if not isinstance(item, tuple):
            continue
        meta = item[0].decode("utf-8", "ignore")
        nxt = items[i + 1] if i + 1 < len(items) and isinstance(items[i + 1], bytes) else b""
        meta += " " + nxt.decode("utf-8", "ignore")  # FLAGS kann hinter dem Literal stehen
        uid = re.search(r"UID (\d+)", meta)
        if not uid:
            continue
        flags = re.search(r"FLAGS \(([^)]*)\)", meta)
        size = re.search(r"RFC822\.SIZE (\d+)", meta)
        out.append({"uid": uid.group(1), "flags": flags.group(1).split() if flags else [],
                    "size": int(size.group(1)) if size else None, "body": item[1]})
    return out


def html_to_text(text: str) -> str:
    text = re.sub(r"(?is)<(script|style|head).*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</h\d>|</li>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    return re.sub(r"\n\s*\n\s*\n+", "\n\n", text).strip()


def parse_message(raw: bytes) -> dict:
    """Ganze Nachricht → Kopf, Text (Klartext bevorzugt) und Liste der Anhänge."""
    msg = email.message_from_bytes(raw, policy=POLICY)
    out = header_summary(raw)
    out["message_id"] = _hdr(msg, "Message-ID")
    body = msg.get_body(preferencelist=("plain", "html"))
    text = ""
    if body is not None:
        try:
            text = body.get_content()
        except (LookupError, ValueError):
            text = (body.get_payload(decode=True) or b"").decode("utf-8", "replace")
        if body.get_content_subtype() == "html":
            text = html_to_text(text)
    out["text"] = text[:MAX_TEXT] + ("\n… (gekürzt)" if len(text) > MAX_TEXT else "")
    out["anhaenge"] = [{"name": a["name"], "typ": a["type"], "groesse": len(a["data"])} for a in attachments(msg)]
    return out


def attachments(msg) -> list[dict]:
    out = []
    for i, part in enumerate(msg.iter_attachments(), 1):
        data = part.get_payload(decode=True) or b""
        name = part.get_filename() or f"anhang-{i}"
        out.append({"name": re.sub(r"[\\/]+", "_", name), "type": part.get_content_type(), "data": data})
    return out


def build_message(sender: str, an: str, betreff: str, text: str, cc: str = "", bcc: str = "",
                  reply_to: dict | None = None, files: list[tuple[str, bytes]] | None = None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = an
    if cc:
        msg["Cc"] = cc
    if bcc:
        msg["Bcc"] = bcc
    msg["Subject"] = betreff
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1] if "@" in sender else None)
    if reply_to and reply_to.get("message_id"):
        msg["In-Reply-To"] = reply_to["message_id"]
        msg["References"] = " ".join(x for x in (reply_to.get("references"), reply_to["message_id"]) if x)
    # base64 statt 8bit oder quoted-printable: Exchange zerlegt beim Speichern die weichen Zeilenumbrüche von
    # quoted-printable („ausschließlich“ kam als „ausschließli=h“ an) und rohe 8bit-Bytes ebenso. base64 ist
    # davon unabhängig – die Zeilenumbrüche sind Teil des Verfahrens und werden beim Lesen verworfen.
    msg.set_content(text or "", cte="base64")
    import mimetypes

    for name, data in files or []:
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        main, sub = ctype.split("/", 1)
        msg.add_attachment(data, maintype=main, subtype=sub, filename=name)
    return msg


# ------------------------------------------------------------------ Verbindung
def _imap_oeffnen(host: str, port: int):
    """IMAP-Verbindung: Port 993 mit TLS, sonst (und wenn 993 nicht erreichbar ist) STARTTLS.

    Manche Netze sperren ausgehend Port 993, waehrend 143 offen ist – dann lieber STARTTLS als gar kein Postfach.
    """
    ctx = ssl.create_default_context()
    if port != 143:
        try:
            return imaplib.IMAP4_SSL(host, port, ssl_context=ctx, timeout=TIMEOUT)
        except (OSError, ssl.SSLError):
            if port != 993:
                raise
    M = imaplib.IMAP4(host, 143, timeout=TIMEOUT)
    try:
        M.starttls(ssl_context=ctx)
    except Exception:
        try:
            M.shutdown()
        except Exception:  # noqa: BLE001
            pass
        raise
    return M


class Mailbox:
    """Eine IMAP-Sitzung. Ohne ``writable`` geht nichts, was das Postfach verändert."""

    def __init__(self, host: str, user: str, password: str, writable: bool, connect=None):
        self.writable = bool(writable)
        h, p = hostport(host, 993)
        self.M = connect(h, p) if connect else _imap_oeffnen(h, p)
        try:
            self.M.login(user, password)
        except Exception:
            self.close()
            raise

    def close(self) -> None:
        try:
            self.M.logout()
        except Exception:  # noqa: BLE001
            pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False

    def _need_write(self) -> None:
        if not self.writable:
            raise ReadOnly("Das Postfach ist für diesen Zugang nur lesend freigegeben.")

    def _ok(self, typ, data, what: str):
        if typ != "OK":
            detail = (data[0].decode("utf-8", "ignore") if data and isinstance(data[0], bytes) else str(data))[:200]
            raise imaplib.IMAP4.error(f"{what}: {detail}")
        return data

    def open(self, folder: str, write: bool = False) -> None:
        if write:
            self._need_write()
        # readonly=True schickt EXAMINE: der Server lässt dann keine Änderung zu
        self._ok(*self.M.select(mailbox_arg(folder), readonly=not write), f"Ordner „{folder}“ nicht gefunden")

    def folders(self) -> list[dict]:
        return parse_list(self._ok(*self.M.list(), "Ordnerliste"))

    def search(self, folder: str, crit: list[str], literal: bytes | None, limit: int) -> tuple[int, list[dict]]:
        self.open(folder)
        if literal is not None:
            self.M.literal = literal
        data = self._ok(*self.M.uid("SEARCH", *crit), "Suche")
        uids = data[0].split() if data and data[0] else []
        pick = uids[-max(1, limit):]
        if not pick:
            return len(uids), []
        data = self._ok(*self.M.uid("FETCH", b",".join(pick).decode(),
                                    "(UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])"),
                        "Abruf")
        rows = []
        for r in parse_fetch(data):
            rows.append({"uid": r["uid"], **header_summary(r["body"]), "gelesen": "\\Seen" in r["flags"],
                         "markiert": "\\Flagged" in r["flags"], "groesse": r["size"]})
        rows.sort(key=lambda x: int(x["uid"]), reverse=True)
        return len(uids), rows

    def fetch(self, folder: str, uid: str) -> bytes:
        self.open(folder)
        rows = parse_fetch(self._ok(*self.M.uid("FETCH", str(uid), "(UID BODY.PEEK[])"), "Abruf"))
        if not rows:
            raise LookupError(f"Keine Nachricht mit UID {uid} in „{folder}“")
        return rows[0]["body"]

    def store(self, folder: str, uids: list[str], op: str, flag: str) -> None:
        self._need_write()
        self.open(folder, write=True)
        self._ok(*self.M.uid("STORE", ",".join(uids), op, f"({flag})"), "Markieren")

    def move(self, folder: str, uids: list[str], target: str) -> str:
        self._need_write()
        self.open(folder, write=True)
        caps = {c.upper() for c in getattr(self.M, "capabilities", ())}
        ids = ",".join(uids)
        if "MOVE" in caps:
            self._ok(*self.M.uid("MOVE", ids, mailbox_arg(target)), "Verschieben")
            return "verschoben"
        self._ok(*self.M.uid("COPY", ids, mailbox_arg(target)), "Kopieren")
        self._ok(*self.M.uid("STORE", ids, "+FLAGS", "(\\Deleted)"), "Markieren")
        if "UIDPLUS" in caps:
            self._ok(*self.M.uid("EXPUNGE", ids), "Entfernen")
            return "verschoben"
        return "kopiert und im Ursprungsordner als gelöscht markiert"

    def append(self, folder: str, raw: bytes) -> None:
        self._need_write()
        self._ok(*self.M.append(mailbox_arg(folder), "(\\Seen)", imaplib.Time2Internaldate(time.time()), raw),
                 "Ablegen")


def smtp_send(host: str, user: str, password: str, msg: EmailMessage, connect=None) -> dict:
    """Sendet über SMTP (Port 465 mit SSL, sonst STARTTLS). Rückgabe: abgelehnte Empfänger."""
    h, p = hostport(host, 587)
    ctx = ssl.create_default_context()
    if connect:
        s = connect(h, p)
    elif p == 465:
        s = smtplib.SMTP_SSL(h, p, context=ctx, timeout=TIMEOUT)
    else:
        s = smtplib.SMTP(h, p, timeout=TIMEOUT)
        s.starttls(context=ctx)
    try:
        s.login(user, password)
        return s.send_message(msg) or {}
    finally:
        try:
            s.quit()
        except Exception:  # noqa: BLE001
            pass
