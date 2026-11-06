// Chat / cowork / task-run view.
import { LitElement, css, html, nothing } from "lit";
import { property, state, query } from "lit/decorators.js";
import { base, icon, md, fmtNum, fmtTime, fmtDuration, copyText, menuItemStyles, confirmDialog, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { modelById, modelName } from "./modelpick";
import type { SendDetail } from "./composer";
import "./composer";

const STATUS_TEXT: Record<string, string> = {
  queued: "In der Warteschlange …", thinking: "Denkt nach …", streaming: "Schreibt …", tool: "Arbeitet …",
  waiting_permission: "Wartet auf Freigabe", retry: "Modell ausgelastet – neuer Versuch", quota_wait: "Limit erreicht – wartet",
};

// Proposed / applied changes to skills, scheduled tasks and credentials (change sets from changes.py).
const CHANGE_ART: Record<string, [string, string, string]> = {
  skill: ["Skill", "mdi:school-outline", "Skills"], aufgabe: ["Geplante Aufgabe", "mdi:calendar-clock-outline", "Geplant"],
  zugang: ["Zugang", "mdi:key-outline", "Zugänge"],
};
const CHANGE_VERB: Record<string, [string, string]> = { anlegen: ["neu", "add"], aendern: ["ändern", "upd"], loeschen: ["löschen", "del"] };
// Simple view: what the assistant is doing, in plain words (by tool group).
const DOING: Record<string, string> = {
  web: "Sucht im Internet …", ha: "Schaut im Zuhause nach …", dav: "Schaut in deiner Nextcloud nach …", http: "Fragt einen Dienst ab …",
  files: "Liest Dateien …", skills: "Liest eine Anleitung …", werkbank: "Rechnet und erstellt Dateien …", notify: "Schickt eine Nachricht …",
  progress: "Plant die nächsten Schritte …", llmitmir: "Schaut in LLMitMir nach …", model: "Schaut sich den Anhang an …",
};
const GROUP_PLAIN: Record<string, string> = {
  web: "das Internet", dav: "deine Nextcloud", http: "Abfragen bei anderen Diensten", files: "Dateien", notify: "Benachrichtigungen",
  skills: "deine Anleitungen (Skills)", werkbank: "die Werkbank (Programme ausführen)", ha: "Home Assistant",
};
const CHANGE_WHAT: Record<string, string> = { skill: "den Skill", aufgabe: "die geplante Aufgabe", zugang: "den Zugang" };
const tsDate = (ts: any) => (typeof ts === "number" ? new Date(ts * 1000) : ts ? new Date(ts) : null);
const hm = (ts: any) => tsDate(ts)?.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) || "";
function dayLabel(ts: any): string {
  const d = tsDate(ts); if (!d) return "";
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Heute";
  if (d.toDateString() === y.toDateString()) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}
/** Errors people can act on are shown as they are; technical ones get a plain sentence (details stay available). */
const plainError = (e: string) => /Schlüssel|Kontingent|Limit|Admin|Einstellungen/.test(e) ? e
  : "Die KI hat gerade nicht richtig geantwortet. Versuch es bitte gleich noch einmal.";

const isLong = (v: any) => typeof v === "string" && (v.includes("\n") || v.length > 120);

function changeField(f: any, aktion: string) {
  let val: any;
  if (f.diff) {
    val = html`<div class="diff">${f.diff.map(([op, line]: [string, any]) => op === "…"
      ? html`<div class="s">⋯ ${line} unveränderte Zeile${line === 1 ? "" : "n"}</div>`
      : html`<div class=${op === "+" ? "a" : op === "-" ? "d" : "c"}>${line || " "}</div>`)}</div>`;
  } else if (aktion === "aendern") {
    val = isLong(f.alt) || isLong(f.neu)
      ? html`${f.alt ? html`<div class="blk gone">${f.alt}</div>` : nothing}${f.neu ? html`<div class="blk add">${f.neu}</div>` : html`<span class="old">leer</span>`}`
      : html`${f.alt ? html`<span class="old">${f.alt}</span>` : html`<span class="muted">leer</span>`}<span class="arrow">→</span>${f.neu ? html`<span class="new">${f.neu}</span>` : html`<span class="muted">leer</span>`}`;
  } else {
    const v = aktion === "loeschen" ? f.alt : f.neu;
    val = isLong(v) ? html`<div class="blk ${aktion === "loeschen" ? "gone" : ""}">${v}</div>` : html`<span class=${aktion === "loeschen" ? "gonetxt" : ""}>${v || "–"}</span>`;
  }
  return html`<div class="k">${f.feld}</div><div class="v">${val}</div>`;
}

export function changeView(ch: any, status?: string) {
  const [art, ic] = CHANGE_ART[ch.art] || [ch.art, "mdi:tools"];
  const [verb, cls] = CHANGE_VERB[ch.aktion] || [ch.aktion, "upd"];
  const st = status === "ok" ? html`<span class="chip ok">${icon("check", 14)} übernommen</span>`
    : status === "denied" ? html`<span class="chip warn">abgelehnt</span>`
    : status === "error" ? html`<span class="chip err">fehlgeschlagen</span>`
    : status === "running" ? html`<span class="spin"></span>` : nothing;
  return html`<div class="chg ${cls}">
    <div class="chg-h">${icon(ic, 18)}<span class="grow"><span class="muted">${art}</span> <b>${ch.name}</b></span>
      <span class="badge ${cls}">${verb}</span>${st}</div>
    ${ch.hinweis ? html`<div class="chg-note">${icon("alert", 16)} ${ch.hinweis}</div>` : nothing}
    ${ch.felder?.length ? html`<div class="chg-f">${ch.felder.map((f: any) => changeField(f, ch.aktion))}</div>` : nothing}
  </div>`;
}

@safeElement("lm-chat")
export class ChatView extends LitElement {
  @property() chatId = "";
  @property({ type: Boolean }) narrow = false;
  @state() private openSteps = new Set<string>();
  @state() private panel = false;
  @state() private editTitle = false;
  @state() private now = Date.now();
  @state() private hideHint = "";
  @query(".scroll") private scroller!: HTMLElement;
  private stick = true;
  private _tick: any;
  private _onChange = () => { this.requestUpdate(); this.updateComplete.then(() => this.autoscroll()); };

  static styles = [base, menuItemStyles, css`
    :host { display: flex; height: 100%; min-height: 0; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; }
    header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; min-height: 52px; }
    header .title { font-weight: 560; font-size: 15px; padding: 6px 8px; border-radius: 8px; cursor: pointer; max-width: 60vw; }
    header .title:hover { background: var(--lm-hover); }
    header input { max-width: 420px; padding: 6px 8px; }
    .scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; }
    .thread { max-width: 780px; margin: 0 auto; padding: 10px 22px 30px; display: grid; gap: 22px; }
    .user { justify-self: end; max-width: min(85%, 640px); background: var(--lm-user); border-radius: 18px 18px 6px 18px;
      padding: 10px 15px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; font-size: 15.5px; animation: fadeIn .25s; }
    .att { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-bottom: 6px; }
    .att button { border: 1px solid var(--lm-line); background: var(--lm-raise); border-radius: 10px; padding: 4px 9px; font-size: 12.5px;
      cursor: pointer; display: inline-flex; gap: 5px; align-items: center; }
    .asst { display: grid; gap: 8px; animation: fadeIn .25s; }
    .meta { display: flex; align-items: center; gap: 2px; color: var(--lm-faint); font-size: 12px; opacity: 0; transition: opacity .2s; }
    .asst:hover .meta, .asst.last .meta { opacity: 1; }
    .meta .iconbtn { width: 30px; height: 30px; }
    .think { border-left: 2px solid var(--lm-line); padding: 2px 0 2px 12px; }
    .think summary { cursor: pointer; color: var(--lm-muted); font-size: 13px; list-style: none; display: flex; gap: 6px; align-items: center; }
    .think summary::-webkit-details-marker { display: none; }
    .think .txt { white-space: pre-wrap; color: var(--lm-muted); font-size: 13.5px; line-height: 1.55; margin-top: 6px; max-height: 320px; overflow-y: auto; }
    .steps { border: 1px solid var(--lm-line); border-radius: 14px; overflow: hidden; background: var(--lm-panel); }
    .step { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; font-size: 13.5px; }
    .step + .step, .step + .detail, .detail + .step { border-top: 1px solid var(--lm-line); }
    .step:hover { background: var(--lm-hover); }
    .step .lbl { font-weight: 520; } .step .arg { color: var(--lm-muted); }
    .step .st { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--lm-faint); font-size: 12px; flex: none; }
    .ok { color: var(--lm-ok); } .err { color: var(--lm-err); } .den { color: var(--lm-warn); }
    .detail { padding: 10px 12px 12px 40px; font-size: 12.5px; background: var(--lm-side); }
    .detail pre { margin: 4px 0 8px; white-space: pre-wrap; word-break: break-word; font-family: var(--lm-mono); font-size: 12px;
      max-height: 280px; overflow-y: auto; background: var(--lm-panel); border: 1px solid var(--lm-line); padding: 8px; border-radius: 8px; }
    .perm.slow { border-color: color-mix(in srgb, var(--lm-warn) 45%, var(--lm-line)); }
    .perm.slow > .row:first-child svg { color: var(--lm-warn); }
    .running { display: flex; align-items: center; gap: 10px; color: var(--lm-muted); font-size: 14px; padding: 4px 0; }
    .caret { display: inline-block; width: 8px; height: 1.05em; background: var(--lm-accent); border-radius: 2px; vertical-align: text-bottom;
      margin-left: 2px; animation: caret 1s steps(2) infinite; }
    @keyframes caret { 50% { opacity: 0; } }
    .error { border: 1px solid color-mix(in srgb, var(--lm-err) 40%, var(--lm-line)); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel));
      border-radius: 12px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
    .perm { border: 1px solid color-mix(in srgb, var(--lm-accent) 45%, var(--lm-line)); background: var(--lm-panel); border-radius: 16px;
      padding: 14px 16px; box-shadow: var(--lm-shadow); animation: fadeIn .25s; display: grid; gap: 10px; }
    .perm pre { margin: 0; font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 180px;
      overflow-y: auto; background: var(--lm-side); padding: 8px 10px; border-radius: 8px; }
    .perm .row { flex-wrap: wrap; }
    .chg { border: 1px solid var(--lm-line); border-radius: 12px; background: var(--lm-panel); overflow: hidden; cursor: auto; }
    .chg-h { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--lm-line); font-size: 14px; }
    .chg-h .chip { display: inline-flex; align-items: center; gap: 3px; }
    .badge { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
    .badge.add { background: color-mix(in srgb, var(--lm-ok) 15%, transparent); color: var(--lm-ok); }
    .badge.upd { background: var(--lm-accent-soft); color: var(--lm-accent); }
    .badge.del { background: color-mix(in srgb, var(--lm-err) 13%, transparent); color: var(--lm-err); }
    .chg.add { border-left: 3px solid var(--lm-ok); } .chg.upd { border-left: 3px solid var(--lm-accent); } .chg.del { border-left: 3px solid var(--lm-err); }
    .chg-note { display: flex; gap: 6px; align-items: center; padding: 8px 12px; font-size: 13px; color: var(--lm-warn);
      background: color-mix(in srgb, var(--lm-warn) 8%, transparent); border-bottom: 1px solid var(--lm-line); }
    .chg-f { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 9px 14px; padding: 11px 12px; font-size: 13.5px; align-items: baseline; }
    .chg-f .k { color: var(--lm-muted); font-size: 12.5px; }
    .chg-f .v { min-width: 0; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: baseline; }
    .chg-f .v > .diff, .chg-f .v > .blk { flex: 1 1 100%; }
    .old { text-decoration: line-through; color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 9%, transparent); border-radius: 4px; padding: 0 5px; }
    .new { color: var(--lm-ok); background: color-mix(in srgb, var(--lm-ok) 11%, transparent); border-radius: 4px; padding: 0 5px; font-weight: 520; }
    .arrow { color: var(--lm-faint); } .gonetxt { text-decoration: line-through; color: var(--lm-muted); }
    .blk { white-space: pre-wrap; font-size: 13px; line-height: 1.5; max-height: 240px; overflow-y: auto; background: var(--lm-side);
      border-radius: 8px; padding: 7px 10px; }
    .blk.add { border-left: 3px solid var(--lm-ok); } .blk.gone { border-left: 3px solid var(--lm-err); color: var(--lm-muted); text-decoration: line-through; }
    .diff { font-family: var(--lm-mono); font-size: 12px; line-height: 1.55; border: 1px solid var(--lm-line); border-radius: 8px; overflow-y: auto; max-height: 340px; }
    .diff > div { white-space: pre-wrap; word-break: break-word; padding: 1px 10px 1px 24px; position: relative; }
    .diff .a { background: color-mix(in srgb, var(--lm-ok) 13%, transparent); }
    .diff .a::before { content: "+"; position: absolute; left: 9px; color: var(--lm-ok); font-weight: 700; }
    .diff .d { background: color-mix(in srgb, var(--lm-err) 11%, transparent); }
    .diff .d::before { content: "−"; position: absolute; left: 9px; color: var(--lm-err); font-weight: 700; }
    .diff .c { color: var(--lm-muted); }
    .diff .s { color: var(--lm-faint); font-style: italic; background: var(--lm-side); padding-left: 10px; font-family: inherit; }
    .chgd { padding: 0 12px 12px 12px; background: var(--lm-panel); cursor: auto; }
    @media (max-width: 560px) { .chg-f { grid-template-columns: minmax(0, 1fr); gap: 2px 0; } .chg-f .v { margin-bottom: 8px; } }
    .foot { padding: 0 16px 14px; max-width: 812px; margin: 0 auto; width: 100%; }
    .note { text-align: center; font-size: 11.5px; color: var(--lm-faint); margin-top: 6px; }
    aside { width: 320px; border-left: 1px solid var(--lm-line); background: var(--lm-bg); overflow-y: auto; padding: 14px; flex: none;
      display: grid; align-content: start; gap: 14px; }
    aside h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .prog { display: grid; gap: 6px; }
    .prog div { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; line-height: 1.4; }
    .prog .done { color: var(--lm-muted); text-decoration: line-through; text-decoration-color: var(--lm-faint); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--lm-accent-soft); border-top-color: var(--lm-accent); border-radius: 50%;
      animation: rot .8s linear infinite; flex: none; margin-top: 1px; }
    @keyframes rot { to { transform: rotate(360deg); } }
    .fl { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 9px; cursor: pointer; font-size: 13px; }
    .fl:hover { background: var(--lm-hover); }
    .sheet { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; animation: fadeIn .15s; }
    .sheet aside { width: min(360px, 88vw); height: 100%; border: 0; box-shadow: -10px 0 40px rgba(0,0,0,.2); background: var(--lm-bg); }
    .empty { text-align: center; color: var(--lm-muted); padding: 60px 20px; }
    /* simple view: messenger-style bubbles */
    :host { --lm-me: color-mix(in srgb, var(--lm-accent) 16%, var(--lm-panel)); }
    .thread.simple { gap: 8px; padding-top: 14px; }
    .day { justify-self: center; margin: 10px 0 4px; font-size: 12px; color: var(--lm-muted); background: var(--lm-panel);
      border: 1px solid var(--lm-line); padding: 3px 11px; border-radius: 999px; }
    .sys { justify-self: center; font-size: 12.5px; color: var(--lm-muted); background: var(--lm-hover); padding: 6px 12px; border-radius: 10px;
      text-align: center; max-width: 90%; display: flex; gap: 6px; align-items: center; }
    .bubble { max-width: min(84%, 640px); min-width: 0; padding: 8px 12px 5px; border-radius: 18px; line-height: 1.5; font-size: 15.5px;
      overflow-wrap: anywhere; animation: bin .22s ease both; }
    .bubble.me { justify-self: end; background: var(--lm-me); border-bottom-right-radius: 6px; }
    .bubble.ai { justify-self: start; background: var(--lm-panel); border: 1px solid var(--lm-line); border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .bubble .btxt { white-space: pre-wrap; }
    .bubble .md { font-size: 15.5px; }
    .bubble .md > :last-child { margin-bottom: 0; }
    .bubble .md > :first-child { margin-top: 0; }
    .bfoot { display: flex; align-items: center; justify-content: flex-end; gap: 2px; margin-top: 2px; min-height: 18px; }
    .bt { font-size: 11px; color: var(--lm-faint); margin-left: 6px; white-space: nowrap; }
    .bubble.me .bt { display: block; text-align: right; margin-top: 1px; }
    .mini { border: 0; background: none; color: var(--lm-faint); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; cursor: pointer; }
    .mini:hover { background: var(--lm-hover); color: var(--lm-text); }
    .batt { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
    .batt button { border: 0; background: color-mix(in srgb, var(--lm-panel) 70%, transparent); border-radius: 10px; padding: 6px 10px; font-size: 13px;
      cursor: pointer; display: inline-flex; gap: 6px; align-items: center; max-width: 100%; }
    .bubble.fail { border-color: color-mix(in srgb, var(--lm-err) 40%, var(--lm-line)); display: grid; gap: 8px; padding: 10px 14px 6px; }
    .bubble.ask { border-color: color-mix(in srgb, var(--lm-accent) 55%, var(--lm-line)); display: grid; gap: 10px; padding: 12px 14px;
      max-width: min(94%, 640px); box-shadow: var(--lm-shadow); }
    .brow { display: flex; flex-wrap: wrap; gap: 8px; }
    details.why > summary { cursor: pointer; font-size: 13px; color: var(--lm-muted); list-style: none; display: inline-flex; gap: 4px; align-items: center; }
    details.why > summary::-webkit-details-marker { display: none; }
    details.why[open] > summary { margin-bottom: 8px; }
    details.why pre { margin: 0; font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 200px;
      overflow-y: auto; background: var(--lm-side); padding: 8px 10px; border-radius: 8px; }
    .typing { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px 10px 12px; }
    .dots { display: inline-flex; gap: 4px; align-items: center; height: 14px; }
    .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--lm-accent); opacity: .35; animation: dot 1.3s ease-in-out infinite; }
    .dots i:nth-child(2) { animation-delay: .16s; } .dots i:nth-child(3) { animation-delay: .32s; }
    .tstat { font-size: 14px; }
    .slowsys { justify-self: start; max-width: min(84%, 560px); font-size: 13px; color: var(--lm-muted); padding: 0 6px; line-height: 1.45; animation: fadeIn .3s; }
    @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-5px); opacity: 1; } }
    @keyframes bin { from { opacity: 0; transform: translateY(6px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .dots i, .bubble { animation: none; } .dots i { opacity: .7; } }
    .taskinfo { font-size: 13px; color: var(--lm-muted); background: var(--lm-side); border-radius: 12px; padding: 10px 12px; display: flex; gap: 8px; }
    @media (max-width: 640px) { .thread { padding: 8px 14px 24px; gap: 18px; } .foot { padding: 0 10px 10px; } header { padding: 6px 6px; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener("change", this._onChange);
    this._tick = setInterval(() => { if (store.runs[this.chatId]) this.now = Date.now(); }, 1000);
  }
  disconnectedCallback() { super.disconnectedCallback(); store.removeEventListener("change", this._onChange); clearInterval(this._tick); }

  updated(ch: Map<string, any>) {
    if (ch.has("chatId") && this.chatId) {
      this.stick = true;
      store.loadChat(this.chatId, true).then(() => this.updateComplete.then(() => this.autoscroll(true))).catch(e => store.notify(String(e.message || e)));
    }
  }

  private autoscroll(force = false) {
    const s = this.scroller; if (!s) return;
    if (force || this.stick) { s.style.scrollBehavior = force ? "auto" : "smooth"; s.scrollTop = s.scrollHeight; }
  }
  private onScroll() { const s = this.scroller; this.stick = s.scrollHeight - s.scrollTop - s.clientHeight < 120; }

  private get chat() { return store.chats.get(this.chatId); }

  private async send(e: CustomEvent<SendDetail>) {
    const d = e.detail; const chat = this.chat; if (!chat) return;
    try {
      let names: string[] = [];
      if (d.files.length) names = (await store.api.upload("chat", chat.id, d.files)).files.map((f: any) => f.name);
      this.stick = true;
      await store.api.ws("chat/send", { chat_id: chat.id, text: d.text || "(siehe Anhang)", attachments: names, model: d.model,
        ...(chat.kind === "chat" ? { tools: d.tools } : {}) });
    } catch (err: any) { store.notify(String(err.message || err)); }
  }

  private stop() { store.api.ws("chat/stop", { chat_id: this.chatId }); }
  private retry() { store.api.ws("chat/retry", { chat_id: this.chatId }).then(r => { store.chats.set(this.chatId, r.chat); store.changed(); }).catch(e => store.notify(e.message)); }

  private async openFile(name: string) {
    try { window.open(await store.api.fileUrl("chat", this.chatId, name), "_blank"); } catch (e: any) { store.notify(e.message); }
  }

  private stepRow(m: any) {
    const open = this.openSteps.has(m.id);
    const a = m.args || {};
    const argText = a.anfrage || a.url || a.pfad || a.name || a.entity_id || a.filter || a.typ || (a.domain ? `${a.domain}.${a.service}` : "") || "";
    const st = m.status;
    return html`<div class="step" @click=${() => { const s = new Set(this.openSteps); open ? s.delete(m.id) : s.add(m.id); this.openSteps = s; }}>
        ${icon(m.icon || "tools", 18)}<span class="lbl">${m.label || m.name}</span><span class="arg ellipsis">${argText ? `· ${String(argText).slice(0, 80)}` : ""}</span>
        <span class="st">${st === "running" ? html`<span class="spin"></span>` : st === "ok" ? html`<span class="ok">${icon("check", 16)}</span>`
          : st === "denied" ? html`<span class="den">${icon("lock", 16)}</span>` : html`<span class="err">${icon("alert", 16)}</span>`}
          ${m.ms ? (m.ms > 1000 ? (m.ms / 1000).toFixed(1).replace(".", ",") + " s" : m.ms + " ms") : ""}${icon(open ? "down" : "right", 16)}</span></div>
      ${m.change ? html`<div class="chgd">${changeView(m.change, st)}</div>` : nothing}
      ${open ? html`<div class="detail">${m.change ? nothing : html`<b>Eingabe</b><pre>${JSON.stringify(m.args || {}, null, 2)}</pre>`}
        ${m.content ? html`<b>Ergebnis</b><pre>${m.content.slice(0, 6000)}${m.content.length > 6000 ? "\n…" : ""}</pre>` : nothing}</div>` : nothing}`;
  }

  private renderMessages(chat: any, run: any) {
    const out: any[] = [];
    const msgs = chat.messages || [];
    const showThink = store.data?.settings?.show_reasoning !== false;
    let i = 0;
    const lastAsst = [...msgs].reverse().find((m: any) => m.role === "assistant" && (m.content || m.error));
    while (i < msgs.length) {
      const m = msgs[i];
      if (m.role === "user") {
        out.push(html`${m.attachments?.length ? html`<div class="att">${m.attachments.map((a: string) => html`<button @click=${() => this.openFile(a)}>${icon("file", 15)}${a}</button>`)}</div>` : nothing}
          <div class="user">${m.content}</div>`);
        i++; continue;
      }
      if (m.role === "tool") {
        const group: any[] = [];
        while (i < msgs.length && msgs[i].role === "tool") { group.push(msgs[i]); i++; }
        out.push(html`<div class="steps">${group.map(g => this.stepRow(g))}</div>`);
        continue;
      }
      // assistant
      const streaming = m.streaming && run;
      const last = m === lastAsst;
      out.push(html`<div class="asst ${last ? "last" : ""}">
        ${m.reasoning && showThink ? html`<details class="think" ?open=${streaming && !m.content}><summary>${icon("brain", 16)} ${streaming && !m.content ? html`<span class="shimmer">${t("Denkt nach …")}</span>` : t("Gedanken")}</summary>
          <div class="txt">${m.reasoning}</div></details>` : nothing}
        ${m.content ? html`<div class="md">${md(m.content)}${streaming ? html`<span class="caret"></span>` : nothing}</div>` : nothing}
        ${m.error ? html`<div class="error">${icon("alert")}<div class="grow"><b>Das hat nicht geklappt.</b><div>${m.error}</div></div>
          <button class="btn" @click=${() => this.retry()}>${icon("retry", 16)} ${t("Erneut versuchen")}</button></div>` : nothing}
        ${(m.content || m.error) && !streaming ? html`<div class="meta">
          ${m.content ? html`<button class="iconbtn" title=${t("Kopieren")} @click=${() => copyText(m.content)}>${icon("copy", 16)}</button>` : nothing}
          ${last && !run ? html`<button class="iconbtn" title=${t("Erneut versuchen")} @click=${() => this.retry()}>${icon("retry", 16)}</button>` : nothing}
          <span>${(store.data?.models || []).find((x: any) => x.id === m.model)?.name || m.model || ""}${m.usage?.completion ? ` · ${fmtNum(m.usage.completion)} Tokens` : ""} · ${fmtTime(m.created)}</span></div>` : nothing}
      </div>`);
      i++;
    }
    return out;
  }

  private runIndicator(run: any, chat: any) {
    if (!run) return nothing;
    const lastMsg = chat.messages[chat.messages.length - 1];
    if (run.status === "streaming" && lastMsg?.streaming && lastMsg?.content) return nothing;
    if (run.status === "waiting_permission") return nothing;
    const d = run.detail || {};
    let text = STATUS_TEXT[run.status] || "Arbeitet …";
    if (run.status === "tool") text = (d.label || "Werkzeug") + " …";
    if (run.status === "retry") text = `Modell ausgelastet – neuer Versuch in ${d.seconds} s (Versuch ${d.attempt})`;
    if (run.status === "quota_wait") text = `Limit des Schlüssels erreicht – geht in ${fmtDuration(d.seconds)} weiter`;
    if (run.status === "thinking" && d.switched_from) text = `${d.auto ? "Automatisch gewechselt" : "Gewechselt"} von ${modelName(d.switched_from)} zu ${modelName(chat.model)} – denkt nach …`;
    const el = (this.now / 1000) - (run.started || this.now / 1000);
    return html`<div class="running"><lm-spark></lm-spark><span class="shimmer">${text}</span>
      ${el > 20 ? html`<span class="muted" style="font-size:12px">· ${fmtDuration(el)}</span>` : nothing}</div>
      ${this.slowCard(run, chat)}`;
  }

  /** The model gives no output: say why and offer a free model that does the job about as well. */
  private slowCard(run: any, chat: any) {
    const h = run.hint;
    if (!h || this.hideHint === run.run_id + h.model) return nothing;
    const waited = Math.max(h.waited || 0, Math.round(this.now / 1000 - (h.since || this.now / 1000)));
    const busy = (h.demand ?? 0) >= 4;
    const alt = h.alt && modelById(h.alt.id) ? { ...h.alt, name: modelName(h.alt.id) } : h.alt;
    return html`<div class="perm slow">
      <div class="row">${icon("hourglass")}<b class="grow">${h.model_name} antwortet seit ${fmtDuration(waited)} nicht</b></div>
      <div class="hint">${busy ? "Das Modell ist beim Anbieter gerade stark ausgelastet" : "Das Modell kommt gerade nicht hinterher"} – so kann eine Antwort
        viele Minuten dauern.${alt ? html` <b>${alt.name}</b> ist ${alt.demand >= 2 ? "weniger ausgelastet" : "frei"} und ${alt.better ? "mindestens genauso stark" : alt.similar ? "löst die Aufgabe ähnlich gut" : "etwas schwächer, aber deutlich schneller"}.` : " Gerade ist kein ähnlich gutes Modell frei – LLMitMir wartet weiter."}
        ${chat.kind !== "chat" ? " Bisherige Schritte bleiben erhalten, es geht beim aktuellen Schritt weiter." : ""}</div>
      <div class="row">
        ${alt ? html`<button class="btn primary" @click=${() => this.switchModel(alt.id)}>${icon("retry", 16)} Mit ${alt.name} weitermachen</button>` : nothing}
        <button class="btn ghost" @click=${() => (this.hideHint = run.run_id + h.model)}>Weiter warten</button>
      </div></div>`;
  }

  private switchModel(model: string) {
    store.api.ws("chat/switch_model", { chat_id: this.chatId, model }).catch(e => store.notify(String(e.message || e)));
  }

  private permCards() {
    const answer = (p: any, decision: string) => store.api.ws("permission/answer", { permission_id: p.id, decision });
    return store.permissions.filter(p => p.chat_id === this.chatId).map(p => p.steps ? html`<div class="perm">
      <div class="row">${icon("list")}<b class="grow">LLMitMir ist noch nicht fertig – weitere ${p.steps.more} Schritte verwenden?</b></div>
      <div class="hint">${p.steps.used} von ${p.steps.limit} Schritten sind verbraucht. Ohne weitere Schritte bringt LLMitMir in den letzten ${p.steps.limit - p.steps.used} Schritten Wichtiges zu Ende und schreibt dann den Bericht.${p.steps.lots ? ` Mit ${p.steps.lots} weiteren Schritten wird die Frage so schnell nicht wieder fällig.` : ""}</div>
      <div class="row">
        <button class="btn primary" @click=${() => answer(p, "once")}>${icon("check", 16)} ${p.steps.more} weitere Schritte</button>
        ${p.steps.lots ? html`<button class="btn" @click=${() => answer(p, "lots")}>${icon("check", 16)} ${p.steps.lots} weitere Schritte</button>` : nothing}
        <button class="btn ghost" @click=${() => answer(p, "deny")}>Zum Ende kommen</button>
      </div></div>`
    : p.change ? html`<div class="perm">
      <div class="row">${icon("edit")}<b class="grow">LLMitMir schlägt diese Änderung vor</b></div>
      ${changeView(p.change)}
      <div class="row">
        <button class="btn primary ${p.change.aktion === "loeschen" ? "danger" : ""}" @click=${() => answer(p, "once")}>${icon("check", 16)} ${p.change.aktion === "loeschen" ? t("Löschen") : t("Übernehmen")}</button>
        <button class="btn ghost" @click=${() => answer(p, "deny")}>${t("Ablehnen")}</button>
      </div><div class="hint">Jede Änderung an Skills, Aufgaben und Zugängen fragt einzeln nach. Danach lässt sie sich jederzeit auf der Seite „${(CHANGE_ART[p.change.art] || [])[2] || ""}“ anpassen.</div></div>`
    : p.group ? html`<div class="perm">
      <div class="row">${icon(p.icon || "lock")}<b class="grow">LLMitMir möchte „${p.group_label}“ nutzen: ${p.label}</b></div>
      <div class="hint">Diese Werkzeuge sind ${this.chat?.project_id ? "in diesem Chat oder Projekt" : "in diesem Chat"} nicht eingeschaltet.</div>
      <pre>${JSON.stringify(p.args || {}, null, 2)}</pre>
      <div class="row">
        <button class="btn primary" @click=${() => answer(p, "once")}>${t("Einmal erlauben")}</button>
        <button class="btn" @click=${() => answer(p, "always")}>${t("Für diesen Chat einschalten")}</button>
        <button class="btn ghost danger" @click=${() => answer(p, "deny")}>${t("Ablehnen")}</button>
      </div><div class="hint">„Für diesen Chat einschalten“ gilt nur hier${this.chat?.kind === "chat" ? " und lässt sich im Werkzeug-Menü wieder abwählen" : ""}; schreibende Aktionen fragen weiterhin nach.</div></div>`
    : html`<div class="perm">
      <div class="row">${icon(p.icon || "lock")}<b class="grow">LLMitMir möchte: ${p.label}</b></div>
      <pre>${JSON.stringify(p.args || {}, null, 2)}</pre>
      <div class="row">
        <button class="btn primary" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "once" })}>${t("Einmal erlauben")}</button>
        <button class="btn" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "always" })}>${t("Immer erlauben")}</button>
        <button class="btn ghost danger" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "deny" })}>${t("Ablehnen")}</button>
      </div><div class="hint">„Immer erlauben“ gilt ${this.chat?.project_id ? "für dieses Projekt" : "für alle Chats ohne Projekt"} und lässt sich in den Einstellungen zurücknehmen.</div></div>`);
  }

  // ---------------------------------------------------------------- simple view (Laien-Ansicht)
  /** Only request and answer, like a messenger: tool steps, thoughts and intermediate texts stay hidden. */
  private simpleThread(chat: any, run: any) {
    const turns: { user: any; rest: any[] }[] = [];
    for (const m of chat.messages || []) {
      if (m.role === "user" || !turns.length) turns.push({ user: m.role === "user" ? m : null, rest: [] });
      if (m.role !== "user") turns[turns.length - 1].rest.push(m);
    }
    const out: any[] = [];
    let lastDay = "";
    turns.forEach((tn, i) => {
      const isLast = i === turns.length - 1;
      const live = !!run && isLast;
      const day = dayLabel((tn.user || tn.rest[0])?.created);
      if (day && day !== lastDay) { out.push(html`<div class="day">${day}</div>`); lastDay = day; }
      if (tn.user) {
        out.push(chat.kind === "task_run" && i === 0
          ? html`<div class="sys">${icon("task", 15)} Automatisch gestartet · ${hm(tn.user.created)}</div>`
          : this.meBubble(tn.user));
      }
      // newest first; an answer is an assistant message with text (or an error) that does not go on with tools
      const asst = [...tn.rest].reverse().filter((m: any) => m.role === "assistant");
      const isAnswer = (m: any) => m && (m.content || m.error) && !m.tool_calls?.length;
      const ans = live ? (isAnswer(asst[0]) ? asst[0] : null) : asst.find(isAnswer) || asst.find((m: any) => m.content);
      if (ans) out.push(this.aiBubble(ans, live, isLast && !run));
    });
    return out;
  }

  private meBubble(m: any) {
    const text = m.content && m.content !== "(siehe Anhang)" ? m.content : "";
    return html`<div class="bubble me">
      ${m.attachments?.length ? html`<div class="batt">${m.attachments.map((a: string) => html`<button @click=${() => this.openFile(a)}>${icon("file", 15)}<span class="ellipsis">${a}</span></button>`)}</div>` : nothing}
      ${text ? html`<div class="btxt">${text}</div>` : nothing}<span class="bt">${hm(m.created)}</span></div>`;
  }

  private aiBubble(m: any, streaming: boolean, last: boolean) {
    if (m.error) return html`<div class="bubble ai fail">
      <div><b>Das hat leider nicht geklappt.</b> ${plainError(m.error)}</div>
      ${plainError(m.error) !== m.error ? html`<details class="why"><summary>${icon("info", 15)} Was genau ist passiert?</summary><pre>${m.error}</pre></details>` : nothing}
      <div class="bfoot">${last ? html`<button class="btn" @click=${() => this.retry()}>${icon("retry", 16)} Noch einmal versuchen</button><span class="grow"></span>` : nothing}
        <span class="bt">${hm(m.created)}</span></div></div>`;
    return html`<div class="bubble ai">
      <div class="md">${md(m.content)}${streaming ? html`<span class="caret"></span>` : nothing}</div>
      ${streaming ? nothing : html`<div class="bfoot">
        <button class="mini" title=${t("Kopieren")} @click=${() => copyText(m.content)}>${icon("copy", 15)}</button>
        ${last ? html`<button class="mini" title="Neue Antwort" @click=${() => this.retry()}>${icon("retry", 15)}</button>` : nothing}
        <span class="bt">${hm(m.created)}</span></div>`}</div>`;
  }

  /** Waiting animation: typing dots and, in plain words, what is happening right now. */
  private typing(run: any, chat: any) {
    if (!run || run.status === "waiting_permission") return nothing;
    const last = chat.messages[chat.messages.length - 1];
    if (last?.role === "assistant" && (last.content || last.error) && !last.tool_calls?.length) return nothing;  // the answer is there
    const el = this.now / 1000 - (run.started || this.now / 1000);
    const d = run.detail || {};
    let text: string;
    if (run.status === "queued") text = "Gleich geht's los …";
    else if (run.status === "retry") text = "Gerade ist viel los – gleich geht's weiter …";
    else if (run.status === "quota_wait") text = `Tageslimit erreicht – weiter in ${fmtDuration(d.seconds)}`;
    else if (run.status === "tool") text = DOING[d.tool ? store.data?.tools?.[d.tool]?.group : d.model ? "model" : ""] || "Arbeitet daran …";
    else if (d.switched_from) text = "Wechselt zu einer weniger ausgelasteten KI …";
    else {
      const verbs = (d.step || 1) > 1 ? ["Wertet aus", "Denkt nach", "Fasst zusammen"] : ["Denkt nach", "Überlegt", "Formuliert eine Antwort"];
      text = verbs[Math.floor(el / 5) % verbs.length] + " …";
    }
    const slow = run.hint ? "Die KI ist gerade sehr gefragt – das kann ein paar Minuten dauern."
      : el > 45 || run.status === "retry" ? "Das dauert gerade etwas länger." : "";
    return html`<div class="bubble ai typing" role="status" aria-live="polite">
        <lm-spark size="20"></lm-spark><span class="dots"><i></i><i></i><i></i></span><span class="tstat shimmer">${text}</span></div>
      ${slow ? html`<div class="slowsys">${slow} Du kannst die Seite ruhig verlassen – die Antwort erscheint hier, sobald sie fertig ist.</div>` : nothing}`;
  }

  /** Questions from the assistant as plain yes/no messages; the details stay one tap away. */
  private simplePerms() {
    const answer = (p: any, decision: string) => store.api.ws("permission/answer", { permission_id: p.id, decision });
    return store.permissions.filter(p => p.chat_id === this.chatId).map(p => {
      if (p.change) {
        const del = p.change.aktion === "loeschen";
        const verb = ({ anlegen: "anlegen", aendern: "ändern", loeschen: "löschen" } as any)[p.change.aktion] || p.change.aktion;
        return html`<div class="bubble ai ask">
          <div>Soll ich ${CHANGE_WHAT[p.change.art] || p.change.art} <b>„${p.change.name}“</b> ${verb}?</div>
          ${p.change.hinweis ? html`<div class="hint">${icon("alert", 15)} ${p.change.hinweis}</div>` : nothing}
          <details class="why"><summary>${icon("eye", 15)} Genau ansehen</summary>${changeView(p.change)}</details>
          <div class="brow"><button class="btn primary ${del ? "danger" : ""}" @click=${() => answer(p, "once")}>${icon("check", 16)} Ja, ${del ? "löschen" : "übernehmen"}</button>
            <button class="btn" @click=${() => answer(p, "deny")}>Nein</button></div></div>`;
      }
      if (p.group) return html`<div class="bubble ai ask">
        <div>Darf ich dafür <b>${GROUP_PLAIN[p.group] || p.group_label}</b> benutzen?</div>
        <details class="why"><summary>${icon("eye", 15)} Was genau?</summary><div class="hint" style="margin-bottom:6px">${p.label}</div><pre>${JSON.stringify(p.args || {}, null, 2)}</pre></details>
        <div class="brow"><button class="btn primary" @click=${() => answer(p, "once")}>${icon("check", 16)} Ja</button>
          <button class="btn" @click=${() => answer(p, "always")}>Ja, in diesem Chat immer</button>
          <button class="btn ghost" @click=${() => answer(p, "deny")}>Nein</button></div></div>`;
      return html`<div class="bubble ai ask">
        <div>Darf ich das tun? <b>${p.label}</b></div>
        <details class="why"><summary>${icon("eye", 15)} Genau ansehen</summary><pre>${JSON.stringify(p.args || {}, null, 2)}</pre></details>
        <div class="brow"><button class="btn primary" @click=${() => answer(p, "once")}>${icon("check", 16)} Ja, diesmal</button>
          <button class="btn" @click=${() => answer(p, "always")}>Immer erlauben</button>
          <button class="btn ghost" @click=${() => answer(p, "deny")}>Nein</button></div>
        <div class="hint">„Immer erlauben“ lässt sich in den Einstellungen zurücknehmen.</div></div>`;
    });
  }

  private side(chat: any) {
    const files = store.chatFiles.get(chat.id) || [];
    const prog = chat.progress || [];
    // a finished run must not keep spinning: without a live run, a step marked "laeuft" is shown as done
    const live = !!store.runs[chat.id] || chat.status === "running";
    const status = (p: any) => (p.status === "laeuft" && !live ? "erledigt" : p.status);
    const proj = (store.data?.projects || []).find((p: any) => p.id === chat.project_id);
    const u = chat.usage || {};
    return html`<aside>
      ${this.narrow ? html`<div class="row"><b class="grow">Details</b><button class="iconbtn" @click=${() => (this.panel = false)}>${icon("close")}</button></div>` : nothing}
      <div><h3>${icon("list", 18)} ${t("Fortschritt")}</h3>
        ${prog.length ? html`<div class="prog">${prog.map((p: any) => { const st = status(p); return html`<div>
          ${st === "erledigt" ? html`<span class="ok">${icon("check", 18)}</span>` : st === "laeuft" ? html`<span class="spin"></span>`
            : st === "fehler" ? html`<span class="err">${icon("alert", 18)}</span>` : html`<span class="muted">${icon("mdi:circle-outline", 18)}</span>`}
          <span class=${st === "erledigt" ? "done" : ""}>${p.text}</span></div>`; })}</div>`
          : html`<div class="hint">Der Plan erscheint hier, sobald das Modell ihn anlegt.</div>`}</div>
      <div><h3>${icon("file", 18)} ${t("Dateien")}</h3>
        ${files.length ? files.map((f: any) => html`<div class="fl" @click=${() => this.openFile(f.name)}>${icon("file", 18)}<span class="grow ellipsis">${f.name}</span>
          <span class="muted" style="font-size:11.5px">${fmtNum(f.size)} B</span>${icon("download", 16)}</div>`) : html`<div class="hint">Noch keine Dateien.</div>`}</div>
      <div><h3>${icon("info", 18)} Info</h3><div class="hint" style="display:grid;gap:4px">
        ${proj ? html`<span>${t("Projekte")}: <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate(`/project/${proj.id}`); }}>${proj.name}</a></span>` : nothing}
        <span>${t("Modell")}: ${modelName(chat.model)}${chat.model_auto ? " (automatisch gewählt)" : ""}</span>
        <span>Anfragen: ${u.requests || 0} · Tokens: ${fmtNum((u.prompt || 0) + (u.completion || 0))}</span>
        <span>Erstellt: ${fmtTime(chat.created)}</span></div></div>
    </aside>`;
  }

  private async rename(v: string) {
    this.editTitle = false;
    if (v.trim() && v !== this.chat.title) await store.api.ws("chat/update", { chat_id: this.chatId, title: v.trim() });
  }

  render() {
    const chat = this.chat;
    if (!chat) return html`<div class="main"><div class="empty"><lm-spark></lm-spark><p>${t("Laden …")}</p></div></div>`;
    const run = store.runs[chat.id];
    const isWork = chat.kind !== "chat";
    const task = chat.task_id ? (store.data?.tasks || []).find((x: any) => x.id === chat.task_id) : null;
    const proj = (store.data?.projects || []).find((p: any) => p.id === chat.project_id);
    const simple = isSimple();
    const files = simple ? store.chatFiles.get(chat.id) || [] : [];
    return html`<div class="main">
      <header>
        <slot name="menu"></slot>
        ${this.editTitle ? html`<input .value=${chat.title || ""} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.rename((e.target as HTMLInputElement).value); if (e.key === "Escape") this.editTitle = false; }}
            @blur=${(e: any) => this.rename(e.target.value)} autofocus>`
          : html`<span class="title ellipsis" @click=${() => (this.editTitle = true)}>${chat.title || t("Neuer Chat")}</span>`}
        ${isWork && !(simple && chat.kind === "cowork") ? html`<span class="chip accent">${icon(chat.kind === "task_run" ? "task" : "cowork", 14)} ${chat.kind === "task_run" ? "Aufgabe" : "Cowork"}</span>` : nothing}
        ${proj && !this.narrow ? html`<span class="chip" style="cursor:pointer" @click=${() => navigate(`/project/${proj.id}`)}>${icon("project", 14)} ${proj.name}</span>` : nothing}
        <span class="grow"></span>
        ${files.length ? html`<lm-menu direction="down" align="right"><button slot="trigger" class="btn ghost" title=${t("Dateien")}>${icon("file", 18)}${this.narrow ? "" : ` ${t("Dateien")}`} <span class="chip">${files.length}</span></button>
          <div class="mh">Dateien in diesem Chat</div>
          ${files.map((f: any) => html`<button class="mi" data-close @click=${() => this.openFile(f.name)}>${icon("file", 18)}<span class="grow ellipsis">${f.name}</span>${icon("download", 16)}</button>`)}</lm-menu>` : nothing}
        ${isWork && this.narrow && !simple ? html`<button class="iconbtn" @click=${() => (this.panel = true)} title="Details">${icon("panel")}</button>` : nothing}
        <lm-menu direction="down" align="right"><button slot="trigger" class="iconbtn">${icon("dots")}</button>
          <button class="mi" data-close @click=${() => (this.editTitle = true)}>${icon("edit", 18)} ${t("Umbenennen")}</button>
          <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, pinned: !chat.pinned })}>${icon(chat.pinned ? "pinOff" : "pin", 18)} ${chat.pinned ? t("Lösen") : t("Anheften")}</button>
          <div class="mh">In Projekt verschieben</div>
          <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, project_id: null })}>${icon("chat", 18)} Ohne Projekt</button>
          ${(store.data?.projects || []).map((p: any) => html`<button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, project_id: p.id })}>${icon("project", 18)} ${p.name}</button>`)}
          <div class="msep"></div>
          <button class="mi" style="color:var(--lm-err)" data-close @click=${async () => { if (await confirmDialog("Diesen Chat endgültig löschen?")) { await store.api.ws("chat/delete", { chat_id: chat.id }); navigate("/"); } }}>${icon("trash", 18)} ${t("Löschen")}</button>
        </lm-menu>
      </header>
      <div class="scroll" @scroll=${this.onScroll}><div class="thread ${simple ? "simple" : ""}">
        ${task ? html`<div class="taskinfo">${icon("task", 18)}<span>${simple ? "Ergebnis" : "Lauf"} der geplanten Aufgabe <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate(`/task/${task.id}`); }}>${task.name}</a>.
          ${simple ? "Sie läuft von selbst nach Zeitplan." : "Open-Weight-Modelle können verzögert starten und länger laufen."}</span></div>` : nothing}
        ${chat.messages.length === 0 && !run ? html`<div class="empty">${simple ? "Schreib einfach los – die Antwort erscheint hier." : isWork ? "Beschreibe die Aufgabe – LLMitMir plant und arbeitet sie selbstständig ab." : "Schreib einfach los."}</div>` : nothing}
        ${simple ? this.simpleThread(chat, run) : this.renderMessages(chat, run)}
        ${simple ? this.simplePerms() : this.permCards()}
        ${simple ? this.typing(run, chat) : this.runIndicator(run, chat)}
      </div></div>
      <div class="foot">
        <lm-composer .simple=${simple} .mode=${chat.kind === "chat" ? "chat" : "cowork"} .model=${chat.model} .busy=${!!run} .chatUsage=${chat.usage}
          .tools=${chat.tools ?? null} .projectId=${chat.project_id}
          placeholder=${run ? "Antwort läuft – du kannst schon weiterschreiben …" : t("Antworten …")}
          @send=${this.send} @stop=${this.stop}></lm-composer>
        <div class="note">${chat.kind === "task_run" ? "Antworten in diesem Lauf laufen als normaler Cowork weiter." : "KI kann Fehler machen. Wichtiges bitte prüfen."}</div>
      </div>
    </div>
    ${isWork && !simple && !this.narrow ? this.side(chat) : nothing}
    ${isWork && !simple && this.narrow && this.panel ? html`<div class="sheet" @click=${(e: Event) => e.target === e.currentTarget && (this.panel = false)}>${this.side(chat)}</div>` : nothing}`;
  }
}
