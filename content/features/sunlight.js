/* 2026-10-07 (sunlight)
 * The sun crosses the sky, and everything on the street casts its shadow.
 * - The shopfront faces roughly west-south-west: in the morning the sun is behind the building and the front is in
 *   soft shade; from late morning it rakes in from the left, at midday it's high (short shadows under every ledge),
 *   and in the evening it's low in front, so shadows grow long and warm.
 * - Every projecting thing casts a shadow at the sun's angle: the cornice, the window heads and sills, the fascia, the
 *   pilasters, the window and door recesses, the lamp post, passers-by and passing cars.
 * - The buildings across the road (behind you) cast their shadow up the front as the sun sinks: the golden-hour light
 *   climbs the shop until only the roofline glows, the skyline's chimneys stepping its edge.
 * - Clouds drift between, dimming the sun in patches that sweep across the street.
 * - Low sun shines through the shop window: its patch climbs the back wall, with every prop's shadow in it.
 * Lighting is applied as light, not paint: shade multiplies the scene by the cool sky colour, sun adds warmth.
 * Flags (Lighting Lab): sun, sunInterior, cloudShadows, buildingShadow. */
(function (B) {
  const W = 320;
  const H = 180;
  const F = (B.lightFlags = B.lightFlags || {}); // one shared object: the Lighting Lab toggles it
  for (const [k, v] of Object.entries({ sun: true, sunInterior: true, cloudShadows: true, buildingShadow: true })) if (F[k] === undefined) F[k] = v;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rad = (d) => (d * Math.PI) / 180;
  const cyber = () => B.theme === 'cyber';
  const PX_PER_M = 23; // the facade is ~7 m tall from pavement to cornice

  /** Where the sun is: elevation and azimuth relative to the shopfront's normal (0 = straight behind you,
   *  negative = from the left, beyond +-90 = behind the building). Also its colour and strength. */
  B.sun = function (s) {
    const h = s.hour;
    const rise = 6.0;
    const set = 20.3;
    const k = (h - rise) / (set - rise);
    const e = k <= 0 || k >= 1 ? 0 : 52 * Math.sin(Math.PI * k); // degrees
    const phi = -100 + 165 * clamp(k, 0, 1); // the front only sees the sun from late morning
    const w = s.weather || {};
    const overcast = clamp(Math.max((w.rain || 0) * 1.4, (w.fog || 0) * 1.5, ((w.cloud || 0) - 0.55) * 2.5), 0, 1);
    const strength = clamp(e / 6, 0, 1) * (1 - overcast) * (cyber() ? 0.6 : 1); // smog in the neon city
    const facing = Math.abs(phi) < 88 ? Math.cos(rad(e)) * Math.cos(rad(phi)) : 0;
    const col = e < 7 ? '#ffa850' : e < 16 ? B.mix('#ffa850', '#ffe2a8', (e - 7) / 9) : B.mix('#ffe2a8', '#fff6e8', clamp((e - 16) / 20, 0, 1));
    return { e, phi, strength, facing, col, tanE: Math.tan(rad(Math.max(e, 0.5))), tanP: Math.tan(rad(clamp(phi, -80, 80))), cosP: Math.cos(rad(clamp(phi, -80, 80))) };
  };

  let mc = null;
  let mg = null;
  let tc = null;
  let tg = null;
  const ensure = () => {
    if (mc) return !!mg;
    mc = document.createElement('canvas');
    mc.width = W;
    mc.height = H;
    mg = mc.getContext('2d');
    tc = document.createElement('canvas');
    tc.width = W;
    tc.height = H;
    tg = tc.getContext('2d');
    return !!mg;
  };

  // the skyline across the road (behind you), in metres: roofs, steps and chimney pots, varying along the street
  const SKY = (() => {
    const rng = B.seeded('skyline-opposite');
    const out = [];
    let h = 9.5;
    for (let x = -200; x < 520; ) {
      const wdt = 30 + Math.floor(rng() * 50);
      h = 8.6 + rng() * 2.2;
      for (let i = 0; i < wdt; i++) out.push(h);
      // a chimney stack or two on the roof
      if (rng() < 0.7) {
        const cx = out.length - wdt + 6 + Math.floor(rng() * (wdt - 12));
        for (let i = 0; i < 5; i++) out[cx + i] = h + 1.1;
        out[cx + 1] = out[cx + 3] = h + 1.5; // pots
      }
      x += wdt;
    }
    return out;
  })();
  const skyAt = (x) => SKY[clamp(Math.round(x + 200), 0, SKY.length - 1)];

  /** The line below which the buildings across the road shade the front (screen y; > H means none). */
  function buildingLine(sun, x) {
    const dist = 22; // metres across the road
    const xs = x + (sun.tanP * dist * PX_PER_M) / 3; // the skyline seen along the sun's slant
    const lit = skyAt(xs) - (dist / sun.cosP) * sun.tanE; // shade climbs to this height (m)
    return 164 - lit * PX_PER_M;
  }

  // things that project from the wall: [x0, x1, yUnder, depth(px)] (horizontal), and recesses
  function overhangs() {
    const L = B.LAYOUT;
    const list = [[0, 280, 12, 4], [0, 274, 73, 6], [4, 216, 147, 3]]; // cornice, fascia (a deep sign box), sill
    for (const u of L.upstairs) list.push([u.x - 4, u.x + u.w + 4, u.y - 3, 2], [u.x - 4, u.x + u.w + 4, u.y + u.h + 4, 2]);
    return list;
  }
  function recesses() {
    const L = B.LAYOUT;
    const out = [{ x: L.win.x, y: L.win.y, w: L.win.w, h: L.win.h, d: 3 }, { x: L.doorOpening.x, y: L.doorOpening.y, w: L.doorOpening.w, h: L.doorOpening.h, d: 4 }];
    for (const u of L.upstairs) out.push({ x: u.x, y: u.y, w: u.w, h: u.h, d: 2 });
    return out;
  }

  /** Paint the shadow mask (opaque = in shade) for this moment. */
  function buildMask(s, sun) {
    mg.clearRect(0, 0, W, H);
    mg.fillStyle = '#000';
    const down = (d) => (d * sun.tanE) / sun.cosP; // a protrusion of depth d shades this far below it
    const side = (d) => -d * sun.tanP; // ...and shifts its shadow sideways (away from the sun)
    if (sun.facing <= 0.02) {
      mg.fillRect(0, 8, W, H); // the sun is behind the building: the whole front is in shade
      return;
    }
    // ledges and overhangs
    for (const [x0, x1, y, d] of overhangs()) {
      const dy = Math.max(1, Math.round(down(d)));
      const dx = Math.round(side(d));
      mg.fillRect(Math.min(x0, x0 + dx), y, x1 - x0 + Math.abs(dx), Math.min(dy, 40));
    }
    // recessed openings: the head shades the top, one jamb shades a side
    for (const r of recesses()) {
      const dy = Math.min(r.h, Math.max(1, Math.round(down(r.d))));
      mg.fillRect(r.x, r.y, r.w, dy);
      const dx = Math.min(r.w, Math.round(Math.abs(side(r.d))));
      if (sun.phi > 0) mg.fillRect(r.x + r.w - dx, r.y, dx, r.h);
      else mg.fillRect(r.x, r.y, dx, r.h);
    }
    // pilasters stand proud of the front by 2: a strip of shade beside each, away from the sun
    for (const x of [0, 214, 266]) {
      const dx = Math.round(Math.abs(side(2)));
      if (!dx) continue;
      if (sun.phi > 0) mg.fillRect(x - dx, 73, dx, 91);
      else mg.fillRect(x + 8, 73, dx, 91);
    }
    // the lamp post at the kerb (30 out): across the paving to the wall, then up it
    {
      const d = 30;
      const wx = 277 + side(d);
      mg.beginPath();
      mg.moveTo(276, 174);
      mg.lineTo(279, 174);
      mg.lineTo(wx + 2, 164);
      mg.lineTo(wx - 1, 164);
      mg.closePath();
      mg.fill();
      const top = 10 + down(d);
      if (top < 164) mg.fillRect(Math.round(wx) - 1, Math.round(top), 3, Math.round(164 - top));
      if (top + 10 < 164) mg.fillRect(Math.round(wx - 7), Math.round(top - 3), 15, 3); // the lantern
    }
    // passers-by: a shadow across the paving towards the wall, and up it if the sun is low enough
    const people = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.5));
    if (s.owner.area === 'street') people.push(s.owner);
    for (const a of people) {
      const d = 6 + ((a.lane || 0) + 3) * 1.6;
      const reach = Math.min(d, 60 / sun.tanE); // how far the shadow runs along the ground
      const k = reach / d;
      const ex = a.x + side(reach);
      const ey = a.y - (a.y - 164) * k;
      mg.beginPath();
      mg.moveTo(a.x - 3, a.y);
      mg.lineTo(a.x + 3, a.y);
      mg.lineTo(ex + 3, ey);
      mg.lineTo(ex - 3, ey);
      mg.closePath();
      mg.fill();
      if (k >= 1) {
        // the rest climbs the wall: an upright silhouette, shifted along and down by the sun's angle
        mg.save();
        mg.beginPath();
        mg.rect(0, 0, W, 164);
        mg.clip();
        B.drawSilhouette(mg, a, a.x + side(d), a.y + down(d) - (a.y - 164), 1, 1);
        mg.restore();
      }
    }
    // passing cars between the sun and us: a long low shadow sliding along the stall-riser as the sun sinks
    for (const ev of B.trafficEvents || []) {
      if (ev.kind === 'turn') continue;
      const k = ev.t / ev.dur;
      const x = ev.dir > 0 ? -70 + k * 460 : 390 - k * 460;
      const d = ev.dir > 0 ? 55 : 85;
      const hgt = ev.kind === 'bus' ? 70 : ev.kind === 'bike' ? 30 : 34;
      const top = 164 - (hgt - d * sun.tanE);
      const half = ev.kind === 'bus' ? 60 : ev.kind === 'bike' ? 6 : 28;
      const cx = x + side(d);
      if (top < 180) mg.fillRect(Math.round(cx - half), Math.round(Math.max(8, top)), half * 2, Math.round(180 - Math.max(8, top)));
    }
    // the buildings across the road: their shadow climbs the front as the sun goes down
    if (F.buildingShadow) {
      for (let x = 0; x < W; x++) {
        const y = Math.round(buildingLine(sun, x));
        if (y < H) mg.fillRect(x, Math.max(8, y), 1, H - Math.max(8, y));
      }
    }
  }

  /** Drifting cloud shadows: how much of the sun gets through at x (1 = all). */
  function cloudAt(s, x) {
    if (!F.cloudShadows) return 1;
    const c = clamp(((s.weather && s.weather.cloud) || 0) * 1.4, 0, 1);
    if (c < 0.05) return 1;
    const t = s.simT * 0.6;
    const n = 0.5 + 0.5 * Math.sin(x * 0.012 - t * 0.05) * Math.sin(x * 0.0071 + t * 0.031 + 1.3);
    return 1 - c * 0.85 * clamp((n - 0.35) * 3, 0, 1);
  }

  // ---------- on the shopfront and pavement (under the people) ----------
  B.decor({
    id: 'sunlight-front',
    layer: 'street',
    draw(g, s) {
      if (!F.sun || !ensure()) return;
      const sun = B.sun(s);
      if (sun.strength < 0.02) return;
      buildMask(s, sun);
      // clouds: thin the sun in drifting patches (added to the shade)
      if (F.cloudShadows && ((s.weather && s.weather.cloud) || 0) > 0.05) {
        for (let x = 0; x < W; x += 2) {
          const c = 1 - cloudAt(s, x);
          if (c > 0.02) {
            mg.fillStyle = `rgba(0,0,0,${c.toFixed(3)})`;
            mg.fillRect(x, 8, 2, H - 8);
          }
        }
      }
      const S = sun.strength;
      g.save();
      g.beginPath();
      g.rect(0, 8, 280, H - 8);
      g.rect(280, 164, 40, 16);
      g.clip();
      // shade: the scene multiplied by the cool light of the sky
      tg.globalCompositeOperation = 'source-over';
      tg.clearRect(0, 0, W, H);
      tg.drawImage(mc, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = cyber() ? '#5a4a94' : '#6676b0';
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.62 * S; // sunlit stone is several times brighter than stone lit only by the sky
      g.drawImage(tc, 0, 0);
      // sun: warmth added where it falls, strongest when it strikes the front square-on and when it's low and gold
      tg.clearRect(0, 0, W, H);
      tg.fillStyle = sun.col;
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'destination-out';
      tg.drawImage(mc, 0, 0);
      tg.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'soft-light';
      g.globalAlpha = Math.min(0.9, (0.5 + (sun.e < 14 ? 0.35 : 0)) * S * Math.max(0.35, sun.facing));
      g.drawImage(tc, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.restore();
    },
  });

  // ---------- through the window, and on the people ----------
  let lay = null;
  B.decor({
    id: 'sunlight-inside',
    layer: 'overlay',
    draw(g, s) {
      if (!F.sun || !ensure()) return;
      const sun = B.sun(s);
      if (sun.strength < 0.02 || sun.facing <= 0.05) return;
      const kit = B.lightKit;
      const S = sun.strength;
      const day = B.daylight(s.hour);
      if (day < 0.98 && mc) {
        // the dusk tint darkens the whole frame, but while the sun is still up whatever it touches still glows:
        // relight those parts (the mask from the street pass) in the sun's colour
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, W, H);
        tg.fillStyle = sun.col;
        tg.fillRect(0, 8, 280, H - 8);
        tg.globalCompositeOperation = 'destination-out';
        tg.drawImage(mc, 0, 0);
        const Wn0 = B.LAYOUT.win;
        tg.fillRect(Wn0.x, Wn0.y, Wn0.w, Wn0.h);
        for (const u of B.LAYOUT.upstairs) tg.fillRect(u.x, u.y, u.w, u.h);
        tg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.min(0.5, (1 - day) * 0.7 * S * Math.max(0.4, sun.facing));
        g.drawImage(tc, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      // people standing in the shade of the buildings opposite are cooler; those in the sun warmer
      const people = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.5));
      if (s.owner.area === 'street') people.push(s.owner);
      for (const a of people) {
        const shaded = F.buildingShadow && buildingLine(sun, a.x) < a.y - 30;
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, W, H);
        B.drawSilhouette(tg, a, a.x, a.y, 1, 1);
        tg.globalCompositeOperation = 'source-in';
        tg.fillStyle = shaded ? (cyber() ? '#6a5aa0' : '#7484bc') : sun.col;
        tg.fillRect(0, 0, W, H);
        tg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = shaded ? 'multiply' : 'soft-light';
        g.globalAlpha = (shaded ? 0.35 : 0.4) * S * cloudAt(s, a.x);
        g.drawImage(tc, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      if (!F.sunInterior || !kit || !kit.project) return;
      // sun through the glass: a directional source (very far away), its patch landing lower the higher the sun is
      const Wn = B.LAYOUT.win;
      const lineMid = F.buildingShadow ? buildingLine(sun, Wn.x + Wn.w / 2) : H;
      const lit = { x: Wn.x, y: Wn.y, w: Wn.w, h: Math.max(0, Math.min(Wn.h, lineMid - Wn.y)) };
      if (lit.h <= 0) return;
      if (!lay) {
        lay = [kit.mk(), kit.mk()];
      }
      const [[qc, qg], [ac, ag]] = lay;
      if (!qg || !ag) return;
      qg.clearRect(0, 0, W, H);
      ag.clearRect(0, 0, W, H);
      kit.setMain(g.canvas || null);
      const D = 6000;
      const src = {
        x: 110 + D * sun.tanP * 0.5,
        y: 110 - (D * sun.tanE) / sun.cosP,
        D,
        col: sun.col,
        a: Math.min(0.85, 0.7 * S * sun.facing * cloudAt(s, 110)),
      };
      const room = Object.assign({}, kit.SHOP, { aperture: () => [lit] });
      kit.project(qg, s, src, room, ag);
      // the flat upstairs too (its blinds permitting)
      kit.project(qg, s, Object.assign({}, src, { a: src.a * (s.upstairs.light ? 0.5 : 1) }), kit.FLAT, ag);
      // people on the pavement stand in front of the glass: never paint over them
      for (const c of [qg, ag]) {
        c.save();
        c.globalCompositeOperation = 'destination-out';
        for (const a of people) B.drawSilhouette(c, a, a.x, a.y, 1, 1);
        c.restore();
      }
      g.drawImage(qc, 0, 0);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(ac, 0, 0);
      g.globalCompositeOperation = 'source-over';
    },
  });
})(window.Bookshop);
