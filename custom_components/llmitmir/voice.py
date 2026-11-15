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
    "- **Nachschlagen:** Brauchst du Werkzeuge, benutze sie gleich und ohne Ankündigung – die Ansicht sagt der "
    "Person von selbst kurz Bescheid („Ich schaue kurz nach“) und überbrückt die Wartezeit. Entschuldige dich nicht "
    "für Wartezeiten und beschreibe nicht, was du getan hast; sag einfach das Ergebnis. Nimm den kürzesten Weg: so "
    "wenige Werkzeugaufrufe wie möglich, mehrere unabhängige im selben Schritt.\n"
    "- **Freigaben:** Braucht eine Aktion eine Freigabe, erscheint sie auf dem Bildschirm und die Ansicht weist "
    "darauf hin. Was einmal erlaubt wurde, gilt für den Rest des Gesprächs: Kündige Bestätigungen nicht an und frage "
    "nicht von dir aus nach – mach einfach weiter."
)


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
