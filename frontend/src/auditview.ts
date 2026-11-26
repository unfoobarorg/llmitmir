// Zugriffsprotokoll (Admin → Monitoring): Beschriftungen und CSV – Logik ohne Browser, getestet in test/audit.test.ts.
import { t } from "./i18n";

export const AGENT_KINDS: Record<string, { label: string; icon: string }> = {
  chat: { label: "Chat", icon: "chat" }, cowork: { label: "Cowork", icon: "cowork" }, voice: { label: "Gespräch", icon: "voice" },
  sub: { label: "Teilaufgabe", icon: "subtask" }, skill: { label: "Skill-Prüfung", icon: "skill" }, admin: { label: "Admin", icon: "admin" }, task: { label: "Geplante Aufgabe", icon: "task" }, tile: { label: "Kachel", icon: "dashboard" },
};
export const MODEL_CLASSES: Record<string, string> = { main: "Hauptanbieter", external: "extern (Hauptanbieter)", billed: "extern, kostenpflichtig" };
export const OUTCOMES: Record<string, string> = { ok: "ausgeführt", error: "Fehler", denied: "abgelehnt" };
export const DECISIONS: Record<string, string> = {
  auto: "ohne Rückfrage", standing: "dauerhaft erlaubt", once: "einmal erlaubt", always: "immer erlaubt",
  denied: "von der Person abgelehnt", skipped: "übersprungen", rule: "durch Regel gesperrt",
};

/** Kurzer Name eines Agenten: Art plus Aufgabe oder Projekt, sonst die gekürzte ID. */
export function agentLabel(id: string, info?: any): string {
  const kind = t(AGENT_KINDS[info?.kind || ""]?.label || "Agent");
  const what = info?.task || info?.project;
  return what ? `${kind} · ${what}` : `${kind} ${shortId(id)}`;
}

export const shortId = (id: string) => (id || "").replace(/^agt-/, "").slice(0, 8);

/** Ziel eines Aufrufs als eine Zeile: Server und Pfad, Ordner, Dienst und Entitäten, Objekt, Empfängerzahl. */
export function targetText(ev: any): string {
  const tg = ev?.target || {};
  const parts: string[] = [];
  const where = (tg.host || ev?.host || "") + (tg.path || "");
  if (tg.method) parts.push(tg.method);
  if (where) parts.push(where);
  if (tg.container) parts.push(`[${tg.container}]`);
  if (tg.service) parts.push(tg.service);
  if (Array.isArray(tg.entities) && tg.entities.length) parts.push(tg.entities.slice(0, 3).join(", ") + (tg.entities.length > 3 ? ` +${tg.entities.length - 3}` : ""));
  if (tg.object) parts.push(`„${tg.object}“`);
  if (tg.action) parts.push(tg.action);
  if (typeof tg.recipients === "number") parts.push(t("{n} Empfänger", { n: tg.recipients }));
  return parts.join(" ");
}

export const credsText = (ev: any) => (ev?.creds || []).map((c: any) => c.name).filter(Boolean).join(", ");

/** Was mit dem Aufruf geschah, in Worten: Ergebnis und, wo es etwas sagt, wer entschieden hat. */
export function outcomeText(ev: any): string {
  if (ev?.kind === "run") return t("Lauf gestartet");
  if (ev?.kind === "admin_action") return ({ revoke: t("Freigaben entzogen"), agent_stop: t("Agent angehalten"), export_test: t("Export-Test") } as any)[ev.tool] || t("Admin-Eingriff");
  if (ev?.kind === "data_rule") return ev.outcome === "denied" ? t("durch Datenregel gesperrt") : t("Datenregel: erlaubt");
  if (ev?.kind === "skill_check") return ev.outcome === "denied" ? t("Skill gesperrt") : t("Befund");
  const o = OUTCOMES[ev?.outcome] ? t(OUTCOMES[ev.outcome]) : ev?.outcome || "";
  const d = ev?.decision && ev.decision !== "auto" ? (DECISIONS[ev.decision] ? t(DECISIONS[ev.decision]) : ev.decision) : "";
  if (ev?.outcome === "denied" && d) return d;
  return d ? `${o} · ${d}` : o;
}

function csvCell(v: any): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Tabellenprogramme führen =, +, -, @ am Zellanfang als Formel aus
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV der angezeigten Ereignisse (Semikolon, wie es deutsche Tabellenprogramme erwarten; Spalten in der Sprache der Oberfläche). */
export function toCsv(events: any[], names: Record<string, string>, agents: Record<string, any>): string {
  const head = ["Zeit", "Person", "Agent", "Agent-ID", "Eltern-Agent", "Lauf", "Ereignis", "Werkzeug", "Schreibend", "Zugänge",
    "Ziel", "Modell", "Modellklasse", "Ergebnis", "Entscheidung", "Dauer (ms)"].map(x => t(x));
  const rows = events.map(ev => [
    new Date((ev.ts || 0) * 1000).toISOString(), names[ev.user] || ev.user, agentLabel(ev.agent, agents[ev.agent]), ev.agent, ev.parent || "",
    ev.run, ev.kind, ev.tool || "", ev.write ? t("ja") : "", credsText(ev), targetText(ev), ev.model || "", MODEL_CLASSES[ev.model_class] ? t(MODEL_CLASSES[ev.model_class]) : "",
    OUTCOMES[ev.outcome] ? t(OUTCOMES[ev.outcome]) : ev.outcome || "", DECISIONS[ev.decision] ? t(DECISIONS[ev.decision]) : ev.decision || "", ev.ms ?? ""]);
  return [head, ...rows].map(r => r.map(csvCell).join(";")).join("\n") + "\n";
}

export const RANGES: [number, string][] = [[1, "24 Stunden"], [7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"], [365, "1 Jahr"]];
