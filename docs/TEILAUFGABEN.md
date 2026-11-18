# Teilaufgaben (Unterchats)

Ein Hauptchat kann Arbeit in **Teilaufgaben** auslagern: eigene Chats mit eigenem Verlauf, die nur eine
Zusammenfassung zurückmelden. So bleibt der Hauptchat kurz, token-sparsam und aufgeräumt. In der Oberfläche heißt das
„Teilaufgabe“, im Code „Unterchat“ (`parent_id`, `sub`).

## Was eine Teilaufgabe ist

- Ein normaler Chat (bzw. Cowork) mit dem Feld `parent_id` – Verlauf, Modellwechsel, Warteschlange und Dateiansicht
  funktionieren wie überall. Es gibt nur eine Ebene: Teilaufgaben haben keine eigenen Teilaufgaben.
- Sie übernimmt Art, Projekt, Werkzeugauswahl und die im Hauptchat eingeschalteten Werkzeuge.
- Sie arbeitet im **Dateibereich und in der Sandbox des Hauptchats**: Was sie erzeugt, ist dort sofort sichtbar.
  Eigene Dateien legt sie unter `sub-<id>/` ab, damit sich parallele Teilaufgaben nicht in die Quere kommen.
- Der Hauptchat liest **nie den Verlauf** einer Teilaufgabe, nur deren Zusammenfassung. Rückmeldungen stehen in seinem
  Verlauf als kleine Karte („Ergebnis aus Teilaufgabe ›Titel‹“); das Modell bekommt daraus eine kurze Nachricht.

## Seitenleiste

Teilaufgaben stehen direkt unter ihrem Hauptchat, eingerückt, mit eigenem Symbol und einem Status-Punkt:

| Punkt | Bedeutung |
|---|---|
| blau, pulsierend | läuft |
| gelb | wartet (auf eine Freigabe oder einen freien Platz) oder hat eine Grenze erreicht |
| grün | fertig |
| rot | Fehler |

Der Pfeil am Hauptchat klappt die Teilaufgaben ein und aus; ausgeklappt sind sie außerdem, solange eine läuft oder
wartet und solange man in einer davon ist. Wartet in einem Chat oder einer seiner Teilaufgaben eine Freigabe, trägt
der Chat einen gelben Punkt.

## Von Hand abzweigen

Unter jeder Antwort legt *Als Teilaufgabe weiterarbeiten* eine Teilaufgabe an. Der Text der Antwort wird zum
Ausgangspunkt; er steht eingeklappt oben in der Teilaufgabe und geht dem Modell als Hintergrund mit. Oben führt
„← Hauptchat“ zurück.

## Delegation durch das Modell

Der Hauptchat hat drei Werkzeuge:

| Werkzeug | Argumente | Wirkung |
|---|---|---|
| `unterchat_starten` | `titel`, `auftrag` (eigenständig, mit allem Nötigen), `modell` (`sparsam` \| `stark` \| `wie_hauptchat` \| Modell-ID), optional `werkzeuge`, `dateien` | legt die Teilaufgabe an, startet sie und wartet auf ihre Zusammenfassung |
| `unterchat_nachricht` | `id`, `text` | Folgeaufgabe an eine vorhandene Teilaufgabe, wartet wieder |
| `unterchat_ergebnis` | `id` | liest nur die letzte Zusammenfassung, nie den Verlauf |

- Wie das Task-Werkzeug in Claude Code wartet der Hauptchat im selben Schritt. Mehrere `unterchat_*`-Aufrufe in einem
  Schritt laufen parallel (`asyncio.gather`), alle anderen Werkzeuge weiter nacheinander.
- Die Teilaufgabe bekommt den Auftrag als erste Nachricht, die Skills und Zugänge des Hauptchats (oder nur die
  Werkzeuggruppen aus `werkzeuge`) und die im Hauptchat eingeschalteten Werkzeuggruppen. Sie kann keine weiteren
  Teilaufgaben starten.
- Zum Schluss ruft sie `ergebnis_melden(zusammenfassung, dateien)` auf. Fehlt das, bleibt eine kurze letzte Antwort
  unverändert; eine lange fasst ein sparsames Modell zusammen.
- Läufe geplanter Aufgaben starten keine Teilaufgaben.

### Modelle

`sparsam` ist die beste Wahl der neuen Rolle `sub` (Werkzeugaufrufe zuverlässig, Tempo und geringe Größe zählen mehr als
bei `agent`), `stark` die beste `agent`-Wahl, `wie_hauptchat` das Modell des Hauptchats. Das Modell für Teilaufgaben
lässt sich unter *Einstellungen → Modelle* (persönlich) und *Admin → Modelle* festlegen. Kostenpflichtige externe
Modelle nimmt eine Teilaufgabe nur, wenn die Person sie für den Hauptchat ausdrücklich gewählt hat; die Sperre externer
Modelle im Projekt und das Monatslimit gelten wie überall.

### Grenzen

| Grenze | Wert |
|---|---|
| gleichzeitig je Person | 3 (weitere warten auf einen freien Platz, das steht an ihrer Karte) |
| je Lauf des Hauptchats | 8 (eine neunte wird mit klarer Meldung abgelehnt) |
| Schritte je Teilaufgabe | 40 |

Erreicht eine Teilaufgabe eine Grenze (Schritte, Kontingent, Monatslimit, Anbieter dauerhaft ausgelastet) oder scheitert
sie, endet sie mit Stand `grenze` bzw. `fehler` und meldet sofort ein Teilergebnis samt Grund. Der Hauptchat entscheidet
dann: mit `unterchat_nachricht` weitermachen lassen, selbst übernehmen oder die Person fragen. Er wartet nie ohne Ende.
„Stopp“ im Hauptchat hält alle laufenden Teilaufgaben mit an.

### Karten im Hauptchat

Jede Teilaufgabe, die der Hauptchat startet, erscheint als Karte statt als Werkzeugzeile: Titel, Modell, Stand (läuft,
wartet auf einen freien Platz, wartet auf deine Freigabe, fertig, Grenze erreicht, Fehler), Laufzeit, Verbrauch und
*Öffnen*; die Zusammenfassung lässt sich aufklappen.

## Lebensdauer, Projekte, Löschen

- Teilaufgaben folgen ihrem Hauptchat: Löschen, Aufräumfrist und Projektwechsel wirken auf den ganzen Baum.
- Arbeit in einer Teilaufgabe zählt für die Aufräumfrist als Benutzung des Hauptchats.
- Anheften und Verschieben gibt es nur für Hauptchats.

## Datenmodell

| Feld | Wo | Bedeutung |
|---|---|---|
| `parent_id` | Teilaufgabe | ID des Hauptchats |
| `sub.auftrag` | Teilaufgabe | Auftrag bzw. Ausgangspunkt |
| `sub.status` | Teilaufgabe | `neu`, `laeuft`, `wartet`, `grenze`, `fertig`, `fehler`, `abgebrochen` |
| `sub.ergebnis` | Teilaufgabe | letzte Zusammenfassung für den Hauptchat (höchstens ca. 1.500 Tokens) plus Dateiliste |
| `sub.von` | Teilaufgabe | `agent` (vom Hauptchat angelegt) oder `person` (von Hand abgezweigt) |
| `sub.melden` | Teilaufgabe | ob neue Ergebnisse automatisch zurückgemeldet werden (Standard: ja) |
| `subs` | Hauptchat | IDs der Teilaufgaben in Reihenfolge |
| `role: "sub_result"` | Hauptchat | Rückmeldung im Verlauf: Teilaufgabe, Titel, Zusammenfassung, Dateien, Stand |

Die Logik ohne Home Assistant steckt in `custom_components/llmitmir/subchats.py` (getestet in `tests/test_pure.py`).
