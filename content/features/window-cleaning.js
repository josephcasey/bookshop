/* 2026-10-09 (SCH-34: the window cleaner, by hand)
 * The window cleaner now does the shop window and the door by hand. A spritz from the spray bottle, then the
 * squeegee in S-strokes from the top of the glass to the bottom, with a flick to clear the blade every few rows. The
 * glass reaches higher than they can, so they wear extending stilt boots: the struts telescope up for the top rows
 * and back down as they work lower, and they crouch for the bottom.
 * - Call them yourself: a quick side-to-side wipe over the shop window (mouse, or a finger on a phone) waves the
 *   window cleaner over.
 * - Pigeons on the ledge above the window sometimes leave a dropping on the glass. It stays (saved) until the
 *   cleaner's squeegee passes over it, and the cleaner goes for those first. */
(function (B) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = () => B.LAYOUT;
  const REACH = 14; // arm plus squeegee handle, in px (~0.4 m)
  const X0 = 8; // street-crew.js's dirt bins: 4 px each from x 8
  const binOf = (x) => clamp(Math.floor((x - X0) / 4), 0, 63);

  // ---------- droppings ----------
  const KEY = 'bookshop.droppings';
  const falling = [];
  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s.droppings || []));
    } catch (e) {
      /* private mode */
    }
  }
  B.on('ready', (s) => {
    try {
      s.droppings = JSON.parse(localStorage.getItem(KEY) || '[]').slice(0, 12);
    } catch (e) {
      s.droppings = [];
    }
  });
  B.audio.define('plip', ({ tone, street }, x = 160) => tone(900, 0.04, { type: 'sine', vol: 0.01, slide: 300, pan: clamp(x / 160 - 1, -0.9, 0.9), bus: street }));
  /** Wipe off any dropping within r px of (x, y); returns how many went. */
  B.wipeDroppings = (s, x, y, r = 4) => {
    const before = (s.droppings || []).length;
    s.droppings = (s.droppings || []).filter((d) => Math.abs(d.x - x) > r || Math.abs(d.y - y) > r);
    const n = before - s.droppings.length;
    if (n) save(s);
    return n;
  };
  B.on('tick', (s, dt) => {
    if (!s.droppings) s.droppings = [];
    const W = L().win;
    // a pigeon on the ledge above the glass, now and then...
    for (const p of s.pigeons || []) {
      if ((p.state !== 'perch' && p.state !== 'roost') || p.y !== 52 || p.x < W.x + 4 || p.x > W.x + W.w - 4) continue;
      if (s.droppings.length + falling.length < 12 && Math.random() < dt / 420) falling.push({ x: Math.round(p.x - 2 * (p.dir || 1)), y: 56, vy: 0, ty: B.rnd(W.y + 24, W.y + W.h - 8) });
    }
    // ...and it lands on the glass and stays there
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 260 * dt;
      f.y += f.vy * dt;
      if (f.y >= f.ty) {
        s.droppings.push({ x: f.x, y: Math.round(f.ty), seed: Math.floor(Math.random() * 1e6) });
        falling.splice(i, 1);
        save(s);
        B.audio.play('plip', f.x);
        if (s.owner.area === 'inside' && B.chance(0.4)) B.log(B.pick(['A pigeon on the sign leaves its mark on the window.', `${B.ownerName()} tuts at the fresh pigeon mess on the glass.`]));
      }
    }
  });
  B.decor({
    id: 'droppings',
    layer: 'facade',
    draw(g, s) {
      const P = (c, x, y, w = 1, h = 1) => B.px(g, c, x, y, w, h);
      for (const f of falling) P('#e8e6dc', f.x, Math.round(f.y), 1, 2);
      for (const d of s.droppings || []) {
        const r = d.seed;
        // a white splat with a darker heart, and a drip or two running down the glass
        P('#f0eee6', d.x - 1, d.y, 3, 2);
        P('#f0eee6', d.x - 2 + (r % 2), d.y + 1, 1, 1);
        P('#e2e0d4', d.x + 2, d.y + (r % 3 === 0 ? 0 : 1), 1, 1);
        P('#6a6a58', d.x, d.y, 1, 1);
        P('#d8d6c8', d.x - 1 + (r % 3), d.y + 2, 1, 1 + (r % 3));
        if (r % 5 === 0) P('#d8d6c8', d.x + 1, d.y + 2, 1, 1);
      }
    },
  });

  // ---------- the cleaner, by hand ----------
  B.audio.define('spritz', ({ noise, street }, x = 160) => noise(0.12, { ftype: 'highpass', freq: 4000, q: 0.6, vol: 0.02, a: 0.005, pan: clamp(x / 160 - 1, -0.9, 0.9), bus: street }));
  B.audio.define('stilts', ({ tone, street }, x = 160, up = true) => tone(up ? 260 : 340, 0.3, { type: 'square', vol: 0.004, slide: up ? 340 : 260, lp: 900, pan: clamp(x / 160 - 1, -0.9, 0.9), bus: street }));
  const mist = [];
  B.visitor({
    id: 'window-cleaner',
    weight: 0,
    look: 'window-cleaner',
    setup(n) {
      n.speed = 34;
      n.lane = -3; // close in to the glass
      n.cleaner = { state: 'walk' }; // (street-crew.js's pole only appears for its own states)
      n.hand = { tool: null, gx: 0, gy: 0, bottle: false };
      n.lift = 0;
    },
    *run(s, n) {
      const W = L().win;
      const D = L().doorGlass;
      const h = n.hand;
      const shoulderY = () => B.headTop(n) + 12;
      // the glass in arm-width reaches, the window then the door, any with droppings first
      const reaches = [];
      for (let a = W.x + 2; a < W.x + W.w - 2; a += 24) reaches.push([a, Math.min(a + 24, W.x + W.w - 2), W.y + 22, W.y + W.h - 3]);
      reaches.push([D.x + 1, D.x + D.w - 1, D.y + 2, D.y + D.h - 3]);
      const dirty = (r) => (s.droppings || []).some((d) => d.x >= r[0] - 2 && d.x <= r[1] + 2 && d.y >= r[2] - 2 && d.y <= r[3] + 2);
      reaches.sort((p, q) => dirty(q) - dirty(p));
      yield n.walkTo(W.x + 14);
      B.log(dirty(reaches[0]) ? 'The window cleaner makes a beeline for the pigeon mess on the glass.' : B.pick(['The window cleaner is here: spray bottle, squeegee and those extending boots.', 'Squeak, squeak: the window cleaner is doing the front by hand.']));
      // move the hand to (x, y), telescoping the stilts up or down as it goes (or crouching) to keep it in reach
      function* reachTo(x, y, sec) {
        const top = shoulderY() + n.lift - REACH; // the highest point reachable standing on the ground
        const wantLift = clamp(Math.ceil(top - y), 0, 18);
        const fromLift = n.lift;
        if (Math.abs(wantLift - fromLift) > 2) B.audio.play('stilts', n.x, wantLift > fromLift);
        const fx = h.gx;
        const fy = h.gy;
        const steps = Math.max(1, Math.round(sec / 0.04));
        for (let k = 1; k <= steps; k++) {
          const q = k / steps;
          n.lift = Math.round(fromLift + (wantLift - fromLift) * q);
          h.gx = fx + (x - fx) * q;
          h.gy = fy + (y - fy) * q;
          n.pose = h.gy > shoulderY() + REACH + 2 ? 'crouch' : 'backstand';
          if (h.tool === 'squeegee') {
            for (let i = binOf(h.gx - 3); i <= binOf(h.gx + 3); i++) {
              if (B.crew) {
                B.crew.dirt[i] = Math.max(0, B.crew.dirt[i] - 0.5);
                B.crew.wet[i] = 1;
              }
            }
            if (B.wipeDroppings(s, h.gx, h.gy, 4) && B.chance(0.6)) B.log('The window cleaner squeegees off the pigeon mess.');
          }
          yield sec / steps;
        }
      }
      for (const [a, b, top, bot] of reaches) {
        yield n.walkTo(Math.round((a + b) / 2));
        n.face('away');
        n.pose = 'backstand';
        h.gx = n.x;
        h.gy = shoulderY() + 6;
        // a spritz or three from the bottle
        h.tool = 'bottle';
        for (const [fx, fy] of [[a + 4, top + 6], [(a + b) / 2, (top + bot) / 2], [b - 4, bot - 8]]) {
          yield* reachTo(fx, fy, 0.25);
          B.audio.play('spritz', fx);
          for (let i = 0; i < 9; i++) mist.push({ x: fx + B.rnd(-5, 5), y: fy + B.rnd(-4, 4), t: 0 });
          for (let i = binOf(fx - 6); i <= binOf(fx + 6); i++) if (B.crew) B.crew.wet[i] = 1;
          yield 0.2;
        }
        // the squeegee: across and back, top to bottom, flicking the blade clean every few rows
        h.tool = 'squeegee';
        let row = 0;
        for (let y = top; y <= bot; y += 5, row++) {
          const l2r = row % 2 === 0;
          yield* reachTo(l2r ? a : b, y, 0.12);
          yield* reachTo(l2r ? b : a, y, Math.max(0.25, (b - a) * 0.025));
          if (B.chance(0.3)) B.audio.play('squeak', h.gx);
          if (row % 4 === 3) {
            const hx = h.gx;
            const hy = h.gy;
            yield* reachTo(n.x - 4, shoulderY() + 8, 0.15); // a flick: off the blade, onto the pavement
            mist.push({ x: n.x - 6, y: shoulderY() + 10, t: 0, drip: true });
            yield 0.12;
            yield* reachTo(hx, hy, 0.12);
          }
        }
        // boots back down, and on to the next stretch
        h.tool = null;
        yield* reachTo(n.x, shoulderY() + n.lift + 6, 0.3);
        n.lift = 0;
        n.pose = 'stand';
      }
      if (s.shop.open && s.owner.area === 'inside' && B.chance(0.6)) {
        n.emote('happy', 1.2);
        B.log(`${B.ownerName()} waves her thanks through the gleaming glass.`);
      }
      h.tool = null;
      yield n.walkOff();
    },
  });

  // the stilts, arm and tools: in front of the glass (and of the cleaner)
  B.decor({
    id: 'cleaner-hands',
    layer: 'overlay',
    draw(g, s) {
      const P = (c, x, y, w = 1, h = 1) => B.px(g, c, Math.round(x), Math.round(y), w, h);
      for (let i = mist.length - 1; i >= 0; i--) {
        const m = mist[i];
        m.t += 1 / 30;
        if (m.drip) m.y += 1.5;
        if (m.t > (m.drip ? 0.5 : 0.9)) {
          mist.splice(i, 1);
          continue;
        }
        g.globalAlpha = 1 - m.t / (m.drip ? 0.5 : 0.9);
        P(m.drip ? '#a8c8e0' : '#d8ecf8', m.x, m.y);
        g.globalAlpha = 1;
      }
      const n = s.npcs.find((m) => m.kind === 'window-cleaner' && m.hand);
      if (!n || n.area !== 'street') return;
      // the stilts: aluminium struts from the boots down to foot plates on the pavement, telescoping
      if (n.lift > 0) {
        const fy = Math.round(n.y);
        const by = fy - n.lift;
        for (const sx of [Math.round(n.x) - 2, Math.round(n.x) + 1]) {
          P('#8a909a', sx, by, 1, n.lift); // the outer tube
          P('#c8ccd4', sx, by + Math.floor(n.lift / 2), 1, Math.ceil(n.lift / 2)); // the bright inner tube, slid out
          P('#3a3e48', sx - 1, by - 1, 3, 1); // the strap over the boot
          P('#2a2e36', sx - 1, fy - 1, 3, 1); // the foot plate
        }
      }
      const h = n.hand;
      if (!h.tool) return;
      // the working arm: from the shoulder to the tool, in the jacket's navy, with a hand
      const sx = Math.round(n.x) + 2;
      const sy = Math.round(B.headTop(n) + 12);
      const hx = Math.round(h.gx);
      const hy = Math.round(h.gy);
      B.line(g, sx, sy, hx, hy + 2, '#2a3a5a');
      B.line(g, sx + 1, sy, hx + 1, hy + 2, '#2a3a5a');
      P('#d9a47e', hx, hy + 1, 2, 2); // the hand
      if (h.tool === 'squeegee') {
        P('#c8ccd4', hx, hy - 1, 1, 2); // the handle
        P('#20242c', hx - 3, hy - 2, 7, 1); // the rubber blade
        P('#e8f040', hx - 3, hy - 3, 7, 1); // its yellow channel
      } else {
        P('#3a8ad0', hx - 1, hy - 3, 3, 4); // the spray bottle
        P('#f0f0f0', hx - 1, hy - 4, 2, 1); // its trigger
      }
    },
  });

  // ---------- wave the cleaner over: a quick side-to-side wipe over the shop window ----------
  B.on('ready', () => {
    if (typeof document === 'undefined' || !document.getElementById) return; // (headless)
    const cv = document.getElementById('screen');
    if (!cv || !cv.addEventListener) return;
    cv.style.touchAction = 'pan-y pinch-zoom'; // a sideways drag over the scene is ours; scrolling still works
    let path = [];
    let calledAt = -1e9;
    const onMove = (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 320;
      const y = ((e.clientY - r.top) / r.height) * 180;
      const W = L().win;
      const t = performance.now();
      if (x < W.x || x > W.x + W.w || y < W.y || y > W.y + W.h) {
        path = [];
        return;
      }
      if (e.pointerType === 'mouse' && e.buttons === 0 && e.type === 'pointermove') {
        // a hovering mouse needs a firmer wiggle than a finger: three reversals
        path.push({ x, t, hover: true });
      } else path.push({ x, t });
      path = path.filter((p) => t - p.t < 1200);
      // count direction reversals of at least 8 px
      let dir = 0;
      let turns = 0;
      let anchor = path[0] ? path[0].x : x;
      for (const p of path) {
        const d = p.x - anchor;
        if (Math.abs(d) >= 8) {
          const nd = Math.sign(d);
          if (dir && nd !== dir) turns++;
          dir = nd;
          anchor = p.x;
        }
      }
      const need = path.some((p) => p.hover) ? 3 : 2;
      if (turns >= need && t - calledAt > 20000) {
        calledAt = t;
        path = [];
        const s = B.world;
        if (s.npcs.some((m) => m.kind === 'window-cleaner')) B.log('The window cleaner is already on it.');
        else {
          B.log('You wave for the window cleaner, who spots you from down the street.');
          if (B.crew && B.crew.call) B.crew.call('cleaner');
        }
      }
    };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', (e) => {
      path = [];
      onMove(e);
    });
  });
})(window.Bookshop);
