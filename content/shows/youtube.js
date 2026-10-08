/* 2026-10-08 (real telly)
 * Mabel's set can show an actual YouTube video: by default the newest "Lawrence:" segment from MS NOW's channel
 * (youtube.com/@msnow), kept current by a GitHub Action that writes content/tv/youtube.json (the browser can't read
 * YouTube's feeds itself).
 *
 * Across the street the set shows the video's thumbnail, pixelated like everything on that little screen, with a
 * slow camera drift, the channel's bug and a lower third. Open the telly close up (click the left upstairs window,
 * or press T) and the real video plays there; its volume follows the music slider (on an iPhone, where a web page
 * can't set a video's volume, the slider can only mute it). */
(function (B) {
  const W = 64;
  const H = 48;
  const info = { id: null, title: 'MS NOW', channel: 'MS NOW' };
  let thumb = null;
  let thumbOk = false;

  function load() {
    if (typeof fetch !== 'function') return;
    fetch('content/tv/youtube.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        Object.assign(info, j);
        if (typeof Image === 'undefined') return;
        thumb = new Image();
        thumb.crossOrigin = 'anonymous';
        thumb.onload = () => (thumbOk = true);
        thumb.src = `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
        sc.caption = info.title;
      })
      .catch(() => {});
  }

  const sc = {
    id: 'video',
    dur: 600,
    caption: 'MS NOW',
    react: 'puzzled',
    draw(g, t) {
      B.px(g, '#0a0c14', 0, 0, W, H);
      if (thumbOk) {
        // the 4:3 thumbnail has letterbox bars: crop to the 16:9 picture, then a slow drift across it
        const iw = thumb.naturalWidth;
        const ih = thumb.naturalHeight;
        const ph = iw * (9 / 16);
        const py = (ih - ph) / 2;
        const zoom = 1.25 + 0.1 * Math.sin(t * 0.05);
        const sw = iw / zoom;
        const sh = Math.min(ph, (sw * H) / W);
        const sx = ((iw - sw) / 2) * (1 + 0.6 * Math.sin(t * 0.07));
        g.imageSmoothingEnabled = true;
        g.drawImage(thumb, sx, py + (ph - sh) / 2, sw, sh, 0, 0, W, H);
        g.imageSmoothingEnabled = false;
      } else {
        for (let i = 0; i < 160; i++) B.px(g, Math.random() < 0.5 ? '#2a2c34' : '#14161c', Math.floor(Math.random() * W), Math.floor(Math.random() * H));
      }
      // the lower third and the channel's bug
      B.px(g, 'rgba(10,20,60,0.85)', 0, 37, W, 8);
      B.px(g, '#d02030', 0, 37, 3, 8);
      const tick = Math.floor(t * 8) % 200;
      for (let x = 0; x < W - 6; x += 2) if ((x + tick) % 9 < 6) B.px(g, '#e8ecf4', 5 + x, 40, 1, 2); // the headline, too small to read
      B.px(g, 'rgba(255,255,255,0.85)', W - 10, 3, 7, 3); // the bug, top right
      B.px(g, '#3a5ad0', W - 9, 4, 5, 1);
      // a little telly glass: scanlines
      for (let y = 0; y < H; y += 2) B.px(g, 'rgba(0,0,0,0.12)', 0, y, W, 1);
    },
  };

  B.show({
    id: 'youtube',
    name: 'MS NOW: The Last Word',
    genre: 'News, from YouTube',
    color: '#d02030',
    likes: 1.6, // her programme, these days
    untilEnd: () => !info.stillOn || info.stillOn(), // she watches it to the end
    preferred: () => !!info.id && info.seenId !== info.id, // the newest clip, until she's seen it through
    setup: load,
    scenes: [sc],
  });
  load();

  // the telly's on this by default
  B.on('tick', (s) => {
    if (s.upstairs && !s.upstairs.show) s.upstairs.show = 'youtube';
  });

  // ---------- the real video ----------
  // One player for as long as the set's on this channel: it never moves in the page (moving an iframe reloads it), it
  // only changes where it sits. With the close-up panel shut it plays unseen behind the scene, quietly, like a telly
  // heard across the street; open the panel and the same player, mid-programme, is laid over it at full level.
  let frame = null;
  let box = null;
  const send = (func, args = []) => {
    try {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch (e) {
      /* ignore */
    }
  };
  const panelOpen = () => {
    const p = typeof document !== 'undefined' && document.getElementById && document.getElementById('tvpanel');
    return !!p && !p.classList.contains('hidden');
  };
  /** Its level: the music slider (and the sound switch); about a fifth of that from across the street. */
  const level = () => {
    const A = B.audio;
    if (!A || !A.enabled) return 0;
    const v = A.levels ? A.levels.music : 0.8;
    return Math.round(Math.min(1, 1.25 * v * v) * (panelOpen() ? 100 : 22));
  };
  let lastLevel = -1;
  function applyVolume() {
    const v = level();
    lastLevel = v;
    if (v <= 0) send('mute');
    else {
      send('unMute');
      send('setVolume', [v]);
    }
  }
  // the player reports back: where it's got to, and when it ends
  info.pos = 0;
  info.state = null;
  info.ended = false;
  info.startedAt = 0;
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      let d = e.data;
      try {
        d = typeof d === 'string' ? JSON.parse(d) : d;
      } catch (err) {
        return;
      }
      if (!d) return;
      if (d.event === 'onReady') applyVolume();
      const i = d.info;
      if (i && typeof i === 'object') {
        if (typeof i.currentTime === 'number') info.pos = i.currentTime;
        if (typeof i.duration === 'number' && i.duration > 0) info.dur = i.duration;
        if (typeof i.playerState === 'number') {
          if (info.state !== i.playerState && i.playerState === 1) applyVolume(); // (re)started: make sure it's audible
          info.state = i.playerState;
          if (i.playerState === 0) {
            info.ended = true;
            info.seenId = info.id;
          }
        }
      }
    });
  }
  function create(s) {
    box = document.createElement('div');
    box.className = 'tvYouTubeBox';
    frame = document.createElement('iframe');
    frame.title = info.title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.setAttribute('allowfullscreen', '');
    const origin = encodeURIComponent(location.origin);
    const start = info.ended ? 0 : Math.floor(info.pos || 0);
    info.ended = false;
    info.startedAt = Date.now();
    // starts muted (browsers only autoplay silently), then unmutes once the player is ready
    frame.src = `https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&mute=1&playsinline=1&rel=0&controls=1&enablejsapi=1&start=${start}&origin=${origin}`;
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'tv' }), '*');
      } catch (e) {
        /* ignore */
      }
      setTimeout(applyVolume, 800);
      setTimeout(applyVolume, 2500);
    });
    box.appendChild(frame);
    document.body.appendChild(box);
  }
  function destroy() {
    if (box) box.remove(); // stops it
    box = null;
    frame = null;
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
    if (open && slot) {
      const r = slot.getBoundingClientRect();
      Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: '1', pointerEvents: 'auto', zIndex: '6' });
    } else {
      // tucked behind the canvas, still playing
      const sc2 = document.getElementById('screen');
      const r = sc2 ? sc2.getBoundingClientRect() : { left: 0, top: 0 };
      Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: '320px', height: '180px', opacity: '0', pointerEvents: 'none', zIndex: '0' });
    }
  }
  function sync(s) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const n = B.tv.now(s);
    const on = s.upstairs.tv && n && n.show.id === 'youtube' && info.id;
    if (on && !frame) create(s);
    else if (!on && frame) destroy();
    if (!frame) {
      const cv = document.getElementById('tvCanvas');
      const slot = document.getElementById('tvYouTubeSlot');
      if (cv) cv.style.display = '';
      if (slot) slot.style.display = 'none';
      const panel = document.getElementById('tvpanel');
      if (panel) panel.classList.remove('wide');
      return;
    }
    place();
    if (level() !== lastLevel) applyVolume(); // the slider, the sound switch, the panel opening and closing
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
  /** For Mabel's watching: is the programme still on? (until the player says it's ended; ~2 h at most) */
  info.stillOn = () => {
    const age = Date.now() - info.startedAt;
    if (info.ended || age > 2 * 3600 * 1000) return false;
    return info.state != null || age < 30000; // (if it never starts playing, she gives up after half a minute)
  };
  B.tvYouTube = info;
})(window.Bookshop);
