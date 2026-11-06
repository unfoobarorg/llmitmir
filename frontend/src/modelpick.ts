// Model load, recommendations and "automatic" labels – shared by composer, chat, settings, projects and tasks.
// The backend (models.py) decides the defaults; this mirrors its recommendation rule for the composer hint.
import { html, nothing } from "lit";
import { store } from "./api";

export type Role = "chat" | "agent" | "vision";

const SIMILAR = 12;    // models.SIMILAR_BAND
const WORST = 25;      // models.WORST_BAND

export const models = (): any[] => store.data?.models || [];
export const modelById = (id: string) => models().find(m => m.id === id);
export const modelName = (id: string) => modelById(id)?.name || id || "";

/** "frei" / "mäßig" / "stark ausgelastet" with a colour; null while the provider reports no load. */
export function load(m: any): { level: 0 | 1 | 2; text: string; color: string } | null {
  if (!m || (m.demand === null || m.demand === undefined) && !m.slow) return null;
  if (m.busy) return { level: 2, text: m.slow ? "antwortet gerade sehr langsam" : "stark ausgelastet", color: "var(--lm-err)" };
  if (m.demand >= 2) return { level: 1, text: "etwas ausgelastet", color: "var(--lm-warn)" };
  return { level: 0, text: "frei", color: "var(--lm-ok)" };
}

export const loadDot = (m: any, size = 8) => {
  const l = load(m);
  return l ? html`<span title=${`Auslastung: ${l.text}`} style="display:inline-block;flex:none;width:${size}px;height:${size}px;border-radius:50%;background:${l.color}"></span>` : nothing;
};

/** A less loaded model that does the job about as well (same rule as models.alternative). */
export function alternative(current: string, role: Role, needImage = false): any | null {
  const cur = modelById(current);
  const qCur = cur?.quality?.[role] || 0;
  const cand = models().filter(m => m.id !== current && m.status !== "unavailable" && !m.busy && (m.quality?.[needImage ? "vision" : role] || 0) > 0
    && (!needImage || (m.input || []).includes("image")));
  if (!cand.length) return null;
  const pen = (m: any) => (m.demand >= 3 ? 3 : m.demand >= 2 ? 1 : 0);
  const best = cand.reduce((a, b) => ((b.quality[role] - pen(b)) > (a.quality[role] - pen(a)) ? b : a));
  const q = best.quality[role];
  if (qCur && q < qCur - WORST) return null;
  return { ...best, similar: !qCur || q >= qCur - SIMILAR, better: q > qCur };
}

/** Label of the "Standard" entry in model selects: says whether it is chosen automatically and which model that is now. */
export function defaultLabel(role: Role, word = "Standard"): string {
  const d = store.data?.defaults || {};
  return d[`${role}_auto`] ? `${word} – automatisch (derzeit ${modelName(d[role])})` : `${word} (${modelName(d[role])})`;
}
