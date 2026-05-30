import { detectNote, NOTE_NAMES, NOTE_NAMES_FLAT, INTERVALS, CHORDS, SCALE_DEGREES, PITCH_REFERENCES, midiToFreq, midiToNoteName } from './notes.js';
import { MicrophonePitchTracker } from './pitchDetector.js';
import { AudioEngine } from './audioEngine.js';
import { IntervalExercise, ChordExercise, ScaleDegreeExercise, NoteRecognitionExercise } from './exercises.js';

const audio = new AudioEngine();
let micTracker = null;
let micActive = false;
let streak = 0;

// ── Navigation ──────────────────────────────────────────────────────────────
const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');

function showSection(id) {
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.section === id));
}

navBtns.forEach(btn => btn.addEventListener('click', () => {
  audio.resume();
  showSection(btn.dataset.section);
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
function updateScore(el, correct, total, streakN) {
  el.innerHTML = `<span class="n">${correct}</span>/<span>${total}</span> &nbsp; <span class="streak">🔥 ${streakN}</span>`;
}

function showFeedback(el, correct, message, sub = '') {
  el.className = `feedback show ${correct ? 'correct' : 'wrong'}`;
  el.innerHTML = `${message}${sub ? `<div class="feedback-sub">${sub}</div>` : ''}`;
}

function lockChoices(container) {
  container.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
}

function showNext(btn) {
  btn.classList.add('show');
}

// ── Pitch Detector ───────────────────────────────────────────────────────────
const micBtn    = document.getElementById('mic-btn');
const noteBig   = document.getElementById('note-big');
const noteFreqEl = document.getElementById('note-freq');
const needle    = document.getElementById('meter-needle');
const centsVal  = document.getElementById('cents-value');

function updatePitchUI(freq, clarity) {
  const info = detectNote(freq);
  if (!info) { setPitchSilent(); return; }

  noteBig.textContent = info.note + info.octave;
  noteFreqEl.textContent = `${info.freq.toFixed(1)} Hz  ·  clarity ${Math.round(clarity * 100)}%`;

  // cents → needle position (0–100%)
  const pct = 50 + (info.cents / 100) * 50; // ±50 cents maps to 0–100%
  const clampedPct = Math.max(2, Math.min(98, pct));
  needle.style.left = clampedPct + '%';
  centsVal.textContent = `${info.cents > 0 ? '+' : ''}${info.cents} ¢`;

  const absC = Math.abs(info.cents);
  const tuneClass = absC <= 10 ? 'in-tune' : info.cents > 0 ? 'sharp' : 'flat';
  noteBig.className = 'note-big ' + tuneClass;
  needle.className = 'meter-needle ' + tuneClass;
}

function setPitchSilent() {
  noteBig.textContent = '—';
  noteBig.className = 'note-big silent';
  needle.style.left = '50%';
  needle.className = 'meter-needle';
  noteFreqEl.textContent = '';
  centsVal.textContent = '';
}

micBtn.addEventListener('click', async () => {
  audio.resume();
  if (!micActive) {
    try {
      micTracker = new MicrophonePitchTracker(updatePitchUI, setPitchSilent);
      await micTracker.start();
      micActive = true;
      micBtn.classList.add('active');
      micBtn.innerHTML = `<span class="dot"></span> Stop Mic`;
    } catch(e) {
      alert('Microphone access denied. Please allow microphone access.');
    }
  } else {
    micTracker.stop();
    micActive = false;
    micBtn.classList.remove('active');
    micBtn.innerHTML = `<span class="dot"></span> Start Mic`;
    setPitchSilent();
  }
});

// ── Interval Exercise ────────────────────────────────────────────────────────
let intervalEx = new IntervalExercise({ level: 'beginner', mode: 'both' });
let intervalAnswered = false;

const intervalLevelSel = document.getElementById('interval-level');
const intervalModeSel  = document.getElementById('interval-mode');
const intervalChoices  = document.getElementById('interval-choices');
const intervalFeedback = document.getElementById('interval-feedback');
const intervalNextBtn  = document.getElementById('interval-next');
const intervalPlayBtn  = document.getElementById('interval-play');
const intervalScore    = document.getElementById('interval-score');
const intervalModeBadge= document.getElementById('interval-mode-badge');
let intervalStreak = 0;

function renderIntervalChoices(current) {
  intervalChoices.innerHTML = '';
  for (const c of current.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.semitones = c.semitones;
    btn.innerHTML = `${c.name} <span class="choice-sub">${c.abbr} · ${c.semitones} semitone${c.semitones !== 1 ? 's' : ''}</span>
      <span class="choice-sub interval-char">${c.character}</span>`;
    btn.addEventListener('click', () => onIntervalAnswer(c.semitones));
    intervalChoices.appendChild(btn);
  }
}

function newIntervalQuestion() {
  intervalAnswered = false;
  intervalEx.level = intervalLevelSel.value;
  intervalEx.mode = intervalModeSel.value;
  const cur = intervalEx.generate();
  intervalModeBadge.textContent = cur.playMode;
  intervalFeedback.className = 'feedback';
  intervalNextBtn.classList.remove('show');
  renderIntervalChoices(cur);
  playCurrentInterval(cur);
}

function playCurrentInterval(cur) {
  if (!cur) cur = intervalEx.current;
  if (!cur) return;
  if (cur.playMode === 'harmonic') {
    audio.playChord([cur.rootMidi, cur.topMidi], 2.0);
  } else if (cur.playMode === 'ascending') {
    audio.playMelodic(cur.rootMidi, cur.topMidi);
  } else {
    audio.playMelodic(cur.topMidi, cur.rootMidi);
  }
}

function onIntervalAnswer(semitones) {
  if (intervalAnswered) return;
  intervalAnswered = true;
  const correct = intervalEx.check(semitones);
  lockChoices(intervalChoices);

  // highlight correct/wrong
  intervalChoices.querySelectorAll('.choice-btn').forEach(btn => {
    const s = parseInt(btn.dataset.semitones);
    if (s === intervalEx.current.interval.semitones) btn.classList.add('correct');
    else if (s === semitones && !correct) btn.classList.add('wrong');
  });

  if (correct) {
    intervalStreak++;
    audio.playSuccess();
    showFeedback(intervalFeedback, true, `Correct! ${intervalEx.current.interval.name}`,
      intervalEx.current.interval.character);
  } else {
    intervalStreak = 0;
    audio.playError();
    const right = intervalEx.current.interval;
    showFeedback(intervalFeedback, false,
      `That was a ${right.name}`,
      right.character);
  }
  updateScore(intervalScore, intervalEx.score.correct, intervalEx.score.total, intervalStreak);
  showNext(intervalNextBtn);
}

intervalPlayBtn.addEventListener('click', () => { audio.resume(); playCurrentInterval(); });
intervalNextBtn.addEventListener('click', () => { audio.resume(); newIntervalQuestion(); });
intervalLevelSel.addEventListener('change', () => newIntervalQuestion());
intervalModeSel.addEventListener('change', () => newIntervalQuestion());

// ── Chord Exercise ────────────────────────────────────────────────────────────
let chordEx = new ChordExercise({ level: 'beginner' });
let chordAnswered = false;

const chordLevelSel  = document.getElementById('chord-level');
const chordChoices   = document.getElementById('chord-choices');
const chordFeedback  = document.getElementById('chord-feedback');
const chordNextBtn   = document.getElementById('chord-next');
const chordPlayBtn   = document.getElementById('chord-play');
const chordScore     = document.getElementById('chord-score');
let chordStreak = 0;

function renderChordChoices(current) {
  chordChoices.innerHTML = '';
  for (const c of current.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.key = c.key;
    btn.innerHTML = `${c.name} <span class="choice-sub">${c.formula}</span>`;
    btn.addEventListener('click', () => onChordAnswer(c.key));
    chordChoices.appendChild(btn);
  }
}

function newChordQuestion() {
  chordAnswered = false;
  chordEx.level = chordLevelSel.value;
  const cur = chordEx.generate();
  chordFeedback.className = 'feedback';
  chordNextBtn.classList.remove('show');
  renderChordChoices(cur);
  audio.playChord(cur.midis, 2.5);
}

function onChordAnswer(key) {
  if (chordAnswered) return;
  chordAnswered = true;
  const correct = chordEx.check(key);
  lockChoices(chordChoices);

  chordChoices.querySelectorAll('.choice-btn').forEach(btn => {
    if (btn.dataset.key === chordEx.current.key) btn.classList.add('correct');
    else if (btn.dataset.key === key && !correct) btn.classList.add('wrong');
  });

  if (correct) {
    chordStreak++;
    audio.playSuccess();
    showFeedback(chordFeedback, true, `Correct! ${chordEx.current.chord.name}`,
      chordEx.current.chord.formula);
  } else {
    chordStreak = 0;
    audio.playError();
    const right = chordEx.current.chord;
    showFeedback(chordFeedback, false, `That was ${right.name}`, right.formula);
  }
  updateScore(chordScore, chordEx.score.correct, chordEx.score.total, chordStreak);
  showNext(chordNextBtn);
}

chordPlayBtn.addEventListener('click', () => {
  audio.resume();
  if (chordEx.current) audio.playChord(chordEx.current.midis, 2.5);
});
chordNextBtn.addEventListener('click', () => { audio.resume(); newChordQuestion(); });
chordLevelSel.addEventListener('change', () => newChordQuestion());

// ── Scale Degree Exercise ────────────────────────────────────────────────────
let degEx = new ScaleDegreeExercise({ level: 'beginner' });
let degAnswered = false;

const degLevelSel   = document.getElementById('deg-level');
const degChoices    = document.getElementById('deg-choices');
const degFeedback   = document.getElementById('deg-feedback');
const degNextBtn    = document.getElementById('deg-next');
const degPlayBtn    = document.getElementById('deg-play');
const degCadBtn     = document.getElementById('deg-cadence');
const degScore      = document.getElementById('deg-score');
let degStreak = 0;

function renderDegChoices(current) {
  degChoices.innerHTML = '';
  for (const c of current.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.degree = c.degree;
    btn.innerHTML = `<span class="solfege-badge">${c.solfege}</span>
      <span class="choice-sub">${c.degree} — ${c.name}</span>
      <span class="choice-sub">${c.roman}</span>`;
    btn.addEventListener('click', () => onDegAnswer(c.degree));
    degChoices.appendChild(btn);
  }
}

function newDegQuestion() {
  degAnswered = false;
  degEx.level = degLevelSel.value;
  const cur = degEx.generate();
  degFeedback.className = 'feedback';
  degNextBtn.classList.remove('show');
  renderDegChoices(cur);
  // play cadence then note
  audio.playCadence(cur.tonicMidi, () => {
    setTimeout(() => audio.playNote(cur.noteMidi, 1.5), 100);
  });
}

function onDegAnswer(degree) {
  if (degAnswered) return;
  degAnswered = true;
  const correct = degEx.check(degree);
  lockChoices(degChoices);

  degChoices.querySelectorAll('.choice-btn').forEach(btn => {
    const d = parseInt(btn.dataset.degree);
    if (d === degEx.current.deg.degree) btn.classList.add('correct');
    else if (d === degree && !correct) btn.classList.add('wrong');
  });

  const right = degEx.current.deg;
  if (correct) {
    degStreak++;
    audio.playSuccess();
    showFeedback(degFeedback, true,
      `Correct! Scale degree ${right.degree} — ${right.solfege}`,
      `${right.name} · ${right.roman}`);
  } else {
    degStreak = 0;
    audio.playError();
    showFeedback(degFeedback, false,
      `That was degree ${right.degree} — ${right.solfege}`,
      `${right.name} · ${right.roman}`);
  }
  updateScore(degScore, degEx.score.correct, degEx.score.total, degStreak);
  showNext(degNextBtn);
}

degPlayBtn.addEventListener('click', () => {
  audio.resume();
  if (degEx.current) audio.playNote(degEx.current.noteMidi, 1.5);
});
degCadBtn.addEventListener('click', () => {
  audio.resume();
  if (degEx.current) audio.playCadence(degEx.current.tonicMidi);
});
degNextBtn.addEventListener('click', () => { audio.resume(); newDegQuestion(); });
degLevelSel.addEventListener('change', () => newDegQuestion());

// ── Note Recognition ─────────────────────────────────────────────────────────
let noteEx = new NoteRecognitionExercise();
let noteAnswered = false;

const noteChoices  = document.getElementById('note-choices');
const noteFeedback = document.getElementById('note-feedback');
const noteNextBtn  = document.getElementById('note-next');
const notePlayBtn  = document.getElementById('note-play');
const noteScore    = document.getElementById('note-score');
let noteStreak = 0;

function renderNoteChoices(current) {
  noteChoices.innerHTML = '';
  for (const pc of current.choices) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.pc = pc;
    const ref = PITCH_REFERENCES[pc];
    btn.innerHTML = `${NOTE_NAMES[pc]} / ${NOTE_NAMES_FLAT[pc]}
      <span class="choice-sub ref-song">${ref.song}</span>`;
    btn.addEventListener('click', () => onNoteAnswer(pc));
    noteChoices.appendChild(btn);
  }
}

function newNoteQuestion() {
  noteAnswered = false;
  const cur = noteEx.generate();
  noteFeedback.className = 'feedback';
  noteNextBtn.classList.remove('show');
  renderNoteChoices(cur);
  audio.playNote(cur.midi, 1.8);
}

function onNoteAnswer(pc) {
  if (noteAnswered) return;
  noteAnswered = true;
  const correct = noteEx.check(pc);
  lockChoices(noteChoices);

  noteChoices.querySelectorAll('.choice-btn').forEach(btn => {
    const p = parseInt(btn.dataset.pc);
    if (p === noteEx.current.pc) btn.classList.add('correct');
    else if (p === pc && !correct) btn.classList.add('wrong');
  });

  const ref = PITCH_REFERENCES[noteEx.current.pc];
  if (correct) {
    noteStreak++;
    audio.playSuccess();
    showFeedback(noteFeedback, true,
      `Correct! ${NOTE_NAMES[noteEx.current.pc]}`,
      ref.song);
  } else {
    noteStreak = 0;
    audio.playError();
    showFeedback(noteFeedback, false,
      `That was ${NOTE_NAMES[noteEx.current.pc]}`,
      ref.song);
  }
  updateScore(noteScore, noteEx.score.correct, noteEx.score.total, noteStreak);
  showNext(noteNextBtn);
}

notePlayBtn.addEventListener('click', () => {
  audio.resume();
  if (noteEx.current) audio.playNote(noteEx.current.midi, 1.8);
});
noteNextBtn.addEventListener('click', () => { audio.resume(); newNoteQuestion(); });

// ── Piano Keyboard (decorative + playable) ────────────────────────────────────
function buildPiano(containerId, startMidi = 48, endMidi = 72) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // White key MIDI offsets within octave
  const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
  const blackOffsets = [1, 3, -1, 6, 8, 10, -1]; // -1 = no black key after

  container.innerHTML = '';
  const piano = document.createElement('div');
  piano.className = 'piano';

  let whiteIndex = 0;
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const pc = midi % 12;
    const isWhite = whiteOffsets.includes(pc);
    if (!isWhite) continue;

    const wkey = document.createElement('div');
    wkey.className = 'key-white';
    wkey.dataset.midi = midi;
    if (midi % 12 === 0) wkey.textContent = 'C' + (Math.floor(midi/12)-1);
    wkey.addEventListener('click', () => { audio.resume(); audio.playNote(midi, 1.2); flashKey(wkey); });
    piano.appendChild(wkey);

    // check for black key after this white key
    const pcIdx = whiteOffsets.indexOf(pc);
    if (blackOffsets[pcIdx] !== -1) {
      const bMidi = midi + 1;
      if (bMidi <= endMidi) {
        const bkey = document.createElement('div');
        bkey.className = 'key-black';
        bkey.dataset.midi = bMidi;
        // position: offset from left of white key
        bkey.style.left = (piano.children.length * 42 - 14) + 'px';
        bkey.addEventListener('click', () => { audio.resume(); audio.playNote(bMidi, 1.2); flashKey(bkey); });
        piano.appendChild(bkey);
      }
    }
    whiteIndex++;
  }

  container.appendChild(piano);
}

function flashKey(el) {
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 600);
}

// ── Init ─────────────────────────────────────────────────────────────────────
showSection('pitch');
buildPiano('piano-container', 48, 76);
newIntervalQuestion();
newChordQuestion();
newDegQuestion();
newNoteQuestion();
