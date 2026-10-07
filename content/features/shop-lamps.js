/* 2026-10-07 (the shop's own lamps)
 * Click a lamp in the shop to switch it on or off: the two pendants over the shelves and the desk lamp on the
 * counter. (Mabel's light switch still works both pendants together when she opens up and closes.)
 *
 * Each lamp is a real point source inside the room, at its own depth. Its light falls on the back wall with the
 * inverse-square and incidence falloff of a point source, (h^2 / (h^2 + r^2))^1.5 with h its distance from the wall;
 * a pendant's shade cuts the classic scallop (its cone meets the wall in a hyperbola). Every prop between the lamp and
 * the wall (the radio, the coffee machine, the clock on the back wall; the counter and its clutter in front of the
 * desk lamp; Mabel and the customers) throws its silhouette, scaled about the lamp by (Z - z_lamp) / (z - z_lamp),
 * with a small penumbra from the bulb's size. The light is quantised to the interior's cel bands and REVEALS the
 * interior's true colours (light is the medium: it doesn't paint).
 * Flags (Lighting Lab): shopLamps. */
(function (B) {
  const F = (B.lightFlags = B.lightFlags || {});
  if (F.shopLamps === undefined) F.shopLamps = true;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const W = 320;
  const H = 180;
  const Z = 40; // the back wall
  const cyber = () => B.theme === 'cyber';
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1).toFixed(3)})`;
  };
  const COUNTER_FRONT = { x: 136, y: 129, w: 72, h: 15 }; // faces the street: no lamp in the room can reach it

  // the lamps: screen position of the bulb, depth (px, from the glass), what kind of shade
  const LAMPS = () => {
    const top = (B.LAYOUT.counterTop || 120) - 2;
    return [
      { id: 'pendantL', x: 40, y: 92, z: 20, shade: 'pendant', hit: [34, 84, 13, 10] },
      { id: 'pendantR', x: 170, y: 92, z: 20, shade: 'pendant', hit: [164, 84, 13, 10] },
      { id: 'desk', x: 139, y: top - 8, z: 13, shade: 'desk', hit: [133, top - 12, 13, 12] },
    ];
  };
  const state = (B.shopLamps = { pendantL: false, pendantR: false, lastMain: null });
  const isOn = (s, id) => (id === 'desk' ? !!s.lamp : !!state[id]);

  /** Mabel's switch works both pendants; the shop counts as lit while either is on. */
  function sync(s) {
    if (state.lastMain === null || s.shop.lights !== state.lastMain) {
      state.pendantL = state.pendantR = s.shop.lights;
    }
    s.shop.lights = state.pendantL || state.pendantR;
    state.lastMain = s.shop.lights;
  }
  B.on('tick', sync);

  function toggle(s, id) {
    if (id === 'desk') s.lamp = !s.lamp;
    else {
      state[id] = !state[id];
      s.shop.lights = state.pendantL || state.pendantR;
      state.lastMain = s.shop.lights;
    }
    B.audio.play('click');
    const on = isOn(s, id);
    const what = id === 'desk' ? 'the desk lamp' : id === 'pendantL' ? 'the lamp over the fiction shelves' : 'the lamp over the counter';
    B.log(`You switch ${what} ${on ? 'on' : 'off'}.`);
    if (s.owner.area === 'inside' && s.owner.pose !== 'sleep' && B.chance(0.4)) s.owner.emote(on ? 'happy' : 'what', 1.2);
  }
  const hitLamp = (x, y) => LAMPS().find((l) => x >= l.hit[0] && x < l.hit[0] + l.hit[2] && y >= l.hit[1] && y < l.hit[1] + l.hit[3]);
  B.hitShopLamp = hitLamp;
  B.on('click', (s, x, y) => {
    const l = hitLamp(x, y);
    if (!l) return;
    toggle(s, l.id);
    s.clickTaken = true; // (not a knock on the window)
  });

  // ---------- drawing the pendants each as their own switch ----------
  let wrapped = false;
  function wrap() {
    if (wrapped) return;
    const K = B.renderKit;
    if (!K || !K.PARTS || !B.themes || !B.themes.cyber) return;
    wrapped = true;
    for (const owner of [K.PARTS, B.themes.cyber]) {
      const dp = owner.drawPendants;
      if (dp) {
        owner.drawPendants = function (g, s) {
          // draw them unlit, then light the bulbs that are on
          const s2 = Object.create(s);
          s2.shop = Object.assign({}, s.shop, { lights: false });
          dp.call(this, g, s2);
          for (const l of LAMPS()) {
            if (l.shade !== 'pendant' || !isOn(s, l.id)) continue;
            if (cyber()) {
              B.px(g, '#e8f6ff', l.x - 4, 91, 9, 1);
              B.px(g, '#3ff5ff', l.x - 5, 90, 1, 1);
              B.px(g, '#3ff5ff', l.x + 5, 90, 1, 1);
            } else B.px(g, '#ffe9a8', l.x - 2, 93, 5, 1);
          }
          if (cyber() && (state.pendantL || state.pendantR)) B.px(g, '#d8e8ff', 9, 81, 202, 1); // the ceiling strip
        };
      }
      const sp = owner.shopSpill;
      if (sp) {
        owner.shopSpill = function (g, s, day, lit) {
          if (!F.shopLamps) return sp.call(this, g, s, day, lit);
          spill(g, s, day);
        };
      }
      const il = owner.interiorLight;
      if (il) {
        owner.interiorLight = function (g, s, day, lit) {
          if (!F.shopLamps || !B.lightKit || !B.lightKit.reveal) return il.call(this, g, s, day, lit);
          // the room as it is with every lamp off (daylight, the radio's glow and so on)...
          const s2 = Object.create(s);
          s2.lamp = false;
          il.call(this, g, s2, day, false);
          // ...then each lamp that's on lights it, shadows and all
          lamps(g, s, day);
        };
      }
    }
  }
  B.on('tick', wrap);

  // ---------- the light ----------
  let lc = null;
  let lg = null;
  let tc = null;
  let tg = null;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };

  /** One lamp's light on the back wall, with its shade's cut-off and the shadows of everything behind it. */
  function oneLamp(g, s, l, col, I, masks, people) {
    const h = Z - l.z;
    g.save();
    // falloff of a point source on a wall: (h^2 / (h^2 + r^2))^1.5
    const R = h * 5;
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, R);
    for (const q of [0, 0.1, 0.2, 0.3, 0.45, 0.65, 1]) {
      const r = q * R;
      const E = Math.pow((h * h) / (h * h + r * r), 1.5);
      gr.addColorStop(q, rgba(col, I * E));
    }
    g.fillStyle = gr;
    if (l.shade === 'pendant' || l.shade === 'desk') {
      // the shade's cone meets the wall in a hyperbola: y = y0 + cot(theta) * sqrt(dx^2 + h^2); above it, only what
      // bounces up out of the open top and off the ceiling
      const cot = l.shade === 'pendant' ? 0.45 : 0.15;
      const y0 = l.y - (l.shade === 'pendant' ? 1 : 0);
      g.beginPath();
      g.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += 4) g.lineTo(x, y0 + cot * Math.sqrt((x - l.x) * (x - l.x) + h * h)); // vertex h*cot below the bulb
      g.lineTo(W + 10, H);
      g.closePath();
      g.save();
      g.clip();
      g.fillRect(0, 0, W, H);
      g.restore();
      g.globalAlpha = l.shade === 'pendant' ? 0.22 : 0.1;
      g.fillRect(0, 0, W, l.y + 2);
      g.globalAlpha = 1;
    } else g.fillRect(0, 0, W, H);
    // shadows: everything between the lamp and the wall, scaled about the bulb; the bulb's ~3 px size softens them
    g.globalCompositeOperation = 'destination-out';
    const cast = (c, z, cap) => {
      if (z <= l.z + 1.5) return; // in front of the lamp: it can't shadow the wall
      const k = Math.min(cap, (Z - l.z) / (z - l.z)); // projected about the bulb onto the wall
      const pw = clamp(Math.round((1.4 * (Z - z)) / (z - l.z) / 2), 1, 3); // the bulb's size blurs it: w = s (Z-z)/(z-z_l)
      const offs = pw === 1 ? [-1, 1] : pw === 2 ? [-2, 0, 2] : [-3, -1, 1, 3];
      for (const ox of offs) {
        g.globalAlpha = 1 / offs.length; // stepped: a solid core where all are hidden, then the penumbra in steps
        g.setTransform(k, 0, 0, k, (l.x + ox) * (1 - k), l.y * (1 - k));
        g.drawImage(c, 0, 0);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    };
    for (const m of masks) cast(m.c, m.z, 2.4);
    for (const [a, z] of people) {
      if (z <= l.z + 1.5) continue;
      tg.clearRect(0, 0, W, H);
      B.drawSilhouette(tg, a, a.x, a.y, 1, 1);
      cast(tc, z, 2);
    }
    g.fillRect(COUNTER_FRONT.x, COUNTER_FRONT.y, COUNTER_FRONT.w, COUNTER_FRONT.h);
    g.restore();
  }

  function lamps(g, s, day) {
    const kit = B.lightKit;
    const list = LAMPS().filter((l) => isOn(s, l.id));
    const Wn = B.LAYOUT.win;
    const glow = (x, y, r, c) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, c);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (!list.length) return;
    if (!lc) {
      [lc, lg] = mk();
      [tc, tg] = mk();
    }
    if (!lg || !tg) return;
    const masks = kit.SHOP && kit.SHOP.masks ? kit.SHOP.masks(s) : [];
    const people = kit.SHOP && kit.SHOP.people ? kit.SHOP.people(s).filter(([, z]) => z > 0) : [];
    const col = cyber() ? '#d8ecff' : '#ffd9a0';
    const deskCol = cyber() ? '#e0f4ff' : '#ffe2b0';
    // the lamps add up on one light map; a lit room also fills with light bounced off its walls and ceiling
    lg.clearRect(0, 0, W, H);
    lg.globalCompositeOperation = 'source-over';
    const pendants = list.filter((l) => l.shade === 'pendant').length;
    if (pendants) {
      lg.fillStyle = rgba(col, 0.28 + 0.12 * (pendants - 1));
      lg.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
    }
    lg.globalCompositeOperation = 'lighter';
    for (const l of list) {
      tg.clearRect(0, 0, W, H);
      // each lamp on its own scratch layer first (its shadows only cut its own light)
      const [c1, g1] = scratch();
      g1.clearRect(0, 0, W, H);
      oneLamp(g1, s, l, l.shade === 'desk' ? deskCol : col, l.shade === 'desk' ? 0.75 : 0.9, masks, people);
      lg.drawImage(c1, 0, 0);
    }
    lg.globalCompositeOperation = 'source-over';
    // the interior's cel bands, then the light reveals the room's own colours
    const RB = { x: Wn.x, y: Wn.y, w: Wn.w, h: Wn.h };
    if (F.bands !== false && kit.quantise) kit.quantise(lg, 3, 0.95, true, RB);
    kit.reveal(g, lc, 'in', 0, 0.95, g, false, null, RB);
    // the bulbs themselves, and the warm air around them
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of list) {
      if (l.shade === 'pendant') {
        // seen from ~14 m out the bulb is hidden by the shade: its lower rim glows, and the open top throws a small
        // scallop on the ceiling
        g.fillStyle = rgba(col, 0.7);
        g.fillRect(l.x - 5, l.y, 11, 1);
        g.save();
        g.translate(l.x, 82);
        g.scale(1, 0.3);
        glow(0, 0, 11, rgba(col, 0.22 + 0.15 * (1 - day)));
        g.restore();
      } else {
        // the desk lamp's tight pool on the counter top (v ~8 px above it: half power at ~6 px)
        g.save();
        g.translate(l.x, l.y + 9);
        g.scale(1, 0.3);
        glow(0, 0, 10, rgba(deskCol, 0.35 + 0.2 * (1 - day)));
        g.restore();
      }
    }
    g.restore();
  }
  // light spilling out of the window onto the pavement: from the lamps that are on, with the silhouettes of anyone
  // standing between a lamp and the glass thrown out across it
  let pc = null;
  let pg = null;
  function spill(g, s, day) {
    const list = LAMPS().filter((l) => isOn(s, l.id));
    if (!list.length || day >= 0.8) return;
    if (!pc) [pc, pg] = mk();
    if (!pg) return;
    const Wn = B.LAYOUT.win;
    const k = list.reduce((a, l) => a + (l.shade === 'pendant' ? 0.5 : 0.15), 0);
    pg.clearRect(0, 0, W, H);
    pg.fillStyle = cyber() ? `rgba(160,200,255,${((0.8 - day) * 0.14 * k).toFixed(3)})` : `rgba(255,170,90,${((0.8 - day) * 0.14 * k).toFixed(3)})`;
    pg.beginPath();
    pg.moveTo(Wn.x, 164);
    pg.lineTo(Wn.x + Wn.w, 164);
    pg.lineTo(Wn.x + Wn.w + 20, 180);
    pg.lineTo(Wn.x - 20, 180);
    pg.fill();
    const kit = B.lightKit;
    const people = kit && kit.SHOP && kit.SHOP.people ? kit.SHOP.people(s).filter(([, z]) => z > 0) : [];
    pg.globalCompositeOperation = 'destination-out';
    for (const l of list) {
      for (const [a, z] of people) {
        if (z >= l.z) continue; // only those between this lamp and the glass
        // out through the glass and down onto the paving: a wedge that widens and leans away from the lamp
        const m = clamp((l.z + 8) / (l.z - z), 1, 2.5);
        const dx = (a.x - l.x) * 0.25;
        pg.globalAlpha = 0.6 / list.length;
        pg.fillStyle = '#000';
        pg.beginPath();
        pg.moveTo(a.x - 3, 164);
        pg.lineTo(a.x + 3, 164);
        pg.lineTo(a.x + dx + 3 * m, 180);
        pg.lineTo(a.x + dx - 3 * m, 180);
        pg.closePath();
        pg.fill();
      }
    }
    pg.globalAlpha = 1;
    pg.globalCompositeOperation = 'source-over';
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(pc, 0, 0);
    g.restore();
  }

  let sc = null;
  let sg = null;
  function scratch() {
    if (!sc) [sc, sg] = mk();
    return [sc, sg];
  }

  // the cursor shows the lamps can be clicked
  B.on('ready', () => {
    const canvas = document.getElementById && document.getElementById('screen');
    if (!canvas || canvas._lampHover) return;
    canvas._lampHover = true;
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      const y = ((e.clientY - r.top) / r.height) * H;
      if (hitLamp(x, y)) canvas.style.cursor = 'pointer';
    });
  });
})(window.Bookshop);
