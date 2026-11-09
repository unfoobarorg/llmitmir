"""Notifications, skills, progress list and credential overview."""
from __future__ import annotations

from homeassistant.core import Context

from .. import credentials as C
from .. import notifydevices as ND
from .. import selfdoc
from .. import tasknotify as TN
from . import Tool, advance_progress, obj, register


async def notify(ctx, a: dict):
    devices = ND.apply_links(await ND.async_devices(ctx.hass), ctx.manager.config.data.get("notify_devices"))
    device = ND.resolve(ND.for_user(devices, ctx.user_id), ctx.user_id, ctx.store.meta["settings"])
    if not device:
        return ("Fehler: In den Einstellungen ist kein Gerät für Benachrichtigungen gewählt "
                "(oder deinem Benutzer ist in Home Assistant kein Gerät zugeordnet).")
    await ND.async_send(ctx.hass, device, str(a.get("titel") or "LLMitMir")[:120], str(a.get("text") or "")[:2000],
                        url=f"/llmitmir/chat/{ctx.chat_id}" if ctx.chat_id else "",
                        tag=f"llmitmir-{ctx.chat_id}" if ctx.chat_id else "",
                        context=Context(user_id=ctx.user.id))
    return {"ok": True, "an": device["name"]}


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
    if not a.get("schritte") and a.get("aktuell") is not None:
        cur = ctx.chat.get("progress") or []
        if not cur:
            return "Fehler: Es gibt noch keine Schrittliste – zuerst mit „schritte“ planen."
        try:
            n = int(a["aktuell"])
        except (TypeError, ValueError):
            return "Fehler: „aktuell“ ist die Nummer des Schritts (1, 2, …)."
        items = advance_progress(cur, n)
        await ctx.set_progress(items)
        return {"ok": True, "aktuell": items[n - 1]["text"] if 1 <= n <= len(items) else "alle erledigt"}
    items = []
    for x in a.get("schritte") or []:
        if isinstance(x, str):
            x = {"text": x}
        items.append({"text": str(x.get("text") or "")[:200],
                      "status": x.get("status") if x.get("status") in ("offen", "laeuft", "erledigt", "fehler") else "offen"})
    await ctx.set_progress(items)
    return {"ok": True, "schritte": len(items)}


async def task_result(ctx, a: dict):
    """What a scheduled run has to tell: nothing, a new result, or a question for the person."""
    if ctx.task is None:
        return "Fehler: „task_result“ gilt nur für geplante Aufgaben."
    art = str(a.get("art") or "").strip()
    if art not in TN.ARTS:
        return "Fehler: „art“ ist eines von " + ", ".join(TN.ARTS) + "."
    text = " ".join(str(a.get("text") or "").split())[:400]
    ctx.chat["result"] = {"art": art, "text": text}
    return {"ok": True, "art": art, "text": text}


async def credentials_list(ctx, a: dict):
    return C.describe_for_model(ctx.creds, ctx.allowed_creds) or "Keine Zugänge verfügbar."


async def llmitmir_info(ctx, a: dict):
    meta = ctx.store.meta
    if not a.get("teil"):
        return selfdoc.MANUAL + "\n\n" + selfdoc.overview(meta, ctx.allowed_skills, ctx.allowed_creds)
    found = selfdoc.find(meta, a.get("teil"), a.get("name"), ctx.allowed_skills)
    if not found:
        return (f"Fehler: {a.get('teil')} „{a.get('name') or ''}“ nicht gefunden.\n\n"
                + selfdoc.overview(meta, ctx.allowed_skills, ctx.allowed_creds))
    section, item = found
    scope = {"skills": "skill", "projects": "project"}.get(section)
    files = [f["name"] for f in await ctx.store.async_list_files(scope, item["id"])] if scope else None
    return selfdoc.detail(meta, section, item, files)


register(Tool("llmitmir_info", "llmitmir",
              "Wie LLMitMir funktioniert (Chats, Coworks, Projekte, geplante Aufgaben, Skills, Zugänge, Werkbank) und was die "
              "Person davon angelegt hat. Ohne Argumente: Handbuch und Bestand. Mit teil (skill/aufgabe/projekt) und name: "
              "alle Felder dieses Eintrags, z. B. den vollständigen Auftrag einer Aufgabe. Statt Websuche für alle Fragen zu LLMitMir.",
              obj({"teil": {"type": "string", "enum": ["skill", "aufgabe", "projekt"]}, "name": {"type": "string"}}),
              llmitmir_info, label="LLMitMir nachschlagen", icon="mdi:robot-outline"))
register(Tool("notify", "notify", "Schickt eine Push-Benachrichtigung an die Person (HA-App), z. B. mit dem Ergebnis einer Aufgabe.",
              obj({"titel": {"type": "string"}, "text": {"type": "string"}}, ["text"]), notify,
              write=True, label="Benachrichtigen", icon="mdi:bell-ring-outline"))
register(Tool("skill_load", "skills", "Lädt die vollständige Anleitung eines Skills. Vor der Arbeit an einem passenden Thema immer zuerst laden.",
              obj({"name": {"type": "string"}}, ["name"]), skill_load, label="Skill laden", icon="mdi:school-outline"))
register(Tool("skill_file", "skills", "Liest eine Datei, die zu einem Skill gehört.",
              obj({"name": {"type": "string"}, "datei": {"type": "string"}}, ["name", "datei"]), skill_file,
              label="Skill-Datei lesen", icon="mdi:file-document-outline"))
register(Tool("progress_update", "progress",
              "Sichtbare Schrittliste des Coworks. Zu Beginn mit „schritte“ planen (ganze Liste). Beim Übergang zum nächsten "
              "Schritt reicht „aktuell“ = Nummer des Schritts, an dem du jetzt arbeitest (die davor gelten als erledigt; "
              "Anzahl+1 = alle erledigt) – am besten im selben Zug wie das nächste Werkzeug. „schritte“ erneut schicken, "
              "um umzuplanen oder einen Schritt als fehler zu markieren.",
              obj({"schritte": {"type": "array", "items": {"type": "object", "properties": {
                  "text": {"type": "string"}, "status": {"type": "string", "enum": ["offen", "laeuft", "erledigt", "fehler"]}}}},
                   "aktuell": {"type": "integer", "description": "Nummer des Schritts, der jetzt läuft (1 = erster)"}}),
              progress_update, label="Fortschritt", icon="mdi:format-list-checks"))
register(Tool("task_result", "progress",
              "Ergebnis des Laufs für die Benachrichtigung festlegen (nur geplante Aufgaben): „nichts“ = nichts zu melden, "
              "„ergebnis“ = neues Ergebnis, „frage“ = die Person muss etwas entscheiden. Am Ende jedes Laufs einmal aufrufen, "
              "mit „text“ als einer Zeile, die man auf dem Handy lesen kann.",
              obj({"art": {"type": "string", "enum": list(TN.ARTS)},
                   "text": {"type": "string", "description": "eine Zeile für die Benachrichtigung"}}, ["art"]),
              task_result, label="Ergebnis melden", icon="mdi:bell-check-outline"))
register(Tool("credentials_list", "skills", "Listet die verfügbaren Zugänge (ohne Geheimnisse).", obj({}), credentials_list,
              label="Zugänge ansehen", icon="mdi:key-outline"))
