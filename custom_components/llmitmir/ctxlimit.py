"""Kontextgröße je Modell: bekannte Werte, Vorgabe des Admins und die Grenze, die der Server selbst nennt.

SAIA nennt in ``/models`` keine Kontextgröße. LLMitMir geht deshalb von der Tabelle ``KNOWN_CONTEXT`` (Angaben der
GWDG) oder vom Wert des Admins aus. Ob der Anbieter das Modell wirklich mit dieser Größe betreibt, zeigt erst eine
Anfrage: Ist sie zu lang, nennt der Server (vLLM, SGLang, OpenAI) in der Fehlermeldung die echte Grenze. LLMitMir
merkt sich diese Grenze eine Zeit lang, kürzt den Verlauf und fragt noch einmal. Gelernt wird nur nach unten: Eine
Grenze, die höher liegt als angenommen, sieht LLMitMir nie in einer Fehlermeldung.
"""
from __future__ import annotations

from typing import Any

from .provider import MIN_CONTEXT, context_limit as parse_limit  # noqa: F401  (liest die Fehlermeldung des Servers)

LEARN_DAYS = 30            # so lange gilt eine gelernte Grenze; danach wird wieder der bekannte Wert versucht
SHRINK = 0.6               # nennt der Server keine (neue) Grenze: Budget für den nächsten Versuch so weit kürzen
MAX_RETRIES = 3            # so oft je Lauf wird nach „Kontext zu lang“ gekürzt und neu gefragt


def learned(entry: Any, now: float) -> int:
    """Gelernte Grenze, solange sie gilt (sonst 0)."""
    if not isinstance(entry, dict):
        return 0
    try:
        n, at = int(entry.get("n") or 0), float(entry.get("at") or 0)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 and now - at < LEARN_DAYS * 86400 else 0


def effective(admin: Any, entry: Any, known: Any, default: int, now: float) -> int:
    """Kontextgröße, mit der LLMitMir rechnet: Wert des Admins, sonst der bekannte, sonst die Vorgabe – höchstens so
    groß wie die Grenze, die der Server zuletzt selbst genannt hat."""
    try:
        size = int(admin or 0) or int(known or 0) or int(default)
    except (TypeError, ValueError):
        size = int(known or 0) or int(default)
    cap = learned(entry, now)
    return min(size, cap) if cap else size


def learn(store: dict, model: str, limit: int, now: float) -> bool:
    """Grenze merken. True, wenn sich etwas geändert hat (dann speichern)."""
    if not model or limit < MIN_CONTEXT:
        return False
    old = store.get(model)
    if learned(old, now) == limit:
        old["at"] = now  # bestätigt: gilt wieder volle Zeit
        return True
    store[model] = {"n": int(limit), "at": now}
    return True


def view(store: Any, now: float) -> dict[str, int]:
    """Nur die noch gültigen Grenzen, für die Admin-Ansicht."""
    return {k: n for k, v in (store or {}).items() if (n := learned(v, now))}
