/* Perflex – scène 3D du PC (three.js r152, aucune dépendance externe)
   - rotation automatique continue, glisser pour tourner (inertie qui retombe à la vitesse normale)
   - clic sur une pièce : la caméra s'approche, les autres pièces s'effacent
*/
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  if (!stage || !window.THREE) return;
  var THREE = window.THREE;
  var canvas = stage.querySelector('canvas');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /*  Renderer                                                           */
  /* ------------------------------------------------------------------ */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.useLegacyLights = false;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  var FOV_TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  /* ------------------------------------------------------------------ */
  /*  Environnement (reflets) : studio sombre avec quelques boîtes à lumière */
  /* ------------------------------------------------------------------ */
  (function makeEnv() {
    var s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: 0x0d0a0b, side: THREE.BackSide })));
    function panel(w, h, color, k, pos) {
      var c = new THREE.Color(color).multiplyScalar(k);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]);
      m.lookAt(0, 0, 0);
      s.add(m);
    }
    panel(14, 4, 0xffffff, 5.5, [0, 7, 3]);      // grande boîte au-dessus
    panel(3, 12, 0xcfdcff, 4.0, [-9, 1, 4]);     // liseré froid à gauche
    panel(3, 12, 0xff3d4a, 6.0, [9, 0, -2]);     // liseré rouge à droite
    panel(10, 2, 0xffffff, 1.6, [0, -1, 10]);    // remplissage de face
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(s, 0.035).texture;
    pm.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a1a20, 1.1));
  var warm = new THREE.PointLight(0xff6a72, 12, 9, 1.6); warm.position.set(-0.6, 0.6, 1.6); scene.add(warm);
  var cool = new THREE.PointLight(0xbfd0ff, 16, 9, 1.6); cool.position.set(1.6, 1.2, 2.4); scene.add(cool);
  var key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(3, 6, 8);
  scene.add(key);

  /* ------------------------------------------------------------------ */
  /*  Textures dessinées au canvas                                       */
  /* ------------------------------------------------------------------ */
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c, srgb) {
    var t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  function rand(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function pcbTexture() {
    var c = cv(1024, 1280), g = c.getContext('2d'), r = rand(7);
    g.fillStyle = '#15171c'; g.fillRect(0, 0, c.width, c.height);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (var i = 0; i < 340; i++) {
      var x = Math.floor(r() * 64) * 16, y = Math.floor(r() * 80) * 16;
      g.beginPath(); g.moveTo(x, y);
      var n = 2 + Math.floor(r() * 4);
      for (var k = 0; k < n; k++) {
        var d = Math.floor(r() * 8), len = (2 + Math.floor(r() * 8)) * 16;
        var dx = [1, 0, -1, 0, 1, 1, -1, -1][d], dy = [0, 1, 0, -1, 1, -1, 1, -1][d];
        x += dx * len; y += dy * len; g.lineTo(x, y);
      }
      g.strokeStyle = r() > 0.12 ? '#1f2329' : '#2a2e36';
      g.lineWidth = r() > 0.7 ? 5 : 3; g.stroke();
      g.fillStyle = '#2a2e36'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    }
    for (var j = 0; j < 90; j++) {                       // composants CMS
      var cx = r() * 1000, cy = r() * 1260;
      g.fillStyle = r() > 0.5 ? '#232830' : '#1b1e24';
      g.fillRect(cx, cy, 10 + r() * 14, 6 + r() * 6);
    }
    g.strokeStyle = 'rgba(255,61,74,.35)'; g.lineWidth = 2;  // filet rouge de sérigraphie
    g.strokeRect(14, 14, c.width - 28, c.height - 28);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.font = '600 20px monospace';
    g.fillText('PERFLEX  ATX  REV 1.125', 34, c.height - 34);
    return tex(c);
  }

  function finTexture(vertical, fg, bg) {
    var c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = bg || '#0e0f12'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = fg || '#2b2f37';
    for (var i = 0; i < 256; i += 8) { if (vertical) g.fillRect(i, 0, 4, 256); else g.fillRect(0, i, 256, 4); }
    var t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  function ventTexture() {
    var c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = '#17181c'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#050506';
    for (var y = 8; y < 256; y += 16) for (var x = 8; x < 256; x += 16) { g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); }
    var t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  var LOGO_W = new Path2D("M53 0 53 179 51 181 0 181 0 465 101 466 101 677 298 488 505 688 505 466 599 465 599 181 548 181 546 179 547 1 341 158 315 229 459 378 458 595 302 444 155 588 154 428 39 427 39 216 245 215 282 179 281 176ZM350 215 560 216 559 428 498 427 498 369 354 222ZM508 79 508 179 506 181 375 180 506 78ZM92 79 107 88 226 180 93 181 91 179Z");
  var LOGO_R = new Path2D("M339 160 239 253 145 351 264 352 266 354 239 418 196 529 299 410 376 317 282 316Z");
  function drawLogo(g, cx, cy, s) {          // s = hauteur du logo en pixels
    g.save(); g.translate(cx, cy); var k = s / 689; g.scale(k, k); g.translate(-300.0, -344.5);
    g.fillStyle = '#f5f5f5'; g.fill(LOGO_W, 'evenodd');
    g.fillStyle = '#e1001a'; g.fill(LOGO_R);
    g.restore();
  }
  function logoTexture(bg) {
    var c = cv(256, 256), g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 256, 256); }
    drawLogo(g, 128, 128, 168);
    return tex(c);
  }
  function textTexture(text, w, h, opts) {
    opts = opts || {};
    var c = cv(w, h), g = c.getContext('2d');
    g.fillStyle = opts.bg || 'rgba(0,0,0,0)'; g.fillRect(0, 0, w, h);
    g.fillStyle = opts.color || '#e9e4e5';
    g.font = (opts.weight || 600) + ' ' + (opts.size || h * 0.5) + 'px ' + (opts.font || 'Poppins, "Segoe UI", sans-serif');
    g.textBaseline = 'middle';
    g.textAlign = opts.align || 'left';
    if ('letterSpacing' in g) g.letterSpacing = (opts.spacing || 0) + 'px';
    g.fillText(text, opts.align === 'center' ? w / 2 : (opts.x || 0), h / 2 + 2);
    return tex(c);
  }

  /* ------------------------------------------------------------------ */
  /*  Parties cliquables + fabrique de matériaux                          */
  /* ------------------------------------------------------------------ */
  var pc = new THREE.Group();          // tourne sur Y
  var pivot = new THREE.Group();       // inclinaison + décalage de mise au point
  pivot.add(pc);
  scene.add(pivot);

  var parts = {};
  var pickables = [];
  var glows = [];                      // matériaux qui « respirent »
  var fans = [];

  function addPart(id, label) {
    var g = new THREE.Group(); g.name = id;
    parts[id] = { id: id, group: g, mats: [], dim: 0, dimT: 0, hover: 0, label: label };
    pc.add(g);
    return parts[id];
  }
  function mat(part, o) {
    var cfg = {}; for (var k in o) if (k !== 'glow' && k !== 'noPick') cfg[k] = o[k];
    if (o.glow) { cfg.emissive = 0xff1a2e; cfg.emissiveIntensity = (o.emissiveIntensity || 1) * 0.5; }
    var m = new THREE.MeshStandardMaterial(cfg);
    m.userData.base = { opacity: o.opacity === undefined ? 1 : o.opacity, transparent: !!o.transparent, depthWrite: m.depthWrite };
    parts[part].mats.push(m);
    if (o.glow) glows.push({ m: m, base: m.emissiveIntensity });
    return m;
  }
  function mesh(part, geo, o, parent, pos, rot) {
    var m = new THREE.Mesh(geo, mat(part, o));
    m.userData.part = part;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    (parent || parts[part].group).add(m);
    if (!o.noPick) pickables.push(m);
    return m;
  }

  /* géométries utilitaires */
  function rrShape(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function rbox(w, h, d, r, bv, holes) {
    r = r === undefined ? 0.04 : r; bv = bv === undefined ? 0.012 : bv;
    var s = rrShape(w - 2 * bv, h - 2 * bv, Math.max(r - bv, 0.002));
    (holes || []).forEach(function (hc) {
      var p = new THREE.Path(); p.absarc(hc[0], hc[1], hc[2] + bv, 0, Math.PI * 2, true); s.holes.push(p);
    });
    var g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 20 });
    g.translate(0, 0, -(d - 2 * bv) / 2);
    return g;
  }

  /* ventilateur (face +Z) */
  var bladeGeo = (function () {
    var r = 1, s = new THREE.Shape();
    s.moveTo(0.16, -0.05);
    s.bezierCurveTo(0.5, -0.2, 0.85, -0.22, 0.96, -0.08);
    s.bezierCurveTo(0.99, 0.1, 0.8, 0.3, 0.5, 0.26);
    s.bezierCurveTo(0.3, 0.24, 0.2, 0.16, 0.16, 0.1);
    s.lineTo(0.16, -0.05);
    return new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 10 });
  })();
  function makeFan(part, r, parent, pos, rot, o) {
    o = o || {};
    var g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(g);
    var rotor = new THREE.Group(); g.add(rotor);
    var n = o.blades || 9;
    var bm = mat(part, { color: 0x15171b, metalness: 0.5, roughness: 0.4 });
    for (var i = 0; i < n; i++) {
      var piv = new THREE.Group(); piv.rotation.z = (i / n) * Math.PI * 2; rotor.add(piv);
      var b = new THREE.Mesh(bladeGeo, bm); b.scale.set(r, r, 1); b.rotation.x = 0.55; b.userData.part = part; piv.add(b); pickables.push(b);
    }
    var hub = mesh(part, new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.05, 40), { color: 0x0e0f12, metalness: 0.8, roughness: 0.3 }, rotor, [0, 0, 0.012], [Math.PI / 2, 0, 0]);
    mesh(part, new THREE.CylinderGeometry(r * 0.1, r * 0.1, 0.055, 24), { color: 0x16181d, emissive: 0xff3d4a, emissiveIntensity: 0.9, glow: true, metalness: 0.2, roughness: 0.5 }, rotor, [0, 0, 0.013], [Math.PI / 2, 0, 0]);
    if (o.frame !== false) {
      var fw = r * 2 + 0.08, fs = rrShape(fw, fw, 0.05);
      var hole = new THREE.Path(); hole.absarc(0, 0, r * 1.0, 0, Math.PI * 2, true); fs.holes.push(hole);
      var fg = new THREE.ExtrudeGeometry(fs, { depth: 0.09, bevelEnabled: false, curveSegments: 40 });
      fg.translate(0, 0, -0.05);
      mesh(part, fg, { color: 0x101114, metalness: 0.4, roughness: 0.55 }, g);
    }
    mesh(part, new THREE.TorusGeometry(r * 0.985, 0.012, 8, 72), { color: 0x200507, emissive: 0xff3d4a, emissiveIntensity: 1.6, glow: true, noPick: true }, g, [0, 0, 0.032]);
    fans.push({ rotor: rotor, speed: o.speed || 9 });
    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  Construction du PC                                                 */
  /*  repère : X = arrière→avant, Y = haut, Z = vers la vitre latérale     */
  /* ------------------------------------------------------------------ */
  var BZ = -0.5;                                 // plan de la carte mère
  var steel = { color: 0x1c1d21, metalness: 0.85, roughness: 0.38 };
  var alu = { color: 0x24272d, metalness: 0.9, roughness: 0.34 };
  var redAnod = { color: 0xb3111f, metalness: 0.75, roughness: 0.4 };

  addPart('case', 'Boîtier');
  addPart('mobo', 'Carte mère');
  addPart('cpu', 'Processeur');
  addPart('ram', 'Mémoire vive');
  addPart('gpu', 'Carte graphique');
  addPart('ssd', 'Stockage');
  addPart('psu', 'Alimentation');
  addPart('cool', 'Refroidissement');          // décor (non cliquable)

  /* --- boîtier --- */
  (function () {
    var P = 'case', G = parts.case.group;
    [[-2.3, -1.0], [2.3, -1.0], [-2.3, 1.0], [2.3, 1.0]].forEach(function (c) {
      mesh(P, new THREE.BoxGeometry(0.1, 4.0, 0.1), steel, G, [c[0], 0.0, c[1]]);
    });
    mesh(P, rbox(4.7, 0.12, 2.1, 0.05), steel, G, [0, 2.0 + 0.0, 0]);                       // fond de toit
    var roof = mesh(P, rbox(4.7, 0.16, 2.1, 0.05), { color: 0x17181c, metalness: 0.7, roughness: 0.5, map: ventTexture() }, G, [0, 2.3, 0]);
    roof.material.map.repeat.set(10, 5);
    mesh(P, new THREE.BoxGeometry(4.5, 0.03, 0.03), { color: 0xff3d4a, emissive: 0xff3d4a, emissiveIntensity: 1.8, glow: true, noPick: true }, G, [0, 2.205, 1.03]);
    // plateau de la carte mère (arrière de la carte, visible côté vitre arrière)
    mesh(P, rbox(2.9, 3.35, 0.04, 0.05), { color: 0x131417, metalness: 0.8, roughness: 0.5 }, G, [-0.7, 0.05, BZ - 0.05]);
    mesh(P, new THREE.CylinderGeometry(0.36, 0.36, 0.05, 40), { color: 0x050506, metalness: 0.5, roughness: 0.6 }, G, [-0.85, 0.85, BZ - 0.075], [Math.PI / 2, 0, 0]);
    var back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat(P, { map: logoTexture(), transparent: true, metalness: 0.2, roughness: 0.6, emissive: 0xffffff, emissiveMap: logoTexture(), emissiveIntensity: 0.6, noPick: true }));
    back.position.set(-1.0, -0.55, BZ - 0.075); back.rotation.y = Math.PI; G.add(back);
    // câbles côté arrière
    var cableM = { color: 0x0a0a0c, roughness: 0.85, metalness: 0.1 };
    [[0.5, 0.16], [0.65, 0.2], [0.8, 0.24]].forEach(function (p, i) {
      var c = new THREE.CatmullRomCurve3([new THREE.Vector3(p[0] + 0.1 * i, -1.6, BZ - 0.18), new THREE.Vector3(p[0], -0.8, BZ - 0.32 - p[1] * 0.3), new THREE.Vector3(p[0] - 0.1, 0.6, BZ - 0.3 - p[1] * 0.3), new THREE.Vector3(p[0] - 0.35, 1.45, BZ - 0.12)]);
      mesh(P, new THREE.TubeGeometry(c, 40, 0.06, 8), cableM, G);
    });
  })();

  /* verres (non sélectionnables) */
  (function () {
    var G = parts.case.group;
    var gm = { color: 0xb8c6d8, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6, noPick: true };
    function pane(w, h, pos, ry) {
      var m = mesh('case', new THREE.PlaneGeometry(w, h), gm, G, pos, [0, ry, 0]);
      m.raycast = function () { };
    }
    pane(4.5, 4.0, [0, 0, 1.0], 0);
    pane(4.5, 4.0, [0, 0, -1.0], 0);
    pane(2.0, 4.0, [2.3, 0, 0], Math.PI / 2);
    pane(2.0, 4.0, [-2.3, 0, 0], Math.PI / 2);
  })();

  /* --- alimentation / socle --- */
  (function () {
    var P = 'psu', G = parts.psu.group;
    mesh(P, rbox(4.7, 0.72, 2.1, 0.06), { color: 0x16171b, metalness: 0.75, roughness: 0.42 }, G, [0, -2.0, 0]);
    mesh(P, new THREE.BoxGeometry(4.5, 0.025, 0.02), { color: 0xff3d4a, emissive: 0xff3d4a, emissiveIntensity: 1.6, glow: true, noPick: true }, G, [0, -2.2, 1.05]);
    var lab = textTexture('850 W   ·   80 PLUS GOLD   ·   MODULAIRE', 1024, 96, { color: '#c9c3c4', size: 34, spacing: 5, weight: 500, font: 'Consolas, "Courier New", monospace' });
    [[1.062, 0], [-1.062, Math.PI]].forEach(function (s) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.24), mat(P, { map: lab, transparent: true, roughness: 0.5, metalness: 0.0, noPick: true }));
      m.position.set(-1.0, -2.0, s[0]); m.rotation.y = s[1]; G.add(m);
    });
    var lg = [[1.062, 0], [-1.062, Math.PI]];
    lg.forEach(function (s) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), mat(P, { map: logoTexture(), transparent: true, roughness: 0.5, metalness: 0, emissive: 0xffffff, emissiveMap: logoTexture(), emissiveIntensity: 0.9, noPick: true }));
      m.position.set(1.7, -2.0, s[0]); m.rotation.y = s[1]; G.add(m);
    });
    [[-2.0], [2.0]].forEach(function (p) {            // pieds
      [-0.7, 0.7].forEach(function (z) { mesh(P, new THREE.CylinderGeometry(0.1, 0.12, 0.14, 20), { color: 0x0b0b0d, metalness: 0.3, roughness: 0.6 }, G, [p[0], -2.43, z]); });
    });
  })();

  /* --- carte mère --- */
  (function () {
    var P = 'mobo', G = parts.mobo.group;
    var pcbTex = pcbTexture();
    mesh(P, new THREE.BoxGeometry(2.44, 3.05, 0.05), { color: 0xffffff, map: pcbTex, metalness: 0.35, roughness: 0.55 }, G, [-0.78, 0, BZ]);
    var z0 = BZ + 0.025;
    // capot E/S
    mesh(P, rbox(0.82, 1.0, 0.2, 0.05), { color: 0x14151a, metalness: 0.85, roughness: 0.3 }, G, [-1.6, 1.0, z0 + 0.1]);
    mesh(P, new THREE.BoxGeometry(0.04, 0.9, 0.02), { color: 0xff3d4a, emissive: 0xff3d4a, emissiveIntensity: 1.4, glow: true, noPick: true }, G, [-1.22, 1.0, z0 + 0.205]);
    var shroudLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), mat(P, { map: logoTexture(), transparent: true, roughness: 0.5, metalness: 0, emissive: 0xffffff, emissiveMap: logoTexture(), emissiveIntensity: 1.0, noPick: true }));
    shroudLogo.position.set(-1.62, 1.12, z0 + 0.206); G.add(shroudLogo);
    var shroudTxt = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.08), mat(P, { map: textTexture('PERFLEX  ·  X9', 512, 64, { color: '#8e8587', size: 28, spacing: 6, weight: 600, font: 'Consolas, monospace', align: 'center' }), transparent: true, roughness: 0.6, noPick: true }));
    shroudTxt.position.set(-1.6, 0.72, z0 + 0.206); G.add(shroudTxt);
    // dissipateurs d'alimentation (VRM)
    mesh(P, rbox(0.95, 0.2, 0.2, 0.02), { color: 0xffffff, map: finTexture(true, '#383c45', '#101114'), metalness: 0.9, roughness: 0.35 }, G, [-0.75, 1.4, z0 + 0.1]);
    mesh(P, rbox(0.14, 0.62, 0.2, 0.02), { color: 0xffffff, map: finTexture(false, '#383c45', '#101114'), metalness: 0.9, roughness: 0.35 }, G, [-1.18, 0.85, z0 + 0.1]).visible = true;
    // chipset
    mesh(P, rbox(0.62, 0.62, 0.1, 0.03), alu, G, [-0.1, -1.1, z0 + 0.05]);
    // connecteur 24 broches
    mesh(P, rbox(0.12, 1.3, 0.2, 0.02), { color: 0x0b0b0d, roughness: 0.8, metalness: 0.2 }, G, [0.38, 0.85, z0 + 0.1]);
    // bandeau de connecteurs bas
    mesh(P, new THREE.BoxGeometry(1.6, 0.06, 0.1), { color: 0x0c0c0e, roughness: 0.7, metalness: 0.3 }, G, [-0.6, -1.44, z0 + 0.05]);
  })();

  /* --- processeur (bloc de pompe AIO) --- */
  (function () {
    var P = 'cpu', G = parts.cpu.group, cx = -0.85, cy = 0.85, z0 = BZ + 0.025;
    mesh(P, new THREE.BoxGeometry(0.62, 0.62, 0.05), { color: 0xc9ccd2, metalness: 1.0, roughness: 0.25 }, G, [cx, cy, z0 + 0.025]);     // cadre du socket
    mesh(P, new THREE.CylinderGeometry(0.37, 0.4, 0.2, 64), { color: 0x131418, metalness: 0.85, roughness: 0.3 }, G, [cx, cy, z0 + 0.15], [Math.PI / 2, 0, 0]);
    mesh(P, new THREE.CylinderGeometry(0.34, 0.34, 0.1, 64), { color: 0x0c0d10, metalness: 0.7, roughness: 0.2 }, G, [cx, cy, z0 + 0.27], [Math.PI / 2, 0, 0]);
    mesh(P, new THREE.TorusGeometry(0.31, 0.02, 12, 80), { color: 0x200507, emissive: 0xff3d4a, emissiveIntensity: 2.0, glow: true, noPick: true }, G, [cx, cy, z0 + 0.325]);
    var logo = new THREE.Mesh(new THREE.CircleGeometry(0.26, 48), mat(P, { map: logoTexture('#0a0a0c'), roughness: 0.35, metalness: 0.2, emissive: 0xffffff, emissiveMap: logoTexture('#0a0a0c'), emissiveIntensity: 0.45, noPick: true }));
    logo.position.set(cx, cy, z0 + 0.326); G.add(logo);
    logo.userData.part = 'cpu'; pickables.push(logo);
    // départs de tuyaux
    mesh(P, new THREE.CylinderGeometry(0.075, 0.075, 0.22, 20), { color: 0x0c0d10, metalness: 0.8, roughness: 0.3 }, G, [cx + 0.34, cy + 0.12, z0 + 0.2], [0, 0, Math.PI / 2]);
    mesh(P, new THREE.CylinderGeometry(0.075, 0.075, 0.22, 20), { color: 0x0c0d10, metalness: 0.8, roughness: 0.3 }, G, [cx + 0.34, cy - 0.12, z0 + 0.2], [0, 0, Math.PI / 2]);
  })();

  /* --- mémoire vive --- */
  (function () {
    var P = 'ram', G = parts.ram.group, z0 = BZ + 0.025;
    [-0.3, -0.11, 0.08, 0.27].forEach(function (x, i) {
      var g = new THREE.Group(); g.position.set(x, 0.86, z0 + 0.23); G.add(g);
      var body = mesh(P, rbox(0.1, 1.33, 0.46, 0.015, 0.008), { color: 0xffffff, map: finTexture(false, '#2c3037', '#0c0d10'), metalness: 0.85, roughness: 0.34 }, g);
      body.material.map.repeat.set(1, 5);
      body.rotation.y = 0;
      mesh(P, new THREE.BoxGeometry(0.108, 1.1, 0.012), { color: 0x2a2d34, metalness: 0.9, roughness: 0.3, noPick: true }, g, [0, -0.04, 0.0]).scale.set(1, 1, 1);
      mesh(P, new THREE.BoxGeometry(0.04, 1.2, 0.03), { color: 0x240608, emissive: 0xff3d4a, emissiveIntensity: 1.5, glow: true, noPick: true }, g, [0, 0, 0.235]);
      mesh(P, new THREE.BoxGeometry(0.118, 0.32, 0.05), { color: 0x1b1d23, metalness: 0.9, roughness: 0.3, noPick: true }, g, [0, 0.5, 0.0]);
    });
  })();

  /* --- stockage --- */
  (function () {
    var P = 'ssd', G = parts.ssd.group, z0 = BZ + 0.025;
    // M.2 sous dissipateur
    mesh(P, rbox(0.95, 0.24, 0.04, 0.02), { color: 0x0f0f12, metalness: 0.4, roughness: 0.5 }, G, [-0.85, 0.12, z0 + 0.02]);
    mesh(P, rbox(0.9, 0.2, 0.07, 0.02), { color: 0xffffff, map: finTexture(false, '#3a3e47', '#121317'), metalness: 0.9, roughness: 0.32 }, G, [-0.85, 0.12, z0 + 0.075]);
    mesh(P, new THREE.BoxGeometry(0.86, 0.02, 0.012), { color: 0xff3d4a, emissive: 0xff3d4a, emissiveIntensity: 1.2, glow: true, noPick: true }, G, [-0.85, 0.12, z0 + 0.116]);
    // M.2 nu : PCB, puces mémoire, contrôleur, étiquette
    mesh(P, rbox(0.95, 0.15, 0.025, 0.012), { color: 0x1b2330, metalness: 0.3, roughness: 0.5 }, G, [-0.85, -0.1, z0 + 0.0125 + 0.06]);
    [-0.28, 0.02, 0.3].forEach(function (x, i) {
      mesh(P, new THREE.BoxGeometry(0.2, 0.11, 0.022), { color: 0x08090b, metalness: 0.4, roughness: 0.35 }, G, [-0.85 + x, -0.1, z0 + 0.0125 + 0.06 + 0.024]);
    });
    mesh(P, new THREE.BoxGeometry(0.13, 0.11, 0.018), { color: 0x2a2d34, metalness: 0.9, roughness: 0.3 }, G, [-0.85 - 0.38, -0.1, z0 + 0.0125 + 0.06 + 0.022]);
    mesh(P, new THREE.BoxGeometry(0.05, 0.13, 0.02), { color: 0xd4a53a, metalness: 1.0, roughness: 0.28 }, G, [-0.85 + 0.5, -0.1, z0 + 0.0125 + 0.06]);
    // SSD 2,5" fixé au dos du plateau
    var g = new THREE.Group(); g.position.set(-1.45, -0.7, BZ - 0.14); g.rotation.y = Math.PI; G.add(g);
    mesh(P, rbox(0.7, 1.0, 0.1, 0.04), { color: 0x2a2c32, metalness: 0.95, roughness: 0.3 }, g);
    var t = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), mat(P, { map: textTexture('PERFLEX  SSD', 512, 200, { color: '#e9e4e5', size: 64, weight: 700, align: 'center' }), transparent: true, roughness: 0.6, noPick: true }));
    t.position.set(0, 0.2, 0.052); g.add(t);
    mesh(P, new THREE.BoxGeometry(0.5, 0.02, 0.01), { color: 0xff3d4a, emissive: 0xff3d4a, emissiveIntensity: 1.2, glow: true, noPick: true }, g, [0, -0.04, 0.052]);
  })();

  /* --- carte graphique (montage vertical) --- */
  (function () {
    var P = 'gpu', G = parts.gpu.group, gx = -0.35, gy = -0.9, zf = 0.5;
    var g = new THREE.Group(); g.position.set(gx, gy, 0); G.add(g);
    var holes = [[-0.98, 0.0, 0.47], [0.0, 0.0, 0.47], [0.98, 0.0, 0.47]];
    mesh(P, rbox(3.0, 1.26, 0.2, 0.1, 0.02, holes), { color: 0x1b1c21, metalness: 0.8, roughness: 0.33 }, g, [0, 0, zf - 0.1]);
    mesh(P, rbox(2.94, 1.14, 0.3, 0.04, 0.01), { color: 0xffffff, map: finTexture(true, '#434853', '#0b0c0e'), metalness: 0.9, roughness: 0.35 }, g, [0, 0, zf - 0.34]);
    mesh(P, rbox(3.0, 1.24, 0.03, 0.05), { color: 0x16171b, metalness: 0.9, roughness: 0.32 }, g, [0, 0, zf - 0.56]);
    holes.forEach(function (h) { makeFan(P, 0.45, g, [h[0], h[1], zf - 0.2], null, { speed: 11, frame: false }); });
    mesh(P, new THREE.BoxGeometry(2.7, 0.025, 0.04), { color: 0x240608, emissive: 0xff3d4a, emissiveIntensity: 1.8, glow: true, noPick: true }, g, [-0.05, 0.64, zf - 0.04]);
    mesh(P, new THREE.BoxGeometry(2.7, 0.02, 0.03), { color: 0x240608, emissive: 0xff3d4a, emissiveIntensity: 1.4, glow: true, noPick: true }, g, [-0.05, -0.64, zf - 0.04]);
    var lab = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), mat(P, { map: textTexture('P E R F L E X   ·   F L E X   X 9', 1024, 90, { color: '#d9d3d4', size: 34, weight: 600, font: 'Consolas, monospace', align: 'center' }), transparent: true, roughness: 0.5, noPick: true }));
    lab.position.set(-0.7, 0.58, zf + 0.003); g.add(lab);
    // connecteur d'alimentation 12VHPWR + câble
    mesh(P, rbox(0.4, 0.14, 0.12, 0.02), { color: 0x0b0b0d, roughness: 0.7, metalness: 0.3 }, g, [1.25, -0.5, zf - 0.08]);
    var c = new THREE.CatmullRomCurve3([new THREE.Vector3(gx + 1.45, gy - 0.5, zf - 0.08), new THREE.Vector3(gx + 1.7, gy - 0.6, zf - 0.2), new THREE.Vector3(gx + 1.85, gy - 0.95, zf - 0.55), new THREE.Vector3(gx + 1.7, -1.7, BZ + 0.2)]);
    mesh(P, new THREE.TubeGeometry(c, 40, 0.07, 10), { color: 0x0b0b0d, roughness: 0.85, metalness: 0.1 }, G);
    // équerre de fixation au boîtier
    mesh(P, new THREE.BoxGeometry(0.03, 1.3, 0.62), { color: 0x2a2c32, metalness: 0.9, roughness: 0.4 }, G, [gx - 1.53, gy, 0.12]);
  })();

  /* --- refroidissement : radiateur AIO, ventilateurs, tuyaux (décor) --- */
  (function () {
    var P = 'cool', G = parts.cool.group, rx = 1.78, rz = 0.12;
    mesh(P, rbox(0.28, 2.75, 1.26, 0.05), { color: 0xffffff, map: finTexture(false, '#3a3d45', '#0d0e11'), metalness: 0.9, roughness: 0.38, noPick: true }, G, [rx, -0.05, rz]);
    [-0.65, 0.65].forEach(function (y) {
      makeFan(P, 0.55, G, [rx + 0.2, y - 0.05, rz], [0, Math.PI / 2, 0], { speed: 9 });
      makeFan(P, 0.55, G, [rx - 0.2, y - 0.05, rz], [0, Math.PI / 2, 0], { speed: 9 });
    });
    var tm = { color: 0x0a0a0c, roughness: 0.9, metalness: 0.05 };
    var cx = -0.85, cy = 0.85, z0 = BZ + 0.225;
    [[0.12, 0.3, 0.0], [-0.12, 0.65, 0.18]].forEach(function (o, i) {
      var c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx + 0.45, cy + o[0], z0),
        new THREE.Vector3(cx + 0.7, cy + 0.55 + o[1] * 0.3, z0 + 0.3 + o[2]),
        new THREE.Vector3(0.2, 1.72 + o[2] * 0.3, 0.25 + o[2]),
        new THREE.Vector3(1.2, 1.78 + o[2] * 0.3, 0.2 + o[2]),
        new THREE.Vector3(rx - 0.04, 1.62, rz - 0.3 + i * 0.6)
      ]);
      mesh(P, new THREE.TubeGeometry(c, 70, 0.052, 10), tm, G);
    });
    // ventilateur d'extraction arrière
    makeFan(P, 0.55, G, [-2.18, 1.1, -0.1], [0, -Math.PI / 2, 0], { speed: 10 });
  })();

  /* ------------------------------------------------------------------ */
  /*  Sol                                                                */
  /* ------------------------------------------------------------------ */
  var floor = new THREE.Group(); scene.add(floor);
  (function () {
    var y = -2.52;
    var c = cv(512, 512), g = c.getContext('2d');
    var gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(0.5, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = y + 0.005; floor.add(shadow);

    var c2 = cv(512, 512), g2 = c2.getContext('2d');
    var gr2 = g2.createRadialGradient(256, 256, 40, 256, 256, 256);
    gr2.addColorStop(0, 'rgba(255,61,74,.22)'); gr2.addColorStop(0.6, 'rgba(255,61,74,.07)'); gr2.addColorStop(1, 'rgba(255,61,74,0)');
    g2.fillStyle = gr2; g2.fillRect(0, 0, 512, 512);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tex(c2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = y + 0.01; floor.add(glow);

    [[3.1, 3.12, 0.55], [3.9, 3.91, 0.16], [4.8, 4.81, 0.07]].forEach(function (r) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(r[0], r[1], 160), new THREE.MeshBasicMaterial({ color: 0xff3d4a, transparent: true, opacity: r[2], depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = y + 0.012; floor.add(ring);
    });
    // graduations sur l'anneau principal
    var ticks = new THREE.Group(); floor.add(ticks);
    for (var i = 0; i < 72; i++) {
      var a = (i / 72) * Math.PI * 2, L = i % 6 === 0 ? 0.22 : 0.09;
      var t = new THREE.Mesh(new THREE.PlaneGeometry(0.012, L), new THREE.MeshBasicMaterial({ color: 0xff3d4a, transparent: true, opacity: i % 6 === 0 ? 0.5 : 0.22, depthWrite: false, side: THREE.DoubleSide }));
      t.rotation.x = -Math.PI / 2; t.rotation.z = -a;
      t.position.set(Math.sin(a) * 3.28, y + 0.013, Math.cos(a) * 3.28);
      t.rotation.set(-Math.PI / 2, 0, -a + Math.PI);
      ticks.add(t);
    }
    floor.userData.ticks = ticks;
  })();

  /* ------------------------------------------------------------------ */
  /*  Vues pour chaque pièce (centre local, taille utile, angle)          */
  /* ------------------------------------------------------------------ */
  var VIEWS = {
    cpu:  { c: [-0.85, 0.85, -0.15], w: 1.25, h: 1.25, yaw: 0.34, hot: [-0.85, 0.85, -0.14] },
    mobo: { c: [-0.78, 0.0, -0.4],  w: 2.7,  h: 3.3,  yaw: 0.3,  hot: [-1.62, 1.0, -0.28] },
    ram:  { c: [-0.01, 0.86, -0.1], w: 1.05, h: 1.7,  yaw: 0.42, hot: [-0.01, 0.55, 0.0] },
    gpu:  { c: [-0.35, -0.9, 0.2],  w: 3.3,  h: 1.5,  yaw: 0.28, hot: [0.4, -0.9, 0.5] },
    ssd:  { c: [-0.85, 0.02, -0.3], w: 1.2,  h: 0.7,  yaw: 0.34, hot: [-0.85, 0.12, -0.3] },
    psu:  { c: [0.0, -2.0, 1.0],    w: 4.1,  h: 0.95, yaw: 0.2,  hot: [1.2, -2.0, 1.06] }
  };
  VIEWS.ram.hot = [-0.01, 0.55, 0.0];
  var ORDER = ['cpu', 'mobo', 'ram', 'gpu', 'ssd', 'psu'];
  Object.keys(VIEWS).forEach(function (k) {
    VIEWS[k].cv = new THREE.Vector3(VIEWS[k].c[0], VIEWS[k].c[1], VIEWS[k].c[2]);
    VIEWS[k].hv = new THREE.Vector3(VIEWS[k].hot[0], VIEWS[k].hot[1], VIEWS[k].hot[2]);
  });

  /* ------------------------------------------------------------------ */
  /*  État + interactions                                                */
  /* ------------------------------------------------------------------ */
  var BASE_VEL = reduceMotion ? 0 : 0.2;                    // rad/s : un tour ≈ 31 s
  var TILT0 = 0.11;
  var st = {
    yaw: -0.55, vel: BASE_VEL, tilt: TILT0,
    focus: null, f: 0,
    uyaw: 0,
    layout: { ax: 0.3, ay: 0, uw: 0.62, uh: 0.92 },
    D0: 11, D: 11, P: new THREE.Vector3(), Dp: 8, yawT: 0, w: 1, h: 1
  };

  var panel = document.getElementById('partpanel');
  var hotWrap = document.getElementById('hots');
  var hotEls = {};
  ORDER.forEach(function (id, i) {
    var b = document.createElement('button');
    b.className = 'hot'; b.type = 'button'; b.dataset.part = id;
    b.setAttribute('aria-label', parts[id].label);
    b.innerHTML = '<i></i><b>0' + (i + 1) + '</b><span>' + parts[id].label + '</span>';
    b.addEventListener('click', function () { focusPart(id); });
    hotWrap.appendChild(b);
    hotEls[id] = b;
  });

  function setLayout() {
    var w = stage.clientWidth, h = stage.clientHeight;
    st.w = w; st.h = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    var mobile = w < 900 || w / h < 0.9;
    st.layout = mobile ? { ax: 0, ay: 0.06, uw: 0.94, uh: 0.9, mobile: true, fy: 0.5 } : { ax: 0.3, ay: 0, uw: 0.62, uh: 0.92, mobile: false };
    // distance pour tout voir
    st.D0 = fit(6.3, 7.1, st.layout);
  }
  function fit(w, h, L) {
    var dh = h / (2 * FOV_TAN * L.uh), dw = w / (2 * FOV_TAN * camera.aspect * L.uw);
    return Math.max(dh, dw);
  }
  function focusLayout() {
    var L = st.layout;
    return L.mobile ? { ax: 0, ay: 0.5, uw: 0.94, uh: 0.42 } : { ax: 0.42, ay: 0, uw: 0.52, uh: 0.88 };
  }

  var panelTitle = panel && panel.querySelector('[data-f="title"]');
  function focusPart(id) {
    if (!VIEWS[id]) return;
    st.focus = id; st.uyaw = 0;
    document.documentElement.classList.add('is-focus');
    ORDER.forEach(function (k) { parts[k].dimT = k === id ? 0 : 1; });
    parts.case.dimT = 1; parts.cool.dimT = 1;
    if (id === 'ssd' || id === 'cpu' || id === 'mobo' || id === 'ram') { parts.cool.dimT = 1; }
    parts.cool.group.visible = true;
    if (window.PerflexPanel) window.PerflexPanel.show(id, ORDER);
    syncList(id);
  }
  function release() {
    if (!st.focus) return;
    st.focus = null;
    document.documentElement.classList.remove('is-focus');
    Object.keys(parts).forEach(function (k) { parts[k].dimT = 0; });
    if (window.PerflexPanel) window.PerflexPanel.hide();
    syncList(null);
  }
  function syncList(id) {
    document.querySelectorAll('[data-pick]').forEach(function (el) { el.classList.toggle('on', el.dataset.pick === id); });
  }
  window.PerflexScene = { focus: focusPart, release: release, order: ORDER };
  document.querySelectorAll('[data-pick]').forEach(function (el) {
    el.addEventListener('click', function () { focusPart(el.dataset.pick); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') release();
    if (st.focus && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var i = ORDER.indexOf(st.focus) + (e.key === 'ArrowRight' ? 1 : -1);
      focusPart(ORDER[(i + ORDER.length) % ORDER.length]);
    }
  });

  /* glisser / cliquer */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  var drag = null, hoverId = null;
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    for (var i = 0; i < hits.length; i++) {
      var p = hits[i].object.userData.part;
      if (!p) continue;
      if (parts[p] && parts[p].dim > 0.5) continue;       // pièces effacées : on traverse
      return (p === 'case' || p === 'cool') ? null : p;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0, lt: performance.now() };
    stage.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (drag) {
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly, now = performance.now(), dt = Math.max((now - drag.lt) / 1000, 0.001);
      drag.moved += Math.abs(dx) + Math.abs(dy);
      var k = 0.0058;
      if (st.focus) { st.uyaw = THREE.MathUtils.clamp(st.uyaw + dx * k, -1.1, 1.1); }
      else {
        st.yaw += dx * k;
        st.vel = THREE.MathUtils.clamp(0.7 * st.vel + 0.3 * (dx * k / dt), -9, 9);
      }
      st.tilt = THREE.MathUtils.clamp(st.tilt + dy * 0.0035, -0.18, 0.6);
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    } else if (e.pointerType === 'mouse') {
      var h = pick(e);
      if (h !== hoverId) { hoverId = h; stage.classList.toggle('hover-part', !!h); }
    }
  });
  function endDrag(e) {
    if (!drag) return;
    var click = drag.moved < 6 && performance.now() - drag.t < 450;
    drag = null; stage.classList.remove('grabbing');
    if (click) {
      var h = pick(e);
      if (h) focusPart(h); else if (st.focus) release();
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function () { drag = null; stage.classList.remove('grabbing'); });
  canvas.addEventListener('pointerleave', function () { if (!drag) { hoverId = null; stage.classList.remove('hover-part'); } });
  canvas.style.touchAction = 'pan-y';

  /* ------------------------------------------------------------------ */
  /*  Boucle                                                             */
  /* ------------------------------------------------------------------ */
  var clock = new THREE.Clock(), visible = true, frame = 0;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(setLayout).observe(stage); else window.addEventListener('resize', setLayout);
  setLayout();

  var M = new THREE.Matrix4(), tmp = new THREE.Vector3(), camPos = new THREE.Vector3(), q = new THREE.Quaternion();
  function ease(t) { return t * t * (3 - 2 * t); }
  function smooth(rate, dt) { return 1 - Math.exp(-rate * dt); }

  function applyDim(p) {
    var d = p.dim, mats = p.mats;
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i], b = m.userData.base;
      m.opacity = b.opacity * (1 - 0.9 * d);
      var tr = d > 0.003 || b.transparent;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      var dw = b.depthWrite && d < 0.05;
      if (m.depthWrite !== dw) m.depthWrite = dw;
    }
  }

  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!visible) return;
    frame++;

    /* rotation libre : la vitesse retombe doucement vers la vitesse normale */
    if (!st.focus) {
      if (!drag) {
        st.vel += (BASE_VEL - st.vel) * smooth(0.9, dt);
        st.yaw += st.vel * dt;
        st.tilt += (TILT0 - st.tilt) * smooth(0.7, dt);
      }
    } else {
      var V = VIEWS[st.focus];
      var target = V.yaw + st.uyaw;
      var k = Math.round((st.yaw - target) / (Math.PI * 2));
      st.yawT = target + k * Math.PI * 2;
      st.yaw += (st.yawT - st.yaw) * smooth(3.4, dt);
      st.vel = 0;
      if (!drag) st.tilt += (0.07 - st.tilt) * smooth(2.6, dt);
    }

    /* mise au point : f va de 0 (vue d'ensemble) à 1 (pièce plein cadre) */
    st.f += ((st.focus ? 1 : 0) - st.f) * smooth(st.focus ? 3.0 : 3.6, dt);
    var f = ease(Math.min(Math.max(st.f, 0), 1));
    if (st.focus) {
      var V2 = VIEWS[st.focus], FL = focusLayout();
      var Dt = Math.max(V2.h / (2 * FOV_TAN * FL.uh), V2.w / (2 * FOV_TAN * camera.aspect * FL.uw)) + 0.9;
      var s2 = smooth(4.2, dt);
      st.P.lerp(V2.cv, s2); st.Dp += (Dt - st.Dp) * s2;
      st.fl = FL;
    }
    var FLc = st.fl || focusLayout();
    var D = st.D0 + (st.Dp - st.D0) * f;
    camera.position.set(0, 0, D); camera.lookAt(0, 0, 0);

    pc.rotation.y = st.yaw;
    pivot.rotation.x = st.tilt;
    pivot.updateMatrixWorld(true);

    /* position de l'ensemble : centré à droite en repos, pièce ancrée à l'écran en mise au point */
    var L = st.layout;
    var ax0 = L.ax * D * FOV_TAN * camera.aspect, ay0 = L.ay * D * FOV_TAN;
    var ax1 = FLc.ax * D * FOV_TAN * camera.aspect, ay1 = FLc.ay * D * FOV_TAN;
    M.makeRotationFromEuler(new THREE.Euler(st.tilt, st.yaw, 0, 'YXZ'));
    tmp.copy(st.P).applyMatrix4(M);
    var rest = new THREE.Vector3(ax0, ay0 + 0.12, 0);
    var foc = new THREE.Vector3(ax1 - tmp.x, ay1 - tmp.y, -tmp.z);
    pivot.position.copy(rest).lerp(foc, f);
    floor.position.set(pivot.position.x * (1 - f) + (ax0) * f, pivot.position.y, 0);
    floor.position.x = pivot.position.x; floor.position.z = pivot.position.z; floor.position.y = pivot.position.y;
    floor.rotation.x = pivot.rotation.x; floor.rotation.y = 0;
    floor.userData.ticks.rotation.y = -st.yaw * 0.5 + t * 0.02;

    /* effacement / survol */
    var anyDim = false;
    Object.keys(parts).forEach(function (id) {
      var p = parts[id];
      var dd = p.dimT - p.dim;
      if (Math.abs(dd) > 0.001) { p.dim += dd * smooth(5.5, dt); applyDim(p); }
      else if (p.dim !== p.dimT) { p.dim = p.dimT; applyDim(p); }
      var ht = (id === hoverId && !st.focus) ? 1 : 0;
      if (Math.abs(ht - p.hover) > 0.002) {
        p.hover += (ht - p.hover) * smooth(10, dt);
        for (var i = 0; i < p.mats.length; i++) {
          var m = p.mats[i];
          if (m.userData.glowMat) continue;
          if (!m.emissiveMap && glowSet.indexOf(m) === -1) { m.emissive.setRGB(0.20 * p.hover, 0.02 * p.hover, 0.03 * p.hover); }
        }
      }
    });

    /* respiration des LED + ventilateurs */
    var br = 0.82 + 0.18 * Math.sin(t * 1.6);
    for (var i = 0; i < glows.length; i++) glows[i].m.emissiveIntensity = glows[i].base * br;
    var spin = reduceMotion ? 0.25 : 1;
    for (var j = 0; j < fans.length; j++) fans[j].rotor.rotation.z -= fans[j].speed * spin * dt;

    /* repères HTML */
    if (frame % 2 === 0) updateHots();

    renderer.render(scene, camera);
  }
  var glowSet = glows.map(function (g) { return g.m; });

  function updateHots() {
    var show = !st.focus && st.f < 0.05;
    var rect = { w: st.w, h: st.h };
    camPos.copy(camera.position);
    for (var i = 0; i < ORDER.length; i++) {
      var id = ORDER[i], el = hotEls[id];
      if (!show) { el.classList.remove('vis'); continue; }
      tmp.copy(VIEWS[id].hv); pc.localToWorld(tmp);
      var w = tmp.clone();
      tmp.project(camera);
      var sx = (tmp.x * 0.5 + 0.5) * rect.w, sy = (-tmp.y * 0.5 + 0.5) * rect.h;
      el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      // masqué si une autre pièce passe devant
      var dir = w.clone().sub(camPos), dist = dir.length(); dir.normalize();
      ray.set(camPos, dir);
      var hits = ray.intersectObjects(pickables, false), hid = false;
      for (var h = 0; h < hits.length; h++) {
        var hp = hits[h].object.userData.part;
        if (hits[h].distance < dist - 0.12 && hp !== id) { hid = true; break; }
        if (hits[h].distance >= dist - 0.12) break;
      }
      el.classList.toggle('vis', !hid && tmp.z < 1);
    }
  }

  document.documentElement.classList.add('webgl-ok');
  stage.classList.add('ready');
  // premier rendu immédiat puis boucle
  tick();
})();
