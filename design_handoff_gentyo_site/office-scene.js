// <office-scene> — low-poly home office background. ES module; needs an import map for "three".
import * as THREE from 'https://unpkg.com/three@0.184.0/build/three.module.js';

class OfficeScene extends HTMLElement {
  connectedCallback() {
    if (this.started) return; this.started = true;
    this.style.cssText += ';display:block;width:100%;height:100%;min-height:100%';
    this.mouse = { x: 0, y: 0 }; this.target = { x: 0, y: 0 };
    this.onMove = e => { this.target.x = e.clientX / innerWidth - 0.5; this.target.y = e.clientY / innerHeight - 0.5; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    try { this.build(); } catch (e) { console.error('office-scene build failed', e); }
  }
  disconnectedCallback() {
    this.dead = true;
    window.removeEventListener('pointermove', this.onMove);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }
  static get observedAttributes() { return ['dark']; }
  attributeChangedCallback() { this.applyTheme(); }
  applyTheme() {
    if (!this.T) return;
    const dark = this.getAttribute('dark') === '1';
    const { amb, sun, fill, screen, screen2, lampLight, bulb, pendant, pendantLight, scene, windowGlow, renderer } = this.T;
    renderer.toneMappingExposure = dark ? 0.95 : 1.15;
    amb.intensity = dark ? 0.06 : 0.8;
    fill.intensity = dark ? 0.04 : 0.45;
    sun.intensity = dark ? 0.15 : 2.8; sun.color.set(dark ? '#7f97cc' : '#fff1dc');
    this.screenBase = dark ? 1.6 : 0.7; screen.emissiveIntensity = this.screenBase; screen2.emissiveIntensity = this.screenBase * 0.8;
    lampLight.intensity = dark ? 3.5 : 0.6; lampLight.distance = dark ? 2.6 : 3; lampLight.decay = dark ? 2.2 : 2; lampLight.color.set(dark ? '#ffb15c' : '#ffd58a'); bulb.emissiveIntensity = dark ? 1.0 : 0.25; bulb.emissive.set(dark ? '#ffb15c' : '#ffd58a');
    pendantLight.intensity = dark ? 3 : 0.3; pendantLight.distance = dark ? 4.5 : 8; pendantLight.decay = dark ? 2.4 : 1.6; pendant.emissiveIntensity = dark ? 1.4 : 0.2;
    if (this.screenLight) this.screenLight.intensity = dark ? 1.6 : 0;
    windowGlow.emissiveIntensity = dark ? 0.25 : 0.9; windowGlow.emissive.set(dark ? '#7f97cc' : '#fff7e8');
    scene.fog.color.set(dark ? '#101113' : '#f5f5f3');
    if (this.skyMat) { this.skyMat.color.set(dark ? '#1b2a44' : '#cfe3f7'); this.sunDisc.material.color.set(dark ? '#e9eef7' : '#fff4d6'); this.sunDisc.scale.setScalar(dark ? 0.7 : 1);
      const cols = dark ? ['#2a3b58', '#1f2d45', '#16222f'] : ['#9fb4cf', '#7690b0', '#4f7261']; this.ridges.forEach((m, i) => m.material.color.set(cols[i]));
      if (this.clouds) this.clouds.forEach(c => c.children.forEach(p => p.material.color.set(dark ? '#3a4763' : '#ffffff'))); }
  }
  build() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', logarithmicDepthBuffer: true });
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(renderer.domElement);
    this.renderer = renderer;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#f5f5f3', 9, 16);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 40);

    // procedural textures
    const tex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);
    const woodTex = (base, dark, rep) => tex(256, 1024, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = dark; g.globalAlpha = 0.08 + rnd() * 0.18; g.lineWidth = 1 + rnd() * 3; g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - .5) * 40, h * .33, x + (rnd() - .5) * 40, h * .66, x + (rnd() - .5) * 30, h); g.stroke(); } g.globalAlpha = 1; }, rep);
    const floorMap = woodTex('#b08f6a', '#6b4d33', [1, 3]);
    const deskMap = woodTex('#b8916a', '#7a5636', [2, 1]);
    const fabricMap = tex(128, 128, (g, w, h) => { g.fillStyle = '#5f7089'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)'; g.fillRect(x, y, 4, 4); } }, [6, 6]);
    const rugMap = tex(512, 512, (g, w, h) => { g.fillStyle = '#8b96a5'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; for (let r = 40; r < 260; r += 44) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let i = 0; i < 400; i++) { g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + 6, y + 2); g.stroke(); } });
    // scrolling code texture: 4x panel height of code; repeat.y = 0.25 shows one screenful, offset.y animates
    const VIS = 0.25;
    const screenTex = (accent, portrait = false) => { const w = portrait ? 360 : 640, h = (portrait ? 640 : 360) * 4; const t = tex(w, h, (g) => {
      g.fillStyle = '#0f1523'; g.fillRect(0, 0, w, h);
      const side = portrait ? 0 : 110; if (!portrait) { g.fillStyle = '#141b2c'; g.fillRect(0, 0, side, h); for (let i = 0; i < 14 * 4; i++) { g.fillStyle = 'rgba(160,170,190,.45)'; g.fillRect(14 + (i % 3) * 8, 44 + i * 16, 40 + (i * 13) % 40, 4); } }
      const cols = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#ffcb6b']; const lines = Math.floor((h - 40) / 14);
      for (let i = 0; i < lines; i++) { const y = 40 + i * 14; if (i % 9 === 8) continue; const ind = ((i * 7) % 4) * 16; g.fillStyle = 'rgba(120,130,150,.5)'; g.fillRect(side + 10, y, 14, 4); let x = side + 34 + ind; const n = 2 + (i * 5) % 4; for (let k = 0; k < n; k++) { const len = 20 + ((i * 31 + k * 17) % 70); g.fillStyle = k === 0 ? cols[(i + k) % 6] : (k % 2 ? '#aab4c6' : cols[(i * 3 + k) % 6]); g.globalAlpha = k === 0 ? .95 : .7; g.fillRect(x, y, len, 5); x += len + 10; if (x > w - 40) break; } }
      g.globalAlpha = 1;
    }); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, VIS); t.offset.set(0, 1 - VIS); return t; };
    // static chrome overlay (title bar + status bar) drawn on top of the scrolling code
    const chromeTex = (accent, portrait = false) => { const w = portrait ? 360 : 640, h = portrait ? 640 : 360; const t = tex(w, h, (g) => { g.clearRect(0, 0, w, h);
      g.fillStyle = '#141b2c'; g.fillRect(0, 0, w, 26); g.fillStyle = '#ff5f57'; g.beginPath(); g.arc(14, 13, 4, 0, 7); g.fill(); g.fillStyle = '#febc2e'; g.beginPath(); g.arc(28, 13, 4, 0, 7); g.fill(); g.fillStyle = '#28c840'; g.beginPath(); g.arc(42, 13, 4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect((portrait ? 0 : 110) + 8, 5, 120, 16);
      g.fillStyle = accent; g.fillRect(0, h - 14, w, 14); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(10, h - 9, 60, 4); g.fillRect(w - 90, h - 9, 70, 4); }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
    // human-like scroll controller: scroll a few lines with easing, pause, sometimes scroll back
    const scroller = (tx, seed) => { const st = { tx, from: 1 - VIS, to: 1 - VIS, t0: 0, dur: 1, pause: 1200 + seed * 400, phase: 'pause', r: seed * 0.37 };
      const nextR = () => { st.r = (st.r * 9301 + 49297) % 233280 / 233280; return st.r; };
      return (t) => { if (st.phase === 'pause') { if (t - st.t0 > st.pause) { st.phase = 'scroll'; st.t0 = t; const lines = 2 + Math.floor(nextR() * 6); const back = nextR() < 0.2; const step = lines * 14 / tx.image.height * (back ? 1 : -1); st.from = tx.offset.y; st.to = Math.max(0, Math.min(1 - VIS, st.from + step)); st.dur = 250 + lines * 60 + nextR() * 200; } }
        else { const p = Math.min(1, (t - st.t0) / st.dur); const e = 1 - Math.pow(1 - p, 3); tx.offset.y = st.from + (st.to - st.from) * e; if (p >= 1) { st.phase = 'pause'; st.t0 = t; st.pause = 600 + nextR() * 3200; if (tx.offset.y <= 0.001 && nextR() < 0.5) { st.from = 0; st.to = 1 - VIS; st.phase = 'scroll'; st.dur = 900; } } } }; };
    const paperMap = tex(256, 256, (g, w, h) => { g.fillStyle = '#f8f6f0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,90,120,.35)'; g.lineWidth = 1; for (let y = 24; y < h; y += 14) { g.beginPath(); g.moveTo(16, y); g.lineTo(w - 16, y); g.stroke(); } g.strokeStyle = 'rgba(200,60,60,.5)'; g.beginPath(); g.moveTo(34, 0); g.lineTo(34, h); g.stroke(); });
    // environment map for reflections (soft studio gradient)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#dfe6ee');
    const envTop = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: '#fff5e4', side: THREE.BackSide })); envTop.position.y = 12; envScene.add(envTop);
    const envWin = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); envWin.position.set(-8, 2, 0); envWin.rotation.y = Math.PI / 2; envScene.add(envWin);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture; scene.environmentIntensity = 0.35;
    const M = (c, r = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, ...extra });
    const mats = {
      wall: M('#d9d2c6', 0.95), wall2: M('#cdc5b8', 0.95), floor: M('#ffffff', 0.55, { map: floorMap }), floor2: M('#f1e6d6', 0.55, { map: floorMap }),
      wood: M('#ffffff', 0.45, { map: deskMap }), woodDark: M('#4e3a2c', 0.6), metal: M('#2f3238', 0.3, { metalness: 0.8 }), alu: M('#c9ccd2', 0.25, { metalness: 0.9 }),
      white: M('#f3f1ec', 0.5), black: new THREE.MeshPhysicalMaterial({ color: '#151619', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }), fabric: M('#ffffff', 0.95, { map: fabricMap }), fabric2: M('#4d5c73', 0.95),
      leaf: M('#4c8757', 0.75), leaf2: M('#3e7449', 0.75), pot: M('#c86b47', 0.8), potWhite: M('#efece6', 0.7),
      paper: M('#ffffff', 0.9, { map: paperMap }), mat: M('#2b2d33', 0.98), rug: M('#ffffff', 0.98, { map: rugMap }), rug2: M('#a3adb9', 0.98),
      book: ['#b04740', '#3d6b9a', '#d7a13f', '#3d4d3d', '#7a5fa3', '#e0d9cc', '#c25f2a'].map(c => M(c, 0.85)),
      screen: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: (this.tx1 = screenTex('#3b6fd1')), emissiveIntensity: 0.7, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -1 }),
      screen2: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: (this.tx2 = screenTex('#2c9c7a', true)), emissiveIntensity: 0.5, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -1 }),
      bulb: new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd58a', emissiveIntensity: 0.25 }),
      pendant: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffe1a8', emissiveIntensity: 0.2, transparent: true, opacity: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#eaf3ff', emissive: '#ffffff', emissiveIntensity: 0.1, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0, clearcoat: 1 }),
      curtain: M('#d9cfc0', 0.98), shade: new THREE.MeshStandardMaterial({ color: '#25282f', roughness: 0.5, side: THREE.DoubleSide }),
      screen3: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: (this.tx3 = screenTex('#8a5cd6')), emissiveIntensity: 0.5, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -1 }),
      chrome1: new THREE.MeshBasicMaterial({ map: chromeTex('#3b6fd1'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
      chrome2: new THREE.MeshBasicMaterial({ map: chromeTex('#2c9c7a', true), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
      chrome3: new THREE.MeshBasicMaterial({ map: chromeTex('#8a5cd6'), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
      cable: M('#1a1b1e', 0.6), brass: M('#c49a4a', 0.3, { metalness: 0.9 }), ceramic: new THREE.MeshPhysicalMaterial({ color: '#efece6', roughness: 0.25, clearcoat: 0.8 }),
    };
    const root = new THREE.Group(); scene.add(root);
    const add = (geo, m, x, y, z, cast = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; root.add(o); return o; };
    const box = (w, h, d, m, x, y, z, cast) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, cast);
    const cyl = (rt, rb, h, m, x, y, z, seg = 24, cast) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, cast);
    const rboxGeo = (w, h, d, r = 0.02, seg = 3) => { const sh = new THREE.Shape(); const hw = w / 2 - r, hh = h / 2 - r; sh.moveTo(-hw, -h / 2); sh.lineTo(hw, -h / 2); sh.absarc(hw, -hh, r, -Math.PI / 2, 0, false); sh.lineTo(w / 2, hh); sh.absarc(hw, hh, r, 0, Math.PI / 2, false); sh.lineTo(-hw, h / 2); sh.absarc(-hw, hh, r, Math.PI / 2, Math.PI, false); sh.lineTo(-w / 2, -hh); sh.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5, false); const g = new THREE.ExtrudeGeometry(sh, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 6 }); g.center(); return g; };
    const rbox = (w, h, d, m, x, y, z, r = 0.02) => add(rboxGeo(w, h, d, r), m, x, y, z);
    const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = add(new THREE.SphereGeometry(r, 18, 14), m, x, y, z); o.scale.set(sx, sy, sz); return o; };

    // floor: boards + gaps
    for (let i = 0; i < 14; i++) box(0.42, 0.04, 6.4, i % 2 ? mats.floor : mats.floor2, -2.8 + i * 0.44, -0.02, 0.2, false);
    box(6.4, 0.03, 6.4, mats.woodDark, 0.2, -0.03, 0.2, false);
    // ceiling
    { const c = box(6.4, 0.06, 6.4, mats.white, 0.2, 3.23, 0.2, false); c.receiveShadow = false; }
    // walls, skirting, cornice
    box(6.4, 3.2, 0.08, mats.wall, 0.2, 1.6, -2.5, true);
    // left wall with a real opening for the window (x=-3; window y 0.85..2.55, z -1.25..0.65)
    box(0.08, 3.2, 2.15, mats.wall2, -3, 1.6, -2.325, true);
    box(0.08, 3.2, 2.75, mats.wall2, -3, 1.6, 2.025, true);
    box(0.08, 0.85, 1.9, mats.wall2, -3, 0.425, -0.3, true);
    box(0.08, 0.65, 1.9, mats.wall2, -3, 2.875, -0.3, true);
    // window mullions (cast the classic cross shadow)
    box(0.05, 1.54, 0.04, mats.white, -2.96, 1.7, -0.3, true); box(0.05, 0.04, 1.74, mats.white, -2.96, 1.7, -0.3, true);
    // door on the back wall (right side) with frame + handle
    box(0.9, 2.1, 0.05, mats.woodDark, 2.5, 1.05, -2.45, false); box(0.98, 2.16, 0.03, mats.white, 2.5, 1.08, -2.47, false);
    [0.55, 1.15, 1.75].forEach(y => box(0.62, 0.42, 0.012, M('#5a4535', 0.7), 2.5, y, -2.42, false));
    cyl(0.012, 0.012, 0.12, mats.brass, 2.15, 1.05, -2.36, 10); cyl(0.02, 0.02, 0.02, mats.brass, 2.15, 1.05, -2.42, 10);
    // light switch + power outlet + wall vent
    box(0.08, 0.12, 0.012, mats.white, 1.9, 1.3, -2.455, false); box(0.1, 0.07, 0.012, mats.white, -0.3, 0.32, -2.455, false);
    box(6.4, 0.14, 0.03, mats.white, 0.2, 0.07, -2.44, false);
    box(0.03, 0.14, 6.4, mats.white, -2.94, 0.07, 0.2, false);
    box(6.4, 0.08, 0.03, mats.white, 0.2, 3.16, -2.44, false);
    box(0.03, 0.08, 6.4, mats.white, -2.94, 3.16, 0.2, false);
    // window on left wall + curtain + sill
    // window frame as 4 strips (open in the middle)
    box(0.06, 0.08, 1.9, mats.white, -2.95, 0.89, -0.3, false); box(0.06, 0.08, 1.9, mats.white, -2.95, 2.51, -0.3, false);
    box(0.06, 1.7, 0.08, mats.white, -2.95, 1.7, -1.21, false); box(0.06, 1.7, 0.08, mats.white, -2.95, 1.7, 0.61, false);
    const glow = add(new THREE.BoxGeometry(0.02, 1.54, 1.74), mats.glass, -2.93, 1.7, -0.3, false);
    box(0.04, 1.54, 0.05, mats.white, -2.92, 1.7, -0.3, false);
    box(0.04, 0.05, 1.74, mats.white, -2.92, 1.7, -0.3, false);
    box(0.16, 0.05, 2.1, mats.white, -2.88, 0.84, -0.3);
    const curtain = add(new THREE.CylinderGeometry(0.16, 0.19, 2.35, 16), mats.curtain, -2.82, 1.62, 0.85); curtain.scale.z = 0.7;
    box(0.03, 0.03, 2.4, mats.brass, -2.86, 2.72, -0.3);
    [-0.9, 0.2].forEach(z => cyl(0.03, 0.03, 0.02, mats.brass, -2.86, 2.72, z, 16));
    cyl(0.05, 0.04, 0.08, mats.pot, -2.86, 0.9, -1.0, 20); sph(0.04, mats.leaf2, -2.86, 0.98, -1.0, 1, 1.3, 1); sph(0.02, mats.leaf2, -2.83, 0.99, -0.97);
    cyl(0.04, 0.04, 0.14, mats.ceramic, -2.86, 0.94, 0.4, 20); cyl(0.004, 0.004, 0.02, mats.black, -2.86, 1.02, 0.4, 6, false);
    const curtain2 = add(new THREE.CylinderGeometry(0.11, 0.14, 2.35, 16), mats.curtain, -2.78, 1.62, 1.08); curtain2.scale.z = 0.7;
    // outside: sky, sun, mountain ridges, tree line (seen through window)
    { const sky = new THREE.MeshBasicMaterial({ color: '#cfe3f7', fog: false }); this.skyMat = sky;
      const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), sky); skyPlane.position.set(-7, 2.5, -0.3); skyPlane.rotation.y = Math.PI / 2; root.add(skyPlane);
      this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(0.28, 32), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false })); this.sunDisc.position.set(-6.4, 3.0, -1.2); this.sunDisc.rotation.y = Math.PI / 2; root.add(this.sunDisc);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false, transparent: true, opacity: 0.25 })); halo.position.copy(this.sunDisc.position); halo.position.x -= 0.01; halo.rotation.y = Math.PI / 2; root.add(halo);
      const ridge = (pts, color, x, y) => { const sh = new THREE.Shape(); sh.moveTo(-5, -1); pts.forEach(([px, py]) => sh.lineTo(px, py)); sh.lineTo(5, -1); sh.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.set(x, y, -0.3); m.rotation.y = Math.PI / 2; root.add(m); return m; };
      this.ridges = [
        ridge([[-5, 0.6], [-3.6, 1.5], [-2.8, 1.1], [-1.9, 1.9], [-0.9, 1.2], [0.2, 2.1], [1.2, 1.4], [2.3, 1.8], [3.4, 1.0], [4.4, 1.5], [5, 1.1]], '#9fb4cf', -6.3, 0.75),
        ridge([[-5, 0.3], [-4, 0.9], [-3, 0.5], [-2, 1.2], [-1.1, 0.7], [0, 1.0], [1, 0.6], [2, 1.3], [3, 0.7], [4, 1.0], [5, 0.5]], '#7690b0', -6.1, 0.65),
        ridge([[-5, 0.2], [-4.2, 0.45], [-3.3, 0.25], [-2.4, 0.6], [-1.5, 0.3], [-0.6, 0.55], [0.4, 0.2], [1.4, 0.5], [2.4, 0.3], [3.5, 0.6], [5, 0.25]], '#4f7261', -5.9, 0.55),
      ];
      // lake + shore in the valley
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.0), new THREE.MeshStandardMaterial({ color: '#7fa7cf', roughness: 0.05, metalness: 0.6, fog: false })); lake.rotation.x = -Math.PI / 2; lake.position.set(-5.6, 0.61, -0.1); root.add(lake);
      const meadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6), new THREE.MeshBasicMaterial({ color: '#6f9a5c', fog: false })); meadow.rotation.x = -Math.PI / 2; meadow.position.set(-5.0, 0.6, -0.3); root.add(meadow);
      // conifers: layered cones + trunks, two rows
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.4), new THREE.MeshBasicMaterial({ color: '#dfe9f5', fog: false, transparent: true, opacity: 0.45 })); haze.position.set(-6.2, 1.55, -0.3); haze.rotation.y = Math.PI / 2; root.add(haze);
      const treeMat = new THREE.MeshStandardMaterial({ color: '#3b5a49', roughness: 0.9, fog: false }); const treeMat2 = new THREE.MeshStandardMaterial({ color: '#4c7257', roughness: 0.9, fog: false }); const trunkMat = new THREE.MeshBasicMaterial({ color: '#4a3526', fog: false });
      const conifer = (x, y, z, sc) => { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(sc); root.add(g); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6), trunkMat); tr.position.y = 0.1; g.add(tr); [[0.14, 0.32, 0.26], [0.11, 0.28, 0.44], [0.07, 0.22, 0.6]].forEach(([r, h, yy], i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), i % 2 ? treeMat : treeMat2); c.position.y = yy; g.add(c); }); };
      for (let i = 0; i < 12; i++) conifer(-4.4 - (i % 3) * 0.25, 0.6, -2.3 + i * 0.36 + (i % 2) * 0.1, 0.8 + (i % 3) * 0.25);
      for (let i = 0; i < 9; i++) conifer(-6.6 + (i % 2) * 0.3, 0.6, -2.0 + i * 0.5, 0.55 + (i % 2) * 0.2);
      // deciduous tree near the window
      const bigTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 8), trunkMat); bigTrunk.position.set(-4.0, 1.2, 1.1); root.add(bigTrunk);
      [[0, 2.35, 0.45], [0.3, 2.15, 0.32], [-0.3, 2.2, 0.35], [0.1, 2.65, 0.3]].forEach(([dx, y, r]) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: '#5f9a4e', roughness: 0.9, fog: false })); c.position.set(-4.0 + dx, y, 1.1 + dx * 0.5); root.add(c); });
      // little village: cabins with roofs, church spire
      const cabin = (x, z, sc, col) => { const g = new THREE.Group(); g.position.set(x, 0.6, z); g.scale.setScalar(sc); root.add(g); const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.16), new THREE.MeshBasicMaterial({ color: col, fog: false })); b.position.y = 0.07; g.add(b); const rf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.1, 4), new THREE.MeshBasicMaterial({ color: '#7a4a3a', fog: false })); rf.position.y = 0.19; rf.rotation.y = Math.PI / 4; g.add(rf); };
      cabin(-6.0, 0.9, 1, '#e8dcc8'); cabin(-6.3, 1.25, 0.8, '#d9c7a8'); cabin(-5.7, 1.35, 0.7, '#efe6d6'); cabin(-6.5, 0.55, 0.6, '#e2d3ba');
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 6), new THREE.MeshBasicMaterial({ color: '#eee8dc', fog: false })); spire.position.set(-6.15, 0.95, 1.05); root.add(spire);
      // clouds
      const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.92 });
      this.clouds = [[-6.6, 3.3, -1.9, 1.2], [-6.5, 3.6, 0.2, 0.9], [-6.7, 3.1, 1.6, 1.4]].map(([x, y, z, sc]) => { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(sc); root.add(g); [[0, 0, 0.16], [0.02, 0.06, 0.22, 0.1], [0.02, 0, 0.14, -0.28], [0.02, 0.03, 0.17, 0.3]].forEach(([dx, dy2, r, dz = 0]) => { const p = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cloudMat); p.position.set(dx, dy2, dz); p.scale.y = 0.6; g.add(p); }); return g; });
      // birds (tiny V shapes)
      const birdMat = new THREE.MeshBasicMaterial({ color: '#2c3441', fog: false, side: THREE.DoubleSide });
      this.birds = [0, 1, 2, 3, 4].map(i => { const sh = new THREE.Shape(); sh.moveTo(-0.05, 0.02); sh.lineTo(0, 0); sh.lineTo(0.05, 0.02); sh.lineTo(0.05, 0.028); sh.lineTo(0, 0.01); sh.lineTo(-0.05, 0.028); sh.closePath(); const b = new THREE.Mesh(new THREE.ShapeGeometry(sh), birdMat); b.position.set(-6.2, 2.9 + i * 0.06, -1.3 + i * 0.12); b.rotation.y = Math.PI / 2; b.userData.o = i; root.add(b); return b; });
      // snow caps on far ridge
      const snow = new THREE.Shape(); snow.moveTo(-2.2, 1.55); snow.lineTo(-1.9, 1.9); snow.lineTo(-1.6, 1.6); snow.lineTo(-1.75, 1.5); snow.closePath(); snow.moveTo(-0.1, 1.8); snow.lineTo(0.2, 2.1); snow.lineTo(0.5, 1.75); snow.lineTo(0.2, 1.7); snow.closePath();
      const snowM = new THREE.Mesh(new THREE.ShapeGeometry(snow), new THREE.MeshBasicMaterial({ color: '#f1f6fb', fog: false })); snowM.position.set(-6.29, 0.75, -0.3); snowM.rotation.y = Math.PI / 2; root.add(snowM);
    }
    // rug (two tones)
    cyl(1.5, 1.5, 0.02, mats.rug2, 0.45, 0.01, 0.55, 48, false);
    cyl(1.15, 1.15, 0.022, mats.rug, 0.45, 0.012, 0.55, 48, false);

    // desk with rounded-look edge trim + drawer unit
    const dy = 0.74;
    rbox(2.4, 0.06, 0.95, mats.wood, 0, dy, -1.8, 0.015);
    [[-1.1, -1.4], [1.1, -1.4], [-1.1, -2.2], [1.1, -2.2]].forEach(([x, z]) => box(0.05, dy - 0.05, 0.05, mats.metal, x, (dy - 0.05) / 2, z));
    box(0.42, 0.55, 0.8, mats.woodDark, 0.85, 0.28, -1.8);
    [0.12, 0.3, 0.46].forEach(y => box(0.14, 0.012, 0.012, mats.alu, 0.85, y, -1.39));
    // desk extras
    cyl(0.06, 0.06, 0.006, mats.woodDark, -0.6, dy + 0.034, -1.95, 24, false);
    const phone = box(0.07, 0.008, 0.14, mats.black, 0.28, dy + 0.035, -1.45); phone.rotation.y = 0.2;
    [['#f6d96b', 0.72, -2.0], ['#f4a5a5', 0.66, -1.93], ['#a8d8ff', 0.79, -1.96]].forEach(([c, x, z]) => box(0.07, 0.003, 0.07, M(c, 0.9, { polygonOffset: true, polygonOffsetFactor: -2 }), x, dy + 0.0325, z, false));
    box(0.2, 0.03, 0.15, mats.book[1], -1.05, dy + 0.046, -2.1); box(0.18, 0.025, 0.14, mats.book[3], -1.05, dy + 0.074, -2.1);
    cyl(0.05, 0.04, 0.09, mats.pot, -1.05, dy + 0.132, -2.1); sph(0.07, mats.leaf, -1.05, dy + 0.207, -2.1, 1, 0.7, 1);
    // desk mat
    box(0.9, 0.008, 0.4, mats.mat, -0.05, dy + 0.0345, -1.6, false);
    // main monitor (slim bezel) + stand
    { const base = add(new THREE.CylinderGeometry(0.23, 0.25, 0.016, 40), mats.alu, -0.15, dy + 0.039, -2.05);
      const neck = add(rboxGeo(0.07, 0.24, 0.04, 0.012), mats.alu, -0.15, dy + 0.16, -2.15);
      const arm = add(rboxGeo(0.06, 0.05, 0.08, 0.01), mats.alu, -0.15, dy + 0.27, -2.12);
      const bez = add(rboxGeo(0.94, 0.55, 0.032, 0.014), mats.black, -0.15, dy + 0.4, -2.09);
      box(0.9, 0.5, 0.004, mats.screen, -0.15, dy + 0.415, -2.072, false);
      add(new THREE.PlaneGeometry(0.9, 0.5), mats.chrome1, -0.15, dy + 0.415, -2.0695, false);
      box(0.9, 0.026, 0.005, M('#2a2d34', 0.4), -0.15, dy + 0.142, -2.072, false); cyl(0.004, 0.004, 0.004, mats.alu, -0.15, dy + 0.142, -2.069, 8, false);
      const lb = add(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 16), mats.black, -0.15, dy + 0.69, -2.08); lb.rotation.z = Math.PI / 2;
      const mc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, dy + 0.15, -2.11), new THREE.Vector3(-0.12, dy + 0.05, -2.17), new THREE.Vector3(0.08, dy - 0.02, -2.2), new THREE.Vector3(0.4, 0.4, -2.3), new THREE.Vector3(0.6, 0.02, -2.35)]), 32, 0.006, 6), mats.cable); mc.castShadow = true; root.add(mc); }
    // second monitor (portrait, angled) on the right
    const m2 = new THREE.Group(); m2.position.set(0.58, dy + 0.031, -2.0); m2.rotation.y = -0.3; root.add(m2);
    const mk = (g, m, x, y, z, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; m2.add(o); return o; };
    mk(new THREE.CylinderGeometry(0.17, 0.19, 0.016, 40), mats.alu, 0, 0.008, 0);
    mk(rboxGeo(0.06, 0.24, 0.04, 0.012), mats.alu, 0, 0.13, -0.09);
    mk(rboxGeo(0.06, 0.05, 0.08, 0.01), mats.alu, 0, 0.24, -0.06);
    mk(rboxGeo(0.44, 0.75, 0.032, 0.014), mats.black, 0, 0.5, -0.03);
    mk(new THREE.BoxGeometry(0.4, 0.71, 0.004), mats.screen2, 0, 0.5, -0.012, false);
    mk(new THREE.PlaneGeometry(0.4, 0.71), mats.chrome2, 0, 0.5, -0.0095, false);
    // laptop (open) on the left
    const lp = new THREE.Group(); lp.position.set(-0.95, dy + 0.031, -1.7); lp.rotation.y = 0.35; root.add(lp);
    const lk = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; lp.add(o); return o; };
    lk(new THREE.BoxGeometry(0.34, 0.015, 0.24), mats.alu, 0, 0.0075, 0);
    lk(new THREE.BoxGeometry(0.28, 0.004, 0.11), mats.black, 0, 0.017, -0.02); lk(new THREE.BoxGeometry(0.1, 0.003, 0.06), M('#a5a9b0', 0.4, { metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }), 0, 0.0165, 0.075);
    const lid = lk(new THREE.BoxGeometry(0.34, 0.23, 0.01), mats.alu, 0, 0.12, -0.12); lid.rotation.x = -0.2;
    const lsc = lk(new THREE.BoxGeometry(0.31, 0.19, 0.004), mats.screen3, 0, 0.1215, -0.1125); lsc.rotation.x = -0.2;
    const lch = lk(new THREE.PlaneGeometry(0.31, 0.19), mats.chrome3, 0, 0.1219, -0.1103); lch.rotation.x = -0.2;
    // keyboard + keys strip, mouse, mug, notebook, pen, headphones
    box(0.46, 0.022, 0.15, mats.white, -0.05, dy + 0.049, -1.58);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) box(0.024, 0.006, 0.02, mats.black, -0.05 - 0.2 + c * 0.03 + (r % 2) * 0.008, dy + 0.0635, -1.58 - 0.04 + r * 0.026, false);
    box(0.16, 0.006, 0.02, mats.black, -0.05, dy + 0.0635, -1.58 + 0.066, false);
    sph(0.045, mats.white, 0.33, dy + 0.062, -1.58, 1, 0.55, 1.35);
    cyl(0.05, 0.045, 0.11, mats.ceramic, -0.6, dy + 0.092, -1.95, 32);
    cyl(0.043, 0.043, 0.004, M('#5a3a22', 0.6), -0.6, dy + 0.144, -1.95, 32, false);
    const handle = add(new THREE.TorusGeometry(0.03, 0.007, 10, 24), mats.ceramic, -0.545, dy + 0.092, -1.95);
    box(0.26, 0.02, 0.2, mats.paper, 0.5, dy + 0.041, -1.5);
    const pen = cyl(0.006, 0.006, 0.15, mats.black, 0.52, dy + 0.058, -1.48, 8); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
    { const hpg = new THREE.Group(); hpg.position.set(-0.55, dy + 0.06, -1.45); hpg.rotation.y = 0.5; root.add(hpg);
      const hk = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; hpg.add(o); return o; };
      const band = hk(new THREE.TorusGeometry(0.09, 0.011, 10, 28, Math.PI), mats.black, 0, 0.022, 0); band.rotation.x = -Math.PI / 2; band.rotation.z = 0;
      const pad = hk(new THREE.TorusGeometry(0.09, 0.02, 8, 20, Math.PI * 0.5), mats.fabric2, 0, 0.022, 0); pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI * 0.25;
      [[-0.09, 0], [0.09, 0]].forEach(([x, z]) => { const cup = hk(new THREE.CylinderGeometry(0.038, 0.034, 0.03, 24), mats.black, x, 0.015, z + 0.02); cup.rotation.z = Math.PI / 2; const cush = hk(new THREE.TorusGeometry(0.026, 0.01, 8, 20), mats.fabric2, x + (x < 0 ? -0.016 : 0.016), 0.015, z + 0.02); cush.rotation.y = Math.PI / 2; }); }
    // cables
    // lamp
    cyl(0.1, 0.11, 0.02, mats.metal, -0.85, dy + 0.041, -2.1);
    cyl(0.012, 0.012, 0.5, mats.metal, -0.85, dy + 0.28, -2.1, 12);
    const arm = cyl(0.012, 0.012, 0.42, mats.metal, -0.7, dy + 0.6, -2.02, 12); arm.rotation.z = -1.1; arm.rotation.y = 0.3;
    const shade = add(new THREE.ConeGeometry(0.13, 0.16, 28, 1, true), mats.shade, -0.5, dy + 0.72, -1.95); shade.rotation.z = 0.5;
    add(new THREE.SphereGeometry(0.035, 16, 16), mats.bulb, -0.53, dy + 0.67, -1.95, false);
    const lampLight = new THREE.PointLight('#ffd58a', 0.6, 3, 2); lampLight.position.set(-0.5, dy + 0.62, -1.9); root.add(lampLight);
    // monitor glow spilling onto desk/chair (dark mode only)
    this.screenLight = new THREE.PointLight('#6f8fd6', 0, 2.2, 2.2); this.screenLight.position.set(0.1, dy + 0.5, -1.75); root.add(this.screenLight);

    // chair (padded, armrests)
    const cz = -1.0;
    const ch = new THREE.Group(); ch.position.set(0.05, 0, cz); ch.rotation.y = -0.25; root.add(ch);
    const ck = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; ch.add(o); return o; };
    ck(rboxGeo(0.54, 0.12, 0.54, 0.04), mats.fabric, 0, 0.47, 0);
    ck(rboxGeo(0.5, 0.06, 0.5, 0.02), mats.fabric2, 0, 0.4, 0);
    const back = ck(rboxGeo(0.5, 0.62, 0.1, 0.04), mats.fabric, 0, 0.84, 0.25); back.rotation.x = -0.08;
    ck(rboxGeo(0.44, 0.14, 0.07, 0.03), mats.fabric2, 0, 1.19, 0.29);
    // stitching seam lines on the backrest
    [-0.12, 0, 0.12].forEach(x => { const seam = ck(new THREE.BoxGeometry(0.004, 0.5, 0.004), mats.fabric2, x, 0.84, 0.305); seam.rotation.x = -0.08; });
    [-0.29, 0.29].forEach(x => { ck(new THREE.BoxGeometry(0.05, 0.03, 0.34), mats.black, x, 0.7, 0.03); ck(new THREE.BoxGeometry(0.03, 0.2, 0.03), mats.metal, x, 0.6, 0.15); });
    ck(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 12), mats.metal, 0, 0.23, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = ck(new THREE.BoxGeometry(0.3, 0.025, 0.04), mats.metal, Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15); leg.rotation.y = -a; ck(new THREE.SphereGeometry(0.03, 10, 8), mats.black, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3); }

    // shelves with books, plant, frame, speaker
    box(1.1, 0.035, 0.24, mats.woodDark, -1.75, 1.7, -2.34);
    box(1.1, 0.035, 0.24, mats.woodDark, -1.75, 2.2, -2.34);
    [-2.18, -1.32].forEach(x => { box(0.03, 0.06, 0.2, mats.metal, x, 1.735, -2.34); box(0.03, 0.06, 0.2, mats.metal, x, 2.235, -2.34); });
    let bx = -2.22; [0.06, 0.05, 0.045, 0.06, 0.04, 0.055, 0.05].forEach((w, i) => { const h = 0.22 + (i % 3) * 0.03; box(w, h, 0.17, mats.book[i], bx + w / 2, 1.72 + h / 2, -2.34); bx += w + 0.006; });
    const lean = box(0.05, 0.25, 0.17, mats.book[5], -1.72, 1.85, -2.34); lean.rotation.z = -0.25;
    box(0.16, 0.16, 0.16, mats.black, -1.45, 1.8, -2.34); cyl(0.05, 0.05, 0.005, mats.alu, -1.45, 1.8, -2.255, 20, false);
    cyl(0.07, 0.06, 0.14, mats.pot, -1.35, 2.29, -2.34);
    [[0, 2.44, 0.11], [0.08, 2.4, 0.07], [-0.08, 2.42, 0.07]].forEach(([dx, y, r]) => sph(r, mats.leaf, -1.35 + dx, y, -2.34, 1, 0.8, 1));
    box(0.24, 0.3, 0.02, mats.paper, -1.95, 2.37, -2.34); box(0.16, 0.18, 0.005, M('#9fb2c9', 0.9), -1.95, 2.39, -2.328, false);
    { const fr = box(0.34, 0.26, 0.018, mats.woodDark, -2.05, 2.35, -2.36); fr.rotation.x = -0.12; const im = box(0.29, 0.21, 0.006, M('#e9e1d2', 0.9), -2.05, 2.352, -2.349, false); im.rotation.x = -0.12; const ln = box(0.2, 0.06, 0.004, M('#7fa7cf', 0.9), -2.05, 2.34, -2.344, false); ln.rotation.x = -0.12; }
    // more shelf items: upper shelf — hourglass, camera, small trophy, vinyl; lower shelf — mini succulents, dice, figurine, cable box
    cyl(0.03, 0.03, 0.006, mats.woodDark, -1.62, 2.22, -2.34, 16); cyl(0.028, 0.004, 0.05, mats.glass, -1.62, 2.25, -2.34, 12, false); cyl(0.004, 0.028, 0.05, mats.glass, -1.62, 2.3, -2.34, 12, false); cyl(0.03, 0.03, 0.006, mats.woodDark, -1.62, 2.33, -2.34, 16);
    box(0.11, 0.07, 0.06, mats.black, -1.75, 2.255, -2.34); cyl(0.028, 0.028, 0.03, mats.alu, -1.75, 2.255, -2.295, 20); cyl(0.02, 0.02, 0.006, mats.black, -1.75, 2.255, -2.278, 20, false);
    cyl(0.03, 0.035, 0.012, mats.woodDark, -1.5, 2.224, -2.34, 16); cyl(0.005, 0.005, 0.05, mats.brass, -1.5, 2.255, -2.34, 8); cyl(0.028, 0.012, 0.045, mats.brass, -1.5, 2.3, -2.34, 16); [-0.03, 0.03].forEach(dx => { const hnd = add(new THREE.TorusGeometry(0.012, 0.003, 6, 12, Math.PI), mats.brass, -1.5 + dx, 2.3, -2.34); hnd.rotation.z = dx < 0 ? Math.PI / 2 : -Math.PI / 2; });
    { const rec = cyl(0.11, 0.11, 0.004, mats.black, -2.19, 2.33, -2.28, 32); rec.rotation.x = Math.PI / 2; rec.rotation.z = 0.2; const lbl = cyl(0.035, 0.035, 0.005, M('#d9a441', 0.6), -2.19, 2.33, -2.277, 24, false); lbl.rotation.x = Math.PI / 2; }
    [[-2.2, '#c86b47', '#5f9a4e'], [-2.1, '#efece6', '#7fb069']].forEach(([x, pc, lc]) => { cyl(0.035, 0.03, 0.05, M(pc, 0.8), x, 1.745, -2.24, 16); [[0, 0.03], [0.02, 0.02], [-0.02, 0.02], [0, 0.05]].forEach(([dx, dy2]) => sph(0.018, M(lc, 0.7), x + dx, 1.775 + dy2, -2.24)); });
    [[-1.28, 1.75, 0.1], [-1.31, 1.75, -0.4], [-1.25, 1.785, 0.3]].forEach(([x, y, rot]) => { const d = box(0.028, 0.028, 0.028, mats.ceramic, x, y, -2.3); d.rotation.y = rot; });
    cyl(0.03, 0.035, 0.012, mats.black, -1.57, 1.724, -2.3, 16); cyl(0.02, 0.025, 0.09, M('#e0b070', 0.6), -1.57, 1.775, -2.3, 12); sph(0.03, M('#e0b070', 0.6), -1.57, 1.845, -2.3);
    box(0.14, 0.05, 0.08, M('#d8d0c2', 0.9), -1.42, 1.745, -2.36); box(0.12, 0.004, 0.06, M('#c8bda9', 0.9), -1.42, 1.772, -2.36, false);

    // tall shelf unit (right of door) with boxes and a globe
    { const su = new THREE.Group(); su.position.set(-2.8, 0, 1.75); su.rotation.y = Math.PI / 2; root.add(su);
      const sk = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; su.add(o); return o; };
      [0.5, 1.1, 1.7].forEach(y => sk(new THREE.BoxGeometry(0.9, 0.035, 0.3), mats.woodDark, 0, y, 0));
      [-0.43, 0.43].forEach(x => sk(new THREE.BoxGeometry(0.03, 1.72, 0.3), mats.woodDark, x, 0.86, 0));
      sk(new THREE.BoxGeometry(0.28, 0.24, 0.24), M('#d8d0c2', 0.9), -0.22, 0.64, 0); sk(new THREE.BoxGeometry(0.22, 0.2, 0.22), M('#c8bda9', 0.9), 0.18, 0.62, 0);
      sk(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), mats.brass, 0.05, 1.13, 0); sk(new THREE.SphereGeometry(0.12, 18, 14), M('#6f95c4', 0.6), 0.05, 1.27, 0);
      let sx = -0.4; [0.05, 0.06, 0.04, 0.055, 0.05, 0.06].forEach((w, i) => { const hh2 = 0.2 + (i % 2) * 0.04; sk(new THREE.BoxGeometry(w, hh2, 0.2), mats.book[(i + 2) % 7], sx + w / 2, 1.72 + hh2 / 2, 0); sx += w + 0.005; });
      // middle shelf extras: photo frame, small plant, jar; top shelf: bookend + trailing plant; bottom: basket
      sk(new THREE.BoxGeometry(0.16, 0.2, 0.015), mats.woodDark, -0.25, 1.22, 0.02); sk(new THREE.BoxGeometry(0.12, 0.15, 0.006), M('#dfe6ee', 0.9), -0.25, 1.22, 0.03);
      sk(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 16), mats.pot, 0.3, 1.155, 0); [[0, 0.06, 0.035], [0.03, 0.04, 0.025], [-0.03, 0.045, 0.025]].forEach(([dx, dy2, r]) => sk(new THREE.SphereGeometry(r, 12, 10), mats.leaf, 0.3 + dx, 1.19 + dy2, 0));
      sk(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 16), mats.glass, 0.12, 1.175, 0.02); sk(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), M('#c8a56b', 0.9), 0.12, 1.15, 0.02);
      sk(new THREE.BoxGeometry(0.02, 0.14, 0.14), mats.metal, 0.02, 1.79, 0);
      sk(new THREE.CylinderGeometry(0.05, 0.045, 0.08, 16), mats.potWhite, 0.32, 1.76, 0); [[0, 0.06, 0.04], [0.04, 0.02, 0.03], [-0.04, 0.0, 0.03], [0.06, -0.06, 0.025], [-0.07, -0.08, 0.025]].forEach(([dx, dy2, r]) => sk(new THREE.SphereGeometry(r, 12, 10), mats.leaf2, 0.32 + dx, 1.8 + dy2, 0.02 + Math.abs(dx) * 0.5));
      sk(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 20, 1, true), M('#c9b58f', 0.95, { side: THREE.DoubleSide }), 0.22, 0.12, 0); sk(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), M('#7a6448', 0.9), 0.22, 0.03, 0);
      sk(new THREE.BoxGeometry(0.22, 0.14, 0.24), M('#b8b0a3', 0.9), -0.22, 0.09, 0); sk(new THREE.BoxGeometry(0.24, 0.02, 0.26), M('#a39b8e', 0.9), -0.22, 0.17, 0);
    }
    // floor lamp (arc) beside chair
    cyl(0.14, 0.16, 0.02, mats.metal, -2.55, 0.01, -2.1, 24); cyl(0.015, 0.015, 1.7, mats.metal, -2.55, 0.86, -2.1, 10);
    const fshade = add(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 28, 1, true), mats.shade, -2.55, 1.78, -2.1); fshade.rotation.z = 0;
    // side table with books and a candle
    cyl(0.22, 0.22, 0.02, mats.wood, 1.65, 0.45, -0.9, 28); cyl(0.02, 0.02, 0.44, mats.metal, 1.65, 0.22, -0.9, 10);
    box(0.2, 0.03, 0.15, mats.book[4], 1.65, 0.475, -0.9); cyl(0.03, 0.03, 0.08, mats.potWhite, 1.75, 0.5, -0.8, 16);
    // floor plant (monstera-ish: flattened leaves) + basket
    cyl(0.2, 0.16, 0.34, mats.potWhite, 1.95, 0.17, -1.85);
    cyl(0.14, 0.14, 0.02, mats.woodDark, 1.95, 0.35, -1.85);
    cyl(0.018, 0.026, 0.55, mats.woodDark, 1.95, 0.625, -1.85, 8);
    { // leaves: each on its own stem, fanning out from the trunk top
      const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.12, 0.02, 0.2, 0.14, 0.14, 0.3); leafShape.bezierCurveTo(0.1, 0.4, 0.04, 0.46, 0, 0.5); leafShape.bezierCurveTo(-0.04, 0.46, -0.1, 0.4, -0.14, 0.3); leafShape.bezierCurveTo(-0.2, 0.14, -0.12, 0.02, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leafShape, 12);
      const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7f4c', roughness: 0.7, side: THREE.DoubleSide });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: '#4f9459', roughness: 0.7, side: THREE.DoubleSide });
      const top = new THREE.Vector3(1.95, 0.9, -1.85);
      for (let i = 0; i < 7; i++) {
        const ang = i / 7 * Math.PI * 2 + 0.4, len = 0.22 + (i % 3) * 0.07, tilt = 0.55 + (i % 3) * 0.25;
        const dir = new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt));
        const end = top.clone().addScaledVector(dir, len);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 6), mats.woodDark);
        stem.position.copy(top).addScaledVector(dir, len / 2); stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); stem.castShadow = true; root.add(stem);
        const leaf = new THREE.Mesh(leafGeo, i % 2 ? leafMat : leafMat2);
        leaf.position.copy(end); leaf.scale.setScalar(0.6 + (i % 3) * 0.1);
        leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); leaf.rotateY(Math.PI / 2); leaf.rotateX(-0.6 + (i % 2) * 0.25);
        leaf.castShadow = true; root.add(leaf);
      }
    }

    // framed prints on back wall (pair)
    [[1.3, 1.85, 0.5, 0.65, '#dfe6ee', '#9fb2c9'], [1.95, 1.75, 0.4, 0.5, '#e9e1d2', '#c8a56b']].forEach(([x, y, w, h, c1, c2]) => {
      box(w, h, 0.03, mats.woodDark, x, y, -2.44); box(w - 0.08, h - 0.08, 0.01, M(c1, 0.9), x, y, -2.42, false); box(w * 0.55, h * 0.3, 0.005, M(c2, 0.9), x, y - h * 0.12, -2.415, false);
    });
    // wall clock
    { const rim = cyl(0.17, 0.17, 0.03, mats.black, -0.9, 2.55, -2.445, 40); rim.rotation.x = Math.PI / 2;
      const face = cyl(0.15, 0.15, 0.012, mats.white, -0.9, 2.55, -2.432, 40, false); face.rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(0.006, i % 3 ? 0.012 : 0.022, 0.004, mats.black, -0.9 + Math.sin(a) * 0.13, 2.55 + Math.cos(a) * 0.13, -2.424, false).rotation.z = -a; }
      const hh = box(0.012, 0.08, 0.004, mats.black, -0.9, 2.55, -2.422, false); hh.geometry.translate(0, 0.04, 0); hh.rotation.z = -0.9;
      const mh = box(0.008, 0.12, 0.004, mats.black, -0.9, 2.55, -2.421, false); mh.geometry.translate(0, 0.06, 0); mh.rotation.z = 2.4;
      cyl(0.008, 0.008, 0.006, mats.brass, -0.9, 2.55, -2.42, 12, false).rotation.x = Math.PI / 2; }

    // pendant lamp
    cyl(0.005, 0.005, 0.9, mats.cable, 0.3, 2.75, -0.6, 6, false);
    const pend = add(new THREE.SphereGeometry(0.16, 24, 16), mats.pendant, 0.3, 2.22, -0.6, false);
    const pendantLight = new THREE.PointLight('#ffe1a8', 0.3, 8, 1.6); pendantLight.position.set(0.3, 2.1, -0.6); pendantLight.castShadow = true; pendantLight.shadow.mapSize.set(512, 512); pendantLight.shadow.bias = -0.002; root.add(pendantLight);

    // lights
    const amb = new THREE.HemisphereLight('#f4f1ea', '#8a7256', 0.85); scene.add(amb);
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.5); fill.position.set(4, 3, 4); scene.add(fill);
    const sun = new THREE.DirectionalLight('#fff1dc', 2.6); sun.position.set(-9, 4.6, -0.6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    const sc = sun.shadow.camera; sc.left = -4.5; sc.right = 4.5; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 18;
    sun.shadow.mapSize.set(2048, 2048);
    sun.target.position.set(-0.4, 0.0, -0.3);
    const winFill = new THREE.PointLight('#dbe9ff', 0.8, 5, 1.6); winFill.position.set(-2.6, 1.7, -0.3); root.add(winFill); scene.add(sun); scene.add(sun.target);
    this.T = { amb, sun, fill, screen: mats.screen, screen2: mats.screen2, lampLight, bulb: mats.bulb, pendant: mats.pendant, pendantLight, scene, windowGlow: mats.glass, renderer }; this.applyTheme();

    this.scrollers = [scroller(this.tx1, 1), scroller(this.tx2, 2), scroller(this.tx3, 3)];
    const focus = new THREE.Vector3(0.5, 1.0, -1.5);
    let cw = 1, chh = 1;
    const resize = () => {
      cw = this.clientWidth || 1; chh = this.clientHeight || 1; const k = Math.min(1, 1100 / cw);
      renderer.setSize(Math.round(cw * k), Math.round(chh * k), false);
      camera.aspect = cw / chh; camera.updateProjectionMatrix();
    };
    this.ro = new ResizeObserver(resize); this.ro.observe(this); resize();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = 0;
    const tick = (t) => {
      if (this.dead) return;
      this.raf = requestAnimationFrame(tick);
      if (document.hidden || t - last < 40) return;
      last = t;
      this.mouse.x += (this.target.x - this.mouse.x) * 0.03; this.mouse.y += (this.target.y - this.mouse.y) * 0.03;
      const a = 0.62 + (reduce ? 0 : Math.sin(t * 0.0001) * 0.14) + this.mouse.x * 0.22;
      camera.position.set(focus.x + Math.sin(a) * 6.6, 2.1 - this.mouse.y * 0.45 + (reduce ? 0 : Math.sin(t * 0.00017) * 0.08), focus.z + Math.cos(a) * 6.6);
      camera.lookAt(focus); camera.setViewOffset(cw, chh, -cw * 0.28, 0, cw, chh);
      if (this.clouds) this.clouds.forEach((c, i) => { c.position.z = ((t * 0.00004 * (1 + i * 0.3) + i * 1.3) % 4.2) - 2.1; });
      if (this.birds) this.birds.forEach(b => { const o = b.userData.o; b.position.z = ((t * 0.00025 + o * 0.9) % 5) - 2.5; b.position.y = 2.9 + o * 0.06 + Math.sin(t * 0.004 + o) * 0.02; b.scale.y = 0.6 + Math.abs(Math.sin(t * 0.012 + o)) * 0.8; });
      this.scrollers.forEach(f => f(t));
      const base = this.screenBase || 0.7;
      mats.screen.emissiveIntensity = base * (1 + Math.sin(t * 0.003) * 0.03);
      mats.screen2.emissiveIntensity = base * 0.8 * (1 + Math.sin(t * 0.0024 + 1) * 0.03);
      renderer.render(scene, camera);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
if (!customElements.get('office-scene')) customElements.define('office-scene', OfficeScene);
