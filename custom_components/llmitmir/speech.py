"""Die Stimmen des Roboters.

LLMitMir bringt seine eigene Sprachausgabe mit, damit das Sprachgespräch überall gleich klingt – auf dem iPad,
im Browser und in der Home-Assistant-App auf Android, wo es keine brauchbare Stimme des Systems gibt. Gesprochen
wird auf dem Server, deshalb ist die Stimme unabhängig vom Gerät.

Drei Stimmen stehen zur Wahl:

- **Roboterstimme** (Standard): eine neutrale, männliche deutsche Stimme, nicht so tief wie eine Erzählerstimme,
  und im Browser mit einem leichten Maschinenklang versehen (Ringmodulation, etwas schlanker im Bass) – so klingt
  sie nach dem Roboter in der Ansicht „Gespräch“, bleibt aber gut verständlich.
- **Männliche Stimme (Conrad)**: die tiefe, ruhige Erzählerstimme, ohne Klangbearbeitung.
- **Weibliche Stimme (Tanja)**: eine natürliche Frauenstimme, ohne Klangbearbeitung – für alle, die lieber mit
  einer Frau sprechen.

Erzeugte Sätze bleiben im Arbeitsspeicher liegen: kurze Sätze („Einen Moment.“, „Ich schaue nach.“) werden nur
einmal geholt. Ist die Stimme nicht erreichbar, sagt das die Ansicht und liest mit der Sprachausgabe von Home
Assistant oder der Stimme des Browsers vor – notfalls bleibt der Text als Untertitel stehen.
"""
from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict

_LOGGER = logging.getLogger(__name__)

# Fest eingestellte Stimmen. „robot“ ist der Standard: neutraler und eine Spur höher als Conrad, dazu der
# Maschinenklang, den die Ansicht beim Abspielen hinzufügt (siehe voiceio.ts, Speaker). „tanja“ ist die
# weibliche Stimme – natürlich, ohne Klangbearbeitung.
VOICES: dict[str, dict] = {
    "robot": {"voice": "de-DE-KillianNeural", "name": "Killian", "label": "Roboterstimme",
              "rate": "-3%", "pitch": "+12Hz", "effect": True},
    "conrad": {"voice": "de-DE-ConradNeural", "name": "Conrad", "label": "Männliche Stimme",
               "rate": "-6%", "pitch": "-8Hz", "effect": False},
    "tanja": {"voice": "de-DE-TanjaNeural", "name": "Tanja", "label": "Weibliche Stimme",
              "rate": "-2%", "pitch": "+0Hz", "effect": False},
}
DEFAULT_VOICE = "robot"
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


def voice_id(voice: str | None) -> str:
    """Unbekannte Namen fallen auf den Standard zurück."""
    v = (voice or "").strip().lower()
    return v if v in VOICES else DEFAULT_VOICE


def enabled(cfg: dict | None) -> bool:
    """Hat der Admin die eigene Stimme eingeschaltet? (Admin → Sprachausgabe; Standard: an)"""
    return bool(((cfg or {}).get("speech") or {}).get("enabled", True))


def info() -> dict:
    return {"available": available(), "default": DEFAULT_VOICE, "languages": list(LANGUAGES),
            "voices": [{"id": k, "label": v["label"], "name": v["name"], "effect": bool(v["effect"])}
                       for k, v in VOICES.items()]}


def supports(lang: str | None) -> bool:
    """Gibt es die Stimmen für diese Sprache? (Vorerst nur Deutsch.)"""
    return (lang or "de").lower().startswith("de")


def _key(text: str, voice: str) -> str:
    v = VOICES[voice]
    return f"{v['voice']}|{v['rate']}|{v['pitch']}|{text}"


def _remember(key: str, audio: bytes) -> None:
    _cache[key] = audio
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX:
        _cache.popitem(last=False)


def cached(text: str, voice: str | None = None) -> bytes | None:
    return _cache.get(_key(text, voice_id(voice)))


async def synthesize(text: str, lang: str | None = "de", voice: str | None = None) -> bytes:
    """Text als MP3 (24 kHz mono). Gleiche Sätze kommen aus dem Zwischenspeicher."""
    text = " ".join((text or "").split())[:MAX_CHARS]
    if not text:
        raise ValueError("kein Text")
    if not supports(lang):
        raise ValueError(f"für {lang} gibt es die Stimme nicht")
    vid = voice_id(voice)
    key = _key(text, vid)
    hit = _cache.get(key)
    if hit:
        _cache.move_to_end(key)
        return hit
    lock = _locks.setdefault(key, asyncio.Lock())
    try:
        async with lock:
            hit = _cache.get(key)
            if hit:
                return hit
            audio = await _speak(text, vid)
            _remember(key, audio)
            return audio
    finally:
        # die Sperre je Satz nur, solange daran gearbeitet wird – sonst bliebe für jeden je gesprochenen Satz eine liegen
        if not lock.locked() and _locks.get(key) is lock:
            _locks.pop(key, None)


async def _speak(text: str, vid: str) -> bytes:
    try:
        import edge_tts
    except Exception as e:  # noqa: BLE001
        raise RuntimeError("die Sprachausgabe von LLMitMir ist nicht eingerichtet") from e
    v = VOICES[vid]
    comm = edge_tts.Communicate(text, v["voice"], rate=v["rate"], pitch=v["pitch"])
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
