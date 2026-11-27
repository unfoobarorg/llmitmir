"""Saving and deleting skills, credentials and scheduled tasks – shared by the panel (ws.py) and the model's tools."""
from __future__ import annotations

from . import credentials as C
from . import sharing as SH
from . import policy as P
from . import skillcheck as SK
from . import connectors as CN
from .const import ORIGIN_DASHBOARD
from .cron import schedule_to_cron
from .storage import new_id, now

MASK = "•••"


async def save_skill(m, user_id: str, st, s: dict, connection: dict | None = None) -> dict:
    """Skill speichern. Mit ``connection`` (Zugang einer Konnektor-Verbindung) gehört der Skill fest zu ihr: Er nutzt
    genau diesen Zugang und lässt sich nur über die Seite „Plugins → Konnektoren“ ändern."""
    sid = s.get("id") or new_id("s")
    old = st.meta["skills"].get(sid, {"created": now()})
    name = str(s.get("name") or old.get("name") or "").strip()
    if not name:
        raise ValueError("Name fehlt")
    if SK.name_conflict(name, m.config.data):
        raise ValueError(f"„{name}“ ist der Name einer zentralen Vorgabe dieser Installation – bitte einen anderen Namen wählen.")
    skill = dict(old, id=sid, name=name[:80], description=str(s.get("description") or "")[:1024],
                 body=str(s.get("body") or ""), credentials=list(s.get("credentials") or []),
                 enabled=bool(s.get("enabled", True)),
                 # „Nur für interne Modelle“ (datalock.py); fehlt das Feld (Änderung im Chat), bleibt es, wie es war
                 internal_only=bool(s.get("internal_only", old.get("internal_only", False))), updated=now())
    if connection is not None:
        skill.update(connection_id=connection["id"], connector_id=connection.get("connector_id"),
                     credentials=[connection["id"]])
    elif old.get("connection_id"):
        skill["credentials"] = [old["connection_id"]]  # bleibt an der Verbindung, egal was das Formular schickt
    if SK.policies(m.config.data):
        # bis die Prüfung durch ist, sieht kein Modell den Skill (skillcheck.py); alte Befunde bleiben zum Vergleich
        skill["check"] = dict(old.get("check") or {}, pending=True, state="pending", hash="")
    st.meta["skills"][sid] = skill
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "skills"})
    SK.schedule(m, user_id, st, sid)
    return skill


async def delete_skill(m, user_id: str, st, sid: str) -> None:
    st.meta["skills"].pop(sid, None)
    await st.async_delete_scope("skill", sid)
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "skills"})


def allow_central(m) -> bool:
    """Hat der Admin zentrale Systemzugänge erlaubt?"""
    return bool((m.config.data.get("credentials_policy") or {}).get("allow_central"))


def build_credential(st, c: dict, allow_central: bool = False, require_scope: bool = False) -> dict:
    """Validated credential record from panel/tool input (secrets equal to MASK stay unchanged).

    Einstufung (policy.py): Pflicht für neue Zugänge aus dem Chat (``require_scope``), im Panel verlangt sie das
    Formular; zentrale Systemzugänge nur, wenn der Admin sie erlaubt."""
    cid = c.get("id") or new_id("k")
    old = st.meta["credentials"].get(cid, {"created": now(), "fields": {}})
    scope = P.clean_scope(c.get("scope"), allow_central, old.get("scope"), required=require_scope and not old.get("id"))
    typ = c.get("type") or old.get("type") or "other"
    if typ not in C.TYPES:
        raise ValueError(f"Unbekannter Typ „{typ}“ (möglich: {', '.join(C.TYPES)})")
    fields = dict(old.get("fields") or {})
    for k, v in (c.get("fields") or {}).items():
        if v == MASK:
            continue  # unchanged secret
        fields[str(k)[:60]] = str(v)
    for k in c.get("remove_fields") or []:
        fields.pop(k, None)
    svc = None
    if typ in ("gwdg", "ews"):
        known = C.TYPES[typ]["services"]
        raw = c["services"] if c.get("services") is not None else old.get("services")
        svc = [k for k in known if k in (raw if raw is not None else C.TYPES[typ]["default_services"])]
        if not svc:
            raise ValueError("Wähl aus, wofür der Zugang gilt: E-Mail-Postfach, Kalender und/oder Kontakte.")
    fields = C.normalize_fields(typ, fields, svc)
    if typ == "gwdg":
        if not fields.get("username"):
            raise ValueError("Für den GWDG-Zugang brauchen wir die GWDG-E-Mail-Adresse.")
        if not fields.get("password"):
            raise ValueError("Für den GWDG-Zugang brauchen wir dein GWDG-Passwort.")
    if typ == "ews":
        if not str(fields.get("url") or "").strip():
            raise ValueError("Für einen Exchange-Zugang brauchen wir die EWS-Adresse (…/EWS/Exchange.asmx).")
        if not str(fields.get("username") or "").strip():
            raise ValueError("Für einen Exchange-Zugang brauchen wir den Benutzernamen.")
        if not str(fields.get("password") or "").strip():
            raise ValueError("Für einen Exchange-Zugang brauchen wir das Passwort.")
    name = str(c.get("name") or old.get("name") or "").strip() or {"gwdg": "GWDG-Exchange", "ews": "Exchange"}.get(typ, "")
    if not name:
        raise ValueError("Name fehlt")
    for other in st.meta["credentials"].values():
        if other["id"] != cid and other.get("name", "").casefold() == name.casefold():
            raise ValueError("Es gibt schon einen Zugang mit diesem Namen")
    rotated = {}
    if old.get("id") and C.secret_changes(old, {"type": typ, "fields": fields,
                                               "secret_fields": c.get("secret_fields") or old.get("secret_fields")}):
        # new password/token: external use counts again from zero, so the person sees whether the new one was used
        rotated = {"secret_changed": now(), "ext_uses_since": 0,
                   "ext_uses_before": int(old.get("ext_uses") or 0)}
    cred = dict(old, **rotated, id=cid, name=name[:80], type=typ, fields=fields, notes=str(c.get("notes") or "")[:2000],
                # Ablaufdatum (optional, JJJJ-MM-TT): die Oberfläche warnt vorher, statt dass ein Lauf nachts scheitert
                valid_until=str(c.get("valid_until") or old.get("valid_until") or "")[:10],
                secret_fields=list(c.get("secret_fields") or old.get("secret_fields") or []),
                project_ids=list(c["project_ids"] or []) if "project_ids" in c else list(old.get("project_ids") or []),
                # released for external models (Claude, or models the main provider marks external)? Closed unless the person opens it explicitly.
                external=bool(c["external"]) if "external" in c else bool(old.get("external")),
                # weitere Server, an die der Zugang ohne Rückfrage gehen darf (die aus den Adressfeldern gelten immer)
                hosts=C.clean_hosts(c["hosts"]) if "hosts" in c else list(old.get("hosts") or []),
                # „nur lesen“ für Zugänge ohne Dienste (credentials.read_only): schreibende Aufrufe werden abgelehnt
                readonly=bool(c["readonly"]) if "readonly" in c else bool(old.get("readonly")),
                updated=now())
    if scope:
        cred["scope"] = scope  # eigener Zugang, persönliche Zugangsdaten oder zentraler Systemzugang
    if svc is not None:
        cred["services"] = svc  # GWDG: wofür der Zugang gilt (Postfach, Kalender, Kontakte)
        # … und je Dienst nur lesen (Standard) oder auch schreiben – die Werkzeuge halten sich daran
        raw_acc = c["access"] if isinstance(c.get("access"), dict) else (old.get("access") or {})
        cred["access"] = {k: ("write" if raw_acc.get(k) == "write" else "read") for k in svc}
    else:
        cred.pop("services", None)
        cred.pop("access", None)
    if rotated or (old.get("fields") or {}) != fields or old.get("services") != cred.get("services"):
        # andere Adresse, anderer Benutzer oder neues Geheimnis: die alte Pruefung sagt nichts mehr aus
        cred.pop("check", None)
    return cred


def check_free(m, old: dict | None) -> None:
    """Neue freie Zugänge (ohne Konnektor) nur, wenn der Admin sie erlaubt."""
    if not old and not CN.free_allowed(m.config.data):
        raise ValueError("Eigene Zugänge ohne Konnektor hat der Admin abgeschaltet. Verbinde stattdessen einen Konnektor "
                         "(Seite „Plugins → Konnektoren“).")


async def save_credential(m, user_id: str, st, c: dict, connector: dict | None = None) -> dict:
    """Zugang speichern. Mit ``connector`` entsteht bzw. ändert sich eine Verbindung (connectors.py): dessen feste
    Felder gelten immer; ein vorhandener Konnektor-Zugang behält seine festen Felder, egal was das Formular schickt."""
    old = st.meta["credentials"].get(c.get("id") or "")
    if connector is None:
        check_free(m, old)
    cred = build_credential(st, c, allow_central=allow_central(m))
    k = connector or CN.by_id(m.config.data, (old or {}).get("connector_id"))
    if connector is not None:
        cred["connector_id"] = connector["id"]
    if k is not None and cred.get("connector_id") == k["id"]:
        CN.enforce(cred, k)
    st.meta["credentials"][cred["id"]] = cred
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "credentials"})
    return cred


async def delete_credential(m, user_id: str, st, cid: str) -> None:
    st.meta["credentials"].pop(cid, None)
    # der Skill einer Konnektor-Verbindung gehört fest zu ihr und geht mit
    for sid in [k for k, s in st.meta["skills"].items() if s.get("connection_id") == cid]:
        st.meta["skills"].pop(sid, None)
        await st.async_delete_scope("skill", sid)
    for p in st.meta["projects"].values():
        if cid in (p.get("credentials") or []):
            p["credentials"].remove(cid)
    for s in st.meta["skills"].values():
        if cid in (s.get("credentials") or []):
            s["credentials"].remove(cid)
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "all"})


def build_task(st, t: dict, owner_id: str | None = None) -> dict:
    tid = t.get("id") or new_id("t")
    old = st.meta["tasks"].get(tid, {"created": now(), "runs": []})
    sched = t.get("schedule") or old.get("schedule") or {"type": "daily", "time": "08:00"}
    schedule_to_cron(sched)  # validates
    # Sharing: the owner decides who else sees the task, who may change it and who gets a notification of their own
    share = dict(old.get("share") or {"users": {}})
    if t.get("share") is not None:
        share["users"] = SH.clean((t["share"] or {}).get("users") if isinstance(t["share"], dict) else t["share"])
    share["users"].pop(owner_id or "", None)  # the owner is never part of the share map
    task = dict(old, id=tid, name=str(t.get("name") or "Aufgabe")[:100], prompt=str(t.get("prompt") or ""),
                project_id=t.get("project_id") or None, model=t.get("model") or None, schedule=sched,
                enabled=bool(t.get("enabled", True)), allow_write=list(t.get("allow_write") or []),
                tool_groups=t.get("tool_groups") or None, notify=t.get("notify") or "always",
                requires=[r for r in (t.get("requires", old.get("requires")) or []) if r in ("werkbank",)],
                requires_note=str(t.get("requires_note", old.get("requires_note")) or "")[:1500],
                external_fallback=bool(t.get("external_fallback", old.get("external_fallback"))),
                # besonders aufwaendig: bis zu 150 statt 60 Schritte je Lauf
                heavy=bool(t.get("heavy", old.get("heavy"))),
                # Zugänge, die ein unbeaufsichtigter Lauf nutzen darf (policy.py) – fragen kann er nicht
                cred_allow=(P.clean_cred_allow(t["cred_allow"], st.meta["credentials"]) if t.get("cred_allow") is not None
                            else list(old.get("cred_allow") or [])),
                share=share, updated=now())
    # Nach einem Vorschlag des Admins eingerichtet (skillcheck.py): Die Verknüpfung mit dem zentralen Skill setzt nur
    # der Einrichtungs-Chat (tools/manage.py prüft sie); das Panel lässt sie, wie sie ist.
    central_id = t["central_skill_id"] if "central_skill_id" in t else old.get("central_skill_id")
    if central_id:
        task["central_skill_id"] = str(central_id)[:40]
    else:
        task.pop("central_skill_id", None)
    # Kachel-Aufgabe (boards.py): Herkunft, Kachel und das Schreibrecht in die eigene Kachel bleiben, egal was
    # der Aufrufer schickt. Jede andere Aufgabe darf `dashboard_update` nie verwenden.
    origin = old.get("origin") or (ORIGIN_DASHBOARD if t.get("origin") == ORIGIN_DASHBOARD else None)
    if origin == ORIGIN_DASHBOARD:
        task["origin"] = ORIGIN_DASHBOARD
        task["tile_id"] = old.get("tile_id") or str(t.get("tile_id") or "")
        task["allow_write"] = sorted(set(task["allow_write"]) | {"dashboard_update"})
        task["share"] = {"users": {}}
        task.pop("central_skill_id", None)
    else:
        task["allow_write"] = [n for n in task["allow_write"] if n != "dashboard_update"]
    if not task["prompt"].strip():
        raise ValueError("Der Auftrag (Prompt) fehlt")
    if t.get("cred_allow") is not None:
        task.pop("cred_allow_migrated", None)  # die Person hat die Liste angesehen
    if task["heavy"] and not old.get("heavy"):
        task.pop("limit_hit", None)  # gerade freigegeben: die rote Markierung hat sich erledigt
    return task


async def save_task(m, user_id: str, st, t: dict) -> dict:
    task = build_task(st, t, owner_id=user_id)
    st.meta["tasks"][task["id"]] = task
    m.scheduler.plan(user_id, task)
    await st.async_save_meta()
    m.emit_task(user_id, task)
    return task


async def delete_task(m, user_id: str, st, tid: str) -> None:
    t = st.meta["tasks"].pop(tid, None)
    if t:
        t["enabled"] = False
        m.scheduler.plan(user_id, t)
    await st.async_save_meta()
    m.emit_task(user_id, t or {"id": tid, "share": {}})
