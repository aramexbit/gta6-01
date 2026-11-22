// PIER HEAT — Sunset Bay v8.0: golden-hour sky. Low sun disc with glare and haze, stacked
// sunset clouds (lit orange underneath, dark on top, gold rims), long shadows, sunbeams through
// the gaps. Updates throttled to ~20 Hz — clouds drift, they do not need a frame.
(function () {
  'use strict';
  var PH = window.PH;

  PH.sky = {
    clouds: [],
    beams: [],
    sunDisc: null,
    glare: null,
    _last: -1,

    init: function () {
      var scene = PH.scene;
      // low sun disc
      var sunPos = PH.sunPos(380);
      var disc = new THREE.Mesh(new THREE.CircleGeometry(16, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
      disc.position.copy(sunPos);
      disc.lookAt(0, 0, 0);
      scene.add(disc);
      this.sunDisc = disc;
      // glare halo
      var glare = new THREE.Mesh(new THREE.CircleGeometry(46, 32),
        new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.28, fog: false }));
      glare.position.copy(sunPos).multiplyScalar(0.985);
      glare.lookAt(0, 0, 0);
      scene.add(glare);
      this.glare = glare;
      // stacked sunset clouds: dark tops, orange-lit undersides, gold rims
      var cloudDefs = [
        { x: -180, y: 95, z: -120, s: 1.6 }, { x: -60, y: 110, z: -180, s: 2.2 },
        { x: 60, y: 88, z: -150, s: 1.4 }, { x: 170, y: 105, z: -90, s: 1.9 },
        { x: -140, y: 120, z: 60, s: 1.5 }, { x: 40, y: 118, z: 140, s: 1.8 },
        { x: 190, y: 92, z: 120, s: 1.3 }, { x: -220, y: 100, z: 40, s: 1.7 },
        { x: 0, y: 130, z: -220, s: 2.4 }, { x: -90, y: 85, z: 180, s: 1.2 },
        { x: 120, y: 125, z: -40, s: 1.6 }, { x: -30, y: 98, z: 200, s: 1.4 }
      ];
      var topMat = new THREE.MeshStandardMaterial({ color: 0x5a4a6a, roughness: 1, transparent: true, opacity: 0.92 });
      var botMat = new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 1, transparent: true, opacity: 0.92, emissive: 0xcc5a10, emissiveIntensity: 0.55 });
      var rimMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.5 });
      for (var i = 0; i < cloudDefs.length; i++) {
        var d = cloudDefs[i];
        var cloud = new THREE.Group();
        var puffs = 3 + (i % 3);
        for (var p = 0; p < puffs; p++) {
          var px = (p - puffs / 2) * 14 * d.s * 0.6;
          var top = new THREE.Mesh(new THREE.SphereGeometry(9 * d.s, 10, 8), topMat);
          top.scale.y = 0.42; top.position.set(px, 3 * d.s, (p % 2) * 4 - 2); cloud.add(top);
          var bot = new THREE.Mesh(new THREE.SphereGeometry(8.4 * d.s, 10, 8), botMat);
          bot.scale.y = 0.3; bot.position.set(px, 0.5 * d.s, (p % 2) * 4 - 2); cloud.add(bot);
          var rim = new THREE.Mesh(new THREE.TorusGeometry(8.6 * d.s, 0.5 * d.s, 6, 18), rimMat);
          rim.position.set(px, 2.2 * d.s, (p % 2) * 4 - 2); rim.rotation.x = Math.PI / 2; rim.scale.y = 1; cloud.add(rim);
        }
        cloud.position.set(d.x, d.y, d.z);
        cloud.userData.drift = 0.4 + (i % 4) * 0.15;
        scene.add(cloud);
        this.clouds.push(cloud);
      }
      // sunbeams: translucent planes angled down from the sun through the gaps
      var beamMat = new THREE.MeshBasicMaterial({
        color: 0xffd27a, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false
      });
      for (var b = 0; b < 4; b++) {
        var beam = new THREE.Mesh(new THREE.PlaneGeometry(10, 130), beamMat);
        beam.position.set(-120 + b * 55, 45, -40 + b * 30);
        beam.rotation.set(0.5, 0.4, 0.35);
        scene.add(beam);
        this.beams.push(beam);
      }
    },

    update: function (now, dt) {
      if (now - this._last < 0.05) return; // ~20 Hz
      this._last = now;
      var i, c;
      for (i = 0; i < this.clouds.length; i++) {
        c = this.clouds[i];
        c.position.x += c.userData.drift * 0.05;
        c.position.y += Math.sin(now * 0.25 + i * 1.3) * 0.008; // slow vertical breathing
        if (c.position.x > 260) c.position.x = -260;
      }
      // sunbeams breathe slowly
      for (i = 0; i < this.beams.length; i++) {
        this.beams[i].material.opacity = 0.08 + Math.sin(now * 0.4 + i * 1.7) * 0.035;
      }
      // glare pulses gently
      if (this.glare) this.glare.material.opacity = 0.24 + Math.sin(now * 0.3) * 0.05;
    }
  };
})();
