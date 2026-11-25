"""Agenten-Identitäten und Zugriffsprotokoll (audit.py): Zuordnung, Ziele ohne Inhalte, Ablage, Abfrage."""
from __future__ import annotations

import asyncio
import json
import time
from datetime import date, datetime

import pytest
from _lm import load

AU = load("audit")

SECRET_TEXT = "Kontostand-4711-vertraulich"

CREDS = {
    "k1": {"id": "k1", "name": "Wolke", "type": "dav", "fields": {"url": "https://cloud.example.org/remote.php/dav",
                                                                   "username": "niko", "password": "pw-geheim"}},
    "k2": {"id": "k2", "name": "Wetter-API", "type": "http", "fields": {"url": "https://api.wetter.example", "token": "t"}},
}


def find(name):
    return next((c for c in CREDS.values() if c["name"].casefold() == name.casefold()), None)


# ------------------------------------------------------------------ Identität

def test_agent_ids_are_stable_per_chat_and_per_task():
    chat = {"id": "c1", "kind": "chat", "title": f"Frage zu {SECRET_TEXT}"}
    assert AU.agent_id(chat) == "agt-c1"
    task = {"id": "t9", "name": "Morgenbericht"}
    run_chat = {"id": "c77", "kind": "task_run", "task_id": "t9"}
    assert AU.agent_id(run_chat, task) == "agt-t9"  # alle Läufe einer Aufgabe gehören zu ihr
    assert AU.agent_id({"id": "c78", "kind": "task_run"}, task) == "agt-t9"


@pytest.mark.parametrize("chat,task,kind", [
    ({"id": "c", "kind": "chat"}, None, "chat"),
    ({"id": "c", "kind": "cowork"}, None, "cowork"),
    ({"id": "c", "kind": "chat", "voice": True}, None, "voice"),
    ({"id": "c", "kind": "cowork", "parent_id": "p"}, None, "sub"),
    ({"id": "c", "kind": "task_run"}, {"id": "t"}, "task"),
    ({"id": "c", "kind": "task_run"}, {"id": "t", "origin": "dashboard"}, "tile"),
])
def test_agent_kinds(chat, task, kind):
    assert AU.agent_kind(chat, task) == kind


def test_agent_info_names_parent_and_project_but_never_the_chat_title():
    chat = {"id": "c2", "kind": "cowork", "parent_id": "c1", "project_id": "p1", "title": SECRET_TEXT}
    info = AU.agent_info("u1", chat, None, {"id": "p1", "name": "Steuer 2026"})
    assert info == {"id": "agt-c2", "kind": "sub", "owner": "u1", "project_id": "p1", "project": "Steuer 2026",
                    "parent": "agt-c1"}
    task_info = AU.agent_info("u1", {"id": "c3", "kind": "task_run"}, {"id": "t1", "name": "Post sortieren"})
    assert task_info["task"] == "Post sortieren" and task_info["kind"] == "task"
    assert SECRET_TEXT not in json.dumps(info)


# ------------------------------------------------------------------ Ziele ohne Inhalte

def test_url_target_drops_query_fragment_credentials_and_port():
    t = AU.url_target(f"https://user:pw@API.Example.org:8443/v1/konto?iban={SECRET_TEXT}#x")
    assert t == {"host": "api.example.org", "path": "/v1/konto"}
    assert AU.url_target("") == {} and AU.url_target("https://example.org/") == {"host": "example.org"}


def test_http_call_records_credentials_host_and_path_but_no_header_or_body():
    args = {"methode": "post", "url": f"https://api.wetter.example/v2/data?q={SECRET_TEXT}",
            "header": {"Authorization": "Bearer {{cred:Wetter-API:token}}", "X-Info": SECRET_TEXT},
            "inhalt": SECRET_TEXT}
    d = AU.describe_call("http_request", "http", args, find)
    assert d["creds"] == [{"id": "k2", "name": "Wetter-API", "type": "http"}]
    assert d["target"] == {"host": "api.wetter.example", "path": "/v2/data", "method": "POST"}
    assert SECRET_TEXT not in json.dumps(d)


def test_dav_call_takes_the_host_from_the_credential():
    d = AU.describe_call("dav_read", "dav", {"zugang": "wolke", "pfad": "/Team/Finanzen/plan.xlsx",
                                             "frage": SECRET_TEXT}, find)
    assert d["creds"][0]["id"] == "k1"
    assert d["target"] == {"host": "cloud.example.org", "path": "/Team/Finanzen/plan.xlsx"}
    assert SECRET_TEXT not in json.dumps(d) and "pw-geheim" not in json.dumps(d)


def test_unknown_credential_names_are_kept_as_names():
    d = AU.describe_call("mail_list", "mail", {"zugang": "Gibtsnicht", "suche": SECRET_TEXT}, find)
    assert d["creds"] == [{"id": None, "name": "Gibtsnicht", "type": ""}] and d["target"] == {}


def test_home_assistant_calls_record_service_and_entities_not_data():
    d = AU.describe_call("ha_service", "ha", {"domain": "light", "service": "turn_on",
                                              "ziel": {"entity_id": ["light.kueche", "kein Entity"]},
                                              "daten": {"message": SECRET_TEXT}}, find)
    assert d["target"] == {"service": "light.turn_on", "entities": ["light.kueche"]}
    d2 = AU.describe_call("ha_history", "ha", {"entity_id": "sensor.strom", "stunden": 5}, find)
    assert d2["target"] == {"entities": ["sensor.strom"]}


def test_mail_send_records_only_the_number_of_recipients():
    d = AU.describe_call("mail_send", "mail", {"zugang": "Wolke", "an": "a@example.org, b@example.org",
                                               "betreff": SECRET_TEXT, "text": SECRET_TEXT}, find)
    assert d["target"]["recipients"] == 2
    assert "example.org" not in json.dumps(d["target"]) or d["target"].get("host") == "cloud.example.org"
    assert SECRET_TEXT not in json.dumps(d)


def test_search_terms_and_shell_commands_are_not_recorded():
    assert AU.describe_call("web_search", "web", {"anfrage": SECRET_TEXT}, find)["target"] == {}
    d = AU.describe_call("shell", "werkbank", {"befehl": f"curl -u x:{{{{cred:Wolke:password}}}} {SECRET_TEXT}"}, find)
    assert d["creds"][0]["name"] == "Wolke" and SECRET_TEXT not in json.dumps(d)


def test_llmitmir_changes_record_the_object_name():
    d = AU.describe_call("credential_save", "llmitmir", {"name": "Wolke", "felder": {"password": "neu"}}, find)
    assert d["target"] == {"object": "Wolke"} and "neu" not in json.dumps(d)


def test_internal_groups_are_not_logged():
    assert not AU.should_log("progress_update", "progress")
    assert not AU.should_log("file_read", "files")
    assert AU.should_log("credentials_list", "skills")
    assert AU.should_log("http_request", "http")


def test_make_event_keeps_only_known_simple_fields():
    agent = {"id": "agt-c1", "kind": "chat", "owner": "u1", "parent": "agt-c0", "project_id": "p1"}
    ev = AU.make_event(AU.EV_TOOL, agent, "r1", ts=100.0, tool="http_request", args={"x": SECRET_TEXT},
                       content=SECRET_TEXT, write=True, outcome="ok", ms="12", creds=[], target={})
    assert ev == {"ts": 100.0, "kind": "tool", "agent": "agt-c1", "agent_kind": "chat", "user": "u1", "run": "r1",
                  "parent": "agt-c0", "project_id": "p1", "tool": "http_request", "write": True, "outcome": "ok", "ms": 12}


# ------------------------------------------------------------------ Ablage und Abfrage

def _ev(ts, **kw):
    agent = {"id": kw.pop("agent", "agt-c1"), "kind": "chat", "owner": kw.pop("user", "u1")}
    if "parent" in kw:
        agent["parent"] = kw.pop("parent")
    return AU.make_event(kw.pop("kind", AU.EV_TOOL), agent, "r1", ts=ts, **kw)


def test_files_append_query_and_purge(tmp_path):
    files = AU.AuditFiles(str(tmp_path / "audit"))
    day1 = datetime(2026, 10, 10, 12).timestamp()
    day2 = datetime(2026, 11, 20, 12).timestamp()
    files.append([
        _ev(day1, tool="dav_read", creds=[{"id": "k1", "name": "Wolke"}], outcome="ok", model_class="main"),
        _ev(day2, tool="http_request", creds=[{"id": "k2", "name": "Wetter-API"}], outcome="denied", decision="denied",
            model_class="billed", target={"host": "api.wetter.example"}),
        _ev(day2 + 5, tool="ha_states", outcome="ok", agent="agt-c2", parent="agt-c1", user="u2"),
    ])
    today = date(2026, 11, 24)
    since = datetime(2026, 10, 1).timestamp()
    events, summary, more = files.query({"since": since}, today=today)
    assert [e["tool"] for e in events] == ["ha_states", "http_request", "dav_read"] and not more
    assert summary["events"] == 3 and summary["denied"] == 1 and summary["external"] == 1
    assert summary["agents"] == 2 and summary["users"] == 2 and summary["creds"]["k1"]["calls"] == 1
    assert [e["tool"] for e in files.query({"since": since, "cred": "k1"}, today=today)[0]] == ["dav_read"]
    assert [e["tool"] for e in files.query({"since": since, "outcome": "denied"}, today=today)[0]] == ["http_request"]
    assert len(files.query({"since": since, "agent_tree": "agt-c1"}, today=today)[0]) == 3  # mit Teilaufgabe
    assert [e["tool"] for e in files.query({"since": since, "host": "wetter"}, today=today)[0]] == ["http_request"]
    assert len(files.query({"since": since}, limit=2, today=today)[0]) == 2
    assert files.query({"since": since}, limit=2, today=today)[2] is True
    # ohne „seit“: die letzten 30 Tage
    assert [e["tool"] for e in files.query({}, today=today)[0]] == ["ha_states", "http_request"]
    assert files.purge(10, today=today) == 1
    assert [e["tool"] for e in files.query({"since": since}, today=today)[0]] == ["ha_states", "http_request"]


def test_a_half_written_line_is_skipped(tmp_path):
    files = AU.AuditFiles(str(tmp_path))
    ts = datetime(2026, 11, 2, 9).timestamp()
    files.append([_ev(ts, tool="a")])
    with open(tmp_path / "2026-11-02.jsonl", "a", encoding="utf-8") as fh:
        fh.write('{"ts": 1, "kind"')
    assert [e["tool"] for e in files.read_day("2026-11-02")] == ["a"]
    with pytest.raises(ValueError):
        files.read_day("../../etc/passwd")


def test_agent_index_and_pruning(tmp_path):
    index: dict = {}
    agent = {"id": "agt-t1", "kind": "task", "owner": "u1", "task_id": "t1", "task": "Bericht"}
    AU.update_agent(index, agent, _ev(100.0, kind=AU.EV_RUN, agent="agt-t1", model="glm", model_class="main"))
    AU.update_agent(index, agent, _ev(200.0, agent="agt-t1", creds=[{"id": "k1", "name": "Wolke"}]))
    a = index["agt-t1"]
    assert a["runs"] == 1 and a["calls"] == 1 and a["creds"] == {"k1": "Wolke"} and a["model"] == "glm"
    assert a["first_seen"] == 100.0 and a["last_seen"] == 200.0 and a["task"] == "Bericht"
    files = AU.AuditFiles(str(tmp_path))
    files.save_agents(index)
    assert files.load_agents() == index
    assert AU.prune_agents(index, 1, now_ts=200.0 + 2 * 86400) == 1 and index == {}


def test_filters_and_retention_are_validated():
    f = AU.clean_filters({"since": "100", "user": " u1 ", "cred": "", "write": 1, "evil": "x", "until": "abc"})
    assert f == {"since": 100.0, "user": "u1", "write": True}
    assert AU.clean_retention("90") == 90
    for bad in ("3", "99999", "viel", None):
        with pytest.raises(ValueError):
            AU.clean_retention(bad)


def test_days_between_is_capped():
    today = date(2026, 11, 24)
    days = AU.days_between(datetime(2020, 1, 1).timestamp(), None, today)
    assert days[0] == "2026-11-24" and len(days) == AU.QUERY_DAYS_MAX + 1


# ------------------------------------------------------------------ Dienst (gepuffert)

class _FakeHass:
    def __init__(self, loop):
        self.loop = loop
        self.tasks = []

    async def async_add_executor_job(self, fn, *args):
        return fn(*args)

    def async_create_background_task(self, coro, name):
        t = self.loop.create_task(coro)
        self.tasks.append(t)
        return t


def test_service_buffers_writes_and_never_raises(tmp_path):
    async def go():
        hass = _FakeHass(asyncio.get_running_loop())
        svc = AU.AuditService(hass, str(tmp_path / "a"), lambda: 30)
        await svc.async_load()
        agent = {"id": "agt-c1", "kind": "chat", "owner": "u1"}
        svc.record(AU.EV_TOOL, agent, "r1", tool="ha_states", outcome="ok")
        svc.record(AU.EV_TOOL, None, "r1", tool="x")          # ohne Agent: nichts
        svc.record(AU.EV_TOOL, agent, "r1", ts=object())      # kaputtes Feld: geloggt, nicht geworfen
        assert len(svc._buffer) == 1 and svc._timer is not None
        res = await svc.async_query({"since": time.time() - 60})
        assert [e["tool"] for e in res["events"]] == ["ha_states"] and svc._buffer == []
        assert AU.AuditFiles(str(tmp_path / "a")).load_agents()["agt-c1"]["calls"] == 1
        assert await svc.async_purge() == 0
        await asyncio.gather(*hass.tasks)

    asyncio.run(go())


def test_placeholder_names_are_found_as_they_are_resolved():
    creds = {"k1": {"id": "k1", "name": "Cloud", "type": "basic", "fields": {"url": "https://cloud.example.org"}}}
    find = lambda n: next((c for c in creds.values() if c["name"].casefold() == n.strip().casefold()), None)  # noqa: E731
    desc = AU.describe_call("http_request", "http", {"url": "https://x.example/a", "header": {"A": "{{cred:Cloud\t:p}}"}}, find)
    assert [c["id"] for c in desc["creds"]] == ["k1"]


def test_changed_admin_sections_are_named_without_values():
    cfg = {"credentials_policy": {"lock_chats": True}, "audit": {"retention_days": 180}, "shared_key": "alt"}
    before = AU.config_snapshot(cfg)
    assert AU.changed_sections(before, cfg) == []
    cfg["credentials_policy"] = {"lock_chats": False}
    cfg["shared_key"] = SECRET_TEXT
    cfg["idm"] = {"enabled": False}
    changed = AU.changed_sections(before, cfg)
    assert changed == ["credentials_policy", "idm", "shared_key"] and SECRET_TEXT not in json.dumps(changed)
