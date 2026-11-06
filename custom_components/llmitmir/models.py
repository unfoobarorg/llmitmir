"""Which model fits a job best right now: quality per role, newer releases and current load.

Pure functions without Home Assistant, so they can be tested directly.

SAIA reports per model a ``status`` ("ready", …), a ``demand`` (load, 0 = idle) and ``created`` (release time).
Measured on 06.11.2026: demand 3 answered within a second, demand 5 sometimes at once and sometimes not within 150 s,
demand 6 never within 60 s. LLMitMir's own observations (a model just hung, or just answered quickly) refine this. Quality is not reported anywhere, so it comes from
a curated table; models released later are estimated from their siblings in the same family (a newer version of a
family counts slightly better than the one it follows) or, failing that, from their size.
"""
from __future__ import annotations

import math
import re
from typing import Any, Iterable

ROLES = ("chat", "agent", "vision")

# From this demand on a model counts as heavily loaded: answers can take minutes.
DEMAND_HIGH = 4
# Points subtracted from the quality for the current demand: up to 3 barely matters, 5 is a gamble, 6+ hangs.
_DEMAND_PENALTY = {0: 0, 1: 0, 2: 1, 3: 3, 4: 12, 5: 25}
_DEMAND_PENALTY_MAX = 50
# An alternative "solves the job similarly well" if it is at most this many points weaker.
SIMILAR_BAND = 12
# Never recommend a model that is weaker than this, even if everything else is loaded.
WORST_BAND = 25

# Quality per role (0–100), curated for SAIA as of November 2026. "agent" weighs reliable tool calls over many steps
# (and speed, since coworks and tasks make dozens of calls), "vision" reading images and scans.
QUALITY: dict[str, dict[str, int]] = {
    "glm-5.3": {"chat": 92, "agent": 89},
    "mistral-large-4-1t-a52b": {"chat": 90, "agent": 86, "vision": 86},
    "qwen3.5-397b-a17b": {"chat": 86, "agent": 85, "vision": 88},
    "deepseek-v4.1-flash-1017": {"chat": 85, "agent": 90},
    "deepseek-v4-flash-0731": {"chat": 81, "agent": 86},
    "qwen3.8-27b": {"chat": 79, "agent": 77, "vision": 80},
    "glm-5.3-flash": {"chat": 75, "agent": 75, "vision": 78},
    "gemma-4-31b-it": {"chat": 72, "agent": 64, "vision": 74},
    "qwen3.6-35b-a3b": {"chat": 70, "agent": 68, "vision": 72},
    "qwen3-coder-next": {"chat": 66, "agent": 78},
    "qwen3-30b-a3b-instruct-2507": {"chat": 58, "agent": 56},
    "qwen3-omni-30b-a3b-instruct": {"chat": 52, "agent": 40, "vision": 60},
    "eurollm-22b-instruct-2512": {"chat": 48, "agent": 25},
    "meta-llama-3.1-8b-instruct": {"chat": 35, "agent": 25},
}

_LIGHT = {"flash", "mini", "small", "lite", "nano", "tiny", "air", "turbo"}
_SPECIAL = {"coder", "omni", "math", "guard", "embed", "embedding", "reranker", "whisper", "tts", "ocr"}
# Models that cannot hold a conversation at all.
_NOT_CHAT = {"embed", "embedding", "reranker", "whisper", "tts", "guard"}


def demand_penalty(demand: Any) -> int:
    try:
        d = int(demand or 0)
    except (TypeError, ValueError):
        return 0
    return _DEMAND_PENALTY.get(d, _DEMAND_PENALTY_MAX if d > 5 else 0)


def parse(model_id: str) -> dict:
    """Family, version, size and flags from an id like ``qwen3.5-397b-a17b`` or ``deepseek-v4.1-flash-1017``."""
    s = (model_id or "").lower().split("/")[-1]
    s = re.sub(r"^meta-", "", s)
    fam = re.match(r"[a-z]+", s)
    family = fam.group(0) if fam else s
    words = set(re.findall(r"[a-z]+", s))
    version = 0.0
    total = active = None
    for tok in re.findall(r"(?<![a-z0-9.])(a?)(\d+(?:\.\d+)?)([a-z]*)", s):
        pre, num, unit = tok
        if unit in ("b", "t"):
            n = float(num) * (1000 if unit == "t" else 1)
            if pre == "a":
                active = n
            elif total is None:
                total = n
        elif not unit and not pre and not version and not (len(num) == 4 and "." not in num):
            version = float(num)  # 4-digit numbers are release dates (2507, 1017), not versions
    # "qwen3.5" / "v4.1": the version is glued to the family name
    glued = re.match(r"[a-z]+-?v?(\d+(?:\.\d+)?)(?![\d.]*[bt]\b)", s)
    if glued and not version:
        version = float(glued.group(1))
    return {"family": family, "version": version, "total_b": total, "active_b": active,
            "light": bool(words & _LIGHT), "special": sorted(words & _SPECIAL)}


def _can(info: dict, role: str) -> bool:
    inp = info.get("input") or ["text"]
    out = info.get("output") or ["text"]
    if "text" not in out or set(parse(info.get("id", ""))["special"]) & _NOT_CHAT:
        return False
    if role == "vision":
        return "image" in inp
    return "text" in inp


def quality(model_id: str, role: str, info: dict | None = None) -> int:
    """Quality of a model for a role; estimated for models that are not in the table."""
    info = info or {"id": model_id}
    q = QUALITY.get(model_id)
    if q:
        if role in q:
            return q[role]
        if role == "vision":
            return q["chat"] - 4 if "image" in (info.get("input") or []) else 0
        return q.get("chat", 50)
    return _estimate(model_id, role, info)


def _estimate(model_id: str, role: str, info: dict) -> int:
    p = parse(model_id)
    sib = [(mid, parse(mid)) for mid in QUALITY]
    sib = [(mid, sp) for mid, sp in sib if sp["family"] == p["family"] and sp["light"] == p["light"]
           and sp["special"] == p["special"]]
    if sib:
        # the newest known sibling that is not newer than this one; otherwise the oldest known one
        older = [x for x in sib if x[1]["version"] <= p["version"]]
        mid, sp = max(older, key=lambda x: (x[1]["version"], QUALITY[x[0]].get("chat", 0))) if older else \
            min(sib, key=lambda x: x[1]["version"])
        base = quality(mid, role, dict(info, id=mid)) if role != "vision" else \
            QUALITY[mid].get("vision") or QUALITY[mid].get("chat", 60) - 4
        if p["version"] > sp["version"]:
            base += 2  # a newer generation of the same line
        elif p["version"] < sp["version"]:
            base -= 4
        if p["total_b"] and sp["total_b"]:
            ratio = p["total_b"] / sp["total_b"]
            base += -8 if ratio < 0.4 else 3 if ratio > 2.5 else 0
    else:
        size = p["total_b"]
        base = 60 if not size else max(30, min(80, round(40 + 12 * math.log10(size))))
        if "thought" in (info.get("output") or []):
            base += 3
        if p["light"]:
            base -= 5
        if role == "agent":
            base -= 5
        if "coder" in p["special"]:
            base += 6 if role == "agent" else -6
    if role == "vision" and "image" not in (info.get("input") or []):
        return 0
    return int(max(1, min(99, base)))


def usable(info: dict) -> bool:
    return (info.get("status") or "ready") == "ready" and not info.get("gone")


def effective_demand(info: dict) -> int:
    """Reported demand, corrected by what LLMitMir saw itself in the last minutes: a model that hung counts as
    heavily loaded, one that just answered quickly at most as moderately loaded."""
    try:
        d = int(info.get("demand") or 0)
    except (TypeError, ValueError):
        d = 0
    if info.get("slow"):
        return max(d, DEMAND_HIGH)
    if info.get("fast"):
        return min(d, DEMAND_HIGH - 1)
    return d


def busy(info: dict) -> bool:
    return effective_demand(info) >= DEMAND_HIGH


def score(info: dict, role: str) -> float:
    """Quality minus load; ties go to the newer release."""
    q = quality(info["id"], role, info)
    return q - demand_penalty(effective_demand(info)) + min(float(info.get("created") or 0), 4e9) / 1e12


def candidates(models: Iterable[dict], role: str) -> list[dict]:
    return [m for m in models if usable(m) and _can(m, role) and quality(m["id"], role, m) > 0]


def pick(models: Iterable[dict], role: str, load_aware: bool = True) -> str | None:
    """The best model for the role right now (or by quality alone)."""
    cand = candidates(models, role)
    if not cand:
        return None
    key = (lambda m: score(m, role)) if load_aware else (lambda m: quality(m["id"], role, m) + float(m.get("created") or 0) / 1e12)
    return max(cand, key=key)["id"]


def alternative(models: Iterable[dict], current: str, role: str, need_image: bool = False) -> dict | None:
    """A less loaded model that does the job about as well as ``current``; None if there is none worth switching to."""
    models = list(models)
    cur = next((m for m in models if m["id"] == current), {"id": current})
    q_cur = quality(current, role, cur) if _can(cur, role) else 0
    roles = ("vision", role) if need_image else (role,)
    cand = [m for m in candidates(models, roles[0]) if m["id"] != current and not busy(m)
            and (not need_image or "image" in (m.get("input") or []))]
    if not cand:
        return None
    best = max(cand, key=lambda m: score(m, role))
    q = quality(best["id"], role, best)
    if q_cur and q < q_cur - WORST_BAND:
        return None
    return {"id": best["id"], "name": best.get("name") or best["id"], "demand": effective_demand(best),
            "quality": q, "similar": not q_cur or q >= q_cur - SIMILAR_BAND, "better": q > q_cur}


def merge_known(old: list[dict], fresh: list[dict], now: float) -> tuple[list[dict], list[str]]:
    """Merge a fresh /models answer into the stored list. Returns (known, ids of newly appeared models).

    Models that vanished stay for 30 days marked as gone, so chats and tasks pinned to them can fall back.
    """
    prev = {m["id"]: m for m in old if m.get("id")}
    out, new = [], []
    seen = set()
    for x in fresh:
        mid = x.get("id")
        if not mid:
            continue
        seen.add(mid)
        p = prev.get(mid) or {}
        if not p:
            new.append(mid)
        out.append({"id": mid, "name": x.get("name") or mid, "input": x.get("input") or ["text"],
                    "output": x.get("output") or ["text"], "status": x.get("status") or "ready",
                    "demand": x.get("demand"), "created": x.get("created") or p.get("created"),
                    "first_seen": (p.get("first_seen") or 0) if p else (now if old else 0)})
    for mid, p in prev.items():
        if mid in seen:
            continue
        gone_since = p.get("gone_since") or now
        if now - gone_since < 30 * 86400:
            out.append(dict(p, status="unavailable", gone=True, gone_since=gone_since, demand=None))
    return out, new
