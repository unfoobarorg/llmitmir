"""Whether a finished scheduled run sends a push notification (pure, unit-tested).

The model declares the outcome of a run with the tool `task_result`: "nichts" (nothing worth telling),
"ergebnis" (a new result) or "frage" (it needs a decision from the person). The person's setting decides what
reaches the phone: "always" everything, "on_change" new results, questions and errors, "error" only errors,
"never" nothing. A run that was stopped by hand is not an error.
"""
from __future__ import annotations

ARTS = ("nichts", "ergebnis", "frage")
LABELS = {"nichts": "nichts zu melden", "ergebnis": "neues Ergebnis", "frage": "Rückfrage"}


def should_notify(mode: str, status: str, art: str, text: str = "", last_text: str = "") -> bool:
    """mode = the task's setting, status = how the run ended, art/text = what the model declared."""
    failed = status == "error"
    art = art if art in ARTS else "nichts"
    if mode == "always":
        return True
    if mode == "error":
        return failed
    if mode == "on_change":
        return failed or art == "frage" or (art == "ergebnis" and (text or "") != (last_text or ""))
    return False
