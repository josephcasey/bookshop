# Style bible: Dog-Eared Books

The shared target for everyone working on how the game looks, including the physics reviewer and the art critic.
Check every change against this page and against the reference frames.

## The signature: light is the medium

Landmark pixel-art games commit to one rendering idea and apply it everywhere:

- Noita simulates every pixel.
- The Last Night puts flat sprites in modern light and fog.
- Dead Cells renders 3D down to sprites.

Ours is **light as the medium**. The scene is hand-placed pixel art, and everything that makes it feel alive is light from real sources, behaving physically, then snapped back onto the pixel grid. That covers:

- the sun and the sky;
- headlights and police lights;
- the pub and the neon across the road;
- the lamp post and the shop's own lamps.

Players watch an idle game more than they play it, so the street is a living diorama. The light is the content: a car pulling out of the junction at night throws the window across the shelves and every prop's shadow with it.

**Engine reality.** This is hand-written JavaScript on a 2D canvas at 320×180, with procedurally drawn sprites and no 3D. Of the possible signatures:

| Signature | Status |
|---|---|
| Light as the medium | Ours |
| Systemic weather and time | Builds on it naturally (sun, clouds, fog, rain, day and night) |
| Simulated pixels (rain pooling and running off) | A good later addition |
| A 3D-to-pixel pipeline | Not a fit: it would be a rewrite |

## Rules

1. **One pixel scale.** Everything is drawn at 320×180 and shown at integer scale. There are no mixed resolutions and no rotated or scaled sprites unless they are resampled to the grid.
   - Magnified shadows are scaled smoothly, then snapped to the light bands.
2. **Light is a separate pass, quantised back to the grid.**
   - Light is computed in its own maps and quantised to a few levels: 5 outside, 3 hard cel bands inside.
   - It is dithered only on smooth ramps, with a plain 2×2 checker. Never dither hard edges, flat fields or the inside of shadows.
   - A locked palette (the Lighting Lab's *Locked palette*) is the next step. It snaps the finished frame to one fixed palette and is under evaluation.
3. **Light reveals; it doesn't paint.**
   - Lit surfaces show their own colour, tinted by the light.
   - Shade multiplies by the sky's cool colour.
   - Additive light is kept to glare, a small share.
   - Emissive surfaces (neon, screens) only ever gain light.
4. **Physics drives the visuals.**
   - Every highlight and shadow comes from a source with a position, size, colour and strength: the sun's elevation and azimuth, a lamp's height, a car's two headlamps.
   - Shadows are projections from that source, never hand-placed decoration.
   - The physics reviewer's numbers (falloff, penumbra, beam pattern, adaptation) set the defaults. Art direction may bend them, but deliberately and for a stated reason.
5. **One source tells one story.**
   - Each light has its own grammar, readable at a glance: the pub's warm print, the slow drift and sudden exit of a turning car, the blue double flash, the bus's warm band, golden hour climbing the front.
   - When sources compete, the strongest wins: exposure adapts.
6. **Silhouettes over texture.** Inside a shadow, texture quietens so a cast shadow reads as a shape. The cat's ears matter more than the book spines.
7. **Day is as physical as night.**
   - The sun moves, and ledges, recesses, the lamp post, people and cars cast shadows at its angle.
   - The buildings opposite shade the front as the sun sinks.
   - Clouds drift shadows across the street.
   - Low sun shines through the window.

## Reference frames

The golden sheets in `tools/lighting-reel/golden/` are the reference frames. `tools/lighting-reel/README.md` explains how to render, check and bless them. The locked looks:

- **The turning car:** a wait, a ~2.25 s drift, an exit in ~0.3 s, and a three-level hotspot with a soft glazing-bar cross.
- **The dipped beam:** the kick-up wedge.
- **Interior shadows:** the cat's silhouette thrown across the shelves, and prop shadows thrown sideways onto the plaster.
- **Steady lights:**
  - The warm print of the pub's window on the back wall.
  - The warm/blue emergency double flash, never dimmer than 0.45.
- **Neon theme:** the magenta rim on the leading arc, and neon never dimmed by other light.
- **Outside:** actors cut out of the outside light and lit flat, and the 2×2 checker only on ramps.
- **Daytime:** the sun's shadows.
- **The gold blade:** a side street opens in the skyline across the road. From about 12° down to 3°, a ~40 px column of low sun sweeps across the front (about 100 px an hour, as the azimuth swings), lights the fascia letters and a pane upstairs, and enters the shop as a warm slab with glazing-bar shadows. It is the day's signature beat.
- **Sun shadow edges:** one penumbra for every edge, horizontal or vertical: the sun's 0.53° disc at the skyline's slant distance, 2–3 px, quantised to shade / half / lit. No checker.
- **Sunlight indoors:** the surface's own colour times the light (albedo × E), never an additive wash. The spines keep their colour.
- **Dusk:** exposure falls steadily with the sun. The west-facing front takes the afterglow (peach, rose, then blue). The glass mirrors the burning western sky above the black roofs opposite, while the room shows through below them. The alley vista, looking ENE, shows the earth's shadow rising under the Belt of Venus. Venus comes out alone first, the bright stars at −5°, the rest at −8°.
- **Dawn:** the front is in its own shadow, cool, with a rim of sun on the cornice and the alley's end glowing.
- **Neon by day:** the smog follows the sun: cool and backlit in the morning, white and flat at noon, a heavy amber band low on the front in the afternoon.
- **Cloud shadows** cross at about 120 px/s with a ~300 px soft edge.
- **The street behind you, in the glass:** the terrace opposite (each building its own shop, authored at the size it appears in the glass, one signature each), walkers on its pavement and the passing traffic, through a plane mirror: an eye 1.6 m up and 14 m out, the facade 22 m beyond the glass (a 2.57x reduction, no left-right flip). The shop window sees the ground floors and the road; the upstairs panes see sky. A reflection adds light: it shows in the room's darks and vanishes against its bright surfaces. After dark only emitters reflect: lit windows, signs, lamps, a bus's lit decks.

## Deliberate conventions

- **The view is an elevation.** The pavement is foreshortened as if seen from about 4 m up, but mirrors and sight lines use an eye 1.6 m up and 14 m out. Don't "correct" one without the other.
- **Traffic lanes** sit 2.4 m and 3.7 m from our wall (a physical street would put them at 5-7 m and 13-15 m), for visual punch: bigger reflections, and car shadows that reach the wall up to ~30 deg of sun.
- **The glass's reflection is helped in the room's darks.** Physically, transmitted and reflected light simply add (screen already hides a reflection over bright surfaces). The reflection is additionally scaled by the room's darkness, floored at 0.4 by day and 0.8 at night, a bend of at most 60% by day and 20% at night, so the shop stays legible.
- **The lettered transom** doesn't carry the reflection (its gold leaf would mirror the first floors opposite); the labels stay readable.
- **Shadows from the shop's lamps are capped in size:** a prop's shadow at most 2.4x, a person's 2x (someone just behind a pendant would really throw a 10x shadow across the whole wall), and the bulb's penumbra at 3 px. Big enough to read, never a wall-sized blot.
- **The pub and chippy prints** come from sources 7.8 m out; their mirror images are at 22 m. The near distance is a deliberate gain (the locked night look).

## The Lighting Lab

The **Lab** button in the top bar:

- **Scenarios:** sunrise, morning, noon, afternoon sun, gold blade, golden hour, cloudy day, sunset glow, blue hour, night turn, night rain, fog and emergency.
- **Approaches:** a toggle for every lighting approach.
- **Compare:** split screen, with the approach on the left and off on the right. Drag across the scene to move the divider.
- **Benchmark:** for the current scenario, how much of the picture each approach changes and what it costs per frame.

Use it to justify every approach. If something changes almost nothing in any scenario, question it.
