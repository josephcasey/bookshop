/* 2026-10-09 (SCH-37: a visitor from a collective, a homage)
 * Very rarely, when the shop is quiet, a pale cybernetic drone in black armour (a red-lit eyepiece, tubes at the
 * neck) shimmers into the shop in a column of sparkling light, walks up to Mabel and reaches out with a cluster of
 * tubules. When it lets go she has an eyepiece, a cheek plate and a tube at her neck, and the two of them dissolve
 * into sparkles. Ten seconds later Mabel shimmers back, alone and a little dazed, prises off each implant (they
 * clatter onto the counter) and tidies them into the drawer under the counter.
 * A generic homage: no names, no catchphrases, no borrowed sounds; the teleport shimmer and its chime are original. */
(function (B) {
  const name = () => B.ownerName();
  const sparkle = (s, x, top, bottom, n = 14) => {
    for (let i = 0; i < n; i++)
      s.particle({ layer: 'in', x: x + B.rnd(-5, 5), y: B.rnd(top, bottom), vx: 0, vy: B.rnd(-14, -4), life: B.rnd(0.4, 1), c: B.pick(['#e8f4ff', '#9fd8ff', '#ffffff', '#c8b8ff']) });
  };
  // the shimmer: a cluster of soft bell partials swelling and fading, a little tremolo (not anybody's famous sound)
  B.audio.define('shimmer', ({ tone, shop }, up = true) => {
    const base = up ? 660 : 990;
    [1, 1.5, 2, 2.5, 3].forEach((m, i) => tone(base * m, 1.4, { type: 'sine', vol: 0.012, a: 0.35, at: i * 0.06, slide: base * m * (up ? 1.06 : 0.94), bus: shop }));
  });
  B.audio.define('clatter-small', ({ tone, shop }) => {
    tone(1300, 0.05, { type: 'triangle', vol: 0.02, slide: 900, bus: shop });
    tone(1700, 0.04, { type: 'triangle', vol: 0.014, at: 0.06, slide: 1200, bus: shop });
  });

  B.look('cyber-drone', { skin: '#c4c8cc', hair: '#c4c8cc', hairStyle: 'bald', top: '#1e2024', top2: '#3a3e46', bottom: '#16181c', shoes: '#0e0f12', h: 1, keep: true }); // (keep: not restyled by the neon theme)

  // ---------- the visit ----------
  const quiet = (s) => s.owner.area === 'inside' && !s.owner.hidden && s.owner.depth !== 'passage' && s.customersInside() === 0 && !s.npcs.some((n) => n.kind === 'drone-visitor');
  B.happening({
    id: 'drone-visit',
    perHour: 0.03, // a few days apart
    when: (s) => quiet(s) && !(s.dayStats.droneVisits > 0) && !s.owner.implants,
    *run(s) {
      s.dayStats.droneVisits = 1;
      const o = s.owner;
      B.spawn(s, 'drone-visitor', { props: { area: 'inside', depth: 'front', x: B.clamp(o.x + (o.x > 150 ? -22 : 22), 30, 200), alpha: 0, umbrella: false } });
    },
  });

  B.visitor({
    id: 'drone-visitor',
    spawn: false,
    look: 'cyber-drone',
    setup(n) {
      n.speed = 18; // a heavy, deliberate tread
    },
    *run(s, n) {
      const o = s.owner;
      // shimmer in
      B.audio.play('shimmer', true);
      B.log('A column of sparkling light forms in the shop, and a pale figure in black armour steps out of it.');
      for (let k = 0; k <= 12; k++) {
        n.alpha = k / 12;
        sparkle(s, n.x, B.headTop(n), n.y, 6);
        yield 0.1;
      }
      n.face(o.x > n.x ? 1 : -1);
      s.request('meet-drone', 9, { drone: n });
      yield n.walkTo(o.x + (o.x > n.x ? -12 : 12));
      n.face(o.x > n.x ? 1 : -1);
      n.pose = 'point';
      n.tubules = 1;
      B.log(`It reaches out to ${name()} with a cluster of fine tubules. ${name()} stands very still.`);
      yield 2.2;
      o.implants = 3; // eyepiece, cheek plate, neck tube
      n.tubules = 0;
      n.pose = 'stand';
      B.log(`When it lets go, ${name()} has an eyepiece, a cheek plate and a tube at her neck.`);
      yield 1.2;
      // both of them, away
      n.beamOut = true;
      s.droneBeam = true; // (meet-drone takes Mabel with it)
      B.audio.play('shimmer', false);
      for (let k = 12; k >= 0; k--) {
        n.alpha = k / 12;
        sparkle(s, n.x, B.headTop(n), n.y, 6);
        yield 0.1;
      }
      n.area = 'away';
      n.hidden = true;
      n.x = -999;
      n.remove = true;
    },
  });

  // Mabel's side of it: she stops what she's doing, is taken, comes back, and tidies up
  B.activity({
    id: 'meet-drone',
    idle: false,
    priority: 9,
    resume: false,
    *run(s, o, d) {
      const n = d && d.drone;
      o.face(n && n.x > o.x ? 1 : -1);
      o.emote('bang', 1.2);
      o.pose = 'stand';
      // held still until the drone beams out (or gives up)
      let waited = 0;
      while (!s.droneBeam && waited < 30 && n && !n.remove) {
        yield 0.2;
        waited += 0.2;
      }
      if (!s.droneBeam) return;
      s.droneBeam = false;
      for (let k = 12; k >= 0; k--) {
        o.alpha = k / 12;
        sparkle(s, o.x, B.headTop(o), o.y, 6);
        yield 0.1;
      }
      o.hidden = true;
      B.log(`${name()} and her visitor dissolve into sparkles. The shop is very quiet.`);
      // she comes back ten seconds later whatever else happens (a tick hook below brings her back, so nothing that
      // interrupts this activity can leave her away for good); meanwhile she's busy being elsewhere
      s.abduction = { back: s.simT + 10 };
      while (s.abduction) yield 0.2;
    },
  });
  B.on('tick', (s) => {
    const a = s.abduction;
    const o = s.owner;
    if (!a) return;
    if (!a.returning && s.simT < a.back) {
      // still away: whatever else is going on, nobody sees her until she's back
      o.hidden = true;
      o.alpha = 0;
      return;
    }
    if (!a.returning) {
      // back again, alone
      a.returning = s.simT;
      o.hidden = false;
      o.area = 'inside';
      o.alpha = 0;
      B.audio.play('shimmer', true);
      B.log(`${name()} shimmers back into the shop, alone, blinking, gadgets still clamped to her face.`);
    }
    if (a.returning) {
      o.alpha = Math.min(1, (s.simT - a.returning) / 1.2);
      if (Math.random() < 0.6) sparkle(s, o.x, B.headTop(o), o.y, 2);
      if (o.alpha >= 1) {
        s.abduction = null;
        o.emote('what', 1.6);
        s.request('remove-implants', 8);
      }
    }
  });
  // off they come, one by one, and into the drawer (also picked up by itself if anything got in the way)
  B.activity({
    id: 'remove-implants',
    priority: 8,
    resume: false,
    weight: (s, o) => (o.implants > 0 && !o.hidden ? 50 : 0),
    when: (s, o) => o.implants > 0 && !o.hidden && !s.abduction && o.area === 'inside',
    *run(s, o) {
      yield 1.2;
      const bits = ['the eyepiece', 'the cheek plate', 'the neck tube'];
      while (o.implants > 0) {
        o.face(0);
        yield o.hold('reach', 1.1);
        o.implants--;
        B.audio.play('clatter-small');
        s.particle({ layer: 'in', x: o.x + 3, y: B.headTop(o) + 6, vx: B.rnd(6, 14), vy: -10, vy2: 160, life: 0.7, c: '#5a5e66' });
        if (B.chance(0.6)) B.log(`${name()} prises off ${bits[2 - o.implants]}.`);
        yield 0.5;
      }
      yield o.go('counter');
      o.face('away');
      yield o.hold('unpack', 1.6);
      B.log(B.pick([`${name()} tidies the implants into the drawer under the counter, and puts the kettle on.`, `${name()} files the implants in the drawer with the spare till rolls. Strange sort of day.`]));
      o.emote('sigh', 1.4);
      o.moodDown(0.03);
    },
  });

  // ---------- drawing: the implants on Mabel, the drone's eyepiece and tubules ----------
  function head(a) {
    const top = Math.round(B.headTop(a));
    const fd = a.dir || 1;
    const side = a.dir !== 0 && !a.backView;
    return { x: Math.round(a.x) - 4 + (side ? fd : 0), y: top, fd, side, back: !!a.backView };
  }
  function drawImplants(g, a, k, laser) {
    const P = (c, x, y, w = 1, h = 1) => B.px(g, c, x, y, w, h);
    const h = head(a);
    if (h.back) {
      if (k >= 3) P('#2a2c30', h.x + 6, h.y + 7, 1, 4); // the tube, from behind
      return;
    }
    const ex = h.side ? (h.fd > 0 ? h.x + 5 : h.x + 1) : h.x + 1; // her (left) eye
    if (k >= 1) {
      P('#3a3e46', ex - 1, h.y + 3, 3, 3); // the eyepiece
      P(Math.floor(performance.now() / 400) % 2 ? '#ff2a2a' : '#a01010', ex, h.y + 4); // its red light
      if (laser) P('rgba(255,40,40,0.5)', ex + (h.fd > 0 ? 2 : -6), h.y + 4, 5, 1);
    }
    if (k >= 2) P('#7a7e86', ex - 1, h.y + 6, 2, 2); // the cheek plate
    if (k >= 3) {
      P('#2a2c30', h.side ? (h.fd > 0 ? h.x + 2 : h.x + 5) : h.x + 6, h.y + 6, 1, 4); // the tube to the neck
      P('#5a5e66', h.side ? (h.fd > 0 ? h.x + 2 : h.x + 5) : h.x + 6, h.y + 9, 1, 1);
    }
  }
  const drawFor = (depthWanted) => (g, s) => {
    const o = s.owner;
    if (o.implants > 0 && o.area === 'inside' && !o.hidden && (o.depth === 'front') === (depthWanted === 'front')) {
      g.globalAlpha = o.alpha == null ? 1 : o.alpha;
      drawImplants(g, o, o.implants, false);
      g.globalAlpha = 1;
    }
    for (const n of s.npcs) {
      if (n.kind !== 'drone-visitor' || n.hidden || (n.depth === 'front') !== (depthWanted === 'front')) continue;
      g.globalAlpha = n.alpha == null ? 1 : n.alpha;
      drawImplants(g, n, 3, true);
      // its armour's tubing and plates
      const h = head(n);
      B.px(g, '#2a2c30', h.x + 1, h.y + 9, 6, 1);
      B.px(g, '#4a4e56', h.x - 1, h.y + 1, 2, 3);
      if (n.tubules) {
        // the tubules reaching out from its hand
        const fd = n.dir || 1;
        const hx = Math.round(n.x) + 8 * fd;
        const hy = Math.round(B.headTop(n)) + 20;
        for (let i = 0; i < 3; i++) B.line(g, hx, hy + i, hx + (7 + i * 2) * fd, hy - 3 + i * 3, i % 2 ? '#5a5e66' : '#2a2c30');
      }
      g.globalAlpha = 1;
    }
  };
  B.decor({ id: 'implants-back', layer: 'counter', draw: drawFor('back') });
  B.decor({ id: 'implants-front', layer: 'interior', draw: drawFor('front') });
})(window.Bookshop);
