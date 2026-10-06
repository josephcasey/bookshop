/* Mabel's evenings in the flat upstairs, blinds up.
 * Activities with area: 'upstairs' are only picked while she's home. */
(function (B) {
  const name = () => B.ownerName();
  const U = () => B.LAYOUT.upstairsSpots;

  B.activity({
    id: 'watch-tv',
    area: 'upstairs',
    weight: (s, o) => 3 + (o.energy < 0.4 ? 2 : 0),
    cooldown: 30,
    *run(s, o) {
      try {
        yield o.go(U().chair);
        o.face(1);
        o.pose = 'sit';
        s.upstairs.tv = true;
        B.log(`${name()} settles into her armchair in front of the telly.`);
        const dur = B.rnd(20, 40);
        let t = 0;
        while (t < dur) {
          yield 2;
          t += 2;
          if (o.energy < 0.3 && B.chance(0.08)) {
            o.pose = 'sleep';
            B.log(`${name()} dozes off in front of the television.`);
            yield B.rnd(10, 20);
            o.pose = 'sit';
            o.emote('bang', 1.2);
            continue;
          }
          if (B.chance(0.2)) o.emote(B.pick(['spark', 'spark', 'what', 'heart', 'bang', 'sigh']), 1.6);
        }
      } finally {
        s.upstairs.tv = false;
      }
    },
  });

  B.activity({
    id: 'evening-exercise',
    area: 'upstairs',
    weight: (s, o) => (o.energy > 0.45 ? 2 : 0.3),
    cooldown: 90,
    *run(s, o) {
      yield o.go(U().gym);
      o.face(-1); // following along with a video on the telly
      B.log(`${name()} does her evening exercises along with a video.`);
      yield o.hold('stretch', 2);
      for (let i = 0; i < 6; i++) {
        // star jumps
        yield o.hold('cheer', 0.35);
        yield o.hold('stand', 0.3);
      }
      for (let i = 0; i < 4; i++) {
        // squats
        yield o.hold('crouch', 0.6);
        yield o.hold('hips', 0.5);
      }
      o.face(1);
      yield o.hold('reach', 1.2);
      o.face(-1);
      yield o.hold('reach', 1.2);
      o.emote('sweat', 1.6);
      o.adjust('energy', -0.05);
      o.moodUp(0.08);
      yield o.hold('hips', 1.5);
    },
  });

  B.activity({
    id: 'mobile-chat',
    area: 'upstairs',
    weight: 2,
    cooldown: 40,
    *run(s, o) {
      o.holding = 'mobile';
      const who = B.pick(['her sister', 'an old school friend', 'her nephew', 'a fellow bookseller']);
      B.log(`${name()} chats to ${who} on her mobile.`);
      const dur = B.rnd(15, 30);
      let t = 0;
      while (t < dur) {
        const w = B.rnd(1.5, 3);
        if (B.chance(0.5)) yield o.go(B.rnd(...B.LAYOUT.upstairsRange), { speed: 0.6 });
        else o.face(B.pick(['side', 'side', 'away']));
        o.emote(B.pick(['talk', 'talk', 'talk', 'spark', 'heart', 'what']), 1.3);
        yield w;
        t += w + 1;
      }
      o.holding = null;
      o.moodUp(0.06);
    },
  });

  B.activity({
    id: 'read-upstairs',
    area: 'upstairs',
    weight: (s, o) => 1.5 + (o.mood < 0.4 ? 1 : 0),
    cooldown: 30,
    *run(s, o) {
      yield o.go(U().chair);
      o.face(1);
      o.bookC = B.pick(B.pal.books);
      o.holding = 'book';
      o.pose = 'sitread';
      yield B.rnd(15, 30);
      if (B.chance(0.3)) o.emote('heart', 1.4);
      o.holding = null;
    },
  });

  B.activity({
    id: 'evening-tea',
    area: 'upstairs',
    weight: 1.5,
    cooldown: 45,
    *run(s, o) {
      yield o.go(U().kitchen);
      o.face('away');
      s.upstairs.kettle = 1;
      yield o.hold('shelve', 3);
      s.upstairs.kettle = 0;
      o.holding = 'cup';
      yield o.go(U().windowA);
      o.face(B.chance(0.3) ? 0 : 'side'); // sometimes sips while looking out at the street
      yield o.hold('drink', 1.5);
      yield 2;
      yield o.hold('drink', 1.5);
      o.emote('coffee', 1.4);
      o.holding = null;
    },
  });

  B.activity({
    id: 'water-geraniums',
    area: 'upstairs',
    weight: 0.6,
    cooldown: 120,
    *run(s, o) {
      yield o.go(U().windowA);
      o.face(0);
      o.pose = 'water';
      for (let i = 0; i < 4; i++) {
        s.particle({ layer: 'out', x: B.rnd(46, 82), y: 44, vx: 0, vy: 10, vy2: 60, life: 0.4, c: '#74c0fc' });
        yield 0.5;
      }
      o.pose = 'stand';
    },
  });

  B.activity({
    id: 'gaze-out-upstairs',
    area: 'upstairs',
    weight: (s, o) => (s.weather.rain > 0.5 ? 2 : 0.8),
    cooldown: 30,
    *run(s, o) {
      yield o.go(B.pick([U().windowA, U().windowB]));
      o.face(0);
      yield 2;
      o.emote(s.weather.rain > 0.5 ? 'rain' : B.pick(['heart', 'dots', 'note']), 1.8);
      yield 3;
    },
  });
})(window.Bookshop);
