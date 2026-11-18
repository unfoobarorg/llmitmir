// Dashboard-Raster im Browser: dieselben Ergebnisse wie dashboards.py (Referenzdatei tests/fixtures/grid_cases.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import cases from "../../tests/fixtures/grid_cases.json";
import { compact, derive, freeSpot, height, move, resize, shift, type Cell, MIN_W, MAX_W, MIN_H, MAX_H } from "../src/grid";

const overlaps = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlap = (items: Cell[]) => items.every((a, i) => items.slice(i + 1).every(b => !overlaps(a, b)));
const pick = (items: Cell[]) => items.map(({ pid, x, y, w, h }) => ({ pid, x, y, w, h }));

test("compact und freeSpot rechnen wie dashboards.py", () => {
  assert.ok((cases as any[]).length >= 40);
  for (const c of cases as any[]) {
    const placed = compact(c.items, c.cols);
    assert.deepEqual(pick(placed), c.expected.compact, c.name);
    assert.deepEqual(freeSpot(placed, c.w, c.h, c.cols), c.expected.free_spot, c.name);
  }
});

const layout = (): Cell[] => [
  { pid: "a", tile_owner: "o", tile_id: "a", x: 0, y: 0, w: 6, h: 3 },
  { pid: "b", tile_owner: "o", tile_id: "b", x: 6, y: 0, w: 6, h: 3 },
  { pid: "c", tile_owner: "o", tile_id: "c", x: 0, y: 3, w: 12, h: 4 },
];

test("Verschieben und Größe ändern lassen keine Überlappung und bleiben in den Grenzen", () => {
  let items = move(layout(), "c", 3, 0);
  assert.ok(noOverlap(items));
  items = resize(items, "a", 99, 99);
  const a = items.find(c => c.pid === "a")!;
  assert.equal(a.w, MAX_W); assert.equal(a.h, MAX_H);
  items = resize(items, "b", 0, 0);
  const b = items.find(c => c.pid === "b")!;
  assert.equal(b.w, MIN_W); assert.equal(b.h, MIN_H);
  assert.ok(noOverlap(items));
  assert.ok(items.every(c => c.x >= 0 && c.x + c.w <= 12 && c.y >= 0));
});

test("shift tauscht Nachbarn in Lesereihenfolge, am Rand passiert nichts", () => {
  const items = layout();
  assert.deepEqual(shift(items, "a", -1), items);
  const swapped = shift(items, "a", 1);
  assert.ok(swapped.find(c => c.pid === "a")!.x > swapped.find(c => c.pid === "b")!.x);
});

test("Tablet- und Handy-Raster werden abgeleitet, ohne Überlappung", () => {
  for (const cols of [6, 4]) {
    const d = derive(layout(), cols);
    assert.ok(noOverlap(d));
    assert.ok(d.every(c => c.x + c.w <= cols));
  }
  const phone = derive(layout(), 4);
  assert.ok(phone.every(c => c.w === 4 && c.x === 0));
  assert.equal(height(phone), phone.reduce((s, c) => s + c.h, 0));
});
