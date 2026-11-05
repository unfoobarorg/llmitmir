// Home (new chat/cowork), chat list, projects and project detail.
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { base, icon, fmtTime, confirmDialog } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";
import type { SendDetail } from "./composer";

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

@customElement("lm-home")
export class Home extends LitElement {
  @property() initialMode: "chat" | "cowork" = "chat";
  @property() projectId: string | null = null;
  @state() private mode: "chat" | "cowork" = "chat";
  @state() private model = "";
  @state() private busy = false;
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
  updated(ch: Map<string, any>) { if (ch.has("initialMode")) { this.mode = this.initialMode; this.pickModel(); } }
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
    this.mode = mode; this.pickModel();
    const c = this.renderRoot.querySelector("lm-composer") as any;
    c?.setText(text); c?.focus();
  }
  render() {
    const d = store.data;
    const name = (d?.user?.name || "").split(" ")[0];
    const u = d?.usage;
    return html`<div class="wrap">
      ${u && !u.has_key ? html`<div class="card nokey row">${icon("key")}<div class="grow">${d.key_mode === "per_user_own"
        ? html`Trag zuerst deinen API-Schlüssel ein.` : html`Es ist noch kein API-Schlüssel hinterlegt. ${d.user.is_admin ? "Lege ihn unter Admin fest." : "Bitte den Admin, einen einzutragen."}`}</div>
        <button class="btn" @click=${() => navigate(d.key_mode === "per_user_own" ? "/settings" : "/admin")}>Öffnen</button></div>` : nothing}
      <h1><lm-spark size="34" .active=${false}></lm-spark>${greeting()}${name ? `, ${name}` : ""}</h1>
      <lm-composer big showMode showProject .mode=${this.mode} .model=${this.model} .projectId=${this.projectId} .busy=${this.busy}
        placeholder=${this.mode === "cowork" ? t("Was soll ich erledigen?") : t("Wie kann ich helfen?")}
        @mode=${(e: CustomEvent) => { this.mode = e.detail; }} @model=${(e: CustomEvent) => (this.model = e.detail)}
        @project=${(e: CustomEvent) => { this.projectId = e.detail; this.pickModel(); }} @send=${this.send}></lm-composer>
      <div class="sugg">
        ${this.mode === "chat" ? html`
          <button @click=${() => this.fill("Erkläre mir verständlich: ", "chat")}>${icon("sparkle", 16)} Erklären</button>
          <button @click=${() => this.fill("Formuliere diese E-Mail freundlich und knapp um:\n\n", "chat")}>${icon("edit", 16)} Text überarbeiten</button>
          <button @click=${() => this.fill("Suche im Web nach ", "chat")}>${icon("web", 16)} Im Web suchen</button>`
        : html`
          <button @click=${() => this.fill("Wie ist der Zustand im Haus? Prüfe Heizung, offene Fenster und auffällige Sensoren und fasse zusammen.", "cowork")}>${icon("home", 16)} Hausstatus</button>
          <button @click=${() => this.fill("Lies die Dateien im Ordner … meines Zugangs … und erstelle eine Übersicht als Tabelle.", "cowork")}>${icon("cloud", 16)} Dateien auswerten</button>
          <button @click=${() => this.fill("Recherchiere zu … und schreibe eine kurze Zusammenfassung mit Quellen in eine Datei.", "cowork")}>${icon("search", 16)} Recherche</button>`}
      </div>
      <div class="info">${d?.provider?.name || ""} · Open-Weight-Modelle – Antworten können je nach Auslastung dauern.</div>
    </div>`;
  }
}

// ---------------------------------------------------------------- all chats
@customElement("lm-chats")
export class Chats extends LitElement {
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
      <div class="tabs">${[["all", t("Alle")], ["chat", "Chats"], ["cowork", "Coworks"], ["task_run", t("Aufgabenläufe")]].map(([k, l]) =>
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
@customElement("lm-projects")
export class Projects extends LitElement {
  static styles = [base, css`:host { display: block; height: 100%; overflow-y: auto; }
    .pc { padding: 16px; min-height: 120px; display: grid; align-content: start; gap: 6px; }
    .pc b { font-size: 15px; } .new { border-style: dashed; justify-content: center; color: var(--lm-muted); }`];
  private async create() {
    const p = await store.api.ws("project/save", { project: { name: "Neues Projekt", instructions: "" } });
    await store.load(); navigate(`/project/${p.id}`);
  }
  render() {
    const ps = store.data?.projects || [];
    const count = (id: string) => (store.data?.chats || []).filter((c: any) => c.project_id === id).length;
    return html`<div class="page"><div class="row"><h1 class="grow">${t("Projekte")}</h1>
      <button class="btn primary" @click=${this.create}>${icon("plus", 18)} ${t("Neues Projekt")}</button></div>
      <p class="hint">Projekte bündeln Anweisungen, Dateien, Zugänge und Skills. Chats und Coworks darin starten mit diesem Kontext.</p>
      <div class="grid">${ps.map((p: any) => html`<div class="item pc" @click=${() => navigate(`/project/${p.id}`)}>
        <div class="row">${icon("project")}<b class="grow ellipsis">${p.name}</b></div>
        <div class="hint" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${p.description || (p.instructions || "").slice(0, 160) || "Noch keine Anweisungen."}</div>
        <div class="row" style="margin-top:auto"><span class="chip">${count(p.id)} Chats</span>${(p.credentials || []).length ? html`<span class="chip">${icon("key", 13)} ${(p.credentials || []).length}</span>` : nothing}
          ${(p.skills || []).length ? html`<span class="chip">${icon("skill", 13)} ${(p.skills || []).length}</span>` : nothing}</div></div>`)}
        <div class="item pc new" @click=${this.create}>${icon("plus")} ${t("Neues Projekt")}</div></div></div>`;
  }
}

@customElement("lm-project")
export class ProjectPage extends LitElement {
  @property() projectId = "";
  @state() private draft: any = null;
  @state() private files: any[] = [];
  @state() private dirty = false;
  static styles = [base, css`:host { display: block; height: 100%; overflow-y: auto; }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
    .side { display: grid; gap: 14px; }
    .side .card h3 { margin: 0 0 10px; font-size: 13.5px; display: flex; gap: 6px; align-items: center; }
    .title { font-family: var(--lm-head); font-weight: 650; font-size: 26px; border: 0; background: transparent; padding: 2px 0; box-shadow: none !important; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--lm-line); background: var(--lm-panel); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; }
    .chips button.on { background: var(--lm-accent-soft); border-color: transparent; color: var(--lm-accent); }
    .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }`];
  updated(ch: Map<string, any>) {
    if (ch.has("projectId")) this.reload();
  }
  private async reload() {
    const p = (store.data?.projects || []).find((x: any) => x.id === this.projectId);
    this.draft = p ? JSON.parse(JSON.stringify(p)) : null; this.dirty = false;
    if (p) this.files = await store.api.ws("files", { scope: "project", owner: p.id });
  }
  private set(k: string, v: any) { this.draft = { ...this.draft, [k]: v }; this.dirty = true; }
  private toggle(k: string, id: string) {
    const s = new Set(this.draft[k] || []); s.has(id) ? s.delete(id) : s.add(id); this.set(k, [...s]);
  }
  private async save() {
    await store.api.ws("project/save", { project: this.draft }); this.dirty = false; store.notify(t("Gespeichert")); await store.load();
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
    const writeTools = Object.entries(d.tools || {}).filter(([, v]: any) => v.write);
    return html`<div class="page">
      <div class="row"><button class="iconbtn" @click=${() => navigate("/projects")}>${icon("left")}</button>
        <input class="title grow" .value=${p.name} @input=${(e: any) => this.set("name", e.target.value)}></div>
      <input style="margin:4px 0 18px" placeholder="Kurzbeschreibung" .value=${p.description || ""} @input=${(e: any) => this.set("description", e.target.value)}>
      <div class="cols"><div>
        <lm-composer showMode .projectId=${p.id} .mode=${"chat"} .model=${p.model_chat || d.defaults.chat} placeholder="Neuer Chat in diesem Projekt …"
          @send=${async (e: CustomEvent) => { try { await startChat({ ...e.detail, project_id: p.id }); } catch (err: any) { store.notify(err.message); } }}></lm-composer>
        <h2>Chats & Coworks</h2>
        <div class="list">${chats.length ? chats.map((c: any) => html`<div class="item" @click=${() => navigate(`/chat/${c.id}`)}>
          ${icon(c.kind === "chat" ? "chat" : c.kind === "cowork" ? "cowork" : "task")}<div class="grow ellipsis">${c.title}</div><span class="hint">${fmtTime(c.updated)}</span></div>`)
          : html`<div class="hint">Noch keine Chats in diesem Projekt.</div>`}</div>
        <h2>${t("Anweisungen")}</h2>
        <textarea rows="12" placeholder="Was soll das Modell in diesem Projekt immer wissen und beachten? (Rolle, Ziele, Regeln, Formate …)"
          .value=${p.instructions || ""} @input=${(e: any) => this.set("instructions", e.target.value)}></textarea>
      </div>
      <div class="side">
        <div class="card"><h3>${icon("file", 18)} ${t("Dateien")}</h3>
          ${this.files.map(f => html`<div class="row" style="padding:4px 0"><span class="grow ellipsis" style="font-size:13px">${f.name}</span>
            <button class="iconbtn" @click=${async () => window.open(await store.api.fileUrl("project", p.id, f.name), "_blank")}>${icon("download", 16)}</button>
            <button class="iconbtn" @click=${async () => { this.files = await store.api.ws("file/delete", { scope: "project", owner: p.id, name: f.name }); }}>${icon("trash", 16)}</button></div>`)}
          <label class="btn" style="margin-top:6px">${icon("upload", 16)} Hochladen<input type="file" multiple hidden @change=${this.upload}></label>
          <div class="hint" style="margin-top:6px">Das Modell liest sie bei Bedarf mit „Datei lesen“ (Bereich Projekt).</div></div>
        <div class="card"><h3>${icon("key", 18)} ${t("Zugänge")}</h3><div class="chips">
          ${(d.credentials || []).map((c: any) => html`<button class=${(p.credentials || []).includes(c.id) ? "on" : ""} @click=${() => this.toggle("credentials", c.id)}>${c.name}</button>`)}
          ${!(d.credentials || []).length ? html`<span class="hint">Noch keine Zugänge angelegt.</span>` : nothing}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!p.credentials_only} @change=${(e: any) => this.set("credentials_only", e.target.checked)}> Nur diese Zugänge erlauben</label></div>
        <div class="card"><h3>${icon("skill", 18)} ${t("Skills")}</h3><div class="chips">
          ${(d.skills || []).map((s: any) => html`<button class=${(p.skills || []).includes(s.id) ? "on" : ""} @click=${() => this.toggle("skills", s.id)}>${s.name}</button>`)}
          ${!(d.skills || []).length ? html`<span class="hint">Noch keine Skills angelegt.</span>` : nothing}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!p.skills_only} @change=${(e: any) => this.set("skills_only", e.target.checked)}> Nur diese Skills anbieten</label></div>
        <div class="card"><h3>${icon("sparkle", 18)} Modelle</h3>
          <label class="f"><span>Chat</span><select @change=${(e: any) => this.set("model_chat", e.target.value || null)}>
            <option value="">Standard (${d.defaults.chat})</option>${models.map((m: any) => html`<option value=${m.id} ?selected=${p.model_chat === m.id}>${m.name}</option>`)}</select></label>
          <label class="f" style="margin-top:8px"><span>Cowork / Aufgaben</span><select @change=${(e: any) => this.set("model_agent", e.target.value || null)}>
            <option value="">Standard (${d.defaults.agent})</option>${models.map((m: any) => html`<option value=${m.id} ?selected=${p.model_agent === m.id}>${m.name}</option>`)}</select></label></div>
        <div class="card"><h3>${icon("tools", 18)} ${t("Werkzeuge")} & Freigaben</h3>
          <div class="chips">${Object.entries(groups).filter(([g]) => !["files", "skills", "progress"].includes(g)).map(([g, info]: any) => {
            const on = p.tool_groups == null || p.tool_groups.includes(g);
            return html`<button class=${on ? "on" : ""} @click=${() => {
              const all = Object.keys(groups); const cur = new Set(p.tool_groups ?? all); cur.has(g) ? cur.delete(g) : cur.add(g); this.set("tool_groups", [...cur]); }}>${info.label}</button>`; })}</div>
          <div class="hint" style="margin:10px 0 6px">Schreibende Aktionen:</div>
          ${writeTools.map(([n, v]: any) => html`<div class="row" style="padding:3px 0;font-size:13px"><span class="grow">${v.label}</span>
            <select style="width:auto;padding:4px 6px" @change=${(e: any) => this.set("permissions", { ...(p.permissions || {}), [n]: e.target.value })}>
              ${[["ask", "fragen"], ["allow", "erlauben"], ["deny", "verbieten"]].map(([k, l]) => html`<option value=${k} ?selected=${((p.permissions || {})[n] || "ask") === k}>${l}</option>`)}</select></div>`)}</div>
        <button class="btn danger" @click=${async () => { if (await confirmDialog(`Projekt „${p.name}“ löschen? Chats bleiben erhalten (ohne Projekt).`)) {
          await store.api.ws("project/delete", { project_id: p.id }); navigate("/projects"); } }}>${icon("trash", 16)} Projekt löschen</button>
      </div></div>
      ${this.dirty ? html`<div class="savebar fade-in"><button class="btn" @click=${() => this.reload()}>${t("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${icon("check", 16)} ${t("Speichern")}</button></div>` : nothing}
    </div>`;
  }
}
