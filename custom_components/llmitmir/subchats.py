"""Teilaufgaben (Unterchats): ein Hauptchat verteilt Arbeit auf eigene Chats (rein, unit-getestet).

Ein Unterchat ist ein normaler Chat (``kind`` bleibt ``chat`` oder ``cowork``) mit ein paar Feldern mehr:

- ``parent_id``: der Hauptchat. Es gibt genau eine Ebene – ein Unterchat hat selbst keine Unterchats.
- ``sub``: Auftrag, Stand, letztes Ergebnis, wer ihn angelegt hat und ob neue Ergebnisse zurückgemeldet werden.
- am Hauptchat ``subs``: die Unterchats in der Reihenfolge, in der sie entstanden sind.

Der Hauptchat liest nie den Verlauf eines Unterchats, nur dessen Zusammenfassung (``sub.ergebnis``). Rückmeldungen
stehen im Verlauf des Hauptchats als Nachricht ``role: "sub_result"``; für das Modell wird daraus eine kurze
Nachricht der Person (``api_text``).

In der Oberfläche heißt das „Teilaufgabe“; im Code bleibt es beim Unterchat.

Dieses Modul kennt Home Assistant nicht, damit es sich direkt testen lässt.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Awaitable, Callable, Iterable

# Stand eines Unterchats (sub.status)
LAEUFT = "laeuft"          # arbeitet gerade
WARTET = "wartet"          # wartet auf eine Freigabe oder auf einen freien Platz
GRENZE = "grenze"          # eine Grenze erreicht (Schritte, Kontingent, Monatslimit), Teilergebnis gemeldet
FERTIG = "fertig"
FEHLER = "fehler"
ABGEBROCHEN = "abgebrochen"
NEU = "neu"                # von Hand abgezweigt, noch nichts passiert
STATUSES = (NEU, LAEUFT, WARTET, GRENZE, FERTIG, FEHLER, ABGEBROCHEN)
ACTIVE = (LAEUFT, WARTET)  # Stände, in denen die Teilaufgabe noch arbeitet

# Wer den Unterchat angelegt hat
VON_AGENT = "agent"        # der Hauptchat (Werkzeug unterchat_starten)
VON_PERSON = "person"      # von Hand abgezweigt („Als Teilaufgabe weiterarbeiten“)

# Zusammenfassung für den Hauptchat: höchstens etwa 1.500 Tokens (rund 3,5 Zeichen je Token)
RESULT_MAX_CHARS = 5200
AUFTRAG_MAX_CHARS = 20000
TITLE_MAX = 80
MAX_FILES = 40


def is_sub(chat: dict | None) -> bool:
    return bool((chat or {}).get("parent_id"))


def root_id(chat: dict | None) -> str:
    """Der Hauptchat eines Baums: bei einem Unterchat sein Hauptchat, sonst der Chat selbst."""
    c = chat or {}
    return str(c.get("parent_id") or c.get("id") or "")


def children(chats: dict | None, parent_id: str) -> list[str]:
    """Ids der Unterchats eines Hauptchats aus dem Index (meta.json), älteste zuerst."""
    subs = [(float(c.get("created") or 0), cid) for cid, c in (chats or {}).items()
            if c.get("parent_id") == parent_id and cid != parent_id]
    return [cid for _t, cid in sorted(subs)]


def tree(chats: dict | None, chat_id: str) -> list[str]:
    """Der Chat und alle seine Unterchats (Unterchats zuerst, damit beim Löschen nichts verwaist)."""
    return children(chats, chat_id) + [chat_id]


def last_used(chats: dict | None, chat_id: str) -> float:
    """Letzte Benutzung eines Baums: Arbeit in einem Unterchat zählt auch für den Hauptchat."""
    idx = chats or {}
    times = [float((idx.get(cid) or {}).get("updated") or (idx.get(cid) or {}).get("created") or 0)
             for cid in tree(idx, chat_id)]
    return max(times or [0.0])


def clip(text: Any, limit: int) -> str:
    t = str(text or "").strip()
    if len(t) <= limit:
        return t
    return t[:limit].rstrip() + " …"


def clean_title(title: Any, fallback: str = "Teilaufgabe") -> str:
    t = re.sub(r"\s+", " ", str(title or "")).strip()
    return clip(t, TITLE_MAX) if t else fallback


def clean_files(files: Any) -> list[str]:
    """Dateinamen aus einer Rückmeldung: Text oder Liste, ohne Leeres und Doppeltes."""
    if isinstance(files, str):
        files = re.split(r"[,\n]", files)
    out: list[str] = []
    for f in files or []:
        name = str(f or "").strip().lstrip("/")
        if name.startswith("workspace/"):
            name = name[len("workspace/"):]
        if name and name not in out:
            out.append(name[:200])
    return out[:MAX_FILES]


def new_sub(auftrag: str, von: str = VON_AGENT, status: str = NEU, call_id: str | None = None,
            model_choice: str | None = None) -> dict:
    """Das Feld ``sub`` eines neuen Unterchats."""
    out = {"auftrag": clip(auftrag, AUFTRAG_MAX_CHARS), "status": status if status in STATUSES else NEU,
           "ergebnis": None, "von": von if von in (VON_AGENT, VON_PERSON) else VON_AGENT, "melden": True}
    if call_id:
        out["call_id"] = call_id   # der Werkzeugaufruf im Hauptchat, zu dem die Karte gehört
    if model_choice:
        out["modell"] = model_choice
    return out


def result(summary: Any, files: Any = None, status: str = FERTIG, reason: str = "", at: float = 0) -> dict:
    """Ein Ergebnis für den Hauptchat (``sub.ergebnis``): Zusammenfassung, Dateien, Stand und ggf. der Grund."""
    out = {"zusammenfassung": clip(summary, RESULT_MAX_CHARS) or "(keine Zusammenfassung)",
           "dateien": clean_files(files), "stand": status if status in STATUSES else FERTIG}
    if reason:
        out["grund"] = clip(reason, 600)
    if at:
        out["at"] = at
    return out


def result_message(sub_chat: dict, res: dict, msg_id: str, created: float, nachtrag: bool = False) -> dict:
    """Die Rückmeldung im Verlauf des Hauptchats (``role: "sub_result"``)."""
    return {"id": msg_id, "role": "sub_result", "created": created, "sub_id": sub_chat.get("id"),
            "title": sub_chat.get("title") or "Teilaufgabe", "summary": res.get("zusammenfassung") or "",
            "files": list(res.get("dateien") or []), "status": res.get("stand") or FERTIG,
            "reason": res.get("grund") or "", "nachtrag": bool(nachtrag)}


STATUS_TEXT = {NEU: "neu", LAEUFT: "läuft", WARTET: "wartet", GRENZE: "Grenze erreicht", FERTIG: "fertig",
               FEHLER: "Fehler", ABGEBROCHEN: "abgebrochen"}


def api_text(msg: dict) -> str:
    """Eine Rückmeldung als kurze Nachricht für das Modell des Hauptchats – nie der Verlauf des Unterchats."""
    title = msg.get("title") or "Teilaufgabe"
    head = ("Nachtrag aus" if msg.get("nachtrag") else "Ergebnis aus") + f" Unterchat ›{title}‹ (id {msg.get('sub_id')}"
    head += f", Stand: {STATUS_TEXT.get(msg.get('status'), msg.get('status') or 'fertig')})"
    text = f"[LLMitMir] {head}:\n{msg.get('summary') or '(keine Zusammenfassung)'}"
    if msg.get("reason"):
        text += f"\nGrund: {msg['reason']}"
    if msg.get("files"):
        text += "\nDateien im Arbeitsbereich: " + ", ".join(msg["files"])
    return text


def summary_fields(chat: dict) -> dict:
    """Was die Seitenleiste je Chat zusätzlich braucht (chat_summary), ohne den Verlauf zu laden."""
    sub = chat.get("sub") or {}
    is_s = bool(chat.get("parent_id"))
    return {"parent_id": chat.get("parent_id"), "sub_status": sub.get("status") if is_s else None,
            "sub_call": sub.get("call_id") if is_s else None, "sub_von": sub.get("von") if is_s else None,
            "sub_wait": sub.get("wartet_auf") if is_s else None}


def message_text(msg: dict | None) -> str:
    """Der Text einer Nachricht als Auftrag (beim Abzweigen von Hand)."""
    m = msg or {}
    if m.get("role") == "sub_result":
        return str(m.get("summary") or "")
    c = m.get("content")
    if isinstance(c, list):
        return "\n".join(str(p.get("text") or "") for p in c if isinstance(p, dict))
    return str(c or "")


def title_from(text: str) -> str:
    t = re.sub(r"[#*_`>]+", "", str(text or ""))
    t = re.sub(r"\s+", " ", t).strip()
    return clean_title(t[:60] + ("…" if len(t) > 60 else ""))


def ordered(ids: Iterable[str], subs: list[str] | None) -> list[str]:
    """Reihenfolge am Hauptchat nachziehen: bekannte zuerst in ihrer Reihenfolge, neue hinten."""
    have = [s for s in subs or [] if s in set(ids)]
    return have + [s for s in ids if s not in have]


# ---------------------------------------------------------------- Delegation (Werkzeuge des Hauptchats)
MODEL_CHOICES = ("sparsam", "stark", "wie_hauptchat")


def pick_model(choice: Any, main_model: str, main_auto: bool, sparsam: str, stark: str,
               is_external: Callable[[str], bool], usable: Callable[[str], bool]) -> tuple[str, bool, str]:
    """Modell einer neuen Teilaufgabe: (Modell, automatisch, Hinweis für den Hauptchat).

    ``sparsam`` nimmt die beste Wahl der Rolle „sub“, ``stark`` die der Rolle „agent“, ``wie_hauptchat`` das Modell
    des Hauptchats; sonst eine Modell-ID. Kostenpflichtige externe Modelle nur, wenn die Person sie für den Hauptchat
    ausdrücklich gewählt hat – sonst geht es sparsam weiter."""
    c = str(choice or "sparsam").strip()
    key = c.lower().replace("-", "_").replace(" ", "_")
    main_ext_chosen = is_external(main_model or "") and not main_auto
    note = ""
    if key in ("", "sparsam"):
        model, auto = sparsam, True
    elif key == "stark":
        model, auto = stark, True
    elif key in ("wie_hauptchat", "hauptchat"):
        model, auto = main_model, bool(main_auto)
    elif usable(c):
        model, auto = c, False
    else:
        model, auto, note = sparsam, True, f"Modell „{c}“ ist nicht verfügbar – die Teilaufgabe läuft sparsam."
    if model and is_external(model) and not main_ext_chosen:
        model, auto, note = sparsam, True, ("Kostenpflichtige externe Modelle nur, wenn die Person sie für den Hauptchat "
                                            "gewählt hat – die Teilaufgabe läuft sparsam.")
    return model or sparsam, auto, note


def final_status(run_status: str, error: str | None = None, limit_hit: bool = False, limit_error: bool = False) -> str:
    """Stand einer Teilaufgabe nach ihrem Lauf. Eine Grenze (Schritte, Kontingent, Monatslimit, Modell dauerhaft
    ausgelastet) heißt „grenze“, alles Unerwartete „fehler“."""
    if run_status == "stopped":
        return ABGEBROCHEN
    if run_status == "error" or error:
        return GRENZE if limit_error else FEHLER
    if limit_hit:
        return GRENZE
    return FERTIG


def last_answer(messages: list[dict] | None) -> str:
    """Der Text der letzten Antwort (für die Zusammenfassung, wenn ergebnis_melden fehlt)."""
    for m in reversed(messages or []):
        if m.get("role") == "assistant" and str(m.get("content") or "").strip() and not m.get("error"):
            return str(m["content"]).strip()
    return ""


def summary_request(auftrag: str, answer: str) -> list[dict]:
    """Bitte an ein sparsames Modell, die letzte Antwort einer Teilaufgabe für den Hauptchat zusammenzufassen."""
    return [{"role": "system", "content": (
        "Fasse das Ergebnis einer Teilaufgabe für den Hauptchat zusammen, der den Verlauf nicht kennt: alle Fakten, "
        "Zahlen, Namen und Dateinamen, die er braucht, offene Punkte und Rückfragen. Höchstens 1.000 Wörter, Markdown, "
        "keine Einleitung.")},
        {"role": "user", "content": f"Auftrag:\n{clip(auftrag, 4000)}\n\nLetzte Antwort der Teilaufgabe:\n{clip(answer, 30000)}"}]


def tool_result(sub_chat: dict, res: dict, note: str = "") -> dict:
    """Werkzeug-Ergebnis für den Hauptchat: nur die Zusammenfassung, nie der Verlauf."""
    out = {"id": sub_chat.get("id"), "titel": sub_chat.get("title"), "stand": res.get("stand") or FERTIG,
           "zusammenfassung": res.get("zusammenfassung") or "", "dateien": list(res.get("dateien") or [])}
    if res.get("grund"):
        out["grund"] = res["grund"]
    if out["stand"] in (GRENZE, FEHLER, ABGEBROCHEN):
        out["hinweis"] = ("Die Teilaufgabe ist nicht fertig geworden. Entscheide: mit unterchat_nachricht weitermachen "
                          "lassen, den Rest selbst übernehmen oder die Person fragen.")
    if note:
        out["hinweis_modell"] = note
    return out


def clean_groups(groups: Any, allowed: Iterable[str]) -> list[str] | None:
    """Werkzeuggruppen aus ``werkzeuge`` (None = wie der Hauptchat)."""
    if not groups:
        return None
    if isinstance(groups, str):
        groups = re.split(r"[,\s]+", groups)
    ok = set(allowed)
    out = [g for g in dict.fromkeys(str(x).strip() for x in groups) if g in ok]
    return out or None


class Slots:
    """Plätze für gleichzeitig laufende Teilaufgaben je Person, der Reihe nach vergeben.

    ``acquire`` wartet, bis ein Platz frei ist (oder ``cancel`` gesetzt wird – dann False); ``release`` gibt den Platz
    an die nächste wartende Teilaufgabe weiter."""

    def __init__(self, limit: int) -> None:
        self.limit = max(1, int(limit))
        self.used: dict[str, int] = {}
        self.queue: dict[str, list[asyncio.Future]] = {}

    def busy(self, user: str) -> int:
        return self.used.get(user, 0)

    def waiting(self, user: str) -> int:
        return len([f for f in self.queue.get(user, []) if not f.done()])

    async def acquire(self, user: str, cancel: asyncio.Event | None = None,
                      on_wait: Callable[[], Awaitable[None]] | None = None) -> bool:
        if self.used.get(user, 0) < self.limit and not self.waiting(user):
            self.used[user] = self.used.get(user, 0) + 1
            return True
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self.queue.setdefault(user, []).append(fut)
        if on_wait:
            await on_wait()
        waiters = {fut}
        stop = asyncio.ensure_future(cancel.wait()) if cancel else None
        if stop:
            waiters.add(stop)
        try:
            await asyncio.wait(waiters, return_when=asyncio.FIRST_COMPLETED)
        finally:
            if stop and not stop.done():
                stop.cancel()
        if fut.done():
            if cancel and cancel.is_set():
                self.release(user)  # Platz bekommen, aber schon abgebrochen: gleich weitergeben
                return False
            return True
        fut.cancel()
        self.queue[user] = [f for f in self.queue.get(user, []) if f is not fut]
        return False

    def release(self, user: str) -> None:
        for f in self.queue.get(user, []):
            if not f.done():
                self.queue[user].remove(f)
                f.set_result(True)  # der Platz geht direkt weiter, die Zahl bleibt gleich
                return
        self.used[user] = max(0, self.used.get(user, 0) - 1)


# ---------------------------------------------------------------- Freigaben zentral im Hauptchat
def with_origin(info: dict, root: str, sub_title: str, root_title: str = "") -> dict:
    """Eine Freigabe aus einer Teilaufgabe: Herkunft dazu, damit der Hauptchat sie zeigt und die Push-Nachricht dorthin
    führt."""
    return dict(info, root_chat_id=root, sub_title=sub_title or "Teilaufgabe", root_title=root_title or "")


def belongs_to(perm: dict, chat_id: str) -> bool:
    """Gehört die Freigabe in diesen Chat? Im Hauptchat erscheinen auch die seiner Teilaufgaben."""
    return perm.get("chat_id") == chat_id or perm.get("root_chat_id") == chat_id


def timeout_answer(custom_wait: bool, is_sub: bool) -> str:
    """Antwort, wenn niemand reagiert: mit eigener Wartezeit oder in einer Teilaufgabe ohne die Aktion weiter, sonst
    nach einer Stunde ablehnen."""
    return "skip" if custom_wait or is_sub else "deny"


def sub_allows(chat: dict, tool: str) -> bool:
    """„Immer erlauben“ aus dieser Teilaufgabe (gilt nur in ihr selbst)."""
    return bool(chat.get("parent_id")) and (chat.get("permissions") or {}).get(tool) == "allow"


def remember_allow(chat: dict, tool: str) -> bool:
    """„Immer erlauben“ in einer Teilaufgabe merken (True); bei einem normalen Chat False – dann gilt es wie bisher
    für das Projekt bzw. alle Chats ohne Projekt."""
    if not chat.get("parent_id"):
        return False
    chat.setdefault("permissions", {})[tool] = "allow"
    return True
