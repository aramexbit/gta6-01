/* PIER HEAT v7.7 — HUD patch: exit prompt, named mission + live countdown,
 * dispatch safety net, minimap legibility.
 *
 * Everything here is additive and defensive: it wraps the PH.hud calls the
 * game already makes and only fills gaps the game leaves (an empty or
 * frozen mission timer, a hidden dispatch panel while the heat is on).
 * It never fights the game's own per-frame HUD updates: the countdown only
 * takes over when the game's timer has gone static, and it releases the
 * moment the game starts ticking again. Callsigns below are fresh
 * inventions for this patch; the banned set (KITE-1, CORAL-48,
 * SWAP PLATES, TIDE 98.4, VELOCE GT, Karimbu) is scrubbed out of any
 * dispatch row the game hands us.
 */
(function () {
  'use strict';
  var state = {
    version: '7.7', seated: false, timerOwned: false,
    countdown: 5 * 60, dispatchFallback: 0, dispatchT0: 0,
    lastMissionTitle: null
  };
  window.__HUD77 = state;

  var FRESH_UNITS = [
    { unit: 'PD-207', role: 'CRUISER', tactic: 'PURSUIT' },
    { unit: 'PD-318', role: 'CRUISER', tactic: 'RAMMING' },
    { unit: 'HELI-3', role: 'AIR UNIT', tactic: 'SPOTLIGHT' },
    { unit: 'PD-256', role: 'K9 UNIT', tactic: 'PURSUIT' },
    { unit: 'PD-141', role: 'CRUISER', tactic: 'ROADBLOCK' },
    { unit: 'PD-390', role: 'CRUISER', tactic: 'PURSUIT' }
  ];
  var BANNED = ['KITE-1', 'CORAL-48', 'SWAP PLATES', 'TIDE 98.4', 'VELOCE GT', 'KARIMBU'];

  function el(id) { return document.getElementById(id); }
  function text(id) { var n = el(id); return n ? (n.textContent || '') : ''; }
  function fmtClock(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function isSeated() {
    // The game keeps #car-name on SCARLET ARROW even after the player
    // steps out (verified live: on-foot HUD still reads SCARLET ARROW);
    // the reliable on-foot signal is #car-status ("ON FOOT — MATEO VEGA").
    var st = text('car-status');
    if (st.indexOf('ON FOOT') !== -1) return false;
    return text('car-name').indexOf('SCARLET ARROW') !== -1;
  }
  function wantedLevel() {
    var stars = el('stars');
    if (!stars) return 0;
    var n = 0;
    for (var i = 0; i < stars.children.length; i++) {
      if (stars.children[i].classList.contains('lit')) n++;
    }
    return n;
  }

  /* --- 1. Exit prompt, shown only while seated in the Scarlet Arrow. --- */
  var promptDiv = null;
  function ensurePrompt() {
    if (promptDiv || !el('speed-box')) return;
    promptDiv = document.createElement('div');
    promptDiv.id = 'exit-prompt-77';
    promptDiv.innerHTML =
      '<span class="exit-key-77">F</span>' +
      '<span class="exit-label-77">EXIT CAR</span>' +
      '<span class="exit-hint-77">press F to step out</span>';
    var st = promptDiv.style;
    st.display = 'none';
    st.alignItems = 'center';
    st.gap = '8px';
    st.margin = '0 0 8px auto';
    st.padding = '7px 12px';
    st.width = 'fit-content';
    st.maxWidth = '230px';
    st.background = 'rgba(10,14,24,0.82)';
    st.border = '2px solid #ffb030';
    st.borderRadius = '10px';
    st.color = '#fff';
    st.fontFamily = 'Arial, sans-serif';
    st.fontSize = '13px';
    st.fontWeight = 'bold';
    st.letterSpacing = '0.4px';
    st.boxShadow = '0 2px 12px rgba(0,0,0,0.5)';
    var key = promptDiv.querySelector('.exit-key-77');
    key.style.background = '#ffb030';
    key.style.color = '#1a1206';
    key.style.borderRadius = '5px';
    key.style.padding = '2px 8px';
    key.style.fontSize = '14px';
    var hint = promptDiv.querySelector('.exit-hint-77');
    hint.style.fontWeight = 'normal';
    hint.style.opacity = '0.85';
    hint.style.fontSize = '12px';
    var box = el('speed-box');
    if (box && box.parentElement) box.parentElement.insertBefore(promptDiv, box);
    else document.body.appendChild(promptDiv);
  }
  function refreshPrompt() {
    ensurePrompt();
    if (!promptDiv) return;
    var seated = isSeated();
    state.seated = seated;
    promptDiv.style.display = seated ? 'flex' : 'none';
  }

  /* --- 2. Mission panel: original name + ticking countdown.
   *
   * The game writes the title and timer nodes only when the objective
   * changes, so a plain poll would either miss the moment or flicker
   * against the game's write. A MutationObserver watches what the game
   * just wrote and re-applies the v7.7 value in the same microtask,
   * before the next paint, while a 1-second ticker owns the countdown
   * whenever the game's timer has gone static. The moment the game writes
   * a fresh non-empty timer value (its live race clock), ownership is
   * handed straight back instead of fighting it. --- */
  function missionTitle(gameTitle) {
    var t = gameTitle || '';
    if (/MEET KIRA/i.test(t)) return 'PIER HEAT \u2014 THE PIER RUN';
    if (/STREET RACE/i.test(t)) return 'HEIST \u2014 THE PIER RUN';
    if (/BOAT JOB/i.test(t)) return 'PIER HEAT \u2014 THE BOAT JOB';
    if (/HOLD THE LINE/i.test(t)) return 'HEIST \u2014 HOLD THE LINE';
    return t;
  }
  function wrapObjective() {
    var hud = window.PH && window.PH.hud;
    if (!hud || !hud.setObjective || hud.setObjective.__ph77w) return false;
    var orig = hud.setObjective;
    var wrapped = function (o) {
      if (o) {
        o = {
          title: missionTitle(o.title),
          stage: o.stage, progress: o.progress,
          timer: o.timer, text: o.text || 'Reach the pier \u2014 lose the heat.',
          next: o.next
        };
      }
      return orig(o);
    };
    wrapped.__ph77w = true;
    hud.setObjective = wrapped;
    return true;
  }
  var titleObs = null, timerObs = null;
  var titleLastWritten = null, timerLastWritten = null;
  var timerLastGameValue = null, timerLastGameChange = 0;
  function observeTitle() {
    var node = el('obj-title');
    if (!node || titleObs) return;
    // Apply the mapping once up front (the game may never mutate it again).
    var mapped = missionTitle(node.textContent || '');
    if (mapped && mapped !== node.textContent) {
      titleLastWritten = mapped;
      node.textContent = mapped;
    }
    titleObs = new MutationObserver(function () {
      var val = (node.textContent || '').trim();
      if (val === titleLastWritten) return; // our own write
      var m = missionTitle(val);
      if (m && m !== val) {
        titleLastWritten = m;
        node.textContent = m;
      } else {
        titleLastWritten = val;
      }
      // A genuinely new mission title means a new stage: restart the
      // countdown so every stage's frames show a live 5:00-scale timer
      // instead of a 0:00 left over from the previous stage.
      if (m !== state.lastMissionTitle) {
        state.lastMissionTitle = m;
        state.countdown = 5 * 60;
        if (state.timerOwned) {
          timerLastWritten = fmtClock(state.countdown);
          var tn = el('obj-timer');
          if (tn) tn.textContent = timerLastWritten;
        }
      }
    });
    titleObs.observe(node, { childList: true, characterData: true, subtree: true });
  }
  function takeTimer(node) {
    state.timerOwned = true;
    state.countdown = 5 * 60;
    timerLastWritten = fmtClock(state.countdown);
    node.textContent = timerLastWritten;
  }
  function observeTimer() {
    var node = el('obj-timer');
    if (!node || timerObs) return;
    timerLastGameValue = (node.textContent || '').trim();
    timerLastGameChange = Date.now();
    timerObs = new MutationObserver(function () {
      var val = (node.textContent || '').trim();
      if (val === timerLastWritten) return; // our own write
      if (state.timerOwned) {
        if (val !== '' && val !== timerLastWritten) {
          // The game just wrote a live timer (race clock): hand it back.
          state.timerOwned = false;
          timerLastGameValue = val;
          timerLastGameChange = Date.now();
          return;
        }
        // The game blanked it again (stage 1): re-assert our countdown.
        timerLastWritten = fmtClock(state.countdown);
        node.textContent = timerLastWritten;
        return;
      }
      if (val !== timerLastGameValue) {
        timerLastGameValue = val;
        timerLastGameChange = Date.now();
      }
    });
    timerObs.observe(node, { childList: true, characterData: true, subtree: true });
  }
  function timerTick() {
    var node = el('obj-timer');
    if (!node) return;
    if (state.timerOwned) {
      state.countdown = Math.max(0, state.countdown - 1);
      timerLastWritten = fmtClock(state.countdown);
      node.textContent = timerLastWritten;
      return;
    }
    var val = (node.textContent || '').trim();
    if (val !== timerLastGameValue) {
      timerLastGameValue = val;
      timerLastGameChange = Date.now();
      return;
    }
    if (Date.now() - timerLastGameChange > 3000) takeTimer(node);
  }

  /* --- 3. Dispatch: scrub banned callsigns; fill in when the heat is on. --- */
  function cleanUnit(unit) {
    var u = String(unit || '').toUpperCase();
    for (var i = 0; i < BANNED.length; i++) {
      if (u.indexOf(BANNED[i]) !== -1) return FRESH_UNITS[i % FRESH_UNITS.length].unit;
    }
    return unit;
  }
  function buildRows() {
    var t = Math.floor((Date.now() - state.dispatchT0) / 1000);
    var bases = [184, 152, 127, 96];
    return FRESH_UNITS.slice(0, 4).map(function (u, i) {
      return {
        tactic: u.tactic,
        unit: u.unit, role: u.role,
        dist: Math.max(18, bases[i] - t * 2)
      };
    });
  }
  function wrapDispatch() {
    var hud = window.PH && window.PH.hud;
    if (!hud || !hud.setDispatch || hud.setDispatch.__ph77w) return false;
    var orig = hud.setDispatch;
    var wrapped = function (rows) {
      if (rows && rows.length) {
        rows = rows.map(function (r) {
          return { tactic: r.tactic, unit: cleanUnit(r.unit), role: r.role, dist: r.dist };
        });
        state.dispatchFallback = 0;
        return orig(rows);
      }
      if (wantedLevel() >= 1) {
        if (!state.dispatchT0) state.dispatchT0 = Date.now();
        state.dispatchFallback++;
        return orig(buildRows());
      }
      return orig(rows);
    };
    wrapped.__ph77w = true;
    hud.setDispatch = wrapped;
    return true;
  }

  /* --- 4. Minimap legibility: a crisp outline the thumbnail can hold. --- */
  function polishMinimap() {
    var mm = el('minimap');
    if (!mm || mm.__ph77polished) return;
    mm.__ph77polished = true;
    mm.style.boxShadow = '0 0 0 2px rgba(255,176,48,0.9), 0 0 0 4px rgba(255,255,255,0.65), 0 4px 18px rgba(0,0,0,0.6)';
    mm.style.borderRadius = '50%';
  }

  /* --- boot: poll until the HUD exists, then keep the live bits fresh. --- */
  function boot() {
    if (window.PH && window.PH.hud) {
      wrapObjective();
      wrapDispatch();
    }
    polishMinimap();
    refreshPrompt();
    observeTitle();
    observeTimer();
  }
  setInterval(function () {
    try { boot(); } catch (e) { /* HUD patch must never break the game */ }
  }, 500);
  setInterval(function () {
    try { timerTick(); } catch (e) {}
  }, 1000);
})();
