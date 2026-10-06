/* The owner's fixed routines and reactions (not picked at random: idle:false).
 * Priorities: idle 1 · reactions 2 · routines 3 · phone/delivery 4 · serving 5 · arriving 6.
 * A higher-priority request interrupts a lower one. */
(function (B) {
  const name = () => B.ownerName();

  B.activity({
    id: 'arrive',
    idle: false,
    priority: 6,
    fromAway: true,
    *run(s, o) {
      // she lives in the flat upstairs: in the dark mornings her light goes on first
      if (B.daylight(s.hour) < 0.9) {
        s.upstairs.light = true;
        yield 3;
      }
      s.upstairs.light = false;
      s.upstairs.blind = 0; // blinds up before she comes down
      o.energy = B.rnd(0.7, 1);
      o.caffeine = 0.05;
      o.mood = B.clamp(o.baseline + B.rnd(-0.08, 0.08), 0, 1);
      o.area = 'inside';
      o.depth = 'back';
      o.lane = 0;
      yield* o.outOfPassage(s, 1, true); // down the stairs and through the passage
      s.shop.lights = true;
      B.audio.play('click');
      const how = o.mood > 0.62 ? 'with a spring in her step' : o.mood < 0.42 ? 'looking a little glum' : 'at her usual pace';
      B.log(`${name()} comes down the stairs from her flat ${how}.`);
      yield o.go('door');
      o.face('away');
      yield o.hold('reach', 1.2); // unbolting the front door
      s.shop.locked = false;
      yield o.go('counter');
      o.face(1);
      yield 0.8;
    },
  });

  B.activity({
    id: 'open-shop',
    idle: false,
    priority: 3,
    *run(s, o) {
      yield o.go('door');
      o.face(1);
      yield o.hold('reach', 0.8);
      s.shop.open = true;
      s.flags.opened = true;
      B.log(`${name()} flips the sign to OPEN.`);
      B.emit('open', s);
      o.face(-1); // turns back into the shop
      o.emote(o.mood > 0.55 ? 'sun' : 'dots', 1.8);
      yield 1;
    },
  });

  B.activity({
    id: 'close-shop',
    idle: false,
    priority: 3,
    *run(s, o) {
      yield o.go('door');
      o.face(1);
      yield o.hold('reach', 0.8);
      s.shop.open = false;
      s.flags.closed = true;
      B.emit('close', s);
      if (o.energy > 0.35 && B.chance(0.22)) {
        s.flags.lateUntil = Math.min(23.5, s.hour + B.rnd(1, 2.5));
        B.log(`${name()} turns the sign to CLOSED — but stays on with a good book.`);
      } else B.log(`${name()} turns the sign to CLOSED.`);
      yield 0.6;
    },
  });

  B.activity({
    id: 'go-home',
    idle: false,
    priority: 3,
    *run(s, o) {
      if (s.radio.on) {
        yield o.go('radio');
        o.face('away');
        yield o.hold('shelve', 0.6);
        s.radio.turnOff();
      }
      yield o.go('till');
      o.face(-1);
      yield o.hold('till', 2.5);
      const n = s.dayStats.sales;
      const verdict = n >= 8 ? 'A cracking day' : n >= 4 ? 'A decent day' : n >= 1 ? 'A quiet day' : 'Not a single sale';
      B.log(`${verdict}: ${n} book${n === 1 ? '' : 's'} sold.`);
      if (n >= 8) o.emote('heart');
      else if (n === 0) o.emote('rain');
      yield o.hold(n >= 8 ? 'cheer' : n === 0 ? 'facepalm' : 'stand', 1.2);
      yield o.go('door');
      o.face('away');
      yield o.hold('reach', 1.2); // bolting the front door
      s.shop.locked = true;
      yield o.go(B.LAYOUT.spots.arch);
      s.shop.lights = false;
      B.audio.play('click');
      s.flags.left = true;
      B.log(`${name()} locks up and heads upstairs to her flat.`);
      yield* o.intoPassage(s, 1, true); // through the passage and up the stairs
      // ...and a minute later the light goes on upstairs
      o.holding = null;
      o.area = 'upstairs';
      o.hidden = false;
      o.pz = 0;
      o.climb = 0;
      o.x = B.LAYOUT.upstairsSpots.door;
      yield 2;
      s.upstairs.light = true;
      B.audio.play('click');
      yield o.go(B.LAYOUT.upstairsSpots.windowA);
      o.face(-1);
      o.emote(o.mood > 0.5 ? 'happy' : 'sigh', 1.6);
      yield 1;
    },
  });

  // Evening in the flat ends with the blinds coming down.
  B.activity({
    id: 'go-to-bed',
    idle: false,
    priority: 3,
    area: 'upstairs',
    *run(s, o) {
      s.upstairs.tv = false;
      yield o.go(B.LAYOUT.upstairsSpots.windowA);
      o.face('side');
      yield o.hold('stretch', 1.4);
      o.emote('zzz', 1.6);
      o.face(0); // reaching up for the blind
      o.pose = 'reach';
      yield B.act.tween(s.upstairs, 'blind', 1, 1.6);
      o.pose = 'stand';
      yield 1.5;
      s.upstairs.light = false;
      B.audio.play('click');
      s.flags.bed = true;
      B.log(`${name()} draws the blinds and turns in for the night.`);
      o.area = 'away';
    },
  });

  B.activity({
    id: 'potter-upstairs',
    area: 'upstairs',
    weight: 1,
    *run(s, o) {
      yield o.go(B.rnd(...B.LAYOUT.upstairsRange));
      o.face(B.chance(0.4) ? 'away' : 'side');
      yield B.rnd(2, 4);
      if (B.chance(0.4)) yield o.hold(B.pick(['stretch', 'think', 'hips']), 1.5);
    },
  });

  B.activity({
    id: 'serve',
    idle: false,
    priority: 5,
    *run(s, o) {
      while (s.queue.length) {
        const c = s.queue[0];
        yield o.go('till');
        o.face(1);
        yield B.act.until(() => !s.queue.includes(c) || (!c.moving && Math.abs(c.x - B.LAYOUT.spots.custTill) < 1), 10);
        if (!s.queue.includes(c)) continue;
        o.emote(o.mood > 0.35 ? 'talk' : 'dots', 1.3);
        yield 1.1;
        c.emote('talk', 1.1);
        yield 1;
        yield o.hold('wrap', o.energy < 0.3 ? 3 : 2);
        c.holding = 'parcel';
        c.served = true;
        const qi = s.queue.indexOf(c);
        if (qi >= 0) s.queue.splice(qi, 1);
        s.sale(c);
        o.moodUp(0.05);
        c.emote(c.rude ? 'dots' : B.pick(['heart', 'happy', 'spark']), 1.6);
        if (!c.rude && o.mood > 0.6) o.emote('heart', 1.4);
        const title = c.bookTitle || B.pick(B.titles);
        if (c.rude || B.chance(0.5)) B.log(c.rude ? `A customer buys ${title} without a word.` : `Sold: a copy of ${title}.`);
        if (c.rude) o.moodDown(0.08);
        yield 0.9;
      }
    },
  });

  B.activity({
    id: 'wake-startled',
    idle: false,
    priority: 2,
    *run(s, o) {
      o.face(1);
      o.emote('bang', 1.2);
      yield 0.8;
      o.emote('sweat', 1.5);
      yield o.hold('stretch', 0.9);
      B.log(`${name()} wakes with a start and smooths her cardigan.`);
      yield o.go('counter');
    },
  });

  // Somebody knocked on the glass (the viewer clicked the window)
  B.activity({
    id: 'notice-tap',
    idle: false,
    priority: 2,
    *run(s, o) {
      o.face(0);
      o.emote(o.pose === 'sleep' ? 'bang' : 'what', 1.2);
      yield 0.9;
      if (o.mood > 0.3) {
        yield o.hold(o.mood > 0.7 ? 'cheer' : 'wave', 1.6);
        o.emote(o.mood > 0.6 ? 'heart' : 'happy', 1.6);
        o.moodUp(0.04);
      } else {
        o.emote('dots', 1.4);
      }
      yield 0.8;
    },
  });

  B.activity({
    id: 'wave-back',
    idle: false,
    priority: 2,
    *run(s, o, d) {
      const n = d && d.npc;
      if (n && n.area === 'street') yield o.go(B.clamp(n.x, ...B.LAYOUT.ranges.floor));
      o.face(0);
      if (o.mood < 0.3) {
        o.emote('dots', 1.4);
        yield 1.2;
        return;
      }
      yield o.hold('wave', 1.4);
      o.emote(o.mood > 0.6 ? 'heart' : 'happy', 1.5);
      o.moodUp(0.05);
      yield 0.6;
    },
  });

  // Greet customers as they come in
  B.on('enter', (s, a) => {
    const o = s.owner;
    if (a === o || o.area !== 'inside') return;
    if (o.pose === 'sleep') {
      if (B.chance(0.6)) s.request('wake-startled', 2);
      return;
    }
    if (!o.moving && o.priority < 4) o.faceX(a.x);
    o.emote(o.mood > 0.4 ? 'talk' : 'dots', 1.4);
  });
})(window.Bookshop);
