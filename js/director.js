/* Director: advances time, runs the owner's activities, rolls happenings, spawns passers-by. */
(function () {
  'use strict';
  const B = window.Bookshop;
  const MAX_NPCS = 14;

  // ---------- owner activity control ----------
  B.startActivity = function (s, def, data, priority) {
    const o = s.owner;
    if (o.current) stopActivity(s, true);
    if (o.pose === 'sleep') o.emote('bang', 1.2);
    resetPose(o);
    o.currentDef = def;
    o.priority = priority == null ? def.priority || 1 : priority;
    o.data = data;
    o.lastId = def.id;
    if (def.cooldown) s.cooldowns[def.id] = s.simT + def.cooldown * B.STORY_MIN;
    o.current = new B.Script(def.run.call(def, s, o, data), { id: def.id });
    B.emit('activity', s, def.id);
  };

  function resetPose(o) {
    o.pose = 'stand';
    o.movePose = null;
    o.moving = false;
    o.hurry = false;
    o.exprOverride = null;
  }

  function stopActivity(s, aborted) {
    const o = s.owner;
    const def = o.currentDef;
    if (o.current && aborted) {
      o.current.abort();
      // important routines get retried after the interruption
      if (def && o.priority >= 3 && def.resume !== false && !o.pending.some((p) => p.def.id === def.id))
        o.pending.push({ def, data: o.data, priority: o.priority });
    }
    B.ownerCleanup(s);
    o.current = null;
    o.currentDef = null;
    o.priority = 0;
    o.data = null;
    resetPose(o);
  }

  /** Put down whatever the owner was holding when an activity ends or is interrupted. */
  B.ownerCleanup = function (s) {
    const o = s.owner;
    switch (o.holding) {
      case 'cup':
        s.counter.cup = true;
        break;
      case 'receiver':
        s.phone.offHook = false;
        break;
      case 'box':
        if (o.area === 'inside') s.boxes.push({});
        break;
      case 'books':
        s.shelves.add(5);
        break;
      default:
        break;
    }
    if (o.area !== 'street') o.holding = null;
    s.lamp = false;
    s.upstairs.tv = false;
    s.upstairs.kettle = 0;
    o.hidden = false;
    o.alpha = 1;
    o.pz = 0;
    o.climb = 0;
    o.backView = false;
    if (o.area === 'inside') o.depth = 'back';
  };

  B.requestOwner = function (s, id, priority, data) {
    const def = B.findDef('activity', id);
    if (!def || !B.isActive(def)) return false;
    const o = s.owner;
    if (o.area === 'away' && !def.fromAway) return false;
    if (def.area && def.area !== o.area) return false;
    priority = priority == null ? def.priority || 2 : priority;
    if (o.currentDef && o.currentDef.id === id) return true;
    if (o.pending.some((p) => p.def.id === id)) return true;
    if (!o.current || o.priority < priority) B.startActivity(s, def, data, priority);
    else o.pending.push({ def, data, priority });
    return true;
  };

  function pickIdle(s) {
    const o = s.owner;
    const acts = B.active('activity').filter((d) => {
      if (d.idle === false || !d.run) return false;
      if ((d.area || 'inside') !== o.area) return false;
      if ((s.cooldowns[d.id] || 0) > s.simT) return false;
      if (d.needsOpen && !s.shop.open) return false;
      try {
        return !d.when || d.when(s, o);
      } catch (e) {
        console.error('[bookshop] when() error', d.id, e);
        return false;
      }
    });
    const def = B.weighted(acts, (d) => {
      let w = B.val(d.weight == null ? 1 : d.weight, s, o);
      if (d.id === o.lastId) w *= 0.15;
      return w;
    });
    if (def) B.startActivity(s, def, null, def.priority || 1);
    else o.pauseT = 1;
  }

  function ownerStep(s, dt) {
    const o = s.owner;
    o.tickBase(dt);
    o.umbrellaUp = s.weather.rain > 0.35;
    if (o.area !== 'away') o.updateStats(dt, s);
    if (o.current) {
      if (o.current.update(dt, s)) {
        stopActivity(s, false);
        o.pauseT = B.rnd(0.4, 2) * (1.6 - o.energy);
      }
      return;
    }
    if (o.pending.length) {
      o.pending.sort((a, b) => b.priority - a.priority);
      const p = o.pending.shift();
      B.startActivity(s, p.def, p.data, p.priority);
      return;
    }
    if (o.area !== 'inside' && o.area !== 'upstairs') return;
    if (o.pauseT > 0) {
      o.pauseT -= dt;
      return;
    }
    pickIdle(s);
  }

  // ---------- daily routine ----------
  function schedule(s) {
    const C = B.config;
    const h = s.hour;
    const o = s.owner;
    const f = s.flags;
    if (o.area === 'away' && !f.arrived && h >= C.arriveHour && h < C.closeHour - 0.25) {
      f.arrived = true;
      s.request('arrive', 6);
    }
    if (o.area === 'upstairs' && !f.bed && (h >= C.bedHour || h < 6)) s.request('go-to-bed', 3);
    if (o.area !== 'inside') return;
    if (!s.shop.open && !f.opened && h >= C.openHour && h < C.closeHour) s.request('open-shop', 3);
    if (s.shop.open && h >= C.closeHour) s.request('close-shop', 3);
    if (
      !s.shop.open && f.closed && !f.left && h >= C.closeHour + 0.2 &&
      (!f.lateUntil || h >= f.lateUntil) && s.customersInside() === 0 && !s.queue.length
    )
      s.request('go-home', 3);
  }

  // ---------- street ----------
  function streetFactor(h) {
    if (h < 6) return 0.08;
    if (h < 7.5) return 0.3;
    if (h < 9.5) return 1.3;
    if (h < 12) return 0.9;
    if (h < 14) return 1.25;
    if (h < 17) return 0.9;
    if (h < 19) return 1.2;
    if (h < 22) return 0.5;
    return 0.15;
  }

  B.spawn = function (s, id, opts = {}) {
    const def = typeof id === 'string' ? B.findDef('visitor', id) : id;
    if (!def) return null;
    const fromLeft = opts.fromLeft != null ? opts.fromLeft : def.fromLeft != null ? def.fromLeft : B.chance(0.5);
    const n = new B.NPC({
      x: fromLeft ? B.LAYOUT.edgeL : B.LAYOUT.edgeR,
      dir: fromLeft ? 1 : -1,
      exitX: fromLeft ? B.LAYOUT.edgeR + 2 : B.LAYOUT.edgeL - 2,
      lane: B.irnd(-3, 5),
      speed: B.rnd(36, 54),
      kind: def.id,
      umbrella: B.chance(0.85),
      umbrellaC: B.pick(B.lookParts.umbrella),
    });
    const look = def.look;
    n.look = look ? (typeof look === 'string' ? B.looks[look] : B.val(look, s, n)) : B.randomLook();
    if (def.setup) def.setup.call(def, n, s);
    Object.assign(n, opts.props || {});
    n.script = new B.Script(def.run.call(def, s, n), { id: def.id });
    s.npcs.push(n);
    return n;
  };

  function npcStep(s, dt) {
    const showBrolly = s.weather.rain > 0.35;
    for (const n of s.npcs) {
      n.tickBase(dt);
      n.umbrellaUp = showBrolly;
      if (n.script && n.script.update(dt, s)) {
        n.script = null;
        const visible = n.area === 'inside' || (n.x > B.LAYOUT.edgeL + 1 && n.x < B.LAYOUT.edgeR - 1);
        if (!n.leaving && visible) {
          n.leaving = true;
          n.script = new B.Script(n.leave(s), { id: 'leave' });
        } else n.remove = true;
      }
      if (n.dog) {
        const target = n.x - 20 * (n.dir || 1);
        const d = target - n.dog.x;
        n.dog.moving = Math.abs(d) > 0.4;
        n.dog.x += d * Math.min(1, dt * 5);
        n.dog.y = B.LAYOUT.streetY + n.lane + 2;
        if (n.dog.sniff > 0) n.dog.sniff -= dt;
      }
    }
    s.npcs = s.npcs.filter((n) => {
      if (!n.remove) return true;
      const qi = s.queue.indexOf(n);
      if (qi >= 0) s.queue.splice(qi, 1);
      return false;
    });
  }

  function rollSpawns(s, dt) {
    const crowd = B.config.crowd == null ? 1 : B.config.crowd;
    if (crowd <= 0 || s.npcs.length >= Math.round(MAX_NPCS * Math.max(1, crowd * 0.8))) return;
    const rain = s.weather.rain > 0.5 ? 0.65 : 1;
    const rate = (B.config.pedestriansPerHour * crowd * streetFactor(s.hour) * rain) / B.STORY_HOUR;
    if (Math.random() >= rate * dt) return;
    const defs = B.active('visitor').filter((v) => v.spawn !== false && (!v.when || v.when(s)));
    const def = B.weighted(defs, (v) => B.val(v.weight == null ? 1 : v.weight, s));
    if (def) B.spawn(s, def);
  }

  function rollHappenings(s, dt) {
    for (const h of B.active('happening')) {
      if (!h.perHour) continue;
      if ((s.cooldowns['h:' + h.id] || 0) > s.simT) continue;
      if (!h.overlap && s.scripts.some((sc) => sc.meta.id === h.id)) continue;
      const p = (B.val(h.perHour, s) * dt) / B.STORY_HOUR;
      if (Math.random() >= p) continue;
      try {
        if (h.when && !h.when(s)) continue;
      } catch (e) {
        console.error('[bookshop] happening when()', h.id, e);
        continue;
      }
      B.trigger(s, h.id);
    }
  }

  /** Start a happening now (also handy from the console: Bookshop.trigger(Bookshop.world, 'phone-ring')). */
  B.trigger = function (s, id) {
    const h = B.findDef('happening', id);
    if (!h) return false;
    if (h.cooldown) s.cooldowns['h:' + h.id] = s.simT + h.cooldown * B.STORY_MIN;
    s.scripts.push(new B.Script(h.run.call(h, s), { id: h.id }));
    return true;
  };

  function scriptsStep(s, dt) {
    s.scripts = s.scripts.filter((sc) => !sc.update(dt, s));
  }

  // ---------- main tick ----------
  function step(s, dt) {
    s.simT += dt;
    if (s.mode === 'live') {
      const d = new Date();
      const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
      let t = Math.floor(s.time / 1440) * 1440 + mins;
      if (t < s.time - 720) t += 1440;
      s.time = Math.max(s.time, t);
    } else s.time += dt * B.config.clockRate;
    const day = Math.floor(s.time / 1440);
    if (day !== s.day) B.newDay(s, day);

    schedule(s);
    ownerStep(s, dt);
    npcStep(s, dt);
    scriptsStep(s, dt);
    rollHappenings(s, dt);
    rollSpawns(s, dt);
    B.updateProps(s, dt);
    B.emit('tick', s, dt);
  }

  B.tick = function (s, dtReal) {
    const o = s.owner;
    s.ff = s.mode === 'story' && o.area === 'away' && !o.current ? B.config.nightSpeed : 1;
    const sim = dtReal * s.speed * s.ff;
    if (sim <= 0) return;
    const n = Math.max(1, Math.ceil(sim / 0.1));
    const h = sim / n;
    for (let i = 0; i < n; i++) step(s, h);
  };
})();
