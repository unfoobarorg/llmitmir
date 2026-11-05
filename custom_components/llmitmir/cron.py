"""Pure cron helpers (no Home Assistant imports, unit-tested)."""
from __future__ import annotations

import re
from datetime import datetime, timedelta


def _field(spec: str, lo: int, hi: int) -> set[int]:
    out: set[int] = set()
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, s = part.split("/", 1)
            step = int(s)
        if part in ("*", ""):
            a, b = lo, hi
        elif "-" in part:
            a, b = (int(x) for x in part.split("-", 1))
        else:
            a = b = int(part)
        if a < lo or b > hi or a > b or step < 1:
            raise ValueError(f"Wert außerhalb {lo}–{hi}: {part}")
        out.update(range(a, b + 1, step))
    return out


def parse_cron(expr: str) -> tuple[set[int], set[int], set[int], set[int], set[int], bool, bool]:
    f = expr.split()
    if len(f) != 5:
        raise ValueError("Cron braucht 5 Felder: Minute Stunde Tag Monat Wochentag")
    dow = {d % 7 for d in _field(f[4].replace("7", "0") if f[4] == "7" else f[4], 0, 7)}
    return (_field(f[0], 0, 59), _field(f[1], 0, 23), _field(f[2], 1, 31), _field(f[3], 1, 12), dow,
            f[2] != "*", f[4] != "*")


def next_cron(expr: str, after: datetime) -> datetime:
    """Next local time matching the cron expression (dow: 0 = Sunday)."""
    mi, ho, dom, mon, dow, dom_r, dow_r = parse_cron(expr)
    t = (after + timedelta(minutes=1)).replace(second=0, microsecond=0)
    for _ in range(366 * 24 * 60):
        if t.month not in mon:
            t = (t.replace(day=1, hour=0, minute=0) + timedelta(days=32)).replace(day=1)
            continue
        cron_dow = (t.weekday() + 1) % 7
        if dom_r and dow_r:
            day_ok = t.day in dom or cron_dow in dow
        else:
            day_ok = t.day in dom and cron_dow in dow
        if not day_ok:
            t = t.replace(hour=0, minute=0) + timedelta(days=1)
            continue
        if t.hour not in ho:
            t = t.replace(minute=0) + timedelta(hours=1)
            continue
        if t.minute not in mi:
            t += timedelta(minutes=1)
            continue
        return t
    raise ValueError("Kein nächster Termin gefunden")


def schedule_to_cron(s: dict) -> str | None:
    """UI schedule -> cron. Returns None for one-off runs."""
    typ = s.get("type") or "daily"
    hh, mm = 8, 0
    if re.match(r"^\d{1,2}:\d{2}$", str(s.get("time") or "")):
        hh, mm = (int(x) for x in s["time"].split(":"))
    if typ == "cron":
        parse_cron(s.get("cron") or "")
        return s["cron"].strip()
    if typ == "hourly":
        return f"{int(s.get('minute') or 0)} * * * *"
    if typ == "interval":
        h = max(1, min(int(s.get("hours") or 2), 23))
        return f"{mm} */{h} * * *"
    if typ == "weekdays":
        return f"{mm} {hh} * * 1-5"
    if typ == "weekly":
        days = sorted({int(d) % 7 for d in (s.get("days") or [1])})
        return f"{mm} {hh} * * {','.join(map(str, days))}"
    if typ == "monthly":
        return f"{mm} {hh} {int(s.get('day') or 1)} * *"
    if typ == "once":
        return None
    return f"{mm} {hh} * * *"



def describe(s: dict) -> str:
    typ = s.get("type") or "daily"
    t = s.get("time") or "08:00"
    names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
    return {
        "daily": f"täglich um {t}",
        "weekdays": f"werktags um {t}",
        "weekly": f"{', '.join(names[int(d) % 7] for d in (s.get('days') or [1]))} um {t}",
        "monthly": f"am {s.get('day') or 1}. jedes Monats um {t}",
        "hourly": f"stündlich zur Minute {s.get('minute') or 0}",
        "interval": f"alle {s.get('hours') or 2} Stunden",
        "once": f"einmalig am {s.get('at', '')}",
        "cron": f"Cron „{s.get('cron', '')}“",
    }.get(typ, typ)


