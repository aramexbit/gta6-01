// PIER HEAT — Sunset Bay v7.4
// portraits.js — canvas-drawn face portraits for crew cards and the
// dialog box. Each character is defined once as a small feature object
// (skin, hair style + colour, jacket, extras) and rendered to an
// offscreen canvas at load, so the same face is used in the crew cards,
// the dialog portrait and the title screen. This replaces the old
// letter tiles ("K" / "M"). No image files; everything is drawn in code.
// v7.4: each character gets their own backdrop tint + a small accent
// (Dario's scar, Lena's blush, Kira's earring) so the four faces are
// not the same drawing in four jackets.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;

  // Feature objects: one definition per character, reused everywhere.
  PH.PORTRAIT_DEFS = {
    mateo: {
      skin: '#e0ac69', hair: '#2a1a12', hairStyle: 'short', jacket: '#ff7a1a',
      tee: '#f2f2f2', stubble: true, brows: 'flat', name: 'MATEO VEGA', role: 'DRIVER',
      bg: ['#3a1a4a', '#c85a3a', '#ffb347'], accent: 'stubble'
    },
    kira: {
      skin: '#f2c89b', hair: '#2a1a12', hairStyle: 'long', jacket: '#0e7a7a',
      tee: '#222831', stubble: false, brows: 'arched', name: 'KIRA', role: 'HANDLER',
      bg: ['#0a2a4a', '#0e7a7a', '#7ad8c8'], accent: 'earring'
    },
    dario: {
      skin: '#c68642', hair: '#1a1a1a', hairStyle: 'buzz', jacket: '#2a6fd8',
      tee: '#f2f2f2', stubble: true, brows: 'flat', name: 'DARIO', role: 'MECHANIC',
      bg: ['#1a1a2a', '#4a4a5a', '#8a8a9a'], accent: 'scar'
    },
    lena: {
      skin: '#ffdbac', hair: '#8a6a3a', hairStyle: 'bob', jacket: '#8a5aff',
      tee: '#f2f2f2', stubble: false, brows: 'arched', name: 'LENA', role: 'WHEELWOMAN',
      bg: ['#2a1a4a', '#8a5aff', '#ff9ad8'], accent: 'blush'
    }
  };

  // Draw one face into a 2D context. Canvas is square (size x size);
  // the face is centred, shoulders at the bottom, jacket in the
  // character colour so the card reads even at 48 px.
  PH.drawPortraitFace = function (g, def, size) {
    var s = size / 96; // design grid is 96x96
    g.clearRect(0, 0, size, size);
    // backdrop: each character's own dusk gradient + faint sun disc
    var bgc = def.bg || ['#2a1a4a', '#c85a3a', '#ffb347'];
    var bg = g.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, bgc[0]); bg.addColorStop(0.55, bgc[1]); bg.addColorStop(1, bgc[2]);
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(255,230,160,0.85)';
    g.beginPath(); g.arc(70 * s, 22 * s, 9 * s, 0, Math.PI * 2); g.fill();
    // shoulders / jacket
    g.fillStyle = def.jacket;
    g.beginPath();
    g.moveTo(8 * s, 96 * s);
    g.quadraticCurveTo(20 * s, 72 * s, 48 * s, 72 * s);
    g.quadraticCurveTo(76 * s, 72 * s, 88 * s, 96 * s);
    g.closePath(); g.fill();
    // tee V at the collar
    g.fillStyle = def.tee;
    g.beginPath();
    g.moveTo(42 * s, 72 * s); g.lineTo(48 * s, 84 * s); g.lineTo(54 * s, 72 * s);
    g.closePath(); g.fill();
    // neck
    g.fillStyle = def.skin;
    g.fillRect(43 * s, 60 * s, 10 * s, 14 * s);
    // head
    g.beginPath(); g.ellipse(48 * s, 42 * s, 19 * s, 23 * s, 0, 0, Math.PI * 2); g.fill();
    // ears
    g.beginPath(); g.ellipse(29 * s, 44 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(67 * s, 44 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
    // hair by style
    g.fillStyle = def.hair;
    if (def.hairStyle === 'long') {
      g.beginPath();
      g.moveTo(28 * s, 46 * s);
      g.quadraticCurveTo(26 * s, 12 * s, 48 * s, 12 * s);
      g.quadraticCurveTo(70 * s, 12 * s, 68 * s, 46 * s);
      g.quadraticCurveTo(68 * s, 66 * s, 64 * s, 68 * s);
      g.lineTo(64 * s, 40 * s);
      g.quadraticCurveTo(62 * s, 24 * s, 48 * s, 24 * s);
      g.quadraticCurveTo(34 * s, 24 * s, 32 * s, 40 * s);
      g.lineTo(32 * s, 68 * s);
      g.quadraticCurveTo(28 * s, 66 * s, 28 * s, 46 * s);
      g.closePath(); g.fill();
    } else if (def.hairStyle === 'bob') {
      g.beginPath();
      g.moveTo(29 * s, 44 * s);
      g.quadraticCurveTo(28 * s, 14 * s, 48 * s, 14 * s);
      g.quadraticCurveTo(68 * s, 14 * s, 67 * s, 44 * s);
      g.lineTo(62 * s, 44 * s);
      g.quadraticCurveTo(60 * s, 26 * s, 48 * s, 26 * s);
      g.quadraticCurveTo(36 * s, 26 * s, 34 * s, 44 * s);
      g.closePath(); g.fill();
    } else if (def.hairStyle === 'buzz') {
      g.beginPath();
      g.ellipse(48 * s, 26 * s, 19 * s, 10 * s, 0, Math.PI, 0); g.fill();
    } else {
      // short: cap + fringe
      g.beginPath();
      g.ellipse(48 * s, 30 * s, 19 * s, 13 * s, 0, Math.PI, 0); g.fill();
      g.fillRect(30 * s, 28 * s, 36 * s, 5 * s);
    }
    // brows
    g.strokeStyle = '#14100c'; g.lineWidth = 2.2 * s; g.lineCap = 'round';
    g.beginPath();
    if (def.brows === 'arched') { g.moveTo(35 * s, 36 * s); g.quadraticCurveTo(40 * s, 32 * s, 45 * s, 36 * s); }
    else { g.moveTo(35 * s, 35 * s); g.lineTo(45 * s, 35 * s); }
    g.stroke();
    g.beginPath();
    if (def.brows === 'arched') { g.moveTo(51 * s, 36 * s); g.quadraticCurveTo(56 * s, 32 * s, 61 * s, 36 * s); }
    else { g.moveTo(51 * s, 35 * s); g.lineTo(61 * s, 35 * s); }
    g.stroke();
    // eyes (white + dark pupil + glint)
    [[40, 42], [56, 42]].forEach(function (e) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(e[0] * s, e[1] * s, 4.5 * s, 3.2 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#14100c';
      g.beginPath(); g.arc(e[0] * s, e[1] * s, 2.2 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc((e[0] + 0.8) * s, (e[1] - 0.8) * s, 0.8 * s, 0, Math.PI * 2); g.fill();
    });
    // nose + mouth
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.6 * s;
    g.beginPath(); g.moveTo(48 * s, 44 * s); g.lineTo(46 * s, 51 * s); g.lineTo(49 * s, 52 * s); g.stroke();
    g.strokeStyle = '#5a2a1a'; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(43 * s, 57 * s); g.quadraticCurveTo(48 * s, 60 * s, 53 * s, 57 * s); g.stroke();
    // stubble
    if (def.stubble) {
      g.fillStyle = 'rgba(42,26,18,0.35)';
      g.beginPath(); g.ellipse(48 * s, 58 * s, 13 * s, 7 * s, 0, 0, Math.PI); g.fill();
    }
    // per-character accent (v7.4): Dario's scar, Lena's blush, Kira's
    // gold earring — small marks that tell the four faces apart
    if (def.accent === 'scar') {
      g.strokeStyle = 'rgba(90,30,20,0.8)'; g.lineWidth = 1.6 * s;
      g.beginPath(); g.moveTo(34 * s, 40 * s); g.lineTo(38 * s, 48 * s); g.stroke();
    } else if (def.accent === 'blush') {
      g.fillStyle = 'rgba(255,120,140,0.4)';
      g.beginPath(); g.ellipse(36 * s, 50 * s, 4 * s, 2.5 * s, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(60 * s, 50 * s, 4 * s, 2.5 * s, 0, 0, Math.PI * 2); g.fill();
    } else if (def.accent === 'earring') {
      g.fillStyle = '#ffd23c';
      g.beginPath(); g.arc(67 * s, 50 * s, 1.8 * s, 0, Math.PI * 2); g.fill();
    }
    // rim light on the sun side
    g.strokeStyle = 'rgba(255,210,120,0.7)'; g.lineWidth = 2 * s;
    g.beginPath(); g.ellipse(48 * s, 42 * s, 19 * s, 23 * s, 0, -Math.PI * 0.7, -Math.PI * 0.15); g.stroke();
  };

  // Render a character to a fresh canvas and return it (cached per key).
  PH._portraitCache = {};
  PH.portraitCanvas = function (who, size) {
    size = size || 96;
    var key = who + '@' + size;
    if (PH._portraitCache[key]) return PH._portraitCache[key];
    var def = PH.PORTRAIT_DEFS[who] || PH.PORTRAIT_DEFS.mateo;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    PH.drawPortraitFace(c.getContext('2d'), def, size);
    PH._portraitCache[key] = c;
    return c;
  };
  PH.portraitURL = function (who, size) {
    return PH.portraitCanvas(who, size || 96).toDataURL('image/png');
  };

  // Paint a portrait into an existing <canvas> element in the HUD.
  PH.paintPortrait = function (canvas, who) {
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var def = PH.PORTRAIT_DEFS[who] || PH.PORTRAIT_DEFS.mateo;
    PH.drawPortraitFace(g, def, canvas.width);
  };

  // Build the crew strip (right side of the HUD): one card per member
  // with portrait, name, role and a tiny status line. Called once at
  // boot; the status text is updated by PH.hud.setCrew.
  PH.buildCrewCards = function () {
    var box = document.getElementById('crew-cards');
    if (!box) return;
    var order = ['mateo', 'kira', 'dario', 'lena'];
    box.innerHTML = '';
    order.forEach(function (who) {
      var def = PH.PORTRAIT_DEFS[who];
      var card = document.createElement('div');
      card.className = 'crew-card';
      card.id = 'crew-' + who;
      var cv = document.createElement('canvas');
      cv.width = 48; cv.height = 48; cv.className = 'crew-face';
      // v7.4 rev 2: the face frame takes the character's jacket colour,
      // so each card's rim matches its portrait at a glance
      cv.style.borderColor = def.jacket;
      PH.paintPortrait(cv, who);
      var info = document.createElement('div');
      info.className = 'crew-info';
      var nm = document.createElement('div');
      nm.className = 'crew-name'; nm.textContent = def.name;
      var rl = document.createElement('div');
      rl.className = 'crew-role'; rl.textContent = def.role;
      var st = document.createElement('div');
      st.className = 'crew-status'; st.id = 'crew-status-' + who;
      st.textContent = who === 'mateo' ? 'ON THE JOB' : 'ON CALL';
      info.appendChild(nm); info.appendChild(rl); info.appendChild(st);
      card.appendChild(cv); card.appendChild(info);
      box.appendChild(card);
    });
  };
})();
