/* 2026-10-08 (delivery robots)
 * Six-wheeled pavement delivery robots trundle along with the foot traffic: a white tub on a black chassis, yellow-rimmed
 * wheels, a red tail light and an orange flag on a whip aerial. Now and then one stops to think about a crack in the
 * paving.
 * Mabel orders her household shopping by robot too: she taps an order into her mobile, a robot arrives at the kerb
 * outside the door some time later and chirps, she pops out, the lid swings up, she lifts out the bag, and takes it
 * through to the back to pack it away. If she can't come out, it waits a minute and goes home.
 * Scale: people are ~60 px for ~1.7 m (35 px/m), so a robot is ~24 px long, ~20 px to its lid, the flag ~1.2 m up. */
(function (B) {
  const name = () => B.ownerName();
  const ROBOT_SPEED = 30; // a brisk walking pace for a robot, slower than people

  // ---------- the robot, drawn wherever a person would be (paintPerson hands robots to this) ----------
  B.paintRobot = (g, r, cx, fy) => {
    const P = (c, x, y, w = 1, h = 1) => B.px(g, c, x, y, w, h);
    const d = r.dir || 1;
    const cy = B.theme === 'cyber';
    const night = r.night || 0;
    const X = (dx) => cx + dx * d; // dx forward of the centre
    const span = (dx0, dx1) => [Math.min(X(dx0), X(dx1)), Math.abs(dx1 - dx0) + 1]; // x, w for a forward range
    const body = cy ? '#d8dcf0' : '#eeeef0';
    const bodyS = cy ? '#9aa0c0' : '#c4c4ca';
    const black = '#1c1c22';
    // the flag on its whip aerial, from the back of the lid
    const ax = X(-9);
    const sway = r.moving ? Math.round(Math.sin((r.t || 0) * 9)) : 0;
    for (let y = fy - 42; y < fy - 19; y++) P('#2a2a2e', ax + (y < fy - 34 ? sway * -d : 0), y);
    const flag = cy ? '#ff3fa4' : '#ff8a1a';
    P(flag, ax + sway * -d + (d > 0 ? -4 : 1), fy - 44, 4, 3);
    P(flag, ax + sway * -d + (d > 0 ? -3 : 1), fy - 41, 3, 2);
    P(cy ? '#ffb0e0' : '#ffd28a', ax + sway * -d, fy - 45, 1, 1); // the aerial's light
    // the lid: a white dome, swung up on its hinge at the back when open
    const open = r.lid || 0;
    if (open > 0.5) {
      const [lx] = span(-11, -9);
      P(body, lx, fy - 30, 3, 11); // standing up off the back hinge
      P(bodyS, d > 0 ? lx + 2 : lx, fy - 30, 1, 11);
      const [tx] = span(-8, 10);
      P('#3a3a42', tx, fy - 20, 19, 1); // the dark tub inside
      if (r.cargo) P(r.cargoC || '#c9a36a', X(d > 0 ? -5 : 5) - (d > 0 ? 0 : 7), fy - 23, 8, 4); // the shopping bag
    } else {
      const [x0, w0] = span(-10, 10);
      P(body, x0, fy - 21, w0, 1);
      P(body, x0 - 1, fy - 20, w0 + 2, 2);
      P('#ffffff', x0 + 2, fy - 21, w0 - 6, 1); // the lid's highlight
    }
    // the tub
    const [bx, bw] = span(-11, 11);
    P(body, bx, fy - 18, bw, 9);
    P(bodyS, bx, fy - 10, bw, 1);
    // the dark sensor band round the front, and its camera
    const [sx, sw] = span(3, 11);
    P(black, sx, fy - 17, sw, 3);
    P(cy ? '#3ff5ff' : '#4a6a8a', X(9), fy - 16, 1, 1);
    // the decal on the flank: a black label with a line of white lettering
    const [lx, lw] = span(-7, 1);
    P(black, lx, fy - 15, lw, 4);
    for (let i = 1; i < lw - 1; i += 2) P('#e8e8e8', lx + i, fy - 14, 1, 1);
    P('#e8e8e8', lx + 1, fy - 12, lw - 4, 1);
    // tail light and headlight (brighter at night)
    P(night > 0.3 ? '#ff4a3a' : '#c03028', X(-11), fy - 16, 1, 3);
    P(night > 0.3 ? '#ffffe0' : '#d8d8d0', X(11), fy - 12, 1, 2);
    if (night > 0.3) {
      P('rgba(255,250,220,0.35)', d > 0 ? X(12) : X(12) - 5, fy - 12, 6, 1);
      P('rgba(255,60,40,0.4)', d > 0 ? X(-12) - 1 : X(-12), fy - 16, 2, 3);
    }
    // the chassis
    P(black, bx, fy - 9, bw, 4);
    if (cy) P('#3ff5ff', bx, fy - 6, bw, 1); // the neon city's underglow trim
    // six wheels (three a side): black tyres with yellow rims, a spoke turning as it rolls
    const roll = r.roll || 0;
    for (const wx of [-8, 0, 8]) {
      const x = X(wx);
      P(black, x - 2, fy - 6, 5, 6);
      P(black, x - 3, fy - 5, 7, 4);
      P(cy ? '#ff3fa4' : '#e8d840', x - 2, fy - 5, 5, 4); // the rim
      P('#5a5a60', x - 1, fy - 4, 3, 2); // the hub
      const a = roll + wx;
      const k = ((Math.round(a) % 4) + 4) % 4;
      P(black, x + [-1, 0, 1, 0][k], fy - 4 + [0, -1, 0, 1][k], 1, 1);
    }
  };

  // ---------- its voice ----------
  B.audio.define('robot-chirp', ({ tone, street }, x = 160) => {
    const pan = Math.max(-1, Math.min(1, (x - 160) / 170));
    tone(1320, 0.07, { type: 'sine', vol: 0.03, pan, bus: street });
    tone(1760, 0.09, { type: 'sine', vol: 0.03, at: 0.09, pan, bus: street });
  });
  B.audio.define('robot-arrived', ({ tone, street }, x = 244) => {
    const pan = Math.max(-1, Math.min(1, (x - 160) / 170));
    [1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.035, at: i * 0.11, pan, bus: street }));
  });
  B.audio.define('robot-lid', ({ tone, noise, street }) => {
    tone(220, 0.25, { type: 'sawtooth', vol: 0.006, slide: 330, lp: 900, bus: street }); // the motor
    noise(0.08, { ftype: 'bandpass', freq: 1800, q: 2, vol: 0.02, at: 0.24, bus: street }); // the latch
  });

  // ---------- the robots roll (each tick: wheels turn with distance; their lights know the time) ----------
  B.on('tick', (s, dt) => {
    const night = B.nightness ? B.nightness(s.hour) : 1 - B.daylight(s.hour);
    for (const n of s.npcs) {
      if (!n.robot) continue;
      if (n._rx == null) n._rx = n.x;
      n.roll = (n.roll || 0) + Math.abs(n.x - n._rx) * 0.6;
      n._rx = n.x;
      n.night = night;
      if (n.lidTo != null) n.lid = B.clamp((n.lid || 0) + Math.sign(n.lidTo - (n.lid || 0)) * dt * 2.5, 0, 1);
    }
    // an order placed earlier is on its way
    const ord = s.robotOrder;
    if (ord && !ord.sent && s.simT >= ord.due) {
      ord.sent = true;
      B.spawn(s, 'grocery-robot', { props: { order: ord } });
    }
  });

  const robotSetup = (n) => {
    n.robot = true;
    n.speed = ROBOT_SPEED;
    n.umbrella = false;
    n.lane = B.irnd(1, 5);
    n.lid = 0;
  };

  // ---------- in the foot traffic ----------
  B.visitor({
    id: 'delivery-robot',
    weight: (s) => (B.daylight(s.hour) > 0.3 ? 1.1 : 0.35),
    setup: robotSetup,
    *run(s, n) {
      if (B.chance(0.35)) {
        // a pause: something on the pavement wants thinking about
        yield n.walkTo(B.rnd(30, 290));
        yield B.rnd(1, 2.5);
        B.audio.play('robot-chirp', n.x);
        if (B.chance(0.25) && s.owner.area === 'inside') B.log(B.pick(['A delivery robot stops to consider a crack in the paving.', 'A delivery robot waits politely for a pigeon to move.']));
        yield 0.6;
      }
      yield n.walkOff();
    },
  });

  // ---------- Mabel's own deliveries ----------
  const SHOPPING = [
    ['milk', 'teabags', 'a loaf', 'marmalade'],
    ['washing-up liquid', 'bin bags', 'light bulbs'],
    ['eggs', 'butter', 'flour', 'sugar'],
    ['cat food', 'cat litter', 'a bag of treats for the cat'],
    ['oranges', 'cheese', 'crackers', 'a bottle of sherry'],
    ['coffee beans', 'biscuits', 'milk'],
  ];
  const list = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]);
  B.activity({
    id: 'order-groceries',
    weight: 1.2,
    cooldown: 600,
    when: (s, o) =>
      o.area === 'inside' && !s.robotOrder && (s.dayStats.robotOrders || 0) < 1 && s.hour >= 9 && s.hour < 18 && s.customersInside() === 0,
    *run(s, o) {
      o.holding = 'mobile';
      o.face(B.pick([0, 'side']));
      yield o.hold('stand', B.rnd(3, 5));
      const items = B.pick(SHOPPING);
      s.robotOrder = { items, due: s.simT + B.rnd(60, 150), sent: false };
      s.dayStats.robotOrders = (s.dayStats.robotOrders || 0) + 1;
      B.log(`${name()} orders ${list(items)} on her mobile, for delivery by robot.`);
      yield 0.6;
      o.holding = null;
    },
  });

  B.visitor({
    id: 'grocery-robot',
    spawn: false, // only for an order
    setup(n) {
      robotSetup(n);
      n.lane = 4; // the kerb side, so she can stand behind it on the pavement
      n.cargo = true;
      n.cargoC = B.pick(['#c9a36a', '#4a7a5a', '#7a5a8a']);
    },
    *run(s, n) {
      yield n.walkTo(B.LAYOUT.doorX + (n.dir > 0 ? -2 : 2));
      n.arrived = true;
      B.audio.play('robot-arrived', n.x);
      if (s.owner.area !== 'away') B.log(`${name()}'s shopping has arrived: a delivery robot is waiting at the kerb.`);
      s.request('collect-robot', 5, { robot: n });
      let waited = 0;
      while (!n.collected && waited < 60) {
        yield 1;
        waited += 1;
        if (waited % 15 === 0 && !n.unlocked) B.audio.play('robot-chirp', n.x); // a reminder
      }
      if (!n.collected) {
        B.log('Nobody came for the delivery robot. It trundles off home with the shopping.');
        s.robotOrder = null;
        n.cargo = false;
      }
      yield 1;
      n.lidTo = 0;
      yield 0.6;
      B.audio.play('robot-chirp', n.x);
      n.face(-n.dir);
      n.exitX = n.dir > 0 ? B.LAYOUT.edgeR + 2 : B.LAYOUT.edgeL - 2;
      yield n.walkOff();
    },
  });

  B.activity({
    id: 'collect-robot',
    idle: false,
    priority: 5.2, // short and outdoors: finish before serving anyone
    resume: false,
    *run(s, o, d) {
      const n = d && d.robot;
      if (!n || n.remove || o.area === 'upstairs' || o.area === 'away') return;
      yield o.go('door');
      yield* o.exit(s);
      o.lane = 1;
      yield o.walkTo(n.x - 14 * (n.dir || 1));
      o.faceX(n.x);
      o.holding = 'mobile';
      yield o.hold('stand', 1); // unlocks it from her mobile
      o.holding = null;
      n.unlocked = true;
      n.lidTo = 1;
      B.audio.play('robot-lid');
      yield 0.9;
      yield o.hold('crouch', 1.1);
      n.cargo = false;
      o.holding = 'bag';
      n.collected = true;
      o.emote('happy', 1.2);
      if (B.chance(0.4)) B.log(B.pick([`${name()} thanks the robot. It doesn't say anything, but it chirps.`, `${name()} lifts her shopping out of the robot.`]));
      yield 0.6;
      yield s.door.pass(o, 'in');
      o.depth = 'back';
      // through to the back rooms, to put it all away
      const ord = s.robotOrder;
      s.robotOrder = null;
      yield* o.backRoom(s, B.rnd(8, 14));
      o.holding = null;
      if (ord && B.chance(0.6)) B.log(`${name()} packs away the ${list(ord.items)}.`);
      o.moodUp(0.04);
    },
  });

  B.on('newDay', (s) => {
    s.robotOrder = null;
  });
})(window.Bookshop);
