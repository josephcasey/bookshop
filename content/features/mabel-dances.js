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
  // I vi ii7 V7 I IV(iv) V7 I on real ukulele shapes (re-entrant GCEA, low to high as strung: G C E A)
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
  const C = [67, 60, 64, 72]; // 0003
  const A7 = [67, 61, 64, 69]; // 0100
  const Dm7 = [69, 62, 65, 72]; // 2213
  const G7 = [67, 62, 65, 71]; // 0212
  const F = [69, 60, 65, 69]; // 2010
  const Fm = [68, 60, 65, 72]; // 1013
  // a chord per half-bar (two beats each)
  const HARMONY = [C, C, A7, A7, Dm7, Dm7, G7, G7, C, C, F, Fm, G7, G7, C, C];
  // the island strum, per bar: down, down, up, up, down, up (the off-beats swung)
  const STRUM = [[0, 'D'], [1, 'D'], [1.6, 'U'], [2.6, 'U'], [3, 'D'], [3.6, 'U']];
  // an original melody: [beat, MIDI note, beats]; bar 5 answers bar 1
  const MELODY = [
    [0, 76, 1], [1, 79, 0.5], [1.5, 81, 1], [2.5, 79, 1.5],
    [4, 76, 1], [5, 72, 1], [6, 69, 2],
    [8, 77, 1], [9, 81, 0.5], [9.5, 79, 1], [10.5, 77, 1.5],
    [12, 74, 1], [13, 71, 1], [14, 67, 1], [15, 71, 1],
    [16, 76, 1], [17, 79, 0.5], [17.5, 81, 1], [18.5, 79, 1.5],
    [20, 81, 1], [21, 77, 1], [22, 80, 1.5], [23.5, 77, 0.5],
    [24, 74, 1], [25, 77, 1], [26, 76, 0.5], [26.5, 74, 1.5],
    [28, 72, 3], [31, 79, 1],
  ];
  const BEAT = 0.52;
  B.audio.define('uke-tune', ({ tone, shop }, reps = 2) => {
    const pluck = (f, at, vol, dur = 0.5) => {
      tone(f, dur, { type: 'triangle', vol, at, a: 0.004, lp: 3200, bus: shop });
      tone(f * 2, dur * 0.4, { type: 'sine', vol: vol * 0.3, at, a: 0.002, lp: 4000, bus: shop }); // the bright nylon edge
    };
    for (let r = 0; r < reps; r++) {
      const t0 = r * 32 * BEAT;
      const last = r === reps - 1;
      for (let bar = 0; bar < 8; bar++) {
        for (const [b, dir] of STRUM) {
          const beat = bar * 4 + b;
          if (last && beat >= 28) continue; // the last bar: one held chord instead
          const ch = HARMONY[Math.floor(beat / 2)];
          const at = t0 + beat * BEAT;
          if (dir === 'D') ch.forEach((n, i) => pluck(N(n), at + i * 0.012, 0.011, 0.38)); // down: all four, G to A
          else ch.slice(1).reverse().forEach((n, i) => pluck(N(n), at + i * 0.01, 0.006, 0.25)); // up: the top three, lighter
        }
      }
      for (const [b, n, len] of MELODY) {
        if (last && b === 28) pluck(N(n), t0 + b * BEAT, 0.02, 4 * BEAT * 0.9); // the final note held a full bar
        else if (last && b === 31) continue;
        else pluck(N(n), t0 + b * BEAT, 0.02, len * BEAT * 0.9);
      }
      if (last) C.forEach((n, i) => pluck(N(n), t0 + 28 * BEAT + i * 0.02, 0.013, 2 * BEAT * 1.6)); // ends on a held C
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
      // class order, phrased in eights (~72 bpm: an 8-count is about 6.7 s): plies at the barre first
      yield o.go(140);
      o.face(1);
      B.log(B.pick([`${name()} takes the counter as a barre: a dancer never forgets.`, `Radio Swiss Classic: ${name()} warms up at the counter like it's a barre.`]));
      yield o.hold('stretch', 1.5);
      yield o.hold('barreplie', 6.6);
      yield o.hold('barrepdb', 6);
      yield o.hold('barre', 4); // a leg along the barre, leaning over it
      // then the centre, in front of the dark arch
      yield o.go(88);
      o.face(0);
      yield o.hold('plie', 6);
      if (B.chance(0.35)) yield o.hold('grandplie', 6);
      yield o.hold('portdebras', 6);
      o.face(1);
      yield o.hold('arabesque', 3);
      // a pirouette: prepare, one spotted turn (the face longest, the back a blink), finish
      o.face(0);
      yield o.hold('pirprep', 0.8);
      for (const [d, back, dur] of [[0, false, 0.18], [1, false, 0.1], [0, true, 0.08], [-1, false, 0.1], [0, false, 0.18]]) {
        o.pose = 'pirouette';
        o.dir = d;
        o.backView = back;
        yield dur;
      }
      o.backView = false;
      o.face(0);
      yield o.hold('pirland', 0.5);
      yield o.hold('reverence', 3.3); // a bow, to nobody in particular
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
