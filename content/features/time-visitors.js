/* 2026-10-08 (SCH-22: two curious visitors with a gadget)
 * An affectionate homage, kept generic on purpose: no names, no box, no theme, no borrowed sounds. Once every few days,
 * in shop hours, a floppy-haired man in a tweed jacket and bow tie strides up the pavement, a red-haired friend in a
 * leather jacket hurrying after him. He sweeps a buzzing pocket gadget along the shopfront (the pilasters, the window
 * frame), holds it up, frowns at it and gives it a shake; she raps on the bricks and asks if he's sure. Then they come
 * in and do the walls and the bookcases. Mabel watches, amused, and offers them a book; sometimes he buys one. Then,
 * as if called away, they hurry off.
 * The gadget's sound is our own: a stepped, rising-then-falling triangle warble (not a steady whine) ending in a soft
 * upward chirp. Footsteps come from foley.js; the brick rap is a duller cousin of the door knock.
 * The man runs the visit (n.phase); his friend follows the phases from her own script (n.lead). */
(function (B) {
  const name = () => B.ownerName();
  const L = B.LAYOUT;

  // ---------- sounds (original synthesis) ----------
  B.audio.define('gadget', ({ tone, street }, onStreet) => {
    const o = onStreet ? { bus: street } : {};
    // up three steps and back down, two quick notes a step (a warble you could hum, not a whine)
    const steps = [520, 610, 720, 610, 560];
    steps.forEach((f, i) => {
      tone(f, 0.07, { ...o, type: 'triangle', vol: 0.035, at: i * 0.15 });
      tone(f * 1.19, 0.06, { ...o, type: 'triangle', vol: 0.03, at: i * 0.15 + 0.075 });
    });
    tone(1500, 0.12, { ...o, type: 'sine', vol: 0.025, at: steps.length * 0.15 + 0.05, slide: 2300 }); // the chirp
  });
  B.audio.define('brick-rap', ({ tone, noise, street }, onStreet) => {
    const o = onStreet ? { bus: street } : {};
    [0, 0.18].forEach((at) => {
      tone(110, 0.05, { ...o, type: 'triangle', vol: 0.12, at, slide: 80 });
      noise(0.025, { ...o, freq: 700, q: 1, vol: 0.04, at });
    });
  });

  const busy = (s) => s.npcs.some((n) => n.kind === 'gadget-man' || n.kind === 'thief');
  const inShop = (n) => n.area === 'inside';

  // one sweep of the gadget at the wall in front of him: point, buzz, hold it up, frown, shake
  function* sweep(s, n, along) {
    n.face(along);
    n.gadgetOn = true;
    B.audio.play('gadget', !inShop(n));
    yield n.hold('point', 1.1);
    n.face(-along);
    yield n.hold('point', 0.7);
    n.gadgetOn = false;
    yield n.hold('reach', 0.9); // held up to read
    n.emote(B.pick(['dots', 'what']), 1.2);
    if (B.chance(0.6)) {
      n.gadgetOn = true;
      yield n.hold('shake', 0.8);
      n.gadgetOn = false;
    }
  }

  B.happening({
    id: 'gadget-visit',
    perHour: 0.04, // a few days apart
    when: (s) => s.shop.open && !(s.dayStats.gadgetVisits > 0) && !busy(s),
    *run(s) {
      s.dayStats.gadgetVisits = (s.dayStats.gadgetVisits || 0) + 1;
      const fromLeft = B.chance(0.5);
      const man = B.spawn(s, 'gadget-man', { fromLeft });
      if (man) B.spawn(s, 'gadget-friend', { fromLeft, props: { lead: man, x: fromLeft ? L.edgeL - 16 : L.edgeR + 16 } });
    },
  });

  B.visitor({
    id: 'gadget-man',
    spawn: false, // only via the happening
    look: () => {
      const cy = B.theme === 'cyber';
      return B.randomLook({
        skin: '#ecc4a4',
        hair: '#5a3a24',
        hairStyle: 'spiky', // a floppy fringe, near enough at this size
        top: cy ? '#4a3a5a' : '#7a5a3e', // tweed
        top2: cy ? '#3ff5ff' : '#e8e2d6', // the shirt (in cyber, a neon trim down the jacket front)
        buttons: '#3a2a1a',
        bowtie: cy ? '#ff3fa4' : '#8a1f2a',
        bottom: '#2e2a30',
        dress: false,
        hat: null,
        glasses: false,
        beard: false,
        scarf: null,
        h: 2,
      });
    },
    setup(n) {
      n.speed = B.rnd(62, 70); // he walks fast
      n.umbrella = false;
      n.holding = 'gadget';
      n.phase = 'arrive';
    },
    *run(s, n) {
      // along the shopfront: the pilaster by the door, the window frame, the far pilaster
      const fromRight = n.dir < 0;
      const outside = fromRight ? [222, 170, 70, 16] : [16, 70, 170, 222]; // (16: the left pilaster, clear of the edge)
      for (const x of outside) {
        n.phase = 'outside';
        yield n.walkTo(x);
        n.face('away');
        yield* sweep(s, n, fromRight ? -1 : 1);
        if (x === outside[1]) B.log('A man in a bow tie runs a buzzing gadget along the shop wall, peering at the readout.');
      }
      if (!s.shop.open) {
        n.phase = 'leave';
        yield n.walkOff();
        return;
      }
      n.phase = 'enter';
      yield* n.enter(s);
      n.phase = 'inside';
      s.dayStats.visitors++;
      const o = s.owner;
      if (inShop(o)) {
        o.faceX(n.x);
        o.emote(B.pick(['what', 'dots']), 1.6);
      }
      // the walls and the bookcases
      for (const x of [B.rnd(18, 30), B.rnd(46, 58), B.rnd(114, 126)]) {
        yield n.walkTo(x);
        n.face('away');
        yield* sweep(s, n, B.pick([-1, 1]));
      }
      B.log("'Huh. Just walls,' he says, sounding disappointed.");
      if (inShop(o)) {
        o.emote(B.pick(['happy', 'book']), 1.6);
        B.log(`${name()}, amused, offers them a book on the history of the street.`);
      }
      // sometimes he takes her up on it
      if (B.chance(0.5) && s.shelves.count() > 0) {
        const slot = s.shelves.take(n.x);
        n.bookC = slot ? slot.c : B.pick(B.pal.books);
        n.bookTitle = B.pick(B.titles);
        n.holding = 'book';
        n.phase = 'buy';
        yield* n.payAtTill(s, 20);
        n.holding = 'gadget';
      }
      // called away
      n.phase = 'leave';
      n.emote('spark', 1);
      B.log('He glances at his gadget, says something about being late, and they hurry out.');
      n.speed = 82;
      yield* n.exit(s);
      n.phase = 'gone';
      yield n.walkOff();
    },
  });

  B.visitor({
    id: 'gadget-friend',
    spawn: false, // only alongside the man
    look: () => {
      const cy = B.theme === 'cyber';
      return B.randomLook({
        skin: '#f2cdb4',
        hair: cy ? '#ff5a3a' : '#c4401e',
        hairStyle: 'long',
        top: cy ? '#2a1838' : '#3a2822', // a leather jacket
        top2: cy ? '#ff3fa4' : '#cfc6b8',
        bottom: '#2a2e3a', // a short skirt
        dress: true,
        tights: '#1e1e24',
        shoes: '#2a1a14',
        hat: null,
        glasses: false,
        scarf: null,
        h: 0,
      });
    },
    setup(n) {
      n.speed = B.rnd(70, 78); // hurrying to keep up
      n.umbrella = false;
    },
    *run(s, n) {
      const lead = n.lead;
      const alive = () => lead && s.npcs.includes(lead) && lead.phase !== 'gone';
      // a step behind him, or a step ahead when behind would put her off the end of the shopfront
      const behind = () => {
        const x = lead.x - (lead.dir || 1) * 14;
        return x < 8 || x > 236 ? lead.x + (lead.dir || 1) * 14 : x;
      };
      let rapped = false;
      // keep a step behind him along the shopfront, rapping on the bricks
      while (alive() && lead.phase === 'arrive') yield 0.2;
      while (alive() && lead.phase === 'outside') {
        if (Math.abs(n.x - behind()) > 6) yield n.walkTo(B.clamp(behind(), 8, 236));
        else if (!lead.moving && B.chance(0.25)) {
          n.face('away');
          yield n.hold('reach', 0.4);
          B.audio.play('brick-rap', true);
          if (!rapped) {
            rapped = true;
            B.log("His red-haired friend raps on the bricks and asks if he's sure.");
          }
          yield n.hold('hips', 1);
        } else yield 0.3;
      }
      if (!alive() || lead.phase === 'leave') {
        yield n.walkOff();
        return;
      }
      // in after him
      while (alive() && lead.phase === 'enter') yield 0.2;
      yield* n.enter(s);
      while (alive() && (lead.phase === 'inside' || lead.phase === 'buy')) {
        const want = lead.phase === 'buy' ? 160 : B.clamp(behind(), 16, 200);
        if (Math.abs(n.x - want) > 8) yield n.walkTo(want);
        else {
          n.face('away');
          yield n.hold(B.pick(['browse', 'hips', 'think']), B.rnd(1, 2));
        }
      }
      n.speed = 86;
      yield* n.exit(s);
      yield n.walkOff();
    },
  });
})(window.Bookshop);
