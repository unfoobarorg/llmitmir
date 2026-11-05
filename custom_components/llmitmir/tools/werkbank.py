"""Werkbank tools: run commands in the chat's sandbox and move files between chat and sandbox."""
from __future__ import annotations

import posixpath

from .. import credentials as C
from . import Tool, obj, register


async def _session(ctx):
    wb = ctx.manager.werkbank
    if wb is None:
        raise PermissionError("Keine Werkbank eingerichtet (Admin → Werkbank).")
    if not getattr(ctx, "_wb_ready", False):
        info = await wb.session(ctx.chat_id)
        # first contact in this run: copy attachments and skill files into the sandbox
        if info.get("created") or not getattr(ctx, "_wb_synced", False):
            for f in await ctx.store.async_list_files("chat", ctx.chat_id):
                data = await ctx.store.async_read_file("chat", ctx.chat_id, f["name"])
                await wb.put(ctx.chat_id, f"/workspace/{f['name']}", data)
            for s in ctx.store.meta["skills"].values():
                if ctx.allowed_skills is not None and s["id"] not in ctx.allowed_skills:
                    continue
                for f in await ctx.store.async_list_files("skill", s["id"]):
                    data = await ctx.store.async_read_file("skill", s["id"], f["name"])
                    safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in s["name"])
                    await wb.put(ctx.chat_id, f"/workspace/skills/{safe}/{f['name']}", data)
            if ctx.project_id:
                for f in await ctx.store.async_list_files("project", ctx.project_id):
                    data = await ctx.store.async_read_file("project", ctx.project_id, f["name"])
                    await wb.put(ctx.chat_id, f"/workspace/projekt/{f['name']}", data)
            ctx._wb_synced = True
        ctx._wb_ready = True
    return wb


async def shell(ctx, a: dict):
    wb = await _session(ctx)
    cmd = C.resolve_placeholders(str(a.get("befehl") or ""), ctx.creds, ctx.allowed_creds)
    if not cmd.strip():
        return "Fehler: leerer Befehl"
    timeout = max(5, min(int(a.get("timeout_s") or 300), 3600))
    await ctx.manager._status(ctx.run, "tool", {"label": "Befehl läuft", "icon": "mdi:console"})
    r = await wb.exec(ctx.chat_id, cmd, timeout, a.get("ordner") or "/workspace")
    out = f"Exit-Code: {r.get('exit_code')}" + (" (Zeitlimit erreicht)" if r.get("timed_out") else "") + f" · {r.get('seconds')} s\n"
    if r.get("stdout"):
        out += f"--- stdout ---\n{r['stdout']}\n"
    if r.get("stderr"):
        out += f"--- stderr ---\n{r['stderr']}\n"
    if r.get("truncated"):
        out += "(Ausgabe gekürzt)\n"
    return out


async def files(ctx, a: dict):
    wb = await _session(ctx)
    r = await wb.list(ctx.chat_id, a.get("pfad") or "/workspace")
    items = [i for i in r.get("items", []) if "/.home" not in i["path"]][:500]
    return {"pfad": r.get("path"), "eintraege": items}


async def fetch(ctx, a: dict):
    wb = await _session(ctx)
    path = str(a.get("pfad") or "")
    data = await wb.get(ctx.chat_id, path if path.startswith("/") else f"/workspace/{path}")
    name = a.get("speichern_als") or posixpath.basename(path)
    info = await ctx.store.async_write_file("chat", ctx.chat_id, name, data)
    await ctx.emit_files()
    return {"ok": True, "im_arbeitsbereich": info["name"], "groesse": info["size"]}


async def push(ctx, a: dict):
    wb = await _session(ctx)
    src = str(a.get("name") or "")
    scope, owner = ("project", ctx.project_id) if a.get("bereich") == "projekt" else ("chat", ctx.chat_id)
    if not owner:
        return "Fehler: kein Projekt"
    data = await ctx.store.async_read_file(scope, owner, src)
    target = a.get("ziel") or f"/workspace/{posixpath.basename(src)}"
    return await wb.put(ctx.chat_id, target if target.startswith("/") else f"/workspace/{target}", data)


register(Tool("shell", "werkbank",
              "Führt einen Bash-Befehl in der Linux-Sandbox der Werkbank aus (Python 3.13 mit pandas, openpyxl, pypdf, faster-whisper …, "
              "ffmpeg, tesseract, pdftotext, ImageMagick, Node.js, curl, git, jq, sqlite3; Internet; pip install --user möglich). "
              "Arbeitsordner /workspace enthält die Anhänge, skills/<Name>/ die Skill-Dateien und projekt/ die Projektdateien. "
              "Geheimnisse nur über {{cred:Name:feld}}.",
              obj({"befehl": {"type": "string"}, "timeout_s": {"type": "integer", "description": "5–3600, Standard 300"},
                   "ordner": {"type": "string", "description": "Arbeitsverzeichnis, Standard /workspace"}}, ["befehl"]),
              shell, write=True, label="Befehl ausführen", icon="mdi:console"))
register(Tool("werkbank_files", "werkbank", "Listet Dateien in der Sandbox der Werkbank (Standard /workspace).",
              obj({"pfad": {"type": "string"}}), files, label="Werkbank-Dateien", icon="mdi:folder-cog-outline"))
register(Tool("werkbank_fetch", "werkbank", "Holt eine Datei aus der Sandbox in den Arbeitsbereich des Chats (zum Herunterladen oder Weiterverwenden).",
              obj({"pfad": {"type": "string"}, "speichern_als": {"type": "string"}}, ["pfad"]), fetch,
              label="Aus Werkbank holen", icon="mdi:tray-arrow-down"))
register(Tool("werkbank_push", "werkbank", "Kopiert eine Datei aus dem Arbeitsbereich oder dem Projekt in die Sandbox.",
              obj({"name": {"type": "string"}, "bereich": {"type": "string", "enum": ["arbeitsbereich", "projekt"]},
                   "ziel": {"type": "string"}}, ["name"]), push, label="In Werkbank kopieren", icon="mdi:tray-arrow-up"))
