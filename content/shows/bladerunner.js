/* Blade Runner, on Mabel's telly: a 64x48 pixel homage to the film's Los Angeles, 2019.
 * The flaming towers, an eye full of fire, the pyramid, the giant advert and the off-world blimp, a noodle bar in
 * the rain, the empathy test, a spinner chase, the rooftop in the rain with the dove, and the paper unicorn.
 * The score is an original slow, brassy synth piece in the spirit of the film (not its actual music). */
(function (B) {
  const P = B.px;
  const W = 64;
  const H = 48;
  const rnd = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1; // steady per-index noise
  const frac = (n) => Math.abs(rnd(n));

  function rain(g, t, n = 40, col = 'rgba(170,190,220,0.5)', len = 3) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(frac(i) * W + t * 6) % W;
      const y = Math.floor(frac(i + 50) * H + t * (60 + (i % 5) * 8)) % H;
      P(g, col, x, y, 1, len);
    }
  }
  // the city: rows of dark towers with tiny lit windows
  function towers(g, seed, baseY, colA = '#0c0a14', colB = '#120e1c', lit = ['#ffb04a', '#ff6a3a', '#9ad0ff']) {
    for (let x = 0, i = 0; x < W; i++) {
      const w = 5 + Math.floor(frac(seed + i) * 8);
      const h = 10 + Math.floor(frac(seed + i * 3) * (baseY - 6));
      P(g, i % 2 ? colA : colB, x, baseY - h, w, h + (H - baseY));
      for (let y = baseY - h + 2; y < H; y += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (frac(seed + xx * 7 + y * 13) > 0.72) P(g, lit[Math.floor(frac(xx + y) * lit.length)], xx, y, 1, 1);
      x += w;
    }
  }
  function spinner(g, x, y, dir = 1, t = 0) {
    P(g, '#2a2a34', x - 4, y, 9, 2);
    P(g, '#4a4a58', x - 3, y - 1, 6, 1);
    P(g, '#9ad0ff', x + (dir > 0 ? 3 : -4), y - 1, 2, 1);
    P(g, Math.floor(t * 4) % 2 ? '#ff2a2a' : '#2a6aff', x, y - 2, 1, 1); // the police light
    P(g, '#ffe9a8', x + (dir > 0 ? 5 : -5), y + 1, 1, 1);
  }
  function sub(g, lines, col = '#ffd8a0') {
    const ls = Array.isArray(lines) ? lines : [lines];
    ls.forEach((l, i) => {
      const y = H - 6 - (ls.length - 1 - i) * 6;
      const x = Math.round(W / 2 - B.textWidth(l) / 2);
      P(g, 'rgba(0,0,0,0.65)', x - 1, y - 1, B.textWidth(l) + 1, 7);
      B.text(g, l, x, y, col);
    });
  }
  const fire = (g, x, y, k, t) => {
    // a gas flare bursting from a refinery tower
    const h = Math.round(4 + k * 10 + Math.sin(t * 9 + x) * 2);
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, Math.round(3 - i / 4 + Math.sin(t * 20 + i) * 0.8));
      P(g, i < h / 3 ? '#fff0a0' : i < (2 * h) / 3 ? '#ffa030' : '#c83a1a', x - Math.floor(w / 2), y - i, w, 1);
    }
  };

  // ---------- sounds ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function setup() {
    const A = B.audio;
    // brassy analogue-synth chords swelling slowly, with a lonely lead line and bell-like sparkles
    A.define('br-score', ({ tone, tv }) => {
      const pad = (ms, at, len) =>
        ms.forEach((m) => {
          tone(mtof(m), len, { bus: tv, at, type: 'sawtooth', vol: 0.022, a: 1.4, lp: 1300 });
          tone(mtof(m) * 1.006, len, { bus: tv, at, type: 'sawtooth', vol: 0.016, a: 1.6, lp: 1000 });
        });
      pad([45, 52, 57, 60], 0, 4.2); // A minor
      pad([41, 48, 53, 57], 3.8, 4.2); // F
      pad([43, 50, 55, 59], 7.6, 4.2); // G
      pad([40, 47, 52, 55, 59], 11.4, 5); // E minor, left hanging
      [[76, 1.2, 2.4], [74, 3.8, 1.2], [72, 5.0, 2.6], [71, 7.8, 1.2], [72, 9.0, 1.2], [69, 10.2, 5]].forEach(([m, at, len]) =>
        tone(mtof(m), len, { bus: tv, at, type: 'triangle', vol: 0.035, a: 0.25 })
      );
      for (let i = 0; i < 8; i++) tone(mtof(84 + [0, 3, 7, 10][i % 4]), 1.2, { bus: tv, at: 0.5 + i * 1.9, type: 'sine', vol: 0.012, a: 0.005 });
    });
    A.define('br-drone', ({ tone, noise, tv }) => {
      tone(mtof(33), 7, { bus: tv, type: 'sawtooth', vol: 0.03, a: 1.5, lp: 300 });
      noise(7, { bus: tv, ftype: 'lowpass', freq: 200, vol: 0.025, a: 1, r: 1.5 });
    });
    A.define('br-flare', ({ noise, tone, tv }) => {
      noise(1.2, { bus: tv, ftype: 'lowpass', freq: 600, fto: 150, vol: 0.06, a: 0.05, r: 0.8 });
      tone(45, 1, { bus: tv, vol: 0.05, slide: 32 });
    });
    A.define('br-rain', ({ noise, tv }, dur = 7) => {
      noise(dur, { bus: tv, ftype: 'highpass', freq: 2500, vol: 0.018, a: 0.6, r: 0.8 });
      noise(dur, { bus: tv, freq: 900, q: 0.5, vol: 0.012, a: 0.6, r: 0.8 });
    });
    A.define('br-spinner', ({ tone, noise, tv }) => {
      tone(110, 3, { bus: tv, type: 'sawtooth', vol: 0.025, lp: 600, slide: 140, a: 0.6 });
      noise(3, { bus: tv, freq: 400, fto: 1200, q: 1, vol: 0.02, a: 0.8, r: 1 });
    });
    A.define('br-siren', ({ tone, tv }) => {
      for (let i = 0; i < 3; i++) tone(980, 0.55, { bus: tv, at: i * 0.7, type: 'square', vol: 0.02, slide: 620, lp: 1800 });
    });
    A.define('br-announce', ({ tone, tv }) => {
      // the blimp's distant, echoing announcer
      for (let i = 0; i < 7; i++) {
        const f = 135 * (1 + (Math.random() - 0.5) * 0.2);
        for (const [d, v] of [[0, 0.03], [0.35, 0.012], [0.7, 0.006]]) tone(f, 0.22, { bus: tv, at: i * 0.32 + d, type: 'sawtooth', vol: v, lp: 900 });
      }
    });
    A.define('br-sizzle', ({ noise, tv }) => noise(5, { bus: tv, freq: 5000, q: 0.6, vol: 0.01, a: 0.3, r: 0.6 }));
    A.define('br-talk', ({ tone, tv }, f = 100, n = 5) => {
      for (let i = 0; i < n; i++) {
        const base = f * (1 + (Math.random() - 0.5) * 0.2);
        tone(base, 0.15, { bus: tv, at: i * 0.19, type: 'sawtooth', vol: 0.03, lp: 1000, slide: base * 0.92 });
      }
    });
    A.define('br-vk', ({ tone, noise, tv }) => {
      for (let i = 0; i < 6; i++) tone(i % 2 ? 1320 : 990, 0.06, { bus: tv, at: i * 0.5, type: 'sine', vol: 0.03 });
      noise(2.5, { bus: tv, freq: 500, fto: 300, q: 0.6, vol: 0.02, a: 0.8, r: 1 }); // the machine's bellows
    });
    A.define('br-dove', ({ noise, tv }) => {
      for (let i = 0; i < 6; i++) noise(0.05, { bus: tv, at: i * 0.09, freq: 1500, q: 0.8, vol: 0.03 });
    });
    A.define('br-lift', ({ noise, tone, tv }) => {
      noise(0.5, { bus: tv, freq: 1800, fto: 300, q: 0.8, vol: 0.04 });
      tone(70, 0.3, { bus: tv, at: 0.45, vol: 0.08, slide: 45 });
    });
  }

  // ---------- the film ----------
  B.show({
    id: 'bladerunner',
    name: 'Blade Runner',
    short: 'BLADE RUNNER',
    genre: 'Film noir',
    color: '#ff7a2a',
    likes: 0.6, // she thinks it's too gloomy, and watches it every time
    setup,
    scenes: [
      {
        id: 'hades',
        dur: 7,
        caption: 'Los Angeles, 2019: flames over the industrial sprawl',
        react: 'what',
        log: '{name} stares at the burning skyline on the telly.',
        cues: [[0, 'br-drone'], [0.3, 'br-score'], [1.5, 'br-flare'], [4.2, 'br-flare'], [5, 'br-spinner']],
        draw(g, t, k) {
          // a sooty orange sky over endless lights
          for (let y = 0; y < 20; y++) P(g, B.mix('#05030a', '#3a1a12', y / 20), 0, y, W, 1);
          P(g, '#08060c', 0, 20, W, H - 20);
          for (let i = 0; i < 260; i++) {
            const y = 21 + Math.floor(Math.pow(frac(i), 1.6) * 27);
            P(g, ['#ffb04a', '#ff7a2a', '#ffe0a0', '#9ad0ff'][i % 4], Math.floor(frac(i + 9) * W), y, 1, 1);
          }
          // the refinery stacks and their flares
          for (const [x, ph] of [[14, 0], [40, 0.4], [55, 0.75]]) {
            P(g, '#120c10', x - 1, 14, 3, 8);
            const burst = (k * 3 + ph) % 1;
            if (burst < 0.45) {
              fire(g, x, 13, burst * 2, t);
              g.globalCompositeOperation = 'lighter';
              const gr = g.createRadialGradient(x, 10, 1, x, 10, 14);
              gr.addColorStop(0, 'rgba(255,140,40,0.35)');
              gr.addColorStop(1, 'rgba(255,140,40,0)');
              g.fillStyle = gr;
              g.fillRect(x - 14, 0, 28, 24);
              g.globalCompositeOperation = 'source-over';
            }
          }
          spinner(g, Math.round(-10 + k * 84), Math.round(16 - k * 8), 1, t);
        },
      },
      {
        id: 'eye',
        dur: 4,
        caption: 'An eye, reflecting the fires',
        cues: [[0.4, 'br-flare']],
        draw(g, t, k) {
          P(g, '#c89070', 0, 0, W, H);
          for (let y = 0; y < H; y += 2) P(g, '#b8805e', 0, y, W, 1);
          // the eye: white, iris, pupil and a burning reflection
          g.fillStyle = '#e8e0d8';
          g.beginPath();
          g.ellipse(32, 24, 26, 12, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#3a6a7a';
          g.beginPath();
          g.arc(32, 24, 11, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#1e3a46';
          g.beginPath();
          g.arc(32, 24, 7, 0, Math.PI * 2);
          g.fill();
          P(g, '#050505', 29, 21, 6, 6);
          const f = 0.5 + 0.5 * Math.sin(t * 7);
          P(g, '#ffb04a', 30, 22, 2, 2);
          P(g, f > 0.5 ? '#fff0a0' : '#ff7a2a', 33, 23, 1, 2);
          for (let i = 0; i < 10; i++) P(g, '#ffa030', 24 + Math.floor(frac(i + Math.floor(t * 6)) * 16), 26 + (i % 3), 1, 1);
          P(g, '#ffffff', 26, 18, 2, 1);
          // lids closing in at the end
          const lid = Math.max(0, (k - 0.8) * 5) * 12;
          P(g, '#a86a4a', 0, 0, W, 12 + lid);
          P(g, '#a86a4a', 0, 36 - lid, W, 12 + lid);
        },
      },
      {
        id: 'pyramid',
        dur: 6,
        caption: 'The corporation’s great pyramid',
        react: 'spark',
        cues: [[0, 'br-spinner']],
        draw(g, t, k) {
          for (let y = 0; y < H; y++) P(g, B.mix('#120a18', '#2a1a20', y / H), 0, y, W, 1);
          // two vast stepped pyramids, lit from within
          for (const [cx, base, half, sh] of [[22, 46, 22, 0.8], [50, 46, 15, 0.6]]) {
            for (let y = 0; y < half * 1.2; y++) {
              const w = Math.round(((y + 1) / (half * 1.2)) * half);
              P(g, B.shade('#2a2430', sh), cx - w, base - Math.round(half * 1.2) + y, w * 2, 1);
              if (y % 3 === 0) for (let x = cx - w + 1; x < cx + w - 1; x += 2) if (frac(x * 3 + y) > 0.55) P(g, '#ffd08a', x, base - Math.round(half * 1.2) + y, 1, 1);
            }
          }
          // searchlights sweeping up from the summit
          g.globalAlpha = 0.18;
          for (const ph of [0, 2]) B.line(g, 22, 20, 22 + Math.sin(t * 0.8 + ph) * 30, 0, '#fff4d0');
          g.globalAlpha = 1;
          spinner(g, Math.round(70 - k * 46), Math.round(10 + k * 8), -1, t);
        },
      },
      {
        id: 'billboard',
        dur: 7,
        caption: 'Rain, a giant video advert and the off-world blimp',
        cues: [[0, (s) => B.audio.play('br-rain', 7)], [1.2, 'br-announce']],
        draw(g, t, k) {
          P(g, '#06050c', 0, 0, W, H);
          towers(g, 5, 30);
          // a building-sized advert: a woman in white make-up and red lipstick, swallowing a pill
          P(g, '#0a0a10', 6, 6, 22, 30);
          const flick = Math.floor(t * 7) % 9 ? 1 : 0.6;
          g.globalAlpha = flick;
          P(g, '#3a1a30', 7, 7, 20, 28);
          P(g, '#0a0608', 10, 8, 14, 8); // hair
          P(g, '#f0e4e0', 12, 13, 10, 12); // face
          P(g, '#0a0608', 10, 12, 3, 10);
          P(g, '#2a1a1a', 14, 17, 2, 1); // eyes
          P(g, '#2a1a1a', 19, 17, 2, 1);
          P(g, '#c8102e', 16, 21, 3, 1); // lips
          P(g, '#c8102e', 15, 22, 5, 1);
          if (k > 0.4 && k < 0.6) P(g, '#ffffff', 17, 21, 1, 1); // the pill
          P(g, '#b04a8a', 7, 30, 20, 4);
          P(g, '#ff9ad0', 9, 31, 2, 2);
          g.globalAlpha = 1;
          // the advertising blimp drifting over, its searchlight raking the street
          const bx = Math.round(70 - k * 60);
          P(g, '#1a1a24', bx - 10, 3, 22, 6);
          P(g, '#2a2a34', bx - 8, 2, 18, 1);
          for (let i = 0; i < 10; i++) P(g, ['#ff3a3a', '#ffd23f', '#3ad0ff'][(i + Math.floor(t * 4)) % 3], bx - 9 + i * 2, 6, 1, 1);
          g.globalAlpha = 0.14;
          g.fillStyle = '#fff4d0';
          g.beginPath();
          g.moveTo(bx, 9);
          g.lineTo(bx - 10 + Math.sin(t) * 6, H);
          g.lineTo(bx + 4 + Math.sin(t) * 6, H);
          g.fill();
          g.globalAlpha = 1;
          rain(g, t, 50);
          if (k > 0.25 && k < 0.75) sub(g, ['A NEW LIFE', 'AWAITS YOU'], '#ffe08a');
        },
      },
      {
        id: 'noodle-bar',
        dur: 7,
        caption: 'A noodle bar in the rain',
        react: 'happy',
        log: '{name} fancies noodles now.',
        cues: [[0, (s) => B.audio.play('br-rain', 7)], [0.2, 'br-sizzle'], [1.5, (s) => B.audio.play('br-talk', 150, 6)], [4, (s) => B.audio.play('br-talk', 95, 3)]],
        draw(g, t, k) {
          P(g, '#08060e', 0, 0, W, H);
          // neon over the stall
          P(g, '#1a0a14', 4, 4, 56, 10);
          const on = Math.floor(t * 3) % 7 ? 1 : 0;
          if (on) {
            P(g, '#ff3a8a', 8, 7, 14, 2);
            P(g, '#3ad0ff', 26, 6, 2, 5);
            P(g, '#3ad0ff', 30, 6, 2, 5);
            P(g, '#ffd23f', 36, 7, 18, 2);
          }
          P(g, '#2a1a1a', 4, 14, 56, 2);
          // the counter, steam rising from the pots, the cook behind
          P(g, '#3a2a1a', 0, 30, W, 4);
          P(g, '#5a4028', 0, 30, W, 1);
          P(g, '#1a120c', 0, 34, W, 14);
          P(g, '#d8d0c0', 40, 18, 5, 6); // cook's white top
          P(g, '#c89a6a', 41, 15, 3, 3);
          P(g, '#e8e4dc', 41, 13, 3, 2); // cap
          for (let i = 0; i < 8; i++) {
            const q = (t * 0.6 + i / 8) % 1;
            g.globalAlpha = (1 - q) * 0.5;
            P(g, '#e8e4ec', 46 + Math.round(Math.sin(q * 6 + i) * 2), Math.round(28 - q * 14), 2, 2);
          }
          g.globalAlpha = 1;
          P(g, '#6a6a72', 45, 26, 6, 4);
          // the blade runner on his stool, trench coat and newspaper
          P(g, '#4a3a2a', 14, 18, 9, 13);
          P(g, '#3a2a1a', 14, 18, 2, 13);
          P(g, '#d8a888', 16, 12, 5, 6);
          P(g, '#3a2418', 16, 11, 5, 2);
          P(g, '#2a2a2a', 13, 31, 2, 10);
          P(g, '#2a2a2a', 21, 31, 2, 10);
          if (k < 0.3) P(g, '#c8c0a8', 22, 20, 7, 6); // the newspaper
          if (k > 0.55) P(g, '#e8e4dc', 24, 28, 4, 2); // a bowl
          rain(g, t, 26, 'rgba(170,190,220,0.4)');
          if (k > 0.2 && k < 0.5) sub(g, 'FOUR.');
          else if (k > 0.5 && k < 0.8) sub(g, 'TWO, TWO, FOUR.');
        },
      },
      {
        id: 'empathy-test',
        dur: 6,
        caption: 'The empathy test: watching an iris for a flicker',
        react: 'dots',
        cues: [[0, 'br-vk'], [1.8, (s) => B.audio.play('br-talk', 105, 6)], [4.2, (s) => B.audio.play('br-talk', 130, 4)]],
        draw(g, t, k) {
          // a smoky office, blinds slicing the light
          P(g, '#120e10', 0, 0, W, H);
          for (let y = 2; y < 30; y += 3) P(g, 'rgba(255,220,160,0.12)', 30, y, 34, 1);
          // the machine: bellows breathing, a screen full of eye
          P(g, '#2a2620', 6, 22, 22, 14);
          const breathe = Math.round(Math.sin(t * 2.4) * 2);
          P(g, '#4a4036', 10, 17 - breathe, 6, 5 + breathe);
          for (let y = 17 - breathe; y < 22; y += 2) P(g, '#3a3028', 10, y, 6, 1);
          P(g, '#0a1414', 18, 24, 9, 7);
          P(g, '#3a8a8a', 20, 26, 5, 3);
          P(g, '#050505', 22, 27, 1, 1);
          if (Math.floor(t * 2) % 2) P(g, '#ff3a2a', 7, 34, 1, 1);
          // the subject in profile across the table, sweating
          P(g, '#3a3a40', 40, 22, 10, 14);
          P(g, '#c89a7a', 42, 14, 6, 8);
          P(g, '#2a1a10', 42, 13, 6, 3);
          P(g, '#1a1010', 42, 17, 1, 1);
          if (k > 0.5) P(g, '#9ad0ff', 43, 19, 1, 1);
          // smoke curling up through the light
          for (let i = 0; i < 6; i++) {
            const q = (t * 0.25 + i / 6) % 1;
            g.globalAlpha = (1 - q) * 0.25;
            P(g, '#d8d0c8', 30 + Math.round(Math.sin(q * 5 + i) * 4), Math.round(30 - q * 26), 3, 1);
          }
          g.globalAlpha = 1;
          if (k > 0.3 && k < 0.75) sub(g, ['REACTION TIME', 'IS A FACTOR.']);
        },
      },
      {
        id: 'chase',
        dur: 6,
        caption: 'Spinners through the canyons of the city',
        react: 'bang',
        cues: [[0, 'br-siren'], [0.5, 'br-spinner'], [3, 'br-spinner']],
        draw(g, t, k) {
          P(g, '#05040a', 0, 0, W, H);
          // towers rushing past on both sides
          for (let i = 0; i < 6; i++) {
            const x = Math.round(((i * 24 - t * 40) % 140) + 140) % 140 - 40;
            P(g, i % 2 ? '#14101c' : '#0c0a12', x, 0, 18, H);
            for (let y = 2; y < H; y += 4) for (let xx = 1; xx < 17; xx += 3) if (frac(i * 31 + y + xx) > 0.6) P(g, ['#ffb04a', '#3ad0ff', '#ff3a8a'][(xx + y) % 3], x + xx, y, 1, 1);
          }
          spinner(g, 34 + Math.round(Math.sin(t * 2) * 6), 24 + Math.round(Math.cos(t * 1.6) * 3), 1, t);
          spinner(g, 14 + Math.round(Math.sin(t * 2 + 1) * 4), 30, 1, t + 0.25);
          rain(g, t * 2, 40, 'rgba(170,190,220,0.4)', 4);
        },
      },
      {
        id: 'rooftop',
        dur: 9,
        caption: 'On the rooftop in the rain, a dove takes flight',
        react: 'rain',
        log: '{name} dabs her eyes at the end of the film. Every time.',
        cues: [[0, (s) => B.audio.play('br-rain', 9)], [0.4, 'br-score'], [5.8, 'br-dove']],
        draw(g, t, k) {
          for (let y = 0; y < H; y++) P(g, B.mix('#0a0c18', '#1a1c2a', y / H), 0, y, W, 1);
          towers(g, 21, 40, '#0a0a12', '#0e0e18', ['#ffb04a', '#9ad0ff']);
          P(g, '#1a1a22', 0, 38, W, 10); // the roof
          P(g, '#2a2a34', 0, 38, W, 1);
          // the replicant, kneeling, white hair plastered by the rain, holding the dove
          P(g, '#2a2a30', 24, 30, 10, 9);
          P(g, '#e0c8b8', 26, 24, 6, 6);
          P(g, '#f4f0e8', 26, 23, 6, 2);
          P(g, '#e0c8b8', 33, 31, 2, 2);
          const fly = Math.max(0, (k - 0.62) / 0.38);
          if (fly === 0) P(g, '#ffffff', 34, 29, 3, 2);
          else {
            const dx = 34 + Math.round(fly * 18);
            const dy = 29 - Math.round(fly * 26);
            const flap = Math.floor(t * 10) % 2;
            P(g, '#ffffff', dx, dy, 3, 1);
            P(g, '#ffffff', dx - 2 + flap, dy - 1 - flap, 2, 1);
            P(g, '#ffffff', dx + 3 - flap, dy - 1 - flap, 2, 1);
          }
          rain(g, t, 60, 'rgba(180,200,230,0.45)', 4);
          if (k > 0.3 && k < 0.62) sub(g, ['...LIKE TEARS', 'IN RAIN.'], '#d8e0f0');
        },
      },
      {
        id: 'unicorn',
        dur: 4,
        caption: 'A paper unicorn on the floor',
        react: 'what',
        cues: [[3.1, 'br-lift']],
        draw(g, t, k) {
          P(g, '#0c0a0c', 0, 0, W, H);
          P(g, '#1a1612', 0, 30, W, 18);
          // the foil origami unicorn catching the light
          const s = '#c8ccd4';
          const d = '#7a808a';
          P(g, s, 26, 30, 10, 3); // body
          P(g, d, 26, 32, 10, 1);
          P(g, s, 26, 33, 1, 4); // legs
          P(g, s, 30, 33, 1, 4);
          P(g, s, 34, 33, 1, 4);
          B.line(g, 35, 30, 38, 25, s); // neck
          P(g, s, 37, 24, 3, 2); // head
          B.line(g, 39, 24, 42, 19, '#ffffff'); // the horn
          P(g, '#ffffff', 28, 30, 3, 1);
          if (Math.floor(t * 3) % 3 === 0) P(g, '#ffffff', 41, 20, 1, 1);
          // the lift doors closing
          if (k > 0.75) {
            const c = Math.round(((k - 0.75) / 0.25) * 32);
            P(g, '#2a2a30', 0, 0, c, H);
            P(g, '#2a2a30', W - c, 0, c, H);
          }
        },
      },
      {
        id: 'credits',
        dur: 7,
        caption: 'The end credits',
        react: 'sigh',
        cues: [[0, 'br-score']],
        draw(g, t, k) {
          P(g, '#000000', 0, 0, W, H);
          B.text(g, 'BLADE', 32 - Math.floor(B.textWidth('BLADE') / 2), 12, k < 0.3 ? '#ff2a2a' : '#5a0a0a');
          B.text(g, 'RUNNER', 32 - Math.floor(B.textWidth('RUNNER') / 2), 19, k < 0.3 ? '#ff2a2a' : '#5a0a0a');
          for (let i = 0; i < 8; i++) {
            const y = Math.round(H + 2 - (k - 0.25) * 80 + i * 8);
            if (y < -2 || y > H || k < 0.25) continue;
            P(g, '#8a8a8a', 10, y, 10 + ((i * 5) % 9), 1);
            P(g, '#d8d8d8', 26, y, 16 + ((i * 7) % 12), 1);
          }
        },
      },
    ],
  });
})(window.Bookshop);
