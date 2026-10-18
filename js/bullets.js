'use strict';

/* ------------------------------------------------------------------
 *  Enemy bullet pool, player shots, dropped items, particles.
 * ------------------------------------------------------------------ */

class BulletSystem {
  constructor(capacity = 5200) {
    this.pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.pool[i] = { active: false };
    this.cursor = 0;
    this.capacity = capacity;
  }

  spawn(o) {
    const n = this.pool.length;
    let slot = null;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      if (!this.pool[idx].active) { slot = this.pool[idx]; this.cursor = (idx + 1) % n; break; }
    }
    if (!slot) return null;
    const b = slot;
    b.active = true;
    b.x = o.x;
    b.y = o.y;
    b.angle = o.angle ?? HALF_PI;
    b.speed = o.speed ?? 120;
    b.accel = o.accel ?? 0;
    b.angVel = o.angVel ?? 0;
    b.color = o.color ?? 'red';
    b.shape = o.shape ?? 'orb';
    b.size = o.size ?? 5.5;
    b.hitR = o.hitR ?? Math.max(2.4, b.size * 0.62);
    b.nearMissed = false;
    b.age = 0;
    b.alpha = 1;
    b.spin = o.spin ?? rnd(-1, 1);
    return b;
  }

  update(dt) {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (!b.active) continue;
      b.age += dt;
      b.speed += b.accel * dt;
      b.angle += b.angVel * dt;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      if (b.x < -50 || b.x > FIELD_W + 50 || b.y < -70 || b.y > FIELD_H + 60) {
        b.active = false;
      }
    }
  }

  draw(ctx) {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (!b.active) continue;
      const spr = Sprites.bullet(b.color, b.shape);
      const d = b.size * 4;
      const a = Math.min(1, b.age * 16) * b.alpha;
      const rotate = (b.shape === 'rice' || b.shape === 'kunai')
        ? b.angle + HALF_PI
        : b.shape === 'star' ? b.spin + b.age * 1.5 : 0;
      if (rotate) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(b.x, b.y);
        ctx.rotate(rotate);
        ctx.drawImage(spr.img, -d / 2, -d / 2, d, d);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.drawImage(spr.img, b.x - d / 2, b.y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Circle-vs-bullet collision + near-miss detection.
   * Returns the bullet that hit the player, or null.
   */
  collidePlayer(px, py, hitR, nearMissR, onNearMiss) {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (!b.active) continue;
      const dx = b.x - px;
      const dy = b.y - py;
      const rr = b.hitR + hitR;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) return b;
      if (!b.nearMissed) {
        const nr = nearMissR + b.hitR;
        if (d2 < nr * nr) {
          b.nearMissed = true;
          if (onNearMiss) onNearMiss(b);
        }
      }
    }
    return null;
  }

  clearAll(onEach) {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (!b.active) continue;
      if (onEach) onEach(b);
      b.active = false;
    }
  }

  count() {
    let n = 0;
    for (const b of this.pool) if (b.active) n++;
    return n;
  }
}

/* ------------------------------------------------------------------ */

class PlayerShot {
  constructor(x, y, angle, type, damage, speed = 1080) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.type = type;
    this.damage = damage;
    this.radius = type === 'needle' ? 5 : 4.5;
    this.dead = false;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -40 || this.y > FIELD_H + 40 || this.x < -40 || this.x > FIELD_W + 40) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.type === 'needle') {
      const spr = Sprites.shotNeedle;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.age * 30);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + HALF_PI);
      ctx.drawImage(spr.img, -8, -21, 16, 42);
      ctx.restore();
    } else if (this.type === 'bolt') {
      const spr = Sprites.shotBolt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.age * 30);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + HALF_PI);
      ctx.drawImage(spr.img, -8, -15, 16, 30);
      ctx.restore();
    } else if (this.type === 'option') {
      const spr = Sprites.shotBolt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.age * 30);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle + HALF_PI);
      ctx.drawImage(spr.img, -6, -11, 12, 22);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ */

class Item {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = rnd(-55, 55);
    this.vy = rnd(-130, -40);
    this.age = 0;
    this.sway = rnd(TAU);
    this.dead = false;
    this.rotation = rnd(-0.25, 0.25);
  }

  update(dt, game) {
    this.age += dt;
    const p = game.player;
    const canCollect = p.alive && !game.isPaused();
    const magnet = canCollect && dist2(this.x, this.y, p.x, p.y) < 42 * 42;
    if (magnet) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      const sp = 430 + Math.min(500, this.age * 260);
      this.x += Math.cos(a) * sp * dt;
      this.y += Math.sin(a) * sp * dt;
    } else {
      this.vy = Math.min(this.vy + 240 * dt, 96);
      this.vx *= Math.pow(0.05, dt);
      this.x += this.vx * dt + Math.sin(this.age * 3.4 + this.sway) * 16 * dt;
      this.y += this.vy * dt;
    }
    if (canCollect && dist2(this.x, this.y, p.x, p.y) < 20 * 20) {
      this.dead = true;
      game.collectItem(this);
    }
    if (this.y > FIELD_H + 40) this.dead = true;
  }

  draw(ctx) {
    const spr = this.type === 'power' ? Sprites.items.power
      : this.type === 'powerBig' ? Sprites.items.powerBig : Sprites.items.point;
    const w = this.type === 'powerBig' ? 27 : 19;
    const h = this.type === 'powerBig' ? 31 : 22;
    const bob = Math.sin(this.age * 4 + this.sway) * 1.6;
    drawSprite(ctx, spr, this.x, this.y + bob, w, h, this.rotation + Math.sin(this.age * 3) * 0.05, 0.97);
  }
}

/* ------------------------------------------------------------------ */

class ParticleSystem {
  constructor(capacity = 900) {
    this.pool = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.pool[i] = { active: false };
    this.cursor = 0;
  }

  spawn(o) {
    const n = this.pool.length;
    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const p = this.pool[idx];
      if (!p.active) {
        this.cursor = (idx + 1) % n;
        p.active = true;
        p.x = o.x; p.y = o.y;
        p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
        p.life = p.maxLife = o.life ?? 0.5;
        p.size = o.size ?? 2.5;
        p.color = o.color ?? '#ffffff';
        p.type = o.type ?? 'spark';
        p.grav = o.grav ?? 0;
        p.drag = o.drag ?? 1.6;
        p.rot = o.rot ?? 0;
        p.vr = o.vr ?? 0;
        p.alpha = o.alpha ?? 1;
        return p;
      }
    }
    return null;
  }

  burst(x, y, color, count, opts = {}) {
    const speed = opts.speed ?? 175;
    const life = opts.life ?? 0.55;
    for (let i = 0; i < count; i++) {
      const a = rnd(TAU);
      const sp = rnd(speed * 0.25, speed);
      this.spawn({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(life * 0.45, life),
        size: rnd(opts.sizeMin ?? 1.2, opts.size ?? 3.4),
        color,
        type: opts.type ?? pick(['spark', 'star', 'dot']),
        drag: rnd(1.2, 2.6),
        grav: opts.grav ?? 40,
        vr: rnd(-6, 6),
      });
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      const s = p.size * (0.4 + a * 0.8);
      ctx.globalAlpha = a * a * p.alpha;
      ctx.fillStyle = p.color;
      if (p.type === 'star') {
        starPath(ctx, p.x, p.y, s * 2.1, s * 0.7, 4, p.rot);
        ctx.fill();
      } else if (p.type === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 1.8, s * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.8, s * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 3.2, 0, TAU);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }
}
