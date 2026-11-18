"""Backend und Oberfläche rechnen das Dashboard-Raster gleich (dashboards.py ↔ frontend/src/grid.ts).

Beide Seiten prüfen dieselbe Referenzdatei ``tests/fixtures/grid_cases.json``: dieser Test gegen dashboards.py,
``frontend/test/grid.test.ts`` gegen grid.ts. Ändert sich eine Seite, schlägt einer der beiden Tests fehl.
Neu erzeugen (nur wenn die Regeln absichtlich geändert wurden): ``LLMITMIR_REGEN=1 pytest tests/test_parity.py``.
"""
from __future__ import annotations

import json
import os
import random

from _lm import ROOT, load

D = load("dashboards")
FIXTURE = ROOT / "tests" / "fixtures" / "grid_cases.json"


def _cases() -> list[dict]:
    rnd = random.Random(20261118)
    cases = []
    for n in range(40):
        cols = rnd.choice([12, 12, 12, 6, 4])
        items = [{"pid": f"p{i:02d}", "tile_owner": "o", "tile_id": f"t{i}", "x": rnd.randint(-2, 13),
                  "y": rnd.randint(0, 9), "w": rnd.randint(1, 14), "h": rnd.randint(1, 6)}
                 for i in range(rnd.randint(0, 9))]
        w, h = rnd.randint(1, 12), rnd.randint(1, 5)
        cases.append({"name": f"case{n}", "cols": cols, "items": items, "w": w, "h": h})
    return cases


def _expected(case: dict) -> dict:
    placed = D.compact(case["items"], case["cols"])
    return {"compact": [{k: p[k] for k in ("pid", "x", "y", "w", "h")} for p in placed],
            "free_spot": list(D.free_spot(placed, case["w"], case["h"], case["cols"]))}


def test_grid_reference_cases_match_dashboards_py():
    if os.environ.get("LLMITMIR_REGEN"):
        FIXTURE.parent.mkdir(exist_ok=True)
        data = [dict(c, expected=_expected(c)) for c in _cases()]
        FIXTURE.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert len(data) >= 40
    for case in data:
        assert _expected(case) == case["expected"], case["name"]


def test_compact_leaves_no_overlaps_and_stays_inside_the_grid():
    for case in json.loads(FIXTURE.read_text(encoding="utf-8")):
        placed = case["expected"]["compact"]
        for i, a in enumerate(placed):
            assert 0 <= a["x"] and a["x"] + a["w"] <= case["cols"] and a["y"] >= 0
            for b in placed[i + 1:]:
                assert not D._collides(a, b), case["name"]
