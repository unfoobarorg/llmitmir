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


def load_all() -> None:
    # import modules for their side effect of registering tools
    from . import dav, files, ha, http, misc, web, werkbank  # noqa: F401
