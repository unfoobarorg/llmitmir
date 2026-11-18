"""Projektanforderungen, die bei jeder Änderung gelten (Version, Manifest, Übersetzungen, Werkzeuge, Doku, Repo).

Tests mit ``xfail(strict=True)`` beschreiben bekannte Befunde aus der Prüfung vor Version 1.0.0 (IDs wie D1).
Ist ein Befund behoben, meldet pytest „XPASS(strict)“ und schlägt fehl – dann den Marker entfernen.
"""
from __future__ import annotations

import ast
import json
import re
import subprocess

import pytest

from _lm import BASE, ROOT, load_all_tools

SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def _manifest() -> dict:
    return json.loads((BASE / "manifest.json").read_text(encoding="utf-8"))


def _const_version() -> str:
    tree = ast.parse((BASE / "const.py").read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "VERSION" for t in node.targets):
            return node.value.value
    raise AssertionError("VERSION fehlt in const.py")


# ------------------------------------------------------------------ Version und Manifest
def test_version_is_semver_and_identical_in_manifest_and_const():
    """Die Konvention: manifest.json und const.VERSION werden immer gemeinsam hochgezählt."""
    version = _manifest()["version"]
    assert SEMVER.match(version), f"keine Semver-Version: {version}"
    assert _const_version() == version, "manifest.json und const.VERSION weichen voneinander ab"


def test_manifest_has_what_home_assistant_and_hacs_need():
    m = _manifest()
    for key in ("domain", "name", "version", "documentation", "issue_tracker", "codeowners", "requirements",
                "iot_class", "config_flow", "integration_type"):
        assert key in m, f"manifest.json: „{key}“ fehlt"
    assert m["domain"] == "llmitmir"
    assert m["config_flow"] is True and m["single_config_entry"] is True
    # Abhängigkeiten, die __init__.py beim Einrichten tatsächlich benutzt
    for dep in ("http", "frontend", "panel_custom", "websocket_api"):
        assert dep in m["dependencies"], f"Abhängigkeit „{dep}“ fehlt im Manifest"
    for req in m["requirements"]:
        assert re.match(r"^[A-Za-z0-9_.\-\[\]]+(>=|==|~=)[0-9][0-9A-Za-z.\-]*$", req), f"Anforderung ohne Version: {req}"


def test_hacs_json_names_a_minimum_home_assistant_version():
    hacs = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))
    assert hacs["name"] == _manifest()["name"]
    assert re.match(r"^\d{4}\.\d{1,2}\.\d+$", hacs["homeassistant"])


def test_all_json_files_load():
    for path in BASE.rglob("*.json"):
        json.loads(path.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ Übersetzungen
def _keys(d: dict, prefix: str = "") -> set[str]:
    out = set()
    for k, v in d.items():
        out |= _keys(v, f"{prefix}{k}.") if isinstance(v, dict) else {prefix + k}
    return out


def test_translations_have_the_same_keys_as_strings_json():
    strings = _keys(json.loads((BASE / "strings.json").read_text(encoding="utf-8")))
    for lang in ("de", "en"):
        tr = _keys(json.loads((BASE / "translations" / f"{lang}.json").read_text(encoding="utf-8")))
        assert strings - tr == set(), f"{lang}.json: fehlende Schlüssel"
        assert tr - strings == set(), f"{lang}.json: überzählige Schlüssel"


def test_config_flow_errors_and_aborts_are_translated():
    src = (BASE / "config_flow.py").read_text(encoding="utf-8")
    strings = json.loads((BASE / "strings.json").read_text(encoding="utf-8"))["config"]
    for err in re.findall(r'errors\["[a-z_]+"\]\s*=\s*"([a-z_]+)"', src):
        assert err in strings.get("error", {}), f"Fehler „{err}“ ohne Übersetzung"
    for reason in re.findall(r'async_abort\(reason="([a-z_]+)"\)', src):
        assert reason in strings.get("abort", {}), f"Abbruch „{reason}“ ohne Übersetzung"


def test_every_preset_has_a_selector_translation():
    strings = json.loads((BASE / "strings.json").read_text(encoding="utf-8"))
    tree = ast.parse((BASE / "const.py").read_text(encoding="utf-8"))
    presets = next(n.value for n in tree.body if isinstance(n, ast.Assign)
                   and any(getattr(t, "id", None) == "PRESETS" for t in n.targets))
    keys = {k.value for k in presets.keys}
    assert keys <= set(strings["selector"]["preset"]["options"]), "Anbieter ohne Übersetzung im Einrichtungsdialog"


# ------------------------------------------------------------------ Werkzeuge
TOOLS = load_all_tools()
# Gruppen, die es zusätzlich zu GROUPS gibt (nie als Auswahl in der Oberfläche)
INTERNAL_GROUPS = {"llmitmir", "unterchat", "teilergebnis"}


@pytest.mark.parametrize("name", sorted(TOOLS.REGISTRY))
def test_tool_definition_is_valid_for_openai_compatible_apis(name):
    tool = TOOLS.REGISTRY[name]
    # Funktionsnamen: OpenAI-kompatible APIs und Claude erlauben nur [a-zA-Z0-9_-], höchstens 64 Zeichen
    assert re.match(r"^[a-z0-9_]{1,64}$", name)
    assert tool.name == name
    assert tool.group in TOOLS.GROUPS or tool.group in INTERNAL_GROUPS, f"unbekannte Gruppe {tool.group}"
    assert tool.description.strip(), "Beschreibung fehlt"
    assert tool.label and tool.icon.startswith("mdi:")
    p = tool.parameters
    assert p["type"] == "object" and isinstance(p["properties"], dict)
    assert set(p.get("required") or []) <= set(p["properties"]), "required nennt unbekannte Parameter"
    json.dumps(tool.spec())  # muss sich als JSON verschicken lassen


def test_changes_to_llmitmir_itself_always_need_confirmation():
    """Werkzeuge mit Änderungskarte (preview) sind immer Schreibaktionen – nie „immer erlauben“, nie unbeaufsichtigt."""
    for name, tool in TOOLS.REGISTRY.items():
        if tool.preview is not None:
            assert tool.write is True, f"{name}: preview ohne write=True"


def test_actions_with_side_effects_are_write_tools():
    """Was nach außen wirkt (senden, schreiben, löschen, ausführen), braucht eine Freigabe."""
    always_write = {"mail_send", "mail_change", "dav_write", "ews_save", "shell", "notify", "dashboard_update"}
    for name in always_write:
        assert TOOLS.REGISTRY[name].is_write({}), f"{name} muss eine Freigabe brauchen"
    http = TOOLS.REGISTRY["http_request"]
    for method in ("POST", "PUT", "PATCH", "DELETE"):
        assert http.is_write({"methode": method})
    assert TOOLS.REGISTRY["ha_service"].is_write({"domain": "light", "service": "turn_on"})
    assert not TOOLS.REGISTRY["ha_service"].is_write({"domain": "calendar", "service": "get_events"})
    assert TOOLS.REGISTRY["dav_request"].is_write({"methode": "DELETE"})
    assert TOOLS.REGISTRY["caldav_entry"].is_write({"aktion": "loeschen"})


# ------------------------------------------------------------------ Dokumentation
README = (ROOT / "README.md").read_text(encoding="utf-8")


def test_tool_reference_lists_every_tool():
    """docs/WERKZEUGE.md nennt jedes Werkzeug, die README verweist darauf."""
    ref = (ROOT / "docs" / "WERKZEUGE.md").read_text(encoding="utf-8")
    missing = [n for n in sorted(TOOLS.REGISTRY) if f"`{n}`" not in ref]
    assert missing == [], f"in docs/WERKZEUGE.md fehlen: {missing}"
    assert "docs/WERKZEUGE.md" in README


def _sections(lang_heading: str) -> list[str]:
    part = README.split(f"## {lang_heading}", 1)[1].split("\n## ", 1)[0]
    return re.findall(r"^### (.+)$", part, re.M)


def test_readme_is_bilingual_with_the_same_structure():
    de, en = _sections("Deutsch"), _sections("English")
    assert len(de) >= 5 and len(de) == len(en), (de, en)


def test_readme_stays_short():
    """So kurz wie möglich, so lang wie nötig – Details gehören nach docs/."""
    assert len(README.splitlines()) <= 160


def test_readme_names_the_python_packages_and_minimum_version():
    hacs = json.loads((ROOT / "hacs.json").read_text(encoding="utf-8"))
    major_minor = ".".join(hacs["homeassistant"].split(".")[:2])
    for lang in ("Deutsch", "English"):
        part = README.split(f"## {lang}", 1)[1]
        assert major_minor in part, lang
        for req in _manifest()["requirements"]:
            name = re.split(r"[<>=~\[]", req)[0]
            assert f"`{name}`" in part, f"{lang}: {name} fehlt"


def test_documentation_links_resolve():
    for doc in [ROOT / "README.md", *(ROOT / "docs").glob("*.md")]:
        for target in re.findall(r"\]\(([^)#:]+\.md)\)", doc.read_text(encoding="utf-8")):
            assert (doc.parent / target).exists(), f"{doc.name}: {target}"


def test_changelog_has_the_current_version():
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert f"## {_manifest()['version']}" in changelog


# ------------------------------------------------------------------ öffentliches Repo
SECRET_PATTERNS = [
    re.compile(r"glpat-[A-Za-z0-9_\-]{20,}"),                       # GitLab-Token
    re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),                       # GitHub-Token
    re.compile(r"sk-(ant|proj)-[A-Za-z0-9_\-]{20,}"),                # Anthropic / OpenAI
    re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),                    # AWS
]


def _tracked_files() -> list:
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("kein Git-Checkout")
    return [ROOT / p for p in out.decode().split("\0") if p and not p.endswith(("package-lock.json", ".png"))]


def test_no_secrets_in_the_public_repository():
    hits = []
    for path in _tracked_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for pat in SECRET_PATTERNS:
            for m in pat.finditer(text):
                hits.append(f"{path.relative_to(ROOT)}: {m.group(0)[:12]}…")
    assert hits == []


def test_werkbank_env_file_is_not_tracked():
    tracked = {p.relative_to(ROOT).as_posix() for p in _tracked_files()}
    assert "werkbank/.env" not in tracked
    assert "werkbank/.env.example" in tracked
    env = (ROOT / "werkbank" / ".env.example").read_text(encoding="utf-8")
    assert re.search(r"^WERKBANK_TOKEN=\s*$", env, re.M), "Beispiel-.env darf keinen Token enthalten"
