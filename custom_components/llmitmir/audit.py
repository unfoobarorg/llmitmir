"""Agenten-Identitäten und Zugriffsprotokoll – nur Metadaten, nie Inhalte.

Jeder Lauf gehört zu einem **Agenten** mit stabiler ID: ein Chat, ein Cowork, ein Sprachgespräch oder eine Teilaufgabe
ist ``agt-<Chat-ID>``, eine geplante Aufgabe oder Kachel ``agt-<Aufgaben-ID>`` (alle ihre Läufe gehören zu ihr).
Teilaufgaben nennen ihren Eltern-Agenten. Das Protokoll hält fest, *welcher Agent mit welchem Zugang worauf*
zugegriffen hat – Werkzeug, Zugang, Server, Pfad, Entität, Modellklasse, Ergebnis und wer freigegeben hat. Inhalte
(Texte, Suchbegriffe, Abfrageparameter, Dateiinhalte, Empfänger, Chat-Titel) kommen nie hinein: Ziele werden aus einer
festen Liste von Argumenten gebildet, Adressen ohne Abfrage, Fragment und Anmeldedaten.

Ablage: ``.storage/llmitmir_audit/<JJJJ-MM-TT>.jsonl`` (eine Zeile je Ereignis) und ``agents.json`` (Verzeichnis der
Agenten). Sichtbar nur für Admins (Admin → Monitoring); die Aufbewahrungsfrist stellt der Admin ein.

Dieses Modul ist frei von Home Assistant; ``AuditService`` bekommt ``hass`` nur für Executor und Zeitgeber.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.parse
from datetime import date, datetime, timedelta
from typing import Any, Callable, Iterable

from . import credentials as C

_LOGGER = logging.getLogger(__name__)

AUDIT_DIR = "llmitmir_audit"
AGENTS_FILE = "agents.json"
RETENTION_DEFAULT = 180
RETENTION_MIN, RETENTION_MAX = 7, 3650
QUERY_MAX = 1000          # höchstens so viele Ereignisse je Abfrage
QUERY_DAYS_MAX = 400      # so weit zurück liest eine Abfrage höchstens
FLUSH_DELAY = 3.0         # Sekunden, nach denen gepufferte Ereignisse geschrieben werden
BUFFER_MAX = 500          # spätestens bei so vielen Ereignissen sofort schreiben

# Agenten-Arten
KIND_CHAT, KIND_COWORK, KIND_VOICE, KIND_SUB, KIND_TASK, KIND_TILE = "chat", "cowork", "voice", "sub", "task", "tile"
AGENT_KINDS = (KIND_CHAT, KIND_COWORK, KIND_VOICE, KIND_SUB, KIND_TASK, KIND_TILE)

# Ereignisse
EV_RUN = "run"                  # ein Lauf beginnt (Modell, Modellklasse)
EV_TOOL = "tool"                # ein Werkzeugaufruf mit Ziel und Ergebnis
EV_HOST = "host_approval"       # Zugang an einen nicht erlaubten Server: Entscheidung
EVENT_KINDS = (EV_RUN, EV_TOOL, EV_HOST)

# Modellklassen
MC_MAIN, MC_EXTERNAL, MC_BILLED = "main", "external", "billed"
MODEL_CLASSES = (MC_MAIN, MC_EXTERNAL, MC_BILLED)

# Ergebnis eines Aufrufs
OUTCOMES = ("ok", "error", "denied")

# Wer hat entschieden: automatisch (nichts zu fragen), dauerhafte Freigabe (Chat, Projekt, Aufgabe),
# die Person (einmal / immer), oder abgelehnt (Person, Regel)
DECISIONS = ("auto", "standing", "once", "always", "denied", "skipped", "rule")

# Werkzeuggruppen ohne Zugriff auf andere Systeme: nicht protokolliert
SKIP_GROUPS = {"progress", "files", "teilergebnis", "unterchat", "skills"}
# Ausnahme: diese Werkzeuge der übersprungenen Gruppen zählen doch (sie zeigen Zugänge)
KEEP_TOOLS = {"credentials_list"}

# Argumente, die ein Ziel beschreiben (alles andere – Inhalte, Suchbegriffe, Empfänger – bleibt draußen)
_PATH_KEYS = ("pfad",)
_CONTAINER_KEYS = ("kalender", "ordner")
_OBJECT_TOOLS_KEYS = ("name",)       # Skills, Aufgaben, Zugänge, Dashboards, Kacheln: Name des Objekts
_TEXT_MAX = 200
_ENTITY_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


def clip(value: Any, limit: int = _TEXT_MAX) -> str:
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value or "")).strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def agent_id(chat: dict | None, task: dict | None = None) -> str:
    """Stabile ID des Agenten: eine Aufgabe (oder Kachel) über alle Läufe, sonst der Chat."""
    if task and task.get("id"):
        return f"agt-{task['id']}"
    return f"agt-{(chat or {}).get('id') or 'unbekannt'}"


def agent_kind(chat: dict | None, task: dict | None = None) -> str:
    chat = chat or {}
    if task is not None:
        return KIND_TILE if task.get("origin") == "dashboard" else KIND_TASK
    if chat.get("parent_id"):
        return KIND_SUB
    if chat.get("kind") == "cowork":
        return KIND_COWORK
    if chat.get("voice"):
        return KIND_VOICE
    return KIND_CHAT


def agent_info(user_id: str, chat: dict | None, task: dict | None = None, project: dict | None = None) -> dict:
    """Was den Agenten ausmacht – ohne Chat-Titel (der stammt aus der ersten Nachricht, also aus Inhalten).

    Projekt- und Aufgabenname sind Einstellungen der Person, keine Inhalte, und helfen dem Admin bei der Zuordnung."""
    chat = chat or {}
    info = {"id": agent_id(chat, task), "kind": agent_kind(chat, task), "owner": user_id,
            "project_id": (project or {}).get("id") or chat.get("project_id") or None,
            "project": clip((project or {}).get("name"), 80) or None}
    if task is not None:
        info["task_id"] = task.get("id")
        info["task"] = clip(task.get("name"), 80) or None
    if chat.get("parent_id"):
        info["parent"] = f"agt-{chat['parent_id']}"
    return {k: v for k, v in info.items() if v is not None}


def url_target(url: Any) -> dict:
    """Server und Pfad einer Adresse – ohne Abfrage, Fragment, Anmeldedaten und Port."""
    raw = str(url or "").strip()
    if not raw:
        return {}
    if "://" not in raw:
        raw = "//" + raw
    try:
        u = urllib.parse.urlsplit(raw)
        host = (u.hostname or "").lower().rstrip(".")
    except ValueError:
        return {}
    out = {}
    if host:
        out["host"] = host
    if u.path and u.path != "/":
        out["path"] = clip(u.path)
    return out


def creds_in_args(args: dict) -> list[str]:
    """Namen der Zugänge eines Aufrufs (``zugang`` und Platzhalter ``{{cred:Name:feld}}``), in Reihenfolge."""
    names: list[str] = []
    z = args.get("zugang")
    if isinstance(z, str) and z.strip():
        names.append(z.strip())
    try:
        dumped = json.dumps(args, ensure_ascii=False)
    except (TypeError, ValueError):
        dumped = ""
    names += [m.group(1).strip() for m in C.PLACEHOLDER.finditer(dumped)]
    return list(dict.fromkeys(names))


def _entities(value: Any) -> list[str]:
    """Entitäts-IDs aus ``ziel``/``entity_id`` (Text, Liste oder Objekt mit entity_id)."""
    if isinstance(value, dict):
        value = value.get("entity_id")
    items = value if isinstance(value, list) else re.split(r"[\s,]+", str(value or ""))
    return [x for x in (str(i).strip().lower() for i in items) if _ENTITY_RE.match(x)][:20]


def describe_call(name: str, group: str, args: dict, find_cred: Callable[[str], dict | None]) -> dict:
    """Zugänge und Ziel eines Werkzeugaufrufs aus einer festen Liste von Argumenten.

    ``find_cred(name)`` liefert den Zugang zu einem Namen (oder None). Rückgabe: ``{"creds": [...], "target": {...}}``."""
    args = args if isinstance(args, dict) else {}
    creds = []
    for n in creds_in_args(args):
        c = find_cred(n)
        if c:
            creds.append({"id": c.get("id"), "name": clip(c.get("name"), 80), "type": c.get("type") or ""})
        else:
            creds.append({"id": None, "name": clip(n, 80), "type": ""})
    target: dict[str, Any] = {}
    if args.get("url"):
        target.update(url_target(args["url"]))
    elif creds and creds[0].get("id"):
        hosts = C.auto_hosts(find_cred(creds[0]["name"]) or {})
        if hosts:
            target["host"] = hosts[0]
    for k in _PATH_KEYS:
        if isinstance(args.get(k), str) and args[k].strip():
            target["path"] = clip(args[k])
    for k in _CONTAINER_KEYS:
        if isinstance(args.get(k), str) and args[k].strip():
            target["container"] = clip(args[k], 120)
    if args.get("methode"):
        target["method"] = clip(args["methode"], 10).upper()
    if group == "ha":
        if args.get("domain") or args.get("service"):
            target["service"] = clip(f"{args.get('domain') or ''}.{args.get('service') or ''}".strip("."), 80)
        ents = _entities(args.get("ziel")) + _entities(args.get("entity_id"))
        if ents:
            target["entities"] = list(dict.fromkeys(ents))
        if name == "ha_ws" and args.get("typ"):
            target["service"] = clip(args["typ"], 80)
    if group == "llmitmir" or name in ("skill_save", "skill_delete"):
        for k in _OBJECT_TOOLS_KEYS:
            if isinstance(args.get(k), str) and args[k].strip():
                target["object"] = clip(args[k], 120)
    if name == "mail_send":
        to = args.get("an")
        n = len(to) if isinstance(to, list) else len([x for x in re.split(r"[,;]", str(to or "")) if x.strip()])
        target["recipients"] = n  # nur die Anzahl, keine Adressen
    if name == "mail_change" and args.get("aktion"):
        target["action"] = clip(args["aktion"], 30)
    if name in ("caldav_entry", "ews_save") and args.get("aktion"):
        target["action"] = clip(args["aktion"], 30)
    return {"creds": creds, "target": target}


def should_log(name: str, group: str) -> bool:
    return name in KEEP_TOOLS or group not in SKIP_GROUPS


def make_event(kind: str, agent: dict, run_id: str, **fields: Any) -> dict:
    """Ein Ereignis; nur bekannte, einfache Felder (keine Argumente, keine Ergebnisse)."""
    ev = {"ts": round(fields.pop("ts", None) or time.time(), 3), "kind": kind, "agent": agent.get("id"),
          "agent_kind": agent.get("kind"), "user": agent.get("owner"), "run": run_id}
    if agent.get("parent"):
        ev["parent"] = agent["parent"]
    if agent.get("project_id"):
        ev["project_id"] = agent["project_id"]
    allowed = {"tool": str, "group": str, "write": bool, "creds": list, "target": dict, "model": str, "model_class": str,
               "outcome": str, "decision": str, "ms": int, "host": str}
    for k, v in fields.items():
        typ = allowed.get(k)
        if typ is None or v is None or v == "" or v == [] or v == {}:
            continue
        if typ is int:
            try:
                v = int(v)
            except (TypeError, ValueError):
                continue
        elif typ is str:
            v = clip(v, 120)
        elif not isinstance(v, typ):
            continue
        ev[k] = v
    return ev


# ----------------------------------------------------------------- Abfrage (rein)

def matches(ev: dict, f: dict) -> bool:
    if f.get("since") and ev.get("ts", 0) < f["since"]:
        return False
    if f.get("until") and ev.get("ts", 0) > f["until"]:
        return False
    for key in ("user", "agent", "kind", "outcome", "model_class", "group", "agent_kind"):
        if f.get(key) and ev.get(key) != f[key]:
            return False
    if f.get("agent_tree") and f["agent_tree"] not in (ev.get("agent"), ev.get("parent")):
        return False
    if f.get("cred") and not any(c.get("id") == f["cred"] or c.get("name") == f["cred"] for c in ev.get("creds") or []):
        return False
    if f.get("only_creds") and not ev.get("creds"):
        return False
    if f.get("write") and not ev.get("write"):
        return False
    if f.get("host"):
        h = (ev.get("target") or {}).get("host") or ev.get("host") or ""
        if f["host"].lower() not in h:
            return False
    return True


def clean_filters(raw: dict | None) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {}
    for k in ("since", "until"):
        try:
            if raw.get(k):
                out[k] = float(raw[k])
        except (TypeError, ValueError):
            pass
    for k in ("user", "agent", "agent_tree", "kind", "outcome", "model_class", "group", "agent_kind", "cred", "host"):
        if isinstance(raw.get(k), str) and raw[k].strip():
            out[k] = raw[k].strip()[:120]
    for k in ("only_creds", "write"):
        if raw.get(k):
            out[k] = True
    return out


def day_of(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def days_between(since: float | None, until: float | None, today: date | None = None) -> list[str]:
    """Tage (neueste zuerst), die eine Abfrage lesen muss – höchstens QUERY_DAYS_MAX."""
    today = today or date.today()
    end = datetime.fromtimestamp(until).date() if until else today
    start = datetime.fromtimestamp(since).date() if since else end - timedelta(days=30)
    start = max(start, end - timedelta(days=QUERY_DAYS_MAX))
    out, d = [], end
    while d >= start:
        out.append(d.isoformat())
        d -= timedelta(days=1)
    return out


def summarize(events: Iterable[dict]) -> dict:
    """Zahlen für die Übersicht: Aufrufe, Ablehnungen, Fehler, externe Nutzung, Zugänge, Agenten, Personen."""
    s = {"events": 0, "tool_calls": 0, "denied": 0, "errors": 0, "external": 0, "with_creds": 0, "writes": 0,
         "agents": set(), "users": set(), "creds": {}}
    for ev in events:
        s["events"] += 1
        s["agents"].add(ev.get("agent"))
        s["users"].add(ev.get("user"))
        if ev.get("kind") == EV_TOOL:
            s["tool_calls"] += 1
        if ev.get("outcome") == "denied" or ev.get("decision") in ("denied", "skipped", "rule"):
            s["denied"] += 1
        if ev.get("outcome") == "error":
            s["errors"] += 1
        if ev.get("model_class") in (MC_EXTERNAL, MC_BILLED):
            s["external"] += 1
        if ev.get("write"):
            s["writes"] += 1
        if ev.get("creds"):
            s["with_creds"] += 1
            for c in ev["creds"]:
                key = c.get("id") or c.get("name")
                s["creds"][key] = s["creds"].get(key, {"name": c.get("name"), "calls": 0})
                s["creds"][key]["calls"] += 1
    s["agents"] = len(s["agents"] - {None})
    s["users"] = len(s["users"] - {None})
    return s


def clean_retention(value: Any) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValueError("Die Aufbewahrungsfrist ist eine ganze Zahl von Tagen.") from None
    if not RETENTION_MIN <= n <= RETENTION_MAX:
        raise ValueError(f"Die Aufbewahrungsfrist liegt zwischen {RETENTION_MIN} und {RETENTION_MAX} Tagen.")
    return n


def update_agent(index: dict, agent: dict, ev: dict) -> None:
    """Verzeichnis der Agenten fortschreiben: erste/letzte Aktivität, Zahl der Aufrufe, benutzte Zugänge."""
    a = index.get(agent["id"])
    if a is None:
        a = index[agent["id"]] = {"id": agent["id"], "first_seen": ev["ts"], "calls": 0, "runs": 0, "creds": {}}
    for k in ("kind", "owner", "project_id", "project", "task_id", "task", "parent"):
        if agent.get(k) is not None:
            a[k] = agent[k]
    a["last_seen"] = ev["ts"]
    if ev.get("kind") == EV_RUN:
        a["runs"] += 1
        if ev.get("model"):
            a["model"] = ev["model"]
            a["model_class"] = ev.get("model_class")
    elif ev.get("kind") == EV_TOOL:
        a["calls"] += 1
    for c in ev.get("creds") or []:
        key = c.get("id") or f"name:{c.get('name')}"
        a["creds"][key] = c.get("name")


def prune_agents(index: dict, keep_days: int, now_ts: float | None = None) -> int:
    cutoff = (now_ts or time.time()) - keep_days * 86400
    old = [k for k, a in index.items() if (a.get("last_seen") or 0) < cutoff]
    for k in old:
        del index[k]
    return len(old)


# ----------------------------------------------------------------- Ablage (Dateien, ohne Home Assistant)

class AuditFiles:
    """Lesen und Schreiben der Protokolldateien. Alle Methoden blockieren – im Executor aufrufen."""

    def __init__(self, base: str) -> None:
        self.base = base

    def _day_path(self, day: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", day):
            raise ValueError("ungültiger Tag")
        return os.path.join(self.base, f"{day}.jsonl")

    def append(self, events: list[dict]) -> None:
        if not events:
            return
        os.makedirs(self.base, mode=0o700, exist_ok=True)
        by_day: dict[str, list[str]] = {}
        for ev in events:
            by_day.setdefault(day_of(ev["ts"]), []).append(json.dumps(ev, ensure_ascii=False, separators=(",", ":")))
        for day, lines in by_day.items():
            with open(self._day_path(day), "a", encoding="utf-8") as fh:
                fh.write("\n".join(lines) + "\n")

    def read_day(self, day: str) -> list[dict]:
        path = self._day_path(day)
        if not os.path.exists(path):
            return []
        out = []
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except ValueError:
                    continue  # eine halb geschriebene Zeile (Absturz) überspringen
        return out

    def query(self, f: dict, limit: int = QUERY_MAX, today: date | None = None) -> tuple[list[dict], dict, bool]:
        """Neueste zuerst; dazu die Übersicht über *alle* Treffer und ob mehr als ``limit`` da waren."""
        hits: list[dict] = []
        for day in days_between(f.get("since"), f.get("until"), today):
            hits += [ev for ev in reversed(self.read_day(day)) if matches(ev, f)]
        hits.sort(key=lambda e: e.get("ts", 0), reverse=True)
        return hits[:limit], summarize(hits), len(hits) > limit

    def purge(self, keep_days: int, today: date | None = None) -> int:
        if not os.path.isdir(self.base):
            return 0
        cutoff = ((today or date.today()) - timedelta(days=keep_days)).isoformat()
        n = 0
        for name in os.listdir(self.base):
            m = re.match(r"^(\d{4}-\d{2}-\d{2})\.jsonl$", name)
            if m and m.group(1) < cutoff:
                os.remove(os.path.join(self.base, name))
                n += 1
        return n

    def load_agents(self) -> dict:
        path = os.path.join(self.base, AGENTS_FILE)
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def save_agents(self, index: dict) -> None:
        os.makedirs(self.base, mode=0o700, exist_ok=True)
        path = os.path.join(self.base, AGENTS_FILE)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)


class AuditService:
    """Puffert Ereignisse und schreibt sie gesammelt. ``record`` blockiert nie und wirft nie."""

    def __init__(self, hass: Any, base: str, retention: Callable[[], int]) -> None:
        self.hass = hass
        self.files = AuditFiles(base)
        self.retention = retention
        self.agents: dict = {}
        self._buffer: list[dict] = []
        self._agents_dirty = False
        self._timer = None
        self._loaded = False

    async def async_load(self) -> None:
        self.agents = await self.hass.async_add_executor_job(self.files.load_agents)
        self._loaded = True

    def record(self, kind: str, agent: dict | None, run_id: str, **fields: Any) -> None:
        if not agent:
            return
        try:
            ev = make_event(kind, agent, run_id, **fields)
            self._buffer.append(ev)
            update_agent(self.agents, agent, ev)
            self._agents_dirty = True
        except Exception:  # noqa: BLE001 - das Protokoll darf keinen Lauf aufhalten
            _LOGGER.exception("Ereignis für das Zugriffsprotokoll nicht erfasst")
            return
        if len(self._buffer) >= BUFFER_MAX:
            self.hass.async_create_background_task(self.async_flush(), "llmitmir audit flush")
        elif self._timer is None:
            self._timer = self.hass.loop.call_later(
                FLUSH_DELAY, lambda: self.hass.async_create_background_task(self.async_flush(), "llmitmir audit flush"))

    async def async_flush(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None
        events, self._buffer = self._buffer, []
        agents = json.loads(json.dumps(self.agents)) if self._agents_dirty and self._loaded else None
        self._agents_dirty = False
        try:
            if events:
                await self.hass.async_add_executor_job(self.files.append, events)
            if agents is not None:
                await self.hass.async_add_executor_job(self.files.save_agents, agents)
        except OSError:
            _LOGGER.exception("Zugriffsprotokoll konnte nicht geschrieben werden")
            self._buffer = events + self._buffer  # beim nächsten Mal erneut versuchen

    async def async_query(self, raw_filters: dict | None, limit: int = QUERY_MAX) -> dict:
        await self.async_flush()
        f = clean_filters(raw_filters)
        limit = max(1, min(QUERY_MAX, int(limit or QUERY_MAX)))
        events, summary, more = await self.hass.async_add_executor_job(self.files.query, f, limit)
        return {"events": events, "summary": summary, "more": more}

    async def async_purge(self) -> int:
        keep = self.retention()
        n = await self.hass.async_add_executor_job(self.files.purge, keep)
        if prune_agents(self.agents, keep):
            self._agents_dirty = True
            await self.async_flush()
        return n
