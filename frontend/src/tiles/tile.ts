// The common frame of every tile: header (icon, title, status, „aktualisiert“), content by type, footer for errors
// and notices. A tile with a Home-Assistant source computes its record itself (tiles/ha.ts); every other tile shows
// the record it is given (written by a tile run or a template).
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { base, icon, safeElement } from "../ui";
import { hassBus } from "../api";
import { HaFeed } from "./ha";
import { KIND_INFO, renderKind } from "./kinds";
import { ago, fmtNumber } from "./svg";
import "./scene";

const STATUS_INFO: Record<string, [string, string, string]> = {
  ok: ["check", "var(--lm-ok)", "in Ordnung"], warn: ["alert", "var(--lm-warn)", "Warnung"],
  error: ["mdi:alert-octagon-outline", "var(--lm-err)", "Fehler"], empty: ["mdi:minus-circle-outline", "var(--lm-faint)", "leer"],
};
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

@safeElement("lm-count")
export class Count extends LitElement {
  @property({ type: Number }) value = 0;
  @property({ type: Number }) decimals?: number;
  @state() private shown = NaN;
  private raf = 0;
  static styles = css`:host { font-weight: 700; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }`;
  updated(ch: Map<string, any>) {
    if (!ch.has("value")) return;
    const to = Number(this.value), from = isFinite(this.shown) ? this.shown : (reduced() ? to : 0);
    cancelAnimationFrame(this.raf);
    if (reduced() || !isFinite(to) || from === to) { this.shown = to; return; }
    const t0 = performance.now(), dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      this.shown = from + (to - from) * e;
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  disconnectedCallback() { super.disconnectedCallback(); cancelAnimationFrame(this.raf); }
  render() {
    const done = this.shown === Number(this.value);
    return html`${fmtNumber(this.shown, done ? this.decimals : Math.min(this.decimals ?? 0, 1))}`;
  }
}

@safeElement("lm-tile")
export class TileEl extends LitElement {
  @property({ attribute: false }) tile: any = null;
  @property({ attribute: false }) rec: any = null;
  @property() color = "#4f9cf9";
  @property({ type: Boolean, reflect: true }) dark = false;
  @property({ type: Boolean, reflect: true }) editing = false;
  @property() runState = "";            // queued | running | ""
  @property({ attribute: false }) hiddenInfo: any = null;   // placeholder: tile not visible to this person
  @state() private w = 0;
  @state() private h = 0;
  @state() private tip: { x: number; y: number; text: string } | null = null;
  @state() private sort: { key: string; dir: "asc" | "desc" } | null = null;
  private feed?: HaFeed;
  private feedKey = "";
  private ro?: ResizeObserver;
  private raf = 0;
  private lastStates: any[] = [];
  private onHass = () => {
    if (!this.feed || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      // redraw only when one of the tile's entities changed (hass sends every state change of the house)
      const st = this.feed?.hass?.states || {};
      const ids = this.tile?.source?.entities || [];
      const now = this.tile?.source?.pattern ? [Object.keys(st).length] : ids.map((e: string) => st[e]);
      if (now.length !== this.lastStates.length || now.some((s: any, i: number) => s !== this.lastStates[i])) {
        this.lastStates = now;
        this.requestUpdate();
      }
    });
  };

  static styles = [base, css`
    :host { display: block; height: 100%; --tile-bg: var(--lm-panel); container-type: size; }
    .t { position: relative; height: 100%; display: flex; flex-direction: column; border-radius: 18px; overflow: hidden;
      background: linear-gradient(135deg, color-mix(in srgb, var(--acc) 17%, var(--lm-panel)), color-mix(in srgb, var(--acc) 5%, var(--lm-panel)));
      border: 1px solid color-mix(in srgb, var(--acc) 26%, var(--lm-line)); box-shadow: var(--lm-shadow);
      animation: tin .35s ease both; }
    .t::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--acc); }
    @keyframes tin { from { opacity: 0; transform: translateY(6px) scale(.985); } }
    @media (prefers-reduced-motion: reduce) { .t { animation: none; } }
    .hd { display: flex; align-items: center; gap: 8px; padding: 11px 12px 4px 13px; min-width: 0; }
    .hd .ic { color: var(--acc); display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px;
      background: color-mix(in srgb, var(--acc) 16%, transparent); flex: none; }
    .hd .ti { font-weight: 620; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hd .sub { font-size: 11.5px; color: var(--lm-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hd .tt { display: grid; min-width: 0; flex: 1; }
    .dot { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--lm-muted); flex: none; }
    .dot .i { color: var(--sc); }
    .src { color: var(--lm-faint); flex: none; display: inline-grid; }
    .head2 { padding: 0 13px 2px; font-size: 13px; color: var(--lm-text); font-weight: 560; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bd { flex: 1; min-height: 0; position: relative; padding: 4px 13px 10px; overflow: hidden; }
    .bd.scroll { overflow-y: auto; }
    .ft { padding: 5px 13px 8px; font-size: 11.5px; color: var(--lm-muted); display: flex; gap: 6px; align-items: flex-start; line-height: 1.35; }
    .ft.err { color: var(--lm-err); } .ft.note { color: var(--lm-warn); }
    .ft .i { flex: none; margin-top: 1px; }
    .run { position: absolute; top: 10px; right: 10px; }
    /* edit mode: content does not react, the frame shows it can be moved */
    :host([editing]) .bd { pointer-events: none; }
    :host([editing]) .t { border-style: dashed; }
    .ph { height: 100%; display: grid; place-items: center; text-align: center; color: var(--lm-muted); font-size: 13px; padding: 12px;
      border: 1px dashed var(--lm-line); border-radius: 18px; background: var(--lm-panel); }
    /* --- types --- */
    .calm { height: 100%; display: flex; gap: 8px; align-items: center; justify-content: center; color: var(--lm-ok); font-size: 13.5px; }
    .calm.muted { color: var(--lm-faint); }
    .stat { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 4px; position: relative; }
    .stat .sv { display: flex; align-items: baseline; gap: 6px; color: var(--lm-text); z-index: 1; }
    .stat .unit { font-size: 15px; color: var(--lm-muted); font-weight: 560; }
    .stat .delta { display: inline-flex; gap: 4px; align-items: center; font-size: 12.5px; color: var(--lm-muted); z-index: 1; }
    .stat .delta .i { color: var(--acc); }
    .stat .spark { position: absolute; left: -13px; right: -13px; bottom: -10px; width: calc(100% + 26px); }
    svg text { fill: var(--lm-muted); font-family: var(--lm-sans); }
    svg .ax { font-size: 10.5px; fill: var(--lm-muted); }
    svg .grid { stroke: var(--lm-line); stroke-width: 1; opacity: .7; }
    svg .hit { fill: transparent; cursor: crosshair; }
    svg .hit-mark { cursor: pointer; }
    svg .dv { font-size: 18px; font-weight: 700; fill: var(--lm-text); }
    svg .gv { font-weight: 700; fill: var(--lm-text); }
    svg .mv { font-size: 13px; font-weight: 700; fill: #fff; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--lm-muted); height: 20px; overflow: hidden; align-items: center; }
    .legend.col { flex-direction: column; flex-wrap: nowrap; height: auto; align-items: flex-start; gap: 4px; }
    .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
    .legend b { color: var(--lm-text); font-weight: 600; margin-left: 4px; }
    .donut { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: center; }
    .donut.side { flex-direction: row; justify-content: center; gap: 14px; }
    .gauge { height: 100%; display: grid; place-items: center; }
    .prog { display: grid; gap: 8px; align-content: center; height: 100%; }
    .prog .pt b { font-size: 24px; letter-spacing: -.02em; }
    .prog .bar { height: 10px; border-radius: 999px; background: var(--lm-line); overflow: hidden; }
    .prog .bar span { display: block; height: 100%; border-radius: 999px; transition: width .6s ease; }
    .prog .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px; color: var(--lm-muted); }
    .prog .steps li.done { color: var(--lm-text); } .prog .steps li.done .i { color: var(--lm-ok); }
    .prog .ms { display: flex; flex-wrap: wrap; gap: 4px; }
    .alerts { display: grid; gap: 6px; }
    .al { display: flex; gap: 8px; padding: 8px 9px; border-radius: 11px; background: color-mix(in srgb, var(--sev) 10%, var(--lm-panel));
      border-left: 3px solid var(--sev); }
    .al > .i { color: var(--sev); margin-top: 1px; }
    .al .at { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; font-size: 13px; }
    .al .sevl { font-size: 10.5px; color: var(--lm-muted); text-transform: uppercase; letter-spacing: .04em; flex: none; }
    .al .ad { font-size: 12.5px; color: var(--lm-muted); margin-top: 2px; overflow-wrap: anywhere; }
    .al .am { display: flex; gap: 8px; font-size: 11.5px; color: var(--lm-faint); margin-top: 3px; flex-wrap: wrap; }
    .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .items li { display: flex; gap: 8px; align-items: flex-start; padding: 6px 2px; border-bottom: 1px solid color-mix(in srgb, var(--lm-line) 70%, transparent); font-size: 13px; }
    .items li:last-child { border-bottom: 0; }
    .items li.done .it { color: var(--lm-muted); text-decoration: line-through; }
    .items .im { font-size: 11.5px; color: var(--lm-muted); display: flex; gap: 8px; flex-wrap: wrap; }
    .items .chip { font-size: 10.5px; padding: 1px 7px; }
    .chip.st-erledigt { color: var(--lm-ok); } .chip.st-blockiert { color: var(--lm-err); }
    .lnk { color: var(--lm-accent); text-decoration: none; display: inline-flex; gap: 3px; align-items: center; }
    .tw { height: 100%; overflow: auto; margin: 0 -4px; }
    table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
    th { position: sticky; top: 0; background: var(--lm-panel); text-align: left; font-weight: 600; padding: 6px 6px; cursor: pointer;
      white-space: nowrap; border-bottom: 1px solid var(--lm-line); color: var(--lm-muted); }
    td { padding: 5px 6px; border-bottom: 1px solid color-mix(in srgb, var(--lm-line) 60%, transparent); vertical-align: top; overflow-wrap: anywhere; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .txt { font-size: 13.5px; line-height: 1.5; }
    .tip { position: absolute; z-index: 5; pointer-events: none; background: var(--lm-raise); color: var(--lm-text); border: 1px solid var(--lm-line);
      border-radius: 9px; padding: 6px 8px; font-size: 12px; white-space: pre; box-shadow: 0 6px 20px rgba(0,0,0,.18); transform: translate(-50%, calc(-100% - 10px)); }
    .xh { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--lm-muted); opacity: .45; pointer-events: none; }
  `];

  connectedCallback() {
    super.connectedCallback();
    hassBus.addEventListener("hass", this.onHass);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    hassBus.removeEventListener("hass", this.onHass);
    this.ro?.disconnect(); this.ro = undefined;
    this.feed?.stop(); this.feed = undefined; this.feedKey = "";
    cancelAnimationFrame(this.raf); this.raf = 0;
  }
  firstUpdated() {
    const bd = this.renderRoot.querySelector(".t") as HTMLElement | null;
    if (!bd) return;
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(bd);
    this.measure();
  }
  private measure() {
    const bd = this.renderRoot.querySelector(".bd") as HTMLElement | null;
    if (!bd) return;
    const cs = getComputedStyle(bd);
    const w = Math.max(0, bd.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const h = Math.max(0, bd.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    if (Math.abs(w - this.w) > 1 || Math.abs(h - this.h) > 1) { this.w = w; this.h = h; }
  }
  willUpdate() {
    // a HA tile keeps one feed for its current source; a changed source (editing) starts a new one
    const src = this.tile?.source;
    const key = src?.type === "ha" && src.mode !== "template" ? JSON.stringify([this.tile.kind, src]) : "";
    if (key !== this.feedKey) {
      this.feed?.stop(); this.feed = undefined; this.feedKey = key;
      if (key) { this.feed = new HaFeed(this.tile, () => this.requestUpdate()); this.feed.start(); }
    }
    if (this.feed) this.feed.tile = this.tile;
  }
  updated() { if (!this.w) this.measure(); }

  private record(): any {
    return this.feed ? this.feed.record() : this.rec;
  }

  private onMove(e: PointerEvent) {
    const t = (e.composedPath() as HTMLElement[]).find(el => (el as any)?.dataset?.tip) as HTMLElement | undefined;
    if (!t) { if (this.tip) this.tip = null; return; }
    const box = (this.renderRoot.querySelector(".bd") as HTMLElement).getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const dx = (t as any).dataset.x !== undefined ? Number((t as any).dataset.x) + 13 : r.left - box.left + r.width / 2;
    this.tip = { x: Math.max(60, Math.min(box.width - 60, dx)), y: Math.max(40, e.clientY - box.top), text: (t as any).dataset.tip };
  }

  private stale(rec: any): boolean {
    const task = this.tile?.task;
    if (this.tile?.source?.type !== "model" || !task?.enabled) return false;
    const now = Date.now() / 1000;
    const overdue = task.next_run && now - task.next_run > 30 * 60 && this.runState !== "running";
    return !!(overdue || (rec?.updated && now - rec.updated > 2 * 86400));
  }

  render() {
    if (this.hiddenInfo) {
      return html`<div class="ph">${this.hiddenInfo.exists ? html`${icon("lock", 22)}<div>Kachel von ${this.hiddenInfo.owner_name || "jemand anderem"}<br><span class="hint">nicht für dich freigegeben</span></div>`
        : html`${icon("mdi:delete-outline", 22)}<div>Kachel gelöscht</div>`}</div>`;
    }
    const t = this.tile || {};
    const rec = this.record() || null;
    const status = rec?.status || "empty";
    const [sIc, sCol, sLabel] = STATUS_INFO[status] || STATUS_INFO.empty;
    const stale = this.stale(rec);
    const info = KIND_INFO[t.kind] || KIND_INFO.text;
    const scroll = ["alert", "list", "text", "progress"].includes(t.kind);
    const src = t.source || {};
    const showHead = rec?.headline && !["stat", "gauge"].includes(t.kind) || (rec?.headline && t.kind === "stat" && rec.headline !== t.name);
    return html`<div class="t" style="--acc:${this.color}">
      <div class="hd"><span class="ic">${icon(t.icon || info.icon, 17)}</span>
        <div class="tt"><span class="ti">${t.name || info.label}</span>
          <span class="sub">${rec?.updated ? (stale ? "veraltet · " : "") + ago(rec.updated) : src.type === "ha" ? "live aus Home Assistant" : "noch nicht gelaufen"}${rec?.subline ? " · " + rec.subline : ""}</span></div>
        ${this.runState ? html`<lm-spark size="18" title=${this.runState === "running" ? "wird aktualisiert" : "wartet auf den Lauf"}></lm-spark>` : nothing}
        <span class="src" title=${src.type === "ha" ? "Daten direkt aus Home Assistant" : "Daten von einem geplanten Lauf"}>${icon(src.type === "ha" ? "mdi:home-assistant" : "robot", 14)}</span>
        ${rec?.data !== null && rec?.data !== undefined ? html`<span class="dot" style="--sc:${stale ? "var(--lm-faint)" : sCol}" title=${stale ? "veraltet" : sLabel}>${icon(stale ? "clock" : sIc, 14)}<span class="sr">${stale ? "veraltet" : status === "ok" ? "" : sLabel}</span></span>` : nothing}</div>
      ${showHead ? html`<div class="head2">${rec.headline}</div>` : nothing}
      <div class="bd ${scroll ? "scroll" : ""}" @pointermove=${this.onMove} @pointerleave=${() => (this.tip = null)}>
        ${this.w ? renderKind(t.kind, rec, { w: this.w, h: this.h, color: this.color, dark: this.dark, options: t.options || {}, sort: this.sort,
          setSort: (k: string) => { this.sort = { key: k, dir: this.sort?.key === k && this.sort.dir === "desc" ? "asc" : "desc" }; } }) : nothing}
        ${this.tip ? html`${t.kind === "chart" ? html`<div class="xh" style="left:${this.tip.x}px"></div>` : nothing}<div class="tip" style="left:${this.tip.x}px;top:${this.tip.y}px">${this.tip.text}</div>` : nothing}
      </div>
      ${rec?.error ? html`<div class="ft err">${icon("alert", 13)}<span>${rec.error}</span></div>`
        : rec?.notice ? html`<div class="ft note">${icon("info", 13)}<span>${rec.notice}</span></div>` : nothing}
    </div>`;
  }
}
