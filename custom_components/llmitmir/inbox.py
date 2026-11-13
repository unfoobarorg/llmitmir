"""Benachrichtigungen auf der Startseite (Posteingang) – rein, unit-getestet.

In Umgebungen, in denen keine Push-Nachricht an ein Gerät möglich ist, zeigt LLMitMir die Ergebnisse geplanter
Aufgaben auf der Startseite – im Stil der Benachrichtigungen eines Smartphones. Die Person entscheidet, ob das
passiert („automatisch“ heißt: an, solange kein Push-Gerät gewählt ist), wie lange eine Benachrichtigung stehen
bleibt (0 = bis sie von Hand entfernt wird) und ob sie einen Quellchat stumm schaltet. Stumm geschaltete Chats
bekommen keine neuen Karten, ihre vorhandenen verschwinden.
"""
from __future__ import annotations

AUTO, ON, OFF = "auto", "on", "off"
MODES = (AUTO, ON, OFF)
DEFAULT_MINUTES = 30     # so lange steht eine Benachrichtigung, wenn die Person nichts anderes wählt
MAX_MINUTES = 10080      # eine Woche – länger ist keine Anzeigedauer mehr
KEEP = 30                # höchstens so viele Benachrichtigungen auf einmal
MAX_AGE_DAYS = 7         # ältere verschwinden auch bei „bleiben, bis ich sie entferne“


def clean_mode(value) -> str:
    """Anzeige-Modus prüfen: automatisch (Standard), immer an oder aus."""
    mode = str(value or AUTO)
    return mode if mode in MODES else AUTO


def enabled(settings: dict, has_device: bool) -> bool:
    """Ob diese Person Benachrichtigungen auf der Startseite bekommt."""
    mode = clean_mode((settings or {}).get("inbox_mode"))
    if mode == ON:
        return True
    if mode == OFF:
        return False
    return not has_device


def clean_minutes(value, default: int = DEFAULT_MINUTES) -> int:
    """Anzeigedauer in Minuten prüfen: 0 = bleibt stehen, sonst 1 … MAX_MINUTES. Leer = Standard."""
    if value is None or value == "":
        return default
    try:
        mins = int(value)
    except (TypeError, ValueError):
        raise ValueError("Die Anzeigedauer muss eine Zahl in Minuten sein") from None
    if mins < 0 or mins > MAX_MINUTES:
        raise ValueError(f"Die Anzeigedauer muss zwischen 0 (bleibt stehen) und {MAX_MINUTES} Minuten liegen")
    return mins


def minutes(settings: dict) -> int:
    """Anzeigedauer dieser Person (ohne Angabe der Standard)."""
    try:
        return clean_minutes((settings or {}).get("inbox_minutes"))
    except ValueError:
        return DEFAULT_MINUTES


def muted(settings: dict) -> list[str]:
    """Chats, für die diese Person keine Benachrichtigungen mehr will."""
    return [str(c) for c in ((settings or {}).get("inbox_muted") or []) if c]


def mute(current, chat_id: str, on: bool = True) -> list[str]:
    """Stummschaltung eines Quellchats setzen oder aufheben (Liste der Chat-IDs)."""
    out = [c for c in (current or []) if c and c != chat_id]
    if on and chat_id:
        out.append(chat_id)
    return out[:200]


def add(items, entry: dict, ts: float, keep: int = KEEP) -> list[dict]:
    """Neue Benachrichtigung oben einsortieren.

    Meldet dieselbe Aufgabe im selben Lauf noch einmal dasselbe, ersetzt die neue Karte die alte – wie eine
    Benachrichtigung, die eine ältere desselben Absenders überschreibt.
    """
    out = [e for e in (items or []) if isinstance(e, dict)]
    out = [e for e in out if not (e.get("chat_id") == entry.get("chat_id") and e.get("text") == entry.get("text"))]
    out.insert(0, dict(entry, at=ts))
    return out[:keep]


def prune(items, ts: float, mins: int, max_age_days: int = MAX_AGE_DAYS) -> list[dict]:
    """Was noch angezeigt wird: innerhalb der Anzeigedauer (0 = unbegrenzt) und jünger als die Höchstfrist."""
    out = []
    for e in items or []:
        if not isinstance(e, dict):
            continue
        age = ts - float(e.get("at") or 0)
        if age > max_age_days * 86400:
            continue
        if mins > 0 and age > mins * 60:
            continue
        out.append(e)
    return out


def drop_chat(items, chat_id: str) -> list[dict]:
    """Alle Benachrichtigungen eines Chats entfernen (Chat gelöscht oder stumm geschaltet)."""
    return [e for e in (items or []) if isinstance(e, dict) and e.get("chat_id") != chat_id]
