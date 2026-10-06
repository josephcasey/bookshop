/* litter on the pavement.
 * It builds up slowly: passers-by drop things, and gusts blow in autumn leaves and paper.
 * The wind pushes the light stuff about (wet litter stays put in the rain). Some kind passers-by
 * pick bits up, some just tut, and Mabel sometimes sweeps her doorstep. Every morning the
 * council street sweeper comes by with a barrow and clears the lot. */
(function (B) {
  const name = () => B.ownerName();
  const MAX = 40;
  // Each kind is a tiny pixel map ('.' = empty; letters index its palette). Round things (paper balls,
  // cans, cups) roll end over end; flat things (leaves, newspaper, packets) spin AND flip over, showing
  // their paler back as they tumble. `light` is how easily the wind takes it; `drag` slows its fall.
  const KINDS = {
    paper: { light: 1, round: true, drag: 0.3, map: ['.ab', 'aab', 'ba.'], pal: [['#ece8de', '#b8b0a2']] },
    news: { light: 1, drag: 0.8, map: ['aaaaaa', 'abbbba', 'abbaaa', 'aaaaaa'], pal: [['#d8d4c8', '#8a867e']], back: ['#c8c4b8', '#a8a498'] },
    crisps: { light: 0.8, drag: 0.4, map: ['aaa', 'aca', 'aaa', 'bbb'], pal: [['#e8c43a', '#b8941a', '#f4f1ea'], ['#3b6ed4', '#2a4e9a', '#f4f1ea'], ['#d43b3b', '#9a2a2a', '#f4f1ea']], back: ['#c0c4c8', '#9aa0a6', '#dde0e3'] },
    wrapper: { light: 1, drag: 0.6, map: ['aba', 'bab'], pal: [['#8a3bd4', '#b87ae8'], ['#3bb0d4', '#8ad4e8'], ['#d4a33b', '#e8cc7a']], back: ['#c0c4c8', '#e3e6e8'] },
    leaf: { light: 1, drag: 0.9, map: ['.aa', 'aaa', 'ba.'], pal: [['#c8651e', '#6a3a14'], ['#b8401e', '#5a2410'], ['#c89a1e', '#6a5214']], back: ['#d8a060', '#6a4a24'] },
    cup: { light: 0.4, round: true, drag: 0, map: ['baaa', 'bcca', 'baaa'], pal: [['#f4efe6', '#6a4226', '#c0392b']] },
    can: { light: 0.25, round: true, drag: 0, map: ['daaa', 'dcaa', 'daaa'], pal: [['#c0392b', '#9a2a1e', '#f4efe6', '#c0c4c8'], ['#2b8a3e', '#1e6a2e', '#f4efe6', '#c0c4c8'], ['#3b5b8c', '#2a4064', '#f4efe6', '#c0c4c8']] },
  };
  const DROPPED = ['paper', 'paper', 'crisps', 'wrapper', 'cup', 'can', 'news'];

  // ---------- sounds ----------
  B.audio.define('streetSweep', ({ noise, street }, x) =>
    noise(0.35, { freq: 2300, q: 0.7, vol: 0.03, a: 0.12, pan: B.clamp(x / 160 - 1, -0.9, 0.9), bus: street }));
  B.audio.define('canRoll', ({ tone, street }, x) => {
    const pan = B.clamp(x / 160 - 1, -0.9, 0.9);
    for (let i = 0; i < 4; i++) tone(B.rnd(1700, 2300), 0.04, { vol: 0.008, at: i * 0.12, pan, bus: street });
  });

  // ---------- the litter itself ----------
  function add(s, kind, x, y, vx = 0) {
    s.litter = s.litter || [];
    if (s.litter.length >= MAX) return null;
    const it = { kind, x, y: y == null ? B.rnd(165, 177) : y, z: 0, vx, vz: 0, ang: Math.random() * Math.PI * 2, flip: Math.random() < 0.5 ? 0 : Math.PI, spin: 0, c: Math.floor(Math.random() * 3) };
    s.litter.push(it);
    return it;
  }
  B.dropLitter = (s, x, kind) => add(s, kind || B.pick(DROPPED), x);

  const wind = { k: 0.08, dir: 1, t: 0 }; // current gust strength (0..1) and direction
  function updateWind(s, dt) {
    if (wind.t > 0) {
      wind.t -= dt;
      if (wind.t <= 0) wind.k = 0.08;
      return;
    }
    const rate = s.weather.kind === 'clear' ? 0.02 : s.weather.kind === 'cloudy' ? 0.05 : 0.04;
    if (Math.random() < dt * rate) {
      wind.k = B.rnd(0.5, 1);
      wind.dir = B.pick([-1, 1]);
      wind.t = B.rnd(2, 5);
      B.audio.play('gust');
      // a gust brings in an autumn leaf or a stray sheet of paper from upwind
      const n = Math.random() < 0.6 ? B.irnd(1, 2) : 0;
      for (let i = 0; i < n; i++) add(s, B.chance(0.7) ? 'leaf' : B.pick(['paper', 'news', 'wrapper']), wind.dir > 0 ? -6 : 326, null, wind.dir * 15);
    }
  }

  const TAU = Math.PI * 2;
  function updateLitter(s, dt) {
    const wet = s.weather.rain > 0.5 ? 0.1 : 1;
    for (const it of s.litter) {
      const K = KINDS[it.kind] || KINDS.paper;
      if (it.ang == null) it.ang = 0; // older saved litter
      if (it.flip == null) it.flip = 0;
      if (it.spin == null) it.spin = 0;
      // litter drifts into sheltered corners (the shop doorway, the alley mouth, the kerb) and snags there
      const sheltered = (it.x > 224 && it.x < 264) || (it.x > 280 && it.x < 318) || it.y > 176;
      const push = wind.dir * wind.k * 26 * K.light * wet * (sheltered ? 0.15 : 1);
      it.vx += (push - it.vx) * Math.min(1, dt * (K.light > 0.5 ? 2 : 0.8));
      if (Math.abs(it.vx) < 0.5 && wind.k < 0.2) it.vx = 0;
      const airborne = it.z > 0;
      // gusts lift the light stuff, setting it spinning
      if (K.light > 0.7 && !airborne && wind.k > 0.4 && Math.random() < dt * 1.5 * wind.k * wet) {
        it.vz = B.rnd(12, 28);
        it.spin = wind.dir * B.rnd(6, 14) * (B.chance(0.3) ? -1 : 1);
      }
      if (K.round) {
        // roll: turn in proportion to distance travelled (radius ~1.5px), plus any airborne spin
        it.ang += (it.vx / 1.5) * dt + (airborne ? it.spin * dt : 0);
        // round things hop along the paving when bowled over by a strong gust
        if (!airborne && Math.abs(it.vx) > 8 && Math.random() < dt * 2) it.vz = B.rnd(4, 9);
      } else if (airborne) {
        it.ang += it.spin * dt;
        it.flip += (Math.abs(it.spin) * 0.8 + 4) * dt; // flutters over and over
      } else if (Math.abs(it.vx) > 2) {
        // skittering along the ground: scraping round and flipping now and then
        it.ang += it.vx * 0.15 * dt;
        if (Math.random() < dt * Math.abs(it.vx) * 0.08) it.flipTo = (it.flipTo || it.flip) + Math.PI;
      }
      if (it.flipTo != null) {
        const d = it.flipTo - it.flip;
        it.flip += Math.sign(d) * Math.min(Math.abs(d), dt * 12);
        if (Math.abs(d) < 0.01) it.flipTo = null;
      }
      if (it.kind === 'can' && Math.abs(it.vx) > 3 && !it.rolling) {
        it.rolling = true;
        B.audio.play('canRoll', it.x);
      }
      if (Math.abs(it.vx) < 1) it.rolling = false;
      // gravity, with flat things drifting down slowly and swaying as they fall
      it.z = Math.max(0, it.z + it.vz * dt);
      if (it.z > 0) {
        it.vz -= 70 * dt;
        if (K.drag) it.vz = Math.max(it.vz, -40 * (1 - K.drag) - 4);
        if (K.drag > 0.5) it.x += Math.sin(it.flip * 0.5) * 6 * dt;
      } else if (airborne) {
        // landed: flat things settle face up or face down, lying flat
        it.vz = 0;
        it.spin *= 0.3;
        if (!K.round) {
          it.flipTo = Math.round(it.flip / Math.PI) * Math.PI;
          it.ang = Math.round(it.ang / (Math.PI / 2)) * (Math.PI / 2) + B.rnd(-0.3, 0.3);
        }
      }
      it.ang %= TAU;
      it.x += it.vx * dt;
      if (it.vx !== 0) it.y = B.clamp(it.y + B.rnd(-4, 4) * dt, 165, 177);
    }
    // blown off the ends of the street
    s.litter = s.litter.filter((it) => it.x > -12 && it.x < 332);
  }

  /** Sweep up anything near (x) on the pavement; returns how many bits were collected. */
  function collect(s, x, reach = 9) {
    let n = 0;
    s.litter = s.litter.filter((it) => {
      if (it.z < 4 && Math.abs(it.x - x) < reach) {
        n++;
        s.particle({ layer: 'out', x: it.x, y: it.y - 1, vx: B.rnd(-6, 6), vy: -6, life: 0.4, c: '#a8a098' });
        return false;
      }
      return true;
    });
    return n;
  }

  // ---------- drawing ----------
  function drawItem(g, it) {
    const K = KINDS[it.kind] || KINDS.paper;
    const map = K.map;
    const h = map.length;
    const w = map[0].length;
    const pal = K.pal[it.c % K.pal.length];
    const sx = Math.cos(it.flip || 0); // 1 = face up, -1 = showing its back, ~0 = edge on
    const cols = sx < 0 && K.back ? K.back : pal;
    const sxa = Math.max(0.2, Math.abs(sx));
    const cos = Math.cos(it.ang || 0);
    const sin = Math.sin(it.ang || 0);
    // lying down, flat litter is squashed into the pavement's perspective; airborne it shows its full shape
    const squash = it.z > 1 || K.round ? 1 : 0.6;
    const cx = it.x + w / 2;
    const cy = it.y - it.z - (K.round ? h / 2 : 1);
    const R = Math.ceil(Math.max(w, h) / 2) + 1;
    if (it.z > 1) B.px(g, 'rgba(0,0,0,0.22)', Math.round(it.x), Math.round(it.y), w, 1);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        // inverse-map each screen pixel back into the sprite: un-squash, un-rotate, un-flip
        const ry = dy / squash;
        const u = (dx * cos + ry * sin) / sxa;
        const v = -dx * sin + ry * cos;
        const i = Math.round(u + (w - 1) / 2);
        const j = Math.round(v + (h - 1) / 2);
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const ch = map[j][i];
        if (ch === '.') continue;
        const col = cols[ch.charCodeAt(0) - 97] || cols[0];
        B.px(g, sxa < 0.35 ? B.shade(col, 0.8) : col, Math.round(cx + dx), Math.round(cy + dy), 1, 1);
      }
    }
  }

  B.decor({
    id: 'litter',
    layer: 'street',
    draw(g, s) {
      for (const it of s.litter || []) drawItem(g, it);
      // the sweeper's wheeled barrow
      for (const n of s.npcs) {
        if (n.kind !== 'street-sweeper' || n.area !== 'street') continue;
        const d = n.dir || 1;
        const bx = Math.round(n.x + 19 * d) - 7;
        const by = Math.round(n.y);
        B.line(g, n.x + 4 * d, by - 30, d > 0 ? bx : bx + 14, by - 18, '#2b2b2b');
        B.px(g, '#6a7078', bx, by - 19, 14, 16);
        B.px(g, '#7e858e', bx + 1, by - 19, 3, 16);
        B.px(g, '#3a3f44', bx - 1, by - 21, 16, 3);
        B.px(g, '#e8e03a', bx, by - 12, 14, 2);
        B.px(g, '#f08c00', bx + 5, by - 8, 4, 3); // council crest
        B.px(g, '#8a6a3a', bx + (d > 0 ? 11 : 2), by - 27, 1, 7); // dustpan handle
        B.px(g, '#5a5e64', bx + (d > 0 ? 9 : 0), by - 22, 5, 2);
        for (const wx of [bx + 1, bx + 10]) {
          B.px(g, '#1e1a1a', wx, by - 3, 3, 3);
          B.px(g, '#5a5a5a', wx + 1, by - 2, 1, 1);
        }
      }
    },
  });

  // ---------- people ----------
  B.look('sweeper', {
    skin: '#c68a62',
    hair: '#2b1d14',
    hairStyle: 'short',
    top: '#f08c00', // hi-vis
    top2: '#e8e03a',
    bottom: '#1f2a44',
    shoes: '#1e1a1a',
    hat: '#1f3350',
    hatStyle: 'beanie',
    beard: '#2b1d14',
    h: 1,
  });

  B.happening({
    id: 'daily-sweep',
    perHour: 30,
    when: (s) => s.hour >= 8.6 && s.hour < 11 && !s.flags.swept,
    *run(s) {
      s.flags.swept = true;
      B.spawn(s, 'street-sweeper', { fromLeft: true });
    },
  });

  B.visitor({
    id: 'street-sweeper',
    spawn: false,
    look: 'sweeper',
    setup(n) {
      n.speed = 20;
      n.lane = 2;
      n.umbrella = false;
      n.randomExit = false;
      n.mood_ = 'happy';
      n.swept = 0;
    },
    *run(s, n) {
      if (s.owner.area === 'inside' && B.chance(0.6)) s.request('wave-back', 2, { npc: n });
      n.holding = 'broom';
      while (n.x < B.LAYOUT.edgeR) {
        // sweep along, stopping to work at any clumps of litter
        const ahead = (s.litter || []).filter((it) => it.x > n.x && it.x < n.x + 26).length;
        if (ahead >= 2) {
          n.pose = 'sweep';
          yield 1.2;
        }
        n.movePose = 'sweep';
        yield n.walkTo(Math.min(n.x + 24, B.LAYOUT.edgeR));
        n.movePose = null;
      }
      n.holding = null;
      if (n.swept >= 5) B.log(`The council street sweeper comes by and clears ${n.swept} bits of litter off the pavement.`);
      else if (B.chance(0.4)) B.log('The street sweeper whistles past. Not much to do today.');
    },
  });

  // kind passers-by pick bits up and take them to a bin
  B.visitor({
    id: 'litter-picker',
    weight: (s) => ((s.litter || []).length >= 8 && B.daylight(s.hour) > 0.4 ? 0.35 : 0),
    *run(s, n) {
      let picked = 0;
      for (let i = 0; i < B.irnd(1, 3); i++) {
        const near = (s.litter || []).filter((it) => it.z === 0 && (n.dir > 0 ? it.x > n.x : it.x < n.x));
        if (!near.length) break;
        const it = near.reduce((a, b) => (Math.abs(b.x - n.x) < Math.abs(a.x - n.x) ? b : a));
        n.lane = B.clamp(Math.round(it.y - B.LAYOUT.streetY), -3, 5);
        yield n.walkTo(it.x - 6 * n.dir);
        if (!s.litter.includes(it)) continue; // blew away / someone else got it
        yield n.hold('crouch', 0.8);
        s.litter.splice(s.litter.indexOf(it), 1);
        picked++;
        n.holding = 'parcel';
      }
      if (picked) {
        n.emote(B.pick(['happy', 'dots']), 1.2);
        if (B.chance(0.4)) B.log(`A kind passer-by picks up ${picked === 1 ? 'a bit' : picked + ' bits'} of litter.`);
      }
      yield n.walkOff();
    },
  });

  // Mabel sweeps her own doorstep when it gets untidy
  const nearDoor = (s) => (s.litter || []).filter((it) => it.x > 214 && it.x < 280).length;
  B.activity({
    id: 'sweep-doorstep',
    priority: 5.4, // short and outdoors: finish before serving anyone
    resume: false,
    weight: (s) => (nearDoor(s) >= 2 ? nearDoor(s) * 1.5 : 0),
    cooldown: 90,
    when: (s, o) => s.shop.open && s.queue.length === 0,
    *run(s, o) {
      yield o.go('door');
      yield* o.exit(s);
      o.lane = 0;
      o.holding = 'broom';
      if (nearDoor(s) > 4) o.emote('sigh', 1.4);
      o.movePose = 'sweep';
      for (const x of [232, 270, 222, 258]) yield o.walkTo(x, { speed: 0.4 });
      o.movePose = null;
      o.holding = null;
      o.emote('happy', 1);
      if (B.chance(0.5)) B.log(`${name()} pops out and sweeps her doorstep.`);
      yield s.door.pass(o, 'in');
      o.depth = 'back';
    },
  });

  // ---------- world hooks ----------
  const KEY = 'bookshop.litter';
  B.on('ready', (s) => {
    try {
      s.litter = JSON.parse(localStorage.getItem(KEY) || '[]').slice(0, MAX);
    } catch (e) {
      s.litter = [];
    }
    if (!s.litter.length) for (let i = 0; i < 4; i++) add(s, B.pick(DROPPED), B.rnd(10, 300));
  });
  let saveT = 0;
  B.on('tick', (s, dt) => {
    if (!s.litter) s.litter = [];
    updateWind(s, dt);
    updateLitter(s, dt);
    const day = B.daylight(s.hour);
    for (const a of s.npcs.concat([s.owner])) {
      if (a.area !== 'street') continue;
      // anyone sweeping the pavement gathers up what's under their broom
      if (a.movePose === 'sweep' || a.pose === 'sweep') {
        const got = collect(s, a.x + 9 * (a.dir || 1));
        a._sweepT = (a._sweepT || 0) - dt;
        if (a._sweepT <= 0) {
          a._sweepT = 0.5;
          B.audio.play('streetSweep', a.x);
        }
        if (got && a !== s.owner) a.swept = (a.swept || 0) + got;
        continue;
      }
      if (!(a instanceof B.NPC) || !a.moving || a.kind === 'street-sweeper' || a.kind === 'litter-picker') continue;
      // the odd careless passer-by drops something...
      if (day > 0.2 && Math.random() < dt * (a.rude ? 0.03 : 0.006)) {
        add(s, B.pick(DROPPED), a.x - 6 * (a.dir || 1), a.y);
        if (B.chance(0.15)) B.log('Somebody drops their rubbish on the pavement and walks on.');
      }
      // ...and others tut at it
      if (!a.tutted && Math.random() < dt * 0.3 && s.litter.some((it) => Math.abs(it.x - a.x) < 4)) {
        a.tutted = true;
        if (B.chance(0.3)) a.emote(B.pick(['angry', 'dots']), 1.2);
      }
      // dogs have a sniff at anything interesting
      if (a.dog && !a.dog.sniffedLitter && s.litter.some((it) => Math.abs(it.x - a.dog.x) < 5)) {
        a.dog.sniffedLitter = true;
        a.dog.sniff = 1.5;
      }
    }
    saveT -= dt;
    if (saveT <= 0) {
      saveT = 20;
      try {
        localStorage.setItem(KEY, JSON.stringify(s.litter.map(({ kind, x, y, ang, flip, c }) => ({ kind, x, y, ang, flip: Math.round(flip / Math.PI) * Math.PI, c, z: 0, vx: 0, vz: 0, spin: 0 }))));
      } catch (e) {
        /* storage unavailable */
      }
    }
  });
})(window.Bookshop);
