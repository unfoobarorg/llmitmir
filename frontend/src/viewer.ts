// Datei-Betrachter: zeigt Bilder, PDFs, Texte, Ton und Video direkt im Panel.
// window.open auf eine blob:-Adresse funktioniert in den mobilen Apps nicht (die WebView
// öffnet keine neuen Fenster) – deshalb ein eigener Betrachter im Panel selbst.
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import DOMPurify from "dompurify";
import { tokens, base, icon, safeElement } from "./ui";
import { store } from "./api";
import { t } from "./i18n";

const TEXT_TYPES = /^(text\/|application\/(json|xml|x-yaml|yaml|javascript|x-sh))/;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|log|ini|toml|py|js|ts|sh|html?|css|ics|vcf|eml)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|svg|heic|heif|tiff?)$/i;
const PDF_EXT = /\.pdf$/i;
const DOC_EXT = /\.(docx|xlsx)$/i;

/** Öffnet den Betrachter für eine Datei aus Chat, Projekt oder Skill. */
export function openFileViewer(scope: string, owner: string, name: string) {
  const el = document.createElement("lm-viewer") as Viewer;
  el.scope = scope; el.owner = owner; el.name = name;
  el.dark = !!store.data?.__dark;
  document.body.appendChild(el);
}

@safeElement("lm-viewer")
export class Viewer extends LitElement {
  @property() scope = "chat";
  @property() owner = "";
  @property() name = "";
  @property({ type: Boolean, reflect: true }) dark = false;
  @state() private kind: "loading" | "image" | "pdf" | "text" | "audio" | "video" | "doc" | "other" | "error" = "loading";
  @state() private url = "";
  @state() private text = "";
  @state() private html = "";   // Word/Excel als fertiger Ausschnitt
  @state() private error = "";
  @state() private page = 1;
  @state() private pages = 1;
  private _urls: string[] = [];

  static styles = [tokens, base, css`
    :host { position: fixed; inset: 0; z-index: 9998; display: block; }
    .back { position: absolute; inset: 0; background: rgba(0, 0, 0, .72); display: flex; flex-direction: column;
      padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
      padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); animation: fadeIn .15s; }
    header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; color: #fff; min-height: 52px; }
    header .name { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    header button { display: inline-grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 10px;
      background: rgba(255, 255, 255, .12); color: #fff; cursor: pointer; flex: none; }
    header button:hover { background: rgba(255, 255, 255, .22); }
    .body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 0 10px 12px; overflow: auto; }
    img.pic { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; background: #fff; }
    pre { margin: 0; width: 100%; height: 100%; overflow: auto; background: var(--lm-panel); color: var(--lm-text);
      border-radius: 12px; padding: 14px; font-family: var(--lm-mono); font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
    audio, video { width: min(560px, 100%); }
    .doc { width: 100%; height: 100%; overflow: auto; background: var(--lm-panel); color: var(--lm-text);
      border-radius: 12px; padding: 16px; font-size: 13.5px; line-height: 1.55; }
    .doc :is(h3) { font-size: 14px; margin: 14px 0 6px; }
    .doc p { margin: 0 0 8px; }
    .doc table { border-collapse: collapse; margin: 0 0 12px; font-size: 12.5px; }
    .doc td { border: 1px solid var(--lm-line); padding: 3px 7px; vertical-align: top; }
    .msg { color: #fff; text-align: center; display: grid; gap: 12px; justify-items: center; font-size: 14px; max-width: 420px; }
    .msg .btn { background: rgba(255, 255, 255, .16); border-color: transparent; color: #fff; }
    .pager { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 13px; padding: 8px 0 0; }
    .pager button { width: 34px; height: 34px; border: 0; border-radius: 9px; background: rgba(255, 255, 255, .14); color: #fff; cursor: pointer; }
    .pager button[disabled] { opacity: .35; pointer-events: none; }
    .wrap { display: flex; flex-direction: column; align-items: center; max-width: 100%; max-height: 100%; min-height: 0; }
    .spin { width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,.3); border-top-color: #fff;
      animation: rot .9s linear infinite; }
    @keyframes rot { to { transform: rotate(360deg); } }
  `];

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
  }

  private async load() {
    try {
      const { blob, type } = await store.api.fileBlob(this.scope, this.owner, this.name);
      const isPdf = type === "application/pdf" || PDF_EXT.test(this.name);
      const isImage = type.startsWith("image/") || IMAGE_EXT.test(this.name);
      if (isPdf) {
        this.kind = "pdf";
        await this.loadPage(1);
      } else if (isImage && !/heic|heif|tiff?/i.test(type || this.name)) {
        this.url = this.track(URL.createObjectURL(blob));
        this.kind = "image";
      } else if (isImage) {
        // HEIC/TIFF stellt kein Browser dar: Home Assistant wandelt in JPEG um
        this.kind = "image";
        this.url = this.track((await store.api.preview(this.scope, this.owner, this.name)).url);
      } else if (type.startsWith("audio/")) {
        this.url = this.track(URL.createObjectURL(blob));
        this.kind = "audio";
      } else if (type.startsWith("video/")) {
        this.url = this.track(URL.createObjectURL(blob));
        this.kind = "video";
      } else if (DOC_EXT.test(this.name)) {
        // Word und Excel: Home Assistant wandelt in einen lesbaren Ausschnitt um (docpreview.py)
        // Der Ausschnitt kommt bereits maskiert aus docpreview.py; hier ein zweites Netz für den Browser.
        this.html = DOMPurify.sanitize(await store.api.docHtml(this.scope, this.owner, this.name),
          { FORBID_TAGS: ["style", "form", "input", "script"], FORBID_ATTR: ["style"] });
        this.kind = "doc";
      } else if (TEXT_TYPES.test(type) || TEXT_EXT.test(this.name)) {
        this.text = (await blob.text()).slice(0, 400_000);
        this.kind = "text";
      } else {
        this.url = this.track(URL.createObjectURL(blob));
        this.kind = "other";
      }
    } catch (e: any) {
      this.error = String(e?.message || e);
      this.kind = "error";
    }
  }

  private track(url: string) {
    this._urls.push(url);
    return url;
  }

  private async loadPage(page: number) {
    try {
      const r = await store.api.preview(this.scope, this.owner, this.name, page);
      this.url = this.track(r.url);
      this.pages = r.pages;
      this.page = Math.max(1, Math.min(page, r.pages));
    } catch (e: any) {
      this.error = String(e?.message || e);
      this.kind = "error";
    }
  }

  private download() {
    const a = document.createElement("a");
    a.href = this.url || URL.createObjectURL(new Blob([this.text], { type: "text/plain" }));
    a.download = this.name.split("/").pop() || "datei";
    document.body.appendChild(a); a.click(); a.remove();
  }

  private close() { this.remove(); }

  render() {
    const k = this.kind;
    return html`<div class="back" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <header>
        ${icon("file", 18)}<span class="name">${this.name}</span>
        ${k !== "loading" && k !== "error" ? html`<button title=${t("Herunterladen")} @click=${() => this.download()}>${icon("download", 20)}</button>` : nothing}
        <button title=${t("Schließen")} @click=${() => this.close()}>${icon("close", 20)}</button>
      </header>
      <div class="body">
        ${k === "loading" ? html`<div class="spin"></div>` : nothing}
        ${k === "error" ? html`<div class="msg">${icon("alert", 28)}<span>${this.error || t("Die Datei lässt sich nicht anzeigen.")}</span></div>` : nothing}
        ${k === "image" ? html`<img class="pic" src=${this.url} alt=${this.name}>` : nothing}
        ${k === "pdf" ? html`<div class="wrap"><img class="pic" src=${this.url} alt=${this.name}>
          ${this.pages > 1 ? html`<div class="pager"><button ?disabled=${this.page <= 1} @click=${() => this.loadPage(this.page - 1)}>${icon("left", 18)}</button>
            <span>${t("Seite")} ${this.page} / ${this.pages}</span>
            <button ?disabled=${this.page >= this.pages} @click=${() => this.loadPage(this.page + 1)}>${icon("right", 18)}</button></div>` : nothing}</div>` : nothing}
        ${k === "text" ? html`<pre>${this.text}</pre>` : nothing}
        ${k === "doc" ? html`<div class="doc" .innerHTML=${this.html}></div>` : nothing}
        ${k === "audio" ? html`<audio controls autoplay src=${this.url}></audio>` : nothing}
        ${k === "video" ? html`<video controls src=${this.url}></video>` : nothing}
        ${k === "other" ? html`<div class="msg">${icon("file", 28)}<span>${t("Diese Art von Datei kann der Betrachter nicht anzeigen.")}</span>
          <button class="btn" @click=${() => this.download()}>${icon("download", 16)} ${t("Herunterladen")}</button></div>` : nothing}
      </div></div>`;
  }
}
