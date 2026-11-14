// Sprachgespräch („Sprechen“): eine eigene Ansicht, in der man mit LLMitMir redet wie am Telefon.
//
// Ablauf einer Runde: zuhören (Mikrofon offen, Sprechpause beendet die Äußerung) → abschreiben → als normale
// Nachricht in den Chat stellen (mit dem Kennzeichen `voice`, damit die Antwort vorlesbar ausfällt) → die
// Antwort Satz für Satz vorlesen, noch während sie entsteht → wieder zuhören. Das Gespräch ist ein ganz
// normaler Chat: Verlauf, Werkzeuge, Freigaben und Modelle funktionieren wie dort, und man kann es später
// im Chat nachlesen oder dort weiterschreiben.
//
// Der Roboter (robot3d.ts) zeigt durchgehend, was gerade passiert: zuhören, warten, nachdenken,
// recherchieren, antworten.
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, menuItemStyles, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { defaultLabel, modelName } from "./modelpick";
import { confirmExternal, isExternal } from "./external";
import { Robot3D, type RobotState } from "./robot3d";
import { BrowserListener, Mic, Speaker, ttsChoice, ttsSetup, type TtsSetup } from "./voiceio";
import { SentenceFeed, isNoise } from "./voicetext";

type Phase = "off" | "listening" | "understanding" | "thinking" | "researching" | "speaking" | "paused" | "permission";

const ROBOT: Record<Phase, RobotState> = { off: "hello", listening: "listening", understanding: "thinking", thinking: "thinking",
  researching: "researching", speaking: "speaking", paused: "idle", permission: "asking" };

// Was LLMitMir gerade nachschlägt – in Worten, die man auch ohne Technikwissen versteht
const DOING: Record<string, string> = {
  web: "Ich suche im Internet …", ha: "Ich schaue im Zuhause nach …", dav: "Ich schaue in deiner Nextcloud nach …",
  ews: "Ich schaue in deinen Kalender …", mail: "Ich schaue in dein Postfach …", http: "Ich frage einen Dienst ab …",
  files: "Ich lese Dateien …", skills: "Ich lese eine Anleitung …", werkbank: "Ich rechne …", notify: "Ich schicke eine Nachricht …",
  llmitmir: "Ich schaue in LLMitMir nach …",
};
const CHANGE_WHAT: Record<string, string> = { skill: "den Skill", aufgabe: "die geplante Aufgabe", zugang: "den Zugang" };

interface Cfg { tts: string; pause: number; bargeIn: boolean; captions: boolean; model: string; }
const LS = "llmitmir.voice";
const DEFAULTS: Cfg = { tts: "auto", pause: 1200, bargeIn: false, captions: true, model: "" };
function loadCfg(): Cfg { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...DEFAULTS }; } }

const IDLE_PAUSE = 5 * 60 * 1000;   // so lange Stille, dann macht das Mikrofon von selbst Pause

@safeElement("lm-voice")
export class Voice extends StoreElement {
  @property() chatId?: string;
  @state() private phase: Phase = "off";
  @state() private caption = "";      // was LLMitMir gerade sagt
  @state() private heard = "";        // was zuletzt verstanden wurde
  @state() private err = "";
  @state() private starting = false;
  @state() private muted = false;
  @state() private sheet = false;
  @state() private cfg: Cfg = loadCfg();
  @state() private tts?: TtsSetup;
  @state() private flat = false;      // kein WebGL: der Roboter erscheint als Zeichnung
  @state() private doing = "";

  private robot?: Robot3D;
  private ctx?: AudioContext;
  private mic?: Mic | BrowserListener;
  private speaker?: Speaker;
  private active = false;
  private known = new Set<string>();           // Nachrichten, die nicht (mehr) vorgelesen werden
  private feeds = new Map<string, SentenceFeed>();
  private silenced = true;                     // bis zur nächsten eigenen Nachricht nichts vorlesen
  private busy = false;                        // schreibt ab oder sendet gerade
  private pending = false; private sawRun = false; private pendingSince = 0;
  private holdUntil = 0; private quietSince = 0;
  private timer: any; private wake: any; private spokePerm = "";
  private mine = "";                           // Chat, den diese Ansicht selbst angelegt hat
  private _sync = () => this.sync();

  static styles = [base, menuItemStyles, css`
    :host { display: block; height: 100%; }
    .stage { height: 100%; display: flex; flex-direction: column; position: relative; overflow: hidden; color: #fff;
      background: radial-gradient(120% 90% at 50% 38%, #3f8a69 0%, #2d6a4f 55%, #245842 100%); }
    .stage.dark { background: radial-gradient(120% 90% at 50% 38%, #1f3a2e 0%, #18221d 55%, #151515 100%); }
    .top { display: flex; align-items: center; gap: 4px; padding: 6px 8px; min-height: 52px; position: relative; z-index: 2; }
    .top b { font-family: var(--lm-head); font-size: 16px; font-weight: 600; padding-left: 6px; }
    .top .chipw { font-size: 12px; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.14); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; max-width: 46vw; }
    .stage .iconbtn, ::slotted(.iconbtn) { color: rgba(255,255,255,.85); }
    .stage .iconbtn:hover { background: rgba(255,255,255,.14); color: #fff; }
    .bot { flex: 1; min-height: 0; position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block;
      -webkit-mask-image: linear-gradient(#000 86%, transparent 99%); mask-image: linear-gradient(#000 86%, transparent 99%); }
    .flat { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; }
    .say { position: relative; z-index: 2; padding: 4px 22px 0; min-height: 104px; max-width: 760px; width: 100%; margin: 0 auto; text-align: center;
      display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
    .status { font-size: 15px; font-weight: 550; letter-spacing: .01em; }
    .status .dots::after { content: ""; animation: dots 1.4s steps(4, end) infinite; }
    @keyframes dots { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } }
    .heard { font-size: 13.5px; color: rgba(255,255,255,.72); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cap { font-size: clamp(16px, 2.4vw, 19px); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
      text-wrap: balance; animation: fadeIn .25s ease both; }
    .cap.old { color: rgba(255,255,255,.6); }
    .errline { font-size: 13.5px; background: rgba(0,0,0,.28); border-radius: 10px; padding: 8px 12px; display: inline-flex; gap: 8px; align-items: flex-start; text-align: left; align-self: center; }
    .ctl { position: relative; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 22px; padding: 14px 16px 22px; }
    .rb { width: 54px; height: 54px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff;
      background: rgba(255,255,255,.16); transition: background .15s, transform .1s; }
    .rb:hover { background: rgba(255,255,255,.26); } .rb:active { transform: scale(.95); }
    .rb.main { width: 72px; height: 72px; background: #fff; color: #2d6a4f; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
    .rb.main.off { background: rgba(255,255,255,.2); color: #fff; box-shadow: none; }
    .rb.end { background: #c0433a; } .rb.end:hover { background: #d2554c; }
    .rb[disabled] { opacity: .5; pointer-events: none; }
    .startbtn { border: 0; cursor: pointer; border-radius: 999px; padding: 15px 28px; font-size: 16.5px; font-weight: 600; background: #fff; color: #245842;
      display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.25); transition: transform .1s; }
    .startbtn:active { transform: scale(.97); }
    .resume { border: 0; background: none; color: rgba(255,255,255,.8); text-decoration: underline; cursor: pointer; font-size: 13.5px; }
    .perm { position: relative; z-index: 3; margin: 0 auto 4px; width: min(520px, calc(100% - 28px)); background: var(--lm-panel); color: var(--lm-text);
      border-radius: 16px; padding: 14px 16px; box-shadow: 0 10px 40px rgba(0,0,0,.3); display: grid; gap: 10px; text-align: left; animation: fadeIn .2s ease both; }
    .perm .brow { display: flex; gap: 8px; flex-wrap: wrap; }
    .sheet { position: absolute; inset: 0; z-index: 10; background: rgba(0,0,0,.4); display: flex; align-items: flex-end; justify-content: center; animation: fadeIn .15s; }
    .sheetcard { width: min(480px, 100%); max-height: 86%; overflow-y: auto; background: var(--lm-raise); color: var(--lm-text); border: 1px solid var(--lm-line);
      border-radius: 18px 18px 0 0; padding: 16px 16px calc(18px + var(--safe-area-inset-bottom, 0px)); display: grid; gap: 14px; box-shadow: 0 -10px 40px rgba(0,0,0,.25); }
    .sheetcard .iconbtn { color: var(--lm-muted); }
    .sheetcard .iconbtn:hover { background: var(--lm-hover); color: var(--lm-text); }
    .chk { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; cursor: pointer; }
    .chk input { width: auto; margin-top: 3px; }
    @media (min-width: 871px) { .sheet { align-items: center; } .sheetcard { border-radius: 18px; } }
    @media (max-height: 520px) { .say { min-height: 64px; } .ctl { padding: 8px 16px 12px; } .rb.main { width: 60px; height: 60px; } }
  `];

  connectedCallback() { super.connectedCallback(); store.addEventListener("change", this._sync); }
  disconnectedCallback() {
    super.disconnectedCallback();
    store.removeEventListener("change", this._sync);
    this.endSession();
    this.robot?.dispose(); this.robot = undefined;
  }

  firstUpdated() {
    const canvas = this.renderRoot.querySelector("canvas") as HTMLCanvasElement | null;
    try {
      if (!canvas || !Robot3D.supported()) throw new Error("kein WebGL");
      const r = this.robot = new Robot3D(canvas, this.isDark());
      r.state = "hello";
      r.onFrame = now => {
        this.speaker?.tick(now);
        r.voiceLevel = this.speaker?.level || 0;
        r.micLevel = this.phase === "listening" ? this.mic?.level || 0 : 0;
      };
      r.start();
    } catch { this.flat = true; }
    if (this.chatId) this.openChat(this.chatId);
  }

  updated(ch: Map<string, any>) {
    if (ch.has("chatId") && (this.chatId || "") !== this.mine) {
      // anderes Gespräch gewählt (Seitenleiste, Zurück-Taste): das laufende endet
      this.endSession(); this.caption = this.heard = this.err = "";
      this.mine = this.chatId || "";
      if (this.chatId) this.openChat(this.chatId);
    }
    if (!this.robot) return;
    this.robot.setDark(this.isDark());
    const calm = this.phase === "listening" || this.phase === "paused" || this.phase === "off";
    this.robot.state = this.err && calm && this.errShown() ? "error" : ROBOT[this.phase];
  }

  /** Dunkles Erscheinungsbild? Das Panel trägt es als Attribut (und merkt es im Store). */
  private isDark(): boolean {
    const host = (this.getRootNode() as ShadowRoot)?.host as HTMLElement | undefined;
    return !!store.data?.__dark || !!host?.hasAttribute?.("dark");
  }

  private errAt = 0;
  private errShown() { return performance.now() - this.errAt < 3500; }
  private fail(msg: string) { this.err = msg; this.errAt = performance.now(); setTimeout(() => this.requestUpdate(), 3600); }

  private async openChat(id: string) {
    this.mine = id;
    try {
      const chat = await store.loadChat(id);
      this.known = new Set((chat?.messages || []).map((m: any) => m.id));
    } catch { store.notify(t("Chat nicht gefunden")); navigate("/voice", true); }
  }

  private save(patch: Partial<Cfg>) {
    this.cfg = { ...this.cfg, ...patch };
    try { localStorage.setItem(LS, JSON.stringify(this.cfg)); } catch { /* Speicher gesperrt */ }
    if (this.mic instanceof Mic) this.mic.silenceMs = this.cfg.pause;
    if (this.speaker && this.tts) this.speaker.choice = ttsChoice(this.tts, this.cfg.tts, this.locale);
  }

  private get locale(): string { return store.api?.hass?.language || "de"; }

  // ---------------------------------------------------------------- Gespräch beginnen und beenden
  private async begin() {
    if (this.starting || this.active) return;
    this.starting = true; this.err = "";
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) throw new Error(t("Dieser Browser kann hier keinen Ton aufnehmen oder abspielen."));
      this.ctx = this.ctx || new AC();
      // Safari gibt die Stimme des Browsers nur frei, wenn sie noch im Tippen selbst einmal benutzt wurde
      try { if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* keine Browserstimme */ }
      await this.ctx!.resume();
      if (!this.tts) this.tts = await ttsSetup(store.api.hass);
      const sp = this.speaker = new Speaker(store.api.hass, this.ctx!);
      sp.lang = this.locale; sp.choice = ttsChoice(this.tts, this.cfg.tts, this.locale);
      sp.onSpeak = txt => { if (txt) this.caption = txt; else this.holdUntil = performance.now() + 350; this.sync(); if (!txt) setTimeout(this._sync, 380); };
      if (store.data?.transcription && Mic.supported()) {
        const mic = this.mic = new Mic();
        mic.silenceMs = this.cfg.pause;
        mic.onStart = () => this.onSpeechStart();
        mic.onEnd = wav => this.onSpeechEnd(wav);
        await mic.start(this.ctx!);
      } else if (BrowserListener.supported()) {
        const l = this.mic = new BrowserListener();
        l.onStart = () => this.onSpeechStart();
        l.onText = txt => { this.sendText(txt); };
        l.start(this.locale);
      } else throw new Error(t("Für die Spracherkennung ist beim Anbieter kein Modell eingetragen, und dieser Browser hat keine eigene."));
      this.active = true; this.muted = false; this.silenced = true; this.quietSince = performance.now();
      this.timer = setInterval(() => this.tick(), 1000);
      try { this.wake = await (navigator as any).wakeLock?.request("screen"); } catch { /* Bildschirm darf ausgehen */ }
      if (!this.chatId) sp.say(t("Hallo! Worüber möchtest du sprechen?"));
      this.sync();
    } catch (e: any) {
      const blocked = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      this.fail(blocked ? t("Das Mikrofon ist gesperrt. Bitte erlaube den Zugriff in den Einstellungen des Browsers oder der App.")
        : e?.name === "NotFoundError" ? t("Kein Mikrofon gefunden.") : String(e?.message || e));
      this.endSession();
    }
    this.starting = false;
  }

  private endSession() {
    clearInterval(this.timer);
    this.mic?.stop(); this.mic = undefined;
    this.speaker?.stop(); this.speaker = undefined;
    try { this.wake?.release(); } catch { /* schon frei */ } this.wake = undefined;
    try { this.ctx?.close(); } catch { /* schon zu */ } this.ctx = undefined;
    this.active = false; this.pending = false; this.busy = false; this.silenced = true; this.muted = false; this.doing = "";
    this.phase = "off";
  }

  private hangUp() {
    const id = this.chatId, talked = id && (store.chats.get(id)?.messages?.length || 0) > 0;
    this.endSession();
    navigate(talked ? `/chat/${id}` : "/");
  }

  private toggleMute() {
    if (!this.active) return;
    this.muted = !this.muted;
    this.mic?.setMuted(this.muted);
    this.quietSince = performance.now();
    this.sync();
  }

  /** Antwort abbrechen (Tippen auf den Roboter, Dazwischenreden). */
  private interrupt() {
    if (!this.active) return;
    this.speaker?.stop();
    this.silenced = true; this.pending = false;
    if (this.chatId && store.runs[this.chatId]) store.api.ws("chat/stop", { chat_id: this.chatId }).catch(() => undefined);
    this.holdUntil = performance.now() + 200;
    this.sync();
  }

  private tapRobot() {
    if (!this.active) { this.begin(); return; }
    if (this.phase === "speaking" || this.phase === "thinking" || this.phase === "researching") this.interrupt();
    else if (this.phase === "paused") this.toggleMute();
  }

  // ---------------------------------------------------------------- zuhören
  private onSpeechStart() {
    this.quietSince = performance.now();
    if (this.phase === "speaking") this.interrupt();   // Dazwischenreden
    this.requestUpdate();
  }

  private async onSpeechEnd(wav: Blob | null) {
    if (!wav || !this.active) { this.sync(); return; }
    this.busy = true; this.sync();
    let txt = "";
    try { txt = (await store.api.transcribe(wav)).trim(); }
    catch (e: any) { this.fail(String(e?.message || e)); }
    this.busy = false;
    if (!this.active) return;
    if (!txt || isNoise(txt)) { this.sync(); return; }
    await this.sendText(txt);
  }

  private async sendText(text: string) {
    if (!this.active) return;
    this.busy = true; this.err = ""; this.heard = text; this.caption = ""; this.sync();
    try {
      const model = isSimple() ? undefined : this.cfg.model || undefined;
      if (!this.chatId) {
        const chat = await store.api.ws("chat/create", { kind: "chat", voice: true, ...(model ? { model } : {}) });
        store.chats.set(chat.id, { ...chat, messages: [], progress: [], usage: {} });
        this.mine = chat.id;
        navigate(`/voice/${chat.id}`, true);
        this.chatId = chat.id;
      }
      const chat = store.chats.get(this.chatId!) || await store.loadChat(this.chatId!);
      this.known = new Set((chat?.messages || []).map((m: any) => m.id));
      this.feeds.clear(); this.silenced = false;
      this.pending = true; this.sawRun = !!store.runs[this.chatId!]; this.pendingSince = performance.now();
      await store.api.ws("chat/send", { chat_id: this.chatId, text, voice: true, ...(model && model !== chat?.model ? { model } : {}) });
    } catch (e: any) { this.pending = false; this.fail(String(e?.message || e)); }
    this.busy = false; this.quietSince = performance.now();
    this.sync();
  }

  // ---------------------------------------------------------------- antworten
  /** Neue Sätze der Antwort an die Stimme geben – schon während sie entsteht. */
  private feed() {
    if (this.silenced || !this.chatId || !this.speaker) return;
    const chat = store.chats.get(this.chatId);
    for (const m of chat?.messages || []) {
      if (m.role !== "assistant" || this.known.has(m.id)) continue;
      let f = this.feeds.get(m.id);
      if (!f) this.feeds.set(m.id, f = new SentenceFeed());
      if (m.error) {
        if (!f.closed) { f.closed = true; this.fail(String(m.error)); this.speaker.say(t("Das hat gerade leider nicht geklappt.")); }
        continue;
      }
      for (const piece of f.push(m.content || "", !m.streaming)) this.speaker.say(piece);
    }
  }

  private perm() { return this.chatId ? store.permissions.find(p => p.chat_id === this.chatId) : undefined; }

  /** Aus dem Stand von Chat, Stimme und Mikrofon ableiten, was gerade passiert. */
  private sync() {
    if (!this.active) return;
    const run = this.chatId ? store.runs[this.chatId] : undefined;
    this.feed();
    if (run) this.sawRun = true;
    if (this.pending && !run && (this.sawRun || performance.now() - this.pendingSince > 20000)) this.pending = false;
    const perm = this.perm();
    if (perm && this.spokePerm !== perm.id && !this.silenced) {
      this.spokePerm = perm.id;
      this.speaker?.say(t("Dafür brauche ich kurz deine Bestätigung auf dem Bildschirm."));
    }
    let ph: Phase;
    if (this.speaker?.busy) ph = "speaking";
    else if (perm) ph = "permission";
    else if (run && !this.silenced) ph = run.status === "tool" ? "researching" : "thinking";
    else if (this.busy && !this.pending) ph = "understanding";
    else if (this.pending || this.busy) ph = "thinking";
    else ph = this.muted ? "paused" : "listening";
    const d: any = run?.detail || {};
    this.doing = ph !== "researching" ? "" : DOING[d.tool ? store.data?.tools?.[d.tool]?.group : ""] || (isSimple() || !d.label ? "Ich schaue nach …" : `${d.label} …`);
    if (ph !== this.phase) { if (ph === "listening") this.quietSince = performance.now(); this.phase = ph; }
    if (this.mic) {
      const barge = this.cfg.bargeIn && ph === "speaking" && this.mic instanceof Mic;
      this.mic.enabled = !this.muted && (barge || (ph === "listening" && performance.now() >= this.holdUntil));
      if (this.mic instanceof Mic) this.mic.sensitivity = barge ? 2.6 : 1;
    }
  }

  private tick() {
    if (!this.active) return;
    // lange nichts gesagt: Pause, damit das Mikrofon nicht stundenlang offen bleibt
    if (this.phase === "listening" && !this.mic?.hearing && performance.now() - this.quietSince > IDLE_PAUSE) this.toggleMute();
    this.sync();
  }

  // ---------------------------------------------------------------- Anzeige
  private statusText(): any {
    const run = this.chatId ? store.runs[this.chatId] : undefined;
    switch (this.phase) {
      case "off": return this.starting ? html`${t("Einen Moment")}<span class="dots"></span>` : nothing;
      case "listening": return this.mic?.hearing ? t("Ich höre zu") : html`${t("Ich höre zu – sprich einfach los")}`;
      case "understanding": return html`${t("Ich verstehe")}<span class="dots"></span>`;
      case "thinking": return run?.status === "retry" || run?.status === "quota_wait" ? html`${t("Gerade ist viel los – einen Moment")}<span class="dots"></span>`
        : html`${t("Ich denke nach")}<span class="dots"></span>`;
      case "researching": return t(this.doing);
      case "speaking": return nothing;
      case "paused": return t("Pause – tippe auf das Mikrofon, wenn es weitergehen soll");
      case "permission": return t("Ich warte auf deine Bestätigung");
    }
  }

  private permCard() {
    const p = this.perm(); if (!p) return nothing;
    const answer = (decision: string) => store.api.ws("permission/answer", { permission_id: p.id, decision }).catch((e: any) => store.notify(String(e?.message || e)));
    const del = p.change?.aktion === "loeschen";
    const verb = ({ anlegen: "anlegen", aendern: "ändern", loeschen: "löschen" } as any)[p.change?.aktion] || p.change?.aktion;
    return html`<div class="perm">
      <div>${p.change ? html`Soll ich ${CHANGE_WHAT[p.change.art] || p.change.art} <b>„${p.change.name}“</b> ${verb}?`
        : p.group ? html`Darf ich dafür <b>${p.group_label || p.group}</b> benutzen?`
        : html`Darf ich das tun? <b>${p.label}</b>`}</div>
      ${p.group && p.label ? html`<div class="hint">${p.label}</div>` : nothing}
      <div class="brow"><button class="btn primary" @click=${() => answer("once")}>${icon("check", 16)} ${del ? "Ja, löschen" : "Ja"}</button>
        <button class="btn" @click=${() => answer("deny")}>Nein</button>
        <button class="btn ghost" @click=${() => { const id = this.chatId; this.endSession(); navigate(`/chat/${id}`); }}>${icon("eye", 16)} ${t("Im Chat ansehen")}</button></div></div>`;
  }

  private voiceLabel(): string {
    if (!this.tts) return t("Automatisch");
    const c = ttsChoice(this.tts, "auto", this.locale);
    const name = c.kind === "ha" ? this.tts.engines.find(e => e.id === c.engine)?.name : c.kind === "browser" ? t("Stimme des Browsers") : t("nur Text");
    return `${t("Automatisch")} (${name})`;
  }

  private async pickModel(id: string) {
    if (id && isExternal(id) && id !== this.cfg.model) {
      const history = !!this.chatId && (store.chats.get(this.chatId)?.messages?.length || 0) > 0;
      if (!(await confirmExternal(id, history))) { this.requestUpdate(); return; }
    }
    this.save({ model: id });
  }

  private settings() {
    const s = this.tts;
    if (!s) ttsSetup(store.api.hass).then(r => (this.tts = r));
    const models = (store.data?.models || []).filter((m: any) => m.status !== "unavailable" && !(m.external && (m.locked || !m.usable)));
    return html`<div class="sheet" @click=${(e: Event) => e.target === e.currentTarget && (this.sheet = false)}>
      <div class="sheetcard">
        <div class="row"><b class="grow">${t("Sprechen")} – ${t("Einstellungen")}</b>
          <button class="iconbtn" title=${t("Schließen")} @click=${() => (this.sheet = false)}>${icon("close", 18)}</button></div>
        <label class="f"><span>${t("Stimme")}</span>
          <select .value=${this.cfg.tts} @change=${(e: any) => this.save({ tts: e.target.value })}>
            <option value="auto" ?selected=${this.cfg.tts === "auto"}>${this.voiceLabel()}</option>
            ${(s?.engines || []).map(e => html`<option value=${e.id} ?selected=${this.cfg.tts === e.id}>${e.name}</option>`)}
            ${s?.browser ? html`<option value="browser" ?selected=${this.cfg.tts === "browser"}>${t("Stimme des Browsers")}</option>` : nothing}
            <option value="off" ?selected=${this.cfg.tts === "off"}>${t("Ohne Stimme (nur Text)")}</option></select>
          <span class="hint" style="font-weight:400">${s && !s.engines.length
            ? t("Schöner klingt es mit einer Sprachausgabe in Home Assistant (z. B. Piper oder Home Assistant Cloud) – LLMitMir nutzt sie dann von selbst.")
            : t("„Automatisch“ nimmt die Stimme deines Sprachassistenten in Home Assistant.")}</span></label>
        <label class="f"><span>${t("Wie lange darf eine Sprechpause sein?")}</span>
          <select @change=${(e: any) => this.save({ pause: Number(e.target.value) })}>
            ${[[800, t("Kurz – antwortet schnell")], [1200, t("Normal")], [2000, t("Lang – lässt Zeit zum Überlegen")]].map(([v, l]) =>
              html`<option value=${v} ?selected=${this.cfg.pause === v}>${l}</option>`)}</select></label>
        <label class="chk"><input type="checkbox" .checked=${this.cfg.bargeIn} @change=${(e: any) => this.save({ bargeIn: e.target.checked })}>
          <span>${t("Dazwischenreden unterbricht die Antwort")}<div class="hint">${t("Am besten mit Kopfhörern – sonst hört LLMitMir sich womöglich selbst. Tippen auf den Roboter unterbricht immer.")}</div></span></label>
        <label class="chk"><input type="checkbox" .checked=${this.cfg.captions} @change=${(e: any) => this.save({ captions: e.target.checked })}>
          <span>${t("Gesprochenes als Text mitlesen")}</span></label>
        ${isSimple() ? nothing : html`<label class="f"><span>${t("Modell")}</span>
          <select @change=${(e: any) => this.pickModel(e.target.value)}>
            <option value="" ?selected=${!this.cfg.model}>${defaultLabel("chat")}</option>
            ${models.map((m: any) => html`<option value=${m.id} ?selected=${this.cfg.model === m.id}>${m.name}${m.external ? " · €" : ""}</option>`)}</select>
          <span class="hint" style="font-weight:400">${t("Gilt ab der nächsten Nachricht. Kostenpflichtige Modelle sind mit € markiert.")}</span></label>`}
        ${store.data?.transcription ? nothing : html`<div class="hint">${icon("info", 15)} ${t("Beim Anbieter ist kein Modell für die Spracherkennung eingetragen – deshalb hört der Browser zu.")}</div>`}
      </div></div>`;
  }

  render() {
    const dark = this.isDark();
    const chat = this.chatId ? store.chats.get(this.chatId) : undefined;
    const last = !this.chatId ? (store.data?.chats || []).find((c: any) => c.voice && c.kind === "chat") : undefined;
    const model = !isSimple() && (this.cfg.model || chat?.model) ? modelName(this.cfg.model || chat?.model) : "";
    const on = this.active;
    return html`<div class="stage ${dark ? "dark" : ""}">
      <div class="top"><slot name="menu"></slot><b class="grow">${t("Sprechen")}</b>
        ${model ? html`<span class="chipw" title=${t("Modell")}>${model}</span>` : nothing}
        ${this.chatId ? html`<button class="iconbtn" title=${t("Im Chat ansehen")} @click=${() => { const id = this.chatId; this.endSession(); navigate(`/chat/${id}`); }}>${icon("chat")}</button>` : nothing}
        <button class="iconbtn" title=${t("Einstellungen")} @click=${() => (this.sheet = true)}>${icon("settings")}</button></div>
      <div class="bot" @click=${() => this.tapRobot()} title=${on ? t("Tippen unterbricht die Antwort") : t("Gespräch beginnen")}>
        <canvas aria-label=${t("Der Roboter von LLMitMir")} role="img"></canvas>
        ${this.flat ? html`<div class="flat"><lm-spark size="220" style="color:#fff"></lm-spark></div>` : nothing}</div>
      ${this.permCard()}
      <div class="say" role="status" aria-live="polite">
        ${this.err ? html`<div class="errline">${icon("alert", 16)}<span>${this.err}</span></div>` : nothing}
        ${on && this.cfg.captions && this.heard && this.phase !== "speaking" && this.phase !== "listening" ? html`<div class="heard">„${this.heard}“</div>` : nothing}
        ${on && this.cfg.captions && this.caption && (this.phase === "speaking" || this.phase === "listening")
          ? html`<div class="cap ${this.phase === "speaking" ? "" : "old"}">${this.caption}</div>` : nothing}
        <div class="status">${this.statusText()}</div>
        ${!on && !this.starting ? html`<div><button class="startbtn" @click=${() => this.begin()}>${icon("mic", 22)} ${this.chatId ? t("Gespräch fortsetzen") : t("Gespräch beginnen")}</button></div>
          ${last ? html`<div><button class="resume" @click=${() => navigate(`/voice/${last.id}`)}>${t("Letztes Gespräch fortsetzen")}: ${last.title || t("Neuer Chat")}</button></div>` : nothing}` : nothing}
      </div>
      <div class="ctl">
        ${on ? html`
          <button class="rb" title=${t("Antwort unterbrechen")} ?disabled=${!(this.phase === "speaking" || this.phase === "thinking" || this.phase === "researching")}
            @click=${() => this.interrupt()}>${icon("stop", 24)}</button>
          <button class="rb main ${this.muted ? "off" : ""}" title=${this.muted ? t("Mikrofon einschalten") : t("Mikrofon aus (Pause)")} aria-pressed=${this.muted}
            @click=${() => this.toggleMute()}>${icon(this.muted ? "micOff" : "mic", 30)}</button>
          <button class="rb end" title=${t("Gespräch beenden")} @click=${() => this.hangUp()}>${icon("hangup", 24)}</button>` : nothing}
      </div>
      ${this.sheet ? this.settings() : nothing}
    </div>`;
  }
}
