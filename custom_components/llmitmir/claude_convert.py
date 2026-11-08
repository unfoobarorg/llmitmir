"""Translation between LLMitMir's chat format (OpenAI style) and the Claude Messages API.

Pure functions without Home Assistant or SDK imports (unit-tested).

Claude binds its thinking blocks to the conversation that produced them: the system prompt, the tools and every earlier
message must stay byte-identical, otherwise a replayed block is rejected. So the conversion is deterministic – the same
stored chat always gives the same request – and Claude's own answers are replayed exactly as they came back
(``claude_blocks``). Nothing is shortened or dropped later on; reminders are stored as ``notes`` on the message they
follow instead of being added for one request only.
"""
from __future__ import annotations

import json
import re
from typing import Any

FINISH = {"end_turn": "stop", "tool_use": "tool_calls", "max_tokens": "length", "stop_sequence": "stop",
          "refusal": "refusal", "pause_turn": "stop", "model_context_window_exceeded": "length"}
ABORTED = "Abgebrochen – für diesen Aufruf liegt kein Ergebnis vor."


def tool_id(raw: Any) -> str:
    """Claude accepts only [A-Za-z0-9_-] in tool ids; ids from other providers are mapped the same way everywhere."""
    return re.sub(r"[^A-Za-z0-9_-]", "_", str(raw or "")) or "call"


def clean_blocks(blocks: list[dict]) -> list[dict]:
    """Only the fields the API takes back, in a fixed shape (thinking blocks unchanged incl. signature)."""
    out = []
    for b in blocks or []:
        t = b.get("type")
        if t == "text":
            if b.get("text"):
                out.append({"type": "text", "text": b["text"]})
        elif t == "thinking":
            out.append({"type": "thinking", "thinking": b.get("thinking") or "", "signature": b.get("signature") or ""})
        elif t == "redacted_thinking":
            out.append({"type": "redacted_thinking", "data": b.get("data") or ""})
        elif t == "tool_use":
            out.append({"type": "tool_use", "id": b.get("id") or "", "name": b.get("name") or "",
                        "input": b.get("input") if isinstance(b.get("input"), dict) else {}})
    return out


def strip_thinking(messages: list[dict]) -> list[dict]:
    """The same conversation without any thinking blocks (fallback when the API no longer accepts old ones)."""
    out = []
    for m in messages:
        if m["role"] != "assistant":
            out.append(m)
            continue
        blocks = [b for b in m["content"] if b.get("type") not in ("thinking", "redacted_thinking")]
        if blocks:
            out.append({"role": "assistant", "content": blocks})
    return _merge(out)


def _user_blocks(content: Any) -> list[dict]:
    if isinstance(content, list):
        blocks = []
        for p in content:
            if p.get("type") == "text" and p.get("text"):
                blocks.append({"type": "text", "text": p["text"]})
            elif p.get("type") == "image_url":
                url = (p.get("image_url") or {}).get("url") or ""
                m = re.match(r"data:([\w/+.-]+);base64,(.*)$", url, re.S)
                if m:
                    blocks.append({"type": "image", "source": {"type": "base64", "media_type": m.group(1), "data": m.group(2)}})
        return blocks
    return [{"type": "text", "text": str(content)}] if str(content or "").strip() else []


def _assistant_blocks(m: dict) -> list[dict]:
    if m.get("claude_blocks"):
        return clean_blocks(m["claude_blocks"])
    blocks: list[dict] = []
    if str(m.get("content") or "").strip():
        blocks.append({"type": "text", "text": m["content"]})
    for tc in m.get("tool_calls") or []:
        fn = tc.get("function") or {}
        try:
            args = json.loads(fn.get("arguments") or "{}") if (fn.get("arguments") or "").strip() else {}
        except ValueError:
            args = {}
        blocks.append({"type": "tool_use", "id": tool_id(tc.get("id")), "name": fn.get("name") or "",
                       "input": args if isinstance(args, dict) else {}})
    return blocks


def _merge(msgs: list[dict]) -> list[dict]:
    out: list[dict] = []
    for m in msgs:
        if out and out[-1]["role"] == m["role"]:
            out[-1] = {"role": m["role"], "content": out[-1]["content"] + m["content"]}
        else:
            out.append({"role": m["role"], "content": list(m["content"])})
    for m in out:
        if m["role"] == "user":  # tool results must come first in a user turn
            m["content"] = [b for b in m["content"] if b.get("type") == "tool_result"] + \
                           [b for b in m["content"] if b.get("type") != "tool_result"]
    return out


def to_messages(chat: list[dict]) -> list[dict]:
    """Claude messages from a prepared chat: dicts with role user/assistant/tool and

    - user: ``content`` (text or OpenAI parts with images), ``notes``
    - assistant: ``content``, ``tool_calls`` and, for answers that came from Claude, ``claude_blocks``
    - tool: ``tool_call_id``, ``content``, ``error`` (bool), ``notes``

    Tool calls without a result (a stopped run) get a short "aborted" result, results without a call are left out.
    """
    out: list[dict] = []
    pending: list[str] = []

    def close() -> None:
        while pending:
            out.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": pending.pop(0), "content": ABORTED}]})

    for m in chat:
        role = m.get("role")
        notes = [{"type": "text", "text": n} for n in m.get("notes") or [] if str(n).strip()]
        if role == "assistant":
            close()
            blocks = _assistant_blocks(m)
            if not blocks:
                continue
            pending = [b["id"] for b in blocks if b["type"] == "tool_use"]
            out.append({"role": "assistant", "content": blocks})
        elif role == "tool":
            tid = tool_id(m.get("tool_call_id"))
            if tid not in pending:
                continue
            pending.remove(tid)
            res: dict[str, Any] = {"type": "tool_result", "tool_use_id": tid, "content": str(m.get("content") or "(leer)")}
            if m.get("error"):
                res["is_error"] = True
            out.append({"role": "user", "content": [res]})
            if notes:  # merged into the same user turn, after the tool results
                out.append({"role": "user", "content": notes})
        else:
            close()
            blocks = _user_blocks(m.get("content")) + notes
            out.append({"role": "user", "content": blocks or [{"type": "text", "text": "(leer)"}]})
    close()
    out = _merge(out)
    if out and out[0]["role"] != "user":
        out.insert(0, {"role": "user", "content": [{"type": "text", "text": "(Fortsetzung eines früheren Gesprächs)"}]})
    return out


def to_tools(tools: list[dict] | None) -> list[dict]:
    out = []
    for t in tools or []:
        fn = t.get("function") or t
        schema = dict(fn.get("parameters") or {})
        schema.setdefault("type", "object")
        schema.setdefault("properties", {})
        out.append({"name": fn.get("name") or "", "description": (fn.get("description") or "")[:4000], "input_schema": schema})
    return out


def _g(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


class StreamTranslator:
    """Raw Claude stream events in, OpenAI-style chunks out (so the agent loop stays the same for every provider)."""

    def __init__(self) -> None:
        self.usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
        self.started = False  # message_start seen: from here on the request is billed
        self.stop_reason: str | None = None
        self.model: str | None = None
        self._tool_index: dict[int, int] = {}

    def _usage(self, u: Any) -> None:
        if u is None:
            return
        for src, dst in (("input_tokens", "input"), ("output_tokens", "output"),
                         ("cache_read_input_tokens", "cache_read"), ("cache_creation_input_tokens", "cache_write")):
            v = _g(u, src)
            if v is not None:
                self.usage[dst] = int(v)

    def feed(self, ev: Any) -> dict | None:
        t = _g(ev, "type")
        if t == "message_start":
            self.started = True
            msg = _g(ev, "message")
            self.model = _g(msg, "model") or self.model
            self._usage(_g(msg, "usage"))
            return None
        if t == "content_block_start":
            block = _g(ev, "content_block")
            if _g(block, "type") == "tool_use":
                idx = int(_g(ev, "index") or 0)
                self._tool_index[idx] = idx
                return {"choices": [{"delta": {"tool_calls": [{"index": idx, "id": _g(block, "id"),
                                                               "function": {"name": _g(block, "name") or "", "arguments": ""}}]}}]}
            return None
        if t == "content_block_delta":
            d = _g(ev, "delta")
            dt = _g(d, "type")
            if dt == "text_delta":
                return {"choices": [{"delta": {"content": _g(d, "text") or ""}}]}
            if dt == "thinking_delta":
                return {"choices": [{"delta": {"reasoning": _g(d, "thinking") or ""}}]}
            if dt == "input_json_delta":
                idx = int(_g(ev, "index") or 0)
                return {"choices": [{"delta": {"tool_calls": [{"index": idx, "function": {"arguments": _g(d, "partial_json") or ""}}]}}]}
            return None
        if t == "message_delta":
            self._usage(_g(ev, "usage"))
            sr = _g(_g(ev, "delta"), "stop_reason")
            if sr:
                self.stop_reason = sr
                return {"choices": [{"delta": {}, "finish_reason": FINISH.get(sr, "stop")}]}
            return None
        return None

    def usage_chunk(self) -> dict:
        u = self.usage
        return {"model": self.model, "usage": {"prompt_tokens": u["input"] + u["cache_read"] + u["cache_write"],
                                               "completion_tokens": u["output"], "cache_read_tokens": u["cache_read"],
                                               "cache_write_tokens": u["cache_write"]}}
