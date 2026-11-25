"""Zentrale Prüfungen für Zugänge: Freigabe je Agent und Einstufung (HA-frei, testbar).

**Freigabe je Agent.** Ein Zugang ist in einem Chat oder Cowork erst nutzbar, wenn die Person ihn freigibt:
*einmal* (nur dieser Aufruf), *für diesen Chat/dieses Cowork* (``chat["cred_ok"]``) oder *nicht* (der Lauf macht ohne
ihn weiter). Vorab erlaubt sind die Zugänge, die einem Projekt zugeordnet sind (``project["credentials"]``) – für alle
Chats und Coworks darin. Teilaufgaben nutzen die Freigaben ihres Hauptchats. Unbeaufsichtigte Läufe (geplante
Aufgaben, Kacheln) fragen nie: Erlaubt ist nur, was die Aufgabe (``task["cred_allow"]``) oder ihr Projekt vorab erlaubt.

**Einstufung.** Jeder Zugang hat eine Art (``cred["scope"]``): ein eigener LLMitMir-Zugang im Nutzerkontext des
Zielsystems (empfohlen), die persönlichen Zugangsdaten der Person (abgeraten) oder ein zentraler Systemzugang (nur,
wenn der Admin es erlaubt). Ohne Erlaubnis sind zentrale Zugänge gesperrt – kein Modell sieht oder nutzt sie.
"""
from __future__ import annotations

from typing import Any

# Einstufung eines Zugangs
SCOPE_DEDICATED, SCOPE_PERSONAL, SCOPE_CENTRAL = "dedicated", "personal", "central"
SCOPES = (SCOPE_DEDICATED, SCOPE_PERSONAL, SCOPE_CENTRAL)
SCOPE_LABELS = {
    SCOPE_DEDICATED: "Eigener LLMitMir-Zugang in meinem Nutzerkontext",
    SCOPE_PERSONAL: "Meine persönlichen Zugangsdaten",
    SCOPE_CENTRAL: "Zentraler Systemzugang",
}
# Argument „art“ des Werkzeugs credential_save
SCOPE_WORDS = {"eigener": SCOPE_DEDICATED, "persoenlich": SCOPE_PERSONAL, "persönlich": SCOPE_PERSONAL,
               "zentral": SCOPE_CENTRAL, **{s: s for s in SCOPES}}

# Ergebnis der Prüfung
ALLOW, DENY, ASK = "allow", "deny", "ask"

# Tipps je Zugangstyp: wie man einen eigenen Zugang im Nutzerkontext anlegt
TYPE_TIPS = {
    "webdav": "Nextcloud: unter Einstellungen → Sicherheit ein eigenes App-Passwort „LLMitMir“ erzeugen – nicht das "
              "Login-Passwort. Es lässt sich jederzeit einzeln widerrufen.",
    "basic": "Ein eigenes Konto oder ein eigenes App-Passwort für LLMitMir anlegen, mit nur den nötigen Rechten.",
    "bearer": "Einen eigenen Token für LLMitMir erzeugen (z. B. GitLab: Personal oder Project Access Token) – mit "
              "minimalen Rechten und Ablaufdatum.",
    "header": "Einen eigenen API-Schlüssel nur für LLMitMir erzeugen, mit minimalen Rechten.",
    "telegram": "Einen eigenen Bot über @BotFather anlegen, der nur für LLMitMir da ist.",
    "imap": "Wenn möglich ein App-Passwort für LLMitMir statt des Postfach-Passworts verwenden.",
    "ews": "Wenn der Server es erlaubt, ein eigenes Konto oder App-Passwort für LLMitMir verwenden.",
    "gwdg": "Die GWDG kennt keine App-Passwörter für Exchange – hier geht es nur mit den persönlichen Zugangsdaten. "
            "Dann bitte „Meine persönlichen Zugangsdaten“ wählen.",
    "other": "Einen eigenen Zugang nur für LLMitMir anlegen, im Nutzerkontext und mit minimalen Rechten.",
}

GENERAL_HINT = ("Für LLMitMir bitte einen **eigenen Zugang** verwenden, der im Zielsystem in deinem Nutzerkontext läuft "
                "(z. B. ein App-Passwort oder ein eigener Token mit minimalen Rechten). Nicht deine persönlichen "
                "Anmeldedaten und keine zentralen Systemzugänge – die nur im Notfall und nur, wenn der Admin es erlaubt.")


def clean_scope(value: Any, allow_central: bool, old: str | None = None, required: bool = True) -> str | None:
    """Einstufung prüfen. Ohne Angabe bleibt die alte (oder keine, wenn nicht verlangt)."""
    if value in (None, ""):
        if old:
            return old
        if required:
            raise ValueError("Wähl die Art des Zugangs: eigener LLMitMir-Zugang (empfohlen), persönliche Zugangsdaten "
                             "oder zentraler Systemzugang.")
        return None
    scope = SCOPE_WORDS.get(str(value).strip().casefold())
    if scope is None:
        raise ValueError(f"Unbekannte Art „{value}“ (möglich: eigener, persoenlich, zentral).")
    if scope == SCOPE_CENTRAL and not allow_central and old != SCOPE_CENTRAL:
        raise ValueError("Zentrale Systemzugänge hat der Admin nicht erlaubt. Bitte einen eigenen Zugang im Nutzerkontext "
                         "anlegen.")
    return scope


def locked(cred: dict, allow_central: bool) -> bool:
    """Gesperrt, weil zentral und vom Admin nicht erlaubt."""
    return cred.get("scope") == SCOPE_CENTRAL and not allow_central


def scope_hint(cred_type: str, scope: str | None) -> str:
    """Hinweis für Formular und Änderungskarte."""
    parts = [TYPE_TIPS.get(cred_type or "", TYPE_TIPS["other"])]
    if scope == SCOPE_PERSONAL:
        parts.append("Persönliche Zugangsdaten geben dem Modell alle deine Rechte – nur nutzen, wenn es keinen eigenen "
                     "Zugang gibt.")
    elif scope == SCOPE_CENTRAL:
        parts.append("Ein zentraler Systemzugang ist nicht an dich gebunden und hat oft weitreichende Rechte – nur im "
                     "Notfall.")
    return " ".join(parts)


def _ids(value: Any) -> set[str]:
    return {str(x) for x in value} if isinstance(value, (list, tuple, set)) else set()


def cred_verdict(cred_id: str, *, chat: dict | None = None, root: dict | None = None, project: dict | None = None,
                 task: dict | None = None, run_ok: set | None = None, run_no: set | None = None) -> tuple[str, str]:
    """Darf dieser Agent den Zugang nutzen? → (ALLOW | DENY | ASK, Quelle).

    ``root`` ist der Hauptchat einer Teilaufgabe, ``run_ok``/``run_no`` sind Antworten aus dem laufenden Lauf."""
    if run_no and cred_id in run_no:
        return DENY, "run"
    if run_ok and cred_id in run_ok:
        return ALLOW, "run"
    if project and cred_id in _ids(project.get("credentials")):
        return ALLOW, "project"
    if task is not None:
        if cred_id in _ids(task.get("cred_allow")):
            return ALLOW, "task"
        return DENY, "task"
    for c in (chat, root):
        if c and cred_id in _ids(c.get("cred_ok")):
            return ALLOW, "chat"
    return ASK, ""


def grant(chat: dict, cred_id: str) -> bool:
    """„Für diesen Chat erlauben“ merken. True, wenn sich etwas geändert hat."""
    ok = list(chat.get("cred_ok") or [])
    if cred_id in ok:
        return False
    chat["cred_ok"] = ok + [cred_id]
    return True


def revoke(chat: dict, cred_id: str) -> bool:
    ok = list(chat.get("cred_ok") or [])
    if cred_id not in ok:
        return False
    chat["cred_ok"] = [x for x in ok if x != cred_id]
    return True


def migrate_tasks(meta: dict) -> int:
    """Einmalig beim Update auf 1.3.0: Aufgaben ohne eigene Zugangsliste bekommen alle Zugänge, die es gerade gibt –
    sonst stünden sie nach dem Update ohne ihre Zugänge da. ``cred_allow_migrated`` markiert sie zur Durchsicht."""
    all_ids = sorted((meta.get("credentials") or {}).keys())
    n = 0
    for task in (meta.get("tasks") or {}).values():
        if isinstance(task, dict) and "cred_allow" not in task:
            task["cred_allow"] = list(all_ids)
            if all_ids:
                task["cred_allow_migrated"] = True
            n += 1
    return n


def clean_cred_allow(value: Any, creds: dict) -> list[str]:
    """Zugangsliste einer Aufgabe: nur vorhandene Zugänge, Namen oder IDs."""
    out: list[str] = []
    for v in value if isinstance(value, (list, tuple)) else []:
        v = str(v or "").strip()
        hit = creds.get(v) or next((c for c in creds.values() if str(c.get("name", "")).casefold() == v.casefold()), None)
        if hit is None:
            raise ValueError(f"Zugang „{v}“ gibt es nicht.")
        if hit["id"] not in out:
            out.append(hit["id"])
    return out
