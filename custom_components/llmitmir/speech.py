"""Die feste Stimme des Roboters.

LLMitMir bringt seine eigene Sprachausgabe mit, damit das Sprachgespräch überall gleich klingt – auf dem iPad,
im Browser und in der Home-Assistant-App auf Android, wo es keine brauchbare Stimme des Systems gibt. Gesprochen
wird mit einer männlichen deutschen Stimme, etwas langsamer und tiefer als üblich: freundlich, ruhig, mit einem
leichten Maschinenklang, wie er zum Roboter in der Ansicht „Sprechen“ passt.

Die Stimme entsteht auf dem Server (nicht im Browser), deshalb ist sie unabhängig vom Gerät. Erzeugte Sätze
bleiben im Arbeitsspeicher liegen: kurze Sätze („Einen Moment.“, „Ich schaue nach.“) werden nur einmal geholt.
Ist die Stimme nicht erreichbar, sagt das die Ansicht und liest mit der Sprachausgabe von Home Assistant oder
der Stimme des Browsers vor – notfalls bleibt der Text als Untertitel stehen.
"""
from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict

_LOGGER = logging.getLogger(__name__)

# Fest eingestellte Stimme: männlich, deutsch, ruhig – und für den Roboter etwas langsamer und tiefer.
VOICE = "de-DE-ConradNeural"
VOICE_NAME = "Conrad"
VOICE_LABEL = "LLMitMir-Stimme"
RATE = "-6%"
PITCH = "-8Hz"
LANGUAGES = ("de",)

MAX_CHARS = 1200          # ein Stück je Anfrage; längere Texte teilt die Ansicht selbst in Sätze
CACHE_MAX = 160           # Sätze im Arbeitsspeicher (etwa 20 Minuten Gespräch)
TIMEOUT = 25              # Sekunden bis die Stimme geantwortet haben muss

_cache: "OrderedDict[str, bytes]" = OrderedDict()
_locks: dict[str, asyncio.Lock] = {}


def available() -> bool:
    """Ist die Sprachausgabe von LLMitMir eingerichtet? (Ohne Netzprüfung – die zeigt sich beim Sprechen.)"""
    try:
        import edge_tts  # noqa: F401
    except Exception:  # noqa: BLE001
        return False
    return True


def info() -> dict:
    return {"available": available(), "voice": VOICE, "name": VOICE_NAME, "label": VOICE_LABEL,
            "languages": list(LANGUAGES)}


def supports(lang: str | None) -> bool:
    """Gibt es die feste Stimme für diese Sprache? (Vorerst nur Deutsch.)"""
    return (lang or "de").lower().startswith("de")


def _key(text: str) -> str:
    return f"{VOICE}|{RATE}|{PITCH}|{text}"


def _remember(key: str, audio: bytes) -> None:
    _cache[key] = audio
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX:
        _cache.popitem(last=False)


def cached(text: str) -> bytes | None:
    return _cache.get(_key(text))


async def synthesize(text: str, lang: str | None = "de") -> bytes:
    """Text als MP3 (24 kHz mono). Gleiche Sätze kommen aus dem Zwischenspeicher."""
    text = " ".join((text or "").split())[:MAX_CHARS]
    if not text:
        raise ValueError("kein Text")
    if not supports(lang):
        raise ValueError(f"für {lang} gibt es die feste Stimme nicht")
    key = _key(text)
    hit = _cache.get(key)
    if hit:
        _cache.move_to_end(key)
        return hit
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _cache.get(key)
        if hit:
            return hit
        audio = await _speak(text)
        _remember(key, audio)
        return audio


async def _speak(text: str) -> bytes:
    try:
        import edge_tts
    except Exception as e:  # noqa: BLE001
        raise RuntimeError("die Sprachausgabe von LLMitMir ist nicht eingerichtet") from e
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    buf = bytearray()
    try:
        async with asyncio.timeout(TIMEOUT):
            async for chunk in comm.stream():
                if chunk.get("type") == "audio" and chunk.get("data"):
                    buf.extend(chunk["data"])
    except TimeoutError as e:
        raise RuntimeError("die Stimme hat nicht rechtzeitig geantwortet") from e
    if not buf:
        raise RuntimeError("die Stimme hat nichts geliefert")
    return bytes(buf)


def clear_cache() -> None:
    _cache.clear()
