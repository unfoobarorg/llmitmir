// Konnektoren: vom Admin vorbereitete Anbindungen, die jede Person mit dem eigenen Konto verbindet (connectors.py).
// Ein Konnektor lässt sich mehrfach verbinden (z. B. GitLab mit je einem Token je Projekt). Eingerichtet wird er in einem
// geführten Chat; das Formular (lm-connector-form) gibt es dort und hier auf der Seite: erst Anmeldedaten und Prüfung,
// danach „Wofür darf der Zugang verwendet werden?“. Zugang und Skill einer Verbindung bearbeitet man nur von hier aus.
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, confirmDialog, safeElement } from "./ui";
import { store, navigate } from "./api";
import { t, tb } from "./i18n";
import { ext } from "./external";

const LABELS: Record<string, string> = { url: "Adresse", username: "Benutzername", password: "Passwort", token: "Token",
  share_token: "Freigabe-Token", header: "Header-Name", key: "Schlüssel", chat_ids: "Chat-IDs", imap_host: "IMAP-Server",
  smtp_host: "SMTP-Server", login: "Benutzerkennung" };

/** Beschriftung eines Feldes: die des Typs (z. B. GWDG: E-Mail-Adresse, Benutzerkennung), sonst die allgemeine. */
export function fieldLabel(type: string, f: string): string {
  const own = store.data?.credential_types?.[type]?.labels?.[f];
  return own ? tb(own) : LABELS[f] ? t(LABELS[f]) : f;
}

/** Symbol eines Konnektors nach seinem Typ. */
export function connectorIcon(k: any): string {
  if (k?.mcp_tools) return "mdi:connection";
  return k?.type === "webdav" ? "cloud" : ["imap", "ews", "gwdg"].includes(k?.type) ? "mdi:email-outline" : "key";
}

/** Kurz, wofür eine Verbindung verwendet werden darf. */
export function rightsText(c: any): string {
  const svc: Record<string, string> = store.data?.credential_types?.[c.type]?.services || {};
  if ((c.services || []).length) return c.services.map((s: string) => `${svc[s] || s}: ${c.access?.[s] === "write" ? t("lesen und schreiben") : t("nur lesen")}`).join(" · ");
  return c.readonly ? t("nur lesen") : t("lesen und schreiben");
}

/** Den geführten Einrichtungs-Chat öffnen (neu oder für eine bestehende Verbindung). */
export async function openSetupChat(k: any, credentialId?: string) {
  try {
    const chat = await store.api.ws("connector/setup_chat", { connector_id: k.id, credential_id: credentialId || null });
    navigate(`/chat/${chat.id}`);
  } catch (e: any) { store.notify(e.message); }
}

const formCss = css`:host { display: block; }
  .cf { display: grid; gap: 10px; }
  .steps { display: flex; gap: 8px; font-size: 12.5px; color: var(--lm-muted); align-items: center; }
  .steps .n { width: 20px; height: 20px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--lm-side); font-size: 11.5px; font-weight: 600; }
  .steps .on { color: var(--lm-text); font-weight: 600; } .steps .on .n { background: var(--lm-accent); color: var(--lm-on-accent); }
  .steps .done .n { background: var(--lm-accent-soft); color: var(--lm-accent); }
  .fixed { font-family: var(--lm-mono); font-size: 12px; color: var(--lm-muted); word-break: break-all; }
  .opt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--lm-line); border-radius: 12px; cursor: pointer; }
  .opt.on { border-color: var(--lm-accent); background: var(--lm-accent-soft); }
  .opt input { width: auto; margin-top: 3px; }
  .svc { display: grid; grid-template-columns: max-content minmax(0, 220px); gap: 8px 16px; align-items: center; }
  .msg { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--lm-side); font-size: 13.5px; }
  .msg.err { color: var(--lm-err); } .msg.ok { color: var(--lm-ok); }`;

/** Formular einer Verbindung in zwei Schritten: 1. Anmeldedaten und Prüfung, 2. wofür der Zugang verwendet werden darf.
 *  Im Einrichtungs-Chat gehört es zu einer offenen Frage (permissionId): Fertig schließt sie ab, Abbrechen lehnt sie ab. */
@safeElement("lm-connector-form")
export class ConnectorForm extends StoreElement {
  @property({ attribute: false }) connector: any = null;
  @property({ attribute: false }) credential: any = null;
  @property() permissionId = "";
  @property() suggested = "";
  @property() hint = "";
  /** Gleich mit Schritt 2 beginnen (Rechte einer bestehenden Verbindung ändern). */
  @property({ type: Boolean }) optionsOnly = false;
  @state() private step: "creds" | "options" = "creds";
  @state() private fields: Record<string, string> = {};
  @state() private name = "";
  @state() private busy = false;
  @state() private cred: any = null;
  @state() private opts: any = {};
  @state() private flow: { flow_id: string; login: string; status: string; error?: string } | null = null;
  private isNew = true;
  private timer: number | undefined;
  static styles = [base, formCss];

  connectedCallback() {
    super.connectedCallback();
    this.isNew = !this.credential;
    this.cred = this.credential;
    this.name = this.credential?.name || this.suggested || this.connector?.name || "";
    if (this.optionsOnly && this.cred) this.toOptions(this.cred);
  }
  disconnectedCallback() { super.disconnectedCallback(); window.clearTimeout(this.timer); }

  private toOptions(c: any) {
    this.cred = c;
    this.opts = { access: { ...(c.access || {}) }, readonly: c.readonly ?? this.isNew, external: !!c.external, valid_until: c.valid_until || "" };
    this.step = "options";
  }
  private done(c: any) { this.dispatchEvent(new CustomEvent("done", { detail: c, bubbles: true, composed: true })); }
  private async cancel() {
    window.clearTimeout(this.timer);
    if (this.flow) { try { await store.api.ws("connector/flow_status", { flow_id: this.flow.flow_id, cancel: true }); } catch { /* egal */ } }
    if (this.permissionId) { try { await store.api.ws("permission/answer", { permission_id: this.permissionId, decision: "deny" }); } catch { /* egal */ } }
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  private async connect() {
    this.busy = true;
    try {
      const c = await store.api.ws("connector/connect", { connector_id: this.connector.id, fields: this.fields, name: this.name,
        credential_id: this.cred?.id || null, check: true, permission_id: this.permissionId || null });
      this.cred = c; this.fields = {};
      if (!c.check || c.check.ok) this.toOptions(c);
    } catch (e: any) { store.notify(e.message); }
    this.busy = false;
  }
  private async startFlow() {
    this.busy = true;
    const win = window.open("about:blank", "_blank");  // sofort öffnen, sonst blockt der Browser das Fenster
    try {
      const r = await store.api.ws("connector/flow_start", { connector_id: this.connector.id, credential_id: this.cred?.id || null,
        name: this.name, permission_id: this.permissionId || null });
      if (win) win.location.href = r.login; else window.open(r.login, "_blank");
      this.flow = { flow_id: r.flow_id, login: r.login, status: "waiting" };
      this.poll();
    } catch (e: any) { win?.close(); store.notify(e.message); }
    this.busy = false;
  }
  private poll() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(async () => {
      if (!this.flow) return;
      try {
        const s = await store.api.ws("connector/flow_status", { flow_id: this.flow.flow_id });
        this.flow = { ...this.flow, status: s.status, error: s.error };
        if (s.status === "waiting") return this.poll();
        if (s.status === "done" && s.credential) { this.flow = null; this.cred = s.credential; if (!s.credential.check || s.credential.check.ok) this.toOptions(s.credential); }
      } catch (e: any) { store.notify(e.message); this.flow = null; }
    }, 2500);
  }
  private async finish() {
    this.busy = true;
    try {
      const svc = (this.cred.services || []).length;
      const c = await store.api.ws("connector/options", { credential_id: this.cred.id, name: this.name,
        ...(svc ? { access: this.opts.access } : { readonly: !!this.opts.readonly }),
        ...(this.extShown() ? { external: !!this.opts.external } : {}),
        valid_until: this.opts.valid_until || "", permission_id: this.permissionId || null });
      store.notify(t("Gespeichert")); this.done(c);
    } catch (e: any) { store.notify(e.message); }
    this.busy = false;
  }
  private extShown() { return !!(ext().configured || ext().any_access || this.cred?.external); }

  private stepper() {
    const s1 = this.step === "creds";
    return html`<div class="steps"><span class=${s1 ? "on" : "done"}><span class="n">${s1 ? "1" : icon("check", 12)}</span> ${t("Anmelden")}</span>
      <span>›</span><span class=${s1 ? "" : "on"}><span class="n">2</span> ${t("Wofür darf der Zugang verwendet werden?")}</span></div>`;
  }

  private credsStep() {
    const k = this.connector;
    const ty = store.data?.credential_types?.[k.type] || {};
    const secret = new Set<string>(ty.secret || []);
    const c = this.cred;
    const bad = c?.check && !c.check.ok;
    const flowUi = k.login === "nextcloud_flow";
    return html`
      ${this.hint ? html`<div class="hint">${this.hint}</div>` : nothing}
      <label class="f"><span>${t("Name der Verbindung")}</span><input .value=${this.name} @input=${(e: any) => (this.name = e.target.value)}
        placeholder=${k.name}><span class="hint">${t("Verbindest du den Konnektor mehrfach (z. B. je Projekt ein Token), unterscheidest du die Verbindungen am Namen.")}</span></label>
      ${Object.keys(k.fixed || {}).length ? html`<div class="fixed">${Object.entries(k.fixed).map(([f, v]) => html`<div>${fieldLabel(k.type, f)}: ${v}</div>`)}</div>` : nothing}
      ${flowUi ? (this.flow ? html`<div class="msg">${icon(this.flow.status === "waiting" ? "hourglass" : "alert", 18)}<div>
            ${this.flow.status === "waiting" ? html`${t("Melde dich im neuen Fenster bei der Nextcloud an und erlaube den Zugriff. LLMitMir bekommt dann ein eigenes App-Passwort – dein Passwort sieht es nie.")}
              <div style="margin-top:6px"><a href=${this.flow.login} target="_blank" rel="noopener">${t("Anmeldeseite erneut öffnen")}</a></div>`
            : this.flow.status === "expired" ? t("Die Anmeldung hat zu lange gedauert. Bitte noch einmal versuchen.") : tb(this.flow.error) || t("Die Anmeldung ist fehlgeschlagen.")}</div></div>` : nothing)
      : k.user_fields.map((f: string) => html`<label class="f"><span>${fieldLabel(k.type, f)}</span>
          <input type=${secret.has(f) ? "password" : "text"} autocomplete="off" placeholder=${c && secret.has(f) ? t("unverändert lassen") : (ty.placeholders || {})[f] || ""}
            .value=${this.fields[f] ?? (c && !secret.has(f) ? c.fields?.[f] || "" : "")}
            @input=${(e: any) => (this.fields = { ...this.fields, [f]: e.target.value })}></label>`)}
      ${store.data?.cred_policy?.tips?.[k.type] ? html`<div class="hint">${store.data.cred_policy.tips[k.type]}</div>` : nothing}
      ${bad ? html`<div class="msg err">${icon("alert", 18)}<div><b>${t("Die Prüfung ist fehlgeschlagen:")}</b> ${tb(c.check.message)}</div></div>` : nothing}
      <div class="row" style="flex-wrap:wrap">
        ${flowUi ? html`<button class="btn primary" ?disabled=${this.busy || (this.flow?.status === "waiting")} @click=${() => this.startFlow()}>${icon("cloud", 16)} ${c ? t("Neu anmelden") : t("Mit Nextcloud anmelden")}</button>`
          : html`<button class="btn primary" ?disabled=${this.busy} @click=${() => this.connect()}>${this.busy ? html`<lm-spark size="16"></lm-spark>` : icon("check", 16)} ${this.busy ? t("Prüfe …") : t("Verbinden und prüfen")}</button>`}
        ${c ? html`<button class="btn" ?disabled=${this.busy} @click=${() => this.toOptions(c)}>${bad ? t("Trotzdem weiter") : t("Anmeldedaten behalten, weiter")}</button>` : nothing}
        <button class="btn ghost" @click=${() => this.cancel()}>${t("Abbrechen")}</button></div>`;
  }

  private optionsStep() {
    const c = this.cred; const o = this.opts;
    const svcDefs: Record<string, string> = store.data?.credential_types?.[c.type]?.services || {};
    const svc: string[] = c.services || [];
    const set = (patch: any) => (this.opts = { ...this.opts, ...patch });
    return html`
      ${c.check?.ok ? html`<div class="msg ok">${icon("check", 18)}<div>${t("Verbunden – die Anmeldung funktioniert.")}</div></div>` : nothing}
      ${svc.length ? html`<div class="svc">${svc.map(s => html`<span>${svcDefs[s] || s}</span>
          <select @change=${(e: any) => set({ access: { ...o.access, [s]: e.target.value } })}>
            <option value="read" ?selected=${(o.access?.[s] || "read") === "read"}>${t("nur lesen")}</option>
            <option value="write" ?selected=${o.access?.[s] === "write"}>${t("lesen und schreiben")}</option></select>`)}</div>
          <div class="hint">${t("„Nur lesen“ gilt wirklich: Die KI bekommt das Passwort nie und kann dann weder Mails senden, verschieben oder löschen noch Termine oder Kontakte anlegen, ändern oder löschen.")}</div>`
      : html`${[[true, t("Nur lesen (empfohlen)"), t("LLMitMir darf mit diesem Zugang nur lesen. Schreibende Aufrufe (Anlegen, Ändern, Löschen) und Werkbank-Befehle damit lehnt es ab.")],
                [false, t("Lesen und schreiben"), t("LLMitMir darf mit diesem Zugang auch ändern – jede schreibende Aktion fragt trotzdem vorher nach.")]].map(([v, l, d]) => html`
          <label class="opt ${!!o.readonly === v ? "on" : ""}"><input type="radio" name="ro" .checked=${!!o.readonly === v} @change=${() => set({ readonly: v })}>
            <div><b>${l}</b><div class="hint">${d}</div></div></label>`)}`}
      ${this.extShown() ? html`<label class="opt ${o.external ? "on" : ""}"><input type="checkbox" .checked=${!!o.external} @change=${(e: any) => set({ external: e.target.checked })}>
          <div><b>${t("Auch für externe Modelle freigeben")}</b><div class="hint">${t("Aus (Standard): Externe Modelle sehen diesen Zugang nicht. An: Was sie damit abrufen, geht an den externen Anbieter – das Passwort selbst nie.")}</div></div></label>` : nothing}
      <label class="f"><span>${t("Gültig bis")} <span class="hint">(${t("optional")})</span></span>
        <input type="date" .value=${o.valid_until || ""} @input=${(e: any) => set({ valid_until: e.target.value })}>
        <span class="hint">${t("Läuft dein Token ab, warnt LLMitMir zwei Wochen vorher.")}</span></label>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn primary" ?disabled=${this.busy} @click=${() => this.finish()}>${icon("check", 16)} ${t("Fertig")}</button>
        ${this.optionsOnly ? nothing : html`<button class="btn ghost" @click=${() => (this.step = "creds")}>${t("Zurück")}</button>`}
        <button class="btn ghost" @click=${() => this.cancel()}>${t("Abbrechen")}</button></div>`;
  }

  render() {
    if (!this.connector) return nothing;
    return html`<div class="cf">${this.optionsOnly ? nothing : this.stepper()}${this.step === "creds" ? this.credsStep() : this.optionsStep()}</div>`;
  }
}

const styles = css`:host { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 12px; align-items: start; }
  .kn { display: flex; flex-direction: column; gap: 10px; }
  .kn .head { display: flex; gap: 10px; align-items: center; }
  .kn .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); flex: none; }
  .conn { border: 1px solid var(--lm-line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; background: var(--lm-bg); }
  .conn .row { flex-wrap: wrap; row-gap: 4px; }
  .conn .acts { display: flex; flex-wrap: wrap; gap: 4px; }
  .conn .acts .btn, .kn .more .btn { padding: 4px 10px; font-size: 12.5px; min-height: 30px; }
  .sk { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  .btn.tiny { padding: 2px 9px; font-size: 12px; border-radius: 8px; min-height: 26px; }`;

@safeElement("lm-connectors")
export class ConnectorsPage extends StoreElement {
  /** In der Plugins-Seite eingebettet: ohne eigene Überschrift. */
  @property({ type: Boolean }) embedded = false;
  /** Offenes Formular: "<connector>:new" (ohne Chat einrichten), "<credential>" (Anmeldedaten) oder "<credential>:opts" (Rechte). */
  @state() private open = "";
  static styles = [base, styles];

  private async disconnect(k: any, c: any) {
    const sk = (store.data?.skills || []).find((s: any) => s.connection_id === c.id);
    if (!(await confirmDialog(t("Verbindung {name} trennen? Der Zugang wird gelöscht; Aufgaben und Skills, die ihn nutzen, gehen dann nicht mehr.", { name: `„${c.name}“` })
      + (sk ? " " + t("Der Skill {name} dieser Verbindung wird ebenfalls gelöscht.", { name: `„${sk.name}“` }) : ""), t("Trennen")))) return;
    try { await store.api.ws("connector/disconnect", { credential_id: c.id }); await store.load(); store.notify(t("Getrennt")); } catch (e: any) { store.notify(e.message); }
  }

  private connection(k: any, c: any) {
    const bad = c.check && !c.check.ok;
    const sk = (store.data?.skills || []).find((s: any) => s.connection_id === c.id);
    if (this.open === c.id || this.open === `${c.id}:opts`) return html`<div class="conn">
      <lm-connector-form .connector=${k} .credential=${c} ?optionsOnly=${this.open === `${c.id}:opts`}
        @done=${async () => { this.open = ""; await store.load(); }} @cancel=${() => (this.open = "")}></lm-connector-form></div>`;
    return html`<div class="conn">
      <div class="row"><b class="grow ellipsis">${c.name}</b>
        ${bad ? html`<span class="chip err" title=${tb(c.check.message)}>${icon("alert", 13)} ${t("Anmeldung prüfen")}</span>` : html`<span class="chip ok">${icon("check", 13)} ${t("verbunden")}</span>`}</div>
      <div class="hint">${icon("shield", 13)} ${rightsText(c)}${c.external ? ` · ${t("extern frei")}` : ""}${c.valid_until ? ` · ${t("bis")} ${c.valid_until.split("-").reverse().join(".")}` : ""}</div>
      ${bad ? html`<div class="hint" style="color:var(--lm-err)">${tb(c.check.message)}</div>` : nothing}
      <div class="sk">${icon("skill", 15)} ${sk ? html`<span class="grow ellipsis">${t("Skill")}: ${sk.name}</span>
          <button class="btn ghost tiny" @click=${() => navigate(`/skill/${sk.id}/connector`)}>${t("Bearbeiten")}</button>`
        : html`<span class="grow hint">${t("Kein Skill")}</span>
          <button class="btn ghost tiny" @click=${() => navigate(`/skill/new/connector/${c.id}`)}>${icon("plus", 14)} ${t("Skill hinterlegen")}</button>`}</div>
      <div class="acts">
        <button class="btn" @click=${() => (this.open = c.id)}>${icon("edit", 14)} ${t("Anmeldedaten")}</button>
        <button class="btn" @click=${() => (this.open = `${c.id}:opts`)}>${icon("shield", 14)} ${t("Rechte")}</button>
        <button class="btn" @click=${() => openSetupChat(k, c.id)}>${icon("chat", 14)} ${t("Im Chat ändern")}</button>
        <button class="btn ghost" @click=${() => navigate(`/credential/${c.id}/connector`)}>${icon("key", 14)} ${t("Zugang")}</button>
        <button class="btn ghost danger" @click=${() => this.disconnect(k, c)}>${t("Trennen")}</button></div></div>`;
  }

  private card(k: any) {
    const conns = (store.data?.credentials || []).filter((c: any) => c.connector_id === k.id);
    return html`<div class="card kn">
      <div class="head"><div class="ic">${icon(connectorIcon(k), 20)}</div>
        <div class="grow"><b>${k.name}</b><div class="hint">${conns.length ? (conns.length === 1 ? t("1 Verbindung") : t("{n} Verbindungen", { n: conns.length })) : t("nicht verbunden")}</div></div></div>
      ${k.description ? html`<div class="hint">${k.description}</div>` : nothing}
      ${k.mcp_tools ? html`<div class="hint">${icon("mdi:connection", 13)} ${t("MCP-Server mit {n} Werkzeugen", { n: k.mcp_tools.length })}${k.mcp_tools.length ? `: ${k.mcp_tools.slice(0, 6).join(", ")}${k.mcp_tools.length > 6 ? " …" : ""}` : ""}</div>` : nothing}
      ${(k.rules || []).length ? html`<div class="hint">${icon("shield", 13)} ${t("Datenregeln:")} ${k.rules.map((r: any) => r.name + (r.scope ? ` (${r.scope})` : "")).join(", ")}</div>` : nothing}
      ${conns.map((c: any) => this.connection(k, c))}
      ${this.open === `${k.id}:new` ? html`<div class="conn"><lm-connector-form .connector=${k} .suggested=${conns.length ? `${k.name} (${conns.length + 1})` : k.name}
          @done=${async () => { this.open = ""; await store.load(); }} @cancel=${() => (this.open = "")}></lm-connector-form></div>`
        : html`<div class="row more" style="flex-wrap:wrap">
          <button class="btn ${conns.length ? "" : "primary"}" @click=${() => openSetupChat(k)}>${icon(conns.length ? "plus" : "chat", 16)} ${conns.length ? t("Weitere Verbindung einrichten") : t("Konnektor einrichten")}</button>
          <button class="btn ghost" title=${t("Ohne geführten Chat: gleich das Formular ausfüllen")} @click=${() => (this.open = `${k.id}:new`)}>${t("Ohne Chat")}</button></div>`}
    </div>`;
  }

  render() {
    const ks: any[] = store.data?.connectors || [];
    return html`<div class=${this.embedded ? "" : "page"}>${this.embedded ? nothing : html`<h1>${t("Konnektoren")}</h1>`}
      <p class="hint">${t("Konnektoren hat der Admin vorbereitet: Adresse und Einstellungen stehen fest, du verbindest nur dein eigenes Konto – auch mehrfach, z. B. mit je einem Token für verschiedene Projekte. „Konnektor einrichten“ führt dich in einem Chat Schritt für Schritt durch die Einrichtung.")}</p>
      ${ks.length ? html`<div class="grid">${ks.map(k => this.card(k))}</div>` : html`<div class="hint">${t("Der Admin hat noch keine Konnektoren eingerichtet.")}</div>`}</div>`;
  }
}
