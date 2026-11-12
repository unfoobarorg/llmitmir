# LLMitMir

**Chats, Coworks, geplante Aufgaben, Projekte und Skills mit Open-Weight-Modellen – direkt in Home Assistant.**
Eine Oberfläche nach dem Vorbild der Claude-Desktop-App, die mit jedem OpenAI-kompatiblen Anbieter funktioniert
(Voreinstellung: [SAIA](https://docs.hpc.gwdg.de/services/saia/) der GWDG / KISSKI).

*English summary below.*

## Funktionen

- **Einfache Ansicht und Expertenansicht**: Standard ist die einfache Ansicht für technische Laien – der Chat zeigt wie ein
  Messenger nur Nachricht und Antwort mit Warte-Animation, Modelle werden nie angezeigt und immer automatisch gewählt
  (auch bei Überlastung wechselt LLMitMir selbst), die Modelle antworten verständlich und ohne Fachbegriffe, und Skills,
  geplante Aufgaben, Zugänge und Projekte sind erklärt und lassen sich im Chat einrichten. Die Expertenansicht (alles
  Folgende) schaltet jede Person unter *Einstellungen → Ansicht* frei; Admins legen unter *Admin → Ansicht* für alle oder
  je Person fest, ob sie selbst wählen darf oder immer eine bestimmte Ansicht bekommt.
- **Chats** mit Streaming, sichtbaren Gedanken der Modelle, Markdown, Anhängen (Bilder, PDFs, Texte) und **Spracheingabe**
  (über `/audio/transcriptions` des Anbieters, Fallback Browser-Spracherkennung). Stehen in der Seitenleiste mehr als
  zehn Chats, bietet sie *Chats auswählen* an: mehrere Chats markieren (einzeln oder alle) und in einem Zug löschen.
- **Entwurf je Chat**: Was halb getippt ist und welche Dateien schon angehängt sind, bleibt beim Wechsel in einen anderen
  Chat erhalten und steht beim Zurückkommen wieder da (im Browser, nicht über ein Neuladen der Seite hinweg).
- **Ungelesen-Punkt**: Hat ein Chat ein neues Ergebnis bekommen, seit er zuletzt offen war, steht in der Seitenleiste ein
  Punkt neben dem Titel – auch bei Läufen geplanter Aufgaben. Öffnen nimmt ihn weg.
- **Weiterschreiben während einer Antwort** (wie bei Claude): Läuft schon eine Antwort, lässt sich die nächste Nachricht
  trotzdem abschicken – mit Enter oder dem Senden-Knopf. Sie erscheint blass unter der laufenden Antwort („Kommt als
  Nächstes dran“) und wird beantwortet, sobald der laufende Schritt fertig ist; das Modell sieht sie nicht mitten im Lauf.
  Mehrere Nachrichten stellen sich der Reihe nach an, ein ✕ nimmt eine wieder zurück. Der Knopf ist nur noch dann
  *Stopp*, wenn das Eingabefeld leer ist.
- **Coworks**: Das Modell arbeitet eine Aufgabe selbstständig mit Werkzeugen ab, zeigt Plan, Schritte und Ergebnisdateien.
  Schreibende Aktionen fragen nach („Einmal erlauben“, „Immer erlauben“, „Ablehnen“, „Ohne sie weitermachen“). Braucht das Modell ein Werkzeug,
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
- **Aufgaben teilen**: Eine Aufgabe gehört der Person, die sie anlegt. Sie lässt sich mit anderen Personen der
  HA-Instanz teilen – je Person einstellbar, ob sie die Aufgabe nur sieht, sie auch ändern und starten darf und ob sie
  bei jedem Lauf eine Nachricht aufs eigene Gerät bekommt. Geteilte Aufgaben stehen bei allen unter *Geplant* mit dem
  Namen der Besitzerperson; löschen und weitergeben kann sie nur die Besitzerperson, Läufe laufen immer auf deren
  Schlüssel, Kontingent und Freigaben.
- **Passendes Modell, auch unter Last**: LLMitMir lädt die Modellliste alle drei Minuten neu – bei SAIA mit Auslastung
  (`demand`) und Veröffentlichungsdatum, der Abruf zählt nicht zum Limit. „Standard“ wählt für Chat, Cowork/Aufgaben und
  Bildlesen das am besten geeignete Modell, das gerade nicht überlastet ist; neu erscheinende Modelle werden automatisch
  freigegeben und anhand ihrer Vorgänger eingeschätzt (`models.py`), zurückgezogene ersetzt. Das Modellmenü zeigt die
  Auslastung als Punkt. Vor dem Senden an ein stark ausgelastetes Modell und wenn ein Modell 20 s lang nichts liefert,
  schlägt der Chat ein freies, ähnlich gutes vor – der Wechsel geht mitten im Lauf und macht beim aktuellen Schritt
  weiter. Geplante Aufgaben mit Standardmodell wechseln nach drei Minuten ohne Antwort selbst. „Stopp“ greift auch,
  während ein Modell hängt.
- **Projekte**: Anweisungen, Dateien, Zugänge, Skills, Modelle und Freigaben als Kontext für Chats, Coworks und Aufgaben.
- **Lebensdauer**: Chats und Coworks können sich nach einer Frist selbst löschen – je Projekt eine eigene Frist, für
  alles außerhalb eines Projekts eine Frist in den Einstellungen der Person. Standardmäßig ist das aus; wer es
  einschaltet, bekommt 30 Tage vorgeschlagen, jede andere Zahl (bis 3650) geht auch. Gezählt ab der letzten Benutzung,
  geprüft stündlich und beim Start; gelöscht werden Chat, Anhänge, Arbeitsbereich und Sandbox. Angeheftete Chats und
  die Läufe geplanter Aufgaben bleiben.
- **Skills** im Format von `SKILL.md` (Name, Beschreibung, Anleitung, Dateien) – das Modell lädt sie bei Bedarf.
- **Zugänge** getrennt von Skills: Das Modell sieht **nie** ein Geheimnis; Werkzeuge setzen Passwörter und Tokens
  serverseitig ein (`zugang`-Parameter oder Platzhalter `{{cred:Name:feld}}`), Ergebnisse werden geschwärzt.
- **GWDG-Exchange als eigener Zugangstyp** (unten in der Typ-Liste), gebaut wie in calmerge: GWDG-E-Mail-Adresse und
  Passwort eintragen (ohne @ wird `@gwdg.de` ergänzt) und anhaken, wofür der Zugang gilt – **E-Mail-Postfach, Kalender
  und/oder Kontakte**. Die Adressen ergänzt LLMitMir selbst: DavMail `https://davmail.gwdg.de:1080/users/<E-Mail>/calendar/`
  bzw. `…/contacts/`, IMAP `email.gwdg.de:993`, SMTP `email.gwdg.de:587`. `caldav_events` holt den Kalender wie calmerge
  per GET und filtert den Zeitraum selbst; `dav_request` arbeitet relativ zum DavMail-Konto und nur in den angehakten
  Ordnern; das Postfach mit den `mail_*`-Werkzeugen. Geprüft wird jeder angehakte Dienst einzeln.
  **Je Dienst „nur lesen“ (Standard) oder „lesen und schreiben“**, durchgesetzt auf dem Server: Bei „nur lesen“ öffnen
  die Mail-Werkzeuge Ordner nur mit IMAP-EXAMINE und holen Nachrichten mit BODY.PEEK, `mail_send`/`mail_change` brechen
  vor der Verbindung ab, und `dav_request` lehnt PUT, DELETE, MOVE, COPY, PROPPATCH usw. (auch das Ziel von MOVE/COPY)
  ab. Damit sich das nicht umgehen lässt, gibt LLMitMir das Passwort eines GWDG-Zugangs nie heraus: kein Platzhalter
  `{{cred:…:password}}` (Werkbank, HTTP, DAV) und kein `http_request` mit diesem Zugang.
  Ältere WebDAV-Zugänge mit DavMail-URL behandelt LLMitMir als GWDG-Kalender.
- **Zugänge werden geprüft**: Nach dem Speichern, auf Knopfdruck (einzeln oder „Alle prüfen“) und automatisch, wenn ein
  Werkzeug mit abgelehnter Anmeldung scheitert, meldet sich LLMitMir mit einer harmlosen Leseanfrage an (PROPFIND bei
  WebDAV, GET bei HTTP-APIs, `getMe` bei Telegram, LOGIN bei IMAP). Schlägt das fehl, steht der Zugang in der Liste rot
  mit der Meldung, ein Warnbanner nennt die betroffenen Namen, und das Modell bekommt den Fehler genannt, statt es
  weiter zu versuchen (`credcheck.py`). Beim Postfach nennt die Meldung die Stufe, an der es hängt (DNS, Port, TLS oder
  Anmeldung), statt nur „TimeoutError“; ist Port 993 gesperrt, versucht LLMitMir 143 mit STARTTLS – beim Prüfen wie
  beim Abrufen der Mails.
- **Verbrauch und Limits**: Kontextfüllung je Chat, Tokens und Anfragen je Tag, **diese Woche (ab Montag) und diesen
  Monat (ab dem Ersten)**, persönliche Kontingente und die Rate-Limits des Schlüssels (`x-ratelimit-*`-Header) als
  Füllanzeige.
- **Ablaufdatum bei Zugängen** (optional): LLMitMir warnt zwei Wochen vorher in der Liste und nennt den Grund, wenn ein
  Werkzeug scheitert, weil der Token abgelaufen ist. Ohne Ablaufdatum ändert sich nichts.
- **Freigaben ohne Warten**: Bleibt eine Freigabe unbeantwortet, lässt sich einstellen, dass LLMitMir nach 5, 15 oder 60
  Minuten *ohne diese Aktion weitermacht* – sie auslässt, den Rest erledigt und im Ergebnis nennt, was fehlt.
- **Benachrichtigungen an das eigene Gerät**: Welches Handy eine Push-Nachricht bekommt, ist keine freie Auswahl mehr.
  Home Assistant weiß, welche Person die App auf einem Gerät eingerichtet hat; jede Person wählt in den Einstellungen nur
  noch unter **ihren eigenen Geräten** (mit ihren lesbaren Namen, nie mit Kennungen). Unter *Admin → Benachrichtigungsgeräte*
  sieht der Admin, welches Gerät mit welcher Person verknüpft ist, und kann es korrigieren.
- **Mehrere Personen**: Alles ist pro HA-Nutzer*in getrennt. Admins legen fest, wer LLMitMir nutzen darf, und wählen,
  ob es **einen gemeinsamen Schlüssel**, **einen Schlüssel je Person (vom Admin eingetragen)** oder **eigene Schlüssel** gibt.
- **Eigener Schlüssel für geplante Aufgaben** (optional), damit Aufgaben nicht das Kontingent für spontane Chats aufbrauchen:
  zentral vom Admin für alle oder von jeder Person selbst gewählt (ein Schlüssel für alles, eigener Aufgaben-Schlüssel oder
  zentraler Aufgaben-Schlüssel). Unter *Geplant* steht, wie viele Anfragen und Tokens alle Aufgaben auf diesem Schlüssel je Tag
  verbrauchen; Läufe auf einem eigenen Aufgaben-Schlüssel zählen nicht zum persönlichen Tageskontingent.
- **Externe Modelle als Notfall (optional, kostenpflichtig)**: Claude über eine eigene **Microsoft-Foundry-Ressource** (Azure) und/oder
  einen **Anthropic-API-Schlüssel**. Die verfügbaren Modelle fragt LLMitMir mit dem Schlüssel selbst ab (Foundry: jedes bekannte
  Claude-Modell und eigene Deployment-Namen per kostenloser Token-Zählung). Der Admin bringt die Anbieter in eine **Reihenfolge**
  und stellt je Anbieter ein, ob seine Modelle **immer** oder **nur im Notfall** wählbar sind – „Notfall“ heißt: alle eingeschalteten
  Anbieter davor sind für die Person gerade nicht nutzbar (Limit erreicht, Schlüssel abgelehnt, Monatslimit verbraucht). Externe
  Modelle wählt LLMitMir **nie von selbst**: nur im Modellmenü (vom günstigsten zum teuersten sortiert), über ein Ersatz-Angebot im
  Chat, wenn der Hauptanbieter ausfällt, oder bei geplanten Aufgaben mit „Im Notfall auf externe Modelle ausweichen“. Vor der ersten
  Nutzung erklärt ein Dialog verständlich, was dorthin geht und dass keine sensiblen Daten eingegeben werden sollen.
  **Zugänge** sind für externe Modelle gesperrt, bis die Person sie einzeln freigibt (gesperrte Zugänge und ihre Ergebnisse sieht das
  Modell gar nicht), Passwörter gehen nie hinaus (jede Anfrage wird zusätzlich geschwärzt), **Projekte** lassen sich ganz sperren.
  **Abrechnung**: Jede Anfrage wird dauerhaft mit Tokens und Euro-Kosten je Person und Modell gebucht (Anthropic-Listenpreise mit
  einstellbarem Dollarkurs oder eigene Preise); der Admin setzt je Person ein **Monatslimit in Euro** und sieht die Kosten aller Personen
  über die letzten zwölf Monate. Claude wird mit adaptivem Denken, Prompt-Caching und unverändert zurückgespielten Denkblöcken genutzt.
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
| E-Mail (IMAP/SMTP, GWDG-Exchange) | `mail_folders`, `mail_list`, `mail_read` (öffnet mit EXAMINE, markiert nichts als gelesen), `mail_send`*, `mail_change`* (gelesen/markiert, verschieben, in den Papierkorb) |
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

Voraussetzung: Home Assistant 2025.1 oder neuer. Zusätzliche Python-Abhängigkeiten: `pypdfium2` und `anthropic` (offizielles SDK
für die externen Claude-Modelle; beide werden automatisch installiert).

### Daten

Pro Person unter `<config>/.storage/llmitmir/<user_id>/` (Chats als einzelne Dateien, Anhänge und Arbeitsbereiche unter
`files/`), die Admin-Konfiguration in `.storage/llmitmir.config`, das Kostenbuch der externen Modelle in `.storage/llmitmir.billing`. Beides ist Teil normaler HA-Backups. Zugangsdaten
und Schlüssel liegen dort wie bei anderen Integrationen unverschlüsselt.

## Entwicklung

```bash
npm install
npm run build      # baut custom_components/llmitmir/frontend/llmitmir-panel.js und THIRD_PARTY_LICENSES.txt (beide eingecheckt)
npm run watch      # baut das Bundle bei jeder Änderung neu (ohne Lizenzdatei)
npm run check      # TypeScript prüfen
```

Das Frontend ist TypeScript mit [Lit](https://lit.dev), gebündelt mit esbuild; Markdown über `marked` + `DOMPurify`.

## English

LLMitMir adds a Claude-Desktop-style panel to Home Assistant. By default people get a simple view (messenger-style chat
with request and answer only, automatic model choice, plain-language answers, explained features); the full expert view
can be switched on in the settings, and admins can fix the view per person. The expert view offers chats with streaming, reasoning and voice input; coworks
(autonomous tool use with approvals); scheduled tasks designed for slow, rate-limited open-weight models, which can be
shared with other Home Assistant users (view, edit, own push notification per person); projects; skills;
and a separate credential vault the model never sees. It works with any OpenAI-compatible API (preset: GWDG SAIA).
Admins choose who may use it and whether keys are shared, assigned per user by the admin, or entered by each user.
Scheduled tasks can run on a separate key (central or per user), with daily request/token usage of all tasks on that key.
Optionally, Claude can be added through a Microsoft Foundry resource and/or an Anthropic API key as usage-billed external
providers: the admin orders all providers and sets each external one to "always selectable" or "emergency only" (unlocked while
every provider before it is unusable for that person). External models are never chosen automatically, credentials are closed to
them unless released one by one, projects can be locked, every request is booked permanently with tokens and euro cost, and the
admin sets a monthly euro limit per person.
The default model is chosen automatically per role from the provider's live model list (refreshed every three minutes,
including load and new releases); when a model is overloaded or hangs, the chat recommends a free model of similar quality
and can switch mid-run, and scheduled tasks switch on their own.
A Claude import prompt moves skills (with credentials extracted), scheduled tasks, projects and memory; chat history is
imported from the official claude.ai data export.

## Lizenz

MIT – siehe [LICENSE](LICENSE). Die Lizenzen der im Panel gebündelten Bibliotheken (Lit, marked, DOMPurify,
Material Design Icons) stehen in
[THIRD_PARTY_LICENSES.txt](custom_components/llmitmir/frontend/THIRD_PARTY_LICENSES.txt).
