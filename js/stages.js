'use strict';

/* ------------------------------------------------------------------
 *  Stage scripts & boss definitions.
 *  Timelines are in seconds; events run in order. A midboss freezes
 *  the timeline until it is defeated (see Game.updateStage).
 * ------------------------------------------------------------------ */

/* ============================ BOSSES ============================ */

const MID_CRUISER = {
  name: 'WATCHER-01',
  title: 'ESCORT DESTROYER',
  art: 'cruiser',
  isMid: true,
  phases: [
    {
      name: 'SUPPRESSION FIRE',
      hp: 650,
      time: 30,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.8) * 135;
        b.y = 148 + Math.sin(t * 1.25) * 14;
      },
      pattern(b, t, g, rt) {
        if (rt.ringT === undefined) { rt.ringT = 1.0; rt.fanT = 2.0; rt.aimT = 3.4; rt.rot = 0; }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.ringT) {
          rt.ringT = t + 1.9;
          rt.rot += 0.19;
          Patterns.ring(g, bx, by, {
            count: 13, speed: 102, angle: rt.rot,
            color: ['pink', 'purple'], shape: 'orb', size: 5.2,
          });
        }
        if (t >= rt.fanT) {
          rt.fanT = t + 1.7;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.45, speed: 150,
            color: 'red', shape: 'rice', size: 4.8,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 3.2;
          Patterns.fan(g, bx, by, {
            count: 1, speed: 280, color: 'yellow', shape: 'kunai', size: 4.4,
          });
        }
      },
    },
  ],
};

const BOSS_CRUISER = {
  name: 'AEGIS',
  title: 'HEAVY ASSAULT CRUISER',
  art: 'cruiser',
  phases: [
    {
      name: 'OPENING VOLLEY',
      hp: 800,
      time: 26,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.55) * 158;
        b.y = 150 + Math.sin(t * 1.15) * 16;
      },
      pattern(b, t, g, rt) {
        if (rt.burstT === undefined) { rt.burstT = 1.0; rt.fanT = 1.8; rt.aimT = 3.2; rt.rot = rnd(TAU); }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.burstT) {
          rt.burstT = t + 1.9;
          rt.rot += 0.21;
          Patterns.ring(g, bx, by, {
            count: 16, speed: 105, angle: rt.rot,
            color: ['pink', 'purple'], shape: 'orb', size: 5.4,
          });
        }
        if (t >= rt.fanT) {
          rt.fanT = t + 1.5;
          Patterns.fan(g, bx, by, {
            count: 4, spread: 0.5, speed: 165,
            color: 'red', shape: 'rice', size: 5,
            offset: Math.sin(t * 1.7) * 0.06,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 2.6;
          Patterns.fan(g, bx, by, {
            count: 1, speed: 320, color: 'yellow', shape: 'kunai', size: 4.6,
          });
        }
      },
    },
    {
      name: 'SPIRAL GRID',
      hp: 1080,
      time: 32,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.9) * 92;
        b.y = 148 + Math.cos(t * 0.8) * 12;
      },
      pattern(b, t, g, rt) {
        if (rt.burstT === undefined) { rt.burstT = 1.0; rt.spin = 0; rt.ringT = 2.2; rt.aimT = 3.4; }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.burstT) {
          rt.burstT = t + 0.17;
          rt.spin += 0.19;
          Patterns.spiralBurst(g, bx, by, {
            arms: 4, angle: rt.spin, speed: 112,
            color: ['pink', 'purple', 'white', 'pink'], shape: 'rice', size: 5.2,
          });
        }
        if (t >= rt.ringT) {
          rt.ringT = t + 2.7;
          Patterns.ring(g, bx, by, {
            count: 14, speed: 84, angle: -rt.spin * 0.5,
            color: 'red', shape: 'orb', size: 5.6,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 3.3;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.3, speed: 210,
            color: 'yellow', shape: 'rice', size: 4.8,
          });
        }
      },
    },
    {
      name: 'CURVED BARRAGE',
      hp: 1240,
      time: 34,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.58) * 185;
        b.y = 138 + Math.abs(Math.sin(t * 0.58)) * 26;
      },
      pattern(b, t, g, rt) {
        if (rt.petalT === undefined) {
          rt.petalT = 0.9; rt.rainT = 0.2; rt.ringT = 2.6; rt.aimT = 3.8; rt.dir = 1;
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.petalT) {
          rt.petalT = t + 1.15;
          rt.dir *= -1;
          Patterns.fan(g, bx, by, {
            count: 5, spread: 0.9, speed: 152, angVel: 0.28 * rt.dir,
            color: ['pink', 'purple'], shape: 'rice', size: 5,
          });
        }
        if (t >= rt.rainT) {
          rt.rainT = t + 0.5;
          Patterns.rain(g, {
            count: 1.5, color: ['pink', 'white'], shape: 'rice',
            size: 4.8, speed: rnd(75, 120), angVel: rnd(-0.6, 0.6), spread: 0.35,
          });
        }
        if (t >= rt.ringT) {
          rt.ringT = t + 3.6;
          Patterns.ring(g, bx, by, {
            count: 16, speed: 80, angle: t * 0.5,
            color: 'red', shape: 'orb', size: 5,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 2.7;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.25, speed: 260,
            color: 'yellow', shape: 'kunai', size: 4.4,
          });
        }
      },
    },
    {
      name: 'OVERDRIVE',
      hp: 1520,
      time: 42,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.33) * 122;
        b.y = 150 + Math.sin(t * 0.9) * 14;
      },
      pattern(b, t, g, rt) {
        if (rt.gapT === undefined) {
          rt.gapT = 1.2; rt.spiralT = 1.8; rt.aimT = 2.6; rt.bigT = 4.4;
          rt.gapRot = rnd(TAU); rt.spiral = 0;
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.gapT) {
          rt.gapT = t + 2.4;
          rt.gapRot += 0.5;
          Patterns.gapRing(g, bx, by, {
            count: 24, gap: 1.15, speed: 95, angle: rt.gapRot,
            color: ['pink', 'red'], shape: 'orb', size: 5.2,
          });
        }
        if (t >= rt.spiralT) {
          rt.spiralT = t + 0.24;
          rt.spiral -= 0.26;
          Patterns.spiralBurst(g, bx, by, {
            arms: 3, angle: rt.spiral, speed: 135,
            color: ['purple', 'pink'], shape: 'rice', size: 5.0,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 3.0;
          Patterns.fan(g, bx, by, {
            count: 5, spread: 0.6, speed: 230,
            color: 'yellow', shape: 'kunai', size: 4.5,
          });
        }
        if (t >= rt.bigT) {
          rt.bigT = t + 4.6;
          Patterns.ring(g, bx, by, {
            count: 10, speed: 62, angle: -rt.spiral * 0.6,
            color: 'white', shape: 'bubble', size: 9,
          });
        }
      },
    },
  ],
};

/* ------------------------------ stage 2 ------------------------------ */

const MID_WARDEN = {
  name: 'GATEKEEPER',
  title: 'ORBITAL DEFENSE UNIT',
  art: 'core',
  isMid: true,
  phases: [
    {
      name: 'LASER SCREEN',
      hp: 760,
      time: 30,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.75) * 145;
        b.y = 146 + Math.cos(t * 1.1) * 14;
      },
      pattern(b, t, g, rt) {
        if (rt.aimT === undefined) {
          rt.aimT = 0.9; rt.ringT = 1.7; rt.bubbleT = 4.5; rt.rot = rnd(TAU);
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.aimT) {
          rt.aimT = t + 1.25;
          Patterns.fan(g, bx, by, {
            count: 2, spread: 0.22, speed: 280,
            color: ['cyan', 'white'], shape: 'kunai', size: 4.4,
          });
        }
        if (t >= rt.ringT) {
          rt.ringT = t + 1.9;
          rt.rot += 0.2;
          Patterns.ring(g, bx, by, {
            count: 15, speed: 108, angle: rt.rot,
            color: ['blue', 'cyan'], shape: 'orb', size: 5.2,
          });
        }
        if (t >= rt.bubbleT) {
          rt.bubbleT = t + 4.5;
          Patterns.ring(g, bx, by, {
            count: 9, speed: 62, angle: -rt.rot,
            color: 'white', shape: 'bubble', size: 8,
          });
        }
      },
    },
  ],
};

const BOSS_CORE = {
  name: 'NOVA',
  title: 'ORBITAL CORE',
  art: 'core',
  phases: [
    {
      name: 'VECTOR LOCK',
      hp: 1040,
      time: 28,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.65) * 162;
        b.y = 150 + Math.sin(t * 1.05) * 16;
      },
      pattern(b, t, g, rt) {
        if (rt.aimT === undefined) { rt.aimT = 0.8; rt.ringT = 1.6; rt.bubbleT = 3.6; rt.rot = rnd(TAU); }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.aimT) {
          rt.aimT = t + 1.15;
          Patterns.fan(g, bx, by, {
            count: 2, spread: 0.2, speed: 305,
            color: ['cyan', 'white'], shape: 'kunai', size: 4.5,
            offset: Math.sin(t * 2) * 0.05,
          });
        }
        if (t >= rt.ringT) {
          rt.ringT = t + 2.0;
          rt.rot += 0.18;
          Patterns.ring(g, bx, by, {
            count: 18, speed: 108, angle: rt.rot,
            color: ['blue', 'cyan'], shape: 'orb', size: 5.3,
          });
        }
        if (t >= rt.bubbleT) {
          rt.bubbleT = t + 4.1;
          Patterns.ring(g, bx, by, {
            count: 9, speed: 60, angle: -rt.rot,
            color: 'white', shape: 'bubble', size: 8.5,
          });
        }
      },
    },
    {
      name: 'GALAXY GRID',
      hp: 1360,
      time: 34,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.cos(t * 0.7) * 105;
        b.y = 148 + Math.sin(t * 0.9) * 12;
      },
      pattern(b, t, g, rt) {
        if (rt.aT === undefined) {
          rt.aT = 0.9; rt.bT = 0.9; rt.ringT = 2.4; rt.aimT = 3.0;
          rt.spinA = 0; rt.spinB = Math.PI;
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.aT) {
          rt.aT = t + 0.26;
          rt.spinA += 0.18;
          Patterns.spiralBurst(g, bx, by, {
            arms: 3, angle: rt.spinA, speed: 102,
            color: ['blue', 'cyan'], shape: 'rice', size: 5,
          });
        }
        if (t >= rt.bT) {
          rt.bT = t + 0.34;
          rt.spinB -= 0.16;
          Patterns.spiralBurst(g, bx, by, {
            arms: 2, angle: rt.spinB, speed: 122,
            color: ['purple', 'pink'], shape: 'rice', size: 4.8,
          });
        }
        if (t >= rt.ringT) {
          rt.ringT = t + 3.0;
          Patterns.ring(g, bx, by, {
            count: 20, speed: 70, angle: t * 0.4,
            color: 'cyan', shape: 'orb', size: 5.6,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 3.2;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.24, speed: 330,
            color: 'white', shape: 'kunai', size: 4.6,
          });
        }
      },
    },
    {
      name: 'RING BARRIER',
      hp: 1520,
      time: 36,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.5) * 128;
        b.y = 146 + Math.sin(t * 1.4) * 10;
      },
      pattern(b, t, g, rt) {
        if (rt.gapT === undefined) { rt.gapT = 1.2; rt.aimT = 2.1; rt.bigT = 3.6; rt.gapRot = 0; }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.gapT) {
          rt.gapT = t + 2.0;
          rt.gapRot += 0.55;
          Patterns.gapRing(g, bx, by, {
            count: 28, gap: 1.0, speed: 104, angle: rt.gapRot,
            color: ['blue', 'cyan'], shape: 'orb', size: 5.4,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 1.6;
          Patterns.fan(g, bx, by, {
            count: 5, spread: 0.55, speed: 160,
            color: 'white', shape: 'rice', size: 5,
          });
        }
        if (t >= rt.bigT) {
          rt.bigT = t + 3.7;
          Patterns.ring(g, bx, by, {
            count: 12, speed: 55, angle: -rt.gapRot,
            color: ['blue', 'white'], shape: 'bubble', size: 9,
          });
        }
      },
    },
    {
      name: 'MAZE FIELD',
      hp: 1680,
      time: 38,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.42) * 150;
        b.y = 144 + Math.cos(t * 0.75) * 16;
      },
      pattern(b, t, g, rt) {
        if (rt.rainT === undefined) {
          rt.rainT = 0.4; rt.aimT = 1.2; rt.gapT = 2.2; rt.wideT = 5.0;
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.rainT) {
          rt.rainT = t + 0.38;
          Patterns.rain(g, {
            count: 2, color: ['blue', 'purple', 'cyan'], shape: 'kunai',
            size: 4.6, speed: rnd(85, 140), angVel: rnd(-0.8, 0.8), spread: 0.4,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 1.5;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.3, speed: 285,
            color: 'white', shape: 'kunai', size: 4.5,
          });
        }
        if (t >= rt.gapT) {
          rt.gapT = t + 2.6;
          Patterns.gapRing(g, bx, by, {
            count: 22, gap: 1.2, speed: 92, angle: t * 0.7,
            color: ['cyan', 'blue'], shape: 'orb', size: 5.2,
          });
        }
        if (t >= rt.wideT) {
          rt.wideT = t + 5.4;
          Patterns.fan(g, bx, by, {
            count: 8, spread: 1.0, speed: 120,
            color: ['purple', 'pink'], shape: 'rice', size: 5,
            angVel: 0.12,
          });
        }
      },
    },
    {
      name: 'FINAL ORBIT',
      hp: 2080,
      time: 48,
      move(b, t) {
        b.x = FIELD_W / 2 + Math.sin(t * 0.3) * 92;
        b.y = 146 + Math.sin(t * 0.8) * 12;
      },
      pattern(b, t, g, rt) {
        if (rt.aT === undefined) {
          rt.aT = 1.2; rt.bT = 1.7; rt.gapT = 2.2; rt.aimT = 2.8; rt.rainT = 1.4; rt.bigT = 5.0;
          rt.spinA = 0; rt.spinB = 0;
        }
        const bx = b.x;
        const by = b.y + 18;
        if (t >= rt.aT) {
          rt.aT = t + 0.26;
          rt.spinA += 0.21;
          Patterns.spiralBurst(g, bx, by, {
            arms: 4, angle: rt.spinA, speed: 120,
            color: ['blue', 'cyan', 'purple'], shape: 'rice', size: 5.0,
          });
        }
        if (t >= rt.bT) {
          rt.bT = t + 0.34;
          rt.spinB -= 0.17;
          Patterns.spiralBurst(g, bx, by, {
            arms: 3, angle: rt.spinB, speed: 88,
            color: 'cyan', shape: 'orb', size: 5.2,
          });
        }
        if (t >= rt.gapT) {
          rt.gapT = t + 2.6;
          Patterns.gapRing(g, bx, by, {
            count: 26, gap: 1.3, speed: 98, angle: t * 0.4,
            color: ['blue', 'white'], shape: 'orb', size: 5.4,
          });
        }
        if (t >= rt.aimT) {
          rt.aimT = t + 2.0;
          Patterns.fan(g, bx, by, {
            count: 3, spread: 0.2, speed: 360,
            color: 'yellow', shape: 'kunai', size: 4.6,
          });
        }
        if (t >= rt.rainT) {
          rt.rainT = t + 0.8;
          Patterns.rain(g, {
            count: 1.5, color: 'purple', shape: 'kunai',
            size: 4.4, speed: rnd(110, 150), angVel: rnd(-0.5, 0.5), spread: 0.2,
          });
        }
        if (t >= rt.bigT) {
          rt.bigT = t + 5.2;
          Patterns.ring(g, bx, by, {
            count: 10, speed: 55, angle: -rt.spinA,
            color: 'white', shape: 'bubble', size: 9,
          });
        }
      },
    },
  ],
};

/* ============================ STAGE EVENTS ============================ */

const waveAt = (t, type, opts) => ({ t, fn: (g) => EnemyWaves[type](g, opts) });

function vWave(t, color, holdY, extra = {}) {
  return waveAt(t, 'vFormation', Object.assign({
    count: 5, color, hp: 1, holdY, hold: 2.6,
    fireEvery: 2.5, fanCount: 2, spread: 0.45, speed: 140,
    bulletColor: 'cyan', shape: 'rice', size: 5,
  }, extra));
}

function sideWave(t, dir, y, color, extra = {}) {
  return waveAt(t, 'sideSweep', Object.assign({
    count: 4, dir, y, color, hp: 1, fireEvery: 2.2, fanCount: 2,
    spread: 0.35, bulletSpeed: 150, shape: 'kunai', bulletColor: 'cyan',
  }, extra));
}

function diagWave(t, dir, color, extra = {}) {
  return waveAt(t, 'diagonalStream', Object.assign({
    count: 6, dir, color, hp: 1, y: 30, fireEvery: 2.3, fanCount: 2,
    spread: 0.25, bulletSpeed: 145, shape: 'rice', bulletColor: 'cyan',
    speedX: 150, speedY: 32,
  }, extra));
}

function ringWave(t, count, extra = {}) {
  return waveAt(t, 'ringDancer', Object.assign({
    count, color: 'purple', hp: 1, hold: 3.0, ringEvery: 3.2,
    ringCount: 5, speed: 95, bulletColor: 'pink', hoverY: 120,
    spacing: 150,
  }, extra));
}

function sniperWave(t, positions, extra = {}) {
  return waveAt(t, 'snipers', Object.assign({
    positions, color: 'silver', hp: 1, interval: 1.5, speed: 260,
    shape: 'kunai', size: 4.6, bulletColor: 'white',
  }, extra));
}

function emitterWave(t, opts = {}) {
  return waveAt(t, 'emitter', Object.assign({
    x: FIELD_W / 2, y: 115, dir: 1, color: 'red', hp: 6,
    hold: 4.5, interval: 0.17, arms: 2, speed: 100, shape: 'orb',
    size: 5.5, colorA: 'cyan', colorB: 'purple',
  }, opts));
}

const STAGES = [
  {
    id: 1,
    name: 'デブリ帯',
    en: 'STAGE 1   DEBRIS BELT',
    tagline: '漂流物帯を突破せよ',
    bg: 'debris',
    track: 'stage1',
    bossTrack: 'boss1',
    events: [
      vWave(0.8, 'pink', 145, { hold: 2.6, fireEvery: 1.9, bulletColor: 'pink', spread: 0.5 }),
      sideWave(2.0, 1, 95, 'blue', { count: 4, fireEvery: 1.5 }),
      vWave(3.2, 'purple', 215, { count: 4, hold: 2.4, fireEvery: 1.8, bulletColor: 'purple', spread: 0.6 }),
      diagWave(4.4, 1, 'green', { count: 6, bulletColor: 'green', fireEvery: 1.6 }),
      sideWave(5.6, -1, 135, 'pink', { count: 4, bulletColor: 'pink' }),
      vWave(6.8, 'blue', 160, { hold: 2.6 }),
      ringWave(8.2, 2, { hold: 3.0, ringEvery: 2.2, bulletColor: 'red', hoverY: 125 }),
      diagWave(9.6, -1, 'purple', { count: 6, bulletColor: 'purple' }),
      vWave(10.8, 'pink', 250, { count: 4, hold: 2.3, fireEvery: 1.8, bulletColor: 'pink' }),
      sideWave(12.0, 1, 80, 'purple', { count: 4, bulletColor: 'purple' }),
      vWave(13.2, 'blue', 140, { hold: 2.5 }),
      diagWave(14.6, 1, 'green', { count: 7, bulletColor: 'green', fireEvery: 1.6 }),
      sniperWave(16.0, [
        { x: 110, y: 100 }, { x: 225, y: 125 }, { x: 351, y: 125 }, { x: 466, y: 100 },
      ], { interval: 1.7, bulletColor: 'white' }),
      vWave(17.2, 'pink', 220, { count: 4, hold: 2.3, fireEvery: 1.8, bulletColor: 'pink' }),
      sideWave(18.4, -1, 110, 'blue', { count: 4 }),
      diagWave(19.8, -1, 'purple', { count: 6, bulletColor: 'purple' }),
      vWave(21.0, 'pink', 155, { hold: 2.4, bulletColor: 'pink' }),
      sideWave(22.2, 1, 150, 'green', { count: 4, bulletColor: 'green' }),
      vWave(23.4, 'blue', 195, { hold: 2.1 }),
      { t: 24.5, fn: (g) => g.spawnBoss(MID_CRUISER) },

      sideWave(25.0, 1, 85, 'blue', { count: 4 }),
      vWave(26.0, 'pink', 150, { hold: 2.5, bulletColor: 'pink' }),
      diagWave(27.2, 1, 'purple', { count: 6, bulletColor: 'purple' }),
      ringWave(28.4, 2, { hold: 3.0, ringEvery: 2.0, bulletColor: 'purple' }),
      vWave(29.6, 'blue', 230, { count: 4, hold: 2.3 }),
      sniperWave(30.8, [
        { x: 90, y: 105 }, { x: 205, y: 130 }, { x: 371, y: 130 }, { x: 486, y: 105 },
      ], { interval: 1.6 }),
      sideWave(32.0, -1, 120, 'green', { count: 4, bulletColor: 'green' }),
      diagWave(33.2, -1, 'green', { count: 6, bulletColor: 'green' }),
      vWave(34.4, 'pink', 160, { hold: 2.4, bulletColor: 'pink' }),
      sideWave(35.6, 1, 160, 'pink', { count: 4, bulletColor: 'pink' }),
      emitterWave(36.8, { x: 288, y: 115, hold: 4.2, arms: 2, color: 'red' }),
      vWave(38.0, 'purple', 140, { hold: 2.4, bulletColor: 'purple' }),
      diagWave(39.2, 1, 'blue', { count: 7, bulletColor: 'blue' }),
      ringWave(40.4, 2, { hoverY: 110, ringEvery: 1.9, color: 'red', bulletColor: 'purple' }),
      vWave(41.6, 'green', 220, { count: 4, hold: 2.2, bulletColor: 'green' }),
      sniperWave(42.8, [
        { x: 120, y: 110 }, { x: 288, y: 90 }, { x: 456, y: 110 },
      ], { interval: 1.4 }),
      sideWave(44.0, -1, 100, 'blue', { count: 4 }),
      diagWave(45.2, -1, 'pink', { count: 6, bulletColor: 'pink' }),
      vWave(46.4, 'blue', 170, { hold: 2.1 }),
      vWave(47.6, 'purple', 110, {
        count: 6, hold: 2.0, fireEvery: 1.3, fanCount: 3, spread: 0.7, bulletColor: 'purple',
      }),
      { t: 48.7, fn: (g) => g.spawnBoss(BOSS_CRUISER) },
    ],
  },
  {
    id: 2,
    name: '軌道ゲート',
    en: 'STAGE 2   ORBITAL GATE',
    tagline: '敵中枢へ突入せよ',
    bg: 'orbit',
    track: 'stage2',
    bossTrack: 'boss2',
    events: [
      sideWave(0.8, -1, 85, 'silver', { count: 4, fireEvery: 1.3, bulletColor: 'blue' }),
      vWave(2.0, 'blue', 150, { hold: 2.4, fireEvery: 1.4, bulletColor: 'cyan' }),
      diagWave(3.2, -1, 'silver', { count: 6, bulletColor: 'blue' }),
      vWave(4.4, 'purple', 230, { count: 4, hold: 2.2, fireEvery: 1.4, bulletColor: 'purple' }),
      sideWave(5.6, 1, 140, 'blue', { count: 4, fireEvery: 1.3 }),
      ringWave(6.8, 2, { hold: 3.0, ringEvery: 1.9, color: 'blue', bulletColor: 'cyan', hoverY: 125 }),
      diagWave(8.0, 1, 'blue', { count: 6, bulletColor: 'cyan' }),
      vWave(9.2, 'silver', 160, { hold: 2.3, fireEvery: 1.4, bulletColor: 'blue' }),
      sniperWave(10.4, [
        { x: 100, y: 95 }, { x: 288, y: 120 }, { x: 476, y: 95 },
      ], { interval: 1.4, bulletColor: 'cyan' }),
      sideWave(11.6, -1, 100, 'purple', { count: 4, fireEvery: 1.2, bulletColor: 'purple' }),
      diagWave(12.8, -1, 'silver', { count: 7, bulletColor: 'blue' }),
      vWave(14.0, 'blue', 200, { hold: 2.2, fireEvery: 1.3 }),
      sideWave(15.2, 1, 160, 'green', { count: 4, bulletColor: 'green' }),
      ringWave(16.4, 2, { hold: 2.8, ringEvery: 1.8, color: 'purple', bulletColor: 'purple' }),
      diagWave(17.6, 1, 'purple', { count: 6, bulletColor: 'purple' }),
      vWave(18.8, 'silver', 140, { count: 4, hold: 2.2, fireEvery: 1.3, bulletColor: 'blue' }),
      emitterWave(20.0, { x: 150, y: 115, dir: 1, hold: 4.5, color: 'purple', colorA: 'purple', colorB: 'blue' }),
      emitterWave(20.0, { x: 426, y: 115, dir: -1, hold: 4.5, color: 'blue', colorA: 'blue', colorB: 'cyan' }),
      sideWave(21.6, -1, 80, 'blue', { count: 4 }),
      vWave(22.8, 'purple', 180, { hold: 2.1, fireEvery: 1.3, bulletColor: 'purple' }),
      diagWave(24.0, 1, 'silver', { count: 6, bulletColor: 'blue' }),
      { t: 25.0, fn: (g) => g.spawnBoss(MID_WARDEN) },

      sideWave(26.0, 1, 90, 'blue', { count: 4 }),
      sideWave(26.4, -1, 155, 'silver', { count: 4, bulletColor: 'blue' }),
      vWave(27.6, 'purple', 140, { hold: 2.3, fireEvery: 1.3, bulletColor: 'purple' }),
      diagWave(28.8, 1, 'blue', { count: 6, bulletColor: 'cyan' }),
      vWave(30.0, 'silver', 210, { count: 4, hold: 2.2, fireEvery: 1.3, bulletColor: 'blue' }),
      sniperWave(31.2, [
        { x: 90, y: 110 }, { x: 205, y: 85 }, { x: 371, y: 85 }, { x: 486, y: 110 },
      ], { interval: 1.3 }),
      sideWave(32.4, -1, 120, 'blue', { count: 4 }),
      diagWave(33.6, -1, 'purple', { count: 7, bulletColor: 'purple' }),
      vWave(34.8, 'blue', 160, { hold: 2.2, fireEvery: 1.25 }),
      ringWave(36.0, 2, { hold: 2.8, ringEvery: 1.8, hoverY: 100, color: 'blue', bulletColor: 'cyan' }),
      sideWave(37.2, 1, 170, 'silver', { count: 4, bulletColor: 'blue' }),
      vWave(38.4, 'blue', 130, {
        count: 6, hold: 2.1, fireEvery: 1.2, fanCount: 3, spread: 0.65,
      }),
      emitterWave(39.6, { x: 288, y: 110, hold: 5.0, arms: 3, color: 'red', colorA: 'cyan', colorB: 'purple' }),
      diagWave(41.0, 1, 'silver', { count: 7, bulletColor: 'blue' }),
      vWave(42.2, 'purple', 180, { hold: 2.1, fireEvery: 1.3, bulletColor: 'purple' }),
      sideWave(43.4, -1, 100, 'blue', { count: 4 }),
      diagWave(44.6, -1, 'blue', { count: 6 }),
      vWave(45.8, 'silver', 150, { hold: 2.1, fireEvery: 1.2, bulletColor: 'blue' }),
      sideWave(47.0, 1, 80, 'purple', { count: 4, bulletColor: 'purple' }),
      vWave(48.2, 'blue', 200, { hold: 2.1, fireEvery: 1.2 }),
      diagWave(49.4, 1, 'silver', { count: 6, bulletColor: 'blue' }),
      vWave(50.6, 'purple', 140, {
        count: 6, hold: 2.0, fireEvery: 1.15, fanCount: 3, spread: 0.7, bulletColor: 'purple',
      }),
      { t: 52.0, fn: (g) => g.spawnBoss(BOSS_CORE) },
    ],
  },
];
