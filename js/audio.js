/* Synthesised sound. Everything from inside the shop goes through a low-pass "glass" filter,
 * which opens up while the door is open. Muted until the viewer turns sound on. */
(function () {
  'use strict';
  const B = window.Bookshop;
  const A = (B.audio = { enabled: false });
  let ctx = null;
  let out, glass, shop, street, radioIn, noiseBuf, rainG, ambG;
  let musicG, fxShopG, fxStreetG; // the viewer's volume controls
  let tvIn, tvLp, tvG; // the telly upstairs: faint through the window, clear when you're watching
  let tvOpen = false;
  // viewer levels 0..1 (slider positions), remembered per browser
  const LEVELS_KEY = 'bookshop.volume';
  A.levels = { music: 0.8, fx: 0.8 };
  try {
    Object.assign(A.levels, JSON.parse(localStorage.getItem(LEVELS_KEY)) || {});
  } catch (e) {
    /* private mode etc. */
  }
  const levelGain = (v) => 1.5 * v * v; // a gentler curve than linear; 0.8 ≈ the original mix
  const last = {};
  let radioSt = null;
  let radioNext = 0;
  let radioStep = 0;
  let mel = 4;
  // live internet radio: one <audio> element, fed into the same tinny speaker as the generated stations
  let streamEl = null;
  let streamRetry = 0;
  A.streamStatus = null; // null | 'tuning' | 'playing' | 'error'

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(ctx.destination);
    glass = ctx.createBiquadFilter();
    glass.type = 'lowpass';
    glass.frequency.value = 1400;
    glass.Q.value = 0.5;
    glass.connect(out);
    // effects: everything on the shop and street buses (the radio has its own path into the glass)
    fxShopG = ctx.createGain();
    fxShopG.connect(glass);
    fxStreetG = ctx.createGain();
    fxStreetG.connect(out);
    musicG = ctx.createGain();
    musicG.connect(glass);
    A.meters = { music: ctx.createAnalyser(), fx: ctx.createAnalyser(), stream: ctx.createAnalyser() };
    for (const m of Object.values(A.meters)) m.fftSize = 512;
    musicG.connect(A.meters.music);
    fxShopG.connect(A.meters.fx);
    fxStreetG.connect(A.meters.fx);
    tvIn = ctx.createGain();
    tvLp = ctx.createBiquadFilter();
    tvLp.type = 'lowpass';
    tvLp.frequency.value = 700;
    tvG = ctx.createGain();
    tvIn.connect(tvLp);
    tvLp.connect(tvG);
    tvG.connect(out);
    shop = ctx.createGain();
    shop.connect(fxShopG);
    street = ctx.createGain();
    street.connect(fxStreetG);
    applyLevels();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 220;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    radioIn = ctx.createGain();
    radioIn.gain.value = 0.9;
    radioIn.connect(hp);
    hp.connect(lp);
    lp.connect(musicG);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rainG = loopNoise('lowpass', 1600, 0.4);
    ambG = loopNoise('lowpass', 320, 0.7);
    setInterval(radioTick, 50);
    return true;
  }

  function loopNoise(type, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(street);
    src.start();
    return g;
  }

  function gap(name, sec) {
    const now = performance.now();
    if (last[name] && now - last[name] < sec * 1000) return false;
    last[name] = now;
    return true;
  }

  function tone(f, dur, o = {}) {
    const t = ctx.currentTime + Math.max(0, o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const g = ctx.createGain();
    const v = o.vol || 0.1;
    const a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    osc.connect(g);
    route(g, o, t, dur);
    osc.start(t);
    osc.stop(t + a + dur + 0.05);
  }

  /** Send a node to its bus, optionally via a stereo panner (o.pan → o.panTo) and a low-pass (o.lp). */
  function route(node, o, t, dur) {
    let n = node;
    if (o.pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(B.clamp(o.pan, -1, 1), t);
      if (o.panTo != null) p.pan.linearRampToValueAtTime(B.clamp(o.panTo, -1, 1), t + dur);
      n.connect(p);
      n = p;
    }
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      n.connect(f);
      n = f;
    }
    n.connect(o.bus || shop);
  }

  function noise(dur, o = {}) {
    const t = ctx.currentTime + Math.max(0, o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.fto) {
      // optional filter sweep, e.g. a car coming and going: freq → fpeak → fto
      if (o.fpeak) f.frequency.exponentialRampToValueAtTime(o.fpeak, t + dur / 2);
      f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    }
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const v = o.vol || 0.05;
    const a = o.a || 0.01;
    const r = o.r || 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    route(g, o, t, dur);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function trill(at, dur) {
    const t = ctx.currentTime + at;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = o2.type = 'triangle';
    o1.frequency.value = 1180;
    o2.frequency.value = 1420;
    const m = ctx.createGain();
    m.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 20;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(m.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.01);
    g.gain.setValueAtTime(0.06, t + dur - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(m);
    o2.connect(m);
    m.connect(g);
    g.connect(shop);
    [o1, o2, lfo].forEach((x) => {
      x.start(t);
      x.stop(t + dur + 0.05);
    });
  }

  const SFX = {
    bell() {
      if (!gap('bell', 0.3)) return;
      const o = { bus: street };
      tone(1568, 1.6, { ...o, vol: 0.14 });
      tone(2350, 1.0, { ...o, vol: 0.05 });
      tone(3140, 0.6, { ...o, vol: 0.025 });
      tone(1568, 1.2, { ...o, vol: 0.06, at: 0.16 });
      tone(2350, 0.8, { ...o, vol: 0.025, at: 0.16 });
    },
    door() {
      if (!gap('door', 0.3)) return;
      tone(110, 0.18, { type: 'triangle', vol: 0.16, slide: 70, bus: street });
      noise(0.08, { freq: 400, q: 0.8, vol: 0.04, bus: street });
    },
    ring() {
      if (!gap('ring', 1.5)) return;
      trill(0, 0.4);
      trill(0.6, 0.4);
    },
    till() {
      if (!gap('till', 0.4)) return;
      noise(0.06, { freq: 3000, vol: 0.04 });
      tone(2637, 0.5, { vol: 0.07, at: 0.05 });
      tone(3520, 0.7, { vol: 0.05, at: 0.12 });
    },
    knock() {
      if (!gap('knock', 0.3)) return;
      [0, 0.14, 0.28].forEach((at) => {
        tone(180, 0.07, { type: 'triangle', vol: 0.22, at, bus: street, slide: 120 });
        noise(0.03, { freq: 1200, q: 1, vol: 0.05, at, bus: street });
      });
    },
    steam(sec = 4) {
      if (!gap('steam', 1)) return;
      noise(sec, { freq: 2800, q: 0.7, vol: 0.035, a: 0.6, r: 0.6 });
      for (let i = 0; i < 5; i++) tone(90 + Math.random() * 60, 0.15, { vol: 0.04, at: 0.5 + Math.random() * (sec - 1) });
    },
    clunk() {
      if (!gap('clunk', 0.25)) return;
      tone(520, 0.08, { type: 'triangle', vol: 0.05, bus: street, slide: 400 });
    },
    click() {
      if (!gap('click', 0.1)) return;
      tone(1600, 0.02, { type: 'square', vol: 0.03 });
    },
    tune() {
      noise(0.6, { freq: 1500, q: 2, vol: 0.03, bus: radioIn });
    },
    pop() {
      tone(880, 0.08, { vol: 0.05, slide: 1320 });
    },
  };

  // ---------- generative radio ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function radioTick() {
    if (!A.enabled || !ctx || !radioSt || ctx.state !== 'running') return;
    const st = radioSt;
    const spb = 60 / (st.tempo || 100) / 2; // one eighth-note
    if (radioNext < ctx.currentTime) radioNext = ctx.currentTime + 0.05;
    while (radioNext < ctx.currentTime + 0.3) {
      try {
        radioStepFn(st, radioStep++, radioNext, spb);
      } catch (e) {
        console.warn(e);
      }
      radioNext += spb;
    }
  }

  function radioStepFn(st, i, t, spb) {
    if (st.stream) {
      // hiss and crackle while a live station is tuning in (or has gone off air)
      if (A.streamStatus !== 'playing') noise(spb * 1.1, { bus: radioIn, at: t - ctx.currentTime, freq: 2500, q: 0.4, vol: A.streamStatus === 'error' ? 0.012 : 0.022 });
      return;
    }
    if (st.music === false) return talk(st, i, t, spb);
    const scale = st.scale || B.scales.major;
    const n = scale.length;
    const root = st.root || 60;
    const nt = (deg) => root + scale[((deg % n) + n) % n] + 12 * Math.floor(deg / n);
    const beats = st.meter || 4;
    const per = beats * 2;
    const bar = Math.floor(i / per);
    const k = i % per;
    const prog = st.prog || [0, 3, 4, 0];
    const ch = prog[bar % prog.length];
    const swing = k % 2 === 1 ? spb * (st.swing || 0) : 0;
    const o = { bus: radioIn, at: t + swing - ctx.currentTime };
    const drums = {
      kick: (v = 0.1) => {
        tone(170, 0.14, { ...o, vol: v, slide: 55 });
        noise(0.05, { ...o, ftype: 'lowpass', freq: 400, vol: v * 0.5 });
      },
      snare: (v = 0.035) => noise(0.12, { ...o, freq: 2200, q: 0.7, vol: v }),
      hat: (v = 0.014, f = 8000) => noise(0.03, { ...o, freq: f, q: 1.2, vol: v }),
      rim: (v = 0.03) => tone(1800, 0.03, { ...o, type: 'square', vol: v * 0.4, lp: 3000 }),
    };
    const chordTones = st.sevenths ? [0, 2, 4, 6] : [0, 2, 4];
    const style = RADIO_STYLES[st.style];
    const plain = !style || !style.ownBass;
    if (plain && (k === 0 || (beats === 4 && k === 4)))
      tone(mtof(nt(ch) - 12), spb * 1.7, { ...o, type: st.bass || 'triangle', vol: 0.09 });
    if (k === 0 && st.pad !== false)
      chordTones.forEach((x) =>
        tone(mtof(nt(ch + x)), spb * per * 0.9, { ...o, type: st.pad || 'sine', vol: st.padVol || 0.022, a: st.padA || 0.05 })
      );
    if (style) style.step({ st, i, k, ch, per, spb, o, nt, drums, chordTones });
    if (Math.random() < (st.density == null ? 0.5 : st.density)) {
      mel = B.clamp(mel + B.pick([-2, -1, -1, 0, 1, 1, 2]), 0, n * 2);
      if (k === 0) {
        const opts = [ch, ch + 2, ch + 4, ch + n];
        mel = opts.reduce((best, x) => (Math.abs(x - mel) < Math.abs(best - mel) ? x : best), opts[0]);
      }
      const dur = spb * B.pick(st.leadDurs || [0.9, 0.9, 1.8]);
      tone(mtof(nt(mel) + 12 * (st.octave || 0)), dur, { ...o, type: st.lead || 'square', vol: st.leadVol || 0.028, lp: st.leadLp, slide: st.bend && Math.random() < st.bend ? mtof(nt(mel) + 12 * (st.octave || 0) - 1) : undefined });
    }
  }

  /* What each radio style adds on top of the shared bass / pad / melody. One step = one eighth-note;
   * k is the step within the bar (0..per-1). A new style is a new entry here, then any station can use it. */
  const RADIO_STYLES = {
    waltz: { step: ({ k, ch, spb, o, nt }) => (k === 2 || k === 4) && [2, 4].forEach((x) => tone(mtof(nt(ch + x)), spb * 0.8, { ...o, type: 'triangle', vol: 0.028 })) },
    pop: {
      step: ({ k, drums }) => {
        if (k % 2 === 1) drums.hat(0.018, 6000);
        if (k === 2 || k === 6) drums.snare(0.04);
      },
    },
    jazz: { step: ({ k, drums }) => k % 2 === 0 && drums.hat(0.012, 7000) },
    folk: { step: ({ k, ch, spb, o, nt }) => k % 2 === 0 && tone(mtof(nt(ch + 4)), spb * 0.5, { ...o, type: 'triangle', vol: 0.02 }) },
    // neon-soaked synthwave: four-on-the-floor, driving octave saw bass, sixteenth-note arpeggios
    synth: {
      ownBass: true,
      step: ({ i, k, ch, spb, o, nt, drums, chordTones }) => {
        if (k % 2 === 0) drums.kick(0.12);
        if (k === 2 || k === 6) drums.snare(0.05);
        drums.hat(k % 2 ? 0.022 : 0.01, 9500);
        tone(mtof(nt(ch) - 12 * (k % 2 ? 1 : 2)), spb * 0.7, { ...o, type: 'sawtooth', vol: 0.045, lp: 700 });
        const arp = [...chordTones, 7];
        [0, 0.5].forEach((h, j) =>
          tone(mtof(nt(ch + arp[(i * 2 + j) % arp.length]) + 12), spb * 0.4, { ...o, at: o.at + h * spb, type: 'square', vol: 0.014, lp: 2600 })
        );
      },
    },
    // crunchy power chords and a backbeat
    rock: {
      ownBass: true,
      step: ({ k, ch, spb, o, nt, drums }) => {
        if (k === 0 || k === 3 || k === 4) drums.kick(0.12);
        if (k === 2 || k === 6) drums.snare(0.055);
        drums.hat(0.015, 7000);
        const r = nt(ch) - 12;
        [0, 7, 12].forEach((x) => tone(mtof(r + x), spb * 0.85, { ...o, type: 'sawtooth', vol: 0.016, lp: 1500 }));
        tone(mtof(r - 12), spb * 0.9, { ...o, type: 'triangle', vol: 0.08 });
      },
    },
    // one-drop: offbeat chord skanks, the kick on beat three
    reggae: {
      step: ({ k, ch, spb, o, nt, drums, chordTones }) => {
        if (k % 2 === 1) chordTones.forEach((x) => tone(mtof(nt(ch + x)), spb * 0.3, { ...o, type: 'square', vol: 0.012, lp: 1800 }));
        if (k === 4) {
          drums.kick(0.12);
          drums.rim(0.05);
        }
        if (k % 2 === 1) drums.hat(0.01, 7500);
      },
    },
    // twelve-bar shuffle with a walking bass
    blues: {
      ownBass: true,
      step: ({ k, ch, spb, o, nt, drums }) => {
        if (k % 2 === 0) tone(mtof(nt(ch + [0, 2, 4, 5][(k / 2) % 4]) - 12), spb * 1.6, { ...o, type: 'triangle', vol: 0.085 });
        if (k === 2 || k === 6) drums.snare(0.03);
        drums.hat(k % 2 ? 0.012 : 0.008, 6500);
      },
    },
    // lo-fi beats: lazy kick/snare, sevenths, vinyl crackle
    lofi: {
      step: ({ k, spb, o, drums }) => {
        if (k === 0 || k === 5) drums.kick(0.09);
        if (k === 4) drums.snare(0.03);
        if (k % 2 === 1) drums.hat(0.007, 6000);
        for (let c = 0; c < 3; c++) if (Math.random() < 0.5) noise(0.006, { ...o, at: o.at + Math.random() * spb, freq: 3000 + Math.random() * 4000, q: 3, vol: 0.02 });
      },
    },
    // harpsichord continuo: an Alberti bass under running eighths
    baroque: {
      ownBass: true,
      step: ({ k, ch, spb, o, nt }) => tone(mtof(nt(ch + [0, 4, 2, 4][k % 4]) - 12), spb * 0.5, { ...o, type: 'sawtooth', vol: 0.02, lp: 2200 }),
    },
    // bossa nova: syncopated bass, clave rim clicks, soft chord comping
    bossa: {
      ownBass: true,
      step: ({ k, ch, spb, o, nt, drums, chordTones }) => {
        if (k === 0 || k === 3 || k === 4 || k === 7) tone(mtof(nt(ch + (k === 3 || k === 7 ? 4 : 0)) - 12), spb * 0.9, { ...o, type: 'sine', vol: 0.09 });
        if ([0, 3, 6].includes(k)) drums.rim(0.04);
        if (k === 1 || k === 4 || k === 6) chordTones.forEach((x) => tone(mtof(nt(ch + x)), spb * 0.6, { ...o, type: 'triangle', vol: 0.012 }));
        drums.hat(0.006, 5000);
      },
    },
    // drifting pads, no drums
    ambient: { step: ({ k, ch, spb, per, o, nt }) => k === 4 && tone(mtof(nt(ch + 4) + 12), spb * per, { ...o, type: 'sine', vol: 0.012, a: 1.2 }) },
  };

  function talk(st, i, t, spb) {
    if (i % 16 >= 12) return; // pauses between phrases
    if (Math.random() < 0.75) {
      const base = (st.voice || 150) * (1 + (Math.random() - 0.5) * 0.3);
      tone(base, spb * 0.7, { bus: radioIn, at: t - ctx.currentTime, type: 'sawtooth', vol: 0.028, slide: base * B.pick([0.85, 1.1, 0.95]) });
    }
  }

  function applyLevels() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicG.gain.setTargetAtTime(levelGain(A.levels.music), t, 0.03);
    const fx = levelGain(A.levels.fx);
    fxShopG.gain.setTargetAtTime(fx, t, 0.03);
    fxStreetG.gain.setTargetAtTime(fx, t, 0.03);
    // the telly follows the music level; much quieter (and muffled) unless you're watching it
    tvG.gain.setTargetAtTime(levelGain(A.levels.music) * (tvOpen ? 1 : 0.22), t, 0.1);
    tvLp.frequency.setTargetAtTime(tvOpen ? 9000 : 650, t, 0.1);
  }
  /** Watching the TV close up (the TV panel is open) makes it louder and clearer. */
  A.setTvOpen = (open) => {
    tvOpen = !!open;
    applyLevels();
  };

  // ---------- public API ----------
  /** Set the viewer's music (radio) or fx (everything else) level, 0..1. */
  A.setLevel = (which, v) => {
    A.levels[which] = Math.max(0, Math.min(1, v));
    applyLevels();
    applyDirect();
    try {
      localStorage.setItem(LEVELS_KEY, JSON.stringify(A.levels));
    } catch (e) {
      /* ignore */
    }
  };
  A.enable = () => {
    try {
      // iOS Safari 16.4+: play like a media app, so the ringer's silent switch doesn't mute the shop
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) {
      /* older Safari */
    }
    if (!ctx && !init()) return;
    ctx.resume();
    // iOS unlocks audio only from inside a tap: start a 1-sample silent buffer right now
    try {
      const b = ctx.createBufferSource();
      b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      b.connect(ctx.destination);
      b.start(0);
    } catch (e) {
      /* ignore */
    }
    A.enabled = true;
    syncStream();
  };
  // iOS suspends ('interrupted') the context when the phone locks or another app takes the audio; pick it up again on
  // the next touch, or when the page comes back
  const wake = () => {
    if (!A.enabled || !ctx || ctx.state === 'running') return;
    ctx.resume().then(() => syncStream()).catch(() => {});
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake());
    for (const ev of ['touchend', 'pointerdown', 'keydown']) document.addEventListener(ev, wake, { passive: true });
  }
  A.disable = () => {
    A.enabled = false;
    if (ctx) ctx.suspend();
    syncStream();
  };
  A.play = (name, ...args) => {
    if (!A.enabled || !ctx || ctx.state !== 'running') return;
    try {
      if (SFX[name]) SFX[name](...args);
    } catch (e) {
      console.warn('[bookshop] sfx', name, e);
    }
  };
  /** Add a sound for content: B.audio.define('meow', ({tone, noise}) => tone(700, .3, {slide: 500})) */
  A.define = (name, fn) => {
    // shop = sounds heard through the shop glass (muffled), street = out on the pavement.
    // tone/noise accept { at, vol, a, r, pan (-1..1), panTo, lp, bus, ... }.
    SFX[name] = (...args) => fn({ tone, noise, shop, street, tv: tvIn, bus: { shop: () => shop, street: () => street, tv: () => tvIn } }, ...args);
  };
  A.on = () => !!(A.enabled && ctx && ctx.state === 'running');
  A.radio = (st) => {
    radioSt = st || null;
    radioStep = 0;
    if (ctx) radioNext = ctx.currentTime + 0.15;
    syncStream();
  };

  function setStreamStatus(v) {
    if (A.streamStatus === v) return;
    A.streamStatus = v;
    B.emit('radio-status', B.world, v, radioSt);
  }
  /** Start, switch or stop the live stream to match the current station and sound setting. */
  function syncStream() {
    const url = A.enabled && ctx && radioSt && radioSt.stream;
    if (direct) {
      // already playing streams directly (this browser can't route them): just follow the station
      if (!url) {
        direct.pause();
        direct.removeAttribute('src');
        setStreamStatus(null);
      } else {
        if (direct.getAttribute('src') !== url) {
          direct.src = url;
          setStreamStatus('tuning');
        }
        direct.play().catch(() => setStreamStatus('error'));
        applyDirect();
      }
      return;
    }
    if (!url) {
      if (streamEl && streamEl.getAttribute('src')) {
        streamEl.pause();
        streamEl.removeAttribute('src'); // stop downloading
        streamEl.load();
      }
      setStreamStatus(null);
      return;
    }
    if (!streamEl) {
      streamEl = new Audio();
      streamEl.crossOrigin = 'anonymous'; // needed to route it through WebAudio (the stream must send CORS headers)
      streamEl.preload = 'none';
      const g = ctx.createGain();
      g.gain.value = radioSt.gain || 1.6;
      ctx.createMediaElementSource(streamEl).connect(g);
      g.connect(radioIn);
      g.connect(A.meters.stream);
      streamEl._gain = g;
      streamEl.addEventListener('playing', () => {
        streamRetry = 0;
        setStreamStatus('playing');
        checkRouted();
      });
      streamEl.addEventListener('waiting', () => setStreamStatus('tuning'));
      streamEl.addEventListener('error', () => {
        if (!streamEl.getAttribute('src')) return;
        setStreamStatus('error');
        // live streams drop out: try again a few times, then give up until retuned
        if (streamRetry++ < 4) setTimeout(() => radioSt && radioSt.stream && ((streamEl.src = radioSt.stream), streamEl.play().catch(() => {})), 8000);
      });
    }
    streamEl._gain.gain.value = radioSt.gain || 1.6;
    if (streamEl.getAttribute('src') !== url) {
      streamRetry = 0;
      streamEl.src = url;
      setStreamStatus('tuning');
    }
    streamEl.play().catch((e) => {
      console.warn('[bookshop] stream', url, e && e.message);
      setStreamStatus('error');
    });
  }
  // ---------- is the stream reaching Web Audio? ----------
  const rms = (an) => {
    if (!an) return 0;
    const d = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(d);
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
    return Math.sqrt(sum / d.length);
  };
  A.rms = (which) => rms(A.meters && A.meters[which]);
  let direct = null; // the fallback: an unrouted element
  function checkRouted() {
    if (direct) return;
    setTimeout(() => {
      if (!streamEl || streamEl.paused || A.streamStatus !== 'playing') return;
      if (rms(A.meters.stream) > 1e-5) return; // coming through: the music slider controls it
      // silence through Web Audio while the element says it's playing: play it directly instead
      console.warn('[bookshop] stream silent through Web Audio; playing it directly');
      direct = new Audio();
      direct.src = streamEl.src;
      streamEl.pause();
      streamEl.removeAttribute('src');
      direct.addEventListener('playing', () => setStreamStatus('playing'));
      direct.play().catch(() => setStreamStatus('error'));
      applyDirect();
    }, 3000);
  }
  function applyDirect() {
    if (!direct) return;
    direct.volume = Math.min(1, levelGain(A.levels.music) / 1.5); // ignored on iOS...
    direct.muted = A.levels.music < 0.02 || !A.enabled; // ...but muting works everywhere
  }
  A.streamDirect = () => !!direct;

  A.update = (s) => {
    if (!ctx || !A.enabled) return;
    const t = ctx.currentTime;
    rainG.gain.setTargetAtTime(s.weather.rain * 0.06, t, 0.5);
    // distant traffic hum: busier by day, slowly swelling and ebbing
    ambG.gain.setTargetAtTime((0.01 + 0.016 * B.daylight(s.hour) + 0.005 * Math.sin(t * 0.13)) * (1 - 0.6 * (s.weather.snow || 0)) * (1 - 0.3 * (s.weather.fog || 0)), t, 1);
    glass.frequency.setTargetAtTime(s.door.openT > 0 ? 5000 : 1300, t, 0.08);
  };
})();
