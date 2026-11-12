// Home (new chat/cowork), chat list, projects and project detail.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, fmtTime, daysText, confirmDialog, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { defaultLabel } from "./modelpick";
import type { SendDetail } from "./composer";
import { explainer, explainerCss, more } from "./simple";

export async function startChat(d: SendDetail) {
  const kind = d.mode === "cowork" ? "cowork" : "chat";
  const chat = await store.api.ws("chat/create", { kind, project_id: d.project_id, model: d.model, ...(kind === "chat" ? { tools: d.tools } : {}) });
  let names: string[] = [];
  if (d.files.length) names = (await store.api.upload("chat", chat.id, d.files)).files.map((f: any) => f.name);
  store.chats.set(chat.id, { ...chat, messages: [], progress: [], usage: {} });
  navigate(`/chat/${chat.id}`);
  await store.api.ws("chat/send", { chat_id: chat.id, text: d.text || "(siehe Anhang)", attachments: names, model: d.model });
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? t("Gute Nacht") : h < 11 ? t("Guten Morgen") : h < 18 ? t("Guten Tag") : t("Guten Abend");
}

@safeElement("lm-home")
export class Home extends StoreElement {
  @property() initialMode: "chat" | "cowork" = "chat";
  @property() projectId: string | null = null;
  @state() private mode: "chat" | "cowork" = "chat";
  @state() private model = "";
  @state() private busy = false;
  private manual = false;  // the person picked a model here; until then the default follows load and new releases
  static styles = [base, css`
    :host { display: block; height: 100%; overflow-y: auto; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; justify-content: center; max-width: 760px; margin: 0 auto; padding: 24px 20px 12vh; }
    h1 { font-family: var(--lm-head); font-weight: 600; font-size: clamp(26px, 4vw, 38px); text-align: center; margin: 0 0 26px;
      display: flex; align-items: center; justify-content: center; gap: 14px; letter-spacing: -.015em; animation: fadeIn .5s; }
    .sugg { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
    .sugg button { border: 1px solid var(--lm-line); background: transparent; border-radius: 999px; padding: 7px 13px; font-size: 13.5px;
      color: var(--lm-muted); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; transition: all .15s; }
    .sugg button:hover { background: var(--lm-panel); color: var(--lm-text); border-color: color-mix(in srgb, var(--lm-accent) 40%, var(--lm-line)); }
    .info { margin-top: 26px; font-size: 12.5px; color: var(--lm-faint); text-align: center; }
    .nokey { margin-bottom: 16px; }
  `];
  connectedCallback() { super.connectedCallback(); this.mode = this.initialMode; this.pickModel(); }
  updated(ch: Map<string, any>) { if (ch.has("initialMode")) { this.mode = this.initialMode; this.manual = false; this.pickModel(); } }
  willUpdate() { if (!this.manual) this.pickModel(); }
  private pickModel() {
    const d = store.data?.defaults || {};
    const p = (store.data?.projects || []).find((x: any) => x.id === this.projectId);
    this.model = (this.mode === "chat" ? p?.model_chat || d.chat : p?.model_agent || d.agent) || "";
  }
  private async send(e: CustomEvent<SendDetail>) {
    if (this.busy) return;
    this.busy = true;
    try { await startChat(e.detail); } catch (err: any) { store.notify(String(err.message || err)); }
    this.busy = false;
  }
  private fill(text: string, mode: "chat" | "cowork") {
    this.mode = mode; this.manual = false; this.pickModel();
    const c = this.renderRoot.querySelector("lm-composer") as any;
    c?.setText(text); c?.focus();
  }
  render() {
    const d = store.data;
    const name = (d?.user?.name || "").split(" ")[0];
    const u = d?.usage;
    const simple = isSimple();
    const mode = simple ? "chat" : this.mode;
    return html`<div class="wrap">
      ${u && !u.has_key ? html`<div class="card nokey row">${icon("key")}<div class="grow">${d.key_mode === "per_user_own"
        ? html`Trag zuerst deinen API-Schlüssel ein.` : html`Es ist noch kein API-Schlüssel hinterlegt. ${d.user.is_admin ? "Lege ihn unter Admin fest." : "Bitte den Admin, einen einzutragen."}`}</div>
        <button class="btn" @click=${() => navigate(d.key_mode === "per_user_own" ? "/settings" : "/admin")}>Öffnen</button></div>` : nothing}
      <h1><lm-spark size="34" .active=${false}></lm-spark>${greeting()}${name ? `, ${name}` : ""}</h1>
      <lm-composer big ?showMode=${!simple} ?showProject=${!simple} .simple=${simple} .mode=${mode} .model=${this.model} .projectId=${this.projectId} .busy=${this.busy}
        placeholder=${mode === "cowork" ? t("Was soll ich erledigen?") : t("Wie kann ich helfen?")}
        @mode=${(e: CustomEvent) => { this.mode = e.detail; this.manual = false; }} @model=${(e: CustomEvent) => { this.model = e.detail; this.manual = true; }}
        @project=${(e: CustomEvent) => { this.projectId = e.detail; this.manual = false; this.pickModel(); }} @send=${this.send}></lm-composer>
      <div class="sugg">
        ${simple ? html`
          <button @click=${() => this.fill("Erkläre mir einfach und verständlich: ", "chat")}>${icon("sparkle", 16)} Etwas erklären lassen</button>
          <button @click=${() => this.fill("Verbessere diesen Text, freundlich und gut verständlich:\n\n", "chat")}>${icon("edit", 16)} Text verbessern</button>
          <button @click=${() => this.fill("Suche im Internet nach ", "chat")}>${icon("web", 16)} Im Internet suchen</button>
          <button @click=${() => this.fill("Wie ist es gerade zu Hause? Ist alles in Ordnung?", "chat")}>${icon("home", 16)} Alles ok zu Hause?</button>
          <button @click=${() => this.fill("Erinnere mich jeden Tag um 8 Uhr an ", "chat")}>${icon("task", 16)} Regelmäßig erinnern</button>
          <button @click=${() => this.fill("Was kannst du alles für mich tun? Erkläre es mir einfach, mit ein paar Beispielen.", "chat")}>${icon("info", 16)} Was kannst du?</button>`
        : this.mode === "chat" ? html`
          <button @click=${() => this.fill("Erkläre mir verständlich: ", "chat")}>${icon("sparkle", 16)} Erklären</button>
          <button @click=${() => this.fill("Formuliere diese E-Mail freundlich und knapp um:\n\n", "chat")}>${icon("edit", 16)} Text überarbeiten</button>
          <button @click=${() => this.fill("Suche im Web nach ", "chat")}>${icon("web", 16)} Im Web suchen</button>`
        : html`
          <button @click=${() => this.fill("Wie ist der Zustand im Haus? Prüfe Heizung, offene Fenster und auffällige Sensoren und fasse zusammen.", "cowork")}>${icon("home", 16)} Hausstatus</button>
          <button @click=${() => this.fill("Lies die Dateien im Ordner … meines Zugangs … und erstelle eine Übersicht als Tabelle.", "cowork")}>${icon("cloud", 16)} Dateien auswerten</button>
          <button @click=${() => this.fill("Recherchiere zu … und schreibe eine kurze Zusammenfassung mit Quellen in eine Datei.", "cowork")}>${icon("search", 16)} Recherche</button>`}
      </div>
      <div class="info">${simple ? "KI kann Fehler machen – Wichtiges bitte prüfen. Antworten können je nach Auslastung etwas dauern."
        : `${d?.provider?.name || ""} · Open-Weight-Modelle – Antworten können je nach Auslastung dauern.`}</div>
    </div>`;
  }
}

// ---------------------------------------------------------------- all chats
@safeElement("lm-chats")
export class Chats extends StoreElement {
  @state() private q = "";
  @state() private filter = "all";
  static styles = [base, css`:host { display: block; height: 100%; overflow-y: auto; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0 16px; }
    .tabs button { border: 1px solid var(--lm-line); background: none; border-radius: 999px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
    .tabs button.on { background: var(--lm-text); color: var(--lm-bg); border-color: var(--lm-text); }`];
  render() {
    const chats = (store.data?.chats || []).filter((c: any) =>
      (this.filter === "all" || c.kind === this.filter) && (!this.q || (c.title || "").toLowerCase().includes(this.q.toLowerCase())));
    const proj = (id: string) => (store.data?.projects || []).find((p: any) => p.id === id)?.name;
    return html`<div class="page"><h1>${t("Chats")}</h1>
      <input placeholder=${t("Suchen …")} .value=${this.q} @input=${(e: any) => (this.q = e.target.value)}>
      <div class="tabs">${(isSimple() ? [["all", t("Alle")], ["task_run", "Ergebnisse geplanter Aufgaben"]]
        : [["all", t("Alle")], ["chat", "Chats"], ["cowork", "Coworks"], ["task_run", t("Aufgabenläufe")]]).map(([k, l]) =>
        html`<button class=${this.filter === k ? "on" : ""} @click=${() => (this.filter = k)}>${l}</button>`)}</div>
      <div class="list">${chats.length ? chats.map((c: any) => html`<div class="item" @click=${() => navigate(`/chat/${c.id}`)}>
        ${icon(c.kind === "chat" ? "chat" : c.kind === "cowork" ? "cowork" : "task")}
        <div class="grow"><div class="ellipsis">${c.title || t("Neuer Chat")}</div>
          <div class="hint">${fmtTime(c.updated)} · ${c.messages} Nachrichten${c.project_id ? ` · ${proj(c.project_id) || ""}` : ""}</div></div>
        ${c.status === "running" ? html`<lm-spark size="18"></lm-spark>` : c.status === "error" ? html`<span class="chip err">Fehler</span>` : nothing}
        ${c.pinned ? icon("pin", 16) : nothing}</div>`) : html`<div class="hint">${t("Keine Chats")}</div>`}</div></div>`;
  }
}

// ---------------------------------------------------------------- projects
@safeElement("lm-projects")
export class Projects extends StoreElement {
  static styles = [base, explainerCss, css`:host { display: block; height: 100%; overflow-y: auto; }
    .pc { padding: 16px; min-height: 120px; display: grid; align-content: start; gap: 6px; }
    .pc b { font-size: 15px; }
    .item.pc.new { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; border-style: dashed; color: var(--lm-muted); }`];
  private create() { navigate("/project/new"); }
  render() {
    const ps = store.data?.projects || [];
    const count = (id: string) => (store.data?.chats || []).filter((c: any) => c.project_id === id).length;
    return html`<div class="page"><div class="row"><h1 class="grow">${t("Projekte")}</h1>
      <button class="btn primary" @click=${this.create}>${icon("plus", 18)} ${t("Neues Projekt")}</button></div>
      ${isSimple() ? explainer("projects", !ps.length)
        : html`<p class="hint">Projekte bündeln Anweisungen, Dateien, Zugänge und Skills. Chats und Coworks darin starten mit diesem Kontext.</p>`}
      <div class="grid">${ps.map((p: any) => html`<div class="item pc" @click=${() => navigate(`/project/${p.id}`)}>
        <div class="row">${icon("project")}<b class="grow ellipsis">${p.name}</b></div>
        <div class="hint" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${p.description || (p.instructions || "").slice(0, 160) || "Noch keine Anweisungen."}</div>
        <div class="row" style="margin-top:auto"><span class="chip">${count(p.id)} Chats</span>
          <span class="chip" title="Chats und Coworks dieses Projekts werden danach gelöscht">${icon("hourglass", 13)} ${daysText(p.retention_days)}</span>${(p.credentials || []).length ? html`<span class="chip">${icon("key", 13)} ${(p.credentials || []).length}</span>` : nothing}
          ${(p.skills || []).length ? html`<span class="chip">${icon("skill", 13)} ${(p.skills || []).length}</span>` : nothing}</div></div>`)}
        <div class="item pc new" @click=${this.create}>${icon("plus")} ${t("Neues Projekt")}</div></div></div>`;
  }
}

@safeElement("lm-project")
export class ProjectPage extends StoreElement {
  @property() projectId = "";
  @state() private draft: any = null;
  @state() private files: any[] = [];
  @state() private dirty = false;
  static styles = [base, explainerCss, css`:host { display: block; height: 100%; overflow-y: auto; }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
    .side { display: grid; gap: 14px; }
    .side .card h3 { margin: 0 0 10px; font-size: 13.5px; display: flex; gap: 6px; align-items: center; }
    .tw { position: relative; flex: 1; min-width: 0; }
    .title { font-family: var(--lm-head); font-weight: 650; font-size: 24px; padding: 8px 44px 8px 12px; border: 1px solid var(--lm-line);
      background: var(--lm-panel); border-radius: 12px; }
    .title:hover { border-color: color-mix(in srgb, var(--lm-accent) 35%, var(--lm-line)); }
    .tw .pen { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--lm-faint); pointer-events: none; }
    .lock { display: grid; place-items: center; text-align: center; gap: 8px; padding: 28px 16px; border: 1px dashed var(--lm-line); border-radius: 16px; color: var(--lm-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--lm-line); background: var(--lm-panel); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .chips button.on { background: var(--lm-accent-soft); border-color: transparent; color: var(--lm-accent); }
    .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    @media (max-width: 900px) { .cols { grid-template-columns: minmax(0, 1fr); } }`];
  updated(ch: Map<string, any>) {
    if (ch.has("projectId")) this.reload();
  }
  private async reload() {
    if (this.projectId === "new") {
      this.draft = { name: "", description: "", instructions: "", credentials: [], skills: [],
        retention_days: store.data?.retention?.default ?? 7 }; this.dirty = false; this.files = [];
      this.updateComplete.then(() => (this.renderRoot.querySelector("input.title") as HTMLInputElement | null)?.focus());
      return;
    }
    const p = (store.data?.projects || []).find((x: any) => x.id === this.projectId);
    this.draft = p ? JSON.parse(JSON.stringify(p)) : null; this.dirty = false;
    if (p) this.files = await store.api.ws("files", { scope: "project", owner: p.id });
  }
  private set(k: string, v: any) { this.draft = { ...this.draft, [k]: v }; this.dirty = true; }
  private toggle(k: string, id: string) {
    const s = new Set(this.draft[k] || []); s.has(id) ? s.delete(id) : s.add(id); this.set(k, [...s]);
  }
  private async save() {
    if (!String(this.draft.name || "").trim()) { store.notify("Bitte gib dem Projekt einen Namen."); return; }
    try {
      const r = await store.api.ws("project/save", { project: this.draft }); this.dirty = false; store.notify(t("Gespeichert")); await store.load();
      if (this.projectId === "new") navigate(`/project/${r.id}`, true);
    } catch (e: any) { store.notify(e.message); }
  }
  private async upload(e: any) {
    try { await store.api.upload("project", this.projectId, e.target.files); this.files = await store.api.ws("files", { scope: "project", owner: this.projectId }); }
    catch (err: any) { store.notify(err.message); }
    e.target.value = "";
  }
  render() {
    const p = this.draft;
    if (!p) return html`<div class="page hint">Projekt nicht gefunden.</div>`;
    const d = store.data;
    const chats = (d.chats || []).filter((c: any) => c.project_id === p.id);
    const models = d.models || [];
    const groups = d.tool_groups || {};
    const writeTools = Object.entries(d.tools || {}).filter(([, v]: any) => v.write && !v.confirm);  // confirm: always asks
    const simple = isSimple();
    const instrLabel = simple ? "Was soll LLMitMir in diesem Projekt immer wissen?" : t("Anweisungen");
    const instrPh = simple ? "Zum Beispiel: Worum es geht, wer beteiligt ist, was wichtig ist und wie Antworten aussehen sollen."
      : "Was soll das Modell in diesem Projekt immer wissen und beachten? (Rolle, Ziele, Regeln, Formate …)";
    const adv = (c: unknown) => (simple ? more(c, "Mehr Optionen: Zugänge, Skills, Freigaben") : c);
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/projects")}>${icon("left")}</button>
        <label class="tw"><input class="title" placeholder="Name des Projekts" aria-label="Name des Projekts" .value=${p.name}
          @input=${(e: any) => this.set("name", e.target.value)}><span class="pen">${icon("edit", 18)}</span></label></div>
      <input style="margin:4px 0 18px" placeholder="Kurzbeschreibung" .value=${p.description || ""} @input=${(e: any) => this.set("description", e.target.value)}>
      ${!p.id ? html`<div class="lock">${icon("project", 26)}<b>Neues Projekt</b><span class="hint">Gib einen Namen ein und speichere – danach kannst du Dateien hochladen und Chats und Coworks in diesem Projekt starten.</span>
        <div class="row" style="justify-content:center;margin-top:6px"><button class="btn" @click=${() => navigate("/projects")}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save} ?disabled=${!String(p.name || "").trim()}>${icon("check", 16)} Projekt anlegen</button></div></div>
        <h2>${instrLabel}</h2><textarea rows="10" placeholder=${instrPh}
          .value=${p.instructions || ""} @input=${(e: any) => this.set("instructions", e.target.value)}></textarea>` : html`
      <div class="cols"><div>
        <lm-composer ?showMode=${!simple} .simple=${simple} .projectId=${p.id} .mode=${"chat"} .model=${p.model_chat || d.defaults.chat} placeholder="Neuer Chat in diesem Projekt …"
          @send=${async (e: CustomEvent) => { try { await startChat({ ...e.detail, project_id: p.id }); } catch (err: any) { store.notify(err.message); } }}></lm-composer>
        <h2>Chats & Coworks</h2>
        <div class="list">${chats.length ? chats.map((c: any) => html`<div class="item" @click=${() => navigate(`/chat/${c.id}`)}>
          ${icon(c.kind === "chat" ? "chat" : c.kind === "cowork" ? "cowork" : "task")}<div class="grow ellipsis">${c.title}</div><span class="hint">${fmtTime(c.updated)}</span></div>`)
          : html`<div class="hint">Noch keine Chats in diesem Projekt.</div>`}</div>
        <h2>${instrLabel}</h2>
        <textarea rows="12" placeholder=${instrPh}
          .value=${p.instructions || ""} @input=${(e: any) => this.set("instructions", e.target.value)}></textarea>
      </div>
      <div class="side">
        <div class="card"><h3>${icon("file", 18)} ${t("Dateien")}</h3>
          ${this.files.map(f => html`<div class="row" style="padding:4px 0"><span class="grow ellipsis" style="font-size:13px">${f.name}</span>
            <button class="iconbtn" @click=${async () => window.open(await store.api.fileUrl("project", p.id, f.name), "_blank")}>${icon("download", 16)}</button>
            <button class="iconbtn" @click=${async () => { this.files = await store.api.ws("file/delete", { scope: "project", owner: p.id, name: f.name }); }}>${icon("trash", 16)}</button></div>`)}
          <label class="btn" style="margin-top:6px">${icon("upload", 16)} Hochladen<input type="file" multiple hidden @change=${this.upload}></label>
          <div class="hint" style="margin-top:6px">${simple ? "LLMitMir schaut in diese Dateien, wenn sie für eine Frage wichtig sind." : "Das Modell liest sie bei Bedarf mit „Datei lesen“ (Bereich Projekt)."}</div></div>
        <div class="card"><h3>${icon("hourglass", 18)} Lebensdauer</h3>
          <label class="f"><span>Chats und Coworks dieses Projekts nach … Tagen löschen</span>
            <input type="number" min="0" max=${d.retention?.max || 3650} .value=${String(p.retention_days ?? d.retention?.default ?? 7)}
              @change=${(e: any) => this.set("retention_days", Number(e.target.value))}></label>
          <div class="hint" style="margin-top:6px">Gezählt ab der letzten Benutzung; danach wird der Chat samt Anhängen,
            Arbeitsbereich und Sandbox restlos gelöscht. <b>0</b> heißt unbegrenzt. Angeheftete Chats und die Läufe
            geplanter Aufgaben bleiben.</div></div>
        ${adv(html`<div class="card"><h3>${icon("key", 18)} ${t("Zugänge")}</h3><div class="chips">
          ${(d.credentials || []).map((c: any) => html`<button class=${(p.credentials || []).includes(c.id) ? "on" : ""} @click=${() => this.toggle("credentials", c.id)}>${c.name}</button>`)}
          ${!(d.credentials || []).length ? html`<span class="hint">Noch keine Zugänge angelegt.</span>` : nothing}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!p.credentials_only} @change=${(e: any) => this.set("credentials_only", e.target.checked)}> Nur diese Zugänge erlauben</label></div>
        ${d.external?.has_access || p.no_external ? html`<div class="card"><h3>${icon("euro", 18)} Externe Modelle</h3>
          <label class="row hint"><input type="checkbox" style="width:auto" .checked=${!!p.no_external} @change=${(e: any) => this.set("no_external", e.target.checked)}> Nie an kostenpflichtige externe Modelle senden</label>
          <div class="hint" style="margin-top:6px">Für Projekte mit sensiblen Inhalten: Chats und Aufgaben dieses Projekts laufen dann nur beim Hauptanbieter – auch im Notfall.</div></div>` : nothing}
        <div class="card"><h3>${icon("skill", 18)} ${t("Skills")}</h3><div class="chips">
          ${(d.skills || []).map((s: any) => html`<button class=${(p.skills || []).includes(s.id) ? "on" : ""} @click=${() => this.toggle("skills", s.id)}>${s.name}</button>`)}
          ${!(d.skills || []).length ? html`<span class="hint">Noch keine Skills angelegt.</span>` : nothing}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!p.skills_only} @change=${(e: any) => this.set("skills_only", e.target.checked)}> Nur diese Skills anbieten</label></div>
        ${simple ? nothing : html`<div class="card"><h3>${icon("sparkle", 18)} Modelle</h3>
          <label class="f"><span>Chat</span><select @change=${(e: any) => this.set("model_chat", e.target.value || null)}>
            <option value="">${defaultLabel("chat")}</option>${models.filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${p.model_chat === m.id}>${m.name}</option>`)}</select></label>
          <label class="f" style="margin-top:8px"><span>Cowork / Aufgaben</span><select @change=${(e: any) => this.set("model_agent", e.target.value || null)}>
            <option value="">${defaultLabel("agent")}</option>${models.filter((m: any) => !m.external).map((m: any) => html`<option value=${m.id} ?selected=${p.model_agent === m.id}>${m.name}</option>`)}</select></label></div>`}
        <div class="card"><h3>${icon("tools", 18)} ${t("Werkzeuge")} & Freigaben</h3>
          <div class="chips">${Object.entries(groups).filter(([g]) => !["files", "skills", "progress", "ha"].includes(g)).map(([g, info]: any) => {
            const on = p.tool_groups == null || p.tool_groups.includes(g);
            return html`<button class=${on ? "on" : ""} @click=${() => {
              const all = Object.keys(groups); const cur = new Set(p.tool_groups ?? all); cur.has(g) ? cur.delete(g) : cur.add(g); this.set("tool_groups", [...cur]); }}>${info.label}</button>`; })}</div>
          <div class="hint" style="margin:6px 0 0">${groups.ha?.label || "Home Assistant"} ist immer dabei; Schaltaktionen fragen wie unten eingestellt nach.</div>
          <div class="hint" style="margin:10px 0 6px">Schreibende Aktionen:</div>
          ${writeTools.map(([n, v]: any) => html`<div class="row" style="padding:3px 0;font-size:13px"><span class="grow">${v.label}</span>
            <select style="width:auto;padding:4px 6px" @change=${(e: any) => this.set("permissions", { ...(p.permissions || {}), [n]: e.target.value })}>
              ${[["ask", "fragen"], ["allow", "erlauben"], ["deny", "verbieten"]].map(([k, l]) => html`<option value=${k} ?selected=${((p.permissions || {})[n] || "ask") === k}>${l}</option>`)}</select></div>`)}</div>`)}
        <button class="btn danger" @click=${async () => { if (await confirmDialog(`Projekt „${p.name}“ löschen? Chats bleiben erhalten (ohne Projekt).`)) {
          try { await store.api.ws("project/delete", { project_id: p.id }); await store.load(); navigate("/projects"); } catch (e: any) { store.notify(e.message); } } }}>${icon("trash", 16)} Projekt löschen</button>
      </div></div>`}
      ${this.dirty && p.id ? html`<div class="savebar fade-in"><button class="btn" @click=${() => this.reload()}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}
