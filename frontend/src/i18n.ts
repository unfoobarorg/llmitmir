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
};

let lang = "de";
export function setLang(l: string) { lang = (l || "de").slice(0, 2); }
export function t(s: string, p?: Record<string, any>): string {
  let out = lang === "de" ? s : (EN[s] ?? s);
  if (p) for (const [k, v] of Object.entries(p)) out = out.replace(`{${k}}`, String(v));
  return out;
}
export const isDe = () => lang === "de";
