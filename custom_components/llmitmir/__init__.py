"""LLMitMir – chats, coworks, scheduled tasks, projects and skills with open-weight models in Home Assistant."""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers.event import async_track_time_interval

from .agent import Manager
from .const import DOMAIN, EXT_MODELS_REFRESH, MODEL_POLL_SECONDS, PANEL_ELEMENT, PANEL_ICON, PANEL_TITLE, PANEL_URL, PRESETS, STATIC_URL, VERSION
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
        cfg.setdefault("models", {})["defaults"] = {}  # empty = automatic (best model for the job right now)
        cfg["_seeded"] = True
        cfg["_auto_models"] = True
        await manager.config.async_save()
    if not cfg.get("_auto_models"):
        # Up to 0.3 the preset's fixed models were copied into the admin defaults. Defaults nobody changed become
        # "automatic", so new releases and the current load are taken into account.
        preset_defaults = PRESETS.get((cfg.get("provider") or {}).get("preset") or "", {}).get("defaults") or {}
        defs = (cfg.get("models") or {}).get("defaults") or {}
        for role, mid in list(defs.items()):
            if mid == preset_defaults.get(role) or role == "title":
                defs.pop(role)
        cfg["_auto_models"] = True
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
        # model list with status, load and new releases – now and every few minutes
        await manager.refresh_models(max_age=0)

        async def _poll(_now=None) -> None:
            await manager.refresh_models(max_age=MODEL_POLL_SECONDS - 10)

        entry.async_on_unload(async_track_time_interval(hass, _poll, timedelta(seconds=MODEL_POLL_SECONDS)))

        # models of external providers (Foundry deployments, Anthropic API): at start and every few hours
        async def _ext(_now=None) -> None:
            await manager.refresh_all_ext(max_age=EXT_MODELS_REFRESH - 60)

        hass.async_create_background_task(manager.refresh_all_ext(max_age=0), "llmitmir external models")
        entry.async_on_unload(async_track_time_interval(hass, _ext, timedelta(seconds=EXT_MODELS_REFRESH)))

        # Chats und Coworks nach ihrer Frist löschen (Projektfrist, sonst die der Person): beim Start und stündlich
        async def _purge(_now=None) -> None:
            try:
                await manager.purge_expired()
            except Exception:  # noqa: BLE001 - die Aufräumfrist darf nichts anderes aufhalten
                _LOGGER.exception("Aufräumen abgelaufener Chats fehlgeschlagen")

        hass.async_create_background_task(_purge(), "llmitmir retention")
        entry.async_on_unload(async_track_time_interval(hass, _purge, timedelta(hours=1)))

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
        await manager.billing.async_save()
    frontend.async_remove_panel(hass, PANEL_URL)
    data.pop("manager", None)
    return True
