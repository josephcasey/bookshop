/* Regulars: familiar faces who drop in. Mr Abernathy comes in most mornings for a long chat. */
(function (B) {
  const name = () => B.ownerName();

  B.look('abernathy', {
    skin: '#e8b996',
    hair: '#d9d4cc',
    hairStyle: 'bald',
    beard: '#d9d4cc',
    top: '#7a6a4a', // tweed jacket
    top2: '#c9b58a',
    bottom: '#4a4034',
    hat: '#5a4a34',
    hatStyle: 'flat',
    glasses: true,
    h: -1,
  });

  // A regular who comes in once a (story) morning for a long chat.
  B.visitor({
    id: 'mr-abernathy',
    look: 'abernathy',
    fromLeft: true,
    weight: (s) => (s.shop.open && s.hour >= 9.5 && s.hour < 12 && !s.flags.abernathy ? 4 : 0),
    setup(n, s) {
      s.flags.abernathy = true;
      n.speed = 28;
      n.mood_ = 'happy';
    },
    *run(s, n) {
      yield* n.enter(s);
      yield n.walkTo(B.LAYOUT.spots.custTill);
      n.face(-1);
      s.request('chat-regular', 3, { npc: n });
      yield B.act.until(() => n.chatDone, 60);
      if (B.chance(0.5)) {
        n.bookTitle = B.pick(['a birdwatching guide', 'a naval history', 'a crossword annual']);
        n.holding = 'book';
        s.shelves.take(40);
        yield* n.payAtTill(s);
      }
      n.emote('happy', 1.5);
    },
  });

  B.activity({
    id: 'chat-regular',
    idle: false,
    priority: 3,
    resume: false,
    *run(s, o, d) {
      const n = d && d.npc;
      if (!n || n.area !== 'inside') return;
      yield o.go('till');
      o.face(1);
      o.emote('heart', 1.2);
      B.log(`Mr Abernathy pops in. ${B.pick([
        'They talk about his roses.',
        'He has opinions about the crossword.',
        'He tells the story about the owl again.',
        'They put the world to rights.',
      ])}`);
      yield 1.2;
      yield* B.talk(o, B.rnd(10, 16), n);
      if (B.chance(0.5)) {
        o.emote('happy', 1.4);
        n.emote('happy', 1.4);
        yield 1.2;
      }
      o.moodUp(0.12);
      n.chatDone = true;
      yield 0.5;
    },
  });
})(window.Bookshop);
