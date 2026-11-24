"""Websocket API for the LLMitMir panel. Every command is scoped to the calling HA user."""
from __future__ import annotations

import asyncio
import functools
import secrets
import time
from typing import Any

import aiohttp
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from . import voice as VO
from . import audit as AU
from . import policy as P
from . import skillcheck as SK
from . import connectors as CN
from . import dashboards as DB
from . import chatsearch as CS
from . import credcheck as CK
from . import credentials as C
from . import inbox as IB
from . import manage as M
from . import models as MS
from . import notifydevices as ND
from . import pricing as PR
from . import retention as RT
from . import subchats as SC
from . import providers as PV
from . import sharing as SH
from . import taskedit as TE
from . import speech as SP
from . import views as V
from .const import (DOMAIN, KEY_MODES, KEY_SHARED, KIND_CHAT, KIND_COWORK, KIND_TASK_RUN, KNOWN_CONTEXT, ORIGIN_DASHBOARD,
                    PRESETS, TASK_KEY_CHOICES, TASK_KEY_MODES, TASK_KEY_OWN, TILE_RUN_BUDGET, VERSION)
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
            m = hass.data.get(DOMAIN, {}).get("manager")
            if m is None:  # Eintrag entladen (Neuladen, Fehler beim Einrichten): klare Meldung statt KeyError
                connection.send_error(msg["id"], "not_loaded", "LLMitMir ist gerade nicht geladen")
                return
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
    """The last runs of a task as short chat records – for people the task is shared with (their own chat list does
    not hold the owner's runs). Runs are stored newest first."""
    out = []
    for cid in (task.get("runs") or [])[:10]:
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
    pend = t.get("pending_approval") or {}
    if pend:
        # ein geänderter Auftrag wartet auf die Bestätigung der Eigentümerin bzw. des Eigentümers (taskedit.py)
        out["pending_by_name"] = (names or {}).get(pend.get("by")) or ""
    if run_chats is not None:
        out["run_chats"] = run_chats
    return out


async def _names(m, user_ids) -> dict:
    """User id -> name, for everybody involved in a task (owner and people it is shared with)."""
    out = {}
    for uid in dict.fromkeys([u for u in user_ids if u]):
        out[uid] = await m.user_name(uid)
    return out


def _speech_view(m) -> dict:
    """Die feste Stimme des Roboters – nicht verfügbar, wenn der Admin sie ausgeschaltet hat (Panel nimmt dann HA/Browser)."""
    info = SP.info()
    on = SP.enabled(m.config.data)
    return dict(info, available=bool(info["available"] and on), disabled_by_admin=not on)


def _project_view(p: dict) -> dict:
    return dict(p)


async def _tasks_view(m, user) -> list[dict]:
    """Own tasks plus the ones other people shared with this person (marked with the owner's name)."""
    st = await m.user_store(user.id)
    shared = await m.shared_tasks(user.id)
    ids = [user.id] + [uid for uid, _ in shared]
    for t in st.meta["tasks"].values():
        ids += SH.users(t.get("share")) + [(t.get("pending_approval") or {}).get("by")]
    ids += [(t.get("pending_approval") or {}).get("by") for _uid, t in shared]
    names = await _names(m, ids)
    # own tasks: the panel finds their runs in the own chat list – no need to read run chats from disk here.
    # Tasks of dashboard tiles are not listed here at all (boards.view -> tile_tasks, short form).
    out = [_task_view(m, user.id, t, user.id, names) for t in st.meta["tasks"].values()
           if t.get("origin") != ORIGIN_DASHBOARD]
    for uid, t in shared:
        out.append(_task_view(m, user.id, t, uid, names, await _run_chats(await m.user_store(uid), t)))
    return out


async def _bootstrap(hass, m, user, st) -> dict:
    s = dict(st.meta["settings"])
    s["has_own_key"] = bool(s.pop("own_key", ""))
    # Lebensdauer der Chats und Coworks außerhalb von Projekten (ohne Angabe der Standard)
    s["retention_days"] = RT.user_days(st.meta["settings"])
    s["has_own_task_key"] = bool(s.pop("own_task_key", ""))
    # Benachrichtigungen auf der Startseite (inbox.py)
    s["inbox_mode"] = IB.clean_mode(st.meta["settings"].get("inbox_mode"))
    s["inbox_minutes"] = IB.minutes(st.meta["settings"])
    s["inbox_muted"] = IB.muted(st.meta["settings"])
    # Teilaufgaben: was gerade gilt (auch ohne eigene Wahl)
    s["sub_mode_effective"] = m.sub_mode(user.id)
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
        "credential_types": {k: {"label": v["label"], "fields": v["fields"], "secret": sorted(v["secret"]), "hint": v.get("hint", ""),
                                 "readonly": v.get("readonly", []), "labels": v.get("labels", {}),
                                 "obsolete": v.get("obsolete", []), "hidden": v.get("hidden", []),
                                 "placeholders": v.get("placeholders", {}), "services": v.get("services", {}),
                                 "service_fields": v.get("service_fields", {}),
                                 "default_services": v.get("default_services", [])}
                             for k, v in C.TYPES.items()},
        "tasks": await _tasks_view(m, user),
        # Dashboards, Kacheln und die Kurzform der Kachel-Aufgaben (boards.py)
        "boards": await m.boards.view(user) if m.boards else None,
        "inbox": IB.prune(st.meta.get("inbox"), now(), IB.minutes(st.meta["settings"])),
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
        # Die feste Stimme des Roboters (eigene Sprachausgabe, auf jedem Gerät gleich)
        "speech": _speech_view(m),
        # Lebensdauer: Standard (aus), Vorschlag beim Einschalten und Obergrenze für Projekt und Einstellungen
        "retention": {"default": RT.DEFAULT_DAYS, "suggest": RT.SUGGEST_DAYS, "max": RT.MAX_DAYS},
        "werkbank": {"configured": m.werkbank is not None},
        # Zugänge (policy.py): Arten, Tipps je Typ und ob der Admin zentrale Systemzugänge erlaubt
        "cred_policy": {"allow_central": M.allow_central(m), "scopes": P.SCOPE_LABELS, "tips": P.TYPE_TIPS,
                        "hint": P.GENERAL_HINT, "free_credentials": CN.free_allowed(m.config.data)},
        # Konnektoren (connectors.py): was der Admin vorbereitet hat – ohne die Anleitung für das Modell
        "connectors": [CN.public_view(k) for k in CN.enabled(m.config.data)],
    }


# ---------------------------------------------------------------- bootstrap / events
@command(_t("bootstrap"))
async def ws_bootstrap(hass, conn, msg, m, user, st):
    await m.ensure_models(user.id)
    return await _bootstrap(hass, m, user, st)


@websocket_api.websocket_command(_t("access"))
@callback
def ws_access(hass, conn, msg):
    m = hass.data.get(DOMAIN, {}).get("manager")
    if m is None:
        conn.send_result(msg["id"], {"allowed": False, "is_admin": conn.user.is_admin, "configured": False})
        return
    conn.send_result(msg["id"], {"allowed": m.allowed(conn.user), "is_admin": conn.user.is_admin,
                                 "configured": bool(m.config.data.get("provider", {}).get("base_url"))})


HANDLERS.append(ws_access)


@command(_t("subscribe"))
async def ws_subscribe(hass, conn, msg, m, user, st):
    """Ereignisse an dieses Fenster – je Verbindung und Person genau einmal.

    Vorher legte jeder Aufruf ein eigenes Abo an. Meldete sich dieselbe Seite ein zweites Mal an
    (Panel neu eingehängt, Einstellungen gespeichert, Neuverbindung), bekam sie jedes Textstück
    doppelt, dreifach oder achtfach: Die halbe Antwort stand mehrfach im Chat, bis die fertige
    Nachricht sie wieder zusammenzog."""
    subs = m.conn_subs(conn)
    entry = subs.get(user.id)
    if entry is None:
        entry = {"msg_ids": []}

        @callback
        def forward(event: dict) -> None:
            # die jüngste noch offene Anmeldung dieses Fensters bekommt die Ereignisse
            if entry["msg_ids"]:
                conn.send_message(websocket_api.event_message(entry["msg_ids"][-1], event))

        entry["unsub"] = m.subscribe(user.id, forward)
        subs[user.id] = entry
    entry["msg_ids"].append(msg["id"])

    @callback
    def drop() -> None:
        if msg["id"] in entry["msg_ids"]:
            entry["msg_ids"].remove(msg["id"])
        if not entry["msg_ids"] and subs.get(user.id) is entry:
            subs.pop(user.id, None)
            entry["unsub"]()
            m.drop_conn_subs(conn)

    conn.subscriptions[msg["id"]] = drop
    conn.send_result(msg["id"])
    return _NO_RESULT


def _inbox_view(st) -> list[dict]:
    """Die Karten, die die Startseite gerade zeigt (innerhalb der Anzeigedauer der Person)."""
    return IB.prune(st.meta.get("inbox"), now(), IB.minutes(st.meta["settings"]))


@command(_t("inbox/dismiss") | {vol.Optional("entry_id"): str, vol.Optional("chat_id"): str})
async def ws_inbox_dismiss(hass, conn, msg, m, user, st):
    """Eine Karte entfernen (Wischen bzw. „×“) – oder alle eines Chats."""
    nid, cid = msg.get("entry_id"), msg.get("chat_id")
    if not nid and not cid:
        raise ValueError("entry_id oder chat_id fehlt")
    st.meta["inbox"] = [e for e in st.meta.get("inbox") or []
                        if not ((nid and e.get("id") == nid) or (cid and e.get("chat_id") == cid))]
    await st.async_save_meta()
    items = _inbox_view(st)
    m.emit(user.id, {"type": "inbox", "items": items})
    return {"items": items}


@command(_t("inbox/clear"))
async def ws_inbox_clear(hass, conn, msg, m, user, st):
    """Alle Karten entfernen („Alle löschen“)."""
    st.meta["inbox"] = []
    await st.async_save_meta()
    m.emit(user.id, {"type": "inbox", "items": []})
    return {"items": []}


@command(_t("inbox/mute") | {vol.Required("chat_id"): str, vol.Optional("mute", default=True): bool})
async def ws_inbox_mute(hass, conn, msg, m, user, st):
    """Einen Quellchat stummschalten (Long Touch) oder wieder anschalten."""
    cid = msg["chat_id"]
    st.meta["settings"]["inbox_muted"] = IB.mute(IB.muted(st.meta["settings"]), cid, bool(msg.get("mute", True)))
    if msg.get("mute", True):
        st.meta["inbox"] = IB.drop_chat(st.meta.get("inbox"), cid)
    await st.async_save_meta()
    items = _inbox_view(st)
    m.emit(user.id, {"type": "inbox", "items": items})
    return {"items": items, "muted": IB.muted(st.meta["settings"])}


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
    # eine Teilaufgabe zeigt die Dateien ihres Hauptchats (gemeinsamer Arbeitsbereich)
    files = await cst.async_list_files("chat", SC.root_id(chat))
    return {"chat": chat, "files": files}


@command(_t("chat/sub_report") | {vol.Required("chat_id"): str})
async def ws_chat_sub_report(hass, conn, msg, m, user, st):
    """„Jetzt melden“: die aktuelle Zusammenfassung einer Teilaufgabe sofort an den Hauptchat schicken."""
    return await m.report_sub(user.id, msg["chat_id"])


@command(_t("chat/branch") | {vol.Required("chat_id"): str, vol.Required("message_id"): str})
async def ws_chat_branch(hass, conn, msg, m, user, st):
    """„Als Teilaufgabe weiterarbeiten“: aus einer Nachricht eine Teilaufgabe des Chats machen."""
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    root = await st.async_get_chat(SC.root_id(chat)) or chat
    src = next((x for x in chat.get("messages") or [] if x.get("id") == msg["message_id"]), None)
    text = SC.message_text(src).strip()
    if not text:
        raise ValueError("Diese Nachricht hat keinen Text")
    sub = await m.create_sub(user.id, root["id"], text, von=SC.VON_PERSON)
    return st.chat_summary(sub)


@command(_t("chat/create") | {vol.Optional("kind", default=KIND_CHAT): vol.In([KIND_CHAT, KIND_COWORK]),
                               vol.Optional("project_id"): vol.Any(str, None), vol.Optional("model"): vol.Any(str, None),
                               vol.Optional("tools"): vol.Any([str], None), vol.Optional("voice", default=False): bool})
async def ws_chat_create(hass, conn, msg, m, user, st):
    chat = await m.create_chat(user.id, msg["kind"], msg.get("project_id"), msg.get("model"), tools=msg.get("tools"),
                               voice=msg["voice"])
    return st.chat_summary(chat)


@command(_t("chat/update") | {vol.Required("chat_id"): str, vol.Optional("title"): str, vol.Optional("pinned"): bool,
                               vol.Optional("project_id"): vol.Any(str, None), vol.Optional("model"): str,
                               vol.Optional("tools"): vol.Any([str], None), vol.Optional("no_thinking"): bool,
                               vol.Optional("sub_melden"): bool})
async def ws_chat_update(hass, conn, msg, m, user, st):
    chat = await st.async_get_chat(msg["chat_id"])
    if not chat:
        raise ValueError("Chat nicht gefunden")
    if SC.is_sub(chat) and ("pinned" in msg or "project_id" in msg):
        raise ValueError("Eine Teilaufgabe gehört zu ihrem Hauptchat – anheften oder verschieben lässt sich nur der Hauptchat")
    for k in ("title", "pinned", "project_id", "model", "tools", "no_thinking"):
        if k in msg:
            chat[k] = msg[k][:120] if k == "title" else msg[k]
    if "sub_melden" in msg and chat.get("sub") is not None:
        chat["sub"]["melden"] = bool(msg["sub_melden"])  # „Ergebnisse an den Hauptchat melden“
    await st.async_save_chat(chat, keep_updated=True)  # moving/renaming does not make a chat "new"
    m.emit(user.id, {"type": "chat", "chat": st.chat_summary(chat)})
    if "project_id" in msg:
        # die Teilaufgaben ziehen mit ihrem Hauptchat um
        for sub_id in SC.children(st.meta["chats"], chat["id"]):
            sub = await st.async_get_chat(sub_id)
            if sub and sub.get("project_id") != chat.get("project_id"):
                sub["project_id"] = chat.get("project_id")
                await st.async_save_chat(sub, keep_updated=True)
                m.emit(user.id, {"type": "chat", "chat": st.chat_summary(sub)})
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


@command(_t("chat/search") | {vol.Required("text"): str, vol.Optional("limit", default=20): int})
async def ws_chat_search(hass, conn, msg, m, user, st):
    """Volltextsuche über die eigenen Chatnachrichten (Titel und Inhalt).

    Durchsucht werden die jüngsten Chats, höchstens ``chatsearch.MAX_CHATS``. Je Chat kommen höchstens
    drei Treffer mit einem Ausschnitt zurück – genug, um die Stelle wiederzuerkennen.
    """
    q = CS.clean_query(msg["text"])
    if len(q) < 2:
        return {"query": q, "chats": []}
    limit = max(1, min(int(msg.get("limit") or 20), 50))
    metas = sorted(st.meta["chats"].values(), key=lambda c: c.get("updated") or 0, reverse=True)
    loaded = []
    for meta in metas[:CS.MAX_CHATS]:
        chat = await st.async_get_chat(meta["id"])
        if chat:
            loaded.append(chat)
    return {"query": q, "chats": CS.rank(loaded, q)[:limit]}


@command(_t("chat/send") | {vol.Required("chat_id"): str, vol.Required("text"): str,
                             vol.Optional("attachments"): [str], vol.Optional("model"): str,
                             vol.Optional("tools"): vol.Any([str], None), vol.Optional("voice", default=False): bool,
                             vol.Optional("amend", default=False): bool})
async def ws_chat_send(hass, conn, msg, m, user, st):
    run_id = await m.send(user, msg["chat_id"], msg["text"], msg.get("attachments"), msg.get("model"), msg.get("tools"),
                          voice=msg["voice"], amend=msg["amend"])
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


@command(_t("permission/answer") | {vol.Required("permission_id"): str, vol.Required("decision"): vol.In(["once", "always", "lots", "deny", "skip"])})
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
        if m.is_external(p.get(k) or ""):
            raise ValueError("Externe Modelle lassen sich nicht als Standard eines Projekts festlegen – nur im Chat auswählen.")
    proj = dict(old, **{k: p[k] for k in keep if k in p}, id=pid, updated=now())
    # Das Kennzeichen „von LLMitMir angelegt“ (Projekt „Gespräche“) bleibt, auch wenn die Person das Projekt
    # umbenennt oder die Frist ändert – daran findet LLMitMir es beim nächsten Gespräch wieder.
    if old.get("auto"):
        proj["auto"] = old["auto"]
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
        if cid not in st.meta["chats"]:
            continue  # als Teilaufgabe mit ihrem Hauptchat schon gelöscht
        if c.get("project_id") == pid:
            if msg["delete_chats"]:
                # derselbe Weg wie beim Löschen von Hand: Lauf anhalten, Sandbox, Teilaufgaben und Karten mit weg
                await m.delete_chat(user.id, cid)
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


# ---------------------------------------------------------------- Konnektoren (connectors.py)
def _connector(m, cid: str) -> dict:
    k = CN.by_id(m.config.data, cid)
    if not k or not k.get("enabled", True):
        raise ValueError("Diesen Konnektor gibt es nicht (mehr).")
    return k


async def _connect(hass, m, user_id: str, st, k: dict, fields: dict) -> dict:
    existing = CN.connection_of(st.meta["credentials"], k["id"])
    name = existing["name"] if existing else CN.unique_name(st.meta["credentials"], k["name"])
    cred = await M.save_credential(m, user_id, st, CN.connection_raw(k, fields, existing, name), connector=k)
    if cred.get("type") != "other":
        hass.async_create_task(_check_one(m, st, user_id, cred["id"]))
    return cred


@command(_t("connector/connect") | {vol.Required("connector_id"): str, vol.Optional("fields"): dict})
async def ws_connector_connect(hass, conn, msg, m, user, st):
    """Konnektor mit den eigenen Anmeldedaten verbinden (oder sie erneuern) – feste Felder setzt der Konnektor."""
    k = _connector(m, msg["connector_id"])
    cred = await _connect(hass, m, user.id, st, k, msg.get("fields") or {})
    return mask_credential(cred, C.secret_fields(cred))


@command(_t("connector/flow_start") | {vol.Required("connector_id"): str})
async def ws_connector_flow_start(hass, conn, msg, m, user, st):
    """Nextcloud Login Flow v2: Anmeldeseite öffnen lassen, im Hintergrund auf das App-Passwort warten."""
    k = _connector(m, msg["connector_id"])
    if k["login"] != CN.LOGIN_NEXTCLOUD:
        raise ValueError("Dieser Konnektor wird mit einem Formular verbunden.")
    for fid in [f for f, x in m.flows.items() if now() - x["started"] > 3600]:
        m.flows.pop(fid, None)
    info = await CN.flow_start(m.session, CN.nextcloud_base(k["fixed"]["url"]))
    fid = new_id("f")
    m.flows[fid] = {"user": user.id, "connector_id": k["id"], "status": "waiting", "started": now()}
    hass.async_create_background_task(_flow_run(hass, m, user.id, fid, k, info), f"llmitmir login flow {fid}")
    return {"flow_id": fid, "login": info["login"]}


async def _flow_run(hass, m, user_id: str, fid: str, k: dict, info: dict) -> None:
    flow = m.flows[fid]
    try:
        while not CN.flow_expired(flow["started"]):
            await asyncio.sleep(CN.FLOW_INTERVAL)
            if flow.get("status") != "waiting":
                return  # abgebrochen
            try:
                res = await CN.flow_poll(m.session, info["endpoint"], info["token"])
            except (aiohttp.ClientError, asyncio.TimeoutError):
                continue  # kurz nicht erreichbar: weiter warten
            if res:
                st = await m.user_store(user_id)
                cred = await _connect(hass, m, user_id, st, k, res)
                flow.update(status="done", credential_id=cred["id"])
                break
        else:
            flow["status"] = "expired"
    except Exception as e:  # noqa: BLE001 - die Person soll den Grund sehen
        flow.update(status="error", error=f"{e}"[:300])
    m.emit(user_id, {"type": "connector_flow", "flow_id": fid, "status": flow["status"]})


@command(_t("connector/flow_status") | {vol.Required("flow_id"): str, vol.Optional("cancel"): bool})
async def ws_connector_flow_status(hass, conn, msg, m, user, st):
    flow = m.flows.get(msg["flow_id"])
    if not flow or flow["user"] != user.id:
        raise ValueError("Unbekannte Anmeldung")
    if msg.get("cancel") and flow["status"] == "waiting":
        flow["status"] = "cancelled"
    return {k: flow.get(k) for k in ("status", "error", "credential_id")}


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


@command(_t("credential/hosts") | {vol.Required("credential_id"): str, vol.Required("hosts"): [str]})
async def ws_cred_hosts(hass, conn, msg, m, user, st):
    """Nur die Liste „Erlaubte Server“ eines Zugangs ändern (Einstellungen → Erlaubte Server).

    Eigener Befehl statt credential/save: Der speichert den ganzen Zugang und würde Felder, die nicht mitgeschickt
    werden (Notiz), leeren. Die Server aus den Adressfeldern gelten immer und stehen hier nicht drin."""
    c = st.meta["credentials"].get(msg["credential_id"])
    if not c:
        raise ValueError("Zugang nicht gefunden")
    if C.is_gwdg(c):
        raise ValueError("Ein GWDG-Exchange-Zugang geht nur an die Server der GWDG – weitere lassen sich nicht erlauben.")
    auto = set(C.auto_hosts(c))
    c["hosts"] = [h for h in C.clean_hosts(msg["hosts"]) if h not in auto]
    c["updated"] = now()
    await st.async_save_meta()
    m.emit(user.id, {"type": "meta", "section": "credentials"})
    return mask_credential(c, C.secret_fields(c))


@command(_t("credential/diagnose") | {vol.Required("credential_id"): str})
async def ws_cred_diagnose(hass, conn, msg, m, user, st):
    """Zeigt, was der Exchange auf die einzelnen Anfragen antwortet – fuer die Fehlersuche."""
    cred = st.meta["credentials"].get(msg["credential_id"])
    if not cred:
        raise ValueError("Zugang nicht gefunden")
    from . import credcheck as CC

    async with aiohttp.ClientSession() as session:
        return await CC.ews_diagnose(session, cred)


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
    editor = old is not None and owner_id != user.id
    if not editor:
        ext = m.external_view(user.id)
        tm = t.get("model") or ""
        if (t.get("external_fallback") or PV.is_external(tm)) and not (ext["has_access"] and ext["consent"]):
            raise ValueError("Für externe Modelle braucht es eine Freigabe durch den Admin und deine Zustimmung (Einstellungen → Externe Modelle).")
        if m.is_external(tm) and not ext["consent"]:
            raise ValueError("Für externe Modelle fehlt noch deine Zustimmung (Einstellungen → Externe Modelle).")
        if m.is_external(tm) and not m.may_use_model(user.id, tm):
            raise ValueError("Dieses Modell ist für dich nicht freigegeben.")
    new_prompt = False
    if editor:
        # Jemand, mit dem die Aufgabe geteilt ist (taskedit.py): Name, Zeitplan, Benachrichtigung sofort; ein neuer
        # Auftrag erst nach Bestätigung; womit die Aufgabe läuft (Freigaben, Werkzeuge, Modell …) nie.
        changed = [k for k in TE.owner_only_changes(old, t) if k != "share"]
        if changed:
            raise PermissionError(TE.owner_only_error(changed))
        t = {k: v for k, v in t.items() if k != "share"}
        t.update({k: old.get(k) for k in TE.OWNER_ONLY if k != "share"})
        new_prompt = old.get("origin") != ORIGIN_DASHBOARD and TE.prompt_changed(old, t)
    if old is not None and old.get("origin") == ORIGIN_DASHBOARD:
        # a tile's task: the prompt is the tile's description, the sharing is the tile's – the rest may change here
        from homeassistant.util import dt as dt_util

        t = dict(t, prompt=old.get("prompt") or "", share=None)
        DB.check_interval(t.get("schedule") or old.get("schedule") or {}, dt_util.now())
        if t.get("enabled") and old.get("paused") == "unplaced":
            raise ValueError("Die Kachel liegt auf keinem Dashboard – platziere sie, dann läuft die Aufgabe wieder.")
    task = await M.save_task(m, owner_id, owner_st, t)
    if new_prompt:
        task["pending_approval"] = TE.pending(old, user.id, now())
        await owner_st.async_save_meta()
        await m.tell_owner_pending(owner_id, task, user.id)
    elif not editor and task.pop("pending_approval", None) is not None:
        await owner_st.async_save_meta()  # wer die Aufgabe besitzt und speichert, hat den neuen Auftrag gesehen
    if task.get("origin") == ORIGIN_DASHBOARD:
        await m.boards.emit_boards([owner_id])
        return m.boards.tile_task_row(owner_st, task)
    m.emit_task(owner_id, task)
    names = await _names(m, [owner_id, *SH.users(task.get("share")), (task.get("pending_approval") or {}).get("by")])
    return _task_view(m, user.id, task, owner_id, names, await _run_chats(owner_st, task))


@command(_t("task/approve") | {vol.Required("task_id"): str, vol.Required("approve"): bool})
async def ws_task_approve(hass, conn, msg, m, user, st):
    """Einen von jemand anderem geänderten Auftrag bestätigen (die Aufgabe läuft wieder) oder verwerfen."""
    owner_id, owner_st, task = await _task_for(m, user, msg["task_id"])
    if owner_id != user.id:
        raise PermissionError("Bestätigen kann nur, wem die Aufgabe gehört.")
    pend = task.pop("pending_approval", None)
    if not pend:
        raise ValueError("Es wartet keine Änderung auf Bestätigung.")
    if not msg["approve"]:
        task["prompt"] = pend.get("prompt_before") or task.get("prompt") or ""
        if task.get("origin") == ORIGIN_DASHBOARD and m.boards:
            await m.boards.restore_description(owner_id, task, pend)
    task["updated"] = now()
    await owner_st.async_save_meta()
    if task.get("origin") == ORIGIN_DASHBOARD and m.boards:
        await m.boards.emit_boards(await m.boards.audience(owner_id, (owner_st.meta["tiles"].get(task.get("tile_id") or "") or {}).get("share")))
        return m.boards.tile_task_row(owner_st, task)
    m.emit_task(owner_id, task)
    names = await _names(m, [owner_id, *SH.users(task.get("share")), (task.get("pending_approval") or {}).get("by")])
    return _task_view(m, user.id, task, owner_id, names, await _run_chats(owner_st, task))


@command(_t("task/delete") | {vol.Required("task_id"): str})
async def ws_task_delete(hass, conn, msg, m, user, st):
    owner_id, owner_st, _task = await _task_for(m, user, msg["task_id"], need_edit=True)
    if owner_id != user.id:
        raise PermissionError("Nur wer die Aufgabe angelegt hat, kann sie löschen.")
    if _task.get("origin") == ORIGIN_DASHBOARD:
        raise ValueError("Diese Aufgabe gehört zu einer Kachel – lösche die Kachel (Dashboards → Bearbeiten).")
    await M.delete_task(m, owner_id, owner_st, msg["task_id"])
    return {"ok": True}


@command(_t("task/run_now") | {vol.Required("task_id"): str})
async def ws_task_run(hass, conn, msg, m, user, st):
    owner_id, _owner_st, _task = await _task_for(m, user, msg["task_id"], need_edit=True)
    if _task.get("pending_approval"):
        raise PermissionError("Der Auftrag wurde geändert und wartet auf die Bestätigung der Eigentümerin bzw. des "
                              "Eigentümers – vorher läuft die Aufgabe nicht.")
    if _task.get("origin") == ORIGIN_DASHBOARD:
        return {"position": await m.boards.run_now(user, owner_id, _task.get("tile_id") or "")}
    pos = m.scheduler.enqueue(owner_id, msg["task_id"], "manuell")
    if owner_id != user.id:
        # The run belongs to the owner, but the person who started it should see it in their queue
        m.emit(user.id, {"type": "tasks_queue", "queue": m.scheduler.queue_info(user.id)})
    return {"position": pos}


@command(_t("task/runs") | {vol.Required("task_id"): str})
async def ws_task_runs(hass, conn, msg, m, user, st):
    """The last runs of a task (short chat records) – loaded when a tile's task is opened in „Geplant“."""
    _owner_id, owner_st, task = await _task_for(m, user, msg["task_id"])
    return {"runs": await _run_chats(owner_st, task)}


# ---------------------------------------------------------------- dashboards and tiles (boards.py)
def _keyed(msg: dict) -> tuple[str, str]:
    return DB.split_key(msg["key"])


@command(_t("dashboards/list"))
async def ws_dashboards_list(hass, conn, msg, m, user, st):
    return await m.boards.view(user)


@command(_t("dashboard/save") | {vol.Required("dashboard"): dict})
async def ws_dashboard_save(hass, conn, msg, m, user, st):
    return await m.boards.save_dashboard(user, msg["dashboard"])


@command(_t("dashboard/delete") | {vol.Required("key"): str})
async def ws_dashboard_delete(hass, conn, msg, m, user, st):
    owner, did = _keyed(msg)
    await m.boards.delete_dashboard(user, owner, did)
    return {"ok": True}


@command(_t("dashboard/share") | {vol.Required("key"): str, vol.Required("users"): [dict], vol.Optional("all"): vol.Any(None, dict)})
async def ws_dashboard_share(hass, conn, msg, m, user, st):
    owner, did = _keyed(msg)
    return await m.boards.share(user, "dashboard", owner, did, msg["users"], msg.get("all", "keep") if "all" in msg else "keep")


@command(_t("dashboard/place") | {vol.Required("key"): str, vol.Required("tile"): str})
async def ws_dashboard_place(hass, conn, msg, m, user, st):
    owner, did = _keyed(msg)
    tile_owner, tid = DB.split_key(msg["tile"])
    tile = await m.boards.tile(tile_owner, tid)
    if not tile or not m.boards.rights(tile_owner, tile, user.id)["view"]:
        raise PermissionError("Diese Kachel ist nicht für dich freigegeben.")
    return await m.boards.place(user, owner, did, tile_owner, tid)


@command(_t("tile/save") | {vol.Required("tile"): dict, vol.Optional("place"): vol.Any(None, str)})
async def ws_tile_save(hass, conn, msg, m, user, st):
    place = None
    if msg.get("place"):
        po, pd = DB.split_key(msg["place"])
        d = await m.boards.dashboard(po, pd)
        if not d or not m.boards.rights(po, d, user.id)["edit"]:
            raise PermissionError("Auf diesem Dashboard darfst du nichts ändern.")
        place = {"owner": po, "id": pd}
    return await m.boards.save_tile(user, msg["tile"], place)


@command(_t("tile/delete") | {vol.Required("key"): str})
async def ws_tile_delete(hass, conn, msg, m, user, st):
    owner, tid = _keyed(msg)
    await m.boards.delete_tile(user, owner, tid)
    return {"ok": True}


@command(_t("tile/share") | {vol.Required("key"): str, vol.Required("users"): [dict], vol.Optional("all"): vol.Any(None, dict)})
async def ws_tile_share(hass, conn, msg, m, user, st):
    owner, tid = _keyed(msg)
    return await m.boards.share(user, "tile", owner, tid, msg["users"], msg.get("all") if "all" in msg else "keep")


@command(_t("tile/notify") | {vol.Required("key"): str, vol.Required("on"): bool})
async def ws_tile_notify(hass, conn, msg, m, user, st):
    owner, tid = _keyed(msg)
    await m.boards.set_notify(user, owner, tid, msg["on"])
    return {"ok": True}


@command(_t("tile/data") | {vol.Required("keys"): [str]})
async def ws_tile_data(hass, conn, msg, m, user, st):
    """The last records of tiles this person may see (key -> record; missing or not visible: left out)."""
    from .boards import public_record

    out = {}
    for k in msg["keys"][:200]:
        try:
            owner, tid = DB.split_key(k)
        except ValueError:
            continue
        tile = await m.boards.tile(owner, tid)
        if tile and m.boards.rights(owner, tile, user.id)["view"]:
            out[k] = public_record(await m.boards.record(owner, tid))
    return {"records": out}


@command(_t("tile/run") | {vol.Required("key"): str})
async def ws_tile_run(hass, conn, msg, m, user, st):
    owner, tid = _keyed(msg)
    return {"position": await m.boards.run_now(user, owner, tid)}


@command(_t("tile/clear") | {vol.Required("key"): str})
async def ws_tile_clear(hass, conn, msg, m, user, st):
    owner, tid = _keyed(msg)
    await m.boards.clear_data(user, owner, tid)
    return {"ok": True}


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
    for k in ("model_chat", "model_agent", "model_sub"):
        if m.is_external(s.get(k) or ""):
            raise ValueError("Externe Modelle lassen sich nicht als Standard festlegen – nur im Chat oder bei einer Aufgabe auswählen.")
    for k in ("model_chat", "model_agent", "model_sub", "permissions", "chat_tools", "show_reasoning", "send_on_enter"):
        if k in s:
            cur[k] = s[k]
    if "voice_name" in s:
        # Rufname im Gespräch: darauf hört der Roboter, wenn länger nichts gesagt wurde
        cur["voice_name"] = VO.clean_name(s["voice_name"])
    if "retention_days" in s:
        # Lebensdauer der Chats und Coworks außerhalb von Projekten (0 = unbegrenzt)
        cur["retention_days"] = RT.clean_days(s["retention_days"])
    if "sub_mode" in s:
        # Teilaufgaben: aus, nur auf Wunsch oder automatisch (leer = Standard der Ansicht)
        if s["sub_mode"] not in (None, "", *SC.MODES):
            raise ValueError("Ungültige Einstellung für Teilaufgaben")
        cur["sub_mode"] = s["sub_mode"] or None
    if "permission_push" in s:
        # Wartende Freigaben aufs Handy melden, wenn kein Panel verbunden ist (Standard: an)
        cur["permission_push"] = bool(s["permission_push"])
    if "permission_timeout_min" in s:
        # 0 = ohne Antwort eine Stunde warten und dann ablehnen; sonst nach so vielen Minuten ohne die Aktion weitermachen
        try:
            mins = int(s["permission_timeout_min"] or 0)
        except (TypeError, ValueError):
            raise ValueError("Wartezeit muss eine Zahl in Minuten sein") from None
        cur["permission_timeout_min"] = max(0, min(mins, 1440))
    if "inbox_mode" in s:
        # Benachrichtigungen auf der Startseite: automatisch, immer oder aus
        cur["inbox_mode"] = IB.clean_mode(s["inbox_mode"])
    if "inbox_minutes" in s:
        # Anzeigedauer in Minuten, 0 = bleibt stehen, bis die Person sie entfernt
        cur["inbox_minutes"] = IB.clean_minutes(s["inbox_minutes"])
    if "inbox_muted" in s:
        cur["inbox_muted"] = [str(c) for c in (s["inbox_muted"] or []) if c][:200]
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
        allowed = m.task_key_info(user.id, st)["allowed"]
        if choice not in allowed:
            raise ValueError("Diese Auswahl ist nicht möglich – der Admin legt fest, welche Schlüssel geplante Aufgaben "
                             "nutzen dürfen")
        if choice == "own" and not cur.get("own_task_key") and choice != m.task_key_info(user.id, st)["choice"]:
            # Nur beim Wechsel auf "eigener Schluessel" verlangen. Wer im Modus "eigene Schluessel
            # verpflichtend" noch keinen hat, kann trotzdem speichern – die Oberflaeche warnt dann.
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
        "speech": {"enabled": SP.enabled(cfg), "installed": SP.available()},
        "werkbank": {"url": (cfg.get("werkbank") or {}).get("url", ""), "token": MASK if (cfg.get("werkbank") or {}).get("token") else ""},
        "users": [{"id": u.id, "name": u.name, "is_admin": u.is_admin, "is_active": u.is_active,
                   "view": (m.users[u.id].meta["settings"].get("view") if u.id in m.users else None),
                   "has_own_task_key": bool(u.id in m.users and m.users[u.id].meta["settings"].get("own_task_key")),
                   "has_own_key": bool(u.id in m.users and m.users[u.id].meta["settings"].get("own_key"))} for u in users],
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
        "dashboards": {"tile_budget": (cfg.get("dashboards") or {}).get("tile_budget", TILE_RUN_BUDGET),
                       "tile_parallel": m.boards.parallel() if m.boards else 1},
        "audit": {"retention_days": m.audit_retention()},
        "credentials_policy": {"allow_central": M.allow_central(m), "free_credentials": CN.free_allowed(cfg)},
        "connectors": cfg.get("connectors") or [],
        # zentrale Skills und Skill-Richtlinien (skillcheck.py) – nur in dieser Admin-Ansicht sichtbar
        "central_skills": cfg.get("central_skills") or [], "skill_policies": cfg.get("skill_policies") or [],
        "skill_presets": SK.PRESETS,
        "cred_scopes": _cred_scopes(m, users),
    }


def _cred_scopes(m, users) -> dict:
    """Je Person: wie viele Zugänge welcher Art sie hat (geladene Personen) – für den Überblick des Admins."""
    out = {}
    for u in users:
        st = m.users.get(u.id)
        if not st:
            continue
        counts = {s: 0 for s in P.SCOPES} | {"none": 0}
        for c in st.meta["credentials"].values():
            counts[c.get("scope") if c.get("scope") in P.SCOPES else "none"] += 1
        if any(counts.values()):
            out[u.id] = counts
    return out


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
    if cfg.get("task_key_mode") == TASK_KEY_OWN:
        # Eigene Schluessel verlangen heisst: kein zentraler Schluessel fuer Aufgaben mehr
        cfg["shared_task_key"] = ""
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
    if "speech" in c:
        cfg["speech"] = {"enabled": bool((c["speech"] or {}).get("enabled"))}
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
    if "dashboards" in c:
        dc = c["dashboards"] or {}
        try:
            budget = max(0, min(10_000, int(dc.get("tile_budget", TILE_RUN_BUDGET))))
            parallel = max(1, min(3, int(dc.get("tile_parallel", 1))))
        except (TypeError, ValueError):
            raise ValueError("Budget und gleichzeitige Läufe sind ganze Zahlen.") from None
        cfg["dashboards"] = {"tile_budget": budget, "tile_parallel": parallel}
    recheck = False
    if "central_skills" in c or "skill_policies" in c:
        before = SK.config_hash(cfg)
        if "central_skills" in c:
            cfg["central_skills"] = SK.clean_central(c["central_skills"])
        if "skill_policies" in c:
            cfg["skill_policies"] = SK.clean_policies(c["skill_policies"])
        recheck = SK.config_hash(cfg) != before
    if "credentials_policy" in c:
        cp = c["credentials_policy"] or {}
        cfg["credentials_policy"] = {"allow_central": bool(cp.get("allow_central")),
                                     "free_credentials": cp.get("free_credentials", True) is not False}
    if "connectors" in c:
        cfg["connectors"] = CN.clean(c["connectors"])
        for st_ in list(m.users.values()):  # verbundene Zugänge an geänderte feste Felder angleichen
            if CN.sync(st_.meta, cfg):
                await st_.async_save_meta()
    if "audit" in c:
        cfg["audit"] = {"retention_days": AU.clean_retention((c["audit"] or {}).get("retention_days"))}
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
    if recheck:  # Richtlinien oder zentrale Skills geändert: alle Skills neu prüfen (im Hintergrund)
        SK.start(m, SK.recheck_all(m), "llmitmir skill recheck")
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


# ---------------------------------------------------------------- Zugriffsprotokoll (nur Admins)
@command(_t("admin/audit") | {vol.Optional("filters"): dict, vol.Optional("limit"): int}, admin=True)
async def ws_admin_audit(hass, conn, msg, m, user, st):
    """Ereignisse des Zugriffsprotokolls (neueste zuerst) mit Übersicht – nur Metadaten, nie Inhalte."""
    res = await m.audit.async_query(msg.get("filters"), msg.get("limit") or AU.QUERY_MAX)
    ids = {e.get("user") for e in res["events"]} | {a.get("owner") for a in m.audit.agents.values()}
    agents = {e.get("agent") for e in res["events"]} | {e.get("parent") for e in res["events"]}
    res["agents"] = {k: v for k, v in m.audit.agents.items() if k in agents}
    res["names"] = await _names(m, [i for i in ids if i])
    res["retention_days"] = m.audit_retention()
    return res


@command(_t("admin/skill_checks"), admin=True)
async def ws_admin_skill_checks(hass, conn, msg, m, user, st):
    """Skills mit Befunden oder ausstehender Prüfung (alle Personen) – Name und Befund, nie der Text des Skills."""
    stores = await m.all_stores()
    names = await _names(m, list(stores))
    total = sum(len(s.meta["skills"]) for s in stores.values())
    return {"rows": SK.overview(stores, names), "total": total}


@command(_t("admin/skill_recheck"), admin=True)
async def ws_admin_skill_recheck(hass, conn, msg, m, user, st):
    """Alle Skills sofort neu prüfen (im Hintergrund)."""
    SK.start(m, SK.recheck_all(m, only_due=False), "llmitmir skill recheck")
    return {"started": True}


@command(_t("admin/audit_agents"), admin=True)
async def ws_admin_audit_agents(hass, conn, msg, m, user, st):
    """Verzeichnis aller Agenten mit erster/letzter Aktivität, Aufrufen und benutzten Zugängen."""
    await m.audit.async_flush()
    agents = sorted(m.audit.agents.values(), key=lambda a: a.get("last_seen") or 0, reverse=True)
    running = {r.agent_id for r in m.runs.values() if r.agent_id}
    names = await _names(m, [a.get("owner") for a in agents if a.get("owner")])
    return {"agents": agents, "names": names, "running": sorted(running), "retention_days": m.audit_retention()}


def async_register(hass: HomeAssistant) -> None:
    for h in HANDLERS:
        websocket_api.async_register_command(hass, h)
