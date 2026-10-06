/* The espresso machine and the wireless. */
(function (B) {
  const name = () => B.ownerName();

  B.activity({
    id: 'make-coffee',
    weight: (s, o) => (1 - o.energy) * 5 + (s.hour < 10.5 ? 2 : 0) + (o.mood < 0.4 ? 1 : 0),
    cooldown: 45,
    when: (s, o) => o.caffeine < 0.6 || (o.energy < 0.3 && o.caffeine < 0.9),
    *run(s, o) {
      if (s.counter.cup) {
        yield o.go('counter');
        s.counter.cup = false;
      }
      yield o.go('coffee');
      o.face('away');
      yield o.hold('shelve', 0.8);
      s.coffee.brew(B.rnd(4, 6));
      if (o.energy < 0.3) B.log(`${name()} shuffles to the espresso machine. She needs this.`);
      else if (B.chance(0.3)) B.log(`The espresso machine hisses and gurgles.`);
      o.pose = 'backstand';
      yield B.act.until(() => s.coffee.brewing <= 0, 10);
      o.pose = 'stand';
      o.holding = 'cup';
      yield o.go('counter');
      o.face('side');
      for (let i = 0; i < 3; i++) {
        yield o.hold('drink', 1.2);
        if (i === 0) {
          o.caffeine = B.clamp(o.caffeine + 0.4, 0, 1);
          o.moodUp(0.05);
          o.emote(o.energy < 0.3 ? 'coffee' : o.mood > 0.6 ? 'heart' : 'coffee', 1.5);
        }
        yield B.rnd(1.5, 3);
      }
      if (o.caffeine > 0.85) {
        o.emote('spark', 1.5);
        o.pose = 'clap';
        yield 1;
        o.pose = 'stand';
        B.log(`That was one espresso too many — ${name()} is positively buzzing.`);
      }
      o.holding = null;
      s.counter.cup = true;
    },
  });

  B.activity({
    id: 'radio-on',
    weight: (s, o) => (o.mood < 0.25 ? 0.5 : 3),
    cooldown: 20,
    when: (s) => !s.radio.on,
    *run(s, o) {
      yield o.go('radio');
      o.face('away');
      yield o.hold('shelve', 0.7);
      s.radio.turnOn();
      const st = s.radio.station;
      B.log(`${name()} switches on the radio: ${st.name}. ${st.says ? B.pick(st.says) : ''}`.trim());
      yield 0.8; // listens a moment before turning back to the shop
      o.face(1);
      o.emote(st.likes > 0.5 ? 'note' : 'dots', 1.4);
      yield 1;
    },
  });

  B.activity({
    id: 'radio-retune',
    weight: (s, o) => ((s.radio.station.likes || 0) < 0.3 ? 4 : 0.5),
    cooldown: 15,
    when: (s) => s.radio.on,
    *run(s, o) {
      yield o.go('radio');
      o.face('away');
      yield o.hold('shelve', 1.4);
      const st = s.radio.next();
      B.log(`${name()} retunes the radio to ${st.name}.`);
      yield o.hold('shelve', 0.4);
      o.emote(st.likes > 0.5 ? 'note' : st.likes < 0.2 ? 'dots' : 'happy', 1.5);
      yield 1;
    },
  });

  B.activity({
    id: 'radio-off',
    weight: (s, o) => (o.mood < 0.3 || o.energy < 0.2 ? 1.5 : 0.1),
    cooldown: 30,
    when: (s) => s.radio.on,
    *run(s, o) {
      yield o.go('radio');
      o.face('away');
      yield o.hold('shelve', 0.6);
      s.radio.turnOff();
      B.log(`${name()} turns the radio off. Some peace and quiet.`);
      o.face(1);
      yield o.hold('cross', 1.5);
    },
  });

  B.activity({
    id: 'dance',
    weight: (s, o) => 1 + (s.radio.station.likes || 0) * 3,
    cooldown: 30,
    when: (s, o) => s.radio.on && s.radio.station.music !== false && o.mood > 0.6 && o.energy > 0.3 && s.customersInside() === 0,
    *run(s, o) {
      yield o.go(B.rnd(...B.LAYOUT.ranges.open));
      o.face('side');
      B.log(`${name()} can't help a little dance to ${s.radio.station.name}.`);
      const dur = B.rnd(4, 8);
      let t = 0;
      o.pose = 'dance';
      while (t < dur) {
        o.emote('note', 1);
        yield 1.2;
        t += 1.2;
        if (B.chance(0.35)) o.face(B.pick([-1, 1, 'away']));
      }
      o.face('side');
      yield o.hold('cheer', 1);
      o.pose = 'stand';
      o.moodUp(0.05);
      yield 0.5;
    },
  });
})(window.Bookshop);
