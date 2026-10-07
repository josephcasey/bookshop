/* 2026-10-07 (the street behind you)
 * The terrace across the road, which you never see directly but which the glass shows you: a row of individual
 * shops (the pub and the chippy whose light falls on the shop at night, a café, a greengrocer, a barber...) with
 * flats above, people walking along its pavement, and the traffic passing between.
 *
 * The facade is painted once into its own image, in street coordinates (1 px = 1/23 m along the street, rows of
 * 1/23 m up from the pavement), with the building heights taken from the same skyline that shades the front.
 * The shop's glass then shows it through a plane mirror: seen from ~14 m out, a facade 22 m beyond the glass is
 * shrunk 2.57x about the eye (1.6 m up, x = 160), without any left-right flip. Things nearer the glass (traffic,
 * 2-4 m out) are shrunk less, so a passing bus fills the lower window.
 *
 *   B.oppositeStreet.paintFacade(g, s, panes)  the static reflection (cached by the caller)
 *   B.oppositeStreet.paintLife(g, s)           walkers and vehicles, every frame
 * Flags (Lighting Lab): streetLife. */
(function (B) {
  const F = (B.lightFlags = B.lightFlags || {});
  if (F.streetLife === undefined) F.streetLife = true;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PX = 23; // px per metre
  const X0 = -260; // street x at the facade image's left edge
  const FW = 840;
  const FH = 14 * PX; // 14 m tall
  const EYE = 1.6;
  const MAG = 2.57; // 1 + 22 / 14
  const cyber = () => B.theme === 'cyber';
  const rowOf = (h) => Math.round(FH - h * PX); // facade image row for a height (m)
  /** Where a point at height h (m) and street x on a plane `dv` m beyond the glass appears in the glass. */
  const toGlass = (x, h, dv) => {
    const m = 14 / (14 + dv);
    return [160 + (x - 160) * m, 164 - PX * (EYE + (h - EYE) * m), m];
  };
  B.reflectAt = toGlass;

  // ---------- the shops ----------
  const KINDS = {
    pub: { fascia: '#1e3a2a', sign: '#d8b048', front: '#3a1e1a', lit: '#ffc070', hours: [11, 23.4], name: 'THE CROWN' },
    chippy: { fascia: '#1f4f9a', sign: '#ffffff', front: '#e8e8e0', lit: '#dcefff', hours: [11.5, 22], tiles: true },
    cafe: { fascia: '#2a2a2a', sign: '#e8dcc0', front: '#c8b898', lit: '#ffd8a0', hours: [7.5, 17], awning: ['#e8e0d0', '#2a5a3a'] },
    grocer: { fascia: '#2f6a2a', sign: '#f0e8c8', front: '#8a6a40', lit: '#fff0c8', hours: [8, 18.5], awning: ['#3a8a3a', '#e8e8d8'], crates: true },
    barber: { fascia: '#202430', sign: '#e8e8e8', front: '#d8d8d8', lit: '#e8f4ff', hours: [9, 18], pole: true },
    news: { fascia: '#b02020', sign: '#ffffff', front: '#5a5048', lit: '#fff4d8', hours: [6, 21], boards: true },
    bakery: { fascia: '#6a3a2a', sign: '#f0d8a0', front: '#d8c0a0', lit: '#ffe0a8', hours: [7, 16], awning: ['#c88a5a', '#f0e0c8'] },
    charity: { fascia: '#5a2a6a', sign: '#ffffff', front: '#c8c0d0', lit: '#fff0e0', hours: [9.5, 17] },
    bookie: { fascia: '#183a6a', sign: '#ffd040', front: '#283040', lit: '#c8e0ff', hours: [9, 22] },
    launderette: { fascia: '#3a8ab0', sign: '#ffffff', front: '#e8f0f0', lit: '#e8fff8', hours: [7, 22] },
  };
  // the neon city has its own row: ramen, pachinko, a clinic, a noodle counter...
  const CYBER = {
    pub: { fascia: '#1a1020', sign: '#ffb238', front: '#140c18', lit: '#ffb070', hours: [10, 28], neon: '#ffb238' },
    chippy: { fascia: '#0c1a24', sign: '#3ff5ff', front: '#101820', lit: '#9fe8ff', hours: [0, 24], neon: '#3ff5ff' },
    other: [
      { fascia: '#200c1a', front: '#180c16', lit: '#ff7ac8', neon: '#ff3fa4' },
      { fascia: '#0c1020', front: '#0c0e1a', lit: '#b090ff', neon: '#a26bff' },
      { fascia: '#0c1a10', front: '#0a140c', lit: '#c0ff90', neon: '#9dff3f' },
      { fascia: '#1a0c0c', front: '#160a0a', lit: '#ff9080', neon: '#ff3b3b' },
    ],
  };
  const BRICK = ['#a85a40', '#c8a878', '#b86a4a', '#e0d4bc', '#a8b4c0', '#d8b0a8', '#8a4a38', '#c8c0a8'];

  let blocks = null;
  function layout() {
    if (blocks) return blocks;
    if (!B.oppositeSkyline) return null;
    const rng = B.seeded('opposite-shops');
    blocks = (B.oppositeBlocks || []).map((b) => Object.assign({}, b));
    if (!blocks.length) return null;
    const others = ['cafe', 'grocer', 'barber', 'news', 'bakery', 'charity', 'bookie', 'launderette'];
    let oi = Math.floor(rng() * others.length);
    for (const b of blocks) {
      if (b.gap) continue;
      const mid = b.x + b.w / 2;
      // the pub and the chippy sit where their light prints fall on the shopfront at night
      b.kind = Math.abs(mid - 68) < b.w / 2 + 4 ? 'pub' : Math.abs(mid - 224) < b.w / 2 + 4 ? 'chippy' : others[oi++ % others.length];
      b.brick = BRICK[Math.floor(rng() * BRICK.length)];
      b.cyberStyle = CYBER.other[Math.floor(rng() * CYBER.other.length)];
      b.door = rng() < 0.5 ? 0 : 1;
      b.flats = Array.from({ length: 12 }, () => rng());
    }
    return blocks;
  }
  const isOpen = (k, h) => {
    const [a, b] = k.hours;
    return b > 24 ? h >= a || h < b - 24 : h >= a && h < b;
  };

  // ---------- painting the facade ----------
  let fc = null;
  let fg = null;
  let fkey = '';
  function facade(s) {
    const L = layout();
    if (!L) return null;
    if (!fc) {
      fc = document.createElement('canvas');
      fc.width = FW;
      fc.height = FH;
      fg = fc.getContext('2d');
    }
    if (!fg) return null;
    const P = B.sunPos(s.hour);
    const night = P.e < -1;
    const dark = clamp((-P.e - 1) / 6, 0, 1);
    const key = `${B.theme}|${Math.round(s.hour * 12)}|${night}`;
    if (key === fkey) return fc;
    fkey = key;
    const g = fg;
    g.clearRect(0, 0, FW, FH);
    const R = (x, h0, w, hh, c) => {
      g.fillStyle = c;
      g.fillRect(Math.round(x - X0), rowOf(h0 + hh), Math.round(w), Math.max(1, Math.round(hh * PX)));
    };
    const cy = cyber();
    const dim = (c) => (night ? B.mix(c, cy ? '#06050c' : '#14121c', 0.82 * dark + 0.1) : c);
    for (const b of L) {
      if (b.gap) {
        // the side street: its far end, a lamp, a parked van
        R(b.x, 0, b.w, 0.3, dim('#4a4844'));
        R(b.x + 4, 0.3, b.w - 8, 4.2, dim(cy ? '#141220' : '#7a7068'));
        if (night) R(b.x + b.w / 2, 3.2, 0.2, 0.2, '#ffd890');
        continue;
      }
      const k = cy ? Object.assign({ hours: [0, 24] }, b.kind === 'pub' ? CYBER.pub : b.kind === 'chippy' ? CYBER.chippy : b.cyberStyle) : KINDS[b.kind];
      const open = isOpen(k, s.hour);
      const wallC = cy ? '#1e1a28' : b.brick;
      // the building, chimney stacks and all
      for (let x = b.x; x < b.x + b.w; x++) {
        const hh = B.oppositeSkyline(x);
        R(x, 0, 1, hh, dim(wallC));
      }
      R(b.x, b.h - 0.25, b.w, 0.25, dim(cy ? '#2c303b' : '#d8d0c0')); // coping
      // flats above: sash windows, a few lit in the evening
      const nW = Math.max(1, Math.floor(b.w / (2.3 * PX)));
      const pitch = b.w / nW;
      for (let f = 0; f < (b.h > 9 ? 2 : 1); f++) {
        const y0 = 4.2 + f * 2.4;
        for (let i = 0; i < nW; i++) {
          const wx = b.x + i * pitch + pitch / 2 - 0.45 * PX;
          const litUp = night && b.flats[(f * nW + i) % 12] < 0.45 && s.hour > 17 && s.hour < 23.5;
          R(wx - 2, y0 - 0.15, 0.9 * PX + 4, 0.15, dim(cy ? '#2c303b' : '#e8e0d0')); // sill
          R(wx, y0, 0.9 * PX, 1.4, litUp ? (cy ? '#b0a0ff' : '#f0c070') : dim(cy ? '#141826' : '#3a4250'));
          if (!cy) R(wx, y0 + 0.68, 0.9 * PX, 0.05, dim('#e8e0d0')); // the sash bar
        }
      }
      // the shopfront: fascia, window, door, stall-riser
      const doorX = b.door ? b.x + b.w - 1.4 * PX : b.x + 0.4 * PX;
      const winX = b.door ? b.x + 0.4 * PX : b.x + 1.6 * PX;
      const winW = b.w - 2 * PX;
      R(b.x, 0, b.w, 3.4, dim(k.front));
      const lit = open && (night || P.e < 8);
      R(winX, 0.55, winW, 1.95, lit ? k.lit : dim(cy ? '#101420' : '#4a5260'));
      if (!cy) for (let i = 1; i < 3; i++) R(winX + (winW * i) / 3, 0.55, 2, 1.95, dim(k.front)); // glazing bars
      R(doorX, 0, 1.0 * PX, 2.3, lit ? B.mix(k.lit, '#000', 0.25) : dim(cy ? '#0c0c14' : '#2a2a30'));
      R(b.x, 2.7, b.w, 0.6, dim(k.fascia));
      // the sign: a row of letters (only blocks at this distance) in the sign colour
      const sc = cy ? k.neon : k.sign;
      const glowSign = cy || (night && open);
      for (let i = 0; i < Math.floor((b.w - 0.8 * PX) / 6); i++) if ((i * 7 + b.x) % 5 !== 0) R(b.x + 0.4 * PX + i * 6, 2.85, 4, 0.3, glowSign ? sc : dim(sc));
      if (k.awning) {
        const [a1, a2] = k.awning;
        for (let x = 0; x < winW + 0.8 * PX; x += 6) R(winX - 0.4 * PX + x, 2.25, 3, 0.4, dim(a1)), R(winX - 0.4 * PX + x + 3, 2.25, 3, 0.4, dim(a2));
      }
      if (k.crates && open) for (let i = 0; i < 4; i++) R(winX + i * 0.9 * PX, 0, 0.7 * PX, 0.55, dim(['#e04a2a', '#f0c030', '#5ab03a', '#e88a2a'][i]));
      if (k.pole) for (let i = 0; i < 6; i++) R(doorX + 1.05 * PX, 1.4 + i * 0.15, 0.12 * PX + 1, 0.15, i % 2 ? '#ffffff' : '#d02020');
      if (k.boards && open) R(doorX - 0.6 * PX, 0, 0.45 * PX, 0.9, dim('#f0f0e8'));
      if (k.tiles) for (let x = b.x; x < b.x + b.w; x += 4) R(x, 0.05, 2, 0.45, dim('#ffffff'));
      if (cy) R(b.x + 1, 2.68, b.w - 2, 0.05, k.neon); // an LED strip along the fascia
    }
    // daylight on it: the terrace faces ENE, so it is sunlit in the morning and in shade after
    if (!night) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = P.morning && P.e > 0 ? (cy ? 'rgba(255,190,140,0.18)' : 'rgba(255,200,140,0.22)') : 'rgba(60,70,110,0.18)';
      g.fillRect(0, 0, FW, FH);
      g.globalCompositeOperation = 'source-over';
    }
    return fc;
  }

  // ---------- people across the road ----------
  const walkers = [];
  const LOOKS = ['#3a4a6a', '#6a2a2a', '#2a2a2a', '#8a7a5a', '#4a6a4a', '#c8a040', '#5a3a6a', '#d8d0c0', '#8a3a2a'];
  const SKIN = ['#e8c4a0', '#c89870', '#8a5a3a', '#f0d0b0', '#5a3a28'];
  let lastT = 0;
  function stepWalkers(s) {
    const now = performance.now() / 1000;
    const dt = lastT ? clamp(now - lastT, 0, 0.25) : 0;
    lastT = now;
    const h = s.hour;
    const busy = h < 6 ? 0.03 : h < 8 ? 0.15 : h < 19 ? 0.45 : h < 23.5 ? 0.2 : 0.06;
    if (walkers.length < 9 && Math.random() < dt * busy) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      walkers.push({
        x: dir > 0 ? X0 + 40 : X0 + FW - 40,
        dir,
        v: (1.1 + Math.random() * 0.5) * PX,
        top: B.pick(LOOKS),
        bottom: B.pick(['#2a2a34', '#3a3a4a', '#5a4a3a', '#1a1a20', '#4a5a7a']),
        skin: B.pick(SKIN),
        hair: B.pick(['#2a1a10', '#6a4a2a', '#c8a060', '#1a1a1a', '#a0a0a0']),
        tall: 0.9 + Math.random() * 0.2,
        dog: Math.random() < 0.08,
        brolly: B.pick(['#2a2a3a', '#a02030', '#204a8a', '#e8e0d0']),
        ph: Math.random() * 6,
      });
    }
    for (const w of walkers) w.x += w.dir * w.v * dt;
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].x < X0 || walkers[i].x > X0 + FW) walkers.splice(i, 1);
  }

  function paintLife(g, s) {
    if (!F.streetLife) return;
    stepWalkers(s);
    const P = B.sunPos(s.hour);
    const night = clamp((-P.e - 1) / 6, 0, 1);
    const shade = (c) => B.mix(c, cyber() ? '#06050c' : '#121018', 0.75 * night);
    const t = performance.now() / 1000;
    const rain = (s.weather && s.weather.rain) || 0;
    // the far pavement is ~20.5 m beyond the glass
    for (const w of walkers) {
      const [gx, gy, m] = toGlass(w.x, 0, 20.5);
      const u = PX * m; // px per metre in the glass
      const ht = Math.round(1.7 * w.tall * u);
      const x = Math.round(gx);
      const y = Math.round(gy);
      const stride = Math.sin(t * 7 + w.ph) > 0;
      g.fillStyle = shade(w.bottom);
      g.fillRect(x - 1 + (stride ? 1 : 0), y - Math.round(ht * 0.45), 1, Math.round(ht * 0.45));
      g.fillRect(x + (stride ? -1 : 1), y - Math.round(ht * 0.45), 1, Math.round(ht * 0.45));
      g.fillStyle = shade(w.top);
      g.fillRect(x - 1, y - Math.round(ht * 0.85), 3, Math.round(ht * 0.42));
      g.fillStyle = shade(w.skin);
      g.fillRect(x, y - ht, 2, 2);
      g.fillStyle = shade(w.hair);
      g.fillRect(x, y - ht, 2, 1);
      if (rain > 0.3) {
        g.fillStyle = shade(w.brolly);
        g.fillRect(x - 2, y - ht - 2, 6, 1);
        g.fillRect(x - 1, y - ht - 3, 4, 1);
      }
      if (w.dog) {
        g.fillStyle = shade('#5a3a20');
        g.fillRect(x + w.dir * 4, y - 2, 3, 1);
        g.fillRect(x + w.dir * 4, y - 1, 1, 1);
        g.fillRect(x + w.dir * 4 + 2, y - 1, 1, 1);
      }
    }
    // the traffic, 2-4 m beyond the glass: much larger than the far side
    for (const ev of B.trafficEvents || []) {
      if (ev.kind === 'turn') continue;
      const k = ev.t / ev.dur;
      const xc = ev.dir > 0 ? -70 + k * 460 : 390 - k * 460;
      const dv = (ev.dir > 0 ? 55 : 85) / PX;
      const [cx, y0, m] = toGlass(xc, 0, dv);
      const u = PX * m;
      const bus = ev.kind === 'bus';
      const bike = ev.kind === 'bike';
      const em = ev.kind === 'emergency';
      const len = bus ? 11 : bike ? 1.8 : 4.3;
      const hgt = bus ? 3.1 : bike ? 1.7 : 1.45;
      const x0 = Math.round(cx - (len * u) / 2);
      const wpx = Math.round(len * u);
      const Y = (h) => Math.round(toGlass(xc, h, dv)[1]);
      const pal = ['#a02a2a', '#2a4a8a', '#d8d8d8', '#2a2a2e', '#6a6a70', '#3a6a4a', '#c8a040'];
      const body = shade(bus ? (cyber() ? '#3a2a6a' : '#c8202a') : em ? '#f0f0e8' : pal[Math.floor(ev.seed * pal.length)]);
      const front = ev.dir > 0 ? x0 + wpx : x0;
      if (bike) {
        g.fillStyle = shade('#2a2a2a');
        g.fillRect(x0, Y(0.35), wpx, 1);
        g.fillStyle = shade(B.pick ? '#4a6a8a' : '#4a6a8a');
        g.fillRect(Math.round(cx) - 1, Y(1.7), 3, Y(0.9) - Y(1.7));
        continue;
      }
      g.fillStyle = body;
      if (bus) {
        g.fillRect(x0, Y(hgt), wpx, Y(0.35) - Y(hgt));
        g.fillStyle = night > 0.5 ? '#f0d890' : shade('#3a4250'); // the windows, lit inside after dark
        for (let i = 0; i < 6; i++) g.fillRect(x0 + 3 + Math.round((i * (wpx - 6)) / 6), Y(2.7), Math.round((wpx - 6) / 6) - 2, Y(1.6) - Y(2.7));
      } else {
        g.fillRect(x0, Y(0.95), wpx, Y(0.3) - Y(0.95)); // the body
        const c0 = x0 + Math.round(wpx * (ev.dir > 0 ? 0.18 : 0.3));
        const c1 = x0 + Math.round(wpx * (ev.dir > 0 ? 0.7 : 0.82));
        g.fillRect(c0, Y(hgt), c1 - c0, Y(0.95) - Y(hgt)); // the cabin
        g.fillStyle = shade('#3a4452');
        g.fillRect(c0 + 2, Y(hgt - 0.08), c1 - c0 - 4, Y(1.0) - Y(hgt - 0.08)); // its windows
        g.fillStyle = body;
        g.fillRect(Math.round((c0 + c1) / 2), Y(hgt), 1, Y(0.95) - Y(hgt)); // B-pillar
        if (em && Math.floor(t * 6) % 2) {
          g.fillStyle = '#3a6aff';
          g.fillRect(Math.round((c0 + c1) / 2) - 3, Y(hgt) - 2, 6, 2);
        }
      }
      g.fillStyle = '#141418';
      for (const f of [0.18, 0.8]) g.fillRect(x0 + Math.round(wpx * f) - 3, Y(0.32), 6, Y(0) - Y(0.32) + 1); // wheels
      // lamps: headlights at the front, tail-lights behind, brightest after dark
      const la = 0.4 + 0.6 * night;
      g.globalAlpha = la;
      g.fillStyle = cyber() ? '#c8f4ff' : '#fff0c8';
      g.fillRect(front - (ev.dir > 0 ? 3 : 0), Y(0.8), 3, 2);
      g.fillStyle = '#ff3020';
      g.fillRect(ev.dir > 0 ? x0 : x0 + wpx - 2, Y(0.85), 2, 2);
      g.globalAlpha = 1;
    }
  }

  /** The static reflection: the facade through the mirror, into the given panes. */
  function paintFacade(g, s, panes) {
    const img = facade(s);
    if (!img) return false;
    g.save();
    g.beginPath();
    for (const p of panes) g.rect(p.x, p.y, p.w, p.h);
    g.clip();
    const [dx, dy] = toGlass(X0, 14, 22);
    g.imageSmoothingEnabled = false; // kept on the pixel grid: the shops' shapes are drawn big enough to survive the 2.6x reduction
    g.drawImage(img, dx, dy, FW / MAG, FH / MAG);
    g.imageSmoothingEnabled = false;
    g.restore();
    return true;
  }

  B.oppositeStreet = { paintFacade, paintLife, layout, walkers };
})(window.Bookshop);
