"""Dashboards and tiles: layout, validation, time series and the tile part of a run's prompt (pure, unit-tested).

A dashboard is a grid of 12 columns with square cells; rows grow with the content. Tiles sit on it without overlapping
(like an Android home screen) and float up as far as they can (``compact``). Tablet (6 columns) and phone (4 columns)
layouts are derived in the browser (grid.ts) – only the 12-column layout is stored.

A tile gets its data either straight from Home Assistant (no model, rendered in the browser) or from one scheduled
task that ends with ``dashboard_update``. Everything the model writes is checked here (``validate``) before it is
stored; numbers that make a trend (stat, gauge, progress) and chart series the model wants appended are kept by the
server (``merge``), so a run only has to tell the current value.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timedelta

try:
    from .const import (GRID_COLS, HA_MODES, MAX_PLACEMENTS, MAX_SCENES, MAX_TILE_DATA, TILE_KINDS,
                        TILE_MIN_INTERVAL)
    from .cron import next_cron, schedule_to_cron
except ImportError:  # loaded standalone in tests
    from importlib import util as _u
    from pathlib import Path as _P

    def _load(name):
        s = _u.spec_from_file_location(f"lm_dash_{name}", _P(__file__).with_name(f"{name}.py"))
        m = _u.module_from_spec(s)
        s.loader.exec_module(m)
        return m

    _c = _load("const")
    GRID_COLS, HA_MODES, MAX_PLACEMENTS, MAX_SCENES = _c.GRID_COLS, _c.HA_MODES, _c.MAX_PLACEMENTS, _c.MAX_SCENES
    MAX_TILE_DATA, TILE_KINDS, TILE_MIN_INTERVAL = _c.MAX_TILE_DATA, _c.TILE_KINDS, _c.TILE_MIN_INTERVAL
    _cr = _load("cron")
    next_cron, schedule_to_cron = _cr.next_cron, _cr.schedule_to_cron

SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$")
ICON_RE = re.compile(r"^mdi:[a-z0-9-]{1,60}$")
ENTITY_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
PATTERN_RE = re.compile(r"^[a-z_*]+\.[a-z0-9_*]+$")
URL_RE = re.compile(r"^https?://[^\s<>\"']{1,1990}$", re.I)

STATUSES = ("ok", "warn", "error", "empty")
SEVERITIES = ("info", "warn", "critical")
ITEM_STATES = ("offen", "erledigt", "blockiert")
CHART_TYPES = ("line", "area", "bar", "donut")
SHAPES = ("box", "sphere", "cylinder", "torus")
COLUMN_TYPES = ("text", "date", "number", "chip")
RULE_OPS = ("below", "above", "equals", "not")

MIN_W, MAX_W, MIN_H, MAX_H = 2, GRID_COLS, 2, 8
MAX_SERIES_POINTS = 200
MAX_ROWS = 200
MAX_ITEMS = 50
MAX_OBJECTS = 60
MAX_CHART_SERIES = 8
MAX_ENTITIES = 20

# Farbwelten: je 8 Töne (Kachelfarbe = Ton aus der Palette oder eigener Hex-Wert)
PALETTES = {
    "aurora": ["#4f9cf9", "#7c5cff", "#2ec4b6", "#ff6b9a", "#ffb547", "#3ecf8e", "#a78bfa", "#38bdf8"],
    "sunset": ["#ff7a59", "#ffb347", "#ff4f81", "#c86bfa", "#ffd166", "#f25f5c", "#f9a03f", "#e76f51"],
    "meadow": ["#3ecf8e", "#8bc34a", "#2a9d8f", "#c0ca33", "#66bb6a", "#26a69a", "#9ccc65", "#43a047"],
    "candy": ["#ff6b9a", "#a78bfa", "#5eead4", "#fbbf24", "#f472b6", "#818cf8", "#34d399", "#fb7185"],
    "ocean": ["#0ea5e9", "#2563eb", "#06b6d4", "#14b8a6", "#3b82f6", "#0891b2", "#38bdf8", "#1d4ed8"],
    "mono": ["#64748b", "#475569", "#94a3b8", "#334155", "#78716c", "#57534e", "#a8a29e", "#1e293b"],
}

# Which Home-Assistant source fits which tile type
HA_KIND_MODES = {
    "stat": ("state", "history", "statistics", "template"),
    "gauge": ("state",),
    "progress": ("state", "todo"),
    "chart": ("history", "statistics"),
    "alert": ("state",),
    "table": ("state", "calendar"),
    "list": ("state", "calendar", "todo"),
    "text": ("state", "template"),
    "matrix": (),
    "scene": (),
}

KIND_LABELS = {"stat": "Kennzahl", "chart": "Diagramm", "alert": "Warnungen", "table": "Tabelle", "list": "Liste",
               "progress": "Fortschritt", "matrix": "Risikomatrix", "gauge": "Messuhr", "scene": "3D-Szene",
               "text": "Notiz"}
MODE_LABELS = {"state": "Zustand", "history": "Verlauf", "statistics": "Statistik", "calendar": "Kalender",
               "todo": "To-do-Liste", "template": "Vorlage"}

# Was das Modell je Typ in `data` schreibt – steht im Systemprompt jedes Kachel-Laufs (immer der aktuelle Stand)
SCHEMAS = {
    "stat": '{"value": 42, "unit": "Mails", "delta": "+3" (optional, sonst rechnet LLMitMir), "decimals": 0}',
    "chart": '{"type": "line|area|bar|donut", "series": [{"name": "Eingang", "points": [[Zeitstempel in Sekunden oder '
             '"JJJJ-MM-TT", 12], …], "color": "#4f9cf9"}], "y_unit": "Mails", "append": true|false} – mit "append": true '
             'hängt LLMitMir die Punkte an die gespeicherte Reihe an (nur neue Punkte schicken); bei "donut" sind die '
             'Punkte [["Name", Wert], …]',
    "alert": '{"items": [{"severity": "info|warn|critical", "title": "…", "text": "…", "since": Zeitstempel, "url": "https://…"}]}',
    "table": '{"columns": [{"key": "betreff", "label": "Betreff", "type": "text|date|number|chip"}], "rows": [{"betreff": "…"}], '
             '"sort": {"key": "betreff", "dir": "asc|desc"}}',
    "list": '{"items": [{"title": "…", "state": "offen|erledigt|blockiert", "meta": "…", "url": "https://…"}]}',
    "progress": '{"percent": 62, "steps": [{"label": "…", "done": true}], "milestones": [{"label": "…", "at": Zeitstempel}]}',
    "matrix": '{"axes": {"x": "Wahrscheinlichkeit", "y": "Auswirkung"}, "items": [{"title": "…", "x": 1-5, "y": 1-5, '
              '"severity": "info|warn|critical"}]} – die Zellen zählt LLMitMir selbst',
    "gauge": '{"value": 0.72, "min": 0, "max": 1, "unit": "%", "segments": [{"to": 0.5, "color": "#3ecf8e"}]}',
    "scene": '{"objects": [{"shape": "box|sphere|cylinder|torus", "pos": [x, y, z], "size": [sx, sy, sz], "color": "#…", '
             '"spin": 0.2, "label": "…"}], "camera": {"yaw": 0.6, "pitch": 0.3, "dist": 6}}',
    "text": '{"markdown": "kurze Notiz in Markdown (ohne Bilder)"}',
}


# ------------------------------------------------------------------ small helpers
def _num(v, default=None):
    if isinstance(v, bool):
        return default
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return f if math.isfinite(f) else default


def _int(v, lo: int, hi: int, default: int) -> int:
    f = _num(v)
    if f is None:
        return default
    return max(lo, min(hi, int(f)))


def _text(v, n: int) -> str:
    return " ".join(str(v if v is not None else "").split())[:n]


def _md(v, n: int) -> str:
    """Markdown without images (no tracking pixels from data a model wrote)."""
    t = str(v if v is not None else "")[:n]
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    return re.sub(r"<img\b[^>]*>", "", t, flags=re.I)


def color(v, default: str | None = None) -> str | None:
    v = str(v or "").strip()
    if COLOR_RE.match(v):
        return v
    if v in PALETTES:
        return v
    return default


def url(v) -> str | None:
    v = str(v or "").strip()
    return v if URL_RE.match(v) else None


def _ts(v) -> float | None:
    """Seconds since 1970 – also from "JJJJ-MM-TT[THH:MM]" or milliseconds."""
    if isinstance(v, str) and not re.match(r"^-?\d+(\.\d+)?$", v.strip()):
        try:
            return datetime.fromisoformat(v.strip().replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None
    f = _num(v)
    if f is None:
        return None
    return f / 1000 if f > 1e11 else f


def key(owner: str, item_id: str) -> str:
    return f"{owner}:{item_id}"


def split_key(k: str) -> tuple[str, str]:
    owner, _, item = str(k or "").partition(":")
    if not SAFE_ID.match(owner) or not SAFE_ID.match(item):
        raise ValueError("Ungültige Kennung")
    return owner, item


# ------------------------------------------------------------------ grid
def _collides(a: dict, b: dict) -> bool:
    return a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"] and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"]


def compact(items: list[dict], cols: int = GRID_COLS) -> list[dict]:
    """No overlaps, everything floats up as far as it can. Order: y, x, then pid – the same in grid.ts."""
    placed: list[dict] = []
    for it in sorted(items, key=lambda p: (p["y"], p["x"], p.get("pid") or "")):
        it = dict(it, w=max(1, min(cols, it["w"])))
        it["x"] = max(0, min(cols - it["w"], it["x"]))
        it["y"] = 0
        while any(_collides(it, o) for o in placed):
            it["y"] += 1
        placed.append(it)
    return placed


def clean_placements(raw, new_id, max_items: int = MAX_PLACEMENTS) -> list[dict]:
    out, seen = [], set()
    for p in raw or []:
        if not isinstance(p, dict):
            continue
        tile_owner, tile_id = str(p.get("tile_owner") or ""), str(p.get("tile_id") or "")
        if not SAFE_ID.match(tile_owner) or not SAFE_ID.match(tile_id):
            continue
        pid = str(p.get("pid") or "")
        if not SAFE_ID.match(pid) or pid in seen:
            pid = new_id("p")
        seen.add(pid)
        w = _int(p.get("w"), MIN_W, MAX_W, 4)
        h = _int(p.get("h"), MIN_H, MAX_H, 3)
        out.append({"pid": pid, "tile_owner": tile_owner, "tile_id": tile_id,
                    "x": _int(p.get("x"), 0, GRID_COLS - w, 0), "y": _int(p.get("y"), 0, 10_000, 0), "w": w, "h": h})
    if len(out) > max_items:
        raise ValueError(f"Höchstens {max_items} Kacheln je Dashboard.")
    return compact(out)


def free_spot(items: list[dict], w: int, h: int, cols: int = GRID_COLS) -> tuple[int, int]:
    """First place (top left to bottom right) where a w×h tile fits."""
    w = max(MIN_W, min(cols, w))
    y = 0
    while True:
        for x in range(0, cols - w + 1):
            probe = {"x": x, "y": y, "w": w, "h": h}
            if not any(_collides(probe, o) for o in items):
                return x, y
        y += 1


def clean_dashboard(raw: dict, old: dict | None, owner: str, new_id) -> dict:
    old = old or {}
    name = _text(raw.get("name", old.get("name")), 80)
    if not name:
        raise ValueError("Das Dashboard braucht einen Namen.")
    icon = str(raw.get("icon", old.get("icon")) or "mdi:view-dashboard-outline")
    palette = str(raw.get("palette", old.get("palette")) or "aurora")
    return {
        "id": old.get("id") or raw.get("id") or new_id("d"),
        "owner": old.get("owner") or owner,
        "name": name,
        "icon": icon if ICON_RE.match(icon) else "mdi:view-dashboard-outline",
        "description": _text(raw.get("description", old.get("description")), 300),
        "palette": palette if palette in PALETTES else "aurora",
        "order": _int(raw.get("order", old.get("order")), -10_000, 10_000, 0),
        "placements": clean_placements(raw["placements"] if "placements" in raw else old.get("placements"), new_id),
    }


def scene_count(placements: list[dict], kinds: dict) -> int:
    """How many 3D tiles a dashboard holds (kinds: tile key -> kind)."""
    return sum(1 for p in placements if kinds.get(key(p["tile_owner"], p["tile_id"])) == "scene")


def check_scenes(placements: list[dict], kinds: dict) -> None:
    if scene_count(placements, kinds) > MAX_SCENES:
        raise ValueError(f"Höchstens {MAX_SCENES} 3D-Kacheln je Dashboard – mehr schafft der Browser nicht gleichzeitig.")


# ------------------------------------------------------------------ tiles
def _clean_rules(raw) -> list[dict]:
    out = []
    for r in (raw or [])[:10]:
        if not isinstance(r, dict) or r.get("if") not in RULE_OPS:
            continue
        st = r.get("status") if r.get("status") in ("ok", "warn", "error") else "warn"
        val = r.get("value")
        out.append({"if": r["if"], "value": val if isinstance(val, (int, float, str)) and not isinstance(val, bool) else "",
                    "status": st})
    return out


def clean_ha_source(src: dict, kind: str, is_admin: bool, old: dict | None = None) -> dict:
    old = old if (old or {}).get("type") == "ha" else {}
    mode = str(src.get("mode") or "state")
    if mode not in HA_MODES:
        raise ValueError(f"Unbekannte HA-Quelle „{mode}“.")
    if mode not in HA_KIND_MODES.get(kind, ()):
        ok = ", ".join(MODE_LABELS[m] for m in HA_KIND_MODES.get(kind, ())) or "keine – dieser Typ braucht ein Modell"
        raise ValueError(f"„{MODE_LABELS[mode]}“ passt nicht zu „{KIND_LABELS.get(kind, kind)}“ (möglich: {ok}).")
    ents = [e for e in dict.fromkeys(str(x).strip() for x in (src.get("entities") or [])) if ENTITY_RE.match(e)]
    pattern = str(src.get("pattern") or "").strip()
    if pattern and not PATTERN_RE.match(pattern):
        raise ValueError("Muster wie „sensor.*_battery“ angeben (nur Kleinbuchstaben, Ziffern, _ und *).")
    template = str(src.get("template") or "")
    if mode == "template":
        if not template.strip():
            raise ValueError("Die Vorlage (Jinja) fehlt.")
        if template != (old.get("template") or "") and not is_admin:
            raise PermissionError("Vorlagen dürfen nur Home-Assistant-Admins anlegen oder ändern.")
    elif mode in ("state", "history", "statistics", "calendar", "todo") and not ents and not (mode == "state" and pattern):
        raise ValueError("Wähle mindestens eine Entität" + (" oder ein Muster." if mode == "state" else "."))
    stats = src.get("statistics") if isinstance(src.get("statistics"), dict) else {}
    out = {
        "type": "ha", "mode": mode, "entities": ents[:MAX_ENTITIES], "pattern": pattern if mode == "state" else "",
        "attribute": _text(src.get("attribute"), 60),
        "hours": _int(src.get("hours"), 1, 24 * 31, 24),
        "statistics": {"period": stats.get("period") if stats.get("period") in ("5minute", "hour", "day", "week", "month") else "day",
                       "stat": stats.get("stat") if stats.get("stat") in ("mean", "min", "max", "sum", "state", "change") else "mean",
                       "count": _int(stats.get("count"), 2, 200, 14)} if mode == "statistics" else None,
        "days": _int(src.get("days"), 1, 31, 7) if mode == "calendar" else None,
        "template": template[:2000] if mode == "template" else "",
        "rules": _clean_rules(src.get("rules")),
    }
    return out


def clean_model_source(src: dict, old: dict | None = None) -> dict:
    old = old if (old or {}).get("type") == "model" else {}
    ents = [e for e in dict.fromkeys(str(x).strip() for x in (src.get("run_if_changed") or [])) if ENTITY_RE.match(e)]
    return {"type": "model", "task_id": old.get("task_id") or "", "run_if_changed": ents[:5]}


def clean_options(raw) -> dict:
    """Display options: small, flat values only."""
    out = {}
    for k, v in (raw or {}).items() if isinstance(raw, dict) else []:
        k = str(k)[:30]
        if not re.match(r"^[a-z_]+$", k) or len(out) >= 20:
            continue
        if isinstance(v, bool) or isinstance(v, (int, float)) and math.isfinite(v):
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:80]
    return out


def clean_tile(raw: dict, old: dict | None, owner: str, is_admin: bool, new_id) -> dict:
    old = old or {}
    kind = str(raw.get("kind", old.get("kind")) or "")
    if kind not in TILE_KINDS:
        raise ValueError(f"Unbekannter Kacheltyp „{kind}“ (möglich: {', '.join(TILE_KINDS)}).")
    name = _text(raw.get("name", old.get("name")), 80)
    if not name:
        raise ValueError("Die Kachel braucht einen Namen.")
    src_raw = raw.get("source") if isinstance(raw.get("source"), dict) else (old.get("source") or {"type": "model"})
    typ = src_raw.get("type") or "model"
    if old.get("source") and typ != old["source"].get("type"):
        raise ValueError("Die Datenquelle (HA oder Modell) lässt sich nachträglich nicht wechseln – lege eine neue Kachel an.")
    if typ == "ha":
        source = clean_ha_source(src_raw, kind, is_admin, old.get("source"))
    elif typ == "model":
        source = clean_model_source(src_raw, old.get("source"))
    else:
        raise ValueError("Datenquelle ist „ha“ oder „model“.")
    description = str(raw.get("description", old.get("description")) or "").strip()[:4000]
    if typ == "model" and not description:
        raise ValueError("Die Beschreibung fehlt – sie ist der Auftrag für jeden Lauf.")
    icon = str(raw.get("icon", old.get("icon")) or "")
    return {
        "id": old.get("id") or raw.get("id") or new_id("w"),
        "owner": old.get("owner") or owner,
        "name": name, "kind": kind, "description": description,
        "icon": icon if ICON_RE.match(icon) else "",
        "color": color(raw.get("color", old.get("color")), "") or "",
        "options": clean_options(raw.get("options", old.get("options"))),
        "source": source,
    }


# ------------------------------------------------------------------ data the model writes
def _clean_points(points, donut: bool) -> list[list]:
    out = []
    for p in points or []:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        v = _num(p[1])
        if v is None:
            continue
        if donut:
            out.append([_text(p[0], 40), v])
        else:
            t = _ts(p[0])
            if t is not None:
                out.append([t, v])
    if not donut:
        out.sort(key=lambda x: x[0])
    return out[-MAX_SERIES_POINTS:]


def _list(d: dict, key: str, limit: int) -> list:
    """A list field of the model's data – anything else is an error the model can fix (not silently nothing)."""
    v = d.get(key)
    if v is None:
        return []
    if not isinstance(v, list):
        raise ValueError(f"„{key}“ muss eine Liste sein, nicht {type(v).__name__}.")
    return v[:limit]


def _vec(v, default: float) -> list[float]:
    """Three numbers (x, y, z) within ±50; missing ones are the default."""
    vals = list(v)[:3] if isinstance(v, (list, tuple)) else []
    out = [max(-50.0, min(50.0, _num(x, default))) for x in vals]
    return out + [default] * (3 - len(out))


def _validate_data(kind: str, d: dict) -> dict:
    if kind == "stat":
        v = _num(d.get("value"))
        if v is None:
            raise ValueError("stat braucht „value“ als Zahl.")
        out = {"value": v, "unit": _text(d.get("unit"), 20), "decimals": _int(d.get("decimals"), 0, 4, 0 if v == int(v) else 1)}
        if d.get("delta") not in (None, ""):
            out["delta"] = _text(d.get("delta"), 20)
        return out
    if kind == "gauge":
        v = _num(d.get("value"))
        if v is None:
            raise ValueError("gauge braucht „value“ als Zahl.")
        lo, hi = _num(d.get("min"), 0.0), _num(d.get("max"), 100.0)
        if hi <= lo:
            raise ValueError("gauge: „max“ muss größer als „min“ sein.")
        segs = [{"to": _num(s.get("to")), "color": color(s.get("color"), "#3ecf8e")}
                for s in _list(d, "segments", 8) if isinstance(s, dict) and _num(s.get("to")) is not None]
        return {"value": v, "min": lo, "max": hi, "unit": _text(d.get("unit"), 12), "segments": segs}
    if kind == "progress":
        p = _num(d.get("percent"))
        if p is None:
            raise ValueError("progress braucht „percent“ (0–100).")
        steps = [{"label": _text(s.get("label"), 80), "done": bool(s.get("done"))}
                 for s in _list(d, "steps", 20) if isinstance(s, dict)]
        ms = [{"label": _text(s.get("label"), 60), "at": _ts(s.get("at"))}
              for s in _list(d, "milestones", 10) if isinstance(s, dict)]
        return {"percent": max(0.0, min(100.0, p)), "steps": steps, "milestones": ms}
    if kind == "chart":
        typ = d.get("type") if d.get("type") in CHART_TYPES else "line"
        series = []
        for s in _list(d, "series", MAX_CHART_SERIES):
            if not isinstance(s, dict):
                continue
            series.append({"name": _text(s.get("name"), 40) or f"Reihe {len(series) + 1}",
                           "points": _clean_points(s.get("points"), typ == "donut"), "color": color(s.get("color"), "") or ""})
        if not series or not any(s["points"] for s in series):
            raise ValueError("chart braucht mindestens eine Reihe mit Punkten.")
        return {"type": typ, "series": series, "y_unit": _text(d.get("y_unit"), 20), "append": bool(d.get("append"))}
    if kind == "alert":
        items = []
        for i in _list(d, "items", MAX_ITEMS):
            if not isinstance(i, dict) or not _text(i.get("title"), 1):
                continue
            items.append({"severity": i.get("severity") if i.get("severity") in SEVERITIES else "info",
                          "title": _text(i.get("title"), 120), "text": _text(i.get("text"), 400),
                          "since": _ts(i.get("since")), "url": url(i.get("url"))})
        return {"items": items}
    if kind == "list":
        items = []
        for i in _list(d, "items", MAX_ITEMS):
            if not isinstance(i, dict) or not _text(i.get("title"), 1):
                continue
            items.append({"title": _text(i.get("title"), 160), "state": i.get("state") if i.get("state") in ITEM_STATES else "",
                          "meta": _text(i.get("meta"), 120), "url": url(i.get("url"))})
        return {"items": items}
    if kind == "table":
        cols = []
        for c in _list(d, "columns", 12):
            if isinstance(c, dict) and re.match(r"^[A-Za-z0-9_äöüÄÖÜß-]{1,40}$", str(c.get("key") or "")):
                cols.append({"key": str(c["key"]), "label": _text(c.get("label") or c["key"], 40),
                             "type": c.get("type") if c.get("type") in COLUMN_TYPES else "text"})
        if not cols:
            raise ValueError("table braucht „columns“ mit key und label.")
        keys = {c["key"] for c in cols}
        rows = []
        for r in _list(d, "rows", MAX_ROWS):
            if isinstance(r, dict):
                rows.append({k: (v if isinstance(v, (int, float)) and not isinstance(v, bool) else _text(v, 200))
                             for k, v in r.items() if k in keys})
        sort = d.get("sort") if isinstance(d.get("sort"), dict) and d["sort"].get("key") in keys else None
        return {"columns": cols, "rows": rows,
                "sort": {"key": sort["key"], "dir": "asc" if sort.get("dir") == "asc" else "desc"} if sort else None}
    if kind == "matrix":
        axes = d.get("axes") if isinstance(d.get("axes"), dict) else {}
        items = []
        for i in _list(d, "items", MAX_ITEMS):
            if not isinstance(i, dict):
                continue
            x, y = _int(i.get("x"), 1, 5, 0), _int(i.get("y"), 1, 5, 0)
            if not x or not y:
                continue
            items.append({"title": _text(i.get("title"), 100), "x": x, "y": y,
                          "severity": i.get("severity") if i.get("severity") in SEVERITIES else "warn"})
        cells: dict[tuple, int] = {}
        for i in items:
            cells[(i["x"], i["y"])] = cells.get((i["x"], i["y"]), 0) + 1
        return {"axes": {"x": _text(axes.get("x") or "Wahrscheinlichkeit", 30), "y": _text(axes.get("y") or "Auswirkung", 30)},
                "items": items, "cells": [{"x": x, "y": y, "count": n} for (x, y), n in sorted(cells.items())]}
    if kind == "scene":
        objs = []
        for o in _list(d, "objects", MAX_OBJECTS):
            if not isinstance(o, dict) or o.get("shape") not in SHAPES:
                continue
            size = [max(0.05, abs(s)) for s in _vec(o.get("size"), 1.0)]
            objs.append({"shape": o["shape"], "pos": _vec(o.get("pos"), 0.0), "size": size,
                         "color": color(o.get("color"), "#4f9cf9"), "spin": max(-3.0, min(3.0, _num(o.get("spin"), 0.0))),
                         "label": _text(o.get("label"), 40)})
        if not objs:
            raise ValueError("scene braucht mindestens ein Objekt (box, sphere, cylinder, torus).")
        cam = d.get("camera") if isinstance(d.get("camera"), dict) else {}
        return {"objects": objs, "camera": {"yaw": _num(cam.get("yaw"), 0.6), "pitch": max(-1.4, min(1.4, _num(cam.get("pitch"), 0.3))),
                                            "dist": max(1.0, min(60.0, _num(cam.get("dist"), 6.0)))}}
    if kind == "text":
        return {"markdown": _md(d.get("markdown") or d.get("text"), 4000)}
    raise ValueError(f"Unbekannter Kacheltyp „{kind}“.")


def validate(kind: str, payload: dict) -> dict:
    """What a run (or a person) wants to write – checked and trimmed. Raises ValueError with a hint for the model."""
    if not isinstance(payload, dict):
        raise ValueError("Die Daten müssen ein JSON-Objekt sein.")
    data = payload.get("data")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except ValueError as e:
            raise ValueError(f"„data“ ist kein gültiges JSON: {e}") from None
    if not isinstance(data, dict):
        raise ValueError(f"„data“ fehlt. Schema für {kind}: {SCHEMAS.get(kind, '')}")
    out = {"status": payload.get("status") if payload.get("status") in STATUSES else "ok",
           "headline": _text(payload.get("headline"), 120), "subline": _text(payload.get("subline"), 160),
           "data": _validate_data(kind, data)}
    size = len(json.dumps(out, ensure_ascii=False).encode())
    if size > MAX_TILE_DATA:
        raise ValueError(f"Die Daten sind zu groß ({size // 1024} KB, höchstens {MAX_TILE_DATA // 1024} KB) – kürzen.")
    return out


def _fmt_delta(d: float, decimals: int) -> str:
    s = f"{abs(d):.{decimals}f}".replace(".", ",")
    return ("+" if d > 0 else "−" if d < 0 else "±") + s


def merge(kind: str, new: dict, prev: dict | None, ts: float) -> dict:
    """The record to store: new data plus the time series the server keeps (trend, delta, appended chart points)."""
    prev = prev or {}
    series = dict(prev.get("series") or {})
    data = dict(new["data"])
    if kind in ("stat", "gauge", "progress"):
        v = data.get("percent") if kind == "progress" else data.get("value")
        pts = [p for p in (series.get("value") or []) if isinstance(p, list) and len(p) == 2][-(MAX_SERIES_POINTS - 1):]
        last = pts[-1][1] if pts else None
        pts.append([ts, v])
        series["value"] = pts
        if kind == "stat":
            if "delta" not in data and last is not None:
                data["delta"] = _fmt_delta(v - last, data.get("decimals") or 0)
            data["trend"] = [p[1] for p in pts[-30:]]
    elif kind == "chart" and data.get("append") and data["type"] != "donut":
        old_series = {s.get("name"): s for s in ((prev.get("data") or {}).get("series") or [])}
        merged = []
        for s in data["series"]:
            pts = {p[0]: p[1] for p in (old_series.get(s["name"]) or {}).get("points") or []}
            pts.update({p[0]: p[1] for p in s["points"]})
            merged.append(dict(s, points=[[t, pts[t]] for t in sorted(pts)][-MAX_SERIES_POINTS:]))
        data["series"] = merged
    return {"status": new["status"], "headline": new["headline"], "subline": new["subline"], "data": data,
            "series": series, "updated": ts, "error": None}


# ------------------------------------------------------------------ schedules
def default_schedule(tile_id: str) -> dict:
    """Hourly between 7 and 22 o'clock – at a minute taken from the tile id, so tiles do not all start at :00."""
    minute = int(hashlib.sha1(tile_id.encode()).hexdigest(), 16) % 60
    return {"type": "cron", "cron": f"{minute} 7-22 * * *"}


def _occurrences(schedule: dict, start: datetime, days: int = 7, cap: int = 2000) -> list[datetime]:
    cron = schedule_to_cron(schedule)
    if cron is None:
        return []  # once
    out, t, end = [], start, start + timedelta(days=days)
    while len(out) < cap:
        t = next_cron(cron, t)
        if t > end:
            break
        out.append(t)
    return out


def runs_per_day(schedule: dict, start: datetime) -> float:
    occ = _occurrences(schedule, start)
    return round(len(occ) / 7, 1)


def min_gap(schedule: dict, start: datetime) -> float | None:
    """Shortest distance between two runs in seconds (None: runs at most once)."""
    occ = _occurrences(schedule, start, days=8)
    gaps = [(b - a).total_seconds() for a, b in zip(occ, occ[1:])]
    return min(gaps) if gaps else None


def check_interval(schedule: dict, start: datetime) -> None:
    gap = min_gap(schedule, start)
    if gap is not None and gap < TILE_MIN_INTERVAL:
        raise ValueError(f"Kacheln laufen höchstens alle {TILE_MIN_INTERVAL // 60} Minuten – der Zeitplan wäre häufiger.")


def stale(updated: float | None, schedule: dict | None, now: float, start: datetime | None = None) -> bool:
    """Older than two schedule intervals (or two days without a schedule)."""
    if not updated:
        return False
    span = 2 * 86400.0
    if schedule and start is not None:
        gap = min_gap(schedule, start)
        if gap:
            span = 2 * max(gap, TILE_MIN_INTERVAL)
    return now - updated > span


# ------------------------------------------------------------------ queue of tile runs
def pick_fair(queue: list[tuple], last_user: str | None) -> int:
    """Index of the next entry in the tile lane: people take turns; within a person, manual runs first.

    Entries are (user_id, task_id, reason, scheduled).
    """
    if not queue:
        return -1
    order = list(dict.fromkeys(q[0] for q in queue))
    if last_user in order and len(order) > 1:
        i = order.index(last_user)
        order = order[i + 1:] + order[:i + 1]
    uid = order[0]
    mine = [i for i, q in enumerate(queue) if q[0] == uid]
    manual = [i for i in mine if len(queue[i]) > 2 and queue[i][2] == "manuell"]
    return (manual or mine)[0]


# ------------------------------------------------------------------ prompt for a tile run
def prompt_section(tile: dict, record: dict | None) -> str:
    kind = tile.get("kind") or "text"
    last = ""
    if record and record.get("data") is not None:
        compact_data = json.dumps({k: record.get(k) for k in ("status", "headline", "subline", "data")},
                                  ensure_ascii=False, default=str)
        if len(compact_data) > 4000:
            compact_data = compact_data[:4000] + " …(gekürzt)"
        last = f"\nZuletzt geschrieben ({datetime.fromtimestamp(record.get('updated') or 0):%d.%m. %H:%M}): {compact_data}"
    opts = tile.get("options") or {}
    return (
        f"## Kachel „{tile.get('name')}“\n"
        f"Dieser Lauf aktualisiert eine Dashboard-Kachel vom Typ „{kind}“ ({KIND_LABELS.get(kind, kind)}). "
        "Der Auftrag oben ist ihre Beschreibung. Ermittle die Daten mit den Werkzeugen und rufe am Ende **genau einmal** "
        "`dashboard_update` auf – mit `status` (ok, warn, error, empty), `headline` (eine kurze Zeile, z. B. „3 offene "
        "Aufgaben“), optional `subline`, und `data` nach diesem Schema:\n"
        f"{SCHEMAS.get(kind, '{}')}\n"
        + (f"Anzeige-Optionen der Kachel: {json.dumps(opts, ensure_ascii=False)}\n" if opts else "")
        + "Lehnt `dashboard_update` die Daten ab, korrigiere sie nach der Fehlermeldung und rufe es erneut auf. "
        "Ohne gültiges `dashboard_update` gilt der Lauf als fehlgeschlagen. `task_result` ist hier nicht nötig – "
        "die Benachrichtigung ergibt sich aus `headline` und `status`. Keine Bilder, Links nur mit https://."
        + (" Bei „stat“, „gauge“ und „progress“ führt LLMitMir den Verlauf selbst: schicke nur den aktuellen Wert."
           if kind in ("stat", "gauge", "progress") else "")
        + last
    )
