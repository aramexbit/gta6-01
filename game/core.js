// PIER HEAT — Sunset Bay v6.8
// core.js — shared foundation: seeded random, canvas textures, the small
// hand-written GLB loader for the Mateo character model, HUD helpers and
// the 2D minimap painter. Everything here is original code for this entry.
(function () {
  'use strict';
  var PH = window.PH = window.PH || {};
  PH.VERSION = '6.9';

  // ---------- tiny DOM helper ----------
  PH.el = function (id) { return document.getElementById(id); };

  // ---------- seeded random (mulberry32) ----------
  PH.setSeed = function (seed) {
    var s = (seed >>> 0) || 1;
    PH.rng = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PH.setSeed(1);
  PH.rand = function (a, b) { return a + PH.rng() * (b - a); };
  PH.randInt = function (a, b) { return Math.floor(PH.rand(a, b + 1)); };
  PH.pick = function (arr) { return arr[Math.floor(PH.rng() * arr.length)]; };
  PH.chance = function (p) { return PH.rng() < p; };

  // ---------- canvas textures ----------
  PH.makeCanvasTexture = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Shop-front sign: bold original store name on a coloured board.
  PH.signTexture = function (name, bg, fg) {
    return PH.makeCanvasTexture(512, 128, function (g, w, h) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = fg;
      g.font = '900 62px Arial Black, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var label = name;
      var size = 62;
      while (g.measureText(label).width > w - 40 && size > 26) {
        size -= 4; g.font = '900 ' + size + 'px Arial Black, Arial, sans-serif';
      }
      g.fillText(label, w / 2, h / 2 + 2);
    });
  };

  // Licence plate texture.
  PH.plateTexture = function (text) {
    return PH.makeCanvasTexture(256, 64, function (g, w, h) {
      g.fillStyle = '#f4f6f2'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1d4f9c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#1d4f9c'; g.font = '700 13px Arial, sans-serif';
      g.textAlign = 'center'; g.fillText('SUNSET BAY', w / 2, 16);
      g.fillStyle = '#14181d'; g.font = '900 34px Arial Black, Arial, sans-serif';
      g.fillText(text, w / 2, 48);
    });
  };

  // Soft radial glow / muzzle-flash star texture.
  PH.flashTexture = function () {
    return PH.makeCanvasTexture(128, 128, function (g, w, h) {
      var grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,255,230,1)');
      grad.addColorStop(0.25, 'rgba(255,200,60,0.95)');
      grad.addColorStop(0.6, 'rgba(255,120,20,0.55)');
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,220,0.95)';
      g.beginPath();
      g.moveTo(64, 4); g.lineTo(72, 56); g.lineTo(124, 64); g.lineTo(72, 72);
      g.lineTo(64, 124); g.lineTo(56, 72); g.lineTo(4, 64); g.lineTo(56, 56);
      g.closePath(); g.fill();
    });
  };

  // ---------- minimal GLB loader (glTF 2.0, no textures) ----------
  // Reads the binary container, builds BufferGeometry per primitive, wires
  // the skin into a THREE.Skeleton and rebuilds the animation clips so the
  // model's own walk / run / idle / aim / fire takes drive the bones.
  PH.loadMateo = function (url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('mateo fetch HTTP ' + res.status);
      return res.arrayBuffer();
    }).then(function (buf) {
      var dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB file');
      var jsonLen = dv.getUint32(12, true);
      var json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
      var off = 20 + jsonLen;
      var binLen = dv.getUint32(off, true);
      var bin = new Uint8Array(buf, off + 8, binLen);

      var COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
      var NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

      function accessorData(idx) {
        var a = json.accessors[idx];
        var bv = json.bufferViews[a.bufferView];
        var start = (bv.byteOffset || 0) + (a.byteOffset || 0);
        var count = NCOMP[a.type] * a.count;
        var Arr = COMP[a.componentType];
        var unit = Arr.BYTES_PER_ELEMENT * NCOMP[a.type];
        if (!bv.byteStride || bv.byteStride === unit) {
          return new Arr(bin.buffer, bin.byteOffset + start, count);
        }
        var out = new Arr(count);
        for (var i = 0; i < a.count; i++) {
          var src = new Arr(bin.buffer, bin.byteOffset + start + i * bv.byteStride, NCOMP[a.type]);
          out.set(src, i * NCOMP[a.type]);
        }
        return out;
      }

      var mats = (json.materials || []).map(function (m) {
        var pbr = m.pbrMetallicRoughness || {};
        var c = pbr.baseColorFactor || [1, 1, 1, 1];
        return new THREE.MeshStandardMaterial({
          name: m.name || '',
          color: new THREE.Color(c[0], c[1], c[2]),
          roughness: (pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.85),
          metalness: (pbr.metallicFactor != null ? pbr.metallicFactor : 0.0),
          transparent: c[3] < 1,
          opacity: c[3]
        });
      });

      var nodeObjs = [];
      var skinned = [];
      var ATTR = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };

      function buildNode(i) {
        var n = json.nodes[i];
        var o = new THREE.Object3D();
        o.name = n.name || ('node' + i);
        if (n.matrix) {
          new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
        } else {
          if (n.translation) o.position.fromArray(n.translation);
          if (n.rotation) o.quaternion.fromArray(n.rotation);
          if (n.scale) o.scale.fromArray(n.scale);
        }
        nodeObjs[i] = o;
        if (n.mesh != null) {
          var meshDef = json.meshes[n.mesh];
          meshDef.primitives.forEach(function (prim) {
            var geo = new THREE.BufferGeometry();
            Object.keys(prim.attributes).forEach(function (key) {
              var acc = json.accessors[prim.attributes[key]];
              var data = accessorData(prim.attributes[key]);
              geo.setAttribute(ATTR[key] || key.toLowerCase(), new THREE.BufferAttribute(data, NCOMP[acc.type]));
            });
            if (prim.indices != null) geo.setIndex(new THREE.BufferAttribute(accessorData(prim.indices), 1));
            var mat = mats[prim.material || 0];
            var mesh = (n.skin != null)
              ? new THREE.SkinnedMesh(geo, mat)
              : new THREE.Mesh(geo, mat);
            mesh.name = (meshDef.name || 'mesh') + '_' + (prim.material || 0);
            mesh.castShadow = true;
            o.add(mesh);
            if (n.skin != null) skinned.push({ mesh: mesh, skinIndex: n.skin });
          });
        }
        (n.children || []).forEach(function (c) { o.add(buildNode(c)); });
        return o;
      }

      var group = new THREE.Group();
      group.name = 'MateoRoot';
      (json.scenes[0].nodes || []).forEach(function (rootIdx) { group.add(buildNode(rootIdx)); });

      // The file's armature root carries a large uniform scale (about
      // 69x): the bone translations are tiny in its local space while the
      // mesh vertices are already full-size, so a stock skin bind would
      // pivot every limb about the mesh origin (arms out like wings).
      // Bake the root scale into the bone translations and drop it from
      // the root, so bones and mesh share one space. The file's inverse
      // bind matrices stay valid because no bone world matrix changes.
      var rootScale = 1;
      (json.scenes[0].nodes || []).forEach(function (rootIdx) {
        var rn = json.nodes[rootIdx];
        if (rn.scale && rn.scale[0] === rn.scale[1] && rn.scale[1] === rn.scale[2] && rn.scale[0] !== 1) {
          rootScale = rn.scale[0];
        }
      });
      if (rootScale !== 1) {
        group.traverse(function (o) {
          if (o !== group) o.position.multiplyScalar(rootScale);
        });
        (json.scenes[0].nodes || []).forEach(function (rootIdx) {
          nodeObjs[rootIdx].scale.set(1, 1, 1);
        });
      }
      group.updateMatrixWorld(true);

      // Wire skins: bones live in the node tree already, bind them here.
      skinned.forEach(function (entry) {
        var skin = json.skins[entry.skinIndex];
        var bones = skin.joints.map(function (j) { return nodeObjs[j]; });
        var ibm = accessorData(skin.inverseBindMatrices);
        var inverses = [];
        for (var i = 0; i < bones.length; i++) {
          inverses.push(new THREE.Matrix4().fromArray(ibm, i * 16));
        }
        entry.mesh.bind(new THREE.Skeleton(bones, inverses));
      });

      // Rebuild animation clips from the file's own channels.
      var clips = {};
      (json.animations || []).forEach(function (anim, ai) {
        var tracks = [];
        anim.channels.forEach(function (ch) {
          var sampler = anim.samplers[ch.sampler];
          var nodeName = (json.nodes[ch.target.node] || {}).name;
          if (!nodeName) return;
          var times = accessorData(sampler.input);
          var values = accessorData(sampler.output);
          // glTF names the paths translation / rotation / scale; three.js
          // binds them as position / quaternion / scale.
          var path = ch.target.path === 'rotation' ? 'quaternion'
            : (ch.target.path === 'translation' ? 'position' : ch.target.path);
          var Track = (path === 'quaternion') ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
          // Copy the keyframe values out of the shared GLB buffer; position
          // keys also need the baked root scale (see above) to stay in
          // mesh units.
          var vals = new Float32Array(values);
          if (path === 'position' && rootScale !== 1) {
            for (var vi = 0; vi < vals.length; vi++) vals[vi] *= rootScale;
          }
          tracks.push(new Track(nodeName + '.' + path, times, vals));
        });
        if (tracks.length) {
          var clip = new THREE.AnimationClip(anim.name || ('anim' + ai), -1, tracks);
          clips[clip.name] = clip;
        }
      });

      return { group: group, clips: clips, nodeObjs: nodeObjs };
    });
  };

  // Recolour a loaded Mateo copy (used for the handler Kira: same body, new outfit).
  PH.retint = function (group, map) {
    group.traverse(function (o) {
      if (o.isMesh || o.isSkinnedMesh) {
        var m = o.material;
        if (m && m.name && map[m.name]) {
          var clone = m.clone();
          clone.color.setHex(map[m.name]);
          o.material = clone;
        }
      }
    });
  };

  // ---------- HUD ----------
  PH.hud = {
    setObjective: function (title, text) {
      var t = PH.el('objTitle'), x = PH.el('objText');
      if (t) t.textContent = title;
      if (x) x.textContent = text;
    },
    setWanted: function (n) {
      var s = PH.el('stars');
      if (!s) return;
      var out = '';
      for (var i = 1; i <= 5; i++) out += (i <= n) ? '★' : '<span class="off">★</span>';
      s.innerHTML = out;
    },
    setVitals: function (hp, armor) {
      var h = PH.el('hpFill'), a = PH.el('arFill');
      if (h) h.style.width = Math.max(0, Math.min(100, hp)) + '%';
      if (a) a.style.width = Math.max(0, Math.min(100, armor)) + '%';
    },
    setAmmo: function (n) { var e = PH.el('ammo'); if (e) e.textContent = n; },
    setSpeed: function (kmh) { var e = PH.el('speed'); if (e) e.textContent = Math.round(kmh); },
    dialog: function (who, line) {
      var d = PH.el('dialog');
      if (!d) return;
      PH.el('dlgWho').textContent = who;
      PH.el('dlgLine').textContent = line;
      d.style.display = 'block';
    },
    hideDialog: function () { var d = PH.el('dialog'); if (d) d.style.display = 'none'; },
    toast: function (msg, ms) {
      var t = PH.el('toast');
      if (!t) return;
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.style.display = 'none'; }, ms || 2600);
    },
    setRadio: function (muted) {
      var b = PH.el('muteBtn');
      if (b) b.textContent = muted ? 'UNMUTE' : 'MUTE';
    }
  };

  // ---------- minimap ----------
  // data: { bounds:{x0,x1,z0,z1}, roads:[{x0,z0,x1,z1,w}], player:{x,z,heading},
  //         police:[{x,z}], objective:{x,z}, wanted, time }
  PH.drawMinimap = function (canvas, data) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var b = data.bounds;
    function px(x) { return (x - b.x0) / (b.x1 - b.x0) * W; }
    function pz(z) { return (z - b.z0) / (b.z1 - b.z0) * H; }
    // base: dark street-map ground — the city reads as streets, not as
    // a grid of building facades. Water west, sand strip, then blocks
    // barely lighter than the ground, so the roads are the subject.
    ctx.fillStyle = '#0a141d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0d3b52'; ctx.fillRect(0, 0, px(-102), H);
    ctx.fillStyle = '#8a744e'; ctx.fillRect(px(-102), 0, px(-28) - px(-102), H);
    ctx.fillStyle = '#152433';
    for (var gx = -10; gx < 160; gx += 40) {
      for (var gz = -160; gz < 160; gz += 40) {
        ctx.fillRect(px(gx + 4), pz(gz + 4), px(gx + 36) - px(gx + 4), pz(gz + 36) - pz(gz + 4));
      }
    }
    // roads: bright, wide, high-contrast lines on the dark ground, each
    // drawn over a darker casing so the edge stays crisp.
    ctx.lineCap = 'round';
    (data.roads || []).forEach(function (r) {
      var lw = Math.max(3, (r.w || 8) / (b.x1 - b.x0) * W * 0.85);
      ctx.strokeStyle = '#05090d'; ctx.lineWidth = lw + 3;
      ctx.beginPath(); ctx.moveTo(px(r.x0), pz(r.z0)); ctx.lineTo(px(r.x1), pz(r.z1)); ctx.stroke();
      ctx.strokeStyle = '#f2f5f7'; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(px(r.x0), pz(r.z0)); ctx.lineTo(px(r.x1), pz(r.z1)); ctx.stroke();
    });
    // Sunset Blvd centre line in yellow so the main avenue stands out.
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px(-20), pz(b.z0)); ctx.lineTo(px(-20), pz(b.z1)); ctx.stroke();
    // pier
    ctx.fillStyle = '#8a6b45'; ctx.fillRect(px(-84), pz(36), px(-28) - px(-84), pz(44) - pz(36));
    // objective marker: big yellow diamond + pulsing ring.
    if (data.objective) {
      var ox = px(data.objective.x), oy = pz(data.objective.z);
      var pulse = 5 + 3 * Math.sin((data.time || 0) * 4);
      ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ox, oy, 12 + pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.strokeStyle = '#20100a'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 11); ctx.lineTo(ox + 10, oy); ctx.lineTo(ox, oy + 11); ctx.lineTo(ox - 10, oy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // police dots (flash when wanted): big, with a white ring.
    var flash = (data.wanted > 0) && (Math.floor((data.time || 0) * 3) % 2 === 0);
    (data.police || []).forEach(function (p) {
      ctx.fillStyle = flash ? '#ff4d4d' : '#4aa8ff';
      ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), 7, 0, Math.PI * 2); ctx.stroke();
    });
    // player arrow: big orange arrow with a white outline.
    if (data.player) {
      var cx = px(data.player.x), cy = pz(data.player.z);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-data.player.heading + Math.PI);
      ctx.fillStyle = '#ff7a1a';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(10, 11); ctx.lineTo(0, 6); ctx.lineTo(-10, 11);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // north + frame label
    ctx.fillStyle = '#fff'; ctx.font = '900 13px Arial, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('N', 8, 16);
    ctx.font = '700 11px Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('SUNSET BAY', 8, H - 8);
  };
})();
