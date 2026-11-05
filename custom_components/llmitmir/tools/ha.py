"""Home Assistant tools – executed with the permissions of the HA user who owns the chat."""
from __future__ import annotations

import json
import re
from datetime import timedelta

from homeassistant.core import Context
from homeassistant.exceptions import HomeAssistantError, Unauthorized
from homeassistant.util import dt as dt_util

from . import Tool, obj, register

WS_READ = re.compile(r"(^|/|_)(list|liste|get|info|config|search|history|stats|status|dokumente|uebersicht|details)(/|_|$)")


async def ha_states(ctx, a: dict):
    flt = str(a.get("filter") or "").strip().lower()
    with_attr = bool(a.get("attribute"))
    out = []
    for s in ctx.hass.states.async_all():
        if not ctx.user.is_admin and not ctx.user.permissions.check_entity(s.entity_id, "read"):
            continue
        name = str(s.attributes.get("friendly_name") or "")
        if flt and not (s.entity_id.startswith(flt) or flt in s.entity_id or flt in name.lower()):
            continue
        item = {"entity_id": s.entity_id, "name": name, "zustand": s.state}
        unit = s.attributes.get("unit_of_measurement")
        if unit:
            item["einheit"] = unit
        if with_attr:
            item["attribute"] = {k: v for k, v in s.attributes.items() if k not in ("friendly_name", "icon", "entity_picture")}
        out.append(item)
        if len(out) >= 300:
            break
    return {"anzahl": len(out), "entitaeten": out} if out else f"Keine Entität passt zu „{flt}“."


async def ha_history(ctx, a: dict):
    from homeassistant.components.recorder import get_instance, history

    eid = str(a.get("entity_id") or "")
    if not ctx.user.is_admin and not ctx.user.permissions.check_entity(eid, "read"):
        return "Fehler: keine Berechtigung"
    hours = max(1, min(float(a.get("stunden") or 24), 24 * 60))
    end = dt_util.utcnow()
    start = end - timedelta(hours=hours)

    def _q():
        return history.state_changes_during_period(ctx.hass, start, end, eid, no_attributes=True,
                                                   include_start_time_state=True)

    res = await get_instance(ctx.hass).async_add_executor_job(_q)
    pts = [(dt_util.as_local(s.last_changed).strftime("%Y-%m-%d %H:%M"), s.state) for s in res.get(eid, [])]
    if len(pts) > 400:
        step = len(pts) / 400
        pts = [pts[int(i * step)] for i in range(400)] + [pts[-1]]
    return {"entity_id": eid, "stunden": hours, "werte": pts}


async def ha_service(ctx, a: dict):
    domain, service = a.get("domain"), a.get("service")
    data = a.get("daten") or {}
    if isinstance(data, str):
        data = json.loads(data or "{}")
    targets = data.get("entity_id") or (a.get("ziel") or {}).get("entity_id") or []
    targets = [targets] if isinstance(targets, str) else list(targets)
    if not ctx.user.is_admin:
        for eid in targets:
            if not ctx.user.permissions.check_entity(eid, "control"):
                return f"Fehler: keine Berechtigung für {eid}"
        if not targets:
            return "Fehler: Nicht-Admins dürfen nur Dienste mit entity_id aufrufen"
    try:
        resp = await ctx.hass.services.async_call(domain, service, data, blocking=True,
                                                  context=Context(user_id=ctx.user.id),
                                                  target=a.get("ziel") or None,
                                                  return_response=bool(a.get("antwort")))
    except (HomeAssistantError, Unauthorized, ValueError) as e:
        return f"Fehler: {e}"
    return {"ok": True, "antwort": resp} if resp else {"ok": True}


class _Collector:
    """Minimal stand-in for an ActiveConnection to run one websocket command as a user."""

    def __init__(self, hass, user):
        self.hass = hass
        self.user = user
        self.refresh_token_id = None
        self.subscriptions = {}
        self.supported_features = {}
        self.future = hass.loop.create_future()

    def context(self, msg):
        return Context(user_id=self.user.id)

    def _done(self, value):
        if not self.future.done():
            self.future.set_result(value)

    def send_result(self, msg_id, result=None):
        self._done({"success": True, "result": result})

    def send_error(self, msg_id, code, message, *args, **kwargs):
        self._done({"success": False, "error": f"{code}: {message}"})

    def send_message(self, message):
        if isinstance(message, (bytes, str)):
            try:
                message = json.loads(message)
            except ValueError:
                return
        if isinstance(message, dict) and message.get("type") == "result":
            if message.get("success", True):
                self._done({"success": True, "result": message.get("result")})
            else:
                self._done({"success": False, "error": message.get("error")})

    send_event = send_message

    def async_handle_exception(self, msg, err):
        self._done({"success": False, "error": f"{type(err).__name__}: {err}"})


async def ha_ws(ctx, a: dict):
    from homeassistant.components import websocket_api

    typ = str(a.get("typ") or "")
    handlers = ctx.hass.data.get(websocket_api.DOMAIN) or {}
    if typ not in handlers:
        hint = sorted(t for t in handlers if typ.split("/")[0] in t)[:40]
        return f"Fehler: unbekannter Befehl „{typ}“. Ähnliche: {hint}"
    if "subscribe" in typ:
        return "Fehler: Abonnements werden nicht unterstützt"
    handler, schema = handlers[typ]
    msg = {"id": 1, "type": typ, **(a.get("daten") or {})}
    try:
        if schema:
            msg = schema(msg)
    except Exception as e:  # noqa: BLE001 - voluptuous errors
        return f"Fehler: ungültige Daten – {e}"
    conn = _Collector(ctx.hass, ctx.user)
    try:
        handler(ctx.hass, conn, msg)
    except Unauthorized:
        return "Fehler: keine Berechtigung (nur Admins)"
    except Exception as e:  # noqa: BLE001
        return f"Fehler: {type(e).__name__}: {e}"
    import asyncio

    try:
        res = await asyncio.wait_for(conn.future, timeout=120)
    except asyncio.TimeoutError:
        return "Fehler: keine Antwort nach 120 s"
    if not res["success"]:
        return f"Fehler: {res['error']}"
    return res["result"]


register(Tool("ha_states", "ha", "Listet Entitäten in Home Assistant mit Zustand (Filter: Domäne wie „sensor.“, Teil der ID oder des Namens).",
              obj({"filter": {"type": "string"}, "attribute": {"type": "boolean"}}), ha_states,
              label="Zustände lesen", icon="mdi:home-search-outline"))
register(Tool("ha_history", "ha", "Verlauf einer Entität (Zeitpunkte und Zustände).",
              obj({"entity_id": {"type": "string"}, "stunden": {"type": "number"}}, ["entity_id"]), ha_history,
              label="Verlauf lesen", icon="mdi:chart-line"))
register(Tool("ha_service", "ha", "Ruft einen Dienst in Home Assistant auf (z. B. light.turn_on, notify.mobile_app_x, script.y).",
              obj({"domain": {"type": "string"}, "service": {"type": "string"}, "daten": {"type": "object"},
                   "ziel": {"type": "object"}, "antwort": {"type": "boolean", "description": "Dienstantwort zurückgeben"}},
                  ["domain", "service"]),
              ha_service, write=True, label="Dienst aufrufen", icon="mdi:play-circle-outline"))
register(Tool("ha_ws", "ha", "Führt einen Websocket-Befehl von Home Assistant aus (z. B. eigener Integrationen wie „imkerei/liste“). Lesende Befehle frei, alle anderen mit Freigabe.",
              obj({"typ": {"type": "string"}, "daten": {"type": "object"}}, ["typ"]),
              ha_ws, write=lambda a: not WS_READ.search(str(a.get("typ") or "")),
              label="HA-Befehl", icon="mdi:console-network-outline"))
