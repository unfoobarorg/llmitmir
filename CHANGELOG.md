# Änderungen · Changelog

Versionen nach [Semver](https://semver.org/lang/de/). Ältere Versionen: siehe Git-Historie.

## 2.2.0 – Sprachauswahl, Limits in Prozent, neue Meldung zu Modellaufrufen

LLMitMir spricht jetzt durchgängig Englisch oder Deutsch, je nach Wahl in den Einstellungen. Die Limits zeigt es wie die
Claude-Desktop-App als Prozent mit Rücksetzzeit statt als Rohzahlen, und wird eine Antwort lang, fragt eine Meldung über dem
Eingabefeld, wie es weitergehen soll – mit „Weitermachen“, „Zum Ende kommen“ oder „Stopp“.

### Sprachauswahl und durchgängig Englisch
- **Sprachauswahl** unter *Einstellungen → Allgemein → Sprache*: Deutsch, English oder „Automatisch“ (folgt dem Profil
  in Home Assistant). Weitere Sprachen brauchen nur eine Datei `locales/<code>.json` (siehe docs/ENTWICKLUNG.md).
- **Englisch durchgängig:** Bisher waren viele Texte trotz englischer Oberfläche deutsch. Jetzt sind alle Seiten,
  Dialoge, Karten und Hinweise übersetzt, ebenso Fehlermeldungen und Hinweise des Servers (Zeitpläne, Prüfungen der
  Zugänge, Werkzeugnamen, Kontingente), Push-Nachrichten, Datum und Zahlen, der Prompt für den Import aus Claude und die
  Anleitung zur Werkbank (docs/WERKBANK.en.md).
- Die Modelle antworten in der gewählten Sprache; Spracheingabe und Sprachgespräch folgen ihr.
- Neue Tests verhindern deutsche Texte ohne Übersetzung im Panel und in den Meldungen des Servers.

### Limits verständlich in Prozent (wie in der Claude-Desktop-App)
- **Nutzungslimits nur noch in Prozent:** Das Menü am Ring neben dem Eingabefeld und *Einstellungen → Verbrauch*
  zeigen je Limit einen Balken mit „23 % verbraucht“ und „Setzt in 3 Std. 12 Min. zurück“: *Diese Stunde*, *Heute*
  (es zählt, was zuerst ausgeht – Tageskontingent oder Schlüssel) und *Externe Modelle · diesen Monat*. Statt Rohzahlen wie
  „380 / 1000“ steht dort, wie viel verbraucht ist und wann es weitergeht.
- **Genaue Zahlen auf Wunsch:** *Einstellungen → Verbrauch → Genaue Zahlen anzeigen* blendet Anfragen, Tokens und Euro
  wieder ein – unter den Balken, im Menü am Eingabefeld, im Verlauf und bei den geplanten Aufgaben.
- **Hinweis ab 80 %** über dem Eingabefeld, auch in der einfachen Ansicht („Du hast 85 % deines Limits für heute
  verbraucht · Setzt in 3 Std. zurück“); bei 100 % in Rot.
- Meldungen bei erreichtem Tageskontingent oder Monatslimit nennen keine Rohzahlen mehr, sondern wann es weitergeht.

### Limit der Modellaufrufe: neue Meldung über dem Eingabefeld
- Aus „Schritten“ werden überall **Modellaufrufe** – im Panel, in Meldungen, Push-Nachrichten und auf der Seite *Geplant*.
- Wird das Limit einer Antwort knapp, erscheint statt der Karte im Verlauf eine **gelbe Meldung direkt über dem
  Eingabefeld** (mit Animation) und drei klaren Möglichkeiten: **Weitermachen**, **Zum Ende kommen** und **Stopp**. Die
  genauen Zahlen bleiben verborgen. Die Frage kommt jetzt **auch in der einfachen Ansicht**.
- Endet eine Antwort am Limit, bietet eine **rote Meldung** an, mit einem Klick weiterzumachen.
- Das Menü am Eingabefeld zeigt während einer Antwort, wie viel von ihren Modellaufrufen verbraucht ist.

## 2.1.0 – Plugins-Seite, geführte Einrichtung von Konnektoren, richtige Kontextgröße

Skills, Konnektoren und Zugänge liegen jetzt zusammen auf der neuen Seite *Plugins*. Konnektoren lassen sich in einem
geführten Chat einrichten und mehrfach verbinden, ohne dass das Modell Anmeldedaten sieht. Außerdem rechnet LLMitMir mit
den richtigen Kontextgrößen der SAIA-Modelle, deshalb werden lange Chats nicht mehr zu früh gekürzt.

### Plugins
- **Neue Seite „Plugins“** im Hauptmenü und unter *Einstellungen → Plugins* (wie in der Claude-Desktop-App) mit den Reitern
  Konnektoren, Skills und Zugänge. Die bisherigen Menüpunkte Skills, Konnektoren und Zugänge sind darin aufgegangen.
- **Zugänge und Skills von Konnektoren** stehen ausgegraut unter „… von Konnektoren“ mit dem Namen des Konnektors und
  lassen sich nur über den Konnektor öffnen, ändern oder löschen – auch nicht mehr versehentlich im Chat.

### Konnektoren
- **Geführte Einrichtung im Chat:** „Konnektor einrichten“ öffnet einen eigenen Chat, der nach einer
  Einrichtungsanleitung des Admins Frage für Frage durchführt. Anmeldedaten trägt die Person in ein Formular im Chat ein –
  das Modell sieht sie nie. LLMitMir prüft die Verbindung sofort.
- **Direkt nach dem Verbinden festlegen, wofür der Zugang verwendet werden darf:** je Dienst „nur lesen“ oder „lesen
  und schreiben“ (GWDG/EWS), sonst „nur lesen“ oder „lesen und schreiben“, dazu Freigabe für externe Modelle und
  Ablaufdatum. Danach kann ein **Skill der Verbindung** hinterlegt werden.
- **Konnektoren mehrfach verbinden**, z. B. GitLab mit je einem Token für mehrere Projekte (bis zu 10 je Konnektor).
- **Im Chat sichtbar, wenn ein Konnektor verwendet wird:** Der Schritt trägt den Namen des Konnektors (bei mehreren
  Verbindungen auch den der Verbindung), statt nur „HTTP-Anfrage“.
- **Admin:** Konnektoren als Kacheln; ein Klick öffnet den Konnektor zum Bearbeiten. Neues Feld
  *Einrichtungsanleitung für den geführten Chat*.
- **GWDG-Exchange:** Die Felder heißen E-Mail-Adresse, Benutzerkennung und Passwort (auch auf der Seite der Konnektoren).

### Zugänge
- **„Nur lesen“ für alle Zugänge ohne Dienste** (Nextcloud, Token, API-Key …): schreibende Aufrufe und Werkbank-Befehle mit
  dem Zugang lehnt LLMitMir ab.

### Modelle
- **Kontextgrößen nach der GWDG-Liste:** Die eingebaute Tabelle stammte aus der ersten Version und war für mehrere
  SAIA-Modelle viel zu klein (DeepSeek V4 Flash und GLM 5.3 Flash 128.000 statt 1 Mio. Tokens, Gemma 4, Qwen 3 30B
  und Qwen 3 Omni 128.000 bzw. 64.000 statt 256.000). LLMitMir hat lange Chats deshalb viel zu früh gekürzt, die
  Modelle „vergaßen“ ältere Nachrichten und Werkzeug-Ergebnisse.
- **Grenze vom Server:** Lehnt der Server eine Anfrage als zu lang ab, liest LLMitMir die echte Grenze aus der
  Fehlermeldung, merkt sie sich 30 Tage, kürzt den Verlauf und fragt noch einmal (bis zu dreimal je Lauf) – statt mit
  einem Fehler abzubrechen. Die gelernte Grenze gilt auch, wenn der Admin einen größeren Wert eingetragen hat, und steht
  unter *Admin → Modelle* beim Modell.
- Eine zu lange Anfrage schaltet den Schalter „ohne Denkphase“ nicht mehr fälschlich ab.

## 2.0.0 – Trusted AI: Kontrolle für Admins, neue Einstellungen

Große Version: LLMitMir bekommt alles, was Admins brauchen, um KI-Agenten nachvollziehbar und kontrolliert laufen zu
lassen – Zugriffsprotokoll, Freigabe jedes Zugangs je Agent, Konnektoren mit Datenregeln, MCP-Server, zentrale Skills,
Wartungsmodus und Nutzerverwaltung mit AD/LDAP. Dazu sind die Einstellungen neu geordnet.

### Beim Update beachten
- **Zugänge brauchen jetzt in jedem Chat und Cowork eine Freigabe:** Beim ersten Gebrauch fragt LLMitMir einmal nach
  (einmal, für diesen Chat oder nicht). Zugänge, die einem Projekt zugeordnet sind, sind dort vorab erlaubt.
- **Geplante Aufgaben fragen nie:** Sie nutzen nur die Zugänge, die bei der Aufgabe oder im Projekt erlaubt sind.
  Damit nach dem Update nichts stehen bleibt, bekommen vorhandene Aufgaben einmalig alle Zugänge, die es gerade gibt,
  und sind zur Durchsicht markiert – bitte dort nur die anhaken, die die Aufgabe wirklich braucht.
- **Art jedes Zugangs:** Neue Zugänge brauchen eine Art (eigener Zugang im Nutzerkontext, persönliche Zugangsdaten oder
  zentraler Systemzugang). Vorhandene Zugänge ohne Art laufen weiter und tragen den Hinweis „Art fehlt“. **Zentrale
  Systemzugänge sind ohne Erlaubnis des Admins gesperrt** (*Admin → Zugänge & Konnektoren*, Vorgabe aus).
- **Chats mit internen Daten nehmen kein externes Modell mehr an** (Vorgabe an, abschaltbar unter *Admin → Zugänge &
  Konnektoren*).
- **Neue Python-Abhängigkeit `ldap3`** (für die Nutzerverwaltung): Home Assistant installiert sie beim Neustart.
- Die Dienste `llmitmir.prepare_restart` und `llmitmir.cancel_restart` dürfen nur Admins und Automationen aufrufen.
- Die Werkbank ist unverändert; sie braucht kein Update.

### Zugriffsprotokoll und Monitoring
- **Agenten mit fester Identität:** Jeder Chat, jedes Cowork und jede Teilaufgabe ist ein Agent; eine geplante Aufgabe
  oder Kachel ist über alle Läufe derselbe Agent. Protokolliert werden Laufbeginn, jeder Werkzeugaufruf, Rückfragen und
  Entscheidungen – nur Metadaten (Werkzeug, Zugang, Server und Pfad, Entitäten, Modellklasse, Ergebnis, wer freigegeben
  hat), nie Texte, Suchbegriffe, Empfänger, Befehle oder Chat-Titel. Aufbewahrung 7 bis 3650 Tage (Vorgabe 180).
- **Admin → Monitoring:** Übersicht mit Filtern, Agenten-Verzeichnis und CSV-Export. In der **Zentrale** hält der Admin
  laufende Agenten an, entzieht Freigaben für einen oder alle Zugänge einer Person und sieht Auffälligkeiten der letzten
  24 Stunden (viele Aufrufe oder Sperren, neue Server, nächtliche Aktivität; morgens als Karte für alle Admins).
- **Export** jedes Ereignisses an einen Webhook (JSON über https) oder an Syslog (RFC 5424, UDP/TCP/TLS).
- Änderungen der Admin-Einstellungen (welcher Bereich, nie Werte), Admin-Eingriffe und jeder LDAP-Abgleich stehen selbst
  im Protokoll.

### Zugänge, Konnektoren und Datenregeln
- **Konnektoren:** Der Admin bereitet Anbindungen vor (Typ, feste Felder wie die Nextcloud-Adresse, erlaubte Server,
  Anleitung für das Modell); jede Person verbindet nur ihr eigenes Konto – per Formular oder über den **Nextcloud Login
  Flow** (eigenes App-Passwort, nur über https). Ausgeschaltete Konnektoren sperren ihre Zugänge. Eigene Zugänge ohne
  Konnektor lassen sich abschalten.
- **Datenregeln je Konnektor:** Für einen Bereich (z. B. `/Gruppen/Finanzen/**`) prüft ein Wächter auf dem Hauptanbieter
  eine Anweisung in Worten anhand der Metadaten (bei Nextcloud: Tags, Typ, Größe, Besitzer) – nie anhand der Inhalte –,
  bevor ein Werkzeug Inhalte abruft. Im Zweifel gesperrt. Pfade werden vor dem Vergleich vereinheitlicht.
- **MCP-Server als Konnektor:** Der Admin ruft die Werkzeuge eines entfernten MCP-Servers einmal ab und gibt sie einzeln
  frei (schreibend ja/nein); Beschreibung und Parameter sind eingefroren. Jede Person nutzt ihren eigenen Token; es
  gelten Freigabe je Agent, Schreib-Freigaben, Datenregeln und Protokoll.
- **Interne Daten bleiben intern:** Hat ein Chat einen Zugang ohne Freigabe für externe Modelle benutzt, eine Datenregel
  nur für interne Modelle durchgelassen oder einen Skill „nur für interne Modelle“ gelesen, nimmt er samt Teilaufgaben
  kein externes Modell mehr an – auch nicht als Notfall-Ausweichmodell. Schloss im Modellmenü mit Grund.
- Platzhalter `{{cred:…}}` werden auch in der Markierung interner Daten und im Zugriffsprotokoll so erkannt wie beim
  Einsetzen (Ergänzung zu 1.1.1).

### Skills
- **Zentrale Skills:** Vorgaben des Admins für alle Personen, in deren Oberfläche unsichtbar. „Immer aktiv“ steht mit
  Vorrang im Systemprompt jedes Laufs, „bei Bedarf“ lädt das Modell wie einen eigenen Skill.
- **Skill-Richtlinien:** Muster, Höchstlänge, verbotene Server, Geheimnisse im Klartext oder ein Prüfauftrag an ein
  Modell des Hauptanbieters; Aktion sperren, Person benachrichtigen oder protokollieren. Geprüft wird beim Speichern,
  beim Import und nachts; eine ausstehende sperrende Prüfung sperrt den Skill.

### Betrieb
- **Wartungsmodus:** `llmitmir.prepare_restart` kündigt einen Neustart an (Startseite, Push, Hinweis über jeder Seite),
  startet nichts Neues mehr, lässt laufende Agenten bis zur Frist fertig werden und startet Home Assistant auf Wunsch
  selbst neu; `llmitmir.cancel_restart` bricht ab. Sensor `sensor.llmitmir_laufende_agenten` für Automationen.
- **Nutzerverwaltung mit Active Directory / LDAP** (optional): legt Home-Assistant-Benutzer nach Gruppen an, passt
  Admin-Rechte und den Zugriff auf LLMitMir an und deaktiviert, wer aus allen Gruppen fällt – nie löschen. Probelauf,
  Abgleich von Hand oder nachts. Von Hand angelegte Benutzer und der letzte aktive Admin bleiben unberührt.

### Oberfläche
- **Einstellungen wie bei Claude:** Persönliche und Admin-Einstellungen sind in Bereiche geteilt – links die Liste,
  rechts Gruppen aus Zeilen mit kurzer Erklärung und Schalter, Auswahl oder Eingabe; lange Erklärungen hinter „Mehr
  dazu“. Persönlich: Allgemein, Modelle, Funktionen, Benachrichtigungen, Datenschutz & Freigaben, Verbrauch,
  API-Schlüssel (nur wenn nötig) und Import aus Claude. Admin: Personen, Anbieter & Schlüssel, Modelle, Externe Modelle &
  Kosten, Zugänge & Konnektoren, Skills, Werkbank, Benachrichtigungen, Weitere Dienste und Monitoring.
- Jeder Bereich hat eine eigene Adresse (`/llmitmir/settings/privacy`, `/llmitmir/admin/models` …); auf dem Handy wird die
  Liste zur waagerechten Leiste. Ungespeicherte Änderungen bleiben beim Wechsel der Bereiche erhalten.

### Behoben
- Home Assistant meldete beim Öffnen des Panels einen blockierenden Aufruf: `edge_tts` wird nicht mehr im Event-Loop
  importiert.

## 1.1.1 – Sicherheitskorrektur Zugänge

### Zugänge
- **Platzhalter werden überall gleich erkannt:** Die Prüfungen rund um Platzhalter `{{cred:Name:feld}}` (nur an die
  Server des Zugangs, Herausfiltern gesperrter Zugänge für externe Modelle) erkennen einen Zugang jetzt genau so, wie
  er beim Einsetzen gefunden wird. Empfohlenes Update für alle Installationen.

## 1.1.0 – Tabellen mit Fußzeile, Freigaben melden sich immer

### Dashboards
- **Fußzeile für Tabellen:** Eine Tabellen-Kachel nimmt jetzt ein optionales `footer` an – ein Objekt mit denselben
  Schlüsseln wie eine Zeile, gerendert als Summenzeile unter der Tabelle. Sie wird wie eine Zeile bereinigt (nur
  bekannte Spalten, Text auf 200 Zeichen gekürzt, Zahlen bleiben Zahlen), ist abgesetzt wie die Kopfzeile (fett, obere
  Trennlinie, Hintergrund der Kachel) und bleibt beim Scrollen langer Tabellen unten stehen. Sortiert wird sie nicht.
- **Spalten fett und farbig:** Jede Spalte kann `strong: true` (Zellen fett) und `color: "#rrggbb"` (Textfarbe)
  tragen; beides gilt im Body und in der Fußzeile. Eine unbrauchbare Farbangabe wird verworfen, statt die Kachel
  scheitern zu lassen. Der Schema-Text im Kachel-Lauf nennt die neuen Felder, das Modell kennt sie also.

### Freigaben
- **Push-Nachricht kommt immer, wenn die Person gebraucht wird:** Bisher blieb sie aus, sobald für die Person
  irgendein Panel verbunden war – wer LLMitMir auf dem Tablet offen hatte, aber am Handy unterwegs war, erfuhr nichts,
  und der Lauf stand bis zu einer Stunde. Diese Unterdrückung ist entfernt: Jede wartende Freigabe meldet sich
  (schreibendes Werkzeug, Änderung bestätigen, „mehr Schritte?“, Freigaben aus Teilaufgaben). Abgeschaltet wird sie nur
  noch ausdrücklich in den Einstellungen.
- **Sendefehler werden sichtbar:** Fehlt ein Benachrichtigungsgerät oder scheitert das Senden, steht das als Warnung im
  Protokoll statt nur als Debug-Zeile. Die Freigabe scheitert dadurch weiterhin nie.

**Beim Update beachten:** Wer die Meldung nicht will, schaltet sie unter *Einstellungen → Darstellung & Bedienung* ab
(„Aufs Handy melden, wenn eine Freigabe auf Antwort wartet“). Ohne Benachrichtigungsgerät bleibt sie aus – das steht
jetzt im Protokoll.

## 1.0.2 – externe Modelle des Hauptanbieters

### Datenschutz
- **Externe Modelle des Hauptanbieters:** Modelle, die SAIA an kommerzielle Anbieter weiterleitet (im Namen als
  „External“ gekennzeichnet), gelten jetzt als extern – mit denselben Regeln wie Claude über Foundry oder die
  Anthropic-API: nie automatisch gewählt (auch nicht als Vorgabe, im Gespräch oder bei Last), nur für Personen, die der
  Admin freigibt, erst nach der Zustimmung, nur für externe Modelle freigegebene Zugänge (Ergebnisse gesperrter Zugänge
  aus dem Verlauf entfernt, Anfragen geschwärzt), Projektsperre, Teilaufgaben nur auf ausdrücklichen Wunsch. Kosten bucht
  LLMitMir für sie nicht, weil der Einkaufsweg und -preis unbekannt sind.

**Beim Update beachten:** Solche Modelle sind zunächst für niemanden freigegeben. Wer sie nutzen soll, hakt der Admin
unter *Admin → Modelle → Externe Modelle des Hauptanbieters* an; die Person stimmt beim ersten Mal zu.

## 1.0.1 – gleiche Dateinamen bleiben erhalten

- **Mehrere Screenshots mit demselben Namen** in einem Chat überschrieben sich: der zweite Upload landete auf dem
  ersten, das Modell las beim zweiten Mal wieder die alte Datei. Jetzt legt LLMitMir den zweiten als `image (2).png`
  an, den dritten als `image (3).png` – im Chat und bei gespeicherten Mail-Anhängen. In Projekten und Skills ersetzt
  ein Upload gleichen Namens weiterhin die Datei, dort ist das die Absicht.

## 1.0.0 – erste stabile Version

LLMitMir ist stabil: geprüft auf Sicherheit, Datenschutz und Technik, mit Tests gegen Home Assistant 2025.1 bis
2026.10. Enthält alle Änderungen aus 0.42.0 (unten). Installation über HACS aus dem Spiegel
[github.com/unfoobarorg/llmitmir](https://github.com/unfoobarorg/llmitmir).

**Beim Update beachten**
- Zugänge gehen nur noch an ihre Server. Geplante Aufgaben, die einen Zugang an einen anderen Server schicken, lehnen
  das ab, bis er unter *Einstellungen → Erlaubte Server* (oder auf der Seite des Zugangs) steht – die Meldung nennt ihn.
- Wer eine geteilte Aufgabe bearbeiten darf, kann Freigaben, Werkzeuge, Modell und Projekt nicht mehr ändern; ein neuer
  Auftrag läuft erst nach Bestätigung.
- Werkbank 0.2.0: Sandboxen erreichen das Heimnetz nicht mehr. Nach dem Update `install.sh` erneut ausführen, damit
  die Firewall eingerichtet wird (bei eigener Ausrollung: `werkbank/firewall.sh` als Dienst nach Docker).
- Import-Links gelten einmal; HTML-Dateien aus Arbeitsbereichen gibt es nur noch als Download.

## 0.42.0 – Prüfung vor 1.0.0

### Sicherheit
- **Home-Assistant-Befehle:** `ha_ws` hielt Befehle wie `config/auth/delete` oder `lovelace/config/save` für lesend und
  führte sie ohne Freigabe aus. Jetzt gilt ein Befehl nur noch als lesend, wenn nichts in seinem Namen auf eine Änderung
  hindeutet. `ha_service` prüft für Nicht-Admins jedes Ziel; Bereiche, Geräte und Labels bleiben Admins vorbehalten.
- **Zugänge nur an ihre Server:** Zugangsdaten gehen nur an die Server des Zugangs (aus seinen Adressen und der neuen
  Liste *Erlaubte Server*). Für einen anderen Server fragt LLMitMir vorher, geplante Aufgaben lehnen ab. Weiterleitungen
  auf fremde Server bekommen keine Zugangsdaten mit. Übersicht und Verwaltung aller erlaubten Server unter
  *Einstellungen → Erlaubte Server* (je Zugang, wie die Domain-Freigaben in Claude Desktop).
- **Geteilte Aufgaben und Kacheln:** Wer sie bearbeiten darf, ändert keine Freigaben, Werkzeuge, Werkbank, Modell oder
  Projekt mehr. Ein geänderter Auftrag läuft erst, wenn die Eigentümerin oder der Eigentümer ihn bestätigt.
- **Bilder in Antworten** laden nicht mehr von selbst von fremden Servern (Schutz vor Datenabfluss), sondern erscheinen
  als Link.
- **Werkbank 0.2.0:** Sandboxen erreichen nur noch das Internet, nicht das Heimnetz oder die VM (eigenes Docker-Netz
  und `firewall.sh`). Jede Sandbox hat ihren eigenen Cache. Pfade in Shell-Befehlen sind sicher gequotet.
- **Import:** Importierte Aufgaben bringen keine Freigaben mehr mit, der Import-Link ist wirklich einmalig, und
  ZIP-Inhalte werden vor dem Entpacken auf ihre Größe geprüft.
- **Dateien** aus Arbeitsbereichen werden nie als Webseite ausgeliefert (HTML/SVG nur als Download, `nosniff`, Sandbox-CSP).
- Die Sperre auf die eigene Home-Assistant-Instanz gilt auch für IP-Adressen und Weiterleitungen.

### Datenschutz
- **Admin-Schalter für die Roboterstimme:** Sie spricht über den Vorlesedienst von Microsoft Edge. Ausgeschaltet liest
  die Sprachausgabe von Home Assistant oder des Browsers vor. README und Admin-Seite nennen, wohin der Text geht.
- Benachrichtigungen zu geteilten Aufgaben und Kacheln erreichen nur noch Personen, die LLMitMir nutzen dürfen.
- Der API-Schlüssel aus dem Einrichtungsdialog bleibt nicht mehr im Config Entry liegen.
- Persönliche Beispieldaten aus Code, Tests und Dokumentation entfernt.

### Behoben
- „Ohne sie weitermachen“ bei einer Freigabe führte immer zu einem Fehler.
- „Projekt löschen samt Chats“ hielt laufende Antworten nicht an und ließ Sandboxen und Startseiten-Karten stehen.
- Speicherungen konnten sich überholen (älterer Stand über neuerem); verzögerte Speicherungen gingen beim
  Herunterfahren verloren.
- Ein Import, der kein JSON-Objekt ist, endete in einem Serverfehler.
- Nach dem Entladen antworten Websocket und HTTP verständlich; die eigene Client-Session wird geschlossen.

### Tests, CI, Dokumentation
- Neue Test-Pipeline: Unit-Tests mit Python 3.13 und 3.14, Integrationstests gegen ein echtes Home Assistant (Mindest-
  und aktuelle Version), Frontend-Tests, ruff, Release-Tor für `main` und Tags.
- README neu gegliedert, kurz und zweisprachig, mit Installation über HACS aus dem GitHub-Spiegel; Details in `docs/FUNKTIONEN.md`, `docs/WERKZEUGE.md` und
  `docs/ENTWICKLUNG.md`. `pillow` steht jetzt in den Abhängigkeiten.
