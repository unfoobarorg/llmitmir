# LLMitMir

**[Deutsch](#deutsch)** · **[English](#english)**

Ein Assistent nach dem Vorbild der Claude-Desktop-App – direkt in Home Assistant, mit Open-Weight-Modellen über jeden
OpenAI-kompatiblen Anbieter (Voreinstellung: [SAIA](https://docs.hpc.gwdg.de/services/saia/) der GWDG / KISSKI).
*An assistant modelled on the Claude desktop app – right inside Home Assistant, with open-weight models from any
OpenAI-compatible provider (preset: GWDG / KISSKI SAIA).*

---

## Deutsch

### Was LLMitMir kann

- **Chats** mit Streaming, Anhängen (Bilder, PDF, Word, Excel, Tonaufnahmen) und Spracheingabe
- **Coworks**: Das Modell erledigt Aufgaben selbstständig mit Werkzeugen – Web, Home Assistant, Nextcloud/CalDAV,
  Exchange, E-Mail, HTTP-APIs, Dateien. Was etwas verändert, braucht eine Freigabe.
- **Sprachgespräch** mit einem 3D-Roboter, freihändig – etwa im Auto oder am Tablet
- **Geplante Aufgaben**, gebaut für langsame, ausgelastete Modelle; teilbar mit anderen Personen
- **Dashboards** aus Kacheln – Daten live aus Home Assistant oder aus geplanten Läufen
- **Projekte, Skills, Teilaufgaben** und eine Lebensdauer für Chats
- **Deutsch oder Englisch**: Sprache je Person wählbar (*Einstellungen → Allgemein → Sprache*), „Automatisch“ folgt Home Assistant
- **Mehrere Personen** mit getrennten Daten, Schlüsseln und Kontingenten; einfache Ansicht für Laien, Expertenansicht
- **Kontrolle für Admins:** Zugriffsprotokoll mit Monitoring (Agenten anhalten, Freigaben entziehen, Export an Webhook
  oder Syslog), **Konnektoren** mit Datenregeln und **MCP-Servern**, zentrale Skills und Skill-Richtlinien,
  Wartungsmodus vor Neustarts, optional Nutzerverwaltung mit **Active Directory / LDAP**
- **Optional:** externe Claude-Modelle als kostenpflichtiger Notfall und die **Werkbank** für Programme in Sandboxen

Alles im Detail: [docs/FUNKTIONEN.md](docs/FUNKTIONEN.md) · Werkzeuge: [docs/WERKZEUGE.md](docs/WERKZEUGE.md)

### Installation

1. **Über HACS** (direkt aus Home Assistant): Das Repository wird nach
   [github.com/unfoobarorg/llmitmir](https://github.com/unfoobarorg/llmitmir) gespiegelt.
   [In HACS öffnen](https://my.home-assistant.io/redirect/hacs_repository/?owner=unfoobarorg&repository=llmitmir&category=integration)
   oder in HACS *⋮ → Benutzerdefinierte Repositories* diese Adresse mit Typ *Integration* hinzufügen, dann
   *LLMitMir* herunterladen und Home Assistant neu starten.
   *Manuell:* den Ordner `custom_components/llmitmir` nach `<config>/custom_components/` kopieren und neu starten.
2. *Einstellungen → Geräte & Dienste → Integration hinzufügen → LLMitMir*: Anbieter und Schlüsselmodus wählen.
3. In der Seitenleiste *LLMitMir → Admin*: Personen freigeben, Schlüssel, Modelle und Kontingente einstellen.

Voraussetzung: Home Assistant **2025.1** oder neuer. Python-Pakete (werden automatisch installiert): `pypdfium2`,
`anthropic`, `edge-tts`, `pillow`, `ldap3`.

### Datenschutz und Sicherheit

- **Daten bleiben in Home Assistant** – je Person unter `<config>/.storage/llmitmir/`, Teil normaler Backups.
  Zugangsdaten und Schlüssel liegen dort wie bei anderen Integrationen unverschlüsselt (nur für Home Assistant lesbar).
- **Nach außen geht** nur: Nachrichten an den gewählten Anbieter; Suchanfragen an DuckDuckGo oder ein eigenes SearXNG;
  vorgelesene Antworten an den Vorlesedienst von Microsoft Edge (abschaltbar unter *Admin → Weitere Dienste → Sprachausgabe*);
  Anfragen an externe Modelle (Claude oder Modelle, die der Hauptanbieter als extern kennzeichnet) nur, wenn der Admin
  sie freigibt und die Person zustimmt.
- **Das Modell sieht nie ein Geheimnis.** Zugänge gehen nur an ihre eigenen Server; für jeden anderen fragt LLMitMir
  (Übersicht: *Einstellungen → Datenschutz & Freigaben → Erlaubte Server*). Jeder Zugang braucht in jedem Chat die
  Freigabe der Person; zentrale Systemzugänge sind ohne Erlaubnis des Admins gesperrt.
- **Interne Daten bleiben intern:** Ein Chat, der Daten aus einem nur intern freigegebenen Zugang gelesen hat, nimmt
  kein externes Modell mehr an. Datenregeln je Konnektor sperren Inhalte, bevor ein Werkzeug sie abruft.
- **Nachvollziehbar:** Das Zugriffsprotokoll hält fest, welcher Agent mit welchem Zugang worauf zugegriffen hat – nur
  Metadaten, nie Inhalte; sichtbar nur für Admins (*Admin → Monitoring*).
- **Nichts geschieht ungefragt:** Schreibende Aktionen brauchen eine Freigabe, geplante Aufgaben dürfen nur, was beim
  Anlegen erlaubt wurde. Ändert jemand eine geteilte Aufgabe, läuft sie erst nach Bestätigung der Eigentümerin oder
  des Eigentümers. Home-Assistant-Werkzeuge laufen mit den Rechten der Person.
- **Antworten laden keine fremden Inhalte nach** – externe Bilder erscheinen als Link.

### Werkbank (optional)

Mit der Werkbank führen die Modelle Programme aus (Python, pandas, Office/PDF, Whisper, ffmpeg …) – auf einer eigenen VM,
für jeden Chat in einer eigenen Sandbox, die nur ins Internet darf, nicht ins Heimnetz:

```bash
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | sudo bash
```

Anleitung, Sicherheit und Betrieb: [docs/WERKBANK.md](docs/WERKBANK.md)

### Entwicklung

Entwickelt wird auf [git.unfoobar.org/ha-integrations/llmitmir](https://git.unfoobar.org/ha-integrations/llmitmir);
GitHub ist ein Spiegel. Bauen, Tests, CI und Aufbau: [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md) ·
Änderungen: [CHANGELOG.md](CHANGELOG.md) · Lizenz: [MIT](LICENSE)

---

## English

### What LLMitMir does

- **Chats** with streaming, attachments (images, PDF, Word, Excel, audio recordings) and voice input
- **Coworks**: the model works through tasks on its own with tools – web, Home Assistant, Nextcloud/CalDAV, Exchange,
  e-mail, HTTP APIs, files. Anything that changes something needs approval.
- **Talk mode** with a 3D robot, hands-free – in the car or on a tablet
- **Scheduled tasks**, built for slow, busy models; shareable with other people
- **Dashboards** made of tiles – data live from Home Assistant or from scheduled runs
- **Projects, skills, subtasks** and an optional lifetime for chats
- **German or English**: language per person (*Settings → General → Language*), “Automatic” follows Home Assistant
- **Several people** with separate data, keys and quotas; a simple view for non-technical users and an expert view
- **Control for admins:** access log with monitoring (stop agents, revoke approvals, export to webhook or syslog),
  **connectors** with data rules and **MCP servers**, central skills and skill policies, maintenance mode before
  restarts, optional user management with **Active Directory / LDAP**
- **Optional:** external Claude models as a paid fallback and the **Werkbank** (workbench) for running programs in sandboxes

All details (German): [docs/FUNKTIONEN.md](docs/FUNKTIONEN.md) · Tools: [docs/WERKZEUGE.md](docs/WERKZEUGE.md)

### Installation

1. **Via HACS** (right from Home Assistant): the repository is mirrored to
   [github.com/unfoobarorg/llmitmir](https://github.com/unfoobarorg/llmitmir).
   [Open in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=unfoobarorg&repository=llmitmir&category=integration)
   or add this address in HACS under *⋮ → Custom repositories* with type *Integration*, then download *LLMitMir* and
   restart Home Assistant.
   *Manually:* copy the folder `custom_components/llmitmir` to `<config>/custom_components/` and restart.
2. *Settings → Devices & services → Add integration → LLMitMir*: choose the provider and the key mode.
3. In the sidebar, *LLMitMir → Admin*: allow people, set keys, models and quotas.

Requires Home Assistant **2025.1** or newer. Python packages (installed automatically): `pypdfium2`, `anthropic`,
`edge-tts`, `pillow`, `ldap3`.

### Privacy and security

- **Data stays in Home Assistant** – per person under `<config>/.storage/llmitmir/`, included in normal backups.
  Credentials and keys are stored unencrypted there, like with other integrations (readable by Home Assistant only).
- **What leaves:** messages to the chosen provider; search queries to DuckDuckGo or your own SearXNG; answers read aloud
  to Microsoft Edge's read-aloud service (can be switched off under *Admin → Other services → Speech output*); requests to external
  models (Claude, or models the main provider marks as external) only if the admin releases them and the person agrees.
- **The model never sees a secret.** Credentials only go to their own servers; for any other server LLMitMir asks first
  (overview: *Settings → Privacy & approvals → Allowed servers*). Every credential needs the person's approval in every
  chat; central system credentials stay locked unless the admin allows them.
- **Internal data stays internal:** a chat that has read data from a credential released for internal models only no
  longer accepts an external model. Data rules per connector block content before a tool fetches it.
- **Traceable:** the access log records which agent used which credential to access what – metadata only, never
  content; visible to admins only (*Admin → Monitoring*).
- **Nothing happens unasked:** actions that change something need approval, scheduled tasks may only do what was
  allowed when they were created. If someone changes a shared task, it only runs again once its owner approves.
  Home Assistant tools run with the person's own permissions.
- **Answers never load third-party content by themselves** – external images show up as links.

### Werkbank (optional)

With the Werkbank, models run programs (Python, pandas, Office/PDF, Whisper, ffmpeg …) – on a separate VM, in a sandbox
per chat that may reach the internet but not your home network:

```bash
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | sudo bash
```

Guide, security and operation (German): [docs/WERKBANK.md](docs/WERKBANK.md)

### Development

Development happens on [git.unfoobar.org/ha-integrations/llmitmir](https://git.unfoobar.org/ha-integrations/llmitmir);
GitHub is a mirror. Build, tests, CI and architecture (German): [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md) ·
Changes: [CHANGELOG.md](CHANGELOG.md) · License: [MIT](LICENSE)
