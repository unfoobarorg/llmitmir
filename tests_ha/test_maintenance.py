"""Wartungsmodus in einem echten Home Assistant: ankündigen, warten, bereit, absagen; Sensor; neue Läufe gesperrt."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

DOMAIN = "llmitmir"
SENSOR = "sensor.llmitmir_laufende_agenten"


async def _ok(client, typ: str, **kw):
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    msg = await client.receive_json()
    assert msg["success"], msg
    return msg["result"]


async def test_restart_is_announced_waits_for_agents_and_blocks_new_runs(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir import maintenance as MT
    from custom_components.llmitmir.agent import Run

    m = llmitmir["manager"]
    admin = await hass_ws_client(hass)
    chat = await _ok(admin, "chat/create", kind="chat")
    await hass.async_block_till_done()
    assert hass.states.get(SENSOR).state == "0" and hass.states.get(SENSOR).attributes["wartung"] == "off"

    m.runs["r1"] = Run(id="r1", user_id=hass_admin_user.id, chat_id="x", kind="cowork", agent_id="agt-x")
    m._runs_changed()
    with patch.object(MT, "POLL", 0.01):
        res = await hass.services.async_call(DOMAIN, "prepare_restart", {"minutes": 0, "max_wait": 5, "reason": "Update"},
                                             blocking=True, return_response=True)
        assert res["state"] == "announced"
        st = await m.user_store(hass_admin_user.id)
        assert any(e["title"] == "Neustart angekündigt" and "Update" in e["text"] for e in st.meta["inbox"])
        for _ in range(50):
            await asyncio.sleep(0.01)
            if m.maintenance.state["state"] == "draining":
                break
        assert m.maintenance.state["state"] == "draining"
        await hass.async_block_till_done()
        assert hass.states.get(SENSOR).state == "1" and hass.states.get(SENSOR).attributes["wartung"] == "draining"
        await admin.send_json_auto_id({"type": f"{DOMAIN}/chat/send", "chat_id": chat["id"], "text": "Hallo"})
        msg = await admin.receive_json()
        assert not msg["success"] and "startet gleich neu" in msg["error"]["message"]
        boot = await _ok(admin, "bootstrap")
        assert boot["maintenance"]["state"] == "draining" and boot["maintenance"]["message"]
        m.runs.pop("r1")                      # der Agent wird fertig
        m._runs_changed()
        for _ in range(100):
            await asyncio.sleep(0.01)
            if m.maintenance.state["state"] == "ready":
                break
    assert m.maintenance.state["state"] == "ready" and not m.maintenance.state["waited_out"]
    await hass.services.async_call(DOMAIN, "cancel_restart", {}, blocking=True, return_response=True)
    assert m.maintenance.state == {"state": "off"}
    assert any(e["title"] == "Neustart abgesagt" for e in st.meta["inbox"])


async def test_restart_happens_when_asked(hass, llmitmir):
    m = llmitmir["manager"]
    calls = []

    async def fake_restart(call):
        calls.append(call)

    hass.services.async_register("homeassistant", "restart", fake_restart)
    with patch("custom_components.llmitmir.maintenance.POLL", 0.01), \
            patch.object(m.maintenance, "_tell_everybody", AsyncMock()):
        await m.maintenance.prepare(minutes=0, max_wait=1, restart=True)
        for _ in range(100):
            await asyncio.sleep(0.01)
            if calls:
                break
    assert calls and m.maintenance.state["state"] == "ready"
