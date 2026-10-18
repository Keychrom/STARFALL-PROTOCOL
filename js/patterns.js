'use strict';

/* ------------------------------------------------------------------
 *  Bullet pattern helpers — difficulty-aware emitters.
 * ------------------------------------------------------------------ */

const Patterns = {
  countScale(g, n) {
    return Math.max(2, Math.round(n * g.diff.mult));
  },

  _bullet(g, x, y, angle, o, i = 0) {
    const color = Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color ?? 'red');
    return g.enemyBullets.spawn({
      x, y,
      angle,
      speed: (o.speed ?? 120) * g.diff.speed,
      accel: (o.accel ?? 0) * g.diff.speed,
      angVel: o.angVel ?? 0,
      color,
      shape: o.shape ?? 'orb',
      size: o.size ?? 5.5,
      hitR: o.hitR,
      spin: o.spin,
    });
  },

  /** Evenly spaced ring of bullets. */
  ring(g, x, y, o = {}) {
    const count = this.countScale(g, o.count ?? 12);
    const offset = (o.angle ?? 0) + (o.spinOffset ?? 0);
    for (let i = 0; i < count; i++) {
      this._bullet(g, x, y, offset + (i / count) * TAU, o, i);
    }
  },

  /** Ring of bullets with a deliberate safe gap. */
  gapRing(g, x, y, o = {}) {
    const count = this.countScale(g, o.count ?? 18);
    const gap = o.gap ?? 1.1;
    const offset = o.angle ?? 0;
    const span = TAU - gap;
    const n = Math.max(2, count);
    for (let i = 0; i < n; i++) {
      const a = offset + gap / 2 + (i / (n - 1)) * span;
      this._bullet(g, x, y, a, o, i);
    }
  },

  /** Fan aimed at the player. */
  fan(g, x, y, o = {}) {
    const base = angleTo(x, y, g.player.x, g.player.y) + (o.offset ?? 0);
    const count = Math.max(1, this.countScale(g, o.count ?? 3));
    const spread = o.spread ?? 0.5;
    for (let i = 0; i < count; i++) {
      const a = base + (count === 1 ? 0 : -spread / 2 + (i / (count - 1)) * spread);
      this._bullet(g, x, y, a, o, i);
    }
  },

  /** A single aimed shot (respects difficulty speed). */
  aimed(g, x, y, o = {}) {
    const a = angleTo(x, y, g.player.x, g.player.y) + (o.offset ?? 0);
    this._bullet(g, x, y, a, o, 0);
  },

  /** n rotational arms, fired once. `angle` is the current base rotation. */
  spiralBurst(g, x, y, o = {}) {
    const arms = Math.max(1, Math.round((o.arms ?? 3) * g.diff.mult));
    const offset = o.angle ?? 0;
    for (let i = 0; i < arms; i++) {
      this._bullet(g, x, y, offset + (i / arms) * TAU, o, i);
    }
  },

  /** Rain of curving petals from the top edge. */
  rain(g, o = {}) {
    const count = Math.max(1, Math.round((o.count ?? 2) * g.diff.mult));
    for (let i = 0; i < count; i++) {
      const x = o.x ?? rnd(24, FIELD_W - 24);
      this._bullet(g, x, o.y ?? -12, (o.angle ?? HALF_PI) + rnd(-(o.spread ?? 0.3), o.spread ?? 0.3), {
        speed: o.speed ?? rnd(75, 115),
        accel: o.accel ?? 0,
        angVel: o.angVel ?? rnd(-0.55, 0.55),
        color: o.color ?? 'pink',
        shape: o.shape ?? 'rice',
        size: o.size ?? 5,
        hitR: o.hitR,
      }, i);
    }
  },

  /** Scatter from one point (uses a fan shape, random angles). */
  scatter(g, x, y, o = {}) {
    const count = Math.max(1, Math.round((o.count ?? 6) * g.diff.mult));
    const base = o.angle ?? HALF_PI;
    const spread = o.spread ?? Math.PI;
    for (let i = 0; i < count; i++) {
      this._bullet(g, x, y, base + rnd(-spread / 2, spread / 2), o, i);
    }
  },
};
