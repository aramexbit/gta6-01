// PIER HEAT — Sunset Bay v8.0: canvas-drawn portraits. Face + shoulders, distinct hair, skin
// and clothes per person, used in dialog and crew cards. Pure 2D canvas, no copied assets.
(function () {
  'use strict';
  var PH = window.PH;

  var DEFS = {
    mateo: { skin: '#c98a5a', hair: '#8a6a3a', jacket: '#e8541a', tee: '#f0f0f0', hairStyle: 'swept', beard: true, chain: true },
    kira: { skin: '#d8a070', hair: '#1a1210', jacket: '#1a8a7a', tee: '#10302e', hairStyle: 'long', headset: true },
    dario: { skin: '#8a5a3a', hair: '#1a1210', jacket: '#3a3a44', tee: '#444444', hairStyle: 'cap', cap: '#2a2a2a' },
    lena: { skin: '#e8b88a', hair: '#6a2a1a', jacket: '#c0392b', tee: '#ffe9b0', hairStyle: 'long' }
  };

  function drawPortrait(g, w, h, name) {
    var d = DEFS[name] || DEFS.mateo;
    var cx = w / 2;
    // background: warm sunset gradient
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff9e5e'); grad.addColorStop(0.55, '#c96a4a'); grad.addColorStop(1, '#3a2a4a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // shoulders / jacket
    g.fillStyle = d.jacket;
    g.beginPath(); g.moveTo(cx - w * 0.42, h); g.quadraticCurveTo(cx - w * 0.4, h * 0.66, cx - w * 0.2, h * 0.62);
    g.lineTo(cx + w * 0.2, h * 0.62); g.quadraticCurveTo(cx + w * 0.4, h * 0.66, cx + w * 0.42, h); g.closePath(); g.fill();
    // tee
    g.fillStyle = d.tee;
    g.beginPath(); g.moveTo(cx - w * 0.09, h * 0.62); g.lineTo(cx + w * 0.09, h * 0.62);
    g.lineTo(cx + w * 0.13, h); g.lineTo(cx - w * 0.13, h); g.closePath(); g.fill();
    // gold chain for Mateo
    if (d.chain) {
      g.strokeStyle = '#ffd94a'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(cx, h * 0.66, w * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
    // neck + face
    g.fillStyle = d.skin;
    g.fillRect(cx - w * 0.05, h * 0.52, w * 0.1, h * 0.14);
    g.beginPath(); g.ellipse(cx, h * 0.36, w * 0.19, h * 0.21, 0, 0, Math.PI * 2); g.fill();
    // ears
    g.beginPath(); g.ellipse(cx - w * 0.19, h * 0.37, w * 0.03, h * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + w * 0.19, h * 0.37, w * 0.03, h * 0.05, 0, 0, Math.PI * 2); g.fill();
    // hair
    g.fillStyle = d.hair;
    if (d.hairStyle === 'swept') {
      g.beginPath(); g.ellipse(cx, h * 0.19, w * 0.2, h * 0.1, 0, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(cx + w * 0.05, h * 0.17, w * 0.14, h * 0.06, -0.25, Math.PI, 0); g.fill();
    } else if (d.hairStyle === 'long') {
      g.beginPath(); g.ellipse(cx, h * 0.2, w * 0.21, h * 0.11, 0, Math.PI, 0); g.fill();
      g.fillRect(cx - w * 0.21, h * 0.2, w * 0.06, h * 0.42);
      g.fillRect(cx + w * 0.15, h * 0.2, w * 0.06, h * 0.42);
    } else if (d.hairStyle === 'cap') {
      g.fillStyle = d.cap;
      g.beginPath(); g.ellipse(cx, h * 0.2, w * 0.2, h * 0.08, 0, Math.PI, 0); g.fill();
      g.fillRect(cx - w * 0.2, h * 0.2, w * 0.44, h * 0.03);
    }
    // brows
    g.fillStyle = '#1a1210';
    g.fillRect(cx - w * 0.13, h * 0.3, w * 0.09, h * 0.015);
    g.fillRect(cx + w * 0.04, h * 0.3, w * 0.09, h * 0.015);
    // eyes: white + pupils
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(cx - w * 0.085, h * 0.345, w * 0.038, h * 0.022, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + w * 0.085, h * 0.345, w * 0.038, h * 0.022, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#241608';
    g.beginPath(); g.arc(cx - w * 0.085, h * 0.345, w * 0.016, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + w * 0.085, h * 0.345, w * 0.016, 0, Math.PI * 2); g.fill();
    // nose + lips
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(cx - w * 0.008, h * 0.36, w * 0.016, h * 0.05);
    g.fillStyle = '#a04a3a';
    g.fillRect(cx - w * 0.06, h * 0.47, w * 0.12, h * 0.012);
    g.fillStyle = '#c06a55';
    g.fillRect(cx - w * 0.06, h * 0.482, w * 0.12, h * 0.012);
    // thin beard for Mateo
    if (d.beard) {
      g.fillStyle = 'rgba(26,18,16,0.85)';
      g.fillRect(cx - w * 0.1, h * 0.5, w * 0.2, h * 0.015);
    }
    // headset for Kira
    if (d.headset) {
      g.strokeStyle = '#222222'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, h * 0.3, w * 0.21, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.fillStyle = '#222222';
      g.fillRect(cx - w * 0.24, h * 0.33, w * 0.05, h * 0.07);
      g.fillRect(cx - w * 0.24, h * 0.42, w * 0.02, h * 0.1);
    }
    // thin gold rim, matching the dialog frame
    g.strokeStyle = 'rgba(255,179,71,0.85)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  PH.portraits = {
    _cache: {},
    urlFor: function (name) {
      if (this._cache[name]) return this._cache[name];
      var c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      drawPortrait(c.getContext('2d'), 128, 128, name);
      var url = c.toDataURL('image/png');
      this._cache[name] = url;
      return url;
    },
    drawInto: function (canvas, name) {
      if (!canvas) return;
      var w = canvas.width, h = canvas.height;
      drawPortrait(canvas.getContext('2d'), w, h, name);
    }
  };
})();
