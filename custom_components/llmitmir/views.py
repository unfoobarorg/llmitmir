"""Simple view (Laien-Ansicht) and expert view: which person gets which.

The admin sets a rule for everybody and, optionally, per person:
  "choice"  – the person chooses in the settings; it starts in the simple view
  "simple"  – always the simple view
  "expert"  – always the expert view

Pure functions without Home Assistant imports (unit-tested).
"""
from __future__ import annotations

SIMPLE = "simple"
EXPERT = "expert"
CHOICE = "choice"
VIEWS = (SIMPLE, EXPERT)
POLICIES = (CHOICE, SIMPLE, EXPERT)

DEFAULT = {"default": CHOICE, "users": {}}


def policy_for(cfg: dict | None, user_id: str) -> str:
    """The rule that applies to this person: their own one, else the one for everybody."""
    cfg = cfg or {}
    p = (cfg.get("users") or {}).get(user_id) or cfg.get("default") or CHOICE
    return p if p in POLICIES else CHOICE


def resolve(cfg: dict | None, user_id: str, setting: str | None) -> dict:
    """View for this person. ``setting`` is the person's own choice (only counts under "choice")."""
    p = policy_for(cfg, user_id)
    if p == CHOICE:
        return {"view": setting if setting in VIEWS else SIMPLE, "locked": False, "policy": p}
    return {"view": p, "locked": True, "policy": p}


def clean(cfg: dict | None) -> dict:
    """Validate the admin input; an empty per-person rule means "as for everybody"."""
    cfg = cfg or {}
    default = cfg.get("default") or CHOICE
    if default not in POLICIES:
        raise ValueError("Ungültige Ansicht")
    users = {}
    for uid, p in (cfg.get("users") or {}).items():
        if not p:
            continue
        if p not in POLICIES:
            raise ValueError("Ungültige Ansicht")
        users[str(uid)] = p
    return {"default": default, "users": users}
