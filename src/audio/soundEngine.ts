// Procedural Web Audio API synthesizer for storm/thunder, scary investigation ambience, radio glitches, and tactile UI feedback

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private stormLevel: 1 | 2 | 3 = 1;

  // Investigation scary ambience nodes
  private horrorOsc1: OscillatorNode | null = null;
  private horrorOsc2: OscillatorNode | null = null;
  private horrorGain: GainNode | null = null;
  private horrorTimer: number | null = null;

  // Title menu theme nodes
  private menuTimer: number | null = null;
  private menuGain: GainNode | null = null;
  private menuStep = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds = 2, brown = false): AudioBuffer {
    const bufferSize = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        lastOut = (lastOut + 0.03 * white) / 1.03;
        data[i] = lastOut * 2.4;
      } else {
        lastOut = (lastOut + 0.08 * white) / 1.08;
        data[i] = lastOut * 1.4;
      }
    }
    return buffer;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) {
      const targetRain = muted ? 0 : this.getRainVolume();
      const targetWind = muted ? 0 : this.getWindVolume();
      if (this.rainGain) {
        this.rainGain.gain.setTargetAtTime(targetRain, this.ctx.currentTime, 0.08);
      }
      if (this.windGain) {
        this.windGain.gain.setTargetAtTime(targetWind, this.ctx.currentTime, 0.1);
      }
      if (this.horrorGain) {
        this.horrorGain.gain.setTargetAtTime(muted ? 0 : 0.055, this.ctx.currentTime, 0.1);
      }
      if (this.menuGain) {
        this.menuGain.gain.setTargetAtTime(muted ? 0 : 0.09, this.ctx.currentTime, 0.15);
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getRainVolume(): number {
    return this.stormLevel === 3 ? 0.065 : this.stormLevel === 2 ? 0.048 : 0.032;
  }

  private getWindVolume(): number {
    return this.stormLevel === 3 ? 0.042 : this.stormLevel === 2 ? 0.026 : 0.014;
  }

  public setStormIntensity(level: 1 | 2 | 3) {
    this.stormLevel = level;
    if (!this.ctx || this.muted) return;
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(this.getRainVolume(), this.ctx.currentTime, 0.5);
    }
    if (this.rainFilter) {
      const freq = level === 3 ? 1350 : level === 2 ? 1100 : 880;
      this.rainFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(this.getWindVolume(), this.ctx.currentTime, 0.6);
    }
  }

  public startAmbientRain() {
    const ctx = this.ensureContext();
    if (!ctx || this.rainSource) return;

    const rainNoise = ctx.createBufferSource();
    rainNoise.buffer = this.createNoiseBuffer(ctx, 2.5, false);
    rainNoise.loop = true;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 950;
    rainFilter.Q.value = 0.55;

    const rainGain = ctx.createGain();
    rainGain.gain.value = this.muted ? 0 : this.getRainVolume();

    rainNoise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(ctx.destination);
    rainNoise.start();

    const windNoise = ctx.createBufferSource();
    windNoise.buffer = this.createNoiseBuffer(ctx, 3.0, true);
    windNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 260;

    const windLfo = ctx.createOscillator();
    const windLfoGain = ctx.createGain();
    windLfo.frequency.value = 0.16;
    windLfoGain.gain.value = 110;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.value = this.muted ? 0 : this.getWindVolume();

    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windNoise.start();

    this.rainSource = rainNoise;
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
    this.windSource = windNoise;
    this.windGain = windGain;
  }

  public stopAmbientRain() {
    [this.rainSource, this.windSource].forEach((src) => {
      if (src) {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
    });
    this.rainSource = null;
    this.rainFilter = null;
    this.rainGain = null;
    this.windSource = null;
    this.windGain = null;
  }

  public startMenuMusic() {
    const ctx = this.ensureContext();
    if (!ctx || this.menuTimer !== null) return;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.09;
    master.connect(ctx.destination);
    this.menuGain = master;

    // Haunting D-minor mystery motif (piano/bell arpeggio + sub pad)
    const arpeggio = [
      293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 293.66, 261.63,
      233.08, 293.66, 349.23, 440.0, 392.0, 349.23, 329.63, 261.63,
    ];
    const bassRoots = [73.42, 73.42, 58.27, 65.41]; // D2, D2, Bb1, C2

    const tick = () => {
      if (!this.menuGain || !this.ctx) return;
      const now = this.ctx.currentTime;
      const idx = this.menuStep % arpeggio.length;
      const freq = arpeggio[idx];

      // Bell/piano note
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const nGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.9);
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.45, now + 0.025);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.menuGain);
      osc.start(now);
      osc.stop(now + 1.0);

      // Slow brooding bass pulse every 4 notes
      if (idx % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bFilt = this.ctx.createBiquadFilter();
        const bGain = this.ctx.createGain();
        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(bassRoots[Math.floor(idx / 4) % bassRoots.length], now);
        bFilt.type = 'lowpass';
        bFilt.frequency.setValueAtTime(175, now);
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.38, now + 0.15);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        bass.connect(bFilt);
        bFilt.connect(bGain);
        bGain.connect(this.menuGain);
        bass.start(now);
        bass.stop(now + 2.05);
      }

      this.menuStep += 1;
      this.menuTimer = window.setTimeout(tick, 520);
    };

    tick();
  }

  public stopMenuMusic() {
    if (this.menuTimer !== null) {
      window.clearTimeout(this.menuTimer);
      this.menuTimer = null;
    }
    if (this.menuGain) {
      try {
        this.menuGain.disconnect();
      } catch {
        // ignore
      }
      this.menuGain = null;
    }
  }

  public startInvestigationAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || this.horrorOsc1) return;

    // Dim rain slightly while indoors
    if (this.rainGain && !this.muted) {
      this.rainGain.gain.setTargetAtTime(0.015, ctx.currentTime, 0.3);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    filter.Q.value = 4.0;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 45;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0.001;
    gain.gain.setTargetAtTime(this.muted ? 0 : 0.055, ctx.currentTime, 0.6);

    // Detuned eerie sub-bass horror drone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 46.25; // F#1

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 47.4; // Slow ominous beating

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.horrorOsc1 = osc1;
    this.horrorOsc2 = osc2;
    this.horrorGain = gain;

    // Periodic spooky floorboard creaks / eerie room chimes
    const scheduleCreak = () => {
      this.horrorTimer = window.setTimeout(() => {
        if (this.horrorOsc1) {
          this.playScaryCreak();
          scheduleCreak();
        }
      }, 4200 + Math.random() * 4800);
    };
    scheduleCreak();
  }

  public stopInvestigationAmbience() {
    if (this.horrorTimer !== null) {
      window.clearTimeout(this.horrorTimer);
      this.horrorTimer = null;
    }
    [this.horrorOsc1, this.horrorOsc2].forEach((osc) => {
      if (osc) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
    });
    this.horrorOsc1 = null;
    this.horrorOsc2 = null;
    this.horrorGain = null;

    if (this.ctx && this.rainGain && !this.muted) {
      this.rainGain.gain.setTargetAtTime(this.getRainVolume(), this.ctx.currentTime, 0.4);
    }
  }

  public playScaryCreak() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (Math.random() < 0.5) {
      // Eerie metallic whisper / minor-second sting
      [311.13, 329.63].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + 1.1);
        gain.gain.setValueAtTime(0.001, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.025, now + i * 0.12 + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + 1.25);
      });
    } else {
      // Dark floorboard groan / scrape
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(ctx, 0.7, true);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(220, now);
      bp.frequency.exponentialRampToValueAtTime(95, now + 0.55);
      bp.Q.value = 6.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

      noise.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.65);
    }
  }

  public playScaryScream() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Distant eerie shriek + breathy wind tail
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(520, now);
    oscA.frequency.exponentialRampToValueAtTime(980, now + 0.18);
    oscA.frequency.exponentialRampToValueAtTime(410, now + 1.15);

    oscB.frequency.setValueAtTime(536, now);
    oscB.frequency.exponentialRampToValueAtTime(1015, now + 0.2);
    oscB.frequency.exponentialRampToValueAtTime(395, now + 1.15);

    vib.frequency.value = 18;
    vibGain.gain.value = 28;
    vib.connect(vibGain);
    vibGain.connect(oscA.frequency);
    vibGain.connect(oscB.frequency);

    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1150, now);
    bp.frequency.exponentialRampToValueAtTime(640, now + 1.15);
    bp.Q.value = 2.6;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    oscA.connect(bp);
    oscB.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(now);
    oscB.start(now);
    vib.start(now);
    oscA.stop(now + 1.28);
    oscB.stop(now + 1.28);
    vib.stop(now + 1.28);
  }

  public playFlashlightFlicker() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.07, 0.16].forEach((offset, idx) => {
      const click = ctx.createOscillator();
      const g = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(idx === 2 ? 120 : 280 - idx * 45, now + offset);
      g.gain.setValueAtTime(0.05, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);
      click.connect(g);
      g.connect(ctx.destination);
      click.start(now + offset);
      click.stop(now + offset + 0.045);
    });
  }

  public playLockedBuzz() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.setValueAtTime(92, now + 0.09);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playPuzzleSolved() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = ctx.currentTime + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.37);
    });
  }

  public playThunder(intensity = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 1.6 + intensity * 0.6;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, dur, true);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(420 * intensity, now);
    lowpass.frequency.exponentialRampToValueAtTime(55, now + dur * 0.85);

    const gain = ctx.createGain();
    const peak = Math.min(0.22, 0.11 + intensity * 0.045);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.05);
  }

  public playRadioGlitch() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const staticBuf = ctx.createBufferSource();
    staticBuf.buffer = this.createNoiseBuffer(ctx, 0.25, false);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100, now);
    bp.frequency.linearRampToValueAtTime(1150, now + 0.12);
    bp.frequency.linearRampToValueAtTime(2800, now + 0.22);
    bp.Q.value = 3.2;

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.linearRampToValueAtTime(0.055, now + 0.02);
    sGain.gain.setValueAtTime(0.012, now + 0.09);
    sGain.gain.linearRampToValueAtTime(0.048, now + 0.13);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);

    staticBuf.connect(bp);
    bp.connect(sGain);
    sGain.connect(ctx.destination);
    staticBuf.start(now);
    staticBuf.stop(now + 0.24);

    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.setValueAtTime(920, now + 0.05);
    osc.frequency.setValueAtTime(1760, now + 0.11);
    oGain.gain.setValueAtTime(0.025, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchJitter = 0.96 + Math.random() * 0.08;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(170 * pitchJitter, now + 0.032);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.042);

    const tick = ctx.createOscillator();
    const tGain = ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(1350 * pitchJitter, now);
    tGain.gain.setValueAtTime(0.022, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    tick.connect(tGain);
    tGain.connect(ctx.destination);
    tick.start(now);
    tick.stop(now + 0.018);
  }

  public playSelectBuilding() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(510, now + 0.055);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playActionSuccess() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 587.33].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playBreaker(on: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const snap = ctx.createOscillator();
    const sGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(on ? 190 : 260, now);
    snap.frequency.exponentialRampToValueAtTime(on ? 460 : 85, now + 0.085);
    sGain.gain.setValueAtTime(0.075, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    snap.connect(sGain);
    sGain.connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.11);

    if (on) {
      const hum = ctx.createOscillator();
      const hGain = ctx.createGain();
      hum.type = 'sine';
      hum.frequency.setValueAtTime(120, now + 0.03);
      hGain.gain.setValueAtTime(0.001, now + 0.03);
      hGain.gain.linearRampToValueAtTime(0.04, now + 0.09);
      hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      hum.connect(hGain);
      hGain.connect(ctx.destination);
      hum.start(now + 0.03);
      hum.stop(now + 0.3);
    }
  }

  public playClueFound() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 3 ? 'sine' : 'triangle';
      const t = ctx.currentTime + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(idx === 3 ? 0.045 : 0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playMiss() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.075);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHint() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.16);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playAlert() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [523.25, 392.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = ctx.currentTime + idx * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playEasAttentionTone() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playRadioGlitch();
    const start = ctx.currentTime + 0.14;
    [853, 960].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.032, start);
      gain.gain.setValueAtTime(0.032, start + 0.48);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.68);
    });
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const chord = [392.0, 493.88, 587.33, 783.99];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.065, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  public playGameOver() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [246.94, 220.0, 174.61];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }
}

export const soundEngine = new SoundEngine();
