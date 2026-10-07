/* 2026-10-07 (sunlight)
 * The sun crosses the sky (a real solar model for a London street on today's date: B.sunPos in world.js), and
 * everything on the street answers it.
 * - The shopfront faces west-south-west: all morning the sun is behind the building and the front is in soft shade,
 *   lifted by warm light bounced off the sunlit buildings opposite; from about midday the sun rakes in from the right,
 *   square-on in late afternoon, then low and gold from the left until it sets. In winter it never clears the
 *   buildings opposite at all.
 * - Every projecting thing casts a shadow at the sun's angle: the cornice, window heads and sills, the deep fascia,
 *   pilasters, the recessed window and door, the lamp post (lantern and all), passers-by (legs and all) and traffic
 *   (windows letting light through; a bus slides panes of sun along the stall-riser).
 * - The buildings opposite cast their shadow up the front as the sun sinks, its edge stepped by chimneys and softened
 *   by the sun's own disc; golden hour climbs the shop until only the roofline glows.
 * - Cloud shadows, kilometres across, sweep the whole street dim and bright.
 * - By day the shop window is mostly a mirror of the street behind you (Fresnel: the sunlit world outshines the shop);
 *   it comes alive as the sun goes down. Low sun shines through it: its patch climbs the back wall, dust in the beam.
 * - Passing windscreens throw moving flashes of sun onto the shaded front at golden hour.
 * Shade multiplies by the sky's colour (warmer near the ground, where the sunlit paving bounces light up); sunlight
 * adds warmth by its angle of incidence; neon and lit windows are never dimmed by shade.
 * Flags (Lighting Lab): sun, sunInterior, cloudShadows, buildingShadow, glassReflection. */
(function (B) {
  const W = 320;
  const H = 180;
  const F = (B.lightFlags = B.lightFlags || {}); // one shared object: the Lighting Lab toggles it
  for (const [k, v] of Object.entries({ sun: true, sunInterior: true, cloudShadows: true, buildingShadow: true, glassReflection: true })) if (F[k] === undefined) F[k] = v;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rad = (d) => (d * Math.PI) / 180;
  const cyber = () => B.theme === 'cyber';
  const PX_PER_M = 23; // the facade is ~7 m tall from pavement to cornice
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
  };

  /** Where the sun is (elevation e, phi relative to the front: + from the right), and its colour and strength. */
  B.sun = function (s) {
    const P = B.sunPos(s.hour);
    const e = Math.max(0, P.e);
    const phi = P.phi;
    const w = s.weather || {};
    const overcast = clamp(Math.max((w.rain || 0) * 1.4, (w.fog || 0) * 1.5, ((w.cloud || 0) - 0.75) * 4), 0, 1);
    const strength = clamp(e / 4, 0, 1) * (1 - overcast) * (cyber() ? 0.6 : 1); // smog in the neon city
    const facing = Math.abs(phi) < 88 ? Math.cos(rad(e)) * Math.cos(rad(phi)) : 0;
    // the sun reddens as it sinks through more air (hazier and ambered in the neon city)
    const ramp = [[3, '#ff7a3a'], [10, '#ff9e48'], [20, '#ffcf8a'], [32, '#fff1d6'], [60, '#fff6ea']];
    let col = ramp[0][1];
    for (let i = 0; i < ramp.length - 1; i++) if (e >= ramp[i][0]) col = B.mix(ramp[i][1], ramp[i + 1][1], clamp((e - ramp[i][0]) / (ramp[i + 1][0] - ramp[i][0]), 0, 1));
    if (cyber()) col = B.mix(col, '#ffb070', 0.5);
    return { e, ePos: P.e, phi, strength, facing, col, tanE: Math.tan(rad(Math.max(e, 0.5))), tanP: Math.tan(rad(clamp(phi, -80, 80))), cosP: Math.cos(rad(clamp(phi, -80, 80))), behind: Math.abs(phi) >= 88 };
  };

  const canvas = (w = W, h = H) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };
  let mc, mg, tc, tg, rc2, rg2;
  const ensure = () => {
    if (mc) return !!mg;
    [mc, mg] = canvas();
    [tc, tg] = canvas();
    [rc2, rg2] = canvas();
    return !!mg;
  };

  // the skyline across the road (behind you), in metres: roofs, steps and chimney pots, varying along the street
  const SKY = (() => {
    const rng = B.seeded('skyline-opposite');
    const out = [];
    for (let x = -200; x < 520; ) {
      const wdt = 30 + Math.floor(rng() * 50);
      const h = 8.6 + rng() * 2.2;
      for (let i = 0; i < wdt; i++) out.push(h);
      if (rng() < 0.7) {
        const cx = out.length - wdt + 6 + Math.floor(rng() * (wdt - 12));
        for (let i = 0; i < 5; i++) out[cx + i] = h + 1.1;
        out[cx + 1] = out[cx + 3] = h + 1.5; // chimney pots
      }
      x += wdt;
    }
    return out;
  })();
  const skyAt = (x) => SKY[clamp(Math.round(x + 200), 0, SKY.length - 1)];
  B.oppositeSkyline = skyAt;

  /** The line below which the buildings across the road shade the front (screen y; > H means none). */
  function buildingLine(sun, x) {
    const dist = 22; // metres across the road
    const xs = x + sun.tanP * dist * PX_PER_M * 0.15; // the skyline seen along the sun's slant
    const lit = skyAt(xs) - (dist / sun.cosP) * sun.tanE;
    return 164 - lit * PX_PER_M;
  }

  // things that project from the wall: [x0, x1, yUnder, depth(px)]
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

  /** Drifting cloud shadows: clouds are hundreds of metres across, so a shadow covers the whole street at once and its
   *  soft edge (tens of metres) sweeps across in a few seconds. 1 = full sun, ~0.45 under a cloud. */
  function cloudAt(s, x) {
    if (!F.cloudShadows) return 1;
    const c = clamp((((s.weather && s.weather.cloud) || 0) - 0.15) * 1.6, 0, 0.92); // share of sky covered
    if (c < 0.03) return 1;
    const u = x - (performance.now() / 1000) * 35; // drifting at ~35 px/s
    const n = 0.5 + 0.25 * Math.sin(u / 900) + 0.15 * Math.sin(u / 377 + 1.7) + 0.1 * Math.sin(u / 2300 + 0.4);
    const k = clamp((n - (1 - c)) / 0.08 + 0.5, 0, 1); // ~150 px soft edge
    return 1 - 0.55 * k;
  }

  /** A vehicle's shadow on the wall (when the sun is low enough to reach it): body, cabin with see-through windows,
   *  wheels with daylight between them. Bus windows let the sun through as a row of bright panes. */
  function vehicleShadow(g, ev, sun) {
    const k = ev.t / ev.dur;
    const x = ev.dir > 0 ? -70 + k * 460 : 390 - k * 460;
    const d = ev.dir > 0 ? 55 : 85;
    const drop = d * sun.tanE; // every height lands this much lower on the wall
    const cx = x - d * sun.tanP;
    const at = (z) => 164 - (z - drop); // wall y for a point z px above the road
    const bus = ev.kind === 'bus';
    const bike = ev.kind === 'bike';
    const half = bus ? 60 : bike ? 8 : 28;
    const hgt = bus ? 70 : bike ? 30 : 34;
    if (at(hgt) > 180) return;
    if (bike) {
      g.fillRect(Math.round(cx - 2), Math.round(at(hgt)), 3, Math.round(at(0) - at(hgt)));
      for (const wx of [cx - 7, cx + 5]) g.fillRect(Math.round(wx), Math.round(at(12)), 4, 10);
      return;
    }
    // body (sills to waist), then the cabin's pillars and roof; the window panes stay lit
    g.fillRect(Math.round(cx - half), Math.round(at(hgt * 0.55)), half * 2, Math.round(at(6) - at(hgt * 0.55)));
    const roofY = Math.round(at(hgt));
    const cabin0 = bus ? cx - half : cx - half * 0.6;
    const cabin1 = bus ? cx + half : cx + half * 0.55;
    g.fillRect(Math.round(cabin0), roofY, Math.round(cabin1 - cabin0), 3);
    const pillars = bus ? 7 : 3;
    for (let i = 0; i < pillars; i++) {
      const px0 = cabin0 + ((cabin1 - cabin0) * i) / (pillars - 1);
      g.fillRect(Math.round(px0) - 1, roofY, 3, Math.round(at(hgt * 0.55) - roofY));
    }
    // wheels: dark blobs, daylight under the sills between them
    for (const wx of bus ? [cx - half + 12, cx + half - 22] : [cx - half + 6, cx + half - 14]) g.fillRect(Math.round(wx), Math.round(at(6)), 9, Math.round(at(0) - at(6)));
  }

  /** Paint the shadow mask (opaque = in shade) for this moment. */
  function buildMask(s, sun) {
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, W, H);
    mg.fillStyle = '#000';
    const down = (d) => (d * sun.tanE) / sun.cosP; // a protrusion of depth d shades this far below it
    const side = (d) => -d * sun.tanP; // ...and shifts its shadow sideways (away from the sun)
    if (sun.behind || sun.facing <= 0.02) {
      mg.fillRect(0, 8, W, H); // the sun is behind the building: the whole front is in shade
      return;
    }
    for (const [x0, x1, y, d] of overhangs()) {
      const dy = Math.max(1, Math.round(down(d)));
      const dx = Math.round(side(d));
      mg.fillRect(Math.min(x0, x0 + dx), y, x1 - x0 + Math.abs(dx), Math.min(dy, 40));
    }
    for (const r of recesses()) {
      const dy = Math.min(r.h, Math.max(1, Math.round(down(r.d))));
      mg.fillRect(r.x, r.y, r.w, dy);
      const dx = Math.min(r.w, Math.round(Math.abs(side(r.d))));
      if (sun.phi > 0) mg.fillRect(r.x + r.w - dx, r.y, dx, r.h);
      else mg.fillRect(r.x, r.y, dx, r.h);
    }
    for (const x of [0, 214, 266]) {
      const dx = Math.round(Math.abs(side(2)));
      if (!dx) continue;
      if (sun.phi > 0) mg.fillRect(x - dx, 73, dx, 91);
      else mg.fillRect(x + 8, 73, dx, 91);
    }
    // the lamp post at the kerb (30 out): across the paving to the wall, then up it, a tapering post and a lantern
    {
      const d = 30;
      const wx = 277 + side(d);
      mg.beginPath();
      mg.moveTo(276, 174);
      mg.lineTo(279, 174);
      mg.lineTo(wx + 1.5, 164);
      mg.lineTo(wx - 1, 164);
      mg.closePath();
      mg.fill();
      const top = 10 + down(d);
      if (top < 164) {
        mg.fillRect(Math.round(wx) - 1, Math.round(top + 40), 3, Math.max(0, Math.round(164 - top - 40)));
        mg.fillRect(Math.round(wx) - 1, Math.round(top + 9), 2, 31); // the post narrows towards the top
        // the lantern: a cap and finial over a box whose glass lets half the light through
        mg.fillRect(Math.round(wx) - 4, Math.round(top - 1), 9, 2);
        mg.fillRect(Math.round(wx), Math.round(top - 3), 1, 2);
        mg.fillRect(Math.round(wx) - 3, Math.round(top + 1), 7, 9);
        mg.globalCompositeOperation = 'destination-out';
        mg.fillStyle = 'rgba(0,0,0,0.5)';
        mg.fillRect(Math.round(wx) - 2, Math.round(top + 2), 5, 6);
        mg.globalCompositeOperation = 'source-over';
        mg.fillStyle = '#000';
      }
    }
    // passers-by: a shadow with legs across the paving towards the wall, then up it if the sun is low enough
    const people = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.5));
    if (s.owner.area === 'street') people.push(s.owner);
    for (const a of people) {
      const d = 6 + ((a.lane || 0) + 3) * 1.6;
      const reach = Math.min(d, 60 / sun.tanE);
      const k = reach / d;
      const ey = a.y - (a.y - 164) * k;
      const hG = Math.max(2, a.y - ey); // the ground strip is seen foreshortened
      const shear = side(reach) / hG;
      mg.save();
      mg.setTransform(1, 0, -shear, 1, shear * a.y, 0);
      B.drawSilhouette(mg, a, a.x, a.y, 1, hG / 60);
      mg.restore();
      if (k >= 1) {
        mg.save();
        mg.beginPath();
        mg.rect(0, 0, W, 164);
        mg.clip();
        B.drawSilhouette(mg, a, a.x + side(d), a.y + down(d) - (a.y - 164), 1, 1);
        mg.restore();
      }
    }
    for (const ev of B.trafficEvents || []) if (ev.kind !== 'turn') vehicleShadow(mg, ev, sun);
    // the buildings across the road: their shadow climbs the front as the sun goes down; the sun's 0.5 deg disc
    // blurs its edge over ~6 px (a 2x2 checker in the middle of that ramp)
    if (F.buildingShadow) {
      for (let x = 0; x < W; x++) {
        const y = Math.round(buildingLine(sun, x));
        if (y >= H + 3) continue;
        const y0 = Math.max(8, y + 3);
        if (y0 < H) mg.fillRect(x, y0, 1, H - y0);
        for (let yy = Math.max(8, y - 3); yy < Math.min(H, y + 3); yy++) {
          const t = (yy - (y - 3)) / 6;
          if ((t > 0.66) || (t > 0.33 && (x + yy) & 1)) mg.fillRect(x, yy, 1, 1);
        }
      }
    }
    // things that glow by themselves aren't shaded, and the lit shop window only loses its daylight share
    mg.globalCompositeOperation = 'destination-out';
    if (cyber()) for (const [x0, y0, w0, h0] of [[0, 52, 274, 21], [227, 77, 34, 12], [271, 58, 13, 26]]) mg.fillRect(x0, y0, w0, h0);
    mg.fillRect(231, 107, 27, 9); // the OPEN / CLOSED sign
    if (s.upstairs && s.upstairs.light) for (const u of B.LAYOUT.upstairs) mg.fillRect(u.x, u.y, u.w, u.h);
    const Wn = B.LAYOUT.win;
    mg.fillStyle = 'rgba(0,0,0,0.7)';
    mg.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
    mg.globalCompositeOperation = 'source-over';
    mg.fillStyle = '#000';
  }

  // ---------- the shopfront and pavement (under the people) ----------
  B.decor({
    id: 'sunlight-front',
    layer: 'street',
    draw(g, s) {
      if (!F.sun || !ensure()) return;
      const sun = B.sun(s);
      // in the morning (sun behind the building) the front is in the shade of its own building, but the street still
      // has daylight: the shade and the warm bounce from the sunlit buildings opposite
      const P = B.sunPos(s.hour);
      const skyLit = clamp((P.e + 2) / 8, 0, 1) * (1 - clamp(((s.weather && s.weather.rain) || 0) * 0.6, 0, 0.6));
      if (skyLit < 0.02) return;
      const S = sun.strength;
      buildMask(s, sun);
      if (F.cloudShadows && S > 0.02) {
        const c = 1 - cloudAt(s, 160);
        if (c > 0.02) {
          mg.fillStyle = `rgba(0,0,0,${(c / 0.55).toFixed(3)})`;
          mg.fillRect(0, 8, W, H - 8);
          mg.fillStyle = '#000';
        }
      }
      g.save();
      g.beginPath();
      g.rect(0, 8, 280, H - 8);
      g.rect(280, 164, 40, 16);
      g.clip();
      // shade: the scene multiplied by skylight, cool at the top, warmer low down where the sunlit paving bounces
      // light back up. Contrast follows the sun's angle on the front: ~2:1 at a raking angle, ~5:1 square-on
      const sunOnGround = Math.sin(rad(Math.max(sun.e, 0))) * S;
      tg.globalCompositeOperation = 'source-over';
      tg.clearRect(0, 0, W, H);
      tg.drawImage(mc, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      const gr = tg.createLinearGradient(0, 10, 0, 178);
      gr.addColorStop(0, cyber() ? '#5a4a94' : '#6676b0');
      gr.addColorStop(0.7, cyber() ? '#6a5a98' : B.mix('#6676b0', '#8c8a90', sunOnGround));
      gr.addColorStop(1, cyber() ? '#7a6a96' : B.mix('#6676b0', '#9a8e88', sunOnGround));
      tg.fillStyle = gr;
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'multiply';
      const contrast = sun.behind ? 0.45 : clamp(0.3 + sun.facing, 0.3, 1);
      g.globalAlpha = Math.max(0.45 * skyLit * (1 - S * 0.3), 0.8 * S * contrast);
      g.drawImage(tc, 0, 0);
      // sun: warmth where it falls, by the angle it strikes; golden hour the most saturated minute of the day
      if (S > 0.02 && !sun.behind) {
        tg.clearRect(0, 0, W, H);
        tg.fillStyle = sun.col;
        tg.fillRect(0, 0, W, H);
        tg.globalCompositeOperation = 'destination-out';
        tg.drawImage(mc, 0, 0);
        tg.globalCompositeOperation = 'source-over';
        const gold = sun.e < 10 ? 1 - sun.e / 10 : 0;
        g.globalCompositeOperation = 'soft-light';
        g.globalAlpha = Math.min(0.95, (0.45 + 0.45 * gold) * S * Math.max(0.35, sun.facing));
        g.drawImage(tc, 0, 0);
        if (gold > 0) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.12 * gold * S;
          g.drawImage(tc, 0, 0);
        }
      }
      // bounce: a warm line of light on the soffit under each ledge, from the sunlit paving
      if (sunOnGround > 0.05) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1;
        g.fillStyle = rgba('#ffd8a8', 0.15 * sunOnGround);
        for (const [x0, x1, y] of overhangs()) g.fillRect(x0, y, x1 - x0, 1);
      }
      // morning: light bounced off the sunlit buildings opposite warms the shaded front's lower half
      if (sun.behind && P.e > 2) {
        g.globalCompositeOperation = 'soft-light';
        g.globalAlpha = 0.15 * clamp(P.e / 15, 0, 1);
        g.fillStyle = '#e8b080';
        g.fillRect(0, 124, 280, 56);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.restore();
    },
  });

  // ---------- glass by day, the sun inside, people, and flashes of sun from windscreens ----------
  let lay = null;
  /** The street behind you, as seen mirrored in glass: sky above the opposite roofline (chimneys and all), the
   *  opposite facades below with their windows; sunlit in the morning, in shade in the evening. */
  function paintReflection(g, s, sun, top, rows) {
    const [skyTop, skyBot] = B.skyByElevation ? B.skyByElevation(s.hour, cyber()) : ['#7fb2e0', '#b5d6ee'];
    const P = B.sunPos(s.hour);
    const facadeLit = P.morning && P.e > 0; // the opposite fronts face east-north-east
    const wall = cyber() ? (facadeLit ? '#7a7084' : '#4a4458') : facadeLit ? '#d8c4a8' : '#8a8090';
    for (let x = 0; x < W; x++) {
      const roof = top + rows - (skyAt(W - x) - 8) * 6; // nearer the top of the glass, the higher the roofs
      for (let y = top; y < top + rows; y++) {
        let c;
        if (y < roof) c = B.mix(skyTop, skyBot, clamp((y - top) / Math.max(1, roof - top), 0, 1));
        else c = ((x >> 2) + (y >> 2)) % 5 === 0 && y > roof + 3 ? B.mix(wall, '#2a2a38', 0.5) : wall; // windows across the road
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  let reflCache = { key: '', c: null };
  B.decor({
    id: 'sunlight-inside',
    layer: 'overlay',
    draw(g, s) {
      if (!F.sun || !ensure()) return;
      const sun = B.sun(s);
      const P = B.sunPos(s.hour);
      const kit = B.lightKit;
      const S = sun.strength;
      const people = s.npcs.filter((n) => n.area === 'street' && !n.hidden && (n.alpha == null || n.alpha > 0.5));
      if (s.owner.area === 'street') people.push(s.owner);
      const Wn = B.LAYOUT.win;
      const dayAmt = clamp((P.e + 1) / 8, 0, 1);
      // the glass by day: reflection outshines the interior (single glazing reflects ~8% of a bright street)
      if (F.glassReflection && dayAmt > 0.02) {
        const key = `${Math.round(s.hour * 30)}|${B.theme}|${P.morning}`;
        if (reflCache.key !== key) {
          if (!reflCache.c) reflCache.c = canvas()[0];
          const rgx = reflCache.c.getContext('2d');
          rgx.clearRect(0, 0, W, H);
          paintReflection(rgx, s, sun, Wn.y, Wn.h);
          for (const u of B.LAYOUT.upstairs) paintReflection(rgx, s, sun, u.y, u.h);
          reflCache.key = key;
        }
        rg2.globalCompositeOperation = 'source-over';
        rg2.clearRect(0, 0, W, H);
        rg2.drawImage(reflCache.c, 0, 0);
        // only on glass, and never over the people standing in front of it
        rg2.globalCompositeOperation = 'destination-in';
        rg2.fillStyle = '#000';
        rg2.beginPath();
        rg2.rect(Wn.x, Wn.y, Wn.w, Wn.h);
        for (const u of B.LAYOUT.upstairs) if (!(s.upstairs && s.upstairs.light && P.e < 4)) rg2.rect(u.x, u.y, u.w, u.h);
        rg2.fill();
        rg2.globalCompositeOperation = 'destination-out';
        for (const a of people) B.drawSilhouette(rg2, a, a.x, a.y, 1, 1);
        rg2.fillRect(231, 107, 27, 9);
        rg2.globalCompositeOperation = 'source-over';
        // the interior recedes...
        g.save();
        g.beginPath();
        g.rect(Wn.x, Wn.y, Wn.w, Wn.h);
        g.clip();
        g.globalCompositeOperation = 'multiply';
        g.globalAlpha = 0.4 * dayAmt * (s.shop.lights ? 0.8 : 1);
        g.fillStyle = '#8a90a8';
        g.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
        g.restore();
        // ...behind the street's reflection
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = 0.3 * dayAmt;
        g.drawImage(rc2, 0, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      if (S < 0.02 || sun.behind || sun.facing <= 0.05) return;
      // people: cooler in the shade of the buildings opposite, warmer in the sun, with a shaded side away from it
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
        if (!shaded && Math.abs(sun.phi) > 25) {
          // the terminator: a column of shade down the side turned away from the sun
          tg.globalCompositeOperation = 'source-over';
          tg.clearRect(0, 0, W, H);
          B.drawSilhouette(tg, a, a.x, a.y, 1, 1);
          tg.globalCompositeOperation = 'destination-out';
          B.drawSilhouette(tg, a, a.x + (sun.phi > 0 ? -1 : 1), a.y, 1, 1);
          tg.globalCompositeOperation = 'source-in';
          tg.fillStyle = cyber() ? '#6a5aa0' : '#7484bc';
          tg.fillRect(0, 0, W, H);
          tg.globalCompositeOperation = 'source-over';
          g.globalCompositeOperation = 'multiply';
          g.globalAlpha = 0.5 * S;
          g.drawImage(tc, 0, 0);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      // passing windscreens throw flashes of sun onto the shaded front at golden hour
      if (sun.e < 14) {
        const gold = 1 - sun.e / 14;
        for (const ev of B.trafficEvents || []) {
          if (ev.kind === 'turn' || ev.kind === 'bike') continue;
          const k = ev.t / ev.dur;
          const x = (ev.dir > 0 ? -70 + k * 460 : 390 - k * 460) - (ev.dir > 0 ? 55 : 85) * sun.tanP;
          const wob = Math.sin(ev.t * 9 + ev.seed * 6);
          if (wob < 0.2) continue; // the glass only catches the sun at the right angle, in flickers
          const y = 96 + Math.round(ev.seed * 40);
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = rgba(sun.col, 0.18 * S * gold * wob);
          g.fillRect(Math.round(x), y, ev.kind === 'bus' ? 20 : 12, 6);
          g.globalCompositeOperation = 'source-over';
        }
      }
      if (!F.sunInterior || !kit || !kit.project) return;
      // sun through the glass: a directional source (very far away), its patch landing lower the higher the sun is
      const lineMid = F.buildingShadow ? buildingLine(sun, Wn.x + Wn.w / 2) : H;
      const lit = { x: Wn.x, y: Wn.y, w: Wn.w, h: Math.max(0, Math.min(Wn.h, lineMid - Wn.y)) };
      if (lit.h <= 0) return;
      if (!lay) lay = [kit.mk(), kit.mk()];
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
        motes: true,
      };
      const room = Object.assign({}, kit.SHOP, { aperture: () => [lit] });
      kit.project(qg, s, src, room, ag);
      kit.project(qg, s, Object.assign({}, src, { a: src.a * (s.upstairs.light ? 0.5 : 1) }), kit.FLAT, ag);
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
