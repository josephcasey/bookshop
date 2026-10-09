# Cyber orthographic 2.5D comparison (SCH-30)

## Candidate 2: shallow orthographic G-buffer

This prototype represents the “orthographic 3D / 2.5D” alternative from the lighting-replacement discussion without
first rebuilding the whole pixel-art shop as meshes. The authored receiver planes become a compact G-buffer containing
visible depth and estimated surface normals. Incoming light is solved on a 2×2 pixel grid; screen-space depth marching
finds shadows and a Lambert-style response distinguishes front- and top-facing surfaces.

The 2×2 grid affects only this experimental light layer. The Cyber artwork, actors, simulation and final canvas remain
the same 320×180 resolution as the current renderer.

The deterministic sheet holds the Cyber colour-temperature art direction and lamp choices constant across three
columns: current projection, per-pixel receiver buffer, and orthographic 2.5D.

## Results

| Scene | Receiver vs current | Ortho vs current | Ortho vs receiver | Reading |
|---|---:|---:|---:|---|
| Overcast midday | 0.00% | 0.00% | 0.00% | Correct control: no directional source, so art direction alone carries the scene. |
| Rainy night + main beam | 24.60% | 21.90% | 6.84% | Both geometric solvers produce a sparser, darker beam; current projection remains the most cinematic/readable. |
| Clear afternoon, sun 22° | 6.58% | 5.11% | 0.69% | Ortho and receiver are nearly identical; shallow normals add too little to justify a full replacement. |
| Blue hour + main beam | 24.32% | 26.67% | 5.48% | Ortho is the most selective/darkest and gives the strongest depth break, but loses useful fill. |

The change percentages use the enlarged shop-interior crop and a material RGB threshold. They describe magnitude,
not quality.

## Cost and limitations

In an isolated browser capture, the 2.5D pass performed roughly 10–24 thousand screen-space shadow tests for a lit
frame, versus 86–121 thousand receiver rays. Individual timings varied with the browser, but the ortho pass was
consistently the cheaper of the two experimental CPU solvers in directional-light scenes. It still is not ready for a
real-time production path.

The larger limitation is representational: depth planes and estimated normals cannot reveal hidden side geometry.
That makes the result only modestly different from the receiver buffer. A true mesh rebuild could improve that, but
the stills do not currently justify its content cost.

## Recommendation

Do not rebuild the whole scene into orthographic 3D yet. The implemented next experiment is a hybrid Cyber renderer:

1. Keep a restrained version of the current broad cinematic fill for composition and face/shelf readability.
2. Add low-resolution geometry-driven direct light only for sun and hero headlights.
3. Use the 2.5D depth buffer as a performance reference or contact-shadow aid, not as the sole lighting model.

The playable version is documented in `docs/LIGHTING-HYBRID-GAMEPLAY.md`.

## Review artifacts

- `tools/lighting-reel/out/SCH-30-cyber-solvers.png` — four full-frame rows, three solvers.
- `tools/lighting-reel/out/SCH-30-cyber-solvers-interior.png` — enlarged window crops.

Regenerate them with `?cyber-solvers-comparison&date=2026-06-21`. The alternate remains dormant unless
`?lighting=relight-ortho` or `B.relightOrtho.setEnabled(true)` is used.
