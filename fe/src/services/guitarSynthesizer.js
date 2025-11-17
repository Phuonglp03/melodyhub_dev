/**
 * Guitar Sound Synthesizer
 * Generates realistic guitar sounds using Web Audio API
 */

class GuitarSynthesizer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.activeNotes = new Map();
  }

  /**
   * Initialize the audio context
   */
  init() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.audioContext.destination);
  }

  /**
   * Convert guitar string and fret to frequency
   */
  getFrequency(string, fret) {
    // Standard guitar tuning (Hz)
    const openStringFrequencies = {
      e: 329.63, // E4
      B: 246.94, // B3
      G: 196.0, // G3
      D: 146.83, // D3
      A: 110.0, // A2
      E: 82.41, // E2
    };

    const baseFreq = openStringFrequencies[string];
    if (!baseFreq) return null;

    // Each fret is a semitone (multiply by 2^(1/12))
    const frequency = baseFreq * Math.pow(2, fret / 12);
    return frequency;
  }

  /**
   * Play a guitar note with realistic envelope
   */
  playNote(string, fret, duration = 0.5) {
    if (!this.audioContext) this.init();

    const frequency = this.getFrequency(string, fret);
    if (!frequency) return;

    const now = this.audioContext.currentTime;
    const noteId = `${string}-${fret}-${now}`;

    // Create oscillators for a richer sound (fundamental + harmonics)
    const oscillators = [];
    const gains = [];

    // Fundamental frequency
    const osc1 = this.audioContext.createOscillator();
    osc1.type = "sawtooth"; // Rich harmonic content
    osc1.frequency.value = frequency;

    // Second harmonic (octave)
    const osc2 = this.audioContext.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = frequency * 2;

    // Third harmonic
    const osc3 = this.audioContext.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = frequency * 3;

    oscillators.push(osc1, osc2, osc3);

    // Create envelope for each oscillator
    const gain1 = this.audioContext.createGain();
    const gain2 = this.audioContext.createGain();
    const gain3 = this.audioContext.createGain();

    gains.push(gain1, gain2, gain3);

    // Connect oscillators to gains
    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    // Set initial gain levels (mix harmonics)
    gain1.gain.value = 0;
    gain2.gain.value = 0;
    gain3.gain.value = 0;

    // Create a filter for tone shaping
    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2000 + fret * 100; // Higher frets = brighter
    filter.Q.value = 1;

    // Connect gains through filter to master
    gain1.connect(filter);
    gain2.connect(filter);
    gain3.connect(filter);
    filter.connect(this.masterGain);

    // ADSR Envelope - Guitar-like attack and decay
    const attackTime = 0.005; // Fast attack (pluck)
    const decayTime = 0.1; // Quick initial decay
    const sustainLevel = 0.3; // Lower sustain
    const releaseTime = 0.2; // Natural release

    // Attack phase
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + attackTime);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.2, now + attackTime);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(0.1, now + attackTime);

    // Decay phase
    gain1.gain.linearRampToValueAtTime(
      sustainLevel,
      now + attackTime + decayTime
    );
    gain2.gain.linearRampToValueAtTime(
      sustainLevel * 0.5,
      now + attackTime + decayTime
    );
    gain3.gain.linearRampToValueAtTime(
      sustainLevel * 0.3,
      now + attackTime + decayTime
    );

    // Release phase
    const releaseStart = now + duration;
    gain1.gain.setValueAtTime(gain1.gain.value, releaseStart);
    gain1.gain.exponentialRampToValueAtTime(0.001, releaseStart + releaseTime);

    gain2.gain.setValueAtTime(gain2.gain.value, releaseStart);
    gain2.gain.exponentialRampToValueAtTime(0.001, releaseStart + releaseTime);

    gain3.gain.setValueAtTime(gain3.gain.value, releaseStart);
    gain3.gain.exponentialRampToValueAtTime(0.001, releaseStart + releaseTime);

    // Start oscillators
    oscillators.forEach((osc) => osc.start(now));

    // Stop oscillators after release
    oscillators.forEach((osc) => osc.stop(releaseStart + releaseTime + 0.1));

    // Store for cleanup
    this.activeNotes.set(noteId, { oscillators, gains });

    // Clean up after note ends
    setTimeout(() => {
      this.activeNotes.delete(noteId);
    }, (duration + releaseTime + 0.1) * 1000);
  }

  /**
   * Stop all currently playing notes
   */
  stopAll() {
    this.activeNotes.forEach(({ oscillators, gains }) => {
      const now = this.audioContext ? this.audioContext.currentTime : 0;

      // Quick fade out
      gains.forEach((gain) => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      });

      // Stop oscillators
      oscillators.forEach((osc) => {
        try {
          osc.stop(now + 0.05);
        } catch (e) {
          // Already stopped
        }
      });
    });

    this.activeNotes.clear();
  }

  /**
   * Set master volume
   */
  setVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.3;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stopAll();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export default GuitarSynthesizer;
