/* SCH-30: low-resolution orthographic 2.5D relighting prototype.
 *
 * The production compositor projects authored masks onto a handful of planes; relight-v2 instead traces every
 * receiver back to each source using those semantic masks. This third route turns the same authored planes into a
 * compact G-buffer (visible depth + estimated surface normal), then lights it as one shallow orthographic scene.
 * Shadows are found by marching the visible depth buffer toward the window, so props, people and shelving all obey
 * the same screen-space depth rule. The solve runs on a 2x2 pixel grid to test the cost/look of a deliberately small
 * 2.5D surface rather than pretending the shop already has full 3D geometry.
 *
 * Enable with ?lighting=relight-ortho or B.relightOrtho.setEnabled(true). Like relight-v2, this only replaces light
 * entering through the shop window; authored practicals, facade light, glass reflection and the Cyber grade remain.
 */
(function (B) {
  'use strict';
  const W = B.W;
  const H = B.H;
  const STEP = 2;
  const F = (B.lightFlags = B.lightFlags || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const WN = () => B.LAYOUT.win;
  const clock = performance.now.bind(performance);

  const mode = {
    enabled: false,
    saved: null,
    setEnabled(on) {
      on = !!on;
      if (on === this.enabled) return;
      if (on) {
        if (B.relightV2 && B.relightV2.enabled) B.relightV2.setEnabled(false);
        this.saved = { projection: F.projection, sunInterior: F.sunInterior };
        F.projection = false;
        F.sunInterior = false;
      } else if (this.saved) {
        F.projection = this.saved.projection;
        F.sunInterior = this.saved.sunInterior;
        this.saved = null;
      }
      this.enabled = on;
    },
  };
  B.relightOrtho = mode;

  let light = null;
  let lg = null;
  let lastStats = null;
  const depth = new Int16Array(W * H);
  const skip = new Int16Array(W * H);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };
  function ensure() {
    if (!light) [light, lg] = make();
    return !!lg;
  }

  function rgb(hex) {
    const n = parseInt((hex || '#ffffff').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function sunSource(s) {
    if (!F.sun || !B.sun) return null;
    const sun = B.sun(s);
    if (sun.strength < 0.02 || sun.behind || sun.facing <= 0.04) return null;
    const D = 6000;
    const a = Math.min(0.9, 0.76 * sun.strength * sun.facing * (B.sunCloud ? B.sunCloud(s, 110) : 1));
    if (a < 0.02) return null;
    return { kind: 'sun', x: 110 + D * sun.tanP * 0.5, y: 110 - (D * sun.tanE) / sun.cosP, D, col: sun.col, a, gain: 1.2 };
  }

  function samples(src) {
    if (src.kind === 'sun') return [[-170, 0, 0.34], [0, 0, 0.32], [170, 0, 0.34]];
    if (src.soft) {
      const d = src.compact ? 7 : 16;
      return [[-d, 0, 0.3], [d, 0, 0.3], [0, -d * 0.5, 0.2], [0, d * 0.5, 0.2]];
    }
    if (src.pair === 'across') return [[-26, 0, 0.62], [26, 0, 0.38]];
    return [[0, 0, 1]];
  }

  function onWindow(s, src, x, y) {
    const w = WN();
    if (x < w.x || x >= w.x + w.w || y < w.y || y >= w.y + w.h) return false;
    if ((x >= 76 && x < 78) || (x >= 144 && x < 146) || (y >= 84 && y < 86)) return false;
    return !(src.kind === 'sun' && B.sunShadeLine && y >= B.sunShadeLine(s, x));
  }

  function beam(src, x, y, Z, sx, sy, D) {
    if (src.aim == null) return 1;
    const m = (Z + D) / D;
    const tx = sx + (src.aim - sx) * m;
    const ty = sy + (150 - sy) * m - (src.lift || 0) * 2;
    const dx = x - tx;
    const dy = (y - ty) * 1.7;
    let k = clamp(1 - Math.sqrt(dx * dx + dy * dy) / (src.main ? 105 : 82), 0, 1);
    k = Math.pow(k, src.main ? 0.7 : 0.85);
    if (!src.main && src.cutY != null) {
      const gx = sx + (x - sx) * D / (Z + D);
      const gy = sy + (y - sy) * D / (Z + D);
      const rise = (src.kick || 0) * Math.max(0, gx - src.aim) * 0.43;
      if (gy < src.cutY - rise) k *= 0.16;
    }
    return k;
  }

  function buildGBuffer(s) {
    depth.fill(0);
    skip.fill(-1);
    let pixels = 0;
    const receivers = B.lightKit.SHOP.receivers(s);
    for (const r of receivers) {
      const data = r.vis.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
      const box = r.rects[0];
      const x0 = Math.max(WN().x, Math.floor(box.x));
      const y0 = Math.max(WN().y, Math.floor(box.y));
      const x1 = Math.min(WN().x + WN().w, Math.ceil(box.x + box.w));
      const y1 = Math.min(WN().y + WN().h, Math.ceil(box.y + box.h));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const p = y * W + x;
        if (!depth[p] && data[p * 4 + 3] > 15) {
          depth[p] = r.Z;
          skip[p] = r.skipZ == null ? -1 : r.skipZ;
          pixels++;
        }
      }
    }
    return pixels;
  }

  function normalAt(x, y, Z) {
    const same = (xx, yy) => {
      const z = depth[clamp(yy, 0, H - 1) * W + clamp(xx, 0, W - 1)];
      return z || Z;
    };
    const dx = clamp((same(x - 1, y) - same(x + 1, y)) * 0.035, -0.38, 0.38);
    const dy = clamp((same(x, y - 1) - same(x, y + 1)) * 0.03, -0.3, 0.3);
    let nx = dx;
    let ny = dy;
    let nz = -1;
    // A few authored horizontal bands give the shallow model meaningful top-facing surfaces instead of treating the
    // entire shop as a stack of billboards. The depth gradients still provide edge bevels everywhere else.
    if ((Z === 13 && y >= 118 && y <= 130) || (Z >= 34 && y >= 143)) {
      ny -= 0.42;
      nz = -0.82;
    } else if (Z >= 34 && [92, 104, 116, 128].some((sy) => Math.abs(y - sy) <= 1)) {
      ny -= 0.24;
      nz = -0.93;
    }
    const d = Math.hypot(nx, ny, nz) || 1;
    return [nx / d, ny / d, nz / d];
  }

  function shadowed(x, y, Z, ownSkip, sx, sy, D) {
    // March the authored depth planes toward the glass. At each plane, ask the visible G-buffer whether a nearer
    // surface occupies the light ray there. This is intentionally screen-space: missing off-camera geometry is the
    // principal limitation the comparison is meant to expose.
    for (const z of [34, 22, 20, 13, 4]) {
      if (z >= Z - 1 || z === ownSkip) continue;
      const m = (z + D) / (Z + D);
      const px = Math.round(sx + (x - sx) * m);
      const py = Math.round(sy + (y - sy) * m);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const seen = depth[py * W + px];
      if (seen > 0 && seen < Z - 1 && Math.abs(seen - z) <= 3) return true;
    }
    return false;
  }

  function sources(s) {
    const out = [];
    const sun = sunSource(s);
    if (sun) out.push(sun);
    if (!B.lightKit.sources) return out;
    const fogTransmission = Math.exp(-1.2 * ((s.weather && s.weather.fog) || 0));
    const direction = B.lightingDirection && B.lightingDirection.enabled ? B.lightingDirection.values(s) : null;
    const interiorTransmission = s.shop.lights ? (direction ? direction.externalTransmission : 0.35) : 1;
    for (const source of B.lightKit.sources(s)) {
      const scale = source.aim != null ? 0.96 : source.soft ? 0.34 : 0.5;
      source.a *= scale * fogTransmission * interiorTransmission;
      if (source.a > 0.008) out.push(source);
    }
    return out;
  }

  function solve(g, s) {
    const kit = B.lightKit;
    if (!ensure() || !kit || !kit.SHOP || !kit.reveal) return;
    const started = clock();
    const gPixels = buildGBuffer(s);
    const active = sources(s);
    if (!active.length) {
      lastStats = { resolution: STEP, sources: 0, gBufferPixels: gPixels, litPixels: 0, shadowTests: 0, solveMs: clock() - started };
      return;
    }

    const img = lg.createImageData(W, H);
    const dst = img.data;
    let litPixels = 0;
    let shadowTests = 0;
    for (let by = WN().y; by < WN().y + WN().h; by += STEP) {
      for (let bx = WN().x; bx < WN().x + WN().w; bx += STEP) {
        // Preserve depth edges inside a 2x2 block: each distinct visible plane gets one solve, then shares it only
        // with pixels from that plane. The blocky response is therefore intentional but silhouettes stay crisp.
        const solved = new Map();
        for (let oy = 0; oy < STEP; oy++) for (let ox = 0; ox < STEP; ox++) {
          const x = bx + ox;
          const y = by + oy;
          if (x >= WN().x + WN().w || y >= WN().y + WN().h) continue;
          const p = y * W + x;
          const Z = depth[p];
          if (!Z) continue;
          let value = solved.get(Z);
          if (!value) {
            const cx = Math.min(WN().x + WN().w - 1, bx + 0.5);
            const cy = Math.min(WN().y + WN().h - 1, by + 0.5);
            const [nx, ny, nz] = normalAt(x, y, Z);
            let er = 0;
            let eg = 0;
            let eb = 0;
            let energy = 0;
            for (const src of active) {
              const [cr, cg, cb] = rgb(src.col);
              for (const [ox2, oy2, weight] of samples(src)) {
                const sx = src.x + ox2;
                const sy = src.y + oy2;
                const D = src.D;
                const m0 = D / (Z + D);
                const wx = sx + (cx - sx) * m0;
                const wy = sy + (cy - sy) * m0;
                if (!onWindow(s, src, wx, wy)) continue;
                shadowTests++;
                if (shadowed(cx, cy, Z, skip[p], sx, sy, D)) continue;
                const lx0 = sx - cx;
                const ly0 = sy - cy;
                const lz0 = -D - Z;
                const ld = Math.hypot(lx0, ly0, lz0) || 1;
                const lambert = clamp((nx * lx0 + ny * ly0 + nz * lz0) / ld, 0.16, 1);
                const near = Math.min(2.2, Math.pow((40 + D) / (Z + D), 2));
                const e = src.a * weight * near * lambert * beam(src, cx, cy, Z, sx, sy, D);
                if (e <= 0.002) continue;
                er += cr * e;
                eg += cg * e;
                eb += cb * e;
                energy += e;
              }
            }
            value = energy < 0.012 ? [0, 0, 0, 0] : [er / energy, eg / energy, eb / energy, clamp(energy, 0, 1)];
            solved.set(Z, value);
          }
          if (!value[3]) continue;
          const i = p * 4;
          dst[i] = clamp(value[0], 0, 255);
          dst[i + 1] = clamp(value[1], 0, 255);
          dst[i + 2] = clamp(value[2], 0, 255);
          dst[i + 3] = Math.round(value[3] * 255);
          litPixels++;
        }
      }
    }
    lg.putImageData(img, 0, 0);
    if (F.bands !== false && kit.quantise) kit.quantise(lg, 4, 0.9, true, WN());
    kit.reveal(g, light, 'in', 0.045, 0.98, g, false, null, WN());
    lastStats = {
      resolution: STEP,
      sources: active.length,
      gBufferPixels: gPixels,
      litPixels,
      shadowTests,
      solveMs: clock() - started,
    };
  }

  B.decor({ id: 'relight-ortho', layer: 'overlay', when: () => mode.enabled, draw: solve });
  B._relightOrthoDebug = () => ({ light, depth, stats: lastStats });
  mode.setEnabled(B.params && B.params.get('lighting') === 'relight-ortho');
})(window.Bookshop);
