// Admin-Einstellungen: nach Bereichen geordnet wie die Claude-Einstellungen (links Bereiche, rechts Gruppen mit Zeilen).
// Gespeichert wird weiterhin alles gemeinsam über admin/save; ungespeicherte Änderungen bleiben beim Wechsel der Bereiche erhalten.
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, fmtNum, fmtTime, safeElement, confirmDialog, decStr } from "./ui";
import { store, navigate } from "./api";
import { t, tb, dateLocale } from "./i18n";
import { load, loadDot } from "./modelpick";
import { taskUsageCss, usageBlock, taskKeyLabel } from "./taskusage";
import { fmtEur } from "./external";
import { fmtPct, showAbsolute } from "./limits";
import { extraCss, werkbankInfo } from "./settings";
import { settingsLayout, settingsCss, centerActiveNav, group, row, pad, toggle, switchRow, choices, more, empty, itemCard, type NavItem } from "./setui";
import "./monitoring";
import { fieldLabel } from "./connectors";

/** Geheimnisfeld: zeigt „•••“ für gespeicherte Werte und leert sich beim Hineinklicken. */
const secret = (value: string, change: (v: string) => void, placeholder = t("nicht gesetzt")) =>
  html`<input type="password" autocomplete="off" placeholder=${placeholder} .value=${value || ""}
    @focus=${(e: any) => { if (e.target.value === "•••") e.target.value = ""; }} @input=${(e: any) => change(e.target.value)}>`;

@safeElement("lm-admin")
export class AdminPage extends StoreElement {
  @property() tab = "";
  @state() private a: any = null;
  @state() private dirty = false;
  @state() private loading = false;
  @state() private wbTest: any = null;
  @state() private guide = false;
  @state() private checks: any = null;
  @state() private idmPlan: any = null;
  @state() private idmBusy = false;
  @state() private mcpSecret: Record<number, string> = {};
  @state() private mcpBusy = -1;
  @state() private provBusy = "";
  /** Geöffneter Konnektor in der Kachel-Übersicht (Index), -1 = Übersicht. */
  @state() private knOpen = -1;
  static styles = [base, settingsCss, extraCss, taskUsageCss, css`
    .kntiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; padding: 14px 16px; }
    .kntile { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; border: 1px solid var(--lm-line); border-radius: 12px;
      background: var(--lm-raise, var(--lm-panel)); color: inherit; font: inherit; cursor: pointer; transition: background .15s, border-color .15s; min-width: 0; }
    .kntile:hover { background: var(--lm-hover); border-color: var(--lm-accent); }
    .kntile.off { opacity: .6; }
    .kntile.add { border-style: dashed; align-items: center; color: var(--lm-muted); }
    .kntile .kic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); flex: none; }
    .kntile .ktx { display: grid; gap: 3px; flex: 1; min-width: 0; }
    .kntile .ktx b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kntile .kchips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
    .kntile .kgo { color: var(--lm-muted); align-self: center; }
    .kform { display: grid; gap: 12px; }`];
  connectedCallback() { super.connectedCallback(); this.load(); }
  private async load() { try { this.a = await store.api.ws("admin/get"); this.dirty = false; } catch (e: any) { store.notify(e.message); } }
  private set(k: string, v: any) { this.a = { ...this.a, [k]: v }; this.dirty = true; }
  private async save() {
    const a = this.a;
    try {
      this.a = await store.api.ws("admin/save", { config: { provider: a.provider, key_mode: a.key_mode, shared_key: a.shared_key, user_keys: a.user_keys,
        task_key_mode: a.task_key_mode, shared_task_key: a.shared_task_key,
        allowed_users: a.allowed_users, quota_default: a.quota_default, quota_users: a.quota_users, search: a.search, speech: a.speech, werkbank: a.werkbank, views: a.views,
        notify_devices: { overrides: a.notify_overrides || {} },
        models: { enabled: a.models.enabled, defaults: a.models.defaults, context: a.models.context, auto_enable_new: a.models.auto_enable_new !== false },
        providers: a.providers.map((p: any) => ({ id: p.id, enabled: p.enabled, mode: p.mode, key: p.key, endpoint: p.endpoint, extra_models: p.extra_models })),
        model_access: a.model_access, billing: a.billing, dashboards: a.dashboards, credentials_policy: a.credentials_policy,
        central_skills: a.central_skills, skill_policies: a.skill_policies, connectors: a.connectors, idm: a.idm } });
      this.dirty = false; store.notify(t("Gespeichert"));
      window.dispatchEvent(new CustomEvent("llmitmir-admin-saved"));
      if (store.data) await store.load();
    } catch (e: any) { store.notify(e.message); }
  }
  private async refresh() {
    this.loading = true;
    try { this.a = await store.api.ws("admin/models_refresh", this.a.shared_key && this.a.shared_key !== "•••" ? { key: this.a.shared_key } : {}); store.notify(t("Modelle geladen")); }
    catch (e: any) { store.notify(e.message); }
    this.loading = false;
  }
  private setList(k: string, i: number, patch: any) { this.set(k, (this.a[k] || []).map((x: any, j: number) => (j === i ? { ...x, ...patch } : x))); }
  private dropItem(k: string, i: number) { this.set(k, (this.a[k] || []).filter((_: any, j: number) => j !== i)); }
  private users() { return this.a.users.filter((u: any) => u.is_active); }

  // ================================================================ Personen
  private people() {
    const a = this.a; const users = this.users();
    const quota = (u: any) => a.quota_users[u.id] || {};
    const setQ = (u: any, k: string, v: string) => this.set("quota_users", { ...a.quota_users, [u.id]: { ...quota(u), [k]: v === "" ? null : Number(v) } });
    return html`
      ${group(t("Wer darf LLMitMir nutzen?"), html`
        <div class="tw"><table><tr><th>${t("Zugriff")}</th><th>${t("Person")}</th><th class="num">${t("Anfragen/Tag")}</th><th class="num">${t("Tokens/Tag")}</th><th class="num">${t("Heute")}</th></tr>
          ${users.map((u: any) => { const q = quota(u); const us = a.usage_today[u.id];
            return html`<tr><td>${toggle(a.allowed_users.includes(u.id), (on) => this.set("allowed_users",
                on ? [...a.allowed_users, u.id] : a.allowed_users.filter((x: string) => x !== u.id)), { label: u.name })}</td>
              <td>${u.name}${u.is_admin ? html` <span class="chip">Admin</span>` : nothing}</td>
              <td class="num"><input type="number" min="0" style="width:100px" placeholder=${String(a.quota_default.requests_day || "∞")} .value=${q.requests_day ?? ""}
                @input=${(e: any) => setQ(u, "requests_day", e.target.value)}></td>
              <td class="num"><input type="number" min="0" style="width:120px" placeholder=${String(a.quota_default.tokens_day || "∞")} .value=${q.tokens_day ?? ""}
                @input=${(e: any) => setQ(u, "tokens_day", e.target.value)}></td>
              <td class="num hint">${us ? `${us.requests} · ${fmtNum(us.prompt + us.completion)}` : "–"}${us?.task_requests ? html`<br>${t("Aufgaben")} ${us.task_requests} · ${fmtNum((us.task_prompt || 0) + (us.task_completion || 0))}` : nothing}</td></tr>`; })}</table></div>
        ${row(t("Standard-Kontingent Anfragen/Tag"), t("Gilt für alle ohne eigenen Wert in der Tabelle. 0 = unbegrenzt."),
          html`<input class="short" type="number" min="0" .value=${String(a.quota_default.requests_day || 0)} @input=${(e: any) => this.set("quota_default", { ...a.quota_default, requests_day: Number(e.target.value) })}>`)}
        ${row(t("Standard-Kontingent Tokens/Tag"), "0 = unbegrenzt.",
          html`<input class="short" type="number" min="0" .value=${String(a.quota_default.tokens_day || 0)} @input=${(e: any) => this.set("quota_default", { ...a.quota_default, tokens_day: Number(e.target.value) })}>`)}`,
        { desc: html`${t("Ohne Freigabe sieht die Person den Eintrag in der Seitenleiste, bekommt aber keinen Zugriff (HA kann Seitenleisten-Einträge nicht pro Person ausblenden).")}
          ${!a.allowed_users.length ? html` <b>${t("Solange niemand freigegeben ist, haben nur Admins Zugriff.")}</b>` : ""}` })}
      ${this.viewGroup(users)}
      ${this.idmGroup()}`;
  }
  private viewGroup(users: any[]) {
    const vw = this.a.views || { default: "choice", users: {} };
    const opts: [string, string][] = [["choice", t("Selbst wählen (startet einfach)")], ["simple", t("Immer einfache Ansicht")], ["expert", t("Immer Expertenansicht")]];
    const setV = (next: any) => this.set("views", { ...vw, ...next });
    const effective = (u: any) => {
      const p = vw.users?.[u.id] || vw.default || "choice";
      return p === "choice" ? (u.view === "expert" ? t("Experten (selbst gewählt)") : u.view === "simple" ? t("Einfach (selbst gewählt)") : t("Einfach")) : p === "expert" ? t("Experten") : t("Einfach");
    };
    return group(t("Ansicht"), html`
      ${row(t("Für alle"), t("Mit „Selbst wählen“ startet jede Person einfach und kann die Expertenansicht in ihren Einstellungen einschalten."),
        html`<select @change=${(e: any) => setV({ default: e.target.value })}>${opts.map(([k, l]) => html`<option value=${k} ?selected=${(vw.default || "choice") === k}>${l}</option>`)}</select>`)}
      <div class="tw"><table><tr><th>${t("Person")}</th><th>${t("Ansicht")}</th><th>${t("Derzeit")}</th></tr>
        ${users.map((u: any) => html`<tr><td>${u.name}${u.is_admin ? html` <span class="chip">Admin</span>` : nothing}</td>
          <td><select style="width:auto;padding:6px 8px" @change=${(e: any) => { const us = { ...(vw.users || {}) }; if (e.target.value) us[u.id] = e.target.value; else delete us[u.id]; setV({ users: us }); }}>
            <option value="" ?selected=${!vw.users?.[u.id]}>${t("Wie für alle")}</option>
            ${opts.map(([k, l]) => html`<option value=${k} ?selected=${vw.users?.[u.id] === k}>${l}</option>`)}</select></td>
          <td class="hint">${effective(u)}</td></tr>`)}</table></div>`,
      { desc: t("Die einfache Ansicht zeigt nur Nachricht und Antwort wie in einem Messenger, wählt Modelle automatisch und erklärt alles verständlich. Die Expertenansicht ist die volle Oberfläche.") });
  }
  /** Nutzerverwaltung mit AD/LDAP (idm.py): Verbindung, Gruppen-Zuordnung, Probelauf, Abgleich. */
  private idmGroup() {
    const x = this.a.idm || {}; const maps: any[] = x.mappings || [];
    const set = (patch: any) => this.set("idm", { ...x, ...patch });
    const run = async (apply: boolean) => {
      if (this.dirty) { await this.save(); if (this.dirty) return; }
      if (apply && !(await confirmDialog(t("Abgleich jetzt ausführen? Benutzer werden angelegt, geändert oder deaktiviert (nie gelöscht)."), t("Ausführen")))) return;
      this.idmBusy = true;
      try { const r = await store.api.ws(apply ? "admin/idm_apply" : "admin/idm_preview"); this.idmPlan = { ...r, applied: apply }; }
      catch (e: any) { store.notify(e.message); }
      this.idmBusy = false;
    };
    const label: Record<string, string> = { create: t("anlegen"), update: t("ändern"), deactivate: t("deaktivieren"), reactivate: t("wieder aktivieren"),
      allow: t("LLMitMir freigeben"), disallow: t("LLMitMir entziehen"), skip: t("übersprungen") };
    const p = this.idmPlan;
    const f = (lbl: string, el: any) => html`<label class="f"><span>${lbl}</span>${el}</label>`;
    return group(t("Nutzerverwaltung (Active Directory / LDAP)"), html`
      ${switchRow(t("Mit dem Verzeichnis abgleichen"), t("Legt Home-Assistant-Benutzer nach Gruppen im Verzeichnis an, passt Admin-Rechte und den Zugriff auf LLMitMir an und deaktiviert, wer aus allen Gruppen fällt – nie löschen."),
        !!x.enabled, (on) => set({ enabled: on }))}
      ${x.enabled ? html`
        ${pad(html`<div class="form" style="display:grid;gap:12px">
          <div class="two">${f("Server", html`<input placeholder="ldaps://dc.example.org" .value=${x.server || ""} @input=${(e: any) => set({ server: e.target.value })}>`)}
            ${f("Basis-DN", html`<input placeholder="DC=example,DC=org" .value=${x.base_dn || ""} @input=${(e: any) => set({ base_dn: e.target.value })}>`)}</div>
          <div class="two">${f(t("Bind-Konto (nur lesen)"), html`<input placeholder="CN=svc-llmitmir,OU=Dienste,DC=example,DC=org" .value=${x.bind_dn || ""} @input=${(e: any) => set({ bind_dn: e.target.value })}>`)}
            ${f(t("Passwort"), secret(x.bind_password, (v) => set({ bind_password: v }), ""))}</div>
          ${f("Filter", html`<input class="code" .value=${x.user_filter || "(&(objectCategory=person)(objectClass=user))"} @input=${(e: any) => set({ user_filter: e.target.value })}>`)}
          <div class="two">${f(t("Attribut Anmeldename"), html`<input .value=${x.attr_username || "sAMAccountName"} @input=${(e: any) => set({ attr_username: e.target.value })}>`)}
            ${f(t("Anmeldeanbieter in Home Assistant"), html`<select @change=${(e: any) => set({ auth_provider: e.target.value })}>
              ${[...new Set(["command_line", ...(this.a.auth_providers || [])])].map((v: string) => html`<option value=${v} ?selected=${(x.auth_provider || "command_line") === v}>${v}${(this.a.auth_providers || []).includes(v) ? "" : t(" (nicht eingerichtet)")}</option>`)}</select>`)}</div></div>`)}
        ${row(t("Gruppen-Zuordnung"), t("Jede Gruppe: Wer drin ist, bekommt einen Benutzer – optional mit Admin-Rechten und Zugriff auf LLMitMir."), nothing, { stack: true })}
        ${maps.map((mp: any, j: number) => pad(html`<div class="row" style="flex-wrap:wrap;gap:10px">
          <input class="code" style="flex:1;min-width:240px" placeholder="CN=HA-Nutzer,OU=Gruppen,DC=example,DC=org" .value=${mp.group || ""}
            @input=${(e: any) => set({ mappings: maps.map((q: any, n: number) => (n === j ? { ...q, group: e.target.value } : q)) })}>
          <label class="row hint" style="gap:6px">${toggle(!!mp.admin, (on) => set({ mappings: maps.map((q: any, n: number) => (n === j ? { ...q, admin: on } : q)) }))} Admin</label>
          <label class="row hint" style="gap:6px">${toggle(mp.llmitmir !== false, (on) => set({ mappings: maps.map((q: any, n: number) => (n === j ? { ...q, llmitmir: on } : q)) }))} LLMitMir</label>
          <button class="iconbtn" title=${t("Entfernen")} @click=${() => set({ mappings: maps.filter((_: any, n: number) => n !== j) })}>${icon("trash", 16)}</button></div>`))}
        <div class="gfoot"><button class="btn ghost" @click=${() => set({ mappings: [...maps, { group: "", admin: false, llmitmir: true }] })}>${icon("plus", 14)} ${t("Gruppe hinzufügen")}</button></div>
        ${switchRow(t("Jede Nacht abgleichen"), t("Um 4:23 Uhr automatisch."), !!x.auto, (on) => set({ auto: on }))}
        ${row(t("Abgleich"), t("Erst der Probelauf zeigt, was sich ändern würde. Ungespeicherte Änderungen werden vorher gespeichert."),
          html`<button class="btn" ?disabled=${this.idmBusy} @click=${() => run(false)}>${icon("eye", 15)} ${t("Probelauf")}</button>
            <button class="btn danger" ?disabled=${this.idmBusy || !p || p.applied} @click=${() => run(true)}>${icon("check", 15)} ${t("Ausführen")}</button>`)}
        ${p ? pad(p.applied ? html`<b>${t("Ausgeführt:")}</b> ${Object.entries(p.counts || {}).map(([k, v]) => `${v}× ${label[k] || k}`).join(", ") || t("keine Änderung")}
            ${(p.errors || []).map((er: string) => html`<div class="hint" style="color:var(--lm-err)">${tb(er)}</div>`)}`
          : html`<b>${t("Probelauf:")}</b> ${t("{n} Personen im Verzeichnis, {m} Änderungen", { n: p.entries, m: p.actions.length })}
            ${p.actions.length ? html`<div class="tw" style="margin-top:8px"><table><tr><th>${t("Aktion")}</th><th>${t("Anmeldename")}</th><th>Name</th><th>${t("Grund")}</th></tr>
              ${p.actions.map((ac: any) => html`<tr><td>${label[ac.action] || ac.action}${ac.admin === true ? " (Admin)" : ac.admin === false && ac.action === "update" ? t(" (kein Admin)") : ""}</td>
                <td class="code">${ac.username}</td><td>${ac.name || ""}</td><td class="hint">${tb(ac.reason)}</td></tr>`)}</table></div>` : nothing}`) : nothing}
        ${pad(more(html`${t("Von Hand angelegte Benutzer bleiben unberührt, der letzte aktive Admin auch. Angemeldet wird mit dem Verzeichnis-Passwort über den HA-Anmeldeanbieter {p} mit einem LDAP-Skript (siehe Doku); MFA richten die Personen selbst ein.", { p: "command_line" })}`))}` : nothing}`,
      { desc: t("Optional: Benutzer automatisch aus dem Verzeichnis pflegen.") });
  }

  // ================================================================ Anbieter & Schlüssel
  private providers() {
    const a = this.a; const users = this.users();
    const lim = a.key_limits?.shared;
    const pv = (patch: any) => this.set("provider", { ...a.provider, ...patch });
    return html`
      ${group(t("Hauptanbieter"), html`
        ${row(t("Vorlage"), tb(a.presets[a.provider.preset]?.hint) || t("Voreinstellungen für bekannte OpenAI-kompatible Anbieter."),
          html`<select @change=${(e: any) => { const p = a.presets[e.target.value];
            pv({ preset: e.target.value, name: p.name, base_url: p.base_url || a.provider.base_url, transcription_model: p.transcription_model }); }}>
            ${Object.entries(a.presets).map(([k, p]: any) => html`<option value=${k} ?selected=${a.provider.preset === k}>${p.name}</option>`)}</select>`)}
        ${row(t("Anzeigename"), t("So heißt der Anbieter in der Oberfläche."), html`<input .value=${a.provider.name || ""} @input=${(e: any) => pv({ name: e.target.value })}>`)}
        ${row(t("Basis-URL"), t("OpenAI-kompatible Adresse, endet meist auf /v1."), html`<input class="code" .value=${a.provider.base_url} @input=${(e: any) => pv({ base_url: e.target.value })}>`)}
        ${row(t("Modell für Spracheingabe"), t("Für /audio/transcriptions."), html`<input .value=${a.provider.transcription_model || ""} @input=${(e: any) => pv({ transcription_model: e.target.value })}>`)}`,
        { desc: t("Kostenlos für die Personen, immer wählbar; nur seine Modelle wählt LLMitMir automatisch.") })}
      ${group(t("API-Schlüssel"), html`
        ${choices("km", [
          { value: "shared", label: t("Ein gemeinsamer Schlüssel"), desc: t("Alle nutzen denselben Schlüssel – und teilen sich dessen Limits (bei SAIA 800 Anfragen am Tag).") },
          { value: "per_user_admin", label: t("Admin trägt je Person einen Schlüssel ein"), desc: t("Jede Person hat eigene Limits; du verwaltest die Schlüssel zentral hier.") },
          { value: "per_user_own", label: t("Jede Person trägt ihren eigenen Schlüssel ein"), desc: t("In den persönlichen Einstellungen. Ohne Schlüssel kein Zugriff auf Modelle.") },
        ], a.key_mode, (k) => this.set("key_mode", k))}
        ${a.key_mode === "shared" ? row(t("Gemeinsamer Schlüssel"), lim?.limit_requests_day
            ? html`${t("Heute {a} verbraucht, diese Stunde {b}.", { a: fmtPct(1 - (lim.remaining_requests_day ?? lim.limit_requests_day) / lim.limit_requests_day),
                b: fmtPct(lim.limit_requests_hour ? 1 - (lim.remaining_requests_hour ?? lim.limit_requests_hour) / lim.limit_requests_hour : 0) })}${showAbsolute()
                ? ` ${t("({a} von {b} Anfragen heute)", { a: lim.limit_requests_day - (lim.remaining_requests_day ?? lim.limit_requests_day), b: lim.limit_requests_day })}` : ""}` : null,
          secret(a.shared_key, (v) => this.set("shared_key", v), "")) : nothing}
        ${a.key_mode === "per_user_admin" ? html`<div class="tw"><table><tr><th>${t("Person")}</th><th>${t("Schlüssel")}</th></tr>${users.map((u: any) => html`<tr><td>${u.name}</td>
          <td>${secret(a.user_keys[u.id], (v) => this.set("user_keys", { ...a.user_keys, [u.id]: v }))}</td></tr>`)}</table></div>` : nothing}`,
        { desc: t("Mit welchem Schlüssel Chats und Coworks beim Hauptanbieter laufen.") })}
      ${this.taskKeyGroup()}
      ${this.providersGroup()}`;
  }
  private taskKeyGroup() {
    const a = this.a; const tm = a.task_key_mode || "same"; const tu = a.task_usage || {};
    return group(t("Schlüssel für geplante Aufgaben"), html`
      ${choices("tkm", [
        { value: "same", label: t("Gleicher Schlüssel wie für alles andere"), desc: t("Geplante Aufgaben teilen sich die Limits mit Chats und Coworks.") },
        { value: "shared", label: t("Zentraler Aufgaben-Schlüssel für alle"), desc: t("Alle geplanten Aufgaben aller Personen laufen über einen eigenen Schlüssel – spontane Chats und Coworks behalten ihr volles Kontingent.") },
        { value: "user", label: t("Jede Person entscheidet selbst"), desc: t("Ein Schlüssel für alles, ein eigener Aufgaben-Schlüssel oder der zentrale Aufgaben-Schlüssel (wenn du einen einträgst).") },
        { value: "own", label: t("Jede Person muss einen eigenen Schlüssel verwenden"), desc: t("Kein zentraler Schlüssel für Aufgaben. Wer bereits einen eigenen Schlüssel für Chats hat, darf denselben für alles nutzen – ein gemeinsamer Schlüssel gilt nie für Aufgaben.") },
      ], tm, (k) => this.set("task_key_mode", k))}
      ${tm === "shared" || tm === "user" ? row(tm === "user" ? t("Zentraler Aufgaben-Schlüssel (optional)") : t("Zentraler Aufgaben-Schlüssel"),
        tm === "shared" && !a.shared_task_key ? t("Solange kein Schlüssel eingetragen ist, nutzen Aufgaben den normalen Schlüssel.") : null,
        secret(a.shared_task_key, (v) => this.set("shared_task_key", v))) : nothing}
      ${tm === "own" ? html`${pad(html`<div class="hint">${icon("lock", 13)} ${t("Beim Speichern wird ein bisher eingetragener zentraler Aufgaben-Schlüssel entfernt. Aufgaben, die noch auf ihm laufen, nutzen danach den eigenen Schlüssel der Person – fehlt der, meldet der Lauf das im Ergebnis.")}</div>`)}
        <div class="tw"><table><tr><th>${t("Person")}</th><th>${t("Eigener Aufgaben-Schlüssel")}</th></tr>
          ${this.users().map((u: any) => html`<tr><td>${u.name}</td>
            <td>${u.has_own_task_key ? html`<span class="chip ok">${icon("check", 13)} eingetragen</span>`
              : u.has_own_key ? html`<span class="chip">${t("nutzt den eigenen Schlüssel für alles")}</span>`
              : html`<span class="chip warn">${icon("alert", 13)} ${t("fehlt – keine Läufe")}</span>`}</td></tr>`)}</table></div>` : nothing}
      ${tu.central ? usageBlock({ title: t("Geplante Aufgaben auf dem zentralen Aufgaben-Schlüssel"), label: taskKeyLabel("shared"), accent: true,
          todayLabel: t("Alle Aufgaben aller Personen heute"), today: tu.central.today, limits: tu.central.limits, days: tu.central.days }) : nothing}
      ${tu.shared && (tm !== "shared" || !tu.central) ? usageBlock({ title: t("Geplante Aufgaben auf dem gemeinsamen Schlüssel"), label: t("gemeinsamer Schlüssel"),
          todayLabel: t("Alle Aufgaben aller Personen heute"), today: tu.shared.today, limits: tu.shared.limits, days: tu.shared.days,
          notes: [t("Nur Läufe geplanter Aufgaben; Chats und Coworks auf diesem Schlüssel sind hier nicht mitgezählt.")] }) : nothing}`,
      { desc: t("Damit geplante Aufgaben nicht das Kontingent für spontane Chats aufbrauchen.") });
  }
  private setProv(pid: string, patch: any) { this.set("providers", this.a.providers.map((p: any) => (p.id === pid ? { ...p, ...patch } : p))); }
  private moveProv(i: number, dir: number) {
    const list = [...this.a.providers]; const j = i + dir; if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; this.set("providers", list);
  }
  private async refreshProv(pid: string) {
    if (this.dirty) { await this.save(); if (this.dirty) return; }
    this.provBusy = pid;
    try { this.a = await store.api.ws("admin/provider_refresh", { provider_id: pid }); store.notify(t("Modelle abgerufen")); if (store.data) await store.load(); }
    catch (e: any) { store.notify(e.message); }
    this.provBusy = "";
  }
  private providersGroup() {
    const a = this.a; const info = a.provider_info || {};
    const f = (lbl: string, el: any) => html`<label class="f"><span>${lbl}</span>${el}</label>`;
    return group(t("Reihenfolge und Notfall-Anbieter"), html`
      ${a.sdk === false ? pad(html`<div style="color:var(--lm-err)">${icon("alert", 16)} ${t("Das Python-Paket „anthropic“ fehlt noch – Home Assistant neu starten, damit es installiert wird.")}</div>`) : nothing}
      ${a.providers.map((p: any, i: number) => { const ext = p.id !== "main"; const st = p.state || {};
        return itemCard(html`<span class="step keep">${i + 1}</span><b class="grow">${ext ? tb(info[p.id]?.label) : `${a.provider.name || t("Hauptanbieter")} (${t("Hauptanbieter")})`}</b>
            <button class="iconbtn keep" title=${t("Nach oben")} ?disabled=${i === 0} @click=${() => this.moveProv(i, -1)}>${icon("up", 18)}</button>
            <button class="iconbtn keep" title=${t("Nach unten")} ?disabled=${i === a.providers.length - 1} @click=${() => this.moveProv(i, 1)}>${icon("arrowDown", 18)}</button>
            ${ext ? html`<span class="keep">${toggle(!!p.enabled, (on) => this.setProv(p.id, { enabled: on }), { label: t("eingeschaltet") })}</span>` : nothing}`,
          !ext ? html`<div class="hint">${t("Einstellungen oben unter „Hauptanbieter“ und „API-Schlüssel“.")}</div>` : !p.enabled ? nothing : html`
          <div class="two">${f(t("Verfügbarkeit"), html`<select @change=${(e: any) => this.setProv(p.id, { mode: e.target.value })}>
              <option value="fallback" ?selected=${p.mode !== "always"}>${t("Nur im Notfall")}</option><option value="always" ?selected=${p.mode === "always"}>${t("Immer wählbar")}</option></select>`)}
            ${p.id === "foundry" ? f(t("Endpunkt (Ressourcenname oder Claude-Adresse)"), html`<input placeholder="https://<ressource>.services.ai.azure.com/anthropic" .value=${p.endpoint || ""}
              @input=${(e: any) => this.setProv(p.id, { endpoint: e.target.value })}>`) : f(t("API-Schlüssel (Anthropic Console)"), secret(p.key, (v) => this.setProv(p.id, { key: v }), "sk-ant-…"))}</div>
          ${p.id === "foundry" ? html`<div class="two">${f(t("API-Schlüssel der Foundry-Ressource"), secret(p.key, (v) => this.setProv(p.id, { key: v }), t("Schlüssel aus „Schlüssel und Endpunkt“")))}
            ${f(t("Weitere Deployment-Namen (optional, durch Komma getrennt)"), html`<input placeholder=${t("z. B. {x}", { x: "mein-claude-sonnet" })} .value=${(p.extra_models || []).join(", ")}
              @input=${(e: any) => this.setProv(p.id, { extra_models: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean) })}>`)}</div>
            ${more(html`${t("Endpunkt: der Name der Ressource oder die Claude-Adresse {url} (die Azure-OpenAI-Adresse derselben Ressource rechnet LLMitMir um). Foundry hat keine Modellliste: LLMitMir fragt jedes bekannte Claude-Modell (und die Namen oben) kostenlos per Token-Zählung ab und übernimmt die Deployments, die antworten. Nur „Hosted on Azure“-Deployments verlassen Azure nicht. Abgerechnet wird über die Azure-Rechnung zu den Anthropic-Listenpreisen.", { url: "https://<ressource>.services.ai.azure.com/anthropic" })}`)}`
            : html`<div class="hint">${t("Die Modellliste kommt direkt von der Anthropic-API. Abgerechnet wird über die Anthropic Console – dort am besten zusätzlich ein Ausgabenlimit setzen.")}</div>`}
          <div class="row" style="flex-wrap:wrap">
            <button class="btn" ?disabled=${this.provBusy === p.id} @click=${() => this.refreshProv(p.id)}>${this.provBusy === p.id ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} ${t("Modelle abrufen")}${this.dirty ? t(" (speichert vorher)") : ""}</button>
            <span class="hint">${(p.models || []).length} ${t("Modelle")}${p.models_at ? ` · ${t("abgerufen {x}", { x: fmtTime(p.models_at) })}` : ""}</span>
            ${st.blocked ? html`<span class="chip err">${icon("alert", 13)} ${t("gesperrt: {r} (noch {n} min)", { r: tb(st.reason), n: Math.ceil(st.blocked_for / 60) })}</span>`
              : st.last_ok ? html`<span class="chip ok">${icon("check", 13)} ${t("zuletzt erfolgreich {x}", { x: fmtTime(st.last_ok) })}</span>` : nothing}
            ${st.last_error && !st.blocked ? html`<span class="hint" style="color:var(--lm-err)">${tb(st.last_error)}</span>` : nothing}</div>`, ext && !p.enabled); })}
      ${pad(more(html`${t("Ein Anbieter mit „Nur im Notfall“ wird erst wählbar, wenn alle eingeschalteten Anbieter davor für die Person gerade nicht nutzbar sind (Limit erreicht, Schlüssel abgelehnt, Monatslimit verbraucht). „Immer wählbar“ heißt: im Modellmenü jederzeit auswählbar. LLMitMir nimmt externe Modelle nie von selbst – nur auf ausdrücklichen Wunsch oder wenn eine geplante Aufgabe im Notfall ausweichen darf.")} ${t("Wer welches Modell bekommt und die Preise legst du hier fest:")} ${this.tabLink("costs", t("Externe Modelle & Kosten"))}.`,
        t("Wie funktioniert die Reihenfolge?")))}`,
      { desc: t("Kostenpflichtige Anbieter für Claude (Microsoft Foundry, Anthropic) als Notfall hinter dem Hauptanbieter.") });
  }

  // ================================================================ Modelle
  private models() {
    const a = this.a; const users = this.users();
    const known = a.models.known || [];
    const enabled = new Set(a.models.enabled || []);
    const defs = a.models.defaults || {};
    const live: Record<string, any> = Object.fromEntries((a.models_live || []).map((m: any) => [m.id, m]));
    const roles: [string, string, string][] = [["chat", t("Chats"), t("Normale Unterhaltungen.")], ["agent", t("Coworks und Aufgaben"), t("Längere Arbeit mit Werkzeugen.")],
      ["vision", t("Bilder und Scans lesen"), t("Wenn ein Bild, ein Scan oder ein PDF gelesen werden muss.")], ["sub", t("Teilaufgaben"), t("Sparsames Modell für abgezweigte Teilarbeit.")]];
    return html`
      ${group(t("Standardmodelle"), html`
        ${roles.map(([r, l, h]) => row(l, h, html`<select @change=${(e: any) => this.set("models", { ...a.models, defaults: { ...defs, [r]: e.target.value } })}>
          <option value="" ?selected=${!defs[r] || defs[r] === "auto"}>${t("Automatisch (derzeit {m})", { m: live[a.auto_models?.[r]]?.name || a.auto_models?.[r] || "–" })}</option>
          ${known.filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${defs[r] === m.id}>${m.name}</option>`)}</select>`))}
        ${switchRow(t("Neue Modelle automatisch freigeben"), t("Sobald der Anbieter ein neues Modell anbietet, steht es allen zur Verfügung."),
          a.models.auto_enable_new !== false, (on) => this.set("models", { ...a.models, auto_enable_new: on }))}
        ${pad(more(t("„Automatisch“ nimmt das am besten geeignete freigegebene Modell, das gerade nicht überlastet ist: Die Liste samt Auslastung wird alle drei Minuten neu geladen (zählt bei SAIA nicht zum Limit), neu erschienene Modelle werden anhand ihrer Vorgänger eingeschätzt. Hängt ein Modell im Chat, empfiehlt LLMitMir einen Wechsel; geplante Aufgaben mit automatischem Modell wechseln selbst.")))}`,
        { desc: t("Vorgaben für alle Personen; sie können in ihren Einstellungen eigene wählen.") })}
      ${group(t("Verfügbare Modelle"), html`<div class="tw"><table><tr><th>${t("Frei")}</th><th>${t("Modell")}</th><th>${t("Auslastung")}</th>
          <th title=${t("Eignung 0–100 für Chat / Cowork & Aufgaben / Bilder / Teilaufgaben")}>${t("Eignung")}</th><th>${t("Fähigkeiten")}</th><th>${t("Kontext")}</th></tr>
        ${known.map((m: any) => { const lv = live[m.id] || m; const l = load(lv); const q = lv.quality || {};
          return html`<tr><td>${toggle(enabled.has(m.id), (on) => { const s = new Set(enabled); on ? s.add(m.id) : s.delete(m.id); this.set("models", { ...a.models, enabled: [...s] }); }, { label: m.name })}</td>
            <td>${m.name}${lv.new ? html` <span class="chip accent">neu</span>` : nothing}${m.external ? html` <span class="chip warn" title=${t("Der Anbieter leitet dieses Modell an einen kommerziellen Anbieter weiter")}>${icon("external", 12)} extern</span>` : nothing}<div class="hint">${m.id}${m.gone ? t(" · nicht mehr angeboten") : m.status !== "ready" && m.status ? ` · ${m.status}` : ""}</div></td>
            <td class="hint"><span class="row" style="gap:6px;flex-wrap:nowrap">${loadDot(lv)}${l ? l.text : "–"}</span></td>
            <td class="hint" style="white-space:nowrap">${q.chat || "–"} / ${q.agent || "–"} / ${q.vision || "–"} / ${q.sub || "–"}</td>
            <td class="hint">${(m.input || []).join(", ")} → ${(m.output || []).join(", ")}</td>
            <td><input type="number" style="width:110px" placeholder=${String(a.known_context[m.id] || 128000)} .value=${a.models.context?.[m.id] ?? ""}
              @input=${(e: any) => this.set("models", { ...a.models, context: { ...(a.models.context || {}), [m.id]: e.target.value ? Number(e.target.value) : undefined } })}>
              ${a.learned_context?.[m.id] ? html`<div class="hint" title=${t("Der Server hat eine zu lange Anfrage mit dieser Grenze abgelehnt. LLMitMir rechnet 30 Tage lang höchstens damit.")}>${t("Server:")} ${Number(a.learned_context[m.id]).toLocaleString(dateLocale())}</div>` : nothing}</td></tr>`; })}</table></div>`,
        { desc: html`${known.length} ${t("Modelle bekannt. Eignung: Chat / Cowork / Bilder / Teilaufgaben (0–100). Kontext leer = Angabe des Anbieters. Lehnt der Server eine Anfrage als zu lang ab, rechnet LLMitMir mit der Grenze, die er nennt (auch unter einem eingetragenen Wert).")}`,
          aside: html`<button class="btn" @click=${this.refresh} ?disabled=${this.loading}>${this.loading ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} ${t("Liste laden")}</button>` })}
      ${this.mainExtGroup(users, known)}`;
  }
  /** Models the main provider marks as external (SAIA forwards them to commercial vendors): released per person, like
   *  the billed external models – but without prices, LLMitMir cannot know them. */
  private mainExtGroup(users: any[], known: any[]) {
    const models = known.filter((m: any) => m.external && !m.gone);
    if (!models.length) return nothing;
    const acc = this.a.model_access || {};
    const setAcc = (key: string, uid: string, on: boolean) => {
      const cur = new Set<string>(acc[key] || []); on ? cur.add(uid) : cur.delete(uid);
      this.set("model_access", { ...acc, [key]: [...cur] });
    };
    return group(t("Externe Modelle des Hauptanbieters"), html`<div class="tw"><table class="matrix"><tr><th>${t("Modell")}</th>${users.map((u: any) => html`<th>${u.name}</th>`)}</tr>
        ${models.map((m: any) => html`<tr><td>${m.name}<div class="hint">${m.id}</div></td>
          ${users.map((u: any) => html`<td><input type="checkbox" .checked=${(acc[m.id] || []).includes(u.id)} @change=${(e: any) => setAcc(m.id, u.id, e.target.checked)}></td>`)}</tr>`)}</table></div>
      ${pad(more(t("LLMitMir behandelt sie wie die kostenpflichtigen externen Modelle: nie automatisch gewählt, nur für hier angehakte Personen, erst nach deren Zustimmung, Zugänge nur mit Freigabe für externe Modelle, Projekte lassen sich sperren. Kosten bucht LLMitMir für sie nicht – wie und zu welchem Preis der Anbieter sie einkauft, ist nicht bekannt; sie zählen zum normalen Kontingent.")))}`,
      { desc: t("Laufen nicht im Rechenzentrum des Anbieters, sondern werden an kommerzielle Anbieter weitergeleitet. Wer darf sie nutzen?") });
  }

  // ================================================================ Externe Modelle & Kosten
  private costs() {
    const users = this.users();
    const ext = this.extModelsGroup(users); const costs = this.costsGroup(users);
    if (ext === nothing && costs === nothing) return empty("euro", html`${t("Noch keine kostenpflichtigen Anbieter eingerichtet. Schalte Microsoft Foundry oder die Anthropic-API ein und rufe die Modelle ab – dann legst du hier Preise, Freigaben und Monatslimits fest.")} ${this.tabLink("providers", t("Anbieter & Schlüssel"))}`);
    return html`${ext}${costs}`;
  }
  private extModelsGroup(users: any[]) {
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
    return group(t("Preise und Freigaben"), html`
      <div class="tw"><table class="matrix"><tr><th>${t("Modell")}</th><th class="num">${t("Lesen €/Mio.")}</th><th class="num">${t("Schreiben €/Mio.")}</th>${users.map((u: any) => html`<th>${u.name}</th>`)}</tr>
        ${sorted.map((m: any) => { const ov = (b.prices || {})[m.key] || {}; const p = m.price;
          return html`<tr><td>${m.name}<div class="hint">${m.provider_name} · ${m.id}${p ? "" : html` · <span style="color:var(--lm-err)">${t("Preis fehlt")}</span>`}</div></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${p ? decStr(p.in) : "?"} .value=${ov.in != null ? decStr(ov.in) : ""} @input=${(e: any) => setPrice(m.key, "in", e.target.value)}></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${p ? decStr(p.out) : "?"} .value=${ov.out != null ? decStr(ov.out) : ""} @input=${(e: any) => setPrice(m.key, "out", e.target.value)}></td>
            ${users.map((u: any) => html`<td><input type="checkbox" .checked=${(acc[m.key] || []).includes(u.id)} @change=${(e: any) => setAcc(m.key, u.id, e.target.checked)}></td>`)}</tr>`; })}</table></div>
      ${row(t("Umrechnungskurs USD → EUR"), t("Für die Anthropic-Listenpreise."), html`<input class="short" inputmode="decimal" .value=${decStr(b.usd_eur ?? 0.86)}
          @input=${(e: any) => this.set("billing", { ...b, usd_eur: e.target.value.replace(",", ".") })}>`)}
      ${row(t("Ersatzmodell für Notfälle"), t("Für die einfache Ansicht und geplante Aufgaben."), html`<select @change=${(e: any) => this.set("billing", { ...b, fallback_model: e.target.value })}>
          <option value="" ?selected=${!b.fallback_model}>${t("Das günstigste freigegebene Modell")}</option>
          ${sorted.map((m: any) => html`<option value=${m.key} ?selected=${b.fallback_model === m.key}>${m.name} (${m.provider_name})</option>`)}</select>`)}
      ${pad(more(t("Preise in € je Million Tokens; leer = Anthropic-Listenpreis umgerechnet mit dem Kurs. Ohne Preis wird ein Modell niemandem angeboten (keine Abrechnung möglich). Die Personen sehen die Modelle vom günstigsten zum teuersten. Cache-Preise leitet LLMitMir aus dem Lesepreis ab (Listenpreise: genau nach Anthropic). Jede Anfrage wird mit dem Preis gebucht, der in dem Moment galt – spätere Preisänderungen ändern die Vergangenheit nicht.")))}`,
      { desc: t("Ein externes Modell bekommt nur, wer hier angehakt ist und unten ein Monatslimit über 0 € hat.") });
  }
  private costsGroup(users: any[]) {
    const a = this.a; const b = a.billing || {}; const costs = a.costs || {};
    if (!(a.providers || []).some((p: any) => p.id !== "main" && p.enabled) && !Object.values(costs).some((c: any) => c.months?.some((m: any) => m.eur > 0))) return nothing;
    const limits = b.limits || {};
    const all = users.map((u: any) => costs[u.id]?.months || []);
    const max = Math.max(0.01, ...all.flat().map((m: any) => m.eur));
    const total = all.reduce((sum: number, ms: any[]) => sum + (ms[ms.length - 1]?.eur || 0), 0);
    const monthLabel = (k: string) => { const [y, m] = k.split("-"); return `${m}/${y.slice(2)}`; };
    return group(t("Kosten und Monatslimits"), html`
      ${row(t("Standard-Limit je Person"), t("€ je Monat. 0 € = keine externen Modelle."), html`<input class="short" inputmode="decimal" .value=${decStr(b.limit_default ?? 0)}
        @input=${(e: any) => this.set("billing", { ...b, limit_default: e.target.value.replace(",", ".") })}> <span class="hint">€</span>`)}
      <div class="tw"><table><tr><th>${t("Person")}</th><th class="num">${t("Limit €/Monat")}</th><th class="num">${t("Dieser Monat")}</th><th>${t("Letzte 12 Monate")}</th><th class="num">${t("Gesamt")}</th></tr>
        ${users.map((u: any, i: number) => { const ms = all[i]; const cur = ms[ms.length - 1] || {}; const sum = ms.reduce((x: number, m: any) => x + m.eur, 0);
          const lim = costs[u.id]?.limit || 0;
          return html`<tr><td>${u.name}</td>
            <td class="num"><input style="width:90px" inputmode="decimal" placeholder=${decStr(b.limit_default || 0)} .value=${limits[u.id] != null ? decStr(limits[u.id]) : ""}
              @input=${(e: any) => { const l = { ...limits }; if (e.target.value === "") delete l[u.id]; else l[u.id] = e.target.value.replace(",", "."); this.set("billing", { ...b, limits: l }); }}></td>
            <td class="num">${fmtEur(cur.eur || 0)}${lim ? html`<div class="hint">${Math.round(100 * (cur.eur || 0) / lim)} %</div>` : nothing}</td>
            <td><div class="mbars">${ms.map((m: any) => html`<div title="${monthLabel(m.month)}: ${fmtEur(m.eur)} · ${m.requests} ${t("Anfragen")} · ${fmtNum(m.input + m.output + m.cache_read + m.cache_write)} ${t("Tokens")}${m.task_eur ? ` · ${t("davon Aufgaben {x}", { x: fmtEur(m.task_eur) })}` : ""}"
              style="height:${Math.max(1, (m.eur / max) * 32)}px"></div>`)}</div></td>
            <td class="num">${fmtEur(sum)}</td></tr>`; })}
        <tr><td><b>${t("Alle")}</b></td><td></td><td class="num"><b>${fmtEur(total)}</b></td><td></td><td></td></tr></table></div>`,
      { desc: t("Jede Anfrage an ein externes Modell wird mit Tokens und Kosten erfasst. Ist das Limit erreicht, sind externe Modelle für die Person bis zum Monatsersten gesperrt.") });
  }

  // ================================================================ Zugänge & Konnektoren
  private credentials() { return html`${this.credPolicyGroup()}${this.connectorsGroup()}`; }
  private credPolicyGroup() {
    const a = this.a; const cp = a.credentials_policy || {}; const sc = a.cred_scopes || {};
    const rows = this.users().filter((u: any) => sc[u.id]);
    const setCp = (k: string, v: boolean) => this.set("credentials_policy", { ...cp, [k]: v });
    return group(t("Regeln für Zugänge"), html`
      ${switchRow(t("Eigene Zugänge ohne Konnektor erlauben"), t("Aus: Neue Systeme lassen sich nur noch über Konnektoren verbinden. Vorhandene eigene Zugänge bleiben nutzbar."),
        cp.free_credentials !== false, (on) => setCp("free_credentials", on))}
      ${switchRow(t("Chats mit internen Daten für externe Modelle sperren"), html`${t("Empfohlen. Sobald ein Chat interne Daten enthält, nimmt er samt Teilaufgaben kein externes Modell mehr an – auch nicht als Notfall.")} ${more(t("An (empfohlen): Sobald in einem Chat ein Zugang ohne Freigabe für externe Modelle benutzt, eine Datenregel nur für interne Modelle durchgelassen oder ein Skill „nur für interne Modelle“ geladen wurde, nimmt dieser Chat samt Teilaufgaben kein externes Modell mehr an – auch nicht als Notfall-Ausweichmodell. Aus: Wie bisher werden beim Wechsel nur die Ergebnisse solcher Zugänge aus dem Verlauf entfernt; was ein Modell daraus geschrieben hat (Antworten, Dateien, Ergebnisse von Teilaufgaben), geht mit."))}`,
        cp.lock_chats !== false, (on) => setCp("lock_chats", on))}
      ${switchRow(html`${t("Zentrale Systemzugänge erlauben")} <span class="chip warn">${t("nur im Notfall")}</span>`, t("Aus: Zugänge der Art „zentraler Systemzugang“ lassen sich nicht anlegen, vorhandene sind gesperrt – kein Modell sieht oder nutzt sie."),
        !!cp.allow_central, (on) => setCp("allow_central", on))}
      ${rows.length ? html`<div class="tw"><table><tr><th>${t("Person")}</th><th class="num">eigene</th><th class="num">${t("persönliche")}</th><th class="num">zentrale</th><th class="num">${t("ohne Art")}</th></tr>
        ${rows.map((u: any) => html`<tr><td>${u.name}</td><td class="num">${sc[u.id].dedicated}</td><td class="num">${sc[u.id].personal}</td>
          <td class="num" style=${sc[u.id].central ? "color:var(--lm-warn)" : ""}>${sc[u.id].central}</td><td class="num">${sc[u.id].none}</td></tr>`)}</table></div>
        ${pad(html`<div class="hint">${t("Gezählt werden die Personen, die LLMitMir seit dem letzten Start benutzt haben. Inhalte der Zugänge siehst du hier nicht.")}</div>`)}` : nothing}`,
      { desc: t("Personen sollen eigene Zugänge in ihrem Nutzerkontext verwenden (App-Passwort, eigener Token mit minimalen Rechten) – keine persönlichen Anmeldedaten und keine zentralen Systemzugänge. Jeder Zugang braucht in jedem Chat die Freigabe der Person.") });
  }
  /** Konnektoren: Vorlagen für Zugänge, die jede Person mit dem eigenen Konto verbindet (connectors.py).
   *  Übersicht als Kacheln wie auf der Seite der Personen; ein Klick öffnet den Konnektor zum Bearbeiten. */
  private connectorsGroup() {
    const list: any[] = this.a.connectors || [];
    const types: Record<string, any> = store.data?.credential_types || {};
    const desc = html`${t("Vorbereitete Anbindungen: Du legst Typ, feste Felder und erlaubte Server fest, jede Person verbindet auf der Seite „Konnektoren“ nur ihr eigenes Konto – auch mehrfach.")}
      ${more(t("Daraus entsteht je Verbindung ein Zugang im Nutzerkontext der Person. Eingerichtet wird in einem geführten Chat: Das Modell folgt deiner Einrichtungsanleitung Schritt für Schritt, Passwörter und Tokens trägt die Person in ein Formular ein, das das Modell nie sieht. Danach wählt sie, wofür der Zugang verwendet werden darf, und kann einen Skill hinterlegen. Beim Nextcloud Login Flow meldet sich die Person im Browser bei der Nextcloud an, und LLMitMir bekommt ein eigenes App-Passwort. Die Anleitung für das Modell gilt bei jeder Arbeit mit einem verbundenen Zugang. Ausgeschaltete Konnektoren sperren ihre Zugänge."))}`;
    const i = this.knOpen;
    if (i >= 0 && i < list.length) return group(t("Konnektoren"), this.connectorEditor(list[i], i, types), { desc });
    const add = () => { this.set("connectors", [...list, { name: "", type: "webdav", login: "form", fixed: {}, hosts: [], enabled: true }]); this.knOpen = list.length; };
    return group(t("Konnektoren"), html`
      ${list.length ? nothing : empty("share", t("Noch keine Konnektoren. Ein Konnektor ist eine vorbereitete Anbindung, z. B. an die Nextcloud – jede Person verbindet nur noch ihr Konto."))}
      <div class="kntiles">${list.map((x: any, j: number) => html`<button class="kntile ${x.enabled === false ? "off" : ""}" @click=${() => (this.knOpen = j)}>
          <span class="kic">${icon(x.mcp ? "mdi:connection" : x.type === "webdav" ? "cloud" : ["imap", "ews", "gwdg"].includes(x.type) ? "mdi:email-outline" : "key", 20)}</span>
          <span class="ktx"><b>${x.name || t("Ohne Namen")}</b><span class="hint">${tb(types[x.type]?.label) || x.type}${x.login === "nextcloud_flow" ? t(" · Login Flow") : ""}</span>
            <span class="kchips">${x.enabled === false ? html`<span class="chip">${t("aus")}</span>` : html`<span class="chip ok">${t("aktiv")}</span>`}
              ${x.setup ? html`<span class="chip accent" title=${t("Einrichtungsanleitung hinterlegt")}>${icon("chat", 12)} ${t("Anleitung")}</span>` : nothing}
              ${x.mcp ? html`<span class="chip">MCP · ${(x.mcp.tools || []).filter((tl: any) => tl.enabled !== false).length}</span>` : nothing}
              ${(x.rules || []).length ? html`<span class="chip">${icon("shield", 12)} ${x.rules.length}</span>` : nothing}</span></span>
          <span class="kgo">${icon("right", 18)}</span></button>`)}
        <button class="kntile add" @click=${add}><span class="kic">${icon("plus", 20)}</span><span class="ktx"><b>${t("Konnektor hinzufügen")}</b></span></button></div>`,
      { desc });
  }
  /** Einen Konnektor bearbeiten (aus der Kachel-Übersicht geöffnet). Gespeichert wird wie alles andere über die Speicherleiste. */
  private connectorEditor(x: any, i: number, types: Record<string, any>) {
    const ty = types[x.type] || { fields: [], secret: [] };
    const sec = new Set<string>(ty.secret || []);
    const hidden = new Set<string>([...(ty.hidden || []), ...(ty.obsolete || [])]);
    const fs: string[] = (ty.fields || []).filter((f: string) => !sec.has(f) && !hidden.has(f));
    const drop = async () => {
      if (!(await confirmDialog(t("Konnektor {name} entfernen? Die Zugänge der Personen dazu werden gesperrt (nach dem Speichern).", { name: `„${x.name || "?"}“` }), t("Entfernen")))) return;
      this.dropItem("connectors", i); this.knOpen = -1;
    };
    return html`<div class="pad"><div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="btn ghost" @click=${() => (this.knOpen = -1)}>${icon("left", 16)} ${t("Alle Konnektoren")}</button><span class="grow"></span>
        ${toggle(x.enabled !== false, (on) => this.setList("connectors", i, { enabled: on }), { label: t("aktiv") })} <span class="hint">${x.enabled !== false ? t("aktiv") : t("aus")}</span>
        <button class="btn ghost danger" @click=${drop}>${icon("trash", 16)} ${t("Entfernen")}</button></div></div>
      ${pad(html`<div class="kform">
        <div class="two"><label class="f"><span>${t("Name")}</span><input placeholder=${t("z. B. {x}", { x: "GitLab" })} .value=${x.name || ""} @input=${(e: any) => this.setList("connectors", i, { name: e.target.value })}></label>
          <label class="f"><span>${t("Typ")}</span><select @change=${(e: any) => this.setList("connectors", i, { type: e.target.value, fixed: {}, login: "form" })}>
            ${Object.entries(types).map(([k, v]: any) => html`<option value=${k} ?selected=${x.type === k}>${tb(v.label)}</option>`)}</select></label></div>
        <label class="f"><span>${t("Beschreibung für die Personen")}</span><input .value=${x.description || ""} @input=${(e: any) => this.setList("connectors", i, { description: e.target.value })}></label>
        <div class="two"><label class="f"><span>${t("Anmeldung")}</span><select @change=${(e: any) => this.setList("connectors", i, { login: e.target.value })}>
            <option value="form" ?selected=${x.login !== "nextcloud_flow"}>${t("Per Formular")}</option>
            ${x.type === "webdav" ? html`<option value="nextcloud_flow" ?selected=${x.login === "nextcloud_flow"}>${t("Nextcloud Login Flow")}</option>` : nothing}</select></label>
          <label class="f"><span>${t("Weitere erlaubte Server")}</span><input placeholder=${t("Komma-getrennt, auch *.example.org")} .value=${(x.hosts || []).join(", ")}
            @change=${(e: any) => this.setList("connectors", i, { hosts: e.target.value.split(/[\s,;]+/).map((h: string) => h.trim()).filter(Boolean) })}></label></div>
        ${fs.length ? html`<div class="two">${fs.map(f => html`<label class="f"><span>${fieldLabel(x.type, f)} <span class="hint">(${t("fest; leer = trägt die Person ein")})</span></span>
          <input .value=${(x.fixed || {})[f] || ""} placeholder=${(ty.placeholders || {})[f] || ""}
            @input=${(e: any) => this.setList("connectors", i, { fixed: { ...(x.fixed || {}), [f]: e.target.value } })}></label>`)}</div>` : nothing}
        ${Object.keys(ty.services || {}).length ? html`<div class="f"><span class="hint">${t("Wofür der Konnektor gilt (ob lesen oder auch schreiben, wählt jede Person beim Verbinden)")}</span>
          <div class="row" style="flex-wrap:wrap;gap:12px">${Object.entries(ty.services).map(([k, l]: any) => html`<label class="row hint" style="gap:6px">
          <input type="checkbox" style="width:auto" .checked=${(x.services || ty.default_services || []).includes(k)}
            @change=${(e: any) => { const cur = new Set<string>(x.services || ty.default_services || []); e.target.checked ? cur.add(k) : cur.delete(k); this.setList("connectors", i, { services: [...cur] }); }}> ${l}</label>`)}</div></div>` : nothing}
        <label class="f"><span>${icon("chat", 14)} ${t("Einrichtungsanleitung für den geführten Chat")} <span class="hint">(${t("empfohlen")})</span></span>
          <textarea rows="7" placeholder=${t("Schritt für Schritt, z. B.:\n1. In GitLab oben rechts auf dein Profilbild → Einstellungen → Access Tokens.\n2. Name „LLMitMir“, Ablaufdatum in einem Jahr, Rolle Reporter, Scope read_api.\n3. Token kopieren – er wird nur einmal angezeigt.\nFrag auch, für welches Projekt der Zugang gedacht ist, und schlag einen passenden Skill vor.")}
            .value=${x.setup || ""} @input=${(e: any) => this.setList("connectors", i, { setup: e.target.value })}></textarea>
          <span class="hint">${t("Danach richtet sich das Modell im Einrichtungs-Chat: Es führt Frage für Frage durch, Passwörter und Tokens trägt die Person in ein Formular ein, das das Modell nie sieht. Anschließend wählt sie, wofür der Zugang verwendet werden darf, und kann einen Skill hinterlegen.")}</span></label>
        <label class="f"><span>${t("Anleitung für das Modell")} <span class="hint">(${t("optional, gilt bei jeder Arbeit mit dem Zugang")})</span></span><textarea rows="3" placeholder=${t("Wie mit diesem System gearbeitet wird")} .value=${x.instructions || ""}
          @input=${(e: any) => this.setList("connectors", i, { instructions: e.target.value })}></textarea></label>
        ${["bearer", "header", "basic"].includes(x.type) ? this.mcpEditor(x, i) : nothing}
        ${this.rulesEditor(x, i)}</div>`)}`;
  }
  /** MCP-Server (mcp.py): Werkzeuge abrufen und einzeln freigeben – die Liste wird eingefroren. */
  private mcpEditor(x: any, i: number) {
    const on = !!x.mcp; const tools: any[] = x.mcp?.tools || [];
    const setTools = (list: any[]) => this.setList("connectors", i, { mcp: { tools: list } });
    const secretField = x.type === "bearer" ? "token" : x.type === "header" ? "key" : "password";
    const fetchTools = async () => {
      this.mcpBusy = i;
      try {
        const fields: any = { ...(x.fixed || {}), [secretField]: this.mcpSecret[i] || "" };
        const r = await store.api.ws("admin/mcp_tools", { url: x.fixed?.url || "", auth_type: x.type, fields });
        const old = new Map(tools.map((tl: any) => [tl.name, tl]));
        setTools(r.tools.map((tl: any) => old.has(tl.name) ? { ...tl, enabled: old.get(tl.name).enabled, write: old.get(tl.name).write } : tl));
        store.notify(t("{n} Werkzeuge abgerufen – bitte einzeln freigeben", { n: r.tools.length }));
      } catch (e: any) { store.notify(e.message); }
      this.mcpBusy = -1;
    };
    return html`<div class="row" style="gap:10px">${toggle(on, (v) => this.setList("connectors", i, { mcp: v ? { tools } : null }))}
        <span><b style="font-size:13.5px">MCP-Server</b> <span class="hint">– ${t("Adresse oben = MCP-Endpunkt, nur https")}</span></span></div>
      ${on ? html`<div class="card" style="display:grid;gap:8px;background:var(--lm-bg)">
        <div class="hint">${t("Werkzeuge einmal abrufen und einzeln freigeben. Beschreibungen und Parameter werden eingefroren – ändert der Server etwas, gilt das erst nach erneutem Abrufen und Freigeben. Jede Person verbindet den Konnektor mit ihrem eigenen Token. Schreibende Werkzeuge fragen vor jedem Aufruf nach.")}</div>
        <div class="row" style="flex-wrap:wrap;gap:6px"><input type="password" autocomplete="off" style="flex:1;min-width:160px" placeholder=${t("Dein Token nur für den Abruf (wird nicht gespeichert)")}
          .value=${this.mcpSecret[i] || ""} @input=${(e: any) => (this.mcpSecret = { ...this.mcpSecret, [i]: e.target.value })}>
          <button class="btn" ?disabled=${this.mcpBusy === i || !x.fixed?.url} @click=${fetchTools}>${icon("retry", 15)} ${t("Werkzeuge abrufen")}</button></div>
        ${tools.length ? html`<div class="tw"><table><tr><th>frei</th><th>${t("Werkzeug")}</th><th>schreibt</th></tr>
          ${tools.map((tl: any, j: number) => html`<tr><td><input type="checkbox" .checked=${tl.enabled !== false}
              @change=${(e: any) => setTools(tools.map((u: any, n: number) => (n === j ? { ...u, enabled: e.target.checked } : u)))}></td>
            <td><b>${tl.name}</b><div class="hint">${tl.description}</div></td>
            <td><input type="checkbox" .checked=${!!tl.write} @change=${(e: any) => setTools(tools.map((u: any, n: number) => (n === j ? { ...u, write: e.target.checked } : u)))}></td></tr>`)}</table></div>`
          : html`<div class="hint">${t("Noch keine Werkzeuge abgerufen.")}</div>`}</div>` : nothing}`;
  }
  /** Datenregeln eines Konnektors (datarules.py): Bereich, Anweisung in Worten, für welche Modelle. */
  private rulesEditor(x: any, i: number) {
    const rules: any[] = x.rules || [];
    const setRule = (j: number, patch: any) => this.setList("connectors", i, { rules: rules.map((r: any, n: number) => (n === j ? { ...r, ...patch } : r)) });
    return html`<details ?open=${rules.length > 0}><summary class="hint" style="cursor:pointer">${icon("shield", 14)} ${t("Datenregeln ({n})", { n: rules.length })}</summary>
      <div class="hint" style="margin:6px 0">${t("Bevor ein Werkzeug Inhalte aus dem Bereich abruft, prüft ein Wächter auf dem Hauptanbieter die Anweisung anhand der Metadaten (bei Nextcloud: Tags, Typ, Größe, Besitzer) – nie anhand der Inhalte. Gesperrt heißt: kein Abruf. Bereich mit * und **, z. B. /Gruppen/Finanzen/** – leer = ganzer Konnektor. Rohzugriffe (Werkbank-Befehle, freie HTTP-Anfragen) sind für Konnektoren mit Datenregeln gesperrt; Ordnerlisten gelten als Metadaten.")}</div>
      ${rules.map((r: any, j: number) => html`<div class="card" style="display:grid;gap:6px;margin-bottom:6px;background:var(--lm-bg)">
        <div class="row" style="flex-wrap:wrap;gap:8px"><input style="flex:1;min-width:120px" placeholder="Name" .value=${r.name || ""} @input=${(e: any) => setRule(j, { name: e.target.value })}>
          <input style="flex:1;min-width:160px" class="code" placeholder=${t("Bereich, z. B. /Gruppen/Finanzen/**")} .value=${r.scope || ""} @input=${(e: any) => setRule(j, { scope: e.target.value })}>
          <select style="width:auto" @change=${(e: any) => setRule(j, { applies: e.target.value })}>
            <option value="external" ?selected=${r.applies !== "all"}>${t("nur externe Modelle")}</option><option value="all" ?selected=${r.applies === "all"}>${t("alle Modelle")}</option></select>
          ${toggle(r.enabled !== false, (on) => setRule(j, { enabled: on }), { label: t("aktiv") })}
          <button class="iconbtn" title=${t("Entfernen")} @click=${() => this.setList("connectors", i, { rules: rules.filter((_: any, n: number) => n !== j) })}>${icon("trash", 16)}</button></div>
        <textarea rows="2" placeholder=${t("Anweisung, z. B.: Nur Dateien mit Tag public oder internal dürfen an externe Modelle, nie restricted. Ungelabelte Dateien sind für alle Modelle gesperrt.")}
          .value=${r.instruction || ""} @input=${(e: any) => setRule(j, { instruction: e.target.value })}></textarea></div>`)}
      <button class="btn ghost" @click=${() => this.setList("connectors", i, { rules: [...rules, { name: "", scope: "", applies: "external", instruction: "", enabled: true }] })}>${icon("plus", 14)} ${t("Datenregel")}</button></details>`;
  }

  // ================================================================ Skills
  private skills() { return html`${this.centralSkillsGroup()}${this.skillPoliciesGroup()}`; }
  /** Zentrale Skills: gelten für alle, in der Oberfläche der Personen unsichtbar (skillcheck.py). */
  private centralSkillsGroup() {
    const list: any[] = this.a.central_skills || [];
    return group(t("Zentrale Skills"), html`
      ${list.length ? nothing : empty("skill", t("Noch keine zentralen Skills – etwa Stilrichtlinien oder Gebote und Verbote, die für alle gelten."))}
      ${list.map((x: any, i: number) => itemCard(html`<input placeholder="Name" .value=${x.name || ""} @input=${(e: any) => this.setList("central_skills", i, { name: e.target.value })}>
          <select @change=${(e: any) => this.setList("central_skills", i, { mode: e.target.value })}>
            <option value="always" ?selected=${x.mode !== "on_demand"}>${t("immer aktiv")}</option><option value="on_demand" ?selected=${x.mode === "on_demand"}>${t("bei Bedarf")}</option></select>
          <span class="keep">${toggle(x.enabled !== false, (on) => this.setList("central_skills", i, { enabled: on }), { label: t("aktiv") })}</span>
          <button class="iconbtn keep" title=${t("Entfernen")} @click=${() => this.dropItem("central_skills", i)}>${icon("trash", 16)}</button>`, html`
        ${x.mode === "on_demand" ? html`<input placeholder=${t("Beschreibung: wann der Skill gilt")} .value=${x.description || ""} @input=${(e: any) => this.setList("central_skills", i, { description: e.target.value })}>` : nothing}
        <textarea rows="5" placeholder=${t("Anleitung (Markdown)")} .value=${x.body || ""} @input=${(e: any) => this.setList("central_skills", i, { body: e.target.value })}></textarea>`, x.enabled === false))}
      <div class="gfoot"><button class="btn" @click=${() => this.set("central_skills", [...list, { name: "", mode: "always", body: "", enabled: true }])}>${icon("plus", 16)} ${t("Zentralen Skill hinzufügen")}</button></div>`,
      { desc: html`${t("Gelten für alle Personen und alle Läufe und erscheinen in deren Oberfläche nicht. „Immer aktiv“ steht im Systemprompt jedes Laufs, „bei Bedarf“ lädt das Modell wie einen eigenen Skill.")}
        ${more(t("„Immer aktiv“ hat Vorrang vor persönlichen Hinweisen, Projekt-Anweisungen, eigenen Skills und Bitten im Chat. Eigene Skills mit demselben Namen lassen sich nicht anlegen; widersprechende fängt eine Skill-Richtlinie ab (Vorlage „Widerspruch zu zentralen Vorgaben“). Die Inhalte sind nicht geheim."))}` });
  }
  /** Skill-Richtlinien: Prüfungen aller eigenen Skills mit Aktion (sperren, benachrichtigen, protokollieren). */
  private skillPoliciesGroup() {
    const list: any[] = this.a.skill_policies || [];
    const kinds: [string, string][] = [["regex", t("Muster (regulärer Ausdruck)")], ["max_length", t("Höchstlänge")], ["forbidden_hosts", t("Verbotene Server")],
      ["secrets", t("Geheimnisse im Klartext")], ["model", t("Prüfauftrag an ein Modell")]];
    const acts: [string, string][] = [["block", t("sperren")], ["notify", t("Person benachrichtigen")], ["log", t("nur protokollieren")]];
    const param = (x: any, i: number) => x.kind === "regex" ? html`<input class="code" placeholder=${t("z. B. {x}", { x: "ftp://\\S+" })} .value=${x.pattern || ""} @input=${(e: any) => this.setList("skill_policies", i, { pattern: e.target.value })}>`
      : x.kind === "max_length" ? html`<input type="number" min="100" placeholder=${t("Zeichen")} .value=${String(x.value ?? "")} @input=${(e: any) => this.setList("skill_policies", i, { value: Number(e.target.value) })}>`
      : x.kind === "forbidden_hosts" ? html`<input placeholder="evil.example, *.example.org" .value=${x.hosts || ""} @input=${(e: any) => this.setList("skill_policies", i, { hosts: e.target.value })}>`
      : x.kind === "model" ? html`<textarea rows="2" placeholder=${t("Prüfauftrag in Worten – läuft nur auf dem Hauptanbieter")} .value=${x.prompt || ""} @input=${(e: any) => this.setList("skill_policies", i, { prompt: e.target.value })}></textarea>`
      : html`<div class="hint">${t("Erkennt Tokens, Schlüssel und Passwörter im Text des Skills (Platzhalter {{cred:…}} sind erlaubt).")}</div>`;
    const c = this.checks;
    return html`${group(t("Skill-Richtlinien"), html`
      ${list.length ? nothing : empty("shield", t("Noch keine Richtlinien. Unten findest du Vorlagen zum Hinzufügen."))}
      ${list.map((x: any, i: number) => itemCard(html`<input placeholder="Name" .value=${x.name || ""} @input=${(e: any) => this.setList("skill_policies", i, { name: e.target.value })}>
          <select @change=${(e: any) => this.setList("skill_policies", i, { kind: e.target.value })}>${kinds.map(([k, l]) => html`<option value=${k} ?selected=${x.kind === k}>${l}</option>`)}</select>
          <select @change=${(e: any) => this.setList("skill_policies", i, { action: e.target.value })}>${acts.map(([k, l]) => html`<option value=${k} ?selected=${(x.action || "log") === k}>${l}</option>`)}</select>
          <span class="keep">${toggle(x.enabled !== false, (on) => this.setList("skill_policies", i, { enabled: on }), { label: t("aktiv") })}</span>
          <button class="iconbtn keep" title=${t("Entfernen")} @click=${() => this.dropItem("skill_policies", i)}>${icon("trash", 16)}</button>`, param(x, i), x.enabled === false))}
      <div class="gfoot">
        <button class="btn" @click=${() => this.set("skill_policies", [...list, { name: "", kind: "regex", action: "log", enabled: true }])}>${icon("plus", 16)} ${t("Richtlinie")}</button>
        ${(this.a.skill_presets || []).map((p: any) => html`<button class="btn ghost" title=${t("Vorlage hinzufügen")} @click=${() => this.set("skill_policies", [...list, { ...p, enabled: true }])}>${icon("plus", 14)} ${p.name}</button>`)}</div>`,
      { desc: html`${t("Jeder eigene Skill wird beim Speichern, beim Import und nachts geprüft.")} <b>${t("Sperren")}</b>: ${t("kein Modell sieht den Skill, die Person erfährt den Grund.")}
        <b>${t("Benachrichtigen")}</b>: ${t("Karte auf der Startseite der Person.")}
        ${more(t("Nachts wird nur geprüft, wenn sich Richtlinien oder zentrale Skills geändert haben. Solange eine sperrende Modell-Prüfung aussteht oder scheitert, bleibt der Skill gesperrt. Jeder Befund steht im Monitoring. Modell-Prüfungen laufen auf dem Hauptanbieter und zählen zum Kontingent der Person."))}` })}
      ${group(t("Ergebnisse der Prüfung"), c ? (c.rows.length ? html`<div class="tw"><table><tr><th>${t("Person")}</th><th>Skill</th><th>${t("Zustand")}</th><th>${t("Befunde")}</th></tr>
          ${c.rows.map((r: any) => html`<tr><td>${r.user_name}</td><td>${r.skill}</td>
            <td><span class="chip ${r.state === "blocked" ? "err" : r.state === "pending" ? "warn" : ""}">${({ blocked: "gesperrt", pending: t("Prüfung steht aus"), warn: t("Hinweis"), ok: "ok" } as any)[r.state] || r.state}</span></td>
            <td>${r.findings.map((f: any) => html`<div><b>${tb(f.name)}:</b> ${tb(f.reason)}</div>`)}${r.error ? html`<div class="hint">${t("Prüfung nicht möglich:")} ${tb(r.error)}</div>` : nothing}</td></tr>`)}</table></div>`
          : empty("check", t("Keine Befunde bei {n} Skills.", { n: c.total })))
        : pad(html`<div class="hint">${t("Gespeicherte Richtlinien greifen sofort; „Laden“ zeigt Skills mit Befunden (ohne deren Text).")}</div>`),
        { aside: html`<button class="btn ghost" @click=${async () => { try { this.checks = await store.api.ws("admin/skill_checks"); } catch (e: any) { store.notify(e.message); } }}>${icon("retry", 15)} ${t("Laden")}</button>
          <button class="btn ghost" @click=${async () => { try { await store.api.ws("admin/skill_recheck"); store.notify(t("Prüfung gestartet")); } catch (e: any) { store.notify(e.message); } }}>${icon("play", 15)} ${t("Alle jetzt prüfen")}</button>` })}`;
  }

  // ================================================================ Werkbank
  private werkbank() {
    const a = this.a;
    const wb = (patch: any) => this.set("werkbank", { ...a.werkbank, ...patch });
    return html`
      ${group(t("Verbindung"), html`
        ${row(t("URL der Werkbank"), t("Adresse samt Port, auf dem der Werkbank-Dienst läuft."), html`<input class="code" placeholder="http://192.168.1.50:8787" .value=${a.werkbank?.url || ""}
          @input=${(e: any) => wb({ url: e.target.value })}>`)}
        ${row(t("Token"), t("Steht nach der Installation auf dem Bildschirm."), secret(a.werkbank?.token, (v) => wb({ token: v }), t("Token eintragen")))}
        ${row(t("Verbindung testen"), this.wbTest && !this.wbTest.testing ? (this.wbTest.ok
            ? html`<span class="chip ok">${icon("check", 13)} ${t("verbunden")} · ${t("Version {v}", { v: this.wbTest.version })} · ${this.wbTest.sessions}/${this.wbTest.max_sessions} ${t("Sandboxen")}${this.wbTest.sandbox_image_ready ? "" : t(" · Sandbox-Image fehlt!")}</span>`
            : html`<span class="chip err">${icon("alert", 13)} ${tb(this.wbTest.error)}</span>`) : t("Danach auf „Speichern“ klicken."),
          html`<button class="btn" @click=${async () => { this.wbTest = { testing: true };
            try { this.wbTest = await store.api.ws("admin/werkbank_test", { url: a.werkbank?.url || "", token: a.werkbank?.token || "" }); } catch (e: any) { this.wbTest = { ok: false, error: e.message }; } }}>
            ${this.wbTest?.testing ? html`<lm-spark size="16"></lm-spark>` : icon("retry", 16)} ${t("Testen")}</button>`)}
        ${a.werkbank?.url ? row(t("Werkbank entfernen"), t("Danach laufen keine Befehle mehr; alles andere funktioniert weiter."),
          html`<button class="btn danger" @click=${() => this.set("werkbank", { url: "", token: "" })}>${t("Entfernen")}</button>`) : nothing}`,
        { desc: t("Befehle auf der Werkbank fragen wie andere schreibende Aktionen nach einer Freigabe.") })}
      ${group(t("Was die Werkbank kann"), werkbankInfo(!!a.werkbank?.url && !!a.werkbank?.token, this.guide, () => (this.guide = !this.guide), true))}`;
  }

  // ================================================================ Benachrichtigungen
  private notifications() {
    const users = this.a.users;
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
    return html`
      ${group(t("Geräte und Personen"), devs.length ? html`<div class="tw"><table><tr><th>${t("Gerät")}</th><th>${t("Person")}</th><th>${t("Herkunft")}</th></tr>
        ${devs.map((d: any) => { const uid = ov[d.key] !== undefined ? ov[d.key] : (d.user_id || "");
          return html`<tr><td><b>${d.name}</b>${d.available ? nothing : html` <span class="chip">${t("nicht erreichbar")}</span>`}
              <div class="hint">${d.service || d.entity_id || t("kein Dienst")}</div></td>
            <td><select style="width:auto;padding:6px 8px" @change=${(e: any) => setOv(d.key, e.target.value)}>
              <option value="" ?selected=${!uid}>– ${t("keine Person")} –</option>
              ${users.map((u: any) => html`<option value=${u.id} ?selected=${uid === u.id}>${u.name}</option>`)}</select></td>
            <td class="hint">${ov[d.key] !== undefined ? html`${t("von dir zugeordnet")}${d.user_id && d.user_id !== ov[d.key] ? " " + t("(Home Assistant sagt: {name})", { name: users.find((u: any) => u.id === d.user_id)?.name || t("andere Person") }) : ""}`
              : d.user_id ? t("aus Home Assistant") : t("in Home Assistant keiner Person zugeordnet")}</td></tr>`; })}</table></div>`
        : empty("bell", t("Keine Geräte gefunden – die Home-Assistant-App muss auf dem Handy eingerichtet sein.")),
        { desc: t("Ein Handy gehört der Person, die die Home-Assistant-App darauf eingerichtet hat. Stimmt eine Zuordnung nicht, korrigierst du sie hier – die Korrektur überlebt neue Anmeldungen des Geräts.") })}
      ${group(t("Übersicht je Person"), html`${users.filter((u: any) => u.is_active).map((u: any) => row(u.name, byUser.get(u.id)?.join(", ") || t("kein Gerät"), nothing))}`,
        { desc: t("Hat eine Person mehrere Geräte, wählt sie selbst; hat sie nur eines, gilt das automatisch.") })}`;
  }

  // ================================================================ Weitere Dienste
  private services() {
    const a = this.a;
    return html`
      ${group(t("Websuche"), html`
        ${row(t("Suchdienst"), a.search.provider === "searxng" ? t("Eigene SearXNG-Instanz.") : t("DuckDuckGo funktioniert ohne Schlüssel über die einfache HTML-Seite und kann bei vielen Anfragen kurz sperren."),
          html`<select @change=${(e: any) => this.set("search", { ...a.search, provider: e.target.value })}>
            <option value="duckduckgo" ?selected=${a.search.provider !== "searxng"}>${t("DuckDuckGo (ohne Schlüssel)")}</option>
            <option value="searxng" ?selected=${a.search.provider === "searxng"}>${t("SearXNG (eigene Instanz)")}</option></select>`)}
        ${a.search.provider === "searxng" ? row(t("SearXNG-URL"), null, html`<input class="code" .value=${a.search.searxng_url || ""} @input=${(e: any) => this.set("search", { ...a.search, searxng_url: e.target.value })}>`) : nothing}`)}
      ${group(t("Sprachausgabe"), html`
        ${switchRow(t("Eigene Stimme des Roboters"), html`${t("Klingt auf jedem Gerät gleich. Dafür geht jeder vorgelesene Antworttext an den Vorlesedienst von Microsoft Edge (über das Paket edge-tts). Ausgeschaltet liest die Sprachausgabe von Home Assistant oder des Browsers vor – dann verlässt kein Antworttext Home Assistant für die Stimme.")}
            ${a.speech?.installed === false ? html`<br><span style="color:var(--lm-err)">${t("Das Paket edge-tts ist nicht installiert.")}</span>` : nothing}`,
          a.speech?.enabled !== false, (on) => this.set("speech", { ...(a.speech || {}), enabled: on }))}`)}
      ${group(t("Dashboards"), html`
        ${row(t("Modell-Läufe je Person und Tag"), t("So oft dürfen Kacheln mit Modell-Quelle je Person am Tag laufen (0 = ohne Grenze). Kacheln aus Home Assistant zählen nicht."),
          html`<input class="short" type="number" min="0" max="10000" .value=${String(a.dashboards?.tile_budget ?? 96)}
            @input=${(e: any) => this.set("dashboards", { ...a.dashboards, tile_budget: Number(e.target.value) })}>`)}
        ${row(t("Gleichzeitige Kachel-Läufe"), t("Eigene Warteschlange neben den geplanten Aufgaben. Mehr gleichzeitige Läufe teilen sich die Limits des Anbieters."),
          html`<select style="min-width:80px" @change=${(e: any) => this.set("dashboards", { ...a.dashboards, tile_parallel: Number(e.target.value) })}>
            ${[1, 2, 3].map(n => html`<option value=${n} ?selected=${(a.dashboards?.tile_parallel || 1) === n}>${n}</option>`)}</select>`)}`)}`;
  }

  // ================================================================ Rahmen
  private tabLink(id: string, text: string) {
    return html`<a href="#" @click=${(e: Event) => { e.preventDefault(); this.pick(id); }}>${text}</a>`;
  }
  private items(): NavItem[] {
    const a = this.a;
    const noAccess = !a.allowed_users.length;
    return [
      { id: "people", label: t("Personen"), icon: "mdi:account-group-outline", badge: noAccess ? "!" : null },
      { id: "providers", label: t("Anbieter & Schlüssel"), icon: "cloud" },
      { id: "models", label: t("Modelle"), icon: "sparkle" },
      { id: "costs", label: t("Externe Modelle & Kosten"), icon: "euro" },
      { id: "credentials", label: t("Zugänge & Konnektoren"), icon: "key", sep: true },
      { id: "skills", label: t("Skills"), icon: "skill" },
      { id: "werkbank", label: t("Werkbank"), icon: "mdi:console" },
      { id: "notifications", label: t("Benachrichtigungen"), icon: "bell" },
      { id: "services", label: t("Weitere Dienste"), icon: "mdi:application-cog-outline" },
      { id: "monitoring", label: t("Monitoring"), icon: "shield", sep: true },
    ];
  }
  private pick(id: string) {
    // Eingebettet (Seite „Kein Zugriff“) gibt es keine eigene Adresse – dort nur den Bereich wechseln.
    if (this.embedded) this.tab = id; else navigate(`/admin/${id}`);
    this.scrollTop = 0;
  }
  @property({ type: Boolean }) embedded = false;
  updated() { centerActiveNav(this.renderRoot); }
  render() {
    const a = this.a;
    if (!a) return html`<div class="sp"><lm-spark></lm-spark></div>`;
    const items = this.items();
    const active = items.find(i => i.id === this.tab)?.id || items[0].id;
    const meta: Record<string, [string, string, () => any]> = {
      people: [t("Personen"), t("Wer LLMitMir nutzen darf, wie viel und in welcher Ansicht."), () => this.people()],
      providers: [t("Anbieter & Schlüssel"), t("Woher die KI kommt und mit welchen Schlüsseln die Anfragen laufen."), () => this.providers()],
      models: [t("Modelle"), t("Welche Modelle freigegeben sind und welche LLMitMir standardmäßig nimmt."), () => this.models()],
      costs: [t("Externe Modelle & Kosten"), t("Kostenpflichtige Modelle: Preise, wer sie nutzen darf und wie viel."), () => this.costs()],
      credentials: [t("Zugänge & Konnektoren"), t("Wie Personen andere Systeme anbinden und was mit ihren Daten passieren darf."), () => this.credentials()],
      skills: [t("Skills"), t("Vorgaben für alle und Prüfregeln für eigene Skills."), () => this.skills()],
      werkbank: [t("Werkbank"), t("Ein abgeschotteter Rechner, auf dem die Modelle Programme ausführen."), () => this.werkbank()],
      notifications: [t("Benachrichtigungen"), t("Welches Handy zu welcher Person gehört."), () => this.notifications()],
      services: [t("Weitere Dienste"), t("Websuche, Sprachausgabe und Dashboards."), () => this.services()],
      monitoring: [t("Monitoring"), t("Welcher Agent mit welchem Zugang worauf zugegriffen hat – nur Metadaten (Werkzeug, Zugang, Server und Pfad, Entitäten, Modell, Ergebnis, wer freigegeben hat), nie Inhalte. Jeder Chat, jedes Cowork und jede Teilaufgabe ist ein eigener Agent; eine geplante Aufgabe oder Kachel ist über alle Läufe derselbe Agent."), () => html`<lm-monitoring embedded></lm-monitoring>`],
    };
    const [heading, lead, body] = meta[active];
    return settingsLayout({ title: t("Admin"), items, active, pick: (id) => this.pick(id), heading, lead, body: body(),
      dirty: this.dirty, save: () => this.save(), discard: () => this.load() });
  }
}
