"""Speichern je Person: Reihenfolge und verzögerte Speicherungen (T3)."""
from __future__ import annotations

import asyncio
import json
import os
import threading
import time
import types

from _lm import load

storage = load("storage")


class _Hass:
    """Gerade genug Home Assistant: Pfade, Executor (echte Threads) und Tasks."""

    def __init__(self, base):
        self.config = types.SimpleNamespace(path=lambda *p: os.path.join(str(base), *p))
        self.loop = asyncio.get_running_loop()

    async def async_add_executor_job(self, fn, *args):
        return await self.loop.run_in_executor(None, fn, *args)

    def async_create_task(self, coro):
        return self.loop.create_task(coro)


def test_an_older_state_never_overwrites_a_newer_one(tmp_path):
    """Zwei Speicherungen kurz hintereinander: Braucht die erste länger, darf sie die zweite nicht überschreiben."""
    async def run():
        st = storage.UserStore(_Hass(tmp_path), "u1")
        await st.async_load()
        real, first = st._write, threading.Event()

        def slow_write(rel, data):
            if not first.is_set():
                first.set()
                time.sleep(0.3)  # der erste Schreibvorgang hängt
            real(rel, data)

        st._write = slow_write
        st.meta["memory"] = "alt"
        a = asyncio.create_task(st.async_save_meta())
        await asyncio.sleep(0.05)
        st.meta["memory"] = "neu"
        await asyncio.gather(a, st.async_save_meta())
        with open(os.path.join(st.base, "meta.json"), encoding="utf-8") as fh:
            return json.load(fh)["memory"]

    assert asyncio.run(run()) == "neu"


def test_flush_writes_a_pending_delayed_save_and_leaves_no_timer(tmp_path):
    async def run():
        st = storage.UserStore(_Hass(tmp_path), "u1")
        await st.async_load()
        st.meta["memory"] = "gemerkt"
        st.schedule_save(60)
        assert st._save_handle is not None
        await st.async_flush()
        assert st._save_handle is None
        with open(os.path.join(st.base, "meta.json"), encoding="utf-8") as fh:
            return json.load(fh)["memory"]

    assert asyncio.run(run()) == "gemerkt"


def test_meta_files_are_private(tmp_path):
    async def run():
        st = storage.UserStore(_Hass(tmp_path), "u1")
        await st.async_load()
        await st.async_save_meta()
        return os.stat(os.path.join(st.base, "meta.json")).st_mode & 0o777

    assert asyncio.run(run()) == 0o600


def test_two_uploads_with_the_same_name_keep_both_files(tmp_path):
    """Zwei Screenshots „image.png“ in einem Chat: der zweite überschreibt den ersten nicht, sondern wird
    „image (2).png“ – sonst läse das Modell zweimal dieselbe Datei."""
    async def run():
        st = storage.UserStore(_Hass(tmp_path), "u1")
        await st.async_load()
        a = await st.async_write_file("chat", "c1", "image.png", b"eins", unique=True)
        b = await st.async_write_file("chat", "c1", "image.png", b"zwei", unique=True)
        c = await st.async_write_file("chat", "c1", "image.png", b"drei", unique=True)
        return a["name"], b["name"], c["name"], await st.async_read_file("chat", "c1", a["name"]), \
            await st.async_read_file("chat", "c1", b["name"])

    assert asyncio.run(run()) == ("image.png", "image (2).png", "image (3).png", b"eins", b"zwei")


def test_without_unique_a_file_is_replaced_as_before(tmp_path):
    """Projektdateien und Ergebnisse behalten ihr Verhalten: gleicher Name ersetzt die Datei."""
    async def run():
        st = storage.UserStore(_Hass(tmp_path), "u1")
        await st.async_load()
        await st.async_write_file("project", "p1", "plan.md", b"alt")
        info = await st.async_write_file("project", "p1", "plan.md", b"neu")
        return info["name"], await st.async_read_file("project", "p1", "plan.md")

    assert asyncio.run(run()) == ("plan.md", b"neu")
