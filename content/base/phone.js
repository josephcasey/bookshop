/* The telephone: it rings (a happening), she answers (an activity), and one of the
 * registered calls plays out. Add calls with B.call({ id, weight, when, *run(s, o) }). */
(function (B) {
  const name = () => B.ownerName();

  B.happening({
    id: 'phone-ring',
    perHour: 0.6,
    when: (s) => s.owner.area === 'inside' && !s.phone.ringing && !s.phone.offHook,
    *run(s) {
      s.ringPhone();
      s.dayStats.calls++;
      s.request('answer-phone', 4);
      const answered = yield B.act.until(() => !s.phone.ringing, 16);
      if (!answered) {
        s.phone.ringing = false;
        s.dayStats.missed++;
        s.owner.moodDown(0.04);
        B.log('The phone rings out.');
      }
    },
  });

  B.activity({
    id: 'answer-phone',
    idle: false,
    priority: 4,
    *run(s, o) {
      if (!s.phone.ringing) return;
      o.hurry = true;
      yield o.go('phone');
      o.hurry = false;
      if (!s.phone.ringing) {
        o.emote('sweat', 1.5);
        B.log(`${name()} reaches the phone just as it stops ringing.`);
        yield 1.2;
        return;
      }
      s.phone.ringing = false;
      s.phone.offHook = true;
      o.holding = 'receiver';
      o.face(1);
      B.audio.play('click');
      const calls = B.active('call').filter((c) => !c.when || c.when(s, o));
      const call = B.weighted(calls, (c) => B.val(c.weight == null ? 1 : c.weight, s, o));
      if (call) yield call.run.call(call, s, o);
      else yield* B.talk(o, 4);
      o.holding = null;
      s.phone.offHook = false;
      B.audio.play('click');
      yield 0.6;
    },
  });

  B.call({
    id: 'chatty-friend',
    weight: 2,
    *run(s, o) {
      B.log(`${name()} settles in for a long natter with an old friend.`);
      o.pose = 'lean';
      yield* B.talk(o, B.rnd(10, 18));
      o.emote('happy', 1.5);
      o.moodUp(0.1);
      yield 1;
    },
  });

  B.call({
    id: 'special-order',
    weight: 3,
    *run(s, o) {
      yield* B.talk(o, 3);
      o.pose = 'write';
      const t = B.pick(B.titles);
      B.log(`A caller orders a copy of ${t}.`);
      yield 3;
      o.pose = 'stand';
      yield* B.talk(o, 2);
      o.moodUp(0.04);
    },
  });

  B.call({
    id: 'wrong-number',
    weight: 1.5,
    *run(s, o) {
      o.emote('what', 1.5);
      yield 1.8;
      B.log('Wrong number.');
      o.pose = 'shrug';
      o.emote('dots', 1);
      yield 0.8;
    },
  });

  B.call({
    id: 'sales-call',
    weight: 1,
    *run(s, o) {
      yield* B.talk(o, 2);
      o.emote('angry', 1.5);
      o.pose = 'hips';
      B.log(`${name()} firmly declines to discuss her energy supplier.`);
      o.moodDown(0.05);
      yield 1.5;
    },
  });

  B.call({
    id: 'bad-news',
    weight: 0.7,
    *run(s, o) {
      o.exprOverride = 'worried';
      yield* B.talk(o, 4);
      o.exprOverride = null;
      o.pose = 'facepalm';
      o.emote('rain', 2);
      B.log(B.pick([
        'Bad news on the phone: the book fair has been cancelled.',
        'The landlord rings about the rent. Her shoulders drop.',
        'A distributor rings — that big order is delayed again.',
      ]));
      o.moodDown(0.15);
      yield 2;
    },
  });

  B.call({
    id: 'good-news',
    weight: 0.8,
    *run(s, o) {
      yield* B.talk(o, 3);
      o.emote('bang', 1.2);
      yield 1.2;
      o.pose = 'cheer';
      o.emote('spark', 1.5);
      yield 1.4;
      o.pose = 'stand';
      o.emote('heart', 1.5);
      B.log(B.pick([
        'Good news: the book club wants to meet here next month!',
        'A local author asks if she can hold a signing in the shop.',
        'A rare first edition she has been hunting has turned up.',
      ]));
      o.moodUp(0.15);
      yield 1.5;
    },
  });

  B.call({
    id: 'silent',
    weight: 0.4,
    *run(s, o) {
      o.emote('what', 1.2);
      yield 1.5;
      o.emote('dots', 1.2);
      yield 1.5;
      B.log('Nobody on the line. How odd.');
    },
  });
})(window.Bookshop);
