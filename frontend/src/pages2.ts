// Scheduled tasks, skills and credentials.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, md, fmtTime, fmtDuration, confirmDialog, copyText, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { defaultLabel } from "./modelpick";
import { taskUsageCard, taskUsageCss } from "./taskusage";
import { explainer, explainerCss, more } from "./simple";
import { ensureConsent, ext, fmtEur, isExternal, priceText } from "./external";

const pageCss = css`:host { display: block; height: 100%; overflow-y: auto; }
  ${explainerCss}
  .form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .banner { display: flex; gap: 10px; align-items: flex-start; background: var(--lm-accent-soft); color: var(--lm-text); border-radius: 12px;
    padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin-bottom: 16px; }
  .banner .i { color: var(--lm-accent); margin-top: 1px; }
  .switch { position: relative; width: 40px; height: 24px; flex: none; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch span { position: absolute; inset: 0; background: var(--lm-line); border-radius: 999px; transition: .2s; cursor: pointer; }
  .switch span::after { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .switch input:checked + span { background: var(--lm-accent); } .switch input:checked + span::after { transform: translateX(16px); }
  .days { display: flex; gap: 4px; flex-wrap: wrap; } .days button { width: 40px; height: 36px; border-radius: 9px; border: 1px solid var(--lm-line); background: var(--lm-panel); cursor: pointer; }
  .days button.on { background: var(--lm-accent); color: var(--lm-on-accent); border-color: var(--lm-accent); }
  .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
  .checks label { display: flex; gap: 8px; align-items: center; font-size: 13.5px; padding: 6px 8px; border: 1px solid var(--lm-line); border-radius: 9px; cursor: pointer; background: var(--lm-panel); }
  .checks input { width: auto; }
  .tabs { display: flex; gap: 4px; } .tabs button { border: 0; background: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; color: var(--lm-muted); }
  .tabs button.on { background: var(--lm-hover); color: var(--lm-text); }
  .st-narrow { display: none; margin-top: 6px; }
  @media (max-width: 640px) { .st-wide { display: none; } .st-narrow { display: block; } }
  .preview { border: 1px solid var(--lm-line); border-radius: 10px; padding: 14px; background: var(--lm-panel); min-height: 200px; }
  /* Zugang, dessen letzte Pruefung fehlgeschlagen ist: sofort ins Auge fallend */
  .item.cred.bad { border-color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel)); }
  .item.cred.bad > .i { color: var(--lm-err); }
  .item.cred.bad:hover { border-color: var(--lm-err); }
  /* Aufgabe, deren Lauf an der Hoechstzahl an Schritten gescheitert ist: rot, bis sie freigegeben wird */
  .item.task.bad { border-color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel)); }
  .item.task.bad > .i { color: var(--lm-err); }
  .item.task.bad:hover { border-color: var(--lm-err); }
  .cred-err { color: var(--lm-err); font-size: 12.5px; line-height: 1.4; overflow-wrap: anywhere; }
  .checkbox { display: flex; gap: 10px; align-items: flex-start; border-radius: 12px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5; }
  .checkbox.ok { background: rgba(63,143,91,.10); }
  .checkbox.err { background: rgba(194,69,59,.10); border: 1px solid var(--lm-err); }
  .checkbox .i { flex: none; margin-top: 1px; }
  .checkbox.ok .i { color: var(--lm-ok); } .checkbox.err .i { color: var(--lm-err); }
  @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }`;

const switchEl = (checked: boolean, onChange: (v: boolean) => void) =>
  html`<label class="switch" @click=${(e: Event) => e.stopPropagation()}><input type="checkbox" .checked=${checked} @change=${(e: any) => onChange(e.target.checked)}><span></span></label>`;

// ---------------------------------------------------------------- tasks
/** Aufgaben, deren Lauf an der Hoechstzahl an Schritten gescheitert ist und die noch nicht freigegeben sind. */
const limitHit = (tasks: any[]) => (tasks || []).filter((x: any) => x.limit_hit && !x.heavy);

@safeElement("lm-tasks")
export class Tasks extends StoreElement {
  static styles = [base, pageCss, taskUsageCss];
  @state() private keyDays: any[] | null = null;
  connectedCallback() {
    super.connectedCallback();
    store.api.ws("usage/history").then(r => (this.keyDays = r.task_key_days || [])).catch(() => {});
  }
  private status(task: any) {
    const q = store.data?.queue || {};
    if (q.running === task.id) return html`<span class="chip accent"><lm-spark size="14"></lm-spark> läuft</span>`;
    if (q.position?.[task.id]) return html`<span class="chip warn">${icon("wait", 13)} wartet (Platz ${q.position[task.id]})</span>`;
    const l = task.last_run;
    if (!l) return html`<span class="chip">noch nie gelaufen</span>`;
    if (l.status === "running") return html`<span class="chip accent">läuft</span>`;
    return l.status === "done" ? html`<span class="chip ok">${icon("check", 13)} ${fmtTime(l.finished)}</span>` : html`<span class="chip err">${icon("alert", 13)} ${fmtTime(l.finished)}</span>`;
  }
  /** History from the server with today's bar kept current by live usage events. */
  private liveDays() {
    const days = this.keyDays; const today = store.data?.usage?.tasks?.key_today;
    if (!days?.length || !today) return days;
    return [...days.slice(0, -1), { ...days[days.length - 1], ...today }];
  }
  render() {
    const tasks = store.data?.tasks || [];
    return html`<div class="page"><div class="row"><h1 class="grow">${isSimple() ? t("Geplante Aufgaben") : t("Geplant")}</h1>
      <button class="btn primary" @click=${() => navigate("/task/new")}>${icon("plus", 18)} ${t("Neue Aufgabe")}</button></div>
      ${isSimple() ? explainer("tasks", !tasks.length) : html`
      <div class="banner">${icon("hourglass")}<div><b>Geplante Aufgaben laufen mit Open-Weight-Modellen.</b> Sie starten in einer gemeinsamen Warteschlange und
        können sich verzögern, wenn die Modelle ausgelastet sind oder ein Limit erreicht ist – dann wartet LLMitMir und versucht es weiter (bis zu 6 Stunden).
        Einzelne Läufe können auch selbst lange dauern. Plane deshalb nichts, das auf die Minute genau fertig sein muss.</div></div>`}
      ${store.data?.usage?.tasks?.missing ? html`<div class="banner" style="background:color-mix(in srgb, var(--lm-err) 10%, var(--lm-panel))">${icon("key")}
        <div><b>Für geplante Aufgaben fehlt dein eigener API-Schlüssel.</b> Der Admin hat festgelegt, dass Aufgaben nur mit eigenen Schlüsseln laufen –
        ohne ihn startet kein Lauf. <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/settings"); }}>In den Einstellungen eintragen</a>.</div></div>` : nothing}
      ${tasks.length && !isSimple() ? html`<div style="margin-bottom:16px">${taskUsageCard(store.data?.usage?.tasks, this.liveDays())}</div>` : nothing}
      ${limitHit(tasks).length ? html`<div class="checkbox err" style="margin-bottom:14px">${icon("alert", 18)}
        <div><b>${limitHit(tasks).length === 1 ? "Eine Aufgabe hat die Höchstzahl an Schritten erreicht" : `${limitHit(tasks).length} Aufgaben haben die Höchstzahl an Schritten erreicht`}:</b>
        ${limitHit(tasks).map((x: any) => x.name).join(", ")}. Öffne die Aufgabe und gib sie für mehr Schritte frei – dann hat ein Lauf bis zu 150 statt 60 Schritte.</div></div>` : nothing}
      <div class="list">${tasks.length ? tasks.map((x: any) => html`<div class="item task ${x.limit_hit && !x.heavy ? "bad" : ""}" @click=${() => navigate(`/task/${x.id}`)}>
        ${icon("task")}<div class="grow"><div class="row" style="flex-wrap:wrap"><span class="clamp2">${x.name}</span>${x.imported && !x.enabled ? html`<span class="chip warn">importiert – prüfen</span>` : nothing}
          ${x.heavy ? html`<span class="chip" title="Besonders aufwändig: bis zu 150 Schritte je Lauf">${icon("list", 13)} 150 Schritte</span>` : nothing}
          ${x.limit_hit && !x.heavy ? html`<span class="chip err" title="Ein Lauf hat die Höchstzahl von 60 Schritten erreicht – die Aufgabe lässt sich für 150 Schritte freigeben">${icon("alert", 13)} Schritte erschöpft</span>` : nothing}
          ${x.limit_hit && x.heavy ? html`<span class="chip warn" title="Auch 150 Schritte haben für einen Lauf nicht gereicht">${icon("alert", 13)} 150 Schritte erschöpft</span>` : nothing}
          ${x.werkbank_missing ? html`<span class="chip err" title=${x.requires_note || ""}>${icon("mdi:console", 13)} braucht Werkbank</span>` : (x.requires || []).includes("werkbank") ? html`<span class="chip">${icon("mdi:console", 13)} nutzt Werkbank</span>` : nothing}
          ${x.external_fallback ? html`<span class="chip" title="Darf im Notfall auf kostenpflichtige externe Modelle ausweichen">${icon("euro", 13)} Notfall extern</span>` : nothing}
          ${x.last_run?.external ? html`<span class="chip warn" title="Der letzte Lauf lief über ein externes Modell">${icon("euro", 13)} zuletzt extern</span>` : nothing}</div>
          <div class="hint">${x.schedule_text}${x.enabled && x.next_run ? ` · nächster Lauf ${fmtTime(x.next_run)}` : ""}${x.schedule_error ? ` · ⚠ ${x.schedule_error}` : ""}</div>
          <div class="st-narrow">${this.status(x)}</div></div>
        <span class="st-wide">${this.status(x)}</span>
        <button class="iconbtn" title=${t("Jetzt ausführen")} @click=${async (e: Event) => { e.stopPropagation(); const r = await store.api.ws("task/run_now", { task_id: x.id });
          store.notify(r.position > 0 ? `In der Warteschlange (Platz ${r.position})` : "Läuft bereits oder wartet schon"); }}>${icon("play")}</button>
        ${switchEl(!!x.enabled, async (v) => { await store.api.ws("task/save", { task: { ...x, enabled: v } }); })}
      </div>`) : html`<div class="hint">${isSimple() ? "Noch keine geplanten Aufgaben." : "Noch keine geplanten Aufgaben. Lege eine an oder importiere sie aus Claude (Einstellungen → Import)."}</div>`}</div></div>`;
  }
}

@safeElement("lm-task")
export class TaskPage extends StoreElement {
  @property() taskId = "";
  @state() private d: any = null;
  @state() private preview: any = null;
  @state() private dirty = false;
  @state() private people: any[] | null = null;
  static styles = [base, pageCss, css`.share { display: grid; gap: 8px; }
    .share .who { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; align-items: center; }
    .share .who .nm { overflow-wrap: anywhere; }
    .share .who label { display: flex; gap: 5px; align-items: center; font-size: 12.5px; color: var(--lm-muted); white-space: nowrap; }
    .share .who input[type=checkbox] { width: auto; }`];
  updated(ch: Map<string, any>) { if (ch.has("taskId")) this.reload(); }
  connectedCallback() { super.connectedCallback(); this.loadPeople(); }
  private async loadPeople() {
    try { this.people = (await store.api.ws("task/people")).people || []; } catch { this.people = []; }
  }
  private reload() {
    const x = (store.data?.tasks || []).find((y: any) => y.id === this.taskId);
    this.d = x ? JSON.parse(JSON.stringify(x)) : { name: "", prompt: "", schedule: { type: "daily", time: "08:00" }, enabled: true, notify: "always", allow_write: ["notify"], share: { users: [] } };
    if (!this.d.share) this.d.share = { users: [] };
    this.dirty = this.taskId === "new"; this.loadPreview();
  }
  /** Sharing is the owner's business: who else sees the task, who may change it, who gets a notification. */
  private shareUsers(): any[] { return this.d?.share?.users || []; }
  private setShare(users: any[]) { this.d = { ...this.d, share: { users } }; this.dirty = true; }
  private toggleShare(uid: string, on: boolean) {
    const users = this.shareUsers().filter((u: any) => u.user_id !== uid);
    if (on) users.push({ user_id: uid, edit: false, notify: false });
    this.setShare(users);
  }
  private setShareFlag(uid: string, key: "edit" | "notify", on: boolean) {
    this.setShare(this.shareUsers().map((u: any) => (u.user_id === uid ? { ...u, [key]: on } : u)));
  }
  private set(k: string, v: any) { this.d = { ...this.d, [k]: v }; this.dirty = true; }
  private sched(k: string, v: any) { this.d = { ...this.d, schedule: { ...this.d.schedule, [k]: v } }; this.dirty = true; this.loadPreview(); }
  private async loadPreview() {
    try { this.preview = await store.api.ws("task/preview", { schedule: this.d.schedule }); } catch (e: any) { this.preview = { error: e.message }; }
  }
  private async save() {
    try {
      const r = await store.api.ws("task/save", { task: this.d });
      this.dirty = false; store.notify(t("Gespeichert")); await store.load();
      if (this.taskId === "new") navigate(`/task/${r.id}`, true);
    } catch (e: any) { store.notify(e.message); }
  }
  private fallbackCard(x: any) {
    const e = ext();
    if (!e.has_access && !x.external_fallback) return nothing;
    const simple = isSimple();
    return html`<div class="card"><label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${!!x.external_fallback}
        @change=${async (ev: any) => { const on = ev.target.checked;
          if (on && !(await ensureConsent())) { ev.target.checked = false; return; }
          this.set("external_fallback", on); }}>
        <b>${simple ? "Im Notfall mit einer kostenpflichtigen Ersatz-KI ausführen" : "Im Notfall auf kostenpflichtige externe Modelle ausweichen"}</b></label>
      <div class="hint" style="margin:4px 0 0">Ist der Hauptanbieter gerade nicht nutzbar (z. B. Limit erreicht), läuft diese Aufgabe dann über ein externes Modell
        (${(e.providers || []).filter((p: any) => p.id !== "main").map((p: any) => p.operator).join(" oder ") || "Claude"}), statt auszufallen. Dabei gehen der Auftrag
        und die Ergebnisse der Werkzeuge dorthin – nie Passwörter, und nur Zugänge, die für externe Modelle freigegeben sind. Kosten zählen zu deinem
        Monatslimit (${fmtEur(e.month_eur || 0)} von ${fmtEur(e.limit_eur || 0)} verbraucht). Bitte nur ankreuzen, wenn der Auftrag keine sensiblen Informationen enthält.</div></div>`;
  }
  /** Besonders aufwaendige Aufgabe: bis zu 150 statt 60 Schritte – und die Freigabe, wenn die Grenze erreicht war. */
  private stepsCard(x: any) {
    const simple = isSimple();
    const hit = !!x.limit_hit && !x.heavy;
    return html`<div class="card" style=${hit ? "border-color:var(--lm-err);background:color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel))" : ""}>
      ${hit ? html`<div class="checkbox err" style="margin:0 0 14px">${icon("alert", 18)}
        <div><b>Diese Aufgabe hat die Höchstzahl von 60 Schritten erreicht.</b> Ein Lauf wurde deshalb abgebrochen, bevor er fertig war.
        Gib die Aufgabe hier für mehr Schritte frei – dann hat jeder Lauf bis zu 150 Schritte.</div></div>` : nothing}
      <label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${!!x.heavy}
        @change=${(e: any) => this.set("heavy", e.target.checked)}>
        <b>${simple ? "Besonders aufwändige Aufgabe (mehr Schritte)" : "Besonders aufwändig – bis zu 150 Schritte je Lauf"}</b></label>
      <div class="hint" style="margin:4px 0 0">Normal sind es 60 Schritte je Lauf. Reicht das für eine Aufgabe nicht (viele Dateien, viele Abfragen,
        lange Prüfungen), bekommt sie mit dieser Markierung bis zu 150. Ein Lauf dauert dann entsprechend länger und verbraucht mehr Kontingent.</div>
      ${hit ? html`<div class="row" style="margin-top:12px"><button class="btn primary" @click=${async () => {
          this.set("heavy", true); await this.save(); }}>${icon("check", 16)} Für 150 Schritte freigeben</button></div>` : nothing}
      ${x.limit_hit && x.heavy ? html`<div class="hint" style="margin-top:10px">Auch 150 Schritte haben für einen Lauf nicht gereicht. Teile die Aufgabe auf
        oder formuliere den Auftrag enger – mehr Schritte gibt es nicht.</div>` : nothing}</div>`;
  }

  /** Owner only: who else sees the task, who may change it, who gets a notification of their own. */
  private shareCard(x: any) {
    const simple = isSimple();
    const chosen = this.shareUsers();
    const people = this.people || [];
    const known = new Set(chosen.map((u: any) => u.user_id));
    const missing = chosen.filter((u: any) => !people.some((p: any) => p.id === u.user_id));
    return html`<div class="card"><b>${simple ? "Mit anderen teilen" : "Teilen"}</b>
      <div class="hint" style="margin:4px 0 10px">${simple
        ? "Andere Personen in diesem Home Assistant sehen die Aufgabe dann unter „Geplant“. Du entscheidest, wer sie auch ändern darf und wer bei jedem Lauf eine Nachricht aufs eigene Handy bekommt."
        : "Die Aufgabe erscheint bei den gewählten Personen unter „Geplant“. „Bearbeiten“ erlaubt Änderungen und „Jetzt ausführen“, „Benachrichtigen“ schickt jedem Lauf eine Nachricht auf das Gerät der Person. Löschen und das Teilen selbst bleiben bei dir."}</div>
      ${people.length ? html`<div class="share">${people.map((p: any) => {
        const u = chosen.find((c: any) => c.user_id === p.id);
        return html`<div class="who"><span class="nm">${p.name}</span>
          <label><input type="checkbox" .checked=${!!u} @change=${(e: any) => this.toggleShare(p.id, e.target.checked)}> sehen</label>
          <label><input type="checkbox" ?disabled=${!u} .checked=${!!u?.edit} @change=${(e: any) => this.setShareFlag(p.id, "edit", e.target.checked)}> bearbeiten</label>
          <label><input type="checkbox" ?disabled=${!u} .checked=${!!u?.notify} @change=${(e: any) => this.setShareFlag(p.id, "notify", e.target.checked)}> Benachrichtigung</label></div>`;
      })}</div>` : html`<div class="hint">Es gibt keine weiteren Personen, die LLMitMir nutzen dürfen. Admins legen das unter Admin → Personen fest.</div>`}
      ${missing.length ? html`<div class="hint">Nicht mehr verfügbar: ${missing.map((u: any) => u.name || u.user_id).join(", ")}</div>` : nothing}
      ${!x.id ? html`<div class="hint" style="margin-top:8px">Teilen lässt sich erst nach dem ersten Speichern einstellen.</div>` : nothing}</div>`;
  }

  /** A task somebody else shared without the right to change it: everything visible, nothing editable. */
  private readOnly(x: any) {
    const live = (store.data?.tasks || []).find((y: any) => y.id === x.id) || x;
    const runs = (live.runs || []).map((id: string) => (store.data?.chats || []).find((c: any) => c.id === id)).filter(Boolean);
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/tasks")}>${icon("left")}</button><h1 class="grow">${x.name || "Aufgabe"}</h1></div>
      <div class="banner">${icon("info")}<div>Diese Aufgabe gehört <b>${x.owner_name || "jemand anderem"}</b>. Du kannst sie ansehen, aber nicht ändern.</div></div>
      <div class="form">
        <div class="card"><b>${t("Zeitplan")}</b><div class="hint" style="margin-top:6px">${x.schedule_text || ""}</div></div>
        <div class="card"><b>${t("Auftrag")}</b><div class="md" style="margin-top:6px">${md(x.prompt || "")}</div></div>
        <div class="card"><b>${isSimple() ? "Nachricht aufs Handy" : t("Benachrichtigen")}</b>
          <div class="hint" style="margin-top:6px">${x.can_notify ? "Du bekommst bei jedem Lauf eine Nachricht auf dein Gerät." : "Du bekommst keine eigene Nachricht zu dieser Aufgabe."}</div></div>
      </div>
      <h2>${isSimple() ? "Bisherige Ergebnisse" : t("Läufe")}</h2><div class="list">
        ${runs.length ? runs.map((c: any) => html`<div class="item" @click=${() => navigate(`/chat/${c.id}`)}>
          ${store.runs[c.id] || c.status === "running" ? html`<lm-spark size="18"></lm-spark>` : icon(c.status === "error" ? "alert" : "check", 18)}
          <span class="grow ellipsis">${c.title}</span><span class="hint">${fmtTime(c.updated)}</span></div>`) : html`<div class="hint">Noch keine Läufe.</div>`}</div>
      ${live.last_run?.summary ? html`<h2>Letztes Ergebnis</h2><div class="card md">${md(live.last_run.summary)}</div>` : nothing}
    </div>`;
  }

  render() {
    const x = this.d; if (!x) return nothing;
    if (x.shared && !x.can_edit) return this.readOnly(x);
    const d = store.data; const s = x.schedule || {};
    const writeTools = Object.entries(d.tools || {}).filter(([, v]: any) => v.write && !v.confirm);  // confirm: always asks
    // Runs and the last result come from the live task in the store, not from the edit copy in this.d,
    // so a run started here ("Jetzt ausführen" or on schedule) shows up without reopening the page.
    const live = (d.tasks || []).find((y: any) => y.id === x.id) || x;
    const runs = (live.runs || []).map((id: string) => (d.chats || []).find((c: any) => c.id === id)).filter(Boolean);
    const waiting = x.id ? d.queue?.position?.[x.id] : 0;
    const dn = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const simple = isSimple();
    const types = [["daily", "täglich"], ["weekdays", "werktags (Mo–Fr)"], ["weekly", "an bestimmten Wochentagen"], ["monthly", "monatlich"], ["interval", "alle n Stunden"],
      ["hourly", "stündlich"], ["once", "einmalig"], ["cron", "eigener Cron-Ausdruck"]]
      // simple view: the everyday choices (a technical schedule set earlier stays visible)
      .filter(([k]) => !simple || ["daily", "weekdays", "weekly", "monthly", "once"].includes(k) || k === s.type);
    const projectSel = html`<label class="f"><span>${t("Projekte")}</span><select @change=${(e: any) => this.set("project_id", e.target.value || null)}>
      <option value="">Ohne Projekt</option>${(d.projects || []).map((p: any) => html`<option value=${p.id} ?selected=${x.project_id === p.id}>${p.name}</option>`)}</select></label>`;
    const apprTitle = simple ? "Was darf die Aufgabe selbst tun?" : "Freigaben für schreibende Aktionen";
    const apprHint = simple ? "Die Aufgabe läuft, ohne dich zu fragen. Sie darf nur, was hier angehakt ist – zum Beispiel dir eine Nachricht schicken."
      : "Läufe sind unbeaufsichtigt und können nicht nachfragen. Nur hier angehakte Aktionen sind erlaubt, alles andere wird abgelehnt.";
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/tasks")}>${icon("left")}</button><h1 class="grow">${x.id ? x.name || "Aufgabe" : t("Neue Aufgabe")}</h1>
        ${x.id && x.can_edit !== false ? html`<button class="btn" @click=${async () => { const r = await store.api.ws("task/run_now", { task_id: x.id }); store.notify(r.position > 0 ? `In der Warteschlange (Platz ${r.position})` : "Läuft bereits"); }}>${icon("play", 16)} ${t("Jetzt ausführen")}</button>` : nothing}</div>
      ${x.shared ? html`<div class="banner">${icon("info")}<div>Diese Aufgabe gehört <b>${x.owner_name || "jemand anderem"}</b> und ist mit dir geteilt. Du darfst sie ändern und starten – löschen und weitergeben kann sie nur ${x.owner_name || "die Person, der sie gehört"}.</div></div>` : nothing}
      ${x.imported && !x.enabled ? html`<div class="banner">${icon("info")}<div>Aus Claude importiert und deshalb pausiert. Prüfe Auftrag, Zugänge und Freigaben – Verweise auf Claude-Werkzeuge
        (z. B. Gmail-Connector, list_triggers) gibt es hier nicht.${x.imported_note ? html`<br><i>${x.imported_note}</i>` : nothing}</div></div>` : nothing}
      ${x.werkbank_missing ? html`<div class="banner" style="background:color-mix(in srgb, var(--lm-err) 10%, var(--lm-panel))">${icon("mdi:console")}<div>
        <b>Für diese Aufgabe fehlt die Werkbank.</b> Sie läuft trotzdem, erledigt aber nur, was ohne Werkbank geht, und nennt im Ergebnis, was ausgelassen wurde.
        ${x.requires_note ? html`<br><i>Ohne Werkbank fehlt: ${x.requires_note}</i>` : nothing}
        <br><a href="#" @click=${(e: Event) => { e.preventDefault(); navigate("/settings"); }}>Was ist die Werkbank und wie richte ich sie ein?</a></div></div>` : nothing}
      <div class="form">
        <label class="f"><span>${t("Name")}</span><input .value=${x.name} @input=${(e: any) => this.set("name", e.target.value)}></label>
        <label class="f"><span>${simple ? "Was soll passieren?" : t("Auftrag")}</span><textarea rows=${simple ? 8 : 14} placeholder=${simple
          ? "Zum Beispiel: Schau dir die Wettervorhersage für heute an und schick mir eine kurze Zusammenfassung – mit dem Hinweis, ob ich einen Schirm brauche."
          : "Was soll bei jedem Lauf passieren? So genau wie für einen Menschen, der das zum ersten Mal macht."}
          .value=${x.prompt} @input=${(e: any) => this.set("prompt", e.target.value)}></textarea></label>
        <div class="card"><b>${t("Zeitplan")}</b>
          <div class="two" style="margin-top:10px">
            <label class="f"><span>Wiederholung</span><select @change=${(e: any) => this.sched("type", e.target.value)}>
              ${types.map(([k, l]) => html`<option value=${k} ?selected=${s.type === k}>${l}</option>`)}</select></label>
            ${["daily", "weekdays", "weekly", "monthly", "interval"].includes(s.type) ? html`<label class="f"><span>Uhrzeit${s.type === "interval" ? " (Minute zählt)" : ""}</span>
              <input type="time" .value=${s.time || "08:00"} @change=${(e: any) => this.sched("time", e.target.value)}></label>` : nothing}
            ${s.type === "interval" ? html`<label class="f"><span>Alle … Stunden</span><input type="number" min="1" max="23" .value=${String(s.hours || 2)} @change=${(e: any) => this.sched("hours", Number(e.target.value))}></label>` : nothing}
            ${s.type === "hourly" ? html`<label class="f"><span>Zur Minute</span><input type="number" min="0" max="59" .value=${String(s.minute || 0)} @change=${(e: any) => this.sched("minute", Number(e.target.value))}></label>` : nothing}
            ${s.type === "monthly" ? html`<label class="f"><span>Tag im Monat</span><input type="number" min="1" max="31" .value=${String(s.day || 1)} @change=${(e: any) => this.sched("day", Number(e.target.value))}></label>` : nothing}
            ${s.type === "once" ? html`<label class="f"><span>Zeitpunkt</span><input type="datetime-local" .value=${(s.at || "").slice(0, 16)} @change=${(e: any) => this.sched("at", e.target.value)}></label>` : nothing}
            ${s.type === "cron" ? html`<label class="f"><span>Cron (Minute Stunde Tag Monat Wochentag)</span><input class="code" placeholder="23 6 * * *" .value=${s.cron || ""} @change=${(e: any) => this.sched("cron", e.target.value)}></label>` : nothing}
          </div>
          ${s.type === "weekly" ? html`<div class="days" style="margin-top:10px">${[1, 2, 3, 4, 5, 6, 0].map(i => html`<button class=${(s.days || [1]).includes(i) ? "on" : ""}
            @click=${() => { const set = new Set(s.days || [1]); set.has(i) ? set.delete(i) : set.add(i); this.sched("days", [...set]); }}>${dn[i]}</button>`)}</div>` : nothing}
          <div class="hint" style="margin-top:10px">${this.preview?.error ? html`<span style="color:var(--lm-err)">${this.preview.error}</span>` :
            html`${this.preview?.text || ""}${this.preview?.next?.length ? html` · nächste Läufe: ${this.preview.next.slice(0, 3).map((n: string) => fmtTime(n)).join(", ")}` : ""}
            <br>${simple ? "Ist gerade viel los, startet die Aufgabe manchmal etwas später." : "Geplant ist der Start – mit Open-Weight-Modellen beginnt ein Lauf oft später und kann länger dauern."}`}</div></div>
        ${simple ? nothing : html`<div class="two">
          ${projectSel}
          <label class="f"><span>${t("Modell")}</span><select @change=${async (e: any) => {
              const v = e.target.value || null;
              if (v && isExternal(v) && !(await ensureConsent())) { e.target.value = x.model || ""; return; }
              this.set("model", v); }}>
            <option value="">${defaultLabel("agent")}</option>
            ${(d.models || []).filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${x.model === m.id}>${m.name}</option>`)}
            ${(d.models || []).some((m: any) => m.external) ? html`<optgroup label="Kostenpflichtig (extern)">${(d.models || []).filter((m: any) => m.external).map((m: any) => html`<option value=${m.id} ?selected=${x.model === m.id}>${m.name}${m.locked ? " – nur im Notfall" : ""}</option>`)}</optgroup>` : nothing}</select>
            ${isExternal(x.model) ? html`<span class="hint">${icon("euro", 13)} Jeder Lauf kostet Geld (${priceText((d.models || []).find((m: any) => m.id === x.model)?.price)}). Ist das Modell gerade nicht wählbar, läuft die Aufgabe beim Hauptanbieter.</span>` : nothing}</label>
        </div>`}
        ${this.fallbackCard(x)}
        ${this.stepsCard(x)}
        <div class="two">
          <label class="f"><span>${simple ? "Nachricht aufs Handy" : t("Benachrichtigen")}</span><select @change=${(e: any) => this.set("notify", e.target.value)}>
            ${[["always", "nach jedem Lauf"], ["on_change", "nur bei neuem Ergebnis, Rückfrage oder Fehler"], ["error", "nur bei Fehlern"], ["never", "nie"]].map(([k, l]) => html`<option value=${k} ?selected=${x.notify === k}>${l}</option>`)}</select>
            ${!d.settings.notify_device ? html`<span class="hint">Wähle zuerst in den Einstellungen dein Gerät für Benachrichtigungen.</span>` : nothing}</label>
          <label class="f"><span>${t("Aktiv")}</span><div class="row" style="min-height:40px">${switchEl(!!x.enabled, v => this.set("enabled", v))}<span class="muted">${x.enabled ? t("Aktiv") : t("Pausiert")}</span></div></label>
        </div>
        ${!x.shared ? this.shareCard(x) : nothing}
        ${(simple ? (c: unknown) => more(c, "Mehr Optionen: Projekt, Freigaben, Werkbank") : (c: unknown) => c)(html`${simple ? projectSel : nothing}
        <div class="card"><b>${apprTitle}</b><div class="hint" style="margin:4px 0 10px">${apprHint}</div>
          <div class="checks">${writeTools.map(([n, v]: any) => {
            // "Braucht die Werkbank" implies running commands there (server side the same rule applies)
            const viaWb = n === "shell" && (x.requires || []).includes("werkbank");
            return html`<label title=${viaWb ? "Freigegeben durch „Braucht die Werkbank“" : ""}><input type="checkbox" ?disabled=${viaWb} .checked=${viaWb || (x.allow_write || []).includes(n)}
            @change=${(e: any) => { const set = new Set(x.allow_write || []); e.target.checked ? set.add(n) : set.delete(n); this.set("allow_write", [...set]); }}>${icon(v.icon, 16)} ${v.label}</label>`; })}</div></div>
        <div class="card"><label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${(x.requires || []).includes("werkbank")}
            @change=${(e: any) => this.set("requires", e.target.checked ? ["werkbank"] : [])}><b>Braucht die Werkbank</b></label>
          <div class="hint" style="margin:4px 0 8px">Für Schritte mit Befehlen, Python-Skripten, Office-Dateien oder Whisper. Gibt „Befehl ausführen“ frei. Ohne Werkbank läuft die Aufgabe nur teilweise.</div>
          ${(x.requires || []).includes("werkbank") ? html`<textarea rows="2" placeholder="Was geht ohne Werkbank nicht? (z. B. Sprachnachrichten abschreiben)" .value=${x.requires_note || ""}
            @input=${(e: any) => this.set("requires_note", e.target.value)}></textarea>` : nothing}</div>`)}
      </div>
      ${x.id ? html`<h2>${simple ? "Bisherige Ergebnisse" : t("Läufe")}</h2><div class="list">
        ${waiting ? html`<div class="item">${icon("wait", 18)}<span class="grow ellipsis">Wartet in der Warteschlange (Platz ${waiting})</span></div>` : nothing}
        ${runs.length ? runs.map((c: any) => html`<div class="item" @click=${() => navigate(`/chat/${c.id}`)}>
        ${store.runs[c.id] || c.status === "running" ? html`<lm-spark size="18"></lm-spark>` : icon(c.status === "error" ? "alert" : "check", 18)}<span class="grow ellipsis">${c.title}</span>
        <span class="hint">${simple ? fmtTime(c.updated) : `${c.usage?.requests || 0} Anfragen`}</span></div>`) : waiting ? nothing : html`<div class="hint">Noch keine Läufe.</div>`}</div>
        ${live.last_run?.summary ? html`<h2>Letztes Ergebnis</h2><div class="card md">${md(live.last_run.summary)}</div>` : nothing}
        ${!x.shared ? html`<div style="margin-top:24px"><button class="btn danger" @click=${async () => { if (await confirmDialog(`Aufgabe „${x.name}“ löschen? Die bisherigen Läufe bleiben als Chats erhalten.`)) {
          await store.api.ws("task/delete", { task_id: x.id }); navigate("/tasks"); } }}>${icon("trash", 16)} Aufgabe löschen</button></div>` : nothing}` : nothing}
      ${this.dirty ? html`<div class="savebar fade-in">${x.id ? html`<button class="btn" @click=${() => this.reload()}>${t("Abbrechen")}</button>` : nothing}
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

// ---------------------------------------------------------------- skills
@safeElement("lm-skills")
export class Skills extends StoreElement {
  static styles = [base, pageCss];
  render() {
    const sk = store.data?.skills || [];
    return html`<div class="page"><div class="row"><h1 class="grow">${t("Skills")}</h1>
      <button class="btn primary" @click=${() => navigate("/skill/new")}>${icon("plus", 18)} ${t("Neuer Skill")}</button></div>
      ${isSimple() ? explainer("skills", !sk.length) : html`
      <p class="hint">Skills sind Anleitungen für wiederkehrende Themen. Das Modell sieht Name und Beschreibung und lädt die ganze Anleitung, wenn sie passt.
        Zugangsdaten gehören nicht in den Skill-Text, sondern unter ${t("Zugänge")} – im Skill verweist du nur darauf.</p>`}
      <div class="list">${sk.length ? sk.map((s: any) => html`<div class="item" @click=${() => navigate(`/skill/${s.id}`)}>
        ${icon("skill")}<div class="grow"><div class="ellipsis">${s.name}</div><div class="hint clamp2">${s.description}</div></div>
        ${(s.credentials || []).length ? html`<span class="chip">${icon("key", 13)} ${s.credentials.length}</span>` : nothing}
        ${s.enabled === false ? html`<span class="chip">aus</span>` : nothing}</div>`) : html`<div class="hint">Noch keine Skills.</div>`}</div></div>`;
  }
}

@safeElement("lm-skill")
export class SkillPage extends StoreElement {
  @property() skillId = "";
  @state() private d: any = null;
  @state() private files: any[] = [];
  @state() private tab = "edit";
  @state() private dirty = false;
  static styles = [base, pageCss, css`.chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--lm-line); background: var(--lm-panel); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .chips button.on { background: var(--lm-accent-soft); border-color: transparent; color: var(--lm-accent); }`];
  updated(ch: Map<string, any>) { if (ch.has("skillId")) this.reload(); }
  private async reload() {
    const s = (store.data?.skills || []).find((x: any) => x.id === this.skillId);
    this.d = s ? JSON.parse(JSON.stringify(s)) : { name: "", description: "", body: "# Anleitung\n\n", credentials: [], enabled: true };
    this.dirty = !s; this.files = s ? await store.api.ws("files", { scope: "skill", owner: s.id }) : [];
  }
  private set(k: string, v: any) { this.d = { ...this.d, [k]: v }; this.dirty = true; }
  private async save() {
    try { const r = await store.api.ws("skill/save", { skill: this.d }); this.dirty = false; store.notify(t("Gespeichert")); await store.load();
      if (this.skillId === "new") navigate(`/skill/${r.id}`, true); } catch (e: any) { store.notify(e.message); }
  }
  render() {
    const s = this.d; if (!s) return nothing;
    const simple = isSimple();
    const extra = html`<div class="card"><b>${t("Zugänge")}, die dieser Skill nutzt</b><div class="chips" style="margin-top:8px">
          ${(store.data?.credentials || []).map((c: any) => html`<button class=${(s.credentials || []).includes(c.id) ? "on" : ""}
            @click=${() => { const set = new Set(s.credentials || []); set.has(c.id) ? set.delete(c.id) : set.add(c.id); this.set("credentials", [...set]); }}>${c.name}</button>`)}
          ${!(store.data?.credentials || []).length ? html`<span class="hint">Noch keine Zugänge.</span>` : nothing}</div></div>
        ${s.id ? html`<div class="card"><b>${t("Dateien")} (Skripte, Vorlagen, Referenzen)</b>
          ${this.files.map(f => html`<div class="row" style="padding:4px 0"><span class="grow ellipsis" style="font-size:13px">${f.name}</span>
            <button class="iconbtn" @click=${async () => window.open(await store.api.fileUrl("skill", s.id, f.name), "_blank")}>${icon("download", 16)}</button>
            <button class="iconbtn" @click=${async () => { this.files = await store.api.ws("file/delete", { scope: "skill", owner: s.id, name: f.name }); }}>${icon("trash", 16)}</button></div>`)}
          <label class="btn" style="margin-top:6px">${icon("upload", 16)} Hochladen<input type="file" multiple hidden @change=${async (e: any) => {
            await store.api.upload("skill", s.id, e.target.files); this.files = await store.api.ws("files", { scope: "skill", owner: s.id }); e.target.value = ""; }}></label>
          <div class="hint" style="margin-top:6px">Skripte werden erst mit der Werkbank ausführbar; bis dahin kann das Modell sie lesen.</div></div>` : nothing}`;
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/skills")}>${icon("left")}</button><h1 class="grow">${s.id ? s.name : t("Neuer Skill")}</h1>
        ${switchEl(s.enabled !== false, v => this.set("enabled", v))}</div>
      <div class="form">
        <label class="f"><span>${t("Name")}</span><input .value=${s.name} @input=${(e: any) => this.set("name", e.target.value)}></label>
        <label class="f"><span>${simple ? "Wann soll LLMitMir diese Anleitung benutzen?" : html`${t("Beschreibung")} – wann soll der Skill benutzt werden?`}</span><textarea rows="3" .value=${s.description}
          @input=${(e: any) => this.set("description", e.target.value)} placeholder="z. B. „Immer verwenden, wenn es um … geht, auch wenn … nicht ausdrücklich genannt wird.“"></textarea></label>
        ${simple ? html`<label class="f"><span>Anleitung – was soll LLMitMir dabei wissen und beachten?</span><textarea rows="14" .value=${s.body}
          placeholder="Schreib es so auf, als würdest du es einem neuen Kollegen erklären." @input=${(e: any) => this.set("body", e.target.value)}></textarea>
          <span class="hint">Passwörter gehören nicht hierher, sondern unter ${t("Zugänge")}.</span></label>
          ${more(extra, "Mehr Optionen: Zugänge, Dateien")}` : html`
        <div><div class="row"><b class="grow">Anleitung (Markdown, wie SKILL.md)</b><div class="tabs">
          <button class=${this.tab === "edit" ? "on" : ""} @click=${() => (this.tab = "edit")}>Bearbeiten</button>
          <button class=${this.tab === "view" ? "on" : ""} @click=${() => (this.tab = "view")}>Vorschau</button></div></div>
          ${this.tab === "edit" ? html`<textarea class="code" rows="22" style="margin-top:8px" .value=${s.body} @input=${(e: any) => this.set("body", e.target.value)}></textarea>`
            : html`<div class="preview md" style="margin-top:8px">${md(s.body)}</div>`}
          <div class="hint" style="margin-top:6px">Geheimnisse nie hineinschreiben. Verweise mit <code>{{cred:Name:feld}}</code> auf einen Zugang, z. B. <code>{{cred:Hof Nextcloud:password}}</code>.</div></div>
        ${extra}`}
        ${s.id ? html`<div><button class="btn danger" @click=${async () => { if (await confirmDialog(`Skill „${s.name}“ löschen?`)) { await store.api.ws("skill/delete", { skill_id: s.id }); navigate("/skills"); } }}>${icon("trash", 16)} Skill löschen</button></div>` : nothing}
      </div>
      ${this.dirty ? html`<div class="savebar fade-in">${s.id ? html`<button class="btn" @click=${() => this.reload()}>${t("Abbrechen")}</button>` : nothing}
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

// ---------------------------------------------------------------- credentials
/** External uses since the secret last changed (older Zugänge without a change: all uses count). */
const usesSince = (c: any) => (c.ext_uses_since ?? c.ext_uses ?? 0) as number;

/** How often tools used the Zugang at all (every model), with the last time. */
function useChip(c: any) {
  if (!c.uses) return nothing;
  return html`<span class="chip" title=${`Zuletzt ${fmtTime(c.last_used)}${c.last_model ? ` mit ${c.last_model}` : ""}`}>${c.uses}× genutzt</span>`;
}

function extUseChip(c: any) {
  if (!c.ext_uses && !c.secret_changed) return nothing;
  const since = usesSince(c);
  if (c.secret_changed) return html`<span class="chip ${since ? "warn" : "ok"}" title=${`Geheimnis geändert ${fmtTime(c.secret_changed)} · insgesamt ${c.ext_uses || 0}× extern genutzt`}>
    ${since ? `seit Änderung ${since}× extern genutzt` : "seit Änderung nicht extern genutzt"}</span>`;
  return html`<span class="chip warn" title=${`Zuletzt ${fmtTime(c.ext_last)}`}>${since}× extern genutzt</span>`;
}

/** Ablaufdatum: rot, wenn vorbei, gelb, wenn es in den nächsten 14 Tagen so weit ist. */
function expiryChip(c: any) {
  const e = c.expiry;
  if (!e?.date) return nothing;
  const day = e.date.split("-").reverse().join(".");
  if (e.expired) return html`<span class="chip err" title=${`Abgelaufen am ${day} – bitte erneuern`}>${icon("alert", 13)} abgelaufen</span>`;
  if (e.soon) return html`<span class="chip warn" title=${`Läuft am ${day} ab`}>${icon("clock", 13)} läuft am ${day} ab</span>`;
  return html`<span class="chip" title=${`Gültig bis ${day}`}>${icon("clock", 13)} bis ${day}</span>`;
}

/** Letzte Prüfung der Zugangsdaten: grün, wenn sie durchging, rot, wenn nicht. */
function checkChip(c: any) {
  const k = c.check;
  if (!k) return nothing;
  const when = `Zuletzt geprüft ${fmtTime(k.at)}`;
  if (k.ok) return html`<span class="chip ok" title=${`${when}: ${k.message}`}>${icon("check", 13)} geprüft</span>`;
  return html`<span class="chip err" title=${`${when}: ${k.message}`}>${icon("alert", 13)} Prüfung fehlgeschlagen</span>`;
}

/** Klartext zur letzten Prüfung, für die Seite des Zugangs. */
function checkText(c: any) {
  const k = c.check;
  if (!k) return html`Noch nicht geprüft. Die Prüfung meldet sich mit einer harmlosen Leseanfrage an – sie liest nichts,
    ändert nichts und kostet nichts.`;
  return html`${k.ok ? "Zuletzt geprüft" : "Zuletzt fehlgeschlagen"} ${fmtTime(k.at)}: <b>${k.message}</b>`;
}

function useText(c: any) {
  if (!c.uses) return "Von Werkzeugen noch nicht genutzt.";
  return html`Von Werkzeugen genutzt: <b>${c.uses}×</b>, zuletzt ${fmtTime(c.last_used)}${c.last_model ? ` mit ${c.last_model}` : ""}.`;
}

function extUseText(c: any) {
  const since = usesSince(c);
  if (c.secret_changed) {
    const before = c.ext_uses_before ?? Math.max(0, (c.ext_uses || 0) - since);
    return html`Passwort bzw. Token zuletzt geändert am ${fmtTime(c.secret_changed)}.
      ${since ? html`Seitdem <b>${since}×</b> von externen Modellen genutzt, zuletzt ${fmtTime(c.ext_last)}.` : html`Seitdem <b>nicht</b> von externen Modellen genutzt.`}
      ${before ? ` Davor ${before}× – die alte Form ist durch die Änderung ungültig.` : ""}`;
  }
  return c.ext_uses ? html`Von externen Modellen genutzt: <b>${c.ext_uses}×</b>, zuletzt ${fmtTime(c.ext_last)}. Das Passwort selbst geht dabei nie hinaus;
    wer ganz sichergehen will, ändert es beim Dienst und trägt das neue hier ein – dann zählt LLMitMir neu.` : "Noch nie von einem externen Modell genutzt.";
}

@safeElement("lm-credentials")
export class Credentials extends StoreElement {
  static styles = [base, pageCss];
  @state() private checking = false;
  private async checkAll() {
    this.checking = true;
    try { await store.api.ws("credential/check_all"); await store.load(); }
    catch (e: any) { store.notify(e.message); }
    finally { this.checking = false; }
  }
  render() {
    const cs = store.data?.credentials || [];
    const types = store.data?.credential_types || {};
    const extShown = !!(ext().configured || ext().has_access || cs.some((c: any) => c.external || c.ext_uses));
    // Skills and projects that point at the Zugang – not a usage counter, that is c.uses
    const refs = (id: string) => [...(store.data?.skills || []).filter((s: any) => (s.credentials || []).includes(id)).map((s: any) => s.name),
      ...(store.data?.projects || []).filter((p: any) => (p.credentials || []).includes(id)).map((p: any) => p.name)];
    const broken = cs.filter((c: any) => c.check && !c.check.ok);
    return html`<div class="page"><div class="row"><h1 class="grow">${t("Zugänge")}</h1>
      ${cs.length ? html`<button class="btn" ?disabled=${this.checking} @click=${this.checkAll}>
        ${icon("shield", 18)} ${this.checking ? t("Prüfe …") : t("Alle prüfen")}</button>` : nothing}
      <button class="btn primary" @click=${() => navigate("/credential/new")}>${icon("plus", 18)} ${t("Neuer Zugang")}</button></div>
      ${broken.length ? html`<div class="checkbox err" style="margin-bottom:14px">${icon("alert", 18)}
        <div><b>${broken.length === 1 ? "Ein Zugang funktioniert nicht" : `${broken.length} Zugänge funktionieren nicht`}:</b>
        ${broken.map((c: any) => c.name).join(", ")}. Öffne den Zugang und trag das neue Passwort bzw. den neuen Token ein –
        sonst schlagen die Aufgaben fehl, die ihn brauchen.</div></div>` : nothing}
      ${isSimple() ? explainer("credentials", !cs.length) : html`
      <div class="banner">${icon("lock")}<div>Zugangsdaten liegen getrennt von Skills und Projekten. <b>Das Modell sieht nie ein Passwort oder Token</b> – es nennt nur den Namen
        des Zugangs, und die Werkzeuge setzen die Geheimnisse auf dem Server ein. Ergebnisse werden zusätzlich nach Geheimnissen durchsucht und geschwärzt.</div></div>`}
      <div class="list">${cs.length ? cs.map((c: any) => html`<div class="item cred ${c.check && !c.check.ok ? "bad" : ""}" @click=${() => navigate(`/credential/${c.id}`)}>
        ${icon(c.check && !c.check.ok ? "alert" : "key")}<div class="grow"><div class="ellipsis">${c.name}</div><div class="hint ellipsis">${types[c.type]?.label || c.type}${c.fields?.url ? ` · ${c.fields.url}` : ""}${c.fields?.username ? ` · ${c.fields.username}` : ""}</div>
        ${c.check && !c.check.ok ? html`<div class="cred-err">${c.check.message}</div>` : nothing}</div>
        <div class="tags">
        ${checkChip(c)}
        ${extShown ? (c.external ? html`<span class="chip warn" title="Für kostenpflichtige externe Modelle freigegeben">${icon("euro", 13)} extern frei</span>`
          : html`<span class="chip" title="Für kostenpflichtige externe Modelle gesperrt">${icon("lock", 13)} extern gesperrt</span>`) : nothing}
        ${useChip(c)}
        ${extUseChip(c)}
        ${expiryChip(c)}
        ${refs(c.id).length ? html`<span class="chip" title=${`Wird verwendet von: ${refs(c.id).join(", ")}`}>${refs(c.id).length}× verknüpft</span>` : nothing}</div></div>`) : html`<div class="hint">Noch keine Zugänge.</div>`}</div></div>`;
  }
}

@safeElement("lm-credential")
export class CredentialPage extends StoreElement {
  @property() credId = "";
  @state() private d: any = null;
  @state() private shown = new Set<string>();
  @state() private revealed: any = null;
  @state() private dirty = false;
  @state() private checking = false;
  @state() private newField = "";
  static styles = [base, pageCss, css`.fieldrow { display: flex; gap: 6px; align-items: center; } .fieldrow input { flex: 1; font-family: var(--lm-mono); font-size: 13.5px; } .svcgrid { display: grid; grid-template-columns: max-content minmax(0, 220px); gap: 8px 16px; align-items: center; }`];
  updated(ch: Map<string, any>) { if (ch.has("credId")) this.reload(); }
  private reload() {
    const c = (store.data?.credentials || []).find((x: any) => x.id === this.credId);
    this.d = c ? JSON.parse(JSON.stringify(c)) : { name: "", type: "webdav", fields: {}, notes: "" };
    this.revealed = null; this.shown = new Set(); this.dirty = !c;
  }
  private set(k: string, v: any) { this.d = { ...this.d, [k]: v }; this.dirty = true; }
  private setField(k: string, v: string) { this.d = { ...this.d, fields: { ...this.d.fields, [k]: v } }; this.dirty = true; }
  private async reveal(k: string) {
    if (!this.revealed && this.d.id) this.revealed = await store.api.ws("credential/reveal", { credential_id: this.d.id });
    const s = new Set(this.shown); s.has(k) ? s.delete(k) : s.add(k); this.shown = s;
    if (this.revealed && this.d.fields[k] === "•••") this.d = { ...this.d, fields: { ...this.d.fields, [k]: this.revealed.fields[k] } };
  }
  private async save() {
    try { const r = await store.api.ws("credential/save", { credential: this.d }); this.dirty = false; store.notify(t("Gespeichert")); await store.load();
      if (this.credId === "new") navigate(`/credential/${r.id}`, true); else this.reload(); } catch (e: any) { store.notify(e.message); }
  }
  private async check() {
    if (!this.d?.id) return;
    this.checking = true;
    try { const r = await store.api.ws("credential/check", { credential_id: this.d.id });
      this.d = { ...this.d, check: r }; await store.load();
      store.notify(r.ok ? t("Zugang funktioniert") : r.message); }
    catch (e: any) { store.notify(e.message); }
    finally { this.checking = false; }
  }
  render() {
    const c = this.d; if (!c) return nothing;
    const types = store.data?.credential_types || {};
    const ty = types[c.type] || { fields: [], secret: [] };
    const secret = new Set([...(ty.secret || []), ...(c.secret_fields || [])]);
    // GWDG-Exchange: Dienste (Postfach, Kalender, Kontakte) wählen; deren Adressen erzeugt der Server beim Speichern
    const svcDefs: Record<string, string> = ty.services || {};
    const svc: string[] = c.services ?? ty.default_services ?? [];
    const svcFields: Record<string, string[]> = ty.service_fields || {};
    // automatisch erzeugte Felder und Adressen früherer Versionen zeigt das Formular nicht als „weiteres Feld“
    const auto = new Set([...Object.values(svcFields).flat(), ...(ty.obsolete || [])]);
    // Adressen, die LLMitMir selbst setzt (GWDG), stehen im Hinweis statt als Feld im Formular
    const hidden = new Set<string>(ty.hidden || []);
    const own = [...ty.fields, ...Object.entries(svcFields).filter(([k]) => svc.includes(k)).flatMap(([, v]) => v)]
      .filter(k => !hidden.has(k));
    const keys = [...own, ...Object.keys(c.fields || {}).filter(k => !own.includes(k) && !auto.has(k))];
    const readonly = new Set<string>(ty.readonly || []);
    const labels: Record<string, string> = { url: "URL", username: "Benutzername", password: "Passwort", token: "Token", share_token: "Freigabe-Token",
      header: "Header-Name", key: "Schlüssel", chat_ids: "Chat-IDs", imap_host: "IMAP-Server", smtp_host: "SMTP-Server", ...(ty.labels || {}) };
    const placeholders: Record<string, string> = ty.placeholders || {};
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/credentials")}>${icon("left")}</button><h1 class="grow">${c.id ? c.name : t("Neuer Zugang")}</h1></div>
      <div class="form">
        <div class="two"><label class="f"><span>${t("Name")}</span><input .value=${c.name} placeholder="z. B. Hof Nextcloud" @input=${(e: any) => this.set("name", e.target.value)}></label>
          <label class="f"><span>${t("Typ")}</span><select @change=${(e: any) => {
            const nt = types[e.target.value] || {};
            this.d = { ...this.d, type: e.target.value, services: nt.services ? (this.d.services ?? nt.default_services ?? []) : undefined,
              name: this.d.name || (e.target.value === "gwdg" ? "GWDG-Exchange" : e.target.value === "ews" ? "Exchange" : "") }; this.dirty = true; }}>
            ${Object.entries(types).map(([k, v]: any) => html`<option value=${k} ?selected=${c.type === k}>${v.label}</option>`)}</select></label></div>
        ${ty.hint ? html`<div class="hint">${ty.hint}</div>` : nothing}
        ${Object.keys(svcDefs).length ? html`<div class="f"><span>${t("Verwenden für")}</span>
          <div class="svcgrid">${Object.entries(svcDefs).map(([k, l]) => html`<label class="row" style="gap:6px;white-space:nowrap">
            <input type="checkbox" style="width:auto" .checked=${svc.includes(k)} @change=${(e: any) => this.set("services",
              Object.keys(svcDefs).filter(x => x === k ? e.target.checked : svc.includes(x)))}> ${l}</label>
            <select ?disabled=${!svc.includes(k)} title="Was LLMitMir mit diesem Dienst darf"
              @change=${(e: any) => this.set("access", { ...(c.access || {}), [k]: e.target.value })}>
              <option value="read" ?selected=${(c.access?.[k] || "read") === "read"}>nur lesen</option>
              <option value="write" ?selected=${c.access?.[k] === "write"}>lesen und schreiben</option></select>`)}</div>
          <span class="hint">„Nur lesen“ gilt wirklich: Die KI bekommt das Passwort nie und kann dann weder Mails senden,
            verschieben oder löschen noch Termine oder Kontakte anlegen, ändern oder löschen.</span>
          ${svc.length ? nothing : html`<span class="hint" style="color:var(--lm-err)">Wähl mindestens einen Dienst aus.</span>`}</div>` : nothing}
        ${keys.map(k => html`<label class="f"><span>${labels[k] || k}${secret.has(k) ? html` <span class="chip">${icon("lock", 12)} geheim</span>` : nothing}</span>
          <div class="fieldrow"><input type=${secret.has(k) && !this.shown.has(k) ? "password" : "text"} autocomplete="off" .value=${c.fields?.[k] ?? ""}
            placeholder=${placeholders[k] || (readonly.has(k) ? "Wird beim Speichern automatisch ergänzt" : "")} ?readonly=${readonly.has(k)}
            @focus=${(e: any) => { if (e.target.value === "•••") { e.target.value = ""; } }} @input=${(e: any) => this.setField(k, e.target.value)}>
            ${secret.has(k) ? html`<button class="iconbtn" title=${this.shown.has(k) ? t("Verbergen") : t("Anzeigen")} @click=${() => this.reveal(k)}>${icon(this.shown.has(k) ? "eyeOff" : "eye", 18)}</button>` : nothing}
            ${c.id && c.fields?.[k] ? html`<button class="iconbtn" title=${t("Kopieren")} @click=${async () => {
              const v = secret.has(k) ? (this.revealed || await store.api.ws("credential/reveal", { credential_id: c.id })).fields[k] : c.fields[k]; copyText(v); }}>${icon("copy", 18)}</button>` : nothing}
            ${!own.includes(k) ? html`<button class="iconbtn" title="Feld entfernen" @click=${() => { const f = { ...c.fields }; delete f[k];
              this.d = { ...c, fields: f, remove_fields: [...(c.remove_fields || []), k] }; this.dirty = true; }}>${icon("trash", 18)}</button>` : nothing}</div></label>`)}
        ${(isSimple() ? (x: unknown) => more(x, "Weiteres Feld hinzufügen") : (x: unknown) => x)(html`<div class="row"><input placeholder="Weiteres Feld (Name)" .value=${this.newField} @input=${(e: any) => (this.newField = e.target.value)}>
          <button class="btn" @click=${() => { if (this.newField.trim()) { this.setField(this.newField.trim().replace(/\W+/g, "_"), ""); this.newField = ""; } }}>${icon("plus", 16)} Feld</button>
          <label class="row hint" style="white-space:nowrap"><input type="checkbox" style="width:auto" @change=${(e: any) => {
            if (!this.newField.trim()) return; const n = this.newField.trim().replace(/\W+/g, "_"); this.set("secret_fields", e.target.checked ? [...(c.secret_fields || []), n] : (c.secret_fields || []).filter((x: string) => x !== n)); }}> geheim</label></div>`)}
        <label class="f"><span>${t("Gültig bis")} <span class="hint">(optional)</span></span>
          <input type="date" .value=${c.valid_until || ""} @input=${(e: any) => this.set("valid_until", e.target.value)}>
          <span class="hint">Viele Tokens laufen ab. LLMitMir warnt zwei Wochen vorher in der Liste und nennt den Grund, wenn ein Werkzeug deshalb scheitert.</span></label>
        <label class="f"><span>${t("Notiz")}</span><textarea rows="3" placeholder="Wofür, wo erneuern …" .value=${c.notes || ""} @input=${(e: any) => this.set("notes", e.target.value)}></textarea></label>
        ${c.id ? html`<div class="card"><b>${icon("shield", 16)} ${t("Funktionieren die Zugangsdaten?")}</b>
          <div class="checkbox ${c.check ? (c.check.ok ? "ok" : "err") : ""}" style="margin-top:8px">
            ${icon(c.check && !c.check.ok ? "alert" : c.check ? "check" : "info", 18)}<div>${checkText(c)}</div></div>
          <div class="row" style="margin-top:10px"><button class="btn" ?disabled=${this.checking} @click=${this.check}>
            ${icon("shield", 16)} ${this.checking ? t("Prüfe …") : t("Jetzt prüfen")}</button>
            <span class="hint">Meldet sich mit einer Leseanfrage an, ändert nichts.</span></div></div>` : nothing}
        ${c.id ? html`<div class="hint">${useText(c)}</div>` : nothing}
        ${ext().configured || ext().has_access || c.external || c.ext_uses ? html`<div class="card"><b>${icon("euro", 16)} Kostenpflichtige externe Modelle</b>
          <div class="form" style="margin-top:8px;gap:8px">
            <label class="row" style="gap:10px;align-items:flex-start"><input type="radio" name="extcred" style="width:auto;margin-top:3px" .checked=${!c.external}
              @change=${() => this.set("external", false)}><span><b>Gesperrt</b> (Standard)<br><span class="hint">Externe Modelle (Claude bei Microsoft Azure oder Anthropic)
              sehen diesen Zugang gar nicht, können ihn nicht nutzen, und frühere Ergebnisse aus ihm werden aus dem Verlauf entfernt.</span></span></label>
            <label class="row" style="gap:10px;align-items:flex-start"><input type="radio" name="extcred" style="width:auto;margin-top:3px" .checked=${!!c.external}
              @change=${() => this.set("external", true)}><span><b>Freigegeben</b><br><span class="hint">Externe Modelle dürfen ihn nutzen; was sie damit abrufen
              (z. B. Dateien, Termine), geht an den externen Anbieter. Das Passwort selbst bekommt nie ein Modell zu sehen. Nur für Zugänge ohne sensible Inhalte.</span></span></label>
            <div class="hint">${extUseText(c)}</div>
          </div></div>` : nothing}
        ${isSimple() ? html`<div class="hint">${icon("lock", 15)} Deine Passwörter sieht die KI nie – LLMitMir setzt sie erst beim Zugriff im Hintergrund ein.</div>` : nothing}
        ${c.id && !isSimple() ? html`<div class="card hint">Im Skill oder Auftrag verweisen: <code>{{cred:${c.name}:${ty.secret?.[0] || "feld"}}}</code> – oder in Werkzeugen <code>zugang: "${c.name}"</code>.</div>` : nothing}
        ${c.id ? html`<div><button class="btn danger" @click=${async () => { if (await confirmDialog(`Zugang „${c.name}“ löschen? Skills und Projekte verlieren den Verweis.`)) {
          await store.api.ws("credential/delete", { credential_id: c.id }); navigate("/credentials"); } }}>${icon("trash", 16)} Zugang löschen</button></div>` : nothing}
      </div>
      ${this.dirty ? html`<div class="savebar fade-in">${c.id ? html`<button class="btn" @click=${() => this.reload()}>${t("Abbrechen")}</button>` : nothing}
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}

export { fmtDuration };
