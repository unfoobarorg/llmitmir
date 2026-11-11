"""Sharing scheduled tasks with other people of this Home Assistant (pure, unit-tested).

A task belongs to the person who created it. The owner can share it with other people: it then shows up in their
own "Geplant" list, they may change it if the owner allowed that, and they get a push notification on their own
device if the owner wants that. The owner always sees and edits the task and is notified according to the task's
own setting – the share map only ever lists the other people.
"""
from __future__ import annotations

MAX_USERS = 20


def clean(users) -> dict[str, dict]:
    """Validated share map: user id -> {"edit": bool, "notify": bool}.

    Input is what the panel sends: [{"user_id": "…", "edit": true, "notify": false}, …].
    """
    out: dict[str, dict] = {}
    for u in users or []:
        if not isinstance(u, dict):
            continue
        uid = str(u.get("user_id") or u.get("id") or "").strip()
        if not uid or uid in out:
            continue
        out[uid] = {"edit": bool(u.get("edit")), "notify": bool(u.get("notify"))}
        if len(out) >= MAX_USERS:
            break
    return out


def rights(share: dict | None, user_id: str) -> dict:
    """What somebody may do with a task shared with them (the owner is handled outside: always everything)."""
    entry = ((share or {}).get("users") or {}).get(user_id) or {}
    return {"owner": False, "edit": bool(entry.get("edit")), "notify": bool(entry.get("notify"))}


def users(share: dict | None) -> list[str]:
    """Everybody the task is shared with, whether they may edit it or only look."""
    return list(((share or {}).get("users") or {}))


def recipients(share: dict | None) -> list[str]:
    """People who get a push notification of their own (the owner is not part of the share map)."""
    return [uid for uid, e in ((share or {}).get("users") or {}).items() if e.get("notify")]


def summary(share: dict | None, names: dict | None = None) -> str:
    """One line for people and for the model: who sees the task and what they may do."""
    names = names or {}
    entries = (share or {}).get("users") or {}
    if not entries:
        return "niemand"
    parts = []
    for uid, e in entries.items():
        what = ("bearbeiten und Benachrichtigung" if e.get("edit") and e.get("notify")
                else "bearbeiten" if e.get("edit") else "Benachrichtigung" if e.get("notify") else "nur ansehen")
        parts.append(f"{names.get(uid) or uid} ({what})")
    return ", ".join(parts)
