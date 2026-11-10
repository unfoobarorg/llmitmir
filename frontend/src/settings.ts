// Personal settings (incl. Claude import and usage) and the admin page.
import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import { StoreElement, base, icon, md, fmtNum, fmtTime, copyText, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { claudeImportPrompt } from "./importprompt";
import { load, loadDot, modelName } from "./modelpick";
import werkbankGuide from "../../docs/WERKBANK.md";
import { taskUsageCard, taskUsageCss, usageBlock, taskKeyLabel } from "./taskusage";
import { ensureConsent, externalCss, externalExplanation, fmtEur, priceText } from "./external";


const css2 = css`:host { display: block; height: 100%; overflow-y: auto; }
  section { margin-bottom: 26px; } section > h2 { display: flex; gap: 8px; align-items: center; }
  .form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .bars { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 10px; }
  .bars div { flex: 1; background: var(--lm-accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .85; position: relative; transition: height .4s; }
  .bars div:hover { opacity: 1; }
  .opt { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--lm-line); border-radius: 12px; cursor: pointer; background: var(--lm-panel); }
  .opt.on { border-color: var(--lm-accent); box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  .opt input { width: auto; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; } td, th { padding: 8px 6px; border-bottom: 1px solid var(--lm-line); text-align: left; vertical-align: middle; }
  th { font-weight: 600; color: var(--lm-muted); font-size: 12px; }
  td input { padding: 6px 8px; } td input[type=checkbox] { width: auto; }
  .prompt { font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; max-height: 260px; overflow-y: auto; background: var(--lm-side);
    border: 1px solid var(--lm-line); border-radius: 10px; padding: 12px; }
  .tw { overflow-x: auto; }
  .wbgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
  .wbgrid ul { margin: 6px 0 0; padding-left: 1.2em; } .wbgrid li { margin: 3px 0; font-size: 13.5px; }
  .guide { margin-top: 12px; max-height: 70vh; overflow-y: auto; }
  .status { display: inline-flex; align-items: center; gap: 6px; }
  .prov { display: grid; gap: 10px; }
  .prov .card { display: grid; gap: 10px; }
  .prov .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .prov .pos { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); font-weight: 600; font-size: 13px; flex: none; }
  .prov .off { opacity: .6; }
  .mbars { display: flex; align-items: flex-end; gap: 2px; height: 34px; min-width: 120px; }
  .mbars div { flex: 1; background: var(--lm-accent); border-radius: 2px 2px 0 0; min-height: 1px; opacity: .8; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .matrix td, .matrix th { text-align: center; } .matrix td:first-child, .matrix th:first-child { text-align: left; }
  @media (max-width: 640px) { .wbgrid { grid-template-columns: 1fr; } }
  @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }`;

export function werkbankInfo(configured: boolean, showGuide: boolean, toggle: () => void, isAdmin: boolean) {
  return html`<div class="card">
    <div class="row"><b class="grow">LLMitMir funktioniert mit und ohne Werkbank</b>
      ${configured ? html`<span class="chip ok">${icon("check", 13)} eingerichtet</span>` : html`<span class="chip">nicht eingerichtet</span>`}</div>
    <p class="hint" style="margin:6px 0 0">Die Werkbank ist ein eigener kleiner Rechner (meist eine VM), auf dem die Modelle Programme ausführen dürfen –
      abgeschottet von Home Assistant, für jeden Chat in einer eigenen Sandbox.</p>
    <div class="wbgrid">
      <div><b style="font-size:13.5px">Ohne Werkbank geht</b><ul>
        <li>Chatten, Coworks und geplante Aufgaben</li><li>Web durchsuchen und Seiten abrufen</li>
        <li>Home Assistant lesen und steuern</li><li>Nextcloud-Dateien, -Kalender und -Kontakte</li><li>PDFs, Scans und Fotos lesen</li></ul></div>
      <div><b style="font-size:13.5px">Nur mit Werkbank</b><ul>
        <li>Python-Skripte und Befehle ausführen, auch Skripte aus Skills</li><li>Auswerten und rechnen, Diagramme erzeugen</li>
        <li>Excel-, Word-, PowerPoint- und PDF-Dateien erstellen</li><li>Sprachnachrichten abschreiben (Whisper), Audio/Video umwandeln</li>
        <li>Texterkennung (Tesseract) und Werkzeuge wie curl, git, jq</li></ul></div></div>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn" @click=${toggle}>${icon(showGuide ? "down" : "right", 16)} Anleitung zur Einrichtung ${showGuide ? "ausblenden" : "anzeigen"}</button>
      ${!isAdmin && !configured ? html`<span class="hint">Einrichten kann nur ein Admin von Home Assistant.</span>` : nothing}</div>
    ${showGuide ? html`<div class="guide md card fade-in">${md(werkbankGuide, { breaks: false })}</div>` : nothing}
  </div>`;
}

@safeElement("lm-settings")
export class SettingsPage extends StoreElement {
  @state() private s: any = {};
  @state() private memory = "";
  @state() private dirty = false;
  @state() private devices: any[] = [];
  @state() private deviceSel = "";
  @state() private devicesLoaded = false;
  @state() private history: any = null;
  @state() private imp: any = null;
  @state() private impResult: any = null;
  @state() private guide = false;
  static styles = [base, css2, taskUsageCss, externalCss];
  connectedCallback() {
    super.connectedCallback();
    this.reset();
    store.api.ws("notify_devices").then(r => {
      this.devices = r.devices || []; this.deviceSel = r.selected || ""; this.devicesLoaded = true; });
    store.api.ws("usage/history").then(r => (this.history = r));
  }
  private reset() {
    this.s = { ...(store.data?.settings || {}) }; this.memory = store.data?.memory || ""; this.dirty = false;
    this.deviceSel = this.s.notify_device || "";
  }
  private set(k: string, v: any) { this.s = { ...this.s, [k]: v }; this.dirty = true; }
  private async save() {
    const payload: any = { ...this.s, memory: this.memory }; delete payload.has_own_key; delete payload.has_own_task_key;
    if (!payload.own_key) delete payload.own_key;
    if (!payload.own_task_key) delete payload.own_task_key;
    if (store.data?.usage?.tasks?.mode !== "user") delete payload.task_key_choice;
    if (store.data?.view?.locked) delete payload.view;
    delete payload.notify_service;  // replaced by the device choice
    payload.notify_device = this.deviceSel;
    try { await store.api.ws("settings/save", { settings: payload }); } catch (e: any) { store.notify(e.message); return; }
    this.dirty = false; store.notify(t("Gespeichert")); await store.load(); this.reset();
    store.api.ws("usage/history").then(r => (this.history = r));
  }
  private async newImport() {
    const r = await store.api.ws("import/token");
    const url = `${location.origin}${r.path}`;
    this.imp = { url, prompt: claudeImportPrompt(url), expires: r.expires };
  }
  @state() private impBusy = "";
  private async uploadImport(e: any) {
    const files: File[] = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    const sum: any = { chats: 0, projects: 0, skills: 0, credentials: 0, tasks: 0, skipped: 0, files: [] as any[] };
    for (const [i, f] of files.entries()) {
      this.impBusy = `${i + 1}/${files.length}: ${f.name} wird hochgeladen …`;
      try {
        const r = await store.api.uploadImport(f, (d, t) => {
          this.impBusy = `${i + 1}/${files.length}: ${f.name} – ${Math.round((100 * d) / t)} %${d >= t ? " · wird verarbeitet …" : ""}`; });
        for (const k of ["chats", "projects", "skills", "credentials", "tasks", "skipped"]) sum[k] += r[k] || 0;
        sum.files.push({ name: f.name, error: r.error, info: r.info, found: r.found });
      } catch (err: any) { sum.files.push({ name: f.name, error: err.message }); }
    }
    this.impBusy = ""; this.impResult = sum;
    await store.load(); store.notify("Import abgeschlossen");
  }
  private taskKeySection() {
    const tk = store.data?.usage?.tasks; const s = this.s;
    if (!tk || tk.mode === "same") return nothing;
    if (tk.mode === "shared") return html`<section><h2>${icon("task", 18)} Schlüssel für geplante Aufgaben</h2>
      <div class="hint">${tk.has_central ? "Deine geplanten Aufgaben laufen über den zentralen Aufgaben-Schlüssel, den der Admin eingetragen hat. Chats und Coworks behalten so ihr volles Kontingent."
        : "Der Admin hat einen zentralen Aufgaben-Schlüssel vorgesehen, aber noch nicht eingetragen – bis dahin laufen Aufgaben über den normalen Schlüssel."}</div></section>`;
    const choice = s.task_key_choice || "same";
    const opts: [string, string, string, boolean][] = [
      ["same", "Ein Schlüssel für alles", "Aufgaben, Chats und Coworks nutzen denselben Schlüssel und teilen sich dessen Limits.", true],
      ["own", "Eigener Schlüssel für Aufgaben", "Aufgaben verbrauchen nichts vom Kontingent für spontane Chats und Coworks.", true],
      ["shared", "Zentraler Aufgaben-Schlüssel", tk.has_central ? "Vom Admin eingetragen; alle, die ihn wählen, teilen sich seine Limits."
        : "Nicht verfügbar – der Admin hat keinen zentralen Aufgaben-Schlüssel eingetragen.", !!tk.has_central || choice === "shared"]];
    return html`<section><h2>${icon("task", 18)} Schlüssel für geplante Aufgaben</h2><div class="form">
      ${opts.map(([k, l, h, ok]) => html`<label class="opt ${choice === k ? "on" : ""}" style=${ok ? "" : "opacity:.5;cursor:default"}>
        <input type="radio" name="tkc" ?disabled=${!ok} .checked=${choice === k} @change=${() => this.set("task_key_choice", k)}>
        <div><b>${l}</b><div class="hint">${h}</div></div></label>`)}
      ${choice === "own" ? html`<label class="f"><span>Schlüssel für geplante Aufgaben (${store.data.provider.name})</span>
        <input type="password" autocomplete="off" placeholder=${s.has_own_task_key ? "••• gespeichert – zum Ändern neu eingeben" : "Schlüssel eintragen"}
          @input=${(e: any) => this.set("own_task_key", e.target.value)}></label>` : nothing}
      <div class="hint">Gilt für alle Läufe geplanter Aufgaben, auch „Jetzt ausführen“. Läufe auf einem eigenen oder zentralen Aufgaben-Schlüssel
        zählen nicht zum persönlichen Tageskontingent.</div></div></section>`;
  }
  private externalSection() {
    const e = store.data?.external || {};
    if (!e.has_access && !e.consent) return nothing;
    const months: any[] = this.history?.external?.months || [];
    const max = Math.max(0.01, ...months.map(m => m.eur));
    const names = this.history?.external?.names || {};
    const cur = months[months.length - 1];
    return html`<section><h2>${icon("euro", 18)} Kostenpflichtige externe Modelle</h2><div class="card form">
      ${externalExplanation()}
      <div class="row" style="flex-wrap:wrap">${e.consent ? html`<span class="chip ok">${icon("check", 13)} Du hast zugestimmt</span>
          <button class="btn ghost" @click=${async () => { await store.api.ws("external/consent", { accept: false }); await store.load(); store.notify("Zustimmung zurückgenommen"); }}>Zustimmung zurücknehmen</button>
          <span class="hint">Danach sind externe Modelle für dich gesperrt; Aufgaben weichen nicht mehr aus.</span>`
        : html`<button class="btn primary" @click=${async () => { if (await ensureConsent()) store.notify("Zugestimmt"); }}>Lesen und zustimmen …</button>`}</div>
      <div><div class="row"><b class="grow">Diesen Monat</b><span>${fmtEur(e.month_eur || 0)} von ${fmtEur(e.limit_eur || 0)}</span></div>
        <div style="height:6px;border-radius:4px;background:var(--lm-hover);overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.min(100, Math.round(100 * (e.month_eur || 0) / (e.limit_eur || 1)))}%;background:var(--lm-accent)"></div></div>
        ${cur && Object.keys(cur.models || {}).length ? html`<div class="hint" style="margin-top:6px">${Object.entries(cur.models).map(([k, v]: any) => `${names[k] || k}: ${fmtEur(v.eur)} (${v.requests} Anfragen)`).join(" · ")}</div>` : nothing}</div>
      ${months.some(m => m.eur > 0) ? html`<div><div class="bars" style="height:80px">${months.map(m => html`<div title="${m.month}: ${fmtEur(m.eur)} · ${m.requests} Anfragen" style="height:${Math.max(2, (m.eur / max) * 74)}px"></div>`)}</div>
        <div class="hint">Kosten je Monat, letzte 12 Monate. Das Limit legt der Admin fest; am Monatsersten beginnt es neu.</div></div>` : nothing}
    </div></section>`;
  }
  private vorgabe(role: "chat" | "agent") {
    const b = store.data.defaults.base?.[role] || {};
    return b.auto ? `Vorgabe – automatisch (derzeit ${modelName(b.model)})` : `Vorgabe (${modelName(b.model)})`;
  }
  render() {
    const d = store.data; const s = this.s;
    const days = this.history ? Object.entries(this.history.days).sort(([a], [b]) => a.localeCompare(b)).slice(-30) : [];
    const max = Math.max(1, ...days.map(([, v]: any) => v.prompt + v.completion));
    const perms = Object.entries(s.permissions || {});
    const simple = isSimple();
    const v = d.view || {};
    const chosen = v.locked ? v.view : s.view || v.view || "simple";
    const views: [string, string, string, string][] = [
      ["simple", "mdi:chat-processing-outline", "Einfache Ansicht", "Nur deine Nachricht und die Antwort – wie in einem Messenger. LLMitMir wählt die passende KI selbst, "
        + "antwortet verständlich und erklärt Skills, geplante Aufgaben, Zugänge und Projekte."],
      ["expert", "mdi:tune-variant", "Expertenansicht", "Alles im Blick und selbst steuern: Modellwahl und Auslastung, Cowork mit Schrittliste, "
        + "Werkzeug-Schritte, Gedanken der Modelle, Verbrauch und alle Einstellungen."]];
    return html`<div class="page"><h1>${t("Einstellungen")}</h1>
      <section><h2>${icon("eye", 18)} Ansicht</h2><div class="form">
        ${views.map(([k, ic, l, h]) => html`<label class="opt ${chosen === k ? "on" : ""}" style=${v.locked && chosen !== k ? "opacity:.5;cursor:default" : ""}>
          <input type="radio" name="view" ?disabled=${v.locked} .checked=${chosen === k} @change=${() => this.set("view", k)}>
          <div class="grow"><b class="row" style="gap:6px">${icon(ic, 18)} ${l}</b><div class="hint">${h}</div></div></label>`)}
        ${v.locked ? html`<div class="hint">${icon("lock", 14)} Die Ansicht hat ${d.user.is_admin ? "ein Admin (unter Admin → Ansicht)" : "der Admin"} für dich festgelegt.</div>`
          : html`<div class="hint">Wirkt nach dem Speichern sofort. Du kannst jederzeit zurückwechseln.</div>`}</div></section>
      ${simple ? nothing : html`<section><h2>${icon("sparkle", 18)} Modelle</h2><div class="two">
        <label class="f"><span>Standard für Chats</span><select @change=${(e: any) => this.set("model_chat", e.target.value || null)}>
          <option value="">${this.vorgabe("chat")}</option>${d.models.filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${s.model_chat === m.id}>${m.name}</option>`)}</select></label>
        <label class="f"><span>Standard für Coworks & Aufgaben</span><select @change=${(e: any) => this.set("model_agent", e.target.value || null)}>
          <option value="">${this.vorgabe("agent")}</option>${d.models.filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${s.model_agent === m.id}>${m.name}</option>`)}</select></label></div>
        <div class="hint" style="margin-top:8px">„Vorgabe“ heißt: LLMitMir nimmt das passendste Modell, das gerade nicht überlastet ist, und berücksichtigt
          neu erschienene Modelle von selbst. Mit einem festen Modell empfiehlt der Chat einen Wechsel, wenn es stark ausgelastet ist.</div></section>`}
      ${d.key_mode === "per_user_own" ? html`<section><h2>${icon("key", 18)} Dein API-Schlüssel</h2>
        <label class="f"><span>Schlüssel für ${d.provider.name}</span><input type="password" autocomplete="off" placeholder=${s.has_own_key ? "••• gespeichert – zum Ändern neu eingeben" : "Schlüssel eintragen"}
          @input=${(e: any) => this.set("own_key", e.target.value)}></label>
        <div class="hint">Der Schlüssel gilt nur für dich. Limits und Verbrauch beziehen sich auf ihn.</div></section>` : nothing}
      ${this.taskKeySection()}
      ${this.externalSection()}
      <section><h2>${icon("bell", 18)} Benachrichtigungen</h2>
        ${!this.devicesLoaded ? html`<div class="hint">Geräte werden geladen …</div>` : this.devices.length ? html`<label class="f"><span>Gerät für Push-Nachrichten (Aufgaben, Werkzeug „Benachrichtigen“)</span>
          <select @change=${(e: any) => { this.deviceSel = e.target.value; this.dirty = true; }}>
            ${this.devices.length > 1 ? html`<option value="" ?selected=${!this.deviceSel}>bitte wählen</option>` : nothing}
            ${this.devices.map((d: any) => html`<option value=${d.key} ?selected=${this.deviceSel === d.key}>${d.name}${d.available ? "" : " (nicht erreichbar)"}</option>`)}</select></label>
          <div class="hint">Zur Auswahl stehen nur die Geräte, die in Home Assistant mit deinem Benutzer verknüpft sind.
            ${d.user.is_admin ? html`Welches Gerät zu wem gehört, siehst und änderst du unter <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/admin"); }}>Admin → Benachrichtigungsgeräte</a>.`
              : "Fehlt dein Gerät, frag einen Admin von Home Assistant."}</div>`
          : html`<div class="hint">Deinem Benutzer ist in Home Assistant noch kein Gerät zugeordnet – deshalb gibt es hier nichts auszuwählen.
            ${d.user.is_admin ? html`Unter <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/admin"); }}>Admin → Benachrichtigungsgeräte</a> kannst du Geräte zuordnen.`
              : "Ein Admin von Home Assistant kann dein Handy mit deinem Benutzer verknüpfen."}</div>`}</section>
      <section><h2>${icon("user", 18)} ${t("Persönliche Hinweise")}</h2>
        <textarea rows="7" placeholder="Was soll LLMitMir immer über dich wissen? Vorlieben, Schreibstil, Zusammenhänge …" .value=${this.memory}
          @input=${(e: any) => { this.memory = e.target.value; this.dirty = true; }}></textarea>
        <div class="hint">Fließt in jeden Chat, jedes Cowork und jede Aufgabe ein.</div></section>
      <section><h2>${icon("chat", 18)} ${simple ? "Bedienung" : "Darstellung & Bedienung"}</h2><div class="form">
        ${simple ? nothing : html`<label class="row"><input type="checkbox" style="width:auto" .checked=${s.show_reasoning !== false} @change=${(e: any) => this.set("show_reasoning", e.target.checked)}> Gedanken der Modelle anzeigen</label>`}
        <label class="row"><input type="checkbox" style="width:auto" .checked=${s.send_on_enter !== false} @change=${(e: any) => this.set("send_on_enter", e.target.checked)}> Mit Enter senden (Umschalt+Enter = neue Zeile; auf Touch-Geräten immer Zeilenumbruch)</label></div></section>
      ${perms.length ? html`<section><h2>${icon("lock", 18)} Dauerhafte Freigaben (ohne Projekt)</h2>
        ${perms.map(([n, v]) => html`<div class="row" style="padding:4px 0"><span class="grow">${d.tools[n]?.label || n}: ${v === "allow" ? "erlaubt" : v === "deny" ? "verboten" : "fragen"}</span>
          <button class="btn ghost" @click=${() => { const p = { ...s.permissions }; delete p[n]; this.set("permissions", p); }}>Zurücksetzen</button></div>`)}</section>` : nothing}
      ${simple ? nothing : html`<section><h2>${icon("mdi:console", 18)} Werkbank</h2>
        ${werkbankInfo(!!d.werkbank?.configured, this.guide, () => (this.guide = !this.guide), d.user.is_admin)}
        ${d.user.is_admin ? html`<div class="hint" style="margin-top:8px">URL und Token trägst du unter <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/admin"); }}>Admin → Werkbank</a> ein.</div>` : nothing}</section>`}
      <section><h2>${icon("gauge", 18)} ${t("Verbrauch")}</h2>
        <div class="card"><div class="row"><span class="grow">Heute: <b>${d.usage.today.requests}</b> Anfragen · <b>${fmtNum(d.usage.today.prompt + d.usage.today.completion)}</b> Tokens</span>
          ${d.usage.quota.requests_day ? html`<span class="chip">Kontingent ${d.usage.quota.requests_day} Anfragen/Tag</span>` : nothing}
          ${d.usage.quota.tokens_day ? html`<span class="chip">${fmtNum(d.usage.quota.tokens_day)} Tokens/Tag</span>` : nothing}</div>
          ${d.usage.today.task_requests ? html`<div class="hint">davon geplante Aufgaben: ${d.usage.today.task_requests} Anfragen · ${fmtNum((d.usage.today.task_prompt || 0) + (d.usage.today.task_completion || 0))} Tokens</div>` : nothing}
          ${days.length ? html`<div class="bars">${days.map(([day, v]: any) => html`<div title="${day}: ${v.requests} Anfragen, ${fmtNum(v.prompt + v.completion)} Tokens"
            style="height:${Math.max(2, ((v.prompt + v.completion) / max) * 110)}px"></div>`)}</div><div class="hint">Tokens je Tag, letzte ${days.length} Tage</div>` : nothing}</div>
        ${d.tasks?.length && !simple ? html`<div style="margin-top:12px">${taskUsageCard(d.usage.tasks, this.history?.task_key_days)}</div>` : nothing}</section>
      ${simple ? html`<div class="hint">Modelle, Werkbank und der Import aus Claude stehen in der Expertenansicht.</div>` : html`<section><h2>${icon("import", 18)} Import aus Claude</h2><div class="card form">
        <div><b>1. Skills, Zugänge, geplante Aufgaben, Projekte und Erinnerungen</b>
          <div class="hint">Erzeuge einen Einmal-Link (24 h gültig) und füge den Prompt in Claude ein (am besten Claude Code oder ein Cowork mit Werkzeugen).
            Claude sammelt alles, löst Zugangsdaten aus den Skills heraus und schickt es direkt hierher. Importierte Aufgaben sind zunächst pausiert.</div></div>
        ${this.imp ? html`<div class="prompt">${this.imp.prompt}</div><div class="row">
          <button class="btn primary" @click=${() => copyText(this.imp.prompt)}>${icon("copy", 16)} Prompt kopieren</button>
          <span class="hint">Link gültig bis ${fmtTime(this.imp.expires)}</span></div>
          <div class="hint">Wichtig: Claude muss ${location.host} erreichen können. Geht das nicht, liefert Claude eine Datei <code>llmitmir-import.json</code>, die du unten hochlädst.</div>`
          : html`<div><button class="btn primary" @click=${this.newImport}>${icon("plus", 16)} Import-Link und Prompt erzeugen</button></div>`}
        <div><b>2. Chatverläufe</b><div class="hint">In claude.ai unter Einstellungen → Datenschutz → „Daten exportieren“. Die ZIP-Datei aus der E-Mail hier hochladen
          (enthält Chats, Projekte und Erinnerungen). Auch die Datei <code>llmitmir-import.json</code> aus Schritt 1 kannst du hier hochladen.</div>
          <div class="hint" style="margin-top:6px">Wähle <b>alle ZIP-Dateien</b> des Exports auf einmal aus (z. B. conversations-000.zip, projects-000.zip,
            frames-000.zip, claude_code_cloud-000.zip) – die Manifest-Datei brauchst du nicht. Mehrfaches Hochladen legt nichts doppelt an.</div>
          <label class="btn" style="margin-top:8px" ?disabled=${!!this.impBusy}>${this.impBusy ? html`<lm-spark size="16"></lm-spark>` : icon("upload", 16)} ZIP- oder JSON-Dateien hochladen
            <input type="file" multiple accept=".zip,.json" hidden @change=${this.uploadImport}></label>
          ${this.impBusy ? html`<div class="hint" style="margin-top:6px">${this.impBusy}</div>` : nothing}</div>
        ${this.impResult ? html`<div class="card" style="font-size:13.5px"><b>Übernommen:</b> ${this.impResult.chats} Chats, ${this.impResult.projects} Projekte,
          ${this.impResult.skills} Skills, ${this.impResult.credentials} Zugänge, ${this.impResult.tasks} Aufgaben${this.impResult.skipped ? ` · ${this.impResult.skipped} schon vorhanden (übersprungen)` : ""}
          <ul style="margin:8px 0 0;padding-left:1.2em">${this.impResult.files.map((f: any) => html`<li>${f.name}: ${f.error ? html`<span style="color:var(--lm-err)">${f.error}</span>`
            : f.info || (f.found?.length ? f.found.join(", ") : "ok")}</li>`)}</ul></div>` : nothing}
      </div></section>`}
      ${this.dirty ? html`<div class="savebar fade-in"><button class="btn" @click=${() => this.reset()}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

// ---------------------------------------------------------------- admin
@safeElement("lm-admin")
export class AdminPage extends StoreElement {
  @state() private a: any = null;
  @state() private dirty = false;
  @state() private loading = false;
  @state() private wbTest: any = null;
  @state() private guide = false;
  static styles = [base, css2, taskUsageCss];
  connectedCallback() { super.connectedCallback(); this.load(); }
  private async load() { try { this.a = await store.api.ws("admin/get"); this.dirty = false; } catch (e: any) { store.notify(e.message); } }
  private set(k: string, v: any) { this.a = { ...this.a, [k]: v }; this.dirty = true; }
  private async save() {
    const a = this.a;
    try {
      this.a = await store.api.ws("admin/save", { config: { provider: a.provider, key_mode: a.key_mode, shared_key: a.shared_key, user_keys: a.user_keys,
        task_key_mode: a.task_key_mode, shared_task_key: a.shared_task_key,
        allowed_users: a.allowed_users, quota_default: a.quota_default, quota_users: a.quota_users, search: a.search, werkbank: a.werkbank, views: a.views,
        notify_devices: { overrides: a.notify_overrides || {} },
        models: { enabled: a.models.enabled, defaults: a.models.defaults, context: a.models.context, auto_enable_new: a.models.auto_enable_new !== false },
        providers: a.providers.map((p: any) => ({ id: p.id, enabled: p.enabled, mode: p.mode, key: p.key, endpoint: p.endpoint, extra_models: p.extra_models })),
        model_access: a.model_access, billing: a.billing } });
      this.dirty = false; store.notify(t("Gespeichert"));
      window.dispatchEvent(new CustomEvent("llmitmir-admin-saved"));
      if (store.data) await store.load();
    } catch (e: any) { store.notify(e.message); }
  }
  private async refresh() {
    this.loading = true;
    try { this.a = await store.api.ws("admin/models_refresh", this.a.shared_key && this.a.shared_key !== "•••" ? { key: this.a.shared_key } : {}); store.notify("Modelle geladen"); }
    catch (e: any) { store.notify(e.message); }
    this.loading = false;
  }
  private deviceSection(users: any[]) {
    const devs: any[] = this.a.notify_devices || [];
    const ov: Record<string, string> = this.a.notify_overrides || {};
    const setOv = (key: string, uid: string) => {
      const next = { ...ov };
      if (uid) next[key] = uid; else delete next[key];
      this.set("notify_overrides", next);
    };
    const byUser = new Map<string, string[]>();
    for (const d of devs) {
      const uid = ov[d.key] !== undefined ? ov[d.key] : d.user_id;
      if (uid) byUser.set(uid, [...(byUser.get(uid) || []), d.name]);
    }
    return html`<section><h2>${icon("bell", 18)} Benachrichtigungsgeräte</h2>
      <div class="hint" style="margin-bottom:10px">Welches Gerät zu welcher Person gehört, sagt Home Assistant: Ein Handy gehört der Person,
        die die Home-Assistant-App darauf eingerichtet hat. Jede Person wählt in ihren Einstellungen nur noch unter ihren eigenen Geräten.
        Stimmt eine Zuordnung nicht, korrigierst du sie hier – die Korrektur gilt sofort und überlebt neue Anmeldungen des Geräts.</div>
      ${devs.length ? html`<div class="tw"><table><tr><th>Gerät</th><th>Person</th><th>Herkunft</th></tr>
        ${devs.map((d: any) => { const uid = ov[d.key] !== undefined ? ov[d.key] : (d.user_id || "");
          return html`<tr><td><b>${d.name}</b>${d.available ? nothing : html` <span class="chip">nicht erreichbar</span>`}
              <div class="hint">${d.service || d.entity_id || "kein Dienst"}</div></td>
            <td><select style="width:auto;padding:6px 8px" @change=${(e: any) => setOv(d.key, e.target.value)}>
              <option value="" ?selected=${!uid}>– keine Person –</option>
              ${users.map((u: any) => html`<option value=${u.id} ?selected=${uid === u.id}>${u.name}</option>`)}</select></td>
            <td class="hint">${ov[d.key] !== undefined ? html`von dir zugeordnet${d.user_id && d.user_id !== ov[d.key] ? " (Home Assistant sagt: " + (users.find((u: any) => u.id === d.user_id)?.name || "andere Person") + ")" : ""}`
              : d.user_id ? "aus Home Assistant" : "in Home Assistant keiner Person zugeordnet"}</td></tr>`; })}</table></div>`
        : html`<div class="hint">Keine Geräte gefunden – die Home-Assistant-App muss auf dem Handy eingerichtet sein.</div>`}
      <div class="hint" style="margin-top:10px">${users.map((u: any) => html`<div>${u.name}: ${byUser.get(u.id)?.join(", ") || "kein Gerät"}</div>`)}</div>
      <div class="hint" style="margin-top:6px">Hat eine Person mehrere Geräte, wählt sie selbst; hat sie nur eines, gilt das automatisch.</div></section>`;
  }
  @state() private provBusy = "";
  private setProv(pid: string, patch: any) { this.set("providers", this.a.providers.map((p: any) => (p.id === pid ? { ...p, ...patch } : p))); }
  private moveProv(i: number, dir: number) {
    const list = [...this.a.providers]; const j = i + dir; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; this.set("providers", list);
  }
  private async refreshProv(pid: string) {
    if (this.dirty) { await this.save(); if (this.dirty) return; }
    this.provBusy = pid;
    try { this.a = await store.api.ws("admin/provider_refresh", { provider_id: pid }); store.notify("Modelle abgerufen"); if (store.data) await store.load(); }
    catch (e: any) { store.notify(e.message); }
    this.provBusy = "";
  }
  private providersSection() {
    const a = this.a; const info = a.provider_info || {};
    const keyInput = (p: any, label: string, ph: string) => html`<label class="f"><span>${label}</span><input type="password" autocomplete="off" placeholder=${ph} .value=${p.key || ""}
      @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => this.setProv(p.id, { key: e.target.value })}></label>`;
    return html`<section><h2>${icon("list", 18)} KI-Anbieter und Reihenfolge</h2>
      <div class="hint" style="margin-bottom:10px">Neben dem Hauptanbieter oben kannst du kostenpflichtige Anbieter für Claude hinterlegen. Die <b>Reihenfolge</b> entscheidet über den Notfall:
        Ein Anbieter mit „Nur im Notfall“ wird erst wählbar, wenn <b>alle</b> eingeschalteten Anbieter davor für die Person gerade nicht nutzbar sind (Limit erreicht, Schlüssel abgelehnt,
        Monatslimit verbraucht). „Immer wählbar“ heißt: im Modellmenü jederzeit auswählbar. LLMitMir nimmt externe Modelle nie von selbst – nur auf ausdrücklichen Wunsch
        oder wenn eine geplante Aufgabe im Notfall ausweichen darf. Wer welches Modell bekommt und die Preise legst du unten fest.</div>
      ${a.sdk === false ? html`<div class="card" style="color:var(--lm-err)">${icon("alert", 16)} Das Python-Paket „anthropic“ fehlt noch – Home Assistant neu starten, damit es installiert wird.</div>` : nothing}
      <div class="prov">${a.providers.map((p: any, i: number) => { const ext = p.id !== "main"; const st = p.state || {};
        return html`<div class="card ${ext && !p.enabled ? "off" : ""}">
          <div class="head"><span class="pos">${i + 1}</span><b class="grow">${ext ? info[p.id]?.label : `${a.provider.name || "Hauptanbieter"} (Hauptanbieter)`}</b>
            <button class="iconbtn" title="Nach oben" ?disabled=${i === 0} @click=${() => this.moveProv(i, -1)}>${icon("up", 18)}</button>
            <button class="iconbtn" title="Nach unten" ?disabled=${i === a.providers.length - 1} @click=${() => this.moveProv(i, 1)}>${icon("arrowDown", 18)}</button>
            ${ext ? html`<label class="row" style="gap:6px"><input type="checkbox" style="width:auto" .checked=${!!p.enabled} @change=${(e: any) => this.setProv(p.id, { enabled: e.target.checked })}> eingeschaltet</label>` : nothing}</div>
          ${!ext ? html`<div class="hint">Vorlage, Basis-URL und Schlüssel stehen oben unter „Anbieter“ und „API-Schlüssel“. Kostenlos für die Personen, immer wählbar; nur seine Modelle wählt LLMitMir automatisch.</div>` : html`
          <div class="two"><label class="f"><span>Verfügbarkeit</span><select @change=${(e: any) => this.setProv(p.id, { mode: e.target.value })}>
              <option value="fallback" ?selected=${p.mode !== "always"}>Nur im Notfall</option><option value="always" ?selected=${p.mode === "always"}>Immer wählbar</option></select></label>
            ${p.id === "foundry" ? html`<label class="f"><span>Endpunkt (Ressourcenname oder Claude-Adresse)</span><input placeholder="https://<ressource>.services.ai.azure.com/anthropic" .value=${p.endpoint || ""}
              @input=${(e: any) => this.setProv(p.id, { endpoint: e.target.value })}></label>` : keyInput(p, "API-Schlüssel (Anthropic Console)", "sk-ant-…")}</div>
          ${p.id === "foundry" ? html`<div class="two">${keyInput(p, "API-Schlüssel der Foundry-Ressource", "Schlüssel aus „Schlüssel und Endpunkt“")}
            <label class="f"><span>Weitere Deployment-Namen (optional, durch Komma getrennt)</span><input placeholder="z. B. mein-claude-sonnet" .value=${(p.extra_models || []).join(", ")}
              @input=${(e: any) => this.setProv(p.id, { extra_models: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean) })}></label></div>
            <div class="hint">Endpunkt: der Name der Ressource oder die Claude-Adresse <code>https://&lt;ressource&gt;.services.ai.azure.com/anthropic</code> (die Azure-OpenAI-Adresse
              derselben Ressource rechnet LLMitMir um). Foundry hat keine Modellliste: LLMitMir fragt jedes bekannte Claude-Modell (und die Namen oben) kostenlos per Token-Zählung ab und übernimmt die Deployments, die antworten.
              Nur „Hosted on Azure“-Deployments verlassen Azure nicht. Abgerechnet wird über die Azure-Rechnung zu den Anthropic-Listenpreisen.</div>`
            : html`<div class="hint">Die Modellliste kommt direkt von der Anthropic-API. Abgerechnet wird über die Anthropic Console – dort am besten zusätzlich ein Ausgabenlimit setzen.</div>`}
          <div class="row" style="flex-wrap:wrap">
            <button class="btn" ?disabled=${!p.enabled || this.provBusy === p.id} @click=${() => this.refreshProv(p.id)}>${this.provBusy === p.id ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} Modelle abrufen${this.dirty ? " (speichert vorher)" : ""}</button>
            <span class="hint">${(p.models || []).length} Modelle${p.models_at ? ` · abgerufen ${fmtTime(p.models_at)}` : ""}</span>
            ${st.blocked ? html`<span class="chip err">${icon("alert", 13)} gesperrt: ${st.reason} (noch ${Math.ceil(st.blocked_for / 60)} min)</span>`
              : st.last_ok ? html`<span class="chip ok">${icon("check", 13)} zuletzt erfolgreich ${fmtTime(st.last_ok)}</span>` : nothing}
            ${st.last_error && !st.blocked ? html`<span class="hint" style="color:var(--lm-err)">${st.last_error}</span>` : nothing}</div>`}
        </div>`; })}</div></section>`;
  }
  private extModelsSection(users: any[]) {
    const a = this.a; const b = a.billing || {}; const models = a.ext_models || [];
    if (!models.length) return nothing;
    const acc = a.model_access || {};
    const setAcc = (key: string, uid: string, on: boolean) => {
      const cur = new Set<string>(acc[key] || []); on ? cur.add(uid) : cur.delete(uid);
      this.set("model_access", { ...acc, [key]: [...cur] });
    };
    const setPrice = (key: string, k: string, v: string) => {
      const pr = { ...(b.prices || {}) }; const cur = { ...(pr[key] || {}) };
      if (v === "") delete cur[k]; else cur[k] = v.replace(",", ".");
      if (!cur.in && !cur.out) delete pr[key]; else pr[key] = cur;
      this.set("billing", { ...b, prices: pr });
    };
    const sorted = [...models].sort((x: any, y: any) => (x.blended || 0) - (y.blended || 0));
    return html`<section><h2>${icon("euro", 18)} Externe Modelle: Preise und Freigaben</h2>
      <div class="hint" style="margin-bottom:10px">Ein externes Modell bekommt nur, wer hier angehakt ist <b>und</b> unten ein Monatslimit über 0 € hat. Preise in € je Million Tokens;
        leer = Anthropic-Listenpreis umgerechnet mit dem Kurs unten. Ohne Preis wird ein Modell niemandem angeboten (keine Abrechnung möglich). Die Personen sehen die Modelle vom günstigsten zum teuersten.</div>
      <div class="tw"><table class="matrix"><tr><th>Modell</th><th class="num">Lesen €/Mio.</th><th class="num">Schreiben €/Mio.</th>${users.map((u: any) => html`<th>${u.name}</th>`)}</tr>
        ${sorted.map((m: any) => { const ov = (b.prices || {})[m.key] || {}; const p = m.price;
          return html`<tr><td>${m.name}<div class="hint">${m.provider_name} · ${m.id}${p ? "" : html` · <span style="color:var(--lm-err)">Preis fehlt</span>`}</div></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${p ? String(p.in).replace(".", ",") : "?"} .value=${ov.in != null ? String(ov.in).replace(".", ",") : ""} @input=${(e: any) => setPrice(m.key, "in", e.target.value)}></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${p ? String(p.out).replace(".", ",") : "?"} .value=${ov.out != null ? String(ov.out).replace(".", ",") : ""} @input=${(e: any) => setPrice(m.key, "out", e.target.value)}></td>
            ${users.map((u: any) => html`<td><input type="checkbox" .checked=${(acc[m.key] || []).includes(u.id)} @change=${(e: any) => setAcc(m.key, u.id, e.target.checked)}></td>`)}</tr>`; })}</table></div>
      <div class="two" style="margin-top:12px">
        <label class="f"><span>Umrechnungskurs USD → EUR (für Listenpreise)</span><input inputmode="decimal" .value=${String(b.usd_eur ?? 0.86).replace(".", ",")}
          @input=${(e: any) => this.set("billing", { ...b, usd_eur: e.target.value.replace(",", ".") })}></label>
        <label class="f"><span>Ersatzmodell für Notfälle (einfache Ansicht, Aufgaben)</span><select @change=${(e: any) => this.set("billing", { ...b, fallback_model: e.target.value })}>
          <option value="" ?selected=${!b.fallback_model}>Das günstigste freigegebene Modell</option>
          ${sorted.map((m: any) => html`<option value=${m.key} ?selected=${b.fallback_model === m.key}>${m.name} (${m.provider_name})</option>`)}</select></label></div>
      <div class="hint" style="margin-top:6px">Cache-Preise (wiederholt gelesener Verlauf) leitet LLMitMir aus dem Lesepreis ab (Listenpreise: genau nach Anthropic). Jede Anfrage wird mit dem Preis
        gebucht, der in dem Moment galt – spätere Preisänderungen ändern die Vergangenheit nicht.</div></section>`;
  }
  private costsSection(users: any[]) {
    const a = this.a; const b = a.billing || {}; const costs = a.costs || {};
    if (!(a.providers || []).some((p: any) => p.id !== "main" && p.enabled) && !Object.values(costs).some((c: any) => c.months?.some((m: any) => m.eur > 0))) return nothing;
    const limits = b.limits || {};
    const all = users.map((u: any) => costs[u.id]?.months || []);
    const max = Math.max(0.01, ...all.flat().map((m: any) => m.eur));
    const total = all.reduce((sum: number, ms: any[]) => sum + (ms[ms.length - 1]?.eur || 0), 0);
    const monthLabel = (k: string) => { const [y, m] = k.split("-"); return `${m}/${y.slice(2)}`; };
    return html`<section><h2>${icon("gauge", 18)} Kosten und Monatslimits (externe Modelle)</h2>
      <div class="hint" style="margin-bottom:10px">Jede Anfrage an ein externes Modell wird dauerhaft mit Tokens und Kosten erfasst. Das Monatslimit gilt je Person in Euro;
        ist es erreicht, sind externe Modelle für sie bis zum Monatsersten gesperrt (ein laufender Schritt wird noch fertig). 0 € = keine externen Modelle.</div>
      <label class="f" style="max-width:320px"><span>Standard-Limit je Person (€/Monat)</span><input inputmode="decimal" .value=${String(b.limit_default ?? 0).replace(".", ",")}
        @input=${(e: any) => this.set("billing", { ...b, limit_default: e.target.value.replace(",", ".") })}></label>
      <div class="tw" style="margin-top:12px"><table><tr><th>Person</th><th class="num">Limit €/Monat</th><th class="num">Dieser Monat</th><th>Letzte 12 Monate</th><th class="num">Gesamt</th></tr>
        ${users.map((u: any, i: number) => { const ms = all[i]; const cur = ms[ms.length - 1] || {}; const sum = ms.reduce((x: number, m: any) => x + m.eur, 0);
          const lim = costs[u.id]?.limit || 0;
          return html`<tr><td>${u.name}</td>
            <td class="num"><input style="width:90px" inputmode="decimal" placeholder=${String(b.limit_default || 0).replace(".", ",")} .value=${limits[u.id] != null ? String(limits[u.id]).replace(".", ",") : ""}
              @input=${(e: any) => { const l = { ...limits }; if (e.target.value === "") delete l[u.id]; else l[u.id] = e.target.value.replace(",", "."); this.set("billing", { ...b, limits: l }); }}></td>
            <td class="num">${fmtEur(cur.eur || 0)}${lim ? html`<div class="hint">${Math.round(100 * (cur.eur || 0) / lim)} %</div>` : nothing}</td>
            <td><div class="mbars">${ms.map((m: any) => html`<div title="${monthLabel(m.month)}: ${fmtEur(m.eur)} · ${m.requests} Anfragen · ${fmtNum(m.input + m.output + m.cache_read + m.cache_write)} Tokens${m.task_eur ? ` · davon Aufgaben ${fmtEur(m.task_eur)}` : ""}"
              style="height:${Math.max(1, (m.eur / max) * 32)}px"></div>`)}</div></td>
            <td class="num">${fmtEur(sum)}</td></tr>`; })}
        <tr><td><b>Alle</b></td><td></td><td class="num"><b>${fmtEur(total)}</b></td><td></td><td></td></tr></table></div></section>`;
  }
  private viewSection(users: any[]) {
    const vw = this.a.views || { default: "choice", users: {} };
    const opts: [string, string][] = [["choice", "Selbst wählen (startet einfach)"], ["simple", "Immer einfache Ansicht"], ["expert", "Immer Expertenansicht"]];
    const setV = (next: any) => this.set("views", { ...vw, ...next });
    const effective = (u: any) => {
      const p = vw.users?.[u.id] || vw.default || "choice";
      return p === "choice" ? (u.view === "expert" ? "Experten (selbst gewählt)" : u.view === "simple" ? "Einfach (selbst gewählt)" : "Einfach") : p === "expert" ? "Experten" : "Einfach";
    };
    return html`<section><h2>${icon("eye", 18)} Ansicht</h2>
      <div class="hint" style="margin-bottom:10px">Die <b>einfache Ansicht</b> zeigt nur Nachricht und Antwort wie in einem Messenger, wählt Modelle immer automatisch,
        lässt die Modelle verständlich antworten und erklärt Skills, geplante Aufgaben, Zugänge und Projekte. Die <b>Expertenansicht</b> ist die volle Oberfläche.
        Mit „Selbst wählen“ startet jede Person einfach und kann die Expertenansicht in ihren Einstellungen einschalten.</div>
      <label class="f" style="max-width:420px"><span>Für alle</span><select @change=${(e: any) => setV({ default: e.target.value })}>
        ${opts.map(([k, l]) => html`<option value=${k} ?selected=${(vw.default || "choice") === k}>${l}</option>`)}</select></label>
      <div class="tw" style="margin-top:12px"><table><tr><th>Person</th><th>Ansicht</th><th>Derzeit</th></tr>
        ${users.map((u: any) => html`<tr><td>${u.name}${u.is_admin ? html` <span class="chip">Admin</span>` : nothing}</td>
          <td><select style="width:auto;padding:6px 8px" @change=${(e: any) => { const us = { ...(vw.users || {}) }; if (e.target.value) us[u.id] = e.target.value; else delete us[u.id]; setV({ users: us }); }}>
            <option value="" ?selected=${!vw.users?.[u.id]}>Wie für alle</option>
            ${opts.map(([k, l]) => html`<option value=${k} ?selected=${vw.users?.[u.id] === k}>${l}</option>`)}</select></td>
          <td class="hint">${effective(u)}</td></tr>`)}</table></div></section>`;
  }
  private taskKeySection() {
    const a = this.a; const tm = a.task_key_mode || "same"; const tu = a.task_usage || {};
    const modes = [["same", "Gleicher Schlüssel wie für alles andere", "Geplante Aufgaben teilen sich die Limits mit Chats und Coworks (bisheriges Verhalten)."],
      ["shared", "Zentraler Aufgaben-Schlüssel für alle", "Alle geplanten Aufgaben aller Personen laufen über einen eigenen Schlüssel – spontane Chats und Coworks behalten ihr volles Kontingent."],
      ["user", "Jede Person entscheidet selbst", "In den Einstellungen: ein Schlüssel für alles, ein eigener Aufgaben-Schlüssel oder der zentrale Aufgaben-Schlüssel (wenn du hier einen einträgst)."]];
    return html`<section><h2>${icon("task", 18)} Schlüssel für geplante Aufgaben</h2><div class="form">
      ${modes.map(([k, l, h]) => html`<label class="opt ${tm === k ? "on" : ""}"><input type="radio" name="tkm" .checked=${tm === k} @change=${() => this.set("task_key_mode", k)}>
        <div><b>${l}</b><div class="hint">${h}</div></div></label>`)}
      ${tm !== "same" ? html`<label class="f"><span>Zentraler Aufgaben-Schlüssel${tm === "user" ? " (optional)" : ""}</span>
        <input type="password" autocomplete="off" placeholder="nicht gesetzt" .value=${a.shared_task_key || ""}
          @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => this.set("shared_task_key", e.target.value)}></label>
        ${tm === "shared" && !a.shared_task_key ? html`<div class="hint">Solange kein Schlüssel eingetragen ist, nutzen Aufgaben den normalen Schlüssel.</div>` : nothing}` : nothing}
      ${tu.central ? usageBlock({ title: "Geplante Aufgaben auf dem zentralen Aufgaben-Schlüssel", label: taskKeyLabel("shared"), accent: true,
          todayLabel: "Alle Aufgaben aller Personen heute", today: tu.central.today, limits: tu.central.limits, days: tu.central.days }) : nothing}
      ${tu.shared && (tm !== "shared" || !tu.central) ? usageBlock({ title: "Geplante Aufgaben auf dem gemeinsamen Schlüssel", label: "gemeinsamer Schlüssel",
          todayLabel: "Alle Aufgaben aller Personen heute", today: tu.shared.today, limits: tu.shared.limits, days: tu.shared.days,
          notes: ["Nur Läufe geplanter Aufgaben; Chats und Coworks auf diesem Schlüssel sind hier nicht mitgezählt."] }) : nothing}
    </div></section>`;
  }
  render() {
    const a = this.a;
    if (!a) return html`<div class="page"><lm-spark></lm-spark></div>`;
    const users = a.users.filter((u: any) => u.is_active);
    const known = a.models.known || [];
    const enabled = new Set(a.models.enabled || []);
    const defs = a.models.defaults || {};
    const live: Record<string, any> = Object.fromEntries((a.models_live || []).map((m: any) => [m.id, m]));
    const modes = [["shared", "Ein gemeinsamer Schlüssel", "Alle nutzen denselben Schlüssel – und teilen sich dessen Limits (bei SAIA 800 Anfragen am Tag)."],
      ["per_user_admin", "Admin trägt je Person einen Schlüssel ein", "Jede Person hat eigene Limits; du verwaltest die Schlüssel zentral hier."],
      ["per_user_own", "Jede Person trägt ihren eigenen Schlüssel ein", "Im Panel unter Einstellungen. Ohne Schlüssel kein Zugriff auf Modelle."]];
    const lim = a.key_limits?.shared;
    return html`<div class="page"><h1>${t("Admin")}</h1>
      <section><h2>${icon("cloud", 18)} Anbieter</h2><div class="form">
        <div class="two"><label class="f"><span>Vorlage</span><select @change=${(e: any) => { const p = a.presets[e.target.value];
            this.set("provider", { ...a.provider, preset: e.target.value, name: p.name, base_url: p.base_url || a.provider.base_url, transcription_model: p.transcription_model }); }}>
            ${Object.entries(a.presets).map(([k, p]: any) => html`<option value=${k} ?selected=${a.provider.preset === k}>${p.name}</option>`)}</select></label>
          <label class="f"><span>Basis-URL (OpenAI-kompatibel)</span><input .value=${a.provider.base_url} @input=${(e: any) => this.set("provider", { ...a.provider, base_url: e.target.value })}></label></div>
        <div class="two"><label class="f"><span>Anzeigename</span><input .value=${a.provider.name || ""} @input=${(e: any) => this.set("provider", { ...a.provider, name: e.target.value })}></label>
          <label class="f"><span>Modell für Spracheingabe (/audio/transcriptions)</span><input .value=${a.provider.transcription_model || ""} @input=${(e: any) => this.set("provider", { ...a.provider, transcription_model: e.target.value })}></label></div>
        ${a.presets[a.provider.preset]?.hint ? html`<div class="hint">${a.presets[a.provider.preset].hint}</div>` : nothing}</div></section>
      <section><h2>${icon("key", 18)} API-Schlüssel</h2><div class="form">
        ${modes.map(([k, l, h]) => html`<label class="opt ${a.key_mode === k ? "on" : ""}"><input type="radio" name="km" .checked=${a.key_mode === k} @change=${() => this.set("key_mode", k)}>
          <div><b>${l}</b><div class="hint">${h}</div></div></label>`)}
        ${a.key_mode === "shared" ? html`<label class="f"><span>Gemeinsamer Schlüssel</span><input type="password" autocomplete="off" .value=${a.shared_key}
          @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => this.set("shared_key", e.target.value)}></label>
          ${lim?.limit_requests_day ? html`<div class="hint">Heute noch ${lim.remaining_requests_day} von ${lim.limit_requests_day} Anfragen, diese Stunde ${lim.remaining_requests_hour} von ${lim.limit_requests_hour}.</div>` : nothing}` : nothing}
        ${a.key_mode === "per_user_admin" ? html`<div class="tw"><table><tr><th>Person</th><th>Schlüssel</th></tr>${users.map((u: any) => html`<tr><td>${u.name}</td>
          <td><input type="password" autocomplete="off" placeholder="nicht gesetzt" .value=${a.user_keys[u.id] || ""}
            @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => this.set("user_keys", { ...a.user_keys, [u.id]: e.target.value })}></td></tr>`)}</table></div>` : nothing}
      </div></section>
      ${this.taskKeySection()}
      ${this.providersSection()}
      ${this.extModelsSection(users)}
      ${this.costsSection(users)}
      <section><h2>${icon("user", 18)} Wer darf LLMitMir nutzen?</h2>
        <div class="tw"><table><tr><th></th><th>Person</th><th>Anfragen/Tag</th><th>Tokens/Tag</th><th>Heute</th></tr>
          ${users.map((u: any) => { const q = a.quota_users[u.id] || {}; const us = a.usage_today[u.id];
            return html`<tr><td><input type="checkbox" .checked=${a.allowed_users.includes(u.id)} @change=${(e: any) => this.set("allowed_users",
              e.target.checked ? [...a.allowed_users, u.id] : a.allowed_users.filter((x: string) => x !== u.id))}></td>
              <td>${u.name}${u.is_admin ? html` <span class="chip">Admin</span>` : nothing}</td>
              <td><input type="number" min="0" style="width:100px" placeholder=${String(a.quota_default.requests_day || "∞")} .value=${q.requests_day ?? ""}
                @input=${(e: any) => this.set("quota_users", { ...a.quota_users, [u.id]: { ...q, requests_day: e.target.value === "" ? null : Number(e.target.value) } })}></td>
              <td><input type="number" min="0" style="width:120px" placeholder=${String(a.quota_default.tokens_day || "∞")} .value=${q.tokens_day ?? ""}
                @input=${(e: any) => this.set("quota_users", { ...a.quota_users, [u.id]: { ...q, tokens_day: e.target.value === "" ? null : Number(e.target.value) } })}></td>
              <td class="hint">${us ? `${us.requests} · ${fmtNum(us.prompt + us.completion)}` : "–"}${us?.task_requests ? html`<br>Aufgaben ${us.task_requests} · ${fmtNum((us.task_prompt || 0) + (us.task_completion || 0))}` : nothing}</td></tr>`; })}</table></div>
        <div class="hint" style="margin-top:8px">Ohne Haken sieht die Person den Eintrag in der Seitenleiste, bekommt aber keinen Zugriff (HA kann Seitenleisten-Einträge nicht pro Person ausblenden).
          ${!a.allowed_users.length ? "Solange niemand angehakt ist, haben nur Admins Zugriff." : ""}</div>
        <div class="two" style="margin-top:12px"><label class="f"><span>Standard-Kontingent Anfragen/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(a.quota_default.requests_day || 0)}
            @input=${(e: any) => this.set("quota_default", { ...a.quota_default, requests_day: Number(e.target.value) })}></label>
          <label class="f"><span>Standard-Kontingent Tokens/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(a.quota_default.tokens_day || 0)}
            @input=${(e: any) => this.set("quota_default", { ...a.quota_default, tokens_day: Number(e.target.value) })}></label></div></section>
      ${this.deviceSection(a.users)}
      ${this.viewSection(users)}
      <section><h2>${icon("sparkle", 18)} Modelle</h2>
        <div class="row" style="margin-bottom:10px"><button class="btn" @click=${this.refresh} ?disabled=${this.loading}>${this.loading ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} Modellliste laden</button>
          <span class="hint">${known.length} Modelle bekannt</span></div>
        <div class="two">${[["chat", "Standard Chat"], ["agent", "Standard Cowork/Aufgaben"], ["vision", "Bilder & Scans lesen"]].map(([r, l]) => html`<label class="f"><span>${l}</span>
          <select @change=${(e: any) => this.set("models", { ...a.models, defaults: { ...defs, [r]: e.target.value } })}>
            <option value="" ?selected=${!defs[r] || defs[r] === "auto"}>Automatisch (derzeit ${live[a.auto_models?.[r]]?.name || a.auto_models?.[r] || "–"})</option>
            ${known.map((m: any) => html`<option value=${m.id} ?selected=${defs[r] === m.id}>${m.name}</option>`)}</select></label>`)}</div>
        <div class="hint" style="margin-top:6px">„Automatisch“ nimmt das am besten geeignete freigegebene Modell, das gerade nicht überlastet ist: Die Liste
          samt Auslastung wird alle drei Minuten neu geladen (zählt bei SAIA nicht zum Limit), neu erschienene Modelle werden anhand ihrer Vorgänger
          eingeschätzt. Hängt ein Modell im Chat, empfiehlt LLMitMir einen Wechsel; geplante Aufgaben mit automatischem Modell wechseln selbst.</div>
        <label class="row" style="margin-top:10px"><input type="checkbox" style="width:auto" .checked=${a.models.auto_enable_new !== false}
          @change=${(e: any) => this.set("models", { ...a.models, auto_enable_new: e.target.checked })}> Neu erscheinende Modelle automatisch freigeben</label>
        <div class="tw" style="margin-top:12px"><table><tr><th>Freigegeben</th><th>Modell</th><th>Auslastung</th><th title="Eignung 0–100 für Chat / Cowork & Aufgaben / Bilder">Eignung</th><th>Fähigkeiten</th><th>Kontext</th></tr>
          ${known.map((m: any) => { const lv = live[m.id] || m; const l = load(lv); const q = lv.quality || {}; return html`<tr><td><input type="checkbox" .checked=${enabled.has(m.id)} @change=${(e: any) => {
            const s = new Set(enabled); e.target.checked ? s.add(m.id) : s.delete(m.id); this.set("models", { ...a.models, enabled: [...s] }); }}></td>
            <td>${m.name}${lv.new ? html` <span class="chip accent">neu</span>` : nothing}<div class="hint">${m.id}${m.gone ? " · nicht mehr angeboten" : m.status !== "ready" && m.status ? ` · ${m.status}` : ""}</div></td>
            <td class="hint"><span class="row" style="gap:6px;flex-wrap:nowrap">${loadDot(lv)}${l ? l.text : "–"}</span></td>
            <td class="hint" style="white-space:nowrap">${q.chat || "–"} / ${q.agent || "–"} / ${q.vision || "–"}</td>
            <td class="hint">${(m.input || []).join(", ")} → ${(m.output || []).join(", ")}</td>
            <td><input type="number" style="width:110px" placeholder=${String(a.known_context[m.id] || 128000)} .value=${a.models.context?.[m.id] ?? ""}
              @input=${(e: any) => this.set("models", { ...a.models, context: { ...(a.models.context || {}), [m.id]: e.target.value ? Number(e.target.value) : undefined } })}></td></tr>`; })}</table></div></section>
      <section><h2>${icon("mdi:console", 18)} Werkbank</h2>
        ${werkbankInfo(!!a.werkbank?.url && !!a.werkbank?.token, this.guide, () => (this.guide = !this.guide), true)}
        <div class="two" style="margin-top:12px">
          <label class="f"><span>URL der Werkbank</span><input placeholder="http://192.168.1.50:8787" .value=${a.werkbank?.url || ""}
            @input=${(e: any) => this.set("werkbank", { ...a.werkbank, url: e.target.value })}></label>
          <label class="f"><span>Token</span><input type="password" autocomplete="off" placeholder="steht nach der Installation auf dem Bildschirm" .value=${a.werkbank?.token || ""}
            @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => this.set("werkbank", { ...a.werkbank, token: e.target.value })}></label></div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap">
          <button class="btn" @click=${async () => { this.wbTest = { testing: true };
            try { this.wbTest = await store.api.ws("admin/werkbank_test", { url: a.werkbank?.url || "", token: a.werkbank?.token || "" }); } catch (e: any) { this.wbTest = { ok: false, error: e.message }; } }}>
            ${this.wbTest?.testing ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} Verbindung testen</button>
          ${this.wbTest && !this.wbTest.testing ? (this.wbTest.ok
            ? html`<span class="chip ok">${icon("check", 13)} verbunden · Version ${this.wbTest.version} · ${this.wbTest.sessions}/${this.wbTest.max_sessions} Sandboxen${this.wbTest.sandbox_image_ready ? "" : " · Sandbox-Image fehlt!"}</span>`
            : html`<span class="chip err">${icon("alert", 13)} ${this.wbTest.error}</span>`) : nothing}
          ${a.werkbank?.url ? html`<button class="btn ghost danger" @click=${() => this.set("werkbank", { url: "", token: "" })}>Werkbank entfernen</button>` : nothing}</div>
        <div class="hint" style="margin-top:6px">Nach dem Test auf „Speichern“ klicken. Befehle auf der Werkbank fragen wie andere schreibende Aktionen nach einer Freigabe.</div></section>
      <section><h2>${icon("search", 18)} Websuche</h2><div class="two">
        <label class="f"><span>Anbieter</span><select @change=${(e: any) => this.set("search", { ...a.search, provider: e.target.value })}>
          <option value="duckduckgo" ?selected=${a.search.provider !== "searxng"}>DuckDuckGo (ohne Schlüssel)</option>
          <option value="searxng" ?selected=${a.search.provider === "searxng"}>SearXNG (eigene Instanz)</option></select></label>
        ${a.search.provider === "searxng" ? html`<label class="f"><span>SearXNG-URL</span><input .value=${a.search.searxng_url || ""} @input=${(e: any) => this.set("search", { ...a.search, searxng_url: e.target.value })}></label>` : nothing}</div>
        <div class="hint" style="margin-top:6px">DuckDuckGo funktioniert ohne Schlüssel über die einfache HTML-Seite und kann bei vielen Anfragen kurz sperren.</div></section>
      ${this.dirty ? html`<div class="savebar fade-in"><button class="btn" @click=${() => this.load()}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

export { navigate };
