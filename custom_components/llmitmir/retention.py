"""Lebensdauer von Chats und Coworks (pure, unit-tested).

Chats und Coworks können nach einer Frist von selbst verschwinden: je Projekt eine eigene Frist, für alles
außerhalb eines Projekts die Frist aus den Einstellungen der Person. Standardmäßig ist das Löschen aus – erst
wenn die Person es einschaltet, gilt eine Frist (vorgeschlagen werden 30 Tage). Gezählt wird ab der letzten
Benutzung, damit ein Chat, in dem noch gearbeitet wird, nicht unter der Hand verschwindet. Angeheftete Chats
und die Läufe geplanter Aufgaben bleiben (die gehören zu ihrer Aufgabe, nicht zum Verlauf). Teilaufgaben
(Unterchats) haben keine eigene Frist: Sie verschwinden mit ihrem Hauptchat, und Arbeit in einer Teilaufgabe
zählt als Benutzung des Hauptchats.

Eine Ausnahme ist das Gespräch: Wer oft mit dem Roboter spricht, hat schnell eine lange Chatliste. Neue
Sprachgespräche landen deshalb von selbst in einem eigenen Projekt „Gespräche“ mit 14 Tagen Lebensdauer
(`voice_project`, `voice_project_record`). Angelegt wird es beim ersten Gespräch; die Frist gilt ab da wie jede
Projektfrist und lässt sich im Projekt ändern. Löscht die Person das Projekt, entsteht es beim nächsten
Gespräch neu – „standardmäßig“ heißt: ohne Zutun, nicht gegen den Willen.
"""
from __future__ import annotations

DEFAULT_DAYS = 0      # Standard: automatisches Löschen ist aus
SUGGEST_DAYS = 30     # Vorschlag, sobald die Person das Löschen einschaltet
MAX_DAYS = 3650       # zehn Jahre – „beliebig“ heißt nicht „unendlich viele Ziffern“
KEEP = 0              # 0 Tage = aus, also unbegrenzt aufbewahren
KINDS = ("chat", "cowork")   # task_run gehört zur Aufgabe und bleibt

# Automatisches Projekt für Sprachgespräche (siehe oben)
VOICE_PROJECT_NAME = "Gespräche"
VOICE_PROJECT_DAYS = 14
VOICE_PROJECT_AUTO = "voice"   # Kennzeichen am Projekt: von LLMitMir angelegt, nicht von der Person
VOICE_PROJECT_DESCRIPTION = (
    "Von LLMitMir angelegt: Neue Gespräche mit dem Roboter landen hier, damit sie die Chatliste nicht füllen. "
    "Nach 14 Tagen ohne Benutzung löschen sie sich von selbst."
)


def clean_days(value, default: int = DEFAULT_DAYS) -> int:
    """Frist in Tagen prüfen: 0 = aus (unbegrenzt), sonst 1 … MAX_DAYS. Leer = Standard (aus)."""
    if value is None or value == "":
        return default
    try:
        days = int(value)
    except (TypeError, ValueError):
        raise ValueError("Die Frist muss eine Zahl in Tagen sein") from None
    if days < 0 or days > MAX_DAYS:
        raise ValueError(f"Die Frist muss zwischen 0 (unbegrenzt) und {MAX_DAYS} Tagen liegen")
    return days


def project_days(project: dict | None) -> int:
    """Frist eines Projekts (ohne Angabe: aus)."""
    return clean_days((project or {}).get("retention_days"), DEFAULT_DAYS)


def user_days(settings: dict | None) -> int:
    """Frist für alles außerhalb eines Projekts (ohne Angabe: aus)."""
    return clean_days((settings or {}).get("retention_days"), DEFAULT_DAYS)


def days_for(chat: dict, projects: dict | None, settings: dict | None) -> int:
    """Welche Frist für diesen Chat gilt: die seines Projekts, sonst die der Person."""
    pid = chat.get("project_id")
    if pid and pid in (projects or {}):
        return project_days(projects[pid])
    return user_days(settings)


def expired(chats: dict | None, projects: dict | None, settings: dict | None, now_ts: float,
            kinds: tuple[str, ...] = KINDS) -> list[str]:
    """Ids der Chats und Coworks, deren Frist abgelaufen ist (älteste zuerst)."""
    out: list[tuple[float, str]] = []
    idx = chats or {}
    for cid, c in idx.items():
        if c.get("kind") not in kinds or c.get("pinned"):
            continue
        if c.get("parent_id"):
            continue  # Teilaufgaben folgen ihrem Hauptchat (delete_chat löscht den ganzen Baum)
        days = days_for(c, projects, settings)
        if days <= KEEP:
            continue
        # Arbeit in einer Teilaufgabe zählt auch als Benutzung des Hauptchats
        last = max([float(c.get("updated") or c.get("created") or 0)]
                   + [float(s.get("updated") or s.get("created") or 0) for s in idx.values() if s.get("parent_id") == cid])
        if last and now_ts - last >= days * 86400:
            out.append((last, cid))
    return [cid for _last, cid in sorted(out)]


def voice_project(projects: dict | None) -> dict | None:
    """Das automatisch angelegte Projekt für Gespräche (None, solange keins da ist)."""
    for p in (projects or {}).values():
        if p.get("auto") == VOICE_PROJECT_AUTO:
            return p
    return None


def voice_project_record(pid: str, now_ts: float) -> dict:
    """Ein neues Projekt „Gespräche“ mit 14 Tagen Lebensdauer (angelegt beim ersten Gespräch)."""
    return {"id": pid, "name": VOICE_PROJECT_NAME, "auto": VOICE_PROJECT_AUTO,
            "description": VOICE_PROJECT_DESCRIPTION, "instructions": "",
            "retention_days": VOICE_PROJECT_DAYS, "created": now_ts, "updated": now_ts}


def describe(days: int) -> str:
    """„30 Tage“, „1 Tag“ oder „aus“ – für Hinweise in der Oberfläche und im Modelltext."""
    return "aus" if days <= KEEP else f"{days} Tag" + ("" if days == 1 else "e")
