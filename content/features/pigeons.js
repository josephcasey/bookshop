/* street pigeons.
 * Small flocks drop in to peck at the litter (and any crumbs), bobbing about the pavement.
 * Anyone walking close, a dog, the shop door opening, or your clicks send them clattering up to
 * the sign, the cornice, the lamp or a window sill; they drift back down when it's quiet.
 * At dusk they roost along the top of the shop sign. An old dear sometimes comes to feed them,
 * and Marmalade watches them hungrily from the window. */
(function (B) {
  const MAX = 9;
  const FOODY = { paper: 1, crisps: 1, cup: 1, wrapper: 1 };
  const COLORS = [
    { body: '#8a93a0', wing: '#6e7784', neck: '#5a8a7a' },
    { body: '#9aa0a8', wing: '#7a8088', neck: '#6a7a9a' },
    { body: '#6e6a70', wing: '#58545a', neck: '#5a7a6a' }, // a dark one
    { body: '#c8c0b8', wing: '#a8a098', neck: '#8a9a8a' }, // a pale one
  ];
  // where they perch: [y, x1, x2]
  const PERCHES = [
    [52, 8, 266], // top of the shop sign
    [52, 8, 266],
    [8, 4, 270], // roof cornice
    [48, 152, 194], // right-hand upstairs sill (the other has geraniums)
    [3, 277, 277], // on the street lamp
  ];

  // ---------- sounds ----------
  B.audio.define('coo', ({ tone, street }, x) => {
    const pan = B.clamp(x / 160 - 1, -0.9, 0.9);
    tone(330, 0.22, { vol: 0.012, slide: 290, a: 0.05, lp: 700, pan, bus: street });
    tone(310, 0.35, { vol: 0.012, slide: 260, a: 0.06, at: 0.3, lp: 700, pan, bus: street });
  });
  B.audio.define('flap', ({ noise, street }, x, n = 3) => {
    const pan = B.clamp(x / 160 - 1, -0.9, 0.9);
    for (let i = 0; i < 6 + n * 2; i++) noise(0.04, { freq: B.rnd(900, 1500), q: 0.8, vol: 0.03 * (1 - i / (8 + n * 2)), at: i * 0.055 + B.rnd(0, 0.02), pan, bus: street });
  });

  // ---------- flock logic ----------
  const food = (s) => {
    const list = (s.litter || []).filter((it) => FOODY[it.kind] && it.z === 0);
    return list.concat(s.crumbs || []);
  };
  function spawn(s, tx, ty) {
    if (s.pigeons.length >= MAX) return;
    const fromLeft = B.chance(0.5);
    s.pigeons.push({
      x: fromLeft ? B.rnd(-20, 60) : B.rnd(260, 340),
      y: -8,
      state: 'fly',
      tx,
      ty,
      next: 'walk',
      dir: fromLeft ? 1 : -1,
      t: Math.random() * 10,
      stateT: 0,
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  }
  function flockIn(s, n, near) {
    for (let i = 0; i < n; i++) spawn(s, B.clamp(near.x + B.rnd(-24, 24), 10, 312), B.rnd(166, 176));
  }
  function flyTo(p, x, y, next) {
    p.state = 'fly';
    p.tx = x;
    p.ty = y;
    p.next = next;
  }
  function randomPerch() {
    const [y, x1, x2] = B.pick(PERCHES);
    return [B.rnd(x1, x2), y];
  }
  function scatter(s, p) {
    if (p.state === 'fly') return;
    B.audio.play('flap', p.x, 3);
    for (const q of s.pigeons) {
      if (q.state === 'fly' || Math.abs(q.x - p.x) > 36 || q.y < 160) continue;
      if (B.chance(0.35)) flyTo(q, q.x + B.rnd(-80, 80), -12, 'gone');
      else {
        const [x, y] = randomPerch();
        flyTo(q, x, y, 'perch');
      }
    }
  }

  function update(s, dt) {
    const day = B.daylight(s.hour);
    const snacks = food(s);
    // new arrivals, drawn by food
    if (day > 0.4 && snacks.length && s.pigeons.length < MAX - 2 && Math.random() < dt * 0.015) {
      flockIn(s, B.irnd(2, 4), B.pick(snacks));
      if (B.chance(0.2)) B.log('A few pigeons flap down to pick over the litter.');
    }
    const threats = [];
    for (const a of s.npcs.concat([s.owner])) {
      if (a.area !== 'street' || a.hidden || (a.alpha != null && a.alpha < 0.5) || a.pigeonFriend) continue;
      threats.push({ x: a.x, r: a.moving ? (a.speed > 80 ? 34 : 22) : 12 });
      if (a.dog) threats.push({ x: a.dog.x, r: 30, dog: a.dog });
    }
    if (s.door.open > 0.3) threats.push({ x: 244, r: 26 });

    for (const p of s.pigeons) {
      p.t += dt;
      if (p.state === 'fly') {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const step = 80 * dt;
        if (Math.abs(dx) > 1) p.dir = Math.sign(dx);
        if (d <= step) {
          p.x = p.tx;
          p.y = p.ty;
          p.state = p.next;
          p.stateT = p.state === 'perch' ? B.rnd(6, 20) : B.rnd(1, 3);
        } else {
          p.x += (dx / d) * step;
          p.y += (dy / d) * step;
        }
        continue;
      }
      if (p.state === 'roost') {
        if (day > 0.35) p.state = 'perch';
        continue;
      }
      if (day < 0.25 && p.state !== 'roost') {
        // dusk: settle along the top of the sign for the night
        if (p.state === 'perch' && p.y === 52) p.state = 'roost';
        else flyTo(p, B.rnd(20, 250), 52, 'roost');
        continue;
      }
      if (p.state === 'perch') {
        p.stateT -= dt;
        if (Math.random() < dt * 0.02) p.dir = -p.dir; // shuffles about
        if (p.stateT <= 0) {
          if (snacks.length && B.chance(0.7)) {
            const f = B.pick(snacks);
            flyTo(p, B.clamp(f.x + B.rnd(-10, 10), 8, 314), B.rnd(166, 176), 'walk');
          } else if (B.chance(0.3)) flyTo(p, p.x + B.rnd(-60, 60), -12, 'gone');
          else p.stateT = B.rnd(10, 30);
        }
        continue;
      }
      // on the pavement: anything coming? (they only notice what's close)
      const threat = threats.find((th) => Math.abs(th.x - p.x) < th.r);
      if (threat) {
        if (threat.dog && threat.dog.sniff <= 0) threat.dog.sniff = 0.8; // the dog lunges
        scatter(s, p);
        continue;
      }
      if (p.state === 'peck') {
        p.stateT -= dt;
        p.peckT = (p.peckT || 0) - dt;
        if (p.peckT <= 0) {
          p.peckT = 0.35;
          const f = p.target;
          if (f && f.kind && s.litter.includes(f)) f.vx += B.rnd(-4, 4); // worrying at a crisp packet
          if (f && !f.kind && Math.random() < 0.35 && s.crumbs.includes(f)) s.crumbs.splice(s.crumbs.indexOf(f), 1); // ate a crumb
        }
        if (p.stateT <= 0) p.state = 'walk';
        continue;
      }
      // walking: head for the nearest snack, head bobbing
      p.stateT -= dt;
      const near = snacks.filter((f) => Math.abs(f.x - p.x) < 70);
      const f = near.length ? near.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)) : null;
      if (f && Math.abs(f.x - p.x) > 3) {
        p.dir = Math.sign(f.x - p.x);
        p.x += p.dir * 11 * dt;
        p.y += Math.sign(f.y - p.y) * Math.min(Math.abs(f.y - p.y), 4 * dt);
        p.walking = true;
      } else if (f) {
        p.state = 'peck';
        p.stateT = B.rnd(1, 2.5);
        p.target = f;
        p.walking = false;
      } else {
        // nothing to eat: potter about, and eventually give up
        if (p.stateT <= 0) {
          p.stateT = B.rnd(1, 3);
          p.wander = B.chance(0.6) ? B.rnd(-14, 14) : 0;
          if (B.chance(0.15)) flyTo(p, ...randomPerch(), 'perch');
        }
        p.walking = !!p.wander;
        if (p.wander) {
          p.dir = Math.sign(p.wander);
          const m = Math.min(Math.abs(p.wander), 9 * dt);
          p.x += p.dir * m;
          p.wander -= p.dir * m;
        }
      }
      if (Math.random() < dt * 0.04) B.audio.play('coo', p.x);
    }
    s.pigeons = s.pigeons.filter((p) => !(p.state === 'gone' || p.x < -30 || p.x > 350));
  }

  // ---------- drawing ----------
  function paintPigeon(g, p, cx, fy) {
    const d = p.dir || 1;
    const P = (c, x, y, w = 1, h = 1) => {
      g.fillStyle = c;
      g.fillRect(d > 0 ? cx + x : cx - x - w, fy + y, w, h);
    };
    const { body, wing, neck } = p.col;
    const belly = B.shade(body, 1.15);
    const dark = '#3a3f48';
    const eye = '#e87a2a';
    const beak = '#d8c8b0';
    const legs = '#d87a8a';
    const t = p.t;
    if (p.state === 'fly') {
      const up = Math.floor(t * 14) % 2;
      P(dark, -7, -7, 3, 2); // tail
      P(body, -4, -8, 8, 3);
      P(belly, -3, -6, 6, 1);
      if (up) {
        P(wing, -2, -13, 4, 5);
        P(dark, -2, -13, 1, 3);
      } else {
        P(wing, -2, -6, 5, 4);
        P(dark, 1, -3, 2, 1);
      }
      P(neck, 3, -9, 2, 2);
      P(body, 4, -10, 3, 2);
      P(eye, 5, -10);
      P(beak, 7, -9);
      return;
    }
    const roost = p.state === 'roost';
    const perch = p.state === 'perch' || roost;
    P(dark, -6, -5, 2, 2); // tail
    P(body, perch ? -4 : -3, perch ? -7 : -6, perch ? 8 : 7, perch ? 5 : 4);
    P(belly, -2, -3, 4, 1);
    P(wing, -3, -6, 4, 2);
    P(dark, -2, -5);
    P(dark, 0, -5);
    P(legs, -1, -2, 1, 2);
    P(legs, 1, -2, 1, 2);
    if (roost) {
      P(body, 1, -9, 3, 2); // head tucked in
      P(dark, 2, -8);
      return;
    }
    let hx = 2;
    let hy = -10;
    if (p.state === 'peck') {
      const down = Math.floor(t * 6) % 2;
      hx = 4;
      hy = down ? -4 : -7;
      P(neck, 2, -7, 2, down ? 4 : 2);
    } else {
      // the head-bob: pushed forward, then the body catches up
      if (p.walking && Math.floor(t * 8) % 2) hx = 3;
      P(neck, 1, -8, 2, 3);
      P('#7a5a8a', 1, -7);
    }
    P(body, hx, hy, 3, 2);
    P(eye, hx + 1, hy);
    P(beak, hx + 3, hy + 1);
  }

  const draw = (g, s, onFacade) => {
    for (const p of s.pigeons || []) {
      const perched = p.state === 'perch' || p.state === 'roost';
      if (perched !== onFacade && !(onFacade === false && p.state === 'fly')) continue;
      B.blit(g, p.x, p.y, (bg, cx, fy) => paintPigeon(bg, p, cx, fy));
    }
    if (!onFacade) for (const c of s.crumbs || []) B.px(g, '#d8b878', Math.round(c.x), Math.round(c.y) - 1, 1, 1);
  };
  B.decor({ id: 'pigeons-perched', layer: 'facade', draw: (g, s) => draw(g, s, true) });
  B.decor({ id: 'pigeons-street', layer: 'street', draw: (g, s) => draw(g, s, false) });

  // ---------- the pigeon lady ----------
  B.look('pigeon-lady', {
    skin: '#e8b996',
    hair: '#d9d4cc',
    hairStyle: 'bob',
    hat: '#6a4c93',
    hatStyle: 'beanie',
    hat2: '#c9a13b',
    top: '#7a3434', // long winter coat
    bottom: '#7a3434',
    dress: true,
    tights: '#4a3a3a',
    scarf: '#c9a13b',
    bagC: '#3c6e47',
    h: -1,
  });
  B.visitor({
    id: 'pigeon-feeder',
    look: 'pigeon-lady',
    weight: (s) => (B.daylight(s.hour) > 0.5 ? 0.25 : 0),
    setup(n) {
      n.speed = 24;
      n.pigeonFriend = true;
      n.holding = 'bag';
    },
    *run(s, n) {
      yield n.walkTo(B.rnd(40, 200));
      n.face('side');
      flockIn(s, B.irnd(3, 5), { x: n.x });
      B.log('An old lady stops to scatter breadcrumbs for the pigeons.');
      for (let i = 0; i < B.irnd(5, 9); i++) {
        yield n.hold('wave', 0.7);
        for (let k = 0; k < 4; k++) s.crumbs.push({ x: B.clamp(n.x + n.dir * B.rnd(6, 34), 4, 316), y: B.rnd(166, 177) });
        if (B.chance(0.3)) n.emote('heart', 1.2);
        yield B.rnd(0.8, 1.6);
      }
      n.holding = 'bag';
      yield 2;
    },
  });

  // ---------- hooks ----------
  B.on('ready', (s) => {
    s.pigeons = [];
    s.crumbs = [];
  });
  B.on('tick', (s, dt) => {
    if (!s.pigeons) s.pigeons = [];
    if (!s.crumbs) s.crumbs = [];
    update(s, dt);
    if (s.crumbs.length > 60) s.crumbs.splice(0, s.crumbs.length - 60);
    // Marmalade, awake in the window, can't take her eyes off them
    const cat = s.cat;
    if (cat && cat.surface === 'sill' && cat.pose !== 'sleep' && cat.pose !== 'jump') {
      const p = s.pigeons.find((q) => q.y > 160 && Math.abs(q.x - cat.x) < 60);
      if (p) {
        cat.dir = p.x > cat.x ? 1 : -1;
        if (Math.random() < dt * 0.05) cat.emote('bang', 1.2);
      }
    }
  });
  B.on('click', (s, x) => {
    // a knock or a ring startles anything close by
    for (const p of s.pigeons || []) if (p.y > 160 && Math.abs(p.x - x) < 60) return scatter(s, p);
  });
  B.on('jump', (s) => {
    s.pigeons = [];
    s.crumbs = [];
  });
})(window.Bookshop);
