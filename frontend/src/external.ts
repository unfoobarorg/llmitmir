// Usage-billed external models (Claude via Microsoft Foundry or the Anthropic API): explanation, consent, prices.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { base, icon, tokens, safeElement, confirmDialog } from "./ui";
import { store } from "./api";
import { t } from "./i18n";

export const isExternal = (id: string | null | undefined) => /^(foundry|anthropic):/.test(id || "");
export const ext = () => store.data?.external || {};

export const fmtEur = (v: number, digits = 2) =>
  (Number(v || 0)).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }) + " €";

/** "0,09 € / 0,43 € je Mio. Tokens (ein/aus)" */
export const priceText = (p: any) => p ? `${fmtEur(p.in)} / ${fmtEur(p.out)} je Mio. Tokens (lesen/schreiben)` : "Preis unbekannt";

/** A rough idea of what one answer costs: a typical agent step reads ~20 000 and writes ~1 000 tokens. */
export const stepCost = (p: any) => p ? (20000 * p.in + 1000 * p.out) / 1e6 : 0;

const operatorOf = (modelId?: string) => {
  const m = (store.data?.models || []).find((x: any) => x.id === modelId);
  return m?.operator || "einem externen Anbieter";
};

/** The full explanation – shown once before the first use and on the settings page. */
export function externalExplanation(operator?: string) {
  const e = ext();
  return html`<div class="extx">
    <p><b>Was ist anders?</b> Diese Modelle laufen nicht beim Hauptanbieter dieser Installation (z. B. dem Rechenzentrum der GWDG),
      sondern bei <b>${operator || "einem externen Anbieter (Microsoft Azure oder Anthropic)"}</b>. Sie sind sehr leistungsfähig, kosten aber
      bei jeder Anfrage Geld.</p>
    <p><b>Was wird dorthin geschickt?</b> Deine Nachrichten, der bisherige Verlauf des Chats, Anhänge, Projektanweisungen, deine persönlichen
      Hinweise, Skill-Texte und die Ergebnisse der Werkzeuge – zum Beispiel Werte aus Home Assistant oder Dateien aus freigegebenen Zugängen.</p>
    <p><b>Was nie dorthin geht:</b> Passwörter und Schlüssel aus deinen Zugängen. Zugänge, die du nicht ausdrücklich für externe Modelle
      freigibst, bleiben ganz außen vor – auch ihre Ergebnisse werden aus dem Verlauf entfernt. Projekte lassen sich ganz sperren.</p>
    <p class="warn">${icon("shield", 18)}<span><b>Bitte gib dort keine sensiblen Informationen preis:</b> keine Gesundheitsdaten, Passwörter,
      Kontodaten oder persönlichen Daten anderer Menschen.</span></p>
    <p><b>Speicherung:</b> Der Anbieter darf Anfragen eine begrenzte Zeit aufbewahren (bei Claude bis zu 30 Tage, z. B. zur Erkennung von
      Missbrauch); zum Trainieren von KI-Modellen werden sie nicht verwendet.</p>
    <p><b>Kosten:</b> Der Admin hat dir ein Monatslimit von ${fmtEur(e.limit_eur || 0)} gegeben; diesen Monat sind ${fmtEur(e.month_eur || 0)}
      verbraucht. LLMitMir wählt externe Modelle nie von selbst – nur wenn du es ausdrücklich möchtest oder eine Aufgabe es im Notfall darf.</p>
  </div>`;
}

export const externalCss = css`
  .extx p { margin: 0 0 10px; line-height: 1.5; font-size: 14px; }
  .extx .warn { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 10px;
    background: color-mix(in srgb, var(--lm-warn) 12%, var(--lm-panel)); border: 1px solid color-mix(in srgb, var(--lm-warn) 35%, var(--lm-line)); }
  .extx .warn svg { color: var(--lm-warn); flex: none; margin-top: 1px; }
  .chip.ext { background: color-mix(in srgb, var(--lm-warn) 14%, transparent); color: var(--lm-text); }`;

/** Ask for consent once; true if given (now or earlier). */
export async function ensureConsent(operator?: string): Promise<boolean> {
  if (ext().consent) return true;
  const ok = await new Promise<boolean>(resolve => {
    const el = document.createElement("lm-extinfo") as ExtInfo;
    el.operator = operator || ""; el.dark = !!store.data?.__dark;
    el.addEventListener("done", (e: any) => { resolve(e.detail); el.remove(); });
    document.body.appendChild(el);
  });
  if (!ok) return false;
  try {
    const r = await store.api.ws("external/consent", { accept: true });
    if (store.data) store.data.external = r.external;
    store.changed();
    return true;
  } catch (e: any) { store.notify(e.message); return false; }
}

/** Before a chat (with history) or a new chat moves to an external model: consent, then a short reminder. */
export async function confirmExternal(modelId: string, withHistory: boolean): Promise<boolean> {
  const m = (store.data?.models || []).find((x: any) => x.id === modelId);
  const op = operatorOf(modelId);
  const first = !ext().consent;
  if (!(await ensureConsent(op))) return false;
  if (first) return true;  // the full explanation was just accepted
  const cost = m?.price ? ` Ein Schritt kostet grob ${fmtEur(stepCost(m.price), 3)}.` : "";
  return confirmDialog(`${m?.name || "Dieses Modell"} läuft kostenpflichtig bei ${op}.${withHistory ? " Der bisherige Verlauf dieses Chats wird mitgeschickt." : ""}${cost} Bitte keine sensiblen Daten eingeben.`, "Weiter");
}

@safeElement("lm-extinfo")
export class ExtInfo extends LitElement {
  @property() operator = "";
  @property({ type: Boolean, reflect: true }) dark = false;
  @state() private read = false;
  static styles = [tokens, base, externalCss, css`
    .back { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 9999; animation: fadeIn .15s; padding: 16px;
      padding-top: calc(16px + var(--safe-area-inset-top, 0px)); padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px)); }
    .box { background: var(--lm-panel); color: var(--lm-text); border-radius: 18px; padding: 20px 22px; width: min(560px, 100%);
      max-height: calc(100vh - 32px); overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    h2 { margin: 0 0 12px; font-size: 18px; display: flex; gap: 8px; align-items: center; }
    label { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; margin: 12px 0 16px; cursor: pointer; }
    label input { width: auto; margin-top: 3px; }`];
  private done(v: boolean) { this.dispatchEvent(new CustomEvent("done", { detail: v })); }
  render() {
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && this.done(false)}>
      <div class="box" role="dialog" aria-modal="true"><h2>${icon("euro", 22)} Kostenpflichtige externe KI-Modelle</h2>
        ${externalExplanation(this.operator || undefined)}
        <label><input type="checkbox" .checked=${this.read} @change=${(e: any) => (this.read = e.target.checked)}>
          Ich habe das gelesen und gebe in Chats mit externen Modellen keine sensiblen Informationen ein.</label>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          <button class="btn" @click=${() => this.done(false)}>${t("Abbrechen")}</button>
          <button class="btn primary" ?disabled=${!this.read} @click=${() => this.done(true)}>${icon("check", 16)} Zustimmen und fortfahren</button></div>
      </div></div>`;
  }
}

/** Shown in a chat after the main provider failed: switch to an external model (and answer again). */
export function offerCard(chatId: string, offer: any, simple: boolean, last: boolean) {
  if (!offer?.models?.length || !last) return nothing;
  const go = async (id: string) => {
    if (!(await confirmExternal(id, true))) return;
    try {
      await store.api.ws("chat/switch_model", { chat_id: chatId, model: id });
      const r = await store.api.ws("chat/retry", { chat_id: chatId });
      store.chats.set(chatId, r.chat); store.changed();
    } catch (e: any) { store.notify(String(e.message || e)); }
  };
  const rec = offer.models.find((m: any) => m.id === offer.recommended) || offer.models[0];
  if (simple) return html`<div class="offer">
    <div>${icon("euro", 16)} Es gibt einen <b>kostenpflichtigen Ersatz</b> (${rec.operator}), mit dem es sofort weitergehen kann.</div>
    <div class="brow"><button class="btn primary" @click=${() => go(rec.id)}>Mit dem Ersatz weitermachen</button></div></div>`;
  return html`<div class="offer">
    <div>${icon("euro", 16)} Der Hauptanbieter ist gerade nicht nutzbar${offer.reason ? ` (${offer.reason})` : ""}. Diese kostenpflichtigen Modelle sind freigeschaltet:</div>
    <div class="brow">${offer.models.slice(0, 4).map((m: any) => html`<button class="btn ${m.id === rec.id ? "primary" : ""}" title=${`${m.provider_name} · ${priceText(m.price)}`}
      @click=${() => go(m.id)}>${m.name} <span class="muted" style="font-size:12px">· ~${fmtEur(stepCost(m.price), 3)}/Schritt</span></button>`)}</div></div>`;
}
