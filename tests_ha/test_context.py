"""Kontextgröße: Lehnt der Server eine Anfrage als zu lang ab, merkt sich LLMitMir die Grenze, kürzt und fragt neu."""
from __future__ import annotations

import time

DOMAIN = "llmitmir"
MODEL = "glm-5.3"
TOO_LONG = ("HTTP 400: {\"object\":\"error\",\"message\":\"This model's maximum context length is 8192 tokens. However, "
            "you requested 60000 tokens (60000 in the messages, 0 in the completion).\",\"code\":400}")


async def _ws(client, typ: str, **kw) -> dict:
    await client.send_json_auto_id({"type": f"{DOMAIN}/{typ}", **kw})
    return await client.receive_json()


def _with_models(m) -> None:
    from custom_components.llmitmir import models as MS

    fresh = [{"id": MODEL, "name": "GLM 5.3", "status": "ready", "demand": 0, "input": ["text"], "output": ["text"]}]
    known, _ = MS.merge_known([], fresh, time.time())
    m.config.data["models"] = {"known": known, "enabled": [MODEL]}
    m.config.data["shared_key"] = "sk-test"
    m._models_at = time.time()  # keine Abfrage beim Anbieter


async def test_a_request_the_server_calls_too_long_is_shortened_and_sent_again(hass, llmitmir, hass_ws_client,
                                                                             hass_admin_user):
    from custom_components.llmitmir.provider import ProviderError

    m = llmitmir["manager"]
    _with_models(m)
    assert m.context_size(MODEL) == 200_000
    chat = await m.create_chat(hass_admin_user.id, "chat", model=MODEL)
    st = await m.user_store(hass_admin_user.id)
    chat = await st.async_get_chat(chat["id"])
    long = "Lorem ipsum dolor sit amet. " * 50  # 1.400 Zeichen je Nachricht, zusammen weit über 8192 Tokens
    for i in range(40):
        chat["messages"].append({"id": f"u{i}", "role": "user", "content": f"Frage {i}: {long}", "created": time.time()})
        chat["messages"].append({"id": f"a{i}", "role": "assistant", "content": f"Antwort {i}: {long}"})
    await st.async_save_chat(chat)

    bodies: list[dict] = []

    async def fake_stream(key, body, **kw):
        bodies.append(body)
        if len(bodies) == 1:
            raise ProviderError(TOO_LONG)
        yield {"choices": [{"delta": {"content": "Fertig"}}]}

    m.provider.chat_stream = fake_stream
    admin = await hass_ws_client(hass)
    msg = await _ws(admin, "chat/send", chat_id=chat["id"], text="Und jetzt?", tools=[])
    assert msg["success"], msg
    await m.runs[msg["result"]["run_id"]].task

    assert len(bodies) == 2
    chars = lambda b: sum(len(x.get("content") or "") for x in b["messages"])  # noqa: E731
    assert chars(bodies[1]) < chars(bodies[0]) and chars(bodies[1]) <= 8192 * 0.75 * 3.2
    assert bodies[1]["messages"][-1]["content"].endswith("Und jetzt?")  # die neue Frage bleibt
    assert m.context_size(MODEL) == 8192
    assert m.config.data["models"]["context_learned"][MODEL]["n"] == 8192
    chat = await st.async_get_chat(chat["id"])
    assert chat["messages"][-1]["content"] == "Fertig" and chat["usage"]["context_max"] == 8192

    # die Admin-Ansicht zeigt die Grenze; Speichern der Modelle lässt sie stehen
    got = await _ws(admin, "admin/get")
    assert got["result"]["learned_context"] == {MODEL: 8192}
    assert (await _ws(admin, "admin/save", config={"models": {"context": {MODEL: 500_000}}}))["success"]
    assert m.context_size(MODEL) == 8192  # der Server hat das letzte Wort


async def test_other_errors_and_endless_too_long_still_end_the_run(hass, llmitmir, hass_admin_user):
    from custom_components.llmitmir import ctxlimit as CL
    from custom_components.llmitmir.agent import Run

    m = llmitmir["manager"]
    _with_models(m)
    run = Run(id="r1", user_id=hass_admin_user.id, chat_id="c1", kind="chat")
    assert not await m.note_context_error(run, MODEL, "HTTP 400: model not found")
    assert run.ctx_retries == 0 and run.ctx_factor == 1.0
    # ohne Zahl: nichts gemerkt, aber stärker gekürzt
    assert await m.note_context_error(run, MODEL, '{"code":"context_length_exceeded"}')
    assert run.ctx_factor == CL.SHRINK and m.context_size(MODEL) == 200_000
    for _ in range(CL.MAX_RETRIES - 1):
        assert await m.note_context_error(run, MODEL, TOO_LONG)
    assert not await m.note_context_error(run, MODEL, TOO_LONG)  # irgendwann ist Schluss: der Fehler kommt an
