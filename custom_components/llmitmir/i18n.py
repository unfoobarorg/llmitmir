"""Sprache der Oberfläche für Texte, die das Backend selbst erzeugt (HA-frei, testbar).

Deutsch ist die Ausgangssprache: Der deutsche Text ist zugleich der Schlüssel. Die Übersetzungen liegen in
``locales/<code>.json`` – dieselben Dateien bündelt das Panel (frontend/src/i18n.ts). Fehlermeldungen der Websocket-API
übersetzt das Panel selbst; hier geht es um alles, was ohne Panel ankommt (Push-Nachrichten, Hinweise im Chat,
Systemprompt) und um die gespeicherte Wahl der Person.

Eine neue Sprache braucht nur ``locales/<code>.json`` und einen Eintrag in ``LANGUAGES`` im Panel; hier wird jede Datei
im Ordner von selbst geladen.
"""
from __future__ import annotations

import json
import os
import re

BASE = "de"
AUTO = "auto"
_DIR = os.path.join(os.path.dirname(__file__), "locales")
# Name der Sprache, wie er im (deutschen) Systemprompt steht
PROMPT_NAMES = {"de": "Deutsch", "en": "Englisch"}


def _load() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    try:
        names = sorted(os.listdir(_DIR))
    except OSError:
        return out
    for f in names:
        if f.endswith(".json") and len(f) == 7:  # de.json, en.json, …
            try:
                with open(os.path.join(_DIR, f), encoding="utf-8") as fh:
                    data = json.load(fh)
            except (OSError, ValueError):
                continue
            if isinstance(data, dict):
                out[f[:2]] = {str(k): str(v) for k, v in data.items()}
    return out


# Beim Import laden (Home Assistant importiert Integrationen im Executor) – später kein Dateizugriff im Event-Loop
_DICTS = _load()
_PATTERNS: dict[str, list[tuple[re.Pattern, str, list[str]]]] = {}


def languages() -> list[str]:
    return [BASE, *sorted(c for c in _DICTS if c != BASE)]


def clean_choice(value) -> str:
    """Gespeicherte Wahl prüfen: „auto“ oder eine bekannte Sprache."""
    v = str(value or AUTO).strip().lower()
    if v == AUTO or v in languages():
        return v
    raise ValueError("Diese Sprache gibt es nicht.")


def clean_ui(value) -> str | None:
    """Sprache, die das Panel bei „Automatisch“ tatsächlich zeigt (aus dem Profil in Home Assistant)."""
    v = str(value or "").strip().lower()[:2]
    return v if v in languages() else None


def resolve(settings: dict | None, fallback: str | None = None) -> str:
    """Sprache einer Person: ihre Wahl, bei „Automatisch“ die zuletzt vom Panel gemeldete, sonst die von Home Assistant.

    Eine Sprache, die LLMitMir nicht kennt, wird Englisch – wie im Panel."""
    s = settings or {}
    choice = str(s.get("language") or AUTO)
    if choice != AUTO and choice in languages():
        return choice
    ui = clean_ui(s.get("ui_lang"))
    if ui:
        return ui
    fb = str(fallback or "").strip().lower()[:2]
    if not fb:
        return BASE
    return fb if fb in languages() else ("en" if "en" in languages() else BASE)


def _compile(lang: str) -> list[tuple[re.Pattern, str, list[str]]]:
    if lang in _PATTERNS:
        return _PATTERNS[lang]
    out = []
    for key in _DICTS.get(lang, {}):
        if not re.search(r"\{\w+\}", key):
            continue
        names: list[str] = []
        src = ""
        for part in re.split(r"(\{\w+\})", key):
            m = re.fullmatch(r"\{(\w+)\}", part)
            if m:
                names.append(m.group(1))
                src += r"([\s\S]+?)"
            else:
                src += re.escape(part)
        out.append((re.compile(f"^{src}$"), key, names))
    out.sort(key=lambda x: -len(re.sub(r"\{\w+\}", "", x[1])))
    _PATTERNS[lang] = out
    return out


def _fill(text: str, params: dict) -> str:
    for k, v in params.items():
        text = text.replace("{" + k + "}", str(v))
    return text


def t(text: str, lang: str | None, **params) -> str:
    """Text der Oberfläche in ``lang``; Platzhalter {name} werden mit ``params`` gefüllt."""
    d = _DICTS.get(lang or BASE) if lang and lang != BASE else None
    return _fill(d.get(text, text) if d else text, params)


def tr(text: str | None, lang: str | None) -> str:
    """Fertigen deutschen Text übersetzen – genau oder nach einem Muster mit Platzhaltern („Zugang {name} fehlt“).
    Unbekanntes bleibt, wie es ist."""
    if not text or not lang or lang == BASE or lang not in _DICTS:
        return text or ""
    d = _DICTS[lang]
    if text in d:
        return d[text]
    for rx, key, names in _compile(lang):
        m = rx.match(text)
        if m:
            return _fill(d[key], {n: _part(m.group(i + 1), lang) for i, n in enumerate(names)})
    return text


def _part(value: str, lang: str) -> str:
    """Platzhalter-Wert übersetzen; eine Aufzählung („montags, freitags“) Teil für Teil."""
    whole = tr(value, lang)
    if whole != value or ", " not in value:
        return whole
    return ", ".join(tr(x, lang) for x in value.split(", "))
