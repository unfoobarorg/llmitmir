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
