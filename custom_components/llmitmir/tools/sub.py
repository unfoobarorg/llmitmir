"""Teilaufgaben (Unterchats): Arbeit an eigene Chats mit eigenem Kontext verteilen.

Der Hauptchat startet Teilaufgaben und wartet im selben Schritt, bis sie fertig sind (wie das Task-Werkzeug in Claude
Code); mehrere Aufrufe in einem Schritt laufen parallel. Zurück kommt nur die Zusammenfassung, nie der Verlauf.
Die Teilaufgabe selbst meldet ihr Ergebnis mit ``ergebnis_melden``.
"""
from __future__ import annotations

from .. import subchats as SC
from . import Tool, obj, register


async def unterchat_starten(ctx, a: dict):
    return await ctx.manager.delegate(ctx, a)


async def unterchat_nachricht(ctx, a: dict):
    return await ctx.manager.delegate_more(ctx, a)


async def unterchat_ergebnis(ctx, a: dict):
    sub_id = str(a.get("id") or "").strip()
    meta = ctx.store.meta["chats"].get(sub_id) if sub_id else None
    if not meta or meta.get("parent_id") != ctx.chat_id:
        return "Fehler: Keine Teilaufgabe mit dieser id in diesem Chat."
    sub = await ctx.store.async_get_chat(sub_id)
    res = ((sub or {}).get("sub") or {}).get("ergebnis")
    if not res:
        st = ((sub or {}).get("sub") or {}).get("status")
        return {"id": sub_id, "titel": meta.get("title"), "stand": st, "zusammenfassung": "",
                "hinweis": "Noch kein Ergebnis gemeldet."}
    return SC.tool_result(sub, res)


async def ergebnis_melden(ctx, a: dict):
    sub = ctx.chat.get("sub")
    if not ctx.chat.get("parent_id") or sub is None:
        return "Fehler: Nur eine Teilaufgabe meldet ein Ergebnis."
    text = str(a.get("zusammenfassung") or "").strip()
    if not text:
        return "Fehler: Die Zusammenfassung fehlt."
    sub["gemeldet"] = {"zusammenfassung": SC.clip(text, SC.RESULT_MAX_CHARS), "dateien": SC.clean_files(a.get("dateien"))}
    cut = len(text) > SC.RESULT_MAX_CHARS
    return {"ok": True, "hinweis": ("Gekürzt auf etwa 1.500 Tokens – Details besser als Datei ablegen. " if cut else "")
            + "Schreibe jetzt nur noch einen kurzen Abschluss für die Person."}


_DATEIEN = {"type": "array", "items": {"type": "string"},
            "description": "Dateien im Arbeitsbereich, die zum Ergebnis gehören (Pfade wie bei file_list)"}

register(Tool(
    "unterchat_starten", "unterchat",
    "Startet eine Teilaufgabe: einen eigenen Chat mit eigenem Kontext, der einen klar umrissenen Teil der Arbeit "
    "erledigt und nur eine Zusammenfassung zurückgibt. Du wartest, bis sie fertig ist; mehrere Aufrufe im selben Schritt "
    "laufen parallel. Gut für unabhängige Teile, viel Lesematerial (lange PDFs, viele Mails, Recherche je Eintrag) und "
    "lange Werkbank-Arbeit. Nicht für kurze Fragen oder Schritte, die aufeinander aufbauen. Der Auftrag muss für sich "
    "allein verständlich sein – die Teilaufgabe kennt den Hauptchat nicht.",
    obj({"titel": {"type": "string", "description": "kurzer Titel (wird in der Seitenleiste gezeigt)"},
         "auftrag": {"type": "string", "description": "vollständiger, eigenständiger Auftrag mit allem Nötigen: Ziel, "
                     "Material (Dateinamen, Links, Zeiträume), gewünschte Form des Ergebnisses"},
         "modell": {"type": "string", "description": "„sparsam“ (Standard, schnell und günstig), „stark“ (für schwierige "
                    "Teile), „wie_hauptchat“ oder eine Modell-ID"},
         "werkzeuge": {"type": "array", "items": {"type": "string"},
                       "description": "optional: nur diese Werkzeuggruppen (z. B. web, files, werkbank); sonst wie hier"},
         "dateien": _DATEIEN}, ["titel", "auftrag"]),
    unterchat_starten, label="Teilaufgabe", icon="mdi:subdirectory-arrow-right", max_chars=0))

register(Tool(
    "unterchat_nachricht", "unterchat",
    "Schickt einer vorhandenen Teilaufgabe dieses Chats eine Folgeaufgabe oder Rückfrage (z. B. nach einer Grenze "
    "weitermachen oder ein fehlendes Detail nachliefern). Du wartest wieder auf ihre Zusammenfassung.",
    obj({"id": {"type": "string", "description": "id der Teilaufgabe (aus unterchat_starten)"},
         "text": {"type": "string", "description": "die Folgeaufgabe"}}, ["id", "text"]),
    unterchat_nachricht, label="Teilaufgabe – Folgeauftrag", icon="mdi:subdirectory-arrow-right", max_chars=0))

register(Tool(
    "unterchat_ergebnis", "unterchat",
    "Liest die letzte Zusammenfassung einer Teilaufgabe dieses Chats (nie ihren Verlauf).",
    obj({"id": {"type": "string"}}, ["id"]),
    unterchat_ergebnis, label="Ergebnis einer Teilaufgabe lesen", icon="mdi:subdirectory-arrow-right", max_chars=0))

register(Tool(
    "ergebnis_melden", "teilergebnis",
    "Meldet das Ergebnis dieser Teilaufgabe an den Hauptchat. Er sieht nur diese Zusammenfassung, nicht deinen "
    "Verlauf: alle Fakten, Zahlen, Namen und offenen Punkte hinein, Längeres als Datei ablegen und unter dateien nennen. "
    "Höchstens etwa 1.500 Tokens. Rufe es am Ende genau einmal auf, bevor du den Abschluss schreibst.",
    obj({"zusammenfassung": {"type": "string"}, "dateien": _DATEIEN}, ["zusammenfassung"]),
    ergebnis_melden, label="Ergebnis melden", icon="mdi:flag-checkered"))
