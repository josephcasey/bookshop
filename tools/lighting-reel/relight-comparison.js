// SCH-30: deterministic side-by-side stills of the production window lighting and the receiver-buffer prototype.
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
  const [x0, y0, w, h] = crop;
  const aa = a.getContext('2d').getImageData(x0, y0, w, h).data;
  const bb = b.getContext('2d').getImageData(x0, y0, w, h).data;
  let changed = 0;
  let delta = 0;
  for (let i = 0; i < aa.length; i += 4) {
    const d = Math.abs(aa[i] - bb[i]) + Math.abs(aa[i + 1] - bb[i + 1]) + Math.abs(aa[i + 2] - bb[i + 2]);
    if (d > 30) changed++;
    delta += d;
  }
  return { changedPct: (100 * changed) / (w * h), meanDelta: delta / (w * h * 3) };
}

export async function run() {
  if (window.__relightComparison && !window.__relightComparison.error) return window.__relightComparison;
  const mode = B.relightV2;
  if (!mode) throw new Error('receiver-buffer prototype did not load');
  window.__relightComparison = { done: false };
  const live = B.world;
  const theme0 = B.theme;
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
  const render = (enabled, frameSeed) => {
    mode.setEnabled(enabled);
    reseed(frameSeed);
    B.world.paused = false;
    B.render(g, B.world);
    reseed(frameSeed);
    B.render(g, B.world);
    B.world.paused = true;
    return copyFrame();
  };
  const setTraffic = (list) => {
    B.trafficEvents.length = 0;
    for (const e of list) B.trafficEvents.push(Object.assign({ t: 0, dur: 4, dir: 1, jx: 140, seed: 0.9, led: false }, e));
  };

  const scenarios = [
    { id: 'morning', label: 'clear morning, sun 14°', hour: () => B.sunTime(14, false), weather: 'clear', cloud: 0.1 },
    { id: 'cloudy-noon', label: 'cloudy noon, diffuse sky', hour: () => B.sunPos(12).noon, weather: 'cloudy', cloud: 0.82 },
    { id: 'afternoon', label: 'afternoon, sun 22°', hour: () => B.sunTime(22, true), weather: 'clear', cloud: 0.12 },
    { id: 'angled-sun', label: 'angled sun, 12°', hour: () => B.sunTime(12, true), weather: 'clear', cloud: 0.08 },
    { id: 'blue-hour', label: 'blue hour + main beam', hour: () => B.sunTime(-5, true), weather: 'clear', cloud: 0.1, traffic: [{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 2.05, main: true }] },
    { id: 'night-rain', label: 'night rain + main beam', hour: () => 22.3, weather: 'rain', cloud: 0.85, traffic: [{ kind: 'turn', dir: -1, jx: 230, dur: 4.65, t: 2.05, main: true }] },
    { id: 'fog', label: 'fog + dipped beam', hour: () => 23, weather: 'fog', cloud: 0.62, traffic: [{ kind: 'turn', dir: 1, jx: 70, dur: 4.65, t: 2.05, main: false }] },
  ];

  B.holdFrame = true;
  B._lightAdaptInstant = true;
  performance.now = () => 1000000;
  try {
    const fresh = B.createWorld();
    fresh.mode = 'story';
    fresh.npcs.length = 0;
    fresh.litter = [];
    B.world = fresh;
    B.settle(fresh);
    B.emit('ready', fresh);
    const setScene = async (sc) => {
      B.jumpTo(fresh, sc.hour());
      B.setWeatherKind(fresh, sc.weather);
      fresh.weather.cloud = sc.cloud;
      fresh.weather.rain = sc.weather === 'rain' ? 1 : 0;
      fresh.weather.fog = sc.weather === 'fog' ? 1 : 0;
      fresh.npcs.length = 0;
      Object.assign(fresh.owner, { area: 'inside', depth: 'back', x: 172, hidden: false, pose: 'stand', moving: false, dir: -1, emoteKind: null });
      fresh.shop.lights = false;
      fresh.upstairs.light = false;
      fresh.lamp = false;
      if (B.shopLamps) {
        B.shopLamps.pendantL = B.shopLamps.pendantR = false;
        B.shopLamps.lastMain = false;
      }
      const walker = B.spawn(fresh, 'passer');
      if (walker) {
        Object.assign(walker, { x: 112, lane: 0, dir: 1, moving: false, pose: 'stand', hidden: false, alpha: 1, area: 'street', emoteKind: null });
        walker.script = null;
        walker.scripts = [];
      }
      if (fresh.cat) Object.assign(fresh.cat, { surface: 'sill', x: 48, pose: 'sit', dir: 1 });
      setTraffic(sc.traffic || []);
      await sleep(30);
    };

    B.setTheme('cyber');
    for (let row = 0; row < scenarios.length; row++) {
      const sc = scenarios[row];
      await setScene(sc);
      const baseline = render(false, 7000 + row);
      const alternate = render(true, 7000 + row);
      const metric = changedPct(baseline, alternate, [5, 72, 212, 94]);
      const stats = B._relightV2Debug ? B._relightV2Debug().stats : null;
      report.push({ theme: 'cyber', id: sc.id, label: sc.label, ...metric, stats });
      full.put(row, 0, baseline, `${sc.label} | CURRENT CYBER`);
      full.put(row, 1, alternate, `${sc.label} | RECEIVER BUFFER CYBER`);
      close.put(row, 0, baseline, `${sc.label} | CURRENT CYBER`);
      close.put(row, 1, alternate, `${sc.label} | RECEIVER BUFFER CYBER`);
    }
    await save('SCH-30-relight-v2-cyber-comparison', full.c);
    await save('SCH-30-relight-v2-cyber-interior', close.c);
    window.__relightComparison = { done: true, report };
    const pre = document.createElement('pre');
    pre.id = 'relightComparisonReport';
    pre.textContent = JSON.stringify(window.__relightComparison, null, 2);
    document.body.appendChild(pre);
    console.info('[bookshop] relight comparison complete', report);
    return window.__relightComparison;
  } finally {
    mode.setEnabled(false);
    B.world = live;
    B.setTheme(theme0);
    B.holdFrame = hold0;
    B._lightAdaptInstant = false;
    Math.random = rnd0;
    performance.now = now0;
  }
}
