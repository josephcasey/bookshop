/* SCH-30: receiver-buffer relighting prototype.
 *
 * This is deliberately an alternate solver, not another hand-authored light effect. The existing renderer supplies
 * the scene's albedo and a small set of semantic depth masks. For every visible interior pixel this pass traces the
 * ray back through the shop window to each source, testing the glazing bars, props and people at their real authored
 * depths. Sun, headlights and broad shopfront sources all go through the same visibility path.
 *
 * Enable replacement mode with ?lighting=relight-v2 or B.relightV2.setEnabled(true). Hybrid mode
 * (?lighting=hybrid-v1 or B.hybridLighting.setEnabled(true)) keeps the production projection as restrained cinematic
 * fill and layers this visibility solve only for direct sun and vehicle beams.
 */
(function (B) {
  'use strict';
  const W = B.W;
  const H = B.H;
  const F = (B.lightFlags = B.lightFlags || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const WN = () => B.LAYOUT.win;
  const clock = performance.now.bind(performance);
  let hybridTick = 0;
  let hybridReady = false;

  const mode = {
    enabled: false,
    variant: 'off',
    saved: null,
    setMode(next) {
      if (!['off', 'replace', 'hybrid'].includes(next) || next === this.variant) return;
      // Leaving replacement mode restores the production compositor before entering another mode.
      if (this.variant === 'replace' && this.saved) {
        F.projection = this.saved.projection;
        F.sunInterior = this.saved.sunInterior;
        this.saved = null;
      }
      if (next !== 'off') {
        if (B.relightOrtho && B.relightOrtho.enabled) B.relightOrtho.setEnabled(false);
      }
      if (next === 'replace') {
        this.saved = { projection: F.projection, sunInterior: F.sunInterior };
        F.projection = false;
        F.sunInterior = false;
      }
      this.variant = next;
      this.enabled = next !== 'off';
      hybridTick = 0;
      hybridReady = false;
    },
    setEnabled(on) {
      this.setMode(on ? 'replace' : 'off');
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
  function readCrop(g, rect) {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const w = Math.min(W - x, Math.ceil(rect.x + rect.w) - x);
    const h = Math.min(H - y, Math.ceil(rect.y + rect.h) - y);
    return { x, y, w, h, data: g.getImageData(x, y, w, h).data };
  }
  function alphaAt(mask, x, y) {
    x = Math.round(x) - mask.x;
    y = Math.round(y) - mask.y;
    if (x < 0 || y < 0 || x >= mask.w || y >= mask.h) return 0;
    return mask.data[(y * mask.w + x) * 4 + 3];
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
    const windowRect = WN();
    for (const [a, z] of people) {
      peopleG.clearRect(0, 0, W, H);
      B.drawSilhouette(peopleG, a, a.x, a.y, 1, 1);
      // Each actor needs an independent copy. Restricting it to the window avoids copying a full-frame buffer for
      // every person on every gameplay frame.
      out.push({ z, ...readCrop(peopleG, windowRect) });
    }
    return out;
  }

  function occluded(x, y, Z, skipZ, sx, sy, D, props, actors) {
    const denom = Z + D;
    for (const p of props) {
      if (p.z >= Z - 1 || p.z === skipZ) continue;
      const m = (p.z + D) / denom;
      if (alphaAt(p, sx + (x - sx) * m, sy + (y - sy) * m) > 28) return true;
    }
    for (const p of actors) {
      if (p.z >= Z - 1 || p.z <= -D + 4) continue;
      if (Z === 13 && p.z > 0 && p.z < 15) continue;
      const m = (p.z + D) / denom;
      if (alphaAt(p, sx + (x - sx) * m, sy + (y - sy) * m) > 28) return true;
    }
    return false;
  }

  function solve(g, s) {
    const kit = B.lightKit;
    if (!ensure() || !kit || !kit.SHOP || !kit.reveal) return;
    const started = clock();
    const sources = [];
    const sun = sunSource(s);
    const hybrid = mode.variant === 'hybrid';
    if (sun) {
      if (hybrid) sun.a *= 0.42;
      sources.push(sun);
    }
    if (kit.sources) {
      const fogTransmission = Math.exp(-1.2 * ((s.weather && s.weather.fog) || 0));
      const wet = clamp((s.weather && s.weather.rain) || 0, 0, 1);
      const direction = B.lightingDirection && B.lightingDirection.enabled ? B.lightingDirection.values(s) : null;
      const interiorTransmission = s.shop.lights ? (hybrid ? 0.7 : direction ? direction.externalTransmission : 0.35) : 1;
      for (const source of kit.sources(s)) {
        // In hybrid mode, broad shopfronts and street lamps remain the production compositor's job. Only sources with
        // an authored beam axis earn the more expensive geometric overlay.
        if (hybrid && source.aim == null) continue;
        // A broad pub window or street lamp should provide a quiet fill, not expose the whole unlit room as if a
        // ceiling lamp were on. Sharp vehicle beams remain the dominant night-time story.
        const scale = hybrid
          ? source.main
            ? 0.58 + 0.12 * wet
            : 0.34 + 0.08 * wet
          : source.aim != null
            ? 0.96
            : source.soft
              ? 0.34
              : 0.5;
        source.a *= scale * fogTransmission * interiorTransmission;
        if (source.a > 0.008) sources.push(source);
      }
    }
    if (!sources.length) {
      hybridTick = 0;
      hybridReady = false;
      lastStats = { variant: mode.variant, sources: 0, receivers: 0, litPixels: 0, rays: 0, solveMs: clock() - started };
      return;
    }

    // The authored projection beneath this pass still animates every frame. Updating the subtle geometric overlay at
    // 30 fps avoids paying for G-buffer readback twice per display frame without making a moving beam feel stepped.
    const reuseHybrid = hybrid && hybridReady && hybridTick % 2 === 1;
    if (hybrid) hybridTick++;
    if (reuseHybrid) {
      kit.reveal(g, light, 'in', 0.025, 0.58, g, false, null, WN());
      lastStats = {
        ...lastStats,
        variant: mode.variant,
        sources: sources.length,
        reused: true,
        solveMs: clock() - started,
      };
      return;
    }

    const windowRect = WN();
    const props = kit.SHOP.masks(s).map((m) => ({ z: m.z, ...readCrop(m.g, windowRect) }));
    const actors = actorMasks(s);
    const receivers = kit.SHOP.receivers(s).map((r) => ({
      Z: r.Z,
      skipZ: r.skipZ,
      rect: r.rects[0],
      vis: readCrop(r.vis.getContext('2d', { willReadFrequently: true }), r.rects[0]),
    }));
    for (const source of sources) {
      source.samplePoints =
        hybrid && source.kind === 'sun'
          ? [
              [-180, 0, 0, 0.25],
              [0, 0, 0, 0.5],
              [180, 0, 0, 0.25],
            ]
          : samples(source);
      source.rgb = rgb(source.col);
    }

    const img = lg.createImageData(W, H);
    const dst = img.data;
    let litPixels = 0;
    let rays = 0;
    // The overlay is intentionally coarse: the production light underneath carries the continuous composition, while
    // these 4x4 samples add only the crisp depth breaks that the authored projection cannot provide cheaply.
    const step = hybrid ? 4 : 1;
    for (const r of receivers) {
      const box = r.rect;
      const x0 = Math.max(WN().x, Math.floor(box.x));
      const y0 = Math.max(WN().y, Math.floor(box.y));
      const x1 = Math.min(WN().x + WN().w, Math.ceil(box.x + box.w));
      const y1 = Math.min(WN().y + WN().h, Math.ceil(box.y + box.h));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          let sampleX = x;
          let sampleY = y;
          let owned = false;
          // Hybrid solves one sample for each 4x4 block, but chooses a genuinely owned pixel so thin silhouettes do
          // not vanish merely because the block's top-left corner belongs to another receiver.
          for (let oy = 0; oy < step && !owned; oy++) for (let ox = 0; ox < step; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx >= x1 || yy >= y1) continue;
            if (alphaAt(r.vis, xx, yy) >= 16) {
              sampleX = xx;
              sampleY = yy;
              owned = true;
              break;
            }
          }
          if (!owned) continue;
          let er = 0;
          let eg = 0;
          let eb = 0;
          let energy = 0;
          for (const src of sources) {
            const [cr, cg, cb] = src.rgb;
            for (const [ox, oy, dD, weight] of src.samplePoints) {
              const sx = src.x + ox;
              const sy = src.y + oy;
              const D = src.D + dD;
              const m0 = D / (r.Z + D);
              const wx = sx + (sampleX - sx) * m0;
              const wy = sy + (sampleY - sy) * m0;
              rays++;
              if (!onWindow(s, src, wx, wy)) continue;
              if (occluded(sampleX, sampleY, r.Z, r.skipZ, sx, sy, D, props, actors)) continue;
              const near = Math.min(2.2, Math.pow((40 + D) / (r.Z + D), 2));
              const e = src.a * weight * near * beam(src, sampleX, sampleY, r.Z, sx, sy, D);
              if (e <= 0.002) continue;
              er += cr * e;
              eg += cg * e;
              eb += cb * e;
              energy += e;
            }
          }
          if (energy < 0.012) continue;
          const a = clamp(energy, 0, 1);
          for (let oy = 0; oy < step; oy++) for (let ox = 0; ox < step; ox++) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx >= x1 || yy >= y1) continue;
            const i = (yy * W + xx) * 4;
            if (alphaAt(r.vis, xx, yy) < 16) continue;
            dst[i] = clamp(er / energy, 0, 255);
            dst[i + 1] = clamp(eg / energy, 0, 255);
            dst[i + 2] = clamp(eb / energy, 0, 255);
            dst[i + 3] = Math.round(a * 255);
            litPixels++;
          }
        }
      }
    }
    lg.putImageData(img, 0, 0);
    // A 4x4 direct-light layer already has deliberate pixel steps; the full-resolution replacement still needs the
    // separate three-band quantiser.
    if (!hybrid && F.bands !== false && kit.quantise) kit.quantise(lg, 3, 0.96, true, WN());
    kit.reveal(g, light, 'in', hybrid ? 0.025 : 0.055, hybrid ? 0.58 : 0.98, g, false, null, WN());
    if (hybrid) hybridReady = true;
    lastStats = {
      variant: mode.variant,
      resolution: hybrid ? '4x4 light grid' : 'full light grid',
      reused: false,
      sources: sources.length,
      receivers: receivers.length,
      litPixels,
      rays,
      solveMs: clock() - started,
    };
  }

  B.decor({ id: 'relight-v2', layer: 'overlay', when: () => mode.enabled, draw: solve });
  B._relightV2Debug = () => ({ light, stats: lastStats });
  mode.setEnabled(B.params && B.params.get('lighting') === 'relight-v2');
})(window.Bookshop);
