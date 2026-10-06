# Adding to the shop

The engine (`js/`) rarely needs touching. New things happen in `content/`, which has three kinds of file:

| Where | What goes there | Date-gated? |
|---|---|---|
| `content/base/` | the core shop (routines, idle behaviour, phone, deliveries, customers, street, sound) | never |
| `content/features/` | everything added since (the cat, pigeons, litter, the alley, weather, evenings upstairs…) | never: always on, whatever the date |
| `content/daily/` | **only** things tied to particular dates: special chalkboards, holidays, one-off events | yes: `dates`, `from` / `until` |

`content/changelog.js` holds the dated "What's new" notes (announcements only; they don't switch anything on).

To add a new feature, create `content/features/<name>.js` and list it in `content/manifest.js`.
For something that should only happen on a given day, put it in `content/daily/` with a date gate:
`dates: ['12-25']` (every Christmas), `dates: ['2026-10-31']` (one day), or `from: '2026-12-01', until: '2026-12-24'`.
Preview another date with `?date=2026-12-25` in the URL.

Every definition has an `id`. **Registering an existing id again merges into it**, so a later file can
tweak earlier content without editing it:

```js
Bookshop.activity({ id: 'make-coffee', cooldown: 20 });         // she drinks more coffee now
Bookshop.station({ id: 'pop', likes: 0.6 });                    // ...and has come round to pop
Bookshop.disable('visitor', 'jogger');                          // no more joggers
Bookshop.tune({ closeHour: 16 }, { dates: ['12-24'] });         // early close on Christmas Eve
```

## Kinds of content

| Kind | Call | What it is |
|---|---|---|
| Activity | `B.activity({...})` | Something the owner does. Idle ones are picked at random by `weight`. |
| Visitor | `B.visitor({...})` | A kind of person who spawns on the pavement. |
| Happening | `B.happening({...})` | A world event rolled `perHour` (phone ringing, deliveries). |
| Call | `B.call({...})` | One way a phone call can go. |
| Show | `B.show({...})` | A programme on Mabel's telly: scenes that draw a 64×48 picture, with sound cues. See `content/features/tv.js` and `content/shows/tng.js`. |
| Station | `B.station({...})` | A radio station; its music is generated from the fields. `genre` labels it in the tuner, `style` picks the rhythm section (`waltz jazz pop folk synth rock reggae blues lofi baroque bossa ambient`, see `RADIO_STYLES` in `js/audio.js`). Add `stream: 'https://…'` to play live internet radio instead (it must send CORS headers; see `content/features/live-radio.js`). |
| Decor | `B.decor({ layer, draw(g, s) })` | Extra pixels on a layer: `sky`, `upstairs`, `upstairs-front`, `interior-back`, `counter`, `interior`, `interior-front`, `facade`, `street`, `overlay`. |
| Look | `B.look(name, {...})` | A named appearance (see `content/base/looks.js` for fields). |
| Chalkboard | `B.chalk({ lines: ['UP TO', '7 CHARS', 'X3'] })` | Message on the pavement board. Dated boards win on their day. |
| Note | `B.note({ date, title, text })` | The “New today” card and the diary’s “What’s new” list. |
| Hook | `B.on('sale', (s, npc) => ...)` | Events: `enter`, `leave`, `sale`, `open`, `close`, `radio`, `weather`, `newDay`, `activity`, `tick`, `log`. |

Units: `cooldown` is in story minutes and `perHour` is per story hour. One story hour is about
2 real minutes at 1×.

## Writing scripts

Activities, visitors, happenings and calls have a generator `*run(...)`. `yield` pauses the script:

```js
Bookshop.activity({
  id: 'feed-the-cat',
  weight: (s, o) => (o.mood > 0.5 ? 2 : 0.5), // mood 0..1, energy 0..1, caffeine 0..1
  cooldown: 60,
  when: (s, o) => s.shop.open,
  *run(s, o) {
    yield o.go('counter');          // named spots in B.LAYOUT.spots, or an x position (see B.LAYOUT.ranges)
    o.face('side');                 // -1 / 1 profile, 'side' either, 'away' back turned, 0 towards the window
    yield o.hold('crouch', 2);      // pose for 2 seconds
    o.emote('heart');               // bubble: note heart bang what zzz rain talk dots coffee spark angry sweat happy book sun phone coin sigh
    o.moodUp(0.05);
    Bookshop.log('Mabel feeds the cat.');
    yield 1.5;                      // wait
  },
});
```

- Facing: characters should mostly be side-on (profile) or turned away while they work: `'away'` at shelves, the radio, the coffee machine or a door, and side-on at the counter, the till or another person. Keep `face(0)` for moments that really are about looking out of the window (gazing at the rain, waving at a passer-by, answering a knock) so nobody looks like they're performing for the viewer.
- `yield [a, b]` runs actions in parallel; `yield someGenerator()` runs a nested script.
- `const ok = yield B.act.until(() => cond, timeoutSec)` waits for a condition.
- `yield* B.talk(o, 6, npc)` is a back-and-forth conversation.
- Poses: `stand reach shelve browse wave backwave stretch cheer dance drink read hug sit sitread sleep write wrap till unpack lean think hips shrug facepalm cross clap point dust sweep water crouch carry backstand`.
- Faces follow the speech bubble automatically (heart → heart-eyes, bang → surprised, spark → laughing, rain → sad…), otherwise mood. Force one with `o.exprOverride = 'worried'` (`neutral happy laugh sad worried angry surprised smitten puzzled tired closed yawn`).
- Holding: set `o.holding` to `cup book books box bag broom receiver parcel`. Whatever she holds is put down automatically if she's interrupted.
- To make her react right away instead of waiting to be picked: `s.request('activity-id', priority, data)`.
  Priorities: idle 1, reactions 2, routines 3, phone/delivery 4, serving 5. Use `idle: false` for activities that only run on request.

The passage under the POETRY sign: characters walk away into it (getting smaller), turn left or right at the far end and walk out of sight; the stairs up to Mabel's flat rise off to the right.
- `yield* a.backRoom(s, 20, side)`: off into the back rooms (side -1 left / 1 right, random if omitted), back 20s later.
- `yield* a.intoPassage(s, side, stairs)` / `yield* a.outOfPassage(s, side, stairs)`: one-way trips; `stairs: true` climbs up (or comes down) the stairs. Mabel uses `intoPassage(s, 1, true)` to go up to her flat and `outOfPassage(s, 1, true)` to come down.

Visitors get `(s, n)`. Handy NPC helpers: `yield* n.enter(s)`, `yield* n.browse(s)`,
`yield* n.payAtTill(s)`, `yield* n.leave(s)`, `yield n.walkOff()`, and
`yield* B.customerVisit(s, n, { buy: 0.8 })` for a whole shop visit.

## Upstairs and the cat

- Mabel's evenings happen in the flat upstairs (`o.area === 'upstairs'`). Give an activity `area: 'upstairs'` to make it an evening one. Spots are in `B.LAYOUT.upstairsSpots`; `s.upstairs` holds `light`, `blind` (0 up … 1 down), `tv` and `kettle`. Decor layers `upstairs` / `upstairs-front` draw into the flat.
- Marmalade the cat lives in `content/features/cat.js`, built only from hooks. Add behaviours with
  `Bookshop.catBehaviour({ id, weight: (s, cat) => n, *run(s, cat) { yield* cat.goTo('counter', 190); yield cat.hold('groom', 3); } })`.
  Surfaces: `sill`, `counter`, `shelf`, `floor` (the floor is out of sight). Cat poses: `sit loaf sleep walk crouch jump paw groom stretch`.

## Sound

All sound is synthesised (`js/audio.js`). `content/base/foley.js` adds footsteps, pose sounds and off-screen street life:
- New sound: `B.audio.define('name', ({ tone, noise, shop, street }, x) => tone(440, 0.2, { pan: x / 160 - 1, bus: street }))`, then `B.audio.play('name', x)`. Use `bus: shop` for anything inside (heard muffled through the glass), `street` for outside; `lp` adds distance.
- A pose sound: add to `POSE_LOOP` (repeats while held) or `POSE_ENTER` (once) in foley.js.
- Background life: push to `Bookshop.ambience`, e.g. `{ id: 'ice-cream-van', sound: 'jingle', perSec: (s, h) => (h > 14 && h < 17 ? 0.01 : 0) }`.

## Weather

`s.weather` has `kind` (clear, cloudy, rain, fog, snow) plus eased intensities `rain`, `snow`, `fog`, `cloud` (0..1) and `cover` (how much snow is lying). Force it with `Bookshop.setWeatherKind(s, 'snow')` (or `null` for automatic), and react via `B.on('weather', (s, kind, prev) => …)`. See `content/features/weather.js` for examples (footprints, snowball fights, a snowman).

## Testing from the console

```js
Bookshop.do('dance')           // start an activity now
Bookshop.fire('phone-ring')    // trigger a happening, or spawn a visitor by id
Bookshop.at(17.4)              // jump to 17:24 today
Bookshop.world.owner.mood = 0.1
```

## Geometry

Everything is laid out on a 320×180 canvas around a ground line at y=164 (see `B.LAYOUT` in `js/world.js`).
People are about 60px tall (`look.h` adds ±2px per step); the door opening is 72px and the ceiling beam sits just above head height.
Inside, the owner walks in the `back` lane (behind the counter) and customers in the `front` lane; through the window you see them from the knees up.
