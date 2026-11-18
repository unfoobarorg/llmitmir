"""Hilfen für Tests ohne Home Assistant.

``load("tools.http")`` lädt ein Modul der Integration mit seinen relativen Importen (unter dem Paketnamen ``lmsec``).
Module, die Home Assistant importieren, bekommen dafür kleine Attrappen – aber nur während des Ladens: Danach
verschwinden sie wieder aus ``sys.modules``, damit Module mit ``try: import homeassistant … except ImportError``
in anderen Tests unverändert den Weg ohne Home Assistant gehen.
"""
from __future__ import annotations

import importlib
import os
import pathlib
import sys
import types
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / "custom_components" / "llmitmir"
PKG = "lmsec"


def _mod(name: str, **attrs) -> types.ModuleType:
    m = types.ModuleType(name)
    m.__dict__.update(attrs)
    return m


def ha_stubs() -> dict[str, types.ModuleType]:
    """Das Nötigste von Home Assistant, damit die Module sich importieren lassen."""

    class HomeAssistant:  # noqa: D401 - nur ein Typ
        pass

    class Context:
        def __init__(self, user_id=None, **_kw):
            self.user_id = user_id

    def callback(func):
        return func

    class HomeAssistantError(Exception):
        pass

    class Unauthorized(HomeAssistantError):
        pass

    class TemplateError(HomeAssistantError):
        pass

    class Store:
        def __init__(self, hass, version, key, private=False, **_kw):
            self.key, self.private, self.data = key, private, None

        async def async_load(self):
            return self.data

        async def async_save(self, data):
            self.data = data

        def async_delay_save(self, func, _delay=0):
            self.data = func()

    def write_utf8_file_atomic(filename, utf8_data, private=False, mode="w"):
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, mode, encoding="utf-8") as fh:
            fh.write(utf8_data)
        if private:
            os.chmod(filename, 0o600)

    class HomeAssistantView:
        requires_auth = True
        cors_allowed = False

        def json(self, result, status_code=200, headers=None):
            from aiohttp import web

            return web.json_response(result, status=int(status_code), headers=headers)

        def json_message(self, message, status_code=200, message_code=None, headers=None):
            return self.json({"message": message}, status_code, headers)

    dt = _mod("homeassistant.util.dt",
              now=lambda: datetime.now().astimezone(),
              utcnow=lambda: datetime.now(timezone.utc),
              as_local=lambda d: d.astimezone(),
              utc_from_timestamp=lambda ts: datetime.fromtimestamp(ts, timezone.utc),
              parse_datetime=lambda s: datetime.fromisoformat(s) if s else None,
              get_default_time_zone=lambda: datetime.now().astimezone().tzinfo)
    util_file = _mod("homeassistant.util.file", write_utf8_file_atomic=write_utf8_file_atomic)
    util = _mod("homeassistant.util", dt=dt, file=util_file, __path__=[])
    storage = _mod("homeassistant.helpers.storage", Store=Store)
    helpers = _mod("homeassistant.helpers", storage=storage, __path__=[])
    http = _mod("homeassistant.components.http", HomeAssistantView=HomeAssistantView)
    components = _mod("homeassistant.components", http=http, __path__=[])
    core = _mod("homeassistant.core", HomeAssistant=HomeAssistant, Context=Context, callback=callback)
    exceptions = _mod("homeassistant.exceptions", HomeAssistantError=HomeAssistantError, Unauthorized=Unauthorized,
                      TemplateError=TemplateError)
    root = _mod("homeassistant", core=core, exceptions=exceptions, util=util, helpers=helpers, components=components,
                __path__=[])
    return {"homeassistant": root, "homeassistant.core": core, "homeassistant.exceptions": exceptions,
            "homeassistant.util": util, "homeassistant.util.dt": dt, "homeassistant.util.file": util_file,
            "homeassistant.helpers": helpers, "homeassistant.helpers.storage": storage,
            "homeassistant.components": components, "homeassistant.components.http": http}


def load(mod: str) -> types.ModuleType:
    """``lmsec.<mod>`` laden – mit HA-Attrappen, die nach dem Laden wieder verschwinden."""
    stubs = ha_stubs()
    saved = {k: sys.modules.get(k) for k in stubs}
    sys.modules.update(stubs)
    try:
        if PKG not in sys.modules:
            pkg = types.ModuleType(PKG)
            pkg.__path__ = [str(BASE)]
            sys.modules[PKG] = pkg
        return importlib.import_module(f"{PKG}.{mod}")
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v


def load_all_tools() -> types.ModuleType:
    """Das Werkzeugpaket mit allen registrierten Werkzeugen (wie Manager.__init__ es lädt)."""
    tools = load("tools")
    for name in ("dashboards", "dav", "ews", "files", "ha", "http", "mail", "manage", "misc", "sub", "web", "werkbank"):
        load(f"tools.{name}")
    return tools
