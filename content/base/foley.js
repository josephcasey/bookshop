/* Foley & ambience. Everything is synthesised, panned to where it happens on screen, and
 * triggered by watching the world each tick (footfalls, poses, props), plus a scheduler for
 * off-screen life: passing cars, distant horns and barks, birds, church bells, sirens.
 * Shop sounds go through the muffled "glass" bus; street sounds are heard directly.
 * Tweak rates in AMBIENCE below, or add your own with B.audio.define + B.on('tick'). */
(function (B) {
  const pan = (x) => B.clamp(x / 160 - 1, -0.9, 0.9);

  // ---------- sounds ----------
  const D = B.audio.define;
  // footsteps: built like real ones from a soft low heel thud, a quieter sole tap and a toe roll-off, each step
  // varied a little. Shoes change the tap (heels click, boots clump, trainers barely make one) and the surface
  // changes the rest (wet pavement splashes, snow crunches, the shop's boards are heard through the glass).
  D('step', ({ tone, noise, street, shop }, x, surface, loud = 1, shoe = 'flat') => {
    const v = loud * B.rnd(0.75, 1.1);
    const wood = surface === 'wood';
    const o = { pan: pan(x), bus: wood ? shop : street, lp: loud < 0.45 ? 1700 : null };
    if (surface === 'snow') {
      for (let i = 0; i < 5; i++) noise(0.02, { ...o, at: i * 0.018 + B.rnd(0, 0.01), freq: B.rnd(900, 2300), q: 2, vol: 0.006 * v, a: 0.002, r: 0.015 });
      noise(0.06, { ...o, ftype: 'lowpass', freq: 280, vol: 0.012 * v, a: 0.003, r: 0.05 });
      return;
    }
    // heel strike
    noise(0.05, { ...o, ftype: 'lowpass', freq: wood ? 420 : B.rnd(240, 320), q: 0.7, vol: (wood ? 0.02 : 0.016) * v, a: 0.002, r: 0.04 });
    // the sole meeting the ground
    const heel = shoe === 'heel';
    const tapF = heel ? B.rnd(2400, 3200) : shoe === 'boot' ? B.rnd(650, 950) : B.rnd(1100, 1600);
    const tapV = heel ? 0.009 : shoe === 'trainer' ? 0.0022 : shoe === 'boot' ? 0.006 : 0.0045;
    noise(heel ? 0.018 : 0.03, { ...o, freq: tapF, q: heel ? 3 : 1.2, vol: tapV * v, at: heel ? 0 : 0.012, a: 0.001, r: 0.02 });
    // toe rolling off, a little later and quieter
    noise(0.035, { ...o, freq: B.rnd(500, 900), q: 0.8, vol: 0.0035 * v, at: B.rnd(0.06, 0.09), a: 0.004, r: 0.025 });
    if (surface === 'wet') noise(0.08, { ...o, freq: B.rnd(1800, 2600), q: 0.9, vol: 0.006 * v, at: 0.01, a: 0.01, r: 0.06 });
    if (wood && Math.random() < 0.06) tone(B.rnd(170, 240), 0.14, { ...o, type: 'triangle', vol: 0.004, slide: B.rnd(150, 200) }); // a board creaks
  });
  /** What someone has on their feet, decided once per person from their look. */
  const shoeOf = (a) => {
    if (a._shoe) return a._shoe;
    const L = a.look || {};
    const h = B.hash((L.top || '') + (L.bottom || '') + (L.hair || '') + (a.id || ''));
    if (L === B.looks.owner || L === B.looks['owner-night']) return L === B.looks.owner ? 'flat' : 'trainer'; // sensible shoes; slippers at night
    a._shoe = L === B.looks.courier ? 'boot' : L.dress && h % 3 === 0 ? 'heel' : ['flat', 'trainer', 'trainer', 'boot', 'flat'][h % 5];
    return a._shoe;
  };
  D('bark', ({ tone, noise, street }, x, far = false) => {
    const k = far ? 0.2 : 1;
    const opts = { pan: far ? B.rnd(-0.9, 0.9) : pan(x), bus: street, lp: far ? 900 : null };
    const f = B.rnd(320, 460);
    const n = B.pick([1, 2, 2, 3]);
    for (let i = 0; i < n; i++) {
      const at = i * B.rnd(0.18, 0.26);
      tone(f, 0.11, { ...opts, type: 'sawtooth', slide: f * 0.65, vol: 0.05 * k, at });
      noise(0.08, { ...opts, freq: 900, q: 1.5, vol: 0.04 * k, at });
    }
  });
  D('carPass', ({ noise, tone, street }, fromLeft) => {
    const dur = B.rnd(2.2, 3.4);
    const l = fromLeft ? -0.9 : 0.9;
    noise(dur, { ftype: 'lowpass', freq: 220, fpeak: B.rnd(700, 1100), fto: 200, q: 0.8, vol: 0.05, a: dur / 2, r: dur / 2, pan: l, panTo: -l, bus: street });
    tone(B.rnd(55, 75), dur, { type: 'sawtooth', vol: 0.006, a: dur / 2, lp: 300, pan: l, panTo: -l, bus: street });
  });
  D('horn', ({ tone, street }) => {
    const p = B.rnd(-0.9, 0.9);
    const base = B.pick([392, 440, 466]);
    const honks = B.pick([1, 2, 2]);
    for (let i = 0; i < honks; i++) {
      const at = i * 0.32;
      const d = B.rnd(0.18, 0.4);
      tone(base, d, { type: 'square', vol: 0.012, at, pan: p, lp: 1200, bus: street });
      tone(base * 1.26, d, { type: 'square', vol: 0.009, at, pan: p, lp: 1200, bus: street });
    }
  });
  D('birds', ({ tone, street }) => {
    const p = B.rnd(-0.9, 0.9);
    const f = B.rnd(2600, 3800);
    for (let i = 0, at = 0; i < B.irnd(3, 7); i++, at += B.rnd(0.09, 0.22))
      tone(f * B.rnd(0.9, 1.15), 0.06, { vol: 0.009, slide: f * B.rnd(1.1, 1.4), at, pan: p, bus: street });
  });
  D('churchBell', ({ tone, street }, strikes) => {
    for (let i = 0; i < strikes; i++) {
      const at = i * 2.1;
      tone(392, 2.8, { vol: 0.02, at, lp: 1400, pan: -0.6, bus: street });
      tone(784, 1.6, { vol: 0.007, at, lp: 1400, pan: -0.6, bus: street });
      tone(466, 2.2, { vol: 0.006, at, lp: 1400, pan: -0.6, bus: street });
    }
  });
  D('siren', ({ tone, street }) => {
    const p = B.rnd(-0.8, 0.8);
    for (let i = 0; i < 4; i++) {
      tone(700, 0.7, { type: 'triangle', vol: 0.006, slide: 950, at: i * 1.4, lp: 1000, pan: p, bus: street });
      tone(950, 0.7, { type: 'triangle', vol: 0.006, slide: 700, at: i * 1.4 + 0.7, lp: 1000, pan: p, bus: street });
    }
  });
  D('owl', ({ tone, street }) => {
    const p = B.rnd(-0.9, 0.9);
    tone(440, 0.35, { vol: 0.012, slide: 400, a: 0.08, lp: 900, pan: p, bus: street });
    tone(430, 0.7, { vol: 0.01, slide: 380, a: 0.1, at: 0.6, lp: 900, pan: p, bus: street });
  });
  D('gust', ({ noise, street }) => noise(B.rnd(2.5, 4), { ftype: 'lowpass', freq: 300, fpeak: 700, fto: 250, vol: 0.03, a: 1.5, r: 1.5, pan: B.rnd(-0.5, 0.5), bus: street }));
  D('thunder', ({ noise, tone, street }) => {
    noise(3.5, { ftype: 'lowpass', freq: 120, fpeak: 260, fto: 60, q: 0.7, vol: 0.09, a: 0.15, r: 2.5, bus: street });
    tone(45, 2.5, { type: 'sawtooth', vol: 0.02, lp: 150, a: 0.2, bus: street });
  });
  D('chatter', ({ tone, street }, x) => {
    // two people passing in conversation, too far to make out
    const p = x == null ? B.rnd(-0.9, 0.9) : pan(x);
    for (let i = 0, at = 0; i < B.irnd(6, 12); i++, at += B.rnd(0.12, 0.3)) {
      const f = (i % 5 < 3 ? 190 : 250) * B.rnd(0.85, 1.15);
      tone(f, 0.12, { type: 'sawtooth', vol: 0.006, slide: f * B.rnd(0.85, 1.1), at, lp: 900, pan: p, bus: street });
    }
    if (B.chance(0.3)) for (let i = 0; i < 4; i++) tone(320, 0.08, { type: 'sawtooth', vol: 0.006, slide: 280, at: 2 + i * 0.13, lp: 1000, pan: p, bus: street });
  });
  // shop foley (muffled through the glass)
  D('page', ({ noise, shop }, x) => noise(0.14, { freq: 4500, q: 0.7, vol: 0.025, a: 0.04, pan: pan(x), bus: shop }));
  D('scratch', ({ noise, shop }, x) => {
    for (let i = 0; i < 3; i++) noise(0.03, { freq: 6000, q: 3, vol: 0.02, at: i * 0.07, pan: pan(x), bus: shop });
  });
  D('rustle', ({ noise, shop }, x) => noise(B.rnd(0.25, 0.45), { freq: 3000, q: 0.6, vol: 0.025, a: 0.08, pan: pan(x), bus: shop }));
  D('tape', ({ noise, shop }, x) => noise(0.45, { freq: 1400, fto: 2600, q: 2, vol: 0.035, a: 0.02, pan: pan(x), bus: shop }));
  D('bookThump', ({ tone, noise, shop }, x) => {
    tone(150, 0.08, { type: 'triangle', vol: 0.04, pan: pan(x), bus: shop });
    noise(0.05, { freq: 900, vol: 0.02, pan: pan(x), bus: shop });
  });
  D('swish', ({ noise, shop }, x) => noise(0.3, { freq: 2600, q: 0.8, vol: 0.02, a: 0.12, pan: pan(x), bus: shop }));
  D('clink', ({ tone, shop }, x) => {
    tone(2900, 0.18, { vol: 0.02, pan: pan(x), bus: shop });
    tone(4300, 0.1, { vol: 0.01, pan: pan(x), bus: shop });
  });
  D('sip', ({ noise, shop }, x) => noise(0.28, { freq: 1300, q: 5, vol: 0.02, a: 0.05, pan: pan(x), bus: shop }));
  D('clap', ({ noise, shop }, x) => noise(0.04, { freq: 1600, q: 0.8, vol: 0.05, pan: pan(x), bus: shop }));
  D('creak', ({ tone, shop }, x) => tone(190, 0.28, { type: 'sawtooth', slide: 140, vol: 0.008, lp: 900, pan: pan(x), bus: shop }));
  D('keys', ({ tone, shop }, x) => tone(B.pick([1300, 1450, 1600]), 0.025, { type: 'square', vol: 0.012, pan: pan(x), bus: shop }));
  D('trickle', ({ tone, shop }, x) => {
    for (let i = 0; i < 4; i++) tone(B.rnd(1500, 2600), 0.03, { vol: 0.01, at: i * 0.06, pan: pan(x), bus: shop });
  });
  D('squeak', ({ tone, shop }, x) => {
    tone(3600, 0.05, { vol: 0.02, slide: 4300, pan: pan(x), bus: shop });
    tone(3900, 0.05, { vol: 0.016, slide: 4600, at: 0.09, pan: pan(x), bus: shop });
  });
  D('snore', ({ noise, shop }, x) => {
    noise(1.1, { ftype: 'lowpass', freq: 180, fpeak: 320, fto: 160, q: 2, vol: 0.02, a: 0.5, r: 0.5, pan: pan(x), bus: shop });
    noise(0.8, { ftype: 'lowpass', freq: 400, vol: 0.006, a: 0.3, r: 0.4, at: 1.4, pan: pan(x), bus: shop });
  });
  D('pad', ({ tone, shop }, x) => tone(90, 0.05, { type: 'triangle', vol: 0.02, pan: pan(x), bus: shop }));
  // upstairs: fainter still
  D('thumpUp', ({ tone, shop }, x) => tone(70, 0.08, { type: 'triangle', vol: 0.03, pan: pan(x), bus: shop }));
  D('tvMurmur', ({ tone, shop }) => {
    for (let i = 0, at = 0; i < 5; i++, at += B.rnd(0.12, 0.25)) {
      const f = B.rnd(150, 260);
      tone(f, 0.12, { type: 'sawtooth', vol: 0.004, slide: f * 0.9, at, lp: 700, pan: -0.5, bus: shop });
    }
  });
  D('kettle', ({ noise, tone, shop }) => {
    noise(3, { ftype: 'lowpass', freq: 200, fto: 900, vol: 0.012, a: 2, pan: 0.3, bus: shop });
    tone(1700, 1.2, { vol: 0.006, slide: 2100, a: 0.4, at: 2.2, pan: 0.3, bus: shop });
  });

  // ---------- off-screen life ----------
  // perSec: expected events per real second (the scheduler ignores speed-up, so 10x doesn't spam).
  const AMBIENCE = [
    { id: 'car', sound: 'carPass', perSec: (s, h) => (h < 6 ? 0.02 : h < 7 ? 0.05 : h < 20 ? 0.11 : 0.05), args: () => [B.chance(0.5)] },
    { id: 'horn', sound: 'horn', perSec: (s, h) => (h >= 7 && h < 20 ? 0.022 : 0.004) },
    { id: 'farBark', sound: 'bark', perSec: (s, h) => (h < 6 || h >= 21 ? 0.02 : 0.012), args: () => [0, true] },
    { id: 'birds', sound: 'birds', perSec: (s, h) => (s.weather.rain > 0.4 ? 0 : h >= 5 && h < 9 ? 0.2 : h >= 9 && h < 19 ? 0.04 : 0) },
    { id: 'chatter', sound: 'chatter', perSec: (s, h) => (h >= 8 && h < 21 ? 0.025 : 0.004) },
    { id: 'siren', sound: 'siren', perSec: (s, h) => (h < 6 || h >= 22 ? 0.003 : 0.001) },
    { id: 'owl', sound: 'owl', perSec: (s, h) => (h < 5 || h >= 22 ? 0.008 : 0) },
    { id: 'gust', sound: 'gust', perSec: (s) => (s.weather.kind === 'clear' ? 0.004 : 0.03) },
    { id: 'thunder', sound: 'thunder', perSec: (s) => (s.weather.rain > 0.8 ? 0.012 : 0) },
  ];
  B.ambience = AMBIENCE; // tweakable from daily files

  // ---------- pose-driven foley: [sound, seconds between] ----------
  const POSE_LOOP = {
    read: ['page', 5], sitread: ['page', 6], write: ['scratch', 0.7], wrap: ['rustle', 0.8], till: ['keys', 0.22],
    unpack: ['rustle', 0.9], dust: ['swish', 0.7], sweep: ['swish', 0.55], clap: ['clap', 0.17], water: ['trickle', 0.45],
    sleep: ['snore', 3.2],
  };
  const POSE_ENTER = { drink: 'sip', shelve: 'bookThump', sit: 'creak', sitread: null, crouch: 'creak' };

  let lastHour = null;
  let stepsThisSec = 0;
  let secT = 0;

  function actorFoley(s, a, rdt) {
    if (a.hidden || a.area === 'away') return;
    const where = a.area;
    const pose = a.moving ? a.movePose || 'walk' : a.pose;
    // footfalls on walk frames 1 and 3
    if (a.moving) {
      const f = Math.floor(a.walkT * 7) % 4;
      if (f !== a._ff && (f === 1 || f === 3) && stepsThisSec < 8 && (a.alpha == null || a.alpha > 0.5)) {
        stepsThisSec++;
        // the near lane is clear, the far side of the pavement softer and duller; upstairs barely at all
        const near = where === 'street' ? 0.35 + (a.lane + 3) * 0.06 : where === 'upstairs' ? 0.12 : 0.5;
        const surface = where === 'street' ? ((s.weather.cover || 0) > 0.3 ? 'snow' : s.weather.rain > 0.4 ? 'wet' : 'street') : 'wood';
        B.audio.play('step', a.x, surface, near * (a.speed > 80 ? 1.3 : 1), shoeOf(a));
      }
      a._ff = f;
    }
    if (where === 'street') return;
    // pose entered
    if (pose !== a._fp) {
      const snd = POSE_ENTER[pose];
      if (snd) B.audio.play(snd, a.x);
      if (where === 'upstairs' && (pose === 'cheer' || pose === 'crouch')) B.audio.play('thumpUp', a.x);
      a._fp = pose;
      a._fl = 0.3;
    }
    // pose loops
    const loop = POSE_LOOP[pose];
    if (loop) {
      a._fl = (a._fl || 0) - rdt;
      if (a._fl <= 0) {
        a._fl = loop[1] * B.rnd(0.7, 1.3);
        B.audio.play(loop[0], a.x);
      }
    }
  }

  const watch = {};
  B.on('tick', (s, dt) => {
    if (!B.audio.on()) return;
    const rdt = dt / Math.max(1, (s.speed || 1) * (s.ff || 1)); // real seconds
    secT += rdt;
    if (secT >= 1) {
      secT = 0;
      stepsThisSec = 0;
    }
    const h = s.hour;

    // people
    actorFoley(s, s.owner, rdt);
    for (const n of s.npcs) {
      actorFoley(s, n, rdt);
      // dogs: the odd woof, and a proper barking fit if they spot the shop cat in the window
      if (n.dog && n.area === 'street' && n.x > -10 && n.x < 330) {
        const cat = s.cat;
        const seesCat = cat && cat.surface === 'sill' && Math.abs(cat.x - n.dog.x) < 30 && !n.dog.barkedAtCat;
        if (seesCat) {
          n.dog.barkedAtCat = true;
          n.dog.sniff = 2;
          B.audio.play('bark', n.dog.x);
          if (cat.pose === 'sleep' || cat.pose === 'loaf') cat.pose = 'sit';
          cat.emote && cat.emote('angry', 1.5);
        } else if (Math.random() < rdt * 0.03) B.audio.play('bark', n.dog.x);
      }
    }

    // props
    if (s.counter.cup && !watch.cup) B.audio.play('clink', 178);
    watch.cup = s.counter.cup;
    if (s.boxes.length < (watch.boxes || 0) || (s.counter.box && !watch.box)) B.audio.play('tape', 190);
    watch.boxes = s.boxes.length;
    watch.box = s.counter.box;
    if (s.upstairs.kettle && !watch.kettle) B.audio.play('kettle');
    watch.kettle = s.upstairs.kettle;
    if (s.upstairs.tv && Math.random() < rdt * 0.6) B.audio.play('tvMurmur');
    if (s.mouse && Math.random() < rdt * 0.8) B.audio.play('squeak', s.mouse.x);
    const cat = s.cat;
    if (cat) {
      if (watch.catPose === 'jump' && cat.pose !== 'jump' && cat.surface !== 'floor') B.audio.play('pad', cat.x);
      watch.catPose = cat.pose;
    }

    // off-screen life
    for (const amb of AMBIENCE) {
      if (Math.random() < rdt * amb.perSec(s, h)) B.audio.play(amb.sound, ...(amb.args ? amb.args() : []));
    }
    // church clock strikes the hour between 8am and 8pm
    const hr = Math.floor(h);
    if (lastHour !== null && hr !== lastHour && hr >= 8 && hr <= 20) B.audio.play('churchBell', hr % 12 || 12);
    lastHour = hr;
  });
  B.on('jump', () => (lastHour = null)); // no bells when jumping about with the time control
})(window.Bookshop);
