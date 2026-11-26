// The inside of each tile type. Every renderer gets the same record (status, headline, data …) – whether it came
// from Home Assistant (tiles/ha.ts) or from a tile run – and the pixel size of the content area.
import { html, svg, nothing, TemplateResult } from "lit";
import { icon, md } from "../ui";
import {
  arcPath, areaPath, barPath, domainOf, fmtAxisTime, fmtNumber, fmtTick, fmtWhen, linePath, niceTicks, scale, seriesColor,
} from "./svg";
import { cellClass, cellColor } from "./table";
import { t, dateLocale } from "../i18n";

export interface Ctx {
  w: number; h: number;          // content area in px
  color: string;                 // tile colour (accent)
  dark: boolean;
  options: Record<string, any>;
  sort?: { key: string; dir: "asc" | "desc" } | null;
  setSort?: (key: string) => void;
}

const SEV: Record<string, [string, string, string]> = {
  info: ["info", "var(--lm-accent)", "Hinweis"], warn: ["alert", "var(--lm-warn)", "Warnung"],
  critical: ["mdi:alert-octagon-outline", "var(--lm-err)", "Kritisch"],
};
const STATE: Record<string, [string, string]> = {
  offen: ["mdi:circle-outline", "var(--lm-muted)"], erledigt: ["check", "var(--lm-ok)"], blockiert: ["mdi:block-helper", "var(--lm-err)"],
};

const link = (url?: string | null) => url ? html`<a class="lnk" href=${url} target="_blank" rel="noopener noreferrer" title=${url}
  @click=${(e: Event) => e.stopPropagation()}>${icon("external", 13)} ${domainOf(url)}</a>` : nothing;

// ------------------------------------------------------------------ stat
function sparkline(values: number[], w: number, h: number, color: string) {
  const v = values.filter(n => typeof n === "number" && isFinite(n));
  if (v.length < 2 || w < 40 || h < 14) return nothing;
  const lo = Math.min(...v), hi = Math.max(...v);
  const x = scale(0, v.length - 1, 2, w - 2), y = scale(lo, hi === lo ? lo + 1 : hi, h - 3, 3);
  const pts = v.map((n, i) => [x(i), y(n)] as [number, number]);
  return svg`<svg class="spark" width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d=${areaPath(pts, h)} fill=${color} opacity=".14"></path>
    <path d=${linePath(pts)} fill="none" stroke=${color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
    <circle cx=${pts[pts.length - 1][0]} cy=${pts[pts.length - 1][1]} r="3" fill=${color}></circle></svg>`;
}

function stat(rec: any, c: Ctx) {
  const d = rec.data || {};
  const trend: number[] = d.trend || (rec.series || []).map((p: any) => p[1]);
  const big = Math.max(22, Math.min(c.h * 0.42, c.w * 0.26, 72));
  const delta = String(d.delta || "");
  const up = /^\+/.test(delta), down = /^[−-]/.test(delta);
  const sparkH = Math.max(0, Math.min(c.h * 0.32, 56));
  return html`<div class="stat">
    <div class="sv"><lm-count .value=${Number(d.value)} .decimals=${d.decimals} style="font-size:${big}px"></lm-count>
      ${d.unit ? html`<span class="unit">${d.unit}</span>` : nothing}</div>
    ${delta ? html`<div class="delta">${icon(up ? "mdi:trending-up" : down ? "mdi:trending-down" : "mdi:trending-neutral", 15)} ${delta}</div>` : nothing}
    ${c.h > 110 ? sparkline(trend.slice(-30), c.w, sparkH, c.color) : nothing}</div>`;
}

// ------------------------------------------------------------------ chart
function chart(rec: any, c: Ctx) {
  const d = rec.data || {};
  const series: any[] = (d.series || []).filter((s: any) => (s.points || []).length);
  if (!series.length) return empty();
  const colorOf = (s: any, i: number) => (/^#[0-9a-fA-F]{3,8}$/.test(s.color || "") ? s.color : series.length === 1 ? c.color : seriesColor(i, c.dark));
  if (d.type === "donut") return donut(series[0], c);
  const legendH = series.length > 1 ? 20 : 0;
  const W = c.w, H = Math.max(40, c.h - legendH);
  const pad = { l: 34, r: 6, t: 6, b: 18 };
  const all = series.flatMap(s => s.points as [number, number][]);
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const bar = d.type === "bar";
  // bars and areas stand on zero; a line may zoom in on its range (a temperature of 18–23 °C stays readable)
  const lo = bar || d.type === "area" ? Math.min(0, ...ys) : Math.min(...ys), hi = Math.max(...ys);
  const ticks = niceTicks(lo - (bar ? 0 : (hi - lo) * 0.05), hi, Math.max(2, Math.floor(H / 40)));
  const y = scale(ticks[0], ticks[ticks.length - 1], H - pad.b, pad.t);
  const times = [...new Set(xs)].sort((a, b) => a - b);
  const band = (W - pad.l - pad.r) / Math.max(1, times.length);
  const x = bar ? (t: number) => pad.l + times.indexOf(t) * band + band / 2 : scale(x0, x1 === x0 ? x0 + 1 : x1, pad.l, W - pad.r);
  const span = x1 - x0;
  const nT = Math.max(2, Math.min(5, Math.floor((W - pad.l) / 70)));
  const xt = times.length <= nT ? times : Array.from({ length: nT }, (_, i) => times[Math.round((i * (times.length - 1)) / (nT - 1))]);
  const tipAt = (t: number) => `${fmtWhen(t)}\n` + series.map(s => {
    const p = (s.points as [number, number][]).find(q => q[0] === t);
    return p ? `${s.name}: ${fmtNumber(p[1])}${d.y_unit ? " " + d.y_unit : ""}` : "";
  }).filter(Boolean).join("\n");
  const bw = Math.max(2, (band - 2) / series.length - 2);
  return html`<svg class="chart" width=${W} height=${H} viewBox="0 0 ${W} ${H}" role="img" aria-label=${rec.headline || t("Diagramm")}>
    ${ticks.map(t => svg`<line x1=${pad.l} x2=${W - pad.r} y1=${y(t)} y2=${y(t)} class="grid"></line>
      <text x=${pad.l - 5} y=${y(t) + 3.5} class="ax" text-anchor="end">${fmtTick(t)}</text>`)}
    ${xt.map((t, i) => svg`<text x=${x(t)} y=${H - 4} class="ax"
      text-anchor=${xt.length > 1 && i === 0 && !bar ? "start" : xt.length > 1 && i === xt.length - 1 && !bar ? "end" : "middle"}>${fmtAxisTime(t, span)}</text>`)}
    ${series.map((s, i) => {
      const col = colorOf(s, i);
      const pts = (s.points as [number, number][]).map(p => [x(p[0]), y(p[1])] as [number, number]);
      if (bar) {
        return svg`${(s.points as [number, number][]).map(p => {
          const top = y(Math.max(0, p[1])), base = y(Math.min(0, p[1]) || 0);
          const bx = x(p[0]) - (bw + 2) * series.length / 2 + i * (bw + 2) + 1;
          return svg`<path d=${barPath(bx, top, bw, Math.max(0, base - top))} fill=${col}></path>`;
        })}`;
      }
      return svg`${d.type === "area" ? svg`<path d=${areaPath(pts, y(ticks[0]))} fill=${col} opacity=".16"></path>` : nothing}
        <path d=${linePath(pts)} fill="none" stroke=${col} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
        ${pts.length <= 24 ? pts.map(p => svg`<circle cx=${p[0]} cy=${p[1]} r="2.5" fill=${col} stroke="var(--tile-bg)" stroke-width="2"></circle>`) : nothing}`;
    })}
    ${times.map((t, i) => {
      // hit targets wider than the marks: one band per point in time, the tooltip lists every series
      const cx = x(t), prev = i ? x(times[i - 1]) : pad.l, next = i < times.length - 1 ? x(times[i + 1]) : W - pad.r;
      const l = bar ? cx - band / 2 : (prev + cx) / 2, r = bar ? cx + band / 2 : (cx + next) / 2;
      return svg`<rect class="hit" x=${l} y=${pad.t} width=${Math.max(1, r - l)} height=${H - pad.t - pad.b} data-tip=${tipAt(t)} data-x=${cx}></rect>`;
    })}</svg>
    ${legendH ? html`<div class="legend">${series.map((s, i) => html`<span><i style="background:${colorOf(s, i)}"></i>${s.name}</span>`)}</div>` : nothing}`;
}

function donut(s: any, c: Ctx) {
  // every slice is its own category: the categorical order, not the tile colour
  const colorOf = (_: any, i: number) => seriesColor(i, c.dark);
  const pts = (s.points as [any, number][]).filter(p => p[1] > 0).slice(0, 8);
  const total = pts.reduce((a, p) => a + p[1], 0) || 1;
  const side = c.w > c.h * 1.5;
  const size = Math.max(60, Math.min(side ? c.h : c.h - 22 * Math.ceil(pts.length / 2), side ? c.w * 0.5 : c.w));
  const r1 = size / 2 - 2, r0 = r1 * 0.62;
  let a = 0;
  const gap = pts.length > 1 ? 0.03 : 0;
  return html`<div class="donut ${side ? "side" : ""}">
    <svg width=${size} height=${size} viewBox="0 0 ${size} ${size}" role="img" aria-label=${s.name}>
      ${pts.map((p, i) => {
        const a0 = a, a1 = a + (p[1] / total) * Math.PI * 2;
        a = a1;
        return svg`<path d=${arcPath(size / 2, size / 2, r0, r1, a0 + gap / 2, Math.max(a0 + gap / 2 + 0.001, a1 - gap / 2))}
          fill=${colorOf({}, i)} class="hit-mark" data-tip=${`${p[0]}: ${fmtNumber(p[1])} (${Math.round((p[1] / total) * 100)} %)`}></path>`;
      })}
      <text x=${size / 2} y=${size / 2 + 6} text-anchor="middle" class="dv">${fmtNumber(total)}</text></svg>
    <div class="legend col">${pts.map((p, i) => html`<span><i style="background:${colorOf({}, i)}"></i>${p[0]} <b>${fmtNumber(p[1])}</b></span>`)}</div></div>`;
}

// ------------------------------------------------------------------ gauge
function gauge(rec: any, c: Ctx) {
  const d = rec.data || {};
  const lo = Number(d.min ?? 0), hi = Number(d.max ?? 100), v = Number(d.value);
  if (!isFinite(v)) return empty();
  const size = Math.max(70, Math.min(c.w, c.h * 1.25));
  const cx = size / 2, cy = size / 2 + size * 0.06, r1 = size / 2 - 4, r0 = r1 - Math.max(8, size * 0.11);
  const A0 = -Math.PI * 0.75, A1 = Math.PI * 0.75;
  const at = (n: number) => A0 + (Math.max(lo, Math.min(hi, n)) - lo) / (hi - lo || 1) * (A1 - A0);
  const segs: any[] = d.segments || [];
  let from = lo;
  const pct = d.unit === "%" && hi <= 1;
  return html`<div class="gauge"><svg width=${size} height=${size * 0.86} viewBox="0 0 ${size} ${size * 0.86}" role="img" aria-label=${String(v)}>
    <path d=${arcPath(cx, cy, r0, r1, A0, A1)} fill="var(--lm-line)"></path>
    ${segs.length ? segs.map(sg => { const p = svg`<path d=${arcPath(cx, cy, r0, r1, at(from), at(sg.to))} fill=${sg.color} opacity=".35"></path>`; from = sg.to; return p; }) : nothing}
    <path d=${arcPath(cx, cy, r0, r1, A0, at(v))} fill=${c.color}></path>
    <text x=${cx} y=${cy + 4} text-anchor="middle" class="gv" style="font-size:${Math.max(16, size * 0.2)}px">${pct ? fmtNumber(v * 100, 0) : fmtNumber(v)}</text>
    <text x=${cx} y=${cy + 4 + Math.max(14, size * 0.13)} text-anchor="middle" class="ax">${d.unit || ""}</text>
    <text x=${cx + Math.sin(A0) * r1} y=${size * 0.84} text-anchor="start" class="ax">${pct ? "0" : fmtTick(lo)}</text>
    <text x=${cx + Math.sin(A1) * r1} y=${size * 0.84} text-anchor="end" class="ax">${pct ? "100" : fmtTick(hi)}</text></svg></div>`;
}

// ------------------------------------------------------------------ progress
function progress(rec: any, c: Ctx) {
  const d = rec.data || {};
  const p = Math.max(0, Math.min(100, Number(d.percent) || 0));
  return html`<div class="prog">
    <div class="pt"><b>${fmtNumber(p, 0)} %</b></div>
    <div class="bar"><span style="width:${p}%;background:${c.color}"></span></div>
    ${(d.steps || []).length ? html`<ul class="steps">${d.steps.map((s: any) => html`<li class=${s.done ? "done" : ""}>${icon(s.done ? "check" : "mdi:circle-outline", 14)} ${s.label}</li>`)}</ul>` : nothing}
    ${(d.milestones || []).length ? html`<div class="ms">${d.milestones.map((m: any) => html`<span class="chip">${icon("mdi:flag-outline", 12)} ${m.label}${m.at ? ` · ${fmtWhen(m.at)}` : ""}</span>`)}</div>` : nothing}</div>`;
}

// ------------------------------------------------------------------ alert / list / table / text
function alert(rec: any) {
  const items: any[] = rec.data?.items || [];
  if (!items.length) return html`<div class="calm">${icon("check", 22)}<span>${t("Alles ruhig")}</span></div>`;
  return html`<div class="alerts">${items.map(i => {
    const [ic, col, label] = SEV[i.severity] || SEV.info;
    return html`<div class="al" style="--sev:${col}">${icon(ic, 18)}<div class="grow"><div class="at"><b>${i.title}</b><span class="sevl">${t(label)}</span></div>
      ${i.text ? html`<div class="ad">${i.text}</div>` : nothing}
      <div class="am">${i.since ? html`<span>${t("seit {x}", { x: fmtWhen(i.since) })}</span>` : nothing}${link(i.url)}</div></div></div>`;
  })}</div>`;
}

function list(rec: any, c: Ctx) {
  const max = Number(c.options.max_items) || 50;
  const items: any[] = (rec.data?.items || []).slice(0, max);
  if (!items.length) return html`<div class="calm">${icon("check", 22)}<span>${t("Nichts offen")}</span></div>`;
  return html`<ul class="items">${items.map(i => {
    const [ic, col] = STATE[i.state] || ["mdi:circle-small", "var(--lm-faint)"];
    return html`<li class=${i.state === "erledigt" ? "done" : ""}><span style="color:${col}" title=${i.state ? t(i.state) : ""}>${icon(ic, 16)}</span>
      <div class="grow"><div class="it">${i.title}</div>${(i.meta && c.options.show_meta !== false) || i.url ? html`<div class="im">${i.meta || ""} ${link(i.url)}</div>` : nothing}</div>
      ${i.state ? html`<span class="chip st-${i.state}">${t(i.state)}</span>` : nothing}</li>`;
  })}</ul>`;
}

function cell(v: any, type: string) {
  if (v === null || v === undefined || v === "") return "";
  if (type === "number" && typeof v === "number") return fmtNumber(v);
  if (type === "date") { const n = typeof v === "number" ? v : Date.parse(v) / 1000; return isFinite(n) ? fmtWhen(n) : String(v); }
  if (type === "chip") return html`<span class="chip">${v}</span>`;
  return String(v);
}

function table(rec: any, c: Ctx) {
  const d = rec.data || {};
  const cols: any[] = d.columns || [];
  if (!cols.length) return empty();
  const sort = c.sort || d.sort;
  const rows = [...(d.rows || [])];
  if (sort?.key) {
    rows.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), dateLocale());
      return sort.dir === "asc" ? r : -r;
    });
  }
  // Fett und Farbe gelten je Spalte – in der Fußzeile genauso wie im Body
  const td = (col: any, v: any, extra = "") => {
    const col2 = cellColor(col.color);
    return html`<td class=${cellClass(col, extra)} style=${col2 ? `color:${col2}` : nothing}>${cell(v, col.type)}</td>`;
  };
  const footer = d.footer && typeof d.footer === "object" ? d.footer : null;
  return html`<div class="tw"><table><thead><tr>${cols.map(col => html`<th @click=${() => c.setSort?.(col.key)} class=${col.type === "number" ? "num" : ""}>
      ${col.label}${sort?.key === col.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`)}</tr></thead>
    <tbody>${rows.map(r => html`<tr>${cols.map(col => td(col, r[col.key]))}</tr>`)}</tbody>
    ${footer ? html`<tfoot><tr>${cols.map(col => td(col, footer[col.key], "tf"))}</tr></tfoot>` : nothing}</table></div>`;
}

function text(rec: any) {
  const m = rec.data?.markdown || "";
  return m ? html`<div class="md txt">${md(m)}</div>` : empty();
}

// ------------------------------------------------------------------ matrix
function matrix(rec: any, c: Ctx) {
  const d = rec.data || {};
  const cells: any[] = d.cells || [];
  const items: any[] = d.items || [];
  const lab = 16;
  const side = Math.max(80, Math.min(c.w - lab - 4, c.h - lab - 4));
  const cs = side / 5;
  const zone = (x: number, y: number) => {
    const r = x * y;
    return r >= 15 ? ["var(--lm-err)", "hoch"] : r >= 8 ? ["var(--lm-warn)", "mittel"] : ["var(--lm-ok)", "gering"];
  };
  const tip = (x: number, y: number) => {
    const here = items.filter(i => i.x === x && i.y === y).map(i => "• " + i.title);
    return `${d.axes?.x || "x"} ${x}, ${d.axes?.y || "y"} ${y} – Risiko ${zone(x, y)[1]}` + (here.length ? "\n" + here.join("\n") : "");
  };
  return html`<svg class="matrix" width=${side + lab + 2} height=${side + lab + 2} role="img" aria-label=${t("Risikomatrix")}>
    ${[1, 2, 3, 4, 5].flatMap(x => [1, 2, 3, 4, 5].map(y => {
      const n = cells.find(q => q.x === x && q.y === y)?.count || 0;
      const [col] = zone(x, y);
      const px = lab + (x - 1) * cs, py = (5 - y) * cs;
      return svg`<rect x=${px + 1} y=${py + 1} width=${cs - 2} height=${cs - 2} rx="4" fill=${col} opacity=${n ? 0.85 : 0.14}
          class="hit-mark" data-tip=${tip(x, y)}></rect>
        ${n ? svg`<text x=${px + cs / 2} y=${py + cs / 2 + 5} text-anchor="middle" class="mv">${n}</text>` : nothing}`;
    }))}
    <text x=${lab + side / 2} y=${side + lab - 2} text-anchor="middle" class="ax">${d.axes?.x || t("Wahrscheinlichkeit")} →</text>
    <text x="11" y=${side / 2} text-anchor="middle" class="ax" transform="rotate(-90 11 ${side / 2})">${d.axes?.y || t("Auswirkung")} →</text></svg>`;
}

function empty(): TemplateResult {
  return html`<div class="calm muted">${icon("mdi:timer-sand", 20)}<span>${t("Noch keine Daten")}</span></div>`;
}

export function renderKind(kind: string, rec: any, c: Ctx): unknown {
  if (!rec || rec.data === null || rec.data === undefined) return empty();
  switch (kind) {
    case "stat": return stat(rec, c);
    case "chart": return chart(rec, c);
    case "gauge": return gauge(rec, c);
    case "progress": return progress(rec, c);
    case "alert": return alert(rec);
    case "list": return list(rec, c);
    case "table": return table(rec, c);
    case "text": return text(rec);
    case "matrix": return matrix(rec, c);
    case "scene": return html`<lm-scene .data=${rec.data} .dark=${c.dark}></lm-scene>`;
    default: return empty();
  }
}

export const KIND_INFO: Record<string, { label: string; icon: string; hint: string }> = {
  stat: { label: "Kennzahl", icon: "mdi:numeric", hint: "Eine große Zahl mit Veränderung und Verlauf" },
  chart: { label: "Diagramm", icon: "mdi:chart-line", hint: "Linie, Fläche, Balken oder Donut über die Zeit" },
  alert: { label: "Warnungen", icon: "mdi:alert-outline", hint: "Hinweise und Warnungen mit Dringlichkeit" },
  table: { label: "Tabelle", icon: "mdi:table", hint: "Zeilen und Spalten, sortierbar" },
  list: { label: "Liste", icon: "mdi:format-list-checks", hint: "Aufgaben oder Einträge mit Status" },
  progress: { label: "Fortschritt", icon: "mdi:progress-check", hint: "Prozent, Schritte und Meilensteine" },
  matrix: { label: "Risikomatrix", icon: "mdi:grid", hint: "5×5 Wahrscheinlichkeit × Auswirkung" },
  gauge: { label: "Messuhr", icon: "mdi:gauge", hint: "Ein Wert auf einer Skala" },
  scene: { label: "3D-Szene", icon: "mdi:cube-outline", hint: "Würfel, Kugeln, Zylinder und Ringe" },
  text: { label: "Notiz", icon: "mdi:text-box-outline", hint: "Kurzer Text in Markdown" },
};

// Which Home-Assistant source fits which tile type (like dashboards.HA_KIND_MODES)
export const HA_KIND_MODES: Record<string, string[]> = {
  stat: ["state", "history", "statistics", "template"], gauge: ["state"], progress: ["state", "todo"],
  chart: ["history", "statistics"], alert: ["state"], table: ["state", "calendar"], list: ["state", "calendar", "todo"],
  text: ["state", "template"], matrix: [], scene: [],
};
export const MODE_INFO: Record<string, { label: string; hint: string }> = {
  state: { label: "Zustand", hint: "Der aktuelle Wert einer oder mehrerer Entitäten – live" },
  history: { label: "Verlauf", hint: "Werte der letzten Stunden oder Tage" },
  statistics: { label: "Statistik", hint: "Langzeitstatistik je Stunde, Tag, Woche oder Monat (z. B. Energie)" },
  calendar: { label: "Kalender", hint: "Termine der nächsten Tage" },
  todo: { label: "To-do-Liste", hint: "Einträge einer HA-To-do-Liste – live" },
  template: { label: "Vorlage", hint: "Jinja-Vorlage, von Home Assistant ausgewertet (nur Admins)" },
};
