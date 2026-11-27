import type { ActId } from '../types/festival';

export type FireworkSoundStyle = 'chrysanthemum' | 'willow' | 'doubleRing' | 'peony';

// D major pentatonic scale (宫商角徵羽) in Hz for warm guzheng / chime motif
const PENTATONIC_HZ = [
  293.66, // D4
  329.63, // E4
  369.99, // F#4
  440.0, // A4
  493.88, // B4
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  880.0, // A5
];

const MELODY_PATTERNS: Record<ActId, number[]> = {
  1: [0, 3, 2, 4, 5, 3, 2, 0],
  2: [3, 5, 6, 8, 6, 5, 4, 3],
  3: [5, 6, 8, 7, 5, 8, 6, 5],
  4: [5, 3, 4, 2, 3, 0, 2, 5],
};

export class FestiveAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = false;
  private currentAct: ActId = 1;
  private noteTimer: number | null = null;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.42;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      const ctx = this.ensureContext();
      if (ctx && this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
        this.masterGain.gain.setTargetAtTime(0.42, ctx.currentTime, 0.08);
      }
      this.startAmbientLoop();
      this.playChime(587.33, 0.14, 1.8);
    } else {
      this.stopAmbientLoop();
      if (this.ctx && this.masterGain) {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      }
    }
  }

  public setAct(act: ActId): void {
    if (this.currentAct === act) return;
    this.currentAct = act;
    if (this.enabled) {
      // Gentle warm bell chord marking act transition
      const root = act === 3 ? 440 : act === 4 ? 293.66 : 369.99;
      this.playChime(root, 0.13, 2.8);
      this.playChime(root * 1.5, 0.08, 2.4);
    }
  }

  private startAmbientLoop(): void {
    if (this.noteTimer !== null) return;
    const scheduleNext = () => {
      if (!this.enabled) return;
      const pattern = MELODY_PATTERNS[this.currentAct];
      const idx = pattern[this.stepIndex % pattern.length];
      this.stepIndex++;
      const freq = PENTATONIC_HZ[idx];
      const velocity = this.currentAct === 3 ? 0.11 : 0.085;
      this.playPluck(freq, velocity);
      if (this.stepIndex % 4 === 0) {
        this.playChime(PENTATONIC_HZ[0] * 0.5, 0.07, 3.2);
      }
      const interval = this.currentAct === 3 ? 950 : this.currentAct === 2 ? 1250 : 1550;
      this.noteTimer = window.setTimeout(scheduleNext, interval);
    };
    this.noteTimer = window.setTimeout(scheduleNext, 450);
  }

  private stopAmbientLoop(): void {
    if (this.noteTimer !== null) {
      window.clearTimeout(this.noteTimer);
      this.noteTimer = null;
    }
  }

  private playPluck(freq: number, gainLevel: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5.2, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.3), now + 1.4);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.value = 0.25;

    osc.connect(filter);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 2.3);
    overtone.stop(now + 2.3);
  }

  private playChime(freq: number, gainLevel: number, duration: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainLevel, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  public playLaunch(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.5;
    filter.frequency.setValueAtTime(420 + Math.random() * 180, now);
    filter.frequency.exponentialRampToValueAtTime(1650 + Math.random() * 350, now + 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(now);
    src.stop(now + 0.55);
  }

  public playBurst(style: FireworkSoundStyle, intensity = 1): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const amp = Math.min(1.2, Math.max(0.45, intensity));

    // 1. Resonant low thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    const basePitch = style === 'willow' ? 88 : style === 'doubleRing' ? 115 : 98;
    sub.frequency.setValueAtTime(basePitch * (0.92 + Math.random() * 0.16), now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.48);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.26 * amp, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.62);

    // 2. Airy bloom crackle
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(style === 'willow' ? 1400 : 2400, now);
    lp.frequency.exponentialRampToValueAtTime(280, now + (style === 'willow' ? 1.15 : 0.78));

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.linearRampToValueAtTime(0.22 * amp, now + 0.015);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + (style === 'willow' ? 1.2 : 0.85));

    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 1.25);

    // 3. Subtle sparkling shimmer pings for willow / peony
    if (style === 'willow' || style === 'peony') {
      for (let i = 0; i < 3; i++) {
        const delay = 0.14 + i * 0.11 + Math.random() * 0.08;
        const sparkleFreq = PENTATONIC_HZ[5 + (i % 4)] * 2;
        const osc = ctx.createOscillator();
        const sg = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(sparkleFreq, now + delay);
        sg.gain.setValueAtTime(0.0001, now + delay);
        sg.gain.linearRampToValueAtTime(0.028 * amp, now + delay + 0.01);
        sg.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
        osc.connect(sg);
        sg.connect(this.masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.38);
      }
    }
  }

  public dispose(): void {
    this.enabled = false;
    this.stopAmbientLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.noiseBuffer = null;
    }
  }
}
