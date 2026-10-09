# Cyber receiver-buffer comparison (SCH-30)

## Candidate 1: receiver buffer

Cyber is now the only playable theme and the only theme used by this harness. The classic artwork remains dormant in
the source tree for rollback, but old saved preferences, UI controls and comparison loops can no longer select it.

The receiver-buffer prototype keeps the authored Cyber scene and light sources, but replaces the existing window
projection and interior sun patch with one per-pixel visibility solve. Every visible interior pixel traces back
through the glazing and tests props and people at their authored depths. Sun, vehicle beams and broad opposite-shop
sources therefore share one visibility rule.

The prototype is intentionally narrow: facade lighting, glass reflections and the shop's practical lamps still use
the production renderer. It is a still-first visual test, not a production performance recommendation.

## What the Cyber comparison shows

| Scenario | Interior pixels materially changed | Reading |
|---|---:|---|
| Clear morning | 0.00% | Control: no unintended change when no source enters the window. |
| Cloudy noon | 0.00% | Diffuse daylight is effectively unchanged. |
| Afternoon sun, 22° | 5.84% | Sun gains small, coherent depth breaks across people and shelves. |
| Angled sun, 12° | 0.93% | The low-angle patch stays restrained. |
| Blue hour + main beam | 43.37% | Strongest depth and occlusion demonstration. |
| Night rain + main beam | 36.80% | Geometry remains visible under the wet cyan/magenta grade. |
| Fog + dipped beam | 7.62% | Fog transmission keeps the interior response quiet. |

The receiver buffer is credible for direct-source depth, but it removes some of the production projection's broad,
soft fill. The result is physically stricter and often makes silhouettes and shelf breaks clearer, yet can become too
dark or segmented for the intended cinematic pixel-art composition. This supports a hybrid rather than a wholesale
replacement: keep restrained authored fill for readability, and use cached/lower-resolution visibility for hero sun
and headlight moments.

## Review artifacts

Run the deterministic capture documented in `tools/lighting-reel/README.md`. It writes:

- `tools/lighting-reel/out/SCH-30-relight-v2-cyber-comparison.png` — seven full-frame Cyber comparisons.
- `tools/lighting-reel/out/SCH-30-relight-v2-cyber-interior.png` — enlarged interior crops.

Every row is the current Cyber solver on the left and the receiver buffer on the right. The output directory remains
ignored because these are regenerated review artifacts, not production assets.
