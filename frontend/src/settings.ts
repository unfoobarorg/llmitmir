// Personal settings (incl. Claude import and usage) and the admin page.
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { base, icon, fmtNum, fmtTime, copyText } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";
import { claudeImportPrompt } from "./importprompt";

const css2 = css`:host { display: block; height: 100%; overflow-y: auto; }
  section { margin-bottom: 26px; } section > h2 { display: flex; gap: 8px; align-items: center; }
  .form { display: grid; gap: 14px; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
  @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }`;

@customElement("lm-settings")
export class SettingsPage extends LitElement {
  @state() private s: any = {};
  @state() private memory = "";
  @state() private dirty = false;
  @state() private notifiers: string[] = [];
  @state() private history: any = null;
  @state() private imp: any = null;
  @state() private impResult: any = null;
  static styles = [base, css2];
  connectedCallback() {
    super.connectedCallback();
    this.reset();
    store.api.ws("notify_services").then(r => (this.notifiers = r));
    store.api.ws("usage/history").then(r => (this.history = r));
  }
  private reset() { this.s = { ...(store.data?.settings || {}) }; this.memory = store.data?.memory || ""; this.dirty = false; }
  private set(k: string, v: any) { this.s = { ...this.s, [k]: v }; this.dirty = true; }
  private async save() {
    const payload: any = { ...this.s, memory: this.memory }; delete payload.has_own_key;
    if (!payload.own_key) delete payload.own_key;
    await store.api.ws("settings/save", { settings: payload }); this.dirty = false; store.notify(t("Gespeichert")); await store.load(); this.reset();
  }
  private async newImport() {
    const r = await store.api.ws("import/token");
    const url = `${location.origin}${r.path}`;
    this.imp = { url, prompt: claudeImportPrompt(url), expires: r.expires };
  }
  private async uploadImport(e: any) {
    const f = e.target.files?.[0]; if (!f) return;
    try { this.impResult = await store.api.upload("import", "x", [f]); await store.load(); store.notify("Import abgeschlossen"); }
    catch (err: any) { store.notify(err.message); }
    e.target.value = "";
  }
  render() {
    const d = store.data; const s = this.s;
    const days = this.history ? Object.entries(this.history.days).sort(([a], [b]) => a.localeCompare(b)).slice(-30) : [];
    const max = Math.max(1, ...days.map(([, v]: any) => v.prompt + v.completion));
    const perms = Object.entries(s.permissions || {});
    return html`<div class="page"><h1>${t("Einstellungen")}</h1>
      <section><h2>${icon("sparkle", 18)} Modelle</h2><div class="two">
        <label class="f"><span>Standard für Chats</span><select @change=${(e: any) => this.set("model_chat", e.target.value || null)}>
          <option value="">Vorgabe (${d.defaults.chat})</option>${d.models.map((m: any) => html`<option value=${m.id} ?selected=${s.model_chat === m.id}>${m.name}</option>`)}</select></label>
        <label class="f"><span>Standard für Coworks & Aufgaben</span><select @change=${(e: any) => this.set("model_agent", e.target.value || null)}>
          <option value="">Vorgabe (${d.defaults.agent})</option>${d.models.map((m: any) => html`<option value=${m.id} ?selected=${s.model_agent === m.id}>${m.name}</option>`)}</select></label></div></section>
      ${d.key_mode === "per_user_own" ? html`<section><h2>${icon("key", 18)} Dein API-Schlüssel</h2>
        <label class="f"><span>Schlüssel für ${d.provider.name}</span><input type="password" autocomplete="off" placeholder=${s.has_own_key ? "••• gespeichert – zum Ändern neu eingeben" : "Schlüssel eintragen"}
          @input=${(e: any) => this.set("own_key", e.target.value)}></label>
        <div class="hint">Der Schlüssel gilt nur für dich. Limits und Verbrauch beziehen sich auf ihn.</div></section>` : nothing}
      <section><h2>${icon("bell", 18)} Benachrichtigungen</h2>
        <label class="f"><span>Gerät für Push-Nachrichten (Aufgaben, Werkzeug „Benachrichtigen“)</span><select @change=${(e: any) => this.set("notify_service", e.target.value)}>
          <option value="">keins</option>${this.notifiers.map(n => html`<option value=${n} ?selected=${s.notify_service === n}>${n}</option>`)}</select></label></section>
      <section><h2>${icon("user", 18)} ${t("Persönliche Hinweise")}</h2>
        <textarea rows="7" placeholder="Was soll LLMitMir immer über dich wissen? Vorlieben, Schreibstil, Zusammenhänge …" .value=${this.memory}
          @input=${(e: any) => { this.memory = e.target.value; this.dirty = true; }}></textarea>
        <div class="hint">Fließt in jeden Chat, jedes Cowork und jede Aufgabe ein.</div></section>
      <section><h2>${icon("chat", 18)} Darstellung & Bedienung</h2><div class="form">
        <label class="row"><input type="checkbox" style="width:auto" .checked=${s.show_reasoning !== false} @change=${(e: any) => this.set("show_reasoning", e.target.checked)}> Gedanken der Modelle anzeigen</label>
        <label class="row"><input type="checkbox" style="width:auto" .checked=${s.send_on_enter !== false} @change=${(e: any) => this.set("send_on_enter", e.target.checked)}> Mit Enter senden (Umschalt+Enter = neue Zeile; auf Touch-Geräten immer Zeilenumbruch)</label></div></section>
      ${perms.length ? html`<section><h2>${icon("lock", 18)} Dauerhafte Freigaben (ohne Projekt)</h2>
        ${perms.map(([n, v]) => html`<div class="row" style="padding:4px 0"><span class="grow">${d.tools[n]?.label || n}: ${v === "allow" ? "erlaubt" : v === "deny" ? "verboten" : "fragen"}</span>
          <button class="btn ghost" @click=${() => { const p = { ...s.permissions }; delete p[n]; this.set("permissions", p); }}>Zurücksetzen</button></div>`)}</section>` : nothing}
      <section><h2>${icon("gauge", 18)} ${t("Verbrauch")}</h2>
        <div class="card"><div class="row"><span class="grow">Heute: <b>${d.usage.today.requests}</b> Anfragen · <b>${fmtNum(d.usage.today.prompt + d.usage.today.completion)}</b> Tokens</span>
          ${d.usage.quota.requests_day ? html`<span class="chip">Kontingent ${d.usage.quota.requests_day} Anfragen/Tag</span>` : nothing}
          ${d.usage.quota.tokens_day ? html`<span class="chip">${fmtNum(d.usage.quota.tokens_day)} Tokens/Tag</span>` : nothing}</div>
          ${days.length ? html`<div class="bars">${days.map(([day, v]: any) => html`<div title="${day}: ${v.requests} Anfragen, ${fmtNum(v.prompt + v.completion)} Tokens"
            style="height:${Math.max(2, ((v.prompt + v.completion) / max) * 110)}px"></div>`)}</div><div class="hint">Tokens je Tag, letzte ${days.length} Tage</div>` : nothing}</div></section>
      <section><h2>${icon("import", 18)} Import aus Claude</h2><div class="card form">
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
          <label class="btn" style="margin-top:8px">${icon("upload", 16)} ZIP oder JSON hochladen<input type="file" accept=".zip,.json" hidden @change=${this.uploadImport}></label></div>
        ${this.impResult ? html`<div class="hint">Übernommen: ${["chats", "projects", "skills", "credentials", "tasks"].map(k => `${this.impResult[k] || 0} ${k}`).join(", ")}
          ${this.impResult.error ? html`<br><span style="color:var(--lm-err)">${this.impResult.error}</span>` : nothing}</div>` : nothing}
      </div></section>
      ${this.dirty ? html`<div class="savebar fade-in"><button class="btn" @click=${() => this.reset()}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

// ---------------------------------------------------------------- admin
@customElement("lm-admin")
export class AdminPage extends LitElement {
  @state() private a: any = null;
  @state() private dirty = false;
  @state() private loading = false;
  static styles = [base, css2];
  connectedCallback() { super.connectedCallback(); this.load(); }
  private async load() { try { this.a = await store.api.ws("admin/get"); this.dirty = false; } catch (e: any) { store.notify(e.message); } }
  private set(k: string, v: any) { this.a = { ...this.a, [k]: v }; this.dirty = true; }
  private async save() {
    const a = this.a;
    try {
      this.a = await store.api.ws("admin/save", { config: { provider: a.provider, key_mode: a.key_mode, shared_key: a.shared_key, user_keys: a.user_keys,
        allowed_users: a.allowed_users, quota_default: a.quota_default, quota_users: a.quota_users, search: a.search,
        models: { enabled: a.models.enabled, defaults: a.models.defaults, context: a.models.context } } });
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
  render() {
    const a = this.a;
    if (!a) return html`<div class="page"><lm-spark></lm-spark></div>`;
    const users = a.users.filter((u: any) => u.is_active);
    const known = a.models.known || [];
    const enabled = new Set(a.models.enabled || []);
    const defs = a.models.defaults || {};
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
              <td class="hint">${us ? `${us.requests} · ${fmtNum(us.prompt + us.completion)}` : "–"}</td></tr>`; })}</table></div>
        <div class="hint" style="margin-top:8px">Ohne Haken sieht die Person den Eintrag in der Seitenleiste, bekommt aber keinen Zugriff (HA kann Seitenleisten-Einträge nicht pro Person ausblenden).
          ${!a.allowed_users.length ? "Solange niemand angehakt ist, haben nur Admins Zugriff." : ""}</div>
        <div class="two" style="margin-top:12px"><label class="f"><span>Standard-Kontingent Anfragen/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(a.quota_default.requests_day || 0)}
            @input=${(e: any) => this.set("quota_default", { ...a.quota_default, requests_day: Number(e.target.value) })}></label>
          <label class="f"><span>Standard-Kontingent Tokens/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(a.quota_default.tokens_day || 0)}
            @input=${(e: any) => this.set("quota_default", { ...a.quota_default, tokens_day: Number(e.target.value) })}></label></div></section>
      <section><h2>${icon("sparkle", 18)} Modelle</h2>
        <div class="row" style="margin-bottom:10px"><button class="btn" @click=${this.refresh} ?disabled=${this.loading}>${this.loading ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} Modellliste laden</button>
          <span class="hint">${known.length} Modelle bekannt</span></div>
        <div class="two">${[["chat", "Standard Chat"], ["agent", "Standard Cowork/Aufgaben"], ["vision", "Bilder & Scans lesen"]].map(([r, l]) => html`<label class="f"><span>${l}</span>
          <select @change=${(e: any) => this.set("models", { ...a.models, defaults: { ...defs, [r]: e.target.value } })}>
            ${known.map((m: any) => html`<option value=${m.id} ?selected=${defs[r] === m.id}>${m.name}</option>`)}</select></label>`)}</div>
        <div class="tw" style="margin-top:12px"><table><tr><th>Freigegeben</th><th>Modell</th><th>Fähigkeiten</th><th>Kontext</th></tr>
          ${known.map((m: any) => html`<tr><td><input type="checkbox" .checked=${enabled.has(m.id)} @change=${(e: any) => {
            const s = new Set(enabled); e.target.checked ? s.add(m.id) : s.delete(m.id); this.set("models", { ...a.models, enabled: [...s] }); }}></td>
            <td>${m.name}<div class="hint">${m.id}${m.status === "unavailable" ? " · gerade nicht verfügbar" : ""}</div></td>
            <td class="hint">${(m.input || []).join(", ")} → ${(m.output || []).join(", ")}</td>
            <td><input type="number" style="width:110px" placeholder=${String(a.known_context[m.id] || 128000)} .value=${a.models.context?.[m.id] ?? ""}
              @input=${(e: any) => this.set("models", { ...a.models, context: { ...(a.models.context || {}), [m.id]: e.target.value ? Number(e.target.value) : undefined } })}></td></tr>`)}</table></div></section>
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
