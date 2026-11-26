// 3D tile: basic shapes (box, sphere, cylinder, torus) with plain WebGL – no library, no model files.
// Renders only while visible, pauses in a hidden tab and shows a still image with prefers-reduced-motion.
import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeElement } from "../ui";
import { t } from "../i18n";

type M4 = Float32Array;
const ident = (): M4 => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function persp(fovy: number, aspect: number, n: number, f: number): M4 {
  const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / aspect; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
  return m;
}
const trans = (x: number, y: number, z: number) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
const scal = (x: number, y: number, z: number) => { const m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; };
const rotY = (a: number) => { const m = ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
const rotX = (a: number) => { const m = ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; };
/** Inverse transpose of the upper 3×3 – keeps normals right under non-uniform scaling. */
function normal3(m: M4): Float32Array {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return new Float32Array([A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det,
    (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det]);
}

interface Mesh { buf: WebGLBuffer; nbuf: WebGLBuffer; ibuf: WebGLBuffer; count: number; }

function geometry(shape: string): { p: number[]; n: number[]; idx: number[] } {
  const p: number[] = [], n: number[] = [], idx: number[] = [];
  if (shape === "box") {
    const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [x, y, z] of faces) {
      const u = y ? [1, 0, 0] : [0, 1, 0];
      const v = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]];
      const base = p.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        p.push((x + a * u[0] + b * v[0]) / 2, (y + a * u[1] + b * v[1]) / 2, (z + a * u[2] + b * v[2]) / 2);
        n.push(x, y, z);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { p, n, idx };
  }
  const grid = (cols: number, rows: number, f: (u: number, v: number) => [number[], number[]]) => {
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const [pos, nor] = f(c / cols, r / rows); p.push(...pos); n.push(...nor);
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  };
  if (shape === "sphere") {
    grid(32, 16, (u, v) => {
      const th = u * Math.PI * 2, ph = v * Math.PI;
      const q = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      return [q.map(x => x / 2), q];
    });
  } else if (shape === "torus") {
    const R = 0.36, rr = 0.14;
    grid(40, 16, (u, v) => {
      const th = u * Math.PI * 2, ph = v * Math.PI * 2;
      const q = [Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th)];
      return [[(R + rr * Math.cos(ph)) * Math.cos(th), rr * Math.sin(ph), (R + rr * Math.cos(ph)) * Math.sin(th)], q];
    });
  } else {
    // cylinder: side plus two caps
    grid(32, 1, (u, v) => { const th = u * Math.PI * 2; const q = [Math.cos(th), 0, Math.sin(th)]; return [[q[0] / 2, v - 0.5, q[2] / 2], q]; });
    for (const y of [0.5, -0.5]) {
      const c = p.length / 3; p.push(0, y, 0); n.push(0, Math.sign(y), 0);
      for (let i = 0; i <= 32; i++) { const th = (i / 32) * Math.PI * 2; p.push(Math.cos(th) / 2, y, Math.sin(th) / 2); n.push(0, Math.sign(y), 0); }
      for (let i = 0; i < 32; i++) idx.push(c, c + 1 + i, c + 2 + i);
    }
  }
  return { p, n, idx };
}

const hex = (h: string): [number, number, number] => {
  let s = (h || "#4f9cf9").replace("#", "");
  if (s.length <= 4) s = s.split("").map(c => c + c).join("");
  const v = parseInt(s.slice(0, 6), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

const VS = `attribute vec3 p; attribute vec3 n; uniform mat4 mvp; uniform mat4 model; uniform mat3 nm;
varying vec3 vn; varying vec3 vw;
void main() { vn = normalize(nm * n); vw = (model * vec4(p, 1.0)).xyz; gl_Position = mvp * vec4(p, 1.0); }`;
const FS = `precision mediump float; varying vec3 vn; varying vec3 vw; uniform vec3 col; uniform vec3 eye; uniform float amb;
void main() {
  vec3 L = normalize(vec3(0.5, 0.9, 0.6)); vec3 N = normalize(vn); vec3 V = normalize(eye - vw);
  float d = max(dot(N, L), 0.0); float s = pow(max(dot(N, normalize(L + V)), 0.0), 40.0);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.25;
  gl_FragColor = vec4(col * (amb + 0.75 * d) + vec3(0.35 * s + rim), 1.0);
}`;

@safeElement("lm-scene")
export class SceneEl extends LitElement {
  @property({ attribute: false }) data: any = null;
  @property({ type: Boolean }) dark = false;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private meshes: Record<string, Mesh> = {};
  private raf = 0;
  private visible = false;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private t0 = performance.now();
  private failed = false;
  private onVis = () => this.loop();
  static styles = css`:host { display: block; width: 100%; height: 100%; position: relative; }
    canvas { width: 100%; height: 100%; display: block; }
    .lab { position: absolute; left: 0; bottom: 0; display: flex; flex-wrap: wrap; gap: 4px; font-size: 11px; color: var(--lm-muted); }
    .lab span { background: var(--lm-panel); border-radius: 999px; padding: 1px 7px; opacity: .9; }
    .lab i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .no { height: 100%; display: grid; place-items: center; color: var(--lm-faint); font-size: 12.5px; }`;

  /** Program and state – again after the browser took the context away and gave it back. */
  private setup(gl: WebGLRenderingContext) {
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    this.prog = pr;
    this.meshes = {};
    gl.enable(gl.DEPTH_TEST);  // no face culling: the generated grids do not share one winding order
  }

  firstUpdated() {
    const cv = this.renderRoot.querySelector("canvas") as HTMLCanvasElement | null;
    if (!cv) return;
    const gl = cv.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true }) as WebGLRenderingContext | null;
    if (!gl) { this.failed = true; this.requestUpdate(); return; }
    this.gl = gl;
    this.setup(gl);
    // browsers take contexts away when too many are open or the GPU resets – wait for it to come back
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(this.raf); this.raf = 0; this.prog = null; });
    cv.addEventListener("webglcontextrestored", () => { if (this.gl) { this.setup(this.gl); this.loop(); } });
    this.io = new IntersectionObserver(es => { this.visible = es.some(e => e.isIntersecting); this.loop(); });
    this.io.observe(this);
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this);
    document.addEventListener("visibilitychange", this.onVis);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.io?.disconnect(); this.ro?.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    // give the context back right away – browsers only allow a few at a time
    (this.gl?.getExtension("WEBGL_lose_context") as any)?.loseContext?.();
    this.gl = null;
  }

  updated() { this.draw(); }

  private mesh(shape: string): Mesh {
    if (this.meshes[shape]) return this.meshes[shape];
    const gl = this.gl!, g = geometry(shape);
    const buf = gl.createBuffer()!, nbuf = gl.createBuffer()!, ibuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.p), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, nbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g.n), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(g.idx), gl.STATIC_DRAW);
    return (this.meshes[shape] = { buf, nbuf, ibuf, count: g.idx.length });
  }

  private loop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.visible || document.hidden || still) { this.draw(); return; }
    const step = () => { this.draw(); this.raf = requestAnimationFrame(step); };
    this.raf = requestAnimationFrame(step);
  }

  private draw() {
    const gl = this.gl, pr = this.prog;
    if (!gl || !pr || gl.isContextLost()) return;
    const cv = gl.canvas as HTMLCanvasElement;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const d = this.data || {}, cam = d.camera || {};
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = still ? 0 : (performance.now() - this.t0) / 1000;
    const yaw = (cam.yaw ?? 0.6) + t * 0.08, pitch = cam.pitch ?? 0.3, dist = cam.dist ?? 6;
    const eye = [dist * Math.cos(pitch) * Math.sin(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.cos(yaw)];
    const view = mul(mul(trans(0, 0, -dist), rotX(pitch)), rotY(-yaw));
    const proj = persp(0.75, W / H, 0.1, 200);
    gl.useProgram(pr);
    const loc = (n: string) => gl.getUniformLocation(pr, n);
    gl.uniform3fv(loc("eye"), eye);
    gl.uniform1f(loc("amb"), this.dark ? 0.32 : 0.42);
    const ap = gl.getAttribLocation(pr, "p"), an = gl.getAttribLocation(pr, "n");
    for (const o of (d.objects || []).slice(0, 60)) {
      const m = this.mesh(o.shape);
      const [x, y, z] = o.pos || [0, 0, 0], [sx, sy, sz] = o.size || [1, 1, 1];
      const model = mul(mul(trans(x, y, z), rotY(t * (o.spin || 0))), scal(sx, sy, sz));
      gl.uniformMatrix4fv(loc("model"), false, model);
      gl.uniformMatrix4fv(loc("mvp"), false, mul(proj, mul(view, model)));
      gl.uniformMatrix3fv(loc("nm"), false, normal3(model));
      gl.uniform3fv(loc("col"), hex(o.color));
      gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.nbuf); gl.enableVertexAttribArray(an); gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibuf);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  render() {
    if (this.failed) return html`<div class="no">${t("3D wird hier nicht unterstützt")}</div>`;
    const labels = (this.data?.objects || []).filter((o: any) => o.label).slice(0, 8);
    return html`<canvas role="img" aria-label="3D-Szene"></canvas>
      ${labels.length ? html`<div class="lab">${labels.map((o: any) => html`<span><i style="background:${o.color}"></i>${o.label}</span>`)}</div>` : nothing}`;
  }
}
