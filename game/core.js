// PIER HEAT — Sunset Bay v7.2
// core.js — shared foundation: seeded RNG, canvas textures, minimal GLB
// reader, model retinting, HUD setters and the 2D round minimap painter.
// Plain script (no modules). Everything lives on window.PH.
(function () {
  'use strict';
  var PH = window.PH = window.PH || {};
  PH.VERSION = '7.2';
  PH.GAME = 'PIER HEAT — Sunset Bay';

  // ---------- seeded random (mulberry32) ----------
  PH.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PH.R = PH.mulberry32(1);
  PH.seed = function (s) { PH.R = PH.mulberry32(s >>> 0 || 1); };
  PH.rand = function (a, b) { return a + PH.R() * (b - a); };
  PH.randInt = function (a, b) { return Math.floor(PH.rand(a, b + 1)); };
  PH.pick = function (arr) { return arr[Math.floor(PH.R() * arr.length)]; };
  PH.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  PH.lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---------- canvas textures ----------
  PH.canvasTex = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };

  // Shop sign: bold text on a coloured board with a frame.
  PH.signTexture = function (text, bg, fg) {
    return PH.canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 10;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = fg || '#ffffff';
      g.font = '900 62px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
      var label = text.length > 14 ? text : text;
      var size = text.length > 12 ? 44 : (text.length > 8 ? 54 : 62);
      g.font = '900 ' + size + 'px Arial, sans-serif';
      g.fillText(label, w / 2, h / 2 + 2);
    });
  };

  // Licence plate.
  PH.plateTexture = function (text) {
    return PH.canvasTex(256, 64, function (g, w, h) {
      g.fillStyle = '#f4f1e4'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1a2a44'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#1a2a44';
      g.font = '900 34px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 1);
    });
  };

  // Soft radial glow (muzzle flash star / light halo).
  PH.glowTexture = function () {
    return PH.canvasTex(128, 128, function (g, w, h) {
      var r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      r.addColorStop(0, 'rgba(255,255,240,1)');
      r.addColorStop(0.18, 'rgba(255,210,100,0.95)');
      r.addColorStop(0.45, 'rgba(255,150,50,0.35)');
      r.addColorStop(1, 'rgba(255,140,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
      // short star spikes (a muzzle flash, not a sun)
      g.fillStyle = 'rgba(255,240,180,0.95)';
      g.beginPath();
      g.moveTo(64, 34); g.lineTo(68, 60); g.lineTo(94, 64); g.lineTo(68, 68);
      g.lineTo(64, 94); g.lineTo(60, 68); g.lineTo(34, 64); g.lineTo(60, 60);
      g.closePath(); g.fill();
    });
  };

  // Sun disc with halo.
  PH.sunTexture = function () {
    return PH.canvasTex(256, 256, function (g, w, h) {
      var r = g.createRadialGradient(128, 128, 4, 128, 128, 126);
      r.addColorStop(0, 'rgba(255,250,220,1)');
      r.addColorStop(0.28, 'rgba(255,214,120,0.95)');
      r.addColorStop(0.55, 'rgba(255,150,60,0.45)');
      r.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
  };

  // Speckled sand.
  PH.sandTexture = function () {
    return PH.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#e3c98f'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var s = PH.R();
        g.fillStyle = s < 0.5 ? 'rgba(190,150,90,0.5)' : 'rgba(255,235,190,0.5)';
        g.fillRect(PH.R() * w, PH.R() * h, 2 + PH.R() * 3, 2 + PH.R() * 2);
      }
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (var j = 0; j < 24; j++) g.fillRect(PH.R() * w, PH.R() * h, 20 + PH.R() * 40, 2);
    });
  };

  // ---------- minimal GLB reader ----------
  // Reads a binary glTF container (JSON chunk + BIN chunk), builds
  // geometries from accessors, materials from base-color factors, the
  // node hierarchy (TRS or matrix), skins with skeletons + inverse bind
  // matrices, and rebuilds animation clips from the channels.
  PH.loadGLB = function (url, onDone, onError) {
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('GLB fetch failed: ' + res.status);
      return res.arrayBuffer();
    }).then(function (buf) {
      var dv = new DataView(buf);
      var magic = dv.getUint32(0, true);
      if (magic !== 0x46546C67) throw new Error('not a GLB file');
      var jsonLen = dv.getUint32(12, true);
      var json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
      var binOff = 20 + jsonLen + 8;
      var bin = new Uint8Array(buf, binOff);
      var gltf = buildGLTF(json, bin);
      onDone(gltf);
    }).catch(function (err) { if (onError) onError(err); });
  };

  function accessorArray(json, bin, idx) {
    var acc = json.accessors[idx];
    var bv = json.bufferViews[acc.bufferView];
    var compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    var numComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
    var off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    var stride = bv.byteStride || compBytes * numComp;
    var out = new Float32Array(acc.count * numComp);
    for (var i = 0; i < acc.count; i++) {
      for (var c = 0; c < numComp; c++) {
        var p = off + i * stride + c * compBytes;
        var v;
        if (acc.componentType === 5126) v = new DataView(bin.buffer, bin.byteOffset + p, 4).getFloat32(0, true);
        else if (acc.componentType === 5123) v = new DataView(bin.buffer, bin.byteOffset + p, 2).getUint16(0, true);
        else if (acc.componentType === 5125) v = new DataView(bin.buffer, bin.byteOffset + p, 4).getUint32(0, true);
        else if (acc.componentType === 5121) v = bin[p];
        else if (acc.componentType === 5122) v = new DataView(bin.buffer, bin.byteOffset + p, 2).getInt16(0, true);
        else v = bin[p];
        out[i * numComp + c] = v;
      }
    }
    return { data: out, count: acc.count, numComp: numComp, type: acc.type };
  }

  function buildGLTF(json, bin) {
    var materials = (json.materials || []).map(function (m) {
      var pbr = m.pbrMetallicRoughness || {};
      var col = pbr.baseColorFactor || [1, 1, 1, 1];
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(col[0], col[1], col[2]),
        roughness: (pbr.metallicRoughnessTexture ? 0.7 : (pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.8)),
        metalness: pbr.metallicFactor != null ? pbr.metallicFactor : 0.05
      });
      mat.name = m.name || '';
      mat.transparent = col[3] < 1;
      mat.opacity = col[3];
      return mat;
    });
    if (!materials.length) materials = [new THREE.MeshStandardMaterial({ color: 0xcccccc })];

    var nodeObjs = [];
    var skins = [];
    (json.skins || []).forEach(function (skin) {
      var ibm = accessorArray(json, bin, skin.inverseBindMatrices).data;
      skins.push({ joints: skin.joints, ibm: ibm, skeleton: skin.skeleton });
    });

    function buildNode(idx) {
      var nd = json.nodes[idx];
      var obj;
      var isJoint = skins.some(function (s) { return s.joints.indexOf(idx) >= 0; });
      if (isJoint) obj = new THREE.Bone();
      else obj = new THREE.Object3D();
      obj.name = nd.name || ('node' + idx);
      if (nd.matrix) {
        var m = new THREE.Matrix4().fromArray(nd.matrix);
        m.decompose(obj.position, obj.quaternion, obj.scale);
      } else {
        if (nd.translation) obj.position.fromArray(nd.translation);
        if (nd.rotation) obj.quaternion.fromArray(nd.rotation);
        if (nd.scale) obj.scale.fromArray(nd.scale);
      }
      nodeObjs[idx] = obj;
      if (nd.mesh != null) {
        var meshDef = json.meshes[nd.mesh];
        meshDef.primitives.forEach(function (prim) {
          var geo = new THREE.BufferGeometry();
          var pos = accessorArray(json, bin, prim.attributes.POSITION);
          geo.setAttribute('position', new THREE.BufferAttribute(pos.data, 3));
          if (prim.attributes.NORMAL) {
            var n = accessorArray(json, bin, prim.attributes.NORMAL);
            geo.setAttribute('normal', new THREE.BufferAttribute(n.data, 3));
          }
          if (prim.attributes.TEXCOORD_0) {
            var uv = accessorArray(json, bin, prim.attributes.TEXCOORD_0);
            geo.setAttribute('uv', new THREE.BufferAttribute(uv.data, 2));
          }
          if (prim.attributes.JOINTS_0) {
            var j = accessorArray(json, bin, prim.attributes.JOINTS_0);
            // joints may be ubyte/ushort: keep as float attribute via Uint16
            var jarr = new Uint16Array(j.data.length);
            for (var i = 0; i < j.data.length; i++) jarr[i] = j.data[i];
            geo.setAttribute('skinIndex', new THREE.BufferAttribute(jarr, 4));
          }
          if (prim.attributes.WEIGHTS_0) {
            var w = accessorArray(json, bin, prim.attributes.WEIGHTS_0);
            geo.setAttribute('skinWeight', new THREE.BufferAttribute(w.data, 4));
          }
          if (prim.indices != null) {
            var ia = accessorArray(json, bin, prim.indices);
            geo.setIndex(new THREE.BufferAttribute(new Uint32Array(ia.data), 1));
          }
          var mat = materials[prim.material != null ? prim.material : 0];
          var mesh;
          if (nd.skin != null) {
            mesh = new THREE.SkinnedMesh(geo, mat);
            mesh.userData.skinIndex = nd.skin;
          } else {
            mesh = new THREE.Mesh(geo, mat);
          }
          mesh.name = (meshDef.name || 'mesh') + '_' + idx;
          obj.add(mesh);
        });
      }
      (nd.children || []).forEach(function (ci) { obj.add(buildNode(ci)); });
      return obj;
    }

    var scene = new THREE.Group();
    scene.name = 'glb-root';
    var roots = json.scenes && json.scenes[0] ? json.scenes[0].nodes : [];
    roots.forEach(function (ri) { scene.add(buildNode(ri)); });

    // Update world matrices BEFORE binding: bind() freezes the mesh's
    // matrixWorld as the bind matrix, and at build time it is still
    // identity. (Rev 3: the bind matrix was identity, so the skinning
    // used mesh-space vertices against armature-scaled bones.)
    scene.updateMatrixWorld(true);

    // Bind skins. The bind matrix MUST be identity for this file, not
    // the mesh's world matrix: the file's inverse bind matrices already
    // map mesh-local vertices into joint space (they carry the 1/69
    // armature factor), so passing the bind-time world matrix (69.18x)
    // would inflate every vertex 69x. With an identity bind matrix, and
    // bindMode 'attached' (bindMatrixInverse = current world inverse),
    // the shader reduces to the glTF formula jointWorld x IBM x vertex.
    // (Rev 4: the 69.18 bind matrix was the giant-feet bug — the head
    // vertex landed at world y=117 instead of y=3.)
    scene.traverse(function (o) {
      if (o.isSkinnedMesh && o.userData.skinIndex != null) {
        var sk = skins[o.userData.skinIndex];
        var bones = sk.joints.map(function (ji) { return nodeObjs[ji]; });
        var ibms = [];
        for (var i = 0; i < sk.joints.length; i++) {
          ibms.push(new THREE.Matrix4().fromArray(sk.ibm, i * 16));
        }
        var skeleton = new THREE.Skeleton(bones, ibms);
        o.bind(skeleton, new THREE.Matrix4());
        o.userData.skeleton = skeleton;
      }
    });

    // Animations.
    var clips = (json.animations || []).map(function (anim) {
      var tracks = [];
      anim.channels.forEach(function (ch) {
        var sampler = anim.samplers[ch.sampler];
        var times = accessorArray(json, bin, sampler.input).data;
        var vals = accessorArray(json, bin, sampler.output);
        var node = nodeObjs[ch.target.node];
        if (!node) return;
        var path = ch.target.path;
        var name = node.name;
        if (path === 'translation') tracks.push(new THREE.VectorKeyframeTrack(name + '.position', times, vals.data));
        else if (path === 'rotation') tracks.push(new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, vals.data));
        else if (path === 'scale') tracks.push(new THREE.VectorKeyframeTrack(name + '.scale', times, vals.data));
      });
      return new THREE.AnimationClip(anim.name || 'clip', -1, tracks);
    });

    return { scene: scene, clips: clips, nodes: nodeObjs, json: json };
  }

  // ---------- retint ----------
  // Recolour named materials on a loaded model (e.g. jacket orange).
  PH.retint = function (root, map) {
    root.traverse(function (o) {
      if (!o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) {
        if (m && m.name && map[m.name] != null) {
          m.color = new THREE.Color(map[m.name]);
          if (m.name === 'MateoJacket') { m.roughness = 0.85; m.metalness = 0.0; }
        }
      });
    });
  };

  // ---------- HUD setters ----------
  function el(id) { return document.getElementById(id); }
  function setText(id, v) { var n = el(id); if (n) n.textContent = v; }
  function setBar(id, pct) { var n = el(id); if (n) n.style.width = PH.clamp(pct, 0, 100) + '%'; }

  PH.hud = {
    setObjective: function (o) {
      if (!o) return;
      setText('obj-title', o.title || '');
      setText('obj-stage', o.stage || '');
      setBar('obj-bar', o.progress != null ? o.progress : 0);
      setText('obj-timer', o.timer || '');
      setText('obj-text', o.text || '');
      setText('obj-next', o.next || '');
    },
    setWanted: function (n) {
      var stars = el('stars'); if (!stars) return;
      var kids = stars.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].classList.toggle('lit', i < n);
      }
      var w = el('wanted-panel');
      if (w) w.classList.toggle('hot', n >= 3);
    },
    setMoney: function (v) { setText('money', '$' + v.toLocaleString('en-US')); },
    setHealth: function (v) { setBar('health-bar', v); setText('health-num', Math.round(v)); },
    setArmor: function (v) { setBar('armor-bar', v); setText('armor-num', Math.round(v)); },
    setAmmo: function (cur, max) { setText('ammo-pistol', cur + '/' + max); },
    setSpeed: function (kmh) { setText('speed-num', Math.round(kmh)); },
    setCar: function (s) { setText('car-status', s); },
    setRadio: function (s) { setText('radio-text', s); },
    setDispatch: function (rows) {
      var box = el('dispatch-rows'); if (!box) return;
      var panel = el('dispatch-panel');
      if (!rows || !rows.length) { if (panel) panel.style.display = 'none'; box.innerHTML = ''; return; }
      if (panel) panel.style.display = 'block';
      box.innerHTML = rows.map(function (r) {
        return '<div class="drow"><span class="chip">' + r.tactic + '</span>' +
          '<span class="dunit">' + r.unit + '</span>' +
          '<span class="drole">' + r.role + '</span>' +
          '<span class="ddist">' + r.dist + 'm</span></div>';
      }).join('');
    },
    setWeapon: function (active) {
      var slots = document.querySelectorAll('.wslot');
      slots.forEach(function (s) {
        s.classList.toggle('active', s.getAttribute('data-slot') === active);
      });
    },
    setDialog: function (who, name, text) {
      var d = el('dialog'); if (!d) return;
      if (!text) { d.style.display = 'none'; return; }
      d.style.display = 'flex';
      var p = el('dialog-portrait');
      if (p) { p.textContent = who === 'kira' ? 'K' : 'M'; p.className = 'portrait ' + who; }
      setText('dialog-name', name);
      setText('dialog-text', text);
    },
    toast: function (msg) {
      var t = el('toast'); if (!t) return;
      t.textContent = msg; t.style.opacity = '1';
      clearTimeout(t._tm);
      t._tm = setTimeout(function () { t.style.opacity = '0'; }, 2600);
    }
  };

  // ---------- minimap (round 2D canvas) ----------
  PH.drawMinimap = function (canvas, st) {
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, R = W / 2 - 4;
    // world bounds mapped into the circle
    var x0 = -110, x1 = 120, z0 = -130, z1 = 130;
    function mx(x) { return cx + ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) * R; }
    function mz(z) { return cy + ((z - (z0 + z1) / 2) / ((z1 - z0) / 2)) * R; }
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    // base
    g.fillStyle = '#101826'; g.fillRect(0, 0, W, H);
    // sea (west)
    g.fillStyle = '#123a5c'; g.fillRect(0, 0, mx(-102), H);
    // sand strip
    g.fillStyle = '#c9a86a'; g.fillRect(mx(-102), 0, mx(-28) - mx(-102), H);
    // city blocks (40-unit grid) slightly lighter than base
    g.fillStyle = '#232f45';
    for (var gx = -20; gx <= 160; gx += 40) {
      for (var gz = -160; gz <= 120; gz += 40) {
        g.fillRect(mx(gx), mz(gz), mx(gx + 32) - mx(gx), mz(gz + 32) - mz(gz));
      }
    }
    // fine 20-unit grid lines
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
    for (var i = -100; i <= 160; i += 20) {
      g.beginPath(); g.moveTo(mx(i), 0); g.lineTo(mx(i), H); g.stroke();
      g.beginPath(); g.moveTo(0, mz(i)); g.lineTo(W, mz(i)); g.stroke();
    }
    // roads: dark casing then bright core
    function road(xa, za, xb, zb, wdt) {
      g.strokeStyle = '#05070c'; g.lineWidth = wdt + 3;
      g.beginPath(); g.moveTo(mx(xa), mz(za)); g.lineTo(mx(xb), mz(zb)); g.stroke();
      g.strokeStyle = '#8fa3bd'; g.lineWidth = wdt;
      g.beginPath(); g.moveTo(mx(xa), mz(za)); g.lineTo(mx(xb), mz(zb)); g.stroke();
    }
    [-120, -80, -40, 0, 40, 80, 120].forEach(function (z) { road(-9, z, 170, z, 3); });
    road(-20, -170, -20, 170, 4);
    // Sunset Blvd centre line (yellow)
    g.strokeStyle = '#e8c832'; g.lineWidth = 1.4; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(mx(-20), mz(-170)); g.lineTo(mx(-20), mz(170)); g.stroke();
    g.setLineDash([]);
    // pier
    g.fillStyle = '#8a6a42';
    g.fillRect(mx(-88), mz(35.5), mx(-28) - mx(-88), mz(44.5) - mz(35.5));
    // objective diamond + pulsing ring
    if (st && st.objective) {
      var ox = mx(st.objective.x), oy = mz(st.objective.z);
      var pulse = 1 + 0.25 * Math.sin((st.time || 0) * 3);
      g.strokeStyle = 'rgba(255,210,60,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox, oy, 11 * pulse, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ffd23c';
      g.beginPath();
      g.moveTo(ox, oy - 9); g.lineTo(ox + 9, oy); g.lineTo(ox, oy + 9); g.lineTo(ox - 9, oy);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a5b00'; g.lineWidth = 1.5; g.stroke();
    }
    // police dots (blue, flashing red when wanted)
    if (st && st.police) {
      st.police.forEach(function (p, i) {
        var blink = st.wanted > 0 && (Math.floor((st.time || 0) * 2 + i) % 2 === 0);
        g.fillStyle = blink ? '#ff3b30' : '#3b82f6';
        g.beginPath(); g.arc(mx(p.x), mz(p.z), 4.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
      });
    }
    // player arrow (big orange, white frame, rotates with heading)
    if (st && st.player) {
      var px = mx(st.player.x), py = mz(st.player.z);
      var hd = st.player.heading || 0;
      g.save();
      g.translate(px, py); g.rotate(hd);
      g.fillStyle = '#ff7a1a';
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -11); g.lineTo(8, 8); g.lineTo(0, 4); g.lineTo(-8, 8);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
    // ring border
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // north arrow + N, top centre
    g.fillStyle = '#fff'; g.font = 'bold 13px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath();
    g.moveTo(cx, 12); g.lineTo(cx + 5, 22); g.lineTo(cx - 5, 22); g.closePath(); g.fill();
    g.fillText('N', cx, 30);
    // label
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 11px Arial';
    g.fillText('SUNSET BAY', cx, H - 12);
  };
})();
