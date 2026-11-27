"""Scheduled tasks: cron-style schedules, two queues (lanes), long-running friendly.

Lane "tasks" runs the person's scheduled tasks one after the other, as always. Lane "tiles" runs the tasks of
dashboard tiles (boards.py) with its own worker(s), so a dozen tiles never hold up a real task. The tile lane takes
people in turn (round robin), counts every run against the person's daily budget, skips a run when the entities it
depends on did not change, and does not catch up on missed runs after a restart (every update restarts Home
Assistant – otherwise all tiles would start at once).
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta

from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from . import i18n as I18N
from . import inbox as IB
from . import sharing as SH
from . import tasknotify as TN
from .dashboards import pick_fair
from .const import KIND_TASK_RUN, ORIGIN_DASHBOARD
from .storage import new_id, now

_LOGGER = logging.getLogger(__name__)
CATCH_UP = timedelta(hours=6)
LANES = ("tasks", "tiles")
MAX_TILE_WORKERS = 3


from .cron import describe, next_cron, parse_cron, schedule_to_cron  # noqa: F401


def next_run(s: dict, after: datetime) -> datetime | None:
    cron = schedule_to_cron(s)
    if cron is None:
        try:
            t = dt_util.parse_datetime(str(s.get("at") or ""))
        except ValueError:
            return None
        if t and t.tzinfo is None:
            t = t.replace(tzinfo=dt_util.get_default_time_zone())
        return t if t and t > after else None
    return next_cron(cron, dt_util.as_local(after))


def is_tile(task: dict | None) -> bool:
    return bool(task) and task.get("origin") == ORIGIN_DASHBOARD


# ------------------------------------------------------------------ scheduler
class Scheduler:
    def __init__(self, hass: HomeAssistant, manager) -> None:
        self.hass = hass
        self.m = manager
        self.timers: dict[str, callable] = {}
        self.queues: dict[str, list[tuple]] = {lane: [] for lane in LANES}  # (user_id, task_id, reason, scheduled)
        self.running: tuple[str, str] | None = None        # lane "tasks"
        self.running_tiles: set[tuple[str, str]] = set()   # lane "tiles"
        self._wake = {lane: asyncio.Event() for lane in LANES}
        self._workers: list[asyncio.Task] = []
        self._done: dict[tuple[str, str], asyncio.Event] = {}
        self._last_tile_user: str | None = None

    @property
    def queue(self) -> list[tuple]:
        """The lane of normal tasks (what „Geplant“ shows as the queue)."""
        return self.queues["tasks"]

    async def async_start(self) -> None:
        import os

        base = self.hass.config.path(".storage", "llmitmir")
        users = await self.hass.async_add_executor_job(lambda: os.listdir(base) if os.path.isdir(base) else [])
        for uid in users:
            if not re.match(r"^[A-Za-z0-9_-]+$", uid):
                continue
            st = await self.m.user_store(uid)
            for task in st.meta["tasks"].values():
                self.plan(uid, task, startup=True)
        self._workers.append(self.hass.async_create_background_task(self._work("tasks"), "llmitmir scheduler"))
        for i in range(MAX_TILE_WORKERS):
            self._workers.append(self.hass.async_create_background_task(self._work("tiles", i), f"llmitmir tiles {i}"))

    async def async_stop(self) -> None:
        for unsub in self.timers.values():
            unsub()
        self.timers.clear()
        for w in self._workers:
            w.cancel()
        self._workers.clear()

    def _task(self, user_id: str, task_id: str) -> dict | None:
        st = self.m.users.get(user_id)
        return st.meta["tasks"].get(task_id) if st else None

    def lane_of(self, user_id: str, task_id: str) -> str:
        return "tiles" if is_tile(self._task(user_id, task_id)) else "tasks"

    @callback
    def plan(self, user_id: str, task: dict, startup: bool = False) -> None:
        key = f"{user_id}:{task['id']}"
        if key in self.timers:
            self.timers.pop(key)()
        if not task.get("enabled", True):
            task["next_run"] = None
            return
        n = dt_util.now()
        prev = task.get("next_run")
        if startup and prev and n.timestamp() - prev < CATCH_UP.total_seconds() and prev < n.timestamp() \
                and (task.get("last_run") or {}).get("scheduled") != prev and not is_tile(task):
            # tiles do not catch up: the next regular run brings them up to date
            self.enqueue(user_id, task["id"], "nachgeholt", scheduled=prev)
        try:
            nxt = next_run(task.get("schedule") or {}, n)
        except ValueError as e:
            task["next_run"] = None
            task["schedule_error"] = str(e)
            return
        task.pop("schedule_error", None)
        task["next_run"] = nxt.timestamp() if nxt else None
        if nxt:
            @callback
            def fire(_now, uid=user_id, tid=task["id"], ts=task["next_run"]) -> None:
                self.timers.pop(f"{uid}:{tid}", None)
                self.enqueue(uid, tid, "geplant", scheduled=ts)
                st = self.m.users.get(uid)
                if st and tid in st.meta["tasks"]:
                    self.plan(uid, st.meta["tasks"][tid])
                    st.schedule_save()

            self.timers[key] = async_track_point_in_time(self.hass, fire, nxt)

    def enqueue(self, user_id: str, task_id: str, reason: str, scheduled: float | None = None) -> int:
        lane = self.lane_of(user_id, task_id)
        q = self.queues[lane]
        busy = self.running == (user_id, task_id) or (user_id, task_id) in self.running_tiles
        if any(e[0] == user_id and e[1] == task_id for e in q) or busy:
            return -1
        q.append((user_id, task_id, reason, scheduled))
        self._wake[lane].set()
        if lane == "tasks":
            self.m.emit(user_id, {"type": "tasks_queue", "queue": self.queue_info(user_id)})
        return len(q)

    def queue_info(self, user_id: str) -> dict:
        tiles = self.queues["tiles"]
        return {"position": {q[1]: i + 1 for i, q in enumerate(self.queue) if q[0] == user_id},
                "running": self.running[1] if self.running and self.running[0] == user_id else None,
                "waiting_total": len(self.queue),
                "tiles": {"position": {q[1]: i + 1 for i, q in enumerate(tiles) if q[0] == user_id},
                          "running": [t for u, t in self.running_tiles if u == user_id], "waiting_total": len(tiles)}}

    def _take(self, lane: str, slot: int) -> tuple | None:
        q = self.queues[lane]
        if not q:
            return None
        if lane == "tasks":
            return q.pop(0)
        if slot >= self.m.boards.parallel() or len(self.running_tiles) >= self.m.boards.parallel():
            return None
        i = pick_fair(q, self._last_tile_user)
        entry = q.pop(i)
        self._last_tile_user = entry[0]
        return entry

    async def _work(self, lane: str, slot: int = 0) -> None:
        while True:
            if self.m.maintenance.blocks():
                await asyncio.sleep(10)  # Wartung vor einem Neustart: Aufgaben warten in der Schlange (maintenance.py)
                continue
            entry = self._take(lane, slot)
            if entry is None:
                self._wake[lane].clear()
                if lane == "tiles" and self.queues["tiles"]:
                    # entries wait, but this slot is not allowed to run now: look again shortly
                    try:
                        await asyncio.wait_for(self._wake[lane].wait(), timeout=5)
                    except asyncio.TimeoutError:
                        pass
                else:
                    await self._wake[lane].wait()
                continue
            uid, tid, reason, scheduled = entry
            st = await self.m.user_store(uid)
            task = st.meta["tasks"].get(tid)
            user = await self.hass.auth.async_get_user(uid)
            if not task or not user or not self.m.allowed(user):
                continue
            if task.get("pending_approval"):
                # jemand anderes hat den Auftrag geändert – er läuft erst nach Bestätigung (taskedit.py)
                _LOGGER.info("Task %s waits for the owner's approval, run skipped", tid)
                continue
            tile = is_tile(task)
            if tile and not await self._tile_may_run(uid, st, task, reason):
                continue
            if tile:
                self.running_tiles.add((uid, tid))
                self.m.boards.count_run(st)
                await self.m.boards.emit_run(uid, task.get("tile_id") or "", "running")
            else:
                self.running = (uid, tid)
                self.m.emit(uid, {"type": "tasks_queue", "queue": self.queue_info(uid)})
            done = asyncio.Event()
            self._done[(uid, tid)] = done
            try:
                chat = await self.m.create_chat(uid, KIND_TASK_RUN, task.get("project_id"), task.get("model") or None,
                                                title=f"{task.get('name')} · {dt_util.now():%d.%m. %H:%M}", task_id=tid)
                if tile:
                    chat["tile_id"] = task.get("tile_id")
                chat["messages"].append({"id": new_id("m"), "role": "user", "content": task.get("prompt") or "",
                                         "created": now(), "task_reason": reason})
                await st.async_save_chat(chat)
                task["last_run"] = {"chat_id": chat["id"], "status": "running", "started": now(), "reason": reason,
                                    "scheduled": scheduled}
                task.setdefault("runs", []).insert(0, chat["id"])
                del task["runs"][40:]
                await st.async_save_meta()
                if not tile:
                    self.m.emit(uid, {"type": "meta", "section": "tasks"})
                self.m.start_run(user, chat, task)
                await asyncio.wait_for(done.wait(), timeout=12 * 3600)
            except asyncio.TimeoutError:
                _LOGGER.warning("Task %s did not finish within 12 h", tid)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Task %s failed to start", tid)
            finally:
                self._done.pop((uid, tid), None)
                if tile:
                    self.running_tiles.discard((uid, tid))
                    self._wake["tiles"].set()
                else:
                    self.running = None
                    self.m.emit(uid, {"type": "tasks_queue", "queue": self.queue_info(uid)})

    async def _tile_may_run(self, uid: str, st, task: dict, reason: str) -> bool:
        """Daily budget and „nur bei Änderung“ – a skipped run says why on the tile instead of running."""
        boards = self.m.boards
        tid = task.get("tile_id") or ""
        if boards.budget_left(st) == 0:
            await boards.mark(uid, tid, notice="Tagesbudget für Kachel-Läufe aufgebraucht – morgen geht es weiter.")
            await boards.emit_run(uid, tid, "idle")
            return False
        tile = st.meta["tiles"].get(tid) or {}
        watch = (tile.get("source") or {}).get("run_if_changed") or []
        last = task.get("last_run") or {}
        if watch and reason != "manuell" and last.get("status") == "done" and last.get("started"):
            changed = False
            for eid in watch:
                state = self.hass.states.get(eid)
                if state is None or state.last_changed.timestamp() > float(last["started"]):
                    changed = True
                    break
            if not changed:
                await boards.mark(uid, tid, notice=f"Unverändert seit {dt_util.as_local(dt_util.utc_from_timestamp(last['started'])):%d.%m. %H:%M} – Lauf übersprungen.")
                await boards.emit_run(uid, tid, "idle")
                return False
        return True

    async def _inbox_entries(self, user, task: dict, chat: dict, status: str, title: str, text: str,
                             recipients: list[str] | None = None) -> None:
        """Benachrichtigungskarten auf der Startseite anlegen (inbox.py).

        Die Eigentümerin oder der Eigentümer bekommt sie nach der eigenen Einstellung, alle, mit denen die Aufgabe
        geteilt ist, nach ihrer. Stumm geschaltete Quellchats bleiben still.
        """
        from . import notifydevices as ND

        ts = now()
        devices = ND.apply_links(await ND.async_devices(self.hass), self.m.config.data.get("notify_devices"))
        wanted = recipients if recipients is not None else [user.id, *SH.recipients(task.get("share"))]
        # nur, wer LLMitMir noch nutzen darf – sonst bekäme jemand ohne Zugriff weiter Ergebnisse (P2)
        for uid in await self.m.allowed_ids(wanted):
            try:
                other = await self.m.user_store(uid)
                settings = other.meta["settings"]
                # „automatisch“ heißt: Karten nur, solange kein Push-Gerät gewählt ist
                device = ND.resolve(ND.for_user(devices, uid), uid, settings)
                if not IB.enabled(settings, has_device=bool(device)):
                    continue
                if chat["id"] in IB.muted(settings):
                    continue
                entry = {"id": new_id("n"), "chat_id": chat["id"], "task_id": task.get("id"),
                         "task": str(task.get("name") or "Aufgabe"), "title": title[:120], "text": text[:600],
                         "status": status}
                if is_tile(task):
                    entry["link"] = f"/dashboards?tile={user.id}:{task.get('tile_id')}"
                    if uid != user.id:
                        entry["chat_id"] = ""  # run chats belong to the owner of the tile
                other.meta["inbox"] = IB.add(other.meta.get("inbox"), entry, ts)
                await other.async_save_meta()
                self.m.emit(uid, {"type": "inbox", "items": IB.prune(other.meta["inbox"], ts, IB.minutes(settings))})
            except Exception:  # noqa: BLE001 - eine Karte darf den Lauf nicht aufhalten
                _LOGGER.warning("Benachrichtigung auf der Startseite für %s fehlgeschlagen", uid, exc_info=True)

    async def run_finished(self, user, task: dict, chat: dict, status: str, error: str | None) -> None:
        st = await self.m.user_store(user.id)
        tile = is_tile(task)
        if tile and status == "done" and not chat.get("tile_written"):
            # the run ended without valid data: for the tile that is a failure, whatever the report says
            status, error = "error", "Lauf ohne Daten: `dashboard_update` wurde nicht (gültig) aufgerufen."
        last = task.get("last_run") or {}
        answer = next((m.get("content") for m in reversed(chat["messages"]) if m["role"] == "assistant" and m.get("content")), "")
        run_info = chat.get("last_run") or {}
        last.update({"status": status, "finished": now(), "error": error, "summary": (answer or "")[:400],
                     "external": chat.get("model") if chat.get("external_used") else None,
                     "fallback": bool(chat.get("model_fallback")),
                     "steps": run_info.get("steps"), "limit_hit": bool(run_info.get("limit_hit"))})
        task["last_run"] = last
        if run_info.get("limit_hit"):
            # Die Hoechstzahl an Schritten hat den Lauf beendet: die Aufgabe wird markiert und laesst sich
            # fuer mehr Schritte freigeben (heavy = bis zu 150 statt 60). Ein Lauf, der wieder durchkommt,
            # nimmt die Markierung weg.
            task["limit_hit"] = now()
        else:
            task.pop("limit_hit", None)
        # what the model declared with `task_result` (or, for a tile, `dashboard_update`) decides whether the phone
        # rings – not the length of the report
        res = chat.get("result") or {}
        art = res.get("art") if res.get("art") in TN.ARTS else "nichts"
        text = res.get("text") or ""
        prev = task.get("_prev_result") or {}
        task["_prev_result"] = {"art": art, "text": text}
        # compared against what the person was last told, so a standing state does not ring again
        told = task.get("_last_notified") or {}
        if not told and prev.get("text"):
            told = {"text": prev["text"], "at": prev.get("at")}
        mode = task.get("notify") or ("error" if tile else "always")
        send = TN.should_notify(mode, status, art, text, told.get("text") or "", told.get("at"), now())
        if send and art != "nichts":
            task["_last_notified"] = {"text": text, "at": now()}
        recipients = [user.id, *SH.recipients(task.get("share"))]
        if tile:
            if status == "error":
                await self.m.boards.mark(user.id, task.get("tile_id") or "", error=error or "Lauf fehlgeschlagen")
            await self.m.boards.prune_runs(st, task)
            t = st.meta["tiles"].get(task.get("tile_id") or "") or {}
            recipients = [user.id, *(await self.m.boards.notify_users(user.id, t))]
        recipients = await self.m.allowed_ids(recipients)
        await st.async_save_meta()
        if tile:
            await self.m.boards.emit_run(user.id, task.get("tile_id") or "", "idle")
        else:
            self.m.emit(user.id, {"type": "meta", "section": "tasks"})
        if send:
            from . import notifydevices as ND

            devices = ND.apply_links(await ND.async_devices(self.hass), self.m.config.data.get("notify_devices"))
            # Deutsche Texte mit festen Mustern – I18N.tr übersetzt sie je Empfängerin bzw. Empfänger (locales/*.json)
            name = str(task.get("name") or "Aufgabe")
            title = ("✓ " if status == "done" else "⚠ ") + (f"{name} (Notfall: externes Modell)"
                                                             if chat.get("external_used") and chat.get("model_fallback") else name)
            text = re.sub(r"[#*_`>]+", "", (error or text or answer or "Fertig.")).strip()
            if run_info.get("limit_hit") and not task.get("heavy") and not tile:
                text += ("\n" if text else "") + (f"Limit von {run_info.get('steps') or 60} Modellaufrufen erreicht – "
                                                  "die Aufgabe lässt sich für 150 freigeben.")
            # Benachrichtigungen auf der Startseite – für alle, die die Aufgabe betrifft, unabhängig vom Push-Gerät
            await self._inbox_entries(user, task, chat, status, title, text, recipients)
            # The owner gets the message according to the task's setting; everybody the task (or tile) is shared with
            # and who asked for notifications gets it on their own device as well.
            link = f"/llmitmir/dashboards?tile={user.id}:{task.get('tile_id')}" if tile else f"/llmitmir/chat/{chat['id']}"
            for uid in recipients:
                try:
                    other = st if uid == user.id else await self.m.user_store(uid)
                    device = ND.resolve(ND.for_user(devices, uid), uid, other.meta["settings"])
                    if not device:
                        _LOGGER.debug("Task %s: no push device for user %s", task.get("id"), uid)
                        continue
                    lang = self.m.lang(uid)  # Sprache der Person, die die Nachricht bekommt (i18n.py)
                    await ND.async_send(self.hass, device, I18N.tr(title, lang)[:100], I18N.tr(text, lang)[:900],
                                        url=link, tag=f"llmitmir-task-{task['id']}",
                                        context=Context(user_id=uid))
                except Exception:  # noqa: BLE001
                    _LOGGER.warning("Notification for task %s to %s failed", task.get("id"), uid, exc_info=True)
        done = self._done.get((user.id, task["id"]))
        if done:
            done.set()
