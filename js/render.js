/* Scene rendering at 320x180, framed close on the shopfront. Static parts are pre-rendered once.
 * Geometry lives in B.LAYOUT (world.js): ground line G=164, people ~60px tall, low ceiling. */
(function () {
  'use strict';
  const B = window.Bookshop;
  const px = B.px;
  const G = '#24463d';
  const G2 = '#2f5a4e';
  const G3 = '#18302a';
  const GOLD = '#d8a84a';
  const WOOD = '#6b4226';
  const WOOD_D = '#4a2c17';
  const WOOD_L = '#8a5a34';
  const LAMP = 277; // street lamp x (on the shop's corner pier)

  function makeCanvas() {
    const c = document.createElement('canvas');
    c.width = B.W;
    c.height = B.H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
  }
  const shadowText = (g, str, x, y, c, sc = 1, sh = 'rgba(15,31,26,0.75)') => {
    B.text(g, str, x + sc, y + sc, sh, sc);
    B.text(g, str, x, y, c, sc);
  };

  // ---------- static layers ----------
  function makeFacade() {
    const [c, g] = makeCanvas();
    const L = B.LAYOUT;
    const rng = B.seeded('bricks-v2');
    // cornice (the alley gap 280..318 is left open and drawn live)
    px(g, '#cfc3ad', 0, 8, 280, 3);
    px(g, '#a89c86', 0, 11, 280, 1);
    for (let x = 0; x < 280; x += 4) px(g, '#b8ac96', x, 12, 2, 1);
    // brick above the shop
    px(g, '#8c6a58', 0, 13, 274, 40);
    for (let row = 0; 13 + row * 5 < 53; row++) {
      const y = 13 + row * 5;
      for (let x = row % 2 ? -5 : 0; x < 274; x += 10) {
        const v = rng();
        px(g, v < 0.15 ? '#8a4636' : v < 0.3 ? '#74392b' : '#7f4031', x, y, 9, 4);
        if (v > 0.85) px(g, '#93503e', x + 1, y, 5, 1);
      }
    }
    // the shop building's corner pier, then the alley, then the edge of the neighbour's house
    px(g, '#6e3a2c', 274, 8, 6, 156);
    for (let y = 13; y < 164; y += 5) px(g, '#7f4031', y % 10 === 3 ? 274 : 276, y, 4, 4);
    px(g, '#5a2e22', 279, 8, 1, 156);
    px(g, '#3a3f44', 274, 13, 2, 151);
    for (const y of [40, 100, 150]) px(g, '#2c3034', 273, y, 4, 2);
    px(g, '#d9ceb6', 318, 8, 2, 156);
    px(g, '#cfc3ad', 318, 8, 2, 3);
    // upstairs sash windows (glass is drawn live)
    for (const u of L.upstairs) {
      px(g, '#c9bfa8', u.x - 4, u.y - 5, u.w + 8, 3);
      px(g, '#efe9dc', u.x - 2, u.y - 2, u.w + 4, u.h + 4);
      g.clearRect(u.x, u.y, u.w, u.h);
      px(g, '#d8cfbd', u.x - 4, u.y + u.h + 2, u.w + 8, 3);
      px(g, '#b8ad96', u.x - 4, u.y + u.h + 4, u.w + 8, 1);
    }
    // fascia & sign
    px(g, G3, 0, 52, 274, 21);
    px(g, G, 1, 53, 272, 19);
    px(g, GOLD, 4, 54, 266, 1);
    px(g, GOLD, 4, 71, 266, 1);
    px(g, GOLD, 4, 54, 1, 18);
    px(g, GOLD, 269, 54, 1, 18);
    const name = B.config.shopName;
    const w = B.textWidth(name, 3);
    shadowText(g, name, Math.round(137 - w / 2), 56, GOLD, 3);
    px(g, G2, 0, 72, 274, 1);
    // window frame + glass hole
    const W = L.win;
    px(g, G, 6, 73, 208, 75);
    px(g, G3, 7, 75, 206, 1);
    g.clearRect(W.x, W.y, W.w, W.h);
    px(g, G, W.x, 84, W.w, 2);
    px(g, G2, W.x, 84, W.w, 1);
    for (const x of [76, 144]) px(g, G, x, W.y, 2, 8);
    for (const [label, a, b] of [['FICTION', 9, 76], ['POETRY', 78, 144], ['MAPS & PRINTS', 146, 211]])
      shadowText(g, label, Math.round((a + b) / 2 - B.textWidth(label) / 2), 78, GOLD);
    // sill & stallriser
    px(g, '#3d6b5d', 4, 144, 212, 3);
    px(g, '#4f8272', 4, 144, 212, 1);
    px(g, G3, 4, 147, 212, 1);
    px(g, G, 6, 148, 208, 16);
    for (const x of [12, 80, 148]) {
      px(g, G3, x, 151, 60, 1);
      px(g, G3, x, 151, 1, 10);
      px(g, G2, x, 160, 60, 1);
      px(g, G2, x + 59, 151, 1, 10);
    }
    // pilasters
    for (const x of [0, 214, 266]) {
      px(g, G3, x, 73, 8, 91);
      px(g, G, x + 1, 74, 6, 90);
      px(g, G2, x + 2, 80, 1, 76);
      px(g, G2, x, 73, 8, 4);
      px(g, G3, x, 158, 8, 6);
    }
    // door surround, fanlight, opening
    px(g, G, 222, 73, 44, 91);
    px(g, G3, 225, 90, 38, 1);
    px(g, '#1d2b33', 227, 77, 34, 12);
    for (const x of [238, 250]) px(g, G, x, 77, 1, 12);
    shadowText(g, '12', 244 - Math.floor(B.textWidth('12') / 2), 80, GOLD);
    g.clearRect(L.doorOpening.x, L.doorOpening.y, L.doorOpening.w, L.doorOpening.h);
    px(g, '#b8b0a2', 224, 162, 40, 2);
    return c;
  }

  function makeStreet() {
    const [c, g] = makeCanvas();
    const rng = B.seeded('street-v2');
    px(g, '#8e8a84', 0, 164, 320, 14);
    for (let x = 0; x < 320; x += 32) px(g, '#7c7872', x, 164, 1, 7);
    for (let x = 16; x < 320; x += 32) px(g, '#7c7872', x, 171, 1, 7);
    px(g, '#7c7872', 0, 171, 320, 1);
    for (let i = 0; i < 120; i++) px(g, rng() < 0.5 ? '#86827c' : '#96928c', Math.floor(rng() * 320), 164 + Math.floor(rng() * 14));
    px(g, '#b3aea6', 0, 178, 320, 2);
    // street lamp on the corner
    px(g, '#1f2327', LAMP - 1, 21, 3, 153);
    px(g, '#1f2327', LAMP - 4, 168, 9, 6);
    px(g, '#1f2327', LAMP - 7, 7, 15, 2);
    px(g, '#1f2327', LAMP - 1, 3, 3, 4);
    px(g, '#1f2327', LAMP - 6, 9, 1, 11);
    px(g, '#1f2327', LAMP + 6, 9, 1, 11);
    px(g, '#1f2327', LAMP - 7, 20, 15, 1);
    return c;
  }

  function makeInterior() {
    const [c, g] = makeCanvas();
    // wall, panelling, low ceiling
    px(g, '#e2cc9c', 9, 76, 202, 88);
    for (let x = 9; x < 211; x += 7) px(g, '#d6bf8c', x, 85, 3, 48);
    px(g, '#8a5a34', 9, 133, 202, 1);
    px(g, '#c3a574', 9, 134, 202, 30);
    for (let x = 12; x < 211; x += 18) px(g, '#b39364', x, 137, 1, 27);
    px(g, '#6a4a30', 9, 76, 202, 6);
    for (let x = 12; x < 211; x += 12) px(g, '#5a3a22', x, 76, 1, 6);
    px(g, WOOD_D, 9, 82, 202, 3);
    for (let x = 20; x < 211; x += 30) px(g, '#3a2213', x, 82, 5, 4);
    // big bookcase
    px(g, '#3a2213', 10, 85, 58, 79);
    px(g, WOOD, 10, 85, 2, 79);
    px(g, WOOD, 66, 85, 2, 79);
    for (const by of [96, 110, 124, 138, 152]) {
      px(g, WOOD, 12, by, 54, 2);
      px(g, WOOD_L, 12, by, 54, 1);
    }
    // the passage to the rest of the shop
    px(g, '#c9b085', 71, 85, 35, 79);
    const A = B.LAYOUT.arch;
    const cxA = A.x + A.w / 2;
    for (let y = A.y; y < 164; y++) {
      const hw = y === A.y ? 7 : y === A.y + 1 ? 10 : y === A.y + 2 ? 12 : 13.5;
      px(g, WOOD, Math.round(cxA - hw - 2), y, 2, 1);
      px(g, WOOD, Math.round(cxA + hw), y, 2, 1);
      px(g, '#5c4630', Math.round(cxA - hw), y, Math.round(hw * 2), 1);
    }
    px(g, WOOD, Math.round(cxA - 7), A.y - 1, 14, 1);
    px(g, '#3e2e1f', 80, 98, 17, 66);
    px(g, '#2a2018', 84, 104, 9, 60);
    const drng = B.seeded('distant');
    for (const by of [114, 124, 134, 144]) {
      px(g, '#4a3522', 78, by, 11, 1);
      for (let x = 78; x < 89; x += 2) px(g, B.shade(B.pal.books[Math.floor(drng() * B.pal.books.length)], 0.45 + drng() * 0.1), x, by - 5 - Math.floor(drng() * 2), 2, 5);
    }
    // the foot of the stairs up to the flat, rising off to the right
    for (let i = 0; i < 8; i++) {
      const y = 143 - i * 4;
      const x = 91 + Math.round(i * 1.5);
      px(g, '#6a5038', x, y, 102 - x, 1);
      px(g, '#4a3624', x, y + 1, 102 - x, 3);
    }
    B.line(g, 90, 124, 101, 96, '#7a5a3a'); // banister
    px(g, '#7a5a3a', 89, 124, 2, 20); // newel post
    px(g, '#8a6a4a', 89, 122, 2, 2);
    px(g, '#8a6a3a', 86, 99, 5, 2);
    px(g, '#2a1a10', 76, 85, 25, 7);
    B.text(g, 'POETRY', 77, 86, GOLD);
    // narrow bookcase
    px(g, '#3a2213', 106, 86, 29, 78);
    px(g, '#7a4c2b', 105, 85, 31, 2);
    px(g, WOOD, 106, 87, 2, 77);
    px(g, WOOD, 133, 87, 2, 77);
    for (const by of [100, 114, 128, 142, 156]) {
      px(g, WOOD, 108, by, 25, 2);
      px(g, WOOD_L, 108, by, 25, 1);
    }
    // radio shelf, sideboard behind the counter
    px(g, WOOD, 138, 100, 24, 2);
    px(g, WOOD_D, 140, 102, 2, 4);
    px(g, WOOD_D, 158, 102, 2, 4);
    px(g, '#7a4c2b', 184, 119, 28, 2);
    px(g, '#5a3620', 185, 121, 27, 43);
    // mug hooks under the radio shelf
    px(g, '#f3efe6', 143, 104, 3, 4);
    px(g, '#c0392b', 148, 104, 3, 4);
    px(g, '#3b5b8c', 153, 104, 3, 4);
    return c;
  }

  function makeCounter() {
    const [c, g] = makeCanvas();
    px(g, WOOD_L, 134, 127, 76, 2);
    px(g, '#a06a3e', 134, 127, 76, 1);
    px(g, WOOD, 136, 129, 72, 35);
    for (const x of [140, 164, 188]) {
      px(g, '#5a3620', x, 132, 20, 1);
      px(g, '#5a3620', x, 132, 1, 28);
      px(g, '#7a4c2b', x + 19, 132, 1, 28);
    }
    return c;
  }

  function makeGlass() {
    const [c, g] = makeCanvas();
    const W = B.LAYOUT.win;
    for (const [x0, w] of [[30, 8], [44, 3], [140, 11], [156, 4]]) {
      for (let y = W.y; y < W.y + W.h; y++) px(g, 'rgba(255,255,255,0.05)', Math.round(x0 + (W.y + W.h - y) * 0.55), y, w, 1);
    }
    return c;
  }

  // ---------- themes ----------
  // Every scene piece is looked up through part(name), so a theme (js/cyber.js) can replace any of them.
  // 'classic' is the original cosy high street; 'cyber' is the neon future.
  try {
    B.theme = localStorage.getItem('bookshop.theme') || 'cyber';
  } catch (e) {
    B.theme = 'cyber';
  }
  B.themes = { classic: {} };
  const part = (name) => (B.themes[B.theme] && B.themes[B.theme][name]) || PARTS[name];
  B.setTheme = function (name) {
    if (!B.themes[name]) return;
    B.theme = name;
    try {
      localStorage.setItem('bookshop.theme', name);
    } catch (e) {
      /* ignore */
    }
    B.buildCaches();
    if (B.world) B.emit('theme', B.world, name);
  };

  B.part = part; // the current theme's version of a scene piece (used to cast props' shadows)

  B.buildCaches = function () {
    B.cache = {
      facade: part('makeFacade')(),
      street: part('makeStreet')(),
      interior: part('makeInterior')(),
      counter: part('makeCounter')(),
      glass: part('makeGlass')(),
    };
  };

  // ---------- sky ----------
  const SKY = [
    [0, '#0b1026', '#141a3a'], [5, '#141a3a', '#2a2d55'], [6.5, '#e0906a', '#f7c98a'], [8, '#7fb2e0', '#b5d6ee'],
    [17, '#7fb2e0', '#b5d6ee'], [18.7, '#e8875a', '#f5b77a'], [20, '#2a2750', '#4a3a66'], [21.5, '#0b1026', '#141a3a'],
    [24, '#0b1026', '#141a3a'],
  ];
  function skyColors(h, cloud) {
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
    const [h0, a0, b0] = SKY[i];
    const [h1, a1, b1] = SKY[i + 1];
    const t = (h - h0) / (h1 - h0 || 1);
    const grey = B.daylight(h) > 0.3 ? '#8e96a0' : '#1c1f2a';
    return [B.mix(B.mix(a0, a1, t), grey, cloud * 0.55), B.mix(B.mix(b0, b1, t), grey, cloud * 0.55)];
  }
  const STARS = Array.from({ length: 22 }, (_, i) => [(i * 73) % 320, (i * 29) % 8, i]);

  function drawSky(g, s) {
    const [top, bot] = skyColors(s.hour, s.weather.cloud);
    px(g, top, 0, 0, 320, 4);
    px(g, bot, 0, 4, 320, 5);
    const day = B.daylight(s.hour);
    if (day < 0.4 && s.weather.cloud < 0.7) for (const [x, y, i] of STARS) if (Math.floor(s.simT * 0.7 + i) % 7) px(g, 'rgba(255,255,230,0.8)', x, y);
    const cc = day > 0.3 ? 'rgba(255,255,255,0.55)' : 'rgba(80,90,120,0.5)';
    const n = 2 + Math.round(s.weather.cloud * 4);
    for (let i = 0; i < n; i++) {
      const x = Math.round(((i * 97 + s.simT * (3 + i)) % 400) - 50);
      px(g, cc, x, 2 + (i % 3) * 2, 26 + (i % 2) * 12, 2);
      px(g, cc, x + 6, 1 + (i % 3) * 2, 12, 1);
    }
    return bot;
  }

  B.upstairsLit = (s) => s.upstairs.light;

  const TV_COLS = ['#6fa8dc', '#e8d36a', '#8fd18f', '#d77c7c', '#b4a7d6', '#f4efe2'];
  /** Mabel's flat: sitting room behind the left window, kitchen corner behind the right. */
  function drawUpstairs(g, s, skyBot) {
    const U = s.upstairs;
    const L = B.LAYOUT;
    const [A, Bw] = L.upstairs;
    const day = B.daylight(s.hour);
    const o = s.owner;
    g.save();
    g.beginPath();
    for (const u of L.upstairs) g.rect(u.x, u.y, u.w, u.h);
    g.clip();
    // room
    px(g, '#d9b98a', A.x, A.y, Bw.x + Bw.w - A.x, A.h);
    for (let x = A.x; x < Bw.x + Bw.w; x += 6) px(g, '#cfae7e', x, A.y, 2, A.h);
    px(g, '#8a5a34', A.x, 43, Bw.x + Bw.w - A.x, 1);
    // sitting room: picture, lamp, armchair back, telly
    px(g, '#b08a3a', 50, 22, 10, 7);
    px(g, '#8fb3c4', 51, 23, 8, 3);
    px(g, '#6f8f4f', 51, 26, 8, 2);
    px(g, '#3a3a3a', 64, 26, 1, 20);
    px(g, U.light ? '#f7d58a' : '#c9a26b', 61, 22, 8, 4);
    px(g, '#6b2f5a', 44, 28, 6, 19);
    px(g, '#7d3a6a', 44, 27, 5, 1);
    px(g, '#6b4226', 71, 41, 14, 6);
    px(g, '#4a2c17', 71, 41, 14, 1);
    px(g, '#3a3a40', 70, 29, 16, 12);
    px(g, '#4a4a52', 70, 29, 16, 1);
    if (!(U.tv && B.tvScreen && B.tvScreen(g, 71, 30, 14, 10, s))) {
      let scr = '#20242a';
      if (U.tv) scr = TV_COLS[Math.floor(s.simT * 2.3) % TV_COLS.length];
      px(g, scr, 71, 30, 14, 10);
      if (U.tv) px(g, B.shade(scr, 1.3), 73 + (Math.floor(s.simT * 5) % 8), 32, 3, 2);
    }
    px(g, '#aaa', 76, 26, 1, 4);
    px(g, '#aaa', 80, 27, 1, 3);
    // kitchen corner: calendar, shelf of jars, kettle, fern
    px(g, '#f4efe2', 159, 21, 8, 10);
    px(g, '#c0392b', 159, 21, 8, 2);
    px(g, '#6b4226', 177, 29, 18, 1);
    px(g, '#c9a13b', 179, 25, 3, 4);
    px(g, '#3b5b8c', 184, 26, 3, 3);
    px(g, '#f3efe6', 189, 25, 3, 4);
    px(g, '#8a5a34', 176, 38, 19, 9);
    px(g, '#a06a3e', 176, 38, 19, 1);
    px(g, '#c0c4c8', 184, 33, 6, 5);
    px(g, '#555', 190, 34, 1, 2);
    px(g, '#b0673f', 154, 40, 6, 7);
    for (const [x0, y0, x1, y1] of [[157, 40, 155, 32], [157, 40, 160, 33], [157, 40, 153, 36], [157, 40, 161, 37]]) B.line(g, x0, y0, x1, y1, '#3c7a3c');
    decor(g, s, 'upstairs');
    if (o.area === 'upstairs' && !o.hidden) B.drawPerson(g, o);
    // armchair arm in front of her
    px(g, '#7d3a6a', 57, 37, 5, 10);
    px(g, '#8c4a7a', 57, 37, 5, 1);
    decor(g, s, 'upstairs-front');
    if (U.kettle > 0 && Math.random() < 0.3) s.particle({ layer: 'up', x: 186 + B.rnd(0, 3), y: 32, vx: B.rnd(-3, 3), vy: -8, life: 1, c: '#f1f3f5', kind: 'steam' });
    drawParticles(g, s, 'up');
    // lighting
    if (U.light) {
      px(g, 'rgba(255,190,110,0.08)', A.x, A.y, Bw.x + Bw.w - A.x, A.h);
      if (U.tv) {
        px(g, 'rgba(20,30,70,0.22)', A.x, A.y, A.w, A.h);
        g.globalCompositeOperation = 'lighter';
        glow(g, 78, 35, 26, `rgba(120,160,255,${0.12 + (Math.floor(s.simT * 2.3) % 3) * 0.05})`);
        g.globalCompositeOperation = 'source-over';
      }
    } else px(g, `rgba(12,14,38,${0.35 + (1 - day) * 0.55})`, A.x, A.y, Bw.x + Bw.w - A.x, A.h);
    if (!U.light && day > 0.3) {
      // daytime: mostly sky reflection, a hint of the room behind
      g.globalAlpha = 0.6 * day;
      px(g, B.mix(skyBot, '#1d2b33', 0.5), A.x, A.y, Bw.x + Bw.w - A.x, A.h);
      g.globalAlpha = 1;
    }
    g.restore();
    // glass sheen, roller blinds, geraniums
    for (const u of L.upstairs) {
      if (!U.light) px(g, 'rgba(255,255,255,0.1)', u.x + 3, u.y + 2, 4, u.h - 4);
      const bh = Math.round(3 + U.blind * (u.h - 3));
      const lit = U.light;
      px(g, lit ? '#f6d9a0' : '#e8dcc0', u.x, u.y, u.w, bh);
      for (let y = u.y + 2; y < u.y + bh - 1; y += 3) px(g, lit ? '#e8c688' : '#d8cbb0', u.x, y, u.w, 1);
      px(g, '#b8a888', u.x, u.y + bh - 1, u.w, 1);
      const cx = u.x + Math.floor(u.w / 2);
      px(g, '#8a7a5a', cx, u.y + bh, 1, 3);
      px(g, '#c9a13b', cx - 1, u.y + bh + 3, 3, 2);
    }
    const u = L.upstairs[0];
    for (let x = u.x - 2; x < u.x + u.w + 2; x += 5) {
      px(g, '#3c7a3c', x, u.y + u.h - 1, 4, 3);
      px(g, (x / 5) % 2 ? '#d6336c' : '#e03131', x + 1, u.y + u.h - 3, 2, 2);
    }
  }


  // ---------- the alley beside the shop, and the town beyond ----------
  // Front edges x 280..318 (roofline y 8, ground 164); the far end is a small opening x 292..306.
  const AL = { l: 280, r: 318, fl: 292, fr: 306, top: 8, ftop: 64, fbot: 132, bot: 164 };
  const lerp = (a, b, t) => a + (b - a) * t;
  function scan(g, c, y0, y1, xl, xr) {
    g.fillStyle = c;
    for (let y = y0; y < y1; y++) {
      const a = Math.round(xl(y));
      const b = Math.round(xr(y));
      if (b > a) g.fillRect(a, y, b - a, 1);
    }
  }
  // inner edge of the left / right walls at row y
  const wallL = (y) => (y < AL.ftop ? lerp(AL.l, AL.fl, (y - AL.top) / (AL.ftop - AL.top)) : y < AL.fbot ? AL.fl : lerp(AL.fl, AL.l, (y - AL.fbot) / (AL.bot - AL.fbot)));
  const wallR = (y) => (y < AL.ftop ? lerp(AL.r, AL.fr, (y - AL.top) / (AL.ftop - AL.top)) : y < AL.fbot ? AL.fr : lerp(AL.fr, AL.r, (y - AL.fbot) / (AL.bot - AL.fbot)));
  const TOWN = (() => {
    const rng = B.seeded('town');
    const blocks = [];
    for (let x = AL.l - 4; x < AL.r + 4; ) {
      const w = 5 + Math.floor(rng() * 7);
      const h = 14 + Math.floor(rng() * 22);
      const roof = ['#8a4a3a', '#5a5e6a', '#7a5a4a', '#6a6a70'][Math.floor(rng() * 4)];
      const wallc = ['#c9b89a', '#b8a888', '#d8c8a8', '#a89878'][Math.floor(rng() * 4)];
      const wins = [];
      for (let wy = 118 - h + 5; wy < 124; wy += 5) for (let wx = x + 1; wx < x + w - 1; wx += 3) if (rng() < 0.6) wins.push([wx, wy, rng()]);
      blocks.push({ x, w, h, roof, wallc, wins, chimney: rng() < 0.5 ? x + 1 + Math.floor(rng() * (w - 2)) : null });
      x += w;
    }
    return blocks;
  })();

  function drawAlley(g, s, skyTop, skyBot) {
    const day = B.daylight(s.hour);
    const dim = (c, k = 1) => B.mix(c, '#1a1c2e', (1 - day) * 0.55 * k);
    // sky
    for (let y = 0; y < AL.bot; y++) px(g, B.mix(skyTop, skyBot, Math.min(1, y / 100)), AL.l, y, AL.r - AL.l, 1);
    if (day < 0.4) for (let i = 0; i < 8; i++) px(g, 'rgba(255,255,230,0.8)', AL.l + ((i * 17) % 38), 3 + ((i * 23) % 40), 1, 1);
    // distant hill, then the town climbing it
    scan(g, dim('#6f8f6a'), 84, AL.bot, (y) => AL.l, (y) => AL.r);
    for (let y = 80; y < 92; y++) px(g, dim('#7f9f78'), AL.l + Math.round((y - 80) * 0.8), y, AL.r - AL.l, 1);
    for (const b of TOWN) {
      const top = 124 - b.h;
      px(g, dim(b.wallc), b.x, top, b.w, 124 - top);
      px(g, dim(b.roof), b.x, top - 3, b.w, 3);
      px(g, dim(b.roof), b.x + 1, top - 4, b.w - 2, 1);
      for (const [wx, wy] of b.wins) px(g, dim('#4a4e5a', 0.5), wx, wy, 1, 2);
      if (b.chimney != null) {
        px(g, dim('#6a3a2c'), b.chimney, top - 7, 2, 4);
        if (day > 0.3) {
          // a lazy wisp of chimney smoke
          for (let i = 0; i < 4; i++) {
            const k = (s.simT * 0.4 + i * 0.25 + b.x * 0.1) % 1;
            g.globalAlpha = (1 - k) * 0.5;
            px(g, '#dcdcdc', Math.round(b.chimney + k * 6 + Math.sin(k * 6) * 1.5), Math.round(top - 8 - k * 14), 2, 2);
          }
          g.globalAlpha = 1;
        }
      }
    }
    // the buildings closing off the far end, and the CINEMA sign on the bookshop's rear corner
    drawCinema(g, s, dim);
    // far street, and the odd tiny passer-by crossing the end of the alley
    px(g, dim('#8a8680'), AL.fl, 124, AL.fr - AL.fl, AL.fbot - 124);
    const cyc = (s.simT / 14) % 1;
    const walker = Math.floor(s.simT / 14);
    if (B.hash('w' + walker) % 3 !== 0 && (B.daylight(s.hour) > 0.15 || s.hour < 23)) {
      const dir = B.hash('d' + walker) % 2 ? 1 : -1;
      const wx = Math.round(dir > 0 ? lerp(AL.fl - 4, AL.fr + 4, cyc) : lerp(AL.fr + 4, AL.fl - 4, cyc));
      const c = B.lookParts.top[B.hash('c' + walker) % B.lookParts.top.length];
      px(g, dim(c), wx, 124, 2, 4);
      px(g, dim('#e0ac85'), wx, 122, 2, 2);
      px(g, dim('#2c3440'), wx + (Math.floor(s.simT * 6) % 2), 128, 1, 2);
    }
    // alley walls: left is the side of the shop (brick), right is the neighbour's rendered wall
    scan(g, dim('#6e3a2c'), AL.top, AL.bot, (y) => AL.l, wallL);
    for (let i = 1; i < 24; i++) {
      const k = i / 24;
      B.line(g, AL.l, lerp(AL.top, AL.bot, k), AL.fl, lerp(AL.ftop, AL.fbot, k), dim('#5a2e22'));
    }
    scan(g, dim('#a89e88'), AL.top, AL.bot, wallR, (y) => AL.r);
    scan(g, dim('#968c78'), AL.top, AL.bot, wallR, (y) => wallR(y) + 2);
    // neighbour's side window (lit in the evening) and drainpipe
    const win = s.hour > 17 && s.hour < 23 && day < 0.8;
    scan(g, win ? '#f2c77a' : dim('#3a4450'), 88, 104, (y) => wallR(y) + 3, (y) => wallR(y) + 7);
    B.line(g, 316, AL.top + 2, 309, AL.fbot - 4, dim('#4a4e54'));
    // cobbles
    scan(g, dim('#6f6a64'), AL.fbot, AL.bot, wallL, wallR);
    for (let r = 0; r < 9; r++) {
      const y = Math.round(AL.fbot + Math.pow(r / 9, 1.4) * (AL.bot - AL.fbot));
      const step = 2 + Math.round((r / 9) * 4);
      for (let x = Math.round(wallL(y)) + (r % 2) * 2; x < wallR(y); x += step) px(g, dim('#5e5954'), x, y, Math.max(1, step - 1), 1);
    }
    B.line(g, 299, AL.fbot, 299, AL.bot, dim('#55504a'));
    if ((s.weather.cover || 0) > 0.05) scan(g, `rgba(236,241,247,${Math.min(0.9, 0.2 + s.weather.cover * 0.7)})`, AL.fbot, AL.bot, wallL, wallR);
    if (s.weather.rain > 0.3) {
      px(g, 'rgba(170,190,215,0.35)', 293, 140, 9, 2);
      px(g, 'rgba(170,190,215,0.3)', 298, 146, 7, 2);
    }
    // washing line strung across the alley
    B.line(g, wallL(40), 40, wallR(42), 42, dim('#d8d0c0'));
    const sway = Math.round(Math.sin(s.simT * 1.7) * (s.weather.kind === 'clear' ? 0.6 : 1.2));
    const wash = [['#f4efe2', 5, 5], ['#3b5b8c', 4, 6], ['#d6336c', 3, 4], ['#f4efe2', 4, 3]];
    wash.forEach(([c, w, h], i) => {
      const x = Math.round(lerp(wallL(40), wallR(42), 0.15 + i * 0.22));
      const y = Math.round(lerp(40, 42, 0.15 + i * 0.22)) + 1;
      px(g, dim(c), x + sway, y, w, h);
    });
    // Mabel's side door to the flat, with a little lamp over it
    scan(g, dim('#24463d'), 112, 150, (y) => AL.l + 2, (y) => Math.min(wallL(y) - 1, AL.l + 7));
    px(g, dim('#c9a13b'), AL.l + 5, 132, 1, 2);
    px(g, dim('#1f2327'), AL.l + 3, 106, 4, 3);
    px(g, day < 0.5 ? '#ffe7a0' : dim('#9fb3b8'), AL.l + 4, 109, 2, 2);
    // bits and pieces: flattened boxes, the dustbin, a bike against the wall
    // (each sits on the cobbles at its own depth: further back = higher up and smaller)
    // a bike propped against the far end
    for (const cx of [296, 302]) {
      for (let a = 0; a < 12; a++) px(g, dim('#2b2b2b'), Math.round(cx + Math.cos(a / 2) * 2.5), Math.round(136 + Math.sin(a / 2) * 2.5), 1, 1);
    }
    B.line(g, 296, 136, 299, 133, dim('#b33a3a'));
    B.line(g, 299, 133, 302, 136, dim('#b33a3a'));
    B.line(g, 299, 133, 300, 131, dim('#b33a3a'));
    // flattened book boxes waiting for the recycling, against the shop wall
    px(g, dim('#b08850'), 288, 134, 4, 11);
    px(g, dim('#9a7440'), 289, 136, 4, 9);
    px(g, dim('#d9c9a0'), 288, 139, 5, 1);
    // the neighbour's dustbin (away on bin day, knocked over when the fox has been)
    const bin = s.alley || {};
    if (bin.binTipped) {
      px(g, dim('#707880'), 300, 140, 12, 6);
      px(g, dim('#5a6068'), 300, 141, 12, 1);
      px(g, dim('#1e1e22'), 311, 140, 2, 6);
      px(g, dim('#8a9098'), 294, 143, 5, 2); // the lid
      for (let i = 0; i < 7; i++) px(g, dim(['#e8e4da', '#c0392b', '#b08850', '#6a8a4a'][i % 4]), 296 + ((i * 5) % 16), 144 + (i % 3), 2, 1);
    } else if (!bin.binAway) {
      px(g, dim('#707880'), 303, 134, 7, 11);
      px(g, dim('#8a9098'), 302, 132, 9, 2);
      px(g, dim('#5a6068'), 305, 136, 1, 8);
      px(g, dim('#5a6068'), 308, 136, 1, 8);
    }
    // an alley cat on the bin lid some nights
    s.alleyCat = day < 0.3 && Math.floor(s.simT / 90) % 3 === 1;
    if (s.alleyCat) {
      px(g, '#141418', 304, 127, 5, 5);
      px(g, '#141418', 305, 125, 3, 3);
      px(g, '#141418', 305, 124, 1, 1);
      px(g, '#141418', 307, 124, 1, 1);
      px(g, '#141418', 309, 128, 1, 4);
    }
    decor(g, s, 'alley'); // content drawn inside the alley (clipped by the facade in front)
  }
  // alley geometry for content: floor depth → scale, and the wall edges at a given row
  B.ALLEY = { ...AL, wallL, wallR, scaleAt: (y) => B.clamp(0.3 + ((y - AL.fbot) / (AL.bot - AL.fbot)) * 0.7, 0.3, 1) };

  // ---------- the CINEMA sign on the back of the bookshop ----------
  // A vertical sign fixed to the rear corner of our own building, where the left alley wall ends.
  // It faces the street beyond, so we see its letters from behind: mirrored, sticking out past the
  // corner, with their lit edges glowing (and each letter's shape readable) and the neon light
  // spilling back down the alley in the sign's colour.
  const GLYPHS = {
    C: ['.###', '#...', '#...', '#...', '#...', '#...', '#...', '.###'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    N: ['#..#', '##.#', '##.#', '##.#', '#.##', '#.##', '#.##', '#..#'],
    E: ['####', '#...', '#...', '###.', '#...', '#...', '#...', '####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
    A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#', '#..#', '#..#'],
  };
  // `wall` is where the bookshop's corner is at the far end; each letter mostly hides behind it,
  // with about a third of it (rounded up) sticking out into view.
  const CIN = { word: 'CINEMA', wall: 292, top: 66, pitch: 10 };
  const NEON = ['#ff4fa3', '#4ff0ff', '#ffd23f'];
  const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const LETTERS = CIN.word.split('').map((ch, i) => {
    const rows = GLYPHS[ch];
    const w = rows[0].length;
    const x0 = CIN.wall - (w - Math.ceil(w / 3)); // so only the outer third clears the corner
    const px_ = [];
    rows.forEach((row, r) => {
      for (let c = 0; c < w; c++) if (row[c] === '#') px_.push([x0 + (w - 1 - c), CIN.top + i * CIN.pitch + r]); // mirrored
    });
    return { ch, i, w, x0, px: px_, y: CIN.top + i * CIN.pitch };
  });

  function drawCinema(g, s, dim) {
    // the buildings on the next street close off the far end; a church spire peeks over them
    for (let y = 42; y < 60; y++) {
      const hw = Math.max(0, Math.round(((y - 42) / 18) * 2));
      px(g, dim('#5a5e6a'), 300 - hw, y, hw * 2 + 1, 1);
    }
    px(g, dim('#c9a13b'), 300, 37, 1, 5);
    px(g, dim('#c9a13b'), 299, 38, 3, 1);
    px(g, dim('#7e5446'), 290, 60, 18, 64);
    for (let y = 62; y < 124; y += 3) px(g, dim('#6e4a3e'), 290, y, 18, 1);
    px(g, dim('#6a5a50'), 289, 57, 20, 3);
    px(g, dim('#3a3028'), 302, 110, 5, 14);
    px(g, dim('#5a4a3a'), 302, 109, 5, 1);
    // the letters' metal (dark when unlit); the alley wall drawn next hides all but their outer third
    for (const L of LETTERS) {
      for (const [x, y] of L.px) {
        px(g, dim('#3a3a42'), x, y, 1, 1);
        px(g, dim('#1c1c22'), x + 1, y, 1, 1); // the letter's depth, behind its lit edge
      }
    }
  }

  /** Which letters are lit, and in what colour, right now (a cycle of sign routines). */
  function neonState() {
    const t = performance.now() / 1000; // real time, so the sign doesn't go frantic at 10x speed
    const mode = Math.floor(t / 7) % 4;
    const n = LETTERS.length;
    return LETTERS.map((L) => {
      let on = true;
      let col = NEON[L.i % 3];
      if (mode === 1) on = Math.floor(t * 3) % (n + 3) > L.i; // lights up letter by letter, then all
      else if (mode === 2) on = Math.floor(t * 2) % 2 === 0; // blinks
      else if (mode === 3) col = NEON[(L.i + Math.floor(t * 3)) % 3]; // colour wave
      if (L.i === 2 && Math.random() < 0.08) on = false; // the N has a dodgy transformer
      return { on, col };
    });
  }

  function drawNeon(g, s, day) {
    const fog = s.weather.fog || 0;
    const state = neonState();
    const bright = (day > 0.6 ? 0.55 : 1) * (1 - 0.4 * fog);
    // anyone standing in the alley mouth hides the sign behind them
    const blockers = s.npcs.concat([s.owner]).filter((a) => a.area === 'street' && !a.hidden && (a.alpha == null || a.alpha > 0.5) && Math.abs(a.x - 296) < 20);
    const hidden = (x, y) => blockers.some((a) => Math.abs(x - a.x) <= 8 && y >= B.headTop(a) - 1 && y <= a.y);
    const counts = {};
    let lit = 0;
    for (const L of LETTERS) {
      const st = state[L.i];
      if (!st.on) continue;
      lit++;
      const [r, gg, b] = rgbOf(st.col);
      counts[st.col] = (counts[st.col] || 0) + 1;
      g.globalAlpha = bright;
      for (const [x, y] of L.px) if (x >= wallL(y) && !hidden(x, y)) px(g, st.col, x, y, 1, 1);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      glow(g, CIN.wall + 1, L.y + 4, 7 + fog * 7, `rgba(${r},${gg},${b},${(day > 0.6 ? 0.1 : 0.3) * (1 - 0.3 * fog)})`);
      g.globalCompositeOperation = 'source-over';
    }
    if (!lit) return;
    // the alley lit in the sign's dominant colour (mixing them all would just wash out to grey):
    // strongest at the far end, fading towards the street
    const cols = Object.keys(counts).sort((x, y) => counts[y] - counts[x] || NEON.indexOf(x) - NEON.indexOf(y));
    const [r, gg, b] = rgbOf(cols.length > 1 && counts[cols[0]] === counts[cols[1]] ? cols[Math.floor(performance.now() / 1500) % 2] : cols[0]);
    const k = (lit / LETTERS.length) * (day > 0.6 ? 0.05 : day > 0.3 ? 0.12 : 0.2) * (1 + 0.3 * fog);
    g.save();
    g.beginPath();
    g.rect(AL.l, 0, AL.r - AL.l, AL.bot);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(CIN.wall + 2, 118, 2, CIN.wall + 2, 128, 70);
    gr.addColorStop(0, `rgba(${r},${gg},${b},${k})`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(AL.l, 0, AL.r - AL.l, AL.bot);
    // a brighter pool at the far end, and a sheen along the cobbles
    gr = g.createRadialGradient(CIN.wall + 2, 110, 1, CIN.wall + 2, 110, 26);
    gr.addColorStop(0, `rgba(${r},${gg},${b},${k * 1.4})`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(AL.l, 80, AL.r - AL.l, 84);
    if (s.weather.rain > 0.3) px(g, `rgba(${r},${gg},${b},${k * 1.2})`, 294, 140, 12, 3); // reflected in a puddle
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  /** Lights in the alley and town, drawn after the night overlay so they glow. */
  function drawAlleyLights(g, s) {
    const day = B.daylight(s.hour);
    drawNeon(g, s, day);
    if (day > 0.6) return;
    const k = (1 - day / 0.6) * (1 - 0.8 * (s.weather.fog || 0));
    for (const b of TOWN) for (const [wx, wy, r] of b.wins) if (r < 0.45 && ((s.hour > 17 || s.hour < 1) || r < 0.1)) {
      if (wx > wallL(wy) && wx < wallR(wy)) px(g, `rgba(255,214,130,${0.85 * k})`, wx, wy, 1, 2);
    }
    g.globalCompositeOperation = 'lighter';
    glow(g, AL.l + 5, 110, 12, `rgba(255,210,130,${0.25 * k})`);
    g.globalCompositeOperation = 'source-over';
    px(g, `rgba(255,231,160,${k})`, AL.l + 4, 109, 2, 2);
    if (s.alleyCat && Math.floor(s.simT * 0.5) % 5) {
      px(g, '#9be35b', 305, 126, 1, 1);
      px(g, '#9be35b', 307, 126, 1, 1);
    }
  }

  // ---------- interior props ----------
  function drawBooks(g, s) {
    for (const b of s.shelves.slots) {
      if (!b.present) continue;
      px(g, b.c, b.x, b.y - b.h, b.w, b.h);
      px(g, B.shade(b.c, 1.25), b.x, b.y - b.h, b.w - 1, 1);
      if (b.band) {
        px(g, B.shade(b.c, 1.45), b.x, b.y - b.h + 2, b.w - 1, 1);
        px(g, B.shade(b.c, 1.45), b.x, b.y - 3, b.w - 1, 1);
      }
      px(g, B.shade(b.c, 0.65), b.x + b.w - 1, b.y - b.h, 1, b.h);
    }
  }

  function drawClock(g, s) {
    const cx = 198;
    const cy = 92;
    for (let y = -6; y <= 6; y++)
      for (let x = -6; x <= 6; x++) {
        const r = x * x + y * y;
        if (r <= 25) px(g, '#f4efe2', cx + x, cy + y);
        else if (r <= 40) px(g, WOOD_D, cx + x, cy + y);
      }
    const m = s.time % 60;
    const h = (s.hour % 12) + m / 60;
    const ma = (m / 60) * Math.PI * 2;
    const ha = (h / 12) * Math.PI * 2;
    B.line(g, cx, cy, cx + Math.round(Math.sin(ma) * 4.4), cy - Math.round(Math.cos(ma) * 4.4), '#222');
    B.line(g, cx, cy, cx + Math.round(Math.sin(ha) * 3), cy - Math.round(Math.cos(ha) * 3), '#8c2f2f');
  }

  function drawPendants(g, s) {
    const lit = s.shop.lights;
    for (const x of [40, 170]) {
      px(g, '#222', x, 85, 1, 4);
      px(g, '#2e5249', x - 4, 89, 9, 3);
      px(g, '#3d6b5d', x - 3, 89, 7, 1);
      px(g, '#2e5249', x - 5, 92, 11, 1);
      px(g, lit ? '#ffe9a8' : '#6a6a5a', x - 2, 93, 5, 1);
    }
  }

  function drawRadio(g, s) {
    const on = s.radio.on;
    px(g, WOOD, 140, 89, 18, 11);
    px(g, WOOD_D, 140, 89, 18, 1);
    px(g, '#7a4c2b', 140, 90, 1, 10);
    const pulse = on && Math.floor(s.simT * 4) % 2;
    px(g, pulse ? '#d9c59a' : '#c9b58a', 142, 91, 8, 7);
    for (let y = 92; y < 98; y += 2) px(g, '#8a7650', 142, y, 8, 1);
    px(g, on ? '#ffcf6a' : '#6a5a40', 151, 91, 5, 3);
    if (on) {
      const n = Math.max(1, s.stations.length - 1);
      px(g, '#c0392b', 151 + Math.round((s.radio.idx / n) * 4), 91, 1, 3);
      px(g, s.radio.station.color || '#c0392b', 157, 98, 1, 1); // a little tell-tale lamp in the station's colour
    }
    px(g, '#2a1a10', 151, 96, 2, 2);
    px(g, '#2a1a10', 154, 96, 2, 2);
    px(g, '#aaa', 156, 80, 1, 9);
  }

  function drawCoffee(g, s) {
    const on = s.coffee.brewing > 0;
    px(g, '#9a2a24', 190, 102, 16, 17);
    px(g, '#c0c4c8', 190, 99, 16, 3);
    px(g, '#e3e6e8', 191, 99, 6, 1);
    px(g, '#7a1f1a', 190, 102, 16, 1);
    px(g, '#b8352b', 191, 103, 2, 15);
    px(g, '#8a8e92', 195, 110, 6, 3);
    px(g, '#555', 197, 113, 2, 1);
    px(g, '#8a8e92', 192, 117, 12, 2);
    px(g, on ? '#ff6a3a' : '#5a2a24', 193, 105, 2, 2);
    px(g, '#e8e2d0', 200, 104, 4, 4);
    px(g, '#222', on ? 203 : 201, 105, 1, 1);
    if (on) {
      px(g, '#f3efe6', 196, 114, 4, 3);
      if (Math.floor(s.simT * 8) % 2) px(g, '#5a3218', 197, 113, 1, 1);
    }
  }

  function drawCounterItems(g, s) {
    g.drawImage(B.cache.counter, 0, 0);
    const top = B.LAYOUT.counterTop - 2;
    // desk lamp
    px(g, '#c9a13b', 135, top, 9, 1);
    px(g, '#c9a13b', 139, top - 8, 1, 8);
    px(g, s.lamp ? '#3d8a5f' : '#2e6b4f', 134, top - 11, 11, 3);
    px(g, s.lamp ? '#ffe9a8' : '#a8a080', 135, top - 8, 9, 1);
    // phone
    let x = 146;
    const shaking = s.phone.ringing && s.phone.ringT % 3 < 1.1;
    if (shaking) x += Math.floor(s.simT * 30) % 2 ? 1 : -1;
    px(g, '#9c2b23', x, top - 4, 12, 4);
    px(g, '#b8352b', x + 1, top - 6, 10, 2);
    px(g, '#e8e2d0', x + 4, top - 4, 4, 3);
    px(g, '#9c2b23', x + 5, top - 3, 2, 1);
    if (!s.phone.offHook) {
      px(g, '#7a1f1a', x - 1, top - 8, 14, 2);
      px(g, '#7a1f1a', x - 1, top - 6, 2, 1);
      px(g, '#7a1f1a', x + 11, top - 6, 2, 1);
    }
    if (shaking) {
      for (const [dx, h] of [[-3, 3], [-5, 5], [15, 3], [17, 5]]) px(g, '#2b2622', x + dx, top - 8 - (h - 3) / 2, 1, h);
    }
    // till
    const tx = 160;
    const ty = 110;
    px(g, '#8a7650', tx, ty + 6, 14, top - ty - 6);
    px(g, '#a8925f', tx, ty + 6, 14, 1);
    px(g, '#3a3a3a', tx + 2, ty, 10, 6);
    px(g, '#9fe0a0', tx + 3, ty + 2, 8, 1);
    for (const ky of [ty + 9, ty + 12]) for (let i = 0; i < 5; i++) px(g, '#e8e2d0', tx + 2 + i * 2, ky, 1, 1);
    if (s.till.dingT > 0) {
      px(g, '#f4efe2', tx + 3, ty - 7, 9, 7);
      B.text(g, '£', tx + 6, ty - 6, '#8c2f2f');
      px(g, '#6a5a3a', tx - 2, top - 1, 18, 2);
    }
    if (s.counter.cup) {
      px(g, '#f3efe6', 178, top - 4, 4, 4);
      px(g, '#f3efe6', 182, top - 3, 1, 2);
    }
    s.boxes.slice(0, 2).forEach((b, i) => {
      const by = top - 11 - i * 11;
      px(g, '#b08850', 190, by, 16, 11);
      px(g, '#8a6a3a', 190, by, 16, 1);
      px(g, '#d9c9a0', 197, by, 2, 11);
    });
    if (s.counter.box) {
      px(g, '#b08850', 190, top - 8, 16, 8);
      px(g, '#8a6a3a', 190, top - 8, 16, 1);
      px(g, '#d9c9a0', 188, top - 10, 5, 3);
      px(g, '#d9c9a0', 203, top - 10, 5, 3);
    }
  }

  function drawDisplay(g, s) {
    const cols = s.display.cols;
    const wet = s.plant.water > 0.3;
    // plant
    px(g, '#b0673f', 11, 135, 11, 9);
    px(g, '#8c4f2f', 11, 135, 11, 1);
    const leaf = wet ? '#3c7a3c' : '#7a8a4a';
    const leafL = wet ? '#4f9a4f' : '#8a9a5a';
    if (wet) {
      for (const [x0, y0, x1, y1] of [[16, 134, 16, 112], [16, 130, 9, 118], [16, 128, 24, 116], [16, 132, 11, 124], [16, 131, 22, 124]]) B.line(g, x0, y0, x1, y1, leaf);
      px(g, leafL, 14, 111, 5, 3);
      px(g, leafL, 7, 117, 4, 2);
      px(g, leafL, 23, 115, 4, 2);
    } else {
      for (const [x0, y0, x1, y1] of [[16, 134, 16, 124], [16, 132, 8, 132], [16, 131, 25, 133], [16, 128, 10, 134]]) B.line(g, x0, y0, x1, y1, leaf);
    }
    // open book on a stand
    px(g, WOOD, 32, 134, 2, 10);
    px(g, WOOD, 44, 134, 2, 10);
    px(g, cols[0], 28, 126, 22, 11);
    px(g, '#f4efe2', 29, 127, 9, 9);
    px(g, '#f4efe2', 40, 127, 9, 9);
    for (let y = 129; y < 135; y += 2) {
      px(g, '#b8b0a2', 30, y, 7, 1);
      px(g, '#b8b0a2', 41, y, 7, 1);
    }
    // stacks
    for (let i = 0; i < 4; i++) px(g, cols[1 + i], 54 + (i % 2), 141 - i * 3, 13, 3);
    for (let i = 0; i < 2; i++) px(g, cols[5 + i], 194 + (i % 2), 141 - i * 3, 13, 3);
  }

  // ---------- door & street furniture ----------
  // Door leaf is painted flat into its own canvas, then drawn column by column so it can
  // swing inward on its left hinge (narrowing and foreshortening as it opens).
  let leafC = null;
  function paintLeaf(s, lit) {
    const D = B.LAYOUT.doorOpening;
    if (!leafC) {
      leafC = document.createElement('canvas');
      leafC.width = D.w;
      leafC.height = D.h;
    }
    const g = leafC.getContext('2d');
    const ox = D.x;
    const oy = D.y;
    const P = (c, x, y, w, h) => px(g, c, x - ox, y - oy, w, h);
    g.clearRect(0, 0, D.w, D.h);
    P(G, D.x, D.y, D.w, D.h);
    P(G3, D.x, D.y, 1, D.h);
    P(G2, D.x + D.w - 1, D.y, 1, D.h);
    const Gl = B.LAYOUT.doorGlass;
    P(lit ? '#d9bf8a' : '#23222f', Gl.x, Gl.y, Gl.w, Gl.h);
    P('rgba(255,255,255,0.08)', Gl.x + 3, Gl.y + 2, 4, Gl.h - 4);
    for (const y of [136, 150]) {
      P(G3, 231, y, 26, 1);
      P(G3, 231, y, 1, 11);
      P(G2, 231, y + 10, 26, 1);
      P(G2, 256, y, 1, 11);
    }
    P('#c9a13b', 237, 133, 14, 2);
    P('#e0b84a', 257, 126, 2, 5);
    const txt = s.shop.open ? 'OPEN' : 'CLOSED';
    P('#5a4632', 237, 101, 1, 6);
    P('#5a4632', 251, 101, 1, 6);
    P('#f4efe2', 231, 107, 27, 9);
    P('#d8cfbd', 231, 115, 27, 1);
    const tx = 244 - Math.floor(B.textWidth(txt) / 2);
    B.text(g, txt, tx - ox, 109 - oy, s.shop.open ? '#2b8a3e' : '#b3322a');
    if (s.door.note) {
      P('#f4efe2', 233, 118, 22, 12);
      B.text(g, s.door.note[0], 244 - Math.floor(B.textWidth(s.door.note[0]) / 2) - ox, 119 - oy, '#3a2a1a');
      B.text(g, s.door.note[1], 244 - Math.floor(B.textWidth(s.door.note[1]) / 2) - ox, 125 - oy, '#3a2a1a');
    }
    return leafC;
  }

  /** What you see through the open doorway: the little entrance hall of the shop. */
  function drawDoorway(g, s, lit) {
    const D = B.LAYOUT.doorOpening;
    const wall = lit ? '#e2cc9c' : '#3a3444';
    px(g, wall, D.x, D.y, D.w, D.h);
    for (let x = D.x + 2; x < D.x + D.w; x += 7) px(g, lit ? '#d6bf8c' : '#34303e', x, D.y + 6, 3, 50);
    px(g, lit ? '#5a3a22' : '#1c1620', D.x, D.y, D.w, 4); // ceiling beam
    // hanging lamp
    px(g, '#222', 250, D.y + 4, 1, 4);
    px(g, '#2e5249', 247, D.y + 8, 7, 3);
    px(g, lit ? '#ffe9a8' : '#555', 248, D.y + 11, 5, 1);
    // tall bookcase on the back wall
    px(g, lit ? '#3a2213' : '#16101a', 237, 104, 20, 46);
    const cols = B.pal.books;
    for (const [i, by] of [111, 121, 131, 141].entries()) {
      px(g, lit ? WOOD : '#221a20', 237, by, 20, 1);
      for (let x = 238; x < 256; x += 3) px(g, lit ? cols[(x * 7 + i * 3) % cols.length] : '#2a2430', x, by - 7 - ((x + i) % 3), 3, 7 + ((x + i) % 3));
    }
    // coat stand with Mabel's coat and a brolly
    px(g, lit ? '#4a2c17' : '#1a1418', 230, 108, 1, 42);
    px(g, lit ? '#8c3b3b' : '#2a1e24', 228, 112, 5, 16);
    px(g, lit ? '#2e5249' : '#1a2224', 232, 136, 2, 14);
    // floorboards receding, and the doormat
    px(g, lit ? '#7a4e2d' : '#241a1e', D.x, 150, D.w, 14);
    for (let y = 152; y < 164; y += 3) px(g, lit ? '#6a4226' : '#1e161a', D.x, y, D.w, 1);
    px(g, lit ? '#9a3a2a' : '#2a1a1c', D.x + 5, 158, D.w - 10, 5);
    px(g, lit ? '#b8553a' : '#301e20', D.x + 7, 159, D.w - 14, 1);
    // light spilling in from the shop
    if (lit) px(g, 'rgba(255,200,120,0.08)', D.x, D.y, D.w, D.h);
    else px(g, 'rgba(10,10,30,0.35)', D.x, D.y, D.w, D.h);
  }

  function drawDoor(g, s) {
    const lit = s.shop.lights;
    const D = B.LAYOUT.doorOpening;
    const k = s.door.open || 0;
    if (k > 0.01) drawDoorway(g, s, lit);
    const leaf = paintLeaf(s, lit);
    if (k <= 0.01) g.drawImage(leaf, D.x, D.y);
    else {
      // shade the leaf as it turns away from the street light
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
      px(g, G3, D.x + w, D.y + inset, 2, D.h - 2 * inset); // the door's edge
    }
    const swing = s.door.bellT > 0 ? Math.round(Math.sin(s.door.bellT * 25) * 2) : 0;
    px(g, '#2b2622', 228, 93, 8, 1);
    px(g, '#2b2622', 234, 94, 1, 2);
    px(g, '#e0b84a', 232 + swing, 96, 5, 3);
    px(g, '#c9a13b', 231 + swing, 99, 7, 1);
    px(g, '#8a6a2a', 234 + swing, 100, 1, 1);
    if (s.door.bellMuted) px(g, '#b8b0a2', 232, 97, 5, 3); // a sock stuffed in the bell
    if (s.door.bellT > 0.6 && !s.door.bellMuted) {
      px(g, '#fffaf0', 228, 97, 1, 2);
      px(g, '#fffaf0', 240, 97, 1, 2);
    }
  }

  let chalkCache = { key: '', lines: [] };
  B.chalkLines = function () {
    if (chalkCache.key === B.today) return chalkCache.lines;
    const all = B.active('chalk');
    const special = all.filter((c) => c.dates || c.from || c.until); // date-gated boards win while they're on
    const pool = special.length ? special : all.filter((c) => !c.dates);
    const pick = pool.length ? pool[B.hash(B.today) % pool.length] : null;
    chalkCache = { key: B.today, lines: pick ? pick.lines.slice(0, 3) : [] };
    return chalkCache.lines;
  };

  function drawChalkboard(g, s) {
    if (!s.shop.open) return;
    // a low A-board at the alley mouth, so the alley shows above it
    px(g, WOOD_D, 282, 164, 3, 8);
    px(g, WOOD_D, 309, 164, 3, 8);
    px(g, WOOD_D, 284, 168, 26, 1);
    px(g, WOOD, 281, 145, 32, 21);
    px(g, '#26302b', 283, 146, 28, 19);
    B.chalkLines().forEach((line, i) => B.text(g, line, 297 - Math.floor(B.textWidth(line) / 2), 147 + i * 6, 'rgba(240,238,225,0.92)'));
  }

  function drawStreetLamp(g, day, fog = 0) {
    const on = day < 0.5 || fog > 0.5;
    if (fog > 0.5) day = Math.min(day, 0.3); // lit in the fog, with a bigger halo
    px(g, on ? '#ffe7a0' : '#9fb3b8', LAMP - 5, 9, 11, 11);
    if (!on) return;
    g.globalCompositeOperation = 'lighter';
    const a = (0.5 - day) * 0.5 + fog * 0.2;
    let gr = g.createRadialGradient(LAMP, 15, 1, LAMP, 15, 46 + fog * 30);
    gr.addColorStop(0, `rgba(255,220,140,${a})`);
    gr.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = gr;
    g.fillRect(LAMP - 80, 0, 160, 100);
    g.save();
    g.scale(1, 0.25);
    gr = g.createRadialGradient(LAMP, 172 * 4, 1, LAMP, 172 * 4, 40);
    gr.addColorStop(0, `rgba(255,210,130,${a * 0.8})`);
    gr.addColorStop(1, 'rgba(255,210,130,0)');
    g.fillStyle = gr;
    g.fillRect(LAMP - 44, 162 * 4, 88, 18 * 4);
    g.restore();
    g.globalCompositeOperation = 'source-over';
  }

  // ---------- particles & decor ----------
  function drawParticles(g, s, layer) {
    for (const p of s.particles) {
      if (p.layer !== layer) continue;
      const fade = 1 - p.age / p.life;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.kind === 'drop') px(g, p.c, x, y, 1, 4);
      else if (p.kind === 'flake') px(g, p.c, x, y, p.big ? 2 : 1, p.big ? 2 : 1);
      else if (p.w) px(g, p.c, x, y, p.w, p.h);
      else if (p.kind === 'note' || p.kind === 'speech' || p.kind === 'z') {
        g.globalAlpha = Math.min(1, fade * 1.6);
        B.drawGlyph(g, p.kind, x, y, p.c, p.sc || 2);
        g.globalAlpha = 1;
      } else if (p.kind === 'steam') {
        g.globalAlpha = fade * 0.8;
        px(g, p.c, x, y, 2 + (p.age > 0.6 ? 1 : 0), 2);
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = Math.min(1, fade * 2);
        px(g, p.c, x, y, 2, 2);
        g.globalAlpha = 1;
      }
    }
  }

  function decor(g, s, layer) {
    for (const d of B.registry.decor) {
      if (d.layer !== layer || !B.isActive(d)) continue;
      try {
        if (!d.when || d.when(s)) d.draw(g, s);
      } catch (e) {
        console.error('[bookshop] decor', d.id, e);
        d.disabled = true;
      }
    }
  }

  const glow = (g, x, y, r, rgba) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, rgba);
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // ---------- snow & fog ----------
  const SNOW = '#f4f7fb';
  const SNOW_SH = '#d8e0ea';
  /** Snow lying on ledges and sills (drawn over the facade). */
  function drawSnowLedges(g, s) {
    const c = s.weather.cover || 0;
    if (c < 0.05) return;
    const h = c > 0.6 ? 2 : 1;
    const ledge = (x, y, w) => {
      px(g, SNOW, x, y - h, w, h);
      px(g, SNOW_SH, x, y, w, 1);
    };
    ledge(0, 8, 280); // roof cornice
    ledge(318, 8, 2);
    ledge(244, 1, 18); // chimney
    ledge(0, 52, 274); // top of the sign
    for (const u of B.LAYOUT.upstairs) ledge(u.x - 4, u.y + u.h + 2, u.w + 8);
    ledge(4, 144, 212); // shop window sill
    ledge(LAMP - 7, 7, 15); // lamp cap
    ledge(274, 13, 6);
    if (s.shop.open) ledge(281, 145, 32); // on top of the A-board
  }
  /** Snow on the pavement (and the alley), with a cleared patch where someone has swept. */
  function drawSnowGround(g, s) {
    const c = s.weather.cover || 0;
    if (c < 0.05) return;
    const w = s.weather;
    let clearFrom = null;
    if (w.cleared) {
      const since = s.simT - w.cleared.t;
      const refill = Math.min(1, (since * (w.snow || 0)) / 90);
      if (refill < 1) clearFrom = { ...w.cleared, k: 1 - refill };
    }
    const a = Math.min(0.92, 0.25 + c * 0.75);
    g.fillStyle = `rgba(244,247,251,${a})`;
    for (let x = 0; x < 320; x += 4) {
      const inClear = clearFrom && x >= clearFrom.x1 && x < clearFrom.x2;
      const top = 164 + (Math.floor(x / 4) % 3 === 0 ? 1 : 0);
      if (inClear) g.globalAlpha = 1 - clearFrom.k;
      g.fillRect(x, top, 4, 14);
      g.globalAlpha = 1;
    }
    px(g, `rgba(216,224,234,${a})`, 0, 177, 320, 1);
  }
  /** Fog: a pale veil with slow-drifting banks, thickest far away (the town up the alley vanishes). */
  function drawFog(g, s, day) {
    const f = s.weather.fog || 0;
    if (f < 0.03) return;
    const col = day > 0.4 ? '200,204,210' : '104,112,130';
    px(g, `rgba(${col},${(day > 0.4 ? 0.32 : 0.42) * f})`, 0, 0, B.W, B.H);
    for (let i = 0; i < 5; i++) {
      const y = 20 + i * 32 + Math.sin(s.simT * 0.05 + i) * 6;
      const x = ((s.simT * (3 + i) + i * 90) % 480) - 160;
      g.fillStyle = `rgba(${col},${0.14 * f})`;
      g.fillRect(Math.round(x), Math.round(y), 170, 18);
      g.fillRect(Math.round(x) + 20, Math.round(y) - 4, 120, 26);
    }
  }
  function drawFogFar(g, s, day) {
    const f = s.weather.fog || 0;
    if (f < 0.03) return;
    const col = day > 0.4 ? '200,204,210' : '104,112,130';
    px(g, `rgba(${col},${0.7 * f})`, 280, 0, 38, 164);
  }

  function interiorLight(g, s, day, lit) {
    const W = B.LAYOUT.win;
    const dark = lit ? (1 - day) * 0.1 : 0.28 + (1 - day) * 0.5;
    px(g, `rgba(12,14,38,${dark})`, W.x, W.y, W.w, W.h);
    if (lit) px(g, 'rgba(255,190,110,0.05)', W.x, W.y, W.w, W.h);
    g.globalCompositeOperation = 'lighter';
    if (lit) {
      const k = 0.1 + (1 - day) * 0.1;
      glow(g, 40, 96, 42, `rgba(255,200,120,${k})`);
      glow(g, 170, 96, 42, `rgba(255,200,120,${k})`);
      glow(g, 88, 100, 12, 'rgba(255,190,110,0.12)');
    }
    if (s.lamp) glow(g, 139, 118, 22, 'rgba(255,210,130,0.28)');
    if (!lit && B.config.displayLampAtNight && day < 0.5) glow(g, 38, 136, 30, 'rgba(255,200,120,0.22)');
    g.globalCompositeOperation = 'source-over';
  }

  /** Light from the shop window spilling across the pavement after dark. */
  function shopSpill(g, s, day, lit) {
    const W = B.LAYOUT.win;
    if (!lit || day >= 0.8) return;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,170,90,${(0.8 - day) * 0.14})`;
    g.beginPath();
    g.moveTo(W.x, 164);
    g.lineTo(W.x + W.w, 164);
    g.lineTo(W.x + W.w + 20, 180);
    g.lineTo(W.x - 20, 180);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  const PARTS = {
    makeFacade, makeStreet, makeInterior, makeCounter, makeGlass,
    skyColors, drawSky, drawUpstairs, drawAlley, drawAlleyLights,
    drawBooks, drawClock, drawRadio, drawCoffee, drawPendants, drawCounterItems, drawDisplay,
    drawDoor, drawChalkboard, drawStreetLamp, interiorLight, shopSpill,
    passageShade: (g, A) => px(g, 'rgba(20,12,6,0.18)', A.x, A.y, A.w, A.h),
    nightTint: (night) => `rgba(10,14,36,${night})`,
    phoneCord: '#7a1f1a',
    post: null, // optional whole-frame post-process (colour grade, bloom)
  };
  // drawing helpers for themes
  B.renderKit = {
    PARTS, makeCanvas, shadowText, glow, scan, lerp, AL, wallL, wallR, TOWN, LETTERS, CIN, NEON, rgbOf, neonState,
    drawCinema, drawNeon, drawParticles, decor, drawDoorway, paintLeaf, LAMP, G, G2, G3, GOLD, WOOD, WOOD_D, WOOD_L,
    drawSnowLedges, drawSnowGround, TV_COLS,
  };

  // ---------- the frame ----------
  B.render = function (g, s) {
    const L = B.LAYOUT;
    const W = L.win;
    const A = L.arch;
    const day = B.daylight(s.hour);
    const o = s.owner;
    const lit = s.shop.lights;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, B.W, B.H);
    const skyBot = part('drawSky')(g, s);
    part('drawAlley')(g, s, part('skyColors')(s.hour, s.weather.cloud)[0], skyBot);
    drawFogFar(g, s, day);
    decor(g, s, 'sky');
    part('drawUpstairs')(g, s, skyBot);

    // ----- interior (clipped to the window) -----
    const inside = s.npcs.filter((n) => n.area === 'inside' && !n.hidden);
    if (o.area === 'inside' && !o.hidden) inside.push(o);
    g.save();
    g.beginPath();
    g.rect(W.x, W.y, W.w, W.h);
    g.clip();
    g.drawImage(B.cache.interior, 0, 0);
    part('drawBooks')(g, s);
    part('drawClock')(g, s);
    part('drawRadio')(g, s);
    part('drawCoffee')(g, s);
    // people heading into (or back out of) the passage
    const passage = inside.filter((a) => a.depth === 'passage');
    if (passage.length) {
      g.save();
      g.beginPath();
      g.rect(A.x, A.y, A.w, A.h);
      g.clip();
      for (const a of passage) {
        const pz = a.pz || 0;
        // further in = smaller and higher up; climbing the stairs lifts them further
        B.drawPersonScaled(g, a, a.x, a.y - 18 * pz - 30 * (a.climb || 0), 1 - 0.35 * pz);
      }
      g.restore();
    }
    part('passageShade')(g, A);
    part('drawPendants')(g, s);
    decor(g, s, 'interior-back');
    inside.filter((a) => a.depth === 'back').forEach((a) => B.drawPerson(g, a));
    part('drawCounterItems')(g, s);
    if (o.area === 'inside' && o.holding === 'receiver') {
      const fd = o.dir || 1;
      B.line(g, 150, L.counterTop - 5, o.x - 8 * fd, B.headTop(o) + 22, part('phoneCord'));
    }
    decor(g, s, 'counter');
    inside.filter((a) => a.depth === 'front').forEach((a) => B.drawPerson(g, a));
    decor(g, s, 'interior');
    drawParticles(g, s, 'in');
    part('drawDisplay')(g, s);
    decor(g, s, 'interior-front');
    if (B.snapInterior) B.snapInterior(g); // the interior's true colours, before it's darkened (for lights to reveal)
    part('interiorLight')(g, s, day, lit);
    g.drawImage(B.cache.glass, 0, 0);
    if (s.weather.rain > 0.3) {
      for (let i = 0; i < 16; i++) {
        const x = W.x + 6 + ((i * 53) % (W.w - 12));
        const y = W.y + ((s.simT * (8 + (i % 4)) * 3 + i * 17) % W.h);
        px(g, 'rgba(200,220,240,0.25)', x, Math.round(y), 1, 4);
      }
    }
    g.restore();

    // ----- facade, door, street -----
    g.drawImage(B.cache.facade, 0, 0);
    part('drawDoor')(g, s);
    decor(g, s, 'facade');
    drawSnowLedges(g, s);
    g.drawImage(B.cache.street, 0, 0);
    drawSnowGround(g, s);
    part('drawChalkboard')(g, s);
    decor(g, s, 'street');
    const street = s.npcs.filter((n) => n.area === 'street' && !n.hidden);
    if (o.area === 'street') street.push(o);
    street.sort((a, b) => a.y - b.y);
    for (const a of street) {
      if (a.dog && (a.alpha == null || a.alpha > 0.6)) B.line(g, a.x - 8 * (a.dir || 1), B.headTop(a) + 31, a.dog.x + 10 * (a.dir || 1), a.dog.y - 9, '#3a2a1a');
      B.drawPerson(g, a);
      if (a.dog) {
        a.dog.alpha = a.alpha == null ? 1 : a.alpha; // the dog comes and goes with its walker
        B.drawDog(g, a.dog, a.dog.sniff > 0 ? -(a.dir || 1) : a.dir || 1, a.t);
      }
    }
    drawParticles(g, s, 'out');
    drawParticles(g, s, 'rain');
    decor(g, s, 'road'); // traffic in front of the pavement
    drawFog(g, s, day);

    // ----- night -----
    if (B.snapExterior) B.snapExterior(g); // the street's true colours, before night falls on them (for lights to reveal)
    const night = (1 - day) * 0.6 + s.weather.cloud * 0.08 * day;
    if (night > 0.01) {
      g.fillStyle = part('nightTint')(night);
      g.beginPath();
      g.rect(0, 0, B.W, B.H);
      g.rect(W.x, W.y, W.w, W.h);
      if (lit) {
        const d = (s.door.open || 0) > 0.02 ? L.doorOpening : L.doorGlass;
        g.rect(d.x, d.y, d.w, d.h);
      }
      if (B.upstairsLit(s)) for (const u of L.upstairs) g.rect(u.x, u.y, u.w, u.h);
      g.fill('evenodd');
    }
    part('drawAlleyLights')(g, s);
    part('drawStreetLamp')(g, day, s.weather.fog || 0, s);
    part('shopSpill')(g, s, day, lit);
    decor(g, s, 'overlay');
    const post = part('post');
    if (post) post(g, s, day);

    // ----- speech bubbles on top of everything -----
    for (const a of s.npcs.concat(o.area === 'away' ? [] : [o])) {
      if (!a.emoteKind || a.hidden || (a.alpha != null && a.alpha < 0.5)) continue;
      if (a.area === 'upstairs' && !L.upstairs.some((u) => a.x > u.x - 2 && a.x < u.x + u.w + 2)) continue;
      B.drawBubble(g, a.x, B.headTop(a), a.emoteKind);
    }

    if (s.paused) {
      px(g, 'rgba(0,0,0,0.35)', 0, 0, B.W, B.H);
      B.text(g, 'PAUSED', 160 - B.textWidth('PAUSED', 3) / 2, 84, '#fffaf0', 3);
    }
  };
})();
