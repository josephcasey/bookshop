/* The neon theme: the same shop and street, a few decades on. Rain-slick concrete and steel, LED strips, holo signs,
 * a megacity glowing at the end of the alley, techwear and implants on the passers-by, and a colour grade with bloom
 * over the whole frame so everything (including content drawn by features) sits in the same light.
 * Every function here replaces the classic one of the same name in render.js (see B.renderKit.PARTS). */
(function () {
  'use strict';
  const B = window.Bookshop;
  const K = B.renderKit;
  const px = B.px;
  const { glow, scan, lerp, AL, wallL, wallR } = K;

  const C = {
    wall: '#23242e', wall2: '#1d1e27', seam: '#15161d', hi: '#343644',
    steel: '#2c303b', steelD: '#1a1d25', steelL: '#454b5a', steelH: '#5d6577',
    pink: '#ff3fa4', cyan: '#3ff5ff', violet: '#a26bff', amber: '#ffb238', acid: '#9dff3f', red: '#ff3b3b',
  };
  const NOW = () => performance.now() / 1000; // real time: neon shouldn't go frantic at 10x
  const flicker = (seed, rate = 0.03) => B.hash(seed + ':' + Math.floor(performance.now() / 70)) % 1000 >= rate * 1000;
  const lighter = (g, fn) => {
    g.globalCompositeOperation = 'lighter';
    fn();
    g.globalCompositeOperation = 'source-over';
  };
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  /** Neon text: a coloured halo around a pale core. */
  function neonText(g, str, x, y, col, sc = 1, core) {
    if (sc > 1) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) B.text(g, str, x + dx, y + dy, col, sc);
    B.text(g, str, x, y, sc > 1 ? core || B.mix(col, '#ffffff', 0.65) : col, sc); // small text: the bloom does the halo
  }

  // ---------- static layers ----------
  function makeFacade() {
    const [c, g] = K.makeCanvas();
    const L = B.LAYOUT;
    const rng = B.seeded('cyber-facade');
    // roof coping
    px(g, C.steelL, 0, 8, 280, 2);
    px(g, C.steelD, 0, 10, 280, 2);
    for (let x = 0; x < 280; x += 8) px(g, C.steel, x, 10, 1, 2);
    // precast concrete panels above the shop, streaked with grime
    px(g, C.wall, 0, 12, 274, 40);
    for (let row = 0; row < 3; row++) {
      const y = 12 + row * 13;
      px(g, C.seam, 0, y, 274, 1);
      for (let x = (row % 2) * 17 - 17; x < 274; x += 34) {
        px(g, C.seam, x, y, 1, 13);
        const v = rng();
        if (v < 0.3) px(g, C.wall2, x + 1, y + 1, 33, 12);
        else if (v > 0.85) px(g, C.hi, x + 1, y + 1, 33, 1);
        if (rng() < 0.6) {
          const dx = x + 2 + Math.floor(rng() * 28);
          const n = 3 + Math.floor(rng() * 9);
          for (let k = 0; k < n; k++) px(g, k < 2 ? '#14141a' : '#1b1b22', dx, y + 1 + k, 1, 1);
        }
        px(g, C.hi, x + 2, y + 2, 1, 1);
        px(g, C.hi, x + 31, y + 2, 1, 1);
      }
    }
    // the flat's windows: steel frames
    for (const u of L.upstairs) {
      px(g, C.steelL, u.x - 4, u.y - 5, u.w + 8, 2);
      px(g, C.steelD, u.x - 4, u.y - 3, u.w + 8, 1);
      px(g, C.steel, u.x - 2, u.y - 2, u.w + 4, u.h + 4);
      px(g, C.steelD, u.x - 2, u.y - 2, 1, u.h + 4);
      g.clearRect(u.x, u.y, u.w, u.h);
      px(g, C.steelL, u.x - 4, u.y + u.h + 2, u.w + 8, 2);
      px(g, C.steelD, u.x - 4, u.y + u.h + 4, u.w + 8, 1);
    }
    // air-con unit between the windows, with a rusty drip stain
    px(g, '#4e5462', 108, 25, 24, 14);
    px(g, '#5d6577', 108, 25, 24, 1);
    px(g, '#2e333d', 108, 38, 24, 1);
    for (let y = -5; y <= 5; y++)
      for (let x = -5; x <= 5; x++) {
        const r = x * x + y * y;
        if (r <= 25 && r > 16) px(g, '#262a33', 115 + x, 32 + y);
        else if (r <= 16 && (x + y) % 2 === 0) px(g, '#323743', 115 + x, 32 + y);
      }
    for (let y = 28; y < 37; y += 2) px(g, '#353a46', 123, y, 7, 1);
    px(g, C.steelD, 110, 39, 2, 3);
    px(g, C.steelD, 128, 39, 2, 3);
    for (let y = 42; y < 52; y++) px(g, y % 3 ? '#2a2422' : '#302824', 119, y, 1, 1);
    // cable bundles slung under the sign
    for (const [y0, sag, col] of [[46, 3, '#101117'], [48, 2, '#181922']]) {
      for (const [a, b] of [[0, 92], [92, 186], [186, 274]]) {
        for (let x = a; x < b; x++) px(g, col, x, Math.round(y0 + sag * Math.sin((Math.PI * (x - a)) / (b - a))), 1, 1);
        px(g, C.steelL, a, y0 - 1, 2, 2);
      }
    }
    // corner pier: a steel column with conduit
    px(g, C.steelD, 274, 8, 6, 156);
    px(g, C.steel, 275, 8, 4, 156);
    for (let y = 14; y < 164; y += 12) px(g, C.steelL, 275, y, 4, 1);
    px(g, '#3a3f4a', 274, 13, 2, 151);
    for (const y of [40, 100, 150]) px(g, '#22252d', 273, y, 4, 2);
    px(g, '#2a2d38', 318, 8, 2, 156);
    // fascia: a black box for the neon tubes (lit live)
    px(g, '#0b0c11', 0, 52, 274, 21);
    px(g, C.steelL, 0, 52, 274, 1);
    px(g, C.steelD, 0, 72, 274, 1);
    for (let x = 6; x < 274; x += 24) px(g, '#15161d', x, 54, 1, 17);
    const name = B.config.shopName;
    B.text(g, name, Math.round(137 - B.textWidth(name, 3) / 2), 56, '#3a1830', 3); // the tubes, unlit
    // window frame
    const W = L.win;
    px(g, C.steel, 6, 73, 208, 75);
    px(g, C.steelD, 7, 75, 206, 1);
    g.clearRect(W.x, W.y, W.w, W.h);
    px(g, '#0c0d12', W.x, W.y, W.w, 8); // transom: dark glass for the holo labels
    px(g, C.steel, W.x, 84, W.w, 2);
    px(g, C.steelL, W.x, 84, W.w, 1);
    for (const x of [76, 144]) px(g, C.steel, x, W.y, 2, 8);
    // sill & stallriser with vent grilles
    px(g, C.steelL, 4, 144, 212, 3);
    px(g, C.steelH, 4, 144, 212, 1);
    px(g, C.steelD, 4, 147, 212, 1);
    px(g, C.steel, 6, 148, 208, 16);
    for (const x of [12, 80, 148]) {
      px(g, C.steelD, x, 151, 60, 10);
      for (let k = 0; k < 10; k += 2) px(g, '#0d0e13', x + 2, 152 + k, 56, 1);
    }
    // pilasters: riveted I-beams
    for (const x of [0, 214, 266]) {
      px(g, C.steelD, x, 73, 8, 91);
      px(g, C.steel, x + 1, 74, 6, 90);
      px(g, C.steelL, x + 2, 74, 1, 90);
      for (let y = 78; y < 160; y += 8) px(g, C.steelH, x + 5, y, 1, 1);
    }
    // door surround and fanlight
    px(g, C.steel, 222, 73, 44, 91);
    px(g, C.steelD, 225, 90, 38, 1);
    px(g, '#07080c', 227, 77, 34, 12);
    // keypad beside the door
    px(g, '#101218', 263, 118, 3, 6);
    g.clearRect(L.doorOpening.x, L.doorOpening.y, L.doorOpening.w, L.doorOpening.h);
    px(g, C.steelH, 224, 162, 40, 2);
    return c;
  }

  function makeStreet() {
    const [c, g] = K.makeCanvas();
    const rng = B.seeded('cyber-street');
    // rain-slick paving
    px(g, '#1b1c25', 0, 164, 320, 14);
    for (let x = 0; x < 320; x += 32) px(g, '#262833', x, 164, 1, 7);
    for (let x = 16; x < 320; x += 32) px(g, '#262833', x, 171, 1, 7);
    px(g, '#262833', 0, 171, 320, 1);
    for (let i = 0; i < 90; i++) px(g, rng() < 0.5 ? '#17181f' : '#22232d', Math.floor(rng() * 320), 164 + Math.floor(rng() * 14));
    // kerb with a strip light
    px(g, '#30323e', 0, 178, 320, 2);
    px(g, '#1e4a52', 0, 178, 320, 1);
    // a drain grate
    px(g, '#0e0f14', 150, 173, 12, 3);
    for (let x = 151; x < 162; x += 2) px(g, '#2a2c36', x, 173, 1, 3);
    // LED street pylon on the corner
    const X = K.LAMP;
    px(g, '#14161c', X - 1, 12, 3, 162);
    px(g, '#22252e', X, 12, 1, 162);
    px(g, '#14161c', X - 4, 168, 9, 6);
    px(g, '#14161c', X - 9, 10, 19, 3);
    px(g, '#14161c', X - 2, 6, 5, 4);
    // the advert screen bolted to the pylon (picture is drawn live)
    px(g, '#0c0d12', X - 6, 58, 13, 26);
    px(g, '#2c303b', X - 6, 58, 13, 1);
    return c;
  }

  function makeInterior() {
    const [c, g] = K.makeCanvas();
    // wall panels, conduit and a low ceiling
    px(g, '#2b2a36', 9, 76, 202, 88);
    for (let x = 9; x < 211; x += 14) px(g, '#24232e', x, 85, 1, 48);
    px(g, '#3a3f4a', 9, 87, 202, 1); // conduit
    for (let x = 30; x < 211; x += 46) px(g, '#454b5a', x, 86, 4, 3);
    px(g, '#1d1c26', 9, 133, 202, 1);
    px(g, '#24232e', 9, 134, 202, 30);
    for (let x = 12; x < 211; x += 9) px(g, '#1f1e28', x, 137, 1, 27);
    for (let y = 140; y < 164; y += 9) px(g, '#1f1e28', 9, y, 202, 1);
    px(g, '#16161e', 9, 76, 202, 6);
    px(g, '#101016', 9, 82, 202, 3);
    // big bookcase: black steel racking
    px(g, '#121319', 10, 85, 58, 79);
    px(g, '#3a3f4a', 10, 85, 2, 79);
    px(g, '#3a3f4a', 66, 85, 2, 79);
    for (const by of [96, 110, 124, 138, 152]) {
      px(g, '#3a3f4a', 12, by, 54, 2);
      px(g, '#58607a', 12, by, 54, 1);
    }
    // the passage, with a violet tube round the arch
    px(g, '#2b2a36', 71, 85, 35, 79);
    const A = B.LAYOUT.arch;
    const cxA = A.x + A.w / 2;
    for (let y = A.y; y < 164; y++) {
      const hw = y === A.y ? 7 : y === A.y + 1 ? 10 : y === A.y + 2 ? 12 : 13.5;
      px(g, '#6a3fc0', Math.round(cxA - hw - 2), y, 1, 1);
      px(g, '#3a3f4a', Math.round(cxA - hw - 1), y, 1, 1);
      px(g, '#3a3f4a', Math.round(cxA + hw), y, 1, 1);
      px(g, '#6a3fc0', Math.round(cxA + hw + 1), y, 1, 1);
      px(g, '#15121e', Math.round(cxA - hw), y, Math.round(hw * 2), 1);
    }
    px(g, '#6a3fc0', Math.round(cxA - 7), A.y - 1, 14, 1);
    px(g, '#0f0d16', 80, 98, 17, 66);
    px(g, '#0a0910', 84, 104, 9, 60);
    const drng = B.seeded('distant');
    for (const by of [114, 124, 134, 144]) {
      px(g, '#2a2c36', 78, by, 11, 1);
      for (let x = 78; x < 89; x += 2) px(g, B.shade(B.pal.books[Math.floor(drng() * B.pal.books.length)], 0.35 + drng() * 0.1), x, by - 5 - Math.floor(drng() * 2), 2, 5);
    }
    // steel stairs to the flat
    for (let i = 0; i < 8; i++) {
      const y = 143 - i * 4;
      const x = 91 + Math.round(i * 1.5);
      px(g, '#4a5060', x, y, 102 - x, 1);
      px(g, '#1c1d25', x, y + 1, 102 - x, 3);
      for (let k = x + 1; k < 102; k += 2) px(g, '#2c303b', k, y + 1, 1, 1);
    }
    B.line(g, 90, 124, 101, 96, '#5d6577');
    px(g, '#5d6577', 89, 124, 2, 20);
    px(g, '#3ff5ff', 89, 122, 2, 1);
    px(g, '#08080c', 76, 85, 25, 7);
    B.text(g, 'POETRY', 77, 86, '#b48cff');
    // narrow bookcase
    px(g, '#121319', 106, 86, 29, 78);
    px(g, '#454b5a', 105, 85, 31, 2);
    px(g, '#3a3f4a', 106, 87, 2, 77);
    px(g, '#3a3f4a', 133, 87, 2, 77);
    for (const by of [100, 114, 128, 142, 156]) {
      px(g, '#3a3f4a', 108, by, 25, 2);
      px(g, '#58607a', 108, by, 25, 1);
    }
    // radio shelf and the sideboard behind the counter
    px(g, '#454b5a', 138, 100, 24, 2);
    px(g, '#2c303b', 140, 102, 2, 4);
    px(g, '#2c303b', 158, 102, 2, 4);
    px(g, '#3a3f4a', 184, 119, 28, 2);
    px(g, '#1a1b23', 185, 121, 27, 43);
    for (let y = 126; y < 164; y += 8) px(g, '#22232d', 186, y, 25, 1);
    // mugs on hooks
    px(g, '#e8e4f0', 143, 104, 3, 4);
    px(g, '#ff3fa4', 148, 104, 3, 4);
    px(g, '#3ff5ff', 153, 104, 3, 4);
    return c;
  }

  function makeCounter() {
    const [c, g] = K.makeCanvas();
    px(g, '#3a3f4a', 134, 127, 76, 2);
    px(g, '#9aa4b8', 134, 127, 76, 1);
    px(g, '#1e2029', 136, 129, 72, 35);
    for (const x of [140, 164, 188]) {
      px(g, '#15161d', x, 132, 20, 1);
      px(g, '#15161d', x, 132, 1, 28);
      px(g, '#2c303b', x + 19, 132, 1, 28);
      px(g, '#1f5560', x + 3, 146, 14, 1); // inlaid light line
    }
    return c;
  }

  // ---------- sky ----------
  const SKY = [
    [0, '#05040c', '#1c0c2c'], [5, '#0b0718', '#2c1238'], [6.5, '#4a3050', '#c46a62'], [8, '#6e7280', '#b09a84'],
    [17, '#6e7280', '#b09a84'], [18.7, '#5a2e5e', '#d8644e'], [20, '#1a0d2e', '#4a1848'], [21.5, '#05040c', '#1c0c2c'],
    [24, '#05040c', '#1c0c2c'],
  ];
  function skyColors(h, cloud) {
    if (B.skyByElevation) {
      const [a, b] = B.skyByElevation(h, true);
      const smog = B.daylight(h) > 0.3 ? '#7a7680' : '#140e22';
      return [B.mix(a, smog, cloud * 0.5), B.mix(b, smog, cloud * 0.5)];
    }
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
    const [h0, a0, b0] = SKY[i];
    const [h1, a1, b1] = SKY[i + 1];
    const t = (h - h0) / (h1 - h0 || 1);
    const smog = B.daylight(h) > 0.3 ? '#7a7680' : '#140e22';
    return [B.mix(B.mix(a0, a1, t), smog, cloud * 0.5), B.mix(B.mix(b0, b1, t), smog, cloud * 0.5)];
  }
  // flying traffic: lanes in the sky band and in the gap at the end of the alley
  const FLYERS = Array.from({ length: 7 }, (_, i) => ({ y: [3, 5, 2, 30, 44, 22, 56][i], sp: 18 + ((i * 7) % 13), ph: i * 97, dir: i % 2 ? 1 : -1, c: [C.red, C.cyan, C.amber, C.pink, '#ffffff', C.violet, C.acid][i] }));
  function flyerX(f, s) {
    const span = 420;
    const x = ((s.simT * f.sp + f.ph * 5) % span) - 50;
    return f.dir > 0 ? x : 320 - x;
  }
  function drawSky(g, s) {
    const [top, bot] = skyColors(s.hour, s.weather.cloud);
    px(g, top, 0, 0, 320, 4);
    px(g, bot, 0, 4, 320, 5);
    const day = B.daylight(s.hour);
    // smog banks drifting
    const cc = day > 0.3 ? 'rgba(150,140,150,0.35)' : 'rgba(120,40,120,0.25)';
    for (let i = 0; i < 3 + Math.round(s.weather.cloud * 3); i++) {
      const x = Math.round(((i * 113 + s.simT * (2 + i)) % 420) - 60);
      px(g, cc, x, 1 + (i % 3) * 2, 40 + (i % 2) * 18, 2);
    }
    for (const f of FLYERS.slice(0, 3)) {
      const x = Math.round(flyerX(f, s));
      px(g, '#0c0c12', x - 3, f.y, 7, 2);
      px(g, f.c, f.dir > 0 ? x + 3 : x - 3, f.y, 1, 1);
      if (Math.floor(NOW() * 2) % 2) px(g, C.red, f.dir > 0 ? x - 3 : x + 3, f.y + 1, 1, 1);
    }
    return bot;
  }

  // ---------- the flat upstairs ----------
  function drawUpstairs(g, s, skyBot) {
    const U = s.upstairs;
    const L = B.LAYOUT;
    const [A, Bw] = L.upstairs;
    const day = B.daylight(s.hour);
    const o = s.owner;
    const W = Bw.x + Bw.w - A.x;
    g.save();
    g.beginPath();
    for (const u of L.upstairs) g.rect(u.x, u.y, u.w, u.h);
    g.clip();
    px(g, '#2e2a3a', A.x, A.y, W, A.h);
    for (let x = A.x; x < Bw.x + Bw.w; x += 8) px(g, '#29253a', x, A.y, 1, A.h);
    px(g, '#454b5a', A.x, 43, W, 1);
    // sitting room: holo poster, floor lamp, armchair, a wall screen
    px(g, '#14121c', 49, 21, 12, 9);
    px(g, U.light ? '#ff3fa4' : '#4a2040', 50, 22, 10, 1);
    px(g, U.light ? '#3ff5ff' : '#1e4a52', 52, 24, 6, 4);
    px(g, '#3a3f4a', 64, 26, 1, 20);
    px(g, U.light ? '#d8f6ff' : '#5a6070', 61, 23, 8, 2);
    px(g, '#3a2650', 44, 28, 6, 19);
    px(g, '#4a3366', 44, 27, 5, 1);
    px(g, '#1a1b23', 70, 41, 16, 6);
    px(g, '#3ff5ff', 70, 41, 16, 1);
    px(g, '#0c0d12', 70, 28, 16, 12);
    let scr = '#0a0c12';
    if (U.tv && B.tvScreen && B.tvScreen(g, 71, 29, 14, 10, s)) {
      for (let y = 29; y < 39; y += 2) px(g, 'rgba(0,0,0,0.15)', 71, y, 14, 1); // scanlines
    } else {
      if (U.tv) scr = K.TV_COLS[Math.floor(s.simT * 2.3) % K.TV_COLS.length];
      px(g, scr, 71, 29, 14, 10);
      if (U.tv) px(g, B.shade(scr, 1.3), 72 + (Math.floor(s.simT * 5) % 8), 31, 4, 3);
    }
    // kitchen corner: smart fridge panel, shelf of tins, kettle, grow-lit herbs
    px(g, '#14161c', 158, 20, 10, 12);
    px(g, U.light ? '#9dff3f' : '#2a4a20', 159, 22, 3, 1);
    px(g, U.light ? '#3ff5ff' : '#1e4a52', 159, 25, 7, 1);
    px(g, '#454b5a', 177, 29, 18, 1);
    px(g, '#ffb238', 179, 25, 3, 4);
    px(g, '#3ff5ff', 184, 26, 3, 3);
    px(g, '#e8e4f0', 189, 25, 3, 4);
    px(g, '#1a1b23', 176, 38, 19, 9);
    px(g, '#5d6577', 176, 38, 19, 1);
    px(g, '#8a93a3', 184, 33, 6, 5);
    px(g, U.kettle > 0 ? '#3ff5ff' : '#2a2c36', 185, 36, 4, 1);
    px(g, '#2c303b', 154, 41, 6, 6);
    px(g, '#b44bff', 153, 31, 8, 1);
    for (const [x0, y0, x1, y1] of [[157, 41, 155, 33], [157, 41, 160, 34], [157, 41, 153, 37], [157, 41, 161, 38]]) B.line(g, x0, y0, x1, y1, '#4fbf6a');
    K.decor(g, s, 'upstairs');
    if (o.area === 'upstairs' && !o.hidden) B.drawPerson(g, o);
    px(g, '#3a2650', 57, 37, 5, 10);
    px(g, '#4a3366', 57, 37, 5, 1);
    K.decor(g, s, 'upstairs-front');
    if (U.kettle > 0 && Math.random() < 0.3) s.particle({ layer: 'up', x: 186 + B.rnd(0, 3), y: 32, vx: B.rnd(-3, 3), vy: -8, life: 1, c: '#e0e6f0', kind: 'steam' });
    K.drawParticles(g, s, 'up');
    if (U.light) {
      px(g, 'rgba(160,120,255,0.07)', A.x, A.y, W, A.h);
      if (U.tv) {
        px(g, 'rgba(10,10,40,0.25)', A.x, A.y, A.w, A.h);
        lighter(g, () => glow(g, 78, 34, 26, `rgba(90,200,255,${0.14 + (Math.floor(s.simT * 2.3) % 3) * 0.05})`));
      }
    } else px(g, `rgba(6,4,20,${0.4 + (1 - day) * 0.5})`, A.x, A.y, W, A.h);
    if (!U.light && day > 0.3) {
      g.globalAlpha = 0.55 * day;
      px(g, B.mix(skyBot, '#14161e', 0.5), A.x, A.y, W, A.h);
      g.globalAlpha = 1;
    }
    g.restore();
    // smart blinds and the hydroponic window box
    for (const u of L.upstairs) {
      if (!U.light) px(g, 'rgba(160,220,255,0.08)', u.x + 3, u.y + 2, 4, u.h - 4);
      const bh = Math.round(3 + U.blind * (u.h - 3));
      const lit = U.light;
      px(g, lit ? '#6a4aa8' : '#2a2c38', u.x, u.y, u.w, bh);
      for (let y = u.y + 2; y < u.y + bh - 1; y += 3) px(g, lit ? '#8a6ad0' : '#343644', u.x, y, u.w, 1);
      px(g, lit ? '#c8a0ff' : '#454b5a', u.x, u.y + bh - 1, u.w, 1);
    }
    const u = L.upstairs[0];
    px(g, '#1a1b23', u.x - 2, u.y + u.h, u.w + 4, 2);
    for (let x = u.x - 2; x < u.x + u.w + 2; x += 5) {
      px(g, '#3c9a5a', x, u.y + u.h - 2, 4, 2);
      px(g, x % 2 ? '#9dff3f' : '#4fbf6a', x + 1, u.y + u.h - 3, 2, 1);
    }
  }

  // ---------- the alley, and the megacity beyond ----------
  const TOWERS = (() => {
    const rng = B.seeded('megacity');
    const list = [];
    for (let x = AL.l - 3; x < AL.r + 3; ) {
      const w = 5 + Math.floor(rng() * 8);
      const top = 4 + Math.floor(rng() * 56);
      const wins = [];
      for (let wy = top + 3; wy < 122; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rng() < 0.45) wins.push([wx, wy, rng()]);
      list.push({ x, w, top, c: ['#1a1826', '#211e30', '#16151f', '#262234'][Math.floor(rng() * 4)], wins, mast: rng() < 0.5 });
      x += w - (rng() < 0.3 ? 2 : 0);
    }
    return list;
  })();
  const WIN_COLS = ['#3ff5ff', '#ff3fa4', '#ffb238', '#a26bff', '#e8f0ff'];

  function drawAlley(g, s, skyTop, skyBot) {
    const day = B.daylight(s.hour);
    const dim = (c, k = 1) => B.mix(c, '#06050c', (1 - day) * 0.6 * k);
    for (let y = 0; y < AL.bot; y++) px(g, B.mix(skyTop, skyBot, Math.min(1, y / 100)), AL.l, y, AL.r - AL.l, 1);
    // megastructures
    for (const t of TOWERS) {
      px(g, dim(t.c), t.x, t.top, t.w, 124 - t.top);
      px(g, dim(B.shade(t.c, 1.4)), t.x, t.top, 1, 124 - t.top);
      if (t.mast) px(g, dim('#2c303b'), t.x + Math.floor(t.w / 2), t.top - 6, 1, 6);
    }
    // flying cars crossing the gap
    for (const f of FLYERS.slice(3)) {
      const x = Math.round(lerp(AL.l - 10, AL.r + 10, ((s.simT * f.sp * 0.25 + f.ph) % 60) / 60));
      const xx = f.dir > 0 ? x : AL.l + AL.r - x;
      px(g, '#0c0c12', xx - 2, f.y, 5, 2);
    }
    // the building closing off the far end (its back carries the CINEMA sign)
    px(g, dim('#1e1a28'), 290, 60, 18, 64);
    for (let y = 62; y < 124; y += 4) px(g, dim('#17141f'), 290, y, 18, 1);
    px(g, dim('#2c303b'), 289, 57, 20, 3);
    px(g, dim('#0c0b12'), 302, 110, 5, 14);
    for (const Lt of K.LETTERS) {
      for (const [x, y] of Lt.px) {
        px(g, dim('#3a3a42'), x, y, 1, 1);
        px(g, dim('#1c1c22'), x + 1, y, 1, 1);
      }
    }
    // far street with the odd tiny passer-by
    px(g, dim('#22222e'), AL.fl, 124, AL.fr - AL.fl, AL.fbot - 124);
    const cyc = (s.simT / 14) % 1;
    const walker = Math.floor(s.simT / 14);
    if (B.hash('w' + walker) % 3 !== 0) {
      const dir = B.hash('d' + walker) % 2 ? 1 : -1;
      const wx = Math.round(dir > 0 ? lerp(AL.fl - 4, AL.fr + 4, cyc) : lerp(AL.fr + 4, AL.fl - 4, cyc));
      px(g, '#1a1b23', wx, 124, 2, 4);
      px(g, dim('#e0ac85'), wx, 122, 2, 2);
      px(g, WIN_COLS[B.hash('c' + walker) % WIN_COLS.length], wx, 125, 2, 1);
    }
    // walls: the side of the shop (concrete) and the neighbour's ribbed cladding
    scan(g, dim('#24252f'), AL.top, AL.bot, () => AL.l, wallL);
    for (let i = 1; i < 16; i++) {
      const k = i / 16;
      B.line(g, AL.l, lerp(AL.top, AL.bot, k), AL.fl, lerp(AL.ftop, AL.fbot, k), dim('#1b1c24'));
    }
    scan(g, dim('#363a46'), AL.top, AL.bot, wallR, () => AL.r);
    scan(g, dim('#2a2d38'), AL.top, AL.bot, wallR, (y) => wallR(y) + 2);
    for (let i = 0; i < 4; i++) B.line(g, AL.r - 2 - i * 3, AL.top, wallR(AL.fbot) + 2 + i, AL.fbot, dim('#2c2f3a'));
    const win = s.hour > 17 || s.hour < 2;
    scan(g, win ? '#4a1a40' : dim('#1a1c24'), 88, 104, (y) => wallR(y) + 3, (y) => wallR(y) + 7);
    B.line(g, 316, AL.top + 2, 309, AL.fbot - 4, dim('#4a4e58'));
    B.line(g, 314, AL.top + 2, 307, AL.fbot - 4, dim('#2c303b'));
    // wet tarmac
    scan(g, dim('#1a1b23'), AL.fbot, AL.bot, wallL, wallR);
    for (let r = 0; r < 7; r++) {
      const y = Math.round(AL.fbot + Math.pow(r / 7, 1.4) * (AL.bot - AL.fbot));
      px(g, dim('#22232d'), Math.round(wallL(y)), y, Math.round(wallR(y) - wallL(y)), 1);
    }
    px(g, 'rgba(120,140,190,0.15)', 293, 140, 9, 2);
    px(g, 'rgba(120,140,190,0.12)', 298, 147, 8, 2);
    if ((s.weather.cover || 0) > 0.05) scan(g, `rgba(220,226,240,${Math.min(0.9, 0.2 + s.weather.cover * 0.7)})`, AL.fbot, AL.bot, wallL, wallR);
    // cables strung across, hung with little LEDs (lit later)
    for (const [y0, y1] of [[38, 41], [47, 49]]) B.line(g, wallL(y0), y0, wallR(y1), y1, dim('#0c0c12'));
    // Mabel's side door: steel, with a keypad
    scan(g, dim('#2c303b'), 112, 150, () => AL.l + 2, (y) => Math.min(wallL(y) - 1, AL.l + 7));
    px(g, dim('#14161c'), AL.l + 3, 106, 4, 2);
    // an e-scooter against the far end
    for (const cx of [296, 302]) for (let a = 0; a < 12; a++) px(g, dim('#101016'), Math.round(cx + Math.cos(a / 2) * 2), Math.round(137 + Math.sin(a / 2) * 2), 1, 1);
    px(g, dim('#2c303b'), 296, 136, 7, 1);
    px(g, dim('#2c303b'), 302, 130, 1, 6);
    px(g, dim('#2c303b'), 301, 130, 3, 1);
    // stacked crates against the shop wall
    px(g, dim('#3a3f4a'), 288, 134, 4, 11);
    px(g, dim('#2c303b'), 289, 136, 4, 9);
    px(g, dim('#ffb238', 1.5), 289, 139, 3, 1);
    // the dumpster
    const bin = s.alley || {};
    if (bin.binTipped) {
      px(g, dim('#24443e'), 300, 140, 12, 6);
      px(g, dim('#1a332e'), 300, 141, 12, 1);
      px(g, dim('#0c0c10'), 311, 140, 2, 6);
      px(g, dim('#2c303b'), 294, 143, 5, 2);
      for (let i = 0; i < 7; i++) px(g, dim(['#e8e4da', '#ff3fa4', '#3a3f4a', '#3ff5ff'][i % 4]), 296 + ((i * 5) % 16), 144 + (i % 3), 2, 1);
    } else if (!bin.binAway) {
      px(g, dim('#24443e'), 302, 134, 9, 11);
      px(g, dim('#2c303b'), 301, 132, 11, 2);
      px(g, dim('#1a332e'), 305, 136, 1, 8);
      px(g, dim('#ffb238', 1.5), 304, 138, 5, 1);
    }
    s.alleyCat = day < 0.3 && Math.floor(s.simT / 90) % 3 === 1;
    if (s.alleyCat) {
      px(g, '#0a0a0e', 304, 127, 5, 5);
      px(g, '#0a0a0e', 305, 125, 3, 3);
      px(g, '#0a0a0e', 305, 124, 1, 1);
      px(g, '#0a0a0e', 307, 124, 1, 1);
      px(g, '#0a0a0e', 309, 128, 1, 4);
    }
    // steam from a vent in the ground
    for (let i = 0; i < 6; i++) {
      const k = (s.simT * 0.35 + i / 6) % 1;
      g.globalAlpha = (1 - k) * 0.3;
      px(g, '#b8bccb', Math.round(296 + Math.sin(k * 5 + i) * 2 + k * 3), Math.round(150 - k * 34), 3 + Math.round(k * 2), 2);
    }
    g.globalAlpha = 1;
    px(g, dim('#0c0c10'), 294, 150, 6, 1);
    K.decor(g, s, 'alley');
  }

  /** Everything that glows: drawn after the night tint. */
  function drawAlleyLights(g, s) {
    const day = B.daylight(s.hour);
    const fog = s.weather.fog || 0;
    const t = NOW();
    const night = 1 - day;
    K.drawNeon(g, s, day);
    // megacity windows, mast beacons, a giant holo advert and the flying cars' lights
    g.save();
    g.beginPath();
    g.rect(AL.l, 0, AL.r - AL.l, AL.fbot);
    g.clip();
    const wk = (0.3 + 0.7 * night) * (1 - 0.7 * fog);
    for (const tw of TOWERS)
      for (const [wx, wy, r] of tw.wins) {
        if (r > 0.55 || !(wx > wallL(wy) && wx < wallR(wy))) continue;
        g.globalAlpha = wk * (0.5 + r);
        px(g, WIN_COLS[Math.floor(r * 100) % WIN_COLS.length], wx, wy, 1, 1);
      }
    g.globalAlpha = 1;
    for (const tw of TOWERS) if (tw.mast && Math.floor(t * 1.3 + tw.x) % 3 === 0) px(g, C.red, tw.x + Math.floor(tw.w / 2), tw.top - 6, 1, 1);
    // holo billboard on the tallest tower: cycling colours and a scrolling shape
    const hb = { x: 300, y: 18, w: 13, h: 18 };
    const hc = [C.pink, C.cyan, C.violet, C.amber][Math.floor(t / 4) % 4];
    if (flicker('holo', 0.05)) {
      g.globalAlpha = 0.55 * (1 - 0.6 * fog);
      px(g, hc, hb.x, hb.y, hb.w, hb.h);
      g.globalAlpha = 0.9 * (1 - 0.6 * fog);
      const ph = Math.floor(t * 6) % hb.h;
      for (let y = 0; y < hb.h; y += 2) px(g, B.mix(hc, '#ffffff', 0.5), hb.x + 2 + ((y + ph) % 9), hb.y + y, 3, 1);
      g.globalAlpha = 1;
      lighter(g, () => glow(g, hb.x + 6, hb.y + 9, 16, rgba(hc, 0.25 * (0.4 + night))));
    }
    for (const f of FLYERS.slice(3)) {
      const x = Math.round(lerp(AL.l - 10, AL.r + 10, ((s.simT * f.sp * 0.25 + f.ph) % 60) / 60));
      const xx = f.dir > 0 ? x : AL.l + AL.r - x;
      px(g, '#ffffff', f.dir > 0 ? xx + 2 : xx - 2, f.y, 1, 1);
      px(g, rgba(f.c, 0.5), f.dir > 0 ? xx - 6 : xx + 3, f.y + 1, 4, 1); // light trail
    }
    g.restore();
    // LEDs strung across the alley, swaying
    const sway = Math.sin(s.simT * 1.7) * 0.6;
    for (const [y0, y1, off] of [[38, 41, 0], [47, 49, 2]]) {
      for (let i = 0; i < 7; i++) {
        const k = (i + 0.5) / 7;
        const x = Math.round(lerp(wallL(y0), wallR(y1), k) + sway);
        const y = Math.round(lerp(y0, y1, k) + Math.sin(k * Math.PI) * 2);
        px(g, [C.pink, C.cyan, C.amber][(i + off + Math.floor(t * 1.5)) % 3], x, y + 1, 1, 1);
      }
    }
    // the neighbour's window, the side door light
    if (s.hour > 17 || s.hour < 2) scan(g, rgba(C.pink, 0.55), 89, 103, (y) => wallR(y) + 4, (y) => wallR(y) + 6);
    px(g, C.acid, AL.l + 3, 106, 3, 1);
    px(g, rgba(C.cyan, 0.9), AL.l + 6, 128, 1, 2);
    lighter(g, () => glow(g, AL.l + 5, 108, 10, rgba(C.acid, 0.18 * (0.3 + night))));
    if (s.alleyCat && Math.floor(s.simT * 0.5) % 5) {
      px(g, '#9be35b', 305, 126, 1, 1);
      px(g, '#9be35b', 307, 126, 1, 1);
    }
    drawShopNeon(g, s, day);
  }

  /** The shop's own neon: the name on the fascia, holo labels over the window, the door number. */
  function drawShopNeon(g, s, day) {
    const fog = s.weather.fog || 0;
    const open = s.shop.open || s.shop.lights;
    const name = B.config.shopName;
    const x0 = Math.round(137 - B.textWidth(name, 3) / 2);
    const k = (day > 0.6 ? 0.85 : 1) * (1 - 0.3 * fog);
    if (open || day < 0.9) { // the neon comes on as dusk falls
      g.globalAlpha = k;
      // letter by letter, so one tube can misbehave
      let x = x0;
      for (let i = 0; i < name.length; i++) {
        const ch = name[i];
        const bad = i === name.length - 2 && !flicker('tube', 0.03);
        if (!bad && ch !== ' ') neonText(g, ch, x, 56, C.pink, 3);
        x += B.textWidth(name.slice(0, i + 1), 3) - B.textWidth(name.slice(0, i), 3);
      }
      g.globalAlpha = 1;
      lighter(g, () => {
        const gr = g.createLinearGradient(0, 46, 0, 80);
        gr.addColorStop(0, rgba(C.pink, 0));
        gr.addColorStop(0.5, rgba(C.pink, 0.16 * (1 - 0.7 * day) * (1 + fog))); // neon looks thin in daylight, strikes up at dusk
        gr.addColorStop(1, rgba(C.pink, 0));
        g.fillStyle = gr;
        g.fillRect(0, 46, 274, 34);
      });
    }
    // holographic section labels, gently scanning
    const W = B.LAYOUT.win;
    const scanY = Math.floor(NOW() * 10) % 8;
    for (const [label, a, b] of [['FICTION', 9, 76], ['POETRY', 78, 144], ['MAPS & PRINTS', 146, 211]]) {
      const lx = Math.round((a + b) / 2 - B.textWidth(label) / 2);
      g.globalAlpha = 0.85;
      B.text(g, label, lx, 78, C.cyan);
      g.globalAlpha = 1;
    }
    px(g, rgba(C.cyan, 0.18), W.x, W.y + scanY, W.w, 1);
    // door number
    neonText(g, '12', 244 - Math.floor(B.textWidth('12') / 2), 80, C.amber);
  }

  // ---------- interior props ----------
  function drawClock(g, s) {
    // a little LED clock above the coffee machine
    px(g, '#07080c', 186, 87, 24, 9);
    px(g, '#2c303b', 186, 87, 24, 1);
    const hh = String(Math.floor(s.hour)).padStart(2, '0');
    const mm = String(Math.floor(s.time % 60)).padStart(2, '0');
    const colon = Math.floor(NOW() * 2) % 2 ? ':' : ' ';
    B.text(g, hh + colon + mm, 188, 89, C.red);
  }

  function drawPendants(g, s) {
    const lit = s.shop.lights;
    px(g, lit ? '#d8e8ff' : '#2a2c36', 9, 81, 202, 1); // LED strip along the ceiling
    for (const x of [40, 170]) {
      px(g, '#14161c', x, 85, 1, 4);
      px(g, '#14161c', x - 5, 89, 11, 2);
      px(g, lit ? '#e8f6ff' : '#3a3f4a', x - 4, 91, 9, 1);
      px(g, lit ? C.cyan : '#2c303b', x - 5, 90, 1, 1);
      px(g, lit ? C.cyan : '#2c303b', x + 5, 90, 1, 1);
    }
  }

  function drawRadio(g, s) {
    const on = s.radio.on;
    const st = s.radio.station;
    const col = (on && st.color) || '#3a3f4a';
    // a battered boombox
    px(g, '#14161c', 140, 89, 18, 11);
    px(g, '#3a3f4a', 140, 89, 18, 1);
    px(g, '#2c303b', 140, 99, 18, 1);
    const pulse = on && Math.floor(s.simT * 4) % 2;
    for (const cx of [143, 155]) {
      px(g, '#22252e', cx - 2, 93, 5, 5);
      px(g, pulse ? '#454b5a' : '#2c303b', cx - 1, 94, 3, 3);
      px(g, '#0a0a0e', cx, 95, 1, 1);
    }
    // the equaliser in the station's colour
    for (let i = 0; i < 6; i++) {
      const h = on ? 1 + ((B.hash(i + ':' + Math.floor(NOW() * 8)) >> 3) % 4) : 1;
      px(g, on ? col : '#22252e', 146 + i, 98 - h, 1, h);
    }
    px(g, on ? col : '#22252e', 146, 91, 6, 1);
    px(g, '#5d6577', 156, 80, 1, 9);
    if (on) px(g, C.red, 156, 80, 1, 1);
  }

  function drawCoffee(g, s) {
    const on = s.coffee.brewing > 0;
    // chrome synth-caf dispenser
    px(g, '#5d6577', 190, 99, 16, 20);
    px(g, '#8a93a3', 190, 99, 16, 1);
    px(g, '#8a93a3', 191, 100, 1, 18);
    px(g, '#3a3f4a', 204, 100, 2, 19);
    px(g, '#0a0b10', 193, 102, 10, 6);
    px(g, on ? C.amber : '#3a2a10', 194, 103, on ? 2 + (Math.floor(s.simT * 3) % 7) : 3, 1);
    px(g, on ? C.cyan : '#1e4a52', 194, 106, 8, 1);
    px(g, '#14161c', 194, 110, 8, 7); // cup bay
    px(g, on ? rgba(C.cyan, 0.6) : '#1a1d25', 194, 110, 8, 1);
    px(g, '#8a93a3', 192, 117, 12, 2);
    if (on) {
      px(g, '#e8e4f0', 196, 114, 4, 3);
      if (Math.floor(s.simT * 8) % 2) px(g, '#3a2418', 197, 112, 1, 2);
    }
  }

  function drawCounterItems(g, s) {
    g.drawImage(B.cache.counter, 0, 0);
    const top = B.LAYOUT.counterTop - 2;
    // LED arm lamp
    px(g, '#3a3f4a', 135, top, 9, 1);
    B.line(g, 139, top, 137, top - 6, '#5d6577');
    B.line(g, 137, top - 6, 142, top - 10, '#5d6577');
    px(g, '#2c303b', 139, top - 11, 7, 2);
    px(g, s.lamp ? '#e8f6ff' : '#3a3f4a', 140, top - 9, 5, 1);
    // phone: a sleek base and handset; a holo ring flares when it rings
    let x = 146;
    const ringing = s.phone.ringing && s.phone.ringT % 3 < 1.1;
    if (ringing) x += Math.floor(s.simT * 30) % 2 ? 1 : -1;
    px(g, '#0e0f14', x, top - 4, 12, 4);
    px(g, '#2c303b', x + 1, top - 5, 10, 1);
    px(g, ringing ? C.cyan : '#1e4a52', x + 3, top - 3, 6, 1);
    if (!s.phone.offHook) {
      px(g, '#14161c', x - 1, top - 8, 14, 2);
      px(g, C.cyan, x + 1, top - 8, 10, 1);
      px(g, '#14161c', x - 1, top - 6, 2, 1);
      px(g, '#14161c', x + 11, top - 6, 2, 1);
    }
    if (ringing) {
      const r = 6 + (Math.floor(s.simT * 8) % 3) * 2;
      g.globalAlpha = 0.7;
      for (let a = 0; a < 16; a++) px(g, C.cyan, Math.round(x + 6 + Math.cos((a / 16) * Math.PI * 2) * r), Math.round(top - 10 + Math.sin((a / 16) * Math.PI * 2) * r * 0.35), 1, 1);
      g.globalAlpha = 1;
    }
    // payment terminal
    const tx = 160;
    const ty = 110;
    px(g, '#1a1b23', tx, ty + 6, 14, top - ty - 6);
    px(g, '#3a3f4a', tx, ty + 6, 14, 1);
    px(g, '#0a0b10', tx + 2, ty, 10, 6);
    px(g, '#9dff3f', tx + 3, ty + 2, 6, 1);
    px(g, '#3ff5ff', tx + 3, ty + 4, 3, 1);
    for (const ky of [ty + 9, ty + 12]) for (let i = 0; i < 5; i++) px(g, '#5d6577', tx + 2 + i * 2, ky, 1, 1);
    if (s.till.dingT > 0) {
      g.globalAlpha = 0.85;
      px(g, rgba(C.acid, 0.35), tx + 1, ty - 9, 12, 8); // a holo receipt
      B.text(g, '£', tx + 6, ty - 7, C.acid);
      g.globalAlpha = 1;
    }
    if (s.counter.cup) {
      px(g, '#e8e4f0', 178, top - 4, 4, 4);
      px(g, '#e8e4f0', 182, top - 3, 1, 2);
    }
    s.boxes.slice(0, 2).forEach((b, i) => {
      const by = top - 11 - i * 11;
      px(g, '#3a3f4a', 190, by, 16, 11);
      px(g, '#5d6577', 190, by, 16, 1);
      px(g, C.amber, 192, by + 4, 5, 1);
    });
    if (s.counter.box) {
      px(g, '#3a3f4a', 190, top - 8, 16, 8);
      px(g, '#5d6577', 190, top - 8, 16, 1);
      px(g, '#2c303b', 188, top - 10, 5, 3);
      px(g, '#2c303b', 203, top - 10, 5, 3);
    }
  }

  function drawDisplay(g, s) {
    const cols = s.display.cols;
    const wet = s.plant.water > 0.3;
    // a bonsai under a grow light
    px(g, '#14161c', 10, 109, 13, 1);
    px(g, '#b44bff', 11, 110, 11, 1);
    px(g, '#2c303b', 11, 135, 11, 9);
    px(g, '#5d6577', 11, 135, 11, 1);
    const leaf = wet ? '#3c9a5a' : '#6a7a4a';
    B.line(g, 16, 134, 15, 124, '#3a2a20');
    B.line(g, 15, 126, 11, 121, '#3a2a20');
    B.line(g, 15, 124, 20, 119, '#3a2a20');
    px(g, leaf, 8, 118, 6, 3);
    px(g, leaf, 17, 116, 6, 3);
    px(g, leaf, 12, 113, 6, 3);
    if (wet) px(g, '#9dff3f', 13, 113, 2, 1);
    // a paper book on a stand beside a glowing reader
    px(g, '#3a3f4a', 32, 134, 2, 10);
    px(g, '#3a3f4a', 44, 134, 2, 10);
    px(g, cols[0], 28, 126, 22, 11);
    px(g, '#e8e4dc', 29, 127, 9, 9);
    px(g, '#c8dcf0', 40, 127, 9, 9);
    for (let y = 129; y < 135; y += 2) {
      px(g, '#a8a4a0', 30, y, 7, 1);
      px(g, '#5a7aa0', 41, y, 7, 1);
    }
    for (let i = 0; i < 4; i++) px(g, cols[1 + i], 54 + (i % 2), 141 - i * 3, 13, 3);
    for (let i = 0; i < 2; i++) px(g, cols[5 + i], 194 + (i % 2), 141 - i * 3, 13, 3);
  }

  function interiorLight(g, s, day, lit) {
    const W = B.LAYOUT.win;
    const dark = lit ? (1 - day) * 0.08 : 0.32 + (1 - day) * 0.5;
    px(g, `rgba(8,6,24,${dark})`, W.x, W.y, W.w, W.h);
    lighter(g, () => {
      if (lit) {
        px(g, 'rgba(120,150,255,0.04)', W.x, W.y, W.w, W.h);
        const k = 0.08 + (1 - day) * 0.08;
        glow(g, 40, 94, 40, `rgba(170,220,255,${k})`);
        glow(g, 170, 94, 40, `rgba(170,220,255,${k})`);
        glow(g, 88, 104, 16, 'rgba(162,107,255,0.14)'); // the arch's tube
        glow(g, 16, 112, 14, 'rgba(180,75,255,0.12)'); // grow light
      }
      if (s.lamp) glow(g, 142, 120, 22, 'rgba(200,240,255,0.25)');
      if (s.radio.on) glow(g, 149, 94, 12, rgba(s.radio.station.color || C.cyan, 0.16));
      if (s.coffee.brewing > 0) glow(g, 198, 112, 10, rgba(C.cyan, 0.2));
      if (!lit && day < 0.5) glow(g, 16, 112, 16, 'rgba(180,75,255,0.14)');
    });
  }

  // ---------- door & street ----------
  let leafC = null;
  function paintLeaf(s, lit) {
    const D = B.LAYOUT.doorOpening;
    if (!leafC) {
      leafC = document.createElement('canvas');
      leafC.width = D.w;
      leafC.height = D.h;
    }
    const g = leafC.getContext('2d');
    const P = (c, x, y, w, h) => px(g, c, x - D.x, y - D.y, w, h);
    g.clearRect(0, 0, D.w, D.h);
    P(C.steel, D.x, D.y, D.w, D.h);
    P(C.steelD, D.x, D.y, 1, D.h);
    P(C.steelL, D.x + D.w - 1, D.y, 1, D.h);
    const Gl = B.LAYOUT.doorGlass;
    P(lit ? '#3a3a5a' : '#0c0d14', Gl.x, Gl.y, Gl.w, Gl.h);
    P('rgba(160,220,255,0.08)', Gl.x + 3, Gl.y + 2, 4, Gl.h - 4);
    for (const y of [136, 150]) {
      P(C.steelD, 231, y, 26, 11);
      for (let k = 1; k < 10; k += 2) P('#14161c', 232, y + k, 24, 1);
    }
    P(C.steelH, 256, 124, 2, 8); // pull handle
    // LED sign hung in the glass
    const txt = s.shop.open ? 'OPEN' : 'CLOSED';
    P('#060608', 231, 107, 27, 9);
    P(C.steelL, 231, 107, 27, 1);
    const tx = 244 - Math.floor(B.textWidth(txt) / 2);
    B.text(g, txt, tx - D.x, 109 - D.y, s.shop.open ? C.acid : C.red);
    if (s.door.note) {
      P('#e8e4dc', 233, 118, 22, 12);
      B.text(g, s.door.note[0], 244 - Math.floor(B.textWidth(s.door.note[0]) / 2) - D.x, 119 - D.y, '#2a2030');
      B.text(g, s.door.note[1], 244 - Math.floor(B.textWidth(s.door.note[1]) / 2) - D.x, 125 - D.y, '#2a2030');
    }
    return leafC;
  }

  function drawDoorway(g, s, lit) {
    const D = B.LAYOUT.doorOpening;
    px(g, lit ? '#2b2a36' : '#14131c', D.x, D.y, D.w, D.h);
    for (let x = D.x + 2; x < D.x + D.w; x += 9) px(g, lit ? '#24232e' : '#101018', x, D.y + 6, 1, 50);
    px(g, '#101016', D.x, D.y, D.w, 4);
    px(g, lit ? '#d8e8ff' : '#2a2c36', D.x, D.y + 3, D.w, 1);
    px(g, '#121319', 237, 104, 20, 46);
    const cols = B.pal.books;
    for (const [i, by] of [111, 121, 131, 141].entries()) {
      px(g, lit ? '#58607a' : '#22252e', 237, by, 20, 1);
      for (let x = 238; x < 256; x += 3) px(g, lit ? cols[(x * 7 + i * 3) % cols.length] : '#1e1e28', x, by - 7 - ((x + i) % 3), 3, 7 + ((x + i) % 3));
    }
    px(g, '#3a3f4a', 230, 108, 1, 42);
    px(g, lit ? '#2a2236' : '#16141c', 228, 112, 5, 16);
    px(g, C.cyan, 229, 120, 1, 6);
    px(g, lit ? '#1e2029' : '#101016', D.x, 150, D.w, 14);
    for (let y = 152; y < 164; y += 3) px(g, lit ? '#262833' : '#15161d', D.x, y, D.w, 1);
    px(g, lit ? '#3a2a4a' : '#1a1622', D.x + 5, 158, D.w - 10, 5);
    if (lit) px(g, 'rgba(150,180,255,0.06)', D.x, D.y, D.w, D.h);
    else px(g, 'rgba(4,4,16,0.4)', D.x, D.y, D.w, D.h);
  }

  function drawDoor(g, s) {
    const lit = s.shop.lights;
    const D = B.LAYOUT.doorOpening;
    const k = s.door.open || 0;
    if (k > 0.01) drawDoorway(g, s, lit);
    const leaf = paintLeaf(s, lit);
    if (k <= 0.01) g.drawImage(leaf, D.x, D.y);
    else {
      const lg = leaf.getContext('2d');
      lg.fillStyle = `rgba(0,0,0,${k * 0.35})`;
      lg.fillRect(0, 0, D.w, D.h);
      const w = Math.max(3, Math.round(D.w * Math.cos(k * 1.3)));
      const inset = Math.round(k * 5);
      for (let dx = 0; dx < w; dx++) {
        const sx = Math.min(D.w - 1, Math.floor((dx * D.w) / w));
        const ins = Math.round((inset * dx) / w);
        g.drawImage(leaf, sx, 0, 1, D.h, D.x + dx, D.y + ins, 1, D.h - 2 * ins);
      }
      px(g, C.steelD, D.x + w, D.y + inset, 2, D.h - 2 * inset);
    }
    // a chrome bell with a status LED
    const swing = s.door.bellT > 0 ? Math.round(Math.sin(s.door.bellT * 25) * 2) : 0;
    px(g, '#14161c', 228, 93, 8, 1);
    px(g, '#14161c', 234, 94, 1, 2);
    px(g, '#8a93a3', 232 + swing, 96, 5, 3);
    px(g, '#c8d0dc', 231 + swing, 99, 7, 1);
    px(g, s.door.bellT > 0 ? C.amber : '#2c303b', 234 + swing, 100, 1, 1);
    if (s.door.bellMuted) px(g, '#b8b0a2', 232, 97, 5, 3);
    if (s.door.bellT > 0.6 && !s.door.bellMuted) {
      px(g, C.amber, 228, 97, 1, 2);
      px(g, C.amber, 240, 97, 1, 2);
    }
    // keypad light and the LED strip under the window sill
    px(g, s.shop.locked ? C.red : C.acid, 264, 119, 1, 1);
    px(g, lit ? '#3ff5ff' : '#1e4a52', 6, 147, 208, 1);
  }

  function drawChalkboard(g, s) {
    if (!s.shop.open) return;
    // a holo A-board: the frame is real, the words are projected
    px(g, '#14161c', 282, 164, 3, 8);
    px(g, '#14161c', 309, 164, 3, 8);
    px(g, '#14161c', 284, 168, 26, 1);
    px(g, '#2c303b', 281, 145, 32, 21);
    px(g, '#07080c', 283, 146, 28, 19);
    const on = flicker('board', 0.04);
    if (!on) return;
    g.globalAlpha = 0.9;
    B.chalkLines().forEach((line, i) => B.text(g, line, 297 - Math.floor(B.textWidth(line) / 2), 147 + i * 6, C.cyan));
    g.globalAlpha = 1;
    px(g, rgba(C.cyan, 0.15), 283, 146 + (Math.floor(NOW() * 9) % 19), 28, 1);
  }

  const ADS = [
    ['#ff3fa4', 'SYNTH'], ['#3ff5ff', 'NOODL'], ['#ffb238', 'BOOKS'], ['#a26bff', 'DREAM'], ['#9dff3f', 'VOID'],
  ];
  function drawStreetLamp(g, day, fog = 0, s) {
    const X = K.LAMP;
    const t = NOW();
    // the advert screen on the pylon: a word sliding down, one letter at a time
    const [col, word] = ADS[Math.floor(t / 5) % ADS.length];
    px(g, rgba(col, 0.25), X - 5, 59, 11, 24);
    const off = Math.floor(t * 4) % (word.length + 3);
    for (let i = 0; i < word.length; i++) if (i <= off) B.text(g, word[i], X - 1, 60 + i * 5, col);
    px(g, rgba('#ffffff', 0.12), X - 5, 59 + (Math.floor(t * 12) % 24), 11, 1);
    lighter(g, () => glow(g, X, 71, 14 + fog * 8, rgba(col, (day > 0.6 ? 0.08 : 0.22) * (1 + fog * 0.5))));
    // the light bar
    const on = (s && B.sunPos ? B.sunPos(s.hour).e < -1 : day < 0.6) || fog > 0.4;
    px(g, on ? '#e8f8ff' : '#7a8494', X - 8, 13, 17, 1);
    if (!on) return;
    lighter(g, () => {
      const a = (0.6 - Math.min(day, 0.6)) * 0.45 + fog * 0.2;
      let gr = g.createRadialGradient(X, 14, 1, X, 14, 50 + fog * 30);
      gr.addColorStop(0, `rgba(170,230,255,${a})`);
      gr.addColorStop(1, 'rgba(170,230,255,0)');
      g.fillStyle = gr;
      g.fillRect(X - 80, 0, 160, 110);
      g.save();
      g.scale(1, 0.25);
      gr = g.createRadialGradient(X, 172 * 4, 1, X, 172 * 4, 44);
      gr.addColorStop(0, `rgba(150,220,255,${a * 0.7})`);
      gr.addColorStop(1, 'rgba(150,220,255,0)');
      g.fillStyle = gr;
      g.fillRect(X - 48, 162 * 4, 96, 18 * 4);
      g.restore();
    });
  }

  /** Light from the shop, and the neon reflected in the wet pavement. */
  function shopSpill(g, s, day, lit) {
    const W = B.LAYOUT.win;
    const wet = 0.5 + 0.5 * Math.min(1, (s.weather.rain || 0) * 2);
    lighter(g, () => {
      if (lit && day < 0.8) {
        g.fillStyle = `rgba(140,170,255,${(0.8 - day) * 0.1})`;
        g.beginPath();
        g.moveTo(W.x, 164);
        g.lineTo(W.x + W.w, 164);
        g.lineTo(W.x + W.w + 20, 180);
        g.lineTo(W.x - 20, 180);
        g.fill();
      }
      // reflections: broken vertical streaks under the sign and the pylon's advert
      const k = (day > 0.6 ? 0.06 : 0.16) * wet;
      const t = NOW();
      for (let x = 30; x < 250; x += 6) {
        const wob = Math.round(Math.sin(t * 2 + x) * (s.weather.rain > 0.3 ? 1 : 0.4));
        px(g, rgba(C.pink, k * (0.6 + 0.4 * Math.sin(x * 0.3))), x + wob, 165 + (x % 3), 3, 5 + (x % 4));
      }
      px(g, rgba(C.cyan, k * 0.8), 6, 165, 208, 1);
      px(g, rgba(C.cyan, k * 1.2), K.LAMP - 4, 166, 9, 8);
    });
  }

  // ---------- people ----------
  const ACCENTS = [C.pink, C.cyan, C.violet, C.amber, C.acid, '#ff5f3f'];
  const looks = new WeakMap();
  const dark = (col, k) => (col ? B.mix(B.shade(col, 0.8), '#181a24', k) : col);
  function styleLook(L) {
    if (B.theme !== 'cyber' || !L) return L;
    let c = looks.get(L);
    if (c) return c;
    if (L === B.looks.owner) {
      // Mabel: silver hair, plum techknit cardigan with lit buttons, AR reading lenses
      c = Object.assign({}, L, {
        hair: '#d8d4ea', top: '#3e3050', top2: '#1c1d26', buttons: C.cyan, bottom: '#2a2232', tights: '#15151d',
        shoes: '#101016', glassesC: C.cyan, neon: C.cyan, mug: '#e8e4f0',
      });
    } else if (L === B.looks['owner-night']) {
      c = Object.assign({}, L, { top: '#4a2a50', bottom: '#4a2a50', top2: '#2a2232', shoes: '#3a2440', neon: C.pink });
    } else if (L === B.looks.courier) {
      c = Object.assign({}, L, { top: '#c4501a', bottom: '#1a1b23', hat: '#1a1b23', shoes: '#101016', neon: C.amber, visor: true });
    } else {
      const h = B.hash(JSON.stringify(L));
      const acc = ACCENTS[h % ACCENTS.length];
      c = Object.assign({}, L, {
        top: dark(L.top, 0.55), top2: dark(L.top2, 0.6), sleeve: dark(L.sleeve, 0.55), bottom: dark(L.bottom, 0.65),
        tights: dark(L.tights, 0.5), shoes: '#121318', hat: dark(L.hat, 0.55), apron: dark(L.apron, 0.5),
        scarf: L.scarf ? acc : L.scarf, buttons: L.buttons && acc, glassesC: L.glasses ? acc : L.glassesC, neon: acc,
        hair: (h >> 3) % 4 === 0 ? B.mix(acc, '#ffffff', 0.15) : L.hair,
        cyEye: (h >> 5) % 3 === 0, visor: !L.glasses && (h >> 7) % 6 === 0, circuit: (h >> 9) % 4 === 0,
      });
    }
    looks.set(L, c);
    return c;
  }

  function personAccents(g, a, L, o) {
    if (B.theme !== 'cyber' || !L.neon) return;
    const { cx, sy, waist, hx, hy, d, fd, back, side, P, face } = o;
    const n = L.neon;
    // LED piping: the jacket's hem, its front edges, a strip down the spine from behind
    P(n, cx - (side ? 4 : 5), waist - 1, side ? 9 : 11, 1);
    if (back) P(n, cx - 1, sy + 2, 1, 7);
    else if (d === 0) {
      P(n, cx - 3, sy, 1, 2);
      P(n, cx + 2, sy, 1, 2);
    } else P(n, fd > 0 ? cx + 4 : cx - 5, sy + 1, 1, waist - sy - 2);
    if (back || a.blinking > 0) return;
    const { ey, eyes } = face;
    if (L.visor) {
      g.globalAlpha = 0.85;
      if (d === 0) P(n, hx + 1, ey - 1, 6, 2);
      else P(n, fd > 0 ? hx + 4 : hx, ey - 1, 4, 2);
      g.globalAlpha = 1;
      P('#ffffff', d === 0 ? hx + 1 : eyes[0], ey - 1, 1, 1);
    } else if (L.cyEye) P(n, eyes[eyes.length - 1], ey, 1, 1);
    if (L.circuit && d !== 0) {
      const tx = fd > 0 ? hx + 3 : hx + 4;
      P(n, tx, ey - 1, 1, 1);
      P(n, tx, ey + 1, 1, 1);
    }
  }

  // ---------- the colour grade and bloom over the whole frame ----------
  let bright = null;
  let brightG = null;
  let brightImg = null;
  let blur1 = null;
  let blur2 = null;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  function post(g, s, day) {
    if (!g.getImageData) return;
    let img;
    try {
      img = g.getImageData(0, 0, B.W, B.H);
    } catch (e) {
      return;
    }
    if (!img || !img.data) return;
    if (!bright) {
      bright = mk(B.W, B.H);
      brightG = bright.getContext('2d');
      blur1 = mk(80, 45);
      blur2 = mk(40, 23);
      brightImg = brightG.createImageData(B.W, B.H);
      if (!brightImg || !brightImg.data) return;
    }
    const d = img.data;
    const bd = brightImg.data;
    const nightish = day < 0.5;
    const haze = 0.16 * day; // by day the city sits under a pale smog
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] + (168 - d[i]) * haze;
      let gg = d[i + 1] + (160 - d[i + 1]) * haze;
      let b = d[i + 2] + (170 - d[i + 2]) * haze;
      const mx = Math.max(r, gg, b);
      const sat = mx - Math.min(r, gg, b);
      const lum = r * 0.3 + gg * 0.59 + b * 0.11;
      // earthy, unsaturated colours drift towards cool grey; neon keeps its punch
      if (sat < 110) {
        const k = 0.3 * (1 - sat / 110);
        r += (lum - r) * k;
        gg += (lum - gg) * k;
        b += (lum - b) * k;
      }
      // shadows go blue-violet
      const sh = 1 - lum / 255;
      const sh2 = sh * sh;
      r += -10 * sh2;
      gg += -8 * sh2;
      b += 20 * sh2;
      r = (r - 128) * 1.07 + 126;
      gg = (gg - 128) * 1.07 + 124;
      b = (b - 128) * 1.07 + 132;
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      // what blooms: saturated brights (neon), and anything near white at night
      if ((sat > 100 && mx > 175) || (nightish && lum > 225)) {
        bd[i] = d[i];
        bd[i + 1] = d[i + 1];
        bd[i + 2] = d[i + 2];
        bd[i + 3] = 255;
      } else bd[i + 3] = 0;
    }
    g.putImageData(img, 0, 0);
    brightG.putImageData(brightImg, 0, 0);
    const b1 = blur1.getContext('2d');
    const b2 = blur2.getContext('2d');
    b1.imageSmoothingEnabled = true;
    b2.imageSmoothingEnabled = true;
    b1.clearRect(0, 0, 80, 45);
    b1.drawImage(bright, 0, 0, 80, 45);
    b2.clearRect(0, 0, 40, 23);
    b2.drawImage(blur1, 0, 0, 40, 23);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.imageSmoothingEnabled = true;
    g.globalAlpha = nightish ? 0.6 : 0.35;
    g.drawImage(blur1, 0, 0, B.W, B.H);
    g.globalAlpha = nightish ? 0.5 : 0.3;
    g.drawImage(blur2, 0, 0, B.W, B.H);
    g.restore();
    g.imageSmoothingEnabled = false;
  }

  B.styleLook = styleLook;
  B.personAccents = personAccents;
  B.themes.cyber = {
    makeFacade, makeStreet, makeInterior, makeCounter,
    skyColors, drawSky, drawUpstairs, drawAlley, drawAlleyLights,
    drawClock, drawRadio, drawCoffee, drawPendants, drawCounterItems, drawDisplay, interiorLight,
    drawDoor, drawChalkboard, drawStreetLamp, shopSpill,
    passageShade: (g, A) => px(g, 'rgba(8,4,20,0.28)', A.x, A.y, A.w, A.h),
    nightTint: (night) => `rgba(6,4,20,${night * 0.88})`,
    phoneCord: '#1e8a9a',
    post,
  };
})();
