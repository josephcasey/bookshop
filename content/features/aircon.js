/* 2026-10-07 (the air-con unit)
 * 2026-10-08: the classic street has one too now (a cream box on the brickwork, same spot). The fan always shows its
 * three blades (SCH-26): however fast it really spins, they're drawn turning at a pace the eye can follow (the way a
 * camera catches a fan), never smeared into a disc.
 * The neon theme's air-con box between the flat's windows comes alive: the fan spins (fast on hot afternoons,
 * idling at night), the louvres shiver, condensate drips from the tray into the rust stain and splashes on the
 * sill below, a heat shimmer rises off the exhaust by day and a breath of vapour puffs out on cold nights. */
(function (B) {
  const CX = 115; // the fan's hub (the unit spans x 108..131, y 25..38)
  const CY = 32;
  let phase = 0;
  let last = 0;
  let drip = null;
  const puffs = [];
  const cyber = () => B.theme === 'cyber';

  B.audio.define('ac-drip', ({ tone, street }) => tone(1900, 0.03, { type: 'sine', vol: 0.006, slide: 900, bus: street }));

  B.decor({
    id: 'aircon',
    layer: 'facade',
    draw(g, s) {
      const cy = cyber();
      const K = cy
        ? { blade: '#5d6577', gap: '#1c1f26', hub: '#6d7587', lv: '#353a46', lvS: '#3e4451' }
        : { blade: '#b8b0a0', gap: '#4a4640', hub: '#d8d0c0', lv: '#a8a090', lvS: '#bab2a2' };
      if (!cy) {
        // the classic street's unit (the neon one is part of its facade): a cream box with a round grille and louvres,
        // on a pair of brackets, a rust streak under its drip tray
        B.px(g, '#3a2a22', 109, 39, 1, 3);
        B.px(g, '#3a2a22', 130, 39, 1, 3);
        B.px(g, '#8a5a3a', 119, 40, 1, 8); // the stain on the bricks
        B.px(g, '#d4ccbb', 108, 25, 24, 14);
        B.px(g, '#e8e2d4', 108, 25, 24, 1);
        B.px(g, '#9a9282', 108, 38, 24, 1);
        B.px(g, '#b8b0a0', 131, 26, 1, 12);
        for (let y = -5; y <= 5; y++)
          for (let x = -5; x <= 5; x++) {
            const r = x * x + y * y;
            if (r <= 25 && r > 16) B.px(g, '#8a8476', CX + x, CY + y);
            else if (r <= 16) B.px(g, '#4a4640', CX + x, CY + y);
          }
      }
      const now = performance.now() / 1000;
      const dt = last ? Math.max(0, Math.min(0.1, now - last)) : 0;
      last = now;
      const P = B.sunPos ? B.sunPos(s.hour) : { e: 20 };
      const hot = Math.max(0, Math.min(1, (P.e + 5) / 35)); // works hardest in the afternoon sun
      const rps = 0.25 + 0.9 * hot; // revolutions per second, as seen: lazy at night, brisk in the afternoon sun
      phase = (phase + rps * dt) % 1;
      // the fan: three blades seen through the grille
      for (let y = -4; y <= 4; y++)
        for (let x = -4; x <= 4; x++) {
          const r2 = x * x + y * y;
          if (r2 > 16 || r2 < 2) continue;
          let a = Math.atan2(y, x) / (Math.PI * 2) - phase;
          a = ((a * 3) % 1 + 1) % 1; // three blades
          const onBlade = a < 0.33;
          B.px(g, onBlade ? K.blade : K.gap, CX + x, CY + y);
        }
      B.px(g, K.hub, CX, CY); // the hub
      // louvres on the exhaust side shiver in the airflow
      const shiver = Math.sin(now * (6 + 20 * hot)) > 0.3 ? 1 : 0;
      for (let y = 28; y < 37; y += 2) B.px(g, shiver ? K.lvS : K.lv, 123, y, 7, 1);
      // a little status LED
      if (cy) B.px(g, Math.floor(now * 1.3) % 2 ? '#3ff5ff' : '#1a6a70', 129, 26);
      else B.px(g, Math.floor(now * 1.3) % 2 ? '#7ad070' : '#3a6a38', 129, 26);
      // condensate: a drop gathers under the tray, falls, splashes on the sill below
      if (!drip && Math.random() < dt * (0.25 + 0.6 * hot)) drip = { y: 39, v: 0, grow: 0 };
      if (drip) {
        if (drip.grow < 1) {
          drip.grow += dt * 0.8;
          B.px(g, '#7fa8c0', 119, 39, 1, 1);
        } else {
          drip.v += 180 * dt;
          drip.y += drip.v * dt;
          if (drip.y >= 51) {
            for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [2, 0]]) B.px(g, 'rgba(160,200,230,0.7)', 119 + dx, 51 + dy);
            if (Math.random() < 0.3 && B.audio.play) B.audio.play('ac-drip');
            drip = null;
          } else B.px(g, '#9fc8e0', 119, Math.round(drip.y), 1, 2);
        }
      }
      // exhaust: shimmer when it's warm, a puff of vapour on cold nights
      const cold = P.e < 0 && (s.weather.cloud > 0.5 || (s.weather.rain || 0) > 0.2 || s.hour < 7 || s.hour > 21);
      if (Math.random() < dt * (cold ? 1.2 : 0.6 * hot)) puffs.push({ x: 131, y: 30 + Math.random() * 6, t: 0, cold });
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.t += dt;
        p.x += dt * (cold ? 10 : 4);
        p.y -= dt * (cold ? 6 : 10);
        if (p.t > 1.6) {
          puffs.splice(i, 1);
          continue;
        }
        const a = (1 - p.t / 1.6) * (p.cold ? 0.35 : 0.12);
        g.fillStyle = p.cold ? `rgba(200,210,225,${a})` : `rgba(255,220,180,${a})`;
        const r = p.cold ? 1 + Math.round(p.t * 2) : 1;
        g.fillRect(Math.round(p.x + (p.cold ? 0 : Math.sin(p.t * 12) * 1.5)), Math.round(p.y), r, r);
      }
    },
  });
})(window.Bookshop);
