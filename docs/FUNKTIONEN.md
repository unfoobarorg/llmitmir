# Funktionen im Detail

*Kurzfassung und Einstieg: [README](../README.md). Werkzeuge: [WERKZEUGE.md](WERKZEUGE.md).*

- **Einfache Ansicht und Expertenansicht**: Standard ist die einfache Ansicht für technische Laien – der Chat zeigt wie ein
  Messenger nur Nachricht und Antwort mit Warte-Animation, Modelle werden nie angezeigt und immer automatisch gewählt
  (auch bei Überlastung wechselt LLMitMir selbst), die Modelle antworten verständlich und ohne Fachbegriffe, und Skills,
  geplante Aufgaben, Zugänge und Projekte sind erklärt und lassen sich im Chat einrichten. Die Expertenansicht (alles
  Folgende) schaltet jede Person unter *Einstellungen → Allgemein → Ansicht* frei; Admins legen unter *Admin → Personen → Ansicht* für alle oder
  je Person fest, ob sie selbst wählen darf oder immer eine bestimmte Ansicht bekommt.
- **Einstellungen wie bei Claude**: Persönliche Einstellungen und Admin-Einstellungen sind in Bereiche geteilt – links die
  Liste, rechts Gruppen aus Zeilen mit kurzer Erklärung und Schalter, Auswahl oder Eingabefeld; längere Erklärungen stehen
  hinter „Mehr dazu“. Jeder Bereich hat eine eigene Adresse (`/llmitmir/settings/<bereich>`, `/llmitmir/admin/<bereich>`),
  auf schmalen Bildschirmen wird die Liste zur waagerechten Leiste. Persönlich: *Allgemein* (Ansicht, persönliche Hinweise,
  Bedienung), *Modelle* (Standardmodelle, externe Modelle), *Funktionen* (Teilaufgaben, Werkbank), *Benachrichtigungen*,
  *Datenschutz & Freigaben* (Lebensdauer, Freigaben, erlaubte Server), *Verbrauch*, *API-Schlüssel* (nur wenn der Admin
  eigene Schlüssel vorsieht) und *Import aus Claude*. Admin: *Personen* (Zugriff, Kontingente, Ansicht, AD/LDAP),
  *Anbieter & Schlüssel*, *Modelle*, *Externe Modelle & Kosten*, *Zugänge & Konnektoren*, *Skills*, *Werkbank*,
  *Benachrichtigungen* (Geräte je Person), *Weitere Dienste* (Websuche, Sprachausgabe, Dashboards) und *Monitoring*.
  Ungespeicherte Änderungen bleiben beim Wechsel der Bereiche erhalten; eine Leiste unten bietet Speichern und Verwerfen.
- **Dateien ansehen statt nur herunterladen**: Erzeugte Dateien und Anhänge öffnen sich in einem eigenen Betrachter im
  Panel – Bilder, PDFs (seitenweise, als Bild gerendert), Texte, Ton, Video sowie **Word- und Excel-Dateien** (Absätze
  und Tabellen als lesbarer Ausschnitt, ohne Makros und ohne Formeln). Das funktioniert im Browser und in den mobilen
  Apps gleichermaßen; ein neues Fenster (das die Apps nicht öffnen) ist dafür nicht nötig. Was der Betrachter nicht
  darstellen kann, lässt sich herunterladen.
- **Chats** mit Streaming, sichtbaren Gedanken der Modelle, Markdown, Anhängen (Bilder, PDFs, Texte, **Tonaufnahmen** –
  sie werden mit derselben Spracherkennung wie die Spracheingabe abgeschrieben; zwei Anhänge mit demselben Namen
  bleiben beide erhalten, der zweite heißt dann `image (2).png`) und **Spracheingabe**
  (über `/audio/transcriptions` des Anbieters, Fallback Browser-Spracherkennung). Stehen in der Seitenleiste mehr als
  zehn Chats, bietet sie *Chats auswählen* an: mehrere Chats markieren (einzeln oder alle) und in einem Zug löschen.
  Die Suche über der Liste findet auf Wunsch **auch in den Nachrichten** („Auch in Nachrichten suchen“) und zeigt je
  Treffer einen Ausschnitt – so lässt sich eine Zahl oder ein Name wiederfinden, ohne sich an den Chat-Titel zu erinnern.
- **Teilaufgaben (Unterchats)**: Ein Chat oder Cowork kann Teilaufgaben haben – eigene Chats mit eigenem Verlauf, die in
  der Seitenleiste leicht eingerückt unter ihrem Hauptchat stehen, mit Symbol und Status-Punkt (läuft, wartet, fertig,
  Fehler); ein Pfeil am Hauptchat klappt sie ein und aus. Unter jeder Antwort legt *Als Teilaufgabe weiterarbeiten* eine
  an, mit der Antwort als Ausgangspunkt. Teilaufgaben teilen Dateien und Sandbox mit ihrem Hauptchat, ziehen mit ihm in
  ein anderes Projekt und werden mit ihm gelöscht (auch über die Lebensdauer). Der Hauptchat sieht nur ihre
  Zusammenfassungen, nie ihren Verlauf – so bleibt er kurz und aufgeräumt. Auch das Modell selbst verteilt Arbeit:
  Mit `unterchat_starten` startet es Teilaufgaben mit eigenem Kontext und eigenem Modell (Standard *sparsam*, eine eigene
  Rolle der automatischen Modellwahl, einstellbar unter *Einstellungen → Modelle* und *Admin → Modelle*), mehrere im
  selben Schritt parallel, und wartet auf ihre Zusammenfassungen. Im Hauptchat erscheint je Teilaufgabe eine Karte mit
  Modell, Stand (auch „wartet auf einen freien Platz“ und „Grenze erreicht“), Laufzeit, Verbrauch und *Öffnen*.
  Grenzen: 3 gleichzeitig je Person, 8 je Lauf, 40 Schritte je Teilaufgabe; jede erreichte Grenze meldet sofort ein
  Teilergebnis an den Hauptchat, „Stopp“ hält den ganzen Baum an. Freigaben, Änderungskarten und die Frage nach mehr
  Schritten aus einer Teilaufgabe erscheinen zentral im Hauptchat („aus Teilaufgabe ›Titel‹“) und – wenn kein Panel offen
  ist – als Push „Teilaufgabe braucht dich“ mit Link auf den Hauptchat; „Immer erlauben“ gilt dabei nur für die eine
  Teilaufgabe. Unter *Einstellungen → Funktionen → Teilaufgaben* wählt jede Person *automatisch* (Standard in der Expertenansicht:
  feste Regeln im Systemprompt, ab halb vollem Kontext ein Hinweis), *nur auf Wunsch* (Standard in der einfachen
  Ansicht) oder *aus*. Wer selbst in einer Teilaufgabe weiterarbeitet, bekommt das neue Ergebnis als Nachtrag im
  Hauptchat (abschaltbar, *Jetzt melden* schickt es sofort). In der einfachen Ansicht laufen Teilaufgaben unsichtbar
  im Hintergrund („Arbeitet an 3 Teilaufgaben …“). Die Kopfzeile des Hauptchats zeigt den Verbrauch samt Teilaufgaben. Details: [docs/TEILAUFGABEN.md](TEILAUFGABEN.md).
- **Gespräch (Sprachgespräch)**: Eine eigene Ansicht – erreichbar von der Startseite, aus der Seitenleiste und aus
  jedem Chat und Cowork über den Knopf *Gespräch* –, in der man mit LLMitMir redet wie am Telefon, beliebig lange und
  über viele Runden. Aus einem Chat heraus setzt das Gespräch dessen Verlauf fort (die letzte Antwort wird einmal
  vorgelesen, damit klar ist, wo es weitergeht); getippt und gesprochen wechseln sich also im selben Chat ab. Das Mikrofon bleibt offen; eine
  Sprechpause beendet die Äußerung (keine Taste halten), sie wird abgeschrieben (`/audio/transcriptions` des Anbieters,
  Fallback Browser-Spracherkennung) und als normale Nachricht in einen Chat gestellt. Die Antwort wird Satz für Satz
  vorgelesen, noch während sie entsteht – mit der **festen Stimme des Roboters**, die LLMitMir selbst mitbringt
  (auf dem Server gesprochen, damit sie auf iPad, im Browser und in der Android-App gleich klingt – dort gibt es
  keine brauchbare Stimme des Systems). Standard ist die **Roboterstimme**: eine neutrale, männliche deutsche
  Stimme, nicht so tief wie eine Erzählerstimme, mit einem leichten Maschinenklang (Ringmodulation, Bass weg,
  Höhen betont). Wahlweise die **männliche Stimme** (dieselbe Stimme ohne Klangbearbeitung, tiefer und ruhiger)
  oder die **weibliche Stimme** (natürlich, ohne Klangbearbeitung).
  Gesprochen wird über den Vorlesedienst von Microsoft Edge (Paket `edge-tts`) – der vorgelesene Text geht also dorthin;
  der Admin kann die eigene Stimme unter *Admin → Sprachausgabe* ausschalten.
  Ist die Stimme nicht erreichbar oder ausgeschaltet, liest die **Sprachausgabe von Home Assistant** (die Stimme des bevorzugten
  Sprachassistenten, z. B. Piper oder Home Assistant Cloud), sonst die Stimme des Browsers oder nur als Untertitel. Es ist ein ganz normaler Chat: Open-Weight-Modelle wie
  kostenpflichtige externe Modelle (Expertenansicht: Modellwahl in den Einstellungen der Ansicht), Werkzeuge und
  Freigaben (als Karte zum Antippen) funktionieren wie dort – mit einem Unterschied: Was im Gespräch einmal erlaubt
  wurde (ein Werkzeug oder eine ganze Werkzeuggruppe), gilt für den Rest des Gesprächs und wird nicht bei jeder
  Aktion erneut gefragt; sonst stockt der Gesprächsfluss. Getippt wird weiterhin jede Aktion einzeln bestätigt.
  Das Gespräch steht danach in der Chatliste zum Nachlesen und Weiterschreiben. Neue Gespräche landen von selbst im
  Projekt **„Gespräche“**, das LLMitMir beim ersten Gespräch anlegt und das eine Lebensdauer von 14 Tagen hat – wer oft
  mit dem Roboter spricht, behält so eine übersichtliche Chatliste. Das Projekt lässt sich umbenennen, die Frist ändern
  oder löschen; beim nächsten Gespräch entsteht es neu. **Kurzweg von außen:** Der Pfad `/llmitmir/voice/last` öffnet
  das jüngste Gespräch und hört sofort zu – als Shortcut der Home-Assistant-App (Einstellungen → Companion App →
  Shortcuts verwalten, Typ *Dashboard*, Pfad `/llmitmir/voice/last`) ist das Gespräch damit einen Tipp entfernt, etwa
  auf dem Autoradio im Auto. Gesprochene Nachrichten tragen ein Kennzeichen; solange gesprochen wird, antwortet
  das Modell kurz und vorlesbar (kein Markdown, keine Tabellen oder Links).
  **Ein Assistent, der nebenher läuft** (Auto, Tablet) – bedienbar, ohne den Bildschirm zu sehen oder zu berühren:
  *Sofort losreden:* Wer die Ansicht öffnet – von der Startseite, aus der Seitenleiste oder aus einem Chat –, wird
  gleich gehört; begrüßt wird nur, wer vier Sekunden nichts sagt. Der Roboter kommt mit einem kurzen Auftritt ins
  Bild (steigt auf und nickt, neigt den Kopf oder winkt – jedes Mal etwas anders).
  *Rufname:* Beim ersten Gespräch fragt der Roboter, wie er heißen soll (später in den Einstellungen der Ansicht
  änderbar). Zwanzig Sekunden nach dem letzten Wort geht er in Bereitschaft und reagiert nur noch auf Äußerungen mit
  seinem Namen am Anfang oder Ende („Robo, wie spät ist es?“); alles andere – Radio, Mitfahrende – lässt er
  vorbeiziehen. Der Name wird großzügig erkannt, weil die Spracherkennung ihn selten zweimal gleich schreibt.
  *Jederzeit unterbrechen:* Das Mikrofon bleibt offen, auch während der Roboter spricht oder arbeitet. „Stopp“ (auch
  „Halt“, „Warte“, „Hör auf“ …) oder der Rufname unterbrechen ihn; anderes Gesagtes gilt dann nicht ihm.
  *Sagen, was er tut:* Bei längerer Arbeit sagt er jeden neuen Schritt an („Jetzt schaue ich in den Kalender.“) und
  meldet sich, wenn ein Schritt dauert („Ich suche noch im Internet.“) – samt Hinweis, dass „Stopp“ abbricht.
  *Freigaben per Stimme:* Er sagt, was er tun möchte („Darf ich das tun: Licht einschalten?“), und versteht Ja,
  Nein und Immer. „Immer“ gilt dauerhaft für das Projekt des Gesprächs – bei neuen Gesprächen also für den ganzen
  Ordner „Gespräche“. Wer am Bildschirm schneller war, wird nicht mehr gefragt.
  *Tempo vor Tiefe:* Für gesprochene Runden wählt LLMitMir ein eigenes Modell – das schnellste, das Werkzeuge
  zuverlässig bedient (`models.pick_voice`). Es misst dafür je Modell die Zeit bis zum ersten Ausgabezeichen und
  stützt sich, solange nichts gemessen ist, auf die Bauart (wenige aktive Parameter, „Flash“). Modelle mit Denkphase
  antworten im Gespräch ohne sie (`chat_template_kwargs.enable_thinking: false`, sofern der Anbieter den Schalter
  kennt); kommt sieben Sekunden nichts, übernimmt das nächste schnelle Modell. Wird im selben Chat wieder getippt,
  gilt wieder das Modell für Chats.
  *Schnell antworten:* Derselbe Schalter lässt sich im Chat selbst setzen (Modellmenü → *Schnell antworten*). Er gilt
  je Chat und ab der nächsten Nachricht – gut für kurze Fragen, schwächer bei schwierigen.
  *Nahtlos aus dem Chat:* Arbeitet der Chat beim Wechsel noch, übernimmt das Gespräch den Lauf – der Roboter zeigt
  und sagt sofort, was gerade passiert, und liest vor, was ab da an Antwort entsteht.
  *Fehlende Skills:* Braucht eine alltägliche Bitte Herumprobieren oder Recherche, bietet der Roboter danach an,
  den Weg als Skill festzuhalten, damit es beim nächsten Mal sofort klappt.
  **Gesprächsfluss statt Chat in Tonform** – mehrere Dinge laufen gleichzeitig:
  *Mitdenken beim Zuhören:* Schon in einer kurzen Sprechpause wird das bisher Gesagte abgeschrieben (als Text unter
  dem Roboter mitzulesen). Klingt der Satz fertig, genügt eine kurze Stille und die Nachricht geht mit fertiger
  Abschrift sofort hinaus; bricht er mitten im Gedanken ab („… und“, „… weil“), wartet LLMitMir länger.
  *Nachschieben:* Solange LLMitMir still überlegt, bleibt das Mikrofon offen. Wer weiterspricht, bevor die Antwort
  kommt, wird nicht übergangen – der Nachsatz wird mit dem ersten Teil zu einer Nachricht verbunden und neu überlegt
  (solange noch kein Werkzeug lief; sonst hängt er sich an den Verlauf an).
  *Sprechen, während weitergedacht wird:* Die Antwort beginnt mit dem ersten fertigen Satz. Dauert es, überbrückt
  LLMitMir die Stille gesprochen statt mit einem Text am Bildschirm – „Hm, Moment.“ nach gut zweieinhalb Sekunden,
  „Ich schaue kurz im Kalender nach.“ beim ersten Werkzeug, bei langem Nachschlagen ab und zu ein „Einen Moment
  noch.“ (abschaltbar; die Sätze liegen vorab bereit und kommen ohne Verzögerung).
  *Kurze Beiträge:* Das Modell antwortet im Wechsel – meist ein, zwei Sätze, das Wichtigste zuerst, den Rest als
  Angebot („soll ich alle nennen?“) – und fragt bei Unklarem kurz zurück, statt alles abzuarbeiten.
  *Ruhige Gesten:* Der Roboter folgt nicht jedem technischen Zwischenschritt. Kurze Wartezeiten zeigt er
  **aufmerksam** (Blickkontakt, langsames Nicken) und ohne Text; die Denkerpose und „Ich überlege noch“ kommen erst
  nach rund viereinhalb Sekunden stillen Wartens; wer einmal nachschlägt, bleibt beim Nachschlagen, bis er
  antwortet, und jede Geste wird ausgespielt, bevor die nächste kommt. Denkt er nebenher (schreibt beim Zuhören
  schon mit, arbeitet beim Sprechen noch weiter), pulsiert die Antenne.
  Den Bildschirm füllt der **Roboter aus dem LLMitMir-Icon in 3D** (eigenes kleines WebGL, keine 3D-Bibliothek): weiße
  Schale, grüne Gesichtsscheibe, leuchtende Augen, Antenne – menschenähnlich in Haltung und Gesten, in der Oberfläche
  klar eine Maschine. Er ist durchgehend in Bewegung und zeigt, was gerade passiert: **Zuhören** (beugt sich vor, Hand
  hinters Ohr, die Ohren leuchten mit der Stimme), **Warten** (schaut sich um, wiegt sich), **Nachdenken** (Hand ans
  Kinn, Blick nach oben, Antenne pulsiert), **Recherchieren** (tippt auf einer schwebenden Tafel, Augen lesen Zeilen,
  Lichtpunkte kreisen um die Antenne) und **Antworten** (der Mund bewegt sich mit der Lautstärke der Stimme, die Hände
  gestikulieren). Tippen auf den Roboter unterbricht die Antwort, das Mikrofon lässt sich pausieren (nach fünf Minuten
  Stille von selbst), optional unterbricht auch Dazwischenreden. Der Bildschirm bleibt während des Gesprächs an.
  Voraussetzung fürs Mikrofon: HTTPS und kein `Permissions-Policy: microphone=()` am Webserver.
- **Hinweis nach einem Update**: Eine offene Seite – vor allem die Home-Assistant-App, die ihre Ansicht tagelang
  behält – arbeitet nach einem Update mit der alten Oberfläche weiter, bis sie vollständig neu geladen wird. Das Panel
  vergleicht deshalb seine eigene Version mit der des Servers (beim Start und nach jedem Wiederverbinden) und bietet
  oben *Neu laden* an.
- **Entwurf je Chat und je Projekt**: Was halb getippt ist und welche Dateien schon angehängt sind, bleibt beim Wechsel
  in einen anderen Chat erhalten und steht beim Zurückkommen wieder da – auch auf der Startseite und auf einer
  Projektseite, wo ein neuer Chat oder Cowork beginnt. Wer dort etwas tippt, kurz in einen Chat schaut und zurückkommt,
  findet den Text wieder vor (im Browser, nicht über ein Neuladen der Seite hinweg).
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
- **Besonders aufwändige Aufgaben**: Normal hat ein Lauf 60 Schritte. Reicht das nicht, markiert man die Aufgabe als
  besonders aufwändig und gibt ihr damit bis zu 150 Schritte. Erreicht eine Aufgabe ohne diese Markierung die 60 Schritte,
  wird sie unter *Geplant* rot markiert („Schritte erschöpft“) und lässt sich dort mit einem Klick für 150 Schritte
  freigeben – wie ein Zugang, dessen Prüfung fehlgeschlagen ist.
- **Aufgaben teilen**: Eine Aufgabe gehört der Person, die sie anlegt. Sie lässt sich mit anderen Personen der
  HA-Instanz teilen – je Person einstellbar, ob sie die Aufgabe nur sieht, sie auch ändern und starten darf und ob sie
  bei jedem Lauf eine Nachricht aufs eigene Gerät bekommt. Geteilte Aufgaben stehen bei allen unter *Geplant* mit dem
  Namen der Besitzerperson; löschen und weitergeben kann sie nur die Besitzerperson, Läufe laufen immer auf deren
  Schlüssel, Kontingent und Freigaben. Deshalb ändern Bearbeitende nie Freigaben, Werkzeuge, Werkbank, Modell oder
  Projekt, und ein geänderter Auftrag läuft erst, wenn die Besitzerperson ihn bestätigt (Karte auf der Startseite, Push).
- **Passendes Modell, auch unter Last**: LLMitMir lädt die Modellliste alle drei Minuten neu – bei SAIA mit Auslastung
  (`demand`) und Veröffentlichungsdatum, der Abruf zählt nicht zum Limit. „Standard“ wählt für Chat, Cowork/Aufgaben und
  Bildlesen das am besten geeignete Modell, das gerade nicht überlastet ist; neu erscheinende Modelle werden automatisch
  freigegeben und anhand ihrer Vorgänger eingeschätzt (`models.py`), zurückgezogene ersetzt. Das Modellmenü zeigt die
  Auslastung als Punkt. Vor dem Senden an ein stark ausgelastetes Modell und wenn ein Modell 20 s lang nichts liefert,
  schlägt der Chat ein freies, ähnlich gutes vor – der Wechsel geht mitten im Lauf und macht beim aktuellen Schritt
  weiter. Geplante Aufgaben mit Standardmodell wechseln nach drei Minuten ohne Antwort selbst. „Stopp“ greift auch,
  während ein Modell hängt.
- **Dashboards**: farbige Übersichten aus Kacheln auf einem Raster wie ein Handy-Startbildschirm (12 Spalten, auf dem
  Tablet 6, auf dem Handy 4 – das rechnet die Oberfläche selbst um). Kacheltypen: Kennzahl mit Verlauf, Diagramm (Linie,
  Fläche, Balken, Donut), Warnungen, Tabelle, Liste mit Status, Fortschritt, 5×5-Risikomatrix, Messuhr, 3D-Szene aus
  Grundkörpern und Notiz – alles selbst gezeichnet (SVG und WebGL), ohne Diagramm-Bibliothek. Eine Kachel wird einmal
  angelegt und lässt sich auf beliebig vielen Dashboards wiederverwenden; Farbwelten je Dashboard, Ziehen, Größe
  ändern, Tastaturbedienung und lange Drücken auf dem Handy im Bearbeitenmodus.
  - **Daten aus Home Assistant, ohne Modell**: Zustand, Verlauf, Langzeitstatistik, Kalender und To-do-Listen kommen live
    im Browser der anschauenden Person an – keine KI-Aufrufe, keine Kosten. Regeln setzen den Status („unter 20 % →
    Warnung“), Muster wie `sensor.*_battery` sammeln Entitäten ein. HA-Admins können zusätzlich Jinja-Vorlagen nutzen.
  - **Daten von einem geplanten Lauf**: Was Home Assistant nicht weiß (etwa Aufgaben aus Mails), holt eine Kachel-Aufgabe.
    Ihre Beschreibung ist der Auftrag; Datenformat, letzter Stand und „am Ende `dashboard_update`“ fügt LLMitMir selbst
    hinzu. Kachel-Läufe haben eine eigene Warteschlange (normale Aufgaben warten nie auf sie), ein Tagesbudget je Person
    (Admin, Standard 96), höchstens einen Lauf alle 15 Minuten, 30 Schritte, kein Nachholen nach einem Neustart und
    pausieren, solange die Kachel nirgends liegt. „Nur bei Änderung“ überspringt Läufe, wenn sich gewählte Entitäten
    nicht geändert haben. Ein Lauf ohne gültige Daten gilt als Fehler; Verlauf und Delta führt der Server, alte Läufe
    werden aufgeräumt (die letzten 10 bleiben). Unter *Geplant* erscheinen sie nur mit dem Schalter „Kachel-Aufgaben“.
  - **Tabellen**: Spalten mit Text, Datum, Zahl (rechtsbündig) oder Chip, sortierbar per Klick auf die Kopfzeile. Je
    Spalte lassen sich Zellen **fett** setzen (`strong`) und **einfärben** (`color`, `#rrggbb`). Eine optionale
    **Fußzeile** (`footer`) zeigt eine Summenzeile: abgesetzt wie die Kopfzeile, fett, mit oberer Trennlinie, und beim
    Scrollen langer Tabellen unten stehen bleibend. Fett und Farbe gelten dort genauso; die Fußzeile wird nicht
    mitsortiert.
  - **Teilen**: Dashboards und Kacheln je Person mit *ansehen*, *bearbeiten* oder *bearbeiten und weiter teilen*, oder
    für alle (auch künftige Personen). Weitergegeben wird nie mehr, als man selbst darf; wer ein Recht verliert, nimmt
    alles mit, was er weitergegeben hat. Auf einem geteilten Dashboard sieht jede Person nur die Kacheln, die für sie
    freigegeben sind. Modell-Kacheln laufen mit den Zugängen der Eigentümer*in – „für alle“ geht bei ihnen nur als
    *ansehen*, und ändert jemand anderes die Beschreibung, läuft die Kachel erst wieder, wenn die Eigentümer*in bestätigt.
- **Projekte**: Anweisungen, Dateien, Zugänge (dem Projekt zugeordnete Zugänge sind darin vorab erlaubt), Skills, Modelle und Freigaben als Kontext für Chats, Coworks und Aufgaben.
- **Lebensdauer**: Chats und Coworks können sich nach einer Frist selbst löschen – je Projekt eine eigene Frist, für
  alles außerhalb eines Projekts eine Frist in den Einstellungen der Person. Standardmäßig ist das aus; wer es
  einschaltet, bekommt 30 Tage vorgeschlagen, jede andere Zahl (bis 3650) geht auch. Gezählt ab der letzten Benutzung,
  geprüft stündlich und beim Start; gelöscht werden Chat, Anhänge, Arbeitsbereich und Sandbox. Angeheftete Chats und
  die Läufe geplanter Aufgaben bleiben. Das automatisch angelegte Projekt „Gespräche“ bringt seine Frist (14 Tage) mit.
- **Skills** im Format von `SKILL.md` (Name, Beschreibung, Anleitung, Dateien) – das Modell lädt sie bei Bedarf. Mit
  **„Nur für interne Modelle“** sehen externe Modelle einen Skill gar nicht, und ein Chat, der ihn geladen hat, nimmt kein
  externes Modell mehr an (siehe „Chats mit internen Daten für externe Modelle sperren“).
- **Zentrale Skills** (*Admin → Zentrale Skills*): gelten für alle Personen, erscheinen in deren Oberfläche nicht (die
  Inhalte sind nicht geheim). *Immer aktiv* steht als „Verbindliche Vorgaben dieser Installation“ im Systemprompt jedes
  Laufs, vor persönlichen Hinweisen und Projekt-Anweisungen und mit Vorrang vor ihnen, vor eigenen Skills und vor Bitten im
  Chat (Stilrichtlinien, Gebote und Verbote). *Bei Bedarf* steht mit „(zentral)“ in der Skill-Liste des Modells und wird mit
  `skill_load` geladen. Eigene Skills mit dem Namen eines zentralen Skills lassen sich weder anlegen noch importieren.
- **Skill-Richtlinien** (*Admin → Skill-Richtlinien*): Prüfungen für alle eigenen Skills – Muster (regulärer Ausdruck),
  Höchstlänge, verbotene Server, Geheimnisse im Klartext oder ein Prüfauftrag in Worten an ein Modell des Hauptanbieters
  (nie extern; der Skill gilt dabei als zu prüfender Text). Je Richtlinie eine Aktion: **sperren** (kein Modell sieht den
  Skill, auch nicht in der Werkbank; die Person sieht den Grund in Liste und Skill und bekommt eine Karte auf der
  Startseite), **Person benachrichtigen** oder **nur protokollieren**. Vorlagen: Widerspruch zu zentralen Vorgaben,
  Geheimnisse, Effizienz, Länge. Geprüft wird beim Speichern (auch im Chat), beim Import, sofort nach jeder Änderung der
  Richtlinien oder zentralen Skills und nachts um 3:17 alles Fällige. Solange eine sperrende Modell-Prüfung aussteht oder
  scheitert, bleibt der Skill gesperrt. Befunde stehen im Monitoring (`skill_check`) und in einer Übersicht auf der
  Admin-Seite (Person, Skill, Befund – ohne den Text des Skills).
- **Zugänge** getrennt von Skills: Das Modell sieht **nie** ein Geheimnis; Werkzeuge setzen Passwörter und Tokens
  serverseitig ein (`zugang`-Parameter oder Platzhalter `{{cred:Name:feld}}`), Ergebnisse werden geschwärzt. Ein Zugang
  geht nur an **seine Server** (aus seinen Adressen plus der Liste *Erlaubte Server*); für jeden anderen Server fragt
  LLMitMir vorher, geplante Aufgaben lehnen ab. Weiterleitungen auf fremde Server bekommen keine Zugangsdaten.
  Alle erlaubten Server auf einen Blick, nach Zugang, mit Entfernen und Hinzufügen: *Einstellungen → Datenschutz & Freigaben → Erlaubte Server*.
- **Plugins** (Hauptmenü und *Einstellungen → Plugins*, wie in der Claude-Desktop-App): eine Seite mit den Reitern
  *Konnektoren*, *Skills* und *Zugänge*. Skills und Zugänge, die zu einer Konnektor-Verbindung gehören, stehen in ihren
  Listen ausgegraut unter „… von Konnektoren“ mit dem Namen des Konnektors; öffnen, ändern oder löschen lassen sie sich
  nur über den Reiter *Konnektoren* (Backend: `via_connector`, im Chat lehnen `credential_*` und `skill_*` sie ab). So
  bleiben Verbindung, Zugang und Skill zusammen. Die alten Adressen `/skills`, `/credentials` und `/connectors` führen auf
  die passenden Reiter.
- **Konnektoren** (Reiter *Konnektoren*, eingerichtet unter *Admin → Zugänge & Konnektoren*, dort als Kacheln – ein
  Klick öffnet den Konnektor zum Bearbeiten): vom Admin vorbereitete Anbindungen nach dem Vorbild von Claude und Copilot.
  Der Admin legt Typ, feste Felder (z. B. die Adresse der Nextcloud), weitere erlaubte Server, bei GWDG/EWS die Dienste,
  die Anmeldeart, eine **Einrichtungsanleitung für den geführten Chat** und optional eine Anleitung für das Modell fest.
  Jede Person verbindet nur ihr eigenes Konto – **auch mehrfach** (z. B. GitLab mit je einem Token für verschiedene
  Projekte, bis zu 10 Verbindungen je Konnektor); jede Verbindung ist ein eigener Zugang mit eigenem Namen.
  - **Geführte Einrichtung:** „Konnektor einrichten“ öffnet einen eigenen Chat. Das Modell folgt der Einrichtungsanleitung
    des Admins, stellt immer nur eine Frage und hilft bei Problemen. Sobald die Anmeldedaten bereit sind, zeigt es mit
    `konnektor_verbinden` ein **Formular im Chat**: Passwort oder Token gehen direkt an LLMitMir, das Modell sieht sie nie.
    LLMitMir prüft die Verbindung sofort; schlägt das fehl, bleibt das Formular offen. Danach folgt der zweite Schritt
    **„Wofür darf der Zugang verwendet werden?“**: bei GWDG/EWS je Dienst „nur lesen“ oder „lesen und schreiben“, bei
    anderen Typen „nur lesen“ (empfohlen) oder „lesen und schreiben“, dazu die Freigabe für externe Modelle und ein
    Ablaufdatum. Anschließend fragt das Modell, ob ein **Skill** hinterlegt werden soll, und legt ihn mit
    `konnektor_skill` an (mit Bestätigung) – er gehört fest zu dieser Verbindung. Dasselbe Formular gibt es auf der Seite
    ohne Chat („Ohne Chat“) und für bestehende Verbindungen („Anmeldedaten“, „Rechte“, „Im Chat ändern“).
  - Bei Nextcloud geht die Anmeldung per **Login Flow v2**: Die Person meldet sich im Browser bei der Nextcloud an und
    erlaubt den Zugriff, LLMitMir bekommt ein eigenes App-Passwort in ihrem Nutzerkontext (das eigentliche Passwort sieht es
    nie; die Anmeldeseite muss auf der Nextcloud selbst liegen).
  - Daraus entsteht ein Zugang der Art „eigener Zugang“ mit Verweis auf den Konnektor; die festen Felder setzt LLMitMir bei
    jedem Speichern und nach jeder Änderung des Admins neu. Trennen löscht Zugang und Skill der Verbindung. Ist ein
    Konnektor ausgeschaltet oder gelöscht, sind seine Zugänge und deren Skills gesperrt. Die Anleitung für das Modell steht
    im Systemprompt, sobald der Zugang im Lauf sichtbar ist. Mit dem Schalter *Eigene Zugänge ohne Konnektor erlauben*
    (Vorgabe an) kann der Admin freie Zugänge abschalten – vorhandene bleiben nutzbar, neue gehen nur noch über
    Konnektoren. Freigabe je Agent gilt für Konnektor-Zugänge genauso.
  - **Im Chat sichtbar:** Läuft ein Werkzeugaufruf (z. B. `http_request`) über den Zugang eines Konnektors, trägt der
    Schritt im Chat ein Kennzeichen mit dem Namen des Konnektors (bei mehreren Verbindungen auch den der Verbindung) –
    ebenso die Frage nach der Freigabe des Zugangs.
- **„Nur lesen“ für alle Zugänge:** Zugänge ohne Dienste (Nextcloud, Token, API-Key, Basic Auth …) lassen sich auf „nur
  lesen“ stellen (beim Verbinden eines Konnektors oder auf der Seite des Zugangs). Schreibende Werkzeugaufrufe mit ihnen
  (z. B. `http_request` mit POST, `dav_write`, schreibende MCP-Werkzeuge) und Werkbank-Befehle mit ihren Platzhaltern
  lehnt LLMitMir ab. Exchange-Zugänge regeln das wie bisher je Dienst.
- **MCP-Server als Konnektor** (*Admin → Konnektoren*, Typ Bearer-Token, API-Key oder Basic Auth, Haken „MCP-Server“):
  Die feste Adresse ist der MCP-Endpunkt (Streamable HTTP, nur https). Der Admin ruft die Werkzeuge einmal ab (mit
  seinem Token, nur für den Abruf) und gibt sie einzeln frei, je Werkzeug „schreibt“ ja/nein (Vorschlag aus
  `readOnlyHint`). Die Liste ist **eingefroren**: Beschreibungen und Parameter stammen aus der Freigabe, nicht vom Server –
  neue oder veränderte Werkzeuge gelten erst nach erneutem Abrufen und Freigeben (Schutz vor eingeschleusten Texten).
  Jede Person verbindet den Konnektor mit ihrem eigenen Token. Die Werkzeuge heißen `mcp_<Konnektor>_<Werkzeug>`, stehen
  in der Werkzeuggruppe „Konnektoren (MCP)“ (im Chat und Cowork nach Rückfrage einschalten, in Aufgaben über deren
  Werkzeuge) und laufen durch Freigabe je Agent (der Zugang des Konnektors), Schreib-Freigaben, Datenregeln und
  Zugriffsprotokoll; an den Server gehen nur Argumente aus dem eingefrorenen Schema. Anmeldung per OAuth folgt später.
- **Datenregeln je Konnektor** (*Admin → Konnektoren → Datenregeln*): Regel = Geltungsbereich (Pfad oder Ordner mit `*`
  und `**`, z. B. `/Gruppen/Finanzen/**`; leer = ganzer Konnektor; Pfade werden vor dem Vergleich vereinheitlicht – dekodiert, ohne `.`/`..`, mit und ohne WebDAV-Präfix wie `files/<Name>/` – und lässt sich ein Pfad nicht sicher bestimmen, gilt die Regel) + **Anweisung in Worten** + für welche Modelle (nur
  externe oder alle). Beispiel: „Nur Dateien mit Tag public oder internal dürfen an externe Modelle, nie restricted;
  ungelabelte Dateien sind für alle Modelle gesperrt.“ Bevor ein Werkzeug Inhalte aus dem Bereich abruft, entscheidet ein
  **Wächter** – ein Modell des Hauptanbieters, nie extern – anhand der **Metadaten** (bei Nextcloud per PROPFIND: Tags,
  Systemtags, Typ, Größe, Besitzer; sonst Pfad und Ordner), nie anhand der Inhalte. Gesperrt heißt: Das Werkzeug läuft gar
  nicht, das Modell bekommt nur den Grund; scheitert die Prüfung, ist ebenfalls gesperrt. Entscheidungen gelten im Lauf
  weiter (Zwischenspeicher) und stehen im Monitoring (`data_rule`). Gilt eine Regel nur für externe Modelle und läuft ein
  Modell des Hauptanbieters, prüft der Wächter nicht – das Ergebnis wird markiert und beim Wechsel auf ein externes Modell
  aus dem Verlauf entfernt, und der Chat nimmt danach kein externes Modell mehr an (siehe „Chats mit internen Daten“); Dateien, die ein Abruf im Arbeitsbereich ablegt (`speichern_als`), prüft er dagegen immer wie
  für ein externes Modell. Werkbank-Befehle und freie HTTP-Anfragen mit Zugängen eines Konnektors mit Datenregeln sind
  gesperrt. Ordnerlisten (`dav_list`, `mail_folders`) gelten als Metadaten und werden nicht geprüft. Das Modell kennt die
  Regeln aus der Anleitung des Konnektors (Labels setzt es nie selbst), verlassen wird sich darauf nicht.
- **Freigabe je Agent**: Ein Zugang ist in einem Chat oder Cowork erst nutzbar, wenn die Person ihn freigibt. Beim
  ersten Gebrauch erscheint eine Karte „Zugang „X“ verwenden?“ (auch als Push und im Sprachgespräch): **Einmal
  erlauben** (nur dieser Aufruf), **Für diesen Chat/dieses Cowork erlauben** (gilt für alle weiteren Läufe darin) oder
  **Nicht erlauben** (der Lauf macht ohne den Zugang weiter und fragt in diesem Lauf nicht wieder). Teilaufgaben nutzen
  die Freigaben ihres Hauptchats, eine Freigabe aus einer Teilaufgabe gilt für den Hauptchat. **Vorab erlaubt** sind die
  Zugänge, die einem Projekt zugeordnet sind – für alle Chats, Coworks und Aufgaben darin. **Geplante Aufgaben und
  Kacheln** fragen nie: Sie nutzen nur die Zugänge, die in der Aufgabe bzw. Kachel (Abschnitt „Zugänge“) oder in ihrem
  Projekt erlaubt sind, und nennen jeden abgelehnten im Bericht. Beim Update auf diese Version bekamen vorhandene
  Aufgaben alle damals vorhandenen Zugänge (markiert zur Durchsicht). Jede Entscheidung steht im Zugriffsprotokoll.
- **Art des Zugangs** (Pflicht beim Anlegen, im Formular und wenn das Modell einen Zugang vorschlägt): *eigener
  LLMitMir-Zugang in meinem Nutzerkontext* (empfohlen – App-Passwort oder eigener Token mit minimalen Rechten, Tipps je
  Typ im Formular), *meine persönlichen Zugangsdaten* (abgeraten) oder *zentraler Systemzugang* (nur im Notfall und nur,
  wenn der Admin es unter *Admin → Zugänge* erlaubt; ohne Erlaubnis sind zentrale Zugänge gesperrt – kein Modell sieht
  oder nutzt sie). Zugänge ohne Art (von früher oder aus dem Import) zeigt die Liste mit „Art fehlt“. Der Admin sieht je
  Person, wie viele Zugänge welcher Art es gibt.
- **Exchange über EWS** (Typ „Exchange (EWS)“ und GWDG-Exchange): Kalender und Kontakte laufen über Exchange Web
  Services statt über CalDAV. Der Server beantwortet die Zeitraumabfrage selbst (`FindItem` mit `CalendarView`), es
  kommt also kein Archiv mit; jeder Eintrag hat eine stabile `item_id` samt `ChangeKey`, und Ändern wie Löschen
  adressieren genau diesen Eintrag – unabhängig von Dateinamen oder href. Werkzeuge: `ews_events` (Zeitraum),
  `ews_save` (anlegen, ändern, löschen, optional Einladungen an Teilnehmer), `ews_contacts` (Adressbuch). `caldav_events`
  bleibt für Nextcloud und leitet bei einem Exchange-Zugang an `ews_events` weiter, damit bestehende Skills gültig
  bleiben. Beim Typ „Exchange (EWS)“ trägt die Person EWS-Adresse (`…/EWS/Exchange.asmx`), Benutzername und Passwort
  selbst ein; beim GWDG-Exchange genügen E-Mail-Adresse und Passwort, den Endpunkt setzt LLMitMir
  (`https://email.gwdg.de/EWS/Exchange.asmx`).
- **NTLM-Anmeldung:** Der GWDG-Exchange bietet kein Basic Auth an – auf eine einfache Anmeldung antwortet er mit
  `401` und nur `WWW-Authenticate: Negotiate, NTLM`. LLMitMir meldet sich deshalb mit NTLMv2 an (`ntlm.py`, ohne
  Fremdbibliothek, MD4 nach RFC 1320 selbst mitgebracht): erst Basic, und wenn der Server nur NTLM anbietet, derselbe
  Aufruf mit NTLMv2. Die Zugangsdaten sind die, die die GWDG dokumentiert: **Benutzername `gwdg\userid`** – also die
  Benutzerkennung (z. B. `emuste1`, nicht die Adresse `erika.mustermann@gwdg.de`) mit der Domäne `gwdg` – und das
  Passwort. Die Kennung steht im GWDG-Zugang im eigenen Feld „Benutzerkennung“; fehlt sie, gilt der Teil der Adresse
  vor dem @. Gesendete Nachrichten tragen weiter die E-Mail-Adresse als Absender. Genau diese Form probiert LLMitMir
  zuerst; weitere
  Schreibweisen (volle Adresse, ohne Domäne) folgen nur, wenn der Server die erste ablehnt. Jeder Versuch bekommt
  einen **eigenen** Handschlag – eine Challenge ist nach einem 401 verbraucht, ein zweiter Type 3 darauf scheitert
  zwangsläufig. Bietet der Server `NEGOTIATE_VERSION` an, enthält die dritte Nachricht wie bei Windows ein
  Versionsfeld. Bleibt es beim 401, nennt die Fehlermeldung alle probierten Schreibweisen – dann stimmen Kennwort
  oder Benutzername nicht.
  Für Postfach und Kontakte gilt `BaseShape=Default` (bei `IdOnly` kennt Exchange `IsRead`, `From` und die
  Empfängerlisten nicht und antwortet mit HTTP 500). Ein reines Datum ist immer der lokale Kalendertag – auch bei
  ganztägigen Terminen, deren Ende genau einen Tag nach dem Start liegt. Fehlt beim Ändern der `change_key`, holt
  LLMitMir ihn selbst.
- **Postfach über EWS:** Bei einem Exchange-Zugang laufen auch die `mail_*`-Werkzeuge über EWS – so beschreibt die
  GWDG den Zugang für Exchange-Konten (Apple Mail, „manuell konfigurieren“); IMAP nennt sie nur als eingeschränkte
  Alternative. Ordner, Nachrichten, Senden, Zustände und Verschieben sind dieselben Werkzeuge wie bei IMAP; der
  MIME-Inhalt kommt als base64 und geht durch denselben Parser, Text und Anhänge verhalten sich also gleich. Gmail,
  Posteo und Co. bleiben bei IMAP/SMTP.
- **Ordner über den ganzen Baum:** `mail_folders` listet jeden Ordner mit vollem Pfad, Trennzeichen, Ordner-ID und
  Zählern – bei IMAP über `LIST "" "*"`, bei Exchange aus der `ParentFolderId`-Kette. Optional `baum: true` für eine
  eingerückte Ansicht, `tiefe` begrenzt die Ausgabe. `mail_list`, `mail_read` und `mail_change` lösen den Ordnernamen
  über den ganzen Baum auf: Ordner-ID, voller Pfad oder ein eindeutiges letztes Segment, unabhängig von der
  Schreibweise der Trennzeichen („Microsoft 365 > MPG“ = „Microsoft 365/MPG“). Gibt es denselben Namen zweimal (etwa
  „MPG“ oben und unter „Microsoft 365“), wird **nicht** stillschweigend geraten: Die Meldung nennt beide Pfade und
  verlangt Pfad oder ID. Ist nichts zu finden, schlägt sie die nächsten ähnlichen Pfade vor. Mit `alle_ordner: true`
  durchsucht `mail_list` den ganzen Baum und gibt zu jedem Treffer den Ordnerpfad aus – das greift auch, wenn eine
  Mail inzwischen woanders einsortiert ist.
- **GWDG-Exchange als eigener Zugangstyp** (unten in der Typ-Liste): E-Mail-Adresse, Benutzerkennung und Passwort eintragen (ohne @
  wird `@gwdg.de` ergänzt) und anhaken, wofür der Zugang gilt – **E-Mail-Postfach, Kalender und/oder Kontakte**.
  Postfach, Kalender und Kontakte laufen über EWS. Geprüft wird jeder angehakte Dienst einzeln (EWS-`GetFolder` auf
  Posteingang, Kalender bzw. Kontakte).
  **Je Dienst „nur lesen“ (Standard) oder „lesen und schreiben“**, durchgesetzt vor jeder Anfrage: Bei „nur lesen“
  brechen `mail_send` und `mail_change` ab, bevor eine SOAP-Anfrage rausgeht, `mail_read` markiert nichts als gelesen,
  und `ews_save` lehnt Anlegen, Ändern und Löschen ab. (Bei einem IMAP-Zugang öffnet `mailbox.Mailbox` Ordner nur mit
  EXAMINE und holt Nachrichten mit BODY.PEEK.) Damit sich das nicht umgehen lässt, gibt
  LLMitMir das Passwort eines Exchange-Zugangs nie heraus: kein Platzhalter {{cred:…:password}} (Werkbank, HTTP, DAV) und kein
  `http_request` mit diesem Zugang.
  Ältere WebDAV-Zugänge mit DavMail-URL behandelt LLMitMir weiter als GWDG-Kalender (DavMail, `dav_request`).
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
- **Freigaben aufs Handy**: Wartet eine Freigabe, kommt eine Push-Nachricht mit Chat, Werkzeug und – bei einem Befehl –
  dessen ersten Zeilen. Sie kommt auch dann, wenn das Panel gerade offen ist: Ein offenes Panel heißt nicht, dass die
  Person hinsieht (Tablet zu Hause, Handy unterwegs), und eine veraltete Verbindung darf die Meldung nicht dauerhaft
  verschlucken. Abschaltbar in den Einstellungen; fehlt ein Benachrichtigungsgerät oder scheitert das Senden, steht das
  als Warnung im Protokoll, statt still zu bleiben.
- **Benachrichtigungen an das eigene Gerät**: Welches Handy eine Push-Nachricht bekommt, ist keine freie Auswahl mehr.
  Home Assistant weiß, welche Person die App auf einem Gerät eingerichtet hat; jede Person wählt in den Einstellungen nur
  noch unter **ihren eigenen Geräten** (mit ihren lesbaren Namen, nie mit Kennungen). Unter *Admin → Benachrichtigungsgeräte*
  sieht der Admin, welches Gerät mit welcher Person verknüpft ist, und kann es korrigieren.
- **Benachrichtigungen auf der Startseite** (für Umgebungen ohne Push): Ergebnisse geplanter Aufgaben erscheinen als
  Karten auf der Startseite – im Stil der Benachrichtigungen eines Smartphones, mit kurzem Ton, wenn die Startseite
  gerade offen ist. Kurz tippen öffnet den Quellchat, lange drücken schaltet dessen Benachrichtigungen stumm, „×“ oder
  Wischen entfernt die Karte. In den Einstellungen wählt jede Person, ob die Karten erscheinen (*automatisch*: an,
  solange kein Push-Gerät gewählt ist; *immer*; *aus*) und wie lange sie stehen bleiben (5 Minuten bis 1 Tag oder bis
  sie von Hand entfernt werden).
- **Mehrere Personen**: Alles ist pro HA-Nutzer*in getrennt. Admins legen fest, wer LLMitMir nutzen darf, und wählen,
  ob es **einen gemeinsamen Schlüssel**, **einen Schlüssel je Person (vom Admin eingetragen)** oder **eigene Schlüssel** gibt.
- **Eigener Schlüssel für geplante Aufgaben** (optional), damit Aufgaben nicht das Kontingent für spontane Chats aufbrauchen.
  Der Admin wählt: derselbe Schlüssel wie für alles andere, ein **zentraler Aufgaben-Schlüssel für alle**, **jede Person
  entscheidet selbst** (ein Schlüssel für alles, eigener Aufgaben-Schlüssel oder zentraler Aufgaben-Schlüssel) oder
  **eigene Schlüssel verpflichtend** – dann gibt es keinen zentralen Aufgaben-Schlüssel, und wer Aufgaben anlegt, trägt in den
  Einstellungen einen eigenen ein; wer bereits einen eigenen Schlüssel für Chats und Coworks hat, darf denselben für alles
  nutzen. Fehlt der Schlüssel, startet kein Lauf, und das Ergebnis nennt den Grund. Unter *Geplant* steht, wie viele Anfragen
  und Tokens alle Aufgaben auf diesem Schlüssel je Tag verbrauchen; Läufe auf einem eigenen Aufgaben-Schlüssel zählen nicht zum
  persönlichen Tageskontingent.
- **Agenten-Identitäten und Zugriffsprotokoll** (*Admin → Monitoring*, nur für Admins): Jeder Lauf gehört zu einem
  Agenten mit fester ID – ein Chat, ein Cowork, ein Sprachgespräch oder eine Teilaufgabe ist `agt-<Chat-ID>`, eine geplante
  Aufgabe oder Kachel ist über alle ihre Läufe derselbe Agent `agt-<Aufgaben-ID>`; Teilaufgaben nennen ihren Eltern-Agenten.
  Protokolliert wird jeder Werkzeugaufruf, der andere Systeme erreicht (Home Assistant, Web, Nextcloud/WebDAV, Exchange,
  E-Mail, HTTP, Werkbank, Benachrichtigungen, Änderungen an Skills, Aufgaben, Zugängen und Dashboards), jede Rückfrage wegen
  eines nicht erlaubten Servers und jeder Laufbeginn – mit Werkzeug, Zugang, Server und Pfad (ohne Abfrage), Ordner,
  Dienst und Entitäten, Modell und Modellklasse (Hauptanbieter, extern, kostenpflichtig), Ergebnis und wer entschieden hat
  (ohne Rückfrage, dauerhaft erlaubt, einmal/immer erlaubt, von der Person abgelehnt, durch Regel gesperrt). **Inhalte
  kommen nie hinein**: keine Texte, Suchbegriffe, Abfrageparameter, Dateiinhalte, Empfänger (nur ihre Anzahl), Befehle oder
  Chat-Titel – das Ziel wird aus einer festen Liste von Argumenten gebildet. Interne Schritte (Fortschritt, eigene Dateien,
  Skills lesen, Teilaufgaben) bleiben draußen. Die Seite zeigt eine Übersicht (Aufrufe, mit Zugang, schreibend, abgelehnt,
  Fehler, extern, Agenten, Personen), filtert nach Zeitraum, Person, Ergebnis, Modellklasse, Agenten-Art, Zugang, Server,
  „nur mit Zugang“ und „nur schreibend“, führt per Klick auf einen Agenten zu allen seinen Zugriffen (mit Teilaufgaben) und
  lädt die Liste als CSV herunter. Der Reiter *Agenten* listet alle Agenten mit erster und letzter Aktivität, Läufen,
  Aufrufen, benutzten Zugängen und ob sie gerade laufen. Ablage: `.storage/llmitmir_audit/` (eine Datei je Tag);
  Aufbewahrung einstellbar (7 bis 3650 Tage, Vorgabe 180), ältere Tage löscht LLMitMir stündlich.
- **Nutzerverwaltung mit Active Directory/LDAP** (*Admin → Nutzerverwaltung*, optional, Vorgabe aus): LLMitMir liest
  Personen per LDAPS (Bind-Konto mit Leserechten, Basis-DN, Filter, Attribut für den Anmeldenamen) und gleicht die
  Home-Assistant-Benutzer nach **Gruppen-Zuordnungen** ab – je Gruppe „Admin“ und „LLMitMir“ (Zugriff aufs Panel). Wer in
  einer zugeordneten Gruppe ist, bekommt einen Benutzer, verknüpft mit dem gewählten Anmeldeanbieter; Admin-Recht, Name
  und LLMitMir-Zugriff folgen den Gruppen; wer aus allen Gruppen fällt, im Verzeichnis gesperrt ist oder fehlt, wird
  **deaktiviert, nie gelöscht** (kommt er zurück, wieder aktiviert). Von Hand angelegte Benutzer bleiben unberührt (auch
  bei gleichem Anmeldenamen), der letzte aktive Admin wird nie deaktiviert oder herabgestuft. Erst der **Probelauf** zeigt
  alle Änderungen, dann führt „Abgleich ausführen“ sie aus (frisch geplant); auf Wunsch jede Nacht um 4:23. Jeder
  Abgleich steht im Monitoring (`admin_action`). **Anmeldung** mit dem Verzeichnis-Passwort über den HA-Anmeldeanbieter
  `command_line`, z. B. in `configuration.yaml`:

  ```yaml
  homeassistant:
    auth_providers:
      - type: homeassistant          # bisherige Benutzer
      - type: command_line
        command: /config/ldap-auth.sh   # prüft Benutzer/Passwort per ldapwhoami gegen LDAPS, Exit-Code 0 = gültig
        meta: true
  ```

  MFA richten die Personen wie bisher selbst ein. Python-Paket: `ldap3`.
- **Wartungsmodus vor Neustarts** (Dienste `llmitmir.prepare_restart` und `llmitmir.cancel_restart`, Sensor
  `sensor.llmitmir_laufende_agenten`): `prepare_restart` (Ankündigung `minutes`, Vorgabe 10; höchste Wartezeit
  `max_wait`, Vorgabe 30; `restart`, Vorgabe aus; `reason`) kündigt den Neustart allen Personen mit Zugang an – Karte auf
  der Startseite, Push an ihr Gerät und ein Hinweis über jeder Seite des Panels. Nach der Ankündigungszeit startet nichts
  Neues mehr (neue Nachrichten werden mit dem Hinweis abgelehnt, geplante Aufgaben warten in der Schlange; nach dem
  Neustart holt LLMitMir Fälliges nach), laufende Agenten dürfen bis zur Frist fertig werden. Dann ist die Wartung
  „bereit“ – mit `restart: true` startet LLMitMir Home Assistant selbst neu, sonst wartet ein Playbook oder eine
  Automation darauf: Zustand des Sensors = laufende Agenten, Attribut `wartung` = off/announced/draining/ready. Beispiel
  für ein Update von außen: `prepare_restart` mit `minutes: 5`, warten bis `wartung` = `ready`, dann neu starten.
  Beide Dienste sind Admin-Dienste (wie `homeassistant.restart`): Personen ohne Admin-Rechte werden abgewiesen,
  Automationen ohne Person dürfen sie aufrufen.
- **Trusted-AI-Zentrale** (*Admin → Monitoring → Zentrale*): **laufende Agenten** mit „Anhalten“ (alle Läufe samt
  Teilaufgaben); **Auffälligkeiten** der letzten 24 Stunden gegenüber den 14 Tagen davor (ungewöhnlich viele Aufrufe,
  viele Sperren, neue Server, Zugriffe aus Chats/Coworks zwischen 0 und 5 Uhr) – jeden Morgen um 6:07 als Karte für alle
  Admins; **Freigaben entziehen** für einen Zugang oder alle Zugänge einer Person („für diesen Chat erlaubt“ in allen
  Chats, Zugangslisten der Aufgaben und Kacheln, auf Wunsch die Vorab-Freigabe in Projekten); **Export** jedes Ereignisses
  an einen Webhook (JSON per POST, https, optional Token im Header) und/oder Syslog (RFC 5424 über UDP, TCP oder TLS,
  Octet-Counting), gefiltert nach Ereignisart, mit Testknopf und letztem Zustand. Admin-Eingriffe und jede Änderung
  der Admin-Einstellungen (welcher Bereich, nie Werte) stehen selbst im Protokoll (`admin_action`). Einen Konnektor sperrt der Admin unter *Konnektoren* (aus), externe Modelle je Person unter
  *Modelle*.
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
- **Externe Modelle des Hauptanbieters**: Auch Open-Weight-Anbieter bieten Modelle an, die gar nicht bei ihnen laufen – SAIA leitet
  sie an kommerzielle Anbieter weiter und kennzeichnet sie als „External“ (im Namen; erkannt werden außerdem ein Feld
  `external: true` und Kennungen wie bei SAIA: `claude-…` sowie `openai-…` außer den offenen `openai-gpt-oss-…`). LLMitMir behandelt sie
  **genauso wie die externen Modelle oben**: nie automatisch gewählt (auch nicht als Vorgabe, im Gespräch oder als Ausweichmodell bei
  Last), nur für Personen, die der Admin unter *Admin → Modelle → Externe Modelle des Hauptanbieters* anhakt, erst nach der
  Zustimmung, Zugänge nur mit Freigabe für externe Modelle (Ergebnisse gesperrter Zugänge werden aus dem Verlauf entfernt, jede
  Anfrage geschwärzt), Zugänge lassen sich mit ihnen nicht bearbeiten, Projektsperre, Teilaufgaben nur, wenn das Modell für den
  Hauptchat ausdrücklich gewählt ist. Im Modellmenü stehen sie als eigene Gruppe „Extern (über den Hauptanbieter)“. **Nur die Kosten
  entfallen:** Wie und zu welchem Preis der Anbieter diese Modelle einkauft, ist nicht bekannt – sie werden nicht in Euro gebucht, haben
  kein Monatslimit und zählen wie alle Modelle des Hauptanbieters zum normalen Kontingent.
- **Chats mit internen Daten für externe Modelle sperren** (`datalock.py`): Beim Wechsel auf ein externes Modell geht der
  ganze Verlauf mit. Ergebnisse gesperrter Zugänge nimmt LLMitMir zwar heraus, aber was ein Modell daraus gemacht hat
  (Zusammenfassungen in seinen Antworten, Argumente späterer Aufrufe, Dateien im Arbeitsbereich, Ergebnisse von
  Teilaufgaben), lässt sich nicht zuverlässig herauslösen. Deshalb bekommt ein Chat eine **dauerhafte Markierung**, sobald
  darin erfolgreich ein Werkzeug mit einem Zugang ohne Freigabe für externe Modelle lief (auch MCP-Werkzeuge eines
  Konnektors), der Wächter eine Datenregel nur für externe Modelle nicht geprüft hat, weil ein internes Modell lief, oder
  ein eigener Skill **„Nur für interne Modelle“** gelesen wurde. Die Markierung bleibt, auch wenn der Zugang später
  freigegeben wird, und gilt für die ganze Familie: Eine Teilaufgabe markiert ihren Hauptchat mit (gemeinsamer
  Arbeitsbereich, Ergebnisse fließen zurück) und ist gesperrt, solange ihr Hauptchat es ist. Ein markierter Chat nimmt
  **kein externes Modell** mehr an – nicht von Hand (im Modellmenü ausgegraut, mit Schloss und Grund), nicht als
  Ersatz-Angebot oder Notfall-Ausweichmodell, nicht bei geplanten Aufgaben; als letzte Schranke baut der Lauf keine
  Anfrage an ein externes Modell. Für ein externes Modell beginnt man einen neuen Chat. Chats von vor dieser Version
  durchsucht LLMitMir beim Öffnen oder beim nächsten Lauf einmal nach denselben Spuren. Der Admin kann die Sperre unter
  *Admin → Zugänge* abschalten (Standard: an); dann gilt nur das Herausfiltern. Unabhängig davon merkt sich jeder
  Werkzeug-Aufruf die IDs der benutzten Zugänge (`cred_ids`), damit das Herausfiltern auch nach dem Umbenennen oder Löschen
  eines Zugangs greift. Skills „nur für interne Modelle“ sehen externe Modelle nicht (weder in der Liste noch über
  `skill_load`, `skill_file` oder `llmitmir_info`), können sie nicht ändern, und ihre Dateien kommen erst in die Sandbox,
  wenn der Chat markiert ist. **Nicht abgedeckt:** was die Person selbst in den Chat schreibt oder hochlädt, und
  Home-Assistant-Daten (Zustände, Verlauf), die nicht über Zugänge laufen.
- **Import aus Claude**: Ein Prompt, den man in Claude einfügt, überträgt Skills (mit herausgelösten Zugangsdaten),
  geplante Aufgaben, Projekte und Erinnerungen über einen Einmal-Link (Freigaben importierter Aufgaben legt man beim Einschalten selbst fest). Chatverläufe kommen aus dem offiziellen
  Datenexport von claude.ai (ZIP hochladen).
- Läuft auf Desktop, Tablet und Smartphone; hell und dunkel nach HA-Theme; Deutsch und Englisch.
