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
