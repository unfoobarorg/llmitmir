"""OpenAI-compatible provider client with throttling, retries and rate-limit tracking."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Awaitable, Callable

import aiohttp

_LOGGER = logging.getLogger(__name__)

RETRY_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class ProviderError(Exception):
    """Non-retryable provider error."""


class QuotaExhausted(Exception):
    """Daily/hourly key limit reached; contains seconds until reset."""

    def __init__(self, message: str, reset_in: float) -> None:
        super().__init__(message)
        self.reset_in = reset_in


@dataclass
class KeyState:
    """Throttle and limit state of one API key (shared by all users of that key)."""

    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    last: float = 0.0
    window: list[float] = field(default_factory=list)
    limits: dict[str, Any] = field(default_factory=dict)  # parsed x-ratelimit-* headers
    updated: float = 0.0
    waiting_interactive: int = 0

    def snapshot(self) -> dict:
        lim = dict(self.limits)
        # Re-base reset times to "now" so the UI can count down.
        age = time.time() - self.updated if self.updated else 0
        for k, v in list(lim.items()):
            if k.startswith("reset_") and isinstance(v, (int, float)):
                lim[k] = max(0, round(v - age))
        lim["updated"] = self.updated
        return lim


def parse_rate_headers(headers: Any) -> dict:
    out: dict[str, Any] = {}
    for k, v in headers.items():
        kl = k.lower()
        if not kl.startswith("x-ratelimit-"):
            continue
        name = kl[len("x-ratelimit-"):]  # e.g. remaining-requests-day
        try:
            val: Any = float(v)
            val = int(val) if float(val).is_integer() else val
        except ValueError:
            # OpenAI style "6m0s" reset values
            val = _parse_duration(v)
        parts = name.split("-")
        if parts[0] in ("limit", "remaining", "reset"):
            out[f"{parts[0]}_{'_'.join(parts[1:])}"] = val
    return out


def _parse_duration(text: str) -> float | str:
    import re

    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:(\d+)ms)?", text.strip())
    if not m or not any(m.groups()):
        return text
    h, mi, s, ms = m.groups()
    return int(h or 0) * 3600 + int(mi or 0) * 60 + float(s or 0) + int(ms or 0) / 1000


class Provider:
    """Thin async client. One instance per base URL; key passed per call."""

    def __init__(self, session: aiohttp.ClientSession, base_url: str) -> None:
        self.session = session
        self.base_url = base_url.rstrip("/")
        self.keys: dict[str, KeyState] = {}

    def key_state(self, key: str) -> KeyState:
        return self.keys.setdefault(key, KeyState())

    async def _throttle(self, key: str, interactive: bool) -> None:
        """Respect 10 req / 10 s (and a small spacing); interactive calls overtake queued tasks."""
        st = self.key_state(key)
        if not interactive:
            # let waiting interactive calls go first
            for _ in range(600):
                if st.waiting_interactive == 0:
                    break
                await asyncio.sleep(0.5)
        else:
            st.waiting_interactive += 1
        try:
            async with st.lock:
                limit10 = int(st.limits.get("limit_requests_10s") or 10)
                while True:
                    t = time.time()
                    st.window = [x for x in st.window if t - x < 10.5]
                    if len(st.window) < max(1, limit10 - 1) and t - st.last >= 0.8:
                        break
                    await asyncio.sleep(0.4)
                st.last = time.time()
                st.window.append(st.last)
        finally:
            if interactive:
                st.waiting_interactive -= 1

    def _check_daily(self, key: str) -> None:
        st = self.key_state(key)
        snap = st.snapshot()
        for per in ("day", "hour"):
            rem = snap.get(f"remaining_requests_{per}")
            if isinstance(rem, int) and rem <= 0:
                reset = float(snap.get(f"reset_requests_{per}") or 60)
                if reset > 0:
                    raise QuotaExhausted(f"Limit des API-Schlüssels erreicht ({per})", reset)

    async def list_models(self, key: str) -> list[dict]:
        async with self.session.get(f"{self.base_url}/models", headers={"Authorization": f"Bearer {key}"},
                                    timeout=aiohttp.ClientTimeout(total=30)) as r:
            if r.status != 200:
                raise ProviderError(f"HTTP {r.status}: {(await r.text())[:200]}")
            data = await r.json(content_type=None)
        return data.get("data") or []

    async def transcribe(self, key: str, audio: bytes, filename: str, model: str, language: str | None) -> str:
        await self._throttle(key, True)
        form = aiohttp.FormData()
        form.add_field("file", audio, filename=filename, content_type="audio/wav")
        form.add_field("model", model)
        if language:
            form.add_field("language", language[:2])
        async with self.session.post(f"{self.base_url}/audio/transcriptions", data=form,
                                     headers={"Authorization": f"Bearer {key}"},
                                     timeout=aiohttp.ClientTimeout(total=180)) as r:
            self.key_state(key).limits.update(parse_rate_headers(r.headers))
            self.key_state(key).updated = time.time()
            if r.status != 200:
                raise ProviderError(f"HTTP {r.status}: {(await r.text())[:200]}")
            data = await r.json(content_type=None)
        return (data.get("text") or "").strip()

    async def chat_stream(
        self,
        key: str,
        body: dict,
        *,
        interactive: bool,
        max_wait: float,
        on_status: Callable[[str, dict], Awaitable[None]] | None = None,
        cancel: asyncio.Event | None = None,
    ) -> AsyncIterator[dict]:
        """Yield parsed SSE chunks. Retries with backoff until max_wait is used up."""
        body = dict(body, stream=True, stream_options={"include_usage": True})
        started = time.time()
        attempt = 0
        while True:
            attempt += 1
            try:
                self._check_daily(key)
                await self._throttle(key, interactive)
                timeout = aiohttp.ClientTimeout(total=None, sock_connect=30, sock_read=900)
                async with self.session.post(f"{self.base_url}/chat/completions", json=body, timeout=timeout,
                                             headers={"Authorization": f"Bearer {key}"}) as r:
                    st = self.key_state(key)
                    lim = parse_rate_headers(r.headers)
                    if lim:
                        st.limits.update(lim)
                        st.updated = time.time()
                    if r.status != 200:
                        text = (await r.text())[:400]
                        if r.status in RETRY_STATUS:
                            raise _Retry(f"HTTP {r.status}: {text}", _retry_after(r.headers, r.status))
                        raise ProviderError(f"HTTP {r.status}: {text}")
                    got_any = False
                    buf = b""
                    async for raw in r.content.iter_any():
                        if cancel is not None and cancel.is_set():
                            return
                        buf += raw
                        while b"\n" in buf:
                            line, buf = buf.split(b"\n", 1)
                            line = line.strip()
                            if not line.startswith(b"data:"):
                                continue
                            payload = line[5:].strip()
                            if payload == b"[DONE]":
                                return
                            try:
                                chunk = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            if "error" in chunk and not chunk.get("choices"):
                                raise _Retry(f"Stream-Fehler: {str(chunk['error'])[:300]}", 10)
                            got_any = True
                            yield chunk
                    if not got_any:
                        raise _Retry("Leere Antwort", 10)
                    return
            except QuotaExhausted as e:
                waited = time.time() - started
                if waited + e.reset_in > max_wait:
                    raise
                if on_status:
                    await on_status("quota_wait", {"seconds": round(e.reset_in), "reason": str(e)})
                await _sleep(min(e.reset_in + 5, 3600), cancel)
            except (_Retry, aiohttp.ClientError, asyncio.TimeoutError) as e:
                wait = e.wait if isinstance(e, _Retry) else min(15 * attempt, 120)
                wait = min(max(wait, 5), 600 if not interactive else 60)
                waited = time.time() - started
                if waited + wait > max_wait:
                    raise ProviderError(f"Modell nicht erreichbar nach {attempt} Versuchen: {e}") from e
                if on_status:
                    await on_status("retry", {"attempt": attempt, "seconds": round(wait), "reason": str(e)[:200]})
                await _sleep(wait, cancel)
            if cancel is not None and cancel.is_set():
                return


class _Retry(Exception):
    def __init__(self, message: str, wait: float) -> None:
        super().__init__(message)
        self.wait = wait


def _retry_after(headers: Any, status: int) -> float:
    ra = headers.get("Retry-After")
    if ra:
        try:
            return float(ra)
        except ValueError:
            pass
    if status == 429:
        try:
            return float(headers.get("x-ratelimit-reset-requests-10s") or 12)
        except ValueError:
            return 12
    return 20


async def _sleep(seconds: float, cancel: asyncio.Event | None) -> None:
    if cancel is None:
        await asyncio.sleep(seconds)
        return
    try:
        await asyncio.wait_for(cancel.wait(), timeout=seconds)
    except asyncio.TimeoutError:
        pass


class StreamAccumulator:
    """Collect content, reasoning, tool calls and usage from chunks."""

    def __init__(self) -> None:
        self.content = ""
        self.reasoning = ""
        self.tool_calls: dict[int, dict] = {}
        self.usage: dict = {}
        self.finish_reason: str | None = None
        self.model: str | None = None

    def feed(self, chunk: dict) -> tuple[str, str]:
        """Returns (content_delta, reasoning_delta)."""
        if chunk.get("usage"):
            self.usage = chunk["usage"]
        self.model = chunk.get("model") or self.model
        c_d = r_d = ""
        for ch in chunk.get("choices") or []:
            d = ch.get("delta") or {}
            if d.get("content"):
                c_d += d["content"]
            r = d.get("reasoning") or d.get("reasoning_content")
            if r:
                r_d += r
            for tc in d.get("tool_calls") or []:
                i = tc.get("index", 0)
                slot = self.tool_calls.setdefault(i, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                if tc.get("id"):
                    slot["id"] = tc["id"]
                fn = tc.get("function") or {}
                if fn.get("name"):
                    slot["function"]["name"] += fn["name"]
                if fn.get("arguments"):
                    slot["function"]["arguments"] += fn["arguments"]
            if ch.get("finish_reason"):
                self.finish_reason = ch["finish_reason"]
        self.content += c_d
        self.reasoning += r_d
        return c_d, r_d

    def calls(self) -> list[dict]:
        out = []
        for i in sorted(self.tool_calls):
            tc = self.tool_calls[i]
            if not tc["id"]:
                tc["id"] = f"call_{i}_{int(time.time() * 1000)}"
            if tc["function"]["name"]:
                out.append(tc)
        return out
