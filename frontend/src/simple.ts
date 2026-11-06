// Simple view (Laien-Ansicht): plain explanations of skills, scheduled tasks, credentials and projects,
// with a one-click start that lets the assistant set things up in a chat.
import { css, html, nothing } from "lit";
import { icon } from "./ui";
import { store } from "./api";
import { startChat } from "./pages";

type Kind = "skills" | "tasks" | "credentials" | "projects";

interface Explainer { icon: string; title: string; text: string; examples: string[]; steps: string[]; chat?: [string, string]; }

const EXPLAIN: Record<Kind, Explainer> = {
  tasks: {
    icon: "task", title: "LLMitMir erledigt etwas regelmäßig für dich",
    text: "Eine geplante Aufgabe läuft von selbst zu festen Zeiten – auch wenn du gerade nicht hinschaust. Das Ergebnis "
      + "bekommst du als Nachricht aufs Handy und findest es hier. Ist gerade viel los, startet eine Aufgabe auch mal ein paar Minuten später.",
    examples: ["Jeden Morgen um 7 Uhr: Wetter und Termine des Tages", "Freitags: an die Mülltonne erinnern", "Am Monatsersten: Stromverbrauch zusammenfassen"],
    steps: ["Sag im Chat, was regelmäßig passieren soll und wann.", "LLMitMir schlägt dir die fertige Aufgabe vor.", "Du tippst auf „Übernehmen“ – fertig."],
    chat: ["Aufgabe im Chat einrichten", "Ich möchte eine geplante Aufgabe einrichten. Erkläre mir in einem Satz, was das ist, und frag mich dann "
      + "Schritt für Schritt, was regelmäßig passieren soll, wann und ob ich eine Nachricht aufs Handy bekommen möchte. Schlag mir am Ende die fertige Aufgabe vor."],
  },
  skills: {
    icon: "skill", title: "Anleitungen, die LLMitMir sich merkt",
    text: "Ein Skill ist wie ein Merkzettel für ein wiederkehrendes Thema: Du erklärst einmal, wie etwas geht. Kommt das Thema später "
      + "in einem Chat vor, liest LLMitMir die Anleitung von selbst nach – du musst sie nicht jedes Mal neu erklären.",
    examples: ["So schreibe ich E-Mails an Kunden", "Wo welche Unterlagen in der Nextcloud liegen", "Wie unsere Heizung eingestellt wird"],
    steps: ["Erzähl im Chat, worum es geht und was LLMitMir dabei beachten soll.", "LLMitMir schreibt daraus die Anleitung.", "Du tippst auf „Übernehmen“."],
    chat: ["Skill im Chat anlegen", "Ich möchte einen neuen Skill anlegen. Erkläre mir in einem Satz, was ein Skill ist, und frag mich dann Schritt für "
      + "Schritt, worum es gehen soll und was du dabei beachten musst. Schlag mir am Ende den fertigen Skill vor."],
  },
  credentials: {
    icon: "key", title: "Passwörter sicher hinterlegen",
    text: "Damit LLMitMir zum Beispiel auf deine Nextcloud, einen Kalender oder einen anderen Dienst zugreifen kann, braucht es "
      + "Benutzername und Passwort. Die trägst du hier ein. Die KI selbst bekommt dein Passwort nie zu sehen – LLMitMir setzt es erst "
      + "beim Zugriff im Hintergrund ein und schwärzt es in allen Ergebnissen.",
    examples: ["Nextcloud (Dateien, Kalender, Kontakte)", "Ein Webdienst mit Zugangsschlüssel", "Ein E-Mail-Postfach"],
    steps: ["Tippe auf „Neuer Zugang“ und wähle den Dienst.", "Trag Adresse, Benutzername und Passwort ein.", "Ab jetzt kann LLMitMir den Dienst nutzen, wenn du darum bittest."],
    chat: ["Im Chat erklären lassen", "Ich möchte einen neuen Zugang einrichten. Frag mich, für welchen Dienst, und erkläre mir einfach, welche Angaben "
      + "ich dafür brauche und wo ich sie finde. Das Passwort trage ich danach selbst ein."],
  },
  projects: {
    icon: "project", title: "Ordner für alles, was zusammengehört",
    text: "Ein Projekt sammelt Chats, Dateien und Hinweise zu einem Thema. Was du im Projekt hinterlegst, kennt jeder neue Chat darin schon – "
      + "du musst es nicht jedes Mal wieder erzählen.",
    examples: ["Hausbau – mit Plänen und Budget", "Steuern 2026 – mit Belegen", "Verein – mit Satzung und Mitgliederliste"],
    steps: ["Lege ein Projekt an und gib ihm einen Namen.", "Schreib dazu, was LLMitMir wissen soll, und lade Dateien hoch.", "Starte deine Chats direkt im Projekt."],
  },
};

export const explainerCss = css`
  .explain { display: grid; gap: 12px; background: var(--lm-panel); border: 1px solid var(--lm-line); border-radius: 18px; padding: 18px 18px 16px;
    margin-bottom: 20px; box-shadow: var(--lm-shadow); }
  .explain .eh { display: flex; gap: 12px; align-items: center; }
  .explain .eh .ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--lm-accent-soft);
    color: var(--lm-accent); flex: none; }
  .explain .eh b { font-size: 17px; font-family: var(--lm-head); }
  .explain p { margin: 0; line-height: 1.55; font-size: 14.5px; }
  .explain .ex { display: flex; flex-wrap: wrap; gap: 6px; }
  .explain .ex span { font-size: 13px; background: var(--lm-hover); border-radius: 999px; padding: 4px 11px; color: var(--lm-muted); }
  .explain ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; counter-reset: s; }
  .explain li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.45; counter-increment: s; }
  .explain li::before { content: counter(s); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex: none;
    background: var(--lm-accent); color: var(--lm-on-accent); font-size: 12px; font-weight: 650; margin-top: -1px; }
  .explain .eb { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
  .explain.mini { padding: 12px 14px; gap: 0; }
  .explain.mini[open] { gap: 12px; }
  .explain.mini > summary { list-style: none; cursor: pointer; flex-wrap: wrap; }
  .explain.mini > summary::-webkit-details-marker { display: none; }
  .explain.mini > summary .grow { display: grid; gap: 1px; min-width: 180px; }
  .explain.mini > summary b { font-size: 15px; }
  .explain.mini .ic { width: 38px; height: 38px; border-radius: 12px; }
  details.more { margin-top: 14px; border: 1px solid var(--lm-line); border-radius: 14px; background: var(--lm-panel); }
  details.more > summary { cursor: pointer; padding: 12px 14px; font-weight: 560; font-size: 14px; list-style: none; display: flex; gap: 8px; align-items: center; }
  details.more > summary::-webkit-details-marker { display: none; }
  details.more[open] > summary { border-bottom: 1px solid var(--lm-line); }
  details.more > .in { padding: 14px; display: grid; gap: 14px; }
`;

/** Plain-language card at the top of a page in the simple view: open while the page is still empty,
 *  afterwards folded to one line (the chat shortcut stays visible). */
export function explainer(kind: Kind, empty: boolean) {
  const e = EXPLAIN[kind];
  const chatBtn = e.chat ? html`<button class="btn ${empty ? "primary" : ""}" @click=${(ev: Event) => { ev.preventDefault(); chatAbout(e.chat![1]); }}>${icon("chat", 18)} ${e.chat[0]}</button>` : nothing;
  const body = html`<p>${e.text}</p>
    <div><div class="hint" style="margin-bottom:6px">Zum Beispiel</div><div class="ex">${e.examples.map(x => html`<span>${x}</span>`)}</div></div>
    <div><div class="hint" style="margin-bottom:8px">So geht's</div><ol>${e.steps.map(s => html`<li>${s}</li>`)}</ol></div>`;
  if (!empty) return html`<details class="explain mini"><summary class="eh"><span class="ic">${icon(e.icon, 22)}</span>
      <span class="grow"><b>${e.title}</b><span class="hint">So funktioniert's</span></span>${chatBtn}</summary>${body}</details>`;
  return html`<div class="explain">
    <div class="eh"><span class="ic">${icon(e.icon, 24)}</span><b>${e.title}</b></div>
    ${body}${e.chat ? html`<div class="eb">${chatBtn}</div>` : nothing}</div>`;
}

/** Start a chat in which the assistant guides through setting something up. */
export async function chatAbout(text: string) {
  try { await startChat({ text, files: [], model: "", mode: "chat", tools: null, project_id: null }); }
  catch (err: any) { store.notify(String(err.message || err)); }
}

/** Collapsed block for options laypeople rarely need. */
export const more = (content: unknown, label = "Mehr Optionen") =>
  html`<details class="more"><summary>${icon("settings", 18)} ${label}</summary><div class="in">${content}</div></details>`;
