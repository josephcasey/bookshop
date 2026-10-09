# Lighting replacement comparison (SCH-30)

## Candidate 1: receiver buffer

This prototype keeps the authored pixel-art scene and light sources, but replaces the existing window projection and
interior sun patch with a single per-pixel visibility solve. For every visible interior pixel it traces the path back
through the window, testing glazing bars, props and people at their authored depths. Sun, vehicle beams and broad
opposite-shop sources use the same visibility path.

The prototype is intentionally narrow: facade lighting, glass reflections and the shop's own lamps still use the
production renderer. It is a still-first visual test, not yet a real-time performance recommendation.

## What the comparison shows

| Scenario (classic interior crop) | Pixels materially changed | Reading |
|---|---:|---|
| Clear morning | 0.00% | Control: no unintended change when no source enters the window. |
| Cloudy noon | 0.00% | Control: diffuse daytime look is preserved. |
| Afternoon sun, 22° | 18.77% | Sun separates shelves, counter, people and glazing by depth. |
| Angled sun, 12° | 4.73% | Narrower low-angle patch remains restrained. |
| Blue hour + main beam | 59.87% | Strongest demonstration of prop/person occlusion and depth. |
| Night rain + main beam | 52.90% | Same geometry survives the wet-night grade without flattening the room. |
| Fog + dipped beam | 7.68% | Fog transmission keeps the interior response quiet rather than washing it out. |

The three strongest cyber checks changed 5.51% (afternoon), 43.42% (blue hour) and 36.12% (night rain) of the
interior crop. The neon sign and exterior grade remain dominant; the alternate only reorganises light inside the
window.

The receiver buffer is a credible alternate because it produces geometry-driven differences rather than a new set of
painted masks. Its best result is direct-source depth: silhouettes, shelves and the counter interrupt illumination in
one consistent system. The trade-off is a harder, more segmented beam than the production compositor's soft cinematic
pool, plus a substantially more expensive CPU path. A later real-time version would need caching, lower resolution or
GPU execution.

## Review artifacts

Run the deterministic capture documented in `tools/lighting-reel/README.md`. It writes:

- `tools/lighting-reel/out/SCH-30-relight-v2-comparison.png` — seven full-frame classic comparisons.
- `tools/lighting-reel/out/SCH-30-relight-v2-interior.png` — enlarged interior crops.
- `tools/lighting-reel/out/SCH-30-relight-v2-cyber.png` — the three strongest cyber checks.

Every row is current on the left and receiver buffer on the right. The output directory remains ignored because these
are regenerated review artifacts, not production assets.
