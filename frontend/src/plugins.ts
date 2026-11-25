// Plugins: eine Seite für Konnektoren, Skills und Zugänge – wie in der Claude-Desktop-App. Erreichbar über das Hauptmenü
// und die persönlichen Einstellungen. Skills und Zugänge, die zu einer Konnektor-Verbindung gehören, stehen ausgegraut in
// ihren Listen und lassen sich nur über den Konnektor öffnen.
import { css, html } from "lit";
import { property } from "lit/decorators.js";
import { StoreElement, base, icon, safeElement } from "./ui";
import { store, navigate } from "./api";
import { t } from "./i18n";
import "./connectors";

export type PluginTab = "connectors" | "skills" | "credentials";

/** Reiter der Plugins-Seite mit Anzahl: Verbindungen, eigene Skills, eigene Zugänge. */
export function pluginTabs(): { id: PluginTab; label: string; icon: string; count: number }[] {
  const d = store.data || {};
  return [
    { id: "connectors", label: t("Konnektoren"), icon: "share", count: (d.credentials || []).filter((c: any) => c.connector_id).length },
    { id: "skills", label: t("Skills"), icon: "skill", count: (d.skills || []).filter((s: any) => !s.connection_id).length },
    { id: "credentials", label: t("Zugänge"), icon: "key", count: (d.credentials || []).filter((c: any) => !c.connector_id).length },
  ];
}

export function defaultPluginTab(): PluginTab {
  return (store.data?.connectors || []).length ? "connectors" : "skills";
}

const styles = css`:host { display: block; height: 100%; overflow-y: auto; }
  :host([embedded]) { height: auto; overflow: visible; }
  .ptabs { display: flex; gap: 4px; border-bottom: 1px solid var(--lm-line); margin: 0 0 18px; overflow-x: auto; }
  .ptabs button { display: inline-flex; align-items: center; gap: 7px; border: 0; background: none; padding: 10px 14px; cursor: pointer;
    color: var(--lm-muted); font: inherit; font-size: 14px; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
  .ptabs button:hover { color: var(--lm-text); }
  .ptabs button.on { color: var(--lm-text); font-weight: 600; border-bottom-color: var(--lm-accent); }
  .ptabs .n { font-size: 11.5px; min-width: 18px; padding: 1px 6px; border-radius: 999px; background: var(--lm-side); text-align: center; }
  .ptabs button.on .n { background: var(--lm-accent-soft); color: var(--lm-accent); }`;

@safeElement("lm-plugins")
export class PluginsPage extends StoreElement {
  @property() tab = "";
  /** In den persönlichen Einstellungen: ohne eigene Überschrift, Wege bleiben unter /settings/plugins. */
  @property({ type: Boolean, reflect: true }) embedded = false;
  static styles = [base, styles];

  private pick(id: PluginTab) { navigate(this.embedded ? `/settings/plugins/${id}` : `/plugins/${id}`); }

  render() {
    const tabs = pluginTabs();
    const cur: PluginTab = (tabs.find(x => x.id === this.tab)?.id) || defaultPluginTab();
    const body = cur === "connectors" ? html`<lm-connectors embedded></lm-connectors>`
      : cur === "skills" ? html`<lm-skills embedded></lm-skills>` : html`<lm-credentials embedded></lm-credentials>`;
    const inner = html`<nav class="ptabs" role="tablist">${tabs.map(x => html`<button role="tab" class=${x.id === cur ? "on" : ""} aria-selected=${x.id === cur}
        @click=${() => this.pick(x.id)}>${icon(x.icon, 17)} ${x.label}${x.count ? html`<span class="n">${x.count}</span>` : ""}</button>`)}</nav>${body}`;
    return this.embedded ? inner : html`<div class="page"><h1>${t("Plugins")}</h1>
      <p class="hint">${t("Konnektoren verbinden LLMitMir mit anderen Systemen, Skills sind Anleitungen für wiederkehrende Themen, Zugänge enthalten die Anmeldedaten. Was zu einem Konnektor gehört, bearbeitest du über den Konnektor.")}</p>${inner}</div>`;
  }
}
