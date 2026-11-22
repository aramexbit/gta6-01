// PIER HEAT — Sunset Bay v8.0: fully procedural audio. Nightwave 98.3 is a looped synth groove
// (bass line, hats, pad) built from oscillators; engine hum, sirens, gunshots and the boat
// engine are synthesised too. No copied assets, no audio files. Starts on the first user gesture.
(function () {
  'use strict';
  var PH = window.PH;

  PH.audio = {
    ctx: null,
    master: null,
    musicOn: true,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    boatOsc: null,
    boatGain: null,
    _musicTimer: null,
    _step: 0,

    init: function () {
      if (this.ctx) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume: function () {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    setRadio: function (name) {
      if (window.PH && PH.hud) PH.hud.setRadio(name);
    },

    // --- Nightwave 98.3: simple looped synth groove, 112 BPM, A minor ---
    startMusic: function () {
      if (!this.ctx || this._musicTimer) return;
      var self = this;
      var bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 A1 A1 E2 D2
      var padNotes = [220, 261.63, 329.63];
      this._musicTimer = setInterval(function () {
        if (!self.musicOn || !self.ctx) return;
        var t = self.ctx.currentTime;
        var step = self._step++ % 16;
        // bass on every beat
        if (step % 2 === 0) {
          var bn = bassNotes[(step / 2) % bassNotes.length];
          self._tone(bn, 0.24, 'sawtooth', 0.16, t);
        }
        // hats on off-beats
        if (step % 2 === 1) self._noise(0.05, 0.05, 6000, t);
        // pad chord at the top of each bar
        if (step === 0) {
          for (var i = 0; i < padNotes.length; i++) self._tone(padNotes[i], 1.9, 'triangle', 0.045, t);
        }
        // sparkle arp every 4 steps
        if (step % 4 === 2) self._tone(440 * Math.pow(2, (step % 8) / 12), 0.18, 'sine', 0.07, t);
      }, 134); // 112 BPM eighth notes
    },
    _tone: function (freq, dur, type, vol, when) {
      if (!this.ctx) return;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + dur + 0.02);
    },
    _noise: function (dur, vol, freq, when) {
      if (!this.ctx) return;
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var filt = this.ctx.createBiquadFilter();
      filt.type = 'highpass'; filt.frequency.value = freq;
      var g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(when);
    },

    // --- engine hum: pitch follows speed ---
    setEngine: function (speed01) {
      if (!this.ctx) return;
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        var filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 700;
        this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      var t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.06, t, 0.1);
    },
    setBoatEngine: function (speed01) {
      if (!this.ctx) return;
      if (!this.boatOsc) {
        this.boatOsc = this.ctx.createOscillator();
        this.boatOsc.type = 'square';
        this.boatGain = this.ctx.createGain();
        this.boatGain.gain.value = 0;
        var filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 500;
        this.boatOsc.connect(filt); filt.connect(this.boatGain); this.boatGain.connect(this.master);
        this.boatOsc.start();
      }
      var t = this.ctx.currentTime;
      this.boatOsc.frequency.setTargetAtTime(45 + speed01 * 110, t, 0.1);
      this.boatGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, t, 0.1);
    },

    // --- two-tone police siren ---
    siren: function (on) {
      if (!this.ctx) return;
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.035;
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.frequency.value = 0.9;
        var lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); this.sirenLfo.start();
      } else if (!on && this.sirenOsc) {
        try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
        this.sirenOsc = null; this.sirenLfo = null;
      }
    },

    shot: function () {
      if (!this.ctx) return;
      this._noise(0.14, 0.5, 900, this.ctx.currentTime);
      this._tone(160, 0.1, 'square', 0.22, this.ctx.currentTime);
    },
    blip: function () {
      if (!this.ctx) return;
      this._tone(880, 0.12, 'sine', 0.12, this.ctx.currentTime);
    },
    reload: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      this._tone(300, 0.05, 'square', 0.1, t);
      this._tone(420, 0.05, 'square', 0.1, t + 0.14);
    },
    crash: function () {
      if (!this.ctx) return;
      this._noise(0.3, 0.4, 300, this.ctx.currentTime);
    }
  };
})();
