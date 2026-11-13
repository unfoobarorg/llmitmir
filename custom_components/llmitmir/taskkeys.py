"""Which API key scheduled tasks use, and the daily usage of all tasks per key.

Pure functions without Home Assistant imports (unit-tested).
"""
from __future__ import annotations

import hashlib
from datetime import date, timedelta

ZERO = {"requests": 0, "prompt": 0, "completion": 0}


def fingerprint(key: str) -> str:
    """Stable, non-reversible id of a key; usage is stored under this, never under the key itself."""
    return hashlib.sha256(key.encode()).hexdigest()[:16] if key else ""


def choices(mode: str, central: str, main: str, main_is_own: bool) -> list[str]:
    """Which task keys this person may pick, given the admin's mode.

    "same" = the normal key (chats and coworks), "own" = an own task key, "shared" = the central task key.
    """
    if mode == "user":
        return ["same", "own"] + (["shared"] if central else [])
    if mode == "own":
        # Der Admin verlangt einen eigenen Schluessel je Person: kein zentraler, kein gemeinsamer.
        # Wer selbst einen eigenen Schluessel fuer Chats und Coworks hat, darf denselben fuer alles nutzen.
        return (["same"] if main_is_own and main else []) + ["own"]
    return []


def resolve(mode: str, choice: str | None, central: str, own: str, main: str, main_is_own: bool = False) -> dict:
    """Key for scheduled tasks.

    mode:       admin setting – "same", "shared" (central task key for all), "user" (each person chooses)
                or "own" (everybody must use an own task key)
    choice:     the person's choice in "user" and "own" mode – "same", "own" or "shared"
    main_is_own: the normal key belongs to this person (not a shared one)
    Falls back to the normal key if the chosen task key is not filled in – except in "own" mode, where a
    shared key must never be used for tasks: then no key is returned and the run reports what is missing.
    """
    if mode == "shared":
        choice = "shared"
    elif mode == "own":
        allowed = choices(mode, central, main, main_is_own)
        choice = choice if choice in allowed else allowed[-1]
    elif mode == "user":
        choice = choice if choice in ("same", "own", "shared") else "same"
    else:
        choice = "same"
    key = central if choice == "shared" else own if choice == "own" else ""
    if not key:
        if mode == "own" and choice != "same":
            # Ohne eigenen Schluessel laeuft keine Aufgabe – der gemeinsame Schluessel gilt hier nie.
            return {"choice": choice, "source": choice, "key": "", "separate": False, "fallback": False, "missing": True}
        return {"choice": choice, "source": "same", "key": main, "separate": False, "fallback": choice != "same",
                "missing": False}
    return {"choice": choice, "source": choice, "key": key, "separate": key != main, "fallback": False, "missing": False}


def add_day(usage: dict, fp: str, prompt: int, completion: int, requests: int = 1,
            today: date | None = None, keep_days: int = 60) -> dict:
    """Add one request to ``usage[fp][today]`` and drop days older than ``keep_days``."""
    today = today or date.today()
    days = usage.setdefault(fp, {})
    u = days.setdefault(today.isoformat(), dict(ZERO))
    u["requests"] += requests
    u["prompt"] += int(prompt or 0)
    u["completion"] += int(completion or 0)
    cutoff = (today - timedelta(days=keep_days)).isoformat()
    for f in list(usage):
        for d in [d for d in usage[f] if d < cutoff]:
            usage[f].pop(d, None)
        if not usage[f]:
            usage.pop(f, None)
    return u


def key_usage(usage: dict, fp: str, days: int = 14, today: date | None = None) -> dict:
    """Today's usage and the last ``days`` days (oldest first, gaps filled with zero) of one key."""
    today = today or date.today()
    per_key = usage.get(fp) or {}
    hist = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        hist.append({"day": d, **(per_key.get(d) or ZERO)})
    return {"today": dict(per_key.get(today.isoformat()) or ZERO), "days": hist}


def quota_usage(u: dict) -> tuple[int, int]:
    """(requests, tokens) that count against the personal quota: everything except tasks on a separate key."""
    req = int(u.get("requests") or 0) - int(u.get("sep_requests") or 0)
    tok = int(u.get("prompt") or 0) + int(u.get("completion") or 0) - int(u.get("sep_tokens") or 0)
    return max(0, req), max(0, tok)


def task_part(u: dict) -> dict:
    """Usage of scheduled tasks within a user's day record."""
    return {"requests": int(u.get("task_requests") or 0), "prompt": int(u.get("task_prompt") or 0),
            "completion": int(u.get("task_completion") or 0)}
