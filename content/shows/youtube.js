/* 2026-10-08 (real telly)
 * Mabel's set can show actual YouTube videos: one programme per entry in content/tv/youtube.json (by default The
 * Last Word and Deadline: White House from MS NOW, and Generalist Gaming's EU5 videos), each pointing at its newest
 * matching video. A GitHub Action keeps the file current (the browser can't read YouTube's feeds itself).
 *
 * Across the street the set shows the video's thumbnail, pixelated like everything on that little screen. The real
 * video plays from the moment she switches on, unseen behind the scene and heard faintly through the flat's window:
 * passing traffic, the shop door, rain and sirens keep covering it, and a quiet late street lets it through. Open
 * the close-up (click the left upstairs window, or press T) and the same player, mid-programme, slides over the
 * panel and fades up clear. Its volume follows the music slider (on an iPhone a page can't set a video's volume,
 * so there the slider can only mute it). Mabel watches a clip to the end unless something interrupts her, and
 * picks a new MS NOW clip first until she's seen it through. */
(function (B) {
  const W = 64;
  const H = 48;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const progs = {}; // show id -> { the json entry, plus playback state }
  const SEEN_KEY = 'bookshop.tvSeen';
  let seen = {};
  try {
    seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || {};
  } catch (e) {
    /* private mode etc. */
  }
  const markSeen = (p) => {
    seen[p.key] = p.id;
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch (e) {
      /* ignore */
    }
  };

  // ---------- the picture across the street ----------
  function scene(p) {
    return {
      id: 'video',
      dur: 600,
      caption: p.title,
      draw(g, t) {
        B.px(g, '#0a0c14', 0, 0, W, H);
        if (p.thumbOk) {
          // the 4:3 thumbnail has letterbox bars: crop to the 16:9 picture, then a slow drift across it
          const iw = p.thumb.naturalWidth;
          const ih = p.thumb.naturalHeight;
          const ph = iw * (9 / 16);
          const py = (ih - ph) / 2;
          const zoom = 1.25 + 0.1 * Math.sin(t * 0.05);
          const sw = iw / zoom;
          const sh = Math.min(ph, (sw * H) / W);
          const sx = ((iw - sw) / 2) * (1 + 0.6 * Math.sin(t * 0.07));
          g.imageSmoothingEnabled = true;
          g.drawImage(p.thumb, sx, py + (ph - sh) / 2, sw, sh, 0, 0, W, H);
          g.imageSmoothingEnabled = false;
        } else for (let i = 0; i < 160; i++) B.px(g, Math.random() < 0.5 ? '#2a2c34' : '#14161c', Math.floor(Math.random() * W), Math.floor(Math.random() * H));
        // the lower third in the programme's colour, and a channel bug
        B.px(g, 'rgba(10,14,30,0.85)', 0, 37, W, 8);
        B.px(g, p.color || '#d02030', 0, 37, 3, 8);
        const tick = Math.floor(t * 8) % 200;
        for (let x = 0; x < W - 6; x += 2) if ((x + tick) % 9 < 6) B.px(g, '#e8ecf4', 5 + x, 40, 1, 2);
        B.px(g, 'rgba(255,255,255,0.85)', W - 10, 3, 7, 3);
        B.px(g, p.color || '#3a5ad0', W - 9, 4, 5, 1);
        for (let y = 0; y < H; y += 2) B.px(g, 'rgba(0,0,0,0.12)', 0, y, W, 1); // scanlines
      },
    };
  }
  function register(p) {
    const id = 'yt-' + p.key;
    const prev = progs[id];
    const info = Object.assign(prev || { pos: 0, state: null, ended: false, startedAt: 0 }, p);
    if (!prev || prev.thumbId !== p.id) {
      info.thumbOk = false;
      info.thumbId = p.id;
      info.pos = 0;
      if (typeof Image !== 'undefined') {
        info.thumb = new Image();
        info.thumb.crossOrigin = 'anonymous';
        info.thumb.onload = () => (info.thumbOk = true);
        info.thumb.src = `https://i.ytimg.com/vi/${p.id}/hqdefault.jpg`;
      }
    }
    progs[id] = info;
    B.show({
      id,
      name: p.name,
      genre: p.genre,
      color: p.color,
      likes: p.insist ? 1.4 : 0.5,
      scenes: [scene(info)],
      untilEnd: () => stillOn(info), // she watches it to the end
      preferred: () => !!p.insist && !!info.id && seen[p.key] !== info.id, // a new one first, till she's seen it through
    });
  }
  function load() {
    if (typeof fetch !== 'function') return;
    fetch('content/tv/youtube.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => (j.shows || []).filter((p) => p.id).forEach(register))
      .catch(() => {});
  }
  load();
  // the telly's on the news by default
  B.on('tick', (s) => {
    if (s.upstairs && !s.upstairs.show && progs['yt-lawrence']) s.upstairs.show = 'yt-lawrence';
  });

  function stillOn(info) {
    const age = Date.now() - info.startedAt;
    if (info.ended || age > 2 * 3600 * 1000) return false;
    return info.state != null || age < 30000; // (if it never starts playing, she gives up after half a minute)
  }

  // ---------- the real video ----------
  // One player for as long as the set's on a programme: it never moves in the page (moving an iframe reloads it), it
  // only changes where it sits and how loud it is.
  let player = null; // { id, info, frame, box }
  const send = (func, args = []) => {
    try {
      if (player && player.frame.contentWindow) player.frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch (e) {
      /* ignore */
    }
  };
  const panelOpen = () => {
    const p = typeof document !== 'undefined' && document.getElementById && document.getElementById('tvpanel');
    return !!p && !p.classList.contains('hidden');
  };

  // the volume: near (the close-up, inside the flat) or far (across the street, through the window, under the street)
  let openK = 0; // 0 far .. 1 near, eased
  let duckK = 1; // what the street leaves audible, eased
  let lastT = 0;
  let sent = -1;
  let sentAt = 0;
  const KIND = { bus: 1, emergency: 1, car: 0.7, turn: 0.5, bike: 0.25 };
  // every sound effect briefly covers the telly too, by how loud it is (the rest count as middling)
  const LOUD = { siren: 1, bell: 0.9, door: 0.8, shout: 0.8, ring: 0.8, bark: 0.7, laugh: 0.6, hydraulic: 0.7, thud: 0.6, clatter: 0.6, knock: 0.5, gust: 0.5, kettle: 0.5, till: 0.5 };
  const QUIET = { step: 0.12, squeak: 0.15, 'ac-drip': 0.05, purr: 0.15, coo: 0.2, click: 0.2, 'drone-hum': 0.15, buzz: 0.2, 'tv-click': 0, 'tng-talk': 0, 'br-talk': 0, 'br-rain': 0, tune: 0, pad: 0 };
  let fxPulse = 0;
  if (B.audio) B.audio.onPlay = (name) => {
    const w = name in QUIET ? QUIET[name] : LOUD[name] || 0.4;
    fxPulse = Math.max(fxPulse, w);
  };
  /** How much of the telly the street is covering right now (1 = none of it). */
  function streetMask(s) {
    let traffic = 0;
    for (const ev of B.trafficEvents || []) {
      const k = clamp(ev.t / ev.dur, 0, 1);
      const env = Math.pow(Math.sin(Math.PI * k), 2); // loudest as it passes the window
      traffic = Math.max(traffic, env * (KIND[ev.kind] || 0.5));
    }
    const w = s.weather || {};
    const door = (s.door && s.door.openT) > 0 ? 1 : 0;
    const fx = B.audio && B.audio.levels ? Math.min(1, B.audio.levels.fx / 0.8) : 1; // (you can't be drowned out by what you can't hear)
    let m = 1 - fx * (0.7 * traffic + 0.35 * (w.rain || 0) + 0.15 * door + 0.2 * Math.max(0, (w.cloud || 0) - 0.7) + 0.65 * fxPulse);
    // a still, empty street late in the evening lets it through
    const h = s.hour;
    const late = h >= 21.5 || h < 5.5;
    const people = s.npcs ? s.npcs.filter((n) => n.area === 'street' && !n.hidden).length : 0;
    if (late && !people && !(B.trafficEvents || []).length && !(w.rain > 0.2)) m *= 1.2;
    return clamp(m, 0.25, 1.2);
  }
  function step(s) {
    const now = performance.now() / 1000;
    const dt = lastT ? clamp(now - lastT, 0, 0.25) : 0;
    lastT = now;
    openK += ((panelOpen() ? 1 : 0) - openK) * clamp(dt / 0.45, 0, 1); // a fade, not a jump
    fxPulse *= Math.exp(-dt / 0.5); // each effect's cover lasts about as long as it does
    const target = streetMask(s);
    duckK += (target - duckK) * clamp(dt / (target < duckK ? 0.06 : 0.9), 0, 1); // ducks at once, recovers slowly
  }
  function level() {
    const A = B.audio;
    if (!A || !A.enabled) return 0;
    const v = A.levels ? A.levels.music : 0.8;
    const base = Math.min(1, 1.25 * v * v);
    const far = 0.18 * duckK;
    const near = 1 - 0.35 * (1 - Math.min(1, duckK)); // the close-up: you're in the flat, but the street still cuts in a little
    return Math.round(clamp(base * (far + (near - far) * openK), 0, 1) * 100);
  }
  function applyVolume(force) {
    const v = level();
    const t = performance.now();
    if (!force && (v === sent || t - sentAt < 120)) return;
    sent = v;
    sentAt = t;
    if (v <= 0) send('mute');
    else {
      send('unMute');
      send('setVolume', [v]);
    }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', (e) => {
      if (!player || e.source !== player.frame.contentWindow) return;
      let d = e.data;
      try {
        d = typeof d === 'string' ? JSON.parse(d) : d;
      } catch (err) {
        return;
      }
      if (!d) return;
      const info = player.info;
      if (d.event === 'onReady') {
        send('playVideo'); // (an unseen player doesn't always autoplay on its own)
        applyVolume(true);
      }
      const i = d.info;
      if (i && typeof i === 'object') {
        if (typeof i.currentTime === 'number') info.pos = i.currentTime;
        if (typeof i.duration === 'number' && i.duration > 0) info.dur = i.duration;
        if (typeof i.playerState === 'number') {
          if (info.state !== i.playerState && i.playerState === 1) applyVolume(true); // (re)started: make it audible
          info.state = i.playerState;
          if (i.playerState === 0) {
            info.ended = true;
            markSeen(info);
          }
        }
      }
    });
  }
  function create(id) {
    const info = progs[id];
    const box = document.createElement('div');
    box.className = 'tvYouTubeBox';
    const frame = document.createElement('iframe');
    frame.title = info.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');
    const origin = encodeURIComponent(location.origin);
    const start = info.ended ? 0 : Math.floor(info.pos || 0);
    info.ended = false;
    info.state = null;
    info.startedAt = Date.now();
    // starts muted (browsers only autoplay silently), then unmutes once the player is ready
    frame.src = `https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&mute=1&playsinline=1&rel=0&controls=1&enablejsapi=1&start=${start}&origin=${origin}`;
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'tv' }), '*');
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => (send('playVideo'), applyVolume(true)), 800);
      setTimeout(() => (send('playVideo'), applyVolume(true)), 2500);
    });
    box.appendChild(frame);
    document.body.appendChild(box);
    player = { id, info, frame, box };
    sent = -1;
  }
  function destroy() {
    if (player) player.box.remove(); // stops it
    player = null;
  }
  /** Where the player sits: over the panel's screen when it's open, else hidden behind the scene. */
  function place() {
    const cv = document.getElementById('tvCanvas');
    const slot = document.getElementById('tvYouTubeSlot');
    const panel = document.getElementById('tvpanel');
    const open = panelOpen();
    if (cv) cv.style.display = open ? 'none' : '';
    if (slot) slot.style.display = open ? 'block' : 'none';
    if (panel) panel.classList.toggle('wide', open);
    const st = player.box.style;
    if (open && slot) {
      const r = slot.getBoundingClientRect();
      Object.assign(st, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: '1', pointerEvents: 'auto', zIndex: '6' });
    } else {
      const sc2 = document.getElementById('screen');
      const r = sc2 ? sc2.getBoundingClientRect() : { left: 0, top: 0 };
      Object.assign(st, { left: r.left + 'px', top: r.top + 'px', width: '320px', height: '180px', opacity: '0', pointerEvents: 'none', zIndex: '0' });
    }
  }
  function sync(s) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    step(s);
    const n = B.tv.now(s);
    const id = s.upstairs.tv && n && progs[n.show.id] && progs[n.show.id].id ? n.show.id : null;
    if (player && player.id !== id) destroy();
    if (id && !player) create(id);
    if (!player) {
      const cv = document.getElementById('tvCanvas');
      const slot = document.getElementById('tvYouTubeSlot');
      const panel = document.getElementById('tvpanel');
      if (cv) cv.style.display = '';
      if (slot) slot.style.display = 'none';
      if (panel) panel.classList.remove('wide');
      return;
    }
    place();
    applyVolume(false);
    // while she's watching with the close-up shut, keep it going (unstarted, cued or stalled): you can pause it yourself
    // in the close-up
    const st = player.info.state;
    if (!panelOpen() && (st === -1 || st === 5) && Date.now() - (player.nudged || 0) > 3000) {
      player.nudged = Date.now();
      send('playVideo');
    }
  }
  B.on('tick', sync);
  B.on('ready', () => {
    // a slot in the panel for the player to sit over
    const cv = document.getElementById && document.getElementById('tvCanvas');
    if (!cv || document.getElementById('tvYouTubeSlot')) return;
    const slot = document.createElement('div');
    slot.id = 'tvYouTubeSlot';
    slot.className = 'tvYouTube';
    slot.style.display = 'none';
    cv.insertAdjacentElement('afterend', slot);
  });
  B.tvYouTube = { progs, player: () => player, level, mask: () => duckK, open: () => openK };
})(window.Bookshop);
