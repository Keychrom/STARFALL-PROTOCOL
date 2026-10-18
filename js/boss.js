'use strict';

/* ------------------------------------------------------------------
 *  Boss / midboss: multi-phase attack platform.
 *  No spell-card layer; each phase is simply an attack pattern with
 *  its own HP and time limit.
 * ------------------------------------------------------------------ */

class Boss {
  constructor(def, game) {
    this.def = def;
    this.isMid = !!def.isMid;
    this.name = def.name;
    this.title = def.title;
    this.art = def.art || 'cruiser';
    this.sprite = Sprites.boss(this.art);
    this.phases = def.phases;
    this.totalPhases = this.phases.length;
    this.x = def.x ?? FIELD_W / 2;
    this.y = -120;
    this.entryX = def.x ?? FIELD_W / 2;
    this.anim = 0;
    this.state = 'enter';
    this.stateT = 0;
    this.phaseIndex = -1;
    this.phase = null;
    this.phaseT = 0;
    this.timeLeft = 0;
    this.hp = 1;
    this.maxHp = 1;
    this.hpShow = 1;
    this.invuln = true;
    this.flash = 0;
    this.perfect = true;
    this.gone = false;
    this.rt = {};
    this.exTimer = 0;
    this.lunaticT = 0;
    this.entryDuration = def.entryDuration ?? 2.1;
    this.deathDuration = this.isMid ? 1.6 : 2.5;
    this.bannerTime = this.isMid ? 1.35 : 1.8;
    this.ringColor = this.art === 'core' ? '#72e6ff' : '#ffc15a';
    this.shipW = this.art === 'core' ? 124 : 128;
    this.shipH = this.art === 'core' ? 122 : 136;
  }

  get targetable() {
    return this.state === 'fight' && !this.invuln;
  }

  update(dt, game) {
    if (this.gone) return;
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.hpShow = lerp(this.hpShow, this.maxHp > 0 ? clamp(this.hp / this.maxHp, 0, 1) : 0, Math.min(1, dt * 9));

    switch (this.state) {
      case 'enter': {
        this.stateT += dt;
        const t = clamp(this.stateT / this.entryDuration, 0, 1);
        const e = easeOutCubic(t);
        this.y = lerp(-120, 152, e);
        this.x = this.entryX + Math.sin(this.stateT * 1.8) * 22 * (1 - e);
        if (t >= 1) this.startPhase(0, game);
        break;
      }
      case 'briefing':
        this.stateT += dt;
        this.hover(dt);
        if (this.stateT >= this.bannerTime) this.startFight(game);
        break;
      case 'ready':
        this.stateT += dt;
        this.hover(dt);
        if (this.stateT >= 0.8) this.startFight(game);
        break;
      case 'fight': {
        if (!this.phase) { this.state = 'dying'; this.stateT = 0; break; }
        this.phaseT += dt;
        this.timeLeft = Math.max(0, this.phase.time - this.phaseT);
        if (this.phase.move) this.phase.move(this, this.phaseT, game);
        this.x = clamp(this.x, 58, FIELD_W - 58);
        this.y = clamp(this.y, 86, 300);
        if (this.phase.pattern) this.phase.pattern(this, this.phaseT, game, this.rt);

        // LUNATIC-only pressure: a slowly rotating gap ring layered over the phase.
        if (game.diff.key === 'lunatic') {
          this.lunaticT -= dt;
          if (this.lunaticT <= 0) {
            this.lunaticT = this.isMid ? 2.8 : 2.2;
            Patterns.gapRing(game, this.x, this.y + 10, {
              count: this.isMid ? 14 : 16, gap: 1.15, angle: this.phaseT * 0.7,
              speed: 92, color: this.art === 'core' ? 'cyan' : 'red',
              shape: 'orb', size: this.isMid ? 5.2 : 5.8,
            });
            game.particles.burst(this.x, this.y, this.ringColor, 7,
              { speed: 140, size: 3.2, life: 0.35, type: 'spark' });
          }
        }

        if (this.hp <= 0) this.endPhase(game, true);
        else if (this.timeLeft <= 0) this.endPhase(game, false);
        break;
      }
      case 'break':
        this.stateT += dt;
        this.hover(dt);
        this.exTimer -= dt;
        if (this.exTimer <= 0) {
          this.exTimer = 0.13;
          game.particles.burst(this.x + rnd(-30, 30), this.y + rnd(-24, 26),
            this.ringColor, 5,
            { speed: 150, size: 3.6, life: 0.5, type: 'spark' });
        }
        if (this.stateT >= 1.0) {
          if (this.phaseIndex + 1 < this.phases.length) {
            this.startPhase(this.phaseIndex + 1, game);
          } else {
            this.startDying(game);
          }
        }
        break;
      case 'dying': {
        this.stateT += dt;
        this.exTimer -= dt;
        this.x += Math.sin(this.stateT * 18) * 24 * dt;
        if (this.exTimer <= 0) {
          this.exTimer = 0.17;
          game.particles.burst(this.x + rnd(-38, 38), this.y + rnd(-30, 34),
            pick(['#fff1cf', this.ringColor, '#ff7b55']),
            9, { speed: 220, size: 4.2, life: 0.7, type: 'spark', grav: 20 });
          game.shakeScreen(5, 0.18);
        }
        if (this.stateT >= this.deathDuration) {
          this.gone = true;
          game.particles.burst(this.x, this.y, '#ffffff', 38,
            { speed: 330, size: 5, life: 1.1, type: 'spark', grav: 0 });
          game.particles.burst(this.x, this.y, this.ringColor, 26,
            { speed: 240, size: 6, life: 0.9, type: 'spark', grav: 20 });
          game.flashScreen(0.55, '#ffedc9');
          game.shakeScreen(24, 0.9);
          game.onBossDefeated(this);
        }
        break;
      }
      default:
        break;
    }
  }

  hover(dt) {
    this.y += Math.sin(this.anim * 1.8) * 4 * dt;
  }

  startPhase(index, game) {
    this.phaseIndex = index;
    this.phase = this.phases[index];
    this.phaseT = 0;
    this.timeLeft = this.phase.time;
    this.maxHp = Math.max(1, Math.floor(this.phase.hp * game.diff.hp));
    this.hp = this.maxHp;
    this.hpShow = 1;
    this.rt = {};
    this.perfect = true;
    this.invuln = true;
    this.stateT = 0;
    this.state = this.phase.name ? 'briefing' : 'ready';
    game.clearEnemyBullets(true);
    game.onBossPhaseStart(this);
    AudioSys.play('phase');
  }

  phaseBonus() {
    const base = this.isMid ? 250000 : 350000 + this.phaseIndex * 100000;
    return Math.floor(base * (0.35 + 0.65 * (this.timeLeft / Math.max(1, this.phase.time))));
  }

  breakPerfect() {
    this.perfect = false;
  }

  startFight(game) {
    this.state = 'fight';
    this.stateT = 0;
    this.invuln = false;
    this.lunaticT = 0.9;
  }

  endPhase(game, byHp) {
    if (this.state !== 'fight' || !this.phase) return;
    this.state = 'break';
    this.stateT = 0;
    this.invuln = true;
    this.exTimer = 0;
    game.clearEnemyBullets(true);
    AudioSys.play('phaseBreak');
    game.shakeScreen(9, 0.45);
    game.particles.burst(this.x, this.y, this.ringColor, 20,
      { speed: 240, size: 4.5, life: 0.8, type: 'spark' });

    let bonus = 0;
    const perfect = byHp && this.perfect;
    if (perfect) {
      bonus = this.phaseBonus();
      game.addScore(bonus);
      AudioSys.play('perfect');
    }
    game.addScore(byHp ? 30000 : 10000);
    game.spawnDrops(this.x, this.y,
      this.phaseIndex === 0 ? 2 : 1,
      this.phaseIndex === 0 ? 5 : 3);
    game.showPhaseResult({
      byHp, perfect, bonus,
      name: this.phase.name,
      timeLeft: this.timeLeft,
      art: this.art,
    });
  }

  startDying(game) {
    this.state = 'dying';
    this.stateT = 0;
    this.invuln = true;
    this.exTimer = 0;
    game.clearEnemyBullets(true);
    AudioSys.play('bossDown');
    game.shakeScreen(16, 1.2);
    game.spawnDrops(this.x, this.y, this.isMid ? 4 : 7, this.isMid ? 9 : 18);
    game.onBossDying(this);
  }

  damage(amount, game) {
    if (!this.targetable || this.gone || !this.phase) return;
    this.hp -= amount;
    this.flash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.endPhase(game, true);
    }
  }

  draw(ctx) {
    if (this.gone) return;
    const bob = Math.sin(this.anim * 1.9) * 4;
    const x = this.x;
    const y = this.y + bob;
    const activeAttack = this.state === 'fight' || this.state === 'briefing' || this.state === 'ready';
    let alpha = 1;
    let scale = 1;

    if (this.state === 'enter') {
      const t = clamp(this.stateT / this.entryDuration, 0, 1);
      alpha = easeOutCubic(t);
      scale = 0.86 + 0.14 * easeOutCubic(t);
    } else if (this.state === 'break') {
      alpha = 0.75 + 0.25 * Math.sin(this.anim * 30);
    } else if (this.state === 'dying') {
      alpha = 0.55 + 0.45 * Math.sin(this.anim * 36);
      scale = 1 - Math.min(0.12, this.stateT * 0.035);
    }

    // Dark halo for readability against bright backdrops.
    ctx.save();
    const halo = ctx.createRadialGradient(x, y + 8, 8, x, y + 8, 92);
    halo.addColorStop(0, `rgba(2,5,12,${0.42 * alpha})`);
    halo.addColorStop(0.6, `rgba(2,5,12,${0.18 * alpha})`);
    halo.addColorStop(1, 'rgba(2,5,12,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y + 8, 92, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (activeAttack) this.drawTargetRings(ctx, x, y + 8, alpha);

    // Shield / engine aura.
    ctx.save();
    const aura = ctx.createRadialGradient(x, y + 8, 10, x, y + 8, 82);
    const c = this.art === 'core' ? '90,230,255' : '255,190,90';
    aura.addColorStop(0, `rgba(${c},${0.22 * alpha})`);
    aura.addColorStop(0.55, `rgba(${c},${0.07 * alpha})`);
    aura.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y + 8, 82, 0, TAU);
    ctx.fill();
    ctx.restore();

    drawSprite(ctx, this.sprite, x, y, this.shipW * scale, this.shipH * scale,
      Math.sin(this.anim * 1.1) * 0.012, alpha);

    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash * 0.32 * alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, this.shipW * 0.32, this.shipH * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Sci-fi target-lock brackets, not a magic circle. */
  drawTargetRings(ctx, x, y, alpha) {
    const t = this.anim;
    const col = this.ringColor;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = rgba(col, 0.32);
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 11]);
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = rgba(col, 0.18);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.stroke();

    // Corner brackets.
    ctx.strokeStyle = rgba(col, 0.55);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(t * 0.25 + (i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(-10, -60);
      ctx.lineTo(-3, -60);
      ctx.lineTo(-3, -53);
      ctx.moveTo(3, -60);
      ctx.lineTo(10, -60);
      ctx.lineTo(10, -53);
      ctx.stroke();
      ctx.restore();
    }

    // Sweeping lock arc.
    ctx.strokeStyle = rgba(col, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 74, t * 0.8, t * 0.8 + 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 74, t * 0.8 + Math.PI, t * 0.8 + Math.PI + 0.55);
    ctx.stroke();

    // Center crosshair ticks.
    ctx.strokeStyle = rgba(col, 0.25);
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(0, -34);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
