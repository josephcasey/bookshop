/* 2026-10-06 (telly update)
 * Mabel's television shows real programmes. A show is content, like a radio station:
 *
 *   Bookshop.show({
 *     id, name, genre, color, likes (-1..1, how much Mabel enjoys it),
 *     setup() {},                 // once: define its sounds with B.audio.define(...) on the `tv` bus
 *     scenes: [{ id, dur, caption, react, sub, cues: [[sec, 'sound-name' | fn]], draw(g, t, k) }],
 *   })
 *
 * Scenes play in order and the episode loops. Each scene's draw() paints a 64x48 picture (t = seconds into the
 * scene, k = t / dur). Cues fire as the episode passes their time. `react` is a bubble Mabel shows at that moment;
 * `sub` is a subtitle shown under the picture. Click the left upstairs window (or press T) to watch close up. */
(function (B) {
  const TW = 64;
  const TH = 48;
  const name = () => B.ownerName();
  const U = () => B.LAYOUT.upstairsSpots;

  let frame = null;
  let fg = null;
  const ensure = () => {
    if (frame) return;
    frame = document.createElement('canvas');
    frame.width = TW;
    frame.height = TH;
    fg = frame.getContext('2d');
    if (fg) fg.imageSmoothingEnabled = false;
  };
  const prepared = new Set();
  const shows = () => B.active('show').filter((sh) => sh.scenes && sh.scenes.length);
  const length = (sh) => sh.scenes.reduce((n, sc) => n + sc.dur, 0);
  /** Which scene is on at episode time t, and how far into it. */
  function at(sh, t) {
    let r = t % length(sh);
    for (let i = 0; i < sh.scenes.length; i++) {
      const sc = sh.scenes[i];
      if (r < sc.dur) return { sc, i, t: r };
      r -= sc.dur;
    }
    return { sc: sh.scenes[0], i: 0, t: 0 };
  }

  const tv = (B.tv = {
    W: TW,
    H: TH,
    shows,
    show(s) {
      const U2 = s.upstairs;
      return shows().find((sh) => sh.id === U2.show) || shows()[0] || null;
    },
    now(s) {
      const sh = tv.show(s);
      return sh ? Object.assign({ show: sh }, at(sh, s.upstairs.tvT || 0)) : null;
    },
    /** Paint the current picture into the 64x48 frame and return it (null when the set is off). */
    frame(s) {
      if (!s.upstairs.tv) return null;
      ensure();
      if (!fg) return null;
      const n = tv.now(s);
      fg.clearRect(0, 0, TW, TH);
      if (!n) {
        for (let i = 0; i < 300; i++) B.px(fg, Math.random() < 0.5 ? '#ddd' : '#333', Math.floor(Math.random() * TW), Math.floor(Math.random() * TH));
        return frame;
      }
      try {
        n.sc.draw(fg, n.t, n.t / n.sc.dur, s);
      } catch (e) {
        console.error('[bookshop] tv scene', n.show.id, n.sc.id, e);
      }
      return frame;
    },
    /** The viewer picks a programme: Mabel switches over (or settles down to watch it, if she's home). */
    choose(s, id) {
      const U2 = s.upstairs;
      if (U2.show !== id) {
        U2.show = id;
        U2.tvT = 0;
        U2.lastScene = -1;
      }
      U2.chosenUntil = s.simT + 2 * B.STORY_HOUR;
      const o = s.owner;
      if (U2.tv) {
        B.audio.play('tv-click');
        const sh = tv.show(s);
        if (sh) B.log(`Over to ${sh.name}.`);
        return 'switched';
      }
      if (o.area === 'upstairs' && s.request('watch-tv', 2.5)) return 'mabel';
      return 'later';
    },
  });

  /** Draw the picture onto the set in the flat (called by the themes' drawUpstairs). */
  B.tvScreen = function (g, x, y, w, h, s) {
    const f = tv.frame(s);
    B.tvRect = f ? { x, y, w, h } : null; // (so the window's reflection can let the bright picture through)
    if (!f) return false;
    g.save();
    g.imageSmoothingEnabled = true; // average the picture down, like a small screen across the street would
    g.drawImage(f, x, y, w, h);
    g.restore();
    g.imageSmoothingEnabled = false;
    return true;
  };

  // In the neon city the flat's lit rooms after dark are capped at about the fascia neon's brightness and lean toward
  // the telly's colour, so the picture is the brightest thing up there; a room lit only by the set is dim but for it.
  B.decor({
    id: 'flat-exposure',
    layer: 'overlay',
    draw(g, s) {
      if (B.theme !== 'cyber' || !B.sunPos || B.sunPos(s.hour).e > -2) return;
      const U2 = s.upstairs;
      if (!U2.light && !U2.tv) return;
      const n = tv.now(s);
      const tint = U2.tv && n && n.show && n.show.color ? n.show.color : '#8a7aa8';
      g.save();
      g.beginPath();
      for (const u of B.LAYOUT.upstairs) g.rect(u.x, u.y, u.w, u.h);
      if (U2.tv && B.tvRect) g.rect(B.tvRect.x, B.tvRect.y, B.tvRect.w, B.tvRect.h); // (even-odd: the screen is left alone)
      g.clip('evenodd');
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = U2.light ? 0.45 : 0.75;
      g.fillStyle = B.mix('#7a6a98', tint, 0.35);
      g.fillRect(0, 0, 320, 60);
      g.restore();
    },
  });

  // ---------- running the programme ----------
  let lastReal = 0;
  B.on('tick', (s) => {
    const U2 = s.upstairs;
    const now = performance.now() / 1000;
    const dt = lastReal ? Math.max(0, Math.min(0.25, now - lastReal)) : 0; // real time: episodes don't race at 10x
    lastReal = now;
    if (!U2.tv) return;
    const sh = tv.show(s);
    if (!sh) return;
    if (!prepared.has(sh.id) && sh.setup) {
      prepared.add(sh.id);
      try {
        sh.setup();
      } catch (e) {
        console.error('[bookshop] show setup', sh.id, e);
      }
    }
    const before = at(sh, U2.tvT || 0);
    U2.tvT = (U2.tvT || 0) + dt;
    const n = at(sh, U2.tvT);
    const fresh = n.i !== U2.lastScene;
    if (fresh) {
      U2.lastScene = n.i;
      const o = s.owner;
      const watching = o.currentDef && o.currentDef.id === 'watch-tv' && o.pose !== 'sleep';
      if (watching && n.sc.react) o.emote(n.sc.react, 1.6);
      if (watching && n.sc.log && B.chance(0.5)) B.log(n.sc.log.replace('{name}', name()));
      B.emit('tv-scene', s, sh, n.sc);
    }
    // fire cues between the last time and now
    const from = fresh ? -0.001 : before.t;
    for (const [time, cue] of n.sc.cues || []) {
      if (time > from && time <= n.t) {
        try {
          if (typeof cue === 'function') cue(s);
          else B.audio.play(cue);
        } catch (e) {
          console.error('[bookshop] tv cue', e);
        }
      }
    }
  });

  B.audio.define('tv-click', ({ tone, tv: bus }) => tone(1800, 0.03, { type: 'square', vol: 0.05, bus }));

  // ---------- Mabel's telly evenings ----------
  B.activity({
    id: 'watch-tv',
    *run(s, o) {
      const U2 = s.upstairs;
      try {
        yield o.go(U().chair);
        o.face(1);
        o.pose = 'sit';
        // her pick, unless the viewer has just chosen something
        if (!((U2.chosenUntil || 0) > s.simT)) {
          const list = shows();
          // a programme can insist (a new episode she hasn't seen through yet); otherwise her tastes decide
          const fav = list.find((sh) => sh.preferred && sh.preferred(s)) || (B.weighted ? B.weighted(list, (sh) => 0.3 + Math.max(0, sh.likes || 0)) : B.pick(list));
          if (fav && fav.id !== U2.show) {
            U2.show = fav.id;
            U2.tvT = 0;
            U2.lastScene = -1;
          }
        }
        U2.tv = true;
        const sh = tv.show(s);
        B.log(sh ? `${name()} settles into her armchair for ${sh.name}.` : `${name()} settles into her armchair in front of the telly.`);
        const dur = B.rnd(30, 60);
        let t = 0;
        // a programme with an end of its own (a real video) is watched to the end; otherwise half a minute or so
        const more = () => {
          const cur = tv.show(s);
          return cur && cur.untilEnd ? t < 8 || cur.untilEnd(s) : t < dur;
        };
        while (more()) {
          yield 2;
          t += 2;
          if (o.energy < 0.3 && B.chance(0.06)) {
            o.pose = 'sleep';
            B.log(`${name()} dozes off in front of the television.`);
            yield B.rnd(10, 20);
            o.pose = 'sit';
            o.emote('bang', 1.2);
          }
        }
      } finally {
        U2.tv = false;
      }
    },
  });
})(window.Bookshop);
