// PIER HEAT — Sunset Bay v7.4
// audio.js — fully synthesised WebAudio: Nightwave 98.3 synthwave radio,
// waves, siren, engine and gunshots, plus the v7.3 boat outboard, race
// countdown beeps and bow splash, and v7.4 gull cries + a harbour horn
// for the pier and boat scenes. No external sound files.
// Audio starts ONLY after a user gesture (click / button); headless
// screenshots stay silent and error-free.
(function () {
  'use strict';
  var PH = window.PH;

  PH.Audio = {
    ctx: null, master: null, radioBus: null, muted: false, started: false,
    radioTimer: null, bar: 0, step: 0,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    boatOsc: null, boatGain: null, boatFilter: null,

    init: function () {
      if (this.started) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.4;
        this.master.connect(this.ctx.destination);
        // Radio runs through its own bus so the siren can duck it (rev 2).
        this.radioBus = this.ctx.createGain();
        this.radioBus.gain.value = 1;
        this.radioBus.connect(this.master);
        this.started = true;
        this.startRadio();
        this.startWaves();
        this.startSurf();
        this.startGulls();
        this.startEngine();
      } catch (e) { /* audio is optional; never break the game */ }
    },

    mute: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.4;
      var b = document.getElementById('mute-btn');
      if (b) b.textContent = m ? 'UNMUTE [M]' : 'MUTE [M]';
    },
    toggleMute: function () { this.mute(!this.muted); },

    // --- Nightwave 98.3: 96 BPM synthwave, Am–F–C–G ---
    startRadio: function () {
      var self = this;
      var ctx = this.ctx;
      var chords = [
        [110.00, 130.81, 164.81], // Am
        [87.31, 130.81, 174.61],  // F
        [130.81, 164.81, 196.00], // C
        [98.00, 146.83, 196.00]   // G
      ];
      var penta = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
      var spb = 60 / 96 / 2; // eighth notes
      function note(freq, t, dur, type, gain, filterFreq) {
        var o = ctx.createOscillator();
        o.type = type; o.frequency.value = freq;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        var chain = o;
        if (filterFreq) {
          var f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = filterFreq;
          o.connect(f); f.connect(g); chain = f;
        } else o.connect(g);
        g.connect(self.radioBus);
        o.start(t); o.stop(t + dur + 0.05);
      }
      function noise(t, dur, type, freq, gain) {
        var len = Math.floor(ctx.sampleRate * dur);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource(); src.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
        var g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(self.radioBus);
        src.start(t); src.stop(t + dur);
      }
      this.radioTimer = setInterval(function () {
        if (!self.ctx || self.muted) return;
        var t0 = ctx.currentTime + 0.08;
        var barLen = spb * 8;
        var chord = chords[self.bar % 4];
        // pad: detuned saws through a lowpass, one bar long
        chord.forEach(function (f) {
          [0, 6].forEach(function (det) {
            var o = ctx.createOscillator();
            o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det - 3;
            var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
            var g = ctx.createGain();
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.05, t0 + 0.4);
            g.gain.linearRampToValueAtTime(0.001, t0 + barLen);
            o.connect(fl); fl.connect(g); g.connect(self.radioBus);
            o.start(t0); o.stop(t0 + barLen);
          });
        });
        // bass: triangle on the root, quarter notes
        for (var b = 0; b < 4; b++) note(chord[0] / 2, t0 + b * spb * 2, spb * 1.8, 'triangle', 0.16);
        // drums: kick on beats, hat on off-beats, snare on 2 & 4
        for (var s = 0; s < 8; s++) {
          var tt = t0 + s * spb;
          if (s % 2 === 0) {
            var k = ctx.createOscillator(); k.type = 'sine';
            k.frequency.setValueAtTime(130, tt);
            k.frequency.exponentialRampToValueAtTime(42, tt + 0.12);
            var kg = ctx.createGain();
            kg.gain.setValueAtTime(0.5, tt);
            kg.gain.exponentialRampToValueAtTime(0.001, tt + 0.16);
            k.connect(kg); kg.connect(self.radioBus);
            k.start(tt); k.stop(tt + 0.2);
          } else noise(tt, 0.05, 'highpass', 7000, 0.06);
          if (s === 2 || s === 6) {
            noise(tt, 0.14, 'bandpass', 1800, 0.2);
            note(190, tt, 0.1, 'triangle', 0.1);
          }
        }
        // plucked pentatonic lead every two bars
        if (self.bar % 2 === 0) {
          for (var n = 0; n < 4; n++) {
            var pf = penta[Math.floor(Math.random() * penta.length)];
            note(pf, t0 + n * spb * 2 + spb, 0.35, 'square', 0.05, 2200);
          }
        }
        self.bar++;
      }, spb * 8 * 1000);
    },

    // --- waves: looped noise through a 420 Hz lowpass, slow LFO swell ---
    startWaves: function () {
      var ctx = this.ctx;
      var len = ctx.sampleRate * 3;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      var g = ctx.createGain(); g.gain.value = 0.05;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
      var lg = ctx.createGain(); lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(); lfo.start();
    },

    // --- surf crash (round 2): a slow periodic breaker — a low boom
    // under a hiss, every ~9 s, so the shore breathes instead of
    // humming one flat loop
    startSurf: function () {
      if (!this.ctx || this.surfTimer) return;
      var self = this;
      this.surfTimer = setInterval(function () {
        if (!self.ctx || self.muted || Math.random() < 0.35) return;
        self.waveCrash();
      }, 9000);
    },
    waveCrash: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 1.4);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        var k = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.sin(k * Math.PI);
      }
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      // low boom under the hiss
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.7);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.12, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(og); og.connect(this.master);
      o.start(t); o.stop(t + 0.85);
    },

    // --- tyre screech (round 2): a bandpass noise sweep down, for the
    // race corners — called when a rival (or the player) takes a turn
    screech: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 6;
      f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    // --- police radio chatter (round 2): a static burst + two blips,
    // the sound of dispatch talking over the chase
    radioChatter: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.25);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2;
      var g = ctx.createGain(); g.gain.value = 0.1;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      [0.3, 0.48].forEach(function (off) {
        var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1250;
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.05, t + off);
        og.gain.exponentialRampToValueAtTime(0.001, t + off + 0.08);
        o.connect(og); og.connect(this.master);
        o.start(t + off); o.stop(t + off + 0.1);
      }, this);
    },

    // --- crowd cheer (round 2): a filtered noise swell with two
    // whistle blasts, for a checkpoint cleared or a race won
    crowdCheer: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 1.2);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        var k = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.sin(k * Math.PI) * 0.8;
      }
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      var g = ctx.createGain(); g.gain.value = 0.16;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      [0.15, 0.6].forEach(function (off) {
        var o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(2200, t + off);
        o.frequency.exponentialRampToValueAtTime(2600, t + off + 0.2);
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.04, t + off);
        og.gain.exponentialRampToValueAtTime(0.001, t + off + 0.25);
        o.connect(og); og.connect(this.master);
        o.start(t + off); o.stop(t + off + 0.3);
      }, this);
    },

    // --- boat horn, double blast (round 2): two harbour-horn blasts
    // with a gap, the sound that opens the boat job
    boatHorn: function () {
      if (!this.ctx || this.muted) return;
      var self = this;
      this.harbourHorn();
      setTimeout(function () { self.harbourHorn(); }, 650);
    },

    // --- siren: 800 Hz sine wobbled ±160 by a 0.9 Hz square LFO ---
    startSiren: function (on) {
      if (!this.ctx) return;
      if (on && !this.sirenOsc) {
        var ctx = this.ctx;
        var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 800;
        var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.9;
        var lg = ctx.createGain(); lg.gain.value = 160;
        lfo.connect(lg); lg.connect(o.frequency);
        var g = ctx.createGain(); g.gain.value = 0.04;
        o.connect(g); g.connect(this.master);
        o.start(); lfo.start();
        this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
        // duck the radio under the siren so dispatch stays readable
        if (this.radioBus) this.radioBus.gain.setTargetAtTime(0.45, ctx.currentTime, 0.2);
      } else if (!on && this.sirenOsc) {
        try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
        this.sirenOsc = null; this.sirenLfo = null;
        if (this.radioBus) this.radioBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.3);
      }
    },

    // --- engine: sawtooth through a lowpass, pitch + gain follow speed ---
    startEngine: function () {
      var ctx = this.ctx;
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      var g = ctx.createGain(); g.gain.value = 0.0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineOsc = o; this.engineGain = g; this.engineFilter = f;
    },
    setEngine: function (speed01) {
      if (!this.engineOsc) return;
      var t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 220, t, 0.08);
      this.engineFilter.frequency.setTargetAtTime(350 + speed01 * 1600, t, 0.08);
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.03 + speed01 * 0.09, t, 0.1);
    },

    // --- gull cries (v7.4): a descending two-note cry at random
    // intervals, so the pier and the boat scenes sound like the coast
    startGulls: function () {
      if (!this.ctx || this.gullTimer) return;
      var self = this;
      this.gullTimer = setInterval(function () {
        if (!self.ctx || self.muted || Math.random() < 0.5) return;
        var ctx = self.ctx, t = ctx.currentTime + 0.05;
        [0, 0.18].forEach(function (off, i) {
          var o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(i === 0 ? 1250 : 980, t + off);
          o.frequency.exponentialRampToValueAtTime(i === 0 ? 980 : 720, t + off + 0.14);
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.05, t + off);
          g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.16);
          o.connect(g); g.connect(self.master);
          o.start(t + off); o.stop(t + off + 0.2);
        });
      }, 7000);
    },

    // --- harbour horn (v7.4): a low two-tone blast for the boat job
    harbourHorn: function () {
      if (!this.ctx || this.muted) return;
      var self = this;
      var ctx = this.ctx, t = ctx.currentTime;
      [196, 147].forEach(function (f) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 600;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.linearRampToValueAtTime(0.001, t + 1.1);
        o.connect(fl); fl.connect(g); g.connect(self.master);
        o.start(t); o.stop(t + 1.15);
      });
    },
    startBoatEngine: function () {
      if (!this.ctx || this.boatOsc) return;
      // v7.4 rev 2: starting the outboard sounds the harbour horn once,
      // so the boat job opens with a blast as well as a hum
      this.harbourHorn();
      var ctx = this.ctx;
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 90;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      var g = ctx.createGain(); g.gain.value = 0.0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.boatOsc = o; this.boatGain = g; this.boatFilter = f;
    },
    setBoatEngine: function (speed01) {
      if (!this.boatOsc) return;
      var t = this.ctx.currentTime;
      this.boatOsc.frequency.setTargetAtTime(80 + speed01 * 160, t, 0.1);
      this.boatFilter.frequency.setTargetAtTime(400 + speed01 * 1200, t, 0.1);
      this.boatGain.gain.setTargetAtTime(this.muted ? 0 : 0.02 + speed01 * 0.07, t, 0.1);
    },
    stopBoatEngine: function () {
      if (!this.boatOsc) return;
      try { this.boatOsc.stop(); } catch (e) {}
      this.boatOsc = null; this.boatGain = null; this.boatFilter = null;
    },

    // --- race countdown beep (v7.3): short 880 Hz blip, GO is higher ---
    countdownBeep: function (go) {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = go ? 1320 : 880;
      var g = ctx.createGain();
      g.gain.setValueAtTime(go ? 0.3 : 0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (go ? 0.4 : 0.15));
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.45);
    },

    // --- bow splash (v7.3): filtered noise burst, lowpass 900 Hz ---
    splash: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.35);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      var g = ctx.createGain(); g.gain.value = 0.22;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    },

    // --- gunshot: bandpass noise burst + falling square ---
    gunshot: function () {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.12);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600;
      var g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      var o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.25, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(this.master);
      o.start(t); o.stop(t + 0.14);
    }
  };
})();
