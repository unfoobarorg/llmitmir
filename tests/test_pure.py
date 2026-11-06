"""Unit tests for the parts that do not need a running Home Assistant."""
import importlib.util
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import pytest

BASE = pathlib.Path(__file__).resolve().parents[1] / "custom_components" / "llmitmir"


def load(name):
    spec = importlib.util.spec_from_file_location(f"lm_{name}", BASE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod  # dataclasses look the module up there
    spec.loader.exec_module(mod)
    return mod


cron = load("cron")
creds = load("credentials")
tk = load("taskkeys")
TZ = timezone(timedelta(hours=1))


def test_daily_next_run():
    after = datetime(2026, 11, 5, 19, 0, tzinfo=TZ)
    assert cron.next_cron(cron.schedule_to_cron({"type": "daily", "time": "18:30"}), after) == datetime(2026, 11, 6, 18, 30, tzinfo=TZ)
    assert cron.next_cron(cron.schedule_to_cron({"type": "daily", "time": "19:30"}), after) == datetime(2026, 11, 5, 19, 30, tzinfo=TZ)


def test_weekdays_and_weekly():
    fri = datetime(2026, 11, 6, 12, 0, tzinfo=TZ)  # Friday
    assert cron.next_cron(cron.schedule_to_cron({"type": "weekdays", "time": "08:00"}), fri).weekday() == 0  # Monday
    sat = cron.next_cron(cron.schedule_to_cron({"type": "weekly", "time": "08:39", "days": [6]}), fri)
    assert (sat.weekday(), sat.hour, sat.minute) == (5, 8, 39)


def test_claude_cron_expressions():
    after = datetime(2026, 11, 5, 6, 0, tzinfo=TZ)
    assert cron.next_cron("3 10,21 * * *", after) == datetime(2026, 11, 5, 10, 3, tzinfo=TZ)
    assert cron.next_cron("0 7,10,13,16 * * *", datetime(2026, 11, 5, 16, 1, tzinfo=TZ)) == datetime(2026, 11, 6, 7, 0, tzinfo=TZ)
    assert cron.next_cron("39 8 * * 6", after).weekday() == 5


def test_interval_monthly_and_errors():
    assert cron.schedule_to_cron({"type": "interval", "hours": 3, "time": "00:15"}) == "15 */3 * * *"
    assert cron.schedule_to_cron({"type": "monthly", "day": 31, "time": "07:00"}) == "0 7 31 * *"
    nxt = cron.next_cron("0 7 31 * *", datetime(2026, 11, 1, tzinfo=TZ))
    assert nxt.month == 12 and nxt.day == 31
    with pytest.raises(ValueError):
        cron.schedule_to_cron({"type": "cron", "cron": "61 * * * *"})
    with pytest.raises(ValueError):
        cron.parse_cron("* * *")
    assert cron.schedule_to_cron({"type": "once", "at": "2026-12-24T18:00"}) is None


def test_describe():
    assert cron.describe({"type": "weekly", "days": [1, 3], "time": "19:30"}) == "Mo, Mi um 19:30"


def test_credentials_placeholders_and_scrub():
    store = {"k1": {"id": "k1", "name": "Hof Nextcloud", "type": "webdav",
                    "fields": {"url": "https://files.example.org", "username": "hof", "password": "geheim-123"}},
             "k2": {"id": "k2", "name": "Bot", "type": "telegram", "fields": {"token": "123:ABC"}}}
    assert creds.resolve_placeholders("https://api.telegram.org/bot{{cred:Bot:token}}/getMe", store) == \
        "https://api.telegram.org/bot123:ABC/getMe"
    with pytest.raises(PermissionError):
        creds.resolve_placeholders("{{cred:Bot:token}}", store, allowed={"k1"})
    with pytest.raises(KeyError):
        creds.resolve_placeholders("{{cred:Hof Nextcloud:token}}", store)
    secrets = creds.secret_values(store)
    assert creds.scrub("Antwort mit geheim-123 und 123:ABC", secrets) == "Antwort mit ••• und •••"
    desc = creds.describe_for_model(store)
    assert all("geheim-123" not in str(d) and "123:ABC" not in str(d) for d in desc)


def test_provider_parsing():
    pytest.importorskip("aiohttp")
    prov = load("provider")
    lim = prov.parse_rate_headers({"x-ratelimit-limit-requests-day": "800", "x-ratelimit-remaining-requests-day": "241",
                                   "x-ratelimit-reset-requests-day": "17158", "x-ratelimit-reset-tokens": "6m0s", "content-type": "x"})
    assert lim["limit_requests_day"] == 800 and lim["remaining_requests_day"] == 241 and lim["reset_tokens"] == 360
    acc = prov.StreamAccumulator()
    acc.feed({"choices": [{"delta": {"reasoning": "17*23"}}]})
    acc.feed({"choices": [{"delta": {"content": "391", "tool_calls": [{"index": 0, "id": "c1", "function": {"name": "wetter", "arguments": "{\"ort\": "}}]}}]})
    acc.feed({"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"Duderstadt\"}"}}]}, "finish_reason": "tool_calls"}]})
    acc.feed({"choices": [], "usage": {"prompt_tokens": 10, "completion_tokens": 5}})
    assert acc.content == "391" and acc.reasoning == "17*23" and acc.usage["prompt_tokens"] == 10
    assert acc.calls() == [{"id": "c1", "type": "function", "function": {"name": "wetter", "arguments": "{\"ort\": \"Duderstadt\"}"}}]


def test_describe_cron():
    assert cron.describe({"type": "cron", "cron": "23 6 * * *"}) == "täglich um 06:23"
    assert cron.describe({"type": "cron", "cron": "3 10,21 * * *"}) == "täglich um 10:03 und 21:03"
    assert cron.describe({"type": "cron", "cron": "39 8 * * 6"}) == "samstags um 08:39"
    assert cron.describe({"type": "cron", "cron": "*/5 * * * *"}) == "Cron „*/5 * * * *“"


def test_task_key_resolve():
    # admin: same key for everything
    r = tk.resolve("same", "own", "CENTRAL", "OWN", "MAIN")
    assert (r["key"], r["source"], r["separate"]) == ("MAIN", "same", False)
    # admin: central task key for all, user choice ignored
    r = tk.resolve("shared", "own", "CENTRAL", "OWN", "MAIN")
    assert (r["key"], r["source"], r["separate"]) == ("CENTRAL", "shared", True)
    # central key missing -> normal key, marked as fallback
    r = tk.resolve("shared", None, "", "OWN", "MAIN")
    assert (r["key"], r["source"], r["fallback"]) == ("MAIN", "same", True)
    # each user chooses
    assert tk.resolve("user", "own", "CENTRAL", "OWN", "MAIN")["key"] == "OWN"
    assert tk.resolve("user", "shared", "CENTRAL", "OWN", "MAIN")["key"] == "CENTRAL"
    assert tk.resolve("user", None, "CENTRAL", "OWN", "MAIN")["key"] == "MAIN"
    assert tk.resolve("user", "own", "CENTRAL", "", "MAIN")["fallback"] is True
    # same key entered twice is not "separate"
    assert tk.resolve("user", "own", "", "MAIN", "MAIN")["separate"] is False


def test_task_key_usage_per_day():
    from datetime import date
    usage = {}
    fp = tk.fingerprint("sk-geheim")
    assert len(fp) == 16 and "geheim" not in fp
    d1, d2 = date(2026, 11, 5), date(2026, 11, 6)
    tk.add_day(usage, fp, 100, 20, today=d1)
    tk.add_day(usage, fp, 50, 10, today=d2)
    tk.add_day(usage, fp, 5, 5, today=d2)
    ku = tk.key_usage(usage, fp, days=3, today=d2)
    assert ku["today"] == {"requests": 2, "prompt": 55, "completion": 15}
    assert [x["requests"] for x in ku["days"]] == [0, 1, 2]
    # old days are dropped, empty keys removed
    tk.add_day(usage, "other", 1, 1, today=date(2027, 3, 1), keep_days=60)
    assert fp not in usage and "other" in usage


def test_quota_ignores_separate_task_key():
    u = {"requests": 10, "prompt": 1000, "completion": 500, "task_requests": 6, "task_prompt": 600,
         "task_completion": 300, "sep_requests": 4, "sep_tokens": 700}
    assert tk.quota_usage(u) == (6, 800)
    assert tk.task_part(u) == {"requests": 6, "prompt": 600, "completion": 300}
    assert tk.quota_usage({"requests": 3, "prompt": 1, "completion": 2}) == (3, 3)


def test_read_body_reads_all_chunks():
    """resp.content.read(n) stopped after the first packet; read_body must collect every chunk."""
    import asyncio

    spec = importlib.util.spec_from_file_location("lm_tools", BASE / "tools" / "__init__.py")
    tools = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = tools  # dataclasses look the module up there
    spec.loader.exec_module(tools)

    class Content:
        def __init__(self, chunks):
            self.chunks = chunks

        async def iter_chunked(self, _size):
            for c in self.chunks:
                yield c

    class Resp:
        def __init__(self, chunks):
            self.content = Content(chunks)

    chunks = [b"BEGIN:VCALENDAR\r\n", b"x" * 70000, b"END:VCALENDAR\r\n"]
    data, cut = asyncio.run(tools.read_body(Resp(chunks), 1_000_000))
    assert data == b"".join(chunks) and not cut
    data, cut = asyncio.run(tools.read_body(Resp(chunks), 100))
    assert len(data) == 100 and cut


def test_progress_short_form():
    spec = importlib.util.spec_from_file_location("lm_tools2", BASE / "tools" / "__init__.py")
    tools = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = tools
    spec.loader.exec_module(tools)
    items = [{"text": t, "status": s} for t, s in (("a", "erledigt"), ("b", "laeuft"), ("c", "fehler"), ("d", "offen"))]
    assert [x["status"] for x in tools.advance_progress(items, 4)] == ["erledigt", "erledigt", "fehler", "laeuft"]
    assert [x["status"] for x in tools.advance_progress(items, 2)] == ["erledigt", "laeuft", "fehler", "offen"]
    assert all(x["status"] in ("erledigt", "fehler") for x in tools.advance_progress(items, 5))


selfdoc = load("selfdoc")


def test_selfdoc_tool_names_exist():
    """Every tool the self-knowledge texts mention must really be registered."""
    import re

    registered = set()
    for f in (BASE / "tools").glob("*.py"):
        registered |= set(re.findall(r'register\(Tool\("(\w+)"', f.read_text()))
    text = selfdoc.ABOUT + selfdoc.HA + selfdoc.MANUAL
    mentioned = set(re.findall(r"\b((?:ha|dav|caldav|file|skill|web|werkbank|http|progress|credentials|llmitmir)_\w+|notify|shell)\b", text))
    assert "llmitmir_info" in registered
    assert mentioned - registered == set()


def test_selfdoc_overview_and_detail():
    meta = {
        "projects": {"p1": {"id": "p1", "name": "Hof", "description": "Hofladen", "instructions": "Sei nett",
                            "skills": ["s1"], "skills_only": True}},
        "skills": {"s1": {"id": "s1", "name": "sawiko-gmail", "description": "Mails lesen", "body": "So geht es",
                          "credentials": ["k1"]},
                   "s2": {"id": "s2", "name": "geheim", "description": "x", "enabled": False}},
        "tasks": {"t1": {"id": "t1", "name": "Mails prüfen", "prompt": "Prüfe die Mails " * 50, "project_id": "p1",
                         "schedule": {"type": "daily", "time": "07:30"}, "allow_write": ["notify"], "notify": "error",
                         "last_run": {"status": "error", "error": "Zeitüberschreitung", "started": 1_700_000_000}}},
        "credentials": {"k1": {"id": "k1", "name": "Gmail", "type": "imap", "fields": {"password": "pw"}}},
    }
    o = selfdoc.overview(meta)
    assert "sawiko-gmail [Zugänge: Gmail]" in o and "geheim (deaktiviert)" in o
    assert "Mails prüfen (täglich um 07:30; aktiv; Projekt Hof" in o and "Gmail (imap)" in o and "pw" not in o
    assert "geheim" not in selfdoc.overview(meta, allowed_skills={"s1"})

    sec, t = selfdoc.find(meta, "Aufgabe", "mails")
    d = selfdoc.detail(meta, sec, t)
    assert sec == "tasks" and d.count("Prüfe die Mails") == 50 and "Freigaben: notify" in d
    assert "nur bei Fehlern" in d and "Zeitüberschreitung" in d and "Projekt: Hof" in d
    sec, s = selfdoc.find(meta, "skills", "SAWIKO-GMAIL")
    d = selfdoc.detail(meta, sec, s, ["a.py"])
    assert "So geht es" in d and "Gmail" in d and "a.py" in d and "pw" not in d
    sec, p = selfdoc.find(meta, "projekt", "p1")
    assert "Sei nett" in selfdoc.detail(meta, sec, p) and "sawiko-gmail (nur diese)" in selfdoc.detail(meta, sec, p)
    assert selfdoc.find(meta, "skill", "geheim", allowed_skills={"s1"}) is None
    assert selfdoc.find(meta, "zugang", "Gmail") is None


changes = load("changes")


def test_line_diff_folds_unchanged_lines():
    old = "\n".join(f"Zeile {i}" for i in range(1, 21))
    new = old.replace("Zeile 10", "Zeile zehn")
    d = changes.line_diff(old, new)
    assert ["-", "Zeile 10"] in d and ["+", "Zeile zehn"] in d
    assert d[0] == ["…", 7] and d[-1] == ["…", 8]  # 2 lines of context around the change
    assert [r for r in d if r[0] == " "] == [[" ", "Zeile 8"], [" ", "Zeile 9"], [" ", "Zeile 11"], [" ", "Zeile 12"]]
    assert changes.line_diff("a", "a\nb") == [[" ", "a"], ["+", "b"]]


def test_change_sets():
    meta = {"credentials": {"k1": {"id": "k1", "name": "Gmail"}}, "projects": {"p1": {"id": "p1", "name": "Hof"}}}
    new = {"name": "mail", "description": "Mails", "body": "Schritt 1\nSchritt 2", "credentials": ["k1"]}
    ch = changes.build("skill", "mail", [], changes.skill_fields(new, meta))
    assert ch["aktion"] == "anlegen" and {f["feld"] for f in ch["felder"]} == {"Name", "Beschreibung", "Anleitung", "Zugänge", "Aktiv"}
    upd = dict(new, body="Schritt 1\nSchritt 2b", enabled=False)
    ch = changes.build("skill", "mail", changes.skill_fields(new, meta), changes.skill_fields(upd, meta))
    assert ch["aktion"] == "aendern" and [f["feld"] for f in ch["felder"]] == ["Anleitung", "Aktiv"]
    assert ch["felder"][0]["diff"] == [[" ", "Schritt 1"], ["-", "Schritt 2"], ["+", "Schritt 2b"]]
    assert changes.summary(ch) == "Skill „mail“ geändert (geändert: Anleitung, Aktiv)."
    task = {"name": "Post", "prompt": "Prüfe", "schedule": {"type": "weekdays", "time": "07:00"}, "project_id": "p1"}
    ch = changes.build("aufgabe", "Post", changes.task_fields(task, meta), [])
    assert ch["aktion"] == "loeschen" and {"feld": "Zeitplan", "alt": "werktags um 07:00", "neu": None} in ch["felder"]


def test_credential_change_never_shows_secrets():
    old = {"name": "Mail", "type": "imap", "fields": {"imap_host": "a", "password": "alt-geheim"}}
    same = dict(old, fields=dict(old["fields"], imap_host="b"))
    ch = changes.build("zugang", "Mail", changes.credential_fields(old, {"password"}),
                       changes.credential_fields(same, {"password"}, old))
    assert [f["feld"] for f in ch["felder"]] == ["imap_host"]
    new = dict(old, fields=dict(old["fields"], password="neu-geheim"))
    ch = changes.build("zugang", "Mail", changes.credential_fields(old, {"password"}),
                       changes.credential_fields(new, {"password"}, old))
    assert ch["felder"] == [{"feld": "password", "alt": "•••", "neu": "••• (neu)"}]
    assert "geheim" not in str(changes.build("zugang", "Mail", [], changes.credential_fields(new, {"password"})))


# ---------------------------------------------------------------- model choice (models.py) and stream guard
ms = load("models")

# SAIA's /models answer on 06.11.2026, 09:36 – GLM 5.3 and Qwen 3.8 27B did not send a token within 150 s
SAIA = [
    {"id": "deepseek-v4-flash-0731", "name": "DeepSeek V4 Flash 0731", "status": "ready", "demand": 0, "created": 1782907438, "input": ["text"], "output": ["text", "thought"]},
    {"id": "deepseek-v4.1-flash-1017", "name": "DeepSeek V4.1 Flash 1017", "status": "ready", "demand": 0, "created": 1793036378, "input": ["text"], "output": ["text", "thought"]},
    {"id": "eurollm-22b-instruct-2512", "name": "EuroLLM 22B", "status": "ready", "demand": 0, "created": 1785482424, "input": ["text"], "output": ["text"]},
    {"id": "gemma-4-31b-it", "name": "Gemma 4 31B", "status": "ready", "demand": 0, "created": 1777986871, "input": ["text", "image"], "output": ["text", "thought"]},
    {"id": "glm-5.3", "name": "GLM 5.3", "status": "ready", "demand": 5, "created": 1793031766, "input": ["text"], "output": ["text", "thought"]},
    {"id": "glm-5.3-flash", "name": "GLM 5.3 Flash", "status": "ready", "demand": 0, "created": 1787908914, "input": ["text", "image", "video"], "output": ["text", "thought"]},
    {"id": "meta-llama-3.1-8b-instruct", "name": "Llama 3.1 8B", "status": "ready", "demand": 0, "created": 1772676421, "input": ["text"], "output": ["text"]},
    {"id": "mistral-large-4-1t-a52b", "name": "Mistral Large 4", "status": "ready", "demand": 0, "created": 1793371638, "input": ["text", "image"], "output": ["text", "thought"]},
    {"id": "qwen3.5-397b-a17b", "name": "Qwen 3.5 397B", "status": "ready", "demand": 3, "created": 1776865347, "input": ["text", "image"], "output": ["text", "thought"]},
    {"id": "qwen3.8-27b", "name": "Qwen 3.8 27B", "status": "ready", "demand": 5, "created": 1787844341, "input": ["text", "image", "video"], "output": ["text", "thought"]},
]


def test_parse_model_ids():
    p = ms.parse("qwen3.5-397b-a17b")
    assert (p["family"], p["version"], p["total_b"], p["active_b"], p["light"]) == ("qwen", 3.5, 397, 17, False)
    p = ms.parse("deepseek-v4.1-flash-1017")
    assert (p["family"], p["version"], p["light"]) == ("deepseek", 4.1, True)
    p = ms.parse("mistral-large-4-1t-a52b")
    assert (p["family"], p["version"], p["total_b"]) == ("mistral", 4, 1000)
    assert ms.parse("meta-llama-3.1-8b-instruct")["family"] == "llama"
    assert ms.parse("qwen3-30b-a3b-instruct-2507")["version"] == 3
    assert ms.parse("eurollm-22b-instruct-2512")["version"] == 0


def test_pick_avoids_overloaded_models():
    idle = [dict(m, demand=0) for m in SAIA]
    assert ms.pick(idle, "chat") == "glm-5.3"            # strongest when nobody else is on it
    assert ms.pick(SAIA, "chat") == "mistral-large-4-1t-a52b"  # GLM at demand 5 → the free, similarly strong one
    assert ms.pick(SAIA, "agent") == "deepseek-v4.1-flash-1017"
    assert ms.pick(SAIA, "vision") in ("mistral-large-4-1t-a52b", "qwen3.5-397b-a17b")
    assert ms.pick(SAIA, "chat", load_aware=False) == "glm-5.3"
    # LLMitMir's own observation counts like high demand …
    slow = [dict(m, demand=0, slow=m["id"] == "glm-5.3") for m in SAIA]
    assert ms.pick(slow, "chat") == "mistral-large-4-1t-a52b"
    # … and a model that just answered quickly is not "busy", whatever the reported demand
    fast = [dict(m, fast=m["id"] == "glm-5.3") for m in SAIA]
    assert not ms.busy(next(m for m in fast if m["id"] == "glm-5.3"))
    assert ms.busy(next(m for m in SAIA if m["id"] == "glm-5.3"))
    # demand 6 (never answered in the measurement) is out, 3 barely matters
    assert ms.demand_penalty(6) >= 50 and ms.demand_penalty(3) <= 3
    # gone or not ready models are never picked
    assert ms.pick([dict(m, demand=0, status="loading" if m["id"] == "glm-5.3" else "ready") for m in SAIA], "chat") != "glm-5.3"


def test_alternative_recommendation():
    alt = ms.alternative(SAIA, "glm-5.3", "chat")
    assert alt["id"] == "mistral-large-4-1t-a52b" and alt["similar"] and alt["demand"] == 0
    # images in the chat: only models that can see them
    assert "image" in next(m for m in SAIA if m["id"] == ms.alternative(SAIA, "qwen3.8-27b", "chat", need_image=True)["id"])["input"]
    # never recommend something far weaker
    only_weak = [m for m in SAIA if m["id"] in ("glm-5.3", "meta-llama-3.1-8b-instruct")]
    assert ms.alternative(only_weak, "glm-5.3", "chat") is None
    # nothing to recommend when all good ones are busy
    assert ms.alternative([dict(m, demand=5) for m in SAIA], "glm-5.3", "chat") is None


def test_new_releases_are_estimated_and_preferred():
    new = {"id": "glm-5.4", "name": "GLM 5.4", "status": "ready", "demand": 0, "created": 1800000000, "input": ["text"], "output": ["text", "thought"]}
    assert ms.quality("glm-5.4", "chat", new) > ms.quality("glm-5.3", "chat")
    assert ms.pick([dict(m, demand=0) for m in SAIA] + [new], "chat") == "glm-5.4"
    # a new flash model is compared with the flash line, not with the big model
    fl = {"id": "glm-5.4-flash", "input": ["text"], "output": ["text"]}
    assert ms.quality("glm-5.4-flash", "chat", fl) < ms.quality("glm-5.3", "chat")
    # unknown family: estimated from size, never 0 for chat
    other = {"id": "kimi-k3-1t-a32b", "input": ["text"], "output": ["text", "thought"]}
    assert 60 <= ms.quality(other["id"], "chat", other) <= 83
    assert ms.quality("bge-m3-embedding", "chat", {"id": "bge-m3-embedding"}) > 0
    assert not ms.candidates([{"id": "bge-m3-embedding", "status": "ready"}], "chat")


def test_merge_known_marks_new_and_gone():
    old, _ = ms.merge_known([], SAIA, 1000.0)
    assert all(m["first_seen"] == 0 for m in old)  # the first list is not "new"
    fresh = [m for m in SAIA if m["id"] != "deepseek-v4-flash-0731"] + [{"id": "glm-5.4", "status": "ready", "demand": 1}]
    known, new = ms.merge_known(old, fresh, 2000.0)
    assert new == ["glm-5.4"]
    assert next(m for m in known if m["id"] == "glm-5.4")["first_seen"] == 2000.0
    gone = next(m for m in known if m["id"] == "deepseek-v4-flash-0731")
    assert gone["gone"] and not ms.usable(gone)
    # lists stored before 0.4 have no first_seen: those models are not "new" after the update
    upgraded, _ = ms.merge_known([{"id": m["id"]} for m in SAIA], SAIA, 3000.0)
    assert all(m["first_seen"] == 0 for m in upgraded)
    later, _ = ms.merge_known(known, fresh, 2000.0 + 31 * 86400)
    assert not any(m["id"] == "deepseek-v4-flash-0731" for m in later)


prov = load("provider")


def _run(coro):
    import asyncio
    return asyncio.run(coro)


async def _hanging(chunks, hang_first=1000.0):
    import asyncio
    await asyncio.sleep(hang_first)
    for c in chunks:
        yield c


CHUNK = {"choices": [{"delta": {"content": "Hallo"}}]}


def test_guard_stream_recommends_and_switches():
    import asyncio

    async def main():
        stop, switch = asyncio.Event(), asyncio.Event()
        slow_calls, first = [], []

        async def on_slow(w):
            slow_calls.append(w)
            return False

        async def on_first(w):
            first.append(w)

        # slow model that answers after a while: one warning, then the chunks still arrive
        out = [c async for c in prov.guard_stream(_hanging([CHUNK, CHUNK], 0.15), stop, switch, first_timeout=0.05,
                                                  on_slow=on_slow, on_first=on_first)]
        assert len(out) == 2 and len(slow_calls) == 1 and first and first[0] >= 0.15

        # on_slow decides to switch (scheduled task) → ModelSwitch, the hanging request is abandoned
        async def switch_now(w):
            return True
        with pytest.raises(prov.ModelSwitch):
            async for _ in prov.guard_stream(_hanging([CHUNK]), stop, switch, first_timeout=0.05, on_slow=switch_now, on_first=on_first):
                pass

        # the person clicks "switch" while waiting
        asyncio.get_running_loop().call_later(0.05, switch.set)
        with pytest.raises(prov.ModelSwitch):
            async for _ in prov.guard_stream(_hanging([CHUNK]), stop, switch, first_timeout=10, on_slow=on_slow, on_first=on_first):
                pass
        switch.clear()

        # stop ends the wait at once (before: up to 15 minutes)
        asyncio.get_running_loop().call_later(0.05, stop.set)
        t = asyncio.get_running_loop().time()
        out = [c async for c in prov.guard_stream(_hanging([CHUNK]), stop, switch, first_timeout=10, on_slow=on_slow, on_first=on_first)]
        assert out == [] and asyncio.get_running_loop().time() - t < 1

    _run(main())


def test_real_output_ignores_role_header():
    assert not prov.real_output({"choices": [{"delta": {"role": "assistant"}}]})
    assert prov.real_output({"choices": [{"delta": {"reasoning_content": "hm"}}]})
    assert prov.real_output({"choices": [{"delta": {}, "finish_reason": "stop"}]})
