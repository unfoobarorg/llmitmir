"""Prices and the cost ledger for usage-billed (external) models.

Pure functions without Home Assistant imports (unit-tested).

Every request to an external model is booked with its tokens and its cost in euros at the price that applied when it
was made – later price changes never rewrite the past. Prices come from a built-in list (US dollars per million
tokens, list prices of Anthropic, which Microsoft Foundry charges as well) converted with the admin's exchange rate, or
from a price the admin entered in euros. Models without a known price are never offered to anybody: without a price
there is no accounting and no limit.
"""
from __future__ import annotations

import re
from datetime import date

# USD per million tokens: input, output, cache read, cache write (5 minutes). Anthropic list prices, cached 2026-10-06.
# "long": higher prices once a prompt is longer than "above" tokens (Claude Haiku 5.5).
KNOWN_USD: dict[str, dict] = {
    "claude-fable-5-1": {"in": 10.0, "out": 50.0, "cache_read": 0.25, "cache_write": 12.5},
    "claude-fable-5": {"in": 10.0, "out": 50.0, "cache_read": 1.0, "cache_write": 12.5},
    "claude-opus-5-5": {"in": 4.0, "out": 20.0, "cache_read": 0.20, "cache_write": 5.0},
    "claude-opus-5": {"in": 5.0, "out": 25.0, "cache_read": 0.50, "cache_write": 6.25},
    "claude-opus-4-8": {"in": 5.0, "out": 25.0, "cache_read": 0.50, "cache_write": 6.25},
    "claude-opus-4-7": {"in": 5.0, "out": 25.0, "cache_read": 0.50, "cache_write": 6.25},
    "claude-opus-4-6": {"in": 5.0, "out": 25.0, "cache_read": 0.50, "cache_write": 6.25},
    "claude-sonnet-5-5": {"in": 2.0, "out": 10.0, "cache_read": 0.20, "cache_write": 2.5},
    "claude-sonnet-5": {"in": 2.0, "out": 10.0, "cache_read": 0.20, "cache_write": 2.5},
    "claude-sonnet-4-6": {"in": 3.0, "out": 15.0, "cache_read": 0.30, "cache_write": 3.75},
    "claude-haiku-5-5": {"in": 0.10, "out": 0.50, "cache_read": 0.01, "cache_write": 0.125,
                         "long": {"above": 100_000, "in": 0.50, "out": 2.50, "cache_read": 0.05, "cache_write": 0.625}},
    "claude-haiku-4-5": {"in": 1.0, "out": 5.0, "cache_read": 0.10, "cache_write": 1.25},
}
# Claude models LLMitMir looks for in a Microsoft Foundry resource (Foundry has no model list; deployments are found
# by asking for each name). Deployments with other names can be added by the admin.
CLAUDE_CANDIDATES = list(KNOWN_USD)
DEFAULT_USD_EUR = 0.86
PRICE_KEYS = ("in", "out", "cache_read", "cache_write")
ZERO = {"requests": 0, "input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "eur": 0.0}


def base_id(model_id: str) -> str:
    """``claude-sonnet-5-5`` for deployment names like ``claude-sonnet-5-5-2`` or ``my-claude-sonnet-5-5``."""
    m = (model_id or "").lower()
    if m in KNOWN_USD:
        return m
    for k in sorted(KNOWN_USD, key=len, reverse=True):
        if re.search(rf"(^|[^a-z0-9]){re.escape(k)}($|[^a-z0-9.])", m):
            return k
    return m


def price_eur(model_id: str, override: dict | None, usd_eur: float) -> dict | None:
    """Price in EUR per million tokens: the admin's price if set, otherwise the list price converted. None = unknown."""
    if override and _num(override.get("in")) is not None and _num(override.get("out")) is not None:
        p = {k: _num(override.get(k)) for k in PRICE_KEYS}
        p["cache_read"] = p["cache_read"] if p["cache_read"] is not None else round(p["in"] * 0.1, 6)
        p["cache_write"] = p["cache_write"] if p["cache_write"] is not None else round(p["in"] * 1.25, 6)
        p["source"] = "admin"
        return p
    usd = KNOWN_USD.get(base_id(model_id))
    if not usd:
        return None
    rate = usd_eur if usd_eur and usd_eur > 0 else DEFAULT_USD_EUR
    p = {k: round(usd[k] * rate, 6) for k in PRICE_KEYS}
    if usd.get("long"):
        p["long"] = {"above": usd["long"]["above"], **{k: round(usd["long"][k] * rate, 6) for k in PRICE_KEYS}}
    p["source"] = "list"
    return p


def _num(v) -> float | None:
    if v in (None, ""):
        return None
    try:
        f = float(str(v).replace(",", "."))
    except ValueError:
        return None
    return f if f >= 0 else None


def blended(price: dict | None) -> float:
    """One number to sort by: agent work reads far more than it writes, so input counts three times."""
    if not price:
        return 0.0
    return (3 * float(price.get("in") or 0) + float(price.get("out") or 0)) / 4


def cost(usage: dict, price: dict) -> float:
    """Cost in EUR of one request. ``usage``: input (uncached), output, cache_read, cache_write tokens."""
    p = price
    prompt = int(usage.get("input") or 0) + int(usage.get("cache_read") or 0) + int(usage.get("cache_write") or 0)
    if price.get("long") and prompt > int(price["long"].get("above") or 0):
        p = price["long"]
    return (int(usage.get("input") or 0) * p["in"] + int(usage.get("output") or 0) * p["out"]
            + int(usage.get("cache_read") or 0) * p["cache_read"]
            + int(usage.get("cache_write") or 0) * p["cache_write"]) / 1_000_000


def book(ledger: dict, user_id: str, model_key: str, usage: dict, eur: float, day: date | None = None,
         task: bool = False) -> dict:
    """Add one request to ``ledger[user][day][model]``. Nothing is ever removed: this is the permanent record."""
    day = (day or date.today()).isoformat()
    rec = ledger.setdefault(user_id, {}).setdefault(day, {}).setdefault(model_key, dict(ZERO))
    rec["requests"] += 1
    for k in ("input", "output", "cache_read", "cache_write"):
        rec[k] += int(usage.get(k) or 0)
    rec["eur"] = round(rec["eur"] + eur, 8)
    if task:
        rec["task_eur"] = round(rec.get("task_eur", 0.0) + eur, 8)
        rec["task_requests"] = rec.get("task_requests", 0) + 1
    return rec


def month_of(day: str) -> str:
    return day[:7]


def month_cost(ledger: dict, user_id: str, month: str | None = None) -> float:
    month = month or date.today().isoformat()[:7]
    return round(sum(r.get("eur", 0.0) for d, per in (ledger.get(user_id) or {}).items() if month_of(d) == month
                     for r in per.values()), 6)


def months(ledger: dict, user_id: str, count: int = 12, today: date | None = None) -> list[dict]:
    """Cost and tokens per month (oldest first, gaps filled), with the split by model."""
    today = today or date.today()
    keys = []
    y, m = today.year, today.month
    for _ in range(count):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    keys.reverse()
    out = {k: {"month": k, "eur": 0.0, "requests": 0, "input": 0, "output": 0, "cache_read": 0, "cache_write": 0,
               "task_eur": 0.0, "models": {}} for k in keys}
    for d, per in (ledger.get(user_id) or {}).items():
        row = out.get(month_of(d))
        if row is None:
            continue
        for model, r in per.items():
            for k in ("requests", "input", "output", "cache_read", "cache_write"):
                row[k] += int(r.get(k) or 0)
            row["eur"] += float(r.get("eur") or 0)
            row["task_eur"] += float(r.get("task_eur") or 0)
            mm = row["models"].setdefault(model, {"eur": 0.0, "requests": 0, "tokens": 0})
            mm["eur"] += float(r.get("eur") or 0)
            mm["requests"] += int(r.get("requests") or 0)
            mm["tokens"] += sum(int(r.get(k) or 0) for k in ("input", "output", "cache_read", "cache_write"))
    for row in out.values():
        row["eur"] = round(row["eur"], 4)
        row["task_eur"] = round(row["task_eur"], 4)
        for mm in row["models"].values():
            mm["eur"] = round(mm["eur"], 4)
    return list(out.values())


def days(ledger: dict, user_id: str, month: str | None = None) -> list[dict]:
    """Cost per day of one month (only days with usage)."""
    month = month or date.today().isoformat()[:7]
    out = []
    for d in sorted(ledger.get(user_id) or {}):
        if month_of(d) != month:
            continue
        per = ledger[user_id][d]
        out.append({"day": d, "eur": round(sum(float(r.get("eur") or 0) for r in per.values()), 4),
                    "requests": sum(int(r.get("requests") or 0) for r in per.values())})
    return out


def limit_for(limits: dict, default: float | None, user_id: str) -> float:
    """Monthly limit in EUR of a person; 0 = no external models at all (nobody gets them by accident)."""
    v = _num((limits or {}).get(user_id))
    if v is None:
        v = _num(default)
    return float(v or 0)
