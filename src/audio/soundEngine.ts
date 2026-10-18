/**
 * Procedural Web Audio Sound Engine
 * Zero external audio files (Zero 404s)
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.7, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Pistol & Rifle Gunshot
  public playGunshot(type: 'standard' | 'heavy' | 'suppressed' | 'rifle') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (type === 'suppressed') {
      // Suppressed "phut-click"
      const noiseBuffer = this.createNoiseBuffer(0.12);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);

      // Mechanical click
      this.playMechanicalClick(t + 0.04, 800, 0.03);
      return;
    }

    if (type === 'rifle') {
      // AK-47 / Assault Rifle 7.62mm sharp crack and heavy bolt
      const duration = 0.32;
      const noiseBuffer = this.createNoiseBuffer(duration);
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, t);
      filter.Q.setValueAtTime(1.5, t);
      filter.frequency.exponentialRampToValueAtTime(200, t + duration * 0.7);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);

      // Punchy Sub
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.2);

      oscGain.gain.setValueAtTime(1.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.25);

      this.playMechanicalClick(t + 0.05, 1400, 0.04);
      return;
    }

    const isHeavy = type === 'heavy';
    const duration = isHeavy ? 0.45 : 0.28;

    // 1. Transient noise burst
    const noiseBuffer = this.createNoiseBuffer(duration);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(isHeavy ? 1800 : 2800, t);
    noiseFilter.Q.setValueAtTime(1.2, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(150, t + duration * 0.7);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(isHeavy ? 1.6 : 1.1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.8);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);

    // 2. Punchy Sub Oscillator (kick/body)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = isHeavy ? 'triangle' : 'sine';
    const startFreq = isHeavy ? 260 : 180;
    const endFreq = isHeavy ? 24 : 35;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.5);

    oscGain.gain.setValueAtTime(isHeavy ? 1.8 : 1.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);

    // 3. Slide Cycle clack
    this.playMechanicalClick(t + 0.08, 1200, 0.04);
  }

  // Bot Punch melee attack sound
  public playPunchSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    gain.gain.setValueAtTime(1.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);

    // Impact slap/crunch
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
  }

  // Player hurt damage sound
  public playPlayerHurt() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    gain.gain.setValueAtTime(1.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  // Impact sound when bullet hits body
  public playHitSound(isFatal: boolean, zone: string) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Meaty flesh impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(zone === 'head' ? 320 : 180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);

    // Impact crunch noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(zone === 'head' ? 2200 : 900, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);

    // If headshot: crisp confirmation bell / ding
    if (zone === 'head') {
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(1760, t); // A6
      bellGain.gain.setValueAtTime(0.4, t);
      bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      bell.connect(bellGain);
      bellGain.connect(this.masterGain);
      bell.start(t);
      bell.stop(t + 0.35);
    }
  }

  // Ragdoll body hitting floor
  public playBodyThud(intensity: number = 1.0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);

    const vol = Math.min(1.0, 0.4 * intensity);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Dry Fire / Empty Click
  public playDryFire() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    this.playMechanicalClick(this.ctx.currentTime, 1600, 0.03);
  }

  // Reload sound
  public playReload() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Mag release
    this.playMechanicalClick(t, 900, 0.05);
    // Mag insert
    this.playMechanicalClick(t + 0.45, 1100, 0.08);
    // Slide rack
    setTimeout(() => {
      if (this.ctx) {
        this.playMechanicalClick(this.ctx.currentTime, 1500, 0.06);
        setTimeout(() => {
          if (this.ctx) this.playMechanicalClick(this.ctx.currentTime, 850, 0.08);
        }, 120);
      }
    }, 800);
  }

  // Bullet time whoosh
  public playBulletTime(enter: boolean) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (enter) {
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.4);
    } else {
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.3);
    }

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  private playMechanicalClick(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, time + duration);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.ctx) {
      throw new Error('AudioContext is not initialized');
    }
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const soundEngine = new SoundEngine();
