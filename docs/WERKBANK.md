# Die Werkbank einrichten

Die **Werkbank** ist eine optionale Ergänzung für LLMitMir: ein kleiner Rechner (meist eine virtuelle Maschine), auf dem die
Modelle **Programme ausführen** dürfen – abgeschottet von Home Assistant. LLMitMir funktioniert auch ohne Werkbank.

## Was bringt die Werkbank?

| | Ohne Werkbank | Mit Werkbank |
|---|---|---|
| Chatten, Coworks, geplante Aufgaben | ✓ | ✓ |
| Web durchsuchen, Seiten abrufen | ✓ | ✓ |
| Home Assistant lesen und steuern | ✓ | ✓ |
| Nextcloud-Dateien, -Kalender, -Kontakte | ✓ | ✓ |
| PDFs, Scans und Fotos lesen (Bildmodell) | ✓ | ✓ |
| **Python-Skripte und Befehle ausführen** (z. B. Skripte aus Skills) | – | ✓ |
| **Rechnen und Auswerten** mit pandas, Tabellen und Diagramme erzeugen | – | ✓ |
| **Excel, Word, PowerPoint, PDF** erstellen oder umbauen | – | ✓ |
| **Sprachnachrichten abschreiben** (Whisper), Audio/Video umwandeln (ffmpeg) | – | ✓ |
| **Texterkennung** (Tesseract) als Ergänzung zum Bildmodell | – | ✓ |
| Beliebige Kommandozeilen-Werkzeuge (curl, git, jq, sqlite …) | – | ✓ |

Jeder Chat und jede Aufgabe bekommt auf der Werkbank eine **eigene Sandbox** (einen abgeschotteten Container) mit eigenem
Arbeitsordner. Anhänge und Skill-Dateien werden dort hineinkopiert, Ergebnisse holt das Modell zurück in den Chat. Ungenutzte
Sandboxen räumt die Werkbank nach zwei Stunden auf. Befehle laufen wie andere schreibende Aktionen nur mit deiner Freigabe.

## Was du brauchst

- **Einen Rechner oder eine VM**, die dauerhaft läuft, mit **Debian 12/13** oder **Ubuntu 22.04/24.04** (64 Bit, x86 oder ARM).
  Am einfachsten ist eine neue VM auf demselben Server wie Home Assistant (z. B. Proxmox). Ein Raspberry Pi 5 mit 8 GB geht auch, ist aber langsamer.
- **Leistung:**

  | | Mindestens | Empfohlen |
  |---|---|---|
  | Prozessor | 2 Kerne | 4 Kerne |
  | Arbeitsspeicher | 4 GB | 8 GB (Whisper braucht beim Abschreiben ~3 GB) |
  | Festplatte | 25 GB | 50 GB (Programme ~8 GB, Sprachmodelle, Arbeitsordner) |

- **Netzwerk:** Home Assistant muss die Werkbank erreichen (Port **8787**), und die Werkbank braucht Internet
  (für Webseiten, Python-Pakete und das Herunterladen des Sprachmodells). Gib ihr im Router eine **feste IP-Adresse**.
- **Nicht nötig:** Freigabe ins Internet, Portweiterleitung, eigene Domain. Die Werkbank bleibt im Heimnetz.

## Einrichten in 4 Schritten

### 1. VM anlegen

Beispiel Proxmox: *VM erstellen* → Name z. B. `werkbank` → ISO von Debian 13 (netinst) → Festplatte 50 GB → 4 Kerne →
8192 MB RAM → Netzwerk wie Home Assistant (Bridge `vmbr0`). Debian installieren und dabei **„SSH-Server“** anhaken;
eine Desktop-Umgebung ist nicht nötig. Bei anderen Systemen (VirtualBox, Synology VMM, Unraid …) entsprechend.

### 2. Werkbank installieren

Melde dich auf der VM an (Konsole in Proxmox oder per SSH), werde root und führe **einen** Befehl aus:

```bash
sudo -i
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | bash
```

Das Skript installiert Docker, lädt die Werkbank, erzeugt einen geheimen Schlüssel (Token), baut die Sandbox
(beim ersten Mal 5–15 Minuten) und startet alles. Am Ende stehen **URL** und **Token** auf dem Bildschirm, z. B.:

```
URL:    http://192.168.1.50:8787
Token:  3f9c…e21a
```

### 3. In Home Assistant eintragen

Öffne in Home Assistant **LLMitMir → Admin → Werkbank**, trage URL und Token ein, klicke **Verbindung testen** und dann
**Speichern**. Steht dort „verbunden“, ist alles fertig.

### 4. Ausprobieren

Starte ein **Cowork** und schreibe z. B.: *„Erzeuge mit Python ein Diagramm der Zahlen 3, 7, 4, 9 und speichere es als
diagramm.png.“* Das Modell fragt vor dem ersten Befehl nach deiner Freigabe.

## Sicherheit

- Nutze für die Werkbank eine **eigene VM**, auf der sonst nichts läuft: Der Werkbank-Dienst steuert Docker und hat damit
  volle Rechte auf dieser VM.
- Die Sandboxen laufen ohne Sonderrechte, mit begrenztem Speicher (3 GB), Prozessor (2 Kerne) und Prozessanzahl. Sie haben
  Internetzugang (`SANDBOX_NETWORK=bridge`); mit `none` laufen sie komplett offline – dann gehen aber keine Downloads.
- Der **Token** ist das einzige Passwort – nicht weitergeben. Erlaube Port 8787 am besten nur für die IP von Home Assistant
  (Firewall der VM oder des Routers).
- Gib die Werkbank **nicht ins Internet frei**.
- Zugangsdaten aus LLMitMir landen nur dann in einer Sandbox, wenn ein Befehl sie über `{{cred:Name:feld}}` anfordert;
  Ausgaben werden wie überall nach Geheimnissen durchsucht und geschwärzt.

## Betrieb

| Was | Befehl (auf der VM als root) |
|---|---|
| Aktualisieren | den Installationsbefehl aus Schritt 2 noch einmal ausführen |
| Token anzeigen | `grep WERKBANK_TOKEN /opt/llmitmir-werkbank/werkbank/.env` |
| Log ansehen | `cd /opt/llmitmir-werkbank/werkbank && docker compose logs --tail 100` |
| Neu starten | `cd /opt/llmitmir-werkbank/werkbank && docker compose restart` |
| Laufende Sandboxen | `docker ps --filter label=llmitmir.werkbank=1` |
| Einstellungen ändern | `/opt/llmitmir-werkbank/werkbank/.env` bearbeiten, dann `docker compose up -d` |
| Entfernen | `cd /opt/llmitmir-werkbank/werkbank && docker compose down && docker rm -f $(docker ps -aq --filter label=llmitmir.werkbank=1); rm -rf /opt/llmitmir-werkbank` |

## Wenn etwas nicht klappt

- **„Verbindung testen“ schlägt fehl:** Läuft die VM? Stimmt die IP (`hostname -I` auf der VM)? Lässt eine Firewall Port 8787
  durch? Von einem anderen Rechner im Netz testen: `curl -H "Authorization: Bearer <Token>" http://<IP>:8787/v1/health`.
- **„401 Token fehlt oder falsch“:** Token in Home Assistant neu einfügen (ohne Leerzeichen am Anfang/Ende).
- **„sandbox_image_ready: false“:** Das Sandbox-Image fehlt – Installationsbefehl erneut ausführen.
- **Befehle brechen ab:** Speicher knapp? `SANDBOX_MEMORY` in `.env` erhöhen (und der VM mehr RAM geben).

---

## Für Fortgeschrittene

**Aufbau:** `werkbank/server.py` ist ein kleiner aiohttp-Dienst im Container `llmitmir-werkbank`. Er spricht über
`/var/run/docker.sock` mit Docker und startet je Sitzung (LLMitMir nutzt die Chat-ID) einen Container `lmwb-<id>` aus dem
Image `llmitmir-werkbank-sandbox` (Python 3.13, ffmpeg, Tesseract, Poppler, ImageMagick, Node.js, pandas, faster-whisper …),
Benutzer `agent` (UID 1000), Arbeitsordner `/workspace`, gemeinsamer Cache `/cache` (Volume `llmitmir-werkbank-cache` für
pip und Sprachmodelle).

**Einstellungen** (`werkbank/.env`): `WERKBANK_TOKEN`, `WERKBANK_PORT` (8787), `SANDBOX_MEMORY` (3g), `SANDBOX_CPUS` (2),
`SANDBOX_PIDS` (512), `SANDBOX_NETWORK` (bridge|none), `MAX_SESSIONS` (6), `IDLE_TIMEOUT` (7200 s), `MAX_EXEC_TIMEOUT`
(3600 s), `SANDBOX_IMAGE`, `TZ`.

**API** (alle mit `Authorization: Bearer <Token>`):

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/v1/health` | Version, Grenzen, Sandbox-Image bereit, laufende Sitzungen |
| POST | `/v1/sessions/{id}` | Sandbox anlegen bzw. fortsetzen |
| POST | `/v1/sessions/{id}/exec` | `{"cmd": "...", "timeout": 120, "workdir": "/workspace"}` → Exit-Code, stdout, stderr |
| GET / PUT | `/v1/sessions/{id}/files?path=…` | Datei holen / ablegen (unter `/workspace` oder `/tmp`) |
| GET | `/v1/sessions/{id}/list?path=…` | Ordner auflisten |
| DELETE | `/v1/sessions/{id}` | Sandbox entfernen |

**Mit Ansible/Compose verwalten:** Repository in einer festen Version auschecken, `werkbank/.env` aus einer Vorlage
erzeugen (Token aus dem Vault), `docker build -t llmitmir-werkbank-sandbox:latest werkbank/sandbox` und
`docker compose up -d --build` im Ordner `werkbank/` ausführen – genau das, was `install.sh` macht.
