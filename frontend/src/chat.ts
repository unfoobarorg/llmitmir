// Chat / cowork / task-run view.
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { base, icon, md, fmtNum, fmtTime, fmtDuration, copyText, menuItemStyles, confirmDialog } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";
import type { SendDetail } from "./composer";
import "./composer";

const STATUS_TEXT: Record<string, string> = {
  queued: "In der Warteschlange …", thinking: "Denkt nach …", streaming: "Schreibt …", tool: "Arbeitet …",
  waiting_permission: "Wartet auf Freigabe", retry: "Modell ausgelastet – neuer Versuch", quota_wait: "Limit erreicht – wartet",
};

@customElement("lm-chat")
export class ChatView extends LitElement {
  @property() chatId = "";
  @property({ type: Boolean }) narrow = false;
  @state() private openSteps = new Set<string>();
  @state() private panel = false;
  @state() private editTitle = false;
  @state() private now = Date.now();
  @query(".scroll") private scroller!: HTMLElement;
  private stick = true;
  private _tick: any;
  private _onChange = () => { this.requestUpdate(); this.updateComplete.then(() => this.autoscroll()); };

  static styles = [base, menuItemStyles, css`
    :host { display: flex; height: 100%; min-height: 0; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; }
    header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; min-height: 52px; }
    header .title { font-weight: 560; font-size: 15px; padding: 6px 8px; border-radius: 8px; cursor: pointer; max-width: 60vw; }
    header .title:hover { background: var(--lm-hover); }
    header input { max-width: 420px; padding: 6px 8px; }
    .scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; scroll-behavior: smooth; }
    .thread { max-width: 780px; margin: 0 auto; padding: 10px 22px 30px; display: grid; gap: 22px; }
    .user { justify-self: end; max-width: min(85%, 640px); background: var(--lm-user); border-radius: 18px 18px 6px 18px;
      padding: 10px 15px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; font-size: 15.5px; animation: fadeIn .25s; }
    .att { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-bottom: 6px; }
    .att button { border: 1px solid var(--lm-line); background: var(--lm-raise); border-radius: 10px; padding: 4px 9px; font-size: 12.5px;
      cursor: pointer; display: inline-flex; gap: 5px; align-items: center; }
    .asst { display: grid; gap: 8px; animation: fadeIn .25s; }
    .meta { display: flex; align-items: center; gap: 2px; color: var(--lm-faint); font-size: 12px; opacity: 0; transition: opacity .2s; }
    .asst:hover .meta, .asst.last .meta { opacity: 1; }
    .meta .iconbtn { width: 30px; height: 30px; }
    .think { border-left: 2px solid var(--lm-line); padding: 2px 0 2px 12px; }
    .think summary { cursor: pointer; color: var(--lm-muted); font-size: 13px; list-style: none; display: flex; gap: 6px; align-items: center; }
    .think summary::-webkit-details-marker { display: none; }
    .think .txt { white-space: pre-wrap; color: var(--lm-muted); font-size: 13.5px; line-height: 1.55; margin-top: 6px; max-height: 320px; overflow-y: auto; }
    .steps { border: 1px solid var(--lm-line); border-radius: 14px; overflow: hidden; background: var(--lm-panel); }
    .step { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; font-size: 13.5px; }
    .step + .step, .step + .detail, .detail + .step { border-top: 1px solid var(--lm-line); }
    .step:hover { background: var(--lm-hover); }
    .step .lbl { font-weight: 520; } .step .arg { color: var(--lm-muted); }
    .step .st { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--lm-faint); font-size: 12px; flex: none; }
    .ok { color: var(--lm-ok); } .err { color: var(--lm-err); } .den { color: var(--lm-warn); }
    .detail { padding: 10px 12px 12px 40px; font-size: 12.5px; background: var(--lm-side); }
    .detail pre { margin: 4px 0 8px; white-space: pre-wrap; word-break: break-word; font-family: var(--lm-mono); font-size: 12px;
      max-height: 280px; overflow-y: auto; background: var(--lm-panel); border: 1px solid var(--lm-line); padding: 8px; border-radius: 8px; }
    .running { display: flex; align-items: center; gap: 10px; color: var(--lm-muted); font-size: 14px; padding: 4px 0; }
    .shimmer { background: linear-gradient(90deg, var(--lm-muted) 0%, var(--lm-text) 45%, var(--lm-muted) 90%); background-size: 200% 100%;
      -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 2.2s linear infinite; }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .caret { display: inline-block; width: 8px; height: 1.05em; background: var(--lm-accent); border-radius: 2px; vertical-align: text-bottom;
      margin-left: 2px; animation: caret 1s steps(2) infinite; }
    @keyframes caret { 50% { opacity: 0; } }
    .error { border: 1px solid color-mix(in srgb, var(--lm-err) 40%, var(--lm-line)); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel));
      border-radius: 12px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
    .perm { border: 1px solid color-mix(in srgb, var(--lm-accent) 45%, var(--lm-line)); background: var(--lm-panel); border-radius: 16px;
      padding: 14px 16px; box-shadow: var(--lm-shadow); animation: fadeIn .25s; display: grid; gap: 10px; }
    .perm pre { margin: 0; font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 180px;
      overflow-y: auto; background: var(--lm-side); padding: 8px 10px; border-radius: 8px; }
    .perm .row { flex-wrap: wrap; }
    .foot { padding: 0 16px 14px; max-width: 812px; margin: 0 auto; width: 100%; }
    .note { text-align: center; font-size: 11.5px; color: var(--lm-faint); margin-top: 6px; }
    aside { width: 320px; border-left: 1px solid var(--lm-line); background: var(--lm-bg); overflow-y: auto; padding: 14px; flex: none;
      display: grid; align-content: start; gap: 14px; }
    aside h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .prog { display: grid; gap: 6px; }
    .prog div { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; line-height: 1.4; }
    .prog .done { color: var(--lm-muted); text-decoration: line-through; text-decoration-color: var(--lm-faint); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--lm-accent-soft); border-top-color: var(--lm-accent); border-radius: 50%;
      animation: rot .8s linear infinite; flex: none; margin-top: 1px; }
    @keyframes rot { to { transform: rotate(360deg); } }
    .fl { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 9px; cursor: pointer; font-size: 13px; }
    .fl:hover { background: var(--lm-hover); }
    .sheet { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; animation: fadeIn .15s; }
    .sheet aside { width: min(360px, 88vw); height: 100%; border: 0; box-shadow: -10px 0 40px rgba(0,0,0,.2); background: var(--lm-bg); }
    .empty { text-align: center; color: var(--lm-muted); padding: 60px 20px; }
    .taskinfo { font-size: 13px; color: var(--lm-muted); background: var(--lm-side); border-radius: 12px; padding: 10px 12px; display: flex; gap: 8px; }
    @media (max-width: 640px) { .thread { padding: 8px 14px 24px; gap: 18px; } .foot { padding: 0 10px 10px; } header { padding: 6px 6px; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    store.addEventListener("change", this._onChange);
    this._tick = setInterval(() => { if (store.runs[this.chatId]) this.now = Date.now(); }, 1000);
  }
  disconnectedCallback() { super.disconnectedCallback(); store.removeEventListener("change", this._onChange); clearInterval(this._tick); }

  updated(ch: Map<string, any>) {
    if (ch.has("chatId") && this.chatId) {
      this.stick = true;
      store.loadChat(this.chatId, true).then(() => this.updateComplete.then(() => this.autoscroll(true))).catch(e => store.notify(String(e.message || e)));
    }
  }

  private autoscroll(force = false) {
    const s = this.scroller; if (!s) return;
    if (force || this.stick) { s.style.scrollBehavior = force ? "auto" : "smooth"; s.scrollTop = s.scrollHeight; }
  }
  private onScroll() { const s = this.scroller; this.stick = s.scrollHeight - s.scrollTop - s.clientHeight < 120; }

  private get chat() { return store.chats.get(this.chatId); }

  private async send(e: CustomEvent<SendDetail>) {
    const d = e.detail; const chat = this.chat; if (!chat) return;
    try {
      let names: string[] = [];
      if (d.files.length) names = (await store.api.upload("chat", chat.id, d.files)).files.map((f: any) => f.name);
      this.stick = true;
      await store.api.ws("chat/send", { chat_id: chat.id, text: d.text || "(siehe Anhang)", attachments: names, model: d.model,
        ...(chat.kind === "chat" ? { tools: d.tools } : {}) });
    } catch (err: any) { store.notify(String(err.message || err)); }
  }

  private stop() { store.api.ws("chat/stop", { chat_id: this.chatId }); }
  private retry() { store.api.ws("chat/retry", { chat_id: this.chatId }).then(r => { store.chats.set(this.chatId, r.chat); store.changed(); }).catch(e => store.notify(e.message)); }

  private async openFile(name: string) {
    try { window.open(await store.api.fileUrl("chat", this.chatId, name), "_blank"); } catch (e: any) { store.notify(e.message); }
  }

  private stepRow(m: any) {
    const open = this.openSteps.has(m.id);
    const a = m.args || {};
    const argText = a.anfrage || a.url || a.pfad || a.name || a.entity_id || a.filter || a.typ || (a.domain ? `${a.domain}.${a.service}` : "") || "";
    const st = m.status;
    return html`<div class="step" @click=${() => { const s = new Set(this.openSteps); open ? s.delete(m.id) : s.add(m.id); this.openSteps = s; }}>
        ${icon(m.icon || "tools", 18)}<span class="lbl">${m.label || m.name}</span><span class="arg ellipsis">${argText ? `· ${String(argText).slice(0, 80)}` : ""}</span>
        <span class="st">${st === "running" ? html`<span class="spin"></span>` : st === "ok" ? html`<span class="ok">${icon("check", 16)}</span>`
          : st === "denied" ? html`<span class="den">${icon("lock", 16)}</span>` : html`<span class="err">${icon("alert", 16)}</span>`}
          ${m.ms ? (m.ms > 1000 ? (m.ms / 1000).toFixed(1).replace(".", ",") + " s" : m.ms + " ms") : ""}${icon(open ? "down" : "right", 16)}</span></div>
      ${open ? html`<div class="detail"><b>Eingabe</b><pre>${JSON.stringify(m.args || {}, null, 2)}</pre>
        ${m.content ? html`<b>Ergebnis</b><pre>${m.content.slice(0, 6000)}${m.content.length > 6000 ? "\n…" : ""}</pre>` : nothing}</div>` : nothing}`;
  }

  private renderMessages(chat: any, run: any) {
    const out: any[] = [];
    const msgs = chat.messages || [];
    const showThink = store.data?.settings?.show_reasoning !== false;
    let i = 0;
    const lastAsst = [...msgs].reverse().find((m: any) => m.role === "assistant" && (m.content || m.error));
    while (i < msgs.length) {
      const m = msgs[i];
      if (m.role === "user") {
        out.push(html`${m.attachments?.length ? html`<div class="att">${m.attachments.map((a: string) => html`<button @click=${() => this.openFile(a)}>${icon("file", 15)}${a}</button>`)}</div>` : nothing}
          <div class="user">${m.content}</div>`);
        i++; continue;
      }
      if (m.role === "tool") {
        const group: any[] = [];
        while (i < msgs.length && msgs[i].role === "tool") { group.push(msgs[i]); i++; }
        out.push(html`<div class="steps">${group.map(g => this.stepRow(g))}</div>`);
        continue;
      }
      // assistant
      const streaming = m.streaming && run;
      const last = m === lastAsst;
      out.push(html`<div class="asst ${last ? "last" : ""}">
        ${m.reasoning && showThink ? html`<details class="think" ?open=${streaming && !m.content}><summary>${icon("brain", 16)} ${streaming && !m.content ? html`<span class="shimmer">${t("Denkt nach …")}</span>` : t("Gedanken")}</summary>
          <div class="txt">${m.reasoning}</div></details>` : nothing}
        ${m.content ? html`<div class="md">${md(m.content)}${streaming ? html`<span class="caret"></span>` : nothing}</div>` : nothing}
        ${m.error ? html`<div class="error">${icon("alert")}<div class="grow"><b>Das hat nicht geklappt.</b><div>${m.error}</div></div>
          <button class="btn" @click=${() => this.retry()}>${icon("retry", 16)} ${t("Erneut versuchen")}</button></div>` : nothing}
        ${(m.content || m.error) && !streaming ? html`<div class="meta">
          ${m.content ? html`<button class="iconbtn" title=${t("Kopieren")} @click=${() => copyText(m.content)}>${icon("copy", 16)}</button>` : nothing}
          ${last && !run ? html`<button class="iconbtn" title=${t("Erneut versuchen")} @click=${() => this.retry()}>${icon("retry", 16)}</button>` : nothing}
          <span>${(store.data?.models || []).find((x: any) => x.id === m.model)?.name || m.model || ""}${m.usage?.completion ? ` · ${fmtNum(m.usage.completion)} Tokens` : ""} · ${fmtTime(m.created)}</span></div>` : nothing}
      </div>`);
      i++;
    }
    return out;
  }

  private runIndicator(run: any, chat: any) {
    if (!run) return nothing;
    const lastMsg = chat.messages[chat.messages.length - 1];
    if (run.status === "streaming" && lastMsg?.streaming && lastMsg?.content) return nothing;
    if (run.status === "waiting_permission") return nothing;
    const d = run.detail || {};
    let text = STATUS_TEXT[run.status] || "Arbeitet …";
    if (run.status === "tool") text = (d.label || "Werkzeug") + " …";
    if (run.status === "retry") text = `Modell ausgelastet – neuer Versuch in ${d.seconds} s (Versuch ${d.attempt})`;
    if (run.status === "quota_wait") text = `Limit des Schlüssels erreicht – geht in ${fmtDuration(d.seconds)} weiter`;
    const el = (this.now / 1000) - (run.started || this.now / 1000);
    return html`<div class="running"><lm-spark></lm-spark><span class="shimmer">${text}</span>
      ${el > 20 ? html`<span class="muted" style="font-size:12px">· ${fmtDuration(el)}</span>` : nothing}</div>`;
  }

  private permCards() {
    return store.permissions.filter(p => p.chat_id === this.chatId).map(p => html`<div class="perm">
      <div class="row">${icon(p.icon || "lock")}<b class="grow">LLMitMir möchte: ${p.label}</b></div>
      <pre>${JSON.stringify(p.args || {}, null, 2)}</pre>
      <div class="row">
        <button class="btn primary" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "once" })}>${t("Einmal erlauben")}</button>
        <button class="btn" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "always" })}>${t("Immer erlauben")}</button>
        <button class="btn ghost danger" @click=${() => store.api.ws("permission/answer", { permission_id: p.id, decision: "deny" })}>${t("Ablehnen")}</button>
      </div><div class="hint">„Immer erlauben“ gilt ${this.chat?.project_id ? "für dieses Projekt" : "für alle Chats ohne Projekt"} und lässt sich in den Einstellungen zurücknehmen.</div></div>`);
  }

  private side(chat: any) {
    const files = store.chatFiles.get(chat.id) || [];
    const prog = chat.progress || [];
    const proj = (store.data?.projects || []).find((p: any) => p.id === chat.project_id);
    const u = chat.usage || {};
    return html`<aside>
      ${this.narrow ? html`<div class="row"><b class="grow">Details</b><button class="iconbtn" @click=${() => (this.panel = false)}>${icon("close")}</button></div>` : nothing}
      <div><h3>${icon("list", 18)} ${t("Fortschritt")}</h3>
        ${prog.length ? html`<div class="prog">${prog.map((p: any) => html`<div>
          ${p.status === "erledigt" ? html`<span class="ok">${icon("check", 18)}</span>` : p.status === "laeuft" ? html`<span class="spin"></span>`
            : p.status === "fehler" ? html`<span class="err">${icon("alert", 18)}</span>` : html`<span class="muted">${icon("mdi:circle-outline", 18)}</span>`}
          <span class=${p.status === "erledigt" ? "done" : ""}>${p.text}</span></div>`)}</div>`
          : html`<div class="hint">Der Plan erscheint hier, sobald das Modell ihn anlegt.</div>`}</div>
      <div><h3>${icon("file", 18)} ${t("Dateien")}</h3>
        ${files.length ? files.map((f: any) => html`<div class="fl" @click=${() => this.openFile(f.name)}>${icon("file", 18)}<span class="grow ellipsis">${f.name}</span>
          <span class="muted" style="font-size:11.5px">${fmtNum(f.size)} B</span>${icon("download", 16)}</div>`) : html`<div class="hint">Noch keine Dateien.</div>`}</div>
      <div><h3>${icon("info", 18)} Info</h3><div class="hint" style="display:grid;gap:4px">
        ${proj ? html`<span>${t("Projekte")}: <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate(`/project/${proj.id}`); }}>${proj.name}</a></span>` : nothing}
        <span>${t("Modell")}: ${(store.data?.models || []).find((x: any) => x.id === chat.model)?.name || chat.model}</span>
        <span>Anfragen: ${u.requests || 0} · Tokens: ${fmtNum((u.prompt || 0) + (u.completion || 0))}</span>
        <span>Erstellt: ${fmtTime(chat.created)}</span></div></div>
    </aside>`;
  }

  private async rename(v: string) {
    this.editTitle = false;
    if (v.trim() && v !== this.chat.title) await store.api.ws("chat/update", { chat_id: this.chatId, title: v.trim() });
  }

  render() {
    const chat = this.chat;
    if (!chat) return html`<div class="main"><div class="empty"><lm-spark></lm-spark><p>${t("Laden …")}</p></div></div>`;
    const run = store.runs[chat.id];
    const isWork = chat.kind !== "chat";
    const task = chat.task_id ? (store.data?.tasks || []).find((x: any) => x.id === chat.task_id) : null;
    const proj = (store.data?.projects || []).find((p: any) => p.id === chat.project_id);
    return html`<div class="main">
      <header>
        <slot name="menu"></slot>
        ${this.editTitle ? html`<input .value=${chat.title || ""} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.rename((e.target as HTMLInputElement).value); if (e.key === "Escape") this.editTitle = false; }}
            @blur=${(e: any) => this.rename(e.target.value)} autofocus>`
          : html`<span class="title ellipsis" @click=${() => (this.editTitle = true)}>${chat.title || t("Neuer Chat")}</span>`}
        ${isWork ? html`<span class="chip accent">${icon(chat.kind === "task_run" ? "task" : "cowork", 14)} ${chat.kind === "task_run" ? "Aufgabe" : "Cowork"}</span>` : nothing}
        ${proj && !this.narrow ? html`<span class="chip" style="cursor:pointer" @click=${() => navigate(`/project/${proj.id}`)}>${icon("project", 14)} ${proj.name}</span>` : nothing}
        <span class="grow"></span>
        ${isWork && this.narrow ? html`<button class="iconbtn" @click=${() => (this.panel = true)} title="Details">${icon("panel")}</button>` : nothing}
        <lm-menu direction="down" align="right"><button slot="trigger" class="iconbtn">${icon("dots")}</button>
          <button class="mi" data-close @click=${() => (this.editTitle = true)}>${icon("edit", 18)} ${t("Umbenennen")}</button>
          <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, pinned: !chat.pinned })}>${icon(chat.pinned ? "pinOff" : "pin", 18)} ${chat.pinned ? t("Lösen") : t("Anheften")}</button>
          <div class="mh">In Projekt verschieben</div>
          <button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, project_id: null })}>${icon("chat", 18)} Ohne Projekt</button>
          ${(store.data?.projects || []).map((p: any) => html`<button class="mi" data-close @click=${() => store.api.ws("chat/update", { chat_id: chat.id, project_id: p.id })}>${icon("project", 18)} ${p.name}</button>`)}
          <div class="msep"></div>
          <button class="mi" style="color:var(--lm-err)" data-close @click=${async () => { if (await confirmDialog("Diesen Chat endgültig löschen?")) { await store.api.ws("chat/delete", { chat_id: chat.id }); navigate("/"); } }}>${icon("trash", 18)} ${t("Löschen")}</button>
        </lm-menu>
      </header>
      <div class="scroll" @scroll=${this.onScroll}><div class="thread">
        ${task ? html`<div class="taskinfo">${icon("task", 18)}<span>Lauf der geplanten Aufgabe <a href="#" @click=${(e: Event) => { e.preventDefault(); navigate(`/task/${task.id}`); }}>${task.name}</a>.
          Open-Weight-Modelle können verzögert starten und länger laufen.</span></div>` : nothing}
        ${chat.messages.length === 0 && !run ? html`<div class="empty">${isWork ? "Beschreibe die Aufgabe – LLMitMir plant und arbeitet sie selbstständig ab." : "Schreib einfach los."}</div>` : nothing}
        ${this.renderMessages(chat, run)}
        ${this.permCards()}
        ${this.runIndicator(run, chat)}
      </div></div>
      <div class="foot">
        <lm-composer .mode=${chat.kind === "chat" ? "chat" : "cowork"} .model=${chat.model} .busy=${!!run} .chatUsage=${chat.usage}
          .tools=${chat.tools ?? null} .projectId=${chat.project_id}
          placeholder=${run ? "Antwort läuft – du kannst schon weiterschreiben …" : t("Antworten …")}
          @send=${this.send} @stop=${this.stop}></lm-composer>
        <div class="note">${chat.kind === "task_run" ? "Antworten in diesem Lauf laufen als normaler Cowork weiter." : "KI kann Fehler machen. Wichtiges bitte prüfen."}</div>
      </div>
    </div>
    ${isWork && !this.narrow ? this.side(chat) : nothing}
    ${isWork && this.narrow && this.panel ? html`<div class="sheet" @click=${(e: Event) => e.target === e.currentTarget && (this.panel = false)}>${this.side(chat)}</div>` : nothing}`;
  }
}
