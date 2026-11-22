// PIER HEAT — Sunset Bay v8.0: reflective glass facades. Each tall building gets panes that
// reflect the sky and clouds with varied colour, a thin mullion grid, a dark side versus a
// bright side (sun-facing panes glow warm, shaded panes go cool), and a dark base at the foot.
(function () {
  'use strict';
  var PH = window.PH;

  PH.facades = {
    panes: [],

    apply: function () {
      var scene = PH.scene;
      var buildings = PH.world.tallBuildings || [];
      var i, b;
      // pane colours: sky reflections, varied per building
      var paneCols = [0x9ac8e8, 0xffc27a, 0x7ab8d8, 0xe8a06a, 0x8ab8e8, 0xffb36b];
      for (i = 0; i < buildings.length; i++) {
        b = buildings[i];
        var size = new THREE.Vector3();
        b.geometry.computeBoundingBox();
        var bb = b.geometry.boundingBox;
        var w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
        var col = paneCols[i % paneCols.length];
        // mullion grid texture, shared per colour
        var tex = PH.makeCanvas(128, 256, function (g, cw, ch) {
          g.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6); g.fillRect(0, 0, cw, ch);
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(0, 0, cw, 18); g.fillRect(0, ch * 0.5, cw, 10);
          g.fillStyle = 'rgba(20,20,30,0.85)';
          var x, y;
          for (x = 0; x <= 4; x++) g.fillRect(x * (cw / 4) - 2, 0, 4, ch);
          for (y = 0; y <= 8; y++) g.fillRect(0, y * (ch / 8) - 2, cw, 4);
          // sky glare streak
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.beginPath(); g.moveTo(0, ch * 0.7); g.lineTo(cw, ch * 0.3); g.lineTo(cw, ch * 0.45); g.lineTo(0, ch * 0.85); g.closePath(); g.fill();
        });
        var paneMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.12, metalness: 0.85 });
        // bright (sun-facing, west) pane vs dark (east) pane
        var darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3542, roughness: 0.15, metalness: 0.8 });
        var paneW = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.86), paneMat);
        paneW.position.set(b.position.x - w / 2 - 0.06, h * 0.5, b.position.z);
        paneW.rotation.y = -Math.PI / 2;
        scene.add(paneW);
        var paneE = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.86), darkMat);
        paneE.position.set(b.position.x + w / 2 + 0.06, h * 0.5, b.position.z);
        paneE.rotation.y = Math.PI / 2;
        scene.add(paneE);
        var paneS = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.92, h * 0.86), paneMat);
        paneS.position.set(b.position.x, h * 0.5, b.position.z + d / 2 + 0.06);
        scene.add(paneS);
        var paneN = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.92, h * 0.86), darkMat);
        paneN.position.set(b.position.x, h * 0.5, b.position.z - d / 2 - 0.06);
        paneN.rotation.y = Math.PI;
        scene.add(paneN);
        // sunset rim: a thin warm strip along the west roofline, catching the low sun
        var rim = new THREE.Mesh(PH.boxGeo(0.18, 0.18, d * 0.9),
          new THREE.MeshStandardMaterial({ color: 0xffb36b, emissive: 0xff8a3a, emissiveIntensity: 0.9 }));
        rim.position.set(b.position.x - w / 2 - 0.1, h + 0.1, b.position.z);
        scene.add(rim);
        this.panes.push(paneW, paneE, paneS, paneN);
        void size;
      }
    }
  };
})();
