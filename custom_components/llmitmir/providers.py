"""AI providers in the admin's order: the main (OpenAI-compatible, e.g. SAIA) provider and usage-billed external ones.

Pure functions without Home Assistant imports (unit-tested).

Order and modes decide which models a person may pick right now:
- the main provider and every external provider set to "always" can always be picked (when the person may use them),
- an external provider set to "fallback" ("only in an emergency") is unlocked only while every enabled provider before
  it in the order is not usable for this person – its key hit a limit, is blocked or missing, or (external providers)
  the person's monthly limit is used up.
LLMitMir never picks an external model by itself; it only offers them.
"""
from __future__ import annotations

import re

MAIN = "main"
FOUNDRY = "foundry"
ANTHROPIC = "anthropic"
EXTERNAL = (FOUNDRY, ANTHROPIC)
MODES = ("always", "fallback")

INFO = {
    MAIN: {"label": "Hauptanbieter", "operator": ""},
    FOUNDRY: {"label": "Microsoft Foundry (Azure)", "operator": "Microsoft Azure (Modelle von Anthropic)",
              "billing": "Abrechnung über deine Azure-Rechnung"},
    ANTHROPIC: {"label": "Claude API (Anthropic)", "operator": "Anthropic (USA)",
                "billing": "Abrechnung über die Anthropic Console"},
}


def defaults() -> list[dict]:
    return [
        {"id": MAIN, "type": MAIN},
        {"id": FOUNDRY, "type": FOUNDRY, "enabled": False, "mode": "fallback", "endpoint": "", "key": "",
         "extra_models": [], "models": []},
        {"id": ANTHROPIC, "type": ANTHROPIC, "enabled": False, "mode": "fallback", "key": "", "models": []},
    ]


def normalize(stored: list | None) -> list[dict]:
    """Stored list in the admin's order, completed with missing providers (each exactly once)."""
    base = {p["id"]: p for p in defaults()}
    out, seen = [], set()
    for p in stored or []:
        pid = p.get("id") if isinstance(p, dict) else None
        if pid not in base or pid in seen:
            continue
        seen.add(pid)
        merged = dict(base[pid], **p)
        if pid != MAIN:
            merged["mode"] = merged.get("mode") if merged.get("mode") in MODES else "fallback"
            merged["enabled"] = bool(merged.get("enabled"))
        out.append(merged)
    for pid, p in base.items():
        if pid not in seen:
            out.append(p)
    return out


def foundry_base(endpoint: str) -> tuple[str, str]:
    """("base_url", "") or ("", "resource") from what the admin pasted: the resource name, the resource URL, the base URL
    (…/anthropic) or the target URI of a deployment (…/anthropic/v1/messages)."""
    e = (endpoint or "").strip().rstrip("/")
    if not e:
        return "", ""
    if "://" not in e:
        if "." not in e and "/" not in e:
            return "", e  # just the resource name
        return foundry_base("https://" + e)
    m = re.match(r"https?://([a-z0-9-]+)\.(openai\.azure\.com|cognitiveservices\.azure\.com|services\.ai\.azure\.com)(/.*)?$",
                 e, re.I)
    if m:
        # any address of the resource (also the Azure OpenAI one, …/openai/v1): Claude lives under services.ai/anthropic
        return f"https://{m.group(1).lower()}.services.ai.azure.com/anthropic", ""
    for tail in ("/v1/messages", "/v1"):
        if e.endswith(tail):
            e = e[: -len(tail)]
    if not e.endswith("/anthropic"):
        e += "/anthropic"
    return e, ""


def model_key(pid: str, model_id: str) -> str:
    return model_id if pid == MAIN else f"{pid}:{model_id}"


def split(key: str) -> tuple[str, str]:
    """(provider id, model id). Main models keep their plain ids (they may contain ':' themselves)."""
    key = key or ""
    for pid in EXTERNAL:
        if key.startswith(pid + ":"):
            return pid, key[len(pid) + 1:]
    return MAIN, key


def is_external(key: str) -> bool:
    return split(key)[0] != MAIN


def unlocked(order: list[dict], usable: dict[str, bool]) -> dict[str, dict]:
    """Per provider: whether its models can be picked now and why ("always", "fallback" = emergency, "locked")."""
    out: dict[str, dict] = {}
    before_all_down = True  # every enabled provider before this one is unusable
    first = True
    for p in order:
        pid = p["id"]
        enabled = pid == MAIN or bool(p.get("enabled"))
        if not enabled:
            out[pid] = {"unlocked": False, "why": "disabled"}
            continue
        mode = "always" if pid == MAIN else p.get("mode") or "fallback"
        if first or mode == "always":
            out[pid] = {"unlocked": True, "why": "always"}
        elif before_all_down:
            out[pid] = {"unlocked": True, "why": "fallback"}
        else:
            out[pid] = {"unlocked": False, "why": "locked"}
        first = False
        if usable.get(pid):
            before_all_down = False
    return out


def emergency(state: dict[str, dict]) -> bool:
    return any(v.get("why") == "fallback" for v in state.values())


def pick_fallback(order: list[dict], state: dict[str, dict], usable: dict[str, bool], models: list[dict],
                  preferred: str | None = None) -> str | None:
    """Model a run moves to when the main provider is down: the admin's preferred one if it can be used, otherwise the
    cheapest model of the first unlocked, usable external provider. ``models``: the person's allowed external models
    with "key", "provider" and "blended" (price)."""
    ok = [m for m in models if state.get(m["provider"], {}).get("unlocked") and usable.get(m["provider"])]
    if not ok:
        return None
    if preferred and any(m["key"] == preferred for m in ok):
        return preferred
    for p in order:
        cand = [m for m in ok if m["provider"] == p["id"]]
        if cand:
            return min(cand, key=lambda m: (m.get("blended") or 0, m["key"]))["key"]
    return None
