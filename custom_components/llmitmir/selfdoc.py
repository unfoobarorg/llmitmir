"""What LLMitMir knows about itself and about Home Assistant (pure, no Home Assistant imports, unit-tested).

The model must never have to search the web to learn how LLMitMir works: it is a private project, and
anything found online under that name is unrelated. Keep these texts in sync with the UI and the tools.
"""
from __future__ import annotations

from datetime import datetime

try:
    from .changes import NOTIFY, describe
except ImportError:  # loaded standalone in tests
    from importlib import util as _u
    from pathlib import Path as _P

    _s = _u.spec_from_file_location("lm_selfdoc_changes", _P(__file__).with_name("changes.py"))
    _m = _u.module_from_spec(_s)
    _s.loader.exec_module(_m)
    NOTIFY, describe = _m.NOTIFY, _m.describe

# Always part of the system prompt: short, so it costs little, but enough that the model never looks elsewhere.
ABOUT = """## Über dich selbst (LLMitMir)
LLMitMir ist eine eigene Integration in Home Assistant (Seitenleiste „LLMitMir“), kein Webdienst. Alles, was du über \
LLMitMir wissen musst, steht hier und liefert `llmitmir_info` – nie im Web danach suchen und keine Webseiten dazu \
abrufen (llmitmir.de o. ä. hat nichts mit dir zu tun).
Bereiche, die die Person in der Seitenleiste verwaltet:
- **Chat** (kurze Fragen, wenige Werkzeuge) und **Cowork** (selbstständige Arbeit mit Schrittliste und allen Werkzeugen).
- **Projekte**: Anweisungen, Dateien (für dich mit `file_read`, Bereich „projekt“), zugeordnete Skills und Zugänge, \
eigene Modelle, Werkzeuge und Freigaben.
- **Geplant**: geplante Aufgaben = ein Auftrag (Prompt), der zu einem Zeitplan als unbeaufsichtigter Cowork läuft \
(täglich, werktags, wöchentlich, monatlich, stündlich, alle n Stunden, einmalig oder Cron), optional in einem \
Projekt, mit festgelegten Freigaben für schreibende Werkzeuge und Push-Benachrichtigung.
- **Skills**: Name, Beschreibung (wann der Skill gilt), Anleitung in Markdown (wie eine SKILL.md), optionale Dateien \
und zugeordnete Zugänge. Skills sind keine Dateien im Arbeitsbereich: lesen mit `skill_load` und `skill_file`.
- **Zugänge**: Zugangsdaten, getrennt von Skills; im Text nur als `{{cred:Name:feld}}`, Geheimnisse siehst du nie.
- **Einstellungen**: persönliche Hinweise (fließen unten als „Über die Person“ ein), Modelle, Benachrichtigungsgerät, \
Freigaben, Import aus Claude; Admins zusätzlich Anbieter, Schlüssel, Kontingente und die Werkbank (Sandbox für Befehle).
Alles davon liest du mit `llmitmir_info`. Skills, geplante Aufgaben und Zugänge legst du selbst an, änderst oder \
löschst sie mit `skill_save`/`skill_delete`, `task_save`/`task_delete`, `credential_save`/`credential_delete`: Die \
Person sieht die Änderung im Chat und bestätigt oder lehnt ab – also nicht vorher um Erlaubnis bitten, sondern die \
fertige Änderung vorschlagen. Projekte, persönliche Hinweise und Einstellungen ändert nur die Person selbst."""

# Always part of the system prompt as well (the ha_* tools are always on).
HA = """## Home Assistant
Du läufst in dieser Home-Assistant-Instanz und sprichst sie nur über die ha_*-Werkzeuge an, nie per HTTP-Anfrage \
oder mit Token – auch wenn ein Skill REST- oder WebSocket-Aufrufe mit Token beschreibt: ha_states/ha_history/\
ha_service/ha_ws leisten dasselbe (WebSocket-Befehle 1:1 über ha_ws). Du handelst mit den Rechten der Person.
Gezielt statt raten:
- Welche Integrationen es gibt: ha_ws `config_entries/get` (optional `{"domain": "…"}`); Geräte, Bereiche, \
Entitäten: `config/device_registry/list`, `config/area_registry/list`, `config/entity_registry/list_for_display`; \
was zu einer Integration/einem Gerät gehört: `search/related` mit `{"item_type": "config_entry"|"device"|"area", "item_id": "…"}`.
- Zustände mit `ha_states` und einem Filter (Domäne wie „sensor.“, Teil der ID oder des Namens; Namen sind meist \
deutsch, IDs oft englisch). Keine Begriffe raten, für die es keine Integration gibt.
- Verläufe mit `ha_history`, Langzeitstatistik (Energie, Zähler) mit ha_ws `recorder/statistics_during_period`, \
Logbuch mit `logbook/get_events`, Fehlerprotokoll mit `system_log/list`, Grundkonfiguration mit `get_config`.
- Kalender, Wetter, To-do-Listen: ha_service `calendar.get_events`, `weather.get_forecasts`, `todo.get_items` mit antwort=true.
- `get_services` liefert sehr viel; nur mit konkretem Zweck nutzen.
Steuern (ha_service ohne get_, schreibende ha_ws-Befehle) braucht eine Freigabe der Person."""

# Returned by `llmitmir_info` (without arguments) in front of the inventory.
MANUAL = """# LLMitMir – Handbuch für dich

## Chat und Cowork
- Chat: Unterhaltung; Werkzeuge wählt die Person im Eingabefeld (Standard: Web, Dateien, Skills; Home Assistant ist immer an). \
Höchstens 15 Werkzeugschritte je Antwort.
- Cowork: selbstständige Arbeit mit allen freigeschalteten Werkzeugen, sichtbarer Schrittliste (`progress_update`) und bis zu \
60 Schritten. Ergebnisse als Datei im Arbeitsbereich (`file_write`), die Person lädt sie herunter.
- Anhänge der Person liegen im Arbeitsbereich des Chats (`file_list`, `file_read`).

## Modelle
„Standard“ heißt automatisch: LLMitMir lädt alle drei Minuten die Modellliste des Anbieters samt Auslastung und nimmt für Chat, Cowork/Aufgaben und Bildlesen das passendste Modell, das gerade nicht überlastet ist; neu erschienene Modelle werden von selbst berücksichtigt. Hängt ein Modell, schlägt der Chat ein freies, ähnlich gutes vor (die Person kann mitten im Lauf wechseln, es geht beim aktuellen Schritt weiter); geplante Aufgaben mit Standardmodell wechseln nach drei Minuten ohne Antwort selbst. Feste Modelle (in Einstellungen, Projekt oder Aufgabe) bleiben, solange es sie gibt.

## Projekte
Felder: Name, Beschreibung, Anweisungen (gelten in jedem Chat des Projekts), Dateien, Skills und Zugänge (optional „nur diese“), \
Modell für Chats und für Coworks/Aufgaben, erlaubte Werkzeuggruppen, Freigaben für schreibende Werkzeuge.

## Geplante Aufgaben (Seite „Geplant“)
Felder: Name, Auftrag (der vollständige Prompt – er muss ohne Rückfragen ausführbar sein), Projekt (optional), Modell, \
Zeitplan, Aktiv/Pausiert, Freigaben für schreibende Aktionen (z. B. notify, file_write, dav_write, ha_service, shell), \
Benachrichtigen (nach jedem Lauf / nur bei neuem Ergebnis oder Fehler / nur bei Fehlern / nie), „Braucht die Werkbank“.
Zeitpläne: täglich HH:MM, werktags HH:MM, wöchentlich an Wochentagen, monatlich am Tag X, stündlich zur Minute M, alle n Stunden, \
einmalig zu einem Zeitpunkt, Cron mit 5 Feldern (Minute Stunde Tag Monat Wochentag, 0 = Sonntag) in Ortszeit.
Ein Lauf ist ein unbeaufsichtigter Cowork: nicht freigegebene schreibende Werkzeuge werden abgelehnt, Rückfragen gehen in den \
Bericht. Läufe stehen in einer gemeinsamen Warteschlange; verpasste Läufe werden nachgeholt; „Jetzt ausführen“ startet sofort.

## Skills (Seite „Skills“)
Felder: Name, Beschreibung (höchstens 1024 Zeichen; entscheidet, wann du den Skill lädst – also konkret sagen, für welche \
Themen/Wörter er gilt und wofür nicht), Anleitung (Markdown wie eine SKILL.md: Vorgehen, Adressen, Beispiele), Dateien \
(Skripte, Vorlagen; mit `skill_file` lesbar, in der Werkbank unter skills/<Name>/), Zugänge, Aktiv.
Gute Anleitungen nennen die LLMitMir-Werkzeuge, mit denen etwas geht (z. B. `dav_list`/`caldav_events` mit `zugang`, \
`http_request` mit `{{cred:Name:feld}}`, ha_*-Werkzeuge für diese Home-Assistant-Instanz), statt curl-Befehle oder Tokens.

## Zugänge (Seite „Zugänge“)
Typen: webdav, basic, bearer, header, telegram, imap, other. Felder je nach Typ (url, username, password, token …) plus Notiz. \
Geheime Felder siehst du nie; verwende den Namen als `zugang` in dav_*/http_request oder Platzhalter `{{cred:Name:feld}}`.

## Werkzeuggruppen
Websuche & Abrufen (web_search, web_fetch) · Home Assistant (ha_states, ha_history, ha_service, ha_ws – immer an) · \
Nextcloud/WebDAV/CalDAV (dav_list, dav_read, dav_write, dav_request, caldav_events) · HTTP-Anfragen (http_request) · \
Dateien (file_list, file_read, file_write) · Benachrichtigungen (notify, an das in den Einstellungen gewählte Gerät) · \
Skills (skill_load, skill_file, credentials_list) · Fortschritt (progress_update, nur Cowork) · \
Werkbank (shell, werkbank_files, werkbank_fetch, werkbank_push – nur wenn ein Admin sie eingerichtet hat).
Schreibende Werkzeuge fragen die Person, sofern sie in den Einstellungen oder im Projekt nicht dauerhaft erlaubt/verboten sind.

## Werkbank
Eigene Linux-Sandbox (Docker) neben Home Assistant: Python mit pandas, openpyxl, pypdf, python-docx, matplotlib, faster-whisper; \
ffmpeg, tesseract, pdftotext, ImageMagick, Node.js, curl, git, jq. Ohne Werkbank geht alles außer Befehlen/Skripten.

## Skills, Aufgaben und Zugänge verwalten
`skill_save`, `task_save` und `credential_save` legen an oder ändern (gefunden über den Namen; nicht angegebene Felder bleiben), \
`skill_delete`, `task_delete` und `credential_delete` löschen. Vor jeder Änderung zeigt LLMitMir der Person, was sich ändert \
(neue Felder, bei langen Texten Zeile für Zeile), und sie bestätigt oder lehnt ab; ein unbeaufsichtigter Lauf darf das nie. \
Für kleine Änderungen an langen Texten `anleitung_ersetzen` bzw. `auftrag_ersetzen` mit genau einmal vorkommenden Textstellen.
Geheimnisse (Passwörter, Tokens) nur eintragen, wenn die Person sie dir ausdrücklich gibt; sonst den Zugang ohne sie anlegen \
und sagen, dass sie das Feld auf der Seite „Zugänge“ selbst ausfüllt.

## Werkzeuge, die nicht eingeschaltet sind
Im Chat wählt die Person Werkzeuggruppen aus, Projekte können sie einschränken. Brauchst du ein Werkzeug, das gerade nicht \
eingeschaltet ist, rufe es trotzdem auf: Die Person wird gefragt (einmal erlauben, für diesen Chat einschalten oder ablehnen).

## Was du nicht kannst
Projekte, Einstellungen und persönliche Hinweise ändern – das macht die Person in der Oberfläche. Chatverläufe anderer \
Chats kennst du nicht."""


def _ts(v) -> str:
    try:
        return datetime.fromtimestamp(float(v)).strftime("%d.%m.%Y %H:%M")
    except (TypeError, ValueError, OSError):
        return ""


def _project_name(projects: dict, pid) -> str:
    return (projects.get(pid or "") or {}).get("name") or ""


def overview(meta: dict, allowed_skills: set | None = None, allowed_creds: set | None = None) -> str:
    """Inventory of the person's LLMitMir: projects, skills, scheduled tasks and credentials (no secrets)."""
    projects = meta.get("projects") or {}
    skills = [s for s in (meta.get("skills") or {}).values() if allowed_skills is None or s.get("id") in allowed_skills]
    tasks = list((meta.get("tasks") or {}).values())
    creds = [c for c in (meta.get("credentials") or {}).values() if allowed_creds is None or c.get("id") in allowed_creds]
    cred_names = {c.get("id"): c.get("name") for c in (meta.get("credentials") or {}).values()}
    out = ["# Bestand"]
    out.append(f"## Projekte ({len(projects)})")
    out += [f"- {p.get('name')}" + (f": {str(p.get('description'))[:200]}" if p.get("description") else "")
            for p in projects.values()] or ["- keine"]
    out.append(f"## Skills ({len(skills)})")
    out += [f"- {s.get('name')}" + ("" if s.get("enabled", True) else " (deaktiviert)")
            + (f" [Zugänge: {', '.join(cred_names.get(c) or c for c in s['credentials'])}]" if s.get("credentials") else "")
            + f": {str(s.get('description') or '')[:300]}" for s in skills] or ["- keine"]
    out.append(f"## Geplante Aufgaben ({len(tasks)})")
    for t in tasks:
        bits = [describe(t.get("schedule") or {}), "aktiv" if t.get("enabled", True) else "pausiert"]
        if t.get("project_id"):
            bits.append(f"Projekt {_project_name(projects, t['project_id'])}")
        if t.get("next_run"):
            bits.append(f"nächster Lauf {_ts(t['next_run'])}")
        last = t.get("last_run") or {}
        if last.get("status"):
            bits.append(f"letzter Lauf {_ts(last.get('started'))} {last['status']}".replace("  ", " "))
        out.append(f"- {t.get('name')} ({'; '.join(b for b in bits if b)}): {str(t.get('prompt') or '')[:200]}")
    if not tasks:
        out.append("- keine")
    out.append(f"## Zugänge ({len(creds)})")
    out += [f"- {c.get('name')} ({c.get('type')})" for c in creds] or ["- keine"]
    out.append("Einzelheiten: llmitmir_info mit teil (skill/aufgabe/projekt) und name.")
    return "\n".join(out)


SECTIONS = {"skill": "skills", "aufgabe": "tasks", "task": "tasks", "projekt": "projects", "project": "projects"}


def find(meta: dict, teil: str, name: str, allowed_skills: set | None = None) -> tuple[str, dict] | None:
    """(section, item) for a skill/aufgabe/projekt by exact name or id, else by part of the name."""
    section = SECTIONS.get(str(teil or "").strip().casefold().rstrip("ns"))
    if not section:
        return None
    low = str(name or "").strip().casefold()
    items = [x for x in (meta.get(section) or {}).values()
             if section != "skills" or allowed_skills is None or x.get("id") in allowed_skills]
    hit = next((x for x in items if str(x.get("name") or "").casefold() == low or x.get("id") == name), None) \
        or next((x for x in items if low and low in str(x.get("name") or "").casefold()), None)
    return (section, hit) if hit else None


def detail(meta: dict, section: str, hit: dict, files: list[str] | None = None) -> str:
    """All fields of one skill, task or project (as found by `find`)."""
    projects = meta.get("projects") or {}
    cred_names = {c.get("id"): c.get("name") for c in (meta.get("credentials") or {}).values()}
    creds = ", ".join(cred_names.get(c) or c for c in hit.get("credentials") or []) or "keine"
    if section == "skills":
        return (f"# Skill: {hit.get('name')} ({'aktiv' if hit.get('enabled', True) else 'deaktiviert'})\n"
                f"## Beschreibung\n{hit.get('description') or ''}\n## Anleitung\n{hit.get('body') or ''}\n"
                f"## Zugänge\n{creds}\n## Dateien\n{', '.join(files or []) or 'keine'}")
    if section == "tasks":
        last = hit.get("last_run") or {}
        return (f"# Geplante Aufgabe: {hit.get('name')} ({'aktiv' if hit.get('enabled', True) else 'pausiert'})\n"
                f"Zeitplan: {describe(hit.get('schedule') or {})}\n"
                f"Projekt: {_project_name(projects, hit.get('project_id')) or 'ohne'}\n"
                f"Modell: {hit.get('model') or 'Standard'}\n"
                f"Freigaben: {', '.join(hit.get('allow_write') or []) or 'keine'}\n"
                f"Benachrichtigen: {NOTIFY.get(hit.get('notify') or 'always', hit.get('notify'))}\n"
                + ("Braucht die Werkbank\n" if "werkbank" in (hit.get("requires") or []) else "")
                + (f"Nächster Lauf: {_ts(hit['next_run'])}\n" if hit.get("next_run") else "")
                + (f"Letzter Lauf: {_ts(last.get('started'))} – {last.get('status')}"
                   + (f" ({last['error']})" if last.get("error") else "") + "\n" if last.get("status") else "")
                + f"## Auftrag\n{hit.get('prompt') or ''}")
    return (f"# Projekt: {hit.get('name')}\n{hit.get('description') or ''}\n## Anweisungen\n{hit.get('instructions') or ''}\n"
            f"## Skills\n{', '.join(str((meta.get('skills') or {}).get(s, {}).get('name') or s) for s in hit.get('skills') or []) or 'keine'}"
            f"{' (nur diese)' if hit.get('skills_only') else ''}\n## Zugänge\n{creds}{' (nur diese)' if hit.get('credentials_only') else ''}\n"
            f"## Dateien\n{', '.join(files or []) or 'keine'}")
