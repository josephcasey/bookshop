/* 2026-10-09 (SCH-39: evenings in the window, and a café table)
 * The floor by the shop window does more than hold the display now.
 * - Every day there's a little café table for two by the poetry-side bookcase. While the shop's open, people sit
 *   down and Mabel brings them a coffee and a Danish; they linger, and pay on the way out.
 * - Most evenings, after closing, the window space hosts something (by day of the week): partnered Lindy Hop or
 *   Salsa classes, a line-dancing class Mabel teaches herself, or the board-gaming club. Mabel stays down, carries the
 *   window benches (display and all) through to the back shop (and, for games night, brings out gaming tables),
 *   puts the right music on, and the regulars come in. Afterwards she puts everything back and goes up.
 * - The cat keeps out of it: no bench perch while the benches are away (it takes the counter instead), no prowling
 *   the dance floor, and back to its spot once the benches are.
 * The Lighting Lab has a button for each, so they can be watched any time. */
(function (B) {
  const name = () => B.ownerName();
  const L = () => B.LAYOUT;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CAFE_X = 104; // the café table, in front of the poetry-side bookcase
  const SEATS = [CAFE_X - 10, CAFE_X + 10];
  const GAME_TABLES = [40, 160];
  // the week: s.day % 7
  const WEEK = ['games', 'lindy', 'games', 'salsa', 'line', 'games', null];
  const KINDS = {
    lindy: { title: 'Lindy Hop class', station: 'wwoz', couples: 3, log: 'The Tuesday Lindy Hop class swings in.' },
    salsa: { title: 'Salsa class', station: 'bossa', couples: 3, log: 'Salsa night: the regulars shimmy in out of the cold.' },
    line: { title: 'line-dancing class', station: 'folk', solo: 4, log: `Line dancing! ${'Mabel'} lines everyone up by the window.` },
    games: { title: 'board-gaming club', station: 'lofi', players: 4, log: 'The board-gaming club arrives, boxes under their arms.' },
  };

  // ---------- the window furniture ----------
  const ws = (s) => s.windowSet || (s.windowSet = { benches: true, tables: false, cafe: true });
  B.on('ready', (s) => ws(s));

  // stepping out in front of the counter (round its end by the door) and back again
  function* front(o, x) {
    if (o.depth !== 'front') {
      yield o.go(214);
      o.depth = 'front';
    }
    o.onStage = true;
    yield o.go(x);
  }
  function* behind(o) {
    yield o.go(214);
    o.onStage = false;
    o.depth = 'back';
  }
  // carry a piece of furniture through the arch to the back shop (or back out of it)
  function* carry(s, o, fromX, what, away) {
    if (away) {
      yield* front(o, fromX);
      o.face('away');
      yield o.hold('crouch', 0.6);
      what(true);
      o.holding = 'box';
      yield o.go(L().spots.arch);
      o.onStage = false;
      yield* o.intoPassage(s, 1, false);
      yield 1;
      o.holding = null;
      yield* o.outOfPassage(s, 1, false);
      o.depth = 'front';
    } else {
      yield* front(o, L().spots.arch);
      o.onStage = false;
      yield* o.intoPassage(s, 1, false);
      yield 1;
      o.holding = 'box';
      yield* o.outOfPassage(s, 1, false);
      o.depth = 'front';
      yield* front(o, fromX);
      yield o.hold('crouch', 0.6);
      o.holding = null;
      what(false);
    }
  }

  // ---------- the evening events ----------
  const todays = (s) => WEEK[((s.day % 7) + 7) % 7];
  B.on('tick', (s) => {
    const o = s.owner;
    const f = s.flags;
    const kind = todays(s);
    // after closing on an event day she stays down for it
    if (kind && !f.eventDone && !s.event && o.area === 'inside' && !s.shop.open && f.closed && s.hour >= B.config.closeHour && s.hour < 21) {
      f.lateUntil = 23.5;
      if (!f.eventAsked) {
        f.eventAsked = true;
        s.request('host-event', 6, { kind });
      }
    }
  });
  /** Start an event now (the Lighting Lab's buttons; also the evening schedule). */
  B.startEvent = (s, kind) => {
    const o = s.owner;
    s.flags.lateUntil = 23.5;
    s.flags.left = false;
    s.flags.eventAsked = true;
    s.request('host-event', 9, { kind });
  };
  for (const kind of Object.keys(KINDS)) {
    B.happening({ id: 'event-' + kind, perHour: 0, when: () => false, *run(s) { B.startEvent(s, kind); } }); // (for the Lab)
  }

  B.activity({
    id: 'host-event',
    idle: false,
    priority: 6,
    resume: false,
    *run(s, o, d) {
      const kind = (d && d.kind) || 'games';
      const K = KINDS[kind];
      const W = ws(s);
      s.shop.lights = true;
      s.event = { kind, phase: 'setup', guests: [] };
      B.log(`${name()} gets the shop ready for the ${K.title}.`);
      // the benches (and the café table) go through to the back: the floor's wanted
      if (W.benches) yield* carry(s, o, 40, (v) => (W.benches = !v), true); // (both benches, display and all)
      if (kind !== 'games' && W.cafe) yield* carry(s, o, CAFE_X, (v) => (W.cafe = !v), true);
      if (kind === 'games' && !W.tables) yield* carry(s, o, GAME_TABLES[0], (v) => (W.tables = !v), false);
      // the music, the door unbolted, and in they come
      s.radio.tuneTo && s.radio.tuneTo(K.station);
      if (!s.radio.on && s.radio.turnOn) s.radio.turnOn();
      s.shop.locked = false;
      B.log(K.log.replace('Mabel', name()));
      s.event.phase = 'arriving';
      const slots = guestSlots(kind);
      for (const sl of slots) {
        const g = B.spawn(s, 'event-guest', { fromLeft: B.chance(0.5), props: { slot: sl, eventKind: kind } });
        if (g) s.event.guests.push(g);
        yield B.rnd(0.8, 1.6);
      }
      const ready = () => s.event.guests.every((g) => g.placed || g.remove);
      for (let w = 0; w < 40 && !ready(); w += 0.5) yield 0.5;
      // the class (or the games)
      s.event.phase = 'on';
      s.event.t0 = s.simT;
      if (kind === 'line') {
        yield* front(o, CAFE_X);
        o.face(0);
        yield* lineDance(s, o, 70);
      } else if (kind === 'games') {
        yield* behind(o);
        for (let t = 0; t < 70; t += 2) {
          yield 2;
          if (B.chance(0.08)) B.log(B.pick(['Someone at the gaming club rolls a double six and the table erupts.', 'A long silence over the board game, then a groan.', `${name()} brings round a tray of tea for the gamers.`]));
        }
      } else {
        // the partnered classes: she calls the steps from the front
        yield* front(o, CAFE_X);
        o.face(0);
        for (let t = 0; t < 70; t += 1) {
          o.pose = Math.floor(t / 4) % 3 === 0 ? 'clap' : 'stand';
          yield 1;
          if (B.chance(0.04)) B.log(kind === 'lindy' ? B.pick(['"Rock step, triple step!" calls Mabel.', 'A swing-out sends a skirt flying.']) : B.pick(['"Quick, quick, slow!" calls Mabel.', 'A neat cross-body lead, and a spin.']));
        }
      }
      // home time
      s.event.phase = 'leaving';
      B.log(B.pick(['Goodnights at the door, and the regulars drift off into the evening.', 'Everyone helps stack the chairs; the shop empties.']));
      for (let w = 0; w < 40 && s.event.guests.some((g) => !g.remove); w += 0.5) yield 0.5;
      if (s.radio.on && s.radio.turnOff) s.radio.turnOff();
      o.pose = 'stand';
      // everything back where it lives
      if (W.tables) yield* carry(s, o, GAME_TABLES[0], (v) => (W.tables = !v), true);
      if (!W.cafe) yield* carry(s, o, CAFE_X, (v) => (W.cafe = !v), false);
      if (!W.benches) yield* carry(s, o, 40, (v) => (W.benches = !v), false);
      W.benches = true;
      W.cafe = true;
      W.tables = false;
      yield* behind(o);
      s.event = null;
      s.flags.eventDone = true;
      s.flags.lateUntil = s.hour; // and off upstairs
      s.flags.left = false;
    },
  });

  // where everyone stands (or sits)
  function guestSlots(kind) {
    if (kind === 'games') return [GAME_TABLES[0] - 11, GAME_TABLES[0] + 11, GAME_TABLES[1] - 11, GAME_TABLES[1] + 11].map((x, i) => ({ x, dir: i % 2 ? -1 : 1, seat: true }));
    if (kind === 'line') return [36, 66, 142, 172].map((x) => ({ x, dir: 0 }));
    // couples: leader on the left, follower on the right, facing each other
    const out = [];
    [40, 104, 168].forEach((cx, i) => {
      out.push({ x: cx - 6, dir: 1, couple: i, lead: true });
      out.push({ x: cx + 6, dir: -1, couple: i, lead: false });
    });
    return out;
  }

  // line dancing: grapevine right, clap, grapevine left, kick, quarter turns; everybody together, Mabel up front
  function* lineDance(s, o, secs) {
    const steps = [];
    for (let rep = 0; rep < 40; rep++) {
      steps.push(['vine', 1], ['clap', 0], ['vine', -1], ['kick', 0], ['turn', 0]);
    }
    let t = 0;
    for (const [step, dir] of steps) {
      if (t >= secs) break;
      s.event.step = step;
      s.event.stepDir = dir;
      s.event.stepT = s.simT;
      if (step === 'vine') {
        for (let k = 0; k < 4; k++) {
          o.x += 2 * dir;
          o.pose = k % 2 ? 'dance' : 'stand';
          yield 0.4;
        }
        t += 1.6;
      } else if (step === 'clap') {
        yield o.hold('clap', 0.8);
        t += 0.8;
      } else if (step === 'kick') {
        yield o.hold('charleston', 1.2);
        t += 1.2;
      } else {
        o.face(1);
        yield 0.5;
        o.face(0);
        yield 0.3;
        t += 0.8;
      }
    }
    s.event.step = null;
  }

  B.visitor({
    id: 'event-guest',
    spawn: false,
    setup(n) {
      n.umbrella = false;
      n.speed = B.rnd(40, 52);
    },
    *run(s, n) {
      const sl = n.slot;
      yield* n.enter(s);
      yield n.walkTo(sl.x);
      n.onStage = true;
      n.face(sl.dir);
      n.placed = true;
      while (s.event && s.event.phase !== 'leaving') {
        const e = s.event;
        if (e.phase !== 'on') {
          n.pose = sl.seat ? 'sit' : 'stand';
          yield 0.3;
          continue;
        }
        const t = s.simT - e.t0;
        if (n.eventKind === 'games') {
          n.pose = 'sit';
          const r = Math.random();
          if (r < 0.03) yield n.hold('think', 1.5);
          else if (r < 0.05) yield n.hold('point', 0.8);
          else if (r < 0.06) {
            yield n.hold('cheer', 1);
            B.audio.play('dice');
          } else yield 0.3;
        } else if (n.eventKind === 'line') {
          // in step with Mabel
          const st = e.step;
          if (st === 'vine') {
            n.x += 2 * e.stepDir;
            n.pose = Math.floor((s.simT - e.stepT) / 0.4) % 2 ? 'dance' : 'stand';
            yield 0.4;
          } else if (st === 'clap') yield n.hold('clap', 0.8);
          else if (st === 'kick') yield n.hold('charleston', 1.2);
          else if (st === 'turn') {
            n.face(1);
            yield 0.5;
            n.face(0);
            yield 0.3;
          } else yield 0.2;
        } else {
          // partnered: the basic step, rock steps out and back, the follower's spins
          const beat = Math.floor(t / 0.5);
          const home = sl.x;
          const lindy = n.eventKind === 'lindy';
          if (!sl.lead && beat % 16 === 12) {
            // a spin under the arm
            n.pose = 'pirouette';
            for (const d of [0, 1, 0, -1, 0]) {
              n.dir = d;
              n.backView = d === 0 && Math.random() < 0.3;
              yield 0.12;
            }
            n.backView = false;
            n.face(sl.dir);
          } else {
            const out = lindy && beat % 8 >= 4 ? 6 : 0; // the swing-out: apart and back
            n.x = home + (sl.lead ? -1 : 1) * out + (beat % 2 ? (lindy ? 0 : sl.lead ? 1 : -1) : 0);
            n.pose = lindy ? (beat % 2 ? 'charleston' : 'dance') : beat % 4 === 3 ? 'hips' : 'dance';
            yield 0.5;
          }
        }
      }
      n.onStage = false;
      n.pose = 'stand';
      if (B.chance(0.5)) n.emote('happy', 1.2);
      yield* n.leave(s);
      n.remove = true;
    },
  });
  B.audio.define('dice', ({ tone, shop }) => {
    for (let i = 0; i < 4; i++) tone(900 + Math.random() * 500, 0.03, { type: 'triangle', vol: 0.02, at: i * 0.07 + Math.random() * 0.03, bus: shop });
  });

  // ---------- the café table: a coffee and a Danish, all day ----------
  const cafe = (s) => s.cafe || (s.cafe = { seats: [null, null], items: [] });
  B.visitor({
    id: 'cafe-guest',
    weight: (s) => (s.shop.open && ws(s).cafe && !s.event && cafe(s).seats.some((x) => !x) ? 0.6 : 0),
    setup(n) {
      n.umbrella = false;
    },
    *run(s, n) {
      const C = cafe(s);
      const i = C.seats.findIndex((x) => !x);
      if (i < 0 || !s.shop.open) {
        yield n.walkOff();
        return;
      }
      C.seats[i] = n;
      yield* n.enter(s);
      yield n.walkTo(SEATS[i]);
      n.onStage = true;
      n.face(i === 0 ? 1 : -1);
      n.pose = 'sit';
      n.seat = i;
      if (B.chance(0.5)) B.log(B.pick(['Someone settles at the café table with a book.', 'A customer takes the little table by the poetry shelves.']));
      s.request('serve-cafe', 5, { guest: n });
      for (let w = 0; w < 60 && !n.served; w += 1) yield 1;
      // enjoy it
      if (n.served) n.holding = 'cup';
      for (let k = 0; k < B.irnd(3, 6); k++) {
        yield n.hold(B.chance(0.4) ? 'sitread' : 'sit', B.rnd(3, 6));
        n.pose = 'sit';
      }
      n.holding = null;
      if (n.served) s.sale(n);
      C.items = C.items.filter((it) => it.seat !== i);
      if (B.chance(0.6)) C.items.push({ seat: i, kind: 'crumbs' });
      C.seats[i] = null;
      n.onStage = false;
      n.pose = 'stand';
      yield* n.leave(s);
    },
  });
  B.happening({ id: 'cafe-visit', perHour: 0, when: () => false, *run(s) { B.spawn(s, 'cafe-guest', { fromLeft: true }); } }); // (for the Lab)
  B.activity({
    id: 'serve-cafe',
    idle: false,
    priority: 5,
    resume: false,
    *run(s, o, d) {
      const n = d && d.guest;
      if (!n || n.remove) return;
      const C = cafe(s);
      yield o.go('coffee');
      o.face('away');
      if (s.coffee && s.coffee.brew) s.coffee.brew(2.5);
      yield o.hold('shelve', 2.5);
      o.holding = 'cup';
      B.log(B.pick([`${name()} takes a coffee and a Danish over to the café table.`, `A flat white and an apricot Danish for the café table.`]));
      yield* front(o, SEATS[n.seat] + (n.seat === 0 ? 6 : -6));
      o.face(n.seat === 0 ? -1 : 1);
      yield o.hold('reach', 0.6);
      o.holding = null;
      C.items = C.items.filter((it) => it.seat !== n.seat);
      C.items.push({ seat: n.seat, kind: 'cup' }, { seat: n.seat, kind: 'danish' });
      n.served = true;
      n.emote('happy', 1.2);
      yield* behind(o);
    },
  });

  // ---------- drawing ----------
  B.decor({
    id: 'event-furniture',
    layer: 'interior-front',
    draw(g, s) {
      const W = ws(s);
      const cy = B.theme === 'cyber';
      const P = (c, x, y, w = 1, h = 1) => B.px(g, c, x, y, w, h);
      const floor = L().stageY; // feet on the floor in front of the counter
      const steel = cy ? '#5e6676' : '#6b4226';
      const lit = cy ? '#9aa2b4' : '#8a5a36';
      const dark = cy ? '#2c303b' : '#4a2c17';
      // the café table and its two chairs
      if (W.cafe) {
        const C = cafe(s);
        for (const [i, sx] of SEATS.entries()) {
          if (C.seats[i] && C.seats[i].pose === 'sit') continue; // (drawn under the sitter instead)
          P(dark, sx - 3, floor - 10, 7, 2); // the seat
          P(dark, sx + (i === 0 ? -3 : 3), floor - 18, 1, 8); // its back
          P(dark, sx - 3, floor - 8, 1, 8);
          P(dark, sx + 3, floor - 8, 1, 8);
        }
        P(lit, CAFE_X - 7, floor - 16, 15, 1); // the round top
        P(steel, CAFE_X - 7, floor - 15, 15, 1);
        P(dark, CAFE_X, floor - 14, 1, 13); // the pedestal
        P(dark, CAFE_X - 3, floor - 1, 7, 1);
        for (const it of C.items) {
          const x = CAFE_X + (it.seat === 0 ? -5 : 2);
          if (it.kind === 'cup') {
            P('#f3efe6', x, floor - 19, 2, 3);
            P('#6a4020', x, floor - 19, 2, 1);
            if (Math.floor(s.simT * 2) % 3 === 0) P('rgba(240,240,240,0.5)', x, floor - 21, 1, 1);
          } else if (it.kind === 'danish') {
            P('#d8a050', x + 3, floor - 17, 3, 1); // a little pastry
            P('#e8c060', x + 4, floor - 18, 1, 1);
          } else P('#c8a070', x + 1, floor - 16, 1, 1); // crumbs
        }
      }
      // gaming tables: a board, pieces and dice
      if (W.tables) {
        for (const tx of GAME_TABLES) {
          P(lit, tx - 9, floor - 15, 19, 1);
          P(steel, tx - 9, floor - 14, 19, 2);
          P(dark, tx - 8, floor - 12, 1, 12);
          P(dark, tx + 8, floor - 12, 1, 12);
          P('#3a7a4a', tx - 5, floor - 16, 11, 1); // the board
          for (let k = 0; k < 4; k++) P(['#d83a3a', '#3a6ad8', '#e8c040', '#f0f0f0'][k], tx - 4 + k * 3, floor - 17, 1, 1); // pieces
          P('#f8f8f8', tx + 6, floor - 16, 1, 1); // a die
        }
      }
      // seats under anyone sitting at an event or the café
      for (const n of s.npcs) {
        if (n.area !== 'inside' || n.pose !== 'sit' || !n.onStage) continue;
        P(dark, Math.round(n.x) - 3, floor - 10, 7, 2);
        P(dark, Math.round(n.x) - (n.dir || 1) * 3, floor - 18, 1, 8);
      }
    },
  });
  // partners hold hands
  B.decor({
    id: 'event-hands',
    layer: 'interior',
    draw(g, s) {
      if (!s.event || s.event.phase !== 'on' || s.event.kind === 'games' || s.event.kind === 'line') return;
      const gs = s.event.guests.filter((n) => n.slot && n.slot.couple != null && n.placed && !n.remove);
      for (const a of gs) {
        if (!a.slot.lead) continue;
        const b = gs.find((m) => m.slot.couple === a.slot.couple && !m.slot.lead);
        if (!b || Math.abs(b.x - a.x) > 22 || b.pose === 'pirouette') continue;
        const y = Math.round(B.headTop(a)) + 24;
        B.line(g, Math.round(a.x) + 4, y, Math.round(b.x) - 4, y, B.theme === 'cyber' ? '#e0a8c0' : '#d9a47e');
      }
    },
  });

  // ---------- the cat keeps out of it ----------
  B.on('tick', (s) => {
    const cat = s.cat;
    if (!cat) return;
    if (!cat._eventsWrapped) {
      // no bench to perch on: the counter will do
      cat._eventsWrapped = true;
      const goTo = cat.goTo;
      cat.goTo = function* (surface, x) {
        if (surface === 'sill' && !ws(s).benches) surface = 'counter';
        if (surface === 'floor' && s.event) surface = 'counter';
        return yield* goTo.call(this, surface, surface === 'counter' ? clamp(x, 150, 200) : x);
      };
      const jumpTo = cat.jumpTo;
      cat.jumpTo = function (surface, x) {
        if (surface === 'sill' && !ws(s).benches) return jumpTo.call(this, 'counter', clamp(x, 150, 200));
        if (surface === 'floor' && s.event) return jumpTo.call(this, 'counter', clamp(x, 150, 200));
        return jumpTo.call(this, surface, x);
      };
    }
    // caught on a bench as it's lifted, or underfoot on the dance floor: up onto the counter
    if ((cat.surface === 'sill' && !ws(s).benches) || (cat.surface === 'floor' && s.event)) {
      cat.surface = 'counter';
      cat.layer = 'counter';
      cat.y = 127;
      cat.x = clamp(cat.x, 150, 200);
    }
  });
})(window.Bookshop);
