// PIER HEAT — Sunset Bay v7.5
// heli.js — the Bay City PD helicopter, built from how a real one
// flies (how-it-works-v75.md §1 + real-refs-v75.md §1).
//
// WHY IT LOOKS THIS WAY: a rotor blade is a wing that spins. At
// 200–400 rpm each blade makes its own wind, so the helicopter can
// hover — and the rotor speed barely changes: climb and descent come
// from changing the blades' angle together (collective). Direction
// comes from TILTING the whole rotor disc (cyclic): the disc leans
// toward the direction of travel, because the rotor's thrust is
// perpendicular to the disc — tilt it forward and part of the lift
// becomes forward push, so the nose dips a little and the disc leans
// forward. The engine spins the rotor one way, so Newton's third law
// tries to spin the body the other way — the little tail rotor pushes
// sideways against that torque, and the pilot steers with it. That is
// why a flying helicopter reads as: a BLUR DISC tilted toward its
// motion, a small vertical blur disc at the tail, and a body that stays
// mostly upright — never a rigid two-blade bar, never a body rolled
// over for no reason.
//
// WHAT THIS FILE BUILDS, and how sim.js uses it:
//   PH.makeHeli75() — the whole police helicopter: rounded white body,
//     big curved cockpit glass, long thin tail boom + tall fin, main
//     rotor as a tilted blur disc, tail rotor as a small vertical blur
//     disc, tube skids, POLICE on a blue cheatline, sensor turret
//     under the nose, exhaust on top, searchlight + beam. It returns
//     the same contract the old PH.makeHeli did — userData.rotor (the
//     group main.js spins), userData.tailRotor, userData.beam — so
//     sim.js can delegate to it with one line and main.js needs no
//     change at all.
//   PH.poseHeli75(heli) — tilts the rotor disc toward the heli's
//     direction of travel and dips the nose a touch; call it every
//     frame (guarded) and the disc always leans the right way.
// Plain script; uses window.PH.
(function () {
  'use strict';
  var PH = window.PH;
  var THREE = window.THREE;

  // Rotor blur canvas: a disc that is brightest in the middle band and
  // fades to transparent at the hub and at the rim, with a few faint
  // curved blade streaks — what a spinning rotor looks like to a
  // camera, not a frozen bar. The streaks are faint because at speed
  // the blades smear into a translucent disc.
  // v7.5 rev 2: the first version was far too solid — at 0.42 alpha
  // over a bright sky a 15-unit disc reads as a grey pancake, a UFO,
  // not a rotor. A real rotor blur is a GHOST: the sky shows through
  // almost everywhere, and only the rim and a few blade streaks catch
  // the eye. Alphas are now ~0.16 at most, the streaks are thin and
  // broken, and the disc itself shrank to 13.2 across.
  function rotorDiscTexture() {
    return PH.canvasTex(256, 256, function (g, w, h) {
      var cx = w / 2, cy = h / 2;
      var disc = g.createRadialGradient(cx, cy, 10, cx, cy, 126);
      disc.addColorStop(0, 'rgba(40,40,46,0)');
      disc.addColorStop(0.25, 'rgba(40,40,46,0.08)');
      disc.addColorStop(0.6, 'rgba(40,40,46,0.16)');
      disc.addColorStop(0.9, 'rgba(40,40,46,0.10)');
      disc.addColorStop(1, 'rgba(40,40,46,0)');
      g.fillStyle = disc;
      g.beginPath(); g.arc(cx, cy, 126, 0, Math.PI * 2); g.fill();
      // blade streaks: four thin broken arcs, slightly darker, so the
      // disc has a direction of spin instead of being a flat grey coin
      g.strokeStyle = 'rgba(20,20,26,0.35)';
      g.lineWidth = 3;
      [0.3, 1.9, 3.5, 5.1].forEach(function (a0) {
        g.beginPath(); g.arc(cx, cy, 96, a0, a0 + 0.9); g.stroke();
      });
      // blue tip ring, the way the old blades carried blue tips — now
      // as a faint ring at the disc's edge, not two painted bars
      g.strokeStyle = 'rgba(32,64,255,0.30)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 118, 0, Math.PI * 2); g.stroke();
    });
  }

  // Tail-rotor blur canvas: the same idea, smaller and denser — a
  // vertical disc at the tail that pushes sideways against torque.
  // v7.5 rev 2: same ghost treatment as the main disc — the first
  // version read as a solid grey coin on the fin.
  function tailRotorTexture() {
    return PH.canvasTex(128, 128, function (g, w, h) {
      var cx = w / 2, cy = h / 2;
      var disc = g.createRadialGradient(cx, cy, 4, cx, cy, 62);
      disc.addColorStop(0, 'rgba(30,30,34,0)');
      disc.addColorStop(0.35, 'rgba(30,30,34,0.20)');
      disc.addColorStop(0.85, 'rgba(30,30,34,0.16)');
      disc.addColorStop(1, 'rgba(30,30,34,0)');
      g.fillStyle = disc;
      g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(15,15,20,0.30)';
      g.lineWidth = 2;
      [0.5, 2.1, 3.7, 5.3].forEach(function (a0) {
        g.beginPath(); g.arc(cx, cy, 44, a0, a0 + 0.8); g.stroke();
      });
    });
  }

  // POLICE on a blue band: white letters on the thick blue cheatline
  // that runs along the cabin — the marking a police helicopter wears.
  function policeBandTexture() {
    return PH.canvasTex(512, 96, function (g, w, h) {
      g.fillStyle = '#2040a0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      g.font = '900 60px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('POLICE', w / 2, h / 2 + 2);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    });
  }

  PH.makeHeli75 = function () {
    var g = new THREE.Group();
    var white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.15 });
    var blue = new THREE.MeshStandardMaterial({ color: 0x2040a0, roughness: 0.45, metalness: 0.2 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.4 });
    var glass = new THREE.MeshStandardMaterial({
      color: 0x18222e, roughness: 0.08, metalness: 0.65,
      map: PH.skyGlassTexture(false)
    });

    // Rounded cabin: a sphere squashed into an egg, nose forward (+Z).
    // A real police helicopter's body is a rounded pod, not a box —
    // the curve is what makes it read as an aircraft at a glance.
    var cabin = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), white);
    cabin.scale.set(0.95, 0.85, 1.5);
    cabin.position.set(0, 0, 0.3);
    cabin.castShadow = true;
    g.add(cabin);
    // belly: a shallow blue keel under the cabin, so the white body has
    // a base line and the blue cheatline has something to sit on
    var belly = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 3.0), blue);
    belly.position.set(0, -0.82, 0.2);
    g.add(belly);
    // big curved cockpit glass: a sphere segment bulging out of the
    // nose, sky-reflecting, so the pilots' greenhouse reads as glass
    // instead of a black slab pasted on the front
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 12, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.18, Math.PI * 0.5),
      glass);
    canopy.position.set(0, 0.05, 1.35);
    canopy.scale.set(1, 0.8, 1);
    g.add(canopy);
    // side windows, curved with the cabin
    [-0.98, 0.98].forEach(function (x) {
      var win = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), glass);
      win.scale.set(0.25, 0.7, 1.1);
      win.position.set(x, 0.15, 0.5);
      g.add(win);
    });
    // blue cheatline + POLICE band along each flank
    [-1.02, 1.02].forEach(function (x) {
      var band = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5),
        new THREE.MeshStandardMaterial({ map: policeBandTexture(), roughness: 0.45 }));
      band.position.set(x, -0.28, 0.2);
      band.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(band);
    });

    // Tail boom: long, thin, tapering to the fin — a helicopter's tail
    // is a lever arm, not a second body. The fin is TALL so the tail
    // reads from the side even at distance.
    var boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.42, 4.6, 10), white);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.3, -3.5);
    boom.castShadow = true;
    g.add(boom);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.0), blue);
    fin.position.set(0, 1.0, -5.6);
    fin.castShadow = true;
    g.add(fin);
    var finTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.6), white);
    finTop.position.set(0, 1.85, -5.6);
    g.add(finTop);
    // horizontal stabiliser near the tail, so the boom does not end in
    // a bare point
    var stab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.5), white);
    stab.position.set(0, 0.45, -5.0);
    g.add(stab);

    // Tail rotor: a small blur disc in the VERTICAL plane at the fin
    // (its axis is sideways, along X) — it pushes sideways against the
    // main rotor's torque. main.js spins it around X, which is exactly
    // a spin in its own plane.
    var tailRotor = new THREE.Group();
    tailRotor.position.set(0.32, 0.4, -5.6);
    var tailDisc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({
        map: tailRotorTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false
      }));
    tailDisc.rotation.y = Math.PI / 2; // disc faces sideways (+X)
    tailRotor.add(tailDisc);
    var tailHub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8), dark);
    tailHub.rotation.z = Math.PI / 2;
    tailRotor.add(tailHub);
    g.add(tailRotor);

    // Main rotor: the blur disc. It hangs from a short mast above the
    // cabin, inside a tilt group — poseHeli75 leans the whole tilt
    // group toward the direction of travel, while main.js spins the
    // rotor group inside it around Y. The disc is wide (13.2 across)
    // and thin: a spinning rotor is a disc, and the disc IS the rotor.
    // v7.5 rev 2: 7.6 -> 6.6 radius — a real rotor is ~3x the body
    // length, and the bigger disc crowded the frame in shot 3.
    var rotorTilt = new THREE.Group();
    rotorTilt.position.y = 1.3;
    var rotor = new THREE.Group();
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), dark);
    mast.position.y = -0.15;
    rotor.add(mast);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 10), dark);
    rotor.add(hub);
    var disc = new THREE.Mesh(new THREE.CircleGeometry(6.6, 40),
      new THREE.MeshBasicMaterial({
        map: rotorDiscTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false
      }));
    disc.rotation.x = -Math.PI / 2; // the disc lies flat, overhead
    rotor.add(disc);
    rotorTilt.add(rotor);
    g.add(rotorTilt);
    // rotor mast fairing: a small rounded cowl over the mast base, so
    // the mast does not sprout bare out of the cabin roof
    var fairing = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), white);
    fairing.scale.set(1, 0.5, 1.4);
    fairing.position.set(0, 1.05, 0.1);
    g.add(fairing);
    // panel line along the cabin roof: a thin dark strip that breaks
    // the white egg into panels the way a real airframe is panelled
    var roofLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 2.6), dark);
    roofLine.position.set(0, 0.98, 0.1);
    g.add(roofLine);

    // Navigation lights, the way aircraft wear them: red on the left
    // (port) skid tip, green on the right (starboard), white strobe on
    // the tail. The strobe blinks — poseHeli75 pulses it with time,
    // so the heli flashes the way a real one does over a city at dusk.
    function navLight(color, x, y, z, blink) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2.5, transparent: !!blink, opacity: 1 }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }
    navLight(0xff2020, -0.8, -1.35, 1.7);
    navLight(0x20ff40, 0.8, -1.35, 1.7);
    var strobe = navLight(0xffffff, 0, 1.6, -5.6, true);
    // pitot tube under the nose: the thin probe that measures airspeed
    var pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), dark);
    pitot.rotation.x = Math.PI / 2 - 0.25;
    pitot.position.set(0.45, -0.7, 1.9);
    g.add(pitot);
    // rescue winch on the right flank + its cable and hook, hanging
    // just clear of the skid — the police heli can lift someone off a
    // roof or a boat, and the winch is the tell
    var winch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.5), dark);
    winch.position.set(1.05, -0.5, 0.6);
    g.add(winch);
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), dark);
    cable.position.set(1.05, -1.05, 0.6);
    g.add(cable);
    var hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 10, Math.PI * 1.5), dark);
    hook.position.set(1.05, -1.55, 0.6);
    hook.rotation.z = Math.PI * 0.75;
    g.add(hook);
    // belly hook under the keel: the cargo hook for sling loads
    var bellyHook = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 10), dark);
    bellyHook.position.set(0, -1.0, -0.4);
    bellyHook.rotation.x = Math.PI / 2;
    g.add(bellyHook);
    // POLICE on the tail boom, both flanks, so the marking reads from
    // the side as well as from the front — a small white-on-blue plate
    // on the boom, just ahead of the fin
    [-0.16, 0.16].forEach(function (x) {
      var boomMark = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.28),
        new THREE.MeshStandardMaterial({ map: policeBandTexture(), roughness: 0.45 }));
      boomMark.position.set(x, 0.3, -4.6);
      boomMark.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(boomMark);
    });

    // Skids: thin tubes under the cabin, upturned at the front — the
    // helicopter stands on these, not on a belly. Four short struts
    // join them to the cabin.
    [-0.8, 0.8].forEach(function (x) {
      var skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), dark);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(x, -1.35, 0.1);
      g.add(skid);
      var toe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), dark);
      toe.rotation.x = Math.PI / 2 - 0.5;
      toe.position.set(x, -1.2, 1.95);
      g.add(toe);
      [-1.1, 1.1].forEach(function (z) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), dark);
        strut.position.set(x, -1.08, z);
        g.add(strut);
      });
    });

    // Sensor turret under the nose: the camera ball the police watch
    // the street with, with a glass lens that catches the light.
    var turret = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), dark);
    turret.position.set(0, -0.95, 1.7);
    g.add(turret);
    var lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x18222e, emissive: 0x3a6a8a, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.6 }));
    lens.position.set(0, -1.0, 1.92);
    g.add(lens);
    // exhaust on top of the cabin, behind the mast — the turboshaft's
    // hot breath, angled back so it never blows across the rotor
    var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.6, 8), dark);
    exhaust.rotation.x = 0.5;
    exhaust.position.set(0, 1.05, -0.6);
    g.add(exhaust);
    // searchlight under the nose + the long beam to the ground
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffee88, emissiveIntensity: 2 }));
    lamp.position.set(0, -1.05, 1.2);
    g.add(lamp);
    var beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 34, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.x = Math.PI; // cone opens downward
    beam.position.set(0, -18, 1.2);
    g.add(beam);

    g.userData.rotor = rotor;
    g.userData.rotorTilt = rotorTilt;
    g.userData.tailRotor = tailRotor;
    g.userData.beam = beam;
    g.userData.strobe = strobe;
    // v7.5 rev 2: the winch cable + hook, so poseHeli75 can sway them
    g.userData.cable = cable;
    g.userData.hook = hook;
    g.userData.heli75 = true;
    return g;
  };

  // Tilt the rotor disc toward the direction of travel, and dip the
  // nose a touch — the cyclic at work. The disc leans about 8 degrees
  // forward along the heli's heading; the body only 2 degrees, so the
  // helicopter stays upright while the disc does the flying. The tilt
  // axis is the heli's lateral axis (perpendicular to its heading).
  // v7.5 rev 2: also pulses the tail strobe (a real anti-collision
  // strobe flashes about once a second) — the flash is driven by wall
  // time, so it blinks even in the frozen staged shots. And the
  // searchlight beam sweeps slowly side to side while the winch cable
  // sways — a hovering police heli is never perfectly still; it is
  // always searching, always correcting.
  PH.poseHeli75 = function (heli) {
    if (!heli || !heli.userData.rotorTilt) return;
    // tilt the disc forward: rotate around the lateral axis. In the
    // heli's local frame the forward is +Z, so the lateral axis is X
    // and a forward lean is a positive rotation around X.
    heli.userData.rotorTilt.rotation.x = 0.14;
    heli.userData.rotorTilt.rotation.z = 0;
    // the body follows a little — nose down, never rolled over
    heli.rotation.x = 0.035;
    heli.rotation.z = 0;
    // keep the disc's spin axis honest: the disc spins around Y inside
    // the tilt group, so main.js's rotation.y spin still works.
    var t = performance.now() / 1000;
    var st = heli.userData.strobe;
    if (st) {
      var ph = t % 1;
      st.material.opacity = ph < 0.12 ? 1 : 0.12;
    }
    // searchlight sweep: the beam cone swings ±7 degrees, slow, the
    // way a pilot scans a street from a hover
    var beam = heli.userData.beam;
    if (beam) beam.rotation.z = Math.sin(t * 0.4) * 0.12;
    // winch cable sway: the hanging hook lags the body's motion, a
    // pendulum a half-beat behind the heli
    var cable = heli.userData.cable;
    var hook = heli.userData.hook;
    if (cable) cable.rotation.x = Math.sin(t * 0.8) * 0.05;
    if (hook) {
      hook.rotation.x = Math.sin(t * 0.8 + 0.5) * 0.08;
      hook.position.x = 1.05 + Math.sin(t * 0.8) * 0.03;
    }
  };
})();
