// LLMitMir panel root: layout, sidebar, routing, event subscription.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { Api, store, navigate, isSimple } from "./api";
import { tokens, base, icon, fmtTime, menuItemStyles, confirmDialog, safeElement } from "./ui";
import { setLang, t } from "./i18n";
import "./composer";
import "./chat";
import "./pages";
import "./pages2";
import "./settings";

const LS = "llmitmir.sidebar";

@safeElement("llmitmir-panel")
export class LLMitMirPanel extends LitElement {
  @property({ attribute: false }) hass: any;
  @property({ type: Boolean }) narrow = false;
  @property({ attribute: false }) route: any;
  @property({ attribute: false }) panel: any;
  @property({ type: Boolean, reflect: true }) dark = false;
  @state() private access: any = null;
  @state() private drawer = false;
  @state() private collapsed = false;
  @state() private small = false;
  private unsub?: () => Promise<void>;
  private inited = false;
  private _onChange = () => this.requestUpdate();
  private _mq = matchMedia("(max-width: 870px)");
  private _onMq = () => { this.small = this._mq.matches; };
  private _onLoc = () => { this.drawer = false; this.requestUpdate(); };
  private _onAdmin = async () => { if (!this.access?.allowed) { this.inited = false; this.access = null; await this.init(); } };

  static styles = [tokens, base, menuItemStyles, css`
    /* Der Bildschirmrand (Statusleiste, Notch, Home-Indikator) gehört dem Panel: Home Assistant
       polstert eigene Panels seit 2026.8 nicht mehr, wenn sie ihn selbst freihalten
       (handle_safe_area). Sonst wäre die Seite höher als der Bildschirm und die oberste Zeile
       würde beim Scrollen halb aus dem Bild rutschen. */
    :host { display: block; box-sizing: border-box; height: 100vh; height: 100dvh; background: var(--lm-bg); position: relative; overflow: hidden;
      padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
      padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
      padding-left: var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
      padding-right: var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))); }
    .app { display: flex; height: 100%; }
    nav { width: 272px; flex: none; background: var(--lm-side); border-right: 1px solid var(--lm-line); display: flex; flex-direction: column;
      height: 100%; transition: width .22s ease, transform .25s ease; overflow: hidden; }
    nav.col { width: 60px; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 14px; min-height: 56px; }
    .brand b { font-family: var(--lm-head); font-size: 18px; font-weight: 700; letter-spacing: -.02em; white-space: nowrap; }
    .nv { display: grid; gap: 2px; padding: 4px 8px; }
    .ni { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 10px; cursor: pointer; color: var(--lm-text);
      font-size: 14px; border: 0; background: none; width: 100%; text-align: left; white-space: nowrap; min-height: 38px; transition: background .12s; }
    .ni:hover { background: var(--lm-hover); }
    .ni.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); font-weight: 550; }
    .ni.new { color: var(--lm-accent); font-weight: 560; }
    .ni.new .plus { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--lm-accent); color: var(--lm-on-accent); margin: -2px; }
    .ni .badge { margin-left: auto; font-size: 11px; background: var(--lm-accent-soft); color: var(--lm-accent); border-radius: 999px; padding: 1px 7px; }
    .recents { flex: 1; overflow-y: auto; padding: 6px 8px; min-height: 0; }
    .rh { font-size: 11.5px; color: var(--lm-faint); padding: 12px 10px 4px; font-weight: 550; }
    .rc { display: flex; align-items: center; gap: 6px; padding: 6px 4px 6px 10px; border-radius: 9px; cursor: pointer; font-size: 13.5px; color: var(--lm-text); }
    .rc .unread { font-weight: 600; }
    .rc .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lm-accent); flex: none; margin-right: 2px; }
    .rc:hover { background: var(--lm-hover); }
    .rc.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); }
    .rc .more { opacity: 0; } .rc:hover .more, .rc.on .more { opacity: 1; }
    .rc .more .iconbtn { width: 28px; height: 28px; }
    .pj { display: flex; align-items: center; gap: 2px; padding: 2px 6px 2px 0; border-radius: 9px; font-size: 13.5px; cursor: pointer; }
    .pj:hover { background: var(--lm-hover); } .pj.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); }
    .pj .chev { width: 26px; height: 26px; flex: none; } .pj .grow { display: flex; align-items: center; gap: 6px; padding: 5px 0; }
    .pjc { margin-left: 13px; padding-left: 8px; border-left: 1px solid var(--lm-line); }
    .pjc .rc { padding-left: 8px; }
    .more-all { color: var(--lm-muted); font-size: 12.5px; }
    .selstart { padding: 2px 8px 4px; }
    .selstart .btn { width: 100%; justify-content: center; font-size: 12.5px; min-height: 32px; color: var(--lm-muted); }
    .selbar { position: sticky; top: -6px; z-index: 3; display: flex; align-items: center; gap: 4px; margin: -6px -8px 6px;
      padding: 6px 8px; background: var(--lm-side); border-bottom: 1px solid var(--lm-line); }
    .selbar .btn { min-height: 30px; padding: 4px 9px; font-size: 12.5px; }
    .rc.sel { padding-left: 8px; }
    .box { width: 18px; height: 18px; flex: none; border-radius: 5px; border: 1.5px solid var(--lm-line); display: grid;
      place-items: center; color: var(--lm-on-accent); }
    .box.on { background: var(--lm-accent); border-color: var(--lm-accent); }
    .foot { border-top: 1px solid var(--lm-line); padding: 8px; display: flex; align-items: center; gap: 6px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--lm-text); color: var(--lm-bg); display: grid; place-items: center;
      font-weight: 600; font-size: 13px; flex: none; }
    main { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .view { overflow-x: hidden; }
    .topbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; min-height: 52px; }
    .view { flex: 1; min-height: 0; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.35); z-index: 15; animation: fadeIn .15s; }
    .small nav { position: absolute; z-index: 16; left: 0; top: 0; bottom: 0; transform: translateX(-100%); width: min(300px, 86vw); box-shadow: 10px 0 40px rgba(0,0,0,.18); }
    .small nav.open { transform: none; }
    .toast { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); background: var(--lm-text); color: var(--lm-bg);
      padding: 10px 16px; border-radius: 12px; font-size: 14px; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: fadeIn .2s; max-width: 90vw; }
    .deny { display: grid; place-items: center; height: 100%; text-align: center; padding: 24px; }
    .deny .card { max-width: 440px; }
    /* Chats per Ziehen in ein Projekt verschieben */
    .rc { touch-action: pan-y; }
    .rc.drag { opacity: .45; }
    .pj.drop, .rc.drop { background: var(--lm-accent-soft); outline: 1.5px dashed var(--lm-accent); outline-offset: -1.5px; }
    .rc.dropzone { color: var(--lm-muted); border: 1px dashed var(--lm-line); margin: 2px 0 6px; }
    .rc.dropzone.drop { color: var(--lm-accent); border-color: transparent; }
    .sheet { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,.35); display: flex; align-items: flex-end;
      justify-content: center; animation: fadeIn .15s; }
    .sheetcard { width: min(420px, 100%); max-height: 70%; overflow-y: auto; background: var(--lm-raise); border: 1px solid var(--lm-line);
      border-radius: 16px 16px 0 0; padding: 12px; display: grid; gap: 2px; box-shadow: 0 -10px 40px rgba(0,0,0,.2); }
    .dragghost { position: fixed; z-index: 60; pointer-events: none; transform: translate(-50%, -150%); max-width: 240px;
      display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; font-size: 13px;
      background: var(--lm-raise); color: var(--lm-text); border: 1px solid var(--lm-line); box-shadow: var(--lm-shadow); }
    .col .lbl, .col .recents, .col .selstart, .col .foot .name, .col .brand b, .col .badge { display: none; }
    .col .ni { justify-content: center; padding: 8px; }
    .col .foot { flex-direction: column; }
  `];

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener("change", this._onChange);
    window.addEventListener("location-changed", this._onLoc);
    window.addEventListener("llmitmir-admin-saved", this._onAdmin);
    this._mq.addEventListener("change", this._onMq); this.small = this._mq.matches;
    try { this.collapsed = localStorage.getItem(LS) === "1"; } catch { /* storage blocked */ }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    store.removeEventListener("change", this._onChange);
    window.removeEventListener("location-changed", this._onLoc);
    window.removeEventListener("llmitmir-admin-saved", this._onAdmin);
    this._mq.removeEventListener("change", this._onMq);
    this.unsub?.(); this.unsub = undefined; this.inited = false;
    this.detachDrag(); this.drag = null; this.dragFrom = null;
  }

  updated(ch: Map<string, any>) {
    // the list shrank (deleted elsewhere): selection mode is no longer offered
    if (this.selecting && !this.canSelect) this.stopSelecting();
    if (ch.has("hass") && this.hass) {
      this.dark = !!this.hass.themes?.darkMode;
      if (store.data) store.data.__dark = this.dark;
      if (store.api) store.api.hass = this.hass;
      if (!this.inited) this.init();
    }
  }

  private async init() {
    this.inited = true;
    setLang(this.hass.language);
    store.api = new Api(this.hass);
    try {
      this.access = await store.api.ws("access");
      if (!this.access.allowed) return;
      await store.load();
      await this.subscribe();
      this.hass.connection.addEventListener("ready", async () => { await store.load(); await this.subscribe(); });
    } catch (e: any) { store.error = String(e?.message || e); this.requestUpdate(); }
  }
  private async subscribe() {
    try { await this.unsub?.(); } catch { /* connection gone */ }
    this.unsub = await store.api.subscribe((e: any) => store.handle(e));
  }

  private get path(): string[] { return (this.route?.path || "/").split("/").filter(Boolean); }

  private toggleCollapse() {
    if (this.small) { this.drawer = !this.drawer; return; }
    this.collapsed = !this.collapsed;
    try { localStorage.setItem(LS, this.collapsed ? "1" : "0"); } catch { /* ignore */ }
  }

  private haMenu() { this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })); }

  private menuBtn() {
    return this.small || this.collapsed ? html`<button class="iconbtn" slot="menu" title="Menü" @click=${() => (this.small ? (this.drawer = true) : this.toggleCollapse())}>${icon(this.small ? "menu" : "sidebar")}</button>` : nothing;
  }

  @state() private openProjects: Set<string> = (() => { try { return new Set(JSON.parse(localStorage.getItem("llmitmir.openProjects") || "[]")); } catch { return new Set(); } })();
  private toggleProject(id: string) {
    const s = new Set(this.openProjects); s.has(id) ? s.delete(id) : s.add(id); this.openProjects = s;
    try { localStorage.setItem("llmitmir.openProjects", JSON.stringify([...s])); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- Chats verschieben (Ziehen und langes Halten)
  @state() private drag: { chatId: string; title: string; x: number; y: number; over: string | null } | null = null;
  @state() private moveSheet: any = null;   // Handy: langes Halten öffnet die Projektauswahl
  private dragFrom: { x: number; y: number; chat: any } | null = null;
  private dragTimer: any = null;
  private clickTimer: any = null;
  private touchCancel: ((ev: PointerEvent) => void) | null = null;
  private suppressClick = false;

  /** Zeiger auf einer Chat-Zeile: mit der Maus ziehen, auf dem Handy lange halten. */
  private dragStart(e: PointerEvent, c: any) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("lm-menu, button")) return;
    this.detachDrag();
    if (e.pointerType === "touch") {
      // Ziehen und Scrollen kommen sich auf dem Handy in die Quere: dort öffnet langes
      // Halten dieselbe Auswahl, ein Tippen darin verschiebt den Chat.
      const x = e.clientX, y = e.clientY;
      this.dragTimer = setTimeout(() => {
        this.skipClick();
        this.moveSheet = c;
      }, 420);
      const cancel = (ev: PointerEvent) => {
        if (ev.type === "pointermove" && Math.hypot(ev.clientX - x, ev.clientY - y) < 10) return;
        this.detachDrag();
      };
      this.touchCancel = cancel;
      window.addEventListener("pointermove", cancel);
      window.addEventListener("pointerup", cancel);
      window.addEventListener("pointercancel", cancel);
      return;
    }
    this.dragFrom = { x: e.clientX, y: e.clientY, chat: c };
    window.addEventListener("pointermove", this.onDragMove);
    window.addEventListener("pointerup", this.onDragEnd);
    window.addEventListener("pointercancel", this.onDragEnd);
  }

  /** Der Klick, der auf Loslassen oder langes Halten folgt, soll den Chat nicht öffnen. */
  private skipClick() {
    this.suppressClick = true;
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => (this.suppressClick = false), 800);
  }

  private detachDrag() {
    clearTimeout(this.dragTimer);
    window.removeEventListener("pointermove", this.onDragMove);
    window.removeEventListener("pointerup", this.onDragEnd);
    window.removeEventListener("pointercancel", this.onDragEnd);
    if (this.touchCancel) {
      window.removeEventListener("pointermove", this.touchCancel);
      window.removeEventListener("pointerup", this.touchCancel);
      window.removeEventListener("pointercancel", this.touchCancel);
      this.touchCancel = null;
    }
  }

  private beginDrag(chat: any, x: number, y: number) {
    this.drag = { chatId: chat.id, title: chat.title || t("Neuer Chat"), x, y, over: null };
  }

  private onDragMove = (e: PointerEvent) => {
    const f = this.dragFrom;
    if (!f) return;
    if (!this.drag) {
      if (Math.hypot(e.clientX - f.x, e.clientY - f.y) < 8) return;   // noch ein Tippen, kein Ziehen
      this.beginDrag(f.chat, e.clientX, e.clientY);
    }
    e.preventDefault();
    this.drag = { ...this.drag!, x: e.clientX, y: e.clientY, over: this.dropTargetAt(e.clientX, e.clientY) };
  };

  /** Ziel unter dem Zeiger: Projekt-ID, "none" (ohne Projekt) oder null. */
  private dropTargetAt(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const hit = el?.closest("[data-drop]") as HTMLElement | null;
    return hit?.dataset.drop ?? null;
  }

  private onDragEnd = async () => {
    this.detachDrag();
    const d = this.drag;
    this.dragFrom = null;
    if (!d) return;
    this.drag = null;
    this.skipClick();
    if (d.over) await this.moveChat(d.chatId, d.over === "none" ? null : d.over);
  };

  private openChat(id: string) {
    if (this.suppressClick) { this.suppressClick = false; return; }
    navigate(`/chat/${id}`);
  }

  private async moveChat(chatId: string, pid: string | null) {
    const chat = (store.data?.chats || []).find((c: any) => c.id === chatId);
    if (!chat || (chat.project_id || null) === pid) return;
    try {
      await store.api.ws("chat/update", { chat_id: chatId, project_id: pid });
      const name = (store.data?.projects || []).find((p: any) => p.id === pid)?.name;
      store.notify(pid ? t("Nach „{p}“ verschoben", { p: name || "" }) : t("Aus dem Projekt entfernt"));
    } catch (e: any) { store.notify(String(e?.message || e)); }
  }

  /** Auswahl zum Verschieben (Handy und Menü der Chat-Zeile). */
  private moveSheetView() {
    const c = this.moveSheet;
    const projects = store.data?.projects || [];
    return html`<div class="sheet" @click=${(e: Event) => e.target === e.currentTarget && (this.moveSheet = null)}>
      <div class="sheetcard">
        <div class="row"><b class="grow ellipsis">${t("Chat verschieben")}</b>
          <button class="iconbtn" @click=${() => (this.moveSheet = null)}>${icon("close", 18)}</button></div>
        <div class="hint ellipsis" style="margin-bottom:6px">${c?.title || t("Neuer Chat")}</div>
        <button class="mi" @click=${() => { this.moveSheet = null; this.moveChat(c.id, null); }}>${icon("chat", 18)} ${t("Ohne Projekt")}</button>
        ${projects.map((p: any) => html`<button class="mi ${c?.project_id === p.id ? "sel" : ""}" @click=${() => { this.moveSheet = null; this.moveChat(c.id, p.id); }}>
          ${icon("project", 18)} <span class="grow ellipsis">${p.name}</span>${c?.project_id === p.id ? icon("check", 16) : nothing}</button>`)}
        ${!projects.length ? html`<div class="hint" style="padding:8px 10px">${t("Noch keine Projekte angelegt.")}</div>` : nothing}
      </div></div>`;
  }

  // ---------------------------------------------------------------- multi-select (only offered for long lists)
  private static readonly SELECT_FROM = 10;  // more than this many chats -> selection mode is offered
  @state() private selecting = false;
  @state() private selected: Set<string> = new Set();

  private get selectableChats(): any[] {
    return (store.data?.chats || []).filter((c: any) => c.kind !== "task_run");
  }
  private get canSelect(): boolean { return this.selectableChats.length > LLMitMirPanel.SELECT_FROM; }

  private startSelecting() { this.selecting = true; this.selected = new Set(); }
  private stopSelecting() { this.selecting = false; this.selected = new Set(); }
  private toggleSelect(id: string) {
    const s = new Set(this.selected); s.has(id) ? s.delete(id) : s.add(id); this.selected = s;
  }
  private selectAll() {
    const all = this.selectableChats.map((c: any) => c.id);
    this.selected = this.selected.size === all.length ? new Set() : new Set(all);
  }
  private async deleteSelected() {
    const ids = [...this.selected];
    if (!ids.length) return;
    const n = ids.length;
    const ok = await confirmDialog(n === 1 ? t("Diesen Chat löschen?") : t("{n} Chats löschen?", { n }));
    if (!ok) return;
    try {
      await store.api.ws("chat/delete_many", { chat_ids: ids });
      if (this.path[0] === "chat" && ids.includes(this.path[1])) navigate("/");
      store.notify(n === 1 ? t("Chat gelöscht") : t("{n} Chats gelöscht", { n }));
    } catch (e: any) { store.notify(String(e?.message || e)); }
    this.stopSelecting();
  }

  private selectStart() {
    if (!this.canSelect) return nothing;
    return html`<div class="selstart"><button class="btn ghost" @click=${() => this.startSelecting()}>
      ${icon("list", 16)} ${t("Chats auswählen")}</button></div>`;
  }

  private selectionBar() {
    const total = this.selectableChats.length, n = this.selected.size;
    return html`<div class="selbar">
      <button class="iconbtn" title=${t("Abbrechen")} @click=${() => this.stopSelecting()}>${icon("close", 18)}</button>
      <span class="grow ellipsis" style="font-size:12.5px">${n ? t("{n} ausgewählt", { n }) : t("Chats auswählen")}</span>
      <button class="btn ghost" @click=${() => this.selectAll()}>${n === total ? t("Keine") : t("Alle")}</button>
      <button class="btn danger" ?disabled=${!n} @click=${() => this.deleteSelected()}>${icon("trash", 16)} ${t("Löschen")}</button>
    </div>`;
  }

  private selectRow(c: any) {
    const on = this.selected.has(c.id);
    return html`<div class="rc sel ${on ? "on" : ""}" @click=${() => this.toggleSelect(c.id)}>
      <span class="box ${on ? "on" : ""}">${on ? icon("check", 14) : nothing}</span>
      <span class="grow ellipsis">${c.title || t("Neuer Chat")}</span>
      ${c.project_id ? html`<span class="muted" title=${t("Projekte")}>${icon("project", 13)}</span>` : nothing}
    </div>`;
  }

  private projectTree() {
    const d = store.data; if (!d?.projects?.length) return nothing;
    const cur = this.path[0] === "chat" ? this.path[1] : "";
    const curProj = this.path[0] === "project" ? this.path[1] : (d.chats.find((c: any) => c.id === cur)?.project_id || "");
    const chatsOf = (pid: string) => d.chats.filter((c: any) => c.project_id === pid && c.kind !== "task_run");
    const sorted = [...d.projects].sort((a: any, b: any) => {
      const la = chatsOf(a.id)[0]?.updated || a.updated || 0, lb = chatsOf(b.id)[0]?.updated || b.updated || 0; return lb - la; });
    return html`<div class="rh">${t("Projekte")}</div>
      ${sorted.map((p: any) => {
        const open = this.openProjects.has(p.id) || p.id === curProj;
        const list = chatsOf(p.id);
        return html`<div class="pj ${p.id === curProj && this.path[0] === "project" ? "on" : ""} ${this.drag?.over === p.id ? "drop" : ""}"
            data-drop=${p.id} title=${t("Chat hierher ziehen")}>
            <button class="iconbtn chev" @click=${(e: Event) => { e.stopPropagation(); this.toggleProject(p.id); }} title=${open ? "Zuklappen" : "Aufklappen"}>${icon(open ? "down" : "right", 16)}</button>
            <span class="grow ellipsis" @click=${() => navigate(`/project/${p.id}`)}>${icon("project", 16)} ${p.name}</span>
            ${list.some((c: any) => store.runs[c.id]) ? html`<lm-spark size="13"></lm-spark>` : nothing}</div>
          ${open ? html`<div class="pjc">${list.slice(0, 8).map((c: any) => this.chatRow(c, cur))}
            ${list.length > 8 ? html`<div class="rc more-all" @click=${() => navigate(`/project/${p.id}`)}>${t("Alle anzeigen")} (${list.length})</div>` : nothing}
            ${!list.length ? html`<div class="hint" style="padding:4px 10px 6px 30px">Noch keine Chats</div>` : nothing}</div>` : nothing}`;
      })}`;
  }

  /** Neues Ergebnis, seit der Chat zuletzt offen war? (Punkt in der Liste) */
  private unread(c: any): boolean {
    if (!c?.updated || c.id === (this.path[0] === "chat" ? this.path[1] : "")) return false;
    return (c.updated || 0) > (c.last_seen || 0) + 1;
  }

  private chatRow(c: any, cur: string) {
    const unread = this.unread(c);
    const projects = store.data?.projects || [];
    return html`<div class="rc ${c.id === cur ? "on" : ""} ${this.drag?.chatId === c.id ? "drag" : ""}"
        @click=${() => this.openChat(c.id)} @pointerdown=${(e: PointerEvent) => this.dragStart(e, c)}>
      ${store.runs[c.id] ? html`<lm-spark size="14"></lm-spark>` : c.kind === "cowork" ? html`<span class="muted">${icon("cowork", 15)}</span>` : nothing}
      <span class="grow ellipsis ${unread ? "unread" : ""}">${c.title || t("Neuer Chat")}</span>
      ${unread ? html`<span class="dot" title=${t("Neu seit deinem letzten Blick")}></span>` : nothing}
      <lm-menu class="more" direction="down" align="right" @click=${(e: Event) => e.stopPropagation()}><button slot="trigger" class="iconbtn">${icon("dots", 16)}</button>
        <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: c.id, pinned: !c.pinned })}>${icon(c.pinned ? "pinOff" : "pin", 18)} ${c.pinned ? t("Lösen") : t("Anheften")}</button>
        ${projects.length ? html`<div class="mh">${t("In Projekt verschieben")}</div>
          <button class="mi" data-close @click=${() => this.moveChat(c.id, null)}>${icon("chat", 18)} ${t("Ohne Projekt")}</button>
          ${projects.map((p: any) => html`<button class="mi ${c.project_id === p.id ? "sel" : ""}" data-close @click=${() => this.moveChat(c.id, p.id)}>${icon("project", 18)} ${p.name}</button>`)}` : nothing}
        <div class="msep"></div>
        <button class="mi" style="color:var(--lm-err)" data-close @click=${async () => { if (await confirmDialog(`„${c.title}“ löschen?`)) { await store.api.ws("chat/delete", { chat_id: c.id }); if (c.id === cur) navigate("/"); } }}>${icon("trash", 18)} ${t("Löschen")}</button>
      </lm-menu></div>`;
  }

  private recents() {
    const d = store.data; if (!d) return nothing;
    if (this.selecting) {
      const all = [...this.selectableChats].sort((a: any, b: any) => (b.updated || 0) - (a.updated || 0));
      return html`${this.selectionBar()}${all.map((c: any) => this.selectRow(c))}`;
    }
    const cur = this.path[0] === "chat" ? this.path[1] : "";
    const items = d.chats.filter((c: any) => c.kind !== "task_run");
    const pinned = items.filter((c: any) => c.pinned);
    // chats of projects appear under their project above; "Zuletzt" shows the rest
    const rest = items.filter((c: any) => !c.pinned && !c.project_id).slice(0, 40);
    const row = (c: any) => this.chatRow(c, cur);
    const zone = this.drag ? html`<div class="rc dropzone ${this.drag.over === "none" ? "drop" : ""}" data-drop="none">
      ${icon("chat", 15)}<span class="grow ellipsis">${t("Ohne Projekt")}</span></div>` : nothing;
    return html`${pinned.length ? html`<div class="rh">${t("Angeheftet")}</div>${pinned.map(row)}` : nothing}
      <div class="rh">${t("Zuletzt")}</div>${zone}${rest.length ? rest.map(row) : html`<div class="hint" style="padding:4px 10px">${t("Keine Chats")}</div>`}`;
  }

  private sidebar() {
    const d = store.data; const p = this.path[0] || "";
    const running = Object.keys(store.runs).length;
    const q = d?.queue || {};
    const taskBusy = (q.running ? 1 : 0) + Object.keys(q.position || {}).length;
    const ni = (route: string, ic: string, label: string, active: boolean, badge?: any) =>
      html`<button class="ni ${active ? "on" : ""}" title=${label} @click=${() => navigate(route)}>${icon(ic)}<span class="lbl">${label}</span>${badge ? html`<span class="badge">${badge}</span>` : nothing}</button>`;
    return html`<nav class="${this.collapsed && !this.small ? "col" : ""} ${this.drawer ? "open" : ""}">
      <div class="brand">${this.small ? html`<button class="iconbtn" title="Home Assistant" @click=${this.haMenu}>${icon("mdi:home-assistant")}</button>` : nothing}
        <lm-spark size="22" .active=${running > 0}></lm-spark><b class="grow">LLMitMir</b>
        <button class="iconbtn" title="Seitenleiste" @click=${this.toggleCollapse}>${icon(this.small ? "close" : "sidebar")}</button></div>
      <div class="nv">
        <button class="ni new" title=${t("Neuer Chat")} @click=${() => navigate("/")}><span class="plus">${icon("plus", 18)}</span><span class="lbl">${t("Neuer Chat")}</span></button>
        ${isSimple() ? nothing : ni("/cowork", "cowork", t("Neues Cowork"), p === "cowork")}
        ${ni("/chats", "chat", t("Chats"), p === "chats")}
        ${ni("/projects", "project", t("Projekte"), p === "projects" || p === "project")}
        ${ni("/tasks", "task", isSimple() ? t("Geplante Aufgaben") : t("Geplant"), p === "tasks" || p === "task", taskBusy || null)}
        ${ni("/skills", "skill", t("Skills"), p === "skills" || p === "skill")}
        ${ni("/credentials", "key", t("Zugänge"), p === "credentials" || p === "credential")}
      </div>
      ${this.selecting ? nothing : this.selectStart()}
      <div class="recents">${this.selecting ? nothing : this.projectTree()}${this.recents()}</div>
      <div class="foot"><span class="avatar">${(d?.user?.name || "?").slice(0, 1).toUpperCase()}</span>
        <span class="name grow ellipsis" style="font-size:13.5px">${d?.user?.name}</span>
        ${d?.user?.is_admin ? html`<button class="iconbtn ${p === "admin" ? "on" : ""}" title=${t("Admin")} @click=${() => navigate("/admin")}>${icon("admin")}</button>` : nothing}
        <button class="iconbtn ${p === "settings" ? "on" : ""}" title=${t("Einstellungen")} @click=${() => navigate("/settings")}>${icon("settings")}</button></div>
    </nav>`;
  }

  private view() {
    const [p, id] = this.path;
    switch (p) {
      case "chat": return html`<lm-chat .chatId=${id} .narrow=${this.small}>${this.menuBtn()}</lm-chat>`;
      case "cowork": return this.wrap(html`<lm-home initialMode=${isSimple() ? "chat" : "cowork"}></lm-home>`);
      case "chats": return this.wrap(html`<lm-chats></lm-chats>`);
      case "projects": return this.wrap(html`<lm-projects></lm-projects>`);
      case "project": return this.wrap(html`<lm-project .projectId=${id}></lm-project>`);
      case "tasks": return this.wrap(html`<lm-tasks></lm-tasks>`);
      case "task": return this.wrap(html`<lm-task .taskId=${id}></lm-task>`);
      case "skills": return this.wrap(html`<lm-skills></lm-skills>`);
      case "skill": return this.wrap(html`<lm-skill .skillId=${id}></lm-skill>`);
      case "credentials": return this.wrap(html`<lm-credentials></lm-credentials>`);
      case "credential": return this.wrap(html`<lm-credential .credId=${id}></lm-credential>`);
      case "settings": return this.wrap(html`<lm-settings></lm-settings>`);
      case "admin": return this.wrap(html`<lm-admin></lm-admin>`);
      default: return this.wrap(html`<lm-home initialMode="chat"></lm-home>`);
    }
  }
  private wrap(content: any) {
    return html`${this.small || this.collapsed ? html`<div class="topbar">${this.menuBtn()}</div>` : nothing}<div class="view">${content}</div>`;
  }

  render() {
    if (!this.access) return html`<div class="deny"><lm-spark size="32"></lm-spark></div>`;
    if (!this.access.allowed) {
      const admin = this.access.is_admin;
      return html`<div class="deny"><div class="card"><lm-spark size="30" .active=${false}></lm-spark><h2>${t("Kein Zugriff")}</h2>
        <p class="hint">${admin ? "Du bist Admin, aber für LLMitMir noch nicht freigeschaltet. Lege fest, wer es nutzen darf – auch dich selbst." : "Bitte die Person, die Home Assistant verwaltet, dich für LLMitMir freizuschalten."}</p>
        ${admin ? html`<lm-admin></lm-admin>` : nothing}</div></div>`;
    }
    if (store.error && !store.data) return html`<div class="deny"><div class="card">${icon("alert")} ${store.error}</div></div>`;
    if (!store.data) return html`<div class="deny"><lm-spark size="32"></lm-spark></div>`;
    return html`<div class="app ${this.small ? "small" : ""}">
      ${this.sidebar()}
      ${this.small && this.drawer ? html`<div class="backdrop" @click=${() => (this.drawer = false)}></div>` : nothing}
      <main>${this.view()}</main></div>
      ${this.moveSheet ? this.moveSheetView() : nothing}
      ${this.drag ? html`<div class="dragghost" style="left:${this.drag.x}px;top:${this.drag.y}px">${icon("chat", 15)}
        <span class="ellipsis">${this.drag.title}</span></div>` : nothing}
      ${store.toast ? html`<div class="toast">${store.toast}</div>` : nothing}`;
  }
}

export { fmtTime };
