# Entwicklung

*Zurück zur [README](../README.md).*

Entwickelt wird auf [git.unfoobar.org/ha-integrations/llmitmir](https://git.unfoobar.org/ha-integrations/llmitmir)
(Merge Requests nach `dev`, Release über `main`). [github.com/unfoobarorg/llmitmir](https://github.com/unfoobarorg/llmitmir)
ist ein Spiegel – darüber installiert HACS die Integration; Änderungen dort gehen beim nächsten Spiegeln verloren.

## Bauen

```bash
npm ci
npm run build      # baut custom_components/llmitmir/frontend/llmitmir-panel.js und THIRD_PARTY_LICENSES.txt (beide eingecheckt)
npm run watch      # baut das Bundle bei jeder Änderung neu (ohne Lizenzdatei)
npm run check      # TypeScript prüfen
npm test           # Frontend-Logik ohne Browser (Raster, Vorlesetext, Achsen, sichere Bildadressen)
```

Das Frontend wird nur in `frontend/src/*.ts` geändert, nie im Bundle. Texte gibt es auf Deutsch (Quelle) und Englisch
(`frontend/src/i18n.ts`, `custom_components/llmitmir/translations/`).

## Tests

```bash
pip install -r requirements_test.txt
PYTHONPATH=. pytest                 # tests/: ohne Home Assistant – Logik, Sicherheit, Werkbank, Projektregeln
ruff check .

# eigene Umgebung (Python 3.14; installiert Home Assistant mit)
pip install -r requirements_test_ha.txt
PYTHONPATH=. pytest tests_ha        # gegen ein echtes Home Assistant – Einrichtung, Rechte, Trennung der Personen
```

- `tests/` lädt die Module ohne Home Assistant; was HA importiert, bekommt Attrappen nur während des Ladens
  (`tests/_lm.py`). Die Zeitzone stellen die Tests selbst ein.
- `tests_ha/` nutzt `pytest-homeassistant-custom-component`; die Version in `requirements_test_ha.txt` legt die
  HA-Version fest. Die CI testet zusätzlich die Mindestversion aus `hacs.json`.
- `tests/fixtures/grid_cases.json` prüfen beide Seiten: `dashboards.py` (Python) und `grid.ts` (Node).
- Ein bekannter, noch offener Fehler steht als `xfail(strict=True)` mit seiner ID im Test. Ist er behoben, schlägt der
  Test als „XPASS“ fehl – dann den Marker entfernen.

## CI (`.gitlab-ci.yml`)

| Stufe | Jobs |
|---|---|
| lint | ruff, Syntax aller Python-Module, JSON, Shell-Skripte der Werkbank |
| test | Unit-Tests mit Python 3.13 und 3.14 · HA-Tests gegen die aktuelle und die Mindestversion · neuestes HA (nur Warnung) · Frontend: tsc, Tests, Bundle und Lizenzdatei aktuell · Schwachstellen: `pip-audit` (Abhängigkeiten aus dem Manifest) und `npm audit` (nur Warnung) |
| release | nur für `main`, Merge Requests nach `main` und Tags: dieselben Tests mit `--runxfail` (kein offener Befund) · ein Tag muss der Version im Manifest entsprechen |

## Konventionen

- Version in `custom_components/llmitmir/manifest.json` und `VERSION` in `const.py` immer gemeinsam hochzählen
  (Semver); Änderungen in [CHANGELOG.md](../CHANGELOG.md) eintragen.
- Logik möglichst in HA-freien, testbaren Modulen (`access.py`, `taskedit.py`, `credentials.py`, `dashboards.py` …).
- Das Repository ist öffentlich: keine Geheimnisse, internen Adressen oder persönlichen Daten in Code, Tests und Commits
  (`tests/test_release.py` sucht nach Token-Mustern).

## Aufbau

| Bereich | Dateien |
|---|---|
| Einrichtung, Panel | `__init__.py`, `config_flow.py`, `const.py`, `manifest.json` |
| Chat- und Cowork-Schleife, Freigaben | `agent.py` |
| Anbieter, Modelle, Kosten | `provider.py`, `providers.py`, `models.py`, `claude_client.py`, `claude_convert.py`, `pricing.py` |
| Schnittstellen des Panels | `ws.py` (Websocket), `http.py` (Dateien, Vorschau, Sprache, Import) |
| Speicher, Lebensdauer | `storage.py`, `retention.py` |
| Aufgaben, Teilen | `scheduler.py`, `cron.py`, `sharing.py`, `taskedit.py`, `taskkeys.py`, `tasknotify.py`, `inbox.py` |
| Dashboards | `dashboards.py`, `access.py`, `boards.py` |
| Zugänge | `credentials.py`, `credcheck.py`, `ews.py`, `ntlm.py`, `mailbox.py` |
| Wartungsmodus, Sensor laufende Agenten | `maintenance.py`, `sensor.py`, `services.yaml` |
| Trusted-AI-Zentrale: Export, Auffälligkeiten, Entzug | `auditexport.py` (HA-frei; WS `admin/agent_stop`, `admin/revoke`, `admin/anomalies`, `admin/audit_export_test`) |
| MCP-Konnektoren | `mcp.py` (HA-frei; Werkzeuge je Lauf in `ToolContext.mcp_tools`, WS `admin/mcp_tools`) |
| Datenregeln, Wächter | `datarules.py` (HA-frei; eingehängt in `ToolContext._data_guard` vor dem Werkzeug) |
| Konnektoren, Nextcloud Login Flow v2 | `connectors.py` (HA-frei; WS `connector/*` in `ws.py`, Seite `frontend/src/connectors.ts`) |
| Zentrale Skills, Skill-Richtlinien | `skillcheck.py` (Prüflogik HA-frei; `check_skill`/`recheck_all` mit dem Manager) |
| Freigabe von Zugängen je Agent, Art des Zugangs | `policy.py` (HA-frei; eingehängt in `ToolContext._approve_creds`) |
| Agenten-Identitäten, Zugriffsprotokoll | `audit.py` (HA-frei; eingehängt in `ToolContext.execute`, Admin → Monitoring in `frontend/src/monitoring.ts`) |
| Werkzeuge | `tools/` – Übersicht in [WERKZEUGE.md](WERKZEUGE.md) |
| Frontend | `frontend/src/` (Lit, esbuild, marked + DOMPurify); 3D-Roboter `robot3d.ts`, Sprachgespräch `voice*.ts`, Dashboards `pages3.ts`, `grid.ts`, `tiles/` |
| Werkbank | `werkbank/` – siehe [WERKBANK.md](WERKBANK.md) |

Daten liegen je Person unter `<config>/.storage/llmitmir/<user_id>/` (Chats als Dateien, `files/`, `tiles/`), die
Admin-Konfiguration in `.storage/llmitmir.config`, das Kostenbuch in `.storage/llmitmir.billing`, das
Zugriffsprotokoll in `.storage/llmitmir_audit/` (eine JSONL-Datei je Tag plus `agents.json`).
