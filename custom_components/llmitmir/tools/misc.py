"""Notifications, skills, progress list and credential overview."""
from __future__ import annotations

from homeassistant.core import Context

from .. import credentials as C
from . import Tool, obj, register


async def notify(ctx, a: dict):
    target = ctx.store.meta["settings"].get("notify_service") or ""
    if not target:
        return "Fehler: In den Einstellungen ist kein Benachrichtigungsdienst gewählt."
    domain, _, service = target.partition(".")
    data = {"title": str(a.get("titel") or "LLMitMir")[:120], "message": str(a.get("text") or "")[:2000]}
    if ctx.chat_id:
        data["data"] = {"url": f"/llmitmir/chat/{ctx.chat_id}", "clickAction": f"/llmitmir/chat/{ctx.chat_id}",
                        "tag": f"llmitmir-{ctx.chat_id}"}
    await ctx.hass.services.async_call(domain or "notify", service, data, blocking=True,
                                       context=Context(user_id=ctx.user.id))
    return {"ok": True, "an": target}


def _skill(ctx, name: str) -> dict | None:
    low = str(name or "").casefold()
    for s in ctx.store.meta["skills"].values():
        if s.get("name", "").casefold() == low or s.get("id") == name:
            if ctx.allowed_skills is None or s["id"] in ctx.allowed_skills:
                return s
    return None


async def skill_load(ctx, a: dict):
    s = _skill(ctx, a.get("name"))
    if not s:
        return "Fehler: Skill nicht gefunden. Verfügbar: " + ", ".join(
            x["name"] for x in ctx.store.meta["skills"].values() if ctx.allowed_skills is None or x["id"] in ctx.allowed_skills)
    files = await ctx.store.async_list_files("skill", s["id"])
    creds = [ctx.creds[c]["name"] for c in s.get("credentials") or [] if c in ctx.creds]
    return (f"# Skill: {s['name']}\n{s.get('description', '')}\n\n{s.get('body', '')}\n\n"
            + (f"Zugänge für diesen Skill: {', '.join(creds)}\n" if creds else "")
            + (f"Dateien im Skill (mit skill_file lesen): {[f['name'] for f in files]}" if files else ""))


async def skill_file(ctx, a: dict):
    s = _skill(ctx, a.get("name"))
    if not s:
        return "Fehler: Skill nicht gefunden"
    try:
        data = await ctx.store.async_read_file("skill", s["id"], a.get("datei") or "")
    except FileNotFoundError:
        return "Fehler: Datei nicht im Skill"
    from .files import extract_document

    return await extract_document(ctx, a.get("datei") or "", data)


async def progress_update(ctx, a: dict):
    items = []
    for x in a.get("schritte") or []:
        if isinstance(x, str):
            x = {"text": x}
        items.append({"text": str(x.get("text") or "")[:200],
                      "status": x.get("status") if x.get("status") in ("offen", "laeuft", "erledigt", "fehler") else "offen"})
    await ctx.set_progress(items)
    return {"ok": True, "schritte": len(items)}


async def credentials_list(ctx, a: dict):
    return C.describe_for_model(ctx.creds, ctx.allowed_creds) or "Keine Zugänge verfügbar."


register(Tool("notify", "notify", "Schickt eine Push-Benachrichtigung an die Person (HA-App), z. B. mit dem Ergebnis einer Aufgabe.",
              obj({"titel": {"type": "string"}, "text": {"type": "string"}}, ["text"]), notify,
              write=True, label="Benachrichtigen", icon="mdi:bell-ring-outline"))
register(Tool("skill_load", "skills", "Lädt die vollständige Anleitung eines Skills. Vor der Arbeit an einem passenden Thema immer zuerst laden.",
              obj({"name": {"type": "string"}}, ["name"]), skill_load, label="Skill laden", icon="mdi:school-outline"))
register(Tool("skill_file", "skills", "Liest eine Datei, die zu einem Skill gehört.",
              obj({"name": {"type": "string"}, "datei": {"type": "string"}}, ["name", "datei"]), skill_file,
              label="Skill-Datei lesen", icon="mdi:file-document-outline"))
register(Tool("progress_update", "progress", "Aktualisiert die sichtbare Schrittliste des Coworks (ganze Liste schicken). Zu Beginn planen, dann Status pflegen.",
              obj({"schritte": {"type": "array", "items": {"type": "object", "properties": {
                  "text": {"type": "string"}, "status": {"type": "string", "enum": ["offen", "laeuft", "erledigt", "fehler"]}}}}},
                  ["schritte"]), progress_update, label="Fortschritt", icon="mdi:format-list-checks"))
register(Tool("credentials_list", "skills", "Listet die verfügbaren Zugänge (ohne Geheimnisse).", obj({}), credentials_list,
              label="Zugänge ansehen", icon="mdi:key-outline"))
