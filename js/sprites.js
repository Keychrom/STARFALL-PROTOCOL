'use strict';

/* ------------------------------------------------------------------
 *  All artwork is generated procedurally and pre-rendered to offscreen
 *  canvases at creation time (glow via gradients / shadowBlur is cheap
 *  when baked once).
 * ------------------------------------------------------------------ */

const SS = 2; // supersampling factor

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { img: c, ctx, w, h };
}

const BULLET_COLORS = {
  red:    { main: '#ff4f6e', light: '#ffd7e1', dark: '#8e102c' },
  pink:   { main: '#ff86c9', light: '#ffe2f4', dark: '#8c2360' },
  purple: { main: '#a97cff', light: '#eaDCff', dark: '#43218c' },
  blue:   { main: '#5f9dff', light: '#d9e9ff', dark: '#173d8c' },
  cyan:   { main: '#4fe0f0', light: '#d8feff', dark: '#0f6a78' },
  green:  { main: '#6df0a4', light: '#d8ffe6', dark: '#0f6b3a' },
  yellow: { main: '#ffd95e', light: '#fff8d6', dark: '#8a6b00' },
  orange: { main: '#ffa159', light: '#ffe7d2', dark: '#8c4a12' },
  white:  { main: '#f1e8ff', light: '#ffffff', dark: '#776796' },
};

const DRONE_COLORS = {
  pink:   { accent: '#ff5f7e', accent2: '#a52a44', metal: '#7d8796', metalDark: '#2a303d', glow: '#ff9aaa' },
  blue:   { accent: '#58b6ff', accent2: '#245a9c', metal: '#8796a8', metalDark: '#232c3a', glow: '#8fd6ff' },
  green:  { accent: '#63f0a5', accent2: '#1f7a4e', metal: '#82968c', metalDark: '#222f2a', glow: '#96ffc4' },
  purple: { accent: '#b388ff', accent2: '#5e34a6', metal: '#918ba3', metalDark: '#2a2637', glow: '#d4baff' },
  red:    { accent: '#ff6a5d', accent2: '#a02b25', metal: '#9a8989', metalDark: '#342727', glow: '#ff9f90' },
  silver: { accent: '#d6ecff', accent2: '#6f8fb8', metal: '#aab8c8', metalDark: '#2c3a48', glow: '#eaf8ff' },
};


function bulletSprite(colorName, shape) {
  const p = BULLET_COLORS[colorName] || BULLET_COLORS.red;
  const S = mkCanvas(40, 40);
  const ctx = S.ctx;
  const cx = 20, cy = 20;

  // Soft aura.
  const aura = ctx.createRadialGradient(cx, cy, 1, cx, cy, 20);
  aura.addColorStop(0, rgba(p.main, 0.50));
  aura.addColorStop(0.40, rgba(p.main, 0.22));
  aura.addColorStop(0.72, rgba(p.main, 0.07));
  aura.addColorStop(1, rgba(p.main, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = p.main;
  ctx.shadowBlur = 4.5;

  if (shape === 'orb') {
    const grad = ctx.createRadialGradient(cx - 2, cy - 2.5, 0.5, cx, cy, 10.2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, p.light);
    grad.addColorStop(0.55, p.main);
    grad.addColorStop(0.92, p.main);
    grad.addColorStop(1, rgba(p.dark, 0.95));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(p.light, 0.85);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, 9.5, 0, TAU);
    ctx.stroke();
  } else if (shape === 'rice') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.66, 1);
    const grad = ctx.createRadialGradient(-1, -3, 0.5, 0, 0, 10.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, p.light);
    grad.addColorStop(0.62, p.main);
    grad.addColorStop(1, p.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 10.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(p.light, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.6, 10.1, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  } else if (shape === 'kunai') {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createLinearGradient(0, -11, 0, 9);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, p.light);
    grad.addColorStop(0.75, p.main);
    grad.addColorStop(1, p.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(4.8, -7, 4.4, 0);
    ctx.quadraticCurveTo(4.2, 7, 0, 9);
    ctx.quadraticCurveTo(-4.2, 7, -4.4, 0);
    ctx.quadraticCurveTo(-4.8, -7, 0, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(p.light, 0.9);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // bright spine
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(0, -2, 1.0, 5.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else if (shape === 'star') {
    ctx.fillStyle = p.main;
    starPath(ctx, cx, cy, 11, 4.6, 5, -HALF_PI);
    ctx.fill();
    ctx.strokeStyle = p.light;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, rgba(p.light, 0.7));
    grad.addColorStop(1, rgba(p.light, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, TAU);
    ctx.fill();
  } else if (shape === 'bubble') {
    ctx.fillStyle = rgba(p.main, 0.13);
    ctx.beginPath();
    ctx.arc(cx, cy, 9.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = p.main;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 9.2, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.light, 0.9);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, 9.2, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx - 3.4, cy - 3.8, 1.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  return S;
}

function makeShotNeedle() {
  const S = mkCanvas(16, 42);
  const ctx = S.ctx;
  ctx.translate(8, 21);
  const aura = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
  aura.addColorStop(0, 'rgba(120,235,255,0.55)');
  aura.addColorStop(1, 'rgba(70,180,255,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 19, 0, 0, TAU);
  ctx.fill();

  ctx.shadowColor = '#7fe7ff';
  ctx.shadowBlur = 6;
  const grad = ctx.createLinearGradient(0, -16, 0, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, '#dcfbff');
  grad.addColorStop(0.8, '#66ddff');
  grad.addColorStop(1, 'rgba(70,200,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.quadraticCurveTo(3.6, -8, 2.8, 4);
  ctx.quadraticCurveTo(2.2, 13, 0, 17);
  ctx.quadraticCurveTo(-2.2, 13, -2.8, 4);
  ctx.quadraticCurveTo(-3.6, -8, 0, -17);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, 7);
  ctx.stroke();
  return S;
}

function makeShotBolt() {
  const S = mkCanvas(20, 36);
  const ctx = S.ctx;
  ctx.translate(10, 18);

  const aura = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
  aura.addColorStop(0, 'rgba(130,240,255,0.55)');
  aura.addColorStop(1, 'rgba(70,180,255,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 17, 0, 0, TAU);
  ctx.fill();

  ctx.shadowColor = '#7fe7ff';
  ctx.shadowBlur = 5;
  const g = ctx.createLinearGradient(0, -16, 0, 16);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#d9fbff');
  g.addColorStop(0.75, '#58d8ff');
  g.addColorStop(1, 'rgba(70,200,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(4.6, -5);
  ctx.lineTo(2.5, 11);
  ctx.lineTo(0, 16);
  ctx.lineTo(-2.5, 11);
  ctx.lineTo(-4.6, -5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(220,252,255,0.8)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 7);
  ctx.stroke();
  return S;
}


function makeDrone(colorName, frame) {
  const p = DRONE_COLORS[colorName] || DRONE_COLORS.pink;
  const S = mkCanvas(42, 48);
  const ctx = S.ctx;
  const cx = 21;
  const outline = 'rgba(3,8,14,0.88)';

  const eg = ctx.createRadialGradient(cx, 11, 1, cx, 11, 21);
  eg.addColorStop(0, rgba(p.glow, 0.32));
  eg.addColorStop(1, rgba(p.glow, 0));
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(cx, 11, 20, 12, 0, 0, TAU);
  ctx.fill();

  for (const side of [-1, 1]) {
    const ex = cx + side * 8;
    const fg = ctx.createLinearGradient(0, 2, 0, 14);
    fg.addColorStop(0, rgba(p.glow, 0));
    fg.addColorStop(0.5, rgba(p.glow, 0.6));
    fg.addColorStop(1, rgba(p.accent, 0.15));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(ex - 2.4, 9);
    ctx.lineTo(ex, frame ? 1 : 4);
    ctx.lineTo(ex + 2.4, 9);
    ctx.closePath();
    ctx.fill();
  }

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 25);
    ctx.scale(side, 1);
    ctx.rotate(frame ? -0.035 : 0.025);
    const wg = ctx.createLinearGradient(0, -14, 0, 18);
    wg.addColorStop(0, p.metal);
    wg.addColorStop(0.5, '#465463');
    wg.addColorStop(1, p.metalDark);
    ctx.fillStyle = wg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(4, -13);
    ctx.lineTo(20, -6);
    ctx.lineTo(17, 12);
    ctx.lineTo(6, 17);
    ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, -10);
    ctx.lineTo(18, -4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(7, -2);
    ctx.lineTo(16, 2);
    ctx.stroke();

    ctx.fillStyle = p.glow;
    ctx.beginPath();
    ctx.arc(17, 1, 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const hg = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
  hg.addColorStop(0, p.metalDark);
  hg.addColorStop(0.35, p.metal);
  hg.addColorStop(0.65, '#b8c5d1');
  hg.addColorStop(1, p.metalDark);
  ctx.fillStyle = hg;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, 43.5);
  ctx.lineTo(cx + 7.2, 29);
  ctx.lineTo(cx + 5.8, 11);
  ctx.quadraticCurveTo(cx, 5.5, cx - 5.8, 11);
  ctx.lineTo(cx - 7.2, 29);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx - 5.8, 13);
  ctx.lineTo(cx - 2.2, 12);
  ctx.lineTo(cx - 3.4, 34);
  ctx.lineTo(cx - 5.6, 30);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 5.8, 13);
  ctx.lineTo(cx + 2.2, 12);
  ctx.lineTo(cx + 3.4, 34);
  ctx.lineTo(cx + 5.6, 30);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = p.glow;
  ctx.shadowBlur = 7;
  const eye = ctx.createRadialGradient(cx - 1, 20, 0.5, cx, 21.5, 5.4);
  eye.addColorStop(0, '#ffffff');
  eye.addColorStop(0.35, p.glow);
  eye.addColorStop(0.8, p.accent);
  eye.addColorStop(1, p.accent2);
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(cx, 21.5, 5, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(cx, 21.5, 6.5, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, 28);
  ctx.lineTo(cx, 38);
  ctx.stroke();

  for (const side of [-1, 1]) {
    const ex = cx + side * 8;
    ctx.fillStyle = '#111b25';
    roundRectPath(ctx, ex - 2.2, 7, 4.4, 5, 1);
    ctx.fill();
    ctx.fillStyle = p.glow;
    ctx.fillRect(ex - 1, 8, 2, 2.2);
  }

  ctx.fillStyle = frame ? '#ffffff' : p.accent;
  ctx.beginPath();
  ctx.arc(cx, 6, 1.1, 0, TAU);
  ctx.fill();

  return S;
}


function makeBossCruiser() {
  const S = mkCanvas(132, 148);
  const ctx = S.ctx;
  const cx = 66;
  const outline = 'rgba(2,6,12,0.92)';
  const accent = '#ffbf5e';
  const glow = '#ff9a3d';
  const cool = '#8feaff';

  // Engine glow and exhaust.
  const eg = ctx.createRadialGradient(cx, 30, 4, cx, 30, 60);
  eg.addColorStop(0, 'rgba(255,170,80,0.30)');
  eg.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(cx, 26, 56, 34, 0, 0, TAU);
  ctx.fill();

  for (const [ex, fw, fl] of [[cx - 25, 9, 24], [cx, 11, 31], [cx + 25, 9, 24]]) {
    const fg = ctx.createLinearGradient(0, 26, 0, 26 - fl);
    fg.addColorStop(0, 'rgba(255,220,160,0.85)');
    fg.addColorStop(0.4, 'rgba(255,150,65,0.55)');
    fg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(ex - fw / 2, 26);
    ctx.lineTo(ex + fw / 2, 26);
    ctx.lineTo(ex + fw * 0.18, 26 - fl);
    ctx.lineTo(ex - fw * 0.18, 26 - fl);
    ctx.closePath();
    ctx.fill();
  }

  // Rear fins.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(side, 1);
    const fg = ctx.createLinearGradient(16, 12, 48, 48);
    fg.addColorStop(0, '#93a9ba');
    fg.addColorStop(0.55, '#455d70');
    fg.addColorStop(1, '#17232f');
    ctx.fillStyle = fg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(16, 35);
    ctx.lineTo(40, 14);
    ctx.lineTo(46, 31);
    ctx.lineTo(20, 46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,230,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 31);
    ctx.lineTo(40, 20);
    ctx.stroke();
    ctx.restore();
  }

  // Wings.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(side, 1);
    const wg = ctx.createLinearGradient(14, 40, 58, 102);
    wg.addColorStop(0, '#8fa6b9');
    wg.addColorStop(0.45, '#4e677a');
    wg.addColorStop(1, '#1a2835');
    ctx.fillStyle = wg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, 42);
    ctx.lineTo(58, 64);
    ctx.lineTo(50, 101);
    ctx.lineTo(20, 94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armor plate overlay.
    const pg = ctx.createLinearGradient(24, 54, 48, 94);
    pg.addColorStop(0, 'rgba(170,195,210,0.5)');
    pg.addColorStop(1, 'rgba(30,45,58,0.35)');
    ctx.fillStyle = pg;
    ctx.strokeStyle = 'rgba(4,9,15,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 52);
    ctx.lineTo(49, 68);
    ctx.lineTo(43, 90);
    ctx.lineTo(24, 84);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Accent lines.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(19, 47);
    ctx.lineTo(55, 67);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,235,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 88);
    ctx.lineTo(46, 94);
    ctx.stroke();

    // Wing turret.
    ctx.fillStyle = '#1a2935';
    ctx.strokeStyle = 'rgba(160,205,225,0.4)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(36, 76, 6.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#101a22';
    ctx.fillRect(33, 78, 2, 12);
    ctx.fillRect(37, 78, 2, 12);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(36, 74, 1.8, 0, TAU);
    ctx.fill();

    // Running lights.
    ctx.fillStyle = cool;
    ctx.beginPath();
    ctx.arc(53, 68, 1.5, 0, TAU);
    ctx.arc(26, 88, 1.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Main hull.
  const hg = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0);
  hg.addColorStop(0, '#2a3d4e');
  hg.addColorStop(0.28, '#8ba3b6');
  hg.addColorStop(0.5, '#c3d6e3');
  hg.addColorStop(0.72, '#7891a5');
  hg.addColorStop(1, '#223240');
  ctx.fillStyle = hg;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 20, 25);
  ctx.lineTo(cx + 20, 25);
  ctx.lineTo(cx + 30, 62);
  ctx.lineTo(cx + 17, 115);
  ctx.lineTo(cx, 142);
  ctx.lineTo(cx - 17, 115);
  ctx.lineTo(cx - 30, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Armor strips.
  ctx.fillStyle = 'rgba(9,18,27,0.42)';
  ctx.beginPath();
  ctx.moveTo(cx - 27, 63);
  ctx.lineTo(cx - 12, 58);
  ctx.lineTo(cx - 10, 108);
  ctx.lineTo(cx - 17, 113);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 27, 63);
  ctx.lineTo(cx + 12, 58);
  ctx.lineTo(cx + 10, 108);
  ctx.lineTo(cx + 17, 113);
  ctx.closePath();
  ctx.fill();

  // Central prow plate.
  const pg = ctx.createLinearGradient(cx - 12, 60, cx + 12, 130);
  pg.addColorStop(0, 'rgba(200,220,232,0.55)');
  pg.addColorStop(1, 'rgba(90,115,130,0.18)');
  ctx.fillStyle = pg;
  ctx.strokeStyle = 'rgba(225,245,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 66);
  ctx.lineTo(cx + 8, 66);
  ctx.lineTo(cx + 4, 122);
  ctx.lineTo(cx, 135);
  ctx.lineTo(cx - 4, 122);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bridge.
  ctx.fillStyle = '#314554';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(cx - 14, 40);
  ctx.lineTo(cx + 14, 40);
  ctx.lineTo(cx + 9, 60);
  ctx.lineTo(cx - 9, 60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,235,255,0.8)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(cx + i * 4.5 - 1, 45, 2, 4);
  }
  ctx.fillStyle = 'rgba(255,190,95,0.75)';
  ctx.fillRect(cx - 10, 55, 20, 1.2);

  // Core reactor.
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12;
  const cg = ctx.createRadialGradient(cx - 3, 82, 1, cx, 86, 15);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.3, '#ffe2a6');
  cg.addColorStop(0.7, '#ffab45');
  cg.addColorStop(1, '#7d3a0e');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, 86, 13, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(2,7,12,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,170,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, 86, 16.5, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Nose railguns.
  for (const side of [-1, 1]) {
    const gx = cx + side * 7;
    ctx.fillStyle = '#17242f';
    ctx.strokeStyle = 'rgba(160,205,225,0.35)';
    ctx.lineWidth = 0.8;
    roundRectPath(ctx, gx - 2.2, 108, 4.4, 25, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(gx - 1.2, 106, 2.4, 3);
  }

  // Engine nozzles.
  for (const nx of [cx - 25, cx, cx + 25]) {
    ctx.fillStyle = '#0d1720';
    roundRectPath(ctx, nx - 8, 22, 16, 8, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,110,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,120,0.9)';
    ctx.fillRect(nx - 5, 24, 10, 2);
  }

  // Hull panel lines and lights.
  ctx.strokeStyle = 'rgba(5,12,19,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 18, 70);
  ctx.lineTo(cx - 8, 72);
  ctx.moveTo(cx + 18, 70);
  ctx.lineTo(cx + 8, 72);
  ctx.moveTo(cx - 12, 100);
  ctx.lineTo(cx - 5, 102);
  ctx.moveTo(cx + 12, 100);
  ctx.lineTo(cx + 5, 102);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,235,255,0.8)';
  ctx.beginPath();
  ctx.arc(cx - 18, 60, 1.2, 0, TAU);
  ctx.arc(cx + 18, 60, 1.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,210,140,0.75)';
  ctx.beginPath();
  ctx.arc(cx - 8, 38, 1.1, 0, TAU);
  ctx.arc(cx + 8, 38, 1.1, 0, TAU);
  ctx.fill();

  return S;
}

function makeBossCore() {
  const S = mkCanvas(128, 128);
  const ctx = S.ctx;
  const cx = 64;
  const cy = 64;
  const outline = 'rgba(2,6,12,0.92)';
  const accent = '#72e6ff';

  // Ambient glow.
  const ag = ctx.createRadialGradient(cx, cy, 6, cx, cy, 62);
  ag.addColorStop(0, 'rgba(80,220,255,0.18)');
  ag.addColorStop(1, 'rgba(60,170,255,0)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, TAU);
  ctx.fill();

  // Four structural arms.
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i / 4) * TAU);
    const mg = ctx.createLinearGradient(-14, -60, 14, -10);
    mg.addColorStop(0, '#93a9b9');
    mg.addColorStop(0.5, '#3f5b6e');
    mg.addColorStop(1, '#16232f');
    ctx.fillStyle = mg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-15, -44);
    ctx.lineTo(-8, -60);
    ctx.lineTo(8, -60);
    ctx.lineTo(15, -44);
    ctx.lineTo(10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,230,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(0, -55);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, -56, 2.4, 0, TAU);
    ctx.fill();
    if (i === 2) {
      // Bottom arm doubles as a main cannon.
      ctx.fillStyle = '#101a22';
      ctx.fillRect(-3.2, -58, 6.4, 10);
      ctx.fillStyle = '#bff7ff';
      ctx.fillRect(-1.2, -57, 2.4, 5);
    }
    ctx.restore();
  }

  // Outer armored ring.
  ctx.save();
  ctx.strokeStyle = '#223440';
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.arc(cx, cy, 43, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160,198,215,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 51.5, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 34.5, 0, TAU);
  ctx.stroke();

  // Segment accents.
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(110,230,255,0.55)' : 'rgba(255,190,95,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 43, i * (TAU / 4) + 0.22, i * (TAU / 4) + TAU / 4 - 0.22);
    ctx.stroke();
  }

  // Radial panel joints.
  ctx.strokeStyle = 'rgba(4,10,16,0.6)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 35, cy + Math.sin(a) * 35);
    ctx.lineTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52);
    ctx.stroke();
  }
  ctx.restore();

  // Diagonal outer plates.
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4 + (i / 4) * TAU);
    ctx.fillStyle = '#314a5b';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -58);
    ctx.lineTo(7, -58);
    ctx.lineTo(10, -48);
    ctx.lineTo(-10, -48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8fe8ff';
    ctx.fillRect(-1.2, -56, 2.4, 5);
    ctx.restore();
  }

  // Core socket.
  ctx.save();
  ctx.fillStyle = '#0b151e';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(170,205,220,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 29, 0, TAU);
  ctx.stroke();

  ctx.shadowColor = '#50e5ff';
  ctx.shadowBlur = 14;
  const cg = ctx.createRadialGradient(cx - 5, cy - 6, 1, cx, cy, 23);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.25, '#d2fbff');
  cg.addColorStop(0.6, '#52dcff');
  cg.addColorStop(0.9, '#176e9e');
  cg.addColorStop(1, '#082438');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(220,252,255,0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 15.5, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,245,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0.3, 2.2);
  ctx.stroke();
  ctx.restore();

  // Bolt details.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.1;
    const bx = cx + Math.cos(a) * 43;
    const by = cy + Math.sin(a) * 43;
    ctx.fillStyle = 'rgba(210,240,250,0.55)';
    ctx.beginPath();
    ctx.arc(bx, by, 1.1, 0, TAU);
    ctx.fill();
  }

  // Targeting lamps.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * TAU;
    ctx.fillStyle = i % 2 ? '#ffcb72' : '#9ff4ff';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 1.7, 0, TAU);
    ctx.fill();
  }

  return S;
}

function makeBoss(kind) {
  return kind === 'core' ? makeBossCore() : makeBossCruiser();
}


function makeItem(type) {
  const isPower = type === 'power' || type === 'powerBig';
  const isBig = type === 'powerBig';
  const w = isBig ? 28 : 20;
  const h = isBig ? 32 : 24;
  const S = mkCanvas(w + 8, h + 8);
  const ctx = S.ctx;
  const cx = S.w / 2;
  const cy = S.h / 2;
  const main = isPower ? '#3ec9ff' : '#ffc457';
  const light = isPower ? '#dcfaff' : '#fff2cc';
  const dark = isPower ? '#125173' : '#7a4c08';

  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, w / 2 + 5);
  aura.addColorStop(0, rgba(main, 0.4));
  aura.addColorStop(1, rgba(main, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 + 5, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = main;
  ctx.shadowBlur = 4;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, light);
  g.addColorStop(0.28, main);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(235,253,255,0.9)';
  ctx.lineWidth = 1.1;

  const cut = 3;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + cut, -h / 2);
  ctx.lineTo(w / 2 - cut, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + cut);
  ctx.lineTo(w / 2, h / 2 - cut);
  ctx.lineTo(w / 2 - cut, h / 2);
  ctx.lineTo(-w / 2 + cut, h / 2);
  ctx.lineTo(-w / 2, h / 2 - cut);
  ctx.lineTo(-w / 2, -h / 2 + cut);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, -h / 2 + 2.5);
  ctx.lineTo(w / 2 - 2, -h / 2 + 2.5);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${isBig ? 15 : 11}px ${MONO}`;
  ctx.fillText(isPower ? 'P' : 'S', 0, 0.5);
  ctx.restore();
  return S;
}


function makePlayer() {
  const S = mkCanvas(46, 60);
  const ctx = S.ctx;
  const cx = 23;
  const outline = 'rgba(3,9,16,0.88)';
  const cyan = '#6fe8ff';
  const amber = '#ffbe63';
  const steelLight = '#e6f4fb';
  const steelMid = '#9fb8c8';
  const steelDark = '#445a6b';
  const steelDeep = '#16232f';

  const aura = ctx.createRadialGradient(cx, 34, 2, cx, 34, 24);
  aura.addColorStop(0, 'rgba(90,220,255,0.20)');
  aura.addColorStop(1, 'rgba(90,220,255,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, 34, 24, 0, TAU);
  ctx.fill();

  // Engine exhaust.
  for (const side of [-1, 1]) {
    const ex = cx + side * 7;
    const fg = ctx.createLinearGradient(0, 45, 0, 60);
    fg.addColorStop(0, 'rgba(230,253,255,0.9)');
    fg.addColorStop(0.35, 'rgba(95,225,255,0.55)');
    fg.addColorStop(1, 'rgba(55,150,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(ex - 3, 47);
    ctx.lineTo(ex - 1.2, 58);
    ctx.lineTo(ex + 1.2, 58);
    ctx.lineTo(ex + 3, 47);
    ctx.closePath();
    ctx.fill();
  }

  // Rear fins.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 26);
    ctx.scale(side, 1);
    const fg = ctx.createLinearGradient(0, -12, 0, 12);
    fg.addColorStop(0, steelMid);
    fg.addColorStop(1, steelDeep);
    ctx.fillStyle = fg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -11);
    ctx.lineTo(13, -3);
    ctx.lineTo(7, 9);
    ctx.lineTo(3, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Wings.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, 31);
    ctx.scale(side, 1);
    const wg = ctx.createLinearGradient(2, -10, 19, 19);
    wg.addColorStop(0, steelLight);
    wg.addColorStop(0.5, steelMid);
    wg.addColorStop(1, steelDark);
    ctx.fillStyle = wg;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2, -9);
    ctx.lineTo(20, 1);
    ctx.lineTo(17, 17);
    ctx.lineTo(5, 20);
    ctx.lineTo(1, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = cyan;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.lineTo(18, 3);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(10,20,30,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(7, 2);
    ctx.lineTo(15, 8);
    ctx.stroke();

    // Wing cannon.
    ctx.fillStyle = '#1a2a36';
    roundRectPath(ctx, 10, 5, 4, 11, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,215,235,0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = amber;
    ctx.fillRect(11.2, 7, 1.6, 2);

    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.arc(19, 1.5, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Main hull.
  const hg = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
  hg.addColorStop(0, steelDark);
  hg.addColorStop(0.3, steelLight);
  hg.addColorStop(0.55, '#ffffff');
  hg.addColorStop(0.78, steelMid);
  hg.addColorStop(1, steelDeep);
  ctx.fillStyle = hg;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, 3);
  ctx.lineTo(cx + 3.6, 14);
  ctx.lineTo(cx + 7, 28);
  ctx.lineTo(cx + 5, 44);
  ctx.quadraticCurveTo(cx, 50, cx - 5, 44);
  ctx.lineTo(cx - 7, 28);
  ctx.lineTo(cx - 3.6, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(9,18,27,0.52)';
  ctx.beginPath();
  ctx.moveTo(cx - 6.4, 28);
  ctx.lineTo(cx - 2.6, 27);
  ctx.lineTo(cx - 3.6, 43);
  ctx.lineTo(cx - 5, 41);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 6.4, 28);
  ctx.lineTo(cx + 2.6, 27);
  ctx.lineTo(cx + 3.6, 43);
  ctx.lineTo(cx + 5, 41);
  ctx.closePath();
  ctx.fill();

  // Cockpit canopy.
  const cg = ctx.createRadialGradient(cx - 1, 16.5, 0.5, cx, 20, 8);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.35, '#bdf6ff');
  cg.addColorStop(0.8, '#2dbde6');
  cg.addColorStop(1, '#14506e');
  ctx.fillStyle = cg;
  ctx.strokeStyle = 'rgba(220,250,255,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx, 19.5, 3.4, 7.2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // Engine block.
  ctx.fillStyle = '#273946';
  roundRectPath(ctx, cx - 7, 44, 14, 5, 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  for (const side of [-1, 1]) {
    const ex = cx + side * 4.5;
    ctx.fillStyle = '#0d161e';
    ctx.beginPath();
    ctx.arc(ex, 48, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.arc(ex, 48, 1.1, 0, TAU);
    ctx.fill();
  }

  // Nose light and spine.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx, 7);
  ctx.lineTo(cx, 13);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, 4.6, 1.1, 0, TAU);
  ctx.fill();

  // Small amber accents.
  ctx.fillStyle = amber;
  ctx.fillRect(cx - 1, 33, 2, 3);
  ctx.fillStyle = 'rgba(255,200,100,0.8)';
  ctx.beginPath();
  ctx.arc(cx - 4, 39, 0.8, 0, TAU);
  ctx.arc(cx + 4, 39, 0.8, 0, TAU);
  ctx.fill();

  return S;
}


const Sprites = {
  bulletCache: new Map(),
  droneCache: new Map(),
  bossCache: new Map(),
  items: {},
  player: null,
  shotNeedle: null,
  shotBolt: null,

  init() {
    this.player = makePlayer();
    this.shotNeedle = makeShotNeedle();
    this.shotBolt = makeShotBolt();
    this.items.power = makeItem('power');
    this.items.point = makeItem('point');
    this.items.powerBig = makeItem('powerBig');
  },

  bullet(color, shape) {
    const key = color + '_' + shape;
    let s = this.bulletCache.get(key);
    if (!s) {
      s = bulletSprite(color, shape);
      this.bulletCache.set(key, s);
    }
    return s;
  },

  drone(color) {
    let s = this.droneCache.get(color);
    if (!s) {
      s = [makeDrone(color, 0), makeDrone(color, 1)];
      this.droneCache.set(color, s);
    }
    return s;
  },

  boss(kind) {
    let s = this.bossCache.get(kind);
    if (!s) {
      s = makeBoss(kind);
      this.bossCache.set(kind, s);
    }
    return s;
  },
};
