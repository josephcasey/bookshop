/* 2026-09-29 (doorbell & alley update)
 * - Click the shop door to ring the bell. Mabel comes to answer wherever she is: from behind the
 *   counter, or down the stairs from the flat (out of bed in her dressing gown, if it's late). Ring too often and she gets
 *   crosser each time, until she stuffs a sock in the bell and pins a note to the door.
 * - People now use the alley beside the shop as a shortcut. */
(function (B) {
  const name = () => B.ownerName();
  const Lay = () => B.LAYOUT;

  B.look('owner-night', Object.assign({}, B.looks.owner, {
    top: '#c77b9a', // quilted dressing gown
    top2: '#f4efe2', // nightie
    bottom: '#c77b9a',
    buttons: null,
    tights: '#f0c8a8',
    shoes: '#8c5a7a', // slippers
    hairStyle: 'long', // bun let down for the night
    glasses: null,
  }));

  // ---------- ringing ----------
  const inDoor = (x, y) => {
    const D = Lay().doorOpening;
    return x >= D.x && x < D.x + D.w && y >= D.y && y < D.y + D.h;
  };
  B.on('click', (s, x, y) => {
    if (!inDoor(x, y)) return;
    s.door.ring();
    if (s.cat) s.cat.alert = 1;
    if (s.door.bellMuted) {
      if (B.chance(0.3)) B.log('The doorbell gives a muffled clunk. There is a sock in it.');
      return;
    }
    s.bellAnnoy = (s.bellAnnoy || 0) + 1;
    const o = s.owner;
    if (o.currentDef && o.currentDef.id === 'answer-bell') {
      // ringing again while she's on her way: she hurries, and gets crosser
      o.hurry = true;
      o.emote(s.bellAnnoy > 3 ? 'angry' : 'bang', 1.2);
      return;
    }
    if (o.area === 'street') {
      o.emote('what', 1.2);
      return;
    }
    s.request('answer-bell', 5.5);
  });

  B.on('tick', (s, dt) => {
    // annoyance fades if you leave her in peace for a while
    if (s.bellAnnoy > 0) s.bellAnnoy = Math.max(0, s.bellAnnoy - dt / 45);
  });

  // ---------- answering ----------
  B.activity({
    id: 'answer-bell',
    idle: false,
    priority: 5.5,
    fromAway: true,
    resume: false,
    *run(s, o) {
      const lvl = () => s.bellAnnoy || 0;
      const from = o.area;
      const U = Lay().upstairsSpots;
      const saved = o.look;
      try {
        // ----- getting to the door -----
        if (from === 'away') {
          // in bed: a pause, then the light comes on behind the blind
          yield B.rnd(1.5, 3);
          s.upstairs.light = true;
          B.audio.play('click');
          B.log(lvl() > 3 ? 'The upstairs light snaps on. Somebody is not happy.' : 'A light comes on upstairs.');
          yield B.rnd(3, 5) / (lvl() > 3 ? 2 : 1);
          o.look = B.looks['owner-night'];
        } else if (from === 'upstairs') {
          yield o.go(U.windowA, { speed: 1.3 });
          o.face(0);
          o.emote(lvl() > 3 ? 'angry' : 'what', 1.4);
          yield 1.2; // peers down at the street
          if (s.hour >= 21) o.look = B.looks['owner-night'];
          yield o.go(U.door);
        } else {
          o.hurry = lvl() > 2;
          o.emote(lvl() > 3 ? 'angry' : 'what', 1.2);
          yield o.go('door');
        }
        if (from !== 'inside') {
          // down the stairs and out through the passage into the shop
          o.area = 'inside';
          o.depth = 'back';
          o.lane = 0;
          yield* o.outOfPassage(s, 1, true);
          if (!s.shop.lights) s.lamp = true; // the counter lamp, so she can see her way
          yield o.go('door', { speed: lvl() > 3 ? 1.3 : 1 });
        }
        if (s.shop.locked) {
          o.face('away');
          yield o.hold('reach', 0.8); // unbolting
        }
        yield* o.exit(s);
        s.door.openT = 99; // holds the door open while she looks out
        o.lane = -3;
        o.hurry = false;

        // ----- who's there? nobody (it's you) -----
        o.face(0);
        yield 0.6;
        o.face(-1);
        yield 0.7;
        o.face(1);
        yield 0.7;
        o.face(0);
        const L = lvl();
        if (L <= 1.5) {
          o.emote('what', 1.4);
          yield 1.2;
          o.emote('happy', 1.2);
          yield o.hold('shrug', 1.2);
          B.log(`${name()} answers the door. Nobody there — she smiles, shrugs and goes back in.`);
        } else if (L <= 3) {
          o.emote('dots', 1.4);
          yield o.hold('hips', 1.8);
          o.moodDown(0.03);
          B.log(`Again? ${name()} peers up and down the street, hands on hips.`);
        } else if (L <= 5) {
          o.exprOverride = 'angry';
          o.emote('angry', 1.6);
          yield o.hold('point', 1.4); // wagging a finger at whoever it is
          yield o.hold('hips', 1.2);
          o.moodDown(0.08);
          B.log(`${name()} is getting very cross about this doorbell.`);
        } else {
          o.exprOverride = 'angry';
          o.emote('angry', 1.6);
          yield o.hold('facepalm', 1.2);
          o.face('away');
          yield o.hold('reach', 1.6); // stuffs a sock in the bell
          s.door.bellMuted = true;
          s.door.muteT = 2 * B.STORY_HOUR;
          s.door.note = ['PLEASE', 'KNOCK'];
          s.bellAnnoy = 2;
          o.moodDown(0.12);
          B.log(`That's it. ${name()} stuffs a sock in the doorbell and pins a note to the door.`);
          o.face(0);
          yield 0.8;
        }
        o.exprOverride = null;

        // ----- back to where she was -----
        yield s.door.pass(o, 'in');
        o.depth = 'back';
        o.lane = 0;
        if (from !== 'inside') {
          if (s.shop.locked) {
            o.face('away');
            yield o.hold('reach', 0.8); // bolting it again
          }
          yield* o.intoPassage(s, 1, true); // back up the stairs
          s.lamp = false;
          o.hidden = false;
          o.pz = 0;
          o.climb = 0;
          o.area = 'upstairs';
          o.x = U.door;
          if (from === 'upstairs') yield o.go(U.chair);
          else {
            yield 2;
            s.upstairs.light = false;
            B.audio.play('click');
            o.area = 'away';
          }
        }
      } finally {
        o.look = saved;
        o.exprOverride = null;
        o.alpha = 1;
        o.hurry = false;
        if (s.door.openT > 1.5) s.door.openT = 0.4;
      }
    },
  });

  // ---------- the alley as a shortcut ----------
  B.visitor({
    id: 'alley-shortcut',
    weight: (s) => (B.daylight(s.hour) > 0.2 ? 0.9 : 0.3),
    *run(s, n) {
      const A = Lay().alleyX;
      n.lane = -3;
      if (B.chance(0.5)) {
        // comes out of the alley and heads off along the street
        n.x = A;
        n.alpha = 0;
        n.exitX = B.chance(0.5) ? Lay().edgeL - 2 : Lay().edgeR + 2;
        yield [n.walkTo(A + (n.exitX > A ? 14 : -14)), n.fade(1, 0.6)];
        yield n.walkOff();
      } else {
        // turns off the street down the alley
        yield n.walkTo(A);
        n.face('away');
        yield n.fade(0, 0.6);
        n.leaving = true;
        n.hidden = true;
      }
    },
  });
})(window.Bookshop);
