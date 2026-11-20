// WebAudio engine: synthesized sound effects (no sample files needed).
import { MusicPlayer } from './music.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.8;
    this.lastPlay = {};
    this.music = null;
    this.pendingSong = null;
  }

  // Must be called from a user gesture (mobile autoplay policy).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.music = new MusicPlayer(this.ctx, this.musicGain, this.noise);
    if (this.pendingSong) this.playMusic(this.pendingSong);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.musicVol * 0.5;
    this.sfxGain.gain.value = this.sfxVol * 0.9;
  }

  playMusic(name) {
    this.pendingSong = name;
    if (this.music) this.music.play(name);
  }

  stopMusic() {
    this.pendingSong = null;
    if (this.music) this.music.stop();
  }

  setTempoBoost(f) { if (this.music) this.music.tempoBoost = f; }

  pause(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }

  // --- primitives
  osc(type, f0, f1, dur, vol, t0 = 0, dest = this.sfxGain) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, f0, f1, t0 = 0, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime + t0;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  throttle(name, gap) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return false;
    this.lastPlay[name] = now;
    return true;
  }

  // --- effects
  play(name, opt = {}) {
    if (!this.ctx || this.sfxVol <= 0) return;
    switch (name) {
      case 'place':
        this.osc('sine', 220, 70, 0.14, 0.6);
        this.noiseBurst(0.05, 0.25, 2000, 400);
        break;
      case 'tick':
        if (!this.throttle('tick', 110)) return;
        this.osc('square', opt.fast ? 1500 : 1100, opt.fast ? 1500 : 1100, 0.025, 0.07);
        break;
      case 'explode': {
        if (!this.throttle('explode', 45)) return;
        const big = Math.min(1, 0.55 + (opt.chain || 1) * 0.12);
        this.noiseBurst(0.7, 0.9 * big, 3200, 120);
        this.osc('sine', 110, 30, 0.5, 0.9 * big);
        this.osc('square', 70, 35, 0.25, 0.18 * big);
        break;
      }
      case 'brick':
        if (!this.throttle('brick', 40)) return;
        this.noiseBurst(0.18, 0.25, 1400, 300, 0.03, 'bandpass');
        break;
      case 'pickup':
        [0, 0.06, 0.12].forEach((t, i) => this.osc('square', [660, 880, 1320][i], [660, 880, 1320][i], 0.09, 0.18, t));
        this.osc('triangle', 1760, 1760, 0.2, 0.15, 0.18);
        break;
      case 'death':
        this.osc('square', 700, 90, 0.7, 0.25);
        this.osc('triangle', 520, 60, 0.8, 0.3, 0.05);
        this.noiseBurst(0.3, 0.3, 2000, 200, 0);
        break;
      case 'kick':
        this.noiseBurst(0.08, 0.4, 900, 200);
        this.osc('triangle', 300, 120, 0.1, 0.3);
        break;
      case 'remote':
        this.osc('square', 1200, 1800, 0.06, 0.15);
        this.osc('square', 1800, 1200, 0.06, 0.15, 0.07);
        break;
      case 'count':
        this.osc('square', 440, 440, 0.12, 0.2);
        break;
      case 'start':
        this.osc('square', 880, 880, 0.3, 0.22);
        this.osc('triangle', 1760, 1760, 0.3, 0.12);
        break;
      case 'hurry':
        for (let i = 0; i < 4; i++) this.osc('square', i % 2 ? 660 : 880, i % 2 ? 660 : 880, 0.14, 0.2, i * 0.16);
        break;
      case 'wall':
        if (!this.throttle('wall', 60)) return;
        this.osc('sine', 90, 45, 0.15, 0.4);
        this.noiseBurst(0.12, 0.2, 600, 100);
        break;
      case 'win': {
        const seq = [523, 659, 784, 1047, 0, 784, 1047];
        seq.forEach((f, i) => { if (f) this.osc('square', f, f, i === seq.length - 1 ? 0.6 : 0.14, 0.2, i * 0.13); });
        [262, 330, 392, 523].forEach((f, i) => this.osc('triangle', f, f, 0.3, 0.25, i * 0.26));
        break;
      }
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.osc('square', f, f * 0.98, 0.25, 0.18, i * 0.22));
        break;
      case 'teleport':
        this.osc('sine', 300, 1600, 0.25, 0.25);
        this.osc('triangle', 1600, 400, 0.25, 0.15, 0.12);
        break;
      case 'shield':
        this.osc('square', 1200, 300, 0.3, 0.2);
        this.noiseBurst(0.2, 0.25, 6000, 1000, 0, 'highpass');
        break;
      case 'curse':
        [0, 0.12, 0.24].forEach((t, i) => this.osc('square', [400, 380, 300][i], [380, 300, 150][i], 0.14, 0.18, t));
        break;
      case 'event':
        [523, 784, 523, 784].forEach((f, i) => this.osc('square', f, f, 0.1, 0.18, i * 0.1));
        break;
      case 'monster':
        if (!this.throttle('monster', 60)) return;
        this.osc('square', 900, 200, 0.18, 0.2);
        this.osc('triangle', 1400, 1400, 0.08, 0.15, 0.05);
        break;
      case 'door':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, f, 0.12, 0.25, i * 0.07));
        break;
      case 'bossHit':
        this.osc('square', 220, 60, 0.35, 0.3);
        this.noiseBurst(0.25, 0.5, 2500, 300);
        this.osc('triangle', 880, 440, 0.15, 0.2, 0.05);
        break;
      case 'bossDeath':
        for (let i = 0; i < 6; i++) this.noiseBurst(0.6, 0.6, 3000, 100, i * 0.18);
        for (let i = 0; i < 6; i++) this.osc('square', 600 - i * 80, 100, 0.3, 0.18, i * 0.18);
        break;
      case 'roar':
        if (!this.throttle('roar', 300)) return;
        this.osc('sawtooth', 160, 70, 0.45, 0.25);
        this.osc('square', 110, 55, 0.45, 0.12, 0.03);
        break;
      case 'click':
        this.osc('square', 900, 1200, 0.05, 0.12);
        break;
      case 'back':
        this.osc('square', 700, 450, 0.06, 0.12);
        break;
      default:
    }
  }
}

export const audio = new AudioEngine();
