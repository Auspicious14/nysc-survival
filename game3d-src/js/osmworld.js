// Real towns from OpenStreetMap (© OpenStreetMap contributors, ODbL), prepared by tools/osm_prep.py.
// The game's own street runs along x; everything here sits around it in the same metres.
import * as THREE from 'three';
import { mergeGeometries } from './BufferGeometryUtils.js';

export async function loadOSM(id) {
  try { const r = await fetch(`osm/${id}.json`); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
}
const pairs = f => { const o = []; for (let i = 0; i + 1 < f.length; i += 2) o.push([f[i], f[i + 1]]); return o; };
const hash = (a, b = 0) => { let h = 2166136261 ^ b; for (const v of a) { h ^= (v * 73856093) | 0; h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };
const ROADW = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 8, unclassified: 6.5, residential: 6, living_street: 5, service: 4, pedestrian: 4, track: 3.5, motorway_link: 7, trunk_link: 7, primary_link: 7, secondary_link: 6, tertiary_link: 6 };
const PAVED = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);

function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
// one storey of plaster wall with a window and a little dirt at the bottom; tinted per building by vertex colour
const wallTex = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 50},60,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, 'rgba(110,80,50,0)'); gr.addColorStop(1, 'rgba(110,80,50,.28)'); g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
  g.fillStyle = '#3d4650'; g.fillRect(36, 30, 56, 46); g.fillStyle = '#7a8a96'; g.fillRect(40, 34, 22, 38); g.fillRect(66, 34, 22, 38);
  g.strokeStyle = '#d8d2c4'; g.lineWidth = 4; g.strokeRect(34, 28, 60, 50); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(34, 78, 60, 4);
});
function buildingsGeo(list) {
  const P = [], N = [], U = [], C = [], R = [], RN = [], RC = [];
  const wallCols = [[0.97, 0.94, 0.86], [0.93, 0.88, 0.78], [0.86, 0.9, 0.93], [0.95, 0.86, 0.8], [0.8, 0.86, 0.78], [0.98, 0.97, 0.95], [0.78, 0.74, 0.7], [0.96, 0.9, 0.7]];
  for (const [h, special, f] of list) {
    let pts = pairs(f); if (pts.length < 3) continue;
    let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts = pts.reverse(); // counter-clockwise in (x, z)
    const r = hash(f), wc = special ? [0.98, 0.97, 0.94] : wallCols[Math.floor(r * wallCols.length)], H = h;
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.2) continue;
      const nx = (z1 - z0) / L, nz = -(x1 - x0) / L; // outward for CCW in x/z with y up
      const u1 = L / 3.2, v1 = H / 3.1;
      P.push(x0, 0, z0, x1, 0, z1, x1, H, z1, x0, 0, z0, x1, H, z1, x0, H, z0);
      for (let k = 0; k < 6; k++) { N.push(nx, 0, nz); C.push(...wc); }
      U.push(0, 0, u1, 0, u1, v1, 0, 0, u1, v1, 0, v1);
    }
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
    const flat = H > 4.5 || special, rc = special ? [0.92, 0.9, 0.85] : flat ? [0.72, 0.71, 0.68] : (r > 0.55 ? [0.62, 0.36, 0.22] : r > 0.25 ? [0.6, 0.62, 0.64] : [0.42, 0.44, 0.47]);
    for (const t of tri) for (const i of [t[0], t[2], t[1]]) { R.push(pts[i][0], H, pts[i][1]); RN.push(0, 1, 0); RC.push(...rc); }
  }
  const walls = new THREE.BufferGeometry(); walls.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); walls.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); walls.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); walls.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const roofs = new THREE.BufferGeometry(); roofs.setAttribute('position', new THREE.Float32BufferAttribute(R, 3)); roofs.setAttribute('normal', new THREE.Float32BufferAttribute(RN, 3)); roofs.setAttribute('color', new THREE.Float32BufferAttribute(RC, 3));
  return { walls, roofs };
}
function ribbon(pts, w, y) { // flat strip along a polyline
  const P = [], N = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.1) continue;
    const ox = -(z1 - z0) / L * w / 2, oz = (x1 - x0) / L * w / 2, e = w * 0.35, ex = (x1 - x0) / L * e, ez = (z1 - z0) / L * e; // little overlap hides joints
    const a = [x0 - ex + ox, z0 - ez + oz], b = [x0 - ex - ox, z0 - ez - oz], c = [x1 + ex - ox, z1 + ez - oz], d = [x1 + ex + ox, z1 + ez + oz];
    P.push(a[0], y, a[1], c[0], y, c[1], b[0], y, b[1], a[0], y, a[1], d[0], y, d[1], c[0], y, c[1]);
    for (let k = 0; k < 6; k++) N.push(0, 1, 0);
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}
function poly(pts, y) {
  if (pts.length < 3) return null; const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []); if (!tri.length) return null;
  let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const P = [], N = []; for (const t of tri) for (const i of (area > 0 ? [t[0], t[2], t[1]] : t)) { P.push(pts[i][0], y, pts[i][1]); N.push(0, 1, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}
/* ---------- landmarks on the skyline: simple, recognisable shapes at their real bearing ---------- */
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + 0.18 * Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 + seed * 2) + 0.12 * Math.sin(y * 7.7 + seed * 3) + 0.06 * Math.sin((x + z) * 13 + seed);
    p.setXYZ(i, x * n, Math.max(y, -0.15) * n, z * n);
  }
  g.computeVertexNormals(); return g;
}
function landmarkMesh(t, name, mat, matB) {
  const G = new THREE.Group(), add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); G.add(o); return o; };
  const s = hash([...name].map(c => c.charCodeAt(0)));
  if (t === 'rock') { add(rockGeo(s * 10), mat, 0, 0, 0, 130, 70, 95); add(rockGeo(s * 20 + 3), mat, 70, 0, 25, 70, 42, 55); }
  else if (t === 'mosque') { add(new THREE.BoxGeometry(40, 14, 40), matB, 0, 7, 0); add(new THREE.SphereGeometry(13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 14, 0); for (const [x, z] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) { add(new THREE.CylinderGeometry(1.6, 2, 42, 10), matB, x, 21, z); add(new THREE.ConeGeometry(2.2, 6, 10), mat, x, 45, z); } }
  else if (t === 'church') { add(new THREE.BoxGeometry(22, 16, 46), matB, 0, 8, 0); add(new THREE.CylinderGeometry(0.1, 16, 9, 4, 1), mat, 0, 20.5, 0, 1, 1, 2.1).rotation.y = Math.PI / 4; add(new THREE.BoxGeometry(9, 32, 9), matB, 0, 16, 27); add(new THREE.ConeGeometry(6.4, 16, 4), mat, 0, 40, 27).rotation.y = Math.PI / 4; add(new THREE.BoxGeometry(0.8, 6, 0.8), mat, 0, 51, 27); add(new THREE.BoxGeometry(3.6, 0.8, 0.8), mat, 0, 52, 27); }
  else if (t === 'stadium') { const mb = matB.clone(); mb.side = THREE.DoubleSide; add(new THREE.CylinderGeometry(110, 95, 24, 40, 1, true), mb, 0, 12, 0, 1, 1, 0.75); for (const [x, z] of [[-95, -70], [95, -70], [-95, 70], [95, 70]]) { add(new THREE.CylinderGeometry(0.9, 1.2, 46, 6), mat, x, 23, z); add(new THREE.BoxGeometry(12, 7, 1.5), mat, x, 47, z); } }
  else if (t === 'tower') { add(new THREE.BoxGeometry(24, 100, 24), matB, 0, 50, 0); add(new THREE.BoxGeometry(18, 8, 18), mat, 0, 104, 0); add(new THREE.CylinderGeometry(0.5, 0.5, 18, 6), mat, 0, 117, 0); }
  else if (t === 'bridge') { add(new THREE.BoxGeometry(520, 3, 22), matB, 0, 16, 0); for (let x = -240; x <= 240; x += 60) add(new THREE.BoxGeometry(5, 16, 14), mat, x, 8, 0); for (const x of [-60, 60]) add(new THREE.BoxGeometry(4, 50, 4), mat, x, 25, 0); }
  else if (t === 'monument') { add(new THREE.BoxGeometry(10, 4, 10), matB, 0, 2, 0); add(new THREE.CylinderGeometry(1.4, 3.2, 30, 4), mat, 0, 19, 0); }
  else if (t === 'palace') { add(new THREE.BoxGeometry(90, 9, 70), matB, 0, 4.5, 0); add(new THREE.BoxGeometry(30, 16, 24), matB, 0, 8, 0); for (const x of [-12, 12]) add(new THREE.ConeGeometry(4, 8, 4), mat, x, 20, 0); }
  else if (t === 'airport') { add(new THREE.CylinderGeometry(3.5, 4.5, 30, 10), matB, 0, 15, 0); add(new THREE.CylinderGeometry(7, 5, 6, 10), mat, 0, 33, 0); add(new THREE.BoxGeometry(120, 12, 40), matB, 70, 6, 0); }
  else { add(new THREE.BoxGeometry(46, 38 + s * 30, 30), matB, 0, (38 + s * 30) / 2, 0); add(new THREE.BoxGeometry(60, 10, 40), matB, 20, 5, 0); }
  return G;
}
export function buildOSM(scene, D, fogColor) {
  const root = new THREE.Group(); root.name = 'osm'; scene.add(root);
  // ground that reaches the horizon
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: 0x9b876a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true; root.add(ground);
  // green and water
  const gg = [], wg = []; for (const [, , f] of D.green) { const g = poly(pairs(f), 0.015); if (g) gg.push(g); } for (const [k, , f] of D.water) { const p = pairs(f); const g = k === 'water' ? poly(p, 0.02) : ribbon(p, k === 'river' ? 14 : 3, 0.02); if (g) wg.push(g); }
  if (gg.length) root.add(new THREE.Mesh(mergeGeometries(gg), new THREE.MeshStandardMaterial({ color: 0x5f7d3a, roughness: 1 })));
  if (wg.length) root.add(new THREE.Mesh(mergeGeometries(wg), new THREE.MeshStandardMaterial({ color: 0x48606a, roughness: 0.2, metalness: 0.2 })));
  // roads: tarred and laterite
  const tar = [], lat = [], walk = [];
  for (const [cls, nm, f] of D.roads) {
    const w = ROADW[cls]; if (!w) continue; const p = pairs(f);
    const paved = PAVED.has(cls) || (cls !== 'track' && hash(f, 7) < (nm ? 0.75 : 0.35));
    const g = ribbon(p, w, paved ? 0.035 + (w > 7 ? 0.004 : 0) : 0.03); if (!g) continue;
    (cls === 'pedestrian' ? walk : paved ? tar : lat).push(g);
  }
  if (tar.length) { const m = new THREE.Mesh(mergeGeometries(tar), new THREE.MeshStandardMaterial({ color: 0x4a4a4c, roughness: 0.95 })); m.receiveShadow = true; root.add(m); }
  if (lat.length) root.add(new THREE.Mesh(mergeGeometries(lat), new THREE.MeshStandardMaterial({ color: 0xa8673f, roughness: 1 })));
  if (walk.length) root.add(new THREE.Mesh(mergeGeometries(walk), new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 1 })));
  // buildings (two merged meshes for the whole town)
  if (D.bld.length) {
    const { walls, roofs } = buildingsGeo(D.bld), wt = wallTex();
    const wm = new THREE.Mesh(walls, new THREE.MeshStandardMaterial({ map: wt, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide })); wm.castShadow = false; wm.receiveShadow = true; root.add(wm);
    root.add(new THREE.Mesh(roofs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide })));
  }
  // landmarks: real bearing, pulled in to a visible distance, kept at a believable angular size
  const LM = [];
  for (const [t, name, x, z, dist] of D.lm || []) {
    const d = Math.max(1, Math.hypot(x, z)), place = Math.min(Math.max(d, 330), 900), k = place / d, scale = Math.max(Math.min(1, place / Math.max(dist, 1)), t === 'rock' || t === 'tower' || t === 'mosque' ? 0.85 : 0.6);
    const haze = Math.min(0.7, 0.25 + dist / 30000), col = new THREE.Color(t === 'rock' ? 0x6f6658 : t === 'mosque' ? 0x9fb8a2 : t === 'church' ? 0xb04a3a : 0x8d8d8a).lerp(new THREE.Color(fogColor), haze), colB = new THREE.Color(t === 'rock' ? 0x7d7262 : 0xe8e2d4).lerp(new THREE.Color(fogColor), haze);
    const mk = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, fog: false, emissive: c.clone().multiplyScalar(0.45) }), mat = mk(col), matB = mk(colB);
    const g = landmarkMesh(t, name, mat, matB); g.position.set(x * k, -0.5, z * k); g.scale.setScalar(scale); g.rotation.y = hash([x, z]) * 6.28; root.add(g);
    LM.push({ t, name, dist, x, z, mesh: g });
  }
  root.userData.LM = LM;
  return root;
}
/* ---------- the phone map's base layer ---------- */
let cache = null;
function paths(D) {
  if (cache && cache.D === D) return cache;
  const P = f => { const p = new Path2D(); const a = pairs(f); a.forEach(([x, z], i) => i ? p.lineTo(x, z) : p.moveTo(x, z)); return p; };
  const roads = {}, labels = [];
  for (const [cls, nm, f] of D.roads) { const w = ROADW[cls]; if (!w) continue; (roads[w] = roads[w] || new Path2D()).addPath(P(f));
    if (nm) { const a = pairs(f); let best = null; for (let i = 0; i + 1 < a.length; i++) { const L = Math.hypot(a[i + 1][0] - a[i][0], a[i + 1][1] - a[i][1]); if (!best || L > best.L) best = { L, x: (a[i][0] + a[i + 1][0]) / 2, z: (a[i][1] + a[i + 1][1]) / 2, ang: Math.atan2(a[i + 1][1] - a[i][1], a[i + 1][0] - a[i][0]) }; } if (best && best.L > 25) labels.push({ nm, ...best, w }); } }
  labels.sort((a, b) => b.w - a.w || b.L - a.L);
  const bld = new Path2D(); for (const [, , f] of D.bld) { const p = P(f); p.closePath(); bld.addPath(p); }
  const green = new Path2D(); for (const [, , f] of D.green) { const p = P(f); p.closePath(); green.addPath(p); }
  const water = new Path2D(), river = new Path2D(); for (const [k, , f] of D.water) (k === 'water' ? water : river).addPath(P(f));
  return cache = { D, roads, labels, bld, green, water, river };
}
export function drawOSMMap(g, D, W, H, cx, cz, k, full) {
  const c = paths(D);
  g.save(); g.translate(W / 2 - cx * k, H / 2 - cz * k); g.scale(k, k);
  g.fillStyle = '#d5e8c4'; g.fill(c.green); g.fillStyle = '#aad3df'; g.fill(c.water); g.strokeStyle = '#aad3df'; g.lineWidth = 6; g.stroke(c.river);
  g.fillStyle = '#e0dcd5'; g.strokeStyle = '#cbc5bb'; g.lineWidth = 0.6; g.fill(c.bld); if (k > 1.2) g.stroke(c.bld);
  g.lineCap = g.lineJoin = 'round';
  const ws = Object.keys(c.roads).map(Number).sort((a, b) => a - b);
  for (const w of ws) { g.strokeStyle = '#c3c8cf'; g.lineWidth = w + 1.6 / k * 2; g.stroke(c.roads[w]); }
  for (const w of ws) { g.strokeStyle = w >= 10 ? '#fde293' : '#ffffff'; g.lineWidth = w; g.stroke(c.roads[w]); }
  g.restore();
  if (full) { // street names along the real roads
    const used = []; g.font = '500 10px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of c.labels) {
      const x = W / 2 + (l.x - cx) * k, y = H / 2 + (l.z - cz) * k; if (x < -40 || y < -20 || x > W + 40 || y > H + 20) continue;
      const tw = g.measureText(l.nm).width; if (tw > l.L * k * 1.15) continue;
      if (used.some(u => Math.hypot(u.x - x, u.y - y) < 70)) continue; used.push({ x, y });
      let a = l.ang; if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
      g.save(); g.translate(x, y); g.rotate(a); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(l.nm, 0, 0); g.fillStyle = '#5f6368'; g.fillText(l.nm, 0, 0); g.restore();
      if (used.length > 14) break;
    }
    if (k > 0.9) { // real named places (shops, churches, banks…) as small grey pins
      const IC = { place_of_worship: '⛪', bank: '🏦', fuel: '⛽', hospital: '🏥', clinic: '🏥', pharmacy: '💊', school: '🏫', restaurant: '🍲', fast_food: '🍔', bar: '🍺', marketplace: '🧺', police: '👮', bus_stop: '🚏', hotel: '🏨', supermarket: '🛒', convenience: '🛒' };
      g.font = '500 9px system-ui, sans-serif';
      for (const [kind, nm, x0, z0] of D.poi) {
        const x = W / 2 + (x0 - cx) * k, y = H / 2 + (z0 - cz) * k; if (x < 0 || y < 0 || x > W || y > H) continue;
        if (used.some(u => Math.hypot(u.x - x, u.y - y) < 46)) continue; used.push({ x, y });
        g.fillStyle = '#8e8e93'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '9px system-ui'; g.fillText(IC[kind] || '•', x, y + 0.5);
        g.font = '500 9px system-ui, sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(nm, x, y + 14); g.fillStyle = '#6b6b70'; g.fillText(nm, x, y + 14);
      }
    }
  }
}
export function compass(x, z) { // game frame: -z is the "north side" of the street; convert using the town's rotation
  return Math.atan2(x, -z);
}
