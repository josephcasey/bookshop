/* SCH-30: receiver-buffer relighting prototype.
 *
 * This is deliberately an alternate solver, not another hand-authored light effect. The existing renderer supplies
 * the scene's albedo and a small set of semantic depth masks. For every visible interior pixel this pass traces the
 * ray back through the shop window to each source, testing the glazing bars, props and people at their real authored
 * depths. Sun, headlights and broad shopfront sources all go through the same visibility path.
 *
 * Enable with ?lighting=relight-v2 or B.relightV2.setEnabled(true). When enabled it replaces only light entering
 * through the shop window; the facade, glass reflection and the shop's own lamps remain the production renderer's.
 */
(function (B) {
  'use strict';
  const W = B.W;
  const H = B.H;
  const F = (B.lightFlags = B.lightFlags || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const WN = () => B.LAYOUT.win;

  const mode = {
    enabled: false,
    saved: null,
    setEnabled(on) {
      on = !!on;
      if (on === this.enabled) return;
      if (on) {
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
  B.relightV2 = mode;

  let light = null;
  let lg = null;
  let peopleCanvas = null;
  let peopleG = null;
  let lastStats = null;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };
  function ensure() {
    if (!light) [light, lg] = make();
    if (!peopleCanvas) [peopleCanvas, peopleG] = make();
    return !!(lg && peopleG);
  }

  function rgb(hex) {
    const n = parseInt((hex || '#ffffff').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function alphaAt(data, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return data[(y * W + x) * 4 + 3];
  }

  function sunSource(s) {
    if (!F.sun || !B.sun) return null;
    const sun = B.sun(s);
    if (sun.strength < 0.02 || sun.behind || sun.facing <= 0.04) return null;
    const D = 6000;
    const a = Math.min(0.9, 0.76 * sun.strength * sun.facing * (B.sunCloud ? B.sunCloud(s, 110) : 1));
    if (a < 0.02) return null;
    return {
      kind: 'sun',
      x: 110 + D * sun.tanP * 0.5,
      y: 110 - (D * sun.tanE) / sun.cosP,
      D,
      col: sun.col,
      a,
      gain: 1.2,
    };
  }

  function samples(src) {
    if (src.kind === 'sun') return [[-280, 0, 0, 0.2], [-90, -90, 0, 0.2], [0, 0, 0, 0.2], [90, 90, 0, 0.2], [280, 0, 0, 0.2]];
    if (src.soft) {
      const d = src.compact ? 7 : 18;
      return [[-d, 0, 0, 0.25], [d, 0, 0, 0.25], [0, -d * 0.5, 0, 0.25], [0, d * 0.5, 0, 0.25]];
    }
    if (src.pair === 'across') return [[-26, 0, 0, 0.62], [26, 0, 0, 0.38]];
    if (src.pair === 'depth') return [[0, 0, 0, 0.65], [0, 0, 14, 0.35]];
    return [[0, 0, 0, 1]];
  }

  function onWindow(s, src, x, y) {
    const w = WN();
    if (x < w.x || x >= w.x + w.w || y < w.y || y >= w.y + w.h) return false;
    // Three physical glazing bars. They are geometry at z=0, so every source casts them by the same rule.
    if ((x >= 76 && x < 78) || (x >= 144 && x < 146) || (y >= 84 && y < 86)) return false;
    // The opposite terrace can occlude the sun before it reaches the glass.
    if (src.kind === 'sun' && B.sunShadeLine && y >= B.sunShadeLine(s, x)) return false;
    return true;
  }

  function beam(src, x, y, Z, sx, sy, D) {
    if (src.aim == null) return 1;
    const m = (Z + D) / D;
    const tx = sx + (src.aim - sx) * m;
    const ty = sy + (150 - sy) * m - (src.lift || 0) * 2;
    const dx = x - tx;
    const dy = (y - ty) * 1.7;
    let k = clamp(1 - Math.sqrt(dx * dx + dy * dy) / (src.main ? 105 : 82), 0, 1);
    k = src.main ? Math.pow(k, 0.7) : Math.pow(k, 0.85);
    if (!src.main && src.cutY != null) {
      const gx = sx + (x - sx) * D / (Z + D);
      const gy = sy + (y - sy) * D / (Z + D);
      const rise = (src.kick || 0) * Math.max(0, gx - src.aim) * 0.43;
      if (gy < src.cutY - rise) k *= 0.16;
    }
    return k;
  }

  function actorMasks(s) {
    const out = [];
    const people = B.lightKit.SHOP.people(s);
    for (const [a, z] of people) {
      peopleG.clearRect(0, 0, W, H);
      B.drawSilhouette(peopleG, a, a.x, a.y, 1, 1);
      const img = peopleG.getImageData(0, 0, W, H);
      // Each actor needs an independent copy: getImageData is the cheap, deterministic G-buffer representation here.
      out.push({ z, data: img.data });
    }
    return out;
  }

  function occluded(x, y, Z, skipZ, sx, sy, D, props, actors) {
    const at = (z) => {
      const m = (z + D) / (Z + D);
      return [sx + (x - sx) * m, sy + (y - sy) * m];
    };
    for (const p of props) {
      if (p.z >= Z - 1 || p.z === skipZ) continue;
      const [px, py] = at(p.z);
      if (alphaAt(p.data, px, py) > 28) return true;
    }
    for (const p of actors) {
      if (p.z >= Z - 1 || p.z <= -D + 4) continue;
      if (Z === 13 && p.z > 0 && p.z < 15) continue;
      const [px, py] = at(p.z);
      if (alphaAt(p.data, px, py) > 28) return true;
    }
    return false;
  }

  function solve(g, s) {
    const kit = B.lightKit;
    if (!ensure() || !kit || !kit.SHOP || !kit.reveal) return;
    const sources = [];
    const sun = sunSource(s);
    if (sun) sources.push(sun);
    if (kit.sources) {
      const fogTransmission = Math.exp(-1.2 * ((s.weather && s.weather.fog) || 0));
      const direction = B.lightingDirection && B.lightingDirection.enabled ? B.lightingDirection.values(s) : null;
      const interiorTransmission = s.shop.lights ? (direction ? direction.externalTransmission : 0.35) : 1;
      for (const source of kit.sources(s)) {
        // A broad pub window or street lamp should provide a quiet fill, not expose the whole unlit room as if a
        // ceiling lamp were on. Sharp vehicle beams remain the dominant night-time story.
        const scale = source.aim != null ? 0.96 : source.soft ? 0.34 : 0.5;
        source.a *= scale * fogTransmission * interiorTransmission;
        if (source.a > 0.008) sources.push(source);
      }
    }
    if (!sources.length) return;

    const props = kit.SHOP.masks(s).map((m) => ({ z: m.z, data: m.g.getImageData(0, 0, W, H).data }));
    const actors = actorMasks(s);
    const receivers = kit.SHOP.receivers(s).map((r) => ({
      Z: r.Z,
      skipZ: r.skipZ,
      rect: r.rects[0],
      vis: r.vis.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data,
    }));

    const img = lg.createImageData(W, H);
    const dst = img.data;
    let litPixels = 0;
    let rays = 0;
    for (const r of receivers) {
      const box = r.rect;
      const x0 = Math.max(WN().x, Math.floor(box.x));
      const y0 = Math.max(WN().y, Math.floor(box.y));
      const x1 = Math.min(WN().x + WN().w, Math.ceil(box.x + box.w));
      const y1 = Math.min(WN().y + WN().h, Math.ceil(box.y + box.h));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          if (r.vis[i + 3] < 16) continue;
          let er = 0;
          let eg = 0;
          let eb = 0;
          let energy = 0;
          for (const src of sources) {
            const [cr, cg, cb] = rgb(src.col);
            for (const [ox, oy, dD, weight] of samples(src)) {
              const sx = src.x + ox;
              const sy = src.y + oy;
              const D = src.D + dD;
              const m0 = D / (r.Z + D);
              const wx = sx + (x - sx) * m0;
              const wy = sy + (y - sy) * m0;
              rays++;
              if (!onWindow(s, src, wx, wy)) continue;
              if (occluded(x, y, r.Z, r.skipZ, sx, sy, D, props, actors)) continue;
              const near = Math.min(2.2, Math.pow((40 + D) / (r.Z + D), 2));
              const e = src.a * weight * near * beam(src, x, y, r.Z, sx, sy, D);
              if (e <= 0.002) continue;
              er += cr * e;
              eg += cg * e;
              eb += cb * e;
              energy += e;
            }
          }
          if (energy < 0.012) continue;
          const a = clamp(energy, 0, 1);
          dst[i] = clamp(er / energy, 0, 255);
          dst[i + 1] = clamp(eg / energy, 0, 255);
          dst[i + 2] = clamp(eb / energy, 0, 255);
          dst[i + 3] = Math.round(a * 255);
          litPixels++;
        }
      }
    }
    lg.putImageData(img, 0, 0);
    if (F.bands !== false && kit.quantise) kit.quantise(lg, 3, 0.96, true, WN());
    kit.reveal(g, light, 'in', 0.055, 0.98, g, false, null, WN());
    lastStats = { sources: sources.length, receivers: receivers.length, litPixels, rays };
  }

  B.decor({ id: 'relight-v2', layer: 'overlay', when: () => mode.enabled, draw: solve });
  B._relightV2Debug = () => ({ light, stats: lastStats });
  mode.setEnabled(B.params && B.params.get('lighting') === 'relight-v2');
})(window.Bookshop);
