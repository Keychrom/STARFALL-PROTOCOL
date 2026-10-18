'use strict';

/* ------------------------------------------------------------------
 *  Procedural audio: synthesized SFX + looping chip-style BGM.
 *  No external audio assets. AudioContext is unlocked on first input.
 * ------------------------------------------------------------------ */

const TRACKS = {
  title: {
    bpm: 72,
    chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']],
    arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 2, 1, 3, 2, 3, 1, 2],
    arpGain: 0.020, arpOct: 2, bass: 'half', drums: false, pad: true, soft: true,
  },
  stage1: {
    bpm: 148,
    chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']],
    arp: [0, 2, 1, 3, 2, 1, 3, 2, 0, 1, 2, 3, 2, 3, 1, 2],
    arpGain: 0.018, arpOct: 2, bass: '8th', drums: true, pad: false,
  },
  boss1: {
    bpm: 162,
    chords: [[50, 'm'], [46, 'M'], [48, 'M'], [45, 'm']],
    arp: [0, 2, 1, 3, 1, 2, 3, 1, 0, 3, 2, 1, 2, 3, 1, 3],
    arpGain: 0.021, arpOct: 2, bass: 'drive', drums: true, pad: true, tension: true,
  },
  stage2: {
    bpm: 152,
    chords: [[52, 'm'], [48, 'M'], [50, 'M'], [47, 'M']],
    arp: [0, 1, 2, 3, 1, 3, 2, 1, 0, 2, 1, 3, 3, 2, 1, 2],
    arpGain: 0.019, arpOct: 2, bass: '8th', drums: true, pad: false, soft: false,
  },
  boss2: {
    bpm: 168,
    chords: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'M']],
    arp: [0, 3, 1, 2, 3, 1, 2, 3, 0, 2, 3, 1, 3, 2, 1, 3],
    arpGain: 0.022, arpOct: 2, bass: 'drive', drums: true, pad: true, tension: true,
  },
  ending: {
    bpm: 82,
    chords: [[53, 'M'], [48, 'M'], [55, 'M'], [57, 'm']],
    arp: [0, 2, 1, 3, 2, 3, 1, 2, 0, 1, 2, 3, 3, 2, 1, 2],
    arpGain: 0.019, arpOct: 2, bass: 'half', drums: false, pad: true, soft: true,
  },
};

const MUSIC_KEYS = [0, 3, 7, 12];

const AudioSys = {
  ctx: null,
  master: null,
  music: null,
  sfx: null,
  comp: null,
  noiseBuf: null,
  ready: false,
  muted: false,
  track: null,
  pendingTrack: null,
  step: 0,
  stepDur: 0.1,
  nextStepTime: 0,
  timer: null,
  _lastSfx: Object.create(null),

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
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

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -20;
    this.comp.knee.value = 26;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;
    this.comp.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    this.master.connect(this.comp);

    this.music = this.ctx.createGain();
    this.music.gain.value = 0.38;
    this.music.connect(this.master);

    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.55;
    this.sfx.connect(this.master);

    this.noiseBuf = this._makeNoise();
    this.ready = true;
    this.timer = setInterval(() => this._scheduler(), 55);

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
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, t, 0.03);
    }
    return this.muted;
  },

  hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); },

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
    if (this.track === name) return;
    this.track = name;
    this.step = 0;
    this.stepDur = 60 / def.bpm / 4;
    this.nextStepTime = this.ctx.currentTime + 0.06;
  },

  stopMusic() { this.track = null; },

  _scheduler() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.track) return;
    if (this.nextStepTime < ctx.currentTime - 0.25) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }
    const horizon = ctx.currentTime + 0.2;
    let guard = 0;
    while (this.nextStepTime < horizon && guard < 32) {
      this._scheduleStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.step++;
      guard++;
    }
  },

  _scheduleStep(step, t) {
    const def = TRACKS[this.track];
    if (!def) return;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const [root, quality] = def.chords[bar % def.chords.length];
    const third = quality === 'm' ? 3 : 4;
    const tones = [0, third, 7, 12];

    // Pad chord at the top of each bar.
    if (def.pad && s === 0) {
      const barDur = this.stepDur * 16;
      for (let i = 0; i < 3; i++) {
        this._tone(this.hz(root + 12 + tones[i]), t, barDur * 0.98,
          'triangle', def.soft ? 0.013 : 0.010, this.music,
          { attack: 0.14, release: 0.5, filter: 1000 });
      }
    }

    // Bass line.
    if (def.bass === 'half') {
      if (s === 0 || s === 8) {
        this._tone(this.hz(root - 12), t, this.stepDur * 7, 'triangle', 0.055, this.music,
          { attack: 0.012, release: 0.12, filter: 420 });
      }
    } else if (def.bass === '8th') {
      if (s % 4 === 0) {
        const n = (s === 8) ? root - 12 + 7 : root - 12;
        this._tone(this.hz(n), t, this.stepDur * 3.2, 'triangle', 0.060, this.music,
          { attack: 0.008, release: 0.08, filter: 520 });
      }
    } else if (def.bass === 'drive') {
      if (s % 2 === 0) {
        const n = (s % 8 === 4) ? root - 5 : root - 12;
        this._tone(this.hz(n), t, this.stepDur * 1.5, 'square', 0.030, this.music,
          { attack: 0.004, release: 0.05, filter: 400 });
      }
    }

    // Arpeggio sparkle.
    if (!(def.soft && s % 2 === 1)) {
      const idx = def.arp[s] % 4;
      let n = root + def.arpOct * 12 + tones[idx];
      if (def.tension && s % 8 === 7) n += 12;
      this._tone(this.hz(n), t, this.stepDur * (def.soft ? 3.4 : 1.7),
        def.soft ? 'sine' : 'square',
        def.arpGain * (s % 4 === 0 ? 1.25 : 0.85), this.music,
        { attack: 0.004, release: def.soft ? 0.25 : 0.05, filter: def.soft ? 2400 : 3200 });
    }

    // A shy high counter-melody on boss tracks.
    if (def.tension && s === 10) {
      this._tone(this.hz(root + 24 + third), t, this.stepDur * 5, 'sine', 0.014, this.music,
        { attack: 0.02, release: 0.3, filter: 4000 });
    }

    if (!def.drums) return;

    // Percussion.
    if (s === 0 || s === 8) {
      this._kick(t, s === 0 ? 0.20 : 0.14);
    }
    if (s === 4 || s === 12) {
      this._noise(t, 0.12, s === 12 ? 0.055 : 0.040, 1400, this.music);
    }
    if (s % 2 === 0) {
      this._noise(t, 0.028, s % 4 === 2 ? 0.020 : 0.013, 6500, this.music);
    }
  },

  _kick(t, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.music);
    osc.start(t);
    osc.stop(t + 0.18);
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
