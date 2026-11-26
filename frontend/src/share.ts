// Share dialog for dashboards and tiles: ansehen / bearbeiten / weiter teilen per person, plus „für alle“.
// The owner manages everything; somebody who may pass on manages only the entries they granted, never with more
// rights than they have. The server (access.py) enforces the same rules.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { base, icon, safeElement } from "./ui";
import { store, isSimple } from "./api";
import { t } from "./i18n";

const LEVELS: [string, string][] = [["", "nicht geteilt"], ["view", "ansehen"], ["edit", "bearbeiten"], ["reshare", "bearbeiten und weiter teilen"]];
const lvl = (e: any) => (!e ? "" : e.reshare && e.edit ? "reshare" : e.edit ? "edit" : e.reshare ? "viewshare" : "view");
const flags = (l: string) => ({ edit: l === "edit" || l === "reshare", reshare: l === "reshare" || l === "viewshare" });

let peopleCache: any[] | null = null;

@safeElement("lm-share")
export class Share extends LitElement {
  @property() kind: "tile" | "dashboard" = "tile";
  @property({ attribute: false }) item: any = null;
  @state() private people: any[] = peopleCache || [];
  @state() private draft: Record<string, string> = {};
  @state() private all = "";
  @state() private dirty = false;
  @state() private saving = false;
  static styles = [base, css`
    :host { display: block; }
    .who { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, auto); gap: 8px; align-items: center; padding: 6px 0;
      border-bottom: 1px solid var(--lm-line); }
    .who:last-child { border-bottom: 0; }
    .who .nm { overflow-wrap: anywhere; font-size: 14px; }
    .who .by { font-size: 11.5px; color: var(--lm-muted); }
    select { padding: 6px 8px; }
    .warn { display: flex; gap: 8px; align-items: flex-start; background: color-mix(in srgb, var(--lm-warn) 12%, var(--lm-panel)); border-radius: 10px;
      padding: 9px 11px; font-size: 13px; line-height: 1.45; margin: 10px 0; }
    .warn .i { color: var(--lm-warn); flex: none; margin-top: 1px; }
    .row2 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 6px 0 12px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    if (!peopleCache) {
      store.api.ws("task/people").then(r => { peopleCache = r.people || []; this.people = peopleCache!; }).catch(() => { this.people = []; });
    }
  }
  willUpdate(ch: Map<string, any>) {
    if (ch.has("item") && this.item && !this.dirty) {
      const d: Record<string, string> = {};
      for (const u of this.item.share?.users || []) d[u.user_id] = lvl(u);
      this.draft = d;
      this.all = lvl(this.item.share?.all);
    }
  }
  private get model() { return this.kind === "tile" && this.item?.source?.type === "model"; }
  private get r() { return this.item?.rights || {}; }

  private async save() {
    this.saving = true;
    try {
      const mine = new Set((this.item.share?.users || []).filter((u: any) => !u.mine).map((u: any) => u.user_id));
      const users = Object.entries(this.draft).filter(([uid, l]) => l && !mine.has(uid)).map(([uid, l]) => ({ user_id: uid, ...flags(l) }));
      const msg: any = { key: this.item.key, users };
      if (this.r.owner) msg.all = this.all ? flags(this.all) : null;
      const view = await store.api.ws(this.kind === "tile" ? "tile/share" : "dashboard/share", msg);
      this.dirty = false;
      this.dispatchEvent(new CustomEvent("saved", { detail: view }));
      store.notify(t("Freigaben gespeichert"));
    } catch (e: any) { store.notify(e.message); }
    finally { this.saving = false; }
  }

  render() {
    const it = this.item; if (!it) return nothing;
    const r = this.r;
    const simple = isSimple();
    const tile = this.kind === "tile";
    if (!r.owner && !r.reshare) {
      const owner = it.owner_name || t("jemand anderem");
      return html`<div class="hint">${tile
        ? (r.edit ? t("Diese Kachel gehört {owner}. Du darfst sie ansehen und bearbeiten, aber nicht weitergeben.", { owner }) : t("Diese Kachel gehört {owner}. Du darfst sie ansehen, aber nicht weitergeben.", { owner }))
        : (r.edit ? t("Dieses Dashboard gehört {owner}. Du darfst es ansehen und bearbeiten, aber nicht weitergeben.", { owner }) : t("Dieses Dashboard gehört {owner}. Du darfst es ansehen, aber nicht weitergeben.", { owner }))}</div>`;
    }
    const others = new Map<string, any>((it.share?.users || []).map((u: any) => [u.user_id, u]));
    const opts = LEVELS.filter(([k]) => r.owner || k === "" || k === "view" || (k === "edit" && r.edit) || (k === "reshare" && r.edit && r.reshare));
    const allOpts = this.model ? LEVELS.slice(0, 2) : LEVELS;
    const anyEdit = Object.values(this.draft).some(l => l === "edit" || l === "reshare") || ["edit", "reshare"].includes(this.all);
    return html`
      <div class="hint" style="margin-bottom:8px">${simple
        ? (tile ? t("Andere Personen in diesem Home Assistant sehen die Kachel dann bei sich. Du bestimmst, wer nur schaut, wer ändern und wer weitergeben darf.")
          : t("Andere Personen in diesem Home Assistant sehen das Dashboard dann bei sich. Du bestimmst, wer nur schaut, wer ändern und wer weitergeben darf."))
        : (tile ? t("„Bearbeiten“ erlaubt Änderungen, „weiter teilen“ zusätzlich, die Kachel an andere weiterzugeben – nie mit mehr Rechten als die eigenen. Nimmst du jemandem das Recht, verlieren auch alle, denen diese Person die Kachel gegeben hat, den Zugriff.")
          : t("„Bearbeiten“ erlaubt Änderungen, „weiter teilen“ zusätzlich, das Dashboard an andere weiterzugeben – nie mit mehr Rechten als die eigenen. Nimmst du jemandem das Recht, verlieren auch alle, denen diese Person das Dashboard gegeben hat, den Zugriff."))}</div>
      ${r.owner ? html`<div class="row2"><b style="font-size:14px">${t("Für alle")}</b>
        <select @change=${(e: any) => { this.all = e.target.value; this.dirty = true; }}>
          ${allOpts.map(([k, l]) => html`<option value=${k} ?selected=${this.all === k}>${k ? t(l) : t("aus")}</option>`)}</select>
        <span class="hint">${t("alle, die LLMitMir nutzen – auch später hinzukommende")}${this.model ? t(" (bei Modell-Kacheln nur ansehen)") : ""}</span></div>` : nothing}
      ${this.people.length ? this.people.filter(p => p.id !== it.owner).map(p => {
        const e = others.get(p.id);
        const locked = e && !e.mine;
        return html`<div class="who"><div><div class="nm">${p.name}</div>${e && e.by !== it.owner ? html`<div class="by">${t("über {name}", { name: e.by_name || t("jemand anderen") })}</div>` : nothing}</div>
          <select ?disabled=${locked} title=${locked ? t("Freigegeben von jemand anderem") : ""} @change=${(ev: any) => { this.draft = { ...this.draft, [p.id]: ev.target.value }; this.dirty = true; }}>
            ${(locked ? LEVELS : opts).map(([k, l]) => html`<option value=${k} ?selected=${(this.draft[p.id] || "") === k}>${t(l)}</option>`)}
            ${this.draft[p.id] === "viewshare" ? html`<option value="viewshare" selected>${t("ansehen und weiter teilen")}</option>` : nothing}</select></div>`;
      }) : html`<div class="hint">${t("Es gibt keine weiteren Personen, die LLMitMir nutzen dürfen.")}</div>`}
      ${this.model && anyEdit ? html`<div class="warn">${icon("shield", 18)}<div><b>${t("Achtung:")}</b> ${t("Diese Kachel läuft mit deinen Zugängen und auf deinem Kontingent. Wer sie bearbeiten darf, bestimmt über die Beschreibung, was dabei gelesen wird. Ändert jemand anderes sie, bekommst du eine Benachrichtigung.")}</div></div>` : nothing}
      <div class="row" style="justify-content:flex-end;margin-top:10px">
        <button class="btn primary" ?disabled=${!this.dirty || this.saving} @click=${this.save}>${icon("check", 16)} ${t("Freigaben speichern")}</button></div>`;
  }
}
