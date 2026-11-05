// LLMitMir panel root: layout, sidebar, routing, event subscription.
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Api, store, navigate } from "./api";
import { tokens, base, icon, fmtTime, menuItemStyles, confirmDialog } from "./ui";
import { setLang, t } from "./i18n";
import "./composer";
import "./chat";
import "./pages";
import "./pages2";
import "./settings";

const LS = "llmitmir.sidebar";

@customElement("llmitmir-panel")
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
    :host { display: block; height: 100%; background: var(--lm-bg); position: relative; overflow: hidden; }
    .app { display: flex; height: 100%; }
    nav { width: 272px; flex: none; background: var(--lm-side); border-right: 1px solid var(--lm-line); display: flex; flex-direction: column;
      height: 100%; transition: width .22s ease, transform .25s ease; overflow: hidden; }
    nav.col { width: 60px; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 14px; min-height: 56px; }
    .brand b { font-family: var(--lm-serif); font-size: 19px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; }
    .nv { display: grid; gap: 2px; padding: 4px 8px; }
    .ni { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 10px; cursor: pointer; color: var(--lm-text);
      font-size: 14px; border: 0; background: none; width: 100%; text-align: left; white-space: nowrap; min-height: 38px; transition: background .12s; }
    .ni:hover { background: var(--lm-hover); }
    .ni.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); font-weight: 550; }
    .ni.new { color: var(--lm-accent); font-weight: 560; }
    .ni.new .plus { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--lm-accent); color: #fff; margin: -2px; }
    .ni .badge { margin-left: auto; font-size: 11px; background: var(--lm-accent-soft); color: var(--lm-accent); border-radius: 999px; padding: 1px 7px; }
    .recents { flex: 1; overflow-y: auto; padding: 6px 8px; min-height: 0; }
    .rh { font-size: 11.5px; color: var(--lm-faint); padding: 12px 10px 4px; font-weight: 550; }
    .rc { display: flex; align-items: center; gap: 6px; padding: 6px 4px 6px 10px; border-radius: 9px; cursor: pointer; font-size: 13.5px; color: var(--lm-text); }
    .rc:hover { background: var(--lm-hover); }
    .rc.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); }
    .rc .more { opacity: 0; } .rc:hover .more, .rc.on .more { opacity: 1; }
    .rc .more .iconbtn { width: 28px; height: 28px; }
    .foot { border-top: 1px solid var(--lm-line); padding: 8px; display: flex; align-items: center; gap: 6px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--lm-text); color: var(--lm-bg); display: grid; place-items: center;
      font-weight: 600; font-size: 13px; flex: none; }
    main { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; position: relative; }
    .topbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; min-height: 52px; }
    .view { flex: 1; min-height: 0; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.35); z-index: 15; animation: fadeIn .15s; }
    .small nav { position: absolute; z-index: 16; left: 0; top: 0; bottom: 0; transform: translateX(-100%); width: min(300px, 86vw); box-shadow: 10px 0 40px rgba(0,0,0,.18); }
    .small nav.open { transform: none; }
    .toast { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); background: var(--lm-text); color: var(--lm-bg);
      padding: 10px 16px; border-radius: 12px; font-size: 14px; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: fadeIn .2s; max-width: 90vw; }
    .deny { display: grid; place-items: center; height: 100%; text-align: center; padding: 24px; }
    .deny .card { max-width: 440px; }
    .col .lbl, .col .recents, .col .foot .name, .col .brand b, .col .badge { display: none; }
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
  }

  updated(ch: Map<string, any>) {
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

  private recents() {
    const d = store.data; if (!d) return nothing;
    const cur = this.path[0] === "chat" ? this.path[1] : "";
    const items = d.chats.filter((c: any) => c.kind !== "task_run");
    const pinned = items.filter((c: any) => c.pinned);
    const rest = items.filter((c: any) => !c.pinned).slice(0, 40);
    const row = (c: any) => html`<div class="rc ${c.id === cur ? "on" : ""}" @click=${() => navigate(`/chat/${c.id}`)}>
      ${store.runs[c.id] ? html`<lm-spark size="14"></lm-spark>` : c.kind === "cowork" ? html`<span class="muted">${icon("cowork", 15)}</span>` : nothing}
      <span class="grow ellipsis">${c.title || t("Neuer Chat")}</span>
      <lm-menu class="more" direction="down" align="right" @click=${(e: Event) => e.stopPropagation()}><button slot="trigger" class="iconbtn">${icon("dots", 16)}</button>
        <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: c.id, pinned: !c.pinned })}>${icon(c.pinned ? "pinOff" : "pin", 18)} ${c.pinned ? t("Lösen") : t("Anheften")}</button>
        <button class="mi" style="color:var(--lm-err)" data-close @click=${async () => { if (await confirmDialog(`„${c.title}“ löschen?`)) { await store.api.ws("chat/delete", { chat_id: c.id }); if (c.id === cur) navigate("/"); } }}>${icon("trash", 18)} ${t("Löschen")}</button>
      </lm-menu></div>`;
    return html`${pinned.length ? html`<div class="rh">${t("Angeheftet")}</div>${pinned.map(row)}` : nothing}
      <div class="rh">${t("Zuletzt")}</div>${rest.length ? rest.map(row) : html`<div class="hint" style="padding:4px 10px">${t("Keine Chats")}</div>`}`;
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
        ${ni("/cowork", "cowork", t("Neues Cowork"), p === "cowork")}
        ${ni("/chats", "chat", t("Chats"), p === "chats")}
        ${ni("/projects", "project", t("Projekte"), p === "projects" || p === "project")}
        ${ni("/tasks", "task", t("Geplant"), p === "tasks" || p === "task", taskBusy || null)}
        ${ni("/skills", "skill", t("Skills"), p === "skills" || p === "skill")}
        ${ni("/credentials", "key", t("Zugänge"), p === "credentials" || p === "credential")}
      </div>
      <div class="recents">${this.recents()}</div>
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
      case "cowork": return this.wrap(html`<lm-home initialMode="cowork"></lm-home>`);
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
      ${store.toast ? html`<div class="toast">${store.toast}</div>` : nothing}`;
  }
}

export { fmtTime };
