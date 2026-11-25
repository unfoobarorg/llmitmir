"""Chats mit internen Daten für externe Modelle sperren.

Beim Wechsel auf ein externes Modell geht der ganze Verlauf mit. Werkzeug-Ergebnisse aus gesperrten Zugängen nimmt
LLMitMir zwar heraus (``agent.Run._tool_content``), aber was ein Modell daraus gemacht hat – Zusammenfassungen in
seinen Antworten, Argumente späterer Aufrufe, Dateien im Arbeitsbereich, Ergebnisse von Teilaufgaben – lässt sich
nicht zuverlässig wieder herauslösen. Deshalb bekommt ein Chat eine **dauerhafte Markierung**, sobald interne Daten
hineinkommen:

- ein Werkzeug lief erfolgreich mit einem Zugang, der nicht für externe Modelle freigegeben ist (auch MCP-Werkzeuge
  eines Konnektors),
- der Wächter einer Datenregel, die nur für externe Modelle gilt, hat nicht geprüft, weil ein internes Modell lief
  (``ext_block``),
- ein eigener Skill mit „Nur für interne Modelle“ wurde gelesen (``skill_load``, ``skill_file``, ``llmitmir_info``).

Die Markierung bleibt, auch wenn ein Zugang später freigegeben wird. Sie gilt für die ganze Familie eines Chats:
Hauptchat und Teilaufgaben teilen Arbeitsbereich und Sandbox, und Ergebnisse von Teilaufgaben fließen in den Hauptchat.
Markiert wird deshalb immer auch der Hauptchat, und eine Teilaufgabe ist gesperrt, sobald ihr Hauptchat es ist.

Ist die Sperre eingeschaltet (Admin → Zugänge, Standard: an), nimmt ein markierter Chat kein externes Modell mehr an:
nicht von Hand, nicht als Notfall-Ausweichmodell, nicht bei geplanten Aufgaben – und als letzte Schranke baut der Lauf
keine Anfrage an ein externes Modell. Für ein externes Modell beginnt die Person einen neuen Chat. Abgeschaltet gilt
nur das Herausfiltern wie bisher.

Chats von vor dieser Version tragen keine Markierung; ``scan`` sucht in ihrem Verlauf nach denselben Spuren.
"""
from __future__ import annotations

from typing import Any, Iterable

from . import credentials as C

KEY = "internal_only"
KIND_CRED, KIND_RULE, KIND_SKILL, KIND_SUB = "cred", "rule", "skill", "sub"
KINDS = (KIND_CRED, KIND_RULE, KIND_SKILL, KIND_SUB)
MAX_REASONS = 20
# Werkzeuge, die den Inhalt eines eigenen Skills liefern
SKILL_TOOLS = {"skill_load", "skill_file"}
# Version der Prüfung alter Verläufe: steigt sie, werden Chats ohne Markierung noch einmal durchsucht
SCAN_VERSION = 1

_LABELS = {KIND_CRED: "Zugang", KIND_RULE: "Datenregel", KIND_SKILL: "Skill", KIND_SUB: "Teilaufgabe"}


def enabled(cfg: dict) -> bool:
    """Sperrt LLMitMir markierte Chats für externe Modelle? (Admin → Zugänge, Standard: ja)"""
    return (cfg.get("credentials_policy") or {}).get("lock_chats", True) is not False


def locked(chat: dict | None) -> bool:
    """Trägt dieser Chat (oder diese Zusammenfassung eines Chats) die Markierung?"""
    return bool(((chat or {}).get(KEY) or {}).get("since"))


def reasons(chat: dict | None) -> list[dict]:
    return list(((chat or {}).get(KEY) or {}).get("reasons") or [])


def mark(chat: dict, kind: str, name: str, ts: float) -> bool:
    """Markierung setzen oder um einen Grund ergänzen. True, wenn sich etwas geändert hat."""
    if kind not in KINDS:
        raise ValueError(f"unbekannte Art {kind!r}")
    name = " ".join(str(name or "").split())[:100]
    cur = chat.get(KEY) if isinstance(chat.get(KEY), dict) else {}
    rs = [r for r in cur.get("reasons") or [] if isinstance(r, dict)]
    added = False
    if not any(r.get("kind") == kind and r.get("name") == name for r in rs) and len(rs) < MAX_REASONS:
        rs.append({"kind": kind, "name": name, "ts": ts})
        added = True
    if cur.get("since") and not added:
        return False
    chat[KEY] = {"since": cur.get("since") or ts, "reasons": rs}
    return True


def merge(target: dict, source: dict | None, ts: float) -> bool:
    """Die Gründe eines Chats in einen anderen übernehmen (Teilaufgabe → Hauptchat). True bei einer Änderung."""
    changed = False
    for r in reasons(source):
        if r.get("kind") in KINDS:
            changed = mark(target, r["kind"], r.get("name") or "", ts) or changed
    if locked(source) and not locked(target):
        changed = mark(target, KIND_SUB, (source or {}).get("title") or "", ts) or changed
    return changed


def effective(chat: dict | None, root: dict | None) -> list[dict]:
    """Gründe, aus denen ein Chat gesperrt ist: eigene und die seines Hauptchats. Leer = nicht gesperrt."""
    out = reasons(chat) if locked(chat) else []
    if root is not None and root is not chat and locked(root):
        out += [r for r in reasons(root) if r not in out]
        if not out:
            out = [{"kind": KIND_SUB, "name": root.get("title") or ""}]
    return out


def describe(rs: Iterable[dict], limit: int = 3) -> str:
    """„Zugang „Nextcloud“, Skill „Personalakte““ – höchstens ``limit`` Gründe, der Rest als Anzahl."""
    rs = [r for r in rs if r.get("kind") != KIND_SUB] or list(rs)
    parts = [f"{_LABELS.get(r.get('kind'), 'Quelle')} „{r.get('name')}“" if r.get("name") else _LABELS.get(r.get("kind"), "Quelle")
             for r in rs[:limit]]
    if len(rs) > limit:
        parts.append(f"{len(rs) - limit} weitere")
    return ", ".join(parts)


def why(rs: list[dict]) -> str:
    """Satz für die Person, wenn ein externes Modell hier nicht geht."""
    src = describe(rs)
    return ("Dieser Chat enthält Daten, die nicht an externe Modelle dürfen"
            + (f" ({src})" if src else "") + ". Für ein externes Modell bitte einen neuen Chat beginnen.")


def creds_in_args(args: Any) -> set[str]:
    """Namen der Zugänge, die ein Aufruf benutzt hat (``zugang`` und Platzhalter ``{{cred:Name:feld}}``)."""
    if not isinstance(args, dict):
        return set()
    names = set()
    if isinstance(args.get("zugang"), str) and args["zugang"].strip():
        names.add(args["zugang"].strip())
    names |= set(C.placeholder_names(args))  # in den Texten selbst, wie beim Auflösen (nicht in der JSON-Form)
    return names


def _find(items: dict[str, dict], name_or_id: str) -> dict | None:
    if not name_or_id:
        return None
    if name_or_id in items:
        return items[name_or_id]
    low = str(name_or_id).strip().casefold()
    return next((x for x in items.values() if str(x.get("name") or "").casefold() == low), None)


def closed_creds(msg: dict, creds: dict[str, dict]) -> list[dict]:
    """Die für externe Modelle gesperrten Zugänge, die ein Werkzeug-Aufruf benutzt hat.

    Bevorzugt die beim Aufruf festgehaltenen IDs (``cred_ids``, übersteht Umbenennen); ältere Aufrufe über die Namen
    in den Argumenten. Ein gelöschter Zugang ist nicht mehr zu erkennen – er zählt nur über die IDs."""
    out: list[dict] = []
    ids = msg.get("cred_ids")
    found = [creds.get(i) or {"id": i, "name": i} for i in ids] if isinstance(ids, list) else [
        c for c in (_find(creds, n) for n in sorted(creds_in_args(msg.get("args")))) if c]
    for c in found:
        if not c.get("external") and c not in out:
            out.append(c)
    return out


def internal_skill(msg: dict, skills: dict[str, dict]) -> dict | None:
    """Der eigene Skill „nur für interne Modelle“, dessen Inhalt ein Aufruf geliefert hat (oder None)."""
    name = msg.get("name") or ""
    args = msg.get("args") if isinstance(msg.get("args"), dict) else {}
    if name in SKILL_TOOLS or (name == "llmitmir_info" and args.get("teil") == "skill"):
        s = _find(skills, str(args.get("name") or ""))
        if s and s.get("internal_only"):
            return s
    return None


def hits(msg: dict, creds: dict[str, dict], skills: dict[str, dict]) -> list[tuple[str, str]]:
    """Gründe (Art, Name), aus denen ein erfolgreicher Werkzeug-Aufruf einen Chat markiert."""
    if msg.get("role") != "tool" or msg.get("status") != "ok":
        return []
    out = [(KIND_CRED, str(c.get("name") or c.get("id") or "")) for c in closed_creds(msg, creds)]
    if msg.get("ext_block"):
        out.append((KIND_RULE, str(msg["ext_block"])))
    s = internal_skill(msg, skills)
    if s:
        out.append((KIND_SKILL, str(s.get("name") or "")))
    return out


def scan(chat: dict, creds: dict[str, dict], skills: dict[str, dict], ts: float) -> bool:
    """Einen alten Verlauf (ohne Markierung) nach internen Daten durchsuchen und den Chat markieren.

    Läuft je Chat einmal (``SCAN_VERSION``). True, wenn sich am Chat etwas geändert hat."""
    if locked(chat) or (chat.get(KEY) or {}).get("scanned", 0) >= SCAN_VERSION:
        return False
    changed = False
    for m in chat.get("messages") or []:
        for kind, name in hits(m, creds, skills):
            changed = mark(chat, kind, name, ts) or changed
    if not changed:
        chat[KEY] = fresh()
    return True


def fresh() -> dict:
    """Markierung eines neuen Chats: frei, und kein alter Verlauf zu durchsuchen."""
    return {"scanned": SCAN_VERSION}


def summary(chat: dict) -> dict | None:
    """Was die Seitenleiste und das Modellmenü brauchen (in ``chat_summary``)."""
    return {"since": chat[KEY]["since"], "reasons": reasons(chat)} if locked(chat) else None
