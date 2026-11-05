"""Websocket API for the LLMitMir panel. Every command is scoped to the calling HA user."""
from __future__ import annotations

import functools
import secrets
import time
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from . import credentials as C
from .const import DOMAIN, KEY_MODES, KIND_CHAT, KIND_COWORK, KNOWN_CONTEXT, PRESETS, VERSION
from .scheduler import describe, next_run, schedule_to_cron
from .storage import mask_credential, new_id, now
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


def _models_for_users(m) -> list[dict]:
    cfg = m.config.data.get("models") or {}
    known = {x["id"]: x for x in cfg.get("known") or []}
    enabled = cfg.get("enabled") or list(known)
    out = []
    for mid in enabled:
        info = known.get(mid, {"id": mid})
        out.append({"id": mid, "name": info.get("name") or mid, "input": info.get("input") or ["text"],
                    "output": info.get("output") or ["text"], "status": info.get("status", "ready"),
                    "context": m.context_size(mid), "tools": info.get("tools", True)})
    return out


def _task_view(m, user_id: str, t: dict) -> dict:
    out = {k: v for k, v in t.items() if not k.startswith("_")}
    out["schedule_text"] = describe(t.get("schedule") or {})
    return out


def _project_view(p: dict) -> dict:
    return dict(p)


async def _bootstrap(hass, m, user, st) -> dict:
    s = dict(st.meta["settings"])
    s["has_own_key"] = bool(s.pop("own_key", ""))
    sched = m.scheduler
    runs = {r.chat_id: {"run_id": r.id, "status": r.status, "detail": r.detail, "started": r.started}
            for r in m.runs.values() if r.user_id == user.id}
    perms = [info for (uid, fut, info) in m.permissions.values() if uid == user.id and not fut.done()]
    return {
        "version": VERSION,
        "user": {"id": user.id, "name": user.name, "is_admin": user.is_admin},
        "provider": {"name": (m.config.data.get("provider") or {}).get("name"), "preset": (m.config.data.get("provider") or {}).get("preset"),
                     "hint": m.preset().get("hint", "")},
        "key_mode": m.config.data.get("key_mode"),
        "settings": s,
        "memory": st.meta.get("memory", ""),
        "projects": list(st.meta["projects"].values()),
        "skills": list(st.meta["skills"].values()),
        "credentials": [mask_credential(c, C.secret_fields(c)) for c in st.meta["credentials"].values()],
        "credential_types": {k: {"label": v["label"], "fields": v["fields"], "secret": sorted(v["secret"]), "hint": v.get("hint", "")}
                             for k, v in C.TYPES.items()},
        "tasks": [_task_view(m, user.id, t) for t in st.meta["tasks"].values()],
        "chats": sorted(st.meta["chats"].values(), key=lambda c: c.get("updated") or 0, reverse=True),
        "models": _models_for_users(m),
        "defaults": {r: m.default_model(user.id, r) for r in ("chat", "agent", "vision")},
        "tool_groups": GROUPS,
        "tools": {n: {"group": t.group, "label": t.label, "icon": t.icon, "write": bool(t.write)} for n, t in REGISTRY.items()},
        "usage": m.usage_snapshot(user.id),
        "queue": sched.queue_info(user.id) if sched else {},
        "runs": runs,
        "permissions": perms,
        "transcription": bool((m.config.data.get("provider") or {}).get("transcription_model")),
    }


# ---------------------------------------------------------------- bootstrap / events
@command(_t("bootstrap"))
async def ws_bootstrap(hass, conn, msg, m, user, st):
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
@command(_t("chat/get") | {vol.Required("chat_id"): str})
async def ws_chat_get(hass, conn, msg, m, user, st):
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    files = await st.async_list_files("chat", chat["id"])
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
    await st.async_save_chat(chat)
    m.emit(user.id, {"type": "chat", "chat": st.chat_summary(chat)})
    return st.chat_summary(chat)


@command(_t("chat/delete") | {vol.Required("chat_id"): str})
async def ws_chat_delete(hass, conn, msg, m, user, st):
    m.stop(user.id, msg["chat_id"])
    await st.async_delete_chat(msg["chat_id"])
    m.emit(user.id, {"type": "chat_deleted", "chat_id": msg["chat_id"]})
    return {"ok": True}


@command(_t("chat/send") | {vol.Required("chat_id"): str, vol.Required("text"): str,
                             vol.Optional("attachments"): [str], vol.Optional("model"): str,
                             vol.Optional("tools"): vol.Any([str], None)})
async def ws_chat_send(hass, conn, msg, m, user, st):
    run_id = await m.send(user, msg["chat_id"], msg["text"], msg.get("attachments"), msg.get("model"), msg.get("tools"))
    return {"run_id": run_id}


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


@command(_t("chat/stop") | {vol.Required("chat_id"): str})
async def ws_chat_stop(hass, conn, msg, m, user, st):
    return {"stopped": m.stop(user.id, msg["chat_id"])}


@command(_t("permission/answer") | {vol.Required("id"): str, vol.Required("decision"): vol.In(["once", "always", "deny"])})
async def ws_permission(hass, conn, msg, m, user, st):
    return {"ok": m.answer_permission(user.id, msg["id"], msg["decision"])}


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
            "skills_only", "model_chat", "model_agent", "tool_groups", "permissions")
    proj = dict(old, **{k: p[k] for k in keep if k in p}, id=pid, updated=now())
    if not str(proj.get("name") or "").strip():
        raise ValueError("Name fehlt")
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
    s = msg["skill"]
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
    m.emit(user.id, {"type": "meta", "section": "skills"})
    return skill


@command(_t("skill/delete") | {vol.Required("skill_id"): str})
async def ws_skill_delete(hass, conn, msg, m, user, st):
    st.meta["skills"].pop(msg["skill_id"], None)
    await st.async_delete_scope("skill", msg["skill_id"])
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "skills"})
    return {"ok": True}


# ---------------------------------------------------------------- credentials
@command(_t("credential/save") | {vol.Required("credential"): dict})
async def ws_cred_save(hass, conn, msg, m, user, st):
    c = msg["credential"]
    cid = c.get("id") or new_id("k")
    old = st.meta["credentials"].get(cid, {"created": now(), "fields": {}})
    typ = c.get("type") or old.get("type") or "other"
    if typ not in C.TYPES:
        raise ValueError("Unbekannter Typ")
    fields = dict(old.get("fields") or {})
    for k, v in (c.get("fields") or {}).items():
        if v == MASK:
            continue  # unchanged secret
        fields[str(k)[:60]] = str(v)
    for k in c.get("remove_fields") or []:
        fields.pop(k, None)
    name = str(c.get("name") or old.get("name") or "").strip()
    if not name:
        raise ValueError("Name fehlt")
    for other in st.meta["credentials"].values():
        if other["id"] != cid and other.get("name", "").casefold() == name.casefold():
            raise ValueError("Es gibt schon einen Zugang mit diesem Namen")
    cred = dict(old, id=cid, name=name[:80], type=typ, fields=fields, notes=str(c.get("notes") or "")[:2000],
                secret_fields=list(c.get("secret_fields") or old.get("secret_fields") or []),
                project_ids=list(c.get("project_ids") or []), updated=now())
    st.meta["credentials"][cid] = cred
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "credentials"})
    return mask_credential(cred, C.secret_fields(cred))


@command(_t("credential/reveal") | {vol.Required("credential_id"): str})
async def ws_cred_reveal(hass, conn, msg, m, user, st):
    c = st.meta["credentials"].get(msg["credential_id"])
    if not c:
        raise ValueError("Zugang nicht gefunden")
    return c


@command(_t("credential/delete") | {vol.Required("credential_id"): str})
async def ws_cred_delete(hass, conn, msg, m, user, st):
    cid = msg["credential_id"]
    st.meta["credentials"].pop(cid, None)
    for p in st.meta["projects"].values():
        if cid in (p.get("credentials") or []):
            p["credentials"].remove(cid)
    for s in st.meta["skills"].values():
        if cid in (s.get("credentials") or []):
            s["credentials"].remove(cid)
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "all"})
    return {"ok": True}


# ---------------------------------------------------------------- tasks
@command(_t("task/save") | {vol.Required("task"): dict})
async def ws_task_save(hass, conn, msg, m, user, st):
    t = msg["task"]
    tid = t.get("id") or new_id("t")
    old = st.meta["tasks"].get(tid, {"created": now(), "runs": []})
    sched = t.get("schedule") or old.get("schedule") or {"type": "daily", "time": "08:00"}
    schedule_to_cron(sched)  # validates
    task = dict(old, id=tid, name=str(t.get("name") or "Aufgabe")[:100], prompt=str(t.get("prompt") or ""),
                project_id=t.get("project_id") or None, model=t.get("model") or None, schedule=sched,
                enabled=bool(t.get("enabled", True)), allow_write=list(t.get("allow_write") or []),
                tool_groups=t.get("tool_groups") or None, notify=t.get("notify") or "always", updated=now())
    if not task["prompt"].strip():
        raise ValueError("Der Auftrag (Prompt) fehlt")
    st.meta["tasks"][tid] = task
    m.scheduler.plan(user.id, task)
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "tasks"})
    return _task_view(m, user.id, task)


@command(_t("task/delete") | {vol.Required("task_id"): str})
async def ws_task_delete(hass, conn, msg, m, user, st):
    t = st.meta["tasks"].pop(msg["task_id"], None)
    if t:
        t["enabled"] = False
        m.scheduler.plan(user.id, t)
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "tasks"})
    return {"ok": True}


@command(_t("task/run_now") | {vol.Required("task_id"): str})
async def ws_task_run(hass, conn, msg, m, user, st):
    if msg["task_id"] not in st.meta["tasks"]:
        raise ValueError("Aufgabe nicht gefunden")
    pos = m.scheduler.enqueue(user.id, msg["task_id"], "manuell")
    return {"position": pos}


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
    for k in ("model_chat", "model_agent", "notify_service", "permissions", "chat_tools", "show_reasoning", "send_on_enter"):
        if k in s:
            cur[k] = s[k]
    if "own_key" in s and s["own_key"] != MASK:
        cur["own_key"] = str(s["own_key"]).strip()
    if "memory" in s:
        st.meta["memory"] = str(s["memory"])[:20000]
    await st.async_save_meta()
    m.emit(user.id, {"type": "usage", "usage": m.usage_snapshot(user.id)})
    return {"ok": True}


@command(_t("usage/history"))
async def ws_usage_history(hass, conn, msg, m, user, st):
    return {"days": st.meta["usage"], "snapshot": m.usage_snapshot(user.id)}


@command(_t("notify_services"))
async def ws_notify_services(hass, conn, msg, m, user, st):
    svc = hass.services.async_services().get("notify", {})
    return sorted(f"notify.{s}" for s in svc if s not in ("send_message", "persistent_notification"))


@command(_t("import/token"))
async def ws_import_token(hass, conn, msg, m, user, st):
    tok = secrets.token_urlsafe(24)
    st.meta["import_tokens"] = {k: v for k, v in st.meta["import_tokens"].items() if v.get("expires", 0) > time.time()}
    st.meta["import_tokens"][tok] = {"expires": time.time() + 24 * 3600, "created": now()}
    await st.async_save_meta()
    hass.data[DOMAIN]["import_tokens"][tok] = user.id
    return {"token": tok, "path": f"/api/llmitmir/import/{tok}", "expires": st.meta["import_tokens"][tok]["expires"]}


# ---------------------------------------------------------------- admin
def _admin_view(m, users) -> dict:
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
        "allowed_users": cfg.get("allowed_users") or [],
        "quota_default": cfg.get("quota_default"), "quota_users": cfg.get("quota_users") or {},
        "models": cfg.get("models"), "known_context": KNOWN_CONTEXT,
        "search": cfg.get("search"),
        "users": [{"id": u.id, "name": u.name, "is_admin": u.is_admin, "is_active": u.is_active} for u in users],
        "usage_today": usage,
        "key_limits": {"shared": m.provider.key_state(cfg["shared_key"]).snapshot()} if cfg.get("shared_key") else {},
    }


async def _users(hass):
    return [u for u in await hass.auth.async_get_users() if not u.system_generated]


@command(_t("admin/get"), admin=True)
async def ws_admin_get(hass, conn, msg, m, user, st):
    return _admin_view(m, await _users(hass))


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
    if "models" in c:
        mm = dict(cfg.get("models") or {})
        for k in ("enabled", "defaults", "context"):
            if k in c["models"]:
                mm[k] = c["models"][k]
        cfg["models"] = mm
    await m.config.async_save()
    for uid in list(m.subscribers):
        m.emit(uid, {"type": "meta", "section": "all"})
    return _admin_view(m, await _users(hass))


@command(_t("admin/models_refresh") | {vol.Optional("key"): str}, admin=True)
async def ws_models_refresh(hass, conn, msg, m, user, st):
    key = msg.get("key") if msg.get("key") and msg.get("key") != MASK else m.key_for(user.id, st) or m.config.data.get("shared_key")
    if not key:
        raise ValueError("Zum Laden der Modelle wird ein Schlüssel gebraucht")
    models = await m.provider.list_models(key)
    known = []
    for x in models:
        known.append({"id": x.get("id"), "name": x.get("name") or x.get("id"), "input": x.get("input") or ["text"],
                      "output": x.get("output") or ["text"], "status": x.get("status") or "ready"})
    m.config.data.setdefault("models", {})["known"] = known
    if not m.config.data["models"].get("enabled"):
        m.config.data["models"]["enabled"] = [x["id"] for x in known if x["status"] != "unavailable"]
    await m.config.async_save()
    return _admin_view(m, await _users(hass))


def async_register(hass: HomeAssistant) -> None:
    for h in HANDLERS:
        websocket_api.async_register_command(hass, h)
