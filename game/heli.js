// PIER HEAT — Sunset Bay v8.0: the police helicopter. Rounded body, big curved cockpit glass,
// long thin tail boom tapering to a tall tail fin, small tail rotor, main rotor as a blurred disc
// that tilts into motion, thin tube skids, white POLICE lettering on a thick blue stripe, sensor
// turret under the nose, spotlight cone. Pose updates throttled to ~20 Hz.
(function () {
  'use strict';
  var PH = window.PH;

  PH.heli = {
    mesh: null,
    rotor: null,
    tailRotor: null,
    spot: null,
    active: false,
    _last: -1,
    _phase: 0,

    init: function () {
      var group = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.4 });
      var blueMat = new THREE.MeshStandardMaterial({ color: 0x1a4fd8, roughness: 0.4, metalness: 0.3 });
      var darkMat = PH.stdMat(0x181818, 0.7, 0.3);
      // rounded body
      var body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), bodyMat);
      body.scale.set(1, 0.85, 1.5); body.castShadow = true; group.add(body);
      // thick blue stripe with white POLICE lettering
      var stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.6, 16), blueMat);
      stripe.rotation.x = Math.PI / 2; stripe.scale.set(1, 1, 0.9); stripe.position.y = -0.1; group.add(stripe);
      var lettering = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.55),
        new THREE.MeshBasicMaterial({ map: PH.labelTexture('POLICE', { bg: '#1a4fd8', fg: '#ffffff', size: 64, w: 512, h: 96 }) }));
      lettering.position.set(0, -0.1, 1.62); lettering.rotation.x = -0.12; group.add(lettering);
      var lettering2 = lettering.clone(); lettering2.position.z = -1.62; lettering2.rotation.y = Math.PI; group.add(lettering2);
      // big curved cockpit glass
      var glass = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x10202e, roughness: 0.08, metalness: 0.9 }));
      glass.scale.set(1, 0.8, 1.1); glass.position.set(0, 0.15, 0.7); glass.rotation.x = 0.5; group.add(glass);
      // long thin tail boom tapering to a tall tail fin
      var boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 5.4, 8), bodyMat);
      boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.35, -4.2); group.add(boom);
      var fin = new THREE.Mesh(PH.boxGeo(0.14, 1.7, 1.0), blueMat);
      fin.position.set(0, 1.1, -6.6); fin.rotation.x = 0.15; group.add(fin);
      // small tail rotor
      var tailRotor = new THREE.Group();
      var trBlade = new THREE.Mesh(PH.boxGeo(0.06, 1.3, 0.1), darkMat);
      tailRotor.add(trBlade);
      var trBlade2 = trBlade.clone(); trBlade2.rotation.z = Math.PI / 2; tailRotor.add(trBlade2);
      tailRotor.position.set(0.35, 0.6, -6.6);
      group.add(tailRotor);
      this.tailRotor = tailRotor;
      // main rotor: blurred disc that tilts into motion
      var rotor = new THREE.Group();
      var disc = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24),
        new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; rotor.add(disc);
      var blade = new THREE.Mesh(PH.boxGeo(0.28, 0.04, 9.0), darkMat);
      rotor.add(blade);
      var blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
      rotor.position.y = 1.9;
      group.add(rotor);
      this.rotor = rotor;
      // thin tube skids
      var skidMat = PH.stdMat(0x333333, 0.5, 0.6);
      var skL = new THREE.Mesh(PH.cylGeo(0.05, 0.05, 3.4, 6), skidMat);
      skL.rotation.x = Math.PI / 2; skL.position.set(-1.0, -1.5, 0.4); group.add(skL);
      var skR = skL.clone(); skR.position.x = 1.0; group.add(skR);
      var strutL = new THREE.Mesh(PH.boxGeo(0.08, 0.7, 0.08), skidMat);
      strutL.position.set(-1.0, -1.15, 1.2); group.add(strutL);
      var strutL2 = strutL.clone(); strutL2.position.z = -0.4; group.add(strutL2);
      var strutR = strutL.clone(); strutR.position.x = 1.0; group.add(strutR);
      var strutR2 = strutL2.clone(); strutR2.position.x = 1.0; group.add(strutR2);
      // sensor turret under the nose
      var turret = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), darkMat);
      turret.position.set(0, -1.2, 1.5); group.add(turret);
      var lens = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x40c040, emissiveIntensity: 1.2 }));
      lens.position.set(0, -1.2, 1.82); group.add(lens);
      // spotlight cone: short, narrow, very faint — a searchlight, not a pillar.
      // FrontSide only: viewed end-on (camera under the heli) the cone shows no
      // stacked translucent faces, so it can never read as a bright light pillar.
      var spot = new THREE.Mesh(new THREE.ConeGeometry(1.8, 14, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.02, side: THREE.FrontSide, depthWrite: false }));
      // ConeGeometry apex is at +y: centre at -7 puts the apex at the heli and the wide
      // opening 14 units below, straight down at the street.
      spot.position.set(0, -7, 1.5);
      group.add(spot);
      this.spot = spot;
      group.visible = false;
      PH.scene.add(group);
      this.mesh = group;
    },

    update: function (now, dt, player, wanted) {
      if (now - this._last < 0.05) return; // ~20 Hz pose updates
      this._last = now;
      var shouldBe = wanted >= 2;
      if (shouldBe !== this.active) {
        this.active = shouldBe;
        this.mesh.visible = shouldBe;
      }
      if (!this.active) return;
      this._phase += dt * 5;
      // hover above and slightly behind the player, circling slowly
      var a = now * 0.11;
      var tx = player.x + Math.cos(a) * 16;
      var tz = player.z + Math.sin(a) * 16;
      var ty = 26 + Math.sin(now * 0.7) * 1.5;
      this.mesh.position.x = PH.lerp(this.mesh.position.x, tx, 0.06);
      this.mesh.position.z = PH.lerp(this.mesh.position.z, tz, 0.06);
      this.mesh.position.y = PH.lerp(this.mesh.position.y, ty, 0.08);
      // face the player, tilt into motion
      var want = Math.atan2(player.x - this.mesh.position.x, player.z - this.mesh.position.z);
      this.mesh.rotation.y = PH.angleLerp(this.mesh.rotation.y, want, 0.08);
      this.mesh.rotation.z = PH.clamp(PH.angleWrap(want - this.mesh.rotation.y) * 0.3, -0.2, 0.2);
      // rotors spin; the disc tilts with the body
      this.rotor.rotation.y += dt * 22;
      this.tailRotor.rotation.x += dt * 30;
      this.rotor.rotation.x = this.mesh.rotation.z * 0.5;
      // spotlight cone aims at the player: the heli hovers above the player, so the
      // cone stays vertical and only sways a little with the hover.
      var dx = player.x - this.mesh.position.x, dz = player.z - this.mesh.position.z;
      this.spot.rotation.x = PH.clamp(dz * 0.01, -0.2, 0.2);
      this.spot.rotation.z = PH.clamp(-dx * 0.01, -0.2, 0.2);
      this.spot.material.opacity = 0.015 + Math.sin(now * 2.2) * 0.005;
    }
  };
})();
