"""Notifications, skills, progress list and credential overview."""
from __future__ import annotations

from .. import credentials as C
from .. import inbox as IB
from .. import notifydevices as ND
from .. import selfdoc
from .. import skilltext as ST
from .. import tasknotify as TN
from ..storage import new_id, now
from . import Tool, advance_progress, obj, register


async def notify(ctx, a: dict):
    if ctx.task is not None:
        # in a scheduled task the person's setting decides what reaches the phone – never a second, direct push
        text = " ".join(str(a.get("text") or "").split())[:400]
        ctx.chat["result"] = {"art": "ergebnis", "text": text}
        return {"ok": True, "vorgemerkt": True,
                "hinweis": "In einer geplanten Aufgabe wird nichts direkt verschickt; der Text steht als Ergebnis fest."}
    devices = ND.apply_links(await ND.async_devices(ctx.hass), ctx.manager.config.data.get("notify_devices"))
    device = ND.resolve(ND.for_user(devices, ctx.user_id), ctx.user_id, ctx.store.meta["settings"])
    if not device:
        # Kein Push-Gerät (z. B. eine Umgebung ohne Benachrichtigungen): die Nachricht erscheint als Karte auf
        # der Startseite – sofern die Person das dort eingeschaltet hat und den Chat nicht stumm geschaltet hat.
        settings = ctx.store.meta["settings"]
        if ctx.chat_id and IB.enabled(settings, has_device=False) and ctx.chat_id not in IB.muted(settings):
            entry = {"id": new_id("n"), "chat_id": ctx.chat_id, "task_id": None, "task": "LLMitMir",
                     "title": str(a.get("titel") or "LLMitMir")[:120], "text": str(a.get("text") or "")[:600],
                     "status": "done"}
            ctx.store.meta["inbox"] = IB.add(ctx.store.meta.get("inbox"), entry, now())
            await ctx.store.async_save_meta()
            ctx.manager.emit(ctx.user_id, {"type": "inbox",
                                           "items": IB.prune(ctx.store.meta["inbox"], now(), IB.minutes(settings))})
            return {"ok": True, "auf_startseite": True,
                    "hinweis": "Kein Push-Gerät – die Nachricht steht auf der Startseite."}
        return ("Fehler: In den Einstellungen ist kein Gerät für Benachrichtigungen gewählt "
                "(oder deinem Benutzer ist in Home Assistant kein Gerät zugeordnet).")
    from homeassistant.core import Context  # nur hier nötig – so bleibt das Modul ohne HA importierbar

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
    body = str(s.get("body", ""))
    teil = ST.section(body, a.get("bereich")) if a.get("bereich") else body
    head = f"# Skill: {s['name']}\n{s.get('description', '')}\n\n"
    if a.get("bereich") and teil != body:
        head += (f"(Abschnitt „{a['bereich']}“ – die vollständige Anleitung holst du mit skill_load ohne bereich, "
                 f"{len(body)} Zeichen.)\n\n")
    return (head + teil + "\n\n"
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
register(Tool("notify", "notify", "Schickt eine Push-Benachrichtigung an die Person (HA-App). In einer geplanten Aufgabe "
              "verschickt es nichts, sondern merkt den Text als Ergebnis des Laufs vor.",
              obj({"titel": {"type": "string"}, "text": {"type": "string"}}, ["text"]), notify,
              write=True, label="Benachrichtigen", icon="mdi:bell-ring-outline"))
register(Tool("skill_load", "skills", "Lädt die vollständige Anleitung eines Skills (nie gekürzt). Vor der Arbeit an einem passenden Thema immer zuerst laden. Bei sehr langen Anleitungen holt bereich gezielt einen Abschnitt.",
              obj({"name": {"type": "string"},
                   "bereich": {"type": "string", "description": "optional: nur diesen Abschnitt (Überschrift oder Teil davon)"}},
                  ["name"]), skill_load, label="Skill laden", icon="mdi:school-outline", max_chars=0))
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
