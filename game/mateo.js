// PIER HEAT — Sunset Bay v7.6
// mateo.js — procedural hero characters, built from code primitives.
// No model file: Mateo Vega and Kira are assembled here from boxes,
// capsules and spheres, with a structured low-poly face (eyes with
// whites, pupils and glints, brows, a wedged nose, lips and a chin),
// a burnt-orange bomber jacket, a white tee, dark jeans and sneakers.
// v7.4: a `drive` pose (both hands forward on the boat helm) and boat
// gear — an orange life vest + a cap — for Mateo on the speedboat.
// v7.5: Mateo's facing in shot 2 is now derived from the camera in
// main.js (S.mateoHeading = atan2 of camera minus Mateo), so the face
// he shows the lens can never regress if the camera moves — the rig
// itself is unchanged (faces +Z, forwardOffset 0).
// v7.6 (GTA VI video study — Trailer 2 + An Extended Look, see
// gta6-video-refs-v76.md): the v7.5 Mateo read as a wide orange box
// with two dot eyes and a moustache line. Real proportions are head
// ~1/7.5 of height and shoulders ~2 heads wide, and a face has
// structure — eyes sit IN the head with brows above, a nose that
// sticks out, a mouth with lips, a chin below it, ears at the sides
// and a neck under the jaw. So the rig is slimmed (narrower torso,
// arms and legs, shoulders pulled in, head slightly smaller with a
// neck), the face is rebuilt with white eyes + dark pupils + glints,
// angled brows, a wedged nose with a tip, two-tone lips and a chin,
// and the clothes gain the streetwear details the trailers show:
// a zipper pull, chest pocket flaps, ribbed sleeve cuffs, a gold
// chain, jeans front pockets and rolled cuffs. Kira inherits the
// same rig (plus a gold earring); Dario and Lena live in
// portraits.js, which gets the same face treatment in 2D.
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
  // v7.6: slimmer shell (radius 0.30, not 0.34 — shoulders ~2 heads
  // wide now), a chrome zipper pull, two chest pocket flaps and a gold
  // chain at the collar — the jacket is dressed, not a flat blob.
  function bomberTorso(jacket, tee) {
    var g = new THREE.Group();
    var shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10), std(jacket, 0.8));
    shell.position.y = 1.18; shell.castShadow = true;
    shell.userData.part = 'jacket'; // retint target (see core.js)
    g.add(shell);
    var chest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 0.1), std(tee, 0.9));
    chest.position.set(0, 1.22, 0.27);
    chest.userData.part = 'tee';
    g.add(chest);
    var zip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.03), std(0x2a2a2a, 0.5, 0.4));
    zip.position.set(0, 1.2, 0.33); g.add(zip);
    // chrome zipper pull at the collar, so the zipper has a handle
    var pull = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
    pull.position.set(0, 1.5, 0.34); g.add(pull);
    var waist = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.12, 12), std(0x222222, 0.9));
    waist.position.y = 0.88; g.add(waist);
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 8, 12), std(jacket, 0.85));
    collar.position.y = 1.56; collar.rotation.x = Math.PI / 2; g.add(collar);
    // gold chain at the collar — the streetwear tell, catching the sun.
    // v7.6 rev 2: tighter (radius 0.13, hugging the collar) — the first
    // render's wider ring read as a smile-shaped handle across the chest
    var chain = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xffd23c, metalness: 0.95, roughness: 0.25 }));
    chain.position.set(0, 1.53, 0.18); chain.rotation.x = Math.PI / 2 - 0.55; g.add(chain);
    // shoulder patches + chest pocket flaps, so the jacket is not a flat blob
    [-0.18, 0.18].forEach(function (x) {
      var patch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.18), std(0x7a3400, 0.9));
      patch.position.set(x, 1.52, 0.1); g.add(patch);
      var flap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.03), std(jacket, 0.85));
      flap.position.set(x, 1.32, 0.33); g.add(flap);
      var flapBtn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
      flapBtn.position.set(x, 1.3, 0.35); g.add(flapBtn);
    });
    var pocket = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.04), std(jacket, 0.85));
    pocket.position.set(-0.17, 1.12, 0.32); g.add(pocket);
    return g;
  }

  // Head: skin sphere, hair cap, and a FACE WITH STRUCTURE — white
  // eyes with dark pupils and glints, angled brows, a wedged nose
  // that sticks out of the face, two-tone lips, a chin, ears and a
  // neck. Everything sits on the front (+Z) so the face reads from
  // the camera side in shots 2 and 3.
  // v7.6: the v7.5 face was two black dots + a mouth line + a beard
  // box (read as a moustache). The new face is built like the
  // portraits in portraits.js: eyes IN white sockets, a nose with a
  // tip and nostril shade, lips instead of a line, a jaw and chin
  // below the mouth. The skull is slightly smaller (0.21) and sits
  // on a neck, so the head stops looking like a ball on a box.
  function facedHead(skin, hairColor, opts) {
    var g = new THREE.Group();
    g.position.y = 1.74;
    // neck: the head sits ON something now, not floating over the collar
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.16, 8), std(skin, 0.75));
    neck.position.y = -0.26; g.add(neck);
    var skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), std(skin, 0.75));
    skull.castShadow = true; g.add(skull);
    // ears at the sides of the skull — a head without ears reads as a mask
    [-0.2, 0.2].forEach(function (ex) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(skin, 0.75));
      ear.position.set(ex, -0.02, 0); ear.scale.set(0.6, 1, 0.8); g.add(ear);
    });
    var hairMat = std(hairColor, 0.95);
    // round 2: the old full cap (theta 0.45 PI) read as a brown bowl
    // hat in shots 2 and 4. The new hair is shorter at the front and
    // swept to one side: a smaller cap (0.38 PI) that ends above the
    // brow, a side-parted fringe swept across the forehead, a quiff
    // bump at the front hairline and short side locks — hair, not a hat.
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.38), hairMat);
    cap.position.y = 0.05;
    cap.userData.part = 'hair'; // retint target (see core.js)
    g.add(cap);
    // swept fringe: a thin slab angled down across the forehead, parted
    // to Mateo's left so the right brow stays fully visible
    var fringe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.11), hairMat);
    fringe.position.set(-0.03, 0.19, 0.18);
    fringe.rotation.z = -0.28;
    fringe.rotation.x = -0.15;
    g.add(fringe);
    // quiff: a small bump at the front hairline, tilted forward
    var quiff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), hairMat);
    quiff.position.set(0.09, 0.24, 0.15);
    quiff.scale.set(1.4, 0.7, 1);
    g.add(quiff);
    // side locks + sideburns, so the hair has edges instead of one dome
    [-0.19, 0.19].forEach(function (x) {
      var lock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.09), hairMat);
      lock.position.set(x, 0.07, 0.13);
      g.add(lock);
      var burn = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.035), hairMat);
      burn.position.set(x, -0.06, 0.17);
      g.add(burn);
    });
    // v7.6: back hair volume — the skull's rear is covered, so the
    // head reads as hair + face from the side, not a bald dome
    var backHair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.1), hairMat);
    backHair.position.set(0, 0.02, -0.17); g.add(backHair);
    if (opts.longHair) {
      var back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.11), hairMat);
      back.position.set(0, -0.14, -0.17); g.add(back);
      [-0.15, 0.15].forEach(function (x) {
        var lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.09), hairMat);
        lock.position.set(x, -0.1, 0.15); g.add(lock);
      });
    }
    // eyes: white sockets + dark pupils + tiny glints, so the eyes
    // have depth instead of being two black dots pasted on the skin
    var whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8f8f0 });
    var darkMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
    [-0.08, 0.08].forEach(function (ex) {
      var white = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), whiteMat);
      white.position.set(ex, 0.01, 0.19); white.scale.set(1, 0.75, 0.5); g.add(white);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), darkMat);
      pupil.position.set(ex, 0.01, 0.225); g.add(pupil);
      var glint = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      glint.position.set(ex + 0.012, 0.025, 0.24); g.add(glint);
      // brows: angled slightly down toward the nose — determined, not flat
      var brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.015), darkMat);
      brow.position.set(ex, 0.095, 0.2);
      brow.rotation.z = ex < 0 ? 0.14 : -0.14;
      g.add(brow);
    });
    // nose: a wedge that sticks OUT of the face (box + tip sphere) with
    // a nostril shade under it — a face without a nose is a mask
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.06), std(skin, 0.75));
    nose.position.set(0, -0.045, 0.21); g.add(nose);
    var noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), std(skin, 0.75));
    noseTip.position.set(0, -0.085, 0.23); noseTip.scale.set(1.2, 0.8, 0.8); g.add(noseTip);
    var nostril = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.01), darkMat);
    nostril.position.set(0, -0.1, 0.235); g.add(nostril);
    // mouth: two-tone lips, not a line — an upper lip and a fuller
    // lower lip, so the mouth has a shape at screenshot distance
    var lipMat = std(0x8a3a2a, 0.7);
    var lipLight = std(0xb05a44, 0.7);
    var upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.012), lipMat);
    upperLip.position.set(0, -0.125, 0.2); g.add(upperLip);
    var lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.012), lipLight);
    lowerLip.position.set(0, -0.15, 0.2); g.add(lowerLip);
    // chin + jaw: a rounded block under the mouth, slightly darker
    // skin, so the lower face has a jawline instead of ending at the lips
    var chin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.05), std(skin, 0.8));
    chin.position.set(0, -0.19, 0.18); g.add(chin);
    if (opts.stubble) {
      // light jaw stubble following the jawline (a thin band under the
      // chin + along the jaw), not a moustache box over the mouth
      var jawStub = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.04), std(0x2a1a12, 1));
      jawStub.position.set(0, -0.185, 0.19); g.add(jawStub);
      [-0.1, 0.1].forEach(function (x) {
        var jawSide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.03), std(0x2a1a12, 1));
        jawSide.position.set(x, -0.13, 0.19); g.add(jawSide);
      });
    }
    if (opts.earring) {
      // Kira's gold hoop on the left ear
      var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0xffd23c, metalness: 0.95, roughness: 0.25 }));
      hoop.position.set(-0.22, -0.07, 0); g.add(hoop);
    }
    return g;
  }

  // Full rig. Joints are empty Groups at shoulder / hip / knee so limbs
  // swing from their root. Origin at the soles; total height ~1.9.
  // v7.6 proportions: legs and arms narrower and closer in (shoulders
  // ~2 heads wide), torso slimmer — the v7.5 rig was a wide box with
  // arms stuck out at 0.42. Head ~1/7.5 is the target; the low-poly
  // face stays readable at 0.21 radius while the body slims around it.
  PH.makeMateoCharacter = function (opts) {
    opts = opts || {};
    var jacket = opts.jacket != null ? opts.jacket : 0xff7a1a;
    var tee = opts.tee != null ? opts.tee : 0xf2f2f2;
    var jeans = opts.jeans != null ? opts.jeans : 0x2a3a4a;
    var skin = opts.skin != null ? opts.skin : 0xe0ac69;
    var hair = opts.hair != null ? opts.hair : 0x2a1a12;
    var scale = opts.scale || 1;
    var g = new THREE.Group();

    var legL = new THREE.Group(); legL.position.set(-0.13, 0.88, 0);
    var legR = new THREE.Group(); legR.position.set(0.13, 0.88, 0);
    var legGeo = new THREE.BoxGeometry(0.2, 0.88, 0.22);
    var jeansMat = std(jeans, 0.9);
    var lm = new THREE.Mesh(legGeo, jeansMat); lm.position.y = -0.44; lm.castShadow = true;
    var rm = new THREE.Mesh(legGeo, jeansMat); rm.position.y = -0.44; rm.castShadow = true;
    legL.add(lm); legR.add(rm);
    // knees: a second segment so the lower leg can bend on the run
    var shinGeo = new THREE.BoxGeometry(0.17, 0.42, 0.19);
    var kneeL = new THREE.Group(); kneeL.position.y = -0.44; legL.add(kneeL);
    var kneeR = new THREE.Group(); kneeR.position.y = -0.44; legR.add(kneeR);
    var shinL = new THREE.Mesh(shinGeo, jeansMat); shinL.position.y = -0.21; kneeL.add(shinL);
    var shinR = new THREE.Mesh(shinGeo, jeansMat); shinR.position.y = -0.21; kneeR.add(shinR);
    // v7.6: jeans front pockets + rolled cuffs at the ankle — jeans
    // are clothes now, not two dark slabs
    [legL, legR].forEach(function (leg) {
      var pocket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), std(jeans, 0.95));
      pocket.position.set(0, -0.12, 0.12); leg.add(pocket);
      var cuff = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.21), std(0x3a4a5a, 0.9));
      cuff.position.set(0, -0.4, 0); leg.add(cuff);
    });
    // sneakers: white sole + dark upper, toe pointing +Z
    [kneeL, kneeR].forEach(function (knee) {
      var shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.4), std(0x1a1a1a, 0.7));
      shoe.position.set(0, -0.46, 0.06); knee.add(shoe);
      var sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.42), std(0xf2f2f2, 0.6));
      sole.position.set(0, -0.53, 0.06); knee.add(sole);
    });

    var torso = bomberTorso(jacket, tee);
    var headG = facedHead(skin, hair, { stubble: !opts.longHair, longHair: !!opts.longHair, earring: !!opts.earring });

    var armL = new THREE.Group(); armL.position.set(-0.38, 1.52, 0);
    var armR = new THREE.Group(); armR.position.set(0.38, 1.52, 0);
    var armGeo = new THREE.BoxGeometry(0.15, 0.68, 0.17);
    var jacketMat = std(jacket, 0.8);
    var al = new THREE.Mesh(armGeo, jacketMat); al.position.y = -0.34; al.castShadow = true;
    var ar = new THREE.Mesh(armGeo, jacketMat); ar.position.y = -0.34; ar.castShadow = true;
    armL.add(al); armR.add(ar);
    // v7.6: ribbed cuffs at the sleeve ends, so the arms end in a cuff
    // instead of a raw box edge
    [armL, armR].forEach(function (arm) {
      var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8), std(0x222222, 0.9));
      cuff.position.y = -0.66; arm.add(cuff);
    });
    // skin hands at the sleeve ends
    [armL, armR].forEach(function (arm) {
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(skin, 0.75));
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
    // round 2 accessories: a wristwatch on the left wrist, a belt,
    // sneaker laces and a SUNSET BAY patch on the jacket back — small
    // tells that the hero is dressed, not assembled
    var watch = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.19), std(0x14181c, 0.4, 0.6));
    watch.position.y = -0.6; armL.add(watch);
    var watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6ab0e8, emissiveIntensity: 0.8 }));
    watchFace.position.set(0, -0.57, 0.08); armL.add(watchFace);
    var belt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.09, 12), std(0x1a1a1a, 0.8));
    belt.position.y = 0.9; g.add(belt);
    var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.9, roughness: 0.25 }));
    buckle.position.set(0, 0.9, 0.32); g.add(buckle);
    var patchTex = PH.canvasTex(256, 128, function (ctx, w, h) {
      ctx.fillStyle = '#14181c'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#ffd23c'; ctx.font = '900 34px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SUNSET', w / 2, h / 2 - 20);
      ctx.fillText('BAY', w / 2, h / 2 + 20);
    });
    var backPatch = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17),
      new THREE.MeshStandardMaterial({ map: patchTex, roughness: 0.8 }));
    backPatch.position.set(0, 1.3, -0.32);
    backPatch.rotation.y = Math.PI;
    g.add(backPatch);
    [kneeL, kneeR].forEach(function (knee) {
      for (var li = 0; li < 3; li++) {
        var lace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.03), std(0xf2f2f2, 0.6));
        lace.position.set(0, -0.42 + li * 0.05, 0.21);
        knee.add(lace);
      }
    });
    // boat gear (v7.4): an orange life vest + a cap, hidden until
    // setBoatGear(true) — Mateo wears them on the speedboat in shot 3
    var boatGear = new THREE.Group();
    var vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.1), std(0xff6a00, 0.8));
    vestFront.position.set(0, 1.22, 0.33);
    boatGear.add(vestFront);
    var vestBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.1), std(0xff6a00, 0.8));
    vestBack.position.set(0, 1.22, -0.33);
    boatGear.add(vestBack);
    [-0.2, 0.2].forEach(function (x) {
      var strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.46), std(0xffc832, 0.7));
      strap.position.set(x, 1.22, 0);
      boatGear.add(strap);
    });
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.1, 12), std(0xff6a00, 0.8));
    cap.position.set(0, 1.96, 0);
    boatGear.add(cap);
    var capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.17), std(0xff6a00, 0.8));
    capBrim.position.set(0, 1.93, 0.27);
    boatGear.add(capBrim);
    boatGear.visible = false;
    g.add(boatGear);

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
      // v7.4: show/hide the life vest + cap for the boat scenes
      setBoatGear: function (on) { boatGear.visible = !!on; },
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
        // boat deck (y ~1.0) in shot 3 and on the pier deck (y 1.35)
        // in free play, and resetting y to 0 sank Mateo under the deck
        // in v7.3 rev 1. The run bob rides the torso.
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
        } else if (anim === 'drive') {
          // v7.4: both hands forward on the boat helm, knees braced
          // against the swell, torso leaning slightly into the wind
          armL.rotation.x = -Math.PI / 2 + 0.25; armR.rotation.x = -Math.PI / 2 + 0.25;
          armL.rotation.z = 0.35; armR.rotation.z = -0.35;
          legL.rotation.x = 0.25; legR.rotation.x = -0.15;
          kneeL.rotation.x = 0.25; kneeR.rotation.x = 0.15;
          torso.rotation.x = 0.12;
          torso.rotation.z = Math.sin(t * 0.9 + phase) * 0.04;
          headG.rotation.x = -0.08;
        } else if (anim === 'wave') {
          // v7.4 rev 2: one arm raised, waving/pointing at the boats
          // behind — Kira on the stern bench in shot 3
          armR.rotation.x = -2.6; armR.rotation.z = -0.4;
          armR.rotation.y = Math.sin(t * 2.2 + phase) * 0.25;
          armL.rotation.x = -0.4;
          legL.rotation.x = 0.1; legR.rotation.x = -0.1;
          headG.rotation.y = Math.sin(t * 0.5 + phase) * 0.3;
        } else if (anim === 'point') {
          // right arm straight out, finger on a target — Kira calling
          // out the next police boat in the chase
          armR.rotation.x = -Math.PI / 2; armR.rotation.z = -0.05;
          armL.rotation.x = -0.3;
          headG.rotation.y = 0.25;
          headG.rotation.x = -0.05;
          legL.rotation.x = 0.15; legR.rotation.x = -0.15;
          torso.rotation.y = 0.15;
        } else if (anim === 'shout') {
          // one hand cupped to the mouth, calling over the engine
          armR.rotation.x = -2.2; armR.rotation.z = -0.9;
          armL.rotation.x = -Math.PI / 2 + 0.25;
          headG.rotation.x = -0.12;
          torso.rotation.x = 0.08;
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

  // Kira: same rig, teal bomber, dark tee, long hair, slimmer build,
  // gold hoop earring (v7.6).
  PH.makeKiraCharacter = function () {
    var kira = PH.makeMateoCharacter({
      jacket: 0x0e7a7a, tee: 0x222831, jeans: 0x1a1a1a,
      skin: 0xf2c89b, hair: 0x2a1a12, longHair: true, scale: 0.96, earring: true
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
