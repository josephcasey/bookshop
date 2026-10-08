/* 2026-10-08 (SCH-21: the thief)
 * Now and then (every few days at most) a hooded figure loiters at the window, and if Mabel is distracted (upstairs,
 * in the back, dancing, on the phone or out at the kerb) slips in and pockets something: the radio, the telephone,
 * the desk lamp, the ukulele off its hook, or a couple of books. What goes really goes: it isn't drawn and it doesn't
 * work (no radio to play, no phone to ring, no lamp to switch on) until Mabel notices, sighs, orders a replacement,
 * and the delivery robot brings it (delivery-robots.js), when she puts it back where it belongs. Cosy, not menacing:
 * the cat sees them off sometimes, and by morning anything still missing has turned up (the insurance, presumably).
 * State: s.stolen = { radio, phone, lamp, ukulele, books: n } (saved), s.noticed (what she's seen is gone). */
(function (B) {
  const name = () => B.ownerName();
  const KEY = 'bookshop.stolen';
  const ITEMS = {
    radio: { x: 149, label: 'radio', parcel: '#b08850' },
    phone: { x: 152, label: 'telephone', parcel: '#b08850' },
    lamp: { x: 139, label: 'desk lamp', parcel: '#b08850' },
    ukulele: { x: 107, label: 'ukulele', parcel: '#c9a36a' },
    books: { x: 40, label: 'books', parcel: '#7a5a8a' },
  };
  const stolen = (s) => s.stolen || (s.stolen = {});
  const anyGone = (s) => Object.keys(ITEMS).some((k) => stolen(s)[k]);
  const save = (s) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stolen(s)));
    } catch (e) {
      /* private mode */
    }
  };
  B.thiefItems = ITEMS;

  // Mabel's attention is elsewhere: that's the thief's chance
  const distracted = (s) => {
    const o = s.owner;
    return o.area !== 'inside' || o.depth === 'passage' || o.hidden || o.onStage || o.holding === 'receiver' || (B.isDancePose && B.isDancePose(o.pose));
  };

  // ---------- what's gone stops working ----------
  B.on('ready', (s) => {
    try {
      s.stolen = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch (e) {
      s.stolen = {};
    }
    s.noticed = {};
    // no radio, nothing to switch on
    const r = s.radio;
    if (r && r.turnOn && !r._thiefWrapped) {
      const on = r.turnOn.bind(r);
      r.turnOn = (...a) => (stolen(s).radio ? undefined : on(...a));
      r._thiefWrapped = true;
    }
    // no phone, no calls; no ukulele, no tune
    const guard = (kind, id, key) => {
      const d = B.findDef(kind, id);
      if (!d || d._thiefWrapped) return;
      const w = d.when;
      d.when = (s2, o) => !stolen(s2)[key] && (w ? w(s2, o) : true);
      d._thiefWrapped = true;
    };
    guard('happening', 'phone-ring', 'phone');
    guard('activity', 'ukulele', 'ukulele');
    guard('activity', 'ukulele-flat', 'ukulele');
    const hook = B.findDef('decor', 'ukulele-hook');
    if (hook && !hook._thiefWrapped) {
      const draw = hook.draw;
      hook.draw = (g, s2) => (stolen(s2).ukulele ? undefined : draw(g, s2));
      hook._thiefWrapped = true;
    }
  });
  B.on('tick', (s) => {
    const st = stolen(s);
    if (st.radio && s.radio.on && s.radio.turnOff) s.radio.turnOff();
    if (st.lamp) s.lamp = false;
    // she notices what's missing once she's back in the shop and free to look about
    const o = s.owner;
    if (anyGone(s) && o.area === 'inside' && !distracted(s) && !s.npcs.some((n) => n.kind === 'thief' && n.area === 'inside')) {
      const fresh = Object.keys(ITEMS).filter((k) => st[k] && !s.noticed[k]);
      if (fresh.length && !(s._noticing && s.simT - s._noticing < 30)) {
        s._noticing = s.simT; // (asked once; again in 30 s if something more pressing came first)
        s.request('notice-theft', 5, { items: fresh });
      }
    }
  });
  B.on('newDay', (s) => {
    // by morning anything still missing has turned up
    if (anyGone(s)) {
      if (stolen(s).books) s.shelves.add(stolen(s).books);
      s.stolen = {};
      s.noticed = {};
      save(s);
    }
  });

  // ---------- the visit ----------
  B.happening({
    id: 'thief-visit',
    perHour: 0.05,
    when: (s) => s.shop.open && !anyGone(s) && !(s.dayStats.thefts > 0) && !s.npcs.some((n) => n.kind === 'thief'),
    *run(s) {
      s.dayStats.thefts = (s.dayStats.thefts || 0) + 1;
      B.spawn(s, 'thief');
    },
  });

  B.visitor({
    id: 'thief',
    spawn: false, // only via the happening
    setup(n) {
      n.speed = B.rnd(40, 48);
      n.umbrella = false;
      const cy = B.theme === 'cyber';
      n.look = B.randomLook({ top: cy ? '#2a1838' : '#3a3a44', bottom: '#22242c', hat: cy ? '#ff3fa4' : '#2a2a30', hatStyle: 'beanie', dress: false, scarf: cy ? '#3ff5ff' : '#4a4a52' });
    },
    *run(s, n) {
      // loiter at the window, glancing about
      yield n.walkTo(B.rnd(60, 190));
      n.pose = 'backstand';
      for (let i = 0; i < 3; i++) {
        yield B.rnd(1, 2);
        n.face(B.pick([-1, 1]));
        yield 0.6;
        n.pose = 'backstand';
      }
      if (!distracted(s) || !s.shop.open) {
        n.pose = 'stand';
        yield n.walkOff(); // not today
        return;
      }
      // in, quick, and out
      yield* n.enter(s);
      const st = stolen(s);
      const can = Object.keys(ITEMS).filter((k) => !st[k] && (k !== 'books' || s.shelves.count() > 6));
      const k = B.pick(can);
      yield n.walkTo(ITEMS[k].x);
      n.face('away');
      yield n.hold('reach', 0.9);
      if (k === 'books') {
        let took = 0;
        for (let i = 0; i < 2; i++) if (s.shelves.take(ITEMS.books.x)) took++;
        st.books = took;
      } else st[k] = true;
      save(s);
      n.holding = 'bag';
      n.face(1);
      // the cat isn't fooled
      if (s.cat && B.chance(0.5)) {
        s.cat.emote && s.cat.emote('angry', 1.6);
        B.audio.play('meow');
        n.emote('sweat', 1.2);
        n.speed *= 1.5;
      }
      yield* n.exit(s);
      if (s.owner.area === 'inside' && B.chance(0.4)) {
        s.owner.emote('what', 1.4);
        B.log(`${name()} glimpses a hooded figure hurrying away from the door.`);
      }
      n.speed = 70; // and away
      yield n.walkOff();
    },
  });

  // ---------- noticing, and ordering a replacement ----------
  B.activity({
    id: 'notice-theft',
    idle: false,
    priority: 5,
    resume: false,
    *run(s, o, d) {
      try {
        yield* notice(s, o, (d && d.items) || []);
      } finally {
        s._noticing = 0;
      }
    },
  });
  function* notice(s, o, items) {
    if (!items.length) return;
    const k0 = items[0];
    yield o.go(B.clamp(ITEMS[k0].x, 20, 200));
    o.face('away');
    yield 0.8;
    o.emote(B.pick(['what', 'angry', 'sigh']), 1.8);
    for (const k of items) s.noticed[k] = true;
    const what = items.map((k) => (k === 'books' ? `${stolen(s).books || 2} books from the shelves` : `the ${ITEMS[k].label}`));
    B.log(`${name()} stares at the empty space. ${what.join(' and ').replace(/^./, (c) => c.toUpperCase())} ${items.length > 1 || k0 === 'books' ? 'have' : 'has'} gone!`);
    yield o.hold('facepalm', 1.4);
    o.moodDown(0.08);
    // a replacement, by robot (it rides along with any shopping already ordered)
    o.holding = 'mobile';
    o.face(0);
    yield o.hold('stand', 2.5);
    o.holding = null;
    const ord = s.robotOrder && !s.robotOrder.sent ? s.robotOrder : (s.robotOrder = { items: [], due: s.simT + B.rnd(60, 120), sent: false });
    ord.replace = (ord.replace || []).concat(items.filter((k) => !(ord.replace || []).includes(k)));
    ord.cargoC = ITEMS[k0].parcel;
    for (const k of items) ord.items.push(k === 'books' ? 'some replacement books' : `a new ${ITEMS[k].label}`);
    B.log(`${name()} orders ${items.map((k) => (k === 'books' ? 'replacement books' : `a new ${ITEMS[k].label}`)).join(' and ')} for delivery by robot.`);
  }

  /** Called by delivery-robots.js when she's collected a delivery: put back whatever it replaces. */
  B.restoreStolen = function* (s, o, keys) {
    for (const k of keys) {
      const it = ITEMS[k];
      if (!it) continue;
      yield o.go(B.clamp(it.x, 20, 200));
      o.face('away');
      yield o.hold(k === 'books' ? 'shelve' : 'reach', 1);
      if (k === 'books') s.shelves.add(stolen(s).books || 2);
      stolen(s)[k] = k === 'books' ? 0 : false;
      delete s.noticed[k];
      B.log(`${name()} puts the new ${it.label} back where ${k === 'books' ? 'they belong' : 'it belongs'}.`);
    }
    save(s);
    o.emote('happy', 1.4);
    o.moodUp(0.05);
  };
})(window.Bookshop);
