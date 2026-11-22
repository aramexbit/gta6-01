// PIER HEAT — Sunset Bay v8.0: Mateo Vega and the crew. Structured low-poly faces (eyes with
// pupils, brows, nose, two-tone lips, jaw, ears, swept tidy hair, thin beard), orange bomber
// with zipper, pockets and a thin gold chain, white tee, dark jeans, shoes. Walk / run / idle
// animation. Variants for Kira (teal, headset), Dario and Lena. Consistent stylisation, never
// photorealism; no close-up face shots.
(function () {
  'use strict';
  var PH = window.PH;

  function faceTextures(skin) {
    var hex = '#' + ('000000' + skin.toString(16)).slice(-6);
    return PH.makeCanvas(128, 128, function (g) {
      g.fillStyle = hex; g.fillRect(0, 0, 128, 128);
      // brows
      g.fillStyle = '#1a1210';
      g.fillRect(28, 42, 22, 5); g.fillRect(78, 42, 22, 5);
      // eyes: white + pupils
      g.fillStyle = '#ffffff';
      g.fillRect(30, 52, 18, 10); g.fillRect(80, 52, 18, 10);
      g.fillStyle = '#241608';
      g.fillRect(36, 53, 7, 8); g.fillRect(86, 53, 7, 8);
      // nose
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(60, 62, 8, 16);
      // two-tone lips
      g.fillStyle = '#a04a3a'; g.fillRect(48, 92, 32, 5);
      g.fillStyle = '#c06a55'; g.fillRect(48, 97, 32, 4);
      // jaw shade
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(30, 104, 68, 12);
    });
  }

  function buildFace(opts) {
    var g = new THREE.Group();
    var skin = opts.skin;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12),
      new THREE.MeshStandardMaterial({ map: faceTextures(skin), roughness: 0.75 }));
    head.scale.set(0.92, 1.05, 0.95);
    g.add(head);
    // jaw
    var jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.26), PH.stdMat(skin, 0.8, 0));
    jaw.position.set(0, -0.16, 0.03); g.add(jaw);
    // ears
    var earGeo = new THREE.BoxGeometry(0.06, 0.12, 0.1);
    var earMat = PH.stdMat(skin, 0.8, 0);
    var eL = new THREE.Mesh(earGeo, earMat); eL.position.set(-0.22, 0, 0); g.add(eL);
    var eR = eL.clone(); eR.position.x = 0.22; g.add(eR);
    // swept tidy hair: a cap that sits proud of the skull, with a side-swept fringe
    var hairMat = PH.stdMat(opts.hair, 0.9, 0);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 0.04; hair.scale.set(0.98, 1.05, 1.0); g.add(hair);
    var fringe = new THREE.Mesh(PH.boxGeo(0.42, 0.09, 0.18), hairMat);
    fringe.position.set(0.03, 0.17, 0.19); fringe.rotation.x = -0.4; fringe.rotation.z = 0.14; g.add(fringe);
    if (opts.beard) {
      var beard = new THREE.Mesh(PH.boxGeo(0.3, 0.06, 0.05), PH.stdMat(0x1a1210, 0.95, 0));
      beard.position.set(0, -0.2, 0.2); g.add(beard);
      var moustache = new THREE.Mesh(PH.boxGeo(0.2, 0.035, 0.04), PH.stdMat(0x1a1210, 0.95, 0));
      moustache.position.set(0, -0.08, 0.22); g.add(moustache);
    }
    if (opts.headset) {
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 14, Math.PI), PH.stdMat(0x222222, 0.6, 0.4));
      band.position.y = 0.04; band.rotation.z = 0; g.add(band);
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), PH.stdMat(0x222222, 0.6, 0.4));
      cup.rotation.z = Math.PI / 2; cup.position.set(-0.24, -0.02, 0); g.add(cup);
      var mic = new THREE.Mesh(PH.boxGeo(0.03, 0.03, 0.2), PH.stdMat(0x222222, 0.6, 0.4));
      mic.position.set(-0.2, -0.14, 0.16); g.add(mic);
    }
    if (opts.longHair) {
      var back = new THREE.Mesh(PH.boxGeo(0.4, 0.5, 0.14), hairMat);
      back.position.set(0, -0.18, -0.16); g.add(back);
    }
    if (opts.cap) {
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12), PH.stdMat(opts.cap, 0.8, 0));
      cap.position.y = 0.2; g.add(cap);
      var brim = new THREE.Mesh(PH.boxGeo(0.4, 0.03, 0.22), PH.stdMat(opts.cap, 0.8, 0));
      brim.position.set(0, 0.16, 0.24); g.add(brim);
    }
    return g;
  }

  // Full character: returns { group, parts:{legL,legR,armL,armR,head,torso} }
  PH.buildCharacter = function (kind) {
    var defs = {
      mateo: { skin: 0xc98a5a, hair: 0x8a6a3a, beard: true, jacket: 0xe8541a, tee: 0xf0f0f0, jeans: 0x2a2f3a, shoes: 0xeeeeee },
      kira: { skin: 0xd8a070, hair: 0x1a1210, headset: true, longHair: true, jacket: 0x1a8a7a, tee: 0x10302e, jeans: 0x2a2a33, shoes: 0x222222 },
      dario: { skin: 0x8a5a3a, hair: 0x1a1210, cap: 0x2a2a2a, jacket: 0x3a3a44, tee: 0x444444, jeans: 0x333a4a, shoes: 0x111111 },
      lena: { skin: 0xe8b88a, hair: 0x6a2a1a, longHair: true, jacket: 0xc0392b, tee: 0xffe9b0, jeans: 0x4a3a5a, shoes: 0xffffff }
    };
    var d = defs[kind] || defs.mateo;
    var group = new THREE.Group();
    // legs: dark jeans with pockets
    var legMat = PH.stdMat(d.jeans, 0.9, 0);
    var legL = new THREE.Mesh(PH.boxGeo(0.2, 0.78, 0.24), legMat);
    legL.position.set(-0.13, 0.39, 0); group.add(legL);
    var legR = legL.clone(); legR.position.x = 0.13; group.add(legR);
    var pocketMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });
    var pkL = new THREE.Mesh(PH.boxGeo(0.12, 0.14, 0.02), pocketMat);
    pkL.position.set(-0.13, 0.68, 0.13); group.add(pkL);
    var pkR = pkL.clone(); pkR.position.x = 0.13; group.add(pkR);
    // shoes
    var shoeMat = PH.stdMat(d.shoes, 0.7, 0.1);
    var shL = new THREE.Mesh(PH.boxGeo(0.22, 0.1, 0.36), shoeMat);
    shL.position.set(-0.13, 0.05, 0.05); group.add(shL);
    var shR = shL.clone(); shR.position.x = 0.13; group.add(shR);
    // torso: tee under an open bomber
    var torso = new THREE.Mesh(PH.boxGeo(0.56, 0.68, 0.32), PH.stdMat(d.tee, 0.85, 0));
    torso.position.y = 1.12; group.add(torso);
    var jacketMat = PH.stdMat(d.jacket, 0.75, 0.05);
    var jakL = new THREE.Mesh(PH.boxGeo(0.2, 0.66, 0.34), jacketMat);
    jakL.position.set(-0.19, 1.12, 0); group.add(jakL);
    var jakR = jakL.clone(); jakR.position.x = 0.19; group.add(jakR);
    var jakBack = new THREE.Mesh(PH.boxGeo(0.58, 0.66, 0.06), jacketMat);
    jakBack.position.set(0, 1.12, -0.15); group.add(jakBack);
    // zipper + pockets + gold chain (Mateo)
    var zip = new THREE.Mesh(PH.boxGeo(0.03, 0.6, 0.02), PH.stdMat(0xbbbbbb, 0.3, 0.9));
    zip.position.set(0, 1.12, 0.17); group.add(zip);
    var jpL = new THREE.Mesh(PH.boxGeo(0.14, 0.16, 0.02), PH.stdMat(d.jacket, 0.7, 0.05));
    jpL.position.set(-0.2, 0.92, 0.17); group.add(jpL);
    var jpR = jpL.clone(); jpR.position.x = 0.2; group.add(jpR);
    if (kind === 'mateo') {
      var chain = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI * 1.2),
        new THREE.MeshStandardMaterial({ color: 0xffd94a, roughness: 0.25, metalness: 1 }));
      chain.position.set(0, 1.42, 0.15); chain.rotation.x = 0.25; chain.rotation.z = Math.PI * 0.9;
      group.add(chain);
    }
    // arms (bomber sleeves)
    var armL = new THREE.Group();
    armL.position.set(-0.36, 1.42, 0);
    var armLm = new THREE.Mesh(PH.boxGeo(0.16, 0.62, 0.18), jacketMat);
    armLm.position.y = -0.31; armL.add(armLm);
    var handL = new THREE.Mesh(PH.boxGeo(0.14, 0.12, 0.15), PH.stdMat(d.skin, 0.8, 0));
    handL.position.y = -0.66; armL.add(handL);
    group.add(armL);
    var armR = armL.clone(); armR.position.x = 0.36; group.add(armR);
    // head
    var head = buildFace(d);
    head.position.y = 1.68;
    group.add(head);
    group.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    group.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR, head: head, torso: torso };
    group.userData.kind = kind;
    return group;
  };

  PH.buildMateo = function () { return PH.buildCharacter('mateo'); };
  PH.buildCrewMember = function (kind) { return PH.buildCharacter(kind); };

  // Walk / run / idle animation: swing limbs, bob the body. t is seconds, speed 0..1.
  PH.animateCharacter = function (group, t, speed, moving) {
    var p = group.userData.parts;
    if (!p) return;
    if (!moving || speed < 0.05) {
      // idle: gentle breathing
      p.armL.rotation.x = Math.sin(t * 1.4) * 0.05;
      p.armR.rotation.x = -Math.sin(t * 1.4) * 0.05;
      p.legL.rotation.x = 0; p.legR.rotation.x = 0;
      group.position.y = group.userData.baseY || 0;
      return;
    }
    var s = Math.sin(t * (6 + speed * 7)) * (0.35 + speed * 0.45);
    p.legL.rotation.x = s;
    p.legR.rotation.x = -s;
    p.armL.rotation.x = -s * 0.8;
    p.armR.rotation.x = s * 0.8;
    group.position.y = (group.userData.baseY || 0) + Math.abs(Math.cos(t * (6 + speed * 7))) * 0.05;
  };
})();
