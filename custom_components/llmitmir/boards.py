"""Dashboards and tiles inside Home Assistant: finding them across people, rights, saving, data and events.

The pure rules live in dashboards.py (layout, validation, time series) and access.py (who may do what); this module
puts them to work on the stores of all people. A household has a handful of people, so lookups simply walk the
stores in memory instead of keeping a separate index.

A tile with a model source owns exactly one scheduled task (``origin: "dashboard"``). The tile is the source of
truth: its description is the task's prompt, the task is paused automatically while the tile is not placed anywhere,
and deleting the tile deletes the task, its runs and the data.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import date

from homeassistant.core import callback
from homeassistant.util import dt as dt_util

from . import access as A
from . import dashboards as D
from . import inbox as IB
from . import manage as M
from .const import (MAX_DASHBOARDS, MAX_TILES, ORIGIN_DASHBOARD, TILE_KEEP_RUNS, TILE_PARALLEL, TILE_RUN_BUDGET)
from .cron import describe
from .storage import new_id, now

_LOGGER = logging.getLogger(__name__)

# Größe einer neu platzierten Kachel je Typ (Breite × Höhe in Rasterzellen)
DEFAULT_SIZE = {"stat": (3, 2), "gauge": (3, 3), "progress": (4, 2), "text": (4, 3), "alert": (4, 3), "list": (4, 4),
                "table": (6, 4), "chart": (6, 3), "matrix": (4, 4), "scene": (4, 4)}


_RPD: dict[str, float] = {}  # schedule -> runs per day (the estimate walks a week of cron times – worth keeping)


def runs_per_day(sched: dict) -> float:
    k = json.dumps(sched, sort_keys=True)
    if k not in _RPD:
        try:
            _RPD[k] = D.runs_per_day(sched, dt_util.now())
        except ValueError:
            _RPD[k] = 0
        if len(_RPD) > 500:
            _RPD.pop(next(iter(_RPD)))
    return _RPD[k]


class Boards:
    def __init__(self, manager) -> None:
        self.m = manager
        self.hass = manager.hass
        self._tpl: dict[str, callable] = {}           # tile key -> stop tracking a template tile
        self._last_emit: dict[str, float] = {}
        self._pending: dict[str, asyncio.TimerHandle] = {}
        self._tpl_due: dict[str, tuple] = {}          # template tiles: latest result waiting to be written
        self._tpl_timer: dict[str, asyncio.TimerHandle] = {}

    # ------------------------------------------------------------ start / stop
    async def async_start(self) -> None:
        for uid, st in (await self.m.all_stores()).items():
            if self._consistency(uid, st):
                st.schedule_save()
            for t in st.meta["tiles"].values():
                self._track_template(uid, t)

    async def async_stop(self) -> None:
        for unsub in self._tpl.values():
            try:
                unsub()
            except Exception:  # noqa: BLE001
                pass
        self._tpl.clear()
        for h in [*self._pending.values(), *self._tpl_timer.values()]:
            h.cancel()
        self._pending.clear()
        self._tpl_timer.clear()

    def _consistency(self, uid: str, st) -> bool:
        """Tile and task point at each other: a task without its tile goes, a tile without its task is marked."""
        changed = False
        tiles = st.meta["tiles"]
        for tid, task in list(st.meta["tasks"].items()):
            if task.get("origin") != ORIGIN_DASHBOARD:
                continue
            tile = tiles.get(task.get("tile_id") or "")
            if not tile or (tile.get("source") or {}).get("task_id") != tid:
                st.meta["tasks"].pop(tid, None)
                if self.m.scheduler:
                    self.m.scheduler.plan(uid, dict(task, enabled=False))
                changed = True
        for tile in tiles.values():
            src = tile.get("source") or {}
            if src.get("type") == "model" and src.get("task_id") and src["task_id"] not in st.meta["tasks"]:
                src["task_id"] = ""
                changed = True
        return changed

    # ------------------------------------------------------------ lookups
    async def stores(self) -> dict:
        return await self.m.all_stores()

    async def tile(self, owner: str, tid: str) -> dict | None:
        st = (await self.stores()).get(owner)
        return st.meta["tiles"].get(tid) if st else None

    async def dashboard(self, owner: str, did: str) -> dict | None:
        st = (await self.stores()).get(owner)
        return st.meta["dashboards"].get(did) if st else None

    @staticmethod
    def rights(owner: str, obj: dict | None, uid: str) -> dict:
        return A.rights(owner, (obj or {}).get("share"), uid)

    async def visible_dashboards(self, uid: str) -> list[tuple[str, dict, dict]]:
        out = []
        for owner, st in (await self.stores()).items():
            for d in st.meta["dashboards"].values():
                r = self.rights(owner, d, uid)
                if r["view"]:
                    out.append((owner, d, r))
        return out

    async def visible_tiles(self, uid: str) -> list[tuple[str, dict, dict]]:
        out = []
        for owner, st in (await self.stores()).items():
            for t in st.meta["tiles"].values():
                r = self.rights(owner, t, uid)
                if r["view"]:
                    out.append((owner, t, r))
        return out

    async def placements_of(self, owner: str, tid: str) -> list[tuple[str, dict]]:
        """Every dashboard (owner, dashboard) the tile sits on – of anybody."""
        out = []
        for downer, st in (await self.stores()).items():
            for d in st.meta["dashboards"].values():
                if any(p["tile_owner"] == owner and p["tile_id"] == tid for p in d.get("placements") or []):
                    out.append((downer, d))
        return out

    async def _names(self, ids) -> dict:
        out = {}
        for uid in dict.fromkeys(i for i in ids if i):
            out[uid] = await self.m.user_name(uid)
        return out

    async def allowed_ids(self) -> set[str]:
        return {u.id for u in await self.hass.auth.async_get_users()
                if not u.system_generated and u.is_active and self.m.allowed(u)}

    # ------------------------------------------------------------ budget
    def budget_limit(self) -> int:
        try:
            return max(0, int((self.m.config.data.get("dashboards") or {}).get("tile_budget", TILE_RUN_BUDGET)))
        except (TypeError, ValueError):
            return TILE_RUN_BUDGET

    def parallel(self) -> int:
        try:
            return max(1, min(3, int((self.m.config.data.get("dashboards") or {}).get("tile_parallel", TILE_PARALLEL))))
        except (TypeError, ValueError):
            return TILE_PARALLEL

    @staticmethod
    def budget_used(st) -> int:
        return int((st.meta["usage"].get(date.today().isoformat()) or {}).get("tile_runs") or 0)

    def count_run(self, st) -> None:
        day = date.today().isoformat()
        u = st.meta["usage"].setdefault(day, {"requests": 0, "prompt": 0, "completion": 0})
        u["tile_runs"] = int(u.get("tile_runs") or 0) + 1
        st.schedule_save()

    def budget_left(self, st) -> int | None:
        limit = self.budget_limit()
        return None if not limit else max(0, limit - self.budget_used(st))

    # ------------------------------------------------------------ views for the panel
    def _share_view(self, owner: str, share: dict, r: dict, names: dict) -> dict:
        share = A.clean(share)
        users = []
        if r["owner"] or r["reshare"]:
            for uid, e in share["users"].items():
                users.append({"user_id": uid, "name": names.get(uid) or uid, "edit": e["edit"], "reshare": e["reshare"],
                              "by": e.get("by") or owner, "by_name": names.get(e.get("by") or owner) or "",
                              "mine": r["owner"] or e.get("by") == r.get("_uid")})
        return {"all": share["all"], "users": users, "text": A.summary(owner, share, names) if r["owner"] or r["reshare"] else ""}

    def task_view(self, owner: str, task: dict | None, full: bool) -> dict | None:
        if not task:
            return None
        sched = task.get("schedule") or {}
        out = {"id": task["id"], "schedule": sched, "schedule_text": describe(sched), "enabled": bool(task.get("enabled", True)),
               "paused": task.get("paused") or "", "notify": task.get("notify") or "error", "next_run": task.get("next_run"),
               "heavy": bool(task.get("heavy")), "schedule_error": task.get("schedule_error") or "",
               "last_run": {k: (task.get("last_run") or {}).get(k) for k in ("status", "finished", "started", "error", "reason")}
               if task.get("last_run") else None}
        out["runs_per_day"] = runs_per_day(sched)
        if full:
            out.update(project_id=task.get("project_id"), model=task.get("model"), runs=list(task.get("runs") or [])[:TILE_KEEP_RUNS])
        return out

    def tile_view(self, owner: str, t: dict, uid: str, names: dict, st=None) -> dict:
        r = dict(self.rights(owner, t, uid), _uid=uid)
        share = A.clean(t.get("share"))
        out = {k: t.get(k) for k in ("id", "name", "kind", "description", "icon", "color", "options", "source", "created",
                                     "updated", "version")}
        out.update(key=D.key(owner, t["id"]), owner=owner, owner_name=names.get(owner) or "",
                   rights={k: r[k] for k in ("owner", "view", "edit", "reshare")},
                   share=self._share_view(owner, share, r, names), notify_me=uid in share["notify"],
                   changed_by_name=names.get(t.get("changed_by") or "") or "")
        if (t.get("source") or {}).get("type") == "model" and st is not None:
            out["task"] = self.task_view(owner, st.meta["tasks"].get(t["source"].get("task_id") or ""), full=r["owner"])
        return out

    def dashboard_view(self, owner: str, d: dict, uid: str, names: dict) -> dict:
        r = dict(self.rights(owner, d, uid), _uid=uid)
        out = {k: d.get(k) for k in ("id", "name", "icon", "description", "palette", "order", "placements", "created",
                                     "updated", "version")}
        out.update(key=D.key(owner, d["id"]), owner=owner, owner_name=names.get(owner) or "",
                   rights={k: r[k] for k in ("owner", "view", "edit", "reshare")},
                   share=self._share_view(owner, d.get("share") or {}, r, names))
        return out

    async def view(self, user) -> dict:
        """Everything the panel needs for the dashboard pages (also part of the bootstrap)."""
        uid = user.id
        dashes = await self.visible_dashboards(uid)
        tiles = await self.visible_tiles(uid)
        stores = await self.stores()
        ids = {uid}
        for owner, obj, _r in dashes + tiles:
            ids.add(owner)
            share = A.clean(obj.get("share"))
            ids.update(share["users"])
            ids.update(e.get("by") for e in share["users"].values())
            ids.add(obj.get("changed_by"))
        # tiles placed on a visible dashboard but not visible to this person: name and owner only (placeholder)
        visible = {D.key(o, t["id"]) for o, t, _r in tiles}
        hidden = {}
        for _o, d, _r in dashes:
            for p in d.get("placements") or []:
                k = D.key(p["tile_owner"], p["tile_id"])
                if k not in visible and k not in hidden:
                    t = (stores.get(p["tile_owner"]).meta["tiles"].get(p["tile_id"]) if stores.get(p["tile_owner"]) else None)
                    hidden[k] = {"key": k, "owner": p["tile_owner"], "exists": bool(t), "kind": (t or {}).get("kind")}
                    ids.add(p["tile_owner"])
        names = await self._names(ids)
        for h in hidden.values():
            h["owner_name"] = names.get(h["owner"]) or ""
        st = stores.get(uid) or await self.m.user_store(uid)
        own_tasks = [t for t in st.meta["tasks"].values() if t.get("origin") == ORIGIN_DASHBOARD]
        return {
            "dashboards": sorted((self.dashboard_view(o, d, uid, names) for o, d, _r in dashes),
                                 key=lambda x: (x["owner"] != uid, x.get("order") or 0, (x.get("name") or "").casefold())),
            "tiles": [self.tile_view(o, t, uid, names, stores.get(o)) for o, t, _r in tiles],
            "hidden_tiles": list(hidden.values()),
            "tile_tasks": [self.tile_task_row(st, t) for t in own_tasks],
            "budget": {"used": self.budget_used(st), "limit": self.budget_limit()},
            "limits": {"dashboards": MAX_DASHBOARDS, "tiles": MAX_TILES},
        }

    def tile_task_row(self, st, task: dict) -> dict:
        """Short form of a tile task for „Geplant“ (no run chats – those come with task/runs)."""
        tile = st.meta["tiles"].get(task.get("tile_id") or "") or {}
        row = self.task_view(st.user_id, task, full=True) or {}
        row.update(name=task.get("name"), tile_id=tile.get("id"), tile_name=tile.get("name") or "",
                   tile_key=D.key(st.user_id, tile["id"]) if tile else "", origin=ORIGIN_DASHBOARD,
                   last_summary=((task.get("last_run") or {}).get("summary") or "")[:200])
        return row

    # ------------------------------------------------------------ events
    async def audience(self, owner: str, share: dict | None) -> set[str]:
        share = A.clean(share)
        out = {owner, *share["users"]}
        if share["all"]:
            out |= set(self.m.subscribers)
        return out

    async def emit_boards(self, uids) -> None:
        for uid in set(uids):
            self.m.emit(uid, {"type": "boards"})

    async def emit_data(self, owner: str, tile: dict, record: dict) -> None:
        """New data for a tile – to everybody who may see it, at most once a second per tile."""
        k = D.key(owner, tile["id"])
        loop = self.hass.loop
        wait = 1.0 - (loop.time() - self._last_emit.get(k, 0.0))
        audience = await self.audience(owner, tile.get("share"))

        @callback
        def send() -> None:
            self._pending.pop(k, None)
            self._last_emit[k] = loop.time()
            for uid in audience:
                self.m.emit(uid, {"type": "tile_data", "key": k, "record": public_record(record)})

        if k in self._pending:
            self._pending.pop(k).cancel()
        if wait > 0:
            self._pending[k] = loop.call_later(wait, send)
        else:
            send()

    async def emit_run(self, owner: str, tid: str, state: str) -> None:
        tile = await self.tile(owner, tid)
        if not tile:
            return
        for uid in await self.audience(owner, tile.get("share")):
            self.m.emit(uid, {"type": "tile_run", "key": D.key(owner, tid), "state": state})

    # ------------------------------------------------------------ dashboards
    async def save_dashboard(self, user, raw: dict) -> dict:
        uid = user.id
        stores = await self.stores()
        old, owner = None, uid
        if raw.get("id"):
            owner = str(raw.get("owner") or uid)
            old = await self.dashboard(owner, str(raw["id"]))
            if not old:
                raise ValueError("Dashboard nicht gefunden.")
            if not self.rights(owner, old, uid)["edit"]:
                raise PermissionError("Dieses Dashboard darfst du nur ansehen.")
            if raw.get("version") is not None and int(raw["version"]) != int(old.get("version") or 0):
                who = await self.m.user_name(old.get("changed_by") or owner)
                raise ValueError(f"Das Dashboard wurde inzwischen von {who} geändert – lade neu und versuche es noch einmal.")
        else:
            st = await self.m.user_store(uid)
            if len(st.meta["dashboards"]) >= MAX_DASHBOARDS:
                raise ValueError(f"Höchstens {MAX_DASHBOARDS} Dashboards je Person.")
            stores = await self.stores()
        st = stores.get(owner) or await self.m.user_store(owner)
        new = D.clean_dashboard(raw, old, owner, new_id)
        before = {(p["tile_owner"], p["tile_id"]) for p in (old or {}).get("placements") or []}
        after = {(p["tile_owner"], p["tile_id"]) for p in new["placements"]}
        kinds = {}
        for to, ti in after:
            t = await self.tile(to, ti)
            if (to, ti) not in before and (not t or not self.rights(to, t, uid)["view"]):
                raise PermissionError("Diese Kachel ist nicht für dich freigegeben.")
            if t:
                kinds[D.key(to, ti)] = t.get("kind")
        D.check_scenes(new["placements"], kinds)
        d = dict(old or {"created": now(), "share": A.empty()}, **new)
        d.update(version=int((old or {}).get("version") or 0) + 1, updated=now(), changed_by=uid)
        st.meta["dashboards"][d["id"]] = d
        await st.async_save_meta()
        for to, ti in before ^ after:
            await self.sync_placed(to, ti)
        await self.emit_boards(await self.audience(owner, d.get("share")))
        names = await self._names([owner, uid])
        return self.dashboard_view(owner, d, uid, names)

    async def delete_dashboard(self, user, owner: str, did: str) -> None:
        d = await self.dashboard(owner, did)
        if not d:
            raise ValueError("Dashboard nicht gefunden.")
        if owner != user.id:
            raise PermissionError("Löschen kann nur, wem das Dashboard gehört.")
        st = (await self.stores())[owner]
        st.meta["dashboards"].pop(did, None)
        await st.async_save_meta()
        for p in d.get("placements") or []:
            await self.sync_placed(p["tile_owner"], p["tile_id"])
        await self.emit_boards(await self.audience(owner, d.get("share")))

    async def place(self, user, owner: str, did: str, tile_owner: str, tid: str) -> dict:
        """Put a tile on a dashboard at the first free spot."""
        d = await self.dashboard(owner, did)
        if not d:
            raise ValueError("Dashboard nicht gefunden.")
        tile = await self.tile(tile_owner, tid)
        if not tile:
            raise ValueError("Kachel nicht gefunden.")
        w, h = DEFAULT_SIZE.get(tile.get("kind"), (4, 3))
        x, y = D.free_spot(d.get("placements") or [], w, h)
        placements = list(d.get("placements") or []) + [{"tile_owner": tile_owner, "tile_id": tid, "x": x, "y": y, "w": w, "h": h}]
        return await self.save_dashboard(user, {"id": did, "owner": owner, "placements": placements})

    # ------------------------------------------------------------ tiles
    async def sync_placed(self, owner: str, tid: str) -> None:
        """A model tile that sits nowhere pauses its task; once placed again it runs again."""
        st = (await self.stores()).get(owner)
        tile = st.meta["tiles"].get(tid) if st else None
        if not tile or (tile.get("source") or {}).get("type") != "model":
            return
        task = st.meta["tasks"].get(tile["source"].get("task_id") or "")
        if not task:
            return
        placed = bool(await self.placements_of(owner, tid))
        if not placed and task.get("enabled", True) and not task.get("paused"):
            task["enabled"], task["paused"] = False, "unplaced"
        elif placed and task.get("paused") == "unplaced":
            task["enabled"] = True
            task.pop("paused", None)
        else:
            return
        self.m.scheduler.plan(owner, task)
        await st.async_save_meta()

    async def save_tile(self, user, raw: dict, place: dict | None = None) -> dict:
        uid = user.id
        old, owner = None, uid
        if raw.get("id"):
            owner = str(raw.get("owner") or uid)
            old = await self.tile(owner, str(raw["id"]))
            if not old:
                raise ValueError("Kachel nicht gefunden.")
            if not self.rights(owner, old, uid)["edit"]:
                raise PermissionError("Diese Kachel darfst du nur ansehen.")
            if raw.get("version") is not None and int(raw["version"]) != int(old.get("version") or 0):
                who = await self.m.user_name(old.get("changed_by") or owner)
                raise ValueError(f"Die Kachel wurde inzwischen von {who} geändert – lade neu und versuche es noch einmal.")
        else:
            st0 = await self.m.user_store(uid)
            if len(st0.meta["tiles"]) >= MAX_TILES:
                raise ValueError(f"Höchstens {MAX_TILES} Kacheln je Person.")
        st = (await self.stores()).get(owner) or await self.m.user_store(owner)
        is_owner = owner == uid
        new = D.clean_tile(raw, old, owner, bool(user.is_admin), new_id)
        tile = dict(old or {"created": now(), "share": A.empty()}, **new)
        tile.update(version=int((old or {}).get("version") or 0) + 1, updated=now(), changed_by=uid)
        if tile["source"]["type"] == "model":
            await self._save_tile_task(st, owner, tile, raw, is_owner, placing=bool(place))
        if A.clean(tile.get("share"))["all"] and tile["source"]["type"] == "model":
            tile["share"] = dict(A.clean(tile["share"]), all={"edit": False, "reshare": False})
        st.meta["tiles"][tile["id"]] = tile
        await st.async_save_meta()
        self._track_template(owner, tile)
        if old and not is_owner and (old.get("description") != tile.get("description")
                                     or (old.get("source") or {}) != (tile.get("source") or {})):
            await self._tell_owner(owner, tile, old, uid)
        await self.emit_boards(await self.audience(owner, tile.get("share")))
        if place:
            await self.place(user, str(place.get("owner") or uid), str(place.get("id") or ""), owner, tile["id"])
        names = await self._names([owner, uid])
        return self.tile_view(owner, tile, uid, names, st)

    async def _save_tile_task(self, st, owner: str, tile: dict, raw: dict, is_owner: bool, placing: bool) -> None:
        """Create or update the tile's scheduled task. Only the owner decides project, model and steps."""
        task = st.meta["tasks"].get(tile["source"].get("task_id") or "")
        sched = raw.get("schedule") if isinstance(raw.get("schedule"), dict) else (
            (task or {}).get("schedule") or D.default_schedule(tile["id"]))
        D.check_interval(sched, dt_util.now())
        cur = task or {}
        t_in = {
            "id": cur.get("id"), "name": f"Kachel: {tile['name']}"[:100], "prompt": tile["description"], "schedule": sched,
            "enabled": cur.get("enabled", True), "allow_write": cur.get("allow_write") or ["dashboard_update"],
            "tool_groups": cur.get("tool_groups"), "requires": cur.get("requires"), "requires_note": cur.get("requires_note"),
            "notify": cur.get("notify") or "error", "project_id": cur.get("project_id"), "model": cur.get("model"),
            "heavy": cur.get("heavy", False), "external_fallback": cur.get("external_fallback", False),
            "origin": ORIGIN_DASHBOARD, "tile_id": tile["id"],
        }
        if is_owner:
            for k in ("notify", "project_id", "model", "heavy"):
                if k in raw:
                    t_in[k] = raw[k] or (None if k in ("project_id", "model") else ("error" if k == "notify" else False))
            if "enabled" in raw:
                t_in["enabled"] = bool(raw["enabled"])
        if t_in["notify"] not in ("always", "on_change", "error", "never"):
            t_in["notify"] = "error"
        built = M.build_task(st, t_in, owner_id=owner)
        built["share"] = {"users": {}}  # a tile's task is shared through the tile, never on its own
        if task is None and not placing:
            built["enabled"], built["paused"] = False, "unplaced"  # runs once it sits on a dashboard
        elif "enabled" in raw and is_owner:
            built.pop("paused", None)
        st.meta["tasks"][built["id"]] = built
        tile["source"]["task_id"] = built["id"]
        self.m.scheduler.plan(owner, built)

    async def _tell_owner(self, owner: str, tile: dict, old: dict, by: str) -> None:
        """Somebody else changed what a tile does with the owner's access: a card on the owner's start page."""
        st = (await self.stores()).get(owner)
        if not st:
            return
        who = await self.m.user_name(by)
        what = "die Beschreibung" if old.get("description") != tile.get("description") else "die Datenquelle"
        text = f"{who} hat {what} der Kachel „{tile['name']}“ geändert."
        if old.get("description") != tile.get("description"):
            text += f"\nVorher: {(old.get('description') or '')[:250]}\nJetzt: {(tile.get('description') or '')[:250]}"
        entry = {"id": new_id("n"), "chat_id": "", "task_id": (tile.get("source") or {}).get("task_id") or "",
                 "task": f"Kachel: {tile['name']}", "title": f"Kachel „{tile['name']}“ geändert"[:120], "text": text[:600],
                 "status": "done", "link": f"/dashboards?tile={D.key(owner, tile['id'])}"}
        st.meta["inbox"] = IB.add(st.meta.get("inbox"), entry, now())
        await st.async_save_meta()
        self.m.emit(owner, {"type": "inbox", "items": IB.prune(st.meta["inbox"], now(), IB.minutes(st.meta["settings"]))})

    async def delete_tile(self, user, owner: str, tid: str) -> None:
        tile = await self.tile(owner, tid)
        if not tile:
            raise ValueError("Kachel nicht gefunden.")
        if owner != user.id:
            raise PermissionError("Löschen kann nur, wem die Kachel gehört.")
        stores = await self.stores()
        st = stores[owner]
        audience = await self.audience(owner, tile.get("share"))
        # off every dashboard (also other people's)
        for downer, d in await self.placements_of(owner, tid):
            d["placements"] = D.compact([p for p in d.get("placements") or []
                                         if not (p["tile_owner"] == owner and p["tile_id"] == tid)])
            d["version"] = int(d.get("version") or 0) + 1
            d["updated"] = now()
            await stores[downer].async_save_meta()
            audience |= await self.audience(downer, d.get("share"))
        task_id = (tile.get("source") or {}).get("task_id") or ""
        task = st.meta["tasks"].get(task_id)
        if task:
            runs = list(task.get("runs") or [])
            await M.delete_task(self.m, owner, st, task_id)
            for cid in runs:
                if cid in st.meta["chats"]:
                    await st.async_delete_chat(cid)
                    self.m.emit(owner, {"type": "chat_deleted", "chat_id": cid})
        self._untrack(D.key(owner, tid))
        st.meta["tiles"].pop(tid, None)
        await st.async_delete_tile_data(tid)
        await st.async_save_meta()
        await self.emit_boards(audience)

    async def share(self, user, what: str, owner: str, item_id: str, users_in, all_in="keep") -> dict:
        obj = await (self.tile(owner, item_id) if what == "tile" else self.dashboard(owner, item_id))
        if not obj:
            raise ValueError("Nicht gefunden.")
        before = await self.audience(owner, obj.get("share"))
        if what == "tile" and (obj.get("source") or {}).get("type") == "model" and isinstance(all_in, dict):
            all_in = {"edit": False, "reshare": False}  # „für alle“ heißt bei Modell-Kacheln nur ansehen
        obj["share"] = A.update(owner, obj.get("share"), user.id, users_in, all_in, await self.allowed_ids())
        obj["updated"] = now()
        st = (await self.stores())[owner]
        await st.async_save_meta()
        await self.emit_boards(before | await self.audience(owner, obj.get("share")))
        names = await self._names([owner, user.id, *A.users(obj["share"]),
                                   *(e.get("by") for e in A.clean(obj["share"])["users"].values())])
        return (self.tile_view(owner, obj, user.id, names, st) if what == "tile"
                else self.dashboard_view(owner, obj, user.id, names))

    async def set_notify(self, user, owner: str, tid: str, on: bool) -> None:
        tile = await self.tile(owner, tid)
        if not tile:
            raise ValueError("Kachel nicht gefunden.")
        tile["share"] = A.set_notify(owner, tile.get("share"), user.id, on)
        await (await self.stores())[owner].async_save_meta()
        self.m.emit(user.id, {"type": "boards"})

    async def notify_users(self, owner: str, tile: dict) -> list[str]:
        return A.notify_users(owner, tile.get("share"))

    # ------------------------------------------------------------ data
    async def record(self, owner: str, tid: str) -> dict | None:
        st = (await self.stores()).get(owner)
        return await st.async_get_tile_data(tid) if st else None

    async def write_data(self, owner: str, tile: dict, payload: dict, by: str, run_chat_id: str | None = None) -> dict:
        new = D.validate(tile.get("kind") or "text", payload)
        st = (await self.stores())[owner]
        prev = await st.async_get_tile_data(tile["id"])
        rec = D.merge(tile.get("kind") or "text", new, prev, now())
        rec.update(by=by, run_chat_id=run_chat_id or (prev or {}).get("run_chat_id"), notice=None)
        await st.async_save_tile_data(tile["id"], rec)
        await self.emit_data(owner, tile, rec)
        return rec

    async def mark(self, owner: str, tid: str, error: str | None = None, notice: str | None = None) -> None:
        """Keep the last data, but say what went wrong (error) or why nothing happened (notice)."""
        st = (await self.stores()).get(owner)
        tile = st.meta["tiles"].get(tid) if st else None
        if not tile:
            return
        rec = dict(await st.async_get_tile_data(tid) or {"status": "empty", "data": None, "updated": None})
        if error is not None:
            rec.update(error=error[:400], error_at=now())
        if notice is not None:
            rec.update(notice=notice[:200], notice_at=now())
        await st.async_save_tile_data(tid, rec)
        await self.emit_data(owner, tile, rec)

    async def clear_data(self, user, owner: str, tid: str) -> None:
        tile = await self.tile(owner, tid)
        if not tile or not self.rights(owner, tile, user.id)["edit"]:
            raise PermissionError("Diese Kachel darfst du nicht ändern.")
        st = (await self.stores())[owner]
        await st.async_delete_tile_data(tid)
        await self.emit_data(owner, tile, {"status": "empty", "data": None, "updated": None})

    async def run_now(self, user, owner: str, tid: str) -> int:
        tile = await self.tile(owner, tid)
        if not tile or not self.rights(owner, tile, user.id)["edit"]:
            raise PermissionError("Diese Kachel darfst du nicht aktualisieren.")
        if (tile.get("source") or {}).get("type") != "model":
            raise ValueError("HA-Kacheln aktualisieren sich von selbst.")
        task_id = tile["source"].get("task_id")
        if not task_id:
            raise ValueError("Die Kachel hat keine Aufgabe mehr – speichere sie einmal, dann wird sie neu angelegt.")
        st = (await self.stores())[owner]
        left = self.budget_left(st)
        if left == 0:
            raise ValueError("Das Tagesbudget für Kachel-Läufe ist aufgebraucht – morgen geht es weiter.")
        pos = self.m.scheduler.enqueue(owner, task_id, "manuell")
        await self.emit_run(owner, tid, "queued")
        return pos

    async def tile_context(self, owner: str, task: dict) -> tuple[dict | None, dict | None]:
        st = (await self.stores()).get(owner)
        tile = st.meta["tiles"].get(task.get("tile_id") or "") if st else None
        return tile, (await st.async_get_tile_data(tile["id"]) if tile else None)

    async def prune_runs(self, st, task: dict) -> None:
        """A tile task keeps its last TILE_KEEP_RUNS runs; older run chats are deleted for good."""
        runs = list(task.get("runs") or [])
        drop = runs[TILE_KEEP_RUNS:]
        task["runs"] = runs[:TILE_KEEP_RUNS]
        for cid in drop:
            if cid in st.meta["chats"]:
                await st.async_delete_chat(cid)
                self.m.emit(st.user_id, {"type": "chat_deleted", "chat_id": cid})

    # ------------------------------------------------------------ template tiles (HA Jinja, rendered here)
    def _untrack(self, k: str) -> None:
        unsub = self._tpl.pop(k, None)
        if unsub:
            try:
                unsub()
            except Exception:  # noqa: BLE001
                pass

    def _track_template(self, owner: str, tile: dict) -> None:
        k = D.key(owner, tile["id"])
        self._untrack(k)
        src = tile.get("source") or {}
        if src.get("type") != "ha" or src.get("mode") != "template" or not src.get("template"):
            return
        try:
            from homeassistant.exceptions import TemplateError
            from homeassistant.helpers.event import TrackTemplate, async_track_template_result
            from homeassistant.helpers.template import Template
        except ImportError:  # pragma: no cover
            return
        tpl = Template(src["template"], self.hass)

        @callback
        def changed(_event, updates) -> None:
            res = updates[-1].result if updates else ""
            # write at most every 10 s (a template over a power sensor changes every second); the last result wins
            self._tpl_due[k] = (res, isinstance(res, TemplateError))
            if k in self._tpl_timer:
                return

            @callback
            def flush() -> None:
                self._tpl_timer.pop(k, None)
                due = self._tpl_due.pop(k, None)
                if due is not None:
                    self.hass.async_create_task(self._write_template(owner, tile["id"], *due))

            first = k not in self._last_emit
            self._tpl_timer[k] = self.hass.loop.call_later(0 if first else 10, flush)

        try:
            info = async_track_template_result(self.hass, [TrackTemplate(tpl, None)], changed)
            info.async_refresh()
            self._tpl[k] = info.async_remove
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning("Vorlage der Kachel %s lässt sich nicht verfolgen: %s", k, e)

    async def _write_template(self, owner: str, tid: str, result, failed: bool) -> None:
        tile = await self.tile(owner, tid)
        if not tile:
            return
        if failed:
            await self.mark(owner, tid, error=f"Fehler in der Vorlage: {result}")
            return
        text = str(result if result is not None else "").strip()
        kind = tile.get("kind")
        try:
            if kind == "stat":
                num = D._num(text.replace(",", ".")) if text else None
                if num is None:
                    raise ValueError(f"Die Vorlage liefert keine Zahl: „{text[:60]}“")
                payload = {"headline": "", "data": {"value": num, "unit": (tile.get("options") or {}).get("unit") or ""}}
            elif kind == "list":
                payload = {"data": {"items": [{"title": ln.strip("-• ").strip()} for ln in text.splitlines() if ln.strip()]}}
            else:
                payload = {"data": {"markdown": text}}
            await self.write_data(owner, tile, payload, by="template")
        except ValueError as e:
            await self.mark(owner, tid, error=str(e))


def public_record(rec: dict | None) -> dict | None:
    """What the panel gets of a record (the stored time series only as far as the tiles draw it)."""
    if not rec:
        return rec
    out = {k: rec.get(k) for k in ("status", "headline", "subline", "data", "updated", "error", "error_at", "notice",
                                   "notice_at", "by")}
    pts = (rec.get("series") or {}).get("value") or []
    if pts:
        out["series"] = pts[-60:]
    return out
