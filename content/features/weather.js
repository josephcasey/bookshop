/* snow and fog.
 * The engine now has snow (which settles, then melts) and fog (thickest far away, with halos round
 * the lamps). This file adds how everyone reacts: footprints in the snow, wrapped-up passers-by,
 * snowball fights (and the odd one splatting on the shop window), a snowman, Mabel clearing her
 * step, Marmalade batting at snowflakes, and in fog a distant foghorn and Mabel peering out. */
(function (B) {
  const name = () => B.ownerName();
  const cover = (s) => s.weather.cover || 0;

  B.chalk({ id: 'wrap-up', lines: ['WRAP UP', 'WARM', '& READ'] });

  // ---------- sounds ----------
  B.audio.define('foghorn', ({ tone, street }) => {
    tone(98, 2.6, { type: 'sawtooth', vol: 0.02, a: 0.4, lp: 360, pan: B.rnd(-0.8, 0.8), bus: street });
    tone(130, 2.4, { type: 'sawtooth', vol: 0.012, a: 0.4, lp: 360, pan: B.rnd(-0.8, 0.8), bus: street });
  });
  B.audio.define('snowballThrow', ({ noise, street }, x) => noise(0.12, { freq: 1800, q: 0.7, vol: 0.02, pan: B.clamp(x / 160 - 1, -0.9, 0.9), bus: street }));
  B.audio.define('snowballHit', ({ noise, tone, street }, x) => {
    noise(0.1, { ftype: 'lowpass', freq: 900, vol: 0.05, pan: B.clamp(x / 160 - 1, -0.9, 0.9), bus: street });
    tone(140, 0.05, { type: 'triangle', vol: 0.02, bus: street });
  });
  if (B.ambience) B.ambience.push({ id: 'foghorn', sound: 'foghorn', perSec: (s) => ((s.weather.fog || 0) > 0.6 ? 0.03 : 0) });

  // ---------- passers-by wrap up; footprints in the snow ----------
  function footprints(s, dt) {
    s.prints = s.prints || [];
    if (cover(s) < 0.25) {
      s.prints.length = 0;
      return;
    }
    for (const n of s.npcs.concat([s.owner])) {
      if (n.area !== 'street' || n.hidden || !n.moving) continue;
      const f = Math.floor(n.walkT * 7) % 4;
      if (f !== n._pf && (f === 1 || f === 3)) s.prints.push({ x: n.x + (f === 1 ? -2 : 2), y: n.y, t: s.simT });
      n._pf = f;
    }
    if (s.prints.length > 220) s.prints.splice(0, s.prints.length - 220);
  }
  function wrapUp(s) {
    const cold = (s.weather.snow || 0) > 0.3 || cover(s) > 0.3;
    for (const n of s.npcs) {
      if (n._wrapped || n.area !== 'street') continue;
      n._wrapped = true;
      if (!cold || !n.look || n.kind === 'police') continue;
      n.look = Object.assign({}, n.look);
      if (!n.look.hat && B.chance(0.7)) {
        n.look.hat = B.pick(['#b33a3a', '#2f4f8c', '#3c6e47', '#e8e03a', '#f4efe2']);
        n.look.hatStyle = 'beanie';
        n.look.hat2 = '#f4efe2';
      }
      if (!n.look.scarf && B.chance(0.7)) n.look.scarf = B.pick(['#b33a3a', '#2f4f8c', '#c9a13b', '#6a4c93']);
      n._snowBrolly = B.chance(0.3);
    }
  }

  // ---------- snowballs & snowman ----------
  const kidLook = () =>
    B.randomLook({ h: -2, beard: null, glasses: false, dress: false, hat: B.pick(['#b33a3a', '#2f4f8c', '#e8e03a']), hatStyle: 'beanie', hat2: '#f4efe2', scarf: B.pick(['#b33a3a', '#3c6e47', '#c9a13b']), top: B.pick(['#3b5b8c', '#c26a3a', '#6a4c93', '#2b8a3e']) });

  function throwBall(s, from, toX, toY, onLand) {
    s.snowballs = s.snowballs || [];
    const x0 = from.x + 6 * (from.dir || 1);
    const y0 = B.headTop(from) + 10;
    const T = 0.7;
    s.snowballs.push({ x: x0, y: y0, vx: (toX - x0) / T, vy: (toY - y0) / T - 0.5 * 90 * T, t: 0, T, onLand });
    B.audio.play('snowballThrow', x0);
  }

  B.visitor({
    id: 'snowball-kids',
    weight: (s) => (cover(s) > 0.35 && B.daylight(s.hour) > 0.5 ? 1.5 : 0),
    fromLeft: true,
    setup(n) {
      n.look = kidLook();
      n.speed = 48;
      n.umbrella = false;
    },
    *run(s, n) {
      // a second kid tags along
      const k2 = new B.NPC({ x: n.x - 24, dir: 1, exitX: n.exitX, lane: n.lane + 2, speed: 48, kind: 'kid', look: kidLook(), umbrella: false });
      k2.script = new B.Script((function* () {
        for (;;) yield 1;
      })());
      s.npcs.push(k2);
      const ax = B.rnd(40, 120);
      yield [n.walkTo(ax + 60), k2.walkTo(ax)];
      n.face(-1);
      k2.face(1);
      B.log('Two kids start a snowball fight on the pavement.');
      for (let i = 0; i < B.irnd(4, 7); i++) {
        const [a, b] = i % 2 ? [n, k2] : [k2, n];
        yield a.hold('crouch', 0.7); // scooping up snow
        const miss = B.chance(0.25);
        a.pose = 'reach';
        if (miss) {
          // wild throw: splat on the shop window
          const wx = B.clamp(b.x + B.rnd(-10, 10), 20, 205);
          const wy = B.rnd(96, 136);
          throwBall(s, a, wx, wy, () => {
            (s.splats = s.splats || []).push({ x: wx, y: wy, t: s.simT });
            B.audio.play('snowballHit', wx);
            if (s.owner.area === 'inside' && s.owner.pose !== 'sleep') s.request('splat-telling-off', 3, { kids: [n, k2] });
          });
        } else {
          throwBall(s, a, b.x, B.headTop(b) + 12, () => {
            B.audio.play('snowballHit', b.x);
            b.emote(B.pick(['bang', 'spark', 'happy']), 1.2);
            for (let k = 0; k < 6; k++) s.particle({ layer: 'out', x: b.x, y: B.headTop(b) + 12, vx: B.rnd(-20, 20), vy: B.rnd(-20, 0), vy2: 80, life: 0.5, c: '#f4f7fb' });
          });
        }
        yield 0.4;
        a.pose = 'stand';
        yield B.rnd(0.6, 1.4);
        if (n.toldOff) break;
      }
      // sometimes they build a snowman before they go
      if (!n.toldOff && !s.snowman && B.chance(0.5)) {
        yield [n.walkTo(38), k2.walkTo(22)];
        n.face(-1);
        k2.face(1);
        s.snowman = { x: 30, build: 0, hat: B.pick(['#1e1e22', '#b33a3a', '#2f4f8c']), scarf: B.pick(['#b33a3a', '#3c6e47', '#c9a13b']) };
        for (let i = 0; i < 8; i++) {
          yield [n.hold(i % 2 ? 'crouch' : 'reach', 0.8), k2.hold(i % 2 ? 'reach' : 'crouch', 0.8)];
          s.snowman.build = (i + 1) / 8;
        }
        n.emote('heart', 1.4);
        k2.emote('spark', 1.4);
        B.log('The kids build a snowman outside the shop.');
        yield 1.5;
      }
      k2.script = new B.Script((function* () {
        yield k2.walkOff();
      })());
    },
  });

  B.activity({
    id: 'splat-telling-off',
    idle: false,
    priority: 3,
    resume: false,
    *run(s, o, d) {
      o.emote('bang', 1);
      yield o.go(B.clamp((d && d.kids && d.kids[0].x) || 120, 30, 200));
      o.face(0);
      o.exprOverride = 'angry';
      yield o.hold('point', 1.4); // wagging a finger through the glass
      yield o.hold('hips', 1);
      o.exprOverride = null;
      if (d && d.kids) for (const k of d.kids) {
        k.toldOff = true;
        k.emote(B.pick(['bang', 'sweat']), 1.2);
      }
      B.log(`A snowball splats on the window. ${name()} gives the kids a look through the glass.`);
    },
  });

  // ---------- Mabel clears her step ----------
  B.activity({
    id: 'clear-snow',
    priority: 5.2,
    resume: false,
    weight: (s) => (s.shop.open && cover(s) > 0.3 && !(s.weather.cleared && s.simT - s.weather.cleared.t < 400) ? 6 : 0),
    when: (s) => s.queue.length === 0,
    *run(s, o) {
      yield o.go('door');
      yield* o.exit(s);
      o.lane = 0;
      o.holding = 'broom';
      o.movePose = 'sweep';
      for (const x of [226, 266, 232, 262]) yield o.walkTo(x, { speed: 0.4 });
      s.weather.cleared = { x1: 220, x2: 272, t: s.simT };
      o.movePose = null;
      o.holding = null;
      o.emote('happy', 1.2);
      B.log(`${name()} sweeps the snow off her doorstep.`);
      yield s.door.pass(o, 'in');
      o.depth = 'back';
    },
  });

  // ---------- fog ----------
  B.activity({
    id: 'fog-gaze',
    weight: (s) => ((s.weather.fog || 0) > 0.5 ? 2.5 : 0),
    cooldown: 40,
    *run(s, o) {
      yield o.go(B.rnd(...B.LAYOUT.ranges.open));
      o.face(0);
      o.emote('what', 1.4);
      yield 2;
      if (B.chance(0.5)) B.log(`${name()} peers out into the fog. She can barely see across the street.`);
      yield o.hold('cross', 3);
    },
  });

  // ---------- Marmalade and the snowflakes ----------
  if (B.catBehaviour)
    B.catBehaviour({
      id: 'watch-snow',
      weight: (s) => ((s.weather.snow || 0) > 0.3 ? 5 : 0),
      *run(s, cat) {
        yield* cat.goTo('sill', B.rnd(90, 180));
        cat.pose = 'sit';
        cat.lookUp = true;
        for (let i = 0; i < B.irnd(4, 8); i++) {
          cat.dir = B.pick([-1, 1]);
          yield B.rnd(1, 2);
          if (B.chance(0.5)) yield cat.hold('paw', 0.6); // batting at flakes through the glass
          cat.pose = 'sit';
        }
        cat.lookUp = false;
      },
    });

  // ---------- drawing ----------
  B.decor({
    id: 'snow-bits',
    layer: 'street',
    draw(g, s) {
      // footprints, fading as fresh snow falls into them
      const fill = (s.weather.snow || 0) > 0.1 ? 40 : 600;
      for (const p of s.prints || []) {
        const a = 1 - (s.simT - p.t) / fill;
        if (a > 0) B.px(g, `rgba(150,160,180,${0.55 * a})`, Math.round(p.x), Math.round(p.y), 2, 1);
      }
      // the snowman (shrinking as it melts)
      const sm = s.snowman;
      if (sm) {
        const melt = cover(s) < 0.2 ? cover(s) / 0.2 : 1;
        const k = sm.build * Math.max(0.35, melt);
        const x = sm.x;
        const base = 170;
        const r1 = Math.round(8 * k);
        const r2 = Math.round(6 * k);
        const r3 = Math.round(4.5 * k);
        const ball = (cy, r) => {
          for (let dy = -r; dy <= r; dy++) {
            const w = Math.round(Math.sqrt(r * r - dy * dy));
            B.px(g, '#f4f7fb', x - w, cy + dy, w * 2 + 1, 1);
            B.px(g, '#d8e0ea', x + w - 1, cy + dy, 2, 1);
          }
        };
        if (r1 > 1) ball(base - r1, r1);
        if (sm.build > 0.4 && r2 > 1) ball(base - 2 * r1 - r2 + 2, r2);
        if (sm.build > 0.7 && r3 > 1) {
          const hy = base - 2 * r1 - 2 * r2 - r3 + 4;
          ball(hy, r3);
          if (melt > 0.6) {
            B.px(g, '#1e1e22', x - 2, hy - 1, 1, 1);
            B.px(g, '#1e1e22', x + 1, hy - 1, 1, 1);
            B.px(g, '#e8752a', x, hy + 1, 3, 1); // carrot
            B.px(g, sm.hat, x - 3, hy - r3 - 2, 7, 2);
            B.px(g, sm.hat, x - 2, hy - r3 - 5, 5, 3);
            B.px(g, sm.scarf, x - 4, hy + r3 - 1, 9, 2);
            B.line(g, x - r2, base - 2 * r1 - r2 + 2, x - r2 - 6, base - 2 * r1 - r2 - 4, '#6a4226');
            B.line(g, x + r2, base - 2 * r1 - r2 + 2, x + r2 + 6, base - 2 * r1 - r2 - 5, '#6a4226');
          }
        }
      }
      // snowballs in flight
      for (const b of s.snowballs || []) B.px(g, '#f4f7fb', Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
    },
  });
  B.decor({
    id: 'window-splats',
    layer: 'facade',
    draw(g, s) {
      for (const p of s.splats || []) {
        const a = Math.max(0, 1 - (s.simT - p.t) / 240);
        if (a <= 0) continue;
        g.globalAlpha = a;
        B.px(g, '#f4f7fb', p.x - 3, p.y - 2, 7, 5);
        B.px(g, '#f4f7fb', p.x - 1, p.y - 4, 3, 9);
        B.px(g, '#e4eaf2', p.x - 1, p.y + 3, 2, 5); // sliding down the glass
        g.globalAlpha = 1;
      }
    },
  });

  // ---------- ticking ----------
  B.on('tick', (s, dt) => {
    footprints(s, dt);
    wrapUp(s);
    // umbrellas up in heavy snow too
    if ((s.weather.snow || 0) > 0.5) for (const n of s.npcs) if (n._snowBrolly) n.umbrellaUp = true;
    s.umbrellaSnow = (s.weather.snow || 0) > 0.5;
    if (s.owner.area === 'street' && s.umbrellaSnow) s.owner.umbrellaUp = true;
    // snowballs fly
    s.snowballs = (s.snowballs || []).filter((b) => {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 90 * dt;
      if (b.t >= b.T) {
        if (b.onLand) b.onLand();
        return false;
      }
      return true;
    });
    if (s.splats) s.splats = s.splats.filter((p) => s.simT - p.t < 240);
    if (s.snowman && cover(s) < 0.02) {
      s.snowman = null;
      B.log('All that is left of the snowman is a carrot and a scarf.');
    }
  });
  B.on('jump', (s) => {
    s.snowballs = [];
    s.prints = [];
  });
})(window.Bookshop);
