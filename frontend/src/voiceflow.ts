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
  /** Bereitschaft: wartet, bis er mit seinem Namen angesprochen wird. */
  standby?: boolean;
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
    else want = s.muted || s.standby ? "idle" : "listening";

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
// Wer den Bildschirm nicht sieht (im Auto), muss hören, was gerade passiert – und zwar was genau, nicht nur
// „einen Moment noch“. Deshalb sagt LLMitMir bei jedem neuen Arbeitsschritt, was es tut, und bei langen
// Schritten, woran es noch sitzt. So lässt es sich jederzeit mit „Stopp“ unterbrechen.
const THINK = ["Hm, Moment.", "Lass mich kurz überlegen.", "Mhm, einen Augenblick.", "Okay, Moment."];
const LOOKUP: Record<string, string[]> = {
  "": ["Ich schaue kurz nach.", "Moment, ich sehe nach.", "Das schaue ich kurz nach."],
  web: ["Ich suche das kurz im Internet.", "Moment, ich schaue im Netz nach."],
  ha: ["Ich schaue kurz im Haus nach.", "Moment, ich sehe im Haus nach."],
  ews: ["Ich schaue kurz in deinen Kalender.", "Moment, ich sehe im Kalender nach."],
  mail: ["Ich schaue kurz in dein Postfach.", "Moment, ich sehe in deinen Mails nach."],
  dav: ["Ich schaue kurz in deiner Nextcloud nach."],
  files: ["Ich sehe mir das kurz an."],
  http: ["Ich frage das kurz bei dem Dienst ab."],
  skills: ["Ich lese kurz nach, wie das geht."],
  llmitmir: ["Ich schaue kurz bei mir selbst nach."],
  notify: ["Ich schicke die Nachricht."],
  werkbank: ["Ich arbeite das kurz aus.", "Moment, das arbeite ich aus."],
};
// Der nächste Schritt in einer längeren Arbeit („Jetzt …“)
const NEXT: Record<string, string[]> = {
  "": ["Jetzt der nächste Schritt."],
  web: ["Jetzt suche ich im Internet.", "Ich suche noch etwas im Netz."],
  ha: ["Jetzt schaue ich im Haus nach."],
  ews: ["Jetzt schaue ich in den Kalender."],
  mail: ["Jetzt schaue ich in die Mails."],
  dav: ["Jetzt schaue ich in die Nextcloud."],
  files: ["Jetzt sehe ich mir die Datei an."],
  http: ["Jetzt frage ich den Dienst ab."],
  skills: ["Jetzt lese ich die Anleitung."],
  llmitmir: ["Jetzt schaue ich bei mir selbst nach."],
  notify: ["Jetzt schicke ich die Nachricht."],
  werkbank: ["Jetzt arbeite ich das aus."],
};
// Derselbe Schritt dauert an („Ich bin noch …“)
const STILL: Record<string, string[]> = {
  "": ["Ich bin noch dabei.", "Das läuft noch."],
  web: ["Ich suche noch im Internet.", "Die Suche läuft noch."],
  ha: ["Ich bin noch im Haus zugange."],
  ews: ["Ich bin noch im Kalender."],
  mail: ["Ich lese noch in den Mails."],
  dav: ["Ich bin noch in der Nextcloud."],
  files: ["Ich lese noch."],
  http: ["Der Dienst antwortet noch nicht."],
  werkbank: ["Ich arbeite noch daran."],
};
const WAIT = ["Ich überlege noch.", "Ich bin gleich so weit.", "Gleich habe ich es."];
const BUSY = ["Gerade ist viel los, einen Moment bitte."];
const STOP_HINT = "Sag Stopp, wenn ich abbrechen soll.";

/** Alle Überbrückungssätze – zum Vorab-Erzeugen, damit sie ohne Verzögerung kommen. */
export const BRIDGE_PHRASES: string[] = [...new Set([...THINK, ...Object.values(LOOKUP).flat(), ...Object.values(NEXT).flat(),
  ...Object.values(STILL).flat(), ...WAIT, ...BUSY, STOP_HINT])];

export const BRIDGE_THINK_AFTER = 2600;   // so lange Stille nach dem Ende der Äußerung, dann ein „Moment …“
export const BRIDGE_STEP_GAP = 3500;      // ein neuer Schritt wird frühestens so lange nach dem letzten Satz angesagt
export const BRIDGE_WAIT_EVERY = 9000;    // dauert ein Schritt an, meldet sich LLMitMir so oft
const BRIDGE_MAX_WAITS = 6;

export interface BridgeScene {
  /** LLMitMir ist dran und es ist gerade still. */
  waiting: boolean;
  /** Die Stimme ist zu hören (oder gleich). */
  speaking: boolean;
  /** Das Modell hat in dieser Runde schon selbst etwas gesagt. */
  modelSpoke: boolean;
  /** Gruppe des Werkzeugs, das gerade läuft (leer: unbekannt), oder undefined: es läuft keins. */
  group?: string;
  /** Kennung des laufenden Schritts (z. B. Nummer des Werkzeugaufrufs): ändert sie sich, ist es ein neuer Schritt. */
  step?: string;
  /** Der Anbieter lässt warten (Wiederholung, Kontingent). */
  congested?: boolean;
}

export class Bridge {
  private quietFrom = 0; private wasQuiet = false;
  private announced = false; private thought = false; private congested = false; private waits = 0;
  private lastStep = ""; private hinted = false;
  private n = Math.floor(Math.random() * 12);

  /** Neue Runde: die Person hat etwas gesagt (oder ein laufender Chat wurde ins Gespräch übernommen). */
  begin(now: number) {
    this.quietFrom = now; this.wasQuiet = true; this.announced = this.thought = this.congested = this.hinted = false;
    this.waits = 0; this.lastStep = "";
  }

  private pick(list: string[], now: number): string { this.quietFrom = now; return list[this.n++ % list.length]; }

  /** Was jetzt zu sagen wäre – oder null. Regelmäßig aufrufen (einige Male je Sekunde genügt). */
  next(now: number, s: BridgeScene): string | null {
    const quiet = s.waiting && !s.speaking;
    if (quiet && !this.wasQuiet) this.quietFrom = now;
    this.wasQuiet = quiet;
    if (!quiet) return null;
    const silent = now - this.quietFrom;
    const g = s.group || "";
    if (s.congested && !this.congested && silent >= 1500) { this.congested = this.thought = true; return this.pick(BUSY, now); }
    if (s.group !== undefined) {
      const step = s.step || g;
      if (!this.announced) {
        // erster Schritt: hat das Modell selbst schon gesagt, dass es nachschaut, genügt das
        if (!s.modelSpoke && silent < 500) return null;             // nicht direkt an den eigenen Satz kleben
        this.announced = this.thought = true; this.lastStep = step;
        return s.modelSpoke ? null : this.pick(LOOKUP[g] || LOOKUP[""], now);
      }
      if (step !== this.lastStep && silent >= BRIDGE_STEP_GAP) {       // neuer Schritt: sagen, was jetzt kommt
        this.lastStep = step; this.waits = 0;
        return this.pick(NEXT[g] || NEXT[""], now);
      }
      if (silent >= BRIDGE_WAIT_EVERY && this.waits < BRIDGE_MAX_WAITS) {   // derselbe Schritt dauert
        this.lastStep = step; this.waits++;
        if (!this.hinted && this.waits === 2) { this.hinted = true; return this.pick([STOP_HINT], now); }
        return this.pick(STILL[g] || STILL[""], now);
      }
      return null;
    }
    if (s.modelSpoke) this.thought = true;
    if (!this.thought && silent >= BRIDGE_THINK_AFTER) { this.thought = true; return this.pick(THINK, now); }
    if (silent >= BRIDGE_WAIT_EVERY && this.waits < BRIDGE_MAX_WAITS) { this.waits++; return this.pick(WAIT, now); }
    return null;
  }
}

// ------------------------------------------------------------------ Rufname, Stopp, Ja und Nein
// Ein Gespräch, das lange läuft (im Auto, auf dem Tablet), braucht einen Namen, auf den der Roboter hört: Nach
// einer Gesprächspause reagiert er nur noch, wenn er angesprochen wird – alles andere (Radio, Mitfahrende) lässt
// er vorbeiziehen. Und weil niemand am Steuer auf den Bildschirm tippen soll, versteht er „Stopp“ sowie Ja, Nein
// und Immer auf eine Freigabe-Frage.

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Klingt das gehörte Wort wie der Name? (Die Spracherkennung schreibt Namen selten zweimal gleich.) */
function soundsLike(word: string, name: string): boolean {
  if (word === name) return true;
  if (name.length < 4) return false;
  const slack = name.length >= 7 ? 2 : 1;
  return Math.abs(word.length - name.length) <= slack && word[0] === name[0] && distance(word, name) <= slack;
}

// Floskeln, mit denen eine Antwort auf „Wie möchtest du mich nennen?“ beginnt („Nenn mich einfach Kalle“)
const LEAD_IN = /^(?:(?:ich\s+(?:nenne|nenn|w(?:ü|ue)rde)|nenn(?:e)?|sag(?:e)?|ruf(?:e)?|du\s+hei(?:ß|ss)t|dein\s+name\s+ist|du\s+bist|sagen\s+wir|wie\s+w(?:ä|ae)re\s+es\s+mit|vielleicht|einfach|halt|jetzt|ab\s+sofort|okay|ok|hm+|(?:ä|ae)h+m*|also|na\s+gut|gut|dann|mal|bitte|i(?:'ll)?\s+call\s+you|your\s+name\s+is|call\s+you|let'?s\s+say)(?:\s+(?:mich|dich|du|mir))?[\s,:–-]+)+/i;
const NO_NAME = /^(?:egal|wei(?:ß|ss)\s+(?:ich\s+)?nicht|keine\s+ahnung|keinen?|nichts|such\s+dir|such(?:e)?\s+du|mir\s+egal|wie\s+du\s+willst|i\s+don'?t\s+(?:know|care)|whatever)\b/i;

/** Aus der Antwort auf „Wie möchtest du mich nennen?“ den Namen holen („Ich nenne dich Robo.“ → „Robo“).
 *  Leer: Die Person hat keinen genannt – dann gilt ein Vorschlag. Dieselbe Aufbereitung wie `clean_name` auf dem
 *  Server (voice.py), damit der Name nicht je nach Weg anders lautet. */
export function extractName(text: string): string {
  let s = (text || "").trim().replace(/^["„“'»«]+|["”“'»«.!?…]+$/g, "").trim();
  if (!s || NO_NAME.test(s)) return "";
  s = s.replace(LEAD_IN, "").replace(/[.!?,;:"„“”»«]+/g, " ").trim();
  const w = s.split(/\s+/).filter(x => /^\p{L}[\p{L}'’-]*$/u.test(x));
  if (!w.length || w.length > 3) return "";                      // ein ganzer Satz ist kein Name
  return w.slice(0, 2).map(cap).join(" ").slice(0, 24);
}
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export interface Addressed { hit: boolean; rest: string; }

/** Wurde der Roboter mit seinem Namen angesprochen? `rest`: die Äußerung ohne die Anrede. Der Name darf am
 *  Anfang („Robo, wie spät ist es?“, „Hey Robo …“) oder am Ende („Wie spät ist es, Robo?“) stehen. */
export function addressed(text: string, name: string): Addressed {
  const nm = words(name);
  if (!nm.length) return { hit: false, rest: text };
  const raw = (text || "").trim().split(/\s+/).filter(Boolean);
  const w = raw.map(x => norm(x).replace(/[^a-z0-9]/g, ""));
  const match = (i: number) => i >= 0 && i + nm.length <= w.length && nm.every((n, k) => soundsLike(w[i + k], n));
  const tidy = (parts: string[]) => {
    const r = parts.join(" ").replace(/^[\s,.:;!?–-]+|[\s,:;–-]+$/g, "").trim();
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
  };
  for (let i = 0; i < Math.min(3, w.length); i++) {             // am Anfang, nach „hey“, „hallo“, „okay“, „sag mal“
    if (!match(i)) continue;
    if (!w.slice(0, i).every(x => /^(hey|hallo|hi|ok|okay|he|du|sag|mal|ach|ah|oh|und|also|na|servus|moin)$/.test(x))) continue;
    return { hit: true, rest: tidy(raw.slice(i + nm.length)) };
  }
  const end = w.length - nm.length;                              // am Ende
  if (end > 0 && match(end)) return { hit: true, rest: tidy(raw.slice(0, end)) };
  return { hit: false, rest: text };
}

const STOP = /^(?:(?:okay|ok|ja|nein|ach|hey|und|bitte|jetzt|mal)[\s,]+)*(?:stopp?|halt|warte(?:\s+mal)?|moment(?:\s+mal)?|aufh(?:ö|oe)ren|h(?:ö|oe)r\s+auf|sei\s+(?:still|ruhig|leise)|ruhe|abbrechen|brich\s+ab|schluss|still|leise|reicht|das\s+reicht|genug|danke(?:[\s,]+(?:das\s+)?reicht)?|stop\s+it|be\s+quiet|cancel|enough|wait)(?:[\s,]+(?:bitte|mal|jetzt|kurz|danke|schon))*[.!?…]*$/i;

/** Ist das ein „Stopp“ (und nichts weiter)? */
export function isStop(text: string): boolean {
  return STOP.test((text || "").trim());
}

export type PermAnswer = "yes" | "no" | "always" | null;

/** Antwort auf eine Freigabe-Frage: Ja, Nein, Immer – oder unverständlich (null). */
export function permAnswer(text: string): PermAnswer {
  const s = " " + words(text).join(" ") + " ";
  if (!s.trim()) return null;
  if (/ (nein|nee|no|noe|nicht|lieber nicht|lass|lass es|stopp?|halt|abbrechen|auf keinen fall|ablehnen|verboten|nope) /.test(s)) return "no";
  if (/ (immer|dauerhaft|jedes mal|kuenftig|kunftig|zukunft|fuer alle|fur alle|alle gespraeche|alle gesprache|nie wieder fragen|nicht mehr fragen|always) /.test(s)) return "always";
  if (/ (ja|jo|jep|jawohl|klar|okay|ok|gern|gerne|mach|mach das|mach es|darfst du|erlaubt|einverstanden|in ordnung|passt|genau|bitte|yes|sure|yep|go ahead) /.test(s)) return "yes";
  return null;
}
