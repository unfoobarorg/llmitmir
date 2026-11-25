"""Kontextgröße: bekannte Werte, Vorgabe des Admins und die Grenze aus der Fehlermeldung des Servers (ctxlimit.py)."""
from __future__ import annotations

import asyncio

import pytest
from _lm import load

CL = load("ctxlimit")
const = load("const")
prov = load("provider")

DAY = 86400.0

VLLM = ('{"object":"error","message":"This model\'s maximum context length is 262144 tokens. However, you requested '
        '300512 tokens (300000 in the messages, 512 in the completion). Please reduce the length of the messages or '
        'completion.","type":"BadRequestError","param":null,"code":400}')
VLLM_NEW = ("'max_tokens' or 'max_completion_tokens' is too large: 1000. This model's maximum context length is "
            "131072 tokens and your request has 130500 input tokens (1000 > 131072 - 130500).")
SGLANG = ("Requested token count exceeds the model's maximum context length of 32768 tokens. You requested a total "
          "of 40000 tokens: 39000 tokens from the input messages and 1000 tokens for the completion.")
OPENAI = ("This model's maximum context length is 128,000 tokens. However, your messages resulted in 130,211 tokens. "
          "Please reduce the length of the messages.")
MAXLEN = "The decoder prompt (length 70000) is longer than the maximum model length of 65536. Make sure that `max_model_len` is no smaller"
NO_NUMBER = '{"error":{"code":"context_length_exceeded","message":"Input is too long for the requested model."}}'


@pytest.mark.parametrize("text,limit", [
    (VLLM, 262_144), (VLLM_NEW, 131_072), (SGLANG, 32_768), (OPENAI, 128_000), (NO_NUMBER, 0),
    ("HTTP 400: " + VLLM[:300], 262_144),
])
def test_context_errors_are_recognised_with_their_limit(text, limit):
    assert CL.parse_limit(text) == limit


def test_maximum_model_length_wording():
    assert CL.parse_limit("maximum model length of 65536 tokens; context length exceeded") == 65_536
    assert CL.parse_limit(MAXLEN) in (0, 65_536)  # erkannt als „zu lang“; Zahl nicht zwingend


@pytest.mark.parametrize("text", [
    "", None, "HTTP 400: model not found", "HTTP 422: temperature must be <= 2", "HTTP 500: internal error",
    "Schlüssel abgelehnt (HTTP 401)", "HTTP 400: max_tokens must be at least 1",
])
def test_other_errors_are_not_context_errors(text):
    assert CL.parse_limit(text) is None


def test_effective_size_admin_known_default_and_server_cap():
    now = 1000 * DAY
    assert CL.effective(None, None, 256_000, 128_000, now) == 256_000
    assert CL.effective(None, None, None, 128_000, now) == 128_000
    assert CL.effective(500_000, None, 256_000, 128_000, now) == 500_000            # Admin geht vor
    assert CL.effective("", None, 256_000, 128_000, now) == 256_000
    cap = {"n": 131_072, "at": now - DAY}
    assert CL.effective(None, cap, 1_000_000, 128_000, now) == 131_072             # Server nennt weniger
    assert CL.effective(500_000, cap, 1_000_000, 128_000, now) == 131_072          # auch unter dem Admin-Wert
    assert CL.effective(64_000, cap, 1_000_000, 128_000, now) == 64_000            # nie nach oben
    old = {"n": 131_072, "at": now - (CL.LEARN_DAYS + 1) * DAY}
    assert CL.effective(None, old, 1_000_000, 128_000, now) == 1_000_000           # abgelaufen: wieder versuchen
    assert CL.effective(None, "kaputt", 256_000, 128_000, now) == 256_000


def test_learn_and_view():
    store: dict = {}
    assert not CL.learn(store, "m", 0, 10.0) and not CL.learn(store, "", 50_000, 10.0)
    assert CL.learn(store, "m", 131_072, 10.0) and store["m"] == {"n": 131_072, "at": 10.0}
    assert CL.learn(store, "m", 131_072, 20.0) and store["m"]["at"] == 20.0      # bestätigt: Frist neu
    assert CL.learn(store, "m", 65_536, 30.0) and store["m"]["n"] == 65_536
    store["alt"] = {"n": 32_768, "at": 30.0 - (CL.LEARN_DAYS + 1) * DAY}
    assert CL.view(store, 30.0) == {"m": 65_536}


def test_known_context_follows_the_provider_list():
    k = const.KNOWN_CONTEXT
    assert k["deepseek-v4-flash-0731"] == 1_000_000 and k["glm-5.3-flash"] == 1_000_000
    assert k["gemma-4-31b-it"] == 256_000 and k["qwen3-omni-30b-a3b-instruct"] == 256_000
    assert k["qwen3-30b-a3b-instruct-2507"] == 256_000
    assert all(v >= CL.MIN_CONTEXT for v in k.values())


class _Resp:
    def __init__(self, status, text):
        self.status, self._text, self.headers = status, text, {}

    async def text(self):
        return self._text

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, status, text):
        self.status, self.text, self.bodies = status, text, []

    def post(self, url, json=None, **kw):
        self.bodies.append(json)
        return _Resp(self.status, self.text)


async def _drain(p, body):
    async for _ in p.chat_stream("k", body, interactive=True, max_wait=1):
        pass


def test_too_long_does_not_switch_off_the_thinking_switch():
    s = _Session(400, VLLM)
    p = prov.Provider(s, "https://x/v1")
    body = {"model": "m", "messages": [], "chat_template_kwargs": {"enable_thinking": False}}
    with pytest.raises(prov.ProviderError, match="maximum context length is 262144"):
        asyncio.run(_drain(p, body))
    assert p.template_kwargs_ok and len(s.bodies) == 1
    # ein anderer 400 mit dem Schalter: wie bisher ohne ihn weiter
    s2 = _Session(400, "unknown field chat_template_kwargs")
    p2 = prov.Provider(s2, "https://x/v1")
    with pytest.raises(prov.ProviderError):
        asyncio.run(_drain(p2, body))
    assert not p2.template_kwargs_ok and "chat_template_kwargs" not in s2.bodies[-1]
