// PIER HEAT v6.4 — core.js
// Game state, mission definitions, crime / wanted logic, damage routing,
// district naming and the localStorage save. No rendering lives here:
// world.js builds the city, sim.js moves things in it, main.js runs the loop.
(function () {
  'use strict';

  // ---------------------------------------------------------------- state
  var SAVE_KEY = 'pierheat-save-v1';

  var state = {
    started: false,
    inCar: false,
    missionIndex: 0,        // 0 = M1 PIER RUN, 1 = M2 THREE GATES, 2 = M3 NIGHT MARKET
    missionStage: 1,        // stage inside the current mission (1-based)
    missionTimeLeft: 300,   // seconds left on the mission clock
    wanted: 0,              // 0..5 stars
    heatArmed: false,       // becomes true once the first chase fires
    money: 12800,           // starting wallet; M1 pays +2,500 -> $15,300
    health: 100,
    armour: 50,
    respect: 100,
    ammo: 48,               // pistol rounds
    speedKmh: 0,
    carCondition: 100,
    carFuel: 100,
    currentCar: null,       // 'arrow' | 'stolen' | null
    kills: 0,
    gatesPassed: 0,
  };

  // ------------------------------------------------------------- missions
  // Every mission is original fiction set in Sunset Bay. Stage counts and
  // rewards are the contract the HUD and the save slots display.
  var MISSIONS = [
    {
      id: 'M1', name: 'PIER RUN', totalStages: 1, timeLimit: 300,
      briefing: 'Kira: the Scarlet Arrow is parked in the Marina lot. Take it.',
      next: 'TAKE THE SCARLET ARROW',
      rewardMoney: 2500, rewardRespect: 40,
    },
    {
      id: 'M2', name: 'THREE GATES', totalStages: 3, timeLimit: 240,
      briefing: 'Kira: three gates, three checkpoints. Thread them before the Bay wakes up.',
      next: 'GATE 1 — PIER PLAZA',
      rewardMoney: 5000, rewardRespect: 60,
    },
    {
      id: 'M3', name: 'NIGHT MARKET', totalStages: 2, timeLimit: 300,
      briefing: 'Kira: the market crew turned on us. Cut through Little Havana on foot.',
      next: 'REACH THE MARKET BEACON',
      rewardMoney: 7500, rewardRespect: 80,
    },
  ];

  function mission() { return MISSIONS[state.missionIndex] || MISSIONS[0]; }

  function missionLabel() {
    var m = mission();
    return m.id + ' · ' + m.name;
  }

  // Next-objective line for the HUD. Always starts with "NEXT".
  function nextObjective() {
    var m = mission();
    if (state.missionIndex === 0) return 'NEXT: TAKE THE SCARLET ARROW';
    if (state.missionIndex === 1) {
      var gates = ['PIER PLAZA', 'PALM ROW', 'NORTH GATE'];
      var i = Math.min(state.missionStage - 1, gates.length - 1);
      return 'NEXT: GATE ' + state.missionStage + ' — ' + gates[i];
    }
    if (state.missionIndex === 2) {
      return state.missionStage === 1
        ? 'NEXT: CLEAR THE MARKET CREW'
        : 'NEXT: REACH THE MARKET BEACON';
    }
    return 'NEXT: ' + m.next;
  }

  function completeMission() {
    var m = mission();
    state.money += m.rewardMoney;
    state.respect += m.rewardRespect;
    state.missionIndex = Math.min(state.missionIndex + 1, MISSIONS.length - 1);
    state.missionStage = 1;
    state.gatesPassed = 0;
    var nm = mission();
    state.missionTimeLeft = nm.timeLimit;
    saveGame();
    return { paid: m.rewardMoney, respect: m.rewardRespect, next: nm.id };
  }

  // ------------------------------------------------------- crime / wanted
  var WANTED_LABELS = ['CLEAN', 'SUSPECT', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'CITYWIDE'];

  function wantedLabel() { return WANTED_LABELS[state.wanted] || 'CLEAN'; }

  // Armour absorbs damage before health. Returns the health actually lost.
  // 25 dmg vs 60 armour -> armour 35, health untouched, lost 0.
  // 50 more dmg -> armour 0, health -15, lost 15.
  function damagePlayer(amount) {
    var n = Math.max(0, amount);
    var absorbed = Math.min(state.armour, n);
    state.armour -= absorbed;
    var lost = n - absorbed;
    state.health = Math.max(0, state.health - lost);
    return lost;
  }

  function setWantedStars(n) {
    state.wanted = Math.max(0, Math.min(5, n | 0));
    if (state.wanted > 0) state.heatArmed = true;
    return state.wanted;
  }

  function addHeat(n) { return setWantedStars(state.wanted + n); }

  function coolDown() {
    // Wanted decays one star at a time once the player breaks line of sight.
    if (state.wanted > 0) state.wanted -= 1;
    return state.wanted;
  }

  // ----------------------------------------------------------- districts
  // Where am I? Used by the HUD location label and the minimap title.
  function locationName(x, z) {
    if (x >= 200) return { area: 'Ocean Pier', district: 'Pier District' };
    if (x <= -100 && z >= 20) return { area: 'Little Havana Market', district: 'Little Havana' };
    if (x <= -100) return { area: 'Little Havana', district: 'Little Havana' };
    if (z >= 20 && z < 150) return { area: 'Marina Park', district: 'Sunset Bay' };
    if (Math.abs(z) <= 14) return { area: 'Ocean Drive', district: 'Sunset Bay' };
    if (z < -14) return { area: 'North Grid', district: 'Sunset Bay' };
    return { area: 'Sunset Bay', district: 'Downtown' };
  }

  // -------------------------------------------------------------- save
  function saveGame() {
    try {
      var s = {
        missionIndex: state.missionIndex,
        money: state.money,
        respect: state.respect,
        health: Math.round(state.health),
        armour: Math.round(state.armour),
        ammo: state.ammo,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      return s;
    } catch (e) { return null; }
  }

  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s.missionIndex !== 'number') return null;
      return s;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function addMoney(n) { state.money += n; return state.money; }

  function addRespect(n) { state.respect = Math.max(0, state.respect + n); return state.respect; }

  // Fresh run: back to the opening wallet, M1 and a clean wanted slate.
  // The save file is left alone — Slot 1 keeps showing the last progress
  // until a mission completes and overwrites it.
  function resetRun() {
    state.missionIndex = 0;
    state.missionStage = 1;
    state.missionTimeLeft = MISSIONS[0].timeLimit;
    state.wanted = 0;
    state.heatArmed = false;
    state.money = 12800;
    state.health = 100;
    state.armour = 50;
    state.respect = 100;
    state.ammo = 48;
    state.gatesPassed = 0;
    state.inCar = false;
    state.currentCar = null;
    return state;
  }

  function fmtClock(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  // ------------------------------------------------------------ export
  window.PH = window.PH || {};
  window.PH.state = state;
  window.PH.MISSIONS = MISSIONS;
  window.PH.mission = mission;
  window.PH.missionLabel = missionLabel;
  window.PH.nextObjective = nextObjective;
  window.PH.completeMission = completeMission;
  window.PH.damagePlayer = damagePlayer;
  window.PH.setWantedStars = setWantedStars;
  window.PH.addHeat = addHeat;
  window.PH.coolDown = coolDown;
  window.PH.wantedLabel = wantedLabel;
  window.PH.locationName = locationName;
  window.PH.saveGame = saveGame;
  window.PH.loadSave = loadSave;
  window.PH.clearSave = clearSave;
  window.PH.fmtMoney = fmtMoney;
  window.PH.fmtClock = fmtClock;
  window.PH.addMoney = addMoney;
  window.PH.addRespect = addRespect;
  window.PH.resetRun = resetRun;
})();
