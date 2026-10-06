/* Idle activities: what the owner does when nothing needs her. Picked at random by `weight`,
 * which is where her mood (o.mood), tiredness (o.energy) and caffeine (o.caffeine) show through.
 * cooldown is in story minutes. `when` gates whether it's possible at all. */
(function (B) {
  const name = () => B.ownerName();
  const R = () => B.LAYOUT.ranges;

  B.activity({
    id: 'potter-counter',
    weight: 2,
    *run(s, o) {
      yield o.go('counter');
      o.face('side');
      yield B.rnd(2, 4);
      o.face(-o.dir); // glances the other way along the shop
      yield B.rnd(1, 3);
      if (B.chance(0.2)) {
        o.face(0); // a brief look out at the street
        yield B.rnd(1, 2);
      }
      o.face('side');
      if (o.energy < 0.3 && B.chance(0.5)) o.emote('zzz', 1.6);
      else if (o.mood > 0.6 && B.chance(0.3)) yield o.hold('hips', B.rnd(1.5, 3));
      else if (B.chance(0.3)) yield o.hold('think', B.rnd(2, 3));
      yield B.rnd(1, 2);
    },
  });

  B.activity({
    id: 'read-counter',
    weight: (s, o) => 2 + (o.mood > 0.5 ? 1 : 0),
    cooldown: 20,
    *run(s, o) {
      yield o.go('counter');
      o.face('side');
      o.bookC = B.pick(B.pal.books);
      o.holding = 'book';
      const dur = B.rnd(8, 16);
      let t = 0;
      o.pose = 'read';
      while (t < dur) {
        yield 2;
        t += 2;
        if (B.chance(0.12)) o.emote(B.pick(['spark', 'heart', 'what', 'sigh']), 1.6);
      }
      if (B.chance(0.25)) {
        o.pose = 'hug';
        o.emote('heart', 1.5);
        yield 1.6;
      }
      if (B.chance(0.3)) B.log(`${name()} gets lost in ${B.pick(B.titles)} for a while.`);
      o.holding = null;
    },
  });

  // Perched on the stool behind the counter. When she's tired she may nod off on the counter.
  B.activity({
    id: 'stool-read',
    weight: (s, o) => 1 + (o.energy < 0.4 ? 2.5 : 0) + (o.mood < 0.4 ? 1.5 : 0) + (s.hour >= 13 && s.hour < 15 ? 1 : 0) + (!s.shop.open ? 2 : 0),
    cooldown: 40,
    when: (s, o) => s.queue.length === 0,
    *run(s, o) {
      yield o.go('counter');
      o.face(1);
      o.pose = 'sit';
      yield 1;
      s.lamp = B.daylight(s.hour) < 0.95 || !s.shop.open || B.chance(0.4);
      o.bookC = B.pick(B.pal.books);
      o.holding = 'book';
      o.pose = 'sitread';
      const dur = B.rnd(10, 22);
      let t = 0;
      while (t < dur) {
        yield 1;
        t += 1;
        if (o.energy < 0.28 && B.chance(0.1)) {
          o.holding = null;
          o.pose = 'sleep';
          B.log(`${name()} nods off with her head on the counter.`);
          let slept = 0;
          while ((o.energy < 0.65 || slept < 8) && slept < 120) {
            yield 1;
            slept += 1;
          }
          o.pose = 'sit';
          yield 0.6;
          yield o.hold('stretch', 1.4);
          B.log(`${name()} wakes up, blinking.`);
          break;
        }
        if (B.chance(0.05)) o.emote(B.pick(['book', 'heart', 'spark']), 1.4);
      }
      o.holding = null;
      o.pose = 'stand';
      s.lamp = false;
    },
  });

  B.activity({
    id: 'dust-shelves',
    weight: (s, o) => 1.2 + (o.mood > 0.6 ? 1.5 : 0),
    cooldown: 30,
    *run(s, o) {
      for (let i = 0; i < B.irnd(2, 3); i++) {
        yield o.go(B.shelfX());
        o.face('away');
        o.pose = 'dust';
        for (let k = 0; k < 4; k++) {
          yield 0.7;
          if (B.chance(0.6))
            s.particle({ layer: 'in', x: o.x + B.rnd(-6, 6), y: B.headTop(o) - 6, vx: B.rnd(-8, 8), vy: B.rnd(4, 12), life: 1.5, c: '#fff3d6' });
          if (o.mood > 0.6 && k === 1) o.emote('note', 1.2);
        }
        o.pose = 'stand';
      }
    },
  });

  B.activity({
    id: 'tidy-shelves',
    weight: 1.5,
    cooldown: 15,
    *run(s, o) {
      for (let i = 0; i < B.irnd(2, 4); i++) {
        yield o.go(B.shelfX());
        o.face('away');
        yield o.hold(B.chance(0.5) ? 'shelve' : 'browse', B.rnd(1.5, 3));
      }
      if (B.chance(0.2)) {
        o.face('side');
        o.bookC = B.pick(B.pal.books);
        o.holding = 'book';
        o.emote('spark', 1.4);
        B.log(`Tidying the shelves, ${name()} finds a book she'd forgotten about.`);
        yield o.hold('read', B.rnd(5, 9));
        o.holding = null;
      }
    },
  });

  // Disappears through the passage into the back rooms for a while.
  B.activity({
    id: 'back-room',
    weight: (s, o) => (s.customersInside() === 0 ? 0.8 : 0.2),
    cooldown: 60,
    *run(s, o) {
      if (B.chance(0.5)) B.log(`${name()} potters off into the back rooms.`);
      yield* o.backRoom(s, B.rnd(10, 25));
      if (B.chance(0.5)) {
        o.holding = 'books';
        o.emote('book', 1.4);
        yield o.go(B.shelfX());
        o.face('away');
        yield o.hold('shelve', 1.2);
        s.shelves.add(B.irnd(2, 4));
        o.holding = null;
      }
    },
  });

  B.activity({
    id: 'sweep',
    weight: 0.8,
    cooldown: 120,
    *run(s, o) {
      o.holding = 'broom';
      o.movePose = 'sweep';
      for (const x of [20, 200, 60, 130]) {
        yield o.walkTo(x, { speed: 0.35 });
        s.particle({ layer: 'in', x: o.x + 8 * (o.dir || 1), y: 140, vx: B.rnd(-8, 8), vy: -6, life: 0.8, c: '#a88a5a' });
      }
      o.movePose = null;
      o.holding = null;
    },
  });

  B.activity({
    id: 'look-out',
    weight: (s, o) => (o.mood < 0.4 ? 3 : 0.6) + (s.weather.rain > 0.5 ? 1.5 : 0),
    cooldown: 25,
    *run(s, o) {
      yield o.go(B.rnd(...R().open));
      o.face(0);
      const dur = B.rnd(5, 9);
      yield dur / 2;
      if (s.weather.rain > 0.5) {
        o.emote(o.mood > 0.5 ? 'heart' : 'rain', 1.8);
        if (B.chance(0.4)) B.log(`${name()} watches the rain run down the glass.`);
      } else if (o.mood < 0.4) {
        o.emote(B.pick(['sigh', 'rain', 'dots']), 1.8);
        if (B.chance(0.4)) B.log(`${name()} gazes out of the window, miles away.`);
      } else o.emote('sun', 1.5);
      if (o.mood < 0.4) yield o.hold('cross', dur / 2);
      else yield dur / 2;
    },
  });

  B.activity({
    id: 'window-display',
    weight: (s, o) => (o.mood > 0.55 ? 1.5 : 0.4),
    cooldown: 180,
    *run(s, o) {
      yield o.go('display');
      o.face(0);
      yield o.hold('crouch', 2.2);
      const cols = s.display.cols;
      for (let i = cols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
      }
      yield o.hold('crouch', 1.2);
      yield o.hold('think', 1.2);
      o.emote('spark', 1.6);
      yield o.hold('clap', 1);
      B.log(`${name()} rearranges the window display.`);
    },
  });

  B.activity({
    id: 'water-plant',
    weight: (s) => (s.plant.water < 0.5 ? 4 : 0),
    cooldown: 30,
    *run(s, o) {
      yield o.go('plant');
      o.face(-1);
      o.pose = 'water';
      for (let i = 0; i < 6; i++) {
        s.particle({ layer: 'in', x: o.x - 16, y: B.headTop(o) + 22, vx: -3, vy: 8, vy2: 60, life: 0.5, c: '#74c0fc' });
        yield 0.4;
      }
      o.pose = 'stand';
      s.plant.water = 1;
      if (B.chance(0.5)) B.log(`${name()} waters the window plant.`);
    },
  });

  B.activity({
    id: 'count-till',
    weight: 0.7,
    cooldown: 120,
    needsOpen: true,
    *run(s, o) {
      yield o.go('till');
      o.face(-1); // the till is to her left
      yield o.hold('till', 2.5);
      const n = s.dayStats.sales;
      if (n >= 4) {
        o.emote('coin', 1.6);
        o.moodUp(0.03);
        yield o.hold('hips', 1.4);
      } else if (n === 0 && s.hour > 12) {
        o.emote('sweat', 1.6);
        o.moodDown(0.03);
        yield o.hold('facepalm', 1.6);
      } else {
        o.emote('dots', 1.2);
        yield o.hold('think', 1.2);
      }
    },
  });

  B.activity({
    id: 'write-orders',
    weight: 1,
    cooldown: 40,
    *run(s, o) {
      yield o.go('counter');
      o.face('side');
      yield o.hold('write', B.rnd(3, 5));
      yield o.hold('think', B.rnd(1.5, 2.5));
      yield o.hold('write', B.rnd(2, 3));
      if (B.chance(0.3)) o.emote(B.pick(['dots', 'book']), 1.2);
      yield 0.5;
    },
  });

  B.activity({
    id: 'stretch',
    weight: (s, o) => (o.energy < 0.45 ? 2 : 0.2),
    cooldown: 20,
    *run(s, o) {
      o.face('side');
      yield o.hold('stretch', 1.6);
      if (o.energy < 0.35) {
        o.emote('zzz', 1.5);
        if (B.chance(0.4)) B.log(`${name()} yawns enormously.`);
      }
      yield 0.8;
    },
  });

  B.activity({
    id: 'sigh',
    weight: (s, o) => (o.mood < 0.35 ? 2 : 0),
    cooldown: 15,
    *run(s, o) {
      o.face(B.chance(0.5) ? 'away' : 'side');
      o.emote(B.pick(['sigh', 'rain']), 2);
      yield o.hold(B.pick(['cross', 'facepalm', 'stand']), 2.5);
    },
  });

  B.activity({
    id: 'hum-wander',
    weight: (s, o) => (o.mood > 0.66 ? 2 : 0),
    cooldown: 15,
    *run(s, o) {
      for (let i = 0; i < 3; i++) {
        o.emote('note', 1.4);
        yield o.go(B.rnd(...R().floor));
        if (B.chance(0.4)) {
          o.face(-o.dir || 1);
          yield 0.3;
          o.face(-o.dir || 1);
        }
        yield 0.5;
      }
    },
  });

  B.activity({
    id: 'wash-mug',
    weight: (s) => (s.counter.cup ? 1.5 : 0),
    cooldown: 10,
    *run(s, o) {
      yield o.go('counter');
      s.counter.cup = false;
      o.holding = 'cup';
      yield o.go('coffee');
      o.face('away');
      o.holding = null;
      yield o.hold('shelve', 1.5);
    },
  });
})(window.Bookshop);
