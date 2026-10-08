// The lighting reel: deterministic frames of the off-screen light sources (turning cars, traffic, steady lights,
// weather, emergency flashes, the cat's shadow), rendered into labelled contact sheets. Used to review the lighting,
// and as a golden-image regression check. See README.md.
//   const reel = await import('http://127.0.0.1:8124/reel.js?' + Date.now());
//   await reel.run('review')            // render sheets into tools/lighting-reel/out/
//   await reel.run('golden', 'bless')   // accept the current look as the golden reference
//   await reel.run('check', 'check')    // render and compare with the golden sheets: returns a report
const B = window.Bookshop;
const SINK = 'http://127.0.0.1:8124/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function save(name, canvas, dir = 'out') {
  await fetch(SINK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, data: canvas.toDataURL('image/png'), dir }) });
}
/** Compare a sheet with its golden reference: the share of pixels that differ noticeably. */
async function compare(name, canvas) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const ok = await new Promise((r) => {
    img.onload = () => r(true);
    img.onerror = () => r(false);
    img.src = `${SINK}golden/${name}.png?${Date.now()}`;
  });
  if (!ok) return { name, missing: true };
  if (img.width !== canvas.width || img.height !== canvas.height) return { name, sizeChanged: true };
  const gc = document.createElement('canvas');
  gc.width = img.width;
  gc.height = img.height;
  const gg = gc.getContext('2d');
  gg.drawImage(img, 0, 0);
  const a = gg.getImageData(0, 0, gc.width, gc.height).data;
  const b = canvas.getContext('2d').getImageData(0, 0, gc.width, gc.height).data;
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) diff++;
  const pct = (100 * diff) / (a.length / 4);
  return { name, changedPct: Math.round(pct * 100) / 100, pass: pct < 0.5 };
}
function sheet(cols, rows, w, h, scale, pad = 14) {
  const c = document.createElement('canvas');
  c.width = cols * (w * scale + 6) + 6;
  c.height = rows * (h * scale + pad + 6) + 6;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  return {
    c,
    put(i, src, sx, sy, label) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 6 + col * (w * scale + 6);
      const y = 6 + row * (h * scale + pad + 6);
      g.fillStyle = '#ddd';
      g.font = '12px monospace';
      g.fillText(label, x, y + 11);
      g.drawImage(src, sx, sy, w, h, x, y + pad, w * scale, h * scale);
    },
  };
}

export async function run(tag = 'review', mode = 'out') {
  // deterministic: seeded randomness and a frozen clock (neon cycles, flicker, passers-by all repeat exactly)
  const rnd0 = Math.random;
  const now0 = performance.now.bind(performance);
  let seed = 1234567;
  Math.random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => 1000000;
  const report = [];
  const emit = async (name, canvas) => {
    if (mode === 'check') report.push(await compare(name, canvas));
    await save(mode === 'bless' ? name : `${tag}-${name}`, canvas, mode === 'bless' ? 'golden' : 'out');
  };
  // its own freshly built world, so nothing from the live game (people, litter, the cat's wanderings) leaks in
  const live = B.world;
  B.holdFrame = true;
  try {
    const fresh = B.createWorld();
    fresh.mode = 'story';
    B.settle(fresh);
    B.emit('ready', fresh);
    fresh.litter = [];
    fresh.npcs.length = 0;
    B.world = fresh;
    return await shoot(tag, emit, report);
  } finally {
    B.world = live;
    B.holdFrame = false;
    Math.random = rnd0;
    performance.now = now0;
  }
}

async function shoot(tag, emit, report) {
  const s = B.world;
  const scr = document.querySelector('#screen');
  const g = scr.getContext('2d');
  const theme0 = B.theme;
  document.querySelector('#today .close')?.click();
  // snapshot the scene now, with traffic frozen at a given moment
  B._lightAdaptInstant = true;
  const frame = () => {
    s.paused = false;
    B.render(g, s); // twice: the first settles the exposure for this moment
    B.render(g, s);
    s.paused = true;
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    c.getContext('2d').drawImage(scr, 0, 0);
    return c;
  };
  const setTraffic = (list) => {
    B.trafficEvents.length = 0;
    for (const e of list) B.trafficEvents.push(Object.assign({ t: 0, dur: 4, dir: 1, jx: 140, seed: 0.9, led: false }, e));
  };
  async function scene(theme, hour, opts = {}) {
    B.setTheme(theme);
    s.paused = false;
    B.jumpTo(s, hour);
    B.setWeatherKind(s, opts.weather || 'clear');
    s.weather.rain = opts.weather === 'rain' ? 1 : 0;
    s.weather.fog = opts.weather === 'fog' ? 1 : 0;
    s.weather.cloud = 0.2;
    await sleep(300);
    // three passers-by standing at fixed spots on the pavement
    s.npcs.filter((n) => n.area === 'street').forEach((n) => (n.hidden = true));
    if (opts.people !== false) {
      for (const [x, lane, dir] of [[60, 2, 1], [150, 0, -1], [235, 3, 1]]) {
        const n = B.spawn(s, 'passer');
        if (!n) continue;
        Object.assign(n, { x, lane, dir, moving: false, pose: 'stand', hidden: false, alpha: 1, area: 'street' });
        n.script = null;
        n.scripts = [];
      }
    }
    if (opts.mabelInside) {
      const o = s.owner;
      Object.assign(o, { area: 'inside', depth: 'back', x: 172, hidden: false, pose: 'stand', moving: false, dir: -1 });
      s.shop.lights = false;
      s.upstairs.light = false;
    }
    s.paused = true;
    await sleep(50);
  }

  // A: the turning car's sweep, both themes
  for (const theme of ['classic', 'cyber']) {
    await scene(theme, 21.8, { mabelInside: true });
    const sh = sheet(2, 2, 320, 180, 2);
    [0.15, 0.4, 0.6, 0.9].forEach((k, i) => {
      setTraffic([{ kind: 'turn', dir: 1, jx: 140, dur: 4.65, t: 4.65 * k, main: false }]);
      sh.put(i, frame(), 0, 0, `${theme} 21:48 DIPPED turning car k=${k}`);
    });
    await emit(`A-sweep-${theme}`, sh.c);
    // D: interior close-ups of the same sweep
    const sd = sheet(2, 2, 210, 76, 3);
    [0.3, 0.45, 0.6, 0.7].forEach((k, i) => {
      setTraffic([{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 4.65 * k, main: true }]);
      sd.put(i, frame(), 5, 74, `${theme} close-up, MAIN beam turn k=${k}`);
    });
    await emit(`D-interior-${theme}`, sd.c);
  }
  // B: passing car, bus, bike, emergency (classic) and the same in neon
  for (const theme of ['classic', 'cyber']) {
    await scene(theme, 22.3, { mabelInside: true });
    const sh = sheet(2, 2, 320, 180, 2);
    const cases = [
      ['passing car', { kind: 'car', dur: 2.8, t: 1.0, seed: 0.1 }],
      ['bus', { kind: 'bus', dur: 4.2, t: 1.9, dir: -1 }],
      ['bike', { kind: 'bike', dur: 4, t: 1.6 }],
      ['emergency', { kind: 'emergency', dur: 5, t: 2.04 }],
    ];
    cases.forEach(([label, e], i) => {
      setTraffic([e]);
      sh.put(i, frame(), 0, 0, `${theme} 22:18 ${label}`);
    });
    await emit(`B-traffic-${theme}`, sh.c);
  }
  // C: steady lights only, rain and fog variants, upstairs, daytime
  {
    const sh = sheet(2, 3, 320, 180, 2);
    let i = 0;
    for (const [theme, hour, weather, label] of [
      ['classic', 22, 'clear', 'steady lights only (pub, chippy, lamp)'],
      ['cyber', 22, 'clear', 'steady lights only (sign, ramen, pylon)'],
      ['classic', 22, 'rain', 'rain + turning car'],
      ['cyber', 22, 'fog', 'fog + turning car'],
      ['classic', 13, 'clear', 'daytime passing car (glint, shadow)'],
      ['cyber', 20.6, 'clear', 'dusk, upstairs lit, turning car'],
    ]) {
      await scene(theme, hour, { weather, mabelInside: hour > 21 });
      if (/turning/.test(label)) setTraffic([{ kind: 'turn', dir: -1, jx: 230, dur: 4.65, t: 2.0 }]);
      else if (/daytime/.test(label)) setTraffic([{ kind: 'car', dur: 2.8, t: 1.3, seed: 0.1 }]);
      else setTraffic([]);
      sh.put(i++, frame(), 0, 0, `${theme} ${label}`);
    }
    await emit(`C-steady-weather-day`, sh.c);
  }
  // E: motion filmstrips: a main-beam turn (12 frames) and an emergency vehicle's flash rhythm (8 frames, 60 ms apart)
  {
    await scene('classic', 21.8, { mabelInside: true });
    const sh = sheet(3, 4, 280, 110, 2);
    for (let i = 0; i < 12; i++) {
      const k = 0.12 + (i * 0.85) / 11;
      setTraffic([{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 4.65 * k, main: true }]);
      sh.put(i, frame(), 0, 70, `turn (main beam) frame ${i + 1}/12  t=${(4.65 * k).toFixed(2)}s`);
    }
    await emit(`E-filmstrip-turn`, sh.c);
    const se = sheet(4, 2, 320, 180, 1);
    for (let i = 0; i < 8; i++) {
      setTraffic([{ kind: 'emergency', dur: 5, t: 2.0 + i * 0.06 }]);
      se.put(i, frame(), 0, 0, `emergency t=${(2.0 + i * 0.06).toFixed(2)}s`);
    }
    await emit(`E-filmstrip-emergency`, se.c);
  }
  // F: the hero shot: the cat in the window throwing its silhouette across the shelves under a main beam
  {
    await scene('classic', 21.8, { mabelInside: true, people: false });
    const sh = sheet(2, 2, 210, 76, 3);
    [[30, 0.3], [30, 0.4], [50, 0.45], [50, 0.55]].forEach(([cx, k], i) => {
      if (s.cat) Object.assign(s.cat, { surface: 'sill', x: cx, pose: 'sit', dir: 1 });
      setTraffic([{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 4.65 * k, main: true }]);
      sh.put(i, frame(), 5, 74, `cat on the sill x=${cx}, main-beam turn k=${k}`);
    });
    await emit('F-cat-hero', sh.c);
  }
  // G: the sun through the day, both themes
  for (const theme of ['classic', 'cyber']) {
    const sh = sheet(3, 2, 320, 180, 2);
    let i = 0;
    const sunHours = [B.sunTime(14, false), B.sunPos(12).noon, B.sunTime(25, true), B.sunTime(12, true), B.sunTime(4, true), B.sunTime(-2.5, true)];
    for (const hr of sunHours) {
      await scene(theme, hr, {});
      s.weather.cloud = 0.15;
      setTraffic([{ kind: 'car', dur: 2.8, t: 1.2, dir: 1 }]);
      const sun = B.sun ? B.sun(s) : { e: 0, phi: 0 };
      sh.put(i++, frame(), 0, 0, `${theme} ${Math.floor(hr)}:${String(Math.round((hr % 1) * 60)).padStart(2, '0')} sun e=${sun.e.toFixed(0)} phi=${sun.phi.toFixed(0)}`);
    }
    await emit(`G-day-${theme}`, sh.c);
  }
  // H: early evening: golden hour with traffic, dusk turn, a cloudy afternoon's drifting shadows
  {
    const sh = sheet(2, 2, 320, 180, 2);
    await scene('classic', B.sunTime(5, true), {});
    setTraffic([{ kind: 'bus', dur: 4.2, t: 1.6, dir: 1 }]);
    sh.put(0, frame(), 0, 0, 'classic golden hour (sun 5 deg), a bus passing');
    await scene('classic', B.sunTime(-5, true), { mabelInside: true });
    setTraffic([{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 2.0, main: true }]);
    sh.put(1, frame(), 0, 0, 'classic blue hour (sun -5 deg), main-beam turn');
    await scene('cyber', B.sunTime(-2, true), {});
    setTraffic([{ kind: 'car', dur: 2.8, t: 1.0, dir: -1 }]);
    sh.put(2, frame(), 0, 0, 'cyber sunset glow (sun -2 deg), car passing');
    await scene('classic', B.sunTime(22, true), {});
    s.weather.cloud = 0.62;
    setTraffic([]);
    sh.put(3, frame(), 0, 0, 'classic afternoon, broken cloud: a cloud shadow sweeping across');
    await emit('H-evening', sh.c);
  }
  // J: seasons and the reviewers' checks: Dec noon, Jun 20:00, windscreen flashes at 25 vs 10 deg, afterglow, sunrise vista
  {
    const sh = sheet(3, 3, 320, 180, 2);
    const today0 = B.today;
    const shots = [
      ['2026-12-21', () => B.sunPos(12).noon, 'Dec 21 noon', []],
      ['2026-06-21', () => 20, 'Jun 21 20:00', []],
      [null, () => B.sunTime(25, true), 'sun 25 deg, car (flashes?)', [{ kind: 'car', dur: 2.8, t: 1.2, dir: 1 }]],
      [null, () => B.sunTime(10, true), 'sun 10 deg, car (no flashes)', [{ kind: 'car', dur: 2.8, t: 1.2, dir: 1 }]],
      [null, () => B.sunTime(-2, true), 'sun -2 deg: afterglow in the panes, Belt of Venus', []],
      [null, () => B.sunTime(4, false), 'sunrise, sun 4 deg: backlit, alley glow', []],
      [null, () => B.sunTime(6, true), 'sun 6 deg: a walker standing in the gold blade', [], 'walker'],
      [null, () => B.sunPos(12).noon, 'cyber noon: white flat smog', [], 'cyber'],
      [null, () => B.sunTime(15, true), 'cyber late afternoon: amber smog low', [], 'cyber'],
    ];
    let i = 0;
    for (const [date, hr, label, traffic, opt] of shots) {
      if (date) B.today = date;
      await scene(opt === 'cyber' ? 'cyber' : 'classic', hr(), {});
      s.weather.cloud = 0.15;
      setTraffic(traffic);
      if (opt === 'walker') {
        const sun = B.sun(s);
        const bx = 130 - sun.tanP * 22 * 23; // the side-street gap, seen along the sun's slant
        const p = s.npcs.find((n) => n.area === 'street' && !n.hidden);
        if (p) Object.assign(p, { x: Math.round(Math.max(20, Math.min(260, bx))) });
      }
      sh.put(i++, frame(), 0, 0, `${opt === 'cyber' ? 'cyber' : 'classic'} ${label}`);
      B.today = today0;
    }
    await emit('J-seasons-checks', sh.c);
  }
  // K: the street behind you, in the glass: shops opposite, walkers, traffic; by day, at dusk and at night
  if (B.oppositeStreet) {
    const sh = sheet(3, 2, 320, 180, 2);
    const W0 = B.oppositeStreet.walkers;
    const put = (xs) => {
      W0.length = 0;
      xs.forEach((x, i) => W0.push({ x, dir: i % 2 ? -1 : 1, v: 0, top: ['#6a2a2a', '#3a4a6a', '#c8a040', '#4a6a4a'][i % 4], bottom: '#2a2a34', skin: '#e8c4a0', hair: '#2a1a10', tall: 1, dog: i === 2, brolly: '#a02030', ph: i }));
    };
    const shots = [
      [() => B.sunPos(12).noon - 1, 'morning-ish: shops opposite, a bus passing', [{ kind: 'bus', dur: 4.2, t: 2.1, dir: 1 }], [20, 90, 170, 260]],
      [() => B.sunPos(12).noon + 2, 'afternoon: a car passing, walkers', [{ kind: 'car', dur: 2.8, t: 1.4, dir: -1 }], [0, 60, 140, 230]],
      [() => B.sunTime(2, true), 'golden hour: walkers opposite', [], [40, 120, 200, 300]],
      [() => B.sunTime(-3, true), 'dusk: shops lighting up, car', [{ kind: 'car', dur: 2.8, t: 1.0, dir: 1 }], [70, 150, 230]],
      [() => 21.5, 'night, shop dark: the pub and chippy in the glass, car', [{ kind: 'car', dur: 2.8, t: 1.5, dir: -1 }], [60, 210]],
      [() => 22.3, 'night rain: brollies and a bus', [{ kind: 'bus', dur: 4.2, t: 2.0, dir: -1 }], [30, 120, 220]],
    ];
    let i = 0;
    for (const [hr, label, traffic, xs] of shots) {
      await scene('classic', hr(), { mabelInside: false });
      if (i === 5) B.setWeatherKind(s, 'rain');
      s.weather.cloud = 0.15;
      if (i >= 4) s.shop.lights = false;
      setTraffic(traffic);
      put(xs);
      sh.put(i++, frame(), 0, 0, `classic ${label}`);
    }
    B.setWeatherKind(s, null);
    W0.length = 0;
    await emit('K-reflected-street', sh.c);
  }
  // L: the street crew and the sky in the flat's windows
  if (B.crew) {
    const sh = sheet(3, 3, 320, 180, 2);
    const C = B.crew;
    const FL = B.oppositeStreet ? B.oppositeStreet.flyers : [];
    const reset = () => {
      C.drone = null;
      C.picker = null;
      C.lampOff = false;
      C.lampFault = false;
      C.dirt.fill(0.6);
      C.wet.fill(0);
      C.dirtUp.forEach((d) => d.fill(0.5));
      C.wetUp.forEach((d) => d.fill(0));
      FL.length = 0;
    };
    let i = 0;
    // 1: the window cleaner halfway along, clean and wet behind him, grubby ahead
    reset();
    await scene('classic', 9.6, { people: false });
    {
      const n = B.spawn(s, 'window-cleaner', { fromLeft: true });
      if (n) {
        n.script = null;
        Object.assign(n, { x: 96, moving: false, pose: 'backstand', hidden: false, alpha: 1, area: 'street', lane: -3 });
        n.cleaner = { state: 'squeegee', gx: 122, gy: 100, bucket: 86 };
      }
      for (let k = 0; k < 26; k++) C.dirt[k] = 0;
      for (let k = 18; k < 26; k++) C.wet[k] = 1 - (25 - k) / 8;
    }
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'classic 9:36 window cleaner: clean & wet behind, grubby ahead');
    // 2: the drone brushing the left pane at noon (shadow on the brick)
    reset();
    await scene('classic', B.sunPos(12).noon + 2, {});
    C.drone = { x: 62, y: 30, state: 'brush', pane: 0, t: 1.5, hum: 1, passes: 0 };
    for (let k = 0; k < 5; k++) C.dirtUp[0][k] = 0;
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'classic afternoon: cleaning drone on the flat window');
    // 3: the cherry-picker crew at work
    reset();
    await scene('classic', 11.5, {});
    C.picker = { state: 'work', x: 296, boom: 1, t: 5, cones: 2, spark: 0.1 };
    C.lampOff = true;
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'classic 11:30 lamp crew in the cherry-picker');
    // 4: the same at dusk, the amber beacon on the front
    await scene('classic', B.sunTime(-3, true), {});
    C.picker = { state: 'work', x: 296, boom: 1, t: 5, cones: 2, spark: 0 };
    C.lampOff = true;
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'classic dusk: beacon turning, lamp dark while they work');
    // 5: neon noon: flying traffic in the flat's windows, the air-con running
    reset();
    await scene('cyber', B.sunPos(12).noon, {});
    for (const [gx, gy, m, dir] of [[60, 24, 0.19, 1], [78, 31, 0.123, -1], [170, 37, 0.08, 1], [182, 25, 0.19, -1]]) FL.push({ kind: 'car', gx, gy, m, dir, v: 0, t: 0, seed: gx / 200 });
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'cyber noon: sky traffic reflected upstairs, air-con running');
    // 6: neon night, Mabel watching the telly: the reflection kept quiet over the screen
    await scene('cyber', 21.2, {});
    s.upstairs.light = true;
    s.upstairs.tv = true;
    Object.assign(s.owner, { area: 'upstairs', x: B.LAYOUT.upstairsSpots.chair, pose: 'sit', hidden: false, moving: false });
    for (const [gx, gy, m, dir] of [[52, 26, 0.19, 1], [74, 33, 0.123, -1], [176, 30, 0.19, 1]]) FL.push({ kind: 'car', gx, gy, m, dir, v: 0, t: 0, seed: gx / 200 });
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'cyber night: telly on, sky reflection kept down');
    s.upstairs.tv = false;
    // 7: classic dusk: an airliner's contrail lit gold-red above the earth's shadow, gulls, in the flat's windows
    reset();
    await scene('classic', B.sunTime(-1.5, true), {});
    FL.push({ kind: 'plane', gx: 70, gy: 24, m: 0.00044, dir: 1, v: 0, t: 0, seed: 0.3 });
    FL.push({ kind: 'gull', gx: 172, gy: 30, m: 0.17, dir: -1, v: 0, t: 0, seed: 0.1 });
    FL.push({ kind: 'gull', gx: 182, gy: 27, m: 0.15, dir: -1, v: 0, t: 0, seed: 0.6 });
    setTraffic([]);
    sh.put(i++, frame(), 0, 0, 'classic sunset -1.5: contrail and gulls in the flat windows');
    // 8, 9: the shop's lamps after dark: all on with Mabel at the back; then only the desk lamp
    if (B.shopLamps) {
      await scene('classic', 19.6, { mabelInside: true, people: false });
      B.shopLamps.pendantL = B.shopLamps.pendantR = true;
      s.shop.lights = true;
      B.shopLamps.lastMain = true;
      s.lamp = true;
      setTraffic([]);
      sh.put(i++, frame(), 0, 0, 'classic 19:36 shop lamps on: pools, scallops, Mabel\'s shadow');
      B.shopLamps.pendantL = B.shopLamps.pendantR = false;
      s.shop.lights = false;
      B.shopLamps.lastMain = false;
      sh.put(i++, frame(), 0, 0, 'classic 19:36 only the desk lamp: the counter pool');
      s.lamp = false;
    }
    reset();
    await emit('L-crew-sky', sh.c);
  }
  // I: what single approaches bring (split screens: left ON, right OFF)
  if (B.lightFlags) {
    const sh = sheet(2, 2, 320, 180, 2);
    const split = (key, label, i) => {
      const was = B.lightFlags[key];
      B.lightFlags[key] = true;
      const a = frame();
      B.lightFlags[key] = false;
      const b = frame();
      B.lightFlags[key] = was;
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 180;
      const cg = c.getContext('2d');
      cg.drawImage(a, 0, 0, 160, 180, 0, 0, 160, 180);
      cg.drawImage(b, 160, 0, 160, 180, 160, 0, 160, 180);
      cg.fillStyle = '#fff';
      cg.fillRect(160, 0, 1, 180);
      sh.put(i, c, 0, 0, `${label}: left ON | right OFF`);
    };
    await scene('classic', B.sunTime(22, true), {});
    split('sun', 'afternoon: sunlight', 0);
    await scene('classic', B.sunTime(5, true), {});
    split('buildingShadow', 'golden hour: opposite buildings', 1);
    await scene('classic', B.sunTime(12, true), { mabelInside: false });
    setTraffic([]);
    split('sunInterior', 'late afternoon: sun through the glass', 2);
    await scene('classic', B.sunPos(12).noon, { mabelInside: false });
    setTraffic([]);
    split('glassReflection', 'noon: the glass reflects the street', 3);
    await emit('I-approaches', sh.c);
  }
  setTraffic([]);
  B.setWeatherKind(s, null);
  B.setTheme(theme0);
  s.paused = false;
  B._lightAdaptInstant = false;
  return report.length ? report : 'saved';
}

// ---------- Mabel's dances: filmstrips for the dance and animation reviewers ----------
//   await reel.dance('d1')   -> out/d1-M-dance-<theme>.png
export async function dance(tag = 'dance', themes = ['classic']) {
  const now0 = performance.now.bind(performance);
  const live = B.world;
  B.holdFrame = true;
  const theme0 = B.theme;
  try {
    const fresh = B.createWorld();
    fresh.mode = 'story';
    B.settle(fresh);
    B.emit('ready', fresh);
    fresh.litter = [];
    fresh.npcs.length = 0;
    B.world = fresh;
    const s = fresh;
    const o = s.owner;
    const g = document.querySelector('#screen').getContext('2d');
    const frameC = () => {
      B.render(g, s);
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 180;
      c.getContext('2d').drawImage(g.canvas, 0, 0);
      return c;
    };
    // each routine: [label, x, steps: [pose, dir, backView, t] x8]
    const at = (pose, dir, x, ts, back = () => false, dirs = null) => ts.map((t, i) => [pose, dirs ? dirs[i] : dir, back(i), t, x]);
    const T8 = [0, 0.12, 0.25, 0.37, 0.5, 0.62, 0.75, 0.87];
    const SLOW = T8.map((t) => t * 4);
    const SPIN = [0, 1, 0, -1, 0, 1, 0, -1];
    const SEQ = (pose, x, dir, times) => times.map((tt) => [pose, dir, false, tt, x]);
    const ROWS = [
      ['barre plies', SEQ('barreplie', 176, 0, [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8])],
      ['barre port de bras', SEQ('barrepdb', 176, 1, [0, 0.8, 1.5, 2.3, 3.0, 3.8, 4.5, 5.3])],
      ['leg on the barre', SEQ('barre', 176, 1, [0, 1.0, 1.5, 2.0, 2.8, 3.6, 4.0, 4.5])],
      ['plie', SEQ('plie', 88, 0, [0, 0.8, 1.4, 2.0, 2.8, 3.7, 4.4, 5.3])],
      ['port de bras', SEQ('portdebras', 88, 0, [0, 0.9, 1.5, 2.4, 3.0, 3.9, 4.5, 5.4])],
      ['arabesque', SEQ('arabesque', 88, 1, [0, 0.2, 0.4, 0.7, 1.5, 2.4, 3.05, 3.3])],
      ['pirouette: prep, turn, land', [['pirprep', 0, false, 0.2, 88], ['pirprep', 0, false, 0.7, 88], ['pirouette', 0, false, 0, 88], ['pirouette', 1, false, 0, 88], ['pirouette', 0, true, 0, 88], ['pirouette', -1, false, 0, 88], ['pirland', 0, false, 0.3, 88], ['pirland', 0, false, 0.7, 88]]],
      ['reverence', SEQ('reverence', 88, 0, [0.6, 1.0, 1.5, 2.1, 2.4, 2.55, 2.9, 3.3])],
      ['charleston', SEQ('charleston', 88, 0, [0.5, 0.625, 0.75, 0.875, 4.1, 4.3, 8.1, 8.3])],
      ['ukulele (one bar)', SEQ('ukulele', 107, 0, [0, 0.1, 0.55, 0.86, 1.2, 1.4, 1.6, 1.9])],
    ];
    for (const theme of themes) {
      B.setTheme(theme);
      B.jumpTo(s, 15);
      await sleep(100);
      s.npcs.length = 0;
      const W0 = 64;
      const H0 = 64;
      const sh = sheet(8, ROWS.length, W0, H0, 3, 16);
      let k = 0;
      for (const [label, steps] of ROWS) {
        for (const [pose, dir, back, t, x] of steps) {
          Object.assign(o, { area: 'inside', depth: 'back', x, moving: false, pose, hidden: false, dir, backView: back, holding: null, emoteKind: null });
          o.t = t;
          o.poseT = t;
          o._lp = pose;
          o._blendPose = pose; // a still frame: no blend from the previous cell
          o._blendFrom = null;
          performance.now = () => 1000000 + t * 1000;
          const c = frameC();
          sh.put(k++, c, x - 32, 84, `${label} ${t.toFixed(2)}s`);
        }
      }
      await save(`${tag}-M-dance-${theme}`, sh.c);
    }
  } finally {
    B.world = live;
    B.holdFrame = false;
    performance.now = now0;
    B.setTheme(theme0);
  }
}
