/* Marmalade, the shop cat.
 * Built entirely from content hooks: its own little behaviour loop runs on the 'tick' event,
 * it's drawn through decor layers, and Mabel reacts through ordinary activities.
 * Add cat behaviours later with Bookshop.catBehaviour({ id, weight, when, *run(s, cat) }). */
(function (B) {
  const name = () => B.ownerName();

  // Surfaces the cat can be on. y is paw level. The floor is hidden below the window sill,
  // so jumping down makes the cat vanish and jumping up makes it pop into view.
  const SURF = {
    sill: { y: 143, x: [72, 188], layer: 'interior-front' },
    counter: { y: 127, x: [140, 206], layer: 'counter' },
    shelf: { y: 124, x: [18, 60], layer: 'interior-back' },
    floor: { y: 164, x: [16, 206], layer: 'interior-back' },
  };
  const C = { fur: '#d9822b', stripe: '#a85a17', white: '#f4efe2', eye: '#6fbf3f', ink: '#1e1a1a', nose: '#e8889a', ear: '#e8a0a8' };

  B.audio.define('meow', ({ tone }) => tone(760, 0.35, { slide: 520, type: 'triangle', vol: 0.05 }));
  B.audio.define('purr', ({ noise }) => noise(1.4, { ftype: 'lowpass', freq: 120, q: 3, vol: 0.06, a: 0.2, r: 0.4 }));
  B.audio.define('thud', ({ tone }) => tone(90, 0.12, { type: 'triangle', slide: 60, vol: 0.14 }));
  B.audio.define('clatter', ({ tone, noise }) => {
    tone(320, 0.08, { type: 'square', vol: 0.05 });
    tone(240, 0.1, { type: 'square', vol: 0.05, at: 0.1 });
    noise(0.15, { freq: 2000, vol: 0.04, at: 0.05 });
  });
  B.audio.define('buzz', ({ tone }) => tone(210, 0.5, { type: 'sawtooth', vol: 0.008, slide: 235 }));

  // ---------- the cat ----------
  class Cat {
    constructor() {
      this.name = 'Marmalade';
      this.surface = 'sill';
      this.layer = SURF.sill.layer;
      this.x = 150;
      this.y = SURF.sill.y;
      this.dir = -1;
      this.pose = 'sleep';
      this.t = 0;
      this.walkT = 0;
      this.emoteKind = null;
      this.emoteT = 0;
      this.prey = false;
      this.script = null;
    }
    get headTop() {
      return this.y - ({ sleep: 11, loaf: 15, crouch: 13, walk: 18 }[this.pose] || 20);
    }
    emote(kind, sec = 2) {
      this.emoteKind = kind;
      this.emoteT = sec;
    }
    hold(pose, sec) {
      const c = this;
      let t = 0;
      return { update: (dt) => ((c.pose = pose), (t += dt) >= sec) };
    }
    walkTo(x, speed = 26) {
      const c = this;
      return {
        update(dt) {
          const d = x - c.x;
          if (Math.abs(d) <= speed * dt) {
            c.x = x;
            c.pose = 'sit';
            return true;
          }
          c.dir = Math.sign(d);
          c.x += c.dir * speed * dt;
          c.walkT += dt;
          c.pose = 'walk';
          return false;
        },
      };
    }
    jumpTo(surface, x) {
      const c = this;
      const S = SURF[surface];
      let t = 0;
      let x0;
      let y0;
      const dur = 0.55;
      return {
        update(dt) {
          if (t === 0) {
            x0 = c.x;
            y0 = c.y;
            if (x !== x0) c.dir = Math.sign(x - x0);
            c.layer = S.layer;
          }
          t += dt;
          const k = Math.min(1, t / dur);
          const peak = Math.min(y0, S.y) - 14;
          c.x = B.lerp(x0, x, k);
          const lin = B.lerp(y0, S.y, k);
          c.y = lin - (lin - peak) * Math.sin(Math.PI * k) * (k < 1 ? 1 : 0);
          c.pose = 'jump';
          if (k >= 1) {
            c.surface = surface;
            c.y = S.y;
            c.pose = 'sit';
            return true;
          }
          return false;
        },
      };
    }
    /** Get to any surface, dropping down to the (hidden) floor when needed. */
    *goTo(surface, x) {
      const S = SURF[surface];
      x = B.clamp(x, S.x[0], S.x[1]);
      if (this.surface === surface) {
        yield this.walkTo(x);
        return;
      }
      const near = Math.abs(this.x - x) < 28;
      if (this.surface !== 'floor' && surface !== 'floor' && near) {
        yield this.jumpTo(surface, x);
        return;
      }
      if (this.surface !== 'floor') yield this.jumpTo('floor', B.clamp(this.x + 8 * Math.sign(x - this.x || 1), ...SURF.floor.x));
      if (surface === 'floor') {
        yield this.walkTo(x, 45);
        return;
      }
      yield this.walkTo(B.clamp(x - 10 * Math.sign(x - this.x || 1), ...SURF.floor.x), 45);
      yield this.jumpTo(surface, x);
    }
    update(dt, s) {
      this.t += dt;
      if (this.emoteT > 0 && (this.emoteT -= dt) <= 0) this.emoteKind = null;
      if (!this.script || this.script.done) this.script = new B.Script(life(s, this), { id: 'cat' });
      this.script.update(dt, s);
    }
  }

  // ---------- behaviours ----------
  const behaviours = [];
  B.catBehaviour = (def) => {
    const i = behaviours.findIndex((b) => b.id === def.id);
    if (i >= 0) behaviours[i] = Object.assign(behaviours[i], def);
    else behaviours.push(def);
  };

  function* life(s, cat) {
    for (;;) {
      const ok = behaviours.filter((b) => B.isActive(b) && (!b.when || b.when(s, cat)));
      const b = B.weighted(ok, (x) => B.val(x.weight == null ? 1 : x.weight, s, cat));
      if (!b) {
        yield 2;
        continue;
      }
      cat.doing = b.id;
      yield* b.run(s, cat);
      cat.pose = cat.surface === 'floor' ? 'sit' : cat.pose;
      yield B.rnd(0.5, 2);
    }
  }

  const ownerAround = (s) => s.owner.area === 'inside' && s.owner.pose !== 'sleep';
  const night = (s) => B.daylight(s.hour) < 0.4;

  B.catBehaviour({
    id: 'nap-in-window',
    weight: (s) => 4 + (night(s) ? 4 : 0) + (s.owner.area !== 'inside' ? 3 : 0) + (s.weather.kind === 'clear' ? 1 : 0),
    *run(s, cat) {
      yield* cat.goTo('sill', B.rnd(100, 180));
      cat.pose = 'sit';
      yield 1;
      if (B.chance(0.5)) yield cat.hold('groom', B.rnd(2, 4));
      cat.pose = 'loaf';
      yield 2;
      cat.pose = 'sleep';
      const dur = B.rnd(25, 80);
      for (let t = 0; t < dur; t += 1) {
        yield 1;
        if (t % 3 === 0) s.particle({ layer: 'in', x: cat.x + 6 * cat.dir, y: cat.y - 14, vx: 3, vy: -5, life: 2, c: '#5c7cfa', kind: 'z', sc: 1 });
        if (s.fly || s.mouse) break;
        if (cat.alert > 0) {
          cat.alert = 0;
          cat.pose = 'loaf';
          yield 2;
          cat.pose = 'sleep';
        }
      }
      yield cat.hold('stretch', 1.5);
    },
  });

  B.catBehaviour({
    id: 'groom',
    weight: 2,
    *run(s, cat) {
      yield cat.hold('groom', B.rnd(4, 7));
      yield cat.hold('sit', 1);
    },
  });

  B.catBehaviour({
    id: 'counter-perch',
    weight: (s) => (s.owner.area === 'inside' ? 2.5 : 0.5),
    *run(s, cat) {
      yield* cat.goTo('counter', B.rnd(186, 204));
      for (let i = 0; i < B.irnd(3, 6); i++) {
        cat.dir = B.pick([-1, 1]);
        yield B.rnd(1.5, 3);
      }
      if (B.chance(0.4)) {
        cat.pose = 'loaf';
        yield B.rnd(8, 16);
      }
    },
  });

  B.catBehaviour({
    id: 'knock-phone',
    weight: (s) => (!s.phone.offHook && !s.phone.ringing ? 0.35 : 0),
    *run(s, cat) {
      yield* cat.goTo('counter', 163);
      cat.dir = -1;
      yield cat.hold('sit', 1.5);
      if (s.phone.offHook || s.phone.ringing) return;
      yield cat.hold('paw', 0.8);
      yield cat.hold('sit', 0.6);
      yield cat.hold('paw', 0.6);
      s.phone.offHook = true;
      s.phone.dangling = true;
      B.audio.play('clatter');
      cat.emote('bang', 1);
      B.log(`${cat.name} knocks the phone off the hook. Nobody can get through now.`);
      yield 0.6;
      yield* cat.goTo('floor', 120); // makes itself scarce
      yield B.rnd(4, 8);
      if (ownerAround(s)) s.request('fix-phone', 2);
    },
  });

  B.catBehaviour({
    id: 'knock-books',
    weight: (s) => (s.shelves.slots.some((b) => b.present && b.y === SURF.shelf.y && b.x < 64) ? 0.35 : 0),
    *run(s, cat) {
      yield* cat.goTo('shelf', B.rnd(24, 56));
      yield cat.hold('sit', 1.2);
      let knocked = 0;
      for (let i = 0; i < B.irnd(1, 3); i++) {
        const row = s.shelves.slots.filter((b) => b.present && b.y === SURF.shelf.y && Math.abs(b.x - cat.x) < 14);
        if (!row.length) break;
        cat.dir = B.pick([-1, 1]);
        yield cat.hold('paw', 0.7);
        const b = B.pick(row);
        b.present = false;
        knocked++;
        s.floorBooks = (s.floorBooks || 0) + 1;
        s.particle({ layer: 'in', x: b.x, y: b.y - b.h, w: b.w + 1, h: Math.min(b.h, 8), c: b.c, vx: cat.dir * 14, vy: -12, vy2: 320, life: 0.55 });
        yield 0.4;
        B.audio.play('thud');
        yield cat.hold('sit', B.rnd(0.8, 1.6)); // looks down at it, unrepentant
      }
      if (knocked) {
        B.log(`${cat.name} pushes ${knocked === 1 ? 'a book' : `${knocked} books`} off the shelf, one paw at a time.`);
        if (ownerAround(s)) s.request('pick-up-books', 2);
      }
      yield B.rnd(1, 3);
    },
  });

  B.catBehaviour({
    id: 'chase-fly',
    weight: (s) => (B.daylight(s.hour) > 0.5 && !s.fly ? 0.8 : 0),
    *run(s, cat) {
      s.fly = { x: B.rnd(90, 170), y: B.rnd(96, 125), tx: 130, ty: 110, t: 0, buzz: 0 };
      yield* cat.goTo('sill', B.clamp(s.fly.x, 80, 180));
      cat.pose = 'sit';
      const dur = B.rnd(8, 16);
      let caught = false;
      for (let t = 0; t < dur && s.fly; t += 0.4) {
        const f = s.fly;
        cat.dir = f.x > cat.x ? 1 : -1;
        cat.lookUp = f.y < cat.y - 24;
        if (Math.abs(f.x - cat.x) < 12 && f.y > cat.y - 34) {
          yield cat.hold(B.chance(0.5) ? 'paw' : 'jump', 0.4);
          if (B.chance(0.18)) {
            caught = true;
            break;
          }
        } else if (B.chance(0.15)) yield cat.walkTo(B.clamp(f.x, 80, 180), 40);
        cat.pose = 'sit';
        yield 0.4;
      }
      cat.lookUp = false;
      if (caught) {
        s.fly = null;
        cat.emote('heart', 1.6);
        B.log(`${cat.name} catches a fly in the window. A mighty hunter.`);
      } else if (s.fly) {
        s.fly.leaving = true;
        cat.emote('what', 1.4);
      }
      yield 1.5;
    },
  });

  B.catBehaviour({
    id: 'hunt-mouse',
    weight: (s) => (!s.mouse ? 0.25 + (s.owner.area !== 'inside' ? 0.3 : 0) : 0),
    *run(s, cat) {
      const fromLeft = B.chance(0.5);
      s.mouse = { x: fromLeft ? 68 : 192, dir: fromLeft ? 1 : -1, run: 0, pause: 1 };
      if (ownerAround(s)) s.request('mouse-panic', 2);
      yield* cat.goTo('sill', fromLeft ? 180 : 80);
      cat.dir = -s.mouse.dir;
      const m = s.mouse;
      yield cat.hold('crouch', B.rnd(1.2, 2.5));
      if (!s.mouse) return;
      yield cat.jumpTo('sill', B.clamp(m.x + m.dir * 6, ...SURF.sill.x));
      if (B.chance(0.35)) {
        s.mouse = null;
        cat.prey = true;
        cat.emote('heart', 1.8);
        B.log(`${cat.name} catches a mouse on the window ledge and looks very pleased with itself.`);
        yield cat.hold('sit', 4);
        yield* cat.goTo('floor', 120);
        cat.prey = false;
      } else {
        m.dir = m.dir || 1;
        m.flee = true;
        cat.emote('what', 1.4);
        B.log('A mouse darts along the window ledge, just out of reach.');
        yield cat.hold('sit', 2);
      }
    },
  });

  B.catBehaviour({
    id: 'greet-mabel',
    weight: (s, cat) => (cat.wantsPets && s.owner.area === 'inside' ? 12 : 0),
    *run(s, cat) {
      yield* cat.goTo('counter', 196);
      cat.dir = -1;
      B.audio.play('meow');
      cat.emote('heart', 1.5);
      for (let t = 0; t < 20 && cat.wantsPets; t++) yield 1;
      cat.wantsPets = false;
      cat.pose = 'loaf';
      yield B.rnd(4, 8);
    },
  });

  // ---------- Mabel's side ----------
  B.activity({
    id: 'fix-phone',
    weight: (s) => (s.phone.dangling ? 8 : 0),
    priority: 2,
    *run(s, o) {
      if (!s.phone.dangling) return;
      yield o.go('phone');
      o.face(-1);
      o.emote('what', 1.2);
      yield 1;
      yield o.hold('crouch', 1);
      s.phone.dangling = false;
      s.phone.offHook = false;
      B.audio.play('click');
      yield o.hold('hips', 1.2);
      o.emote('angry', 1.2);
      B.log(`${name()} puts the phone back on the hook, muttering about cats.`);
      yield 0.8;
    },
  });

  B.activity({
    id: 'pick-up-books',
    weight: (s) => (s.floorBooks ? 8 : 0),
    priority: 2,
    *run(s, o) {
      if (!s.floorBooks) return;
      o.emote('bang', 1);
      yield 0.6;
      yield o.go(B.rnd(24, 56));
      o.face('side');
      yield o.hold('crouch', 1.5);
      s.shelves.add(s.floorBooks);
      s.floorBooks = 0;
      o.face('away');
      yield o.hold('shelve', 1);
      const cat = s.cat;
      if (cat && cat.surface !== 'floor') o.faceX(cat.x);
      o.emote('angry', 1.4);
      yield o.hold('hips', 1.4);
      if (B.chance(0.5)) B.log(`${name()} reshelves the fallen books and has a stern word with ${cat ? cat.name : 'the cat'}.`);
    },
  });

  B.activity({
    id: 'mouse-panic',
    idle: false,
    priority: 2,
    resume: false,
    *run(s, o) {
      yield 0.4;
      if (!s.mouse) return;
      o.faceX(s.mouse.x);
      o.emote('bang', 1.2);
      o.exprOverride = 'surprised';
      yield o.hold('cheer', 1.6);
      o.emote('sweat', 1.4);
      yield o.hold('cross', 1.4);
      B.log(`${name()} spots a mouse and lets out a squeak of her own.`);
      o.exprOverride = null;
    },
  });

  B.activity({
    id: 'pet-cat',
    weight: (s) => (s.cat && s.cat.surface === 'counter' && s.cat.pose !== 'jump' ? 2 + (s.cat.wantsPets ? 8 : 0) : 0),
    cooldown: 10,
    *run(s, o) {
      const cat = s.cat;
      yield o.go(B.clamp(cat.x - 12, 150, 196));
      if (cat.surface !== 'counter') return;
      o.face(1);
      o.emote('heart', 1.4);
      o.pose = 'till'; // stroking motion
      cat.wantsPets = false;
      cat.emote('heart', 2);
      B.audio.play('purr');
      yield 2.5;
      o.pose = 'stand';
      o.moodUp(0.06);
      if (B.chance(0.4)) B.log(`${name()} gives ${cat.name} a scratch behind the ears. Loud purring.`);
      yield 0.6;
    },
  });

  B.on('enter', (s, a) => {
    if (!s.cat) return;
    s.cat.alert = 1;
    if (a === s.owner) s.cat.wantsPets = true;
  });
  B.on('sale', (s, npc) => {
    const cat = s.cat;
    if (cat && cat.surface === 'counter' && npc && !npc.rude && B.chance(0.5)) {
      npc.emote('heart', 1.4);
      cat.emote('heart', 1.4);
      if (B.chance(0.5)) B.log(`The customer gives ${cat.name} a stroke on the way out.`);
    }
  });

  // ---------- world hooks ----------
  B.on('ready', (s) => {
    s.cat = new Cat();
    s.phone.dangling = false;
    s.floorBooks = 0;
  });
  B.on('tick', (s, dt) => {
    const cat = s.cat;
    if (!cat) return;
    cat.update(dt, s);
    const f = s.fly;
    if (f) {
      f.t += dt;
      if (f.leaving) {
        f.tx = 240;
        f.ty = 100;
      } else if (Math.hypot(f.tx - f.x, f.ty - f.y) < 4 || Math.random() < dt * 0.8) {
        f.tx = B.rnd(80, 190);
        f.ty = B.rnd(94, 140);
      }
      f.x += (f.tx - f.x) * Math.min(1, dt * 2.5) + B.rnd(-1, 1);
      f.y += (f.ty - f.y) * Math.min(1, dt * 2.5) + B.rnd(-1, 1);
      if ((f.buzz -= dt) <= 0) {
        f.buzz = 1.2;
        B.audio.play('buzz');
      }
      if (f.x > 215 || f.t > 40) s.fly = null;
    }
    const m = s.mouse;
    if (m) {
      if (m.pause > 0) m.pause -= dt;
      else {
        m.x += m.dir * (m.flee ? 90 : 40) * dt;
        if (!m.flee && Math.random() < dt * 0.6) m.pause = B.rnd(0.4, 1.2);
      }
      if (m.x < 60 || m.x > 196) s.mouse = null; // back behind the display
    }
  });

  // ---------- drawing ----------
  function paintCat(g, cat, cx, fy) {
    const fd = cat.dir || 1;
    const R = (dx, dy, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(fd > 0 ? cx + dx : cx - dx - w, fy + dy, w, h);
    };
    const { fur: F, stripe: D, white: W, eye: E, ink: K, nose: N, ear: P } = C;
    const t = cat.t;
    const osc = (hz, n = 2) => Math.floor(t * hz) % n;
    const face = (hx, hy, closed) => {
      // head block hx..hx+9, hy..hy+6
      R(hx, hy, 10, 7, F);
      R(hx + 1, hy - 1, 8, 1, F);
      R(hx, hy - 3, 2, 3, F);
      R(hx + 1, hy - 4, 1, 1, F);
      R(hx + 7, hy - 3, 2, 3, F);
      R(hx + 7, hy - 4, 1, 1, F);
      R(hx + 1, hy - 2, 1, 1, P);
      R(hx + 7, hy - 2, 1, 1, P);
      R(hx + 3, hy, 1, 2, D);
      R(hx + 5, hy, 1, 2, D);
      R(hx + 3, hy + 4, 5, 2, W);
      if (closed) {
        R(hx + 2, hy + 3, 2, 1, D);
        R(hx + 6, hy + 3, 2, 1, D);
      } else {
        const up = cat.lookUp ? -1 : 0;
        R(hx + 2, hy + 2, 2, 2, E);
        R(hx + 6, hy + 2, 2, 2, E);
        R(hx + 3, hy + 2 + (up ? 0 : 1) + up, 1, 1, K);
        R(hx + 7, hy + 2 + (up ? 0 : 1) + up, 1, 1, K);
      }
      R(hx + 5, hy + 4, 1, 1, N);
      R(hx + 10, hy + 4, 2, 1, '#e8e2d0');
      R(hx - 2, hy + 4, 2, 1, '#e8e2d0');
      if (cat.prey) {
        R(hx + 6, hy + 6, 4, 2, '#8a8a8a');
        R(hx + 10, hy + 7, 3, 1, '#b08a8a');
      }
    };
    switch (cat.pose) {
      case 'sleep':
      case 'loaf': {
        const breathe = cat.pose === 'sleep' && osc(0.6) ? 1 : 0;
        R(-9, -7 - breathe, 16, 7 + breathe, F);
        R(-8, -8 - breathe, 14, 1, F);
        R(-6, -7 - breathe, 1, 3, D);
        R(-3, -8 - breathe, 1, 3, D);
        R(0, -8 - breathe, 1, 3, D);
        if (cat.pose === 'sleep') face(3, -8, true);
        else face(3, -13, osc(0.4, 4) === 0);
        R(-9, -2, 13, 2, F);
        R(2, -2, 3, 2, D);
        R(6, -1, 4, 1, W);
        break;
      }
      case 'walk': {
        const f = osc(8);
        R(-10, -15 + f, 2, 7, F);
        R(-11, -16 + f, 2, 2, D);
        R(-8, -10, 15, 6, F);
        R(-5, -10, 1, 4, D);
        R(-2, -10, 1, 4, D);
        R(1, -10, 1, 4, D);
        for (const [x, o] of [[-7, -f], [-4, f], [2, f], [5, -f]]) {
          R(x + o, -4, 2, 3, F);
          R(x + o, -1, 2, 1, W);
        }
        face(4, -15, false);
        break;
      }
      case 'crouch': {
        const wig = osc(6);
        R(-14, -5, 6, 2, F);
        R(-15, -5, 2, 2, D);
        R(-8 + wig, -7, 15, 6, F);
        R(-5 + wig, -7, 1, 3, D);
        R(-1, -7, 1, 3, D);
        R(4, -2, 4, 2, W);
        face(4, -12, false);
        break;
      }
      case 'jump':
        R(-15, -11, 7, 2, F);
        R(-16, -11, 2, 2, D);
        R(-8, -10, 17, 5, F);
        R(-4, -10, 1, 3, D);
        R(0, -10, 1, 3, D);
        R(-11, -6, 4, 2, F);
        R(9, -8, 4, 2, W);
        face(6, -15, false);
        break;
      case 'stretch':
        R(-10, -17, 2, 8, F);
        R(-8, -11, 8, 5, F);
        R(-1, -8, 8, 4, F);
        R(-7, -6, 2, 6, F);
        R(-4, -6, 2, 6, F);
        R(6, -3, 6, 2, F);
        R(10, -1, 3, 1, W);
        face(7, -10, true);
        R(12, -5, 1, 1, K);
        break;
      default: {
        // sit, paw, groom
        const tail = osc(1.2) ? -1 : 0;
        R(-9, -3, 4, 2, F);
        R(-10, -6 + tail, 2, 4, F);
        R(-10, -7 + tail, 2, 1, D);
        R(-5, -10, 7, 1, F);
        R(-6, -9, 9, 9, F);
        R(-7, -5, 3, 5, F);
        R(-4, -8, 1, 3, D);
        R(-2, -9, 1, 3, D);
        R(-6, -4, 1, 2, D);
        R(0, -8, 3, 7, W);
        R(0, -1, 2, 1, W);
        const groom = cat.pose === 'groom';
        if (cat.pose === 'paw') R(3, -10 - osc(5) * 3, 2, 6, W);
        else if (groom) R(4, -12 + osc(3), 2, 5, W);
        else R(3, -1, 2, 1, W);
        face(-1, groom ? -14 : cat.lookUp ? -17 : -16, groom && osc(3));
      }
    }
  }

  function drawCat(g, s, layer) {
    const cat = s.cat;
    if (!cat || cat.layer !== layer) return;
    B.blit(g, cat.x, cat.y, (bg, cx, fy) => paintCat(bg, cat, cx, fy));
  }
  for (const layer of ['interior-back', 'counter', 'interior-front']) {
    B.decor({ id: `cat-${layer}`, layer, draw: (g, s) => drawCat(g, s, layer) });
  }

  // fly, mouse, dangling receiver
  B.decor({
    id: 'cat-critters',
    layer: 'interior-front',
    draw(g, s) {
      const f = s.fly;
      if (f) {
        B.px(g, '#1e1a1a', Math.round(f.x), Math.round(f.y), 2, 1);
        B.px(g, 'rgba(255,255,255,0.8)', Math.round(f.x) + (Math.floor(s.simT * 20) % 2), Math.round(f.y) - 1, 1, 1);
      }
      const m = s.mouse;
      if (m) {
        const x = Math.round(m.x);
        const y = 143;
        const d = m.dir;
        const R = (dx, dy, w, h, c) => B.px(g, c, d > 0 ? x + dx : x - dx - w, y + dy, w, h);
        R(-3, -3, 6, 3, '#8a8a8a');
        R(3, -3, 2, 2, '#8a8a8a');
        R(5, -2, 1, 1, '#e8889a');
        R(2, -4, 2, 1, '#e8a0a8');
        R(4, -3, 1, 1, '#1e1a1a');
        R(-7, -1, 4, 1, '#b08a8a');
        if (m.pause <= 0 && Math.floor(s.simT * 12) % 2) R(-2, 0, 1, 1, '#6a6a6a');
      }
    },
  });
  B.decor({
    id: 'cat-bubble',
    layer: 'overlay',
    draw(g, s) {
      const cat = s.cat;
      if (cat && cat.emoteKind && cat.surface !== 'floor') B.drawBubble(g, cat.x, cat.headTop, cat.emoteKind);
    },
  });
  B.decor({
    id: 'dangling-receiver',
    layer: 'counter',
    when: (s) => s.phone.dangling,
    draw(g, s) {
      const sw = Math.round(Math.sin(s.simT * 2) * 1.5);
      B.line(g, 150, 122, 151 + sw, 130, '#7a1f1a');
      B.px(g, '#9c2b23', 149 + sw, 130, 3, 9);
      B.px(g, '#7a1f1a', 148 + sw, 138, 5, 2);
    },
  });
})(window.Bookshop);
