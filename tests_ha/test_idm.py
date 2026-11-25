"""Nutzerverwaltung mit AD/LDAP in einem echten Home Assistant: Probelauf, Abgleich, Deaktivieren, Admin-Schutz."""
from __future__ import annotations

from unittest.mock import patch

DOMAIN = "llmitmir"
NUTZER = "CN=HA-Nutzer,DC=example,DC=org"
ADMINS = "CN=HA-Admins,DC=example,DC=org"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


async def test_directory_sync_creates_updates_and_deactivates(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir import idm as IDM

    admin = await hass_ws_client(hass)
    off = await _ws(admin, "admin/idm_preview")
    assert not off["success"] and "ausgeschaltet" in off["error"]["message"]
    provider = hass.auth.auth_providers[0].type
    view = await _ok(admin, "admin/save", config={"idm": {
        "enabled": True, "server": "ldaps://dc.example.org", "bind_dn": "CN=svc", "bind_password": "geheim",
        "base_dn": "DC=example,DC=org", "auth_provider": provider,
        "mappings": [{"group": NUTZER, "llmitmir": True}, {"group": ADMINS, "admin": True}]}})
    assert view["idm"]["bind_password"] == "•••" and provider in view["auth_providers"]

    entries = [{"username": "anna", "name": "Anna", "groups": [NUTZER], "disabled": False},
               {"username": "bernd", "name": "Bernd", "groups": [ADMINS], "disabled": False}]
    with patch.object(IDM, "read_directory", return_value=entries):
        prev = await _ok(admin, "admin/idm_preview")
        assert sorted((a["action"], a["username"]) for a in prev["actions"]) == [("create", "anna"), ("create", "bernd")]
        assert not [u for u in await hass.auth.async_get_users() if u.name in ("Anna", "Bernd")]  # Probelauf ändert nichts
        res = await _ok(admin, "admin/idm_apply")
    assert res["counts"] == {"create": 2} and res["errors"] == []
    users = {u.name: u for u in await hass.auth.async_get_users()}
    assert not users["Anna"].is_admin and users["Bernd"].is_admin and users["Anna"].credentials
    cfg = llmitmir["manager"].config.data
    assert users["Anna"].id in cfg["allowed_users"] and set(cfg["idm"]["managed"]) == {"anna", "bernd"}

    # Anna fällt aus der Gruppe, Bernd ist nur noch Nutzer
    entries = [{"username": "bernd", "name": "Bernd", "groups": [NUTZER], "disabled": False}]
    with patch.object(IDM, "read_directory", return_value=entries):
        res = await _ok(admin, "admin/idm_apply")
    users = {u.name: u for u in await hass.auth.async_get_users()}
    assert not users["Anna"].is_active and not users["Bernd"].is_admin and users["Anna"].id in {u.id for u in users.values()}
    assert hass_admin_user.is_active and hass_admin_user.is_admin                 # von Hand angelegt: unberührt
    ev = (await _ok(admin, "admin/audit", filters={"kind": "admin_action"}))["events"]
    assert ev[0]["tool"] == "idm_sync"


async def test_missing_auth_provider_stops_creating(hass, llmitmir, hass_ws_client):
    from custom_components.llmitmir import idm as IDM

    admin = await hass_ws_client(hass)
    await _ok(admin, "admin/save", config={"idm": {
        "enabled": True, "server": "ldaps://dc.example.org", "bind_dn": "CN=svc", "bind_password": "x",
        "base_dn": "DC=example,DC=org", "auth_provider": "command_line", "mappings": [{"group": NUTZER}]}})
    with patch.object(IDM, "read_directory", return_value=[{"username": "c", "name": "C", "groups": [NUTZER], "disabled": False}]):
        msg = await _ws(admin, "admin/idm_apply")
    assert not msg["success"] and "command_line" in msg["error"]["message"]
