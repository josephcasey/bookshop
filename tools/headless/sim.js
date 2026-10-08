// Headless sim: runs every theme through the day and the weather and counts errors.  node tools/headless/sim.js
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '..', '..');
const noop = () => {};
const grad = { addColorStop: noop };
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : noop), set: (t, k, v) => { t[k] = v; return true; } });
const errors = [];
const sandbox = {
  console: { log: noop, warn: (...a) => errors.push(a.join(' ')), error: (...a) => errors.push(a.map(x => x && x.stack || x).join(' ')) },
  location: { search: '' }, performance: { now: () => Date.now() }, setInterval: noop, setTimeout: noop,
  URLSearchParams, Math, Date, JSON, Map, WeakMap, Array, Object, String, Number, Proxy,
  localStorage: { getItem: () => null, setItem: noop },
  document: { createElement: () => ({ getContext: () => ctx2d, width: 0, height: 0 }) },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
['js/core.js','js/script.js','js/pixel.js','js/sprites.js','js/audio.js','js/actors.js','js/world.js','js/director.js','js/render.js','js/cyber.js','content/manifest.js'].forEach(load);
const B = sandbox.Bookshop;
B.manifest.forEach(f => load('content/' + f));
B.buildCaches();
const s = B.world = B.createWorld();
B.loadGame(s); B.settle(s); B.emit('ready', s);
const out = (...a) => process.stdout.write(a.join(' ') + '\n');
const run = (sec) => { for (let i = 0; i < sec * 30; i++) { B.tick(s, 1 / 30); if (i % 5 === 0) B.render(ctx2d, s); } };
for (const theme of ['cyber', 'classic', 'cyber']) {
  B.setTheme(theme);
  for (const h of [3, 8.5, 11, 14, 17.5, 19.5, 22.4]) { B.jumpTo(s, h); run(20); }
  for (const w of ['rain', 'snow', 'fog', null]) { B.setWeatherKind(s, w); run(20); }
  out(theme, 'theme ok, errors so far', errors.length);
}
out('errors', errors.length); errors.slice(0, 8).forEach((e) => out(' ', e));
