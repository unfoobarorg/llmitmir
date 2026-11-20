"""Externe Modelle des Hauptanbieters (SAIA kennzeichnet weitergeleitete Modelle als „External“): dieselben Regeln wie
für die kostenpflichtigen externen Anbieter – nur ohne Kosten."""
from __future__ import annotations

import json
import time

import pytest

DOMAIN = "llmitmir"
SECRET = "sk-geheim-0123456789abcdefghij"
EXT = "openai-gpt-5.2"


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


async def _ok(client, typ: str, **kw):
    msg = await _ws(client, typ, **kw)
    assert msg["success"], msg
    return msg["result"]


def _with_models(m) -> None:
    """Modellliste wie von SAIA: ein offenes Modell und eines, das SAIA an OpenAI weiterleitet."""
    from custom_components.llmitmir import models as MS

    fresh = [{"id": "glm-5.3", "name": "GLM 5.3", "status": "ready", "demand": 0, "input": ["text"], "output": ["text"]},
             {"id": EXT, "name": "GPT-5.2 (External)", "status": "ready", "demand": 0, "input": ["text", "image"],
              "output": ["text"]}]
    known, _ = MS.merge_known([], fresh, time.time())
    m.config.data["models"] = {"known": known, "enabled": [x["id"] for x in known]}
    m._models_at = time.time()  # keine Abfrage beim Anbieter


async def test_saia_external_models_follow_the_rules_for_external_models(hass, llmitmir, hass_ws_client, hass_admin_user):
    from custom_components.llmitmir.agent import QuotaError

    m = llmitmir["manager"]
    uid = hass_admin_user.id
    _with_models(m)
    admin = await hass_ws_client(hass)
    st = await m.user_store(uid)

    assert m.is_external(EXT) and not m.is_external("glm-5.3") and m.is_external("foundry:claude-opus-5-5")
    # nie automatisch gewählt
    assert m.default_model(uid, "chat") == "glm-5.3" and m.default_model(uid, "agent") == "glm-5.3"
    # auch als Vorgabe des Admins nicht
    m.config.data["models"]["defaults"] = {"chat": EXT}
    assert m.default_model(uid, "chat") == "glm-5.3"

    # nur für Personen, die der Admin freigibt
    assert not m.may_use_model(uid, EXT)
    assert EXT not in [x["id"] for x in m.models_for_user(uid)]
    assert not m.external_view(uid)["any_access"]
    await _ok(admin, "admin/save", config={"model_access": {EXT: [uid]}})
    row = next(x for x in m.models_for_user(uid) if x["id"] == EXT)
    assert row["external"] and not row["billed"] and row["price"] is None and "weitergeleitet" in row["operator"]
    view = m.external_view(uid)
    assert view["any_access"] and view["main_external"] and not view["has_access"]  # keine Kosten, kein Monatslimit

    # Zustimmung nötig
    with pytest.raises(QuotaError, match="Zustimmung"):
        m.check_external(uid, EXT)
    await _ok(admin, "external/consent", accept=True)
    m.check_external(uid, EXT)

    # nicht als Standard (persönlich, Projekt) festzulegen
    msg = await _ws(admin, "settings/save", settings={"model_chat": EXT})
    assert not msg["success"] and "Standard" in msg["error"]["message"]
    msg = await _ws(admin, "project/save", project={"name": "P", "model_chat": EXT})
    assert not msg["success"]

    # gesperrte Projekte
    proj = await _ok(admin, "project/save", project={"name": "Sensibel", "no_external": True})
    with pytest.raises(QuotaError, match="gesperrt"):
        m._check_chat_external(uid, st, {"project_id": proj["id"]}, EXT)

    # Teilaufgaben nur, wenn die Person das Modell für den Hauptchat ausdrücklich gewählt hat
    from custom_components.llmitmir import subchats as SC

    pick = lambda choice, main, auto: SC.pick_model(choice, main, auto, "glm-5.3", "glm-5.3",  # noqa: E731
                                                     m.is_external, m.model_usable)
    assert pick(EXT, "glm-5.3", True)[0] == "glm-5.3"
    assert pick("wie_hauptchat", EXT, False)[0] == EXT


async def test_saia_external_models_see_only_released_credentials_and_no_secrets(hass, llmitmir, hass_ws_client,
                                                                                hass_admin_user):
    from custom_components.llmitmir.agent import Run, ToolContext

    m = llmitmir["manager"]
    uid = hass_admin_user.id
    _with_models(m)
    admin = await hass_ws_client(hass)
    await _ok(admin, "credential/save", credential={"name": "Bank", "type": "other", "fields": {"token": SECRET},
                                                    "secret_fields": ["token"]})
    await _ok(admin, "credential/save", credential={"name": "Wetter", "type": "other", "fields": {"token": "x" * 24},
                                                    "secret_fields": ["token"], "external": True})
    st = await m.user_store(uid)
    msgs = [{"id": "m1", "role": "user", "content": f"Mein Token ist {SECRET}", "created": time.time()},
            {"id": "m2", "role": "assistant", "content": "", "tool_calls": [{"id": "t1"}, {"id": "t2"}]},
            {"id": "m3", "role": "tool", "tool_call_id": "t1", "args": {"zugang": "Bank"}, "content": "Kontostand 1.234 €"},
            {"id": "m4", "role": "tool", "tool_call_id": "t2", "args": {"zugang": "Wetter"}, "content": "Sonnig"}]

    def ctx_for(model: str) -> ToolContext:
        chat = {"id": "c1", "kind": "chat", "model": model, "messages": msgs}
        return ToolContext(m, hass_admin_user, st, chat, Run(id="r1", user_id=uid, chat_id="c1", kind="chat"), None)

    # beim Hauptanbieter: alles wie bisher
    inside = ctx_for("glm-5.3")
    assert not inside.external and set(inside.creds) == set(st.meta["credentials"])
    assert "Kontostand" in json.dumps(inside.api_messages(), ensure_ascii=False)

    out = ctx_for(EXT)
    assert out.external and not out.billed
    assert [c["name"] for c in out.creds.values()] == ["Wetter"]
    text = json.dumps(out.api_messages(), ensure_ascii=False)
    assert "Kontostand" not in text and "Bank" in text and "für externe Modelle gesperrt" in text
    assert "Sonnig" in text
    assert SECRET not in text
    assert "## Externes Modell" in out.system_prompt()
