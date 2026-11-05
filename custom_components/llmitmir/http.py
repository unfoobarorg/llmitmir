"""HTTP views: uploads, downloads, speech transcription and the Claude import."""
from __future__ import annotations

import io
import json
import logging
import mimetypes
import re
import time
import zipfile
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from . import credentials as C
from .const import DOMAIN, KIND_CHAT
from .storage import new_id, now, safe_name

_LOGGER = logging.getLogger(__name__)
MAX_UPLOAD = 40 * 1024 * 1024


def _mgr(hass):
    return hass.data[DOMAIN]["manager"]


class _Base(HomeAssistantView):
    requires_auth = True

    async def _user_store(self, request):
        hass = request.app["hass"]
        user = request["hass_user"]
        m = _mgr(hass)
        if not m.allowed(user):
            raise web.HTTPForbidden(text="Kein Zugriff auf LLMitMir")
        return hass, m, user, await m.user_store(user.id)


class UploadView(_Base):
    url = "/api/llmitmir/upload"
    name = "api:llmitmir:upload"

    async def post(self, request):
        hass, m, user, st = await self._user_store(request)
        reader = await request.multipart()
        scope, owner, saved = "chat", "", []
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name == "scope":
                scope = (await part.text()).strip()
            elif part.name == "owner":
                owner = (await part.text()).strip()
            elif part.name == "file":
                data = await part.read(decode=False)
                if len(data) > MAX_UPLOAD:
                    return self.json_message("Datei zu groß (max. 40 MB)", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                name = safe_name(part.filename or "datei")
                if scope == "import":
                    if name.lower().endswith(".json"):
                        try:
                            bundle = json.loads(data)
                        except ValueError:
                            return self.json_message("Kein gültiges JSON", HTTPStatus.BAD_REQUEST)
                        res = await import_bundle(hass, m, user, st, bundle)
                        m.emit(user.id, {"type": "meta", "section": "all"})
                    else:
                        res = await import_claude_export(hass, m, user, st, data)
                    return self.json(res)
                if scope == "chat" and owner and owner not in st.meta["chats"]:
                    return self.json_message("Chat unbekannt", HTTPStatus.NOT_FOUND)
                if scope == "project" and owner not in st.meta["projects"]:
                    return self.json_message("Projekt unbekannt", HTTPStatus.NOT_FOUND)
                if scope == "skill" and owner not in st.meta["skills"]:
                    return self.json_message("Skill unbekannt", HTTPStatus.NOT_FOUND)
                if scope == "chat" and not owner:
                    return self.json_message("owner fehlt", HTTPStatus.BAD_REQUEST)
                saved.append(await st.async_write_file(scope, owner, name, data))
        return self.json({"files": saved})


class FileView(_Base):
    url = "/api/llmitmir/file/{scope}/{owner}/{name:.+}"
    name = "api:llmitmir:file"

    async def get(self, request, scope, owner, name):
        hass, m, user, st = await self._user_store(request)
        try:
            data = await st.async_read_file(scope, owner, name)
        except (FileNotFoundError, ValueError):
            return self.json_message("Nicht gefunden", HTTPStatus.NOT_FOUND)
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        disp = "inline" if ctype.startswith(("image/", "text/", "application/pdf")) else "attachment"
        return web.Response(body=data, content_type=ctype,
                            charset="utf-8" if ctype.startswith("text/") or ctype.endswith(("json", "xml")) else None,
                            headers={"Content-Disposition": f'{disp}; filename="{safe_name(name)}"',
                                     "Cache-Control": "private, max-age=60"})


class TranscribeView(_Base):
    url = "/api/llmitmir/transcribe"
    name = "api:llmitmir:transcribe"

    async def post(self, request):
        hass, m, user, st = await self._user_store(request)
        data = await request.read()
        if len(data) > 25 * 1024 * 1024:
            return self.json_message("Aufnahme zu lang", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        key = m.key_for(user.id, st)
        model = (m.config.data.get("provider") or {}).get("transcription_model") or "whisper-1"
        try:
            m.check_quota(user.id)
            text = await m.provider.transcribe(key, data, "aufnahme.wav", model, hass.config.language)
        except Exception as e:  # noqa: BLE001
            return self.json_message(f"Spracherkennung fehlgeschlagen: {e}", HTTPStatus.BAD_GATEWAY)
        st.add_usage(0, 0)
        m.emit(user.id, {"type": "usage", "usage": m.usage_snapshot(user.id)})
        return self.json({"text": text})


class ImportView(HomeAssistantView):
    """Receives the JSON bundle produced by the Claude import prompt (one-time token, no HA login)."""

    url = "/api/llmitmir/import/{token}"
    name = "api:llmitmir:import"
    requires_auth = False
    cors_allowed = True

    async def post(self, request, token):
        hass = request.app["hass"]
        m = _mgr(hass)
        uid = hass.data[DOMAIN]["import_tokens"].get(token)
        st = None
        if not uid:  # survive restarts: look the token up in the user stores
            for cand in list(m.users):
                if token in (m.users[cand].meta.get("import_tokens") or {}):
                    uid = cand
        if uid:
            st = await m.user_store(uid)
            info = st.meta["import_tokens"].get(token)
            if not info or info.get("expires", 0) < time.time():
                uid = None
        if not uid:
            return self.json_message("Ungültiger oder abgelaufener Import-Link", HTTPStatus.UNAUTHORIZED)
        if (request.content_length or 0) > 60 * 1024 * 1024:
            return self.json_message("Zu groß", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        try:
            bundle = await request.json()
        except ValueError:
            return self.json_message("Kein gültiges JSON", HTTPStatus.BAD_REQUEST)
        user = await hass.auth.async_get_user(uid)
        res = await import_bundle(hass, m, user, st, bundle)
        st.meta["import_tokens"][token]["used"] = now()
        st.meta.setdefault("imports", []).insert(0, {"at": now(), "source": bundle.get("source", "claude"), "result": res})
        await st.async_save_meta()
        m.emit(uid, {"type": "meta", "section": "all"})
        m.emit(uid, {"type": "import_done", "result": res})
        return self.json({"ok": True, "result": res})


def _by_name(items: dict, name: str) -> dict | None:
    low = str(name or "").strip().casefold()
    return next((x for x in items.values() if str(x.get("name", "")).casefold() == low), None)


async def import_bundle(hass: HomeAssistant, m, user, st, b: dict) -> dict:
    """Merge an import bundle into the user's data (by name). Imported tasks start disabled."""
    res = {"credentials": 0, "skills": 0, "projects": 0, "tasks": 0, "chats": 0, "files": 0, "warnings": []}
    meta = st.meta
    if isinstance(b.get("memory"), str) and b["memory"].strip():
        sep = "\n\n" if meta.get("memory") else ""
        if b["memory"].strip() not in (meta.get("memory") or ""):
            meta["memory"] = ((meta.get("memory") or "") + sep + b["memory"].strip())[:20000]
            res["memory"] = True
    for c in b.get("credentials") or []:
        if not c.get("name"):
            continue
        typ = c.get("type") if c.get("type") in C.TYPES else "other"
        old = _by_name(meta["credentials"], c["name"])
        cid = old["id"] if old else new_id("k")
        fields = {str(k): str(v) for k, v in (c.get("fields") or {}).items() if v not in (None, "")}
        meta["credentials"][cid] = {"id": cid, "name": c["name"][:80], "type": typ, "fields": fields,
                                    "notes": str(c.get("notes") or "")[:2000],
                                    "secret_fields": list(c.get("secret_fields") or []),
                                    "created": (old or {}).get("created", now()), "updated": now(), "imported": True}
        res["credentials"] += 1

    def cred_ids(names) -> list[str]:
        out = []
        for n in names or []:
            x = _by_name(meta["credentials"], n)
            if x:
                out.append(x["id"])
            else:
                res["warnings"].append(f"Zugang „{n}“ nicht gefunden")
        return out

    for s in b.get("skills") or []:
        if not s.get("name"):
            continue
        old = _by_name(meta["skills"], s["name"])
        sid = old["id"] if old else new_id("s")
        meta["skills"][sid] = {"id": sid, "name": s["name"][:80], "description": str(s.get("description") or "")[:1024],
                               "body": str(s.get("body") or ""), "credentials": cred_ids(s.get("credentials")),
                               "enabled": True, "created": (old or {}).get("created", now()), "updated": now(), "imported": True}
        for f in s.get("files") or []:
            if f.get("name") and f.get("content") is not None:
                await st.async_write_file("skill", sid, f["name"], str(f["content"]).encode("utf-8"))
                res["files"] += 1
        res["skills"] += 1
    for p in b.get("projects") or []:
        if not p.get("name"):
            continue
        old = _by_name(meta["projects"], p["name"])
        pid = old["id"] if old else new_id("p")
        skill_ids = [x["id"] for n in p.get("skills") or [] if (x := _by_name(meta["skills"], n))]
        meta["projects"][pid] = dict(old or {"created": now()}, id=pid, name=p["name"][:80],
                                     description=str(p.get("description") or "")[:500],
                                     instructions=str(p.get("instructions") or ""), credentials=cred_ids(p.get("credentials")),
                                     skills=skill_ids, updated=now(), imported=True)
        for f in p.get("files") or []:
            if f.get("name") and f.get("content") is not None:
                await st.async_write_file("project", pid, f["name"], str(f["content"]).encode("utf-8"))
                res["files"] += 1
        res["projects"] += 1
    for t in b.get("tasks") or []:
        if not t.get("prompt"):
            continue
        old = _by_name(meta["tasks"], t.get("name") or "")
        tid = old["id"] if old else new_id("t")
        sched = t.get("schedule") or {}
        if isinstance(sched, str):
            sched = {"type": "cron", "cron": re.sub(r"^CRON_TZ=\S+\s+", "", sched)}
        if sched.get("cron"):
            sched = {"type": "cron", "cron": re.sub(r"^CRON_TZ=\S+\s+", "", sched["cron"])}
        proj = _by_name(meta["projects"], t.get("project") or "")
        task = dict(old or {"created": now(), "runs": []}, id=tid, name=str(t.get("name") or "Aufgabe")[:100],
                    prompt=str(t["prompt"]), schedule=sched or {"type": "daily", "time": "08:00"},
                    project_id=proj["id"] if proj else None, model=None, enabled=False,
                    allow_write=list(t.get("allow_write") or []), notify=t.get("notify") or "always",
                    requires=[r for r in (t.get("requires") or []) if r in ("werkbank",)],
                    requires_note=str(t.get("requires_note") or "")[:1500],
                    updated=now(), imported=True, imported_note=str(t.get("note") or "")[:1500])
        meta["tasks"][tid] = task
        m.scheduler.plan(user.id, task)
        res["tasks"] += 1
    for c in b.get("chats") or []:
        msgs = [{"id": new_id("m"), "role": "assistant" if x.get("role") in ("assistant", "bot") else "user",
                 "content": str(x.get("content") or ""), "created": x.get("created") or now()}
                for x in c.get("messages") or [] if str(x.get("content") or "").strip()]
        if not msgs:
            continue
        proj = _by_name(meta["projects"], c.get("project") or "")
        chat = await m.create_chat(user.id, KIND_CHAT, proj["id"] if proj else None, title=str(c.get("title") or "Import")[:120])
        chat["messages"] = msgs
        chat["imported"] = True
        await st.async_save_chat(chat)
        res["chats"] += 1
    await st.async_save_meta()
    return res


async def import_claude_export(hass, m, user, st, data: bytes) -> dict:
    """Official claude.ai data export (ZIP with conversations.json, projects.json, memories)."""

    def _parse():
        z = zipfile.ZipFile(io.BytesIO(data))
        names = {n.rsplit("/", 1)[-1]: n for n in z.namelist()}
        load = lambda n: json.loads(z.read(names[n])) if n in names else None  # noqa: E731
        return load("conversations.json"), load("projects.json"), load("memories.json")

    try:
        convs, projs, mems = await hass.async_add_executor_job(_parse)
    except (zipfile.BadZipFile, ValueError, KeyError) as e:
        return {"error": f"Kein gültiger Claude-Export: {e}"}
    bundle: dict = {"source": "claude-export", "projects": [], "chats": []}
    proj_names = {}
    for p in projs or []:
        proj_names[p.get("uuid")] = p.get("name")
        bundle["projects"].append({"name": p.get("name") or "Projekt", "description": p.get("description") or "",
                                   "instructions": p.get("prompt_template") or "",
                                   "files": [{"name": d.get("filename") or "dokument.txt", "content": d.get("content") or ""}
                                             for d in p.get("docs") or []]})
    for c in convs or []:
        msgs = []
        for x in c.get("chat_messages") or []:
            text = x.get("text") or "\n".join(p.get("text", "") for p in x.get("content") or [] if p.get("type") == "text")
            msgs.append({"role": "assistant" if x.get("sender") == "assistant" else "user", "content": text,
                         "created": x.get("created_at")})
        bundle["chats"].append({"title": c.get("name") or "Import", "messages": msgs,
                                "project": proj_names.get((c.get("project") or {}).get("uuid") if isinstance(c.get("project"), dict) else c.get("project_uuid"))})
    if isinstance(mems, list) and mems:
        bundle["memory"] = "\n".join(str(x.get("conversations_memory") or x.get("content") or x) for x in mems)[:20000]
    elif isinstance(mems, dict):
        bundle["memory"] = str(mems.get("conversations_memory") or "")[:20000]
    res = await import_bundle(hass, m, user, st, bundle)
    m.emit(user.id, {"type": "meta", "section": "all"})
    return res


def async_register(hass: HomeAssistant) -> None:
    for view in (UploadView, FileView, TranscribeView, ImportView):
        hass.http.register_view(view())
