// Usage of all scheduled tasks on the key they run with (tasks page, settings, admin).
import { css, html, nothing } from "lit";
import { icon, fmtNum } from "./ui";
import { t, dateLocale } from "./i18n";
import { fmtInt, limitRow, limitsCss, showAbsolute, type Limit } from "./limits";

export const taskUsageCss = [limitsCss, css`
  .tu { display: grid; gap: 12px; }
  .tu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .tu-grid .big { font-size: 15px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .tu-bars { display: flex; align-items: flex-end; gap: 3px; height: 64px; }
  .tu-bars div { flex: 1; background: var(--lm-accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .8; }
  .tu-bars div.today { opacity: 1; }
  .tu-bars div:hover { opacity: 1; }
  .tu .warnline { color: var(--lm-warn); }`];

const tok = (x: any) => (x?.prompt || 0) + (x?.completion || 0);
const dayLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit" });

export function taskKeyLabel(source: string) {
  if (source === "shared") return t("zentraler Aufgaben-Schlüssel");
  if (source === "own") return t("eigener Aufgaben-Schlüssel");
  return t("gleicher Schlüssel wie Chats & Coworks");
}

/** Tageslimit des Schlüssels als Prozent-Zeile (alle Nutzungen auf diesem Schlüssel). */
function keyDay(lim: any): Limit {
  const max = lim.limit_requests_day, used = Math.max(0, max - (lim.remaining_requests_day ?? max));
  return { id: "taskday", label: t("Schlüssel heute (alle Nutzungen)"), frac: Math.min(1, used / max), reset: lim.reset_requests_day || undefined,
    details: [t("{a} von {b} Anfragen", { a: fmtInt(used), b: fmtInt(max) })] };
}

/** One usage block. today/mine: {requests, prompt, completion}; days: [{day, requests, prompt, completion}] oldest first. */
export function usageBlock(o: { title: string; label?: string; accent?: boolean; todayLabel: string; today: any; mine?: any;
  limits?: any; days?: any[] | null; notes?: any[]; abs?: boolean }) {
  const lim = o.limits || {};
  const abs = o.abs ?? showAbsolute();
  const days = o.days || [];
  const used = days.filter(d => d.requests);
  const max = Math.max(1, ...days.map(d => d.requests || 0));
  const avgReq = used.length ? Math.round(used.reduce((s, d) => s + d.requests, 0) / used.length) : 0;
  const avgTok = used.length ? used.reduce((s, d) => s + tok(d), 0) / used.length : 0;
  return html`<div class="card tu">
    <div class="row" style="flex-wrap:wrap"><b class="grow">${icon("task", 16)} ${o.title}</b>
      ${o.label ? html`<span class="chip ${o.accent ? "accent" : ""}">${icon("key", 13)} ${o.label}</span>` : nothing}</div>
    ${lim.limit_requests_day ? html`<div class="lims">${limitRow(keyDay(lim), { abs })}</div>` : nothing}
    ${abs ? html`<div class="tu-grid">
      <div><div class="hint">${o.todayLabel}</div><div class="big">${fmtInt(o.today?.requests || 0)} ${t("Anfragen")} · ${fmtNum(tok(o.today))} ${t("Tokens")}</div></div>
      ${o.mine ? html`<div><div class="hint">${t("davon deine Aufgaben")}</div><div class="big">${fmtInt(o.mine.requests || 0)} ${t("Anfragen")} · ${fmtNum(tok(o.mine))} ${t("Tokens")}</div></div>` : nothing}
    </div>` : nothing}
    ${days.length ? html`<div><div class="tu-bars">${days.map((d, i) => html`<div class=${i === days.length - 1 ? "today" : ""}
        title=${abs ? t("{day}: {r} Anfragen, {n} Tokens", { day: dayLabel(d.day), r: d.requests, n: fmtNum(tok(d)) }) : dayLabel(d.day)} style="height:${Math.max(2, (d.requests / max) * 60)}px"></div>`)}</div>
      <div class="hint">${t("Nutzung je Tag, letzte {n} Tage", { n: days.length })}${abs && used.length ? ` · ${t("Ø {r} Anfragen und {n} Tokens an Tagen mit Läufen", { r: avgReq, n: fmtNum(avgTok) })}` : ""}</div></div>` : nothing}
    ${(o.notes || []).filter(Boolean).map(n => html`<div class="hint">${n}</div>`)}
  </div>`;
}

/** The person's own view (tasks page, settings), from usage.tasks of the bootstrap/usage events. */
export function taskUsageCard(tk: any, days: any[] | null, abs?: boolean) {
  if (!tk) return nothing;
  if (!tk.has_key) return html`<div class="card hint">${tk.missing
    ? t("Für geplante Aufgaben fehlt dein eigener API-Schlüssel – der Admin lässt Aufgaben nur mit eigenen Schlüsseln laufen. Trag ihn in den Einstellungen ein.")
    : t("Für geplante Aufgaben ist noch kein API-Schlüssel hinterlegt.")}</div>`;
  return usageBlock({
    title: t("Verbrauch der geplanten Aufgaben"), label: taskKeyLabel(tk.source), accent: tk.separate,
    todayLabel: tk.shared_by_all ? t("Alle geplanten Aufgaben auf diesem Schlüssel heute") : t("Deine geplanten Aufgaben heute"),
    today: tk.key_today, mine: tk.shared_by_all ? tk.mine_today : undefined, limits: tk.key_limits, days, abs,
    notes: [
      tk.fallback ? html`<span class="warnline">${icon("alert", 13)} ${t("Der gewählte Aufgaben-Schlüssel ist nicht eingetragen – Aufgaben nutzen so lange den normalen Schlüssel.")}</span>` : null,
      tk.missing ? html`<span class="warnline">${icon("alert", 13)} ${t("Ohne eigenen Aufgaben-Schlüssel starten keine Läufe – der Admin lässt Aufgaben nur mit eigenen Schlüsseln laufen.")}</span>` : null,
      !tk.separate && !tk.fallback ? t("Aufgaben teilen sich die Limits mit Chats und Coworks.") : null,
      tk.separate ? t("Läufe auf diesem Schlüssel zählen nicht zum persönlichen Tageskontingent.") : null,
    ],
  });
}
