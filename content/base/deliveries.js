/* Deliveries: a courier brings a box to the counter, she signs, and later unpacks it onto the shelves. */
(function (B) {
  const name = () => B.ownerName();

  B.happening({
    id: 'delivery',
    perHour: 0.6,
    when: (s) => s.shop.open && s.hour >= 10 && s.hour < 16 && s.dayStats.deliveries < 2,
    *run(s) {
      s.dayStats.deliveries++;
      B.spawn(s, 'courier');
    },
  });

  B.visitor({
    id: 'courier',
    spawn: false, // only arrives via the 'delivery' happening
    look: 'courier',
    setup(n) {
      n.holding = 'box';
      n.speed = 62;
      n.mood_ = 'neutral';
    },
    *run(s, n) {
      yield* n.enter(s);
      yield n.walkTo(B.LAYOUT.spots.box);
      n.face(-1);
      n.pose = 'carry';
      yield 0.5;
      n.holding = null;
      n.pose = 'stand';
      s.boxes.push({});
      n.emote('talk', 1.4);
      B.log('A courier brings in a box of books.');
      s.request('sign-delivery', 4, { courier: n });
      const ok = yield B.act.until(() => n.signed, 25);
      n.emote(ok ? 'happy' : 'sweat', 1.4);
      if (!ok) yield n.hold('shrug', 1.2);
      yield 0.8;
    },
  });

  B.activity({
    id: 'sign-delivery',
    idle: false,
    priority: 4,
    resume: false,
    *run(s, o, d) {
      const n = d && d.courier;
      if (!n || n.area !== 'inside') return;
      yield o.go(B.LAYOUT.spots.box - 16);
      o.face(1);
      o.emote('bang', 1);
      yield 0.6;
      yield o.hold('write', 1.6);
      n.signed = true;
      o.moodUp(0.06);
      o.emote('spark', 1.4);
      yield o.hold('clap', 0.8);
    },
  });

  B.activity({
    id: 'unpack-box',
    weight: (s) => (s.boxes.length ? 6 : 0),
    cooldown: 5,
    when: (s) => s.boxes.length > 0 && s.queue.length === 0 && !s.npcs.some((n) => n.kind === 'courier' && n.area === 'inside'),
    *run(s, o) {
      yield o.go('counter');
      o.face(1); // the boxes are to her right
      s.boxes.shift();
      s.counter.box = true;
      yield o.hold('unpack', 2.2);
      B.log(B.pick([
        `${name()} opens the box and breathes in that new-book smell.`,
        `New stock! ${name()} leafs through each one before shelving it.`,
        `The box is full of ${B.pick(['poetry', 'old atlases', 'crime novels', 'cookbooks', 'children’s books'])}.`,
      ]));
      o.emote(o.mood > 0.4 ? 'heart' : 'spark', 1.5);
      o.bookC = B.pick(B.pal.books);
      yield o.hold('hug', 1.4);
      o.moodUp(0.08);
      for (let i = 0; i < 3; i++) {
        o.holding = 'books';
        yield o.go(B.shelfX());
        o.face('away');
        yield o.hold('shelve', 1);
        s.shelves.add(B.irnd(4, 7));
        o.holding = null;
        if (i < 2) yield o.go('counter');
      }
      s.counter.box = false;
    },
  });
})(window.Bookshop);

// Overnight she restocks the front shelves from the back rooms.
window.Bookshop.on('newDay', (s) => s.shelves.add(14));
