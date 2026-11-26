// Websocket/HTTP access and the shared client-side state.
import { builtVersion, isStale } from "./version";
import { lang, setLang, t, tb } from "./i18n";

// Version, mit der dieses Skript geladen wurde (aus seiner eigenen Adresse)
const BUILT = builtVersion(import.meta.url);

export type Hass = any;

export class Api {
  constructor(public hass: Hass) {}
  ws<T = any>(type: string, data: Record<string, any> = {}): Promise<T> {
    // Fehlermeldungen des Servers sind deutsch – hier einmal zentral in die Sprache der Oberfläche
    return this.hass.connection.sendMessagePromise({ type: `llmitmir/${type}`, ...data }).catch((e: any) => {
      if (e && typeof e.message === "string") e.message = tb(e.message);
      throw e;
    });
  }
  subscribe(cb: (e: any) => void): Promise<() => Promise<void>> {
    return this.hass.connection.subscribeMessage(cb, { type: "llmitmir/subscribe" });
  }
  /** Upload in parts of 768 KB: reverse proxies often limit request bodies to 1 MB, HA itself to 16 MB. */
  private async sendFile(scope: string, owner: string, file: File, onProgress?: (done: number, total: number) => void): Promise<any> {
    const CHUNK = 768 * 1024;
    const parts = Math.max(1, Math.ceil(file.size / CHUNK));
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let last: any = null;
    for (let i = 0; i < parts; i++) {
      const fd = new FormData();
      fd.append("scope", scope); fd.append("owner", owner); fd.append("filename", file.name);
      if (parts > 1) { fd.append("upload_id", id); fd.append("index", String(i)); fd.append("last", i === parts - 1 ? "1" : "0"); }
      fd.append("file", file.slice(i * CHUNK, (i + 1) * CHUNK), file.name);
      let r: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { r = await this.hass.fetchWithAuth("/api/llmitmir/upload", { method: "POST", body: fd }); if (r!.status < 500) break; } catch { /* retry */ }
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
      }
      if (!r) throw new Error(t("Upload fehlgeschlagen"));
      last = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(tb(last.message) || (r.status === 413 ? t("Datei zu groß für den Webserver") : `HTTP ${r.status}`));
      onProgress?.(Math.min(file.size, (i + 1) * CHUNK), file.size);
    }
    return last;
  }
  async upload(scope: string, owner: string, files: File[] | FileList): Promise<any> {
    const out: any[] = [];
    for (const f of Array.from(files)) out.push(...((await this.sendFile(scope, owner, f)).files || []));
    return { files: out };
  }
  uploadImport(file: File, onProgress?: (done: number, total: number) => void): Promise<any> {
    return this.sendFile("import", "import", file, onProgress);
  }
  private filePath(scope: string, owner: string, name: string): string {
    return `/api/llmitmir/file/${scope}/${owner}/${name.split("/").map(encodeURIComponent).join("/")}`;
  }
  /** Datei als Blob samt Inhaltstyp – Grundlage für den Betrachter (Bild, PDF, Text, Ton, Video). */
  async fileBlob(scope: string, owner: string, name: string): Promise<{ blob: Blob; type: string }> {
    const r = await this.hass.fetchWithAuth(this.filePath(scope, owner, name));
    if (!r.ok) throw new Error(r.status === 404 ? t("Datei nicht gefunden") : `HTTP ${r.status}`);
    return { blob: await r.blob(), type: (r.headers.get("content-type") || "").split(";")[0].trim() };
  }
  /** Vorschau einer PDF-Seite (oder eines HEIC/TIFF-Bildes) als JPEG – die mobilen Apps stellen PDFs nicht selbst dar. */
  async preview(scope: string, owner: string, name: string, page = 1): Promise<{ url: string; pages: number }> {
    const r = await this.hass.fetchWithAuth(`/api/llmitmir/preview/${scope}/${owner}/${name.split("/").map(encodeURIComponent).join("/")}?page=${page}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { url: URL.createObjectURL(await r.blob()), pages: Number(r.headers.get("x-llmitmir-pages") || 1) || 1 };
  }
  /** Word- und Excel-Dateien als fertig maskiertes HTML (docpreview.py) – für den Betrachter. */
  async docHtml(scope: string, owner: string, name: string): Promise<string> {
    const r = await this.hass.fetchWithAuth(`/api/llmitmir/doc/${scope}/${owner}/${name.split("/").map(encodeURIComponent).join("/")}`);
    if (!r.ok) throw new Error(r.status === 415 ? t("Keine Vorschau möglich") : `HTTP ${r.status}`);
    return await r.text();
  }
  async fileUrl(scope: string, owner: string, name: string): Promise<string> {
    return URL.createObjectURL((await this.fileBlob(scope, owner, name)).blob);
  }
  async transcribe(wav: Blob): Promise<string> {
    const r = await this.hass.fetchWithAuth("/api/llmitmir/transcribe", { method: "POST", body: wav, headers: { "Content-Type": "audio/wav" } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(tb(j.message) || `HTTP ${r.status}`);
    return j.text || "";
  }
}

/** Home Assistant pushed a new `hass` object (states changed): HA tiles listen and redraw what concerns them. */
export const hassBus = new EventTarget();

export interface RunState { run_id: string; status: string; detail: any; started: number; hint?: any; }

/** Global reactive store; components re-render on "change". */
export class Store extends EventTarget {
  api!: Api;
  data: any = null;
  chats = new Map<string, any>();      // full chat objects (loaded on demand)
  chatFiles = new Map<string, any[]>();
  runs: Record<string, RunState> = {};
  permissions: any[] = [];
  inbox: any[] = [];        // Benachrichtigungen auf der Startseite (inbox.ts)
  inboxPing = 0;            // Zähler: steigt, wenn eine neue Karte kam (die Startseite spielt dann einen Ton)
  tileData = new Map<string, any>();   // Kacheldaten (key "owner:id" -> record), geladen für sichtbare Dashboards
  tileRuns: Record<string, string> = {}; // key -> "queued" | "running" (Modell-Kacheln)
  private boardsLoading: Promise<void> | null = null;
  error = "";
  toast = "";
  private _t: any;
  changed() { this.dispatchEvent(new Event("change")); }
  notify(msg: string) {
    this.toast = msg; this.changed();
    clearTimeout(this._t); this._t = setTimeout(() => { this.toast = ""; this.changed(); }, 4500);
  }
  /** Auf dem Server läuft inzwischen eine andere Version als in diesem Fenster (version.ts): diese Version. */
  newVersion = "";
  private firstVersion = "";
  async load() {
    this.data = await this.api.ws("bootstrap");
    // Sprache: Wahl in den Einstellungen, „Automatisch“ folgt Home Assistant
    setLang(this.data?.settings?.language || "auto", this.api.hass?.language);
    // Push-Nachrichten und Sprachausgabe kommen vom Server – er erfährt so die Sprache, die hier wirklich gilt
    const ui = lang();
    if (this.data?.settings && this.data.settings.ui_lang !== ui) {
      this.data.settings.ui_lang = ui;
      this.api.ws("settings/save", { settings: { ui_lang: ui } }).catch(() => { /* nicht wichtig genug für eine Meldung */ });
    }
    const server = String(this.data?.version || "");
    this.firstVersion = this.firstVersion || server;
    this.newVersion = isStale(BUILT, this.firstVersion, server) ? server : "";
    this.runs = this.data.runs || {};
    this.permissions = this.data.permissions || [];
    this.inbox = this.data.inbox || [];
    this.changed();
  }
  /** Dashboards, Kacheln und Kachel-Aufgaben neu holen – ohne den ganzen Bootstrap. */
  async loadBoards() {
    if (this.boardsLoading) return this.boardsLoading;
    this.boardsLoading = (async () => {
      try { if (this.data) { this.data.boards = await this.api.ws("dashboards/list"); this.changed(); } }
      finally { this.boardsLoading = null; }
    })();
    return this.boardsLoading;
  }
  async loadTileData(keys: string[], force = false) {
    const want = keys.filter(k => force || !this.tileData.has(k));
    if (!want.length) return;
    const r = await this.api.ws("tile/data", { keys: want });
    for (const k of want) this.tileData.set(k, r.records?.[k] ?? null);
    this.changed();
  }
  async loadChat(id: string, force = false) {
    if (!force && this.chats.has(id)) return this.chats.get(id);
    const r = await this.api.ws("chat/get", { chat_id: id });
    this.chats.set(id, r.chat);
    this.chatFiles.set(id, r.files);
    this.changed();
    return r.chat;
  }
  handle(e: any) {
    const d = this.data;
    if (!d) return;
    switch (e.type) {
      case "chat": {
        const i = d.chats.findIndex((c: any) => c.id === e.chat.id);
        if (i >= 0) d.chats[i] = e.chat; else d.chats.unshift(e.chat);
        d.chats.sort((a: any, b: any) => (b.updated || 0) - (a.updated || 0));
        const full = this.chats.get(e.chat.id);
        if (full) {
          Object.assign(full, { title: e.chat.title, status: e.chat.status, model: e.chat.model, model_auto: e.chat.model_auto, pinned: e.chat.pinned, project_id: e.chat.project_id, tools: e.chat.tools, internal_only: e.chat.internal_only });
          // Teilaufgabe: ihr Stand kommt mit der Zusammenfassung (die Karte im Hauptchat und die Leiste lesen ihn)
          if (full.sub && e.chat.sub_status) full.sub.status = e.chat.sub_status;
        }
        break;
      }
      case "queued": {
        // Nachrichten, die während eines Laufs geschrieben wurden und noch warten
        const c = this.chats.get(e.chat_id);
        if (c) c.queued = e.items || [];
        break;
      }
      case "chat_deleted":
        d.chats = d.chats.filter((c: any) => c.id !== e.chat_id); this.chats.delete(e.chat_id); break;
      case "message": {
        const c = this.chats.get(e.chat_id);
        if (c) {
          const i = c.messages.findIndex((m: any) => m.id === e.message.id);
          if (i >= 0) c.messages[i] = { ...c.messages[i], ...e.message };
          else {
            // tool result replaces its "running" placeholder (same id)
            c.messages.push(e.message);
          }
          // eine wartende Nachricht ist jetzt dran: aus der Warteschlange in den Verlauf
          if (c.queued?.length) c.queued = c.queued.filter((q: any) => q.id !== e.message.id);
          if (e.message.role === "tool" && e.message.status !== "running") {
            c.messages = c.messages.filter((m: any) => !(m.status === "running" && m.tool_call_id === e.message.tool_call_id && m.id !== e.message.id));
          }
        }
        break;
      }
      case "messages": {
        // der Verlauf wurde zurückgenommen (Sprachgespräch: Nachsatz mit der ersten Hälfte verbunden)
        const c = this.chats.get(e.chat_id);
        if (c) c.messages = e.messages || [];
        break;
      }
      case "delta": {
        const c = this.chats.get(e.chat_id);
        const m = c?.messages.find((x: any) => x.id === e.message_id);
        if (m) {
          // Textstücke sind je Nachricht fortlaufend nummeriert. Kommt eines zweimal an (zwei Abos
          // derselben Person, Neuverbindung), wird es nur einmal angehängt – sonst stünde die
          // halbe Antwort mehrfach im Chat, bis die fertige Nachricht sie wieder zusammenzieht.
          if (typeof e.seq === "number") {
            if (typeof m.dseq === "number" && e.seq <= m.dseq) break;
            m.dseq = e.seq;
          }
          m.content = (m.content || "") + (e.content || "");
          m.reasoning = (m.reasoning || "") + (e.reasoning || "");
        }
        break;
      }
      case "run":
        if (["done", "error", "stopped"].includes(e.status)) {
          delete this.runs[e.chat_id];
          const c = this.chats.get(e.chat_id);
          if (c) c.messages = c.messages.filter((m: any) => !(m.streaming && !m.content));
        } else this.runs[e.chat_id] = { run_id: e.run_id, status: e.status, detail: e.detail, started: e.started, hint: e.hint };
        break;
      case "permission": this.permissions = [...this.permissions.filter(p => p.id !== e.permission.id), e.permission]; break;
      case "permission_done": this.permissions = this.permissions.filter(p => p.id !== e.id); break;
      case "progress": { const c = this.chats.get(e.chat_id); if (c) c.progress = e.items; break; }
      case "files": this.chatFiles.set(e.chat_id, e.files); break;
      case "usage":
        d.usage = e.usage;
        if (e.usage?.external) d.external = e.usage.external;
        if (e.chat_id && e.chat_usage) { const c = this.chats.get(e.chat_id); if (c) c.usage = e.chat_usage; }
        break;
      case "cred_usage": {
        const c = (d.credentials || []).find((x: any) => x.id === e.id);
        if (c) { c.uses = e.uses; c.last_used = e.last_used; c.last_model = e.last_model;
          c.ext_uses = e.ext_uses; c.ext_uses_since = e.ext_uses_since; c.ext_last = e.ext_last; }
        break;
      }
      case "cred_check": {
        const c = (d.credentials || []).find((x: any) => x.id === e.id);
        if (c) c.check = e.check;
        break;
      }
      case "tasks_queue": d.queue = e.queue; break;
      case "maintenance": d.maintenance = e.state; break;  // Wartung vor einem Neustart (maintenance.py)
      case "inbox": {
        // neue Karten von geplanten Aufgaben – die Startseite zeigt sie und spielt einen kurzen Ton
        const before = new Set(this.inbox.map((x: any) => x.id));
        this.inbox = e.items || [];
        if (this.inbox.some((x: any) => !before.has(x.id))) this.inboxPing++;
        break;
      }
      case "models": d.models = e.models; d.defaults = e.defaults; if (e.external) d.external = e.external; break;
      case "meta": this.load(); return;
      case "boards": this.loadBoards(); return;
      case "tile_data": this.tileData.set(e.key, e.record); break;
      case "tile_run":
        if (e.state === "idle") { delete this.tileRuns[e.key]; this.loadBoards(); } else this.tileRuns[e.key] = e.state;
        break;
      case "import_done": this.notify("Import abgeschlossen"); break;
    }
    this.changed();
  }
}

export const store = new Store();

/** Simple view (Laien-Ansicht, the default): no model choice, chats show only request and answer, features explained. */
export const isSimple = () => store.data?.view?.view !== "expert";

export function navigate(path: string, replace = false) {
  const url = `/llmitmir${path.startsWith("/") ? path : "/" + path}`;
  if (replace) history.replaceState(null, "", url); else history.pushState(null, "", url);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
}
