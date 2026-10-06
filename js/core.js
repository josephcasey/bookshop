/* Bookshop core: namespace, config, content registry, small helpers.
 * Everything hangs off window.Bookshop (aliased B in every file). */
(function () {
  'use strict';
  const B = (window.Bookshop = window.Bookshop || {});

  B.W = 320;
  B.H = 180;
  // Rates and cooldowns in content are expressed in "story hours/minutes".
  // One story hour = 120 simulated seconds (2 real minutes at 1x speed).
  B.STORY_HOUR = 120;
  B.STORY_MIN = B.STORY_HOUR / 60;

  const params = new URLSearchParams(location.search);
  B.params = params;
  B.localISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // The real-world date drives which dated content is active. Override with ?date=YYYY-MM-DD
  B.today = params.get('date') || B.localISO(new Date());
  B.debug = params.has('debug');

  B.config = {
    shopName: 'DOG-EARED BOOKS',
    owner: { name: 'Mabel', look: 'owner' },
    arriveHour: 8.4,
    openHour: 9,
    closeHour: 17.5,
    bedHour: 22.5,
    clockRate: 0.5, // game minutes per simulated second (Story mode)
    nightSpeed: 10, // fast-forward multiplier while the owner is home
    pedestriansPerHour: 32,
    crowd: 1, // multiplier set by the Crowd control (0 = empty street)
    displayLampAtNight: true,
  };

  function merge(a, b) {
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k], v);
      else a[k] = v;
    }
    return a;
  }
  /** Tweak config, optionally only on some dates: B.tune({closeHour: 16}, {dates: ['12-24']}) */
  B.tune = (patch, when) => {
    if (when && !B.isActive(when)) return;
    merge(B.config, patch);
  };

  // ---------- random & maths ----------
  B.rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
  B.irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  B.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  B.chance = (p) => Math.random() < p;
  B.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  B.lerp = (a, b, t) => a + (b - a) * t;
  B.val = (v, ...args) => (typeof v === 'function' ? v(...args) : v);
  B.hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  B.seeded = (seed) => {
    let a = typeof seed === 'number' ? seed : B.hash(String(seed));
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  B.weighted = (items, wf) => {
    let total = 0;
    const ws = items.map((it) => {
      let w = 0;
      try {
        w = Math.max(0, +wf(it) || 0);
      } catch (e) {
        console.error('[bookshop] weight error', it.id, e);
      }
      total += w;
      return w;
    });
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= ws[i];
      if (r <= 0 && ws[i] > 0) return items[i];
    }
    return items[items.length - 1];
  };

  B.scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
  };

  // ---------- content registry ----------
  // Every kind of content is a plain object with an `id`. Registering the same id again
  // MERGES into the existing definition, so a daily file can tweak base content.
  const R = (B.registry = {
    activity: [], // things the owner does
    visitor: [], // people who spawn on the street
    happening: [], // world events (phone rings, deliveries, ...)
    station: [], // radio stations
    call: [], // phone call outcomes
    decor: [], // extra drawing hooks
    note: [], // "new today" changelog cards
    chalk: [], // chalkboard messages
    show: [], // programmes on Mabel's telly
  });
  B.looks = {};

  /** Date gating shared by all content: from / until (YYYY-MM-DD) and dates (['MM-DD' | 'YYYY-MM-DD']). */
  B.isActive = (def) => {
    if (!def || def.disabled) return false;
    const t = B.today;
    if (def.from && t < def.from) return false;
    if (def.until && t > def.until) return false;
    if (def.dates) {
      const md = t.slice(5);
      if (!def.dates.some((d) => (d.length === 5 ? d === md : d === t))) return false;
    }
    return true;
  };

  function add(kind, def) {
    const list = R[kind];
    if (!def.id) def.id = `${kind}-${list.length}`;
    const i = list.findIndex((d) => d.id === def.id);
    if (i >= 0) list[i] = Object.assign(list[i], def);
    else list.push(def);
    return list[i >= 0 ? i : list.length - 1];
  }
  B.activity = (def) => add('activity', def);
  B.visitor = (def) => add('visitor', def);
  B.happening = (def) => add('happening', def);
  B.station = (def) => add('station', def);
  B.call = (def) => add('call', def);
  B.decor = (def) => add('decor', def);
  B.note = (def) => add('note', Object.assign({ id: 'note-' + def.date }, def));
  B.chalk = (def) => add('chalk', def);
  B.show = (def) => add('show', def);
  B.look = (name, def) => (B.looks[name] = Object.assign({}, B.looks[name], def));
  B.disable = (kind, id) => {
    const d = R[kind].find((x) => x.id === id);
    if (d) d.disabled = true;
  };
  B.active = (kind) => R[kind].filter(B.isActive);
  B.findDef = (kind, id) => R[kind].find((d) => d.id === id);

  // ---------- events ----------
  const hooks = {};
  B.on = (ev, fn) => (hooks[ev] = hooks[ev] || []).push(fn);
  B.emit = (ev, ...args) =>
    (hooks[ev] || []).forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error('[bookshop] hook error', ev, e);
      }
    });

  // ---------- journal ----------
  B.journal = [];
  B.clockStr = (s) => {
    const m = Math.floor(s.time % 1440);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  B.log = (text) => {
    const s = B.world;
    const e = { stamp: s ? B.clockStr(s) : '', day: s ? s.day : 0, text };
    B.journal.unshift(e);
    if (B.journal.length > 300) B.journal.pop();
    B.emit('log', e);
  };
  B.ownerName = () => B.config.owner.name;
})();
