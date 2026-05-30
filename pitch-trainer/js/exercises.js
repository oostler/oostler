import { INTERVALS, CHORDS, SCALE_DEGREES, midiToFreq } from './notes.js';

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Interval Exercise ────────────────────────────────────────────────────────
export class IntervalExercise {
  constructor(options = {}) {
    this.level = options.level || 'beginner'; // beginner | intermediate | advanced
    this.mode = options.mode || 'both';       // ascending | descending | harmonic | both
    this.score = { correct: 0, total: 0 };
    this.current = null;
  }

  _intervalPool() {
    switch (this.level) {
      case 'beginner':
        return INTERVALS.filter(i => [3,4,7,12].includes(i.semitones)); // m3, M3, P5, 8ve
      case 'intermediate':
        return INTERVALS.filter(i => i.semitones >= 1 && i.semitones <= 8);
      default:
        return INTERVALS.filter(i => i.semitones >= 1 && i.semitones <= 12);
    }
  }

  generate() {
    const pool = this._intervalPool();
    const interval = pick(pool);
    const rootMidi = randInt(48, 67); // C3–G4 — comfortable range
    const topMidi = rootMidi + interval.semitones;
    const playMode = this.mode === 'both' ? pick(['ascending','descending','harmonic']) : this.mode;

    // Build 4 choices (correct + 3 distractors)
    const distractors = shuffle(pool.filter(i => i.semitones !== interval.semitones)).slice(0, 3);
    const choices = shuffle([interval, ...distractors]);

    this.current = { interval, rootMidi, topMidi, playMode, choices };
    return this.current;
  }

  check(semitones) {
    const correct = semitones === this.current.interval.semitones;
    this.score.total++;
    if (correct) this.score.correct++;
    return correct;
  }
}

// ── Chord Quality Exercise ───────────────────────────────────────────────────
export class ChordExercise {
  constructor(options = {}) {
    this.level = options.level || 'beginner';
    this.score = { correct: 0, total: 0 };
    this.current = null;
  }

  _chordPool() {
    switch (this.level) {
      case 'beginner':
        return ['major', 'minor'];
      case 'intermediate':
        return ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4'];
      default:
        return Object.keys(CHORDS);
    }
  }

  generate() {
    const pool = this._chordPool();
    const key = pick(pool);
    const chord = CHORDS[key];
    const rootMidi = randInt(48, 60); // C3–C4 — clear chord range

    const distractorKeys = shuffle(pool.filter(k => k !== key)).slice(0, 3);
    const choices = shuffle([
      { key, ...chord },
      ...distractorKeys.map(k => ({ key: k, ...CHORDS[k] }))
    ]);

    this.current = { key, chord, rootMidi, midis: chord.intervals.map(i => rootMidi + i), choices };
    return this.current;
  }

  check(key) {
    const correct = key === this.current.key;
    this.score.total++;
    if (correct) this.score.correct++;
    return correct;
  }
}

// ── Scale Degree Exercise ────────────────────────────────────────────────────
export class ScaleDegreeExercise {
  constructor(options = {}) {
    this.level = options.level || 'beginner';
    this.score = { correct: 0, total: 0 };
    this.current = null;
    this.tonicMidi = 60; // C4 default tonic
  }

  _degreePool() {
    // beginner: scale degrees 1,2,3,5  intermediate: 1-6  advanced: all 7
    switch (this.level) {
      case 'beginner':
        return SCALE_DEGREES.filter(d => [1,2,3,5].includes(d.degree));
      case 'intermediate':
        return SCALE_DEGREES.filter(d => d.degree <= 6);
      default:
        return SCALE_DEGREES;
    }
  }

  generate() {
    const pool = this._degreePool();
    const deg = pick(pool);
    this.tonicMidi = pick([60, 62, 65, 67]); // C, D, F, G — common tonic roots
    const noteMidi = this.tonicMidi + deg.semitones;

    const distractors = shuffle(pool.filter(d => d.degree !== deg.degree)).slice(0, 3);
    const choices = shuffle([deg, ...distractors]);

    this.current = { deg, noteMidi, tonicMidi: this.tonicMidi, choices };
    return this.current;
  }

  check(degree) {
    const correct = degree === this.current.deg.degree;
    this.score.total++;
    if (correct) this.score.correct++;
    return correct;
  }
}

// ── Note Recognition Exercise ───────────────────────────────────────────────
import { NOTE_NAMES, PITCH_REFERENCES } from './notes.js';

export class NoteRecognitionExercise {
  constructor() {
    this.score = { correct: 0, total: 0 };
    this.current = null;
  }

  generate() {
    const midi = randInt(48, 72); // C3–C5
    const pc = midi % 12;
    const choices = shuffle([
      pc,
      ...shuffle([...Array(12).keys()].filter(n => n !== pc)).slice(0, 3)
    ]);

    this.current = { midi, pc, choices };
    return this.current;
  }

  check(pc) {
    const correct = pc === this.current.pc;
    this.score.total++;
    if (correct) this.score.correct++;
    return correct;
  }
}

export { shuffle, pick, randInt };
