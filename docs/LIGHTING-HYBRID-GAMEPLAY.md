# Playable Cyber hybrid lighting (SCH-30)

The recommended lighting package is available as a runtime experiment without changing the game's default look.
Start the game with:

```text
?lighting=hybrid-v1
```

Or click **Current light** in the HUD during play. The button reads **Hybrid light** while the package is active;
click it again to return to the exact lighting state that was active before the test.

## What the switch changes

- Keeps the current hand-authored projection as cinematic fill so faces, shelves and composition remain readable.
- Makes the outdoor weather light cooler and the shop practicals warmer and more local, especially on overcast days.
- On clear mornings, treats the sunlit terrace opposite as a warm directional reflector: it lifts the shaded facade
  and projects a gently sloping window/fascia cutoff across the shop. Cloud, rain and fog suppress the effect.
- Strengthens the sun-facing side of the facade and the authored interior sun blade later in the day.
- Adds receiver-aware direct light for sun and vehicle beams, including occlusion by glazing bars, people and props.
- Solves only the direct-light overlay on a 4×4 grid. The Cyber artwork and final canvas remain 320×180. The
  restrained full-resolution authored fill underneath hides the coarse grid while the overlay supplies depth breaks.
- Updates that direct-light overlay at 30 fps while the authored projection and gameplay continue at display rate.
- Boosts headlight definition slightly on wet nights, attenuates it in fog, and ignores broad ambient sources that the
  production compositor already handles well.
- Uses a restrained maximum 25% exposure dip for strong headlights, with fast adaptation into the light and slower
  recovery after it passes.

Time, weather, traffic, shop lamps and all gameplay remain live while the mode is enabled. Classic is intentionally
not part of the experiment.

## Deterministic review

With the dev server on port 8123 and `python3 tools/lighting-reel/sink.py` running, open:

```text
http://localhost:8123/?hybrid-comparison&date=2026-06-21
```

The harness produces full-frame and enlarged-interior current-versus-hybrid sheets in `tools/lighting-reel/out/`.
