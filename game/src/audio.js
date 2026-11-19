// Sound, synthesized with WebAudio only. No audio files, no network.
// Everything is guarded: sound must never block loading or play.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = 0;
    this.sirenOn = false;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  // Called on the first user gesture (or lazily); safe to call any time.
  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (_e) {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = m;
    if (m) this.stopEngine();
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (_e) { /* sound never breaks the game */ }
  }

  _noise(dur, vol, lowpass) {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = src;
      if (lowpass) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        src.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
    } catch (_e) { /* sound never breaks the game */ }
  }

  click() { this._tone(880, 0.06, 'square', 0.05); }
  punch() { this._noise(0.12, 0.25, 900); this._tone(140, 0.1, 'sine', 0.2, 60); }
  gunshot() { this._noise(0.16, 0.4, 2600); this._tone(220, 0.08, 'square', 0.12, 70); }
  pickup() { this._tone(660, 0.09, 'sine', 0.14); this._tone(990, 0.14, 'sine', 0.14); }
  crash() { this._noise(0.3, 0.35, 500); this._tone(90, 0.25, 'sine', 0.25, 40); }
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this._tone(n, 0.22, 'triangle', 0.16), i * 110);
    });
  }
  fail() { this._tone(330, 0.25, 'sawtooth', 0.1, 160); }

  // Continuous engine hum while driving; call every frame with speed 0..1.
  engine(speed01, driving) {
    if (this.muted || !this.ctx) { this.stopEngine(); return; }
    try {
      if (!driving || speed01 < 0.02) { this.stopEngine(); return; }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        this.engineOsc.connect(f);
        f.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.045 + speed01 * 0.05, t, 0.1);
    } catch (_e) { /* ignore */ }
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (_e) {}
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Two-tone siren while police are chasing; call every frame.
  siren(active, dt) {
    if (this.muted || !this.ctx || !active) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (_e) {}
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      this.sirenOn = false;
      return;
    }
    try {
      if (!this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);
        this.sirenOsc.start();
      }
      this.sirenTimer += dt;
      const hi = Math.floor(this.sirenTimer * 2.2) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 780 : 580, this.ctx.currentTime, 0.05);
    } catch (_e) { /* ignore */ }
  }
}
