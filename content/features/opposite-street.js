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
    pub: { fascia: '#1e3a2a', sign: '#d8b048', front: '#3a1e1a', lit: '#ffb060', hours: [11, 23.4], name: 'THE CROWN' },
    chippy: { fascia: '#1f4f9a', sign: '#ffffff', front: '#e8e8e0', lit: '#dcefff', hours: [11.5, 22], tiles: true },
    cafe: { fascia: '#2a2a2a', sign: '#e8dcc0', front: '#c8b898', lit: '#ffd8a0', hours: [7.5, 17], awning: ['#e8e0d0', '#2a5a3a'] },
    grocer: { fascia: '#2f6a2a', sign: '#f0e8c8', front: '#8a6a40', lit: '#fff0c8', hours: [8, 18.5], awning: ['#3a8a3a', '#e8e8d8'], crates: true },
    barber: { fascia: '#202430', sign: '#e8e8e8', front: '#d8d8d8', lit: '#e8f4ff', hours: [9, 18], pole: true },
    news: { fascia: '#b02020', sign: '#ffffff', front: '#5a5048', lit: '#ffe070', hours: [6, 21.5], boards: true },
    bakery: { fascia: '#6a3a2a', sign: '#f0d8a0', front: '#d8c0a0', lit: '#ffe0a8', hours: [7, 16], awning: ['#c88a5a', '#f0e0c8'] },
    charity: { fascia: '#5a2a6a', sign: '#ffffff', front: '#c8c0d0', lit: '#fff0e0', hours: [9.5, 17] },
    bookie: { fascia: '#183a6a', sign: '#ffd040', front: '#283040', lit: '#c8e0ff', hours: [9, 22], neon: '#ff3030' },
    launderette: { fascia: '#3a8ab0', sign: '#ffffff', front: '#e8f0f0', lit: '#d8ecff', hours: [7, 22] },
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
      // the pub and the chippy sit where their light prints fall on the shopfront at night (each may take two buildings)
      const over = (a0, a1) => b.x < a1 && b.x + b.w > a0 && Math.min(a1, b.x + b.w) - Math.max(a0, b.x) > 10;
      b.kind = over(24, 110) ? 'pub' : over(186, 262) ? 'chippy' : others[oi++ % others.length];
      void mid;
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

  // ---------- painting the facade, straight into the glass at screen resolution ----------
  // (a 2.57x reduction of detailed art only aliases: each shop is authored at the size it appears, with one signature
  // that survives: a fascia hue, an awning's stripes, a barber's pole, a row of portholes)
  const gx = (x) => 160 + (x - 160) / MAG;
  const gy = (h) => 164 - PX * (EYE + (h - EYE) / MAG);
  function paintTerrace(g, s) {
    const L = layout();
    if (!L) return false;
    const P = B.sunPos(s.hour);
    const night = P.e < -1;
    const dark = clamp((-P.e - 1) / 6, 0, 1);
    const cy = cyber();
    const BLACK = cy ? '#05040a' : '#0b0a10';
    const dim = (c) => (night ? B.mix(c, BLACK, 0.6 + 0.4 * dark) : c);
    // a rect in street x (px) and height (m)
    const R = (x0, x1, h0, h1, c) => {
      const a = Math.round(gx(x0));
      const b = Math.max(a + 1, Math.round(gx(x1)));
      const top = Math.round(gy(h1));
      const bot = Math.max(top + 1, Math.round(gy(h0)));
      g.fillStyle = c;
      g.fillRect(a, top, b - a, bot - top);
    };
    // ...or in glass pixels from a street-x anchor
    const P1 = (x, h, w, hh, c) => {
      g.fillStyle = c;
      g.fillRect(Math.round(gx(x)), Math.round(gy(h)), w, hh);
    };
    // its own light: sunlit in the morning (it faces ENE); in shade after, darker the lower the sun (x0.35 at golden hour)
    const eveShade = !P.morning ? clamp(0.15 + (25 - P.e) / 40, 0.15, 0.65) : 0;
    const tint = night ? null : P.morning && P.e > 0 ? 'rgba(255,200,140,0.22)' : `rgba(20,22,40,${eveShade.toFixed(2)})`;
    for (const b of L) {
      const x0 = b.x;
      const x1 = b.x + b.w;
      if (b.gap) {
        // the passage: the backs of houses beyond, in shadow, a lit back window at night
        R(x0, x1, -1, 6, night ? BLACK : cy ? '#141220' : '#4a4642');
        if (night && s.hour > 17 && s.hour < 23.5) P1((x0 + x1) / 2 - 2, 3.6, 2, 2, '#e8b060');
        continue;
      }
      const k = cy ? Object.assign({ hours: [0, 24] }, b.kind === 'pub' ? CYBER.pub : b.kind === 'chippy' ? CYBER.chippy : b.cyberStyle) : KINDS[b.kind];
      const open = isOpen(k, s.hour);
      const lit = open && (night || P.e < 8);
      // the building, chimneys and all (night: black but for what's lit)
      const wallC = night ? BLACK : cy ? '#1e1a28' : b.brick;
      for (let x = x0; x < x1; x += 2) R(x, x + 2, 0, B.oppositeSkyline(x), wallC);
      // flats above: sash windows, some lit after dark
      const nW = Math.max(1, Math.floor(b.w / (2.3 * PX)));
      const pitch = b.w / nW;
      for (let f = 0; f < (b.h > 9 ? 2 : 1); f++) {
        const h0 = 4.2 + f * 2.4;
        for (let i = 0; i < nW; i++) {
          const wx = x0 + i * pitch + pitch / 2 - 0.45 * PX;
          const litUp = night && b.flats[(f * nW + i) % 12] < 0.45 && s.hour > 17 && s.hour < 23.5;
          if (night && !litUp) continue;
          if (cy && night) {
            // a holo board or a strip light: a thin bar, not a lit room
            g.fillStyle = ['#ff3fa4', '#3ff5ff', '#a26bff', '#ffb238'][Math.floor(b.flats[(f + i) % 12] * 4)];
            g.fillRect(Math.round(gx(wx)), Math.round(gy(h0 + 0.7)), Math.max(2, Math.round(gx(wx + 0.9 * PX)) - Math.round(gx(wx))), 1);
            continue;
          }
          const v = b.flats[(f * nW + i + 5) % 12];
          const warm = cy ? '#b0a0ff' : v < 0.15 ? '#8aa8ff' : v < 0.5 ? '#f0c070' : v < 0.8 ? '#ffd8a0' : '#e0a060'; // a telly's blue, lamps
          R(wx, wx + 0.9 * PX, h0, h0 + 1.4, litUp ? warm : cy ? '#141826' : '#3a4250');
          if (litUp && v > 0.6) R(wx, wx + 0.45 * PX, h0, h0 + 1.4, B.mix(warm, '#000', 0.45)); // half-drawn curtains
        }
      }
      // the shopfront: a 1 px gap of brick either side keeps neighbours apart
      const s0 = x0 + 0.5 * PX;
      const s1 = x1 - 0.5 * PX;
      if (!night) R(s0, s1, 0, 2.6, cy ? '#141018' : k.front);
      // the window, lit in opening hours
      const doorL = !b.door;
      const wx0 = doorL ? s0 + 1.2 * PX : s0;
      const wx1 = doorL ? s1 : s1 - 1.2 * PX;
      if (cy && night) {
        // the neon city after dark: only the tubes reflect, one saturated hue per shop, a faint glow inside
        const a = Math.round(gx(wx0));
        const bb = Math.round(gx(wx1));
        const top = Math.round(gy(2.4));
        const bot = Math.round(gy(0.5));
        g.fillStyle = k.neon;
        g.globalAlpha = 0.14;
        g.fillRect(a, top, bb - a, bot - top);
        g.globalAlpha = 1;
        g.fillRect(a, top, bb - a, 1);
        g.fillRect(a, bot - 1, bb - a, 1);
        g.fillRect(a, top, 1, bot - top);
        g.fillRect(bb - 1, top, 1, bot - top);
      } else {
        if (lit || !night) R(wx0, wx1, 0.5, 2.4, lit ? k.lit : cy ? '#101420' : '#3a4250');
        if (lit || !night) R(doorL ? s0 + 0.2 * PX : s1 - 1.0 * PX, doorL ? s0 + 1.0 * PX : s1 - 0.2 * PX, 0, 2.2, lit ? B.mix(k.lit, '#000', 0.3) : '#2a2a30');
      }
      // the fascia: one saturated hue, 2 px; lit (or neon) after dark when open
      const fy = Math.round(gy(3.1));
      const fa = Math.round(gx(s0));
      const fb = Math.round(gx(s1));
      if (!night || open || cy) {
        g.fillStyle = night && !cy ? B.mix(k.fascia, '#000', 0.4) : k.fascia;
        g.fillRect(fa, fy, fb - fa, 2);
        g.fillStyle = cy ? k.neon : k.sign;
        if (!night || open || cy) for (let x = fa + 2; x < fb - 2; x += 3) if ((x * 7 + b.x) % 5) g.fillRect(x, fy + (cy ? 0 : 1), 1, 1); // the lettering
      }
      if (cy) continue;
      // inside the lit shops, at night: the chippy's counter, fryers and menu; the pub's mullions and a drinker
      if (lit && night) {
        const a = Math.round(gx(wx0));
        const bb = Math.round(gx(wx1));
        if (b.kind === 'chippy') {
          g.fillStyle = '#2a3440';
          g.fillRect(a, Math.round(gy(1.0)), bb - a, 1); // the counter
          g.fillRect(a + 1, Math.round(gy(0.75)), bb - a - 2, 2); // the fryer range
          g.fillStyle = '#4a6a8a';
          g.fillRect(a + 1, Math.round(gy(2.3)), bb - a - 2, 1); // the menu board
        }
        if (b.kind === 'pub') {
          g.fillStyle = '#3a2010';
          for (let x = a + 4; x < bb - 1; x += 5) g.fillRect(x, Math.round(gy(2.4)), 1, Math.round(gy(0.5)) - Math.round(gy(2.4))); // mullions
          const dx = a + Math.round((bb - a) * 0.4);
          g.fillRect(dx, Math.round(gy(1.75)), 2, 2); // a drinker at the window
          g.fillRect(dx - 1, Math.round(gy(1.45)), 4, Math.round(gy(0.5)) - Math.round(gy(1.45)));
        }
        if (b.kind === 'news') {
          g.fillStyle = '#ffe070';
          g.fillRect(Math.round(gx(doorL ? s0 + 0.3 * PX : s1 - 0.9 * PX)), Math.round(gy(1.9)), 3, 4); // a lit doorway
        }
      }
      // one signature each
      const mid = Math.round(gx((s0 + s1) / 2));
      const groundY = Math.round(gy(0));
      if (b.kind === 'pub') {
        g.fillStyle = dim('#5a1a1a');
        g.fillRect(fa, fy + 2, fb - fa, 1); // oxblood under the green
        g.fillStyle = night ? '#e0a050' : '#d8b048';
        g.fillRect(fb - 1, fy - 4, 2, 3); // the hanging sign
      } else if (b.kind === 'chippy' && !night) {
        g.fillStyle = '#f4f4f0';
        g.fillRect(Math.round(gx(wx0)), Math.round(gy(0.45)), Math.round(gx(wx1)) - Math.round(gx(wx0)), 2); // white tiles
      } else if (k.awning) {
        const ay = Math.round(gy(2.55));
        for (let x = Math.round(gx(wx0)) - 1; x < Math.round(gx(wx1)) + 1; x++) {
          g.fillStyle = dim(k.awning[x & 1]);
          g.fillRect(x, ay, 1, 3);
        }
      } else if (k.pole) {
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? '#f0f0f0' : '#d02020';
          g.fillRect(Math.round(gx(doorL ? s0 + 1.1 * PX : s1 - 1.1 * PX)), Math.round(gy(1.9)) + i, 1, 1);
        }
      } else if (b.kind === 'launderette') {
        for (let x = Math.round(gx(wx0)) + 1; x < Math.round(gx(wx1)) - 3; x += 4) {
          g.fillStyle = '#20262c';
          g.fillRect(x - 1, Math.round(gy(1.0)) - 1, 4, 4); // the machine's rim
          g.fillStyle = night ? (open ? '#f4fbff' : BLACK) : '#c8d8e0'; // a lit porthole
          g.fillRect(x, Math.round(gy(1.0)), 2, 2);
        }
      } else if (b.kind === 'news' && open && !night) {
        g.fillStyle = '#f0f0e8';
        g.fillRect(Math.round(gx(doorL ? s0 - 0.6 * PX : s1 + 0.2 * PX)), groundY - 3, 2, 3);
      } else if (b.kind === 'bookie') {
        g.fillStyle = night && open ? '#ff3030' : dim('#c02020'); // a red neon strip after dark
        g.fillRect(fa, fy + 2, fb - fa, 2);
      }
      if (b.kind === 'grocer' && open && !night) {
        const c = ['#e04a2a', '#f0c030', '#5ab03a', '#e88a2a'];
        for (let x = Math.round(gx(wx0)); x < Math.round(gx(wx1)); x++) {
          g.fillStyle = c[x % 4];
          g.fillRect(x, groundY - 2, 1, 1);
        }
      }
      void mid;
    }
    // the light on it by day: sunlit in the morning (it faces ENE), shade after
    if (tint) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = tint;
      g.fillRect(0, 0, 320, 180);
      g.globalCompositeOperation = 'source-over';
    }
    // the reflected kerb: a 1 px line the terrace and the walkers stand on. After dark an unlit kerb mirrors nothing,
    // so it's left out: it read as a line across the glass where the old stall-riser was (SCH-25)
    if (!night) {
      g.fillStyle = cy ? '#3a3648' : '#b8b0a4';
      g.fillRect(0, Math.round(gy(0)), 320, 1);
      // the reflected road below it: a couple of rows fading out, so the shop floor (and a dancer's feet) show
      // through the low sill rather than a grey band
      g.fillStyle = cy ? '#24222c' : '#5a5650';
      g.globalAlpha = 0.6;
      g.fillRect(0, Math.round(gy(0)) + 1, 320, 2);
      g.globalAlpha = 0.25;
      g.fillRect(0, Math.round(gy(0)) + 3, 320, 3);
      g.globalAlpha = 1;
    }
    return true;
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
    paintSky(g, s);
    stepWalkers(s);
    const P = B.sunPos(s.hour);
    const night = clamp((-P.e - 1) / 6, 0, 1);
    const shade = (c) => B.mix(c, cyber() ? '#06050c' : '#121018', 0.75 * night);
    const t = performance.now() / 1000;
    const rain = (s.weather && s.weather.rain) || 0;
    // the far pavement is ~20.5 m beyond the glass: dark figures against the shopfronts, one colour each, and after
    // dark only a rim where a lit window is behind them
    const sil = cyber() ? '#141220' : '#2a2630';
    for (const w of walkers) {
      const [gx0, gy0, m] = toGlass(w.x, 0, 20.5);
      const u = PX * m;
      const ht = Math.round(1.7 * w.tall * u);
      const x = Math.round(gx0);
      const y = Math.round(gy0);
      const stride = Math.sin(t * 7 + w.ph) > 0;
      const legH = Math.round(ht * 0.45);
      if (night > 0.6) {
        g.fillStyle = '#000';
      } else g.fillStyle = sil;
      g.fillRect(x - 1 + (stride ? 1 : 0), y - legH, 1, legH);
      g.fillRect(x + (stride ? -1 : 1), y - legH, 1, legH);
      g.fillRect(x - 1, y - Math.round(ht * 0.85), 3, Math.round(ht * 0.42));
      g.fillRect(x, y - ht, 2, Math.round(ht * 0.16));
      if (night < 0.6) {
        g.fillStyle = shade(w.top); // the one colour that reads: a coat
        g.fillRect(x, y - Math.round(ht * 0.8), 2, Math.round(ht * 0.3));
      } else {
        g.fillStyle = 'rgba(255,200,120,0.6)'; // backlit by the shop windows
        g.fillRect(x + 2, y - ht + 1, 1, Math.round(ht * 0.6));
      }
      if (rain > 0.3) {
        g.fillStyle = night > 0.6 ? '#000' : shade(w.brolly);
        g.fillRect(x - 2, y - ht - 1, 5, 1);
        g.fillRect(x - 1, y - ht - 2, 3, 1);
      }
      if (w.dog) {
        g.fillStyle = night > 0.6 ? '#000' : sil;
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
      const [cx, , m] = toGlass(xc, 0, dv);
      const u = PX * m;
      const bus = ev.kind === 'bus';
      const bike = ev.kind === 'bike';
      const em = ev.kind === 'emergency';
      const len = bus ? 11 : bike ? 1.8 : 4.3;
      const hgt = bus ? 3.1 : bike ? 1.7 : 1.45;
      const x0 = Math.round(cx - (len * u) / 2);
      const wpx = Math.round(len * u);
      const Y = (h) => Math.round(toGlass(xc, h, dv)[1]);
      const front = ev.dir > 0 ? x0 + wpx : x0;
      const lampA = 0.5 + 0.5 * night;
      if (night < 0.6) {
        const pal = ['#a02a2a', '#2a4a8a', '#c8c8c8', '#2a2a2e', '#6a6a70', '#3a6a4a', '#c8a040'];
        const body = shade(bus ? (cyber() ? '#3a2a6a' : '#b8202a') : em ? '#f0f0e8' : pal[Math.floor(ev.seed * pal.length)]);
        if (bike) {
          g.fillStyle = sil;
          g.fillRect(x0, Y(0.35), wpx, 1);
          g.fillRect(Math.round(cx) - 1, Y(1.7), 3, Y(0.9) - Y(1.7));
          continue;
        }
        g.fillStyle = body;
        if (bus) {
          g.fillRect(x0, Y(hgt), wpx, Y(0.35) - Y(hgt));
          // a dark window band with a pillar every 6 px, the destination blind, a black skirt
          g.fillStyle = '#1a1c24';
          g.fillRect(x0 + 2, Y(2.75), wpx - 4, Y(1.75) - Y(2.75));
          g.fillStyle = body;
          for (let x = x0 + 6; x < x0 + wpx - 3; x += 6) g.fillRect(x, Y(2.75), 1, Y(1.75) - Y(2.75));
          g.fillStyle = '#f0b030';
          g.fillRect(ev.dir > 0 ? x0 + wpx - 12 : x0 + 3, Y(2.95), 9, 1);
          g.fillStyle = '#121216';
          g.fillRect(x0, Y(0.5), wpx, Y(0) - Y(0.5) + 1);
        } else {
          g.fillRect(x0, Y(0.95), wpx, Y(0.3) - Y(0.95));
          const c0 = x0 + Math.round(wpx * (ev.dir > 0 ? 0.18 : 0.3));
          const c1 = x0 + Math.round(wpx * (ev.dir > 0 ? 0.7 : 0.82));
          g.fillRect(c0, Y(hgt), c1 - c0, Y(0.95) - Y(hgt));
          g.fillStyle = '#20242c';
          g.fillRect(c0 + 2, Y(hgt - 0.08), c1 - c0 - 4, Y(1.0) - Y(hgt - 0.08));
          g.fillStyle = body;
          g.fillRect(Math.round((c0 + c1) / 2), Y(hgt), 1, Y(0.95) - Y(hgt));
          g.fillStyle = '#121216';
          for (const f of [0.18, 0.8]) g.fillRect(x0 + Math.round(wpx * f) - 3, Y(0.32), 6, Y(0) - Y(0.32) + 1);
        }
      } else if (bus) {
        // after dark a bus is its lit lower deck and upper windows
        g.globalAlpha = 0.6; // lit, but dimmer than the pub
        let n = 0;
        for (let x = x0 + 3; x < x0 + wpx - 5; x += 7) {
          g.fillStyle = cyber() ? '#c8b0ff' : '#e8b070';
          g.fillRect(x, Y(2.75), 5, Y(1.75) - Y(2.75));
          g.fillRect(x, Y(1.5), 5, Y(0.9) - Y(1.5));
          if ((n++ + Math.floor(ev.seed * 7)) % 3 === 0) {
            g.fillStyle = '#2a1a14'; // a passenger's head and shoulders
            g.fillRect(x + 1, Y(2.3), 2, 2);
            g.fillRect(x, Y(2.05), 4, Y(1.75) - Y(2.05));
          }
        }
        g.globalAlpha = 1;
        g.fillStyle = '#f0b030';
        g.fillRect(ev.dir > 0 ? x0 + wpx - 12 : x0 + 3, Y(2.95), 9, 1);
      }
      if (em && Math.floor(t * 6) % 2) {
        g.fillStyle = '#3a6aff';
        g.fillRect(Math.round(cx) - 3, Y(hgt) - 2, 6, 2);
      }
      // the lamps: two headlamps at the front, tail-lights behind
      g.globalAlpha = lampA;
      g.fillStyle = cyber() ? '#c8f4ff' : '#fff4d8';
      const hx = ev.dir > 0 ? front - 2 : front;
      g.fillRect(hx, Y(0.75), 2, 2);
      if (!bike) g.fillRect(hx + (ev.dir > 0 ? -5 : 5), Y(0.75), 2, 2);
      g.fillStyle = '#ff2a18';
      const tx = ev.dir > 0 ? x0 : x0 + wpx - 2;
      g.fillRect(tx, Y(0.85), 2, 2);
      if (!bike) g.fillRect(tx + (ev.dir > 0 ? 5 : -5), Y(0.85), 2, 2);
      g.globalAlpha = 1;
    }
  }

  // ---------- the sky behind you, in the flat's windows ----------
  // The upstairs panes look over the roofs opposite, so they mirror the sky and whatever crosses it: flying traffic in
  // the neon city (three lanes at ~60, 100 and 160 m), and at home gulls, the odd airliner trailing a contrail, a
  // helicopter's lights at night. Positions are kept in glass space; m is the mirror's scale at that distance.
  const flyers = [];
  let skyLast = 0;
  function stepSky(s) {
    const now = performance.now() / 1000;
    const dt = skyLast ? clamp(now - skyLast, 0, 0.25) : 0;
    skyLast = now;
    const cy = cyber();
    const P = B.sunPos(s.hour);
    const spawn = (o) => flyers.push(Object.assign({ gx: o.dir > 0 ? -12 : 332, gy: B.rnd(21, 40), t: 0, seed: Math.random() }, o));
    if (flyers.length < 8) {
      if (cy && Math.random() < dt * 0.6) {
        const lane = B.pick([60, 100, 160]);
        const m = 14 / (14 + lane);
        const dir = lane === 100 ? -1 : 1;
        spawn({ kind: 'car', m, dir, v: 14 * PX * m * dir, gy: { 60: 24, 100: 31, 160: 37 }[lane] + B.rnd(-2, 2) });
      }
      if (!cy && P.e > -2 && Math.random() < dt * 0.05) spawn({ kind: 'gull', m: 14 / (14 + B.rnd(50, 90)), dir: B.chance(0.5) ? 1 : -1, v: 0 });
      if (!cy && Math.random() < dt * 0.012) spawn({ kind: 'plane', m: 0.00044, dir: B.chance(0.5) ? 1 : -1, v: 0, gy: B.rnd(21, 30) });
      if (!cy && P.e < -4 && Math.random() < dt * 0.006) spawn({ kind: 'heli', m: 0.0115, dir: B.chance(0.5) ? 1 : -1, v: 0 });
    }
    for (const f of flyers) {
      f.t += dt;
      const ms = f.kind === 'gull' ? 8 : f.kind === 'plane' ? 230 : f.kind === 'heli' ? 45 : 0;
      if (ms) f.v = ms * PX * f.m * f.dir;
      f.gx += f.v * dt;
      if (f.kind === 'gull') f.gy += Math.sin(f.t * 1.3 + f.seed * 6) * dt * 3;
    }
    for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].gx < -60 || flyers[i].gx > 380) flyers.splice(i, 1);
  }
  function paintSky(g, s) {
    stepSky(s);
    const P = B.sunPos(s.hour);
    const night = clamp((-P.e - 1) / 6, 0, 1);
    const t = performance.now() / 1000;
    g.save();
    g.beginPath();
    for (const u of B.LAYOUT.upstairs) g.rect(u.x, u.y, u.w, u.h);
    g.clip();
    flyers.sort((a, b) => a.m - b.m); // far to near
    for (const f of flyers) {
      const x = Math.round(f.gx);
      const y = Math.round(f.gy);
      if (f.kind === 'car') {
        const w = Math.max(3, Math.round(4.5 * PX * f.m));
        const h = Math.max(1, Math.round(1.4 * PX * f.m));
        // a streak of its running light behind it (it crosses a pane in a fraction of a second)
        const rc = ['#ff3fa4', '#3ff5ff', '#a26bff'][Math.floor(f.seed * 3)];
        g.fillStyle = rc;
        for (let i = 1; i <= 4; i++) {
          g.globalAlpha = 0.5 * (1 - i / 5);
          g.fillRect(f.dir > 0 ? x - (w >> 1) - i * 2 : x + (w >> 1) + (i - 1) * 2, y - 1, 2, 1);
        }
        g.globalAlpha = 1;
        if (night < 0.7) {
          g.fillStyle = '#16141e';
          g.fillRect(x - (w >> 1), y - h, w, h);
        }
        g.fillStyle = '#e8f8ff';
        g.fillRect(f.dir > 0 ? x + (w >> 1) - 1 : x - (w >> 1), y - h, 1, 1); // headlamp
        g.fillStyle = '#ff3a4a';
        g.fillRect(f.dir > 0 ? x - (w >> 1) : x + (w >> 1) - 1, y - 1, 1, 1); // tail
        if (w > 6) {
          g.fillStyle = ['#ff3fa4', '#3ff5ff', '#a26bff'][Math.floor(f.seed * 3)];
          g.fillRect(x - (w >> 1) + 1, y, w - 2, 1); // an underglow strip
        }
      } else if (f.kind === 'gull') {
        const up = Math.sin(t * 9 + f.seed * 6) > 0;
        g.fillStyle = night > 0.3 ? '#3a3a44' : '#f4f4f0';
        // a 'v' that flaps: wings up, then level
        g.fillRect(x - 2, y - (up ? 1 : 0), 1, 1);
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x, y + 1, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x + 2, y - (up ? 1 : 0), 1, 1);
      } else if (f.kind === 'plane') {
        // a glint of an airliner and its contrail, catching the low sun pink at dusk
        // at ~10 km the trail stays sunlit until the sun is ~3.5 deg down: gold, then red, then in the earth's shadow
        if (P.e < -6 && night > 0.6) {
          g.fillStyle = Math.floor(t * 1.5) % 2 ? '#ff4040' : '#000';
          g.fillRect(x, y, 1, 1);
          continue;
        }
        const tc = P.e > 3 ? '#ffffff' : P.e > 0 ? '#ffd090' : P.e > -3.5 ? '#ff8050' : '#6a6a80';
        for (let i = 1; i < 26; i++) {
          g.fillStyle = tc;
          g.globalAlpha = (1 - i / 26) * 0.7;
          g.fillRect(x - f.dir * i, y, 1, 1);
        }
        g.globalAlpha = 1;
        g.fillStyle = night > 0.6 ? (Math.floor(t * 1.5) % 2 ? '#ff4040' : '#000') : '#ffffff';
        g.fillRect(x, y, 1, 1);
      } else if (f.kind === 'heli') {
        g.fillStyle = Math.floor(t * 2) % 2 ? '#ff3030' : '#300808';
        g.fillRect(x, y, 1, 1);
        g.fillStyle = Math.floor(t * 1.3 + 0.5) % 3 === 0 ? '#ffffff' : '#000';
        g.fillRect(x + 2, y, 1, 1);
      }
    }
    g.restore();
  }

  /** The static reflection: the terrace through the mirror, into the given panes. */
  function paintFacade(g, s, panes) {
    g.save();
    g.beginPath();
    for (const p of panes) g.rect(p.x, p.y, p.w, p.h);
    g.clip();
    const ok = paintTerrace(g, s);
    g.restore();
    return ok;
  }

  B.oppositeStreet = { paintFacade, paintLife, layout, walkers, flyers };
})(window.Bookshop);
