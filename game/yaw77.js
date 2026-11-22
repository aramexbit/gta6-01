/* PIER HEAT v7.7 — hero-car yaw correction.
 *
 * Diagnosis (measured live, v7.6): the Scarlet Arrow model is built with its
 * nose pointing down local +X (headlights at +X, spoiler / tail lights at
 * -X, body 4.55 m long on X), but the game steers it as if forward were
 * +Z at heading 0: the car travels along (sin h, 0, cos h) while the mesh
 * points along (cos h, 0, -sin h). The two directions are a constant 90
 * degrees apart at every speed, so the car crabs sideways even when it
 * drives perfectly straight. A constant offset (not a steering slip term)
 * means a fixed axis error, and the fix is a fixed -90 degree correction.
 *
 * This module loads BEFORE three.min.js. It traps the THREE assignment,
 * wraps the renderer constructor, and around every real render it rotates
 * the hero group by -PI/2 and restores the game's heading immediately
 * after, so game logic (camera, minimap, physics) always sees the raw
 * heading while every presented frame shows the body lined up with the
 * direction of travel. The correction is a constant axis fix, so it
 * applies on every render — moving or parked — which also keeps a parked
 * car facing along its heading instead of sitting across the road
 * (rev3: the moved-only gate left the spawn-parked car diagonal, and the
 * on-foot frame's parked car needs the same treatment).
 * The hero group is discovered at runtime from the scene graph (no names
 * are used anywhere): a top-level group with a long X body and four
 * multi-part wheel groups. Diagnostics live on window.__YAW77.
 */
(function () {
  'use strict';
  var PI2 = Math.PI / 2;
  var diag = {
    version: '7.7', heroFound: false, renders: 0, corrected: 0,
    headingDeg: null, velHeadingDeg: null, errorDeg: null,
    samples: 0, lastFixDeg: -90, parked: true, stillFrames: 0
  };
  window.__YAW77 = diag;
  window.__PH77 = window.__PH77 || {};

  function wrapAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /* --- renderer capture: wrap the constructor as soon as THREE appears. --- */
  function wrapRendererCtor(Orig) {
    if (!Orig || Orig.__ph77w) return Orig;
    function Wrapped() {
      var inst = new Orig(...arguments);
      var origRender = inst.render.bind(inst);
      inst.render = function (scene, camera) {
        window.__PH77.scene = scene;
        window.__PH77.camera = camera;
        window.__PH77.renderer = inst;
        var rest = Array.prototype.slice.call(arguments, 2);
        var hero = findHero(scene);
        var h = null, moved = false;
        if (hero) {
          window.__PH77.hero = hero;
          h = hero.rotation.y;
          moved = heroMoved(hero);
          diag.stillFrames = moved ? 0 : diag.stillFrames + 1;
          diag.parked = diag.stillFrames >= 3;
          // Constant -90 deg correction on every presented frame: the
          // offset is an axis error, not a motion effect, so a parked car
          // must face along its heading too (else it sits across the road).
          hero.rotation.y = h - PI2;
          diag.corrected++;
          if (moved) measure(hero, h);
        }
        diag.renders++;
        var out;
        try {
          out = origRender.apply(inst, [scene, camera].concat(rest));
        } finally {
          if (hero && h !== null) hero.rotation.y = h;
        }
        return out;
      };
      return inst;
    }
    Wrapped.prototype = Orig.prototype;
    Wrapped.__ph77w = true;
    return Wrapped;
  }

  function trapThree(T) {
    if (!T || typeof T !== 'object') return;
    var wr;
    try {
      Object.defineProperty(T, 'WebGLRenderer', {
        configurable: true, enumerable: true,
        get: function () { return wr; },
        set: function (orig) { wr = wrapRendererCtor(orig); }
      });
    } catch (e) { /* namespace not trappable; fall through silently */ }
    if (T.WebGLRenderer && !T.WebGLRenderer.__ph77w) {
      try { T.WebGLRenderer = wrapRendererCtor(T.WebGLRenderer); } catch (e) {}
    }
  }

  /* --- hero discovery: long X body + four multi-part wheel groups. --- */
  var heroCache = null, heroCacheChecked = 0;
  function isHeroGroup(g) {
    if (!g || g.type !== 'Group' || !g.children || g.children.length < 40) return false;
    var longBody = false, wheels = 0;
    for (var i = 0; i < g.children.length; i++) {
      var c = g.children[i];
      if (c.type === 'Group' && c.children && c.children.length >= 10) wheels++;
      if (c.isMesh && c.geometry) {
        try {
          c.geometry.computeBoundingBox();
          var b = c.geometry.boundingBox;
          var sx = b.max.x - b.min.x, sz = b.max.z - b.min.z;
          if (sx >= 4 && sx > sz * 1.8) longBody = true;
        } catch (e) {}
      }
    }
    return longBody && wheels >= 4;
  }
  function findHero(scene) {
    if (!scene) return null;
    if (heroCache && heroCache.parent === scene) {
      if (++heroCacheChecked < 120) return heroCache;
      heroCacheChecked = 0;
      if (isHeroGroup(heroCache)) return heroCache;
      heroCache = null;
    }
    var found = null;
    var kids = scene.children || [];
    for (var i = 0; i < kids.length; i++) {
      if (isHeroGroup(kids[i])) { found = kids[i]; break; }
    }
    heroCache = found;
    diag.heroFound = !!found;
    return found;
  }

  /* --- movement + error measurement (diagnostics only). --- */
  var prevPos = null, prevH = null;
  function heroMoved(hero) {
    var p = hero.position;
    if (!prevPos) { prevPos = { x: p.x, z: p.z }; return false; }
    var dx = p.x - prevPos.x, dz = p.z - prevPos.z;
    var moved = (dx * dx + dz * dz) > 0.000001;
    prevPos = { x: p.x, z: p.z };
    return moved;
  }
  function measure(hero, h) {
    // Velocity heading from the last two rendered positions, body heading
    // from the corrected mesh orientation, both in the game's heading
    // convention: heading = atan2(x, z). After the -90 deg fix the body
    // forward (local +X through rotY = h - PI/2) is (sin h, cos h), which
    // is exactly the direction of travel, so the error should read ~0.
    if (!prevH) { prevH = { x: hero.position.x, z: hero.position.z }; return; }
    var dx = hero.position.x - prevH.x, dz = hero.position.z - prevH.z;
    prevH = { x: hero.position.x, z: hero.position.z };
    if (dx * dx + dz * dz < 0.000001) return;
    var velH = Math.atan2(dx, dz);
    var fxw = Math.cos(h - PI2), fzw = -Math.sin(h - PI2);
    var bodyH = Math.atan2(fxw, fzw);
    var err = wrapAngle(bodyH - velH) * 180 / Math.PI;
    diag.headingDeg = +(h * 180 / Math.PI).toFixed(2);
    diag.velHeadingDeg = +(velH * 180 / Math.PI).toFixed(2);
    diag.errorDeg = +err.toFixed(2);
    diag.samples++;
  }

  /* --- install the trap as early as possible. --- */
  var threeVal;
  try {
    if (window.THREE) { threeVal = window.THREE; trapThree(threeVal); }
    Object.defineProperty(window, 'THREE', {
      configurable: true, enumerable: true,
      get: function () { return threeVal; },
      set: function (v) { threeVal = v; trapThree(v); }
    });
  } catch (e) { /* very old host: leave the game alone */ }
})();
