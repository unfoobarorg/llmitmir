// Sprachgespräch: Mikrofon mit Erkennung von Sprechpausen und das Vorlesen der Antworten.
//
// Zuhören: Das Mikrofon bleibt während des Gesprächs offen. Was die Person sagt, wird am Pegel erkannt
// (Sprache beginnt, Sprechpause = fertig) und als WAV an die Spracherkennung des Anbieters geschickt –
// niemand muss eine Taste halten. Solange LLMitMir selbst spricht oder arbeitet, wird nichts aufgenommen.
//
// Vorlesen: zuerst mit der festen Stimme von LLMitMir (der Roboter-Stimme, auf dem Server gesprochen) – sie
// klingt auf jedem Gerät gleich und funktioniert auch in der Companion-App auf Android, deren Webansicht keine
// eigene Sprachausgabe hat. Ist sie nicht eingerichtet, mit der Sprachausgabe von Home Assistant (die Stimme des
// Sprachassistenten, z. B. Piper oder Home Assistant Cloud), sonst mit der Stimme des Browsers.
import { encodeWav } from "./ui";

type Hass = any;

// ------------------------------------------------------------------ Mikrofon
export class Mic {
  /** Pegel fürs Auge (0..1). */
  level = 0;
  /** Die Person spricht gerade. */
  hearing = false;
  /** Nur wenn eingeschaltet, wird Sprache erkannt und aufgenommen. */
  enabled = false;
  /** So lange Stille beendet eine Äußerung (ms). */
  silenceMs = 1200;
  /** > 1: unempfindlicher (beim Dazwischenreden, während LLMitMir selbst spricht). */
  sensitivity = 1;
  /** Nach so viel Stille gibt es schon einen Zwischenstand (`onPause`) – lange vor dem Ende der Äußerung. */
  peekMs = 450;
  onStart?: () => void;
  /** Kurze Pause mitten in der Äußerung: das bisher Gesagte, damit schon mitgedacht werden kann.
   *  `id` kennzeichnet den Zwischenstand; `onEnd` nennt ihn wieder, wenn danach nichts mehr gesagt wurde. */
  onPause?: (wav: Blob, id: number) => void;
  /** Äußerung fertig; `null`, wenn es doch nur ein Geräusch war. `id` > 0: Sie ist dieselbe wie der
   *  Zwischenstand mit dieser Nummer (danach kam nur noch Stille) – dessen Abschrift gilt also weiter. */
  onEnd?: (wav: Blob | null, id: number) => void;

  private stream?: MediaStream; private src?: MediaStreamAudioSourceNode; private proc?: ScriptProcessorNode;
  private rate = 48000;
  private noise = 0.008;
  private pre: Float32Array[] = [];
  private chunks: Float32Array[] = [];
  private voiced = 0; private silence = 0; private total = 0;
  private fresh = 0;        // gesprochene Zeit seit dem letzten Zwischenstand
  private peeked = false;   // für die laufende Pause gibt es schon einen Zwischenstand
  private snap = 0; private seq = 0;
  private cut = 0;          // für die laufende Pause gilt diese (kürzere oder längere) Wartezeit

  /** Die Abschrift des Zwischenstands `id` ist da: Die laufende Pause endet nach `ms` Stille statt nach
   *  `silenceMs` – kürzer, wenn der Satz fertig klingt, länger, wenn er mitten im Gedanken abbricht.
   *  Gilt nur, solange seither nichts mehr gesagt wurde. */
  endAfter(id: number, ms: number) { if (this.hearing && id === this.snap && this.fresh === 0) this.cut = ms; }

  static supported() { return typeof navigator.mediaDevices?.getUserMedia === "function"; }

  async start(ctx: AudioContext) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    this.rate = ctx.sampleRate;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.proc = ctx.createScriptProcessor(2048, 1, 1);
    this.proc.onaudioprocess = e => this.block(e.inputBuffer.getChannelData(0));
    this.src.connect(this.proc); this.proc.connect(ctx.destination);
  }

  stop() {
    this.proc?.disconnect(); this.src?.disconnect();
    if (this.proc) this.proc.onaudioprocess = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined; this.reset(); this.level = 0;
  }

  /** Mikrofon stumm (Pause): das Betriebssystem zeigt dann auch keine Aufnahme mehr an. */
  setMuted(m: boolean) { this.stream?.getAudioTracks().forEach(t => (t.enabled = !m)); if (m) { this.reset(); this.level = 0; } }

  private reset() { this.hearing = false; this.chunks = []; this.pre = []; this.voiced = 0; this.silence = 0; this.total = 0; this.fresh = 0; this.peeked = false; this.snap = 0; this.cut = 0; }

  private block(d: Float32Array) {
    let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
    const rms = Math.sqrt(s / (d.length / 4));
    const ms = d.length / this.rate * 1000;
    this.level = Math.min(1, rms * 7);
    if (!this.enabled) { if (this.hearing || this.pre.length) this.reset(); return; }
    // Grundrauschen des Raums mitführen: schnell nach unten, langsam nach oben
    if (!this.hearing) this.noise += (rms - this.noise) * (rms < this.noise ? 0.3 : 0.004);
    const thr = Math.max(0.011, this.noise * 3.2) * this.sensitivity;
    const copy = new Float32Array(d);
    if (!this.hearing) {
      this.pre.push(copy);
      if (this.pre.length * ms > 500) this.pre.shift();     // eine halbe Sekunde Vorlauf, damit der Satzanfang nicht fehlt
      this.voiced = rms > thr ? this.voiced + ms : Math.max(0, this.voiced - ms * 0.6);
      if (this.voiced >= 140 * Math.min(2, this.sensitivity)) {
        this.hearing = true; this.chunks = this.pre; this.pre = []; this.silence = 0; this.total = this.fresh = this.voiced;
        this.onStart?.();
      }
      return;
    }
    this.chunks.push(copy);
    if (rms > thr * 0.65) { this.silence = 0; this.total += ms; this.fresh += ms; this.peeked = false; this.cut = 0; }
    else this.silence += ms;
    const trimmed = (keepMs: number) => this.chunks.slice(0, Math.max(1, this.chunks.length - Math.floor(Math.max(0, this.silence - keepMs) / ms)));
    // kurze Pause: Zwischenstand herausgeben, damit schon abgeschrieben und mitgedacht werden kann
    if (!this.peeked && this.onPause && this.silence >= this.peekMs && this.fresh >= 250 && this.total >= 280) {
      this.peeked = true; this.fresh = 0; this.snap = ++this.seq;
      this.onPause(encodeWav(trimmed(300), this.rate), this.snap);
    }
    if (this.silence >= (this.cut || this.silenceMs) || this.chunks.length * ms > 120000) {
      const chunks = trimmed(350), enough = this.total >= 280;                // Stille am Ende kürzen
      const id = this.peeked && this.fresh === 0 ? this.snap : 0;
      this.reset();
      this.onEnd?.(enough ? encodeWav(chunks, this.rate) : null, enough ? id : 0);
    }
  }
}

/** Ersatz ohne Spracherkennung beim Anbieter: die des Browsers (liefert gleich Text, keinen Pegel). */
export class BrowserListener {
  enabled = false; hearing = false; level = 0;
  onStart?: () => void; onText?: (text: string) => void;
  private rec: any; private alive = false;
  static supported() { return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition); }
  start(lang: string) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = this.rec = new SR(); r.lang = lang; r.interimResults = false; r.continuous = false;
    r.onspeechstart = () => { if (this.enabled) { this.hearing = true; this.level = 0.5; this.onStart?.(); } };
    r.onresult = (e: any) => { const txt = e.results?.[e.results.length - 1]?.[0]?.transcript || ""; if (this.enabled && txt) this.onText?.(txt); };
    r.onend = () => { this.hearing = false; this.level = 0; if (this.alive) setTimeout(() => this.spin(), 250); };
    r.onerror = () => { /* onend folgt und startet neu */ };
    this.alive = true; this.spin();
  }
  private spin() { if (!this.alive || !this.enabled) { if (this.alive) setTimeout(() => this.spin(), 300); return; } try { this.rec.start(); } catch { /* läuft schon */ } }
  setMuted(_m: boolean) { try { this.rec?.abort(); } catch { /* nicht gestartet */ } }
  stop() { this.alive = false; try { this.rec?.abort(); } catch { /* nicht gestartet */ } }
}

// ------------------------------------------------------------------ Stimmen
export interface TtsEngine { id: string; name: string; languages: string[]; }
/** Eine der festen Stimmen von LLMitMir (auf dem Server gesprochen). */
export interface RobotVoice { id: string; label: string; name: string; effect: boolean; }
export interface TtsSetup { engines: TtsEngine[]; preferred?: { engine: string; language?: string; voice?: string }; browser: boolean;
  /** Die festen Stimmen von LLMitMir stehen bereit. */
  robot?: boolean; robotVoices?: RobotVoice[]; robotDefault?: string; }
export type TtsChoice = { kind: "robot"; voice: string; effect: boolean }
  | { kind: "ha"; engine: string; language?: string; voice?: string } | { kind: "browser" } | { kind: "none" };

const browserTts = () => typeof window.speechSynthesis !== "undefined" && typeof (window as any).SpeechSynthesisUtterance !== "undefined";

/** Welche Stimmen gibt es? Sprachausgaben von Home Assistant, die des bevorzugten Sprachassistenten und der Browser. */
export async function ttsSetup(hass: Hass, speech?: { available?: boolean; voices?: RobotVoice[]; default?: string }): Promise<TtsSetup> {
  const out: TtsSetup = { engines: [], browser: browserTts() };
  if (speech) {
    out.robot = !!speech.available;
    out.robotVoices = speech.voices || [];
    out.robotDefault = speech.default || out.robotVoices[0]?.id;
  }
  try {
    const r = await hass.callWS({ type: "tts/engine/list" });
    out.engines = (r?.providers || []).filter((p: any) => !p.deprecated).map((p: any) => ({ id: p.engine_id,
      name: p.name || hass.states?.[p.engine_id]?.attributes?.friendly_name || p.engine_id, languages: p.supported_languages || [] }));
  } catch { /* keine Sprachausgabe in Home Assistant eingerichtet */ }
  try {
    const r = await hass.callWS({ type: "assist_pipeline/pipeline/list" });
    const pl = (r?.pipelines || []).find((x: any) => x.id === r.preferred_pipeline) || r?.pipelines?.[0];
    if (pl?.tts_engine && out.engines.some(e => e.id === pl.tts_engine))
      out.preferred = { engine: pl.tts_engine, language: pl.tts_language || undefined, voice: pl.tts_voice || undefined };
  } catch { /* kein Sprachassistent eingerichtet */ }
  return out;
}

const langOf = (e: TtsEngine, lang: string) => {
  const l = (lang || "de").toLowerCase().slice(0, 2);
  return e.languages.find(x => x.toLowerCase() === l) || e.languages.find(x => x.toLowerCase().startsWith(l));
};

/** Eine der festen Stimmen von LLMitMir (Vorgabe: die Roboterstimme). */
export function robotChoice(setup: TtsSetup, id?: string): TtsChoice | null {
  if (!setup.robot) return null;
  const list = setup.robotVoices || [];
  const v = list.find(x => x.id === id) || list.find(x => x.id === setup.robotDefault) || list[0];
  return v ? { kind: "robot", voice: v.id, effect: !!v.effect } : null;
}

/** Einstellung („auto“, „robot:<id>“, „browser“, „off“ oder eine Sprachausgabe von Home Assistant) in eine Stimme auflösen. */
export function ttsChoice(setup: TtsSetup, setting: string, lang: string): TtsChoice {
  if (setting === "off") return { kind: "none" };
  if (setting === "browser") return setup.browser ? { kind: "browser" } : { kind: "none" };
  const robot = (id?: string): TtsChoice | null => (lang || "de").toLowerCase().startsWith("de") ? robotChoice(setup, id) : null;
  if (setting === "robot" || setting.startsWith("robot:")) {
    const c = robot(setting.includes(":") ? setting.split(":")[1] : undefined);
    if (c) return c;
  }
  const pick = (e?: TtsEngine): TtsChoice | null => e ? { kind: "ha", engine: e.id,
    ...(setup.preferred?.engine === e.id ? { language: setup.preferred.language, voice: setup.preferred.voice } : { language: langOf(e, lang) }) } : null;
  if (setting && setting !== "auto") { const c = pick(setup.engines.find(e => e.id === setting)); if (c) return c; }
  // „Automatisch“: die eigene Stimme zuerst – sie klingt überall gleich und ist auf jedem Gerät da
  return robot()
    || pick(setup.engines.find(e => e.id === setup.preferred?.engine))
    || pick(setup.engines.find(e => !!langOf(e, lang)))
    || (setup.browser ? { kind: "browser" } : pick(setup.engines[0]) || { kind: "none" });
}

/** Was liest vor, wenn die feste Stimme nicht erreichbar ist? (Sprachausgabe von Home Assistant, sonst Browser.) */
export function ttsFallback(setup: TtsSetup, lang: string): TtsChoice {
  const pick = (e?: TtsEngine): TtsChoice | null => e ? { kind: "ha", engine: e.id,
    ...(setup.preferred?.engine === e.id ? { language: setup.preferred.language, voice: setup.preferred.voice } : { language: langOf(e, lang) }) } : null;
  return pick(setup.engines.find(e => e.id === setup.preferred?.engine))
    || pick(setup.engines.find(e => !!langOf(e, lang)))
    || (setup.browser ? { kind: "browser" } : pick(setup.engines[0]) || { kind: "none" });
}

// ------------------------------------------------------------------ Vorlesen
interface Item { text: string; audio?: Promise<AudioBuffer | null>; }

export class Speaker {
  /** Lautstärke der Stimme (0..1) – bewegt den Mund des Roboters. */
  level = 0;
  choice: TtsChoice = { kind: "none" };
  /** Wenn die feste Stimme nicht erreichbar ist, liest diese hier (statt gar nichts). */
  fallback?: TtsChoice;
  lang = "de";
  /** Wird aufgerufen, wenn ein Stück beginnt (Untertitel) und wenn alles gesagt ist (`null`). */
  onSpeak?: (text: string | null) => void;
  private queue: Item[] = [];
  private playing = false;
  private gen = 0;
  private node?: AudioBufferSourceNode;
  private osc?: OscillatorNode;
  private analyser: AnalyserNode;
  private buf: Uint8Array;
  private fake = 0;           // Stimme ohne messbaren Pegel (Browser): Mundbewegung nachahmen
  private failed = false;
  private ready = new Map<string, Promise<AudioBuffer | null>>();   // vorab erzeugte Sätze (Überbrückung)
  private _hold = false;
  /** Die Stimme ist gerade zu hören (nicht nur vorgemerkt). */
  sounding = false;
  /** Wann zuletzt etwas zu hören war (performance.now()). */
  lastSound = -1e9;

  constructor(private hass: Hass, private ctx: AudioContext) {
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512; this.analyser.smoothingTimeConstant = 0.3;
    this.analyser.connect(ctx.destination);
    this.buf = new Uint8Array(this.analyser.fftSize);
  }

  get busy() { return this.playing || this.queue.length > 0; }

  /** Anhalten, bevor der nächste Satz beginnt (die Person spricht gerade dazwischen); `false` setzt fort. */
  set hold(v: boolean) { this._hold = v; if (!v) this.pump(); }
  get hold() { return this._hold; }

  /** Sätze vorab erzeugen (nacheinander, im Hintergrund), damit sie später ohne Verzögerung kommen. */
  async prefetch(texts: string[]) {
    const gen = this.gen, c = this.choice;
    if (c.kind !== "ha" && c.kind !== "robot") return;
    for (const text of texts) {
      if (gen !== this.gen || this.choice !== c) return;
      if (this.ready.has(text)) continue;
      const p = this.synth(text, c).catch(() => null);
      this.ready.set(text, p);
      if (!(await p)) { this.ready.delete(text); return; }     // Stimme nicht erreichbar: nicht weiter anklopfen
    }
  }

  say(text: string) {
    if (!text.trim()) return;
    const item: Item = { text };
    if (this.choice.kind === "ha" || this.choice.kind === "robot") item.audio = this.ready.get(text) || this.synth(text, this.choice).catch(() => null);
    this.queue.push(item);
    this.pump();
  }

  stop() {
    this.gen++; this.queue = []; this.playing = false; this.fake = 0; this.level = 0; this._hold = false;
    if (this.sounding) this.lastSound = performance.now();
    this.sounding = false;
    try { this.node?.stop(); } catch { /* schon zu Ende */ }
    try { this.osc?.stop(); } catch { /* schon zu Ende */ }
    this.node = undefined; this.osc = undefined;
    if (browserTts()) try { speechSynthesis.cancel(); } catch { /* nichts zu tun */ }
    this.onSpeak?.(null);
  }

  /** Einmal pro Bild aufrufen: aktualisiert den Pegel. */
  tick(now: number) {
    if (!this.playing) { this.level = 0; return; }
    if (this.fake) {
      const t = now / 1000;
      this.level = Math.max(0, 0.38 + 0.3 * Math.sin(t * 19) * Math.sin(t * 7.1) + 0.25 * Math.sin(t * 11.3));
      return;
    }
    this.analyser.getByteTimeDomainData(this.buf);
    let s = 0; for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; }
    this.level = Math.min(1, Math.sqrt(s / this.buf.length) * 4.5);
  }

  private async synth(text: string, c: Extract<TtsChoice, { kind: "ha" } | { kind: "robot" }>): Promise<AudioBuffer | null> {
    let res: Response;
    if (c.kind === "robot") {
      // Die feste Stimme von LLMitMir: auf dem Server gesprochen, damit sie auf jedem Gerät gleich klingt
      res = await this.hass.fetchWithAuth("/api/llmitmir/speak", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: this.lang, voice: c.voice }) });
    } else {
      // cache: false – einmalige Sätze sollen nicht dauerhaft im TTS-Ordner von Home Assistant landen
      const r = await this.hass.callApi("POST", "tts_get_url", { engine_id: c.engine, message: text, cache: false,
        ...(c.language ? { language: c.language } : {}), ...(c.voice ? { options: { voice: c.voice } } : {}) });
      res = await fetch(r.path || r.url);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  /** Maschinenklang für die Roboterstimme: leichte Amplitudenmodulation, Bass weg, Höhen betont.
   *  Das macht aus einer natürlichen Stimme einen Roboter, ohne dass sie schwer zu verstehen wird. */
  private machine(): AudioNode {
    const ctx = this.ctx;
    const ring = ctx.createGain();
    ring.gain.value = 0.62;
    const osc = this.osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = 58;
    const depth = ctx.createGain(); depth.gain.value = 0.38;
    osc.connect(depth); depth.connect(ring.gain);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110; hp.Q.value = 0.7;
    const peak = ctx.createBiquadFilter(); peak.type = "peaking"; peak.frequency.value = 2600; peak.Q.value = 1.1; peak.gain.value = 3.5;
    ring.connect(hp); hp.connect(peak); peak.connect(this.analyser);
    try { osc.start(); } catch { /* schon gestartet */ }
    return ring;
  }

  private async pump() {
    if (this.playing || this._hold) return;
    const item = this.queue.shift();
    if (!item) { this.onSpeak?.(null); return; }
    const gen = this.gen;
    this.playing = true;
    const next = () => {
      if (gen !== this.gen) return;
      try { this.osc?.stop(); } catch { /* schon zu Ende */ }
      this.osc = undefined;
      this.playing = false; this.fake = 0; this.sounding = false; this.lastSound = performance.now(); this.pump();
    };
    let buf: AudioBuffer | null = null;
    if (item.audio) {
      buf = await item.audio;
      if (gen !== this.gen) return;
      if (!buf && this.choice.kind === "robot" && this.fallback && this.fallback.kind !== "none") {
        // die feste Stimme ist nicht erreichbar: für dieses und alle weiteren Stücke die Ersatzstimme nehmen
        this.choice = this.fallback;
        if (!this.failed) { this.failed = true; console.warn("LLMitMir: die feste Stimme ist nicht erreichbar – es liest die Sprachausgabe von Home Assistant oder der Browser."); }
        if (this.choice.kind === "ha") buf = await this.synth(item.text, this.choice).catch(() => null);
        if (gen !== this.gen) return;
      } else if (!buf && !this.failed) {
        this.failed = true;
        console.warn("LLMitMir: die Stimme ist nicht nutzbar – es liest die Sprachausgabe von Home Assistant oder der Browser.");
      }
    }
    this.sounding = true;
    this.onSpeak?.(item.text);
    if (buf) {
      const n = this.node = this.ctx.createBufferSource();
      n.buffer = buf; n.onended = next;
      const effect = this.choice.kind === "robot" && this.choice.effect;
      n.connect(effect ? this.machine() : this.analyser);
      n.start();
      return;
    }
    this.fake = 1;
    if (this.choice.kind !== "none" && browserTts()) {
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = this.lang;
      const l = this.lang.toLowerCase().slice(0, 2);
      const voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(l));
      const voice = voices.find(v => v.default) || voices.find(v => v.localService) || voices[0];
      if (voice) u.voice = voice;
      // manche Browser melden das Ende nie: nach großzügiger Zeit geht es trotzdem weiter
      const guard = setTimeout(() => { try { speechSynthesis.cancel(); } catch { /* egal */ } next(); }, 6000 + item.text.length * 130);
      const began = performance.now(), read = 900 + item.text.length * 55;
      u.onend = () => { clearTimeout(guard); next(); };
      // scheitert die Stimme sofort (keine installiert), bleibt der Text wenigstens so lange stehen, wie man zum Lesen braucht
      u.onerror = () => { clearTimeout(guard); setTimeout(next, Math.max(0, read - (performance.now() - began))); };
      speechSynthesis.speak(u);
      return;
    }
    // keine Stimme: der Text steht als Untertitel da, so lange, wie man zum Lesen braucht
    setTimeout(next, 900 + item.text.length * 55);
  }
}
