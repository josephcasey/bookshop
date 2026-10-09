/* 2026-10-09 (SCH-27: the message of the day)
 * A little whiteboard on the wall behind the counter carries a new message every day, the same all day for everyone.
 * From the street it's just marker scribble; click or tap it (or press B) for a pixel close-up of the board, the
 * message in marker pen (SCH-33). Each morning, once the shop's open, Mabel wipes off yesterday's and writes up the
 * new one. Every message is Mabel's own (no quotations): the list cycles without repeats, and a few dates have their
 * own. */
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
  // marker colours: blue, black, red, green (the close-up uses the same)
  const INKS = ['#2a5bd7', '#1c1e26', '#d8323a', '#2c9a4a'];
  B.decor({
    id: 'message-board',
    layer: 'interior-back',
    draw(g, s) {
      const { x, y, w, h } = BOARD;
      const P = (c, xx, yy, ww = 1, hh = 1) => B.px(g, c, xx, yy, ww, hh);
      P('#7c828e', x - 1, y - 1, w + 2, h + 2); // the aluminium frame
      P('#b8bec8', x - 1, y - 1, w + 2, 1); // its lit top edge
      P('#f2f2ee', x, y, w, h); // the white board
      P('#e2e3de', x + w - 6, y + 1, 4, 1); // a sheen
      P('#5a606c', x - 1, y + h + 1, w + 2, 1); // the pen tray
      P(INKS[0], x + 3, y + h + 1, 2, 1); // a blue marker in it
      P(INKS[2], x + 7, y + h + 1, 2, 1); // and a red one
      // the writing: a line of marker scribble per few words, its rhythm taken from the message itself
      const msg = shown(s);
      let cx = x + 2;
      let row = 0;
      for (let i = 0; i < msg.length && row < 3; i++) {
        const ch = msg.charCodeAt(i);
        if (msg[i] === ' ') cx += 1;
        else if (ch % 3 !== 0) P(INKS[row % 2], cx, y + 2 + row * 3 + (ch % 7 === 0 ? -1 : 0), 1, 1 + (ch % 5 === 0 ? 1 : 0));
        cx += 1;
        if (cx > x + w - 3) {
          cx = x + 2;
          row++;
        }
      }
      P(INKS[2], x + w - 5, y + h - 2, 3, 1); // the red underline under the date
    },
  });

  // ---------- Mabel writes up the day's message ----------
  B.activity({
    id: 'write-message',
    weight: 8,
    cooldown: 30,
    when: (s, o) => o.area === 'inside' && s.motdDay !== B.today && s.shop.open && s.customersInside() === 0,
    *run(s, o) {
      yield o.go(SPOT);
      o.face('away');
      yield o.hold('dust', 1.4); // wipes off yesterday's
      yield o.hold('write', 2.6);
      s.motdDay = B.today;
      B.log(`${name()} writes today's message on the whiteboard: “${B.messageFor(B.today)}”`);
      o.face(0);
      o.emote('spark', 1.2);
    },
  });
  B.on('ready', (s) => {
    // opening the game mid-afternoon: she's already written it
    if (s.motdDay !== B.today && s.hour >= 11) s.motdDay = B.today;
  });

  // ---------- the close-up: a pixel-art view of the whiteboard on the wall ----------
  // Drawn at 1:1 on a small canvas and shown scaled up with hard pixels, like the rest of the game. The message is
  // hand-lettered with a marker-style font, then snapped to the pixel grid (any half-covered pixel is either ink or
  // board), so it reads as marker pen in pixel art rather than smooth type.
  const CW = 176;
  const CH = 112;
  const WB = { x: 12, y: 10, w: 152, h: 84 }; // the white surface, within the close-up
  const HAND = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive';
  function rng(seed) {
    let a = seed >>> 0;
    return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  /** Hand-letter `text` in `col` at (x, y) at `size` px, snapped to hard pixels. Returns its width. */
  function marker(g, text, x, y, size, col, bold = false) {
    const m = document.createElement('canvas');
    const ctx = m.getContext('2d');
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${HAND}`;
    const w = Math.ceil(ctx.measureText(text).width) + 2;
    m.width = w;
    m.height = size + 6;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${HAND}`;
    ctx.fillStyle = col;
    ctx.textBaseline = 'top';
    ctx.fillText(text, 1, 1);
    const d = ctx.getImageData(0, 0, m.width, m.height);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 96 ? 255 : 0; // ink or board: no soft edges
    ctx.putImageData(d, 0, 0);
    g.drawImage(m, Math.round(x), Math.round(y));
    return w - 2;
  }
  function wordW(word, size) {
    const m = document.createElement('canvas').getContext('2d');
    m.font = `${size}px ${HAND}`;
    return m.measureText(word).width;
  }
  function paintCloseUp(c, iso) {
    const g = c.getContext('2d');
    const cy = B.theme === 'cyber';
    const P = (col, x, y, w = 1, h = 1) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    };
    const r = rng(Date.parse(iso + 'T12:00:00Z') / 86400000);
    // the shop wall around it: panelled concrete in the neon city, warm plaster on the old street
    P(cy ? '#2b2d3a' : '#d8c7a2', 0, 0, CW, CH);
    for (let y = 0; y < CH; y += 2) for (let x = (y / 2) % 2; x < CW; x += 3) if (r() < 0.25) P(cy ? '#30333f' : '#cfbd96', x, y);
    if (cy) for (const y of [36, 76]) P('#24262f', 0, y, CW, 1);
    P(cy ? '#1a1b23' : '#b8a47e', WB.x - 2, WB.y + WB.h + 10, WB.w + 6, 3); // its shadow on the wall
    // the frame: brushed aluminium, lit from the upper left
    P('#6e7480', WB.x - 4, WB.y - 4, WB.w + 8, WB.h + 8);
    P('#c4cad4', WB.x - 4, WB.y - 4, WB.w + 8, 1);
    P('#a8aeb8', WB.x - 4, WB.y - 4, 1, WB.h + 8);
    P('#9aa0aa', WB.x - 3, WB.y - 3, WB.w + 6, 2);
    P('#4e5460', WB.x - 4, WB.y + WB.h + 3, WB.w + 8, 1);
    for (const [cx, cyy] of [[WB.x - 3, WB.y - 3], [WB.x + WB.w + 2, WB.y - 3], [WB.x - 3, WB.y + WB.h + 2], [WB.x + WB.w + 2, WB.y + WB.h + 2]]) P('#3a3e48', cx, cyy, 1, 1); // the corner screws
    // the board: white, with a soft diagonal sheen and the ghosts of old messages that never quite wiped off
    P('#f4f4f0', WB.x, WB.y, WB.w, WB.h);
    for (let k = 0; k < 18; k++) P('#ffffff', WB.x + 96 + k, WB.y + 2 + k, 22 - k, 1);
    for (let k = 0; k < 7; k++) {
      const gx = WB.x + 4 + Math.floor(r() * (WB.w - 30));
      const gy = WB.y + 4 + Math.floor(r() * (WB.h - 10));
      for (let q = 0; q < 14 + r() * 16; q++) if (r() < 0.6) P('#e6e7e2', gx + q, gy + Math.round(Math.sin(q * 0.7) * 1.5));
    }
    // the date, top right, in red
    const d = new Date(iso + 'T12:00:00Z');
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const dw = wordW(date, 10);
    marker(g, date, WB.x + WB.w - dw - 6, WB.y + 3, 10, INKS[2]);
    for (let x = 0; x < dw; x++) P(INKS[2], WB.x + WB.w - dw - 5 + x, WB.y + 15 + (x > dw * 0.6 ? 1 : 0)); // underlined, a touch wonky
    // the message, word by word: lines wrapped to the board, each word a little off the line, colours alternating
    const msg = B.messageFor(iso);
    let size = 14;
    let lines;
    for (;;) {
      lines = [[]];
      let lw = 0;
      for (const word of msg.split(' ')) {
        const ww = wordW(word + ' ', size);
        if (lw + ww > WB.w - 14 && lines[lines.length - 1].length) {
          lines.push([]);
          lw = 0;
        }
        lines[lines.length - 1].push(word);
        lw += ww;
      }
      if (lines.length * (size + 3) <= WB.h - 26 || size <= 10) break;
      size -= 1;
    }
    let ly = WB.y + 20 + Math.max(0, Math.floor((WB.h - 26 - lines.length * (size + 3)) / 2));
    lines.forEach((ln, li) => {
      const col = INKS[li % 2]; // blue, then black
      let lx = WB.x + 7 + (li % 2) * 2;
      for (const word of ln) {
        lx += marker(g, word, lx, ly + Math.round(r() * 2 - 1), size, col) + wordW(' ', size) + Math.round(r() * 2);
      }
      ly += size + 3;
    });
    // a little doodle in green: a heart, a star or a book
    const dx = WB.x + 6;
    const dy = WB.y + 4;
    const kind = Math.floor(r() * 3);
    const G = INKS[3];
    if (kind === 0) for (const [x, y] of [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [3, 1], [6, 1], [0, 2], [6, 2], [1, 3], [5, 3], [2, 4], [4, 4], [3, 5]]) P(G, dx + x, dy + y);
    else if (kind === 1) for (const [x, y] of [[3, 0], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [5, 3], [2, 4], [4, 4], [1, 5], [5, 5]]) P(G, dx + x, dy + y);
    else {
      for (let x = 0; x < 9; x++) P(G, dx + x, dy + (x < 4 ? 1 : x === 4 ? 2 : 1));
      for (let x = 0; x < 9; x++) P(G, dx + x, dy + 6);
      P(G, dx, dy + 1, 1, 6);
      P(G, dx + 8, dy + 1, 1, 6);
      P(G, dx + 4, dy + 2, 1, 5);
    }
    // the pen tray along the bottom: two markers and an eraser
    const ty = WB.y + WB.h + 4;
    P('#5a606c', WB.x - 2, ty, WB.w + 4, 3);
    P('#8a909c', WB.x - 2, ty, WB.w + 4, 1);
    for (const [mx, col] of [[WB.x + 20, INKS[0]], [WB.x + 40, INKS[2]], [WB.x + 58, INKS[1]]]) {
      P('#e8e8e4', mx, ty - 2, 14, 3); // the barrel
      P(col, mx + 10, ty - 2, 4, 3); // the cap
      P(col, mx + 2, ty - 1, 6, 1); // the label stripe
    }
    P('#2a2c34', WB.x + WB.w - 30, ty - 4, 18, 5); // the eraser
    P('#6a6e78', WB.x + WB.w - 30, ty - 4, 18, 1);
    P('#d8d8d0', WB.x + WB.w - 29, ty, 16, 1); // its felt
  }

  let panel = null;
  function openBoard(s) {
    if (typeof document === 'undefined') return;
    if (!panel) {
      panel = document.createElement('aside');
      panel.className = 'tvpanel boardpanel';
      panel.setAttribute('aria-label', 'Message of the day');
      panel.innerHTML = '<button class="close" aria-label="Close">×</button><h2>Message of the day</h2><canvas class="boardCanvas"></canvas><p class="hint boardNote"></p>';
      Object.assign(panel.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(560px, calc(100vw - 32px))' });
      const cv = panel.querySelector('canvas');
      cv.width = CW;
      cv.height = CH;
      Object.assign(cv.style, { width: '100%', imageRendering: 'pixelated', display: 'block', borderRadius: '2px' });
      panel.querySelector('.close').addEventListener('click', closeBoard);
      document.body.appendChild(panel);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeBoard();
      });
      // (a click outside closes it: js/main.js does that for every panel)
    }
    const iso = s.motdDay === B.today ? B.today : yesterday(B.today);
    const cv = panel.querySelector('canvas');
    cv.setAttribute('aria-label', B.messageFor(iso));
    paintCloseUp(cv, iso);
    panel.querySelector('.boardNote').textContent = iso !== B.today ? `${name()} hasn’t written up today’s yet: this is yesterday’s.` : '';
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
