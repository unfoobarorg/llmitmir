"""Wartungsmodus: Neustarts von Home Assistant ankündigen und auf laufende Agenten warten.

``llmitmir.prepare_restart`` (z. B. aus einem Ansible-Playbook oder einer Automation nach einem Update):

1. **angekündigt** – alle Personen mit Zugang bekommen eine Karte auf der Startseite, eine Push-Nachricht und einen
   Hinweis im Panel („Home Assistant startet in N Minuten neu“). Laufende und neue Läufe arbeiten weiter.
2. **wartet** – nach der Ankündigungszeit startet nichts Neues mehr (neue Nachrichten werden abgelehnt, geplante Aufgaben
   bleiben in der Warteschlange; was nach dem Neustart fällig war, holt LLMitMir nach). Laufende Agenten dürfen fertig
   werden – höchstens bis zur Frist.
3. **bereit** – kein Agent läuft mehr (oder die Frist ist um). Mit ``restart: true`` startet LLMitMir Home Assistant
   selbst neu; sonst wartet es auf den Neustart von außen (Sensor ``sensor.llmitmir_laufende_agenten``: Zustand =
   Zahl laufender Agenten, Attribut ``wartung`` = off/announced/draining/ready).

``llmitmir.cancel_restart`` sagt die Wartung ab.
"""
from __future__ import annotations

import asyncio
import logging
import time

_LOGGER = logging.getLogger(__name__)

OFF, ANNOUNCED, DRAINING, READY = "off", "announced", "draining", "ready"
SIGNAL = "llmitmir_runs_changed"
POLL = 5


def blocks(state: dict) -> bool:
    """Starten neue Läufe? Nicht mehr, sobald die Wartung wartet oder bereit ist."""
    return state.get("state") in (DRAINING, READY)


def message(state: dict, now_ts: float | None = None) -> str:
    now_ts = now_ts or time.time()
    s = state.get("state")
    reason = f" ({state['reason']})" if state.get("reason") else ""
    if s == ANNOUNCED:
        mins = max(1, round((state["restart_at"] - now_ts) / 60))
        return (f"Home Assistant startet in etwa {mins} Minute{'n' if mins != 1 else ''} neu{reason}. Laufende Chats, Coworks "
                "und Aufgaben dürfen fertig werden; danach startet bis zum Neustart nichts Neues.")
    if s in (DRAINING, READY):
        return f"Home Assistant startet gleich neu{reason}. Neue Nachrichten und Aufgaben warten bis danach."
    return ""


class Maintenance:
    def __init__(self, manager) -> None:
        self.m = manager
        self.state: dict = {"state": OFF}
        self._task: asyncio.Task | None = None

    def view(self) -> dict:
        v = dict(self.state)
        if v["state"] != OFF:
            v["message"] = message(v)
        return v

    def blocks(self) -> bool:
        return blocks(self.state)

    def _changed(self) -> None:
        from homeassistant.helpers.dispatcher import async_dispatcher_send

        async_dispatcher_send(self.m.hass, SIGNAL)
        for uid in list(self.m.subscribers):
            self.m.emit(uid, {"type": "maintenance", "state": self.view()})

    async def prepare(self, minutes: float = 10, max_wait: float = 30, restart: bool = False, reason: str = "") -> dict:
        await self.cancel(quiet=True)
        now_ts = time.time()
        self.state = {"state": ANNOUNCED, "since": now_ts, "restart_at": now_ts + max(0.0, minutes) * 60,
                      "deadline": now_ts + (max(0.0, minutes) + max(1.0, max_wait)) * 60, "restart": bool(restart),
                      "reason": str(reason or "")[:200]}
        self._changed()
        await self._tell_everybody(message(self.state, now_ts), "Neustart angekündigt")
        self._task = self.m.hass.async_create_background_task(self._run(), "llmitmir maintenance")
        return self.view()

    async def cancel(self, quiet: bool = False) -> dict:
        was = self.state.get("state")
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        self.state = {"state": OFF}
        if was != OFF and not quiet:
            self._changed()
            await self._tell_everybody("Der angekündigte Neustart von Home Assistant ist abgesagt.", "Neustart abgesagt")
        return self.view()

    async def _run(self) -> None:
        try:
            await asyncio.sleep(max(0.0, self.state["restart_at"] - time.time()))
            self.state["state"] = DRAINING
            self._changed()
            while self.m.runs and time.time() < self.state["deadline"]:
                await asyncio.sleep(POLL)
            self.state["state"] = READY
            self.state["waited_out"] = bool(self.m.runs)  # Frist um, obwohl noch etwas lief
            self._changed()
            if self.state.get("restart"):
                _LOGGER.info("Wartung: keine laufenden Agenten mehr – Home Assistant wird neu gestartet")
                await self.m.hass.services.async_call("homeassistant", "restart", blocking=False)
        except asyncio.CancelledError:
            raise

    async def _tell_everybody(self, text: str, title: str) -> None:
        """Karte auf der Startseite und Push an das Gerät jeder Person, die LLMitMir nutzen darf."""
        from . import inbox as IB
        from . import notifydevices as ND
        from .storage import new_id

        try:
            devices = ND.apply_links(await ND.async_devices(self.m.hass), self.m.config.data.get("notify_devices"))
        except Exception:  # noqa: BLE001 - ohne Geräte bleibt die Karte
            devices = []
        for u in await self.m.hass.auth.async_get_users():
            if u.system_generated or not u.is_active or not self.m.allowed(u):
                continue
            try:
                st = await self.m.user_store(u.id)
                ts = time.time()
                st.meta["inbox"] = IB.add(st.meta.get("inbox"), {"id": new_id("n"), "chat_id": "", "task": "Wartung",
                                                                 "status": "done", "title": title, "text": text}, ts)
                await st.async_save_meta()
                self.m.emit(u.id, {"type": "inbox", "items": IB.prune(st.meta["inbox"], ts, IB.minutes(st.meta["settings"]))})
                device = ND.resolve(ND.for_user(devices, u.id), u.id, st.meta["settings"])
                if device:
                    await ND.async_send(self.m.hass, device, f"LLMitMir: {title}", text, tag="llmitmir-maintenance")
            except Exception:  # noqa: BLE001 - eine Person darf die anderen nicht aufhalten
                _LOGGER.warning("Wartungshinweis an %s fehlgeschlagen", u.id, exc_info=True)
