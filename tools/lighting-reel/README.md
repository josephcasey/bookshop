# Lighting reel

A deterministic set of contact sheets showing the off-screen lighting (`content/features/offscreen-lights.js`):

| Sheet | Contents |
|---|---|
| A | A dipped-beam turning car, 4 moments, in Cyber. |
| B | Passing car, bus, bike and emergency vehicle. |
| C | Steady lights only, rain, fog, daytime and dusk. |
| D | Window close-ups of a main-beam turn. |
| E | Filmstrips of a full turn and an emergency pass. |
| F | The cat's silhouette thrown across the shelves. |

It was used to iterate the lighting with a physics reviewer and an art critic. It also works as a golden-image regression check.

The reel renders the sheets from its own freshly built world, with seeded randomness and a frozen clock, so the same code always gives the same pixels.

## Use

1. Start the game's dev server, then the sink:

   ```bash
   python3 tools/lighting-reel/sink.py
   ```

   It listens on 127.0.0.1:8124, serves `reel.js` and the golden images to the page, and saves the sheets the page posts.
2. In the game page's console:

   ```js
   const reel = await import('http://127.0.0.1:8124/reel.js?' + Date.now());
   await reel.run('review');           // render the sheets into tools/lighting-reel/out/ for a look
   await reel.run('check', 'check');   // render and compare with golden/: returns [{ name, changedPct, pass }]
   await reel.run('golden', 'bless');  // accept the current look as the new golden reference
   ```

   A sheet passes when fewer than 0.5% of its pixels differ by more than 24/255 in any channel.

## Locked looks

These are the agreed keepers from the review. A failing check that touches them needs a deliberate re-bless:

- **Turning car:**
  - The wait, a ~2.25 s slide, then the beam leaving the window in ~0.3 s.
  - A three-level hotspot with a soft glazing-bar cross.
  - The dipped-beam kick-up wedge.
- **Shadows:**
  - Texture quietened inside shadows.
  - Prop shadows thrown sideways onto the plaster.
- **Steady and emergency light:**
  - The warm/blue emergency double flash, never dimmer than 0.45.
  - The pub print's warm floor.
- **Cyber theme:**
  - The leading-arc magenta rim.
  - Neon is never dimmed by other light.
- **Outside:**
  - Actors cut out of and lit flat by the outside light.
  - The 2×2 checker only on light ramps.
  - The untouched daytime frame.

## Receiver-buffer comparison (SCH-30)

The first alternate-lighting prototype can be enabled interactively with `?lighting=relight-v2`. It replaces the
production window projection and interior sun patch with one per-pixel visibility solver, while retaining the
production facade, glass reflection and shop lamps.

For deterministic review stills, run the dev server and sink, then open:

```text
http://localhost:8123/?relight-comparison&date=2026-06-21
```

The page writes two current-versus-alternate Cyber sheets to `tools/lighting-reel/out/`: seven full scenes and an
enlarged interior crop. The harness creates a fresh world, freezes its clock and seeds randomness, so reruns are
directly comparable.

### Art-direction contrast comparison

To compare lighting taste separately from lighting geometry, open:

```text
http://localhost:8123/?contrast-comparison&date=2026-06-21
```

This writes `SCH-30-contrast-cyber.png` and `SCH-30-contrast-cyber-interior.png`. Each row uses the same Cyber scene
and presents three columns: production lighting; the production solver with cooler weather ambience and warmer, more
directional practical lights; and the receiver-buffer solver with that identical art direction. The embedded report
records visual delta, practical-to-recess contrast, warm/cool separation and highlight-to-shadow span.

### Cyber solver comparison

To compare the current projection with both replacement candidates under one fixed Cyber art direction, open:

```text
http://localhost:8123/?cyber-solvers-comparison&date=2026-06-21
```

This writes `SCH-30-cyber-solvers.png` and `SCH-30-cyber-solvers-interior.png`, with current projection, receiver
buffer and low-resolution orthographic 2.5D in three columns. The ortho pass is low-resolution lighting only; all
three columns render the same full-resolution 320×180 Cyber artwork and simulation.

### Playable hybrid comparison

To compare current gameplay with the recommended complete hybrid package, open:

```text
http://localhost:8123/?hybrid-comparison&date=2026-06-21
```

This writes `SCH-30-hybrid-gameplay.png` and `SCH-30-hybrid-gameplay-interior.png`. Six rows cover overcast,
rain, clear afternoon sun, golden hour and two headlight scenes. The two columns keep the same Cyber artwork,
characters, practical-lamp choices and seeded simulation; only the playable hybrid is switched.

For normal interactive play, use `?lighting=hybrid-v1` or click **Current light** in the HUD. The button reads
**Hybrid light** while the experiment is active.
