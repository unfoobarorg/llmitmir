"""Änderungen an fremden Aufgaben (pure, unit-tested).

Eine geteilte Aufgabe läuft immer als ihre Eigentümerin bzw. ihr Eigentümer: mit deren Zugängen, Schlüssel und
Freigaben. Wer sie nur bearbeiten darf, kann deshalb

- Name, Zeitplan und Benachrichtigung ändern – das sofort;
- den Auftrag ändern – dann wartet die Aufgabe, bis die Eigentümerin oder der Eigentümer bestätigt (``pending``);
  bis dahin läuft sie weder geplant noch von Hand;
- nie, was festlegt, womit sie läuft: Schreibfreigaben, Werkzeuge, Werkbank, Projekt, Modell, Notfall-Modell,
  Schrittzahl und Teilen (``OWNER_ONLY``).

Für Kacheln gilt dasselbe: Ihre Beschreibung ist der Auftrag ihrer Aufgabe.
"""
from __future__ import annotations

OWNER_ONLY = ("allow_write", "cred_allow", "tool_groups", "requires", "external_fallback", "model", "project_id", "heavy", "share")
_BOOL = {"external_fallback", "heavy"}


def _norm(key: str, value):
    if key in _BOOL:
        return bool(value)
    if key == "share":
        users = (value or {}).get("users") if isinstance(value, dict) else value
        if isinstance(users, dict):
            return sorted((str(u), bool((e or {}).get("edit")), bool((e or {}).get("notify"))) for u, e in users.items())
        if isinstance(users, list):
            return sorted((str(u.get("user_id") or u.get("id")), bool(u.get("edit")), bool(u.get("notify")))
                          for u in users if isinstance(u, dict))
        return []
    if isinstance(value, (list, tuple, set)):
        return sorted(str(x) for x in value) or None
    return value or None


def owner_only_changes(old: dict, new: dict) -> list[str]:
    """Die Felder aus OWNER_ONLY, die ``new`` gegenüber ``old`` ändern würde (fehlende Felder ändern nichts)."""
    return [k for k in OWNER_ONLY if k in new and _norm(k, new.get(k)) != _norm(k, old.get(k))]


def prompt_changed(old: dict, new: dict) -> bool:
    return "prompt" in new and str(new.get("prompt") or "").strip() != str(old.get("prompt") or "").strip()


def pending(old: dict, by: str, ts: float, **extra) -> dict:
    """Was gemerkt wird, bis bestätigt wird. Ändert dieselbe Aufgabe vorher noch einmal jemand, bleibt der Stand von
    vor der ersten unbestätigten Änderung das, wohin „Verwerfen“ zurückkehrt."""
    before = old.get("pending_approval") or {}
    return {"by": by, "at": ts, "prompt_before": before.get("prompt_before", old.get("prompt") or ""),
            **{k: before.get(k, v) for k, v in extra.items()}}


LABELS = {"allow_write": "Schreibfreigaben", "cred_allow": "Zugänge", "tool_groups": "Werkzeuge", "requires": "Werkbank", "external_fallback":
          "Notfall-Modell", "model": "Modell", "project_id": "Projekt", "heavy": "Schrittzahl", "share": "Teilen"}


def owner_only_error(keys: list[str]) -> str:
    what = ", ".join(LABELS.get(k, k) for k in keys)
    return (f"Das darf nur, wem die Aufgabe gehört: {what}. Die Aufgabe läuft mit deren Zugängen und Freigaben – "
            "frag die Person, ob sie es ändert.")
