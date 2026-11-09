"""Whether a finished scheduled run sends a push notification (pure, unit-tested).

The model declares the outcome of a run with the tool `task_result`: "nichts" (nothing worth telling),
"ergebnis" (a new result) or "frage" (it needs a decision from the person). The person's setting decides what
reaches the phone: "always" everything, "on_change" new results, questions and errors, "error" only errors,
"never" nothing. A run that was stopped by hand is not an error.

"New" means new to the person: what was already sent (same wording, or nearly the same) stays silent, so a
standing state ("keine neuen Mails") or an unanswered question does not ring every day. After REMIND_DAYS the
same message is sent once more as a reminder.
"""
from __future__ import annotations

import difflib
import re

ARTS = ("nichts", "ergebnis", "frage")
LABELS = {"nichts": "nichts zu melden", "ergebnis": "neues Ergebnis", "frage": "Rückfrage"}
SAME = 0.8  # similarity from which two messages with the same numbers count as the same news
REMIND_DAYS = 7  # the same message is repeated at most this often


def _norm(text: str) -> str:
    t = re.sub(r"[^0-9a-zäöüß]+", " ", (text or "").casefold())
    return " ".join(t.split())


def _numbers(text: str) -> set[str]:
    """Every number in the text – a changed amount or date is always news."""
    return set(re.findall(r"\d+", text or ""))


def same_news(a: str, b: str) -> bool:
    """True if b says essentially what a said: same numbers and nearly the same wording."""
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    if _numbers(a) != _numbers(b):
        return False
    return difflib.SequenceMatcher(None, na, nb).ratio() >= SAME


def should_notify(mode: str, status: str, art: str, text: str = "", last_text: str = "",
                  last_at: float | None = None, now: float | None = None) -> bool:
    """mode = the task's setting, status = how the run ended, art/text = what the model declared,
    last_text/last_at = what the person was last told about this task and when."""
    failed = status == "error"
    art = art if art in ARTS else "nichts"
    if mode == "always":
        return True
    if mode == "error":
        return failed
    if mode == "on_change":
        if failed:
            return True
        if art == "nichts":
            return False
        if not same_news(text, last_text):
            return True
        # the same message again: only as a reminder after a while, not every run
        if last_at is None or now is None:
            return False
        return (now - last_at) >= REMIND_DAYS * 86400
    return False
