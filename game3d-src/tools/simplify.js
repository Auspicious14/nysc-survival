// Mesh decimation for the character models (half-edge collapse with quadric error, skin weights preserved).
// usage: node tools/simplify.js models/lewis 0.35   (reads/writes <name>.gltf.json + <name>.b64.txt; keeps a .orig copy)
const fs = require('fs');
const [, , base, ratioArg] = process.argv, ratio = +ratioArg || 0.35;
const jf = base + '.gltf.json', bf = base + '.b64.txt';
if (!fs.existsSync(jf + '.orig')) { fs.copyFileSync(jf, jf + '.orig'); fs.copyFileSync(bf, bf + '.orig'); }
const g = JSON.parse(fs.readFileSync(jf + '.orig', 'utf8')), bin = Buffer.from(fs.readFileSync(bf + '.orig', 'utf8').trim(), 'base64');
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
function read(ai) {
  const a = g.accessors[ai], bv = g.bufferViews[a.bufferView], [T, sz] = CT[a.componentType], n = NC[a.type], stride = bv.byteStride || sz * n, off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new T(a.count * n), dv = new DataView(bin.buffer, bin.byteOffset);
  const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[get](off + i * stride + k * sz, true);
  return out;
}
const data = g.accessors.map((_, i) => read(i));
// ---- simplify one primitive ----
function simplify(pos, idx, target) {
  const nv = pos.length / 3, nf = idx.length / 3;
  // position ids (seam detection)
  const key = new Map(), pid = new Int32Array(nv), cnt = [];
  for (let i = 0; i < nv; i++) { const k = pos[i * 3] + ',' + pos[i * 3 + 1] + ',' + pos[i * 3 + 2]; let id = key.get(k); if (id === undefined) { id = cnt.length; key.set(k, id); cnt.push(0); } pid[i] = id; cnt[id]++; }
  const faces = new Int32Array(idx), alive = new Uint8Array(nf).fill(1), vf = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[faces[f * 3 + k]].push(f);
  // boundary edges → lock both ends; seam vertices → locked
  const locked = new Uint8Array(nv); for (let i = 0; i < nv; i++) if (cnt[pid[i]] > 1) locked[i] = 1;
  const ec = new Map(); for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { const a = faces[f * 3 + k], b = faces[f * 3 + (k + 1) % 3], e = a < b ? a * nv + b : b * nv + a; ec.set(e, (ec.get(e) || 0) + 1); }
  for (const [e, c] of ec) if (c === 1) { locked[Math.floor(e / nv)] = 1; locked[e % nv] = 1; }
  // quadrics
  const Q = new Float64Array(nv * 10);
  const fnorm = (f, out, sub, by) => { const i = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]].map(v => v === sub ? by : v); const ax = pos[i[0] * 3], ay = pos[i[0] * 3 + 1], az = pos[i[0] * 3 + 2]; const ux = pos[i[1] * 3] - ax, uy = pos[i[1] * 3 + 1] - ay, uz = pos[i[1] * 3 + 2] - az, vx = pos[i[2] * 3] - ax, vy = pos[i[2] * 3 + 1] - ay, vz = pos[i[2] * 3 + 2] - az; out[0] = uy * vz - uz * vy; out[1] = uz * vx - ux * vz; out[2] = ux * vy - uy * vx; out[3] = ax; out[4] = ay; out[5] = az; return out; };
  const t = new Float64Array(6), t2 = new Float64Array(6);
  for (let f = 0; f < nf; f++) { fnorm(f, t); const l = Math.hypot(t[0], t[1], t[2]); if (l < 1e-20) continue; const a = t[0] / l, b = t[1] / l, c = t[2] / l, d = -(a * t[3] + b * t[4] + c * t[5]), w = l; const q = [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d]; for (let k = 0; k < 3; k++) { const v = faces[f * 3 + k]; for (let j = 0; j < 10; j++) Q[v * 10 + j] += q[j] * w; } }
  const err = (u, v) => { const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2]; let s = 0; const q = j => Q[u * 10 + j] + Q[v * 10 + j]; s = q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y + q(7) * z * z + 2 * q(8) * z + q(9); const dx = pos[u * 3] - x, dy = pos[u * 3 + 1] - y, dz = pos[u * 3 + 2] - z; return Math.abs(s) + 1e-7 * (dx * dx + dy * dy + dz * dz); };
  // heap of [cost, u, v, stampU, stampV]
  const H = []; const stamp = new Int32Array(nv);
  const push = (c, u, v) => { H.push([c, u, v, stamp[u], stamp[v]]); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break;[H[p], H[i]] = [H[i], H[p]]; i = p; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (; ;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break;[H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
  const neigh = u => { const s = new Set(); for (const f of vf[u]) if (alive[f]) for (let k = 0; k < 3; k++) { const w = faces[f * 3 + k]; if (w !== u) s.add(w); } return s; };
  const pushV = u => { if (locked[u]) return; for (const v of neigh(u)) push(err(u, v), u, v); };
  for (let u = 0; u < nv; u++) pushV(u);
  let live = nf;
  while (live > target && H.length) {
    const [c, u, v, su, sv] = pop(); if (su !== stamp[u] || sv !== stamp[v] || locked[u]) continue;
    // flip check
    let ok = true; for (const f of vf[u]) { if (!alive[f]) continue; const a = faces[f * 3], b = faces[f * 3 + 1], cc = faces[f * 3 + 2]; if (a === v || b === v || cc === v) continue; fnorm(f, t); fnorm(f, t2, u, v); const d = t[0] * t2[0] + t[1] * t2[1] + t[2] * t2[2], l1 = Math.hypot(t[0], t[1], t[2]), l2 = Math.hypot(t2[0], t2[1], t2[2]); if (l2 < 1e-14 || d < 0.3 * l1 * l2) { ok = false; break; } }
    if (!ok) continue;
    for (const f of vf[u]) { if (!alive[f]) continue; let has = false; for (let k = 0; k < 3; k++) if (faces[f * 3 + k] === v) has = true; if (has) { alive[f] = 0; live--; } else { for (let k = 0; k < 3; k++) if (faces[f * 3 + k] === u) faces[f * 3 + k] = v; vf[v].push(f); } }
    vf[u] = []; for (let j = 0; j < 10; j++) Q[v * 10 + j] += Q[u * 10 + j];
    stamp[u]++; stamp[v]++; const ns = neigh(v); pushV(v); for (const w of ns) { stamp[w]++; pushV(w); }
  }
  // compact
  const remap = new Int32Array(nv).fill(-1), keep = [], out = [], src = [];
  for (let f = 0; f < nf; f++) if (alive[f]) { src.push(f); for (let k = 0; k < 3; k++) { const v = faces[f * 3 + k]; if (remap[v] < 0) { remap[v] = keep.length; keep.push(v); } out.push(remap[v]); } }
  return { keep, idx: out, src };
}
let before = 0, after = 0; const groups = new Map();
for (const m of g.meshes) for (const p of m.primitives) {
  if (p.indices === undefined || (p.mode !== undefined && p.mode !== 4)) continue;
  const sig = JSON.stringify(p.attributes); if (!groups.has(sig)) groups.set(sig, { attrs: p.attributes, idxs: [] }); const G = groups.get(sig); if (!G.idxs.includes(p.indices)) G.idxs.push(p.indices);
}
for (const G of groups.values()) { // primitives that share vertex data are simplified together, then split again
  const parts = G.idxs.map(i => data[i]), total = parts.reduce((n, d) => n + d.length, 0), idx = new Uint32Array(total), ends = []; let o = 0; for (const d of parts) { idx.set(d, o); o += d.length; ends.push(o / 3); }
  before += total / 3; const r = simplify(data[G.attrs.POSITION], idx, Math.max(200, Math.round(total / 3 * ratio))); after += r.idx.length / 3;
  for (const ai of new Set(Object.values(G.attrs))) { const a = g.accessors[ai], n = NC[a.type], src = data[ai], dst = new src.constructor(r.keep.length * n); r.keep.forEach((v, i) => { for (let k = 0; k < n; k++) dst[i * n + k] = src[v * n + k]; }); data[ai] = dst; a.count = r.keep.length;
    if (a.min) { a.min = Array(n).fill(Infinity); a.max = Array(n).fill(-Infinity); for (let i = 0; i < r.keep.length; i++) for (let k = 0; k < n; k++) { a.min[k] = Math.min(a.min[k], dst[i * n + k]); a.max[k] = Math.max(a.max[k], dst[i * n + k]); } } }
  const outs = G.idxs.map(() => []); r.src.forEach((f, j) => { const gi = ends.findIndex(e => f < e); outs[gi].push(r.idx[j * 3], r.idx[j * 3 + 1], r.idx[j * 3 + 2]); });
  G.idxs.forEach((ai, gi) => { const ia = g.accessors[ai], big = r.keep.length > 65535; data[ai] = big ? Uint32Array.from(outs[gi]) : Uint16Array.from(outs[gi]); ia.componentType = big ? 5125 : 5123; ia.count = outs[gi].length; });
}
// rebuild the buffer: one tight view per accessor
const chunks = []; let off = 0; const views = [];
g.accessors.forEach((a, i) => { const d = data[i], b = Buffer.from(d.buffer, d.byteOffset, d.byteLength), pad = (4 - b.length % 4) % 4; views.push({ buffer: 0, byteOffset: off, byteLength: b.length }); a.bufferView = i; delete a.byteOffset; chunks.push(b, Buffer.alloc(pad)); off += b.length + pad; });
g.bufferViews = views; g.buffers = [{ byteLength: off }];
fs.writeFileSync(jf, JSON.stringify(g)); fs.writeFileSync(bf, Buffer.concat(chunks).toString('base64'));
console.log(base, 'triangles', before, '→', after);
