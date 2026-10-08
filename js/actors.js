/* Actors: the owner and everyone who wanders past. Actor methods return actions for scripts. */
(function () {
  'use strict';
  const B = window.Bookshop;
  let ids = 0;

  class Actor {
    constructor(o) {
      this.id = ++ids;
      this.x = 0;
      this.area = 'street'; // 'street' | 'inside' | 'away'
      this.lane = 0; // street depth offset (px)
      this.depth = 'front'; // inside: 'back' (behind counter) | 'front'
      this.dir = 1; // -1 left, 0 facing us, 1 right
      this.pose = 'stand';
      this.movePose = null; // pose to use while walking (e.g. 'sweep')
      this.moving = false;
      this.t = Math.random() * 10;
      this.walkT = 0;
      this.holding = null;
      this.emoteKind = null;
      this.emoteT = 0;
      this.blinkT = B.rnd(1, 4);
      this.blinking = 0;
      this.speed = 44;
      this.alpha = 1;
      this.hidden = false;
      this.look = B.looks.default;
      this.name = '';
      Object.assign(this, o);
    }
    get y() {
      const L = B.LAYOUT;
      if (this.area === 'street') return L.streetY + this.lane;
      if (this.area === 'upstairs') return L.upstairsY;
      return this.depth === 'back' ? L.backY : L.frontY;
    }
    walkSpeed() {
      return this.speed;
    }
    /** Facial expression: poses first, then whatever their speech bubble says, then mood. */
    expr() {
      if (this.pose === 'sleep') return 'closed';
      if (this.pose === 'stretch') return 'yawn';
      if (this.exprOverride) return this.exprOverride;
      const e = this.emoteKind && EMOTE_FACE[this.emoteKind];
      if (e) return e;
      return this.moodFace();
    }
    moodFace() {
      return this.mood_ || 'neutral';
    }
    tickBase(dt) {
      this.t += dt;
      // time since the pose last changed (one-shot, keyframed moves start from 0)
      if (this.pose !== this._lp) {
        this._lp = this.pose;
        this.poseT = 0;
      }
      this.poseT = (this.poseT || 0) + dt;
      if (this.emoteT > 0) {
        this.emoteT -= dt;
        if (this.emoteT <= 0) this.emoteKind = null;
      }
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinking = 0.13;
        this.blinkT = B.rnd(2, 5);
      }
      if (this.blinking > 0) this.blinking -= dt;
    }

    // ----- actions (yield these from scripts) -----
    walkTo(x, opts = {}) {
      const a = this;
      return {
        update(dt) {
          const sp = a.walkSpeed() * (opts.speed || 1);
          const d = x - a.x;
          if (Math.abs(d) <= sp * dt + 0.01) {
            a.x = x;
            a.moving = false;
            return true;
          }
          a.dir = Math.sign(d);
          a.backView = false;
          a.x += a.dir * sp * dt;
          a.moving = true;
          a.walkT += dt * (sp / 45);
          return false;
        },
        abort() {
          a.moving = false;
        },
      };
    }
    hold(pose, sec) {
      const a = this;
      let t = 0;
      let started = false;
      return {
        update(dt) {
          if (!started) {
            a.pose = pose;
            started = true;
          }
          t += dt;
          if (t >= sec) {
            a.pose = 'stand';
            return true;
          }
          return false;
        },
        abort() {
          a.pose = 'stand';
        },
      };
    }
    emote(kind, sec = 2.2) {
      this.emoteKind = kind;
      this.emoteT = sec;
    }
    /** Which way to look: -1 / 1 side-on (the natural default), 'side' (either side, keeping the
     *  current one if already side-on), 'away' (back to the window, e.g. at shelves or machines),
     *  or 0 — towards the window/viewer, best kept for moments that really are about looking out. */
    face(d) {
      if (d === 'away') {
        this.backView = true;
        return;
      }
      this.backView = false;
      if (d === 'side') d = this.dir ? this.dir : B.pick([-1, 1]);
      this.dir = d;
    }
    faceX(x) {
      this.backView = false;
      this.dir = x >= this.x ? 1 : -1;
    }
    *enter(s) {
      yield this.walkTo(B.LAYOUT.doorX);
      yield s.door.pass(this, 'in');
    }
    *exit(s) {
      yield this.walkTo(B.LAYOUT.inDoorX);
      yield s.door.pass(this, 'out');
    }
    fade(to, sec = 0.7) {
      const a = this;
      return {
        update(dt) {
          const step = dt / sec;
          a.alpha = to > a.alpha ? Math.min(to, a.alpha + step) : Math.max(to, a.alpha - step);
          return a.alpha === to;
        },
      };
    }
    // ---- the passage at the back of the shop (under the POETRY sign) ----
    // It runs back from the shop and turns left (to the back rooms) and right (past the foot of the
    // stairs up to Mabel's flat). People walk away into it (getting smaller), turn, and walk off
    // sideways out of sight; `stairs` has them climb the stairs as they go.
    /** Walk into the passage, turn to `side` (-1 left, 1 right) and out of sight. */
    *intoPassage(s, side = -1, stairs = false) {
      const A = B.LAYOUT.arch;
      const cx = Math.round(A.x + A.w / 2);
      if (this.depth !== 'passage') this._prevDepth = this.depth;
      yield this.walkTo(cx);
      this.depth = 'passage';
      this.pz = 0;
      this.climb = 0;
      yield passageDepth(this, 1); // recede, back to us
      this.face(side);
      yield passageSide(this, side > 0 ? A.x + A.w + 12 : A.x - 12, stairs);
      this.moving = false;
      this.hidden = true;
    }
    /** Come back out of the passage from `side` (down the stairs if `stairs`), towards the shop. */
    *outOfPassage(s, side = -1, stairs = false) {
      const A = B.LAYOUT.arch;
      const cx = Math.round(A.x + A.w / 2);
      if (this.depth !== 'passage') this._prevDepth = this.depth;
      this.depth = 'passage';
      this.hidden = false;
      this.alpha = 1;
      this.pz = 1;
      this.x = side > 0 ? A.x + A.w + 12 : A.x - 12;
      this.climb = stairs ? 1 : 0;
      yield passageSide(this, cx, stairs);
      this.face(0);
      yield passageDepth(this, 0); // walk forward, towards us
      this.depth = this._prevDepth || (this instanceof Owner ? 'back' : 'front');
      this.pz = 0;
      this.climb = 0;
    }
    /** A trip into the unseen back rooms for `sec` seconds. */
    *backRoom(s, sec, side = B.pick([-1, 1])) {
      yield* this.intoPassage(s, side, false);
      yield sec;
      yield* this.outOfPassage(s, side, false);
    }
  }

  /** Action: walk deeper into (pz → 1) or out of (pz → 0) the passage, at walking pace. */
  function passageDepth(a, to) {
    return {
      update(dt) {
        const step = dt / 1.1;
        a.pz = to > a.pz ? Math.min(to, a.pz + step) : Math.max(to, a.pz - step);
        a.moving = true;
        a.backView = to > 0; // walking away shows their back
        a.walkT += dt * 0.7;
        if (a.pz !== to) return false;
        a.moving = false;
        a.backView = false;
        return true;
      },
      abort() {
        a.moving = false;
        a.backView = false;
      },
    };
  }
  /** Action: walk sideways along the far end of the passage (climbing the stairs on the right). */
  function passageSide(a, x, stairs) {
    const A = B.LAYOUT.arch;
    const foot = A.x + A.w / 2 + 2; // where the bottom step is
    const top = A.x + A.w + 12;
    return {
      update(dt) {
        const d = x - a.x;
        const sp = 24 * dt;
        a.moving = true;
        a.dir = Math.sign(d) || a.dir;
        a.walkT += dt * 0.6;
        a.x = Math.abs(d) <= sp ? x : a.x + Math.sign(d) * sp;
        a.climb = stairs ? B.clamp((a.x - foot) / (top - foot), 0, 1) : 0;
        if (a.x !== x) return false;
        a.moving = false;
        return true;
      },
      abort() {
        a.moving = false;
      },
    };
  }

  const EMOTE_FACE = {
    heart: 'smitten', angry: 'angry', bang: 'surprised', what: 'puzzled', rain: 'sad', sigh: 'sad',
    sweat: 'worried', spark: 'laugh', happy: 'happy', note: 'happy', zzz: 'tired', coffee: 'happy',
    coin: 'happy', sun: 'happy', book: 'happy', dots: 'neutral',
  };

  class NPC extends Actor {
    constructor(o) {
      super(Object.assign({ depth: 'front' }, o));
      if (!this.mood_) this.mood_ = B.pick(['neutral', 'neutral', 'happy']);
    }
    walkSpeed() {
      return this.speed * (this.hurry ? 1.6 : 1);
    }
    walkOff() {
      return this.walkTo(this.exitX);
    }
    *leave(s) {
      if (this.area === 'inside') yield* this.exit(s);
      yield this.walkOff();
    }
    /** Browse the shelves `stops` times. */
    *browse(s, stops = B.irnd(1, 3)) {
      for (let i = 0; i < stops; i++) {
        yield this.walkTo(B.shelfX());
        yield this.hold('browse', B.rnd(3, 7));
        if (B.chance(0.25)) this.emote(B.pick(['spark', 'what', 'heart', 'book']), 1.6);
      }
    }
    /** Queue at the till until served (true) or patience runs out (false). */
    *payAtTill(s, patience = 45) {
      s.queue.push(this);
      this.served = false;
      s.request('serve', 5);
      let waited = 0;
      let fretted = false;
      while (!this.served && waited < patience) {
        const i = Math.max(0, s.queue.indexOf(this));
        const want = B.LAYOUT.spots.custTill + i * 18;
        if (Math.abs(this.x - want) > 0.5) yield this.walkTo(want);
        this.face(-1);
        yield 0.5;
        waited += 0.5;
        if (waited > patience * 0.45 && !fretted) {
          fretted = true;
          this.emote('sweat');
          s.request('serve', 5);
        }
      }
      const qi = s.queue.indexOf(this);
      if (qi >= 0) s.queue.splice(qi, 1);
      return this.served;
    }
  }

  class Owner extends Actor {
    constructor() {
      super({
        name: B.config.owner.name,
        look: B.looks[B.config.owner.look] || B.looks.default,
        area: 'away',
        depth: 'back',
        lane: 1,
        umbrella: true,
        umbrellaC: '#2e5249',
      });
      this.energy = 0.9;
      this.mood = 0.6;
      this.caffeine = 0.1;
      this.baseline = 0.55;
      this.current = null;
      this.currentDef = null;
      this.priority = 0;
      this.pending = [];
      this.pauseT = 0;
      this.lastId = null;
      this.hurry = false;
      this.exprOverride = null;
    }
    walkSpeed() {
      let sp = 32 + 40 * this.energy + 35 * Math.max(0, this.caffeine - 0.35) + (this.mood - 0.5) * 20;
      if (this.hurry) sp *= 1.55;
      return B.clamp(sp, 20, 105);
    }
    get slump() {
      return this.energy < 0.28 || this.mood < 0.28;
    }
    get happy() {
      return this.mood > 0.7 && this.energy > 0.35;
    }
    get jitter() {
      return this.caffeine > 0.85;
    }
    moodFace() {
      if (this.mood > 0.64) return 'happy';
      if (this.mood < 0.34) return 'sad';
      if (this.energy < 0.22) return 'tired';
      return 'neutral';
    }
    /** Walk to a named spot (see B.LAYOUT.spots) or an x position. */
    go(spot, opts) {
      const x = typeof spot === 'number' ? spot : B.LAYOUT.spots[spot];
      return this.walkTo(x == null ? this.x : x, opts);
    }
    adjust(k, v) {
      this[k] = B.clamp(this[k] + v, 0, 1);
    }
    moodUp(v) {
      this.adjust('mood', v);
    }
    moodDown(v) {
      this.adjust('mood', -v);
    }
    updateStats(dt, s) {
      const hrs = dt / B.STORY_HOUR;
      const asleep = this.pose === 'sleep';
      this.energy += (asleep ? 0.9 : -0.085) * hrs;
      const burn = Math.min(this.caffeine, 0.3 * hrs);
      this.caffeine -= burn;
      this.energy += burn * 0.9;
      this.mood += (this.baseline - this.mood) * 0.12 * hrs;
      if (s.radio.on) this.mood += (s.radio.station.likes || 0) * 0.08 * hrs;
      if (s.weather.rain > 0.5) this.mood -= 0.025 * hrs;
      this.energy = B.clamp(this.energy, 0, 1);
      this.mood = B.clamp(this.mood, 0, 1);
      this.caffeine = B.clamp(this.caffeine, 0, 1);
    }
  }

  B.Actor = Actor;
  B.NPC = NPC;
  B.Owner = Owner;

  // ---------- random passer-by appearance ----------
  B.lookParts = {
    skin: ['#f1c7a5', '#e0ac85', '#c68a62', '#9a6445', '#6e4630', '#f6d6bd'],
    hair: ['#2b1d14', '#4a3021', '#7a4a26', '#b07a3c', '#d8b36a', '#9a9a9a', '#e6e2da', '#a3432a', '#1b1b22'],
    hairStyle: ['short', 'short', 'long', 'bob', 'curly', 'bald', 'ponytail', 'spiky', 'bun'],
    top: ['#3b5b8c', '#8c3b3b', '#3c7a4b', '#c9a13b', '#6a4c93', '#d9d2c3', '#2f3e46', '#c26a3a', '#4f7c8a', '#9c5b7a'],
    bottom: ['#2c3440', '#3d3a35', '#5a4632', '#1f2a44', '#6b6f76', '#7a3434'],
    hat: ['#2f3e46', '#7a3434', '#c9a13b', '#3c7a4b', '#4a3021'],
    umbrella: ['#2f3e46', '#b33a3a', '#3b5b8c', '#c9a13b', '#3c7a4b', '#6a4c93'],
    dog: ['#8a5a34', '#2b2622', '#d9c9a0', '#6b6f76', '#b07a3c'],
  };
  B.randomLook = (over) => {
    const P = B.lookParts;
    const l = {
      skin: B.pick(P.skin),
      hair: B.pick(P.hair),
      hairStyle: B.pick(P.hairStyle),
      top: B.pick(P.top),
      bottom: B.pick(P.bottom),
      h: B.irnd(-1, 2),
    };
    if (B.chance(0.3)) {
      l.dress = true;
      l.bottom = B.pick(P.top);
      l.tights = B.chance(0.5) ? '#2b2622' : null;
    }
    if (B.chance(0.2)) l.glasses = true;
    if (B.chance(0.18)) {
      l.hat = B.pick(P.hat);
      l.hatStyle = B.pick(['cap', 'beanie', 'flat', 'bowler']);
    }
    if (B.chance(0.15)) l.scarf = B.pick(P.top);
    if (B.chance(0.12) && l.hairStyle !== 'long') l.beard = l.hair;
    return Object.assign(l, over);
  };
})();
