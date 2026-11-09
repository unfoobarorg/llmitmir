"""Scheduled tasks: cron-style schedules, one shared queue, long-running friendly."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta

from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from . import tasknotify as TN
from .const import KIND_TASK_RUN
from .storage import new_id, now

_LOGGER = logging.getLogger(__name__)
CATCH_UP = timedelta(hours=6)


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


# ------------------------------------------------------------------ scheduler
class Scheduler:
    def __init__(self, hass: HomeAssistant, manager) -> None:
        self.hass = hass
        self.m = manager
        self.timers: dict[str, callable] = {}
        self.queue: list[tuple[str, str, str]] = []  # (user_id, task_id, reason)
        self.running: tuple[str, str] | None = None
        self._wake = asyncio.Event()
        self._worker: asyncio.Task | None = None
        self._done: dict[tuple[str, str], asyncio.Event] = {}

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
        self._worker = self.hass.async_create_background_task(self._work(), "llmitmir scheduler")

    async def async_stop(self) -> None:
        for unsub in self.timers.values():
            unsub()
        self.timers.clear()
        if self._worker:
            self._worker.cancel()

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
                and (task.get("last_run") or {}).get("scheduled") != prev:
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
        if any(q[0] == user_id and q[1] == task_id for q in self.queue) or self.running == (user_id, task_id):
            return -1
        self.queue.append((user_id, task_id, reason, scheduled))
        self._wake.set()
        self.m.emit(user_id, {"type": "tasks_queue", "queue": self.queue_info(user_id)})
        return len(self.queue)

    def queue_info(self, user_id: str) -> dict:
        return {"position": {q[1]: i + 1 for i, q in enumerate(self.queue) if q[0] == user_id},
                "running": self.running[1] if self.running and self.running[0] == user_id else None,
                "waiting_total": len(self.queue)}

    async def _work(self) -> None:
        while True:
            if not self.queue:
                self._wake.clear()
                await self._wake.wait()
                continue
            uid, tid, reason, scheduled = self.queue.pop(0)
            st = await self.m.user_store(uid)
            task = st.meta["tasks"].get(tid)
            user = await self.hass.auth.async_get_user(uid)
            if not task or not user or not self.m.allowed(user):
                continue
            self.running = (uid, tid)
            self.m.emit(uid, {"type": "tasks_queue", "queue": self.queue_info(uid)})
            done = asyncio.Event()
            self._done[(uid, tid)] = done
            try:
                chat = await self.m.create_chat(uid, KIND_TASK_RUN, task.get("project_id"), task.get("model") or None,
                                                title=f"{task.get('name')} · {dt_util.now():%d.%m. %H:%M}", task_id=tid)
                chat["messages"].append({"id": new_id("m"), "role": "user", "content": task.get("prompt") or "",
                                         "created": now(), "task_reason": reason})
                await st.async_save_chat(chat)
                task["last_run"] = {"chat_id": chat["id"], "status": "running", "started": now(), "reason": reason,
                                    "scheduled": scheduled}
                task.setdefault("runs", []).insert(0, chat["id"])
                del task["runs"][40:]
                await st.async_save_meta()
                self.m.emit(uid, {"type": "meta", "section": "tasks"})
                self.m.start_run(user, chat, task)
                await asyncio.wait_for(done.wait(), timeout=12 * 3600)
            except asyncio.TimeoutError:
                _LOGGER.warning("Task %s did not finish within 12 h", tid)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Task %s failed to start", tid)
            finally:
                self._done.pop((uid, tid), None)
                self.running = None
                self.m.emit(uid, {"type": "tasks_queue", "queue": self.queue_info(uid)})

    async def run_finished(self, user, task: dict, chat: dict, status: str, error: str | None) -> None:
        st = await self.m.user_store(user.id)
        last = task.get("last_run") or {}
        answer = next((m.get("content") for m in reversed(chat["messages"]) if m["role"] == "assistant" and m.get("content")), "")
        last.update({"status": status, "finished": now(), "error": error, "summary": (answer or "")[:400],
                     "external": chat.get("model") if chat.get("external_used") else None,
                     "fallback": bool(chat.get("model_fallback"))})
        task["last_run"] = last
        # what the model declared with `task_result` decides whether the phone rings – not the length of the report
        res = chat.get("result") or {}
        art = res.get("art") if res.get("art") in TN.ARTS else "nichts"
        text = res.get("text") or ""
        prev = task.get("_prev_result") or {}
        task["_prev_result"] = {"art": art, "text": text}
        # compared against what the person was last told, so a standing state does not ring again
        told = task.get("_last_notified") or prev.get("text") or ""
        mode = task.get("notify") or "always"
        send = TN.should_notify(mode, status, art, text, told)
        if send and art != "nichts":
            task["_last_notified"] = text
        await st.async_save_meta()
        self.m.emit(user.id, {"type": "meta", "section": "tasks"})
        if send:
            from . import notifydevices as ND

            devices = ND.apply_links(await ND.async_devices(self.hass), self.m.config.data.get("notify_devices"))
            device = ND.resolve(ND.for_user(devices, user.id), user.id, st.meta["settings"])
            title = ("✓ " if status == "done" else "⚠ ") + str(task.get("name") or "Aufgabe")
            if chat.get("external_used") and chat.get("model_fallback"):
                title += " (Notfall: externes Modell)"
            text = re.sub(r"[#*_`>]+", "", (error or text or answer or "Fertig.")).strip()
            try:
                if device:
                    await ND.async_send(self.hass, device, title[:100], text[:900],
                                        url=f"/llmitmir/chat/{chat['id']}", tag=f"llmitmir-task-{task['id']}",
                                        context=Context(user_id=user.id))
                else:
                    _LOGGER.debug("Task %s: no push device for user %s", task.get("id"), user.id)
            except Exception:  # noqa: BLE001
                _LOGGER.warning("Notification for task %s failed", task.get("id"), exc_info=True)
        done = self._done.get((user.id, task["id"]))
        if done:
            done.set()
