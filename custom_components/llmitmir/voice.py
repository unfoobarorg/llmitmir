"""Sprachgespräch: Was das Modell wissen muss, wenn die Person spricht statt tippt (ohne Home Assistant testbar).

Das Panel hat eine eigene Ansicht, in der man mit LLMitMir spricht: Das Gesagte wird abgeschrieben und wie jede
andere Nachricht in den Chat gestellt, die Antwort wird vorgelesen. Der Chat bleibt ein ganz normaler Chat – nur
tragen gesprochene Nachrichten das Kennzeichen `voice`. Solange die letzte Nachricht der Person gesprochen war,
bekommt das Modell den Hinweis unten, damit sich die Antwort anhören lässt (keine Tabellen, keine Links, kurz).
Tippt die Person im selben Chat weiter, gilt wieder die normale Schreibweise.

Ein Gespraech ist kein Chat in Tonform. Menschen warten nicht, bis das Gegenueber ganz sicher fertig ist, bevor
sie nachdenken – sie fangen an, sobald der Satz rund klingt, und nehmen es hin, wenn noch etwas nachkommt. Die
Ansicht sendet deshalb frueh; spricht die Person doch weiter, bevor LLMitMir geantwortet hat, kommt der Nachsatz
mit `amend` und wird hier mit dem ersten Teil zu einer Nachricht verbunden (`amend_cut`, `merge`).

Dazu gehoert auch, dass ein Gespraech nicht bei jeder Aktion stockt: Was die Person im Gespraech einmal erlaubt hat
(Werkzeug oder Werkzeuggruppe), gilt fuer den Rest des Gespraechs – `allowed`/`remember` und
`group_allowed`/`remember_group` merken es am Chat. Getippt wird weiterhin gefragt.
"""
from __future__ import annotations

import re

VOICE_PROMPT = (
    "## Sprachgespräch\nDie Person spricht gerade mit dir – wie am Telefon. Ihre Nachricht wurde aus gesprochener Sprache "
    "abgeschrieben, deine Antwort wird ihr vorgelesen; sie sieht den Text dabei nicht. Es ist ein Gespräch, kein Chat "
    "in Tonform: Ihr wechselt euch in kurzen Beiträgen ab.\n"
    "- **Kurz und im Wechsel:** Ein Beitrag ist ein Gedanke – meist ein bis zwei Sätze, selten mehr als etwa vierzig "
    "Wörter. Sag das, wonach gefragt wurde, und gib das Wort zurück. Wer mehr wissen will, fragt nach – das geht im "
    "Gespräch schnell. Mehr am Stück nur, wenn die Person ausdrücklich darum bittet („erzähl ausführlich“, „lies vor“).\n"
    "- **Sofort zur Sache:** Der erste Satz ist kurz und trägt schon die Antwort – er wird gesprochen, während du den "
    "Rest noch formulierst. Keine Einleitung („Gerne!“, „Gute Frage“), keine Wiederholung der Frage, keine "
    "Zusammenfassung am Ende, keine Floskel wie „Kann ich sonst noch helfen?“.\n"
    "- **Nicht alles erzählen:** Gibt es viele Einzelheiten (lange Listen, mehrere Treffer, Quellen, Zahlenreihen), "
    "nenne das Wichtigste oder die Anzahl und biete den Rest an („Drei Termine, der erste um neun – soll ich alle "
    "nennen?“). Einzelheiten kann die Person später im Chat nachlesen.\n"
    "- **Wie man spricht:** Alltagssprache, ganze, aber kurze Sätze, gern mit „du“. Kein Markdown und nichts, das "
    "sich nicht vorlesen lässt: keine Überschriften, Listen, Tabellen, Code-Blöcke, Links, Emojis, Klammern oder "
    "Sonderzeichen. Aufzählungen als Satz. Zahlen, Uhrzeiten und Einheiten so, wie man sie sagt („halb acht“, „etwa "
    "zwanzig Grad“, „rund drei Euro“), gerundet, wenn die Genauigkeit nicht zählt.\n"
    "- **Mitdenken beim Zuhören:** Die Abschrift kann Hörfehler enthalten und mitten im Gedanken enden. Erschließe "
    "das Gemeinte aus dem Zusammenhang. Ist etwas wirklich unklar oder mehrdeutig, frag kurz zurück statt zu raten "
    "oder alle Möglichkeiten abzuarbeiten – eine Rückfrage ist ein guter Gesprächsbeitrag. Auf Kurzes („ja“, „danke“, "
    "„okay“) antwortest du ebenso kurz.\n"
    "- **Tempo geht vor:** Die Person wartet auf deine Stimme, oft ohne auf den Bildschirm zu sehen (im Auto). Die "
    "meisten Bitten sind klein und in ein, zwei Schritten erledigt. Nimm immer den kürzesten Weg: das eine passende "
    "Werkzeug direkt, mehrere unabhängige Aufrufe im selben Schritt, keine Kontrollabfragen, keine Vorarbeit „zur "
    "Sicherheit“. Rechne im Kopf; die Werkbank und lange Recherchen sind die Ausnahme, nicht der erste Griff.\n"
    "- **Nachschlagen:** Einfache Abfragen machst du sofort und ohne Ankündigung – die Ansicht sagt der Person von "
    "selbst, was du gerade tust. Weißt du dagegen nicht auf Anhieb, wie etwas geht, und musst erst suchen oder "
    "ausprobieren, sag das vorher in einem kurzen Satz („Das weiß ich nicht aus dem Kopf, ich schaue nach.“) – dann "
    "kann die Person abwarten oder abbrechen. Entschuldige dich nicht für Wartezeiten und beschreibe hinterher "
    "nicht, was du getan hast; sag das Ergebnis.\n"
    "- **Fehlende Skills erkennen:** Hat eine alltägliche Bitte (zum Beispiel „spiel den Podcast auf Spotify“) mehr "
    "als zwei, drei Schritte, Herumprobieren oder eine Recherche gebraucht, weil dir eine Anleitung fehlte, dann "
    "biete nach dem Ergebnis in einem Satz an, sie als Skill festzuhalten („Soll ich mir merken, wie das geht? Dann "
    "klappt es nächstes Mal sofort.“). Sagt die Person ja, lege den Skill mit `skill_save` an: wann er gilt und die "
    "wenigen Schritte, die zum Ziel geführt haben – mit den genauen Werkzeugen, Geräten und Namen. Fehlt dir dafür "
    "noch eine Angabe (welches Gerät, welches Konto), frag genau danach. Biete das je Aufgabe nur einmal an.\n"
    "- **Freigaben:** Braucht eine Aktion eine Freigabe, fragt die Ansicht die Person laut danach und versteht ihr "
    "gesprochenes Ja, Nein oder Immer. Kündige Bestätigungen nicht an und frage nicht von dir aus nach – ruf das "
    "Werkzeug einfach auf. Was einmal erlaubt wurde, gilt für den Rest des Gesprächs.\n"
    "- **Unterbrechen:** Die Person kann dich jederzeit mit „Stopp“ unterbrechen; dann endet dein Beitrag. Fang "
    "danach nicht von vorn an, sondern geh auf das ein, was sie als Nächstes sagt."
)


def clean_name(name) -> str:
    """Rufname: ein bis zwei Wörter, ohne Satzzeichen (leer = keiner festgelegt)."""
    words = re.findall(r"[^\W\d_][\w'’-]*", str(name or ""), flags=re.UNICODE)[:2]
    return " ".join(words)[:24]


def voice_prompt(name: str | None = None) -> str:
    """Der Hinweis fürs Gespräch – mit Rufnamen, falls die Person einen festgelegt hat."""
    name = clean_name(name)
    if not name:
        return VOICE_PROMPT
    return (VOICE_PROMPT + f"\n- **Dein Rufname:** Die Person nennt dich im Gespräch „{name}“ und ruft dich so, wenn sie "
            "dich braucht – du bist ihr Assistent, der im Hintergrund wartet. Der Name kann in der Abschrift am Anfang "
            "oder Ende stehen oder leicht verhört sein; er ist die Anrede, kein Teil der Bitte. Sag deinen Namen "
            "nicht selbst dazu.")


def is_voice_turn(messages: list[dict] | None) -> bool:
    """Wurde die letzte Nachricht der Person gesprochen? (Werkzeug- und Modellnachrichten danach zählen nicht.)"""
    for m in reversed(messages or []):
        if m.get("role") == "user":
            return bool(m.get("voice"))
    return False


# Am Chat gemerkt: was im laufenden Gespraech schon einmal erlaubt wurde
VOICE_ALLOWED = "voice_allowed"   # Werkzeuge (z. B. ha_service, dav_write)
VOICE_GROUPS = "voice_groups"     # Werkzeuggruppen (z. B. dav, mail)


def _remember(chat: dict, key: str, name: str) -> bool:
    """Namen am Chat merken, solange gesprochen wird. True = war neu."""
    if not name or not is_voice_turn(chat.get("messages")):
        return False
    names = chat.setdefault(key, [])
    if name in names:
        return False
    names.append(name)
    return True


def _known(chat: dict, key: str, name: str) -> bool:
    return is_voice_turn(chat.get("messages")) and name in (chat.get(key) or [])


def allowed(chat: dict, tool: str) -> bool:
    """Hat die Person dieses Werkzeug im laufenden Gespraech schon einmal erlaubt?"""
    return _known(chat, VOICE_ALLOWED, tool)


def remember(chat: dict, tool: str) -> bool:
    """Einmal erlaubt: im Rest des Gespraechs nicht wieder danach fragen."""
    return _remember(chat, VOICE_ALLOWED, tool)


def group_allowed(chat: dict, group: str) -> bool:
    """Ist diese Werkzeuggruppe im laufenden Gespraech schon einmal erlaubt worden?"""
    return _known(chat, VOICE_GROUPS, group)


def remember_group(chat: dict, group: str) -> bool:
    return _remember(chat, VOICE_GROUPS, group)


def amend_cut(messages: list[dict] | None) -> int | None:
    """Die Person hat weitergesprochen, bevor sie eine Antwort gehört hat: Ab welcher Stelle wird der Verlauf
    zurückgenommen, damit erster Teil und Nachsatz eine Nachricht werden?

    Liefert den Index der letzten gesprochenen Nachricht der Person – aber nur, wenn danach nichts Bleibendes
    geschah: höchstens angefangener Antworttext, kein Werkzeugaufruf und kein Werkzeugergebnis (was ein Werkzeug
    getan hat, lässt sich nicht zurücknehmen und soll im Verlauf stehen bleiben). Sonst None: der Nachsatz wird
    dann eine eigene Nachricht hinter dem bisherigen Verlauf."""
    msgs = messages or []
    for i in range(len(msgs) - 1, -1, -1):
        m = msgs[i]
        role = m.get("role")
        if role == "user":
            return i if m.get("voice") and not m.get("attachments") else None
        if role != "assistant" or m.get("tool_calls") or m.get("error"):
            return None
    return None


def merge(first: str, more: str) -> str:
    """Ersten Teil und Nachsatz zu einer Äußerung verbinden (die Spracherkennung setzt gern einen Punkt, wo die
    Person nur Luft geholt hat – der bleibt stehen, das Modell liest darüber hinweg)."""
    first, more = (first or "").strip(), (more or "").strip()
    if not first or not more:
        return first or more
    if first.endswith(("…", "...", ",", "-", "–")):   # mitten im Satz abgebrochen: ohne das Abbruchzeichen weiter
        first = first.rstrip(".…,-– ")
    return f"{first} {more}"
