// PIER HEAT — Sunset Bay v8.0: wet-road mirror streaks. The low golden sun smears vertically
// on the damp asphalt: strong at low grazing camera angles, fading as the camera looks down,
// smeared vertically, and never brighter than the light source itself. Throttled to ~20 Hz.
(function () {
  'use strict';
  var PH = window.PH;

  PH.wetroad = {
    streaks: [],
    _last: -1,

    init: function () {
      var scene = PH.scene;
      // one streak plane per road segment, laid just above the asphalt
      var roads = PH.world.roadRects || [];
      for (var i = 0; i < roads.length; i++) {
        var r = roads[i];
        var w = r.x1 - r.x0, d = r.z1 - r.z0;
        var alongX = w >= d;
        var len = Math.max(w, d);
        var tex = PH.makeCanvas(64, 256, function (g, cw, ch) {
          var grad = g.createLinearGradient(0, 0, 0, ch);
          grad.addColorStop(0, 'rgba(255,190,110,0)');
          grad.addColorStop(0.5, 'rgba(255,190,110,0.85)');
          grad.addColorStop(1, 'rgba(255,190,110,0)');
          g.fillStyle = grad; g.fillRect(0, 0, cw, ch);
        });
        var m = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 2.4 : len, alongX ? len : 2.4),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        if (!alongX) m.rotation.z = Math.PI / 2;
        m.position.set((r.x0 + r.x1) / 2, 0.06, (r.z0 + r.z1) / 2);
        scene.add(m);
        this.streaks.push(m);
      }
    },

    update: function (now, camera) {
      if (now - this._last < 0.05) return; // ~20 Hz
      this._last = now;
      // grazing angle: how low the camera looks across the road. Low camera = strong streaks.
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var grazing = PH.clamp(1 - Math.abs(dir.y), 0, 1); // 1 = looking horizontally
      var strength = Math.pow(grazing, 2.2) * 0.32; // capped: never brighter than the sun
      // only streaks near the camera get any opacity at all
      var cp = camera.position;
      for (var i = 0; i < this.streaks.length; i++) {
        var s = this.streaks[i];
        var d = PH.dist2d(s.position.x, s.position.z, cp.x, cp.z);
        var near = PH.clamp(1 - d / 90, 0, 1);
        s.material.opacity = strength * near;
        s.visible = s.material.opacity > 0.01;
      }
    }
  };
})();
