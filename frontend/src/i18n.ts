// German is the source language; English via lookup. t("…") returns the German text if no translation exists.
const EN: Record<string, string> = {
  "Neuer Chat": "New chat", "Neues Cowork": "New cowork", "Chats": "Chats", "Projekte": "Projects", "Geplant": "Scheduled",
  "Skills": "Skills", "Zugänge": "Credentials", "Einstellungen": "Settings", "Admin": "Admin", "Zuletzt": "Recents",
  "Angeheftet": "Pinned", "Guten Morgen": "Good morning", "Guten Tag": "Good afternoon", "Guten Abend": "Good evening",
  "Gute Nacht": "Good night", "Geplante Aufgaben": "Scheduled tasks", "Wie kann ich helfen?": "How can I help?", "Was soll ich erledigen?": "What should I get done?",
  "Nachricht schreiben …": "Write a message …", "Aufgabe beschreiben …": "Describe the task …", "Antworten …": "Reply …",
  "Senden": "Send", "Stopp": "Stop", "Anhängen": "Attach", "Spracheingabe": "Voice input", "Werkzeuge": "Tools",
  "Modell": "Model", "Kontext": "Context", "Heute": "Today", "Kontingent": "Quota", "Schlüssel": "Key",
  "Denkt nach …": "Thinking …", "Schreibt …": "Writing …", "Wartet auf Freigabe": "Waiting for approval",
  "Gedanken": "Thoughts", "Schritte": "Steps", "Fortschritt": "Progress", "Dateien": "Files",
  "Einmal erlauben": "Allow once", "Immer erlauben": "Always allow", "Ablehnen": "Deny", "Übernehmen": "Apply",
  "Für diesen Chat einschalten": "Turn on for this chat",
  "Kopieren": "Copy", "Kopiert": "Copied", "Erneut versuchen": "Retry", "Löschen": "Delete", "Umbenennen": "Rename",
  "Anheften": "Pin", "Lösen": "Unpin", "Speichern": "Save", "Abbrechen": "Cancel", "Schließen": "Close",
  "Gespeichert": "Saved", "Name": "Name", "Beschreibung": "Description", "Anweisungen": "Instructions",
  "Neues Projekt": "New project", "Neue Aufgabe": "New task", "Neuer Skill": "New skill", "Neuer Zugang": "New credential",
  "Jetzt ausführen": "Run now", "Aktiv": "Active", "Pausiert": "Paused", "Nächster Lauf": "Next run", "Letzter Lauf": "Last run",
  "Läufe": "Runs", "Auftrag": "Prompt", "Zeitplan": "Schedule", "Benachrichtigen": "Notify", "Typ": "Type",
  "Notiz": "Note", "Anzeigen": "Show", "Verbergen": "Hide", "Suchen …": "Search …", "Alle": "All",
  "Aufgabenläufe": "Task runs", "Keine Chats": "No chats", "Kein Zugriff": "No access", "Laden …": "Loading …",
  "Verbrauch": "Usage", "Importieren": "Import", "Persönliche Hinweise": "Personal notes",
  "Hört genau hin": "Listening closely", "Sortiert Silben": "Sorting syllables", "Fügt Wörter zusammen": "Piecing words together",
  "Entziffert Genuschel": "Deciphering mumbles", "Setzt Satzzeichen": "Adding punctuation", "Bringt es zu Papier": "Putting it on paper",
  "Chats auswählen": "Select chats", "{n} ausgewählt": "{n} selected", "Keine": "None",
  "Diesen Chat löschen?": "Delete this chat?", "{n} Chats löschen?": "Delete {n} chats?",
  "Chat gelöscht": "Chat deleted", "{n} Chats gelöscht": "{n} chats deleted",
  "Alle prüfen": "Check all", "Prüfe …": "Checking …", "Jetzt prüfen": "Check now",
  "Funktionieren die Zugangsdaten?": "Do the credentials work?", "Zugang funktioniert": "Credential works",
  "Zurücknehmen": "Take back", "Kommt als Nächstes dran": "Up next", "Wartet · {n}.": "Waiting · {n}.",
  "Jetzt senden": "Send now",
  "Senden – kommt nach der laufenden Antwort dran": "Send – goes out after the current answer",
  "Geplante Aufgabe": "Scheduled task", "Fertig": "Done", "Entfernen": "Remove", "Chat öffnen": "Open chat",
  "Alle {n} entfernen": "Remove all {n}", "Nur diese entfernen": "Remove just this one",
  "Benachrichtigungen dieses Chats ausschalten": "Turn off notifications for this chat",
  "Benachrichtigungen für diesen Chat aus": "Notifications for this chat are off",
  "In Projekt verschieben": "Move to project", "Ohne Projekt": "No project", "Chat verschieben": "Move chat",
  "Chat hierher ziehen": "Drag a chat here", "Nach „{p}“ verschoben": "Moved to “{p}”",
  "Aus dem Projekt entfernt": "Removed from the project", "Noch keine Projekte angelegt.": "No projects yet.",
  // Sprachgespräch
  "Sprechen": "Talk", "Gespräch beginnen": "Start talking", "Gespräch fortsetzen": "Continue talking", "Gespräch beenden": "End conversation",
  "Letztes Gespräch fortsetzen": "Continue last conversation", "Im Chat ansehen": "View in chat", "Einen Moment": "One moment",
  "Hallo! Worüber möchtest du sprechen?": "Hello! What would you like to talk about?",
  "Ich höre zu": "I'm listening", "Ich höre zu – sprich einfach los": "I'm listening – just start talking", "Ich verstehe": "Getting that",
  "Ich denke nach": "Thinking", "Gerade ist viel los – einen Moment": "It's busy right now – one moment",
  "Pause – tippe auf das Mikrofon, wenn es weitergehen soll": "Paused – tap the microphone to continue",
  "Ich warte auf deine Bestätigung": "Waiting for your confirmation",
  "Dafür brauche ich kurz deine Bestätigung auf dem Bildschirm.": "I need your confirmation on the screen for that.",
  "Das hat gerade leider nicht geklappt.": "Sorry, that didn't work just now.",
  "Ich suche im Internet …": "Searching the web …", "Ich schaue im Zuhause nach …": "Checking your home …",
  "Ich schaue in deiner Nextcloud nach …": "Checking your Nextcloud …", "Ich schaue in deinen Kalender …": "Checking your calendar …",
  "Ich schaue in dein Postfach …": "Checking your mailbox …", "Ich frage einen Dienst ab …": "Querying a service …",
  "Ich lese Dateien …": "Reading files …", "Ich lese eine Anleitung …": "Reading instructions …", "Ich rechne …": "Calculating …",
  "Ich schicke eine Nachricht …": "Sending a message …", "Ich schaue in LLMitMir nach …": "Checking LLMitMir …", "Ich schaue nach …": "Looking it up …",
  "Antwort unterbrechen": "Interrupt the answer", "Mikrofon einschalten": "Turn microphone on", "Mikrofon aus (Pause)": "Microphone off (pause)",
  "Tippen unterbricht die Antwort": "Tap to interrupt the answer", "Der Roboter von LLMitMir": "The LLMitMir robot",
  "Stimme": "Voice", "Automatisch": "Automatic", "Stimme des Browsers": "Browser voice", "nur Text": "text only", "Ohne Stimme (nur Text)": "No voice (text only)",
  "LLMitMir-Stimme": "LLMitMir voice", "Roboterstimme": "Robot voice", "Stimme anhören": "Listen to the voice",
  "Hallo! Ich bin LLMitMir. So klinge ich.": "Hello! I'm LLMitMir. This is how I sound.",
  "„Automatisch“ nimmt die Roboterstimme – sie klingt auf jedem Gerät gleich. Zur Wahl stehen außerdem die LLMitMir-Stimme (tiefer, ohne Maschinenklang) und eine natürliche weibliche Stimme.":
    "“Automatic” uses the robot voice – it sounds the same on every device. You can also pick the LLMitMir voice (deeper, no machine effect) or a natural female voice.",
  "Weibliche Stimme": "Female voice",
  "Die Stimme des Roboters ist nicht eingerichtet; es liest die Sprachausgabe von Home Assistant oder der Browser.":
    "The robot's voice is not set up; Home Assistant's text-to-speech or the browser will read instead.",
  "Schöner klingt es mit einer Sprachausgabe in Home Assistant (z. B. Piper oder Home Assistant Cloud) – LLMitMir nutzt sie dann von selbst.":
    "It sounds nicer with a text-to-speech engine in Home Assistant (e.g. Piper or Home Assistant Cloud) – LLMitMir then uses it automatically.",
  "„Automatisch“ nimmt die Stimme deines Sprachassistenten in Home Assistant.": "“Automatic” uses the voice of your Home Assistant voice assistant.",
  "Wie lange darf eine Sprechpause sein?": "How long may a pause in speech be?", "Kurz – antwortet schnell": "Short – answers quickly",
  "Normal": "Normal", "Lang – lässt Zeit zum Überlegen": "Long – leaves time to think",
  "Dazwischenreden unterbricht die Antwort": "Speaking interrupts the answer",
  "Am besten mit Kopfhörern – sonst hört LLMitMir sich womöglich selbst. Tippen auf den Roboter unterbricht immer.":
    "Best with headphones – otherwise LLMitMir may hear itself. Tapping the robot always interrupts.",
  "Gesprochenes als Text mitlesen": "Show what is said as text",
  "Gilt ab der nächsten Nachricht. Kostenpflichtige Modelle sind mit € markiert.": "Applies from the next message. Paid models are marked with €.",
  "Beim Anbieter ist kein Modell für die Spracherkennung eingetragen – deshalb hört der Browser zu.":
    "No speech recognition model is configured at the provider – so the browser listens instead.",
  "Das Mikrofon ist gesperrt. Bitte erlaube den Zugriff in den Einstellungen des Browsers oder der App.":
    "The microphone is blocked. Please allow access in the browser or app settings.",
  "Kein Mikrofon gefunden.": "No microphone found.", "Chat nicht gefunden": "Chat not found",
  "Dieser Browser kann hier keinen Ton aufnehmen oder abspielen.": "This browser cannot record or play sound here.",
  "Für die Spracherkennung ist beim Anbieter kein Modell eingetragen, und dieser Browser hat keine eigene.":
    "No speech recognition model is configured at the provider, and this browser has none of its own.",
};

let lang = "de";
export function setLang(l: string) { lang = (l || "de").slice(0, 2); }
export function t(s: string, p?: Record<string, any>): string {
  let out = lang === "de" ? s : (EN[s] ?? s);
  if (p) for (const [k, v] of Object.entries(p)) out = out.replace(`{${k}}`, String(v));
  return out;
}
export const isDe = () => lang === "de";
