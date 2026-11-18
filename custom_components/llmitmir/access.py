"""Who may see, change and pass on a dashboard or a tile (pure, unit-tested).

Dashboards and tiles belong to the person who made them. The owner can share them:

- with single people – *ansehen*, *bearbeiten* and, on top, *weiter teilen*;
- with everybody who may use LLMitMir (``all``), now and in the future.

Whoever may pass something on can add further people, but never with more rights than they have themselves, and can
only take back what they granted (``by``). If somebody loses the right to pass on – or their access altogether –
everything they granted disappears as well, all the way down the chain (``normalize``).

Notifications are the receiver's business: everybody who can see a tile switches „Mich benachrichtigen“ for themselves
(``notify``). The owner's own notifications follow the tile's task.

Scheduled tasks keep their own, older sharing (sharing.py); nothing here touches them.
"""
from __future__ import annotations

MAX_USERS = 20


def _flags(e) -> dict:
    e = e if isinstance(e, dict) else {}
    return {"edit": bool(e.get("edit")), "reshare": bool(e.get("reshare"))}


def empty() -> dict:
    return {"all": None, "users": {}, "notify": []}


def clean(share) -> dict:
    """A share map in its stored form, whatever was stored before."""
    share = share if isinstance(share, dict) else {}
    out = empty()
    if isinstance(share.get("all"), dict):
        out["all"] = _flags(share["all"])
    for uid, e in (share.get("users") or {}).items():
        if not isinstance(uid, str) or not uid or not isinstance(e, dict):
            continue
        out["users"][uid] = dict(_flags(e), by=str(e.get("by") or ""))
    out["notify"] = [u for u in dict.fromkeys(share.get("notify") or []) if isinstance(u, str) and u]
    return out


def rights(owner: str, share, user_id: str) -> dict:
    """What this person may do: view, edit, reshare (owner: everything, plus ``owner``)."""
    if user_id and user_id == owner:
        return {"owner": True, "view": True, "edit": True, "reshare": True}
    share = share if isinstance(share, dict) else {}
    r = {"owner": False, "view": False, "edit": False, "reshare": False}
    a = share.get("all")
    if isinstance(a, dict):
        r.update(view=True, edit=bool(a.get("edit")), reshare=bool(a.get("reshare")))
    e = (share.get("users") or {}).get(user_id)
    if isinstance(e, dict):
        r["view"] = True
        r["edit"] = r["edit"] or bool(e.get("edit"))
        r["reshare"] = r["reshare"] or bool(e.get("reshare"))
    return r


def normalize(owner: str, share) -> dict:
    """Drop and trim what no longer holds: entries granted by somebody who may not pass on any more (recursively),
    rights above what the granting person has, the owner in the list, notification wishes of people who cannot see."""
    share = clean(share)
    users = share["users"]
    users.pop(owner, None)
    changed = True
    while changed:
        changed = False
        for uid, e in list(users.items()):
            by = e.get("by") or owner
            if by == owner:
                continue
            granter = rights(owner, share, by)
            if not granter["reshare"] or by == uid:
                users.pop(uid)
                changed = True
                continue
            # never more than the granting person has
            edit, reshare = e["edit"] and granter["edit"], e["reshare"] and granter["reshare"]
            if (edit, reshare) != (e["edit"], e["reshare"]):
                e["edit"], e["reshare"] = edit, reshare
                changed = True
    share["notify"] = [u for u in share["notify"] if u == owner or rights(owner, share, u)["view"]]
    return share


def update(owner: str, share, actor: str, users_in, all_in="keep", allowed: set[str] | None = None) -> dict:
    """Apply what ``actor`` sent from the share dialog.

    ``users_in``: [{"user_id", "edit", "reshare"}] – the entries the actor manages (owner: all of them; somebody who
    may pass on: only those they granted themselves – everything else stays as it is).
    ``all_in``: "keep", None (not for everybody) or {"edit", "reshare"} – the owner's decision only.
    ``allowed``: people who may use LLMitMir; others are refused.
    """
    r = rights(owner, share, actor)
    if not (r["owner"] or r["reshare"]):
        raise PermissionError("Du darfst das nicht weiter teilen.")
    cur = clean(share)
    want: dict[str, dict] = {}
    for u in users_in or []:
        if not isinstance(u, dict):
            continue
        uid = str(u.get("user_id") or u.get("id") or "").strip()
        if not uid or uid == owner or uid in want:
            continue
        if allowed is not None and uid not in allowed:
            raise ValueError("Diese Person darf LLMitMir nicht nutzen.")
        want[uid] = _flags(u)
    users: dict[str, dict] = {}
    for uid, e in cur["users"].items():
        mine = r["owner"] or e.get("by") == actor
        if not mine:
            users[uid] = e
        elif uid in want:
            users[uid] = dict(want[uid], by=e.get("by") or owner)
    for uid, f in want.items():
        if uid not in users:
            users[uid] = dict(f, by=actor)
        elif not r["owner"] and users[uid].get("by") != actor:
            continue  # somebody else's entry: not the actor's to change
    if not r["owner"]:
        for e in users.values():
            if e.get("by") == actor:  # never more than the actor has
                e["edit"] = e["edit"] and r["edit"]
                e["reshare"] = e["reshare"] and r["reshare"]
    if len(users) > MAX_USERS:
        raise ValueError(f"Höchstens {MAX_USERS} Personen je Freigabe.")
    out = dict(cur, users=users)
    if all_in != "keep":
        new_all = _flags(all_in) if isinstance(all_in, dict) else None
        if new_all != cur["all"]:
            if not r["owner"]:
                raise PermissionError("„Für alle“ kann nur die Eigentümerin oder der Eigentümer einstellen.")
            out["all"] = new_all
    return normalize(owner, out)


def set_notify(owner: str, share, user_id: str, on: bool) -> dict:
    """„Mich benachrichtigen“ – everybody who can see decides for themselves."""
    share = clean(share)
    if not rights(owner, share, user_id)["view"]:
        raise PermissionError("Diese Kachel ist nicht für dich freigegeben.")
    lst = [u for u in share["notify"] if u != user_id]
    if on:
        lst.append(user_id)
    share["notify"] = lst
    return share


def notify_users(owner: str, share) -> list[str]:
    """Other people who asked for a notification and may still see (the owner follows the task's own setting)."""
    share = clean(share)
    return [u for u in share["notify"] if u != owner and rights(owner, share, u)["view"]]


def users(share) -> list[str]:
    """Everybody named in the share map (without the people reached only through „für alle“)."""
    return list(clean(share)["users"])


def level(e) -> str:
    """ansehen / bearbeiten / weiterteilen – for people and for the model."""
    f = _flags(e)
    return "weiterteilen" if f["reshare"] and f["edit"] else "bearbeiten" if f["edit"] else (
        "ansehen und weiterteilen" if f["reshare"] else "ansehen")


def from_level(name: str) -> dict:
    n = str(name or "").strip().casefold().replace(" ", "").replace("-", "")
    if n in ("weiterteilen", "teilen", "bearbeitenundweiterteilen", "reshare"):
        return {"edit": True, "reshare": True}
    if n in ("bearbeiten", "edit", "ändern", "aendern"):
        return {"edit": True, "reshare": False}
    if n in ("ansehen", "sehen", "view", "lesen", ""):
        return {"edit": False, "reshare": False}
    raise ValueError(f"Unbekannte Stufe „{name}“ (ansehen, bearbeiten, weiterteilen).")


def summary(owner: str, share, names: dict | None = None) -> str:
    """One line: who sees it and what they may do."""
    names = names or {}
    share = clean(share)
    parts = []
    if share["all"]:
        parts.append(f"alle ({level(share['all'])})")
    for uid, e in share["users"].items():
        by = e.get("by")
        via = f", über {names.get(by) or by}" if by and by != owner else ""
        parts.append(f"{names.get(uid) or uid} ({level(e)}{via})")
    return ", ".join(parts) or "niemand"
