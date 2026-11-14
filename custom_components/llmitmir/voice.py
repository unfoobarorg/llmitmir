"""Sprachgespräch: Was das Modell wissen muss, wenn die Person spricht statt tippt (ohne Home Assistant testbar).

Das Panel hat eine eigene Ansicht, in der man mit LLMitMir spricht: Das Gesagte wird abgeschrieben und wie jede
andere Nachricht in den Chat gestellt, die Antwort wird vorgelesen. Der Chat bleibt ein ganz normaler Chat – nur
tragen gesprochene Nachrichten das Kennzeichen `voice`. Solange die letzte Nachricht der Person gesprochen war,
bekommt das Modell den Hinweis unten, damit sich die Antwort anhören lässt (keine Tabellen, keine Links, kurz).
Tippt die Person im selben Chat weiter, gilt wieder die normale Schreibweise.

Dazu gehoert, dass ein Gespraech nicht bei jeder Aktion stockt: Was die Person im Gespraech einmal erlaubt hat
(Werkzeug oder Werkzeuggruppe), gilt fuer den Rest des Gespraechs – `allowed`/`remember` und
`group_allowed`/`remember_group` merken es am Chat. Getippt wird weiterhin gefragt.
"""
from __future__ import annotations

VOICE_PROMPT = (
    "## Sprachgespräch\nDie Person spricht gerade mit dir: Ihre Nachricht wurde aus gesprochener Sprache abgeschrieben, "
    "deine Antwort wird ihr vorgelesen. Sie sieht den Text dabei nicht. Deshalb:\n"
    "- Antworte wie in einem natürlichen Gespräch: kurz, freundlich, in ganzen Sätzen. Meist reichen ein bis drei "
    "Sätze; mehr nur, wenn die Person ausdrücklich um Ausführlichkeit bittet.\n"
    "- Kein Markdown und nichts, das sich nicht vorlesen lässt: keine Überschriften, Listen, Tabellen, Code-Blöcke, "
    "Links, Emojis oder Sonderzeichen. Aufzählungen als Satz formulieren („erstens …, zweitens …“).\n"
    "- Zahlen, Uhrzeiten und Einheiten so schreiben, wie man sie spricht („halb acht“, „etwa zwanzig Grad“, "
    "„rund drei Euro“); gerundet, wenn die Genauigkeit nicht zählt.\n"
    "- Das Wichtigste zuerst. Gibt es viele Einzelheiten (lange Listen, Quellen, Dateien), nenne das Ergebnis in ein, "
    "zwei Sätzen und biete an, mehr zu erzählen – die Einzelheiten kann die Person später im Chat nachlesen.\n"
    "- Die Abschrift kann Hörfehler enthalten: Gemeintes aus dem Zusammenhang erschließen; ist etwas wirklich unklar, "
    "kurz nachfragen statt raten.\n"
    "- Brauchst du für die Antwort länger (Werkzeuge, Recherche), darfst du vorher in einem kurzen Satz sagen, was "
    "du tust („Ich schaue kurz nach.“) – das wird sofort vorgelesen und überbrückt die Wartezeit.\n"
    "- Braucht eine Aktion eine Freigabe, erscheint sie auf dem Bildschirm; sag der Person kurz, dass sie dort "
    "bestätigen kann. Was sie einmal erlaubt hat, gilt für den Rest des Gesprächs: Kündige eine Bestätigung nicht "
    "jedes Mal neu an und frage nicht von dir aus nach – mach einfach weiter."
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
