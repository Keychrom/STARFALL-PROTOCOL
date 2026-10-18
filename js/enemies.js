'use strict';

/* ------------------------------------------------------------------
 *  Enemy drones and wave behaviors.
 * ------------------------------------------------------------------ */

class Enemy {
  constructor(def) {
    this.x = def.x;
    this.y = def.y ?? -46;
    this.hp = def.hp ?? 32;
    this.maxHp = this.hp;
    this.radius = def.radius ?? 13;
    this.color = def.color ?? 'pink';
    this.sprite = Sprites.drone(this.color);
    this.move = def.move ?? null;
    this.fire = def.fire ?? null;
    this.score = def.score ?? 1200;
    this.dropPower = def.dropPower ?? 1;
    this.dropPoint = def.dropPoint ?? 2;
    this.t = 0;
    this.rt = {};
    this.flash = 0;
    this.dead = false;
    this.killed = false;
    this.anim = rnd(TAU);
    this.prevX = this.x;
    this.deathColor = (DRONE_COLORS[this.color] || DRONE_COLORS.pink).accent;
    this.scale = def.scale ?? 1;
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 7);
    this.anim += dt * 12;
    this.prevX = this.x;
    if (this.move) this.move(this, dt, game);
    if (this.fire && !this.dead) this.fire(this, dt, game);
    if (this.y > FIELD_H + 80 || this.x < -130 || this.x > FIELD_W + 130) {
      this.dead = true;
    }
  }

  damage(amount, game) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 1;
    if (this.hp <= 0) this.kill(game);
  }

  kill(game) {
    if (this.dead) return;
    this.dead = true;
    this.killed = true;
    game.addScore(this.score);
    game.enemiesKilled++;
    game.particles.burst(this.x, this.y, this.deathColor, 12,
      { speed: 200, size: 3.4, life: 0.65, type: 'star', grav: 30 });
    game.particles.burst(this.x, this.y, '#fff2fa', 7,
      { speed: 120, size: 2.2, life: 0.45, type: 'dot' });
    game.spawnDrops(this.x, this.y, this.dropPower, this.dropPoint);
    AudioSys.play('enemyDown');
  }
}

class EnemyWaves {
  /**
   * Drones descend into a V formation, hold, fire aimed fans, then leave.
   */
  static vFormation(game, opts = {}) {
    const swarm = game.diff.enemyMult ?? 1;
    const count = Math.max(3, Math.round((opts.count ?? 5) * 1.6 * swarm));
    const color = opts.color ?? 'pink';
    const hp = (opts.hp ?? 1);
    const startX = opts.startX ?? FIELD_W / 2;
    const spacing = Math.min(opts.spacing ?? 54, (FIELD_W - 70) / Math.max(1, count - 1));
    const holdY = opts.holdY ?? 140;
    const hold = opts.hold ?? 5;
    const fireEvery = opts.fireEvery ?? 1.65;
    const fanCount = opts.fanCount ?? 3;
    const spread = opts.spread ?? 0.55;
    const speed = opts.speed ?? 130;
    const shape = opts.shape ?? 'rice';
    const size = opts.size ?? 5;
    const bulletColor = opts.bulletColor ?? color;
    const dropPower = opts.dropPower ?? 1;
    const dropPoint = opts.dropPoint ?? 1;
    const score = opts.score ?? 1100;
    const fireRatio = opts.fireRatio ?? 1;

    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2;
      const x0 = startX + offset * spacing;
      const y0 = -46 - Math.abs(offset) * 20;
      const targetY = holdY + Math.abs(offset) * 11;
      const enterDur = 1.15 + Math.abs(offset) * 0.06;
      const e = new Enemy({
        x: x0, y: y0, hp, color,
        dropPower: i % 3 === 0 ? dropPower : 0,
        dropPoint: i % 2 === 0 ? dropPoint : 0,
        score,
      });
      e.rt.t = 0;
      e.rt.ft = fireEvery - 0.05;
      e.rt.x0 = x0;
      e.rt.idx = i;
      e.rt.fireAt = 0.85 + Math.abs(offset) * 0.015;
      e.move = (en, dt) => {
        en.rt.t += dt;
        const t = en.rt.t;
        if (t < enterDur) {
          en.y = lerp(y0, targetY, easeOutCubic(t / enterDur));
          en.x = x0;
        } else if (t < enterDur + hold) {
          const ht = t - enterDur;
          en.y = targetY + Math.sin(ht * 1.5 + i * 0.9) * 9;
          en.x = x0 + Math.sin(ht * 1.1 + i * 0.7) * 17;
        } else {
          en.y += 105 * dt;
          en.x += Math.sin(t * 2 + i) * 26 * dt;
        }
      };
      if (fireRatio >= 1 || ((i * 5 + 1) % 10) < fireRatio * 10) {
        e.fire = (en, dt, g) => {
          const t = en.rt.t;
          if (t < en.rt.fireAt || t > enterDur + hold) return;
          en.rt.ft += dt;
          if (en.rt.ft >= fireEvery) {
            en.rt.ft = 0;
            Patterns.fan(g, en.x, en.y + 8, {
              count: fanCount, spread, speed, color: bulletColor, shape, size,
            });
          }
        };
      }
      game.enemies.push(e);
    }
  }

  /**
   * Drones fly across the upper field in a sweeping line.
   */
  static sideSweep(game, opts = {}) {
    const swarm = game.diff.enemyMult ?? 1;
    const count = Math.max(3, Math.round((opts.count ?? 4) * 1.6 * swarm));
    const dir = opts.dir ?? 1; // 1: left→right
    const color = opts.color ?? 'blue';
    const hp = opts.hp ?? 1;
    const y = opts.y ?? 110;
    const speed = opts.hSpeed ?? 100;
    const interval = opts.fireEvery ?? 1.0;
    const fanCount = opts.fanCount ?? 3;
    const spread = opts.spread ?? 0.3;
    const bulletSpeed = opts.bulletSpeed ?? 150;
    const shape = opts.shape ?? 'kunai';
    const size = opts.size ?? 5;
    const angle = opts.angVel ?? 0;
    const bulletColor = opts.bulletColor ?? 'cyan';
    const fireRatio = opts.fireRatio ?? 1;

    for (let i = 0; i < count; i++) {
      const startX = dir > 0 ? -40 - i * 52 : FIELD_W + 40 + i * 52;
      const sy = y + i * Math.min(24, 170 / Math.max(1, count - 1));
      const e = new Enemy({
        x: startX, y: sy, hp, color,
        dropPower: i % 3 === 0 ? (opts.dropPower ?? 1) : 0,
        dropPoint: i % 2 === 0 ? (opts.dropPoint ?? 1) : 0,
        score: opts.score ?? 1300,
      });
      e.rt.t = 0;
      e.rt.ft = 0;
      e.move = (en, dt) => {
        en.rt.t += dt;
        en.x += dir * speed * dt;
        en.y = sy + Math.sin(en.rt.t * 1.7 + i * 0.8) * 22;
      };
      if (fireRatio >= 1 || ((i * 5 + 2) % 10) < fireRatio * 10) {
        e.fire = (en, dt, g) => {
          if (en.x < 14 || en.x > FIELD_W - 14) return;
          en.rt.ft += dt;
          if (en.rt.ft >= interval) {
            en.rt.ft = 0;
            Patterns.fan(g, en.x, en.y + 6, {
              count: fanCount, spread, speed: bulletSpeed,
              color: bulletColor, shape, size, angVel: angle,
            });
          }
        };
      }
      game.enemies.push(e);
    }
  }

  /**
   * A staggered line that cuts diagonally across the field.
   */
  static diagonalStream(game, opts = {}) {
    const swarm = game.diff.enemyMult ?? 1;
    const count = Math.max(3, Math.round((opts.count ?? 6) * 1.35 * swarm));
    const dir = opts.dir ?? 1;
    const color = opts.color ?? 'green';
    const hp = opts.hp ?? 1;
    const startY = opts.y ?? 30;
    const speedX = opts.speedX ?? 150;
    const speedY = opts.speedY ?? 32;
    const fireEvery = opts.fireEvery ?? 1.5;
    const fanCount = opts.fanCount ?? 2;
    const spread = opts.spread ?? 0.25;
    const bulletSpeed = opts.bulletSpeed ?? 145;
    const shape = opts.shape ?? 'rice';
    const size = opts.size ?? 5;
    const bulletColor = opts.bulletColor ?? 'cyan';
    const score = opts.score ?? 1300;
    const dropPower = opts.dropPower ?? 1;
    const dropPoint = opts.dropPoint ?? 1;
    const fireRatio = opts.fireRatio ?? 1;

    for (let i = 0; i < count; i++) {
      const startX = dir > 0 ? -40 - i * 52 : FIELD_W + 40 + i * 52;
      const sy = startY + i * 10;
      const e = new Enemy({
        x: startX, y: sy, hp, color,
        dropPower: i % 3 === 0 ? dropPower : 0,
        dropPoint: i % 2 === 0 ? dropPoint : 0,
        score,
      });
      e.rt.t = 0;
      e.rt.ft = 0.24 + rnd(0, 0.26);
      e.move = (en, dt) => {
        en.rt.t += dt;
        en.x += dir * speedX * dt;
        en.y = sy + speedY * en.rt.t + Math.sin(en.rt.t * 2.2 + i * 0.9) * 10;
      };
      if (fireRatio >= 1 || ((i * 5 + 3) % 10) < fireRatio * 10) {
        e.fire = (en, dt, g) => {
          if (en.x < 20 || en.x > FIELD_W - 20) return;
          en.rt.ft += dt;
          if (en.rt.ft >= fireEvery) {
            en.rt.ft = 0;
            Patterns.fan(g, en.x, en.y + 6, {
              count: fanCount, spread, speed: bulletSpeed,
              color: bulletColor, shape, size,
            });
          }
        };
      }
      game.enemies.push(e);
    }
  }

  /**
   * A multi-row wall of light drones: one-hit each, but enough bodies to hold
   * the upper field while the player is firing.
   */
  static swarmWall(game, opts = {}) {
    const swarm = game.diff.enemyMult ?? 1;
    const rows = opts.rows ?? 2;
    const perRow = Math.max(3, Math.round((opts.count ?? 5) * 1.15 * swarm));
    const color = opts.color ?? 'blue';
    const hp = opts.hp ?? 1;
    const spacing = Math.min(opts.spacing ?? 52, (FIELD_W - 120) / Math.max(1, perRow - 1));
    const holdY = opts.holdY ?? 110;
    const rowGap = opts.rowGap ?? 74;
    const hold = opts.hold ?? 3.4;
    const fireEvery = opts.fireEvery ?? 2.7;
    const fanCount = opts.fanCount ?? 3;
    const spread = opts.spread ?? 0.3;
    const speed = opts.speed ?? 130;
    const shape = opts.shape ?? 'rice';
    const size = opts.size ?? 5;
    const bulletColor = opts.bulletColor ?? 'cyan';
    const dropPower = opts.dropPower ?? 0;
    const dropPoint = opts.dropPoint ?? 0;
    const score = opts.score ?? 1050;
    const fireRatio = opts.fireRatio ?? 1;

    for (let r = 0; r < rows; r++) {
      const rowShift = r % 2 === 0 ? -spacing * 0.26 : spacing * 0.26;
      for (let i = 0; i < perRow; i++) {
        const offset = i - (perRow - 1) / 2;
        const x0 = clamp(FIELD_W / 2 + offset * spacing + rowShift, 46, FIELD_W - 46);
        const y0 = -54 - r * 74 - Math.abs(offset) * 14;
        const targetY = holdY + r * rowGap + Math.abs(offset) * 7;
        const enterDur = 1.05 + r * 0.18 + Math.abs(offset) * 0.05;
        const idx = r * perRow + i;
        const e = new Enemy({
          x: x0, y: y0, hp, color,
          dropPower: opts.dropPower === undefined ? 0 : (i % 3 === 0 ? dropPower : 0),
          dropPoint: opts.dropPoint === undefined ? 0 : (i % 2 === 0 ? dropPoint : 0),
          score,
        });
        e.rt.t = 0;
        e.rt.ft = fireEvery - 0.05;
        e.rt.idx = idx;
        e.rt.x0 = x0;
        e.rt.fireAt = 0.8 + (idx % perRow) * 0.05 + r * 0.07;
        const shooter = fireRatio >= 1 || ((idx * 7 + r * 3) % 10) < fireRatio * 10;
        e.move = (en, dt) => {
          en.rt.t += dt;
          const t = en.rt.t;
          if (t < enterDur) {
            en.y = lerp(y0, targetY, easeOutCubic(t / enterDur));
            en.x = x0;
          } else if (t < enterDur + hold) {
            const ht = t - enterDur;
            en.y = targetY + Math.sin(ht * 1.35 + idx * 0.8) * 7;
            en.x = x0 + Math.sin(ht * 1.1 + idx * 0.6) * 12;
          } else {
            en.y += 100 * dt;
            en.x += Math.sin(t * 2 + idx) * 24 * dt;
          }
        };
        if (shooter) {
          e.fire = (en, dt, g) => {
            const t = en.rt.t;
            if (t < en.rt.fireAt || t > enterDur + hold) return;
            en.rt.ft += dt;
            if (en.rt.ft >= fireEvery) {
              en.rt.ft = 0;
              Patterns.fan(g, en.x, en.y + 8, {
                count: fanCount, spread, speed, color: bulletColor, shape, size,
              });
            }
          };
        }
        game.enemies.push(e);
      }
    }
  }

  /**
   * Hovering ring-casters.
   */
  static ringDancer(game, opts = {}) {
    const swarm = game.diff.enemyMult ?? 1;
    const count = Math.max(2, Math.round((opts.count ?? 3) * 1.6 * swarm));
    const color = opts.color ?? 'purple';
    const hp = opts.hp ?? 1;
    const hold = opts.hold ?? 6;
    const startX = opts.startX ?? FIELD_W / 2;
    const spacing = Math.min(opts.spacing ?? 150, (FIELD_W - 120) / Math.max(1, count - 1));
    const hoverY = opts.hoverY ?? 130;
    const ringCount = opts.ringCount ?? 11;
    const ringEvery = opts.ringEvery ?? 1.8;
    const speed = opts.speed ?? 95;
    const shape = opts.shape ?? 'orb';
    const size = opts.size ?? 5;
    const bulletColor = opts.bulletColor ?? 'red';

    for (let i = 0; i < count; i++) {
      const x0 = startX + (i - (count - 1) / 2) * spacing;
      const e = new Enemy({
        x: x0, y: -50 - i * 30, hp, color,
        dropPower: i % 2 === 0 ? (opts.dropPower ?? 1) : 0,
        dropPoint: opts.dropPoint ?? 1,
        score: opts.score ?? 1600,
      });
      e.rt.t = 0;
      e.rt.ringT = 0.2;
      e.rt.rot = rnd(TAU);
      e.move = (en, dt) => {
        en.rt.t += dt;
        const t = en.rt.t;
        if (t < 1.2) {
          en.y = lerp(-50 - i * 30, hoverY, easeOutCubic(t / 1.2));
        } else if (t < 1.2 + hold) {
          en.y = hoverY + Math.sin((t - 1.2) * 1.4 + i) * 10;
          en.x = x0 + Math.sin((t - 1.2) * 0.9 + i * 1.7) * 22;
        } else {
          en.y += 95 * dt;
        }
      };
      e.fire = (en, dt, g) => {
        const t = en.rt.t;
        if (t < 1.05 || t > 1.2 + hold) return;
        en.rt.ringT -= dt;
        if (en.rt.ringT <= 0) {
          en.rt.ringT = ringEvery;
          en.rt.rot += 0.23;
          Patterns.ring(g, en.x, en.y + 8, {
            count: ringCount, speed, angle: en.rt.rot,
            color: bulletColor, shape, size,
          });
        }
      };
      game.enemies.push(e);
    }
  }

  /**
   * Fixed spiral turrets with heavier HP and power drops.
   */
  static emitter(game, opts = {}) {
    const x = opts.x ?? FIELD_W / 2;
    const y = opts.y ?? 130;
    const color = opts.color ?? 'red';
    const hp = opts.hp ?? 6;
    const hold = opts.hold ?? 8;
    const dir = opts.dir ?? 1;
    const interval = opts.interval ?? 0.16;
    const arms = opts.arms ?? 2;
    const speed = opts.speed ?? 105;
    const shape = opts.shape ?? 'orb';
    const size = opts.size ?? 5.5;
    const colorA = opts.colorA ?? 'pink';
    const colorB = opts.colorB ?? 'purple';
    const entryY = y - 40;

    const e = new Enemy({
      x, y: entryY, hp, color, radius: 16,
      dropPower: opts.dropPower ?? 3, dropPoint: opts.dropPoint ?? 5,
      score: opts.score ?? 6000, scale: 1.15,
    });
    e.rt.t = 0;
    e.rt.ft = 0;
    e.rt.spin = rnd(TAU);
    e.move = (en, dt) => {
      en.rt.t += dt;
      const t = en.rt.t;
      if (t < 1.0) {
        en.y = lerp(entryY, y, easeOutCubic(t));
      } else if (t < 1.0 + hold) {
        en.y = y + Math.sin((t - 1) * 1.3) * 7;
      } else {
        en.y += 90 * dt;
      }
    };
    e.fire = (en, dt, g) => {
      const t = en.rt.t;
      if (t < 1.1 || t > 1.0 + hold) return;
      en.rt.ft += dt;
      if (en.rt.ft >= interval) {
        en.rt.ft = 0;
        en.rt.spin += dir * 0.20;
        Patterns.spiralBurst(g, en.x, en.y, {
          arms, angle: en.rt.spin, speed, shape, size,
          color: [colorA, colorB],
        });
      }
    };
    game.enemies.push(e);
    return e;
  }

  /**
   * A quick aimed-shot drone pair (useful as a light accent wave).
   */
  static snipers(game, opts = {}) {
    const positions = opts.positions ?? [{ x: 130, y: 100 }, { x: 446, y: 100 }];
    const color = opts.color ?? 'green';
    const hp = opts.hp ?? 1;
    const life = opts.life ?? 5;
    const interval = opts.interval ?? 1.4;
    const speed = opts.speed ?? 240;
    const shape = opts.shape ?? 'kunai';
    const size = opts.size ?? 4.6;
    const bulletColor = opts.bulletColor ?? 'green';
    for (const pos of positions) {
      const e = new Enemy({
        x: pos.x, y: -40, hp, color,
        dropPower: opts.dropPower ?? 1, dropPoint: opts.dropPoint ?? 2,
        score: opts.score ?? 2200,
      });
      e.rt.t = 0;
      e.rt.ft = 0.15;
      e.rt.life = life;
      e.move = (en, dt) => {
        en.rt.t += dt;
        const t = en.rt.t;
        if (t < 1.0) en.y = lerp(-40, pos.y, easeOutCubic(t));
        else if (t < 1.0 + en.rt.life) en.y = pos.y + Math.sin((t - 1) * 1.4) * 8;
        else en.y += 110 * dt;
      };
      e.fire = (en, dt, g) => {
        const t = en.rt.t;
        if (t < 0.95 || t > 1.0 + en.rt.life) return;
        en.rt.ft -= dt;
        if (en.rt.ft <= 0) {
          en.rt.ft = interval;
          Patterns.fan(g, en.x, en.y, {
            count: 2, spread: 0.12, speed, color: bulletColor, shape, size,
            offset: Math.sin(t * 2) * 0.25,
          });
        }
      };
      game.enemies.push(e);
    }
  }
}
