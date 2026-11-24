"""Trusted-AI-Zentrale: Export des Zugriffsprotokolls (Webhook, Syslog) und Auffälligkeiten.

**Export** (Admin → Monitoring → Export): Jedes Ereignis, das ins Zugriffsprotokoll geht, kann zusätzlich an einen
Webhook (JSON, optional mit Token im Header) und/oder an einen Syslog-Server (RFC 5424 über UDP, TCP oder TLS) gehen –
gefiltert nach Ereignisart. Es gehen dieselben Metadaten hinaus wie im Protokoll, nie Inhalte. Fehler beim Senden
halten nichts auf; der letzte Fehler steht in der Admin-Ansicht.

**Auffälligkeiten**: aus den Ereignissen der letzten Tage – viele Aufrufe im Vergleich zum Durchschnitt, viele
Sperren, neue Server, nächtliche Aktivität in Chats und Coworks. Einmal täglich bekommen Admins eine Karte.

Formatierung und Auswertung sind HA-frei; das Senden bekommt Sitzung und Zeit von außen.
"""
from __future__ import annotations

import asyncio
import json
import socket
import ssl
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

KINDS = ("run", "tool", "host_approval", "cred_approval", "skill_check", "data_rule", "admin_action")
PROTOCOLS = ("udp", "tcp", "tls")
FACILITY = 16  # local0


def clean(raw: Any, old: dict | None = None) -> dict:
    """Export-Einstellungen prüfen. Ein Token gleich ``•••`` bleibt unverändert."""
    raw = raw if isinstance(raw, dict) else {}
    old = old or {}
    wh_raw, sl_raw = raw.get("webhook") or {}, raw.get("syslog") or {}
    wh_old = old.get("webhook") or {}
    url = str(wh_raw.get("url") or "").strip()
    if wh_raw.get("enabled") and not url.startswith("https://"):
        raise ValueError("Der Webhook braucht eine https-Adresse.")
    token = wh_raw.get("token")
    webhook = {"enabled": bool(wh_raw.get("enabled")), "url": url[:500],
               "header": str(wh_raw.get("header") or "Authorization").strip()[:60] or "Authorization",
               "token": wh_old.get("token", "") if token == "•••" else str(token or "")[:500]}
    host = str(sl_raw.get("host") or "").strip()
    proto = sl_raw.get("protocol") if sl_raw.get("protocol") in PROTOCOLS else "udp"
    try:
        port = int(sl_raw.get("port") or (6514 if proto == "tls" else 514))
    except (TypeError, ValueError):
        raise ValueError("Der Syslog-Port ist eine Zahl.") from None
    if sl_raw.get("enabled") and (not host or not 0 < port < 65536):
        raise ValueError("Syslog braucht Server und Port.")
    syslog = {"enabled": bool(sl_raw.get("enabled")), "host": host[:255], "port": port, "protocol": proto}
    kinds = [k for k in raw.get("kinds") or KINDS if k in KINDS] or list(KINDS)
    return {"webhook": webhook, "syslog": syslog, "kinds": kinds}


def view(cfg: dict) -> dict:
    """Für die Admin-Ansicht: Token maskiert."""
    c = json.loads(json.dumps(cfg or {}))
    if (c.get("webhook") or {}).get("token"):
        c["webhook"]["token"] = "•••"
    return c


def wanted(cfg: dict, events: list[dict]) -> list[dict]:
    kinds = set(cfg.get("kinds") or KINDS)
    return [e for e in events if e.get("kind") in kinds]


def severity(ev: dict) -> int:
    """Syslog-Schwere: Sperren und Ablehnungen als Warnung (4), Fehler als Hinweis (5), sonst Information (6)."""
    if ev.get("outcome") == "denied":
        return 4
    if ev.get("outcome") == "error":
        return 5
    return 6


def syslog_line(ev: dict, hostname: str) -> str:
    """RFC 5424: <PRI>1 Zeit Host App - MSGID - JSON."""
    ts = datetime.fromtimestamp(ev["ts"] if ev.get("ts") is not None else time.time(), tz=timezone.utc).isoformat(timespec="milliseconds")
    host = "".join(ch for ch in (hostname or "-") if 33 <= ord(ch) <= 126)[:255] or "-"
    msgid = str(ev.get("kind") or "-")[:32]
    return f"<{FACILITY * 8 + severity(ev)}>1 {ts.replace('+00:00', 'Z')} {host} llmitmir - {msgid} - " + json.dumps(
        ev, ensure_ascii=False, separators=(",", ":"))


async def send_webhook(session, wh: dict, events: list[dict]) -> None:
    headers = {"Content-Type": "application/json", "User-Agent": "LLMitMir"}
    if wh.get("token"):
        headers[wh.get("header") or "Authorization"] = wh["token"]
    async with session.post(wh["url"], json={"source": "llmitmir", "events": events}, headers=headers, timeout=20,
                            allow_redirects=False) as r:
        if r.status >= 300:
            raise ValueError(f"Webhook antwortet mit HTTP {r.status}")


async def send_syslog(sl: dict, events: list[dict], hostname: str | None = None) -> None:
    hostname = hostname or socket.gethostname()
    lines = [syslog_line(e, hostname).encode("utf-8") for e in events]
    loop = asyncio.get_running_loop()
    if sl["protocol"] == "udp":
        transport, _ = await loop.create_datagram_endpoint(asyncio.DatagramProtocol, remote_addr=(sl["host"], sl["port"]))
        try:
            for line in lines:
                transport.sendto(line[:8192])
        finally:
            transport.close()
        return
    ctx = ssl.create_default_context() if sl["protocol"] == "tls" else None
    reader, writer = await asyncio.wait_for(asyncio.open_connection(sl["host"], sl["port"], ssl=ctx), 15)
    try:
        for line in lines:
            writer.write(f"{len(line)} ".encode() + line)  # Octet-Counting (RFC 6587)
        await asyncio.wait_for(writer.drain(), 15)
    finally:
        writer.close()


# ------------------------------------------------------------------ Auffälligkeiten (rein)

def anomalies(events: list[dict], now_ts: float, days: int = 14, tz_hour=None) -> list[dict]:
    """Auffälligkeiten der letzten 24 Stunden im Vergleich zu den ``days`` Tagen davor.

    ``tz_hour(ts) -> Stunde`` (Ortszeit) für die Nachtregel; ohne sie gilt die lokale Zeit des Servers."""
    hour = tz_hour or (lambda ts: datetime.fromtimestamp(ts).hour)
    day_start = now_ts - 86400
    recent = [e for e in events if e.get("ts", 0) >= day_start]
    before = [e for e in events if day_start - days * 86400 <= e.get("ts", 0) < day_start]
    out: list[dict] = []
    calls_now = Counter(e.get("user") for e in recent if e.get("kind") == "tool")
    calls_before = Counter(e.get("user") for e in before if e.get("kind") == "tool")
    for user, n in calls_now.items():
        avg = calls_before.get(user, 0) / days
        if n >= 50 and n > 3 * max(avg, 10):
            out.append({"kind": "volume", "user": user, "text": f"{n} Werkzeugaufrufe in 24 Stunden (sonst ⌀ {avg:.0f} am Tag)"})
    denied = Counter(e.get("user") for e in recent if e.get("outcome") == "denied")
    for user, n in denied.items():
        if n >= 20:
            out.append({"kind": "denied", "user": user, "text": f"{n} abgelehnte oder gesperrte Zugriffe in 24 Stunden"})
    seen = defaultdict(set)
    for e in before:
        h = (e.get("target") or {}).get("host") or e.get("host")
        if h:
            seen[e.get("user")].add(h)
    new_hosts = defaultdict(set)
    for e in recent:
        h = (e.get("target") or {}).get("host") or e.get("host")
        if h and h not in seen[e.get("user")] and before:
            new_hosts[e.get("user")].add(h)
    for user, hosts in new_hosts.items():
        if hosts and any(e.get("user") == user for e in before):
            out.append({"kind": "new_hosts", "user": user, "text": "neue Server: " + ", ".join(sorted(hosts)[:8])})
    night = Counter(e.get("user") for e in recent if e.get("kind") == "tool" and e.get("agent_kind") in ("chat", "cowork", "voice")
                    and hour(e.get("ts", 0)) < 5)
    for user, n in night.items():
        if n >= 10:
            out.append({"kind": "night", "user": user, "text": f"{n} Zugriffe aus Chats/Coworks zwischen 0 und 5 Uhr"})
    return out


def revoke(chat_or_task: dict, cred_ids: set[str], key: str) -> bool:
    """Freigaben entziehen: ``cred_ok`` eines Chats oder ``cred_allow`` einer Aufgabe ohne die Zugänge."""
    cur = list(chat_or_task.get(key) or [])
    keep = [c for c in cur if c not in cred_ids]
    if keep == cur:
        return False
    chat_or_task[key] = keep
    return True
