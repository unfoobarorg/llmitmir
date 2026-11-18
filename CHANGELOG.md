# Änderungen · Changelog

Versionen nach [Semver](https://semver.org/lang/de/). Ältere Versionen: siehe Git-Historie.

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
