"""Config flow: provider and key mode. Everything else is managed in the panel (Admin)."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (SelectSelector, SelectSelectorConfig, SelectSelectorMode, TextSelector,
                                            TextSelectorConfig, TextSelectorType)

from .const import DOMAIN, KEY_MODES, KEY_SHARED, PRESETS
from .provider import Provider


class LLMitMirConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        errors = {}
        if user_input is not None:
            preset = user_input["preset"]
            base = (user_input.get("base_url") or PRESETS[preset]["base_url"]).rstrip("/")
            if not base.startswith("http"):
                errors["base_url"] = "invalid_url"
            elif user_input.get("api_key"):
                try:
                    await Provider(async_get_clientsession(self.hass), base).list_models(user_input["api_key"])
                except Exception:  # noqa: BLE001
                    errors["api_key"] = "cannot_connect"
            if not errors:
                return self.async_create_entry(title=PRESETS[preset]["name"], data={
                    "preset": preset, "base_url": base, "key_mode": user_input["key_mode"],
                    "api_key": user_input.get("api_key") or ""})
        schema = vol.Schema({
            vol.Required("preset", default="saia"): SelectSelector(SelectSelectorConfig(
                options=list(PRESETS), translation_key="preset", mode=SelectSelectorMode.LIST)),
            vol.Optional("base_url"): TextSelector(TextSelectorConfig(type=TextSelectorType.URL)),
            vol.Required("key_mode", default=KEY_SHARED): SelectSelector(SelectSelectorConfig(
                options=list(KEY_MODES), translation_key="key_mode", mode=SelectSelectorMode.LIST)),
            vol.Optional("api_key"): TextSelector(TextSelectorConfig(type=TextSelectorType.PASSWORD)),
        })
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
