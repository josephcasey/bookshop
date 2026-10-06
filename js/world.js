/* World state: layout, the shop's props (shelves, radio, coffee, phone, door, till...), weather, saving. */
(function () {
  'use strict';
  const B = window.Bookshop;

  // Ground line G = 164: pavement top, shop floor (hidden behind the stallriser) and door threshold.
  // People are ~60px tall; the low ceiling sits just above their heads.
  B.LAYOUT = {
    G: 164,
    win: { x: 9, y: 76, w: 202, h: 68 }, // shop window glass
    doorOpening: { x: 226, y: 92, w: 36, h: 72 },
    doorGlass: { x: 230, y: 98, w: 28, h: 34 },
    arch: { x: 75, y: 92, w: 27, h: 72 }, // passage to the rest of the shop
    upstairs: [{ x: 43, y: 19, w: 42, h: 27 }, { x: 153, y: 19, w: 42, h: 27 }],
    upstairsY: 80, // feet line for the flat upstairs (only head & shoulders show in the windows)
    upstairsSpots: { chair: 54, lamp: 64, tv: 79, windowA: 66, door: 120, windowB: 170, gym: 172, kitchen: 186 },
    upstairsRange: [48, 190],
    counterTop: 129,
    streetY: 171, // + lane (-3..5)
    backY: 162, // owner lane, behind the counter
    frontY: 167, // customer lane
    doorX: 244,
    alleyX: 299, // mouth of the alley beside the shop (Mabel's side door to the flat is down there)
    inDoorX: 216,
    edgeL: -22,
    edgeR: 342,
    spots: {
      shelf1: 20, shelf2: 38, shelf3: 56, arch: 88, nook: 120, window: 110,
      radio: 149, phone: 150, till: 179, counter: 184, coffee: 198, door: 208,
      display: 36, plant: 22, box: 200, custTill: 196,
    },
    ranges: {
      shelves: [16, 60], // in front of the big bookcase
      nook: [112, 128], // the narrow bookcase
      open: [96, 130], // open floor between the passage and counter
      floor: [16, 206],
      window: [20, 200], // pavement in front of the window
      street: [10, 300],
    },
  };
  B.shelfX = () => (B.chance(0.7) ? B.rnd(...B.LAYOUT.ranges.shelves) : B.rnd(...B.LAYOUT.ranges.nook));

  B.pal = {
    books: ['#8c2f2f', '#2f4f8c', '#3c6e47', '#c9a13b', '#6a4c93', '#b5651d', '#2e6f73', '#a33c62', '#4b3b2b', '#d8cfb8', '#1f3350', '#7f8c3a'],
  };

  B.titles = [
    'Middlemarch', 'Moby-Dick', 'Jane Eyre', 'The Moonstone', 'Great Expectations', 'Persuasion', 'Kidnapped',
    'The Wind in the Willows', 'Three Men in a Boat', 'Frankenstein', 'Little Women', 'The Secret Garden',
    'Dracula', 'Wuthering Heights', 'The Time Machine', 'Treasure Island', 'Cranford', 'The Woman in White',
  ];

  B.daylight = (h) => {
    if (h < 5.5 || h >= 20.5) return 0;
    if (h < 7.5) return (h - 5.5) / 2;
    if (h < 18.5) return 1;
    return 1 - (h - 18.5) / 2;
  };

  // ---------- shelves ----------
  const CASES = [
    { x1: 12, x2: 65, top: 82, bottoms: [96, 110, 124, 138, 152] },
    { x1: 108, x2: 132, top: 86, bottoms: [100, 114, 128, 142, 156] },
  ];
  function makeShelves() {
    const rng = B.seeded('shelves-v2');
    const cols = B.pal.books;
    const slots = [];
    for (const cs of CASES) {
      cs.bottoms.forEach((by, r) => {
        const room = by - (r === 0 ? cs.top : cs.bottoms[r - 1] + 2);
        let x = cs.x1;
        while (x < cs.x2) {
          const w = rng() < 0.35 ? 4 : 3;
          if (x + w > cs.x2 + 1) break;
          const h = Math.min(room - 1, 8 + Math.floor(rng() * 4));
          slots.push({ x, y: by, w, h, c: cols[Math.floor(rng() * cols.length)], r, band: rng() < 0.45, present: rng() < 0.85 });
          x += w;
        }
      });
    }
    return {
      slots,
      count() {
        return slots.filter((s) => s.present).length;
      },
      take(nearX = 60) {
        const have = slots.filter((s) => s.present).sort((a, b) => Math.abs(a.x - nearX) - Math.abs(b.x - nearX));
        const s = have[Math.floor(Math.random() * Math.min(10, have.length))];
        if (s) s.present = false;
        return s;
      },
      add(n = 1) {
        for (let i = 0; i < n; i++) {
          const gaps = slots.filter((s) => !s.present);
          if (!gaps.length) return;
          B.pick(gaps).present = true;
        }
      },
    };
  }

  // ---------- world ----------
  B.createWorld = function () {
    const s = {
      simT: 0,
      time: 8 * 60 + 15,
      day: 0,
      mode: 'story', // 'story' | 'live'
      speed: 1,
      ff: 1,
      flags: {},
      cooldowns: {},
      dayStats: { sales: 0, visitors: 0, calls: 0, missed: 0, deliveries: 0 },
      totals: { sales: 0, visitors: 0, days: 1 },
      npcs: [],
      scripts: [],
      particles: [],
      queue: [],
      boxes: [],
      shop: { open: false, lights: false, locked: true },
      lamp: false,
      upstairs: { light: false, blind: 0, tv: false, kettle: 0 },
      counter: { cup: false, box: false, lamp: false },
      plant: { water: 0.8 },
      display: { cols: B.pal.books.slice(0, 8) },
      weather: { kind: 'clear', rain: 0, snow: 0, fog: 0, cover: 0, cloud: 0.2, changeT: 60, forced: null },
      dayWet: 0.3,
      get hour() {
        return (this.time / 60) % 24;
      },
    };
    s.owner = new B.Owner();
    s.owner.x = B.LAYOUT.spots.counter;
    s.shelves = makeShelves();
    s.stations = B.active('station');
    if (!s.stations.length) s.stations = [{ id: 'static', name: 'Static', music: false, likes: -0.2 }];

    s.radio = {
      on: false,
      idx: 0,
      pT: 0,
      get station() {
        return s.stations[this.idx % s.stations.length];
      },
      turnOn() {
        this.on = true;
        B.audio.play('click');
        B.audio.radio(this.station);
        B.emit('radio', s, this.station);
      },
      turnOff() {
        this.on = false;
        B.audio.play('click');
        B.audio.radio(null);
        B.emit('radio', s, null);
      },
      next() {
        this.idx = (this.idx + 1) % s.stations.length;
        B.audio.play('tune');
        if (this.on) B.audio.radio(this.station);
        B.emit('radio', s, this.station);
        return this.station;
      },
      tuneTo(id) {
        const i = s.stations.findIndex((st) => st.id === id);
        if (i < 0 || i === this.idx) return this.station;
        this.idx = i;
        B.audio.play('tune');
        if (this.on) B.audio.radio(this.station);
        B.emit('radio', s, this.station);
        return this.station;
      },
      // the viewer's pick from the tuner: she leaves it alone until this story-time passes
      chosenUntil: 0,
    };

    s.coffee = {
      brewing: 0,
      brew(sec = 5) {
        this.brewing = sec;
        B.audio.play('steam', sec);
      },
    };

    s.phone = { ringing: false, ringT: 0, nextRing: 0, offHook: false };
    s.ringPhone = () => {
      s.phone.ringing = true;
      s.phone.ringT = 0;
      s.phone.nextRing = 0;
    };

    s.till = {
      dingT: 0,
      ding() {
        this.dingT = 1.2;
        B.audio.play('till');
        for (let i = 0; i < 5; i++)
          s.particle({ layer: 'in', x: 164, y: 110, vx: B.rnd(-16, 16), vy: B.rnd(-36, -16), vy2: 60, life: 0.9, c: '#f2c94c' });
      },
    };

    s.door = {
      openT: 0,
      bellT: 0,
      ring() {
        if (this.bellMuted) {
          this.bellT = 0.4;
          B.audio.play('clunk');
          return;
        }
        this.bellT = 1.2;
        B.audio.play('bell');
      },
      /** Action: actor steps through the door ('in' or 'out'). The door swings open, the actor
       *  steps into (or out of) the lit doorway, and the door swings shut behind them. */
      pass(actor, way) {
        const door = this;
        let t = 0;
        let phase = 0;
        return {
          update(dt) {
            t += dt;
            if (phase === 0) {
              door.openT = Math.max(door.openT, 1.3);
              door.ring();
              actor.moving = false;
              phase = 1;
            }
            if (phase === 1 && t >= 0.25) {
              if (way === 'in') actor.face('away'); // steps into the shop, back to us
              else {
                actor.area = 'street';
                actor.x = B.LAYOUT.doorX;
                actor.alpha = 0;
                actor.face(0);
              }
              phase = 2;
            }
            if (phase === 2) {
              const k = B.clamp((t - 0.25) / 0.3, 0, 1);
              actor.alpha = way === 'in' ? 1 - k : k;
              if (k < 1) return false;
              if (way === 'in') {
                actor.area = 'inside';
                actor.x = B.LAYOUT.inDoorX;
                actor.alpha = 1;
                actor.face(-1);
                B.emit('enter', s, actor);
              } else {
                if (actor instanceof B.NPC && actor.randomExit !== false) actor.exitX = B.chance(0.5) ? B.LAYOUT.edgeL - 2 : B.LAYOUT.edgeR + 2;
                actor.face(actor.exitX != null ? Math.sign(actor.exitX - actor.x) || 1 : -1);
                B.emit('leave', s, actor);
              }
              phase = 3;
            }
            return phase === 3;
          },
          abort() {
            actor.alpha = 1;
          },
        };
      },
    };

    s.particle = (p) => {
      if (s.particles.length > 700) return;
      s.particles.push(Object.assign({ vx: 0, vy: 0, vy2: 0, life: 1, age: 0, c: '#fff', kind: 'px', layer: 'out' }, p));
    };
    s.request = (id, priority, data) => B.requestOwner(s, id, priority, data);
    s.customersInside = () => s.npcs.filter((n) => n.area === 'inside').length;
    s.sale = (npc) => {
      s.dayStats.sales++;
      s.totals.sales++;
      s.till.ding();
      B.emit('sale', s, npc);
    };
    s.setWeather = (kind, hours = B.rnd(0.8, 2)) => {
      s.weather.kind = kind;
      s.weather.changeT = hours * B.STORY_HOUR;
    };
    return s;
  };

  // ---------- per-step prop updates ----------
  B.updateProps = function (s, dt) {
    const o = s.owner;
    if (s.door.openT > 0) {
      s.door.openT -= dt;
      if (s.door.openT <= 0) B.audio.play('door');
    }
    // the door swings towards open while held open, and back shut afterwards
    const want = s.door.openT > 0 ? 1 : 0;
    s.door.open = B.clamp((s.door.open || 0) + Math.sign(want - (s.door.open || 0)) * dt * 4.5, 0, 1);
    if (s.door.muteT > 0 && (s.door.muteT -= dt) <= 0) {
      s.door.bellMuted = false;
      s.door.note = null;
    }
    if (s.door.bellT > 0) s.door.bellT -= dt;
    if (s.till.dingT > 0) s.till.dingT -= dt;

    if (s.coffee.brewing > 0) {
      s.coffee.brewing -= dt;
      if (Math.random() < dt * 14)
        s.particle({ layer: 'in', x: B.rnd(193, 203), y: 99, vx: B.rnd(-2, 2), vy: B.rnd(-11, -6), life: 1.5, c: '#f1f3f5', kind: 'steam' });
      if (s.coffee.brewing <= 0) s.coffee.brewing = 0;
    }

    if (s.radio.on) {
      s.radio.pT -= dt;
      const st = s.radio.station;
      if (s.radio.pT <= 0 && (!st.stream || B.audio.streamStatus === 'playing' || !B.audio.enabled)) {
        const music = st.music !== false;
        s.radio.pT = music ? B.rnd(0.6, 1.2) : B.rnd(0.9, 1.6);
        s.particle({ layer: 'in', x: 150, y: 86, vx: B.rnd(-10, 10), vy: B.rnd(-10, -5), life: 2.4, c: st.color || '#5b3b8c', kind: music ? 'note' : 'speech' });
      }
    }

    if (s.phone.ringing) {
      s.phone.ringT += dt;
      if (s.phone.ringT >= s.phone.nextRing) {
        B.audio.play('ring');
        s.phone.nextRing += 3;
      }
    }

    s.plant.water = Math.max(0, s.plant.water - (dt / B.STORY_HOUR) * 0.035);

    if (o.pose === 'sleep') {
      s.zT = (s.zT || 0) - dt;
      if (s.zT <= 0) {
        s.zT = 1.4;
        s.particle({ layer: 'in', x: o.x + 6 * (o.dir || 1), y: B.headTop(o) - 2, vx: 6, vy: -9, life: 2.6, c: '#5c7cfa', kind: 'z' });
      }
    }

    updateWeather(s, dt);

    for (const p of s.particles) {
      p.age += dt;
      p.vy += p.vy2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flake') {
        p.x += Math.sin(p.age * 1.8 + p.wob) * 7 * dt; // drifting
        if (p.y >= p.ground) p.age = p.life;
      }
      if (p.kind === 'drop' && p.y >= p.ground) {
        p.age = p.life;
        if (Math.random() < 0.5) s.particle({ layer: 'rain', x: p.x, y: p.ground, vx: B.rnd(-8, 8), vy: -14, vy2: 80, life: 0.18, c: 'rgba(190,210,235,0.7)' });
      }
    }
    s.particles = s.particles.filter((p) => p.age < p.life);
    B.audio.update(s);
  };

  // Weather kinds: clear, cloudy, rain, fog, snow. Snow and fog depend on the real-world season
  // (the viewer's date) and the time of day; the Time of day panel can also force a kind.
  const season = () => {
    const m = +B.today.slice(5, 7);
    return { winter: m === 12 || m <= 2 ? 1 : m === 11 || m === 3 ? 0.4 : 0, damp: m >= 9 || m <= 3 ? 1 : 0.35 };
  };
  function pickWeather(s) {
    const { winter, damp } = season();
    const h = s.hour;
    if (winter && Math.random() < 0.35 * winter * (s.dayCold == null ? 0.5 : s.dayCold)) return 'snow';
    if (((h >= 4 && h < 11) || h >= 18) && Math.random() < 0.18 * damp) return 'fog';
    const r = Math.random();
    return r < s.dayWet * 0.6 ? 'rain' : r < s.dayWet * 1.3 ? 'cloudy' : 'clear';
  }
  const WEATHER_LOG = {
    rain: ['It starts to rain.', 'The rain eases off.'],
    snow: ['It starts to snow!', 'The snow stops falling.'],
    fog: ['A thick fog rolls in.', 'The fog lifts.'],
  };
  /** Force a weather kind (or null for automatic). */
  B.setWeatherKind = function (s, kind) {
    const w = s.weather;
    w.forced = kind || null;
    if (kind) {
      const prev = w.kind;
      w.kind = kind;
      w.changeT = 1e9;
      if (prev !== kind) {
        if (WEATHER_LOG[kind]) B.log(WEATHER_LOG[kind][0]);
        B.emit('weather', s, kind, prev);
      }
    } else w.changeT = 0;
  };

  function updateWeather(s, dt) {
    const w = s.weather;
    w.changeT -= dt;
    if (w.changeT <= 0 && !w.forced) {
      w.changeT = B.rnd(0.8, 2.5) * B.STORY_HOUR;
      const prev = w.kind;
      w.kind = pickWeather(s);
      if (prev !== w.kind) {
        if (WEATHER_LOG[w.kind]) B.log(WEATHER_LOG[w.kind][0]);
        else if (WEATHER_LOG[prev]) B.log(WEATHER_LOG[prev][1]);
        B.emit('weather', s, w.kind, prev);
      }
    }
    const ease = (k, target, rate) => (w[k] = (w[k] || 0) + (target - (w[k] || 0)) * Math.min(1, dt * rate));
    ease('rain', w.kind === 'rain' ? 1 : 0, 0.08);
    ease('snow', w.kind === 'snow' ? 1 : 0, 0.06);
    ease('fog', w.kind === 'fog' ? 1 : 0, 0.03);
    ease('cloud', w.kind === 'clear' ? 0.15 : w.kind === 'fog' ? 0.6 : 1, 0.05);
    // snow settles while it falls, and melts away afterwards (quicker in daylight or rain)
    const day = B.daylight(s.hour);
    if (w.snow > 0.05) w.cover = Math.min(1, (w.cover || 0) + (w.snow * dt) / (B.STORY_HOUR * 1.2));
    else if (w.cover > 0) w.cover = Math.max(0, w.cover - (dt / B.STORY_HOUR) * (0.04 + day * 0.14 + w.rain * 1.5)); // lingers a few hours
    if (w.rain > 0.05) {
      const n = w.rain * 90 * dt;
      let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (k-- > 0)
        s.particle({ layer: 'rain', x: B.rnd(-20, 330), y: B.rnd(-10, 40), vx: -18, vy: 230, life: 2, ground: B.rnd(164, 180), c: 'rgba(170,190,225,0.55)', kind: 'drop' });
    }
    if (w.snow > 0.05) {
      const n = w.snow * 45 * dt;
      let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (k-- > 0) {
        const near = Math.random() < 0.25;
        s.particle({ layer: 'rain', x: B.rnd(-20, 330), y: B.rnd(-10, 10), vx: B.rnd(-5, 5), vy: near ? B.rnd(22, 30) : B.rnd(12, 20), life: 16, ground: B.rnd(164, 180), wob: Math.random() * 6, big: near, c: '#f8fbff', kind: 'flake' });
      }
    }
  }

  // ---------- day changes & state from the clock ----------
  B.newDay = function (s, day) {
    s.day = day;
    const o = s.owner;
    s.flags = {};
    if (o.area === 'inside') s.flags = { arrived: true, opened: true, closed: true };
    s.dayStats = { sales: 0, visitors: 0, calls: 0, missed: 0, deliveries: 0 };
    s.totals.days++;
    const rng = B.seeded(`day-${B.today}-${day}`);
    o.baseline = 0.35 + rng() * 0.4; // some days she's just in a better mood
    s.dayWet = 0.1 + rng() * 0.5;
    s.dayCold = rng();
    B.emit('newDay', s, day);
  };

  /** Put owner/shop into the state that fits the current hour (used on load and mode switch). */
  B.settle = function (s) {
    const C = B.config;
    const h = s.hour;
    const o = s.owner;
    if (o.current) o.current.abort();
    o.current = null;
    o.currentDef = null;
    o.pending = [];
    o.priority = 0;
    o.pose = 'stand';
    o.holding = null;
    o.moving = false;
    s.queue = [];
    s.npcs = [];
    s.scripts = [];
    s.phone.ringing = false;
    s.phone.offHook = false;
    s.phone.dangling = false;
    if (s.radio.on) s.radio.turnOff();
    s.upstairs.tv = false;
    if (h >= C.closeHour + 0.2 && h < C.bedHour) {
      // evening: she's home in the flat upstairs
      o.area = 'upstairs';
      o.x = B.LAYOUT.upstairsSpots.chair;
      s.shop.open = false;
      s.shop.lights = false;
      s.shop.locked = true;
      s.upstairs.light = true;
      s.upstairs.blind = 0;
      s.flags = { arrived: true, opened: true, closed: true, left: true };
      return;
    }
    s.upstairs.light = false;
    s.upstairs.blind = h >= C.bedHour || h < C.arriveHour ? 1 : 0;
    if (h >= C.arriveHour && h < C.closeHour + 0.2) {
      o.area = 'inside';
      o.x = B.LAYOUT.spots.counter;
      s.shop.lights = true;
      s.shop.locked = false;
      s.flags.arrived = true;
      s.shop.open = h >= C.openHour && h < C.closeHour;
      s.flags.opened = h >= C.openHour;
      s.flags.closed = h >= C.closeHour;
    } else {
      o.area = 'away';
      s.shop.open = false;
      s.shop.lights = false;
      s.shop.locked = true;
      const after = h >= C.closeHour;
      s.flags = after ? { arrived: true, opened: true, closed: true, left: true, bed: true } : {};
    }
  };

  /** Jump to an hour of the current day (switching to Story time, since Live time follows the real clock). */
  B.jumpTo = function (s, hour) {
    hour = ((hour % 24) + 24) % 24;
    const before = s.time;
    if (s.mode === 'live') s.mode = 'story';
    s.time = Math.floor(s.time / 1440) * 1440 + hour * 60;
    if (s.time < before) s.dayStats = { sales: 0, visitors: 0, calls: 0, missed: 0, deliveries: 0 }; // rewound: a fresh day
    s.paused = false;
    B.settle(s);
    B.emit('jump', s, hour);
    B.log(`The clock jumps to ${B.clockStr(s)}.`);
  };

  // ---------- save / load ----------
  const KEY = 'bookshop.v1';
  B.saveGame = function (s) {
    try {
      const o = s.owner;
      localStorage.setItem(
        KEY,
        JSON.stringify({
          time: s.time,
          mode: s.mode,
          speed: s.speed,
          owner: { energy: o.energy, mood: o.mood, caffeine: o.caffeine, baseline: o.baseline },
          shelves: s.shelves.slots.map((x) => (x.present ? 1 : 0)).join(''),
          plant: s.plant.water,
          totals: s.totals,
          dayStats: s.dayStats,
          dayWet: s.dayWet,
          station: s.radio.station.id,
          sound: B.audio.enabled,
        })
      );
    } catch (e) {
      /* storage unavailable */
    }
  };
  B.loadGame = function (s) {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) {
      d = null;
    }
    if (!d) {
      B.newDay(s, 0);
      s.totals.days = 1;
      return null;
    }
    s.time = d.time || s.time;
    s.day = Math.floor(s.time / 1440);
    s.mode = d.mode === 'live' ? 'live' : 'story';
    s.speed = d.speed || 1;
    Object.assign(s.owner, d.owner || {});
    if (d.shelves && d.shelves.length === s.shelves.slots.length)
      s.shelves.slots.forEach((x, i) => (x.present = d.shelves[i] === '1'));
    s.plant.water = d.plant == null ? 0.8 : d.plant;
    if (d.totals) s.totals = d.totals;
    if (d.dayStats) s.dayStats = d.dayStats;
    s.dayWet = d.dayWet == null ? 0.3 : d.dayWet;
    const si = typeof d.station === 'string' ? s.stations.findIndex((st) => st.id === d.station) : d.station;
    s.radio.idx = si > 0 ? si : 0;
    return d;
  };
})();
