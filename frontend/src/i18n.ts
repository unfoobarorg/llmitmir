// Sprachen der Oberfläche. Deutsch ist die Ausgangssprache: Der deutsche Text ist zugleich der Schlüssel, t("…") gibt ihn
// unverändert zurück, wenn es keine Übersetzung gibt. Die Übersetzungen liegen in custom_components/llmitmir/locales/
// <code>.json – dieselben Dateien nutzt das Backend (i18n.py) für Fehlermeldungen und Push-Nachrichten.
//
// Eine weitere Sprache hinzufügen: locales/<code>.json anlegen (Schlüssel wie in en.json), unten in LANGUAGES eintragen
// und in i18n.py nichts weiter tun – das Backend lädt alle Dateien im Ordner von selbst.
import en from "../../custom_components/llmitmir/locales/en.json";

export interface Language {
  code: string;      // zweistellig, wie in den Einstellungen gespeichert
  name: string;      // in der eigenen Sprache, so steht er in der Auswahl
  locale: string;    // für Datum, Uhrzeit und Zahlen, wenn Home Assistant nichts Passenderes liefert
  dict?: Record<string, string>;
}

export const LANGUAGES: Language[] = [
  { code: "de", name: "Deutsch", locale: "de-DE" },
  { code: "en", name: "English", locale: "en-GB", dict: en as Record<string, string> },
];

/** Gespeicherte Wahl ("auto", "de", "en", …) plus Sprache von Home Assistant → Sprache der Oberfläche.
 *  „Automatisch“ folgt Home Assistant; eine Sprache, die LLMitMir nicht kennt, wird Englisch. */
export function resolveLang(choice: string | undefined | null, hassLanguage?: string): string {
  const pick = (c: string) => LANGUAGES.find(l => l.code === c)?.code;
  if (choice && choice !== "auto" && pick(choice)) return choice;
  const h = (hassLanguage || "").slice(0, 2).toLowerCase();
  return h ? pick(h) || "en" : "de";
}

let cur: Language = LANGUAGES[0];
let hassLang = "";
let patterns: [RegExp, string, string[]][] | null = null;

export function setLang(code: string, hassLanguage?: string) {
  if (hassLanguage !== undefined) hassLang = hassLanguage || "";
  cur = LANGUAGES.find(l => l.code === resolveLang(code, hassLang)) || LANGUAGES[0];
  patterns = null;
  try { document.documentElement && (document.documentElement.dataset.lmLang = cur.code); } catch { /* kein DOM (Tests) */ }
}
export const lang = () => cur.code;
export const isDe = () => cur.code === "de";
/** Locale für toLocale…(): die von Home Assistant, wenn sie zur Sprache passt (en-US, de-AT …), sonst die der Sprache. */
export const dateLocale = () => (hassLang.slice(0, 2).toLowerCase() === cur.code && hassLang.length > 2 ? hassLang : cur.locale);

function fill(s: string, p?: Record<string, any>): string {
  if (!p) return s;
  for (const [k, v] of Object.entries(p)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Text der Oberfläche übersetzen. Platzhalter {name} werden mit p gefüllt. */
export function t(s: string, p?: Record<string, any>): string {
  return fill(cur.dict ? cur.dict[s] ?? s : s, p);
}

/** Text vom Server übersetzen (Fehlermeldungen, Prüfergebnisse, Zeitpläne): erst genau, dann nach Mustern mit
 *  Platzhaltern („Zugang {name} fehlt“ passt auf „Zugang Mail fehlt“). Unbekanntes bleibt, wie es ist. */
export function tb(s: string | null | undefined): string {
  if (!s || !cur.dict) return s || "";
  const d = cur.dict;
  if (d[s] !== undefined) return d[s];
  if (!patterns) patterns = compile(d);
  for (const [re, key, names] of patterns) {
    const m = re.exec(s);
    if (!m) continue;
    const p: Record<string, string> = {};
    names.forEach((n, i) => { p[n] = part(m[i + 1]); });
    return fill(d[key], p);
  }
  return s;
}

/** Platzhalter-Wert übersetzen; eine Aufzählung („montags, freitags“) Teil für Teil. */
function part(v: string): string {
  const whole = tb(v);
  return whole !== v || !v.includes(", ") ? whole : v.split(", ").map(x => tb(x)).join(", ");
}

/** Muster aus den Schlüsseln mit Platzhaltern – längere (genauere) zuerst. */
export function compile(d: Record<string, string>): [RegExp, string, string[]][] {
  const out: [RegExp, string, string[]][] = [];
  for (const key of Object.keys(d)) {
    if (!/\{\w+\}/.test(key)) continue;
    const names: string[] = [];
    const src = key.split(/(\{\w+\})/).map(part => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (m) { names.push(m[1]); return "([\\s\\S]+?)"; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
    out.push([new RegExp(`^${src}$`), key, names]);
  }
  return out.sort((a, b) => b[1].replace(/\{\w+\}/g, "").length - a[1].replace(/\{\w+\}/g, "").length);
}
