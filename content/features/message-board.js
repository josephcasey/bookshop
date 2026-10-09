/* 2026-10-09 (SCH-27: the message of the day)
 * A little board on the wall behind the counter (a chalk slate on the classic street, an e-ink panel in the neon city)
 * carries a new message every day, the same all day for everyone. From the street it's just chalky scribble; click or
 * tap it (or press B) for a close-up you can read. Each morning, once the shop's open, Mabel rubs out yesterday's
 * and chalks up the new one. Every message is Mabel's own (no quotations): the list cycles without repeats, and a
 * few dates have their own. */
(function (B) {
  const name = () => B.ownerName();
  const BOARD = { x: 164, y: 96, w: 22, h: 12 };
  const SPOT = 175; // where she stands to write on it (behind the counter)

  const MESSAGES = [
    'Every book on these shelves has been somewhere before. Ask it where.',
    'Today’s special: a quiet corner and a chapter you’ve been saving.',
    'Second-hand books are first-hand adventures.',
    'If you can’t find what you’re looking for, you may be looking for the wrong thing. Browse.',
    'The cat is not for sale. The cat has been asked.',
    'A book a week keeps the telly at bay.',
    'Kindly do not read the endings first. We will know.',
    'Rain outside? Perfect. Stay for one more page.',
    'Poetry is upstairs in the heart and on the middle shelf.',
    'All maps guaranteed to be of somewhere.',
    'Lost: one bookmark, much loved. Last seen in a Victorian novel.',
    'Talk to strangers here. They’ve usually read something good.',
    'Every shelf is a street. Go for a wander.',
    'Today we recommend: whatever falls open in your hands.',
    'The kettle is on. The books are patient. Take your time.',
    'An old book smells of everyone who loved it.',
    'Mind the step. Mind the stories. Mind the cat.',
    'Ask us about the book with the blue cover you can’t remember the name of.',
    'We buy books, swap books, and lend a sympathetic ear.',
    'Read slowly today. The words aren’t going anywhere.',
    'Somewhere on these shelves is your new favourite. Warmer… warmer…',
    'Fiction to the left, facts to the right, dreams all the way up.',
    'No rush. No queue. No wifi password. Just books.',
    'A good bookshop is a lighthouse for the curious.',
    'Children’s corner: grown-ups welcome if accompanied by a child.',
    'Dog-eared pages are a sign of a life well read.',
    'We have more books than shelves. That’s the right way round.',
    'Today’s forecast: scattered paperbacks, clearing to a sunny chapter.',
    'Bring back a book, take home a story.',
    'Margins are for writing in. Within reason.',
    'If a book finds you, you have to take it home. Those are the rules.',
    'Open late on Thursdays, open-minded always.',
    'The best stories begin with “I wasn’t looking for anything in particular…”',
    'Spines out, hearts open.',
    'This week’s window: books that made somebody cry on a bus.',
    'Ask Mabel about the dancer’s memoir. Actually, don’t: she’ll do the steps.',
    'Every atlas here is a ticket. Every novel too.',
    'Whisper if you like. Gasp out loud if you must.',
    'Quiet please: the books are thinking.',
    'Happiness is a full shelf and an empty afternoon.',
    'Life is short. Read the long ones anyway.',
    'Gift idea: the book you loved at their age.',
    'A bookshop is a time machine with a bell on the door.',
    'Found in a book today: a pressed flower and a bus ticket from 1974.',
    'Read anything good lately? Tell us. We’ll tell everyone.',
    'Fresh in: old books.',
    'You can’t buy happiness, but you can buy books, which is close.',
    'The last page is just the door out. Leave it open.',
    'Recommended by the cat: anything left in a patch of sun.',
    'Our crime section is criminally good.',
    'Poems are short. Have two.',
    'Grumpy? Try the comic novels, left of the door. Results guaranteed-ish.',
    'Feeling brave? The big Russian novels are by the stairs.',
    'Can’t sleep? Mysteries. Can’t wake up? Also mysteries.',
    'Hello to whoever is reading this from the street. Come in.',
    'Books are the only thing you can buy that make you richer.',
    'A paperback in the pocket is worth two on the bedside table.',
    'Some books are for reading. Some are for keeping. The best are both.',
    'The shop opens at nine. The imagination opens whenever.',
    'Today’s word: bibliosmia, the smell of old books. Come and enjoy some.',
    'Bring your questions. We have several thousand answers in stock.',
    'Not all who wander the shelves are lost. Some are, though. Ask for help.',
    'Our ladder is for books, not for climbing to see the cat.',
    'Every visit counts. Every page turned makes the shop happy.',
    'New to reading? Start with whatever makes you smile on page one.',
    'On a budget? The trolley outside: three for a pound.',
    'Read on the train. Read in the bath. Read on the bus home. Just read.',
    'Saturday plan: books, tea, a long walk, more books.',
    'A story shared is a story doubled.',
    'Small shop, big worlds.',
    'Atlases for the curious, cookbooks for the hungry, poetry for everyone.',
    'If in doubt, read the first line. If still in doubt, read the second.',
    'Weekend reading: something with a map in the front.',
    'Old books, new friends.',
    'We don’t judge books by their covers. We do judge covers by their books.',
    'Thank you for shopping small. The books thank you too.',
    'Tea and a novel: the original weekend.',
    'Some days are for big books. Today feels like one.',
    'Please don’t feed the cat. He has had three breakfasts already.',
    'This board changes every day. The books change every week. The cat never changes.',
  ];
  // a few days with their own message (month-day)
  const DATES = {
    '01-01': 'Happy New Year! Resolution: read more. We can help with that.',
    '02-14': 'Love stories are on the middle shelf. So is the poetry. Be bold.',
    '03-17': 'Happy St Patrick’s Day. The Irish writers are in the window.',
    '04-23': 'Happy World Book Night and St George’s Day. Give a book to a stranger.',
    '06-21': 'Longest day of the year: more daylight for reading.',
    '10-31': 'Happy Halloween. The ghost stories are on the bottom shelf. Mind the dark.',
    '11-05': 'Remember, remember: read in November.',
    '12-21': 'Shortest day of the year: settle in with a long book.',
    '12-24': 'Last-minute gifts? Every book here comes wrapped in a story.',
    '12-25': 'Merry Christmas from Mabel and the cat.',
    '12-31': 'Last day of the year. What was your best book?',
  };
  /** The message for a date (YYYY-MM-DD): its own, if it has one, else the next in a no-repeats cycle. */
  B.messageFor = (iso) => {
    const md = iso.slice(5, 10);
    if (DATES[md]) return DATES[md];
    const day = Math.floor(Date.parse(iso + 'T12:00:00Z') / 86400000);
    const n = MESSAGES.length;
    return MESSAGES[(((day * 37) % n) + n) % n]; // 37 is coprime with the list's length, so each day differs until it laps
  };
  const yesterday = (iso) => new Date(Date.parse(iso + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  // what's chalked up right now: today's once she's written it, until then yesterday's
  const shown = (s) => B.messageFor(s.motdDay === B.today ? B.today : yesterday(B.today));

  // ---------- the board on the wall ----------
  B.decor({
    id: 'message-board',
    layer: 'interior-back',
    draw(g, s) {
      const { x, y, w, h } = BOARD;
      const cy = B.theme === 'cyber';
      const P = (c, xx, yy, ww = 1, hh = 1) => B.px(g, c, xx, yy, ww, hh);
      P(cy ? '#2c303b' : '#5a3a20', x - 1, y - 1, w + 2, h + 2); // the frame
      P(cy ? '#c8ccc0' : '#2a3230', x, y, w, h); // slate, or e-ink paper
      P(cy ? '#3ff5ff' : '#7a5232', x - 1, y - 1, w + 2, 1); // the frame's lit top edge
      P('#222', x + Math.floor(w / 2), y - 4, 1, 3); // the string it hangs from
      // the writing: a line of scribble per few words, its rhythm taken from the message itself
      const msg = shown(s);
      const ink = cy ? '#3a3e48' : '#d8d4c8';
      let cx = x + 2;
      let row = 0;
      for (let i = 0; i < msg.length && row < 4; i++) {
        const ch = msg.charCodeAt(i);
        if (msg[i] === ' ') {
          cx += 1;
        } else if (ch % 3 !== 0) P(ink, cx, y + 2 + row * 3, 1, 1 + (ch % 5 === 0 ? 1 : 0));
        cx += 1;
        if (cx > x + w - 3) {
          cx = x + 2;
          row++;
        }
      }
      if (!cy) P('#e8e4d8', x + w - 3, y + h - 1, 2, 1); // a stub of chalk on the ledge
    },
  });

  // ---------- Mabel chalks up the day's message ----------
  B.activity({
    id: 'write-message',
    weight: 8,
    cooldown: 30,
    when: (s, o) => o.area === 'inside' && s.motdDay !== B.today && s.shop.open && s.customersInside() === 0,
    *run(s, o) {
      yield o.go(SPOT);
      o.face('away');
      yield o.hold('dust', 1.4); // rubs out yesterday's
      yield o.hold('write', 2.6);
      s.motdDay = B.today;
      B.log(`${name()} chalks up today's message: “${B.messageFor(B.today)}”`);
      o.face(0);
      o.emote('spark', 1.2);
    },
  });
  B.on('ready', (s) => {
    // opening the game mid-afternoon: she's already written it
    if (s.motdDay !== B.today && s.hour >= 11) s.motdDay = B.today;
  });

  // ---------- the close-up ----------
  let panel = null;
  function openBoard(s) {
    if (typeof document === 'undefined') return;
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'tvpanel boardpanel';
      panel.setAttribute('aria-label', 'Message of the day');
      panel.innerHTML = '<button class="close" aria-label="Close">×</button><h2>Message of the day</h2><p class="boardDate"></p><p class="boardMsg"></p>';
      Object.assign(panel.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
      panel.querySelector('.close').addEventListener('click', closeBoard);
      document.body.appendChild(panel);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeBoard();
      });
      document.addEventListener('pointerdown', (e) => {
        if (panel.style.display !== 'none' && !panel.contains(e.target) && e.target.id !== 'screen' && e.target.tagName !== 'CANVAS') closeBoard();
      });
    }
    const cy = B.theme === 'cyber';
    const msgEl = panel.querySelector('.boardMsg');
    const iso = s.motdDay === B.today ? B.today : yesterday(B.today);
    panel.querySelector('.boardDate').textContent = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + (iso !== B.today ? ' (Mabel hasn’t chalked up today’s yet)' : '');
    msgEl.textContent = B.messageFor(iso);
    Object.assign(msgEl.style, {
      margin: '8px 0 4px', padding: '16px 14px', fontSize: '17px', lineHeight: '1.45', borderRadius: '3px',
      border: cy ? '2px solid #3ff5ff' : '6px solid #5a3a20',
      background: cy ? '#d8dcd0' : '#2a3230', color: cy ? '#1a1c22' : '#ece8dc',
      fontFamily: cy ? 'ui-monospace, monospace' : '"Chalkboard SE", "Comic Neue", "Bradley Hand", cursive',
    });
    panel.style.display = '';
    panel.classList.remove('hidden');
  }
  function closeBoard() {
    if (panel) panel.style.display = 'none';
  }
  const onBoard = (x, y) => x >= BOARD.x - 2 && x < BOARD.x + BOARD.w + 2 && y >= BOARD.y - 4 && y < BOARD.y + BOARD.h + 2;
  B.clickables = (B.clickables || []).concat(onBoard);
  B.on('click', (s, x, y) => {
    if (!onBoard(x, y)) return;
    s.clickTaken = true;
    if (panel && panel.style.display !== 'none') closeBoard();
    else openBoard(s);
  });
  if (typeof window !== 'undefined' && window.addEventListener)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'b' && e.target.tagName !== 'INPUT' && B.world) openBoard(B.world);
    });
  B.openBoard = () => B.world && openBoard(B.world);
})(window.Bookshop);
