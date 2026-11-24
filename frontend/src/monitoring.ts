// Admin → Monitoring: Zugriffsprotokoll und Agenten-Verzeichnis (nur Metadaten, nur für Admins).
import { css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { StoreElement, base, icon, fmtTime, safeElement } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";
import { AGENT_KINDS, MODEL_CLASSES, RANGES, agentLabel, credsText, outcomeText, shortId, targetText, toCsv } from "./auditview";

const styles = css`:host { display: block; height: 100%; overflow-y: auto; }
  section { margin-bottom: 22px; } section > h2 { display: flex; gap: 8px; align-items: center; }
  .tabs { display: flex; gap: 4px; margin: 6px 0 14px; } .tabs button { border: 0; background: none; padding: 7px 12px; border-radius: 9px; cursor: pointer; color: var(--lm-muted); font-size: 14px; }
  .tabs button.on { background: var(--lm-hover); color: var(--lm-text); font-weight: 560; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .filters select, .filters input[type=text] { width: auto; padding: 6px 8px; font-size: 13.5px; }
  .filters label.cb { display: inline-flex; gap: 6px; align-items: center; font-size: 13.5px; } .filters label.cb input { width: auto; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-bottom: 14px; }
  .tile { border: 1px solid var(--lm-line); border-radius: 12px; padding: 10px 12px; background: var(--lm-panel); }
  .tile b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; } .tile span { font-size: 12px; color: var(--lm-muted); }
  .tw { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; } td, th { padding: 7px 6px; border-bottom: 1px solid var(--lm-line); text-align: left; vertical-align: top; }
  th { font-weight: 600; color: var(--lm-muted); font-size: 12px; white-space: nowrap; }
  td.nw { white-space: nowrap; } td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .agent { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; color: var(--lm-accent); }
  .agent:hover { text-decoration: underline; }
  .id { font-family: var(--lm-mono); font-size: 11.5px; color: var(--lm-muted); }
  .denied { color: var(--lm-err); } .error { color: var(--lm-warn, #b7791f); }
  .ext { color: var(--lm-accent); }
  .tgt { font-family: var(--lm-mono); font-size: 12px; word-break: break-all; }`;

@safeElement("lm-monitoring")
export class MonitoringPage extends StoreElement {
  @state() private tab: "events" | "agents" = "events";
  @state() private days = 7;
  @state() private f: Record<string, any> = {};
  @state() private res: any = null;
  @state() private agents: any = null;
  @state() private busy = false;
  @state() private retention = 180;
  @state() private retDirty = false;
  static styles = [base, styles];
  connectedCallback() { super.connectedCallback(); this.load(); }

  private async load() {
    this.busy = true;
    try {
      if (this.tab === "events") {
        const filters = { ...this.f, since: Date.now() / 1000 - this.days * 86400 };
        this.res = await store.api.ws("admin/audit", { filters });
        if (!this.retDirty) this.retention = this.res.retention_days;
      } else {
        this.agents = await store.api.ws("admin/audit_agents");
        if (!this.retDirty) this.retention = this.agents.retention_days;
      }
    } catch (e: any) { store.notify(e.message); }
    this.busy = false;
  }
  private setF(k: string, v: any) { const f = { ...this.f }; if (v) f[k] = v; else delete f[k]; this.f = f; this.load(); }
  private showAgent(id: string) { this.tab = "events"; this.f = { agent_tree: id }; this.load(); }
  private async saveRetention() {
    try { await store.api.ws("admin/save", { config: { audit: { retention_days: Number(this.retention) } } }); this.retDirty = false; store.notify(t("Gespeichert")); }
    catch (e: any) { store.notify(e.message); }
  }
  private download() {
    const r = this.res; if (!r) return;
    const blob = new Blob(["﻿" + toCsv(r.events, r.names || {}, r.agents || {})], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `llmitmir-zugriffe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private agentCell(id: string, info: any) {
    const k = AGENT_KINDS[info?.kind || ""];
    return html`<span class="agent" title=${id} @click=${() => this.showAgent(id)}>${icon(k?.icon || "robot", 15)} ${agentLabel(id, info)}</span>`;
  }

  private eventsTab() {
    const r = this.res; const f = this.f;
    const names: Record<string, string> = r?.names || {};
    const s = r?.summary;
    const sel = (k: string, opts: [string, string][], all: string) => html`<select @change=${(e: any) => this.setF(k, e.target.value)}>
      <option value="" ?selected=${!f[k]}>${all}</option>${opts.map(([v, l]) => html`<option value=${v} ?selected=${f[k] === v}>${l}</option>`)}</select>`;
    return html`
      <div class="filters">
        <select @change=${(e: any) => { this.days = Number(e.target.value); this.load(); }}>
          ${RANGES.map(([d, l]) => html`<option value=${d} ?selected=${this.days === d}>${l}</option>`)}</select>
        ${sel("user", Object.entries(names), "alle Personen")}
        ${sel("outcome", [["ok", "ausgeführt"], ["denied", "abgelehnt"], ["error", "Fehler"]], "jedes Ergebnis")}
        ${sel("model_class", Object.entries(MODEL_CLASSES), "jede Modellklasse")}
        ${sel("agent_kind", Object.entries(AGENT_KINDS).map(([k, v]) => [k, v.label] as [string, string]), "jede Agenten-Art")}
        <input type="text" placeholder="Zugang" .value=${f.cred || ""} @change=${(e: any) => this.setF("cred", e.target.value.trim())}>
        <input type="text" placeholder="Server" .value=${f.host || ""} @change=${(e: any) => this.setF("host", e.target.value.trim())}>
        <label class="cb"><input type="checkbox" .checked=${!!f.only_creds} @change=${(e: any) => this.setF("only_creds", e.target.checked)}> nur mit Zugang</label>
        <label class="cb"><input type="checkbox" .checked=${!!f.write} @change=${(e: any) => this.setF("write", e.target.checked)}> nur schreibend</label>
        ${f.agent_tree ? html`<span class="chip">${icon("robot", 13)} ${agentLabel(f.agent_tree, r?.agents?.[f.agent_tree])} (mit Teilaufgaben)
          <button class="iconbtn" title="Filter entfernen" @click=${() => this.setF("agent_tree", "")}>${icon("close", 13)}</button></span>` : nothing}
        <span class="grow"></span>
        <button class="btn ghost" ?disabled=${this.busy} @click=${() => this.load()}>${icon("retry", 15)} Aktualisieren</button>
        <button class="btn ghost" ?disabled=${!r?.events?.length} @click=${() => this.download()}>${icon("download", 15)} CSV</button>
      </div>
      ${s ? html`<div class="tiles">
        ${[["Werkzeugaufrufe", s.tool_calls], ["mit Zugang", s.with_creds], ["schreibend", s.writes], ["abgelehnt", s.denied],
          ["Fehler", s.errors], ["mit externem Modell", s.external], ["Agenten", s.agents], ["Personen", s.users]]
          .map(([l, v]) => html`<div class="tile"><b>${v}</b><span>${l}</span></div>`)}</div>` : nothing}
      ${r?.more ? html`<div class="hint" style="margin-bottom:8px">${icon("info", 14)} Es gibt mehr Treffer als angezeigt (neueste 1000). Die Zahlen oben zählen alle – für die Liste den Zeitraum oder die Filter eingrenzen.</div>` : nothing}
      ${!r ? html`<lm-spark></lm-spark>` : !r.events.length ? html`<div class="hint">Keine Zugriffe in diesem Zeitraum.</div>` : html`<div class="tw"><table>
        <tr><th>Zeit</th><th>Person</th><th>Agent</th><th>Werkzeug</th><th>Zugang</th><th>Ziel</th><th>Modell</th><th>Ergebnis</th></tr>
        ${r.events.map((ev: any) => html`<tr>
          <td class="nw">${fmtTime(ev.ts)}</td>
          <td class="nw">${names[ev.user] || shortId(ev.user)}</td>
          <td>${this.agentCell(ev.agent, r.agents?.[ev.agent])}${ev.parent ? html`<div class="id">in ${agentLabel(ev.parent, r.agents?.[ev.parent])}</div>` : nothing}</td>
          <td class="nw">${ev.kind === "host_approval" ? html`${icon("shield", 13)} ` : ev.kind === "cred_approval" ? html`${icon("key", 13)} Freigabe · ` : nothing}${ev.tool || "–"}${ev.write ? html` <span class="chip">schreibt</span>` : nothing}</td>
          <td>${credsText(ev) ? html`${icon("key", 13)} ${credsText(ev)}` : nothing}</td>
          <td class="tgt">${targetText(ev)}</td>
          <td class=${ev.model_class && ev.model_class !== "main" ? "ext" : ""}>${ev.model || ""}${ev.model_class && ev.model_class !== "main" ? html`<div class="id">${MODEL_CLASSES[ev.model_class]}</div>` : nothing}</td>
          <td class=${ev.outcome === "denied" ? "denied" : ev.outcome === "error" ? "error" : ""}>${outcomeText(ev)}</td></tr>`)}
      </table></div>`}`;
  }

  private agentsTab() {
    const a = this.agents;
    if (!a) return html`<lm-spark></lm-spark>`;
    const running = new Set(a.running || []);
    const byId = Object.fromEntries((a.agents || []).map((x: any) => [x.id, x]));
    if (!a.agents.length) return html`<div class="hint">Noch keine Agenten erfasst. Jeder Chat, jedes Cowork, jede Teilaufgabe, geplante Aufgabe und Kachel erscheint hier, sobald sie arbeitet.</div>`;
    return html`<div class="tw"><table>
      <tr><th>Agent</th><th>ID</th><th>Person</th><th>Zuerst</th><th>Zuletzt</th><th class="num">Läufe</th><th class="num">Aufrufe</th><th>Zugänge</th><th>Modell</th></tr>
      ${a.agents.map((x: any) => html`<tr>
        <td>${this.agentCell(x.id, x)}${running.has(x.id) ? html` <span class="chip ok">läuft</span>` : nothing}
          ${x.parent ? html`<div class="id">in ${agentLabel(x.parent, byId[x.parent])}</div>` : nothing}</td>
        <td class="id">${x.id}</td>
        <td class="nw">${a.names?.[x.owner] || shortId(x.owner)}</td>
        <td class="nw">${fmtTime(x.first_seen)}</td><td class="nw">${fmtTime(x.last_seen)}</td>
        <td class="num">${x.runs || 0}</td><td class="num">${x.calls || 0}</td>
        <td>${Object.values(x.creds || {}).join(", ")}</td>
        <td class=${x.model_class && x.model_class !== "main" ? "ext" : ""}>${x.model || ""}</td></tr>`)}
    </table></div>`;
  }

  render() {
    return html`<div class="page">
      <div class="row"><button class="btn ghost" @click=${() => navigate("/admin")}>${icon("back", 16)} ${t("Admin")}</button></div>
      <h1>${icon("shield", 22)} ${t("Monitoring")}</h1>
      <div class="hint">Welcher Agent mit welchem Zugang worauf zugegriffen hat – nur für Admins sichtbar. Erfasst werden nur Metadaten:
        Werkzeug, Zugang, Server und Pfad, Entitäten, Modell, Ergebnis und wer freigegeben hat. Inhalte (Texte, Suchbegriffe, Dateien,
        Empfänger, Chat-Titel) stehen nie im Protokoll. Jeder Chat, jedes Cowork und jede Teilaufgabe ist ein eigener Agent; eine geplante
        Aufgabe oder Kachel ist über alle ihre Läufe derselbe Agent.</div>
      <div class="tabs">${([["events", t("Zugriffe")], ["agents", t("Agenten")]] as const).map(([k, l]) =>
        html`<button class=${this.tab === k ? "on" : ""} @click=${() => { this.tab = k; this.load(); }}>${l}</button>`)}</div>
      ${this.tab === "events" ? this.eventsTab() : this.agentsTab()}
      <section style="margin-top:26px"><h2>${icon("hourglass", 18)} Aufbewahrung</h2>
        <div class="row" style="flex-wrap:wrap;gap:8px"><input type="number" min="7" max="3650" style="width:110px" .value=${String(this.retention)}
          @input=${(e: any) => { this.retention = e.target.value; this.retDirty = true; }}> <span>Tage</span>
          <button class="btn primary" ?disabled=${!this.retDirty} @click=${() => this.saveRetention()}>${t("Speichern")}</button></div>
        <div class="hint">Ältere Einträge löscht LLMitMir stündlich (7 bis 3650 Tage, Vorgabe 180). Das Agenten-Verzeichnis behält Agenten, die in dieser Frist aktiv waren.</div></section>
    </div>`;
  }
}
