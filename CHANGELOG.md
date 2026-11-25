# Änderungen · Changelog

Versionen nach [Semver](https://semver.org/lang/de/). Ältere Versionen: siehe Git-Historie.

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
