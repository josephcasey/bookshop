/* Headless stills of the shop, no browser needed (scheduled runs can't start the dev server).
 * A tiny software canvas stands in for Canvas2D: fillRect, drawImage, rectangular clips, save/restore, translate/scale,
 * get/putImageData and the composite ops the sprites use (source-over/in/atop, destination-in/out, lighter, multiply).
 * Gradients, arcs and text are skipped, so the soft lighting is missing, but every sprite and prop is drawn exactly.
 *
 *   node tools/headless/still.js [--theme classic|cyber|both] [--hour 11] [--fire <happening or visitor id>]
 *                                [--seconds 60] [--every 5] [--follow <npc kind>] [--crop x,y,w,h] [--scale 4] [--out dir]
 *
 * Jumps to --hour, optionally fires a happening/visitor, then saves a frame every --every seconds for --seconds.
 * --follow centres a 120-px-wide crop on the first NPC of that kind (else --crop, else the whole scene).
 * Frames land in tools/headless/out/ (git-ignored) as <theme>-<t>s.png; the console lists them, plus any errors. */
const vm = require('vm'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const outDir = path.resolve(arg('out', path.join(__dirname, 'out')));
fs.mkdirSync(outDir, { recursive: true });
function parseC(c) {
  if (typeof c !== 'string') return null;
  let m;
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = [...h].map((x) => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  if ((m = c.match(/rgba?\(([^)]+)\)/))) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  return null;
}
class Ctx {
  constructor(cv) { this.cv = cv; this.fillStyle = '#000'; this.strokeStyle = '#000'; this.globalAlpha = 1; this.globalCompositeOperation = 'source-over'; this.st = []; this.tf = [1, 1, 0, 0]; this.clipR = null; this.path = []; }
  get d() { return this.cv.data; }
  save() { this.st.push([this.fillStyle, this.globalAlpha, this.globalCompositeOperation, [...this.tf], this.clipR]); }
  restore() { const s = this.st.pop(); if (s) [this.fillStyle, this.globalAlpha, this.globalCompositeOperation, this.tf, this.clipR] = s; }
  translate(x, y) { this.tf[2] += x * this.tf[0]; this.tf[3] += y * this.tf[1]; }
  scale(a, b) { this.tf[0] *= a; this.tf[1] *= b; }
  setTransform(a, b, c, d, e, f) { this.tf = a && typeof a === 'object' ? [1, 1, 0, 0] : [a == null ? 1 : a, d == null ? 1 : d, e || 0, f || 0]; }
  resetTransform() { this.tf = [1, 1, 0, 0]; }
  beginPath() { this.path = []; } rect(x, y, w, h) { this.path.push([x, y, w, h]); }
  moveTo() { this.path.push(null); } lineTo() { this.path.push(null); } arc() { this.path.push(null); } ellipse() { this.path.push(null); } closePath() {}
  clip() { const r = this.path.filter(Boolean); if (!r.length || this.path.includes(null)) return; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y, w, h] of r) { const [X, Y] = this.map(x, y); x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X + w * this.tf[0]); y1 = Math.max(y1, Y + h * this.tf[1]); } this.clipR = this.clipR ? [Math.max(x0, this.clipR[0]), Math.max(y0, this.clipR[1]), Math.min(x1, this.clipR[2]), Math.min(y1, this.clipR[3])] : [x0, y0, x1, y1]; }
  fill() { if (this.path.includes(null)) return; for (const r of this.path) this.fillRect(...r); }
  stroke() {} fillText() {} strokeText() {} measureText() { return { width: 0 }; } strokeRect() {}
  createLinearGradient() { return { addColorStop() {}, grad: 1 }; } createRadialGradient() { return { addColorStop() {}, grad: 1 }; } createPattern() { return null; }
  map(x, y) { return [x * this.tf[0] + this.tf[2], y * this.tf[1] + this.tf[3]]; }
  blend(i, r, g, b, a) {
    const D = this.d, op = this.globalCompositeOperation, da = D[i + 3] / 255;
    if (op === 'source-over') { const oa = a + da * (1 - a); if (oa <= 0) return; D[i] = (r * a + D[i] * da * (1 - a)) / oa; D[i + 1] = (g * a + D[i + 1] * da * (1 - a)) / oa; D[i + 2] = (b * a + D[i + 2] * da * (1 - a)) / oa; D[i + 3] = oa * 255; }
    else if (op === 'source-in') { D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = a * da * 255; }
    else if (op === 'source-atop') { if (da > 0) { D[i] = r * a + D[i] * (1 - a); D[i + 1] = g * a + D[i + 1] * (1 - a); D[i + 2] = b * a + D[i + 2] * (1 - a); } }
    else if (op === 'destination-out') D[i + 3] *= 1 - a;
    else if (op === 'destination-in') D[i + 3] *= a;
    else if (op === 'lighter') { D[i] = Math.min(255, D[i] + r * a); D[i + 1] = Math.min(255, D[i + 1] + g * a); D[i + 2] = Math.min(255, D[i + 2] + b * a); D[i + 3] = Math.min(255, D[i + 3] + a * 255); }
    else if (op === 'multiply') { D[i] = D[i] * (1 - a + a * r / 255); D[i + 1] = D[i + 1] * (1 - a + a * g / 255); D[i + 2] = D[i + 2] * (1 - a + a * b / 255); }
  }
  span(x0, y0, x1, y1, fn) {
    const W = this.cv.width, H = this.cv.height, c = this.clipR;
    x0 = Math.max(0, Math.round(x0), c ? Math.round(c[0]) : 0); y0 = Math.max(0, Math.round(y0), c ? Math.round(c[1]) : 0);
    x1 = Math.min(W, Math.round(x1), c ? Math.round(c[2]) : W); y1 = Math.min(H, Math.round(y1), c ? Math.round(c[3]) : H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) fn(x, y, (y * W + x) * 4);
  }
  fillRect(x, y, w, h) {
    const c = parseC(this.fillStyle); if (!c) return;
    const a = c[3] * this.globalAlpha; const [X, Y] = this.map(x, y);
    let x1 = X + w * this.tf[0], y1 = Y + h * this.tf[1];
    this.span(Math.min(X, x1), Math.min(Y, y1), Math.max(X, x1), Math.max(Y, y1), (px, py, i) => this.blend(i, c[0], c[1], c[2], a));
  }
  clearRect(x, y, w, h) { const [X, Y] = this.map(x, y); const c = this.clipR; this.clipR = null; this.span(X, Y, X + w, Y + h, (px, py, i) => { this.d[i] = this.d[i + 1] = this.d[i + 2] = this.d[i + 3] = 0; }); this.clipR = c; }
  drawImage(src, ...a) {
    if (!src || !src.data) return;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a.length === 2) [dx, dy] = a, dw = sw, dh = sh; else if (a.length === 4) [dx, dy, dw, dh] = a; else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    const [X, Y] = this.map(dx, dy); const W2 = dw * this.tf[0], H2 = dh * this.tf[1];
    const S = src.data, ga = this.globalAlpha;
    this.span(Math.min(X, X + W2), Math.min(Y, Y + H2), Math.max(X, X + W2), Math.max(Y, Y + H2), (px, py, i) => {
      const u = Math.floor(sx + ((px + 0.5 - X) / W2) * sw), v = Math.floor(sy + ((py + 0.5 - Y) / H2) * sh);
      if (u < 0 || v < 0 || u >= src.width || v >= src.height) return;
      const j = (v * src.width + u) * 4; const sa = S[j + 3] / 255 * ga; if (sa <= 0 && this.globalCompositeOperation !== 'source-in' && this.globalCompositeOperation !== 'destination-in') return;
      this.blend(i, S[j], S[j + 1], S[j + 2], sa);
    });
  }
  getImageData(x, y, w, h) { const out = new Uint8ClampedArray(w * h * 4); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = ((y + j) * this.cv.width + x + i) * 4, d = (j * w + i) * 4; for (let k = 0; k < 4; k++) out[d + k] = this.cv.data[s + k]; } return { data: out, width: w, height: h }; }
  putImageData(img, x, y) { for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) { const d = ((y + j) * this.cv.width + x + i) * 4, s = (j * img.width + i) * 4; for (let k = 0; k < 4; k++) this.cv.data[d + k] = img.data[s + k]; } }
  createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
}
class Canvas { constructor() { this._w = 0; this._h = 0; this.data = new Float32Array(0); this.style = {}; } get width() { return this._w; } set width(v) { this._w = v; this.data = new Float32Array(v * this._h * 4); } get height() { return this._h; } set height(v) { this._h = v; this.data = new Float32Array(this._w * v * 4); } getContext() { return this.ctx || (this.ctx = new Ctx(this)); } }
function png(cv, x0, y0, w, h, k, file) {
  const W = w * k, H = h * k, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const i = (((y0 + Math.floor(y / k)) * cv.width) + x0 + Math.floor(x / k)) * 4, o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = cv.data[i]; raw[o + 1] = cv.data[i + 1]; raw[o + 2] = cv.data[i + 2]; } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const noop = () => {}; const errors = [];
const sandbox = { console: { log: noop, warn: (...a) => errors.push(a.join(' ')), error: (...a) => errors.push(a.map((x) => (x && x.stack) || x).join(' ')) }, location: { search: '' }, performance: { now: () => Date.now() }, setInterval: noop, setTimeout: noop, URLSearchParams, Math, Date, JSON, Map, WeakMap, Array, Object, String, Number, Proxy, Float32Array, Uint8ClampedArray, localStorage: { getItem: () => null, setItem: noop }, document: { createElement: () => new Canvas() } };
sandbox.window = sandbox; vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
['js/core.js', 'js/script.js', 'js/pixel.js', 'js/sprites.js', 'js/audio.js', 'js/actors.js', 'js/world.js', 'js/director.js', 'js/render.js', 'js/cyber.js', 'content/manifest.js'].forEach(load);
const B = sandbox.Bookshop; B.manifest.forEach((f) => load('content/' + f)); B.buildCaches();
const s = (B.world = B.createWorld()); B.loadGame(s); B.settle(s); B.emit('ready', s);
const screen = new Canvas(); screen.width = B.W; screen.height = B.H; const g = screen.getContext();
const themes = arg('theme', 'both') === 'both' ? ['classic', 'cyber'] : [arg('theme')];
const fire = arg('fire'), follow = arg('follow'), secs = +arg('seconds', 60), every = +arg('every', 5), k = +arg('scale', 4);
const crop = arg('crop') ? arg('crop').split(',').map(Number) : null;
const shots = [];
for (const theme of themes) {
  B.setTheme(theme); B.buildCaches(); B.jumpTo(s, +arg('hour', 11));
  if (fire) { s.dayStats = s.dayStats || {}; if (!B.trigger(s, fire)) B.spawn(s, fire); }
  for (let i = 1; i <= secs * 30; i++) {
    B.tick(s, 1 / 30);
    if (i % Math.round(every * 30)) continue;
    B.render(g, s);
    let [x, y, w, h] = crop || [0, 0, B.W, B.H];
    const n = follow && s.npcs.find((m) => m.kind === follow);
    if (n) { w = 120; h = 110; y = 80; x = Math.round(Math.max(0, Math.min(B.W - w, n.x - w / 2))); }
    else if (follow) continue;
    const file = path.join(outDir, `${theme}-${Math.round(i / 30)}s.png`);
    png(screen, x, y, w, h, k, file); shots.push(file);
  }
}
console.log(shots.join('\n')); console.log('errors', errors.length); errors.slice(0, 5).forEach((e) => console.log(' ', e));
