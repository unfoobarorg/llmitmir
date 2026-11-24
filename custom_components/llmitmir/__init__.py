"""LLMitMir – chats, coworks, scheduled tasks, projects and skills with open-weight models in Home Assistant."""
from __future__ import annotations

import logging
from datetime import timedelta
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, EVENT_HOMEASSISTANT_STOP
from homeassistant.core import CoreState, HomeAssistant
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval

from . import skillcheck as SK
from .agent import Manager
from .const import DOMAIN, EXT_MODELS_REFRESH, MODEL_POLL_SECONDS, PANEL_ELEMENT, PANEL_ICON, PANEL_TITLE, PANEL_URL, PRESETS, STATIC_URL, VERSION
from .boards import Boards
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
    if entry.data.get("api_key"):
        # Der Schlüssel aus dem Einrichtungsdialog steht jetzt in der Admin-Konfiguration (dort änderbar). Im Config
        # Entry bliebe er sonst für immer liegen – auch nachdem der Admin ihn im Panel ändert oder entfernt.
        hass.config_entries.async_update_entry(entry, data={**entry.data, "api_key": ""})
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
    manager.boards = Boards(manager)  # Dashboards und Kacheln (boards.py)

    if not data.get("registered"):
        from . import http, ws

        ws.async_register(hass)
        http.async_register(hass)
        _register_services(hass)
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), False)])
        data["registered"] = True

    panel_args = dict(
        webcomponent_name=PANEL_ELEMENT,
        frontend_url_path=PANEL_URL,
        module_url=f"{STATIC_URL}/llmitmir-panel.js?v={VERSION}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
        embed_iframe=False,
    )
    try:
        # Ab Home Assistant 2026.8 legt HA um eigene Panels selbst einen Rand in Höhe von
        # Statusleiste und Home-Indikator. Zusammen mit einem Panel, das den Bildschirm füllt,
        # wurde die Seite dadurch höher als der Bildschirm: die oberste Zeile scrollte weg.
        # LLMitMir hält den Rand deshalb selbst frei (handle_safe_area).
        await panel_custom.async_register_panel(hass, handle_safe_area=True, **panel_args)
    except TypeError:  # ältere Home-Assistant-Versionen kennen den Schalter nicht
        await panel_custom.async_register_panel(hass, **panel_args)
    # Sensor „LLMitMir laufende Agenten“ (sensor.py) für Neustarts von außen
    await hass.config_entries.async_forward_entry_setups(entry, ["sensor"])

    async def _start(_event=None) -> None:
        await manager.boards.async_start()
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
            try:
                await manager.audit.async_purge()  # Zugriffsprotokoll nach der Frist des Admins
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Aufräumen des Zugriffsprotokolls fehlgeschlagen")

        # Skill-Richtlinien (skillcheck.py): nachts alles prüfen, was fällig ist (geänderte Richtlinien, ausstehend)
        async def _skills(_now=None) -> None:
            try:
                await SK.recheck_all(manager)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Nächtliche Skill-Prüfung fehlgeschlagen")

        entry.async_on_unload(async_track_time_change(hass, _skills, hour=3, minute=17, second=0))

        # Trusted-AI-Zentrale (auditexport.py): morgens Auffälligkeiten als Karte für die Admins
        async def _anomalies(_now=None) -> None:
            try:
                await _tell_admins_anomalies(hass, manager)
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Prüfung auf Auffälligkeiten fehlgeschlagen")

        entry.async_on_unload(async_track_time_change(hass, _anomalies, hour=6, minute=7, second=0))

        hass.async_create_background_task(_purge(), "llmitmir retention")
        entry.async_on_unload(async_track_time_interval(hass, _purge, timedelta(hours=1)))

    if hass.state is CoreState.running:
        await _start()
    else:
        entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _start))

    async def _flush(_event=None) -> None:
        # Home Assistant fährt herunter: verzögerte Speicherungen jetzt schreiben, sonst gingen die letzten Sekunden
        # (Verbrauch, Prüfergebnisse, Startseiten-Karten) verloren
        await _flush_all(manager)

    entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, _flush))
    return True


def _register_services(hass: HomeAssistant) -> None:
    """Wartungsmodus (maintenance.py): Neustart ankündigen und auf laufende Agenten warten."""
    import voluptuous as vol
    from homeassistant.helpers import config_validation as cv

    def _m():
        m = hass.data.get(DOMAIN, {}).get("manager")
        if m is None:
            raise vol.Invalid("LLMitMir ist nicht geladen")
        return m

    async def _prepare(call) -> dict:
        return await _m().maintenance.prepare(call.data["minutes"], call.data["max_wait"], call.data["restart"],
                                              call.data.get("reason", ""))

    async def _cancel(call) -> dict:
        return await _m().maintenance.cancel()

    from homeassistant.core import SupportsResponse

    hass.services.async_register(DOMAIN, "prepare_restart", _prepare, schema=vol.Schema({
        vol.Optional("minutes", default=10): vol.All(vol.Coerce(float), vol.Range(min=0, max=240)),
        vol.Optional("max_wait", default=30): vol.All(vol.Coerce(float), vol.Range(min=1, max=480)),
        vol.Optional("restart", default=False): cv.boolean,
        vol.Optional("reason"): cv.string}), supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, "cancel_restart", _cancel, supports_response=SupportsResponse.OPTIONAL)


async def _tell_admins_anomalies(hass, manager) -> None:
    import time as _time

    from . import inbox as IB
    from .storage import new_id
    from .ws import _anomalies

    items = (await _anomalies(hass, manager))["items"]
    if not items:
        return
    text = "; ".join(f"{i.get('user_name') or 'jemand'}: {i['text']}" for i in items)[:600]
    for u in await hass.auth.async_get_users():
        if not u.is_admin or not u.is_active or u.system_generated:
            continue
        st = await manager.user_store(u.id)
        ts = _time.time()
        entry = {"id": new_id("n"), "chat_id": "", "task": "Monitoring", "status": "error",
                 "title": f"{len(items)} Auffälligkeit{'en' if len(items) != 1 else ''} im Zugriffsprotokoll", "text": text,
                 "link": "/admin/monitoring"}
        st.meta["inbox"] = IB.add(st.meta.get("inbox"), entry, ts)
        await st.async_save_meta()
        manager.emit(u.id, {"type": "inbox", "items": IB.prune(st.meta["inbox"], ts, IB.minutes(st.meta["settings"]))})


async def _flush_all(manager) -> None:
    for st in list(manager.users.values()):
        try:
            await st.async_flush()
        except Exception:  # noqa: BLE001 - die anderen Personen trotzdem speichern
            _LOGGER.exception("Speichern der Daten von %s fehlgeschlagen", st.user_id)
    await manager.billing.async_save()
    try:
        await manager.audit.async_flush()
    except Exception:  # noqa: BLE001 - beim Herunterfahren nichts anderes aufhalten
        _LOGGER.exception("Zugriffsprotokoll beim Herunterfahren nicht geschrieben")


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.get(DOMAIN, {})
    manager = data.get("manager")
    await hass.config_entries.async_unload_platforms(entry, ["sensor"])
    if manager:
        await manager.maintenance.cancel(quiet=True)
        for run in list(manager.runs.values()):
            run.cancel.set()
        if manager.scheduler:
            await manager.scheduler.async_stop()
        if getattr(manager, "boards", None):
            await manager.boards.async_stop()
        for st in list(manager.users.values()):
            await st.async_save_meta()
        await _flush_all(manager)
        # die eigene Client-Session (ohne Cookie-Speicher) gehört zu diesem Eintrag – sonst bliebe sie bis zum
        # Herunterfahren offen, bei jedem Neuladen eine mehr
        await manager.session.close()
    frontend.async_remove_panel(hass, PANEL_URL)
    data.pop("manager", None)
    return True
