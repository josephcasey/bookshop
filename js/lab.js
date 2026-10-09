/* The Lighting Lab: an in-game menu for seeing what each lighting approach brings.
 * - Scenarios: jump to a moment (morning sun, golden hour, dusk traffic, a night turn, rain, fog, an emergency...) and
 *   keep its traffic coming.
 * - Approaches: switch any of them off (B.lightFlags).
 * - Compare: split screen, the chosen approach ON on the left and OFF on the right (drag across the scene to move the
 *   divider).
 * - Benchmark: for the current scenario, render each approach on and off and measure how much of the picture it
 *   changes (impact) and what it costs per frame.
 * - The locked palette: an approach of its own: the finished frame snapped to one fixed palette. */
(function () {
  'use strict';
  const B = window.Bookshop;
  const $ = (sel) => document.querySelector(sel);
  const W = 320;
  const H = 180;

  const APPROACHES = [
    ['sun', 'Sunlight', 'The sun and its shadows on the front: ledges, recesses, lamp post, people, cars'],
    ['buildingShadow', 'Opposite buildings', 'The skyline across the road shading the front as the sun sinks'],
    ['cloudShadows', 'Cloud shadows', 'Patches of shade drifting across the street'],
    ['glassReflection', 'Glass reflects the street', 'By day the window mirrors the bright street behind you, until dusk'],
    ['streetLife', 'Reflected street', 'The shops, people and traffic across the road, seen in the glass'],
    ['shopLamps', 'Shop lamps', 'The pendants and desk lamp as point sources: falloff, shade scallops, prop and people shadows'],
    ['sunInterior', 'Sun through the glass', 'The window’s sunlit patch on the back wall, props and all'],
    ['headlights', 'Traffic light', 'Cars, buses, bikes and emergency vehicles as light sources'],
    ['steadyLights', 'Steady lights', 'The pub, chippy, signs and the street lamp'],
    ['reveal', 'Light reveals colour', 'Light brings up the surface’s own colour (off: a plain additive wash)'],
    ['bands', 'Pixel-grid bands', 'Light quantised to a few levels, dithered only on ramps'],
    ['projection', 'Through the windows', 'Light projected into the shop and the flat'],
    ['propShadows', 'Shadows inside', 'Props and people cast shadows inside'],
    ['quietShadows', 'Quiet shadows', 'Texture softened inside shadows so silhouettes read'],
    ['facadeShadows', 'Shadows on the front (night)', 'People and the lamp post shadowed by headlights'],
    ['exposure', 'Eye adaptation', 'The scene dims a little while a bright beam is on you'],
    ['actorLight', 'People lit', 'People lit by the light where they stand, and catching beams'],
    ['mirror', 'Dark-glass mirror', 'The unlit window reflects the pub opposite'],
    ['glints', 'Glints', 'Headlamp glints in the glass, kerb highlights'],
    ['rain', 'Wet reflections', 'Streaks of reflected light on wet paving'],
    ['fog', 'Beams in fog', 'Light visible in the air'],
    ['grade', 'Neon grade & bloom', 'The neon theme’s colour grade and glow'],
    ['palette', 'Locked palette', 'The finished frame snapped to one fixed palette'],
  ];

  // moments defined by the sun (so they follow the seasons), or by the clock: [name, hour or (()=>hour), weather, cloud, traffic]
  const SCENARIOS = [
    ['Sunrise', () => B.sunTime(4, false), 'clear', 0.1, null],
    ['Morning', () => B.sunTime(14, false), 'clear', 0.15, null],
    ['Noon', () => B.sunPos(12).noon, 'clear', 0.25, 'car'],
    ['Afternoon sun', () => B.sunTime(22, true), 'clear', 0.15, 'car'],
    ['Gold blade', () => B.sunTime(8, true), 'clear', 0.1, null],
    ['Golden hour', () => B.sunTime(5, true), 'clear', 0.1, 'car'],
    ['Cloudy day', () => B.sunPos(12).noon + 1.5, 'cloudy', 0.7, 'bus'],
    ['Sunset glow', () => B.sunTime(-2, true), 'clear', 0.1, 'turn'],
    ['Blue hour', () => B.sunTime(-6, true), 'clear', 0.1, 'turn'],
    ['Night turn', 21.8, 'clear', 0.1, 'turn'],
    ['Night rain', 22.4, 'rain', 0.8, 'car'],
    ['Fog', 23.0, 'fog', 0.6, 'turn'],
    ['Emergency', 1.0, 'clear', 0.1, 'emergency'],
  ];

  const lab = (B.lab = { compare: null, divider: 160, swap: false, scenario: null, loopT: 0 });
  B.lightFlags = B.lightFlags || {}; // the lighting features add their own flags to this as they load
  if (B.lightFlags.palette == null) B.lightFlags.palette = false;
  if (B.lightFlags.grade == null) B.lightFlags.grade = true;

  // ---------- the locked palette ----------
  let pal = null; // [[r,g,b]...]
  let lut = null; // 15-bit colour -> palette index
  let building = false;
  function buildPalette() {
    if (building) return;
    building = true;
    // Gather the colours the cyber scene is made of across day and night, and keep the 64 most used
    // (spread out so near-duplicates don't crowd out accents)
    const s = B.world;
    const counts = new Map();
    const scr = $('#screen');
    const g = scr.getContext('2d');
    const h0 = s.time;
    B.holdFrame = true;
    for (const hr of [10, 17.5, 19.6, 22]) {
      B.jumpTo(s, hr);
      B.render(g, s);
      const d = g.getImageData(0, 0, W, H).data;
      for (let i = 0; i < d.length; i += 8) {
        const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    s.time = h0;
    B.settle(s);
    B.holdFrame = false;
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    pal = [];
    for (const [k] of sorted) {
      const c = [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4];
      if (pal.every((p) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 > 22 * 22)) pal.push(c);
      if (pal.length >= 64) break;
    }
    building = false;
    lut = new Uint8Array(32768);
    for (let k = 0; k < 32768; k++) {
      const r = ((k >> 10) & 31) * 8 + 4;
      const gg = ((k >> 5) & 31) * 8 + 4;
      const b = (k & 31) * 8 + 4;
      let best = 0;
      let bd = 1e9;
      for (let i = 0; i < pal.length; i++) {
        const p = pal[i];
        const dd = 0.3 * (p[0] - r) ** 2 + 0.59 * (p[1] - gg) ** 2 + 0.11 * (p[2] - b) ** 2;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      lut[k] = best;
    }
  }
  B.finalPass = function (g) {
    if (!B.lightFlags.palette || building) return;
    if (!lut) buildPalette();
    if (!lut) return;
    let img;
    try {
      img = g.getImageData(0, 0, W, H);
    } catch (e) {
      return;
    }
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const p = pal[lut[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]];
      d[i] = p[0];
      d[i + 1] = p[1];
      d[i + 2] = p[2];
    }
    g.putImageData(img, 0, 0);
  };

  // ---------- split-screen compare ----------
  const off = [document.createElement('canvas'), document.createElement('canvas')];
  for (const c of off) {
    c.width = W;
    c.height = H;
  }
  B.renderOverride = function (g, s) {
    if (!lab.compare) {
      B.render(g, s);
      return;
    }
    const key = lab.compare;
    const was = B.lightFlags[key];
    const [ca, cb] = off;
    const ga = ca.getContext('2d', { willReadFrequently: true });
    const gb = cb.getContext('2d', { willReadFrequently: true });
    B.lightFlags[key] = !lab.swap;
    B.render(ga, s);
    B.lightFlags[key] = !!lab.swap;
    B.render(gb, s);
    B.lightFlags[key] = was;
    const x = Math.round(lab.divider);
    g.drawImage(ca, 0, 0, x, H, 0, 0, x, H);
    g.drawImage(cb, x, 0, W - x, H, x, 0, W - x, H);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(x, 0, 1, H);
    const name = (APPROACHES.find((a) => a[0] === key) || [key, key])[1].toUpperCase();
    const onL = lab.swap ? 'OFF' : 'ON';
    const onR = lab.swap ? 'ON' : 'OFF';
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x - 40, 1, 80, 7);
    B.text(g, onL, x - 4 - B.textWidth(onL), 2, '#9dff9d');
    B.text(g, onR, x + 4, 2, '#ff9d9d');
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(2, H - 9, B.textWidth(name) + 4, 8);
    B.text(g, name, 4, H - 8, '#ffe08a');
  };

  // ---------- scenarios ----------
  function play(sc) {
    const s = B.world;
    const [, when, weather, cloud] = sc;
    lab.scenario = sc;
    const hour = typeof when === 'function' ? when() : when;
    B.jumpTo(s, hour);
    B.setWeatherKind(s, weather);
    s.weather.cloud = cloud;
    if (weather === 'rain') s.weather.rain = 1;
    if (weather === 'fog') s.weather.fog = 1;
    lab.loopT = 0.5;
    if (B.syncButtons) B.syncButtons(s);
  }
  B.on('tick', (s, dt) => {
    const sc = lab.scenario;
    if (!sc || !sc[4]) return;
    lab.loopT -= dt / Math.max(1, s.speed || 1);
    if (lab.loopT > 0) return;
    lab.loopT = sc[4] === 'emergency' ? 9 : sc[4] === 'bus' ? 7 : 5.5;
    B.spawnTraffic(sc[4], sc[4] === 'turn' ? { main: Math.random() < 0.6 } : {});
  });

  // ---------- benchmark ----------
  async function benchmark(report) {
    const s = B.world;
    const g = $('#screen').getContext('2d');
    const flags = B.lightFlags;
    const rnd0 = Math.random;
    const now0 = performance.now.bind(performance);
    const realNow = now0;
    let seed = 99;
    const seeded = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const frozen = () => 4242424;
    B.holdFrame = true;
    B._lightAdaptInstant = true;
    const events = B.trafficEvents.map((e) => Object.assign({}, e));
    // keep one representative vehicle mid-way through for the measurement
    if (!events.length && lab.scenario && lab.scenario[4]) {
      B.spawnTraffic(lab.scenario[4], { main: true });
      events.push(Object.assign({}, B.trafficEvents[B.trafficEvents.length - 1]));
    }
    for (const e of events) e.t = e.dur * (e.kind === 'turn' ? 0.45 : 0.4);
    const renderOnce = () => {
      B.trafficEvents.length = 0;
      for (const e of events) B.trafficEvents.push(Object.assign({}, e));
      seed = 99;
      Math.random = seeded;
      performance.now = frozen;
      B.render(g, s);
      B.render(g, s);
      Math.random = rnd0;
      performance.now = now0;
      return g.getImageData(0, 0, W, H).data.slice();
    };
    const timed = (n) => {
      const t0 = realNow();
      for (let i = 0; i < n; i++) {
        seed = 99;
        Math.random = seeded;
        performance.now = frozen;
        B.render(g, s);
        Math.random = rnd0;
        performance.now = now0;
      }
      return (realNow() - t0) / n;
    };
    const base = renderOnce();
    // salience: changes count more where they fall on edges and shapes (a shadow's silhouette), less on flat fills
    const lum = new Float32Array(W * H);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = 0.3 * base[i] + 0.59 * base[i + 1] + 0.11 * base[i + 2];
    const edge = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const j = y * W + x;
        edge[j] = Math.min(1, (Math.abs(lum[j + 1] - lum[j - 1]) + Math.abs(lum[j + W] - lum[j - W])) / 80);
      }
    timed(4); // warm up
    const baseMs = timed(16);
    const rows = [];
    for (const [key, name] of APPROACHES) {
      const was = flags[key];
      flags[key] = !was;
      const alt = renderOnce();
      const altMs = timed(16);
      flags[key] = was;
      let diff = 0;
      let sal = 0;
      for (let i = 0, j = 0; i < base.length; i += 4, j++) {
        const dE = Math.abs(base[i] - alt[i]) + Math.abs(base[i + 1] - alt[i + 1]) + Math.abs(base[i + 2] - alt[i + 2]);
        if (dE > 30) diff++;
        // the change's own edges count too: a new shadow's outline is where the eye goes
        const altEdge = j % W > 0 && j % W < W - 1 ? Math.min(1, Math.abs(0.3 * (alt[i + 4] - alt[i - 4]) + 0.59 * (alt[i + 5] - alt[i - 3]) + 0.11 * (alt[i + 6] - alt[i - 2])) / 80) : 0;
        sal += Math.min(dE, 180) * (0.25 + Math.max(edge[j], altEdge));
      }
      const impact = (100 * diff) / (W * H);
      const salience = sal / (W * H * 0.9);
      // the cost of having it on: (time with it on) - (time with it off)
      const cost = was ? baseMs - altMs : altMs - baseMs;
      rows.push({ key, name, on: was, impact, salience, cost });
      report(`${name}...`);
      await new Promise((r) => setTimeout(r, 0));
    }
    B.trafficEvents.length = 0;
    for (const e of events) B.trafficEvents.push(e);
    B._lightAdaptInstant = false;
    B.holdFrame = false;
    return { rows: rows.sort((a, b) => b.impact - a.impact), frameMs: baseMs };
  }

  // ---------- the panel ----------
  B.on('ready', (s) => {
    if (document.getElementById('labBtn')) return; // 'ready' fires again after a reset: one Lab is enough
    const btn = document.createElement('button');
    btn.id = 'labBtn';
    btn.title = 'Lighting lab: compare and benchmark each lighting approach';
    btn.textContent = 'Lab';
    const hud = $('#diaryBtn');
    if (hud && hud.parentNode) hud.parentNode.insertBefore(btn, hud);
    const panel = document.createElement('aside');
    panel.id = 'labpanel';
    panel.className = 'panel labpanel hidden';
    panel.innerHTML = `
      <button class="close" aria-label="Close">×</button>
      <h2>Lighting lab</h2>
      <h3>Scenario</h3><div class="presets" id="labScenarios"></div>
      <h3>Compare</h3>
      <p class="hint">Pick an approach to see it split-screen: on the left with it, on the right without. Drag across the scene to move the divider.</p>
      <div class="presets"><button id="labCompareOff" class="on">Off</button><button id="labSwap">Swap sides</button></div>
      <h3>Approaches</h3><ul id="labList"></ul>
      <h3>Benchmark</h3>
      <p class="hint">For the current scenario: how much of the picture each approach changes (impact), how much of that lands on shapes and edges the eye reads (salience), and what it costs per frame.</p>
      <div class="presets"><button id="labBench">Run benchmark</button></div>
      <div id="labResults"></div>`;
    document.body.appendChild(panel);
    const scen = panel.querySelector('#labScenarios');
    for (const sc of SCENARIOS) {
      const b = document.createElement('button');
      b.textContent = sc[0];
      b.addEventListener('click', () => {
        play(sc);
        scen.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      });
      scen.appendChild(b);
    }
    const list = panel.querySelector('#labList');
    const render = () => {
      list.innerHTML = '';
      for (const [key, name, desc] of APPROACHES) {
        const li = document.createElement('li');
        li.innerHTML = `<label><input type="checkbox"> <b></b></label> <button class="cmp">compare</button><div class="hint"></div>`;
        const cb = li.querySelector('input');
        cb.checked = !!B.lightFlags[key];
        cb.addEventListener('change', () => {
          B.lightFlags[key] = cb.checked;
          if (key === 'palette' && cb.checked && !lut) buildPalette();
        });
        li.querySelector('b').textContent = name;
        li.querySelector('.hint').textContent = desc;
        const cmp = li.querySelector('.cmp');
        cmp.classList.toggle('on', lab.compare === key);
        cmp.addEventListener('click', () => {
          lab.compare = lab.compare === key ? null : key;
          if (key === 'palette' && !lut) buildPalette();
          render();
          panel.querySelector('#labCompareOff').classList.toggle('on', !lab.compare);
        });
        list.appendChild(li);
      }
    };
    render();
    panel.querySelector('#labCompareOff').addEventListener('click', () => {
      lab.compare = null;
      render();
      panel.querySelector('#labCompareOff').classList.add('on');
    });
    panel.querySelector('#labSwap').addEventListener('click', () => (lab.swap = !lab.swap));
    const out = panel.querySelector('#labResults');
    panel.querySelector('#labBench').addEventListener('click', async () => {
      out.textContent = 'Measuring...';
      const res = await benchmark((msg) => (out.textContent = `Measuring ${msg}`));
      const sc = lab.scenario ? lab.scenario[0] : 'current moment';
      out.innerHTML = `<p class="hint">${sc}: frame ${res.frameMs.toFixed(1)} ms with everything as set.</p>
        <table><tr><th>Approach</th><th>Impact</th><th>Salience</th><th>Cost</th></tr>${res.rows
          .map((r) => `<tr class="${r.on ? '' : 'offrow'}"><td>${r.name}${r.on ? '' : ' (off)'}</td><td><span class="bar" style="width:${Math.min(60, r.impact * 1.2)}px"></span> ${r.impact.toFixed(1)}%</td><td>${r.salience.toFixed(1)}</td><td>${r.cost >= 0 ? '+' : ''}${r.cost.toFixed(2)} ms</td></tr>`)
          .join('')}</table>`;
    });
    btn.addEventListener('click', () => panel.classList.toggle('hidden'));
    panel.querySelector('.close').addEventListener('click', () => panel.classList.add('hidden'));
    // drag the compare divider
    const canvas = $('#screen');
    const move = (e) => {
      if (!lab.compare) return;
      const r = canvas.getBoundingClientRect();
      lab.divider = Math.max(8, Math.min(W - 8, ((e.clientX - r.left) / r.width) * W));
    };
    canvas.addEventListener('mousemove', (e) => e.buttons && move(e));
    canvas.addEventListener('mousedown', move);
  });

  // Developer-only deterministic capture. Kept behind a query parameter so the live game never downloads or runs
  // the comparison harness; opening ?relight-comparison produces the SCH-30 contact sheets through the local sink.
  if (B.params && B.params.has('relight-comparison')) {
    B.on('ready', () => {
      import('../tools/lighting-reel/relight-comparison.js')
        .then((m) => m.run())
        .catch((error) => {
          console.error('[bookshop] relight comparison', error);
          window.__relightComparison = { done: true, error: String(error && error.stack ? error.stack : error) };
        });
    });
  }

  // SCH-30's art-direction comparison: production, tuned production, and tuned receiver-buffer under identical scenes.
  if (B.params && B.params.has('contrast-comparison')) {
    B.on('ready', () => {
      import('../tools/lighting-reel/contrast-comparison.js')
        .then((m) => m.run())
        .catch((error) => {
          console.error('[bookshop] contrast comparison', error);
          window.__contrastComparison = { done: true, error: String(error && error.stack ? error.stack : error) };
        });
    });
  }

  // Cyber-only comparison of the production projection, per-pixel receiver buffer and orthographic 2.5D G-buffer.
  if (B.params && B.params.has('cyber-solvers-comparison')) {
    B.on('ready', () => {
      import('../tools/lighting-reel/cyber-solvers-comparison.js')
        .then((m) => m.run())
        .catch((error) => {
          console.error('[bookshop] cyber solver comparison', error);
          window.__cyberSolversComparison = { done: true, error: String(error && error.stack ? error.stack : error) };
        });
    });
  }

  // The complete user-facing package: current gameplay versus hybrid-v1 across representative weather and time.
  if (B.params && B.params.has('hybrid-comparison')) {
    B.on('ready', () => {
      import('../tools/lighting-reel/hybrid-gameplay-comparison.js')
        .then((m) => m.run())
        .catch((error) => {
          console.error('[bookshop] hybrid gameplay comparison', error);
          window.__hybridGameplayComparison = { done: true, error: String(error && error.stack ? error.stack : error) };
        });
    });
  }
})();
