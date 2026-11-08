"""Claude via the Anthropic API or Microsoft Foundry, with the official Anthropic SDK.

The client speaks the same stream format as provider.Provider (OpenAI-style chunks), so the agent loop does not care
where a model runs. Every request that reached the model is reported to ``on_usage`` exactly once – also when it is
stopped or fails half-way – so the cost ledger never misses tokens.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable

from . import claude_convert as CC
from . import pricing as PR
from . import providers as PV
from .provider import ProviderError, QuotaExhausted, _sleep

try:
    import anthropic
except ImportError:  # requirement not installed (yet): external models stay unavailable
    anthropic = None

_LOGGER = logging.getLogger(__name__)

MAX_TOKENS = 32_000
BLOCK_AUTH = 15 * 60     # a key that was refused: try again after this long
BLOCK_CREDIT = 60 * 60   # no credit left
BLOCK_RATE_MIN = 5 * 60  # a rate limit this long or longer counts as "provider not usable right now"
LEGACY = {"claude-haiku-4-5"}  # no adaptive thinking, no effort


@dataclass
class ExtState:
    blocked_until: float = 0.0
    reason: str = ""
    last_ok: float = 0.0
    last_error: str = ""
    limits: dict = field(default_factory=dict)

    def blocked(self) -> bool:
        return self.blocked_until > time.time()

    def view(self) -> dict:
        return {"blocked": self.blocked(), "blocked_for": max(0, round(self.blocked_until - time.time())),
                "reason": self.reason if self.blocked() else "", "last_ok": self.last_ok, "last_error": self.last_error,
                "limits": self.limits}


def available() -> bool:
    return anthropic is not None


class ClaudeClient:
    """One per configured external provider (Anthropic API or a Foundry resource)."""

    def __init__(self, kind: str, key: str, endpoint: str, executor: Callable[..., Awaitable[Any]]) -> None:
        self.kind, self.key, self.endpoint = kind, key, endpoint
        self.state = ExtState()
        self._executor = executor
        self._client = None
        self._lock = asyncio.Lock()

    @property
    def sig(self) -> tuple:
        return self.kind, self.key, self.endpoint

    def configured(self) -> bool:
        return bool(self.key) and (self.kind != PV.FOUNDRY or bool(self.endpoint))

    async def client(self):
        if anthropic is None:
            raise ProviderError("Das Paket „anthropic“ ist nicht installiert – Home Assistant neu starten.")
        if self._client is None:
            async with self._lock:
                if self._client is None:
                    timeout = anthropic.Timeout(900.0, connect=30.0)
                    if self.kind == PV.FOUNDRY:
                        base, resource = PV.foundry_base(self.endpoint)
                        kw = {"base_url": base} if base else {"resource": resource}

                        def make():
                            return anthropic.AsyncAnthropicFoundry(api_key=self.key, max_retries=0, timeout=timeout, **kw)
                    else:
                        def make():
                            return anthropic.AsyncAnthropic(api_key=self.key, max_retries=0, timeout=timeout)
                    # creating the HTTP client loads certificates: not in the event loop
                    self._client = await self._executor(make)
        return self._client

    def block(self, seconds: float, reason: str) -> None:
        self.state.blocked_until = max(self.state.blocked_until, time.time() + seconds)
        self.state.reason = reason
        _LOGGER.info("External provider %s blocked for %ds: %s", self.kind, seconds, reason)

    def _headers(self, headers: Any) -> None:
        lim = {}
        for k, v in (headers or {}).items():
            kl = k.lower()
            if kl.startswith("anthropic-ratelimit-") or kl.startswith("x-ratelimit-"):
                lim[kl.split("ratelimit-", 1)[1]] = v
        if lim:
            self.state.limits = lim

    # ------------------------------------------------------------------ models
    async def list_models(self, candidates: list[str] | None = None) -> list[dict]:
        """Models of the Anthropic API, or the Claude deployments that answer in this Foundry resource."""
        c = await self.client()
        if self.kind == PV.ANTHROPIC:
            out = []
            try:
                async for m in c.models.list(limit=100):
                    if not str(m.id).startswith("claude"):
                        continue
                    out.append({"id": m.id, "name": getattr(m, "display_name", None) or m.id,
                                "context": getattr(m, "max_input_tokens", None) or _context(m.id),
                                "input": ["text", "image"], "output": ["text", "thought"]})
            except anthropic.AuthenticationError as e:
                raise ProviderError(f"Schlüssel abgelehnt: {_short(e)}") from e
            except anthropic.APIError as e:
                raise ProviderError(_short(e)) from e
            return out
        names = list(dict.fromkeys([*(candidates or []), *PR.CLAUDE_CANDIDATES]))
        sem = asyncio.Semaphore(4)
        found: dict[str, dict] = {}
        auth_error: list[str] = []

        async def probe(name: str) -> None:
            async with sem:
                try:
                    await c.messages.count_tokens(model=name, messages=[{"role": "user", "content": "Hallo"}])
                except anthropic.NotFoundError:
                    return
                except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as e:
                    auth_error.append(_short(e))
                    return
                except anthropic.APIError as e:  # 400 for unknown names, 5xx, network: not (reliably) there
                    _LOGGER.debug("Foundry probe %s: %s", name, e)
                    return
                found[name] = {"id": name, "name": _display(name), "context": _context(name),
                               "input": ["text", "image"], "output": ["text", "thought"]}

        await asyncio.gather(*(probe(n) for n in names))
        if auth_error and not found:
            raise ProviderError(f"Schlüssel oder Endpunkt abgelehnt: {auth_error[0]}")
        return [found[n] for n in names if n in found]

    # ------------------------------------------------------------------ chat
    async def chat_stream(self, model_id: str, req: dict, *, interactive: bool, max_wait: float, effort: str,
                          on_usage: Callable[[dict], None],
                          on_status: Callable[[str, dict], Awaitable[None]] | None = None,
                          cancel: asyncio.Event | None = None) -> AsyncIterator[dict]:
        """Stream one answer. ``req``: system, messages, tools, tool_choice in Claude's format (claude_convert)."""
        started = time.time()
        attempt = 0
        messages = req["messages"]
        stripped = False
        while True:
            attempt += 1
            if self.state.blocked():
                raise QuotaExhausted(f"{PV.INFO[self.kind]['label']}: {self.state.reason}", self.state.blocked_until - time.time())
            tr = CC.StreamTranslator()
            booked = False
            try:
                kw: dict[str, Any] = {"model": model_id, "max_tokens": MAX_TOKENS, "messages": messages,
                                      "cache_control": {"type": "ephemeral"}}
                if PR.base_id(model_id) not in LEGACY:  # adaptive thinking and effort exist from Claude 4.6 on
                    kw["thinking"] = {"type": "adaptive", "display": "summarized"}
                    kw["output_config"] = {"effort": effort}
                if req.get("system"):
                    kw["system"] = req["system"]
                if req.get("tools"):
                    kw["tools"] = req["tools"]
                    if req.get("tool_choice"):
                        kw["tool_choice"] = req["tool_choice"]
                c = await self.client()
                async with c.messages.stream(**kw) as stream:
                    self._headers(stream.response.headers)
                    async for ev in stream:
                        if cancel is not None and cancel.is_set():
                            return
                        ch = tr.feed(ev)
                        if ch:
                            yield ch
                    final = stream.current_message_snapshot
                blocks = CC.clean_blocks([b.model_dump(mode="json") for b in (final.content if final else [])])
                self.state.last_ok, self.state.last_error = time.time(), ""
                booked = True
                on_usage(dict(tr.usage))
                yield tr.usage_chunk() | {"_claude": {"blocks": blocks, "stop_reason": tr.stop_reason}}
                return
            except anthropic.BadRequestError as e:
                text = str(e)
                if not stripped and ("different conversation" in text or ("signature" in text and "thinking" in text)):
                    # the conversation changed since Claude thought about it (e.g. a new skill in the system prompt):
                    # go on without the old thoughts
                    _LOGGER.info("Claude no longer accepts earlier thinking blocks, retrying without them")
                    messages = CC.strip_thinking(messages)
                    stripped = True
                    continue
                if "credit balance" in text.lower():
                    self.block(BLOCK_CREDIT, "kein Guthaben mehr")
                self.state.last_error = _short(e)
                raise ProviderError(f"Anfrage abgelehnt: {_short(e)}") from e
            except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as e:
                self.block(BLOCK_AUTH, "Schlüssel abgelehnt")
                self.state.last_error = _short(e)
                raise ProviderError(f"Schlüssel abgelehnt: {_short(e)}") from e
            except anthropic.NotFoundError as e:
                self.state.last_error = _short(e)
                raise ProviderError(f"Modell „{model_id}“ nicht gefunden (Deployment-Name prüfen): {_short(e)}") from e
            except anthropic.RateLimitError as e:
                wait = _retry_after(e, 30)
                if isinstance(e, getattr(anthropic, "EnforcedSpendLimitReachedError", ())) or wait >= BLOCK_RATE_MIN:
                    self.block(max(wait, BLOCK_RATE_MIN), "Limit erreicht")
                    raise QuotaExhausted(f"{PV.INFO[self.kind]['label']}: Limit erreicht", max(wait, BLOCK_RATE_MIN)) from e
                if time.time() - started + wait > max_wait:
                    raise QuotaExhausted(f"{PV.INFO[self.kind]['label']}: Limit erreicht", wait) from e
                if on_status:
                    await on_status("retry", {"attempt": attempt, "seconds": round(wait), "reason": f"429 {_short(e)}"})
                await _sleep(wait, cancel)
            except (anthropic.InternalServerError, anthropic.APIConnectionError) as e:
                # 5xx, overloaded (529), timeouts, connection problems
                wait = min(max(_retry_after(e, 10 * attempt), 5), 60 if interactive else 300)
                if time.time() - started + wait > max_wait:
                    self.state.last_error = _short(e)
                    raise ProviderError(f"Modell nicht erreichbar nach {attempt} Versuchen: {_short(e)}") from e
                if on_status:
                    await on_status("retry", {"attempt": attempt, "seconds": round(wait), "reason": _short(e)})
                await _sleep(wait, cancel)
            except anthropic.APIStatusError as e:
                self.state.last_error = _short(e)
                raise ProviderError(f"HTTP {e.status_code}: {_short(e)}") from e
            finally:
                if tr.started and not booked:
                    on_usage(dict(tr.usage))  # stopped or failed half-way: what was used is still billed
            if cancel is not None and cancel.is_set():
                return


def _retry_after(e: Any, default: float) -> float:
    try:
        v = e.response.headers.get("retry-after")
        return float(v) if v else default
    except (AttributeError, ValueError):
        return default


def _short(e: Any) -> str:
    msg = getattr(e, "message", None) or str(e)
    body = getattr(e, "body", None)
    if isinstance(body, dict):
        msg = ((body.get("error") or {}).get("message")) or msg
    return re.sub(r"\s+", " ", str(msg))[:300]


def _context(model_id: str) -> int:
    return 200_000 if PR.base_id(model_id) in ("claude-haiku-4-5",) else 1_000_000


def _display(model_id: str) -> str:
    b = PR.base_id(model_id)
    m = re.match(r"claude-([a-z]+)-(\d+)(?:-(\d+))?$", b)
    if not m:
        return model_id
    name = f"Claude {m.group(1).capitalize()} {m.group(2)}" + (f".{m.group(3)}" if m.group(3) else "")
    return name if b == model_id else f"{name} ({model_id})"
