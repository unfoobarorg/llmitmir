"""Zweisprachigkeit des Backends: i18n.py und die Übersetzungen in locales/en.json.

Fehlermeldungen, Werkzeugnamen und Hinweise, die das Panel anzeigt, sind deutsch und werden über die Muster in
``locales/en.json`` übersetzt (im Panel mit tb(), im Backend mit i18n.tr). Dieser Test sorgt dafür, dass jede neue
Meldung auch eine englische Fassung bekommt.
"""
import ast
import importlib.util
import json
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parents[1] / "custom_components" / "llmitmir"
EN = json.loads((BASE / "locales" / "en.json").read_text(encoding="utf-8"))

_spec = importlib.util.spec_from_file_location("lm_i18n_test", BASE / "i18n.py")
I18N = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(I18N)

GERMAN = re.compile(r"[äöüÄÖÜß„“]|\b(und|oder|nicht|der|die|das|ist|mit|für|von|auf|wird|kein|keine|noch|bitte|Bitte|nur|wenn|"
                    r"dein|deine|sich|zu|im|am|bei|nach|gibt|braucht|fehlt|lesen|schreiben|speichern|ansehen|Zugang|Kachel|keinen|"
                    r"unbekannt|gefunden|ohne|Nachricht|Projekt)\b")
# Meldungen dieser Module sieht die Person (Websocket-Fehler, Fehler im Chat, Hinweise auf den Seiten)
RAISE_MODULES = ["ws.py", "boards.py", "access.py", "connectors.py", "credentials.py", "cron.py", "policy.py", "manage.py",
                 "skillcheck.py", "idm.py", "retention.py", "inbox.py", "views.py", "auditexport.py", "datarules.py", "agent.py",
                 "dashboards.py", "audit.py", "i18n.py", "mcp.py", "http.py", "speech.py", "claude_client.py", "provider.py"]
RAISE_NAMES = {"ValueError", "PermissionError", "KeyError", "QuotaError", "QuotaExhausted", "ProviderError"}


def _template(node):
    """Text eines Literals oder f-Strings; Ausdrücke werden zu {Platzhaltern} (die Namen sind egal)."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr):
        out = []
        for v in node.values:
            out.append(v.value if isinstance(v, ast.Constant) else "{x}")
        return "".join(out)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        a, b = _template(node.left), _template(node.right)
        return a + b if a is not None and b is not None else None
    return None


def _shape(s: str) -> str:
    return re.sub(r"\{\w+\}", "{}", s)


SHAPES = {_shape(k) for k in EN}


def _raised(module: str) -> list[tuple[int, str]]:
    tree = ast.parse((BASE / module).read_text(encoding="utf-8"))
    out = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Raise) and isinstance(n.exc, ast.Call) and getattr(n.exc.func, "id", "") in RAISE_NAMES:
            for a in n.exc.args:
                for x in ([a.body, a.orelse] if isinstance(a, ast.IfExp) else [a]):
                    t = _template(x)
                    if t and GERMAN.search(t):
                        out.append((n.lineno, t))
    return out


def test_every_shown_error_message_has_an_english_version():
    missing = [f"{m}:{line} {text!r}" for m in RAISE_MODULES for line, text in _raised(m) if _shape(text) not in SHAPES]
    assert not missing, "Ohne Übersetzung in locales/en.json:\n" + "\n".join(missing)


def test_tool_and_group_labels_have_an_english_version():
    missing = []
    for path in sorted((BASE / "tools").glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for n in ast.walk(tree):
            if isinstance(n, ast.keyword) and n.arg == "label":
                t = _template(n.value)
                if t and re.search(r"[a-zäöüß]{3}", t) and _shape(t) not in SHAPES and GERMAN.search(t + " Zugang"):
                    missing.append(f"{path.name}:{n.value.lineno} {t!r}")
            if isinstance(n, ast.Dict):
                for k, v in zip(n.keys, n.values):
                    if isinstance(k, ast.Constant) and k.value == "label" and isinstance(v, ast.Constant) \
                            and isinstance(v.value, str) and v.value not in EN and v.value != "Home Assistant" \
                            and v.value != "Skills":
                        missing.append(f"{path.name}:{v.lineno} {v.value!r}")
    assert not missing, "\n".join(missing)


def test_translations_use_only_placeholders_of_the_german_text():
    bad = []
    for k, v in EN.items():
        if "{{" in k:
            continue
        if set(re.findall(r"\{(\w+)\}", v)) - set(re.findall(r"\{(\w+)\}", k)):
            bad.append(k)
    assert not bad


def test_language_choice_and_fallbacks():
    assert I18N.languages()[0] == "de" and "en" in I18N.languages()
    assert I18N.clean_choice("auto") == "auto" and I18N.clean_choice("EN") == "en"
    assert I18N.clean_ui("en-GB") == "en" and I18N.clean_ui("xx") is None
    assert I18N.resolve({"language": "de", "ui_lang": "en"}, "en") == "de"
    assert I18N.resolve({"language": "auto", "ui_lang": "en"}, "de") == "en"
    assert I18N.resolve({}, "de-DE") == "de"
    assert I18N.resolve({}, "fr") == "en"          # unbekannte Sprache: Englisch wie im Panel
    assert I18N.resolve(None, None) == "de"
    try:
        I18N.clean_choice("xx")
        raise AssertionError("unbekannte Sprache angenommen")
    except ValueError:
        pass


def test_tr_translates_messages_with_placeholders():
    assert I18N.tr("Zugang „Mail“ nicht verfügbar", "en") == "Credential “Mail” not available"
    assert I18N.tr("täglich um 07:00 und 17:00", "en") == "daily at 07:00 and 17:00"
    assert I18N.tr("montags, freitags um 07:00", "en") == "Mondays, Fridays at 07:00"
    assert I18N.tr("Tageskontingent erreicht (12/800 Anfragen). Morgen geht es weiter.", "en") == \
        "Daily quota reached (12/800 requests). It continues tomorrow."
    assert I18N.tr("etwas ganz Neues", "en") == "etwas ganz Neues"
    assert I18N.tr("Zugang „Mail“ nicht verfügbar", "de") == "Zugang „Mail“ nicht verfügbar"
    assert I18N.t("Gespräche", "en") == "Conversations" and I18N.t("Gespräche", "de") == "Gespräche"
    assert I18N.t("Vorher: {x}", "en", x="a") == "Before: a"


def test_push_message_for_an_approval_in_english():
    spec = importlib.util.spec_from_file_location("lm_permnote_i18n", BASE / "permissionnotify.py")
    pn = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pn)
    title, text = pn.message({"label": "Datei lesen", "args": {"pfad": "a.txt"}}, "", simple=True, lang="en")
    assert title == "LLMitMir: approval needed"
    assert text == "I need your permission: Read file. It's about: a.txt"
    title, text = pn.message({"label": "Datei lesen", "args": {"pfad": "a.txt"}}, "", simple=True)
    assert title == "LLMitMir: Freigabe nötig" and text.startswith("Ich brauche deine Erlaubnis: Datei lesen.")
