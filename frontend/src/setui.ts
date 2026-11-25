// Bausteine der Einstellungsseiten (persönlich und Admin) nach dem Vorbild der Claude-Einstellungen:
// links eine Liste der Bereiche, rechts ein Bereich mit Gruppen aus Zeilen „Bezeichnung + Erklärung | Bedienelement“.
import { css, html, nothing, type TemplateResult } from "lit";
import { icon } from "./ui";
import { t } from "./i18n";

export type NavItem = { id: string; label: string; icon: string; badge?: string | number | null; sep?: boolean };

type Content = TemplateResult | typeof nothing | string | (TemplateResult | typeof nothing)[];

/** Ganze Seite: Titel, Navigation links (schmal: Leiste oben), Inhalt rechts, Speicherleiste unten. */
export function settingsLayout(o: {
  title: string; items: NavItem[]; active: string; pick: (id: string) => void;
  heading: string; lead?: Content; body: Content; dirty?: boolean; save?: () => void; discard?: () => void;
}) {
  return html`<div class="sp"><h1>${o.title}</h1>
    <div class="sl">
      <nav class="snav" aria-label=${o.title}>${o.items.map(it => html`${it.sep ? html`<div class="sep"></div>` : nothing}
        <button class=${o.active === it.id ? "on" : ""} aria-current=${o.active === it.id ? "page" : "false"} @click=${() => o.pick(it.id)}>
          ${icon(it.icon, 18)}<span class="grow">${it.label}</span>${it.badge ? html`<span class="nb">${it.badge}</span>` : nothing}</button>`)}</nav>
      <div class="sc fade-in">
        <h2 class="st">${o.heading}</h2>${o.lead ? html`<p class="slead">${o.lead}</p>` : nothing}
        ${o.body}</div></div>
    ${o.dirty ? html`<div class="savebar"><div class="sbar fade-in" role="status"><span class="grow">${t("Ungespeicherte Änderungen")}</span>
      <button class="btn ghost" @click=${o.discard}>${t("Verwerfen")}</button>
      <button class="btn primary" @click=${o.save}>${icon("check", 16)} ${t("Speichern")}</button></div></div>` : nothing}
  </div>`;
}

/** Schmale Ansicht: den gewählten Bereich in der waagerechten Leiste sichtbar machen (ohne die Seite zu scrollen). */
export function centerActiveNav(root: ParentNode) {
  const nav = root.querySelector<HTMLElement>(".snav"); const on = nav?.querySelector<HTMLElement>("button.on");
  if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
  const left = on.offsetLeft - nav.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  if (Math.abs(nav.scrollLeft - left) > 4) nav.scrollLeft = Math.max(0, left);
}

/** Gruppe: Überschrift mit kurzer Erklärung, darunter ein Kasten mit Zeilen. */
export function group(title: string, body: Content, o: { desc?: Content; icon?: string; aside?: Content } = {}) {
  return html`<section class="grp">
    <div class="gh"><div class="grow"><h3>${o.icon ? icon(o.icon, 17) : nothing}${title}</h3>${o.desc ? html`<div class="hint">${o.desc}</div>` : nothing}</div>
      ${o.aside || nothing}</div>
    <div class="gb">${body}</div></section>`;
}

/** Zeile: Bezeichnung und Erklärung links, Bedienelement rechts. `stack` setzt das Element darunter (Textfelder, Tabellen). */
export function row(label: Content, desc: Content | null, control: Content, o: { stack?: boolean; dim?: boolean } = {}) {
  return html`<div class="srow ${o.stack ? "stack" : ""} ${o.dim ? "dim" : ""}">
    <div class="stx"><div class="sl1">${label}</div>${desc ? html`<div class="hint">${desc}</div>` : nothing}</div>
    ${control === nothing || control === "" ? nothing : html`<div class="ctl">${control}</div>`}</div>`;
}

/** Freier Inhalt in einer Gruppe, mit Innenabstand. */
export const pad = (c: Content) => html`<div class="pad">${c}</div>`;

/** Schalter (statt Häkchen) – wie in den Claude-Einstellungen. */
export function toggle(on: boolean, change: (v: boolean) => void, o: { disabled?: boolean; label?: string } = {}) {
  return html`<label class="switch" title=${o.label || ""}><input type="checkbox" role="switch" aria-label=${o.label || ""} .checked=${on}
    ?disabled=${o.disabled} @change=${(e: any) => change(e.target.checked)}><span></span></label>`;
}

/** Zeile mit Schalter – der häufigste Fall. */
export const switchRow = (label: Content, desc: Content | null, on: boolean, change: (v: boolean) => void, o: { disabled?: boolean } = {}) =>
  row(label, desc, toggle(on, change, { disabled: o.disabled, label: typeof label === "string" ? label : "" }), { dim: o.disabled });

/** Auswahlliste: eine Option je Zeile mit rundem Markierungspunkt. */
export function choices<T extends string>(name: string, opts: { value: T; label: Content; desc?: Content; disabled?: boolean; icon?: string }[],
  cur: T, pick: (v: T) => void) {
  return opts.map(o => html`<label class="chc ${cur === o.value ? "on" : ""} ${o.disabled ? "dim" : ""}">
    <input type="radio" name=${name} .checked=${cur === o.value} ?disabled=${o.disabled} @change=${() => pick(o.value)}>
    <span class="dot"></span>${o.icon ? html`<span class="ci">${icon(o.icon, 20)}</span>` : nothing}
    <span class="grow"><span class="sl1">${o.label}</span>${o.desc ? html`<span class="hint">${o.desc}</span>` : nothing}</span></label>`);
}

/** Große Auswahlkarten nebeneinander (z. B. die Ansicht) – wie „Erscheinungsbild“ bei Claude. */
export function cards<T extends string>(name: string, opts: { value: T; label: string; desc: string; icon: string; disabled?: boolean }[],
  cur: T, pick: (v: T) => void) {
  return html`<div class="cards">${opts.map(o => html`<label class="ccard ${cur === o.value ? "on" : ""} ${o.disabled ? "dim" : ""}">
    <input type="radio" name=${name} .checked=${cur === o.value} ?disabled=${o.disabled} @change=${() => pick(o.value)}>
    <span class="cico">${icon(o.icon, 26)}</span><b>${o.label}</b><span class="hint">${o.desc}</span>
    ${cur === o.value ? html`<span class="cchk">${icon("check", 14)}</span>` : nothing}</label>`)}</div>`;
}

/** Längere Erklärungen eingeklappt – die Zeile bleibt kurz und verständlich. */
export const more = (c: Content, label = t("Mehr dazu")) =>
  html`<details class="more"><summary>${icon("info", 14)} ${label}</summary><div class="hint">${c}</div></details>`;

/** Leerer Bereich mit Hinweis. */
export const empty = (ic: string, text: Content) => html`<div class="sempty">${icon(ic, 28)}<div class="hint">${text}</div></div>`;

/** Sammeleintrag für Listen, die der Admin pflegt (Konnektoren, Skills, Richtlinien, Anbieter). */
export const itemCard = (head: Content, body: Content, off = false) =>
  html`<div class="icard ${off ? "off" : ""}"><div class="ihead">${head}</div>${body && body !== nothing ? html`<div class="ibody">${body}</div>` : nothing}</div>`;

export const settingsCss = css`
  :host { display: block; height: 100%; overflow-y: auto; container-type: inline-size; scroll-padding-top: 60px; }
  .sp { max-width: 1100px; margin: 0 auto; padding: 28px 28px 110px; min-width: 0; }
  .sp > h1 { font-family: var(--lm-head); font-weight: 650; font-size: 28px; margin: 4px 0 22px; letter-spacing: -.02em; }
  .sl { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 36px; align-items: start; }
  .snav { position: sticky; top: 12px; display: flex; flex-direction: column; gap: 2px; }
  .snav button { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; border: 0; background: transparent;
    color: var(--lm-muted); font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: background .15s, color .15s; min-height: 38px; }
  .snav button:hover { background: var(--lm-hover); color: var(--lm-text); }
  .snav button.on { background: var(--lm-hover); color: var(--lm-text); font-weight: 600; }
  .snav button.on .i { color: var(--lm-accent); }
  .snav .sep { height: 1px; background: var(--lm-line); margin: 8px 10px; }
  .snav .nb { font-size: 11px; min-width: 18px; padding: 1px 6px; border-radius: 999px; background: var(--lm-accent-soft); color: var(--lm-accent); text-align: center; }
  .sc { min-width: 0; }
  .st { font-family: var(--lm-head); font-size: 21px; font-weight: 650; margin: 3px 0 4px; letter-spacing: -.01em; }
  .slead { color: var(--lm-muted); font-size: 14px; margin: 0 0 22px; line-height: 1.5; max-width: 70ch; }
  .grp { margin: 0 0 28px; }
  .gh { display: flex; align-items: flex-end; gap: 12px; margin: 0 2px 10px; }
  .gh h3 { display: flex; align-items: center; gap: 7px; font-size: 15px; font-weight: 600; margin: 0 0 2px; }
  .gh h3 .i { color: var(--lm-muted); }
  .gb { background: var(--lm-panel); border: 1px solid var(--lm-line); border-radius: var(--lm-r); overflow: hidden; }
  .gb > * + * { border-top: 1px solid var(--lm-line); }
  .pad { padding: 14px 16px; }
  .srow { display: flex; align-items: center; gap: 18px; padding: 14px 16px; min-height: 30px; }
  .srow.stack { flex-direction: column; align-items: stretch; gap: 10px; }
  .srow.dim { opacity: .55; }
  .stx { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .sl1 { font-size: 14px; font-weight: 550; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ctl { flex: none; max-width: 55%; display: flex; align-items: center; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .srow.stack .ctl { max-width: none; justify-content: flex-start; }
  .ctl select { width: auto; min-width: 210px; max-width: 100%; }
  .ctl input:not([type=checkbox]):not([type=radio]) { width: 260px; max-width: 100%; }
  .ctl input.short { width: 110px; }
  .srow.stack .ctl > input, .srow.stack .ctl > textarea, .srow.stack .ctl > select { width: 100%; max-width: none; }
  .switch { position: relative; display: inline-block; width: 42px; height: 24px; flex: none; }
  .switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
  .switch span { position: absolute; inset: 0; background: color-mix(in srgb, var(--lm-muted) 38%, var(--lm-line)); border-radius: 999px; transition: background .2s; }
  .switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,.28); transition: transform .2s; }
  .switch input:checked + span { background: var(--lm-accent); }
  .switch input:checked + span::after { transform: translateX(18px); }
  .switch input:focus-visible + span { box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  .switch input:disabled { cursor: default; }
  .chc { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 13px 16px; cursor: pointer; transition: background .15s; }
  .chc:hover { background: var(--lm-hover); }
  .chc input { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; }
  .chc .dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--lm-line); flex: none; margin-top: 1px; transition: border .15s; box-sizing: border-box; }
  .chc.on .dot { border: 5px solid var(--lm-accent); }
  .chc input:focus-visible ~ .dot { box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  .chc .grow { display: grid; gap: 2px; min-width: 0; }
  .chc .ci { color: var(--lm-muted); display: flex; } .chc.on .ci { color: var(--lm-accent); }
  .chc.dim, .ccard.dim { opacity: .5; cursor: default; }
  .chc.dim:hover { background: none; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; padding: 16px; }
  .ccard { position: relative; display: grid; gap: 6px; align-content: start; padding: 16px; border: 1px solid var(--lm-line); border-radius: 12px;
    background: var(--lm-bg); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .ccard:hover { border-color: color-mix(in srgb, var(--lm-accent) 40%, var(--lm-line)); }
  .ccard.on { border-color: var(--lm-accent); box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  .ccard input { position: absolute; opacity: 0; pointer-events: none; }
  .ccard .cico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--lm-panel); color: var(--lm-muted); border: 1px solid var(--lm-line); }
  .ccard.on .cico { color: var(--lm-accent); background: var(--lm-accent-soft); border-color: transparent; }
  .ccard b { font-size: 14.5px; }
  .cchk { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; border-radius: 50%; background: var(--lm-accent); color: var(--lm-on-accent); display: grid; place-items: center; }
  details.more { margin-top: 4px; }
  details.more > summary { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; color: var(--lm-accent); font-size: 12.5px; list-style: none; user-select: none; }
  details.more > summary::-webkit-details-marker { display: none; }
  details.more > .hint { margin-top: 6px; padding: 10px 12px; border-radius: 10px; background: var(--lm-hover); }
  .sempty { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 34px 20px; color: var(--lm-faint); }
  .sempty .hint { max-width: 52ch; }
  .icard { border-bottom: 1px solid var(--lm-line); }
  .gb > .icard + .icard { border-top: 0; }
  .icard:last-child { border-bottom: 0; }
  .icard.off { background: color-mix(in srgb, var(--lm-hover) 60%, transparent); }
  .icard.off .ibody, .icard.off .ihead > *:not(.keep) { opacity: .6; }
  .ihead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; }
  .ihead input:not([type=checkbox]) { flex: 1; min-width: 160px; font-weight: 550; }
  .ihead select { width: auto; }
  .ibody { display: grid; gap: 10px; padding: 0 16px 14px; }
  .gb > .icard + .gfoot { border-top: 0; }
  .gfoot { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; background: color-mix(in srgb, var(--lm-hover) 50%, transparent); }
  .savebar { position: sticky; bottom: 16px; display: flex; justify-content: center; margin-top: 18px; z-index: 5; pointer-events: none; }
  .sbar { pointer-events: auto; display: flex; align-items: center; gap: 8px; min-width: min(460px, 100%); padding: 8px 8px 8px 18px;
    background: var(--lm-raise); border: 1px solid var(--lm-line); border-radius: 999px; box-shadow: 0 10px 34px rgba(0,0,0,.18); font-size: 14px; }
  .sbar .btn { border-radius: 999px; }
  .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: var(--lm-line); }
  .kv > div { background: var(--lm-panel); padding: 14px 16px; display: grid; gap: 2px; }
  .kv b { font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  @container (max-width: 780px) {
    .sp { padding: 14px 14px 110px; }
    .sp > h1 { font-size: 25px; margin-bottom: 12px; }
    .sl { grid-template-columns: minmax(0, 1fr); gap: 16px; }
    .snav { flex-direction: row; overflow-x: auto; top: 0; z-index: 4; background: var(--lm-bg); margin: 0 -14px; padding: 6px 14px 8px;
      scrollbar-width: none; border-bottom: 1px solid var(--lm-line); }
    .snav::-webkit-scrollbar { display: none; }
    .snav button { flex: none; white-space: nowrap; padding: 7px 12px; min-height: 34px; border-radius: 999px; }
    .snav button.on { background: var(--lm-accent-soft); color: var(--lm-accent); }
    .snav .sep { display: none; }
    .srow { flex-wrap: wrap; gap: 10px; }
    .ctl { max-width: 100%; }
    .ctl select, .ctl input:not([type=checkbox]):not([type=radio]) { min-width: 0; width: 100%; }
    .srow:not(.stack) .ctl:has(.switch) { margin-left: auto; }
    .srow:has(.switch) { flex-wrap: nowrap; }
    .srow:not(:has(.switch)) > .stx { flex: 1 1 100%; }
    .srow:not(:has(.switch)) > .ctl { flex: 1 1 100%; justify-content: flex-start; }
    .ctl .btn { flex: none; }
  }
`;
