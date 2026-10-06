/* Pixel drawing helpers: 3x5 font, colour utils, people, dogs, emote bubbles. */
(function () {
  'use strict';
  const B = window.Bookshop;

  const px = (B.px = (g, c, x, y, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  });

  // ---------- colours ----------
  const shadeCache = new Map();
  B.shade = (hex, f) => {
    const key = hex + f;
    if (shadeCache.has(key)) return shadeCache.get(key);
    const n = parseInt(hex.slice(1), 16);
    let rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgb = rgb.map((v) => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
    const out = '#' + rgb.map((v) => Math.round(B.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
    shadeCache.set(key, out);
    return out;
  };
  B.mix = (h1, h2, t) => {
    const a = parseInt(h1.slice(1), 16);
    const b = parseInt(h2.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(B.lerp((a >> s) & 255, (b >> s) & 255, t)));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };

  B.line = (g, x0, y0, x1, y1, c) => {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    g.fillStyle = c;
    for (let i = 0; i < 400; i++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  // ---------- 3x5 font ----------
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
    '-': '000000111000000', ':': '000010000010000', "'": '010010000000000', '&': '010101010101011',
    '/': '001001010100100', '+': '000010111010000', '£': '011010111010111', '*': '000101010101000',
    '#': '101111101111101', '(': '010100100100010', ')': '010001001001010', '=': '000111000111000',
    ' ': '000000000000000',
  };
  /** The 3x5 bitmap of a character, as a 15-char string of 0/1 (row by row). */
  B.glyph = (ch) => FONT[String(ch).toUpperCase()] || null;
  B.textWidth = (str, sc = 1) => (str.length ? (str.length * 4 - 1) * sc : 0);
  B.text = (g, str, x, y, color, sc = 1) => {
    g.fillStyle = color;
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const f = FONT[ch];
      if (f) for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(cx + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc);
      cx += 4 * sc;
    }
  };

  // ---------- emote icons (5x5, '#' = main colour, '*' = second colour) ----------
  B.ICONS = {
    note: { c: '#5b3b8c', p: ['..##.', '..#.#', '..#..', '###..', '###..'] },
    heart: { c: '#d6336c', p: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
    bang: { c: '#d9480f', p: ['..#..', '..#..', '..#..', '.....', '..#..'] },
    what: { c: '#1c7ed6', p: ['.###.', '...#.', '..#..', '.....', '..#..'] },
    zzz: { c: '#4c6ef5', p: ['####.', '..#..', '.#...', '####.', '.....'] },
    rain: { c: '#868e96', c2: '#4dabf7', p: ['.##..', '####.', '#####', '.....', '*.*.*'] },
    talk: { c: '#343a40', p: ['.....', '.....', '#.#.#', '.....', '.....'] },
    dots: { c: '#868e96', p: ['.....', '.....', '#.#.#', '.....', '.....'] },
    coffee: { c: '#7a4a26', c2: '#adb5bd', p: ['*.*..', '.*.*.', '####.', '###.#', '.##..'] },
    spark: { c: '#f2b90c', p: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'] },
    angry: { c: '#e03131', p: ['.#.#.', '##.##', '.....', '##.##', '.#.#.'] },
    sweat: { c: '#4dabf7', p: ['..#..', '..#..', '.###.', '.###.', '..#..'] },
    happy: { c: '#e8590c', p: ['.....', '.#.#.', '.....', '#...#', '.###.'] },
    book: { c: '#2f4f8c', c2: '#f4efe2', p: ['#*.*#', '#*.*#', '#*.*#', '#*.*#', '.#.#.'] },
    sun: { c: '#f59f00', p: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'] },
    phone: { c: '#9c2b23', p: ['#...#', '#####', '.#.#.', '.###.', '.###.'] },
    coin: { c: '#e0a800', p: ['.###.', '##.##', '#.#.#', '##.##', '.###.'] },
    sigh: { c: '#868e96', p: ['.....', '.#...', '#.#.#', '...#.', '.....'] },
  };

  B.drawIcon = (g, kind, x, y, sc = 1) => {
    const ic = B.ICONS[kind];
    if (!ic) return;
    ic.p.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '#') px(g, ic.c, x + i * sc, y + j * sc, sc, sc);
        else if (ch === '*') px(g, ic.c2 || ic.c, x + i * sc, y + j * sc, sc, sc);
      }
    });
  };

  /** Speech/thought bubble (icons drawn at 2x) whose tail points at (x, headTop). */
  B.drawBubble = (g, x, headTop, kind) => {
    if (!B.ICONS[kind]) return;
    x = Math.round(x);
    const bx = x - 8;
    const by = Math.round(headTop) - 19;
    const ink = '#2b2622';
    const paper = '#fffaf0';
    px(g, ink, bx + 2, by, 12, 1);
    px(g, ink, bx + 2, by + 15, 12, 1);
    px(g, ink, bx, by + 2, 1, 12);
    px(g, ink, bx + 15, by + 2, 1, 12);
    px(g, ink, bx + 1, by + 1, 1, 1);
    px(g, ink, bx + 14, by + 1, 1, 1);
    px(g, ink, bx + 1, by + 14, 1, 1);
    px(g, ink, bx + 14, by + 14, 1, 1);
    px(g, paper, bx + 1, by + 2, 14, 12);
    px(g, paper, bx + 2, by + 1, 12, 14);
    px(g, paper, x - 2, by + 15, 3, 1);
    px(g, paper, x - 1, by + 16, 2, 1);
    px(g, ink, x - 3, by + 15, 1, 1);
    px(g, ink, x + 1, by + 15, 1, 2);
    px(g, ink, x - 2, by + 16, 1, 1);
    px(g, ink, x - 1, by + 17, 2, 1);
    B.drawIcon(g, kind, bx + 3, by + 3, 2);
  };

  // ---------- small particle glyphs ----------
  const GLYPH = {
    note: ['.##', '.#.', '.#.', '##.', '##.'],
    z: ['####', '..#.', '.#..', '####'],
    speech: ['###', '...', '##.'],
  };
  B.drawGlyph = (g, name, x, y, c, sc = 2) => {
    const rows = GLYPH[name];
    if (!rows) return;
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] === '#') px(g, c, x + i * sc, y + j * sc, sc, sc);
    });
  };
})();
