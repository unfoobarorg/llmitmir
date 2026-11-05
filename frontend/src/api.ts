// Websocket/HTTP access and the shared client-side state.
export type Hass = any;

export class Api {
  constructor(public hass: Hass) {}
  ws<T = any>(type: string, data: Record<string, any> = {}): Promise<T> {
    return this.hass.connection.sendMessagePromise({ type: `llmitmir/${type}`, ...data });
  }
  subscribe(cb: (e: any) => void): Promise<() => Promise<void>> {
    return this.hass.connection.subscribeMessage(cb, { type: "llmitmir/subscribe" });
  }
  async upload(scope: string, owner: string, files: File[] | FileList): Promise<any> {
    const fd = new FormData();
    fd.append("scope", scope);
    fd.append("owner", owner);
    for (const f of Array.from(files)) fd.append("file", f, f.name);
    const r = await this.hass.fetchWithAuth("/api/llmitmir/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
    return j;
  }
  async fileUrl(scope: string, owner: string, name: string): Promise<string> {
    const r = await this.hass.fetchWithAuth(`/api/llmitmir/file/${scope}/${owner}/${name.split("/").map(encodeURIComponent).join("/")}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return URL.createObjectURL(await r.blob());
  }
  async transcribe(wav: Blob): Promise<string> {
    const r = await this.hass.fetchWithAuth("/api/llmitmir/transcribe", { method: "POST", body: wav, headers: { "Content-Type": "audio/wav" } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
    return j.text || "";
  }
}

export interface RunState { run_id: string; status: string; detail: any; started: number; }

/** Global reactive store; components re-render on "change". */
export class Store extends EventTarget {
  api!: Api;
  data: any = null;
  chats = new Map<string, any>();      // full chat objects (loaded on demand)
  chatFiles = new Map<string, any[]>();
  runs: Record<string, RunState> = {};
  permissions: any[] = [];
  error = "";
  toast = "";
  private _t: any;
  changed() { this.dispatchEvent(new Event("change")); }
  notify(msg: string) {
    this.toast = msg; this.changed();
    clearTimeout(this._t); this._t = setTimeout(() => { this.toast = ""; this.changed(); }, 4500);
  }
  async load() {
    this.data = await this.api.ws("bootstrap");
    this.runs = this.data.runs || {};
    this.permissions = this.data.permissions || [];
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
        if (full) Object.assign(full, { title: e.chat.title, status: e.chat.status, model: e.chat.model, pinned: e.chat.pinned, project_id: e.chat.project_id });
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
          if (e.message.role === "tool" && e.message.status !== "running") {
            c.messages = c.messages.filter((m: any) => !(m.status === "running" && m.tool_call_id === e.message.tool_call_id && m.id !== e.message.id));
          }
        }
        break;
      }
      case "delta": {
        const c = this.chats.get(e.chat_id);
        const m = c?.messages.find((x: any) => x.id === e.message_id);
        if (m) { m.content = (m.content || "") + (e.content || ""); m.reasoning = (m.reasoning || "") + (e.reasoning || ""); }
        break;
      }
      case "run":
        if (["done", "error", "stopped"].includes(e.status)) {
          delete this.runs[e.chat_id];
          const c = this.chats.get(e.chat_id);
          if (c) c.messages = c.messages.filter((m: any) => !(m.streaming && !m.content));
        } else this.runs[e.chat_id] = { run_id: e.run_id, status: e.status, detail: e.detail, started: e.started };
        break;
      case "permission": this.permissions = [...this.permissions.filter(p => p.id !== e.permission.id), e.permission]; break;
      case "permission_done": this.permissions = this.permissions.filter(p => p.id !== e.id); break;
      case "progress": { const c = this.chats.get(e.chat_id); if (c) c.progress = e.items; break; }
      case "files": this.chatFiles.set(e.chat_id, e.files); break;
      case "usage":
        d.usage = e.usage;
        if (e.chat_id && e.chat_usage) { const c = this.chats.get(e.chat_id); if (c) c.usage = e.chat_usage; }
        break;
      case "tasks_queue": d.queue = e.queue; break;
      case "meta": this.load(); return;
      case "import_done": this.notify("Import abgeschlossen"); break;
    }
    this.changed();
  }
}

export const store = new Store();

export function navigate(path: string, replace = false) {
  const url = `/llmitmir${path.startsWith("/") ? path : "/" + path}`;
  if (replace) history.replaceState(null, "", url); else history.pushState(null, "", url);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
}
