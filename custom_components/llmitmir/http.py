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
from . import docpreview as DP
from . import speech as SP
from .const import DOMAIN, KIND_CHAT
from .storage import new_id, now, safe_name

_LOGGER = logging.getLogger(__name__)
MAX_UPLOAD = 40 * 1024 * 1024  # per request (part)
# claude.ai-Export: Grenzen fürs Entpacken (ZIP-Bombe); conversations.json kann bei viel Nutzung groß werden
EXPORT_MEMBER = 1024 * 1024 * 1024
EXPORT_TOTAL = 2 * 1024 * 1024 * 1024


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
    """Uploads for chats, projects, skills and the import. Files may arrive in parts (upload_id/last), because
    reverse proxies often limit request bodies to 1 MB and HA itself to 16 MB."""

    url = "/api/llmitmir/upload"
    name = "api:llmitmir:upload"

    async def post(self, request):
        hass, m, user, st = await self._user_store(request)
        reader = await request.multipart()
        fields: dict[str, str] = {}
        data, part_name = None, ""
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name == "file":
                data = await part.read(decode=False)
                part_name = part.filename or ""
                if len(data) > MAX_UPLOAD:
                    return self.json_message("Datei zu groß (max. 40 MB je Teil)", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            else:
                fields[part.name] = (await part.text()).strip()
        if data is None:
            return self.json_message("Keine Datei", HTTPStatus.BAD_REQUEST)
        scope, owner = fields.get("scope", "chat"), fields.get("owner", "")
        name = safe_name(fields.get("filename") or part_name or "datei")
        upload_id = re.sub(r"[^A-Za-z0-9_-]", "", fields.get("upload_id", ""))[:40]
        if upload_id:
            path = st.file_path("import", "chunks", f"{upload_id}.part")

            def _append(chunk=data):
                import os
                os.makedirs(os.path.dirname(path), exist_ok=True)
                if fields.get("index") == "0" and os.path.exists(path):
                    os.remove(path)
                with open(path, "ab") as fh:
                    fh.write(chunk)
                return os.path.getsize(path)

            size = await hass.async_add_executor_job(_append)
            if size > 400 * 1024 * 1024:
                await st.async_delete_file("import", "chunks", f"{upload_id}.part")
                return self.json_message("Datei zu groß (max. 400 MB)", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            if fields.get("last") != "1":
                return self.json({"ok": True, "partial": True, "received": size})
            data = await hass.async_add_executor_job(lambda: open(path, "rb").read())
            await st.async_delete_file("import", "chunks", f"{upload_id}.part")
        if scope == "import":
            res = await import_file(hass, m, user, st, name, data)
            m.emit(user.id, {"type": "meta", "section": "all"})
            return self.json(res)
        if scope == "chat" and (not owner or owner not in st.meta["chats"]):
            return self.json_message("Chat unbekannt", HTTPStatus.NOT_FOUND)
        if scope == "project" and owner not in st.meta["projects"]:
            return self.json_message("Projekt unbekannt", HTTPStatus.NOT_FOUND)
        if scope == "skill" and owner not in st.meta["skills"]:
            return self.json_message("Skill unbekannt", HTTPStatus.NOT_FOUND)
        if scope not in ("chat", "project", "skill"):
            return self.json_message("Unbekannter Bereich", HTTPStatus.BAD_REQUEST)
        return self.json({"files": [await st.async_write_file(scope, owner, name, data)]})


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
        return web.Response(body=data, content_type=ctype,
                            charset="utf-8" if ctype.startswith("text/") or ctype.endswith(("json", "xml")) else None,
                            headers=file_headers(name, ctype))


# Was der Browser nie selbst als Seite ausführen soll: HTML, SVG und XML aus Arbeitsbereichen stammen oft vom Modell
# oder aus dem Netz. Ausgeliefert vom Origin von Home Assistant könnte Skript darin an die Anmeldung der Person.
ACTIVE_TYPES = ("text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml", "text/javascript",
                "application/javascript")


def file_headers(name: str, ctype: str) -> dict:
    """Header für eine Datei aus dem Arbeitsbereich: nie als Seite ausführen, nie den Typ raten."""
    inline = ctype.startswith(("image/", "text/", "application/pdf")) and ctype not in ACTIVE_TYPES
    fname = safe_name(name).replace('"', "_")
    return {"Content-Disposition": f'{"inline" if inline else "attachment"}; filename="{fname}"',
            "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
            "Referrer-Policy": "no-referrer"}


def _preview(name: str, data: bytes, page: int) -> tuple[bytes, str, int]:
    """Vorschau als JPEG: eine PDF-Seite oder ein Bildformat, das der Browser nicht selbst darstellt (HEIC, TIFF)."""
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext == "pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(data)
        pages = len(pdf)
        page = max(1, min(page, pages))
        p = pdf[page - 1]
        w, h = p.get_size()
        scale = min(1800 / max(w, h), 3.0)
        pil = p.render(scale=scale).to_pil()
        buf = io.BytesIO()
        pil.convert("RGB").save(buf, "JPEG", quality=88)
        return buf.getvalue(), "image/jpeg", pages
    from PIL import Image

    try:
        import pillow_heif  # type: ignore

        pillow_heif.register_heif_opener()
    except ImportError:
        pass
    im = Image.open(io.BytesIO(data))
    im.thumbnail((2400, 2400))
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=88)
    return buf.getvalue(), "image/jpeg", 1


class PreviewView(_Base):
    """Vorschau fuer Dateien, die der Browser nicht selbst anzeigen kann: PDF-Seiten und HEIC/TIFF als JPEG.
    Die mobilen Apps stellen PDFs nicht dar – deshalb rendert Home Assistant die Seite und liefert ein Bild."""

    url = "/api/llmitmir/preview/{scope}/{owner}/{name:.+}"
    name = "api:llmitmir:preview"

    async def get(self, request, scope, owner, name):
        hass, m, user, st = await self._user_store(request)
        try:
            data = await st.async_read_file(scope, owner, name)
        except (FileNotFoundError, ValueError):
            return self.json_message("Nicht gefunden", HTTPStatus.NOT_FOUND)
        try:
            page = max(1, int(request.query.get("page", "1")))
        except ValueError:
            page = 1
        try:
            body, ctype, pages = await hass.async_add_executor_job(_preview, name, data, page)
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning("LLMitMir: Vorschau fuer %s fehlgeschlagen: %s", name, e)
            return self.json_message(f"Keine Vorschau möglich: {e}", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        return web.Response(body=body, content_type=ctype,
                            headers={"Cache-Control": "private, max-age=300", "X-LLMitMir-Pages": str(pages),
                                     "X-Content-Type-Options": "nosniff"})


class DocView(_Base):
    """Word- und Excel-Dateien als lesbares HTML – der Betrachter zeigt sie damit im Panel an,
    ohne dass die Person sie herunterladen und außerhalb von Home Assistant öffnen muss."""

    url = "/api/llmitmir/doc/{scope}/{owner}/{name:.+}"
    name = "api:llmitmir:doc"

    async def get(self, request, scope, owner, name):
        hass, m, user, st = await self._user_store(request)
        try:
            data = await st.async_read_file(scope, owner, name)
        except (FileNotFoundError, ValueError):
            return self.json_message("Nicht gefunden", HTTPStatus.NOT_FOUND)
        try:
            body = await hass.async_add_executor_job(DP.to_html, name, data)
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning("LLMitMir: Vorschau fuer %s fehlgeschlagen: %s", name, e)
            return self.json_message(f"Keine Vorschau möglich: {e}", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        if body is None:
            return self.json_message("Für diesen Dateityp gibt es keine Vorschau", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        # Der Ausschnitt ist reiner Text aus der Datei, bereits maskiert (docpreview) – kein Markup aus der Datei.
        return web.Response(text=body, content_type="text/html", charset="utf-8",
                            headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff",
                                     "Content-Security-Policy": "sandbox; default-src 'none'"})


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


class SpeakView(_Base):
    """Die feste Stimme des Roboters: Text hinein, MP3 heraus (dieselbe Stimme auf jedem Gerät)."""

    url = "/api/llmitmir/speak"
    name = "api:llmitmir:speak"

    async def post(self, request):
        hass, m, user, st = await self._user_store(request)
        try:
            body = await request.json()
        except ValueError:
            return self.json_message("Ungültige Anfrage", HTTPStatus.BAD_REQUEST)
        text = str(body.get("text") or "")
        lang = str(body.get("lang") or "de")
        voice = str(body.get("voice") or "")
        if not text.strip():
            return self.json_message("Kein Text", HTTPStatus.BAD_REQUEST)
        try:
            audio = await SP.synthesize(text, lang, voice)
        except ValueError as e:
            return self.json_message(str(e), HTTPStatus.BAD_REQUEST)
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning("LLMitMir: Sprachausgabe fehlgeschlagen: %s", e)
            return self.json_message(f"Sprachausgabe fehlgeschlagen: {e}", HTTPStatus.BAD_GATEWAY)
        return web.Response(body=audio, content_type="audio/mpeg",
                            headers={"Cache-Control": "private, max-age=600"})


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
        if not isinstance(bundle, dict):
            return self.json_message("Erwartet wird ein JSON-Objekt", HTTPStatus.BAD_REQUEST)
        # Einmal-Link: nach dem ersten Import ist er verbraucht (so steht es auch in der Anleitung für Claude)
        st.meta["import_tokens"].pop(token, None)
        hass.data[DOMAIN]["import_tokens"].pop(token, None)
        user = await hass.auth.async_get_user(uid)
        try:
            res = await import_bundle(hass, m, user, st, bundle)
        except ValueError as e:
            await st.async_save_meta()
            return self.json_message(f"Import nicht möglich: {e}", HTTPStatus.BAD_REQUEST)
        st.meta.setdefault("imports", []).insert(0, {"at": now(), "source": bundle.get("source", "claude"), "result": res})
        del st.meta["imports"][20:]
        await st.async_save_meta()
        m.emit(uid, {"type": "meta", "section": "all"})
        m.emit(uid, {"type": "import_done", "result": res})
        return self.json({"ok": True, "result": res})


def _by_name(items: dict, name: str) -> dict | None:
    low = str(name or "").strip().casefold()
    return next((x for x in items.values() if str(x.get("name", "")).casefold() == low), None)


def _ts(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        from datetime import datetime

        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


async def import_bundle(hass: HomeAssistant, m, user, st, b: dict, skip_existing: bool = False) -> dict:
    """Merge an import bundle into the user's data (by name). Imported tasks start disabled.
    skip_existing=True (data exports): items whose name already exists stay untouched."""
    if not isinstance(b, dict):
        raise ValueError("Der Import muss ein JSON-Objekt sein (mit credentials, skills, projects, tasks, chats …).")
    res = {"credentials": 0, "skills": 0, "projects": 0, "tasks": 0, "chats": 0, "files": 0, "skipped": 0, "warnings": []}

    def items(key: str) -> list[dict]:
        """Die Einträge einer Liste – alles, was kein Objekt ist, wird übersprungen und gemeldet."""
        raw = b.get(key) or []
        if not isinstance(raw, list):
            res["warnings"].append(f"„{key}“ ist keine Liste – übersprungen")
            return []
        good = [x for x in raw if isinstance(x, dict)]
        if len(good) != len(raw):
            res["warnings"].append(f"{len(raw) - len(good)} Einträge in „{key}“ sind keine Objekte – übersprungen")
        return good

    seen = set(st.meta.setdefault("imported_uuids", []))
    meta = st.meta
    if isinstance(b.get("memory"), str) and b["memory"].strip():
        sep = "\n\n" if meta.get("memory") else ""
        if b["memory"].strip() not in (meta.get("memory") or ""):
            meta["memory"] = ((meta.get("memory") or "") + sep + b["memory"].strip())[:20000]
            res["memory"] = True
    for c in items("credentials"):
        if not c.get("name"):
            continue
        typ = c.get("type") if c.get("type") in C.TYPES else "other"
        old = _by_name(meta["credentials"], c["name"])
        if old and skip_existing:
            res["skipped"] += 1
            continue
        cid = old["id"] if old else new_id("k")
        fields = {str(k): str(v) for k, v in (c.get("fields") or {}).items() if v not in (None, "")}
        svc = None
        if typ in ("gwdg", "ews"):  # Exchange: gewählte Dienste übernehmen, Adressen wie beim Speichern erzeugen
            known = C.TYPES[typ]["services"]
            svc = ([k for k in known if k in (c.get("services") or [])]
                   or list(C.TYPES[typ]["default_services"]))
            fields = C.normalize_fields(typ, fields, svc)
        meta["credentials"][cid] = {"id": cid, "name": c["name"][:80], "type": typ, "fields": fields,
                                    "notes": str(c.get("notes") or "")[:2000],
                                    "secret_fields": list(c.get("secret_fields") or []),
                                    "created": (old or {}).get("created", now()), "updated": now(), "imported": True}
        if svc is not None:
            acc = c.get("access") if isinstance(c.get("access"), dict) else {}
            meta["credentials"][cid]["services"] = svc
            meta["credentials"][cid]["access"] = {k: ("write" if acc.get(k) == "write" else "read") for k in svc}
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

    for s in items("skills"):
        if not s.get("name"):
            continue
        old = _by_name(meta["skills"], s["name"])
        if old and skip_existing:
            res["skipped"] += 1
            continue
        sid = old["id"] if old else new_id("s")
        meta["skills"][sid] = {"id": sid, "name": s["name"][:80], "description": str(s.get("description") or "")[:1024],
                               "body": str(s.get("body") or ""), "credentials": cred_ids(s.get("credentials")),
                               "enabled": True, "created": (old or {}).get("created", now()), "updated": now(), "imported": True}
        for f in s.get("files") or []:
            if f.get("name") and f.get("content") is not None:
                await st.async_write_file("skill", sid, f["name"], str(f["content"]).encode("utf-8"))
                res["files"] += 1
        res["skills"] += 1
    for p in items("projects"):
        if not p.get("name"):
            continue
        old = _by_name(meta["projects"], p["name"])
        if old and skip_existing:
            res["skipped"] += 1
            continue
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
    for t in items("tasks"):
        if not t.get("prompt"):
            continue
        old = _by_name(meta["tasks"], t.get("name") or "")
        if old and skip_existing:
            res["skipped"] += 1
            continue
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
                    # Freigaben bringt ein Import nie mit: Wer die Aufgabe einschaltet, legt selbst fest, was sie
                    # unbeaufsichtigt darf (und ob sie die Werkbank – also beliebige Befehle – nutzt).
                    allow_write=[], notify=t.get("notify") or "always", requires=[],
                    requires_note=str(t.get("requires_note") or "")[:1500],
                    updated=now(), imported=True, imported_note=str(t.get("note") or "")[:1500])
        dropped = [str(x) for x in (t.get("allow_write") or [])] + (["Werkbank"] if "werkbank" in (t.get("requires") or []) else [])
        if dropped:
            res["warnings"].append(f"Aufgabe „{task['name']}“: Freigaben nicht übernommen ({', '.join(dropped)}) – "
                                   "beim Einschalten selbst festlegen")
        meta["tasks"][tid] = task
        m.scheduler.plan(user.id, task)
        res["tasks"] += 1
    for c in items("chats"):
        if c.get("uuid") and c["uuid"] in seen:
            res["skipped"] += 1
            continue
        msgs = [{"id": new_id("m"), "role": "assistant" if x.get("role") in ("assistant", "bot") else "user",
                 "content": str(x.get("content") or ""), "created": _ts(x.get("created")) or now()}
                for x in c.get("messages") or [] if str(x.get("content") or "").strip()]
        if not msgs:
            continue
        proj = _by_name(meta["projects"], c.get("project") or "")
        chat = await m.create_chat(user.id, KIND_CHAT, proj["id"] if proj else None, title=str(c.get("title") or "Import")[:120])
        chat["messages"] = msgs
        chat["imported"] = True
        if c.get("uuid"):
            chat["source_uuid"] = c["uuid"]
        chat["created"] = _ts(c.get("created")) or msgs[0]["created"]
        chat["updated"] = _ts(c.get("updated")) or msgs[-1]["created"]
        await st.async_save_chat(chat, keep_updated=True)
        if c.get("uuid"):
            seen.add(c["uuid"])
        res["chats"] += 1
    st.meta["imported_uuids"] = sorted(seen)
    await st.async_save_meta()
    return res


def _message_text(x: dict) -> str:
    text = x.get("text") or ""
    if not text.strip():
        parts = []
        for p in x.get("content") or []:
            t = p.get("type")
            if t == "text":
                parts.append(p.get("text") or "")
            elif t == "tool_use":
                parts.append(f"_[Werkzeug: {p.get('name', '?')}]_")
            elif t == "image":
                parts.append("_[Bild]_")
        text = "\n\n".join(x for x in parts if x)
    names = [a.get("file_name") for a in (x.get("attachments") or []) if a.get("file_name")]
    names += [f.get("file_name") for f in (x.get("files") or []) if isinstance(f, dict) and f.get("file_name")]
    if names:
        text += "\n\n_Anhänge: " + ", ".join(names) + "_"
    return text.strip()


def _read_export(data: bytes) -> dict:
    """Read one ZIP of a claude.ai data export (old single-ZIP format or the newer multi-ZIP parts)."""
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    if sum(i.file_size for i in z.infolist()) > EXPORT_TOTAL:
        raise ValueError(f"entpackt größer als {EXPORT_TOTAL // 1073741824} GB")

    def read(n: str) -> bytes:
        return DP.zread(z, n, EXPORT_MEMBER)

    out: dict = {"convs": [], "projects": [], "memories": None, "routines": [], "pages": [], "found": []}
    for n in names:
        base = n.rsplit("/", 1)[-1]
        if base == "conversations.json":
            out["convs"] += json.loads(read(n)); out["found"].append("Chats")
        elif base == "projects.json":
            out["projects"] += json.loads(read(n)); out["found"].append("Projekte")
        elif re.match(r"(.*/)?projects/[^/]+\.json$", n):
            out["projects"].append(json.loads(read(n)))
        elif base == "memories.json":
            out["memories"] = json.loads(read(n)); out["found"].append("Erinnerungen")
        elif base == "routines.json":
            r = json.loads(read(n))
            out["routines"] += r.get("claude_code_cloud", []) if isinstance(r, dict) else r
            out["found"].append("Routinen")
        elif base == "artifact.json" and "/versions/" not in n:
            a = json.loads(read(n))
            if a.get("kind") == "page":
                page = n.rsplit("/", 1)[0] + "/page.md"
                if page in names:
                    v = next((x for x in a.get("versions") or [] if x.get("id") == a.get("active_version")), (a.get("versions") or [{}])[-1])
                    out["pages"].append({"uuid": a.get("id"), "title": v.get("title") or "Dokument",
                                         "created": v.get("created_at"), "updated": a.get("updated_at"),
                                         "content": read(page).decode("utf-8", "ignore")})
    if any(re.match(r"(.*/)?projects/[^/]+\.json$", n) for n in names):
        out["found"].append("Projekte")
    if out["pages"]:
        out["found"].append("Dokumente")
    return out


async def import_file(hass, m, user, st, name: str, data: bytes) -> dict:
    """One uploaded import file: LLMitMir JSON bundle, claude.ai export manifest (hint) or export ZIP part."""
    low = name.lower()
    if low.endswith(".json"):
        try:
            obj = json.loads(data)
        except ValueError:
            return {"error": f"{name}: kein gültiges JSON"}
        if not isinstance(obj, dict):
            return {"error": f"{name}: erwartet wird ein JSON-Objekt"}
        if "data_files" in obj:
            return {"error": "Das ist nur das Manifest des Exports. Lade bitte die ZIP-Dateien hoch "
                             "(conversations-000.zip, projects-000.zip, frames-000.zip, claude_code_cloud-000.zip …)."}
        try:
            res = await import_bundle(hass, m, user, st, obj)
        except ValueError as e:
            return {"error": f"{name}: {e}"}
        res["file"] = name
        return res
    try:
        ex = await hass.async_add_executor_job(_read_export, data)
    except (zipfile.BadZipFile, ValueError, KeyError) as e:
        return {"error": f"{name}: kein gültiger Claude-Export ({e})"}
    if not ex["found"]:
        return {"file": name, "info": "Nichts Übertragbares darin (z. B. Kontodaten)."}
    bundle: dict = {"source": "claude-export", "projects": [], "chats": [], "tasks": []}
    for p in ex["projects"]:
        if p.get("is_starter_project"):
            continue
        bundle["projects"].append({"name": p.get("name") or "Projekt", "description": p.get("description") or "",
                                   "instructions": p.get("prompt_template") or "",
                                   "files": [{"name": d.get("filename") or "dokument.txt", "content": d.get("content") or ""}
                                             for d in p.get("docs") or []]})
    for c in ex["convs"]:
        msgs = [{"role": "assistant" if x.get("sender") == "assistant" else "user", "content": _message_text(x),
                 "created": x.get("created_at")} for x in c.get("chat_messages") or []]
        bundle["chats"].append({"uuid": c.get("uuid"), "title": c.get("name") or "Import", "messages": msgs,
                                "created": c.get("created_at"), "updated": c.get("updated_at")})
    for pg in ex["pages"]:
        bundle["chats"].append({"uuid": pg["uuid"], "title": f"📄 {pg['title']}", "created": pg["created"], "updated": pg["updated"],
                                "messages": [{"role": "assistant", "content": pg["content"], "created": pg["created"]}]})
    for r in ex["routines"]:
        if r.get("ended_at") or r.get("prompt_withheld") or not r.get("prompt"):
            continue
        sched = r.get("schedule") or {}
        bundle["tasks"].append({"name": r.get("name"), "prompt": r["prompt"],
                                "schedule": {"type": "cron", "cron": sched["cron"]} if sched.get("cron") else
                                            {"type": "once", "at": sched.get("run_once_at") or ""},
                                "note": "Aus dem claude.ai-Export (Routine). Zugangsdaten im Auftrag ggf. unter Zugänge auslagern."})
    if isinstance(ex["memories"], list) and ex["memories"]:
        bundle["memory"] = "\n".join(str(x.get("conversations_memory") or x.get("content") or x) for x in ex["memories"])[:20000]
    elif isinstance(ex["memories"], dict):
        bundle["memory"] = str(ex["memories"].get("conversations_memory") or "")[:20000]
    res = await import_bundle(hass, m, user, st, bundle, skip_existing=True)
    res["file"], res["found"] = name, sorted(set(ex["found"]))
    return res


def async_register(hass: HomeAssistant) -> None:
    for view in (UploadView, FileView, PreviewView, DocView, TranscribeView, SpeakView, ImportView):
        hass.http.register_view(view())
