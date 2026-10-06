/* Star Trek: The Next Generation, as it looks on a small telly across the street: a 64x48 pixel homage.
 * One looping "episode": cold open, titles, warp, the bridge ("Engage."), tea in the ready room, red alert,
 * a space battle, the transporter, the holodeck and the end credits.
 * The music is an original space-opera fanfare in the spirit of the show (not the actual theme), and the
 * effects (warp, phasers, transporter, red-alert klaxon, comm-badge chirps) are synthesised. */
(function (B) {
  const P = B.px;
  const W = 64;
  const H = 48;

  // ---------- picture helpers ----------
  const STARS = Array.from({ length: 46 }, (_, i) => ({ x: (i * 37) % W, y: (i * 23 + (i % 5) * 7) % H, z: 0.3 + ((i * 13) % 10) / 10 }));
  function stars(g, t, speed = 2, streak = 0, bg = '#02030a') {
    P(g, bg, 0, 0, W, H);
    for (const s of STARS) {
      const x = (((s.x - t * speed * s.z * 4) % W) + W) % W;
      const c = s.z > 0.9 ? '#ffffff' : s.z > 0.6 ? '#c8d4ff' : '#6a7090';
      if (streak > 0) {
        // warp: stars stretch into lines streaming outward from the centre
        const dx = s.x - W / 2;
        const dy = s.y - H / 2;
        const len = 1 + streak * 14 * s.z;
        const k = Math.hypot(dx, dy) || 1;
        B.line(g, s.x, s.y, s.x + (dx / k) * len, s.y + (dy / k) * len, c);
      } else P(g, c, Math.round(x), s.y, 1, 1);
    }
  }

  const canvas = (w, h, fn) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (g) fn(g);
    return c;
  };
  // The Enterprise-D in profile (facing right), drawn once at full size; scaled when it's further away.
  let ENT = null;
  const enterprise = () =>
    ENT ||
    (ENT = canvas(40, 15, (g) => {
      const x = 28;
      const y = 6;
      // far nacelle, a little lower and darker
      P(g, '#6e737d', x - 27, y + 1, 15, 2);
      P(g, '#2e5aa0', x - 26, y + 2, 13, 1);
      P(g, '#a02a20', x - 13, y + 1, 2, 2);
      // near nacelle
      P(g, '#b0b4bc', x - 28, y - 1, 15, 2);
      P(g, '#5ab4ff', x - 27, y, 13, 1);
      P(g, '#ff3a2a', x - 14, y - 1, 2, 2);
      B.line(g, x - 18, y + 1, x - 15, y + 5, '#8a8f99'); // pylon
      // engineering hull and the deflector dish
      P(g, '#a3a7b0', x - 17, y + 4, 14, 2);
      P(g, '#7a7f8a', x - 16, y + 6, 12, 1);
      P(g, '#ffa23a', x - 4, y + 4, 2, 2);
      for (let i = x - 15; i < x - 5; i += 2) P(g, '#ffe9a8', i, y + 4, 1, 1);
      // neck
      P(g, '#9a9ea8', x - 6, y + 2, 3, 2);
      // saucer
      P(g, '#d8dce4', x, y - 3, 2, 1);
      P(g, '#c7cbd3', x - 5, y - 2, 11, 1);
      P(g, '#b9bdc6', x - 8, y - 1, 17, 1);
      P(g, '#a9adb6', x - 9, y, 19, 1);
      for (let i = x - 7; i <= x + 7; i += 2) P(g, '#ffe9a8', i, y, 1, 1);
      P(g, '#8a8f99', x - 8, y + 1, 17, 1);
      P(g, '#6e737d', x - 5, y + 2, 11, 1);
    }));
  // A green bird-of-prey-like warbird (facing left), wings swept down.
  let BOP = null;
  const warbird = () =>
    BOP ||
    (BOP = canvas(22, 12, (g) => {
      P(g, '#3a5a2a', 2, 4, 4, 3); // the head
      P(g, '#5a8a3a', 3, 4, 3, 1);
      P(g, '#2a4020', 6, 5, 8, 2); // neck
      P(g, '#4a7a3a', 12, 3, 8, 5); // body
      P(g, '#6a9a4a', 13, 3, 6, 1);
      B.line(g, 13, 7, 7, 11, '#3a5a2a'); // wings swept down
      B.line(g, 14, 7, 9, 11, '#4a7a3a');
      B.line(g, 17, 3, 12, 0, '#3a5a2a');
      P(g, '#ff5a3a', 19, 5, 1, 1);
    }));

  function sub(g, lines, col = '#ffe9a8') {
    const ls = Array.isArray(lines) ? lines : [lines];
    ls.forEach((l, i) => {
      const y = H - 6 - (ls.length - 1 - i) * 6;
      const x = Math.round(W / 2 - B.textWidth(l) / 2);
      P(g, 'rgba(0,0,0,0.6)', x - 1, y - 1, B.textWidth(l) + 1, 7);
      B.text(g, l, x, y, col);
    });
  }

  // The bridge from behind the captain's chair, looking at the main viewer.
  function bridge(g, t, opt = {}) {
    P(g, '#1e1a18', 0, 0, W, 4); // ceiling
    P(g, '#5e5248', 0, 4, W, 26); // back wall
    for (let x = 0; x < W; x += 8) P(g, '#54483f', x, 4, 1, 26);
    // the main viewer
    const vs = { x: 12, y: 5, w: 40, h: 19 };
    g.save();
    g.beginPath();
    g.rect(vs.x, vs.y, vs.w, vs.h);
    g.clip();
    g.translate(vs.x, vs.y);
    g.scale(vs.w / W, vs.h / H);
    (opt.viewer || ((gg) => stars(gg, t, 0.6)))(g, t);
    g.restore();
    P(g, '#2a2420', vs.x - 1, vs.y - 1, vs.w + 2, 1);
    P(g, '#2a2420', vs.x - 1, vs.y + vs.h, vs.w + 2, 1);
    // floor, the curved wooden rail and the consoles
    P(g, '#3e3530', 0, 30, W, 18);
    for (let x = 2; x < W - 2; x++) {
      const y = Math.round(27 + Math.pow((x - 32) / 32, 2) * -6);
      P(g, '#8a5a34', x, y, 1, 2);
      P(g, '#a8703f', x, y, 1, 1);
    }
    for (const cx of [14, 40]) {
      P(g, '#2a2a30', cx, 30, 12, 4);
      for (let i = 0; i < 5; i++) P(g, ['#ffb04a', '#5ab4ff', '#ff6a5a', '#9ad07a'][(i + Math.floor(t * 3)) % 4], cx + 1 + i * 2, 31, 1, 1);
    }
    // ops and conn: the android (pale gold) and the young ensign, from behind
    P(g, '#c9a43a', 18, 33, 5, 4);
    P(g, '#1a1a1a', 18, 33, 5, 1);
    P(g, '#e8dca0', 19, 30, 3, 3);
    P(g, '#2a2420', 19, 30, 3, 1);
    P(g, '#c9a43a', 43, 33, 5, 4);
    P(g, '#1a1a1a', 43, 33, 5, 1);
    P(g, '#e0b090', 44, 30, 3, 3);
    P(g, '#6a4a2a', 44, 30, 3, 1);
    // the counsellor (left) and the first officer (right) in their chairs
    P(g, '#3a3040', 6, 39, 8, 7);
    P(g, '#6a5aa0', 7, 37, 6, 5);
    P(g, '#2a1a20', 7, 33, 6, 5);
    P(g, '#3a3040', 50, 39, 8, 7);
    P(g, '#a82a2a', 51, 37, 6, 5);
    P(g, '#1a1a1a', 51, 37, 6, 1);
    P(g, '#d8a888', 52, 33, 4, 4);
    P(g, '#3a2418', 52, 33, 4, 1);
    // the captain: in his chair, or on his feet pointing at the viewer
    const up = opt.stand || 0;
    P(g, '#3a3040', 27, 40, 10, 8); // chair back
    const cy = 35 - Math.round(up * 5);
    P(g, '#a82a2a', 28, cy + 4, 8, 7);
    P(g, '#1a1a1a', 28, cy + 4, 8, 2); // black shoulders
    P(g, '#e0b090', 30, cy, 4, 4); // bald head
    P(g, '#f0c8a0', 30, cy, 2, 1);
    if (opt.point) {
      B.line(g, 35, cy + 5, 40, cy + 1, '#a82a2a');
      P(g, '#e0b090', 40, cy, 1, 1);
    }
    if (opt.red) {
      const on = Math.floor(t * 2.5) % 2 === 0;
      g.globalAlpha = on ? 0.32 : 0.16;
      P(g, '#ff1a1a', 0, 0, W, H);
      g.globalAlpha = 1;
      for (const x of [2, 60]) P(g, on ? '#ff3a3a' : '#7a1a1a', x, 6, 2, 22);
    }
  }

  // ---------- sounds (synthesised, on the telly's own bus) ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function setup() {
    const A = B.audio;
    // An original heroic fanfare: an arpeggio rising over a held chord, answered and resolved, with timpani.
    A.define('tng-fanfare', ({ tone, noise, tv }) => {
      const beat = 0.42;
      const brass = (m, at, len, vol = 0.07) => {
        tone(mtof(m), len * beat, { bus: tv, at: at * beat, type: 'sawtooth', vol, a: 0.06, lp: 2000 });
        tone(mtof(m) * 1.004, len * beat, { bus: tv, at: at * beat, type: 'sawtooth', vol: vol * 0.6, a: 0.08, lp: 1600 });
      };
      const strings = (ms, at, len) => ms.forEach((m) => tone(mtof(m), len * beat, { bus: tv, at: at * beat, type: 'triangle', vol: 0.03, a: 0.4 }));
      const timp = (at, f = 73) => {
        tone(f, 0.6, { bus: tv, at: at * beat, vol: 0.14, slide: f * 0.8 });
        noise(0.2, { bus: tv, at: at * beat, ftype: 'lowpass', freq: 300, vol: 0.05 });
      };
      for (let i = 0; i < 6; i++) noise(0.12, { bus: tv, at: i * 0.08, ftype: 'lowpass', freq: 260, vol: 0.03 + i * 0.008 }); // a timpani roll
      [[62, 0.6, 0.6], [66, 1.2, 0.6], [69, 1.8, 0.6], [71, 2.4, 1.2], [69, 3.6, 2]].forEach(([m, at, l]) => brass(m, at, l));
      [[67, 6, 0.6], [66, 6.6, 0.6], [64, 7.2, 0.6], [69, 7.8, 1.2], [74, 9, 3]].forEach(([m, at, l]) => brass(m, at, l, 0.075));
      strings([50, 57, 62, 66], 0.6, 5.4);
      strings([55, 59, 62, 67], 6, 3);
      strings([50, 57, 62, 66, 69], 9, 3.2);
      [0.6, 3.6, 6, 9, 9.5].forEach((b) => timp(b, b >= 9 ? 73 : 98));
    });
    A.define('tng-pad', ({ tone, noise, tv }) => {
      [38, 45, 50].forEach((m) => tone(mtof(m), 5.5, { bus: tv, type: 'sine', vol: 0.04, a: 1.2 }));
      noise(5.5, { bus: tv, ftype: 'lowpass', freq: 220, vol: 0.02, a: 1, r: 1.5 });
    });
    A.define('tng-hum', ({ tone, noise, tv }) => {
      tone(55, 9, { bus: tv, type: 'sine', vol: 0.05, a: 0.5 });
      noise(9, { bus: tv, ftype: 'lowpass', freq: 260, vol: 0.02, a: 0.5, r: 0.5 });
    });
    A.define('tng-beep', ({ tone, tv }) => [1400, 1750, 1250].forEach((f, i) => tone(f, 0.07, { bus: tv, at: i * 0.09, type: 'sine', vol: 0.04 })));
    A.define('tng-chirp', ({ tone, tv }) => {
      tone(2200, 0.06, { bus: tv, type: 'sine', vol: 0.05, slide: 2700 });
      tone(1700, 0.08, { bus: tv, at: 0.07, type: 'sine', vol: 0.04 });
    });
    A.define('tng-talk', ({ tone, tv }, f = 120, n = 6) => {
      for (let i = 0; i < n; i++) {
        const base = f * (1 + (Math.random() - 0.5) * 0.25);
        tone(base, 0.13, { bus: tv, at: i * 0.17, type: 'sawtooth', vol: 0.03, lp: 1200, slide: base * (Math.random() < 0.5 ? 0.9 : 1.08) });
      }
    });
    A.define('tng-warp', ({ tone, noise, tv }) => {
      noise(1.4, { bus: tv, freq: 300, fto: 5000, q: 0.8, vol: 0.06, a: 0.3 });
      tone(70, 1.3, { bus: tv, type: 'sawtooth', vol: 0.05, slide: 420, lp: 1500, a: 0.2 });
      tone(48, 1.2, { bus: tv, at: 1.3, vol: 0.14, slide: 30 });
      noise(1, { bus: tv, at: 1.3, ftype: 'lowpass', freq: 500, fto: 120, vol: 0.08 });
    });
    A.define('tng-replicator', ({ tone, noise, tv }) => {
      noise(1.6, { bus: tv, freq: 6000, q: 2, vol: 0.03, a: 0.3, r: 0.4 });
      for (let i = 0; i < 10; i++) tone(2400 + Math.random() * 1800, 0.12, { bus: tv, at: i * 0.14, type: 'sine', vol: 0.015 });
    });
    A.define('tng-klaxon', ({ tone, tv }) => {
      tone(420, 0.55, { bus: tv, type: 'triangle', vol: 0.08, slide: 840 });
      tone(422, 0.55, { bus: tv, type: 'square', vol: 0.02, slide: 845, lp: 1500 });
    });
    A.define('tng-phaser', ({ tone, noise, tv }) => {
      tone(1300, 1, { bus: tv, type: 'sawtooth', vol: 0.04, slide: 700, lp: 3000 });
      tone(1950, 1, { bus: tv, type: 'square', vol: 0.015, slide: 1050, lp: 3000 });
      noise(1, { bus: tv, freq: 2500, q: 2, vol: 0.02 });
    });
    A.define('tng-disruptor', ({ tone, tv }) => tone(320, 0.45, { bus: tv, type: 'square', vol: 0.04, slide: 160, lp: 1800 }));
    A.define('tng-torpedo', ({ tone, noise, tv }) => {
      tone(950, 0.35, { bus: tv, type: 'sine', vol: 0.06, slide: 280 });
      noise(0.2, { bus: tv, ftype: 'lowpass', freq: 600, vol: 0.05 });
    });
    A.define('tng-boom', ({ tone, noise, tv }) => {
      noise(2.2, { bus: tv, ftype: 'lowpass', freq: 900, fto: 90, vol: 0.12, r: 1.2 });
      tone(55, 1.4, { bus: tv, vol: 0.12, slide: 28 });
    });
    A.define('tng-transport', ({ tone, noise, tv }) => {
      noise(3.4, { bus: tv, freq: 3500, fto: 7000, q: 3, vol: 0.035, a: 0.6, r: 0.8 });
      for (let i = 0; i < 26; i++) tone(1800 + Math.random() * 2600, 0.18, { bus: tv, at: i * 0.12, type: 'sine', vol: 0.014 });
    });
    A.define('tng-door', ({ noise, tv }) => noise(0.35, { bus: tv, freq: 2200, fto: 400, q: 0.7, vol: 0.05 }));
    A.define('tng-birds', ({ tone, tv }) => {
      for (let i = 0; i < 5; i++) {
        const f = 2600 + Math.random() * 1200;
        tone(f, 0.08, { bus: tv, at: i * 0.3 + Math.random() * 0.1, type: 'sine', vol: 0.025, slide: f * 1.3 });
      }
    });
  }

  // ---------- the episode ----------
  B.show({
    id: 'tng',
    name: 'Star Trek: The Next Generation',
    short: 'STAR TREK TNG',
    genre: 'Sci-fi',
    color: '#3a6ad0',
    likes: 0.9, // Mabel's favourite: she'd follow that captain anywhere
    setup,
    scenes: [
      {
        id: 'cold-open',
        dur: 6,
        caption: 'Space, the starship cruising past',
        react: 'heart',
        log: '{name} hums along as the starship glides across the screen.',
        cues: [[0, 'tng-pad'], [3.5, 'tng-beep']],
        draw(g, t, k) {
          stars(g, t, 1);
          g.drawImage(enterprise(), Math.round(-40 + k * 66), 16);
        },
      },
      {
        id: 'titles',
        dur: 6.5,
        caption: 'The opening titles',
        cues: [[0, 'tng-fanfare']],
        draw(g, t, k) {
          stars(g, t, 0.4);
          // a banded gas giant and its sun
          const gr = g.createRadialGradient(54, 6, 1, 54, 6, 22);
          gr.addColorStop(0, 'rgba(255,240,200,0.9)');
          gr.addColorStop(1, 'rgba(255,200,120,0)');
          g.fillStyle = gr;
          g.fillRect(30, 0, 34, 30);
          for (let y = 30; y < H; y++) {
            const r = 36;
            const half = Math.sqrt(Math.max(0, r * r - Math.pow(y - 70, 2)));
            P(g, ['#b0784a', '#c99a62', '#8a5a3a', '#d8b07a'][Math.floor((y + t * 2) / 3) % 4], Math.round(32 - half), y, Math.round(half * 2), 1);
          }
          if (k > 0.45) g.drawImage(enterprise(), Math.round(-40 + (k - 0.45) * 190), 20);
          if (k > 0.15) {
            g.globalAlpha = Math.min(1, (k - 0.15) * 5);
            B.text(g, 'STAR TREK', 32 - Math.floor(B.textWidth('STAR TREK') / 2), 4, '#e8eef8');
            B.text(g, 'THE NEXT', 32 - Math.floor(B.textWidth('THE NEXT') / 2), 11, '#9ab8ff');
            B.text(g, 'GENERATION', 32 - Math.floor(B.textWidth('GENERATION') / 2), 17, '#9ab8ff');
            g.globalAlpha = 1;
          }
        },
      },
      {
        id: 'warp',
        dur: 3,
        caption: 'Jumping to warp',
        react: 'spark',
        cues: [[0, 'tng-warp']],
        draw(g, t, k) {
          stars(g, t, 1, k < 0.45 ? k * 2 : 1);
          if (k < 0.45) {
            const st = Math.round(k * 30);
            g.drawImage(enterprise(), 12 - st, 16, 40 + st * 2, 15); // stretching...
          } else if (k < 0.55) {
            P(g, '#ffffff', 0, 22, W, 2); // ...and gone, in a flash
            P(g, '#9ad0ff', 0, 20, W, 1);
            P(g, '#9ad0ff', 0, 25, W, 1);
          }
        },
      },
      {
        id: 'bridge',
        dur: 9,
        caption: 'On the bridge: "Engage."',
        react: 'heart',
        log: '{name} mouths "Engage" along with the captain.',
        cues: [[0, 'tng-hum'], [0.6, 'tng-beep'], [1.4, (s) => B.audio.play('tng-talk', 150, 6)], [3.4, (s) => B.audio.play('tng-talk', 105, 7)], [5.4, 'tng-chirp'], [6.4, (s) => B.audio.play('tng-talk', 112, 3)], [7, 'tng-warp']],
        draw(g, t, k) {
          const warp = k > 0.78;
          bridge(g, t, { stand: Math.min(1, Math.max(0, (k - 0.45) * 6)), point: k > 0.6, viewer: (gg) => stars(gg, t, warp ? 3 : 0.5, warp ? Math.min(1, (k - 0.78) * 6) : 0) });
          if (k > 0.66 && k < 0.92) sub(g, 'ENGAGE.');
        },
      },
      {
        id: 'ready-room',
        dur: 6,
        caption: 'The ready room: tea, Earl Grey, hot',
        react: 'happy',
        log: '{name} raises her own mug at the telly.',
        cues: [[0, 'tng-door'], [1, (s) => B.audio.play('tng-talk', 108, 5)], [2.2, 'tng-replicator']],
        draw(g, t, k) {
          P(g, '#4e443c', 0, 0, W, H);
          P(g, '#3a322c', 0, 36, W, 12);
          // the window onto the stars
          P(g, '#02030a', 4, 4, 30, 16);
          for (const s of STARS.slice(0, 14)) P(g, '#c8d4ff', 4 + (Math.floor(s.x - t * 2 + 300) % 30), 4 + (s.y % 16), 1, 1);
          P(g, '#2a2420', 3, 3, 32, 1);
          P(g, '#2a2420', 3, 20, 32, 1);
          // a lionfish tank, and the replicator alcove
          P(g, '#1a3a5a', 6, 26, 14, 9);
          P(g, '#ff8a3a', 10 + Math.round(Math.sin(t) * 3), 30, 3, 2);
          P(g, '#1a1612', 44, 10, 14, 22);
          P(g, '#2a3040', 45, 11, 12, 20);
          if (k > 0.35) {
            // the cup shimmering into being
            const m = Math.min(1, (k - 0.35) * 3);
            for (let i = 0; i < 12; i++) if (Math.random() < 1 - m * 0.7) P(g, '#cfe8ff', 48 + Math.floor(Math.random() * 6), 20 + Math.floor(Math.random() * 7), 1, 1);
            g.globalAlpha = m;
            P(g, '#e8e4dc', 49, 24, 4, 4);
            P(g, '#e8e4dc', 53, 25, 1, 2);
            P(g, '#6a3a1a', 49, 24, 4, 1);
            g.globalAlpha = 1;
          }
          // the captain, side on, at the replicator
          P(g, '#a82a2a', 34, 21, 7, 11);
          P(g, '#1a1a1a', 34, 21, 7, 3);
          P(g, '#2a2a30', 35, 32, 5, 10);
          P(g, '#e0b090', 35, 15, 5, 6);
          P(g, '#f0c8a0', 35, 15, 3, 1);
          P(g, '#3a2418', 39, 17, 1, 1);
          if (k > 0.2 && k < 0.85) sub(g, ['TEA. EARL GREY.', 'HOT.']);
        },
      },
      {
        id: 'red-alert',
        dur: 7,
        caption: 'Red alert! A warbird decloaks',
        react: 'bang',
        log: 'Red alert on the telly. {name} grips the arms of her chair.',
        cues: [[0, 'tng-klaxon'], [1.2, 'tng-klaxon'], [2.4, 'tng-klaxon'], [3.6, 'tng-klaxon'], [1.8, (s) => B.audio.play('tng-talk', 140, 4)], [4.6, (s) => B.audio.play('tng-talk', 100, 5)]],
        draw(g, t, k) {
          bridge(g, t, {
            red: true,
            stand: 1,
            viewer: (gg) => {
              stars(gg, t, 0.3);
              const c = Math.min(1, k * 1.6); // it shimmers out of its cloak
              gg.globalAlpha = c;
              gg.drawImage(warbird(), 21 - Math.round(k * 4), 18, 22 + Math.round(k * 8), 12 + Math.round(k * 4));
              gg.globalAlpha = 1;
            },
          });
          if (k < 0.4) sub(g, 'RED ALERT!', '#ff8a8a');
          else if (k > 0.55 && k < 0.9) sub(g, 'SHIELDS UP!', '#ff8a8a');
        },
      },
      {
        id: 'battle',
        dur: 8,
        caption: 'Phasers and photon torpedoes',
        react: 'spark',
        log: '{name} cheers at the television. Direct hit!',
        cues: [[1.1, 'tng-phaser'], [2.9, 'tng-disruptor'], [3.3, 'tng-disruptor'], [4.4, 'tng-torpedo'], [4.8, 'tng-torpedo'], [5.8, 'tng-boom']],
        draw(g, t, k) {
          stars(g, t, 0.3);
          const ex = 4;
          const ey = 22;
          g.drawImage(enterprise(), ex, ey, 30, 11);
          const bx = 46;
          const by = 14;
          const dead = k > 0.72;
          if (!dead) g.drawImage(warbird(), bx, by, 16, 9);
          // phasers: an orange beam from the saucer's array
          if (k > 0.14 && k < 0.3) {
            B.line(g, ex + 22, ey + 4, bx + 6, by + 4, '#ffb03a');
            P(g, '#fff0c0', bx + 5, by + 3, 3, 3);
          }
          // the warbird's disruptors splash against the shields
          if (k > 0.36 && k < 0.47) {
            B.line(g, bx + 1, by + 5, ex + 26, ey + 3, '#7aff6a');
            g.globalAlpha = 0.5;
            g.strokeStyle = '#7ac8ff';
            g.beginPath();
            g.ellipse(ex + 15, ey + 5, 18, 8, 0, 0, Math.PI * 2);
            g.stroke();
            g.globalAlpha = 1;
          }
          // photon torpedoes
          for (const t0 of [0.55, 0.6]) {
            if (k > t0 && k < t0 + 0.13) {
              const q = (k - t0) / 0.13;
              const x = Math.round(ex + 26 + q * (bx - ex - 22));
              const y = Math.round(ey + 4 + q * (by - ey));
              P(g, '#ff5a2a', x, y, 2, 2);
              P(g, '#ffd0a0', x, y, 1, 1);
            }
          }
          if (k > 0.72) {
            // boom: a bright core and expanding rings
            const q = (k - 0.72) / 0.28;
            const r = 2 + q * 16;
            g.globalAlpha = 1 - q;
            g.fillStyle = '#ffe0a0';
            g.beginPath();
            g.arc(bx + 8, by + 4, r * 0.6, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#ff7a3a';
            g.beginPath();
            g.arc(bx + 8, by + 4, r, 0, Math.PI * 2);
            g.stroke();
            g.globalAlpha = 1;
            for (let i = 0; i < 6; i++) P(g, '#6a9a4a', Math.round(bx + 8 + Math.cos(i) * r * 1.2), Math.round(by + 4 + Math.sin(i * 1.7) * r * 0.8), 1, 1);
          }
        },
      },
      {
        id: 'transporter',
        dur: 6,
        caption: 'Energising: the away team beams in',
        react: 'spark',
        cues: [[0.2, 'tng-transport'], [4.4, 'tng-chirp']],
        draw(g, t, k) {
          P(g, '#2e3642', 0, 0, W, H);
          for (let x = 4; x < W; x += 10) P(g, '#5a6a80', x, 2, 4, 30); // light panels
          P(g, '#1e242c', 0, 36, W, 12);
          // the raised pad and its three circles
          P(g, '#6a7383', 8, 34, 48, 4);
          for (const cx of [16, 32, 48]) {
            P(g, '#c8e0ff', cx - 4, 34, 8, 1);
            P(g, '#8a93a3', cx - 5, 35, 10, 1);
          }
          const team = [[16, '#a82a2a', '#d8a888'], [32, '#c9a43a', '#7a4a2a'], [48, '#3a6aa8', '#e0b090']];
          const m = Math.min(1, k * 1.5);
          for (const [cx, uni, skin] of team) {
            if (m < 1) for (let i = 0; i < 16; i++) P(g, Math.random() < 0.5 ? '#ffffff' : '#9ad0ff', cx - 3 + Math.floor(Math.random() * 6), 8 + Math.floor(Math.random() * 26), 1, 1);
            g.globalAlpha = m;
            P(g, skin, cx - 2, 10, 4, 4);
            P(g, uni, cx - 3, 14, 6, 10);
            P(g, '#1a1a1a', cx - 3, 14, 6, 2);
            P(g, '#2a2a30', cx - 3, 24, 6, 10);
            g.globalAlpha = 1;
          }
        },
      },
      {
        id: 'holodeck',
        dur: 7,
        caption: 'The holodeck: a grid becomes a summer meadow',
        react: 'happy',
        cues: [[0, 'tng-door'], [0.6, 'tng-beep'], [3.6, 'tng-birds'], [5, 'tng-birds']],
        draw(g, t, k) {
          // yellow grid on black...
          P(g, '#050505', 0, 0, W, H);
          for (let i = 0; i < 9; i++) {
            const y = Math.round(24 + Math.pow(i / 8, 1.8) * 24);
            P(g, '#d8b020', 0, y, W, 1);
          }
          for (let i = -6; i <= 6; i++) B.line(g, 32 + i * 3, 24, 32 + i * 14, H, '#d8b020');
          for (let y = 2; y < 24; y += 5) P(g, '#7a6410', 0, y, W, 1);
          for (let x = 2; x < W; x += 6) P(g, '#7a6410', x, 0, 1, 24);
          // ...dissolving into a meadow
          if (k > 0.4) {
            g.globalAlpha = Math.min(1, (k - 0.4) * 3);
            P(g, '#8ac8f0', 0, 0, W, 26);
            P(g, '#fff4c0', 50, 5, 5, 5);
            P(g, '#5aa84a', 0, 26, W, 22);
            for (let x = 0; x < W; x += 3) P(g, '#7ac85a', x, 26 + ((x * 7) % 5), 2, 1);
            for (const tx of [8, 22, 56]) {
              P(g, '#5a3a20', tx, 16, 2, 10);
              P(g, '#3a7a3a', tx - 4, 8, 10, 9);
              P(g, '#4a9a4a', tx - 3, 8, 6, 3);
            }
            for (let i = 0; i < 6; i++) P(g, ['#ffd23f', '#ff8ab0', '#ffffff'][i % 3], 4 + i * 10, 38 + (i % 3) * 3, 1, 1);
            g.globalAlpha = 1;
          }
          // the arch stays, a hint it's not real
          P(g, '#3a3020', 28, 12, 8, 16);
          P(g, '#d8b020', 28, 12, 8, 1);
          P(g, '#050505', 29, 13, 6, 15);
        },
      },
      {
        id: 'credits',
        dur: 7,
        caption: 'Warping away into the end credits',
        react: 'sigh',
        cues: [[0, 'tng-fanfare'], [4.2, 'tng-warp']],
        draw(g, t, k) {
          stars(g, t, 0.5);
          if (k < 0.62) {
            const sc = 1 - k;
            g.drawImage(enterprise(), Math.round(14 + k * 20), Math.round(18 + k * 4), Math.round(40 * sc), Math.round(15 * sc));
          } else if (k < 0.7) P(g, '#ffffff', 20, 22, 30, 1);
          // credits scrolling up (just the shapes of names at this size)
          for (let i = 0; i < 8; i++) {
            const y = Math.round(H + 2 - k * 70 + i * 9);
            if (y < -2 || y > H) continue;
            P(g, '#c8d4ff', 6, y, 8 + ((i * 5) % 9), 1);
            P(g, '#ffffff', 20, y, 14 + ((i * 7) % 12), 1);
          }
        },
      },
    ],
  });
})(window.Bookshop);
