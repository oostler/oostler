// McLeod Pitch Method (MPM) — more accurate than basic autocorrelation
// Based on: "A Smarter Way to Find Pitch" by Philip McLeod & Geoff Wyvill

export class PitchDetector {
  constructor(sampleRate, bufferSize = 2048) {
    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.MIN_FREQ = 60;   // Hz (below bass guitar)
    this.MAX_FREQ = 1500; // Hz (above singing range)
    this.CLARITY_THRESHOLD = 0.9;
  }

  // Normalized Square Difference Function (NSDF)
  nsdf(buf) {
    const n = buf.length;
    const nsdf = new Float32Array(n);
    let acf = new Float32Array(n);
    let sq = new Float32Array(n);

    // autocorrelation and sum-of-squares
    for (let tau = 0; tau < n; tau++) {
      let s1 = 0, s2 = 0, corr = 0;
      for (let j = 0; j < n - tau; j++) {
        corr += buf[j] * buf[j + tau];
        s1 += buf[j] * buf[j];
        s2 += buf[j + tau] * buf[j + tau];
      }
      acf[tau] = corr;
      sq[tau] = s1 + s2;
    }

    for (let tau = 0; tau < n; tau++) {
      nsdf[tau] = sq[tau] > 0 ? 2 * acf[tau] / sq[tau] : 0;
    }
    return nsdf;
  }

  // Find key maxima above threshold in NSDF
  keyMaxima(nsdf) {
    const maxima = [];
    let pos = 0;
    const n = nsdf.length;

    // skip first zero-crossing
    while (pos < n - 1 && nsdf[pos] > 0) pos++;
    while (pos < n - 1 && nsdf[pos] <= 0) pos++;

    while (pos < n - 1) {
      // look for local maximum
      while (pos < n - 1 && nsdf[pos] <= nsdf[pos + 1]) pos++;
      if (pos < n - 1 && nsdf[pos] > 0) {
        maxima.push(pos);
      }
      while (pos < n - 1 && nsdf[pos] >= nsdf[pos + 1]) pos++;
      pos++;
    }
    return maxima;
  }

  // Parabolic interpolation for sub-sample accuracy
  parabolicInterp(nsdf, pos) {
    if (pos <= 0 || pos >= nsdf.length - 1) return pos;
    const a = nsdf[pos - 1];
    const b = nsdf[pos];
    const c = nsdf[pos + 1];
    const denom = 2 * (2 * b - a - c);
    if (Math.abs(denom) < 1e-10) return pos;
    return pos + (a - c) / denom;
  }

  detect(buffer) {
    const nsdf = this.nsdf(buffer);
    const maxima = this.keyMaxima(nsdf);

    if (!maxima.length) return null;

    // find highest maximum
    let bestMax = maxima[0];
    for (const m of maxima) {
      if (nsdf[m] > nsdf[bestMax]) bestMax = m;
    }

    const highestVal = nsdf[bestMax];
    if (highestVal < 0.1) return null; // too noisy

    // threshold = 80% of highest max
    const threshold = 0.8 * highestVal;

    // pick first max above threshold (lowest frequency = fundamental)
    let chosen = -1;
    for (const m of maxima) {
      if (nsdf[m] >= threshold) { chosen = m; break; }
    }
    if (chosen < 0) return null;

    const tau = this.parabolicInterp(nsdf, chosen);
    if (tau < 1) return null;

    const freq = this.sampleRate / tau;
    if (freq < this.MIN_FREQ || freq > this.MAX_FREQ) return null;

    const clarity = nsdf[chosen];
    return { freq, clarity };
  }
}

export class MicrophonePitchTracker {
  constructor(onPitch, onSilence) {
    this.onPitch = onPitch;
    this.onSilence = onSilence;
    this.audioCtx = null;
    this.analyser = null;
    this.detector = null;
    this.stream = null;
    this.rafId = null;
    this.running = false;
    this.SILENCE_THRESHOLD = 0.01;
    this.smoothedFreq = null;
    this.SMOOTH = 0.85; // smoothing factor
  }

  async start() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    source.connect(this.analyser);

    this.detector = new PitchDetector(this.audioCtx.sampleRate, 2048);
    this.running = true;
    this._loop();
  }

  _loop() {
    if (!this.running) return;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);

    // RMS for silence detection
    let rms = 0;
    for (const s of buf) rms += s * s;
    rms = Math.sqrt(rms / buf.length);

    if (rms < this.SILENCE_THRESHOLD) {
      this.smoothedFreq = null;
      this.onSilence();
    } else {
      const result = this.detector.detect(buf);
      if (result) {
        if (this.smoothedFreq === null) {
          this.smoothedFreq = result.freq;
        } else {
          // only smooth if close (within a minor third) to avoid octave-jump smearing
          const ratio = result.freq / this.smoothedFreq;
          if (ratio > 0.83 && ratio < 1.2) {
            this.smoothedFreq = this.SMOOTH * this.smoothedFreq + (1 - this.SMOOTH) * result.freq;
          } else {
            this.smoothedFreq = result.freq;
          }
        }
        this.onPitch(this.smoothedFreq, result.clarity);
      } else {
        this.onSilence();
      }
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.audioCtx) this.audioCtx.close();
    this.smoothedFreq = null;
  }
}
