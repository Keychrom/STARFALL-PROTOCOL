'use strict';

/* ------------------------------------------------------------------
 *  Game shell: state machine, HUD, scoring, screens.
 * ------------------------------------------------------------------ */

function drawSpacedText(ctx, text, x, y, spacing, font, fill, align = 'center', glow = null) {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = fill;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + spacing;
  }
  ctx.restore();
}

function drawOrnament(ctx, cx, y, halfWidth, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx - 12, y);
  ctx.moveTo(cx + 12, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.stroke();
  ctx.fillStyle = color;
  diamondPath(ctx, cx - 10, y, 3, 3);
  ctx.fill();
  diamondPath(ctx, cx + 10, y, 3, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, y, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawKeyHint(ctx, x, y, key, label, keyColor = '#8fe8ff') {
  ctx.save();
  ctx.font = `600 10px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const keyW = Math.max(30, ctx.measureText(key).width + 12);
  ctx.fillStyle = 'rgba(120,225,255,0.06)';
  roundRectPath(ctx, x, y - 8, keyW, 16, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,225,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = keyColor;
  ctx.textAlign = 'center';
  ctx.fillText(key, x + keyW / 2, y + 0.5);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(195,232,242,0.64)';
  ctx.font = `10px ${SANS}`;
  ctx.fillText(label, x + keyW + 7, y + 0.5);
  ctx.restore();
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    Sprites.init();

    this.diffIndex = clamp(Number(Storage.get('gdr_diff', 1)) || 0, 0, DIFFICULTIES.length - 1);
    this.diff = DIFFICULTIES[this.diffIndex];
    this.highScore = Math.max(0, Number(Storage.get('gdr_hi', 0)) || 0);

    this.state = 'title';
    this.stateT = 0;
    this.time = 0;

    this.score = 0;
    this.displayScore = 0;
    this.continues = 0;
    this.enemiesKilled = 0;
    this.perfectClears = 0;
    this.totalPatterns = [MID_CRUISER, BOSS_CRUISER, MID_WARDEN, BOSS_CORE]
      .reduce((sum, def) => sum + def.phases.length, 0);
    this.nearMissPulse = 0;
    this.reinforceT = 2.0;
    this.reinforceIndex = 0;

    this.player = new Player(this);
    this.enemyBullets = new BulletSystem(5200);
    this.particles = new ParticleSystem(900);
    this.background = new Background('title', VIEW_W, VIEW_H);
    this.fieldBackground = new Background('debris', FIELD_W, FIELD_H);

    this.enemies = [];
    this.playerShots = [];
    this.items = [];
    this.boss = null;
    this.stageIndex = 0;
    this.stage = null;
    this.stageTime = 0;
    this.events = [];
    this.stageSnapshot = null;
    this.stageStartScore = 0;

    this.introDuration = 2.9;
    this.introT = 0;
    this.gameOverDelay = 0;
    this.clearInfo = null;
    this.phaseResult = null;
    this.bossIntro = null;
    this.toast = null;
    this.bombFx = null;

    this.shakeT = 0;
    this.shakeDur = 0;
    this.shakeAmt = 0;
    this.flashT = 0;
    this.flashDur = 0;
    this.flashAlpha = 0;
    this.flashColor = '#ffffff';
    this.muteNotice = 0;
    this.allClearInfo = null;
    this.debugInvincible = false;

    this._titleBullets = [];
    for (let i = 0; i < 54; i++) {
      this._titleBullets.push({
        ring: i < 32 ? 0 : 1,
        phase: (i % 32) / 32,
        wob: rnd(TAU),
        color: pick(['cyan', 'blue', 'white', 'yellow', 'white']),
        shape: pick(['orb', 'orb', 'rice', 'star']),
      });
    }

    Input.init(() => {
      AudioSys.init();
      if (this.state === 'title' && !AudioSys.track) AudioSys.playTrack('title');
    });
    window.addEventListener('pointerdown', () => AudioSys.init());
    window.addEventListener('blur', () => {
      if (this.state === 'stage') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'stage') this.pauseGame();
    });
    window.addEventListener('beforeunload', () => this.saveHighScore());

    this._loop = this._loop.bind(this);
    this.last = performance.now();
    window.__GAME = this;
    requestAnimationFrame(this._loop);
  }

  _loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 1 / 30);
    this.update(dt);
    this.render();
    Input.endFrame();
    requestAnimationFrame(this._loop);
  }

  isPaused() { return this.state === 'paused'; }

  addScore(n) {
    this.score += Math.max(0, Math.floor(n));
    if (this.score > this.highScore) this.highScore = this.score;
  }

  saveHighScore() {
    Storage.set('gdr_hi', Math.floor(this.highScore));
  }

  shakeScreen(mag, dur = 0.4) {
    this.shakeAmt = Math.max(this.shakeAmt || 0, mag);
    this.shakeDur = Math.max(this.shakeDur || 0, dur);
    this.shakeT = Math.max(this.shakeT || 0, dur);
  }

  flashScreen(alpha, color = '#ffffff', dur = 0.35) {
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
    this.flashColor = color;
    this.flashDur = Math.max(this.flashDur, dur);
    this.flashT = Math.max(this.flashT, dur);
  }

  update(dt) {
    this.time += dt;
    this.stateT += dt;

    if (Input.pressed('KeyM')) {
      AudioSys.init();
      AudioSys.toggleMute();
      this.muteNotice = 1.6;
      if (this.state === 'title' && !AudioSys.track) AudioSys.playTrack('title');
    }

    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'intro': this.updateIntro(dt); break;
      case 'stage': this.updateStage(dt); break;
      case 'paused': this.updatePaused(dt); break;
      case 'stageclear': this.updateStageClear(dt); break;
      case 'gameover': this.updateGameOver(dt); break;
      case 'allclear': this.updateAllClear(dt); break;
      default: break;
    }

    this.updateVisualTimers(dt);
  }

  updateVisualTimers(dt) {
    this.displayScore += (this.score - this.displayScore) * Math.min(1, dt * 9);
    if (Math.abs(this.score - this.displayScore) < 1) this.displayScore = this.score;

    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.muteNotice > 0) this.muteNotice = Math.max(0, this.muteNotice - dt);
    if (this.nearMissPulse > 0) this.nearMissPulse = Math.max(0, this.nearMissPulse - dt * 4);
    if (this.phaseResult) {
      this.phaseResult.t += dt;
      if (this.phaseResult.t >= this.phaseResult.life) this.phaseResult = null;
    }
    if (this.bossIntro) {
      this.bossIntro.t += dt;
      if (this.bossIntro.t >= this.bossIntro.life) this.bossIntro = null;
    }
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t >= this.toast.life) this.toast = null;
    }
  }

  /* ==================== states ==================== */

  updateTitle(dt) {
    this.background.update(dt, 0.55);
    const prev = this.diffIndex;
    if (Input.pressed('ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW')) {
      this.diffIndex = (this.diffIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
    }
    if (Input.pressed('ArrowRight', 'KeyD', 'ArrowDown', 'KeyS')) {
      this.diffIndex = (this.diffIndex + 1) % DIFFICULTIES.length;
    }
    if (this.diffIndex !== prev) {
      this.diff = DIFFICULTIES[this.diffIndex];
      Storage.set('gdr_diff', this.diffIndex);
      AudioSys.play('select');
    }
    if (Input.confirmPressed()) this.startNewGame();
  }

  startNewGame() {
    AudioSys.init();
    AudioSys.play('start');
    this.score = 0;
    this.displayScore = 0;
    this.continues = 0;
    this.enemiesKilled = 0;
    this.perfectClears = 0;
    this.player.resetNewGame(this.diff);
    this.startStage(0);
  }

  startStage(index) {
    this.stageIndex = index;
    this.stage = STAGES[index];
    this.stageStartScore = this.score;
    this.stageSnapshot = Object.assign(this.player.snapshot(), { score: this.score });
    this.stageTime = 0;
    this.events = this.stage.events.map((e) => ({ t: e.t, fn: e.fn }));
    this.enemies = [];
    this.playerShots = [];
    this.items = [];
    this.boss = null;
    this.enemyBullets.clearAll();
    this.particles.clear();
    this.player.magnet = false;
    this.player.invuln = 1.5;
    this.player.bombTimer = 0;
    this.player.placeAtStart();
    this.phaseResult = null;
    this.bossIntro = null;
    this.toast = null;
    this.bombFx = null;
    this.clearInfo = null;
    this.gameOverDelay = 0;
    this.shakeT = 0;
    this.flashT = 0;
    this.fieldBackground.setTheme(this.stage.bg);
    this.introT = 0;
    this.reinforceT = 1.8;
    this.reinforceIndex = 0;
    this.state = 'intro';
    this.stateT = 0;
    AudioSys.playTrack(this.stage.track);
  }

  updateIntro(dt) {
    this.introT += dt;
    this.fieldBackground.update(dt, 0.8);
    if ((this.introT > 0.55 && Input.confirmPressed()) || this.introT >= this.introDuration) {
      this.beginStagePlay();
    }
  }

  beginStagePlay() {
    this.state = 'stage';
    this.stateT = 0;
    this.stageTime = 0;
    this.player.invuln = Math.max(this.player.invuln, 0.8);
  }

  updateStage(dt) {
    if (Input.pausePressed()) {
      this.pauseGame();
      return;
    }

    if (this.gameOverDelay > 0) {
      this.gameOverDelay -= dt;
      this.fieldBackground.update(dt, 0.35);
      this.particles.update(dt);
      if (this.gameOverDelay <= 0) this.enterGameOver();
      return;
    }

    this.fieldBackground.update(dt, 1);

    // Event timeline freezes while a midboss is on screen.
    const gated = this.boss && this.boss.isMid && !this.boss.gone;
    if (!gated) {
      this.stageTime += dt;
      let guard = 0;
      while (this.events.length && this.events[0].t <= this.stageTime && guard++ < 24) {
        const ev = this.events.shift();
        ev.fn(this);
      }
    }

    this.player.update(dt, this);

    // Keep a floor of hostile units so one-hit enemies never leave the field empty.
    if (!this.boss) {
      this.reinforceT -= dt;
      if (this.reinforceT <= 0) {
        this.reinforceT = 0.50;
        const target = this.diff.reinforceTarget ?? 14;
        if (this.enemies.length < target) this.spawnReinforcement();
      }
    }

    if (this.boss) this.boss.update(dt, this);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      if (e.dead) this.enemies.splice(i, 1);
    }

    for (const s of this.playerShots) s.update(dt);
    this.collidePlayerShots();
    this.playerShots = this.playerShots.filter((s) => !s.dead);

    this.enemyBullets.update(dt);
    this.collidePlayerBullets();

    for (const it of this.items) it.update(dt, this);
    this.items = this.items.filter((it) => !it.dead);

    this.particles.update(dt);

    if (this.bombFx) {
      this.bombFx.t -= dt;
      if (this.bombFx.t <= 0) this.bombFx = null;
    }
  }

  spawnReinforcement() {
    const stage2 = this.stage && this.stage.id === 2;
    const colors = stage2 ? ['blue', 'silver', 'purple'] : ['pink', 'blue', 'green', 'purple'];
    const bullets = stage2 ? ['blue', 'cyan', 'purple'] : ['cyan', 'pink', 'purple'];
    const color = pick(colors);
    const bulletColor = pick(bullets);
    const mode = this.reinforceIndex++ % 4;
    const fireMul = this.diff.fillerFireMul ?? 1;
    const fillerFire = Math.min(0.8, 0.3 * fireMul);
    const wallFire = Math.min(0.75, 0.25 * fireMul);

    if (mode === 0) {
      EnemyWaves.vFormation(this, {
        count: 5, color, hp: 1, holdY: rnd(115, 200), hold: 2.2,
        fireEvery: 6.0, fanCount: 2, fireRatio: fillerFire, spread: rnd(0.3, 0.5),
        speed: 120, shape: 'rice', size: 5, bulletColor,
        dropPower: 0, dropPoint: 0,
      });
    } else if (mode === 1) {
      EnemyWaves.sideSweep(this, {
        count: 4, dir: pick([-1, 1]), y: rnd(80, 160), color, hp: 1,
        fireEvery: 6.0, fanCount: 2, fireRatio: fillerFire, spread: 0.3,
        bulletSpeed: 130, shape: 'kunai', size: 4.6, bulletColor,
        dropPower: 0, dropPoint: 0,
      });
    } else if (mode === 2) {
      EnemyWaves.swarmWall(this, {
        count: 5, rows: 2, color, hp: 1, holdY: 105, rowGap: 72,
        hold: 2.8, spacing: 52, fireEvery: 6.0, fanCount: 2, fireRatio: wallFire,
        spread: 0.28, speed: 128, shape: 'rice', size: 5, bulletColor,
        dropPower: 0, dropPoint: 0,
      });
    } else {
      EnemyWaves.diagonalStream(this, {
        count: 5, dir: pick([-1, 1]), y: rnd(10, 70), color, hp: 1,
        fireEvery: 6.0, fanCount: 2, fireRatio: fillerFire, spread: 0.25,
        bulletSpeed: 125, shape: 'rice', size: 4.8, bulletColor,
        speedX: 128, speedY: 28, dropPower: 0, dropPoint: 0,
      });
    }
  }

  collidePlayerShots() {
    for (const s of this.playerShots) {
      if (s.dead) continue;

      if (this.boss && this.boss.targetable) {
        const bx = this.boss.x;
        const by = this.boss.y + 8;
        const rr = (this.boss.isMid ? 30 : 36) + s.radius;
        if (dist2(s.x, s.y, bx, by) < rr * rr) {
          this.boss.damage(s.damage, this);
          this.addScore(10);
          s.dead = true;
          this.onShotHit(s.x, s.y);
          continue;
        }
      }

      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = e.radius + s.radius;
        if (dist2(s.x, s.y, e.x, e.y) < rr * rr) {
          e.damage(s.damage, this);
          this.addScore(20);
          s.dead = true;
          this.onShotHit(s.x, s.y);
          break;
        }
      }
    }
  }

  onShotHit(x, y) {
    if (Math.random() < 0.4) {
      this.particles.spawn({
        x, y, vx: rnd(-55, 55), vy: rnd(-70, 30),
        life: rnd(0.12, 0.28), size: rnd(1, 2.2),
        color: pick(['#ffffff', '#bdefff', '#ffd27a']), type: 'spark',
      });
    }
    AudioSys.play('enemyHit');
  }

  collidePlayerBullets() {
    const p = this.player;
    if (!p.alive || this.gameOverDelay > 0) return;
    if (p.invuln > 0 || p.bombTimer > 0) return;
    const hit = this.enemyBullets.collidePlayer(p.x, p.y, p.hitR, p.nearMissR, (b) => this.onNearMiss(b));
    if (hit) p.hit(this);
  }

  onNearMiss(b) {
    this.player.nearMiss++;
    this.addScore(150);
    this.nearMissPulse = 1;
    this.particles.spawn({
      x: b.x, y: b.y, vx: rnd(-50, 50), vy: rnd(-50, 50),
      life: 0.28, size: 1.7, color: '#9eeeff', type: 'spark',
    });
    AudioSys.play('nearMiss');
  }

  onPlayerHit() {
    if (this.boss) this.boss.breakPerfect();
    this.clearEnemyBullets(true);
    this.particles.burst(this.player.x, this.player.y, '#ffce8f', 26,
      { speed: 260, size: 4.5, life: 0.8, type: 'spark', grav: 20 });
    this.particles.burst(this.player.x, this.player.y, '#ffffff', 14,
      { speed: 160, size: 2.6, life: 0.5, type: 'dot' });
    this.flashScreen(0.42, '#ff9b5e', 0.5);
  }

  clearEnemyBullets(withParticles) {
    const parts = this.particles;
    const player = this.player;
    this.enemyBullets.clearAll((b) => {
      if (!withParticles) return;
      if (Math.random() < 0.22) {
        parts.spawn({
          x: b.x, y: b.y,
          vx: Math.cos(b.angle) * 40 + rnd(-40, 40),
          vy: Math.sin(b.angle) * 40 + rnd(-40, 40),
          life: rnd(0.25, 0.55), size: rnd(1.4, 2.8),
          color: pick(['#f2ffff', '#9fe8ff', '#bcd7ff']), type: 'spark',
        });
      }
    });
    if (withParticles) {
      this.particles.spawn({
        x: player.x, y: player.y, vx: 0, vy: 0,
        life: 0.3, size: 8, color: '#9fefff', type: 'ring',
      });
    }
  }

  spawnDrops(x, y, powerCount, pointCount) {
    for (let i = 0; i < powerCount; i++) {
      const type = (powerCount >= 3 && i < 2) ? 'powerBig' : 'power';
      this.items.push(new Item(type, x + rnd(-18, 18), y + rnd(-12, 12)));
    }
    for (let i = 0; i < pointCount; i++) {
      this.items.push(new Item('point', x + rnd(-24, 24), y + rnd(-14, 14)));
    }
  }

  collectItem(item) {
    AudioSys.play('item');
    const isPower = item.type === 'power' || item.type === 'powerBig';
    this.particles.spawn({
      x: item.x, y: item.y, vx: 0, vy: -20,
      life: 0.32, size: 3.5,
      color: isPower ? '#78e6ff' : '#ffcf72', type: 'ring',
    });
    if (isPower) {
      const value = item.type === 'powerBig' ? 1.2 : 0.15;
      if (this.player.power < 4) {
        this.player.power = Math.min(4, this.player.power + value);
        this.addScore(100);
      } else {
        this.addScore(item.type === 'powerBig' ? 3000 : 500);
      }
    } else {
      const val = 2000 + this.stageIndex * 1000;
      this.addScore(val);
    }
  }

  spawnBoss(def) {
    if (this.boss) return;
    this.boss = new Boss(def, this);
    this.bossIntro = { t: 0, life: 3.2, isMid: !!def.isMid, name: def.name, title: def.title, art: def.art };
    this.clearEnemyBullets(true);
    for (const e of this.enemies) e.dead = true;
    this.enemies = [];
    this.phaseResult = null;
    this.toast = null;
    AudioSys.playTrack(this.stage ? this.stage.bossTrack : 'boss1');
  }

  onBossPhaseStart(boss) {
    this.bossIntro = null;
    this.toast = null;
    this.phaseResult = null;
  }

  showPhaseResult(info) {
    if (info.perfect) this.perfectClears++;
    this.phaseResult = Object.assign({ t: 0, life: 2.5 }, info);
  }

  onBossDying(boss) {
    this.bossIntro = null;
    this.phaseResult = null;
  }

  onBossDefeated(boss) {
    if (this.boss !== boss) return;
    this.boss = null;
    if (boss.isMid) {
      this.addScore(50000);
      this.toast = { text: 'ESCORT DESTROYED', sub: 'MISSION CONTINUES', t: 0, life: 2.2 };
      AudioSys.playTrack(this.stage.track);
    } else {
      this.beginStageClear();
    }
  }

  beginGameOver() {
    this.gameOverDelay = 1.8;
    this.clearEnemyBullets(true);
    this.flashScreen(0.5, '#ff6b3d', 0.7);
    this.phaseResult = null;
    this.bossIntro = null;
  }

  enterGameOver() {
    this.state = 'gameover';
    this.stateT = 0;
    this.player.invuln = 0;
    this.saveHighScore();
    AudioSys.stopMusic();
    AudioSys.play('gameover');
  }

  continueGame() {
    this.continues++;
    this.score = this.stageStartScore;
    this.displayScore = this.score;
    this.player.lives = this.diff.lives;
    this.player.bombs = this.diff.bombs;
    this.player.power = 2;
    if (this.stageSnapshot) {
      this.player.deaths = this.stageSnapshot.deaths;
    }
    this.player.alive = true;
    this.startStage(this.stageIndex);
    AudioSys.play('start');
  }

  beginStageClear() {
    if (this.state === 'stageclear' || this.state === 'allclear') return;
    this.clearEnemyBullets(true);
    this.enemies = [];
    this.playerShots = [];
    this.player.invuln = 0;
    this.boss = null;
    this.bossIntro = null;
    this.phaseResult = null;

    const found = this.items;
    this.items = [];
    for (const it of found) {
      it.dead = false;
      this.collectItem(it);
    }

    const rows = [
      ['AREA CLEAR', 100000 * (this.stageIndex + 1)],
      ['LIFE BONUS', Math.max(0, this.player.lives) * 50000],
      ['BOMB BONUS', this.player.bombs * 15000],
      ['NEAR MISS BONUS', this.player.nearMiss * 80],
    ];
    let total = 0;
    for (const row of rows) total += row[1];
    this.addScore(total);
    this.clearInfo = {
      isLast: this.stageIndex >= STAGES.length - 1,
      rows,
      total,
      t: 0,
      life: this.stageIndex >= STAGES.length - 1 ? 5.0 : 4.6,
    };
    this.state = 'stageclear';
    this.stateT = 0;
    this.player.magnet = false;
    this.saveHighScore();
    AudioSys.play('clear');
    AudioSys.playTrack(this.clearInfo.isLast ? 'ending' : this.stage.track);
  }

  updateStageClear(dt) {
    this.fieldBackground.update(dt, 0.4);
    this.particles.update(dt);
    if (!this.clearInfo) return;
    this.clearInfo.t += dt;
    const ready = this.clearInfo.t > 1.15;
    if (ready && Input.confirmPressed()) this.advanceAfterClear();
    else if (this.clearInfo.t >= this.clearInfo.life) this.advanceAfterClear();
  }

  advanceAfterClear() {
    if (this.state !== 'stageclear') return;
    if (this.clearInfo && this.clearInfo.isLast) {
      this.enterAllClear();
    } else {
      this.startStage(this.stageIndex + 1);
    }
  }

  enterAllClear() {
    this.state = 'allclear';
    this.stateT = 0;
    this.boss = null;
    this.enemies = [];
    this.playerShots = [];
    this.items = [];
    this.enemyBullets.clearAll();
    this.particles.clear();
    this.background.setTheme('ending');
    this.clearInfo = null;
    this.bossIntro = null;
    this.phaseResult = null;
    this.toast = null;
    const rank = this.continues === 0
      ? (this.player.deaths === 0 ? 'S' : this.player.deaths <= 2 ? 'A' : 'B')
      : (this.continues <= 1 ? 'B' : 'C');
    this.allClearInfo = { rank, t: 0 };
    this.saveHighScore();
    AudioSys.playTrack('ending');
    AudioSys.play('clear');
  }

  updateGameOver(dt) {
    this.fieldBackground.update(dt, 0.3);
    this.particles.update(dt);
    if (Input.confirmPressed()) {
      this.continueGame();
    } else if (Input.pressed('Escape', 'KeyQ')) {
      this.titleScreen();
    }
  }

  updateAllClear(dt) {
    this.background.update(dt, 0.5);
    if (this.stateT > 1.2 && Input.confirmPressed()) this.titleScreen();
  }

  pauseGame() {
    if (this.state !== 'stage') return;
    this.state = 'paused';
    this.stateT = 0;
  }

  updatePaused(dt) {
    if (Input.pausePressed()) {
      this.state = 'stage';
      this.stateT = 0;
      return;
    }
    if (Input.pressed('KeyR')) {
      this.retryStage();
      return;
    }
    if (Input.pressed('KeyQ')) {
      this.titleScreen();
    }
  }

  retryStage() {
    this.score = this.stageStartScore;
    this.displayScore = this.score;
    if (this.stageSnapshot) this.player.restore(this.stageSnapshot);
    else this.player.placeAtStart();
    this.startStage(this.stageIndex);
    AudioSys.play('select');
  }

  titleScreen() {
    this.state = 'title';
    this.stateT = 0;
    this.background.setTheme('title');
    this.boss = null;
    this.enemies = [];
    this.playerShots = [];
    this.items = [];
    this.enemyBullets.clearAll();
    this.particles.clear();
    this.clearInfo = null;
    this.phaseResult = null;
    this.bossIntro = null;
    this.toast = null;
    this.gameOverDelay = 0;
    this.allClearInfo = null;
    this.diff = DIFFICULTIES[this.diffIndex];
    if (AudioSys.ready) AudioSys.playTrack('title');
    this.saveHighScore();
  }

  doBomb(player) {
    this.clearEnemyBullets(true);
    this.flashScreen(0.5, '#dff8ff', 0.45);
    this.shakeScreen(16, 0.6);
    this.particles.burst(player.x, player.y, '#a8ecff', 30,
      { speed: 300, size: 4.5, life: 0.8, type: 'spark', grav: 0 });
    this.bombFx = { x: player.x, y: player.y, t: 1.6, life: 1.6 };
    if (this.boss) this.boss.breakPerfect();
    for (const e of this.enemies) {
      if (!e.dead) e.damage(180, this);
    }
    if (this.boss && this.boss.targetable) this.boss.damage(240, this);
    AudioSys.play('bomb');
  }

  /* ==================== rendering ==================== */

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1.5, 0, 0, 1.5, 0, 0);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.state === 'title') { this.drawTitle(ctx); return; }
    if (this.state === 'allclear') { this.drawAllClear(ctx); return; }

    this.drawShell(ctx);
    this.drawGameplay(ctx);
    this.drawHUD(ctx);

    if (this.state === 'intro') this.drawIntroOverlay(ctx);
    else if (this.state === 'paused') this.drawPauseOverlay(ctx);
    else if (this.state === 'stageclear') this.drawStageClearOverlay(ctx);
    else if (this.state === 'gameover') this.drawGameOverOverlay(ctx);
  }

  drawShell(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#040a14');
    g.addColorStop(0.55, '#071424');
    g.addColorStop(1, '#02060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const halo = ctx.createRadialGradient(
      FIELD_X + FIELD_W / 2, VIEW_H / 2, 80,
      FIELD_X + FIELD_W / 2, VIEW_H / 2, 620
    );
    halo.addColorStop(0, 'rgba(40,140,190,0.12)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Fine frame ornaments.
    ctx.save();
    ctx.strokeStyle = 'rgba(110,220,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, FIELD_Y);
    ctx.lineTo(10, FIELD_Y + 90);
    ctx.moveTo(10, FIELD_Y + FIELD_H - 90);
    ctx.lineTo(10, FIELD_Y + FIELD_H);
    ctx.stroke();
    ctx.restore();
  }

  drawGameplay(ctx) {
    const shake = this.shakeT > 0
      ? this.shakeAmt * (this.shakeT / Math.max(0.001, this.shakeDur))
      : 0;
    const sx = shake ? rnd(-shake, shake) : 0;
    const sy = shake ? rnd(-shake, shake) : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    ctx.clip();
    ctx.translate(FIELD_X + sx, FIELD_Y + sy);

    this.fieldBackground.draw(ctx);

    // Keep the scenery behind the action; bullets and characters need the contrast.
    ctx.fillStyle = 'rgba(2,6,14,0.24)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    for (const it of this.items) it.draw(ctx);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    if (this.boss) this.boss.draw(ctx);
    if (this.player.alive) this.player.draw(ctx);
    for (const s of this.playerShots) s.draw(ctx);
    this.particles.draw(ctx);
    this.enemyBullets.draw(ctx);
    if (this.bombFx) this.drawBombFx(ctx);

    if (this.flashT > 0) {
      ctx.globalAlpha = (this.flashT / Math.max(0.001, this.flashDur)) * this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Field frame.
    ctx.save();
    ctx.strokeStyle = 'rgba(105,220,255,0.32)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(FIELD_X - 0.5, FIELD_Y - 0.5, FIELD_W + 1, FIELD_H + 1);
    ctx.strokeStyle = 'rgba(150,238,255,0.6)';
    ctx.lineWidth = 1.5;
    const corner = 20;
    for (const [cx, cy, dx, dy] of [
      [FIELD_X, FIELD_Y, 1, 1],
      [FIELD_X + FIELD_W, FIELD_Y, -1, 1],
      [FIELD_X, FIELD_Y + FIELD_H, 1, -1],
      [FIELD_X + FIELD_W, FIELD_Y + FIELD_H, -1, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * corner, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * corner);
      ctx.stroke();
    }
    const inner = ctx.createRadialGradient(
      FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, Math.min(FIELD_W, FIELD_H) * 0.3,
      FIELD_X + FIELD_W / 2, FIELD_Y + FIELD_H / 2, Math.max(FIELD_W, FIELD_H) * 0.7
    );
    inner.addColorStop(0, 'rgba(0,0,0,0)');
    inner.addColorStop(1, 'rgba(2,0,8,0.24)');
    ctx.fillStyle = inner;
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    ctx.restore();

    this.drawFieldUI(ctx);
  }

  drawEnemy(ctx, e) {
    const frame = Math.sin(e.anim) > 0 ? 0 : 1;
    const bob = Math.sin(e.anim * 0.9) * 2;
    const tilt = clamp((e.x - e.prevX) * 0.012, -0.18, 0.18);
    const w = 40 * e.scale;
    const h = 45 * e.scale;

    // Aura.
    ctx.save();
    const col = (DRONE_COLORS[e.color] || DRONE_COLORS.pink).accent;
    const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 26);
    g.addColorStop(0, rgba(col, 0.16));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 26, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (e.flash > 0) {
      ctx.save();
      ctx.filter = `brightness(${1 + e.flash * 1.8})`;
      drawSprite(ctx, e.sprite[frame], e.x, e.y + bob, w, h, tilt);
      ctx.restore();
    } else {
      drawSprite(ctx, e.sprite[frame], e.x, e.y + bob, w, h, tilt);
    }
  }

  drawBombFx(ctx) {
    const b = this.bombFx;
    const life = b.t / b.life;
    const t = 1 - life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const rr = 30 + t * (220 + i * 60);
      ctx.globalAlpha = (1 - t) * (0.5 - i * 0.13);
      ctx.strokeStyle = i === 1 ? '#8feaff' : '#d8f8ff';
      ctx.lineWidth = 3 - i * 0.7;
      ctx.beginPath();
      ctx.arc(b.x, b.y, rr, 0, TAU);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 90 + t * 160);
    g.addColorStop(0, `rgba(190,245,255,${0.24 * (1 - t)})`);
    g.addColorStop(1, 'rgba(100,210,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 90 + t * 160, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawFieldUI(ctx) {
    const fx = FIELD_X;
    const fy = FIELD_Y;
    const showBossUI = this.state === 'stage' || this.state === 'paused';

    if (this.boss && showBossUI) {
      const b = this.boss;
      const isCore = b.art === 'core';
      const accent = isCore ? '#7fe9ff' : '#ffc45e';
      const accent2 = isCore ? '#3f9dff' : '#ff7a3c';
      const barX = fx + 20;
      const barY = fy + 12;
      const barW = FIELD_W - 40;
      const barH = 6;

      ctx.save();
      ctx.fillStyle = 'rgba(2,8,16,0.66)';
      roundRectPath(ctx, barX - 8, barY - 7, barW + 16, 16, 3);
      ctx.fill();
      ctx.strokeStyle = rgba(accent, 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();

      roundRectPath(ctx, barX, barY, barW, barH, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fill();
      const fillW = Math.max(0, barW * clamp(b.hpShow, 0, 1));
      if (fillW > 0.5) {
        const hg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        hg.addColorStop(0, accent2);
        hg.addColorStop(0.75, accent);
        hg.addColorStop(1, '#ffe6a8');
        ctx.fillStyle = hg;
        roundRectPath(ctx, barX, barY, fillW, barH, 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX, barY, fillW, 1);
        ctx.globalAlpha = 1;
      }

      // Phase indicators.
      for (let i = 0; i < b.totalPhases; i++) {
        const px = barX + 2 + i * 9;
        const py = barY + barH + 8;
        ctx.fillStyle = i < b.phaseIndex ? rgba(accent, 0.8)
          : i === b.phaseIndex ? rgba(accent, 0.4) : 'rgba(255,255,255,0.16)';
        ctx.fillRect(px, py - 1.5, 5, 3);
      }

      // Ship name and classification.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${b.isMid ? 15 : 17}px ${SANS}`;
      ctx.shadowColor = rgba(accent, 0.65);
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#effbff';
      ctx.fillText(b.name, barX, barY + 33);
      ctx.shadowBlur = 0;
      const nameW = ctx.measureText(b.name).width;
      ctx.font = `8px ${SANS}`;
      ctx.fillStyle = rgba(accent, 0.7);
      ctx.fillText(b.isMid ? 'ESCORT' : 'HOSTILE', barX + nameW + 9, barY + 32);

      // Timer.
      const time = b.state === 'enter' ? null : Math.max(0, Math.ceil(b.timeLeft));
      if (time !== null) {
        ctx.font = `600 22px ${MONO}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = time <= 5 ? '#ff8d7a' : '#f0fbff';
        ctx.shadowColor = rgba(accent, 0.55);
        ctx.shadowBlur = 8;
        ctx.fillText(String(time).padStart(2, '0'), fx + FIELD_W - 20, barY + 33);
        ctx.shadowBlur = 0;
      }

      if (b.phase && (b.state === 'fight' || b.state === 'briefing')) {
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'right';
        if (b.perfect) {
          ctx.fillStyle = 'rgba(255,214,130,0.8)';
          ctx.fillText('NO-MISS ' + fmt(b.phaseBonus()), fx + FIELD_W - 20, barY + 47);
        } else {
          ctx.fillStyle = 'rgba(255,120,105,0.82)';
          ctx.fillText('NO-MISS LOST', fx + FIELD_W - 20, barY + 47);
        }
        ctx.textAlign = 'left';
        ctx.font = `9px ${MONO}`;
        ctx.fillStyle = rgba(accent, 0.62);
        ctx.fillText('PATTERN ' + String(b.phaseIndex + 1).padStart(2, '0') + ' // ' + b.phase.name,
          fx + 18, fy + FIELD_H - 12);
      }
      ctx.restore();
    }

    // Boss entrance warning.
    if (this.bossIntro && showBossUI) {
      const p = this.bossIntro;
      const fadeIn = clamp(p.t / 0.25, 0, 1);
      const fadeOut = clamp((p.life - p.t) / 0.5, 0, 1);
      const a = Math.min(fadeIn, fadeOut);
      const cx = fx + FIELD_W / 2;
      const cy = fy + 320;
      const accent = p.art === 'core' ? '#8ceaff' : '#ffc45e';
      ctx.save();
      ctx.globalAlpha = a;
      const band = ctx.createLinearGradient(fx, 0, fx + FIELD_W, 0);
      band.addColorStop(0, 'rgba(2,8,16,0)');
      band.addColorStop(0.18, 'rgba(2,8,16,0.66)');
      band.addColorStop(0.82, 'rgba(2,8,16,0.66)');
      band.addColorStop(1, 'rgba(2,8,16,0)');
      ctx.fillStyle = band;
      ctx.fillRect(fx, cy - 62, FIELD_W, 124);
      ctx.strokeStyle = rgba(accent, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx + 50, cy - 28);
      ctx.lineTo(fx + FIELD_W - 50, cy - 28);
      ctx.moveTo(fx + 50, cy + 46);
      ctx.lineTo(fx + FIELD_W - 50, cy + 46);
      ctx.stroke();
      drawSpacedText(ctx, p.isMid ? 'ALERT // ESCORT' : 'WARNING // HOSTILE', cx, cy - 43, 5,
        `600 10px ${MONO}`, accent, 'center', rgba(accent, 0.8));
      glowText(ctx, p.name, cx, cy + 2, `700 36px ${HEAD}`, '#f4fcff', rgba(accent, 0.8), 14, 'center');
      ctx.font = `11px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(214,244,255,0.65)';
      ctx.fillText(p.title, cx, cy + 28);
      ctx.restore();
    }

    // Named attack pattern declaration.
    if (showBossUI && this.boss && this.boss.state === 'briefing' && this.boss.phase) {
      const b = this.boss;
      const p = b.phase;
      const a = Math.min(clamp(b.stateT / 0.22, 0, 1), clamp((b.bannerTime - b.stateT) / 0.35, 0, 1));
      const accent = b.ringColor;
      const cx = fx + FIELD_W / 2;
      const cy = fy + 264;
      ctx.save();
      ctx.globalAlpha = a;
      const band = ctx.createLinearGradient(fx, 0, fx + FIELD_W, 0);
      band.addColorStop(0, 'rgba(2,8,16,0)');
      band.addColorStop(0.16, 'rgba(6,16,28,0.80)');
      band.addColorStop(0.84, 'rgba(6,16,28,0.80)');
      band.addColorStop(1, 'rgba(2,8,16,0)');
      ctx.fillStyle = band;
      ctx.fillRect(fx, cy - 62, FIELD_W, 128);
      ctx.strokeStyle = rgba(accent, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx + 44, cy - 26);
      ctx.lineTo(fx + FIELD_W - 44, cy - 26);
      ctx.moveTo(fx + 44, cy + 40);
      ctx.lineTo(fx + FIELD_W - 44, cy + 40);
      ctx.stroke();
      drawSpacedText(ctx, 'TACTICAL PATTERN', cx, cy - 43, 6,
        `600 10px ${MONO}`, accent, 'center', rgba(accent, 0.75));
      ctx.font = `9px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = rgba(accent, 0.55);
      ctx.fillText('P-' + String(b.phaseIndex + 1).padStart(2, '0') + ' / ' + String(b.totalPhases).padStart(2, '0'),
        fx + FIELD_W - 52, cy - 43);
      glowText(ctx, p.name, cx, cy + 2, `700 30px ${HEAD}`, '#f2fbff', rgba(accent, 0.8), 14, 'center');
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,215,140,0.82)';
      ctx.fillText('NO-MISS BONUS  ' + fmt(b.phaseBonus()), cx, cy + 31);
      ctx.restore();
    }

    // Phase result.
    if (this.phaseResult && showBossUI) {
      const p = this.phaseResult;
      const a = Math.min(clamp(p.t / 0.2, 0, 1), clamp((p.life - p.t) / 0.5, 0, 1));
      const cx = fx + FIELD_W / 2;
      const cy = fy + 348;
      const col = p.perfect ? '#ffd98c' : (p.byHp ? '#ff9a86' : '#ffb06a');
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(2,8,16,0.62)';
      roundRectPath(ctx, cx - 178, cy - 46, 356, 84, 4);
      ctx.fill();
      ctx.strokeStyle = rgba(col, 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (p.perfect) {
        drawSpacedText(ctx, 'PERFECT PHASE', cx, cy - 24, 4,
          `600 10px ${MONO}`, '#ffd98c', 'center', 'rgba(255,190,100,0.55)');
        glowText(ctx, 'NO-MISS +' + fmt(p.bonus), cx, cy + 6,
          `700 24px ${MONO}`, '#fff3d1', 'rgba(255,205,120,0.65)', 10, 'center');
        ctx.font = `8px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(205,235,245,0.48)';
        ctx.fillText(p.name, cx, cy + 27);
      } else {
        const label = p.byHp ? 'NO-MISS FAILED' : 'TIME LIMIT';
        drawSpacedText(ctx, label, cx, cy - 8, 4,
          `600 11px ${MONO}`, col, 'center', rgba(col, 0.35));
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(205,235,245,0.45)';
        ctx.fillText(p.name, cx, cy + 16);
      }
      ctx.restore();
    }

    // Short in-field notification.
    if (this.toast && showBossUI) {
      const t = this.toast;
      const a = Math.min(clamp(t.t / 0.2, 0, 1), clamp((t.life - t.t) / 0.4, 0, 1));
      const cx = fx + FIELD_W / 2;
      const cy = fy + 88;
      ctx.save();
      ctx.globalAlpha = a;
      const w = 250;
      ctx.fillStyle = 'rgba(3,10,20,0.72)';
      roundRectPath(ctx, cx - w / 2, cy - 24, w, 44, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,225,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `600 13px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#eafcff';
      ctx.fillText(t.text, cx, cy - 4);
      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = 'rgba(180,230,245,0.6)';
      ctx.fillText(t.sub || '', cx, cy + 12);
      ctx.restore();
    }
  }

  /* ---------------- HUD ---------------- */

  drawHUD(ctx) {
    const x = 624;
    const y = 24;
    const w = 312;
    const h = 672;
    const p = this.player;

    ctx.save();
    const panel = ctx.createLinearGradient(x, y, x, y + h);
    panel.addColorStop(0, 'rgba(9,24,38,0.94)');
    panel.addColorStop(0.55, 'rgba(6,16,28,0.95)');
    panel.addColorStop(1, 'rgba(3,9,16,0.96)');
    ctx.fillStyle = panel;
    roundRectPath(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,225,255,0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const shine = ctx.createLinearGradient(x, y, x + w, y);
    shine.addColorStop(0, 'rgba(120,225,255,0)');
    shine.addColorStop(0.5, 'rgba(150,235,255,0.45)');
    shine.addColorStop(1, 'rgba(120,225,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(x + 18, y + 1, w - 36, 1);

    // Brand.
    drawSpacedText(ctx, 'STARFALL', x + w / 2, y + 33, 3,
      `700 23px ${HEAD}`, '#f3fcff', 'center', 'rgba(110,225,255,0.8)');
    drawSpacedText(ctx, 'PROTOCOL', x + w / 2, y + 53, 4,
      `9px ${MONO}`, 'rgba(140,225,245,0.62)', 'center');
    this.hudLine(ctx, x + 18, x + w - 18, y + 68);

    // High score.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `9px ${SANS}`;
    ctx.fillStyle = 'rgba(170,210,225,0.5)';
    ctx.fillText('HI-SCORE', x + 20, y + 88);
    ctx.textAlign = 'right';
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = 'rgba(200,235,245,0.8)';
    ctx.fillText(padScore(this.highScore), x + w - 20, y + 89);

    // Score.
    ctx.textAlign = 'left';
    ctx.font = `10px ${SANS}`;
    ctx.fillStyle = 'rgba(130,220,245,0.65)';
    ctx.fillText('SCORE', x + 20, y + 112);
    ctx.textAlign = 'right';
    ctx.font = `600 28px ${MONO}`;
    ctx.fillStyle = '#f2fcff';
    ctx.shadowColor = 'rgba(90,215,255,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(padScore(this.displayScore), x + w - 18, y + 143);
    ctx.shadowBlur = 0;
    this.hudLine(ctx, x + 18, x + w - 18, y + 158);

    // Ship status.
    this.hudSectionLabel(ctx, x + 20, y + 178, 'SHIP');
    ctx.textAlign = 'right';
    ctx.font = `9px ${SANS}`;
    ctx.fillStyle = 'rgba(170,215,230,0.55)';
    ctx.fillText('LIVES', x + 190, y + 199);
    ctx.fillText('BOMB', x + 190, y + 219);
    ctx.textAlign = 'left';
    ctx.font = `600 14px ${MONO}`;
    ctx.fillStyle = '#e8fbff';
    ctx.fillText('× ' + Math.max(0, p.lives), x + 196, y + 203);
    ctx.fillText('× ' + Math.max(0, p.bombs), x + 196, y + 223);

    for (let i = 0; i < Math.max(0, p.lives); i++) {
      const px = x + 27 + i * 18;
      const py = y + 194;
      ctx.save();
      ctx.fillStyle = '#63e2ff';
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px + 5, py + 3.5);
      ctx.lineTo(px, py + 1.2);
      ctx.lineTo(px - 5, py + 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,252,255,0.9)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < Math.max(0, p.bombs); i++) {
      const px = x + 27 + i * 18;
      const py = y + 214;
      ctx.save();
      ctx.fillStyle = '#ffc45e';
      starPath(ctx, px, py, 5.6, 2.2, 4, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,210,0.8)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // Power.
    this.hudSectionLabel(ctx, x + 20, y + 252, 'POWER');
    ctx.textAlign = 'right';
    ctx.font = `11px ${MONO}`;
    ctx.fillStyle = p.power >= 4 ? '#ffd98c' : 'rgba(180,235,245,0.8)';
    ctx.fillText(p.power.toFixed(2) + ' / 4.00', x + w - 20, y + 256);

    const gx = x + 20;
    const gy = y + 266;
    const gw = w - 40;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRectPath(ctx, gx, gy, gw, 8, 2);
    ctx.fill();
    const pw = clamp(p.power / 4, 0, 1) * gw;
    if (pw > 1) {
      const pg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
      pg.addColorStop(0, '#2f8fff');
      pg.addColorStop(0.7, '#63e2ff');
      pg.addColorStop(1, p.power >= 4 ? '#ffd27a' : '#9ff3ff');
      ctx.fillStyle = pg;
      roundRectPath(ctx, gx, gy, pw, 8, 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx, gy, pw, 1.5);
      ctx.globalAlpha = 1;
    }
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = 'rgba(3,12,20,0.7)';
      ctx.fillRect(gx + (gw / 4) * i - 0.5, gy, 1, 8);
    }
    if (p.power >= 4) {
      ctx.textAlign = 'center';
      ctx.font = `600 8px ${MONO}`;
      ctx.fillStyle = '#ffdf9e';
      ctx.fillText('MAX POWER', gx + gw / 2, gy + 19);
    }

    this.hudLine(ctx, x + 18, x + w - 18, y + 296);

    // Near misses.
    this.hudSectionLabel(ctx, x + 20, y + 316, 'NEAR MISS');
    ctx.textAlign = 'right';
    ctx.font = `600 ${this.nearMissPulse > 0 ? 19 : 17}px ${MONO}`;
    ctx.fillStyle = this.nearMissPulse > 0 ? '#baf7ff' : '#8fe8ff';
    ctx.fillText(padScore(p.nearMiss, 6), x + w - 20, y + 320);
    let sy = y + 346;

    this.hudSectionLabel(ctx, x + 20, sy, 'STAGE');
    ctx.font = `600 15px ${SANS}`;
    ctx.fillStyle = '#e9faff';
    ctx.fillText(this.stage ? 'STAGE ' + this.stage.id : 'STAGE -', x + w - 20, sy + 4);
    if (this.stage) {
      ctx.font = `11px ${SANS}`;
      ctx.fillStyle = 'rgba(175,225,240,0.55)';
      ctx.fillText(this.stage.name, x + w - 20, sy + 22);
    }
    sy += 40;
    this.hudSectionLabel(ctx, x + 20, sy, 'DIFFICULTY');
    ctx.font = `600 15px ${SANS}`;
    ctx.fillStyle = this.diff.color;
    ctx.fillText(this.diff.name, x + w - 20, sy + 4);
    ctx.font = `10px ${SANS}`;
    ctx.fillStyle = 'rgba(180,220,235,0.5)';
    ctx.fillText(this.diff.jp, x + w - 20, sy + 22);

    this.hudLine(ctx, x + 18, x + w - 18, y + 404);

    // Controls.
    this.hudSectionLabel(ctx, x + 20, y + 426, 'CONTROLS');
    const keyX = x + 20;
    drawKeyHint(ctx, keyX, y + 448, '矢印 / WASD', '移動');
    drawKeyHint(ctx, keyX, y + 470, 'SHIFT', '低速・照準');
    drawKeyHint(ctx, keyX, y + 492, 'Z', 'ショット');
    drawKeyHint(ctx, keyX, y + 514, 'X', 'ボム');
    drawKeyHint(ctx, keyX, y + 536, 'ESC / P', 'ポーズ');
    drawKeyHint(ctx, keyX, y + 558, 'M', 'サウンド ON/OFF');

    this.hudLine(ctx, x + 18, x + w - 18, y + 585);
    drawSpacedText(ctx, 'F11  FULLSCREEN', x + w / 2, y + 603, 2,
      `9px ${MONO}`, 'rgba(145,220,240,0.42)', 'center');
    drawSpacedText(ctx, 'VERTICAL SHOOTER', x + w / 2, y + 624, 2,
      `8px ${MONO}`, 'rgba(145,220,240,0.30)', 'center');
    ctx.textAlign = 'center';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = AudioSys.muted ? 'rgba(255,150,130,0.7)' : 'rgba(150,225,245,0.4)';
    ctx.fillText((AudioSys.muted ? 'AUDIO OFF' : 'AUDIO ON') + '  //  v1.0', x + w / 2, y + 648);

    ctx.restore();
  }

  hudSectionLabel(ctx, x, y, text) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 9px ${MONO}`;
    ctx.fillStyle = 'rgba(125,225,250,0.55)';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  hudLine(ctx, x1, x2, y) {
    ctx.save();
    const g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, 'rgba(110,215,245,0.03)');
    g.addColorStop(0.5, 'rgba(120,225,255,0.22)');
    g.addColorStop(1, 'rgba(110,215,245,0.03)');
    ctx.fillStyle = g;
    ctx.fillRect(x1, y, x2 - x1, 1);
    ctx.restore();
  }

  /* ---------------- overlays ---------------- */

  drawIntroOverlay(ctx) {
    const t = this.introT;
    const dur = this.introDuration;
    const fade = Math.min(clamp(t / 0.45, 0, 1), clamp((dur - t) / 0.5, 0, 1));
    if (fade <= 0) return;
    const cx = FIELD_X + FIELD_W / 2;
    const cy = FIELD_Y + FIELD_H / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    ctx.clip();
    ctx.fillStyle = `rgba(2,7,15,${0.58 * fade})`;
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

    // Large faint sector number.
    ctx.globalAlpha = fade * 0.12;
    ctx.font = `600 190px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6ee6ff';
    ctx.fillText(String(this.stage.id).padStart(2, '0'), cx, cy + 22);

    ctx.globalAlpha = fade;
    drawSpacedText(ctx, 'STAGE ' + String(this.stage.id).padStart(2, '0'), cx, cy - 112, 7,
      `600 11px ${MONO}`, '#8fe8ff', 'center', 'rgba(80,210,255,0.55)');
    ctx.strokeStyle = 'rgba(120,225,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 150, cy - 88);
    ctx.lineTo(cx - 24, cy - 88);
    ctx.moveTo(cx + 24, cy - 88);
    ctx.lineTo(cx + 150, cy - 88);
    ctx.stroke();
    ctx.fillStyle = '#8fe8ff';
    diamondPath(ctx, cx - 16, cy - 88, 3, 3);
    ctx.fill();
    diamondPath(ctx, cx + 16, cy - 88, 3, 3);
    ctx.fill();

    glowText(ctx, this.stage.name, cx, cy - 38, `700 42px ${HEAD}`, '#f1fcff', 'rgba(80,205,255,0.55)', 18, 'center');
    ctx.font = `13px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(190,230,242,0.72)';
    ctx.fillText(this.stage.tagline, cx, cy + 4);
    drawSpacedText(ctx, this.stage.en, cx, cy + 40, 2.0,
      `9px ${MONO}`, 'rgba(145,210,228,0.45)', 'center');

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = `rgba(130,220,245,${0.35 + 0.2 * Math.sin(this.time * 4)})`;
    ctx.fillText('Z : SKIP', cx, FIELD_Y + FIELD_H - 42);
    ctx.restore();
  }

  drawPauseOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(1,5,12,0.76)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const pw = 480;
    const ph = 330;
    ctx.fillStyle = 'rgba(5,15,26,0.92)';
    roundRectPath(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,225,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,225,255,0.5)';
    ctx.fillRect(cx - pw / 2 + 28, cy - ph / 2, pw - 56, 1);

    drawSpacedText(ctx, 'SYSTEM HOLD', cx, cy - 126, 6,
      `9px ${MONO}`, 'rgba(120,220,245,0.55)', 'center');
    glowText(ctx, 'PAUSED', cx, cy - 88, `700 42px ${HEAD}`, '#f1fcff', 'rgba(80,205,255,0.55)', 16, 'center');

    const items = [
      ['ESC / P', '再開'],
      ['R', 'このエリアをリトライ'],
      ['Q', 'タイトルへ'],
      ['M', AudioSys.muted ? 'サウンド ON' : 'サウンド OFF'],
    ];
    items.forEach((row, i) => {
      const yy = cy - 28 + i * 34;
      ctx.font = `600 11px ${MONO}`;
      ctx.fillStyle = '#8fe8ff';
      ctx.textAlign = 'right';
      ctx.fillText(row[0], cx - 18, yy);
      ctx.font = `13px ${SANS}`;
      ctx.fillStyle = 'rgba(215,240,248,0.8)';
      ctx.textAlign = 'left';
      ctx.fillText(row[1], cx + 18, yy);
    });
    ctx.textAlign = 'center';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = 'rgba(130,205,225,0.35)';
    ctx.fillText('SIMULATION SUSPENDED', cx, cy + 138);
    ctx.restore();
  }

  drawStageClearOverlay(ctx) {
    const info = this.clearInfo;
    if (!info) return;
    const a = clamp(info.t / 0.4, 0, 1);
    const cx = FIELD_X + FIELD_W / 2;
    const cy = FIELD_Y + FIELD_H / 2;

    ctx.save();
    ctx.fillStyle = `rgba(2,6,12,${0.54 * a})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pw = 470;
    const ph = 356;
    const px = cx - pw / 2;
    const py = cy - ph / 2;
    ctx.globalAlpha = a;
    const panel = ctx.createLinearGradient(0, py, 0, py + ph);
    panel.addColorStop(0, 'rgba(8,24,38,0.96)');
    panel.addColorStop(1, 'rgba(3,10,18,0.97)');
    ctx.fillStyle = panel;
    roundRectPath(ctx, px, py, pw, ph, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,225,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,225,255,0.4)';
    ctx.fillRect(px + 24, py, pw - 48, 1);

    glowText(ctx, info.isLast ? 'FINAL AREA CLEAR' : 'AREA CLEAR', cx, py + 50,
      `700 30px ${HEAD}`, '#f1fcff', 'rgba(80,205,255,0.55)', 14, 'center');
    drawSpacedText(ctx, this.stage ? this.stage.en : '', cx, py + 79, 1.8,
      `9px ${MONO}`, 'rgba(140,210,230,0.48)', 'center');

    info.rows.forEach((row, i) => {
      const yy = py + 124 + i * 32;
      ctx.font = `11px ${SANS}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(185,225,238,0.68)';
      ctx.fillText(row[0], px + 58, yy);
      ctx.font = `14px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#eafcff';
      ctx.fillText(fmt(row[1]), px + pw - 58, yy);
    });

    ctx.strokeStyle = 'rgba(120,225,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(px + 58, py + 264);
    ctx.lineTo(px + pw - 58, py + 264);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('TOTAL BONUS', px + 58, py + 292);
    ctx.textAlign = 'right';
    glowText(ctx, '+' + fmt(info.total), px + pw - 58, py + 293,
      `600 24px ${MONO}`, '#fff3d1', 'rgba(255,200,110,0.7)', 12, 'right');

    ctx.textAlign = 'center';
    ctx.font = `10px ${MONO}`;
    const nextText = info.isLast ? 'DEBRIEF...' : 'NEXT AREA...';
    ctx.fillStyle = `rgba(180,235,250,${0.5 + 0.3 * Math.sin(this.time * 4)})`;
    ctx.fillText(info.t > 1.15 ? 'Z : ' + nextText : nextText, cx, py + ph - 26);
    ctx.restore();
  }

  drawGameOverOverlay(ctx) {
    const a = clamp(this.stateT / 0.4, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(2,3,7,${0.78 * a})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cx = FIELD_X + FIELD_W / 2;
    const cy = FIELD_Y + FIELD_H / 2;
    ctx.globalAlpha = a;
    glowText(ctx, 'MISSION FAILED', cx, cy - 118, `700 46px ${HEAD}`, '#ffe4da', 'rgba(255,85,55,0.85)', 22, 'center');

    ctx.strokeStyle = 'rgba(255,130,100,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 190, cy - 82);
    ctx.lineTo(cx - 20, cy - 82);
    ctx.moveTo(cx + 20, cy - 82);
    ctx.lineTo(cx + 190, cy - 82);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `13px ${SANS}`;
    ctx.fillStyle = 'rgba(230,235,240,0.7)';
    ctx.fillText('機体ロスト。作戦を継続しますか？', cx, cy - 48);

    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = 'rgba(160,215,230,0.55)';
    ctx.fillText('SCORE', cx, cy + 8);
    ctx.font = `600 27px ${MONO}`;
    ctx.fillStyle = '#f2fcff';
    ctx.fillText(padScore(this.score), cx, cy + 36);

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = 'rgba(170,220,235,0.55)';
    ctx.fillText('STAGE ' + (this.stage ? this.stage.id : '-') + '    CONTINUES ' + this.continues, cx, cy + 62);

    const blink = 0.55 + 0.45 * Math.sin(this.time * 4);
    ctx.globalAlpha = a * blink;
    ctx.font = `600 14px ${MONO}`;
    ctx.fillStyle = '#ffc45e';
    ctx.fillText('CONTINUE?', cx, cy + 116);
    ctx.globalAlpha = a;
    ctx.font = `11px ${SANS}`;
    ctx.fillStyle = 'rgba(225,240,245,0.75)';
    ctx.fillText('Z / ENTER : コンティニュー', cx, cy + 148);
    ctx.fillStyle = 'rgba(185,215,225,0.5)';
    ctx.fillText('ESC : タイトルへ', cx, cy + 170);
    ctx.restore();
  }

  /* ---------------- title ---------------- */

  drawTitle(ctx) {
    this.background.draw(ctx);

    const wash = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    wash.addColorStop(0, 'rgba(2,6,13,0.36)');
    wash.addColorStop(0.55, 'rgba(2,6,13,0.10)');
    wash.addColorStop(1, 'rgba(1,4,9,0.60)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cx = VIEW_W / 2;

    // Orbital decoration.
    ctx.save();
    for (const tb of this._titleBullets) {
      const ringR = tb.ring === 0 ? 315 : 230;
      const a = this.time * (tb.ring === 0 ? 0.09 : -0.13) + tb.phase * TAU;
      const wob = Math.sin(this.time * 0.6 + tb.wob) * 16;
      const x = cx + Math.cos(a) * (ringR + wob) * 1.28;
      const y = 300 + Math.sin(a) * (ringR + wob) * 0.52;
      const spr = Sprites.bullet(tb.color, tb.shape);
      const size = tb.ring === 0 ? 24 : 19;
      ctx.globalAlpha = tb.ring === 0 ? 0.16 : 0.11;
      ctx.drawImage(spr.img, x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Holographic target reticle.
    ctx.save();
    ctx.translate(cx, 272);
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#7fe7ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 182, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, 156, 0, TAU);
    ctx.stroke();
    ctx.rotate(this.time * 0.05);
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * TAU);
      ctx.beginPath();
      ctx.moveTo(-16, -190);
      ctx.lineTo(0, -190);
      ctx.lineTo(0, -174);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Logo.
    const logoGrad = ctx.createLinearGradient(0, 102, 0, 196);
    logoGrad.addColorStop(0, '#ffffff');
    logoGrad.addColorStop(0.5, '#e7fbff');
    logoGrad.addColorStop(1, '#7ddfff');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 68px ${HEAD}`;
    ctx.shadowColor = 'rgba(80,205,255,0.9)';
    ctx.shadowBlur = 28;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillStyle = logoGrad;
    ctx.fillText('STARFALL', cx, 146);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(210,248,255,0.38)';
    ctx.lineWidth = 1;
    ctx.strokeText('STARFALL', cx, 146);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();

    drawSpacedText(ctx, 'PROTOCOL', cx, 199, 10,
      `600 18px ${HEAD}`, '#8fe8ff', 'center', 'rgba(70,205,255,0.55)');
    drawSpacedText(ctx, 'V E R T I C A L   S H O O T E R', cx, 224, 1.8,
      `9px ${MONO}`, 'rgba(150,220,240,0.5)', 'center');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `12px ${SANS}`;
    ctx.fillStyle = 'rgba(185,230,242,0.62)';
    ctx.fillText('軌道防衛戦、開始。', cx, 252);

    // Difficulty panel.
    const pw = 470;
    const ph = 206;
    const px = cx - pw / 2;
    const py = 292;
    ctx.save();
    ctx.fillStyle = 'rgba(3,12,21,0.62)';
    roundRectPath(ctx, px, py, pw, ph, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(115,220,250,0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const topGlow = ctx.createLinearGradient(px, 0, px + pw, 0);
    topGlow.addColorStop(0, 'rgba(100,220,255,0)');
    topGlow.addColorStop(0.5, 'rgba(130,230,255,0.55)');
    topGlow.addColorStop(1, 'rgba(100,220,255,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(px + 20, py, pw - 40, 1);
    ctx.restore();

    drawSpacedText(ctx, 'DIFFICULTY', cx, py + 28, 4,
      `600 9px ${MONO}`, 'rgba(130,215,240,0.6)', 'center');

    const diff = this.diff;
    const dy = py + 72;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 33px ${HEAD}`;
    ctx.shadowColor = rgba(diff.color, 0.85);
    ctx.shadowBlur = 16;
    ctx.fillStyle = diff.color;
    ctx.fillText(diff.name, cx, dy);
    ctx.shadowBlur = 0;
    ctx.font = `10px ${SANS}`;
    ctx.fillStyle = 'rgba(190,225,235,0.55)';
    ctx.fillText(diff.jp, cx, dy + 23);
    ctx.restore();

    const bob = Math.sin(this.time * 3) * 2;
    for (const dir of [-1, 1]) {
      const ax = cx + dir * 166;
      ctx.save();
      ctx.fillStyle = `rgba(130,225,255,${0.52 + 0.18 * Math.sin(this.time * 3)})`;
      ctx.beginPath();
      if (dir < 0) {
        ctx.moveTo(ax - 6 - bob, dy);
        ctx.lineTo(ax + 6 - bob, dy - 8);
        ctx.lineTo(ax + 6 - bob, dy + 8);
      } else {
        ctx.moveTo(ax + 6 + bob, dy);
        ctx.lineTo(ax - 6 + bob, dy - 8);
        ctx.lineTo(ax - 6 + bob, dy + 8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const ix = cx + (i - (DIFFICULTIES.length - 1) / 2) * 28;
      const iy = dy + 48;
      const active = i === this.diffIndex;
      ctx.save();
      ctx.fillStyle = active ? diff.color : 'rgba(150,220,240,0.18)';
      ctx.fillRect(ix - 3.5, iy - 3.5, 7, 7);
      if (active) {
        ctx.strokeStyle = 'rgba(235,253,255,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ix - 6, iy - 6, 12, 12);
      }
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.font = `12px ${SANS}`;
    ctx.fillStyle = 'rgba(195,230,242,0.7)';
    ctx.fillText(diff.desc, cx, py + 169);
    drawSpacedText(ctx, 'ARROW KEYS  :  CHANGE', cx, py + 192, 2.2,
      `9px ${MONO}`, 'rgba(130,205,225,0.4)', 'center');

    // Start.
    const blink = 0.55 + 0.45 * Math.sin(this.time * 3.2);
    ctx.save();
    ctx.globalAlpha = blink;
    drawSpacedText(ctx, 'PRESS  Z / ENTER  TO START', cx, 542, 3,
      `600 15px ${MONO}`, '#eafcff', 'center', 'rgba(90,215,255,0.75)');
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = 'rgba(140,210,230,0.45)';
    ctx.fillText('HI-SCORE', cx, 583);
    ctx.font = `600 19px ${MONO}`;
    ctx.fillStyle = 'rgba(225,248,255,0.85)';
    ctx.fillText(padScore(this.highScore), cx, 606);

    this.hudLine(ctx, cx - 300, cx + 300, 632);
    ctx.textAlign = 'center';
    ctx.font = `10px ${SANS}`;
    ctx.fillStyle = 'rgba(170,215,230,0.45)';
    ctx.fillText('移動  矢印 / WASD      低速  SHIFT      ショット  Z      ボム  X      ポーズ  ESC', cx, 654);

    ctx.textAlign = 'center';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = 'rgba(150,220,238,0.38)';
    ctx.fillText('© 2026 Studio NØSa', cx, 681);

    ctx.textAlign = 'left';
    ctx.font = `9px ${MONO}`;
    ctx.fillStyle = 'rgba(130,205,225,0.3)';
    ctx.fillText('ORBITAL DEFENSE COMMAND', 24, VIEW_H - 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(130,205,225,0.32)';
    ctx.fillText('F11 FULLSCREEN   //   ' + (AudioSys.muted ? 'AUDIO OFF' : 'AUDIO ON') + '   //   v1.0', VIEW_W - 24, VIEW_H - 17);

    if (this.muteNotice > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.muteNotice);
      ctx.textAlign = 'right';
      ctx.font = `600 10px ${MONO}`;
      ctx.fillStyle = '#8fe8ff';
      ctx.fillText(AudioSys.muted ? 'AUDIO OFF' : 'AUDIO ON', VIEW_W - 24, VIEW_H - 36);
      ctx.restore();
    }
  }

  /* ---------------- ending ---------------- */

  drawAllClear(ctx) {
    this.background.draw(ctx);
    const wash = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    wash.addColorStop(0, 'rgba(2,6,13,0.48)');
    wash.addColorStop(0.5, 'rgba(2,6,13,0.18)');
    wash.addColorStop(1, 'rgba(1,4,9,0.68)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cx = VIEW_W / 2;
    const a = clamp(this.stateT / 1.1, 0, 1);

    ctx.save();
    ctx.globalAlpha = a;
    drawSpacedText(ctx, 'MISSION DEBRIEF', cx, 112, 5,
      `600 10px ${MONO}`, 'rgba(140,225,250,0.62)', 'center', 'rgba(80,200,255,0.4)');

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 52px ${HEAD}`;
    const grad = ctx.createLinearGradient(0, 148, 0, 212);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#e2fbff');
    grad.addColorStop(1, '#7fdcff');
    ctx.shadowColor = 'rgba(80,205,255,0.75)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = grad;
    ctx.fillText('MISSION COMPLETE', cx, 178);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(220,250,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeText('MISSION COMPLETE', cx, 178);
    ctx.restore();

    drawSpacedText(ctx, '作 戦 完 了', cx, 222, 8,
      `600 12px ${SANS}`, 'rgba(180,238,250,0.7)', 'center');

    ctx.strokeStyle = 'rgba(120,225,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 260, 248);
    ctx.lineTo(cx - 30, 248);
    ctx.moveTo(cx + 30, 248);
    ctx.lineTo(cx + 260, 248);
    ctx.stroke();
    ctx.fillStyle = 'rgba(140,230,255,0.6)';
    diamondPath(ctx, cx - 20, 248, 3, 3);
    ctx.fill();
    diamondPath(ctx, cx + 20, 248, 3, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = `14px ${SANS}`;
    ctx.fillStyle = 'rgba(210,240,248,0.82)';
    ctx.fillText('敵中枢を制圧。軌道は静寂を取り戻した。', cx, 282);
    ctx.font = `12px ${SANS}`;
    ctx.fillStyle = 'rgba(175,220,235,0.55)';
    ctx.fillText('全ユニット、帰還せよ。——作戦、完了。', cx, 306);

    // Mission results.
    const pw = 620;
    const ph = 246;
    const px = cx - pw / 2;
    const py = 340;
    ctx.fillStyle = 'rgba(3,12,21,0.66)';
    roundRectPath(ctx, px, py, pw, ph, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,225,255,0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,225,255,0.35)';
    ctx.fillRect(px + 26, py, pw - 52, 1);

    const stats = [
      ['FINAL SCORE', fmt(this.score)],
      ['HOSTILES DOWN', fmt(this.enemiesKilled)],
      ['NEAR MISSES', fmt(this.player.nearMiss)],
      ['PERFECT PHASES', this.perfectClears + ' / ' + this.totalPatterns],
      ['MISSES', String(this.player.deaths)],
      ['CONTINUES', String(this.continues)],
    ];
    stats.forEach((row, i) => {
      const col = i % 2;
      const line = Math.floor(i / 2);
      const xx = px + 42 + col * 214;
      const yy = py + 44 + line * 64;
      ctx.textAlign = 'left';
      ctx.font = `8px ${MONO}`;
      ctx.fillStyle = 'rgba(150,215,230,0.5)';
      ctx.fillText(row[0], xx, yy);
      ctx.font = `600 19px ${MONO}`;
      ctx.fillStyle = i === 0 ? '#ffe3a8' : '#ecfcff';
      ctx.fillText(row[1], xx, yy + 24);
    });

    // Rank badge.
    ctx.save();
    const rankX = px + pw - 78;
    const rankY = py + ph / 2;
    ctx.translate(rankX, rankY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(255,210,140,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    ctx.stroke();
    ctx.font = `600 9px ${MONO}`;
    ctx.fillStyle = 'rgba(255,220,160,0.55)';
    ctx.fillText('RANK', 0, -22);
    ctx.font = `700 42px ${HEAD}`;
    ctx.shadowColor = 'rgba(255,200,110,0.7)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffe3ad';
    ctx.fillText(this.allClearInfo ? this.allClearInfo.rank : 'A', 0, 10);
    ctx.restore();

    drawSpacedText(ctx, 'THANK YOU FOR PLAYING', cx, 624, 4,
      `600 10px ${MONO}`, 'rgba(180,235,248,0.55)', 'center', 'rgba(80,200,255,0.35)');
    const blink = 0.5 + 0.5 * Math.sin(this.time * 3);
    ctx.globalAlpha = a * blink;
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(220,250,255,0.8)';
    ctx.fillText('Z / ENTER : TITLE', cx, 658);
    ctx.restore();
  }


}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  if (canvas) new Game(canvas);
});
