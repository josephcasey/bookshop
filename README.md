# Dog-Eared Books

An idle pixel-art bookshop, seen from the pavement. Mabel opens up, makes coffee, fiddles with
the radio, answers the phone, serves customers and unpacks deliveries. You can tell how she's
feeling from how she moves: tired days are slow and slumped, happy ones have little dances.

## Run

No build step and no dependencies. Serve the folder with the included no-cache dev server, so edits show up on a plain reload:

```bash
python3 serve.py
```

Then open http://localhost:8123. Opening `index.html` directly also works.

- **Story time**: a day takes about 25 minutes, and nights fast-forward. **Live time** follows your clock.
- **Time of day**: jump to any hour with the slider or presets (morning, lunchtime, closing, evening upstairs, night…); `[` and `]` step an hour.
- **Weather**: in the same panel, pick Auto, Clear, Cloudy, Rain, Fog or Snow. Auto follows the real season: fog is likely on autumn mornings and evenings, and snow happens in winter.
- Speed: 1× / 3× / 10×, pause with space. Sound is off until you turn it on.
- **Crowd**: − / + in the top bar (or the `-` and `=` keys) sets how busy the street is: Empty, Quiet, Normal, Busy, Bustling.
- Click the window to knock on the glass, or click the door to ring the bell: Mabel comes down to answer, even from bed, and gets crosser the more you do it.
- **Neon / Classic** in the top bar switches between the cyberpunk look (default) and the original high street. The neon theme lives in `js/cyber.js` and replaces scene pieces by name (see `B.renderKit.PARTS` in `js/render.js`).
- Click Mabel's sitting-room window (or press `t`) to watch her telly close up and pick a programme. Shows live in `content/shows/` (see `content/features/tv.js` for the format).
- Click the radio (or press `r`) to choose the station: classical, jazz, pop, folk, rock, reggae, blues, lo-fi, baroque, bossa nova, ambient, talk, or the cyberpunk NEON GRID FM. Mabel retunes it for you if she's free, and leaves your choice alone for a while.
- The HUD fades out when the mouse is still.
- Progress (time, stock, stats) is saved in localStorage.

## Layout

The view is a close crop of a small, low-ceilinged shop: a bookcase, a passage to back rooms we never see, and the counter. Mabel lives in the flat upstairs.


- `js/`: the engine (coroutine scripts, pixel drawing, character sprites, synth audio, actors, world, director, renderer).
- `content/base/`: the core shop.
- `content/features/`: everything added since, always on.
- `content/daily/`: only things tied to particular dates (special boards, holidays).

See **CONTENT.md** for how to add things.
