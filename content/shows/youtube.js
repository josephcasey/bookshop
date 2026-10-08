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
    setup: load,
    scenes: [sc],
  });
  load();

  // the telly's on this by default
  B.on('tick', (s) => {
    if (s.upstairs && !s.upstairs.show) s.upstairs.show = 'youtube';
  });

  // ---------- the real video, in the close-up panel ----------
  let frame = null;
  const send = (func, args = []) => {
    try {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch (e) {
      /* ignore */
    }
  };
  /** Follow the music slider (and the sound switch). */
  const level = () => {
    const A = B.audio;
    if (!A || !A.enabled) return 0;
    const v = A.levels ? A.levels.music : 0.8;
    return Math.round(Math.min(1, 1.25 * v * v) * 100);
  };
  function applyVolume() {
    const v = level();
    if (v <= 0) send('mute');
    else {
      send('unMute');
      send('setVolume', [v]);
    }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      let d = e.data;
      try {
        d = typeof d === 'string' ? JSON.parse(d) : d;
      } catch (err) {
        return;
      }
      if (d && (d.event === 'onReady' || d.event === 'initialDelivery')) applyVolume();
    });
  }
  let lastLevel = -1;
  function sync(s) {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const panel = document.getElementById('tvpanel');
    const cv = document.getElementById('tvCanvas');
    if (!panel || !cv) return;
    const n = B.tv.now(s);
    const want = !panel.classList.contains('hidden') && s.upstairs.tv && n && n.show.id === 'youtube' && info.id;
    if (want && !frame) {
      frame = document.createElement('iframe');
      frame.className = 'tvYouTube';
      frame.title = info.title;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      const origin = encodeURIComponent(location.origin);
      frame.src = `https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=${origin}`;
      frame.addEventListener('load', () => {
        // ask the player to talk back, then set its volume
        try {
          frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'tv' }), '*');
        } catch (e) {
          /* ignore */
        }
        setTimeout(applyVolume, 600);
      });
      lastLevel = -1;
      cv.style.display = 'none';
      cv.insertAdjacentElement('afterend', frame);
      panel.classList.add('wide');
    } else if (!want && frame) {
      frame.remove(); // stops it
      frame = null;
      cv.style.display = '';
      panel.classList.remove('wide');
    }
  }
  B.on('tick', sync);
  // the volume follows the slider and the sound switch as they change
  B.on('tick', () => {
    if (!frame) return;
    const v = level();
    if (v !== lastLevel) {
      lastLevel = v;
      applyVolume();
    }
  });
  B.tvYouTube = info;
})(window.Bookshop);
