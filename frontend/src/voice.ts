// Sprachgespräch („Gespräch“): eine eigene Ansicht, in der man mit LLMitMir redet wie am Telefon.
//
// Das Gespräch ist ein ganz normaler Chat (Verlauf, Werkzeuge, Freigaben und Modelle wie dort; später im Chat
// nachzulesen) – aber kein Chat in Tonform. Damit es sich wie ein Gespräch anfühlt, laufen mehrere Dinge
// gleichzeitig (voiceflow.ts beschreibt die Regeln):
//
// - **Mitdenken beim Zuhören:** Schon in einer kurzen Pause wird das bisher Gesagte abgeschrieben. Klingt der
//   Satz fertig, genügt eine kurze Stille, und die Nachricht geht mit fertiger Abschrift sofort hinaus; bricht
//   er mitten im Gedanken ab, wartet LLMitMir länger.
// - **Nachschieben erlaubt:** Solange LLMitMir noch überlegt, bleibt das Mikrofon offen. Spricht die Person
//   weiter, wird der Nachsatz mit dem ersten Teil verbunden und neu überlegt (`amend`).
// - **Sprechen, während weitergedacht wird:** Die Antwort wird Satz für Satz gesprochen, sobald der erste Satz
//   steht. Dauert es, überbrückt LLMitMir die Stille mit einem gesprochenen „Ich schaue kurz nach.“ statt mit
//   einem Text am Bildschirm.
// - **Ruhige Gesten:** Der Roboter folgt nicht jedem technischen Zwischenschritt. Kurze Wartezeiten sind
//   „aufmerksam“, die Denkerpose kommt erst nach langem Überlegen, und wer nachschlägt, bleibt dabei, bis er
//   antwortet.
//
// Aus jedem Chat und jedem Cowork führt ein Knopf hierher (`/voice/<chat-id>`): Das Gespräch setzt den
// vorhandenen Verlauf fort, statt einen neuen Chat anzulegen – die Person kann also tippen, dann
// weitersprechen und danach im Chat weiterlesen und weiterschreiben.
import { css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { StoreElement, base, icon, menuItemStyles, safeElement } from "./ui";
import { store, navigate, isSimple } from "./api";
import { t } from "./i18n";
import { defaultLabel, modelName } from "./modelpick";
import { confirmExternal, isExternal } from "./external";
import { Robot3D, type RobotState } from "./robot3d";
import { BrowserListener, Mic, Speaker, ttsChoice, ttsFallback, ttsSetup, type TtsChoice, type TtsSetup } from "./voiceio";
import { SentenceFeed, isNoise, resumeText } from "./voicetext";
import { BRIDGE_PHRASES, Bridge, Director, addressed, endpoint, extractName, isStop, pauseFor, permAnswer, type Pose } from "./voiceflow";

// Wer ist dran? „waiting“: LLMitMir ist dran, hat aber (noch) nichts zu sagen – das Mikrofon bleibt dabei offen.
type Phase = "off" | "listening" | "waiting" | "speaking" | "paused" | "permission";

// Was LLMitMir gerade nachschlägt – in Worten, die man auch ohne Technikwissen versteht
const DOING: Record<string, string> = {
  web: "Ich suche im Internet …", ha: "Ich schaue im Zuhause nach …", dav: "Ich schaue in deiner Nextcloud nach …",
  ews: "Ich schaue in deinen Kalender …", mail: "Ich schaue in dein Postfach …", http: "Ich frage einen Dienst ab …",
  files: "Ich lese Dateien …", skills: "Ich lese eine Anleitung …", werkbank: "Ich arbeite daran …", notify: "Ich schicke eine Nachricht …",
  llmitmir: "Ich schaue in LLMitMir nach …",
};
const CHANGE_WHAT: Record<string, string> = { skill: "den Skill", aufgabe: "die geplante Aufgabe", zugang: "den Zugang" };

interface Cfg { tts: string; pause: number; bargeIn: boolean; bridge: boolean; captions: boolean; model: string; }
const LS = "llmitmir.voice";
const DEFAULTS: Cfg = { tts: "auto", pause: 1200, bargeIn: false, bridge: true, captions: true, model: "" };
function loadCfg(): Cfg { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch { return { ...DEFAULTS }; } }

const GREET_AFTER = 4000;            // wer nach dem Start so lange nichts sagt, wird begrüßt – sonst gleich losreden
const DIALOG_WINDOW = 20000;         // so lange nach dem letzten Wort gilt alles Gesagte LLMitMir; danach nur mit Rufnamen
const CHECK_EVERY = 2500;            // Lauschen auf „Stopp“ oder den Rufnamen: höchstens so oft abschreiben
const PERM_SETTLE = 600;             // eine Freigabe wird erst angesagt, wenn sie so lange offen ist (die Person war schneller)
const DEFAULT_NAME = "Robo";
const PEEK_EVERY = 1200;            // Zwischenabschriften höchstens so oft (schont das Kontingent beim Anbieter)

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
  @state() private doing = "";        // was gerade nachgeschlagen wird (bleibt stehen, bis geantwortet wird)
  @state() private pose: Pose = "hello";
  @state() private live = "";         // Zwischenabschrift, während die Person noch spricht
  @state() private standby = false;   // Bereitschaft: reagiert nur noch auf den Rufnamen
  @state() private naming = false;    // fragt gerade, wie er heißen soll

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
  private director = new Director(); private bridge = new Bridge();
  private asides = new Set<string>();          // die Überbrückungssätze in der Sprache der Oberfläche
  private interim = new Map<number, Promise<string>>(); private peekAt = 0; private peeking = 0;
  private sending = false;                     // die eigene Nachricht ist unterwegs
  private oldRun = "";                         // Lauf, der beim Senden noch lief (wird gerade beendet)
  private toolSeen = false; private modelSpoke = false; private adding = false;
  private heardIn: { phase: Phase; standby: boolean } = { phase: "off", standby: false };   // wobei die Äußerung begann
  private lastWord = 0;                        // wann zuletzt jemand etwas gesagt hat (Person oder LLMitMir)
  private greetAt = 0;                         // dann begrüßen, falls bis dahin niemand etwas sagt
  private checkAt = 0;                         // letzte Abschrift beim Lauschen (Stopp, Rufname)
  private permSeen = new Map<string, number>(); private permAsked = ""; private permText = ""; private permTries = 0; private permCount = 0;
  private toolIds = new Set<string>();         // Werkzeugschritte dieser Runde (für die Ansage „jetzt …“)
  private askName = false;                     // nach dieser Runde (noch einmal) nach dem Namen fragen
  private nameAskedAt = 0;                     // wann zuletzt nach dem Namen gefragt wurde (nicht zweimal im selben Atemzug)
  private nameTries = 0;                       // wie oft nachgefragt wurde, weil die Antwort unbrauchbar war
  private mine = "";                           // Chat, den diese Ansicht selbst angelegt hat
  private resume = "";                         // letzte Antwort eines übernommenen Chats, einmal vorlesen
  private _sync = () => this.sync();

  static styles = [base, menuItemStyles, css`
    :host { display: block; height: 100%; }
    .stage { height: 100%; display: flex; flex-direction: column; position: relative; overflow: hidden; color: #fff;
      background: radial-gradient(120% 90% at 50% 38%, #3f8a69 0%, #2d6a4f 55%, #245842 100%); }
    .stage.dark { background: radial-gradient(120% 90% at 50% 38%, #1f3a2e 0%, #18221d 55%, #151515 100%); }
    .top { display: flex; align-items: center; gap: 4px; padding: 6px 8px; min-height: 52px; position: relative; z-index: 2; }
    .top b { font-family: var(--lm-head); font-size: 16px; font-weight: 600; padding-left: 6px; min-width: 0; }
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
      r.state = "hello"; r.enter();
      r.onFrame = now => {
        this.speaker?.tick(now);
        r.voiceLevel = this.speaker?.level || 0;
        r.micLevel = this.mic?.enabled ? this.mic.level || 0 : 0;
      };
      r.start();
    } catch { this.flat = true; }
    this.arrive();
  }

  /** Die Ansicht wurde geöffnet (oder ein anderes Gespräch gewählt): Chat laden und gleich zuhören. Wer hier
   *  ankommt, hat gerade irgendwo getippt – das genügt dem Browser meist, um Ton und Mikrofon freizugeben.
   *  Wenn nicht, bleibt der Knopf „Gespräch beginnen“. */
  private async arrive() {
    const id = this.chatId;
    if (id) await this.openChat(id);
    if (this.isConnected && this.chatId === id && !this.active) this.begin(true);
  }

  updated(ch: Map<string, any>) {
    if (ch.has("chatId") && (this.chatId || "") !== this.mine) {
      // anderes Gespräch gewählt (Seitenleiste, Zurück-Taste): das laufende endet
      this.endSession(); this.caption = this.heard = this.err = ""; this.resume = "";
      this.mine = this.chatId || "";
      this.robot?.enter();
      this.arrive();
    }
    if (!this.robot) return;
    this.robot.setDark(this.isDark());
    const calm = this.phase === "listening" || this.phase === "paused" || this.phase === "off";
    this.robot.state = this.err && calm && this.errShown() ? "error" : this.pose;
    // denkt nebenher: schreibt schon mit, während zugehört wird – oder arbeitet weiter, während gesprochen wird
    this.robot.working = this.peeking > 0 || (this.phase === "speaking" && !!this.ownRun());
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
      // Aus einem Chat hierher gewechselt: die letzte Antwort einmal vorlesen, damit klar ist, wo es weitergeht.
      // Danach ist sie „bekannt“ und wird nicht noch einmal gesagt.
      const last = [...(chat?.messages || [])].reverse().find((m: any) => m.role === "assistant" && m.content && !m.error);
      this.resume = last ? resumeText(String(last.content)) : "";
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
  private get name(): string { return String(store.data?.settings?.voice_name || ""); }

  /** `auto`: ohne Tippen gestartet (beim Öffnen der Ansicht) – gibt der Browser den Ton nicht frei, bleibt es still
   *  beim Knopf, ohne Fehlermeldung. */
  private async begin(auto = false) {
    if (this.starting || this.active) return;
    this.starting = true; this.err = "";
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) throw new Error(t("Dieser Browser kann hier keinen Ton aufnehmen oder abspielen."));
      this.ctx = this.ctx || new AC();
      // Safari gibt die Stimme des Browsers nur frei, wenn sie noch im Tippen selbst einmal benutzt wurde
      try { if (!auto && "speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* keine Browserstimme */ }
      const running = await Promise.race([this.ctx!.resume().then(() => true), new Promise<boolean>(r => setTimeout(() => r(false), auto ? 800 : 15000))]);
      if (auto && (!running || this.ctx!.state !== "running")) {
        try { this.ctx!.close(); } catch { /* schon zu */ } this.ctx = undefined; this.starting = false;
        return;
      }
      if (!this.tts) this.tts = await ttsSetup(store.api.hass, store.data?.speech);
      const sp = this.speaker = new Speaker(store.api.hass, this.ctx!);
      sp.lang = this.locale; sp.choice = ttsChoice(this.tts, this.cfg.tts, this.locale);
      sp.fallback = ttsFallback(this.tts, this.locale);
      sp.onSpeak = txt => { if (txt) this.caption = txt; else this.holdUntil = performance.now() + 350; this.sync(); if (!txt) setTimeout(this._sync, 380); };
      if (store.data?.transcription && Mic.supported()) {
        const mic = this.mic = new Mic();
        mic.silenceMs = this.cfg.pause;
        mic.onStart = () => this.onSpeechStart();
        mic.onPause = (wav, id) => this.onSpeechPause(wav, id);
        mic.onEnd = (wav, id) => this.onSpeechEnd(wav, id);
        await mic.start(this.ctx!);
      } else if (BrowserListener.supported()) {
        const l = this.mic = new BrowserListener();
        l.onStart = () => this.onSpeechStart();
        // Auch ohne Spracherkennung beim Anbieter gilt dieselbe Weiche: Rufname, Stopp und Freigaben werden
        // verstanden – sonst landet die Antwort auf „Wie möchtest du mich nennen?“ als Chatnachricht.
        l.onText = txt => { void this.route(txt, { phase: this.phase, standby: this.standby }); };
        l.start(this.locale);
      } else throw new Error(t("Für die Spracherkennung ist beim Anbieter kein Modell eingetragen, und dieser Browser hat keine eigene."));
      this.active = true; this.muted = false; this.silenced = true; this.quietSince = performance.now();
      this.timer = setInterval(() => this.tick(), 250);
      try { this.wake = await (navigator as any).wakeLock?.request("screen"); } catch { /* Bildschirm darf ausgehen */ }
      const now = performance.now();
      this.lastWord = now; this.standby = false; this.greetAt = 0; this.permSeen.clear(); this.permAsked = "";
      const run = this.chatId ? store.runs[this.chatId] : undefined;
      if (run) this.adopt(run);                        // der Chat arbeitet gerade: nahtlos übernehmen
      else if (!this.name) this.askForName();          // allererstes Gespräch: einmal den Rufnamen klären
      else this.greetAt = now + GREET_AFTER;           // sonst sofort zuhören; begrüßt wird nur, wer schweigt
      this.asides = new Set(BRIDGE_PHRASES.map(x => t(x)));
      if (this.cfg.bridge) sp.prefetch([...this.asides]);   // Überbrückungssätze liegen dann schon bereit
      this.sync();
    } catch (e: any) {
      const blocked = e?.name === "NotAllowedError" || e?.name === "SecurityError";
      if (auto && blocked) { this.endSession(); this.starting = false; return; }   // erst nach einem Tippen fragen dürfen
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
    this.active = false; this.pending = false; this.busy = false; this.sending = false; this.silenced = true; this.muted = false;
    this.doing = ""; this.live = ""; this.adding = false; this.toolSeen = false; this.interim.clear(); this.peeking = 0;
    this.standby = false; this.naming = false; this.greetAt = 0; this.askName = false;
    this.phase = "off"; this.pose = this.director.update(performance.now(), this.scene());
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
    this.quietSince = this.lastWord = performance.now(); this.standby = false;
    this.sync();
  }

  /** Aus einem Chat hierher gewechselt, während er noch arbeitet: Das Gespräch übernimmt den Lauf – der Roboter
   *  zeigt und sagt sofort, was gerade passiert, und liest vor, was ab jetzt an Antwort entsteht. */
  private adopt(run: any) {
    const chat = store.chats.get(this.chatId || "");
    this.known = new Set(); this.feeds.clear(); this.toolIds.clear();
    for (const m of chat?.messages || []) {
      if (m.role === "assistant" && m.streaming) this.feeds.set(m.id, new SentenceFeed().startAt(String(m.content || "")));
      else this.known.add(m.id);
    }
    this.silenced = false; this.pending = true; this.sawRun = true; this.oldRun = ""; this.pendingSince = performance.now();
    this.toolSeen = run.status === "tool"; this.modelSpoke = false; this.resume = ""; this.heard = "";
    this.bridge.begin(performance.now());
  }

  // ---------------------------------------------------------------- Rufname
  /** Einmalig beim ersten Gespräch: Wie soll der Roboter heißen? Auf diesen Namen hört er später. */
  private askForName() {
    this.naming = true; this.askName = false; this.nameAskedAt = performance.now();
    this.speaker?.say(t("Hallo! Bevor wir loslegen: Wie möchtest du mich nennen?"));
  }

  private async setName(name: string, announce = true) {
    this.naming = false; this.nameTries = 0;
    try {
      await store.api.ws("settings/save", { settings: { voice_name: name } });
      if (store.data?.settings) store.data.settings.voice_name = name;
    } catch (e: any) { this.fail(String(e?.message || e)); }
    // Erst wenn der Name wirklich angekommen ist, gilt das Fragen als erledigt – sonst fragt die Ansicht gleich
    // wieder (das war der Fehler beim ersten Gespräch: gesagt, aber nicht gespeichert).
    if (!this.name) { this.askName = true; this.nameAskedAt = performance.now(); }
    if (announce) this.speaker?.say(t("Alles klar, ich bin {n}. Sag einfach {m}, wenn du mich brauchst.", { n: name, m: name }));
    this.lastWord = performance.now();
    this.requestUpdate(); this.sync();
  }

  /** Kurz bestätigen (Stopp verstanden, Freigabe erteilt …) – ohne dass es als Antwort des Modells zählt. */
  private ack(text: string) { this.speaker?.say(t(text)); this.lastWord = performance.now(); this.sync(); }

  /** Antwort abbrechen (Tippen auf den Roboter, Dazwischenreden). */
  private interrupt() {
    if (!this.active) return;
    this.speaker?.stop();
    this.silenced = true; this.pending = false; this.adding = false; this.doing = ""; this.toolSeen = false;
    if (this.chatId && store.runs[this.chatId]) store.api.ws("chat/stop", { chat_id: this.chatId }).catch(() => undefined);
    this.holdUntil = performance.now() + 200;
    this.sync();
  }

  private tapRobot() {
    if (!this.active) { this.begin(); return; }
    if (this.phase === "speaking" || this.phase === "waiting") this.interrupt();
    else if (this.phase === "paused") this.toggleMute();
  }

  // ---------------------------------------------------------------- zuhören
  private onSpeechStart() {
    const now = performance.now();
    this.quietSince = now; this.greetAt = 0;
    this.heardIn = { phase: this.phase, standby: this.standby };
    if (this.phase === "speaking") {
      // LLMitMir spricht gerade: Nur „Stopp“ oder der Rufname unterbrechen (das klärt die Abschrift gleich) –
      // es sei denn, jedes Dazwischenreden soll unterbrechen (Einstellung, für Kopfhörer).
      if (this.cfg.bargeIn) { this.interrupt(); this.heardIn = { phase: "listening", standby: false }; }
    } else if (this.phase === "waiting") {
      // Nachschieben: LLMitMir überlegt noch. Was es inzwischen sagen wollte, wartet, bis klar ist, ob das
      // wirklich ein Nachsatz war (dann wird neu überlegt) oder nur ein Geräusch (dann geht es normal weiter).
      this.adding = true;
      if (this.speaker) this.speaker.hold = true;
    }
    this.sync();
    this.requestUpdate();
  }

  /** Kurze Pause mitten im Sprechen: schon abschreiben. Klingt der Satz fertig, endet die Äußerung früher. */
  private onSpeechPause(wav: Blob, id: number) {
    const now = performance.now();
    if (!this.active || now - this.peekAt < PEEK_EVERY) return;
    // mitschreiben lohnt nur im Gespräch selbst – nicht beim Lauschen auf Stopp, Rufname oder Ja/Nein
    const h = this.heardIn;
    if (this.naming || h.standby || !(h.phase === "listening" || h.phase === "waiting")) return;
    this.peekAt = now; this.peeking++;
    const p = store.api.transcribe(wav).then(x => x.trim()).catch(() => "");
    this.interim.set(id, p);
    p.then(txt => {
      this.peeking = Math.max(0, this.peeking - 1);
      if (!this.active || this.interim.get(id) !== p) return;
      if (txt && !isNoise(txt)) {
        this.live = txt;
        if (this.mic instanceof Mic) this.mic.endAfter(id, pauseFor(endpoint(txt), this.cfg.pause));
      }
      this.requestUpdate();
    });
    this.requestUpdate();
  }

  private async onSpeechEnd(wav: Blob | null, id = 0) {
    const pre = id ? this.interim.get(id) : undefined;
    this.interim.clear();
    if (!wav || !this.active) { this.notAdding(); return; }
    const h = this.heardIn, now = performance.now();
    // Lauschen (Bereitschaft, während LLMitMir spricht): nicht jedes Geräusch abschreiben lassen
    const checking = h.standby || h.phase === "speaking";
    if (checking) {
      if (now - this.checkAt < CHECK_EVERY) return;
      this.checkAt = now;
    } else { this.busy = true; this.sync(); }
    let txt = "";
    try {
      txt = pre ? await pre : "";                                   // die Abschrift aus der Pause gilt noch
      if (!txt) txt = (await store.api.transcribe(wav)).trim();
    } catch (e: any) { if (!checking) this.fail(String(e?.message || e)); }
    this.busy = false;
    if (!this.active) return;
    if (!txt || isNoise(txt)) { this.notAdding(); return; }
    await this.route(txt, h);
  }

  /** Was mit dem Gesagten geschieht, hängt davon ab, wobei es fiel. */
  private async route(text: string, h: { phase: Phase; standby: boolean }) {
    const name = this.name;
    const a = addressed(text, name);
    // 1. Antwort auf „Wie möchtest du mich nennen?“
    if (this.naming) {
      const n = extractName(text);
      if (n) return this.setName(n);
      if (text.trim().split(/\s+/).length > 4) {      // das war schon eine Bitte: erst erledigen, dann noch einmal fragen
        this.naming = false; this.askName = true;
        return this.sendText(text);
      }
      // „egal“, „weiß nicht“: ein Vorschlag, in den Einstellungen änderbar – aber nicht, wenn die Abschrift nur
      // verhört war („Kalle“ → „Keller“). Dann lieber einmal nachfragen, statt den Namen zu verschlucken.
      if (this.nameTries < 2 && !/^(?:egal|wei(?:ß|ss)\s+(?:ich\s+)?nicht|keine\s+ahnung|keinen?|nichts|mir\s+egal|wie\s+du\s+willst)\b/i.test(text.trim())) {
        this.nameTries++; this.askName = true; this.nameAskedAt = performance.now();
        this.speaker?.say(t("Wie soll ich heißen? Sag einfach nur den Namen."));
        this.lastWord = performance.now(); this.sync();
        return;
      }
      return this.setName(DEFAULT_NAME);
    }
    // 2. Antwort auf eine Freigabe-Frage
    const perm = this.perm();
    if (perm) {
      const ans = permAnswer(a.hit ? a.rest : text);
      this.notAdding();
      if (!ans) {
        if (this.permTries++ < 1) this.ack("Sag bitte Ja oder Nein.");
        return;
      }
      const always = ans === "always" && !perm.change && !perm.steps;
      this.permText = "";
      store.api.ws("permission/answer", { permission_id: perm.id, decision: ans === "no" ? "deny" : always ? "always" : "once" })
        .catch((e: any) => this.fail(String(e?.message || e)));
      if (ans === "no") this.ack("Gut, dann nicht.");
      else if (always) this.ack("Alles klar, das merke ich mir.");
      return;
    }
    // 3. LLMitMir sprach gerade: nur Stopp oder die Anrede zählen, alles andere war nicht für es bestimmt
    if (h.phase === "speaking") {
      const stop = isStop(text) || (a.hit && (!a.rest || isStop(a.rest)));
      if (!stop && !a.hit) return;
      this.interrupt();
      if (stop) return this.ack("Okay.");
      return this.sendText(a.rest);
    }
    // 4. LLMitMir arbeitet still: Stopp bricht ab, alles andere ist ein Nachsatz
    if (h.phase === "waiting" && (isStop(text) || (a.hit && isStop(a.rest)))) {
      this.interrupt();
      return this.ack("Okay, ich höre auf.");
    }
    // 5. Bereitschaft: nur wer den Namen sagt, meint LLMitMir
    if (h.standby) {
      if (!a.hit) return;
      this.standby = false; this.lastWord = performance.now();
      if (!a.rest) return this.ack("Ja?");
      return this.sendText(a.rest);
    }
    if (isStop(text) && h.phase === "listening") { this.lastWord = performance.now(); return; }   // nichts zu stoppen
    await this.sendText(a.hit && a.rest ? a.rest : text);
  }

  /** Doch kein Nachsatz (Geräusch): Was LLMitMir sagen wollte, kommt jetzt. */
  private notAdding() {
    this.adding = false; this.live = "";
    if (this.speaker) this.speaker.hold = false;
    this.sync();
  }

  /** Der Lauf dieser Runde (nicht ein älterer, der gerade beendet wird). */
  private ownRun() {
    const run = this.chatId ? store.runs[this.chatId] : undefined;
    return run && !this.silenced && run.run_id !== this.oldRun ? run : undefined;
  }

  private async sendText(text: string) {
    if (!this.active) return;
    // Nachsatz: LLMitMir ist noch dran – der erste Teil wird zurückgenommen und beides zusammen neu überlegt
    const amend = !!this.chatId && !this.silenced && (this.pending || this.sending || !!store.runs[this.chatId]);
    this.speaker?.stop();                         // was noch nicht gesagt ist, gilt nicht mehr
    this.adding = false; this.live = "";
    this.sending = true; this.err = ""; this.caption = "";
    this.heard = amend && this.heard ? `${this.heard} ${text}` : text;
    this.toolSeen = false; this.modelSpoke = false; this.doing = ""; this.toolIds.clear();
    this.standby = false; this.greetAt = 0; this.lastWord = performance.now();
    this.bridge.begin(performance.now());
    this.sync();
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
      this.oldRun = store.runs[this.chatId!]?.run_id || "";
      this.pending = true; this.sawRun = false; this.pendingSince = performance.now();
      await store.api.ws("chat/send", { chat_id: this.chatId, text, voice: true, ...(amend ? { amend: true } : {}),
        ...(model && model !== chat?.model ? { model } : {}) });
    } catch (e: any) { this.pending = false; this.fail(String(e?.message || e)); }
    this.sending = false; this.quietSince = performance.now();
    this.sync();
  }

  // ---------------------------------------------------------------- antworten
  /** Neue Sätze der Antwort an die Stimme geben – schon während sie entsteht. */
  private feed() {
    if (this.silenced || !this.chatId || !this.speaker) return;
    const chat = store.chats.get(this.chatId);
    for (const m of chat?.messages || []) {
      if (this.known.has(m.id)) continue;
      if (m.role === "tool") { this.toolSeen = true; this.toolIds.add(m.id); continue; }
      if (m.role !== "assistant") continue;
      let f = this.feeds.get(m.id);
      if (!f) this.feeds.set(m.id, f = new SentenceFeed());
      if (m.error) {
        if (!f.closed) { f.closed = true; this.fail(String(m.error)); this.speaker.say(t("Das hat gerade leider nicht geklappt.")); }
        continue;
      }
      for (const piece of f.push(m.content || "", !m.streaming)) { this.modelSpoke = true; this.speaker.say(piece); }
    }
  }

  // auch Freigaben aus Teilaufgaben: im Gespräch mit dem Hauptchat beantworten
  private perm() { return this.chatId ? store.permissions.find(p => p.chat_id === this.chatId || p.root_chat_id === this.chatId) : undefined; }

  /** Was die Gestenregie wissen muss. */
  private scene() {
    const sp = this.speaker;
    // Ein Überbrückungssatz ist nur eine Bemerkung nebenbei: Der Roboter bleibt bei dem, was er gerade tut
    // (nachschlagen, überlegen) und bewegt nur den Mund – er spricht, während er weiterarbeitet.
    const aside = !!sp?.sounding && this.asides.has(this.caption) && !!this.ownRun();
    return { on: this.active, muted: this.muted, hearing: !!this.mic?.hearing && !!this.mic?.enabled,
      speaking: !!sp?.sounding && !aside, asking: !!this.perm() && !sp?.busy, aside,
      waiting: this.phase === "waiting" || (this.phase === "speaking" && (!sp?.sounding || aside)), tool: this.toolSeen,
      standby: this.standby && this.phase === "listening" };
  }

  /** Aus dem Stand von Chat, Stimme und Mikrofon ableiten, wer dran ist. */
  private sync() {
    if (!this.active) return;
    const now = performance.now();
    // Nachsatz ohne Ende (das Mikrofon wurde mittendrin geschlossen): Was LLMitMir sagen wollte, kommt jetzt
    if (this.adding && !this.mic?.hearing && !this.busy && !this.sending) { this.adding = false; this.live = ""; if (this.speaker) this.speaker.hold = false; }
    this.feed();
    const any = this.chatId ? store.runs[this.chatId] : undefined;
    const run = this.ownRun();
    if (run) this.sawRun = true;
    if (this.pending && !this.sending && !any && (this.sawRun || now - this.pendingSince > 20000)) this.pending = false;
    const perm = this.perm();
    if (perm && !this.permSeen.has(perm.id)) this.permSeen.set(perm.id, now);
    if (!perm && this.permText) {
      // beantwortet (am Bildschirm oder per Stimme): Die Frage ist erledigt – nicht mehr stellen
      if (this.speaker?.busy && (this.caption === this.permText || !this.speaker.sounding)) this.speaker.stop();
      this.permText = "";
    }
    // Nachschlagen merken: Die Anzeige bleibt dabei, auch wenn das Modell zwischen zwei Werkzeugen kurz „denkt“
    if (run?.status === "tool") {
      this.toolSeen = true;
      const d: any = run.detail || {};
      const prog = store.chats.get(this.chatId || "")?.progress || [];
      const step = prog.find((p: any) => p.status === "laeuft");
      this.doing = step?.text ? `${step.text} …`
        : DOING[d.tool ? store.data?.tools?.[d.tool]?.group : ""] || (isSimple() || !d.label ? "Ich schaue nach …" : `${d.label} …`);
    }
    let ph: Phase;
    if (this.speaker?.busy && !this.speaker.hold) ph = "speaking";
    else if (perm) ph = "permission";
    else if (run || this.pending || this.sending || this.busy || this.adding) ph = "waiting";
    else ph = this.muted ? "paused" : "listening";
    if (ph !== this.phase) {
      if (ph === "listening") { this.quietSince = this.lastWord = now; this.doing = ""; this.toolSeen = false; }
      this.phase = ph;
    }
    if (this.mic) {
      // Das Mikrofon ist immer offen, solange das Gespräch läuft – auch während LLMitMir spricht oder arbeitet
      // (dann unempfindlicher und nur auf der Suche nach „Stopp“ oder dem Rufnamen). So lässt es sich jederzeit
      // unterbrechen, ohne den Bildschirm zu berühren.
      const m = this.mic, talking = ph === "speaking";
      m.enabled = !this.muted && ph !== "paused" && (talking ? m instanceof Mic : now >= this.holdUntil);
      if (m instanceof Mic && !m.hearing) {
        m.sensitivity = talking ? 2.6 : ph === "waiting" ? 1.5 : this.standby ? 1.4 : ph === "permission" ? 1.2 : 1;
        m.silenceMs = talking ? 500 : ph === "permission" || this.naming ? 800 : this.standby ? 900 : this.cfg.pause;
        m.maxMs = talking ? 3000 : ph === "permission" ? 8000 : this.standby ? 15000 : 120000;
      }
    }
    const pose = this.director.update(now, this.scene());
    if (pose !== this.pose) this.pose = pose;
  }

  private tick() {
    if (!this.active) return;
    const now = performance.now();
    this.sync();
    const sp = this.speaker;
    if (!sp) return;
    const quietListening = this.phase === "listening" && !this.mic?.hearing && !sp.busy && !this.busy;
    // Wer nach dem Start nichts sagt, wird begrüßt (oder hört, wo der übernommene Chat stand)
    if (this.greetAt && now >= this.greetAt && quietListening && !this.naming) {
      this.greetAt = 0;
      this.ack(this.resume || "Hallo! Was kann ich für dich tun?"); this.resume = "";
    }
    // Die Bitte von eben ist erledigt: jetzt (noch einmal) nach dem Namen fragen
    if (this.askName && quietListening && !this.name && now - this.lastWord > 1500
        && now - this.nameAskedAt > 4000) this.askForName();   // nicht zweimal im selben Atemzug fragen
    // Gesprächspause: ab jetzt nur noch auf den Rufnamen hören, sonst einfach warten
    if (!this.standby && quietListening && !this.naming && !this.greetAt && this.name && now - this.lastWord > DIALOG_WINDOW) {
      this.standby = true; this.live = ""; this.sync();
    }
    // Freigabe: laut fragen – aber erst, wenn sie einen Moment offen ist (wer schon getippt hat, wird nicht mehr gefragt)
    const perm = this.perm();
    if (perm && !this.silenced && this.permAsked !== perm.id && now - (this.permSeen.get(perm.id) || now) >= PERM_SETTLE && !this.mic?.hearing) {
      this.permAsked = perm.id; this.permTries = 0;
      this.permText = this.permQuestion(perm);
      sp.say(this.permText); this.sync();
    }
    // Stille überbrücken und bei längerer Arbeit sagen, was gerade geschieht – wer den Bildschirm nicht sieht,
    // weiß so jederzeit Bescheid und kann mit „Stopp“ abbrechen
    if (!this.cfg.bridge || this.silenced || this.adding || perm) return;
    const run = this.ownRun();
    const tool = run?.status === "tool" ? run.detail?.tool : undefined;
    const say = this.bridge.next(now, {
      waiting: this.phase === "waiting" && !this.busy && !this.mic?.hearing, speaking: sp.busy, modelSpoke: this.modelSpoke,
      group: tool ? store.data?.tools?.[tool]?.group || "" : undefined, step: tool ? `${this.toolIds.size}` : undefined,
      congested: run?.status === "retry" || run?.status === "quota_wait" });
    if (say) { sp.say(t(say)); this.sync(); }
  }

  /** Die Freigabe-Frage in Worten – was genau erlaubt werden soll und wie man antwortet. */
  private permQuestion(p: any): string {
    const verb = ({ anlegen: "anlegen", aendern: "ändern", loeschen: "löschen" } as any)[p.change?.aktion] || "ändern";
    const what = p.change ? t("Soll ich {w} „{n}“ {v}?", { w: CHANGE_WHAT[p.change.art] || p.change.art, n: p.change.name, v: verb })
      : p.steps || p.tool === "more_steps" ? t("Das waren schon viele Schritte. Soll ich weitermachen?")
      : p.group ? t("Darf ich dafür {g} benutzen?", { g: p.group_label || p.group })
      : t("Darf ich das tun: {l}?", { l: p.label || p.tool });
    if (p.change || p.steps || p.tool === "more_steps") return `${what} ${t("Sag Ja oder Nein.")}`;
    // die ersten Male erklären, was „immer“ bedeutet; danach genügt die kurze Form
    return `${what} ${t(this.permCount++ < 2 ? "Sag Ja, Nein – oder Immer, dann frage ich in Gesprächen nicht mehr danach." : "Ja, Nein oder Immer?")}`;
  }

  // ---------------------------------------------------------------- Anzeige
  /** Die Zeile unter dem Roboter. Sie folgt der Geste, nicht jedem Zwischenschritt – kurze Wartezeiten
   *  bleiben ohne Text, „Ich überlege“ erscheint erst, wenn es wirklich dauert. */
  private statusText(): any {
    const run = this.ownRun();
    if (!this.active) return this.starting ? html`${t("Einen Moment")}<span class="dots"></span>` : nothing;
    if (this.phase === "paused") return t("Pause – tippe auf das Mikrofon, wenn es weitergehen soll");
    if (this.phase === "permission") return t("Ich warte auf deine Bestätigung");
    if (this.naming) return t("Wie möchtest du mich nennen?");
    if (this.phase === "listening" && this.standby) return t("Sag „{n}“, wenn du mich brauchst", { n: this.name });
    if (this.phase === "listening") return this.mic?.hearing || this.live ? t("Ich höre zu") : t("Ich höre zu – sprich einfach los");
    if (this.phase !== "waiting") return nothing;
    if (this.mic?.hearing && this.mic.enabled) return t("Ich höre zu");
    if (run?.status === "retry" || run?.status === "quota_wait") return html`${t("Gerade ist viel los – einen Moment")}<span class="dots"></span>`;
    if (this.pose === "researching") return t(this.doing || "Ich schaue nach …");
    if (this.pose === "thinking") return html`${t("Ich überlege noch")}<span class="dots"></span>`;
    return nothing;
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
      ${p.steps ? nothing : html`<div class="hint">${t("Du kannst auch einfach antworten: Ja, Nein – oder Immer. Einmal Ja gilt für den Rest des Gesprächs.")}</div>`}
      <div class="brow"><button class="btn primary" @click=${() => answer("once")}>${icon("check", 16)} ${del ? "Ja, löschen" : "Ja"}</button>
        ${p.change || p.steps ? nothing : html`<button class="btn" @click=${() => answer("always")}>${t("Immer")}</button>`}
        <button class="btn" @click=${() => answer("deny")}>Nein</button>
        <button class="btn ghost" @click=${() => { const id = this.chatId; this.endSession(); navigate(`/chat/${id}`); }}>${icon("eye", 16)} ${t("Im Chat ansehen")}</button></div></div>`;
  }

  private voiceLabel(): string {
    if (!this.tts) return t("Automatisch");
    return `${t("Automatisch")} (${this.choiceName(ttsChoice(this.tts, "auto", this.locale))})`;
  }

  /** Name einer Stimme für die Auswahlliste. */
  private choiceName(c: TtsChoice): string {
    const s = this.tts;
    if (c.kind === "robot") {
      const v = s?.robotVoices?.find(x => x.id === c.voice);
      return v ? `${v.label} (${v.name})` : t("Roboterstimme");
    }
    if (c.kind === "ha") return s?.engines.find(e => e.id === c.engine)?.name || c.engine;
    return c.kind === "browser" ? t("Stimme des Browsers") : t("nur Text");
  }

  /** Die gewaehlte Stimme einmal anhoeren – auch ohne laufendes Gespraech. */
  private async testVoice() {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      await ctx.resume();
      if (!this.tts) this.tts = await ttsSetup(store.api.hass, store.data?.speech);
      const sp = new Speaker(store.api.hass, ctx);
      sp.lang = this.locale; sp.choice = ttsChoice(this.tts, this.cfg.tts, this.locale);
      sp.fallback = ttsFallback(this.tts, this.locale);
      sp.say(t("Hallo! Ich bin LLMitMir. So klinge ich."));
      // warten, bis der Satz gesprochen ist, dann den Ton wieder freigeben
      const wait = setInterval(() => { if (!sp.busy) { clearInterval(wait); ctx.close().catch(() => undefined); } }, 300);
      setTimeout(() => { clearInterval(wait); ctx.close().catch(() => undefined); }, 30000);
    } catch (e: any) { this.fail(String(e?.message || e)); }
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
    if (!s) ttsSetup(store.api.hass, store.data?.speech).then(r => (this.tts = r));
    const models = (store.data?.models || []).filter((m: any) => m.status !== "unavailable" && !(m.external && (m.locked || !m.usable)));
    return html`<div class="sheet" @click=${(e: Event) => e.target === e.currentTarget && (this.sheet = false)}>
      <div class="sheetcard">
        <div class="row"><b class="grow">${t("Gespräch")} – ${t("Einstellungen")}</b>
          <button class="iconbtn" title=${t("Schließen")} @click=${() => (this.sheet = false)}>${icon("close", 18)}</button></div>
        <label class="f"><span>${t("Stimme")}</span>
          <select .value=${this.cfg.tts} @change=${(e: any) => this.save({ tts: e.target.value })}>
            <option value="auto" ?selected=${this.cfg.tts === "auto"}>${this.voiceLabel()}</option>
            ${(s?.robotVoices || []).map(v => html`<option value="robot:${v.id}" ?selected=${this.cfg.tts === `robot:${v.id}`}>${v.label} (${v.name})</option>`)}
            ${(s?.engines || []).map(e => html`<option value=${e.id} ?selected=${this.cfg.tts === e.id}>${e.name}</option>`)}
            ${s?.browser ? html`<option value="browser" ?selected=${this.cfg.tts === "browser"}>${t("Stimme des Browsers")}</option>` : nothing}
            <option value="off" ?selected=${this.cfg.tts === "off"}>${t("Ohne Stimme (nur Text)")}</option></select>
          <span class="hint" style="font-weight:400">${s?.robot
            ? t("„Automatisch“ nimmt die Roboterstimme – sie klingt auf jedem Gerät gleich. Zur Wahl stehen außerdem die männliche Stimme (tiefer, ohne Maschinenklang) und eine natürliche weibliche Stimme.")
            : t("Die Stimme des Roboters ist nicht eingerichtet; es liest die Sprachausgabe von Home Assistant oder der Browser.")}</span>
          <button class="btn" @click=${() => this.testVoice()}>${icon("play", 16)} ${t("Stimme anhören")}</button></label>
        <label class="f"><span>${t("Wie lange darf eine Sprechpause sein?")}</span>
          <span class="hint" style="font-weight:400">${t("Klingt ein Satz fertig, antwortet LLMitMir schon früher; bricht er mitten im Gedanken ab, wartet es etwas länger.")}</span>
          <select @change=${(e: any) => this.save({ pause: Number(e.target.value) })}>
            ${[[800, t("Kurz – antwortet schnell")], [1200, t("Normal")], [2000, t("Lang – lässt Zeit zum Überlegen")]].map(([v, l]) =>
              html`<option value=${v} ?selected=${this.cfg.pause === v}>${l}</option>`)}</select></label>
        <label class="f"><span>${t("Rufname")}</span>
          <input .value=${this.name} maxlength="24" placeholder=${DEFAULT_NAME} @change=${(e: any) => { const n = extractName(e.target.value) || DEFAULT_NAME; e.target.value = n; this.setName(n, false); }}>
          <span class="hint" style="font-weight:400">${t("Auf diesen Namen hört der Roboter. Nach einer Gesprächspause reagiert er nur noch, wenn du ihn so ansprichst – so kann das Gespräch lange nebenher laufen, etwa im Auto. „Stopp“ unterbricht ihn jederzeit.")}</span></label>
        <label class="chk"><input type="checkbox" .checked=${this.cfg.bargeIn} @change=${(e: any) => this.save({ bargeIn: e.target.checked })}>
          <span>${t("Jedes Dazwischenreden unterbricht die Antwort")}<div class="hint">${t("Sonst unterbrechen nur „Stopp“ und der Rufname. Am besten mit Kopfhörern – sonst hört LLMitMir sich womöglich selbst.")}</div></span></label>
        <label class="chk"><input type="checkbox" .checked=${this.cfg.bridge} @change=${(e: any) => this.save({ bridge: e.target.checked })}>
          <span>${t("Wartezeiten mit einem kurzen Satz überbrücken")}<div class="hint">${t("Zum Beispiel „Ich schaue kurz nach.“ – statt still zu warten.")}</div></span></label>
        <label class="chk"><input type="checkbox" .checked=${this.cfg.captions} @change=${(e: any) => this.save({ captions: e.target.checked })}>
          <span>${t("Gesprochenes als Text mitlesen")}</span></label>
        ${isSimple() ? nothing : html`<label class="f"><span>${t("Modell")}</span>
          <select @change=${(e: any) => this.pickModel(e.target.value)}>
            <option value="" ?selected=${!this.cfg.model}>${t("Automatisch – das schnellste passende Modell")}${store.data?.defaults?.voice ? ` (${modelName(store.data.defaults.voice)})` : ""}</option>
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
      <div class="top"><slot name="menu"></slot><b class="grow ellipsis">${chat?.title || t("Gespräch")}</b>
        ${model ? html`<span class="chipw" title=${t("Modell")}>${model}</span>` : nothing}
        ${this.chatId ? html`<button class="iconbtn" title=${t("Im Chat ansehen")} @click=${() => { const id = this.chatId; this.endSession(); navigate(`/chat/${id}`); }}>${icon("chat")}</button>` : nothing}
        <button class="iconbtn" title=${t("Einstellungen")} @click=${() => (this.sheet = true)}>${icon("settings")}</button></div>
      <div class="bot" @click=${() => this.tapRobot()} title=${on ? t("Tippen unterbricht die Antwort") : t("Gespräch beginnen")}>
        <canvas aria-label=${t("Der Roboter von LLMitMir")} role="img"></canvas>
        ${this.flat ? html`<div class="flat"><lm-spark size="220" style="color:#fff"></lm-spark></div>` : nothing}</div>
      ${this.permCard()}
      <div class="say" role="status" aria-live="polite">
        ${this.err ? html`<div class="errline">${icon("alert", 16)}<span>${this.err}</span></div>` : nothing}
        ${on && this.cfg.captions && this.live && (this.phase === "listening" || this.adding) ? html`<div class="heard">„${this.live} …“</div>`
          : on && this.cfg.captions && this.heard && this.phase === "waiting" ? html`<div class="heard">„${this.heard}“</div>` : nothing}
        ${on && this.cfg.captions && this.caption && (this.phase === "speaking" || this.phase === "listening")
          ? html`<div class="cap ${this.phase === "speaking" ? "" : "old"}">${this.caption}</div>` : nothing}
        <div class="status">${this.statusText()}</div>
        ${!on && !this.starting ? html`<div><button class="startbtn" @click=${() => this.begin()}>${icon("mic", 22)} ${this.chatId ? t("Gespräch fortsetzen") : t("Gespräch beginnen")}</button></div>
          ${this.chatId ? html`<div class="hint" style="color:rgba(255,255,255,.72)">${t("Das Gespräch setzt diesen Chat fort – der Verlauf bleibt erhalten.")}</div>` : nothing}
          ${last ? html`<div><button class="resume" @click=${() => navigate(`/voice/${last.id}`)}>${t("Letztes Gespräch fortsetzen")}: ${last.title || t("Neuer Chat")}</button></div>` : nothing}` : nothing}
      </div>
      <div class="ctl">
        ${on ? html`
          <button class="rb" title=${t("Antwort unterbrechen")} ?disabled=${!(this.phase === "speaking" || this.phase === "waiting")}
            @click=${() => this.interrupt()}>${icon("stop", 24)}</button>
          <button class="rb main ${this.muted ? "off" : ""}" title=${this.muted ? t("Mikrofon einschalten") : t("Mikrofon aus (Pause)")} aria-pressed=${this.muted}
            @click=${() => this.toggleMute()}>${icon(this.muted ? "micOff" : "mic", 30)}</button>
          <button class="rb end" title=${t("Gespräch beenden")} @click=${() => this.hangUp()}>${icon("hangup", 24)}</button>` : nothing}
      </div>
      ${this.sheet ? this.settings() : nothing}
    </div>`;
  }
}
