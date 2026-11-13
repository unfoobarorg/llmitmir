// The prompt a user pastes into Claude to move skills, credentials, scheduled tasks, projects and memory to LLMitMir.
export function claudeImportPrompt(url: string): string {
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
     "services": ["<nur bei type gwdg (GWDG-Exchange, fields nur username = GWDG-E-Mail und password): mail, calendar und/oder contacts>"],
     "access": {"<nur bei type gwdg, je Dienst>": "read|write"},
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
7. Hast du keinen Netzwerkzugriff oder schlägt der POST fehl: Speichere das JSON als Datei „llmitmir-import.json“ und gib sie mir zum Herunterladen; ich lade sie in LLMitMir unter Einstellungen → Import hoch.
8. Antworte mir am Ende kurz: wie viele Skills, Zugänge, Aufgaben, Projekte übertragen wurden, was du nicht übertragen konntest und warum. Gib dabei KEINE Geheimnisse im Chat aus.

Hinweis: Chatverläufe kannst du nicht auslesen – die übernehme ich separat über den offiziellen Datenexport von claude.ai (Einstellungen → Datenschutz → Daten exportieren), den ich als ZIP in LLMitMir hochlade. Importierte Aufgaben sind in LLMitMir zunächst pausiert, damit ich sie prüfen kann.`;
}
