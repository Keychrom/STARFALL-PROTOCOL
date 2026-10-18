'use strict';

/* ------------------------------------------------------------------
 *  Audio: original BGM tracks + synthesized sound effects.
 *  BGM streams from audio/bgm/; SFX are generated with Web Audio.
 * ------------------------------------------------------------------ */

const TRACKS = {
  title:  { file: 'title.mp3',  title: 'ORBITAL BRIEFING' },
  stage1: { file: 'stage1.mp3', title: 'DEBRIS SWARM' },
  boss1:  { file: 'boss1.mp3',  title: 'AEGIS HEAVY ASSAULT' },
  stage2: { file: 'stage2.mp3', title: 'GATE APPROACH' },
  boss2:  { file: 'boss2.mp3',  title: 'NOVA FINAL ORBIT' },
  ending: { file: 'ending.mp3', title: 'PROTOCOL COMPLETE' },
};

const AudioSys = {
  ctx: null,
  master: null,
  sfx: null,
  comp: null,
  noiseBuf: null,
  ready: false,
  muted: false,
  track: null,
  pendingTrack: null,
  bgm: null,
  bgmVolume: 0.5,
  sfxVolume: 1.0,
  _lastSfx: Object.create(null),

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.resumeBgm();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.muted = !!Storage.get('gdr_muted', false);
    const savedBgm = Number(Storage.get('gdr_bgm_vol', this.bgmVolume));
    const savedSfx = Number(Storage.get('gdr_sfx_vol', this.sfxVolume));
    this.bgmVolume = Number.isFinite(savedBgm) ? clamp(savedBgm, 0, 1) : 0.5;
    this.sfxVolume = Number.isFinite(savedSfx) ? clamp(savedSfx, 0, 1) : 1.0;

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -20;
    this.comp.knee.value = 26;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;
    this.comp.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72 * this.sfxVolume;
    this.master.connect(this.comp);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.55;
    this.sfx.connect(this.master);

    this.noiseBuf = this._makeNoise();
    this.ready = true;

    if (this.pendingTrack) {
      const t = this.pendingTrack;
      this.pendingTrack = null;
      this.playTrack(t);
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    Storage.set('gdr_muted', this.muted);
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72 * this.sfxVolume, t, 0.03);
    }
    if (this.bgm) this.bgm.volume = this.muted ? 0 : this.bgmVolume;
    if (!this.muted) this.resumeBgm();
    return this.muted;
  },

  setBgmVolume(value) {
    this.bgmVolume = clamp(value, 0, 1);
    Storage.set('gdr_bgm_vol', this.bgmVolume);
    if (this.bgm) this.bgm.volume = this.muted ? 0 : this.bgmVolume;
  },

  setSfxVolume(value) {
    this.sfxVolume = clamp(value, 0, 1);
    Storage.set('gdr_sfx_vol', this.sfxVolume);
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72 * this.sfxVolume, t, 0.03);
    }
  },

  resetVolumes() {
    this.setBgmVolume(0.5);
    this.setSfxVolume(1.0);
  },

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  /* ---------------- music ---------------- */

  playTrack(name) {
    const def = TRACKS[name];
    if (!def) return;
    if (!this.ctx) { this.pendingTrack = name; return; }
    if (this.track === name && this.bgm) {
      this.resumeBgm();
      return;
    }

    this.track = name;
    this.pendingTrack = null;

    if (this.bgm) this.bgm.pause();

    const audio = new Audio(`audio/bgm/${def.file}`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.muted ? 0 : this.bgmVolume;
    audio.addEventListener('error', () => {
      console.warn(`[audio] BGM load failed: ${def.file}`);
    });
    this.bgm = audio;
    this.resumeBgm();
  },

  resumeBgm() {
    if (!this.bgm || !this.bgm.paused) return;
    const p = this.bgm.play();
    if (p && p.catch) p.catch(() => {});
  },

  stopMusic() {
    this.track = null;
    this.pendingTrack = null;
    if (this.bgm) this.bgm.pause();
  },

  _tone(freq, t, dur, type, gain, dest, opts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    dur = Math.max(dur, 0.03);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    }
    const atk = opts.attack ?? 0.005;
    const rel = opts.release ?? 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + atk);
    g.gain.setValueAtTime(gain, t + Math.max(atk + 0.001, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let node = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      f.Q.value = 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  _noise(t, dur, gain, hp, dest) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, rnd(0, 0.6));
    src.stop(t + dur + 0.02);
  },

  /* ---------------- sound effects ---------------- */

  _ok(key, gapMs) {
    const now = performance.now();
    if (this._lastSfx[key] !== undefined && now - this._lastSfx[key] < gapMs) return false;
    this._lastSfx[key] = now;
    return true;
  },

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
    const t = this.ctx.currentTime + 0.001;
    const d = this.sfx;
    switch (name) {
      case 'shot':
        if (!this._ok('shot', 90)) return;
        this._tone(1350, t, 0.045, 'square', 0.012, d, { slideTo: 850, filter: 2600 });
        break;
      case 'nearMiss':
        if (!this._ok('nearMiss', 45)) return;
        this._tone(2350, t, 0.04, 'sine', 0.026, d, { slideTo: 2950 });
        break;
      case 'item':
        if (!this._ok('item', 55)) return;
        this._tone(1250, t, 0.075, 'sine', 0.035, d, { slideTo: 1850 });
        break;
      case 'hit':
        if (!this._ok('hit', 35)) return;
        this._tone(240, t, 0.035, 'square', 0.020, d, { slideTo: 160 });
        break;
      case 'enemyDown':
        if (!this._ok('enemyDown', 55)) return;
        this._noise(t, 0.16, 0.075, 700, d);
        this._tone(340, t, 0.18, 'sawtooth', 0.035, d, { slideTo: 70, filter: 1200 });
        break;
      case 'enemyHit':
        if (!this._ok('enemyHit', 55)) return;
        this._tone(760, t, 0.055, 'triangle', 0.055, d, { slideTo: 540, filter: 2600 });
        break;
      case 'playerHit':
        this._noise(t, 0.5, 0.16, 300, d);
        this._tone(210, t, 0.55, 'sawtooth', 0.10, d, { slideTo: 45, filter: 1400 });
        this._tone(700, t, 0.2, 'square', 0.035, d, { slideTo: 180, filter: 2200 });
        break;
      case 'bomb':
        this._noise(t, 0.9, 0.16, 250, d);
        this._tone(95, t, 0.8, 'sine', 0.16, d, { slideTo: 30, attack: 0.01 });
        this._tone(880, t, 0.45, 'sine', 0.05, d, { slideTo: 1760, filter: 3200 });
        this._noise(t + 0.16, 0.55, 0.08, 2200, d);
        break;
      case 'phase':
        // Tactical alert: two clipped warning beeps.
        this._tone(880, t, 0.1, 'square', 0.045, d, { filter: 2600 });
        this._tone(660, t + 0.14, 0.16, 'square', 0.05, d, { filter: 2200 });
        this._tone(95, t + 0.02, 0.3, 'sine', 0.09, d, { slideTo: 55 });
        this._noise(t, 0.25, 0.035, 3200, d);
        break;
      case 'perfect':
        [988, 1319, 1568, 1976].forEach((f, i) => {
          this._tone(f, t + i * 0.055, 0.55, 'triangle', 0.055, d, { release: 0.3 });
        });
        this._noise(t, 0.3, 0.03, 5600, d);
        break;
      case 'select':
        this._tone(760, t, 0.08, 'triangle', 0.05, d, { slideTo: 1180 });
        break;
      case 'start':
        [523, 659, 784, 1046].forEach((f, i) => {
          this._tone(f, t + i * 0.06, 0.5, 'triangle', 0.055, d, { release: 0.3 });
        });
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => {
          this._tone(f, t + i * 0.22, 0.8, 'triangle', 0.07, d, { release: 0.5, filter: 1200 });
        });
        break;
      case 'clear':
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this._tone(f, t + i * 0.09, 1.0, 'sine', 0.055, d, { release: 0.6 });
        });
        break;
      case 'timeout':
        this._tone(240, t, 0.35, 'sawtooth', 0.05, d, { slideTo: 150, filter: 900 });
        break;
      case 'bossDown':
        this._noise(t, 1.4, 0.17, 200, d);
        this._tone(110, t, 1.4, 'sine', 0.12, d, { slideTo: 28 });
        for (let i = 0; i < 4; i++) {
          this._noise(t + 0.18 + i * 0.21, 0.35, 0.10, 900, d);
        }
        break;
      case 'phaseBreak':
        this._noise(t, 0.4, 0.09, 500, d);
        this._tone(520, t, 0.25, 'triangle', 0.04, d, { slideTo: 120 });
        break;
      default:
        break;
    }
  },
};
