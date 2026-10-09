# Cyber lighting contrast and colour-temperature comparison (SCH-30)

## Question

Can Cyber scenes feel more exciting—especially under overcast or wet weather—by separating cool exterior ambience
from warm shop practicals, increasing local lighting contrast and making existing shadows easier to read?

The deterministic comparison uses identical seeded scenes in three columns:

1. Current Cyber lighting.
2. Cyber temperature/contrast art direction with the current solver.
3. The same art direction with the receiver-buffer solver.

“Warm” and “cool” describe relationships inside the authored pixel palette, not literal display Kelvin values.

## Result

The tuned treatment increases the separation between the two pendant/desk-lamp pools and the darker passage recess.
That targeted separation is more informative than the whole-crop value range: the latter includes already-bright cyan
category labels and can fall slightly even while the actual practical pools become more distinct.

| Cyber scene | Art change | Practical-pool separation (current → art) | Warm/cool separation (current → art) | Extra receiver change |
|---|---:|---:|---:|---:|
| Overcast midday | 11.09% | 8.38 → 12.69 | 0.56 → 4.73 | 0.00% |
| Rainy afternoon | 16.11% | 2.50 → 12.47 | -2.55 → 2.72 | 0.00% |
| Clear afternoon | 12.23% | 7.40 → 6.84 | 0.34 → 2.04 | 5.72% |
| Blue hour + main beam | 17.94% | 3.47 → 7.68 | -6.14 → -1.95 | 25.91% |

Practical-pool separation is the mean luminance of the authored lamp zones minus the central passage recess. It
directly tests the requested focal contrast. Negative warm/cool numbers mean the interior is still cooler than the
chosen exterior sample; moving toward positive means the warm practicals distinguish themselves more clearly.

## Scene reading

- **Overcast midday:** warm amber pools now pick out the fiction shelves, Mabel and counter while the passage stays a
  cooler rest. The receiver buffer adds nothing because no directional source enters the glass.
- **Rainy afternoon:** this is the clearest improvement. Practical-to-recess separation rises about fivefold while
  the blue-grey street remains intact. Again, a replacement solver is unnecessary.
- **Clear afternoon:** the practical treatment is deliberately restrained so sun remains the key. The receiver adds
  a small amount of genuine depth structure.
- **Blue hour:** warmer shelf/counter pools hold against the cyan and magenta street. The receiver then changes the
  headlight geometry substantially, but also removes some readable cinematic fill.

## Recommendation

Keep the Cyber-specific temperature controls as the art-direction baseline: amber practicals, cool recesses, low
uniform bounce and small bright peaks. For ordinary weather, use the current solver. For strong sun or hero
headlights, test a hybrid that layers selective geometry-driven direct light over restrained production fill.

## Review artifacts

- `tools/lighting-reel/out/SCH-30-contrast-cyber.png` — four full-frame Cyber rows.
- `tools/lighting-reel/out/SCH-30-contrast-cyber-interior.png` — enlarged interior crops.

Regenerate them with `?contrast-comparison&date=2026-06-21`. The art-direction feature remains dormant unless
`?direction=contrast-v1` or `B.lightingDirection.setEnabled(true)` is used.
