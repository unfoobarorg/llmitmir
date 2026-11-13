// Benachrichtigungen auf der Startseite: Karten im Stil der Benachrichtigungen eines Smartphones.
// Kurz tippen öffnet den Quellchat, lange drücken schaltet den Quellchat stumm, „×“ oder Wischen entfernt die Karte.
import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { StoreElement, base, icon, fmtTime, safeElement } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";

const LONG_MS = 480;      // so lange drücken = Long Touch
const SWIPE_PX = 88;      // so weit wischen = entfernen

/** Kurzer Benachrichtigungston (zwei Töne, wie eine Systemmeldung) – ohne Datei, direkt im Browser erzeugt. */
let actx: AudioContext | null = null;
function tone() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    actx = actx || new AC();
    if (actx.state === "suspended") actx.resume().catch(() => undefined);
    const now = actx.currentTime;
    const play = (freq: number, start: number, dur: number, gain: number) => {
      const o = actx!.createOscillator(), g = actx!.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g).connect(actx!.destination);
      o.start(now + start); o.stop(now + start + dur + 0.02);
    };
    play(880, 0, 0.13, 0.16);
    play(1320, 0.11, 0.16, 0.12);
  } catch { /* kein Ton möglich – die Karte erscheint trotzdem */ }
}

@safeElement("lm-inbox")
export class Inbox extends StoreElement {
  @state() private menu: any = null;      // Long-Touch-Menü zu einer Karte
  @state() private drag: any = null;      // laufende Wischgeste
  private timer: any = null;
  private press: any = null;
  private pressTimer: any = null;
  private lastPing = 0;
  private seen = new Set<string>();

  static styles = [base, css`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; gap: 8px; margin: 0 0 18px; }
    .card-n { position: relative; display: flex; gap: 11px; align-items: flex-start; padding: 11px 12px 12px;
      border: 1px solid var(--lm-line); border-radius: 16px; background: var(--lm-panel); box-shadow: var(--lm-shadow);
      cursor: pointer; overflow: hidden; touch-action: pan-y; user-select: none; -webkit-user-select: none;
      animation: drop .28s cubic-bezier(.2,.9,.3,1.1); transition: transform .18s ease, opacity .18s ease; }
    .card-n:active { background: var(--lm-raise); }
    .card-n.gone { transform: translateX(-110%); opacity: 0; }
    .card-n .ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
      background: var(--lm-accent-soft); color: var(--lm-accent); margin-top: 1px; }
    .card-n .body { flex: 1; min-width: 0; }
    .card-n .top { display: flex; align-items: baseline; gap: 8px; }
    .card-n .app { font-size: 11.5px; letter-spacing: .02em; text-transform: uppercase; color: var(--lm-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-n .when { margin-left: auto; font-size: 11.5px; color: var(--lm-faint); flex: none; }
    .card-n .head { font-weight: 600; font-size: 14px; margin: 2px 0 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-n .txt { font-size: 13px; color: var(--lm-muted); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3;
      -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .card-n .x { flex: none; width: 26px; height: 26px; border: 0; background: none; color: var(--lm-faint); border-radius: 50%;
      cursor: pointer; display: grid; place-items: center; margin: -2px -4px 0 0; }
    .card-n .x:hover { background: var(--lm-hover); color: var(--lm-text); }
    .card-n.warn .ic { background: color-mix(in srgb, #d98324 22%, transparent); color: #d98324; }
    .more { display: flex; justify-content: center; margin: -8px 0 16px; }
    .more button { border: 0; background: none; color: var(--lm-muted); font-size: 12.5px; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
    .more button:hover { background: var(--lm-hover); color: var(--lm-text); }
    .sheet { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.35); display: flex; align-items: flex-end;
      justify-content: center; animation: fadeIn .15s; }
    .sheet .box { width: min(460px, 100%); background: var(--lm-panel); border: 1px solid var(--lm-line);
      border-radius: 18px 18px 0 0; padding: 8px; box-shadow: var(--lm-shadow); animation: up .2s ease; }
    .sheet .ttl { padding: 10px 12px 6px; font-size: 12.5px; color: var(--lm-muted); }
    .sheet button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; color: var(--lm-text);
      padding: 13px 12px; border-radius: 12px; font-size: 14.5px; cursor: pointer; text-align: left; }
    .sheet button:hover { background: var(--lm-hover); }
    .sheet button.danger { color: #d9534f; }
    @keyframes drop { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: none; } }
    @keyframes up { from { transform: translateY(18px); opacity: .6; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .card-n, .sheet, .sheet .box { animation: none; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    // Beim Öffnen der Startseite nicht klingeln – nur für Karten, die danach kommen
    this.lastPing = (store as any).inboxPing || 0;
    for (const e of (store as any).inbox || []) this.seen.add(e.id);
    // Anzeigedauer: Karten verschwinden auch ohne neuen Lauf, sobald ihre Zeit um ist
    this.timer = setInterval(() => this.requestUpdate(), 20000);
    window.addEventListener("pointerdown", this.wake, { passive: true });
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.timer);
    clearTimeout(this.pressTimer);
    window.removeEventListener("pointerdown", this.wake);
  }
  private wake = () => { if (actx?.state === "suspended") actx.resume().catch(() => undefined); };

  updated() {
    // Ton nur, wenn die Startseite gerade offen ist und wirklich etwas Neues kam
    const ping = (store as any).inboxPing || 0;
    if (ping && ping !== this.lastPing) {
      this.lastPing = ping;
      const fresh = (store as any).inbox.filter((e: any) => !this.seen.has(e.id));
      if (fresh.length && document.visibilityState === "visible") tone();
    }
    for (const e of (store as any).inbox || []) this.seen.add(e.id);
  }

  private items(): any[] {
    const mins = Number(store.data?.settings?.inbox_minutes ?? 30);
    const now = Date.now() / 1000;
    return ((store as any).inbox || []).filter((e: any) => !mins || now - Number(e.at || 0) <= mins * 60);
  }

  private async dismiss(e: any) {
    const el = this.renderRoot.querySelector(`[data-id="${e.id}"]`) as HTMLElement | null;
    el?.classList.add("gone");
    setTimeout(() => { store.api.ws("inbox/dismiss", { id: e.id }).catch(() => store.load()); }, 160);
  }
  private async muteChat(e: any) {
    this.menu = null;
    try { await store.api.ws("inbox/mute", { chat_id: e.chat_id, mute: true }); store.notify(t("Benachrichtigungen für diesen Chat aus")); }
    catch (err: any) { store.notify(err.message); }
  }
  private open(e: any) {
    this.menu = null;
    store.api.ws("inbox/dismiss", { id: e.id }).catch(() => undefined);
    navigate(`/chat/${e.chat_id}`);
  }

  // ---------------------------------------------------------------- Gesten
  private down(e: PointerEvent, item: any) {
    if ((e.target as HTMLElement).closest(".x")) return;
    // Zeiger an die Karte binden: die Geste endet auch, wenn er sie dabei verlässt
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* nicht überall erlaubt */ }
    this.press = { x: e.clientX, y: e.clientY, id: item.id, item, moved: false, long: false };
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      if (!this.press || this.press.moved) return;
      this.press.long = true;
      this.menu = item;
      try { navigator.vibrate?.(12); } catch { /* kein Vibrationsmotor */ }
    }, LONG_MS);
  }
  private move(e: PointerEvent) {
    const p = this.press;
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) p.moved = true;
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      clearTimeout(this.pressTimer);
      this.drag = { id: p.id, dx: Math.max(dx, -160) };
    }
  }
  private up(e: PointerEvent) {
    const p = this.press;
    this.press = null;
    if (!p) return;
    clearTimeout(this.pressTimer);
    const dx = this.drag?.id === p.id ? this.drag.dx : 0;
    this.drag = null;
    if (dx <= -SWIPE_PX) { this.dismiss(p.item); return; }
    if (p.long || p.moved) { this.requestUpdate(); return; }
    this.open(p.item);
  }

  render() {
    const items = this.items();
    if (!items.length) return nothing;
    return html`
      <div class="stack" role="log" aria-live="polite">
        ${items.map((e: any) => html`
          <div class="card-n ${e.status && e.status !== "done" ? "warn" : ""}" data-id=${e.id} role="button" tabindex="0"
            aria-label=${`${e.task || t("Geplante Aufgabe")}: ${e.title || ""}`}
            style=${this.drag?.id === e.id ? `transform: translateX(${this.drag.dx}px)` : ""}
            @pointerdown=${(ev: PointerEvent) => this.down(ev, e)}
            @pointermove=${(ev: PointerEvent) => this.move(ev)}
            @pointerup=${(ev: PointerEvent) => this.up(ev)}
            @pointercancel=${() => { this.press = null; this.drag = null; }}
            @keydown=${(ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.open(e); } }}
            @contextmenu=${(ev: Event) => ev.preventDefault()}>
            <span class="ic">${icon(e.status && e.status !== "done" ? "alert" : "bell", 17)}</span>
            <div class="body">
              <div class="top"><span class="app">${e.task || t("Geplante Aufgabe")}</span><span class="when">${fmtTime(e.at)}</span></div>
              <div class="head">${e.title || t("Fertig")}</div>
              <div class="txt">${e.text || ""}</div>
            </div>
            <button class="x" title=${t("Entfernen")} @click=${(ev: Event) => { ev.stopPropagation(); this.dismiss(e); }}>${icon("close", 15)}</button>
          </div>`)}
      </div>
      ${items.length > 1 ? html`<div class="more"><button @click=${() => this.clearAll()}>
        ${t("Alle {n} entfernen", { n: items.length })}</button></div>` : nothing}
      ${this.menu ? html`<div class="sheet" @click=${() => (this.menu = null)}>
        <div class="box" @click=${(ev: Event) => ev.stopPropagation()}>
          <div class="ttl">${this.menu.task || t("Geplante Aufgabe")}</div>
          <button @click=${() => this.open(this.menu)}>${icon("chat", 18)} ${t("Chat öffnen")}</button>
          <button class="danger" @click=${() => this.muteChat(this.menu)}>${icon("bellOff", 18)} ${t("Benachrichtigungen dieses Chats ausschalten")}</button>
          <button @click=${() => { const m = this.menu; this.menu = null; this.dismiss(m); }}>${icon("close", 18)} ${t("Nur diese entfernen")}</button>
        </div>
      </div>` : nothing}`;
  }

  private async clearAll() {
    try { await store.api.ws("inbox/clear"); } catch (e: any) { store.notify(e.message); }
  }
}
