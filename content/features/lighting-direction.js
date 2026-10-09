/* SCH-30: optional Cyber art-direction layer shared by all lighting-solver prototypes.
 *
 * The aim is local contrast rather than a whole-frame contrast filter: cooler weather light lowers the unlit room
 * and exterior ambience, while the existing point lamps reveal the interior's stored albedo through smaller, warmer
 * pools with much less uniform bounce. The lamp geometry and its prop/person shadows remain the source of the look.
 *
 * Enable with ?direction=contrast-v1 or B.lightingDirection.setEnabled(true). The playable hybrid-v1 mode enables
 * it automatically and restores the previous state when switched off.
 */
(function (B) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1).toFixed(3)})`;
  };

  const mode = (B.lightingDirection = {
    enabled: false,
    setEnabled(on) {
      this.enabled = !!on;
    },
    values(s) {
      const weather = s.weather || {};
      const day = B.daylight(s.hour);
      const overcast = clamp(Math.max(weather.rain || 0, ((weather.cloud || 0) - 0.45) / 0.55), 0, 1);
      const dusk = clamp((0.72 - day) / 0.72, 0, 1);
      return {
        // Amber practicals separate the room from the Cyber street's cyan and magenta without fighting the neon sign.
        pendantCol: '#efb96c',
        deskCol: '#ffc77a',
        pendantIntensity: 1.18 + overcast * 0.24 + dusk * 0.12,
        deskIntensity: 1.05 + overcast * 0.2 + dusk * 0.1,
        // The production lamp had 0.28-0.40 of flat room fill. This quieter bounce leaves the point-source shadows legible.
        bounce: 0.04,
        bounceEach: 0.015,
        revealStrength: 1,
        glare: 0.16,
        interiorTint: '#7783ad',
        interiorShade: clamp(0.08 + overcast * 0.23 + dusk * 0.1, 0.08, 0.38),
        exteriorTint: '#909fc9',
        exteriorShade: clamp(0.03 + overcast * 0.075 + dusk * 0.05, 0.03, 0.26),
        exteriorCool: '#7382b7',
        exteriorCoolLift: clamp(overcast * 0.018 + dusk * 0.012, 0, 0.07),
        // Shop light reduces outside sources, but does not erase the cool/warm dialogue at the glass.
        externalTransmission:
          B.hybridLighting && B.hybridLighting.enabled
            ? overcast > 0.45
              ? 0.36
              : 0.3
            : overcast > 0.45
              ? 0.42
              : 0.36,
      };
    },
    beforeLamps(g, s) {
      const p = this.values(s);
      const w = B.LAYOUT.win;
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = rgba(p.interiorTint, p.interiorShade);
      g.fillRect(w.x, w.y, w.w, w.h);
      g.restore();
    },
  });

  B.decor({
    id: 'lighting-direction-exterior',
    layer: 'overlay',
    when: () => mode.enabled,
    draw(g, s) {
      const p = mode.values(s);
      const w = B.LAYOUT.win;
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = p.exteriorShade;
      g.fillStyle = p.exteriorTint;
      g.beginPath();
      g.rect(0, 0, B.W, B.H);
      g.rect(w.x, w.y, w.w, w.h);
      if (s.shop.lights) {
        const d = (s.door.open || 0) > 0.02 ? B.LAYOUT.doorOpening : B.LAYOUT.doorGlass;
        g.rect(d.x, d.y, d.w, d.h);
      }
      if (B.upstairsLit(s)) for (const u of B.LAYOUT.upstairs) g.rect(u.x, u.y, u.w, u.h);
      g.fill('evenodd');
      // A small diffuse sky term shifts overcast highlights blue without changing the frame's global contrast.
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = p.exteriorCoolLift;
      g.fillStyle = p.exteriorCool;
      g.fill('evenodd');
      g.restore();
    },
  });

  mode.setEnabled(B.params && B.params.get('direction') === 'contrast-v1');

  const hybrid = (B.hybridLighting = {
    enabled: false,
    saved: null,
    setEnabled(on) {
      on = !!on;
      if (on === this.enabled) return;
      if (on) {
        this.saved = {
          direction: mode.enabled,
          relight: B.relightV2 ? B.relightV2.variant : 'off',
          exposure: B.lightFlags.exposure,
        };
        if (B.relightV2 && B.relightV2.setMode) B.relightV2.setMode('hybrid');
        mode.setEnabled(true);
        B.lightFlags.exposure = true;
      } else {
        if (B.relightV2 && B.relightV2.variant === 'hybrid') B.relightV2.setMode(this.saved ? this.saved.relight : 'off');
        mode.setEnabled(this.saved ? this.saved.direction : false);
        if (this.saved) B.lightFlags.exposure = this.saved.exposure;
        this.saved = null;
      }
      this.enabled = on;
      if (B.world) B.emit('lighting-mode', B.world, on ? 'hybrid-v1' : 'current');
    },
  });

  hybrid.setEnabled(B.params && B.params.get('lighting') === 'hybrid-v1');
})(window.Bookshop);
