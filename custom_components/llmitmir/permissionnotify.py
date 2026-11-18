"""Push-Nachricht, wenn eine Freigabe auf Antwort wartet (rein, unit-getestet).

Ein Lauf bleibt stehen, bis die Person eine Freigabe beantwortet – bis zu einer Stunde. Wer das Panel
geschlossen hat, merkt davon nichts. Deshalb meldet LLMitMir eine wartende Freigabe aufs Handy, aber nur,
wenn gerade niemand zusieht (kein Panel verbunden) und die Person es nicht abgeschaltet hat.

Der Text nennt, was gefragt wird, und – bei einem Befehl – die ersten Zeilen davon, damit die Entscheidung
ohne Öffnen des Chats möglich ist. Fragt eine Teilaufgabe (Unterchat), heißt die Meldung „Teilaufgabe braucht dich“,
nennt Teilaufgabe und Hauptchat und führt in den Hauptchat, wo die Frage zentral beantwortet wird. Geheimnisse stehen nicht darin: die Argumente sind bereits geschwärzt.
"""
from __future__ import annotations

import re

MAX_PREVIEW = 160      # so viel der Eingabe steht in der Nachricht
MAX_LINES = 2          # bei einem Befehl: die ersten beiden Zeilen
TITLE = "LLMitMir: Freigabe nötig"
SUB_TITLE = "LLMitMir: Teilaufgabe braucht dich"

# Reihenfolge wie im Panel (chat.ts, stepRow): das aussagekräftigste Argument zuerst
ARGS = ("anfrage", "url", "pfad", "name", "entity_id", "filter", "typ")


def enabled(settings: dict) -> bool:
    """Standard: an. Nur ein ausdrückliches Nein schaltet die Meldung ab."""
    return (settings or {}).get("permission_push") is not False


def _one_line(text) -> str:
    return " ".join(str(text or "").split())


def preview(info: dict) -> str:
    """Die ersten Zeilen der Eingabe – bei einem Befehl der Befehl, sonst das wichtigste Argument."""
    args = info.get("args") or {}
    if not isinstance(args, dict):
        return ""
    cmd = args.get("befehl")
    if cmd:
        lines = [_one_line(x) for x in str(cmd).splitlines() if x.strip()]
        return " · ".join(lines[:MAX_LINES])[:MAX_PREVIEW]
    for key in ARGS:
        if args.get(key):
            return _one_line(args[key])[:MAX_PREVIEW]
    if args.get("domain") and args.get("service"):
        return f"{args['domain']}.{args['service']}"
    return ""


def message(info: dict, chat_title: str = "", simple: bool = False) -> tuple[str, str]:
    """Titel und Text der Push-Nachricht.

    Einfache Ansicht: ein Satz in Alltagssprache. Expertenansicht: Chat, Werkzeug und Eingabe.
    """
    label = _one_line(info.get("label") or info.get("group_label") or info.get("tool") or "eine Aktion")
    if info.get("change"):
        label = f"Änderung: {label}"
    elif info.get("tool") == "more_steps":
        label = "Weitere Schritte verwenden?"
    what = preview(info)
    title = _one_line(chat_title) or TITLE
    if info.get("root_chat_id"):
        # aus einer Teilaufgabe: Titel fest, der Text nennt Teilaufgabe und Hauptchat (Link führt in den Hauptchat)
        sub = _one_line(info.get("sub_title")) or "Teilaufgabe"
        root = _one_line(info.get("root_title"))
        where = f"Teilaufgabe ›{sub}‹" + (f" im Chat ›{root}‹" if root else "")
        if simple:
            text = f"{where}: Ich brauche deine Erlaubnis – {label}."
            return SUB_TITLE, text + (f" Es geht um: {what}" if what else "")
        text = f"{where}\n{label}" + (f"\n{what}" if what else "")
        return SUB_TITLE, text + "\nAntworten im Hauptchat – ohne Antwort macht die Teilaufgabe ohne die Aktion weiter."
    if simple:
        text = f"Ich brauche deine Erlaubnis: {label}."
        if what:
            text += f" Es geht um: {what}"
        return title[:100], text
    text = f"{label}"
    if what:
        text += f"\n{what}"
    text += "\nAntworten im Chat – ohne Antwort läuft die Frage ab."
    return title[:100], text


def should_notify(settings: dict, watching: bool, info: dict | None = None) -> bool:
    """Ob diese Freigabe eine Push-Nachricht bekommt.

    ``watching`` heißt: für diese Person ist gerade ein Panel verbunden – dann sieht sie die Frage selbst.
    """
    if watching:
        return False
    if not enabled(settings):
        return False
    return bool(info)


def tag(chat_id: str) -> str:
    """Kennung der Nachricht: eine neue Freigabe im selben Chat ersetzt die alte Meldung."""
    return "llmitmir-permission-" + re.sub(r"[^A-Za-z0-9_-]+", "", str(chat_id or ""))[:40]
