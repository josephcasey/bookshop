/* Customers. B.customerVisit is reusable by other visitors (e.g. a window-shopper who decides to come in). */
(function (B) {
  const name = () => B.ownerName();

  /** Go in, browse (maybe wander off into the back rooms), maybe buy, leave.
   *  opts: { buy: 0..1, stops, patience, backRoom: 0..1 } */
  B.customerVisit = function* (s, n, opts = {}) {
    yield n.walkTo(B.LAYOUT.doorX);
    if (!s.shop.open) {
      n.face('away'); // peering at the CLOSED sign
      n.emote(B.pick(['what', 'rain', 'dots']), 1.6);
      yield n.hold(B.pick(['shrug', 'think']), 1.8);
      return;
    }
    yield* n.enter(s);
    s.dayStats.visitors++;
    s.totals.visitors++;
    yield* n.browse(s, opts.stops);
    if (B.chance(opts.backRoom == null ? 0.35 : opts.backRoom)) {
      yield* n.backRoom(s, B.rnd(10, 30));
      if (B.chance(0.5)) n.emote(B.pick(['book', 'spark']), 1.4);
    }
    const buy = opts.buy == null ? 0.6 : opts.buy;
    if (B.chance(buy) && s.shelves.count() > 0) {
      const slot = s.shelves.take(n.x);
      n.bookC = slot ? slot.c : B.pick(B.pal.books);
      n.bookTitle = B.pick(B.titles);
      n.holding = 'book';
      const served = yield* n.payAtTill(s, opts.patience);
      if (!served) {
        n.emote('angry', 1.6);
        yield n.hold('hips', 1.2);
        n.holding = null;
        s.shelves.add(1);
        s.owner.moodDown(0.05);
        B.log('A customer gives up waiting and leaves.');
      }
    } else {
      n.emote(B.pick(['dots', 'happy', 'what']), 1.4);
      if (B.chance(0.3)) B.log('Somebody browses for a while and leaves empty-handed.');
      yield 0.8;
    }
  };

  B.visitor({
    id: 'customer',
    weight: (s) => (s.shop.open ? 1.3 : 0.2),
    *run(s, n) {
      yield* B.customerVisit(s, n);
    },
  });

  B.visitor({
    id: 'student',
    weight: (s) => (s.shop.open ? 0.7 : 0),
    look: () => B.randomLook({ scarf: B.pick(['#b33a3a', '#2f4f8c', '#c9a13b']), glasses: B.chance(0.5), h: 0 }),
    *run(s, n) {
      yield n.walkTo(B.LAYOUT.doorX);
      if (!s.shop.open) return;
      yield* n.enter(s);
      s.dayStats.visitors++;
      yield n.walkTo(B.shelfX());
      n.face('side');
      n.bookC = B.pick(B.pal.books);
      n.holding = 'book';
      yield n.hold('read', B.rnd(14, 26));
      n.holding = null;
      if (B.chance(0.5)) {
        n.holding = 'book';
        n.bookTitle = B.pick(B.titles);
        s.shelves.take(n.x);
        yield* n.payAtTill(s);
      } else {
        n.emote('dots', 1.2);
        if (B.chance(0.5)) B.log('A student reads half a chapter standing up, then puts it back.');
      }
    },
  });

  B.visitor({
    id: 'grump',
    weight: (s) => (s.shop.open ? 0.35 : 0),
    setup(n) {
      n.mood_ = 'angry';
      n.rude = true;
      n.speed = 56;
    },
    *run(s, n) {
      yield* B.customerVisit(s, n, { stops: 1, buy: 0.7, patience: 20, backRoom: 0 });
    },
  });

  // Asks for something that isn't on the shelves; she fetches it from the back.
  B.visitor({
    id: 'special-request',
    weight: (s) => (s.shop.open ? 0.3 : 0),
    *run(s, n) {
      yield n.walkTo(B.LAYOUT.doorX);
      if (!s.shop.open) return;
      yield* n.enter(s);
      s.dayStats.visitors++;
      yield n.walkTo(B.LAYOUT.spots.custTill);
      n.face(-1);
      n.bookTitle = B.pick(B.titles);
      s.request('fetch-from-back', 5, { npc: n });
      const got = yield B.act.until(() => n.fetched, 50);
      if (!got) {
        n.emote('sweat', 1.4);
        return;
      }
      n.emote('heart', 1.4);
      n.bookC = n.fetchedC;
      n.holding = 'book';
      yield* n.payAtTill(s);
    },
  });

  B.activity({
    id: 'fetch-from-back',
    idle: false,
    priority: 5,
    resume: false,
    *run(s, o, d) {
      const n = d && d.npc;
      if (!n || n.area !== 'inside') return;
      yield o.go('till');
      o.face(1);
      yield* B.talk(o, 3, n);
      yield o.hold('think', 1.6);
      o.emote('bang', 1);
      yield 0.6;
      B.log(`Someone asks for ${n.bookTitle}. ${name()} is sure there's a copy in the back.`);
      yield* o.backRoom(s, B.rnd(6, 14));
      o.bookC = B.pick(B.pal.books);
      o.holding = 'book';
      o.emote('spark', 1.4);
      yield o.go('till');
      o.face(1);
      o.holding = null;
      n.fetchedC = o.bookC;
      n.fetched = true;
      yield 0.5;
    },
  });

  B.visitor({
    id: 'lost-tourist',
    weight: (s) => (s.shop.open ? 0.3 : 0),
    look: () => B.randomLook({ hat: '#c9a13b', hatStyle: 'cap' }),
    *run(s, n) {
      yield n.walkTo(B.rnd(...B.LAYOUT.ranges.window));
      n.face('away'); // squinting at the shop sign
      n.emote('what', 1.5);
      yield n.hold('think', 1.8);
      yield* n.enter(s);
      yield n.walkTo(B.LAYOUT.spots.custTill);
      n.face(-1);
      s.request('give-directions', 3, { npc: n });
      yield B.act.until(() => n.helped, 20);
      n.emote('heart', 1.4);
      yield 1;
    },
  });

  B.activity({
    id: 'give-directions',
    idle: false,
    priority: 3,
    resume: false,
    *run(s, o, d) {
      const n = d && d.npc;
      if (!n || n.area !== 'inside') return;
      yield o.go('till');
      o.face(1);
      yield* B.talk(o, 4, n);
      o.face(-1);
      yield o.hold('point', 1.4);
      o.face(1);
      n.helped = true;
      o.moodUp(0.03);
      B.log(`${name()} gives a lost tourist directions to the station.`);
      yield 0.6;
    },
  });
})(window.Bookshop);
