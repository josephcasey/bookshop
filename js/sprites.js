/* Characters (≈60px tall) and dogs. Each sprite is painted into a small buffer, then stamped
 * onto the scene with a 1px dark outline. Faces follow the actor's expression (a.expr()),
 * which in turn follows their emote bubble or mood. */
(function () {
  'use strict';
  const B = window.Bookshop;

  const BW = 72;
  const BH = 112;
  const OX = 36; // buffer x of the feet centre
  const OY = 104; // buffer y of the feet
  const OUTLINE = '#120c14';
  let buf, bg, tint, tg;

  function ensure() {
    if (buf) return;
    buf = document.createElement('canvas');
    buf.width = BW;
    buf.height = BH;
    bg = buf.getContext('2d');
    tint = document.createElement('canvas');
    tint.width = BW;
    tint.height = BH;
    tg = tint.getContext('2d');
  }

  /** Paint via fn(g, ox, oy) into the buffer and stamp it at (x, y) with an outline. */
  B.blit = function (g, x, y, fn, alpha = 1) {
    ensure();
    bg.clearRect(0, 0, BW, BH);
    fn(bg, OX, OY);
    if (alpha <= 0) return;
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, BW, BH);
    tg.drawImage(buf, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = OUTLINE;
    tg.fillRect(0, 0, BW, BH);
    tg.globalCompositeOperation = 'source-over';
    const dx = Math.round(x) - OX;
    const dy = Math.round(y) - OY;
    g.save();
    // a soft edge rather than an ink outline: just enough to lift a figure off a busy background
    g.globalAlpha = alpha * 0.4;
    g.drawImage(tint, dx - 1, dy);
    g.drawImage(tint, dx + 1, dy);
    g.globalAlpha = alpha * 0.25;
    g.drawImage(tint, dx, dy - 1);
    g.drawImage(tint, dx, dy + 1);
    g.globalAlpha = alpha;
    g.drawImage(buf, dx, dy);
    g.restore();
  };

  /** A person's solid silhouette, stretched by (sx, sy) from their feet at (x, feetY): for cast shadows. */
  B.drawSilhouette = function (g, a, x, feetY, sx = 1, sy = 1) {
    ensure();
    bg.clearRect(0, 0, BW, BH);
    paintPerson(bg, a, OX, OY);
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, BW, BH);
    tg.drawImage(buf, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#000';
    tg.fillRect(0, 0, BW, BH);
    tg.globalCompositeOperation = 'source-over';
    g.drawImage(tint, 0, 0, BW, BH, Math.round(x - OX * sx), Math.round(feetY - OY * sy), Math.round(BW * sx), Math.round(BH * sy));
  };

  // ---------- lighting ----------
  // Painterly pixel art: no hard outlines on the forms themselves, every surface lit from the upper left with a warm
  // (classic) or cool (neon) key light, and shadows tinted by the ambient colour rather than just darkened.
  const toneCache = new Map();
  const AMB = () => (B.theme === 'cyber' ? '#1a1236' : '#3b2a3a');
  const KEY = () => (B.theme === 'cyber' ? '#d6ecff' : '#fff0c8');
  /** c lit at level k: -2 deep shadow, -1 shadow, 0 as is, 1 highlight, 2 strong highlight. */
  function lit(c, k) {
    if (!k || !c || c[0] !== '#') return c;
    const key = c + k + B.theme;
    let v = toneCache.get(key);
    if (v) return v;
    if (k < 0) v = B.mix(B.shade(c, k === -1 ? 0.78 : 0.6), AMB(), k === -1 ? 0.2 : 0.32);
    else v = B.mix(B.shade(c, k === 1 ? 1.16 : 1.32), KEY(), k === 1 ? 0.12 : 0.22);
    toneCache.set(key, v);
    return v;
  }
  B.litTone = lit;
  const weave = (c) => {
    const key = c + 'w' + B.theme;
    let v = toneCache.get(key);
    if (!v) toneCache.set(key, (v = c[0] === '#' ? B.mix(c, lit(c, -1), 0.5) : c));
    return v;
  };

  // ---------- hair & hat templates ----------
  // Spans [y, x1, x2, kind?] in head-local coords (the head is x 0..7, y 0..8), written facing right for `side`
  // and mirrored for facing left. kind: 's' shadow, 'h' highlight, 'x' second colour.
  const range = (y0, y1, x1, x2, k) => {
    const r = [];
    for (let y = y0; y <= y1; y++) r.push([y, x1, x2, k]);
    return r;
  };
  const S_FRONT = [[-1, 1, 6], [0, 0, 7], [0, 1, 3, 'h'], [1, 0, 7], [1, 1, 2, 'h'], [2, 0, 0], [2, 7, 7], [3, 0, 0], [3, 7, 7]];
  const S_SIDE = [[-1, 1, 5], [0, 0, 6], [0, 2, 4, 'h'], [1, -1, 6], [2, -1, 3], [3, -1, 1], [4, -1, 1], [5, 0, 1], [4, 2, 2, 's']];
  const S_BACK = (bottom) => [[-1, 1, 6], [0, 0, 7], [0, 2, 4, 'h'], ...range(1, bottom, 0, 7), [bottom + 1, 1, 6, 's']];
  const HAIR = {
    short: { front: S_FRONT, side: S_SIDE, back: S_BACK(5) },
    long: {
      front: [...S_FRONT, ...range(2, 12, -1, 0), ...range(2, 12, 7, 8), [12, -1, 0, 's'], [12, 7, 8, 's']],
      side: [...S_SIDE, ...range(2, 12, -2, 2), [12, -2, 1, 's']],
      back: [[-1, 1, 6], [0, 0, 7], [0, 2, 4, 'h'], ...range(1, 12, -1, 8), [13, 0, 7, 's']],
    },
    bob: {
      front: [...S_FRONT, [2, 1, 5], ...range(2, 7, -1, 0), ...range(2, 7, 7, 8), [7, -1, 0, 's'], [7, 7, 8, 's']],
      side: [...S_SIDE, [2, 4, 6], ...range(2, 7, -2, 3), [7, -2, 2, 's']],
      back: [[-1, 1, 6], [0, 0, 7], ...range(1, 7, -1, 8), [8, 0, 7, 's']],
    },
    curly: {
      texture: 2,
      front: [[-2, 1, 6], ...range(-1, 1, -1, 8), [2, -1, 1], [2, 6, 8], [3, -1, 0], [3, 7, 8], [4, -1, 0], [4, 7, 8], [5, -1, -1], [5, 8, 8]],
      side: [[-2, 0, 5], ...range(-1, 1, -2, 7), [2, -2, 3], ...range(3, 5, -2, 2), [6, -1, 1]],
      back: [[-2, 1, 6], ...range(-1, 6, -1, 8), [7, 0, 7]],
    },
    bald: {
      front: [[3, 0, 0], [3, 7, 7], [4, 0, 0], [4, 7, 7]],
      side: [...range(3, 5, 0, 2)],
      back: [...range(3, 6, 0, 7)],
    },
    bun: {
      front: [[0, 1, 6], [0, 2, 4, 'h'], [1, 0, 7], [2, 0, 0], [2, 7, 7], [3, 0, 0], [3, 7, 7], [-3, 2, 5], [-2, 2, 5], [-3, 3, 3, 'h'], [-1, 3, 4, 's']],
      side: [[0, 0, 5], [0, 2, 3, 'h'], [1, -1, 5], [2, -1, 2], [3, -1, 1], [4, -1, 0], [-2, -2, 1], [-1, -3, 1], [0, -3, -1], [-2, -1, 0, 'h']],
      back: [[0, 1, 6], ...range(1, 5, 0, 7), [6, 1, 6, 's'], [-3, 2, 5], [-2, 2, 5], [-1, 3, 4, 's'], [-3, 3, 3, 'h']],
    },
    ponytail: {
      front: S_FRONT,
      side: [...S_SIDE, [1, -2, -2], ...range(2, 9, -3, -2), [10, -3, -3]],
      back: [...S_BACK(5), ...range(6, 11, 3, 4), [12, 3, 4, 's']],
    },
    spiky: {
      front: [...S_FRONT, [-2, 1, 1], [-2, 3, 4], [-2, 6, 6], [-3, 3, 3]],
      side: [...S_SIDE, [-2, 0, 0], [-2, 2, 3], [-2, 5, 5], [-3, 2, 2]],
      back: [...S_BACK(5), [-2, 1, 1], [-2, 3, 4], [-2, 6, 6]],
    },
  };
  const HATS = {
    cap: {
      front: [[-2, 0, 7], [-1, -1, 8], [0, -1, 8], [-2, 2, 3, 'h'], [1, -2, 9, 's']],
      side: [[-2, 0, 6], [-1, -1, 7], [0, -1, 7], [-2, 2, 3, 'h'], [1, 3, 10, 's']],
      back: [[-2, 0, 7], [-1, -1, 8], [0, -1, 8], [1, -1, 8, 's']],
    },
    beanie: {
      front: [[-3, 1, 6], [-2, 0, 7], [-1, -1, 8], [0, -1, 8], [-2, 1, 2, 'h'], [1, -1, 8, 's'], [-4, 3, 4, 'x']],
      side: [[-3, 0, 5], [-2, -1, 6], [-1, -2, 7], [0, -2, 7], [-2, 1, 2, 'h'], [1, -2, 7, 's'], [-4, 2, 3, 'x']],
      back: [[-3, 1, 6], [-2, 0, 7], [-1, -1, 8], [0, -1, 8], [1, -1, 8, 's'], [-4, 3, 4, 'x']],
    },
    flat: {
      front: [[-2, 0, 7], [-1, -1, 8], [-2, 1, 3, 'h'], [0, -1, 8, 's']],
      side: [[-2, 0, 6], [-1, -2, 7], [-2, 1, 3, 'h'], [0, -2, 9, 's']],
      back: [[-2, 0, 7], [-1, -1, 8], [0, -1, 8, 's']],
    },
    bowler: {
      front: [[-4, 1, 6], [-3, 1, 6], [-2, 1, 6], [-4, 2, 3, 'h'], [-1, 1, 6, 's'], [0, -1, 8]],
      side: [[-4, 1, 6], [-3, 1, 6], [-2, 1, 6], [-4, 2, 3, 'h'], [-1, 1, 6, 's'], [0, -1, 8]],
      back: [[-4, 1, 6], [-3, 1, 6], [-2, 1, 6], [-1, 1, 6, 's'], [0, -1, 8]],
    },
  };

  function spans(g, list, hx, hy, fd, c, c2, texture) {
    for (const [y, x1, x2, k] of list) {
      for (let x = x1; x <= x2; x++) {
        const lx = fd < 0 ? 7 - x : x;
        let col = k === 's' ? lit(c, -1) : k === 'h' ? lit(c, 1) : k === 'x' ? c2 : c;
        if (!k && texture && ((x * 2 + y * 3) % 5 === 0 || (x * 7 + y) % 9 === 0)) col = lit(c, -1); // curls
        else if (!k && texture && (x * 5 + y * 3) % 7 === 0) col = lit(c, 1);
        else if (!k && (lx === 7 || lx === 8)) col = lit(c, -1); // the side away from the light
        g.fillStyle = col;
        g.fillRect(hx + lx, hy + y, 1, 1);
      }
    }
  }

  // ---------- poses ----------
  // Arm joints are offsets from the shoulder: [[elbowDx, elbowDy], [handDx, handDy]], dx towards the way the
  // character faces (so poses mirror). Written at the old cartoon scale and stretched to the longer, realistic arms.
  const AR = 1.3;
  const DOWN_F = [[1, 8], [1, 16]];
  const DOWN_B = [[-1, 8], [-1, 16]];
  const UP_F = [[1, -8], [1, -16]];
  const osc = (t, hz, n = 2) => Math.floor(t * hz) % n;
  // ---------- legs for dancing (she dances in front of the counter, where the low window shows her feet) ----------
  // o: { P, band, shoe, legC, shoes, cx, legTop, knee, fy, fd, side, lw, lit, frontLeg, backLeg }
  const diag = (o, c, x0, y0, x1, y1, w) => {
    const n = Math.max(Math.abs(y1 - y0), Math.abs(x1 - x0), 1);
    for (let i = 0; i <= n; i++) o.P(c, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, 1);
  };
  const point = (o, x, y) => o.P(o.shoes, x, y, 2, 2); // a pointed foot
  const LEGS = {
    // at the barre (the counter top): standing on the back leg, the front leg raised along the barre
    barre(o) {
      o.band(o.lit(o.legC, -1), o.backLeg, o.lw, o.legTop, o.fy - 2 - o.legTop, false);
      o.shoe(o.backLeg - (o.fd > 0 ? 0 : 2), o.fy - 2, 5);
    },
    // drawn over the skirt: the raised leg comes out from under the hem, which rides up over the thigh
    barreOver(o) {
      const x0 = o.fd > 0 ? o.cx + 3 : o.cx - 18;
      const ly = o.legTop - 8; // resting along the counter top (hip height: plausible for a retired professional)
      const cy = B.theme === 'cyber';
      o.P(cy ? '#1a1230' : '#4a3426', x0 - 1, ly - 1, 17, 5); // a soft outline, so the leg reads against the counter
      o.P(o.lit(o.legC, 1), x0, ly, 15, 3);
      o.P(o.lit(o.legC, 3), x0, ly, 15, 1);
      o.P(o.lit(o.legC, -1), x0, ly + 2, 15, 1);
      o.P(cy ? '#ff7ad9' : '#e8b0a0', o.fd > 0 ? x0 + 14 : x0 - 2, ly, 3, 2); // a pointed foot, in a pink slipper
      o.P(o.skirt, o.fd > 0 ? o.cx + 1 : o.cx - 6, ly - 1, 5, 6); // the hem, draped over the thigh
    },
    // arabesque: on the front leg, the back leg lifted out behind
    arabesque(o) {
      o.band(o.legC, o.frontLeg, o.lw, o.legTop, o.fy - 2 - o.legTop, false);
      o.shoe(o.frontLeg - (o.fd > 0 ? 0 : 2), o.fy - 2, 5);
      diag(o, o.legC, o.cx - 3 * o.fd, o.legTop + 1, o.cx - 15 * o.fd, o.legTop - 7, 3); // a 45-degree line, from behind the skirt
      point(o, o.cx - 17 * o.fd, o.legTop - 8);
    },
    // a pirouette: on one leg, the other drawn up to the knee (retire)
    retire(o) {
      o.band(o.legC, o.cx - 2, o.lw, o.legTop, o.fy - 2 - o.legTop, false);
      o.shoe(o.cx - 2, o.fy - 2, 4);
      const kx = o.cx + 7;
      diag(o, o.legC, o.cx, o.legTop + 1, kx, o.knee - 7, 3); // the retire triangle, above the riser
      diag(o, o.legC, kx, o.knee - 7, o.cx + 1, o.knee - 3, 3);
    },
    // a plie: knees bent out over turned-out feet
    plie(o) {
      for (const s of [-1, 1]) {
        const hx = o.cx + (s < 0 ? -4 : 1);
        const kx = o.cx + (s < 0 ? -8 : 5);
        diag(o, s < 0 ? o.legC : o.lit(o.legC, -1), hx, o.legTop, kx, o.knee, 3);
        diag(o, s < 0 ? o.legC : o.lit(o.legC, -1), kx, o.knee, hx, o.fy - 2, 3);
        o.shoe(s < 0 ? hx - 3 : hx + 1, o.fy - 2, 5);
      }
    },
    // the Charleston: knees knocking in, one foot kicking out to the side and back
    charleston(o, k) {
      for (const s of [-1, 1]) {
        const hx = o.cx + (s < 0 ? -4 : 1);
        const kx = o.cx + (s < 0 ? -1 : 0);
        const kick = (k === 0 && s < 0) || (k === 1 && s > 0);
        diag(o, s < 0 ? o.legC : o.lit(o.legC, -1), hx, o.legTop, kx, o.knee, 3);
        const fx = kick ? o.cx + s * 10 : hx;
        const fyy = kick ? o.fy - 7 : o.fy - 2;
        diag(o, s < 0 ? o.legC : o.lit(o.legC, -1), kx, o.knee, fx, fyy, 3);
        o.shoe(fx - 2, fyy, 4);
      }
    },
  };

  /** A keyframed pose: keys [{ t, f, b, bob?, ease? }] over a cycle of `dur` seconds (looping unless once). Arms
   *  are interpolated key to key (eased in and out), so a move flows through its in-betweens rather than snapping;
   *  the hand positions are moved along the shortest arc around the shoulder for sweeping arm paths. */
  const ease = (k) => k * k * (3 - 2 * k);
  const pol = ([x, y]) => [Math.hypot(x, y), Math.atan2(y, x)];
  const angLerp = (a, b, k) => a + ((((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * k);
  const pLerp = (P, Q, k) => {
    const [r1, a1] = pol(P);
    const [r2, a2] = pol(Q);
    const r = r1 + (r2 - r1) * k;
    const an = angLerp(a1, a2, k);
    return [r * Math.cos(an), r * Math.sin(an)];
  };
  const arm = (A, Bm, k) => {
    const e = pLerp(A[0], Bm[0], k); // the elbow swings around the shoulder
    const fa = pLerp([A[1][0] - A[0][0], A[1][1] - A[0][1]], [Bm[1][0] - Bm[0][0], Bm[1][1] - Bm[0][1]], k); // the forearm around the elbow
    return [e, [e[0] + fa[0], e[1] + fa[1]]];
  };
  function keyed(keys, dur, opts = {}) {
    const fn = (t, pt = t) => {
      let u = opts.once ? Math.min(pt, dur - 1e-3) : ((t % dur) + dur) % dur;
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1].t <= u) i++;
      const A = keys[i];
      const Bk = keys[i + 1] || (opts.once ? A : Object.assign({}, keys[0], { t: dur }));
      const span = Math.max(1e-3, Bk.t - A.t);
      const r = Math.min(1, Math.max(0, (u - A.t) / span));
      const k = A.hold ? 0 : A.ease === 'linear' ? r : A.ease === 'out' ? 1 - (1 - r) * (1 - r) : A.ease === 'in' ? r * r : ease(r);
      const spec = Object.assign({}, opts.base || {}, { f: arm(A.f, Bk.f, k), b: arm(A.b, Bk.b, k) });
      spec.bob = Math.round((A.bob || 0) + ((Bk.bob || 0) - (A.bob || 0)) * k);
      if (A.hold && span >= 1.2) spec.bob -= Math.round((1 - Math.cos(((u - A.t) / 2.4) * 2 * Math.PI)) / 2); // breathing through a long hold
      spec.headDy = Math.round((A.headDy || 0) + ((Bk.headDy || 0) - (A.headDy || 0)) * k);
      spec.headDx = Math.round((A.headDx || 0) + ((Bk.headDx || 0) - (A.headDx || 0)) * k);
      spec.bodyDx = Math.round((A.bodyDx || 0) + ((Bk.bodyDx || 0) - (A.bodyDx || 0)) * k);
      if (A.legs) spec.legs = A.legs;
      if (A.item || opts.item) spec.item = A.item || opts.item;
      return spec;
    };
    fn.keyed = true;
    return fn;
  }
  B.keyedPose = keyed;

  // the island strum, per bar of 4 beats (0.52 s each): [from beat, to beat, from y, to y]
  const UKE_HAND = [[0, 0.2, 9, 12], [0.2, 0.9, 12, 9], [1.0, 1.2, 9, 12], [1.6, 1.75, 12, 9], [2.2, 2.4, 9, 12], [2.6, 2.75, 12, 9], [3.0, 3.2, 9, 12], [3.6, 3.75, 12, 9]];
  const UKE_CHORD_X = [8, 8, 7, 7, 9, 9, 7, 7, 8, 8, 9, 9, 7, 7, 8, 8]; // C C A7 A7 Dm7 Dm7 G7 G7 C C F Fm G7 G7 C C
  function ukeSpec(t, standing) {
    const beat = (((t / 0.52) % 32) + 32) % 32;
    const b4 = beat % 4;
    let y = 9;
    for (let i = 0; i < UKE_HAND.length; i++) {
      const [a0, a1, y0, y1] = UKE_HAND[i];
      if (b4 >= a0 && b4 < a1) {
        y = Math.round(y0 + ((y1 - y0) * (b4 - a0)) / (a1 - a0));
        break;
      }
      const next = UKE_HAND[i + 1];
      if (b4 >= a1 && (!next || b4 < next[0])) y = y1;
    }
    const fx = (B.ukeChordX || UKE_CHORD_X)[Math.floor(beat / 2) % 16]; // (the tune playing sets B.ukeChordX)
    const spec = { f: [[2, 7], [0, y]], b: [[-3, 4], [-fx, 0]], item: 'uke' };
    spec.streak = UKE_HAND.some(([a0, a1, y0, y1]) => y1 > y0 && b4 >= a0 && b4 < a0 + (a1 - a0) * 0.5); // early in a down-stroke
    if (standing) spec.bob = (b4 < 0.25 || (b4 >= 2 && b4 < 2.25)) ? 1 : 0; // a nod on 1 and 3
    spec.headDx = Math.round(Math.sin((beat / 4) * Math.PI)); // a gentle sway, every two beats
    return spec;
  }

  const POSES = {
    // ---------- ballet (positions from the dance consultant; timing and easing from the animation consultant) ----------
    // arm positions, front arm (the back arm mirrors x): bras bas, first, fifth (framing the head), second
    // at the barre: the barre hand resting on the counter top, the outside arm in second
    barreplie: keyed(
      // facing the barre, hands shoulder-width on it: the elbows bend out as she sinks, the hands stay put;
      // the head drops a pixel at the bottom and lifts on the rise (the breath)
      [
        { t: 0, f: [[4, 6], [0, 11]], b: [[-4, 6], [0, 11]], bob: 0 },
        { t: 1.5, f: [[6, 3], [0, 8]], b: [[-6, 3], [0, 8]], bob: 4, headDy: 1 },
        { t: 1.8, f: [[6, 3], [0, 8]], b: [[-6, 3], [0, 8]], bob: 4, headDy: 1 },
        { t: 3.0, f: [[4, 6], [0, 11]], b: [[-4, 6], [0, 11]], bob: 0, headDy: -1 },
        { t: 3.3, f: [[4, 6], [0, 11]], b: [[-4, 6], [0, 11]], bob: 0 },
      ],
      3.3,
    ),
    barreturn: keyed([{ t: 0, f: [[4, 6], [9, 11]], b: [[1, 8], [1, 13]], bob: 0 }], 0.4, { once: true }), // lets go, turns, takes the barre
    // ...the outside arm travelling bras bas, first, fifth, second
    barrepdb: keyed(
      // side-on at the barre: the outside arm through bras bas, first (in front of the stomach), fifth, and second
      // (seen from the side, second is forward and out)
      [
        { t: 0, f: [[4, 6], [9, 11]], b: [[-1, 8], [2, 13]], hold: true },
        { t: 0.9, f: [[4, 6], [9, 11]], b: [[-1, 8], [2, 13]] },
        { t: 1.5, f: [[4, 6], [9, 11]], b: [[2, 6], [3, 9]], headDy: -1, hold: true },
        { t: 2.4, f: [[4, 6], [9, 11]], b: [[2, 6], [3, 9]], headDy: -1 },
        { t: 3.0, f: [[4, 6], [9, 11]], b: [[-4, -9], [1, -14]], headDy: -1, hold: true },
        { t: 3.9, f: [[4, 6], [9, 11]], b: [[-4, -9], [1, -14]], headDy: -1, ease: 'out' },
        { t: 4.5, f: [[4, 6], [9, 11]], b: [[1, 1], [5, 3]], headDx: 1, hold: true },
        { t: 5.4, f: [[4, 6], [9, 11]], b: [[1, 1], [5, 3]], headDx: 1, ease: 'in' },
      ],
      6,
    ),
    // a leg along the barre, the outside arm en haut, leaning over the leg
    barre: keyed(
      // the leg along the barre, the arm en haut; a deep stretch over the leg, held; and back up
      [
        { t: 0, f: [[4, 6], [9, 11]], b: [[-3, -6], [-1, -12]], hold: true },
        { t: 1.2, f: [[4, 6], [9, 11]], b: [[-3, -6], [-1, -12]] },
        { t: 2.0, f: [[4, 6], [9, 11]], b: [[2, -6], [7, -9]], headDx: 2, headDy: 2, hold: true },
        { t: 3.6, f: [[4, 6], [9, 11]], b: [[2, -6], [7, -9]], headDx: 2, headDy: 2 },
        { t: 4.4, f: [[4, 6], [9, 11]], b: [[-3, -6], [-1, -12]], headDy: -1 },
      ],
      4.6,
      { once: true, base: { legs: LEGS.barre, legsOver: LEGS.barreOver } },
    ),
    // centre: plie, down on two counts and up on two, arms in second (a grand plie is deeper)
    plie: keyed(
      // demi-plie: the arms hold second, breathing down with the knees
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
        { t: 1.6, f: [[6, 3], [10, 6]], b: [[-6, 3], [-10, 6]], bob: 3, headDy: 1, headDx: 1, hold: true },
        { t: 2.0, f: [[6, 3], [10, 6]], b: [[-6, 3], [-10, 6]], bob: 3, headDy: 1, headDx: 1 },
        { t: 4.0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
      ],
      4.0,
      { base: { legs: LEGS.plie } },
    ),
    plieB: keyed(
      // the second demi-plie: the head inclines the other way
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
        { t: 1.6, f: [[6, 3], [10, 6]], b: [[-6, 3], [-10, 6]], bob: 3, headDy: 1, headDx: -1, hold: true },
        { t: 2.0, f: [[6, 3], [10, 6]], b: [[-6, 3], [-10, 6]], bob: 3, headDy: 1, headDx: -1 },
        { t: 4.0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
      ],
      4.0,
      { base: { legs: LEGS.plie } },
    ),
    grandplie: keyed(
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
        { t: 1.4, f: [[6, 3], [10, 6]], b: [[-6, 3], [-10, 6]], bob: 2 },
        { t: 2.6, f: [[1, 8], [-2, 13]], b: [[-1, 8], [2, 13]], bob: 5 },
        { t: 3.0, f: [[1, 8], [-2, 13]], b: [[-1, 8], [2, 13]], bob: 5 },
        { t: 4.4, f: [[3, 6], [-3, 8]], b: [[-3, 6], [3, 8]], bob: 2 },
        { t: 6.0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
      ],
      6.0,
      { once: true, base: { legs: LEGS.plie } },
    ),
    // port de bras: bras bas, first, fifth (the head lifting after the hands), second; 1.5 s a position
    portdebras: keyed(
      // bras bas, first, fifth (a little cambre: the head lifting after the hands), second with epaulement
      [
        { t: 0, f: [[1, 8], [-2, 13]], b: [[-1, 8], [2, 13]], hold: true },
        { t: 0.9, f: [[1, 8], [-2, 13]], b: [[-1, 8], [2, 13]] },
        { t: 1.5, f: [[3, 6], [-3, 8]], b: [[-3, 6], [3, 8]], hold: true },
        { t: 2.4, f: [[3, 6], [-3, 8]], b: [[-3, 6], [3, 8]] },
        { t: 3.0, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], headDy: -1 },
        { t: 3.2, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], headDy: -2, hold: true },
        { t: 3.4, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], headDy: -1, hold: true },
        { t: 3.9, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], headDy: -1, ease: 'out' },
        { t: 4.5, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], headDx: 1, hold: true },
        { t: 5.4, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], headDx: 1, ease: 'in' },
      ],
      6,
    ),
    // first arabesque: the front arm reaching forward above the shoulder, the other low and back, leaning in
    arabesque: keyed(
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
        { t: 0.3, f: [[3, 5], [5, 8]], b: [[2, 5], [4, 8]], bob: 0, legs: LEGS.retire }, // developpe: through retire
        { t: 0.6, f: [[6, -2], [12, -4]], b: [[-6, 0], [-11, 3]], bob: 0, ease: 'out', headDx: 1, legs: LEGS.arabesque },
        { t: 1.8, f: [[6, -2], [12, -5]], b: [[-6, 0], [-11, 3]], bob: 0, headDx: 1, legs: LEGS.arabesque },
        { t: 3.0, f: [[6, -2], [12, -4]], b: [[-6, 0], [-11, 3]], bob: 0, headDx: 1, legs: LEGS.arabesque },
        { t: 3.0, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: 1 },
        { t: 3.4, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: 1 },
      ],
      3.4,
      { once: true },
    ),
    // the pirouette: a preparation in fourth (plie, arms in third), one spotted turn in fifth, a finish
    pirprep: keyed(
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
        { t: 0.6, f: [[3, 6], [-3, 8]], b: [[-6, 1], [-11, 3]], bob: 2 },
        { t: 0.8, f: [[3, 6], [-3, 8]], b: [[-6, 1], [-11, 3]], bob: 2 },
      ],
      0.8,
      { once: true },
    ),
    pirouette: () => ({ f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: -1, legs: LEGS.retire }),
    pirland: keyed(
      [
        { t: 0, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: 1, hold: true },
        { t: 0.15, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: 0, headDy: -1, hold: true },
        { t: 0.45, f: [[4, -9], [-1, -14]], b: [[-4, -9], [1, -14]], bob: 0, headDy: -1, ease: 'out' },
        { t: 0.8, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0 },
      ],
      0.8,
      { once: true },
    ),
    // the reverence: open to second, a curtsey with the head bowed, a second smaller bow, open low, close
    reverence: keyed(
      [
        { t: 0, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0, bodyDx: 1, hold: true },
        { t: 0.8, f: [[6, 1], [11, 3]], b: [[-6, 1], [-11, 3]], bob: 0, bodyDx: 1 },
        { t: 1.3, f: [[5, 6], [9, 11]], b: [[-5, 6], [-9, 11]], bob: 4, headDy: 1, hold: true },
        { t: 2.0, f: [[5, 6], [9, 11]], b: [[-5, 6], [-9, 11]], bob: 4, headDy: 1, ease: 'out' },
        { t: 2.3, f: [[5, 7], [9, 10]], b: [[-5, 7], [-9, 10]], bob: 0 },
        { t: 2.5, f: [[5, 7], [9, 10]], b: [[-5, 7], [-9, 10]], bob: 2, headDy: 1 },
        { t: 2.8, f: [[5, 7], [9, 10]], b: [[-5, 7], [-9, 10]], bob: 0 },
        { t: 3.3, f: [[1, 8], [-2, 13]], b: [[-1, 8], [2, 13]], bob: 0 },
      ],
      3.4,
      { once: true },
    ),
    // ---------- the Charleston: arms swinging in opposition to the kick, a down-bounce on every beat ----------
    charleston: (t) => {
      // jazz hands framing the face every 4 s, shaking
      if (t % 4 < 0.5) {
        const sh = osc(t, 8);
        if (Math.floor(t / 4) % 2 === 0) return { f: [[5, -1], [6 + sh, -7]], b: [[-5, -1], [-6 - sh, -7]], item: 'jazz', bob: 0, legs: LEGS.plie };
        // the flapper shimmy: a wide low V, palms open, the shoulders alternating
        const s = osc(t, 8) ? 1 : -1;
        return { f: [[6, 4 + s], [11, 9 + s]], b: [[-6, 4 - s], [-11, 9 - s]], item: 'jazz', bob: 0, legs: LEGS.plie };
      }
      const u = ((t % 0.44) + 0.44) % 0.44; // kick 0.14, down 0.08, kick 0.14, down 0.08
      const ph = u < 0.14 ? 0 : u < 0.22 ? 1 : u < 0.36 ? 2 : 3;
      if (ph === 0) return { f: [[4, 6], [7, 11]], b: [[-4, 6], [-8, 1]], item: 'jazz', bob: 0, headDx: -1, bodyDx: -1, legs: (o) => LEGS.charleston(o, 0) };
      if (ph === 2) return { f: [[4, 6], [8, 1]], b: [[-4, 6], [-7, 11]], item: 'jazz', bob: 0, headDx: 1, bodyDx: 1, legs: (o) => LEGS.charleston(o, 1) };
      return { f: [[4, 7], [6, 10]], b: [[-4, 7], [-6, 10]], item: 'jazz', bob: 1, headDy: 1, legs: LEGS.plie }; // down, knees together
    },
    // ---------- the ukulele: the strumming hand on the island strum, the fretting hand changing with the chords ----------
    ukulele: (t) => ukeSpec(t, true),
    situke: (t) => ukeSpec(t, false),
    reach: () => ({ f: UP_F }),
    shelve: () => ({ f: [[0, -7], [0, -14]], b: [[0, 8], [0, 15]] }),
    browse: (t) => (osc(t, 0.8, 3) === 0 ? { f: [[0, -6], [0, -13]] } : { f: [[1, 8], [0, 12]] }),
    wave: (t) => ({ f: [[4, -5], [5 + osc(t, 5) * 2, -13]] }),
    backwave: (t) => ({ f: [[4, -5], [5 + osc(t, 5) * 2, -13]] }),
    stretch: () => ({ f: [[2, -8], [3, -16]], b: [[-2, -8], [-3, -16]] }),
    cheer: (t) => ({ f: [[2, -8], [3, -16 + osc(t, 4)]], b: [[-2, -8], [-3, -16 + osc(t + 0.12, 4)]] }),
    dance: (t) => (osc(t, 3) ? { f: [[3, -7], [4, -15]], b: [[-3, 6], [-6, 11]] } : { f: [[3, 6], [6, 11]], b: [[-3, -7], [-4, -15]] }),
    drink: () => ({ f: [[2, 7], [-3, -3]], item: 'cupMouth' }),
    smoke: () => ({ f: [[2, 7], [-2, -2]], item: 'cigMouth' }),
    read: () => ({ f: [[1, 8], [5, 7]], b: [[1, 8], [4, 8]], item: 'book', front: { f: [[1, 8], [-3, 8]], b: [[-1, 8], [3, 8]] } }),
    write: (t) => ({ f: [[1, 8], [6 + osc(t, 4), 12]], b: [[1, 8], [3, 12]], item: 'paper' }),
    wrap: (t) => ({ f: [[1, 8], [5 + osc(t, 3) * 2, 12]], b: [[1, 8], [3, 12]], item: 'parcel' }),
    till: (t) => ({ f: [[1, 8], [6, 12 + osc(t, 5)]] }),
    unpack: (t) => ({ f: [[1, 7], [6, 11 + osc(t, 3) * 2]], b: [[1, 7], [4, 12]] }),
    lean: () => ({ f: [[2, 7], [7, 12]], b: [[2, 7], [5, 12]] }),
    think: () => ({ f: [[3, 7], [-2, -2]], b: [[1, 8], [6, 9]] }),
    hips: () => ({ f: [[4, 6], [1, 12]], b: [[-4, 6], [-1, 12]] }),
    shrug: () => ({ f: [[4, 5], [7, -1]], b: [[-4, 5], [-7, -1]] }),
    facepalm: () => ({ f: [[3, 6], [-2, -6]] }),
    cross: () => ({ f: [[1, 8], [-7, 9]], b: [[1, 8], [6, 10]] }),
    clap: (t) => ({ f: [[2, 8], [-3 + osc(t, 6), 5]], b: [[-2, 8], [3 - osc(t, 6), 5]] }),
    point: () => ({ f: [[5, -1], [12, -3]] }),
    shake: (t) => ({ f: [[3, -6], [4 + osc(t, 8), -13]] }), // a gadget held up and given a shake
    hug: () => ({ f: [[1, 9], [-4, 6]], b: [[-1, 9], [4, 6]], item: 'bookHug' }),
    crouch: () => ({ f: [[2, 8], [6, 14]], b: [[1, 8], [4, 14]] }),
    carry: () => ({ f: [[1, 8], [5, 10]], b: [[1, 8], [3, 10]] }),
    sweep: (t) => ({ f: [[1, 8], [3 + osc(t, 3), 13]], item: 'broom' }),
    water: () => ({ f: [[2, 8], [7, 9]], item: 'can' }),
    dust: (t) => ({ f: [[2, -2], [3, osc(t, 4) ? -9 : -5]], item: 'duster' }),
    sit: () => ({ f: [[2, 8], [6, 13]], b: [[1, 8], [4, 13]] }),
    sitread: () => ({ f: [[1, 8], [5, 5]], b: [[1, 8], [4, 6]], item: 'book', front: { f: [[1, 8], [-3, 6]], b: [[-1, 8], [3, 6]] } }),
    sleep: () => ({ f: [[4, 6], [10, 7]], b: [[3, 6], [8, 8]] }),
  };
  const BACK_POSES = { browse: 1, shelve: 1, backstand: 1, backwave: 1, dust: 1 };
  const SIT_POSES = { sit: 1, sitread: 1, situke: 1 };
  B.isDancePose = (p) => !!DANCE_POSES[p];
  const DANCE_POSES = { barreplie: 1, barreturn: 1, barrepdb: 1, barre: 1, plie: 1, plieB: 1, grandplie: 1, portdebras: 1, arabesque: 1, pirprep: 1, pirouette: 1, pirland: 1, reverence: 1, charleston: 1, ukulele: 1, situke: 1 };
  const stretch = (arm) => arm.map(([x, y]) => [Math.round(x * AR), Math.round(y * AR)]);

  function metrics(a) {
    const L = a.look || B.looks.default || {};
    const pose = a.moving ? 'walk' : a.pose || 'stand';
    const H = 60 + 2 * (L.h || 0);
    let drop = 0;
    if (SIT_POSES[pose]) drop = 12;
    else if (pose === 'crouch') drop = 15;
    else if (pose === 'sleep') drop = 9;
    return { H, drop };
  }
  /** y of the top of an actor's head (for bubbles & particles). */
  B.headTop = (a) => {
    const m = metrics(a);
    return a.y - (a.lift || 0) - m.H + m.drop;
  };

  function limb(g, x0, y0, x1, y1, c, w = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    g.fillStyle = c;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      g.fillRect(x - (w >> 1), y - (w >> 1), w, w);
    }
  }

  // ---------- people ----------
  /** Draw an actor smaller (sc < 1) with its feet at (x, feetY): for people further away. */
  let scaledBuf = null;
  B.drawPersonScaled = function (g, a, x, feetY, sc) {
    if (!scaledBuf) {
      scaledBuf = document.createElement('canvas');
      scaledBuf.width = 80;
      scaledBuf.height = 120;
    }
    const tg = scaledBuf.getContext('2d');
    tg.clearRect(0, 0, 80, 120);
    const proxy = Object.create(a);
    Object.defineProperty(proxy, 'x', { value: 40 });
    Object.defineProperty(proxy, 'y', { value: 112 });
    B.drawPerson(tg, proxy);
    g.imageSmoothingEnabled = false;
    g.drawImage(scaledBuf, Math.round(x - 40 * sc), Math.round(feetY - 112 * sc), Math.round(80 * sc), Math.round(120 * sc));
  };
  B.drawPerson = function (g, a) {
    const jitter = a.jitter && Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    B.blit(g, a.x + jitter, a.y - (a.lift || 0), (bg, cx, fy) => paintPerson(bg, a, cx, fy), a.alpha == null ? 1 : a.alpha); // (lift: raised on the window cleaner's stilts)
  };

  // themes can restyle everyone's clothes (B.styleLook) and add details on top (B.personAccents)
  B.styleLook = B.styleLook || ((L) => L);

  function paintPerson(g, a, cx, fy) {
    if (a.robot && B.paintRobot) return B.paintRobot(g, a, cx, fy); // the pavement delivery robots (delivery-robots.js)
    const P = (c, x, y, w = 1, h = 1) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    /** A lit horizontal band: highlight on the left edge, shadow on the right, a little fabric texture. */
    const band = (c, x0, w, y, h = 1, tex = true) => {
      if (w <= 0 || h <= 0) return;
      P(c, x0, y, w, h);
      if (w >= 3) P(lit(c, 1), x0, y, 1, h);
      P(lit(c, -1), x0 + w - 1, y, 1, h);
      if (w >= 6) P(lit(c, -1), x0 + w - 2, y, 1, h);
      if (tex) {
        // irregular folds and weave, a half-step darker: reads as cloth, not a pattern
        const fold = weave(c);
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x0 + 1; xx < x0 + w - 2; xx++) if ((((xx * 73856093) ^ (yy * 19349663)) >>> 0) % 9 === 0) P(fold, xx, yy, 1, 1);
      }
    };
    const L = B.styleLook(a.look || B.looks.default);
    const pose = a.moving ? a.movePose || (a.holding === 'box' || a.holding === 'books' ? 'carry' : 'walk') : a.pose || 'stand';
    const back = !!BACK_POSES[pose] || !!a.backView;
    const d = back ? 0 : a.dir || 0; // -1 / 0 (towards us) / 1
    const fd = a.dir || 1;
    const side = d !== 0 && !back;
    const t = a.t || 0;
    const { H, drop } = metrics(a);

    let wf = 0;
    if (a.moving) wf = Math.floor(a.walkT * 7) % 4;
    if (pose === 'dance') wf = osc(t, 3) ? 1 : 3;
    let bob = wf === 1 || wf === 3 ? -1 : 0;
    if (!a.moving && a.happy && (pose === 'stand' || pose === 'read') && osc(t, 2, 4) === 0) bob = -1;
    if (pose === 'cheer' || pose === 'clap') bob = -osc(t, 4);
    if (pose === 'arabesque' || pose === 'pirouette') bob = -1; // up on the toes (a spec can say otherwise)
    const pre = POSES[pose] ? POSES[pose](t, a.poseT || 0) : null;
    if (pre && pre.bodyDx) cx += pre.bodyDx; // a sway of the whole body (the Charleston's swivel)
    if (pre && pre.bob != null) bob = pre.bob; // dance poses carry their own rise and fall
    // into a dance pose (or out of one) the body carries on from where it was for 0.3 s, never a snap
    // (the pirouette's own frames are a turn, not a change of pose)
    if (a._blendPose !== pose) {
      a._blendFrom = a._blendPose === 'pirouette' && pose === 'pirouette' ? null : a._blendLast;
      a._blendPose = pose;
    }
    const blendFrom = a._blendFrom;
    const blendT = a.poseT || 0;
    const blendK = blendFrom && blendT < 0.3 && !a.moving && (B.isDancePose(pose) || blendFrom.dance) ? 1 - (1 - blendT / 0.3) ** 2 : null;
    if (blendK != null) bob = Math.round(blendFrom.bob + (bob - blendFrom.bob) * blendK);
    const T = fy - H + bob + drop;
    // realistic proportions: head ~1/7 of the height, legs half of it
    const sy = T + 11; // shoulders
    const waist = T + Math.round(H * 0.42);
    const legTop = T + Math.round(H * 0.5);
    const skin = L.skin;
    const S = L.sleeve || L.top;
    const shoes = L.shoes || '#2a211c';
    const legC = L.dress ? L.tights || skin : L.bottom;

    // ----- arms setup -----
    let spec = pre || {};
    if (d === 0 && spec.front) spec = Object.assign({}, spec, spec.front);
    let fA = spec.f || DOWN_F;
    let bA = spec.b || DOWN_B;
    if (pose === 'walk') {
      const s = wf === 1 ? 2 : wf === 3 ? -2 : 0;
      fA = [[1 + s, 8], [1 + 2 * s, 15]];
      bA = [[-1 - s, 8], [-1 - 2 * s, 15]];
    }
    // into a dance pose (or out of one) the arms carry on from where they were for 0.3 s, never a snap
    // (the pirouette's own frames are a turn, not a change of pose)
    if (blendK != null) {
      fA = arm(blendFrom.f, fA, blendK);
      bA = arm(blendFrom.b, bA, blendK);
    }
    a._blendLast = { f: fA, b: bA, bob, dance: B.isDancePose(pose) };
    const items = [];
    if (spec.item) items.push(spec.item);
    const h = a.holding;
    const reading = pose === 'read' || pose === 'sitread' || pose === 'hug';
    if (h === 'receiver' || h === 'mobile') {
      bA = [[-3, 3], [1, -6]];
      items.push(h);
    }
    if (h === 'cup' && pose !== 'drink') {
      fA = [[1, 8], [5, 10]];
      items.push('cup');
    }
    if ((h === 'book' || h === 'parcel') && !reading) {
      fA = [[1, 8], [3, 14]];
      items.push(h === 'book' ? 'bookSmall' : 'parcelSmall');
    }
    if (h === 'bag') items.push('bag');
    if (h === 'cig' && pose !== 'smoke') {
      fA = [[1, 8], [4, 11]];
      items.push('cig');
    }
    if (h === 'box') items.push('box');
    if (h === 'books') items.push('stack');
    if (h === 'gadget') {
      // a buzzing pocket gadget (SCH-22): pointed out at arm's length, held up to be read, or just carried
      if (pose !== 'point' && pose !== 'reach' && pose !== 'shake') fA = [[1, 8], [4, 11]];
      items.push('gadget');
    }
    if (h === 'broom' && pose !== 'sweep') {
      fA = [[1, 8], [3, 13]];
      items.push('broomUp');
    }
    const brolly = a.umbrella && a.umbrellaUp && a.area === 'street';
    if (brolly) fA = [[2, 6], [2, -4]];
    if (a.slump && !a.moving) {
      fA = fA.map(([x, y]) => [x, y + 1]);
      bA = bA.map(([x, y]) => [x, y + 1]);
    }
    fA = stretch(fA);
    bA = stretch(bA);

    const half = side ? 4 : 5; // shoulder half-width: narrower in profile
    const fsx = fd > 0 ? cx + half - 1 : cx - half;
    const bsx = fd > 0 ? cx - half : cx + half - 1;
    if (a.armTo) {
      // the front hand reaching for a point in the world (the window cleaner's squeegee, window-cleaning.js): the
      // elbow bends out and down halfway
      const tx = a.armTo[0] - a.x + cx;
      const ty = a.armTo[1] - (a.y - (a.lift || 0)) + fy;
      const dx = Math.round((tx - fsx) * fd);
      const dy = Math.round(ty - (sy + 1));
      fA = [[Math.round(dx * 0.5) + 2, Math.round(dy * 0.5) + 2], [dx, dy]];
    }
    const joint = (sx, [e, hnd]) => ({ e: [sx + e[0] * fd, sy + 1 + e[1]], h: [sx + hnd[0] * fd, sy + 1 + hnd[1]] });
    const fJ = joint(fsx, fA);
    const bJ = joint(bsx, bA);
    const dancing = DANCE_POSES[pose];
    // a 1 px selective outline so the arms read against the shelves (drawn before the body, so never over the cardigan)
    const outline = (sx, j) => {
      const ol = B.theme === 'cyber' ? '#1a1230' : '#4a3426';
      limb(g, sx, sy + 1, j.e[0], j.e[1], ol, 4);
      limb(g, j.e[0], j.e[1], j.h[0], j.h[1], ol, 3);
    };
    const drawArm = (sx, j, far) => {
      const c = far ? lit(S, -1) : S;
      if (dancing && far) outline(sx, j);
      limb(g, sx, sy + 1, j.e[0], j.e[1], c);
      limb(g, j.e[0], j.e[1], j.h[0], j.h[1], c);
      if (!far) P(lit(S, 1), sx - (fd > 0 ? 1 : 0), sy, 1, 2); // the shoulder catching the light
      if (dancing && B.theme === 'cyber') {
        // a rim light: bright on the near arm, dimmer and on the forearm only on the far one
        if (!far) limb(g, sx, sy, j.e[0], j.e[1] - 1, '#b48cff', 1);
        limb(g, j.e[0], j.e[1] - 1, j.h[0], j.h[1] - 1, far ? '#7a5cb0' : '#b48cff', 1);
        P('#3ff5ff', j.h[0], j.h[1] - 1, 1, 1); // a cyan cuff
      }
      P(far ? lit(skin, -1) : skin, j.h[0] - 1, j.h[1], 2, 2);
      P(lit(skin, -1), j.h[0] - (fd > 0 ? 0 : 1), j.h[1] + 1, 1, 1);
    };

    // ----- back arm -----
    drawArm(bsx, bJ, true);
    if (dancing) outline(fsx, fJ);

    // ----- legs -----
    const shoe = (x, y, w) => {
      P(shoes, x, y, w, 2);
      P(lit(shoes, 1), x + 1, y, Math.max(1, w - 3), 1);
    };
    if (SIT_POSES[pose] || pose === 'crouch') {
      const crouch = pose === 'crouch';
      const hip = legTop - 2;
      band(L.bottom, cx - (fd > 0 ? 4 : 7), 11, hip, 4); // thighs, forward
      const kx = fd > 0 ? cx + 4 : cx - 7;
      band(legC, kx, 3, hip + 4, Math.max(1, fy - 2 - (hip + 4)), false);
      shoe(fd > 0 ? kx : kx - 2, fy - 2, 5);
      if (crouch) {
        const k2 = fd > 0 ? cx - 4 : cx + 1;
        band(lit(legC, -1), k2, 3, hip + 4, Math.max(1, fy - 2 - (hip + 4)), false);
        shoe(fd > 0 ? k2 : k2 - 2, fy - 2, 5);
      }
    } else {
      const knee = legTop + Math.floor((fy - legTop) / 2);
      const lw = side ? 3 : 4;
      const frontLeg = side ? (fd > 0 ? cx : cx - 3) : cx;
      const backLeg = side ? (fd > 0 ? cx - 3 : cx) : cx - 4;
      let fo = 0;
      let bo = 0;
      if (wf === 1) {
        fo = 3 * fd;
        bo = -2 * fd;
      } else if (wf === 3) {
        fo = -2 * fd;
        bo = 3 * fd;
      }
      if (pose === 'dance') {
        fo = wf === 1 ? 2 * fd : 0;
        bo = wf === 3 ? -2 * fd : 0;
      }
      if (spec.legs) spec.legs({ P, band, shoe, legC, shoes, cx, legTop, knee, fy, fd, side, lw, lit, frontLeg, backLeg, t });
      else for (const [lx, off, far] of [[backLeg, bo, true], [frontLeg, fo, false]]) {
        const c = far && side ? lit(legC, -1) : legC;
        band(c, lx + Math.round(off / 2), lw, legTop, knee - legTop, !L.dress);
        band(c, lx + off, lw, knee, fy - 2 - knee, !L.dress);
        const sx = side ? (fd > 0 ? lx + off : lx + off - 2) : lx + off - (lx < cx ? 1 : 0);
        shoe(sx, fy - 2, side ? 5 : 4);
      }
      if (L.dress) {
        // a skirt flaring from the waist to below the knee
        // dancing, the hem flares in the turn and swings a beat behind the Charleston's bounce
        const flare = pose === 'pirouette' ? 2 : pose === 'charleston' && osc(t - 0.09, 8, 4) % 2 ? 1 : 0;
        for (let y = waist; y < knee + 3; y++) {
          const k = (y - waist) / (knee + 3 - waist);
          const w = Math.round(10 + k * 4) + (k > 0.6 ? flare * 2 : 0);
          band(L.bottom, cx - Math.floor(w / 2) - (side && fd < 0 ? 1 : 0), w, y, 1, true);
        }
        P(lit(L.bottom, -1), cx - 7, knee + 2, 14, 1);
      } else band(L.bottom, cx - (side ? 4 : 5), side ? 8 : 10, waist, legTop - waist + 1);
      if (spec.legsOver) spec.legsOver({ P, band, shoe, legC, shoes, cx, legTop, knee, fy, fd, side, lw, lit, frontLeg, backLeg, t, skirt: L.bottom });
    }

    // ----- torso -----
    const top = L.top;
    const tw = side ? 8 : 11;
    const tx = cx - (side ? 4 : 5);
    band(top, tx + 1, tw - 2, sy - 1, 1, false); // shoulder line
    for (let y = sy; y < waist; y++) {
      const taper = y > sy + 7 ? 1 : 0; // chest to waist
      band(top, tx + taper, tw - taper * 2 + (side ? 1 : 0), y, 1, true);
    }
    P(lit(top, -1), tx, waist - 1, tw, 1);
    if (L.top2 && !back) {
      if (d === 0) {
        P(L.top2, cx - 1, sy, 2, waist - sy);
        P(lit(L.top2, -1), cx, sy + 3, 1, waist - sy - 3);
        if (L.buttons) for (let y = sy + 3; y < waist; y += 3) P(L.buttons, cx - 2, y, 1, 1);
      } else {
        P(L.top2, fd > 0 ? cx + 2 : cx - 3, sy, 2, waist - sy);
        if (L.buttons) for (let y = sy + 3; y < waist; y += 3) P(L.buttons, fd > 0 ? cx + 1 : cx - 2, y, 1, 1);
      }
    }
    if (L.apron && !back) {
      band(L.apron, cx - 4, 8, sy + 5, legTop - sy + 1);
      P(L.apron, cx - 4, sy, 1, 5);
      P(L.apron, cx + 3, sy, 1, 5);
    }
    if (L.scarf) {
      band(L.scarf, cx - 4, 8, sy - 2, 3, false);
      P(L.scarf, back ? cx - 1 : fd > 0 ? cx + 1 : cx - 2, sy + 1, 2, 6);
      P(lit(L.scarf, -1), back ? cx - 1 : fd > 0 ? cx + 1 : cx - 2, sy + 6, 2, 1);
    }

    if (L.bowtie && !back) {
      // a bow tie at the collar (front: two wings and a knot; in profile, a wing past the collar)
      if (d === 0) {
        P(L.bowtie, cx - 2, sy - 1, 1, 2);
        P(lit(L.bowtie, -1), cx - 1, sy - 1, 2, 1);
        P(L.bowtie, cx + 1, sy - 1, 1, 2);
      } else P(L.bowtie, fd > 0 ? cx + 1 : cx - 2, sy - 1, 2, 2);
    }

    // ----- neck & head -----
    const slump = a.slump && !a.moving && !SIT_POSES[pose] ? 1 : 0;
    const hy = T + slump + (pose === 'sleep' ? 4 : 0) + ((spec && spec.headDy) || 0);
    const hx = cx - 4 + (side ? fd : 0) + (pose === 'sleep' ? 3 * fd : 0) + ((spec && spec.headDx) || 0) * fd + (pose === 'pirouette' && side ? fd : 0);
    P(lit(skin, -1), cx - 1, hy + 8, 3, sy - hy - 8); // neck, in the head's shadow
    if (side && B.theme !== 'cyber' && DANCE_POSES[pose]) {
      // a dark edge along the back and crown of her head, so it doesn't melt into the lamp-lit plaster
      // (the hair drawn a pixel back, then covered by the real hair and head)
      const hs = HAIR[L.hairStyle] || HAIR.short;
      spans(g, hs.side, hx - fd, hy, fd, '#4a3426', '#4a3426');
    }
    // head: rounded, narrowing to the jaw
    P(skin, hx + 1, hy, 6, 1);
    P(skin, hx, hy + 1, 8, 6);
    P(skin, hx + 1, hy + 7, 6, 1);
    P(skin, hx + 2, hy + 8, 4, 1);
    P(lit(skin, 1), hx + 1, hy + 1, 2, 1); // forehead catching the light
    P(lit(skin, -1), hx + 7, hy + 2, 1, 5); // shadowed cheek
    P(lit(skin, -1), hx + 6, hy + 7, 1, 1);
    if (side) {
      P(skin, fd > 0 ? hx + 8 : hx - 1, hy + 4, 1, 2); // nose
      P(lit(skin, -1), fd > 0 ? hx + 8 : hx - 1, hy + 5, 1, 1);
      P(lit(skin, -1), fd > 0 ? hx + 2 : hx + 5, hy + 3, 1, 2); // ear
    }
    const face = { ey: hy + 4, eyes: side ? [fd > 0 ? hx + 6 : hx + 1] : [hx + 2, hx + 5], front: fd > 0 ? hx + 7 : hx, profile: side };
    if (!back) drawFace(g, a, L, hx, hy, d, fd, P, face);
    const hair = HAIR[L.hairStyle] || HAIR.short;
    const which = back ? 'back' : d === 0 ? 'front' : 'side';
    let bunDx = 0;
    let bunDy = 0;
    if (L.hairStyle === 'bun' && !a.moving) {
      // the bun's follow-through: when the head moves, the bun trails it by a pixel for 0.12 s
      // (not across a turn or a new pose, and in profile only ever into the head, never opening a gap)
      const faceKey = `${d}|${back}|${pose}`;
      if (a._hpFace !== faceKey || !a._hp || t < a._hpT) {
        a._hpFace = faceKey;
        a._hp = a._hpPrev = [hx, hy];
        a._hpT = -1;
      } else if (a._hp[0] !== hx || a._hp[1] !== hy) {
        a._hpPrev = a._hp;
        a._hp = [hx, hy];
        a._hpT = t;
      }
      if (a._hpT >= 0 && t - a._hpT < 0.12) {
        bunDx = Math.max(-1, Math.min(1, a._hpPrev[0] - hx));
        bunDy = Math.max(-1, Math.min(1, a._hpPrev[1] - hy));
        if (side && Math.sign(bunDx) === -fd) bunDx = 0;
      }
    }
    if (bunDx || bunDy) {
      const mir = d === 0 || back ? 1 : fd;
      spans(g, hair[which].filter((r) => r[0] >= 0), hx, hy, mir, L.hair, L.hair, hair.texture);
      spans(g, hair[which].filter((r) => r[0] < 0), hx + bunDx, hy + bunDy, mir, L.hair, L.hair, hair.texture);
    } else spans(g, hair[which], hx, hy, d === 0 || back ? 1 : fd, L.hair, L.hair, hair.texture);
    if (L.hairStyle === 'bald' && !L.hat) P(lit(skin, 2), hx + 2, hy + 1, 2, 1);
    if (L.hat) {
      const hat = HATS[L.hatStyle] || HATS.flat;
      spans(g, hat[which], hx, hy, d === 0 || back ? 1 : fd, L.hat, L.hat2 || '#f1f3f5');
    }
    if (L.glasses && !back) drawGlasses(g, L, hx, hy, d, fd, P, face);

    // ----- front arm & items -----
    drawArm(fsx, fJ, false);
    const fh = [fJ.h[0], fJ.h[1] + 1];
    const bh = [bJ.h[0], bJ.h[1] + 1];
    const mug = L.mug || '#f3efe6';
    for (const it of items) {
      switch (it) {
        case 'cigMouth':
        case 'cig':
          P('#f4efe6', fh[0] + (fd > 0 ? 1 : -3), fh[1] - 1, 3, 1);
          P(Math.floor(t * 3) % 2 ? '#ff6a3a' : '#e03a1a', fh[0] + (fd > 0 ? 4 : -4), fh[1] - 1, 1, 1);
          break;
        case 'cupMouth':
        case 'cup':
          P(mug, fh[0] - 1, fh[1] - 2, 3, 3);
          P(lit(mug, -1), fh[0] + 1, fh[1] - 2, 1, 3);
          P(mug, fd > 0 ? fh[0] + 2 : fh[0] - 2, fh[1] - 1, 1, 1);
          if (it === 'cup' && osc(t, 1.5) === 0) P('rgba(255,255,255,0.6)', fh[0], fh[1] - 5, 1, 2);
          break;
        case 'book': {
          const cover = a.bookC || '#2f4f8c';
          if (d === 0) {
            const bx = cx - 5;
            const by = fh[1] - 6;
            P(cover, bx, by, 10, 7);
            P('#f4efe2', bx + 1, by, 4, 6);
            P(lit('#f4efe2', -1), bx + 5, by, 4, 6);
            P(lit(cover, -1), bx + 4, by, 2, 7);
            for (let y = by + 2; y < by + 6; y += 2) {
              P('#b8b0a2', bx + 2, y, 2, 1);
              P('#a8a094', bx + 6, y, 2, 1);
            }
          } else {
            const bx = fh[0] - 2;
            P(cover, bx, fh[1] - 7, 4, 8);
            P('#f4efe2', fd > 0 ? bx : bx + 1, fh[1] - 6, 3, 6);
          }
          break;
        }
        case 'bookHug':
          P(a.bookC || '#8c2f2f', cx - 3, sy + 4, 6, 8);
          P(lit(a.bookC || '#8c2f2f', 1), cx - 3, sy + 5, 6, 1);
          break;
        case 'bookSmall':
          P(a.bookC || '#8c2f2f', fh[0] - 1, fh[1] - 1, 3, 6);
          P('#f4efe2', fd > 0 ? fh[0] + 1 : fh[0] - 1, fh[1], 1, 4);
          break;
        case 'parcel':
        case 'parcelSmall': {
          const w = it === 'parcel' ? 8 : 5;
          const px0 = it === 'parcel' ? fh[0] - (fd > 0 ? 2 : 6) : fh[0] - 2;
          P('#c9a26b', px0, fh[1] - 2, w, 4);
          P(lit('#c9a26b', -1), px0, fh[1] + 1, w, 1);
          P('#8a6a3a', px0 + Math.floor(w / 2), fh[1] - 2, 1, 4);
          break;
        }
        case 'paper':
          P('#f4efe2', fh[0] - 3, fh[1] + 1, 6, 1);
          break;
        case 'receiver':
          P(B.theme === 'cyber' ? '#14161c' : '#9c2b23', bh[0] - 1, bh[1] - 2, 2, 7);
          break;
        case 'mobile':
          P('#2b2b30', bh[0] - 1, bh[1] - 2, 2, 4);
          P('#9fd3ff', bh[0] - 1, bh[1] - 1, 1, 2);
          break;
        case 'bag':
          P(L.bagC || '#6b4a2e', bh[0] - 3, bh[1] + 1, 6, 8);
          P(lit(L.bagC || '#6b4a2e', -1), bh[0] + 1, bh[1] + 1, 2, 8);
          P(lit(L.bagC || '#6b4a2e', 1), bh[0] - 3, bh[1] + 1, 6, 1);
          break;
        case 'box':
          P('#b08850', cx - 7, sy + 5, 14, 11);
          P(lit('#b08850', 1), cx - 7, sy + 5, 14, 1);
          P(lit('#b08850', -1), cx + 4, sy + 6, 3, 10);
          P('#d9c9a0', cx - 7, sy + 9, 14, 1);
          break;
        case 'stack':
          ['#8c2f2f', '#2f4f8c', '#3c6e47', '#c9a13b', '#6a4c93'].forEach((c, i) => {
            P(c, cx - 6 + (i % 2), sy + 3 + i * 3, 12, 3);
            P(lit(c, -1), cx + 4 + (i % 2), sy + 3 + i * 3, 2, 3);
          });
          break;
        case 'broom':
          B.line(g, fh[0], fh[1] - 8, fh[0] + 7 * fd, fy - 4, '#8a6a3a');
          P('#c9a24a', fh[0] + 7 * fd - 3, fy - 4, 7, 4);
          break;
        case 'broomUp':
          B.line(g, fh[0], fh[1] - 14, fh[0], fy - 4, '#8a6a3a');
          P('#c9a24a', fh[0] - 3, fy - 4, 7, 4);
          break;
        case 'can':
          P('#7d8a96', fh[0] - 2, fh[1] - 2, 6, 4);
          B.line(g, fh[0] + 4 * fd, fh[1] - 1, fh[0] + 8 * fd, fh[1] - 4, '#7d8a96');
          break;
        case 'uke': {
          // a little ukulele held across the body: the body at the strumming hand, the neck out to the fretting hand
          const ux = cx - 3;
          const uy = sy + 8 + (spec.streak ? 1 : 0); // the instrument gives under the down-stroke
          const body = B.theme === 'cyber' ? '#3ff5ff' : '#c03a2a'; // red, to stand out from her cardigan
          P(body, ux, uy, 7, 4);
          P(body, ux + 1, uy - 1, 4, 1);
          P(lit(body, -1), ux, uy + 3, 7, 1);
          P('#f0e0c0', ux, uy, 1, 4); // a pale rim
          P('#1a1010', ux + 3, uy + 1, 2, 2); // the sound hole
          B.line(g, ux + (fd > 0 ? 0 : 6), uy + 1, bh[0], bh[1] - 1, '#7a4a20'); // the neck
          P('#e8dcc0', Math.round((ux + (fd > 0 ? 0 : 6) + bh[0]) / 2), Math.round((uy + 1 + bh[1] - 1) / 2), 1, 1); // a fret dot
          P('#e8dcc0', bh[0] - 1, bh[1] - 2 - (spec.streak ? 1 : 0), 2, 1); // the headstock
          if (spec.streak) P(B.theme === 'cyber' ? '#9ff8ff' : '#f0d8b8', fh[0], fh[1] - 3, 1, 2); // the strum's motion trail
          break;
        }
        case 'jazz':
          // jazz hands, and a string of pearls swinging
          for (const [hx2, hy2] of [fh, bh]) {
            P(skin, hx2 - 2, hy2 - 2, 1, 1);
            P(skin, hx2, hy2 - 3, 1, 1);
            P(skin, hx2 + 2, hy2 - 2, 1, 1);
          }
          {
            const sw = osc(t - 0.06, 4) ? 1 : -1; // the pearls trail the arms
            for (let i = 0; i < 5; i++) {
              const px2 = cx - 2 + i + sw * (i > 1 && i < 4 ? 1 : 0);
              const py2 = sy + 3 + (i === 0 || i === 4 ? 0 : i === 2 ? 2 : 1);
              P('#8a7a60', px2, py2 + 1, 1, 1);
              P('#f4f0e8', px2, py2, 1, 1);
            }
          }
          break;
        case 'gadget': {
          // a slim silver rod with a glowing tip: out along the pointing arm, upright when held up to read
          const up = pose === 'reach' || pose === 'shake';
          const glow = B.theme === 'cyber' ? '#3ff5ff' : '#7dff6a';
          const tx = up ? fh[0] : fh[0] + 4 * fd;
          const ty = up ? fh[1] - 5 : fh[1] - 1;
          if (up) P('#9aa0a8', fh[0], fh[1] - 4, 1, 4);
          else P('#9aa0a8', fd > 0 ? fh[0] + 1 : fh[0] - 3, fh[1] - 1, 3, 1);
          P(lit('#9aa0a8', -2), fh[0], fh[1], 1, 1); // the grip
          if (a.gadgetOn && (Math.floor(t * 14) + Math.floor(t * 5)) % 3) {
            P(glow, tx, ty, 1, 1); // the tip, flickering as it sweeps
            P(B.theme === 'cyber' ? 'rgba(63,245,255,0.35)' : 'rgba(125,255,106,0.35)', tx - 1, ty - 1, 3, 3);
          } else P(lit(glow, -3), tx, ty, 1, 1);
          break;
        }
        case 'duster':
          P('#e87fa0', fh[0] - 2, fh[1] - 5, 4, 4);
          P('#f4a6bf', fh[0] - 1, fh[1] - 5, 2, 2);
          break;
        default:
          break;
      }
    }

    if (B.personAccents) B.personAccents(g, a, L, { cx, fy, T, sy, waist, legTop, hx, hy, d, fd, back, side, pose, fh, bh, brolly, P, face });
    if (brolly) {
      const sx = fh[0];
      const c = L.neon ? B.shade(a.umbrellaC || '#2f3e46', 0.6) : a.umbrellaC || '#2f3e46';
      const cy = T - 8;
      B.line(g, sx, fh[1], sx, cy, L.neon || '#2b2b2b'); // in the neon city the shaft lights up
      P(c, sx - 4, cy - 6, 9, 1);
      P(c, sx - 8, cy - 5, 17, 1);
      P(c, sx - 11, cy - 4, 23, 2);
      P(c, sx - 13, cy - 2, 27, 2);
      P(lit(c, 1), sx - 7, cy - 5, 6, 1);
      P(lit(c, 1), sx - 10, cy - 4, 5, 1);
      P(lit(c, -1), sx + 4, cy - 3, 9, 1);
      for (let i = -13; i <= 13; i += 4) P(L.neon || lit(c, -2), sx + i, cy, 2, 1);
      P('#2b2b2b', sx, cy - 8, 1, 2);
    }
  }

  // ---------- faces ----------
  // At this scale a face is a few well-placed pixels: dark eyes, a brow, a mouth. Expression lives mostly in the
  // posture and the speech bubble; the face just agrees with it.
  // her face while she dances: serene through the held, inward moments; a grin for the Charleston; humming to the uke
  const SERENE = { arabesque: [0.6, 3.0], portdebras: [3.0, 3.9], reverence: [1.3, 2.3], barre: [2.0, 3.6] };
  function danceExpr(a) {
    const p = a.pose;
    const pt = a.poseT || 0;
    const w = SERENE[p];
    if (w && pt >= w[0] && pt < w[1]) return 'serene';
    if (p === 'charleston') return 'happy';
    if (p === 'ukulele' || p === 'situke') return (a.t || 0) % 4.16 < 0.26 ? 'open' : 'happy'; // an 'o' of humming every two bars
    if (p === 'pirland' || p === 'reverence') return 'happy';
    return null;
  }
  function drawFace(g, a, L, hx, hy, d, fd, P, face) {
    const expr = (a.emoteKind ? null : danceExpr(a)) || (a.expr ? a.expr() : 'neutral');
    const { ey, eyes, profile } = face;
    const ink = '#1e1618';
    const blink = a.blinking > 0 && expr !== 'laugh';
    const lid = lit(L.skin, -1);
    for (const e of eyes) {
      if (expr === 'closed' || expr === 'serene' || blink || expr === 'laugh') P(lid, e, ey, 1, 1);
      else if (expr === 'tired') {
        P(lid, e, ey, 1, 1);
        P(ink, e, ey + 1, 1, 1);
      } else if (expr === 'smitten') P('#e03a6a', e, ey, 1, 1);
      else if (expr === 'surprised') P(ink, e, ey - 1, 1, 2);
      else P(ink, e, ey, 1, 1);
    }
    // brows (only where they show the mood)
    const bc = L.brow || lit(L.hair, -2);
    const br = { angry: 1, sad: -1, worried: -1 }[expr];
    if (br != null || expr === 'surprised' || expr === 'puzzled') {
      for (const e of eyes) {
        const inner = profile ? fd > 0 : e < hx + 4;
        const dy = expr === 'surprised' || (expr === 'puzzled' && e === eyes[eyes.length - 1]) ? -1 : 0;
        P(bc, e, ey - 2 + dy, 1, 1);
        if (br != null) P(bc, inner ? e + 1 : e - 1, ey - 2 + (br > 0 ? 1 : -1) + dy, 1, 1);
      }
    }
    // facial hair
    if (L.beard) {
      P(L.beard, hx + 1, hy + 6, 6, 2);
      P(L.beard, hx + 2, hy + 8, 4, 1);
      P(lit(L.beard, -1), hx + 6, hy + 6, 1, 2);
    }
    if (L.moustache) P(L.moustache, profile ? face.front - 2 : hx + 3, hy + 6, profile ? 2 : 2, 1);
    // mouth
    const m = profile ? (fd > 0 ? hx + 6 : hx + 1) : hx + 3;
    const my = hy + 7;
    const lip = L.beard ? '#3a1414' : B.mix(B.shade(L.skin, 0.6), '#7a2a2a', 0.5);
    const talking = a.emoteKind === 'talk' && osc(a.t || 0, 7) === 0;
    switch (talking ? 'open' : expr) {
      case 'happy':
      case 'smitten':
      case 'serene':
        P(lip, m, my, profile ? 1 : 2, 1);
        if (!profile) {
          P(lip, m - 1, my - 1, 1, 1);
          P(lip, m + 2, my - 1, 1, 1);
        }
        break;
      case 'laugh':
      case 'open':
      case 'surprised':
      case 'yawn':
        P('#3a1212', m, my - (expr === 'yawn' ? 1 : 0), profile ? 1 : 2, expr === 'yawn' ? 2 : 1);
        break;
      case 'sad':
      case 'angry':
        P(lip, m, my, profile ? 1 : 2, 1);
        if (!profile && expr === 'sad') {
          P(lip, m - 1, my + 1, 1, 1);
          P(lip, m + 2, my + 1, 1, 1);
        }
        break;
      case 'worried':
      case 'puzzled':
        P(lip, profile ? m : m + 1, my, 1, 1);
        break;
      default:
        P(lit(L.skin, -1), m, my, profile ? 1 : 2, 1);
    }
    if ((expr === 'happy' || expr === 'smitten' || expr === 'laugh') && !L.beard) {
      const pink = B.mix(L.skin, '#e86a6a', 0.35);
      if (profile) P(pink, fd > 0 ? hx + 4 : hx + 3, ey + 2, 1, 1);
      else {
        P(pink, hx + 1, ey + 2, 1, 1);
        P(pink, hx + 6, ey + 2, 1, 1);
      }
    }
    if (expr === 'sad' && a.mood != null && a.mood < 0.18) P('#74c0fc', eyes[eyes.length - 1], ey + 1, 1, 2);
  }

  function drawGlasses(g, L, hx, hy, d, fd, P, face) {
    const fc = L.glassesC || '#4a4038';
    const { ey, eyes, profile } = face;
    if (profile) {
      const e = eyes[0];
      P(fc, fd > 0 ? e - 1 : e, ey + (L.glasses === 'half' ? 1 : -1), 2, 1);
      if (L.glasses !== 'half') P(fc, fd > 0 ? e - 1 : e + 1, ey, 1, 1);
      P(fc, fd > 0 ? hx + 3 : hx + 2, ey, fd > 0 ? e - 1 - (hx + 3) : 1, 1);
      return;
    }
    if (L.glasses === 'half') {
      P(fc, hx + 1, ey + 1, 2, 1);
      P(fc, hx + 4, ey + 1, 2, 1);
      return;
    }
    // a thin rim over each eye and the bridge; the lenses just catch the light
    for (const e of eyes) {
      P(fc, e - 1, ey - 1, 3, 1);
      P('rgba(255,255,255,0.35)', e + 1, ey, 1, 1);
    }
    P(fc, hx + 3, ey, 2, 1);
  }

  // ---------- dogs ----------
  B.drawDog = (g, dog, dir, t) => {
    if (dog.alpha === 0) return;
    B.blit(g, dog.x, dog.y, (bg, cx, fy) => {
      const P = (c, x, y, w = 1, h = 1) => {
        bg.fillStyle = c;
        bg.fillRect(dir > 0 ? cx + x : cx - x - w, fy + y, w, h);
      };
      const c = dog.c;
      const dk = B.shade(c, 0.72);
      const f = dog.moving ? osc(t, 8) : 0;
      const wag = osc(t, dog.sniff > 0 ? 3 : 6);
      P(c, -8, -12 - wag, 2, 5); // tail
      P(c, -7, -10, 13, 6); // body
      P(dk, -7, -5, 13, 1);
      P(B.shade(c, 1.2), -5, -10, 8, 1);
      const sniff = dog.sniff > 0 ? 3 : 0;
      P(c, 4, -15 + sniff, 7, 7); // head
      P(dk, 4, -15 + sniff, 2, 5); // ear
      P(c, 10, -12 + sniff, 3, 3); // snout
      P('#111', 12, -12 + sniff, 1, 1); // nose
      P('#111', 8, -13 + sniff, 1, 1); // eye
      P(B.theme === 'cyber' ? '#3ff5ff' : '#c0392b', 4, -9 + sniff, 2, 2); // collar
      for (const [x, o] of [[-6, f], [-3, -f], [2, f], [4, -f]]) P(dk, x + o, -4, 2, 4);
    }, dog.alpha == null ? 1 : dog.alpha);
  };
})();
