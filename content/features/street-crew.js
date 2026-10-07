/* 2026-10-07 (the people who keep the street going)
 * - The glass gets grubby: dust and road spray build up on the shop window and door through the day (faster after
 *   rain), and on the flat's windows more slowly.
 * - Every morning a window cleaner comes by with a bucket and a squeegee on a pole and does the ground floor, one
 *   stroke at a time, leaving a wet sheen that dries.
 * - Most days a little cleaning drone does the flat's windows: it hums in, mists a pane, sweeps it with its rotary
 *   brush and moves on (it casts a small shadow in the sun).
 * - Now and then the street lamp develops a fault and flickers after dark; the next day a maintenance crew turns
 *   up with a cherry-picker: cones out, amber beacon turning, the boom goes up to the lamp head, the lamp is
 *   fixed. The lamp is dark while they work, and the beacon's light falls on the front.
 * Bookshop.crew holds the state; Bookshop.crew.call(kind) sends someone now ('cleaner' | 'drone' | 'lamp'). */
(function (B) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cyber = () => B.theme === 'cyber';
  const L = () => B.LAYOUT;
  const X0 = 8; // dirt bins along the ground-floor glass, 4 px each
  const NB = 64;
  const binOf = (x) => clamp(Math.floor((x - X0) / 4), 0, NB - 1);

  const crew = (B.crew = {
    dirt: new Float32Array(NB).fill(0.35),
    wet: new Float32Array(NB),
    dirtUp: [new Float32Array(11).fill(0.3), new Float32Array(11).fill(0.3)],
    wetUp: [new Float32Array(11), new Float32Array(11)],
    lastHour: null,
    plan: null,
    lampFault: false,
    lampOff: false,
    picker: null,
    drone: null,
  });

  /** The lamp is dark: under repair, or blinking with its fault. */
  B.lampOut = (s) => {
    if (crew.lampOff) return true;
    if (!crew.lampFault) return false;
    const t = performance.now() / 1000;
    return Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1) > 0.35 || Math.floor(t / 5) % 4 === 0;
  };
  // wrap both themes' lamps so a dark lamp draws dark (and casts nothing)
  function wrapLamp(owner, key) {
    const fn = owner && owner[key];
    if (!fn || fn._crew) return;
    const w = function (g, day, fog, s) {
      if (s && B.lampOut(s)) return fn.call(this, g, 1, 0, null);
      return fn.call(this, g, day, fog, s);
    };
    w._crew = true;
    owner[key] = w;
  }

  // ---------- the day's plan ----------
  function newDay(s) {
    crew.plan = {
      cleaner: B.rnd(8.4, 10.6),
      drone: B.chance(0.8) ? B.rnd(11, 15.5) : null,
      lamp: crew.lampFault ? B.rnd(10, 14.5) : null,
      done: {},
    };
    if (!crew.lampFault && B.chance(0.3)) crew.lampFault = true; // it will flicker tonight; fixed tomorrow
  }
  crew.call = (kind) => {
    const s = B.world;
    if (!crew.plan) newDay(s);
    if (kind === 'cleaner') startCleaner(s);
    if (kind === 'drone') startDrone(s);
    if (kind === 'lamp') {
      crew.lampFault = true;
      startPicker(s);
    }
  };

  B.on('tick', (s) => {
    const K = B.renderKit;
    if (K && K.PARTS) wrapLamp(K.PARTS, 'drawStreetLamp');
    if (B.themes && B.themes.cyber) wrapLamp(B.themes.cyber, 'drawStreetLamp');
    const h = s.hour;
    if (crew.lastHour == null || h < crew.lastHour - 12 || !crew.plan) newDay(s);
    const dh = crew.lastHour == null ? 0 : clamp(h - crew.lastHour, 0, 0.5);
    crew.lastHour = h;
    // grime builds: dust, and spray thrown up off a wet road (heaviest low down)
    const rain = (s.weather && s.weather.rain) || 0;
    for (let i = 0; i < NB; i++) crew.dirt[i] = Math.min(1, crew.dirt[i] + dh * (0.02 + 0.06 * rain));
    for (const d of crew.dirtUp) for (let i = 0; i < d.length; i++) d[i] = Math.min(1, d[i] + dh * (0.008 + 0.02 * rain));
    const p = crew.plan;
    if (!p.done.cleaner && h >= p.cleaner && h < p.cleaner + 1.5 && rain < 0.5) {
      p.done.cleaner = true;
      startCleaner(s);
    }
    if (p.drone != null && !p.done.drone && h >= p.drone && h < p.drone + 1.5 && rain < 0.3) {
      p.done.drone = true;
      startDrone(s);
    }
    if (p.lamp != null && !p.done.lamp && h >= p.lamp && h < p.lamp + 2 && rain < 0.6) {
      p.done.lamp = true;
      startPicker(s);
    }
  });

  // ---------- the window cleaner ----------
  B.look('window-cleaner', {
    skin: '#d9a47e',
    hair: '#6a4a2a',
    hairStyle: 'short',
    top: '#2a3a5a',
    top2: '#e8f040', // a hi-vis tabard over the navy
    bottom: '#2a2e3a',
    hat: '#2a3a5a',
    hatStyle: 'cap',
    shoes: '#1a1a1a',
  });
  B.visitor({
    id: 'window-cleaner',
    weight: 0,
    look: 'window-cleaner',
    setup(n) {
      n.speed = 34;
      n.lane = -3; // close in to the glass
      n.cleaner = { state: 'walk', gx: 0, gy: 0, bucket: null, t: 0 };
    },
    *run(s, n) {
      const W = L().win;
      const D = L().doorGlass;
      const c = n.cleaner;
      // the stretches of glass, left to right: the window in four reaches, then the door
      const reaches = [[W.x + 2, W.x + 50], [W.x + 50, W.x + 100], [W.x + 100, W.x + 150], [W.x + 150, W.x + W.w - 2], [D.x + 1, D.x + D.w - 1]];
      yield n.walkTo(W.x + 26);
      c.bucket = n.x - 8;
      B.log(B.pick(['The window cleaner is here, bucket and pole.', 'The window cleaner sets down his bucket and gets to work.', 'Squeak, squeak: the window cleaner is doing the front.']));
      for (const [a, b] of reaches) {
        yield n.walkTo(Math.round((a + b) / 2));
        c.bucket = n.x - 10;
        n.pose = 'backstand';
        c.state = 'scrub';
        const top = a >= D.x ? D.y + 2 : W.y + 22; // (not the lettered transom)
        const bot = a >= D.x ? D.y + D.h - 3 : W.y + W.h - 3;
        // suds on with the scrubber, then the squeegee down in overlapping strokes
        for (let t = 0; t < 2.4; t += 0.2) {
          c.gx = a + ((Math.sin(t * 5) + 1) / 2) * (b - a);
          c.gy = top + ((Math.cos(t * 3.3) + 1) / 2) * (bot - top);
          yield 0.2;
        }
        c.state = 'squeegee';
        for (let x = a; x < b; x += 6) {
          for (let y = top; y <= bot; y += 4) {
            c.gx = x;
            c.gy = y;
            for (let i = binOf(x); i <= binOf(x + 6); i++) {
              crew.dirt[i] = 0;
              crew.wet[i] = 1;
            }
            yield 0.05;
          }
          if (B.chance(0.25)) B.audio.play('squeak', x);
        }
        c.state = 'walk';
        n.pose = 'stand';
      }
      if (s.shop.open && s.owner.area === 'inside' && B.chance(0.6)) {
        n.emote('happy', 1.2);
        B.log(`${B.ownerName()} waves her thanks through the gleaming glass.`);
      }
      c.bucket = null;
      yield n.walkOff();
    },
  });
  B.audio.define('squeak', ({ tone, street }, x = 160) =>
    tone(1500 + Math.random() * 500, 0.07, { type: 'triangle', vol: 0.008, slide: 2100, pan: clamp(x / 160 - 1, -0.9, 0.9), bus: street }),
  );
  function startCleaner(s) {
    if (s.npcs.some((n) => n.kind === 'window-cleaner')) return;
    B.spawn(s, 'window-cleaner', { fromLeft: true });
  }

  // ---------- the cleaning drone ----------
  B.audio.define('drone-hum', ({ tone, street }, x = 160) => {
    const pan = clamp(x / 160 - 1, -0.9, 0.9);
    tone(180, 0.5, { type: 'sawtooth', vol: 0.004, lp: 900, pan, bus: street });
    tone(362, 0.5, { type: 'square', vol: 0.0015, lp: 1400, pan, bus: street });
  });
  function startDrone(s) {
    if (crew.drone) return;
    crew.drone = { x: 345, y: 6, state: 'in', pane: 0, t: 0, hum: 0, passes: 0, bx: 0 };
  }
  function stepDrone(s, dt) {
    const d = crew.drone;
    if (!d) return;
    d.t += dt;
    d.hum -= dt;
    if (d.hum <= 0) {
      d.hum = 0.45;
      B.audio.play('drone-hum', d.x);
    }
    const U = L().upstairs;
    const u = U[d.pane];
    const fly = (tx, ty, sp) => {
      const dx = tx - d.x;
      const dy = ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.8) return true;
      const v = Math.min(dist, sp * dt);
      d.x += (dx / dist) * v;
      d.y += (dy / dist) * v;
      return false;
    };
    if (d.state === 'in') {
      if (fly(u.x + u.w + 6, u.y + 6, 40)) {
        d.state = 'mist';
        d.t = 0;
      }
    } else if (d.state === 'mist') {
      d.x = u.x + u.w + 6 - (d.t / 1.6) * (u.w + 4);
      if (Math.random() < 0.7 && s.particle) s.particle({ x: d.x - 3, y: d.y + 3, vx: B.rnd(-14, -6), vy: B.rnd(2, 8), life: 0.6, c: 'rgba(200,230,255,0.55)', kind: 'steam' });
      if (d.t > 1.6) {
        d.state = 'brush';
        d.t = 0;
        d.passes = 0;
      }
    } else if (d.state === 'brush') {
      // sweep the pane row by row with the brush arm hanging below
      const rows = 4;
      const k = d.t / 1.1;
      const row = Math.floor(k);
      const f = k - row;
      const lr = row % 2 === 0;
      d.x = lr ? u.x + 2 + f * (u.w - 4) : u.x + u.w - 2 - f * (u.w - 4);
      d.y = u.y - 4 + (row + 0.5) * (u.h / rows);
      const bins = crew.dirtUp[d.pane];
      const bi = clamp(Math.floor(((d.x - u.x) / u.w) * bins.length), 0, bins.length - 1);
      bins[bi] = Math.max(0, bins[bi] - dt * 3);
      crew.wetUp[d.pane][bi] = 1;
      if (row >= rows) {
        for (let i = 0; i < bins.length; i++) bins[i] = 0;
        if (d.pane === 0) {
          d.pane = 1;
          d.state = 'hop';
        } else d.state = 'out';
        d.t = 0;
      }
    } else if (d.state === 'hop') {
      const v = U[1];
      if (fly(v.x + v.w + 6, v.y + 6, 45)) {
        d.state = 'mist';
        d.t = 0;
      }
    } else if (d.state === 'out') {
      if (fly(-30, -10, 55)) crew.drone = null;
    }
  }

  // ---------- the cherry-picker crew ----------
  B.look('lamp-crew', {
    skin: '#c68a62',
    hair: '#2b1d14',
    hairStyle: 'short',
    top: '#ff8a1a', // orange hi-vis
    top2: '#d8e040',
    bottom: '#2a2e3a',
    hat: '#f0f0e8',
    hatStyle: 'cap', // a white hard hat
    shoes: '#1a1a1a',
  });
  B.visitor({
    id: 'lamp-crew',
    weight: 0,
    look: 'lamp-crew',
    setup(n) {
      n.speed = 30;
      n.lane = 2;
    },
    *run(s, n) {
      const P = () => crew.picker;
      yield n.walkTo(252);
      n.pose = 'crouch';
      yield 1.2; // a cone down
      if (P()) P().cones = 1;
      n.pose = 'stand';
      yield n.walkTo(306);
      n.pose = 'crouch';
      yield 1.2;
      if (P()) P().cones = 2;
      n.pose = 'stand';
      yield n.walkTo(268);
      n.face && n.face(1);
      while (P() && P().state !== 'pack') yield 1;
      yield n.walkTo(306);
      n.pose = 'crouch';
      yield 1;
      if (P()) P().cones = 1;
      yield n.walkTo(252);
      yield 1;
      if (P()) P().cones = 0;
      n.pose = 'stand';
      yield n.walkOff();
    },
  });
  function startPicker(s) {
    if (crew.picker) return;
    crew.picker = { state: 'arrive', x: -90, boom: 0, t: 0, cones: 0, spark: 0 };
    B.spawn(s, 'lamp-crew', { fromLeft: true });
    B.log(B.pick(['A council cherry-picker pulls up by the street lamp.', 'The lamp crew are here to sort out the flickering street light.']));
  }
  const PARK = 262; // the truck's centre when parked (it stands in the road, in front of the pavement)
  function stepPicker(s, dt) {
    const p = crew.picker;
    if (!p) return;
    p.t += dt;
    if (p.state === 'arrive') {
      p.x += dt * Math.max(8, Math.min(60, (PARK - p.x) * 1.2));
      if (PARK - p.x < 0.5) {
        p.x = PARK;
        p.state = 'wait';
        p.t = 0;
      }
    } else if (p.state === 'wait') {
      if (p.cones >= 2 || p.t > 8) {
        p.state = 'raise';
        p.t = 0;
      }
    } else if (p.state === 'raise') {
      p.boom = Math.min(1, p.boom + dt / 7);
      if (p.boom >= 1) {
        p.state = 'work';
        p.t = 0;
        crew.lampOff = true;
      }
    } else if (p.state === 'work') {
      p.spark -= dt;
      if (p.spark <= 0 && Math.random() < 0.08) p.spark = 0.15;
      if (p.t > 22) {
        crew.lampOff = false;
        crew.lampFault = false;
        p.state = 'test';
        p.t = 0;
        B.log('The street lamp blinks on, off, then steady: fixed.');
      }
    } else if (p.state === 'test') {
      crew.lampOff = Math.floor(p.t * 3) % 2 === 1 && p.t < 2;
      if (p.t > 3) {
        crew.lampOff = false;
        p.state = 'lower';
        p.t = 0;
      }
    } else if (p.state === 'lower') {
      p.boom = Math.max(0, p.boom - dt / 7);
      if (p.boom <= 0) {
        p.state = 'pack';
        p.t = 0;
      }
    } else if (p.state === 'pack') {
      if (p.t > 6 && p.cones === 0) {
        p.state = 'leave';
        p.t = 0;
      }
    } else if (p.state === 'leave') {
      p.x += dt * Math.min(70, 10 + p.t * 30);
      if (p.x > 420) crew.picker = null;
    }
  }

  // ---------- stepping (real time, like the traffic) ----------
  let last = 0;
  B.on('tick', (s) => {
    const now = performance.now() / 1000;
    const dt = last ? clamp(now - last, 0, 0.1) : 0;
    last = now;
    stepDrone(s, dt);
    stepPicker(s, dt);
    for (let i = 0; i < NB; i++) crew.wet[i] = Math.max(0, crew.wet[i] - dt * 0.12); // dries in ~8 s
    for (const w of crew.wetUp) for (let i = 0; i < w.length; i++) w[i] = Math.max(0, w[i] - dt * 0.15);
  });

  // ---------- drawing ----------
  const hash = (i, j) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  /** Grime and wet sheen on a stretch of glass: speckles of dust, denser spray low down, drying streaks. */
  function grime(g, x0, y0, w, h, dirt, wet, nb) {
    for (let i = 0; i < nb; i++) {
      const d = dirt[i];
      const bx = x0 + Math.floor((i * w) / nb);
      const bw = Math.max(1, Math.floor(((i + 1) * w) / nb) - Math.floor((i * w) / nb));
      if (d > 0.05) {
        const n = Math.round(d * h * 0.35);
        for (let k = 0; k < n; k++) {
          const r = hash(i + bx, k);
          const low = Math.pow(hash(k, i + 3), 0.45); // spray: more speckles toward the bottom
          const yy = y0 + Math.floor(low * h);
          g.fillStyle = r < 0.5 ? `rgba(150,138,112,${(0.18 * d).toFixed(3)})` : `rgba(90,84,74,${(0.12 * d).toFixed(3)})`;
          g.fillRect(bx + Math.floor(r * bw), yy, 1, 1);
        }
      }
      if (wet[i] > 0.05) {
        // a wet sheen: a pale film with drips running down from the last stroke
        g.fillStyle = `rgba(220,235,250,${(0.1 * wet[i]).toFixed(3)})`;
        g.fillRect(bx, y0, bw, h);
        if (hash(i, 9) < 0.5) {
          g.fillStyle = `rgba(235,245,255,${(0.35 * wet[i]).toFixed(3)})`;
          g.fillRect(bx + Math.floor(hash(i, 2) * bw), y0 + h - Math.round(h * (1 - wet[i]) * 0.6) - 3, 1, 3);
        }
      }
    }
  }
  B.decor({
    id: 'glass-grime',
    layer: 'facade',
    draw(g, s) {
      const W = L().win;
      const D = L().doorGlass;
      const wTop = W.y + 21;
      // the window's bins cover x 8..212, the door's 228..260
      const wb0 = binOf(W.x);
      const wb1 = binOf(W.x + W.w);
      grime(g, W.x, wTop, W.w, W.h - 21, crew.dirt.subarray(wb0, wb1), crew.wet.subarray(wb0, wb1), wb1 - wb0);
      const db0 = binOf(D.x);
      const db1 = binOf(D.x + D.w);
      grime(g, D.x, D.y, D.w, D.h, crew.dirt.subarray(db0, db1), crew.wet.subarray(db0, db1), db1 - db0);
      L().upstairs.forEach((u, i) => grime(g, u.x, u.y, u.w, u.h, crew.dirtUp[i], crew.wetUp[i], 11));
    },
  });
  // the cleaner's pole and the drone are in front of the glass: drawn over its reflection
  let fc = null;
  let fg = null;
  B.decor({
    id: 'crew-front',
    layer: 'overlay',
    draw(g, s) {
      if (!fc) {
        fc = document.createElement('canvas');
        fc.width = 320;
        fc.height = 180;
        fg = fc.getContext('2d');
      }
      // the window cleaner's pole and squeegee
      const n = s.npcs.find((m) => m.kind === 'window-cleaner' && m.cleaner && m.cleaner.state !== 'walk');
      if (n && fg) {
        // drawn on its own layer, then the cleaner cut out of it: the pole passes behind him
        fg.clearRect(0, 0, 320, 180);
        const c = n.cleaner;
        const hx = n.x;
        const hy = B.headTop(n) + 12;
        B.line(fg, hx, hy, Math.round(c.gx), Math.round(c.gy) + 2, '#b8bcc4');
        fg.fillStyle = c.state === 'scrub' ? '#e8eef4' : '#20242c';
        fg.fillRect(Math.round(c.gx) - 3, Math.round(c.gy), 7, c.state === 'scrub' ? 3 : 2);
        if (c.state === 'scrub') {
          fg.fillStyle = 'rgba(255,255,255,0.6)';
          fg.fillRect(Math.round(c.gx) - 4 + Math.floor(Math.random() * 8), Math.round(c.gy) + 3, 1, 1);
        }
        fg.globalCompositeOperation = 'destination-out';
        B.drawSilhouette(fg, n, n.x, n.y, 1, 1);
        fg.globalCompositeOperation = 'source-over';
        g.drawImage(fc, 0, 0);
      }
      // the drone in front of the flat's windows (with its shadow on the brick when the sun is out)
      const d = crew.drone;
      if (d) {
        const sun = B.sun ? B.sun(s) : null;
        if (sun && sun.strength > 0.1 && !sun.behind && !cyber()) {
          const dd = 20; // ~0.9 m off the wall
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(Math.round(d.x - dd * sun.tanP) - 3, Math.round(d.y + (dd * sun.tanE) / sun.cosP), 7, 2);
        }
        drawDrone(g, d, s);
      }
    },
  });
  function drawDrone(g, d, s) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    const t = performance.now() / 1000;
    const body = cyber() ? '#1a1c26' : '#e8e8ec';
    g.fillStyle = body;
    g.fillRect(x - 3, y, 7, 3);
    g.fillStyle = cyber() ? '#3a3e4c' : '#9aa0aa';
    g.fillRect(x - 6, y, 13, 1); // the arms
    // rotors: a shimmer of blur
    g.fillStyle = 'rgba(200,205,215,0.55)';
    for (const rx of [x - 7, x + 4]) g.fillRect(rx + (Math.floor(t * 30) % 2), y - 1, 3, 1);
    // nav lights
    g.fillStyle = Math.floor(t * 2) % 2 ? '#ff3030' : '#601010';
    g.fillRect(x - 6, y + 1, 1, 1);
    g.fillStyle = '#30ff60';
    g.fillRect(x + 6, y + 1, 1, 1);
    if (cyber()) {
      g.fillStyle = '#3ff5ff';
      g.fillRect(x - 3, y + 3, 7, 1);
    }
    if (d.state === 'brush') {
      // the brush arm and its spinning head on the glass
      g.fillStyle = '#7a808a';
      g.fillRect(x, y + 3, 1, 3);
      g.fillStyle = Math.floor(t * 20) % 2 ? '#3a8ad0' : '#5aa8e8';
      g.fillRect(x - 2, y + 6, 5, 2);
    }
  }

  // the truck in the road and its boom; the basket up at the lamp head
  B.decor({
    id: 'cherry-picker',
    layer: 'road',
    draw(g, s) {
      const p = crew.picker;
      const cy = cyber();
      // cones on the pavement
      if (p && p.cones > 0) for (const cx of [252, 306].slice(0, p.cones)) drawCone(g, cx, 178);
      if (!p) return;
      const X = Math.round(p.x);
      const LAMPX = (B.renderKit && B.renderKit.LAMP) || 277;
      // the truck, seen over the bottom edge: cab roof, the flatbed and its turntable
      const body = cy ? '#2a2a3a' : '#f0f0e8';
      const stripe = cy ? '#ff8a1a' : '#e0701a';
      g.fillStyle = body;
      g.fillRect(X - 40, 174, 80, 6); // flatbed side
      g.fillRect(X + 26, 165, 18, 15); // the cab
      g.fillStyle = '#20242c';
      g.fillRect(X + 29, 167, 12, 5); // cab window
      g.fillStyle = stripe;
      for (let x = X - 40; x < X + 44; x += 6) g.fillRect(x, 176, 3, 2); // chevrons
      // the amber beacon on the cab roof, turning
      const t = performance.now() / 1000;
      const ph = (t * 1.6) % 1;
      const on = ph < 0.5;
      g.fillStyle = on ? '#ffb020' : '#7a4a10';
      g.fillRect(X + 33, 162, 4, 3);
      if (on) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const P = B.sunPos(s.hour);
        const k = clamp((8 - P.e) / 14, 0.15, 1); // reads far more at dusk
        // the beam sweeps across the front: a soft amber pool
        const bx = X + 35 + Math.cos(ph * Math.PI * 2) * 110;
        const gr = g.createRadialGradient(bx, 140, 2, bx, 140, 70);
        gr.addColorStop(0, `rgba(255,170,40,${(0.22 * k).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(255,170,40,0)');
        g.fillStyle = gr;
        g.fillRect(bx - 70, 60, 140, 120);
        const gb = g.createRadialGradient(X + 35, 160, 0, X + 35, 160, 9);
        gb.addColorStop(0, `rgba(255,190,60,${(0.6 * k).toFixed(3)})`);
        gb.addColorStop(1, 'rgba(255,190,60,0)');
        g.fillStyle = gb;
        g.fillRect(X + 26, 151, 18, 18);
        g.restore();
      }
      // the boom: turntable, lower arm, knuckle, upper arm to the basket beside the lamp head
      const base = [X - 10, 172];
      const k = p.boom;
      const target = [LAMPX - 16, 26];
      const knee = [base[0] + (target[0] - base[0]) * 0.45 - 18 * k, base[1] - (base[1] - 95) * k];
      const tip = [base[0] + (target[0] - base[0]) * k, base[1] - (base[1] - target[1]) * k];
      g.fillStyle = '#3a3a40';
      g.fillRect(base[0] - 4, 169, 9, 5);
      const arm = (a, b, w, c) => {
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
        g.fillStyle = c;
        for (let i = 0; i <= n; i++) g.fillRect(Math.round(a[0] + ((b[0] - a[0]) * i) / n) - (w >> 1), Math.round(a[1] + ((b[1] - a[1]) * i) / n) - (w >> 1), w, w);
      };
      arm(base, knee, 3, cy ? '#5a5a6a' : '#e8e8e0');
      arm(knee, tip, 2, cy ? '#ff8a1a' : '#e0701a');
      // the basket with a lineman in it
      const bx = Math.round(tip[0]);
      const by = Math.round(tip[1]);
      g.fillStyle = cy ? '#ff8a1a' : '#f0a020';
      g.fillRect(bx - 5, by, 10, 6);
      g.fillStyle = '#1a1a1a';
      g.fillRect(bx - 5, by, 10, 1);
      g.fillStyle = '#ff8a1a';
      g.fillRect(bx - 2, by - 6, 4, 6); // hi-vis
      g.fillStyle = '#d9a47e';
      g.fillRect(bx - 1, by - 9, 3, 3);
      g.fillStyle = '#f0f0e8';
      g.fillRect(bx - 2, by - 10, 5, 2); // hard hat
      if (p.state === 'work') {
        // reaching up into the lamp head; the odd spark
        const reach = Math.sin(t * 3) > 0;
        g.fillStyle = '#ff8a1a';
        g.fillRect(bx + 2, by - 7 - (reach ? 2 : 0), 1, 4);
        g.fillRect(bx + 3, by - 9 - (reach ? 2 : 0), LAMPX - bx - 8, 1);
        if (p.spark > 0) {
          g.fillStyle = '#fff0a0';
          for (let i = 0; i < 4; i++) g.fillRect(LAMPX - 6 + Math.floor(Math.random() * 6), 18 + Math.floor(Math.random() * 6), 1, 1);
        }
      }
    },
  });
  function drawCone(g, x, y) {
    g.fillStyle = '#ff6a10';
    g.fillRect(x - 1, y - 7, 3, 2);
    g.fillRect(x - 2, y - 5, 5, 3);
    g.fillStyle = '#f4f4f0';
    g.fillRect(x - 2, y - 4, 5, 1);
    g.fillStyle = '#ff6a10';
    g.fillRect(x - 3, y - 2, 7, 2);
    g.fillStyle = '#1a1a1a';
    g.fillRect(x - 4, y, 9, 1);
  }
})(window.Bookshop);
