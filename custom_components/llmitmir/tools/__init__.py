"""Tool registry for chats and coworks."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable

if TYPE_CHECKING:
    from ..agent import ToolContext


@dataclass
class Tool:
    name: str
    group: str
    description: str
    parameters: dict
    handler: Callable[["ToolContext", dict], Awaitable[Any]]
    # True = always a write; callable decides per call (e.g. HTTP GET vs POST)
    write: bool | Callable[[dict], bool] = False
    label: str = ""
    icon: str = "mdi:tools"
    # Changes to LLMitMir itself (skills, tasks, credentials): async (ctx, args) -> change set shown for approval,
    # raises ValueError for invalid input. Such tools always ask – no "always allow", never in scheduled runs.
    preview: Callable[["ToolContext", dict], Awaitable[dict]] | None = None
    # (ctx, args) -> args as stored in the chat and shown to the person (e.g. secrets masked)
    redact: Callable[["ToolContext", dict], dict] | None = None

    def is_write(self, args: dict) -> bool:
        return self.write(args) if callable(self.write) else bool(self.write)

    def spec(self) -> dict:
        return {"type": "function", "function": {"name": self.name, "description": self.description,
                                                 "parameters": self.parameters}}


REGISTRY: dict[str, Tool] = {}

GROUPS = {
    "web": {"label": "Websuche & Abrufen", "icon": "mdi:web"},
    "ha": {"label": "Home Assistant", "icon": "mdi:home-assistant"},
    "dav": {"label": "Nextcloud / WebDAV / CalDAV", "icon": "mdi:cloud-outline"},
    "http": {"label": "HTTP-Anfragen", "icon": "mdi:api"},
    "files": {"label": "Dateien", "icon": "mdi:file-document-outline"},
    "notify": {"label": "Benachrichtigungen", "icon": "mdi:bell-outline"},
    "skills": {"label": "Skills", "icon": "mdi:school-outline"},
    "progress": {"label": "Fortschritt", "icon": "mdi:format-list-checks"},
    "werkbank": {"label": "Werkbank (Befehle & Programme)", "icon": "mdi:console"},
}


def register(tool: Tool) -> Tool:
    REGISTRY[tool.name] = tool
    return tool


def obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or []}


def as_text(result: Any) -> str:
    if isinstance(result, str):
        return result
    return json.dumps(result, ensure_ascii=False, default=str)


def finish_progress(items: list[dict]) -> list[dict]:
    """Close the visible list when a run ends normally: nothing runs any more.

    The step that was running counts as done (the run ended with its report); steps the model never
    reached stay open, and a step marked as failed stays failed – the report says what did not work.
    """
    return [dict(p, status="erledigt") if p.get("status") == "laeuft" else p for p in items]


def advance_progress(items: list[dict], current: int) -> list[dict]:
    """Short form: steps before `current` (1-based) are done (unless failed), `current` is running."""
    out = []
    for i, p in enumerate(items, 1):
        st = p.get("status") or "offen"
        if i < current and st != "fehler":
            st = "erledigt"
        elif i == current:
            st = "laeuft"
        elif i > current and st == "laeuft":
            st = "offen"
        out.append(dict(p, status=st))
    return out


async def read_body(resp, limit: int) -> tuple[bytes, bool]:
    """Read a response body up to ``limit`` bytes; returns (data, truncated).

    ``resp.content.read(n)`` is no substitute: it returns as soon as *some* data is buffered,
    which cut chunked responses (calendar feeds, DAV listings) after the first packet.
    """
    buf = bytearray()
    async for chunk in resp.content.iter_chunked(65536):
        buf += chunk
        if len(buf) > limit:
            return bytes(buf[:limit]), True
    return bytes(buf), False


def load_all() -> None:
    # import modules for their side effect of registering tools
    from . import dav, files, ha, http, manage, misc, web, werkbank  # noqa: F401
