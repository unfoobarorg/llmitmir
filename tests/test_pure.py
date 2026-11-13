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
ck = load("credcheck")
tk = load("taskkeys")
views = load("views")
retention = load("retention")
inbox = load("inbox")
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


def test_task_key_own_mode():
    # Admin verlangt eigene Schluessel: kein zentraler, kein gemeinsamer
    assert tk.choices("own", "CENTRAL", "MAIN", False) == ["own"]
    assert tk.choices("own", "CENTRAL", "MAIN", True) == ["same", "own"]
    # ohne eigenen Schluessel laeuft nichts – auch nicht ueber den gemeinsamen
    r = tk.resolve("own", None, "CENTRAL", "", "MAIN")
    assert (r["key"], r["missing"], r["fallback"]) == ("", True, False)
    # ein eigener Schluessel fuer alles ist erlaubt
    r = tk.resolve("own", "same", "CENTRAL", "", "MAIN", main_is_own=True)
    assert (r["key"], r["source"], r["separate"], r["missing"]) == ("MAIN", "same", False, False)
    # eigener Aufgaben-Schluessel
    r = tk.resolve("own", "own", "CENTRAL", "OWN", "MAIN")
    assert (r["key"], r["source"], r["separate"]) == ("OWN", "own", True)
    # ein gespeicherter zentraler Schluessel gilt im Modus "own" nicht mehr
    r = tk.resolve("own", "shared", "CENTRAL", "OWN", "MAIN")
    assert (r["key"], r["source"]) == ("OWN", "own")
    # Modus "user" bietet den zentralen Schluessel nur an, wenn es einen gibt
    assert tk.choices("user", "", "MAIN", True) == ["same", "own"]
    assert tk.choices("user", "CENTRAL", "MAIN", True) == ["same", "own", "shared"]


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
    # a finished run closes the list: nothing keeps running, unreached and failed steps stay as they are
    assert [x["status"] for x in tools.finish_progress(items)] == ["erledigt", "erledigt", "fehler", "offen"]
    assert [x["status"] for x in tools.finish_progress([{"text": "a", "status": "laeuft"}])] == ["erledigt"]


selfdoc = load("selfdoc")


def test_more_steps_answers():
    """The "more steps?" question offers a little more (15) and a lot more (100); anything else wraps up."""
    const = load("const")
    assert const.MORE_STEPS == {"once": 15, "lots": 100}
    assert const.MORE_STEPS.get("deny", 0) == 0 and const.MORE_STEPS.get("always", 0) == 0
    assert const.MAX_STEPS_MORE_LOTS > const.MAX_STEPS_MORE


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
        "skills": {"s1": {"id": "s1", "name": "team-gmail", "description": "Mails lesen", "body": "So geht es",
                          "credentials": ["k1"]},
                   "s2": {"id": "s2", "name": "geheim", "description": "x", "enabled": False}},
        "tasks": {"t1": {"id": "t1", "name": "Mails prüfen", "prompt": "Prüfe die Mails " * 50, "project_id": "p1",
                         "schedule": {"type": "daily", "time": "07:30"}, "allow_write": ["notify"], "notify": "error",
                         "last_run": {"status": "error", "error": "Zeitüberschreitung", "started": 1_700_000_000}}},
        "credentials": {"k1": {"id": "k1", "name": "Gmail", "type": "imap", "fields": {"password": "pw"}}},
    }
    o = selfdoc.overview(meta)
    assert "team-gmail [Zugänge: Gmail]" in o and "geheim (deaktiviert)" in o
    assert "Mails prüfen (täglich um 07:30; aktiv; Projekt Hof" in o and "Gmail (imap)" in o and "pw" not in o
    assert "geheim" not in selfdoc.overview(meta, allowed_skills={"s1"})

    sec, t = selfdoc.find(meta, "Aufgabe", "mails")
    d = selfdoc.detail(meta, sec, t)
    assert sec == "tasks" and d.count("Prüfe die Mails") == 50 and "Freigaben: notify" in d
    assert "nur bei Fehlern" in d and "Zeitüberschreitung" in d and "Projekt: Hof" in d
    sec, s = selfdoc.find(meta, "skills", "TEAM-GMAIL")
    d = selfdoc.detail(meta, sec, s, ["a.py"])
    assert "So geht es" in d and "Gmail" in d and "a.py" in d and "pw" not in d
    sec, p = selfdoc.find(meta, "projekt", "p1")
    assert "Sei nett" in selfdoc.detail(meta, sec, p) and "team-gmail (nur diese)" in selfdoc.detail(meta, sec, p)
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


def test_task_heavy_flag_in_change_set():
    meta = {}
    task = {"name": "Post", "prompt": "Prüfe", "schedule": {"type": "daily", "time": "07:00"}}
    rows = dict((r[0], r[1]) for r in changes.task_fields(task, meta))
    assert rows["Besonders aufwändig"] == "nein"
    heavy = dict(task, heavy=True)
    ch = changes.build("aufgabe", "Post", changes.task_fields(task, meta), changes.task_fields(heavy, meta))
    assert ch["felder"] == [{"feld": "Besonders aufwändig", "alt": "nein", "neu": "ja"}]


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


def test_views_resolve_and_clean():
    # nobody configured anything: everybody starts in the simple view and may switch
    assert views.resolve(None, "u1", None) == {"view": "simple", "locked": False, "policy": "choice"}
    assert views.resolve({}, "u1", "expert")["view"] == "expert"
    assert views.resolve({}, "u1", "kaputt")["view"] == "simple"
    cfg = {"default": "choice", "users": {"u2": "expert", "u3": "simple"}}
    # a rule for the person wins over the own choice and locks it
    assert views.resolve(cfg, "u2", "simple") == {"view": "expert", "locked": True, "policy": "expert"}
    assert views.resolve(cfg, "u3", "expert") == {"view": "simple", "locked": True, "policy": "simple"}
    assert views.resolve(cfg, "u1", "expert") == {"view": "expert", "locked": False, "policy": "choice"}
    # a rule for everybody applies to people without their own rule
    assert views.resolve({"default": "simple", "users": {"u2": "choice"}}, "u1", "expert")["view"] == "simple"
    assert views.resolve({"default": "simple", "users": {"u2": "choice"}}, "u2", "expert")["view"] == "expert"
    # cleaning drops "as for everybody" entries and rejects unknown values
    assert views.clean({"default": "expert", "users": {"a": "", "b": "simple"}}) == {"default": "expert", "users": {"b": "simple"}}
    assert views.clean(None) == {"default": "choice", "users": {}}
    with pytest.raises(ValueError):
        views.clean({"default": "laie"})
    with pytest.raises(ValueError):
        views.clean({"users": {"a": "laie"}})


nd = load("notifydevices")


def _dev(key, name, user, service="", available=True):
    return {"key": key, "name": name, "service": service, "entity_id": "", "user_id": user,
            "source": "mobile_app", "available": available}


def test_notify_devices_only_own_and_readable_names():
    devs = [_dev("d1", "Pixel 8", "anna", "notify.mobile_app_pixel_8"), _dev("d2", "Tablet", "anna", "notify.mobile_app_tablet"),
            _dev("d3", "Galaxy S24", "carla", "notify.mobile_app_galaxy_s24"), _dev("d4", "Lautsprecher", None)]
    # only the person's own devices, and never an identifier instead of the name
    assert [d["name"] for d in nd.for_user(devs, "anna")] == ["Pixel 8", "Tablet"]
    assert nd.for_user(devs, "ben") == []
    # own choice wins
    assert nd.resolve(nd.for_user(devs, "anna"), "anna", {"notify_device": "d2"})["name"] == "Tablet"
    # a device of somebody else is never used
    assert nd.resolve(nd.for_user(devs, "anna"), "anna", {"notify_device": "d3"}) is None
    # exactly one device: no choice needed
    assert nd.resolve(nd.for_user(devs, "carla"), "carla", {})["name"] == "Galaxy S24"
    # several devices and nothing chosen: ask instead of guessing
    assert nd.resolve(nd.for_user(devs, "anna"), "anna", {}) is None
    # setting from before the change (a notify service) still resolves to the device
    assert nd.resolve(nd.for_user(devs, "anna"), "anna", {"notify_service": "notify.mobile_app_tablet"})["name"] == "Tablet"


def test_notify_device_links_by_admin():
    devs = [_dev("d1", "Pixel 8", "anna"), _dev("d2", "Galaxy S24", "carla"), _dev("d3", "Altes Handy", None)]
    linked = nd.apply_links(devs, {"overrides": {"d2": "anna", "d3": "ben"}})
    assert [d["name"] for d in nd.for_user(linked, "anna")] == ["Pixel 8", "Galaxy S24"]
    assert [d["name"] for d in nd.for_user(linked, "ben")] == ["Altes Handy"]
    assert nd.for_user(linked, "carla") == []
    assert all(d.get("linked_by_admin") for d in linked if d["key"] in ("d2", "d3"))
    # an empty value means "as Home Assistant says"
    assert nd.clean_links({"overrides": {"d2": "", "d3": "ben"}}) == {"overrides": {"d3": "ben"}}
    assert nd.clean_links(None) == {"overrides": {}}
    assert nd.clean_name("  Tablet \n") == "Tablet"


# ---------------------------------------------------------------- external providers, prices, Claude format
pr = load("pricing")
pv = load("providers")
cc = load("claude_convert")


def test_prices_and_cost():
    p = pr.price_eur("claude-sonnet-5-5", None, 1.0)
    assert (p["in"], p["out"], p["source"]) == (2.0, 10.0, "list")
    assert pr.price_eur("my-claude-opus-5-5", None, 1.0)["in"] == 4.0  # deployment names with a prefix
    assert pr.price_eur("kimi-k3", None, 1.0) is None  # unknown → never offered
    own = pr.price_eur("kimi-k3", {"in": "1,5", "out": 6}, 0.9)
    assert (own["in"], own["out"], own["cache_read"], own["source"]) == (1.5, 6.0, 0.15, "admin")
    # 1 M input + 100 k output on Sonnet 5.5 at 0.86 €/$: 1.72 + 0.86
    eur = pr.cost({"input": 1_000_000, "output": 100_000}, pr.price_eur("claude-sonnet-5-5", None, 0.86))
    assert round(eur, 4) == 2.58
    # Haiku 5.5 is dearer above 100 k prompt tokens
    h = pr.price_eur("claude-haiku-5-5", None, 1.0)
    assert pr.cost({"input": 50_000}, h) == 50_000 * 0.10 / 1e6
    assert pr.cost({"input": 150_000}, h) == 150_000 * 0.50 / 1e6
    assert pr.blended(pr.price_eur("claude-haiku-5-5", None, 1)) < pr.blended(pr.price_eur("claude-opus-5-5", None, 1))


def test_ledger_months_and_limits():
    from datetime import date
    led = {}
    pr.book(led, "u1", "foundry:claude-sonnet-5-5", {"input": 1000, "output": 10}, 0.5, day=date(2026, 10, 30))
    pr.book(led, "u1", "foundry:claude-sonnet-5-5", {"input": 1000, "output": 10}, 0.25, day=date(2026, 11, 2), task=True)
    pr.book(led, "u1", "anthropic:claude-opus-5-5", {"input": 10}, 1.0, day=date(2026, 11, 3))
    assert pr.month_cost(led, "u1", "2026-11") == 1.25
    assert pr.month_cost(led, "u1", "2026-10") == 0.5
    ms = pr.months(led, "u1", 3, today=date(2026, 11, 8))
    assert [x["month"] for x in ms] == ["2026-09", "2026-10", "2026-11"]
    assert ms[2]["eur"] == 1.25 and ms[2]["task_eur"] == 0.25 and ms[2]["requests"] == 2
    assert set(ms[2]["models"]) == {"foundry:claude-sonnet-5-5", "anthropic:claude-opus-5-5"}
    assert pr.limit_for({"u1": "12,5"}, 5, "u1") == 12.5
    assert pr.limit_for({}, 5, "u2") == 5 and pr.limit_for({}, None, "u2") == 0


def test_provider_order_and_emergency():
    order = pv.normalize([{"id": "main"}, {"id": "foundry", "enabled": True, "mode": "fallback"},
                          {"id": "anthropic", "enabled": True, "mode": "fallback"}])
    st = pv.unlocked(order, {"main": True, "foundry": True, "anthropic": True})
    assert st["foundry"]["unlocked"] is False and st["anthropic"]["unlocked"] is False and not pv.emergency(st)
    st = pv.unlocked(order, {"main": False, "foundry": True, "anthropic": True})
    assert st["foundry"] == {"unlocked": True, "why": "fallback"} and st["anthropic"]["unlocked"] is False
    st = pv.unlocked(order, {"main": False, "foundry": False, "anthropic": True})
    assert st["anthropic"]["unlocked"] and pv.emergency(st)
    # "always" providers can be picked any time; a disabled one does not count in the chain
    order2 = pv.normalize([{"id": "foundry", "enabled": True, "mode": "always"}, {"id": "main"},
                           {"id": "anthropic", "enabled": False}])
    st = pv.unlocked(order2, {"main": True, "foundry": True})
    assert st["foundry"]["unlocked"] and st["main"]["unlocked"] and st["anthropic"]["why"] == "disabled"
    assert [p["id"] for p in pv.normalize([{"id": "anthropic"}, {"id": "bogus"}])] == ["anthropic", "main", "foundry"]
    assert pv.split("foundry:claude-sonnet-5-5") == ("foundry", "claude-sonnet-5-5")
    assert pv.split("llama3:8b") == ("main", "llama3:8b") and not pv.is_external("glm-5.3")
    models = [{"key": "foundry:claude-opus-5-5", "provider": "foundry", "blended": 8},
              {"key": "foundry:claude-haiku-5-5", "provider": "foundry", "blended": 0.2},
              {"key": "anthropic:claude-sonnet-5-5", "provider": "anthropic", "blended": 4}]
    st = pv.unlocked(order, {"main": False, "foundry": True, "anthropic": True})
    usable = {"main": False, "foundry": True, "anthropic": True}
    assert pv.pick_fallback(order, st, usable, models) == "foundry:claude-haiku-5-5"
    assert pv.pick_fallback(order, st, usable, models, "foundry:claude-opus-5-5") == "foundry:claude-opus-5-5"
    assert pv.pick_fallback(order, st, usable, models, "anthropic:claude-sonnet-5-5") == "foundry:claude-haiku-5-5"  # locked


def test_foundry_endpoint_forms():
    assert pv.foundry_base("https://res.services.ai.azure.com/anthropic/v1/messages") == ("https://res.services.ai.azure.com/anthropic", "")
    assert pv.foundry_base("https://res.services.ai.azure.com/") == ("https://res.services.ai.azure.com/anthropic", "")
    assert pv.foundry_base("res.services.ai.azure.com/anthropic") == ("https://res.services.ai.azure.com/anthropic", "")
    assert pv.foundry_base("myresource") == ("", "myresource")
    # the Azure OpenAI address of the same resource works too
    assert pv.foundry_base("https://my-resource.openai.azure.com/openai/v1") == ("https://my-resource.services.ai.azure.com/anthropic", "")
    assert pv.foundry_base("https://Res.cognitiveservices.azure.com/") == ("https://res.services.ai.azure.com/anthropic", "")


def test_claude_messages_from_chat():
    chat = [
        {"role": "user", "content": "Hallo", "notes": None},
        {"role": "assistant", "content": "Ich schaue nach.", "tool_calls": [
            {"id": "chatcmpl-tool:1", "function": {"name": "ha_states", "arguments": '{"filter": "sensor."}'}},
            {"id": "call_2", "function": {"name": "web_search", "arguments": "kaputt"}}]},
        {"role": "tool", "tool_call_id": "chatcmpl-tool:1", "content": "21 °C", "notes": ["[LLMitMir] Nur noch 3 Schritte"]},
        {"role": "tool", "tool_call_id": "unbekannt", "content": "verwaist"},
        {"role": "user", "content": [{"type": "text", "text": "Und das Bild?"},
                                     {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD"}}]},
        {"role": "assistant", "content": "", "claude_blocks": [
            {"type": "thinking", "thinking": "hm", "signature": "sig", "extra": 1},
            {"type": "text", "text": "Ein Hund.", "citations": None}, {"type": "text", "text": ""}]},
    ]
    out = cc.to_messages(chat)
    assert [m["role"] for m in out] == ["user", "assistant", "user", "assistant"]
    a = out[1]["content"]
    assert a[1] == {"type": "tool_use", "id": "chatcmpl-tool_1", "name": "ha_states", "input": {"filter": "sensor."}}
    assert a[2]["input"] == {}  # invalid JSON arguments
    u = out[2]["content"]
    # results first (the missing one marked as aborted), the orphan dropped, then the reminder and the next message
    assert [b["type"] for b in u] == ["tool_result", "tool_result", "text", "text", "image"]
    assert u[0]["tool_use_id"] == "chatcmpl-tool_1" and u[1]["tool_use_id"] == "call_2" and u[1]["content"] == cc.ABORTED
    assert u[4]["source"] == {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"}
    assert out[3]["content"] == [{"type": "thinking", "thinking": "hm", "signature": "sig"}, {"type": "text", "text": "Ein Hund."}]
    assert cc.to_messages(chat) == out  # deterministic
    assert all(b["type"] != "thinking" for m in cc.strip_thinking(out) for b in m["content"])
    assert cc.to_messages([{"role": "assistant", "content": "x"}])[0]["role"] == "user"
    t = cc.to_tools([{"type": "function", "function": {"name": "f", "description": "d", "parameters": {"properties": {"a": {}}}}}])
    assert t == [{"name": "f", "description": "d", "input_schema": {"properties": {"a": {}}, "type": "object"}}]


def test_claude_stream_translation():
    tr = cc.StreamTranslator()
    evs = [
        {"type": "message_start", "message": {"model": "claude-sonnet-5-5", "usage": {"input_tokens": 100, "cache_read_input_tokens": 900, "output_tokens": 1}}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking"}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "Denke"}},
        {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "Hallo"}},
        {"type": "content_block_start", "index": 2, "content_block": {"type": "tool_use", "id": "toolu_1", "name": "ha_states"}},
        {"type": "content_block_delta", "index": 2, "delta": {"type": "input_json_delta", "partial_json": '{"a":'}},
        {"type": "content_block_delta", "index": 2, "delta": {"type": "input_json_delta", "partial_json": '1}'}},
        {"type": "message_delta", "delta": {"stop_reason": "tool_use"}, "usage": {"output_tokens": 42}},
        {"type": "text", "text": "Hallo"},  # SDK helper events are ignored
    ]
    chunks = [c for c in (tr.feed(e) for e in evs) if c]
    assert tr.started and tr.usage == {"input": 100, "output": 42, "cache_read": 900, "cache_write": 0}
    assert chunks[0]["choices"][0]["delta"] == {"reasoning": "Denke"}
    assert chunks[-1]["choices"][0]["finish_reason"] == "tool_calls"
    args = "".join(tc["function"]["arguments"] for c in chunks for ch in c["choices"] for tc in ch["delta"].get("tool_calls") or [])
    assert args == '{"a":1}'
    assert tr.usage_chunk()["usage"]["prompt_tokens"] == 1000


def test_scrub_variants_and_rotation():
    import base64, urllib.parse
    store = {"k1": {"id": "k1", "name": "NC", "type": "webdav", "fields": {"url": "https://x", "username": "anna", "password": "p@ss w/rd+1"}}}
    sec = creds.secret_values(store)
    pw = "p@ss w/rd+1"
    for leaked in (pw, urllib.parse.quote(pw, safe=""), urllib.parse.quote_plus(pw), base64.b64encode(pw.encode()).decode(),
                   base64.b64encode(b"anna:" + pw.encode()).decode()):
        assert leaked not in creds.scrub(f"Fehler: {leaked} abgelehnt", sec), leaked
    assert creds.scrub("Authorization: Basic " + base64.b64encode(b"anna:" + pw.encode()).decode(), sec) == "Authorization: Basic •••"
    old = store["k1"]
    assert creds.secret_changes(old, {"type": "webdav", "fields": dict(old["fields"], password="neu")})
    assert not creds.secret_changes(old, {"type": "webdav", "fields": dict(old["fields"], url="https://y")})
    assert creds.secret_changes(old, {"type": "webdav", "fields": {"url": "https://x", "username": "anna"}})  # removed


def test_scrub_nested():
    req = {"system": "pw geheim123", "messages": [{"content": [{"type": "text", "text": "x geheim123"},
                                                              {"type": "thinking", "signature": "geheim123"}]}]}
    out = creds.scrub_obj(req, ["geheim123"])
    assert out["system"] == "pw •••" and out["messages"][0]["content"][0]["text"] == "x •••"
    assert out["messages"][0]["content"][1]["signature"] == "geheim123"  # signatures stay untouched

def test_task_notify_decision():
    """Only what the run itself declares reaches the phone: nothing, a new result, or a question."""
    tn = load("tasknotify")
    # "nur bei neuem Ergebnis oder Fehler": a run without news stays silent, however long its report is
    assert not tn.should_notify("on_change", "done", "nichts", "", "")
    assert tn.should_notify("on_change", "done", "ergebnis", "Neue Rechnung 85,16 €", "")
    assert not tn.should_notify("on_change", "done", "ergebnis", "Neue Rechnung 85,16 €", "Neue Rechnung 85,16 €")
    assert tn.should_notify("on_change", "done", "frage", "Wem gehört der OBI-Bon?", "")
    assert tn.should_notify("on_change", "error", "nichts", "", "")
    # "nur bei Fehlern": questions and results stay silent, a stopped run is no error
    assert tn.should_notify("error", "error", "nichts", "", "")
    assert not tn.should_notify("error", "done", "frage", "Wem gehört der OBI-Bon?", "")
    assert not tn.should_notify("error", "stopped", "frage", "", "")
    # "nach jedem Lauf" and "nie"
    assert tn.should_notify("always", "done", "nichts", "", "")
    assert not tn.should_notify("never", "error", "frage", "", "")
    # an unknown declaration counts as "nothing to report"
    assert not tn.should_notify("on_change", "done", "", "", "")


def test_task_notify_same_news():
    """A standing state the person already knows is no news, a changed number always is."""
    tn = load("tasknotify")
    mail = "Postfach: keine neuen Mails, kein Spam. Offen: Google Play – Händlerstatus bis 01.02.2027 angeben."
    mail2 = "Postfach: keine neuen Mails, keine Werbung. Offen: Google Play – Händlerstatus bis 01.02.2027 angeben (sonst App-Entfernung)."
    assert tn.same_news(mail, mail2)
    assert not tn.same_news("Neue Rechnung OBI 85,16 €", "Neue Rechnung OBI 85,17 €")
    assert not tn.same_news("Keine neuen Belege.", "Neuer Beleg: Stadtwerke 120,00 €.")
    assert not tn.same_news("", "irgendwas")
    # the same question does not ring every run – but comes back as a reminder after a week
    day = 86400.0
    assert not tn.should_notify("on_change", "done", "frage", "Vault-Passwörter neu setzen?",
                                "Vault-Passwörter neu setzen?", 1000.0, 1000.0 + 2 * day)
    assert tn.should_notify("on_change", "done", "frage", "Vault-Passwörter neu setzen?",
                            "Vault-Passwörter neu setzen?", 1000.0, 1000.0 + 8 * day)
    assert not tn.should_notify("on_change", "done", "ergebnis", mail, mail2)
    assert not tn.should_notify("on_change", "done", "ergebnis", mail2, mail)
    assert tn.should_notify("on_change", "done", "ergebnis", "Neue Mail von Google Play: Händlerstatus prüfen.", mail2)

def test_credential_use_counter():
    """Every tool call that got through counts, external models additionally in their own counter."""
    c = {"id": "k1", "name": "Hof Nextcloud", "type": "webdav", "fields": {"password": "pw"}}
    creds.note_use(c, model="glm-5.3", external=False, ts=100.0)
    assert (c["uses"], c["last_used"], c["last_model"]) == (1, 100.0, "glm-5.3")
    assert "ext_uses" not in c
    creds.note_use(c, model="claude-sonnet-4-5", external=True, ts=200.0)
    assert (c["uses"], c["last_used"], c["last_model"]) == (2, 200.0, "claude-sonnet-4-5")
    assert (c["ext_uses"], c["ext_uses_since"], c["ext_last"]) == (1, 1, 200.0)
    # after a new secret the external counter starts again, the general one keeps counting
    c.update(ext_uses_since=0)
    creds.note_use(c, model="claude-sonnet-4-5", external=True, ts=300.0)
    assert (c["uses"], c["ext_uses"], c["ext_uses_since"]) == (3, 2, 1)


sharing = load("sharing")


def test_share_clean_and_rights():
    """Sharing keeps one entry per person, drops the owner and never invents rights."""
    users = sharing.clean([{"user_id": "u1", "edit": True, "notify": False},
                           {"user_id": "u1", "edit": False, "notify": True},
                           {"id": "u2", "notify": True},
                           {"user_id": ""}, "quatsch"])
    assert users == {"u1": {"edit": True, "notify": False}, "u2": {"edit": False, "notify": True}}
    assert sharing.clean(None) == {}
    assert sharing.users({"users": users}) == ["u1", "u2"]
    assert sharing.recipients({"users": users}) == ["u2"]
    assert sharing.rights({"users": users}, "u1") == {"owner": False, "edit": True, "notify": False}
    assert sharing.rights({"users": users}, "u2") == {"owner": False, "edit": False, "notify": True}
    assert sharing.rights({"users": users}, "fremd") == {"owner": False, "edit": False, "notify": False}
    assert sharing.rights(None, "u1") == {"owner": False, "edit": False, "notify": False}


def test_share_summary():
    """The one-line summary names every person and what they may do."""
    share = {"users": {"u1": {"edit": True, "notify": True}, "u2": {"edit": False, "notify": False},
                       "u3": {"edit": True, "notify": False}}}
    names = {"u1": "Doro", "u2": "Hannes", "u3": "Niko"}
    assert sharing.summary(share, names) == "Doro (bearbeiten und Benachrichtigung), Hannes (nur ansehen), Niko (bearbeiten)"
    assert sharing.summary(None) == "niemand"
    assert sharing.summary({"users": {"u9": {"edit": False, "notify": True}}}) == "u9 (Benachrichtigung)"


def test_credential_check_verdict():
    # abgelehnte Anmeldung ist der Fall, der in der Liste rot werden muss
    assert ck.verdict(401) == (False, "HTTP 401: Benutzername, Passwort oder Token wurde abgelehnt")
    assert ck.verdict(403)[0] is False
    assert ck.verdict(404)[0] is False
    assert ck.verdict(404, reachable_404=True)[0] is True
    assert ck.verdict(200) == (True, "HTTP 200: erreichbar")
    assert ck.verdict(429)[0] is True  # erreichbar, nur gerade ausgelastet
    assert ck.verdict(503)[0] is False
    assert ck.verdict(None, "Keine Verbindung: ClientConnectorError")[0] is False


def test_credential_check_state():
    broken = {"check": {"ok": False, "message": "HTTP 401: abgelehnt"}}
    good = {"check": {"ok": True, "message": "HTTP 200: erreichbar"}}
    assert ck.failed(broken) and not ck.failed(good) and not ck.failed({})
    assert ck.summary(broken) == "HTTP 401: abgelehnt"
    assert ck.summary(good) == "" and ck.summary({}) == ""


def test_credential_check_auth_errors():
    assert ck.looks_like_auth_error("Fehler: HTTP 401 bei Hof Share")
    assert ck.looks_like_auth_error("Anmeldung abgelehnt: [AUTHENTICATIONFAILED] Invalid credentials")
    assert not ck.looks_like_auth_error("Fehler: HTTP 500")
    assert not ck.looks_like_auth_error("")


def test_credential_check_missing_fields():
    assert ck._missing({"type": "bearer", "fields": {"url": "https://x", "token": ""}}) == "token"
    assert ck._missing({"type": "bearer", "fields": {"url": "https://x", "token": "abc"}}) == ""
    assert ck._missing({"type": "other", "fields": {}}) == ""

def test_credential_expiry():
    from datetime import date
    today = date(2026, 11, 11)
    assert creds.expiry({"valid_until": ""}, today) == {"date": "", "days": None, "expired": False, "soon": False}
    assert creds.expiry({}, today)["date"] == ""
    soon = creds.expiry({"valid_until": "2026-11-20"}, today)
    assert (soon["days"], soon["expired"], soon["soon"]) == (9, False, True)
    far = creds.expiry({"valid_until": "2027-11-05"}, today)
    assert (far["days"], far["expired"], far["soon"]) == (359, False, False)
    gone = creds.expiry({"valid_until": "2026-11-01"}, today)
    assert (gone["days"], gone["expired"], gone["soon"]) == (-10, True, False)
    # heute ist noch nicht abgelaufen, aber gewarnt
    assert creds.expiry({"valid_until": "2026-11-11"}, today)["soon"] is True
    # Unsinn im Feld darf nichts kaputt machen
    assert creds.expiry({"valid_until": "bald"}, today)["days"] is None


def test_retention_days():
    # Standard ist aus (0), beim Einschalten schlägt die Oberfläche 30 Tage vor
    assert retention.clean_days(None) == 0 and retention.clean_days("") == 0
    assert retention.DEFAULT_DAYS == 0 and retention.SUGGEST_DAYS == 30
    assert retention.clean_days(0) == 0 and retention.clean_days("30") == 30
    with pytest.raises(ValueError):
        retention.clean_days(-1)
    with pytest.raises(ValueError):
        retention.clean_days(retention.MAX_DAYS + 1)
    with pytest.raises(ValueError):
        retention.clean_days("sieben")
    assert retention.describe(30) == "30 Tage" and retention.describe(1) == "1 Tag"
    assert retention.describe(0) == "aus"


def test_retention_expiry():
    day = 86400
    chats = {"a": {"kind": "chat", "updated": 1000},
             "b": {"kind": "cowork", "updated": 1000, "project_id": "p1"},
             "c": {"kind": "task_run", "updated": 1000},          # Lauf einer Aufgabe: bleibt
             "d": {"kind": "chat", "updated": 1000, "pinned": True},  # angeheftet: bleibt
             "e": {"kind": "chat", "updated": 1000, "project_id": "weg"}}  # Projekt gelöscht: Frist der Person
    projects = {"p1": {"retention_days": 30}}
    # ohne eigene Frist ist das Löschen aus: nichts verschwindet
    assert retention.expired(chats, {}, {}, 1000 + 8 * day) == []
    # Frist der Person für alles außerhalb von Projekten
    assert retention.expired(chats, projects, {"retention_days": 7}, 1000 + 8 * day) == ["a", "e"]
    # Projektfrist greift, sobald sie abgelaufen ist – ohne Frist der Person bleibt der Rest
    assert retention.expired(chats, projects, {}, 1000 + 31 * day) == ["b"]
    assert retention.expired(chats, projects, {"retention_days": 7}, 1000 + 31 * day) == ["a", "b", "e"]
    # 0 = unbegrenzt, auch im Projekt
    assert retention.expired(chats, {"p1": {"retention_days": 0}}, {"retention_days": 0}, 1000 + 999 * day) == []
    # eigene Frist der Person für alles außerhalb von Projekten
    assert retention.expired(chats, projects, {"retention_days": 2}, 1000 + 3 * day) == ["a", "e"]
    # gerade eben benutzt: nichts abgelaufen
    assert retention.expired({"x": {"kind": "chat", "updated": 1000}}, {}, {}, 1000 + 6 * day) == []


def _pkg(mod: str):
    """Ein Modul des Pakets mit relativen Importen laden – ohne das Home-Assistant-__init__ auszuführen."""
    import types

    if "lmpkg" not in sys.modules:
        pkg = types.ModuleType("lmpkg")
        pkg.__path__ = [str(BASE)]
        sys.modules["lmpkg"] = pkg
    return importlib.import_module(f"lmpkg.{mod}")


ICS = """BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
UID:1\r
SUMMARY:Teamrunde\r
DTSTART;TZID=Europe/Berlin:20261116T100000\r
DTEND;TZID=Europe/Berlin:20261116T110000\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:2\r
SUMMARY:Alt\r
DTSTART:20250101T100000Z\r
DTEND:20250101T110000Z\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:3\r
SUMMARY:Jour fixe\r
DTSTART:20260105T080000Z\r
RRULE:FREQ=WEEKLY;BYDAY=MO\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:4\r
SUMMARY:Serie vorbei\r
DTSTART:20260105T080000Z\r
RRULE:FREQ=WEEKLY;UNTIL=20260301T000000Z\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:5\r
SUMMARY:Urlaub\r
DTSTART;VALUE=DATE:20261110\r
DTEND;VALUE=DATE:20261114\r
END:VEVENT\r
END:VCALENDAR\r
"""


def test_gwdg_account_like_calmerge():
    # wie calmerge: ohne @ wird @gwdg.de ergänzt, alles klein; Kalender und Kontakte laufen über EWS
    assert creds.gwdg_email(" Max.Muster ") == "max.muster@gwdg.de"
    assert creds.gwdg_email("Max.Muster@Uni-Goettingen.de") == "max.muster@uni-goettingen.de"
    assert creds.gwdg_email("") == ""
    f = creds.normalize_fields("gwdg", {"username": "Max.Muster", "password": "pw", "share_token": ""}, ["calendar"])
    assert f == {"username": "max.muster@gwdg.de", "password": "pw", "ews_url": creds.GWDG_EWS}
    # alle Dienste: Postfach kommt dazu, abgewählte Adressen verschwinden wieder
    f = creds.normalize_fields("gwdg", dict(f, username="max.muster"), ["mail", "contacts"])
    assert f["ews_url"] == creds.GWDG_EWS  # Postfach, Kalender und Kontakte: derselbe Endpunkt
    assert "imap_host" not in f and "smtp_host" not in f  # kein IMAP/SMTP mehr nötig
    f = creds.normalize_fields("gwdg", dict(f, username="max.muster"), ["mail"])
    assert f["ews_url"] == creds.GWDG_EWS  # auch das Postfach läuft über EWS
    assert creds.normalize_fields("webdav", {"url": "x"}) == {"url": "x"}
    # gwdg steht unten in der Liste der Typen, ews direkt davor
    assert list(creds.TYPES)[-2:] == ["ews", "gwdg"]


def test_gwdg_form_shows_only_what_the_person_fills_in():
    """Die Adressen setzt LLMitMir – im Formular stehen nur E-Mail-Adresse und Passwort."""
    t = creds.TYPES["gwdg"]
    auto = {k for ks in t["service_fields"].values() for k in ks}
    assert auto == {"ews_url"}  # eine Adresse für Postfach, Kalender und Kontakte
    assert set(t["hidden"]) == auto  # nicht als Feld anzeigen
    assert set(t["readonly"]) == auto  # und nicht von Hand ändern
    assert t["fields"] == ["username", "password"]
    # DavMail-Adressen und IMAP/SMTP früherer Versionen verschwinden beim Speichern
    assert set(t["obsolete"]) == {"url", "contacts_url", "imap_host", "smtp_host"}
    old = {"username": "a@gwdg.de", "password": "pw", "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/",
           "contacts_url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/contacts/"}
    f = creds.normalize_fields("gwdg", old, ["calendar"])
    assert f == {"username": "a@gwdg.de", "password": "pw", "ews_url": creds.GWDG_EWS}
    # der eigene Exchange-Typ hat keine automatischen Felder
    assert not creds.TYPES["ews"].get("hidden") and not creds.TYPES["ews"].get("obsolete")


def test_gwdg_services_and_legacy():
    new = {"type": "gwdg", "fields": {"username": "a@gwdg.de", "password": "pw"}}
    assert creds.services(new) == ["calendar"]  # Standard wie in calmerge: der Kalender
    assert creds.services(dict(new, services=["contacts", "mail"])) == ["mail", "contacts"]
    # ältere WebDAV-Zugänge mit DavMail-URL: GWDG-Kalender, E-Mail-Adresse aus der URL
    legacy = {"type": "webdav", "fields": {"url": "https://davmail.gwdg.de:1080/users/Max@gwdg.de/calendar", "password": "pw"}}
    assert creds.is_gwdg(legacy) and creds.services(legacy) == ["calendar"]
    assert creds.gwdg_account(legacy) == ("max@gwdg.de", "https://davmail.gwdg.de:1080/users/max@gwdg.de/")
    assert not creds.is_gwdg({"type": "webdav", "fields": {"url": "https://cloud.example.org"}})
    d = creds.describe_for_model({"k": dict(new, id="k", name="Uni", services=["mail", "calendar"])})[0]
    assert d["dienste"] == {"E-Mail-Postfach": "nur lesen", "Kalender": "nur lesen"} and "pw" not in str(d)


def test_gwdg_secrets_scrubbed():
    import base64
    store = {"k": {"id": "k", "name": "Uni", "type": "gwdg", "fields": {"username": "a@gwdg.de", "password": "geheim-42"}}}
    sec = creds.secret_values(store)
    pair = base64.b64encode(b"a@gwdg.de:geheim-42").decode()
    assert creds.scrub(f"Basic {pair} geheim-42", sec) == "Basic ••• •••"


def test_gwdg_dav_paths_and_range():
    D = _pkg("tools.dav")
    # älterer Zugang mit DavMail-Adresse: bleibt bei DavMail
    cal = {"name": "Uni", "type": "webdav",
           "fields": {"url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/", "password": "pw"}}
    assert D.dav_root(cal) == "https://davmail.gwdg.de:1080/users/a@gwdg.de"
    # der neue GWDG-Zugang läuft über EWS – dav_request erklärt das, statt ins Leere zu greifen
    with pytest.raises(ValueError, match="Exchange Web Services"):
        D.dav_root({"name": "Uni", "type": "gwdg", "services": ["calendar"],
                    "fields": {"username": "a@gwdg.de", "password": "pw"}})
    assert D._auth(cal).login == "a@gwdg.de"
    with pytest.raises(ValueError):
        D.files_base(cal)  # keine Dateiablage
    root = D.dav_root(cal)
    assert D.gwdg_allowed(cal, root + "/calendar/") == ""
    assert "nicht für Kontakte freigegeben" in D.gwdg_allowed(cal, root + "/contacts/")
    assert D.gwdg_allowed(cal, root + "/inbox/").startswith("Fehler")
    assert D.gwdg_allowed(cal, root + "/calendar/../inbox/").startswith("Fehler")
    assert D.gwdg_allowed(cal, root + "/calendar/%2E%2E/inbox/").startswith("Fehler")
    assert D.gwdg_allowed(cal, "https://davmail.gwdg.de:1080/users/b@gwdg.de/calendar/").startswith("Fehler")
    evs = {e["uid"]: e for e in D._ics_events(ICS)}
    keep = [u for u, e in evs.items() if D.in_range(e, "2026-11-12", "2026-11-26")]
    assert keep == ["1", "3", "5"]  # Termin im Zeitraum, laufende Serie, mehrtägig über den Anfang hinweg
    assert not D.in_range(evs["5"], "2026-11-14", "2026-11-20")  # DTEND bei ganztägig ist exklusiv


def test_gwdg_caldav_events_uses_get_like_calmerge():
    import asyncio

    D = _pkg("tools.dav")
    calls = []

    class Resp:
        status = 200
        headers = {}

        def __init__(self):
            async def chunks(_n):
                yield ICS.encode()
            self.content = type("C", (), {"iter_chunked": staticmethod(chunks)})()

        async def read(self):  # EWS: leere, aber gültige Antwort ohne Termine
            return (b'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
                    b'xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body>'
                    b'<m:FindItemResponse><m:ResponseMessages><m:FindItemResponseMessage ResponseClass="Success">'
                    b'<m:ResponseCode>NoError</m:ResponseCode><m:RootFolder TotalItemsInView="0">'
                    b'<m:Items/></m:RootFolder></m:FindItemResponseMessage></m:ResponseMessages>'
                    b'</m:FindItemResponse></s:Body></s:Envelope>')

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class Session:
        def get(self, url, **kw):
            calls.append(("GET", url, kw["auth"].login))
            return Resp()

        def request(self, method, url, **kw):
            calls.append((method, url))
            return Resp()

        def post(self, url, **kw):  # EWS: SOAP per POST, hier eine leere, gültige Antwort
            calls.append(("POST", url, kw["data"].decode()))
            return Resp()

    cred = {"id": "k", "name": "Uni", "type": "webdav",
            "fields": {"url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/", "password": "pw"}}
    ctx = type("Ctx", (), {"creds": {"k": cred}, "allowed_creds": None, "session": Session()})()
    out = asyncio.run(D.caldav_events(ctx, {"zugang": "Uni", "von": "2026-11-12", "bis": "2026-11-26"}))
    assert calls == [("GET", "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/", "a@gwdg.de")]
    assert [e["summary"] for e in out["termine"]] == ["Jour fixe", "Urlaub", "Teamrunde"]
    # der neue GWDG-Zugang geht denselben Weg über EWS (caldav_events bleibt für bestehende Skills gültig)
    ews_cred = {"id": "e", "name": "GWDG", "type": "gwdg", "services": ["calendar"],
                "fields": {"username": "a@gwdg.de", "password": "pw"}}
    ctx2 = type("Ctx", (), {"creds": {"e": ews_cred}, "allowed_creds": None, "session": Session()})()
    out = asyncio.run(D.caldav_events(ctx2, {"zugang": "GWDG", "von": "2026-11-12", "bis": "2026-11-26"}))
    assert calls[-1][0] == "POST" and "FindItem" in calls[-1][2]
    assert out["anzahl"] == 0  # die Fake-Antwort enthält keine Termine
    # ohne angehakten Kalender lehnt das Werkzeug ab, ohne den Server zu fragen
    ews_cred["services"] = ["mail"]
    calls.clear()
    assert "nicht für Kalender freigegeben" in asyncio.run(D.caldav_events(ctx2, {"zugang": "GWDG"}))
    assert calls == []


def test_gwdg_check_each_service(monkeypatch):
    import asyncio

    K = _pkg("credcheck")
    seen = []

    async def fake_http(session, method, url, **kw):
        seen.append((method, url, kw["headers"]["Depth"]))
        return 207

    async def fake_imap(cred):
        seen.append(("IMAP", cred["fields"]["imap_host"]))
        return K._result(False, "Anmeldung abgelehnt: NO LOGIN failed")

    async def fake_ews(session, cred, folder="calendar"):
        seen.append(("EWS", folder))
        return K._result(True, "EWS antwortet", 200)

    # ueber monkeypatch, damit die echten Funktionen danach wieder gelten
    monkeypatch.setattr(K, "_http", fake_http)
    monkeypatch.setattr(K, "_check_imap", fake_imap)
    monkeypatch.setattr(K, "_check_ews", fake_ews)
    cred = {"type": "gwdg", "services": ["mail", "calendar", "contacts"],
            "fields": {"username": "a@gwdg.de", "password": "pw"}}
    r = asyncio.run(K.check_credential(None, cred))
    # Postfach, Kalender und Kontakte über dieselbe Schnittstelle – kein IMAP, kein DavMail
    assert seen == [("EWS", "inbox"), ("EWS", "calendar"), ("EWS", "contacts")]
    assert r["ok"] and "E-Mail-Postfach: ok" in r["message"] and "Kalender: ok" in r["message"]
    assert K._missing({"type": "gwdg", "fields": {"username": "a@gwdg.de"}}) == "password"
    # älterer Zugang mit DavMail-Adresse: weiterhin PROPFIND auf die DavMail-Ordner
    seen.clear()
    legacy = {"type": "gwdg", "services": ["calendar", "contacts"],
              "fields": {"username": "a@gwdg.de", "password": "pw",
                         "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/"}}
    r = asyncio.run(K.check_credential(None, legacy))
    base = "https://davmail.gwdg.de:1080/users/a@gwdg.de/"
    assert seen == [("PROPFIND", base + "calendar/", "0"), ("PROPFIND", base + "contacts/", "0")] and r["ok"]
    # der neue Typ ews: Pflichtfelder und Prüfung über EWS
    assert K._missing({"type": "ews", "fields": {"url": "https://x/EWS/Exchange.asmx", "username": "u"}}) == "password"
    seen.clear()
    r = asyncio.run(K.check_credential(None, {"type": "ews", "services": ["calendar"],
                                              "fields": {"url": "https://x/EWS/Exchange.asmx", "username": "u",
                                                         "password": "p"}}))
    assert seen == [("EWS", "calendar")] and r["ok"]


class FakeIMAP:
    """Nimmt IMAP-Befehle entgegen wie imaplib und merkt sich, was geschickt wurde."""

    def __init__(self, caps=("IMAP4REV1", "UIDPLUS")):
        self.calls, self.capabilities, self.literal = [], caps, None
        self.msg = (b"From: Anna <anna@example.org>\r\nTo: a@gwdg.de\r\nSubject: =?utf-8?q?Gr=C3=BC=C3=9Fe?=\r\n"
                    b"Date: Thu, 12 Nov 2026 09:00:00 +0100\r\nMessage-ID: <m1@example.org>\r\n\r\nHallo!\r\n")

    def login(self, u, p):
        self.calls.append(("LOGIN", u))
        return "OK", [b"ok"]

    def logout(self):
        self.calls.append(("LOGOUT",))

    def select(self, mb, readonly=False):
        self.calls.append(("EXAMINE" if readonly else "SELECT", mb))
        return "OK", [b"3"]

    def list(self):
        return "OK", [b'(\\HasNoChildren) "/" INBOX', b'(\\HasNoChildren \\Sent) "/" "Gesendete Elemente"',
                      b'(\\HasNoChildren \\Trash) "/" "Gel&APY-schte Elemente"']

    def uid(self, cmd, *args):
        self.calls.append(("UID", cmd, *args) + ((("LITERAL", self.literal),) if self.literal else ()))
        self.literal = None
        if cmd == "SEARCH":
            return "OK", [b"7 9"]
        if cmd == "FETCH":
            return "OK", [(f"1 (UID {args[0].split(',')[0]} FLAGS (\\Seen) RFC822.SIZE 120 BODY[] {{{len(self.msg)}}}".encode(), self.msg), b")"]
        return "OK", [b"done"]

    def append(self, mb, flags, when, raw):
        self.calls.append(("APPEND", mb))
        return "OK", [b"ok"]


def test_mailbox_names_and_search():
    MB = load("mailbox")
    assert MB.mutf7_encode("Gelöschte Elemente") == "Gel&APY-schte Elemente"
    assert MB.mutf7_decode("Gel&APY-schte Elemente") == "Gelöschte Elemente"
    assert MB.mutf7_decode(MB.mutf7_encode("A&B – Ü")) == "A&B – Ü"
    folders = MB.parse_list(FakeIMAP().list()[1])
    assert [f["name"] for f in folders] == ["INBOX", "Gesendete Elemente", "Gelöschte Elemente"]
    assert MB.find_special(folders, "\\Trash", MB.TRASH_NAMES) == "Gelöschte Elemente"
    assert MB.search_criteria() == (["ALL"], None)
    crit, lit = MB.search_criteria(suche="Rechnung", von="2026-11-01", ungelesen=True)
    assert crit == ["UNSEEN", "SINCE", "01-Nov-2026", "TEXT", '"Rechnung"'] and lit is None
    crit, lit = MB.search_criteria(suche="Grüße", absender="anna")
    assert crit == ["CHARSET", "UTF-8", "FROM", '"anna"', "TEXT"] and lit == "Grüße".encode()
    with pytest.raises(ValueError):
        MB.search_criteria(suche="Grüße", absender="Jürgen")


def test_mailbox_message_parsing():
    MB = load("mailbox")
    msg = MB.build_message("a@gwdg.de", "b@example.org", "Bericht", "Hallo", reply_to={"message_id": "<m1@x>"},
                           files=[("bericht.pdf", b"%PDF-1.4")])
    raw = bytes(msg)
    out = MB.parse_message(raw)
    assert out["betreff"] == "Bericht" and out["text"].strip() == "Hallo"
    assert out["anhaenge"] == [{"name": "bericht.pdf", "typ": "application/pdf", "groesse": 8}]
    assert msg["In-Reply-To"] == "<m1@x>"
    html_only = b"Subject: x\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hallo&nbsp;<b>Welt</b></p><script>x()</script>"
    assert MB.parse_message(html_only)["text"] == "Hallo Welt"
    assert MB.header_summary(FakeIMAP().msg)["betreff"] == "Grüße"


def test_mailbox_read_only_never_changes_anything():
    MB = load("mailbox")
    imap = FakeIMAP()
    box = MB.Mailbox("email.gwdg.de:993", "a@gwdg.de", "pw", writable=False, connect=lambda h, p: imap)
    total, rows = box.search("Gelöschte Elemente", *MB.search_criteria(suche="Grüße"), 20)
    assert total == 2 and rows[0]["betreff"] == "Grüße" and rows[0]["gelesen"]
    assert box.fetch("INBOX", "9").startswith(b"From:")
    for call in (lambda: box.store("INBOX", ["9"], "+FLAGS", "\\Seen"), lambda: box.move("INBOX", ["9"], "Archiv"),
                 lambda: box.append("INBOX", b"x"), lambda: box.open("INBOX", write=True)):
        with pytest.raises(MB.ReadOnly):
            call()
    cmds = [c for c in imap.calls if c[0] in ("EXAMINE", "SELECT", "UID", "APPEND")]
    assert {c[0] for c in cmds} == {"EXAMINE", "UID"}  # nur EXAMINE, nie SELECT oder APPEND
    assert cmds[0] == ("EXAMINE", '"Gel&APY-schte Elemente"')
    assert all(c[1] in ("SEARCH", "FETCH") for c in cmds if c[0] == "UID")
    assert all("PEEK" in c[3] for c in cmds if c[:2] == ("UID", "FETCH"))
    assert ("LITERAL", "Grüße".encode()) in cmds[1]
    # mit Schreibrecht: SELECT, und ohne MOVE wird kopiert, markiert und per UID EXPUNGE entfernt
    imap = FakeIMAP()
    box = MB.Mailbox("email.gwdg.de", "a@gwdg.de", "pw", writable=True, connect=lambda h, p: imap)
    assert box.move("INBOX", ["9"], "Archiv") == "verschoben"
    assert [c[:2] for c in imap.calls[1:]] == [("SELECT", '"INBOX"'), ("UID", "COPY"), ("UID", "STORE"), ("UID", "EXPUNGE")]


def _mail_ctx(access):
    import types

    # älterer GWDG-Zugang mit DavMail-Adresse: läuft weiter über IMAP/SMTP (neue Zugänge nutzen EWS)
    cred = {"id": "k", "name": "Uni", "type": "gwdg", "services": ["mail", "calendar"], "access": access,
            "fields": {"username": "a@gwdg.de", "password": "pw", "imap_host": "email.gwdg.de:993",
                       "smtp_host": "email.gwdg.de:587",
                       "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/"}}
    saved = {}

    async def write_file(scope, owner, name, data):
        saved[name] = data
        return {"name": name}

    async def emit():
        return None

    store = types.SimpleNamespace(async_write_file=write_file)
    return types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, store=store, chat_id="c", emit_files=emit), saved


def test_mail_tools_follow_access():
    import asyncio

    M = _pkg("tools.mail")
    imaps, smtps = [], []

    def imap(h, p):
        imaps.append(FakeIMAP())
        return imaps[-1]

    class FakeSMTP:
        def __init__(self):
            self.sent = []

        def login(self, u, p):
            pass

        def send_message(self, msg):
            self.sent.append(msg)
            return {}

        def quit(self):
            pass

    def smtp(h, p):
        smtps.append(FakeSMTP())
        return smtps[-1]

    M._CONNECT.update(imap=imap, smtp=smtp)
    try:
        ctx, _ = _mail_ctx({"mail": "read", "calendar": "read"})
        reg = _pkg("tools").REGISTRY
        run = lambda name, a: asyncio.run(reg[name].handler(ctx, a))  # noqa: E731
        out = run("mail_list", {"zugang": "Uni"})
        assert out["treffer"] == 2 and out["recht"] == "nur lesen"
        assert run("mail_read", {"zugang": "Uni", "uid": "9"})["betreff"] == "Grüße"
        n = len(imaps)
        assert "nur lesen" in run("mail_send", {"zugang": "Uni", "an": "x@y.de", "betreff": "b", "text": "t"})
        assert "nur lesen" in run("mail_change", {"zugang": "Uni", "uids": ["9"], "aktion": "loeschen"})
        assert len(imaps) == n and smtps == []  # gar nicht erst verbunden
        assert all(c[0] != "SELECT" for i in imaps for c in i.calls)
        # Postfach nicht angehakt
        ctx.creds["k"]["services"] = ["calendar"]
        assert "nicht für das E-Mail-Postfach freigegeben" in run("mail_list", {"zugang": "Uni"})
        # lesen und schreiben: senden (mit Kopie in Gesendet) und löschen = in den Papierkorb
        ctx.creds["k"].update(services=["mail"], access={"mail": "write"})
        out = run("mail_send", {"zugang": "Uni", "an": "x@y.de", "betreff": "b", "text": "t"})
        assert out["ok"] and smtps[-1].sent[0]["From"] == "a@gwdg.de" and "Gesendete Elemente" in out["kopie"]
        out = run("mail_change", {"zugang": "Uni", "uids": ["9"], "aktion": "loeschen"})
        assert "Gelöschte Elemente" in out["aktion"]
        assert ("UID", "COPY", "9", '"Gel&APY-schte Elemente"') in imaps[-1].calls
    finally:
        M._CONNECT.clear()


def test_gwdg_access_and_secrets():
    cred = {"id": "k", "name": "Uni", "type": "gwdg", "services": ["mail", "calendar", "contacts"],
            "access": {"calendar": "write"}, "fields": {"username": "a@gwdg.de", "password": "geheim-42"}}
    assert [creds.access(cred, s) for s in ("mail", "calendar", "contacts")] == ["read", "write", "read"]
    assert creds.access(dict(cred, services=["mail"]), "calendar") == ""
    assert creds.access({"type": "imap", "fields": {}}, "mail") == "write"  # gewöhnlicher IMAP-Zugang wie bisher
    legacy = {"type": "webdav", "fields": {"url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/"}}
    assert creds.access(legacy, "calendar") == "read"
    store = {"k": cred}
    # das Passwort gibt es über keinen Platzhalter – sonst ließe sich „nur lesen“ in Werkbank oder HTTP umgehen
    with pytest.raises(PermissionError):
        creds.resolve_placeholders("curl -u a:{{cred:Uni:password}} https://davmail.gwdg.de:1080/", store)
    assert creds.resolve_placeholders("{{cred:Uni:username}}", store) == "a@gwdg.de"


def test_gwdg_dav_write_needs_write_access():
    import asyncio
    import types

    D = _pkg("tools.dav")
    sent = []

    class Resp:
        status, headers = 201, {}
        content = types.SimpleNamespace(iter_chunked=lambda n: _agen())

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    async def _agen():
        yield b""

    class Session:
        def request(self, method, url, **kw):
            sent.append((method, url))
            return Resp()

    cred = {"id": "k", "name": "Uni", "type": "gwdg", "services": ["calendar", "contacts"],
            "access": {"calendar": "read", "contacts": "write"},
            "fields": {"username": "a@gwdg.de", "password": "pw",
                       "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/"}}
    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=Session())
    run = lambda a: asyncio.run(D.dav_request(ctx, a))  # noqa: E731
    assert run({"zugang": "Uni", "methode": "REPORT", "pfad": "calendar/"})["status"] == 201
    for m in ("PUT", "DELETE", "PROPPATCH", "MOVE", "POST"):
        assert "nur lesen" in run({"zugang": "Uni", "methode": m, "pfad": "calendar/x.ics"}), m
    assert run({"zugang": "Uni", "methode": "PUT", "pfad": "contacts/x.vcf", "inhalt": "BEGIN:VCARD"})["status"] == 201
    # MOVE aus den Kontakten (schreibbar) in den Kalender (nur lesen): das Ziel zählt mit
    assert "nur lesen" in run({"zugang": "Uni", "methode": "MOVE", "pfad": "contacts/x.vcf",
                                "header": {"Destination": "/users/a@gwdg.de/calendar/x.vcf"}})
    assert "nur lesen" in run({"zugang": "Uni", "methode": "COPY", "pfad": "contacts/x.vcf",
                                "header": {"Destination": "calendar/x.vcf"}})
    assert [m for m, _ in sent] == ["REPORT", "PUT"]


def test_gwdg_no_free_http_request():
    import asyncio
    import types

    H = _pkg("tools.http")
    cred = {"id": "k", "name": "Uni", "type": "gwdg", "services": ["calendar"], "access": {"calendar": "write"},
            "fields": {"username": "a@gwdg.de", "password": "pw"}}
    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=None, external=False)
    import importlib
    W = importlib.import_module("lmpkg.tools.web")
    W.blocked_url = lambda ctx, url: None
    out = asyncio.run(H.http_request(ctx, {"methode": "DELETE", "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/x.ics",
                                           "zugang": "Uni"}))
    assert out.startswith("Fehler: Das Passwort eines Exchange-Zugangs")


def test_imap_check_names_the_stage(monkeypatch):
    """Die Pruefung sagt, WO es haengt: DNS, Port oder Anmeldung – nicht nur „TimeoutError“."""
    import asyncio
    import socket

    K = _pkg("credcheck")
    cred = {"type": "imap", "fields": {"imap_host": "email.gwdg.de:993", "username": "a@gwdg.de", "password": "pw"}}

    # DNS scheitert
    async def kein_dns(host, port):
        raise socket.gaierror(-2, "Name or service not known")

    monkeypatch.setattr(K, "_dns", kein_dns)
    r = asyncio.run(K._check_imap(cred))
    assert not r["ok"] and "DNS" in r["message"] and "nicht aufloesen" in r["message"]

    # DNS geht, Port antwortet nicht
    async def dns_ok(host, port):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port))]

    async def kein_tcp(*a, **kw):
        raise asyncio.TimeoutError

    monkeypatch.setattr(K, "_dns", dns_ok)
    monkeypatch.setattr(K.asyncio, "open_connection", kein_tcp)
    r = asyncio.run(K._check_imap(cred))
    assert not r["ok"] and "Port 993 antwortet nicht" in r["message"] and "Firewall" in r["message"]


def test_imap_falls_back_to_starttls(monkeypatch):
    """Ist 993 gesperrt, wird 143 mit STARTTLS versucht – und die Meldung nennt den Weg."""
    import asyncio
    import socket

    K = _pkg("credcheck")
    cred = {"type": "imap", "fields": {"imap_host": "email.gwdg.de:993", "username": "a@gwdg.de", "password": "pw"}}
    gesehen = []

    async def dns_ok(host, port):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port))]

    class Leser:
        def __init__(self):
            self.zeilen = [b"* OK Exchange IMAP4 ready\r\n", b"s1 OK Begin TLS\r\n", b"a1 OK LOGIN completed\r\n"]

        async def readline(self):
            return self.zeilen.pop(0)

    class Schreiber:
        def write(self, data):
            gesehen.append(data)

        async def drain(self):
            pass

        async def start_tls(self, ctx, server_hostname=None):
            gesehen.append(b"<tls>")

        def close(self):
            pass

        async def wait_closed(self):
            pass

    async def verbinden(host, port, ssl=None, server_hostname=None):
        gesehen.append((port, bool(ssl)))
        if ssl:  # 993 ist gesperrt
            raise asyncio.TimeoutError
        return Leser(), Schreiber()

    monkeypatch.setattr(K, "_dns", dns_ok)
    monkeypatch.setattr(K.asyncio, "open_connection", verbinden)
    r = asyncio.run(K._check_imap(cred))
    assert r["ok"], r["message"]
    assert "STARTTLS auf Port 143" in r["message"]
    assert (993, True) in gesehen and (143, False) in gesehen and b"<tls>" in gesehen


# ---------------------------------------------------------------- Benachrichtigungen auf der Startseite
def test_inbox_mode_and_device():
    assert inbox.clean_mode(None) == "auto"
    assert inbox.clean_mode("quatsch") == "auto"
    # automatisch: nur ohne Push-Gerät
    assert inbox.enabled({}, has_device=False) is True
    assert inbox.enabled({}, has_device=True) is False
    assert inbox.enabled({"inbox_mode": "on"}, has_device=True) is True
    assert inbox.enabled({"inbox_mode": "off"}, has_device=False) is False


def test_inbox_minutes():
    assert inbox.clean_minutes(None) == inbox.DEFAULT_MINUTES
    assert inbox.clean_minutes(0) == 0
    assert inbox.minutes({}) == inbox.DEFAULT_MINUTES
    assert inbox.minutes({"inbox_minutes": 0}) == 0
    assert inbox.minutes({"inbox_minutes": "kaputt"}) == inbox.DEFAULT_MINUTES
    with pytest.raises(ValueError):
        inbox.clean_minutes(-1)
    with pytest.raises(ValueError):
        inbox.clean_minutes(inbox.MAX_MINUTES + 1)


def test_inbox_add_replaces_same_text_and_keeps_order():
    items = inbox.add([], {"id": "a", "chat_id": "c1", "text": "3 neue Mails"}, 100.0)
    items = inbox.add(items, {"id": "b", "chat_id": "c2", "text": "Fertig"}, 101.0)
    assert [e["id"] for e in items] == ["b", "a"]
    # derselbe Chat mit demselben Text ersetzt die alte Karte, statt sie zu verdoppeln
    items = inbox.add(items, {"id": "c", "chat_id": "c1", "text": "3 neue Mails"}, 102.0)
    assert [e["id"] for e in items] == ["c", "b"]
    assert len(inbox.add(items, {"id": "d", "chat_id": "c3", "text": "x"}, 103.0, keep=2)) == 2


def test_inbox_prune_and_mute():
    now = 1_000_000.0
    items = [{"id": "alt", "chat_id": "c1", "at": now - 3600}, {"id": "neu", "chat_id": "c2", "at": now - 60}]
    assert [e["id"] for e in inbox.prune(items, now, 30)] == ["neu"]          # 30 Minuten Anzeigedauer
    assert [e["id"] for e in inbox.prune(items, now, 0)] == ["alt", "neu"]    # 0 = bleibt stehen
    assert [e["id"] for e in inbox.prune(items, now, 0, max_age_days=0)] == []  # Höchstfrist greift trotzdem
    assert inbox.muted({}) == []
    assert inbox.mute(["c1"], "c2") == ["c1", "c2"]
    assert inbox.mute(["c1", "c2"], "c1", False) == ["c2"]
    assert inbox.drop_chat(items, "c1") == [items[1]]


# ---------------------------------------------------------------- WebSocket-Schemata
def test_ws_schemas_do_not_use_protocol_fields():
    """Kein Befehl darf ein Feld „id“ oder „type“ im Schema führen.

    Home Assistant validiert die ganze Nachricht gegen das Schema – und setzt vorher „id“ auf die Befehlsnummer
    (int) und „type“ auf den Befehlsnamen. Ein eigenes Feld „id: str“ scheitert deshalb immer, und das Frontend
    sieht nur „expected str for dictionary value @ data['id']“. Genau daran ist das Wegwischen einer
    Benachrichtigung gescheitert (die Karte kam beim nächsten Laden zurück).
    """
    import ast

    src = (BASE / "ws.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    # Der Helfer _t() setzt „type“ bewusst (das ist der Befehlsname) – alles andere ist ein Fehler.
    helper = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "_t")
    inside = {id(n) for n in ast.walk(helper)}
    offenders = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict) or id(node) in inside:
            continue
        for key in node.keys:
            # Muster: vol.Optional("id") / vol.Required("type")
            if (isinstance(key, ast.Call) and isinstance(key.func, ast.Attribute)
                    and key.func.attr in ("Optional", "Required") and key.args
                    and isinstance(key.args[0], ast.Constant) and key.args[0].value in ("id", "type")):
                offenders.append((key.args[0].value, node.lineno))
    assert not offenders, f"Protokollfelder im Schema: {offenders}"


# ---------------------------------------------------------------- Exchange (EWS)
ews = load("ews")


def test_ews_window_and_times():
    start, end = ews.window("2026-11-20", "2026-11-27")
    assert start == "2026-11-20T00:00:00Z" and end == "2026-11-27T00:00:00Z"
    # ohne bis: 14 Tage; ohne von: heute
    s2, e2 = ews.window(None, None)
    assert s2.endswith("Z") and e2 > s2
    # Zeit mit Offset wird nach UTC gerechnet, Ortszeit ohne Offset bleibt Ortszeit
    assert ews.iso("2026-11-20T14:00:00+01:00") == "2026-11-20T13:00:00Z"
    assert ews.iso("2026-11-20T14:00:00") == "2026-11-20T13:00:00Z"  # Europe/Berlin im Winter = +01:00
    # verdrehter Zeitraum wird zu einem Tag
    s3, e3 = ews.window("2026-11-27", "2026-11-20")
    assert e3 == "2026-11-28T00:00:00Z"


def test_ews_find_calendar_escapes_and_limits():
    body = ews.find_calendar("2026-11-20", "2026-11-21", max_entries=5000)
    assert 'StartDate="2026-11-20T00:00:00Z"' in body and 'EndDate="2026-11-21T00:00:00Z"' in body
    assert f'MaxEntriesReturned="{ews.MAX_ENTRIES}"' in body  # Obergrenze greift
    assert 'DistinguishedFolderId Id="calendar"' in body
    assert "calendar:RequiredAttendees" in body
    assert '<t:DistinguishedFolderId Id="a&quot;b"/>' in ews.find_calendar(None, None, folder='a"b')


def test_ews_create_and_update_appointment():
    body = ews.create_appointment("Termin & Probe", "2026-11-20T14:00:00+0100", "2026-11-20T15:00:00+0100",
                                  body="Text <b>", location="Raum 1", required=["a@example.org"],
                                  optional=["b@example.org"], categories=["GWDG"])
    assert "<t:Subject>Termin &amp; Probe</t:Subject>" in body
    assert "<t:Body BodyType=\"Text\">Text &lt;b&gt;</t:Body>" in body
    assert "<t:Location>Raum 1</t:Location>" in body
    assert "<t:EmailAddress>a@example.org</t:EmailAddress>" in body
    assert "<t:OptionalAttendees>" in body and "<t:String>GWDG</t:String>" in body
    assert 'SendMeetingInvitations="SendToNone"' in body
    upd = ews.update_appointment("AAMk=", "CK1", {"betreff": "Neu", "start": "2026-11-20T16:00:00+0100"})
    assert 'ItemId Id="AAMk=" ChangeKey="CK1"' in upd
    assert '<t:FieldURI FieldURI="item:Subject"/>' in upd and "<t:Subject>Neu</t:Subject>" in upd
    assert upd.count("<t:SetItemField>") == 2
    with pytest.raises(ValueError):
        ews.update_appointment("AAMk=", "", {"unbekannt": "x"})


def test_ews_delete_and_folder():
    body = ews.delete_item("AAMk=", "CK1")
    assert 'DeleteType="MoveToDeletedItems"' in body and 'ItemId Id="AAMk=" ChangeKey="CK1"' in body
    assert 'DistinguishedFolderId Id="contacts"' in ews.get_folder("contacts")


def test_ews_parse_calendar_items():
    xml = """<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body>
      <m:FindItemResponse><m:ResponseMessages><m:FindItemResponseMessage ResponseClass="Success">
      <m:ResponseCode>NoError</m:ResponseCode><m:RootFolder TotalItemsInView="1"><m:Items>
      <t:CalendarItem><t:ItemId Id="AAMk=" ChangeKey="CK1"/><t:Subject>Jour fixe</t:Subject>
      <t:Start>2026-11-20T13:00:00Z</t:Start><t:End>2026-11-20T14:00:00Z</t:End>
      <t:Location>Videokonferenz</t:Location><t:IsAllDayEvent>false</t:IsAllDayEvent>
      <t:Organizer><t:Mailbox><t:Name>Niko</t:Name><t:EmailAddress>niko@gwdg.de</t:EmailAddress></t:Mailbox></t:Organizer>
      <t:RequiredAttendees><t:Attendee><t:Mailbox><t:EmailAddress>a@example.org</t:EmailAddress></t:Mailbox>
      <t:ResponseType>Accept</t:ResponseType></t:Attendee></t:RequiredAttendees>
      <t:Categories><t:String>GWDG</t:String></t:Categories>
      </t:CalendarItem></m:Items></m:RootFolder></m:FindItemResponseMessage></m:ResponseMessages></m:FindItemResponse>
      </s:Body></s:Envelope>"""
    out = ews.parse(xml)
    assert out["ok"] and out["total"] == 1
    ev = out["items"][0]
    assert ev["betreff"] == "Jour fixe" and ev["item_id"] == "AAMk=" and ev["change_key"] == "CK1"
    assert ev["start"] == "2026-11-20T13:00:00Z" and ev["ort"] == "Videokonferenz"
    assert ev["organisator"]["email"] == "niko@gwdg.de"
    assert ev["teilnehmer"][0]["email"] == "a@example.org" and ev["teilnehmer"][0]["art"] == "Accept"
    assert ev["kategorien"] == ["GWDG"]


def test_ews_parse_errors_and_contacts():
    denied = """<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body><m:GetFolderResponse>
      <m:ResponseMessages><m:GetFolderResponseMessage ResponseClass="Error">
      <m:ResponseCode>ErrorAccessDenied</m:ResponseCode><m:MessageText>Access is denied.</m:MessageText>
      </m:GetFolderResponseMessage></m:ResponseMessages></m:GetFolderResponse></s:Body></s:Envelope>"""
    out = ews.parse(denied)
    assert not out["ok"] and out["code"] == "ErrorAccessDenied"
    assert "Access is denied" in ews.describe_error(out)
    fault = ('<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault>'
             '<faultcode>s:Client</faultcode><faultstring>Wrong server version</faultstring></s:Fault></s:Body></s:Envelope>')
    out = ews.parse(fault)
    assert not out["ok"] and out["code"] == "s:Client" and "Wrong server version" in out["message"]
    assert not ews.parse("kein xml")["ok"]
    contact = """<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body><m:FindItemResponse>
      <m:ResponseMessages><m:FindItemResponseMessage ResponseClass="Success"><m:ResponseCode>NoError</m:ResponseCode>
      <m:RootFolder><m:Items><t:Contact><t:ItemId Id="C1" ChangeKey="K"/><t:DisplayName>Doro Kopp</t:DisplayName>
      <t:GivenName>Dorothea</t:GivenName><t:Surname>Kopp</t:Surname><t:CompanyName>Hof Betzendorf</t:CompanyName>
      <t:EmailAddresses><t:Entry Key="EmailAddress1">doro@example.org</t:Entry></t:EmailAddresses>
      </t:Contact></m:Items></m:RootFolder></m:FindItemResponseMessage></m:ResponseMessages></m:FindItemResponse>
      </s:Body></s:Envelope>"""
    c = ews.parse(contact)["items"][0]
    assert c["name"] == "Doro Kopp" and c["firma"] == "Hof Betzendorf"
    assert c["adressen"] == [{"art": "EmailAddress1", "adresse": "doro@example.org"}]


def test_ews_item_ids_and_day():
    xml = ('<m:CreateItemResponse xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages" '
           'xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"><m:ResponseMessages>'
           '<m:CreateItemResponseMessage ResponseClass="Success"><m:ResponseCode>NoError</m:ResponseCode>'
           '<m:Items><t:CalendarItem><t:ItemId Id="NEU=" ChangeKey="CK9"/></t:CalendarItem></m:Items>'
           '</m:CreateItemResponseMessage></m:ResponseMessages></m:CreateItemResponse>')
    assert ews.item_ids(xml) == [{"item_id": "NEU=", "change_key": "CK9"}]
    assert ews.day("2026-11-20T13:00:00Z") == "2026-11-20"
    assert ews.day("") == ""


def test_ews_credentials_types():
    """Neuer Typ ews und GWDG über EWS: Endpunkte, Rechte, Dienste."""
    gwdg = {"type": "gwdg", "fields": {"username": "niko@gwdg.de", "password": "x"}, "services": ["calendar", "contacts"]}
    assert creds.is_ews(gwdg)
    assert creds.ews_endpoint(gwdg) == creds.GWDG_EWS
    assert creds.ews_account(gwdg) == ("niko@gwdg.de", "x")
    assert creds.access(gwdg, "calendar") == "read" and creds.access(gwdg, "mail") == ""
    gwdg_write = dict(gwdg, access={"calendar": "write"})
    assert creds.access(gwdg_write, "calendar") == "write"
    # alter Zugang mit DavMail-Adresse bleibt bei DavMail
    old = {"type": "gwdg", "fields": {"username": "a@gwdg.de", "url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/"}}
    assert not creds.is_ews(old)
    # eigener Exchange
    ex = {"type": "ews", "fields": {"url": "https://mail.example.org/EWS/Exchange.asmx", "username": "u", "password": "p"}}
    assert creds.is_ews(ex) and creds.ews_endpoint(ex).endswith("Exchange.asmx")
    assert creds.services(ex) == ["mail", "calendar", "contacts"]
    assert creds.access(ex, "contacts") == "read"
    assert creds.access_text(ex) == {"E-Mail-Postfach": "nur lesen", "Kalender": "nur lesen", "Kontakte": "nur lesen"}
    # Felder: GWDG erzeugt den EWS-Endpunkt, der eigene Typ behält seine Adresse
    norm = creds.normalize_fields("gwdg", {"username": "Niko", "password": "p"}, ["calendar"])
    assert norm["username"] == "niko@gwdg.de" and norm["ews_url"] == creds.GWDG_EWS and "url" not in norm
    norm = creds.normalize_fields("gwdg", {"username": "niko@gwdg.de", "password": "p"}, ["mail"])
    assert norm["ews_url"] == creds.GWDG_EWS and "imap_host" not in norm  # Postfach über EWS
    norm = creds.normalize_fields("ews", {"url": "https://x/EWS/Exchange.asmx", "username": "u", "password": "p", "alt": ""})
    assert norm == {"url": "https://x/EWS/Exchange.asmx", "username": "u", "password": "p"}


# ---------------------------------------------------------------- dav_request: Status, speichern_als
def _dav_ctx(status=200, body=b"", etag=None, calls=None):
    import types

    class Resp:
        def __init__(self):
            self.status = status
            self.headers = {"ETag": etag} if etag else {}

            async def chunks(_n):
                yield body

            self.content = type("C", (), {"iter_chunked": staticmethod(chunks)})()

        async def read(self):
            return body

        async def text(self):
            return body.decode()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class Session:
        def request(self, method, url, **kw):
            if calls is not None:
                calls.append((method, url, kw.get("headers") or {}))
            return Resp()

    cred = {"id": "k", "name": "Cloud", "type": "webdav",
            "fields": {"url": "https://cloud.example.org", "username": "u", "password": "p"}}
    return types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=Session())


def test_dav_request_reports_http_status_instead_of_connection_error():
    import asyncio

    D = _pkg("tools.dav")
    # 404 ist kein Verbindungsfehler: der Status kommt zurück, dazu ein Klartext-Hinweis
    out = asyncio.run(D.dav_request(_dav_ctx(404, b"nicht da"), {"zugang": "Cloud", "methode": "GET", "pfad": "x.ics"}))
    assert out["status"] == 404 and "404" in out["fehler"] and "Pfad nicht gefunden" in out["fehler"]
    # 412 nennt das ETag als Grund
    out = asyncio.run(D.dav_request(_dav_ctx(412, b""), {"zugang": "Cloud", "methode": "PUT", "pfad": "x.ics"}))
    assert "ETag" in out["fehler"]
    # 200 ohne Fehler, ETag wird durchgereicht
    out = asyncio.run(D.dav_request(_dav_ctx(200, b"ok", etag='"abc"'), {"zugang": "Cloud", "methode": "GET", "pfad": "x"}))
    assert out == {"status": 200, "etag": '"abc"', "antwort": "ok"}
    assert D.http_hint(500) .startswith("HTTP 500: Serverfehler")
    assert D.http_hint(418, "Tee") == "HTTP 418: Tee"


def test_dav_request_speichern_als_writes_to_workspace():
    import asyncio
    import types

    D = _pkg("tools.dav")
    written = []

    class Store:
        async def async_write_file(self, kind, chat_id, name, data):
            written.append((kind, chat_id, name, data))
            return {"name": name, "bytes": len(data)}

    ctx = _dav_ctx(207, b"<multistatus/>" * 100)
    ctx.store = Store()
    ctx.chat_id = "c1"
    emitted = []

    async def emit():
        emitted.append(True)

    ctx.emit_files = emit
    out = asyncio.run(D.dav_request(ctx, {"zugang": "Cloud", "methode": "PROPFIND", "pfad": "calendars/u/",
                                          "speichern_als": "propfind.xml"}))
    assert written and written[0][2] == "propfind.xml" and written[0][3].startswith(b"<multistatus/>")
    assert out["status"] == 207 and out["gespeichert"]["name"] == "propfind.xml" and emitted == [True]
    assert "antwort" not in out  # nichts Großes in den Chat


# ---------------------------------------------------------------- Einträge über die UID
def test_caldav_entry_by_uid():
    import asyncio
    import types

    D = _pkg("tools.dav")
    calls = []
    ics = ("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc-1\r\nSUMMARY:Jour fixe\r\n"
           "DTSTART:20261120T130000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n")
    multistatus = ('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">'
                   '<d:response><d:href>/remote.php/dav/calendars/u/personal/abc-1.ics</d:href>'
                   '<d:propstat><d:prop><d:getetag>"e1"</d:getetag>'
                   f'<cal:calendar-data>{ics}</cal:calendar-data></d:prop></d:propstat></d:response></d:multistatus>')

    class Resp:
        def __init__(self, status=207, body=b"", headers=None):
            self.status, self._body, self.headers = status, body, headers or {}

            async def chunks(_n):
                yield body

            self.content = type("C", (), {"iter_chunked": staticmethod(chunks)})()

        async def read(self):
            return self._body

        async def text(self):
            return self._body.decode()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class Session:
        def request(self, method, url, **kw):
            calls.append((method, url, kw.get("headers") or {}, kw.get("data")))
            if method == "REPORT":
                return Resp(207, multistatus.encode())
            if method == "PUT":
                return Resp(204, b"", {"ETag": '"e2"'})
            return Resp(204)

        def put(self, url, **kw):
            calls.append(("PUT", url, kw.get("headers") or {}, kw.get("data")))
            return Resp(204, b"", {"ETag": '"e2"'})

        def delete(self, url, **kw):
            calls.append(("DELETE", url, kw.get("headers") or {}, None))
            return Resp(204)

        def get(self, url, **kw):  # Rückfall: ganzer Kalender, hier ohne den gesuchten Eintrag
            calls.append(("GET", url, kw.get("headers") or {}, None))
            return Resp(200, ics.encode())

    cred = {"id": "k", "name": "Cloud", "type": "webdav",
            "fields": {"url": "https://cloud.example.org", "username": "u", "password": "p"}}
    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=Session())
    run = lambda a: asyncio.run(D.caldav_entry(ctx, a))  # noqa: E731
    out = run({"zugang": "Cloud", "uid": "abc-1"})
    assert out["gefunden"] and out["href"].endswith("abc-1.ics") and out["etag"] == "e1"
    assert out["termin"]["summary"] == "Jour fixe"
    # ändern: If-Match auf das gefundene ETag, damit nichts Fremdes überschrieben wird
    calls.clear()
    out = run({"zugang": "Cloud", "uid": "abc-1", "aktion": "aendern", "inhalt": ics.replace("Jour fixe", "Neu")})
    assert out["ok"] and out["etag"] == "e2"
    put = [c for c in calls if c[0] == "PUT"][0]
    assert put[2]["If-Match"] == '"e1"' and b"Neu" in put[3]
    # Inhalt ohne die UID wird abgelehnt (sonst entstünde ein zweiter Eintrag)
    assert "UID" in run({"zugang": "Cloud", "uid": "abc-1", "aktion": "aendern", "inhalt": "BEGIN:VCALENDAR"})
    # löschen
    calls.clear()
    out = run({"zugang": "Cloud", "uid": "abc-1", "aktion": "loeschen"})
    assert out["ok"] and [c for c in calls if c[0] == "DELETE"][0][2]["If-Match"] == '"e1"'
    # unbekannte UID
    assert "Kein Eintrag" in run({"zugang": "Cloud", "uid": "gibt-es-nicht"})


def test_caldav_entry_falls_back_to_whole_calendar():
    """Server ohne UID-Abfrage (DavMail): der Kalender wird einmal geholt und lokal durchsucht."""
    import asyncio
    import types

    D = _pkg("tools.dav")
    ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc-1\r\nSUMMARY:Jour fixe\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"

    class Resp:
        def __init__(self, status, body=b""):
            self.status, self._body, self.headers = status, body, {}

            async def chunks(_n):
                yield body

            self.content = type("C", (), {"iter_chunked": staticmethod(chunks)})()

        async def read(self):
            return self._body

        async def text(self):
            return self._body.decode()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class Session:
        def request(self, method, url, **kw):
            return Resp(405)  # kann keine UID-Abfrage

        def get(self, url, **kw):
            return Resp(200, ics.encode())

    cred = {"id": "k", "name": "Uni", "type": "webdav",
            "fields": {"url": "https://davmail.gwdg.de:1080/users/a@gwdg.de/calendar/", "password": "p"}}
    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=Session())
    out = asyncio.run(D.caldav_entry(ctx, {"zugang": "Uni", "uid": "abc-1"}))
    assert out["gefunden"] and out["href"].endswith("abc-1.ics") and "UID-Abfrage" in out["hinweis"]


def test_caldav_changes_sync_and_ctag():
    import asyncio
    import types

    D = _pkg("tools.dav")
    sync = ('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">'
            '<d:response><d:href>/remote.php/dav/calendars/u/personal/a.ics</d:href>'
            '<d:propstat><d:prop><d:getetag>"1"</d:getetag></d:prop></d:propstat></d:response>'
            '<d:response><d:href>/remote.php/dav/calendars/u/personal/b.ics</d:href>'
            '<d:status>HTTP/1.1 404 Not Found</d:status></d:response>'
            '<d:sync-token>http://example.org/token/2</d:sync-token></d:multistatus>')
    ctag = ('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">'
            '<d:response><d:propstat><d:prop><cs:getctag>ctag-7</cs:getctag></d:prop></d:propstat></d:response>'
            '</d:multistatus>')

    class Resp:
        def __init__(self, status, body=b""):
            self.status, self._body, self.headers = status, body, {}

            async def chunks(_n):
                yield body

            self.content = type("C", (), {"iter_chunked": staticmethod(chunks)})()

        async def read(self):
            return self._body

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class Session:
        def __init__(self, sync_status):
            self.sync_status = sync_status

        def request(self, method, url, **kw):
            if method == "REPORT":
                return Resp(self.sync_status, sync.encode() if self.sync_status < 400 else b"")
            return Resp(207, ctag.encode())

    cred = {"id": "k", "name": "Cloud", "type": "webdav",
            "fields": {"url": "https://cloud.example.org", "username": "u", "password": "p"}}
    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, session=Session(207))
    out = asyncio.run(D.caldav_changes(ctx, {"zugang": "Cloud"}))
    assert out["verfahren"] == "sync-collection" and out["sync_token"].endswith("/token/2")
    assert [e["href"].rsplit("/", 1)[-1] for e in out["geaendert"]] == ["a.ics"]
    assert [h.rsplit("/", 1)[-1] for h in out["geloescht"]] == ["b.ics"]
    # Server ohne sync-collection: ctag als Rückfall
    ctx.session = Session(405)
    out = asyncio.run(D.caldav_changes(ctx, {"zugang": "Cloud"}))
    assert out["verfahren"] == "ctag" and out["ctag"] == "ctag-7"


# ---------------------------------------------------------------- skill_load
def test_skill_load_is_never_truncated_and_can_pick_a_section():
    import asyncio
    import types

    ST = _pkg("skilltext")
    body = "# Anleitung\n\n" + ("Zeile mit Inhalt\n" * 4000) + "\n## Adressen\nServer: files.example.org\n\n## Anderes\nx\n"
    # der Abschnitt wird gezielt ausgeschnitten …
    part = ST.section(body, "Adressen")
    assert part.startswith("## Adressen") and "files.example.org" in part and "## Anderes" not in part
    assert ST.section(body, "## adressen") == part  # Schreibweise und Rauten egal
    # … und wenn es ihn nicht gibt, kommt die vollständige Anleitung (lieber zu viel als nichts)
    assert ST.section(body, "gibt es nicht") == body
    assert ST.section(body, "") == body
    # Unterabschnitte bleiben beim Abschnitt
    deep = "# A\n## B\n### C\ntief\n## D\nnachbar\n"
    assert ST.section(deep, "B") == "## B\n### C\ntief"
    # das Werkzeug ist von der Kürzung ausgenommen (Anleitungen sind Arbeitsanweisungen, keine Vorschau) –
    # misc.py selbst braucht Home Assistant, deshalb steht die Registrierung hier als Quelltext-Prüfung
    src = (BASE / "tools" / "misc.py").read_text()
    assert 'label="Skill laden", icon="mdi:school-outline", max_chars=0' in src
    assert '"bereich": {"type": "string"' in src
    # die neuen DAV-Werkzeuge sind da und als schreibend markiert, wo sie schreiben
    import lmpkg.tools as T

    assert T.REGISTRY["caldav_entry"].is_write({"aktion": "loeschen"})
    assert not T.REGISTRY["caldav_entry"].is_write({"aktion": "suchen"})
    assert not T.REGISTRY["caldav_changes"].is_write({})
    assert T.REGISTRY["dav_request"].is_write({"methode": "PUT"})
    assert not T.REGISTRY["dav_request"].is_write({"methode": "PROPFIND"})
    # Exchange-Werkzeuge: lesen frei, schreiben nur mit Freigabe
    assert not T.REGISTRY["ews_events"].is_write({}) and not T.REGISTRY["ews_contacts"].is_write({})
    assert T.REGISTRY["ews_save"].is_write({"aktion": "anlegen"})
    assert T.REGISTRY["ews_events"].group == "ews" and T.GROUPS["ews"]["label"] == "Exchange (EWS)"


# ---------------------------------------------------------------- Postfach über EWS
def test_ews_mail_requests_are_well_formed():
    """Die SOAP-Anfragen fürs Postfach: Ordner, Suche, Inhalt, Senden, Zustand, Verschieben, Löschen."""
    E = _pkg("ews")
    # Ordnernamen: bekannte Namen werden zu DistinguishedFolderId, alles andere ist eine FolderId
    assert 'Id="inbox"' in E.folder_ref("INBOX") and 'Id="inbox"' in E.folder_ref("Posteingang")
    assert 'Id="sentitems"' in E.folder_ref("Gesendete Elemente") and 'Id="deleteditems"' in E.folder_ref("Papierkorb")
    assert '<t:FolderId Id="AAMkAD' in E.folder_ref("AAMkADxyz")
    # Suche: der Server filtert (Betreff, Zeitraum, ungelesen) und sortiert nach Eingang
    body = E.find_messages("inbox", "Rechnung", "2026-11-01", "2026-11-13", True, 5)
    assert 'ContainmentMode="Substring"' in body and "Rechnung" in body
    assert "item:DateTimeReceived" in body and 'Value="false"' in body
    assert 'Order="Descending"' in body and 'MaxEntriesReturned="5"' in body
    assert "<t:And>" in body  # mehrere Bedingungen werden verknüpft
    assert "Restriction" not in E.find_messages("inbox")  # ohne Filter keine Bedingung
    # Inhalt: MIME (base64) – derselbe Parser wie bei IMAP
    assert "<t:IncludeMimeContent>true</t:IncludeMimeContent>" in E.get_mime("ID1", "CK1")
    assert 'ChangeKey="CK1"' in E.get_mime("ID1", "CK1")
    # Senden: fertige MIME-Nachricht, Kopie in „Gesendete Elemente“
    send = E.create_message_mime("QUJD")
    assert 'MessageDisposition="SendAndSaveCopy"' in send and ">QUJD<" in send
    # Zustand und Verschieben
    assert "<t:IsRead>true</t:IsRead>" in E.update_message("ID1", gelesen=True)
    assert "Flagged" in E.update_message("ID1", markiert=True)
    with pytest.raises(ValueError):
        E.update_message("ID1")
    assert '<t:FolderId Id="AAMkZiel"' in E.move_items(["ID1", "ID2"], "AAMkZiel")
    assert 'DeleteType="MoveToDeletedItems"' in E.delete_messages(["ID1"])  # Papierkorb, nicht endgültig


def test_ews_mail_parsing():
    """Antworten auswerten: Ordner mit Zählern, Nachrichten mit Absender, Datum und Zustand, MIME-Inhalt."""
    import base64

    E = _pkg("ews")
    folders = """<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body>
      <m:FindFolderResponse><m:ResponseMessages><m:FindFolderResponseMessage ResponseClass="Success">
      <m:ResponseCode>NoError</m:ResponseCode><m:RootFolder>
      <t:Folders><t:Folder><t:FolderId Id="F1"/><t:DisplayName>Posteingang</t:DisplayName>
      <t:TotalCount>42</t:TotalCount><t:UnreadCount>3</t:UnreadCount></t:Folder>
      <t:Folder><t:FolderId Id="F2"/><t:DisplayName>Gesendete Elemente</t:DisplayName>
      <t:TotalCount>7</t:TotalCount><t:UnreadCount>0</t:UnreadCount></t:Folder>
      </t:Folders></m:RootFolder></m:FindFolderResponseMessage></m:ResponseMessages></m:FindFolderResponse>
      </s:Body></s:Envelope>"""
    got = E.parse_folders(folders)
    assert [f["name"] for f in got] == ["Posteingang", "Gesendete Elemente"]
    assert got[0]["id"] == "F1" and got[0]["anzahl"] == 42 and got[0]["ungelesen"] == 3

    msgs = """<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
      xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><s:Body>
      <m:FindItemResponse><m:ResponseMessages><m:FindItemResponseMessage ResponseClass="Success">
      <m:RootFolder><t:Items>
      <t:Message><t:ItemId Id="M1" ChangeKey="C1"/><t:Subject>Rechnung 4711</t:Subject>
      <t:DateTimeReceived>2026-11-13T09:15:00Z</t:DateTimeReceived><t:IsRead>false</t:IsRead>
      <t:HasAttachments>true</t:HasAttachments><t:Size>2048</t:Size>
      <t:From><t:Mailbox><t:Name>Buchhaltung</t:Name><t:EmailAddress>buch@example.org</t:EmailAddress></t:Mailbox></t:From>
      <t:ToRecipients><t:Mailbox><t:EmailAddress>niko@gwdg.de</t:EmailAddress></t:Mailbox></t:ToRecipients>
      <t:Flag><t:FlagStatus>Flagged</t:FlagStatus></t:Flag></t:Message>
      <t:Message><t:ItemId Id="M2" ChangeKey="C2"/><t:Subject>Termin</t:Subject>
      <t:DateTimeReceived>2026-11-12T08:00:00Z</t:DateTimeReceived><t:IsRead>true</t:IsRead>
      <t:HasAttachments>false</t:HasAttachments></t:Message>
      </t:Items></m:RootFolder></m:FindItemResponseMessage></m:ResponseMessages></m:FindItemResponse>
      </s:Body></s:Envelope>"""
    rows = E.parse_messages(msgs)
    assert [r["uid"] for r in rows] == ["M1", "M2"]  # ItemId ist die Kennung
    first = rows[0]
    assert first["betreff"] == "Rechnung 4711" and first["von"] == "buch@example.org"
    assert first["von_name"] == "Buchhaltung" and first["an"] == ["niko@gwdg.de"]
    assert first["ungelesen"] is True and first["anhaenge"] is True and first["markiert"] is True
    assert first["groesse"] == 2048 and first["change_key"] == "C1"
    assert first["datum"].startswith("2026-11-13T10:15")  # UTC → Europe/Berlin
    assert rows[1]["ungelesen"] is False and "markiert" not in rows[1]

    raw = b"Subject: Test\r\n\r\nHallo"
    xml = ('<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
           'xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"><s:Body><m:GetItemResponse '
           'xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"><m:ResponseMessages>'
           '<m:GetItemResponseMessage><m:Items><t:Message><t:MimeContent CharacterSet="UTF-8">'
           + base64.b64encode(raw).decode() + "</t:MimeContent></t:Message></m:Items>"
           "</m:GetItemResponseMessage></m:ResponseMessages></m:GetItemResponse></s:Body></s:Envelope>")
    assert E.mime_content(xml) == raw
    assert E.mime_content("<x/>") == b""


def test_mail_tools_use_ews_for_exchange():
    """Ein Exchange-Zugang läuft ohne IMAP/SMTP: die Werkzeuge gehen über EWS, das Recht gilt weiter."""
    import asyncio
    import types

    M = _pkg("tools.mail")
    EW = _pkg("tools.mail_ews")
    calls = []

    async def fake_folders(ctx, cred):
        calls.append(("folders", cred["name"]))
        return {"ordner": [{"name": "Posteingang", "anzahl": 3, "ungelesen": 1}]}

    async def fake_list(ctx, cred, a):
        calls.append(("list", a.get("ordner")))
        return {"ordner": "inbox", "treffer": 1, "gezeigt": 1,
                "nachrichten": [{"uid": "AAMkAD1", "betreff": "Hi", "ungelesen": True}]}

    async def fake_change(ctx, cred, a, uids):
        calls.append(("change", a.get("aktion"), tuple(uids)))
        return {"ok": True, "aktion": a.get("aktion"), "uids": uids}

    async def fake_send(ctx, cred, a, files, reply):
        calls.append(("send", a.get("an")))
        return {"ok": True, "an": a.get("an")}

    for name, fn in (("folders", fake_folders), ("list_messages", fake_list),
                     ("change_messages", fake_change), ("send_message", fake_send)):
        setattr(EW, name, fn)

    cred = {"id": "k", "name": "GWDG", "type": "gwdg", "services": ["mail"], "access": {"mail": "write"},
            "fields": {"username": "a@gwdg.de", "password": "pw", "ews_url": "https://email.gwdg.de/EWS/Exchange.asmx"}}
    store = types.SimpleNamespace(async_read_file=lambda *a: b"", async_write_file=lambda *a: {"name": "x"})

    async def emit():
        return None

    ctx = types.SimpleNamespace(creds={"k": cred}, allowed_creds=None, store=store, chat_id="c", emit_files=emit)
    reg = _pkg("tools").REGISTRY
    run = lambda name, a: asyncio.run(reg[name].handler(ctx, a))  # noqa: E731

    assert run("mail_folders", {"zugang": "GWDG"})["ordner"][0]["name"] == "Posteingang"
    out = run("mail_list", {"zugang": "GWDG"})
    assert out["nachrichten"][0]["uid"] == "AAMkAD1" and out["recht"] == "lesen und schreiben"
    # Kennungen sind hier keine Zahlen – die Prüfung darf sie nicht abweisen
    assert run("mail_change", {"zugang": "GWDG", "uids": ["AAMkAD1"], "aktion": "gelesen"})["ok"] is True
    assert run("mail_send", {"zugang": "GWDG", "an": "x@y.de", "betreff": "b", "text": "t"})["ok"] is True
    assert calls == [("folders", "GWDG"), ("list", None), ("change", "gelesen", ("AAMkAD1",)), ("send", "x@y.de")]

    # nur lesen: senden und ändern wird abgelehnt, bevor eine Anfrage rausgeht
    cred["access"] = {"mail": "read"}
    before = len(calls)
    assert "nur lesen" in run("mail_send", {"zugang": "GWDG", "an": "x@y.de", "betreff": "b", "text": "t"})
    assert "nur lesen" in run("mail_change", {"zugang": "GWDG", "uids": ["AAMkAD1"], "aktion": "loeschen"})
    assert len(calls) == before


# ---------------------------------------------------------------- NTLM (GWDG-Exchange)
def test_ntlm_matches_the_specification():
    """MD4, NT-Hash und NTLMv2-Beweis gegen die Testvektoren aus MS-NLMP – ohne Fremdbibliothek."""
    import struct

    N = _pkg("ntlm")
    # MD4 (RFC 1320)
    assert N.md4(b"").hex() == "31d6cfe0d16ae931b73c59d7e0c089c0"
    assert N.md4(b"abc").hex() == "a448017aaf21d8525fc10ae87aa6729d"
    assert N.md4(b"message digest").hex() == "d9130a8164549fe818874806e1c7014b"
    # NT-Hash und NTLMv2-Hash (MS-NLMP 4.2.2 / 4.2.4)
    assert N.ntlm_hash("Password").hex() == "a4f49c406510bdcab6824ee7c30fd852"
    assert N.ntlmv2_hash("User", "Domain", "Password").hex() == "0c868a403bfd7a93a3001ef22ef02e3f"
    # NTProofStr (MS-NLMP 4.2.4.2.2): gleiche Eingaben, gleicher Beweis
    challenge = bytes.fromhex("0123456789abcdef")
    client = bytes.fromhex("aaaaaaaaaaaaaaaa")
    target_info = bytes.fromhex("02000c0044006f006d00610069006e0001000c0053006500720076006500720000000000")
    blob = (b"\x01\x01\x00\x00" + b"\x00\x00\x00\x00" + struct.pack("<Q", 0) + client + b"\x00\x00\x00\x00"
            + target_info + b"\x00\x00\x00\x00")
    import hashlib
    import hmac

    proof = hmac.new(N.ntlmv2_hash("User", "Domain", "Password"), challenge + blob, hashlib.md5).digest()
    assert proof.hex() == "68cd0ab851e51c96aabc927bebef6a1c"
    # Type 3 trägt genau diesen Beweis
    t3 = N.type3("User", "Password", "Domain", challenge, target_info, client_challenge=client,
                 timestamp=struct.pack("<Q", 0))
    assert t3.startswith(b"NTLMSSP\x00") and struct.unpack("<I", t3[8:12])[0] == 3
    nt_off = struct.unpack("<I", t3[24:28])[0]  # zweiter Puffer: Länge, Maximallänge, Offset
    assert t3[nt_off:nt_off + 16] == proof


def test_ntlm_handshake_messages():
    """Type 1 bietet NTLM an, Type 2 wird gelesen, der Benutzername darf die Domäne enthalten."""
    import struct

    N = _pkg("ntlm")
    t1 = N.type1("gwdg")
    assert t1.startswith(b"NTLMSSP\x00") and struct.unpack("<I", t1[8:12])[0] == 1
    flags = struct.unpack("<I", t1[12:16])[0]
    assert flags & N.NEGOTIATE_NTLM and flags & N.NEGOTIATE_UNICODE
    assert b"GWDG" in t1  # Domäne groß, wie im Protokoll üblich

    # Type 2 mit TargetInfo (wie der GWDG-Server: 210 Bytes, Unicode, NTLM2Key, TargetInfo)
    ti = bytes.fromhex("02000c0044006f006d00610069006e0000000000")
    t2 = (b"NTLMSSP\x00" + struct.pack("<I", 2) + struct.pack("<HHI", 0, 0, 48)
          + struct.pack("<I", 0xA2898205) + bytes.fromhex("1122334455667788") + b"\x00" * 8
          + struct.pack("<HHI", len(ti), len(ti), 48) + ti)
    info = N.parse_type2(t2)
    assert info["challenge"] == bytes.fromhex("1122334455667788")
    assert info["target_info"] == ti and info["flags"] == 0xA2898205
    with pytest.raises(ValueError):
        N.parse_type2(b"kein NTLM")

    assert N.split_user("gwdg\\nikolaj.kopp") == ("nikolaj.kopp", "gwdg")
    assert N.split_user("nikolaj.kopp", "gwdg") == ("nikolaj.kopp", "gwdg")
    assert N.split_user("DOMAIN\\user", "gwdg") == ("user", "DOMAIN")


def test_ews_domain_for_gwdg():
    """Der GWDG-Exchange nimmt nur NTLM: die Domäne ist gwdg, außer der Benutzername nennt eine."""
    creds = _pkg("credentials")
    assert creds.ews_domain({"type": "gwdg", "fields": {"username": "a@gwdg.de"}}) == "gwdg"
    assert creds.ews_domain({"type": "gwdg", "fields": {"username": "gwdg\\a"}}) == "gwdg"
    assert creds.ews_domain({"type": "ews", "fields": {"username": "FIRMA\\a",
                                                       "url": "https://mail.firma.de/EWS/Exchange.asmx"}}) == "FIRMA"
    assert creds.ews_domain({"type": "ews", "fields": {"username": "a@firma.de",
                                                       "url": "https://mail.firma.de/EWS/Exchange.asmx"}}) == ""


def test_ews_call_falls_back_to_ntlm(monkeypatch):
    """Antwortet der Server nur mit NTLM, wird derselbe Aufruf mit NTLMv2 wiederholt – nicht mit Basic aufgegeben."""
    import asyncio
    import base64
    import struct

    E = _pkg("ews")
    N = _pkg("ntlm")
    seen = []

    ti = bytes.fromhex("02000c0044006f006d00610069006e0000000000")
    t2 = (b"NTLMSSP\x00" + struct.pack("<I", 2) + struct.pack("<HHI", 0, 0, 48)
          + struct.pack("<I", 0xA2898205) + bytes.fromhex("1122334455667788") + b"\x00" * 8
          + struct.pack("<HHI", len(ti), len(ti), 48) + ti)

    class Headers(dict):
        """Wie die Kopfzeilen von aiohttp: ein Name, mehrere Werte."""

        def __init__(self, pairs):
            super().__init__()
            self._pairs = pairs

        def getall(self, key, default=None):
            return [v for k, v in self._pairs if k.lower() == key.lower()] or (default or [])

    async def fake_post(session, endpoint, payload, headers, auth, timeout):
        seen.append(headers.get("Authorization", "Basic" if auth else ""))
        if len(seen) == 1:  # Basic wird abgelehnt, der Server bietet nur NTLM an
            return 401, b"", Headers([("WWW-Authenticate", "Negotiate"), ("WWW-Authenticate", "NTLM")])
        if len(seen) == 2:  # Type 1 → Challenge
            return 401, b"", Headers([("WWW-Authenticate", "NTLM " + base64.b64encode(t2).decode())])
        return 200, b'<ok><ResponseCode>NoError</ResponseCode></ok>', Headers([])

    monkeypatch.setattr(E, "_post", fake_post)
    out = asyncio.run(E.call(None, "https://email.gwdg.de/EWS/Exchange.asmx", "a@gwdg.de", "pw", "<x/>",
                             domain="gwdg"))
    assert out["ok"] is True
    assert len(seen) == 3
    assert seen[1].startswith("NTLM ") and seen[2].startswith("NTLM ")
    # Type 3 trägt den Benutzernamen ohne Domäne und die Domäne getrennt
    t3 = base64.b64decode(seen[2][5:])
    assert struct.unpack("<I", t3[8:12])[0] == 3
    assert "a@gwdg.de".encode("utf-16-le") in t3 and "gwdg".encode("utf-16-le") in t3

    # ohne NTLM-Angebot bleibt es bei der klaren Meldung
    seen.clear()

    async def only_basic(session, endpoint, payload, headers, auth, timeout):
        seen.append(1)
        return 401, b"", Headers([("WWW-Authenticate", "Basic realm=x")])

    monkeypatch.setattr(E, "_post", only_basic)
    with pytest.raises(E.EwsError) as err:
        asyncio.run(E.call(None, "https://x/EWS/Exchange.asmx", "u", "p", "<x/>"))
    assert "abgelehnt" in str(err.value) and len(seen) == 1
