// Der Roboter aus dem LLMitMir-Icon in 3D – für das Sprachgespräch (voice.ts).
//
// Bewusst ohne 3D-Bibliothek: ein paar Hundert Zeilen WebGL reichen für eine Figur aus runden Grundkörpern
// und halten das Bundle klein. Die Figur besteht aus „aufgeblasenen“ Kugeln (Kugel, Kapsel, abgerundeter
// Quader – alles derselbe Erzeuger), ein Skelett aus wenigen Gelenken bewegt sie. Jeder Zustand
// (Zuhören, Warten, Nachdenken, Recherchieren, Antworten …) ist eine Zielhaltung, die pro Bild neu
// berechnet und weich angefahren wird – so ist der Roboter durchgehend in Bewegung und wechselt ohne Sprung.
//
// Aussehen wie im Icon: weiße Schale, grüne Gesichtsscheibe mit zwei runden, leuchtenden Augen, Antenne mit
// Kugel, Ohrblöcke. Dazu ein Mund aus fünf Leuchtsegmenten (bewegt sich mit der Lautstärke der Stimme),
// Rumpf und Arme – menschenähnlich in der Haltung, in der Oberfläche klar eine Maschine.

export type RobotState = "hello" | "idle" | "listening" | "attentive" | "thinking" | "researching" | "speaking" | "asking" | "error";

/** So lange nach einem Zustandswechsel mischt der Roboter die alte in die neue Haltung –
 *  dadurch gehen Nachdenken und Recherchieren weich ineinander ueber statt abrupt zu wechseln. */
const TRANSITION_S = 0.7;
const INTRO_S = 1.7;        // Dauer des Auftritts

type M4 = Float32Array;
type V3 = [number, number, number];

// ------------------------------------------------------------------ Matrizen (spaltenweise, wie WebGL)
const ident = (): M4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const trans = (m: M4, x: number, y: number, z: number) => { const t = ident(); t[12] = x; t[13] = y; t[14] = z; return mul(m, t); };
const scale = (m: M4, x: number, y: number, z: number) => { const t = ident(); t[0] = x; t[5] = y; t[10] = z; return mul(m, t); };
function rotX(m: M4, a: number) { const c = Math.cos(a), s = Math.sin(a), t = ident(); t[5] = c; t[6] = s; t[9] = -s; t[10] = c; return mul(m, t); }
function rotY(m: M4, a: number) { const c = Math.cos(a), s = Math.sin(a), t = ident(); t[0] = c; t[2] = -s; t[8] = s; t[10] = c; return mul(m, t); }
function rotZ(m: M4, a: number) { const c = Math.cos(a), s = Math.sin(a), t = ident(); t[0] = c; t[1] = s; t[4] = -s; t[5] = c; return mul(m, t); }
function persp(fovy: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far);
  return o;
}
const point = (m: M4, x = 0, y = 0, z = 0): V3 => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
/** Normalenmatrix (inverse Transponierte des 3×3-Teils) – nötig, weil Teile ungleichmäßig skaliert werden. */
function normalMat(m: M4): Float32Array {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return new Float32Array([A / det, B / det, C / det, (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det]);
}

// ------------------------------------------------------------------ Körper
interface Mesh { vbo: WebGLBuffer; ibo: WebGLBuffer; count: number; }

/** Kugel mit Radius r, deren Achtel um (ex, ey, ez) auseinandergeschoben sind: ergibt Kugel (0,0,0), Kapsel
 *  (nur ey) oder abgerundeten Quader. `shape` darf die Punkte danach verformen; Normalen werden neu berechnet. */
function blobData(r: number, ex = 0, ey = 0, ez = 0, shape?: (p: V3) => void, cols = 40, rows = 20) {
  const pos: number[] = [], idx: number[] = [];
  // weich statt hart umschalten: so liegen auch auf den Flächen Punkte und Verformungen bleiben glatt
  const sg = (v: number) => Math.tanh(v * 5);
  for (let i = 0; i <= rows; i++) {
    const th = Math.PI * i / rows;
    for (let j = 0; j <= cols; j++) {
      const ph = 2 * Math.PI * j / cols - Math.PI / 2;   // Naht hinten
      const n: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const p: V3 = [n[0] * r + sg(n[0]) * ex, n[1] * r + sg(n[1]) * ey, n[2] * r + sg(n[2]) * ez];
      shape?.(p);
      pos.push(p[0], p[1], p[2]);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // Normalen aus den Flächen, über zusammenfallende Punkte (Naht, Pole) gemittelt
  const acc = new Map<string, V3>();
  const key = (k: number) => `${Math.round(pos[k * 3] * 2000)},${Math.round(pos[k * 3 + 1] * 2000)},${Math.round(pos[k * 3 + 2] * 2000)}`;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const n: V3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const k of [a, b, c]) { const e = acc.get(key(k)); if (e) { e[0] += n[0]; e[1] += n[1]; e[2] += n[2]; } else acc.set(key(k), [...n] as V3); }
  }
  // Die Körper sind um ihren Mittelpunkt gewölbt: zeigt die Summe der Normalen nach innen, alle umdrehen
  let out = 0;
  for (let k = 0; k < pos.length / 3; k++) { const n = acc.get(key(k))!; out += n[0] * pos[k * 3] + n[1] * pos[k * 3 + 1] + n[2] * pos[k * 3 + 2]; }
  const flip = out < 0 ? -1 : 1;
  const data = new Float32Array(pos.length * 2);
  for (let k = 0; k < pos.length / 3; k++) {
    const n = acc.get(key(k))!; const l = flip * (Math.hypot(n[0], n[1], n[2]) || 1);
    data.set([pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], n[0] / l, n[1] / l, n[2] / l], k * 6);
  }
  return { data, idx: new Uint16Array(idx) };
}

/** sRGB-Hex nach linear. */
function lin(hex: string): V3 {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.pow(v / 255, 2.2)) as V3;
}
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Mat { color: V3; spec: number; shine: number; gloss: number; emit?: V3; }

// ------------------------------------------------------------------ Shader
const VS = `attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uVP, uM; uniform mat3 uN;
varying vec3 vN, vP;
void main() { vec4 w = uM * vec4(aPos, 1.0); vP = w.xyz; vN = uN * aNor; gl_Position = uVP * w; }`;

// Halb gerichtetes Licht von links oben vorn, Himmel/Boden-Licht, Glanzpunkt und ein Schimmer an den Rändern
// (Fresnel), der die Schale wie lackierten Kunststoff wirken lässt.
const FS = `precision mediump float;
varying vec3 vN, vP;
uniform vec3 uCam, uColor, uEmit, uSky, uGround, uRim;
uniform float uSpec, uShine, uGloss;
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vP);
  vec3 L = normalize(vec3(-0.45, 0.8, 0.62));
  float wrap = clamp((dot(N, L) + 0.3) / 1.3, 0.0, 1.0);
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), uShine) * uSpec;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 R = reflect(-V, N);
  vec3 env = mix(uGround, uSky, smoothstep(-0.3, 0.7, R.y));
  vec3 c = uColor * (hemi * 0.62 + wrap * wrap * 0.78) + vec3(sp) + fr * (env * uGloss + uRim * 0.35) + uEmit;
  c = c / (1.0 + c * 0.18);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

// Leuchtpunkte (Schein um Augen, Antenne …) und die schwebende Tafel beim Recherchieren
const VS2 = `attribute vec2 aC; uniform mat4 uVP; uniform vec3 uCenter, uRight, uUp; varying vec2 vC;
void main() { vC = aC; gl_Position = uVP * vec4(uCenter + uRight * aC.x + uUp * aC.y, 1.0); }`;
const FS2 = `precision mediump float;
varying vec2 vC; uniform vec3 uColor; uniform float uAlpha, uMode, uTime;
void main() {
  if (uMode < 0.5) {
    float d = dot(vC, vC);
    float a = exp(-d * 4.5) * uAlpha * (1.0 - smoothstep(0.7, 1.0, d));
    gl_FragColor = vec4(uColor * a, a * 0.6);
  } else {
    // Tafel: Zeilen aus „Text“, die nach oben laufen, eine wandernde Lesezeile, heller Rand
    vec2 p = vC * 0.5 + 0.5;
    float row = fract(p.y * 7.0 + uTime * 0.6);
    float id = floor(p.y * 7.0 + uTime * 0.6);
    float len = 0.35 + 0.6 * fract(sin(id * 12.9898) * 43758.5453);
    float txt = step(0.3, row) * step(row, 0.62) * step(0.08, p.x) * step(p.x, len);
    float scan = exp(-pow((p.y - fract(uTime * 0.45)) * 9.0, 2.0));
    float edge = smoothstep(0.86, 1.0, max(abs(vC.x), abs(vC.y)));
    float fade = smoothstep(0.0, 0.12, p.y) * smoothstep(1.0, 0.85, p.y);
    float a = (0.10 + txt * 0.55 + scan * 0.35 + edge * 0.5) * uAlpha * fade;
    gl_FragColor = vec4(uColor * a, a * 0.5);
  }
}`;

// ------------------------------------------------------------------ Haltung
interface Pose {
  bodyY: number; bodyRx: number; bodyRy: number; bodyRz: number;
  headRx: number; headRy: number; headRz: number;
  eyeX: number; eyeY: number; eyeOpen: number;
  // Arme: a = links im Bild, b = rechts im Bild. p = nach vorn heben, r = seitlich abspreizen, t = eindrehen, e = Ellbogen
  ap: number; ar: number; at: number; ae: number;
  bp: number; br: number; bt: number; be: number;
  lamp: number; ear: number; core: number; holo: number;
}
const REST: Pose = { bodyY: 0, bodyRx: 0, bodyRy: 0, bodyRz: 0, headRx: 0, headRy: 0, headRz: 0, eyeX: 0, eyeY: 0, eyeOpen: 1,
  ap: 0.05, ar: 0.13, at: 0, ae: 0.25, bp: 0.05, br: 0.13, bt: 0, be: 0.25, lamp: 0.5, ear: 0.1, core: 0.5, holo: 0 };

export interface RobotColors { shell: string; joint: string; face: string; glow: string; accent: string; sky: string; ground: string; }
/** Farben aus dem Erscheinungsbild von LLMitMir (hell: #2d6a4f, dunkel: #5fae86). */
export const robotColors = (dark: boolean): RobotColors => dark
  ? { shell: "#e9ede9", joint: "#3b8262", face: "#1f4a37", glow: "#eafff3", accent: "#78c29c", sky: "#dfeee6", ground: "#2a3b33" }
  : { shell: "#fbfcfb", joint: "#1f4d39", face: "#24573f", glow: "#ffffff", accent: "#8fe0b6", sky: "#ffffff", ground: "#7fae97" };

export class Robot3D {
  state: RobotState = "idle";
  /** Lautstärke des Mikrofons (0..1) – die Ohren leuchten mit, der Kopf nickt. */
  micLevel = 0;
  /** Lautstärke der eigenen Stimme (0..1) – bewegt den Mund. */
  voiceLevel = 0;
  /** Denkt nebenher (beim Zuhören schon mit, beim Sprechen noch weiter): die Antenne pulsiert dazu. */
  working = false;
  /** Vor jedem Bild: Gelegenheit, die Pegel zu aktualisieren. */
  onFrame?: (now: number) => void;
  private gl: WebGLRenderingContext;
  private prog!: WebGLProgram; private prog2!: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private u2: Record<string, WebGLUniformLocation | null> = {};
  private meshes: Record<string, Mesh> = {};
  private quad!: WebGLBuffer;
  private col!: Record<keyof RobotColors, V3>;
  private pose: Pose = { ...REST };
  private prevPose: Pose = { ...REST };   // Pose beim letzten Zustandswechsel, fuer den weichen Uebergang
  private raf = 0; private last = 0; private t = 0; private since = 0; private prevState: RobotState = "idle";
  private blinkAt = 2; private blink = 0;
  private gaze: [number, number] = [0, 0]; private gazeAt = 0;
  private ant = 0; private antV = 0; private prevHeadRz = 0; private prevHeadRx = 0; private antX = 0; private antXV = 0;
  private mouth = 0; private mic = 0;
  private glows: { p: V3; size: number; color: V3; a: number }[] = [];
  private w = 0; private h = 0;

  static supported(): boolean {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch { return false; }
  }

  constructor(private canvas: HTMLCanvasElement, dark: boolean) {
    const gl = (canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true })
      || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL nicht verfügbar");
    this.gl = gl;
    this.setDark(dark);
    this.build();
    // Handys nehmen einer Seite im Hintergrund den Grafikspeicher weg: danach alles neu anlegen
    canvas.addEventListener("webglcontextlost", e => e.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => { this.meshes = {}; this.w = this.h = 0; this.build(); });
  }

  setDark(dark: boolean) {
    const c = robotColors(dark);
    this.col = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, lin(v)])) as any;
  }

  // ---------------------------------------------------------------- Aufbau
  private compile(vs: string, fs: string): WebGLProgram {
    const gl = this.gl, p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as [number, string][]) {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "Shader");
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, vs === VS ? "aPos" : "aC");
    if (vs === VS) gl.bindAttribLocation(p, 1, "aNor");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "Programm");
    return p;
  }

  private mesh(name: string, r: number, ex = 0, ey = 0, ez = 0, shape?: (p: V3) => void, cols = 40, rows = 20) {
    const gl = this.gl, d = blobData(r, ex, ey, ez, shape, cols, rows);
    const vbo = gl.createBuffer()!, ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, d.data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, gl.STATIC_DRAW);
    this.meshes[name] = { vbo, ibo, count: d.idx.length };
  }

  private build() {
    const gl = this.gl;
    this.prog = this.compile(VS, FS); this.prog2 = this.compile(VS2, FS2);
    for (const n of ["uVP", "uM", "uN", "uCam", "uColor", "uEmit", "uSky", "uGround", "uRim", "uSpec", "uShine", "uGloss"]) this.u[n] = gl.getUniformLocation(this.prog, n);
    for (const n of ["uVP", "uCenter", "uRight", "uUp", "uColor", "uAlpha", "uMode", "uTime"]) this.u2[n] = gl.getUniformLocation(this.prog2, n);
    this.mesh("sphere", 1, 0, 0, 0, undefined, 32, 16);
    // Kopf wie im Icon: oben gewölbt, unten flacher, hinten etwas schmaler
    this.mesh("head", 0.46, 0.39, 0.18, 0.2, p => {
      const k = p[1] / 0.64;
      if (k > 0) { const f = 1 - 0.13 * k * k; p[0] *= f; p[2] *= f; } else p[0] *= 1 - 0.05 * k * k;
    }, 56, 28);
    this.mesh("face", 0.13, 0.52, 0.26, 0.03, p => { p[2] -= 0.05 * (p[0] * p[0]) + 0.03 * (p[1] * p[1]); }, 48, 20);
    this.mesh("ear", 0.07, 0.03, 0.15, 0.15);
    this.mesh("torso", 0.34, 0.41, 0.31, 0.11, p => {
      const k = Math.min(1, Math.max(0, (0.2 - p[1]) / 0.85));
      p[0] *= 1 - 0.2 * k; p[2] *= 1 - 0.1 * k;
    }, 56, 28);
    this.mesh("pelvis", 0.2, 0.3, 0.06, 0.14);
    this.mesh("upper", 0.13, 0, 0.2, 0, undefined, 28, 16);
    this.mesh("fore", 0.115, 0, 0.19, 0, p => { if (p[1] < 0) { const f = 1 + 0.1 * (-p[1] / 0.3); p[0] *= f; p[2] *= f; } }, 28, 16);
    this.mesh("hand", 0.085, 0.07, 0.085, 0.02, undefined, 28, 16);
    this.mesh("thumb", 0.045, 0, 0.055, 0, undefined, 16, 10);
    this.mesh("stick", 0.035, 0, 0.14, 0, undefined, 16, 10);
    this.mesh("neck", 0.2, 0, 0.1, 0, undefined, 28, 12);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  // ---------------------------------------------------------------- Laufzeit
  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.onFrame?.(now);
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  dispose() {
    this.stop();
    try { this.gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* schon weg */ }
  }

  /** Ein einzelnes Bild zu einem festen Zeitpunkt (Tests, Standbild bei „Bewegung reduzieren“). */
  renderAt(seconds: number, settle = true, intro = INTRO_S) {
    this.t = seconds; this.since = seconds; this.intro = intro;
    if (settle) { this.pose = this.target(); this.mouth = this.voiceLevel; this.mic = this.micLevel; }
    this.draw();
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (w !== this.w || h !== this.h) { this.canvas.width = this.w = w; this.canvas.height = this.h = h; }
  }

  // ---------------------------------------------------------------- Auftritt
  // Der Roboter kommt ins Bild, statt mitten in einer Bewegung zu erscheinen: Er steigt in gut einer halben
  // Sekunde von unten auf und begrüßt mit einer kleinen Geste – jedes Mal eine andere (nicken, den Kopf neigen,
  // kurz winken). Die Geste liegt über der Haltung des jeweiligen Zustands, deshalb bleibt sie ruhig, auch wenn
  // das Gespräch in dieser Zeit schon beginnt.
  private intro = 0;                       // Sekunden seit dem Auftritt (ab INTRO_S ist er vorbei)
  private introKind = 0;                   // 0 nicken, 1 Kopf neigen, 2 winken

  /** Auftritt neu spielen (beim Öffnen der Ansicht). `kind` nur für Tests, sonst zufällig. */
  enter(kind?: number) {
    this.intro = 0; this.introKind = kind ?? Math.floor(Math.random() * 3);
    this.pose = this.target();             // gleich in der Haltung des Zustands, nichts „fährt“ erst dorthin
    this.prevPose = { ...this.pose }; this.since = TRANSITION_S;
    this.ant = this.antV = this.antX = this.antXV = 0; this.prevHeadRz = this.pose.headRz; this.prevHeadRx = this.pose.headRx;
    this.blink = 0; this.blinkAt = 1.1;
  }

  /** Die Haltung, wie sie gezeichnet wird: während des Auftritts mit Aufsteigen und Begrüßungsgeste. */
  private shown(): Pose {
    const x = this.intro;
    if (x >= INTRO_S) return this.pose;
    const p = { ...this.pose };
    const ease = (v: number) => { const c = Math.min(1, Math.max(0, v)); return 1 - Math.pow(1 - c, 3); };
    const bump = (from: number, to: number) => { const c = (x - from) / (to - from); return c <= 0 || c >= 1 ? 0 : Math.sin(Math.PI * c) ** 2; };
    p.bodyY += -1.15 * (1 - ease(x / 0.65));                    // von unten ins Bild
    p.bodyRx += 0.07 * (1 - ease(x / 0.8));                      // richtet sich dabei auf
    if (this.introKind === 0) { p.headRx += 0.2 * bump(0.45, 1.25); p.eyeOpen += 0.1 * bump(0.45, 1.25); }
    else if (this.introKind === 1) { p.headRz += 0.17 * bump(0.4, 1.4); p.headRy -= 0.08 * bump(0.4, 1.4); }
    else {
      const up = bump(0.3, INTRO_S);                              // Arm hebt und senkt sich weich, dazwischen zwei ruhige Schwünge
      p.bp += (1.5 - p.bp) * up; p.be += (1.6 - p.be) * up; p.bt += (-0.4 - p.bt) * up;
      p.br += (0.32 + 0.2 * Math.sin((x - 0.3) * 2 * Math.PI * 1.5) - p.br) * up;
      p.headRz += 0.08 * up;
    }
    return p;
  }

  private frame(dt: number) {
    this.t += dt; this.intro += dt;
    if (this.state !== this.prevState) { this.prevState = this.state; this.since = 0; this.prevPose = { ...this.pose }; }
    this.since += dt;
    // Blinzeln in unregelmäßigen Abständen
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) { this.blink = 0.16; this.blinkAt = 2.2 + Math.random() * 4; if (Math.random() < 0.2) this.blinkAt = 0.35; }
    this.blink = Math.max(0, this.blink - dt);
    // Blick wandert im Leerlauf
    this.gazeAt -= dt;
    if (this.gazeAt <= 0) {
      this.gazeAt = 1.4 + Math.random() * 3;
      this.gaze = Math.random() < 0.45 ? [0, 0] : [(Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 0.7];
    }
    const k = (rate: number) => 1 - Math.exp(-rate * dt);
    this.mouth += (this.voiceLevel - this.mouth) * k(this.voiceLevel > this.mouth ? 30 : 14);
    this.mic += (this.micLevel - this.mic) * k(this.micLevel > this.mic ? 25 : 6);
    const tg = this.target();
    // direkt nach einem Zustandswechsel die alte Pose anteilig mit einbeziehen (weicher Uebergang)
    let g: any = tg;
    if (this.since < TRANSITION_S) {
      const w = this.since / TRANSITION_S, e = w * w * (3 - 2 * w), pp = this.prevPose as any;
      g = {};
      for (const key in tg) g[key] = pp[key] + (tg[key] - pp[key]) * e;
    }
    const p = this.pose as any;
    for (const key in g) {
      const rate = key.startsWith("eye") ? 16 : key === "lamp" || key === "ear" || key === "core" ? 10 : key === "holo" ? 4.5 : 5.5;
      p[key] += (g[key] - p[key]) * k(rate);
    }
    // Antenne federt der Kopfbewegung nach
    const spring = (x: number, v: number, push: number): [number, number] => {
      v += (-90 * x - 9 * v) * dt + push; x += v * dt; return [x, v];
    };
    [this.ant, this.antV] = spring(this.ant, this.antV, (this.prevHeadRz - p.headRz) * 9);
    [this.antX, this.antXV] = spring(this.antX, this.antXV, (this.prevHeadRx - p.headRx) * 9);
    this.prevHeadRz = p.headRz; this.prevHeadRx = p.headRx;
    this.draw();
  }

  /** Zielhaltung für den aktuellen Zustand – enthält die laufende Bewegung (Atmen, Gesten, Nicken). */
  private target(): Pose {
    const t = this.t, s = this.since, mic = this.mic, v = this.mouth;
    const sin = Math.sin;
    const o: Pose = { ...REST };
    // immer: atmen und ganz leicht schwanken
    o.bodyY = 0.014 * sin(t * 1.7);
    o.bodyRz = 0.012 * sin(t * 0.63);
    o.core = 0.5 + 0.2 * sin(t * 1.7);
    o.ae += 0.03 * sin(t * 1.7 + 1); o.be += 0.03 * sin(t * 1.7 + 2);
    switch (this.state) {
      case "hello":     // wartet freundlich auf den Beginn: Kopf leicht schräg, Blick zur Person, ruhiges Wiegen
        o.headRz = 0.09 + 0.03 * sin(t * 0.9); o.headRy = 0.05 * sin(t * 0.55); o.headRx = 0.02 * sin(t * 1.3);
        o.eyeOpen = 1.1; o.eyeY = 0.05;
        o.ap = 0.2; o.ae = 0.6; o.at = 0.25; o.bp = 0.2; o.be = 0.6; o.bt = 0.25;
        o.lamp = 0.7 + 0.25 * sin(t * 2.2); o.bodyRy = 0.05 * sin(t * 0.5);
        break;
      case "idle":      // wartet: schaut sich um, wiegt sich leicht
        o.bodyRy = 0.07 * sin(t * 0.37); o.headRy = this.gaze[0] * 0.22 + 0.04 * sin(t * 0.5);
        o.headRx = -this.gaze[1] * 0.12; o.headRz = 0.05 * sin(t * 0.23);
        o.eyeX = this.gaze[0]; o.eyeY = this.gaze[1];
        o.lamp = 0.35 + 0.18 * sin(t * 1.3);
        o.ar += 0.02 * sin(t * 0.8); o.br += 0.02 * sin(t * 0.8 + 2);
        break;
      case "listening": // beugt sich vor, legt den Kopf schräg, Ohren leuchten mit der Stimme
        o.bodyRx = 0.09; o.headRz = -0.13 + 0.02 * sin(t * 0.9); o.headRy = 0.1; o.headRx = 0.03 + 0.07 * mic * sin(t * 5);
        o.eyeOpen = 1.18; o.eyeY = 0.05;
        o.ear = 0.45 + 0.2 * sin(t * 3.2) + mic * 1.2; o.lamp = 0.75 + mic * 0.6;
        o.ap = 0.3; o.ae = 0.75; o.at = 0.25;
        o.bp = 2.05; o.br = -0.2; o.bt = -0.1; o.be = 1.5 + 0.03 * sin(t * 1.3);   // Hand hinters Ohr
        break;
      case "attentive": { // ist dran, überlegt kurz: Blickkontakt, nickt langsam, Hände locker vor dem Körper
        const nod = Math.max(0, sin(t * 2.1)) * Math.max(0, sin(t * 0.7));
        o.bodyRx = 0.04; o.headRz = 0.06 * sin(t * 0.45); o.headRy = 0.05 * sin(t * 0.6); o.headRx = 0.02 + 0.07 * nod;
        o.eyeOpen = 1.08; o.eyeX = 0.12 * sin(t * 0.8); o.eyeY = 0.06 + 0.1 * Math.max(0, sin(t * 0.33));
        o.ap = 0.34 + 0.03 * sin(t * 0.9); o.at = 0.42; o.ar = 0.04; o.ae = 0.95 + 0.04 * sin(t * 1.1);
        o.bp = 0.34 + 0.03 * sin(t * 0.9 + 1); o.bt = 0.42; o.br = 0.04; o.be = 0.95 + 0.04 * sin(t * 1.1 + 2);
        o.lamp = 0.7 + 0.3 * sin(t * 3.4); o.ear = 0.25;
        break;
      }
      case "thinking": { // Hand ans Kinn, Blick nach oben, Antenne pulsiert
        const side = Math.max(-1, Math.min(1, sin(t * 0.55) * 1.4));   // weich von einer Seite zur anderen
        o.headRz = 0.16; o.headRy = -0.2 * side; o.headRx = -0.13 + 0.02 * sin(t * 1.3);
        o.eyeX = -0.65 * side; o.eyeY = 0.75; o.eyeOpen = 0.82;
        o.ap = 1.35; o.ar = -0.3; o.at = 1.2; o.ae = 1.75 + 0.04 * sin(t * 2.1);
        o.bp = 0.25; o.br = 0.02; o.bt = 0.9; o.be = 1.25;
        o.lamp = 0.75 + 0.55 * sin(t * 6); o.bodyRy = 0.06 * sin(t * 0.5); o.bodyRx = -0.02;
        break;
      }
      case "researching": // tippt auf einer schwebenden Tafel, Augen lesen Zeile für Zeile
        o.headRx = 0.27 + 0.02 * sin(t * 1.9); o.headRy = 0.1 * sin(t * 1.15);
        o.eyeX = 0.75 * sin(t * 2.3); o.eyeY = -0.6; o.eyeOpen = 0.95;
        o.ap = 0.55; o.at = 0.3; o.ar = 0.05; o.ae = 1.3 + 0.1 * Math.max(0, sin(t * 9));
        o.bp = 0.55; o.bt = 0.3; o.br = 0.05; o.be = 1.3 + 0.1 * Math.max(0, sin(t * 9 + 2.4));
        o.lamp = 1.1 + 0.3 * sin(t * 9); o.holo = 1; o.bodyRx = 0.05;
        break;
      case "speaking": { // Mund bewegt sich mit der Stimme, Hände gestikulieren, Kopf nickt
        const beat = Math.min(1, v * 1.6);
        o.headRx = 0.05 * sin(t * 2.6) + 0.06 * beat; o.headRy = 0.09 * sin(t * 0.8); o.headRz = 0.05 * sin(t * 1.1);
        o.eyeOpen = 1.05; o.eyeY = 0.04;
        o.ap = 0.5 + 0.12 * sin(t * 1.4); o.at = 0.1 + 0.15 * sin(t * 0.9); o.ar = 0.24 + 0.1 * beat; o.ae = 1.75 + 0.22 * sin(t * 1.7) + 0.15 * beat;
        o.bp = 0.42 + 0.12 * sin(t * 1.2 + 1.5); o.bt = 0.1 + 0.15 * sin(t * 0.8 + 2); o.br = 0.24 + 0.1 * beat; o.be = 1.45 + 0.28 * sin(t * 1.3 + 1) + 0.15 * beat;
        o.lamp = 0.6 + v * 0.9; o.core = 0.6 + v * 0.8; o.bodyRy = 0.04 * sin(t * 0.7);
        break;
      }
      case "asking":    // wartet auf eine Bestätigung: hebt die Hand, Kopf schräg
        o.headRz = 0.2; o.headRy = 0.05; o.eyeOpen = 1.15;
        o.bp = 1.55; o.br = 0.25; o.bt = -0.4; o.be = 1.85 + 0.05 * sin(t * 2);
        o.lamp = 0.5 + 0.5 * (sin(t * 3.2) > 0 ? 1 : 0);
        break;
      case "error":     // lässt Kopf und Arme hängen
        o.headRx = 0.24; o.headRz = -0.06; o.eyeOpen = 0.5; o.eyeY = -0.4; o.bodyRx = 0.05;
        o.ar = 0.06; o.br = 0.06; o.ae = 0.1; o.be = 0.1; o.lamp = 0.6;
        break;
    }
    // denkt nebenher: die Antenne pulsiert, auch während zugehört oder gesprochen wird
    if (this.working && (this.state === "listening" || this.state === "speaking")) o.lamp = Math.max(o.lamp, 0.85 + 0.45 * sin(t * 6));
    return o;
  }

  private setMat(m: Mat) {
    const gl = this.gl, u = this.u;
    gl.uniform3fv(u.uColor, m.color); gl.uniform3fv(u.uEmit, m.emit || [0, 0, 0]);
    gl.uniform1f(u.uSpec, m.spec); gl.uniform1f(u.uShine, m.shine); gl.uniform1f(u.uGloss, m.gloss);
  }
  private part(name: string, m: M4, mat: Mat) {
    const gl = this.gl, mesh = this.meshes[name];
    this.setMat(mat);
    gl.uniformMatrix4fv(this.u.uM, false, m); gl.uniformMatrix3fv(this.u.uN, false, normalMat(m));
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }
  private glow(p: V3, size: number, color: V3, a: number) { if (a > 0.01) this.glows.push({ p, size, color, a }); }

  private arm(body: M4, side: number, p: number, r: number, tw: number, e: number, shell: Mat, joint: Mat) {
    let m = trans(body, side * 0.92, -0.52, 0);
    this.part("sphere", scale(m, 0.215, 0.215, 0.215), joint);
    m = rotY(rotX(rotZ(m, side * r), -p), -side * tw);
    this.part("upper", trans(m, 0, -0.36, 0), shell);
    m = trans(m, 0, -0.72, 0);
    this.part("sphere", scale(m, 0.15, 0.15, 0.15), joint);
    m = rotX(m, -e);
    this.part("fore", trans(m, 0, -0.33, 0), shell);
    m = trans(m, 0, -0.7, 0);
    this.part("sphere", scale(m, 0.105, 0.105, 0.105), joint);
    this.part("hand", trans(m, 0, -0.15, 0), shell);
    this.part("thumb", rotZ(trans(m, -side * 0.15, -0.09, 0.02), -side * 0.5), shell);
    return m;
  }

  private draw() {
    this.resize();
    const gl = this.gl, c = this.col, p = this.shown(), t = this.t;
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    // Kamera: so weit weg, dass die Figur in Breite und Höhe passt (Hochformat: die Breite bestimmt)
    const aspect = this.w / this.h, fov = 0.5;
    const tan = Math.tan(fov / 2);
    const dist = Math.max(2.0 / tan, 1.32 / (tan * aspect));
    // unten am Bildrand „stehen“ (die Hüfte läuft dort aus), der freie Platz bleibt über dem Kopf
    const camY = -2.1 + dist * tan - Math.max(0, dist * tan - 2.0) * 0.25;
    const eye: V3 = [0, camY, dist];
    const view = trans(ident(), 0, -camY, -dist);
    const vp = mul(persp(fov, aspect, 0.5, 60), view);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    gl.uniformMatrix4fv(this.u.uVP, false, vp); gl.uniform3fv(this.u.uCam, eye);
    gl.uniform3fv(this.u.uSky, c.sky); gl.uniform3fv(this.u.uGround, c.ground); gl.uniform3fv(this.u.uRim, c.accent);

    const shell: Mat = { color: c.shell, spec: 0.55, shine: 70, gloss: 0.3 };
    const joint: Mat = { color: c.joint, spec: 0.25, shine: 24, gloss: 0.12 };
    const face: Mat = { color: c.face, spec: 0.9, shine: 140, gloss: 0.55 };
    const led = (color: V3, power: number): Mat => ({ color: [0.02, 0.02, 0.02], spec: 0.3, shine: 40, gloss: 0.1,
      emit: [color[0] * power, color[1] * power, color[2] * power] });
    this.glows = [];

    // Rumpf (dreht um die Hüfte)
    let body = trans(ident(), 0, -1.75 + p.bodyY, 0);
    body = rotZ(rotY(rotX(body, p.bodyRx), p.bodyRy), p.bodyRz);
    this.part("pelvis", trans(body, 0, -0.1, 0), joint);
    body = trans(body, 0, 1.75, 0);
    this.part("torso", trans(body, 0, -0.98, 0), shell);
    const coreOn = Math.max(0.15, p.core);
    const core = trans(body, 0, -0.76, 0.452);
    this.part("sphere", scale(core, 0.15, 0.15, 0.03), led(c.accent, 0.35 + coreOn * 0.8));
    this.glow(point(core, 0, 0, 0.2), 0.5, c.accent, 0.25 + coreOn * 0.45);
    this.part("neck", trans(body, 0, -0.2, 0), joint);
    this.arm(body, -1, p.ap, p.ar, p.at, p.ae, shell, joint);
    this.arm(body, 1, p.bp, p.br, p.bt, p.be, shell, joint);

    // Kopf (dreht um den Hals)
    let head = trans(body, 0, 0.02, 0);
    head = rotZ(rotX(rotY(head, p.headRy), p.headRx), p.headRz);
    head = trans(head, 0, 0.6, 0);
    this.part("head", head, shell);
    this.part("face", trans(head, 0, -0.03, 0.535), face);
    const lampCol = this.state === "asking" ? lin("#f3b743") : this.state === "error" ? lin("#e5645a") : c.accent;
    for (const side of [-1, 1]) {
      this.part("ear", trans(head, side * 0.93, -0.02, 0), shell);
      const e = trans(head, side * 1.035, -0.02, 0);
      this.part("sphere", scale(e, 0.025, 0.11, 0.11), led(c.accent, 0.3 + p.ear * 1.6));
      this.glow(point(e, side * 0.1, 0, 0.1), 0.42, c.accent, Math.min(1, p.ear * 0.7));
    }
    // Antenne mit Kugel
    let ant = rotX(rotZ(trans(head, 0, 0.6, 0), this.ant), this.antX);
    this.part("stick", trans(ant, 0, 0.17, 0), shell);
    ant = trans(ant, 0, 0.42, 0);
    const lamp = Math.max(0.05, p.lamp);
    this.part("sphere", scale(ant, 0.125, 0.125, 0.125), { color: mix3(c.shell, lampCol, 0.55), spec: 0.6, shine: 60, gloss: 0.3,
      emit: [lampCol[0] * lamp * 0.9, lampCol[1] * lamp * 0.9, lampCol[2] * lamp * 0.9] });
    this.glow(point(ant, 0, 0, 0.16), 0.75, lampCol, Math.min(1.2, lamp * 0.7));
    if (p.holo > 0.05) for (let i = 0; i < 3; i++) {   // Recherchieren: Lichtpunkte kreisen um die Antenne
      const a = t * 3.2 + i * 2.094;
      this.glow(point(ant, Math.cos(a) * 0.36, 0.05 * Math.sin(a * 2), Math.sin(a) * 0.36), 0.16, c.glow, p.holo * 0.9);
    }
    // Augen: runde Leuchtflächen auf der Gesichtsscheibe; Blick verschiebt sie, Blinzeln staucht sie
    const open = Math.max(0.08, p.eyeOpen * (this.blink > 0 ? 0.1 + 0.9 * Math.abs(this.blink - 0.08) / 0.08 : 1));
    const smile = this.state === "speaking" || this.state === "hello" || this.intro < INTRO_S ? 1 : 0;
    for (const side of [-1, 1]) {
      const ex = side * 0.3 + p.eyeX * 0.085, ey = 0.07 + p.eyeY * 0.06;
      const e = trans(head, ex, ey, 0.7 - 0.05 * ex * ex - 0.03 * ey * ey);
      this.part("sphere", scale(e, 0.15, 0.15 * Math.min(1.25, open), 0.028), led(c.glow, 2.2));
      this.glow(point(e, 0, 0, 0.18), 0.5, c.glow, 0.42);
    }
    // Mund: fünf Segmente, in Ruhe ein leichtes Lächeln; beim Sprechen schlagen sie mit der Stimme aus,
    // beim Nachdenken und Recherchieren läuft ein Licht hindurch
    const busy = this.state === "thinking" || this.state === "researching";
    for (let i = 0; i < 5; i++) {
      const d = Math.abs(i - 2) / 2;
      const x = (i - 2) * 0.105;
      const wob = 0.55 + 0.45 * Math.sin(t * 17 + i * 1.9) * Math.sin(t * 7.3 + i);
      const hgt = 0.028 + this.mouth * (1 - 0.55 * d) * 0.17 * wob;
      const y = -0.235 + (0.045 + 0.02 * smile) * d * d * (1 - Math.min(1, this.mouth * 2));
      const run = busy ? 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 0.9)) : 1;
      const m = trans(head, x, y, 0.7 - 0.05 * x * x - 0.03 * y * y);
      this.part("sphere", scale(m, 0.04, hgt, 0.02), led(c.glow, 1.9 * run));
    }

    // Leuchten und Tafel: durchscheinend, nach den festen Teilen
    gl.useProgram(this.prog2);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(this.u2.uVP, false, vp); gl.uniform1f(this.u2.uTime, t);
    if (p.holo > 0.02) {
      const holo = rotX(trans(body, 0, -0.62, 1.02), -0.95);
      const o = point(holo), r = point(holo, 0.62 * p.holo, 0, 0), up = point(holo, 0, 0.36, 0);
      gl.uniform1f(this.u2.uMode, 1); gl.uniform3fv(this.u2.uColor, c.accent); gl.uniform1f(this.u2.uAlpha, p.holo);
      gl.uniform3fv(this.u2.uCenter, o);
      gl.uniform3f(this.u2.uRight, r[0] - o[0], r[1] - o[1], r[2] - o[2]);
      gl.uniform3f(this.u2.uUp, up[0] - o[0], up[1] - o[1], up[2] - o[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.uniform1f(this.u2.uMode, 0);
    for (const g of this.glows) {
      gl.uniform3fv(this.u2.uColor, g.color); gl.uniform1f(this.u2.uAlpha, g.a);
      gl.uniform3fv(this.u2.uCenter, g.p); gl.uniform3f(this.u2.uRight, g.size, 0, 0); gl.uniform3f(this.u2.uUp, 0, g.size, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.depthMask(true);
  }
}
