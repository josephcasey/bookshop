/* SCH-30: optional art-direction layer shared by the production and receiver-buffer lighting paths.
 *
 * The aim is local contrast rather than a whole-frame contrast filter: cooler weather light lowers the unlit room
 * and exterior ambience, while the existing point lamps reveal the interior's stored albedo through smaller, warmer
 * pools with much less uniform bounce. The lamp geometry and its prop/person shadows remain the source of the look.
 *
 * Enable with ?direction=contrast-v1 or B.lightingDirection.setEnabled(true).
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
      const cyber = B.theme === 'cyber';
      return {
        // About 2800 K in the classic scene. Cyber keeps a little amber so its room separates from cyan/magenta outside.
        pendantCol: cyber ? '#efb96c' : '#ffad50',
        deskCol: cyber ? '#ffc77a' : '#ffc064',
        pendantIntensity: cyber ? 0.98 + overcast * 0.14 + dusk * 0.1 : 1.1 + overcast * 0.3 + dusk * 0.18,
        deskIntensity: cyber ? 0.88 + overcast * 0.12 + dusk * 0.08 : 0.98 + overcast * 0.24 + dusk * 0.14,
        // The production lamp had 0.28-0.40 of flat room fill. This quieter bounce leaves the point-source shadows legible.
        bounce: cyber ? 0.04 : 0.035,
        bounceEach: cyber ? 0.015 : 0.02,
        revealStrength: 1,
        glare: cyber ? 0.08 : 0.3,
        interiorTint: cyber ? '#7783ad' : '#718ea5',
        interiorShade: clamp(0.08 + overcast * 0.23 + dusk * 0.1, 0.08, 0.38),
        exteriorTint: cyber ? '#909fc9' : '#8eb9d8',
        exteriorShade: clamp((cyber ? 0.03 : 0.05) + overcast * (cyber ? 0.075 : 0.16) + dusk * 0.05, 0.03, 0.26),
        exteriorCool: cyber ? '#7382b7' : '#709fc4',
        exteriorCoolLift: clamp(overcast * (cyber ? 0.018 : 0.055) + dusk * (cyber ? 0.012 : 0.025), 0, 0.07),
        // Shop light reduces outside sources, but does not erase the cool/warm dialogue at the glass.
        externalTransmission: overcast > 0.45 ? 0.42 : 0.36,
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
})(window.Bookshop);
