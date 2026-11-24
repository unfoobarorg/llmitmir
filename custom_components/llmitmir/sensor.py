"""Sensor „LLMitMir laufende Agenten“ – für Neustarts von außen (maintenance.py).

Zustand: Zahl der gerade laufenden Agenten. Attribute: Wartungszustand (off/announced/draining/ready), geplanter
Beginn der Wartezeit und Frist. Ein Playbook ruft ``llmitmir.prepare_restart`` auf und wartet, bis ``wartung`` den Wert
``ready`` hat.
"""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN
from .maintenance import SIGNAL


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([RunningAgents(hass.data[DOMAIN]["manager"], entry.entry_id)])


class RunningAgents(SensorEntity):
    _attr_should_poll = False
    _attr_icon = "mdi:robot-outline"
    _attr_name = "LLMitMir laufende Agenten"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = "Agenten"

    def __init__(self, manager, entry_id: str) -> None:
        self.m = manager
        self._attr_unique_id = f"{entry_id}_running_agents"

    @property
    def native_value(self) -> int:
        return len({r.agent_id or r.id for r in self.m.runs.values()})

    @property
    def extra_state_attributes(self) -> dict:
        s = self.m.maintenance.state
        return {"wartung": s.get("state"), "neustart_ab": s.get("restart_at"), "frist": s.get("deadline"),
                "grund": s.get("reason") or None}

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL, self._update))

    @callback
    def _update(self) -> None:
        self.async_write_ha_state()
