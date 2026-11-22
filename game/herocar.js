// PIER HEAT — Sunset Bay v8.0: the hero car. "Scarlet Arrow", plate SUN-8821: orange glossy
// fastback that reflects the sky, round LED-ring tail lights, black mesh rear deck, small
// integrated spoiler, stalk mirrors, dark multi-spoke wheels, side intake behind the door,
// dark mesh bumper. Forward is +Z; the body lives in a permanent visual pivot group.
(function () {
  'use strict';
  var PH = window.PH;

  PH.buildHeroCar = function () {
    var group = new THREE.Group();
    var vis = new THREE.Group(); // permanent visual pivot: body built to face +Z
    group.add(vis);

    var paint = new THREE.MeshStandardMaterial({
      color: 0xe8541a, roughness: 0.22, metalness: 0.65,
      emissive: 0x301006, emissiveIntensity: 0.25
    });
    var paintDark = new THREE.MeshStandardMaterial({ color: 0xb83a08, roughness: 0.3, metalness: 0.6 });
    var glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.08, metalness: 0.9 });
    var meshDark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.5 });
    var chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.15, metalness: 1 });

    // main body: long low slab, nose slightly lower than the tail
    var body = new THREE.Mesh(PH.boxGeo(1.92, 0.55, 4.6), paint);
    body.position.set(0, 0.62, 0); body.castShadow = true; vis.add(body);
    // nose taper
    var nose = new THREE.Mesh(PH.boxGeo(1.8, 0.4, 0.7), paintDark);
    nose.position.set(0, 0.55, 2.35); vis.add(nose);
    // fastback roof: curves down into the rear (sloped panel + rear glass)
    var roof = new THREE.Mesh(PH.boxGeo(1.6, 0.14, 2.3), paint);
    roof.position.set(0, 1.28, -0.55); roof.rotation.x = 0.22; roof.castShadow = true; vis.add(roof);
    var rearGlass = new THREE.Mesh(PH.boxGeo(1.5, 0.1, 1.5), glass);
    rearGlass.position.set(0, 1.14, -1.15); rearGlass.rotation.x = 0.38; vis.add(rearGlass);
    var windshield = new THREE.Mesh(PH.boxGeo(1.55, 0.1, 0.9), glass);
    windshield.position.set(0, 1.12, 0.62); windshield.rotation.x = -0.5; vis.add(windshield);
    // cabin sides
    var cabinL = new THREE.Mesh(PH.boxGeo(0.12, 0.5, 1.9), glass);
    cabinL.position.set(-0.82, 1.05, -0.3); vis.add(cabinL);
    var cabinR = cabinL.clone(); cabinR.position.x = 0.82; vis.add(cabinR);
    // black mesh rear deck between the tail lights
    var deck = new THREE.Mesh(PH.boxGeo(1.7, 0.1, 0.55), meshDark);
    deck.position.set(0, 0.92, -2.18); vis.add(deck);
    // small integrated spoiler on the tail edge
    var spoiler = new THREE.Mesh(PH.boxGeo(1.7, 0.07, 0.34), paintDark);
    spoiler.position.set(0, 1.0, -2.32); vis.add(spoiler);
    var spoilerL = new THREE.Mesh(PH.boxGeo(0.08, 0.16, 0.3), paintDark);
    spoilerL.position.set(-0.78, 0.92, -2.32); vis.add(spoilerL);
    var spoilerR = spoilerL.clone(); spoilerR.position.x = 0.78; vis.add(spoilerR);
    // round LED-ring tail lights
    var ringMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a1a, emissiveIntensity: 1.8 });
    var ringGeo = new THREE.TorusGeometry(0.17, 0.045, 8, 20);
    var tlL = new THREE.Mesh(ringGeo, ringMat);
    tlL.position.set(-0.62, 0.72, -2.32); vis.add(tlL);
    var tlR = tlL.clone(); tlR.position.x = 0.62; vis.add(tlR);
    var tlC = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), ringMat);
    tlC.position.set(-0.62, 0.72, -2.33); tlC.rotation.y = Math.PI; vis.add(tlC);
    var tlC2 = tlC.clone(); tlC2.position.x = 0.62; vis.add(tlC2);
    // headlights: slim LED bars
    var hlMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 1.5 });
    var hlL = new THREE.Mesh(PH.boxGeo(0.55, 0.1, 0.06), hlMat);
    hlL.position.set(-0.58, 0.68, 2.68); vis.add(hlL);
    var hlR = hlL.clone(); hlR.position.x = 0.58; vis.add(hlR);
    // dark mesh front bumper + grille
    var grille = new THREE.Mesh(PH.boxGeo(1.5, 0.3, 0.1), meshDark);
    grille.position.set(0, 0.5, 2.66); vis.add(grille);
    var bumper = new THREE.Mesh(PH.boxGeo(1.94, 0.22, 0.24), meshDark);
    bumper.position.set(0, 0.34, 2.62); vis.add(bumper);
    // rear valance + thin chrome strip across the tail (grounds the flat rear face)
    var valance = new THREE.Mesh(PH.boxGeo(1.94, 0.2, 0.22), meshDark);
    valance.position.set(0, 0.3, -2.6); vis.add(valance);
    var tailStrip = new THREE.Mesh(PH.boxGeo(1.6, 0.05, 0.04), chrome);
    tailStrip.position.set(0, 0.92, -2.34); vis.add(tailStrip);
    // side intake behind the door
    var intakeL = new THREE.Mesh(PH.boxGeo(0.06, 0.3, 0.7), meshDark);
    intakeL.position.set(-0.97, 0.72, -0.55); vis.add(intakeL);
    var intakeR = intakeL.clone(); intakeR.position.x = 0.97; vis.add(intakeR);
    // mirrors on stalks
    function mirror(side) {
      var stalk = new THREE.Mesh(PH.boxGeo(0.05, 0.05, 0.3), meshDark);
      stalk.position.set(side * 1.02, 1.02, 0.55); vis.add(stalk);
      var mir = new THREE.Mesh(PH.boxGeo(0.14, 0.2, 0.26), paint);
      mir.position.set(side * 1.16, 1.04, 0.55); vis.add(mir);
      var face = new THREE.Mesh(PH.boxGeo(0.02, 0.16, 0.2), chrome);
      face.position.set(side * 1.24, 1.04, 0.55); vis.add(face);
    }
    mirror(-1); mirror(1);
    // door seams + handles
    var seamMat = new THREE.MeshBasicMaterial({ color: 0x7a2405 });
    var seamL = new THREE.Mesh(PH.boxGeo(0.02, 0.5, 0.02), seamMat);
    seamL.position.set(-0.97, 0.75, 0.35); vis.add(seamL);
    var seamR = seamL.clone(); seamR.position.x = 0.97; vis.add(seamR);
    // dark multi-spoke wheels
    var tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
    tireGeo.rotateZ(Math.PI / 2);
    var tireMat = PH.stdMat(0x0e0e0e, 0.9, 0.1);
    var rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.3, metalness: 0.9 });
    var wheels = [];
    var wp = [[-0.88, 1.5], [0.88, 1.5], [-0.88, -1.5], [0.88, -1.5]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(tireGeo, tireMat);
      w.position.set(wp[i][0], 0.38, wp[i][1]);
      w.castShadow = true; vis.add(w); wheels.push(w);
      // 5 spokes
      for (var s = 0; s < 5; s++) {
        var spoke = new THREE.Mesh(PH.boxGeo(0.05, 0.62, 0.32), rimMat);
        spoke.position.copy(w.position);
        spoke.rotation.x = (s / 5) * Math.PI;
        vis.add(spoke);
      }
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 8), chrome);
      hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); vis.add(hub);
    }
    // plate SUN-8821
    var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16),
      new THREE.MeshBasicMaterial({ map: PH.labelTexture('SUN-8821', { bg: '#f0f0e0', fg: '#1a3a6a', size: 62, w: 256, h: 64 }) }));
    plate.position.set(0, 0.52, -2.36); plate.rotation.y = Math.PI; vis.add(plate);
    var plateF = plate.clone();
    plateF.position.set(0, 0.52, 2.72); plateF.rotation.y = 0; vis.add(plateF);

    group.userData.vis = vis;
    group.userData.wheels = wheels;
    group.userData.paint = paint;
    return group;
  };
})();
