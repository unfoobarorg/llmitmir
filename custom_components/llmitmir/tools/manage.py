"""Create, change and delete skills, scheduled tasks and credentials – each change approved by the person.

Every tool here has a `preview`: before it runs, the agent shows the exact change set (changes.py) in the chat and
waits for the person. There is no "always allow", and scheduled runs can never use these tools.
"""
from __future__ import annotations

from .. import changes as CH
from .. import credentials as C
from .. import manage as M
from .. import sharing as SH
from . import REGISTRY, Tool, obj, register


def _find(items: dict, name, allowed: set | None = None) -> dict | None:
    low = str(name or "").strip().casefold()
    for x in items.values():
        if (str(x.get("name") or "").casefold() == low or x.get("id") == name) and (allowed is None or x["id"] in allowed):
            return x
    return None


def _cred_ids(ctx, names) -> list[str]:
    out = []
    for n in names or []:
        c = C.find(ctx.creds, n)
        if not c:
            raise ValueError(f"Zugang „{n}“ gibt es nicht. Vorhanden: {', '.join(x['name'] for x in ctx.creds.values()) or 'keine'}")
        out.append(c["id"])
    return out


def _edit(text: str, edits, what: str) -> str:
    """Apply [{alt, neu}] replacements; each `alt` must occur exactly once."""
    for e in edits or []:
        alt, neu = str((e or {}).get("alt") or ""), str((e or {}).get("neu") or "")
        n = text.count(alt) if alt else 0
        if n != 1:
            raise ValueError(f"{what}: Textstelle „{alt[:80]}“ kommt {n}-mal vor (muss genau einmal vorkommen).")
        text = text.replace(alt, neu)
    return text


def _req_name(a: dict) -> str:
    name = str(a.get("name") or "").strip()
    if not name:
        raise ValueError("name fehlt")
    return name


# ------------------------------------------------------------------ skills
def _skill_plan(ctx, a: dict) -> tuple[dict | None, dict]:
    name = _req_name(a)
    old = _find(ctx.store.meta["skills"], name, ctx.allowed_skills)
    if old is None and _find(ctx.store.meta["skills"], name) is not None:
        raise ValueError(f"Skill „{name}“ ist in diesem Projekt nicht freigegeben.")
    cur = old or {}
    if old is None and not str(a.get("anleitung") or "").strip():
        raise ValueError("Für einen neuen Skill braucht es „anleitung“ (und am besten „beschreibung“).")
    body = str(a["anleitung"]) if a.get("anleitung") is not None else cur.get("body") or ""
    body = _edit(body, a.get("anleitung_ersetzen"), "anleitung_ersetzen")
    new_name = str(a.get("neuer_name") or "").strip() or (cur.get("name") or name)
    other = _find(ctx.store.meta["skills"], new_name)
    if other is not None and other is not old:
        raise ValueError(f"Es gibt schon einen Skill „{new_name}“.")
    new = {"id": cur.get("id"), "name": new_name[:80],
           "description": str(a["beschreibung"] if a.get("beschreibung") is not None else cur.get("description") or "")[:1024],
           "body": body,
           "credentials": _cred_ids(ctx, a["zugaenge"]) if a.get("zugaenge") is not None else list(cur.get("credentials") or []),
           "enabled": bool(a["aktiv"]) if a.get("aktiv") is not None else cur.get("enabled", True)}
    return old, new


async def skill_save_preview(ctx, a: dict) -> dict:
    old, new = _skill_plan(ctx, a)
    ch = CH.build("skill", new["name"], CH.skill_fields(old, ctx.store.meta), CH.skill_fields(new, ctx.store.meta))
    if not ch["felder"]:
        raise ValueError("Keine Änderung – der Skill ist schon so.")
    return ch


async def skill_save(ctx, a: dict):
    ch = await skill_save_preview(ctx, a)
    _, new = _skill_plan(ctx, a)
    await M.save_skill(ctx.manager, ctx.user_id, ctx.store, new)
    return CH.summary(ch)


async def skill_delete_preview(ctx, a: dict) -> dict:
    old = _find(ctx.store.meta["skills"], _req_name(a), ctx.allowed_skills)
    if not old:
        raise ValueError(f"Skill „{a.get('name')}“ nicht gefunden.")
    return CH.build("skill", old["name"], CH.skill_fields(old, ctx.store.meta), [])


async def skill_delete(ctx, a: dict):
    ch = await skill_delete_preview(ctx, a)
    await M.delete_skill(ctx.manager, ctx.user_id, ctx.store, _find(ctx.store.meta["skills"], a.get("name"))["id"])
    return CH.summary(ch)


# ------------------------------------------------------------------ scheduled tasks
async def _share_users(ctx, a: dict) -> list[dict] | None:
    """Resolve the people a task is shared with (by name) to user ids; None = leave the sharing as it is."""
    if a.get("teilen") is None:
        return None
    allowed = {u.id: u.name for u in await ctx.manager.hass.auth.async_get_users()
               if not u.system_generated and u.id != ctx.user_id and ctx.manager.allowed(u)}
    out = []
    for entry in a["teilen"] or []:
        if isinstance(entry, str):
            entry = {"person": entry}
        want = str((entry or {}).get("person") or "").strip()
        uid = next((i for i, n in allowed.items() if n.casefold() == want.casefold() or i == want), None)
        if not uid:
            raise ValueError(f"Person „{want}“ nicht gefunden. Möglich: " + (", ".join(sorted(allowed.values())) or "niemand"))
        out.append({"user_id": uid, "edit": bool(entry.get("bearbeiten")), "notify": bool(entry.get("benachrichtigen"))})
    return out


def _task_plan(ctx, a: dict) -> tuple[dict | None, dict]:
    name = _req_name(a)
    old = _find(ctx.store.meta["tasks"], name)
    cur = old or {}
    prompt = str(a["auftrag"]) if a.get("auftrag") is not None else cur.get("prompt") or ""
    prompt = _edit(prompt, a.get("auftrag_ersetzen"), "auftrag_ersetzen")
    if old is None and not a.get("zeitplan"):
        raise ValueError("Für eine neue Aufgabe braucht es „zeitplan“.")
    project_id = cur.get("project_id")
    if a.get("projekt") is not None:
        project_id = None
        if str(a["projekt"]).strip():
            p = _find(ctx.store.meta["projects"], a["projekt"])
            if not p:
                raise ValueError(f"Projekt „{a['projekt']}“ gibt es nicht.")
            project_id = p["id"]
    perms = list(cur.get("allow_write") or [])
    if a.get("freigaben") is not None:
        perms = [str(x) for x in a["freigaben"]]
        bad = [x for x in perms if x not in REGISTRY or not REGISTRY[x].write or REGISTRY[x].preview]
        if bad:
            raise ValueError(f"Nicht als Freigabe möglich: {', '.join(bad)}. Möglich: "
                             + ", ".join(sorted(n for n, t in REGISTRY.items() if t.write and not t.preview)))
    requires = list(cur.get("requires") or [])
    if a.get("braucht_werkbank") is not None:
        requires = ["werkbank"] if a["braucht_werkbank"] else []
    new_name = str(a.get("neuer_name") or "").strip() or (cur.get("name") or name)
    other = _find(ctx.store.meta["tasks"], new_name)
    if other is not None and other is not old:
        raise ValueError(f"Es gibt schon eine Aufgabe „{new_name}“.")
    notify = a.get("benachrichtigen") or cur.get("notify") or "always"
    if notify not in CH.NOTIFY:
        raise ValueError(f"benachrichtigen: eines von {', '.join(CH.NOTIFY)}")
    raw = {"id": cur.get("id"), "name": new_name, "prompt": prompt, "project_id": project_id,
           "model": (a["modell"] or None) if a.get("modell") is not None else cur.get("model"),
           "schedule": a.get("zeitplan") or cur.get("schedule"),
           "enabled": bool(a["aktiv"]) if a.get("aktiv") is not None else cur.get("enabled", True),
           "allow_write": perms, "tool_groups": cur.get("tool_groups"), "notify": notify, "requires": requires,
           "requires_note": cur.get("requires_note") or ""}
    if a.get("_share_users") is not None:
        raw["share"] = {"users": a["_share_users"]}
    try:
        new = M.build_task(ctx.store, raw)
    except (ValueError, TypeError) as e:
        raise ValueError(f"Ungültige Aufgabe: {e}") from e
    return old, new


async def task_save_preview(ctx, a: dict) -> dict:
    a = dict(a, _share_users=await _share_users(ctx, a))
    names = {u["user_id"]: u["name"] for u in (a["_share_users"] or [])}
    old, new = _task_plan(ctx, a)
    names.update({uid: await ctx.manager.user_name(uid) for uid in SH.users((old or {}).get("share"))})
    meta = {"user_names": names}
    ch = CH.build("aufgabe", new["name"], CH.task_fields(old, meta), CH.task_fields(new, meta))
    if not ch["felder"]:
        raise ValueError("Keine Änderung – die Aufgabe ist schon so.")
    return ch


async def task_save(ctx, a: dict):
    ch = await task_save_preview(ctx, a)
    _, new = _task_plan(ctx, dict(a, _share_users=await _share_users(ctx, a)))
    await M.save_task(ctx.manager, ctx.user_id, ctx.store, new)
    return CH.summary(ch)


async def task_delete_preview(ctx, a: dict) -> dict:
    old = _find(ctx.store.meta["tasks"], _req_name(a))
    if not old:
        raise ValueError(f"Aufgabe „{a.get('name')}“ nicht gefunden.")
    return CH.build("aufgabe", old["name"], CH.task_fields(old, ctx.store.meta), [])


async def task_delete(ctx, a: dict):
    ch = await task_delete_preview(ctx, a)
    await M.delete_task(ctx.manager, ctx.user_id, ctx.store, _find(ctx.store.meta["tasks"], a.get("name"))["id"])
    return CH.summary(ch)


# ------------------------------------------------------------------ credentials
def _cred_plan(ctx, a: dict) -> tuple[dict | None, dict]:
    name = _req_name(a)
    old = _find(ctx.creds, name, ctx.allowed_creds)
    if old is None and _find(ctx.creds, name) is not None:
        raise ValueError(f"Zugang „{name}“ ist in diesem Projekt nicht freigegeben.")
    if old is None and not a.get("typ"):
        raise ValueError(f"Für einen neuen Zugang braucht es „typ“ ({', '.join(C.TYPES)}).")
    fields = {str(k): str(v) for k, v in (a.get("felder") or {}).items() if v is not None}
    raw = {"id": (old or {}).get("id"), "name": str(a.get("neuer_name") or "").strip() or (old or {}).get("name") or name,
           "type": a.get("typ") or (old or {}).get("type"), "fields": fields,
           "remove_fields": list(a.get("felder_entfernen") or []),
           "valid_until": a["gueltig_bis"] if a.get("gueltig_bis") is not None else (old or {}).get("valid_until") or "",
           "notes": a["notiz"] if a.get("notiz") is not None else (old or {}).get("notes") or ""}
    new = M.build_credential(ctx.store, raw)
    return old, new


async def credential_save_preview(ctx, a: dict) -> dict:
    old, new = _cred_plan(ctx, a)
    sec = C.secret_fields(new)
    ch = CH.build("zugang", new["name"], CH.credential_fields(old, C.secret_fields(old) if old else set()),
                  CH.credential_fields(new, sec, old if old else None))
    if not ch["felder"]:
        raise ValueError("Keine Änderung – der Zugang ist schon so.")
    return ch


async def credential_save(ctx, a: dict):
    ch = await credential_save_preview(ctx, a)
    _, new = _cred_plan(ctx, a)
    await M.save_credential(ctx.manager, ctx.user_id, ctx.store, new)
    ctx.refresh_secrets()
    return CH.summary(ch)


async def credential_delete_preview(ctx, a: dict) -> dict:
    old = _find(ctx.creds, _req_name(a), ctx.allowed_creds)
    if not old:
        raise ValueError(f"Zugang „{a.get('name')}“ nicht gefunden.")
    used = [s["name"] for s in ctx.store.meta["skills"].values() if old["id"] in (s.get("credentials") or [])]
    ch = CH.build("zugang", old["name"], CH.credential_fields(old, C.secret_fields(old)), [])
    if used:
        ch["hinweis"] = f"Wird noch genutzt von: {', '.join(used)}"
    return ch


async def credential_delete(ctx, a: dict):
    ch = await credential_delete_preview(ctx, a)
    await M.delete_credential(ctx.manager, ctx.user_id, ctx.store, _find(ctx.creds, a.get("name"))["id"])
    return CH.summary(ch)


def redact_credential_args(ctx, args: dict) -> dict:
    """Secret field values never land in the stored step or the approval card."""
    if not isinstance(args.get("felder"), dict):
        return args
    old = _find(ctx.creds, args.get("name")) or {}
    sec = C.secret_fields({"type": args.get("typ") or old.get("type"), "secret_fields": old.get("secret_fields")})
    return dict(args, felder={k: (CH.SECRET if k in sec and v else v) for k, v in args["felder"].items()})


# ------------------------------------------------------------------ registration
_EDITS = {"type": "array", "items": {"type": "object", "properties": {"alt": {"type": "string"}, "neu": {"type": "string"}},
                                     "required": ["alt", "neu"]}}
_SCHEDULE = {"type": "object", "description":
             "type: daily|weekdays|weekly|monthly|hourly|interval|once|cron; time \"HH:MM\" (daily, weekdays, weekly, "
             "monthly, interval); days [0–6, 0 = Sonntag] (weekly); day 1–31 (monthly); minute (hourly); hours 1–23 "
             "(interval); at \"YYYY-MM-DDTHH:MM\" (once); cron \"Minute Stunde Tag Monat Wochentag\" (cron). Ortszeit.",
             "properties": {"type": {"type": "string", "enum": ["daily", "weekdays", "weekly", "monthly", "hourly", "interval",
                                                                "once", "cron"]},
                            "time": {"type": "string"}, "days": {"type": "array", "items": {"type": "integer"}},
                            "day": {"type": "integer"}, "minute": {"type": "integer"}, "hours": {"type": "integer"},
                            "at": {"type": "string"}, "cron": {"type": "string"}}, "required": ["type"]}
_ASK = " Die Person sieht die Änderung und muss sie bestätigen."

register(Tool("skill_save", "llmitmir",
              "Legt einen Skill an oder ändert ihn (gefunden über name). Nicht angegebene Felder bleiben, wie sie sind. "
              "Für kleine Änderungen an einer langen Anleitung anleitung_ersetzen statt der ganzen anleitung." + _ASK,
              obj({"name": {"type": "string", "description": "Name des bestehenden oder neuen Skills"},
                   "neuer_name": {"type": "string"}, "beschreibung": {"type": "string", "description": "Wann der Skill gilt (≤1024 Zeichen)"},
                   "anleitung": {"type": "string", "description": "Vollständige Anleitung (Markdown)"},
                   "anleitung_ersetzen": _EDITS, "zugaenge": {"type": "array", "items": {"type": "string"}},
                   "aktiv": {"type": "boolean"}}, ["name"]),
              skill_save, write=True, label="Skill speichern", icon="mdi:school-outline", preview=skill_save_preview))
register(Tool("skill_delete", "llmitmir", "Löscht einen Skill mit seinen Dateien." + _ASK,
              obj({"name": {"type": "string"}}, ["name"]), skill_delete, write=True, label="Skill löschen",
              icon="mdi:trash-can-outline", preview=skill_delete_preview))
register(Tool("task_save", "llmitmir",
              "Legt eine geplante Aufgabe an oder ändert sie (gefunden über name). Nicht angegebene Felder bleiben. "
              "Der Auftrag muss ohne Rückfragen ausführbar sein. Mit teilen lässt sich die Aufgabe an andere Personen "
              "dieser Home-Assistant-Instanz weitergeben (ansehen, bearbeiten, Benachrichtigung)." + _ASK,
              obj({"name": {"type": "string"}, "neuer_name": {"type": "string"},
                   "auftrag": {"type": "string", "description": "Vollständiger Prompt"}, "auftrag_ersetzen": _EDITS,
                   "zeitplan": _SCHEDULE, "projekt": {"type": "string", "description": "Projektname, leer = ohne Projekt"},
                   "modell": {"type": "string"}, "aktiv": {"type": "boolean"},
                   "freigaben": {"type": "array", "items": {"type": "string"},
                                 "description": "Schreibende Werkzeuge, die die Aufgabe ohne Rückfrage nutzen darf, z. B. notify, file_write"},
                   "benachrichtigen": {"type": "string", "enum": list(CH.NOTIFY)},
                   "braucht_werkbank": {"type": "boolean"},
                   "teilen": {"type": "array", "items": {"type": "object", "properties": {
                       "person": {"type": "string", "description": "Name der Person in Home Assistant"},
                       "bearbeiten": {"type": "boolean", "description": "Darf die Aufgabe ändern und starten"},
                       "benachrichtigen": {"type": "boolean", "description": "Bekommt Läufe aufs eigene Gerät"}},
                       "required": ["person"]},
                       "description": "Mit diesen Personen teilen (ersetzt die bisherige Auswahl, [] = mit niemandem). "
                                      "Nur möglich, wenn die Aufgabe der Person gehört."}}, ["name"]),
              task_save, write=True, label="Aufgabe speichern", icon="mdi:calendar-clock-outline", preview=task_save_preview))
register(Tool("task_delete", "llmitmir", "Löscht eine geplante Aufgabe." + _ASK, obj({"name": {"type": "string"}}, ["name"]),
              task_delete, write=True, label="Aufgabe löschen", icon="mdi:trash-can-outline", preview=task_delete_preview))
register(Tool("credential_save", "llmitmir",
              "Legt einen Zugang an oder ändert ihn (gefunden über name). felder nach Typ (z. B. url, username, password); "
              "nicht genannte Felder bleiben. Geheimnisse nur eintragen, wenn die Person sie dir ausdrücklich gegeben hat." + _ASK,
              obj({"name": {"type": "string"}, "neuer_name": {"type": "string"},
                   "typ": {"type": "string", "enum": list(C.TYPES)}, "felder": {"type": "object"},
                   "felder_entfernen": {"type": "array", "items": {"type": "string"}}, "notiz": {"type": "string"},
                   "gueltig_bis": {"type": "string", "description": "Ablaufdatum JJJJ-MM-TT, leer = kein Ablaufdatum"}}, ["name"]),
              credential_save, write=True, label="Zugang speichern", icon="mdi:key-outline", preview=credential_save_preview,
              redact=redact_credential_args))
register(Tool("credential_delete", "llmitmir", "Löscht einen Zugang (auch aus Skills und Projekten)." + _ASK,
              obj({"name": {"type": "string"}}, ["name"]), credential_delete, write=True, label="Zugang löschen",
              icon="mdi:trash-can-outline", preview=credential_delete_preview))
