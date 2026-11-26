// Small drawing core for the tiles: scales, nice ticks, paths, arcs and number/time formatting.
import { t, isDe, dateLocale } from "../i18n";
// No chart library – the tiles only need lines, areas, bars, donuts, gauges and a risk matrix.

// Series colours: a validated categorical order (colour-blind safe neighbours), separately stepped for dark mode.
// Assigned in this fixed order, never cycled into new hues; a ninth series reuses nothing – charts take at most eight.
export const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
// Status colours are reserved for state (always shown with an icon and a word, never alone)
export const STATUS = { ok: "var(--lm-ok)", warn: "var(--lm-warn)", error: "var(--lm-err)", empty: "var(--lm-faint)" } as const;

export const seriesColor = (i: number, dark: boolean) => (dark ? SERIES_DARK : SERIES_LIGHT)[i % 8];

export function scale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** About `count` round tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!isFinite(lo) || !isFinite(hi)) return [];
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out: number[] = [];
  // from the first tick at or below lo to the first tick at or above hi – the data never pokes out of the scale
  for (let v = Math.floor(lo / step) * step; out.length < 50; v += step) {
    out.push(+v.toFixed(10));
    if (v >= hi - step * 1e-9) break;
  }
  return out;
}

export function linePath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
}

export function areaPath(pts: [number, number][], base: number): string {
  if (!pts.length) return "";
  return `${linePath(pts)}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z`;
}

/** Bar with rounded data end (4px) and a square base. */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Arc segment of a ring between two angles (radians, 0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

export function fmtNumber(v: number, decimals?: number): string {
  if (v === null || v === undefined || !isFinite(v)) return "–";
  const abs = Math.abs(v);
  const d = decimals ?? (abs >= 100 || Number.isInteger(v) ? 0 : abs >= 10 ? 1 : 2);
  if (abs >= 1e6) return (v / 1e6).toLocaleString(dateLocale(), { maximumFractionDigits: 1 }) + (isDe() ? " Mio." : "M");
  return v.toLocaleString(dateLocale(), { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v / 1e6).toLocaleString(dateLocale(), { maximumFractionDigits: 1 }) + "M";
  if (abs >= 1e4) return (v / 1e3).toLocaleString(dateLocale(), { maximumFractionDigits: 0 }) + "k";
  return v.toLocaleString(dateLocale(), { maximumFractionDigits: 2 });
}

/** Label for a time on an axis, depending on the span shown. */
export function fmtAxisTime(ts: number, span: number): string {
  const d = new Date(ts * 1000);
  if (span <= 2 * 86400) return d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
  if (span <= 120 * 86400) return d.toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit" });
  return d.toLocaleDateString(dateLocale(), { month: "short", year: "2-digit" });
}

export function fmtWhen(ts?: number | null): string {
  if (!ts) return "";
  const d = new Date(ts * 1000), now = new Date();
  const hm = d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return hm;
  return d.toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit" }) + " " + hm;
}

/** "vor 5 min" – for the „aktualisiert“ line of a tile. */
export function ago(ts?: number | null): string {
  if (!ts) return "";
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return t("gerade eben");
  if (s < 3600) return t("vor {n} min", { n: Math.floor(s / 60) });
  if (s < 86400) return t("vor {n} h", { n: Math.floor(s / 3600) });
  return fmtWhen(ts);
}

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** A tile colour: a hex value, or the n-th tone of the dashboard's colour world. */
export const PALETTES: Record<string, string[]> = {
  aurora: ["#4f9cf9", "#7c5cff", "#2ec4b6", "#ff6b9a", "#ffb547", "#3ecf8e", "#a78bfa", "#38bdf8"],
  sunset: ["#ff7a59", "#ffb347", "#ff4f81", "#c86bfa", "#ffd166", "#f25f5c", "#f9a03f", "#e76f51"],
  meadow: ["#3ecf8e", "#8bc34a", "#2a9d8f", "#c0ca33", "#66bb6a", "#26a69a", "#9ccc65", "#43a047"],
  candy: ["#ff6b9a", "#a78bfa", "#5eead4", "#fbbf24", "#f472b6", "#818cf8", "#34d399", "#fb7185"],
  ocean: ["#0ea5e9", "#2563eb", "#06b6d4", "#14b8a6", "#3b82f6", "#0891b2", "#38bdf8", "#1d4ed8"],
  mono: ["#64748b", "#475569", "#94a3b8", "#334155", "#78716c", "#57534e", "#a8a29e", "#1e293b"],
};
export const PALETTE_LABELS: Record<string, string> = {
  aurora: "Polarlicht", sunset: "Abendrot", meadow: "Wiese", candy: "Bonbon", ocean: "Ozean", mono: "Schlicht",
};

export function tileColor(color: string | undefined, palette: string, index: number): string {
  if (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  const p = PALETTES[color && PALETTES[color] ? color : palette] || PALETTES.aurora;
  return p[Math.abs(index) % p.length];
}

/** Stable small number from a string (tile id → tone of the colour world). */
export function hashIndex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
