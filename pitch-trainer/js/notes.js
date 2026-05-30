// All frequencies calculated from A4=440Hz: f = 440 * 2^((midi-69)/12)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToNoteName(midi, useFlats = false) {
  const octave = Math.floor(midi / 12) - 1;
  const pc = midi % 12;
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  return names[pc] + octave;
}

function midiToPitchClass(midi) {
  return midi % 12;
}

// Detect note from frequency, return { note, octave, cents, midi }
function detectNote(freq) {
  if (!freq || freq < 20 || freq > 20000) return null;
  const midiFloat = freqToMidi(freq);
  const midiRounded = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midiRounded) * 100);
  const octave = Math.floor(midiRounded / 12) - 1;
  const pc = ((midiRounded % 12) + 12) % 12;
  return {
    note: NOTE_NAMES[pc],
    noteFlat: NOTE_NAMES_FLAT[pc],
    octave,
    cents,
    midi: midiRounded,
    pc,
    freq
  };
}

const INTERVALS = [
  { semitones: 0,  name: 'Unison',       abbr: 'P1',  character: 'Perfect consonance' },
  { semitones: 1,  name: 'Minor 2nd',    abbr: 'm2',  character: 'Sharp dissonance' },
  { semitones: 2,  name: 'Major 2nd',    abbr: 'M2',  character: 'Mild dissonance' },
  { semitones: 3,  name: 'Minor 3rd',    abbr: 'm3',  character: 'Soft consonance — melancholic' },
  { semitones: 4,  name: 'Major 3rd',    abbr: 'M3',  character: 'Soft consonance — bright' },
  { semitones: 5,  name: 'Perfect 4th',  abbr: 'P4',  character: 'Consonance (context-dependent)' },
  { semitones: 6,  name: 'Tritone',      abbr: 'TT',  character: 'Restless — neutral tension' },
  { semitones: 7,  name: 'Perfect 5th',  abbr: 'P5',  character: 'Open consonance — powerful' },
  { semitones: 8,  name: 'Minor 6th',    abbr: 'm6',  character: 'Soft consonance — bittersweet' },
  { semitones: 9,  name: 'Major 6th',    abbr: 'M6',  character: 'Soft consonance — warm' },
  { semitones: 10, name: 'Minor 7th',    abbr: 'm7',  character: 'Tension — wants to resolve' },
  { semitones: 11, name: 'Major 7th',    abbr: 'M7',  character: 'Bright/close dissonance' },
  { semitones: 12, name: 'Octave',       abbr: 'P8',  character: 'Perfect consonance — fullness' },
];

const CHORDS = {
  // Triads
  major:      { name: 'Major',       intervals: [0,4,7],     formula: '1 – 3 – 5',       color: '#6366f1' },
  minor:      { name: 'Minor',       intervals: [0,3,7],     formula: '1 – b3 – 5',      color: '#8b5cf6' },
  dim:        { name: 'Diminished',  intervals: [0,3,6],     formula: '1 – b3 – b5',     color: '#ef4444' },
  aug:        { name: 'Augmented',   intervals: [0,4,8],     formula: '1 – 3 – #5',      color: '#f59e0b' },
  sus2:       { name: 'Sus2',        intervals: [0,2,7],     formula: '1 – 2 – 5',       color: '#10b981' },
  sus4:       { name: 'Sus4',        intervals: [0,5,7],     formula: '1 – 4 – 5',       color: '#14b8a6' },
  // Seventh chords
  maj7:       { name: 'Major 7th',   intervals: [0,4,7,11],  formula: '1 – 3 – 5 – 7',   color: '#6366f1' },
  dom7:       { name: 'Dominant 7th',intervals: [0,4,7,10],  formula: '1 – 3 – 5 – b7',  color: '#f59e0b' },
  min7:       { name: 'Minor 7th',   intervals: [0,3,7,10],  formula: '1 – b3 – 5 – b7', color: '#8b5cf6' },
  halfdim7:   { name: 'Half-Dim 7th',intervals: [0,3,6,10],  formula: '1 – b3 – b5 – b7',color: '#ef4444' },
  dim7:       { name: 'Dim 7th',     intervals: [0,3,6,9],   formula: '1 – b3 – b5 – bb7',color:'#dc2626' },
  minmaj7:    { name: 'Min/Maj 7th', intervals: [0,3,7,11],  formula: '1 – b3 – 5 – 7',  color: '#ec4899' },
};

const SCALE_DEGREES = [
  { degree: 1, name: 'Tonic',       solfege: 'Do', roman: 'I',    semitones: 0  },
  { degree: 2, name: 'Supertonic',  solfege: 'Re', roman: 'ii',   semitones: 2  },
  { degree: 3, name: 'Mediant',     solfege: 'Mi', roman: 'iii',  semitones: 4  },
  { degree: 4, name: 'Subdominant', solfege: 'Fa', roman: 'IV',   semitones: 5  },
  { degree: 5, name: 'Dominant',    solfege: 'Sol', roman: 'V',   semitones: 7  },
  { degree: 6, name: 'Submediant',  solfege: 'La', roman: 'vi',   semitones: 9  },
  { degree: 7, name: 'Leading Tone',solfege: 'Ti', roman: 'vii°', semitones: 11 },
];

// 12-reference-song method (first note of song = that pitch)
const PITCH_REFERENCES = {
  0:  { note: 'C',  song: '"Maria" – West Side Story (opening note)' },
  1:  { note: 'C#', song: '"Für Elise" – Beethoven (opening E, down a maj3)... use "Take On Me" bridge' },
  2:  { note: 'D',  song: '"Happy Birthday" – starts on D (common key)' },
  3:  { note: 'D#', song: '"Purple Haze" – Jimi Hendrix (opening riff root)' },
  4:  { note: 'E',  song: '"Ode to Joy" – Beethoven (first note)' },
  5:  { note: 'F',  song: '"Here Comes the Bride" – Wagner (first note)' },
  6:  { note: 'F#', song: '"The Simpsons" theme (first note)' },
  7:  { note: 'G',  song: '"Twinkle Twinkle" – starts on G; "Superman" theme (Dylan\'s reference)' },
  8:  { note: 'G#', song: '"When a Man Loves a Woman" – Percy Sledge' },
  9:  { note: 'A',  song: '"My Bonnie Lies Over the Ocean" – starts on A' },
  10: { note: 'A#', song: '"Somewhere Over the Rainbow" – Judy Garland' },
  11: { note: 'B',  song: '"Rocky" theme – Bill Conti (opening horn)' },
};

export {
  NOTE_NAMES, NOTE_NAMES_FLAT, SOLFEGE,
  midiToFreq, freqToMidi, midiToNoteName, midiToPitchClass, detectNote,
  INTERVALS, CHORDS, SCALE_DEGREES, PITCH_REFERENCES
};
