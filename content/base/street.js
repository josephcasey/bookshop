/* People on the pavement. weight = relative chance each spawn is this kind. */
(function (B) {
  const name = () => B.ownerName();

  B.visitor({
    id: 'passer',
    weight: 10,
    *run(s, n) {
      if (B.chance(0.15)) n.hurry = true;
      yield n.walkOff();
    },
  });

  B.visitor({
    id: 'window-shopper',
    weight: 3,
    *run(s, n) {
      yield n.walkTo(B.rnd(...B.LAYOUT.ranges.window));
      n.pose = 'backstand';
      yield B.rnd(2.5, 6);
      if (B.chance(0.4)) n.emote(B.pick(['heart', 'spark', 'book', 'what']), 1.5);
      yield 1;
      n.pose = 'stand';
      if (s.shop.open && B.chance(0.35)) yield* B.customerVisit(s, n);
    },
  });

  B.visitor({
    id: 'waver',
    weight: (s) => (s.owner.area === 'inside' && s.owner.pose !== 'sleep' ? 0.5 : 0),
    *run(s, n) {
      const target = B.clamp(s.owner.x + B.rnd(-12, 12), ...B.LAYOUT.ranges.window);
      yield n.walkTo(target);
      n.pose = 'backwave';
      s.request('wave-back', 2, { npc: n });
      yield 2;
      n.pose = 'stand';
      if (B.chance(0.3)) B.log(`A neighbour waves to ${name()} through the window.`);
    },
  });

  B.visitor({
    id: 'dog-walker',
    weight: 2,
    setup(n) {
      n.speed = B.rnd(30, 40);
      n.dog = { c: B.pick(B.lookParts.dog), x: n.x - 20 * n.dir, y: B.LAYOUT.streetY, sniff: 0 };
    },
    *run(s, n) {
      if (B.chance(0.5)) {
        yield n.walkTo(B.rnd(...B.LAYOUT.ranges.street));
        n.dog.sniff = 2.5;
        yield 2.5;
      }
      yield n.walkOff();
    },
  });

  B.visitor({
    id: 'jogger',
    weight: (s) => (s.weather.rain > 0.3 ? 0.2 : 1),
    setup(n) {
      n.speed = 105;
      n.umbrella = false;
      n.look = B.randomLook({ top: B.pick(['#e8590c', '#1c7ed6', '#e03131', '#2b8a3e']), bottom: '#1f2a44', hat: null, dress: false });
    },
    *run(s, n) {
      yield n.walkOff();
    },
  });

  B.visitor({
    id: 'nightwalker',
    weight: (s) => (B.daylight(s.hour) < 0.3 ? 1.5 : 0),
    *run(s, n) {
      if (s.owner.area === 'inside' && B.chance(0.3)) {
        yield n.walkTo(B.rnd(...B.LAYOUT.ranges.window));
        n.pose = 'backstand';
        yield 3;
        n.pose = 'stand';
      }
      yield n.walkOff();
    },
  });
})(window.Bookshop);
