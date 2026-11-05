"""LLMitMir – chats, coworks, scheduled tasks, projects and skills with open-weight models in Home Assistant."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant

from .agent import Manager
from .const import DOMAIN, PANEL_ELEMENT, PANEL_ICON, PANEL_TITLE, PANEL_URL, PRESETS, STATIC_URL, VERSION
from .scheduler import Scheduler

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.setdefault(DOMAIN, {"import_tokens": {}})
    manager = Manager(hass)
    await manager.async_setup()
    cfg = manager.config.data
    # Seed the admin config from the config flow on first setup
    if not cfg.get("_seeded"):
        preset = entry.data.get("preset", "saia")
        p = PRESETS.get(preset, PRESETS["openai_compatible"])
        cfg["provider"] = {"preset": preset, "name": p["name"], "base_url": entry.data.get("base_url") or p["base_url"],
                           "transcription_model": p["transcription_model"]}
        cfg["key_mode"] = entry.data.get("key_mode", cfg.get("key_mode"))
        if entry.data.get("api_key"):
            cfg["shared_key"] = entry.data["api_key"]
        cfg.setdefault("models", {})["defaults"] = dict(p.get("defaults") or {})
        cfg["_seeded"] = True
        await manager.config.async_save()
    data["manager"] = manager
    manager.scheduler = Scheduler(hass, manager)

    if not data.get("registered"):
        from . import http, ws

        ws.async_register(hass)
        http.async_register(hass)
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)])
        data["registered"] = True

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_ELEMENT,
        frontend_url_path=PANEL_URL,
        module_url=f"{STATIC_URL}/llmitmir-panel.js?v={VERSION}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
        embed_iframe=False,
    )

    async def _start(_event=None) -> None:
        await manager.scheduler.async_start()
        # load model list once if a key is there
        if not (cfg.get("models") or {}).get("known") and cfg.get("shared_key"):
            try:
                models = await manager.provider.list_models(cfg["shared_key"])
                cfg.setdefault("models", {})["known"] = [
                    {"id": x.get("id"), "name": x.get("name") or x.get("id"), "input": x.get("input") or ["text"],
                     "output": x.get("output") or ["text"], "status": x.get("status") or "ready"} for x in models]
                if not cfg["models"].get("enabled"):
                    cfg["models"]["enabled"] = [x["id"] for x in cfg["models"]["known"] if x["status"] != "unavailable"]
                await manager.config.async_save()
            except Exception:  # noqa: BLE001
                _LOGGER.warning("Could not load the model list", exc_info=True)

    if hass.state is CoreState.running:
        await _start()
    else:
        entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _start))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.get(DOMAIN, {})
    manager = data.get("manager")
    if manager:
        for run in list(manager.runs.values()):
            run.cancel.set()
        if manager.scheduler:
            await manager.scheduler.async_stop()
        for st in manager.users.values():
            await st.async_save_meta()
    frontend.async_remove_panel(hass, PANEL_URL)
    data.pop("manager", None)
    return True
