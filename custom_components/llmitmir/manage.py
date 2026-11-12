"""Saving and deleting skills, credentials and scheduled tasks – shared by the panel (ws.py) and the model's tools."""
from __future__ import annotations

from . import credentials as C
from . import sharing as SH
from .cron import schedule_to_cron
from .storage import new_id, now

MASK = "•••"


async def save_skill(m, user_id: str, st, s: dict) -> dict:
    sid = s.get("id") or new_id("s")
    old = st.meta["skills"].get(sid, {"created": now()})
    name = str(s.get("name") or old.get("name") or "").strip()
    if not name:
        raise ValueError("Name fehlt")
    skill = dict(old, id=sid, name=name[:80], description=str(s.get("description") or "")[:1024],
                 body=str(s.get("body") or ""), credentials=list(s.get("credentials") or []),
                 enabled=bool(s.get("enabled", True)), updated=now())
    st.meta["skills"][sid] = skill
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "skills"})
    return skill


async def delete_skill(m, user_id: str, st, sid: str) -> None:
    st.meta["skills"].pop(sid, None)
    await st.async_delete_scope("skill", sid)
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "skills"})


def build_credential(st, c: dict) -> dict:
    """Validated credential record from panel/tool input (secrets equal to MASK stay unchanged)."""
    cid = c.get("id") or new_id("k")
    old = st.meta["credentials"].get(cid, {"created": now(), "fields": {}})
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
    if typ == "gwdg":
        known = C.TYPES["gwdg"]["services"]
        raw = c["services"] if c.get("services") is not None else old.get("services")
        svc = [k for k in known if k in (raw if raw is not None else C.TYPES["gwdg"]["default_services"])]
        if not svc:
            raise ValueError("Wähl aus, wofür der GWDG-Zugang gilt: E-Mail-Postfach, Kalender und/oder Kontakte.")
    fields = C.normalize_fields(typ, fields, svc)
    if typ == "gwdg":
        if not fields.get("username"):
            raise ValueError("Für den GWDG-Zugang brauchen wir die GWDG-E-Mail-Adresse.")
        if not fields.get("password"):
            raise ValueError("Für den GWDG-Zugang brauchen wir dein GWDG-Passwort.")
    name = str(c.get("name") or old.get("name") or "").strip() or ("GWDG-Exchange" if typ == "gwdg" else "")
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
                # released for usage-billed external models (Claude)? Closed unless the person opens it explicitly.
                external=bool(c["external"]) if "external" in c else bool(old.get("external")),
                updated=now())
    if svc is not None:
        cred["services"] = svc  # GWDG: wofür der Zugang gilt (Postfach, Kalender, Kontakte)
    else:
        cred.pop("services", None)
    if rotated or (old.get("fields") or {}) != fields or old.get("services") != cred.get("services"):
        # andere Adresse, anderer Benutzer oder neues Geheimnis: die alte Pruefung sagt nichts mehr aus
        cred.pop("check", None)
    return cred


async def save_credential(m, user_id: str, st, c: dict) -> dict:
    cred = build_credential(st, c)
    st.meta["credentials"][cred["id"]] = cred
    await st.async_save_meta()
    m.emit(user_id, {"type": "meta", "section": "credentials"})
    return cred


async def delete_credential(m, user_id: str, st, cid: str) -> None:
    st.meta["credentials"].pop(cid, None)
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
                share=share, updated=now())
    if not task["prompt"].strip():
        raise ValueError("Der Auftrag (Prompt) fehlt")
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
