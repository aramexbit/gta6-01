// PIER HEAT — Sunset Bay v8.0: the sea. Deep blue fading to turquoise at the shore, foam
// patches, bobbing buoys, gentle waves. Updates throttled to ~15 Hz.
(function () {
  'use strict';
  var PH = window.PH;

  PH.water = {
    sea: null,
    foam: [],
    buoys: [],
    _last: -1,

    init: function () {
      var scene = PH.scene;
      // sea: two-tone gradient painted on a canvas texture (deep blue -> turquoise at shore)
      var tex = PH.makeCanvas(64, 256, function (g, w, h) {
        var grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0a3a6a');   // deep blue, far out
        grad.addColorStop(0.55, '#0f5f8a');
        grad.addColorStop(0.85, '#1a8a9a');
        grad.addColorStop(1, '#3ac0b8');   // turquoise at the shore
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
      });
      this.sea = new THREE.Mesh(new THREE.PlaneGeometry(480, 300),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.35 }));
      this.sea.rotation.x = -Math.PI / 2;
      this.sea.position.set(0, 0.05, 275); // covers z 125..425
      this.sea.receiveShadow = true;
      scene.add(this.sea);
      // foam patches along the shoreline, plus a few around the pier legs
      for (var i = 0; i < 18; i++) {
        var f = new THREE.Mesh(new THREE.CircleGeometry(PH.rand(1.5, 4), 10),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: PH.rand(0.2, 0.45), depthWrite: false }));
        f.rotation.x = -Math.PI / 2;
        if (i < 14) f.position.set(PH.rand(-200, 200), 0.09, 126 + PH.rand(0, 6));
        else f.position.set(PH.rand(-8, 8), 0.09, 108 + (i - 14) * 14);
        scene.add(f);
        this.foam.push(f);
      }
      // buoys: orange cones on dark bases, bobbing
      var buoySpots = [[-40, 150], [30, 175], [90, 160], [-90, 190], [140, 200], [-150, 145], [60, 230], [-20, 240]];
      for (i = 0; i < buoySpots.length; i++) {
        var b = new THREE.Group();
        var base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.5, 8), PH.stdMat(0x333333, 0.8, 0.2));
        base.position.y = 0.25; b.add(base);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8),
          new THREE.MeshStandardMaterial({ color: 0xff6b1a, emissive: 0x803000, emissiveIntensity: 0.4 }));
        cone.position.y = 1.1; b.add(cone);
        var tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }));
        tip.position.y = 1.8; b.add(tip);
        b.position.set(buoySpots[i][0], 0.05, buoySpots[i][1]);
        scene.add(b);
        this.buoys.push(b);
      }
    },

    update: function (now, dt) {
      if (now - this._last < 0.066) return; // ~15 Hz
      this._last = now;
      var i;
      // gentle wave: the whole sea breathes a few centimetres
      if (this.sea) this.sea.position.y = 0.05 + Math.sin(now * 0.8) * 0.06;
      for (i = 0; i < this.foam.length; i++) {
        this.foam[i].material.opacity = 0.22 + Math.sin(now * 1.1 + i * 1.3) * 0.16;
        this.foam[i].position.z = 126 + (i % 4) + Math.sin(now * 0.6 + i) * 0.8;
      }
      for (i = 0; i < this.buoys.length; i++) {
        this.buoys[i].position.y = 0.05 + Math.sin(now * 1.4 + i * 0.9) * 0.18;
        this.buoys[i].rotation.z = Math.sin(now * 1.1 + i) * 0.08;
        this.buoys[i].rotation.x = Math.cos(now * 0.9 + i) * 0.06;
      }
    }
  };
})();
