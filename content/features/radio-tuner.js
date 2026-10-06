/* 2026-09-30 (radio tuner update)
 * - Click the radio in the window to pick the station yourself. If Mabel is in the shop and not busy she wanders over
 *   and retunes it for you, then lets you know what she thinks of your taste; otherwise the dial just turns.
 * - She leaves your choice alone for a couple of story hours, even if it's NEON GRID FM. */
(function (B) {
  const name = () => B.ownerName();
  const HOLD = 2 * B.STORY_HOUR; // how long she respects the viewer's pick

  /** Pick a station (id) or switch off (null). Called by the tuner UI. */
  B.radioChoose = function (s, id) {
    s.radio.chosenUntil = s.simT + HOLD;
    const o = s.owner;
    const free = o.area === 'inside' && (!o.current || o.priority < 2.5);
    if (free && s.request('tune-for-viewer', 2.5, { id })) return 'mabel';
    apply(s, id);
    if (o.area === 'inside') s.request('radio-verdict', 2);
    return 'dial';
  };

  function apply(s, id) {
    if (id == null) {
      if (s.radio.on) s.radio.turnOff();
      return null;
    }
    const st = s.radio.tuneTo(id);
    if (!s.radio.on) s.radio.turnOn();
    return st;
  }

  const verdict = function* (s, o) {
    const st = s.radio.on ? s.radio.station : null;
    if (!st) {
      o.emote('happy', 1.2);
      yield o.hold('shrug', 1);
      return;
    }
    const L = st.likes || 0;
    if (L >= 0.65) {
      o.emote('heart', 1.5);
      B.log(`${st.name}! ${name()} beams. Good choice.`);
      o.moodUp(0.04);
      if (st.music !== false && o.energy > 0.3 && s.customersInside() === 0 && B.chance(0.6)) {
        o.face('side');
        o.pose = 'dance';
        yield 2.4;
        o.pose = 'stand';
      } else yield o.hold('clap', 1.2);
    } else if (L >= 0.3) {
      o.emote('note', 1.4);
      B.log(`${name()} hums along to ${st.name}.`);
      yield 1.2;
    } else if (L >= 0) {
      o.emote('what', 1.4);
      yield o.hold('think', 1.4);
      B.log(`${st.name}? ${name()} tilts her head, but leaves it on.`);
    } else {
      o.exprOverride = 'puzzled';
      o.emote('sweat', 1.4);
      yield o.hold('facepalm', 1.2);
      o.exprOverride = null;
      B.log(`${name()} winces at ${st.name}, but she's a good sport about it.`);
      o.moodDown(0.02);
    }
    if (st.id === 'neon' && B.chance(0.5)) {
      // she's a secret fan of the future
      o.face('side');
      o.emote('spark', 1.3);
      yield o.hold('point', 1);
      B.log(`...and is that ${name()} nodding along to the synths?`);
    }
  };

  B.activity({
    id: 'tune-for-viewer',
    idle: false,
    priority: 2.5,
    resume: false,
    *run(s, o, d) {
      const id = d && d.id;
      let done = false;
      try {
        o.emote('what', 1);
        yield o.go('radio', { speed: 1.2 });
        o.face('away');
        yield o.hold('shelve', 0.9);
        const st = apply(s, id);
        done = true;
        if (st) B.log(`${name()} turns the dial to ${st.name}.${st.says ? ' ' + B.pick(st.says) : ''}`);
        else B.log(`${name()} switches the radio off.`);
        yield o.hold('shelve', 0.4);
        o.face(1);
        yield* verdict(s, o);
        yield 0.5;
      } finally {
        if (!done) apply(s, id); // called away on the way (the phone, a customer): the viewer still gets their station
      }
    },
  });

  B.activity({
    id: 'radio-verdict',
    idle: false,
    priority: 2,
    resume: false,
    *run(s, o) {
      o.face(-1); // glances back at the radio
      yield 0.7;
      yield* verdict(s, o);
    },
  });

  // her own fiddling with the wireless waits until the viewer's choice has had its turn
  const respected = (s) => (s.radio.chosenUntil || 0) > s.simT;
  const guard = (id) => {
    const def = B.findDef('activity', id);
    if (!def) return;
    const when = def.when;
    B.activity({ id, when: (s, o) => !respected(s) && (!when || when(s, o)) });
  };
  ['radio-on', 'radio-retune', 'radio-off'].forEach(guard);
})(window.Bookshop);
