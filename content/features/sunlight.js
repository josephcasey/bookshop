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
    const ramp = [[0.5, '#ff8c40'], [3, '#ffa860'], [6, '#ffbf80'], [12, '#ffd6a8'], [20, '#ffe8cc'], [30, '#fff4e6'], [60, '#fff6ea']]; // ~2300 K to 5500 K
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
  let mc, mg, tc, tg, rc2, rg2, dk, dkg;
  const ensure = () => {
    if (mc) return !!mg;
    [mc, mg] = canvas();
    [tc, tg] = canvas();
    [rc2, rg2] = canvas();
    [dk, dkg] = canvas();
    return !!mg;
  };

  // the skyline across the road (behind you), in metres: roofs, steps and chimney pots, varying along the street
  const SKY = (() => {
    const rng = B.seeded('skyline-opposite');
    const out = [];
    const blocks = (B.oppositeBlocks = []); // the buildings, for whoever paints them (content/features/opposite-street.js)
    for (let x = -200; x < 520; ) {
      const wdt = 30 + Math.floor(rng() * 50);
      const h = 8.6 + rng() * 2.2;
      blocks.push({ x, w: wdt, h });
      for (let i = 0; i < wdt; i++) out.push(h);
      if (rng() < 0.7) {
        const cx = out.length - wdt + 6 + Math.floor(rng() * (wdt - 12));
        for (let i = 0; i < 5; i++) out[cx + i] = h + 1.1;
        out[cx + 1] = out[cx + 3] = h + 1.5; // chimney pots
      }
      x += wdt;
    }
    // a side street opens off the road behind you: a gap in the skyline where low sun gets through
    for (let i = 0; i < 40; i++) out[310 + i] = 0;
    // the gap cuts the buildings either side of it
    const cut = [];
    for (const b of blocks) {
      if (b.x + b.w <= 110 || b.x >= 150) cut.push(b);
      else {
        if (b.x < 110) cut.push({ x: b.x, w: 110 - b.x, h: b.h });
        if (b.x + b.w > 150) cut.push({ x: 150, w: b.x + b.w - 150, h: b.h });
      }
    }
    cut.push({ x: 110, w: 40, h: 0, gap: true });
    B.oppositeBlocks = cut.filter((b) => b.w >= 4).sort((a, b) => a.x - b.x);
    return out;
  })();
  const skyAt = (x) => SKY[clamp(Math.round(x + 200), 0, SKY.length - 1)];
  B.oppositeSkyline = skyAt;

  /** The line below which the buildings across the road shade the front (screen y; > H means none). */
  function buildingLine(sun, x) {
    const dist = 22; // metres across the road
    const xs = x + sun.tanP * dist * PX_PER_M; // the skyline seen along the sun's slant (the gap sweeps as the azimuth swings)
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
    const u = x - (performance.now() / 1000) * 120; // cloud shadows race at ~5 m/s (120 px/s)
    const n = 0.5 + 0.25 * Math.sin(u / 900) + 0.15 * Math.sin(u / 377 + 1.7) + 0.1 * Math.sin(u / 2300 + 0.4);
    const k = clamp((n - (1 - c)) / 0.2 + 0.5, 0, 1); // a ~300 px soft edge (the sun's disc at a kilometre)
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
    const half = bus ? 126 : bike ? 21 : 49; // half of 11 m, 1.8 m, 4.3 m (sunlight projects 1:1 along the street)
    const hgt = bus ? 70 : bike ? 30 : 34;
    if (at(hgt) > 180) return;
    if (bike) {
      g.fillRect(Math.round(cx - 2), Math.round(at(hgt)), 3, Math.round(at(0) - at(hgt)));
      for (const wx of [cx - 7, cx + 5]) g.fillRect(Math.round(wx), Math.round(at(12)), 4, 10);
      return;
    }
    // the footprint first: everything below `drop` lands on the paving, a solid sheared slab running back to us
    const shear = -sun.tanP * 3; // ~3 px of depth per pavement row
    for (let y = 164; y < 180; y++) {
      const dx = (y - 164) * shear;
      g.fillRect(Math.round(cx - half + dx), y, half * 2, 1);
    }
    // on the wall: a solid body to the beltline (with daylight under the sills only if they reach the wall)
    const belt = hgt * (bus ? 0.4 : 0.62);
    g.fillRect(Math.round(cx - half), Math.round(at(belt)), half * 2, Math.max(0, Math.round(Math.min(164, at(6)) - at(belt))));
    if (at(6) < 164) {
      g.fillRect(Math.round(cx - half), Math.round(at(6)), half * 2, Math.round(Math.min(164, at(0)) - at(6)));
      // the gap under the sills between the wheels lets the sun through
      g.save();
      g.globalCompositeOperation = 'destination-out';
      const w0 = bus ? cx - half + 22 : cx - half + 16;
      const w1 = bus ? cx + half - 22 : cx + half - 16;
      g.fillRect(Math.round(w0), Math.round(at(5)), Math.round(w1 - w0), Math.max(1, Math.round(Math.min(164, at(1)) - at(5))));
      g.restore();
    }
    const roofY = Math.round(at(hgt));
    const beltY = Math.round(at(belt));
    if (bus) {
      // a box: roof slab, a pillar between each pane
      g.fillRect(Math.round(cx - half), roofY, half * 2, 4);
      for (let i = 0; i < 8; i++) g.fillRect(Math.round(cx - half + (half * 2 * i) / 7) - 1, roofY, 3, beltY - roofY);
      return;
    }
    // a car: the cabin sits back from the bonnet, roof in two steps, raked windscreen and rear screen
    const f = ev.dir; // the bonnet leads
    const front = cx + f * half * 0.45;
    const rear = cx - f * half * 0.7;
    const lo = Math.min(front, rear);
    const hi = Math.max(front, rear);
    g.fillRect(Math.round(lo + 3), roofY, Math.round(hi - lo - 6), 1);
    g.fillRect(Math.round(lo + 1), roofY + 1, Math.round(hi - lo - 2), 2);
    const rows = beltY - roofY - 3;
    for (let r = 0; r < rows; r++) {
      const y = roofY + 3 + r;
      const k = r / Math.max(1, rows);
      // the A-pillar leans out toward the bonnet, the C-pillar back toward the boot
      const aX = front + f * k * 7;
      const cX = rear - f * k * 3;
      g.fillRect(Math.round(aX) - 1, y, 2, 1);
      g.fillRect(Math.round(cX) - (f > 0 ? 3 : 1), y, 4, 1); // a broad C-pillar
      g.fillRect(Math.round((front + rear) / 2) - 1, y, 2, 1); // the B-pillar
    }
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
    // raking light on the brickwork: each course overhangs the mortar a little, so when the sun is high the bed joints
    // shade, and when it comes in from the side the head joints do; square-on, the wall goes flat
    if (!cyber()) {
      const bed = clamp((sun.e - 8) / 40, 0, 0.7);
      const head = clamp((Math.abs(sun.phi) - 10) / 50, 0, 0.7);
      if (bed > 0.02) {
        mg.fillStyle = `rgba(0,0,0,${bed.toFixed(3)})`;
        for (let row = 0; 13 + row * 5 < 53; row++) mg.fillRect(0, 13 + row * 5 + 4, 274, 1);
      }
      if (head > 0.02) {
        mg.fillStyle = `rgba(0,0,0,${head.toFixed(3)})`;
        for (let row = 0; 13 + row * 5 < 53; row++) for (let x = (row % 2 ? -5 : 0) + 9; x < 274; x += 10) mg.fillRect(x, 13 + row * 5, 1, 4);
      }
      mg.fillStyle = '#000';
    }
    // the buildings across the road: their shadow climbs the front as the sun goes down. The sun's disc softens
    // every edge, horizontal or vertical, alike: a 2 px half-shade band, no checker
    if (F.buildingShadow) {
      // the sun's 0.53 deg disc at the skyline's slant distance: ~2 px square-on, 3 px at a raking angle
      const pr = clamp(Math.round((0.0093 * (22 / sun.cosP) * PX_PER_M) / 2), 2, 3);
      const L = new Float32Array(W + 4);
      for (let x = -2; x < W + 2; x++) L[x + 2] = buildingLine(sun, x);
      mg.fillStyle = '#000';
      for (let x = 0; x < W; x++) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let o = 2 - pr; o <= 2 + pr; o++) {
          lo = Math.min(lo, L[clamp(x + o, 0, W + 3)]);
          hi = Math.max(hi, L[clamp(x + o, 0, W + 3)]);
        }
        if (lo >= H + 2) continue;
        const y1 = Math.max(8, Math.round(hi) + 2);
        if (y1 < 164) mg.fillRect(x, y1, 1, 164 - y1);
        for (let y = Math.max(8, Math.round(lo) - 2); y < Math.min(164, y1); y++) {
          let f = 0;
          for (let o = 2 - pr; o <= 2 + pr; o++) f += clamp((y - L[clamp(x + o, 0, W + 3)]) / (pr + 1) + 0.5, 0, 1);
          f /= 2 * pr + 1;
          if (f > 0.75) mg.fillRect(x, y, 1, 1);
          else if (f > 0.25) {
            mg.fillStyle = 'rgba(0,0,0,0.5)';
            mg.fillRect(x, y, 1, 1);
            mg.fillStyle = '#000';
          }
        }
      }
    }
    // the paving: a row (y - 164) further out sees the skyline from ~0.2 m per row nearer it, shifted by its depth
    if (F.buildingShadow) {
      const pr = 2;
      for (let y = 164; y < H; y++) {
        const shift = -sun.tanP * (y - 164) * 4.6;
        for (let x = 0; x < W; x++) {
          let f = 0;
          for (let o = -pr; o <= pr; o++) f += clamp((164 + (y - 164) * 0.6 - buildingLine(sun, x + shift + o)) / (pr + 1) + 0.5, 0, 1);
          f /= 2 * pr + 1;
          if (f > 0.75) mg.fillRect(x, y, 1, 1);
          else if (f > 0.25) {
            mg.fillStyle = 'rgba(0,0,0,0.5)';
            mg.fillRect(x, y, 1, 1);
            mg.fillStyle = '#000';
          }
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
      const Wn0 = B.LAYOUT.win;
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
      // an evening front faces the bright western sky: its shade is lighter and more neutral than a morning one
      const SP = B.sunPos(s.hour);
      const eve = !SP.morning ? clamp((14 - SP.e) / 10, 0, 1) * clamp((SP.e + 3) / 3, 0, 1) : 0;
      const top0 = B.mix(cyber() ? '#5a4a94' : '#6676b0', cyber() ? '#7a6aa0' : '#8a8aa8', eve);
      gr.addColorStop(0, top0);
      gr.addColorStop(0.7, B.mix(cyber() ? '#6a5a98' : B.mix('#6676b0', '#8c8a90', sunOnGround), cyber() ? '#7a6aa0' : '#8e8ca6', eve));
      gr.addColorStop(1, B.mix(cyber() ? '#7a6a96' : B.mix('#6676b0', '#9a8e88', sunOnGround), cyber() ? '#806e9c' : '#9690a0', eve));
      tg.fillStyle = gr;
      tg.fillRect(0, 0, W, H);
      tg.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'multiply';
      const contrast = sun.behind ? 0.45 : clamp(0.3 + sun.facing, 0.3, 1);
      g.globalAlpha = Math.max(0.45 * skyLit * (1 - S * 0.3), 0.8 * S * contrast) * (1 - 0.25 * eve);
      g.drawImage(tc, 0, 0);
      // twilight: the whole sky is dimmer at low sun, so the front darkens and the lamps and lit windows gain on it
      {
        const u = clamp((P.e + 6) / 26, 0, 1);
        const dark = (1 - u * u * (3 - 2 * u)) * (1 - 0.6 * B.nightness(s.hour));
        if (dark > 0.02) {
          tg.globalCompositeOperation = 'source-over';
          tg.clearRect(0, 0, W, H);
          const below = clamp(-P.e / 4, 0, 1);
          tg.fillStyle = P.morning ? (cyber() ? '#9098c8' : '#a0a8c8') : B.mix(cyber() ? '#9a90c0' : '#9aa0c0', '#7a6890', below);
          tg.fillRect(0, 0, W, H);
          tg.globalCompositeOperation = 'destination-out';
          if (cyber()) for (const [x0, y0, w0, h0] of [[0, 52, 274, 21], [227, 77, 34, 12], [271, 58, 13, 26]]) tg.fillRect(x0, y0, w0, h0);
          if (s.upstairs && s.upstairs.light) for (const v of B.LAYOUT.upstairs) tg.fillRect(v.x, v.y, v.w, v.h);
          if (s.shop.lights) tg.fillRect(Wn0.x, Wn0.y, Wn0.w, Wn0.h);
          tg.globalCompositeOperation = 'source-over';
          g.globalCompositeOperation = 'multiply';
          g.globalAlpha = Math.min(0.85, (0.52 + 0.3 * clamp(-P.e / 4, 0, 1)) * dark * (P.morning && P.e < 6 ? 1.55 : 1));
          g.drawImage(tc, 0, 0);
        }
      }
      // sun: warmth where it falls, by the angle it strikes; golden hour the most saturated minute of the day
      if (S > 0.02 && !sun.behind) {
        tg.clearRect(0, 0, W, H);
        tg.fillStyle = sun.col;
        tg.fillRect(0, 0, W, H);
        tg.globalCompositeOperation = 'destination-out';
        tg.drawImage(mc, 0, 0);
        {
          const L = B.LAYOUT;
          tg.fillRect(L.win.x, L.win.y, L.win.w, L.win.h);
          tg.fillRect(L.doorGlass.x, L.doorGlass.y, L.doorGlass.w, L.doorGlass.h);
          for (const u of L.upstairs) tg.fillRect(u.x, u.y, u.w, u.h);
        }
        tg.globalCompositeOperation = 'source-over';
        const gold = sun.e < 10 ? 1 - sun.e / 10 : 0;
        const lowBoost = sun.e < 8 ? 1.3 : 1;
        g.globalCompositeOperation = 'soft-light';
        g.globalAlpha = Math.min(0.95, (0.45 + 0.45 * gold) * S * Math.max(0.35, sun.facing) * lowBoost);
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
      // twilight: the front faces west, into the afterglow: peach, then rose, then the blue of blue hour
      if (!P.morning && P.e < 2 && P.e > -9) {
        const k = clamp((2 - P.e) / 3, 0, 1) * clamp((P.e + 9) / 3, 0, 1);
        const col = P.e > -4 ? B.mix('#ffc0a0', '#e8a0b0', clamp(-P.e / 4, 0, 1)) : B.mix('#e8a0b0', '#7080c0', clamp((-P.e - 4) / 2, 0, 1));
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, W, H);
        tg.fillStyle = col;
        tg.fillRect(0, 8, 280, H - 8);
        tg.globalCompositeOperation = 'destination-out';
        if (cyber()) for (const [x0, y0, w0, h0] of [[0, 52, 274, 21], [227, 77, 34, 12], [271, 58, 13, 26]]) tg.fillRect(x0, y0, w0, h0);
        if (s.upstairs && s.upstairs.light) for (const u of B.LAYOUT.upstairs) tg.fillRect(u.x, u.y, u.w, u.h);
        tg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = 'soft-light';
        g.globalAlpha = 0.25 * k;
        g.drawImage(tc, 0, 0);
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
  /** The terrace across the road as the glass sees it, by mirrored street x and height (m): shopfronts with a fascia
   *  band, piers and doors, brick above with first-floor sashes. At dusk the fronts go dark and some shops stay lit. */
  function frontage(xo, Hh, wall, dusk) {
    if (Hh < 0.3) return cyber() ? '#24222c' : '#55524e'; // the road
    const bay = ((xo % 40) + 40) % 40;
    const shop = Math.floor(xo / 40);
    const lit = dusk && (((shop % 5) + 5) % 5 === 1 || ((shop % 7) + 7) % 7 === 4); // the pub, the chippy
    if (Hh < 0.6) return dusk ? '#16141e' : B.mix(wall, '#2a2a38', 0.35); // stall-risers
    if (Hh < 2.6) {
      if (bay < 28) return lit ? (bay % 9 === 0 ? '#5a3a20' : '#e0a050') : dusk ? '#1a1822' : B.mix(wall, '#2a2a38', 0.45); // windows
      return dusk ? '#16141e' : bay > 31 && bay < 38 ? B.mix(wall, '#2a2a38', 0.3) : wall; // pier and door
    }
    if (Hh < 3.3) return dusk ? (lit ? '#4a3420' : '#16141e') : B.mix(wall, '#3a2a2a', 0.4); // fascia
    if (Hh > 4.2 && Hh < 5.6 && ((xo % 20) + 20) % 20 < 8) return dusk ? (lit && xo % 3 ? '#a87840' : '#16141e') : B.mix(wall, '#2a2a38', 0.4); // sashes
    return dusk ? '#16141e' : wall;
  }
  function paintReflection(g, s, sun, top, rows, skyMask) {
    const P = B.sunPos(s.hour);
    let [skyTop, skyBot] = B.skyByElevation ? B.skyByElevation(s.hour, cyber()) : ['#7fb2e0', '#b5d6ee'];
    if (!P.morning && P.e < 12) {
      // the evening sky behind you is the sunset side
      const keys = [[-8, '#1a2048', '#3a3060'], [-4, '#4a3a6a', '#a86a90'], [-1, '#8a6a9a', '#f08a70'], [2, '#9aa8d0', '#ffb070'], [12, '#7fb2e0', '#ffe0b8']];
      const e = clamp(P.e, -8, 12);
      let i = 0;
      while (i < keys.length - 2 && keys[i + 1][0] <= e) i++;
      const q = clamp((e - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1);
      skyTop = B.mix(keys[i][1], keys[i + 1][1], q);
      skyBot = B.mix(keys[i][2], keys[i + 1][2], q);
    }
    const dusk = !P.morning && P.e < 3;
    const facadeLit = P.morning && P.e > 0; // the opposite fronts face east-north-east
    const wall = cyber() ? (facadeLit ? '#8a7484' : '#4a4458') : facadeLit ? '#d09068' : '#8a8090';
    for (let x = 0; x < W; x++) {
      const xm = 160 + (x - 160) * 2.57; // a mirror facing us magnifies sideways by the same parallax, no flip
      const sk = skyAt(xm);
      for (let y = top; y < top + rows; y++) {
        // the height at which the reflected sight line meets the buildings across the road
        const hm = (164 - y) / PX_PER_M;
        const Hh = hm + (hm - 1.6) * 1.57;
        const sky = sk < 1 ? Hh > 6 : Hh > sk; // through the passage the sight line meets the yards and backs first
        let c;
        if (sky) c = B.mix(skyTop, skyBot, clamp((sk + 9 - Hh) / 8, 0, 1)); // brightest low down, just above their roofs
        else if (g.skyOnly && Hh >= 0) continue;
        else if (g.skyOnly) c = cyber() ? '#24222c' : B.mix('#55524e', '#2a2830', clamp(-Hh / 2, 0, 1)); // the road, darker nearer
        else c = sk < 1 && Hh >= 0.3 ? (dusk ? (Hh > 1.2 && Hh < 1.8 && (x & 3) === 0 ? '#a87840' : '#1c1a24') : B.mix(wall, '#2a2a38', 0.6)) : frontage(xm, Hh, wall, dusk);
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
        if (skyMask && sky) skyMask.fillRect(x, y, 1, 1);
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
      // reflections hold through twilight (the bright sky outshines a dark shop); after dark an unlit shop's glass
      // still mirrors the lit shops and headlamps across the road
      const nightRefl = B.oppositeStreet && F.streetLife ? clamp((-P.e - 4) / 6, 0, 1) * (s.shop.lights ? 0.25 : 0.9) : 0;
      const reflAmt = Math.max(clamp((P.e + 7) / 9, 0, 1), nightRefl);
      // morning, sun behind the building: the shop's side wall in the alley faces SSE (52 deg off the sun) and catches
      // it above the shadow of the house across the 1.5 m alley
      const cosD = Math.cos(rad((P.az != null ? P.az : 247.5 - P.phi) - 157.5));
      if (cosD > 0.05 && P.e > 2 && S > 0.02) {
        const k = clamp((P.e - 2) / 4, 0, 1) * clamp(cosD / 0.3, 0, 1) * cloudAt(s, 290) * S;
        const K = B.renderKit;
        if (K && K.AL && K.wallL) {
          const litPx = Math.min(7, (1.5 * Math.tan(rad(P.e))) / cosD) * PX_PER_M;
          const y1 = Math.min(K.AL.bot, Math.round(K.AL.top + litPx));
          g.globalCompositeOperation = 'soft-light';
          g.globalAlpha = 0.6 * k;
          g.fillStyle = sun.col;
          for (let y = K.AL.top; y < y1; y++) {
            const xr = Math.round(K.wallL(y));
            if (xr > K.AL.l) g.fillRect(K.AL.l, y, xr - K.AL.l, 1);
          }
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
        }
      }
      // the glass by day: reflection outshines the interior (single glazing reflects ~8% of a bright street)
      if (F.glassReflection && reflAmt > 0.02) {
        const key = `${Math.round(s.hour * 30)}|${B.theme}|${P.morning}`;
        if (reflCache.key !== key) {
          if (!reflCache.c) reflCache.c = canvas()[0];
          const rgx = reflCache.c.getContext('2d');
          rgx.clearRect(0, 0, W, H);
          if (!reflCache.m) reflCache.m = canvas()[0];
          const mgx = reflCache.m.getContext('2d');
          mgx.clearRect(0, 0, W, H);
          mgx.fillStyle = '#000';
          const Dg0 = B.LAYOUT.doorGlass;
          const street = B.oppositeStreet && F.streetLife && B.oppositeStreet.paintFacade(rgx, s, [Wn, Dg0, ...B.LAYOUT.upstairs]);
          rgx.skyOnly = !!street;
          paintReflection(rgx, s, sun, Wn.y, Wn.h, mgx);
          for (const u of B.LAYOUT.upstairs) paintReflection(rgx, s, sun, u.y, u.h, mgx);
          const Dg = B.LAYOUT.doorGlass;
          paintReflection(rgx, s, sun, Dg.y, Dg.h, mgx);
          reflCache.key = key;
        }
        rg2.globalCompositeOperation = 'source-over';
        rg2.clearRect(0, 0, W, H);
        rg2.drawImage(reflCache.c, 0, 0);
        if (B.oppositeStreet) B.oppositeStreet.paintLife(rg2, s); // people across the road, and the traffic
        // only on glass, and never over the people standing in front of it
        rg2.globalCompositeOperation = 'destination-in';
        rg2.fillStyle = '#000';
        rg2.beginPath();
        rg2.rect(Wn.x, Wn.y, Wn.w, Wn.h);
        { const Dg = B.LAYOUT.doorGlass; rg2.rect(Dg.x, Dg.y, Dg.w, Dg.h); }
        for (const u of B.LAYOUT.upstairs) rg2.rect(u.x, u.y, u.w, u.h);
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
        const streetOn = B.oppositeStreet && F.streetLife;
        g.globalAlpha = (streetOn ? 1 : 0.4 * dayAmt * (s.shop.lights ? 0.8 : 1));
        g.fillStyle = streetOn ? B.mix('#ffffff', '#ebebeb', dayAmt) : '#8a90a8'; // glass transmits ~92%
        g.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
        g.restore();
        // ...behind the street's reflection
        g.globalCompositeOperation = 'screen';
        const lampFade = 1 - 0.6 * clamp((-P.e - 2) / 4, 0, 1);
        const lamp = s.upstairs && s.upstairs.light ? lampFade : 1;
        // at dusk the burning western sky (~500 cd/m2) mirrors at 8%: it outshines a lamp-lit room above the black
        // roofline, while below it the room shows through
        const duskK = !P.morning ? clamp((3 - P.e) / 3, 0, 1) * clamp((P.e + 8) / 2, 0, 1) : 0;
        const streetK = B.oppositeStreet && F.streetLife ? 1 : 0;
        // after dark a lit shop opposite (~100 cd/m2, 8% in the glass) outshines an unlit interior several times over
        const dayK = streetK ? (!P.morning && P.e < 8 ? 0.35 : 0.45) : 0.3;
        const base = Math.max(dayK * reflAmt * (s.shop.lights && dayAmt < 0.5 ? 0.5 : 1), 0.85 * nightRefl) * lamp;
        // where the glass mirrors sky (~8% of 500-5000 cd/m2) it outshines the room behind: dim the room, screen the sky
        const skyMul = Math.max(0.6 * dayAmt, duskK);
        const skyA = Math.max(base, 0.55 * dayAmt, 0.65 * duskK) * lamp;
        if (reflCache.m) {
          if (skyMul > 0.02) {
            tg.globalCompositeOperation = 'source-over';
            tg.clearRect(0, 0, W, H);
            tg.drawImage(reflCache.m, 0, 0);
            tg.globalCompositeOperation = 'destination-in';
            tg.drawImage(rc2, 0, 0);
            tg.globalCompositeOperation = 'source-in';
            tg.fillStyle = B.mix('#8a90a8', '#808080', duskK);
            tg.fillRect(0, 0, W, H);
            tg.globalCompositeOperation = 'source-over';
            g.globalCompositeOperation = 'multiply';
            g.globalAlpha = skyMul * lamp;
            g.drawImage(tc, 0, 0);
          }
          g.globalCompositeOperation = 'screen';
          for (const skyPart of [false, true]) {
            tg.globalCompositeOperation = 'source-over';
            tg.clearRect(0, 0, W, H);
            tg.drawImage(rc2, 0, 0);
            tg.globalCompositeOperation = skyPart ? 'destination-in' : 'destination-out';
            tg.drawImage(reflCache.m, 0, 0);
            if (!skyPart && streetOn && dk) {
              // a reflection adds light: it shows in the room's darks and vanishes against its bright surfaces
              dkg.globalCompositeOperation = 'source-over';
              dkg.fillStyle = '#808080';
              dkg.fillRect(0, 0, W, H);
              dkg.globalCompositeOperation = 'luminosity';
              dkg.drawImage(g.canvas, 0, 0);
              dkg.globalCompositeOperation = 'difference';
              dkg.fillStyle = '#ffffff';
              dkg.fillRect(0, 0, W, H);
              dkg.globalCompositeOperation = 'source-over';
              tg.globalCompositeOperation = 'multiply';
              tg.drawImage(dk, 0, 0);
              tg.globalCompositeOperation = 'destination-in';
              tg.drawImage(rc2, 0, 0);
            }
            tg.globalCompositeOperation = 'source-over';
            g.globalAlpha = clamp(skyPart ? skyA : base, 0, 1);
            g.drawImage(tc, 0, 0);
          }
        } else {
          g.globalAlpha = base;
          g.drawImage(rc2, 0, 0);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      if (S < 0.02 || sun.behind || sun.facing <= 0.05) return;
      // people: cooler in the shade of the buildings opposite, warmer in the sun, with a shaded side away from it
      for (const a of people) {
        const shadeK = F.buildingShadow ? clamp((a.y - 38 - buildingLine(sun, a.x)) / 6 + 0.5, 0, 1) : 0;
        const shaded = shadeK > 0.5;
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, W, H);
        B.drawSilhouette(tg, a, a.x, a.y, 1, 1);
        tg.globalCompositeOperation = 'source-in';
        tg.fillStyle = shaded ? (cyber() ? '#6a5aa0' : '#7484bc') : sun.col;
        tg.fillRect(0, 0, W, H);
        tg.globalCompositeOperation = 'source-over';
        g.globalCompositeOperation = shaded ? 'multiply' : 'soft-light';
        g.globalAlpha = (shaded ? 0.35 * shadeK : 0.4 * (1 - shadeK)) * S * cloudAt(s, a.x);
        g.drawImage(tc, 0, 0);
        if (!shaded && Math.abs(sun.phi) > 25 && cloudAt(s, a.x) > 0.6) {
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
      if (sun.e < 32) {
        const gold = clamp(1 - (sun.e - 10) / 22, 0.3, 1);
        for (const ev of B.trafficEvents || []) {
          if (ev.kind === 'turn' || ev.kind === 'bike') continue;
          const k = ev.t / ev.dur;
          const x = (ev.dir > 0 ? -70 + k * 460 : 390 - k * 460) - (ev.dir > 0 ? 55 : 85) * sun.tanP;
          const dCar = (ev.dir > 0 ? 55 : 85) / PX_PER_M; // metres from our wall
          const xs = x + sun.tanP * (22 - dCar) * PX_PER_M;
          if (skyAt(xs) - ((22 - dCar) / sun.cosP) * sun.tanE > 1.2) continue; // the car's in the opposite buildings' shadow
          const wob = Math.sin(ev.t * 9 + ev.seed * 6);
          if (wob < 0.2) continue; // the glass only catches the sun at the right angle, in flickers
          // reflect the sun off a windscreen raked 30 deg back (its normal leans the way the car is going)
          const ce = Math.cos(rad(sun.e));
          const d = [-Math.sin(rad(sun.phi)) * ce, Math.cos(rad(sun.phi)) * ce, -Math.sin(rad(sun.e))];
          const n = [0.5 * ev.dir, 0, 0.866];
          const dn = d[0] * n[0] + d[2] * n[2];
          const r = [d[0] - 2 * dn * n[0], d[1], d[2] - 2 * dn * n[2]];
          if (r[1] <= 0.05) continue;
          const xCar = ev.dir > 0 ? -70 + k * 460 : 390 - k * 460;
          const z = 1.2 + (r[2] / r[1]) * dCar; // metres up our wall
          if (z < 0.05) continue; // it lands on the pavement
          let fx = xCar + (r[0] / r[1]) * dCar * PX_PER_M;
          let fy = 164 - z * PX_PER_M;
          const amp = S * gold * wob * cloudAt(s, fx);
          const inWin = fx > Wn.x && fx < Wn.x + Wn.w && fy > Wn.y && fy < Wn.y + Wn.h;
          g.globalCompositeOperation = 'lighter';
          if (inWin) {
            // through the glass, on into the shop: a glint sliding across the shelves (~4x the room light)
            fx += (r[0] / r[1]) * 40;
            fy -= (r[2] / r[1]) * 40;
            g.fillStyle = sun.col;
            g.globalAlpha = 0.45 * amp;
            g.fillRect(Math.round(clamp(fx, Wn.x + 1, Wn.x + Wn.w - 6)), Math.round(clamp(fy, Wn.y + 1, Wn.y + Wn.h - 3)), 5, 2);
          } else {
            // on the front, a 5% glint only reads against shade: clip to the shadow mask
            tg.globalCompositeOperation = 'source-over';
            tg.clearRect(0, 0, W, H);
            tg.fillStyle = sun.col;
            tg.fillRect(Math.round(fx), Math.round(fy), ev.kind === 'bus' ? 10 : 6, 3);
            tg.globalCompositeOperation = 'destination-in';
            tg.drawImage(mc, 0, 0);
            tg.globalCompositeOperation = 'source-over';
            g.globalAlpha = 0.4 * amp;
            g.drawImage(tc, 0, 0);
          }
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
        }
      }
      if (!F.sunInterior || !kit || !kit.project) return;
      // sun through the glass: a directional source (very far away), its patch landing lower the higher the sun is
      const strips = [];
      for (let x = Wn.x; x < Wn.x + Wn.w; x += 6) {
        const w = Math.min(6, Wn.x + Wn.w - x);
        const line = F.buildingShadow ? buildingLine(sun, x + w / 2) : H;
        const h = Math.max(0, Math.min(Wn.h, Math.round(line) - Wn.y));
        if (h > 0) strips.push({ x, y: Wn.y, w, h });
      }
      if (!strips.length) return;
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
        colGain: B.mix(sun.col, '#ffe8cc', 0.55),
        gain: Math.min(1.2, 1.8 * Math.min(0.85, 0.7 * S * sun.facing * cloudAt(s, 110))), // albedo x E: snap x (1 + gain)
        motes: true,
      };
      const room = Object.assign({}, kit.SHOP, { aperture: () => strips });
      kit.project(qg, s, src, room, ag);
      const flat = Object.assign({}, kit.FLAT, {
        aperture: (s2) =>
          kit.FLAT.aperture(s2).flatMap((u) => {
            // traced per 4 px column, so the bar lights just the strip of pane it crosses
            const out = [];
            for (let x = u.x; x < u.x + u.w; x += 4) {
              const w = Math.min(4, u.x + u.w - x);
              const line = F.buildingShadow ? buildingLine(sun, x + w / 2) : H;
              const h = clamp(Math.round(line) - u.y, 0, u.h);
              if (h > 0) out.push({ x, y: u.y, w, h });
            }
            return out;
          }),
      });
      kit.project(qg, s, Object.assign({}, src, { a: src.a * (s.upstairs.light ? 0.5 : 1) }), flat, ag);
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

  if (B.catBehaviour) {
    /** Where the sun falls on the window sill (the cat's favourite spot), or null. */
    const sunnySill = (s) => {
      const sun = B.sun(s);
      if (!F.sun || sun.strength < 0.3 || sun.behind || sun.facing < 0.2 || sun.e > 34) return null;
      if (F.buildingShadow && buildingLine(sun, 130) < 140) return null; // the buildings opposite have it in shade
      if (cloudAt(s, 130) < 0.8) return null;
      return clamp(130 - 40 * sun.tanP, 76, 184); // sun from the right lands further left
    };
    B.catBehaviour({
      id: 'sunbathe',
      weight: (s) => (sunnySill(s) != null ? 9 : 0),
      *run(s, cat) {
        let x = sunnySill(s);
        if (x == null) return;
        yield* cat.goTo('sill', x);
        cat.pose = 'sit';
        yield cat.hold('stretch', 1.5);
        cat.pose = 'loaf';
        yield 2;
        cat.pose = 'sleep';
        // dozing in the warmth, shuffling along to stay in it as the patch creeps across the sill
        for (let t = 0; t < 120; t += 4) {
          yield 4;
          const nx = sunnySill(s);
          if (nx == null) break;
          if (Math.abs(nx - cat.x) > 6) {
            yield* cat.goTo('sill', nx);
            cat.pose = 'loaf';
            yield 1;
            cat.pose = 'sleep';
          }
        }
        cat.pose = 'sit';
        yield cat.hold('groom', 2);
      },
    });
  }
})(window.Bookshop);
