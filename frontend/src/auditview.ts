// Zugriffsprotokoll (Admin → Monitoring): Beschriftungen und CSV – Logik ohne Browser, getestet in test/audit.test.ts.

export const AGENT_KINDS: Record<string, { label: string; icon: string }> = {
  chat: { label: "Chat", icon: "chat" }, cowork: { label: "Cowork", icon: "cowork" }, voice: { label: "Gespräch", icon: "voice" },
  sub: { label: "Teilaufgabe", icon: "subtask" }, skill: { label: "Skill-Prüfung", icon: "skill" }, task: { label: "Geplante Aufgabe", icon: "task" }, tile: { label: "Kachel", icon: "dashboard" },
};
export const MODEL_CLASSES: Record<string, string> = { main: "Hauptanbieter", external: "extern (Hauptanbieter)", billed: "extern, kostenpflichtig" };
export const OUTCOMES: Record<string, string> = { ok: "ausgeführt", error: "Fehler", denied: "abgelehnt" };
export const DECISIONS: Record<string, string> = {
  auto: "ohne Rückfrage", standing: "dauerhaft erlaubt", once: "einmal erlaubt", always: "immer erlaubt",
  denied: "von der Person abgelehnt", skipped: "übersprungen", rule: "durch Regel gesperrt",
};

/** Kurzer Name eines Agenten: Art plus Aufgabe oder Projekt, sonst die gekürzte ID. */
export function agentLabel(id: string, info?: any): string {
  const kind = AGENT_KINDS[info?.kind || ""]?.label || "Agent";
  const what = info?.task || info?.project;
  return what ? `${kind} · ${what}` : `${kind} ${shortId(id)}`;
}

export const shortId = (id: string) => (id || "").replace(/^agt-/, "").slice(0, 8);

/** Ziel eines Aufrufs als eine Zeile: Server und Pfad, Ordner, Dienst und Entitäten, Objekt, Empfängerzahl. */
export function targetText(ev: any): string {
  const t = ev?.target || {};
  const parts: string[] = [];
  const where = (t.host || ev?.host || "") + (t.path || "");
  if (t.method) parts.push(t.method);
  if (where) parts.push(where);
  if (t.container) parts.push(`[${t.container}]`);
  if (t.service) parts.push(t.service);
  if (Array.isArray(t.entities) && t.entities.length) parts.push(t.entities.slice(0, 3).join(", ") + (t.entities.length > 3 ? ` +${t.entities.length - 3}` : ""));
  if (t.object) parts.push(`„${t.object}“`);
  if (t.action) parts.push(t.action);
  if (typeof t.recipients === "number") parts.push(`${t.recipients} Empfänger`);
  return parts.join(" ");
}

export const credsText = (ev: any) => (ev?.creds || []).map((c: any) => c.name).filter(Boolean).join(", ");

/** Was mit dem Aufruf geschah, in Worten: Ergebnis und, wo es etwas sagt, wer entschieden hat. */
export function outcomeText(ev: any): string {
  if (ev?.kind === "run") return "Lauf gestartet";
  if (ev?.kind === "data_rule") return ev.outcome === "denied" ? "durch Datenregel gesperrt" : "Datenregel: erlaubt";
  if (ev?.kind === "skill_check") return ev.outcome === "denied" ? "Skill gesperrt" : "Befund";
  const o = OUTCOMES[ev?.outcome] || ev?.outcome || "";
  const d = ev?.decision && ev.decision !== "auto" ? DECISIONS[ev.decision] || ev.decision : "";
  if (ev?.outcome === "denied" && d) return d;
  return d ? `${o} · ${d}` : o;
}

function csvCell(v: any): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Tabellenprogramme führen =, +, -, @ am Zellanfang als Formel aus
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV der angezeigten Ereignisse (Semikolon, wie es deutsche Tabellenprogramme erwarten). */
export function toCsv(events: any[], names: Record<string, string>, agents: Record<string, any>): string {
  const head = ["Zeit", "Person", "Agent", "Agent-ID", "Eltern-Agent", "Lauf", "Ereignis", "Werkzeug", "Schreibend", "Zugänge",
    "Ziel", "Modell", "Modellklasse", "Ergebnis", "Entscheidung", "Dauer (ms)"];
  const rows = events.map(ev => [
    new Date((ev.ts || 0) * 1000).toISOString(), names[ev.user] || ev.user, agentLabel(ev.agent, agents[ev.agent]), ev.agent, ev.parent || "",
    ev.run, ev.kind, ev.tool || "", ev.write ? "ja" : "", credsText(ev), targetText(ev), ev.model || "", MODEL_CLASSES[ev.model_class] || "",
    OUTCOMES[ev.outcome] || ev.outcome || "", DECISIONS[ev.decision] || ev.decision || "", ev.ms ?? ""]);
  return [head, ...rows].map(r => r.map(csvCell).join(";")).join("\n") + "\n";
}

export const RANGES: [number, string][] = [[1, "24 Stunden"], [7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"], [365, "1 Jahr"]];
