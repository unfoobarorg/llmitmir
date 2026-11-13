"""NTLM-Anmeldung (NTLMv2) für Exchange-Server, die kein Basic Auth anbieten.

Der GWDG-Exchange antwortet auf eine einfache Anmeldung mit ``401`` und bietet nur ``Negotiate`` und ``NTLM`` an –
Basic Auth ist dort abgeschaltet. Deshalb meldet sich LLMitMir mit NTLMv2 an, so wie es die GWDG für Exchange-Konten
beschreibt (``gwdg\\userid``). Reine Funktionen ohne Home Assistant und ohne Fremdbibliothek: MD4 fehlt in modernen
OpenSSL-Builds, also steht es hier (RFC 1320) – NTLM braucht es für den Kennwort-Hash.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import struct
import time

M32 = 0xFFFFFFFF

NEGOTIATE_UNICODE = 0x00000001
NEGOTIATE_OEM = 0x00000002
REQUEST_TARGET = 0x00000004
NEGOTIATE_NTLM = 0x00000200
NEGOTIATE_ALWAYS_SIGN = 0x00008000
NEGOTIATE_EXTENDED_SESSIONSECURITY = 0x00080000
NEGOTIATE_TARGET_INFO = 0x00800000
NEGOTIATE_VERSION = 0x02000000
NEGOTIATE_128 = 0x20000000
NEGOTIATE_56 = 0x80000000

SUPPORTED = (NEGOTIATE_UNICODE | NEGOTIATE_NTLM | NEGOTIATE_ALWAYS_SIGN
             | NEGOTIATE_EXTENDED_SESSIONSECURITY | NEGOTIATE_128 | NEGOTIATE_56)

SIGNATURE = b"NTLMSSP\x00"


# ---------------------------------------------------------------- MD4 (RFC 1320)
def _rol(value: int, bits: int) -> int:
    return ((value << bits) | (value >> (32 - bits))) & M32


def md4(data: bytes) -> bytes:
    """MD4-Hash – nur für den NTLM-Kennwort-Hash nötig (in OpenSSL 3 nicht mehr enthalten)."""
    def f(x, y, z):
        return (x & y) | (~x & z)

    def g(x, y, z):
        return (x & y) | (x & z) | (y & z)

    def h(x, y, z):
        return x ^ y ^ z

    msg = bytearray(data)
    bitlen = (8 * len(data)) & 0xFFFFFFFFFFFFFFFF
    msg.append(0x80)
    while len(msg) % 64 != 56:
        msg.append(0)
    msg += bitlen.to_bytes(8, "little")

    a, b, c, d = 0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476
    for off in range(0, len(msg), 64):
        x = [int.from_bytes(msg[off + 4 * i: off + 4 * i + 4], "little") for i in range(16)]
        aa, bb, cc, dd = a, b, c, d
        for i in range(16):  # Runde 1
            s = (3, 7, 11, 19)[i % 4]
            if i % 4 == 0:
                a = _rol((a + f(b, c, d) + x[i]) & M32, s)
            elif i % 4 == 1:
                d = _rol((d + f(a, b, c) + x[i]) & M32, s)
            elif i % 4 == 2:
                c = _rol((c + f(d, a, b) + x[i]) & M32, s)
            else:
                b = _rol((b + f(c, d, a) + x[i]) & M32, s)
        for i, k in enumerate((0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15)):  # Runde 2
            s = (3, 5, 9, 13)[i % 4]
            v = (x[k] + 0x5A827999) & M32
            if i % 4 == 0:
                a = _rol((a + g(b, c, d) + v) & M32, s)
            elif i % 4 == 1:
                d = _rol((d + g(a, b, c) + v) & M32, s)
            elif i % 4 == 2:
                c = _rol((c + g(d, a, b) + v) & M32, s)
            else:
                b = _rol((b + g(c, d, a) + v) & M32, s)
        for i, k in enumerate((0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15)):  # Runde 3
            s = (3, 9, 11, 15)[i % 4]
            v = (x[k] + 0x6ED9EBA1) & M32
            if i % 4 == 0:
                a = _rol((a + h(b, c, d) + v) & M32, s)
            elif i % 4 == 1:
                d = _rol((d + h(a, b, c) + v) & M32, s)
            elif i % 4 == 2:
                c = _rol((c + h(d, a, b) + v) & M32, s)
            else:
                b = _rol((b + h(c, d, a) + v) & M32, s)
        a, b, c, d = (a + aa) & M32, (b + bb) & M32, (c + cc) & M32, (d + dd) & M32
    return struct.pack("<4I", a, b, c, d)


# ---------------------------------------------------------------- NTLMv2
def ntlm_hash(password: str) -> bytes:
    """NT-Hash: MD4 des Kennworts in UTF-16LE."""
    return md4(str(password or "").encode("utf-16-le"))


def ntlmv2_hash(user: str, domain: str, password: str) -> bytes:
    """NTLMv2-Hash: HMAC-MD5 über Benutzer (groß) und Domäne, mit dem NT-Hash als Schlüssel."""
    ident = (str(user or "").upper() + str(domain or "")).encode("utf-16-le")
    return hmac.new(ntlm_hash(password), ident, hashlib.md5).digest()


def type1(domain: str = "", workstation: str = "") -> bytes:
    """Erste Nachricht: welche Verfahren und Flags wir anbieten."""
    flags = SUPPORTED | REQUEST_TARGET
    dom = str(domain or "").upper().encode("ascii", "ignore")
    host = str(workstation or "").upper().encode("ascii", "ignore")
    offset = 32
    return (SIGNATURE + struct.pack("<I", 1) + struct.pack("<I", flags)
            + struct.pack("<HHI", len(dom), len(dom), offset)
            + struct.pack("<HHI", len(host), len(host), offset + len(dom))
            + dom + host)


def parse_type2(message: bytes) -> dict:
    """Zweite Nachricht des Servers: Flags, Server-Challenge und Ziel-Informationen."""
    if len(message) < 32 or not message.startswith(SIGNATURE):
        raise ValueError("Das ist keine NTLM-Antwort des Servers")
    flags = struct.unpack("<I", message[20:24])[0]
    challenge = message[24:32]
    target = b""
    if len(message) >= 48:
        # Ziel-Informationen: Länge (2), Maximallänge (2), Offset (4) – ab Byte 40
        ti_len, _ti_max, ti_off = struct.unpack("<HHI", message[40:48])
        if ti_len and ti_off + ti_len <= len(message):
            target = message[ti_off:ti_off + ti_len]
    return {"flags": flags, "challenge": challenge, "target_info": target}


# Windows 10 (10.0, Build 19041) – nur Anzeige, der Server prüft das Feld nicht
VERSION_WIN10 = b"\x0a\x00\x63\x4a\x00\x00\x00\x0f"


def type3(user: str, password: str, domain: str, challenge: bytes, target_info: bytes = b"",
          flags: int = SUPPORTED, client_challenge: bytes | None = None,
          timestamp: bytes | None = None, workstation: str = "") -> bytes:
    """Dritte Nachricht: der Beweis, dass wir das Kennwort kennen (NTLMv2).

    Bietet der Server ``NEGOTIATE_VERSION`` an (der GWDG-Exchange tut das), enthält die Nachricht wie bei Windows ein
    Versionsfeld – sonst lehnen manche Server ab, obwohl der Beweis stimmt.
    """
    client = client_challenge if client_challenge is not None else os.urandom(8)
    stamp = timestamp if timestamp is not None else struct.pack("<Q", int((time.time() + 11644473600) * 10_000_000))
    blob = (b"\x01\x01\x00\x00" + b"\x00\x00\x00\x00" + stamp + client + b"\x00\x00\x00\x00"
            + (target_info or b"") + b"\x00\x00\x00\x00")
    key = ntlmv2_hash(user, domain, password)
    nt_response = hmac.new(key, challenge + blob, hashlib.md5).digest() + blob
    lm_response = hmac.new(key, challenge + client, hashlib.md5).digest() + client

    dom = str(domain or "").encode("utf-16-le")
    usr = str(user or "").encode("utf-16-le")
    host = str(workstation or "").encode("utf-16-le")
    session_key = b""
    out_flags = (flags & SUPPORTED) | NEGOTIATE_UNICODE | NEGOTIATE_NTLM
    version = b""
    if flags & NEGOTIATE_VERSION:
        out_flags |= NEGOTIATE_VERSION
        version = VERSION_WIN10

    pos = 64 + len(version)
    parts = []
    for data in (lm_response, nt_response, dom, usr, host, session_key):
        parts.append((len(data), len(data), pos))
        pos += len(data)
    return (SIGNATURE + struct.pack("<I", 3)
            + b"".join(struct.pack("<HHI", *p) for p in parts)
            + struct.pack("<I", out_flags)
            + version
            + lm_response + nt_response + dom + usr + host + session_key)


def split_user(value: str, default_domain: str = "") -> tuple[str, str]:
    """``gwdg\\nikolaj.kopp`` → ("nikolaj.kopp", "gwdg"); ohne Domäne gilt die Vorgabe."""
    raw = str(value or "").strip()
    if "\\" in raw:
        dom, _, usr = raw.partition("\\")
        return usr.strip(), dom.strip() or default_domain
    return raw, default_domain


# ---------------------------------------------------------------- Ziel-Informationen
AV_NB_DOMAIN = 2
AV_DNS_DOMAIN = 4


def av_pairs(target_info: bytes) -> dict[int, bytes]:
    """Die AV_PAIRS aus den Ziel-Informationen als {Kennung: Wert}."""
    out: dict[int, bytes] = {}
    i = 0
    while i + 4 <= len(target_info):
        avid, avlen = struct.unpack("<HH", target_info[i:i + 4])
        if avid == 0:  # MsvAvEOL
            break
        out[avid] = target_info[i + 4:i + 4 + avlen]
        i += 4 + avlen
    return out


def target_domain(target_info: bytes) -> str:
    """Die Domäne, die der Server selbst nennt (NbDomain, sonst DnsDomain).

    Der GWDG-Exchange meldet hier ``UM`` (Domäne ``um.gwdg.de``) – nicht ``gwdg``. Für NTLMv2 muss die Domäne im
    Hash genau diese sein, sonst lehnt der Server mit 401 ab, obwohl das Kennwort stimmt.
    """
    pairs = av_pairs(target_info or b"")
    for avid in (AV_NB_DOMAIN, AV_DNS_DOMAIN):
        raw = pairs.get(avid) or b""
        if raw:
            try:
                return raw.decode("utf-16-le").strip()
            except UnicodeDecodeError:
                continue
    return ""


def candidates(username: str, domain_hint: str = "", server_domain: str = "") -> list[tuple[str, str]]:
    """Mögliche (Benutzer, Domäne)-Paare für die Anmeldung, das wahrscheinlichste zuerst.

    Exchange-Konten lassen sich auf verschiedene Weise anmelden: mit der Kennung und der Domäne des Servers, mit der
    vollen Adresse als Benutzername (UPN) oder ganz ohne Domäne. Statt eine Variante zu raten, probiert LLMitMir sie
    der Reihe nach durch und merkt sich die erste, die der Server annimmt.
    """
    raw = str(username or "").strip()
    local = raw.partition("@")[0] if "@" in raw else raw
    if "\\" in raw:
        dom, _, rest = raw.partition("\\")
        local, raw = rest.strip(), rest.strip()
        domain_hint = dom.strip() or domain_hint
    out: list[tuple[str, str]] = []
    for user, dom in ((local, server_domain), (raw, server_domain), (local, domain_hint),
                      (raw, ""), (local, "")):
        if user and (user, dom) not in out:
            out.append((user, dom))
    return out
