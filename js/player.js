'use strict';

/* ------------------------------------------------------------------
 *  The player: a compact orbital-defense fighter.
 * ------------------------------------------------------------------ */

class Player {
  constructor(game) {
    this.game = game;
    this.hitR = 2.8;
    this.nearMissR = 23;
    this.baseSpeed = 330;
    this.focusMul = 0.42;
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 110;
    this.options = [{ x: this.x - 34, y: this.y + 6 }, { x: this.x + 34, y: this.y + 6 }];
    this.optTargets = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.lives = 3;
    this.bombs = 2;
    this.power = 1;
    this.nearMiss = 0;
    this.deaths = 0;
    this.alive = true;
    this.invuln = 0;
    this.shotCd = 0;
    this.focused = false;
    this.bombTimer = 0;
    this.age = 0;
    this.lean = 0;
    this.shotSoundTick = 0;
    this.magnet = false;
    this.lastVx = 0;
  }

  resetNewGame(diff) {
    this.lives = diff.lives;
    this.bombs = diff.bombs;
    this.power = 1;
    this.nearMiss = 0;
    this.deaths = 0;
    this.alive = true;
    this.invuln = 0;
    this.bombTimer = 0;
    this.shotCd = 0;
    this.placeAtStart();
  }

  placeAtStart() {
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 110;
    this.options[0].x = this.x - 34;
    this.options[0].y = this.y + 6;
    this.options[1].x = this.x + 34;
    this.options[1].y = this.y + 6;
    this.invuln = Math.max(this.invuln, 1.2);
    this.alive = true;
  }

  snapshot() {
    return {
      lives: this.lives,
      bombs: this.bombs,
      power: this.power,
      nearMiss: this.nearMiss,
      deaths: this.deaths,
    };
  }

  restore(snap) {
    this.lives = snap.lives;
    this.bombs = snap.bombs;
    this.power = snap.power;
    this.nearMiss = snap.nearMiss;
    this.deaths = snap.deaths;
    this.alive = true;
    this.invuln = 1.4;
    this.bombTimer = 0;
    this.shotCd = 0;
    this.placeAtStart();
  }

  update(dt, game) {
    this.age += dt;
    if (!this.alive) return;

    this.invuln = Math.max(0, this.invuln - dt);
    this.bombTimer = Math.max(0, this.bombTimer - dt);

    this.focused = Input.focus();

    let dx = 0;
    let dy = 0;
    if (Input.left()) dx -= 1;
    if (Input.right()) dx += 1;
    if (Input.up()) dy -= 1;
    if (Input.downKey()) dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = Math.SQRT1_2;
      dx *= inv;
      dy *= inv;
    }
    const speed = this.baseSpeed * (this.focused ? this.focusMul : 1);
    this.x = clamp(this.x + dx * speed * dt, 12, FIELD_W - 12);
    this.y = clamp(this.y + dy * speed * dt, 28, FIELD_H - 20);
    this.lastVx = dx;
    this.lean = lerp(this.lean, dx * 0.10, Math.min(1, dt * 10));

    // Options drift toward their formation slot.
    const side = this.focused ? 21 : 36;
    const oy = this.focused ? -7 : 6;
    this.optTargets[0].x = this.x - side;
    this.optTargets[0].y = this.y + oy;
    this.optTargets[1].x = this.x + side;
    this.optTargets[1].y = this.y + oy;
    const ease = 1 - Math.pow(0.00001, dt);
    for (let i = 0; i < 2; i++) {
      this.options[i].x = lerp(this.options[i].x, this.optTargets[i].x, ease);
      this.options[i].y = lerp(this.options[i].y, this.optTargets[i].y, ease);
    }

    if (Input.bombPressed()) this.tryBomb(game);

    this.shotCd -= dt;
    if (Input.shoot() && this.shotCd <= 0) {
      this.fire(game);
      this.shotCd = 0.075;
    }
    if (!Input.shoot()) this.shotCd = Math.min(this.shotCd, 0);
  }

  fire(game) {
    const pw = this.power;
    const dmg = 1.15 + pw * 0.115;
    const y = this.y - 18;
    const angle = -HALF_PI;
    const heavy = this.focused;

    if (heavy) {
      for (let i = -1; i <= 1; i++) {
        game.playerShots.push(new PlayerShot(this.x + i * 7, y, angle + i * 0.012, 'needle', dmg));
      }
    } else {
      game.playerShots.push(new PlayerShot(this.x - 8, y, angle - 0.02, 'bolt', dmg * 0.82));
      game.playerShots.push(new PlayerShot(this.x + 8, y, angle + 0.02, 'bolt', dmg * 0.82));
      if (pw >= 2) {
        game.playerShots.push(new PlayerShot(this.x - 19, y + 5, angle - 0.17, 'bolt', dmg * 0.62));
        game.playerShots.push(new PlayerShot(this.x + 19, y + 5, angle + 0.17, 'bolt', dmg * 0.62));
      }
    }

    if (pw >= 0.95) {
      for (const opt of this.options) {
        game.playerShots.push(new PlayerShot(opt.x, opt.y - 12, angle, 'option', dmg * 0.55));
        if (pw >= 3.5) {
          game.playerShots.push(new PlayerShot(opt.x - 4, opt.y - 10, angle - 0.09, 'option', dmg * 0.35));
          game.playerShots.push(new PlayerShot(opt.x + 4, opt.y - 10, angle + 0.09, 'option', dmg * 0.35));
        }
      }
    }

    this.shotSoundTick++;
    if (this.shotSoundTick % 2 === 0) AudioSys.play('shot');
  }

  tryBomb(game) {
    if (this.bombs <= 0 || this.bombTimer > 0 || !this.alive) return;
    this.bombs--;
    this.bombTimer = 1.6;
    this.invuln = Math.max(this.invuln, 2.8);
    game.doBomb(this);
  }

  hit(game) {
    if (!this.alive || this.invuln > 0 || this.bombTimer > 0) return false;
    if (game.debugInvincible) return false;

    this.lives--;
    this.deaths++;
    this.power = Math.max(0, this.power - 1.0);
    game.onPlayerHit();
    AudioSys.play('playerHit');
    game.shakeScreen(20, 0.7);

    if (this.lives <= 0) {
      this.alive = false;
      game.beginGameOver();
      return true;
    }

    this.x = FIELD_W / 2;
    this.y = FIELD_H - 110;
    this.options[0].x = this.x - 36;
    this.options[0].y = this.y + 6;
    this.options[1].x = this.x + 36;
    this.options[1].y = this.y + 6;
    this.invuln = 2.8;
    game.clearEnemyBullets(true);
    return true;
  }

  draw(ctx) {
    if (!this.alive) return;

    // Invulnerability flicker.
    let alpha = 1;
    if (this.invuln > 0 && this.bombTimer <= 0) {
      alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.age * 34));
    }

    // Support drones.
    for (let i = 0; i < 2; i++) {
      if (this.power < 0.95) continue;
      const o = this.options[i];
      const pulse = 0.5 + 0.5 * Math.sin(this.age * 5 + i * Math.PI);
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, 13);
      g.addColorStop(0, 'rgba(220,252,255,0.8)');
      g.addColorStop(0.35, 'rgba(130,235,255,0.5)');
      g.addColorStop(0.65, 'rgba(70,180,255,0.16)');
      g.addColorStop(1, 'rgba(40,140,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 13, 0, TAU);
      ctx.fill();

      ctx.translate(o.x, o.y);
      ctx.rotate(this.age * 1.2 + i * 0.4);
      ctx.fillStyle = '#263b4b';
      ctx.strokeStyle = 'rgba(150,240,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.1, 0, TAU);
      ctx.fill();

      ctx.rotate(-(this.age * 1.2 + i * 0.4));
      ctx.strokeStyle = `rgba(140,235,255,${0.25 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Fighter.
    drawSprite(ctx, Sprites.player, this.x, this.y, 36, 47, this.lean, alpha);

    // Focus targeting reticle.
    if (this.focused) {
      const pul = 0.5 + 0.5 * Math.sin(this.age * 9);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = 'rgba(190,250,255,0.85)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 8 + pul * 2, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110,230,255,0.95)';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(this.x, this.y + 2);
        ctx.rotate((i / 4) * TAU);
        ctx.beginPath();
        ctx.moveTo(0, -(11 + pul * 2));
        ctx.lineTo(0, -(15 + pul * 2));
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#e8ffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 2.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5fe6ff';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 1.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.age * 7);
      ctx.fillStyle = '#bff6ff';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 1.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Bomb shield.
    if (this.bombTimer > 0) {
      const t = 1 - this.bombTimer / 1.6;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.65;
      ctx.strokeStyle = '#9feeff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22 + t * 40, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,210,130,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 28 + t * 46, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}
