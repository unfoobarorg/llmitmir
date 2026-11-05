// Shared styles, icons, formatting, markdown and small reusable elements.
import { LitElement, css, html, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import * as mdi from "./icons";
import { t } from "./i18n";
import { store } from "./api";

// ------------------------------------------------------------------ icons
const MAP: Record<string, string> = {
  plus: mdi.mdiPlus, chat: mdi.mdiChatOutline, cowork: mdi.mdiRobotOutline, project: mdi.mdiFolderOutline,
  task: mdi.mdiCalendarClockOutline, skill: mdi.mdiSchoolOutline, key: mdi.mdiKeyOutline, settings: mdi.mdiCogOutline,
  admin: mdi.mdiShieldAccountOutline, menu: mdi.mdiMenu, sidebar: mdi.mdiDockLeft, send: mdi.mdiArrowUp, stop: mdi.mdiStop,
  attach: mdi.mdiPaperclip, mic: mdi.mdiMicrophoneOutline, close: mdi.mdiClose, check: mdi.mdiCheck, copy: mdi.mdiContentCopy,
  retry: mdi.mdiRefresh, trash: mdi.mdiTrashCanOutline, pin: mdi.mdiPinOutline, pinOff: mdi.mdiPinOffOutline,
  edit: mdi.mdiPencilOutline, down: mdi.mdiChevronDown, right: mdi.mdiChevronRight, left: mdi.mdiChevronLeft,
  dots: mdi.mdiDotsHorizontal, eye: mdi.mdiEyeOutline, eyeOff: mdi.mdiEyeOffOutline, brain: mdi.mdiHeadLightbulbOutline,
  tools: mdi.mdiToolboxOutline, file: mdi.mdiFileDocumentOutline, download: mdi.mdiDownload, upload: mdi.mdiUpload,
  play: mdi.mdiPlay, pause: mdi.mdiPause, clock: mdi.mdiClockOutline, alert: mdi.mdiAlertCircleOutline,
  info: mdi.mdiInformationOutline, search: mdi.mdiMagnify, web: mdi.mdiWeb, home: mdi.mdiHomeOutline, image: mdi.mdiImageOutline,
  lock: mdi.mdiLockOutline, gauge: mdi.mdiGauge, bell: mdi.mdiBellOutline, list: mdi.mdiFormatListChecks, user: mdi.mdiAccountOutline,
  import: mdi.mdiDatabaseImportOutline, panel: mdi.mdiDockRight, sparkle: mdi.mdiCreationOutline, hourglass: mdi.mdiTimerSandComplete,
  cloud: mdi.mdiCloudOutline, wait: mdi.mdiProgressClock, external: mdi.mdiOpenInNew,
};

export function mdiPath(name: string): string {
  if (MAP[name]) return MAP[name];
  if (name?.startsWith("mdi:")) {
    const key = "mdi" + name.slice(4).split("-").map(s => s[0]?.toUpperCase() + s.slice(1)).join("");
    return (mdi as any)[key] || mdi.mdiTools;  // only icons listed in icons.ts are bundled
  }
  return mdi.mdiHelpCircleOutline;
}

export const icon = (name: string, size = 20) =>
  svg`<svg class="i" viewBox="0 0 24 24" width=${size} height=${size} aria-hidden="true"><path d=${mdiPath(name)} fill="currentColor"/></svg>`;

// ------------------------------------------------------------------ formatting
export const fmtNum = (n: number) => {
  n = Number(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + " Mio.";
  if (n >= 1e4) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".", ",") + "k";
  return String(Math.round(n));
};
export const fmtTime = (ts?: number | string | null) => {
  if (!ts) return "–";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (same) return hm;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `gestern ${hm}`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: d.getFullYear() !== now.getFullYear() ? "2-digit" : undefined }) + " " + hm;
};
export const fmtDuration = (sec: number) => {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${sec % 60 ? (sec % 60) + " s" : ""}`.trim();
  return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
};

// ------------------------------------------------------------------ markdown
marked.setOptions({ gfm: true, breaks: true });
DOMPurify.addHook("afterSanitizeAttributes", (node: any) => {
  if (node.tagName === "A") { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener noreferrer"); }
});
export function md(text: string) {
  const raw = marked.parse(text || "", { async: false }) as string;
  return unsafeHTML(DOMPurify.sanitize(raw, { FORBID_TAGS: ["style", "form", "input"], FORBID_ATTR: ["style"] }));
}

export function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(() => store.notify(t("Kopiert")), () => {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove(); store.notify(t("Kopiert"));
  });
}

// ------------------------------------------------------------------ shared CSS
export const tokens = css`
  :host {
    --lm-bg: #faf9f6; --lm-side: #f3f1ea; --lm-panel: #ffffff; --lm-raise: #ffffff; --lm-text: #2b2a27; --lm-muted: #77736a;
    --lm-faint: #a8a398; --lm-line: #e6e2d7; --lm-hover: rgba(60, 50, 30, 0.06); --lm-accent: #c96a3f; --lm-accent-2: #e08a5c;
    --lm-accent-soft: rgba(201, 106, 63, 0.12); --lm-ok: #3f8f5b; --lm-warn: #c58a16; --lm-err: #c2453b; --lm-user: #efece3;
    --lm-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 18px rgba(40, 30, 10, .07); --lm-r: 14px;
    --lm-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    --lm-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif;
    --lm-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    color: var(--lm-text); font-family: var(--lm-sans); -webkit-font-smoothing: antialiased;
  }
  :host([dark]) {
    --lm-bg: #262624; --lm-side: #1f1e1d; --lm-panel: #30302e; --lm-raise: #353532; --lm-text: #ece9e1; --lm-muted: #a8a49a;
    --lm-faint: #77736a; --lm-line: #3e3d39; --lm-hover: rgba(255, 255, 255, 0.06); --lm-accent: #d9784a; --lm-accent-2: #eb9468;
    --lm-accent-soft: rgba(217, 120, 74, 0.16); --lm-user: #3a3a37; --lm-shadow: 0 1px 2px rgba(0,0,0,.3), 0 6px 22px rgba(0,0,0,.25);
  }
`;

export const base = css`
  :host { color: var(--lm-text); font-family: var(--lm-sans); -webkit-font-smoothing: antialiased; }
  * { box-sizing: border-box; }
  .i { flex: none; display: inline-block; vertical-align: middle; }
  button { font: inherit; color: inherit; }
  .btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--lm-line); background: var(--lm-raise);
    border-radius: 10px; padding: 7px 12px; min-height: 36px; cursor: pointer; transition: background .15s, border-color .15s, transform .1s; }
  .btn:hover { background: var(--lm-hover); }
  .btn:active { transform: scale(.98); }
  .btn.primary { background: var(--lm-accent); border-color: var(--lm-accent); color: #fff; }
  .btn.primary:hover { background: var(--lm-accent-2); }
  .btn.ghost { border-color: transparent; background: transparent; }
  .btn.danger { color: var(--lm-err); }
  .btn[disabled] { opacity: .45; pointer-events: none; }
  .iconbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; border: 0; background: transparent;
    color: var(--lm-muted); cursor: pointer; transition: background .15s, color .15s; }
  .iconbtn:hover { background: var(--lm-hover); color: var(--lm-text); }
  .iconbtn.on { color: var(--lm-accent); }
  input, textarea, select { font: inherit; color: var(--lm-text); background: var(--lm-panel); border: 1px solid var(--lm-line);
    border-radius: 10px; padding: 9px 11px; width: 100%; outline: none; transition: border-color .15s, box-shadow .15s; }
  input:focus, textarea:focus, select:focus { border-color: var(--lm-accent); box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  textarea { resize: vertical; line-height: 1.5; }
  textarea.code { font-family: var(--lm-mono); font-size: 13px; }
  label.f { display: grid; gap: 6px; font-size: 13px; color: var(--lm-muted); }
  label.f > span { font-weight: 550; color: var(--lm-text); }
  .hint { font-size: 12.5px; color: var(--lm-muted); line-height: 1.45; }
  .card { background: var(--lm-panel); border: 1px solid var(--lm-line); border-radius: var(--lm-r); padding: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 3px 9px; border-radius: 999px;
    background: var(--lm-hover); color: var(--lm-muted); white-space: nowrap; }
  .chip.accent { background: var(--lm-accent-soft); color: var(--lm-accent); }
  .chip.ok { background: rgba(63,143,91,.13); color: var(--lm-ok); }
  .chip.err { background: rgba(194,69,59,.12); color: var(--lm-err); }
  .chip.warn { background: rgba(197,138,22,.14); color: var(--lm-warn); }
  .row { display: flex; align-items: center; gap: 8px; }
  .grow { flex: 1; min-width: 0; }
  .muted { color: var(--lm-muted); }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .page { max-width: 980px; margin: 0 auto; padding: 28px 24px 80px; }
  .page .row > h1 { margin-bottom: 4px; }
  a { color: var(--lm-accent); }
  .page h1 { font-family: var(--lm-serif); font-weight: 500; font-size: 30px; margin: 4px 0 18px; letter-spacing: -.01em; }
  .page h2 { font-size: 15px; margin: 26px 0 10px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
  .list { display: grid; gap: 8px; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--lm-line); border-radius: 12px;
    background: var(--lm-panel); cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; }
  .item:hover { border-color: color-mix(in srgb, var(--lm-accent) 35%, var(--lm-line)); box-shadow: var(--lm-shadow); }
  .md { line-height: 1.62; font-size: 15.5px; overflow-wrap: anywhere; }
  .md p { margin: 0 0 .75em; } .md p:last-child { margin-bottom: 0; }
  .md h1, .md h2, .md h3 { font-family: var(--lm-serif); font-weight: 600; line-height: 1.3; margin: 1.1em 0 .5em; }
  .md h1 { font-size: 1.45em; } .md h2 { font-size: 1.25em; } .md h3 { font-size: 1.08em; }
  .md code { font-family: var(--lm-mono); font-size: .86em; background: var(--lm-hover); padding: .1em .35em; border-radius: 5px; }
  .md pre { background: var(--lm-side); border: 1px solid var(--lm-line); padding: 12px 14px; border-radius: 10px; overflow-x: auto; }
  .md pre code { background: none; padding: 0; font-size: 13px; }
  .md table { border-collapse: collapse; display: block; overflow-x: auto; margin: .6em 0; font-size: 14px; }
  .md th, .md td { border: 1px solid var(--lm-line); padding: 6px 10px; text-align: left; overflow-wrap: normal; word-break: normal; }
  .md td { min-width: 4.5em; }
  .md th { background: var(--lm-side); }
  .md blockquote { margin: .6em 0; padding-left: 12px; border-left: 3px solid var(--lm-line); color: var(--lm-muted); }
  .md a { color: var(--lm-accent); }
  .md ul, .md ol { padding-left: 1.4em; margin: .3em 0 .8em; }
  .md li { margin: .2em 0; }
  .md img { max-width: 100%; border-radius: 8px; }
  .fade-in { animation: fadeIn .28s ease both; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 640px) { .page { padding: 16px 14px 90px; } .page h1 { font-size: 25px; } }
`;

// ------------------------------------------------------------------ thinking spark
@customElement("lm-spark")
export class Spark extends LitElement {
  @property({ type: Boolean }) active = true;
  @property({ type: Number }) size = 22;
  static styles = css`
    :host { display: inline-grid; place-items: center; color: var(--lm-accent, #c96a3f); }
    svg { overflow: visible; }
    .on .rays { animation: spin 3.2s cubic-bezier(.45,.05,.55,.95) infinite; transform-origin: 12px 12px; }
    .on .core { animation: pulse 1.6s ease-in-out infinite; transform-origin: 12px 12px; }
    .on .ray { animation: grow 1.6s ease-in-out infinite; transform-origin: 12px 12px; }
    .ray:nth-child(2n) { animation-delay: -.4s; } .ray:nth-child(3n) { animation-delay: -.8s; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 50% { transform: scale(.72); opacity: .75; } }
    @keyframes grow { 50% { transform: scale(.78); } }
  `;
  render() {
    const rays = Array.from({ length: 8 }, (_, i) => i * 45);
    return html`<svg class=${this.active ? "on" : ""} width=${this.size} height=${this.size} viewBox="0 0 24 24">
      <g class="rays">${rays.map(a => svg`<g class="ray"><path transform="rotate(${a} 12 12)" d="M12 1.6 C12.7 6 13 7.4 12 9.4 C11 7.4 11.3 6 12 1.6Z" fill="currentColor"/></g>`)}</g>
      <circle class="core" cx="12" cy="12" r="2.4" fill="currentColor"/></svg>`;
  }
}

// ------------------------------------------------------------------ ring meter
@customElement("lm-ring")
export class Ring extends LitElement {
  @property({ type: Number }) value = 0;   // 0..1
  @property({ type: Number }) size = 20;
  @property() label = "";
  static styles = css`
    :host { display: inline-grid; place-items: center; }
    circle { transition: stroke-dashoffset .6s ease, stroke .3s; }
  `;
  render() {
    const v = Math.max(0, Math.min(1, this.value || 0));
    const r = 8, c = 2 * Math.PI * r;
    const col = v >= 0.9 ? "var(--lm-err, #c2453b)" : v >= 0.7 ? "var(--lm-warn, #c58a16)" : "var(--lm-accent, #c96a3f)";
    return html`<svg width=${this.size} height=${this.size} viewBox="0 0 20 20" role="img" aria-label=${this.label}>
      <circle cx="10" cy="10" r=${r} fill="none" stroke="var(--lm-line, #ddd)" stroke-width="2.6"/>
      <circle cx="10" cy="10" r=${r} fill="none" stroke=${col} stroke-width="2.6" stroke-linecap="round"
        stroke-dasharray=${c} stroke-dashoffset=${c * (1 - v)} transform="rotate(-90 10 10)"/></svg>`;
  }
}

// ------------------------------------------------------------------ popover menu
@customElement("lm-menu")
export class Menu extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() align: "left" | "right" = "left";
  @property() direction: "up" | "down" = "up";
  static styles = [base, css`
    :host { position: relative; display: inline-block; }
    .pop { position: absolute; z-index: 30; min-width: 240px; max-width: min(360px, 92vw); max-height: min(60vh, 520px); overflow-y: auto;
      background: var(--lm-raise); border: 1px solid var(--lm-line); border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.16);
      padding: 6px; animation: pop .16s ease both; }
    .up { bottom: calc(100% + 8px); } .down { top: calc(100% + 6px); }
    .left { left: 0; } .right { right: 0; }
    @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } }
  `];
  private _doc = (e: Event) => { if (!e.composedPath().includes(this)) this.open = false; };
  connectedCallback() { super.connectedCallback(); document.addEventListener("pointerdown", this._doc); }
  disconnectedCallback() { super.disconnectedCallback(); document.removeEventListener("pointerdown", this._doc); }
  render() {
    return html`<span @click=${() => (this.open = !this.open)}><slot name="trigger"></slot></span>
      ${this.open ? html`<div class="pop ${this.direction} ${this.align}" @click=${(e: Event) => {
        if ((e.target as HTMLElement).closest("[data-close]")) this.open = false; }}><slot></slot></div>` : nothing}`;
  }
}

export const menuItemStyles = css`
  .mi { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; background: none; border-radius: 9px;
    cursor: pointer; text-align: left; color: var(--lm-text); font-size: 14px; }
  .mi:hover { background: var(--lm-hover); }
  .mi .sub { font-size: 12px; color: var(--lm-muted); }
  .mi.sel { background: var(--lm-accent-soft); }
  .mh { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--lm-faint); padding: 8px 10px 4px; }
  .msep { height: 1px; background: var(--lm-line); margin: 6px 4px; }
`;

// ------------------------------------------------------------------ voice recorder (16 kHz mono WAV)
export class VoiceRecorder {
  private ctx?: AudioContext; private src?: MediaStreamAudioSourceNode; private proc?: ScriptProcessorNode;
  private stream?: MediaStream; private chunks: Float32Array[] = []; private rate = 48000;
  level = 0;
  static supported() { return !!(typeof navigator.mediaDevices?.getUserMedia === "function" && (window.AudioContext || (window as any).webkitAudioContext)); }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.rate = this.ctx.sampleRate;
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(d));
      let s = 0; for (let i = 0; i < d.length; i += 16) s += d[i] * d[i];
      this.level = Math.min(1, Math.sqrt(s / (d.length / 16)) * 4);
    };
    this.src.connect(this.proc); this.proc.connect(this.ctx.destination);
  }
  async stop(): Promise<Blob> {
    this.proc?.disconnect(); this.src?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    await this.ctx?.close();
    const len = this.chunks.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(len); let o = 0;
    for (const c of this.chunks) { all.set(c, o); o += c.length; }
    this.chunks = [];
    // downsample to 16 kHz
    const ratio = this.rate / 16000, n = Math.floor(all.length / ratio);
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio), b = Math.min(all.length, Math.floor((i + 1) * ratio));
      let s = 0; for (let j = a; j < b; j++) s += all[j];
      const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
    const w = (p: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
    w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true);
    dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data");
    dv.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], { type: "audio/wav" });
  }
  cancel() { this.proc?.disconnect(); this.src?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); this.ctx?.close(); this.chunks = []; }
}

// ------------------------------------------------------------------ confirm dialog
export function confirmDialog(text: string, okLabel = "Löschen"): Promise<boolean> {
  return new Promise(resolve => {
    const host = document.querySelector("home-assistant")?.shadowRoot ? document.body : document.body;
    const el = document.createElement("lm-confirm") as Confirm;
    el.text = text; el.ok = okLabel; el.dark = !!store.data?.__dark;
    el.addEventListener("done", (e: any) => { resolve(e.detail); el.remove(); });
    host.appendChild(el);
  });
}

@customElement("lm-confirm")
export class Confirm extends LitElement {
  @property() text = ""; @property() ok = "OK"; @property({ type: Boolean, reflect: true }) dark = false;
  static styles = [tokens, base, css`
    .back { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; z-index: 9999; animation: fadeIn .15s; padding: 16px; }
    .box { background: var(--lm-panel); color: var(--lm-text); border-radius: 16px; padding: 20px; width: min(420px, 100%); box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    .box p { margin: 0 0 18px; line-height: 1.5; }
  `];
  private done(v: boolean) { this.dispatchEvent(new CustomEvent("done", { detail: v })); }
  render() {
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && this.done(false)}>
      <div class="box"><p>${this.text}</p><div class="row" style="justify-content:flex-end">
        <button class="btn" @click=${() => this.done(false)}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${() => this.done(true)}>${t(this.ok)}</button></div></div></div>`;
  }
}

export { state };
