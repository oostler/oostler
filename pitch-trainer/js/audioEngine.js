import { midiToFreq } from './notes.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Play a single MIDI note with piano-like envelope
  playNote(midi, duration = 1.5, velocity = 0.8, delay = 0) {
    const ctx = this._ensureCtx();
    const freq = midiToFreq(midi);
    const now = ctx.currentTime + delay;

    // Layered oscillators for richer tone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc3.type = 'sine';

    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2;      // octave harmonic
    osc3.frequency.value = freq * 3.01;   // slightly detuned 3rd harmonic

    filter.type = 'lowpass';
    filter.frequency.value = freq * 8;
    filter.Q.value = 0.5;

    // Piano-like envelope: fast attack, medium decay, low sustain, release
    const attack = 0.005;
    const decay = 0.3;
    const sustainLevel = velocity * 0.25;
    const release = 0.4;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(velocity, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);
    gainNode.gain.setValueAtTime(sustainLevel, now + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

    // Mix oscillators
    const mix1 = ctx.createGain(); mix1.gain.value = 0.5;
    const mix2 = ctx.createGain(); mix2.gain.value = 0.3;
    const mix3 = ctx.createGain(); mix3.gain.value = 0.2;

    osc1.connect(mix1); mix1.connect(filter);
    osc2.connect(mix2); mix2.connect(filter);
    osc3.connect(mix3); mix3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(now); osc2.start(now); osc3.start(now);
    osc1.stop(now + duration + release + 0.1);
    osc2.stop(now + duration + release + 0.1);
    osc3.stop(now + duration + release + 0.1);
  }

  // Play multiple notes together (chord)
  playChord(midis, duration = 2.0) {
    for (const midi of midis) {
      this.playNote(midi, duration, 0.65);
    }
  }

  // Play notes in sequence (melodic interval)
  playMelodic(midi1, midi2, noteLen = 1.0, gap = 0.1) {
    this.playNote(midi1, noteLen, 0.8, 0);
    this.playNote(midi2, noteLen, 0.8, noteLen + gap);
  }

  // Play a I-IV-V-I cadence in C major to establish tonal center
  playCadence(rootMidi = 60, onDone = null) {
    const ctx = this._ensureCtx();
    // I  = root, maj3, P5
    // IV = root+5, maj3, P5
    // V  = root+7, maj3, P5
    // I  = root, maj3, P5  (with maj7 for richness)
    const chords = [
      [rootMidi, rootMidi+4, rootMidi+7],
      [rootMidi+5, rootMidi+9, rootMidi+12],
      [rootMidi+7, rootMidi+11, rootMidi+14],
      [rootMidi, rootMidi+4, rootMidi+7, rootMidi+12],
    ];
    const dur = 0.6;
    const gap = 0.05;
    chords.forEach((ch, i) => {
      ch.forEach(m => this.playNote(m, dur, 0.6, i * (dur + gap)));
    });
    if (onDone) {
      setTimeout(onDone, (chords.length * (dur + gap) + dur) * 1000 + 200);
    }
  }

  // Gentle arpeggio up for "correct" feedback
  playSuccess() {
    [60, 64, 67, 72].forEach((m, i) => this.playNote(m, 0.3, 0.7, i * 0.08));
  }

  // Dissonant chord for "wrong" feedback
  playError() {
    this.playNote(60, 0.4, 0.5);
    this.playNote(61, 0.4, 0.5);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
