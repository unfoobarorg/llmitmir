"""Readable change sets for skills, scheduled tasks and credentials (pure, unit-tested).

The model may create, change and delete these only after the person approved the exact change. The panel shows the
change set in the approval card and later in the tool step: one row per field, long texts as a line diff.
"""
from __future__ import annotations

import difflib

try:
    from .cron import describe
    from .sharing import summary as share_summary
except ImportError:  # loaded standalone in tests
    from importlib import util as _u
    from pathlib import Path as _P

    _s = _u.spec_from_file_location("lm_changes_cron", _P(__file__).with_name("cron.py"))
    _m = _u.module_from_spec(_s)
    _s.loader.exec_module(_m)
    describe = _m.describe
    _s = _u.spec_from_file_location("lm_changes_sharing", _P(__file__).with_name("sharing.py"))
    _m = _u.module_from_spec(_s)
    _s.loader.exec_module(_m)
    share_summary = _m.summary

NOTIFY = {"always": "nach jedem Lauf", "on_change": "nur bei neuem Ergebnis, Rückfrage oder Fehler",
          "error": "nur bei Fehlern", "never": "nie"}
TYPE_LABELS = {"webdav": "Nextcloud / WebDAV / CalDAV", "basic": "HTTP Basic Auth", "bearer": "Bearer-Token",
               "header": "API-Key im Header", "telegram": "Telegram-Bot", "imap": "E-Mail (IMAP/SMTP)",
               "other": "Sonstiges", "gwdg": "GWDG-Exchange"}
SERVICE_LABELS = {"mail": "E-Mail-Postfach", "calendar": "Kalender", "contacts": "Kontakte"}
ACCESS_LABELS = {"read": "nur lesen", "write": "lesen und schreiben"}
SECRET = "•••"
CONTEXT = 2  # unchanged lines shown around a change


def line_diff(old: str, new: str) -> list[list]:
    """[op, text] rows: " " same, "-" removed, "+" added, "…" skipped (text = number of skipped lines)."""
    a, b = (old or "").splitlines(), (new or "").splitlines()
    out: list[list] = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            same = a[i1:i2]
            head = CONTEXT if out else 0
            tail = CONTEXT if i2 < len(a) or j2 < len(b) else 0
            if len(same) > head + tail + 1:
                out += [[" ", x] for x in same[:head]]
                out.append(["…", len(same) - head - tail])
                out += [[" ", x] for x in same[len(same) - tail:]] if tail else []
            else:
                out += [[" ", x] for x in same]
            continue
        out += [["-", x] for x in a[i1:i2]]
        out += [["+", x] for x in b[j1:j2]]
    return out


def _yes(v) -> str:
    return "ja" if v else "nein"


def _names(ids, lookup: dict) -> str:
    return ", ".join(str((lookup.get(i) or {}).get("name") or i) for i in ids or [])


def skill_fields(s: dict | None, meta: dict) -> list[tuple[str, str, bool]]:
    if not s:
        return []
    creds = meta.get("credentials") or {}
    return [("Name", s.get("name") or "", False), ("Beschreibung", s.get("description") or "", True),
            ("Anleitung", s.get("body") or "", True), ("Zugänge", _names(s.get("credentials"), creds), False),
            ("Aktiv", _yes(s.get("enabled", True)), False)]


def task_fields(t: dict | None, meta: dict) -> list[tuple[str, str, bool]]:
    if not t:
        return []
    projects = meta.get("projects") or {}
    return [("Name", t.get("name") or "", False), ("Auftrag", t.get("prompt") or "", True),
            ("Zeitplan", describe(t.get("schedule") or {}), False),
            ("Projekt", (projects.get(t.get("project_id") or "") or {}).get("name") or "ohne", False),
            ("Modell", t.get("model") or "Standard", False), ("Aktiv", _yes(t.get("enabled", True)), False),
            ("Freigaben", ", ".join(t.get("allow_write") or []) or "keine", False),
            ("Benachrichtigen", NOTIFY.get(t.get("notify") or "always", str(t.get("notify"))), False),
            ("Braucht die Werkbank", _yes("werkbank" in (t.get("requires") or [])), False),
            ("Besonders aufwändig", _yes(t.get("heavy")), False),
            ("Geteilt mit", share_summary(t.get("share"), meta.get("user_names")), False)]


def credential_fields(c: dict | None, secret: set[str], old: dict | None = None) -> list[tuple[str, str, bool]]:
    """Secret values are never shown; a changed secret shows as "••• (neu)"."""
    if not c:
        return []
    prev = (old or {}).get("fields") or {}
    rows = [("Name", c.get("name") or "", False), ("Typ", TYPE_LABELS.get(c.get("type"), str(c.get("type"))), False)]
    if c.get("services") is not None:  # GWDG-Exchange: wofür der Zugang gilt
        acc = c.get("access") or {}
        rows.append(("Dienste", ", ".join(f"{SERVICE_LABELS.get(x, x)} ({ACCESS_LABELS[acc.get(x) or 'read']})"
                                          for x in c["services"]), False))
    for k, v in (c.get("fields") or {}).items():
        if k in secret:
            v = (SECRET + " (neu)" if old is not None and prev.get(k) != v else SECRET) if v else ""
        rows.append((k, str(v or ""), False))
    if c.get("valid_until"):
        rows.append(("Gültig bis", str(c["valid_until"]), False))
    rows.append(("Notiz", c.get("notes") or "", True))
    return rows


def build(art: str, name: str, old_rows: list, new_rows: list) -> dict:
    """Change set: aktion anlegen/aendern/loeschen and the affected fields."""
    aktion = "anlegen" if not old_rows else "loeschen" if not new_rows else "aendern"
    olds, news = dict((r[0], r[1]) for r in old_rows), dict((r[0], r[1]) for r in new_rows)
    texty = {r[0] for r in old_rows + new_rows if r[2]}
    felder = []
    for label in dict.fromkeys([r[0] for r in old_rows] + [r[0] for r in new_rows]):
        a, b = olds.get(label), news.get(label)
        if aktion == "aendern" and a == b:
            continue
        if aktion == "anlegen" and not b:
            continue
        f: dict = {"feld": label, "alt": a, "neu": b}
        if label in texty and aktion == "aendern" and a and b:
            f["diff"] = line_diff(a, b)
        felder.append(f)
    return {"art": art, "aktion": aktion, "name": name, "felder": felder}


def summary(ch: dict) -> str:
    """One line for the model: what happened."""
    what = {"skill": "Skill", "aufgabe": "Geplante Aufgabe", "zugang": "Zugang"}.get(ch["art"], ch["art"])
    verb = {"anlegen": "angelegt", "aendern": "geändert", "loeschen": "gelöscht"}[ch["aktion"]]
    fields = ", ".join(f["feld"] for f in ch["felder"]) if ch["aktion"] == "aendern" else ""
    return f"{what} „{ch['name']}“ {verb}" + (f" (geändert: {fields})" if fields else "") + "."
