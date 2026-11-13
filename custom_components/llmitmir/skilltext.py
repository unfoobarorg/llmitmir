"""Anleitungstexte von Skills: Abschnitte ausschneiden (ohne Home Assistant, damit es prüfbar bleibt).

``skill_load`` liefert immer die vollständige Anleitung – gekürzt wird nie, denn eine halbe Arbeitsanweisung ist
schlimmer als eine lange. Wer nur ein Thema braucht, holt mit ``bereich`` genau diesen Abschnitt.
"""
from __future__ import annotations

import re


def section(body: str, name: str) -> str:
    """Einen Abschnitt einer Anleitung ausschneiden: von der Überschrift bis zur nächsten gleichen oder höheren Ebene.

    Gesucht wird die erste Überschrift, die den Text enthält (Groß-/Kleinschreibung egal, führende # egal). Wird
    nichts gefunden, kommt die vollständige Anleitung zurück – lieber zu viel als eine leere Antwort.
    """
    want = str(name or "").strip().casefold().lstrip("#").strip()
    if not want:
        return body
    lines = str(body or "").splitlines()
    start = level = None
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m and want in m.group(2).strip().casefold():
            start, level = i, len(m.group(1))
            break
    if start is None:
        return body
    end = len(lines)
    for j in range(start + 1, len(lines)):
        m = re.match(r"^(#{1,6})\s+", lines[j])
        if m and len(m.group(1)) <= level:
            end = j
            break
    return "\n".join(lines[start:end]).strip()
