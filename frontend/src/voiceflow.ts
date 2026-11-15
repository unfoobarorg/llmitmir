// Sprachgespräch: der Gesprächsfluss (ohne Browser testbar).
//
// Ein Gespräch ist kein Chat in Tonform. Menschen denken schon mit, während das Gegenüber noch spricht, fangen an
// zu antworten, bevor sie zu Ende gedacht haben, und füllen eine Denkpause mit einem „Moment …“ statt mit Stille.
// Drei Bausteine bilden das hier nach:
//
// - `endpoint` – klingt das Gesagte fertig? Dann genügt eine kurze Pause, und LLMitMir fängt an zu denken. Bricht
//   der Satz mitten im Gedanken ab („… und“, „… weil“), wird länger gewartet.
// - `Director` – die Gestenregie. Der Roboter wechselt seine Haltung nicht bei jedem technischen Zwischenschritt,
//   sondern bleibt bei einer Geste: kurze Wartezeiten sind einfach „aufmerksam“, die Denkerpose kommt erst nach
//   wirklich langem Überlegen, und wer einmal nachschlägt, bleibt beim Nachschlagen, bis er antwortet.
// - `Bridge` – gesprochene Überbrückung: „Ich schaue kurz nach.“ statt eines Textes „Ich denke nach“ am Bildschirm.

// ------------------------------------------------------------------ Ist die Äußerung fertig?
export type Endpoint = "complete" | "open" | "unclear";

// Nach diesen Wörtern geht ein Satz weiter (Bindewörter, Artikel, Verhältniswörter, Zögern)
// (ohne „an, auf, aus, ein, zu, vor, nach, mit, um …“: damit enden im Deutschen ganz normale Sätze – „Mach das Licht aus.“)
const OPEN_END = new Set(("und oder aber denn weil dass ob wenn als wie sondern sowie also dann außerdem beziehungsweise bzw " +
  "der die den dem des eine einen einem einer eines mein meine meinen meinem dein deine deinen deinem kein keine " +
  "in im am von vom zum zur für gegen ohne seit wegen zwischen neben " +
  "äh ähm hm hmm öhm ehm naja sozusagen " +
  "and or but because that if when the a an to of for with from so then um uh").split(" "));
// Ganz kurze Äußerungen, die trotzdem vollständig sind
const SHORT_OK = /^(ja|nein|nee|nö|doch|okay|ok|genau|richtig|stimmt|danke|bitte|stopp|stop|halt|weiter|gern|gerne|klar|super|tschüss|hallo|yes|no|thanks|sure)\b/i;

/** Klingt die Abschrift nach einer fertigen Äußerung? „open“ = bricht erkennbar mitten im Gedanken ab. */
export function endpoint(text: string): Endpoint {
  const s = (text || "").trim();
  if (!s) return "unclear";
  if (/[?!]["“”»]?$/.test(s)) return "complete";
  if (/(…|\.\.\.|,|-|–|:)$/.test(s)) return "open";
  const words = s.replace(/[.!?"“”»«]+$/g, "").split(/\s+/);
  const last = (words[words.length - 1] || "").toLowerCase().replace(/[^\p{L}]/gu, "");
  if (OPEN_END.has(last)) return "open";
  if (/\.["“”»]?$/.test(s)) return words.length >= 3 || SHORT_OK.test(s) ? "complete" : "unclear";
  return SHORT_OK.test(s) && words.length <= 2 ? "complete" : "unclear";
}

/** So lange Stille beendet die Äußerung (ms). `base` ist die eingestellte Sprechpause. */
export function pauseFor(kind: Endpoint, base: number): number {
  if (kind === "complete") return Math.min(base, 650);
  return kind === "open" ? base + 700 : base;
}

// ------------------------------------------------------------------ Gestenregie
export type Pose = "hello" | "idle" | "listening" | "attentive" | "thinking" | "researching" | "speaking" | "asking";

export interface Scene {
  /** Das Gespräch läuft. */
  on: boolean;
  muted: boolean;
  /** Die Person spricht gerade. */
  hearing: boolean;
  /** Die Stimme ist zu hören. */
  speaking: boolean;
  /** Eine Freigabe wartet auf Antwort. */
  asking: boolean;
  /** LLMitMir ist dran, hat aber (noch) nichts zu sagen. */
  waiting: boolean;
  /** In dieser Runde wurde schon nachgeschlagen (ein Werkzeug benutzt). */
  tool: boolean;
  /** Sagt nur nebenbei etwas („Ich schaue kurz nach.“): bleibt bei seiner Geste, nur der Mund bewegt sich. */
  aside?: boolean;
}

export const THINK_AFTER = 4500;      // erst nach so langem Warten ohne Werkzeug gibt es die Denkerpose
const DWELL: Partial<Record<Pose, number>> = { thinking: 3000, researching: 3500, attentive: 700 };
const SPEAK_LINGER = 600;             // Lücke zwischen zwei Sätzen: weiter „sprechend“ bleiben

export class Director {
  pose: Pose = "hello";
  private since = 0;          // seit wann die aktuelle Haltung gilt
  private waitFrom = 0;       // seit wann ohne Unterbrechung gewartet wird
  private spokeAt = -1e9;     // wann zuletzt gesprochen wurde
  private waiting = false;

  /** Wie lange wird schon still gewartet? (ms) */
  waited(now: number): number { return this.waiting ? now - this.waitFrom : 0; }

  update(now: number, s: Scene): Pose {
    if (s.speaking || s.aside) this.spokeAt = now;
    // die Wartezeit zählt neu, wenn das Warten beginnt oder LLMitMir zwischendurch etwas gesagt hat
    const waiting = s.on && s.waiting && !s.speaking && !s.hearing;
    if (waiting && (!this.waiting || this.spokeAt > this.waitFrom)) this.waitFrom = now;
    this.waiting = waiting;

    let want: Pose;
    if (!s.on) want = "hello";
    else if (s.speaking) want = "speaking";
    else if (s.asking) want = "asking";
    else if (s.hearing) want = "listening";
    else if (s.waiting) want = s.tool ? "researching" : now - this.waitFrom >= THINK_AFTER ? "thinking" : "attentive";
    else want = s.muted ? "idle" : "listening";

    if (want === this.pose) return this.pose;
    // Was man hört oder antippt, zeigt sich sofort; alles andere wartet, bis die Geste ausgespielt ist
    const urgent = want === "speaking" || want === "hello" || want === "asking" || (want === "listening" && s.hearing);
    if (!urgent) {
      if (this.pose === "speaking" && now - this.spokeAt < SPEAK_LINGER) return this.pose;
      if (now - this.since < (DWELL[this.pose] || 0)) return this.pose;
    }
    this.pose = want; this.since = now;
    return this.pose;
  }
}

// ------------------------------------------------------------------ gesprochene Überbrückung
const THINK = ["Hm, Moment.", "Lass mich kurz überlegen.", "Mhm, einen Augenblick.", "Okay, Moment."];
const LOOKUP: Record<string, string[]> = {
  "": ["Ich schaue kurz nach.", "Moment, ich sehe nach.", "Das schaue ich kurz nach."],
  web: ["Ich suche das kurz im Internet.", "Moment, ich schaue im Netz nach."],
  ha: ["Ich schaue kurz im Haus nach.", "Moment, ich sehe im Haus nach."],
  ews: ["Ich schaue kurz in deinen Kalender.", "Moment, ich sehe im Kalender nach."],
  mail: ["Ich schaue kurz in dein Postfach.", "Moment, ich sehe in deinen Mails nach."],
  dav: ["Ich schaue kurz in deiner Nextcloud nach."],
  files: ["Ich sehe mir das kurz an."],
  werkbank: ["Ich rechne das kurz aus.", "Moment, ich rechne."],
};
const WAIT = ["Einen Moment noch.", "Ich bin gleich so weit.", "Das dauert noch einen kleinen Moment.", "Gleich habe ich es."];
const BUSY = ["Gerade ist viel los, einen Moment bitte."];

/** Alle Überbrückungssätze – zum Vorab-Erzeugen, damit sie ohne Verzögerung kommen. */
export const BRIDGE_PHRASES: string[] = [...THINK, ...Object.values(LOOKUP).flat(), ...WAIT, ...BUSY];

export const BRIDGE_THINK_AFTER = 2600;   // so lange Stille nach dem Ende der Äußerung, dann ein „Moment …“
export const BRIDGE_WAIT_EVERY = 11000;   // bei langem Nachschlagen meldet sich LLMitMir so oft
const BRIDGE_MAX_WAITS = 4;

export interface BridgeScene {
  /** LLMitMir ist dran und es ist gerade still. */
  waiting: boolean;
  /** Die Stimme ist zu hören (oder gleich). */
  speaking: boolean;
  /** Das Modell hat in dieser Runde schon selbst etwas gesagt. */
  modelSpoke: boolean;
  /** Gruppe des Werkzeugs, das gerade läuft (leer: unbekannt), oder undefined: es läuft keins. */
  group?: string;
  /** Der Anbieter lässt warten (Wiederholung, Kontingent). */
  congested?: boolean;
}

export class Bridge {
  private quietFrom = 0; private wasQuiet = false;
  private announced = false; private thought = false; private congested = false; private waits = 0;
  private n = Math.floor(Math.random() * 12);

  /** Neue Runde: die Person hat etwas gesagt. */
  begin(now: number) { this.quietFrom = now; this.wasQuiet = true; this.announced = this.thought = this.congested = false; this.waits = 0; }

  private pick(list: string[], now: number): string { this.quietFrom = now; return list[this.n++ % list.length]; }

  /** Was jetzt zu sagen wäre – oder null. Regelmäßig aufrufen (einige Male je Sekunde genügt). */
  next(now: number, s: BridgeScene): string | null {
    const quiet = s.waiting && !s.speaking;
    if (quiet && !this.wasQuiet) this.quietFrom = now;
    this.wasQuiet = quiet;
    if (!quiet) return null;
    const silent = now - this.quietFrom;
    if (s.modelSpoke) this.announced = this.thought = true;        // das Modell hat selbst etwas gesagt
    if (s.congested && !this.congested && silent >= 1500) { this.congested = this.thought = true; return this.pick(BUSY, now); }
    if (s.group !== undefined && !this.announced) {
      if (silent < 500) return null;                               // nicht direkt an den eigenen Satz kleben
      this.announced = this.thought = true;
      return this.pick(LOOKUP[s.group] || LOOKUP[""], now);
    }
    if (!this.thought && silent >= BRIDGE_THINK_AFTER) { this.thought = true; return this.pick(THINK, now); }
    if (silent >= BRIDGE_WAIT_EVERY && this.waits < BRIDGE_MAX_WAITS) { this.waits++; return this.pick(WAIT, now); }
    return null;
  }
}
