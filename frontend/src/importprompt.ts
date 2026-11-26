// The prompt a user pastes into Claude to move skills, credentials, scheduled tasks, projects and memory to LLMitMir.
// i18n-ok-file
// One text per language of the interface; the JSON keys stay the same.
import { lang } from "./i18n";

export function claudeImportPrompt(url: string): string {
  return lang() === "de" ? promptDe(url) : promptEn(url);
}

function promptDe(url: string): string {
  return `Bitte übertrage meine Inhalte aus diesem Claude-Konto nach „LLMitMir“ in meinem Home Assistant.
Ziel-URL (Einmal-Link, 24 h gültig, nimmt genau ein JSON per HTTP-POST entgegen):
${url}

Sammle alles, worauf du mit deinen Werkzeugen zugreifen kannst, und baue daraus EIN JSON-Objekt nach diesem Schema:

{
  "source": "claude",
  "memory": "<alles, was du dauerhaft über mich weißt: Erinnerungen, persönliche Einstellungen, Vorlieben, Hinweise aus Memory-Dateien – als Fließtext oder Stichpunkte>",
  "credentials": [
    {"name": "<sprechender Name, eindeutig>", "type": "webdav|basic|bearer|header|telegram|imap|ews|gwdg|other",
     "fields": {"url": "...", "username": "...", "password": "...", "token": "...", "share_token": "...", "chat_ids": "..."},
     "services": ["<nur bei type gwdg (GWDG-Exchange, fields username = E-Mail-Adresse, login = Benutzerkennung und password) und type ews: mail, calendar und/oder contacts>"],
     "access": {"<nur bei type gwdg und ews, je Dienst>": "read|write"},
     "notes": "<wofür, Gültigkeit/Ablaufdatum, Hinweise>", "secret_fields": ["<nur bei type other: welche Felder geheim sind>"]}
  ],
  "skills": [
    {"name": "...", "description": "<die Beschreibung aus dem Frontmatter, wann der Skill gilt>",
     "body": "<vollständiger Inhalt der SKILL.md ohne Frontmatter, Geheimnisse ersetzt durch {{cred:<Name>:<feld>}}>",
     "credentials": ["<Namen der Zugänge, die der Skill nutzt>"],
     "files": [{"name": "<relativer Pfad, z. B. scripts/ha.py>", "content": "<Textinhalt>"}]}
  ],
  "projects": [
    {"name": "...", "description": "...", "instructions": "<Projektanweisungen>", "credentials": ["..."], "skills": ["..."],
     "files": [{"name": "...", "content": "<Text>"}]}
  ],
  "tasks": [
    {"name": "...", "prompt": "<vollständiger Auftrag der geplanten Aufgabe>",
     "schedule": {"type": "cron", "cron": "<5 Felder: Minute Stunde Tag Monat Wochentag, Ortszeit Europe/Berlin>"},
     "project": "<Projektname oder leer>", "allow_write": [], "note": "<Modell, Zeitzone, Besonderheiten>"}
  ]
}

So gehst du vor:
1. Skills: Liste alle Skills, die dir zur Verfügung stehen (auch eigene/synchronisierte). Lies jede SKILL.md vollständig und dazugehörige Textdateien (Skripte, Vorlagen; Binärdateien weglassen, je Datei höchstens 200 KB).
2. Zugangsdaten herauslösen: Alle URLs mit Benutzername/Passwort, App-Passwörter, API-Tokens, Bot-Tokens, Freigabe-Links mit Passwort usw. aus Skills, Projekten und Aufgaben werden je Dienst zu einem Eintrag in "credentials" (gleiche Zugangsdaten nur einmal). Im Text ersetzt du das Geheimnis durch {{cred:<Name>:<feld>}} und trägst den Namen in "credentials" des Skills/Projekts ein. Nichts weglassen – ich will die Zugangsdaten in LLMitMir separat sehen und verwalten.
3. Geplante Aufgaben: Liste alle geplanten Aufgaben/Routinen (z. B. über list_triggers bzw. RemoteTrigger „list“, alle Seiten mit next_cursor). Übernimm Name, vollständigen Prompt und Zeitplan; entferne ein „CRON_TZ=…“-Präfix und rechne den Zeitplan in Ortszeit Europe/Berlin um, falls er in UTC angegeben ist. Ersetze Geheimnisse wie in Schritt 2. Verweist eine Aufgabe auf Claude-spezifische Werkzeuge (z. B. Gmail-Connector, list_triggers), vermerke das in "note".
4. Projekte: Übernimm Projekte mit Anweisungen und Textdateien, soweit du darauf zugreifen kannst. Kommst du nicht heran, lass "projects" leer und sag es mir.
5. Erinnerungen: Fasse in "memory" zusammen, was du dauerhaft über mich weißt (Memory-Funktion, Memory-Dateien, CLAUDE.md, persönliche Präferenzen). Keine Inhalte einzelner Chats.
6. Sende das JSON per HTTP-POST an die Ziel-URL (Content-Type: application/json), z. B. mit curl:
   curl -sS -X POST -H 'Content-Type: application/json' --data-binary @llmitmir-import.json '${url}'
   Ist das JSON größer als 50 MB, teile es in mehrere POSTs mit denselben Schlüsseln auf (der Link nimmt dann nur den ersten an – in dem Fall schreibe mir die Datei stattdessen, siehe 7).
7. Hast du keinen Netzwerkzugriff oder schlägt der POST fehl: Speichere das JSON als Datei „llmitmir-import.json“ und gib sie mir zum Herunterladen; ich lade sie in LLMitMir unter Einstellungen → Import aus Claude hoch.
8. Antworte mir am Ende kurz: wie viele Skills, Zugänge, Aufgaben, Projekte übertragen wurden, was du nicht übertragen konntest und warum. Gib dabei KEINE Geheimnisse im Chat aus.

Hinweis: Chatverläufe kannst du nicht auslesen – die übernehme ich separat über den offiziellen Datenexport von claude.ai (Einstellungen → Datenschutz → Daten exportieren), den ich als ZIP in LLMitMir hochlade. Importierte Aufgaben sind in LLMitMir zunächst pausiert, damit ich sie prüfen kann.`;
}

function promptEn(url: string): string {
  return `Please transfer my content from this Claude account to “LLMitMir” in my Home Assistant.
Target URL (one-time link, valid for 24 h, accepts exactly one JSON via HTTP POST):
${url}

Collect everything you can access with your tools and build ONE JSON object from it following this schema:

{
  "source": "claude",
  "memory": "<everything you know about me permanently: memories, personal settings, preferences, notes from memory files – as prose or bullet points>",
  "credentials": [
    {"name": "<descriptive, unique name>", "type": "webdav|basic|bearer|header|telegram|imap|ews|gwdg|other",
     "fields": {"url": "...", "username": "...", "password": "...", "token": "...", "share_token": "...", "chat_ids": "..."},
     "services": ["<only for type gwdg (GWDG Exchange, fields username = email address, login = user ID and password) and type ews: mail, calendar and/or contacts>"],
     "access": {"<only for type gwdg and ews, per service>": "read|write"},
     "notes": "<what for, validity/expiry date, notes>", "secret_fields": ["<only for type other: which fields are secret>"]}
  ],
  "skills": [
    {"name": "...", "description": "<the description from the frontmatter, when the skill applies>",
     "body": "<full content of SKILL.md without frontmatter, secrets replaced by {{cred:<Name>:<field>}}>",
     "credentials": ["<names of the credentials the skill uses>"],
     "files": [{"name": "<relative path, e.g. scripts/ha.py>", "content": "<text content>"}]}
  ],
  "projects": [
    {"name": "...", "description": "...", "instructions": "<project instructions>", "credentials": ["..."], "skills": ["..."],
     "files": [{"name": "...", "content": "<text>"}]}
  ],
  "tasks": [
    {"name": "...", "prompt": "<full prompt of the scheduled task>",
     "schedule": {"type": "cron", "cron": "<5 fields: minute hour day month weekday, local time Europe/Berlin>"},
     "project": "<project name or empty>", "allow_write": [], "note": "<model, time zone, special notes>"}
  ]
}

How to proceed:
1. Skills: list all skills available to you (including your own/synced ones). Read every SKILL.md completely plus its text files (scripts, templates; leave out binary files, at most 200 KB per file).
2. Extract credentials: all URLs with user name/password, app passwords, API tokens, bot tokens, share links with passwords etc. from skills, projects and tasks become one entry per service in "credentials" (identical credentials only once). In the text, replace the secret with {{cred:<Name>:<field>}} and add the name to the skill's/project's "credentials". Leave nothing out – I want to see and manage the credentials separately in LLMitMir.
3. Scheduled tasks: list all scheduled tasks/routines (e.g. via list_triggers or RemoteTrigger “list”, all pages with next_cursor). Take over name, full prompt and schedule; remove a “CRON_TZ=…” prefix and convert the schedule to local time Europe/Berlin if it is given in UTC. Replace secrets as in step 2. If a task refers to Claude-specific tools (e.g. Gmail connector, list_triggers), note that in "note".
4. Projects: take over projects with instructions and text files as far as you can access them. If you can't, leave "projects" empty and tell me.
5. Memories: summarise in "memory" what you know about me permanently (memory feature, memory files, CLAUDE.md, personal preferences). No content of individual chats.
6. Send the JSON via HTTP POST to the target URL (Content-Type: application/json), e.g. with curl:
   curl -sS -X POST -H 'Content-Type: application/json' --data-binary @llmitmir-import.json '${url}'
   If the JSON is larger than 50 MB, split it into several POSTs with the same keys (the link then only accepts the first – in that case write me the file instead, see 7).
7. If you have no network access or the POST fails: save the JSON as a file “llmitmir-import.json” and give it to me to download; I'll upload it in LLMitMir under Settings → Import from Claude.
8. At the end, answer briefly: how many skills, credentials, tasks and projects were transferred, what you couldn't transfer and why. Do NOT output any secrets in the chat.

Note: you can't read chat histories – I'll take those over separately via the official claude.ai data export (Settings → Privacy → Export data), which I upload to LLMitMir as a ZIP. Imported tasks are paused in LLMitMir at first so I can check them.`;
}
