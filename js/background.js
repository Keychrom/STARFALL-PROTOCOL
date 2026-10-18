'use strict';

/* ------------------------------------------------------------------
 *  Scrolling space scenery: stars, planets, dust streaks, asteroids.
 * ------------------------------------------------------------------ */

const BG_THEMES = {
  title: {
    top: '#02050d', mid: '#061427', bottom: '#0a1c2c',
    planet: { x: 0.79, y: 0.23, r: 78, core: '#a3d2e8', glow: 'rgba(90,190,255,0.20)', craters: false, ring: true },
    stars: 130, dust: 34, dustColor: 'ice', clouds: 5, rocks: 0,
    nebula: ['rgba(25,90,135,0.16)', 'rgba(35,55,140,0.12)'],
    cloudColor: 'rgba(110,175,225,0.08)',
  },
  debris: {
    top: '#02040a', mid: '#07121e', bottom: '#0c1926',
    planet: { x: 0.78, y: 0.19, r: 72, core: '#f2ce9c', glow: 'rgba(255,165,85,0.16)', craters: true, ring: false },
    stars: 100, dust: 38, dustColor: 'amber', clouds: 4, rocks: 3,
    nebula: ['rgba(25,80,125,0.16)', 'rgba(115,65,35,0.10)'],
    cloudColor: 'rgba(130,165,195,0.06)',
  },
  orbit: {
    top: '#01030a', mid: '#051027', bottom: '#091532',
    planet: { x: 0.69, y: 0.19, r: 98, core: '#aecdec', glow: 'rgba(95,165,255,0.18)', craters: true, ring: true },
    stars: 150, dust: 24, dustColor: 'ice', clouds: 4, rocks: 0,
    nebula: ['rgba(20,65,150,0.17)', 'rgba(65,35,120,0.10)'],
    cloudColor: 'rgba(110,160,225,0.07)',
  },
  ending: {
    top: '#030811', mid: '#0a1a29', bottom: '#183646',
    planet: { x: 0.30, y: 0.26, r: 80, core: '#ffe1ba', glow: 'rgba(255,175,105,0.22)', craters: false, ring: true },
    stars: 120, dust: 30, dustColor: 'amber', clouds: 5, rocks: 0,
    nebula: ['rgba(80,70,120,0.15)', 'rgba(30,90,130,0.12)'],
    cloudColor: 'rgba(160,185,215,0.07)',
  },
};

class Background {
  constructor(theme, w, h) {
    this.w = w;
    this.h = h;
    this.time = 0;
    this.setTheme(theme);
  }

  setTheme(theme) {
    this.themeName = theme;
    this.cfg = BG_THEMES[theme] || BG_THEMES.debris;
    this.stars = [];
    for (let i = 0; i < this.cfg.stars; i++) {
      this.stars.push({
        x: rnd(this.w), y: rnd(this.h),
        z: rnd(0.25, 1), size: rnd(0.5, 1.8),
        tw: rnd(TAU), tws: rnd(0.4, 1.7),
        warm: Math.random() < 0.12,
      });
    }
    this.dust = [];
    for (let i = 0; i < this.cfg.dust; i++) {
      this.dust.push(this._newDust(rnd(this.h)));
    }
    this.clouds = [];
    for (let i = 0; i < this.cfg.clouds; i++) {
      this.clouds.push({
        x: rnd(-80, this.w - 80),
        y: rnd(this.h),
        s: rnd(0.55, 1.5),
        spd: rnd(4, 12),
        alpha: rnd(0.5, 1),
      });
    }
    this.rocks = [];
    for (let i = 0; i < (this.cfg.rocks || 0); i++) {
      this.rocks.push(this._newRock(i));
    }
  }

  _newDust(y) {
    const warm = this.cfg.dustColor === 'amber';
    return {
      x: rnd(this.w),
      y,
      size: rnd(2.2, 6.5),
      vy: rnd(30, 80),
      drift: rnd(0.4, 1.6),
      phase: rnd(TAU),
      rot: rnd(TAU),
      vr: rnd(-1.0, 1.0),
      alpha: rnd(0.22, 0.6),
      warm,
    };
  }

  _newRock(i) {
    const verts = [];
    const n = 9;
    for (let k = 0; k < n; k++) {
      verts.push(rnd(0.7, 1.15));
    }
    const craters = [];
    for (let k = 0; k < 3; k++) {
      craters.push({ x: rnd(-0.45, 0.45), y: rnd(-0.4, 0.4), r: rnd(0.06, 0.16) });
    }
    return {
      x: this.w * (i === 0 ? rnd(0.12, 0.3) : rnd(0.65, 0.9)),
      y: rnd(this.h),
      s: rnd(38, 82),
      spd: rnd(8, 16),
      alpha: rnd(0.45, 0.72),
      rot: rnd(TAU),
      vr: rnd(-0.05, 0.05),
      verts,
      craters,
    };
  }

  update(dt, speed = 1) {
    this.time += dt;
    const H = this.h;
    for (const s of this.stars) {
      s.y += (8 + s.z * 26) * speed * dt;
      if (s.y > H + 2) { s.y = -2; s.x = rnd(this.w); }
    }
    for (const p of this.dust) {
      p.y += p.vy * speed * dt;
      p.phase += dt;
      p.x += Math.sin(p.phase * 1.3) * p.drift * 22 * dt + 6 * speed * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 14) Object.assign(p, this._newDust(-14));
      if (p.x > this.w + 14) p.x = -14;
      if (p.x < -14) p.x = this.w + 14;
    }
    for (const c of this.clouds) {
      c.y += c.spd * speed * dt;
      if (c.y > H + 100) { c.y = -120; c.x = rnd(-80, this.w - 80); }
    }
    for (const r of this.rocks) {
      r.y += r.spd * speed * dt;
      r.rot += r.vr * dt;
      if (r.y > H + r.s * 1.4) {
        r.y = -r.s * 1.6;
        r.x = rnd(this.w * 0.05, this.w * 0.95);
      }
    }
  }

  draw(ctx) {
    const { w, h, cfg } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, cfg.top);
    grad.addColorStop(0.55, cfg.mid);
    grad.addColorStop(1, cfg.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < cfg.nebula.length; i++) {
      const nx = w * (0.2 + i * 0.52);
      const ny = h * (0.34 + i * 0.2);
      const ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, w * 0.52);
      ng.addColorStop(0, cfg.nebula[i]);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, w, h);
    }

    this._drawStars(ctx);
    this._drawRocks(ctx);
    this._drawPlanet(ctx);
    this._drawClouds(ctx);
    this._drawDust(ctx);

    const mist = ctx.createLinearGradient(0, h * 0.74, 0, h);
    mist.addColorStop(0, 'rgba(2,5,12,0)');
    mist.addColorStop(1, 'rgba(1,3,8,0.55)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.74, w, h * 0.26);

    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,2,6,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  _drawPlanet(ctx) {
    const m = this.cfg.planet;
    if (!m) return;
    const x = this.w * m.x;
    const y = this.h * m.y;
    const r = m.r;

    const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.0);
    glow.addColorStop(0, m.glow);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.0, 0, TAU);
    ctx.fill();

    if (m.ring) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.34);
      ctx.scale(1, 0.26);
      ctx.strokeStyle = 'rgba(150,205,235,0.14)';
      ctx.lineWidth = r * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,235,250,0.12)';
      ctx.lineWidth = r * 0.035;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.96, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
    disc.addColorStop(0, '#ffffff');
    disc.addColorStop(0.5, m.core);
    disc.addColorStop(0.9, rgba('#8fa6bb', 0.9));
    disc.addColorStop(1, rgba('#5f7288', 0.25));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();

    if (m.craters) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.98, 0, TAU);
      ctx.clip();
      ctx.fillStyle = 'rgba(90,110,130,0.18)';
      const cs = [
        [-0.3, -0.1, 0.16], [0.22, 0.25, 0.22], [0.05, -0.42, 0.1],
        [0.4, -0.15, 0.08], [-0.15, 0.4, 0.12], [-0.5, 0.22, 0.07],
      ];
      for (const [dx, dy, rr] of cs) {
        ctx.beginPath();
        ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (m.ring) {
      // Front half of the ring.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.34);
      ctx.scale(1, 0.26);
      ctx.strokeStyle = 'rgba(170,215,240,0.20)';
      ctx.lineWidth = r * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, 0.06, Math.PI - 0.06);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(220,245,255,0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, TAU);
    ctx.stroke();
  }

  _drawStars(ctx) {
    for (const s of this.stars) {
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * s.tws + s.tw));
      ctx.globalAlpha = tw * (0.3 + s.z * 0.6);
      ctx.fillStyle = s.warm ? '#ffe0b0' : (s.z > 0.7 ? '#f4feff' : '#cfe6f5');
      if (s.size > 1.4) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  _drawClouds(ctx) {
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha * 0.8;
      const cw = 300 * c.s;
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.3);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, cw * 0.5);
      g.addColorStop(0, this.cfg.cloudColor);
      g.addColorStop(0.6, this.cfg.cloudColor.replace(/[\d.]+\)$/, '0.035)'));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, cw * 0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawRocks(ctx) {
    for (const r of this.rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.globalAlpha = r.alpha;
      const n = r.verts.length;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rad = r.s * r.verts[i];
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad * 0.72;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(-r.s, -r.s, r.s, r.s);
      g.addColorStop(0, '#263443');
      g.addColorStop(1, '#0d1720');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,185,210,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(5,10,16,0.5)';
      for (const c of r.craters) {
        ctx.beginPath();
        ctx.ellipse(c.x * r.s, c.y * r.s, c.r * r.s, c.r * r.s * 0.7, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _drawDust(ctx) {
    for (const p of this.dust) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      const col = p.warm ? '255,195,110' : '170,230,255';
      const g = ctx.createLinearGradient(0, -p.size * 2, 0, p.size * 2);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.45, `rgba(${col},0.8)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 2.2);
      ctx.lineTo(0, p.size * 2.2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${col},0.9)`;
      ctx.beginPath();
      ctx.arc(0, 0, 1.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
