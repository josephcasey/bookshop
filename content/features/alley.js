/* goings-on in the alley beside the shop.
 *  - Bin day: every other morning the bin lorry pulls up; a binman wheels the dustbin out and tips it.
 *  - After dark, a mugger may lurk at the alley mouth and snatch someone's bag; Mabel rings the police
 *    and an officer comes by to look down the alley.
 *  - Teenagers hang about smoking after school; Mabel sometimes comes out to shoo them off.
 *  - Late at night a woman in a long coat waits at the corner, chatting up passers-by.
 *  - Dog walkers use the alley as a cut-through.
 *  - Some nights someone sleeps rough in the alley; in the morning Mabel takes them a cup of tea.
 *  - A fox raids the dustbin at night and knocks it over; someone else rummages through it for anything useful.
 * Figures further down the alley are drawn smaller, to sit at the right depth. */
(function (B) {
  const name = () => B.ownerName();
  const AX = () => B.LAYOUT.alleyX;
  const alley = (s) => (s.alley = s.alley || { binAway: false, binTipped: false });
  const isNight = (h) => h >= 22 || h < 5;
  const sceneFree = (s) => !s.alleyScene || s.simT > s.alleyScene.until;
  const setScene = (s, id, sec) => (s.alleyScene = { id, until: s.simT + sec });
  const forever = function* () {
    for (;;) yield 1;
  };

  // ---------- sounds ----------
  const D = B.audio.define;
  const pan = (x) => B.clamp(x / 160 - 1, -0.9, 0.9);
  D('lorryEngine', ({ noise, tone, street }, x) => {
    noise(1.3, { ftype: 'lowpass', freq: 160, q: 1.2, vol: 0.06, a: 0.2, r: 0.3, pan: pan(x), bus: street });
    tone(48, 1.3, { type: 'sawtooth', vol: 0.02, lp: 220, pan: pan(x), bus: street });
  });
  D('brakeHiss', ({ noise, street }, x) => noise(0.7, { ftype: 'highpass', freq: 3000, vol: 0.03, a: 0.02, r: 0.5, pan: pan(x), bus: street }));
  D('hydraulic', ({ tone, noise, street }, x) => {
    tone(180, 1.4, { type: 'sawtooth', vol: 0.02, slide: 420, lp: 900, pan: pan(x), bus: street });
    noise(1.4, { freq: 600, vol: 0.02, a: 0.3, pan: pan(x), bus: street });
  });
  D('binClatter', ({ tone, noise, street }, x) => {
    noise(0.25, { freq: 1500, q: 0.7, vol: 0.06, pan: pan(x), bus: street });
    tone(260, 0.2, { type: 'square', vol: 0.02, lp: 1500, pan: pan(x), bus: street });
    tone(190, 0.3, { type: 'square', vol: 0.02, lp: 1500, at: 0.15, pan: pan(x), bus: street });
  });
  D('shout', ({ tone, noise, street }, x) => {
    tone(330, 0.3, { type: 'sawtooth', vol: 0.04, slide: 240, lp: 1600, pan: pan(x), bus: street });
    noise(0.25, { freq: 900, q: 2, vol: 0.02, pan: pan(x), bus: street });
  });
  D('lighter', ({ tone, noise, street }, x) => {
    tone(2400, 0.02, { type: 'square', vol: 0.02, pan: pan(x), bus: street });
    noise(0.3, { freq: 900, q: 0.8, vol: 0.015, at: 0.05, pan: pan(x), bus: street });
  });
  D('laugh', ({ tone, street }, x) => {
    for (let i = 0; i < 5; i++) tone(340 - i * 10, 0.08, { type: 'sawtooth', vol: 0.012, at: i * 0.12, lp: 1400, pan: pan(x), bus: street });
  });
  D('foxScream', ({ tone, street }) => {
    const p = B.rnd(-0.6, 0.9);
    tone(1300, 0.7, { type: 'sawtooth', vol: 0.012, slide: 700, a: 0.05, lp: 2400, pan: p, bus: street });
    tone(1250, 0.6, { type: 'sawtooth', vol: 0.01, slide: 650, a: 0.05, at: 0.9, lp: 2400, pan: p, bus: street });
  });

  // ---------- helpers ----------
  function npc(s, look, x, props = {}) {
    const n = new B.NPC({ x, dir: -1, exitX: B.LAYOUT.edgeL - 2, lane: -3, speed: B.rnd(34, 46), kind: 'alley', umbrella: B.chance(0.8), umbrellaC: B.pick(B.lookParts.umbrella) });
    n.look = typeof look === 'string' ? B.looks[look] : look;
    Object.assign(n, props);
    n.script = new B.Script(forever(), { id: 'alley-held' }); // the scene drives them; this stops auto-leaving
    s.npcs.push(n);
    return n;
  }
  function done(n, next) {
    // hand an NPC back to normal life: a final generator or action, after which they leave
    const gen = !next ? n.leave(B.world) : typeof next.next === 'function' ? next : (function* () {
      yield next;
    })();
    n.script = new B.Script(gen, { id: 'alley-done' });
  }
  function* intoAlley(n) {
    yield n.walkTo(AX());
    n.face('away');
    yield n.fade(0, 0.6);
    n.hidden = true;
    n.leaving = true;
  }
  function* outOfAlley(n, toX) {
    n.x = AX();
    n.alpha = 0;
    n.hidden = false;
    n.lane = -3;
    yield [n.walkTo(toX), n.fade(1, 0.6)];
  }
  const passers = (s, near, r, except) =>
    s.npcs.filter((n) => n.area === 'street' && !n.hidden && n.alpha > 0.8 && n.kind !== 'alley' && n.kind !== 'street-sweeper' && n !== except && Math.abs(n.x - near) < r);

  // draw something at alley depth: paint it full size into a scratch canvas, then shrink it
  let tmp = null;
  function drawScaled(g, x, y, sc, paint) {
    if (!tmp) {
      tmp = document.createElement('canvas');
      tmp.width = 80;
      tmp.height = 120;
    }
    const tg = tmp.getContext('2d');
    tg.clearRect(0, 0, 80, 120);
    paint(tg);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, Math.round(x - 40 * sc), Math.round(y - 112 * sc), Math.round(80 * sc), Math.round(120 * sc));
  }
  function drawPersonAt(g, a, x, y) {
    const sc = B.ALLEY.scaleAt(y);
    drawScaled(g, x, y, sc, (tg) => {
      const proxy = Object.create(a);
      Object.defineProperty(proxy, 'x', { value: 40 });
      Object.defineProperty(proxy, 'y', { value: 112 });
      proxy.alpha = 1;
      proxy.hidden = false;
      proxy.area = 'alley';
      proxy.moving = !!a.alleyMoving;
      B.drawPerson(tg, proxy);
    });
  }

  // ---------- the bin lorry ----------
  B.look('binman', { skin: '#e0ac85', hair: '#b07a3c', hairStyle: 'short', top: '#f08c00', top2: '#e8e03a', bottom: '#1f2a44', shoes: '#1e1a1a', hat: '#1f3a33', hatStyle: 'cap', h: 1 });

  B.happening({
    id: 'bin-lorry',
    perHour: 30,
    when: (s) => s.day % 2 === 0 && s.hour >= 7.3 && s.hour < 8.5 && !s.flags.binLorry,
    *run(s) {
      s.flags.binLorry = true;
      const Lr = (s.lorry = { x: 330, until: s.simT + 90, bin: null });
      B.log('The bin lorry rumbles up the street, amber light flashing.');
      yield B.act.tween(Lr, 'x', 98, 6); // cab facing left; its back end stops just short of the alley
      B.audio.play('brakeHiss', 270);
      yield 0.6;
      const bm = npc(s, 'binman', 278, { alpha: 0, dir: 1, speed: 44, umbrella: false });
      yield bm.fade(1, 0.3); // hops down off the back step
      if (B.chance(0.5)) bm.emote('note', 1.5);
      yield bm.walkTo(AX());
      bm.face('away');
      yield bm.fade(0, 0.5);
      alley(s).binAway = true;
      alley(s).binTipped = false;
      yield 2;
      // back out, wheeling the bin
      Lr.bin = { x: AX() - 4, tilt: 0 };
      bm.face(-1);
      yield bm.fade(1, 0.5);
      yield bm.walkTo(288);
      yield bm.hold('carry', 0.5);
      B.audio.play('hydraulic', 280);
      yield B.act.tween(Lr.bin, 'tilt', 1, 1.2);
      for (let i = 0; i < 10; i++) s.particle({ layer: 'out', x: 272 + B.rnd(-3, 3), y: 126, vx: B.rnd(-12, -4), vy: B.rnd(4, 14), vy2: 50, life: 0.8, c: B.pick(['#e8e4da', '#b08850', '#6a8a4a', '#c0392b']) });
      yield 1;
      yield B.act.tween(Lr.bin, 'tilt', 0, 1);
      if (B.chance(0.6)) B.dropLitter(s, B.rnd(262, 290)); // a bit always escapes
      yield bm.walkTo(AX());
      bm.face('away');
      yield bm.fade(0, 0.5);
      Lr.bin = null;
      alley(s).binAway = false;
      yield 1;
      bm.face(-1);
      yield bm.fade(1, 0.4);
      yield bm.walkTo(278);
      yield bm.fade(0, 0.3); // back on the step
      bm.hidden = true;
      bm.leaving = true;
      bm.script = null;
      yield 0.5;
      yield B.act.tween(Lr, 'x', -200, 5);
      s.lorry = null;
    },
  });

  // A proper-sized bin lorry (taller than a person), cab facing left, x = its front bumper.
  function drawLorry(g, s) {
    const Lr = s.lorry;
    if (!Lr) return;
    const x = Math.round(Lr.x);
    const P = (c, dx, y, w, h) => B.px(g, c, x + dx, y, w, h);
    // body
    P('#3b8a4a', 40, 100, 110, 68);
    P('#4f9a5a', 40, 100, 110, 3);
    P('#2e6b3a', 40, 165, 110, 3);
    for (let i = 1; i < 5; i++) P('#2e6b3a', 40 + i * 22, 104, 1, 58);
    P('#e8e03a', 82, 112, 22, 22);
    P('#3b8a4a', 86, 116, 14, 14);
    P('#e8e03a', 91, 118, 4, 10);
    B.text(g, 'CITY', x + 78, 140, '#f4efe6', 1);
    B.text(g, 'WASTE', x + 64, 148, '#f4efe6', 2);
    P('#e8e03a', 0, 160, 178, 3);
    // cab
    P('#2e6b3a', 0, 110, 40, 60);
    P('#3b8a4a', 2, 110, 36, 2);
    P('#9fc3d8', 5, 116, 22, 20);
    P('#c8dcea', 6, 117, 3, 18);
    P('#2b2b2b', 15, 121, 8, 15); // the driver
    P('#e0ac85', 16, 121, 5, 5);
    P('#1e1e22', -4, 118, 3, 12); // mirror
    P('#1f4a2a', 0, 142, 7, 14);
    for (let y = 144; y < 156; y += 3) P('#16341e', 1, y, 5, 1);
    P('#fff2b0', 0, 157, 4, 4);
    P('#5a5e64', -2, 166, 44, 6);
    P(Math.floor(s.simT * 4) % 2 ? '#ffb020' : '#8a5a10', 14, 104, 10, 6); // beacon
    // compactor at the back, with its hopper and warning chevrons
    P('#1f4a2a', 150, 104, 28, 68);
    P('#101014', 156, 128, 18, 24);
    P('#2a2a30', 156, 128, 18, 3);
    for (let i = 0; i < 17; i++) P(i % 2 ? '#e8e03a' : '#1e1e22', 174, 104 + i * 4, 4, 4);
    P('#d43b3b', 151, 154, 3, 5);
    P('#5a5e64', 150, 166, 28, 4); // the step the binman rides on
    // wheels
    const spin = Math.floor(Lr.x / 4) % 2;
    for (const wx of [22, 104, 128]) {
      P('#1e1e22', wx - 6, 167, 13, 13);
      P('#1e1e22', wx - 7, 169, 15, 9);
      P('#6a6e74', wx - 3, 171, 7, 5);
      P('#2a2a30', wx - 1 + spin * 2 - 1, 172 + spin, 2, 2);
    }
    if (B.daylight(s.hour) < 0.5) {
      g.globalCompositeOperation = 'lighter';
      B.px(g, 'rgba(255,176,32,0.25)', x + 6, 96, 26, 20);
      g.globalCompositeOperation = 'source-over';
    }
  }
  function drawWheelieBin(g, s) {
    const bin = s.lorry && s.lorry.bin;
    if (!bin) return;
    const lift = Math.round(bin.tilt * 22);
    const lean = Math.round(bin.tilt * 12);
    const x = Math.round(bin.x) - lean;
    const y = 150 - lift;
    B.px(g, '#4a5a4a', x, y, 11, 18);
    B.px(g, '#5a6a5a', x + 1, y, 2, 18);
    B.px(g, '#3a4a3a', x - 1, y - 2, 13, 3);
    if (bin.tilt > 0.5) B.line(g, x - 1, y - 2, x - 6, y - 10, '#3a4a3a'); // lid swinging open
    B.px(g, '#1e1e22', x + 1, y + 16, 3, 3);
    B.px(g, '#1e1e22', x + 7, y + 16, 3, 3);
  }

  // ---------- after dark: a mugging ----------
  B.look('hoodie', { skin: '#c68a62', hair: '#1b1b22', hairStyle: 'short', top: '#2b2b30', bottom: '#2c3440', hat: '#1e1e22', hatStyle: 'beanie', hat2: '#1e1e22', h: 1 });
  B.look('police', { skin: '#e0ac85', hair: '#4a3021', hairStyle: 'short', top: '#1f2a44', top2: '#e8e03a', bottom: '#1f2a44', shoes: '#1e1a1a', hat: '#1f2a44', hatStyle: 'bowler', h: 2 });

  B.happening({
    id: 'mugging',
    perHour: 0.06,
    when: (s) => (s.hour >= 18 || s.hour < 1) && B.config.crowd > 0 && sceneFree(s),
    *run(s) {
      setScene(s, 'mugger', 120);
      const m = npc(s, 'hoodie', AX(), { speed: 40, umbrella: false });
      yield* outOfAlley(m, 290);
      m.face(-1);
      m.pose = 'cross';
      let victim = null;
      for (let t = 0; t < 60 && !victim; t += 0.5) {
        yield 0.5;
        const v = passers(s, m.x, 44, m).find((n) => n.moving && !n.dog);
        if (v && B.chance(0.5)) victim = v;
      }
      if (!victim) {
        yield* intoAlley(m);
        s.alleyScene = null;
        return;
      }
      // the snatch
      m.pose = 'stand';
      m.hurry = true;
      yield m.walkTo(victim.x + (victim.x > m.x ? -6 : 6));
      victim.emote('bang', 1.5);
      victim.exprOverride = 'surprised';
      m.holding = 'bag';
      victim.holding = null;
      B.audio.play('shout', victim.x);
      m.speed = 110;
      B.log('A hooded figure darts out of the alley, snatches a bag and legs it back down the alley!');
      done(victim, (function* () {
        victim.face(victim.x < AX() ? 1 : -1);
        yield victim.hold('point', 1.6);
        victim.exprOverride = 'angry';
        victim.emote('angry', 1.5);
        yield victim.hold('facepalm', 1.5);
        victim.exprOverride = null;
        yield victim.walkOff();
      })());
      yield* intoAlley(m);
      s.alleyScene = null;
      // Mabel saw it
      const o = s.owner;
      if (o.area === 'inside' || o.area === 'upstairs') s.request('report-crime', 4.5);
    },
  });

  B.activity({
    id: 'report-crime',
    idle: false,
    priority: 4.5,
    resume: false,
    *run(s, o) {
      o.emote('bang', 1.2);
      o.exprOverride = 'surprised';
      yield 1;
      if (o.area === 'inside') {
        yield o.go('phone', { speed: 1.4 });
        o.face(-1);
        o.holding = 'receiver';
        s.phone.offHook = true;
      } else {
        o.face(0);
        o.holding = 'mobile';
      }
      o.exprOverride = 'worried';
      yield* B.talk(o, 5);
      B.log(`${name()} rings the police about the bag snatch.`);
      o.holding = null;
      s.phone.offHook = false;
      o.exprOverride = null;
      s.policeDue = s.simT + B.rnd(15, 35);
    },
  });

  B.visitor({
    id: 'police-officer',
    spawn: false,
    look: 'police',
    setup(n) {
      n.speed = 30;
      n.umbrella = false;
      n.kind = 'police';
    },
    *run(s, n) {
      yield n.walkTo(AX() - 8);
      n.face('away');
      yield 2; // peers down the alley (with a torch, if it's dark)
      n.face(-1);
      yield n.hold('write', 3);
      if (s.owner.area === 'inside') {
        s.owner.faceX(240);
        s.owner.emote('talk', 1.5);
        n.emote('talk', 1.5);
        yield 1.6;
      }
      B.log('A police officer comes by, takes a look down the alley and notes a few things down.');
      yield* intoAlley(n);
    },
  });

  // ---------- teenagers ----------
  const teenLook = () =>
    B.randomLook({ h: -1, beard: null, glasses: false, dress: false, top: B.pick(['#2b2b30', '#5a2a6a', '#1f3350', '#8c2f2f', '#3c6e47']), bottom: B.pick(['#2c3440', '#1f2a44']), hat: B.chance(0.5) ? B.pick(['#1e1e22', '#b33a3a']) : null, hatStyle: 'cap' });

  B.happening({
    id: 'teens-smoking',
    perHour: 0.4,
    when: (s) => s.hour >= 15.5 && s.hour < 22 && B.config.crowd > 0 && sceneFree(s),
    *run(s) {
      setScene(s, 'teens', 120);
      const spots = [284, 296, 308];
      const teens = [];
      for (let i = 0; i < B.irnd(2, 3); i++) teens.push(npc(s, teenLook(), AX(), { alpha: 0, lane: [-3, -2, -3][i], umbrella: false }));
      yield teens.map((t, i) => [t.walkTo(spots[i]), t.fade(1, 0.6)]);
      teens.forEach((t, i) => t.face(i === 0 ? 1 : -1));
      const smoker = teens[0];
      smoker.holding = 'cig';
      B.audio.play('lighter', smoker.x);
      B.log('A gang of teenagers hangs about at the mouth of the alley, smoking.');
      let requested = false;
      const dur = B.rnd(30, 60);
      for (let t = 0; t < dur && !s.teensShooed; t += 1.5) {
        const k = B.pick(teens);
        const r = Math.random();
        if (r < 0.35) k.emote('talk', 1.2);
        else if (r < 0.5) {
          k.emote('spark', 1.2);
          B.audio.play('laugh', k.x);
        } else if (r < 0.65) k.pose = B.pick(['cross', 'hips', 'shrug', 'stand']);
        if (Math.random() < 0.4) {
          smoker.pose = 'smoke';
          yield 1.2;
          smoker.pose = 'stand';
          t += 1.2;
        }
        yield 1.5;
        const o = s.owner;
        if (!requested && t > 18 && s.shop.open && o.area === 'inside' && o.pose !== 'sleep' && B.chance(0.2)) {
          requested = true;
          s.request('shoo-teens', 5.3);
        }
      }
      if (B.chance(0.5)) B.dropLitter(s, B.rnd(282, 312), B.pick(['crisps', 'wrapper', 'can']));
      teens.forEach((t, i) => {
        t.pose = 'stand';
        t.holding = null;
        done(t, i % 2 === 0 ? intoAlley(t) : t.walkOff());
      });
      s.teensShooed = false;
      s.alleyScene = null;
    },
  });

  B.activity({
    id: 'shoo-teens',
    idle: false,
    priority: 5.3,
    resume: false,
    *run(s, o) {
      yield o.go('door');
      yield* o.exit(s);
      o.lane = 0;
      yield o.walkTo(268);
      o.face(1);
      o.emote('angry', 1.4);
      yield o.hold('hips', 1.2);
      yield o.hold('point', 1.5);
      B.log(`${name()} comes out and tells the teenagers to take their smoking elsewhere.`);
      s.teensShooed = true;
      for (const t of s.npcs.filter((n) => n.kind === 'alley' && n.area === 'street')) t.emote(B.pick(['dots', 'angry']), 1.2);
      yield 1.5;
      yield o.walkTo(B.LAYOUT.doorX);
      yield s.door.pass(o, 'in');
      o.depth = 'back';
    },
  });

  // ---------- the woman at the corner ----------
  B.happening({
    id: 'corner-woman',
    perHour: 0.35,
    when: (s) => (s.hour >= 22 || s.hour < 1.5) && B.config.crowd > 0 && sceneFree(s),
    *run(s) {
      setScene(s, 'lady', 150);
      const look = B.randomLook({ hairStyle: 'long', top: '#8c2f4a', top2: null, bottom: '#1e1e22', dress: true, tights: '#2b2226', shoes: '#b3322a', scarf: '#e8a0b8', beard: null, hat: null, glasses: false, h: 0 });
      const w = npc(s, look, B.LAYOUT.edgeR, { dir: -1, umbrella: true });
      yield w.walkTo(313); // by the corner, leaving the alley mouth clear
      w.face(-1);
      w.pose = 'hips';
      B.log('A woman in a long coat waits at the corner of the alley, trying her luck with the late-night passers-by.');
      const asked = new Set();
      for (let t = 0; t < 110; t += 0.5) {
        yield 0.5;
        if (s.npcs.some((n) => n.kind === 'police' && n.area === 'street')) break; // melts away if the police turn up
        const p = passers(s, w.x, 34, w).find((n) => n.moving && !asked.has(n));
        if (!p) continue;
        asked.add(p);
        w.pose = 'stand';
        w.faceX(p.x);
        w.emote('talk', 1.4);
        if (B.chance(0.15)) {
          // a taker: they talk, then leave together along the street
          done(p, (function* () {
            p.faceX(w.x);
            yield* B.talk(p, 3, w);
            yield p.walkOff();
          })());
          yield 3.5;
          w.exitX = p.exitX;
          B.log('She leaves with one of them.');
          break;
        }
        p.emote(B.pick(['dots', 'what', 'dots']), 1.2);
        yield 1.5;
        w.pose = 'hips';
        w.face(-1);
      }
      w.pose = 'stand';
      done(w, w.walkOff());
      s.alleyScene = null;
    },
  });

  // ---------- dog walkers cutting through ----------
  B.visitor({
    id: 'alley-dog-walk',
    weight: (s) => (s.hour >= 6.5 && s.hour < 23 ? 0.5 : 0.1),
    setup(n) {
      n.speed = B.rnd(30, 40);
      n.dog = { c: B.pick(B.lookParts.dog), x: n.x - 20 * n.dir, y: B.LAYOUT.streetY, sniff: 0 };
    },
    *run(s, n) {
      if (B.chance(0.5)) {
        // comes up the alley with the dog, and heads off along the street
        n.exitX = B.chance(0.5) ? B.LAYOUT.edgeL - 2 : B.LAYOUT.edgeR + 2;
        n.dog.x = AX();
        yield* outOfAlley(n, AX() + (n.exitX > AX() ? 16 : -16));
        n.dog.sniff = 2;
        yield 2; // a good sniff at the corner
        yield n.walkOff();
      } else {
        yield n.walkTo(AX() + (n.dir > 0 ? -12 : 12));
        n.dog.sniff = 2.5;
        yield 2.5;
        yield* intoAlley(n);
      }
    },
  });

  // ---------- sleeping rough ----------
  B.on('newDay', (s) => {
    s.flags.sleeperTonight = B.chance(0.35);
  });
  const roughLook = () => B.randomLook({ hat: B.pick(['#8c3b3b', '#3c6e47', '#1f3350']), hatStyle: 'beanie', top: B.pick(['#5a5040', '#4a4e40', '#6a4a3a']), scarf: B.pick(['#7a6a4a', '#8c2f2f']), bottom: '#3d3a35', beard: B.chance(0.6) ? '#6a5a4a' : null, dress: false });

  B.happening({
    id: 'rough-sleeper',
    perHour: 6,
    when: (s) => s.hour >= 22.5 && s.flags.sleeperTonight && !s.flags.sleeperCame && !s.sleeper,
    *run(s) {
      s.flags.sleeperCame = true;
      const look = roughLook();
      const n = npc(s, look, B.chance(0.5) ? B.LAYOUT.edgeL : B.LAYOUT.edgeR, { speed: 26, holding: 'bag', umbrella: false });
      n.dir = n.x < AX() ? 1 : -1;
      yield* intoAlley(n);
      s.sleeper = { look, dog: B.chance(0.35), tea: false, t: 0 };
      B.log('Someone beds down for the night in the alley, on flattened cardboard in a sleeping bag.');
    },
  });

  function paintSleeper(tg, sl, t, cx = 40, fy = 112) {
    const P = (c, x, y, w, h) => B.px(tg, c, cx + x, fy + y, w, h);
    const breathe = Math.floor(t * 0.6) % 2;
    P('#b08850', -16, -2, 34, 2); // cardboard
    P('#5a6a3a', -12, -8 - breathe, 24, 7 + breathe); // sleeping bag
    P('#6a7a4a', -11, -8 - breathe, 22, 1);
    for (let x = -8; x < 10; x += 5) P('#4a5a2a', x, -7, 1, 5);
    P(sl.look.skin, 12, -9, 5, 5); // head
    P(sl.look.hat || '#8c3b3b', 12, -11, 5, 3);
    P('#1e1a1a', 15, -7, 2, 1); // eyes shut
    if (sl.look.beard) P(sl.look.beard, 12, -6, 5, 2);
    P('#3a4a6a', -19, -6, 5, 6); // bag of belongings
    if (sl.tea) {
      P('#f3efe6', 19, -5, 3, 4);
      if (Math.floor(t * 2) % 2) P('rgba(255,255,255,0.6)', 20, -8, 1, 2);
    }
    if (sl.dog) {
      P('#8a5a34', -26, -5, 8, 5);
      P('#8a5a34', -21, -7, 4, 3);
      P('#5a3a20', -21, -7, 1, 2);
    }
  }

  B.activity({
    id: 'bring-tea',
    priority: 5.3,
    resume: false,
    weight: (s) => (s.sleeper && !s.sleeper.tea && s.hour < 9.4 ? 6 : 0),
    *run(s, o) {
      yield o.go('coffee');
      o.face('away');
      s.coffee.brew(3);
      yield B.act.until(() => s.coffee.brewing <= 0, 6);
      o.holding = 'cup';
      yield o.go('door');
      yield* o.exit(s);
      o.lane = -3;
      yield o.walkTo(AX());
      o.face('away');
      yield o.fade(0, 0.5);
      yield 3;
      if (s.sleeper) s.sleeper.tea = true;
      o.holding = null;
      yield o.fade(1, 0.5);
      o.emote('heart', 1.5);
      B.log(`${name()} takes a cup of tea out to the person sleeping in the alley.`);
      yield o.walkTo(B.LAYOUT.doorX);
      yield s.door.pass(o, 'in');
      o.depth = 'back';
      o.lane = 0;
    },
  });

  // ---------- bin raiders ----------
  function paintFox(tg, f, t, cx = 40, fy = 112) {
    const d = f.dir || 1;
    const P = (c, x, y, w, h) => {
      tg.fillStyle = c;
      tg.fillRect(d > 0 ? cx + x : cx - x - w, fy + y, w, h);
    };
    const F = '#c8581e';
    const trot = f.pose === 'trot' ? Math.floor(t * 10) % 2 : 0;
    P(F, -13, -10 + trot, 7, 3); // tail
    P('#f4efe6', -15, -10 + trot, 2, 3);
    P(F, -7, -9, 13, 5);
    P('#f4efe6', 3, -6, 4, 2);
    for (const [x, o] of [[-6, trot], [-3, -trot], [2, trot], [5, -trot]]) P('#2b1d14', x + o, -4, 1, 4);
    const down = f.pose === 'rummage' ? (Math.floor(t * 5) % 2 ? 5 : 3) : 0;
    P(F, 5, -13 + down, 6, 5); // head
    P('#2b1d14', 5, -15 + down, 2, 2);
    P('#2b1d14', 9, -15 + down, 2, 2);
    P(F, 10, -11 + down, 3, 2);
    P('#1e1a1a', 12, -11 + down, 1, 1);
    P('#1e1a1a', 8, -12 + down, 1, 1);
  }

  B.happening({
    id: 'fox',
    perHour: 0.5,
    when: (s) => isNight(s.hour) && !s.fox && !alley(s).binAway,
    *run(s) {
      const f = (s.fox = { x: 299, y: 134, inAlley: true, pose: 'trot', dir: 1, t: 0, until: s.simT + 120 });
      yield [B.act.tween(f, 'y', 146, 3), B.act.tween(f, 'x', 297, 3)];
      f.pose = 'stand';
      yield 1;
      if (!alley(s).binTipped) {
        B.audio.play('binClatter', 305);
        alley(s).binTipped = true;
        for (let i = 0; i < B.irnd(2, 3); i++) B.dropLitter(s, B.rnd(284, 314));
        B.log('A fox knocks over the dustbin in the alley and noses through the rubbish.');
      }
      f.pose = 'rummage';
      yield B.rnd(6, 12);
      if (B.chance(0.4)) B.audio.play('foxScream');
      // out onto the street and away
      f.pose = 'trot';
      yield [B.act.tween(f, 'y', 163, 1.5), B.act.tween(f, 'x', 299, 1.5)];
      f.inAlley = false;
      f.y = 172;
      f.dir = B.pick([-1, 1]);
      yield B.act.tween(f, 'x', f.dir > 0 ? 350 : -30, 5);
      s.fox = null;
    },
  });

  B.happening({
    id: 'bin-rummager',
    perHour: 0.25,
    when: (s) => s.hour >= 20 && s.hour < 24 && B.config.crowd > 0 && sceneFree(s) && !alley(s).binAway,
    *run(s) {
      setScene(s, 'rummager', 90);
      const n = npc(s, roughLook(), B.chance(0.5) ? B.LAYOUT.edgeL : B.LAYOUT.edgeR, { speed: 30, umbrella: false });
      n.dir = n.x < AX() ? 1 : -1;
      yield n.walkTo(AX());
      n.face('away');
      yield n.fade(0, 0.5);
      n.hidden = true;
      n.inAlley = { x: 301, y: 147 }; // now drawn small, at the bin
      n.backView = true;
      n.pose = 'browse';
      B.audio.play('binClatter', 305);
      yield B.rnd(8, 15);
      if (B.chance(0.5)) B.log('Someone rummages through the dustbin in the alley, and comes away with a carrier bag of finds.');
      n.inAlley = null;
      n.backView = false;
      n.pose = 'stand';
      n.hidden = false;
      n.holding = 'bag';
      n.exitX = B.chance(0.5) ? B.LAYOUT.edgeL - 2 : B.LAYOUT.edgeR + 2;
      yield n.fade(1, 0.5);
      done(n, n.walkOff());
      s.alleyScene = null;
    },
  });

  // ---------- drawing ----------
  B.decor({
    id: 'alley-life',
    layer: 'alley',
    draw(g, s) {
      const t = s.simT;
      if (s.sleeper) drawScaled(g, 296, 152, B.ALLEY.scaleAt(152), (tg) => B.blit(tg, 40, 112, (bg, cx, fy) => paintSleeper(bg, s.sleeper, t, cx, fy)));
      if (s.fox && s.fox.inAlley) drawScaled(g, s.fox.x, s.fox.y, B.ALLEY.scaleAt(s.fox.y), (tg) => B.blit(tg, 40, 112, (bg, cx, fy) => paintFox(bg, s.fox, t, cx, fy)));
      for (const n of s.npcs) if (n.inAlley) drawPersonAt(g, n, n.inAlley.x, n.inAlley.y);
    },
  });
  B.decor({
    id: 'alley-street',
    layer: 'street',
    draw(g, s) {
      if (s.fox && !s.fox.inAlley) B.blit(g, s.fox.x, s.fox.y, (bg, cx, fy) => paintFox(bg, s.fox, s.simT, cx, fy));
    },
  });
  B.decor({
    id: 'bin-lorry',
    layer: 'road',
    draw(g, s) {
      drawLorry(g, s);
      drawWheelieBin(g, s); // on the lorry's back lift, so you can see it tipped in
    },
  });

  // ---------- ticking ----------
  B.on('tick', (s, dt) => {
    alley(s);
    if (s.lorry) {
      if (s.simT > s.lorry.until) s.lorry = null;
      else {
        s.lorryT = (s.lorryT || 0) - dt;
        if (s.lorryT <= 0) {
          s.lorryT = 1.2;
          B.audio.play('lorryEngine', s.lorry.x + 90);
        }
        if (s.lorry.bin) s.lorry.bin.x = B.clamp(s.lorry.bin.x, 276, 320);
      }
    }
    if (s.fox && s.simT > s.fox.until) s.fox = null;
    // cigarette smoke curling up from the smokers
    for (const n of s.npcs) {
      if (n.area !== 'street' || n.hidden || (n.holding !== 'cig' && n.pose !== 'smoke')) continue;
      n._smokeT = (n._smokeT || 0) - dt;
      if (n._smokeT <= 0) {
        n._smokeT = 0.6;
        s.particle({ layer: 'out', x: n.x + 5 * (n.dir || 1), y: B.headTop(n) + (n.pose === 'smoke' ? 10 : 22), vx: B.rnd(-2, 3), vy: B.rnd(-9, -5), life: 2, c: 'rgba(210,210,215,0.6)', kind: 'steam' });
      }
    }
    // the police turn up a little while after Mabel's call
    if (s.policeDue && s.simT > s.policeDue) {
      s.policeDue = null;
      B.spawn(s, 'police-officer', { fromLeft: B.chance(0.5) });
    }
    // morning: the rough sleeper packs up and moves on
    if (s.sleeper && s.hour >= 9.3 && s.hour < 20) {
      const sl = s.sleeper;
      s.sleeper = null;
      const n = npc(s, sl.look, AX(), { speed: 26, holding: 'bag', umbrella: false, alpha: 0 });
      if (sl.dog) n.dog = { c: '#8a5a34', x: AX(), y: B.LAYOUT.streetY, sniff: 0 };
      n.exitX = B.chance(0.5) ? B.LAYOUT.edgeL - 2 : B.LAYOUT.edgeR + 2;
      done(n, (function* () {
        yield* outOfAlley(n, AX() + (n.exitX > AX() ? 14 : -14));
        if (sl.tea) n.emote('heart', 1.4);
        yield n.walkOff();
      })());
      B.log('The person who slept in the alley rolls up their sleeping bag and moves on.');
    }
    // the street sweeper rights a knocked-over bin
    if (alley(s).binTipped && s.npcs.some((n) => n.kind === 'street-sweeper' && Math.abs(n.x - AX()) < 10)) {
      alley(s).binTipped = false;
      B.audio.play('binClatter', AX());
    }
  });
  B.on('jump', (s) => {
    s.lorry = null;
    s.fox = null;
    s.alleyScene = null;
    s.policeDue = null;
    s.teensShooed = false;
    alley(s).binAway = false;
    if (!(s.hour >= 22.5 || s.hour < 9.3)) s.sleeper = null;
  });
})(window.Bookshop);
