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

## The Lighting Lab

The **Lab** button in the top bar:

- **Scenarios:** morning, noon, afternoon sun, golden hour, cloudy day, dusk traffic, night turn, night rain, fog and emergency.
- **Approaches:** a toggle for every lighting approach.
- **Compare:** split screen, with the approach on the left and off on the right. Drag across the scene to move the divider.
- **Benchmark:** for the current scenario, how much of the picture each approach changes and what it costs per frame.

Use it to justify every approach. If something changes almost nothing in any scenario, question it.
