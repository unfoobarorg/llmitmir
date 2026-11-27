// Nutzungslimits wie in der Claude-Desktop-App: je Limit ein Balken mit „23 % verbraucht“ und wann es zurücksetzt.
// Genaue Zahlen (Anfragen, Tokens, Euro) erscheinen nur, wenn die Person sie unter Einstellungen → Verbrauch einschaltet.
import { css, html, nothing } from "lit";
import { store } from "./api";
import { t, dateLocale, isDe } from "./i18n";
import { fmtNum } from "./ui";
import { fmtEur } from "./external";

export interface Limit {
  id: "hour" | "day" | "month" | "context" | "taskday" | "calls";
  label: string;
  /** 0 … 1 (verbraucht) */
  frac: number;
  /** Sekunden bis zum Zurücksetzen, bezogen auf jetzt; undefined = unbekannt oder setzt nicht zurück */
  reset?: number;
  /** Genaue Zahlen, nur mit „Genaue Zahlen anzeigen“ */
  details: string[];
}

/** Genaue Zahlen zusätzlich zu den Prozenten? (Einstellungen → Verbrauch) */
export const showAbsolute = () => !!store.data?.settings?.usage_absolute;

// Die Rücksetzzeiten im Schnappschuss gelten ab seiner Ankunft: merken, wann wir ihn zum ersten Mal gesehen haben.
const seen = new WeakMap<object, number>();
function age(snap: any): number {
  if (!snap || typeof snap !== "object") return 0;
  if (!seen.has(snap)) seen.set(snap, Date.now());
  return (Date.now() - (seen.get(snap) as number)) / 1000;
}

/** „23 %“ (Deutsch mit schmalem Leerzeichen) bzw. „23%“. Etwas verbraucht, aber unter 1 %: „1 %“ statt „0 %“. */
export function fmtPct(frac: number): string {
  const f = Math.max(0, Math.min(1, frac || 0));
  const n = f > 0 && f < 0.01 ? 1 : Math.min(100, Math.round(f * 100));
  return isDe() ? `${n} %` : `${n}%`;
}

/** „in 3 Std. 12 Min.“ – kurz und ohne Sekunden, wie die Claude-App. */
function fmtLeft(sec: number): string {
  if (sec < 60) return t("weniger als einer Minute");
  const m = Math.ceil(sec / 60);
  if (m < 60) return t("{m} Min.", { m });
  const h = Math.floor(m / 60), r = m % 60;
  return r ? t("{h} Std. {m} Min.", { h, m: r }) : t("{h} Std.", { h });
}

/** „Setzt in 3 Std. 12 Min. zurück“, ab einem Tag „Setzt am Di., 1. Dez. zurück“. */
export function resetText(sec?: number): string {
  if (sec === undefined || sec === null || !Number.isFinite(sec) || sec <= 0) return "";
  if (sec < 86400) return t("Setzt in {d} zurück", { d: fmtLeft(sec) });
  const d = new Date(Date.now() + sec * 1000);
  const midnight = d.getHours() === 0 && d.getMinutes() < 2;
  const when = d.toLocaleString(dateLocale(), { weekday: "short", day: "numeric", month: "short",
    ...(midnight ? {} : { hour: "2-digit", minute: "2-digit" }) });
  return t("Setzt am {d} zurück", { d: when });
}

const tok = (x: any) => (x?.prompt || 0) + (x?.completion || 0);
/** Anfragen als ganze Zahl mit Tausenderpunkt („4.000“), Tokens bleiben kurz („1,2 Mio.“). */
export const fmtInt = (n: number) => Math.round(n || 0).toLocaleString(dateLocale());

/** Die Limits der Person: diese Stunde und heute (Schlüssel und persönliches Kontingent), externe Kosten im Monat. */
export function userLimits(u: any = store.data?.usage, e: any = store.data?.external): Limit[] {
  u = u || {};
  const out: Limit[] = [];
  const lim = u.key_limits || {};
  const a = age(u);
  const left = (s: any) => (typeof s === "number" ? s - a : undefined);
  const shared = u.key_mode === "shared";
  const keyNote = shared ? ` (${t("gemeinsamer Schlüssel")})` : "";

  // Ein Fenster des Schlüssels; ist seine Rücksetzzeit vorbei, ist es wieder leer.
  const keyPart = (per: "hour" | "day") => {
    const max = lim[`limit_requests_${per}`];
    if (!max) return null;
    const rem = lim[`remaining_requests_${per}`] ?? max;
    // ein Stundenfenster setzt spätestens in einer Stunde zurück, ein Tagesfenster spätestens in einem Tag
    const raw = left(lim[`reset_requests_${per}`]);
    const reset = raw === undefined ? undefined : Math.min(raw, per === "hour" ? 3600 : 86400);
    const over = reset !== undefined && reset <= 0;
    const used = over ? 0 : Math.max(0, max - rem);
    return { frac: used / max, reset: over ? undefined : reset,
      detail: t("Schlüssel: {a} von {b} Anfragen", { a: fmtInt(used), b: fmtInt(max) }) + keyNote };
  };

  const hour = keyPart("hour");
  if (hour) out.push({ id: "hour", label: t("Diese Stunde"), frac: hour.frac, reset: hour.reset, details: [hour.detail] });

  // Heute: das, was zuerst greift – persönliches Tageskontingent (Anfragen, Tokens) oder das Tageslimit des Schlüssels
  const q = u.quota || {};
  const today = u.today || {};
  const midnight = left(u.resets?.day);
  const newDay = midnight !== undefined && midnight <= 0;
  const req = newDay ? 0 : Math.max(0, (today.requests || 0) - (today.sep_requests || 0));
  const tks = newDay ? 0 : Math.max(0, tok(today) - (today.sep_tokens || 0));
  const parts: { frac: number; reset?: number; detail: string }[] = [];
  if (q.requests_day) parts.push({ frac: req / q.requests_day, reset: newDay ? undefined : midnight,
    detail: t("Dein Tageskontingent: {a} von {b} Anfragen", { a: fmtInt(req), b: fmtInt(q.requests_day) }) });
  if (q.tokens_day) parts.push({ frac: tks / q.tokens_day, reset: newDay ? undefined : midnight,
    detail: t("Dein Tageskontingent: {a} von {b} Tokens", { a: fmtNum(tks), b: fmtNum(q.tokens_day) }) });
  const day = keyPart("day");
  if (day) parts.push(day);
  if (parts.length) {
    const top = parts.reduce((x, y) => (y.frac > x.frac ? y : x));
    out.push({ id: "day", label: t("Heute"), frac: top.frac, reset: top.reset ?? midnight, details: parts.map(p => p.detail) });
  }

  if (e?.has_access && e.limit_eur > 0) {
    out.push({ id: "month", label: t("Externe Modelle · diesen Monat"), frac: (e.month_eur || 0) / e.limit_eur,
      reset: left(u.resets?.month), details: [t("{a} von {b}", { a: fmtEur(e.month_eur || 0), b: fmtEur(e.limit_eur) })] });
  }
  return out.map(l => ({ ...l, frac: Math.max(0, Math.min(1, l.frac || 0)) }));
}

/** Füllstand des Kontexts eines Chats. */
export function contextLimit(cu: any, fallbackMax = 0): Limit | null {
  const max = cu?.context_max || fallbackMax;
  if (!cu || !max) return null;
  return { id: "context", label: t("Kontext"), frac: Math.min(1, (cu.context || 0) / max), details: [t("{a} von {b} Tokens", { a: fmtNum(cu.context || 0), b: fmtNum(max) })] };
}

/** Modellaufrufe der laufenden Antwort (Limit je Antwort; die Frage „Wie soll es weitergehen?“ kommt kurz davor). */
export function stepsLimit(st: { used: number; limit: number } | null | undefined): Limit | null {
  if (!st?.limit) return null;
  return { id: "calls", label: t("Modellaufrufe dieser Antwort"), frac: Math.min(1, (st.used || 0) / st.limit),
    details: [t("{a} von {b} Modellaufrufen", { a: fmtInt(st.used || 0), b: fmtInt(st.limit) })] };
}

/** Das am stärksten ausgeschöpfte Limit, das gerade bremst (Stunde, Tag) – für den Ring am Eingabefeld. */
export const usedFrac = (ls: Limit[]) => Math.max(0, ...ls.filter(l => l.id === "hour" || l.id === "day").map(l => l.frac));

const level = (f: number) => (f >= 0.9 ? "e" : f >= 0.7 ? "w" : "");

/** Eine Zeile: Name und Rücksetzzeit links, Balken, „23 % verbraucht“ rechts; darunter auf Wunsch die genauen Zahlen. */
/** right: eigener Text statt „{p} verbraucht“ (z. B. „34 % belegt“ beim Kontext). */
export function limitRow(l: Limit, o: { abs?: boolean; right?: string; note?: unknown } = {}) {
  const reset = resetText(l.reset);
  const pct = Math.round(l.frac * 100);
  return html`<div class="lim">
    <b class="lim-l">${l.label}</b>${reset ? html`<span class="lim-r">${reset}</span>` : nothing}
    <div class="lim-bar" role="progressbar" aria-label=${l.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}>
      <i class=${level(l.frac)} style="width:${l.frac > 0 ? Math.max(2, pct) : 0}%"></i></div>
    <span class="lim-p">${o.right ?? t("{p} verbraucht", { p: fmtPct(l.frac) })}</span>
    ${o.abs && l.details.length ? html`<div class="lim-d">${l.details.map((d, i) => html`${i ? html`<br>` : nothing}${d}`)}</div>` : nothing}
    ${o.note ? html`<div class="lim-n">${o.note}</div>` : nothing}
  </div>`;
}

/** Hinweis über dem Eingabefeld ab 80 %, wie die Claude-App ihn zeigt. billed: gerade ein kostenpflichtiges Modell gewählt. */
export function limitWarning(ls: Limit[], billed: boolean): { key: string; text: string; full: boolean } | null {
  const relevant = ls.filter(l => (l.id === "month" ? billed : l.id === "hour" || l.id === "day") && l.frac >= 0.8);
  if (!relevant.length) return null;
  const l = relevant.reduce((x, y) => (y.frac > x.frac ? y : x));
  const full = l.frac >= 1;
  const p = fmtPct(l.frac);
  const texts: Record<string, [string, string]> = {
    hour: [t("Das Limit für diese Stunde ist aufgebraucht"), t("Du hast {p} des Limits für diese Stunde verbraucht", { p })],
    day: [t("Dein Limit für heute ist aufgebraucht"), t("Du hast {p} deines Limits für heute verbraucht", { p })],
    month: [t("Dein Monatsbudget für externe Modelle ist aufgebraucht"), t("Du hast {p} deines Monatsbudgets für externe Modelle verbraucht", { p })],
  };
  const reset = resetText(l.reset);
  return { key: `lim:${l.id}:${full ? 100 : l.frac >= 0.9 ? 90 : 80}`, full,
    text: texts[l.id][full ? 0 : 1] + (reset ? ` · ${reset}` : "") };
}

export const limitsCss = css`
  .lims { display: grid; gap: 14px; }
  /* schmal (Menü am Eingabefeld): Name und Prozent, darunter Balken und Rücksetzzeit */
  .lim { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "l p" "b b" "r r" "d d" "n n"; gap: 3px 12px; align-items: center; }
  .lim-l { grid-area: l; font-weight: 600; min-width: 0; line-height: 1.3; }
  .lim-r, .lim-d, .lim-n { color: var(--lm-muted); font-size: 12.5px; line-height: 1.4; }
  .lim-r { grid-area: r; }
  .lim-d { grid-area: d; font-variant-numeric: tabular-nums; }
  .lim-n { grid-area: n; margin-top: 2px; }
  .lim-p { grid-area: p; color: var(--lm-muted); font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .lim-bar { grid-area: b; height: 8px; border-radius: 5px; background: var(--lm-hover); overflow: hidden; margin: 2px 0; }
  .lim-bar i { display: block; height: 100%; background: var(--lm-accent); border-radius: 5px; transition: width .5s; }
  .lim-bar i.w { background: var(--lm-warn); } .lim-bar i.e { background: var(--lm-err); }
  /* breit (Einstellungen): Name mit Rücksetzzeit | Balken | Prozent in einer Zeile, wie in der Claude-App */
  @media (min-width: 760px) {
    .lims.wide { gap: 18px; }
    .lims.wide .lim { grid-template-columns: minmax(180px, 260px) minmax(0, 1fr) auto; grid-template-areas: "l b p" "r b p" "d d d" "n n n"; gap: 2px 20px; }
    .lims.wide .lim-p { min-width: 9em; text-align: right; }
  }`;
