// Persönliche Einstellungen (Ansicht, Modelle, Benachrichtigungen, Datenschutz, Verbrauch, Import aus Claude).
// Aufbau wie in den Claude-Einstellungen: links die Bereiche, rechts Gruppen mit Zeilen. Die Admin-Seite steht in admin.ts.
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, md, fmtNum, fmtTime, daysText, copyText, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t, tb, lang, LANGUAGES, resolveLang } from "./i18n";
import { claudeImportPrompt } from "./importprompt";
import "./plugins";
import { modelName } from "./modelpick";
import werkbankGuide from "../../docs/WERKBANK.md";
import werkbankGuideEn from "../../docs/WERKBANK.en.md";
import { taskUsageCard, taskUsageCss } from "./taskusage";
import { ensureConsent, externalCss, externalExplanation, fmtEur } from "./external";
import { settingsLayout, settingsCss, centerActiveNav, group, row, pad, switchRow, choices, cards, more, itemCard, type NavItem } from "./setui";

/** Gemeinsame Zusatzstile beider Einstellungsseiten (Diagramme, Tabellen, Prompt-Kasten). */
export const extraCss = css`
  .bars { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 10px; }
  .bars div { flex: 1; background: var(--lm-accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .85; transition: height .4s; }
  .bars div:hover { opacity: 1; }
  .meter { height: 8px; border-radius: 6px; background: var(--lm-hover); overflow: hidden; }
  .meter > div { height: 100%; background: var(--lm-accent); border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; } td, th { padding: 9px 8px; border-bottom: 1px solid var(--lm-line); text-align: left; vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
  th { font-weight: 600; color: var(--lm-muted); font-size: 12px; background: color-mix(in srgb, var(--lm-hover) 50%, transparent); }
  td:first-child, th:first-child { padding-left: 16px; } td:last-child, th:last-child { padding-right: 16px; }
  td input { padding: 6px 8px; } td input[type=checkbox] { width: auto; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .matrix td, .matrix th { text-align: center; } .matrix td:first-child, .matrix th:first-child { text-align: left; }
  .tw { overflow-x: auto; }
  .gb > .tw, .gb > .card { border-radius: 0; }
  .gb > .card { border: 0; }
  .gb > .card + .card { border-top: 1px solid var(--lm-line); }
  .prompt { font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; max-height: 260px; overflow-y: auto; background: var(--lm-side);
    border: 1px solid var(--lm-line); border-radius: 10px; padding: 12px; }
  .wbgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--lm-line); }
  .wbgrid > div { background: var(--lm-panel); padding: 14px 16px; }
  .wbgrid ul { margin: 6px 0 0; padding-left: 1.2em; } .wbgrid li { margin: 3px 0; font-size: 13.5px; }
  .wbgrid .no { color: var(--lm-muted); }
  .guide { max-height: 70vh; overflow-y: auto; padding: 4px 18px 14px; }
  .step { width: 26px; height: 26px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); font-weight: 650; font-size: 13px; flex: none; }
  .mbars { display: flex; align-items: flex-end; gap: 2px; height: 34px; min-width: 120px; }
  .mbars div { flex: 1; background: var(--lm-accent); border-radius: 2px 2px 0 0; min-height: 1px; opacity: .8; }
  .code { font-family: var(--lm-mono); font-size: 12.5px; }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  @container (max-width: 640px) { .wbgrid, .two { grid-template-columns: 1fr; } }`;

/** Was die Werkbank kann – persönlich als Erklärung, beim Admin mit den Einstellungen darunter. */
export function werkbankInfo(configured: boolean, showGuide: boolean, toggle: () => void, isAdmin: boolean) {
  return html`${row(html`${t("Status")} ${configured ? html`<span class="chip ok">${icon("check", 13)} ${t("eingerichtet")}</span>`
      : html`<span class="chip">${t("nicht eingerichtet")}</span>`}`,
    html`${t("Die Werkbank ist ein eigener kleiner Rechner (meist eine VM), auf dem die Modelle Programme ausführen dürfen – abgeschottet von Home Assistant, für jeden Chat in einer eigenen Sandbox. LLMitMir funktioniert auch ohne.")}
      ${!isAdmin && !configured ? t("Einrichten kann nur ein Admin von Home Assistant.") : ""}`, nothing)}
    <div class="wbgrid">
      <div><b style="font-size:13.5px">${icon("check", 15)} ${t("Ohne Werkbank geht")}</b><ul>
        <li>${t("Chatten, Coworks und geplante Aufgaben")}</li><li>${t("Web durchsuchen und Seiten abrufen")}</li>
        <li>${t("Home Assistant lesen und steuern")}</li><li>${t("Nextcloud-Dateien, -Kalender und -Kontakte")}</li><li>${t("PDFs, Scans und Fotos lesen")}</li></ul></div>
      <div><b style="font-size:13.5px">${icon("mdi:console", 15)} ${t("Nur mit Werkbank")}</b><ul>
        <li>${t("Python-Skripte und Befehle ausführen, auch Skripte aus Skills")}</li><li>${t("Auswerten und rechnen, Diagramme erzeugen")}</li>
        <li>${t("Excel-, Word-, PowerPoint- und PDF-Dateien erstellen")}</li><li>${t("Sprachnachrichten abschreiben (Whisper), Audio/Video umwandeln")}</li>
        <li>${t("Texterkennung (Tesseract) und Werkzeuge wie curl, git, jq")}</li></ul></div></div>
    ${row(t("Anleitung zur Einrichtung"), t("Schritt für Schritt: VM vorbereiten, Werkbank installieren, URL und Token eintragen."),
      html`<button class="btn" @click=${toggle}>${icon(showGuide ? "down" : "right", 16)} ${showGuide ? t("Ausblenden") : t("Anzeigen")}</button>`)}
    ${showGuide ? html`<div class="guide md fade-in">${md(lang() === "de" ? werkbankGuide : werkbankGuideEn, { breaks: false })}</div>` : nothing}`;
}

const link = (path: string, text: string) =>
  html`<a href="#" @click=${(e: Event) => { e.preventDefault(); navigate(path); }}>${text}</a>`;

@safeElement("lm-settings")
export class SettingsPage extends StoreElement {
  @property() tab = "";
  /** Unterbereich, z. B. der Reiter der Plugins (/settings/plugins/skills). */
  @property() sub = "";
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
  @state() private hostInput: Record<string, string> = {};   // Erlaubte Server: Eingabe je Zugang
  @state() private impBusy = "";
  static styles = [base, settingsCss, extraCss, taskUsageCss, externalCss];
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
    if (!["user", "own"].includes(store.data?.usage?.tasks?.mode || "")) delete payload.task_key_choice;
    if (store.data?.view?.locked) delete payload.view;
    delete payload.notify_service;  // replaced by the device choice
    payload.notify_device = this.deviceSel;
    try { await store.api.ws("settings/save", { settings: payload }); } catch (e: any) { store.notify(e.message); return; }
    const before = lang();
    this.dirty = false; store.notify(t("Gespeichert")); await store.load(); this.reset();
    // Neue Sprache: alles neu zeichnen – am sichersten mit einem Neuladen der Seite
    if (lang() !== before) { location.reload(); return; }
    store.api.ws("usage/history").then(r => (this.history = r));
  }
  private async newImport() {
    const r = await store.api.ws("import/token");
    const url = `${location.origin}${r.path}`;
    this.imp = { url, prompt: claudeImportPrompt(url), expires: r.expires };
  }
  private async uploadImport(e: any) {
    const files: File[] = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    const sum: any = { chats: 0, projects: 0, skills: 0, credentials: 0, tasks: 0, skipped: 0, files: [] as any[] };
    for (const [i, f] of files.entries()) {
      this.impBusy = t("{i}/{n}: {name} wird hochgeladen …", { i: i + 1, n: files.length, name: f.name });
      try {
        const r = await store.api.uploadImport(f, (d, total) => {
          this.impBusy = `${i + 1}/${files.length}: ${f.name} – ${Math.round((100 * d) / total)} %${d >= total ? ` · ${t("wird verarbeitet …")}` : ""}`; });
        for (const k of ["chats", "projects", "skills", "credentials", "tasks", "skipped"]) sum[k] += r[k] || 0;
        sum.files.push({ name: f.name, error: r.error && tb(r.error), info: r.info && tb(r.info), found: r.found });
      } catch (err: any) { sum.files.push({ name: f.name, error: err.message }); }
    }
    this.impBusy = ""; this.impResult = sum;
    await store.load(); store.notify(t("Import abgeschlossen"));
  }

  // ------------------------------------------------------------ Bereiche
  private items(): NavItem[] {
    const d = store.data; const simple = isSimple(); const e = d?.external || {};
    const tk = d?.usage?.tasks;
    const keys = d?.key_mode === "per_user_own" || (tk && tk.mode !== "same");
    const list: (NavItem | false)[] = [
      { id: "general", label: t("Allgemein"), icon: "settings" },
      (!simple || e.any_access || e.consent) && { id: "models", label: t("Modelle"), icon: "sparkle" },
      { id: "capabilities", label: t("Funktionen"), icon: "mdi:application-cog-outline" },
      { id: "plugins", label: t("Plugins"), icon: "plugins" },
      { id: "notifications", label: t("Benachrichtigungen"), icon: "bell" },
      { id: "privacy", label: t("Datenschutz & Freigaben"), icon: "mdi:shield-lock-outline" },
      { id: "usage", label: t("Verbrauch"), icon: "gauge", sep: true },
      !!keys && { id: "keys", label: t("API-Schlüssel"), icon: "key", badge: tk?.missing || (d?.key_mode === "per_user_own" && !d?.settings?.has_own_key) ? "!" : null },
      !simple && { id: "import", label: t("Import aus Claude"), icon: "import", sep: true },
    ];
    return list.filter(Boolean) as NavItem[];
  }
  updated() { centerActiveNav(this.renderRoot); }
  private pick(id: string) {
    navigate(`/settings/${id}`);
    this.scrollTop = 0;
  }

  /** Allgemein: Sprache, Ansicht, persönliche Hinweise, Bedienung. */
  private general() {
    const d = store.data; const s = this.s; const simple = isSimple();
    const v = d.view || {};
    const chosen = v.locked ? v.view : s.view || v.view || "simple";
    const langChoice = s.language || "auto";
    const autoName = LANGUAGES.find(l => l.code === resolveLang("auto", store.api.hass?.language))?.name || "";
    return html`
      ${group(t("Sprache"), row(t("Sprache der Oberfläche"),
          t("„Automatisch“ folgt der Sprache, die in deinem Profil in Home Assistant eingestellt ist. LLMitMir antwortet auch in dieser Sprache, solange du nicht in einer anderen schreibst."),
          html`<select @change=${(e: any) => this.set("language", e.target.value)}>
            <option value="auto" ?selected=${langChoice === "auto"}>${t("Automatisch ({name})", { name: autoName })}</option>
            ${LANGUAGES.map(l => html`<option value=${l.code} ?selected=${langChoice === l.code}>${l.name}</option>`)}</select>`),
        { desc: t("Wirkt nach dem Speichern – die Seite lädt dafür einmal neu.") })}
      ${group(t("Ansicht"), html`${cards("view", [
          { value: "simple", icon: "mdi:chat-processing-outline", label: t("Einfache Ansicht"), disabled: v.locked && chosen !== "simple",
            desc: t("Nur deine Nachricht und die Antwort – wie in einem Messenger. LLMitMir wählt die passende KI selbst und erklärt alles verständlich.") },
          { value: "expert", icon: "mdi:tune-variant", label: t("Expertenansicht"), disabled: v.locked && chosen !== "expert",
            desc: t("Alles selbst steuern: Modellwahl und Auslastung, Cowork mit Schrittliste, Werkzeug-Schritte, Gedanken der Modelle und alle Einstellungen.") },
        ], chosen, (k) => this.set("view", k))}
        ${pad(html`<div class="hint">${v.locked
          ? html`${icon("lock", 13)} ${d.user.is_admin ? html`${t("Die Ansicht hat ein Admin für dich festgelegt (unter")} ${link("/admin/people", t("Admin → Personen"))}).`
              : t("Die Ansicht hat der Admin für dich festgelegt.")}`
          : simple ? t("Wirkt nach dem Speichern sofort. Modelle, Werkbank und der Import aus Claude stehen in der Expertenansicht.")
          : t("Wirkt nach dem Speichern sofort. Du kannst jederzeit zurückwechseln.")}</div>`)}`,
        { desc: t("Wie viel LLMitMir dir zeigt.") })}
      ${group(t("Persönliche Hinweise"), row(t("Was soll LLMitMir immer über dich wissen?"),
          t("Vorlieben, Schreibstil, Zusammenhänge – fließt in jeden Chat, jedes Cowork und jede geplante Aufgabe ein."),
          html`<textarea rows="6" placeholder=${t("z. B.: Ich arbeite in der IT, antworte kurz und auf Deutsch, duze mich.")} .value=${this.memory}
            @input=${(e: any) => { this.memory = e.target.value; this.dirty = true; }}></textarea>`, { stack: true }))}
      ${group(t("Bedienung"), html`
        ${switchRow(t("Mit Enter senden"), t("Umschalt+Enter macht eine neue Zeile. Auf Touch-Geräten ist Enter immer ein Zeilenumbruch."),
          s.send_on_enter !== false, (on) => this.set("send_on_enter", on))}
        ${simple ? nothing : switchRow(t("Gedanken der Modelle anzeigen"), t("Zeigt, wie das Modell überlegt, bevor es antwortet (eingeklappt)."),
          s.show_reasoning !== false, (on) => this.set("show_reasoning", on))}`)}`;
  }

  private vorgabe(role: "chat" | "agent" | "sub") {
    const b = store.data.defaults.base?.[role] || {};
    return b.auto ? t("Automatisch (derzeit {m})", { m: modelName(b.model) }) : t("Vorgabe ({m})", { m: modelName(b.model) });
  }
  /** Modelle: Standardmodelle je Rolle, externe Modelle (Zustimmung). */
  private models() {
    const d = store.data; const s = this.s; const simple = isSimple();
    const internal = d.models.filter((m: any) => !m.external);
    const sel = (key: string, role: "chat" | "agent" | "sub") => html`<select @change=${(e: any) => this.set(key, e.target.value || null)}>
      <option value="">${this.vorgabe(role)}</option>${internal.map((m: any) => html`<option value=${m.id} ?selected=${s[key] === m.id}>${m.name}</option>`)}</select>`;
    return html`
      ${simple ? nothing : group(t("Standardmodelle"), html`
        ${row(t("Chats"), t("Für normale Unterhaltungen."), sel("model_chat", "chat"))}
        ${row(t("Coworks und geplante Aufgaben"), t("Für längere Arbeit mit Werkzeugen."), sel("model_agent", "agent"))}
        ${row(t("Teilaufgaben"), t("Sparsames Modell für abgezweigte Teilarbeit."), sel("model_sub", "sub"))}
        ${pad(more(t("„Automatisch“ heißt: LLMitMir nimmt das passendste Modell, das gerade nicht überlastet ist, und berücksichtigt neu erschienene Modelle von selbst. Mit einem festen Modell empfiehlt der Chat einen Wechsel, wenn es stark ausgelastet ist.")))}`,
        { desc: t("Welche KI ein neuer Chat nimmt. Im Chat kannst du jederzeit wechseln.") })}
      ${this.externalGroup()}`;
  }
  private externalGroup() {
    const e = store.data?.external || {};
    if (!e.any_access && !e.consent) return nothing;
    return group(e.has_access ? t("Externe Modelle (auch kostenpflichtig)") : t("Externe Modelle"), html`
      ${row(t("Zustimmung"), e.consent ? t("Du hast zugestimmt. Nimmst du sie zurück, sind externe Modelle für dich gesperrt und Aufgaben weichen nicht mehr aus.")
          : t("Bevor du ein externes Modell nutzen kannst, musst du lesen, was dabei mit deinen Daten passiert, und zustimmen."),
        e.consent ? html`<span class="chip ok">${icon("check", 13)} ${t("zugestimmt")}</span>
            <button class="btn ghost" @click=${async () => { await store.api.ws("external/consent", { accept: false }); await store.load(); store.notify(t("Zustimmung zurückgenommen")); }}>${t("Zurücknehmen")}</button>`
          : html`<button class="btn primary" @click=${async () => { if (await ensureConsent()) store.notify(t("Zugestimmt")); }}>${t("Lesen und zustimmen …")}</button>`)}
      ${e.has_access ? row(t("Kosten diesen Monat"), html`${t("{a} von {b} – Verlauf unter", { a: fmtEur(e.month_eur || 0), b: fmtEur(e.limit_eur || 0) })} ${link("/settings/usage", t("Verbrauch"))}.`,
        html`<div class="meter" style="width:180px"><div style="width:${Math.min(100, Math.round(100 * (e.month_eur || 0) / (e.limit_eur || 1)))}%"></div></div>`) : nothing}
      ${pad(more(externalExplanation(), t("Was ist bei externen Modellen anders?")))}`,
      { desc: t("Modelle, die nicht im Rechenzentrum des Hauptanbieters laufen. LLMitMir nimmt sie nie von selbst.") });
  }

  /** Funktionen: Teilaufgaben, Werkbank. */
  private capabilities() {
    const s = this.s;
    const cur = s.sub_mode || s.sub_mode_effective || "auto";
    return html`
      ${group(t("Teilaufgaben"), html`${choices("submode", [
          { value: "auto", label: t("Automatisch"), desc: t("LLMitMir teilt größere Aufgaben selbst in Teilaufgaben auf – mehrere unabhängige Teile, viel Lesematerial, lange Werkbank-Arbeit. Der Chat bleibt dadurch kurz und übersichtlich.") },
          { value: "ask", label: t("Nur auf Wunsch"), desc: t("Teilaufgaben nur, wenn du ausdrücklich darum bittest (z. B. „als Teilaufgabe“ oder „parallel“).") },
          { value: "off", label: t("Aus"), desc: t("Keine Teilaufgaben – alles läuft im Chat selbst. Von Hand abzweigen geht weiterhin.") },
        ], cur, (k) => this.set("sub_mode", k))}`,
        { desc: t("Teilaufgaben arbeiten mit eigenem Kontext und melden nur eine Zusammenfassung zurück. Fragen, die du freigeben musst, erscheinen auch im Hauptchat.") })}
      ${isSimple() ? nothing : group(t("Werkbank"), html`${werkbankInfo(!!store.data.werkbank?.configured, this.guide, () => (this.guide = !this.guide), store.data.user.is_admin)}
        ${store.data.user.is_admin ? pad(html`<div class="hint">${t("URL und Token trägst du hier ein:")} ${link("/admin/werkbank", t("Admin → Werkbank"))}</div>`) : nothing}`,
        { desc: t("Programme ausführen, rechnen und Dateien erstellen – in einer abgeschotteten Sandbox.") })}`;
  }

  /** Benachrichtigungen: Push-Gerät, Freigabe-Meldung, Karten auf der Startseite. */
  private notifications() {
    const d = store.data; const s = this.s;
    const adminLink = d.user.is_admin ? html` ${t("Zuordnen kannst du unter")} ${link("/admin/notifications", t("Admin → Benachrichtigungen"))}.` : "";
    const device = !this.devicesLoaded ? html`<span class="hint">${t("Laden …")}</span>`
      : this.devices.length ? html`<select @change=${(e: any) => { this.deviceSel = e.target.value; this.dirty = true; }}>
          ${this.devices.length > 1 ? html`<option value="" ?selected=${!this.deviceSel}>${t("bitte wählen")}</option>` : nothing}
          ${this.devices.map((x: any) => html`<option value=${x.key} ?selected=${this.deviceSel === x.key}>${x.name}${x.available ? "" : ` (${t("nicht erreichbar")})`}</option>`)}</select>`
      : html`<span class="chip">${t("kein Gerät")}</span>`;
    const mode = s.inbox_mode || "auto";
    const mins = Number(s.inbox_minutes ?? 30);
    const muted: string[] = s.inbox_muted || [];
    const chats = d.chats || [];
    const nameOf = (id: string) => chats.find((c: any) => c.id === id)?.title || id;
    const modes: [string, string, string][] = [
      ["auto", t("Automatisch"), t("An, solange kein Push-Gerät gewählt ist – so bekommst du die Ergebnisse geplanter Aufgaben auf jeden Fall mit.")],
      ["on", t("Immer an"), t("Auch wenn Push-Nachrichten ankommen: die Ergebnisse stehen zusätzlich auf der Startseite.")],
      ["off", t("Aus"), t("Keine Benachrichtigungen auf der Startseite.")]];
    const durs: [number, string][] = [[0, t("Bis ich sie entferne")], [5, t("{n} Minuten", { n: 5 })], [15, t("{n} Minuten", { n: 15 })], [30, t("{n} Minuten", { n: 30 })],
      [60, t("1 Stunde")], [180, t("{n} Stunden", { n: 3 })], [720, t("{n} Stunden", { n: 12 })], [1440, t("{n} Tag", { n: 1 })]];
    return html`
      ${group(t("Push-Nachrichten aufs Handy"), html`
        ${row(t("Gerät"), this.devices.length ? html`${t("Für Ergebnisse geplanter Aufgaben und das Werkzeug „Benachrichtigen“. Zur Auswahl stehen nur Geräte, die in Home Assistant mit deinem Benutzer verknüpft sind.")}${adminLink}`
            : html`${t("Deinem Benutzer ist in Home Assistant noch kein Gerät zugeordnet.")}${d.user.is_admin ? adminLink : " " + t("Ein Admin von Home Assistant kann dein Handy mit deinem Benutzer verknüpfen.")}`, device)}
        ${switchRow(t("Melden, wenn eine Freigabe wartet"), t("Kommt auch bei offenem Panel – ein offenes Panel heißt nicht, dass du hinsiehst. Die Meldung nennt den Chat und bei einem Befehl dessen erste Zeilen."),
          s.permission_push !== false, (on) => this.set("permission_push", on))}`)}
      ${group(t("Auf der Startseite"), html`
        ${row(t("Anzeige"), modes.find(([v]) => v === mode)?.[2] || "", html`<select @change=${(e: any) => this.set("inbox_mode", e.target.value)}>
          ${modes.map(([v, l]) => html`<option value=${v} ?selected=${mode === v}>${l}</option>`)}</select>`)}
        ${mode === "off" ? nothing : row(t("Anzeigedauer"), t("Danach verschwindet die Karte von selbst."), html`<select @change=${(e: any) => this.set("inbox_minutes", Number(e.target.value))}>
          ${durs.map(([v, l]) => html`<option value=${v} ?selected=${mins === v}>${l}</option>`)}
          ${durs.some(([v]) => v === mins) ? nothing : html`<option value=${mins} selected>${t("{n} Minuten", { n: mins })}</option>`}</select>`)}
        ${muted.map((id) => row(html`${icon("bellOff", 15)} ${nameOf(id)}`, t("stumm geschaltet"),
          html`<button class="btn ghost" @click=${() => this.set("inbox_muted", muted.filter((x) => x !== id))}>${icon("bell", 15)} ${t("wieder an")}</button>`))}`,
        { desc: t("Ergebnisse geplanter Aufgaben als Karten – kurz tippen öffnet den Chat, lange drücken schaltet ihn stumm, „×“ oder Wischen entfernt die Karte.") })}`;
  }

  /** Erlaubte Server eines Zugangs ändern (eigener Befehl – der Rest des Zugangs bleibt, wie er ist). */
  private async setHosts(c: any, hosts: string[]) {
    try { await store.api.ws("credential/hosts", { credential_id: c.id, hosts }); await store.load(); store.notify(t("Gespeichert")); }
    catch (e: any) { store.notify(e.message); }
  }
  /** Datenschutz & Freigaben: Lebensdauer, Freigaben, erlaubte Server. */
  private privacy() {
    const d = store.data; const s = this.s;
    const rdays = Number(s.retention_days ?? d.retention?.default ?? 0) || 0;
    const perms = Object.entries(s.permissions || {});
    const creds = (d.credentials || []).filter((c: any) => c.type !== "gwdg");
    const types = d.credential_types || {};
    const permLabel: Record<string, string> = { allow: t("Dauerhaft erlaubt (ohne Projekt)"), deny: t("Dauerhaft verboten (ohne Projekt)"), ask: t("Dauerhaft fragen (ohne Projekt)") };
    return html`
      ${group(t("Lebensdauer von Chats und Coworks"), html`
        ${switchRow(t("Automatisch löschen"), t("Gilt für Chats und Coworks außerhalb von Projekten. Angeheftete Chats und Läufe geplanter Aufgaben bleiben; in Projekten gilt deren Frist."),
          rdays > 0, (on) => this.set("retention_days", on ? (d.retention?.suggest || 30) : 0))}
        ${rdays > 0 ? row(t("Löschen nach"), t("Derzeit {d} ab der letzten Benutzung – samt Anhängen, Arbeitsbereich und Sandbox. Geprüft wird stündlich.", { d: daysText(rdays) }),
          html`<input class="short" type="number" min="1" max=${d.retention?.max || 3650} .value=${String(rdays)}
            @change=${(e: any) => this.set("retention_days", Math.max(1, Number(e.target.value) || 1))}> <span class="hint">${t("Tagen")}</span>`) : nothing}`,
        { desc: rdays > 0 ? undefined : t("Aus – Chats und Coworks bleiben, bis du sie selbst löschst.") })}
      ${group(t("Freigaben"), html`
        ${row(t("Wenn niemand antwortet"), t("Was passiert, wenn eine Freigabe im Chat oder Cowork offen bleibt. „Ohne die Aktion weitermachen“: LLMitMir lässt sie aus, erledigt den Rest und nennt, was fehlt."),
          html`<select @change=${(e: any) => this.set("permission_timeout_min", Number(e.target.value))}>
            ${[[0, t("Nach 1 Stunde ablehnen")], [5, t("Nach {n} Min. ohne sie weiter", { n: 5 })], [15, t("Nach {n} Min. ohne sie weiter", { n: 15 })], [60, t("Nach 1 Stunde ohne sie weiter")]]
              .map(([v, l]) => html`<option value=${v} ?selected=${Number(s.permission_timeout_min || 0) === v}>${l}</option>`)}</select>`)}
        ${perms.length ? perms.map(([n, v]) => row(tb(d.tools[n]?.label) || n, permLabel[v as string] || String(v),
          html`<button class="btn ghost" @click=${() => { const p = { ...s.permissions }; delete p[n]; this.set("permissions", p); }}>${t("Zurücksetzen")}</button>`))
          : row(t("Dauerhafte Freigaben"), t("Noch keine – „Immer erlauben“ in einem Chat legt hier einen Eintrag an."), nothing)}`,
        { desc: t("In geplanten Aufgaben entscheiden die Freigaben der Aufgabe.") })}
      ${creds.length ? group(t("Erlaubte Server"), creds.map((c: any) => {
          const auto: string[] = c.auto_hosts || [];
          const extra: string[] = c.hosts || [];
          const val = this.hostInput[c.id] || "";
          const add = () => {
            const h = val.trim(); if (!h) return;
            this.hostInput = { ...this.hostInput, [c.id]: "" };
            this.setHosts(c, [...extra, ...h.split(/[\s,;]+/).filter(Boolean)]);
          };
          return itemCard(html`${icon("key", 16)}<b class="grow">${link(`/credential/${c.id}`, c.name)}</b><span class="hint">${tb(types[c.type]?.label) || c.type}</span>`, html`
            <div class="row" style="flex-wrap:wrap;gap:6px">
              ${auto.map(h => html`<span class="chip" title=${t("Aus der Adresse des Zugangs – gilt immer")}>${h} · ${t("automatisch")}</span>`)}
              ${extra.map(h => html`<span class="chip">${h}<button class="iconbtn" style="width:22px;height:22px" title=${t("Entfernen")}
                @click=${() => this.setHosts(c, extra.filter(x => x !== h))}>${icon("close", 14)}</button></span>`)}
              ${!auto.length && !extra.length ? html`<span class="hint">${t("Noch kein Server – der erste Aufruf fragt nach.")}</span>` : nothing}</div>
            <div class="row"><input placeholder="api.example.org, *.example.org" .value=${val}
                @input=${(e: any) => { this.hostInput = { ...this.hostInput, [c.id]: e.target.value }; }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") add(); }}>
              <button class="btn" ?disabled=${!val.trim()} @click=${add}>${icon("plus", 15)} ${t("Erlauben")}</button></div>`);
        }), { desc: t("Zugangsdaten gehen nur an diese Server. Für jeden anderen fragt LLMitMir vorher, geplante Aufgaben lehnen ab. Ein Server gilt nur für den Zugang, bei dem er steht."),
          aside: html`<span class="hint">${t("wird sofort gespeichert")}</span>` }) : nothing}`;
  }

  /** Verbrauch: heute, Verlauf, geplante Aufgaben, Kosten externer Modelle. */
  private usage() {
    const d = store.data; const u = d.usage;
    const days = this.history ? Object.entries(this.history.days).sort(([a], [b]) => a.localeCompare(b)).slice(-30) : [];
    const max = Math.max(1, ...days.map(([, v]: any) => v.prompt + v.completion));
    const tok = (x: any) => (x?.prompt || 0) + (x?.completion || 0);
    const e = d.external || {};
    const months: any[] = this.history?.external?.months || [];
    const mmax = Math.max(0.01, ...months.map(m => m.eur));
    const names = this.history?.external?.names || {};
    const cur = months[months.length - 1];
    return html`
      ${group(t("Anfragen und Tokens"), html`
        <div class="kv">
          <div><span class="hint">${t("Heute")}</span><b>${u.today.requests}</b><span class="hint">${t("Anfragen")} · ${fmtNum(tok(u.today))} ${t("Tokens")}</span></div>
          ${u.week ? html`<div><span class="hint">${t("Diese Woche")}</span><b>${u.week.requests}</b><span class="hint">${t("Anfragen")} · ${fmtNum(tok(u.week))} ${t("Tokens")}</span></div>` : nothing}
          ${u.month ? html`<div><span class="hint">${t("Diesen Monat")}</span><b>${u.month.requests}</b><span class="hint">${t("Anfragen")} · ${fmtNum(tok(u.month))} ${t("Tokens")}</span></div>` : nothing}
          ${u.quota.requests_day || u.quota.tokens_day ? html`<div><span class="hint">${t("Dein Tageskontingent")}</span>
            <b>${u.quota.requests_day ? u.quota.requests_day : fmtNum(u.quota.tokens_day)}</b>
            <span class="hint">${u.quota.requests_day ? t("Anfragen") : t("Tokens")}${u.quota.requests_day && u.quota.tokens_day ? ` · ${fmtNum(u.quota.tokens_day)} ${t("Tokens")}` : ""}</span></div>` : nothing}</div>
        ${u.today.task_requests ? pad(html`<div class="hint">${t("Davon heute geplante Aufgaben: {r} Anfragen · {n} Tokens", { r: u.today.task_requests, n: fmtNum((u.today.task_prompt || 0) + (u.today.task_completion || 0)) })}</div>`) : nothing}
        ${days.length ? pad(html`<div class="bars">${days.map(([day, v]: any) => html`<div title=${t("{day}: {r} Anfragen, {n} Tokens", { day, r: v.requests, n: fmtNum(v.prompt + v.completion) })}
            style="height:${Math.max(2, ((v.prompt + v.completion) / max) * 110)}px"></div>`)}</div><div class="hint">${t("Tokens je Tag, letzte {n} Tage", { n: days.length })}</div>`) : nothing}`)}
      ${d.tasks?.length && !isSimple() ? group(t("Geplante Aufgaben"), taskUsageCard(u.tasks, this.history?.task_key_days)) : nothing}
      ${e.has_access || months.some(m => m.eur > 0) ? group(t("Kosten externer Modelle"), html`
        ${row(t("Diesen Monat"), cur && Object.keys(cur.models || {}).length
            ? Object.entries(cur.models).map(([k, v]: any) => `${names[k] || k}: ${fmtEur(v.eur)} (${v.requests} ${t("Anfragen")})`).join(" · ") : t("Das Limit legt der Admin fest; am Monatsersten beginnt es neu."),
          html`<b>${fmtEur(e.month_eur || 0)}</b><span class="hint">${t("von {x}", { x: fmtEur(e.limit_eur || 0) })}</span>`)}
        ${months.some(m => m.eur > 0) ? pad(html`<div class="bars" style="height:80px">${months.map(m => html`<div title="${m.month}: ${fmtEur(m.eur)} · ${m.requests} ${t("Anfragen")}" style="height:${Math.max(2, (m.eur / mmax) * 74)}px"></div>`)}</div>
          <div class="hint">${t("Kosten je Monat, letzte 12 Monate")}</div>`) : nothing}`) : nothing}`;
  }

  /** API-Schlüssel: eigener Schlüssel, Schlüssel für geplante Aufgaben. */
  private keys() {
    const d = store.data; const s = this.s; const tk = d.usage?.tasks;
    const own = d.key_mode === "per_user_own" ? group(t("Dein API-Schlüssel"), row(t("Schlüssel für {p}", { p: d.provider.name }),
      t("Gilt nur für dich. Limits und Verbrauch beziehen sich auf ihn."),
      html`<input type="password" autocomplete="off" placeholder=${s.has_own_key ? t("••• gespeichert – zum Ändern neu eingeben") : t("Schlüssel eintragen")}
        @input=${(e: any) => this.set("own_key", e.target.value)}>`)) : nothing;
    let task: any = nothing;
    if (tk && tk.mode === "shared") {
      task = group(t("Schlüssel für geplante Aufgaben"), pad(html`<div class="hint">${tk.has_central
        ? t("Deine geplanten Aufgaben laufen über den zentralen Aufgaben-Schlüssel, den der Admin eingetragen hat. Chats und Coworks behalten so ihr volles Kontingent.")
        : t("Der Admin hat einen zentralen Aufgaben-Schlüssel vorgesehen, aber noch nicht eingetragen – bis dahin laufen Aufgaben über den normalen Schlüssel.")}</div>`));
    } else if (tk && tk.mode !== "same") {
      const allowed: string[] = tk.allowed || ["same", "own"];
      const choice = allowed.includes(s.task_key_choice) ? s.task_key_choice : (allowed.includes("same") ? "same" : "own");
      task = group(t("Schlüssel für geplante Aufgaben"), html`
        ${tk.mode === "own" ? pad(html`<div class="hint">${icon("lock", 13)} ${t("Der Admin lässt geplante Aufgaben nur mit eigenen Schlüsseln laufen – ein zentraler oder gemeinsamer Schlüssel ist dafür nicht zugelassen.")}</div>`) : nothing}
        ${choices("tkc", [
          { value: "same", label: t("Ein Schlüssel für alles"), desc: t("Aufgaben, Chats und Coworks nutzen denselben Schlüssel und teilen sich dessen Limits."), disabled: !allowed.includes("same") },
          { value: "own", label: t("Eigener Schlüssel für Aufgaben"), desc: t("Aufgaben verbrauchen nichts vom Kontingent für spontane Chats und Coworks."), disabled: !allowed.includes("own") },
          { value: "shared", label: t("Zentraler Aufgaben-Schlüssel"), disabled: !allowed.includes("shared"),
            desc: tk.has_central ? t("Vom Admin eingetragen; alle, die ihn wählen, teilen sich seine Limits.") : t("Nicht verfügbar – der Admin hat keinen zentralen Aufgaben-Schlüssel eingetragen.") },
        ], choice, (k) => this.set("task_key_choice", k))}
        ${choice === "own" ? row(t("Schlüssel für geplante Aufgaben ({p})", { p: d.provider.name }), null,
          html`<input type="password" autocomplete="off" placeholder=${s.has_own_task_key ? t("••• gespeichert – zum Ändern neu eingeben") : t("Schlüssel eintragen")}
            @input=${(e: any) => this.set("own_task_key", e.target.value)}>`) : nothing}`,
        { desc: t("Gilt für alle Läufe geplanter Aufgaben, auch „Jetzt ausführen“. Läufe auf einem eigenen oder zentralen Aufgaben-Schlüssel zählen nicht zum persönlichen Tageskontingent.") });
    }
    return html`${own}${task}`;
  }

  /** Import aus Claude: Einmal-Link mit Prompt, Upload des Datenexports. */
  private import() {
    const r = this.impResult;
    return html`
      ${group(t("Skills, Zugänge, Aufgaben, Projekte und Erinnerungen"), html`
        ${row(html`<span class="step">1</span> ${t("Prompt für Claude erzeugen")}`, t("Ein Einmal-Link, 24 Stunden gültig. Füge den Prompt in Claude ein – am besten Claude Code oder ein Cowork mit Werkzeugen."),
          this.imp ? nothing : html`<button class="btn primary" @click=${this.newImport}>${icon("plus", 16)} ${t("Erzeugen")}</button>`)}
        ${this.imp ? pad(html`<div class="prompt">${this.imp.prompt}</div>
          <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn primary" @click=${() => copyText(this.imp.prompt)}>${icon("copy", 16)} ${t("Prompt kopieren")}</button>
            <span class="hint">${t("Link gültig bis {x}", { x: fmtTime(this.imp.expires) })}</span></div>`) : nothing}
        ${row(html`<span class="step">2</span> ${t("Claude schickt alles hierher")}`, html`${t("Claude löst Zugangsdaten aus den Skills heraus und überträgt alles direkt. Importierte Aufgaben sind zunächst pausiert.")}
          ${t("Claude muss dafür {host} erreichen – sonst liefert es eine Datei llmitmir-import.json, die du unten hochlädst.", { host: location.host })}`, nothing)}`,
        { desc: t("Claude sammelt deine Einrichtung zusammen und überträgt sie.") })}
      ${group(t("Chatverläufe"), html`
        ${row(t("Datenexport von claude.ai hochladen"), html`${t("In claude.ai unter Einstellungen → Datenschutz → „Daten exportieren“.")} ${t("Wähle alle ZIP-Dateien des Exports auf einmal aus (z. B. conversations-000.zip, projects-000.zip) – die Manifest-Datei brauchst du nicht.")}
            ${t("Auch llmitmir-import.json geht hier.")}`,
          html`<label class="btn" ?disabled=${!!this.impBusy}>${this.impBusy ? html`<lm-spark size="16"></lm-spark>` : icon("upload", 16)} ${t("Dateien wählen")}
            <input type="file" multiple accept=".zip,.json" hidden @change=${this.uploadImport}></label>`)}
        ${this.impBusy ? pad(html`<div class="hint">${this.impBusy}</div>`) : nothing}
        ${r ? pad(html`<b>${t("Übernommen")}:</b> ${t("{c} Chats, {p} Projekte, {s} Skills, {k} Zugänge, {a} Aufgaben", { c: r.chats, p: r.projects, s: r.skills, k: r.credentials, a: r.tasks })}${r.skipped ? ` · ${t("{n} schon vorhanden (übersprungen)", { n: r.skipped })}` : ""}
          <ul style="margin:8px 0 0;padding-left:1.2em;font-size:13.5px">${r.files.map((f: any) => html`<li>${f.name}: ${f.error ? html`<span style="color:var(--lm-err)">${f.error}</span>`
            : f.info || (f.found?.length ? f.found.join(", ") : "ok")}</li>`)}</ul>`) : nothing}
        ${pad(html`<div class="hint">${t("Mehrfaches Hochladen legt nichts doppelt an.")}</div>`)}`,
        { desc: t("Chats, Projekte und Erinnerungen aus deinem claude.ai-Konto.") })}`;
  }

  render() {
    if (!store.data) return nothing;
    const items = this.items();
    const active = items.find(i => i.id === this.tab)?.id || items[0].id;
    const meta: Record<string, [string, string, () => any]> = {
      general: [t("Allgemein"), t("Sprache, Ansicht, Hinweise über dich und wie du LLMitMir bedienst."), () => this.general()],
      models: [t("Modelle"), t("Welche KI LLMitMir für dich nimmt."), () => this.models()],
      capabilities: [t("Funktionen"), t("Was LLMitMir zusätzlich kann und wie es größere Aufgaben angeht."), () => this.capabilities()],
      plugins: [t("Plugins"), t("Konnektoren, Skills und Zugänge. Was zu einem Konnektor gehört, bearbeitest du über den Konnektor."),
        () => html`<lm-plugins embedded .tab=${this.sub}></lm-plugins>`],
      notifications: [t("Benachrichtigungen"), t("Wie du erfährst, dass etwas fertig ist oder auf dich wartet."), () => this.notifications()],
      privacy: [t("Datenschutz & Freigaben"), t("Wie lange Chats bleiben, was LLMitMir ohne Rückfrage darf und wohin Zugangsdaten gehen."), () => this.privacy()],
      usage: [t("Verbrauch"), t("Wie viel du LLMitMir nutzt."), () => this.usage()],
      keys: [t("API-Schlüssel"), t("Mit welchem Schlüssel deine Anfragen an den KI-Anbieter gehen."), () => this.keys()],
      import: [t("Import aus Claude"), t("Umzug von Claude: Einrichtung und Chatverläufe übernehmen."), () => this.import()],
    };
    const [heading, lead, body] = meta[active];
    return settingsLayout({ title: t("Einstellungen"), items, active, pick: (id) => this.pick(id), heading, lead, body: body(),
      dirty: this.dirty, save: () => this.save(), discard: () => this.reset() });
  }
}

export { navigate };
