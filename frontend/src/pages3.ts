// Dashboards: colourful overviews made of reusable tiles on a grid (like a phone's home screen).
// lm-dashboards – the page with the switcher, the grid, edit mode and the tile library
// lm-tile-sheet – one tile: display, data source, data and sharing (also opened from „Geplant“ or a notification)
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, md, fmtTime, confirmDialog, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { explainer, explainerCss } from "./simple";
import * as G from "./grid";
import { KIND_INFO, HA_KIND_MODES, MODE_INFO } from "./tiles/kinds";
import { PALETTES, PALETTE_LABELS, hashIndex, tileColor } from "./tiles/svg";
import { friendly } from "./tiles/ha";
import "./tiles/tile";
import "./share";

const GAP = 12;
const LS_EDIT_HINT = "llmitmir.dash.hint";
const ICONS = ["mdi:view-dashboard-outline", "mdi:home-outline", "mdi:email-outline", "mdi:calendar-month-outline", "mdi:flash-outline",
  "mdi:thermometer", "mdi:water-outline", "mdi:chart-line", "mdi:briefcase-outline", "mdi:school-outline", "mdi:heart-outline",
  "mdi:car-outline", "mdi:shield-alert-outline", "mdi:format-list-checks", "mdi:numeric", "mdi:gauge", "mdi:alert-outline",
  "mdi:table", "mdi:cube-outline", "mdi:text-box-outline", "mdi:progress-check", "mdi:grid", "mdi:solar-power", "mdi:account-group-outline"];

const boards = () => store.data?.boards || { dashboards: [], tiles: [], hidden_tiles: [], tile_tasks: [], budget: {}, limits: {} };
const tileByKey = (k: string) => boards().tiles.find((x: any) => x.key === k);
const placeKey = (p: any) => `${p.tile_owner}:${p.tile_id}`;
const query = (name: string) => new URLSearchParams(location.search).get(name) || "";
const dark = () => !!store.data?.__dark;

// ------------------------------------------------------------------ schedules of model tiles
/** The minute a tile runs at: kept from its current schedule (the server spreads tiles over the hour), else from the seed. */
function minuteOf(seed: string, cron?: string) {
  const f = (cron || "").trim().split(/\s+/)[0] || "";
  const m = f.match(/^(\d{1,2})(?:,\d{1,2})?$/);
  return m ? Number(m[1]) % 60 : hashIndex(seed) % 60;
}
export function schedulePresets(seed: string, cron?: string): [string, string, string][] {
  const m = minuteOf(seed, cron), h = m % 30;
  return [
    ["std", "Stündlich von 7 bis 22 Uhr (Standard)", `${m} 7-22 * * *`],
    ["hourly", "Stündlich, rund um die Uhr", `${m} * * * *`],
    ["half", "Alle 30 Minuten von 7 bis 22 Uhr", `${h},${h + 30} 7-22 * * *`],
    ["two", "Alle 2 Stunden von 7 bis 21 Uhr", `${m} 7-21/2 * * *`],
    ["work", "Werktags stündlich von 8 bis 18 Uhr", `${m} 8-18 * * 1-5`],
    ["twice", "Zweimal am Tag (7 und 17 Uhr)", `${m} 7,17 * * *`],
    ["daily", "Einmal am Tag (7 Uhr)", `${m} 7 * * *`],
  ];
}
function count(spec: string, lo: number, hi: number): number {
  let n = 0;
  for (const part of spec.split(",")) {
    const [range, stepS] = part.split("/");
    const step = Number(stepS || 1);
    const [a, b] = range === "*" ? [lo, hi] : range.includes("-") ? range.split("-").map(Number) : [Number(range), stepS ? hi : Number(range)];
    if (!isFinite(a) || !isFinite(b) || step < 1) return NaN;
    n += Math.floor((b - a) / step) + 1;
  }
  return n;
}
/** Runs per day of a cron expression (minute × hour × share of weekdays) – an estimate for the form. */
export function runsPerDay(cron: string): number {
  const f = (cron || "").trim().split(/\s+/);
  if (f.length !== 5) return NaN;
  const per = count(f[0], 0, 59) * count(f[1], 0, 23);
  const dow = f[4] === "*" ? 7 : count(f[4].replace(/\b7\b/, "0"), 0, 6);
  const dom = f[2] === "*" ? 1 : count(f[2], 1, 31) / 30.4;
  return Math.round(per * (dow / 7) * dom * 10) / 10;
}

// ------------------------------------------------------------------ shared CSS
const sheetCss = css`
  .back { position: fixed; inset: 0; background: rgba(0,0,0,.38); z-index: 50; display: grid; place-items: center; padding: 16px;
    padding-top: calc(16px + var(--safe-area-inset-top, 0px)); padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px)); animation: fadeIn .15s; }
  .sheet { background: var(--lm-bg); color: var(--lm-text); border-radius: 20px; width: min(980px, 100%); max-height: 100%; display: flex; flex-direction: column;
    box-shadow: 0 24px 70px rgba(0,0,0,.35); overflow: hidden; }
  .sheet.small { width: min(560px, 100%); }
  .sh { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; border-bottom: 1px solid var(--lm-line); background: var(--lm-panel); }
  .sh h2 { margin: 0; font-size: 17px; font-family: var(--lm-head); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sb { overflow-y: auto; padding: 16px; display: grid; gap: 14px; min-height: 0; }
  .sf { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--lm-line); background: var(--lm-panel); }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; } .tabs button { border: 0; background: none; padding: 7px 11px; border-radius: 9px; cursor: pointer; color: var(--lm-muted); font-size: 14px; }
  .tabs button.on { background: var(--lm-hover); color: var(--lm-text); font-weight: 560; }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .sw { width: 28px; height: 28px; border-radius: 9px; border: 2px solid transparent; cursor: pointer; padding: 0; }
  .sw.on { border-color: var(--lm-text); }
  .choice { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: 10px; }
  .choice button { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; border-radius: 14px; border: 1px solid var(--lm-line);
    background: var(--lm-panel); cursor: pointer; }
  .choice button:hover { border-color: var(--lm-accent); }
  .choice button[disabled] { opacity: .45; pointer-events: none; }
  .choice b { display: block; font-size: 14.5px; margin-bottom: 2px; }
  .choice .ic { color: var(--lm-accent); display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--lm-accent-soft); flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips .chip { cursor: default; } .chips .chip button { border: 0; background: none; cursor: pointer; padding: 0; color: inherit; display: inline-grid; }
  .rule { display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; gap: 6px; align-items: center; }
  pre.json { background: var(--lm-side); border: 1px solid var(--lm-line); border-radius: 10px; padding: 10px 12px; font-size: 12px; overflow: auto; max-height: 340px; margin: 0; }
  .pv { height: 260px; }
  label.f > span.hint, .f > span.hint { font-weight: 400; color: var(--lm-muted); }
  @media (max-width: 720px) { .two { grid-template-columns: 1fr; } .rule { grid-template-columns: 1fr 1fr; } }
`;

// ------------------------------------------------------------------ the page
@safeElement("lm-dashboards")
export class Dashboards extends StoreElement {
  @property() boardKey = "";
  @state() private editing = false;
  @state() private draft: G.Cell[] | null = null;
  @state() private width = 0;
  @state() private library = false;
  @state() private settings: any = null;      // dashboard being edited in the settings dialog (or {new: true})
  @state() private sheet: { key?: string; create?: boolean; pid?: string } | null = null;
  @state() private libQ = "";
  private ro?: ResizeObserver;
  private drag: { pid: string; mode: "move" | "size"; sx: number; sy: number; x: number; y: number; w: number; h: number } | null = null;
  private hold: any = null;
  private saving = false;
  private _loc = () => this.fromQuery();

  static styles = [base, explainerCss, sheetCss, css`
    :host { display: block; height: 100%; overflow-y: auto; }
    .page { max-width: 1500px; }
    .bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
    .switch { display: flex; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: thin; padding-bottom: 2px; }
    .switch button { display: inline-flex; gap: 7px; align-items: center; border: 1px solid transparent; background: none; padding: 7px 12px; border-radius: 11px;
      cursor: pointer; color: var(--lm-muted); white-space: nowrap; font-size: 14px; }
    .switch button.on { background: var(--lm-panel); border-color: var(--lm-line); color: var(--lm-text); font-weight: 580; box-shadow: var(--lm-shadow); }
    .switch button .own { font-size: 11px; color: var(--lm-faint); }
    .title { display: flex; gap: 10px; align-items: center; flex: 1; min-width: 0; }
    .title h1 { margin: 0 !important; font-size: 26px; }
    .title .i { color: var(--lm-accent); }
    .board { position: relative; touch-action: pan-y; }
    .board.edit { background-image: radial-gradient(circle, color-mix(in srgb, var(--lm-text) 22%, transparent) 1.2px, transparent 1.4px);
      background-size: var(--step) var(--step); background-position: calc(var(--cell) / 2 + 2px) calc(var(--cell) / 2); border-radius: 12px; }
    .cell { position: absolute; transition: left .22s ease, top .22s ease, width .22s ease, height .22s ease; outline: none; }
    .cell.dragging { transition: none; z-index: 3; filter: drop-shadow(0 14px 26px rgba(0,0,0,.25)); }
    .cell:focus-visible { box-shadow: 0 0 0 3px var(--lm-accent); border-radius: 18px; }
    @media (prefers-reduced-motion: reduce) { .cell { transition: none; } }
    .handles { position: absolute; inset: 0; pointer-events: none; }
    .handles > * { pointer-events: auto; }
    .grip, .del, .rs, .more { position: absolute; display: grid; place-items: center; border: 0; cursor: pointer; background: var(--lm-raise); color: var(--lm-text);
      box-shadow: 0 2px 8px rgba(0,0,0,.18); border-radius: 10px; width: 30px; height: 30px; }
    .grip { left: 6px; top: 6px; cursor: grab; touch-action: none; }
    .del { right: 6px; top: 6px; color: var(--lm-err); }
    .more { right: 40px; top: 6px; }
    .rs { right: 4px; bottom: 4px; cursor: nwse-resize; touch-action: none; width: 26px; height: 26px; }
    .tools { position: absolute; left: 6px; right: 6px; bottom: 6px; display: flex; gap: 4px; justify-content: center; }
    .tools button { width: 34px; height: 30px; border-radius: 9px; border: 0; background: var(--lm-raise); box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; display: grid; place-items: center; }
    @media (max-width: 640px) { .switch { order: 3; flex-basis: 100%; } .bar .title { flex-basis: 100%; } }
    .empty { text-align: center; padding: 48px 16px; color: var(--lm-muted); border: 2px dashed var(--lm-line); border-radius: 18px; }
    .empty .btn { margin-top: 12px; }
    .lib { display: grid; gap: 8px; }
    .lib .item { padding: 10px 12px; }
    .lib .ic { color: var(--acc); display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--acc) 16%, transparent); flex: none; }
    .lib h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--lm-faint); margin: 10px 0 2px; }
    .budget { font-size: 12.5px; color: var(--lm-muted); }
  `];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("location-changed", this._loc);
    window.addEventListener("popstate", this._loc);
    this.fromQuery();
    store.loadBoards().catch(() => {});
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this._loc);
    window.removeEventListener("popstate", this._loc);
    this.ro?.disconnect();
  }
  private fromQuery() {
    const k = query("tile");
    if (k) this.sheet = { key: k };
  }

  private get current(): any {
    const list = boards().dashboards;
    return list.find((d: any) => d.key === this.boardKey) || (this.boardKey ? null : list[0]) || null;
  }

  updated() {
    const g = this.renderRoot.querySelector(".gridwrap") as HTMLElement | null;
    if (g && !this.ro) {
      this.ro = new ResizeObserver(() => { const w = g.clientWidth; if (Math.abs(w - this.width) > 1) this.width = w; });
      this.ro.observe(g);
      this.width = g.clientWidth;
    } else if (!g && this.ro) { this.ro.disconnect(); this.ro = undefined; }
    const d = this.current;
    if (d) {
      const keys = (d.placements || []).map(placeKey).filter((k: string) => tileByKey(k));
      store.loadTileData(keys).catch(() => {});
    }
  }

  // ---------------------------------------------------------- saving the layout
  private async saveLayout(cells: G.Cell[]) {
    const d = this.current; if (!d || this.saving) return;
    this.saving = true;
    try {
      const r = await store.api.ws("dashboard/save", { dashboard: { id: d.id, owner: d.owner, version: d.version, placements: cells } });
      Object.assign(d, r);
      this.draft = null;
    } catch (e: any) {
      store.notify(e.message);
      this.draft = null;
      await store.loadBoards();
    } finally { this.saving = false; }
  }
  private cells(): G.Cell[] { return this.draft || (this.current?.placements || []); }

  private removePlacement(pid: string) { this.saveLayout(G.compact(this.cells().filter(c => c.pid !== pid))); }

  // ---------------------------------------------------------- drag & resize (12 columns)
  private startDrag(e: PointerEvent, c: G.Cell, mode: "move" | "size") {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.drag = { pid: c.pid, mode, sx: e.clientX, sy: e.clientY, x: c.x, y: c.y, w: c.w, h: c.h };
    this.draft = [...this.cells()];
    const move = (ev: PointerEvent) => this.onDrag(ev);
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const changed = this.draft && JSON.stringify(this.draft) !== JSON.stringify(this.current?.placements);
      this.drag = null;
      if (changed) this.saveLayout(this.draft!); else this.draft = null;
      this.requestUpdate();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  private onDrag(e: PointerEvent) {
    const dr = this.drag; if (!dr) return;
    const step = this.step();
    const dx = Math.round((e.clientX - dr.sx) / step), dy = Math.round((e.clientY - dr.sy) / step);
    const base = this.current?.placements || [];
    this.draft = dr.mode === "move" ? G.move(base, dr.pid, dr.x + dx, dr.y + dy) : G.resize(base, dr.pid, dr.w + dx, dr.h + dy);
  }
  private holdStart(e: PointerEvent, c: G.Cell) {
    if (e.pointerType !== "touch" || (e.target as HTMLElement).closest("button")) return;
    const sx = e.clientX, sy = e.clientY;
    clearTimeout(this.hold);
    const cancel = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { clearTimeout(this.hold); off(); } };
    const off = () => { window.removeEventListener("pointermove", cancel); window.removeEventListener("pointerup", off); };
    window.addEventListener("pointermove", cancel); window.addEventListener("pointerup", off);
    this.hold = setTimeout(() => { off(); navigator.vibrate?.(15); this.startDrag(e, c, "move"); }, 420);
  }
  private onKey(e: KeyboardEvent, c: G.Cell) {
    const base = this.cells();
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (d[e.key]) {
      e.preventDefault();
      const [dx, dy] = d[e.key];
      this.saveLayout(e.shiftKey ? G.resize(base, c.pid, c.w + dx, c.h + dy) : G.move(base, c.pid, c.x + dx, c.y + dy));
    } else if (e.key === "Enter") { this.sheet = { key: placeKey(c), pid: c.pid }; }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); this.removePlacement(c.pid); }
  }
  private step() {
    const cols = G.colsFor(this.width);
    const cell = (this.width - GAP * (cols - 1)) / cols;
    return cell + GAP;
  }

  // ---------------------------------------------------------- views
  private header(d: any) {
    const list = boards().dashboards;
    const me = store.data?.user?.id;
    const r = d?.rights || {};
    return html`<div class="bar">
      ${list.length > 1 ? html`<div class="switch">${list.map((x: any) => html`<button class=${x.key === d?.key ? "on" : ""} @click=${() => { this.editing = false; navigate(`/dashboards/${x.key}`); }}>
          ${icon(x.icon || "dashboard", 17)} ${x.name}${x.owner !== me ? html`<span class="own">· ${x.owner_name}</span>` : nothing}</button>`)}</div>`
        : html`<div class="title">${icon(d?.icon || "dashboard", 26)}<h1>${d?.name || t("Dashboards")}</h1></div>`}
      ${d && r.edit ? (this.editing
        ? html`<button class="btn" @click=${() => (this.library = true)}>${icon("plus", 17)} Kachel</button>
            <button class="btn primary" @click=${() => { this.editing = false; this.draft = null; }}>${icon("check", 17)} Fertig</button>`
        : html`<button class="btn" @click=${() => (this.editing = true)}>${icon("edit", 17)} ${t("Bearbeiten")}</button>`) : nothing}
      ${d && (r.edit || r.reshare || r.owner) ? html`<button class="iconbtn" title="Einstellungen und Teilen" @click=${() => (this.settings = { ...d })}>${icon("settings")}</button>` : nothing}
      <button class="iconbtn" title="Neues Dashboard" @click=${() => (this.settings = { new: true, name: "", icon: "mdi:view-dashboard-outline", palette: "aurora" })}>${icon("plus")}</button>
    </div>`;
  }

  private grid(d: any) {
    const cols = G.colsFor(this.width || 1000);
    const cell = Math.max(20, ((this.width || 1000) - GAP * (cols - 1)) / cols);
    const base = this.cells();
    const lay = G.derive(base, cols);
    const rows = Math.max(G.height(lay) + (this.editing ? 2 : 0), this.editing ? 4 : 0);
    const hidden = new Map<string, any>(boards().hidden_tiles.map((h: any) => [h.key, h]));
    const wide = cols === 12;
    const order = [...base].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return html`<div class="gridwrap"><div class="board ${this.editing ? "edit" : ""}" style="height:${rows * (cell + GAP) - GAP}px;--cell:${cell}px;--step:${cell + GAP}px">
      ${lay.map((c) => {
        const k = placeKey(c);
        const tile = tileByKey(k);
        const idx = order.findIndex(o => o.pid === c.pid);
        return html`<div class="cell ${this.drag?.pid === c.pid ? "dragging" : ""}" tabindex=${this.editing ? 0 : -1}
            style="left:${c.x * (cell + GAP)}px;top:${c.y * (cell + GAP)}px;width:${c.w * cell + (c.w - 1) * GAP}px;height:${c.h * cell + (c.h - 1) * GAP}px"
            @pointerdown=${(e: PointerEvent) => this.editing && wide && this.holdStart(e, c)}
            @keydown=${(e: KeyboardEvent) => this.editing && wide && this.onKey(e, c)}
            @click=${(e: Event) => { if (this.editing && !(e.target as HTMLElement).closest("button") && tile) this.sheet = { key: k, pid: c.pid }; }}>
          <lm-tile .tile=${tile} .rec=${store.tileData.get(k)} .color=${tileColor(tile?.color, d.palette, hashIndex(k))}
            ?dark=${dark()} ?editing=${this.editing} .runState=${store.tileRuns[k] || ""} .hiddenInfo=${tile ? null : hidden.get(k) || { exists: false }}></lm-tile>
          ${this.editing ? html`<div class="handles">
            ${wide ? html`<button class="grip" title="Ziehen zum Verschieben (Pfeiltasten: verschieben, Umschalt+Pfeile: Größe)" @pointerdown=${(e: PointerEvent) => this.startDrag(e, c, "move")}>${icon("mdi:drag", 18)}</button>` : nothing}
            ${tile ? html`<button class="more" title="Kachel bearbeiten" @click=${() => (this.sheet = { key: k, pid: c.pid })}>${icon("edit", 16)}</button>` : nothing}
            <button class="del" title="Aus diesem Dashboard entfernen" @click=${() => this.removePlacement(c.pid)}>${icon("close", 17)}</button>
            ${wide ? html`<button class="rs" title="Ziehen, um die Größe zu ändern" @pointerdown=${(e: PointerEvent) => this.startDrag(e, c, "size")}>${icon("mdi:resize-bottom-right", 16)}</button>`
              : html`<div class="tools">
                <button title="nach vorn" ?disabled=${idx <= 0} @click=${() => this.saveLayout(G.shift(base, c.pid, -1))}>${icon("up", 16)}</button>
                <button title="nach hinten" ?disabled=${idx >= order.length - 1} @click=${() => this.saveLayout(G.shift(base, c.pid, 1))}>${icon("arrowDown", 16)}</button>
                <button title="kleiner" @click=${() => { const o = base.find(x => x.pid === c.pid)!; this.saveLayout(G.resize(base, c.pid, o.w - 2, o.h - 1)); }}>${icon("mdi:minus", 16)}</button>
                <button title="größer" @click=${() => { const o = base.find(x => x.pid === c.pid)!; this.saveLayout(G.resize(base, c.pid, o.w + 2, o.h + 1)); }}>${icon("plus", 16)}</button></div>`}
          </div>` : nothing}</div>`;
      })}</div></div>`;
  }

  private libraryView(d: any) {
    const me = store.data?.user?.id;
    const q = this.libQ.toLowerCase();
    const all = boards().tiles.filter((x: any) => !q || (x.name || "").toLowerCase().includes(q) || (x.description || "").toLowerCase().includes(q));
    const placedCount = (k: string) => boards().dashboards.reduce((n: number, x: any) => n + (x.placements || []).filter((p: any) => placeKey(p) === k).length, 0);
    const sec = (title: string, items: any[]) => items.length ? html`<h3>${title}</h3>${items.map(x => html`<div class="item" style="--acc:${tileColor(x.color, d.palette, hashIndex(x.key))}"
        @click=${async () => { try { await store.api.ws("dashboard/place", { key: d.key, tile: x.key }); this.library = false; await store.loadBoards(); } catch (e: any) { store.notify(e.message); } }}>
      <span class="ic">${icon(x.icon || KIND_INFO[x.kind]?.icon || "mdi:view-grid-outline", 18)}</span>
      <div class="grow"><div class="row" style="flex-wrap:wrap"><b class="ellipsis">${x.name}</b><span class="chip">${KIND_INFO[x.kind]?.label || x.kind}</span>
        <span class="chip">${icon(x.source?.type === "ha" ? "mdi:home-assistant" : "robot", 12)} ${x.source?.type === "ha" ? "Home Assistant" : `≈ ${x.task?.runs_per_day ?? "?"} Läufe/Tag`}</span>
        ${x.task?.paused === "unplaced" ? html`<span class="chip warn">nicht platziert – pausiert</span>` : nothing}
        ${placedCount(x.key) ? html`<span class="chip">${placedCount(x.key)}× platziert</span>` : nothing}</div>
        ${x.description ? html`<div class="hint clamp2">${x.description}</div>` : nothing}</div>
      ${icon("plus", 18)}</div>`)}` : nothing;
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && (this.library = false)}><div class="sheet small">
      <div class="sh"><h2>Kachel hinzufügen</h2><button class="iconbtn" @click=${() => (this.library = false)}>${icon("close")}</button></div>
      <div class="sb">
        <button class="btn primary" @click=${() => { this.library = false; this.sheet = { create: true }; }}>${icon("plus", 17)} Neue Kachel anlegen</button>
        ${boards().tiles.length ? html`<input placeholder="Kacheln durchsuchen …" .value=${this.libQ} @input=${(e: any) => (this.libQ = e.target.value)}>` : nothing}
        <div class="lib">
          ${sec("Meine Kacheln", all.filter((x: any) => x.owner === me))}
          ${sec("Mit mir geteilt", all.filter((x: any) => x.owner !== me && !x.share?.all))}
          ${sec("Für alle", all.filter((x: any) => x.owner !== me && x.share?.all))}
          ${!boards().tiles.length ? html`<div class="hint">Noch keine Kacheln. Lege die erste an – sie lässt sich danach auf beliebig vielen Dashboards wiederverwenden.</div>` : nothing}
        </div></div></div></div>`;
  }

  private settingsView() {
    const s = this.settings;
    const isNew = !!s.new;
    const r = s.rights || { owner: true, edit: true };
    const set = (k: string, v: any) => (this.settings = { ...this.settings, [k]: v, _dirty: true });
    const save = async () => {
      try {
        const body: any = { name: s.name, icon: s.icon, palette: s.palette, description: s.description || "" };
        if (!isNew) Object.assign(body, { id: s.id, owner: s.owner, version: s.version });
        const res = await store.api.ws("dashboard/save", { dashboard: body });
        await store.loadBoards();
        this.settings = null;
        if (isNew) { navigate(`/dashboards/${res.key}`); this.editing = true; }
      } catch (e: any) { store.notify(e.message); }
    };
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && (this.settings = null)}><div class="sheet small">
      <div class="sh"><h2>${isNew ? "Neues Dashboard" : `Dashboard „${s.name}“`}</h2><button class="iconbtn" @click=${() => (this.settings = null)}>${icon("close")}</button></div>
      <div class="sb">
        ${r.edit ? html`
        <label class="f"><span>${t("Name")}</span><input .value=${s.name || ""} @input=${(e: any) => set("name", e.target.value)} placeholder="z. B. Zuhause, Postfach, Projekt X"></label>
        <label class="f"><span>${t("Beschreibung")}</span><input .value=${s.description || ""} @input=${(e: any) => set("description", e.target.value)}></label>
        <div class="f"><span style="font-weight:550;font-size:13px">Icon</span><div class="swatches">${ICONS.map(ic => html`<button class="sw ${s.icon === ic ? "on" : ""}"
          style="background:var(--lm-panel);color:var(--lm-text);display:grid;place-items:center" title=${ic} @click=${() => set("icon", ic)}>${icon(ic, 17)}</button>`)}</div></div>
        <div class="f"><span style="font-weight:550;font-size:13px">Farbwelt</span><div class="swatches">${Object.entries(PALETTES).map(([k, cols]) => html`<button
          class="btn ${s.palette === k ? "primary" : ""}" @click=${() => set("palette", k)}><span style="display:inline-flex;gap:2px">${cols.slice(0, 4).map(c => html`<i style="width:10px;height:10px;border-radius:3px;background:${c};display:inline-block"></i>`)}</span> ${PALETTE_LABELS[k]}</button>`)}</div></div>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" ?disabled=${!s.name?.trim() || (!isNew && !s._dirty)} @click=${save}>${icon("check", 16)} ${isNew ? "Anlegen" : t("Speichern")}</button></div>` : nothing}
        ${!isNew ? html`<div class="card"><b>Teilen</b><div style="margin-top:8px"><lm-share kind="dashboard" .item=${s} @saved=${async () => { await store.loadBoards(); }}></lm-share></div>
          <div class="hint" style="margin-top:8px">Auf einem geteilten Dashboard sieht jede Person nur die Kacheln, die auch für sie freigegeben sind – die anderen erscheinen als Platzhalter.</div></div>` : nothing}
        ${!isNew && r.owner ? html`<div><button class="btn danger" @click=${async () => {
          if (!(await confirmDialog(`Dashboard „${s.name}“ löschen? Die Kacheln bleiben in der Bibliothek; Modell-Kacheln, die dann nirgends mehr liegen, pausieren.`))) return;
          try { await store.api.ws("dashboard/delete", { key: s.key }); this.settings = null; await store.loadBoards(); navigate("/dashboards", true); } catch (e: any) { store.notify(e.message); }
        }}>${icon("trash", 16)} Dashboard löschen</button></div>` : nothing}
      </div></div></div>`;
  }

  render() {
    const b = boards();
    const d = this.current;
    const simple = isSimple();
    let hint = false;
    try { hint = !localStorage.getItem(LS_EDIT_HINT); } catch { /* private window */ }
    return html`<div class="page">
      ${d ? this.header(d) : html`<div class="bar"><div class="title">${icon("dashboard", 26)}<h1>${t("Dashboards")}</h1></div></div>`}
      ${!b.dashboards.length ? html`
        ${simple ? explainer("dashboards" as any, true) : html`<div class="card" style="margin-bottom:16px"><b>Übersichten aus Kacheln</b>
          <div class="hint" style="margin-top:6px">Ein Dashboard sammelt farbige Kacheln: Kennzahlen, Diagramme, Listen, Warnungen. Kacheln holen ihre Daten am besten direkt aus Home Assistant (live, ohne KI-Aufrufe);
          was Home Assistant nicht weiß – etwa Aufgaben aus deinen Mails – erledigt ein geplanter Lauf. Jede Kachel lässt sich auf vielen Dashboards wiederverwenden und teilen.</div></div>`}
        <div class="empty">${icon("dashboard", 36)}<div>Noch kein Dashboard.</div>
          <button class="btn primary" @click=${() => (this.settings = { new: true, name: "", icon: "mdi:view-dashboard-outline", palette: "aurora" })}>${icon("plus", 17)} Erstes Dashboard anlegen</button></div>`
      : !d ? html`<div class="empty">Dieses Dashboard gibt es nicht (mehr) oder es ist nicht für dich freigegeben.
          <div><button class="btn" @click=${() => navigate("/dashboards", true)}>Zur Übersicht</button></div></div>`
      : html`
        ${this.editing && hint ? html`<div class="card hint" style="margin-bottom:12px;display:flex;gap:10px;align-items:center">${icon("info", 18)}
          <span class="grow">Ziehen am Griff verschiebt, die Ecke unten rechts ändert die Größe (auf dem Handy: lange drücken). Tippen öffnet die Kachel. Pfeiltasten verschieben, mit Umschalt ändern sie die Größe.</span>
          <button class="btn ghost" @click=${() => { try { localStorage.setItem(LS_EDIT_HINT, "1"); } catch { /* ignore */ } this.requestUpdate(); }}>OK</button></div>` : nothing}
        ${d.description && !this.editing ? html`<div class="hint" style="margin:-6px 0 12px">${d.description}</div>` : nothing}
        ${(d.placements || []).length || this.editing ? this.grid(d) : html`<div class="empty">Dieses Dashboard ist noch leer.
          ${d.rights?.edit ? html`<div><button class="btn primary" @click=${() => { this.editing = true; this.library = true; }}>${icon("plus", 17)} Kachel hinzufügen</button></div>` : nothing}</div>`}
        ${b.budget?.limit && b.tiles.some((x: any) => x.rights?.owner && x.source?.type === "model") ? html`<div class="budget" style="margin-top:14px">
          ${icon("robot", 14)} Kachel-Läufe heute: ${b.budget.used} von ${b.budget.limit}</div>` : nothing}`}
      ${this.library && d ? this.libraryView(d) : nothing}
      ${this.settings ? this.settingsView() : nothing}
      ${this.sheet ? html`<lm-tile-sheet .tileKey=${this.sheet.key || ""} .create=${!!this.sheet.create} .placeOn=${this.sheet.create ? d?.key || "" : ""}
          .pid=${this.sheet.pid || ""} .boardKey=${d?.key || ""} .palette=${d?.palette || "aurora"}
          @close=${() => { this.sheet = null; if (query("tile")) navigate(location.pathname.replace(/^\/llmitmir/, "") || "/dashboards", true); }}
          @remove=${(e: CustomEvent) => { this.sheet = null; this.removePlacement(e.detail); }}></lm-tile-sheet>` : nothing}
    </div>`;
  }
}

// ------------------------------------------------------------------ one tile: the sheet
@safeElement("lm-tile-sheet")
export class TileSheet extends StoreElement {
  @property() tileKey = "";
  @property({ type: Boolean }) create = false;
  @property() placeOn = "";
  @property() pid = "";
  @property() boardKey = "";
  @property() palette = "aurora";
  @state() private d: any = null;
  @state() private tab = "show";
  @state() private step = 0;            // create: 0 = source, 1 = type, 2 = form
  @state() private dirty = false;
  @state() private busy = false;
  @state() private entQ = "";
  @state() private cronPreview: any = null;
  static styles = [base, sheetCss, css`
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    .side { position: sticky; top: 0; display: grid; gap: 10px; }
    @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } .side { position: static; order: -1; } .pv { height: 200px; } }
    .ent { display: flex; gap: 6px; }
    .ent input { flex: 1; }
    .status { display: grid; gap: 4px; font-size: 13px; }
  `];

  willUpdate() {
    // also when the list arrives later (opened from a link before the dashboards were loaded)
    if (!this.d) this.init();
  }
  private init() {
    if (this.create) {
      this.d = { name: "", kind: "", description: "", icon: "", color: "", options: {}, source: null };
      this.step = 0;
      return;
    }
    const x = tileByKey(this.tileKey);
    if (!x) return;
    this.d = JSON.parse(JSON.stringify({ ...x, schedule: x.task?.schedule, notify: x.task?.notify, project_id: x.task?.project_id,
      model: x.task?.model, heavy: x.task?.heavy, enabled: x.task?.enabled }));
    this.step = 2;
    store.loadTileData([this.tileKey]).catch(() => {});
  }
  private get live(): any { return this.create ? null : tileByKey(this.tileKey); }
  private get r() { return this.create ? { owner: true, edit: true, reshare: true, view: true } : this.live?.rights || {}; }
  private set(k: string, v: any) { this.d = { ...this.d, [k]: v }; this.dirty = true; }
  private src(k: string, v: any) { this.d = { ...this.d, source: { ...this.d.source, [k]: v } }; this.dirty = true; }
  private opt(k: string, v: any) {
    const o = { ...(this.d.options || {}) };
    if (v === "" || v === null || v === undefined || (typeof v === "number" && !isFinite(v))) delete o[k]; else o[k] = v;
    this.set("options", o);
  }
  private close() { this.dispatchEvent(new CustomEvent("close")); }

  private async save() {
    this.busy = true;
    try {
      const body: any = { name: this.d.name, kind: this.d.kind, description: this.d.description, icon: this.d.icon, color: this.d.color,
        options: this.d.options, source: this.d.source };
      if (!this.create) Object.assign(body, { id: this.live.id, owner: this.live.owner, version: this.live.version });
      if (this.d.source?.type === "model") {
        body.schedule = this.d.schedule || { type: "cron", cron: schedulePresets(this.d.name || "x")[0][2] };
        if (this.r.owner) Object.assign(body, { notify: this.d.notify || "error", project_id: this.d.project_id || null, model: this.d.model || null, heavy: !!this.d.heavy });
      }
      const res = await store.api.ws("tile/save", { tile: body, place: this.create ? this.placeOn || null : null });
      this.dirty = false;
      await store.loadBoards();
      store.notify(this.create ? "Kachel angelegt" : t("Gespeichert"));
      if (this.create) { this.create = false; this.tileKey = res.key; this.d = null; this.init(); this.tab = "show"; }
      else this.d = { ...this.d, version: res.version };
    } catch (e: any) { store.notify(e.message); }
    finally { this.busy = false; }
  }

  // ---------------------------------------------------------- create: choose source and type
  private chooseSource() {
    return html`<div class="hint">Woher kommen die Daten der Kachel?</div><div class="choice">
      <button @click=${() => { this.d = { ...this.d, source: { type: "ha", mode: "state", entities: [], rules: [] } }; this.step = 1; }}>
        <span class="ic">${icon("mdi:home-assistant", 20)}</span><span><b>Aus Home Assistant</b><span class="hint">Sensoren, Verläufe, Statistiken, Kalender, To-do-Listen.
        Live, ohne KI-Aufrufe, ohne Kosten. <b>Erste Wahl</b>, wenn Home Assistant die Werte schon kennt.</span></span></button>
      <button @click=${() => { this.d = { ...this.d, source: { type: "model", run_if_changed: [] }, schedule: null, notify: "error" }; this.step = 1; }}>
        <span class="ic">${icon("robot", 20)}</span><span><b>Von einem geplanten Lauf</b><span class="hint">Die KI holt die Daten regelmäßig selbst – etwa Aufgaben aus Mails,
        Neuigkeiten von Webseiten oder Einschätzungen. Jeder Lauf zählt gegen dein Tagesbudget.</span></span></button></div>`;
  }
  private chooseKind() {
    const ha = this.d.source?.type === "ha";
    return html`<div class="hint">Was soll die Kachel zeigen?</div><div class="choice">${Object.entries(KIND_INFO).map(([k, info]) => {
      const modes = HA_KIND_MODES[k] || [];
      const ok = !ha || modes.length;
      return html`<button ?disabled=${!ok} @click=${() => {
        const src = ha ? { ...this.d.source, mode: modes.includes(this.d.source.mode) ? this.d.source.mode : modes[0] } : this.d.source;
        this.d = { ...this.d, kind: k, name: this.d.name || info.label, source: src }; this.step = 2; this.tab = ha ? "source" : "source"; this.dirty = true; }}>
        <span class="ic">${icon(info.icon, 20)}</span><span><b>${info.label}</b><span class="hint">${ok ? info.hint : "braucht einen geplanten Lauf"}</span></span></button>`;
    })}</div>`;
  }

  // ---------------------------------------------------------- tabs
  private showTab() {
    const x = this.d, r = this.r;
    const pal = PALETTES[this.palette] || PALETTES.aurora;
    const opts = x.options || {};
    const numIn = (k: string, label: string, step = "any") => html`<label class="f"><span>${label}</span><input type="number" step=${step} .value=${opts[k] ?? ""}
      @change=${(e: any) => this.opt(k, e.target.value === "" ? "" : Number(e.target.value))}></label>`;
    return html`
      <label class="f"><span>${t("Name")}</span><input ?disabled=${!r.edit} .value=${x.name || ""} @input=${(e: any) => this.set("name", e.target.value)}></label>
      <div class="two">
        <label class="f"><span>Typ</span><select ?disabled=${!r.edit} @change=${(e: any) => {
            const k = e.target.value;
            if (x.source?.type === "ha") { const modes = HA_KIND_MODES[k] || []; if (!modes.length) { store.notify("Dieser Typ braucht einen geplanten Lauf."); e.target.value = x.kind; return; }
              this.d = { ...this.d, kind: k, source: { ...x.source, mode: modes.includes(x.source.mode) ? x.source.mode : modes[0] } }; this.dirty = true; }
            else this.set("kind", k); }}>
          ${Object.entries(KIND_INFO).map(([k, i]) => html`<option value=${k} ?selected=${x.kind === k} ?disabled=${x.source?.type === "ha" && !(HA_KIND_MODES[k] || []).length}>${i.label}</option>`)}</select></label>
        <label class="f"><span>Icon</span><select ?disabled=${!r.edit} @change=${(e: any) => this.set("icon", e.target.value)}>
          <option value="">passend zum Typ</option>${ICONS.map(ic => html`<option value=${ic} ?selected=${x.icon === ic}>${ic.slice(4)}</option>`)}</select></label>
      </div>
      <div class="f"><span style="font-weight:550;font-size:13px">Farbe</span><div class="swatches">
        <button class="btn ${!x.color ? "primary" : ""}" ?disabled=${!r.edit} @click=${() => this.set("color", "")}>automatisch</button>
        ${pal.map(c => html`<button class="sw ${x.color === c ? "on" : ""}" style="background:${c}" title=${c} ?disabled=${!r.edit} @click=${() => this.set("color", c)}></button>`)}
        <input type="color" style="width:44px;height:32px;padding:2px" ?disabled=${!r.edit} .value=${/^#[0-9a-f]{6}$/i.test(x.color || "") ? x.color : "#4f9cf9"} @change=${(e: any) => this.set("color", e.target.value)}></div></div>
      ${["stat", "gauge"].includes(x.kind) ? html`<div class="two">${html`<label class="f"><span>Einheit (leer = aus der Quelle)</span><input .value=${opts.unit || ""} @input=${(e: any) => this.opt("unit", e.target.value)}></label>`}
        ${x.kind === "stat" ? numIn("decimals", "Nachkommastellen", "1") : html`<div class="two">${numIn("min", "Minimum")}${numIn("max", "Maximum")}</div>`}</div>` : nothing}
      ${["list", "alert"].includes(x.kind) ? html`<div class="two">${numIn("max_items", "Höchstens so viele Einträge", "1")}
        <label class="f"><span>Zusatzinfo</span><select @change=${(e: any) => this.opt("show_meta", e.target.value === "1")}><option value="1" ?selected=${opts.show_meta !== false}>anzeigen</option>
          <option value="0" ?selected=${opts.show_meta === false}>ausblenden</option></select></label></div>` : nothing}
      ${x.kind === "chart" && x.source?.type === "ha" ? html`<label class="f"><span>Darstellung</span><select @change=${(e: any) => this.opt("chart", e.target.value)}>
        ${[["", "automatisch"], ["line", "Linie"], ["area", "Fläche"], ["bar", "Balken"]].map(([k, l]) => html`<option value=${k} ?selected=${(opts.chart || "") === k}>${l}</option>`)}</select></label>` : nothing}
      ${x.source?.type !== "model" ? html`<label class="f"><span>${t("Beschreibung")} (Notiz für dich und die KI)</span><textarea rows="3" ?disabled=${!r.edit} .value=${x.description || ""}
        @input=${(e: any) => this.set("description", e.target.value)}></textarea></label>` : nothing}`;
  }

  private entityPicker(list: string[], onChange: (v: string[]) => void, filter: (eid: string) => boolean, single = false) {
    const states = store.api?.hass?.states || {};
    const q = this.entQ.toLowerCase();
    const all = Object.keys(states).filter(filter);
    const hits = q ? all.filter(e => e.includes(q) || String(friendly(states[e], e)).toLowerCase().includes(q)).slice(0, 12) : [];
    return html`<div class="chips">${list.map(e => html`<span class="chip">${friendly(states[e], e)} <code style="font-size:11px">${e}</code>
        <button title="entfernen" @click=${() => onChange(list.filter(x => x !== e))}>${icon("close", 13)}</button></span>`)}</div>
      ${!single || !list.length ? html`<div class="ent"><input placeholder="Entität suchen (Name oder sensor.…)" .value=${this.entQ} @input=${(e: any) => (this.entQ = e.target.value)}></div>
      ${hits.length ? html`<div class="chips">${hits.map(e => html`<button class="btn" style="min-height:30px;padding:4px 9px;font-size:12.5px"
        @click=${() => { onChange(single ? [e] : [...new Set([...list, e])]); this.entQ = ""; }}>${icon("plus", 13)} ${friendly(states[e], e)}</button>`)}</div>` : nothing}` : nothing}`;
  }

  private haSource() {
    const x = this.d, s = x.source || {}, r = this.r;
    const modes = HA_KIND_MODES[x.kind] || [];
    const admin = !!store.data?.user?.is_admin;
    const filt = s.mode === "calendar" ? (e: string) => e.startsWith("calendar.") : s.mode === "todo" ? (e: string) => e.startsWith("todo.")
      : s.mode === "statistics" ? (e: string) => e.startsWith("sensor.") : (e: string) => !e.startsWith("calendar.") && !e.startsWith("todo.");
    const rules = s.rules || [];
    return html`<fieldset ?disabled=${!r.edit} style="border:0;padding:0;margin:0;display:grid;gap:14px">
      <label class="f"><span>Quelle in Home Assistant</span><select @change=${(e: any) => this.src("mode", e.target.value)}>
        ${modes.map(m => html`<option value=${m} ?selected=${s.mode === m} ?disabled=${m === "template" && !admin && s.mode !== "template"}>${MODE_INFO[m].label}${m === "template" && !admin ? " (nur Admins)" : ""}</option>`)}</select>
        <span class="hint">${MODE_INFO[s.mode]?.hint || ""}</span></label>
      ${s.mode === "template" ? html`<label class="f"><span>Vorlage (Jinja)</span><textarea class="code" rows="5" ?disabled=${!admin} .value=${s.template || ""}
          placeholder="{{ states.light | selectattr('state','eq','on') | list | count }} Lichter an" @input=${(e: any) => this.src("template", e.target.value)}></textarea>
          <span class="hint">${admin ? "Home Assistant wertet die Vorlage aus und aktualisiert die Kachel, sobald sich etwas ändert. Für Kennzahl: eine Zahl; für Liste: eine Zeile je Eintrag." : "Vorlagen dürfen nur Home-Assistant-Admins ändern."}</span></label>`
      : html`<div class="f"><span style="font-weight:550;font-size:13px">${s.mode === "calendar" ? "Kalender" : s.mode === "todo" ? "To-do-Liste" : "Entitäten"}</span>
          ${this.entityPicker(s.entities || [], v => this.src("entities", v), filt, s.mode === "todo" || ["gauge", "progress"].includes(x.kind))}</div>`}
      ${s.mode === "state" && ["alert", "list", "table", "text"].includes(x.kind) ? html`<label class="f"><span>oder Muster (z. B. sensor.*_battery)</span>
        <input class="code" .value=${s.pattern || ""} @input=${(e: any) => this.src("pattern", e.target.value)}></label>` : nothing}
      ${["state", "history"].includes(s.mode) ? html`<label class="f"><span>Attribut statt Zustand (optional)</span><input .value=${s.attribute || ""} placeholder="z. B. temperature"
        @input=${(e: any) => this.src("attribute", e.target.value)}></label>` : nothing}
      ${s.mode === "history" ? html`<label class="f"><span>Zeitraum</span><select @change=${(e: any) => this.src("hours", Number(e.target.value))}>
        ${[[6, "6 Stunden"], [24, "24 Stunden"], [48, "2 Tage"], [168, "7 Tage"], [720, "30 Tage"]].map(([h, l]) => html`<option value=${h} ?selected=${(s.hours || 24) === h}>${l}</option>`)}</select></label>` : nothing}
      ${s.mode === "statistics" ? html`<div class="two">
        <label class="f"><span>je</span><select @change=${(e: any) => this.src("statistics", { ...(s.statistics || {}), period: e.target.value })}>
          ${[["hour", "Stunde"], ["day", "Tag"], ["week", "Woche"], ["month", "Monat"]].map(([k, l]) => html`<option value=${k} ?selected=${(s.statistics?.period || "day") === k}>${l}</option>`)}</select></label>
        <label class="f"><span>Wert</span><select @change=${(e: any) => this.src("statistics", { ...(s.statistics || {}), stat: e.target.value })}>
          ${[["mean", "Mittelwert"], ["max", "Höchstwert"], ["min", "Tiefstwert"], ["sum", "Summe (Zähler)"], ["change", "Veränderung (z. B. Verbrauch)"]].map(([k, l]) => html`<option value=${k} ?selected=${(s.statistics?.stat || "mean") === k}>${l}</option>`)}</select></label>
        <label class="f"><span>Anzahl Zeiträume</span><input type="number" min="2" max="200" .value=${String(s.statistics?.count || 14)}
          @change=${(e: any) => this.src("statistics", { ...(s.statistics || {}), count: Number(e.target.value) })}></label></div>` : nothing}
      ${s.mode === "calendar" ? html`<label class="f"><span>Tage im Voraus</span><input type="number" min="1" max="31" .value=${String(s.days || 7)} @change=${(e: any) => this.src("days", Number(e.target.value))}></label>` : nothing}
      ${["state", "history"].includes(s.mode) && ["stat", "gauge", "alert", "list", "progress"].includes(x.kind) ? html`<div class="f"><span style="font-weight:550;font-size:13px">Regeln für den Status</span>
        <span class="hint">Zum Beispiel: unter 20 → Warnung. Bei „Warnungen“ erscheinen nur die Entitäten, auf die eine Regel passt.</span>
        ${rules.map((ru: any, i: number) => html`<div class="rule">
          <select @change=${(e: any) => this.src("rules", rules.map((q: any, j: number) => (j === i ? { ...q, if: e.target.value } : q)))}>
            ${[["below", "kleiner als"], ["above", "größer als"], ["equals", "gleich"], ["not", "ungleich"]].map(([k, l]) => html`<option value=${k} ?selected=${ru.if === k}>${l}</option>`)}</select>
          <input .value=${String(ru.value ?? "")} @input=${(e: any) => this.src("rules", rules.map((q: any, j: number) => (j === i ? { ...q, value: isFinite(Number(e.target.value)) && e.target.value !== "" ? Number(e.target.value) : e.target.value } : q)))}>
          <select @change=${(e: any) => this.src("rules", rules.map((q: any, j: number) => (j === i ? { ...q, status: e.target.value } : q)))}>
            ${[["warn", "→ Warnung"], ["error", "→ Fehler"], ["ok", "→ in Ordnung"]].map(([k, l]) => html`<option value=${k} ?selected=${ru.status === k}>${l}</option>`)}</select>
          <button class="iconbtn" @click=${() => this.src("rules", rules.filter((_: any, j: number) => j !== i))}>${icon("trash", 16)}</button></div>`)}
        <div><button class="btn" @click=${() => this.src("rules", [...rules, { if: "below", value: 20, status: "warn" }])}>${icon("plus", 15)} Regel</button></div></div>` : nothing}
    </fieldset>`;
  }

  private modelSource() {
    const x = this.d, r = this.r, live = this.live;
    const task = live?.task;
    const cron0 = x.schedule?.cron || "";
    const presets = schedulePresets(live?.id || x.name || "x", cron0);
    const cron = cron0 || (x.schedule ? "" : presets[0][2]);
    const preset = presets.find(p => p[2] === cron)?.[0] || (x.schedule && !x.schedule.cron ? "other" : cron ? "custom" : "std");
    const perDay = x.schedule && !x.schedule.cron ? task?.runs_per_day : runsPerDay(cron);
    const b = boards().budget || {};
    const d = store.data;
    const runs = (task?.runs || []).map((id: string) => (d.chats || []).find((c: any) => c.id === id)).filter(Boolean);
    const watch: string[] = x.source?.run_if_changed || [];
    return html`
      <label class="f"><span>Beschreibung = Auftrag für jeden Lauf</span><textarea rows="7" ?disabled=${!r.edit} .value=${x.description || ""}
        placeholder="Was zeigt die Kachel, woher kommen die Daten, was ist ein Warnfall? Zum Beispiel: Lies die Mails der letzten 24 Stunden im Zugang „Postfach“, erkenne Aufgaben und liste die offenen auf. Überfällige sind „blockiert“."
        @input=${(e: any) => this.set("description", e.target.value)}></textarea>
        <span class="hint">Das Format der Daten kennt die KI selbst – beschreibe nur, was hinein soll.</span></label>
      <div class="two">
        <label class="f"><span>Wie oft?</span><select ?disabled=${!r.edit} @change=${(e: any) => {
            const v = e.target.value; const p = presets.find(q => q[0] === v);
            if (p) this.set("schedule", { type: "cron", cron: p[2] }); else this.set("schedule", { type: "cron", cron: cron || presets[0][2] }); }}>
          ${presets.map(([k, l]) => html`<option value=${k} ?selected=${preset === k}>${l}</option>`)}
          <option value="custom" ?selected=${preset === "custom" || preset === "other"}>Eigener Zeitplan (Cron)</option></select></label>
        ${preset === "custom" || preset === "other" ? html`<label class="f"><span>Cron (Minute Stunde Tag Monat Wochentag)</span><input class="code" ?disabled=${!r.edit} .value=${cron}
          @change=${async (e: any) => { const c = e.target.value.trim(); this.set("schedule", { type: "cron", cron: c });
            try { this.cronPreview = await store.api.ws("task/preview", { schedule: { type: "cron", cron: c } }); } catch (er: any) { this.cronPreview = { error: er.message }; } }}>
          ${this.cronPreview ? html`<span class="hint">${this.cronPreview.error || this.cronPreview.text}</span>` : nothing}</label>` : html`<div></div>`}
      </div>
      <div class="hint">${icon("robot", 13)} ≈ <b>${isFinite(perDay) ? perDay : "?"}</b> Läufe pro Tag${watch.length ? " (weniger: nur bei Änderung)" : ""} · höchstens alle 15 Minuten
        ${b.limit ? html` · dein Tagesbudget: ${b.used} von ${b.limit} verbraucht` : nothing}</div>
      <div class="f"><span style="font-weight:550;font-size:13px">Nur laufen, wenn sich etwas geändert hat (optional)</span>
        <span class="hint">Wähle Entitäten, z. B. den Zähler ungelesener Mails. Hat sich keine davon seit dem letzten Lauf geändert, entfällt der Lauf – das spart Budget.</span>
        ${this.entityPicker(watch, v => this.src("run_if_changed", v.slice(0, 5)), () => true)}</div>
      ${r.owner ? html`<div class="two">
        <label class="f"><span>${isSimple() ? "Nachricht aufs Handy" : t("Benachrichtigen")}</span><select @change=${(e: any) => this.set("notify", e.target.value)}>
          ${[["error", "nur bei Fehlern (Standard)"], ["on_change", "wenn sich die Überschrift ändert, oder bei Fehlern"], ["always", "nach jedem Lauf"], ["never", "nie"]].map(([k, l]) =>
            html`<option value=${k} ?selected=${(x.notify || "error") === k}>${l}</option>`)}</select></label>
        ${isSimple() ? html`<div></div>` : html`<label class="f"><span>${t("Projekte")} (Zugänge und Skills)</span><select @change=${(e: any) => this.set("project_id", e.target.value || null)}>
          <option value="">Ohne Projekt</option>${(d.projects || []).map((p: any) => html`<option value=${p.id} ?selected=${x.project_id === p.id}>${p.name}</option>`)}</select></label>`}
      </div>
      ${isSimple() ? nothing : html`<div class="two"><label class="f"><span>${t("Modell")}</span><select @change=${(e: any) => this.set("model", e.target.value || null)}>
          <option value="">automatisch</option>${(d.models || []).filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${x.model === m.id}>${m.name}</option>`)}</select></label>
        <label class="row" style="gap:8px;margin-top:22px"><input type="checkbox" style="width:auto" .checked=${!!x.heavy} @change=${(e: any) => this.set("heavy", e.target.checked)}>
          <span>Aufwändig – bis zu 60 statt 30 Schritte je Lauf</span></label></div>`}` : html`<div class="hint">Projekt, Modell und Benachrichtigungen legt ${live?.owner_name || "die Eigentümerin oder der Eigentümer"} fest – die Läufe nutzen deren Zugänge.</div>`}
      ${task ? html`<div class="card status">
        <div class="row"><b class="grow">Läufe</b>
          ${r.edit ? html`<button class="btn" ?disabled=${!!store.tileRuns[this.tileKey]} @click=${async () => {
            try { const res = await store.api.ws("tile/run", { key: this.tileKey }); store.notify(res.position > 0 ? `Wartet (Platz ${res.position})` : "Läuft bereits oder wartet schon"); } catch (e: any) { store.notify(e.message); } }}>
            ${icon("retry", 15)} Jetzt aktualisieren</button>` : nothing}</div>
        ${task.paused === "unplaced" ? html`<div class="hint" style="color:var(--lm-warn)">Pausiert, weil die Kachel auf keinem Dashboard liegt.</div>` : nothing}
        <div>Letzter Lauf: ${task.last_run ? html`${fmtTime(task.last_run.finished || task.last_run.started)} – ${task.last_run.status === "done" ? "erfolgreich" : task.last_run.status === "running" ? "läuft" : "fehlgeschlagen"}` : "noch keiner"}</div>
        ${task.last_run?.error ? html`<div class="hint" style="color:var(--lm-err)">${task.last_run.error}</div>` : nothing}
        <div>Nächster Lauf: ${task.enabled && task.next_run ? fmtTime(task.next_run) : "–"}</div>
        ${r.owner && runs.length ? html`<div class="list" style="margin-top:6px">${runs.slice(0, 5).map((c: any) => html`<div class="item" style="padding:7px 10px" @click=${() => navigate(`/chat/${c.id}`)}>
          ${icon(c.status === "error" ? "alert" : "check", 15)}<span class="grow ellipsis" style="font-size:13px">${c.title}</span></div>`)}</div>` : nothing}</div>` : nothing}`;
  }

  private dataTab() {
    const rec = store.tileData.get(this.tileKey);
    const x = this.d;
    if (x.source?.type === "ha" && x.source.mode !== "template") {
      return html`<div class="hint">Diese Kachel liest ihre Daten live aus Home Assistant, im Browser von allen, die sie ansehen – gespeichert wird nichts.
        Die Vorschau rechts zeigt den aktuellen Stand.</div>`;
    }
    return html`${rec?.updated ? html`<div class="hint">Zuletzt geschrieben ${fmtTime(rec.updated)}${rec.by === "run" ? " von einem Lauf" : rec.by === "template" ? " von der Vorlage" : rec.by === "chat" ? " aus einem Chat" : ""}.</div>`
        : html`<div class="hint">Noch keine Daten.</div>`}
      ${rec?.error ? html`<div class="hint" style="color:var(--lm-err)">${rec.error}</div>` : nothing}
      ${rec ? html`<pre class="json">${JSON.stringify({ status: rec.status, headline: rec.headline, subline: rec.subline, data: rec.data }, null, 2)}</pre>` : nothing}
      ${rec && this.r.edit ? html`<div><button class="btn danger" @click=${async () => {
        if (!(await confirmDialog("Die gespeicherten Daten und den Verlauf dieser Kachel löschen?"))) return;
        try { await store.api.ws("tile/clear", { key: this.tileKey }); } catch (e: any) { store.notify(e.message); } }}>${icon("trash", 15)} Daten löschen</button></div>` : nothing}`;
  }

  private shareTab() {
    const live = this.live;
    if (!live) return html`<div class="hint">Teilen geht nach dem ersten Speichern.</div>`;
    return html`${live.source?.type === "model" ? html`<div class="card"><label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${!!live.notify_me}
        @change=${async (e: any) => { try { await store.api.ws("tile/notify", { key: live.key, on: e.target.checked }); await store.loadBoards(); } catch (er: any) { store.notify(er.message); } }}>
        <b>Mich benachrichtigen</b></label><div class="hint" style="margin-top:4px">${live.rights?.owner ? "Du bekommst Nachrichten nach der Einstellung unter „Quelle“ – dieser Schalter gilt für Personen, mit denen die Kachel geteilt ist." : "Du bekommst eine Nachricht auf dein Gerät, wenn ein Lauf dieser Kachel etwas meldet."}</div></div>` : nothing}
      <lm-share kind="tile" .item=${live} @saved=${async () => { await store.loadBoards(); }}></lm-share>`;
  }

  render() {
    const x = this.d;
    if (!x) return html`<div class="back" @click=${() => this.close()}><div class="sheet small"><div class="sb">Kachel nicht gefunden oder nicht für dich freigegeben.</div></div></div>`;
    const r = this.r, live = this.live;
    const title = this.create ? (this.step < 2 ? "Neue Kachel" : `Neue Kachel: ${KIND_INFO[x.kind]?.label || ""}`) : x.name || "Kachel";
    const color = tileColor(x.color, this.palette, hashIndex(this.tileKey || x.name || "x"));
    const draftTile = { ...(live || {}), ...x, key: this.tileKey || "neu" };
    const body = this.step === 0 ? this.chooseSource() : this.step === 1 ? this.chooseKind() : html`
      <div class="tabs">${[["show", "Anzeige"], ["source", "Quelle"], ["data", "Daten"], ["share", "Teilen"]].map(([k, l]) =>
        html`<button class=${this.tab === k ? "on" : ""} @click=${() => (this.tab = k)}>${l}</button>`)}</div>
      <div class="layout"><div style="display:grid;gap:14px;min-width:0">
        ${!r.edit && this.tab !== "share" ? html`<div class="hint">${icon("lock", 13)} Diese Kachel gehört ${live?.owner_name || "jemand anderem"} – du darfst sie nur ansehen.</div>` : nothing}
        ${live?.changed_by_name && live.changed_by_name !== live.owner_name && r.owner ? html`<div class="hint">Zuletzt geändert von ${live.changed_by_name}.</div>` : nothing}
        ${this.tab === "show" ? this.showTab() : this.tab === "source" ? (x.source?.type === "ha" ? this.haSource() : this.modelSource())
          : this.tab === "data" ? this.dataTab() : this.shareTab()}</div>
        <div class="side"><div class="pv"><lm-tile .tile=${draftTile} .rec=${store.tileData.get(this.tileKey)} .color=${color} ?dark=${dark()}
          .runState=${store.tileRuns[this.tileKey] || ""}></lm-tile></div>
          <div class="hint">${x.source?.type === "ha" ? html`${icon("mdi:home-assistant", 13)} Live aus Home Assistant – keine KI-Aufrufe.` : html`${icon("robot", 13)} Daten von einem geplanten Lauf.`}</div>
          ${x.source?.type === "model" && !this.create && x.description ? html`<details><summary class="hint">Beschreibung</summary><div class="md hint">${md(x.description)}</div></details>` : nothing}</div></div>`;
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && this.close()}><div class="sheet">
      <div class="sh">${this.step > 0 && this.create ? html`<button class="iconbtn" @click=${() => (this.step = this.step - 1)}>${icon("left")}</button>` : nothing}
        <h2>${title}</h2><button class="iconbtn" @click=${() => this.close()}>${icon("close")}</button></div>
      <div class="sb">${body}</div>
      ${this.step === 2 ? html`<div class="sf">
        ${!this.create && this.pid && this.boardKey ? html`<button class="btn" @click=${() => this.dispatchEvent(new CustomEvent("remove", { detail: this.pid }))}>${icon("close", 15)} Aus diesem Dashboard entfernen</button>` : nothing}
        ${!this.create && r.owner ? html`<button class="btn danger" @click=${async () => {
          if (!(await confirmDialog(`Kachel „${x.name}“ überall löschen – auf allen Dashboards, mit Daten${x.source?.type === "model" ? ", Aufgabe und Läufen" : ""}?`))) return;
          try { await store.api.ws("tile/delete", { key: this.tileKey }); await store.loadBoards(); this.close(); } catch (e: any) { store.notify(e.message); } }}>${icon("trash", 15)} Überall löschen</button>` : nothing}
        <span class="grow"></span>
        <button class="btn" @click=${() => this.close()}>${t("Schließen")}</button>
        ${r.edit ? html`<button class="btn primary" ?disabled=${this.busy || (!this.dirty && !this.create)} @click=${this.save}>${icon("check", 16)} ${this.create ? "Anlegen" : t("Speichern")}</button>` : nothing}
      </div>` : nothing}</div></div>`;
  }
}
