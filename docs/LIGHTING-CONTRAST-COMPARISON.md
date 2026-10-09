# Lighting contrast and colour-temperature comparison (SCH-30)

## Question

Can the scenes feel more exciting—especially on overcast days—by separating cool exterior ambience from warm shop
practicals, increasing local lighting contrast and making the existing shadows easier to read? And how much of that
needs the receiver-buffer prototype rather than better art direction in the current renderer?

The comparison uses identical seeded scenes in three columns:

1. Current production lighting.
2. Art-directed practicals with the current window-light solver.
3. The same art direction with the receiver-buffer window-light solver.

“Warm” and “cool” describe relationships inside the authored pixel palette, not literal display Kelvin values.

## Result

Most of the overcast and rainy-day improvement comes from art direction, not a replacement solver. The useful base
look is:

- cooler weather ambience outside and in the room's unlit recesses;
- warmer, brighter peaks from the two pendants and desk lamp;
- far less uniform bounced fill, so the lamps' existing point-source shadows remain visible;
- retained glass reflection, exterior atmosphere and shadow detail rather than a global contrast filter.

The receiver buffer becomes useful only when a directional source enters the window. Direct sun and headlights gain
more coherent depth breaks across shelves, people and the counter, although the result is harder and more segmented
than the current cinematic projection.

| Classic scene | Art change from current | Highlight-to-shadow span (current → art) | Extra receiver change | Conclusion |
|---|---:|---:|---:|---|
| Overcast midday | 19.69% | 128.04 → 136.22 | 0.00% | Colour and lamp balance do the work; a new solver adds nothing. |
| Rainy afternoon | 25.48% | 148.55 → 148.09 | 0.00% | Contrast is retained while warm/cool separation rises; use the current solver. |
| Clear afternoon | 21.33% | 147.23 → 152.25 | 19.56% | Art direction helps; the receiver adds genuine sun/depth structure. |
| Blue hour + main beam | 39.74% | 132.24 → 136.45 | 24.26% | Art direction establishes the mood; the receiver changes occlusion and depth. |

The span is the 99th-percentile highlight minus the 10th-percentile shadow in the interior crop. It checks that the
proposal is creating brighter local peaks and darker readable recesses, rather than simply lowering the whole room.

On overcast midday, the measured warm/cool separation increases from 18.24 to 26.16 palette levels. On rainy
afternoon it increases from 18.03 to 26.58. The receiver changes no material pixels in either case, which is strong
evidence that those scenes should not pay for a more complex solver.

## Scene-by-scene reading

### Overcast midday

The current room has a pleasant but broad yellow fill. The proposal keeps three distinct warm practical pools while
cooling the exterior and recesses. The passage and gaps between shelves become rests for the eye; the fiction display,
Mabel and the counter become the visual route through the scene. Existing prop and person shadows become clearer
because flat bounce drops from roughly 0.28–0.40 to 0.035–0.075.

### Rainy afternoon

Blue-grey exterior atmosphere and wet reflections now sit against warm shelves and counter light. The overall value
range is deliberately preserved rather than exaggerated, avoiding crushed coats or unreadable book spines. The main
gain is colour separation and focal hierarchy. Again, the receiver buffer is visually redundant here.

### Clear afternoon

The practical treatment is restrained to the counter side so the sun remains the key. With the current solver the
room is already improved, but the receiver buffer adds the most convincing geometric difference: sunlight breaks at
the shelving, people and counter depths instead of reading as one broad projected patch.

### Blue hour and main beam

Warm lamp peaks hold against the cool street and neon at the alley. The art pass lowers non-focal recesses without
changing the brightest peak, increasing the measured span. The receiver buffer then reorganises the headlight by
depth. It is more physically coherent, but its harder segmentation needs softening before it could replace the
production beam everywhere.

## Recommendation

Adopt the art-direction controls as the next production-facing experiment on the current renderer. They deliver the
requested overcast/rain improvement with low conceptual risk and no new visibility system.

Treat the receiver buffer as an optional directional-light component for direct sun and hero headlight moments—not
as the ambient/daylight replacement. A likely production route is hybrid: current practical lamps and soft cinematic
projection for ordinary scenes, with cached or low-resolution receiver visibility used only for strong window sources.

Cyber remains legible and the neon hierarchy survives. The cyber checks suggest a lighter touch than classic: the
theme already supplies strong colour separation, so the art layer should remain subordinate to the sign and alley.

## Review artifacts

- `tools/lighting-reel/out/SCH-30-contrast-classic.png` — four full-frame classic rows.
- `tools/lighting-reel/out/SCH-30-contrast-interior.png` — enlarged classic interior crops.
- `tools/lighting-reel/out/SCH-30-contrast-cyber.png` — overcast and blue-hour cyber checks.

Regenerate them with the documented `?contrast-comparison&date=2026-06-21` capture. The feature remains dormant
unless `?direction=contrast-v1` or `B.lightingDirection.setEnabled(true)` is used.
