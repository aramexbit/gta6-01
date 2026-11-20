// PIER HEAT — Sunset Bay v6.8
// audio.js — every sound in the game is synthesised live with WebAudio:
// the Nightwave 98.3 synthwave loop (bass + pad + drums), gunshots, the
// police siren and the engine hum. No samples, no external files, nothing
// downloaded. Audio only ever starts after a real user gesture, so a
// headless screenshot or probe run stays completely silent and error-free.
(function () {
  'use strict';
  var PH = window.PH;

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.radioOn = false;
    this.noiseBuf = null;
    this.sirenNodes = null;
    this.engineNodes = null;
    this.wavesNodes = null;
    this._radioTimer = null;
    this._nextNote = 0;
    this._step = 0;
    this._gestureBound = false;
  }

  AudioEngine.prototype._ensureCtx = function () {
    if (this.ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      var len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = this.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
      return false;
    }
    return true;
  };

  // Call from a real user gesture (click / key). Never called by the game
  // on its own, so headless runs never touch the audio stack.
  AudioEngine.prototype.unlock = function () {
    try {
      if (!this._ensureCtx()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.radioOn) this.startRadio();
      if (!this.wavesNodes) this.startWaves();
    } catch (e) { /* audio must never break the game */ }
  };

  AudioEngine.prototype.bindGestures = function () {
    if (this._gestureBound) return;
    this._gestureBound = true;
    var self = this;
    function onGesture() { self.unlock(); }
    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = !!m;
    try {
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.4;
    } catch (e) { /* ignore */ }
    PH.hud.setRadio(this.muted);
  };
  AudioEngine.prototype.toggleMute = function () {
    this.setMuted(!this.muted);
    return this.muted;
  };

  // --- Nightwave 98.3: a gentle 96 BPM synthwave loop ---
  // Chords: Am – F – C – G. Pad = detuned saws through a lowpass, bass =
  // a soft triangle on the roots, drums = sine kick + noise hat/snare.
  AudioEngine.prototype.startRadio = function () {
    if (this.radioOn || !this.ctx) return;
    this.radioOn = true;
    var self = this;
    var bpm = 96;
    var eighth = 60 / bpm / 2;
    var chords = [
      [110.0, 130.81, 164.81], // Am
      [87.31, 110.0, 130.81],  // F
      [130.81, 164.81, 196.0], // C
      [98.0, 123.47, 146.83]   // G
    ];
    this._nextNote = this.ctx.currentTime + 0.1;
    this._step = 0;
    this._radioTimer = setInterval(function () {
      try { self._scheduleRadio(eighth, chords); } catch (e) { /* never break the game */ }
    }, 90);
  };

  AudioEngine.prototype.stopRadio = function () {
    try {
      if (this._radioTimer) { clearInterval(this._radioTimer); this._radioTimer = null; }
      this.radioOn = false;
    } catch (e) { /* ignore */ }
  };

  // Beach ambience: slow-filtered noise that swells like surf, so the pier
  // and the beach sound like the coast even when the radio is muted.
  AudioEngine.prototype.startWaves = function () {
    if (this.wavesNodes || !this.ctx) return;
    try {
      var ctx = this.ctx;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.4;
      var g = ctx.createGain();
      g.gain.value = 0.035;
      var lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.11;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(); lfo.start();
      this.wavesNodes = { src: src, lfo: lfo };
    } catch (e) { /* ignore */ }
  };

  AudioEngine.prototype._scheduleRadio = function (eighth, chords) {
    if (!this.ctx || this.muted) { this._nextNote = this.ctx ? this.ctx.currentTime + 0.1 : 0; return; }
    while (this._nextNote < this.ctx.currentTime + 0.25) {
      var step = this._step;
      var bar = Math.floor(step / 8) % 4;
      var chord = chords[bar];
      var t = this._nextNote;
      // Pad: new chord on the first eighth of each bar.
      if (step % 8 === 0) this._pad(chord, t, eighth * 8);
      // Bass: root on every eighth, fifth on the off-beats.
      var bassNote = (step % 2 === 0) ? chord[0] / 2 : chord[0] * 0.75;
      this._bass(bassNote, t, eighth * 0.9);
      // Kick on the beat, hat on the off-beat, snare on 2 and 4.
      if (step % 2 === 0) this._kick(t);
      else this._hat(t);
      if (step % 8 === 4) this._snare(t);
      // A soft plucked lead note every other bar, pentatonic.
      if (step % 16 === 8) this._pluck(chord[2] * 2, t);
      if (step % 16 === 12) this._pluck(chord[1] * 2, t);
      this._nextNote += eighth;
      this._step++;
    }
  };

  AudioEngine.prototype._pad = function (freqs, t, dur) {
    var ctx = this.ctx;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 0.6;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.4);
    gain.gain.setValueAtTime(0.05, t + dur - 0.4);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    filter.connect(gain); gain.connect(this.master);
    freqs.forEach(function (f) {
      [0, 6].forEach(function (det) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det - 3;
        o.connect(filter);
        o.start(t); o.stop(t + dur + 0.05);
      });
    });
  };

  AudioEngine.prototype._bass = function (freq, t, dur) {
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  AudioEngine.prototype._kick = function (t) {
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.2);
  };

  AudioEngine.prototype._hat = function (t) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.06);
  };

  AudioEngine.prototype._snare = function (t) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.15);
    var o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = 190;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g2); g2.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  };

  AudioEngine.prototype._pluck = function (freq, t) {
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2400;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.55);
  };

  // --- Sound effects (all synthesised, no samples) ---
  AudioEngine.prototype.shoot = function () {
    if (!this.ctx || this.muted) return;
    try {
      var ctx = this.ctx, t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + 0.14);
      var o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.09);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.18, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g2); g2.connect(this.master);
      o.start(t); o.stop(t + 0.11);
    } catch (e) { /* never break the game */ }
  };

  AudioEngine.prototype.siren = function (on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenNodes) {
        var ctx = this.ctx;
        var o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = 800;
        var lfo = ctx.createOscillator();
        lfo.type = 'square'; lfo.frequency.value = 0.9;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain); lfoGain.connect(o.frequency);
        var g = ctx.createGain();
        g.gain.value = 0.05;
        o.connect(g); g.connect(this.master);
        o.start(); lfo.start();
        this.sirenNodes = { o: o, lfo: lfo, g: g };
      } else if (!on && this.sirenNodes) {
        this.sirenNodes.o.stop();
        this.sirenNodes.lfo.stop();
        this.sirenNodes = null;
      }
    } catch (e) { /* ignore */ }
  };

  AudioEngine.prototype.engine = function (rpm01) {
    if (!this.ctx || this.muted) return;
    try {
      var ctx = this.ctx;
      if (!this.engineNodes) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = 70;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        var g = ctx.createGain();
        g.gain.value = 0.0;
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start();
        this.engineNodes = { o: o, f: f, g: g };
      }
      var n = this.engineNodes;
      n.o.frequency.setTargetAtTime(60 + rpm01 * 160, ctx.currentTime, 0.08);
      n.f.frequency.setTargetAtTime(320 + rpm01 * 900, ctx.currentTime, 0.1);
      n.g.gain.setTargetAtTime(0.05 + rpm01 * 0.05, ctx.currentTime, 0.1);
    } catch (e) { /* ignore */ }
  };

  AudioEngine.prototype.engineOff = function () {
    try {
      if (this.engineNodes) {
        this.engineNodes.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    } catch (e) { /* ignore */ }
  };

  PH.audio = new AudioEngine();
})();
