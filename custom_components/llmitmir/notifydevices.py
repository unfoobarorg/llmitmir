"""Push devices: which ones exist, whom they belong to, and which one a person uses.

The link device → person comes from Home Assistant itself: a mobile_app registration knows the user who
registered the app. An admin can correct that link in the panel, and everybody then only picks among their
own devices. Names shown to people are the human-readable device names, never the identifiers.

The pure functions have no Home Assistant imports at module level (unit-tested).
"""
from __future__ import annotations

MOBILE = "mobile_app"
# Services that are not devices of their own
EXCLUDE = {"send_message", "persistent_notification", "notify"}


def clean_name(name) -> str:
    return " ".join(str(name or "").split())


async def async_devices(hass) -> list[dict]:
    """Every push target of this Home Assistant, with the person it belongs to (from Home Assistant)."""
    from homeassistant.helpers import device_registry as dr, entity_registry as er
    from homeassistant.util import slugify

    services = hass.services.async_services().get("notify", {})
    dev_reg = dr.async_get(hass)
    ent_reg = er.async_get(hass)
    out: list[dict] = []
    for entry in hass.config_entries.async_entries(MOBILE):
        device = next((d for d in dev_reg.devices.values() if entry.entry_id in d.config_entries), None)
        entity = next((e for e in ent_reg.entities.values()
                       if e.config_entry_id == entry.entry_id and e.domain == "notify"), None)
        # The legacy service is the only one that accepts "data" (url, clickAction, tag)
        legacy = f"notify.mobile_app_{slugify(entry.title)}"
        service = legacy if legacy.split(".", 1)[1] in services else ""
        entity_id = entity.entity_id if entity else f"notify.{slugify(entry.title)}"
        name = clean_name((device.name_by_user or device.name) if device else "") or clean_name(entry.title)
        out.append({"key": device.id if device else f"entry:{entry.entry_id}", "name": name,
                    "service": service, "entity_id": entity_id,
                    "user_id": entry.data.get("user_id") or None,
                    "source": MOBILE, "available": bool(service or entity)})
    covered = {d["service"] for d in out if d["service"]}
    for s in sorted(services):
        if s in EXCLUDE or s.startswith("mobile_app_") or f"notify.{s}" in covered:
            continue
        out.append({"key": f"service:{s}", "name": clean_name(s.replace("_", " ")), "service": f"notify.{s}",
                    "entity_id": "", "user_id": None, "source": "service", "available": True})
    out.sort(key=lambda d: (d["name"].casefold(), d["key"]))
    return out


def apply_links(devices: list[dict], links: dict | None) -> list[dict]:
    """Apply the links an admin corrected by hand (``notify_devices`` from the admin config)."""
    overrides = (links or {}).get("overrides") or {}
    out = []
    for d in devices:
        d = dict(d)
        if d["key"] in overrides:
            d["user_id"] = overrides[d["key"]] or None
            d["linked_by_admin"] = True
        out.append(d)
    return out


def for_user(devices: list[dict], user_id: str) -> list[dict]:
    return [d for d in devices if d.get("user_id") == user_id]


def resolve(devices: list[dict], user_id: str, settings: dict | None) -> dict | None:
    """The device this person uses: their own choice, else their only device (none if they have several)."""
    own = for_user(devices, user_id)
    if not own:
        return None
    settings = settings or {}
    want = str(settings.get("notify_device") or "")
    if not want and settings.get("notify_service"):
        # Setting from before devices were linked to people: a notify service name
        want = next((d["key"] for d in own if d["service"] == settings["notify_service"]), "")
    hit = next((d for d in own if d["key"] == want), None)
    if hit:
        return hit
    return own[0] if len(own) == 1 else None


def clean_links(value: dict | None) -> dict:
    """Validated admin input: device key -> user id (empty = as Home Assistant says)."""
    value = value or {}
    return {"overrides": {str(k): str(v) for k, v in (value.get("overrides") or {}).items() if v}}


async def async_send(hass, device: dict, title: str, message: str, url: str = "", tag: str = "", context=None) -> None:
    """Send one push message to a device (with a click-through link where the app supports it)."""
    if device.get("service"):
        data: dict = {"title": title, "message": message}
        if url:
            data["data"] = {"url": url, "clickAction": url, "tag": tag}
        await hass.services.async_call("notify", device["service"].split(".", 1)[1], data,
                                       blocking=False, context=context)
    elif device.get("entity_id"):
        await hass.services.async_call("notify", "send_message", {"title": title, "message": message},
                                       target={"entity_id": device["entity_id"]}, blocking=False, context=context)
    else:
        raise ValueError("Gerät nicht erreichbar")
