// Meldung über dem Eingabefeld, wenn das Limit der Modellaufrufe einer Antwort naht oder erreicht ist – wie die
// Limitmeldung von Claude Code: farbig (gelb: fast erreicht, rot: erreicht), mit sanfter Animation und klaren Knöpfen.
// Die genauen Zahlen bleiben verborgen: „Weitermachen“, „Zum Ende kommen“ und „Stopp“ genügen.
import { css, html, nothing, svg } from "lit";
import { icon } from "./ui";
import { t } from "./i18n";

export interface StepChoice { decision: "lots" | "wrap" | "stop"; label: string; desc: string; kind: "primary" | "" | "ghost"; }

export const stepChoices = (): StepChoice[] => [
  { decision: "lots", label: t("Weitermachen"), desc: t("Arbeitet weiter, bis die Aufgabe erledigt ist."), kind: "primary" },
  { decision: "wrap", label: t("Zum Ende kommen"), desc: t("Erledigt noch das Wichtigste und fasst dann zusammen."), kind: "" },
  { decision: "stop", label: t("Stopp"), desc: t("Hört jetzt auf und fasst zusammen, was geschafft ist."), kind: "ghost" },
];

/** Kleiner Ring, der sich beim Erscheinen füllt (fast voll bzw. voll). */
const meter = (frac: number) => {
  const r = 9, c = 2 * Math.PI * r;
  return svg`<svg class="sb-meter" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" style="--c:${c};--to:${c * (1 - frac)}">
    <circle cx="12" cy="12" r=${r} class="track"/><circle cx="12" cy="12" r=${r} class="fill" transform="rotate(-90 12 12)"/></svg>`;
};

/** Das Limit naht: fragen, wie es weitergeht. from: Herkunft (Teilaufgabe), busy: Antwort wird gerade gesendet. */
export function stepAsk(o: { from?: unknown; busy?: string; answer: (d: string) => void }) {
  return html`<div class="sb warn" role="alertdialog" aria-live="assertive" aria-label=${t("Limit der Modellaufrufe fast erreicht")}>
    <div class="sb-glow"></div>
    <div class="sb-head">${meter(0.9)}
      <div class="sb-text">${o.from || nothing}
        <b>${t("LLMitMir ist noch nicht fertig")}</b>
        <span>${t("Das Limit der Modellaufrufe für diese Antwort ist fast erreicht. Wie soll es weitergehen?")}</span></div></div>
    <div class="sb-choices">${stepChoices().map((c, i) => html`<button class="sb-choice ${c.kind}" style="--i:${i}" ?disabled=${!!o.busy}
        title=${c.desc} @click=${() => o.answer(c.decision)}>
        <span class="sb-l">${o.busy === c.decision ? html`<lm-spark size="14"></lm-spark>` : nothing}${c.label}</span><span class="sb-d">${c.desc}</span></button>`)}</div>
  </div>`;
}

/** Das Limit war erreicht und die Antwort ist beendet: anbieten, weiterzumachen. */
export function stepReached(o: { onContinue: () => void; onClose: () => void }) {
  return html`<div class="sb err" role="status">
    <div class="sb-glow"></div>
    <div class="sb-head">${meter(1)}
      <div class="sb-text"><b>${t("Das Limit der Modellaufrufe ist erreicht")}</b>
        <span>${t("LLMitMir hat aufgehört, bevor die Aufgabe ganz fertig war. Was geschafft ist, steht in der Antwort.")}</span></div>
      <button class="iconbtn sb-x" title=${t("Schließen")} @click=${o.onClose}>${icon("close", 16)}</button></div>
    <div class="sb-choices one"><button class="sb-choice primary" style="--i:0" @click=${o.onContinue}>
      <span class="sb-l">${t("Weitermachen")}</span><span class="sb-d">${t("LLMitMir macht dort weiter, wo es aufgehört hat.")}</span></button></div>
  </div>`;
}

export const stepBannerCss = css`
  .sb { --sb: var(--lm-warn); position: relative; overflow: hidden; margin: 0 6px 10px; padding: 12px 12px 12px 14px; border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--sb) 45%, var(--lm-line));
    background: linear-gradient(180deg, color-mix(in srgb, var(--sb) 14%, var(--lm-raise)), color-mix(in srgb, var(--sb) 6%, var(--lm-raise)));
    box-shadow: 0 8px 28px color-mix(in srgb, var(--sb) 18%, transparent); display: grid; gap: 10px;
    animation: sb-in .42s cubic-bezier(.2, .9, .25, 1.15) both; transform-origin: 50% 100%; }
  .sb.err { --sb: var(--lm-err); }
  .sb-glow { position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--sb) 16%, transparent) 50%, transparent 70%);
    background-size: 250% 100%; animation: sb-sweep 2.8s ease-in-out .4s 2 both; }
  .sb-head { display: flex; align-items: flex-start; gap: 12px; position: relative; }
  .sb-text { display: grid; gap: 2px; min-width: 0; flex: 1; font-size: 14px; line-height: 1.45; }
  .sb-text b { font-weight: 650; }
  .sb-text span { color: var(--lm-muted); }
  .sb-text .pfrom { margin: 0 0 2px; }
  .sb-x { flex: none; margin: -4px -4px 0 0; }
  .sb-meter { flex: none; margin-top: 1px; animation: sb-breathe 2.4s ease-in-out .5s infinite; }
  .sb-meter circle { fill: none; stroke-width: 3; }
  .sb-meter .track { stroke: color-mix(in srgb, var(--sb) 22%, transparent); }
  .sb-meter .fill { stroke: var(--sb); stroke-linecap: round; stroke-dasharray: var(--c); stroke-dashoffset: var(--c);
    animation: sb-fill .9s cubic-bezier(.3, .7, .2, 1) .15s forwards; }
  .sb-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; position: relative; }
  .sb-choices.one { grid-template-columns: minmax(0, 1fr); }
  .sb-choice { display: grid; gap: 2px; text-align: left; padding: 9px 12px; border-radius: 12px; cursor: pointer; font: inherit; color: var(--lm-text);
    border: 1px solid color-mix(in srgb, var(--sb) 30%, var(--lm-line)); background: color-mix(in srgb, var(--lm-raise) 85%, transparent);
    transition: transform .15s, box-shadow .15s, background .15s, border-color .15s; animation: sb-up .35s ease-out both; animation-delay: calc(.12s + var(--i) * .06s); }
  .sb-choice:hover:not([disabled]) { transform: translateY(-1px); border-color: var(--sb); box-shadow: 0 4px 14px color-mix(in srgb, var(--sb) 20%, transparent); }
  .sb-choice:active:not([disabled]) { transform: translateY(0) scale(.98); }
  .sb-choice[disabled] { opacity: .6; cursor: default; }
  .sb-choice.primary { background: var(--lm-text); color: var(--lm-raise); border-color: transparent; }
  .sb-choice.primary .sb-d { color: color-mix(in srgb, var(--lm-raise) 72%, transparent); }
  .sb-choice.ghost { background: transparent; }
  .sb-l { font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
  .sb-d { font-size: 12.5px; color: var(--lm-muted); line-height: 1.35; }
  @media (max-width: 560px) {
    .sb-choices { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .sb-choice { padding: 8px 12px; }
  }
  @keyframes sb-in { from { opacity: 0; transform: translateY(14px) scale(.97); } }
  @keyframes sb-up { from { opacity: 0; transform: translateY(6px); } }
  @keyframes sb-fill { to { stroke-dashoffset: var(--to); } }
  @keyframes sb-sweep { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @keyframes sb-breathe { 50% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) {
    .sb, .sb-choice, .sb-glow, .sb-meter { animation: none; }
    .sb-meter .fill { animation: none; stroke-dashoffset: var(--to); }
  }`;
