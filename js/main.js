/* Boot: load content files listed in content/manifest.js, then run the loop and wire up the HUD. */
(function () {
  'use strict';
  const B = window.Bookshop;
  const $ = (sel) => document.querySelector(sel);

  const bust = Date.now();
  function loadContent(list, done) {
    let i = 0;
    const next = () => {
      if (i >= list.length) return done();
      const src = 'content/' + list[i++];
      const el = document.createElement('script');
      el.src = `${src}?v=${bust}`; // always pick up freshly edited content
      el.onload = next;
      el.onerror = () => {
        console.error('[bookshop] failed to load', src);
        next();
      };
      document.body.appendChild(el);
    };
    next();
  }

  function fit(canvas) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let sc = Math.min(w / B.W, h / B.H);
    if (sc >= 2) sc = Math.floor(sc);
    canvas.style.width = `${Math.floor(B.W * sc)}px`;
    canvas.style.height = `${Math.floor(B.H * sc)}px`;
  }

  function start() {
    B.buildCaches();
    const s = (B.world = B.createWorld());
    const saved = B.loadGame(s);
    B.settle(s);
    if (!saved) B.log(`A new day on the high street. ${B.ownerName()} will be along shortly.`);

    const canvas = $('#screen');
    const g = canvas.getContext('2d', { willReadFrequently: true }); // the neon theme grades every frame
    fit(canvas);
    window.addEventListener('resize', () => fit(canvas));
    setupHUD(s, canvas);
    // console helpers for trying out content: Bookshop.do('dance'), Bookshop.fire('phone-ring'), Bookshop.fire('courier')
    B.do = (id) => B.startActivity(s, B.findDef('activity', id), null, 9);
    B.fire = (id) => B.trigger(s, id) || !!B.spawn(s, id);
    B.at = (hour) => B.jumpTo(s, hour);
    B.emit('ready', s);

    let last = performance.now();
    let lastErr = 0;
    function frame(now) {
      requestAnimationFrame(frame); // keep going even if one frame throws
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (B.holdFrame) return; // dev tools (the lighting reel) can take over the canvas
      try {
        if (!s.paused) B.tick(s, dt);
        if (B.renderOverride) B.renderOverride(g, s);
        else B.render(g, s);
        hudTick(s);
      } catch (e) {
        if (now - lastErr > 5000) console.error('[bookshop] frame error', e);
        lastErr = now;
      }
    }
    requestAnimationFrame(frame);
    setInterval(() => B.saveGame(s), 10000);
    window.addEventListener('pagehide', () => B.saveGame(s));
  }

  // ---------- HUD ----------
  let hudEls = null;
  const WEATHER = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', fog: 'Fog', snow: 'Snow' };

  function setupHUD(s, canvas) {
    hudEls = { time: $('#time'), day: $('#day'), weather: $('#weather'), stats: $('#stats'), log: $('#log') };

    document.querySelectorAll('[data-speed]').forEach((b) => {
      b.addEventListener('click', () => {
        s.speed = +b.dataset.speed;
        s.paused = false;
        syncButtons(s);
      });
    });
    $('#pause').addEventListener('click', () => {
      s.paused = !s.paused;
      syncButtons(s);
    });
    $('#mode').addEventListener('click', () => {
      s.mode = s.mode === 'story' ? 'live' : 'story';
      if (s.mode === 'live') {
        const d = new Date();
        s.time = s.day * 1440 + d.getHours() * 60 + d.getMinutes();
        s.speed = 1;
      }
      B.settle(s);
      B.log(s.mode === 'live' ? 'Now following your real clock.' : 'Back to story time.');
      syncButtons(s);
    });
    const soundBtn = $('#sound');
    soundBtn.addEventListener('click', () => {
      if (B.audio.enabled) B.audio.disable();
      else {
        B.audio.enable();
        B.audio.radio(s.radio.on ? s.radio.station : null);
      }
      syncButtons(s);
    });
    // ----- volume: music (the radio) vs effects -----
    const volpanel = $('#volpanel');
    const bindVol = (which, input, outEl) => {
      const show = () => (outEl.textContent = Math.round(B.audio.levels[which] * 100));
      input.value = B.audio.levels[which];
      show();
      // turning it up means you want to hear it: switch on from the touch itself (iOS only unlocks audio in a gesture)
      const wantSound = () => !B.audio.enabled && soundBtn.click();
      input.addEventListener('pointerdown', wantSound);
      input.addEventListener('touchstart', wantSound, { passive: true });
      input.addEventListener('input', () => {
        if (!B.audio.enabled) soundBtn.click();
        B.audio.setLevel(which, +input.value);
        show();
      });
    };
    bindVol('music', $('#volMusic'), $('#volMusicOut'));
    bindVol('fx', $('#volFx'), $('#volFxOut'));
    // ?audiodebug: a live readout in the volume panel (audio state and the level on each bus), to check a phone
    if (/audiodebug/.test(location.search)) {
      const pre = document.createElement('pre');
      pre.className = 'hint';
      pre.style.cssText = 'font-size:11px;white-space:pre-wrap;margin:6px 0 0';
      $('#volpanel').appendChild(pre);
      $('#volpanel').classList.remove('hidden');
      const db = (v) => (v > 1e-6 ? (20 * Math.log10(v)).toFixed(0) + ' dB' : 'silent');
      setInterval(() => {
        const A = B.audio;
        pre.textContent = [
          `sound ${A.enabled ? 'on' : 'off'} · context ${A.on() ? 'running' : 'not running'}`,
          `session ${navigator.audioSession ? navigator.audioSession.type : 'n/a'}`,
          `music ${Math.round(A.levels.music * 100)}% → bus ${A.rms ? db(A.rms('music')) : '-'}`,
          `fx ${Math.round(A.levels.fx * 100)}% → bus ${A.rms ? db(A.rms('fx')) : '-'}`,
          `stream ${A.streamStatus || '-'}${A._decoded && A._decoded() ? ' (decoded here)' : ''}${A.streamDirect && A.streamDirect() ? ' (direct: slider mutes only)' : ''} · ${A.rms ? db(A.rms('stream')) : '-'}`,
        ].join('\n');
      }, 250);
    }
    $('#volBtn').addEventListener('click', () => volpanel.classList.toggle('hidden'));
    volpanel.querySelector('.close').addEventListener('click', () => volpanel.classList.add('hidden'));

    // ----- look: neon future or classic high street -----
    const styleBtn = $('#styleBtn');
    const syncStyle = () => {
      styleBtn.textContent = B.theme === 'cyber' ? 'Neon' : 'Classic';
      styleBtn.classList.toggle('on', B.theme === 'cyber');
    };
    styleBtn.addEventListener('click', () => {
      B.setTheme(B.theme === 'cyber' ? 'classic' : 'cyber');
      syncStyle();
    });
    syncStyle();

    $('#diaryBtn').addEventListener('click', () => {
      $('#diary').classList.toggle('hidden');
      renderLog();
    });
    $('#diary .close').addEventListener('click', () => $('#diary').classList.add('hidden'));

    // ----- crowd: how many people are out and about -----
    const CROWDS = [
      ['Empty', 0],
      ['Quiet', 0.35],
      ['Normal', 1],
      ['Busy', 1.8],
      ['Bustling', 3],
    ];
    let crowdI = 2;
    try {
      const saved = +localStorage.getItem('bookshop.crowd');
      if (saved >= 0 && saved < CROWDS.length && localStorage.getItem('bookshop.crowd') !== null) crowdI = saved;
    } catch (e) {
      /* ignore */
    }
    const setCrowd = (i) => {
      crowdI = B.clamp(i, 0, CROWDS.length - 1);
      B.config.crowd = CROWDS[crowdI][1];
      $('#crowdLabel').textContent = CROWDS[crowdI][0];
      $('#crowdDown').disabled = crowdI === 0;
      $('#crowdUp').disabled = crowdI === CROWDS.length - 1;
      try {
        localStorage.setItem('bookshop.crowd', crowdI);
      } catch (e) {
        /* ignore */
      }
    };
    $('#crowdDown').addEventListener('click', () => setCrowd(crowdI - 1));
    $('#crowdUp').addEventListener('click', () => setCrowd(crowdI + 1));
    B.setCrowd = setCrowd;
    setCrowd(crowdI);

    // ----- time of day -----
    const panel = $('#timepanel');
    const slider = $('#timeSlider');
    let dragging = false;
    $('#timeBtn').addEventListener('click', () => {
      panel.classList.toggle('hidden');
      $('#diary').classList.add('hidden');
      slider.value = s.hour;
      showTimeLabel(s.hour);
    });
    panel.querySelector('.close').addEventListener('click', () => panel.classList.add('hidden'));
    slider.addEventListener('input', () => {
      dragging = true;
      showTimeLabel(+slider.value);
    });
    slider.addEventListener('change', () => {
      dragging = false;
      jump(+slider.value);
    });
    panel.querySelectorAll('[data-hour]').forEach((b) => b.addEventListener('click', () => jump(+b.dataset.hour)));
    function jump(hour) {
      B.jumpTo(s, hour);
      slider.value = s.hour;
      showTimeLabel(s.hour);
      syncButtons(s);
    }
    B.timeSliderBusy = () => dragging;
    const syncWeatherBtns = () =>
      panel.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', (s.weather.forced || 'auto') === b.dataset.weather));
    panel.querySelectorAll('[data-weather]').forEach((b) =>
      b.addEventListener('click', () => {
        B.setWeatherKind(s, b.dataset.weather === 'auto' ? null : b.dataset.weather);
        syncWeatherBtns();
      })
    );
    syncWeatherBtns();

    // ----- the radio tuner: click the radio in the window -----
    const tuner = $('#tuner');
    const RADIO = { x: 138, y: 78, w: 22, h: 24 }; // the set on its shelf, aerial included
    const onRadio = (x, y) => x >= RADIO.x && x < RADIO.x + RADIO.w && y >= RADIO.y && y < RADIO.y + RADIO.h;
    const taste = (l) => (l >= 0.65 ? ['♥', 'Mabel loves this'] : l >= 0.3 ? ['♪', 'Mabel likes this'] : l >= 0 ? ['?', 'Not really her thing'] : ['✗', 'Mabel can’t stand this']);
    function renderTuner() {
      const list = $('#stationList');
      list.innerHTML = '';
      const STATUS = { tuning: 'tuning in…', playing: 'on air', error: 'off air' };
      let liveHead = false;
      s.stations.forEach((st, i) => {
        if (st.stream && !liveHead) {
          liveHead = true;
          const h = document.createElement('li');
          h.className = 'livehead';
          h.textContent = 'Live internet radio';
          list.appendChild(h);
        }
        const li = document.createElement('li');
        const b = document.createElement('button');
        const cur = s.radio.on && i === s.radio.idx;
        b.className = 'station' + (cur ? ' on' : '');
        const [mark, why] = taste(st.likes || 0);
        b.title = why;
        b.innerHTML = `<span class="dot"></span><span class="nm"></span><span class="gn"></span><span class="tt"></span>`;
        b.querySelector('.dot').style.background = st.color || '#999';
        b.querySelector('.nm').textContent = st.name;
        b.querySelector('.gn').textContent =
          st.stream && cur && B.audio.enabled ? STATUS[B.audio.streamStatus] || 'tuning in…' : st.genre || (st.music === false ? 'Talk' : '');
        if (st.stream) b.classList.add('live');
        b.querySelector('.tt').textContent = mark;
        b.addEventListener('click', () => pick(st.id));
        li.appendChild(b);
        list.appendChild(li);
      });
      $('#radioOff').disabled = !s.radio.on;
    }
    function pick(id) {
      if (!B.audio.enabled) {
        B.audio.enable(); // choosing a station is a pretty clear sign you want to hear it
        syncButtons(s);
      }
      const how = B.radioChoose ? B.radioChoose(s, id) : (id ? (s.radio.tuneTo(id), s.radio.on || s.radio.turnOn()) : s.radio.turnOff());
      $('#tunerHint').textContent = how === 'mabel' ? `${B.ownerName()} is on her way to the radio…` : '';
      renderTuner();
      if (how !== 'mabel') setTimeout(() => tuner.classList.add('hidden'), 350);
      else setTimeout(() => tuner.classList.add('hidden'), 1400);
    }
    function openTuner() {
      $('#tunerHint').textContent = '';
      renderTuner();
      tuner.classList.remove('hidden');
      // float it beside the radio, kept on screen
      const r = canvas.getBoundingClientRect();
      const k = r.width / B.W;
      const tw = tuner.offsetWidth, th = tuner.offsetHeight;
      let left = r.left + (RADIO.x + RADIO.w + 4) * k;
      let top = r.top + RADIO.y * k - th / 2;
      if (left + tw > window.innerWidth - 16) left = r.left + RADIO.x * k - tw - 4;
      left = Math.max(16, Math.min(left, window.innerWidth - tw - 16));
      top = Math.max(56, Math.min(top, window.innerHeight - th - 16));
      tuner.style.left = left + 'px';
      tuner.style.top = top + 'px';
    }
    B.openTuner = openTuner;
    $('#radioOff').addEventListener('click', () => pick(null));
    tuner.querySelector('.close').addEventListener('click', () => tuner.classList.add('hidden'));
    B.on('radio', () => !tuner.classList.contains('hidden') && renderTuner());
    B.on('radio-status', () => !tuner.classList.contains('hidden') && renderTuner());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && tuner.classList.add('hidden'));
    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * B.W, ((e.clientY - r.top) / r.height) * B.H];
    };
    // ----- the build number: hover over (or tap) the CINEMA sign in the alley -----
    const onSign = (x, y) => x >= 282 && x < 305 && y >= 62 && y < 128;
    const buildTip = document.createElement('div');
    buildTip.id = 'buildTip';
    Object.assign(buildTip.style, {
      position: 'fixed', display: 'none', zIndex: '20', pointerEvents: 'none', padding: '4px 8px', borderRadius: '4px',
      background: 'rgba(20,16,28,0.92)', color: '#ffd23f', border: '1px solid #ff4fa3', font: '12px monospace', whiteSpace: 'nowrap',
    });
    document.body.appendChild(buildTip);
    let tipUntil = 0;
    const showBuild = (e, sec) => {
      const b = B.BUILD || {};
      buildTip.textContent = b.n ? `Build ${b.n} · ${b.date}` : 'Build: local';
      buildTip.style.display = 'block';
      const r = buildTip.getBoundingClientRect();
      buildTip.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, e.clientX - r.width - 12)) + 'px';
      buildTip.style.top = Math.max(4, e.clientY - 28) + 'px';
      tipUntil = sec ? performance.now() + sec * 1000 : 0;
    };
    const hideBuild = () => {
      if (performance.now() >= tipUntil) buildTip.style.display = 'none';
    };
    canvas.addEventListener('mouseleave', hideBuild);
    canvas.addEventListener('mousemove', (e) => {
      const [x, y] = toGame(e);
      const D = B.LAYOUT.doorOpening;
      const door = x >= D.x && x < D.x + D.w && y >= D.y && y < D.y + D.h;
      if (onSign(x, y)) showBuild(e, 0);
      else hideBuild();
      canvas.style.cursor = onRadio(x, y) || onTv(x, y) || door ? 'pointer' : '';
    });

    // ----- the telly: click the left upstairs window -----
    const tvpanel = $('#tvpanel');
    const tvCtx = $('#tvCanvas').getContext('2d');
    tvCtx.imageSmoothingEnabled = false;
    const onTv = (x, y) => {
      const u = B.LAYOUT.upstairs[0];
      return x >= u.x - 2 && x < u.x + u.w + 2 && y >= u.y - 2 && y < u.y + u.h + 2;
    };
    function renderShows() {
      const list = $('#showList');
      list.innerHTML = '';
      const cur = B.tv.show(s);
      for (const sh of B.tv.shows()) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'show' + (s.upstairs.tv && cur && cur.id === sh.id ? ' on' : '');
        b.innerHTML = '<span class="dot"></span><span class="nm"></span><span class="gn"></span>';
        b.querySelector('.dot').style.background = sh.color || '#999';
        b.querySelector('.nm').textContent = sh.name;
        b.querySelector('.gn').textContent = sh.genre || '';
        b.addEventListener('click', () => {
          if (!B.audio.enabled) {
            B.audio.enable();
            syncButtons(s);
          }
          const how = B.tv.choose(s, sh.id);
          $('#tvHint').textContent =
            how === 'mabel' ? `${B.ownerName()} settles into her armchair to watch.` : how === 'later' ? `${B.ownerName()} isn't watching just now; she'll put it on next time she sits down.` : '';
          renderShows();
        });
        li.appendChild(b);
        list.appendChild(li);
      }
    }
    let tvLoop = 0;
    function tvTick() {
      if (tvpanel.classList.contains('hidden')) return;
      tvLoop = requestAnimationFrame(tvTick);
      const f = B.tv.frame(s);
      if (f) {
        tvCtx.drawImage(f, 0, 0);
        const n = B.tv.now(s);
        const cap = n ? `${n.show.name}: ${n.sc.caption || ''}` : '';
        if ($('#tvCaption').textContent !== cap) $('#tvCaption').textContent = cap;
      } else {
        // switched off: a dark screen with your reflection's worth of glare
        tvCtx.fillStyle = '#08090c';
        tvCtx.fillRect(0, 0, 64, 48);
        tvCtx.fillStyle = 'rgba(255,255,255,0.06)';
        tvCtx.fillRect(6, 4, 10, 30);
        const where = s.owner.area === 'upstairs' ? 'in the flat' : s.owner.area === 'away' ? 'in bed' : 'downstairs';
        const cap = `The telly is off. ${B.ownerName()} is ${where}.`;
        if ($('#tvCaption').textContent !== cap) $('#tvCaption').textContent = cap;
      }
    }
    function openTv() {
      $('#tvHint').textContent = '';
      renderShows();
      tvpanel.classList.remove('hidden');
      tuner.classList.add('hidden');
      const r = canvas.getBoundingClientRect();
      const k = r.width / B.W;
      const u = B.LAYOUT.upstairs[0];
      const pw = tvpanel.offsetWidth;
      const ph = tvpanel.offsetHeight;
      let left = r.left + (u.x + u.w + 6) * k;
      if (left + pw > window.innerWidth - 16) left = window.innerWidth - pw - 16;
      tvpanel.style.left = Math.max(16, left) + 'px';
      tvpanel.style.top = Math.max(56, Math.min(r.top + u.y * k, window.innerHeight - ph - 16)) + 'px';
      B.audio.setTvOpen(true);
      cancelAnimationFrame(tvLoop);
      tvTick();
    }
    const closeTv = () => {
      tvpanel.classList.add('hidden');
      B.audio.setTvOpen(false);
    };
    B.openTv = openTv;
    tvpanel.querySelector('.close').addEventListener('click', closeTv);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeTv());
    B.on('activity', () => !tvpanel.classList.contains('hidden') && renderShows());

    // knock on the window
    canvas.addEventListener('click', (e) => {
      const [x, y] = toGame(e);
      if (onSign(x, y)) {
        showBuild(e, 4); // a tap shows it for a few seconds (there's no hover on a phone)
        setTimeout(hideBuild, 4100);
        return;
      }
      if (onTv(x, y)) {
        if (tvpanel.classList.contains('hidden')) openTv();
        else closeTv();
        return;
      }
      if (onRadio(x, y)) {
        if (tuner.classList.contains('hidden')) openTuner();
        else tuner.classList.add('hidden');
        return;
      }
      tuner.classList.add('hidden');
      B.emit('click', s, x, y);
      if (s.clickTaken) {
        s.clickTaken = false; // something in the scene answered the click (a lamp switched)
        return;
      }
      const W = B.LAYOUT.win;
      if (x >= W.x && x < W.x + W.w && y >= W.y && y < W.y + W.h) {
        B.audio.play('knock');
        if (s.owner.area === 'inside' && (s.cooldowns.tap || 0) <= s.simT) {
          s.cooldowns.tap = s.simT + 6;
          s.request('notice-tap', 2);
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ') {
        s.paused = !s.paused;
        e.preventDefault();
      } else if (e.key === '1') s.speed = 1;
      else if (e.key === '2') s.speed = 3;
      else if (e.key === '3') s.speed = 10;
      else if (e.key === 'd') $('#diary').classList.toggle('hidden');
      else if (e.key === 'r') B.openTuner();
      else if (e.key === 't') B.openTv();
      else if (e.key === '-' || e.key === '_') B.setCrowd(B.config.crowd === 0 ? 0 : [0, 0.35, 1, 1.8, 3].indexOf(B.config.crowd) - 1);
      else if (e.key === '=' || e.key === '+') B.setCrowd([0, 0.35, 1, 1.8, 3].indexOf(B.config.crowd) + 1);
      else if (e.key === '[' || e.key === ']') B.jumpTo(s, (s.hour + (e.key === ']' ? 1 : 23)) % 24);
      else if (e.key === 'm') soundBtn.click();
      else return;
      syncButtons(s);
      renderLog();
    });

    // hide the HUD when the mouse is idle, for pure watching
    let idleT;
    const wake = () => {
      document.body.classList.remove('idle');
      clearTimeout(idleT);
      idleT = setTimeout(() => document.body.classList.add('idle'), 3500);
    };
    ['mousemove', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();

    B.on('log', () => {
      if (!$('#diary').classList.contains('hidden')) renderLog();
    });
    showToday();
    syncButtons(s);
  }

  function syncButtons(s) {
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', !s.paused && +b.dataset.speed === s.speed));
    $('#pause').classList.toggle('on', !!s.paused);
    $('#mode').textContent = s.mode === 'live' ? 'Live time' : 'Story time';
    document.querySelectorAll('[data-speed]').forEach((b) => (b.disabled = s.mode === 'live'));
    $('#sound').textContent = B.audio.enabled ? 'Sound on' : 'Sound off';
    $('#sound').classList.toggle('on', B.audio.enabled);
  }

  /** What's usually going on at a given hour, for the time panel. */
  function describeHour(h) {
    const C = B.config;
    if (h < 6) return 'Night: the street sleeps, and so does Mabel';
    if (h < C.arriveHour) return 'Early morning: the shop is still dark';
    if (h < C.openHour) return 'Mabel opens up';
    if (h < 12) return 'Morning in the shop';
    if (h < 14) return 'Lunchtime rush';
    if (h < C.closeHour) return 'Afternoon in the shop';
    if (h < C.closeHour + 0.4) return 'Closing up';
    if (h < C.bedHour) return 'Evening in the flat upstairs';
    return 'Bedtime: the blinds come down';
  }
  function showTimeLabel(h) {
    const m = Math.round(h * 60) % 1440;
    $('#timeLabel').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    $('#timeWhat').textContent = describeHour(h);
  }

  let lastHud = 0;
  function hudTick(s) {
    const now = performance.now();
    if (now - lastHud < 250) return;
    lastHud = now;
    hudEls.time.textContent = B.clockStr(s) + (s.ff > 1 ? ' ››' : '');
    hudEls.day.textContent = s.mode === 'live' ? new Date().toLocaleDateString(undefined, { weekday: 'short' }) : `Day ${s.totals.days}`;
    hudEls.weather.textContent = WEATHER[s.weather.kind] || '';
    if (!$('#timepanel').classList.contains('hidden') && !B.timeSliderBusy()) {
      $('#timeSlider').value = s.hour;
      showTimeLabel(s.hour);
    }
    const d = s.dayStats;
    hudEls.stats.textContent = `Today: ${d.sales} sold · ${d.visitors} visitors · ${d.calls} calls — all-time ${s.totals.sales} sold`;
  }

  function renderLog() {
    const el = hudEls && hudEls.log;
    if (!el) return;
    el.innerHTML = '';
    for (const e of B.journal.slice(0, 120)) {
      const li = document.createElement('li');
      const t = document.createElement('time');
      t.textContent = e.stamp;
      li.appendChild(t);
      li.appendChild(document.createTextNode(' ' + e.text));
      el.appendChild(li);
    }
  }

  function showToday() {
    const notes = B.active('note')
      .filter((n) => n.date <= B.today)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const n = notes[0];
    if (!n) return;
    let seen = null;
    try {
      seen = localStorage.getItem('bookshop.seenNote');
    } catch (e) {
      /* ignore */
    }
    const card = $('#today');
    card.querySelector('h2').textContent = n.title;
    card.querySelector('p').textContent = n.text;
    card.querySelector('.date').textContent = n.date === B.today ? 'New today' : `New on ${n.date}`;
    if (seen !== n.id) card.classList.remove('hidden');
    card.querySelector('.close').addEventListener('click', () => {
      card.classList.add('hidden');
      try {
        localStorage.setItem('bookshop.seenNote', n.id);
      } catch (e) {
        /* ignore */
      }
    });
    const list = $('#notes');
    for (const x of notes) {
      const li = document.createElement('li');
      li.innerHTML = '<b></b> <span></span>';
      li.querySelector('b').textContent = x.date;
      li.querySelector('span').textContent = x.title;
      list.appendChild(li);
    }
  }

  loadContent(B.manifest || [], start);
})();
