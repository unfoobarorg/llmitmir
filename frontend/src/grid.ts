// Dashboard grid in the browser – the same rules as dashboards.py (compact, free_spot), plus moving, resizing and
// the derived layouts for tablets (6 columns) and phones (4 columns). Only the 12-column layout is ever stored.

export interface Cell { pid: string; tile_owner: string; tile_id: string; x: number; y: number; w: number; h: number; }

export const COLS = 12;
export const MIN_W = 2, MAX_W = 12, MIN_H = 2, MAX_H = 8;

const collides = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// Math.round rounds .5 up in JS, Python rounds to even – floor(x + .5) is the same everywhere
const round = (v: number) => Math.floor(v + 0.5);

/** No overlaps, everything floats up as far as it can. Order: y, x, pid – like dashboards.compact. */
export function compact(items: Cell[], cols = COLS, first?: string): Cell[] {
  const placed: Cell[] = [];
  const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : 0));
  // the item being dragged keeps its place; the others make room around it
  if (first) {
    const i = sorted.findIndex(c => c.pid === first);
    if (i >= 0) {
      const it = { ...sorted[i] };
      it.w = Math.max(1, Math.min(cols, it.w)); it.x = Math.max(0, Math.min(cols - it.w, it.x)); it.y = Math.max(0, it.y);
      placed.push(it); sorted.splice(i, 1);
    }
  }
  for (const c of sorted) {
    const it = { ...c, w: Math.max(1, Math.min(cols, c.w)) };
    it.x = Math.max(0, Math.min(cols - it.w, it.x));
    it.y = 0;
    while (placed.some(o => collides(it, o))) it.y++;
    placed.push(it);
  }
  if (!first) return placed;
  // let the dragged item float up too, now that the others have settled below or beside it
  return compact(placed, cols);
}

export function freeSpot(items: Cell[], w: number, h: number, cols = COLS): [number, number] {
  w = Math.max(MIN_W, Math.min(cols, w));
  for (let y = 0; y < 10000; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const probe = { pid: "", tile_owner: "", tile_id: "", x, y, w, h };
      if (!items.some(o => collides(probe, o))) return [x, y];
    }
  }
  return [0, 0];
}

export function move(items: Cell[], pid: string, x: number, y: number): Cell[] {
  const next = items.map(c => (c.pid === pid ? { ...c, x: Math.round(x), y: Math.max(0, Math.round(y)) } : c));
  return compact(next, COLS, pid);
}

export function resize(items: Cell[], pid: string, w: number, h: number): Cell[] {
  const next = items.map(c => (c.pid === pid ? {
    ...c, w: Math.max(MIN_W, Math.min(MAX_W, Math.round(w))), h: Math.max(MIN_H, Math.min(MAX_H, Math.round(h))),
  } : c));
  return compact(next, COLS, pid);
}

/** Move one tile a step forward or back in reading order (phones and tablets, where dragging is not offered). */
export function shift(items: Cell[], pid: string, dir: -1 | 1): Cell[] {
  const order = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const i = order.findIndex(c => c.pid === pid), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return items;
  const a = order[i], b = order[j];
  const swapped = items.map(c => (c.pid === a.pid ? { ...c, x: b.x, y: b.y } : c.pid === b.pid ? { ...c, x: a.x, y: a.y } : c));
  return compact(swapped, COLS);
}

/** The layout for a narrower screen, derived from the 12-column one. */
export function derive(items: Cell[], cols: number): Cell[] {
  if (cols >= COLS) return compact(items, COLS);
  const order = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  if (cols === 6) {
    return compact(order.map(c => {
      const w = Math.max(MIN_W, Math.min(6, round(c.w / 2)));
      return { ...c, w, x: Math.min(round(c.x / 2), 6 - w) };
    }), 6);
  }
  // phone: full width, the height shrinks with the width (a 12×4 chart becomes 4×2, a 4×3 list stays 4×3)
  let y = 0;
  return order.map(c => {
    const h = Math.max(MIN_H, round((c.h * cols) / Math.max(c.w, cols)));
    const out = { ...c, x: 0, y, w: cols, h };
    y += h;
    return out;
  });
}

// by the width of the dashboard area (not the window – the sidebar takes its share)
export const colsFor = (width: number) => (width >= 900 ? 12 : width >= 520 ? 6 : 4);

export function height(items: Cell[]): number {
  return items.reduce((m, c) => Math.max(m, c.y + c.h), 0);
}
