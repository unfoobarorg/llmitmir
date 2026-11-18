"""Teilaufgaben (Unterchats): ein Hauptchat verteilt Arbeit auf eigene Chats (rein, unit-getestet).

Ein Unterchat ist ein normaler Chat (``kind`` bleibt ``chat`` oder ``cowork``) mit ein paar Feldern mehr:

- ``parent_id``: der Hauptchat. Es gibt genau eine Ebene – ein Unterchat hat selbst keine Unterchats.
- ``sub``: Auftrag, Stand, letztes Ergebnis, wer ihn angelegt hat und ob neue Ergebnisse zurückgemeldet werden.
- am Hauptchat ``subs``: die Unterchats in der Reihenfolge, in der sie entstanden sind.

Der Hauptchat liest nie den Verlauf eines Unterchats, nur dessen Zusammenfassung (``sub.ergebnis``). Rückmeldungen
stehen im Verlauf des Hauptchats als Nachricht ``role: "sub_result"``; für das Modell wird daraus eine kurze
Nachricht der Person (``api_text``).

In der Oberfläche heißt das „Teilaufgabe“; im Code bleibt es beim Unterchat.

Dieses Modul kennt Home Assistant nicht, damit es sich direkt testen lässt.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

# Stand eines Unterchats (sub.status)
LAEUFT = "laeuft"          # arbeitet gerade
WARTET = "wartet"          # wartet auf eine Freigabe oder auf einen freien Platz
GRENZE = "grenze"          # eine Grenze erreicht (Schritte, Kontingent, Monatslimit), Teilergebnis gemeldet
FERTIG = "fertig"
FEHLER = "fehler"
ABGEBROCHEN = "abgebrochen"
NEU = "neu"                # von Hand abgezweigt, noch nichts passiert
STATUSES = (NEU, LAEUFT, WARTET, GRENZE, FERTIG, FEHLER, ABGEBROCHEN)
ACTIVE = (LAEUFT, WARTET)  # Stände, in denen die Teilaufgabe noch arbeitet

# Wer den Unterchat angelegt hat
VON_AGENT = "agent"        # der Hauptchat (Werkzeug unterchat_starten)
VON_PERSON = "person"      # von Hand abgezweigt („Als Teilaufgabe weiterarbeiten“)

# Zusammenfassung für den Hauptchat: höchstens etwa 1.500 Tokens (rund 3,5 Zeichen je Token)
RESULT_MAX_CHARS = 5200
AUFTRAG_MAX_CHARS = 20000
TITLE_MAX = 80
MAX_FILES = 40


def is_sub(chat: dict | None) -> bool:
    return bool((chat or {}).get("parent_id"))


def root_id(chat: dict | None) -> str:
    """Der Hauptchat eines Baums: bei einem Unterchat sein Hauptchat, sonst der Chat selbst."""
    c = chat or {}
    return str(c.get("parent_id") or c.get("id") or "")


def children(chats: dict | None, parent_id: str) -> list[str]:
    """Ids der Unterchats eines Hauptchats aus dem Index (meta.json), älteste zuerst."""
    subs = [(float(c.get("created") or 0), cid) for cid, c in (chats or {}).items()
            if c.get("parent_id") == parent_id and cid != parent_id]
    return [cid for _t, cid in sorted(subs)]


def tree(chats: dict | None, chat_id: str) -> list[str]:
    """Der Chat und alle seine Unterchats (Unterchats zuerst, damit beim Löschen nichts verwaist)."""
    return children(chats, chat_id) + [chat_id]


def last_used(chats: dict | None, chat_id: str) -> float:
    """Letzte Benutzung eines Baums: Arbeit in einem Unterchat zählt auch für den Hauptchat."""
    idx = chats or {}
    times = [float((idx.get(cid) or {}).get("updated") or (idx.get(cid) or {}).get("created") or 0)
             for cid in tree(idx, chat_id)]
    return max(times or [0.0])


def clip(text: Any, limit: int) -> str:
    t = str(text or "").strip()
    if len(t) <= limit:
        return t
    return t[:limit].rstrip() + " …"


def clean_title(title: Any, fallback: str = "Teilaufgabe") -> str:
    t = re.sub(r"\s+", " ", str(title or "")).strip()
    return clip(t, TITLE_MAX) if t else fallback


def clean_files(files: Any) -> list[str]:
    """Dateinamen aus einer Rückmeldung: Text oder Liste, ohne Leeres und Doppeltes."""
    if isinstance(files, str):
        files = re.split(r"[,\n]", files)
    out: list[str] = []
    for f in files or []:
        name = str(f or "").strip().lstrip("/")
        if name.startswith("workspace/"):
            name = name[len("workspace/"):]
        if name and name not in out:
            out.append(name[:200])
    return out[:MAX_FILES]


def new_sub(auftrag: str, von: str = VON_AGENT, status: str = NEU, call_id: str | None = None,
            model_choice: str | None = None) -> dict:
    """Das Feld ``sub`` eines neuen Unterchats."""
    out = {"auftrag": clip(auftrag, AUFTRAG_MAX_CHARS), "status": status if status in STATUSES else NEU,
           "ergebnis": None, "von": von if von in (VON_AGENT, VON_PERSON) else VON_AGENT, "melden": True}
    if call_id:
        out["call_id"] = call_id   # der Werkzeugaufruf im Hauptchat, zu dem die Karte gehört
    if model_choice:
        out["modell"] = model_choice
    return out


def result(summary: Any, files: Any = None, status: str = FERTIG, reason: str = "", at: float = 0) -> dict:
    """Ein Ergebnis für den Hauptchat (``sub.ergebnis``): Zusammenfassung, Dateien, Stand und ggf. der Grund."""
    out = {"zusammenfassung": clip(summary, RESULT_MAX_CHARS) or "(keine Zusammenfassung)",
           "dateien": clean_files(files), "stand": status if status in STATUSES else FERTIG}
    if reason:
        out["grund"] = clip(reason, 600)
    if at:
        out["at"] = at
    return out


def result_message(sub_chat: dict, res: dict, msg_id: str, created: float, nachtrag: bool = False) -> dict:
    """Die Rückmeldung im Verlauf des Hauptchats (``role: "sub_result"``)."""
    return {"id": msg_id, "role": "sub_result", "created": created, "sub_id": sub_chat.get("id"),
            "title": sub_chat.get("title") or "Teilaufgabe", "summary": res.get("zusammenfassung") or "",
            "files": list(res.get("dateien") or []), "status": res.get("stand") or FERTIG,
            "reason": res.get("grund") or "", "nachtrag": bool(nachtrag)}


STATUS_TEXT = {NEU: "neu", LAEUFT: "läuft", WARTET: "wartet", GRENZE: "Grenze erreicht", FERTIG: "fertig",
               FEHLER: "Fehler", ABGEBROCHEN: "abgebrochen"}


def api_text(msg: dict) -> str:
    """Eine Rückmeldung als kurze Nachricht für das Modell des Hauptchats – nie der Verlauf des Unterchats."""
    title = msg.get("title") or "Teilaufgabe"
    head = ("Nachtrag aus" if msg.get("nachtrag") else "Ergebnis aus") + f" Unterchat ›{title}‹ (id {msg.get('sub_id')}"
    head += f", Stand: {STATUS_TEXT.get(msg.get('status'), msg.get('status') or 'fertig')})"
    text = f"[LLMitMir] {head}:\n{msg.get('summary') or '(keine Zusammenfassung)'}"
    if msg.get("reason"):
        text += f"\nGrund: {msg['reason']}"
    if msg.get("files"):
        text += "\nDateien im Arbeitsbereich: " + ", ".join(msg["files"])
    return text


def summary_fields(chat: dict) -> dict:
    """Was die Seitenleiste je Chat zusätzlich braucht (chat_summary), ohne den Verlauf zu laden."""
    sub = chat.get("sub") or {}
    return {"parent_id": chat.get("parent_id"), "sub_status": sub.get("status") if chat.get("parent_id") else None,
            "sub_call": sub.get("call_id") if chat.get("parent_id") else None,
            "sub_von": sub.get("von") if chat.get("parent_id") else None}


def message_text(msg: dict | None) -> str:
    """Der Text einer Nachricht als Auftrag (beim Abzweigen von Hand)."""
    m = msg or {}
    if m.get("role") == "sub_result":
        return str(m.get("summary") or "")
    c = m.get("content")
    if isinstance(c, list):
        return "\n".join(str(p.get("text") or "") for p in c if isinstance(p, dict))
    return str(c or "")


def title_from(text: str) -> str:
    t = re.sub(r"[#*_`>]+", "", str(text or ""))
    t = re.sub(r"\s+", " ", t).strip()
    return clean_title(t[:60] + ("…" if len(t) > 60 else ""))


def ordered(ids: Iterable[str], subs: list[str] | None) -> list[str]:
    """Reihenfolge am Hauptchat nachziehen: bekannte zuerst in ihrer Reihenfolge, neue hinten."""
    have = [s for s in subs or [] if s in set(ids)]
    return have + [s for s in ids if s not in have]
