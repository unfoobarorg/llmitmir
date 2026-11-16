"""Volltextsuche über Chatnachrichten (rein, unit-getestet).

Die Chatliste durchsucht bisher nur den Titel. Wer wissen will, „wo stand noch mal die Rechnung über
412,80 €?“, musste sich an den Titel erinnern. Hier wird der Inhalt durchsucht – mit einem Ausschnitt
rings um den Treffer, damit man die Stelle wiedererkennt.

Gesucht wird ohne Rücksicht auf Groß- und Kleinschreibung; Umlaute bleiben, wie sie sind. Werkzeug-
ergebnisse zählen mit, denn dort stehen die Zahlen und Namen meistens.
"""
from __future__ import annotations

MAX_QUERY = 120      # längere Suchtexte werden abgeschnitten
SNIPPET = 60         # Zeichen links und rechts eines Treffers
PER_CHAT = 3         # höchstens so viele Treffer je Chat
MAX_CHATS = 400      # so viele Chats werden höchstens durchsucht (die jüngsten)


def clean_query(text) -> str:
    """Suchtext normalisieren; leer heißt: keine Suche."""
    return " ".join(str(text or "").split())[:MAX_QUERY]


def _text_of(message: dict) -> str:
    """Der durchsuchbare Text einer Nachricht: Inhalt und, bei Werkzeugen, das Ergebnis."""
    parts = []
    for key in ("content", "error"):
        v = message.get(key)
        if isinstance(v, str) and v:
            parts.append(v)
    args = message.get("args")
    if isinstance(args, dict):
        # Werkzeug-Eingaben nennen oft das Entscheidende (Dateiname, Entität, Suchbegriff)
        parts += [str(v) for v in args.values() if isinstance(v, (str, int, float)) and str(v).strip()]
    return "\n".join(parts)


def snippet(text: str, query: str, width: int = SNIPPET) -> str:
    """Ein Ausschnitt um den ersten Treffer, mit Auslassungszeichen an den abgeschnittenen Enden."""
    low, q = text.casefold(), query.casefold()
    i = low.find(q)
    if i < 0:
        return ""
    start = max(0, i - width)
    end = min(len(text), i + len(q) + width)
    out = " ".join(text[start:end].split())
    if start > 0:
        out = "… " + out
    if end < len(text):
        out = out + " …"
    return out


def search_chat(chat: dict, query: str, limit: int = PER_CHAT) -> list[dict]:
    """Treffer in einem Chat: je Treffer Zeitpunkt, Rolle und Ausschnitt."""
    q = clean_query(query)
    if not q:
        return []
    out: list[dict] = []
    for m in chat.get("messages") or []:
        if not isinstance(m, dict):
            continue
        text = _text_of(m)
        if not text or q.casefold() not in text.casefold():
            continue
        out.append({"created": m.get("created"), "role": m.get("role") or "",
                    "snippet": snippet(text, q)})
        if len(out) >= limit:
            break
    return out


def rank(chats: list[dict], query: str, limit: int = PER_CHAT) -> list[dict]:
    """Chats mit Treffern, die jüngsten zuerst.

    ``chats`` sind fertig geladene Chats (mit ``messages``). Zurück kommen je Chat die Kennung, der Titel
    und die Treffer – Chats ohne Treffer fallen weg.
    """
    q = clean_query(query)
    if not q:
        return []
    hits = []
    for chat in chats:
        found = search_chat(chat, q, limit)
        if found:
            hits.append({"chat_id": chat.get("id"), "title": chat.get("title") or "",
                         "kind": chat.get("kind") or "", "updated": chat.get("updated") or 0,
                         "hits": found})
    hits.sort(key=lambda c: c.get("updated") or 0, reverse=True)
    return hits


def title_match(title: str, query: str) -> bool:
    """Ob schon der Titel passt – solche Chats zeigt die Liste ohnehin."""
    q = clean_query(query)
    return bool(q) and q.casefold() in str(title or "").casefold()
