"""Dashboards and tiles for the model: look, build (each change approved), and fill a tile with data.

`dashboard_update` is the one tool of a tile run: it writes the tile's data (checked by dashboards.validate) and is
bound to the run's own tile. Everything else changes LLMitMir itself and therefore shows a change set first – never in
an unattended run.
"""
from __future__ import annotations

import itertools
import json

from homeassistant.util import dt as dt_util

from .. import access as A
from .. import changes as CH
from .. import dashboards as D
from ..boards import DEFAULT_SIZE
from ..cron import describe
from . import Tool, obj, register

LEVELS = ("aus", "ansehen", "bearbeiten", "weiterteilen")


def _b(ctx):
    if not getattr(ctx.manager, "boards", None):
        raise ValueError("Dashboards sind noch nicht bereit.")
    return ctx.manager.boards


def _match(obj: dict, owner: str, name) -> bool:
    want = str(name or "").strip()
    return bool(want) and (str(obj.get("name") or "").casefold() == want.casefold() or obj.get("id") == want
                           or D.key(owner, obj.get("id") or "") == want)


async def _find_tile(ctx, name, need: str = "view") -> tuple[str, dict, dict]:
    found = [(o, t, r) for o, t, r in await _b(ctx).visible_tiles(ctx.user_id) if _match(t, o, name)]
    found.sort(key=lambda x: x[0] != ctx.user_id)  # own first
    if not found:
        raise ValueError(f"Kachel „{name}“ nicht gefunden.")
    o, t, r = found[0]
    if not r[need]:
        raise PermissionError(f"Die Kachel „{t.get('name')}“ darfst du nur ansehen.")
    return o, t, r


async def _find_dash(ctx, name, need: str = "view") -> tuple[str, dict, dict]:
    found = [(o, d, r) for o, d, r in await _b(ctx).visible_dashboards(ctx.user_id) if _match(d, o, name)]
    found.sort(key=lambda x: x[0] != ctx.user_id)
    if not found:
        raise ValueError(f"Dashboard „{name}“ nicht gefunden.")
    o, d, r = found[0]
    if not r[need]:
        raise PermissionError(f"Das Dashboard „{d.get('name')}“ darfst du nur ansehen.")
    return o, d, r


async def _people(ctx, entries) -> list[dict] | None:
    """[{person, stufe}] -> [{user_id, edit, reshare}]; None = leave as it is."""
    if entries is None:
        return None
    allowed = {u.id: u.name for u in await ctx.manager.hass.auth.async_get_users()
               if not u.system_generated and u.id != ctx.user_id and ctx.manager.allowed(u)}
    out = []
    for e in entries or []:
        if isinstance(e, str):
            e = {"person": e}
        want = str((e or {}).get("person") or "").strip()
        uid = next((i for i, n in allowed.items() if n.casefold() == want.casefold() or i == want), None)
        if not uid:
            raise ValueError(f"Person „{want}“ nicht gefunden. Möglich: " + (", ".join(sorted(allowed.values())) or "niemand"))
        out.append(dict(A.from_level((e or {}).get("stufe")), user_id=uid))
    return out


def _all(value):
    if value is None:
        return "keep"
    v = str(value).strip().casefold()
    if v in ("aus", "nein", "niemand", ""):
        return None
    return A.from_level(v)


def _ids():
    """Ids for a dry run (preview): unique, but never stored."""
    n = itertools.count(1)
    return lambda prefix: f"{prefix}vorschau{next(n)}"


def _source_text(src: dict) -> str:
    if (src or {}).get("type") == "ha":
        what = ", ".join(src.get("entities") or []) or src.get("pattern") or ("Vorlage" if src.get("mode") == "template" else "")
        return f"Home Assistant – {D.MODE_LABELS.get(src.get('mode'), src.get('mode'))}: {what}"
    return "Modell (geplanter Lauf)" + (f", nur bei Änderung von {', '.join(src.get('run_if_changed'))}"
                                        if (src or {}).get("run_if_changed") else "")


async def _names(ctx, ids) -> dict:
    return {uid: await ctx.manager.user_name(uid) for uid in dict.fromkeys(i for i in ids if i)}


# ------------------------------------------------------------------ change rows
def _tile_rows(t: dict | None, task: dict | None, share_text: str) -> list[tuple[str, str, bool]]:
    if not t:
        return []
    src = t.get("source") or {}
    rows = [("Name", t.get("name") or "", False), ("Typ", D.KIND_LABELS.get(t.get("kind"), t.get("kind") or ""), False),
            ("Beschreibung", t.get("description") or "", True), ("Datenquelle", _source_text(src), False),
            ("Farbe", t.get("color") or "aus der Farbwelt", False), ("Icon", t.get("icon") or "Standard", False),
            ("Optionen", json.dumps(t.get("options") or {}, ensure_ascii=False) if t.get("options") else "keine", False)]
    if src.get("type") == "ha":
        if src.get("mode") == "template":
            rows.append(("Vorlage", src.get("template") or "", True))
        if src.get("rules"):
            rows.append(("Regeln", "; ".join(f"{r['if']} {r['value']} → {r['status']}" for r in src["rules"]), False))
    if task:
        rows += [("Zeitplan", describe(task.get("schedule") or {}), False),
                 ("Benachrichtigen", CH.NOTIFY.get(task.get("notify") or "error", str(task.get("notify"))), False)]
    rows.append(("Geteilt mit", share_text, False))
    return rows


def _dash_rows(d: dict | None, tile_names: dict, share_text: str) -> list[tuple[str, str, bool]]:
    if not d:
        return []
    tiles = "\n".join(f"{tile_names.get(D.key(p['tile_owner'], p['tile_id']), p['tile_id'])} ({p['w']}×{p['h']} bei {p['x']},{p['y']})"
                      for p in sorted(d.get("placements") or [], key=lambda p: (p["y"], p["x"])))
    return [("Name", d.get("name") or "", False), ("Icon", d.get("icon") or "", False),
            ("Farbwelt", d.get("palette") or "aurora", False), ("Beschreibung", d.get("description") or "", False),
            ("Kacheln", tiles or "keine", True), ("Geteilt mit", share_text, False)]


async def _tile_names(ctx) -> dict:
    return {D.key(o, t["id"]): t.get("name") or t["id"] for o, t, _r in await _b(ctx).visible_tiles(ctx.user_id)}


# ------------------------------------------------------------------ read
async def dashboard_list(ctx, a: dict):
    b = _b(ctx)
    names = await _names(ctx, [o for o, _d, _r in await b.visible_dashboards(ctx.user_id)]
                         + [o for o, _t, _r in await b.visible_tiles(ctx.user_id)])
    tile_names = await _tile_names(ctx)
    dashes = []
    for o, d, r in await b.visible_dashboards(ctx.user_id):
        dashes.append({"name": d.get("name"), "gehoert": "dir" if o == ctx.user_id else names.get(o),
                       "rechte": "alles" if r["owner"] else "bearbeiten" if r["edit"] else "ansehen",
                       "kacheln": [tile_names.get(D.key(p["tile_owner"], p["tile_id"]), "(nicht freigegeben)")
                                   for p in d.get("placements") or []]})
    tiles = []
    for o, t, r in await b.visible_tiles(ctx.user_id):
        rec = await b.record(o, t["id"]) or {}
        tiles.append({"name": t.get("name"), "typ": t.get("kind"), "quelle": _source_text(t.get("source") or {}),
                      "gehoert": "dir" if o == ctx.user_id else names.get(o),
                      "rechte": "alles" if r["owner"] else "bearbeiten" if r["edit"] else "ansehen",
                      "status": rec.get("status") or "noch keine Daten", "headline": rec.get("headline") or "",
                      "fehler": rec.get("error") or "",
                      "aktualisiert": dt_util.as_local(dt_util.utc_from_timestamp(rec["updated"])).strftime("%d.%m. %H:%M")
                      if rec.get("updated") else ""})
    return {"dashboards": dashes, "kacheln": tiles} if dashes or tiles else "Noch keine Dashboards oder Kacheln."


async def dashboard_get(ctx, a: dict):
    b = _b(ctx)
    o, d, r = await _find_dash(ctx, a.get("name"))
    out = {"name": d.get("name"), "beschreibung": d.get("description"), "farbwelt": d.get("palette"),
           "rechte": "alles" if r["owner"] else "bearbeiten" if r["edit"] else "ansehen", "kacheln": []}
    for p in d.get("placements") or []:
        t = await b.tile(p["tile_owner"], p["tile_id"])
        tr = b.rights(p["tile_owner"], t, ctx.user_id) if t else {"view": False}
        entry = {"position": {"x": p["x"], "y": p["y"], "breite": p["w"], "hoehe": p["h"]}}
        if not t or not tr["view"]:
            entry["kachel"] = "(nicht für dich freigegeben)" if t else "(gelöscht)"
        else:
            rec = await b.record(p["tile_owner"], p["tile_id"]) or {}
            data = json.dumps(rec.get("data"), ensure_ascii=False, default=str) if rec.get("data") is not None else ""
            entry.update(kachel=t.get("name"), typ=t.get("kind"), beschreibung=t.get("description"),
                         quelle=_source_text(t.get("source") or {}), status=rec.get("status"), headline=rec.get("headline"),
                         fehler=rec.get("error"), daten=data[:3000] + (" …" if len(data) > 3000 else ""))
            if (t.get("source") or {}).get("type") == "model":
                st = (await b.stores()).get(p["tile_owner"])
                task = st.meta["tasks"].get(t["source"].get("task_id") or "") if st else None
                if task:
                    entry["zeitplan"] = describe(task.get("schedule") or {})
        out["kacheln"].append(entry)
    return out


# ------------------------------------------------------------------ dashboards
async def _dash_plan(ctx, a: dict) -> tuple[dict | None, dict, dict, list | None, object]:
    name = str(a.get("name") or "").strip()
    if not name:
        raise ValueError("name fehlt")
    old_owner, old = ctx.user_id, None
    try:
        old_owner, old, _r = await _find_dash(ctx, name, "edit")
    except ValueError:
        old = None
    placements = [dict(p) for p in (old or {}).get("placements") or []]
    ids = _ids()

    async def tile_ref(n):
        o, t, _r = await _find_tile(ctx, n)
        return o, t

    if a.get("kacheln") is not None:
        placements = []
        for e in a["kacheln"] or []:
            o, t = await tile_ref((e or {}).get("kachel"))
            placements.append({"tile_owner": o, "tile_id": t["id"], "x": e.get("x", 0), "y": e.get("y", 10_000),
                               "w": e.get("breite") or 4, "h": e.get("hoehe") or 3})
    for n in a.get("entfernen") or []:
        o, t = await tile_ref(n)
        placements = [p for p in placements if not (p["tile_owner"] == o and p["tile_id"] == t["id"])]
    for e in a.get("hinzufuegen") or []:
        e = {"kachel": e} if isinstance(e, str) else (e or {})
        o, t = await tile_ref(e.get("kachel"))
        dw, dh = DEFAULT_SIZE.get(t.get("kind"), (4, 3))
        w, h = e.get("breite") or dw, e.get("hoehe") or dh
        x, y = D.free_spot(D.clean_placements(placements, ids), int(w), int(h))
        placements.append({"tile_owner": o, "tile_id": t["id"], "x": x, "y": y, "w": w, "h": h})
    raw = {"name": str(a.get("neuer_name") or "").strip() or (old or {}).get("name") or name, "placements": placements}
    for src, dst in (("icon", "icon"), ("farbwelt", "palette"), ("beschreibung", "description")):
        if a.get(src) is not None:
            raw[dst] = a[src]
    if old:
        raw.update(id=old["id"], owner=old_owner)
    new = D.clean_dashboard(raw, old, old_owner, ids)
    new_share = (old or {}).get("share") or A.empty()
    users_in, all_in = await _people(ctx, a.get("teilen")), _all(a.get("fuer_alle"))
    if users_in is not None or all_in != "keep":
        cur_users = [] if users_in is None else users_in
        if users_in is None:
            cur_users = [dict(e, user_id=u) for u, e in A.clean(new_share)["users"].items()]
        new_share = A.update(old_owner, new_share, ctx.user_id, cur_users, all_in, None)
    return old, dict(new, share=new_share), raw, users_in, all_in


async def dashboard_save_preview(ctx, a: dict) -> dict:
    old, new, _raw, _u, _a = await _dash_plan(ctx, a)
    tn = await _tile_names(ctx)
    names = await _names(ctx, A.users(new["share"]) + A.users((old or {}).get("share")))
    owner = (old or {}).get("owner") or ctx.user_id
    ch = CH.build("dashboard", new["name"], _dash_rows(old, tn, A.summary(owner, (old or {}).get("share"), names)),
                  _dash_rows(new, tn, A.summary(owner, new["share"], names)))
    if not ch["felder"]:
        raise ValueError("Keine Änderung – das Dashboard ist schon so.")
    return ch


async def dashboard_save(ctx, a: dict):
    ch = await dashboard_save_preview(ctx, a)
    old, _new, raw, users_in, all_in = await _dash_plan(ctx, a)
    b = _b(ctx)
    view = await b.save_dashboard(ctx.user, raw)
    if users_in is not None or all_in != "keep":
        cur = users_in if users_in is not None else [
            dict(e, user_id=u) for u, e in A.clean((old or {}).get("share"))["users"].items()]
        await b.share(ctx.user, "dashboard", view["owner"], view["id"], cur, all_in)
    return CH.summary(ch)


async def dashboard_delete_preview(ctx, a: dict) -> dict:
    o, d, _r = await _find_dash(ctx, a.get("name"), "owner")
    ch = CH.build("dashboard", d["name"], _dash_rows(d, await _tile_names(ctx), A.summary(o, d.get("share"))), [])
    ch["hinweis"] = "Die Kacheln bleiben in der Bibliothek; Modell-Kacheln, die dann nirgends mehr liegen, pausieren."
    return ch


async def dashboard_delete(ctx, a: dict):
    ch = await dashboard_delete_preview(ctx, a)
    o, d, _r = await _find_dash(ctx, a.get("name"), "owner")
    await _b(ctx).delete_dashboard(ctx.user, o, d["id"])
    return CH.summary(ch)


# ------------------------------------------------------------------ tiles
def _source_in(q: dict | None, old_src: dict | None) -> dict | None:
    if q is None:
        return None
    art = str(q.get("art") or (old_src or {}).get("type") or "").casefold()
    if art in ("modell", "model"):
        return {"type": "model", "run_if_changed": q.get("nur_bei_aenderung") if q.get("nur_bei_aenderung") is not None
                else (old_src or {}).get("run_if_changed") or []}
    if art in ("ha", "home assistant", "homeassistant"):
        stat = q.get("statistik") if isinstance(q.get("statistik"), dict) else {}
        rules = [{"if": r.get("wenn"), "value": r.get("wert"), "status": r.get("status")} for r in q.get("regeln") or []
                 if isinstance(r, dict)]
        return {"type": "ha", "mode": q.get("modus") or "state", "entities": q.get("entitaeten") or [],
                "pattern": q.get("muster") or "", "attribute": q.get("attribut") or "", "hours": q.get("stunden"),
                "statistics": {"period": stat.get("zeitraum"), "stat": stat.get("wert"), "count": stat.get("anzahl")},
                "days": q.get("tage"), "template": q.get("vorlage") or "", "rules": rules}
    raise ValueError("quelle.art ist „ha“ (Home Assistant, ohne Modell) oder „modell“ (geplanter Lauf).")


async def _tile_plan(ctx, a: dict) -> tuple[str, dict | None, dict, dict, dict | None]:
    b = _b(ctx)
    name = str(a.get("name") or "").strip()
    if not name:
        raise ValueError("name fehlt")
    owner, old = ctx.user_id, None
    try:
        owner, old, _r = await _find_tile(ctx, name, "edit")
    except ValueError:
        old = None
    if old is None and not a.get("quelle"):
        raise ValueError("Für eine neue Kachel braucht es „quelle“ – zuerst prüfen, ob Home Assistant die Daten schon hat "
                         "(art „ha“), sonst art „modell“.")
    raw = {"name": str(a.get("neuer_name") or "").strip() or (old or {}).get("name") or name}
    for src, dst in (("typ", "kind"), ("beschreibung", "description"), ("farbe", "color"), ("icon", "icon"),
                     ("optionen", "options")):
        if a.get(src) is not None:
            raw[dst] = a[src]
    s = _source_in(a.get("quelle"), (old or {}).get("source"))
    if s is not None:
        raw["source"] = s
    if old:
        raw.update(id=old["id"], owner=owner, version=old.get("version"))
    new = D.clean_tile(raw, old, owner, bool(ctx.user.is_admin), _ids())
    st = (await b.stores()).get(owner)
    task = st.meta["tasks"].get(((old or {}).get("source") or {}).get("task_id") or "") if st and old else None
    new_task = None
    if new["source"]["type"] == "model":
        sched = a.get("zeitplan") or (task or {}).get("schedule") or D.default_schedule(new["id"])
        D.check_interval(sched, dt_util.now())
        new_task = {"schedule": sched, "notify": a.get("benachrichtigen") or (task or {}).get("notify") or "error"}
        raw["schedule"] = sched
        if owner == ctx.user_id:
            if a.get("benachrichtigen"):
                raw["notify"] = a["benachrichtigen"]
            if a.get("projekt") is not None:
                proj = next((p for p in st.meta["projects"].values()
                             if p.get("name", "").casefold() == str(a["projekt"]).casefold()), None) if a["projekt"] else None
                if a["projekt"] and not proj:
                    raise ValueError(f"Projekt „{a['projekt']}“ nicht gefunden.")
                raw["project_id"] = proj["id"] if proj else None
            if a.get("modell") is not None:
                raw["model"] = a["modell"] or None
    return owner, old, dict(new, share=(old or {}).get("share") or A.empty()), raw, (task, new_task)


async def tile_save_preview(ctx, a: dict) -> dict:
    owner, old, new, _raw, (task, new_task) = await _tile_plan(ctx, a)
    names = await _names(ctx, A.users(new["share"]))
    share_text = A.summary(owner, new["share"], names)
    ch = CH.build("kachel", new["name"], _tile_rows(old, task, share_text), _tile_rows(new, new_task, share_text))
    if a.get("teilen") is not None or a.get("fuer_alle") is not None:
        ch["felder"].append({"feld": "Teilen", "alt": share_text,
                             "neu": ", ".join(f"{e.get('person')} ({e.get('stufe') or 'ansehen'})" for e in a.get("teilen") or [])
                             + (f"; für alle: {a.get('fuer_alle')}" if a.get("fuer_alle") is not None else "")})
    if a.get("auf_dashboard"):
        ch["felder"].append({"feld": "Platzieren auf", "alt": None, "neu": str(a["auf_dashboard"])})
    if not ch["felder"]:
        raise ValueError("Keine Änderung – die Kachel ist schon so.")
    if new["source"]["type"] == "model":
        try:
            ch["hinweis"] = (f"≈ {D.runs_per_day(new_task['schedule'], dt_util.now())} Modell-Läufe pro Tag"
                             + (" (nur wenn sich die gewählten Entitäten ändern)" if new["source"].get("run_if_changed") else ""))
        except ValueError:
            pass
    else:
        ch["hinweis"] = "Daten direkt aus Home Assistant – keine Modell-Läufe."
    return ch


async def tile_save(ctx, a: dict):
    ch = await tile_save_preview(ctx, a)
    owner, old, _new, raw, _t = await _tile_plan(ctx, a)
    b = _b(ctx)
    place = None
    if a.get("auf_dashboard"):
        do, d, _r = await _find_dash(ctx, a["auf_dashboard"], "edit")
        place = {"owner": do, "id": d["id"]}
    view = await b.save_tile(ctx.user, raw, place)
    if a.get("teilen") is not None or a.get("fuer_alle") is not None:
        users_in = await _people(ctx, a.get("teilen"))
        if users_in is None:
            users_in = [dict(e, user_id=u) for u, e in A.clean((old or {}).get("share"))["users"].items()]
        await b.share(ctx.user, "tile", view["owner"], view["id"], users_in, _all(a.get("fuer_alle")))
    return CH.summary(ch)


async def tile_delete_preview(ctx, a: dict) -> dict:
    b = _b(ctx)
    o, t, _r = await _find_tile(ctx, a.get("name"), "owner")
    st = (await b.stores())[o]
    task = st.meta["tasks"].get((t.get("source") or {}).get("task_id") or "")
    ch = CH.build("kachel", t["name"], _tile_rows(t, task, A.summary(o, t.get("share"))), [])
    where = [d.get("name") for _do, d in await b.placements_of(o, t["id"])]
    ch["hinweis"] = ("Liegt auf: " + ", ".join(where) + ". " if where else "") + "Daten und Läufe werden mitgelöscht."
    return ch


async def tile_delete(ctx, a: dict):
    ch = await tile_delete_preview(ctx, a)
    o, t, _r = await _find_tile(ctx, a.get("name"), "owner")
    await _b(ctx).delete_tile(ctx.user, o, t["id"])
    return CH.summary(ch)


# ------------------------------------------------------------------ data
async def dashboard_update(ctx, a: dict):
    b = _b(ctx)
    if ctx.task is not None and not ctx.is_tile_run:
        return "Fehler: `dashboard_update` gehört zu Kachel-Läufen – andere geplante Aufgaben schreiben keine Kacheln."
    payload = {k: a.get(k) for k in ("status", "headline", "subline", "data")}
    if ctx.is_tile_run:
        tile = ctx.tile or await b.tile(ctx.user_id, ctx.task.get("tile_id") or "")
        if not tile:
            return "Fehler: Die Kachel dieses Laufs gibt es nicht mehr."
        if a.get("kachel") and not _match(tile, ctx.user_id, a["kachel"]):
            return f"Fehler: Dieser Lauf schreibt nur in seine eigene Kachel „{tile.get('name')}“ – `kachel` weglassen."
        owner = ctx.user_id
        fails = int(ctx.chat.get("tile_fails") or 0)
        if fails >= 3:
            return "Fehler: Drei ungültige Versuche – keine weiteren. Beschreibe im Bericht, was nicht gepasst hat."
        try:
            rec = await b.write_data(owner, tile, payload, by="run", run_chat_id=ctx.chat_id)
        except ValueError as e:
            ctx.chat["tile_fails"] = fails + 1
            return f"Fehler: {e} (Versuch {fails + 1} von 3)"
        ctx.chat["tile_written"] = True
        line = rec.get("headline") or ""
        if rec.get("status") in ("warn", "error") and line:
            line = ("⚠ " if rec["status"] == "warn" else "⛔ ") + line
        ctx.chat["result"] = {"art": "ergebnis" if line else "nichts", "text": line[:400]}
    else:
        if not a.get("kachel"):
            return "Fehler: `kachel` fehlt (Name der Kachel)."
        owner, tile, _r = await _find_tile(ctx, a["kachel"], "edit")
        try:
            rec = await b.write_data(owner, tile, payload, by="chat")
        except ValueError as e:
            return f"Fehler: {e}"
    return f"Kachel „{tile.get('name')}“ aktualisiert: {rec.get('headline') or '(ohne Überschrift)'} ({rec.get('status')})."


# ------------------------------------------------------------------ registration
_ASK = " Die Person sieht die Änderung und muss sie bestätigen."
_PEOPLE = {"type": "array", "items": {"type": "object", "properties": {
    "person": {"type": "string", "description": "Name der Person in Home Assistant"},
    "stufe": {"type": "string", "enum": ["ansehen", "bearbeiten", "weiterteilen"]}}, "required": ["person"]},
    "description": "Persönliche Freigaben (ersetzt die bisherigen, die du verwaltest; [] = niemand)"}
_ALL = {"type": "string", "enum": list(LEVELS),
        "description": "Für alle, die LLMitMir nutzen (auch künftige): aus, ansehen, bearbeiten, weiterteilen. "
                       "Modell-Kacheln nur „ansehen“."}
_SCHEDULE = {"type": "object", "description": "Wie bei task_save; Standard: stündlich 7–22 Uhr. Höchstens alle 15 Minuten.",
             "properties": {"type": {"type": "string"}, "time": {"type": "string"}, "cron": {"type": "string"},
                            "minute": {"type": "integer"}, "hours": {"type": "integer"},
                            "days": {"type": "array", "items": {"type": "integer"}}}}
_SOURCE = {"type": "object", "description":
           "Woher die Daten kommen. ZUERST prüfen, ob Home Assistant sie schon hat (Entitäten mit den ha-Werkzeugen "
           "suchen) – dann art „ha“: keine Modell-Läufe, live, kostenlos. Nur wenn HA es nicht weiß (Mails auswerten, "
           "Webseiten, Einschätzungen), art „modell“: dann ist die Beschreibung der Auftrag eines geplanten Laufs.",
           "properties": {
               "art": {"type": "string", "enum": ["ha", "modell"]},
               "modus": {"type": "string", "enum": list(D.MODE_LABELS),
                         "description": "nur ha: state (Zustand), history (Verlauf), statistics (Langzeitstatistik), calendar, "
                                        "todo, template (Jinja, nur HA-Admins)"},
               "entitaeten": {"type": "array", "items": {"type": "string"}},
               "muster": {"type": "string", "description": "nur ha/state: z. B. sensor.*_battery"},
               "attribut": {"type": "string"}, "stunden": {"type": "integer", "description": "history: Zeitraum"},
               "statistik": {"type": "object", "properties": {"zeitraum": {"type": "string", "enum": ["hour", "day", "week", "month"]},
                                                              "wert": {"type": "string", "enum": ["mean", "min", "max", "sum", "change"]},
                                                              "anzahl": {"type": "integer"}}},
               "tage": {"type": "integer", "description": "calendar: Tage voraus"},
               "vorlage": {"type": "string"},
               "regeln": {"type": "array", "items": {"type": "object", "properties": {
                   "wenn": {"type": "string", "enum": list(D.RULE_OPS)}, "wert": {}, "status": {"type": "string", "enum": ["ok", "warn", "error"]}}}},
               "nur_bei_aenderung": {"type": "array", "items": {"type": "string"},
                                     "description": "nur modell: Lauf nur, wenn sich eine dieser Entitäten geändert hat"}},
           "required": ["art"]}

register(Tool("dashboard_list", "llmitmir",
              "Listet die Dashboards und Kacheln, die die Person sehen darf (eigene, geteilte, für alle) – mit Quelle, "
              "Status und letzter Überschrift, ohne die Daten.", obj({}), dashboard_list,
              label="Dashboards ansehen", icon="mdi:view-dashboard-outline"))
register(Tool("dashboard_get", "llmitmir",
              "Ein Dashboard mit seinen Kacheln: Position, Beschreibung, Quelle, Zeitplan und letzter Datensatz.",
              obj({"name": {"type": "string"}}, ["name"]), dashboard_get, label="Dashboard ansehen",
              icon="mdi:view-dashboard-outline"))
register(Tool("dashboard_save", "llmitmir",
              "Legt ein Dashboard an oder ändert es (gefunden über name). Raster mit 12 Spalten; Kacheln mindestens 2×2. "
              "kacheln ersetzt die ganze Belegung, hinzufuegen/entfernen ändern nur einzelne." + _ASK,
              obj({"name": {"type": "string"}, "neuer_name": {"type": "string"}, "icon": {"type": "string", "description": "mdi:…"},
                   "farbwelt": {"type": "string", "enum": list(D.PALETTES)}, "beschreibung": {"type": "string"},
                   "kacheln": {"type": "array", "items": {"type": "object", "properties": {
                       "kachel": {"type": "string"}, "x": {"type": "integer"}, "y": {"type": "integer"},
                       "breite": {"type": "integer"}, "hoehe": {"type": "integer"}}, "required": ["kachel"]}},
                   "hinzufuegen": {"type": "array", "items": {"type": "object", "properties": {
                       "kachel": {"type": "string"}, "breite": {"type": "integer"}, "hoehe": {"type": "integer"}}, "required": ["kachel"]}},
                   "entfernen": {"type": "array", "items": {"type": "string"}},
                   "teilen": _PEOPLE, "fuer_alle": _ALL}, ["name"]),
              dashboard_save, write=True, label="Dashboard speichern", icon="mdi:view-dashboard-edit-outline",
              preview=dashboard_save_preview))
register(Tool("dashboard_delete", "llmitmir", "Löscht ein Dashboard (die Kacheln bleiben)." + _ASK,
              obj({"name": {"type": "string"}}, ["name"]), dashboard_delete, write=True, label="Dashboard löschen",
              icon="mdi:trash-can-outline", preview=dashboard_delete_preview))
register(Tool("tile_save", "llmitmir",
              "Legt eine Kachel an oder ändert sie (gefunden über name). typ: " + ", ".join(
                  f"{k} ({v})" for k, v in D.KIND_LABELS.items())
              + ". Eine Kachel lässt sich auf vielen Dashboards platzieren (auf_dashboard platziert sie gleich). "
              "Bei Modell-Kacheln ist beschreibung der Auftrag jedes Laufs: was die Kachel zeigt, woher die Daten kommen, "
              "was ein Warnfall ist." + _ASK,
              obj({"name": {"type": "string"}, "neuer_name": {"type": "string"},
                   "typ": {"type": "string", "enum": list(D.KIND_LABELS)}, "beschreibung": {"type": "string"},
                   "farbe": {"type": "string", "description": "#rrggbb, leer = aus der Farbwelt"},
                   "icon": {"type": "string", "description": "mdi:…"}, "optionen": {"type": "object"},
                   "quelle": _SOURCE, "zeitplan": _SCHEDULE,
                   "benachrichtigen": {"type": "string", "enum": list(CH.NOTIFY), "description": "nur Modell-Kacheln, Standard: error"},
                   "projekt": {"type": "string", "description": "nur Modell-Kacheln: Projekt mit Zugängen und Skills"},
                   "modell": {"type": "string"}, "auf_dashboard": {"type": "string"},
                   "teilen": _PEOPLE, "fuer_alle": _ALL}, ["name"]),
              tile_save, write=True, label="Kachel speichern", icon="mdi:view-grid-plus-outline", preview=tile_save_preview))
register(Tool("tile_delete", "llmitmir", "Löscht eine Kachel überall (mit Daten und Läufen)." + _ASK,
              obj({"name": {"type": "string"}}, ["name"]), tile_delete, write=True, label="Kachel löschen",
              icon="mdi:trash-can-outline", preview=tile_delete_preview))
register(Tool("dashboard_update", "llmitmir",
              "Schreibt die Daten einer Kachel. Im Kachel-Lauf ohne `kachel` – er schreibt immer in seine eigene. "
              "data nach dem Schema des Kacheltyps; LLMitMir prüft sie und meldet Fehler zurück.",
              obj({"kachel": {"type": "string", "description": "nur außerhalb eines Kachel-Laufs: Name der Kachel"},
                   "status": {"type": "string", "enum": list(D.STATUSES)},
                   "headline": {"type": "string", "description": "eine kurze Zeile, z. B. „3 offene Aufgaben“"},
                   "subline": {"type": "string"}, "data": {"type": "object"}}, ["status", "headline", "data"]),
              dashboard_update, write=True, label="Kachel aktualisieren", icon="mdi:view-dashboard-variant-outline"))
