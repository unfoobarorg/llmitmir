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
from . import manage as M
from . import models as MS
from . import notifydevices as ND
from . import views as V
from .const import (DOMAIN, KEY_MODES, KEY_SHARED, KIND_CHAT, KIND_COWORK, KNOWN_CONTEXT, PRESETS, TASK_KEY_CHOICES,
                    TASK_KEY_MODES, VERSION)
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
    return m.models_for_users()


def _task_view(m, user_id: str, t: dict) -> dict:
    out = {k: v for k, v in t.items() if not k.startswith("_")}
    out["schedule_text"] = describe(t.get("schedule") or {})
    out["werkbank_missing"] = "werkbank" in (t.get("requires") or []) and m.werkbank is None
    return out


def _project_view(p: dict) -> dict:
    return dict(p)


async def _bootstrap(hass, m, user, st) -> dict:
    s = dict(st.meta["settings"])
    s["has_own_key"] = bool(s.pop("own_key", ""))
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
        "projects": list(st.meta["projects"].values()),
        "skills": list(st.meta["skills"].values()),
        "credentials": [mask_credential(c, C.secret_fields(c)) for c in st.meta["credentials"].values()],
        "credential_types": {k: {"label": v["label"], "fields": v["fields"], "secret": sorted(v["secret"]), "hint": v.get("hint", "")}
                             for k, v in C.TYPES.items()},
        "tasks": [_task_view(m, user.id, t) for t in st.meta["tasks"].values()],
        "chats": sorted(st.meta["chats"].values(), key=lambda c: c.get("updated") or 0, reverse=True),
        "models": _models_for_users(m),
        "defaults": m.defaults_view(user.id),
        "tool_groups": GROUPS,
        "tools": {n: {"group": t.group, "label": t.label, "icon": t.icon, "write": bool(t.write), "confirm": t.preview is not None}
                  for n, t in REGISTRY.items()},
        "usage": m.usage_snapshot(user.id),
        "queue": sched.queue_info(user.id) if sched else {},
        "runs": runs,
        "permissions": perms,
        "transcription": bool((m.config.data.get("provider") or {}).get("transcription_model")),
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
    await st.async_save_chat(chat, keep_updated=True)  # moving/renaming does not make a chat "new"
    m.emit(user.id, {"type": "chat", "chat": st.chat_summary(chat)})
    return st.chat_summary(chat)


async def _delete_chat(m, user, st, chat_id: str) -> None:
    """Stop a running chat, drop its sandbox and its files, then forget it."""
    m.stop(user.id, chat_id)
    if m.werkbank is not None:
        try:
            await m.werkbank.delete(chat_id)
        except Exception:  # noqa: BLE001 - sandbox may not exist
            pass
    await st.async_delete_chat(chat_id)
    m.emit(user.id, {"type": "chat_deleted", "chat_id": chat_id})


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
    return await M.save_skill(m, user.id, st, msg["skill"])


@command(_t("skill/delete") | {vol.Required("skill_id"): str})
async def ws_skill_delete(hass, conn, msg, m, user, st):
    await M.delete_skill(m, user.id, st, msg["skill_id"])
    return {"ok": True}


# ---------------------------------------------------------------- credentials
@command(_t("credential/save") | {vol.Required("credential"): dict})
async def ws_cred_save(hass, conn, msg, m, user, st):
    cred = await M.save_credential(m, user.id, st, msg["credential"])
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


# ---------------------------------------------------------------- tasks
@command(_t("task/save") | {vol.Required("task"): dict})
async def ws_task_save(hass, conn, msg, m, user, st):
    return _task_view(m, user.id, await M.save_task(m, user.id, st, msg["task"]))


@command(_t("task/delete") | {vol.Required("task_id"): str})
async def ws_task_delete(hass, conn, msg, m, user, st):
    await M.delete_task(m, user.id, st, msg["task_id"])
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
    for k in ("model_chat", "model_agent", "permissions", "chat_tools", "show_reasoning", "send_on_enter"):
        if k in s:
            cur[k] = s[k]
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
            "task_key_days": m.task_key_usage(tk)["days"] if tk else []}


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
    }


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
    if "models" in c:
        mm = dict(cfg.get("models") or {})
        for k in ("enabled", "defaults", "context", "auto_enable_new"):
            if k in c["models"]:
                mm[k] = c["models"][k]
        cfg["models"] = mm
    await m.config.async_save()
    for uid in list(m.subscribers):
        m.emit(uid, {"type": "meta", "section": "all"})
    return _admin_view(m, await _users(hass), await _devices(hass, m))


@command(_t("admin/models_refresh") | {vol.Optional("key"): str}, admin=True)
async def ws_models_refresh(hass, conn, msg, m, user, st):
    key = msg.get("key") if msg.get("key") and msg.get("key") != MASK else m.key_for(user.id, st) or m.config.data.get("shared_key")
    if not key:
        raise ValueError("Zum Laden der Modelle wird ein Schlüssel gebraucht")
    m._models_at = 0
    if not await m.refresh_models(key=key, max_age=0):
        raise ValueError("Modellliste konnte nicht geladen werden (Schlüssel und Basis-URL prüfen)")
    return _admin_view(m, await _users(hass))


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
