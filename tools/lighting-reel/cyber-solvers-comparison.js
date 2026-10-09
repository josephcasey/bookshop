// SCH-30: one Cyber art direction, three lighting solvers, identical deterministic scenes.
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
  const cols = 3;
  const c = document.createElement('canvas');
  c.width = gap + cols * (sw * scale + gap);
  c.height = gap + rows * (sh * scale + labelH + gap);
  const g = c.getContext('2d');
  const labelCols = ['#f3cf87', '#9fd8ff', '#d5b4ff'];
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#101016';
  g.fillRect(0, 0, c.width, c.height);
  return {
    c,
    put(row, col, source, label) {
      const x = gap + col * (sw * scale + gap);
      const y = gap + row * (sh * scale + labelH + gap);
      g.fillStyle = labelCols[col];
      g.font = '12px monospace';
      g.fillText(label, x, y + 12);
      g.drawImage(source, sx, sy, sw, sh, x, y + labelH, sw * scale, sh * scale);
    },
  };
}

function pixels(canvas, crop) {
  const [x, y, w, h] = crop;
  return canvas.getContext('2d').getImageData(x, y, w, h).data;
}

function changedPct(a, b, crop) {
  const aa = pixels(a, crop);
  const bb = pixels(b, crop);
  let changed = 0;
  let delta = 0;
  for (let i = 0; i < aa.length; i += 4) {
    const d = Math.abs(aa[i] - bb[i]) + Math.abs(aa[i + 1] - bb[i + 1]) + Math.abs(aa[i + 2] - bb[i + 2]);
    if (d > 30) changed++;
    delta += d;
  }
  return { changedPct: (100 * changed) / (aa.length / 4), meanDelta: delta / (aa.length * 0.75) };
}

function lightStats(canvas, crop) {
  const data = pixels(canvas, crop);
  const luminance = [];
  let sum = 0;
  let sum2 = 0;
  let warmth = 0;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    luminance.push(y);
    sum += y;
    sum2 += y * y;
    warmth += data[i] - data[i + 2];
  }
  const n = data.length / 4;
  const mean = sum / n;
  luminance.sort((a, b) => a - b);
  const at = (p) => luminance[Math.min(luminance.length - 1, Math.floor(p * luminance.length))];
  return {
    meanLuma: mean,
    localContrast: Math.sqrt(Math.max(0, sum2 / n - mean * mean)),
    warmth: warmth / n,
    shadowP10: at(0.1),
    highlightP99: at(0.99),
    peakSpan: at(0.99) - at(0.1),
  };
}

export async function run() {
  if (window.__cyberSolversComparison && !window.__cyberSolversComparison.error) return window.__cyberSolversComparison;
  const receiver = B.relightV2;
  const ortho = B.relightOrtho;
  const direction = B.lightingDirection;
  if (!receiver || !ortho || !direction) throw new Error('SCH-30 lighting prototypes did not load');
  window.__cyberSolversComparison = { done: false };

  const live = B.world;
  const hold0 = B.holdFrame;
  const rnd0 = Math.random;
  const now0 = performance.now.bind(performance);
  const screen = document.querySelector('#screen');
  const g = screen.getContext('2d');
  const full = sheet(4, [0, 0, 320, 180], 2);
  const close = sheet(4, [5, 72, 212, 94], 3);
  const report = [];
  const variants = [
    { id: 'current', label: 'CURRENT SOLVER', receiver: false, ortho: false },
    { id: 'receiver', label: 'RECEIVER BUFFER', receiver: true, ortho: false },
    { id: 'ortho', label: 'ORTHO 2.5D', receiver: false, ortho: true },
  ];

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
    {
      id: 'overcast-noon', seed: 1, label: 'overcast midday', hour: () => B.sunPos(12).noon, weather: 'cloudy', cloud: 0.96,
      lamps: ['pendantL', 'pendantR', 'desk'],
      reason: 'Control: warm practical pools and cool exterior ambience should do the work without a directional source.',
    },
    {
      id: 'rain-night', seed: 2, label: 'rainy night + main beam', hour: () => 22.3, weather: 'rain', cloud: 0.9,
      lamps: ['pendantL', 'pendantR', 'desk'], traffic: [{ kind: 'turn', dir: -1, jx: 230, dur: 4.65, t: 2.05, main: true }],
      reason: 'Wet cyan-magenta atmosphere tests whether a hard directional beam can keep its depth without flattening warm shelves.',
    },
    {
      id: 'clear-afternoon', seed: 3, label: 'clear afternoon, sun 22°', hour: () => B.sunTime(22, true), weather: 'clear', cloud: 0.12,
      lamps: ['pendantR', 'desk'],
      reason: 'The sun is the key: depth breaks and top-facing surfaces should read more clearly than in the soft production patch.',
    },
    {
      id: 'blue-hour', seed: 4, label: 'blue hour + main beam', hour: () => B.sunTime(-5, true), weather: 'clear', cloud: 0.12,
      lamps: ['pendantL', 'pendantR', 'desk'], traffic: [{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 2.05, main: true }],
      reason: 'Warm practicals stay constant while the three solvers reveal their different shadow and depth character.',
    },
  ];

  B.holdFrame = true;
  B._lightAdaptInstant = true;
  performance.now = () => 1000000;
  try {
    reseed(16000);
    if (B.shopLamps.ensureWrapped) B.shopLamps.ensureWrapped();
    const fresh = B.createWorld();
    fresh.mode = 'story';
    fresh.litter = [];
    B.world = fresh;
    B.settle(fresh);
    B.emit('ready', fresh);
    direction.setEnabled(true);

    const setScene = async (sc) => {
      reseed(17000 + sc.seed);
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

    const render = (variant, frameSeed) => {
      receiver.setEnabled(variant.receiver);
      ortho.setEnabled(variant.ortho);
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
      await setScene(sc);
      const frames = [];
      const debug = {};
      for (const variant of variants) {
        frames.push(render(variant, 18000 + row));
        if (variant.receiver && B._relightV2Debug) debug.receiver = B._relightV2Debug().stats;
        if (variant.ortho && B._relightOrthoDebug) debug.ortho = B._relightOrthoDebug().stats;
      }
      const metrics = {};
      for (let col = 0; col < variants.length; col++) {
        const variant = variants[col];
        metrics[variant.id] = lightStats(frames[col], [5, 72, 212, 94]);
        full.put(row, col, frames[col], `${sc.label} | ${variant.label}`);
        close.put(row, col, frames[col], `${sc.label} | ${variant.label}`);
      }
      report.push({
        theme: 'cyber', id: sc.id, label: sc.label, reason: sc.reason, metrics, debug,
        receiverFromCurrent: changedPct(frames[0], frames[1], [5, 72, 212, 94]),
        orthoFromCurrent: changedPct(frames[0], frames[2], [5, 72, 212, 94]),
        orthoFromReceiver: changedPct(frames[1], frames[2], [5, 72, 212, 94]),
      });
    }

    await save('SCH-30-cyber-solvers', full.c);
    await save('SCH-30-cyber-solvers-interior', close.c);
    window.__cyberSolversComparison = { done: true, report };
    const pre = document.createElement('pre');
    pre.id = 'cyberSolversComparisonReport';
    pre.textContent = JSON.stringify(window.__cyberSolversComparison, null, 2);
    document.body.appendChild(pre);
    console.info('[bookshop] cyber solver comparison complete', report);
    return window.__cyberSolversComparison;
  } finally {
    receiver.setEnabled(false);
    ortho.setEnabled(false);
    direction.setEnabled(false);
    B.world = live;
    B.holdFrame = hold0;
    B._lightAdaptInstant = false;
    Math.random = rnd0;
    performance.now = now0;
  }
}
