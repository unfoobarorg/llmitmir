// Tiles without a model: their data comes straight from Home Assistant, in the browser of whoever looks at them.
// The feed turns states, history, statistics, calendars and to-do lists into the same record a tile run writes
// (status, headline, data …), so the tile types do not care where the numbers came from.
import { store } from "../api";
import { t, tb, dateLocale } from "../i18n";

type Rec = { status: string; headline: string; subline?: string; data: any; updated: number | null; error?: string | null; series?: any };

const RANK: Record<string, number> = { ok: 0, empty: 0, warn: 1, error: 2 };

export const friendly = (st: any, eid: string) => st?.attributes?.friendly_name || eid;

function num(v: any): number | null {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}

/** Worst status of the rules that match this value (no rule: ok). */
export function ruleStatus(value: any, rules: any[] = []): string {
  let out = "ok";
  for (const r of rules || []) {
    const n = num(value), t = num(r.value);
    let hit = false;
    if (r.if === "below") hit = n !== null && t !== null && n < t;
    else if (r.if === "above") hit = n !== null && t !== null && n > t;
    else if (r.if === "equals") hit = String(value) === String(r.value);
    else if (r.if === "not") hit = String(value) !== String(r.value);
    if (hit && RANK[r.status] > RANK[out]) out = r.status;
  }
  return out;
}

function globRe(p: string): RegExp {
  return new RegExp("^" + p.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
}

export function entitiesOf(src: any, states: Record<string, any>): string[] {
  const out = [...(src.entities || [])];
  if (src.pattern) {
    const re = globRe(src.pattern);
    for (const eid of Object.keys(states).sort()) if (re.test(eid) && !out.includes(eid)) out.push(eid);
  }
  return out.slice(0, 50);
}

const valueOf = (st: any, attr?: string) => (attr ? st?.attributes?.[attr] : st?.state);
const unitOf = (st: any, attr?: string) => (attr ? "" : st?.attributes?.unit_of_measurement || "");
const unavailable = (st: any) => !st || ["unavailable", "unknown"].includes(st.state);
const tsOf = (v: any) => (typeof v === "number" ? (v > 1e11 ? v / 1000 : v) : Date.parse(v) / 1000);

function fmtState(st: any, attr?: string): string {
  const v = valueOf(st, attr);
  const n = num(v);
  const u = unitOf(st, attr);
  if (n !== null) return n.toLocaleString(dateLocale(), { maximumFractionDigits: 2 }) + (u ? " " + u : "");
  if (v === "on") return t("an"); if (v === "off") return t("aus");
  return String(v ?? "–") + (u ? " " + u : "");
}

const CHECK = {
  history: 5 * 60_000, statistics: 15 * 60_000, calendar: 15 * 60_000, trend: 10 * 60_000,
};

export class HaFeed {
  private cache: any = null;          // last fetched history / statistics / calendar
  private fetched = 0;
  private busy = false;
  private unsubTodo: (() => void) | null = null;
  private todo: any[] | null = null;
  private timer: any = null;
  error = "";
  constructor(public tile: any, private onChange: () => void) {}

  get src() { return this.tile.source || {}; }
  get hass() { return store.api?.hass; }

  start() {
    const m = this.src.mode;
    if (m === "todo") this.subscribeTodo();
    else if (m !== "state" || this.tile.kind === "stat") this.fetch();
    const every = m === "statistics" || m === "calendar" ? CHECK.statistics : m === "history" ? CHECK.history : CHECK.trend;
    if (m !== "todo" && (m !== "state" || this.tile.kind === "stat")) this.timer = setInterval(() => this.fetch(true), every);
  }

  stop() {
    clearInterval(this.timer); this.timer = null;
    try { this.unsubTodo?.(); } catch { /* gone */ }
    this.unsubTodo = null;
  }

  private async subscribeTodo() {
    const eid = (this.src.entities || [])[0];
    if (!eid || !this.hass) return;
    try {
      const unsub = await this.hass.connection.subscribeMessage((e: any) => { this.todo = e.items || []; this.onChange(); },
        { type: "todo/item/subscribe", entity_id: eid });
      this.unsubTodo = unsub;
    } catch (e: any) { this.error = t("To-do-Liste nicht lesbar: {e}", { e: e?.message || e }); this.onChange(); }
  }

  private async fetch(force = false) {
    if (this.busy || !this.hass) return;
    if (!force && this.cache && Date.now() - this.fetched < 30_000) return;
    this.busy = true;
    const src = this.src, ents: string[] = src.entities || [];
    try {
      const now = new Date();
      if (src.mode === "history" || (src.mode === "state" && this.tile.kind === "stat")) {
        const hours = src.mode === "history" ? src.hours || 24 : 24;
        const start = new Date(now.getTime() - hours * 3600_000).toISOString();
        const ids = src.mode === "history" ? ents.slice(0, 8) : ents.slice(0, 1);
        if (ids.length) {
          this.cache = await this.hass.connection.sendMessagePromise({
            type: "history/history_during_period", start_time: start, end_time: now.toISOString(), entity_ids: ids,
            minimal_response: true, no_attributes: true, significant_changes_only: false,
          });
        }
      } else if (src.mode === "statistics") {
        const st = src.statistics || {};
        const per: Record<string, number> = { "5minute": 300, hour: 3600, day: 86400, week: 7 * 86400, month: 31 * 86400 };
        const start = new Date(now.getTime() - (st.count || 14) * (per[st.period] || 86400) * 1000).toISOString();
        this.cache = await this.hass.connection.sendMessagePromise({
          type: "recorder/statistics_during_period", start_time: start, end_time: now.toISOString(), statistic_ids: ents.slice(0, 8),
          period: st.period || "day", types: [st.stat || "mean"],
        });
      } else if (src.mode === "calendar") {
        const end = new Date(now.getTime() + (src.days || 7) * 86400_000);
        const out: any[] = [];
        for (const eid of ents.slice(0, 6)) {
          const evs = await this.hass.callApi("GET", `calendars/${eid}?start=${encodeURIComponent(now.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
          for (const ev of evs || []) out.push({ ...ev, _cal: eid });
        }
        this.cache = out;
      }
      this.error = "";
      this.fetched = Date.now();
    } catch (e: any) {
      this.error = `Home Assistant: ${tb(String(e?.message || e?.code || e))}`;
    } finally {
      this.busy = false;
      this.onChange();
    }
  }

  /** The record for the tile right now (cheap – called on every redraw). */
  record(): Rec {
    const hass = this.hass;
    const states: Record<string, any> = hass?.states || {};
    const src = this.src, kind = this.tile.kind, rules = src.rules || [];
    const base = { status: "ok", headline: "", subline: "", data: null as any, updated: null as number | null, error: this.error || null };
    try {
      switch (src.mode) {
        case "state": return { ...base, ...this.fromState(states, src, kind, rules) };
        case "history": return { ...base, ...this.fromHistory(states, src, kind, rules) };
        case "statistics": return { ...base, ...this.fromStatistics(states, src, kind) };
        case "calendar": return { ...base, ...this.fromCalendar(kind) };
        case "todo": return { ...base, ...this.fromTodo(states, src, kind) };
      }
    } catch (e: any) {
      return { ...base, error: String(e?.message || e) };
    }
    return base;
  }

  private fromState(states: any, src: any, kind: string, rules: any[]): Partial<Rec> {
    const ids = entitiesOf(src, states);
    const first = states[ids[0]];
    const opts = this.tile.options || {};
    const lastChanged = Math.max(0, ...ids.map(i => Date.parse(states[i]?.last_changed || "") / 1000 || 0)) || null;
    if (!ids.length) return { status: "empty", data: null };
    if (["stat", "gauge", "progress"].includes(kind)) {
      if (unavailable(first)) return { status: "warn", headline: t("{name}: nicht erreichbar", { name: friendly(first, ids[0]) }), data: null, updated: lastChanged };
      const v = num(valueOf(first, src.attribute));
      if (v === null) return { status: "warn", headline: t("{name}: „{v}“ ist keine Zahl", { name: friendly(first, ids[0]), v: valueOf(first, src.attribute) }), data: null };
      const status = ruleStatus(v, rules);
      const unit = opts.unit || unitOf(first, src.attribute);
      const headline = String(opts.title || friendly(first, ids[0]));
      if (kind === "gauge") {
        return { status, headline, updated: lastChanged, data: { value: v, min: opts.min ?? 0, max: opts.max ?? 100, unit, segments: [] } };
      }
      if (kind === "progress") return { status, headline, updated: lastChanged, data: { percent: v, steps: [], milestones: [] } };
      const trend = this.historyPoints(ids[0], src.attribute).map(p => p[1]);
      const prev = trend.length > 1 ? trend[0] : null;
      const dec = Number.isInteger(v) ? 0 : 1;
      const delta = prev !== null && isFinite(prev) ? v - prev : null;
      return {
        status, headline, subline: delta !== null ? t("seit 24 Stunden") : "", updated: lastChanged,
        data: { value: v, unit, decimals: opts.decimals ?? dec, trend: [...trend.slice(-29), v],
          ...(delta !== null ? { delta: (delta > 0 ? "+" : delta < 0 ? "−" : "±") + Math.abs(delta).toLocaleString(dateLocale(), { maximumFractionDigits: dec }) } : {}) },
      };
    }
    const rows = ids.map(eid => {
      const st = states[eid];
      const v = valueOf(st, src.attribute);
      return { eid, st, name: friendly(st, eid), text: unavailable(st) ? t("nicht erreichbar") : fmtState(st, src.attribute),
        status: unavailable(st) ? "warn" : ruleStatus(v, rules), changed: Date.parse(st?.last_changed || "") / 1000 || null };
    });
    const worst = rows.reduce((a, r) => (RANK[r.status] > RANK[a] ? r.status : a), "ok");
    if (kind === "alert") {
      const hits = rows.filter(r => (rules.length ? r.status !== "ok" : ["on", "open", "problem", "unavailable"].includes(r.st?.state)));
      return {
        status: hits.length ? (hits.some(r => r.status === "error") ? "error" : "warn") : "ok",
        headline: hits.length ? t(hits.length === 1 ? "{n} Meldung" : "{n} Meldungen", { n: hits.length }) : t("Alles in Ordnung"), updated: lastChanged,
        data: { items: hits.map(r => ({ severity: r.status === "error" ? "critical" : "warn", title: r.name, text: r.text, since: r.changed })) },
      };
    }
    if (kind === "list") {
      return { status: worst, headline: t("{n} Entitäten", { n: rows.length }), updated: lastChanged,
        data: { items: rows.map(r => ({ title: r.name, meta: r.text, state: r.status === "error" ? "blockiert" : "" })) } };
    }
    if (kind === "table") {
      return { status: worst, headline: "", updated: lastChanged, data: {
        columns: [{ key: "name", label: t("Name"), type: "text" }, { key: "wert", label: src.attribute || t("Wert"), type: "text" },
          { key: "seit", label: "Seit", type: "date" }],
        rows: rows.map(r => ({ name: r.name, wert: r.text, seit: r.changed })), sort: null } };
    }
    // text
    return { status: worst, headline: "", updated: lastChanged,
      data: { markdown: rows.map(r => `**${r.name}:** ${r.text}`).join("\n\n") } };
  }

  /** [ts, value] of one entity from the fetched history, ending with the current state. */
  private historyPoints(eid: string, attr?: string): [number, number][] {
    const raw: any[] = (this.cache && !Array.isArray(this.cache) ? this.cache[eid] : null) || [];
    const pts: [number, number][] = [];
    for (const e of raw) {
      const v = num(attr ? e.a?.[attr] : e.s ?? e.state);
      const t = e.lu ?? e.lc ?? tsOf(e.last_updated || e.last_changed);
      if (v !== null && isFinite(t)) pts.push([t, v]);
    }
    return pts;
  }

  private fromHistory(states: any, src: any, kind: string, rules: any[]): Partial<Rec> {
    const ids: string[] = (src.entities || []).slice(0, 8);
    const series = ids.map(eid => {
      const pts = this.historyPoints(eid, src.attribute);
      const cur = num(valueOf(states[eid], src.attribute));
      if (cur !== null) pts.push([Date.now() / 1000, cur]);
      return { name: friendly(states[eid], eid), points: thin(pts, 200), color: "" };
    });
    if (!series.some(s => s.points.length)) return { status: this.cache ? "empty" : "ok", data: this.cache ? null : null };
    const unit = unitOf(states[ids[0]], src.attribute);
    if (kind === "stat") {
      const pts = series[0].points;
      const v = pts[pts.length - 1][1], first = pts[0][1];
      return { status: ruleStatus(v, rules), headline: series[0].name, subline: `letzte ${src.hours || 24} h`, updated: Date.now() / 1000,
        data: { value: v, unit, trend: pts.slice(-30).map(p => p[1]),
          delta: (v - first > 0 ? "+" : v - first < 0 ? "−" : "±") + Math.abs(v - first).toLocaleString(dateLocale(), { maximumFractionDigits: 1 }) } };
    }
    const opts = this.tile.options || {};
    return { status: "ok", headline: "", subline: `letzte ${src.hours || 24} h`, updated: Date.now() / 1000,
      data: { type: ["line", "area", "bar"].includes(opts.chart) ? opts.chart : "line", series, y_unit: unit } };
  }

  private fromStatistics(states: any, src: any, kind: string): Partial<Rec> {
    if (!this.cache || Array.isArray(this.cache)) return { data: null };
    const st = src.statistics || {};
    const key = st.stat || "mean";
    const series = (src.entities || []).slice(0, 8).map((eid: string) => {
      const rows: any[] = this.cache[eid] || [];
      return { name: friendly(states[eid], eid), points: rows.map(r => [tsOf(r.start), Number(r[key])] as [number, number]).filter(p => isFinite(p[1])), color: "" };
    });
    if (!series.some((s: any) => s.points.length)) return { status: "empty", data: null };
    const unit = unitOf(states[(src.entities || [])[0]]);
    const label: Record<string, string> = { "5minute": t("je 5 Minuten"), hour: t("je Stunde"), day: t("je Tag"), week: t("je Woche"), month: t("je Monat") };
    if (kind === "stat") {
      const pts = series[0].points;
      return { status: "ok", headline: series[0].name, subline: label[st.period] || "", updated: pts[pts.length - 1][0],
        data: { value: pts[pts.length - 1][1], unit, trend: pts.map((p: any) => p[1]) } };
    }
    const opts = this.tile.options || {};
    return { status: "ok", headline: "", subline: label[st.period] || "", updated: Date.now() / 1000,
      data: { type: ["line", "area", "bar"].includes(opts.chart) ? opts.chart : "bar", series, y_unit: unit } };
  }

  private fromCalendar(kind: string): Partial<Rec> {
    if (!Array.isArray(this.cache)) return { data: null };
    const evs = this.cache.map((ev: any) => {
      const s = ev.start?.dateTime || ev.start?.date || ev.start;
      const allDay = !ev.start?.dateTime && !!ev.start?.date;
      const ts = Date.parse(s) / 1000;
      return { t: ts, allDay, title: ev.summary || t("(ohne Titel)"), place: ev.location || "" };
    }).sort((a: any, b: any) => a.t - b.t);
    const when = (e: any) => (e.allDay ? new Date(e.t * 1000).toLocaleDateString(dateLocale(), { weekday: "short", day: "2-digit", month: "2-digit" }) + t(" ganztägig")
      : new Date(e.t * 1000).toLocaleString(dateLocale(), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }));
    const head = evs.length ? t(evs.length === 1 ? "{n} Termin" : "{n} Termine", { n: evs.length }) : t("Keine Termine");
    if (kind === "table") {
      return { status: "ok", headline: head, updated: this.fetched / 1000, data: {
        columns: [{ key: "wann", label: t("Wann"), type: "text" }, { key: "was", label: t("Was"), type: "text" }, { key: "wo", label: t("Ort"), type: "text" }],
        rows: evs.map((e: any) => ({ wann: when(e), was: e.title, wo: e.place })), sort: null } };
    }
    return { status: "ok", headline: head, updated: this.fetched / 1000,
      data: { items: evs.map((e: any) => ({ title: e.title, meta: when(e) + (e.place ? ` · ${e.place}` : ""), state: "" })) } };
  }

  private fromTodo(states: any, src: any, kind: string): Partial<Rec> {
    if (!this.todo) return { data: null };
    const eid = (src.entities || [])[0];
    const open = this.todo.filter(i => i.status !== "completed"), done = this.todo.filter(i => i.status === "completed");
    if (kind === "progress") {
      const p = this.todo.length ? (done.length / this.todo.length) * 100 : 0;
      return { status: "ok", headline: friendly(states[eid], eid), subline: t("{a} von {b} erledigt", { a: done.length, b: this.todo.length }), updated: Date.now() / 1000,
        data: { percent: p, steps: this.todo.slice(0, 20).map(i => ({ label: i.summary, done: i.status === "completed" })), milestones: [] } };
    }
    const fmtDue = (d: any) => (d ? t("fällig {d}", { d: new Date(d).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit" }) }) : "");
    return { status: "ok", headline: `${open.length} offen`, updated: Date.now() / 1000,
      data: { items: [...open, ...done].map(i => ({ title: i.summary, state: i.status === "completed" ? "erledigt" : "offen", meta: [fmtDue(i.due), i.description || ""].filter(Boolean).join(" · ") })) } };
  }
}

/** At most n points, evenly spaced, keeping the last one. */
function thin(pts: [number, number][], n: number): [number, number][] {
  if (pts.length <= n) return pts;
  const step = pts.length / n, out: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) out.push(pts[Math.floor(i * step)]);
  out.push(pts[pts.length - 1]);
  return out;
}
