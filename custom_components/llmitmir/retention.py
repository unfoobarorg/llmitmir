"""Lebensdauer von Chats und Coworks (pure, unit-tested).

Chats und Coworks können nach einer Frist von selbst verschwinden: je Projekt eine eigene Frist, für alles
außerhalb eines Projekts die Frist aus den Einstellungen der Person. Standardmäßig ist das Löschen aus – erst
wenn die Person es einschaltet, gilt eine Frist (vorgeschlagen werden 30 Tage). Gezählt wird ab der letzten
Benutzung, damit ein Chat, in dem noch gearbeitet wird, nicht unter der Hand verschwindet. Angeheftete Chats
und die Läufe geplanter Aufgaben bleiben (die gehören zu ihrer Aufgabe, nicht zum Verlauf).
"""
from __future__ import annotations

DEFAULT_DAYS = 0      # Standard: automatisches Löschen ist aus
SUGGEST_DAYS = 30     # Vorschlag, sobald die Person das Löschen einschaltet
MAX_DAYS = 3650       # zehn Jahre – „beliebig“ heißt nicht „unendlich viele Ziffern“
KEEP = 0              # 0 Tage = aus, also unbegrenzt aufbewahren
KINDS = ("chat", "cowork")   # task_run gehört zur Aufgabe und bleibt


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
    for cid, c in (chats or {}).items():
        if c.get("kind") not in kinds or c.get("pinned"):
            continue
        days = days_for(c, projects, settings)
        if days <= KEEP:
            continue
        last = float(c.get("updated") or c.get("created") or 0)
        if last and now_ts - last >= days * 86400:
            out.append((last, cid))
    return [cid for _last, cid in sorted(out)]


def describe(days: int) -> str:
    """„30 Tage“, „1 Tag“ oder „aus“ – für Hinweise in der Oberfläche und im Modelltext."""
    return "aus" if days <= KEEP else f"{days} Tag" + ("" if days == 1 else "e")
