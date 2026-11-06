# LLMitMir

**Chats, Coworks, geplante Aufgaben, Projekte und Skills mit Open-Weight-Modellen – direkt in Home Assistant.**
Eine Oberfläche nach dem Vorbild der Claude-Desktop-App, die mit jedem OpenAI-kompatiblen Anbieter funktioniert
(Voreinstellung: [SAIA](https://docs.hpc.gwdg.de/services/saia/) der GWDG / KISSKI).

*English summary below.*

## Funktionen

- **Chats** mit Streaming, sichtbaren Gedanken der Modelle, Markdown, Anhängen (Bilder, PDFs, Texte) und **Spracheingabe**
  (über `/audio/transcriptions` des Anbieters, Fallback Browser-Spracherkennung).
- **Coworks**: Das Modell arbeitet eine Aufgabe selbstständig mit Werkzeugen ab, zeigt Plan, Schritte und Ergebnisdateien.
  Schreibende Aktionen fragen nach („Einmal erlauben“, „Immer erlauben“, „Ablehnen“). Braucht das Modell ein Werkzeug,
  das im Chat oder Projekt nicht eingeschaltet ist, fragt es ebenfalls („Einmal erlauben“, „Für diesen Chat einschalten“),
  statt die Aufgabe abzulehnen.
- **Kennt sich selbst**: Wie LLMitMir funktioniert und wie man Home Assistant gezielt abfragt, steht fest im Systemprompt
  und in `llmitmir_info` – das Modell sucht dafür nie im Web.
- **Skills, Aufgaben und Zugänge im Chat verwalten**: Das Modell legt sie an, ändert oder löscht sie; jede Änderung
  erscheint als Karte mit allen betroffenen Feldern (lange Texte Zeile für Zeile) und gilt erst nach „Übernehmen“.
  Geheimnisse bleiben dabei verdeckt, geplante Läufe dürfen das nie.
- **Geplante Aufgaben** mit Zeitplan (täglich, werktags, Wochentage, monatlich, Intervall, einmalig, Cron), gemeinsamer
  Warteschlange, langen Wiederholungsfristen und Push-Benachrichtigung über die HA-App. Ausdrücklich für Open-Weight-Modelle
  gebaut: Läufe dürfen verzögert starten und lange dauern.
- **Projekte**: Anweisungen, Dateien, Zugänge, Skills, Modelle und Freigaben als Kontext für Chats, Coworks und Aufgaben.
- **Skills** im Format von `SKILL.md` (Name, Beschreibung, Anleitung, Dateien) – das Modell lädt sie bei Bedarf.
- **Zugänge** getrennt von Skills: Das Modell sieht **nie** ein Geheimnis; Werkzeuge setzen Passwörter und Tokens
  serverseitig ein (`zugang`-Parameter oder Platzhalter `{{cred:Name:feld}}`), Ergebnisse werden geschwärzt.
- **Verbrauch und Limits**: Kontextfüllung je Chat, Tokens und Anfragen je Tag, persönliche Kontingente und die
  Rate-Limits des Schlüssels (`x-ratelimit-*`-Header) als Füllanzeige.
- **Mehrere Personen**: Alles ist pro HA-Nutzer*in getrennt. Admins legen fest, wer LLMitMir nutzen darf, und wählen,
  ob es **einen gemeinsamen Schlüssel**, **einen Schlüssel je Person (vom Admin eingetragen)** oder **eigene Schlüssel** gibt.
- **Eigener Schlüssel für geplante Aufgaben** (optional), damit Aufgaben nicht das Kontingent für spontane Chats aufbrauchen:
  zentral vom Admin für alle oder von jeder Person selbst gewählt (ein Schlüssel für alles, eigener Aufgaben-Schlüssel oder
  zentraler Aufgaben-Schlüssel). Unter *Geplant* steht, wie viele Anfragen und Tokens alle Aufgaben auf diesem Schlüssel je Tag
  verbrauchen; Läufe auf einem eigenen Aufgaben-Schlüssel zählen nicht zum persönlichen Tageskontingent.
- **Import aus Claude**: Ein Prompt, den man in Claude einfügt, überträgt Skills (mit herausgelösten Zugangsdaten),
  geplante Aufgaben, Projekte und Erinnerungen über einen Einmal-Link. Chatverläufe kommen aus dem offiziellen
  Datenexport von claude.ai (ZIP hochladen).
- Läuft auf Desktop, Tablet und Smartphone; hell und dunkel nach HA-Theme; Deutsch und Englisch.

### Werkzeuge (Cowork)

| Gruppe | Werkzeuge |
|---|---|
| Web | `web_search` (DuckDuckGo oder SearXNG), `web_fetch` (Seiten, PDFs, Bilder) |
| Home Assistant | `ha_states`, `ha_history`, `ha_service`*, `ha_ws` (Websocket-Befehle, lesend frei, sonst*) – mit den Rechten der Person |
| Nextcloud / WebDAV | `dav_list`, `dav_read`, `dav_write`*, `dav_request` (PROPFIND/REPORT frei, sonst*), `caldav_events` |
| HTTP | `http_request` (GET frei, sonst*) |
| Dateien | `file_list`, `file_read` (Textebene oder Bildmodell), `file_write` |
| Sonstiges | `notify`*, `skill_load`, `skill_file`, `progress_update`, `credentials_list` |
| LLMitMir (immer an) | `llmitmir_info`; mit Bestätigung jeder einzelnen Änderung: `skill_save`, `skill_delete`, `task_save`, `task_delete`, `credential_save`, `credential_delete` |
| Werkbank (optional) | `shell`*, `werkbank_files`, `werkbank_fetch`, `werkbank_push` |

\* schreibend – braucht eine Freigabe (bei geplanten Aufgaben beim Anlegen festgelegt).

## Werkbank (optional)

LLMitMir läuft auch ohne Werkbank. Mit ihr dürfen die Modelle **Programme ausführen** – Python-Skripte (auch aus Skills),
Auswertungen mit pandas, Excel/Word/PDF erzeugen, Sprachnachrichten mit Whisper abschreiben, ffmpeg, Tesseract und mehr –
abgeschottet auf einem eigenen Rechner, für jeden Chat in einer eigenen Sandbox. Einrichtung auf einer frischen Debian/Ubuntu-VM
mit einem Befehl:

```bash
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | sudo bash
```

Anforderungen, Schritt-für-Schritt-Anleitung, Sicherheit und Betrieb: **[docs/WERKBANK.md](docs/WERKBANK.md)** (auch im Panel
unter *Einstellungen → Werkbank* einblendbar). Code: [`werkbank/`](werkbank/).

## Installation

**HACS** (sobald ein GitHub-Spiegel existiert): Repository als „Benutzerdefiniertes Repository“ (Typ Integration) hinzufügen.

**Manuell:** Ordner `custom_components/llmitmir` nach `<config>/custom_components/` kopieren und Home Assistant neu starten.
Dann *Einstellungen → Geräte & Dienste → Integration hinzufügen → LLMitMir*. Danach erscheint **LLMitMir** in der
Seitenleiste; dort unter *Admin* Schlüssel, Personen, Kontingente und Modelle einstellen.

Voraussetzung: Home Assistant 2025.1 oder neuer. Zusätzliche Python-Abhängigkeit: `pypdfium2` (wird automatisch installiert).

### Daten

Pro Person unter `<config>/.storage/llmitmir/<user_id>/` (Chats als einzelne Dateien, Anhänge und Arbeitsbereiche unter
`files/`), die Admin-Konfiguration in `.storage/llmitmir.config`. Beides ist Teil normaler HA-Backups. Zugangsdaten
und Schlüssel liegen dort wie bei anderen Integrationen unverschlüsselt.

## Entwicklung

```bash
npm install
npm run build      # baut custom_components/llmitmir/frontend/llmitmir-panel.js (wird mit eingecheckt)
npm run check      # TypeScript prüfen
```

Das Frontend ist TypeScript mit [Lit](https://lit.dev), gebündelt mit esbuild; Markdown über `marked` + `DOMPurify`.

## English

LLMitMir adds a Claude-Desktop-style panel to Home Assistant: chats with streaming, reasoning and voice input; coworks
(autonomous tool use with approvals); scheduled tasks designed for slow, rate-limited open-weight models; projects; skills;
and a separate credential vault the model never sees. It works with any OpenAI-compatible API (preset: GWDG SAIA).
Admins choose who may use it and whether keys are shared, assigned per user by the admin, or entered by each user.
Scheduled tasks can run on a separate key (central or per user), with daily request/token usage of all tasks on that key.
A Claude import prompt moves skills (with credentials extracted), scheduled tasks, projects and memory; chat history is
imported from the official claude.ai data export.

## Lizenz

MIT – siehe [LICENSE](LICENSE).
