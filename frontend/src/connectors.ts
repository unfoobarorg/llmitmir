// Konnektoren: vom Admin vorbereitete Anbindungen, die jede Person mit dem eigenen Konto verbindet (connectors.py).
import { css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { StoreElement, base, icon, confirmDialog, safeElement } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";

const styles = css`:host { display: block; height: 100%; overflow-y: auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .kn { display: flex; flex-direction: column; gap: 8px; }
  .kn .head { display: flex; gap: 10px; align-items: center; }
  .kn .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); flex: none; }
  .kn .fixed { font-family: var(--lm-mono); font-size: 12px; color: var(--lm-muted); word-break: break-all; }
  .kn form { display: grid; gap: 8px; }
  .status { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; }
  .checkbox { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--lm-side); font-size: 13.5px; }`;

const LABELS: Record<string, string> = { url: "Adresse", username: "Benutzername", password: "Passwort", token: "Token",
  share_token: "Freigabe-Token", header: "Header-Name", key: "Schlüssel", chat_ids: "Chat-IDs", imap_host: "IMAP-Server",
  smtp_host: "SMTP-Server", login: "Benutzerkennung" };

@safeElement("lm-connectors")
export class ConnectorsPage extends StoreElement {
  @state() private open = "";                       // Konnektor, dessen Formular offen ist
  @state() private fields: Record<string, string> = {};
  @state() private busy = "";
  @state() private flow: { id: string; flow_id: string; login: string; status: string; error?: string } | null = null;
  static styles = [base, styles];
  private timer: number | undefined;
  disconnectedCallback() { super.disconnectedCallback(); window.clearTimeout(this.timer); }

  private conn(k: any) { return (store.data?.credentials || []).find((c: any) => c.connector_id === k.id); }

  private async connect(k: any) {
    this.busy = k.id;
    try {
      await store.api.ws("connector/connect", { connector_id: k.id, fields: this.fields });
      this.open = ""; this.fields = {}; await store.load(); store.notify(t("Verbunden"));
    } catch (e: any) { store.notify(e.message); }
    this.busy = "";
  }
  private async startFlow(k: any) {
    this.busy = k.id;
    // Fenster sofort öffnen (sonst blockt der Browser es), dann die Anmeldeseite der Nextcloud hineinladen
    const win = window.open("about:blank", "_blank");
    try {
      const r = await store.api.ws("connector/flow_start", { connector_id: k.id });
      if (win) win.location.href = r.login; else window.open(r.login, "_blank");
      this.flow = { id: k.id, flow_id: r.flow_id, login: r.login, status: "waiting" };
      this.poll();
    } catch (e: any) { win?.close(); store.notify(e.message); }
    this.busy = "";
  }
  private poll() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(async () => {
      if (!this.flow) return;
      try {
        const s = await store.api.ws("connector/flow_status", { flow_id: this.flow.flow_id });
        this.flow = { ...this.flow, status: s.status, error: s.error };
        if (s.status === "waiting") return this.poll();
        if (s.status === "done") { await store.load(); store.notify(t("Verbunden")); this.flow = null; }
      } catch (e: any) { store.notify(e.message); this.flow = null; }
    }, 2500);
  }
  private async cancelFlow() {
    if (this.flow) { try { await store.api.ws("connector/flow_status", { flow_id: this.flow.flow_id, cancel: true }); } catch { /* egal */ } }
    window.clearTimeout(this.timer); this.flow = null;
  }
  private async disconnect(k: any, c: any) {
    if (!(await confirmDialog(t("Verbindung zu {name} trennen? Der Zugang wird gelöscht; Aufgaben und Skills, die ihn nutzen, gehen dann nicht mehr.", { name: k.name }), t("Trennen")))) return;
    try { await store.api.ws("credential/delete", { credential_id: c.id }); await store.load(); } catch (e: any) { store.notify(e.message); }
  }

  private form(k: any, c: any) {
    const secret = new Set<string>(store.data?.credential_types?.[k.type]?.secret || []);
    return html`<form @submit=${(e: Event) => { e.preventDefault(); this.connect(k); }}>
      ${k.user_fields.map((f: string) => html`<label class="f"><span>${LABELS[f] || f}</span>
        <input type=${secret.has(f) ? "password" : "text"} autocomplete="off" placeholder=${c && secret.has(f) ? t("unverändert lassen") : ""}
          .value=${this.fields[f] ?? (c && !secret.has(f) ? c.fields?.[f] || "" : "")}
          @input=${(e: any) => (this.fields = { ...this.fields, [f]: e.target.value })}></label>`)}
      <div class="hint">${store.data?.cred_policy?.tips?.[k.type] || ""}</div>
      <div class="row"><button class="btn primary" type="submit" ?disabled=${this.busy === k.id}>${icon("check", 16)} ${c ? t("Speichern") : t("Verbinden")}</button>
        <button class="btn ghost" type="button" @click=${() => { this.open = ""; this.fields = {}; }}>${t("Abbrechen")}</button></div></form>`;
  }

  private card(k: any) {
    const c = this.conn(k);
    const bad = c?.check && !c.check.ok;
    const flow = this.flow?.id === k.id ? this.flow : null;
    return html`<div class="card kn">
      <div class="head"><div class="ic">${icon(k.type === "webdav" ? "cloud" : k.type === "imap" || k.type === "ews" || k.type === "gwdg" ? "mdi:email-outline" : "key", 20)}</div>
        <div class="grow"><b>${k.name}</b>
          <div class="status">${c ? (bad ? html`<span class="chip err">${icon("alert", 13)} ${t("Anmeldung prüfen")}</span>` : html`<span class="chip ok">${icon("check", 13)} ${t("verbunden")}</span>`)
            : html`<span class="chip">${t("nicht verbunden")}</span>`}</div></div></div>
      ${k.description ? html`<div class="hint">${k.description}</div>` : nothing}
      ${Object.keys(k.fixed || {}).length ? html`<div class="fixed">${Object.entries(k.fixed).map(([f, v]) => html`<div>${LABELS[f] || f}: ${v}</div>`)}</div>` : nothing}
      ${bad ? html`<div class="hint" style="color:var(--lm-err)">${c.check.message}</div>` : nothing}
      ${flow ? html`<div class="checkbox">${icon(flow.status === "waiting" ? "hourglass" : "alert", 18)}<div>
          ${flow.status === "waiting" ? html`${t("Melde dich im neuen Fenster bei der Nextcloud an und erlaube den Zugriff. LLMitMir bekommt dann ein eigenes App-Passwort – dein Passwort sieht es nie.")}
            <div class="row" style="margin-top:6px"><a href=${flow.login} target="_blank" rel="noopener">${t("Anmeldeseite erneut öffnen")}</a>
            <button class="btn ghost" @click=${() => this.cancelFlow()}>${t("Abbrechen")}</button></div>`
          : html`${flow.status === "expired" ? t("Die Anmeldung hat zu lange gedauert. Bitte noch einmal versuchen.") : flow.error || t("Die Anmeldung ist fehlgeschlagen.")}
            <div><button class="btn ghost" @click=${() => (this.flow = null)}>${t("Schließen")}</button></div>`}</div></div>`
      : this.open === k.id ? this.form(k, c)
      : html`<div class="row" style="flex-wrap:wrap">
          ${k.login === "nextcloud_flow"
            ? html`<button class="btn ${c ? "" : "primary"}" ?disabled=${this.busy === k.id} @click=${() => this.startFlow(k)}>${icon("cloud", 16)} ${c ? t("Neu anmelden") : t("Mit Nextcloud anmelden")}</button>`
            : html`<button class="btn ${c ? "" : "primary"}" @click=${() => { this.open = k.id; this.fields = {}; }}>${icon(c ? "edit" : "plus", 16)} ${c ? t("Anmeldedaten ändern") : t("Verbinden")}</button>`}
          ${c ? html`<button class="btn ghost" @click=${() => navigate(`/credential/${c.id}`)}>${t("Zugang ansehen")}</button>
            <button class="btn ghost danger" @click=${() => this.disconnect(k, c)}>${t("Trennen")}</button>` : nothing}</div>`}
    </div>`;
  }

  render() {
    const ks: any[] = store.data?.connectors || [];
    const free = store.data?.cred_policy?.free_credentials !== false;
    return html`<div class="page"><h1>${t("Konnektoren")}</h1>
      <p class="hint">${t("Konnektoren hat der Admin vorbereitet: Adresse und Einstellungen stehen fest, du verbindest nur dein eigenes Konto. LLMitMir arbeitet dann in deinem Namen und mit deinen Rechten im jeweiligen System – nimm dafür, wo möglich, ein eigenes App-Passwort oder einen eigenen Token.")}</p>
      ${ks.length ? html`<div class="grid">${ks.map(k => this.card(k))}</div>` : html`<div class="hint">${t("Der Admin hat noch keine Konnektoren eingerichtet.")}</div>`}
      <p class="hint" style="margin-top:18px">${free ? html`${t("Andere Systeme bindest du unter")} <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/credentials"); }}>${t("Zugänge")}</a> ${t("selbst an.")}`
        : t("Eigene Zugänge ohne Konnektor hat der Admin abgeschaltet.")}</p></div>`;
  }
}
