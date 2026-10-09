// SCH-30: deterministic current-gameplay vs the complete playable hybrid-v1 package.
const B = window.Bookshop;
const SINK = 'http://127.0.0.1:8124/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function save(name, canvas) {
  await fetch(SINK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: canvas.toDataURL('image/png'), dir: 'out' }),
  });
}

function sheet(rows, crop, scale) {
  const [sx, sy, sw, sh] = crop;
  const labelH = 18;
  const gap = 8;
  const c = document.createElement('canvas');
  c.width = gap + 2 * (sw * scale + gap);
  c.height = gap + rows * (sh * scale + labelH + gap);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#101016';
  g.fillRect(0, 0, c.width, c.height);
  return {
    c,
    put(row, col, source, label) {
      const x = gap + col * (sw * scale + gap);
      const y = gap + row * (sh * scale + labelH + gap);
      g.fillStyle = col ? '#b8f2c8' : '#f3cf87';
      g.font = '12px monospace';
      g.fillText(label, x, y + 12);
      g.drawImage(source, sx, sy, sw, sh, x, y + labelH, sw * scale, sh * scale);
    },
  };
}

function changedPct(a, b, crop) {
  const [x, y, w, h] = crop;
  const aa = a.getContext('2d').getImageData(x, y, w, h).data;
  const bb = b.getContext('2d').getImageData(x, y, w, h).data;
  let changed = 0;
  let delta = 0;
  for (let i = 0; i < aa.length; i += 4) {
    const d = Math.abs(aa[i] - bb[i]) + Math.abs(aa[i + 1] - bb[i + 1]) + Math.abs(aa[i + 2] - bb[i + 2]);
    if (d > 30) changed++;
    delta += d;
  }
  return { changedPct: (100 * changed) / (w * h), meanDelta: delta / (w * h * 3) };
}

function meanLuma(canvas, rects) {
  const g = canvas.getContext('2d');
  let total = 0;
  let n = 0;
  for (const [x, y, w, h] of rects) {
    const d = g.getImageData(x, y, w, h).data;
    for (let i = 0; i < d.length; i += 4) {
      total += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
  }
  return total / n;
}

export async function run() {
  if (window.__hybridGameplayComparison && !window.__hybridGameplayComparison.error) return window.__hybridGameplayComparison;
  if (!B.hybridLighting || !B.relightV2) throw new Error('hybrid-v1 did not load');
  window.__hybridGameplayComparison = { done: false };

  const live = B.world;
  const hold0 = B.holdFrame;
  const rnd0 = Math.random;
  const now0 = performance.now.bind(performance);
  const screen = document.querySelector('#screen');
  const g = screen.getContext('2d');
  const full = sheet(7, [0, 0, 320, 180], 2);
  const close = sheet(7, [5, 72, 212, 94], 3);
  const report = [];
  let seed = 1;

  const reseed = (value) => {
    seed = value;
    Math.random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const copyFrame = () => {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    c.getContext('2d').drawImage(screen, 0, 0);
    return c;
  };
  const setTraffic = (list) => {
    B.trafficEvents.length = 0;
    for (const e of list) B.trafficEvents.push(Object.assign({ t: 0, dur: 4, dir: 1, jx: 140, seed: 0.9, led: false }, e));
  };
  const setLamps = (s, ids) => {
    const has = (id) => ids.includes(id);
    B.shopLamps.pendantL = has('pendantL');
    B.shopLamps.pendantR = has('pendantR');
    s.lamp = has('desk');
    s.shop.lights = has('pendantL') || has('pendantR');
    B.shopLamps.lastMain = s.shop.lights;
  };
  const scenarios = [
    { id: 'clear-morning', label: 'clear morning 08:27, facade bounce', hour: () => 8.45, weather: 'clear', cloud: 0.08, lamps: ['desk'] },
    { id: 'overcast', label: 'overcast midday', hour: () => B.sunPos(12).noon, weather: 'cloudy', cloud: 0.96, lamps: ['pendantL', 'pendantR', 'desk'] },
    { id: 'rain-day', label: 'rainy afternoon', hour: () => B.sunTime(18, true), weather: 'rain', cloud: 0.94, lamps: ['pendantL', 'pendantR', 'desk'] },
    { id: 'sun', label: 'clear afternoon, sun 22°', hour: () => B.sunTime(22, true), weather: 'clear', cloud: 0.12, lamps: ['pendantR', 'desk'] },
    { id: 'golden', label: 'golden hour, sun 5°', hour: () => B.sunTime(5, true), weather: 'clear', cloud: 0.08, lamps: ['pendantR', 'desk'] },
    { id: 'rain-night', label: 'rainy night + main beam', hour: () => 22.3, weather: 'rain', cloud: 0.9, lamps: ['pendantL', 'pendantR', 'desk'], traffic: [{ kind: 'turn', dir: -1, jx: 230, dur: 4.65, t: 2.05, main: true }] },
    { id: 'blue-hour', label: 'blue hour + main beam', hour: () => B.sunTime(-5, true), weather: 'clear', cloud: 0.12, lamps: ['pendantL', 'pendantR', 'desk'], traffic: [{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 2.05, main: true }] },
  ];

  B.holdFrame = true;
  B._lightAdaptInstant = true;
  performance.now = () => 1000000;
  try {
    reseed(21000);
    if (B.shopLamps.ensureWrapped) B.shopLamps.ensureWrapped();
    const fresh = B.createWorld();
    fresh.mode = 'story';
    fresh.litter = [];
    B.world = fresh;
    B.settle(fresh);
    B.emit('ready', fresh);

    const setScene = async (sc, row) => {
      reseed(22000 + row);
      B.jumpTo(fresh, sc.hour());
      B.setWeatherKind(fresh, sc.weather);
      fresh.weather.cloud = sc.cloud;
      fresh.weather.rain = sc.weather === 'rain' ? 1 : 0;
      fresh.weather.fog = 0;
      fresh.shop.open = true;
      fresh.shop.locked = false;
      fresh.upstairs.light = false;
      fresh.npcs.length = 0;
      Object.assign(fresh.owner, { area: 'inside', depth: 'back', x: 154, hidden: false, pose: 'stand', moving: false, dir: -1, emoteKind: null });
      const customer = B.spawn(fresh, 'passer');
      if (customer) {
        Object.assign(customer, { x: 91, area: 'inside', depth: 'front', dir: 1, moving: false, pose: 'browse', hidden: false, alpha: 1, emoteKind: null });
        customer.script = null;
        customer.scripts = [];
      }
      const walker = B.spawn(fresh, 'passer');
      if (walker) {
        Object.assign(walker, { x: 119, lane: 0, dir: 1, moving: false, pose: 'stand', hidden: false, alpha: 1, area: 'street', emoteKind: null });
        walker.script = null;
        walker.scripts = [];
      }
      if (fresh.cat) Object.assign(fresh.cat, { surface: 'sill', x: 48, pose: 'sit', dir: 1 });
      setLamps(fresh, sc.lamps);
      setTraffic(sc.traffic || []);
      await sleep(30);
    };
    const render = (hybrid, frameSeed) => {
      B.hybridLighting.setEnabled(hybrid);
      reseed(frameSeed);
      fresh.paused = false;
      B.render(g, fresh);
      reseed(frameSeed);
      B.render(g, fresh);
      fresh.paused = true;
      return copyFrame();
    };

    for (let row = 0; row < scenarios.length; row++) {
      const sc = scenarios[row];
      await setScene(sc, row);
      const current = render(false, 23000 + row);
      const hybrid = render(true, 23000 + row);
      const currentPools = meanLuma(current, [[12, 88, 58, 42], [136, 88, 69, 42]]) - meanLuma(current, [[78, 88, 47, 42]]);
      const hybridPools = meanLuma(hybrid, [[12, 88, 58, 42], [136, 88, 69, 42]]) - meanLuma(hybrid, [[78, 88, 47, 42]]);
      const solveSamples = [];
      for (let sample = 0; sample < 6; sample++) {
        reseed(24000 + row);
        B.render(g, fresh);
        const measured = B._relightV2Debug ? B._relightV2Debug().stats : null;
        if (measured && measured.sources) solveSamples.push(measured.solveMs);
      }
      const stats = B._relightV2Debug ? B._relightV2Debug().stats : null;
      report.push({
        id: sc.id,
        label: sc.label,
        ...changedPct(current, hybrid, [5, 72, 212, 94]),
        practicalPoolSeparation: { current: currentPools, hybrid: hybridPools },
        stats,
        warmSolveMs: solveSamples.length
          ? {
              mean: solveSamples.reduce((sum, value) => sum + value, 0) / solveSamples.length,
              max: Math.max(...solveSamples),
            }
          : null,
      });
      full.put(row, 0, current, `${sc.label} | CURRENT GAMEPLAY`);
      full.put(row, 1, hybrid, `${sc.label} | HYBRID V1`);
      close.put(row, 0, current, `${sc.label} | CURRENT GAMEPLAY`);
      close.put(row, 1, hybrid, `${sc.label} | HYBRID V1`);
      B.hybridLighting.setEnabled(false);
    }
    await save('SCH-30-hybrid-gameplay', full.c);
    await save('SCH-30-hybrid-gameplay-interior', close.c);
    window.__hybridGameplayComparison = { done: true, report };
    const pre = document.createElement('pre');
    pre.id = 'hybridGameplayComparisonReport';
    pre.textContent = JSON.stringify(window.__hybridGameplayComparison, null, 2);
    document.body.appendChild(pre);
    return window.__hybridGameplayComparison;
  } finally {
    B.hybridLighting.setEnabled(false);
    B.world = live;
    B.holdFrame = hold0;
    B._lightAdaptInstant = false;
    Math.random = rnd0;
    performance.now = now0;
  }
}
