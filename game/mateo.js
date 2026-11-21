// PIER HEAT — Sunset Bay v7.3
// mateo.js — procedural hero characters, built from code primitives.
// No model file: Mateo Vega and Kira are assembled here from boxes,
// capsules and spheres, with a low-poly face (eyes, brows, mouth), a
// burnt-orange bomber jacket, a white tee, dark jeans and sneakers.
// Plain script; uses window.PH. Faces +Z, so forwardOffset is 0.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  function std(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0
    });
  }

  // Jacket torso: a puffed bomber shell (capsule) over a white tee panel,
  // with a dark zipper strip, ribbed waistband and collar. The tee shows
  // as a white chest panel so the two layers read at screenshot distance.
  function bomberTorso(jacket, tee) {
    var g = new THREE.Group();
    var shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 4, 10), std(jacket, 0.8));
    shell.position.y = 1.18; shell.castShadow = true;
    shell.userData.part = 'jacket'; // retint target (see core.js)
    g.add(shell);
    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.52, 0.1), std(tee, 0.9));
    chest.position.set(0, 1.22, 0.3);
    chest.userData.part = 'tee';
    g.add(chest);
    var zip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.03), std(0x2a2a2a, 0.5, 0.4));
    zip.position.set(0, 1.2, 0.36); g.add(zip);
    var waist = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.12, 12), std(0x222222, 0.9));
    waist.position.y = 0.88; g.add(waist);
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 12), std(jacket, 0.85));
    collar.position.y = 1.56; collar.rotation.x = Math.PI / 2; g.add(collar);
    // shoulder patches + chest pocket, so the jacket is not a flat blob
    [-0.2, 0.2].forEach(function (x) {
      var patch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.2), std(0x7a3400, 0.9));
      patch.position.set(x, 1.52, 0.1); g.add(patch);
    });
    var pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.04), std(jacket, 0.85));
    pocket.position.set(-0.18, 1.28, 0.36); g.add(pocket);
    return g;
  }

  // Head: skin sphere, hair cap, two dark eyes, brows, mouth line and a
  // nose bump. Everything sits on the front (+Z) so the face reads from
  // the camera side in shots 2 and 3.
  function facedHead(skin, hairColor, opts) {
    var g = new THREE.Group();
    g.position.y = 1.74;
    var skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), std(skin, 0.75));
    skull.castShadow = true; g.add(skull);
    var hairMat = std(hairColor, 0.95);
    // cap ends above the brow line (theta 0.45 PI) so the eyes stay
    // visible — v7.3 rev 1 had it at 0.55 PI and the hair swallowed
    // the eyes in shot 2.
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
    cap.position.y = 0.04;
    cap.userData.part = 'hair'; // retint target (see core.js)
    g.add(cap);
    if (opts.longHair) {
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.12), hairMat);
      back.position.set(0, -0.14, -0.18); g.add(back);
      [-0.16, 0.16].forEach(function (x) {
        var lock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.1), hairMat);
        lock.position.set(x, -0.1, 0.16); g.add(lock);
      });
    } else {
      // short: cap + a thin high fringe that never covers the eyes
      var fringe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.1), hairMat);
      fringe.position.set(0, 0.19, 0.2); g.add(fringe);
    }
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
    [-0.085, 0.085].forEach(function (ex) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
      eye.position.set(ex, 0.0, 0.21); g.add(eye);
      var brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.015), eyeMat);
      brow.position.set(ex, 0.09, 0.215); g.add(brow);
    });
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), std(skin, 0.75));
    nose.position.set(0, -0.05, 0.23); g.add(nose);
    var mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.012), eyeMat);
    mouth.position.set(0, -0.13, 0.215); g.add(mouth);
    if (opts.stubble) {
      var beard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.05), std(0x2a1a12, 1));
      beard.position.set(0, -0.15, 0.19); g.add(beard);
    }
    return g;
  }

  // Full rig. Joints are empty Groups at shoulder / hip / knee so limbs
  // swing from their root. Origin at the soles; total height ~1.85.
  PH.makeMateoCharacter = function (opts) {
    opts = opts || {};
    var jacket = opts.jacket != null ? opts.jacket : 0xff7a1a;
    var tee = opts.tee != null ? opts.tee : 0xf2f2f2;
    var jeans = opts.jeans != null ? opts.jeans : 0x2a3a4a;
    var skin = opts.skin != null ? opts.skin : 0xe0ac69;
    var hair = opts.hair != null ? opts.hair : 0x2a1a12;
    var scale = opts.scale || 1;
    var g = new THREE.Group();

    var legL = new THREE.Group(); legL.position.set(-0.15, 0.88, 0);
    var legR = new THREE.Group(); legR.position.set(0.15, 0.88, 0);
    var legGeo = new THREE.BoxGeometry(0.24, 0.88, 0.26);
    var jeansMat = std(jeans, 0.9);
    var lm = new THREE.Mesh(legGeo, jeansMat); lm.position.y = -0.44; lm.castShadow = true;
    var rm = new THREE.Mesh(legGeo, jeansMat); rm.position.y = -0.44; rm.castShadow = true;
    legL.add(lm); legR.add(rm);
    // knees: a second segment so the lower leg can bend on the run
    var shinGeo = new THREE.BoxGeometry(0.2, 0.42, 0.22);
    var kneeL = new THREE.Group(); kneeL.position.y = -0.44; legL.add(kneeL);
    var kneeR = new THREE.Group(); kneeR.position.y = -0.44; legR.add(kneeR);
    var shinL = new THREE.Mesh(shinGeo, jeansMat); shinL.position.y = -0.21; kneeL.add(shinL);
    var shinR = new THREE.Mesh(shinGeo, jeansMat); shinR.position.y = -0.21; kneeR.add(shinR);
    // sneakers: white sole + dark upper, toe pointing +Z
    [kneeL, kneeR].forEach(function (knee) {
      var shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.42), std(0x1a1a1a, 0.7));
      shoe.position.set(0, -0.46, 0.06); knee.add(shoe);
      var sole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.44), std(0xf2f2f2, 0.6));
      sole.position.set(0, -0.53, 0.06); knee.add(sole);
    });

    var torso = bomberTorso(jacket, tee);
    var headG = facedHead(skin, hair, { stubble: !opts.longHair, longHair: !!opts.longHair });

    var armL = new THREE.Group(); armL.position.set(-0.42, 1.52, 0);
    var armR = new THREE.Group(); armR.position.set(0.42, 1.52, 0);
    var armGeo = new THREE.BoxGeometry(0.18, 0.68, 0.2);
    var jacketMat = std(jacket, 0.8);
    var al = new THREE.Mesh(armGeo, jacketMat); al.position.y = -0.34; al.castShadow = true;
    var ar = new THREE.Mesh(armGeo, jacketMat); ar.position.y = -0.34; ar.castShadow = true;
    armL.add(al); armR.add(ar);
    // skin hands at the sleeve ends
    [armL, armR].forEach(function (arm) {
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(skin, 0.75));
      hand.position.y = -0.72; arm.add(hand);
    });
    // pistol in the right hand, only visible when aiming
    var gun = new THREE.Group();
    var gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), std(0x14181c, 0.4, 0.7));
    gun.add(gunBody);
    var gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), std(0x14181c, 0.5, 0.5));
    gunGrip.position.set(0, -0.12, -0.1); gun.add(gunGrip);
    gun.position.set(0, -0.72, 0.12);
    gun.visible = false;
    armR.add(gun);

    g.add(legL, legR, torso, headG, armL, armR);
    g.scale.setScalar(scale);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var phase = PH.rand(0, 6.28);
    var anim = 'idle';
    var P = {
      group: g, root: g, legL: legL, legR: legR, kneeL: kneeL, kneeR: kneeR,
      armL: armL, armR: armR, head: headG, torso: torso, gun: gun,
      phase: phase, forwardOffset: 0, loaded: true, anim: anim,
      setAnim: function (name) {
        anim = name; P.anim = name;
        gun.visible = (name === 'aim' || name === 'fire');
      },
      update: function (dt) {
        P._t = (P._t || 0) + dt;
        var t = P._t;
        var s = Math.sin(t * 6 + phase);
        legL.rotation.x = 0; legR.rotation.x = 0;
        armL.rotation.x = 0; armR.rotation.x = 0;
        armL.rotation.z = 0.1; armR.rotation.z = -0.1;
        kneeL.rotation.x = 0; kneeR.rotation.x = 0;
        torso.rotation.x = 0; torso.position.y = 0; g.rotation.x = 0;
        headG.rotation.x = 0;
        // NOTE: never touch g.position.y here — the rig stands on the
        // pier deck (y 1.35) in shot 3, and resetting y to 0 sank Mateo
        // under the deck in v7.3 rev 1. The run bob rides the torso.
        if (anim === 'walk') {
          legL.rotation.x = s * 0.55; legR.rotation.x = -s * 0.55;
          kneeL.rotation.x = Math.max(0, -s) * 0.7; kneeR.rotation.x = Math.max(0, s) * 0.7;
          armL.rotation.x = -s * 0.45; armR.rotation.x = s * 0.45;
        } else if (anim === 'run') {
          legL.rotation.x = s * 0.95; legR.rotation.x = -s * 0.95;
          kneeL.rotation.x = Math.max(0, -s) * 1.1; kneeR.rotation.x = Math.max(0, s) * 1.1;
          armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
          torso.rotation.x = 0.16; torso.position.y = Math.abs(Math.cos(t * 6 + phase)) * 0.05;
        } else if (anim === 'aim' || anim === 'fire') {
          armL.rotation.x = -Math.PI / 2 + 0.1; armR.rotation.x = -Math.PI / 2;
          armL.rotation.z = 0.15; armR.rotation.z = -0.15;
          legL.rotation.x = 0.15; legR.rotation.x = -0.2;
          headG.rotation.x = -0.05;
          if (anim === 'fire') torso.rotation.x = -0.06;
        } else {
          // idle: breathing + a slow look-around
          torso.scale.y = 1 + Math.sin(t * 1.6 + phase) * 0.015;
          armL.rotation.x = Math.sin(t * 1.6) * 0.05;
          armR.rotation.x = -Math.sin(t * 1.6) * 0.05;
          headG.rotation.y = Math.sin(t * 0.4 + phase) * 0.22;
        }
      }
    };
    return P;
  };

  // Kira: same rig, teal bomber, dark tee, long hair, slimmer build.
  PH.makeKiraCharacter = function () {
    var kira = PH.makeMateoCharacter({
      jacket: 0x0e7a7a, tee: 0x222831, jeans: 0x1a1a1a,
      skin: 0xf2c89b, hair: 0x2a1a12, longHair: true, scale: 0.96
    });
    return kira;
  };

  // Drop-in replacement for the old GLB loader: builds the procedural
  // character at once and hands back the same API shape main.js expects
  // (root, setAnim, update, forwardOffset, loaded). Tint keys keep the
  // old call sites working: MateoJacket / MateoTee / MateoHair.
  PH.loadMateo = function (scene, tint, onReady) {
    tint = tint || {};
    var isKira = tint.MateoJacket === 0x0e7a7a;
    var api;
    if (isKira) {
      api = PH.makeKiraCharacter();
    } else {
      api = PH.makeMateoCharacter({
        jacket: tint.MateoJacket != null ? tint.MateoJacket : 0xff7a1a,
        tee: tint.MateoTee != null ? tint.MateoTee : 0xf2f2f2,
        hair: tint.MateoHair != null ? tint.MateoHair : 0x2a1a12
      });
    }
    scene.add(api.root);
    if (onReady) onReady(api);
    return api;
  };
})();
