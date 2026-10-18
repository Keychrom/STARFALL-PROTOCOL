'use strict';

/* ------------------------------------------------------------------
 *  STARFALL PROTOCOL — shared constants & tiny helpers
 * ------------------------------------------------------------------ */

const VIEW_W = 960;
const VIEW_H = 720;

// Playfield, in view coordinates. The game world itself is field-local.
const FIELD_X = 24;
const FIELD_Y = 24;
const FIELD_W = 576;
const FIELD_H = 672;

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

const SERIF = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';
const SANS = '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif';
const MONO = '"Cascadia Mono", "Consolas", "SFMono-Regular", monospace';
const HEAD = '"Bahnschrift", "Segoe UI Semibold", "Yu Gothic UI", sans-serif';

const UI_CYAN = '#7fe7ff';
const UI_CYAN_SOFT = '#b7f4ff';
const UI_AMBER = '#ffc45e';
const UI_ORANGE = '#ff8a5a';
const UI_RED = '#ff6b6b';
const UI_WHITE = '#f2fbff';
const UI_MUTED = 'rgba(185, 225, 240, 0.55)';
const UI_PANEL = 'rgba(8, 18, 30, 0.92)';
const UI_LINE = 'rgba(110, 220, 255, 0.26)';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function rnd(min, max) {
  if (max === undefined) { max = min; min = 0; }
  return min + Math.random() * (max - min);
}
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }

function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
function easeInOutSine(t) { return -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2; }
function easeOutQuad(t) { return 1 - (1 - clamp(t, 0, 1)) * (1 - clamp(t, 0, 1)); }

function fmt(n) {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function padScore(n, len = 9) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

function rgba(hex, a) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Rounded rect path (keeps compatibility with older canvas impls). */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function glowText(ctx, text, x, y, font, fill, glowColor, blur = 12, align = 'left', baseline = 'middle') {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = blur;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draws a pre-rendered sprite centered at x, y. `w`/`h` are logical sizes. */
function drawSprite(ctx, spr, x, y, w, h, rot = 0, alpha = 1) {
  if (!spr) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(spr.img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function starPath(ctx, x, y, outer, inner, points, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points - HALF_PI;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function diamondPath(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.lineTo(x + rx, y);
  ctx.lineTo(x, y + ry);
  ctx.lineTo(x - rx, y);
  ctx.closePath();
}

const Storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
};

/* ------------------------------------------------------------------
 *  Difficulty presets
 * ------------------------------------------------------------------ */

const DIFFICULTIES = [
  {
    key: 'easy', name: 'EASY', jp: '易しい', color: '#8be7b0',
    mult: 0.66, speed: 0.84, hp: 0.82, lives: 4, bombs: 3, enemyMult: 0.8, reinforceTarget: 12,
    desc: '敵弾が少なめ。まずはここから。',
  },
  {
    key: 'normal', name: 'NORMAL', jp: '普通', color: '#72d6ff',
    mult: 1.0, speed: 1.0, hp: 1.0, lives: 3, bombs: 2, enemyMult: 1.0, reinforceTarget: 16,
    desc: '標準設定。基本のパターンを覚えよう。',
  },
  {
    key: 'hard', name: 'HARD', jp: '難しい', color: '#ffc06e',
    mult: 1.28, speed: 1.07, hp: 1.1, lives: 3, bombs: 2, enemyMult: 1.12, reinforceTarget: 20,
    desc: '敵弾の密度と速度が上昇する。',
  },
  {
    key: 'lunatic', name: 'LUNATIC', jp: '極限', color: '#ff7a7a',
    mult: 1.9, speed: 1.22, hp: 1.35, lives: 2, bombs: 2, enemyMult: 1.45, reinforceTarget: 30, fillerFireMul: 1.8,
    desc: '最高難度。道中・ボスともに大幅に強化される。',
  },
];
