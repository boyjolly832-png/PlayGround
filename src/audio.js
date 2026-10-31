export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambient = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this._ambient();
  }

  _ambient() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.connect(this.master);
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 82.6;
    const og = ctx.createGain();
    og.gain.value = 0.32;
    o1.connect(og); o2.connect(og); og.connect(g);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.12;
    lfo.connect(lg); lg.connect(og.gain);

    // airy room tone
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 420;
    const ng = ctx.createGain();
    ng.gain.value = 0.07;
    noise.connect(nf); nf.connect(ng); ng.connect(g);

    o1.start(); o2.start(); lfo.start(); noise.start();
    this.ambient = { g, o1, o2, lfo, noise };
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, t + 0.2);
    }
  }

  _env(dur, gain, attack = 0.008) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }

  tone(freq, dur = 0.12, { type = 'sine', gain = 0.18, slide = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = this._env(dur + delay, gain);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur = 0.2, { gain = 0.1, freq = 1200, q = 0.8, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this._env(dur + delay, gain, 0.004);
    src.connect(f); f.connect(g);
    src.start(t);
  }

  hover() { this.tone(1180, 0.035, { type: 'sine', gain: 0.035 }); }
  click() {
    this.tone(660, 0.06, { type: 'triangle', gain: 0.09, slide: 880 });
    this.tone(1320, 0.04, { type: 'sine', gain: 0.03, delay: 0.02 });
  }
  back() {
    this.tone(520, 0.1, { type: 'triangle', gain: 0.08, slide: 340 });
  }
  error() {
    this.tone(180, 0.18, { type: 'square', gain: 0.05, slide: 120 });
  }
  boot() {
    const notes = [174.6, 261.6, 349.2, 523.2, 698.5];
    notes.forEach((f, i) => this.tone(f, 1.4 - i * 0.08, { type: 'sine', gain: 0.09 - i * 0.008, delay: i * 0.11 }));
    this.tone(87.3, 2.4, { type: 'sine', gain: 0.06 });
    this.noise(1.2, { gain: 0.03, freq: 3000, q: 0.4 });
  }
  launch() {
    this.tone(220, 0.5, { type: 'sawtooth', gain: 0.045, slide: 880 });
    this.noise(0.45, { gain: 0.05, freq: 900 });
    [523.2, 659.2, 783.9].forEach((f, i) => this.tone(f, 0.7, { type: 'sine', gain: 0.06, delay: 0.08 + i * 0.06 }));
  }
  powerDown() {
    this.tone(420, 0.55, { type: 'sine', gain: 0.08, slide: 70 });
    this.noise(0.5, { gain: 0.04, freq: 500 });
  }
  coin() {
    this.tone(1046, 0.08, { type: 'square', gain: 0.035 });
    this.tone(1568, 0.12, { type: 'square', gain: 0.03, delay: 0.06 });
  }
  hit() {
    this.noise(0.15, { gain: 0.06, freq: 260, q: 0.6 });
    this.tone(120, 0.16, { type: 'sine', gain: 0.08, slide: 60 });
  }
}
