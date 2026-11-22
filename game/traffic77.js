/* PIER HEAT v7.7 — traffic through walls, fixed without touching collision.
 *
 * Some waypoint lanes cut across building footprints, so a traffic car can
 * end up driving through a wall. Rather than rewriting physics, this
 * module watches the scene and relocates any car-like group that finds
 * itself inside a building volume back to the nearest valid road edge.
 *
 * Both inputs are discovered at runtime from the live scene graph:
 *  - building volumes: tall, wide meshes (world height >= 4 m, both plan
 *    dimensions >= 6 m, base near ground level), measured through the
 *    world matrix so rotated or offset meshes get true footprints;
 *  - road edges: sample points along the flat ground-plane road strips
 *    (8-20 m wide), which only ever sit on drivable centrelines.
 * Cars are recognised anywhere in the tree by a car-shaped world bounding
 * box; people, traffic lights and palms fail the shape test, the hero car
 * is excluded by its subtree, and anything on the beach / water side
 * (x < -60) is left alone so boats and the pier are never touched. A sweep
 * runs on an interval and only ever moves a car that is actually inside a
 * building. Counters live on window.__TRAFFIC77.
 */
(function () {
  'use strict';
  var state = { version: '7.7', ready: false, buildings: 0, roadPoints: 0, scanned: 0, moved: 0, lastMove: null };
  window.__TRAFFIC77 = state;

  var buildings = null, roadPoints = null;

  function meshBox(mesh) {
    try {
      mesh.geometry.computeBoundingBox();
      var b = mesh.geometry.boundingBox;
      return {
        sx: b.max.x - b.min.x, sy: b.max.y - b.min.y, sz: b.max.z - b.min.z,
        minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y,
        minZ: b.min.z, maxZ: b.max.z
      };
    } catch (e) { return null; }
  }

  function buildWorldModel(scene) {
    var blds = [], roads = [];
    var THREE = window.THREE;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      var box = meshBox(o);
      if (!box) return;
      // The geometry bbox is LOCAL, so for a rotated or offset mesh the
      // local dims do not describe the world footprint at all (the first
      // cut centred local boxes on the mesh position and its footprints
      // bled across the road, teleporting innocent road cars). Transform
      // all eight local corners through the world matrix and take the
      // world axis-aligned box instead.
      try {
        o.updateWorldMatrix(true, false);
        var xs = [box.minX, box.maxX], ys = [box.minY, box.maxY], zs = [box.minZ, box.maxZ];
        var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (var ix = 0; ix < 2; ix++) for (var iy = 0; iy < 2; iy++) for (var iz = 0; iz < 2; iz++) {
          var c = new THREE.Vector3(xs[ix], ys[iy], zs[iz]).applyMatrix4(o.matrixWorld);
          x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
          y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
          z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z);
        }
        var wX = x1 - x0, wZ = z1 - z0, wY = y1 - y0;
        // Size cap: a real city building is tens of metres across, not
        // hundreds — without it the giant sky dome (a ~960 m sphere whose
        // base sits below ground level) counts as one "building" covering
        // the whole map, and every road car reads as inside it.
        if (wY >= 4 && wY <= 60 && wX >= 6 && wX <= 60 && wZ >= 6 && wZ <= 60 && y0 < 1.5) {
          blds.push({
            x0: x0 + 0.5, x1: x1 - 0.5,
            z0: z0 + 0.5, z1: z1 - 0.5
          });
        }
      } catch (e) {}
    });
    // Roads: flat ground planes. NOTE the geometry bbox is LOCAL, so for a
    // plane rotated flat the local dims do not map to world x/z — transform
    // the corners through the world matrix to get the true footprint.
    // A drivable road is a long strip 8-20 m wide; beach sand and the sea
    // floor are far wider or sit west of x = -60 and are excluded.
    scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return;
      var wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      if (wp.y < 0.02 || wp.y > 0.3) return;
      var box = meshBox(o);
      if (!box) return;
      try {
        o.updateWorldMatrix(true, false);
        var corners = [
          new THREE.Vector3(box.minX, box.minY, 0), new THREE.Vector3(box.maxX, box.minY, 0),
          new THREE.Vector3(box.minX, box.maxY, 0), new THREE.Vector3(box.maxX, box.maxY, 0)
        ];
        var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (var i = 0; i < 4; i++) {
          corners[i].applyMatrix4(o.matrixWorld);
          x0 = Math.min(x0, corners[i].x); x1 = Math.max(x1, corners[i].x);
          z0 = Math.min(z0, corners[i].z); z1 = Math.max(z1, corners[i].z);
        }
        var wX = x1 - x0, wZ = z1 - z0;
        var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        var step = 8;
        if (wZ >= 30 && wX >= 8 && wX <= 20 && cx >= -60) {
          for (var z = z0 + 4; z <= z1 - 4; z += step) roads.push({ x: cx, z: Math.round(z) });
        } else if (wX >= 30 && wZ >= 8 && wZ <= 20 && x1 >= -60) {
          for (var x = Math.max(x0 + 4, -56); x <= x1 - 4; x += step) roads.push({ x: Math.round(x), z: cz });
        }
      } catch (e) {}
    });
    // De-duplicate near-identical road points (keep the set small).
    var seen = {}, uniq = [];
    for (var j = 0; j < roads.length; j++) {
      var k = Math.round(roads[j].x) + ':' + Math.round(roads[j].z);
      if (!seen[k]) { seen[k] = true; uniq.push(roads[j]); }
    }
    buildings = blds;
    roadPoints = uniq;
    state.buildings = blds.length;
    state.roadPoints = uniq.length;
    state.ready = blds.length > 0 && uniq.length > 0;
  }

  function insideBuilding(x, z) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return true;
    }
    return false;
  }

  function nearestRoad(x, z) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < roadPoints.length; i++) {
      var dx = roadPoints[i].x - x, dz = roadPoints[i].z - z;
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = roadPoints[i]; }
    }
    return best;
  }

  /* Position-first sweep: the cheap test is "is this group's world
   * position inside a building footprint". Only the handful of groups that
   * pass it get the expensive car-shape check (world bounding box), so the
   * sweep stays cheap over a 1600-group scene. The hero car and everything
   * inside it are excluded by the parent-chain test. */
  var heroRef = null;
  function isHeroGroup(g) {
    if (!g || g.type !== 'Group' || !g.children || g.children.length < 40) return false;
    var longBody = false, wheels = 0;
    for (var i = 0; i < g.children.length; i++) {
      var c = g.children[i];
      if (c.type === 'Group' && c.children && c.children.length >= 10) wheels++;
      if (c.isMesh && c.geometry) {
        var box = meshBox(c);
        if (box && box.sx >= 4 && box.sx > box.sz * 1.8) longBody = true;
      }
    }
    return longBody && wheels >= 4;
  }
  function isInHeroSubtree(g) {
    var o = g;
    while (o) {
      if (o === heroRef) return true;
      o = o.parent;
    }
    return false;
  }
  function isCarShaped(g) {
    try {
      var box3 = new window.THREE.Box3().setFromObject(g);
      var sx = box3.max.x - box3.min.x, sy = box3.max.y - box3.min.y, sz = box3.max.z - box3.min.z;
      var horiz = [sx, sz].sort(function (a, b) { return b - a; });
      // Car / van / bus: long and wide, low, base at the ground. A traffic
      // light is 6 m tall, a palm 9 m tall, a person under 1 m long.
      return horiz[0] >= 2.8 && horiz[0] <= 9 && horiz[1] >= 1.4 && horiz[1] <= 3 &&
        sy >= 0.6 && sy <= 3.2 && box3.min.y < 0.5;
    } catch (e) { return false; }
  }

  function sweep() {
    var scene = window.__PH77 && window.__PH77.scene;
    if (!scene) return;
    try {
      if (!buildings) buildWorldModel(scene);
      if (!state.ready) return;
      if (!heroRef) {
        var kids = scene.children || [];
        for (var h = 0; h < kids.length; h++) {
          if (isHeroGroup(kids[h])) { heroRef = kids[h]; break; }
        }
      }
      scene.traverse(function (g) {
        if (!g || g.type !== 'Group' || !g.children) return;
        var n = g.children.length;
        if (n < 6 || n > 40) return;
        if (isInHeroSubtree(g)) return;
        // World position: nested groups carry local coordinates.
        var wp = new window.THREE.Vector3();
        g.getWorldPosition(wp);
        if (Math.abs(wp.y) > 0.5 || wp.x < -60) return; // beach / water: leave alone
        if (!insideBuilding(wp.x, wp.z)) return;
        state.scanned++;
        if (!isCarShaped(g)) return;
        var edge = nearestRoad(wp.x, wp.z);
        if (!edge) return;
        var fromX = +wp.x.toFixed(1), fromZ = +wp.z.toFixed(1);
        var target = new window.THREE.Vector3(edge.x, 0, edge.z);
        if (g.parent) g.parent.worldToLocal(target);
        g.position.copy(target);
        state.moved++;
        state.lastMove = { from: [fromX, fromZ], to: [edge.x, edge.z] };
      });
    } catch (e) { /* never break the game over a sweep */ }
  }

  setInterval(function () {
    try { sweep(); } catch (e) {}
  }, 500);
})();
