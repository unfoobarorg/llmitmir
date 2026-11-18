# Werkzeuge

*Was die Modelle in Chats, Coworks und geplanten Aufgaben benutzen können. Zurück zur [README](../README.md).*

| Gruppe | Werkzeuge |
|---|---|
| Web | `web_search` (DuckDuckGo oder SearXNG), `web_fetch` (Seiten, PDFs, Bilder) |
| Home Assistant | `ha_states`, `ha_history`, `ha_service`*, `ha_ws` (Websocket-Befehle, lesend frei, sonst*) – mit den Rechten der Person |
| Nextcloud / WebDAV | `dav_list`, `dav_read`, `dav_write`*, `dav_request` (PROPFIND/REPORT frei, sonst*), `caldav_events`, `caldav_entry` (Termin über UID lesen; ändern/löschen*), `caldav_changes` (nur Änderungen seit dem letzten Abruf) |
| Exchange (EWS) | `ews_events`, `ews_contacts`, `ews_save`* |
| E-Mail (Exchange über EWS, sonst IMAP/SMTP) | `mail_folders`, `mail_list`, `mail_read` (markiert nichts als gelesen), `mail_send`*, `mail_change`* (gelesen/markiert, verschieben, in den Papierkorb) |
| HTTP | `http_request` (GET frei, sonst*; Zugänge nur an ihre Server, sonst Rückfrage) |
| Dateien | `file_list`, `file_read` (Textebene oder Bildmodell), `file_write` |
| Sonstiges | `notify`*, `skill_load`, `skill_file`, `progress_update`, `credentials_list`; in geplanten Aufgaben `task_result` (was die Benachrichtigung meldet) |
| LLMitMir (immer an) | `llmitmir_info`, `dashboard_list`, `dashboard_get`; mit Bestätigung jeder einzelnen Änderung: `skill_save`, `skill_delete`, `task_save`, `task_delete`, `credential_save`, `credential_delete`, `dashboard_save`, `dashboard_delete`, `tile_save`, `tile_delete`; `dashboard_update`* (im Kachel-Lauf ohne Rückfrage, nur in die eigene Kachel) |
| Werkbank (optional) | `shell`*, `werkbank_files`, `werkbank_fetch`, `werkbank_push` |
| Teilaufgaben | `unterchat_starten`, `unterchat_nachricht`, `unterchat_ergebnis` (nicht in Teilaufgaben und geplanten Aufgaben); in einer Teilaufgabe `ergebnis_melden` |

\* schreibend – braucht eine Freigabe (bei geplanten Aufgaben beim Anlegen festgelegt).

Zugangsdaten setzt LLMitMir serverseitig ein (`zugang` oder `{{cred:Name:feld}}`) und schwärzt sie in jedem Ergebnis.
Ein Zugang geht nur an seine Server; für einen anderen fragt LLMitMir vorher, geplante Aufgaben lehnen ab.
