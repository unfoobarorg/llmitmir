"""Per-user storage for LLMitMir.

Layout below <config>/.storage/llmitmir/:
  <user_id>/meta.json          settings, projects, skills, credentials, tasks, chat index, usage
  <user_id>/chats/<id>.json     one file per chat / cowork / task run (messages)
  <user_id>/files/<scope>/...   attachments, project files, cowork workspaces
Global admin config lives in the regular HA store (llmitmir.config).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import shutil
import time
from datetime import date, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util.file import write_utf8_file_atomic

from .const import BILLING_STORE_KEY, CONFIG_STORE_KEY, KEY_SHARED, STORAGE_VERSION, TASK_KEY_SAME

SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def new_id(prefix: str = "") -> str:
    return prefix + secrets.token_hex(6)


def now() -> float:
    return round(time.time(), 3)


def _check_id(value: str) -> str:
    if not isinstance(value, str) or not SAFE_ID.match(value):
        raise ValueError("invalid id")
    return value


def safe_name(name: str) -> str:
    """File name without path tricks."""
    name = os.path.basename(str(name or "").replace("\\", "/")).strip()
    name = re.sub(r"[\x00-\x1f<>:\"|?*]", "_", name)
    if not name or name in (".", ".."):
        name = "datei"
    return name[:180]


DEFAULT_CONFIG: dict[str, Any] = {
    "provider": {"preset": "saia", "name": "SAIA (GWDG / KISSKI)", "base_url": "https://chat-ai.academiccloud.de/v1",
                 "transcription_model": "whisper-large-v3"},
    "key_mode": KEY_SHARED,
    "shared_key": "",
    "user_keys": {},          # user_id -> key (admin-entered)
    "task_key_mode": TASK_KEY_SAME,
    "shared_task_key": "",    # central key for scheduled tasks
    "task_usage": {},         # key fingerprint -> day -> usage of all scheduled tasks on that key
    "allowed_users": [],      # user ids allowed to use the panel (admins always may configure)
    "quota_default": {"requests_day": 0, "tokens_day": 0},   # 0 = unlimited
    "quota_users": {},        # user_id -> {"requests_day", "tokens_day"}
    "models": {"enabled": [], "defaults": {}, "context": {}, "known": [], "auto_enable_new": True},
    "search": {"provider": "duckduckgo", "searxng_url": ""},
    "werkbank": {"url": "", "token": ""},
    "views": {"default": "choice", "users": {}},   # simple (Laien) or expert view, see views.py
    "notify_devices": {"overrides": {}},   # device key -> user id, where an admin corrected the link, see notifydevices.py
    # AI providers in the admin's order (providers.py): the main provider above plus usage-billed external ones
    "providers": [],
    "model_access": {},       # model key -> [user ids]; external models: nobody unless listed, main models: everybody
    "billing": {"usd_eur": 0.86, "prices": {}, "limits": {}, "limit_default": 0, "fallback_model": ""},
}


class ConfigStore:
    """Admin configuration (global)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, STORAGE_VERSION, CONFIG_STORE_KEY, private=True)
        self.data: dict[str, Any] = {}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        merged = json.loads(json.dumps(DEFAULT_CONFIG))
        for k, v in data.items():
            if isinstance(v, dict) and isinstance(merged.get(k), dict):
                merged[k].update(v)
            else:
                merged[k] = v
        self.data = merged

    async def async_save(self) -> None:
        await self._store.async_save(self.data)

    def schedule_save(self, delay: float = 10.0) -> None:
        self._store.async_delay_save(lambda: self.data, delay)


class BillingStore:
    """Permanent cost ledger of usage-billed models (pricing.book): user -> day -> model -> tokens and euros."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, STORAGE_VERSION, BILLING_STORE_KEY, private=True)
        self.data: dict[str, Any] = {"ledger": {}}

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        data.setdefault("ledger", {})
        self.data = data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)

    def schedule_save(self, delay: float = 5.0) -> None:
        self._store.async_delay_save(lambda: self.data, delay)

    @property
    def ledger(self) -> dict:
        return self.data["ledger"]


class UserStore:
    """All data of one HA user."""

    def __init__(self, hass: HomeAssistant, user_id: str) -> None:
        self.hass = hass
        self.user_id = _check_id(user_id)
        self.base = hass.config.path(".storage", "llmitmir", self.user_id)
        self.meta: dict[str, Any] = {}
        self.lock = asyncio.Lock()
        self._chat_cache: dict[str, dict] = {}
        self._save_handle: asyncio.TimerHandle | None = None

    # ---------------------------------------------------------------- meta
    async def async_load(self) -> None:
        def _load() -> dict:
            p = os.path.join(self.base, "meta.json")
            if os.path.exists(p):
                with open(p, encoding="utf-8") as fh:
                    return json.load(fh)
            return {}

        meta = await self.hass.async_add_executor_job(_load)
        meta.setdefault("settings", {})
        for key in ("projects", "skills", "credentials", "tasks", "chats", "usage", "import_tokens"):
            meta.setdefault(key, {})
        meta.setdefault("memory", "")
        self.meta = meta

    def _write(self, rel: str, data: Any) -> None:
        path = os.path.join(self.base, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        write_utf8_file_atomic(path, json.dumps(data, ensure_ascii=False), private=True)

    async def async_save_meta(self) -> None:
        data = json.loads(json.dumps(self.meta))
        await self.hass.async_add_executor_job(self._write, "meta.json", data)

    def schedule_save(self, delay: float = 2.0) -> None:
        if self._save_handle:
            self._save_handle.cancel()
        self._save_handle = self.hass.loop.call_later(
            delay, lambda: self.hass.async_create_task(self.async_save_meta()))

    # ---------------------------------------------------------------- chats
    async def async_get_chat(self, chat_id: str) -> dict | None:
        _check_id(chat_id)
        if chat_id in self._chat_cache:
            return self._chat_cache[chat_id]
        if chat_id not in self.meta["chats"]:
            return None

        def _load() -> dict | None:
            p = os.path.join(self.base, "chats", f"{chat_id}.json")
            if not os.path.exists(p):
                return None
            with open(p, encoding="utf-8") as fh:
                return json.load(fh)

        chat = await self.hass.async_add_executor_job(_load)
        if chat is not None:
            self._chat_cache[chat_id] = chat
            if len(self._chat_cache) > 30:
                self._chat_cache.pop(next(iter(self._chat_cache)))
        return chat

    def chat_summary(self, chat: dict) -> dict:
        return {k: chat.get(k) for k in ("id", "kind", "title", "project_id", "task_id", "model", "model_auto", "created",
                                        "updated", "pinned", "status", "usage", "tools")} | {
            "messages": len(chat.get("messages") or []), "queued": len(chat.get("queued") or [])}

    async def async_save_chat(self, chat: dict, keep_updated: bool = False) -> None:
        if not keep_updated or not chat.get("updated"):
            chat["updated"] = now()
        self._chat_cache[chat["id"]] = chat
        self.meta["chats"][chat["id"]] = self.chat_summary(chat)
        data = json.loads(json.dumps(chat))
        await self.hass.async_add_executor_job(self._write, f"chats/{chat['id']}.json", data)
        self.schedule_save(0.5)

    async def async_delete_chat(self, chat_id: str) -> None:
        _check_id(chat_id)
        self._chat_cache.pop(chat_id, None)
        self.meta["chats"].pop(chat_id, None)

        def _rm() -> None:
            p = os.path.join(self.base, "chats", f"{chat_id}.json")
            if os.path.exists(p):
                os.remove(p)
            shutil.rmtree(os.path.join(self.base, "files", "chat", chat_id), ignore_errors=True)

        await self.hass.async_add_executor_job(_rm)
        await self.async_save_meta()

    # ---------------------------------------------------------------- files
    def file_dir(self, scope: str, owner: str) -> str:
        if scope not in ("chat", "project", "skill", "import"):
            raise ValueError("invalid scope")
        return os.path.join(self.base, "files", scope, _check_id(owner))

    def file_path(self, scope: str, owner: str, name: str) -> str:
        d = self.file_dir(scope, owner)
        rel = "/".join(safe_name(p) for p in str(name).replace("\\", "/").split("/") if p not in ("", ".", ".."))
        path = os.path.normpath(os.path.join(d, rel))
        if not path.startswith(d + os.sep):
            raise ValueError("invalid path")
        return path

    async def async_list_files(self, scope: str, owner: str) -> list[dict]:
        d = self.file_dir(scope, owner)

        def _ls() -> list[dict]:
            out = []
            if not os.path.isdir(d):
                return out
            for root, _dirs, files in os.walk(d):
                for f in files:
                    full = os.path.join(root, f)
                    out.append({"name": os.path.relpath(full, d).replace(os.sep, "/"), "size": os.path.getsize(full),
                                "modified": round(os.path.getmtime(full))})
            return sorted(out, key=lambda x: x["name"])

        return await self.hass.async_add_executor_job(_ls)

    async def async_write_file(self, scope: str, owner: str, name: str, data: bytes) -> dict:
        path = self.file_path(scope, owner, name)

        def _w() -> None:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as fh:
                fh.write(data)

        await self.hass.async_add_executor_job(_w)
        return {"name": os.path.relpath(path, self.file_dir(scope, owner)).replace(os.sep, "/"), "size": len(data)}

    async def async_read_file(self, scope: str, owner: str, name: str) -> bytes:
        path = self.file_path(scope, owner, name)

        def _r() -> bytes:
            with open(path, "rb") as fh:
                return fh.read()

        return await self.hass.async_add_executor_job(_r)

    async def async_delete_file(self, scope: str, owner: str, name: str) -> None:
        path = self.file_path(scope, owner, name)
        await self.hass.async_add_executor_job(lambda: os.path.exists(path) and os.remove(path))

    async def async_delete_scope(self, scope: str, owner: str) -> None:
        d = self.file_dir(scope, owner)
        await self.hass.async_add_executor_job(lambda: shutil.rmtree(d, ignore_errors=True))

    # ---------------------------------------------------------------- usage
    def add_usage(self, prompt: int, completion: int, requests: int = 1, task: bool = False,
                  separate: bool = False, external: bool = False) -> dict:
        """Count usage. ``task``: scheduled task run; ``separate``: on a task key other than the normal key;
        ``external``: a usage-billed external model (limited in euros, not by the daily quota)."""
        day = date.today().isoformat()
        u = self.meta["usage"].setdefault(day, {"requests": 0, "prompt": 0, "completion": 0})
        prompt, completion = int(prompt or 0), int(completion or 0)
        u["requests"] += requests
        u["prompt"] += prompt
        u["completion"] += completion
        if task:
            u["task_requests"] = u.get("task_requests", 0) + requests
            u["task_prompt"] = u.get("task_prompt", 0) + prompt
            u["task_completion"] = u.get("task_completion", 0) + completion
        if separate or external:
            u["sep_requests"] = u.get("sep_requests", 0) + requests
            u["sep_tokens"] = u.get("sep_tokens", 0) + prompt + completion
        if external:
            u["ext_requests"] = u.get("ext_requests", 0) + requests
            u["ext_tokens"] = u.get("ext_tokens", 0) + prompt + completion
        cutoff = (date.today() - timedelta(days=120)).isoformat()
        for d in [d for d in self.meta["usage"] if d < cutoff]:
            self.meta["usage"].pop(d, None)
        self.schedule_save()
        return u

    def usage_today(self) -> dict:
        return self.meta["usage"].get(date.today().isoformat(), {"requests": 0, "prompt": 0, "completion": 0})


def mask_credential(cred: dict, secret_fields: set[str]) -> dict:
    """Credential for the UI list: secret values replaced by a marker."""
    out = {k: v for k, v in cred.items() if k != "fields"}
    out["fields"] = {k: ("•••" if k in secret_fields and v else v) for k, v in (cred.get("fields") or {}).items()}
    return out
