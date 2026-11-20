// PIER HEAT — Sunset Bay: core state, utilities, witness-rule wanted, save.
// Pure logic, no rendering here. Everything the other modules share lives here.

(function () {
  'use strict';

  var PH = window.PH || (window.PH = {});

  // ------------------------------------------------------------ utilities
  PH.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  PH.lerp = function (a, b, t) { return a + (b - a) * t; };
  PH.rand = function (a, b) { return a + Math.random() * (b - a); };
  PH.randInt = function (a, b) { return Math.floor(PH.rand(a, b + 1)); };
  PH.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PH.dist2d = function (ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  PH.angleLerp = function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  PH.fmtMoney = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  PH.starsText = function (n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  };

  // ------------------------------------------------------------ constants
  PH.CITY = {
    half: 150,            // playable city half-extent (metres)
    streetGap: 40,        // grid spacing
    streets: [-120, -80, -40, 0, 40, 80, 120],
    beachX: 150,          // sand starts here
    seaX: 196,            // water starts here
    witnessRange: 30,     // a crime needs a witness inside this radius
    policeNearRange: 40,  // decay check radius
    decaySeconds: 22,     // quiet seconds before wanted drops one star
  };

  PH.SAVE_KEY = 'pierheat-sunset-bay-save-v1';

  // ------------------------------------------------------------ game state
  PH.state = {
    started: false,
    paused: false,
    over: false,
    money: 12800,   // Mateo is an established getaway driver: the wallet
                     // already holds real job money, and mission rewards
                     // add to it — the HUD number is never faked.
    wanted: 0,
    health: 100,
    armour: 60,     // absorbs damage before health does (see damagePlayer)
    respect: 100,   // street standing; +40 per finished job, ranks the crew
    weapon: 'pistol', // current weapon shown in the wheel
    smgOwned: false,  // locked wheel slots: no SMG / rifle yet
    rifleOwned: false,
    ammo: 48,       // pistol rounds — the wheel reads this live
    emp: 1,
    smoke: 1,
    missionIndex: 0,      // 0..7, 8 = all done (free roam)
    missionStage: 0,      // sub-step inside a mission
    missionTimer: 0,
    missionProgress: 0,
    carHealth: 100,
    speedKmh: 0,
    radio: 0,             // index into RADIO_STATIONS
    radioOn: true,
    inCar: false,
    aiming: false,
    drivingDistance: 0,   // metres driven since mission 2 began
    heatArmed: false,     // mission-2 heat has fired
    quietSeconds: 0,      // seconds with no police near
    kills: 0,
    carsStolen: 0,
    timePlayed: 0,
    completed: false,
  };

  PH.RADIO_STATIONS = [
    { name: 'Nightwave 98.3', desc: 'Running Red — original synth loop' },
    { name: 'Bay FM 91.1', desc: 'Golden Hour — mellow keys' },
    { name: 'Static 104.7', desc: 'Harbour Talk — late-night calls' },
  ];

  // ------------------------------------------------------------ save / load
  PH.saveGame = function () {
    try {
      localStorage.setItem(PH.SAVE_KEY, JSON.stringify({
        money: PH.state.money,
        missionIndex: PH.state.missionIndex,
        kills: PH.state.kills,
        carsStolen: PH.state.carsStolen,
        timePlayed: PH.state.timePlayed,
        respect: PH.state.respect,
        armour: PH.state.armour,
      }));
    } catch (e) { /* storage unavailable: game still plays */ }
  };

  PH.loadSave = function () {
    try {
      var raw = localStorage.getItem(PH.SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  };

  PH.applySave = function (save) {
    if (!save) return;
    PH.state.money = typeof save.money === 'number' ? save.money : PH.state.money;
    PH.state.missionIndex = typeof save.missionIndex === 'number' ? PH.clamp(save.missionIndex, 0, 8) : 0;
    PH.state.kills = save.kills || 0;
    PH.state.carsStolen = save.carsStolen || 0;
    PH.state.timePlayed = save.timePlayed || 0;
    PH.state.respect = typeof save.respect === 'number' ? save.respect : PH.state.respect;
    PH.state.armour = typeof save.armour === 'number' ? PH.clamp(save.armour, 0, 100) : PH.state.armour;
  };

  // ------------------------------------------------------------ witness rule
  // A crime only raises wanted when a witness can see it: a police unit, or a
  // pedestrian who is still walking (not fleeing), within 30 metres.
  // Returns true when the crime was witnessed.
  PH.witnessedCrime = function (kind, x, z) {
    var sim = PH.sim;
    if (!sim) return false;
    var range = PH.CITY.witnessRange;
    var i, d;
    for (i = 0; i < sim.police.length; i++) {
      var p = sim.police[i];
      if (!p || p.dead) continue;
      d = PH.dist2d(x, z, p.x, p.z);
      if (d <= range) return true;
    }
    for (i = 0; i < sim.peds.length; i++) {
      var ped = sim.peds[i];
      if (!ped || ped.dead || ped.fleeing) continue;
      d = PH.dist2d(x, z, ped.x, ped.z);
      if (d <= range) return true;
    }
    return false;
  };

  // Apply a crime. `stars` is how many wanted stars it adds when witnessed.
  // Silent crimes (no witness) change nothing. Returns whether it was seen.
  PH.commitCrime = function (kind, stars, x, z) {
    var seen = PH.witnessedCrime(kind, x, z);
    if (seen) {
      PH.addWanted(stars);
      PH.state.quietSeconds = 0;
    }
    return seen;
  };

  PH.addWanted = function (stars) {
    var before = PH.state.wanted;
    PH.state.wanted = PH.clamp(PH.state.wanted + stars, 0, 5);
    if (PH.state.wanted !== before && PH.onWantedChange) PH.onWantedChange(PH.state.wanted, before);
    return PH.state.wanted;
  };

  PH.setWanted = function (n) {
    var before = PH.state.wanted;
    PH.state.wanted = PH.clamp(n, 0, 5);
    PH.state.quietSeconds = 0;
    if (PH.state.wanted !== before && PH.onWantedChange) PH.onWantedChange(PH.state.wanted, before);
    return PH.state.wanted;
  };

  // Damage routing: armour soaks the hit first, health only takes the rest.
  // Returns how much health was actually lost (0 when armour held it all).
  PH.damagePlayer = function (amount) {
    var st = PH.state;
    var soaked = Math.min(st.armour, amount);
    st.armour = PH.clamp(st.armour - soaked, 0, 100);
    var toHealth = amount - soaked;
    st.health = PH.clamp(st.health - toHealth, 0, 100);
    return toHealth;
  };

  // Street rank from respect points — shown beside the respect bar.
  PH.respectTitle = function (r) {
    if (r >= 500) return 'SHOT CALLER';
    if (r >= 250) return 'FIXER';
    if (r >= 100) return 'DOCK HAND';
    return 'ROOKIE';
  };

  // Where the player is, from real coordinates — the location label reads this.
  PH.locationName = function (x, z) {
    if (x >= 200 && Math.abs(z) < 12) return { area: 'THE PIER', sub: 'Sunset Bay · end of the boardwalk' };
    if (x >= 196) return { area: 'THE SEA', sub: 'Sunset Bay · open water' };
    if (x > 150) return { area: 'OCEAN BEACH', sub: 'Sunset Bay · sand and palms' };
    if (x > 80) return { area: 'OCEAN DRIVE', sub: 'Sunset Bay · pastel deco row' };
    if (z > 60 && x < 40) return { area: 'LITTLE HAVANA', sub: 'Sunset Bay · terracotta corner' };
    if (Math.abs(x) <= 40 && Math.abs(z) <= 40) return { area: 'DOWNTOWN', sub: 'Sunset Bay · glass towers' };
    if (z < -60 && x > 100) return { area: 'THE MARINA', sub: 'Sunset Bay · moored boats' };
    if (z < -60) return { area: 'NORTH BAY', sub: 'Sunset Bay · quiet streets' };
    return { area: 'SUNSET BAY', sub: 'Downtown grid · golden hour' };
  };

  // Distance to the nearest living police unit, or Infinity when none.
  PH.nearestPoliceDist = function (x, z) {
    var sim = PH.sim;
    if (!sim) return Infinity;
    var best = Infinity;
    for (var i = 0; i < sim.police.length; i++) {
      var p = sim.police[i];
      if (!p || p.dead) continue;
      var d = PH.dist2d(x, z, p.x, p.z);
      if (d < best) best = d;
    }
    return best;
  };

  // Wanted decay: called every frame with dt. Only ticks down when no police
  // unit is within 40 m; 22 quiet seconds drops one star.
  PH.updateWantedDecay = function (dt) {
    if (PH.state.wanted <= 0) { PH.state.quietSeconds = 0; return; }
    var sim = PH.sim;
    if (!sim) return;
    var near = PH.nearestPoliceDist(sim.player.x, sim.player.z) <= PH.CITY.policeNearRange;
    if (near) { PH.state.quietSeconds = 0; return; }
    PH.state.quietSeconds += dt;
    if (PH.state.quietSeconds >= PH.CITY.decaySeconds) {
      PH.state.quietSeconds = 0;
      PH.addWanted(-1);
    }
  };

  // ------------------------------------------------------------ events feed
  PH.feed = []; // {t, text} recent event lines for the police panel
  PH.pushFeed = function (text) {
    PH.feed.unshift({ t: PH.state.timePlayed, text: text });
    if (PH.feed.length > 6) PH.feed.length = 6;
  };

  // Dialogue queue for Kira (radio handler).
  PH.dialogue = { name: '', text: '', until: 0 };
  PH.sayKira = function (text, seconds) {
    PH.dialogue = { name: 'KIRA — radio', text: text, until: PH.state.timePlayed + (seconds || 6) };
  };

  window.PH = PH;
})();
