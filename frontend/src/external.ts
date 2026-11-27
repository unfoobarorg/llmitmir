// External models: usage-billed ones (Claude via Microsoft Foundry or the Anthropic API) and those the main provider
// marks as external (SAIA forwards some models to commercial vendors). Same rules for both – explanation, consent,
// locked Zugänge; prices only exist for the billed ones.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { base, icon, tokens, safeElement, confirmDialog } from "./ui";
import { store } from "./api";
import { t, tb, dateLocale } from "./i18n";

/** A usage-billed external model (own provider of LLMitMir, costs money per request). */
export const isBilled = (id: string | null | undefined) => /^(foundry|anthropic):/.test(id || "");
/** Any external model: billed, or marked external by the main provider. */
export const isExternal = (id: string | null | undefined) =>
  isBilled(id) || !!(id && (store.data?.models || []).find((x: any) => x.id === id)?.external);
export const ext = () => store.data?.external || {};

/** Interne Daten im Verlauf (datalock.py): Warum dieser Chat kein externes Modell annimmt – leer, wenn er frei ist
 *  oder der Admin die Sperre abgeschaltet hat. Eine Teilaufgabe ist gesperrt, sobald ihr Hauptchat es ist. */
export function chatLock(chat: any): string {
  if (!chat || ext().lock_chats === false) return "";
  const chats: any[] = store.data?.chats || [];
  const own = chats.find(c => c.id === chat.id)?.internal_only || chat.internal_only;
  const parent = chat.parent_id ? chats.find(c => c.id === chat.parent_id)?.internal_only : null;
  if (!own && !parent) return "";
  const label: Record<string, string> = { cred: t("Zugang"), rule: t("Datenregel"), skill: t("Skill") };
  const names: string[] = [];
  for (const r of [...(own?.reasons || []), ...(parent?.reasons || [])]) {
    const n = label[r.kind] ? `${label[r.kind]} „${r.name}“` : "";  // i18n-ok
    if (n && !names.includes(n)) names.push(n);
  }
  const list = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
  return t("Dieser Chat enthält interne Daten") + (list ? ` (${list})` : "") + ". "
    + t("Externe Modelle sind hier gesperrt – für ein externes Modell einen neuen Chat beginnen.");
}

/** Anteil als „23 %“ – wie fmtPct in limits.ts (das dieses Modul importiert, daher hier eigenständig). */
const pct = (f: number) => { const n = Math.min(100, Math.round(Math.max(0, f) * 100)); return t("{n} %", { n }); };
export const fmtEur = (v: number, digits = 2) =>
  (Number(v || 0)).toLocaleString(dateLocale(), { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) }) + " €";

/** "0,09 € / 0,43 € je Mio. Tokens (ein/aus)" */
export const priceText = (p: any) => p ? t("{a} / {b} je Mio. Tokens (lesen/schreiben)", { a: fmtEur(p.in), b: fmtEur(p.out) }) : t("Preis unbekannt");

/** A rough idea of what one answer costs: a typical agent step reads ~20 000 and writes ~1 000 tokens. */
export const stepCost = (p: any) => p ? (20000 * p.in + 1000 * p.out) / 1e6 : 0;

const operatorOf = (modelId?: string) => {
  const m = (store.data?.models || []).find((x: any) => x.id === modelId);
  return m?.operator || t("einem externen Anbieter");
};

/** The full explanation – shown once before the first use and on the settings page. */
export function externalExplanation(operator?: string) {
  const e = ext();
  const where = operator || (e.has_access && e.main_external ? t("einem kommerziellen Anbieter (z. B. Microsoft Azure, OpenAI oder Anthropic)")
    : e.main_external ? t("einem kommerziellen Anbieter, an den der Hauptanbieter weiterleitet") : t("einem externen Anbieter (Microsoft Azure oder Anthropic)"));
  return html`<div class="extx">
    <p><b>${t("Was ist anders?")}</b> ${t("Diese Modelle laufen nicht im Rechenzentrum des Hauptanbieters dieser Installation (z. B. der GWDG), sondern bei {where}.", { where })}${e.has_access ? t(" Sie sind sehr leistungsfähig; die über LLMitMir eingerichteten kosten bei jeder Anfrage Geld.") : ""}
      ${e.main_external ? t(" Auch Modelle, die der Hauptanbieter selbst als „extern“ kennzeichnet, gehören dazu – er reicht deine Anfragen an einen kommerziellen Anbieter weiter.") : ""}</p>
    <p><b>${t("Was wird dorthin geschickt?")}</b> ${t("Deine Nachrichten, der bisherige Verlauf des Chats, Anhänge, Projektanweisungen, deine persönlichen Hinweise, Skill-Texte und die Ergebnisse der Werkzeuge – zum Beispiel Werte aus Home Assistant oder Dateien aus freigegebenen Zugängen.")}</p>
    <p><b>${t("Was nie dorthin geht:")}</b> ${t("Passwörter und Schlüssel aus deinen Zugängen. Zugänge, die du nicht ausdrücklich für externe Modelle freigibst, bleiben ganz außen vor – auch ihre Ergebnisse werden aus dem Verlauf entfernt. Projekte lassen sich ganz sperren.")}</p>
    <p class="warn">${icon("shield", 18)}<span><b>${t("Bitte gib dort keine sensiblen Informationen preis:")}</b> ${t("keine Gesundheitsdaten, Passwörter, Kontodaten oder persönlichen Daten anderer Menschen.")}</span></p>
    <p><b>${t("Speicherung:")}</b> ${t("Der Anbieter darf Anfragen eine begrenzte Zeit aufbewahren (bei Claude bis zu 30 Tage, z. B. zur Erkennung von Missbrauch); zum Trainieren von KI-Modellen werden sie nicht verwendet.")}${e.main_external ? t(" Bei weitergeleiteten Modellen gelten die Bedingungen, die der Hauptanbieter mit dem Anbieter vereinbart hat.") : ""}</p>
    <p>${e.has_access ? html`<b>${t("Kosten:")}</b> ${t("Der Admin hat dir ein Monatsbudget gegeben; diesen Monat hast du {p} davon verbraucht.", { p: pct(e.limit_eur ? (e.month_eur || 0) / e.limit_eur : 0) })}${e.main_external ? t(" Für die als extern gekennzeichneten Modelle des Hauptanbieters rechnet LLMitMir keine Kosten ab.") : ""} ` : nothing}${e.has_access ? t("LLMitMir wählt externe Modelle nie von selbst – nur wenn du es ausdrücklich möchtest oder eine Aufgabe es im Notfall darf.") : t("LLMitMir wählt externe Modelle nie von selbst – nur wenn du es ausdrücklich möchtest.")}</p>
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
  const cost = m?.price ? " " + t("Ein Modellaufruf kostet grob {x}.", { x: fmtEur(stepCost(m.price), 3) }) : "";
  const name = m?.name || t("Dieses Modell");
  const head = isBilled(modelId) ? t("{m} läuft kostenpflichtig bei {op}.", { m: name, op }) : t("{m} läuft bei {op}.", { m: name, op });
  return confirmDialog(`${head}${withHistory ? t(" Der bisherige Verlauf dieses Chats wird mitgeschickt.") : ""}${cost} ${t("Bitte keine sensiblen Daten eingeben.")}`, t("Weiter"));
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
      <div class="box" role="dialog" aria-modal="true"><h2>${icon(ext().has_access ? "euro" : "external", 22)} ${ext().has_access ? t("Kostenpflichtige externe KI-Modelle") : t("Externe KI-Modelle")}</h2>
        ${externalExplanation(this.operator || undefined)}
        <label><input type="checkbox" .checked=${this.read} @change=${(e: any) => (this.read = e.target.checked)}>
          ${t("Ich habe das gelesen und gebe in Chats mit externen Modellen keine sensiblen Informationen ein.")}</label>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          <button class="btn" @click=${() => this.done(false)}>${t("Abbrechen")}</button>
          <button class="btn primary" ?disabled=${!this.read} @click=${() => this.done(true)}>${icon("check", 16)} ${t("Zustimmen und fortfahren")}</button></div>
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
    <div>${icon("euro", 16)} ${t("Es gibt einen kostenpflichtigen Ersatz ({op}), mit dem es sofort weitergehen kann.", { op: rec.operator })}</div>
    <div class="brow"><button class="btn primary" @click=${() => go(rec.id)}>${t("Mit dem Ersatz weitermachen")}</button></div></div>`;
  return html`<div class="offer">
    <div>${icon("euro", 16)} ${t("Der Hauptanbieter ist gerade nicht nutzbar")}${offer.reason ? ` (${tb(offer.reason)})` : ""}. ${t("Diese kostenpflichtigen Modelle sind freigeschaltet:")}</div>
    <div class="brow">${offer.models.slice(0, 4).map((m: any) => html`<button class="btn ${m.id === rec.id ? "primary" : ""}" title=${`${m.provider_name} · ${priceText(m.price)}`}
      @click=${() => go(m.id)}>${m.name} <span class="muted" style="font-size:12px">· ~${fmtEur(stepCost(m.price), 3)}/${t("Modellaufruf")}</span></button>`)}</div></div>`;
}
