"""Websocket API for the LLMitMir panel. Every command is scoped to the calling HA user."""
from __future__ import annotations

import asyncio
import functools
import secrets
import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from . import credcheck as CK
from . import credentials as C
from . import manage as M
from . import models as MS
from . import notifydevices as ND
from . import pricing as PR
from . import retention as RT
from . import providers as PV
from . import sharing as SH
from . import views as V
from .const import (DOMAIN, KEY_MODES, KEY_SHARED, KIND_CHAT, KIND_COWORK, KIND_TASK_RUN, KNOWN_CONTEXT, PRESETS,
                    TASK_KEY_CHOICES, TASK_KEY_MODES, VERSION)
from .scheduler import describe, next_run, schedule_to_cron
from .storage import mask_credential, new_id, now
from .claude_client import available as claude_available
from .tools import GROUPS, REGISTRY

MASK = "•••"


def _mgr(hass: HomeAssistant):
    return hass.data[DOMAIN]["manager"]


def command(schema: dict, admin: bool = False):
    """Register helper: access check, user store, error handling."""

    def deco(func):
        @websocket_api.websocket_command(schema)
        @websocket_api.async_response
        @functools.wraps(func)
        async def handler(hass, connection, msg):
            m = _mgr(hass)
            user = connection.user
            if admin and not user.is_admin:
                connection.send_error(msg["id"], "unauthorized", "Nur für Admins")
                return
            if not admin and not m.allowed(user):
                connection.send_error(msg["id"], "unauthorized", "Kein Zugriff auf LLMitMir")
                return
            st = await m.user_store(user.id)
            try:
                res = await func(hass, connection, msg, m, user, st)
            except (ValueError, KeyError, PermissionError) as e:
                connection.send_error(msg["id"], "invalid", str(e))
                return
            if res is not _NO_RESULT:
                connection.send_result(msg["id"], res)

        HANDLERS.append(handler)
        return handler

    return deco


_NO_RESULT = object()
HANDLERS: list = []


def _t(s: str) -> dict:
    return {vol.Required("type"): f"{DOMAIN}/{s}"}


def _models_for_users(m, user_id: str) -> list[dict]:
    return m.models_for_user(user_id)


async def _run_chats(owner_st, task: dict) -> list[dict]:
    """The last runs of a task as short chat records – also for people the task is shared with."""
    out = []
    for cid in (task.get("runs") or [])[-10:]:
        c = await owner_st.async_get_chat(cid)
        if c:
            out.append({"id": c["id"], "title": c.get("title"), "status": c.get("status"),
                        "updated": c.get("updated"), "usage": c.get("usage") or {}})
    return out


def _task_view(m, user_id: str, t: dict, owner_id: str | None = None, names: dict | None = None,
               run_chats: list[dict] | None = None) -> dict:
    out = {k: v for k, v in t.items() if not k.startswith("_")}
    out["schedule_text"] = describe(t.get("schedule") or {})
    out["werkbank_missing"] = "werkbank" in (t.get("requires") or []) and m.werkbank is None
    owner_id = owner_id or user_id
    rights = m.task_rights(owner_id, t, user_id)
    out["owner_id"] = owner_id
    out["owner_name"] = (names or {}).get(owner_id) or ""
    out["shared"] = owner_id != user_id
    out["can_edit"] = rights["edit"]
    out["can_notify"] = rights["notify"]
    out["share"] = {"users": [{"user_id": uid, "name": (names or {}).get(uid) or uid, "edit": bool(e.get("edit")),
                               "notify": bool(e.get("notify"))}
                              for uid, e in ((t.get("share") or {}).get("users") or {}).items()]}
    out["share_text"] = SH.summary(t.get("share"), names)
    if run_chats is not None:
        out["run_chats"] = run_chats
    return out


async def _names(m, user_ids) -> dict:
    """User id -> name, for everybody involved in a task (owner and people it is shared with)."""
    out = {}
    for uid in dict.fromkeys([u for u in user_ids if u]):
        out[uid] = await m.user_name(uid)
    return out


def _project_view(p: dict) -> dict:
    return dict(p)


async def _tasks_view(m, user) -> list[dict]:
    """Own tasks plus the ones other people shared with this person (marked with the owner's name)."""
    st = await m.user_store(user.id)
    shared = await m.shared_tasks(user.id)
    ids = [user.id] + [uid for uid, _ in shared]
    for t in st.meta["tasks"].values():
        ids += SH.users(t.get("share"))
    names = await _names(m, ids)
    out = [_task_view(m, user.id, t, user.id, names, await _run_chats(st, t)) for t in st.meta["tasks"].values()]
    for uid, t in shared:
        out.append(_task_view(m, user.id, t, uid, names, await _run_chats(await m.user_store(uid), t)))
    return out


async def _bootstrap(hass, m, user, st) -> dict:
    s = dict(st.meta["settings"])
    s["has_own_key"] = bool(s.pop("own_key", ""))
    # Lebensdauer der Chats und Coworks außerhalb von Projekten (ohne Angabe der Standard)
    s["retention_days"] = RT.user_days(st.meta["settings"])
    s["has_own_task_key"] = bool(s.pop("own_task_key", ""))
    # The device this person actually uses (own choice, else their only device) – the panel shows its name
    devices = ND.apply_links(await ND.async_devices(hass), m.config.data.get("notify_devices"))
    device = ND.resolve(ND.for_user(devices, user.id), user.id, st.meta["settings"])
    s["notify_device"] = device["key"] if device else ""
    s["notify_device_name"] = device["name"] if device else ""
    s.pop("notify_service", None)
    sched = m.scheduler
    runs = {r.chat_id: {"run_id": r.id, "status": r.status, "detail": r.detail, "started": r.started, "hint": r.hint}
            for r in m.runs.values() if r.user_id == user.id}
    perms = [info for (uid, fut, info) in m.permissions.values() if uid == user.id and not fut.done()]
    return {
        "version": VERSION,
        "user": {"id": user.id, "name": user.name, "is_admin": user.is_admin},
        "view": m.view(user.id),
        "provider": {"name": (m.config.data.get("provider") or {}).get("name"), "preset": (m.config.data.get("provider") or {}).get("preset"),
                     "hint": m.preset().get("hint", "")},
        "key_mode": m.config.data.get("key_mode"),
        "settings": s,
        "memory": st.meta.get("memory", ""),
        "projects": [dict(p, retention_days=RT.project_days(p)) for p in st.meta["projects"].values()],
        "skills": list(st.meta["skills"].values()),
        "credentials": [mask_credential(c, C.secret_fields(c)) for c in st.meta["credentials"].values()],
        "credential_types": {k: {"label": v["label"], "fields": v["fields"], "secret": sorted(v["secret"]), "hint": v.get("hint", "")}
                             for k, v in C.TYPES.items()},
        "tasks": await _tasks_view(m, user),
        "chats": sorted(st.meta["chats"].values(), key=lambda c: c.get("updated") or 0, reverse=True),
        "models": _models_for_users(m, user.id),
        "defaults": m.defaults_view(user.id),
        "external": m.external_view(user.id),
        "tool_groups": GROUPS,
        "tools": {n: {"group": t.group, "label": t.label, "icon": t.icon, "write": bool(t.write), "confirm": t.preview is not None}
                  for n, t in REGISTRY.items()},
        "usage": m.usage_snapshot(user.id),
        "queue": sched.queue_info(user.id) if sched else {},
        "runs": runs,
        "permissions": perms,
        "transcription": bool((m.config.data.get("provider") or {}).get("transcription_model")),
        # Lebensdauer: Standard und Obergrenze für die Felder in Projekt und Einstellungen
        "retention": {"default": RT.DEFAULT_DAYS, "max": RT.MAX_DAYS},
        "werkbank": {"configured": m.werkbank is not None},
    }


# ---------------------------------------------------------------- bootstrap / events
@command(_t("bootstrap"))
async def ws_bootstrap(hass, conn, msg, m, user, st):
    await m.ensure_models(user.id)
    return await _bootstrap(hass, m, user, st)


@websocket_api.websocket_command(_t("access"))
@callback
def ws_access(hass, conn, msg):
    m = _mgr(hass)
    conn.send_result(msg["id"], {"allowed": m.allowed(conn.user), "is_admin": conn.user.is_admin,
                                 "configured": bool(m.config.data.get("provider", {}).get("base_url"))})


HANDLERS.append(ws_access)


@command(_t("subscribe"))
async def ws_subscribe(hass, conn, msg, m, user, st):
    @callback
    def forward(event: dict) -> None:
        conn.send_message(websocket_api.event_message(msg["id"], event))

    conn.subscriptions[msg["id"]] = m.subscribe(user.id, forward)
    conn.send_result(msg["id"])
    return _NO_RESULT


# ---------------------------------------------------------------- chats
async def _chat_for(m, user, chat_id: str) -> tuple[Any, dict]:
    """(store, chat) – own chat first, then a run of a task somebody shared with this person."""
    st = await m.user_store(user.id)
    chat = await st.async_get_chat(chat_id)
    if chat:
        return st, chat
    for uid, other in (await m.all_stores()).items():
        if uid == user.id or chat_id not in other.meta["chats"]:
            continue
        chat = await other.async_get_chat(chat_id)
        if not chat or chat.get("kind") != KIND_TASK_RUN or not chat.get("task_id"):
            continue
        found = await m.task_owner(user.id, chat["task_id"])
        if found and found[0] == uid:
            return other, chat
    raise ValueError("Chat nicht gefunden")


@command(_t("chat/get") | {vol.Required("chat_id"): str})
async def ws_chat_get(hass, conn, msg, m, user, st):
    cst, chat = await _chat_for(m, user, msg["chat_id"])
    files = await cst.async_list_files("chat", chat["id"])
    return {"chat": chat, "files": files}


@command(_t("chat/create") | {vol.Optional("kind", default=KIND_CHAT): vol.In([KIND_CHAT, KIND_COWORK]),
                               vol.Optional("project_id"): vol.Any(str, None), vol.Optional("model"): vol.Any(str, None),
                               vol.Optional("tools"): vol.Any([str], None)})
async def ws_chat_create(hass, conn, msg, m, user, st):
    chat = await m.create_chat(user.id, msg["kind"], msg.get("project_id"), msg.get("model"), tools=msg.get("tools"))
    return st.chat_summary(chat)


@command(_t("chat/update") | {vol.Required("chat_id"): str, vol.Optional("title"): str, vol.Optional("pinned"): bool,
                               vol.Optional("project_id"): vol.Any(str, None), vol.Optional("model"): str,
                               vol.Optional("tools"): vol.Any([str], None)})
async def ws_chat_update(hass, conn, msg, m, user, st):
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    for k in ("title", "pinned", "project_id", "model", "tools"):
        if k in msg:
            chat[k] = msg[k][:120] if k == "title" else msg[k]
    await st.async_save_chat(chat, keep_updated=True)  # moving/renaming does not make a chat "new"
    m.emit(user.id, {"type": "chat", "chat": st.chat_summary(chat)})
    return st.chat_summary(chat)


@command(_t("chat/seen") | {vol.Required("chat_id"): str})
async def ws_chat_seen(hass, conn, msg, m, user, st):
    """Chat geoeffnet: alles bis jetzt gilt als gelesen (Punkt in der Seitenleiste verschwindet)."""
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    chat["last_seen"] = now()
    await st.async_save_chat(chat, keep_updated=True)  # ansehen macht einen Chat nicht "neu"
    m.emit(user.id, {"type": "chat", "chat": st.chat_summary(chat)})
    return {"ok": True, "last_seen": chat["last_seen"]}


async def _delete_chat(m, user, st, chat_id: str) -> None:
    """Stop a running chat, drop its sandbox and its files, then forget it."""
    await m.delete_chat(user.id, chat_id)


@command(_t("chat/delete") | {vol.Required("chat_id"): str})
async def ws_chat_delete(hass, conn, msg, m, user, st):
    await _delete_chat(m, user, st, msg["chat_id"])
    return {"ok": True}


@command(_t("chat/delete_many") | {vol.Required("chat_ids"): vol.All([str], vol.Length(min=1, max=200))})
async def ws_chat_delete_many(hass, conn, msg, m, user, st):
    """Delete several chats at once (multi-select in the sidebar); unknown ids are skipped."""
    deleted = []
    for chat_id in dict.fromkeys(msg["chat_ids"]):  # keep order, drop duplicates
        if chat_id not in st.meta["chats"]:
            continue
        await _delete_chat(m, user, st, chat_id)
        deleted.append(chat_id)
    return {"ok": True, "deleted": deleted}


@command(_t("chat/send") | {vol.Required("chat_id"): str, vol.Required("text"): str,
                             vol.Optional("attachments"): [str], vol.Optional("model"): str,
                             vol.Optional("tools"): vol.Any([str], None)})
async def ws_chat_send(hass, conn, msg, m, user, st):
    run_id = await m.send(user, msg["chat_id"], msg["text"], msg.get("attachments"), msg.get("model"), msg.get("tools"))
    return {"run_id": run_id}


@command(_t("chat/resume") | {vol.Required("chat_id"): str})
async def ws_chat_resume(hass, conn, msg, m, user, st):
    """Eine wartende Nachricht von Hand starten (nach Stopp oder Fehler)."""
    await m.resume_queued(user, msg["chat_id"])
    return {"ok": True}


@command(_t("chat/unqueue") | {vol.Required("chat_id"): str, vol.Required("message_id"): str})
async def ws_chat_unqueue(hass, conn, msg, m, user, st):
    """Eine Nachricht zurücknehmen, die noch auf das Ende des laufenden Laufs wartet."""
    return {"queued": await m.unqueue(user.id, msg["chat_id"], msg["message_id"])}


@command(_t("chat/retry") | {vol.Required("chat_id"): str})
async def ws_chat_retry(hass, conn, msg, m, user, st):
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    while chat["messages"] and chat["messages"][-1]["role"] != "user":
        chat["messages"].pop()
    if not chat["messages"]:
        raise ValueError("Nichts zu wiederholen")
    await st.async_save_chat(chat)
    return {"run_id": m.start_run(user, chat), "chat": chat}


@command(_t("chat/switch_model") | {vol.Required("chat_id"): str, vol.Required("model"): str})
async def ws_chat_switch_model(hass, conn, msg, m, user, st):
    """Move a chat to another model; a running answer continues on it from the current step."""
    return await m.switch_model(user.id, msg["chat_id"], msg["model"])


@command(_t("chat/stop") | {vol.Required("chat_id"): str})
async def ws_chat_stop(hass, conn, msg, m, user, st):
    return {"stopped": m.stop(user.id, msg["chat_id"])}


@command(_t("permission/answer") | {vol.Required("permission_id"): str, vol.Required("decision"): vol.In(["once", "always", "lots", "deny"])})
async def ws_permission(hass, conn, msg, m, user, st):
    return {"ok": m.answer_permission(user.id, msg["permission_id"], msg["decision"])}


@command(_t("files") | {vol.Required("scope"): vol.In(["chat", "project", "skill"]), vol.Required("owner"): str})
async def ws_files(hass, conn, msg, m, user, st):
    return await st.async_list_files(msg["scope"], msg["owner"])


@command(_t("file/delete") | {vol.Required("scope"): vol.In(["chat", "project", "skill"]), vol.Required("owner"): str,
                               vol.Required("name"): str})
async def ws_file_delete(hass, conn, msg, m, user, st):
    await st.async_delete_file(msg["scope"], msg["owner"], msg["name"])
    return await st.async_list_files(msg["scope"], msg["owner"])


@command(_t("file/save_text") | {vol.Required("scope"): vol.In(["project", "skill"]), vol.Required("owner"): str,
                                  vol.Required("name"): str, vol.Required("content"): str})
async def ws_file_save_text(hass, conn, msg, m, user, st):
    await st.async_write_file(msg["scope"], msg["owner"], msg["name"], msg["content"].encode("utf-8"))
    return await st.async_list_files(msg["scope"], msg["owner"])


# ---------------------------------------------------------------- projects
@command(_t("project/save") | {vol.Required("project"): dict})
async def ws_project_save(hass, conn, msg, m, user, st):
    p = msg["project"]
    pid = p.get("id") or new_id("p")
    old = st.meta["projects"].get(pid, {"created": now()})
    keep = ("name", "description", "instructions", "icon", "color", "credentials", "skills", "credentials_only",
            "skills_only", "model_chat", "model_agent", "tool_groups", "permissions", "no_external", "retention_days")
    for k in ("model_chat", "model_agent"):
        if PV.is_external(p.get(k) or ""):
            raise ValueError("Externe Modelle lassen sich nicht als Standard eines Projekts festlegen – nur im Chat auswählen.")
    proj = dict(old, **{k: p[k] for k in keep if k in p}, id=pid, updated=now())
    if not str(proj.get("name") or "").strip():
        raise ValueError("Name fehlt")
    # Lebensdauer der Chats und Coworks dieses Projekts (0 = unbegrenzt, ohne Angabe 7 Tage)
    proj["retention_days"] = RT.clean_days(proj.get("retention_days"))
    st.meta["projects"][pid] = proj
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "projects"})
    return proj


@command(_t("project/delete") | {vol.Required("project_id"): str, vol.Optional("delete_chats", default=False): bool})
async def ws_project_delete(hass, conn, msg, m, user, st):
    pid = msg["project_id"]
    st.meta["projects"].pop(pid, None)
    for cid, c in list(st.meta["chats"].items()):
        if c.get("project_id") == pid:
            if msg["delete_chats"]:
                await st.async_delete_chat(cid)
            else:
                chat = await st.async_get_chat(cid)
                if chat:
                    chat["project_id"] = None
                    await st.async_save_chat(chat)
    await st.async_delete_scope("project", pid)
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "all"})
    return {"ok": True}


# ---------------------------------------------------------------- skills
@command(_t("skill/save") | {vol.Required("skill"): dict})
async def ws_skill_save(hass, conn, msg, m, user, st):
    return await M.save_skill(m, user.id, st, msg["skill"])


@command(_t("skill/delete") | {vol.Required("skill_id"): str})
async def ws_skill_delete(hass, conn, msg, m, user, st):
    await M.delete_skill(m, user.id, st, msg["skill_id"])
    return {"ok": True}


# ---------------------------------------------------------------- credentials
async def _check_one(m, st, user_id: str, cid: str) -> dict | None:
    """Einen Zugang pruefen, Ergebnis am Zugang merken und an die Oberflaeche melden."""
    c = st.meta["credentials"].get(cid)
    if not c:
        return None
    res = await CK.check_credential(m.session, c)
    c = st.meta["credentials"].get(cid)  # waehrend der Pruefung geloescht oder ersetzt?
    if not c:
        return None
    c["check"] = res
    st.schedule_save(1.0)
    m.emit(user_id, {"type": "cred_check", "id": cid, "check": res})
    return res


@command(_t("credential/save") | {vol.Required("credential"): dict})
async def ws_cred_save(hass, conn, msg, m, user, st):
    cred = await M.save_credential(m, user.id, st, msg["credential"])
    # Nach dem Speichern im Hintergrund pruefen: ein falsch eingetragenes Passwort faellt so sofort auf,
    # ohne dass das Speichern auf eine Zeitueberschreitung warten muss.
    if cred.get("type") != "other":
        hass.async_create_task(_check_one(m, st, user.id, cred["id"]))
    return mask_credential(cred, C.secret_fields(cred))


@command(_t("credential/reveal") | {vol.Required("credential_id"): str})
async def ws_cred_reveal(hass, conn, msg, m, user, st):
    c = st.meta["credentials"].get(msg["credential_id"])
    if not c:
        raise ValueError("Zugang nicht gefunden")
    return c


@command(_t("credential/delete") | {vol.Required("credential_id"): str})
async def ws_cred_delete(hass, conn, msg, m, user, st):
    await M.delete_credential(m, user.id, st, msg["credential_id"])
    return {"ok": True}


@command(_t("credential/check") | {vol.Required("credential_id"): str})
async def ws_cred_check(hass, conn, msg, m, user, st):
    """Prueft einen Zugang mit einer harmlosen Leseanfrage und merkt sich das Ergebnis (rot in der Liste)."""
    if msg["credential_id"] not in st.meta["credentials"]:
        raise ValueError("Zugang nicht gefunden")
    return await _check_one(m, st, user.id, msg["credential_id"])


@command(_t("credential/check_all"))
async def ws_cred_check_all(hass, conn, msg, m, user, st):
    """Alle Zugaenge pruefen (Knopf „Alle prüfen“ auf der Seite „Zugänge“)."""
    ids = list(st.meta["credentials"])
    results = await asyncio.gather(*(_check_one(m, st, user.id, cid) for cid in ids))
    return {"checks": {cid: res for cid, res in zip(ids, results) if res}}


# ---------------------------------------------------------------- tasks
async def _task_for(m, user, task_id: str, need_edit: bool = False) -> tuple[str, Any, dict]:
    """(owner id, owner store, task) of a task this person may see – and change, if need_edit."""
    found = await m.task_owner(user.id, task_id)
    if not found:
        raise ValueError("Aufgabe nicht gefunden")
    owner_id, owner_st, task = found
    rights = m.task_rights(owner_id, task, user.id)
    if need_edit and not rights["edit"]:
        raise PermissionError("Diese Aufgabe gehört jemand anderem – du darfst sie nur ansehen.")
    return owner_id, owner_st, task


@command(_t("task/save") | {vol.Required("task"): dict})
async def ws_task_save(hass, conn, msg, m, user, st):
    t = msg["task"]
    owner_id, owner_st, old = user.id, st, None
    if t.get("id"):
        owner_id, owner_st, old = await _task_for(m, user, t["id"], need_edit=True)
    ext = m.external_view(user.id)
    if (t.get("external_fallback") or PV.is_external(t.get("model") or "")) and not (ext["has_access"] and ext["consent"]):
        raise ValueError("Für externe Modelle braucht es eine Freigabe durch den Admin und deine Zustimmung (Einstellungen → Externe Modelle).")
    if PV.is_external(t.get("model") or "") and not m.may_use_model(user.id, t["model"]):
        raise ValueError("Dieses Modell ist für dich nicht freigegeben.")
    if old is not None and owner_id != user.id:
        # Somebody the task is shared with: only what concerns the task itself, never the sharing
        t = {k: v for k, v in t.items() if k != "share"}
    task = await M.save_task(m, owner_id, owner_st, t)
    names = await _names(m, [owner_id, *SH.users(task.get("share"))])
    return _task_view(m, user.id, task, owner_id, names, await _run_chats(owner_st, task))


@command(_t("task/delete") | {vol.Required("task_id"): str})
async def ws_task_delete(hass, conn, msg, m, user, st):
    owner_id, owner_st, _task = await _task_for(m, user, msg["task_id"], need_edit=True)
    if owner_id != user.id:
        raise PermissionError("Nur wer die Aufgabe angelegt hat, kann sie löschen.")
    await M.delete_task(m, owner_id, owner_st, msg["task_id"])
    return {"ok": True}


@command(_t("task/run_now") | {vol.Required("task_id"): str})
async def ws_task_run(hass, conn, msg, m, user, st):
    owner_id, _owner_st, _task = await _task_for(m, user, msg["task_id"], need_edit=True)
    pos = m.scheduler.enqueue(owner_id, msg["task_id"], "manuell")
    if owner_id != user.id:
        # The run belongs to the owner, but the person who started it should see it in their queue
        m.emit(user.id, {"type": "tasks_queue", "queue": m.scheduler.queue_info(user.id)})
    return {"position": pos}


@command(_t("task/share") | {vol.Required("task_id"): str, vol.Required("users"): [dict]})
async def ws_task_share(hass, conn, msg, m, user, st):
    """Who else sees the task, who may change it and who gets a notification of their own (owner only)."""
    owner_id, owner_st, task = await _task_for(m, user, msg["task_id"])
    if owner_id != user.id:
        raise PermissionError("Wer mit wem teilt, entscheidet nur, wem die Aufgabe gehört.")
    allowed = {u.id for u in await _users(hass) if m.allowed(u)}
    users = SH.clean(msg["users"])
    unknown = [uid for uid in users if uid not in allowed]
    if unknown:
        raise ValueError("Diese Person darf LLMitMir nicht nutzen: " + ", ".join(unknown))
    task["share"] = {"users": users}
    task["updated"] = now()
    owner_st.meta["tasks"][task["id"]] = task
    await owner_st.async_save_meta()
    m.emit_task(owner_id, task)
    names = await _names(m, [owner_id, *users])
    return _task_view(m, user.id, task, owner_id, names, await _run_chats(owner_st, task))


@command(_t("task/people"))
async def ws_task_people(hass, conn, msg, m, user, st):
    """Everybody who may use LLMitMir – the people a task can be shared with (never the own person)."""
    out = []
    for u in await _users(hass):
        if u.id == user.id or not m.allowed(u):
            continue
        out.append({"id": u.id, "name": u.name})
    return {"people": sorted(out, key=lambda x: x["name"].casefold())}


@command(_t("task/preview") | {vol.Required("schedule"): dict})
async def ws_task_preview(hass, conn, msg, m, user, st):
    from homeassistant.util import dt as dt_util

    out, t = [], dt_util.now()
    for _ in range(5):
        n = next_run(msg["schedule"], t)
        if not n:
            break
        out.append(n.isoformat())
        t = n
    return {"next": out, "text": describe(msg["schedule"]), "cron": schedule_to_cron(msg["schedule"])}


# ---------------------------------------------------------------- settings / usage / misc
@command(_t("settings/save") | {vol.Required("settings"): dict})
async def ws_settings_save(hass, conn, msg, m, user, st):
    s = msg["settings"]
    cur = st.meta["settings"]
    for k in ("model_chat", "model_agent"):
        if PV.is_external(s.get(k) or ""):
            raise ValueError("Externe Modelle lassen sich nicht als Standard festlegen – nur im Chat oder bei einer Aufgabe auswählen.")
    for k in ("model_chat", "model_agent", "permissions", "chat_tools", "show_reasoning", "send_on_enter"):
        if k in s:
            cur[k] = s[k]
    if "retention_days" in s:
        # Lebensdauer der Chats und Coworks außerhalb von Projekten (0 = unbegrenzt)
        cur["retention_days"] = RT.clean_days(s["retention_days"])
    if "permission_timeout_min" in s:
        # 0 = ohne Antwort eine Stunde warten und dann ablehnen; sonst nach so vielen Minuten ohne die Aktion weitermachen
        try:
            mins = int(s["permission_timeout_min"] or 0)
        except (TypeError, ValueError):
            raise ValueError("Wartezeit muss eine Zahl in Minuten sein") from None
        cur["permission_timeout_min"] = max(0, min(mins, 1440))
    if "notify_device" in s:
        # Only a device that belongs to this person – the link is set in Home Assistant (or by an admin)
        key = str(s["notify_device"] or "")
        own = ND.for_user(await _devices(hass, m), user.id)
        if key and not any(d["key"] == key for d in own):
            raise ValueError("Dieses Gerät gehört nicht zu deinem Benutzer")
        cur["notify_device"] = key
        cur.pop("notify_service", None)  # replaced by the device choice
    if "own_key" in s and s["own_key"] != MASK:
        cur["own_key"] = str(s["own_key"]).strip()
    if "own_task_key" in s and s["own_task_key"] != MASK:
        cur["own_task_key"] = str(s["own_task_key"]).strip()
    if "task_key_choice" in s:
        choice = s["task_key_choice"] or "same"
        if choice not in TASK_KEY_CHOICES:
            raise ValueError("Ungültige Auswahl für den Aufgaben-Schlüssel")
        if choice == "own" and not cur.get("own_task_key"):
            raise ValueError("Bitte einen Schlüssel für geplante Aufgaben eintragen")
        if choice == "shared" and choice != cur.get("task_key_choice") and not m.config.data.get("shared_task_key"):
            raise ValueError("Es gibt keinen zentralen Aufgaben-Schlüssel – bitte den Admin fragen")
        cur["task_key_choice"] = choice
    if "view" in s:
        if s["view"] not in V.VIEWS:
            raise ValueError("Ungültige Ansicht")
        cur_view = m.view(user.id)
        if cur_view["locked"] and s["view"] != cur_view["view"]:
            raise ValueError("Die Ansicht legt der Admin fest")
        cur["view"] = s["view"]
    if "memory" in s:
        st.meta["memory"] = str(s["memory"])[:20000]
    await st.async_save_meta()
    m.emit(user.id, {"type": "usage", "usage": m.usage_snapshot(user.id)})
    return {"ok": True}


@command(_t("usage/history"))
async def ws_usage_history(hass, conn, msg, m, user, st):
    tk = m.task_key_info(user.id, st)["key"]
    return {"days": st.meta["usage"], "snapshot": m.usage_snapshot(user.id),
            "task_key_days": m.task_key_usage(tk)["days"] if tk else [],
            "external": {"months": PR.months(m.billing.ledger, user.id, 12), "days": PR.days(m.billing.ledger, user.id),
                         "names": {x["key"]: x["name"] for x in m.ext_models()}}}


@command(_t("external/consent") | {vol.Required("accept"): bool})
async def ws_external_consent(hass, conn, msg, m, user, st):
    """The person read the explanation about external models and agrees (or takes it back)."""
    if msg["accept"]:
        st.meta["settings"]["external_consent"] = now()
    else:
        st.meta["settings"].pop("external_consent", None)
        for t in st.meta["tasks"].values():  # without consent no task may move there either
            t["external_fallback"] = False
    await st.async_save_meta()
    m.emit(user.id, {"type": "usage", "usage": m.usage_snapshot(user.id)})
    m.emit_models()
    return {"ok": True, "external": m.external_view(user.id)}


async def _devices(hass, m) -> list[dict]:
    """All push devices with the person they belong to (Home Assistant's link, corrected by admins)."""
    return ND.apply_links(await ND.async_devices(hass), m.config.data.get("notify_devices"))


@command(_t("notify_devices"))
async def ws_notify_devices(hass, conn, msg, m, user, st):
    """The devices of this person only – names as people know them, never identifiers."""
    own = ND.for_user(await _devices(hass, m), user.id)
    chosen = ND.resolve(own, user.id, st.meta["settings"])
    return {"devices": [{"key": d["key"], "name": d["name"], "available": d["available"]} for d in own],
            "selected": chosen["key"] if chosen else ""}


@command(_t("import/token"))
async def ws_import_token(hass, conn, msg, m, user, st):
    tok = secrets.token_urlsafe(24)
    st.meta["import_tokens"] = {k: v for k, v in st.meta["import_tokens"].items() if v.get("expires", 0) > time.time()}
    st.meta["import_tokens"][tok] = {"expires": time.time() + 24 * 3600, "created": now()}
    await st.async_save_meta()
    hass.data[DOMAIN]["import_tokens"][tok] = user.id
    return {"token": tok, "path": f"/api/llmitmir/import/{tok}", "expires": st.meta["import_tokens"][tok]["expires"]}


# ---------------------------------------------------------------- admin
def _admin_view(m, users, devices: list[dict] | None = None) -> dict:
    cfg = m.config.data
    usage = {}
    for u in users:
        st = m.users.get(u.id)
        usage[u.id] = st.usage_today() if st else None
    return {
        "provider": cfg.get("provider"),
        "presets": {k: {"name": v["name"], "base_url": v["base_url"], "hint": v["hint"],
                        "transcription_model": v["transcription_model"]} for k, v in PRESETS.items()},
        "key_mode": cfg.get("key_mode"), "key_modes": list(KEY_MODES),
        "shared_key": MASK if cfg.get("shared_key") else "",
        "user_keys": {uid: MASK for uid, k in (cfg.get("user_keys") or {}).items() if k},
        "task_key_mode": cfg.get("task_key_mode"), "task_key_modes": list(TASK_KEY_MODES),
        "shared_task_key": MASK if cfg.get("shared_task_key") else "",
        "task_usage": _task_usage_view(m),
        "allowed_users": cfg.get("allowed_users") or [],
        "quota_default": cfg.get("quota_default"), "quota_users": cfg.get("quota_users") or {},
        "models": cfg.get("models"), "known_context": KNOWN_CONTEXT, "models_live": m.models_for_users(all_known=True),
        "auto_models": {r: MS.pick(m.live_models(), r) or "" for r in MS.ROLES},
        "search": cfg.get("search"),
        "werkbank": {"url": (cfg.get("werkbank") or {}).get("url", ""), "token": MASK if (cfg.get("werkbank") or {}).get("token") else ""},
        "users": [{"id": u.id, "name": u.name, "is_admin": u.is_admin, "is_active": u.is_active,
                   "view": (m.users[u.id].meta["settings"].get("view") if u.id in m.users else None)} for u in users],
        "views": V.clean(cfg.get("views")),
        "notify_devices": [{"key": d["key"], "name": d["name"], "service": d["service"], "entity_id": d["entity_id"],
                            "user_id": d["user_id"], "source": d["source"], "available": d["available"],
                            "linked_by_admin": bool(d.get("linked_by_admin"))} for d in (devices or [])],
        "notify_overrides": (cfg.get("notify_devices") or {}).get("overrides") or {},
        "usage_today": usage,
        "key_limits": {"shared": m.provider.key_state(cfg["shared_key"]).snapshot()} if cfg.get("shared_key") else {},
        "providers": [_provider_view(m, p) for p in m.providers()],
        "provider_info": PV.INFO,
        "ext_models": [{k: v for k, v in x.items()} for x in m.ext_models()],
        "list_prices": PR.KNOWN_USD,
        "model_access": cfg.get("model_access") or {},
        "billing": {k: (cfg.get("billing") or {}).get(k) for k in ("usd_eur", "prices", "limits", "limit_default", "fallback_model")},
        "costs": {u.id: {"months": PR.months(m.billing.ledger, u.id, 12), "limit": m.ext_limit(u.id)} for u in users},
        "sdk": claude_available(),
    }


def _provider_view(m, p: dict) -> dict:
    out = {k: v for k, v in p.items() if k != "key"}
    if p["id"] != PV.MAIN:
        out["key"] = MASK if p.get("key") else ""
        out["state"] = m.ext_state(p["id"])
    return out


def _task_usage_view(m) -> dict:
    """Usage of all scheduled tasks on the central task key and on the shared normal key."""
    cfg = m.config.data
    out = {}
    for name, key in (("central", cfg.get("shared_task_key")), ("shared", cfg.get("shared_key"))):
        if key and (name == "central" or cfg.get("key_mode") == KEY_SHARED):
            out[name] = m.task_key_usage(key) | {"limits": m.provider.key_state(key).snapshot()}
    return out


async def _users(hass):
    return [u for u in await hass.auth.async_get_users() if not u.system_generated]


@command(_t("admin/get"), admin=True)
async def ws_admin_get(hass, conn, msg, m, user, st):
    return _admin_view(m, await _users(hass), await _devices(hass, m))


@command(_t("admin/save") | {vol.Required("config"): dict}, admin=True)
async def ws_admin_save(hass, conn, msg, m, user, st):
    c = msg["config"]
    cfg = m.config.data
    if "provider" in c:
        p = c["provider"]
        if not str(p.get("base_url") or "").startswith("http"):
            raise ValueError("Basis-URL fehlt")
        cfg["provider"] = {"preset": p.get("preset") or "openai_compatible", "name": p.get("name") or "",
                           "base_url": p["base_url"].rstrip("/"), "transcription_model": p.get("transcription_model") or ""}
    if "key_mode" in c:
        if c["key_mode"] not in KEY_MODES:
            raise ValueError("Ungültiger Schlüsselmodus")
        cfg["key_mode"] = c["key_mode"]
    if "shared_key" in c and c["shared_key"] != MASK:
        cfg["shared_key"] = str(c["shared_key"]).strip()
    if "task_key_mode" in c:
        if c["task_key_mode"] not in TASK_KEY_MODES:
            raise ValueError("Ungültiger Modus für den Aufgaben-Schlüssel")
        cfg["task_key_mode"] = c["task_key_mode"]
    if "shared_task_key" in c and c["shared_task_key"] != MASK:
        cfg["shared_task_key"] = str(c["shared_task_key"]).strip()
    if "user_keys" in c:
        keys = dict(cfg.get("user_keys") or {})
        for uid, k in c["user_keys"].items():
            if k == MASK:
                continue
            if k:
                keys[uid] = str(k).strip()
            else:
                keys.pop(uid, None)
        cfg["user_keys"] = keys
    for k in ("allowed_users", "quota_default", "quota_users", "search"):
        if k in c:
            cfg[k] = c[k]
    if "views" in c:
        cfg["views"] = V.clean(c["views"])
    if "notify_devices" in c:
        cfg["notify_devices"] = ND.clean_links(c["notify_devices"])
    if "werkbank" in c:
        wb = dict(cfg.get("werkbank") or {})
        wb["url"] = str(c["werkbank"].get("url") or "").strip().rstrip("/")
        if c["werkbank"].get("token") != MASK:
            wb["token"] = str(c["werkbank"].get("token") or "").strip()
        cfg["werkbank"] = wb
    if "providers" in c:
        old = {p["id"]: p for p in m.providers()}
        new = []
        for p in c["providers"]:
            pid = p.get("id")
            if pid not in old:
                continue
            q = dict(old[pid])
            if pid != PV.MAIN:
                q["enabled"] = bool(p.get("enabled"))
                q["mode"] = p.get("mode") if p.get("mode") in PV.MODES else "fallback"
                if p.get("key") != MASK:
                    q["key"] = str(p.get("key") or "").strip()
                if pid == PV.FOUNDRY:
                    q["endpoint"] = str(p.get("endpoint") or "").strip()
                    q["extra_models"] = [str(x).strip() for x in (p.get("extra_models") or []) if str(x).strip()][:30]
            new.append(q)
        cfg["providers"] = PV.normalize(new)
    if "model_access" in c:
        cfg["model_access"] = {str(k): [str(u) for u in (v or [])] for k, v in (c["model_access"] or {}).items() if v is not None}
    if "billing" in c:
        b = dict(cfg.get("billing") or {})
        nb = c["billing"] or {}
        if "usd_eur" in nb:
            rate = PR._num(nb.get("usd_eur"))
            if not rate or rate <= 0 or rate > 10:
                raise ValueError("Bitte einen gültigen Umrechnungskurs USD → EUR eintragen (z. B. 0,86).")
            b["usd_eur"] = rate
        if "prices" in nb:
            prices = {}
            for key, pr in (nb.get("prices") or {}).items():
                vals = {k: PR._num((pr or {}).get(k)) for k in PR.PRICE_KEYS}
                if vals["in"] is not None and vals["out"] is not None:
                    prices[key] = {k: v for k, v in vals.items() if v is not None}
            b["prices"] = prices
        if "limits" in nb:
            b["limits"] = {uid: PR._num(v) for uid, v in (nb.get("limits") or {}).items() if PR._num(v) is not None}
        if "limit_default" in nb:
            b["limit_default"] = PR._num(nb.get("limit_default")) or 0
        if "fallback_model" in nb:
            b["fallback_model"] = str(nb.get("fallback_model") or "")
        cfg["billing"] = b
    if "models" in c:
        mm = dict(cfg.get("models") or {})
        for k in ("enabled", "defaults", "context", "auto_enable_new"):
            if k in c["models"]:
                mm[k] = c["models"][k]
        cfg["models"] = mm
    await m.config.async_save()
    for uid in list(m.subscribers):
        m.emit(uid, {"type": "meta", "section": "all"})
    m.emit_models()
    return _admin_view(m, await _users(hass), await _devices(hass, m))


@command(_t("admin/provider_refresh") | {vol.Required("provider_id"): vol.In(list(PV.EXTERNAL))}, admin=True)
async def ws_provider_refresh(hass, conn, msg, m, user, st):
    """Ask an external provider for its models (Foundry: which Claude deployments answer)."""
    from .provider import ProviderError

    try:
        found = await m.refresh_ext_models(msg["provider_id"])
    except ProviderError as e:
        raise ValueError(str(e)) from e
    if not found:
        raise ValueError("Keine Modelle gefunden. Bei Foundry: Deployment-Namen prüfen und unter „Weitere Deployments“ eintragen.")
    return _admin_view(m, await _users(hass), await _devices(hass, m))


@command(_t("admin/models_refresh") | {vol.Optional("key"): str}, admin=True)
async def ws_models_refresh(hass, conn, msg, m, user, st):
    key = msg.get("key") if msg.get("key") and msg.get("key") != MASK else m.key_for(user.id, st) or m.config.data.get("shared_key")
    if not key:
        raise ValueError("Zum Laden der Modelle wird ein Schlüssel gebraucht")
    m._models_at = 0
    if not await m.refresh_models(key=key, max_age=0):
        raise ValueError("Modellliste konnte nicht geladen werden (Schlüssel und Basis-URL prüfen)")
    return _admin_view(m, await _users(hass), await _devices(hass, m))


@command(_t("admin/werkbank_test") | {vol.Optional("url"): str, vol.Optional("token"): str}, admin=True)
async def ws_werkbank_test(hass, conn, msg, m, user, st):
    from .werkbank import Werkbank, WerkbankError

    cfg = m.config.data.get("werkbank") or {}
    url = (msg.get("url") or cfg.get("url") or "").strip().rstrip("/")
    token = msg.get("token") if msg.get("token") and msg.get("token") != MASK else cfg.get("token", "")
    if not url or not token:
        raise ValueError("URL und Token eintragen")
    try:
        return {"ok": True, **(await Werkbank(m.session, url, token).health())}
    except WerkbankError as e:
        return {"ok": False, "error": str(e)}


def async_register(hass: HomeAssistant) -> None:
    for h in HANDLERS:
        websocket_api.async_register_command(hass, h)
