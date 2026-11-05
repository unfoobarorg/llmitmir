// The message composer: textarea, attachments, voice, mode, tools, model picker and usage meters.
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { base, icon, menuItemStyles, fmtNum, fmtDuration, VoiceRecorder } from "./ui";
import { store } from "./api";
import { t } from "./i18n";

export interface SendDetail { text: string; files: File[]; model: string; mode: "chat" | "cowork"; tools: string[] | null; project_id: string | null; }

@customElement("lm-composer")
export class Composer extends LitElement {
  @property() placeholder = "";
  @property() mode: "chat" | "cowork" = "chat";
  @property({ type: Boolean }) showMode = false;
  @property({ type: Boolean }) showProject = false;
  @property() projectId: string | null = null;
  @property() model = "";
  @property({ type: Boolean }) busy = false;
  @property({ type: Object }) chatUsage: any = null;
  @property({ type: Array }) tools: string[] | null = null;
  @property({ type: Boolean }) big = false;
  @state() private text = "";
  @state() private files: File[] = [];
  @state() private rec: VoiceRecorder | null = null;
  @state() private recStart = 0;
  @state() private recLevel = 0;
  @state() private transcribing = false;
  @state() private drag = false;
  @query("textarea") private ta!: HTMLTextAreaElement;
  private _raf = 0;

  static styles = [base, menuItemStyles, css`
    :host { display: block; }
    .box { background: var(--lm-raise); border: 1px solid var(--lm-line); border-radius: 22px; box-shadow: var(--lm-shadow);
      padding: 12px 12px 8px 16px; transition: border-color .2s, box-shadow .2s; position: relative; }
    .box:focus-within { border-color: color-mix(in srgb, var(--lm-accent) 45%, var(--lm-line)); }
    .box.drag { border-color: var(--lm-accent); box-shadow: 0 0 0 4px var(--lm-accent-soft); }
    textarea { border: 0; background: transparent; padding: 4px 0; resize: none; min-height: 28px; max-height: 40vh; font-size: 16px;
      line-height: 1.5; box-shadow: none !important; }
    .big textarea { min-height: 56px; }
    .bar { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: nowrap; }
    .send { width: 36px; height: 36px; border-radius: 11px; border: 0; background: var(--lm-accent); color: #fff; display: grid;
      place-items: center; cursor: pointer; transition: transform .12s, background .15s, opacity .15s; flex: none; }
    .send:hover { background: var(--lm-accent-2); } .send:active { transform: scale(.94); }
    .send[disabled] { opacity: .35; cursor: default; }
    .send.stop { background: var(--lm-text); color: var(--lm-bg); }
    .seg { display: inline-flex; background: var(--lm-hover); border-radius: 10px; padding: 3px; gap: 2px; }
    .seg button { border: 0; background: none; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--lm-muted);
      display: inline-flex; gap: 5px; align-items: center; }
    .seg button.on { background: var(--lm-raise); color: var(--lm-text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .model { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--lm-muted); font-size: 13px;
      padding: 6px 8px; border-radius: 9px; cursor: pointer; max-width: 210px; }
    .model:hover { background: var(--lm-hover); color: var(--lm-text); }
    .files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .file { display: inline-flex; align-items: center; gap: 6px; background: var(--lm-hover); border-radius: 10px; padding: 5px 6px 5px 10px;
      font-size: 12.5px; max-width: 240px; animation: fadeIn .2s; }
    .file button { border: 0; background: none; cursor: pointer; color: var(--lm-muted); display: grid; }
    .meter { display: inline-flex; align-items: center; gap: 2px; border: 0; background: none; padding: 6px; border-radius: 9px; cursor: pointer; }
    .meter:hover { background: var(--lm-hover); }
    .stats { padding: 8px 10px; font-size: 13px; display: grid; gap: 10px; min-width: 270px; }
    .stats .bar2 { height: 6px; border-radius: 4px; background: var(--lm-hover); overflow: hidden; margin-top: 4px; }
    .stats .bar2 i { display: block; height: 100%; background: var(--lm-accent); border-radius: 4px; transition: width .5s; }
    .stats .bar2 i.w { background: var(--lm-warn); } .stats .bar2 i.e { background: var(--lm-err); }
    .stats .k { display: flex; justify-content: space-between; gap: 10px; }
    .rec { display: flex; align-items: center; gap: 12px; padding: 6px 2px; }
    .wave { display: flex; align-items: center; gap: 3px; height: 28px; flex: 1; }
    .wave i { width: 3px; border-radius: 2px; background: var(--lm-accent); transition: height .1s; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--lm-err); animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: .3; } }
    .badge { font-size: 10.5px; padding: 1px 6px; border-radius: 6px; background: var(--lm-hover); color: var(--lm-muted); margin-left: 4px; }
    .tool-on { color: var(--lm-accent); }
    @media (max-width: 640px) {
      .box { border-radius: 18px; padding: 10px 10px 6px 12px; }
      .model { max-width: 96px; padding: 6px 4px; } .hide-s { display: none; }
      .bar { gap: 1px; } .iconbtn { width: 32px; } .seg button { padding: 5px 7px; } .meter { padding: 4px; }
    }
  `];

  private get models(): any[] { return store.data?.models || []; }
  private get modelInfo() { return this.models.find(m => m.id === this.model) || { id: this.model, name: this.model }; }

  focus() { this.ta?.focus(); }
  setText(v: string) { this.text = v; this.updateComplete.then(() => this.autosize()); }

  private autosize() {
    const ta = this.ta; if (!ta) return;
    ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.4) + "px";
  }

  private send() {
    if (this.busy) { this.dispatchEvent(new CustomEvent("stop")); return; }
    const text = this.text.trim();
    if (!text && !this.files.length) return;
    const d: SendDetail = { text, files: this.files, model: this.model, mode: this.mode, tools: this.tools, project_id: this.projectId };
    this.dispatchEvent(new CustomEvent<SendDetail>("send", { detail: d }));
    this.text = ""; this.files = [];
    this.updateComplete.then(() => this.autosize());
  }

  private key(e: KeyboardEvent) {
    const enterSends = store.data?.settings?.send_on_enter !== false;
    const touch = matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && enterSends && !touch) {
      e.preventDefault();
      if (!this.busy) this.send();  // never stop a running answer by pressing Enter
    }
  }

  private addFiles(list: FileList | File[] | null) {
    if (!list) return;
    this.files = [...this.files, ...Array.from(list)].slice(0, 10);
  }

  private async toggleRec() {
    if (this.rec) return this.stopRec(true);
    if (!VoiceRecorder.supported()) return this.webSpeech();
    try {
      const r = new VoiceRecorder(); await r.start();
      this.rec = r; this.recStart = Date.now();
      const tick = () => { if (!this.rec) return; this.recLevel = this.rec.level; this._raf = requestAnimationFrame(tick); };
      tick();
    } catch (e: any) {
      const blocked = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      store.notify(blocked
        ? "Mikrofon gesperrt. Ist die Berechtigung erteilt, blockiert vermutlich der Webserver (Header Permissions-Policy: microphone=()) – dort microphone=(self) erlauben."
        : "Mikrofon nicht verfügbar: " + (e?.message || e));
    }
  }

  private async stopRec(use: boolean) {
    const r = this.rec; if (!r) return;
    this.rec = null; cancelAnimationFrame(this._raf);
    if (!use) { r.cancel(); return; }
    const wav = await r.stop();
    if (wav.size < 8000) return;
    this.transcribing = true;
    try {
      const txt = await store.api.transcribe(wav);
      if (txt) this.setText((this.text ? this.text.trimEnd() + " " : "") + txt);
      this.focus();
    } catch (e: any) { store.notify(String(e?.message || e)); }
    this.transcribing = false;
  }

  private webSpeech() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { store.notify("Spracheingabe wird von diesem Browser nicht unterstützt."); return; }
    const r = new SR(); r.lang = store.api.hass.language || "de-DE"; r.interimResults = false;
    r.onresult = (e: any) => this.setText((this.text ? this.text + " " : "") + e.results[0][0].transcript);
    r.start();
  }

  private usageMenu() {
    const u = store.data?.usage || {};
    const today = u.today || {}; const q = u.quota || {}; const lim = u.key_limits || {};
    const cu = this.chatUsage;
    const ctxFrac = cu?.context && cu?.context_max ? cu.context / cu.context_max : 0;
    const tok = (today.prompt || 0) + (today.completion || 0);
    const fr = (a: number, b: number) => (b ? Math.min(1, a / b) : 0);
    const cls = (f: number) => (f >= 0.9 ? "e" : f >= 0.7 ? "w" : "");
    const bar = (f: number) => html`<div class="bar2"><i class=${cls(f)} style="width:${Math.round(f * 100)}%"></i></div>`;
    const keyDay = lim.limit_requests_day ? 1 - (lim.remaining_requests_day ?? lim.limit_requests_day) / lim.limit_requests_day : 0;
    const keyHour = lim.limit_requests_hour ? 1 - (lim.remaining_requests_hour ?? lim.limit_requests_hour) / lim.limit_requests_hour : 0;
    return html`<div class="stats">
      ${cu ? html`<div><div class="k"><b>${t("Kontext")}</b><span>${fmtNum(cu.context || 0)} / ${fmtNum(cu.context_max || this.modelInfo.context || 0)}</span></div>${bar(ctxFrac)}
        <div class="hint">Wird es voll, kürzt LLMitMir ältere Werkzeugergebnisse und dann die ältesten Nachrichten.</div></div>` : nothing}
      <div><div class="k"><b>${t("Heute")}</b><span>${today.requests || 0} Anfragen · ${fmtNum(tok)} Tokens</span></div>
        ${q.requests_day ? html`<div class="k muted"><span>Kontingent Anfragen</span><span>${today.requests || 0} / ${q.requests_day}</span></div>${bar(fr(today.requests, q.requests_day))}` : nothing}
        ${q.tokens_day ? html`<div class="k muted"><span>Kontingent Tokens</span><span>${fmtNum(tok)} / ${fmtNum(q.tokens_day)}</span></div>${bar(fr(tok, q.tokens_day))}` : nothing}
        ${!q.requests_day && !q.tokens_day ? html`<div class="hint">Kein persönliches Tageskontingent.</div>` : nothing}</div>
      ${lim.limit_requests_day ? html`<div><div class="k"><b>${t("Schlüssel")}</b><span>${u.key_mode === "shared" ? "gemeinsam" : "persönlich"}</span></div>
        <div class="k muted"><span>Heute übrig</span><span>${lim.remaining_requests_day} / ${lim.limit_requests_day}</span></div>${bar(keyDay)}
        <div class="k muted"><span>Diese Stunde übrig</span><span>${lim.remaining_requests_hour} / ${lim.limit_requests_hour}</span></div>${bar(keyHour)}
        ${lim.reset_requests_day ? html`<div class="hint">Tageslimit setzt in ${fmtDuration(lim.reset_requests_day)} zurück.</div>` : nothing}</div>` :
        html`<div class="hint">Limits des Schlüssels erscheinen nach der ersten Anfrage.</div>`}
    </div>`;
  }

  private quotaFrac(): number {
    const u = store.data?.usage || {}; const today = u.today || {}; const q = u.quota || {}; const lim = u.key_limits || {};
    const tok = (today.prompt || 0) + (today.completion || 0);
    const f = [q.requests_day ? today.requests / q.requests_day : 0, q.tokens_day ? tok / q.tokens_day : 0,
      lim.limit_requests_day ? 1 - (lim.remaining_requests_day ?? lim.limit_requests_day) / lim.limit_requests_day : 0,
      lim.limit_requests_hour ? 1 - (lim.remaining_requests_hour ?? lim.limit_requests_hour) / lim.limit_requests_hour : 0];
    return Math.max(...f.map(x => x || 0));
  }

  private modelMenu() {
    const d = store.data;
    const def = this.mode === "chat" ? d?.defaults?.chat : d?.defaults?.agent;
    return html`<div class="mh">${t("Modell")}</div>
      ${this.models.map(m => html`<button class="mi ${m.id === this.model ? "sel" : ""}" data-close
          @click=${() => { this.model = m.id; this.dispatchEvent(new CustomEvent("model", { detail: m.id })); }}>
        <div class="grow"><div class="row"><span class="ellipsis">${m.name}</span>${m.id === def ? html`<span class="badge">Standard</span>` : nothing}
          ${m.status === "unavailable" ? html`<span class="badge" style="color:var(--lm-err)">nicht verfügbar</span>` : nothing}</div>
          <div class="sub">${(m.input || []).includes("image") ? "Bilder · " : ""}${(m.output || []).includes("thought") ? "denkt nach · " : ""}${fmtNum(m.context)} Kontext</div></div>
        ${m.id === this.model ? icon("check", 18) : nothing}</button>`)}
      <div class="msep"></div><div class="hint" style="padding:4px 10px 6px">Open-Weight-Modelle können verzögert antworten, wenn viel los ist.</div>`;
  }

  private toolsMenu() {
    const groups = store.data?.tool_groups || {};
    const sel = new Set<string>(this.tools ?? store.data?.settings?.chat_tools ?? ["web", "files", "skills"]);
    const avail = ["web", "files", "skills", "ha", "dav", "http"];
    return html`<div class="mh">${t("Werkzeuge")} im Chat</div>
      ${avail.map(g => html`<button class="mi" @click=${() => {
        sel.has(g) ? sel.delete(g) : sel.add(g); this.tools = [...sel];
        this.dispatchEvent(new CustomEvent("tools", { detail: this.tools })); this.requestUpdate(); }}>
        ${icon(groups[g]?.icon || "tools", 18)}<span class="grow">${groups[g]?.label || g}</span>${sel.has(g) ? icon("check", 18) : nothing}</button>`)}
      <div class="hint" style="padding:4px 10px 6px">Im Cowork stehen alle Werkzeuge zur Verfügung; schreibende Aktionen fragen nach.</div>`;
  }

  private projectMenu() {
    const ps = store.data?.projects || [];
    return html`<div class="mh">${t("Projekte")}</div>
      <button class="mi ${!this.projectId ? "sel" : ""}" data-close @click=${() => { this.projectId = null; this.dispatchEvent(new CustomEvent("project", { detail: null })); }}>
        ${icon("chat", 18)} Ohne Projekt</button>
      ${ps.map((p: any) => html`<button class="mi ${p.id === this.projectId ? "sel" : ""}" data-close
        @click=${() => { this.projectId = p.id; this.dispatchEvent(new CustomEvent("project", { detail: p.id })); }}>
        ${icon("project", 18)}<span class="grow ellipsis">${p.name}</span></button>`)}`;
  }

  render() {
    const busy = this.busy;
    const proj = (store.data?.projects || []).find((p: any) => p.id === this.projectId);
    const qf = this.quotaFrac();
    const cu = this.chatUsage;
    const cf = cu?.context && cu?.context_max ? cu.context / cu.context_max : 0;
    const secs = this.rec ? Math.floor((Date.now() - this.recStart) / 1000) : 0;
    return html`<div class="box ${this.big ? "big" : ""} ${this.drag ? "drag" : ""}"
        @dragover=${(e: DragEvent) => { e.preventDefault(); this.drag = true; }} @dragleave=${() => (this.drag = false)}
        @drop=${(e: DragEvent) => { e.preventDefault(); this.drag = false; this.addFiles(e.dataTransfer?.files || null); }}>
      ${this.files.length ? html`<div class="files">${this.files.map((f, i) => html`<span class="file">${icon(f.type.startsWith("image/") ? "image" : "file", 16)}
        <span class="ellipsis">${f.name}</span><button @click=${() => (this.files = this.files.filter((_, j) => j !== i))}>${icon("close", 16)}</button></span>`)}</div>` : nothing}
      ${this.rec ? html`<div class="rec"><span class="dot"></span><span class="muted">${fmtDuration(secs)}</span>
          <div class="wave">${Array.from({ length: 28 }, (_, i) => html`<i style="height:${4 + Math.abs(Math.sin(i * 1.7 + Date.now() / 160)) * this.recLevel * 24}px"></i>`)}</div>
          <button class="iconbtn" title=${t("Abbrechen")} @click=${() => this.stopRec(false)}>${icon("close")}</button>
          <button class="send" title="Fertig" @click=${() => this.stopRec(true)}>${icon("check")}</button></div>`
        : html`<textarea rows="1" .value=${this.text} placeholder=${this.transcribing ? "Sprache wird erkannt …" : this.placeholder}
          @input=${(e: any) => { this.text = e.target.value; this.autosize(); }} @keydown=${this.key}
          @paste=${(e: ClipboardEvent) => { const f = e.clipboardData?.files; if (f?.length) { e.preventDefault(); this.addFiles(f); } }}></textarea>`}
      <div class="bar">
        <label class="iconbtn" title=${t("Anhängen")}>${icon("attach")}<input type="file" multiple hidden
          @change=${(e: any) => { this.addFiles(e.target.files); e.target.value = ""; }}></label>
        ${this.mode === "chat" ? html`<lm-menu direction="up"><button slot="trigger" class="iconbtn ${this.tools?.length ? "" : ""}" title=${t("Werkzeuge")}>${icon("tools")}</button>${this.toolsMenu()}</lm-menu>` : nothing}
        ${this.showMode ? html`<span class="seg">
          <button class=${this.mode === "chat" ? "on" : ""} @click=${() => this.setMode("chat")}>${icon("chat", 16)}<span class="hide-s">Chat</span></button>
          <button class=${this.mode === "cowork" ? "on" : ""} @click=${() => this.setMode("cowork")}>${icon("cowork", 16)}<span class="hide-s">Cowork</span></button></span>` : nothing}
        ${this.showProject ? html`<lm-menu direction="up"><button slot="trigger" class="model" title=${t("Projekte")}>${icon("project", 16)}<span class="ellipsis hide-s">${proj?.name || "Projekt"}</span></button>${this.projectMenu()}</lm-menu>` : nothing}
        <span class="grow"></span>
        <lm-menu direction="up" align="right"><button slot="trigger" class="meter" title="${t("Kontext")} & ${t("Kontingent")}">
          ${cu ? html`<lm-ring .value=${cf} label=${t("Kontext")}></lm-ring>` : nothing}<lm-ring .value=${qf} label=${t("Kontingent")}></lm-ring></button>
          ${this.usageMenu()}</lm-menu>
        <lm-menu direction="up" align="right"><button slot="trigger" class="model" title=${t("Modell")}><span class="ellipsis">${this.modelInfo.name || "Modell wählen"}</span>${icon("down", 16)}</button>${this.modelMenu()}</lm-menu>
        ${!busy && !this.text.trim() && !this.files.length && !this.rec ? html`<button class="send" title=${t("Spracheingabe")} style="background:var(--lm-hover);color:var(--lm-text)"
            @click=${this.toggleRec} ?disabled=${this.transcribing}>${this.transcribing ? html`<lm-spark size="18"></lm-spark>` : icon("mic")}</button>`
          : !this.rec ? html`<button class="send ${busy ? "stop" : ""}" title=${busy ? t("Stopp") : t("Senden")} @click=${this.send}>${icon(busy ? "stop" : "send")}</button>` : nothing}
      </div></div>`;
  }

  private setMode(m: "chat" | "cowork") {
    this.mode = m;
    const d = store.data?.defaults || {};
    const proj = (store.data?.projects || []).find((p: any) => p.id === this.projectId);
    this.model = (m === "chat" ? proj?.model_chat || d.chat : proj?.model_agent || d.agent) || this.model;
    this.dispatchEvent(new CustomEvent("mode", { detail: m }));
  }
}
