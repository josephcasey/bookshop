/* 2026-10-06 (light from behind you)
 * Light from things we never see, behind our viewpoint on our side of the road:
 * - the pub and chip shop across the way (in the neon city, a giant sign and a ramen bar) and the street lamp;
 * - traffic: passing cars graze the shopfront with their dipped beams, cars pull out of the junction behind us and swing
 *   their headlights across the shop, buses slide by with a band of lit windows, bikes wobble past, and now and then an
 *   emergency vehicle double-flashes blue.
 *
 * How it's lit (reviewed against real light transport):
 * - Light REVEALS the surfaces' own colours (the scene before the night tint, multiplied by the light's colour), rather
 *   than adding a grey film. A little is added on top for glare.
 * - Each light is drawn into its own canvas with its own shadows, then added to the light map, so one light's shadow
 *   never erases another's light. Edges are quantised with a 4x4 ordered dither, so gradients sit on the pixel grid.
 * - Through the windows, each light is a pinhole projection: a point at depth z behind the glass lands on a surface at
 *   depth Z at source + (point - source) * (Z + D) / (z + D). Cars have two headlamps, so their shadows come doubled;
 *   broad sources (a pub window) are several offset points, so their shadows have wide soft edges.
 * - Headlights are UK dipped beams: a flat cut-off with a kick-up on the nearside, bright just below it.
 * - Fog dims the pools on surfaces and makes the beams themselves visible in the air; rain darkens the paving and
 *   adds streaky reflections of every visible light.
 * Vehicles make their own sound (they replace the old sound-only passing cars). */
(function (B) {
  const W = 320;
  const H = 180;
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  };
  const cyber = () => B.theme === 'cyber';
  // Every approach can be switched off to see what it brings (the Lighting Lab menu toggles these)
  const F = (B.lightFlags = B.lightFlags || {}); // one shared object: the Lighting Lab toggles it
  const DEFAULTS = (
    {
      headlights: true, // traffic light sources
      steadyLights: true, // the pub, chippy, signs and street lamp
      reveal: true, // light reveals surface colour (off: plain additive light)
      bands: true, // light quantised to a few levels on the pixel grid
      projection: true, // light thrown through the windows into the rooms
      propShadows: true, // props and people cast shadows inside
      quietShadows: true, // texture quietened inside shadows
      facadeShadows: true, // people and the lamp post cast shadows up the shopfront
      exposure: true, // eye adaptation to bright beams
      actorLight: true, // people lit by the light where they stand
      mirror: true, // the dark glass reflects the street
      glints: true, // headlamp glints and kerb highlights
      rain: true, // wet reflections
      fog: true, // beams visible in fog
    }
  );
  for (const k in DEFAULTS) if (F[k] === undefined) F[k] = DEFAULTS[k];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => performance.now() / 1000;

  // ---------- sounds for the traffic ----------
  B.audio.define('busPass', ({ noise, tone, street }, fromLeft) => {
    const dur = 4.2;
    const l = fromLeft ? -0.9 : 0.9;
    noise(dur, { ftype: 'lowpass', freq: 160, fpeak: 520, fto: 150, q: 0.8, vol: 0.06, a: dur / 2, r: dur / 2, pan: l, panTo: -l, bus: street });
    tone(46, dur, { type: 'sawtooth', vol: 0.012, a: dur / 2, lp: 220, pan: l, panTo: -l, bus: street });
    if (Math.random() < 0.4) noise(0.5, { at: dur * 0.6, freq: 4000, q: 0.6, vol: 0.02, pan: -l * 0.3, bus: street }); // air brakes
  });
  B.audio.define('bikePass', ({ noise, tone, street }, fromLeft) => {
    const dur = 3;
    const l = fromLeft ? -0.9 : 0.9;
    noise(dur, { freq: 1800, q: 0.7, vol: 0.008, a: dur / 2, r: dur / 2, pan: l, panTo: -l, bus: street });
    for (let i = 0; i < 12; i++) noise(0.01, { at: 0.6 + i * 0.15, freq: 5000, q: 3, vol: 0.004, pan: l * (1 - (2 * i) / 12), bus: street }); // freewheel ticking
    if (Math.random() < 0.35) [0, 0.25].forEach((at) => tone(2600, 0.25, { at: dur * 0.4 + at, type: 'triangle', vol: 0.012, bus: street })); // ding ding
  });
  B.audio.define('carTurn', ({ noise, tone, street }, fromLeft) => {
    const dur = 3.6;
    const l = fromLeft ? -0.5 : 0.5;
    // idling at the give-way line, then pulling out and away
    tone(38, dur * 0.4, { type: 'sawtooth', vol: 0.006, lp: 200, bus: street });
    noise(dur, { ftype: 'lowpass', freq: 250, fpeak: 900, fto: 220, q: 0.8, vol: 0.055, a: dur * 0.5, r: dur * 0.5, pan: 0, panTo: l * 1.6, bus: street });
    tone(60, dur * 0.6, { at: dur * 0.4, type: 'sawtooth', vol: 0.007, lp: 300, slide: 95, bus: street });
  });
  // the old sound-only passing cars now come from the traffic below, with lights to match
  const amb = (B.ambience || []).find((a) => a.id === 'car');
  if (amb) amb.perSec = () => 0;

  // ---------- traffic ----------
  const events = [];
  const KINDS = {
    car: { dur: 2.8, sound: 'carPass', rate: (h) => (h < 6 ? 0.02 : h < 7 ? 0.05 : h < 20 ? 0.11 : 0.05) },
    turn: { dur: 4.65, sound: 'carTurn', rate: (h) => (h < 6 ? 0.008 : h < 20 ? 0.02 : 0.016) },
    bus: { dur: 4.2, sound: 'busPass', rate: (h) => (h >= 6 && h < 23.5 ? 0.012 : 0.002) },
    bike: { dur: 4, sound: 'bikePass', rate: (h) => (h >= 6 && h < 22 ? 0.02 : 0.004) },
    emergency: { dur: 5, sound: 'siren', rate: (h) => (h < 6 || h >= 22 ? 0.002 : 0.0008) },
  };
  B.spawnTraffic = (kind, opts = {}) => {
    const k = KINDS[kind];
    if (!k) return;
    const dir = opts.dir || (Math.random() < 0.5 ? 1 : -1);
    const ev = { kind, t: 0, dur: opts.dur || k.dur, dir, jx: opts.jx || (kind === 'turn' ? (Math.random() < 0.5 ? B.rnd(30, 70) : B.rnd(210, 250)) : B.rnd(80, 240)), seed: Math.random(), led: Math.random() < 0.3, main: opts.main != null ? opts.main : kind === 'turn' && Math.random() < 0.5 };
    events.push(ev);
    if (kind === 'emergency') B.audio.play('siren');
    else B.audio.play(k.sound, dir > 0);
  };
  B.on('tick', (s, dt) => {
    const rdt = dt / Math.max(1, (s.speed || 1) * (s.ff || 1));
    const h = s.hour;
    const busy = B.config.crowd == null ? 1 : Math.max(0.2, Math.min(2, B.config.crowd));
    for (const [kind, k] of Object.entries(KINDS)) if (Math.random() < rdt * k.rate(h) * busy) B.spawnTraffic(kind);
    // the household notices: blue lights flashing through the shop prick up the cat's ears and catch Mabel's eye; a
    // car's beam swinging through the flat or the shop sometimes makes her glance up
    if (B.daylight(h) < 0.5) {
      for (const ev of events) {
        if (ev.noticed || ev.t < 0.3) continue;
        const o = s.owner;
        const awake = o.area !== 'away' && o.pose !== 'sleep' && o.area !== 'street';
        if (ev.kind === 'emergency') {
          ev.noticed = true;
          if (s.cat && s.cat.surface !== 'floor') s.cat.alert = 1;
          if (awake) o.emote('what', 1.4);
        } else if (ev.kind === 'turn' && ev.main && ev.t > ev.dur * 0.3) {
          ev.noticed = true;
          if (awake && Math.random() < 0.35) o.emote(B.pick(['dots', 'what']), 1.2);
          if (s.cat && s.cat.surface !== 'floor' && Math.random() < 0.5) s.cat.alert = 1;
        }
      }
    }
    for (let i = events.length - 1; i >= 0; i--) {
      events[i].t += rdt;
      if (events[i].t > events[i].dur) events.splice(i, 1);
    }
  });
  B.on('jump', () => (events.length = 0));
  B.trafficEvents = events; // for tests and the console
  B.lightKit = {}; // filled in below: projection, rooms and helpers shared with the sunlight

  // ---------- canvases ----------
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); // CPU-backed, like the main canvas (mixing the two costs transfers)
    return [c, g];
  };
  let lm, lg, vc, vg, sc, sg2, rc, rg, pc, pg, qc, qg, ac, ag, bc, bgx, fc, fgx, hc, hgx, tc, tgx;
  let mainCanvas = null;
  let quietT = -1;
  let quietFrame = -1;
  let frameNo = 0;
  let darkNow = 1;
  const ensure = () => {
    if (lm) return !!lg;
    [lm, lg] = mk(); // the exterior light map
    [vc, vg] = mk(); // one light at a time, with its own shadows
    [sc, sg2] = mk(); // the steady lights across the road
    [rc, rg] = mk(); // reveal scratch
    [pc, pg] = mk(); // a projection through a window
    [qc, qg] = mk(); // light through the windows (normal)
    [ac, ag] = mk(); // light through the windows (additive glare)
    [bc, bgx] = mk(); // a projected patch before its shadows are cut
    [fc, fgx] = mk(); // the shadows inside a patch
    [hc, hgx] = mk(); // the scene's local mean colours, for quieting texture in shadow
    tc = document.createElement('canvas');
    tc.width = Math.ceil(W / 6);
    tc.height = Math.ceil(H / 6);
    tgx = tc.getContext('2d');
    return !!lg;
  };

  // ---------- pixel-grid quantising ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** Snap a light canvas's alpha to a few clearly separated levels. Flat light stays flat (one solid level); the 4x4
   *  ordered dither is used only where the light actually changes across the image (a beam's edge, a pool's
   *  falloff), which is where a pixel artist would dither between two tones. */
  let qa = null;
  let lmAlpha = null; // the outside light map before banding: how lit each spot is
  // Hard cel bands without reading pixels back (which forces all the deferred drawing to happen there and then):
  // an SVG filter posterises alpha on the way through. Checked once; if the browser can't, quantise() reads back.
  let celFilterOk = null;
  const celId = (levels, cap) => `bk-cel-${levels}-${Math.round(cap * 100)}`;
  function ensureCelFilter(levels, cap) {
    const id = celId(levels, cap);
    if (document.getElementById(id)) return id;
    let svg = document.getElementById('bk-filters');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'bk-filters';
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.position = 'absolute';
      document.body.appendChild(svg);
    }
    // 40 equal slices of input alpha, each mapped to its cel level
    const vals = [];
    for (let k = 0; k < 40; k++) {
      const a = (k + 0.5) / 40;
      vals.push(((Math.max(0, Math.min(levels, Math.floor((Math.min(a, cap) / cap) * levels + 0.5))) / levels) * cap).toFixed(4));
    }
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.id = id;
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `<feComponentTransfer><feFuncA type="discrete" tableValues="${vals.join(' ')}"/></feComponentTransfer>`;
    svg.appendChild(f);
    return id;
  }
  let celC = null;
  let celG = null;
  function celViaFilter(g, levels, cap, R) {
    if (celFilterOk === false || typeof document === 'undefined' || !document.createElementNS) return false;
    if (!celC) {
      celC = document.createElement('canvas');
      celC.width = W;
      celC.height = H;
      celG = celC.getContext('2d', { willReadFrequently: true });
    }
    if (!celG || !('filter' in celG)) {
      celFilterOk = false;
      return false;
    }
    const id = ensureCelFilter(levels, cap);
    if (celFilterOk === null) {
      // one-off check that the filter really bands: 30% alpha in, the nearest level out
      celG.clearRect(0, 0, W, H);
      celG.filter = `url(#${id})`;
      const probe = document.createElement('canvas');
      probe.width = probe.height = 2;
      const pgx = probe.getContext('2d');
      pgx.fillStyle = 'rgba(255,255,255,0.3)';
      pgx.fillRect(0, 0, 2, 2);
      celG.drawImage(probe, 0, 0);
      celG.filter = 'none';
      const a = celG.getImageData(0, 0, 1, 1).data[3] / 255;
      const want = (Math.floor((Math.min(0.3, cap) / cap) * levels + 0.5) / levels) * cap;
      celFilterOk = Math.abs(a - want) < 0.06;
      celG.clearRect(0, 0, W, H);
      if (!celFilterOk) return false;
    }
    const x = Math.max(0, Math.floor(R.x));
    const y = Math.max(0, Math.floor(R.y));
    const w = Math.min(W - x, Math.ceil(R.w) + 1);
    const h = Math.min(H - y, Math.ceil(R.h) + 1);
    celG.clearRect(x, y, w, h);
    celG.filter = `url(#${id})`;
    celG.drawImage(g.canvas, x, y, w, h, x, y, w, h);
    celG.filter = 'none';
    g.clearRect(x, y, w, h);
    g.drawImage(celC, x, y, w, h, x, y, w, h);
    return true;
  }

  function quantise(g, levels = 4, cap = 0.66, cel = false, R = null) {
    if (cel && R && celViaFilter(g, levels, cap, R)) return;
    // only the region that matters (a window's surface), not the whole frame: this runs many times a frame
    const x0 = R ? clamp(Math.floor(R.x), 0, W - 1) : 0;
    const y0 = R ? clamp(Math.floor(R.y), 0, H - 1) : 0;
    const w = R ? clamp(Math.ceil(R.x + R.w) - x0, 1, W - x0) : W;
    const h = R ? clamp(Math.ceil(R.y + R.h) - y0, 1, H - y0) : H;
    let img;
    try {
      img = g.getImageData(x0, y0, w, h);
    } catch (e) {
      return;
    }
    if (!img || !img.data) return;
    const d = img.data;
    const n = w * h;
    if (cel) {
      // hard bands, no dither: no neighbours needed
      for (let j = 3; j < d.length; j += 4) {
        const a = d[j];
        if (!a) continue;
        const v = (Math.min(a / 255, cap) / cap) * levels;
        d[j] = (Math.max(0, Math.min(levels, Math.floor(v + 0.5))) / levels) * cap * 255;
      }
      g.putImageData(img, x0, y0);
      return;
    }
    if (!qa || qa.length < n) qa = new Uint8Array(W * H);
    for (let i = 0, j = 3; i < n; i++, j += 4) qa[i] = d[j];
    if (g === lg && !R) lmAlpha = qa.slice(0, n);
    for (let y = 0, i = 0; y < h; y++) {
      const row = ((y + y0) & 3) << 2;
      for (let x = 0; x < w; x++, i++) {
        const a = qa[i];
        if (!a) continue;
        // g1: change over 2px (a hard edge); g7: change over 6px (a smooth ramp)
        const gx = Math.abs((x < w - 1 ? qa[i + 1] : a) - (x > 0 ? qa[i - 1] : a));
        const gy = Math.abs((y < h - 1 ? qa[i + w] : a) - (y > 0 ? qa[i - w] : a));
        const g7 =
          Math.abs((x < w - 3 ? qa[i + 3] : a) - (x > 2 ? qa[i - 3] : a)) + Math.abs((y < h - 3 ? qa[i + 3 * w] : a) - (y > 2 ? qa[i - 3 * w] : a));
        // hard edges stay crisp, flat light stays flat; only smooth ramps get a plain 2x2 checker between bands
        const th = gx + gy >= 40 || g7 < 3 ? 0.5 : (x + x0 + y + y0) & 1 ? 0.25 : 0.75;
        const v = (Math.min(a / 255, cap) / cap) * levels;
        const q = Math.max(0, Math.min(levels, Math.floor(v + 1 - th))) / levels;
        d[i * 4 + 3] = q * cap * 255;
      }
    }
    g.putImageData(img, x0, y0);
  }
  const bbox = (rects) => {
    let x1 = W, y1 = H, x2 = 0, y2 = 0;
    for (const r of rects) {
      x1 = Math.min(x1, r.x);
      y1 = Math.min(y1, r.y);
      x2 = Math.max(x2, r.x + r.w);
      y2 = Math.max(y2, r.y + r.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  // ---------- light shapes ----------
  /** A soft elliptical pool. */
  function pool(g, x, y, rx, ry, col, a, edge) {
    if (a <= 0.004 || rx <= 0 || ry <= 0) return;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.55, rgba(edge || col, a * 0.7));
    gr.addColorStop(1, rgba(edge || col, 0));
    g.fillStyle = gr;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  /** A UK dipped beam landing on the facade: below the flat cut-off at cutY it's bright; on the nearside the cut-off
   *  kicks up at about 15 degrees, so a wedge of light climbs diagonally up the front (kickDir -1: rising to the left,
   *  +1: to the right, 0: none). Faint stray light above. */
  function dippedBeam(g, cx, cutY, halfW, depth, col, a, kickDir = -1, edge) {
    if (a <= 0.004) return;
    pool(g, cx, cutY - 12, halfW * 0.9, 26, col, a * 0.16, edge); // stray light above the cut-off
    const rise = kickDir ? halfW * 0.27 * 1.6 : 0;
    g.save();
    g.beginPath();
    g.moveTo(cx - kickDir * 4, cutY);
    g.lineTo(cx + kickDir * halfW, cutY - rise); // the kick-up edge
    g.lineTo(cx + kickDir * halfW, cutY + depth);
    g.lineTo(cx - (kickDir || 1) * halfW, cutY + depth);
    g.lineTo(cx - (kickDir || 1) * halfW, cutY);
    g.closePath();
    g.clip();
    g.translate(cx, cutY + 4);
    const ry = Math.max(depth, rise);
    g.scale(1, ry / halfW);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, halfW);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.55, rgba(col, a * 0.8));
    gr.addColorStop(0.72, rgba(edge || col, a * 0.6)); // the beam's rim carries the colour
    gr.addColorStop(0.9, rgba(edge || col, a * 0.45));
    gr.addColorStop(1, rgba(edge || col, 0));
    g.fillStyle = gr;
    g.fillRect(-halfW, -halfW, halfW * 2, halfW * 2);
    g.restore();
  }
  /** Light from a window across the road: a trapezoid widening as it climbs the facade (the window is below and
   *  far away), brightest in a band on the shopfront, faint on the pavement it hits at a grazing angle, with soft
   *  penumbral edges and only the ghost of its glazing bars. */
  function windowLight(g, x0, x1, col, a, bars = 3) {
    if (a <= 0.004) return;
    const cx = (x0 + x1) / 2;
    const hw = (x1 - x0) / 2;
    const top = 70;
    for (const [inset, k] of [[0, 0.35], [6, 0.35], [12, 0.3]]) {
      g.save();
      g.beginPath();
      g.moveTo(cx - hw * 1.4 + inset, top + inset * 0.6);
      g.lineTo(cx + hw * 1.4 - inset, top + inset * 0.6);
      g.lineTo(cx + hw - inset, H);
      g.lineTo(cx - hw + inset, H);
      g.closePath();
      g.clip();
      const gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, rgba(col, 0));
      gr.addColorStop(0.35, rgba(col, a * k));
      gr.addColorStop(0.75, rgba(col, a * k));
      gr.addColorStop(0.85, rgba(col, a * k * 0.3)); // the pavement, lit at a grazing angle
      gr.addColorStop(1, rgba(col, a * k * 0.3));
      g.fillStyle = gr;
      g.fillRect(0, top, W, H - top);
      g.restore();
    }
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 1; i < bars; i++) {
      const fx = x0 + ((x1 - x0) * i) / bars;
      g.fillRect(Math.round(fx + (fx - cx) * 0.25) - 3, top, 6, H - top);
    }
    g.restore();
  }

  // ---------- where each vehicle's light is ----------
  const ease = (k) => k * k * (3 - 2 * k);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  function headColour(ev) {
    if (cyber()) return { col: ev.led ? '#c8f4ff' : '#9fe8ff', edge: '#ff6ad5' };
    return ev.led ? { col: '#eef3ff', edge: '#cfdcff' } : { col: '#ffe0a8', edge: '#ffb84a' };
  }
  /** Everything about one vehicle's light right now: where its beams land, its lamps (for shadows and projection),
   *  how bright it is, and a fog cone. */
  function vehicleLight(ev) {
    const k = ev.t / ev.dur;
    const env = Math.min(1, k * 6, (1 - k) * 6);
    const { col, edge } = headColour(ev);
    const out = { beams: [], pools: [], lamps: [], strength: 0, col, edge, D: 70, cone: null, x: 0 };
    if (ev.kind === 'turn') {
      // 1) waiting at the give-way line facing the shop, creeping up;
      // 2) pulling forward into the road (closer to the shop: R and D fall 130 -> 85) while turning slowly, so the
      //    window's light slides across the back wall and every shadow wheels at its own depth;
      // 3) completing the turn quickly and swinging away.
      const wait = 0.194;
      const slow = 0.677;
      let th = 0;
      let pull = 0;
      if (k >= wait && k < slow) {
        const q = (k - wait) / (slow - wait);
        th = ev.dir * 0.85 * ease(q);
        pull = ease(q);
      } else if (k >= slow) {
        const q = (k - slow) / (1 - slow);
        th = ev.dir * (0.85 + (Math.PI / 2 - 0.85) * q * q); // ~45 deg/s; the beam's spot races off the window as tan(th)
        pull = 1;
      }
      const R = 130 - 45 * pull;
      const c = Math.cos(th);
      const approach = k < wait ? 0.6 + 0.4 * Math.pow(k / wait, 2) : 1;
      const envT = Math.min(1, k * 6); // a turning car's light doesn't fade out: it swings away
      const E = Math.min(1.3, approach * Math.pow(130 / R, 2) * 0.6 * Math.max(0, c) * Math.max(0, c)) * envT;
      const x = ev.jx + R * Math.tan(clamp(th, -1.35, 1.35));
      const stretch = 1 / Math.max(0.3, c * c);
      // brake squat: the nose lifts as it pulls away, tipping the cut-off up for a moment
      const squat = k > wait && k < wait + 0.1 ? 4 * Math.sin(((k - wait) / 0.1) * Math.PI) : 0;
      const cut = 147 - squat;
      const lampX = ev.jx + 55 * Math.sin(th);
      out.beams.push([x, cut, Math.min(170, 110 * stretch), 33, 0.95 * E, -1]);
      out.pools.push([x, 172, Math.min(160, 70 * stretch), 8, 0.5 * E]);
      out.lamps = [{ x: lampX - 26 * c, y: 150 }, { x: lampX + 26 * c, y: 150 }];
      out.strength = E;
      out.D = R;
      out.aim = x;
      out.kick = -1;
      out.cutY = ev.main ? null : cut; // on main beam there's no cut-off at all
      out.main = !!ev.main;
      out.lift = 12 * pull * (k < slow ? 1 : Math.max(0, 1 - (k - slow) / 0.1)); // the rear squats as it pulls away: the beam pitches up a little
      if (ev.main) out.beams[0] = [x, cut - 62, Math.min(200, 130 * stretch), 92, 1.1 * E, 0]; // a big, high pool
      out.cone = { x0: lampX, x1: x - 50 * stretch, x2: x + 50 * stretch, y: cut };
      out.x = ev.jx;
      return out;
    }
    const span = ev.kind === 'bike' ? 0.9 : 1;
    const x = ev.dir > 0 ? -70 + k * 460 * span : 390 - k * 460 * span;
    out.x = x;
    // traffic heading right is in the lane nearer the shop: closer, brighter, and its kick-up reaches the shopfront
    const nearLane = ev.dir > 0;
    out.D = nearLane ? 45 : 75;
    const lane = nearLane ? 1.5 : 1;
    if (ev.kind === 'bike') {
      const wob = Math.sin(ev.t * 6) * 3;
      out.beams.push([x + ev.dir * 60 + wob, 152, 34, 20, 0.3 * env * lane, 0]);
      out.pools.push([x - ev.dir * 6, 176, 6, 2, 0.3 * env, '#ff3a2a']);
      out.lamps = [{ x, y: 156 }];
      out.strength = 0.35 * env;
      out.D += 10;
      return out;
    }
    if (ev.kind === 'emergency') {
      // the UK double flash: on, off, on, then dark; alternating sides
      const cyc = ev.t % 0.5;
      const on = cyc < 0.08 || (cyc > 0.16 && cyc < 0.24);
      const side = Math.floor(ev.t / 0.5) % 2 ? 1 : -1;
      const blue = '#2f5bff';
      if (on) {
        out.pools.push([x + side * 40, 95, 150, 90, 0.75 * env, cyber() && side > 0 ? '#ff2a4a' : blue]);
        out.ledges = { col: cyber() && side > 0 ? '#ff2a4a' : blue, a: 0.8 * env };
        out.flash = { x: x + side * 40, col: cyber() && side > 0 ? '#ff2a4a' : blue, a: 0.5 * env };
      }
      out.beams.push([x + ev.dir * 120, 150, 110, 14, 0.45 * env * lane, nearLane ? ev.dir : 0]);
      out.lamps = [{ x, y: 150 }];
      out.strength = 0.5 * env;
      return out;
    }
    // cars and buses: dipped beams run along the road, so they only graze the shopfront in a long thin streak well
    // ahead of the car; the hot spot on the pavement; red tail-lights behind
    const big = ev.kind === 'bus';
    out.beams.push([x + ev.dir * 120, 150, big ? 130 : 120, 14, 0.5 * env * lane, nearLane ? ev.dir : 0]);
    out.kick = nearLane ? ev.dir : 0;
    out.pools.push([x + ev.dir * 50, 175, 60, 6, 0.4 * env * lane]);
    // front fog lamps (some drivers, and everyone in rain or fog): wide, with a low flat cut-off, lighting the stall-riser
    if (ev.seed < 0.3 || (B.world && ((B.world.weather.rain || 0) > 0.4 || (B.world.weather.fog || 0) > 0.4))) out.beams.push([x + ev.dir * 100, 152, 80, 14, 0.38 * env * lane, 0]);
    out.pools.push([x - ev.dir * (big ? 70 : 40), 171, big ? 26 : 18, 5, 0.26 * env, '#ff2a1a']);
    if (big) out.band = { x0: x - ev.dir * 10 - 70, x1: x - ev.dir * 10 + 70, a: 0.22 * env, col: cyber() ? '#cfe4ff' : '#ffe2a0' };
    out.lamps = [{ x: x + ev.dir * 10, y: 150 }];
    out.depthPair = true;
    out.strength = 0.55 * env * lane;
    out.cone = { x0: x + ev.dir * 10, x1: x + ev.dir * 40, x2: x + ev.dir * 220, y: 150 };
    return out;
  }

  // ---------- the steady lights ----------
  function acrossTheRoad(g, s, dark) {
    const h = s.hour;
    const t = now();
    if (cyber()) {
      const cols = ['#ff3fa4', '#3ff5ff', '#a26bff'];
      const c = cols[Math.floor(t / 3) % 3];
      const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
      // the giant sign high across the road: brightest up top, fading down the front
      const gr = g.createLinearGradient(0, 0, 0, 170);
      gr.addColorStop(0, rgba(c, 0.32 * dark * pulse));
      gr.addColorStop(0.6, rgba(c, 0.12 * dark * pulse));
      gr.addColorStop(1, rgba(c, 0.03 * dark * pulse));
      g.fillStyle = gr;
      g.fillRect(-20, 0, 360, 180);
      if (h >= 10 || h < 4) windowLight(g, 24, 104, '#ffb070', 0.32 * dark, 4);
      pool(g, 196, 174, 36, 6, '#3ff5ff', 0.2 + 0.2 * dark); // a vending machine's glow on the paving
      const ax = ((t * 6) % 420) - 50;
      pool(g, ax, 120, 50, 40, cols[(Math.floor(t / 3) + 1) % 3], 0.06 + 0.12 * dark);
    } else {
      if (h >= 11 && h < 23.4) windowLight(g, 24, 112, '#ffc070', 0.42 * dark, 4);
      if (h >= 11.5 && h < 22) windowLight(g, 186, 262, '#dcefff', 0.3 * dark * (Math.random() < 0.03 ? 0.4 : 1), 3);
      if (h >= 19 || h < 0.5) pool(g, 200, 34, 60, 24, '#7a9aff', dark * (0.06 + 0.08 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.7))));
    }
    // passing vehicles are between those lights and us, so they block them: a moving shadow edge
    g.save();
    g.globalCompositeOperation = 'destination-out';
    for (const ev of events) {
      if (ev.kind === 'turn') continue;
      const L = vehicleLight(ev);
      const half = ev.kind === 'bus' ? 70 : ev.kind === 'bike' ? 8 : 38;
      const top = ev.kind === 'bus' ? 40 : ev.kind === 'bike' ? 150 : 135;
      const gr = g.createLinearGradient(L.x - half - 10, 0, L.x + half + 10, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(10 / (2 * half + 20), 'rgba(0,0,0,0.85)');
      gr.addColorStop(1 - 10 / (2 * half + 20), 'rgba(0,0,0,0.85)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(L.x - half - 10, top, 2 * half + 20, H - top);
    }
    g.restore();
    // the street lamp on our corner lights the front around it, falling off with distance and angle (traffic is
    // behind it, so doesn't block it)
    if (lampOn(s, dark)) pool(g, 262, 120, 70, 60, cyber() ? '#cfe8ff' : '#ffd890', 0.3 * dark);
  }
  const lampOn = (s, dark) => (B.sunPos ? B.sunPos(s.hour).e < -2 : dark > 0.45) || (s.weather.fog || 0) > 0.5;

  // ---------- shadows thrown up the shopfront ----------
  // Parallax: an occluder `d` in front of the facade, lit from a source `D` in front of it, throws its shadow
  // (x - src) * d / (D - d) further along, stretched by D / (D - d) and leaning away from the light.
  function facadeShadows(g, s, L) {
    if (!L.lamps.length || L.strength < 0.08) return;
    const people = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.5));
    if (s.owner.area === 'street') people.push(s.owner);
    g.save();
    g.globalCompositeOperation = 'destination-out';
    L.lamps.forEach((lamp, li) => {
      g.globalAlpha = li === 0 ? 1 : 0.4; // a solid shadow, and a faint twin from the second lamp
      const D = L.D;
      for (const a of people) {
        const d = 6 + ((a.lane || 0) + 3) * 1.6; // the pavement lanes: nearer the kerb is further from the wall
        const shift = ((a.x - lamp.x) * d) / Math.max(4, D - d);
        const sy = clamp(D / Math.max(4, D - d), 1.2, 1.4); // a clear silhouette, 1.2-1.4x their height, head on the shopfront
        // projected onto a wall parallel to us, an upright figure stays upright: a plain scale, no lean
        B.drawSilhouette(g, a, a.x + shift, 166, 1 + (sy - 1) * 0.5, sy);
        // ...and the part of the shadow lying on the paving, from the feet to the foot of the wall
        g.fillStyle = '#000';
        g.beginPath();
        g.moveTo(a.x - 3, a.y);
        g.lineTo(a.x + 3, a.y);
        g.lineTo(a.x + shift + 3, 166);
        g.lineTo(a.x + shift - 3, 166);
        g.closePath();
        g.fill();
      }
      // the lamp post at the kerb: upright on the wall, with its stripe across the paving
      const dl = 30;
      const lx = 277 + ((277 - lamp.x) * dl) / Math.max(4, D - dl);
      g.fillStyle = '#000';
      g.fillRect(Math.round(lx) - 2, 10, 4, 156);
      g.beginPath();
      g.moveTo(275, 174);
      g.lineTo(279, 174);
      g.lineTo(lx + 2, 166);
      g.lineTo(lx - 2, 166);
      g.closePath();
      g.fill();
      if (s.shop.open) {
        const ax = 297 + ((297 - lamp.x) * 10) / Math.max(4, D - 10);
        g.fillRect(Math.round(ax) - 17, 140, 34, 26);
      }
    });
    g.restore();
  }

  // ---------- light through the windows, and the shadows it throws inside ----------
  const COUNTER_FRONT = { x: 136, y: 129, w: 72, h: 15 }; // the part seen through the glass
  const SHOP = {
    aperture: () => [B.LAYOUT.win],
    receivers: () => [
      { Z: 40, rects: [B.LAYOUT.win], minus: [COUNTER_FRONT], reveal: true },
      { Z: 12, rects: [COUNTER_FRONT], reveal: true },
    ],
    occluders: () => [[76, 76, 2, 8, 0], [144, 76, 2, 8, 0], [9, 84, 202, 2, 0]], // glazing bars
    masks: (s) => propMasks(s),
    people: (s) => {
      const list = s.npcs.filter((n) => n.area === 'inside' && !n.hidden && n.depth !== 'passage');
      if (s.owner.area === 'inside' && !s.owner.hidden && s.owner.depth !== 'passage') list.push(s.owner);
      const out = list.map((a) => [a, a.depth === 'back' ? 22 : 9]);
      // and the passers-by on the pavement, in front of the glass (negative depth): between a car's lamps and the
      // window, they throw the biggest shadows of all across the shelves
      for (const a of s.npcs.concat(s.owner.area === 'street' ? [s.owner] : [])) {
        if (a.area !== 'street' || a.hidden || (a.alpha != null && a.alpha < 0.5)) continue;
        out.push([a, -(6 + ((a.lane || 0) + 3) * 1.6)]);
      }
      return out;
    },
  };
  const FLAT = {
    receivers: () => [{ Z: 22, rects: B.LAYOUT.upstairs, reveal: false }],
    aperture: (s) =>
      B.LAYOUT.upstairs.map((u) => {
        const bh = Math.round(3 + s.upstairs.blind * (u.h - 3)); // the blind blocks the top of the window
        return { x: u.x, y: u.y + bh, w: u.w, h: u.h - bh };
      }),
    occluders: () => [[70, 28, 16, 13, 14], [44, 27, 6, 20, 8], [57, 37, 5, 10, 6], [176, 38, 19, 9, 18], [158, 20, 10, 12, 20]],
    people: (s) => (s.owner.area === 'upstairs' && !s.owner.hidden ? [[s.owner, 10]] : []),
  };

  // The shop's props rendered (by the current theme) into one mask per depth layer, once per frame.
  const LAYERS = [
    { z: 4, parts: ['drawDisplay'], decor: ['interior-front'] }, // the window display (plant, book stand, stacks), the cat in the window
    { z: 13, parts: ['drawCounterItems'], decor: ['counter'] }, // the counter and everything on it, including the cat
    { z: 20, parts: ['drawPendants'] }, // the hanging lamps
    { z: 34, parts: ['drawRadio', 'drawCoffee', 'drawClock'] }, // against the back wall
  ];
  let maskT = -1;
  const masks = [];
  function propMasks(s) {
    if (maskT === s.simT && masks.length) return masks;
    maskT = s.simT;
    LAYERS.forEach((L, i) => {
      if (!masks[i]) {
        const [c, g] = mk();
        masks[i] = { z: L.z, c, g };
      }
      const m = masks[i];
      if (!m.g) return;
      m.g.clearRect(0, 0, W, H);
      for (const name of L.parts) {
        try {
          const fn = B.part && B.part(name);
          if (fn) fn(m.g, s);
        } catch (e) {
          /* a prop that can't be drawn just casts no shadow */
        }
      }
      if (L.decor && B.renderKit) for (const layer of L.decor) B.renderKit.decor(m.g, s, layer);
    });
    return masks;
  }

  // The scene's true colours before darkening: the shop interior (taken mid-frame by render.js), and the street.
  const snaps = {};
  const snapper = (key) => (g) => {
    if (!g.canvas || !g.canvas.width) return;
    if (!snaps[key]) snaps[key] = mk();
    const [, sgx] = snaps[key];
    if (!sgx) return;
    sgx.clearRect(0, 0, W, H);
    sgx.drawImage(g.canvas, 0, 0);
    snaps[key].ok = true;
  };
  B.snapInterior = snapper('in');
  B.snapExterior = snapper('out');
  B._lightDebug = () => ({ lm, snaps, vc, sc });

  /** Composite a light canvas onto the scene: reveal the snapshot's colours tinted by the light, plus a little glare. */
  function reveal(g, light, snapKey, glare = 0.12, strength = 0.92, gAdd = g, mesopic = false, tint = null, R = null) {
    const sn = snaps[snapKey];
    if (sn && sn.ok && rg) {
      rg.globalCompositeOperation = 'source-over';
      rg.clearRect(0, 0, W, H);
      rg.save();
      if (R) {
        rg.beginPath();
        rg.rect(R.x, R.y, R.w, R.h);
        rg.clip();
      }
      rg.globalCompositeOperation = 'source-over';
      rg.clearRect(0, 0, W, H);
      rg.drawImage(sn[0], 0, 0);
      if (mesopic) {
        // dim light is seen mostly by the rods: colour drains, reds sink, blue-greens hold
        rg.globalCompositeOperation = 'saturation';
        rg.globalAlpha = 0.25;
        rg.fillStyle = '#808080';
        rg.fillRect(0, 0, W, H);
        rg.globalAlpha = 1;
        rg.globalCompositeOperation = 'multiply';
        rg.fillStyle = '#ecdfd2';
        rg.fillRect(0, 0, W, H);
      }
      if (tint) {
        rg.globalCompositeOperation = 'multiply';
        rg.fillStyle = tint;
        rg.fillRect(0, 0, W, H);
      }
      rg.globalCompositeOperation = 'multiply';
      rg.drawImage(light, 0, 0);
      rg.globalCompositeOperation = 'destination-in';
      rg.drawImage(light, 0, 0);
      rg.globalCompositeOperation = 'source-over';
      rg.restore();
      g.globalAlpha = strength;
      g.drawImage(rc, 0, 0);
      g.globalAlpha = 1;
    }
    if (glare > 0) {
      gAdd.globalCompositeOperation = 'lighter';
      gAdd.globalAlpha = glare;
      gAdd.drawImage(light, 0, 0);
      gAdd.globalAlpha = 1;
      gAdd.globalCompositeOperation = 'source-over';
    }
  }

  const motes = Array.from({ length: 18 }, (_, i) => ({ x: (i * 53) % 200, y: (i * 37) % 60, v: 0.5 + (i % 5) * 0.2 }));

  /** Shine one light through a room's windows onto each of its surfaces, shadows and all.
   *  src: { x, y, D, col, a, aim?, lamps?: [dx...], soft? } */
  function project(g, s, src, room, gAdd = g) {
    if (!pg || src.a < 0.01) return;
    const lit = s.shop.lights;
    // the source as one or more points: a car's two headlamps; a broad window as a spread of points (soft shadows)
    const pts = src.soft ? (src.compact ? [[-6, 0], [6, 0]] : [[-18, 0], [18, 0]]) : src.pair === 'across' ? [[-26, 0], [26, 0]] : src.pair === 'depth' ? [[0, 0], [0, 14]] : [[0, 0]];
    const passA = src.soft ? 0.5 : src.pair ? 0.6 : 1; // soft: a solid core where both points are blocked, one clean penumbra step
    for (const rcv of room.receivers(s)) {
      const Z = rcv.Z;
      const at = (x, y, z, ox = 0, dD = 0) => {
        const m = (Z + src.D + dD) / (z + src.D + dD);
        const sx = src.x + ox;
        return [sx + (x - sx) * m, src.y + (y - src.y) * m, m];
      };
      // all the work happens in software: confine it to this surface's own rectangle
      const RB = bbox(rcv.rects);
      pg.clearRect(0, 0, W, H);
      pg.save();
      pg.beginPath();
      pg.rect(RB.x, RB.y, RB.w, RB.h);
      pg.clip();
      pg.globalCompositeOperation = 'source-over';
      let patch = null;
      for (const ap of room.aperture(s)) {
        if (ap.h <= 0) continue;
        const [x1, y1] = at(ap.x, ap.y, 0);
        const [x2, y2] = at(ap.x + ap.w, ap.y + ap.h, 0);
        patch = [x1, y1, x2, y2];
        if (src.aim != null && src.main) {
          // main beam: no cut-off, so the window's shape (bars and all) prints on the wall, shaped by the lamp's own
          // beam profile: a hotspot on its axis at lamp height, falling away over ~10 degrees each side. The cel bands
          // turn that into a framed print with hard steps, sliding across the shelves as the car turns.
          const [cxw, cyw0] = at(src.aim, 150, 0);
          const cyw = cyw0 - (src.lift || 0) * 2; // pulling away, the squat pitches the beam up: the hotspot climbs onto the shelves
          const amax = cyber() ? Math.min(0.5, src.a) : src.a;
          pg.save();
          pg.beginPath();
          pg.rect(Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1));
          pg.clip();
          pg.translate(cxw, cyw);
          pg.scale(1, 0.5);
          const gr = pg.createRadialGradient(0, 0, 0, 0, 0, 90 * 1.6);
          // stops measured against a real main beam: ~50% at 6 deg, ~25% at 10 deg, below the lowest band past ~16 deg
          gr.addColorStop(0, rgba(src.col, amax));
          gr.addColorStop(0.32, rgba(src.col, amax * 0.9));
          gr.addColorStop(0.5, rgba(src.col, amax * 0.45));
          gr.addColorStop(0.85, rgba(src.col, 0));
          pg.fillStyle = gr;
          pg.fillRect(-300, -300, 600, 600);
          if (cyber()) {
            // the neon city's beams: a magenta edge on the leading arc only
            const lead = (src.dir || 1) > 0 ? 0 : Math.PI;
            pg.strokeStyle = rgba('#ff6ad5', amax * 0.7);
            pg.lineWidth = 6;
            pg.beginPath();
            pg.arc(0, 0, 90 * 1.6 * 0.55, lead - Math.PI / 3, lead + Math.PI / 3);
            pg.stroke();
          }
          pg.restore();
          continue;
        } else if (src.aim != null) {
          // a headlight's beam: bright core, firm edge, dark beyond (in the neon city the edge carries colour)
          const gr = pg.createRadialGradient(src.aim, (y1 + y2) / 2, 4, src.aim, (y1 + y2) / 2, 78);
          gr.addColorStop(0, rgba(src.col, src.a));
          gr.addColorStop(0.6, rgba(src.col, src.a * 0.85));
          gr.addColorStop(0.85, rgba(src.edge || src.col, src.a * 0.3));
          gr.addColorStop(1, rgba(src.edge || src.col, 0));
          pg.fillStyle = gr;
        } else pg.fillStyle = rgba(src.col, src.a);
        if (src.soft && !src.compact) {
          // a broad source: the window's edges blur over ~12px, like its shadows
          const fs = pg.fillStyle;
          pg.globalAlpha = 0.2;
          for (const [ox, oy] of [[-12, 0], [0, 0], [12, 0], [0, -8], [0, 8]]) {
            pg.fillStyle = fs;
            pg.fillRect(Math.round(x1) + ox, Math.round(y1) + oy, Math.round(x2 - x1), Math.round(y2 - y1));
          }
          pg.globalAlpha = 1;
        } else pg.fillRect(Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1));
      }
      if (!patch) {
        pg.restore();
        continue;
      }
      // a dipped headlight: above its cut-off (just under the window) only stray light gets in, except the kick-up
      // wedge climbing diagonally on the nearside. Shape that on the glass, then project it like everything else.
      if (src.aim != null && src.cutY != null) {
        const aimX = src.aim;
        const cy = src.cutY;
        const rise = 0.27 * 1.6;
        const k = src.kick || 0;
        const far = 400;
        const p1 = at(aimX, cy, 0);
        const p2 = k ? at(aimX + k * far, cy - far * rise, 0) : at(aimX + far, cy, 0);
        const p3 = at(aimX - (k || 1) * far, cy, 0);
        pg.save();
        pg.globalCompositeOperation = 'destination-out';
        pg.fillStyle = 'rgba(0,0,0,0.8)';
        pg.beginPath();
        // everything above the cut-off line (and above the kick-up edge on the nearside)
        pg.moveTo(p3[0], p3[1]);
        pg.lineTo(p1[0], p1[1]);
        pg.lineTo(p2[0], p2[1]);
        pg.lineTo(p2[0], -50);
        pg.lineTo(p3[0], -50);
        pg.closePath();
        pg.fill();
        pg.restore();
      }
      // the patch before any shadows: shadows inside it are the lowest band, cool and partly lit (bounce), not black
      bgx.clearRect(0, 0, W, H);
      bgx.drawImage(pc, 0, 0);
      // cut out the shadows of everything between the glass and this surface, once per point of the source
      pg.imageSmoothingEnabled = true; // magnified masks get clean edges (the bands snap them back to the grid)
      pg.globalCompositeOperation = 'destination-out';
      pg.fillStyle = '#000';
      (F.propShadows ? pts : []).forEach(([ox, dD], pi) => {
        const pa = src.pair && pi > 0 ? 0.4 : passA; // the second headlamp's shadow is a faint echo
        pg.globalAlpha = pa;
        for (const [x, y, w, h, z] of room.occluders()) {
          if (z >= Z - 1) continue;
          pg.globalAlpha = z === 0 && room === SHOP ? passA * 0.7 : passA; // glazing bars: a soft-toned line, not black
          const [x1, y1] = at(x, y, z, ox, dD);
          const [x2, y2] = at(x + w, y + h, z, ox, dD);
          pg.fillRect(Math.round(x1), Math.round(y1), Math.min(3, Math.max(1, Math.round(x2 - x1))), Math.max(1, Math.round(y2 - y1)));
        }
        pg.globalAlpha = passA;
        if (room.masks) {
          if (src.main) pg.globalAlpha = pi > 0 ? 0.4 : 0.9;
          for (const mk2 of room.masks(s)) {
            if (!mk2.g || mk2.z >= Z - 1) continue;
            const m = (Z + src.D + dD) / (mk2.z + src.D + dD);
            const sx = src.x + ox;
            pg.drawImage(mk2.c, Math.round(sx - sx * m), Math.round(src.y - src.y * m), Math.round(W * m), Math.round(H * m));
          }
        }
        pg.globalAlpha = pa;
        for (const [a2, z] of room.people(s)) {
          if (z >= Z - 1 || z <= -(src.D + dD) + 4) continue;
          if (z < 0 && src.y < B.headTop(a2)) continue; // a light above their head throws their shadow on the ground, not into the shop
          let [fx, fy, m] = at(a2.x, a2.y, z, ox, dD);
          if (m > 2.2) {
            // clamp the magnification (keep the head on the wall), keeping the shadow centred where it falls
            const k2 = 2.2 / m;
            const [cx2, cy2] = at(a2.x, a2.y - 30, z, ox, dD);
            fx = cx2 + (fx - cx2) * k2;
            fy = cy2 + (fy - cy2) * k2;
            m = 2.2;
          }
          if (z < 0) pg.globalAlpha = pi > 0 ? 0.35 : 0.6; // a person outside: their own lamp's shadow, then a faint echo
          B.drawSilhouette(pg, a2, fx, fy, m, m);
          pg.globalAlpha = pa;
        }
      });
      pg.globalAlpha = 1;
      pg.globalCompositeOperation = 'source-over';
      pg.imageSmoothingEnabled = false;
      pg.restore();
      if (F.bands) quantise(pg, 3, 0.8, true, RB);
      const clipTo = (c) => {
        c.save();
        c.beginPath();
        for (const r of rcv.rects) c.rect(r.x, r.y, r.w, r.h);
        for (const r of rcv.minus || []) c.rect(r.x, r.y, r.w, r.h);
        c.clip('evenodd');
      };
      clipTo(g);
      if (gAdd !== g) clipTo(gAdd);
      if (F.quietShadows && F.propShadows && rcv.reveal && !lit && src.a > 0.12 && mainCanvas && tgx && fgx && hgx) {
        // painterly: inside a shadow, texture quietens to the local mean colour (book spines become one dark mass), so
        // the silhouette reads as a shape rather than dissolving into the shelves behind it
        // (the uncut patch needs no banding of its own: it only masks where the shadows are)
        fgx.globalCompositeOperation = 'source-over';
        fgx.clearRect(0, 0, W, H);
        fgx.drawImage(bc, 0, 0);
        fgx.globalCompositeOperation = 'destination-out';
        fgx.drawImage(pc, 0, 0);
        fgx.globalCompositeOperation = 'source-over';
        if (quietT !== s.simT || quietFrame !== frameNo) {
          // the scene's local mean colours, worked out once a frame
          quietT = s.simT;
          quietFrame = frameNo;
          tgx.imageSmoothingEnabled = true;
          tgx.clearRect(0, 0, tc.width, tc.height);
          tgx.drawImage(mainCanvas, 0, 0, W, H, 0, 0, tc.width, tc.height);
        }
        hgx.globalCompositeOperation = 'source-over';
        hgx.imageSmoothingEnabled = true;
        hgx.clearRect(0, 0, W, H);
        hgx.drawImage(tc, 0, 0, tc.width, tc.height, 0, 0, W, H);
        hgx.globalCompositeOperation = 'destination-in';
        hgx.drawImage(fc, 0, 0);
        hgx.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.3 + 0.35 * clamp(darkNow, 0, 1); // the dark-adapted eye resolves less detail in deep shadow
        g.drawImage(hc, 0, 0);
        g.globalAlpha = 1;
      }
      if (src.gain && rcv.reveal && F.reveal && mainCanvas && rg) {
        // sunlight: the surfaces' own colour times the light (albedo x E), so the books keep their saturation:
        // the scene as it is now, multiplied by the patch, added back on top
        rg.globalCompositeOperation = 'source-over';
        rg.clearRect(0, 0, W, H);
        rg.save();
        if (RB) {
          rg.beginPath();
          rg.rect(RB.x, RB.y, RB.w, RB.h);
          rg.clip();
        }
        rg.drawImage(mainCanvas, 0, 0);
        rg.globalCompositeOperation = 'multiply';
        if (src.colGain) {
          // a paler light: the patch lifts value more than it tints
          rg.fillStyle = src.colGain;
          rg.fillRect(0, 0, W, H);
        } else rg.drawImage(pc, 0, 0);
        rg.globalCompositeOperation = 'destination-in';
        rg.drawImage(pc, 0, 0);
        rg.restore();
        rg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.min(1, src.gain);
        g.drawImage(rc, 0, 0);
        if (src.gain > 1) {
          g.globalAlpha = Math.min(1, src.gain - 1);
          g.drawImage(rc, 0, 0);
        }
        gAdd.globalCompositeOperation = 'lighter';
        gAdd.globalAlpha = 0.08;
        gAdd.drawImage(pc, 0, 0);
        g.globalAlpha = gAdd.globalAlpha = 1;
        g.globalCompositeOperation = gAdd.globalCompositeOperation = 'source-over';
      } else if (rcv.reveal && !lit && F.reveal) {
        // while a strong beam is in, the rest of the room drops into deep cool shadow, so the lit patch reads
        if (src.aim != null && src.a > 0.15) {
          // light bounced off the lit patch fills the room a little (in the beam's colour)
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = rgba(src.col, 0.035 * src.a);
          for (const r of rcv.rects) g.fillRect(r.x, r.y, r.w, r.h);
          g.globalCompositeOperation = 'source-over';
        }
        reveal(g, pc, 'in', src.aim != null ? 0.3 : src.blue ? 0.12 : 0, 0.95, gAdd, !!src.floor, src.blue ? '#6f8fff' : null, RB); // glare only from bright point sources
      } else {
        gAdd.globalCompositeOperation = 'lighter';
        gAdd.globalAlpha = lit ? 0.45 : 0.9;
        gAdd.drawImage(pc, 0, 0);
        gAdd.globalAlpha = 1;
      }
      // dust drifting in a strong beam
      if (rcv.reveal && (src.a > 0.35 || (src.motes && src.a > 0.12))) {
        const g0 = g;
        g = gAdd;
        g.globalCompositeOperation = 'lighter';
        const t = now();
        const [x1, y1, x2, y2] = patch;
        for (const d of motes) {
          const x = x1 + (((d.x + t * 3 * d.v) % 200) / 200) * (x2 - x1);
          const y = y1 + (((d.y + t * 2 * d.v) % 60) / 60) * (y2 - y1);
          g.fillStyle = rgba(src.col, 0.3 * src.a * (0.5 + 0.5 * Math.sin(t * 2 + d.x)));
          g.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
        g = g0;
      }
      g.restore();
      g.globalCompositeOperation = 'source-over';
      if (gAdd !== g) {
        gAdd.restore();
        gAdd.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** The lights behind us that shine through the windows. */
  function lightsBehind(s, dark) {
    const list = [];
    const steady = F.steadyLights;
    const h = s.hour;
    const t = now();
    if (!steady) {
      /* steady lights off */
    } else if (cyber()) {
      const cols = ['#ff3fa4', '#3ff5ff', '#a26bff'];
      list.push({ x: 140, y: -40, D: 200, compact: true, col: cols[Math.floor(t / 3) % 3], a: 0.15 * dark * (0.75 + 0.25 * Math.sin(t * 2.2)), soft: true });
      if (h >= 10 || h < 4) list.push({ x: 64, y: 150, D: 180, col: '#ffb070', a: 0.14 * dark, soft: true, floor: true });
      if (lampOn(s, dark)) list.push({ x: 277, y: 13, D: 22, col: '#cfe8ff', a: 0.3 * dark });
    } else {
      if (h >= 11 && h < 23.4) list.push({ x: 68, y: 150, D: 180, col: '#ffb860', a: 0.17 * dark, soft: true, floor: true });
      if (h >= 11.5 && h < 22) list.push({ x: 224, y: 150, D: 180, col: '#dcefff', a: 0.07 * dark * (Math.random() < 0.03 ? 0.4 : 1), soft: true });
      if (lampOn(s, dark)) list.push({ x: 277, y: 15, D: 22, col: '#ffd890', a: 0.3 * dark });
    }
    let headlights = 0;
    for (const ev of events) {
      const L = vehicleLight(ev);
      if (L.flash) list.push({ x: L.flash.x, y: 120, D: 75, col: L.flash.col, a: Math.min(0.45, L.flash.a) * dark, soft: true, compact: true, blue: true });
      if (L.band) list.push({ x: (L.band.x0 + L.band.x1) / 2, y: 55, D: L.D, col: L.band.col, a: L.band.a * 0.8 * dark, soft: true });
      if (!L.lamps.length || L.strength < 0.05) continue;
      const lx = L.lamps.reduce((n, l) => n + l.x, 0) / L.lamps.length;
      const a = Math.min(0.95, 1.1 * L.strength) * (0.15 + 0.85 * dark);
      headlights = Math.max(headlights, a);
      list.push({ x: lx, y: L.lamps[0].y, D: L.D, col: L.col, edge: L.edge, a, aim: L.aim != null ? L.aim : lx + 80 * ev.dir, pair: ev.kind === 'turn' ? 'across' : L.depthPair ? 'depth' : null, dir: ev.dir, lift: L.lift || 0, kick: L.kick || 0, cutY: L.main ? null : L.cutY || 150, main: L.main });
    }
    exposureTarget = 1 - 0.4 * Math.min(1, headlights);
    list.sort((a, b) => b.a - a.a);
    return list.slice(0, 3);
  }

  // ---------- rain and fog ----------
  /** Wet paving: streaky vertical reflections of every visible light. */
  function rainReflections(g, s, dark, vls) {
    const wet = Math.max(s.weather.rain || 0, 0);
    if (wet < 0.25 || dark < 0.2) return;
    const t = now();
    const streak = (x, col, a, len = 13) => {
      // a broken vertical reflection: 2-3 dashes, shimmering with the rain
      for (let i = -1; i <= 1; i++) {
        let y = 166 + ((x * 7) & 3);
        const total = Math.round(len * (0.75 + 0.35 * Math.sin(t * 6 + x * 3 + i)));
        const end = Math.min(179, y + total);
        g.fillStyle = rgba(col, Math.min(0.85, a * (i === 0 ? 1.6 : 0.7)));
        let on = true;
        while (y < end) {
          const seg = on ? 3 + ((x + y + i) & 3) : 1 + ((x * 3 + y) & 1);
          if (on) g.fillRect(Math.round(x) + i, y, i === 0 ? 2 : 1, Math.min(seg, end - y));
          y += seg;
          on = !on;
        }
      }
    };
    g.globalCompositeOperation = 'lighter';
    const k = wet * dark;
    if (lampOn(s, dark)) streak(277, cyber() ? '#cfe8ff' : '#ffe0a0', 0.5 * k, 12);
    if (s.shop.lights) for (let x = 20; x < 210; x += 18) streak(x, cyber() ? '#9ad8ff' : '#ffd090', 0.95 * k, 13);
    if (cyber()) for (let x = 36; x < 240; x += 14) streak(x, '#ff3fa4', 0.75 * k, 13);
    g.globalCompositeOperation = 'source-over';
  }
  /** Fog: the beams themselves become visible in the air between the lamps and where they land. */
  function fogCones(g, s, vls) {
    const fog = s.weather.fog || 0;
    if (fog < 0.1) return;
    g.globalCompositeOperation = 'lighter';
    for (const L of vls) {
      if (!L.cone || L.strength < 0.05) continue;
      const c = L.cone;
      const gr = g.createLinearGradient(0, 180, 0, c.y);
      gr.addColorStop(0, rgba(L.col, 0.16 * fog * L.strength));
      gr.addColorStop(1, rgba(L.col, 0.03 * fog * L.strength));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(c.x0 - 10, 180);
      g.lineTo(c.x0 + 10, 180);
      g.lineTo(c.x2, c.y);
      g.lineTo(c.x1, c.y);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  // ---------- exposure ----------
  // Your eyes adapt to a bright beam: everything (beam included) is scaled by one exposure, which drops quickly
  // when a beam arrives and recovers slowly after it's gone.
  let exposure = 1;
  let exposureTarget = 1;
  let lastT = 0;
  function adapt() {
    const t = now();
    const dt = lastT ? clamp(t - lastT, 0, 0.2) : 0; // (never negative: tests freeze and restore the clock)
    if (!Number.isFinite(exposure)) exposure = 1;
    lastT = t;
    if (B._lightAdaptInstant) return (exposure = exposureTarget); // for test renders
    const tau = exposureTarget < exposure ? 0.25 : 1.5;
    exposure += (exposureTarget - exposure) * (1 - Math.exp(-dt / tau));
    return exposure;
  }

  Object.assign(B.lightKit, {
    project: (g, s, src, room, gAdd) => {
      if (ensure()) project(g, s, src, room, gAdd);
    },
    SHOP,
    FLAT,
    quantise,
    reveal,
    rgba,
    pool,
    mk,
    snaps,
    setMain: (c) => (mainCanvas = c),
  });

  // ---------- each frame ----------
  B.decor({
    id: 'offscreen-lights',
    layer: 'overlay',
    draw(g, s) {
      const day = B.daylight(s.hour);
      const dark = Math.min(1, (1 - day) * 1.1 + (s.weather.cloud || 0) * 0.15);
      const fog = s.weather.fog || 0;
      const wet = s.weather.rain || 0;
      if (!ensure()) return;
      mainCanvas = g.canvas || null;
      frameNo++;
      darkNow = Math.min(1, (1 - B.daylight(s.hour)) * 1.1);
      const surf = Math.exp(-1.2 * fog); // fog scatters light out of the beams before it reaches a surface
      const vls = F.headlights ? events.map((ev) => Object.assign(vehicleLight(ev), { ev })) : [];
      lg.clearRect(0, 0, W, H);
      if (dark > 0.05) {
        // the steady lights (occluded by passing vehicles)
        sg2.clearRect(0, 0, W, H);
        sg2.globalCompositeOperation = 'source-over';
        if (F.steadyLights) acrossTheRoad(sg2, s, dark);
        lg.globalCompositeOperation = 'lighter';
        lg.globalAlpha = surf;
        lg.drawImage(sc, 0, 0);
        lg.globalAlpha = 1;
        // each vehicle: its beams and pools, then its own shadows, then into the light map
        const k = 0.15 + 0.85 * dark;
        for (const L of vls) {
          vg.globalCompositeOperation = 'source-over';
          vg.clearRect(0, 0, W, H);
          for (const [x, y, hw, depth, a, kick] of L.beams) dippedBeam(vg, x, y, hw, depth, L.col, a * k * surf, kick, L.edge);
          for (const [x, y, rx, ry, a, col] of L.pools) pool(vg, x, y, rx, ry, col || L.col, a * k * surf * (col === undefined && wet > 0.3 ? 0.5 : 1));
          if (L.band) {
            // a bus's lit windows: one continuous band with faint pillars, sliding along the upper floor
            const b = L.band;
            const bgr = vg.createLinearGradient(0, 44, 0, 56);
            bgr.addColorStop(0, rgba(b.col, 0));
            bgr.addColorStop(1, rgba(b.col, b.a * 1.4 * k));
            vg.fillStyle = bgr;
            vg.fillRect(Math.round(b.x0), 44, Math.round(b.x1 - b.x0), 24);
            vg.globalCompositeOperation = 'destination-out';
            vg.fillStyle = 'rgba(0,0,0,0.25)';
            for (let x = b.x0 + 14; x < b.x1; x += 17) vg.fillRect(Math.round(x), 50, 2, 18); // window pillars, softly
            vg.globalCompositeOperation = 'source-over';
          }
          if (L.ledges) {
            // the beacon (~2 m up) lights the undersides of everything that projects above it, and the top of the sill
            // below it; strongest near the vehicle
            const fx = L.flash ? L.flash.x : L.x;
            const gr = vg.createLinearGradient(fx - 160, 0, fx + 160, 0);
            gr.addColorStop(0, rgba(L.ledges.col, L.ledges.a * 0.15));
            gr.addColorStop(0.375, rgba(L.ledges.col, L.ledges.a));
            gr.addColorStop(0.625, rgba(L.ledges.col, L.ledges.a));
            gr.addColorStop(1, rgba(L.ledges.col, L.ledges.a * 0.15));
            vg.fillStyle = gr;
            for (const [x0, y0, w0] of [[0, 73, 274], [6, 74, 208], [222, 74, 44], [9, 86, 202], [4, 144, 212]]) vg.fillRect(x0, y0, w0, 1);
            // and a wash over the faces turned towards the beacon: the stall-riser and the door
            vg.globalAlpha = 0.3;
            vg.fillRect(6, 148, 208, 16);
            vg.fillRect(226, 92, 36, 72);
            vg.globalAlpha = 1;
            for (const u of B.LAYOUT.upstairs) vg.fillRect(u.x - 4, u.y + u.h + 5, u.w + 8, 1);
          }
          if (L.strength > 0.25) {
            const bx = L.aim != null ? L.aim : L.x + (L.ev.dir || 1) * 60;
            vg.fillStyle = rgba(L.col, 0.06 * L.strength * k);
            vg.fillRect(Math.round(bx - 90), 72, 180, 4);
            if (bx > 160 && bx < 330) vg.fillRect(226, 92, 36, 8);
          }
          if (dark > 0.3 && F.facadeShadows) facadeShadows(vg, s, L);
          lg.globalCompositeOperation = 'lighter';
          lg.drawImage(vc, 0, 0);
        }
        lg.globalCompositeOperation = 'source-over';
        // exposure applies to everything: the scene itself dims a little as your eyes adjust to a beam...
        const e = F.exposure ? adapt() : 1;
        if (e < 0.995) {
          g.save();
          g.beginPath();
          g.rect(0, 8, 280, H - 8);
          g.clip();
          g.fillStyle = rgba(cyber() ? '#06040e' : '#05070e', Math.min(0.3, (1 - e) * 0.75));
          g.fillRect(0, 0, W, H);
          g.restore();
        }
        // ...and so does every light
        if (e < 0.995) {
          lg.globalCompositeOperation = 'destination-out';
          lg.fillStyle = `rgba(0,0,0,${1 - e})`;
          lg.fillRect(0, 0, W, H);
          lg.globalCompositeOperation = 'source-over';
        }
        if (F.bands) quantise(lg, 5, 0.66);
        // onto the building and pavement (not the sky, and not the windows: light through those is projected)
        g.save();
        g.beginPath();
        g.rect(0, 8, 280, H - 8);
        const Wn = B.LAYOUT.win;
        g.rect(Wn.x, Wn.y, Wn.w, Wn.h);
        for (const u of B.LAYOUT.upstairs) g.rect(u.x, u.y, u.w, u.h);
        // things that glow by themselves (the neon fascia, the lit door number, the pylon's screen) only ever gain light
        if (cyber()) for (const [x0, y0, w0, h0] of [[0, 52, 274, 21], [227, 77, 34, 12], [271, 58, 13, 26]]) g.rect(x0, y0, w0, h0);
        g.clip('evenodd');
        const actors = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.3));
        if (s.owner.area === 'street') actors.push(s.owner);
        lg.save();
        lg.globalCompositeOperation = 'destination-out';
        for (const a of actors) B.drawSilhouette(lg, a, a.x, a.y, 1, 1);
        lg.restore();
        if (F.reveal) reveal(g, lm, 'out', 0.15, 1);
        else {
          g.globalCompositeOperation = 'lighter';
          g.drawImage(lm, 0, 0);
          g.globalCompositeOperation = 'source-over';
        }
        g.restore();
        // anyone a strong beam sweeps over catches it: one flat level in the beam's colour, keyed on their front
        for (const L of F.actorLight ? vls : []) {
          if (L.strength < 0.2) continue;
          const bx = L.aim != null ? L.aim : L.x + (L.ev.dir || 1) * 60;
          const half = L.main ? 100 : 70;
          for (const a of actors) {
            if (Math.abs(a.x - bx) > half) continue;
            rg.globalCompositeOperation = 'source-over';
            rg.clearRect(0, 0, W, H);
            B.drawSilhouette(rg, a, a.x, a.y, 1, 1);
            rg.globalCompositeOperation = 'source-in';
            rg.fillStyle = rgba(L.col, 1);
            rg.fillRect(0, 0, W, H);
            rg.globalCompositeOperation = 'source-over';
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = Math.min(0.22, 0.22 * L.strength * dark);
            g.drawImage(rc, 0, 0);
            g.globalAlpha = 1;
            g.globalCompositeOperation = 'source-over';
          }
        }
        // each person lit flat (one level, no dither) by the light where they stand
        if (F.actorLight && lmAlpha && snaps.out && snaps.out.ok) {
          for (const a of actors) {
            const ix = clamp(Math.round(a.x), 0, W - 1);
            let lv = 0;
            for (const yy of [a.y - 8, a.y - 30, a.y - 50]) lv = Math.max(lv, lmAlpha[clamp(Math.round(yy), 0, H - 1) * W + ix] || 0);
            lv = Math.min(0.66, lv / 255);
            if (lv < 0.08) continue;
            lv = Math.round(lv * 4) / 4; // one of the same few levels
            rg.globalCompositeOperation = 'source-over';
            rg.clearRect(0, 0, W, H);
            B.drawSilhouette(rg, a, a.x, a.y, 1, 1);
            rg.globalCompositeOperation = 'source-in';
            rg.drawImage(snaps.out[0], 0, 0);
            rg.globalCompositeOperation = 'source-over';
            g.globalAlpha = lv * 0.85;
            g.drawImage(rc, 0, 0);
            g.globalAlpha = 1;
          }
        }
        // through the windows
        const indoorDark = s.shop.lights ? 0.35 : 1;
        qg.clearRect(0, 0, W, H);
        ag.clearRect(0, 0, W, H);
        const behind = F.projection ? lightsBehind(s, dark) : [];
        for (const src of behind) {
          project(qg, s, Object.assign({}, src, { a: src.a * indoorDark * surf * (src.floor ? 0.6 + 0.4 * exposure : exposure) }), SHOP, ag);
          project(qg, s, Object.assign({}, src, { a: src.a * (s.upstairs.light ? 0.4 : 1) * (src.y > 150 ? 0.6 : 1) * surf * exposure }), FLAT, ag);
        }
        // the unlit shop window is a dark mirror: a sharp, faint image of the lit windows across the road
        if (!s.shop.lights && F.mirror && !(B.oppositeStreet && F.streetLife)) { // (superseded by the reflected street)
          const rf = 0.12 * dark * exposure;
          const mirror = (x0, x1, col) => {
            // 4 x 2 panes, drawn separately so the bars between them are simply gaps (the glare canvas is shared)
            ag.fillStyle = rgba(col, rf);
            const pw = (x1 - x0) / 4;
            for (let i = 0; i < 4; i++)
              for (const [py, ph] of [[98, 16], [116, 18]]) ag.fillRect(Math.round(x0 + i * pw) + (i ? 2 : 0), py, Math.round(pw) - (i ? 2 : 0), ph);
          };
          ag.save();
          ag.beginPath();
          ag.rect(Wn.x, Wn.y, Wn.w, Wn.h);
          ag.clip();
          const h = s.hour;
          if (cyber()) {
            if (h >= 10 || h < 4) mirror(24, 104, '#ffb070');
            ag.fillStyle = rgba(['#ff3fa4', '#3ff5ff', '#a26bff'][Math.floor(now() / 3) % 3], rf * 0.8);
            ag.fillRect(Wn.x, Wn.y + 8, Wn.w, 3); // the big sign, a band at the top of the glass
          } else {
            if (h >= 11 && h < 23.4) mirror(24, 112, '#ffc070');
            // (the chippy's reflection would only be a 25px sliver at the window's edge, which reads as an artefact)
          }
          ag.restore();
        }
        // anyone on the pavement stands in front of the glass: the light inside mustn't paint over them
        const fronts = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.3));
        if (s.owner.area === 'street') fronts.push(s.owner);
        for (const c of [qg, ag]) {
          c.save();
          c.globalCompositeOperation = 'destination-out';
          for (const a of fronts) B.drawSilhouette(c, a, a.x, a.y, 1, 1);
          c.restore();
        }
        g.drawImage(qc, 0, 0);
        g.globalCompositeOperation = 'lighter';
        g.drawImage(ac, 0, 0);
        g.globalCompositeOperation = 'source-over';
        // each headlamp glints once in the shop glass, at its own height (side-on lamps of passing cars, dimmer)
        g.globalCompositeOperation = 'lighter';
        for (const L of F.glints ? vls : []) {
          const side = L.ev.kind === 'turn' ? 1 : 0.3;
          for (const lamp of L.lamps) {
            const a = Math.min(0.8, L.strength * dark * side);
            if (a < 0.04) continue;
            const gx = Math.round(lamp.x);
            if (gx > Wn.x + 1 && gx < Wn.x + Wn.w - 3) {
              g.fillStyle = rgba(L.col, a);
              g.fillRect(gx, Math.min(Wn.y + Wn.h - 3, Math.round(lamp.y) - 8), 2, 1);
            }
          }
          // a thin highlight along the kerb edge where the beam skims it
          if (L.strength > 0.1 && L.ev.kind !== 'turn') {
            const gr = g.createLinearGradient(L.x, 0, L.x + L.ev.dir * 200, 0);
            gr.addColorStop(0, rgba(L.col, 0.18 * L.strength * dark));
            gr.addColorStop(1, rgba(L.col, 0));
            g.fillStyle = gr;
            g.fillRect(Math.round(Math.min(L.x, L.x + L.ev.dir * 200)), 177, 200, 1);
          }
        }
        g.globalCompositeOperation = 'source-over';
        if (F.rain) rainReflections(g, s, dark, vls);
        if (F.fog) fogCones(g, s, vls);
      }
      // by day: a car's shadow sliding along the pavement and a glint of sun off its windscreen
      if (day > 0.4) {
        for (const L of vls) {
          const ev = L.ev;
          if (ev.kind === 'turn' || ev.kind === 'emergency') continue;
          const k = ev.t / ev.dur;
          g.fillStyle = `rgba(20,20,30,${0.1 * day})`;
          g.fillRect(Math.round(L.x - (ev.kind === 'bus' ? 60 : 30)), 176, ev.kind === 'bus' ? 120 : 60, 4);
          if (ev.seed < 0.4) {
            const gx = Math.round(L.x + ev.dir * 20);
            g.fillStyle = `rgba(255,255,240,${0.16 * day * Math.min(1, k * 5, (1 - k) * 5)})`;
            for (let y = 76; y < 144; y++) g.fillRect(gx + Math.round((144 - y) * 0.4), y, 3, 1);
          }
        }
      }
    },
  });
})(window.Bookshop);
