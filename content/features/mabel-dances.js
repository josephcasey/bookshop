/* 2026-10-08 (Mabel the dancer)
 * Mabel trained as a dancer, and it shows when the right music comes on:
 * - Radio Swiss Classic: she takes the counter top as a barre (leg along it, port de bras), then out on the floor:
 *   plies, an arabesque, a pirouette, and a reverence to nobody in particular.
 * - WWOZ (New Orleans jazz): the Charleston, knees knocking, arms swinging.
 * - When the radio's off she takes her ukulele down from its hook and plays a little tune of her own (an original:
 *   a cheerful buddy-song strum, not anybody's published melody). Evenings in the flat, she plays it in her armchair. */
(function (B) {
  const name = () => B.ownerName();
  const UKE_HOOK = { x: 105, y: 95 };
  const station = (s) => (s.radio.on && s.radio.station ? s.radio.station.id : null);
  const free = (s, o) => o.area === 'inside' && s.customersInside() === 0 && o.energy > 0.2;

  // ---------- the ukulele on its hook ----------
  B.decor({
    id: 'ukulele-hook',
    layer: 'interior-back',
    draw(g, s) {
      if (s.owner.pose === 'ukulele' && s.owner.area === 'inside') return; // she's got it
      const { x, y } = UKE_HOOK;
      const c = B.theme === 'cyber' ? '#3a2a5a' : '#c8843a';
      B.px(g, '#3a3a3a', x + 2, y - 2, 1, 2); // the hook
      B.px(g, '#7a4a20', x + 2, y, 1, 7); // the neck, hanging down
      B.px(g, c, x, y + 7, 5, 4); // the body
      B.px(g, c, x + 1, y + 6, 3, 1);
      B.px(g, '#3a2010', x + 2, y + 8, 1, 1);
      if (B.theme === 'cyber') B.px(g, '#3ff5ff', x, y + 10, 5, 1); // an LED strip on the neon city's uke
    },
  });

  // ---------- her tune (original) ----------
  // C | Am | Dm7 | G7 | C | F | G7 | C, a strum on every beat and a little melody over it
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
  const CHORDS = [
    [60, 64, 67, 72], // C
    [57, 60, 64, 69], // Am
    [62, 65, 69, 72], // Dm7
    [55, 59, 62, 65], // G7
    [60, 64, 67, 72], // C
    [53, 57, 60, 65], // F
    [55, 59, 62, 65], // G7
    [60, 64, 67, 72], // C
  ];
  // melody: [beat within the 32, MIDI note, length in beats]
  const MELODY = [
    [0, 76, 1], [1, 79, 1], [2, 81, 1], [3, 79, 1],
    [4, 72, 1.5], [5.5, 74, 0.5], [6, 76, 2],
    [8, 77, 1], [9, 81, 1], [10, 79, 1], [11, 77, 1],
    [12, 74, 2], [14, 71, 1], [15, 74, 1],
    [16, 76, 1], [17, 72, 1], [18, 79, 2],
    [20, 81, 1], [21, 79, 1], [22, 77, 1], [23, 76, 1],
    [24, 74, 1], [25, 76, 1], [26, 77, 1], [27, 79, 1],
    [28, 84, 2], [30, 79, 1], [31, 72, 1],
  ];
  const BEAT = 0.52;
  B.audio.define('uke-tune', ({ tone, shop }, reps = 2) => {
    const pluck = (f, at, vol, dur = 0.5) => {
      tone(f, dur, { type: 'triangle', vol, at, a: 0.004, lp: 3200, bus: shop });
      tone(f * 2, dur * 0.4, { type: 'sine', vol: vol * 0.3, at, a: 0.002, lp: 4000, bus: shop }); // the bright nylon edge
    };
    for (let r = 0; r < reps; r++) {
      const t0 = r * 32 * BEAT;
      CHORDS.forEach((ch, bar) => {
        for (let b = 0; b < 4; b++) {
          const at = t0 + (bar * 4 + b) * BEAT;
          const down = b % 2 === 0;
          (down ? ch : ch.slice().reverse()).forEach((n, i) => pluck(N(n), at + i * 0.012, down ? 0.012 : 0.008, 0.35));
        }
      });
      for (const [b, n, len] of MELODY) pluck(N(n), t0 + b * BEAT, 0.02, len * BEAT * 0.9);
    }
  });
  const TUNE_SECONDS = 32 * BEAT;

  const notes = (s, o) => {
    if (s.particle) s.particle({ layer: o.area === 'upstairs' ? 'out' : 'in', x: o.x + 4 * (o.dir || 1), y: B.headTop(o) - 2, vx: B.rnd(-6, 6), vy: -10, life: 2, c: '#f2c94c', kind: 'note' });
  };

  B.activity({
    id: 'ukulele',
    weight: (s, o) => (o.mood > 0.35 ? 1.6 : 0.4),
    cooldown: 75,
    when: (s, o) => free(s, o) && !s.radio.on,
    *run(s, o) {
      yield o.go(UKE_HOOK.x + 2);
      o.face('away');
      yield o.hold('reach', 0.8); // lifts it off the hook
      o.face(0);
      o.pose = 'ukulele';
      B.log(B.pick([`${name()} takes her ukulele down and plays a little tune.`, `${name()} strums her ukulele, humming along.`, `A ukulele interlude from ${name()}.`]));
      const reps = B.chance(0.5) ? 2 : 1;
      B.audio.play('uke-tune', reps);
      let t = 0;
      while (t < TUNE_SECONDS * reps) {
        yield 1;
        t += 1;
        if (B.chance(0.35)) notes(s, o);
      }
      o.emote('happy', 1.4);
      o.face('away');
      yield o.hold('reach', 0.6); // back on its hook
      o.pose = 'stand';
    },
  });
  B.activity({
    id: 'ukulele-flat',
    area: 'upstairs',
    weight: (s, o) => (o.mood > 0.35 ? 1.4 : 0.4),
    cooldown: 120,
    when: (s) => !s.upstairs.tv,
    *run(s, o) {
      yield o.go(B.LAYOUT.upstairsSpots.chair);
      o.face(1);
      o.pose = 'situke';
      B.log(`${name()} plays her ukulele in the armchair.`);
      B.audio.play('uke-tune', 2);
      let t = 0;
      while (t < TUNE_SECONDS * 2) {
        yield 1;
        t += 1;
        if (B.chance(0.3)) notes(s, o);
      }
      o.pose = 'sit';
      yield 1;
    },
  });

  // ---------- ballet, when Radio Swiss Classic is on ----------
  B.activity({
    id: 'ballet',
    weight: (s) => (station(s) === 'swissclassic' ? 16 : 0),
    cooldown: 25,
    when: (s, o) => free(s, o) && station(s) === 'swissclassic',
    *run(s, o) {
      // the counter top makes a good barre
      yield o.go(140);
      o.face(1);
      B.log(B.pick([`${name()} takes the counter as a barre: a dancer never forgets.`, `Radio Swiss Classic: ${name()} warms up at the counter like it's a barre.`]));
      yield o.hold('stretch', 1.5);
      yield o.hold('barre', 4);
      yield o.hold('portdebras', 3);
      yield o.hold('barre', 3);
      // then out on the floor
      yield o.go(88); // in front of the dark arch, where she stands out
      o.face(0);
      yield o.hold('plie', 5);
      yield o.hold('portdebras', 4);
      o.face(1);
      yield o.hold('arabesque', 3);
      // a pirouette: round she goes
      for (let i = 0; i < 8; i++) {
        o.pose = 'pirouette';
        const k = i % 4;
        o.backView = k === 2;
        o.dir = k === 1 ? 1 : k === 3 ? -1 : 0;
        yield 0.13;
      }
      o.backView = false;
      o.face(0);
      yield o.hold('portdebras', 2);
      yield o.hold('reverence', 2); // a bow, to nobody in particular
      if (B.chance(0.5)) o.emote('heart', 1.4);
      o.pose = 'stand';
    },
  });

  // ---------- the Charleston, when WWOZ is on ----------
  B.activity({
    id: 'charleston',
    weight: (s) => (station(s) === 'wwoz' ? 16 : 0),
    cooldown: 25,
    when: (s, o) => free(s, o) && station(s) === 'wwoz',
    *run(s, o) {
      yield o.go(88);
      o.face(0);
      B.log(B.pick([`WWOZ gets ${name()} doing the Charleston.`, `${name()} can't resist a Charleston to the New Orleans jazz.`]));
      yield o.hold('charleston', 6);
      yield o.hold('clap', 1);
      yield o.hold('charleston', 6);
      if (B.chance(0.5)) o.emote('happy', 1.4);
      o.pose = 'stand';
    },
  });
})(window.Bookshop);
