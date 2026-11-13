// NYSC Survival 3D — world-first street slice.
// Engine: three.js r160. Characters: Mixamo rigs from the three.js examples (recoloured at load).
import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';
import * as SkeletonUtils from './SkeletonUtils.js';
import { Sky } from './Sky.js';
import { mergeGeometries } from './BufferGeometryUtils.js';
import { STATES, ZONES } from './naija.js';
import { mountWhot, mountDash } from './phonegames.js';

const $ = id => document.getElementById(id);
const TOUCH = matchMedia('(hover:none)').matches || innerWidth < 760;
const BAKE = /bake/.test(location.hash);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// LGA profiles: the same Lagos street, but the posting changes how crowded, chaotic and expensive service life is.
// Numbers are game tuning, not official NYSC figures.
const POSTINGS = [
  { id: 'ikeja', short: 'Ikeja', density: 'High', w: 4, blurb: 'State capital. Huge CDS groups, long clearance queues, and a group chat that never sleeps.', queue: 16, rumour: 0.6, cdsOff: 0.2, rent: 15000, food: 1800, fx: 1, hustle: 1, crowd: 1 },
  { id: 'alimosho', short: 'Alimosho', density: 'Very high', w: 2, blurb: 'The biggest LGA in Lagos. Everything is a crowd, including the crowd.', queue: 22, rumour: 0.75, cdsOff: 0.25, rent: 10000, food: 1500, fx: 1.15, hustle: 1.1, crowd: 1 },
  { id: 'etiosa', short: 'Eti-Osa', density: 'Medium', w: 2, blurb: 'Lekki and VI. Big money all around you. Small money in your account.', queue: 10, rumour: 0.4, cdsOff: 0.15, rent: 30000, food: 3000, fx: 1.6, hustle: 1.8, crowd: 0.8 },
  { id: 'surulere', short: 'Surulere', density: 'High', w: 2, blurb: 'Stadium, bukas, and an owambe every Saturday.', queue: 13, rumour: 0.5, cdsOff: 0.2, rent: 12000, food: 1700, fx: 1, hustle: 1.1, crowd: 0.9 },
  { id: 'epe', short: 'Epe', density: 'Low', w: 2, blurb: 'Lagoon breeze, fish market, short queues. Fewer gigs, less wahala.', queue: 5, rumour: 0.2, cdsOff: 0.1, rent: 7000, food: 1200, fx: 0.8, hustle: 0.7, crowd: 0.45 },
];
/* ---------------- Nigeria: your state, your LGA, your PPA ---------------- */
const STATE = () => STATES.find(s => s.id === (ST.state || 'LA')) || STATES.find(s => s.id === 'LA');
const ZN = () => ZONES[STATE().zone];
const SNAME = () => STATE().name;
function seedRand(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const COURSES = [ // course → how likely each kind of PPA is
  ['education', 'Education / Arts', { edu: .8, gov: .1, ngo: .1 }], ['science', 'Sciences', { edu: .6, health: .1, priv: .15, gov: .15 }],
  ['health', 'Nursing / Medicine / Pharmacy', { health: .85, edu: .1, gov: .05 }], ['tech', 'Computer Science / Engineering', { priv: .45, edu: .35, gov: .2 }],
  ['business', 'Accounting / Business', { priv: .4, gov: .3, edu: .3 }], ['media', 'Mass Communication', { priv: .35, gov: .25, ngo: .15, edu: .25 }],
  ['law', 'Law', { gov: .6, ngo: .2, edu: .2 }], ['agric', 'Agriculture', { gov: .45, edu: .35, priv: .2 }],
];
const ORGWORD = { SW: ['Omoluabi', 'Ireti', 'Olumo', 'Ayomide'], SE: ['Ugochukwu', 'Nkem', 'Ifeoma', 'Udo'], SS: ['Creekside', 'Atlantic', 'Ebiye', 'Delta Breeze'], NC: ['Confluence', 'Harmony', 'Middlebelt', 'Unity Gate'], NE: ['Savannah', 'Lake Chad', 'Gongola', 'Sahel Star'], NW: ['Arewa', 'Kurmi', 'Rimi', 'Sahel'] };
const PRINCIPALS = { SW: ['Mr. Adebayo', 'Mrs. Okon'], SE: ['Mr. Okonkwo', 'Mrs. Eze'], SS: ['Mr. Ebiere', 'Mrs. Okon'], NC: ['Mr. Terna', 'Mrs. Abdullahi'], NE: ['Malam Bello', 'Mrs. Hauwa'], NW: ['Malam Sani', 'Mrs. Zainab'] };
const PRN = () => (ST.state && ST.state !== 'LA' ? PRINCIPALS[STATE().zone] : PRINCIPALS.SW)[0];
const TCH = () => (ST.state && ST.state !== 'LA' ? PRINCIPALS[STATE().zone] : PRINCIPALS.SW)[1];
function orgsFor(st, lga, tier) { // deterministic per LGA, so every player posted there sees the same places
  const R = seedRand(st.id + '/' + lga), z = st.zone, L = lga.replace(/\//g, ' / '), w = ORGWORD[z], pk = a => a[(R() * a.length) | 0], O = [];
  const sch = { NW: ['Government Secondary School', 'Government Girls Secondary School', 'Government Day Junior Secondary School'], NE: ['Government Secondary School', 'Government Girls Secondary School', 'Government Day Secondary School'], SW: ['Community High School', 'Grammar School', 'Comprehensive High School'], SE: ['Community Secondary School', 'Girls\' Secondary School', 'Boys\' High School'], SS: ['Government Secondary School', 'Model Secondary School', 'Comprehensive High School'], NC: ['Government Secondary School', 'Community Secondary School', 'Government Day Secondary School'] }[z];
  for (const k of sch) O.push({ name: k === 'Grammar School' ? `${L} Grammar School` : `${k}, ${L}`, sector: 'edu', kind: 'school' });
  O.push({ name: `LGEA Primary School, ${L}`, sector: 'edu', kind: 'school' });
  O.push({ name: `Primary Health Centre, ${L}`, sector: 'health', kind: 'clinic' });
  if (tier !== 'r') O.push({ name: tier === 'u' ? `General Hospital, ${L}` : `Comprehensive Health Centre, ${L}`, sector: 'health', kind: 'clinic' });
  O.push({ name: `${L} LG Council, Admin Department`, sector: 'gov', kind: 'office' });
  if (tier === 'u') { O.push({ name: `${st.name} State Ministry of ${pk(['Education', 'Health', 'Agriculture', 'Information', 'Youth & Sports'])}`, sector: 'gov', kind: 'office' }); O.push({ name: `${st.name} State Internal Revenue Service`, sector: 'gov', kind: 'office' }); }
  if (tier !== 'r') { const a = pk(w), b = pk(w); O.push({ name: `${a} Microfinance Bank`, sector: 'priv', kind: 'office' }); O.push({ name: `${b} ${pk(['Tech Hub', 'Logistics Ltd', 'Media & Communications', 'Agro-Allied Ltd', 'Pharmacy Ltd'])}`, sector: 'priv', kind: 'office' }); }
  O.push({ name: `${pk(w)} Youth & Community Initiative`, sector: 'ngo', kind: 'office' });
  return O;
}
function profileFor(st, lga, tier) {
  const fixed = st.id === 'LA' && POSTINGS.find(p => p.short.replace(/\W/g, '').toLowerCase() === lga.replace(/\W/g, '').toLowerCase());
  if (fixed) return { ...fixed };
  const T = { u: { queue: 15, rumour: .6, cdsOff: .2, crowd: 1, hustle: 1, rentK: 1, foodK: 1, density: 'High' }, s: { queue: 9, rumour: .42, cdsOff: .16, crowd: .7, hustle: .8, rentK: .6, foodK: .85, density: 'Medium' }, r: { queue: 5, rumour: .25, cdsOff: .12, crowd: .45, hustle: .6, rentK: .4, foodK: .75, density: 'Low' } }[tier], c = st.cost;
  const big = ['LA', 'FC', 'KN', 'OY', 'RV'].includes(st.id) && tier === 'u';
  return { id: lga, short: lga, density: big ? 'Very high' : T.density, queue: big ? T.queue + 5 : T.queue, rumour: T.rumour, cdsOff: T.cdsOff, crowd: T.crowd, hustle: +(T.hustle * (0.6 + c * 0.5)).toFixed(2),
    rent: Math.round(15000 * c * T.rentK / 500) * 500, food: Math.round(1800 * c * T.foodK / 50) * 50, fx: +(c * (tier === 'r' ? .8 : tier === 's' ? .85 : 1)).toFixed(2),
    blurb: `${tier === 'u' ? 'Town LGA' : tier === 's' ? 'Semi-urban LGA' : 'Rural LGA'} in ${st.name}. ${st.flav || ''}`.trim() };
}
function drawPosting(stId, course) {
  const st = STATES.find(s => s.id === stId) || STATES.find(s => s.id === 'LA'), wts = { u: 3, s: 2, r: 1.6 };
  let r = Math.random() * st.lgas.reduce((n, l) => n + wts[l[1]], 0), pickL = st.lgas[0]; for (const l of st.lgas) { if ((r -= wts[l[1]]) < 0) { pickL = l; break; } }
  const [lga, tier] = pickL, orgs = orgsFor(st, lga, tier), cw = (COURSES.find(c => c[0] === course) || COURSES[0])[2];
  let tot = orgs.reduce((n, o) => n + (cw[o.sector] || .03), 0), q = Math.random() * tot, org = orgs[0]; for (const o of orgs) { if ((q -= (cw[o.sector] || .03)) < 0) { org = o; break; } }
  return { id: lga, short: lga, lga: lga + ' LGA', state: st.name, stateId: st.id, tier, org, sector: org.sector, kind: org.kind, ppa: org.name, prof: profileFor(st, lga, tier) };
}
const PF = () => (ST.post && ST.post.prof) || POSTINGS.find(p => ST.post && p.id === ST.post.id) || POSTINGS[0];
const LGN = () => (ST.post && ST.post.short) || PF().short;
const GRP = () => LGN() + ' LGA Corpers';
const fareOf = n => Math.max(50, Math.round(n * PF().fx / 50) * 50);
const naira = n => (n < 0 ? '−₦' : '₦') + Math.round(Math.abs(n)).toLocaleString('en-NG');
window.__G = {}; // test/debug handle

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: !TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.15 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xd9d6cb);
scene.fog = new THREE.Fog(FOG, TOUCH ? 40 : 55, TOUCH ? 130 : 175);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 260);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// physically based sky (hazy harmattan-ish Lagos morning)
const sky = new Sky(); sky.scale.setScalar(240); sky.frustumCulled = false; scene.add(sky);
const sun = new THREE.Vector3();
{
  const u = sky.material.uniforms;
  u.turbidity.value = 9; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.008; u.mieDirectionalG.value = 0.82;
  sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 34), THREE.MathUtils.degToRad(150));
  u.sunPosition.value.copy(sun);
}
const hemi = new THREE.HemisphereLight(0xe4ecff, 0x7b6a52, 0.55); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xfff0d8, 2.7);
sunL.castShadow = true;
sunL.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048);
Object.assign(sunL.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 160 });
sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.03;
scene.add(sunL, sunL.target);

/* ---------------- canvas textures ---------------- */
function ctex(w, h, draw, rep = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.anisotropy = ANISO; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function speckle(g, w, h, n, cols, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.globalAlpha = Math.random() * 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s); } g.globalAlpha = 1; }
function grime(g, w, h, a = 0.25) { // rain streaks + bottom dirt, very Lagos
  const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(60,45,30,0)'); gr.addColorStop(1, `rgba(60,45,30,${a})`); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w / 6; i++) { const x = Math.random() * w, y = Math.random() * h * 0.8; g.fillStyle = `rgba(50,40,30,${Math.random() * 0.12})`; g.fillRect(x, y, rnd(1, 3), rnd(20, 120)); }
}
// asphalt with worn markings; one tile = 14m long x 14m wide road
const roadTex = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#4b4b4a'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 26000, ['#333', '#5c5c5a', '#6b6a66', '#2a2a2a', '#555'], 2);
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(25,25,25,${rnd(.15, .35)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(60, h - 60), rnd(10, 40), rnd(6, 20), rnd(0, 3), 0, 7); g.fill(); }
  for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(${rnd(55, 75)},${rnd(55, 75)},${rnd(55, 70)},.8)`; g.fillRect(rnd(0, w), rnd(40, h - 80), rnd(30, 90), rnd(20, 50)); } // patch repairs
  g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.2; for (let i = 0; i < 10; i++) { g.beginPath(); let x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-18, 18); y += rnd(-18, 18); g.lineTo(x, y); } g.stroke(); }
  // worn centre dashes (along U) and edge lines
  g.fillStyle = 'rgba(235,235,220,.75)'; for (let x = 0; x < w; x += 128) g.fillRect(x + 10, h / 2 - 4, 64, 8);
  g.fillStyle = 'rgba(230,200,60,.55)'; g.fillRect(0, 14, w, 7); g.fillRect(0, h - 21, w, 7);
  speckle(g, w, h, 4000, ['#4b4b4a'], 3);
}, [1, 1]);
const paverTex = ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#8f877a'; g.fillRect(0, 0, w, h);
  const cs = ['#9a9184', '#8a8174', '#a49a8c', '#7f776b', '#958a7c'];
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32) { g.fillStyle = pick(cs); g.fillRect(x + 1, y + 1, 30, 30); }
  speckle(g, w, h, 5000, ['#5f584f', '#b0a798'], 2); grime(g, w, h, .15);
}, [1, 1]);
const concreteTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#a8a397'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, ['#8b867b', '#bdb7aa', '#77736a'], 2); grime(g, w, h, .3); }, [1, 1]);
const dirtTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#8b6b4a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 12000, ['#6e5238', '#a4835f', '#5a422c', '#9a7a55'], 3); }, [1, 1]);
const roofTex = ctex(256, 256, (g, w, h) => { // rusty corrugated zinc
  for (let x = 0; x < w; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#6d4a33'); gr.addColorStop(.5, '#a57455'); gr.addColorStop(1, '#5a3a27'); g.fillStyle = gr; g.fillRect(x, 0, 8, h); }
  speckle(g, w, h, 4000, ['#3b2416', '#c0835a', '#7a7a70'], 3);
}, [1, 1]);

/* ---------------- materials ---------------- */
const M = {
  road: new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 }),
  paver: new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.95 }),
  concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 }),
  dirt: new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.6, metalness: 0.35 }),
  drain: new THREE.MeshStandardMaterial({ color: 0x2b2a24, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3c3a2a, roughness: 0.15, metalness: 0.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
  hub: new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.8 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x1b242b, roughness: 0.08, metalness: 0.3, clearcoat: 1 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.2, metalness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.85 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.8 }),
  wire: new THREE.MeshBasicMaterial({ color: 0x111111 }),
  tank: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.55 }),
  light: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 1.2 }),
  red: new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0x500000, roughness: 0.4 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: 0.9, flatShading: true }),
  leaf2: new THREE.MeshStandardMaterial({ color: 0x55843a, roughness: 0.9, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 }),
};
const paint = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.3 });

function box(w, h, d, mat, x, y, z, parent = scene, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function uvScale(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

/* ---------------- world layout ----------------
 x runs along the street (west -> east). Road z ∈ [-7,7].
 Drains at |z| 7..7.8, sidewalks |z| 7.8..11, buildings from |z| 11.5 back.
*/
const HALF = 255;            // street drawn length each way (traffic wraps here, hidden by haze)
const PLAY = 104;            // player limit
const colliders = [];        // AABBs {x0,x1,z0,z1}
const addCol = (x0, x1, z0, z1) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

{ // ground
  const rg = new THREE.PlaneGeometry(HALF * 2, 14); uvScale(rg, HALF * 2 / 14, 1); rg.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(rg, M.road); road.receiveShadow = true; scene.add(road);
  for (const s of [-1, 1]) {
    const dg = new THREE.PlaneGeometry(HALF * 2, 0.8); dg.rotateX(-Math.PI / 2); const dr = new THREE.Mesh(dg, M.water); dr.position.set(0, -0.35, s * 7.4); scene.add(dr); // open gutter water
    box(HALF * 2, 0.5, 0.12, M.concrete, 0, -0.1, s * 7.04, scene, false); box(HALF * 2, 0.5, 0.12, M.concrete, 0, -0.1, s * 7.76, scene, false);
    const sw = new THREE.BoxGeometry(HALF * 2, 0.18, 3.6); uvScale(sw, HALF * 2 / 2.2, 3.6 / 2.2);
    const swm = new THREE.Mesh(sw, M.paver); swm.position.set(0, 0.09, s * 9.6); swm.receiveShadow = true; scene.add(swm);
    const dg2 = new THREE.PlaneGeometry(HALF * 2, 60); uvScale(dg2, HALF * 2 / 6, 10); dg2.rotateX(-Math.PI / 2);
    const back = new THREE.Mesh(dg2, M.dirt); back.position.set(0, 0.01, s * 41); back.receiveShadow = true; scene.add(back);
  }
  // concrete slabs over the drain (some missing — mind your step)
  for (let x = -HALF; x < HALF; x += 2.2) for (const s of [-1, 1]) if (Math.random() > 0.22) { const b = box(2.05, 0.1, 0.92, M.concrete, x, 0.0, s * 7.4, scene, false); b.rotation.y = rnd(-.03, .03); }
}

/* ---------------- buildings ---------------- */
const WALLS = ['#e8dcc0', '#d9c4a3', '#c9d6d2', '#e3c7b4', '#bfc9b3', '#ede6d6', '#d8b48c', '#b7c4cf', '#e6d3a8', '#cfe0c8'];
// shop names by zone (same slots: 0, 4 and 9 sell food)
const ZSHOPS = {
  SE: [['MAMA NKECHI PROVISIONS', 'Pure water • Bread • Indomie • Malt'], ['ODOGWU CUTS BARBING SALON', 'Low cut • Gentle man • Punk'], ['CHIDI BUSINESS CENTRE', 'Photocopy • Lamination • Passport'], ['NNEKA PHARMACY', 'Drugs • Cosmetics • Test strips'], ['NWANYI OMA KITCHEN', 'Abacha • Okpa • Nkwobi'], ['IFEANYI PHONES & ACCESSORIES', 'Chargers • Screen guard • Repairs'], ['EBUKA POS & TRANSFERS', 'Withdrawal • Deposit • Airtime'], ['MAMA UCHE RESTAURANT', 'Ofe onugbu • Fufu • Pepper soup'], ['DIVINE TOUCH TAILORING', 'Khaki adjustment while you wait'], ['CHUKS CHOPS & DRINKS', 'Shawarma • Puff-puff • Chapman'], ['ONYEKA ELECTRICALS', 'Bulbs • Extension • Rechargeable fan'], ['FRESH & CLEAN DRY CLEANERS', 'Starch • Iron • Same day'], ['OKWY CYBER CAFE', 'Browsing • Printing • JAMB reg'], ['IKENGA VULCANIZER', 'Tyre • Gum • Air']],
  SS: [['MAMA EBI PROVISIONS', 'Pure water • Bread • Indomie • Malt'], ['TARE CUTS BARBING SALON', 'Low cut • Gentle man • Punk'], ['ESE BUSINESS CENTRE', 'Photocopy • Lamination • Passport'], ['OGHENE PHARMACY', 'Drugs • Cosmetics • Test strips'], ['EFE KITCHEN', 'Banga • Starch • Owo soup'], ['OKON PHONES & ACCESSORIES', 'Chargers • Screen guard • Repairs'], ['TAMUNO POS & TRANSFERS', 'Withdrawal • Deposit • Airtime'], ['IYE FISH PEPPER SOUP', 'Catfish • Point and kill • Cold drink'], ['DIVINE TOUCH TAILORING', 'Khaki adjustment while you wait'], ['BOLE & FISH JUNCTION', 'Roasted plantain • Fish • Pepper sauce'], ['PROMISE ELECTRICALS', 'Bulbs • Extension • Rechargeable fan'], ['FRESH & CLEAN DRY CLEANERS', 'Starch • Iron • Same day'], ['GRACE CYBER CAFE', 'Browsing • Printing • JAMB reg'], ['OMO NAIJA VULCANIZER', 'Tyre • Gum • Air']],
  NC: [['MAMA RAKIYA PROVISIONS', 'Pure water • Bread • Indomie • Malt'], ['SANI CUTS BARBING SALON', 'Low cut • Gentle man • Punk'], ['TERNA BUSINESS CENTRE', 'Photocopy • Lamination • Passport'], ['AMINA PHARMACY', 'Drugs • Cosmetics • Test strips'], ['IYA SAKINAT FOOD CANTEEN', 'Pounded yam • Egusi • Tuwo'], ['IBRAHIM PHONES & ACCESSORIES', 'Chargers • Screen guard • Repairs'], ['FAVOUR POS & TRANSFERS', 'Withdrawal • Deposit • Airtime'], ['MALAM SULE SUYA SPOT', 'Suya • Kilishi • Cold kunu'], ['DIVINE TOUCH TAILORING', 'Khaki adjustment while you wait'], ['UNITY CHOPS & DRINKS', 'Shawarma • Puff-puff • Chapman'], ['PROMISE ELECTRICALS', 'Bulbs • Extension • Rechargeable fan'], ['FRESH & CLEAN DRY CLEANERS', 'Starch • Iron • Same day'], ['GRACE CYBER CAFE', 'Browsing • Printing • JAMB reg'], ['OMO NAIJA VULCANIZER', 'Tyre • Gum • Air']],
  N: [['MALAM AUWAL PROVISIONS', 'Pure water • Bread • Indomie • Malt'], ['BABA SANI BARBING SALON', 'Low cut • Gentle man • Punk'], ['ALHERI BUSINESS CENTRE', 'Photocopy • Lamination • Passport'], ['NASARA PHARMACY', 'Drugs • Cosmetics • Test strips'], ['MAMA HAUWA TUWO SPOT', 'Tuwo • Miyan kuka • Masa'], ['ABBA PHONES & ACCESSORIES', 'Chargers • Screen guard • Repairs'], ['ALHAJI MUSA POS & TRANSFERS', 'Withdrawal • Deposit • Airtime'], ['MAI SUYA JUNCTION', 'Tsire • Kilishi • Kunu'], ['MAI DINKI TAILORING', 'Khaki adjustment while you wait'], ['ZAINAB CHOPS & DRINKS', 'Shawarma • Kosai • Zobo'], ['BALA ELECTRICALS', 'Bulbs • Extension • Rechargeable fan'], ['WANKI DRY CLEANERS', 'Starch • Iron • Same day'], ['ALHERI CYBER CAFE', 'Browsing • Printing • JAMB reg'], ['MAI GYARAN TAYA VULCANIZER', 'Tyre • Gum • Air']],
};
const SHOPS = [
  ['MAMA TOLANI PROVISIONS', 'Pure water • Bread • Indomie • Malt', '#c62828', '#fff'],
  ['BLESSED HANDS BARBING SALON', 'Low cut • Gentle man • Punk', '#1565c0', '#fff'],
  ["CORPERS' CHOICE BUSINESS CENTRE", 'Photocopy • Lamination • Passport', '#2e7d32', '#fff'],
  ["GOD'S TIME PHARMACY", 'Drugs • Cosmetics • Test strips', '#00897b', '#fff'],
  ['EKO SWEET BUKA', 'Amala • Ewedu • Assorted', '#f9a825', '#1a1a1a'],
  ['NO WAHALA PHONE ACCESSORIES', 'Chargers • Screen guard • Repairs', '#6a1b9a', '#fff'],
  ['FAVOUR POS & TRANSFERS', 'Withdrawal • Deposit • Airtime', '#ef6c00', '#fff'],
  ['IYA BASIRAT AMALA SPOT', 'Abula • Gbegiri • Cold zobo', '#4e342e', '#ffd54f'],
  ['DIVINE TOUCH TAILORING', 'Khaki adjustment while you wait', '#ad1457', '#fff'],
  ['GLORY CHOPS & DRINKS', 'Shawarma • Puff-puff • Chapman', '#d84315', '#fff'],
  ['PROMISE ELECTRICALS', 'Bulbs • Extension • Rechargeable fan', '#283593', '#ffeb3b'],
  ['FRESH & CLEAN DRY CLEANERS', 'Starch • Iron • Same day', '#0277bd', '#fff'],
  ['GRACE CYBER CAFE', 'Browsing • Printing • JAMB reg', '#37474f', '#4dd0e1'],
  ['OMO NAIJA VULCANIZER', 'Tyre • Gum • Air', '#212121', '#ffca28'],
];
function signTex(name, sub, bg, fg) {
  return ctex(1024, 192, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, h * 0.45);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 78; g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; while (g.measureText(name).width > w - 60) { fs -= 4; g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; }
    g.fillText(name, w / 2, h * 0.42);
    g.font = `700 34px Arial, sans-serif`; g.fillText(sub, w / 2, h * 0.8);
    grime(g, w, h, .25);
  }, [1, 1]);
}
const facadeCache = [];
function facadeTex(storeys, bays, wall, shop, unique) {
  if (!unique && facadeCache.length > 9) return pick(facadeCache);
  const W = 128 * bays, H = 160 * storeys;
  const t = ctex(W, H, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H); speckle(g, W, H, W * H / 40, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.3)'], 2);
    for (let s = 0; s < storeys; s++) {
      const y0 = H - (s + 1) * 160;
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y0 + 152, W, 8); // floor band
      if (s === 0 && shop) {
        for (let b = 0; b < bays; b++) {
          const x = b * 128;
          if (b % 3 === 1) { // shop door, open, with goods
            g.fillStyle = '#1d1a16'; g.fillRect(x + 12, y0 + 30, 104, 130);
            for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) { g.fillStyle = pick(['#c62828', '#f9a825', '#1565c0', '#2e7d32', '#eee', '#ef6c00', '#6a1b9a']); g.fillRect(x + 18 + k * 14, y0 + 44 + r * 26, 11, 18); }
          } else { // rolling shutter (half up) or burglar-proof window
            g.fillStyle = '#7b7f84'; g.fillRect(x + 10, y0 + 30, 108, 70);
            for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#8d9196' : '#6a6e72'; g.fillRect(x + 10, y0 + 30 + k * 5, 108, 5); }
            g.fillStyle = '#1d1a16'; g.fillRect(x + 10, y0 + 100, 108, 60);
          }
        }
      } else {
        for (let b = 0; b < bays; b++) {
          const x = b * 128 + 22, y = y0 + 34, ww = 84, wh = 88;
          if (s === 0 && b % 2 === 0) { g.fillStyle = '#5a3d27'; g.fillRect(x + 14, y0 + 40, 56, 120); continue; } // door
          g.fillStyle = '#efe9dc'; g.fillRect(x - 6, y - 6, ww + 12, wh + 12);
          const gl = g.createLinearGradient(x, y, x + ww, y + wh); gl.addColorStop(0, '#3a4a55'); gl.addColorStop(.5, '#7c93a0'); gl.addColorStop(1, '#2a343b');
          g.fillStyle = gl; g.fillRect(x, y, ww, wh);
          if (Math.random() < .5) { g.fillStyle = pick(['#b71c1c', '#f9a825', '#6a1b9a', '#2e7d32', '#e0e0e0', '#0277bd']); g.globalAlpha = .85; g.fillRect(x, y, ww * rnd(.3, .5), wh); g.globalAlpha = 1; } // curtains
          g.strokeStyle = '#2d2d2d'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * ww / 6, y); g.lineTo(x + k * ww / 6, y + wh); g.stroke(); } // burglary proof
          g.beginPath(); g.moveTo(x, y + wh / 2); g.lineTo(x + ww, y + wh / 2); g.stroke();
          g.fillStyle = 'rgba(40,30,20,.25)'; g.fillRect(x, y + wh + 6, ww, 40); // stain under window
        }
      }
    }
    grime(g, W, H, .35);
  });
  if (!unique) facadeCache.push(t);
  return t;
}
const sideTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#cbbfa6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.2)'], 2); grime(g, w, h, .4); }, [1, 1]);
const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95 });
const roofFlat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });

const shopSpots = []; // for interactions
let shopIdx = 0; const SHOPSIGNS = [];
function building(x, side, w, d, storeys, near) {
  const h = storeys * 3.2, zf = side * 11.6, zc = zf + side * d / 2;
  const bays = Math.max(2, Math.round(w / 3.2));
  const isShop = Math.random() < 0.8;
  const wall = pick(WALLS);
  const front = new THREE.MeshStandardMaterial({ map: facadeTex(storeys, bays, wall, isShop, near), roughness: 0.92 });
  const mats = [sideMat, sideMat, roofFlat, sideMat, side > 0 ? sideMat : front, side > 0 ? front : sideMat];
  // BoxGeometry face order: +x,-x,+y,-y,+z,-z. Front faces the street (towards z=0).
  const g = new THREE.BoxGeometry(w, h, d);
  // per-face UV repeat on side walls only
  const m = new THREE.Mesh(g, mats); m.position.set(x, h / 2, zc); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  addCol(x - w / 2, x + w / 2, zf, zf + side * d);
  // parapet + roof clutter
  box(w, 0.6, 0.2, sideMat, x, h + 0.3, zf + side * 0.1); box(w, 0.6, 0.2, sideMat, x, h + 0.3, zf + side * (d - 0.1));
  if (Math.random() < 0.55) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 16), M.tank); t.position.set(x + rnd(-w / 3, w / 3), h + 1.05, zc + side * rnd(-1, 1)); t.castShadow = true; scene.add(t); box(1.6, 0.3, 1.6, M.pole, t.position.x, h + 0.15, t.position.z); }
  if (Math.random() < 0.35) { const dsh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), M.hub); dsh.rotation.x = side * -1.0; dsh.position.set(x + rnd(-w / 3, w / 3), h + 0.9, zf + side * 0.6); scene.add(dsh); }
  if (storeys >= 2 && Math.random() < 0.6) for (let i = 0; i < 2; i++) box(0.8, 0.5, 0.5, new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: .6 }), x + rnd(-w / 2.5, w / 2.5), rnd(3.6, h - 1), zf - side * 0.25); // AC units
  if (isShop) {
    const S = SHOPS[shopIdx++ % SHOPS.length];
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 0.6, 7.5), 1.25), new THREE.MeshStandardMaterial({ map: signTex(...S), roughness: 0.6 }));
    sm.position.set(x, 3.75, zf - side * 0.07); sm.rotation.y = side > 0 ? Math.PI : 0; scene.add(sm);
    // corrugated awning sloping to the street
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.05, 1.8), M.roof); aw.position.set(x, 3.0, zf - side * 0.9); aw.rotation.x = side * -0.18; aw.castShadow = true; scene.add(aw);
    for (const dx of [-w * 0.42, w * 0.42]) box(0.08, 2.9, 0.08, M.pole, x + dx, 1.45, zf - side * 1.7);
    SHOPSIGNS.push({ sm, i: (shopIdx - 1) % SHOPS.length });
    if (near) shopSpots.push({ name: S[0], x, z: zf - side * 1.6, side, food: [0, 4, 9].includes((shopIdx - 1) % SHOPS.length), si: (shopIdx - 1) % SHOPS.length });
  }
  return m;
}
{ // two rows of buildings, close ones unique, far ones cheap and cached
  for (const side of [-1, 1]) {
    let x = -HALF + 4;
    while (x < HALF - 4) {
      const w = rnd(7.5, 13), gap = rnd(0.4, 2.6);
      const cx = x + w / 2;
      const lga = (side < 0 && cx > 60 && cx < 96) || (side < 0 && cx > -100 && cx < -54); // reserve secretariat + school lots (north side)
      const stop = (side > 0 && cx > -30 && cx < -10) || (side > 0 && cx > -53 && cx < -35) || (side > 0 && cx > 56 && cx < 88) || (side < 0 && cx > 12 && cx < 46); // bus stop + lodge + health centre (south), office complex (north)
      if (!lga && !stop) building(cx, side, w, rnd(10, 15), Math.random() < .2 ? 1 : (Math.random() < .6 ? 2 : 3 + (Math.random() < .3 ? 1 : 0)), Math.abs(cx) < 115);
      x += w + gap;
    }
  }
}

/* ---------------- street furniture ---------------- */
const leafTex = ctex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const x = rnd(10, w - 10), y = rnd(10, h - 10), d = Math.hypot(x - w / 2, y - h / 2); if (d > w * 0.48) continue; g.save(); g.translate(x, y); g.rotate(rnd(0, 7)); g.fillStyle = pick(['#2f5a1f', '#3e6e27', '#4d7f2f', '#26491a', '#5b8a36']); g.beginPath(); g.ellipse(0, 0, rnd(5, 9), rnd(2.5, 4), 0, 0, 7); g.fill(); g.restore(); }
}, [1, 1]);
const leafCard = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
const cardGeo = new THREE.PlaneGeometry(2.4, 2.4);
function tree(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 3.4 * s, 8), M.bark); tr.position.y = 1.7 * s; tr.castShadow = true; g.add(tr);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 1), M.leaf); core.position.y = 4.2 * s; core.scale.set(1.2, .8, 1.2); g.add(core);
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(cardGeo, leafCard); const a = rnd(0, 6.28), r = rnd(0.3, 1.7) * s; f.position.set(Math.cos(a) * r, rnd(3.3, 5.3) * s, Math.sin(a) * r); f.rotation.set(rnd(-1, 1), rnd(0, 6.28), rnd(-1, 1)); f.scale.setScalar(rnd(.7, 1.15) * s); f.castShadow = true; g.add(f); }
  addCol(x - .3, x + .3, z - .3, z + .3);
}
function palm(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 6.5, 8), M.bark); tr.position.y = 3.25; tr.rotation.z = rnd(-.08, .08); tr.castShadow = true; g.add(tr);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.2, 4, 1), M.leaf2); l.scale.z = 0.15; l.position.y = 6.4; l.rotation.set(0, i * 0.7, 1.9 + rnd(-.25, .2)); l.rotateY(0); l.translateY(1.5); l.castShadow = true; g.add(l); }
  addCol(x - .25, x + .25, z - .25, z + .25);
}
const poles = [];
for (let x = -HALF + 6; x < HALF; x += 22) { // NEPA poles with sagging wires (north side)
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 9, 8), M.pole); p.position.set(x, 4.5, -8.4); p.castShadow = true; scene.add(p);
  box(1.8, 0.12, 0.12, M.wood, x, 8.6, -8.4); poles.push(x);
  if (Math.abs(x) < 115) addCol(x - .2, x + .2, -8.6, -8.2);
  if (Math.random() < .25) { box(0.7, 0.9, 0.5, M.pole, x, 7.4, -8.1); } // transformer box
  // street lamp
  const arm = box(1.6, 0.08, 0.08, M.pole, x, 8.1, -7.7, scene, false); arm.rotation.y = Math.PI / 2;
  box(0.5, 0.12, 0.25, M.light, x, 8.0, -7.0, scene, false);
}
{ // sagging wires between poles
  const pts = [];
  for (let i = 0; i < poles.length - 1; i++) for (const dz of [-0.8, 0, 0.8]) {
    const a = new THREE.Vector3(poles[i], 8.66, -8.4 + dz), b = new THREE.Vector3(poles[i + 1], 8.66, -8.4 + dz), mid = a.clone().lerp(b, .5); mid.y -= 1.0;
    const c = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10); for (let k = 0; k < c.length - 1; k++) pts.push(c[k], c[k + 1]);
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.wire));
}
for (let x = -HALF + 12; x < HALF; x += rnd(16, 30)) { if (Math.random() < .55) tree(x, 10.6, rnd(.8, 1.15)); else if (Math.random() < .5) palm(x, -10.7); }

// umbrella vendors along the walkway
const UMB = [0xd32f2f, 0xfbc02d, 0x1976d2, 0x388e3c, 0xf57c00];
const vendorSpots = [];
function umbrellaStall(x, z, label) {
  const g = new THREE.Group(); g.position.set(x, 0.18, z); scene.add(g);
  const c = pick(UMB);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: .7 })); top.position.y = 2.3; top.castShadow = true; g.add(top);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), M.pole); st.position.y = 1.15; g.add(st);
  const tb = box(1.2, 0.08, 0.7, M.wood, 0.4, 0.8, 0, g); for (const [dx, dz] of [[-.15, -.3], [.95, -.3], [-.15, .3], [.95, .3]]) box(0.05, 0.8, 0.05, M.wood, dx, 0.4, dz, g, false);
  for (let i = 0; i < 9; i++) box(0.12, 0.18, 0.12, new THREE.MeshStandardMaterial({ color: pick([0xffffff, 0x90caf9, 0xffcc80, 0xef9a9a]), roughness: .5 }), rnd(-.1, .9), 0.93, rnd(-.25, .25), g);
  addCol(x - .3, x + 1.1, z - .4, z + .4);
  vendorSpots.push({ x: x + 0.4, z, label });
}
umbrellaStall(-8, 9.9, 'pure water & puff-puff');
umbrellaStall(32, -9.9, 'recharge card & sweet');
umbrellaStall(-52, -9.9, 'roasted corn & ube');

// billboard (fictional ad) facing traffic
{
  const bt = ctex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b6b3a'); gr.addColorStop(1, '#0a3d24'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd54f'; g.font = '900 96px Impact, Arial Black, sans-serif'; g.fillText('DATA DON FINISH?', 50, 150);
    g.fillStyle = '#fff'; g.font = '700 56px Arial'; g.fillText('Abeg, share hotspot. Corper no dey', 50, 260); g.fillText('carry plenty money. 🙏🏾', 50, 330);
    g.font = '700 30px Arial'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('This billboard space is available • fictional ad', 50, 450);
    grime(g, w, h, .2);
  });
  const bb = new THREE.Group(); bb.position.set(-30, 0, -12.5); scene.add(bb);
  for (const dx of [-3, 3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), M.pole); p.position.set(dx, 3.5, 0); p.castShadow = true; bb.add(p); }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 0.2), [M.black, M.black, M.black, M.black, new THREE.MeshStandardMaterial({ map: bt, roughness: .6 }), M.black]);
  panel.position.y = 8.5; panel.castShadow = true; bb.add(panel); bb.rotation.y = 0.25;
}

// bus stop shelter (south side)
const BUSSTOP_X = -20;
{
  const g = new THREE.Group(); g.position.set(BUSSTOP_X, 0.18, 9.6); scene.add(g);
  for (const dx of [-2.6, 2.6]) for (const dz of [-.8, .8]) box(0.1, 2.6, 0.1, M.pole, dx, 1.3, dz, g);
  const rf = box(5.6, 0.1, 2.0, M.roof, 0, 2.65, 0, g); rf.rotation.x = -0.08;
  box(5, 0.08, 0.45, M.wood, 0, 0.55, 0.45, g);
  const st = ctex(512, 128, (c, w, h) => { c.fillStyle = '#0d47a1'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 52px Arial Black, Impact'; c.textAlign = 'center'; c.fillText('CORPER CLOSE', w / 2, 62); c.font = '700 30px Arial'; c.fillText('BUS STOP', w / 2, 108); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: st })); sg.position.set(0, 3.1, -1.0); sg.rotation.y = Math.PI; g.add(sg);
  addCol(BUSSTOP_X - 2.7, BUSSTOP_X + 2.7, 10.3, 10.5);
}

/* ---------------- LGA secretariat (fictional) ---------------- */
const LGA = { x: 78, z: -12.5 };
const flagCloth = { mesh: null, base: null };
{
  const g = new THREE.Group(); g.position.set(LGA.x, 0, -11.6); scene.add(g);
  const wallM = new THREE.MeshStandardMaterial({ color: 0xf1efe6, roughness: .9, map: concreteTex });
  // fence wall with gate gap
  box(14, 2.4, 0.3, wallM, -11, 1.2, 0, g); box(14, 2.4, 0.3, wallM, 11, 1.2, 0, g);
  for (const x of [-18, -4, 4, 18]) box(0.6, 2.8, 0.6, new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: .8 }), x, 1.4, 0, g);
  addCol(LGA.x - 18, LGA.x - 4, -11.8, -11.4); addCol(LGA.x + 4, LGA.x + 18, -11.8, -11.4);
  const gs = ctex(1024, 256, (c, w, h) => { c.fillStyle = '#1b5e20'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '900 76px Arial Black, Impact'; c.fillText('LOCAL GOVT. SECRETARIAT', w / 2, 110); c.font = '700 44px Arial'; c.fillStyle = '#ffeb3b'; c.fillText("Corps members' clearance → Hall B", w / 2, 196); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: gs })); LGA.sign = sign; sign.position.set(0, 3.9, 0.05); g.add(sign);
  box(8.4, 0.25, 0.4, new THREE.MeshStandardMaterial({ color: 0x2e7d32 }), 0, 2.85, 0, g);
  // main building
  const bm = [new THREE.MeshStandardMaterial({ color: 0xf3f0e6, map: sideTex }), new THREE.MeshStandardMaterial({ color: 0xf3f0e6, map: sideTex }), roofFlat, roofFlat, new THREE.MeshStandardMaterial({ map: facadeTex(2, 8, '#f3f0e6', false, true) }), sideMat];
  const hall = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 12), bm); hall.position.set(0, 3.5, -17); hall.castShadow = hall.receiveShadow = true; g.add(hall);
  addCol(LGA.x - 13, LGA.x + 13, -34.6, -22.6);
  box(26, 0.4, 3, new THREE.MeshStandardMaterial({ color: 0x2e7d32 }), 0, 3.4, -9.8, g); // green canopy band
  for (const x of [-12, -6, 0, 6, 12]) box(0.4, 3.4, 0.4, wallM, x, 1.7, -8.6, g);
  // compound ground
  const cg = new THREE.PlaneGeometry(36, 24); cg.rotateX(-Math.PI / 2); const cm = new THREE.Mesh(cg, M.concrete); cm.position.set(0, 0.02, -12); cm.receiveShadow = true; g.add(cm);
  // flag pole + waving Nigerian flag
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), M.chrome); fp.position.set(-8, 4.5, -4); g.add(fp);
  const ft = ctex(192, 96, (c, w, h) => { c.fillStyle = '#008751'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(w / 3, 0, w / 3, h); }, [1, 1]);
  const fgeo = new THREE.PlaneGeometry(2.4, 1.2, 16, 6); const fl = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: .8 }));
  fl.position.set(-8 + 1.2, 8.2, -4); fl.castShadow = true; g.add(fl); flagCloth.mesh = fl; flagCloth.base = fgeo.attributes.position.array.slice();
  // tables for clearance under the canopy
  for (const x of [-6, 0, 6]) { box(2.2, 0.08, 0.9, M.wood, x, 0.8, -8.0, g); for (const dx of [-1, 1]) box(0.06, 0.8, 0.8, M.wood, x + dx, 0.4, -8.0, g, false); }
}

/* ---------------- ORIENTATION CAMP (second area, far from the street) ----------------
 Camp centre is at world (0, 0, CZ). Everything built here is tagged area:'camp' so it can be
 culled as a block. Layout (camp coords, z grows towards the gate):
   gate z=+55 · registration tents z≈+38 · parade ground centre · podium z=-18
   hostels west · kit store + clinic east · mammy market east · stage north-west · SAED hall north-east */
const CZ = 400, CAMP_HALF = 55;
const campStart = scene.children.length;
const CAMP = { spots: {}, slot: null, lights: [], formation: [] };
const grassTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#6f8a3c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 16000, ['#5c7731', '#86a24a', '#7b6a3f', '#4f6a2a', '#97ad5a'], 2); for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(140,105,60,.35)'; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(8, 30), rnd(5, 16), rnd(0, 3), 0, 7); g.fill(); } }, [1, 1]);
const lateriteTex = ctex(256, 256, (g, w, h) => { g.fillStyle = '#a5643a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 16000, ['#8e5330', '#b8774a', '#7a4527', '#c48a5c'], 2); }, [1, 1]);
const paradeTex = ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#9b9a92'; g.fillRect(0, 0, w, h); speckle(g, w, h, 30000, ['#8a8981', '#adaca4', '#7b7a72'], 2); grime(g, w, h, .2);
  g.strokeStyle = 'rgba(245,245,240,.85)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  g.lineWidth = 3; for (let x = 60; x < w - 40; x += 56) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, h - 30); g.stroke(); } // platoon lanes
}, [1, 1]);
M.grass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
M.laterite = new THREE.MeshStandardMaterial({ map: lateriteTex, roughness: 1 });
M.parade = new THREE.MeshStandardMaterial({ map: paradeTex, roughness: 0.95 });
M.campWall = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9, map: concreteTex });
M.campGreen = new THREE.MeshStandardMaterial({ color: 0x1f7a3e, roughness: 0.8 });
M.kerb = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.7 });
{
  const gg = new THREE.PlaneGeometry(150, 150); uvScale(gg, 150 / 8, 150 / 8); gg.rotateX(-Math.PI / 2);
  const gr = new THREE.Mesh(gg, M.grass); gr.position.set(0, 0, CZ); gr.receiveShadow = true; scene.add(gr);
  // laterite paths: gate → parade → hostels / market
  const path = (x, z, w, d) => { const g = new THREE.PlaneGeometry(w, d); uvScale(g, w / 6, d / 6); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, M.laterite); m.position.set(x, 0.012, CZ + z); m.receiveShadow = true; scene.add(m); };
  path(0, 38, 8, 40); path(-30, 0, 24, 6); path(30, 0, 24, 6); path(0, -32, 60, 6); path(38, -18, 6, 40); path(-38, 0, 6, 70);
  // outside road in front of the gate
  const rg = new THREE.PlaneGeometry(160, 10); uvScale(rg, 160 / 14, 10 / 14); rg.rotateX(-Math.PI / 2); const rd = new THREE.Mesh(rg, M.road); rd.position.set(0, 0.01, CZ + 66); rd.receiveShadow = true; scene.add(rd);
  // parade ground slab with white kerbs (very camp)
  const pg = new THREE.BoxGeometry(44, 0.12, 30); const pm = new THREE.Mesh(pg, [M.concrete, M.concrete, M.parade, M.concrete, M.concrete, M.concrete]); pm.position.set(0, 0.06, CZ); pm.receiveShadow = true; scene.add(pm);
  for (const [x, z, w, d] of [[0, -15.2, 44.4, 0.4], [0, 15.2, 44.4, 0.4], [-22.2, 0, 0.4, 30.4], [22.2, 0, 0.4, 30.4]]) box(w, 0.25, d, M.kerb, x, 0.12, CZ + z, scene, false);
}
// perimeter wall, green and white, with a gate gap
for (const [x0, x1, z0, z1] of [[-CAMP_HALF, -5, CAMP_HALF, CAMP_HALF], [5, CAMP_HALF, CAMP_HALF, CAMP_HALF], [-CAMP_HALF, CAMP_HALF, -CAMP_HALF, -CAMP_HALF], [-CAMP_HALF, -CAMP_HALF, -CAMP_HALF, CAMP_HALF], [CAMP_HALF, CAMP_HALF, -CAMP_HALF, CAMP_HALF]]) {
  const w = Math.max(0.3, x1 - x0), d = Math.max(0.3, z1 - z0);
  box(w, 2.6, d, M.campWall, (x0 + x1) / 2, 1.3, CZ + (z0 + z1) / 2); box(w + .02, 0.5, d + .02, M.campGreen, (x0 + x1) / 2, 0.25, CZ + (z0 + z1) / 2, scene, false);
  addCol(x0 - .2, x1 + .2, CZ + z0 - .2, CZ + z1 + .2);
}
function campSign(text, sub, w, h, bg = '#1b5e20', fg = '#fff', sc = '#ffeb3b') {
  const t = ctex(1024, Math.round(1024 * h / w), (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(12, 12, W - 24, H - 24); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = H * 0.42; g.font = `900 ${fs}px Arial Black, Impact, sans-serif`; while (g.measureText(text).width > W - 70) { fs -= 4; g.font = `900 ${fs}px Arial Black, Impact, sans-serif`; } g.fillText(text, W / 2, sub ? H * 0.4 : H / 2); if (sub) { g.fillStyle = sc; g.font = `700 ${H * 0.2}px Arial, sans-serif`; g.fillText(sub, W / 2, H * 0.76); } grime(g, W, H, .18); });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .6 }));
}
{ // gate arch
  for (const x of [-5, 5]) { box(1.2, 5.2, 1.2, M.campGreen, x, 2.6, CZ + CAMP_HALF); addCol(x - .7, x + .7, CZ + CAMP_HALF - .7, CZ + CAMP_HALF + .7); }
  box(11.4, 1.6, 0.6, M.campWall, 0, 5.6, CZ + CAMP_HALF);
  const s = campSign('ORIENTATION CAMP', 'Welcome, corps members · Fictional camp', 10.6, 1.4); CAMP.gateSign = s; s.position.set(0, 5.6, CZ + CAMP_HALF + 0.32); scene.add(s);
  box(0.12, 1.1, 3.2, M.black, -4.4, 0.55, CZ + CAMP_HALF + 1.6, scene, false); // boom barrier post
  const bar = box(4.2, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0xd32f2f }), -4.4, 2.6, CZ + CAMP_HALF + 1.6, scene, false); bar.rotation.z = Math.PI / 2 - 0.15; // raised boom
  CAMP.spots.gate = { x: 2, z: CZ + CAMP_HALF + 2.2 };
}
/* ---------------- enterable buildings: real walls, a door gap, a roof; the camera stays inside ---------------- */
const ROOMS = [];
const extWallCache = {};
function extWallMat(len, h, base) {
  const key = `${Math.round(len)}|${h}|${base}`; if (extWallCache[key]) return extWallCache[key];
  const W = Math.max(64, Math.round(len * 64)), H = Math.round(h * 64);
  const t = ctex(W, H, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H); speckle(g, W, H, W * H / 30, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.25)'], 2);
    g.fillStyle = '#1f7a3e'; g.fillRect(0, H - 34, W, 34);
    for (let x = 96; x < W - 80; x += 200) { g.fillStyle = '#e8e2d2'; g.fillRect(x - 6, 50, 102, 74); g.fillStyle = '#2b3740'; g.fillRect(x, 56, 90, 62); g.strokeStyle = '#151515'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + k * 15, 56); g.lineTo(x + k * 15, 118); g.stroke(); } g.fillStyle = 'rgba(40,30,20,.22)'; g.fillRect(x, 124, 90, 30); }
    grime(g, W, H, .3);
  });
  return extWallCache[key] = new THREE.MeshStandardMaterial({ map: t, roughness: .92 });
}
function hollowBuilding(o) {
  const { x, z, w, d, h = 3.4, door = '+z', doorW = 1.6, doorAt = 0, base = '#efeadb', inner = '#e4e9e1', y0 = 0, label, sub, signBg } = o, t = 0.22;
  const intM = new THREE.MeshStandardMaterial({ color: inner, roughness: .95, map: concreteTex, emissive: 0x1a1a18 });
  const seg = (cx, cz, len, alongX, outSign, hh = h, yb = y0) => {
    if (len < 0.05) return;
    const g = new THREE.BoxGeometry(alongX ? len : t, hh, alongX ? t : len), mats = [intM, intM, intM, intM, intM, intM];
    mats[alongX ? (outSign > 0 ? 4 : 5) : (outSign > 0 ? 0 : 1)] = extWallMat(len, hh, base);
    const m = new THREE.Mesh(g, mats); m.position.set(cx, yb + hh / 2, cz); m.castShadow = m.receiveShadow = true; scene.add(m);
    if (yb + 0.01 <= y0 + 0.5) addCol(cx - (alongX ? len / 2 : t / 2 + .05), cx + (alongX ? len / 2 : t / 2 + .05), cz - (alongX ? t / 2 + .05 : len / 2), cz + (alongX ? t / 2 + .05 : len / 2));
  };
  const sides = { '-z': [x, z - d / 2, w, true, -1], '+z': [x, z + d / 2, w, true, 1], '-x': [x - w / 2, z, d, false, -1], '+x': [x + w / 2, z, d, false, 1] };
  for (const [k, [cx, cz, len, ax, os]] of Object.entries(sides)) {
    if (k !== door) { seg(cx, cz, len + (ax ? t : 0), ax, os); continue; }
    const a = -len / 2, b0 = doorAt - doorW / 2, b1 = doorAt + doorW / 2, bL = len / 2;
    const L1 = b0 - a, L2 = bL - b1;
    if (ax) { seg(cx + a + L1 / 2, cz, L1 + t / 2, ax, os); seg(cx + b1 + L2 / 2, cz, L2 + t / 2, ax, os); seg(cx + doorAt, cz, doorW, ax, os, h - 2.4, y0 + 2.4); }
    else { seg(cx, cz + a + L1 / 2, L1, ax, os); seg(cx, cz + b1 + L2 / 2, L2, ax, os); seg(cx, cz + doorAt, doorW, ax, os, h - 2.4, y0 + 2.4); }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.12, d + 0.9), M.roof); roof.position.set(x, y0 + h + 0.06, z); roof.castShadow = true; roof.receiveShadow = true; scene.add(roof);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w - t, 0.04, d - t), M.concrete); fl.position.set(x, y0 + 0.02, z); fl.receiveShadow = true; scene.add(fl);
  // the door spot just outside, and just inside
  const dir = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] }[door], along = door.endsWith('z') ? [doorAt, 0] : [0, doorAt];
  const doorOut = { x: sides[door][0] + along[0] + dir[0] * 1.3, z: sides[door][1] + along[1] + dir[1] * 1.3 }, doorIn = { x: sides[door][0] + along[0] - dir[0] * 1.3, z: sides[door][1] + along[1] - dir[1] * 1.3 };
  if (label) { const sg = campSign(label, sub, Math.min((door.endsWith('z') ? w : d) - 1, 5), 1.0, signBg); sg.position.set(sides[door][0] + along[0] + dir[0] * 0.14, y0 + h - 0.55, sides[door][1] + along[1] + dir[1] * 0.14); sg.rotation.y = { '-z': Math.PI, '+z': 0, '-x': -Math.PI / 2, '+x': Math.PI / 2 }[door]; scene.add(sg); }
  const room = { x0: x - w / 2 + t, x1: x + w / 2 - t, z0: z - d / 2 + t, z1: z + d / 2 - t, h: y0 + h, name: label || 'room' }; ROOMS.push(room);
  return { room, doorOut, doorIn };
}
function bunkBed(x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  const frame = M.bunkFrame || (M.bunkFrame = new THREE.MeshStandardMaterial({ color: 0x3d5a6c, roughness: .5, metalness: .6 }));
  for (const [dx, dz] of [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]]) box(0.05, 1.85, 0.05, frame, dx, 0.92, dz, g, false);
  for (const y of [0.42, 1.32]) { box(0.95, 0.05, 2.0, frame, 0, y, 0, g, false); box(0.88, 0.14, 1.9, pick([M.foamB || (M.foamB = new THREE.MeshStandardMaterial({ color: 0x2f6fb3, roughness: .9 })), M.foamG || (M.foamG = new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: .9 }))]), 0, y + 0.1, 0, g); box(0.5, 0.1, 0.3, M.kerb, 0, y + 0.22, -0.75, g, false); }
  if (Math.random() < .6) box(0.35, 0.35, 0.35, pick([M.red, M.foamB || M.red, M.kerb]), 0.2, 0.18, 1.2, g, false); // bucket / bag
  return g;
}
function campHall(x, z, w, d, h, label, sub, opts = {}) { // a camp building with windows and a painted sign
  const bays = Math.max(2, Math.round(w / 3.4));
  const t = ctex(128 * bays, 160, (g, W, H) => {
    g.fillStyle = opts.wall || '#efeadb'; g.fillRect(0, 0, W, H); speckle(g, W, H, W * 3, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.3)'], 2);
    g.fillStyle = '#1f7a3e'; g.fillRect(0, H - 28, W, 28);
    for (let b = 0; b < bays; b++) { const xx = b * 128 + 24; if (b === (bays >> 1)) { g.fillStyle = '#4a3322'; g.fillRect(xx + 6, 40, 68, 120); continue; } g.fillStyle = '#e9e3d2'; g.fillRect(xx - 5, 34, 90, 70); g.fillStyle = '#2d3a42'; g.fillRect(xx, 38, 80, 62); g.strokeStyle = '#1b1b1b'; g.lineWidth = 3; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(xx + k * 16, 38); g.lineTo(xx + k * 16, 100); g.stroke(); } }
    grime(g, W, H, .3);
  });
  const front = new THREE.MeshStandardMaterial({ map: t, roughness: .9 });
  const side = opts.face || 1; // +1 front faces +z, -1 faces -z, 2 faces +x, -2 faces -x
  const mats = [M.campWall, M.campWall, roofFlat, M.campWall, M.campWall, M.campWall];
  const idx = { 1: 4, '-1': 5, 2: 0, '-2': 1 }[side]; mats[idx] = front;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, h / 2, CZ + z); m.castShadow = m.receiveShadow = true; scene.add(m);
  addCol(x - w / 2, x + w / 2, CZ + z - d / 2, CZ + z + d / 2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.12, d + 1.2), M.roof); roof.position.set(x, h + 0.35, CZ + z); roof.rotation[Math.abs(side) === 1 ? 'x' : 'z'] = 0.05; roof.castShadow = true; scene.add(roof);
  if (label) { const s = campSign(label, sub, Math.min(w - 1, 7), 1.2); const off = Math.abs(side) === 1 ? [0, (d / 2 + 0.05) * Math.sign(side)] : [(w / 2 + 0.05) * Math.sign(side), 0]; s.position.set(x + off[0], h - 0.9, CZ + z + off[1]); s.rotation.y = { 1: 0, '-1': Math.PI, 2: Math.PI / 2, '-2': -Math.PI / 2 }[side]; scene.add(s); }
  const door = Math.abs(side) === 1 ? { x, z: CZ + z + (d / 2 + 1.0) * Math.sign(side) } : { x: x + (w / 2 + 1.0) * Math.sign(side), z: CZ + z };
  return door;
}
{
  const hb = hollowBuilding({ x: -42, z: CZ + 18, w: 8, d: 30, h: 3.6, door: '+x', doorW: 1.8, label: 'HOSTEL B', sub: 'Platoon 5 · Lights out 10PM', signBg: '#1b5e20' });
  CAMP.spots.hostel = hb.doorOut; CAMP.hostelRoom = hb.room;
  for (let zz = CZ + 4.6; zz < CZ + 31.5; zz += 2.6) { bunkBed(-44.9, zz, Math.PI / 2); if (Math.abs(zz - (CZ + 18)) > 2.2) bunkBed(-39.1, zz, Math.PI / 2); }
  CAMP.spots.bunk = { x: -43.6, z: CZ + 12.4 };
  for (const lz of [CZ + 9, CZ + 18, CZ + 27]) { const L0 = new THREE.PointLight(0xfff1d0, 0, 14, 1.4); L0.position.set(-42, 3.1, lz); L0.userData.night = 28; scene.add(L0); CAMP.lights.push(L0); const tube = box(1.2, 0.05, 0.08, M.light, -42, 3.45, lz, scene, false); tube.userData.keep = true; }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 28), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; ring.position.set(CAMP.spots.bunk.x, 0.06, CAMP.spots.bunk.z); ring.userData.keep = true; scene.add(ring); CAMP.bunkRing = ring;
  const fan = box(0.9, 0.04, 0.12, M.kerb, -42, 3.35, CZ + 12, scene, false); fan.userData.keep = true; CAMP.fan = fan;
}
campHall(-42, -18, 8, 30, 3.6, 'HOSTEL C', 'Female corps members', { face: 2 });
CAMP.spots.kit = campHall(40, 30, 10, 8, 3.4, 'KIT STORE', 'Khaki • Crested vest • Jungle boots', { face: -2 });
CAMP.spots.clinic = campHall(40, 44, 10, 7, 3.4, 'CAMP CLINIC', 'Malaria? Come inside', { face: -2, wall: '#f4f6f4' });
CAMP.spots.hall = campHall(22, -44, 22, 12, 5.5, 'SAED HALL', 'Skills acquisition', { face: 1 });
campHall(-24, 22, 10, 7, 3.2, 'CANTEEN', 'Beans • Bread • Pap', { face: 2 });
{ // registration tents with tables and a banner
  for (const x of [-14, -7]) {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.4, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, side: THREE.FrontSide, roughness: .8 })); tent.rotation.y = Math.PI / 4; tent.position.set(x, 4.0, CZ + 38); tent.castShadow = true; scene.add(tent);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box(0.1, 3.3, 0.1, M.pole, x + dx, 1.65, CZ + 38 + dz, scene, false);
    box(3.6, 0.08, 1.0, M.wood, x, 0.8, CZ + 40.6); for (const dx of [-1.6, 1.6]) box(0.08, 0.8, 0.9, M.wood, x + dx, 0.4, CZ + 40.6, scene, false);
    for (let i = 0; i < 6; i++) box(0.3, 0.02, 0.22, new THREE.MeshStandardMaterial({ color: 0xffffff }), x + rnd(-1.4, 1.4), 0.85, CZ + 40.6 + rnd(-.3, .3), scene, false);
  }
  addCol(-17, -4, CZ + 40, CZ + 41.2);
  const s = campSign('REGISTRATION', 'Call-up letter • Green card • Passport', 6, 1.1); s.position.set(-10.5, 3.0, CZ + 41.3); scene.add(s);
  CAMP.spots.desk = { x: -12.5, z: CZ + 42.2 };
}
{ // parade ground podium with roof, flag poles
  box(12, 1.0, 4, M.campWall, 0, 0.5, CZ - 19); box(12.4, 0.2, 4.4, M.campGreen, 0, 1.05, CZ - 19, scene, false);
  for (const x of [-5.6, 5.6]) box(0.2, 3.2, 0.2, M.pole, x, 2.6, CZ - 20.6);
  const r = box(13, 0.12, 4.8, M.roof, 0, 4.2, CZ - 19.4); r.rotation.x = 0.06;
  addCol(-6, 6, CZ - 21, CZ - 17);
  for (const x of [-9, -7.5, -6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 8, 8), M.chrome); p.position.set(x, 4, CZ - 22); scene.add(p); }
  const ft = ctex(192, 96, (c, w, h) => { c.fillStyle = '#008751'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(w / 3, 0, w / 3, h); });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2, 1, 12, 4), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide })); f.position.set(-6, 7.4, CZ - 22); f.position.x += 1; scene.add(f); CAMP.flag = { mesh: f, base: f.geometry.attributes.position.array.slice() };
  CAMP.spots.podium = { x: 0, z: CZ - 16.2 };
  // the player's slot in Platoon 5's formation, marked with a ring
  CAMP.slot = { x: 2, z: CZ - 6 };
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; ring.position.set(CAMP.slot.x, 0.14, CAMP.slot.z); scene.add(ring); CAMP.ring = ring; ring.visible = false;
  const s = campSign('PLATOON 5', null, 3, 0.7, '#0d47a1'); s.position.set(CAMP.slot.x, 2.4, CAMP.slot.z - 7.5); scene.add(s); box(0.08, 2.4, 0.08, M.pole, CAMP.slot.x, 1.2, CAMP.slot.z - 7.52, scene, false);
}
{ // stage for social nights
  box(10, 1.2, 6, M.black, -18, 0.6, CZ - 44); addCol(-23, -13, CZ - 47, CZ - 41);
  const s = campSign('SOCIAL NIGHT', 'Platoon competitions • Karaoke', 8, 1.5, '#4a148c', '#fff', '#ffd54f'); s.position.set(-18, 5.4, CZ - 46.8); scene.add(s);
  for (const x of [-23, -13]) { box(0.2, 5, 0.2, M.black, x, 2.5, CZ - 47); box(1, 1.6, 0.9, M.black, x, 2.0, CZ - 41.2); }
  box(10.4, 0.25, 0.25, M.black, -18, 5, CZ - 47);
  CAMP.spots.stage = { x: -18, z: CZ - 38.8 };
  const pl = new THREE.PointLight(0xff4fb0, 0, 26, 1.6); pl.position.set(-20, 4.5, CZ - 41); scene.add(pl);
  const pl2 = new THREE.PointLight(0x4fc3ff, 0, 26, 1.6); pl2.position.set(-16, 4.5, CZ - 41); scene.add(pl2);
  CAMP.lights.push(pl, pl2);
}
{ // notice board near the parade ground
  box(3.2, 1.9, 0.12, M.wood, 14, 1.7, CZ + 18.5); for (const dx of [-1.5, 1.5]) box(0.12, 1.9, 0.12, M.wood, 14 + dx, 0.95, CZ + 18.5, scene, false);
  const nb = ctex(512, 300, (g, w, h) => { g.fillStyle = '#c9a77a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { g.save(); g.translate(rnd(20, w - 120), rnd(20, h - 110)); g.rotate(rnd(-.1, .1)); g.fillStyle = pick(['#fff', '#fff8dc', '#e3f2fd']); g.fillRect(0, 0, rnd(80, 130), rnd(90, 120)); g.fillStyle = '#333'; for (let l = 0; l < 6; l++) g.fillRect(8, 14 + l * 13, rnd(40, 100), 3); g.restore(); } g.fillStyle = '#b71c1c'; g.font = '900 34px Arial Black'; g.fillText('NOTICE', 180, 40); });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.75), new THREE.MeshStandardMaterial({ map: nb, roughness: .9 })); p.position.set(14, 1.7, CZ + 18.57); scene.add(p);
  addCol(12.3, 15.7, CZ + 18.3, CZ + 18.7); CAMP.spots.notice = { x: 14, z: CZ + 19.6 };
}
{ // mammy market: a row of stalls with zinc roofs
  const names = [["MAMA CHIDINMA", 'Provisions • Bucket • Torchlight'], ['AUNTY BISI KITCHEN', 'Rice • Beans • Plantain'], ['KHAKI ADJUSTMENT', 'Tailor while you wait'], ['CORPER PHOTOS', 'Instant print ₦500'], ['RECHARGE + DATA', 'Phone charging ₦100']];
  CAMP.spots.market = [];
  names.forEach(([n, sub], i) => {
    const z = -6 - i * 7.5, x = 44;
    box(0.12, 2.6, 6, M.wood, x + 3, 1.3, CZ + z); for (const dz of [-2.9, 2.9]) box(0.12, 2.6, 0.12, M.wood, x - 2.6, 1.3, CZ + z + dz, scene, false);
    const rf = box(6.6, 0.08, 6.8, M.roof, x + 0.2, 2.75, CZ + z); rf.rotation.z = 0.08;
    box(1, 0.9, 5, M.wood, x - 2, 0.45, CZ + z); for (let k = 0; k < 10; k++) box(0.25, 0.3, 0.25, new THREE.MeshStandardMaterial({ color: pick([0xc62828, 0xf9a825, 0x1565c0, 0x2e7d32, 0xffffff, 0xef6c00]) }), x - 2 + rnd(-.3, .3), 1.05, CZ + z + rnd(-2.2, 2.2), scene, false);
    const s = campSign(n, sub, 5, 0.9, pick(['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a'])); s.position.set(x - 2.65, 3.25, CZ + z); s.rotation.y = -Math.PI / 2; scene.add(s);
    addCol(x - 2.6, x + 3.1, CZ + z - 3, CZ + z + 3);
    CAMP.spots.market.push({ x: x - 3.4, z: CZ + z, name: n });
  });
}
for (let i = 0; i < 26; i++) { const a = rnd(0, 6.28), r = rnd(30, 52), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) > 34 && Math.abs(x) < 48) continue; if (Math.abs(x) < 9 && z > 20) continue; tree(x, CZ + z, rnd(.9, 1.25)); }
for (const x of [-30, -20, 20, 30]) palm(x, CZ + 50);
// camp lamp posts (lit at night)
for (const [x, z] of [[-10, 20], [10, 20], [-10, -22], [10, -22], [-30, 5], [30, 5], [-30, -30], [30, -30]]) { box(0.12, 5, 0.12, M.pole, x, 2.5, CZ + z, scene, false); box(0.5, 0.15, 0.3, M.light, x, 5.0, CZ + z, scene, false); }
const campLamp = new THREE.PointLight(0xffe2a8, 0, 60, 1.4); campLamp.position.set(0, 9, CZ); scene.add(campLamp); CAMP.lights.push(campLamp);
// the camp danfo that takes you to your LGA
CAMP.busSpot = { x: 8, z: CZ + 64 };
for (let i = campStart; i < scene.children.length; i++) scene.children[i].userData.area = 'camp';

/* ---------------- PPA: Corper Close Model School (fictional), north side of the street ---------------- */
const SCH = { x: -77, spots: {}, roof: null, students: [], board: null, boardCtx: null };
{
  const X = SCH.x, wallM = new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: .9, map: concreteTex }), blue = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: .8 });
  // compound wall with a gate gap
  box(18, 2.2, 0.3, wallM, X - 12, 1.1, -11.6); box(18, 2.2, 0.3, wallM, X + 12, 1.1, -11.6);
  addCol(X - 21, X - 3, -11.8, -11.4); addCol(X + 3, X + 21, -11.8, -11.4);
  for (const s of [-1, 1]) { box(0.3, 2.2, 30, wallM, X + s * 21, 1.1, -26.6); addCol(X + s * 21 - .2, X + s * 21 + .2, -41.6, -11.6); }
  box(42, 2.2, 0.3, wallM, X, 1.1, -41.6); addCol(X - 21, X + 21, -41.8, -41.4);
  for (const dx of [-3, 3]) box(0.7, 3.2, 0.7, blue, X + dx, 1.6, -11.6);
  const sign = campSign('CORPER CLOSE MODEL SCHOOL', 'Knowledge is light · Fictional school', 7.4, 1.4, '#0d47a1'); SCH.sign = sign; sign.position.set(X, 3.9, -11.4); scene.add(sign);
  box(7.6, 0.2, 0.4, blue, X, 3.1, -11.6);
  const yard = new THREE.PlaneGeometry(41, 29); yard.rotateX(-Math.PI / 2); const ym = new THREE.Mesh(yard, M.concrete); ym.position.set(X, 0.015, -26.6); ym.receiveShadow = true; scene.add(ym);
  // open-sided classroom pavilion: roof on pillars, back wall with the chalkboard
  const CX = X - 6, CZb = -34;
  const cls = hollowBuilding({ x: CX, z: CZb - 0.4, w: 17, d: 11, h: 3.8, door: '+z', doorW: 1.8, doorAt: 5.6, base: '#f1e9d0', inner: '#e8efe6', label: 'JSS 2A', signBg: '#0d47a1' });
  SCH.door = cls.doorOut; SCH.room = cls.room;
  for (const fx of [-4, 4]) { const f = box(1.0, 0.04, 0.14, M.kerb, CX + fx, 3.55, CZb - 0.4, scene, false); f.userData.keep = true; }
  // chalkboard (canvas we redraw for each question)
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 400; SCH.boardCtx = bc.getContext('2d');
  SCH.boardTex = new THREE.CanvasTexture(bc); SCH.boardTex.colorSpace = THREE.SRGBColorSpace; SCH.boardTex.anisotropy = ANISO;
  SCH.board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.35), new THREE.MeshStandardMaterial({ map: SCH.boardTex, roughness: .95 })); SCH.board.position.set(CX, 2.0, CZb - 5.62); SCH.board.userData.keep = true; scene.add(SCH.board);
  box(6.3, 2.6, 0.06, M.wood, CX, 2.0, CZb - 5.66, scene, false);
  box(2.0, 0.08, 0.9, M.wood, CX + 4.5, 0.8, CZb - 3.8); for (const dx of [-0.9, 0.9]) box(0.08, 0.8, 0.8, M.wood, CX + 4.5 + dx, 0.4, CZb - 3.8, scene, false); // teacher's table
  // pupils' desks: 3 rows x 4
  SCH.seats = [];
  for (let r0 = 0; r0 < 3; r0++) for (let c0 = 0; c0 < 4; c0++) {
    const x = CX - 5.4 + c0 * 3.4, z = CZb - 0.8 + r0 * 1.9;
    box(1.4, 0.06, 0.6, M.wood, x, 0.72, z - 0.45); box(1.4, 0.06, 0.4, M.wood, x, 0.45, z + 0.15);
    for (const dx of [-0.6, 0.6]) box(0.06, 0.72, 0.06, M.wood, x + dx, 0.36, z - 0.45, scene, false);
    SCH.seats.push({ x: x - 0.32, z: z + 0.35 }, { x: x + 0.32, z: z + 0.35 });
  }
  SCH.spots.board = { x: CX, z: CZb - 4.2 };
  SCH.inside = { x0: CX - 8.3, x1: CX + 8.3, z0: CZb - 6, z1: CZb + 5 };
  // staff room: enterable, teachers at their desks, the old computer in the corner
  const sr = hollowBuilding({ x: X + 15, z: -24, w: 9, d: 11, h: 3.4, door: '-x', doorW: 1.6, doorAt: 0, base: '#efe6cf', inner: '#e9eee4', label: 'STAFF ROOM', signBg: '#0d47a1' });
  SCH.staffRoom = sr.room; SCH.staffDoor = sr.doorOut;
  const desk = (x, z, w = 1.6, d = 0.8) => { box(w, 0.07, d, M.wood, x, 0.78, z); for (const dx of [-w / 2 + 0.08, w / 2 - 0.08]) box(0.07, 0.78, d - 0.1, M.wood, x + dx, 0.39, z, scene, false); };
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .6 }), paper = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: .9 });
  desk(X + 18.2, -27.8); box(0.5, 0.38, 0.42, dark, X + 18.5, 1.0, -28.0, scene, false); box(0.55, 0.03, 0.2, dark, X + 18.2, 0.83, -27.6, scene, false); // the computer older than you
  desk(X + 13.2, -20.6); desk(X + 16.4, -20.6); desk(X + 12.6, -27.6);
  for (const [x, z] of [[X + 13.0, -20.6], [X + 16.2, -20.7], [X + 12.4, -27.5]]) box(0.42, 0.04, 0.3, paper, x, 0.84, z, scene, false); // exercise books
  box(0.4, 2.0, 2.4, M.wood, X + 19.2, 1.0, -21.5); // shelf of files
  box(3.0, 1.1, 0.04, new THREE.MeshStandardMaterial({ color: 0xc9a46b, roughness: .9 }), X + 15, 1.9, -29.3, scene, false); // notice board
  SCH.spots.staff = { x: X + 18.2, z: -27.2 };
  SCH.teachers = [{ x: X + 13.2, z: -19.8, r: Math.PI, rig: 'fem', tex: 'fTeacher', get name() { return TCH(); }, anim: 'sit' }, { x: X + 16.4, z: -19.8, r: Math.PI, rig: 'man2', tex: 'mTeacher', name: 'Mr. Femi', anim: 'type' }, { x: X + 12.6, z: -26.8, r: Math.PI, rig: 'fem', tex: 'civF4', name: 'Miss Halima', anim: 'sit' }];
  // principal's office by the gate
  const po = hollowBuilding({ x: X - 15.5, z: -19, w: 8, d: 7, h: 3.3, door: '+x', doorW: 1.5, doorAt: 0, base: '#efe6cf', inner: '#ece6da', label: 'PRINCIPAL', signBg: '#0d47a1' });
  SCH.office = po.room; desk(X - 17.4, -19, 0.9, 2.0); box(0.6, 1.1, 0.6, new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: .7 }), X - 18.8, 0.55, -19, scene, false);
  box(0.05, 0.9, 1.4, new THREE.MeshStandardMaterial({ color: 0x1f6b3a }), X - 19.35, 2.0, -19, scene, false); // a framed something
  SCH.spots.principal = { x: X - 16.0, z: -19 };
  // classroom block B: two storeys, six classes, a veranda upstairs (exterior only)
  { const bx = X + 11.5, bz = -37.6, w = 16, d = 7, h = 3.4, wl = extWallMat(w, h, '#f1e9d0'), side = new THREE.MeshStandardMaterial({ color: 0xeee6cf, map: concreteTex, roughness: .95 });
    for (const fl of [0, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, wl, side]); m.position.set(bx, fl * (h + 0.2) + h / 2, bz); m.castShadow = m.receiveShadow = true; scene.add(m); }
    addCol(bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2);
    box(w + 0.6, 0.2, 1.8, M.concrete, bx, h + 0.1, bz + d / 2 + 0.9); box(w + 0.6, 0.9, 0.08, side, bx, h + 0.65, bz + d / 2 + 1.75); // upstairs walkway + parapet
    for (let i = 0; i < 5; i++) box(0.3, h, 0.3, side, bx - w / 2 + 0.2 + i * (w - 0.4) / 4, h / 2, bz + d / 2 + 1.6);
    box(w + 1.2, 0.18, d + 2.6, M.roof, bx, 2 * h + 0.35, bz + 0.9);
    for (let i = 0; i < 6; i++) box(1.2, 0.18, 0.5, M.concrete, bx + w / 2 + 0.7, 0.1 + i * 0.6, bz + d / 2 - 0.4 - i * 0.55); // stairs
    const names = [['JSS 1A', 'JSS 1B', 'JSS 3A'], ['SS 1', 'SS 2', 'SS 3']];
    names.forEach((row, fl) => row.forEach((n, i) => { const dx = bx - w / 2 + 2.6 + i * 5.3; box(1.1, 2.1, 0.06, new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: .7 }), dx, fl * (h + 0.2) + 1.05, bz + d / 2 + 0.03, scene, false);
      const sg = campSign(n, null, 1.4, 0.42, '#0d47a1'); sg.position.set(dx, fl * (h + 0.2) + 2.5, bz + d / 2 + 0.05); scene.add(sg); }));
  }
  { // tuck shop + toilets
    const ts = box(3.2, 2.4, 2.2, new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: .8 }), X + 5.5, 1.2, -29.4); addCol(X + 3.9, X + 7.1, -30.5, -28.3);
    const sg = campSign('TUCK SHOP', 'Puff-puff · Zobo · Biscuit', 3.0, 0.8, '#c62828'); sg.position.set(X + 5.5, 2.75, -28.25); scene.add(sg);
    box(3.0, 2.6, 4.0, new THREE.MeshStandardMaterial({ color: 0xd7ccc8, map: concreteTex, roughness: .95 }), X - 18.6, 1.3, -38.2); addCol(X - 20.1, X - 17.1, -40.2, -36.2);
    const tl = campSign('TOILET', 'Boys · Girls', 2.2, 0.6, '#455a64'); tl.position.set(X - 17.08, 1.9, -38.2); tl.rotation.y = Math.PI / 2; scene.add(tl);
  }
  SCH.spots.tuck = { x: X + 5.5, z: -27.4 };
  // assembly ground: flagpole + a few trees
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 7, 8), M.chrome); fp.position.set(X + 4, 3.5, -16); scene.add(fp);
  tree(X - 9, -14.2, 1.1); tree(X + 9.5, -14.2, 1);
  SCH.gate = { x: X, z: -9.6 };
}
/* ---------------- other PPAs: a health centre (south side) and an office complex (north side) ---------------- */
const WORK = { clinic: { spots: {}, staff: [] }, office: { spots: {}, staff: [] } };
{
  const desk = (x, z, w = 1.6, d = 0.8, rot = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); box(w, 0.07, d, M.wood, 0, 0.78, 0, g); for (const dx of [-w / 2 + 0.08, w / 2 - 0.08]) box(0.07, 0.78, d - 0.1, M.wood, dx, 0.39, 0, g, false); return g; };
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .6 }), white = new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: .7 }), teal = new THREE.MeshStandardMaterial({ color: 0x00897b, roughness: .7 }), steel = new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: .4, metalness: .5 });
  // ---- health centre: reception, waiting benches, consulting corner, records shelf ----
  { const cx = 72, cz = 17.4, w = 16, d = 11.4;
    const h = hollowBuilding({ x: cx, z: cz, w, d, h: 3.5, door: '-z', doorW: 2.0, doorAt: -3, base: '#eef4f1', inner: '#eaf3ef' });
    WORK.clinic.room = h.room; WORK.clinic.door = h.doorOut;
    const sg = campSign('PRIMARY HEALTH CENTRE', 'Health for all · Fictional', 7, 1.2, '#00695c'); sg.position.set(cx + 2.5, 3.0, cz - d / 2 - 0.14); sg.rotation.y = Math.PI; scene.add(sg); WORK.clinic.sign = sg;
    box(0.5, 0.5, 0.08, new THREE.MeshStandardMaterial({ color: 0xd32f2f, emissive: 0x6a0000 }), cx - 6.2, 2.7, cz - d / 2 - 0.16, scene, false); // red cross panel
    box(0.16, 0.5, 0.1, white, cx - 6.2, 2.7, cz - d / 2 - 0.22, scene, false); box(0.5, 0.16, 0.1, white, cx - 6.2, 2.7, cz - d / 2 - 0.22, scene, false);
    desk(cx - 4.6, cz - 1.6, 2.4, 0.8); box(2.4, 1.0, 0.06, teal, cx - 4.6, 0.5, cz - 2.0, scene, false); // reception counter
    for (const bz of [cz - 3.2, cz - 1.0, cz + 1.2]) { box(3.2, 0.08, 0.5, M.wood, cx + 2.6, 0.45, bz); for (const dx of [-1.4, 1.4]) box(0.08, 0.45, 0.45, steel, cx + 2.6 + dx, 0.22, bz, scene, false); } // waiting benches
    box(0.05, 2.2, 4.2, white, cx + 4.4, 1.1, cz + 3.2, scene, false); // curtain screen for the consulting corner
    box(1.9, 0.55, 0.8, white, cx + 6.3, 0.45, cz + 3.8); box(0.6, 0.12, 0.8, new THREE.MeshStandardMaterial({ color: 0xbfe3dc }), cx + 6.9, 0.78, cz + 3.8, scene, false); // examination couch
    box(0.4, 2.0, 3.0, M.wood, cx - 7.4, 1.0, cz + 2.4); for (let i = 0; i < 4; i++) box(0.3, 0.3, 2.6, new THREE.MeshStandardMaterial({ color: [0xf2c94c, 0x90caf9, 0xef9a9a, 0xa5d6a7][i] }), cx - 7.2, 0.4 + i * 0.45, cz + 2.4, scene, false); // patient cards
    desk(cx - 2.4, cz + 3.6, 1.8, 0.8); box(0.45, 0.32, 0.06, new THREE.MeshStandardMaterial({ color: 0x2e7d32 }), cx - 2.4, 1.0, cz + 3.95, scene, false); // immunisation table + chart
    const poster = campSign('IMMUNISE YOUR CHILD', 'Every Thursday · Free', 2.4, 0.8, '#2e7d32'); poster.position.set(cx - 0.4, 1.9, cz + d / 2 - 0.25); poster.rotation.y = Math.PI; scene.add(poster);
    Object.assign(WORK.clinic.spots, { boss: { x: cx - 4.6, z: cz - 2.6 }, sign: { x: cx - 5.6, z: cz - 2.7 }, triage: { x: cx + 1.0, z: cz - 1.0 }, records: { x: cx - 6.6, z: cz + 2.4 }, immun: { x: cx - 2.4, z: cz + 2.8 }, talk: { x: cx + 2.6, z: cz - 4.4 } });
  }
  // ---- office complex: open-plan desks, manager's office, printer, meeting table ----
  { const cx = 29, cz = -17.8, w = 17, d = 12;
    const h = hollowBuilding({ x: cx, z: cz, w, d, h: 3.4, door: '+z', doorW: 2.0, doorAt: 0, base: '#e6e9ee', inner: '#eef0f3' });
    WORK.office.room = h.room; WORK.office.door = h.doorOut;
    const up = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 3.4, d + 0.2), [new THREE.MeshStandardMaterial({ color: 0xdfe3e8, map: concreteTex }), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, map: concreteTex }), M.roof, M.roof, extWallMat(w + 0.2, 3.4, '#dfe3e8'), new THREE.MeshStandardMaterial({ color: 0xdfe3e8 })]);
    up.position.set(cx, 3.6 + 1.7, cz); up.castShadow = true; scene.add(up); // upper floor (exterior only)
    const sg = campSign('OFFICE COMPLEX', 'Fictional organisation', 7, 1.2, '#283593'); sg.position.set(cx, 3.15, cz + d / 2 + 0.14); scene.add(sg); WORK.office.sign = sg;
    for (const [dx, dz] of [[-5.5, 0.5], [-2.5, 0.5], [0.5, 0.5], [-5.5, -2.5], [-2.5, -2.5], [0.5, -2.5]]) { desk(cx + dx, cz + dz, 1.6, 0.8); box(0.55, 0.36, 0.05, dark, cx + dx, 1.05, cz + dz - 0.25, scene, false); box(0.04, 0.9, 0.9, new THREE.MeshStandardMaterial({ color: 0x9fa8b3 }), cx + dx + 0.85, 0.85, cz + dz, scene, false); }
    box(0.08, 2.4, 4.6, new THREE.MeshStandardMaterial({ color: 0xbcd4e6, transparent: true, opacity: .45, roughness: .1 }), cx + 4.2, 1.2, cz - 3.4, scene, false); // glass wall of the manager's office
    desk(cx + 6.2, cz - 3.6, 1.9, 0.9); box(0.6, 1.1, 0.6, new THREE.MeshStandardMaterial({ color: 0x3e2723 }), cx + 6.2, 0.55, cz - 4.6, scene, false);
    box(0.9, 1.05, 0.65, new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: .5 }), cx + 7.6, 0.53, cz + 3.6); box(0.6, 0.06, 0.4, white, cx + 7.6, 1.1, cz + 3.6, scene, false); // printer
    box(3.0, 0.07, 1.3, M.wood, cx + 2.5, 0.76, cz + 3.4); for (const dx of [-1.3, 1.3]) box(0.07, 0.76, 1.1, M.wood, cx + 2.5 + dx, 0.38, cz + 3.4, scene, false); // meeting table
    const wb = campSign('Q3 TARGETS', 'Customers · Reports · Deadlines', 2.6, 1.0, '#ffffff', '#283593'); wb.position.set(cx - 2.0, 1.8, cz - d / 2 + 0.24); scene.add(wb);
    Object.assign(WORK.office.spots, { boss: { x: cx + 5.2, z: cz - 3.0 }, sign: { x: cx - 6.5, z: cz + 4.6 }, desk: { x: cx - 2.5, z: cz + 1.4 }, printer: { x: cx + 7.0, z: cz + 2.8 }, meet: { x: cx + 2.5, z: cz + 2.4 }, front: { x: cx - 6.5, z: cz + 4.0 } });
  }
}
/* ---------------- vehicles (procedural, swap-in GLB later) ---------------- */
function sideShape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); } return s; }
function extr(shape, depth, bevel = .05) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 }); g.translate(0, 0, -depth / 2); return g; }
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18); wheelGeo.rotateX(Math.PI / 2);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10); hubGeo.rotateX(Math.PI / 2);
function wheels(g, xs, zw, r = 1) { const out = []; for (const x of xs) for (const z of [-zw, zw]) { const w = new THREE.Group(); w.position.set(x, 0.36 * r, z); w.scale.setScalar(r); const t = new THREE.Mesh(wheelGeo, M.tyre); t.castShadow = true; w.add(t, new THREE.Mesh(hubGeo, M.hub)); g.add(w); out.push(w); } return out; }
const GEO = {};
function danfo() {
  if (!GEO.danfo) {
    GEO.danfo = {
      body: extr(sideShape([[-2.4, .4], [2.25, .4], [2.45, .4, 2.45, .7], [2.45, 1.15], [2.0, 2.1], [1.9, 2.25, 1.7, 2.25], [-2.25, 2.25], [-2.4, 2.25, -2.4, 2.1], [-2.4, .4]]), 1.86),
      glass: extr(sideShape([[-2.25, 1.32], [2.37, 1.32], [2.04, 2.05], [-2.25, 2.05], [-2.25, 1.32]]), 1.98, 0),
      band: extr(sideShape([[-2.42, .92], [2.44, .92], [2.44, 1.05], [-2.42, 1.05], [-2.42, .92]]), 1.98, 0),
      band2: extr(sideShape([[-2.42, 1.16], [2.43, 1.16], [2.41, 1.22], [-2.42, 1.22], [-2.42, 1.16]]), 1.98, 0),
    };
  }
  const g = new THREE.Group(), D = GEO.danfo;
  const body = new THREE.Mesh(D.body, paint(0xf2c01a)); body.castShadow = true; body.receiveShadow = true; g.add(body);
  g.add(new THREE.Mesh(D.glass, M.glass), new THREE.Mesh(D.band, M.black), new THREE.Mesh(D.band2, M.black));
  for (const x of [-1.5, -0.4, 0.7, 1.75]) box(0.09, 0.74, 2.0, paint(0xf2c01a), x, 1.69, 0, g, false); // pillars
  box(0.12, 0.25, 1.9, M.chrome, 2.52, 0.55, 0, g, false); box(0.12, 0.25, 1.9, M.chrome, -2.47, 0.55, 0, g, false);
  for (const z of [-.7, .7]) box(0.06, 0.16, 0.3, M.light, 2.5, 0.9, z, g, false);
  for (const z of [-.75, .75]) box(0.06, 0.16, 0.22, M.red, -2.46, 0.9, z, g, false);
  for (let x = -2; x < 1.8; x += .5) box(0.05, 0.12, 1.7, M.black, x, 2.38, 0, g, false); // roof rack
  box(4.2, 0.05, 0.05, M.black, -.1, 2.44, -.85, g, false); box(4.2, 0.05, 0.05, M.black, -.1, 2.44, .85, g, false);
  // open side door (passenger side, +z / kerb side when eastbound)
  box(1.0, 1.25, 0.04, new THREE.MeshStandardMaterial({ color: 0x101010 }), 0.15, 1.05, 1.0, g, false);
  const w = wheels(g, [-1.55, 1.6], 0.92);
  return { g, wheels: w, len: 5.0, kind: 'danfo' };
}
function keke() {
  const g = new THREE.Group(), col = pick([0xf2c01a, 0x2e7d32, 0xf2c01a]);
  if (!GEO.keke) GEO.keke = { body: extr(sideShape([[-1.3, .35], [1.0, .35], [1.35, .55, 1.35, 1.0], [1.15, 1.25], [-1.3, 1.25], [-1.3, .35]]), 1.15) };
  const b = new THREE.Mesh(GEO.keke.body, paint(col)); b.castShadow = true; g.add(b);
  const top = box(2.5, 0.08, 1.35, M.black, -0.12, 2.0, 0, g); for (const [x, z] of [[1.05, .6], [1.05, -.6], [-1.3, .6], [-1.3, -.6]]) box(0.05, 0.8, 0.05, M.black, x, 1.6, z, g, false);
  box(0.05, 0.75, 1.1, M.glass, 1.15, 1.62, 0, g, false);
  box(0.9, 0.5, 1.05, new THREE.MeshStandardMaterial({ color: 0x1f1f1f }), -0.6, 1.2, 0, g, false); // back seat
  const w = [...wheels(g, [-0.85], 0.62, .85)]; const fw = new THREE.Group(); fw.position.set(1.05, .31, 0); fw.scale.setScalar(.85); fw.add(new THREE.Mesh(wheelGeo, M.tyre)); g.add(fw); w.push(fw);
  return { g, wheels: w, len: 2.8, kind: 'keke' };
}
function car() {
  const g = new THREE.Group(), col = pick([0xc7c9cc, 0x1c1c1e, 0x6e0f14, 0xf2f2f2, 0x1d3f72, 0x8a8f95, 0x3b4a2f]);
  if (!GEO.car) GEO.car = {
    body: extr(sideShape([[-2.35, .35], [2.2, .35], [2.38, .38, 2.38, .7], [2.3, .95], [1.1, 1.05], [.55, 1.48], [-1.1, 1.5], [-1.85, 1.08], [-2.3, 1.0], [-2.38, .9, -2.35, .35]]), 1.62, .07),
    glass: extr(sideShape([[1.02, 1.05], [.56, 1.44], [-1.08, 1.46], [-1.75, 1.08], [1.02, 1.05]]), 1.66, 0),
  };
  const b = new THREE.Mesh(GEO.car.body, paint(col)); b.castShadow = true; b.receiveShadow = true; g.add(b); g.add(new THREE.Mesh(GEO.car.glass, M.glass));
  for (const z of [-.6, .6]) box(0.05, 0.12, 0.35, M.light, 2.37, 0.78, z, g, false); for (const z of [-.6, .6]) box(0.05, 0.12, 0.3, M.red, -2.38, 0.8, z, g, false);
  const w = wheels(g, [-1.45, 1.45], 0.8, .92);
  return { g, wheels: w, len: 4.8, kind: 'car' };
}
// optional real models: drop CC-BY/CC0 GLBs in /models to replace the procedural ones
const OPTIONAL = { danfo: 'models/danfo.gltf.json', keke: 'models/keke.gltf.json', car: 'models/car.gltf.json' };
const FLIP = { danfo: 0, keke: Math.PI, car: 0 }; // extra yaw if a model faces backwards
const realModels = {};

function applyReal(v) { if (!realModels[v.kind] || v.real) return; v.g.children.forEach(c => c.visible = false); v.real = realModels[v.kind].clone(); v.g.add(v.real); }
const LANES = [{ z: 2.0, dir: 1 }, { z: -2.0, dir: -1 }];
const traffic = [];
function spawnVehicle(lane, x, kind) {
  const v = kind === 'danfo' ? danfo() : kind === 'keke' ? keke() : car();
  applyReal(v);
  v.lane = lane; v.x = x; v.v = rnd(6, 10); v.vmax = kind === 'keke' ? rnd(7, 9) : kind === 'danfo' ? rnd(9, 12) : rnd(10, 14); v.stop = 0; v.served = -999;
  v.g.position.set(x, 0, LANES[lane].z); v.g.rotation.y = LANES[lane].dir > 0 ? 0 : Math.PI;
  scene.add(v.g); traffic.push(v); return v;
}
{
  const kinds = ['danfo', 'danfo', 'keke', 'car', 'danfo', 'car', 'keke', 'car', 'danfo', 'keke'];
  const NV = TOUCH ? 7 : 11; for (let lane = 0; lane < 2; lane++) for (let i = 0; i < NV; i++) spawnVehicle(lane, -HALF + i * (HALF * 2 / NV) + rnd(0, 12), kinds[(i + lane * 3) % kinds.length]);
}

/* ---------------- characters ---------------- */
const loader = new GLTFLoader();
// Models are stored as glTF JSON + base64 text (the artifact host serves neither .glb nor data: fetches).
async function loadGLB(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const j = await r.json(), base = url.replace(/[^/]*$/, '');
  if (j.buffers && j.buffers[0] && !j.buffers[0].uri) {
    const t = await fetch(url.replace(/\.gltf\.json$/, '.b64.txt')); if (!t.ok) throw new Error('missing data for ' + url);
    const s = atob((await t.text()).trim()), bin = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
    let js = new TextEncoder().encode(JSON.stringify(j)); const jp = (4 - js.length % 4) % 4, bp = (4 - bin.length % 4) % 4;
    const total = 12 + 8 + js.length + jp + 8 + bin.length + bp, out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, js.length + jp, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + jp);
    const o = 20 + js.length + jp; dv.setUint32(o, bin.length + bp, true); dv.setUint32(o + 4, 0x004E4942, true); out.set(bin, o + 8);
    return new Promise((res, rej) => loader.parse(out.buffer, base, res, rej));
  }
  return new Promise((res, rej) => loader.parse(JSON.stringify(j), base, res, rej));
}
const SKIN = [[0.42, 0.29, 0.22], [0.5, 0.35, 0.26], [0.36, 0.24, 0.18], [0.58, 0.41, 0.3], [0.32, 0.21, 0.16]];
function isSkin(r, g, b) { return r > 95 && g > 40 && b > 20 && b > r * 0.33 && r > g && r > b && r - g > 12 && Math.max(r, g, b) - Math.min(r, g, b) > 18 && r - b > 30; }
// Recolour a character texture: darken skin to Nigerian tones, tint clothing.
function recolor(srcImg, skin, cloth, keepHue = false) {
  const w = srcImg.width, h = srcImg.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(srcImg, 0, 0); const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], L = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
    if (isSkin(r, gg, b)) { p[i] = r * skin[0] * 1.25; p[i + 1] = gg * skin[1] * 1.3; p[i + 2] = b * skin[2] * 1.35; }
    else if (cloth && L > 0.24) { const k = keepHue ? 0.55 : 0.18; const Lc = Math.min(1, 0.25 + L * 0.95); p[i] = clamp(cloth[0] * 255 * Lc * (1 - k) + r * k, 0, 255); p[i + 1] = clamp(cloth[1] * 255 * Lc * (1 - k) + gg * k, 0, 255); p[i + 2] = clamp(cloth[2] * 255 * Lc * (1 - k) + b * k, 0, 255); }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
}
function recolorOutfit(srcImg, skin, shirt, pants) {
  const sk = [0, 0, 0, 0];
  const w = srcImg.width, h = srcImg.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(srcImg, 0, 0); const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2], L = (0.3 * r + 0.59 * gg + 0.11 * b) / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (isSkin(r, gg, b)) { p[i] = r * skin[0] * 1.25; p[i + 1] = gg * skin[1] * 1.3; p[i + 2] = b * skin[2] * 1.35; if (L > 0.35 && L < 0.8) { sk[0] += p[i]; sk[1] += p[i + 1]; sk[2] += p[i + 2]; sk[3]++; } }
    else if (shirt && b > r + 10 && L > 0.38) { const k = Math.min(1.1, L * 1.25); p[i] = shirt[0] * 255 * k; p[i + 1] = shirt[1] * 255 * k; p[i + 2] = shirt[2] * 255 * k; }
    else if (pants && L > 0.12 && L < 0.36 && mx - mn < 28) { const k = 0.45 + L * 1.6; p[i] = clamp(pants[0] * 255 * k, 0, 255); p[i + 1] = clamp(pants[1] * 255 * k, 0, 255); p[i + 2] = clamp(pants[2] * 255 * k, 0, 255); }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; if (sk[3]) t.userData.skin = [sk[0] / sk[3], sk[1] / sk[3], sk[2] / sk[3]]; return t;
}
function partMask(root, W, H) { // rasterise each mesh's UV islands: R channel = part id
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const ids = {}; let n = 0;
  root.traverse(m => { if (!m.isMesh || /hair/i.test(m.material.name)) return; const k = (m.name.match(/_([A-Za-z]+)$/) || [])[1] || m.name; if (!ids[k]) ids[k] = ++n * 20;
    const uv = m.geometry.attributes.uv, ix = m.geometry.index; if (!uv) return; g.fillStyle = g.strokeStyle = `rgb(${ids[k]},0,0)`; g.lineWidth = 2; g.beginPath();
    const cnt = ix ? ix.count : uv.count; for (let t = 0; t < cnt; t += 3) { for (let v = 0; v < 3; v++) { const q = ix ? ix.getX(t + v) : t + v, x = uv.getX(q) * W, y = uv.getY(q) * H; v ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
    g.fill(); g.stroke(); });
  const d = g.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H); for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4]; return { mask, ids };
}
function recolorParts(img, M, skin, cols) { // cols: {Shirt:[r,g,b], Pants:[...], Coat:[...]} (missing = keep)
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, w, h), p = d.data, byId = {};
  for (const [k, id] of Object.entries(M.ids)) byId[id] = k;
  for (let i = 0, px = 0; i < p.length; i += 4, px++) {
    const part = byId[M.mask[px]], r = p[i], gg = p[i + 1], b = p[i + 2], L = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
    if (isSkin(r, gg, b) && (!part || part === 'Body')) { p[i] = r * skin[0] * 1.25; p[i + 1] = gg * skin[1] * 1.3; p[i + 2] = b * skin[2] * 1.35; continue; }
    const col = part && cols[part]; if (!col) continue;
    const k = col[0] + col[1] + col[2] > 2.6 ? 0.9 + L * 0.12 : L > 0.5 ? 0.2 + L * 0.85 : 0.8 + L * 1.1; // whites stay white, not grey
    p[i] = clamp(col[0] * 255 * k, 0, 255); p[i + 1] = clamp(col[1] * 255 * k, 0, 255); p[i + 2] = clamp(col[2] * 255 * k, 0, 255);
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t;
}
// Find which texels belong to the shins (below the shorts) and the feet, using each vertex's height in the rest pose.
function legMask(root, W, H) {
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse(m => { if (m.isSkinnedMesh && !/hair|lash/i.test(m.material.name + m.name)) meshes.push(m); });
  let y0 = Infinity, y1 = -Infinity; const v = new THREE.Vector3(), Y = new Map();
  for (const m of meshes) { const n = m.geometry.attributes.position.count, ys = new Float32Array(n); for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); ys[i] = v.y; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; } Y.set(m, ys); }
  const h = y1 - y0, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  for (const m of meshes) {
    const ys = Y.get(m), uv = m.geometry.attributes.uv, ix = m.geometry.index; if (!uv) continue; const cnt = ix ? ix.count : uv.count;
    for (const [lo, hi, col] of [[0.075, 0.355, 'rgb(1,0,0)'], [-1, 0.06, 'rgb(2,0,0)']]) {
      g.fillStyle = g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
      for (let t = 0; t < cnt; t += 3) { let ok = true; for (let k = 0; k < 3; k++) { const q = ix ? ix.getX(t + k) : t + k, rel = (ys[q] - y0) / h; if (rel < lo || rel > hi) { ok = false; break; } } if (!ok) continue;
        for (let k = 0; k < 3; k++) { const q = ix ? ix.getX(t + k) : t + k, x = uv.getX(q) * W, y = uv.getY(q) * H; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
      g.fill(); g.stroke();
    }
  }
  const d = g.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H); for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4]; return mask;
}
function applyShorts(tex, mask, skin, shoesOnly = false) { // shins become skin, feet become white canvas shoes
  const c = tex.image, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const base = tex.userData.skin || [205 * skin[0] * 1.25, 150 * skin[1] * 1.3, 118 * skin[2] * 1.35];
  for (let i = 0, px = 0; i < p.length; i += 4, px++) {
    const m = mask[px]; if (!m) continue; const L = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
    if (m === 1 && !shoesOnly && !isSkin(p[i], p[i + 1], p[i + 2])) { const k = 0.94 + (L - 0.85) * 0.35; p[i] = base[0] * k; p[i + 1] = base[1] * k; p[i + 2] = base[2] * k; }
    else if (m === 2) { const k = 0.82 + L * 0.2; p[i] = 245 * k; p[i + 1] = 245 * k; p[i + 2] = 240 * k; }
  }
  g.putImageData(d, 0, 0); tex.needsUpdate = true; return tex;
}
// Retarget Mixamo clips between rigs with different rest poses: bake world-space deltas.
function retarget(clip, srcRoot, dstRoot, fps = 30) {
  const san = n => THREE.PropertyBinding.sanitizeNodeName(n).replace(/^mixamorig\d+/, 'mixamorig');
  const src = {}, dstList = [];
  srcRoot.traverse(o => { if (/mixamorig/.test(o.name)) src[san(o.name)] = o; });
  dstRoot.traverse(o => { if (/mixamorig/.test(o.name) && src[san(o.name)]) dstList.push(o); }); // parents first
  const srcRestQ = new Map(); srcRoot.traverse(o => srcRestQ.set(o, [o.quaternion.clone(), o.position.clone()]));
  srcRoot.updateMatrixWorld(true); dstRoot.updateMatrixWorld(true);
  const Gs = new Map(), Gd = new Map(), restLocal = new Map();
  for (const d of dstList) { Gd.set(d, d.getWorldQuaternion(new THREE.Quaternion())); Gs.set(d, src[san(d.name)].getWorldQuaternion(new THREE.Quaternion())); restLocal.set(d, d.quaternion.clone()); }
  const parentRest = new Map(); for (const d of dstList) parentRest.set(d, d.parent.getWorldQuaternion(new THREE.Quaternion()));
  const mixer = new THREE.AnimationMixer(srcRoot); const act = mixer.clipAction(clip); act.play();
  const n = Math.max(2, Math.round(clip.duration * fps) + 1), times = new Float32Array(n), vals = new Map(dstList.map(d => [d, new Float32Array(n * 4)]));
  const Ws = new THREE.Quaternion(), Wd = new THREE.Quaternion(), loc = new THREE.Quaternion(), cur = new Map();
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, i / fps); times[i] = t; mixer.setTime(t); srcRoot.updateMatrixWorld(true); cur.clear();
    for (const d of dstList) {
      src[san(d.name)].getWorldQuaternion(Ws);
      Wd.copy(Ws).multiply(Gs.get(d).clone().invert()).multiply(Gd.get(d));
      const pw = cur.get(d.parent) || parentRest.get(d);
      loc.copy(pw).invert().multiply(Wd); cur.set(d, Wd.clone()); loc.toArray(vals.get(d), i * 4);
    }
  }
  act.stop(); mixer.uncacheRoot(srcRoot); for (const [o, [q, p]] of srcRestQ) { o.quaternion.copy(q); o.position.copy(p); } srcRoot.updateMatrixWorld(true);
  const tracks = dstList.map(d => new THREE.QuaternionKeyframeTrack(THREE.PropertyBinding.sanitizeNodeName(d.name) + '.quaternion', times, vals.get(d)));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

const RIGS = {}; // name -> {scene, clips, height}
const people = []; // {o, mixer, acts, state, ...}
function makePerson(rig, opts = {}) {
  const R = RIGS[rig];
  const o = SkeletonUtils.clone(R.scene);
  o.traverse(m => {
    if (m.isMesh) {
      m.castShadow = !(TOUCH && opts.npc !== false && rig !== 'player'); m.receiveShadow = !TOUCH; m.frustumCulled = true;
      if (m.name === 'vanguard_visor') m.visible = false;
      if (/hair/i.test(m.material.name || '')) { if (!m.material.userData.fixed) { m.material.transparent = false; m.material.alphaTest = 0.45; m.material.depthWrite = true; m.material.side = THREE.DoubleSide; m.material.color.set(0x2a211b); m.material.userData.fixed = 1; } }
      else if (opts.parts) { const k = (m.name.match(/_([A-Za-z]+)$/) || [])[1]; if (k && opts.parts.hide && opts.parts.hide.includes(k)) m.visible = false; else if (opts.parts.tex && m.material.map) { m.material = m.material.clone(); m.material.map = opts.parts.tex; } }
      else if (opts.tex && m.material.map) { m.material = m.material.clone(); m.material.map = opts.tex; }
      if (m.material.name && /Joints/.test(m.material.name) && opts.joint) { m.material = m.material.clone(); m.material.color.set(opts.joint); }
      if (m.material.name && /Beta_HighLimbs|HighLimbs/.test(m.material.name) && opts.body) { m.material = m.material.clone(); m.material.color.set(opts.body); }
    }
  });
  const s = (opts.h || 1.75) / R.height; o.scale.setScalar(s);
  const mixer = new THREE.AnimationMixer(o), acts = {};
  for (const [k, c] of Object.entries(R.clips)) acts[k] = mixer.clipAction(c);
  const meshes = []; o.traverse(m => { if (m.isMesh) meshes.push(m); });
  const p = { o, mixer, acts, cur: null, rig, meshes, sh: true };
  play(p, opts.anim || 'idle', 0);
  scene.add(o); return p;
}
function play(p, name, fade = 0.25) {
  const a = p.acts[name] || p.acts.idle; if (!a || p.cur === a) return;
  a.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (p.cur) p.cur.fadeOut(fade); p.cur = a;
  if (name === 'walk') a.timeScale = p.walkScale || 1;
}

const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ---------------- character creator ---------------- */
const BACKGROUNDS = [ // id, label, blurb, starting state
  ['allowance', 'Allowance-only', 'You and the ₦77k alert. No plan B.', { cash: 12450 }],
  ['family', 'Family-supported', 'Mummy sends "something small" when you least expect it.', { cash: 40000, stress: 10 }],
  ['struggling', 'Struggling', 'You borrowed transport fare to reach camp.', { cash: 3500, stress: 32 }],
  ['car', 'Car owner', 'Your Corolla is parked outside. Fuel is not free.', { cash: 22000 }],
  ['hustler', 'Side-hustler', 'POS and data business on the side. Alerts come in small small.', { cash: 15000 }],
];
const CH = { g: 'm', tone: 1, bg: 'allowance', name: '' };
const PTEX = {};
function playerTex(g, kind, tone) { const k = `${g}_${kind}_${tone}`; return PTEX[k] || (PTEX[k] = new THREE.TextureLoader().loadAsync(`models/tex/player/${k}.jpg`).then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, ANISO); return t; })); }
/* ---------------- game state ---------------- */
const ST = { cash: 12450, energy: 82, stress: 18, mins: 7 * 60 + 42, obj: 'Show your call-up letter at the camp gate', phase: 0, queue: 0, riding: null, done: false, area: 'camp', cstep: 0, day: 1, rep: 0, seg: 'Morning', target: null };
let player, hud = {};
const keys = {};
const cam = { yaw: -Math.PI * 0.5, pitch: 0.32, dist: 6.5, tdist: 6.5 };
const pv = new THREE.Vector3();
const NPC = [];
function toast(t, ms = 2600) { try { speakToast(t); } catch (e) { } const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', ms); }
function setObj(t) { ST.obj = t; $('objt').textContent = t; }
function hudSync() {
  if (PH.cash === null) PH.cash = ST.cash; else if (ST.cash !== PH.cash) { const d = ST.cash - PH.cash; PH.ledger.unshift({ d, label: ST.txn || (d > 0 ? 'Transfer received' : 'POS / cash payment'), t: ($('dayn').textContent || '') + ' · ' + ($('clock').textContent || '') }); ST.txn = null; PH.cash = ST.cash; if (PH.screen === 'bank' && $('phone').classList.contains('on')) renderBank(); }
  if (PH.screen === 'home' && $('phone').classList.contains('on') && !(hudSync.n = (hudSync.n || 0) + 1) % 30) homeWidgets();
  { const hc = $('phclock'); if (hc) { hc.textContent = $('pclock').textContent; $('phdate').textContent = $('dayn').textContent + ' · ' + (ST.area === 'camp' ? SNAME() + ' camp' : LGN() + ', ' + SNAME()); } }
  $('cash').textContent = naira(ST.cash);
  const h = Math.floor(ST.mins / 60), m = Math.floor(ST.mins % 60), ap = h >= 12 ? 'PM' : 'AM', hh = ((h + 11) % 12) + 1;
  $('clock').textContent = `${hh}:${String(m).padStart(2, '0')} ${ap}`; $('pclock').textContent = `${hh}:${String(m).padStart(2, '0')}`;
  $('dayn').textContent = ST.area === 'camp' ? 'Camp day ' + (ST.day || 1) : ST.ch === 3 ? ({ Mon: 'Monday', Thu: 'Thursday', Sat: 'Saturday', Clr: 'Clearance day', Pop: 'POP day' }[Y.kind] + ' · Month ' + Y.month) : (ST.ch === 2 ? (ST.seg === 'Evening' ? 'Wednesday' : 'Thursday') : 'Monday'); $('nrg').textContent = '⚡ ' + Math.round(ST.energy); $('strs').textContent = '😤 ' + Math.round(ST.stress);
}

/* ---------------- phone / Corper Connect ---------------- */
const CHAT = [];
const PH = { screen: 'home', thread: null, threads: new Map(), ledger: [], cash: null, acts: [], seq: 0 };
function thr(name, kind = 'group') { let t = PH.threads.get(name); if (!t) { t = { name, kind, msgs: [], unread: 0, last: 0 }; PH.threads.set(name, t); } return t; }
function setGroup(name) { ST.group = name; thr(name); PH.thread = name; renderThread(); if ($('phone').classList.contains('on')) phShow(PH.screen); }
function msgHTML(m) { return `<div class="m ${m.kind}"><b>${m.from}</b>${m.text}</div>`; }
function renderThread() { const el = $('msgs'); el.innerHTML = thr(PH.thread || ST.group || 'Platoon 5 · Camp Gist').msgs.map(msgHTML).join(''); el.scrollTop = 1e6; }
function badge() { let n = 0; for (const t of PH.threads.values()) n += t.unread; const b = $('bdg'); b.hidden = !n; b.textContent = n > 9 ? '9+' : n; const hb = $('hbdg'); if (hb) { hb.hidden = !n; hb.textContent = b.textContent; } }
function chat(from, text, kind = '', to) {
  const g = ST.group || 'Platoon 5 · Camp Gist', auto = /^Naija Trust Bank/.test(from) ? ['Naija Trust Bank', 'sms'] : /^Mummy/.test(from) ? [from, 'dm'] : null;
  const name = to || (auto ? auto[0] : from === 'You' ? (PH.thread || g) : g), t = thr(name, to ? 'dm' : auto ? auto[1] : 'group');
  const m = { from, text, kind }; t.msgs.push(m); t.last = ++PH.seq; CHAT.push(m);
  if ((PH.thread || g) === name) { const el = $('msgs'); el.insertAdjacentHTML('beforeend', msgHTML(m)); el.scrollTop = 1e6; }
  const open = $('phone').classList.contains('on') && PH.screen === 'thread' && PH.thread === name;
  if (!open && from !== 'You' && $('phone').classList.contains('on')) island(t.kind === 'sms' ? '🏦' : t.kind === 'dm' ? '🙂' : '💬', name, `<b style="display:inline">${from}:</b> ${text.replace(/<img[^>]*>/g, '📷 Photo')}`);
  if (!open && from !== 'You') {
    t.unread++; badge(); $('nsrc').textContent = (t.kind === 'sms' ? 'SMS · ' : 'CORPER CONNECT · ') + name; $('ntext').innerHTML = `<b>${from}:</b> ${text}`; const n = $('notif'); n.dataset.thread = name; n.classList.add('on'); clearTimeout(chat.t); chat.t = setTimeout(() => n.classList.remove('on'), 4200); beep();
  }
  if (PH.screen === 'chats') renderChats();
}
function openThread(name, kind) { thr(name, kind); PH.thread = name; if (!$('phone').classList.contains('on')) phone(true); phShow('thread'); }
function renderChats() {
  const ts = [...PH.threads.values()].sort((a, b) => b.last - a.last);
  $('pchats').innerHTML = ts.map(t => { const l = t.msgs[t.msgs.length - 1]; return `<button data-n="${t.name.replace(/"/g, '&quot;')}"><i>${t.kind === 'sms' ? '🏦' : t.kind === 'dm' ? '🙂' : '👥'}</i><div><b>${t.name}</b><span>${l ? (l.from === 'You' ? 'You: ' : t.kind === 'group' ? l.from + ': ' : '') + l.text.replace(/<[^>]+>/g, '') : 'No messages yet'}</span></div>${t.unread ? `<em>${t.unread}</em>` : ''}</button>`; }).join('') || '<p>No chats yet.</p>';
  for (const b of $('pchats').querySelectorAll('button')) b.onclick = () => { PH.thread = b.dataset.n; phShow('thread'); };
}
function renderBank() {
  const acct = '30' + String(10000000 + ((ST.name || 'corper').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 89999999)).slice(0, 8);
  $('pbank').innerHTML = `<div class="bal"><small>NAIJA TRUST BANK · SAVINGS</small><b>${naira(ST.cash)}</b><span>${(ST.name || 'Corps Member').toUpperCase()} · ${acct}</span></div>
  <div class="bacts"><button id="bsend">💸 Send ${naira(5000)} home</button><button id="bdata">📶 Buy data ${naira(1000)}</button></div>
  <h4>Recent transactions</h4><ul>${PH.ledger.slice(0, 30).map(l => `<li><div><b>${l.label}</b><small>${l.t}</small></div><span class="${l.d > 0 ? 'cr' : 'dr'}">${l.d > 0 ? '+' : '−'}${naira(Math.abs(l.d))}</span></li>`).join('') || '<li><div><b>No transactions yet</b><small>Your alert never comes when you need it.</small></div></li>'}</ul>`;
  $('bsend').onclick = () => { if (ST.cash < 5000) return toast('Insufficient funds. The app is laughing at you.'); ST.txn = 'Transfer to MUMMY'; ST.cash -= 5000; ST.rep += 1; ST.stress = clamp(ST.stress - 4, 0, 100); ST.sentHome = (ST.sentHome || 0) + 1; hudSync(); setTimeout(() => chat('Mummy ❤️', pick(['I have seen the alert. God will bless you my child 🙏🏾', 'Ah! My own corper! Thank you. Have you eaten?', 'Thank you my dear. Your daddy says well done.'])), 2200); };
  $('bdata').onclick = () => { if (ST.cash < 1000) return toast('Insufficient funds. Even data is doing shakara.'); ST.txn = 'Airtime & data'; ST.cash -= 1000; ST.stress = clamp(ST.stress - 1, 0, 100); hudSync(); toast('3GB added. It will finish before Friday.', 2600); };
}
function renderID() {
  const bgl = (BACKGROUNDS.find(b => b[0] === ST.bg) || [0, 'Allowance-only'])[1], bar = (v, c) => `<div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div>`;
  $('pid').innerHTML = `<div class="idc"><small>CORPS MEMBER · FICTIONAL ID</small><b>${ST.name || 'Corper'}</b><span>${ST.code || 'State code: not yet registered'}</span></div>
  <dl>${ST.ch === 3 ? `<div><dt>Service</dt><dd>Month ${Y.month} of ${Y.MONTHS} · ${{ Mon: 'PPA day', Thu: 'CDS day', Sat: 'Free day', Clr: 'Clearance', Pop: 'POP' }[Y.kind]}</dd></div><div><dt>Attendance</dt><dd>PPA ${Y.ppaDays}/${Y.ppaDays + Y.ppaMiss} · CDS ${Y.cdsDays}/${Y.cdsDays + Y.cdsMiss}</dd></div>` : ''}<div><dt>Platoon</dt><dd>${ST.code ? '5' : '—'}</dd></div><div><dt>Posting</dt><dd>${ST.post ? ST.post.lga + ', ' + ST.post.state : '—'}</dd></div><div><dt>PPA</dt><dd>${ST.post ? ST.post.ppa : '—'}</dd></div><div><dt>Background</dt><dd>${bgl}</dd></div><div><dt>Reputation</dt><dd>${ST.rep}</dd></div></dl>
  <label>Energy ${Math.round(ST.energy)}</label>${bar(ST.energy, '#1a9d52')}<label>Stress ${Math.round(ST.stress)}</label>${bar(ST.stress, '#d93025')}
  <div class="vibe"><small>YOUR VIBE SO FAR</small><b>${corperType()[0]}</b></div>`;
}
const SCREENS = { // id → [element, title, light status bar?, dark header?]
  home: ['phome'], chats: ['pchats', 'Corper Connect', 1], thread: ['msgs', null, 1], map: ['pmap', null, 1], bank: ['pbank', 'Naija Trust Bank', 1], id: ['pid', 'My NYSC', 1],
  music: ['pmusic', 'Music', 0, 1], weather: ['pweather', 'Weather', 0, 1], cal: ['pcal', 'Calendar', 1], photos: ['pphotos', 'Photos', 1], settings: ['psettings', 'Settings', 1], whot: ['pgame', 'Whot!', 0, 1], dash: ['pgame', 'Danfo Dash', 0, 1],
};
let gameStop = null;
function phShow(s) {
  if (s === 'camera') return snapPhoto();
  const prevGame = PH.screen === 'whot' || PH.screen === 'dash';
  if (prevGame && gameStop && s !== PH.screen) { gameStop(); gameStop = null; }
  PH.screen = s; const g = ST.group || 'Platoon 5 · Camp Gist'; if (!PH.thread) PH.thread = g;
  for (const [k, v] of Object.entries(SCREENS)) $(v[0]).hidden = true;
  $(SCREENS[s][0]).hidden = false;
  $('pacts').hidden = s !== 'thread' || PH.thread !== g || !PH.acts.length;
  const sc = $('pscr'); sc.dataset.s = s; sc.dataset.light = SCREENS[s][2] ? '1' : ''; sc.dataset.dark = SCREENS[s][3] ? '1' : '';
  $('pback').hidden = s === 'home'; $('pmapbtn').textContent = s === 'map' ? '💬' : '🗺️'; $('pmapbtn').hidden = !['chats', 'thread', 'map', 'home'].includes(s);
  $('phdr').textContent = SCREENS[s][1] || { thread: (thr(PH.thread).kind === 'sms' ? '✉️ ' : '') + PH.thread, map: 'Maps · ' + (ST.area === 'camp' ? SNAME() + ' camp' : LGN()) }[s] || '';
  if (s === 'thread') { thr(PH.thread).unread = 0; badge(); renderThread(); }
  if (s === 'chats') renderChats(); if (s === 'bank') renderBank(); if (s === 'id') renderID();
  if (s === 'map') { MAPV.follow = true; MAPV.R = ST.area === 'camp' ? 62 : 70; MAPV.sel = null; $('pmapsheet').hidden = true; mapList(); mapT = 0; }
  if (s === 'music') renderMusic(); if (s === 'weather') renderWeather(); if (s === 'cal') renderCal(); if (s === 'photos') renderPhotos(); if (s === 'settings') renderSettings();
  if (s === 'whot' || s === 'dash') { const el = $('pgame'); el.innerHTML = ''; ST.phoneGame = true; gameStop = (s === 'whot' ? mountWhot : mountDash)(el, { onEnd: r => { ST.stress = clamp(ST.stress - (r.win ? 5 : 2), 0, 100); ST.mins += 10; ST.gamesWon = (ST.gamesWon || 0) + (r.win ? 1 : 0); if (r.win && r.label === 'Whot') chat('Emeka', pick(['Corper, you don learn this Whot from where? Rematch tomorrow 😤', 'I let you win sha 😂']), '', 'Emeka'); hudSync(); } }); }
  else ST.phoneGame = false;
}
/* ---- the island: message previews while the phone is open ---- */
let islT = 0;
function island(icon, title, body) { const I = $('pisland'); $('pisi').textContent = icon; $('pist').textContent = title; $('pisb').innerHTML = body; I.classList.add('big'); clearTimeout(islT); islT = setTimeout(() => I.classList.remove('big'), 3400); }
$('pisland').onclick = () => { const n = $('notif').dataset.thread; if (n && PH.threads.has(n)) { PH.thread = n; phShow('thread'); } $('pisland').classList.remove('big'); };
/* ---- camera + photos ---- */
PH.photos = [];
function snapPhoto() {
  phone(false);
  setTimeout(() => { // the phone slides away, then: click
    try { renderer.render(scene, camera); const src = renderer.domElement, c = document.createElement('canvas'), k = 540 / Math.max(src.width, src.height); c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      PH.photos.unshift({ src: c.toDataURL('image/jpeg', 0.82), at: $('clock').textContent + ' · ' + (ST.area === 'camp' ? SNAME() + ' camp' : LGN()) }); if (PH.photos.length > 18) PH.photos.pop(); } catch (e) { toast('The camera app crashed. Typical.'); return; }
    const fl = $('fade'); fl.style.transition = 'none'; fl.style.background = '#fff'; fl.style.opacity = .85; tone(1800, .03, 'square', .04);
    setTimeout(() => { fl.style.transition = 'opacity .35s'; fl.style.opacity = 0; setTimeout(() => { fl.style.background = ''; }, 400); }, 60);
    toast('📸 Saved to Photos', 1800); ST.photos = (ST.photos || 0) + 1;
    setTimeout(() => { phone(true); phShow('photos'); }, 700);
  }, 420);
}
function renderPhotos(i) {
  const el = $('pphotos');
  if (i != null && PH.photos[i]) { const ph = PH.photos[i]; el.innerHTML = `<div class="view"><img src="${ph.src}" alt="Photo taken ${esc(ph.at)}"><small>${esc(ph.at)}</small><button id="pshare">Share to ${esc(ST.group || 'the group')}</button><button class="sec" id="pgrid">All photos</button></div>`;
    $('pshare').onclick = () => { const g = ST.group || 'Platoon 5 · Camp Gist'; chat('You', `<img src="${ph.src}" alt="photo">`, 'me', g); ST.rep += 1; PH.thread = g; setTimeout(() => chat(pick(['Bisi', 'Tolu', 'Seyi', 'Emeka']), pick(['Omo, see as you fresh! 🔥', 'Who snap this one? Clean!', 'Corper of the year 😂', 'Send me the original abeg'])), 1500); phShow('thread'); };
    $('pgrid').onclick = () => renderPhotos(); return; }
  el.innerHTML = PH.photos.length ? `<div class="g">${PH.photos.map((p, k) => `<button data-i="${k}" style="background-image:url('${p.src}')" aria-label="Photo ${k + 1}"></button>`).join('')}</div>` : '<p>No photos yet.<br>Open Camera to snap the moment: parade, mammy market, your khaki.</p>';
  el.querySelectorAll('.g button').forEach(b => b.onclick = () => renderPhotos(+b.dataset.i));
}
/* ---- music ---- */
const TRACKS = [['Afrobeat Groove', 'FreeMusicForVideo', 'audio/afrobeat1.mp3'], ['Afro Beat Vibes', 'PlayStarz_Music', 'audio/afrobeat2.mp3'], ['Afrobeat', 'Kiravale', 'audio/afrobeat3.mp3']];
const PM = { el: null, i: 0 };
function renderMusic() {
  const el = $('pmusic'), t = TRACKS[PM.i], playing = PM.el && !PM.el.paused;
  el.innerHTML = `<div class="art" aria-hidden="true">🎧</div><h3>${t[0]}</h3><p>${t[1]} · Pixabay</p><div class="bar"><i id="pmbar"></i></div><div class="ctl"><button id="pmprev" aria-label="Previous">⏮</button><button class="pp" id="pmpp" aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '❚❚' : '▶'}</button><button id="pmnext" aria-label="Next">⏭</button></div><ul>${TRACKS.map((x, k) => `<li><button data-i="${k}" class="${k === PM.i ? 'on' : ''}"><span>${x[0]}</span><span>${x[1]}</span></button></li>`).join('')}</ul>`;
  const go = k => { PM.i = (k + TRACKS.length) % TRACKS.length; if (!PM.el) { PM.el = new Audio(); PM.el.addEventListener('ended', () => go(PM.i + 1)); PM.el.addEventListener('timeupdate', () => { const b = $('pmbar'); if (b && PM.el.duration) b.style.width = (PM.el.currentTime / PM.el.duration * 100) + '%'; }); } PM.el.src = TRACKS[PM.i][2]; PM.el.volume = 0.7; PM.el.play().catch(() => { }); renderMusic(); };
  $('pmpp').onclick = () => { if (!PM.el) return go(PM.i); if (PM.el.paused) PM.el.play().catch(() => { }); else PM.el.pause(); renderMusic(); };
  $('pmprev').onclick = () => go(PM.i - 1); $('pmnext').onclick = () => go(PM.i + 1);
  el.querySelectorAll('li button').forEach(b => b.onclick = () => go(+b.dataset.i));
}
/* ---- weather: your state's climate, your time of day ---- */
function wxNow() {
  const cl = ST.state ? STATE().climate : 'humid', seg = ST.seg || 'Morning', night = seg === 'Night', hr = Math.floor((ST.mins || 480) / 60) % 24;
  const B = { harmattan: [34, 17, 'Hazy · Harmattan dust', '🌫️'], cool: [23, 13, 'Breezy and cool', '🌤️'], humid: [31, 24, 'Partly cloudy · 60% rain later', '⛅'], riverine: [30, 24, 'Showers on and off', '🌦️'], savanna: [33, 21, 'Sunny', '☀️'] }[cl] || [31, 23, 'Partly cloudy', '⛅'];
  const t = Math.round(night ? B[1] + 2 : seg === 'Morning' ? (B[0] + B[1]) / 2 : seg === 'Evening' ? B[0] - 3 : B[0]);
  return { cl, t, hi: B[0], lo: B[1], cond: night ? (cl === 'harmattan' ? 'Cold harmattan night' : 'Clear night') : B[2], ic: night ? '🌙' : B[3], hr, city: ST.post ? LGN() : STATE().capital };
}
function renderWeather() {
  const w = wxNow(), el = $('pweather'); el.className = 'papp' + (ST.seg === 'Night' ? ' night' : w.cl === 'harmattan' ? ' harm' : w.cl === 'cool' ? ' cool' : '');
  const hrs = [0, 2, 4, 6, 8].map(d => { const h = (w.hr + d) % 24; const nt = h < 6 || h >= 19; return `<div>${d ? (h % 12 || 12) + (h < 12 ? 'AM' : 'PM') : 'Now'}<i>${nt ? '🌙' : w.ic}</i>${Math.round(nt ? w.lo + 1 : w.t + (d && d < 6 ? 1 : 0))}°</div>`; }).join('');
  el.innerHTML = `<h2>${esc(w.city)}</h2><div class="t">${w.t}°</div><p>${w.cond}</p><p>H:${w.hi}°  L:${w.lo}°</p><div class="card"><small>Next hours</small><div class="hrs">${hrs}</div></div><div class="card"><small>${STATE().name} · ${ZN().name}</small>${{ harmattan: 'Dry, dusty wind from the Sahara. Cracked lips, cold nights, Vaseline everywhere.', cool: 'Highland weather. Mornings are cold enough for a sweater.', humid: 'Humid coastal air. Your khaki will be wet by 10 AM.', riverine: 'Creeks and rain. Some roads are boats.', savanna: 'Hot, open savanna. Keep pure water close.' }[w.cl] || ''}</div>`;
}
/* ---- calendar: this month, with your service duties on it ---- */
function renderCal() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = now.getDate();
  let lastFri = days; while (new Date(y, m, lastFri).getDay() !== 5) lastFri--;
  const cells = []; for (let i = 0; i < first; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) { const wd = new Date(y, m, d).getDay(); const dot = wd === 4 ? '#6a1b9a' : d === lastFri ? '#1565c0' : wd === 1 ? '#2e7d32' : null; cells.push(`<span class="${d === today ? 'today' : ''}">${d}${dot && d !== today ? `<i style="background:${dot}"></i>` : ''}</span>`); }
  $('pcal').innerHTML = `<h3>${now.toLocaleString('en-NG', { month: 'long' })} ${y}</h3><div class="g">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<b>${d}</b>`).join('')}${cells.join('')}</div>
  <ul><li><i style="background:#2e7d32"></i>Mondays · PPA, sign in before 8:00</li><li><i style="background:#6a1b9a"></i>Thursdays · CDS, register closes 10:00</li><li><i style="background:#1565c0"></i>${lastFri} ${now.toLocaleString('en-NG', { month: 'short' })} · Monthly clearance at the ${ST.post ? esc(LGN()) + ' ' : ''}LGA Secretariat</li>${Y.on ? `<li><i style="background:#ff3b30"></i>Service month ${Y.month} of ${Y.MONTHS} · POP after month ${Y.MONTHS}</li>` : ''}</ul>`;
}
/* ---- settings ---- */
function renderSettings() {
  const W = $('phone').dataset.wall || 'naija';
  $('psettings').innerHTML = `<h4>Wallpaper</h4><div class="walls">${[['naija', 'linear-gradient(165deg,#2fbf71,#0a3f27)'], ['lagoon', 'linear-gradient(165deg,#3bc9db,#13315c)'], ['sunset', 'linear-gradient(165deg,#ff8a3d,#5a1a3a)']].map(([k, bg]) => `<button data-w="${k}" class="${k === W ? 'on' : ''}" style="background:${bg}" aria-label="${k} wallpaper"></button>`).join('')}</div>
  <h4>General</h4><div class="grp"><button id="psnd"><span>Sound</span><span>${MUTED ? 'Off' : 'On'}</span></button><div><span>Phone</span><span>NaijaPhone 16 · 5G</span></div><div><span>Owner</span><span>${esc(ST.name || 'Corper')}</span></div><div><span>State of deployment</span><span>${STATE().name}</span></div></div>
  <h4>About</h4><div class="grp"><div><span>NYSC Survival</span><span>Fictional game</span></div></div>`;
  $('psettings').querySelectorAll('.walls button').forEach(b => b.onclick = () => { $('phone').dataset.wall = b.dataset.w; try { localStorage.setItem('nysc3d.wall', b.dataset.w); } catch (e) { } renderSettings(); });
  $('psnd').onclick = () => { $('bmute').click(); renderSettings(); };
}
try { const w = localStorage.getItem('nysc3d.wall'); if (w) $('phone').dataset.wall = w; } catch (e) { }
/* ---- home-screen widgets ---- */
function homeWidgets() {
  const w = wxNow(); $('wgcity').textContent = '📍 ' + w.city; $('wgtemp').textContent = w.t + '°'; $('wgcond').textContent = w.ic + ' ' + w.cond; $('wghl').textContent = `H:${w.hi}°  L:${w.lo}°`;
  const sv = ST.area === 'camp' ? ['Camp', 'Next: ' + (ST.cstep < 3 ? 'Registration' : ST.cstep < 6 ? 'Parade & drill' : 'Posting'), 8] : Y.on ? ['Month ' + Y.month, Y.kind === 'Mon' ? 'Today: PPA' : Y.kind === 'Thu' ? 'Today: CDS' : Y.kind === 'Clr' ? 'Today: Clearance' : Y.kind === 'Pop' ? 'Today: POP 🎓' : 'Free Saturday', 20 + Y.month * 25] : [ST.ch === 2 ? 'CDS week' : 'Chapter 1', ST.ch === 2 ? 'Next: Thursday CDS' : 'Next: Clearance', ST.ch === 2 ? 16 : 12];
  $('wgsv').textContent = sv[0]; $('wgnext').textContent = sv[1]; $('wgring').style.width = Math.min(100, sv[2]) + '%';
  const d = new Date(); $('calw').textContent = d.toLocaleString('en-NG', { weekday: 'short' }).toUpperCase(); $('cald').textContent = d.getDate();
  const n = [...PH.threads.values()].reduce((a, t) => a + t.unread, 0); for (const e of document.querySelectorAll('.dbdg')) { e.hidden = !n; e.textContent = n > 9 ? '9+' : n; }
}
function phone(on) {
  if (on) ST.phoneOpens = (ST.phoneOpens || 0) + 1; $('phone').classList.toggle('on', on); $('notif').classList.remove('on');
  const g = ST.group || 'Platoon 5 · Camp Gist';
  if (on) homeWidgets();
  if (!on && (PH.screen === 'whot' || PH.screen === 'dash')) { if (gameStop) { gameStop(); gameStop = null; } PH.screen = 'home'; ST.phoneGame = false; }
  if (on) { let s = PH.screen; if (s === 'home' || s === 'thread') { const u = thr(g).unread ? thr(g) : [...PH.threads.values()].filter(t => t.unread).sort((a, b) => b.last - a.last)[0]; if (u) { PH.thread = u.name; s = 'thread'; } else s = 'home'; } phShow(s); }
  else { if (PH.screen === 'thread') PH.screen = 'home'; PH.thread = g; renderThread(); }
  if (on && ST.phase === 0 && ST.area === 'street') { ST.phase = 1; setObj('Get to the LGA Secretariat for clearance'); ST.target = { x: LGA.x, z: LGA.z, label: 'LGA Secretariat' }; $('arrow').style.display = 'block'; }
}
$('pback').onclick = () => phShow(PH.screen === 'thread' ? 'chats' : 'home'); $('phomebar').onclick = () => phShow('home');
for (const b of $('phome').querySelectorAll('[data-app]')) b.onclick = () => phShow(b.dataset.app);
$('bphone').onclick = () => phone(!$('phone').classList.contains('on'));
$('pclose').onclick = () => phone(false);
$('notif').onclick = () => { const n = $('notif').dataset.thread; if (n && PH.threads.has(n)) openThread(n); else phone(true); };
function phoneActs(list) { PH.acts = list; $('pacts').hidden = PH.screen !== 'thread' || PH.thread !== (ST.group || 'Platoon 5 · Camp Gist') || !list.length; $('pacts').innerHTML = list.map((a, i) => `<button data-i="${i}">${a[0]}</button>`).join(''); [...$('pacts').children].forEach((b, i) => b.onclick = () => { list[i][1](); }); }
phoneActs([['Who has confirmed?', () => { chat('You', 'Who has confirmed? 👀', 'me'); setTimeout(() => chat('Chioma (CDS Sec)', 'I am at the Secretariat now. Queue is long o. Come with your ID card.'), 1600); phoneActs([]); }],
  ['🙏🏾 Thanks', () => { chat('You', 'Thank you 🙏🏾', 'me'); phoneActs([]); }]]);

/* ---------------- audio (tiny procedural) ---------------- */
/* ---------------- sound: ambience, original afrobeat groove, Nigerian-English voices ---------------- */
let AC = null, amb = null, MASTER = null, MUTED = false;
const SND = {};
function noiseBuf(sec = 2) { const n = AC.createBuffer(1, AC.sampleRate * sec, AC.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return n; }
function loopNoise(type, freq, q, gain) { const s = AC.createBufferSource(); s.buffer = SND.noise; s.loop = true; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.value = gain; s.connect(f).connect(g).connect(MASTER); s.start(); return g; }
function audio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  MASTER = AC.createGain(); MASTER.gain.value = MUTED ? 0 : 0.9; MASTER.connect(AC.destination);
  SND.noise = noiseBuf(2);
  amb = loopNoise('lowpass', 380, 0.7, 0.0);          // traffic rumble
  SND.crowd = loopNoise('bandpass', 650, 0.8, 0.0);    // murmur of people
  { const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 0.012; lfo.connect(lg).connect(SND.crowd.gain); lfo.start(); }
  { // crickets at night
    const o = AC.createOscillator(); o.frequency.value = 4300; const am = AC.createGain(); am.gain.value = 0; const p = AC.createOscillator(); p.type = 'square'; p.frequency.value = 18; const pg = AC.createGain(); pg.gain.value = 0.5; p.connect(pg).connect(am.gain); const g = AC.createGain(); g.gain.value = 0; o.connect(am).connect(g).connect(MASTER); o.start(); p.start(); SND.crick = g;
  }
  SND.music = AC.createGain(); SND.music.gain.value = 0; SND.music.connect(MASTER);
  SND.musicFX = AC.createBiquadFilter(); SND.musicFX.type = 'lowpass'; SND.musicFX.frequency.value = 9000; SND.musicFX.connect(SND.music);
  if (SND.tracks && SND.tracks.length) { // real afrobeat tracks (royalty-free, see credits), played as a rotating playlist
    const el = new Audio(); let i = (Math.random() * SND.tracks.length) | 0; el.src = SND.tracks[i]; el.preload = 'auto'; SND.track = el; AC.createMediaElementSource(el).connect(SND.musicFX);
    el.addEventListener('ended', () => { i = (i + 1) % SND.tracks.length; el.src = SND.tracks[i]; el.play().catch(() => { }); }); }
  SND.next = AC.currentTime + 0.1; SND.step = 0; setInterval(scheduleBeat, 25);
}
function env(node, t, a, peak, d) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(freq, dur, type = 'square', vol = 0.05, when = 0) { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq; const t = AC.currentTime + when; env(g, t, 0.005, vol, dur); o.connect(g).connect(MASTER); o.start(t); o.stop(t + dur + 0.05); }
function horn(dist = 10) { const v = clamp(0.09 - dist * 0.0018, 0.01, 0.09); tone(392, .35, 'square', v); tone(494, .35, 'square', v * .8); }
function beep() { tone(880, .09, 'sine', .07); tone(1320, .12, 'sine', .06, .1); }
function bugle() { if (!AC) return; const n = [392, 523, 659, 784, 659, 784, 1047]; n.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2400; const t = AC.currentTime + i * 0.24; env(g, t, 0.03, 0.06, i === n.length - 1 ? 0.9 : 0.2); o.connect(lp).connect(g).connect(MASTER); o.start(t); o.stop(t + 1.2); }); }
function whistle() { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(), v = AC.createOscillator(), vg = AC.createGain(); o.frequency.value = 2900; v.frequency.value = 28; vg.gain.value = 120; v.connect(vg).connect(o.frequency); const t = AC.currentTime; env(g, t, 0.01, 0.05, 0.35); o.connect(g).connect(MASTER); o.start(t); v.start(t); o.stop(t + .45); v.stop(t + .45); }
// --- an original afrobeats/amapiano-flavoured groove, 104 BPM, Am–F–C–G ---
const BPM = 104, S16 = 60 / BPM / 4;
const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], ROOTS = [55, 43.65, 65.41, 49];
function hit(t, f0, f1, dur, vol, type = 'sine') { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6); env(g, t, 0.002, vol, dur); o.connect(g).connect(SND.musicFX); o.start(t); o.stop(t + dur + 0.05); }
function nz(t, type, freq, vol, dur) { const s = AC.createBufferSource(); s.buffer = SND.noise; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = AC.createGain(); env(g, t, 0.001, vol, dur); s.connect(f).connect(g).connect(SND.musicFX); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
function pluck(t, f, vol) { for (const det of [-4, 4]) { const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25); env(g, t, 0.003, vol, 0.28); o.connect(lp).connect(g).connect(SND.musicFX); o.start(t); o.stop(t + 0.35); } }
function scheduleBeat() {
  if (!AC || SND.track) return;
  const audible = SND.music.gain.value > 0.002;
  while (SND.next < AC.currentTime + 0.12) {
    const st = SND.step % 16, bar = Math.floor(SND.step / 16) % 4, t = SND.next + (st % 2 ? 0.018 : 0);
    if (audible) {
      if (st === 0 || st === 6 || st === 10) hit(t, 150, 45, 0.32, 0.9);                     // kick
      if (st === 4 || st === 12) { nz(t, 'bandpass', 1600, 0.5, 0.13); nz(t + 0.012, 'bandpass', 1300, 0.25, 0.1); } // clap
      nz(t, 'highpass', 7500, [2, 6, 10, 14].includes(st) ? 0.16 : 0.06, 0.05);                // shaker
      if ([3, 7, 11, 14].includes(st)) hit(t, st === 14 ? 330 : 247, st === 14 ? 300 : 220, 0.16, 0.18); // conga
      if (st === 7 || st === 15) hit(t, ROOTS[bar] * 4, ROOTS[bar] * 2.4, 0.42, 0.42);             // log drum
      const r = ROOTS[bar], bassMap = { 0: r, 3: r, 6: r * 1.5, 10: r, 13: r * 2 }; if (bassMap[st]) hit(t, bassMap[st] * 2, bassMap[st] * 2, 0.22, 0.34, 'triangle');
      if ([2, 5, 8, 11, 14].includes(st)) { const ch = CHORDS[bar]; pluck(t, ch[[2, 5, 8, 11, 14].indexOf(st) % 3] * 2, 0.045); }
      if (st === 0) for (const f of CHORDS[bar]) pluck(t, f, 0.025);
    }
    SND.next += S16; SND.step++;
  }
}
function musicSource() { // where the music is coming from right now, and how loud it is at the source
  if (ST.area === 'camp' && ST.seg === 'Night') return { x: CAMP.spots.stage.x, z: CAMP.spots.stage.z - 3, vol: 0.55, range: 75 };
  if (ST.area === 'street') return { x: 46, z: 9.8, vol: 0.22, range: 32 }; // the buka speaker
  return null;
}
function updateAudio(dt) {
  if (!AC || !player) return;
  const P = player.o.position, k = Math.min(1, dt * 3), set = (g, v) => g.gain.value += (v - g.gain.value) * k;
  const night = ST.seg === 'Night';
  set(amb, ST.area === 'street' ? 0.06 : 0.012);
  set(SND.crowd, ST.area === 'street' ? 0.018 : night ? 0.01 : 0.026);
  set(SND.crick, ST.area === 'camp' && night ? 0.012 : 0);
  const m = musicSource(); let mv = 0;
  if (m) { const d = Math.hypot(P.x - m.x, P.z - m.z); mv = m.vol * Math.pow(clamp(1 - d / m.range, 0, 1), 1.6); SND.musicFX.frequency.value = 1200 + 9000 * clamp(1 - d / m.range, 0, 1); }
  set(SND.music, mv);
  if (SND.track) { if (mv > 0.003 && SND.track.paused) SND.track.play().catch(() => { }); else if (mv <= 0.003 && !SND.track.paused) SND.track.pause(); }
}
// --- voices: the browser's own speech engine, Nigerian English voice when the device has one ---
let VOICES = [];
function loadVoices() { try { VOICES = speechSynthesis.getVoices() || []; } catch (e) { } }
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const FEM = /female|ezinne|zira|samantha|susan|hazel|libby|sonia|karen|moira|tessa|fiona|veena|aria|jenny|natasha|clara|leah|imani|zuri|ada/i, MAL = /\bmale\b|abeo|david|george|ryan|daniel|alex|fred|thomas|guy|mark|james|chilemba|luke|william/i;
function pickVoice(f) {
  if (!VOICES.length) loadVoices();
  const en = VOICES.filter(v => /^en/i.test(v.lang)), ng = en.filter(v => /NG/i.test(v.lang)), pool = ng.length ? ng : en.filter(v => /(GB|ZA|KE|GH|IN|AU|IE)/i.test(v.lang)).concat(en);
  return pool.find(v => (f ? FEM : MAL).test(v.name)) || pool[0] || null;
}
const FEMALE_NAMES = /tolu|chioma|mama|aunty|nurse|mc spicy|bisi|ronke|chidinma|photographer|she/i;
// Recorded Nigerian voices (YarnGPT): voice/manifest.json lists line ids; voice/<id>.mp3 holds the audio.
const VOICE_IDS = new Set(); let voiceEl = null;
const VOICE_CACHE = {};
fetch('voice/manifest.json').then(r => r.ok ? r.json() : []).then(a => { for (const id of a) { VOICE_IDS.add(id); const el = new Audio(); el.preload = 'auto'; el.src = 'voice/' + id + '.mp3'; VOICE_CACHE[id] = el; } }).catch(() => { });
function stopVoice() { try { if (voiceEl) voiceEl.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } }
function fnv(t) { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(t)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
function speak(text, female, priority = true) {
  if (MUTED || !text) return;
  let t = String(text).replace(/<[^>]+>/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/₦\s?([\d,]+)/g, '$1 naira').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return;
  const id = fnv(t);
  if (VOICE_IDS.has(id)) { if (!priority && voiceEl && !voiceEl.paused) return; try { if (voiceEl) voiceEl.pause(); if (window.speechSynthesis) speechSynthesis.cancel(); voiceEl = VOICE_CACHE[id] || new Audio('voice/' + id + '.mp3'); voiceEl.currentTime = 0; voiceEl.volume = 1; voiceEl.playbackRate = 1.0; voiceEl.preservesPitch = true; voiceEl.play().catch(() => { }); window.__lastVoice = id; } catch (e) { } return; }
  if (!window.speechSynthesis) return;
  if (!priority && speechSynthesis.speaking) return;
  try {
    if (priority) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t), v = pickVoice(female); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-NG';
    u.rate = 0.92; u.pitch = female ? 1.15 : 0.88; u.volume = 1; speechSynthesis.speak(u);
  } catch (e) { }
}
function speakToast(t) { const m = String(t).match(/^([^:"]{1,40}):?\s*"([^"]+)"/) || String(t).match(/"([^"]{4,})"/); if (!m) return; const who = m.length > 2 ? m[1] : '', line = m.length > 2 ? m[2] : m[1]; speak(line, FEMALE_NAMES.test(who)); }
window.__sndInfo = () => AC ? { state: AC.state, music: SND.music.gain.value, step: SND.step, amb: amb.gain.value, crick: SND.crick.gain.value } : null;
function setMute(on) { MUTED = on; if (MASTER) MASTER.gain.value = on ? 0 : 0.9; if (on && window.speechSynthesis) speechSynthesis.cancel(); const b = $('bmute'); if (b) b.textContent = on ? '🔇 Sound off' : '🔊 Sound on'; try { localStorage.setItem('nysc3d-mute', on ? '1' : '0'); } catch (e) { } }
try { MUTED = localStorage.getItem('nysc3d-mute') === '1'; } catch (e) { }

/* ---------------- input ---------------- */
addEventListener('keydown', e => { if (ST.phoneGame && e.code !== 'KeyP') return; keys[e.code] = true; audio(); if (DLG && /^Digit[1-4]$/.test(e.code)) { choose(+e.code.slice(5) - 1); return; } if (ST.drill) { const m = { ArrowRight: 0, KeyD: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2 }[e.code]; if (m !== undefined) { drillAnswer(m); return; } } if (e.code === 'KeyE') interact(); if (e.code === 'KeyP') phone(!$('phone').classList.contains('on')); });
addEventListener('keyup', e => keys[e.code] = false);
const cv = renderer.domElement; const ptrs = new Map(); let pinch0 = 0;
cv.addEventListener('pointerdown', e => {
  audio(); try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  if (e.pointerType !== 'mouse' && joy.id === null && e.clientX < innerWidth * 0.45) { joyStart(e); return; }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId === joy.id) { joyMove(e); return; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY; const [c, d] = [...ptrs.values()]; const d1 = Math.hypot(c.x - d.x, c.y - d.y); cam.tdist = clamp(cam.tdist * d0 / Math.max(1, d1), 2.6, 16); return; }
  cam.yaw -= (e.clientX - p.x) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.004, 0.05, 1.2); p.x = e.clientX; p.y = e.clientY;
});
const up = e => { if (e.pointerId === joy.id) joyEnd(); ptrs.delete(e.pointerId); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { cam.tdist = clamp(cam.tdist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, 16); }, { passive: true });
var joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
function joyStart(e) { const J = $('joy'); joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; J.style.left = (e.clientX - 60) + 'px'; J.style.top = (e.clientY - 60) + 'px'; J.classList.add('on'); joyMove(e); }
function joyMove(e) { let x = (e.clientX - joy.ox) / 48, y = (e.clientY - joy.oy) / 48; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; $('joy').firstElementChild.style.transform = `translate(${x * 34}px,${y * 34}px)`; }
function joyEnd() { const J = $('joy'); joy.id = null; joy.x = joy.y = 0; J.firstElementChild.style.transform = ''; J.classList.remove('on'); J.style.left = ''; J.style.top = ''; }
let runToggle = false; $('brun').onclick = () => { runToggle = !runToggle; $('brun').classList.toggle('g', runToggle); };
$('bact').onclick = () => interact(); $('bmute').onclick = () => { audio(); setMute(!MUTED); }; setMute(MUTED); $('prompt').onclick = () => interact();

/* ---------------- interactions ---------------- */
let nearest = null;
function interactables() {
  if (ST.area === 'camp') return campInteractables();
  const L = [];
  for (const s of shopSpots) if (s.food) L.push({ x: s.x, z: s.z, label: 'Buy something at ' + s.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), act: () => buy(s.name) });
  for (const v of vendorSpots) L.push({ x: v.x, z: v.z, label: 'Buy ' + v.label, act: () => buy(v.label) });
  for (const n of NPC) if (n.talk && n.area !== 'camp') L.push({ x: n.o.position.x, z: n.o.position.z, label: n.talk.label, act: n.talk.act, npc: n });
  const bus = traffic.find(v => v.kind === 'danfo' && v.stop > 0 && v.lane === 0 && Math.abs(v.x - BUSSTOP_X) < 4);
  if (bus && !ST.riding) L.push({ x: bus.x, z: 6.8, label: `Board ${busName()} to Secretariat (${naira(fareOf(300))})`, act: () => board(bus) });
  if (ST.ch === 3) return L.concat(yInteractables());
  if (ST.ch === 2) return cdsInteractables();
  if (ST.done) L.push(...ppaInteractables());
  if (ST.phase >= 1 && !ST.done) L.push({ x: LGA.x, z: -12.4, label: ST.queue ? 'Wait for your name (queue)' : 'Join the clearance queue', act: clearance });
  return L;
}
function buy(what) {
  const food = /puff|GLORY|EKO|corn/i.test(what), cost = food ? 200 : 50;
  if (ST.cash < cost) { toast('Your account is crying. 😭'); return; }
  ST.txn = 'Street vendor'; ST.cash -= cost; ST.energy = clamp(ST.energy + (food ? 10 : 4), 0, 100); ST.stress = clamp(ST.stress - 2, 0, 100);
  toast(food ? `Puff-puff, hot and oily. ${naira(cost)} gone, energy back.` : `Pure water, ${naira(cost)}. Cold. Life is good.`); tone(660, .08, 'sine', .05); hudSync();
}
function board(bus) {
  if (ST.cash < 300) { toast('Conductor: "Who no get change make e come down!"'); return; }
  ST.txn = 'Danfo fare'; ST.cash -= fareOf(300); hudSync(); ST.riding = bus; bus.passenger = true; bus.stop = 0.6; player.o.visible = false;
  toast('You squeeze in. Conductor: "Shift! Shift! Four four for back!"', 3200); horn(4);
}
function alight(bus) {
  ST.riding = null; bus.passenger = false; player.o.visible = true;
  player.o.position.set(bus.x - 1, 0.18, 8.4); toast('"Secretariat! Make we see your leg!" You jump down.', 3000);
}
/* ---------------- getting around: walk, keke, ride-hailing car, danfo ---------------- */
function travelGo(mode, dest, name) {
  if (mode === 'walk') { ST.target = { x: dest.x, z: dest.z, label: name }; $('arrow').style.display = 'block'; phone(false); toast(ST.area === 'street' ? `Trekking to ${name}. Follow the blue line. Small exercise no kill anybody.` : `Directions set: ${name}.`, 2600); return; }
  const fare = fareOf({ keke: 200, car: 1500, own: 300 }[mode]);
  if (ST.cash < fare) return toast(mode === 'keke' ? 'Keke man: "No money, no movement."' : mode === 'own' ? 'Fuel gauge is on E and your account is on E. Trek.' : 'Ride app: "Payment declined." Your account is shy.');
  ST.txn = mode === 'keke' ? 'Keke fare' : mode === 'own' ? 'Fuel · filling station' : 'Ride app trip'; ST.cash -= fare; if (mode === 'car') ST.stress = clamp(ST.stress - 3, 0, 100); hudSync(); phone(false);
  ST.target = { x: dest.x, z: dest.z, label: name }; rideTo(dest, mode, name);
}
function travelMenu(dest, label) {
  if (!dest || !player) return;
  const P = player.o.position, d = routeLen(P, dest), walkMin = Math.max(1, Math.round(d / 75)), name = label || dest.label || 'there';
  if (ST.area !== 'street' || d < 18) { travelGo('walk', dest, name); return; }
  phone(false);
  ask('How are you getting to ' + name + '?', `It is about ${Math.round(d)} m away. ${STATE().climate === 'cool' ? 'The breeze is cold today.' : 'The sun is not smiling today.'}`, [
    [`🚶🏾 Trek (free · about ${walkMin} min)`, () => travelGo('walk', dest, name)],
    [`🛺 Keke (${naira(fareOf(200))})`, () => travelGo('keke', dest, name)],
    ST.bg === 'car' ? [`🚙 Drive your own car (fuel ${naira(fareOf(300))})`, () => travelGo('own', dest, name)] : [`🚗 Ride app car (${naira(fareOf(1500))} · AC dey)`, () => travelGo('car', dest, name)],
    [`🚌 Danfo (${naira(fareOf(300))}, from the bus stop)`, () => { ST.target = { x: BUSSTOP_X, z: 9, label: 'Corper Close bus stop' }; $('arrow').style.display = 'block'; toast('Danfos stop at Corper Close bus stop and go towards the Secretariat. Okada? LASTMA banned them on this road.', 4200); }],
  ]);
}
function rideTo(dest, kind, label) {
  const P = player.o.position, dir = dest.x >= P.x ? 1 : -1, lane = LANES[0].dir === dir ? 0 : 1;
  cine(kind === 'keke' ? 'KEKE NAPEP' : kind === 'own' ? 'YOUR CAR' : 'RIDE APP', `To ${label || 'your stop'} · ${kind === 'keke' ? '"Hold your bag well o."' : kind === 'own' ? 'AC on. Fuel light also on.' : 'The driver is playing Asake.'}`, () => {
    const v = kind === 'keke' ? keke() : car(); applyReal(v); v.kind = kind; v.ride = true; v.lane = lane; v.x = clamp(P.x - dir * 4, -HALF + 5, HALF - 5); v.v = 3; v.vmax = kind === 'keke' ? 10 : 13; v.stop = 0; v.goal = clamp(dest.x, -PLAY, PLAY);
    v.g.position.set(v.x, 0, LANES[lane].z); v.g.rotation.y = LANES[lane].dir > 0 ? 0 : Math.PI; scene.add(v.g); traffic.push(v); v.dest = dest; v.startX = v.x;
    ST.riding = v; player.o.visible = false; cam.yaw = LANES[lane].dir > 0 ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5; cam.pitch = 0.22;
  }, 1600);
}
function rideArrive(v) {
  v.done = true; v.v = 0;
  cine(null, null, () => {
    traffic.splice(traffic.indexOf(v), 1); scene.remove(v.g); ST.riding = null; player.o.visible = true;
    const z = v.dest.z < 0 ? -8.6 : 8.6; player.o.position.set(v.goal, 0.18, z); player.o.rotation.y = v.dest.z < 0 ? Math.PI : 0; cam.yaw = v.dest.z < 0 ? 0 : Math.PI; camLook.copy(player.o.position);
    ST.mins += Math.round(Math.abs(v.goal - (v.startX || v.goal)) / 60) + 6; if (ST.target) $('arrow').style.display = 'block';
  }, 700).then(() => toast(v.kind === 'keke' ? 'Keke man: "We don reach. Change dey?"' : v.kind === 'own' ? 'You park, lock the car twice, and check the door again.' : 'Driver: "Please rate me five stars, corper."', 2600));
}
function clearance() {
  if (!ST.queue) { ST.queue = PF().queue + 7; toast(`A man with a file: "You are number ${ST.queue}. Don't go far o."`, 3200); setObj(`Queue position ${ST.queue} — stay around the Secretariat`); chat(GRP(), 'LGI said nobody should leave the premises. Names will be called ONCE.', 'off'); return; }
  toast(`Still ${ST.queue} people before you. Check the group or buy pure water.`);
}
function interact() {
  audio(); if (DLG) return; let it = nearest;
  if (!it && player) { let bd = 5.5; for (const c of interactables()) { const d = Math.hypot(c.x - player.o.position.x, c.z - player.o.position.z); if (d < bd) { bd = d; it = c; } } }
  if (!it) { toast('Nothing to do here. Follow the arrow at the top to your next stop.', 2600); return; } it.act();
}

/* ---------------- dialogue panel (compact, the world stays visible) ---------------- */
let DLG = null;
const SAY = t => t; // marks a fixed line to record (tools/extract_lines.py collects SAY('...'))
function ask(who, text, choices, say) {
  DLG = { who, text, choices }; const el = $('dlg'); speak(say || text, FEMALE_NAMES.test(who));
  el.innerHTML = `<b>${who}</b><p>${text}</p><div class="ch">${choices.map((c, i) => `<button data-i="${i}"><kbd>${i + 1}</kbd>${c[0]}</button>`).join('')}</div>`;
  el.hidden = false; [...el.querySelectorAll('button')].forEach((b, i) => b.onclick = () => choose(i));
}
function choose(i) { const d = DLG; if (!d || !d.choices[i]) return; DLG = null; $('dlg').hidden = true; d.choices[i][1](); hudSync(); }
function closeDlg() { DLG = null; $('dlg').hidden = true; }
// Slow, film-style cut: fade to black, a title on black, change the world, hold, fade back in.
function cine(title, sub, mid, hold = 2400) {
  const k = window.__fast ? 0.08 : 1, f = $('fade'); stopVoice(); closeDlg(); ST.busy = true;
  f.style.transition = `opacity ${1.4 * k}s ease`; f.style.opacity = 1;
  return new Promise(res => setTimeout(() => {
    try { if (mid) mid(); } catch (e) { console.error(e); }
    if (title) card(title, sub, (hold + 1500) * k);
    setTimeout(() => { f.style.transition = `opacity ${1.8 * k}s ease`; f.style.opacity = 0; ST.busy = false; setTimeout(() => { f.style.transition = ''; res(); }, 1800 * k); }, hold * k);
  }, 1450 * k));
}
function card(title, sub, ms = 2600) { const c = $('card'); c.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; c.hidden = false; c.classList.remove('out'); clearTimeout(card.t); card.t = setTimeout(() => { c.classList.add('out'); setTimeout(() => c.hidden = true, 600); }, ms); }

/* ---------------- time of day ---------------- */
const pmremGen = new THREE.PMREMGenerator(renderer);
let FOGBASE = null;
function setTOD(seg) {
  ST.seg = seg;
  const el = { Morning: 20, Afternoon: 55, Evening: 4, Night: -9 }[seg];
  sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(seg === 'Morning' ? 100 : 150));
  sky.material.uniforms.sunPosition.value.copy(sun);
  const night = el < 0;
  sunL.intensity = night ? 0 : seg === 'Evening' ? 0.9 : 2.7; sunL.color.set(seg === 'Evening' ? 0xffb070 : 0xfff0d8); sunL.castShadow = !night;
  hemi.intensity = night ? 0.18 : 0.55; hemi.color.set(night ? 0x5a6a9a : 0xe4ecff);
  renderer.toneMappingExposure = night ? 0.75 : 0.85;
  scene.fog.color.set(night ? 0x141a2a : seg === 'Evening' ? 0xd8b896 : 0xd9d6cb);
  { const cl = ST.state ? STATE().climate : 'humid', base = FOGBASE || (FOGBASE = [scene.fog.near, scene.fog.far]); scene.fog.near = base[0]; scene.fog.far = base[1];
    if (!night && cl === 'harmattan') { scene.fog.color.set(seg === 'Evening' ? 0xcfa77a : 0xd8c7a2); scene.fog.near = base[0] * 0.55; scene.fog.far = base[1] * 0.7; sunL.intensity *= 0.82; } // dusty harmattan haze
    if (!night && cl === 'cool') { scene.fog.color.set(0xc9d4de); scene.fog.near = base[0] * 0.7; sunL.intensity *= 0.9; }
    if (!night && cl === 'riverine') scene.fog.color.set(0xc6d4c4); }
  for (const l of CAMP.lights) l.intensity = night ? (l.userData.night || (l === campLamp ? 60 : 140)) : 0;
  for (const p of CAMP.crowd || []) p.hidden = !night;
  for (const p of CAMP.hostelNight || []) p.hidden = !(night && ST.area === 'camp');
  placeFormation(seg === 'Morning' && (ST.cstep === 5 || ST.drill));
  M.light.emissiveIntensity = night ? 3 : 1.2;
  try { const es = new THREE.Scene(), sk = new Sky(); sk.scale.setScalar(1000); for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'sunPosition']) sk.material.uniforms[k].value = sky.material.uniforms[k].value; es.add(sk); if (night) { es.add(new THREE.HemisphereLight(0x334466, 0x111111, 1)); } scene.environment = pmremGen.fromScene(es, 0, 0.1, 2000).texture; } catch (e) { }
}

/* ---------------- outfits ---------------- */
let TEX = null;
function dress(kind) { // 'mufti' | 'white' | 'khaki'
  ST.outfit = kind; const f = ST.g === 'f';
  const t = TEX['p_' + kind] || (f ? { mufti: TEX.civF1, white: TEX.whiteF, khaki: TEX.corperF }[kind] : { mufti: TEX.lMufti, white: TEX.lWhite, khaki: TEX.lCorper }[kind]);
  player.o.traverse(m => { if (m.isMesh && m.material.map && !/hair/i.test(m.material.name)) { m.material.map = t; m.material.needsUpdate = true; } });
}

/* ---------------- camp story ---------------- */
// steps: 0 gate · 1 register · 2 kit · 3 bunk · 4 night (stage or sleep) · 5 parade · 6 notice board · 7 bus out
const CSTEP = [
  { obj: 'Show your call-up letter at the camp gate', at: () => CAMP.spots.gate, label: 'Camp gate' },
  { obj: 'Register at the registration tents', at: () => CAMP.spots.desk, label: 'Registration' },
  { obj: 'Collect your kit at the kit store', at: () => CAMP.spots.kit, label: 'Kit store' },
  { obj: 'Find your bunk in Hostel B', at: () => CAMP.spots.bunk, label: 'Your bunk' },
  { obj: 'Social night at the stage, or sleep in Hostel B', at: () => CAMP.spots.stage, label: 'Stage' },
  { obj: 'Fall in with Platoon 5 on the parade ground', at: () => CAMP.slot, label: 'Platoon 5' },
  { obj: 'Postings are out! Check the notice board', at: () => CAMP.spots.notice, label: 'Notice board' },
  { obj: 'Leave camp: board the bus outside the gate', at: () => CAMP.busSpot, label: 'Bus to your LGA' },
];
function campGo(i) {
  ST.cstep = i;
  if (i >= 6 && !CAMP.exodus) { // leaving day: registration packs up, everyone checks postings and heads for the gate
    CAMP.exodus = true; for (const p of CAMP.dayOne || []) p.hidden = true; if (CAMP.kitNPC) CAMP.kitNPC.hidden = true; for (const p of CAMP.leavers || []) p.hidden = false;
    for (const p of people) if (p.wander) { p.goal = null; p.mode = 'walk'; play(p, 'walk'); }
  } const s = CSTEP[i]; setObj(s.obj); const a = s.at(); ST.target = { x: a.x, z: a.z, label: s.label }; $('arrow').style.display = 'block';
  if (CAMP.ring) CAMP.ring.visible = i === 5;
}
function campInteractables() {
  const L = [], st = ST.cstep, S = CAMP.spots;
  const at = (n, spot) => n ? { x: n.o.position.x, z: n.o.position.z } : spot;
  if (st === 0) L.push({ ...at(CAMP.gateNPC, S.gate), label: 'Show your call-up letter to the soldier', act: gateCheck });
  if (st === 1) L.push({ ...at(CAMP.deskNPC, S.desk), label: 'Register at the desk', act: register });
  if (st === 2) L.push({ ...at(CAMP.kitNPC, S.kit), label: 'Collect your kit', act: kit });
  if (st === 3 || st === 4) L.push({ ...S.bunk, label: st === 3 ? 'Find your bunk' : (ST.danced || ST.watched ? 'Go to sleep' : 'Sleep (skip the social night)'), act: st === 3 ? bunk : () => sleepNight(false) });
  if (st === 4) L.push({ ...S.stage, label: ST.danced || ST.watched ? 'Dance again' : 'Join the social night', act: ST.danced || ST.watched ? playerDance : socialNight });
  if (st === 5 && !ST.drill) L.push({ ...CAMP.slot, label: 'Fall in (parade drill)', act: startDrill });
  if (st === 6) L.push({ ...S.notice, label: 'Read the posting list', act: posting });
  if (st === 7) L.push({ ...CAMP.busSpot, label: 'Board the bus to your LGA', act: leaveCamp });
  for (const m of S.market) L.push({ x: m.x, z: m.z, label: 'Shop at ' + m.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), act: () => market(m.name) });
  L.push({ ...S.clinic, label: 'Visit the camp clinic', act: () => ask('Nurse Ronke', 'Malaria? Headache? Homesick? We have paracetamol for all three.', [['Collect paracetamol', () => { ST.energy = clamp(ST.energy + 6, 0, 100); toast('Two paracetamol and a lecture about drinking water.'); }], ['I\'m fine', () => { }]]) });
  for (const n of NPC) if (n.area === 'camp' && n.talk) L.push({ x: n.o.position.x, z: n.o.position.z, label: n.talk.label, act: n.talk.act });
  return L;
}
function gateCheck() {
  ask('Soldier at the gate', '"Corper! Where is your call-up letter?"', [
    ['Hand over the call-up letter', () => ask('Soldier at the gate', (ST.state === 'LA' ? '"Hmm. Lagos State. Okay. Open that bag. Let me see what you carry."' : `"Hmm. ${SNAME()} State. Okay. Open that bag. Let me see what you carry."`), [
      ['Open the bag', () => ask('Soldier at the gate', '"Iron? Kettle? Ah, you want to cook inside hostel? I will pretend I did not see. Enter. Run to registration!"', [['"Thank you, sir!"', () => { ST.rep += 1; campGo(1); }]])],
      ['"Oga, abeg, ₦500 for pure water?"', () => { ST.stress = clamp(ST.stress + 10, 0, 100); ST.gateBribe = true; ask('Soldier at the gate', '"Are you trying to bribe me?! Frog jump to registration! Go!"', [['Frog jump away, quickly', () => campGo(1)]]); }],
    ])],
    ['"I left it in the bus…"', () => ask('Soldier at the gate', '"Then go and bring it! You think this is a party?"', [['Run back and get it, then show him', () => { ST.energy = clamp(ST.energy - 6, 0, 100); ST.mins += 10; toast('You run back, find it under the seat, run back. He waves you in.', 3600); campGo(1); }]])],
  ]);
}
function register() {
  const done = (photos) => { ST.code = STATE().id + '/26C/' + (1000 + Math.floor(Math.random() * 8999)); ST.mins += 90;
    ask('Registration officer', `"Right thumb here. Again. Left thumb. Again. Okay. Your state code is ${ST.code}. You are in Platoon 5. Next!"`, [['"Thank you, ma."', () => { chat('Platoon 5 · Camp Gist', 'Welcome! Add your name and state code here 👇🏾'); campGo(2); }]], SAY('Right thumb here. Again. Left thumb. Again. Okay. This is your state code. You are in Platoon 5. Next!')); };
  ask('Registration officer', '"Good morning. Call-up letter and green card."', [
    ['Hand them over', () => ask('Registration officer', '"Statement of result? Medical fitness certificate?"', [
      ['Hand them over too', () => ask('Registration officer', '"Four passport photographs, white background."', [
        ['Give the photographs', () => done(true)],
        ['"Ah… I forgot my photos."', () => ask('Photographer (appears from nowhere)', '"Corper! Instant passport, ₦500. Stand here, look here. Don\'t smile."', [['Pay ₦500 and take the photo', () => { ST.cash -= 500; ST.stress = clamp(ST.stress + 4, 0, 100); done(false); }]])],
      ])],
      ['"My medical certificate is not signed…"', () => ask('Registration officer', '"Go to the clinic tent, they will sign it. Come back to me, don\'t join the queue again."', [['Go, get it signed, come back', () => { ST.mins += 40; ST.stress = clamp(ST.stress + 5, 0, 100); done(true); }]])],
    ])],
  ]);
}
function kit() {
  const stock = ['L', 'XL'], name = { S: 'small', M: 'medium', L: 'large', XL: 'extra large' };
  const give = (sz, fit) => ask('Kit store (Mr. Uche)', `"${name[sz][0].toUpperCase() + name[sz].slice(1)} khaki, white shorts, white T-shirts, crested vest, jungle boots, canvas. Sign here. Next!"`, [['Sign and collect the kit', () => {
    ST.khakiSize = sz; dress('white'); ST.mins += 40; campGo(3);
    toast(fit === 'big' ? 'You change into camp whites. The khaki is clearly too big. The tailor at mammy market can fix it.' : 'You change into camp whites: white shorts, white T-shirt, white canvas.', 4600);
  }]], sz === 'L' ? SAY('Large khaki, white shorts, white T-shirts, crested vest, jungle boots, canvas. Sign here. Next!') : SAY('Extra large khaki, white shorts, white T-shirts, crested vest, jungle boots, canvas. Sign here. Next!'));
  ask('Kit store (Mr. Uche)', '"Next! Corper, what is your size?"', ['S', 'M', 'L', 'XL'].map(sz => [`"${name[sz][0].toUpperCase() + name[sz].slice(1)}, sir."`, () => {
    if (stock.includes(sz)) give(sz, 'ok');
    else ask('Kit store (Mr. Uche)', `"${name[sz][0].toUpperCase() + name[sz].slice(1)} don finish since morning. Na only large and extra large remain. Which one you want?"`, [
      ['"Give me large, it is the closest."', () => give('L', 'big')],
      ['"Extra large. I will grow into it."', () => { ST.stress = clamp(ST.stress + 2, 0, 100); give('XL', 'big'); }],
    ], sz === 'S' ? SAY('Small don finish since morning. Na only large and extra large remain. Which one you want?') : SAY('Medium don finish since morning. Na only large and extra large remain. Which one you want?'));
  }]));
}
function bunk() {
  ask('Hostel B', 'Double bunks, 60 to a room. Somebody is already charging a phone from a socket that looks unsafe.', [
    ['Top bunk (less wahala, more climbing)', () => { ST.bunk = 'top'; endDay1(); }],
    ['Bottom bunk (everyone will sit on it)', () => { ST.bunk = 'bottom'; ST.stress = clamp(ST.stress + 3, 0, 100); endDay1(); }],
  ]);
}
function endDay1() { cine('DAY 1 · NIGHT', 'The bugle is quiet. The stage is not. Hostel B is gisting.', () => { setTOD('Night'); ST.mins = 20 * 60 + 15; }).then(() => chat('Platoon 5 · Camp Gist', 'Social night is starting at the stage o! Come and support Platoon 5 🎤')); campGo(4); }
function socialNight() {
  ask('MC Spicy', '"Platoon 5! Where are my people?! We need one person for the dance competition!"', [
    ['Volunteer and dance', () => playerDance()],
    ['Watch and gist with your platoon', () => { ST.stress = clamp(ST.stress - 6, 0, 100); ST.watched = true; toast('You laugh until your stomach hurts. A Platoon 2 guy collects your number. Go to your bunk when you are ready to sleep.', 4200); setObj('Enjoy the night. Sleep in Hostel B when you are ready'); }],
  ]);
}
function playerDance() {
  closeDlg(); ST.busy = true; const st = CAMP.spots.stage, P = player.o.position, back = P.clone();
  P.set(st.x + 1.9, 1.22, st.z - 3.6); player.o.rotation.y = 0; cam.yaw = 0.2; cam.pitch = 0.18; cam.tdist = 6.5; play(player, 'dance', .3);
  for (const c of CAMP.crowd || []) play(c, c.rig === 'fem' ? 'dance' : 'wave');
  toast('The DJ drops the beat. You step up. Platoon 5 goes wild!', 3000);
  setTimeout(() => {
    ST.busy = false; ST.danced = true; ST.energy = clamp(ST.energy - 12, 0, 100); ST.rep = (ST.rep || 0) + 3; play(player, 'idle'); P.copy(back); P.set(st.x + 1.5, 0.02, st.z + 1.2);
    toast('You dance like rent is due. Platoon 5 screams your name. +3 reputation. Go to your bunk when you are ready to sleep.', 4600); setObj('Enjoy the night. Sleep in Hostel B when you are ready');
  }, 9000);
}
function sleepNight(wasOut) {
  ST.energy = clamp(ST.energy + (wasOut ? 20 : 34), 0, 100); ST.stress = clamp(ST.stress - 8, 0, 100);
  campGo(5);
  cine('DAY 2 · 5:10 AM', 'The bugle. Then the whistle. Then a soldier shouting your platoon.', () => {
    setTOD('Morning'); ST.day = 2; ST.mins = 5 * 60 + 10; placeFormation(true);
    player.o.position.set(CAMP.spots.hostel.x + 1.5, 0.02, CAMP.spots.hostel.z); player.o.rotation.y = Math.PI / 2; cam.yaw = -Math.PI / 2; camLook.copy(player.o.position);
  }, 3000).then(() => { bugle(); chat('Platoon 5 · Camp Gist', 'Guys hurry, the marshal is already on the parade ground 😭'); });
}
function market(name) {
  if (/CHIDINMA/.test(name)) ask('Mama Chidinma', '"My corper! Bucket, torchlight, mosquito net. Everything you need for camp."', [['Bucket ₦1,500', () => spend(1500, 'Bucket bought. Now you can bathe like a human.', { stress: -4 })], ['Torchlight ₦800', () => spend(800, 'Torchlight bought. NEPA cannot humble you again.', { stress: -2 })], ['Just looking', () => { }]]);
  else if (/BISI/.test(name)) ask(ZN().market, ST.state && ST.state !== 'LA' ? `"${ZN().foods[0]}, ₦1,200. Hot! Or ${ZN().foods[3].toLowerCase()} if you like."` : '"Rice and beans with fried plantain, ₦1,200. Hot!"', [['Buy a plate ₦1,200', () => spend(1200, 'Hot food. Your soul returns to your body.', { energy: 22 })], ['Not now', () => { }]]);
  else if (/KHAKI/.test(name)) ask('Tailor Musa', '"Your khaki is too big. ₦1,000 and it will fit like Agbada."', [['Adjust it ₦1,000', () => spend(1000, 'Khaki adjusted. You look sharp now.', { rep: 2 })], ['Leave it baggy', () => { }]]);
  else if (/PHOTO/.test(name)) ask('Photographer', '"One snap for your Instagram, ₦500."', [['Take a photo ₦500', () => spend(500, 'Instant print. Your mum will frame it.', { stress: -3 })], ['No thanks', () => { }]]);
  else ask('Charging stall', '"Phone charging ₦100 per hour. No stealing, we have CCTV." (There is no CCTV.)', [['Charge ₦100', () => spend(100, 'Phone charged to 76%.', {})], ['No', () => { }]]);
}
function spend(n, msg, e) { if (ST.cash < n) { toast('Not enough money. Your alert has not come.'); return; } ST.txn = 'Mammy market'; ST.cash -= n; for (const [k, v] of Object.entries(e)) ST[k] = clamp((ST[k] || 0) + v, 0, k === 'rep' ? 999 : 100); toast(msg); tone(660, .08, 'sine', .05); }

/* ---------------- parade drill ---------------- */
const DRILL_CMDS = [['RIGHT… TURN!', -Math.PI / 2], ['LEFT… TURN!', Math.PI / 2], ['ABOUT… TURN!', Math.PI]];
function placeFormation(show) {
  for (const p of CAMP.formation) p.hidden = !show;
}
function startDrill() {
  closeDlg();
  player.o.position.set(CAMP.slot.x, 0.14, CAMP.slot.z); player.o.rotation.y = Math.PI; play(player, 'idle');
  cam.yaw = 0; cam.pitch = 0.3; cam.tdist = 7;
  const seq = []; for (let i = 0; i < 6; i++) { let c = (Math.random() * 3) | 0; if (i && c === seq[i - 1]) c = (c + 1) % 3; seq.push(c); }
  ST.drill = { seq, i: -1, t: 1.8, ok: 0, phase: 'wait', face: Math.PI };
  CAMP.marshal.bubble = ['PLATOON 5… ATTENTION!']; $('drillbtns').hidden = false; $('arrow').style.display = 'none';
  setObj('Drill: follow the marshal\'s commands');
}
function drillAnswer(c) {
  const D = ST.drill; if (!D || D.phase !== 'call') return;
  const want = D.seq[D.i], good = c === want; if (good) D.ok++;
  player.o.rotation.y += DRILL_CMDS[c][1];
  toast(good ? '✔ Sharp!' : '✘ Wrong way! The marshal is looking at you.', 1100); tone(good ? 880 : 220, .1, good ? 'sine' : 'square', .05);
  D.phase = 'react'; D.t = 1.2;
}
function updateDrill(dt) {
  const D = ST.drill; if (!D) return; D.t -= dt;
  if (D.phase === 'wait' && D.t <= 0) { D.i++; if (D.i >= D.seq.length) return endDrill(); const c = D.seq[D.i]; CAMP.marshal.bubble = [DRILL_CMDS[c][0]]; bubT = 99; bubI = 0; D.phase = 'call'; D.t = Math.max(1.6, 2.8 - D.i * 0.2); whistle(); D.face += DRILL_CMDS[c][1]; for (const p of CAMP.formation) p.turnAt = rnd(0.15, 0.55); tone(330, .2, 'sawtooth', .05); }
  else if (D.phase === 'call') { if (D.t <= 0) { toast('✘ Too slow! "Corper, are you sleeping?!"', 1300); player.o.rotation.y = D.face; D.phase = 'react'; D.t = 1.0; } }
  else if (D.phase === 'react' && D.t <= 0) { player.o.rotation.y = D.face; D.phase = 'wait'; D.t = 0.6; CAMP.marshal.bubble = ['…']; }
  for (const p of CAMP.formation) { if (p.turnAt !== undefined) { p.turnAt -= dt; if (p.turnAt <= 0) { p.o.rotation.y = D.face; p.turnAt = undefined; } } }
}
function endDrill() {
  const D = ST.drill; ST.drill = null; ST.drillOk = D.ok; $('drillbtns').hidden = true; CAMP.marshal.bubble = ['STAND… AT EASE!', 'Platoon 5, not bad.'];
  const perfect = D.ok === D.seq.length, good = D.ok >= D.seq.length - 2;
  ST.rep = (ST.rep || 0) + (perfect ? 4 : good ? 1 : -1); ST.energy = clamp(ST.energy - 8, 0, 100); ST.stress = clamp(ST.stress + (good ? -2 : 6), 0, 100);
  card(perfect ? 'DRILL: PERFECT' : good ? 'DRILL: SOLID' : 'DRILL: ROUGH', `${D.ok} of ${D.seq.length} correct. ${perfect ? 'The marshal almost smiled.' : good ? 'The marshal nods once.' : 'You will be on punishment duty in your dreams.'}`, 3400);
  for (const p of CAMP.formation) p.o.rotation.y = Math.PI;
  setTimeout(() => cine('DAY 19 · 2:00 PM', 'Three weeks of drills, SAED lectures and mammy market. Then, the list.', () => { setTOD('Afternoon'); ST.mins = 14 * 60; ST.day = 19; campGo(6); }, 2600).then(() => { chat('Platoon 5 · Camp Gist', 'POSTINGS ARE OUT!!! Go and check the notice board now 😱'); chat('Emeka', 'Abeg who has seen Lagos? I don\'t want to go far'); }), 3400);
}
function posting() {
  const st = STATE(); let P = drawPosting(st.id, ST.course);
  if (window.__posting) { const l = st.lgas.find(l => l[0].toLowerCase().replace(/\W/g, '') === window.__posting.toLowerCase().replace(/\W/g, '')); if (l) { const o = orgsFor(st, l[0], l[1]); const org = window.__org ? o.find(x => x.kind === window.__org) || o[0] : o[0]; P = { ...P, id: l[0], short: l[0], lga: l[0] + ' LGA', tier: l[1], org, sector: org.sector, kind: org.kind, ppa: org.name, prof: profileFor(st, l[0], l[1]) }; } }
  ST.post = P; const pr = P.prof;
  const done = () => { dress('khaki'); toast('Swearing-in done, khaki on. The bus to ' + P.short + ' is outside the gate.', 4000); campGo(7); };
  const lagosIkeja = st.id === 'LA' && P.short === 'Ikeja' && P.ppa === 'Corper Close Model School';
  ask('Posting list', `${esc(ST.name || 'Your name')}, ${ST.code || st.id + '/26C/----'}: <b>${P.short} LGA, ${st.name} State</b> · ${pr.density} density.<br>${pr.blurb}<br><small>PPA: <b>${esc(P.ppa)}</b> · Clearance monthly at the ${P.short} LGA Secretariat · Rent about ${naira(pr.rent)} a month</small>`, [
    ['"God, thank you!" 🙏🏾', () => { ST.stress = clamp(ST.stress - (pr.density === 'Low' ? 10 : 6), 0, 100); done(); }],
    ['Ask about redeployment', () => ask('Redeployment desk', '"Redeployment is for marriage, health or security reasons, with documents. Do you have any of those?"', [
      ['"No, I just don\'t like the place"', () => { toast('"Then go and serve your fatherland, corper." ' + P.short + ' it is.', 3600); done(); }],
      ['"Abeg, I know somebody…"', () => { ST.rep -= 2; ST.stress = clamp(ST.stress + 6, 0, 100); toast('The officer looks at you for a long time. You decide ' + P.short + ' is actually lovely.', 3800); done(); }],
    ])],
  ], lagosIkeja ? SAY('Your posting is out. Ikeja L G A, Lagos. Your place of primary assignment is Corper Close Model School. Clearance is every month at the L G A Secretariat.') : undefined);
  const others = st.lgas.filter(l => l[0] !== P.short).sort(() => Math.random() - .5).slice(0, 3).map(l => l[0]);
  chat('Platoon 5 · Camp Gist', `Who else got ${P.short}?? 🙋🏾`); setTimeout(() => chat('Emeka', pick([`They posted me to ${others[0]} 😭 is it far?`, `${others[1]}! Na there my uncle dey`, `${others[2]} for me. Who knows the place?`, `Abeg who has gone to ${P.short} before? How is accommodation?`])), 2200);
}
function leaveCamp() {
  cine('FOUR WEEKS LATER', LGN() + ', ' + SNAME() + ' State · Monthly clearance day', () => { enterStreet(); saveGame('street'); }, 3000);
}
const busName = () => ST.state === 'LA' || !ST.state ? 'danfo' : STATE().zone === 'SW' ? 'korope bus' : 'shuttle bus';
function reSign(mesh, title, sub, w, h, bg) { if (!mesh) return; const n = campSign(title, sub, w, h, bg); const old = mesh.material.map; mesh.material.map = n.material.map; mesh.material.needsUpdate = true; if (old) old.dispose(); n.geometry.dispose(); }
function callUpLetter() {
  const st = STATE(), z = ZONES[st.zone];
  ask('Call-up letter', `<b>${esc(ST.name || 'Corps member')}</b>, you have been mobilised for the National Youth Service in <b>${st.name}${st.id === 'FC' ? '' : ' State'}</b> (${z.name}).<br>Report to the orientation camp at <b>${st.camp}</b>.<br><small>${st.nick ? '“' + st.nick + '” · ' : ''}Capital: ${st.capital} · ${st.lgas.length} LGAs · Languages you will hear: ${z.lang}${st.flav ? '<br>' + st.flav : ''}</small>`, [
    ['Report to camp ▶', () => { if (st.id !== 'LA') chat('Platoon 5 · Camp Gist', `Welcome to ${st.name} camp o! ${z.greet[0]}`); }],
  ]);
}
function themeCamp() { // your state's camp at the gate
  const st = STATE(); reSign(CAMP.gateSign, `${st.name.toUpperCase()} ORIENTATION CAMP`, `${st.camp} · Fictional game`, 10.6, 1.4);
}
function themeStreet() { // shops, secretariat, PPA sign, buses: your LGA, not Lagos
  const st = STATE(), z = st.zone, set = st.id === 'LA' ? null : z === 'NE' || z === 'NW' ? ZSHOPS.N : z === 'SW' ? null : ZSHOPS[z];
  if (set) for (const { sm, i } of SHOPSIGNS) { const S = SHOPS[i], n = set[i]; const t = signTex(n[0], n[1], S[2], S[3]); const old = sm.material.map; sm.material.map = t; sm.material.needsUpdate = true; if (old) old.dispose(); }
  if (set) for (const sp of shopSpots) sp.name = set[sp.si][0];
  if (LGA.sign) { const old = LGA.sign.material.map; LGA.sign.material.map = ctex(1024, 256, (c, w, h) => { c.fillStyle = '#1b5e20'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; let fs = 76; c.font = `900 ${fs}px Arial Black, Impact`; const t = `${LGN().toUpperCase()} LOCAL GOVT. SECRETARIAT`; while (c.measureText(t).width > w - 40 && fs > 30) { fs -= 4; c.font = `900 ${fs}px Arial Black, Impact`; } c.fillText(t, w / 2, 110); c.font = '700 44px Arial'; c.fillStyle = '#ffeb3b'; c.fillText(`${st.name} State · Corps members' clearance → Hall B`, w / 2, 196); }); LGA.sign.material.needsUpdate = true; if (old) old.dispose(); }
  const P = ST.post; if (P && P.kind === 'school') reSign(SCH.sign, P.ppa.toUpperCase(), 'Knowledge is light · Fictional school', 7.4, 1.4, '#0d47a1');
  if (P && WORK.clinic.sign && P.kind === 'clinic') reSign(WORK.clinic.sign, P.ppa.toUpperCase(), 'Health for all · Fictional', 7, 1.2, '#00695c');
  if (P && WORK.office.sign && P.kind === 'office') reSign(WORK.office.sign, P.ppa.toUpperCase(), P.sector === 'gov' ? 'Government office · Fictional' : 'Fictional organisation', 7, 1.2, '#283593');
  if (st.id !== 'LA' && realModels.danfo && !realModels.danfo.userData.tinted) { // white shuttle buses outside Lagos, green in Abuja
    realModels.danfo.userData.tinted = true;
    realModels.danfo.traverse(m => { if (!m.isMesh || !m.material.map || !m.material.map.image) return; const im = m.material.map.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.filter = st.id === 'FC' ? 'hue-rotate(70deg) saturate(1.2)' : 'saturate(0.12) brightness(1.35)'; g.drawImage(im, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = m.material.map.flipY; t.colorSpace = THREE.SRGBColorSpace; m.material.map = t; m.material.needsUpdate = true; });
  }
  for (const n of NPC) if (n.area !== 'camp' && Array.isArray(n.bubble) && !n.greeted && Math.random() < 0.5) { n.greeted = true; n.bubble = [pick(ZN().greet), ...n.bubble]; }
}
function enterStreet() {
  {
    spawnStreet(); themeStreet(); if (ST.outfit !== 'khaki') dress('khaki');
    ST.area = 'street'; ST.cstep = 99; setTOD('Morning'); ST.day = 1; ST.mins = 7 * 60 + 42; ST.phase = 0; chatT = 0; story = 0;
    if (CAMP.ring) CAMP.ring.visible = false;
    for (const v of traffic) v.g.visible = true;
    player.o.position.set(BUSSTOP_X - 3, 0.18, 9.0); player.o.rotation.y = Math.PI / 2; cam.yaw = -Math.PI / 2; camLook.copy(player.o.position);
    setGroup(GRP());
    setObj('Check your phone'); ST.target = null; $('arrow').style.display = 'none';
    for (const p of CAMP.hostelNight || []) p.hidden = true;
    if (ST.bg === 'family' && !ST.famSent) { ST.famSent = true; setTimeout(() => { ST.txn = 'MUMMY'; ST.cash += 15000; chat('Mummy ❤️', 'I sent you something small for upkeep. Eat well o. Don\'t tell your daddy.'); chat('Naija Trust Bank', 'Credit alert: ₦15,000.00 from MRS ' + (ST.name || 'CORPER').toUpperCase() + ' SNR. Bal: ' + naira(ST.cash), 'off'); hudSync(); }, 45000); }
  }
}
/* ---------------- save / continue (this browser only) ---------------- */
const SAVE_KEY = 'nysc3d.save.v1', SAVE_FIELDS = ['state', 'course', 'cash', 'rep', 'stress', 'energy', 'code', 'post', 'drillOk', 'danced', 'watched', 'ppaScore', 'honest', 'bribeTaken', 'infoPlug', 'khakiSize', 'phoneOpens', 'gateBribe', 'bunk', 'done', 'name', 'tone', 'bg', 'famSent', 'hustles', 'queried', 'cdsDone'];
function saveGame(cp) { try { const d = { cp, g: ST.g, at: Date.now(), st: {}, y: cp === 'year' ? Object.fromEntries(Object.entries(Y).filter(([k, v]) => typeof v !== 'function' && typeof v !== 'object')) : null }; for (const k of SAVE_FIELDS) if (ST[k] !== undefined) d.st[k] = ST[k]; localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { } }
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && d.cp && d.g ? d : null; } catch (e) { return null; } }
function resumeFrom(d) {
  Object.assign(ST, d.st); PH.cash = null; ST.cstep = 99; CAMP.exodus = true;
  for (const p of people) if (p.area === 'camp') p.hidden = true;
  if (d.cp === 'ch2') { ST.done = true; ST.ppa = 5; enterStreet(); startChapter2(); }
  else if (d.cp === 'year') { ST.done = true; ST.ppa = 5; enterStreet(); if (d.y) Object.assign(Y, d.y); startYear(!!d.y); }
  else cine('WELCOME BACK', LGN() + ', ' + SNAME() + ' State · Monthly clearance day', () => enterStreet(), 2200);
}
window.__camp = { dress, campGo, drillAnswer, gateCheck, register, kit, bunk, socialNight, sleepNight, startDrill, posting, leaveCamp, choose, CAMP, CSTEP, setTOD };

/* ---------------- PPA story ---------------- */
function drawBoard(lines, sub) {
  const g = SCH.boardCtx, W = 1024, H = 400; if (!g) return;
  g.fillStyle = '#23402f'; g.fillRect(0, 0, W, H); for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 3, 1); }
  g.fillStyle = 'rgba(240,240,230,.92)'; g.font = '700 30px "Comic Sans MS", "Segoe Print", cursive'; g.fillText(sub || 'JSS 2 · Mathematics · ' + 'Monday', 30, 46);
  g.font = '700 52px "Comic Sans MS", "Segoe Print", cursive'; lines.forEach((l, i) => g.fillText(l, 40, 130 + i * 72));
  SCH.boardTex.needsUpdate = true;
}
const PKIND = () => (ST.post && ST.post.kind) || 'school';
const PPANAME = () => (ST.post && ST.post.ppa) || 'Corper Close Model School';
const PPADOOR = () => PKIND() === 'school' ? SCH.gate : WORK[PKIND()].door;
const BOSSES = { clinic: { SW: 'Matron Folake', SE: 'Matron Ngozi', SS: 'Matron Tamara', NC: 'Matron Ladi', NE: 'Matron Fatima', NW: 'Matron Hadiza' }, office: { SW: 'Mr. Bankole', SE: 'Mr. Obinna', SS: 'Mrs. Ofure', NC: 'Mr. Danladi', NE: 'Mr. Garba', NW: 'Mr. Yusuf' } };
const BOSS = () => PKIND() === 'school' ? PRN() : BOSSES[PKIND()][(ST.state ? STATE() : { zone: 'SW' }).zone];
const BOSSROLE = () => PKIND() === 'clinic' ? 'Matron' : PKIND() === 'office' ? (ST.post && ST.post.sector === 'gov' ? 'Head of Admin' : ST.post && ST.post.sector === 'ngo' ? 'Programme Coordinator' : 'Branch Manager') : 'Principal';
const PPA_FLOWS = {
  clinic: [
    { obj: () => 'Go to your PPA: ' + PPANAME(), at: () => WORK.clinic.door, label: 'Health centre' },
    { obj: () => 'Report to ' + BOSS() + ' at reception', at: () => WORK.clinic.spots.boss, label: 'Reception' },
    { obj: () => 'Help triage the waiting patients', at: () => WORK.clinic.spots.triage, label: 'Waiting area' },
    { obj: () => 'Help in the records room', at: () => WORK.clinic.spots.records, label: 'Records' },
    { obj: () => 'See ' + BOSS() + ' before you close', at: () => WORK.clinic.spots.boss, label: 'Reception' },
  ],
  office: [
    { obj: () => 'Go to your PPA: ' + PPANAME(), at: () => WORK.office.door, label: 'Office' },
    { obj: () => 'Report to ' + BOSS() + ' (' + BOSSROLE() + ')', at: () => WORK.office.spots.boss, label: BOSSROLE() },
    { obj: () => 'Fix the report at your desk', at: () => WORK.office.spots.desk, label: 'Your desk' },
    { obj: () => 'Sort out the printer wahala', at: () => WORK.office.spots.printer, label: 'Printer' },
    { obj: () => 'See ' + BOSS() + ' before you close', at: () => WORK.office.spots.boss, label: BOSSROLE() },
  ],
};
const PPA_STEPS = [
  { obj: () => 'Go to your PPA: ' + PPANAME(), at: () => SCH.gate, label: 'Your school' },
  { obj: () => 'Report to the principal, ' + PRN(), at: () => SCH.spots.principal, label: 'Principal' },
  { obj: 'Teach JSS2 Mathematics at the chalkboard', at: () => SCH.spots.board, label: 'Classroom' },
  { obj: 'Help in the staff room', at: () => SCH.spots.staff, label: 'Staff room' },
  { obj: 'See the principal before you close', at: () => SCH.spots.principal, label: 'Principal' },
];
function ppaGo(i) { ST.ppa = i; const F = PPA_FLOWS[PKIND()] || PPA_STEPS; if (i >= F.length) return; const s = F[i]; setObj(typeof s.obj === 'function' ? s.obj() : s.obj); const a = s.at(); ST.target = { x: a.x, z: a.z, label: s.label }; $('arrow').style.display = 'block'; }
function ppaInteractables() {
  const L = [];
  if (PKIND() !== 'school') return workInteractables(L);
  if (ST.ppa === 0 && Math.hypot(player.o.position.x - LGA.x, player.o.position.z - LGA.z) < 22) L.push({ x: LGA.x - 3, z: -9.0, label: `Take a keke to your PPA (${naira(200)})`, act: kekeToPPA });
  if (ST.ppa === 0 && Math.hypot(player.o.position.x - SCH.gate.x, player.o.position.z - SCH.gate.z) < 4) { ppaGo(1); toast('Pupils in green uniforms run past you shouting "Corper! Corper!"', 3200); }
  if (ST.ppa === 1 || ST.ppa === 4) L.push({ ...SCH.spots.principal, label: 'Talk to ' + PRN() + ' (principal)', act: ST.ppa === 1 ? principal1 : principal2 });
  if (ST.ppa === 2 && !ST.lesson) L.push({ ...SCH.spots.board, label: 'Start teaching the lesson', act: startLesson });
  if (ST.ppa === 3) L.push({ ...SCH.spots.staff, label: 'Help ' + TCH() + ' in the staff room', act: staffRoom });
  return L;
}
// ---- chapter 1 at a health centre or an office ----
function workInteractables(L) {
  const K = PKIND(), W = WORK[K], P = player.o.position, sp = W.spots;
  if (ST.ppa === 0 && Math.hypot(P.x - LGA.x, P.z - LGA.z) < 22) L.push({ x: LGA.x - 3, z: -9.0, label: `Take a keke to your PPA (${naira(fareOf(200))})`, act: kekeToPPA });
  if (ST.ppa === 0 && Math.hypot(P.x - W.door.x, P.z - W.door.z) < 4.5) { ppaGo(1); toast(K === 'clinic' ? 'Mothers with babies on their backs fill the benches. A nurse waves you in.' : 'Air conditioner humming, phones ringing, someone shouting "Who took my stapler?"', 3400); }
  if (ST.ppa === 1) L.push({ ...sp.boss, label: 'Talk to ' + BOSS(), act: work1 });
  if (ST.ppa === 2) L.push({ ...(K === 'clinic' ? sp.triage : sp.desk), label: K === 'clinic' ? 'Triage the waiting patients' : 'Fix the quarterly report', act: K === 'clinic' ? triage : reportFix });
  if (ST.ppa === 3) L.push({ ...(K === 'clinic' ? sp.records : sp.printer), label: K === 'clinic' ? 'Help in the records room' : 'Sort out the printer', act: K === 'clinic' ? recordsEthics : printerEthics });
  if (ST.ppa === 4) L.push({ ...sp.boss, label: 'See ' + BOSS() + ' before you close', act: work2 });
  for (const n of W.staff) if (n.talk) L.push({ x: n.o.position.x, z: n.o.position.z, label: n.talk.label, act: n.talk.act });
  return L;
}
function work1() {
  const K = PKIND();
  ask(BOSS() + ' (' + BOSSROLE() + ')', K === 'clinic'
    ? `"Corper, welcome to ${esc(PPANAME())}. We are three nurses for this whole community. You will help with triage, records and immunisation days. Can you stand the sight of blood?"`
    : `"So you are our new corper. Welcome to ${esc(PPANAME())}. We resume 8 AM, not 8:30. You will help with reports, customers and anything that has a printer inside it."`, [
    ['"Yes ma/sir. I\'m ready to learn."', () => { ST.rep += 2; ppaGo(2); }],
    ['"Do you people pay corpers allowance here?"', () => { ST.stress = clamp(ST.stress + 3, 0, 100); toast(BOSS() + ': "Let us see your work first."', 2800); ppaGo(2); }],
  ]);
}
const TRIAGE = [
  [['A child with high fever who just had a convulsion', 2], ['A man who wants his blood pressure checked "just to know"', 0], ['A woman for her routine antenatal visit', 1]],
  [['A farmer with a deep cut that is still bleeding', 2], ['A boy who needs a school medical form signed', 0], ['An old woman with a cough for two weeks', 1]],
  [['A pregnant woman with a severe headache and swollen legs', 2], ['A young man asking for "drip" because he is tired', 0], ['A baby due for measles vaccine', 1]],
];
function triage() {
  let i = 0, ok = 0; const next = () => {
    if (i >= TRIAGE.length) { ST.ppaScore = Math.round(ok * 5 / 3); card(ok >= 3 ? 'TRIAGE: EXCELLENT' : ok >= 2 ? 'TRIAGE: GOOD' : 'TRIAGE: ROUGH', ok >= 2 ? 'The nurses start calling you "Doctor Corper".' : 'The nurse gently re-orders the queue. Learn from it.', 3000); ppaGo(3); return; }
    const opts = TRIAGE[i].slice().sort(() => Math.random() - .5);
    ask(`Triage · Round ${i + 1} of 3`, 'Who should the nurse see first?', opts.map(([t, sc]) => [t, () => { if (sc === 2) ok++; toast(sc === 2 ? 'Correct. The danger signs come first.' : 'Not first. Look for danger signs: convulsion, heavy bleeding, pregnancy with severe headache.', 2600); i++; setTimeout(next, 1600); }]));
  }; next();
}
function reportFix() {
  const a = 120 + ((Math.random() * 80) | 0), b = 95 + ((Math.random() * 60) | 0), c = 60 + ((Math.random() * 50) | 0), tot = a + b + c, shown = tot + pick([10, -10, 100]);
  let ok = 0; const Q = [
    [`The report says July ${a} + August ${b} + September ${c} = ${shown} customers. The real total is…`, [String(tot), String(shown), String(tot + 1)]],
    ['A customer emails at 11 PM: "Urgent!!!" What is the professional reply in the morning?', ['"Good morning. Thank you for your mail. I will resolve this today and update you by 2 PM."', '"We close at 5. Read our hours."', 'Ignore it until he calls']],
    ['The file is called "final_final_REAL2.xlsx". What do you do?', ['Save a clean copy with a date: "Q3_Report_2026-10-02.xlsx"', 'Name it "final_final_REAL3"', 'Delete the old ones without asking']],
  ];
  let i = 0; const next = () => {
    if (i >= Q.length) { ST.ppaScore = Math.round(ok * 5 / 3); card(ok >= 3 ? 'REPORT: SPOTLESS' : ok >= 2 ? 'REPORT: GOOD' : 'REPORT: ROUGH', ok >= 2 ? BOSS() + ' forwards your report to Head Office with your name on it.' : 'Your supervisor redoes half of it. Next time.', 3000); ppaGo(3); return; }
    const [q, opts] = Q[i]; ask(`Your desk · Task ${i + 1} of 3`, q, opts.map(o => o).sort(() => Math.random() - .5).map(o => [o, () => { if (o === opts[0]) ok++; toast(o === opts[0] ? 'Good.' : 'Hmm. ' + (i === 0 ? `It is ${tot}.` : 'Not quite.'), 1800); i++; setTimeout(next, 1400); }]));
  }; player.o.position.set(WORK.office.spots.desk.x, 0.02, WORK.office.spots.desk.z); play(player, 'type'); next();
}
function workTyping(msg) { ST.busy = true; play(player, 'type'); setTimeout(() => { ST.busy = false; play(player, 'idle'); toast(msg, 4200); ST.mins += 60; ppaGo(4); }, 2600); }
function recordsEthics() {
  ask('Records room', '"Corper, abeg help me. I need a medical fitness certificate for my new job. I never see doctor, but take ₦5,000, just stamp it."', [
    ['"Sorry, you have to see the doctor first."', () => { ST.rep += 3; ST.honest = true; workTyping('You file 40 patient cards instead. Your hands smell of old paper. ' + BOSS() + ' saw what you did.'); }],
    ['Take the ₦5,000 and stamp it', () => { ST.txn = 'Transfer (unknown sender)'; ST.cash += 5000; ST.rep -= 4; ST.bribeTaken = true; ST.stress = clamp(ST.stress + 8, 0, 100); workTyping('The stamp feels heavy. The alert comes. You file cards in silence.'); }],
    ['Call ' + BOSS(), () => { ST.rep += 2; workTyping(BOSS() + ' sends him to the doctor\'s queue. "Corper, you did well."'); }],
  ]);
}
function printerEthics() {
  ask('By the printer', '"Corper, print this receipt for me. Just change ₦18,000 to ₦38,000. Accounts will refund it, we share the difference. Nobody checks."', [
    ['"No o. I\'ll print the real one."', () => { ST.rep += 3; ST.honest = true; workTyping('You print the real receipt and unjam the printer for the whole floor. Instant office celebrity.'); }],
    ['Do it and take your ₦10,000 share', () => { ST.txn = 'Transfer from colleague'; ST.cash += 10000; ST.rep -= 4; ST.bribeTaken = true; ST.stress = clamp(ST.stress + 8, 0, 100); workTyping('Accounts pays. Your share lands. Your stomach does a small drill.'); }],
    ['Tell ' + BOSS(), () => { ST.rep += 2; ST.stress = clamp(ST.stress + 4, 0, 100); workTyping('A long meeting follows. The colleague does not greet you anymore.'); }],
  ]);
}
function work2() {
  ask(BOSS() + ' (' + BOSSROLE() + ')', `"Corper, ${(ST.ppaScore || 0) >= 4 ? 'you did very well today.' : 'thank you for today.'} Take this for transport. See you tomorrow, 8 AM sharp."`, [
    [`"Thank you!" (collect ${naira(3000)})`, () => { ST.txn = PPANAME().slice(0, 28); ST.cash += 3000; ST.rep += 1; chat('Naija Trust Bank', 'Credit alert: ₦3,000.00 · ' + PPANAME().toUpperCase().slice(0, 30) + '. Bal: ' + naira(ST.cash), 'off'); ppaGo(5); ST.target = null; $('arrow').style.display = 'none'; setObj('Chapter 1 complete'); setTimeout(showSummary, 1600); }],
  ]);
}
function kekeToPPA() {
  if (ST.cash < 200) { toast('Keke man: "No money, no movement."'); return; }
  ST.txn = 'Keke fare'; ST.cash -= 200; hudSync(); const d = PPADOOR(); rideTo({ x: d.x + 1.5, z: d.z < 0 ? -8.6 : 8.6 }, 'keke', PPANAME());
}
function principal1() {
  ask('' + PRN() + ' (Principal)', '"Welcome, corper. We have no Maths teacher for JSS2 since January. You will take them. The class is waiting."', [
    ['"No wahala, sir. I\'m ready."', () => { ST.rep += 2; ppaGo(2); drawBoard(['Good morning, class!'], 'JSS 2 · Mathematics'); }],
    ['"Sir, can I teach only two days a week?"', () => { ST.stress = clamp(ST.stress + 4, 0, 100); toast('' + PRN() + ': "You are a corper, not a contractor. Classroom, now."', 3600); ppaGo(2); drawBoard(['Good morning, class!'], 'JSS 2 · Mathematics'); }],
  ]);
}
function makeQ(i) {
  const pool = [
    () => { const t = 2 + ((Math.random() * 4) | 0), f = 300; return [`Danfo fare is ₦${f}. You take ${t} trips.`, `How much in total?`, f * t, [f * t, f * (t + 1), f * t - 100]]; },
    () => { const a = [20, 40, 60, 80][(Math.random() * 4) | 0]; return [`3/4 of ${a * 4} oranges`, 'are sold. How many are sold?', a * 3, [a * 3, a * 2, a * 4]]; },
    () => { const p = [1200, 1500, 2000][(Math.random() * 3) | 0]; return [`Rice is ₦${p} a plate.`, `How much for 3 plates?`, p * 3, [p * 3, p * 2, p * 3 + 300]]; },
    () => { const x = 3 + ((Math.random() * 6) | 0); return [`Solve: 2x + 5 = ${2 * x + 5}`, 'What is x?', x, [x, x + 1, x * 2]]; },
    () => { const n = [40, 60, 80][(Math.random() * 3) | 0]; return [`${n} corpers, 25% are late`, 'to CDS. How many are late?', n / 4, [n / 4, n / 5, n / 2]]; },
    () => { const a = 12 + ((Math.random() * 8) | 0); return [`The area of a square`, `with side ${a} cm?`, a * a, [a * a, a * 4, a * 2]]; },
  ];
  return pool[i % pool.length]();
}
function startLesson(done, n = 5) {
  const off = (Math.random() * 6) | 0; ST.lesson = { i: 0, ok: 0, done: typeof done === 'function' ? done : null, qs: Array.from({ length: n }, (_, i) => makeQ(i + (done ? off : 0))) }; player.o.position.set(SCH.spots.board.x + 1.2, 0.14, SCH.spots.board.z); player.o.rotation.y = 0; cam.yaw = 0.35; cam.pitch = 0.28; cam.tdist = 8;
  for (const s of SCH.students) s.hidden = false; nextQ();
}
function nextQ() {
  const L = ST.lesson; if (L.i >= L.qs.length) return endLesson();
  const [a, b, ans, opts] = L.qs[L.i]; drawBoard([`Q${L.i + 1}. ${a}`, b], `JSS 2 · Mathematics · ${L.ok} of ${L.i} correct`);
  const o = opts.slice().sort(() => Math.random() - .5);
  ask(`Question ${L.i + 1} of ${L.qs.length}`, `${a} ${b} A pupil raises her hand: "Uncle corper, what is the answer?"`.replace('Uncle corper', ST.g === 'f' ? 'Aunty corper' : 'Uncle corper'), o.map(v => [String(/₦|Rice|fare/.test(a) ? naira(v) : v), () => answerQ(v === ans, ans)]), ST.g === 'f' ? SAY('Aunty corper, what is the answer?') : SAY('Uncle corper, what is the answer?'));
}
function answerQ(good, ans) {
  const L = ST.lesson; if (good) L.ok++;
  for (const s of SCH.students) { play(s, good ? 'agree' : 'argue'); setTimeout(() => play(s, 'sit'), 1700); }
  if (good) { tone(660, .1, 'sine', .06); tone(880, .12, 'sine', .06, .1); toast(pick(['The class claps. "Correct!"', 'A boy at the back says "Ehen! I understand now."', 'The pupils copy it into their notes.']), 1800); }
  else { tone(200, .25, 'square', .04); toast(`The class murmurs. The answer was ${ans}. A girl in front looks disappointed.`, 2400); }
  L.i++; setTimeout(nextQ, 1900);
}
function endLesson() {
  const L = ST.lesson; if (!L.done) ST.ppaScore = L.ok; ST.lesson = null; ST.rep += L.ok >= 4 ? 4 : L.ok >= 3 ? 2 : 0; ST.stress = clamp(ST.stress + (L.ok >= 3 ? -4 : 6), 0, 100); ST.energy = clamp(ST.energy - 10, 0, 100);
  drawBoard([`Today: ${L.ok} of ${L.qs.length} correct`, L.ok >= 4 ? 'Excellent class!' : 'Homework: page 42'], 'JSS 2 · Mathematics');
  card(L.ok >= 4 ? 'CLASS: EXCELLENT' : L.ok >= 3 ? 'CLASS: GOOD' : 'CLASS: ROUGH', L.ok >= 4 ? 'The pupils ask if you can teach them every day.' : L.ok >= 3 ? 'Most of them got it. A few are drawing danfos.' : 'Half the class is confused. So are you.', 3200);
  setTimeout(() => L.done ? L.done(L.ok) : ppaGo(3), 1200);
}
function staffRoom() {
  ask('' + TCH() + ' (Vice Principal)', '"Corper, compile JSS2 scores. Ah, and a parent called. Her son scored 38. She said you should make it 50 and she will \'appreciate you\'."', [
    ['Refuse politely, enter the real score', () => { ST.rep += 3; ST.honest = true; typing('You type the real scores into the old computer. ' + TCH() + ' nods slowly. "You will go far."'); }],
    ['Take the ₦5,000 "appreciation"', () => { ST.txn = 'MRS ADA (unknown sender)'; ST.cash += 5000; ST.rep -= 4; ST.bribeTaken = true; ST.stress = clamp(ST.stress + 8, 0, 100); typing('You change 38 to 50. The ₦5,000 alert comes. You feel it in your chest.'); chat('Naija Trust Bank', 'Credit alert: ₦5,000.00 from MRS ADA (UNKNOWN). Bal: ' + naira(ST.cash), 'off'); }],
    ['Report it to the principal', () => { ST.rep += 2; ST.stress = clamp(ST.stress + 4, 0, 100); typing('You type the real scores. ' + PRN() + ' calls the parent. You will hear about this in the staff room for weeks.'); }],
  ]);
}
function typing(msg) {
  ST.busy = true; player.o.position.set(SCH.spots.staff.x, 0.02, SCH.spots.staff.z + 0.3); player.o.rotation.y = Math.PI; play(player, 'type');
  toast('Typing the result sheet on a computer older than you…', 2600);
  setTimeout(() => { ST.busy = false; play(player, 'idle'); toast(msg, 4200); ST.mins += 60; ppaGo(4); }, 2800);
}
function principal2() {
  ask('' + PRN() + ' (Principal)', `"Corper, ${ST.ppaScore >= 4 ? 'the children are talking about your class!' : 'thank you for today.'} Take this small transport money. See you on Monday, not Wednesday."`, [
    ['"Thank you, sir!" (collect ₦5,000)', () => { ST.txn = 'Corper Close Model Sch'; ST.cash += 5000; ST.rep += 1; chat('Naija Trust Bank', 'Credit alert: ₦5,000.00 · CORPER CLOSE MODEL SCH. Bal: ' + naira(ST.cash), 'off'); ppaGo(5); ST.target = null; $('arrow').style.display = 'none'; setObj('Chapter 1 complete'); setTimeout(showSummary, 1600); }],
  ], ST.ppaScore >= 4 ? SAY('Corper, the children are talking about your class! Take this small transport money. See you on Monday, not Wednesday.') : SAY('Corper, thank you for today. Take this small transport money. See you on Monday, not Wednesday.'));
}
function corperType() {
  if (ST.bribeTaken) return ['THE SIDE-HUSTLE MINISTER', 'You found the "appreciation" economy early. Your conscience is on airplane mode.'];
  if (ST.queried) return ['THE QUERY COLLECTOR', 'The group chat said no CDS. The LGI said otherwise. Your explanation letter is three pages long.'];
  if ((ST.infoPlug || 0) >= 3) return ['THE INFORMATION PLUG', 'While the group chat argued, you went and checked. Everyone now DMs you first.'];
  if ((ST.ppaScore || 0) >= 4 && ST.honest) return ['THE PPA LEGEND', 'Your pupils will remember you. The principal already does.'];
  if (ST.danced) return ['THE SOCIAL CORPER', 'Platoon 5 still chants your name. Your phone has 140 new contacts.'];
  if ((ST.drillOk || 0) >= 6 && ST.done) return ['THE CLEARANCE WARRIOR', 'Sharp on parade, sharp in the queue. The LGI knows your face.'];
  if ((ST.phoneOpens || 0) >= 3) return ['THE INFORMATION PLUG', 'You read every message, checked every rumour, and showed up at the right place.'];
  return ['THE "I JUST WANT POP" CORPER', 'Head down, attendance up, no wahala. POP is the only destination.'];
}
function showSummary(ch = 1) {
  const [t, d] = ch === 3 ? yearType() : corperType(), el = $('summary');
  el.innerHTML = `<small>${esc((ST.name || 'CORPER').toUpperCase())} · ${ST.code || 'NO STATE CODE'} · CHAPTER ${ch}</small><h2>${t}</h2><p>${d}</p>
  <dl><div><dt>Background</dt><dd>${(BACKGROUNDS.find(b => b[0] === ST.bg) || BACKGROUNDS[0])[1]}</dd></div><div><dt>Posting</dt><dd>${ST.post ? ST.post.lga : '—'}</dd></div><div><dt>Drill</dt><dd>${ST.drillOk ?? 0} / 6</dd></div><div><dt>Class</dt><dd>${ST.ppaScore ?? 0} / 5</dd></div>${ch === 2 ? `<div><dt>CDS</dt><dd>${ST.cdsDone ? 'Attended ✅' : ST.queried ? 'Queried ⚠️' : CDS.truth ? 'Missed' : 'Cancelled'}</dd></div><div><dt>Rumour</dt><dd>${CDS.truth ? 'False' : 'True'}${CDS.confirmed ? ' · you checked' : ''}</dd></div>` : ''}<div><dt>Reputation</dt><dd>${ST.rep}</dd></div><div><dt>Balance</dt><dd>${naira(ST.cash)}</dd></div><div><dt>Stress</dt><dd>${Math.round(ST.stress)}</dd></div><div><dt>Energy</dt><dd>${Math.round(ST.energy)}</dd></div>${ch === 3 ? `<div><dt>PPA days</dt><dd>${Y.ppaDays} present · ${Y.ppaMiss} missed · ${Y.lates} late</dd></div><div><dt>CDS</dt><dd>${Y.cdsDays} attended · ${Y.cdsMiss} missed</dd></div><div><dt>Clearance</dt><dd>${Y.cleared || 0} of ${Y.MONTHS - 1} cleared</dd></div><div><dt>Earned</dt><dd>${naira(Y.earned)}</dd></div><div><dt>Spent</dt><dd>${naira(Y.spent)}</dd></div><div><dt>Sent home</dt><dd>${naira(Y.sent)}</dd></div><div><dt>Balance at POP</dt><dd>${naira(ST.cash)}</dd></div>` : ''}</dl>
  <div class="row"><button class="btn g" id="sumplay">${ch === 1 ? 'Continue to Chapter 2' : ch === 2 ? 'Start your service year ▶' : 'Keep exploring ' + LGN()}</button><button class="btn" id="sumagain">Start again</button></div>`;
  if (ch === 1) saveGame('ch2'); if (ch === 2) { ST.ch = 3; saveGame('year'); ST.ch = 2; }
  el.hidden = false; $('sumplay').onclick = () => { el.hidden = true; if (ch === 1 && !ST.ch) startChapter2(); else if (ch === 2) startYear(); else if (ch === 3) { Y.on = false; setObj('Ex-corper. Explore ' + LGN() + ' as long as you like.'); } }; $('sumagain').onclick = () => location.reload();
  bugle();
}
$('arrow').onclick = () => { if (ST.target && ST.area === 'street' && !ST.riding && !DLG) travelMenu(ST.target, ST.target.label); };
window.__travel = { travelMenu, rideTo };
window.__ppa = { ppaGo, kekeToPPA, principal1, startLesson, staffRoom, principal2, showSummary, corperType, SCH };

/* ---------------- Chapter 2: CDS week, and the rumour mill ---------------- */
const LODGE = { x: -45.6, z: 15.6 };
{ // your room at the Corper Lodge: bed, net, fan, cooker, bucket
  const lb = hollowBuilding({ x: -44, z: 14.6, w: 7, d: 6, h: 3.2, door: '-z', doorW: 1.4, doorAt: 1.6, y0: 0.18, base: '#d9c4a3', inner: '#cfdcd6' });
  LODGE.door = lb.doorOut; LODGE.room = lb.room;
  box(1.2, 0.35, 2.0, M.wood, -45.7, 0.18 + 0.18, 15.6); box(1.1, 0.16, 1.9, M.foamB || (M.foamB = new THREE.MeshStandardMaterial({ color: 0x2f6fb3, roughness: .9 })), -45.7, 0.18 + 0.43, 15.6);
  const net = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 2.1), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false })); net.position.set(-45.7, 0.18 + 1.25, 15.6); net.userData.keep = true; scene.add(net);
  box(0.8, 0.05, 0.6, M.wood, -42.2, 0.18 + 0.75, 16.8); for (const dx of [-0.35, 0.35]) box(0.05, 0.75, 0.55, M.wood, -42.2 + dx, 0.18 + 0.37, 16.8, scene, false);
  box(0.35, 0.5, 0.35, M.red, -41.6, 0.18 + 0.25, 13.2); // bucket
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: .4 })); cyl.position.set(-41.3, 0.18 + 0.25, 16.9); scene.add(cyl);
  const pole = box(0.04, 1.2, 0.04, M.pole, -42.6, 0.18 + 0.6, 13.0, scene, false); const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), M.black); head.rotation.x = Math.PI / 2; head.position.set(-42.6, 0.18 + 1.25, 13.0); scene.add(head); // standing fan
  box(2.4, 0.02, 0.02, M.wire, -44, 0.18 + 2.1, 17.2, scene, false); box(0.5, 0.8, 0.04, new THREE.MeshStandardMaterial({ color: 0xb39b6b }), -44.6, 0.18 + 1.65, 17.15, scene, false); // khaki on the line
}
const CDS = { trash: [], truth: true, step: 0 };
{ // corper lodge sign on a south-side building, and a CDS banner at the Secretariat
  const s = campSign('CORPER LODGE', 'Rooms • Light dey sometimes', 3.6, 0.9, '#5d4037'); s.position.set(-44, 3.0, 11.45); s.rotation.y = Math.PI; scene.add(s);
  const b = campSign('DFQC CDS GROUP', 'Drug-Free & Quality Control · Thursdays 9AM', 5, 1.1, '#6a1b9a'); b.position.set(LGA.x + 9, 2.2, -13.6); scene.add(b);
  for (const dx of [-2.4, 2.4]) box(0.08, 2.4, 0.08, M.pole, LGA.x + 9 + dx, 1.2, -13.62, scene, false);
}
const trashMat = [new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: .4, transparent: true, opacity: .9 }), new THREE.MeshStandardMaterial({ color: 0x3fa34d, roughness: .3 }), new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: .5 })];
function spawnTrash() {
  for (const t of CDS.trash) scene.remove(t.m); CDS.trash = [];
  const pts = [[-12, -15], [-8, -19], [-3, -14], [4, -17], [9, -20], [13, -15], [-14, -21], [7, -13]];
  pts.forEach(([dx, dz], i) => { const k = i % 3, g = k === 1 ? new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8) : new THREE.BoxGeometry(0.22, 0.03, 0.16); const m = new THREE.Mesh(g, trashMat[k]); if (k === 1) m.rotation.z = Math.PI / 2; m.position.set(LGA.x + dx, 0.06, dz); m.rotation.y = rnd(0, 3); m.userData.keep = true; scene.add(m); CDS.trash.push({ m, x: LGA.x + dx, z: dz, label: ['pure-water sachet', 'plastic bottle', 'biscuit wrapper'][k] }); });
}
function startChapter2() {
  ST.ch = 2; CDS.step = 1; CDS.truth = Math.random() < 0.7; CDS.hint = null; CDS.knows = null; CDS.confirmed = false;
  spawnStreet();
  cine('WEDNESDAY · 6:40 PM', 'Chapter 2 · CDS week. Home, finally. Your room at the Corper Lodge.', () => {
    setTOD('Evening'); ST.mins = 18 * 60 + 40; ST.area = 'street'; ST.target = null;
    player.o.position.set(-43.4, 0.2, 13.4); player.o.rotation.y = 0; cam.yaw = Math.PI; cam.pitch = 0.32; cam.tdist = 4.2; camLook.copy(player.o.position);
  }, 3000);
  setGroup(GRP());
  setObj('Is there CDS tomorrow? Find out, then rest at your lodge'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Corper lodge' }; $('arrow').style.display = 'block';
  const lines = [[1.5, 'Emeka', 'Guys is there CDS tomorrow?'], [4, 'Bisi', 'They said no CDS because of the LG election thing'], [7, 'Seyi', 'Who said?? Abeg post proof'], [10, GRP(), 'My cousin\'s friend works at the Secretariat, he said no CDS 💯'], [13.5, 'Kunle', 'Wait for official announcement before una go dey shout'], [17, 'Bisi', 'I\'m sleeping in tomorrow sha 😴']];
  for (const [t, w, m] of lines) setTimeout(() => chat(w, m), (t + 5) * 1000);
  phoneActs([
    ['DM Tolu', () => { openThread('Tolu', 'dm'); chat('You', 'Tolu abeg, is there CDS tomorrow?', 'me', 'Tolu'); phoneActs(cdsActs()); setTimeout(() => { const right = Math.random() < 0.8; CDS.hint = right ? CDS.truth : !CDS.truth; chat('Tolu', CDS.hint ? 'Yes o. Our CDS exec said nothing was cancelled. 9AM.' : 'I heard it was cancelled. I\'m not going 🤷🏾‍♀️', '', 'Tolu'); }, 2500); }],
    ...cdsActs(),
  ]);
}
function cdsActs() { return [['Check LGI official channel', () => { chat('LGI (Official)', 'No new announcement. Last post: "CDS holds every Thursday. Absentees will be queried."', 'off'); }], ['Ignore the gist', () => { phone(false); }]]; }
function cdsInteractables() {
  const L = [];
  if (CDS.step === 1) {
    if (Math.hypot(player.o.position.x - LGA.x, player.o.position.z - LGA.z) < 25) L.push({ x: LGA.x - 2.4, z: -10.6, label: 'Ask the CDS secretary at the gate', act: () => { CDS.knows = CDS.truth; CDS.confirmed = true; ask('Chioma (CDS Secretary)', CDS.truth ? '"Who is spreading that rumour? LGI never cancelled anything. 9 AM sharp, come with your CDS card."' : '"It\'s true this time. The hall is being used for the LG election training. No CDS tomorrow. Official post will come in the morning."', [['"Thank you, I\'ll tell the group."', () => { chat('You', CDS.truth ? 'I just confirmed from the CDS Sec. CDS holds tomorrow 9AM!' : 'Confirmed from CDS Sec: no CDS tomorrow.', 'me'); ST.infoPlug = (ST.infoPlug || 0) + 1; ST.rep += 1; }]]); } });
    L.push({ ...LODGE, label: 'Rest at your lodge (decide about CDS)', act: lodgeSleep });
  }
  if (CDS.step === 2) {
    if (Math.hypot(player.o.position.x - (LGA.x + 4), player.o.position.z - (-15)) < 13 && !CDS.arrived) cdsArrive();
    if (CDS.arrived && CDS.truth) for (const t of CDS.trash) L.push({ x: t.x, z: t.z, label: 'Pick up the ' + t.label, act: () => pickTrash(t) });
    if (CDS.arrived && CDS.truth && !CDS.trash.length && !CDS.signed) L.push({ x: LGA.x + 9, z: -12.4, label: 'Sign the CDS register', act: signRegister });
  }
  return L;
}
function lodgeSleep() {
  ask('Your room, Corper Lodge', 'Light just went. Your phone is at 31%. Tomorrow is Thursday.', [
    ['Set alarm for 6:30 and go for CDS', () => nightToMorning(true)],
    ['Sleep in. They said no CDS.', () => nightToMorning(false)],
  ]);
}
function nightToMorning(go) {
  CDS.go = go;
  cine(go ? 'THURSDAY · 6:30 AM' : 'THURSDAY · 9:40 AM', go ? 'The alarm. NEPA brought light at 3 AM. Khaki on, CDS card in your pocket.' : 'You slept like a king. Then your phone buzzed.', () => {
    setTOD('Morning'); ST.day = 2; ST.energy = clamp(ST.energy + 30, 0, 100); ST.stress = clamp(ST.stress - 6, 0, 100);
    player.o.position.set(-44.2, 0.2, 14.2); player.o.rotation.y = Math.PI; cam.yaw = 0; cam.pitch = 0.3; cam.tdist = 4.2; camLook.copy(player.o.position);
    if (go) { ST.mins = 6 * 60 + 30; CDS.step = 2; spawnTrash(); dress('khaki'); setObj('Get to CDS at the Secretariat before 10:00 AM'); ST.target = { x: LGA.x + 9, z: -14, label: 'CDS ground' }; $('arrow').style.display = 'block'; }
    else ST.mins = 9 * 60 + 40;
  }, 3000).then(() => { if (go) bugle(); else setTimeout(officialVerdict, 1500); });
}
function cdsArrive() {
  CDS.arrived = true; const late = ST.mins > 10 * 60;
  if (!CDS.truth) { toast('Security man: "No CDS today o. Hall is busy. Check your group." You wasted your transport money.', 4200); ST.stress = clamp(ST.stress + 5, 0, 100); setTimeout(officialVerdict, 2500); return; }
  if (late) { ask('DFQC CDS President', '"Corper, it is past 10. Register is closed. Your name will go to the LGI as late."', [['"Sorry sir, traffic…"', () => { ST.rep -= 2; ST.stress = clamp(ST.stress + 8, 0, 100); CDS.signed = true; CDS.late = true; setTimeout(officialVerdict, 1500); }]]); return; }
  ask('DFQC CDS President', '"Welcome! Today is sanitation in the compound before the sensitisation talk. Pick up every sachet and bottle, then sign the register."', [['"On it."', () => { setObj(`Clean the compound: ${CDS.trash.length} pieces of litter left`); ST.target = null; $('arrow').style.display = 'none'; }]]);
}
function pickTrash(t) {
  scene.remove(t.m); CDS.trash = CDS.trash.filter(x => x !== t); ST.energy = clamp(ST.energy - 1.5, 0, 100); tone(520 + CDS.trash.length * 40, .06, 'sine', .05);
  if (CDS.trash.length) setObj(`Clean the compound: ${CDS.trash.length} pieces of litter left`);
  else { setObj('Sign the CDS register'); ST.target = { x: LGA.x + 9, z: -12.4, label: 'CDS register' }; $('arrow').style.display = 'block'; toast('Compound clean. The CDS president nods: "This one is serious."', 3000); }
}
function signRegister() {
  CDS.signed = true; ST.rep += 3; ST.cdsDone = true; ST.mins += 60; toast('You sign the register. Thumbprint, again. Attendance marked ✅', 3200);
  setTimeout(officialVerdict, 1800);
}
function officialVerdict() {
  ST.target = null; $('arrow').style.display = 'none';
  if (CDS.truth) {
    chat('LGI (Official)', 'CDS holds today as scheduled. Ignore all rumours. Absentees will be queried.', 'off');
    if (!CDS.go) { ST.rep -= 4; ST.stress = clamp(ST.stress + 14, 0, 100); ST.queried = true; setTimeout(() => ask('Query letter', 'From the LGI: "You were absent from CDS on Thursday without permission. Explain in writing within 48 hours why disciplinary action should not be taken."', [['Write the explanation (and learn)', () => endChapter2()]]), 1500); return; }
    setTimeout(endChapter2, 2500);
  } else {
    chat('LGI (Official)', 'Due to the LG election training at the Secretariat, there will be no CDS today. Normal CDS resumes next week.', 'off');
    if (CDS.go) { ST.stress = clamp(ST.stress + 4, 0, 100); ST.cash -= 0; }
    else { ST.stress = clamp(ST.stress - 4, 0, 100); }
    setTimeout(endChapter2, 2500);
  }
}
function endChapter2() {
  CDS.step = 3; const good = CDS.truth ? (CDS.go && !CDS.late) : !CDS.go;
  if (CDS.confirmed && good) ST.infoPlug = (ST.infoPlug || 0) + 2;
  setObj('Chapter 2 complete');
  card(good ? 'YOU READ THE ROOM' : 'THE RUMOUR GOT YOU', CDS.truth ? (good ? 'CDS held, and you were there.' : 'CDS held. You were not.') : (good ? 'No CDS, and you stayed home.' : 'No CDS. You wasted transport money.'), 3600);
  setTimeout(() => showSummary(2), 3800);
}
window.__cds = { startChapter2, lodgeSleep, nightToMorning, cdsArrive, pickTrash, signRegister, officialVerdict, CDS, LODGE };

/* ---------------- Chapter 3: the service year (days, weekly CDS, monthly clearance, money, events, POP) ---------------- */
// Compressed calendar: each month is two weeks of Monday (PPA), Thursday (CDS) and Saturday (free), then clearance. Three months, then POP.
const YDAYS = ['Mon', 'Thu', 'Sat'], YNAME = { Mon: 'MONDAY', Thu: 'THURSDAY', Sat: 'SATURDAY', Clr: 'CLEARANCE DAY', Pop: 'PASSING OUT DAY' };
const Y = { on: false, month: 1, week: 1, di: 0, kind: 'Mon', task: null, done: false, ppaDays: 0, ppaMiss: 0, cdsDays: 0, cdsMiss: 0, clrMiss: 0, lates: 0, sent: 0, earned: 0, spent: 0, events: [], debt: 0, cdsOff: false, hustled: 0, aso: 0, MONTHS: 3, WEEKS: 2 };

function yDayLabel() { return Y.kind === 'Clr' ? `CLEARANCE · END OF MONTH ${Y.month}` : Y.kind === 'Pop' ? 'PASSING OUT PARADE' : `${YNAME[Y.kind]} · MONTH ${Y.month}, WEEK ${Y.week}`; }
function startYear(resume) {
  ST.ch = 3; Y.on = true; CDS.step = 0; spawnStreet(); setGroup(GRP());
  if (!resume) { Object.assign(Y, { month: 1, week: 1, di: 0, kind: 'Mon' }); chat('LGI (Official)', 'Corps members are reminded: PPA daily, CDS every Thursday, clearance at the end of every month. No clearance, no allowance.', 'off'); }
  for (const s of SCH.students) s.hidden = true;
  yMorning();
}
function yKindFor() { return Y.di >= YDAYS.length * Y.WEEKS ? (Y.month >= Y.MONTHS ? 'Pop' : 'Clr') : YDAYS[Y.di % YDAYS.length]; }
function yMorning() {
  Y.kind = yKindFor(); Y.week = Math.min(Y.WEEKS, Math.floor(Y.di / YDAYS.length) + 1); Y.jobs = Object.keys(PPA_JOBS).filter(k => (PPA_JOBS[k].kind || 'school') === PKIND()).sort(() => Math.random() - .5).slice(0, 3); Y.done = false; Y.task = null; Y.cdsOff = false; Y.signed = false; Y.late = false; Y.dusk = false;
  const sub = { Mon: 'PPA day. ' + BOSS() + ' counts who is late at 8:00.', Thu: 'CDS day. Khaki, CDS card, and whatever the group chat is saying.', Sat: 'No PPA, no CDS. Your money, your energy, your choice.', Clr: 'Last working day of the month. Thumbprint at the LGA, then the alert.', Pop: 'Twelve weeks compressed into one game. Today you pass out.' }[Y.kind];
  cine(yDayLabel(), sub, () => {
    setTOD('Morning'); ST.mins = 6 * 60 + 45; ST.area = 'street'; ST.target = null; $('arrow').style.display = 'none';
    player.o.position.set(-44.2, 0.2, 14.2); player.o.rotation.y = Math.PI; cam.yaw = 0; cam.pitch = 0.3; cam.tdist = 4.2; camLook.copy(player.o.position);
    dress(Y.kind === 'Sat' ? 'mufti' : 'khaki');
    // the cost of being alive
    ST.txn = 'Food · Mama Tolani + pure water'; ST.cash -= PF().food; Y.spent += PF().food; hudSync();
    ST.energy = clamp(ST.energy + 26, 0, 100); ST.stress = clamp(ST.stress - 5, 0, 100);
    if (ST.cash < 0 && !Y.loan) { Y.loan = true; setTimeout(() => { ST.txn = 'Transfer from TOLU (loan)'; ST.cash += 10000; Y.debt += 10000; hudSync(); chat('Tolu', 'I don send you ₦10k. Pay me back when alert land o 😒', '', 'Tolu'); }, 3200); }
    saveGame('year');
  }, 2800).then(() => { ySetDay(); setTimeout(yEvent, 2200); });
}
function ySetDay() {
  if (Y.kind === 'Mon') { setObj('Get to ' + PPANAME() + ' before 8:00 AM and sign the attendance book'); const d = PPADOOR(); ST.target = { x: d.x, z: d.z, label: 'Your PPA' }; }
  if (Y.kind === 'Thu') {
    Y.cdsOff = Math.random() < PF().cdsOff; const rumour = Math.random() < PF().rumour;
    if (rumour) { const says = Y.cdsOff ? 'no CDS today' : 'no CDS today'; setTimeout(() => chat(pick(['Bisi', 'Emeka', 'Kunle']), `Guys they said ${says} 👀`), 1500); setTimeout(() => chat(pick(['Seyi', 'Tolu']), 'Who said? Abeg post proof'), 4200); }
    setTimeout(() => chat('LGI (Official)', Y.cdsOff ? 'CDS will not hold today due to the LG budget meeting at the Secretariat.' : 'CDS holds today. Absentees will be queried.', 'off'), rumour ? 9000 : 3500);
    setObj('CDS day: get to the CDS ground at the Secretariat by 10:00 AM'); ST.target = { x: LGA.x + 9, z: -14, label: 'CDS ground' };
  }
  if (Y.kind === 'Sat') { setObj('Free day: hustle, rest, or show face at an owambe. Sleep at your lodge to end the day.'); ST.target = null; ySaturday(); }
  if (Y.kind === 'Clr') { Y.queue = PF().queue; Y.inQ = false; setObj('Monthly clearance: get to the LGA Secretariat'); ST.target = { x: LGA.x, z: LGA.z, label: 'LGA Secretariat' }; setTimeout(() => chat(GRP(), 'Clearance don start o. The queue is already long 😩'), 2500); }
  if (Y.kind === 'Pop') { setObj('Passing Out Parade at the LGA Secretariat'); ST.target = { x: LGA.x, z: LGA.z, label: 'POP venue' }; chat('LGI (Official)', 'POP holds at the LGA Secretariat ground. Corps members must be in full kit.', 'off'); }
  $('arrow').style.display = ST.target ? 'block' : 'none';
}
// morning events: life happens
const YEVENTS = [
  () => ask('Mummy ❤️', '"My dear, your younger brother needs ₦10,000 for his WAEC registration. Help me."', [['Send ₦10,000', () => ySpend(10000, 'Transfer to MUMMY', () => { ST.rep += 2; Y.sent += 10000; chat('Mummy ❤️', 'God bless you my child 🙏🏾', '', 'Mummy ❤️'); })], ['"Mummy, the alert never land."', () => { ST.stress = clamp(ST.stress + 4, 0, 100); }]]),
  () => { toast('NEPA took light all night. You slept in heat. Energy −12', 3200); ST.energy = clamp(ST.energy - 12, 0, 100); },
  () => ask('Your phone', 'The screen cracked when it fell from the bed. The phone man at Computer Village says ₦8,000.', [['Fix it (₦8,000)', () => ySpend(8000, 'Phone repair · Computer Village')], ['Manage it like that', () => { ST.stress = clamp(ST.stress + 5, 0, 100); }]]),
  () => ask('Tolu', '"Babe/guy, my birthday is Saturday. Just come with a gift o, nothing much 😌"', [['Send ₦3,000 gift', () => ySpend(3000, 'Transfer to TOLU', () => { ST.rep += 2; })], ['"I go come with prayers"', () => { ST.rep -= 1; }]]),
  () => { if (ST.bg === 'car') ask('Your Corolla', 'The check-engine light is on again. Mechanic says ₦12,000.', [['Fix it', () => ySpend(12000, 'Mechanic · ' + LGN())], ['Ignore the light', () => { ST.stress = clamp(ST.stress + 6, 0, 100); }]]); else ask('Your phone', 'Data finished in the middle of the group chat drama. ₦1,000 for 1.5GB?', [['Buy data', () => ySpend(1000, 'Airtime & data')], ['Beg for hotspot at PPA', () => { ST.rep -= 1; }]]); },
  () => { chat('Landlord (Baba Lodge)', 'Good morning corper. Remember light bill is ₦2,500 this month. Thank you.', '', 'Baba Lodge'); ySpend(2500, 'Light bill · Corper Lodge', null, true); },
  () => { chat('Chioma (CDS Sec)', 'Hello! We are contributing ₦1,000 each for the CDS project (borehole signage). Pay before Thursday 🙏🏾', '', 'Chioma (CDS Sec)'); ask('CDS contribution', 'Pay ₦1,000 now? Some people are asking where last month\'s money went.', [['Pay', () => ySpend(1000, 'CDS project contribution', () => { ST.rep += 1; })], ['"Abeg show us the receipt first"', () => { ST.infoPlug = (ST.infoPlug || 0) + 1; ST.rep -= 1; }]]); },
  () => { toast('Aunty Kemi sent you a voice note: "Corper, come and teach my son Maths on Saturday, I go pay."', 3600); Y.tutor = true; },
];
function yEvent() { if (Y.kind === 'Pop' || Y.kind === 'Clr' || Y.kind === 'Sat' || DLG || Math.random() < 0.3) return; const e = YEVENTS[(Math.random() * YEVENTS.length) | 0]; Y.events.push(e.name || 'event'); e(); }
function ySpend(n, label, then, force) {
  if (ST.cash < n && !force) { toast('Insufficient funds. Your account is shy.'); return false; }
  ST.txn = label; ST.cash -= n; Y.spent += n; hudSync(); if (ST.cash < 0) { Y.debt += -ST.cash; ST.stress = clamp(ST.stress + 6, 0, 100); } if (then) then(); return true;
}
function ySaturday() {
  const opts = [
    [`Tutor Aunty Kemi's son (+${naira(Math.round(5000 * PF().hustle / 500) * 500)}, −20 energy)`, () => { if (ST.energy < 20) return toast('You are too tired. Rest first.'); const pay = Math.round(5000 * PF().hustle / 500) * 500; ST.txn = 'AUNTY KEMI · lesson'; ST.cash += pay; Y.earned += pay; Y.hustled++; ST.energy = clamp(ST.energy - 20, 0, 100); hudSync(); toast('Two hours of fractions. The boy finally gets it. +' + naira(pay), 3200); }],
    ['Buy aso-ebi for Seyi\'s sister\'s wedding (₦15,000)', () => ySpend(15000, 'Aso-ebi · Balogun', () => { Y.aso++; ST.rep += 3; ST.stress = clamp(ST.stress - 8, 0, 100); toast('You danced, you sprayed, you ate jollof. Worth it. Mostly.', 3200); })],
    ['Rest at home all day (+energy, −stress)', () => { ST.energy = clamp(ST.energy + 25, 0, 100); ST.stress = clamp(ST.stress - 10, 0, 100); toast('You slept till 1 PM. No regrets.', 2600); }],
  ];
  if (ST.bg === 'hustler') opts.unshift(['Run your POS stand at the bus stop (+₦3,000–₦7,000)', () => { const a = Math.round(pick([3000, 4500, 7000]) * PF().hustle / 500) * 500; ST.txn = 'POS charges · Corper Close'; ST.cash += a; Y.earned += a; Y.hustled++; ST.energy = clamp(ST.energy - 15, 0, 100); hudSync(); toast(`Busy day at the POS stand. +${naira(a)}`, 2800); }]);
  const tok = Y.month * 100 + Y.di;
  setTimeout(() => Y.month * 100 + Y.di === tok && Y.kind === 'Sat' && !Y.done && ask('Saturday', 'What are you doing with your day?', opts.map(([l, f]) => [l, () => { if (Y.month * 100 + Y.di !== tok) return; f(); Y.done = true; setObj('Sleep at your lodge to end the day'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; $('arrow').style.display = 'block'; }])), 5200);
}
function yInteractables() {
  const L = [], P = player.o.position;
  L.push({ x: LODGE.x, z: LODGE.z, label: Y.kind === 'Pop' ? 'Your room (POP is today!)' : Y.done ? 'Sleep (end the day)' : 'Sleep early (skip the day)', act: ySleep });
  if (Y.kind === 'Mon' && !Y.signed) { const sp = PKIND() === 'school' ? { x: SCH.x + 15, z: -24 } : WORK[PKIND()].spots.sign; L.push({ x: sp.x, z: sp.z, label: 'Sign the staff attendance book', act: ySignPPA }); }
  if (Y.kind === 'Mon' && Y.signed && !Y.done) for (const j of (Y.jobs || [])) { const J = PPA_JOBS[j]; L.push({ x: J.at().x, z: J.at().z, label: J.label, act: J.act }); }
  if (Y.kind === 'Thu' && !Y.signed && Math.hypot(P.x - (LGA.x + 9), P.z + 14) < 12) L.push({ x: LGA.x + 9, z: -12.4, label: Y.cdsOff ? 'Ask the security man about CDS' : 'Sign the CDS register', act: ySignCDS });
  if (Y.kind === 'Clr' && !Y.done) L.push({ x: LGA.x, z: -12.4, label: Y.inQ ? `Wait for your name (${Y.queue} before you)` : 'Join the clearance queue', act: yClearance });
  if (Y.kind === 'Pop' && !Y.done && Math.hypot(P.x - LGA.x, P.z - LGA.z) < 20) L.push({ x: LGA.x, z: -12.4, label: 'Take your place at the parade', act: yPOP });
  return L;
}
// PPA jobs: three are on offer each Monday
const ENGQ = [
  ['Choose the correct sentence.', ['He doesn\'t know the answer.', 'He don\'t know the answer.', 'He doesn\'t knows the answer.']],
  ['Which word is spelt correctly?', ['Accommodation', 'Acommodation', 'Accomodation']],
  ['The plural of "furniture" is…', ['furniture', 'furnitures', 'furnitur']],
  ['Pick the correct one: "Each of the boys ___ a book."', ['has', 'have', 'are having']],
  ['Opposite of "generous"?', ['stingy', 'kind', 'rich']],
  ['"I have been waiting since two hours" is wrong. The correct word is…', ['for', 'from', 'by']],
];
function engLesson() {
  for (const s of SCH.students) s.hidden = false; let i = 0, ok = 0; const qs = ENGQ.slice().sort(() => Math.random() - .5).slice(0, 3);
  player.o.position.set(SCH.spots.board.x + 1.2, 0.14, SCH.spots.board.z); player.o.rotation.y = 0; cam.yaw = 0.35; cam.pitch = 0.28; cam.tdist = 8;
  const next = () => {
    if (i >= qs.length) return yPPADone(ok >= 2 ? 3 : 0, ok >= 2 ? 'English class went well. Nobody said "I don\'t know it" today.' : 'The pupils taught you some new pidgin instead.');
    const [q, opts] = qs[i]; drawBoard([`Q${i + 1}. ${q}`.slice(0, 44), ''], `JSS 2 · English · ${ok} of ${i} correct`);
    ask(`English · Question ${i + 1} of 3`, q + ' A boy at the back shouts an answer. Which one do you write on the board?', opts.map(o => [o, () => o]).sort(() => Math.random() - .5).map(([o]) => [o, () => { const good = o === opts[0]; if (good) ok++; for (const s of SCH.students) { play(s, good ? 'agree' : 'argue'); setTimeout(() => play(s, 'sit'), 1600); } toast(good ? 'Correct. The class copies it down.' : `Hmm. The answer was "${opts[0]}".`, 1800); i++; setTimeout(next, 1700); }]));
  };
  next();
}
const PPA_JOBS = {
  maths: { label: 'Teach JSS 2A Maths (3 questions)', at: () => SCH.spots.board, act: () => { for (const s of SCH.students) s.hidden = false; startLesson(ok => yPPADone(ok >= 2 ? 3 : 0, ok >= 2 ? 'The class went well.' : 'Rough class. Next week is another chance.'), 3); } },
  english: { label: 'Teach JSS 2A English (3 questions)', at: () => SCH.spots.board, act: engLesson },
  marking: { label: 'Mark JSS 1 exercise books', at: () => ({ x: SCH.x + 12.6, z: -26.9 }), act: () => yMarking() },
  printer: { label: 'See ' + PRN() + ' about the printer', at: () => SCH.spots.principal, act: () => yPrinter() },
  invigilate: { label: 'Invigilate the SS 2 test (Block B)', at: () => ({ x: SCH.x + 11.5, z: -32.6 }), act: () => ask('SS 2 · Biology test', 'Twenty minutes in, you notice a boy with tiny notes folded inside his calculator cover. His friend is whispering answers.', [
    ['Seize the notes quietly, let him continue', () => yPPADone(3, 'Fair and calm. ' + TCH() + ' nods at you from the corridor.')],
    ['Shout and send both of them out', () => yPPADone(1, 'The class is now terrified of you. Order restored, sort of.')],
    ['Pretend you did not see', () => yPPADone(-1, 'Half the class now has the same answers. The teacher will notice.')],
  ]) },
  assembly: { label: 'Lead morning assembly (flagpole)', at: () => ({ x: SCH.x + 4, z: -16.8 }), act: () => ask('Morning assembly', 'The pupils line up under the sun, JSS 1 in front, SS 3 pretending not to be there. ' + PRN() + ' hands you the microphone. "Corper, talk to them small."', [
    ['Talk about punctuality and respect', () => yPPADone(2, 'Short, clear, done. The principal looks proud.')],
    ['Tell them about your camp days and frog jumps', () => yPPADone(3, 'The pupils laugh and clap. Now everybody calls you "Corper Frog".')],
    ['Read the anthem lyrics slowly with them', () => yPPADone(2, 'Loud anthem, straight lines. The flag looks happy.')],
  ]) },
};
// health centre and office jobs for service-year Mondays
Object.assign(PPA_JOBS, {
  c_triage: { kind: 'clinic', label: 'Help triage the morning queue', at: () => WORK.clinic.spots.triage, act: () => { const r = TRIAGE[(Math.random() * TRIAGE.length) | 0].slice().sort(() => Math.random() - .5); ask('Waiting area', 'Who goes in first?', r.map(([t, sc]) => [t, () => yPPADone(sc === 2 ? 3 : 0, sc === 2 ? 'Danger signs first. The nurse nods.' : 'The nurse re-orders the queue. Look for danger signs.')])); } },
  c_immun: { kind: 'clinic', label: 'Run the immunisation register', at: () => WORK.clinic.spots.immun, act: () => ask('Immunisation day', 'Forty-two babies, one register, and one mother who says her baby already took "this injection" at another place but has no card.', [['Check the child health card system and ask the nurse', () => yPPADone(3, 'No double dose, no missed dose. Clean register.')], ['Just give it again to be safe', () => yPPADone(-1, 'The nurse stops you. Never guess with vaccines.')], ['Send her home', () => yPPADone(0, 'She leaves without the vaccine. The nurse calls her back.')]]) },
  c_talk: { kind: 'clinic', label: 'Give the morning health talk', at: () => WORK.clinic.spots.talk, act: () => ask('Health talk', 'Thirty mothers on the benches. Pick today\'s topic.', [['Handwashing and ORS for diarrhoea', () => yPPADone(3, 'Practical and clear. Two mothers ask for ORS packets.')], ['Sleeping under treated mosquito nets', () => yPPADone(3, 'Everybody nods. Malaria is everybody\'s enemy.')], ['Your camp drill stories', () => yPPADone(0, 'They laugh, but nobody learned anything.')]]) },
  c_records: { kind: 'clinic', label: 'Sort the patient cards', at: () => WORK.clinic.spots.records, act: () => yPPADone(2, 'Two hundred cards in alphabetical order. Your back is now a senior citizen.') },
  o_report: { kind: 'office', label: 'Check the weekly figures', at: () => WORK.office.spots.desk, act: () => { const a = 40 + ((Math.random() * 60) | 0), b = 30 + ((Math.random() * 60) | 0); ask('Weekly report', `Mon ${a} + Tue ${b} customers. What should the total say?`, [String(a + b), String(a + b + 10), String(a * 2)].sort(() => Math.random() - .5).map(o => [o, () => yPPADone(+o === a + b ? 3 : 0, +o === a + b ? 'Correct. Report sent before 10 AM.' : `It was ${a + b}. Your supervisor fixed it.`)])); } },
  o_customer: { kind: 'office', label: 'Attend to the angry customer at the front desk', at: () => WORK.office.spots.front, act: () => ask('Front desk', '"Since morning I have been waiting! Is this how you treat customers?!"', [['Apologise, take his details, and get him seen in 10 minutes', () => yPPADone(3, 'He leaves smiling. He even asks for your name.')], ['"Oga, everybody is waiting too."', () => yPPADone(0, 'He asks for your manager. Your manager asks for you.')], ['Hide in the toilet', () => yPPADone(-1, 'You come back. He is still there. Angrier.')]]) },
  o_minutes: { kind: 'office', label: 'Take minutes at the staff meeting', at: () => WORK.office.spots.meet, act: () => ask('Staff meeting', 'Ninety minutes. Three topics. One person talks for sixty of the minutes.', [['Write clear action points with names and dates', () => yPPADone(3, 'Your minutes go round the whole office. "Who wrote this?"')], ['Write everything word for word', () => yPPADone(1, 'Eleven pages. Nobody reads it.')], ['Scroll the group chat under the table', () => yPPADone(-1, 'You missed the part where they assigned you a task.')]]) },
  o_printer: { kind: 'office', label: 'Fix the printer again', at: () => WORK.office.spots.printer, act: () => yPPADone(2, 'Paper jam, toner shake, off and on. You are the printer whisperer.') },
});
function ySignPPA() {
  Y.signed = true; Y.late = ST.mins > 8 * 60; if (Y.late) Y.lates++;
  ask(PKIND() === 'school' ? TCH() : 'Front desk', Y.late ? '"Corper, it is past eight. ' + BOSS() + ' has drawn the red line under your name."' : '"Good morning! You are early today. Sign there."', [['"Good morning ma."', () => { if (Y.late) { ST.rep -= 1; ST.stress = clamp(ST.stress + 4, 0, 100); } setObj('PPA jobs today: ' + Y.jobs.map(j => PPA_JOBS[j].label.split(' (')[0]).join(' · ')); ST.target = null; $('arrow').style.display = 'none'; }]]);
}
function yPPADone(rep, msg) {
  for (const s of SCH.students) s.hidden = true;
  Y.done = true; Y.ppaDays++; ST.rep += rep; ST.energy = clamp(ST.energy - 12, 0, 100); ST.mins = Math.max(ST.mins, 14 * 60); setTOD('Afternoon');
  toast(msg + ' PPA day done ✅', 3000); setObj('Go home and rest at your lodge'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; $('arrow').style.display = 'block';
}
function yMarking() {
  const a = 4 + ((Math.random() * 5) | 0), b = 3 + ((Math.random() * 6) | 0), wrong = Math.random() < 0.5, w = wrong ? a * b + pick([-2, 2, 10]) : a * b;
  ask('Exercise book · Chiamaka, JSS 1B', `Q4: ${a} × ${b} = ${w}. Is it correct?`, [['✔ Mark it right', () => yPPADone(wrong ? 0 : 2, wrong ? `You missed it: ${a} × ${b} is ${a * b}. ${TCH()} noticed.` : 'Forty books marked. Your red pen is dying.')], ['✘ Mark it wrong', () => yPPADone(wrong ? 2 : 0, wrong ? 'Correct. Forty books marked.' : `It was right. Chiamaka will cry tomorrow.`)]]);
}
function yPrinter() {
  ask('' + PRN() + '', '"Corper, this printer is not printing the exam questions. You young people know these things."', [
    ['Check the cable and paper tray', () => yPPADone(2, 'The paper was jammed. You are now the school\'s IT department.')],
    ['"Sir, it needs a new cartridge (₦6,000)"', () => { ask('' + PRN() + '', '"Ehn… pay for it, the school will refund you." (It will not.)', [['Pay ₦6,000', () => ySpend(6000, 'Printer cartridge · ' + LGN(), () => yPPADone(3, 'The printer works. The refund will come "next month".'))], ['"Sir, I don\'t have money"', () => yPPADone(0, 'He sighs and calls the bursar.')]]); }],
  ]);
}
function ySignCDS() {
  if (Y.cdsOff) { toast('Security man: "No CDS today o. Check your LGI channel." You came for nothing.', 3600); Y.signed = true; Y.done = true; ST.stress = clamp(ST.stress + 3, 0, 100); setObj('Go home'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; return; }
  const late = ST.mins > 10 * 60;
  if (late) { Y.signed = true; Y.done = true; Y.cdsMiss++; ST.rep -= 2; ask('DFQC CDS President', '"Register closed at 10. I will mark you absent."', [['"Ah, traffic…"', () => { setObj('Go home'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; $('arrow').style.display = 'block'; }]]); return; }
  Y.signed = true; Y.done = true; Y.cdsDays++; ST.rep += 2; ST.energy = clamp(ST.energy - 8, 0, 100); ST.mins = Math.max(ST.mins, 12 * 60);
  toast(pick(['Sensitisation at a junior secondary school. You talked about drug abuse to 200 teenagers.', 'Sanitation round the Secretariat. Thumbprint, register, done.', 'Group meeting. Forty minutes about the CDS project budget. Register signed.']) + ' ✅', 4200);
  setObj('Go home and rest'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; $('arrow').style.display = 'block';
}
function yClearance() {
  if (!Y.inQ) { Y.inQ = true; toast(`A man with a file: "You are number ${Y.queue}. Stay around."`, 3000); return; }
  toast(`${Y.queue} people still before you. Gist, buy pure water, check the group.`, 2400);
}
function yUpdate(dt) {
  if (!Y.on || !player) return;
  if (Y.kind === 'Clr' && Y.inQ && !Y.done) {
    const near = Math.hypot(player.o.position.x - LGA.x, player.o.position.z - LGA.z) < 20; Y.qt = (Y.qt || 0) + dt * (near ? 1 : 0.3);
    if (Y.qt > 1.5) { Y.qt = 0; Y.queue--; ST.mins += 5; setObj(`Clearance queue: ${Math.max(0, Y.queue)} before you`); }
    if (Y.queue <= 0) {
      if (!near) { Y.queue = 3; toast('They called your name while you were away! Back of the line!', 3200); ST.stress = clamp(ST.stress + 6, 0, 100); return; }
      Y.done = true; Y.cleared = (Y.cleared || 0) + 1; ST.txn = 'NYSC allowance · FGN'; ST.cash += 77000; Y.earned += 77000; ST.stress = clamp(ST.stress - 10, 0, 100); hudSync();
      chat('Naija Trust Bank', `Credit alert: ₦77,000.00 · NYSC allowance. Bal: ${naira(ST.cash)}`, 'off');
      setTimeout(() => { ySpend(PF().rent, 'Rent · Corper Lodge (Baba Lodge)', null, true); chat('Landlord (Baba Lodge)', `Thank you corper. I have collected this month's rent ${naira(PF().rent)}. God bless.`, '', 'Baba Lodge'); }, 3500);
      toast('Thumbprint. Cleared ✅ +₦77,000', 4200); setObj('Go home'); ST.target = { x: LODGE.x, z: LODGE.z, label: 'Your lodge' }; $('arrow').style.display = 'block';
    }
  }
  if (!Y.done && !Y.dusk && ST.mins > 19 * 60 && Y.kind !== 'Sat' && Y.kind !== 'Pop') { Y.dusk = true; setTOD('Evening'); setObj('It is late. Go home and sleep.'); }
}
function ySleep() {
  if (Y.kind === 'Pop' && !Y.done) return toast('Sleep?! Today is your POP! Get to the Secretariat ground.', 3000);
  const missed = !Y.done && Y.kind !== 'Sat';
  const go = () => {
    if (missed) {
      if (Y.kind === 'Mon') { Y.ppaMiss++; ST.rep -= 2; chat('' + PRN() + '', 'Corper, you did not come to school today. I am writing it in your monthly clearance letter.', '', '' + PRN() + ''); }
      if (Y.kind === 'Thu' && !Y.cdsOff) { Y.cdsMiss++; ST.rep -= 3; ST.queried = true; chat('LGI (Official)', 'Corps members absent from CDS today will be queried.', 'off'); }
      if (Y.kind === 'Clr') { Y.clrMiss++; ST.stress = clamp(ST.stress + 15, 0, 100); chat('LGI (Official)', 'Corps members who did not clear this month will not receive their allowance.', 'off'); }
    }
    if (Y.kind === 'Clr') { Y.month++; Y.di = 0; } else Y.di++;
    yMorning();
  };
  if (missed) ask('Your room', Y.kind === 'Mon' ? 'You never went to school today. Sleep anyway?' : Y.kind === 'Thu' ? (Y.cdsOff ? 'CDS was cancelled anyway. Sleep?' : 'You skipped CDS. The register remembers. Sleep anyway?') : 'You never cleared. No clearance, no allowance. Sleep anyway?', [['Sleep', go], ['Not yet', () => { }]]);
  else go();
}
function yPOP() {
  Y.done = true;
  cine('PASSING OUT PARADE', 'Khaki starched. Boots shining. The LGI calls your name.', () => { setTOD('Afternoon'); ST.mins = 11 * 60; }, 3200).then(() => {
    const exempt = Y.ppaMiss + Y.cdsMiss + Y.clrMiss <= 1;
    chat('Mummy ❤️', 'Congratulations my Ex-corper!!! 🎉🎉 Send me picture', '', 'Mummy ❤️'); confettiBurst(); bugle();
    toast(exempt ? 'Certificate of National Service collected 🎓' : 'The LGI says your certificate is delayed until your extension is served. Omo.', 5200);
    setTimeout(() => showSummary(3), 4800);
  });
}
function confettiBurst() { tone(523, .12, 'sine', .06); tone(659, .12, 'sine', .06, .12); tone(784, .2, 'sine', .06, .24); }
function yearType() {
  if (Y.ppaMiss + Y.cdsMiss + Y.clrMiss >= 4) return ['THE EXTENSION CANDIDATE', 'Between the missed CDS, the missed PPA days and that one clearance… the LGI has your file on her desk.'];
  if (Y.hustled >= 3) return ['THE SIDE-HUSTLE MINISTER', 'Tutoring, POS, data business. The ₦77k was just a bonus.'];
  if (Y.sent >= 20000) return ['THE FAMILY BREADWINNER', 'Half of your allowance went home. Mummy tells everyone at church about you.'];
  if (Y.aso >= 2) return ['THE OWAMBE CORPER', 'Every Saturday, a new aso-ebi. Your wardrobe is a rainbow. Your account is not.'];
  if (Y.cdsDays >= 5 && Y.ppaDays >= 5) return ['THE PPA LEGEND', 'Never missed PPA, never missed CDS. The principal wants to retain you.'];
  if ((ST.infoPlug || 0) >= 3) return ['THE INFORMATION PLUG', 'You checked before you trusted. The group chat now waits for your confirmation.'];
  return ['THE "I JUST WANT POP" CORPER', 'Head down, attendance up, no wahala. And now: POP.'];
}
window.__year = { Y, startYear, yMorning, ySleep, ySignPPA, ySignCDS, yClearance, yPOP, yInteractables, yMarking, yPrinter };

/* ---------------- boot ---------------- */
async function boot() {
  const bar = $('lbar'), msg = $('lmsg'); let done = 0; const step = (t) => { done++; bar.style.width = (done / 6 * 100) + '%'; msg.textContent = t; };
  try {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), sk = new Sky(); sk.scale.setScalar(1000); for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'sunPosition']) sk.material.uniforms[k].value = sky.material.uniforms[k].value; es.add(sk); scene.environment = pm.fromScene(es, 0, 0.1, 2000).texture; step('Lighting the street…');
  } catch (e) { step('Lighting (fallback)…'); }
  let extra = []; try { const r = await fetch('models/extra.json'); if (r.ok) extra = await r.json(); } catch (e) { }
  SND.tracks = ['audio/afrobeat1.mp3', 'audio/afrobeat2.mp3', 'audio/afrobeat3.mp3'];
  for (const [k, url] of Object.entries(OPTIONAL)) { try { if (extra.includes(k)) { const gl = await loadGLB(url); const s = gl.scene; s.traverse(m => { if (m.isMesh) { m.castShadow = true; } }); const b = new THREE.Box3().setFromObject(s), sz = b.getSize(new THREE.Vector3()); const L = { danfo: 5, keke: 2.8, car: 4.7 }[k]; const sc = L / Math.max(sz.x, sz.z); s.scale.setScalar(sc); const w = new THREE.Group(); s.position.y = -b.min.y * sc; s.position.x = -(b.min.x + b.max.x) / 2 * sc; s.position.z = -(b.min.z + b.max.z) / 2 * sc; w.add(s); if (sz.z > sz.x) w.rotation.y = Math.PI / 2; w.rotation.y += FLIP[k]; realModels[k] = w; window.__modelInfo = window.__modelInfo || {}; window.__modelInfo[k] = { size: sz.toArray().map(v => +v.toFixed(2)), scale: +sc.toFixed(4) }; } } catch (e) { } }
  traffic.forEach(applyReal);
  const [m2, lew, fem] = await Promise.all([loadGLB('models/man2.gltf.json'), loadGLB('models/lewis.gltf.json'), loadGLB('models/fem.gltf.json')]); step('Waking up the people…');
  const hOf = s => { s.updateMatrixWorld(true); let top = null, foot = null; const v = new THREE.Vector3(); s.traverse(o => { if (/HeadTop_End$/.test(o.name)) top = o.getWorldPosition(v.clone()); if (/LeftToe_End$|LeftToeBase$/.test(o.name) && !foot) foot = o.getWorldPosition(v.clone()); }); if (top) return top.y - Math.min(0, foot ? foot.y : 0); const b = new THREE.Box3().setFromObject(s); return b.max.y - b.min.y; };
  const byName = (gl, n) => gl.animations.find(a => a.name.toLowerCase() === n.toLowerCase());
  const C2 = n => byName(m2, n); // Lewis shares man2's 'mixamorig4' bone names, so these play on both
  RIGS.man2 = { scene: m2.scene, height: hOf(m2.scene), clips: { idle: C2('idle'), walk: C2('walk'), run: C2('run'), talk: C2('talk'), agree: C2('talk'), argue: C2('argue'), text: C2('text'), type: C2('type'), wave: C2('wave'), sit: C2('sit') } };
  RIGS.lewis = { scene: lew.scene, height: hOf(lew.scene), clips: { idle: byName(lew, 'idle'), walk: byName(lew, 'walk'), run: byName(lew, 'run'), talk: byName(lew, 'talk'), agree: byName(lew, 'talk'), argue: C2('argue'), text: C2('text'), type: C2('type'), wave: C2('wave'), sit: C2('sit') } };
  RIGS.fem = { scene: fem.scene, height: hOf(fem.scene), clips: { idle: byName(fem, 'idle'), walk: byName(fem, 'walk'), run: byName(fem, 'run'), talk: byName(fem, 'talk'), agree: byName(fem, 'talk') } };
  for (const g of [m2, lew, fem]) g.scene.traverse(m => { if (m.isMesh) m.material.roughness = Math.max(0.6, m.material.roughness ?? 1); });
  if (BAKE) return bakeAll(m2, lew, fem, byName, C2);
  // pre-baked: retargeted clips and recoloured outfits (tools: open index.html#bake)
  const [CL, TI] = await Promise.all([fetch('models/clips.json').then(r => r.json()), fetch('models/tex/index.json').then(r => r.json())]); step('Dressing everyone…');
  for (const [rig, cs] of Object.entries(CL)) for (const [k, j] of Object.entries(cs)) RIGS[rig].clips[k] = unpackClip(j);
  const T = {}, TL = new THREE.TextureLoader();
  await Promise.all(TI.map(n => TL.loadAsync('models/tex/' + n + '.jpg').then(t => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, ANISO); T[n] = t; })));
  step('Ready');
  return T;
}
function unpackClip(j) { // int16 quaternions, uniform frames (see tools/bake.js)
  const tracks = j.tracks.map(([name, b64]) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    const q = new Int16Array(u.buffer), n = q.length / 4, times = new Float32Array(n), vals = new Float32Array(q.length);
    for (let i = 0; i < n; i++) times[i] = Math.min(j.duration, i * j.step / 30); times[n - 1] = j.duration; for (let i = 0; i < q.length; i++) vals[i] = q[i] / 32767;
    return new THREE.QuaternionKeyframeTrack(name, times, vals); });
  return new THREE.AnimationClip(j.name, j.duration, tracks);
}
// Offline bake (open index.html#bake in a desktop browser or the headless tool): recolour outfits, retarget clips.
async function bakeAll(m2, lew, fem, byName, C2) {
  const [mic, xb] = await Promise.all([loadGLB('bake/Michelle.gltf.json'), loadGLB('bake/Xbot.gltf.json')]);
  const SAMBA = byName(mic, 'SambaDance'), CL = { fem: {}, lewis: {}, man2: {} };
  for (const k of ['argue', 'text', 'type', 'wave', 'sit']) CL.fem[k] = retarget(C2(k), m2.scene, fem.scene);
  CL.fem.dance = retarget(SAMBA, mic.scene, fem.scene); CL.lewis.dance = retarget(SAMBA, mic.scene, lew.scene); CL.man2.dance = retarget(SAMBA, mic.scene, m2.scene);
  const imgOf = (sc, re) => { let im; sc.traverse(m => { if (m.isMesh && m.material.map && !/hair/i.test(m.material.name) && (!re || re.test(m.name))) im = m.material.map.image; }); return im; };
  const lewImg = imgOf(lew.scene), m2Img = imgOf(m2.scene, /Body$/), fImg = imgOf(fem.scene);
  const M2 = partMask(m2.scene, m2Img.width, m2Img.height), MF = partMask(fem.scene, fImg.width, fImg.height);
  const KHAKI = [0.62, 0.56, 0.4], WH = [0.96, 0.96, 0.94], WH2 = [0.95, 0.95, 0.93];
  const F = (skin, cols) => recolorParts(fImg, MF, skin, cols);
  const T = {
    corperF: F(SKIN[1], { Shirt: KHAKI, Pants: KHAKI, Heels: [0.12, 0.1, 0.09] }),
    civF1: F(SKIN[0], {}), civF2: F(SKIN[3], { Shirt: [0.55, 0.15, 0.45], Pants: [0.12, 0.12, 0.14] }), civF3: F(SKIN[4], { Shirt: [0.1, 0.45, 0.35], Pants: [0.8, 0.7, 0.5] }),
    civF4: F(SKIN[2], { Shirt: [0.85, 0.35, 0.12], Pants: [0.2, 0.25, 0.4] }),
    whiteF: F(SKIN[1], { Shirt: WH, Pants: WH2, Heels: WH }), whiteF2: F(SKIN[3], { Shirt: WH, Pants: WH2, Heels: WH }),
    fPupil: F(SKIN[3], { Shirt: WH, Pants: [0.15, 0.5, 0.28], Heels: [0.1, 0.1, 0.1] }),
    fTeacher: F(SKIN[2], { Shirt: [0.6, 0.2, 0.3], Pants: [0.15, 0.15, 0.2] }),
    mCorper: recolorParts(m2Img, M2, SKIN[3], { Shirt: WH2, Pants: KHAKI }), mCorper2: recolorParts(m2Img, M2, SKIN[1], { Shirt: WH2, Pants: KHAKI }),
    mSuit: recolorParts(m2Img, M2, SKIN[0], {}), mCiv1: recolorParts(m2Img, M2, SKIN[2], { Shirt: [0.2, 0.35, 0.65], Pants: [0.25, 0.25, 0.28] }), mCiv2: recolorParts(m2Img, M2, SKIN[4], { Shirt: [0.85, 0.5, 0.15], Pants: [0.2, 0.28, 0.45] }),
    lCorper: recolorOutfit(lewImg, SKIN[0], [0.93, 0.93, 0.9], KHAKI), lCorper2: recolorOutfit(lewImg, SKIN[2], [0.93, 0.93, 0.9], KHAKI), lCorper3: recolorOutfit(lewImg, SKIN[4], [0.93, 0.93, 0.9], KHAKI),
    lCiv1: recolorOutfit(lewImg, SKIN[1], [0.75, 0.2, 0.18], [0.15, 0.2, 0.35]), lCiv2: recolorOutfit(lewImg, SKIN[3], [0.95, 0.85, 0.4], null), lCiv3: recolorOutfit(lewImg, SKIN[2], [0.3, 0.55, 0.35], [0.35, 0.3, 0.25]), lCiv4: recolorOutfit(lewImg, SKIN[4], null, null), police: recolorOutfit(lewImg, SKIN[4], [0.16, 0.22, 0.36], [0.07, 0.07, 0.09]),
    lMufti: recolorOutfit(lewImg, SKIN[0], [0.2, 0.45, 0.75], [0.15, 0.2, 0.35]), lWhite: recolorOutfit(lewImg, SKIN[0], WH, WH2),
    lWhite2: recolorOutfit(lewImg, SKIN[2], WH, WH2), lWhite3: recolorOutfit(lewImg, SKIN[4], WH, WH2),
    mWhite: recolorParts(m2Img, M2, SKIN[1], { Shirt: WH, Pants: WH2 }), mArmy: recolorParts(m2Img, M2, SKIN[4], { Shirt: [0.33, 0.38, 0.22], Pants: [0.3, 0.34, 0.2] }),
    mOfficial: recolorParts(m2Img, M2, SKIN[2], { Shirt: [0.97, 0.97, 0.95], Pants: [0.2, 0.2, 0.22] }),
    lPupil: recolorOutfit(lewImg, SKIN[2], WH, [0.12, 0.38, 0.2]), lPupil2: recolorOutfit(lewImg, SKIN[0], WH, [0.12, 0.38, 0.2]),
    mPrincipal: recolorParts(m2Img, M2, SKIN[4], { Shirt: [0.9, 0.85, 0.7], Pants: [0.25, 0.22, 0.2], Coat: [0.35, 0.28, 0.2] }),
    mTeacher: recolorParts(m2Img, M2, SKIN[1], { Shirt: [0.75, 0.8, 0.9], Pants: [0.22, 0.22, 0.26] }),
  };
  { // camp whites: white shorts + white canvas shoes
    const LM = legMask(lew.scene, lewImg.width, lewImg.height), FM = legMask(fem.scene, fImg.width, fImg.height), XM = legMask(m2.scene, m2Img.width, m2Img.height);
    applyShorts(T.lWhite, LM, SKIN[0]); applyShorts(T.lWhite2, LM, SKIN[2]); applyShorts(T.lWhite3, LM, SKIN[4]);
    applyShorts(T.whiteF, FM, SKIN[1]); applyShorts(T.whiteF2, FM, SKIN[3]); applyShorts(T.mWhite, XM, SKIN[1]);
  }
  // the player's own outfits in three skin tones (loaded on demand by the character creator)
  const PT = {}, LMp = legMask(lew.scene, lewImg.width, lewImg.height), FMp = legMask(fem.scene, fImg.width, fImg.height);
  [SKIN[3], SKIN[0], SKIN[4]].forEach((sk, i) => {
    PT[`m_mufti_${i}`] = recolorOutfit(lewImg, sk, [0.2, 0.45, 0.75], [0.15, 0.2, 0.35]); PT[`m_khaki_${i}`] = recolorOutfit(lewImg, sk, [0.93, 0.93, 0.9], KHAKI);
    PT[`m_white_${i}`] = applyShorts(recolorOutfit(lewImg, sk, WH, WH2), LMp, sk);
    PT[`f_mufti_${i}`] = F(sk, {}); PT[`f_khaki_${i}`] = F(sk, { Shirt: KHAKI, Pants: KHAKI, Heels: [0.12, 0.1, 0.09] });
    PT[`f_white_${i}`] = applyShorts(F(sk, { Shirt: WH, Pants: WH2, Heels: WH }), FMp, sk);
  });
  for (const [rig, cs] of Object.entries(CL)) Object.assign(RIGS[rig].clips, cs);
  const BIG = ['lMufti', 'lWhite', 'lCorper', 'civF1', 'whiteF', 'corperF'];
  window.__bake = () => ({
    clips: Object.fromEntries(Object.entries(CL).map(([r, cs]) => [r, Object.fromEntries(Object.entries(cs).map(([k, c]) => [k, THREE.AnimationClip.toJSON(c)]))])),
    ptex: Object.fromEntries(Object.entries(PT).map(([k, t]) => [k, t.image.toDataURL('image/jpeg', 0.88)])),
    tex: Object.fromEntries(Object.entries(T).map(([k, t]) => { const s = BIG.includes(k) ? 512 : 512, c = document.createElement('canvas'); c.width = c.height = s; c.getContext('2d').drawImage(t.image, 0, 0, s, s); return [k, c.toDataURL('image/jpeg', 0.86)]; })),
  });
  return T;
}

let streetSpawned = false;
function spawnStreet(T = TEX) {
  if (streetSpawned) return; streetSpawned = true;
  // pedestrians walking the sidewalks
  const civ = ['lCiv1', 'mCiv1', 'lCiv3', 'civF1', 'civF2', 'mSuit', 'civF3', 'lCorper2', 'mCiv2', 'civF1', 'lCiv4', 'corperF', 'mCorper'];
  for (let i = 0; i < Math.round((TOUCH ? 12 : 26) * PF().crowd); i++) {
    const tk = civ[i % civ.length], f = /F/.test(tk), m2r = tk[0] === 'm';
    const p = makePerson(f ? 'fem' : m2r ? 'man2' : 'lewis', { tex: m2r ? undefined : T[tk], parts: m2r ? { tex: T[tk], hide: tk === 'mSuit' ? [] : ['Coat'] } : undefined, h: f ? rnd(1.58, 1.72) : rnd(1.7, 1.86), anim: 'walk' });
    const side = Math.random() < .5 ? -1 : 1;
    p.lineZ = side * rnd(8.5, 10.4); p.dir = Math.random() < .5 ? -1 : 1; p.sp = rnd(1.15, 1.45); p.walkScale = p.sp / 1.3; p.wait = 0; p.mode = 'walk';
    p.o.position.set(rnd(-PLAY, PLAY), 0.18, p.lineZ); p.o.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    p.acts.walk.time = rnd(0, 1); people.push(p);
  }
  N('lewis', T.lCiv1, BUSSTOP_X + 3.2, 8.2, -Math.PI / 2, { anim: 'talk', bubble: ['Secretariat! Secretariat!', 'Enter with your change o!', 'Secretariat! Secretariat! Enter quick!', 'One chance remain!'], conductor: true });
  N('fem', T.corperF, -36, 9.6, Math.PI / 2, {
    name: 'Tolu', talk: {
      label: 'Talk to Tolu (fellow corper)', act() {
        play(this, 'agree'); setTimeout(() => play(this, 'idle'), 2200);
        if (ST.phase === 0) { toast('Tolu: "Have you checked the group? Something about clearance."', 3200); return; }
        toast('Tolu: "Danfo dey stop for Corper Close B/Stop, ₦300. Or trek — e no far, like 120 metres."', 4200);
      }
    }
  }).talk.act = function () { const t = NPC.find(n => n.name === 'Tolu'); play(t, 'wave'); setTimeout(() => play(t, 'idle'), 2600); if (ST.phase === 0) toast('Tolu: "Have you checked the group? Something about clearance."', 3200); else toast('Tolu: "Danfo dey stop for Corper Close bus stop, ₦300. Or trek — e no far, like 120 metres."', 4200); };
  for (const dx of [-2.4, 2.4]) N('lewis', T.police, LGA.x + dx, -10.6, 0, {});
  NPC[NPC.length - 1].talk = { label: 'Ask the security man', act() { toast('Security: "Corper, clearance is inside, Hall B. Join the queue, no dulling."', 3600); } };
  // queue of corpers at the secretariat
  for (let i = 0; i < Math.max(3, Math.round((TOUCH ? 8 : 14) * (PF().queue / 16))); i++) { const f = i % 3 === 0, m2r = i % 3 === 2; const p = N(f ? 'fem' : m2r ? 'man2' : 'lewis', f ? T.corperF : m2r ? (i % 2 ? T.mCorper : T.mCorper2) : [T.lCorper, T.lCorper2, T.lCorper3][i % 3], LGA.x - 7 + (i % 7) * 1.0, -16.5 - Math.floor(i / 7) * 1.1 + rnd(-.15, .15), Math.PI + rnd(-.3, .3), {}); p.acts.idle.time = rnd(0, 2); if (i % 2 === 1) { play(p, 'text', 0); p.acts.text.time = rnd(0, 20); } }
  // two corpers arguing about the rumour, by the gate
  N('man2', T.mCorper2, LGA.x - 8, -9.4, Math.PI / 2, { anim: 'argue', bubble: ['Who said no clearance without CDS card?!', 'Na rumour! LGI never talk am!', 'Abeg show me the official post!'] });
  const a2 = N('lewis', T.lCorper3, LGA.x - 6.8, -9.4, -Math.PI / 2, { anim: 'argue' }); a2.acts.argue.time = 6;
  // a man sitting at the bus stop, scrolling his phone life away
  N('man2', T.mSuit, BUSSTOP_X - 1.2, 10.85, Math.PI, { anim: 'sit', coat: true });
  // a waving friend across the road
  N('lewis', T.lCiv2, 20, -9.6, 0.2, { anim: 'wave', bubble: ['Corper! How far?', 'You don collect alert?'] });
  // a dancer by the buka speaker, because Lagos
  const dz = N('fem', T.civF2, 46, 9.8, -Math.PI / 2.5, {}); play(dz, 'dance', 0);
  // ---- PPA school people ----
  SCH.seats.slice(0, TOUCH ? 10 : 16).forEach((st, i) => { const f = i % 2 === 1; const p = N(f ? 'fem' : 'lewis', f ? T.fPupil : (i % 4 ? T.lPupil : T.lPupil2), st.x, st.z, Math.PI, { anim: 'sit' }); p.o.scale.multiplyScalar(f ? 0.84 : 0.76); p.o.position.y = 0.14; SCH.students.push(p); });
  { const pr = N('man2', T.mPrincipal, SCH.spots.principal.x - 1.7, SCH.spots.principal.z, Math.PI / 2, { coat: true, anim: 'talk', bubble: ['Corper, punctuality is the soul of business!', 'Where is my JSS2 teacher?'] }); pr.name = 'Adebayo'; }
  for (const t of SCH.teachers) { const p = N(t.rig, T[t.tex], t.x, t.z, t.r, { anim: t.anim, name: t.name }); p.o.position.y = t.anim === 'sit' ? 0.02 : 0.02; p.talk = { label: 'Greet ' + t.name, act() { play(p, 'wave'); setTimeout(() => play(p, t.anim), 2400); toast(t.name + ': ' + pick(ST.ppa >= 4 ? ['"Corper, well done today. The children like you."', '"Don\'t mind the principal, he likes you."', '"Have you eaten? There is puff-puff at the tuck shop."'] : ['"You are the new corper? Welcome o."', '"' + PRN() + ' is in his office, by the gate."', '"JSS2 have been without a Maths teacher since January."']), 3600); } }; }
  // pupils in the yard and at the tuck shop
  [[SCH.spots.tuck.x - 1, SCH.spots.tuck.z + 0.9, 'lPupil', 'talk'], [SCH.spots.tuck.x + 0.6, SCH.spots.tuck.z + 1.2, 'fPupil', 'idle'], [SCH.x + 1.5, -21, 'lPupil2', 'argue'], [SCH.x + 2.4, -21.6, 'fPupil', 'talk'], [SCH.x - 4, -24, 'lPupil', 'wave']].forEach(([x, z, tk, an], i) => { const f = /^f/.test(tk); const p = N(f ? 'fem' : 'lewis', T[tk], x, z, rnd(0, 6), { anim: an }); p.o.scale.multiplyScalar(f ? 0.84 : 0.78); p.o.position.y = 0.02; });
  { const v = N('fem', T.civF2, SCH.spots.tuck.x, SCH.spots.tuck.z - 1.6, 0, { anim: 'idle', bubble: ['Puff-puff! Zobo! Gala!', 'Corper, buy something now!'] }); v.o.position.y = 0.02; }
  drawBoard(['Good morning, class!', 'Today: Word problems'], 'JSS 2 · Mathematics');
  { // the health centre: matron at reception, nurses, mothers and babies on the benches
    const c = WORK.clinic, sp = c.spots, cx = 72, cz = 17.4;
    const m = N('fem', T.fTeacher, sp.boss.x, sp.boss.z + 0.9, Math.PI, { anim: 'idle' }); m.o.position.y = 0.02; c.staff.push(m);
    m.talk = { label: 'Greet the matron', act() { play(m, 'wave'); setTimeout(() => play(m, 'idle'), 2400); toast(BOSS() + ': ' + pick(['"Corper, wash your hands before you touch anything."', '"Thursday is immunisation. Come early."', '"We need more hands, not more forms."']), 3400); } };
    const n1 = N('fem', T.whiteF2, cx + 0.5, cz + 0.2, -Math.PI / 2, { anim: 'talk', bubble: ['Next patient!', 'Mama, where is your card?', 'Sit down, we will call you.'] }); n1.o.position.y = 0.02; c.staff.push(n1);
    [[cx + 1.6, cz - 3.2, 'civF2'], [cx + 3.4, cz - 3.2, 'civF3'], [cx + 2.2, cz - 1.0, 'mCiv2'], [cx + 3.8, cz + 1.2, 'civF4'], [cx + 1.4, cz + 1.2, 'mCiv1']].slice(0, Math.max(2, Math.round(5 * PF().crowd))).forEach(([x, z, tk], i) => { const f = /F/.test(tk), p = N(f ? 'fem' : 'man2', T[tk], x, z + 0.32, Math.PI, { anim: 'sit' }); p.o.position.y = 0.0; });
  }
  { // the office: manager, colleagues typing, someone at the printer
    const o = WORK.office, sp = o.spots, cx = 29, cz = -17.8;
    const b = N('man2', T.mSuit, sp.boss.x + 1.0, sp.boss.z - 0.6, -Math.PI / 2, { coat: true, anim: 'talk' }); b.o.position.y = 0.02; o.staff.push(b);
    b.talk = { label: 'Greet ' + 'your supervisor', act() { toast(BOSS() + ': ' + pick(['"Corper, the report is due at 12."', '"Have you sent that email?"', '"Good morning. Coffee is not free o."']), 3400); } };
    for (const [dx, dz, tk, an] of [[-5.5, 1.2, 'mCiv1', 'type'], [0.5, 1.2, 'civF1', 'type'], [-2.5, -1.8, 'lCiv3', 'type'], [0.5, -1.8, 'civF3', 'text']]) { const f = /F/.test(tk), p = N(f ? 'fem' : tk[0] === 'm' ? 'man2' : 'lewis', T[tk], cx + dx, cz + dz, Math.PI, { anim: an }); p.o.position.y = 0.02; o.staff.push(p); }
    const pr = N('fem', T.civF2, sp.printer.x - 0.4, sp.printer.z - 0.8, 0.6, { anim: 'argue', bubble: ['Who used the last paper?!', 'This printer has a spirit.', 'Corper, abeg come and see this thing.'] }); pr.o.position.y = 0.02;
  }
  window.__merged2 = 0;
}
function N(rig, tex, x, z, ry, extra = {}) { return (() => { const p = makePerson(rig, rig === 'man2' ? { parts: { tex, hide: extra.coat ? [] : ['Coat'] }, h: 1.8, anim: extra.anim || 'idle' } : { tex, h: rig === 'fem' ? 1.65 : 1.8, anim: extra.anim || 'idle' }); p.o.position.set(x, 0.18, z); p.o.rotation.y = ry; Object.assign(p, extra); NPC.push(p); people.push(p); p.static = true; return p; })(); }

function spawnWorld(T, gender) {
  TEX = T; ST.g = gender;
  player = makePerson(gender === 'f' ? 'fem' : 'lewis', { tex: T.p_mufti || (gender === 'f' ? T.civF1 : T.lMufti), h: gender === 'f' ? 1.66 : 1.78, npc: false });
  { const b = BACKGROUNDS.find(b => b[0] === CH.bg) || BACKGROUNDS[0]; Object.assign(ST, b[3]); ST.bg = b[0]; ST.name = CH.name || 'Corper'; ST.tone = CH.tone; ST.state = CH.state || 'LA'; ST.course = CH.course || 'education'; }
  for (const m of player.meshes) { m.castShadow = true; m.frustumCulled = false; }
  player.o.position.set(-3, 0.02, CZ + 63); player.o.rotation.y = Math.PI; player.speed = 0; ST.outfit = 'mufti'; cam.yaw = 0;
  for (const v of traffic) v.g.visible = false;
  // ---- camp people ----
  const CN = (rig, tex, x, z, ry, extra = {}) => { const p = N(rig, tex, x, z, ry, extra); p.area = 'camp'; p.o.position.y = 0.02; return p; };
  CAMP.gateNPC = CN('man2', T.mArmy, -1.5, CZ + CAMP_HALF + 2.4, 0, { talk: null, bubble: ['Corper! Where is your call-up letter?'] });
  CN('man2', T.mArmy, 6.6, CZ + CAMP_HALF + 2.0, -0.3, { anim: 'idle' });
  CAMP.dayOne = []; for (const x of [-15, -12, -8.5, -5.5]) { const o = CN('man2', T.mOfficial, x, CZ + 39.6, 0, { anim: 'type' }); CAMP.dayOne.push(o); if (x === -12) CAMP.deskNPC = o; }
  for (let i = 0; i < (TOUCH ? 6 : 10); i++) { const f = i % 3 === 0; CAMP.dayOne.push(CN(f ? 'fem' : 'lewis', f ? T.civF2 : [T.lCiv1, T.lCiv3, T.lCiv2][i % 3], -8 + (i % 2 ? 0.4 : -0.4), CZ + 43 + i * 0.95, Math.PI, { anim: i % 2 ? 'text' : 'idle' })); }
  CAMP.leavers = [];
  for (let i = 0; i < (TOUCH ? 8 : 14); i++) { const a = rnd(-1.2, 1.2), rr = rnd(1.6, 4.2), f = i % 3 === 0, m2r = i % 3 === 2; const p = CN(f ? 'fem' : m2r ? 'man2' : 'lewis', f ? T.corperF : m2r ? (i % 2 ? T.mCorper : T.mCorper2) : [T.lCorper, T.lCorper2, T.lCorper3][i % 3], CAMP.spots.notice.x + Math.sin(a) * rr, CAMP.spots.notice.z + Math.cos(a) * rr, Math.PI + a * 0.4, { anim: pick(['text', 'argue', 'idle', 'wave', 'talk']), bubble: i === 0 ? [`${SNAME()}! I'm staying in ${SNAME()}!`, 'Who is going to Ikeja?', 'They posted me to Kano 😭'] : undefined }); p.hidden = true; CAMP.leavers.push(p); }
  CAMP.kitNPC = CN('lewis', T.lCiv4, CAMP.spots.kit.x + 1.2, CAMP.spots.kit.z - 1.5, -Math.PI / 2, { anim: 'talk', bubble: ['Next! Next!'] });
  CAMP.marshal = CN('man2', T.mArmy, 0, CZ - 19, 0, { bubble: ['Platoon 5, fall in!'] }); CAMP.marshal.o.position.y = 1.15;
  for (let r0 = 0; r0 < 4; r0++) for (let c0 = 0; c0 < 5; c0++) { const x = CAMP.slot.x - 2 * 1.4 + c0 * 1.4, z = CAMP.slot.z + (r0 - 1) * 1.6; if (Math.abs(x - CAMP.slot.x) < .1 && Math.abs(z - CAMP.slot.z) < .1) continue; const f = (r0 + c0) % 4 === 0, m2r = (r0 + c0) % 3 === 0; const p = CN(f ? 'fem' : m2r ? 'man2' : 'lewis', f ? T.whiteF : m2r ? T.mWhite : [T.lWhite2, T.lWhite3][c0 % 2], x, z, Math.PI); p.o.position.y = 0.12; p.hidden = true; CAMP.formation.push(p); }
  // vendors at mammy market
  CAMP.spots.market.forEach((m, i) => { const f = i % 2 === 0; CN(f ? 'fem' : 'lewis', f ? T.civF3 : T.lCiv2, m.x + 1.6, m.z + 1.2, -Math.PI / 2, { anim: f ? 'idle' : 'talk' }); });
  // corpers wandering around camp in whites
  const wt = ['lWhite2', 'whiteF', 'lWhite3', 'mWhite', 'whiteF2', 'lWhite2'];
  for (let i = 0; i < (TOUCH ? 8 : 16); i++) { const tk = wt[i % wt.length], f = /F/.test(tk), m2r = tk[0] === 'm'; const p = makePerson(f ? 'fem' : m2r ? 'man2' : 'lewis', { tex: m2r ? undefined : T[tk], parts: m2r ? { tex: T[tk], hide: ['Coat'] } : undefined, h: f ? rnd(1.58, 1.72) : rnd(1.7, 1.86), anim: 'walk' }); const w0 = pick(CAMP_WP); p.o.position.set(w0.x + rnd(-3, 3), 0.02, w0.z + rnd(-3, 3)); p.wander = true; p.sp = rnd(1.1, 1.4); p.walkScale = p.sp / 1.3; p.mode = 'wait'; p.wait = rnd(0, 4); p.area = 'camp'; people.push(p); }
  // social night crowd (only visible at night)
  CAMP.crowd = [];
  for (let i = 0; i < (TOUCH ? 8 : 14); i++) { const f = i % 2 === 0; const p = CN(f ? 'fem' : 'lewis', f ? T.whiteF : T.lWhite2, -18 + rnd(-5, 5), CZ - 37 + rnd(0, 6), Math.PI + rnd(-.4, .4), { anim: f ? 'dance' : 'wave' }); p.hidden = true; CAMP.crowd.push(p); }
  const mc = CN('fem', T.civF2, -18, CZ - 43.5, 0, { anim: 'dance', bubble: ['Make some noise for Platoon 5!', 'Who get the energy?!', 'DJ, play Afrobeats!'] }); mc.o.position.y = 1.2; mc.hidden = true; CAMP.crowd.push(mc);
  // night in Hostel B: not everybody is a party person. Some sleep, some gist, one is charging a phone.
  CAMP.hostelNight = [];
  for (const [x, z, top, tk] of [[-44.9, 7.2, 1, 'lWhite2'], [-39.1, 4.6, 0, 'lWhite3'], [-39.1, 9.8, 1, 'lWhite'], [-44.9, 25.4, 0, 'lWhite2'], [-39.1, 28.0, 0, 'lWhite3'], [-44.9, 30.6, 1, 'lWhite']].slice(0, TOUCH ? 4 : 6)) {
    const p = CN('lewis', T[tk], x + 0.85, CZ + z, 0, { anim: 'idle' }); p.o.rotation.set(-Math.PI / 2, x < -42 ? Math.PI / 2 : Math.PI / 2, 0, 'YXZ'); p.o.position.y = (top ? 1.49 : 0.59) + 0.1; p.acts.idle.timeScale = 0.3; p.hidden = true; p.sleeper = true; CAMP.hostelNight.push(p); }
  { const g1 = CN('lewis', T.lWhite2, -42.3, CZ + 16.2, Math.PI, { anim: 'talk', bubble: ['Omo, this camp food ehn… my stomach is doing drill.', 'Who get charger? My phone don die.', 'Tomorrow parade by 5 o. Sleep early!'] }); g1.hidden = true; CAMP.hostelNight.push(g1);
    const g2 = CN('man2', T.mWhite, -42.0, CZ + 14.8, 0.2, { anim: 'argue' }); g2.hidden = true; CAMP.hostelNight.push(g2);
    const g3 = CN('fem', T.whiteF2, -41.4, CZ + 15.6, -Math.PI / 2, { anim: 'talk', bubble: ['Abeg who off the light?!', 'Platoon 5 will win the dance tomorrow, watch.'] }); g3.hidden = true; CAMP.hostelNight.push(g3);
    const g4 = CN('lewis', T.lWhite3, -40.3, CZ + 22.2, -Math.PI / 2, { anim: 'text' }); g4.hidden = true; CAMP.hostelNight.push(g4); }
  const ch = CN('fem', T.whiteF2, 4, CZ + 47, Math.PI, { name: 'Chioma' });
  ch.talk = { label: 'Talk to Chioma (fellow corper)', act() { play(ch, 'wave'); setTimeout(() => play(ch, 'idle'), 2600); toast(['Chioma: "Registration queue is moving slowly. Have your passport photos ready."', 'Chioma: "Don\'t buy the first bucket you see. Mama Chidinma is cheaper."', 'Chioma: "If you can\'t dance, at least clap for Platoon 5 tonight!"'][Math.min(2, Math.max(0, ST.cstep - 1))], 4200); } };
  // the danfo waiting outside the gate
  for (const bx of [-14, -26]) { const bus = danfo(); if (realModels.danfo) { bus.g.children.forEach(c => c.visible = false); bus.g.add(realModels.danfo.clone()); } bus.g.position.set(bx, 0, CZ + 65.5); scene.add(bus.g); }
  { const bus = danfo(); if (realModels.danfo) { bus.g.children.forEach(c => c.visible = false); bus.g.add(realModels.danfo.clone()); } bus.g.position.set(CAMP.busSpot.x + 3, 0, CAMP.busSpot.z + 1.5); scene.add(bus.g); }
  setGroup('Platoon 5 · Camp Gist');
  campGo(0); setTOD('Morning');
  window.__merged = mergeStatic();
  window.__G = { ST, player, people, traffic, NPC, colliders, interact, phone, phShow, chat, interactables, cam, LGA, board, CAMP, CZ, RIGS, WORK };
}

/* ---------------- maps: corner minimap + the phone's Map app (pan, zoom, pins, routes) ---------------- */
const POIS = {
  camp: () => [['🚧', 'Camp gate', CAMP.spots.gate, '#5d4037'], ['📝', 'Registration', CAMP.spots.desk, '#1565c0'], ['🎽', 'Kit store', CAMP.spots.kit, '#6a1b9a'], ['🛏️', 'Hostel B', CAMP.spots.hostel, '#00695c'], ['🪖', 'Parade ground', { x: 0, z: CZ }, '#33691e'], ['🎤', 'Stage', CAMP.spots.stage, '#ad1457'], ['🛍️', 'Mammy market', CAMP.spots.market[2], '#ef6c00'], ['📋', 'Notice board', CAMP.spots.notice, '#455a64'], ['🏥', 'Camp clinic', CAMP.spots.clinic, '#c62828'], ['🎓', 'SAED hall', CAMP.spots.hall, '#4527a0'], ['🚌', 'Bus park', CAMP.busSpot, '#f9a825']],
  street: () => [['🏠', 'Home · Corper Lodge', LODGE.door || LODGE, '#00695c'], ['🚌', 'Corper Close Bus Stop', { x: BUSSTOP_X, z: 9 }, '#f9a825'], ['🏛️', 'LGA Secretariat', { x: LGA.x, z: -10 }, '#1565c0'], ['🧹', 'CDS ground', { x: LGA.x + 9, z: -14 }, '#6a1b9a'], ['🏫', PKIND() === 'school' ? PPANAME().slice(0, 30) + ' (PPA)' : 'Model School', SCH.gate, '#c62828'], ['🏥', PKIND() === 'clinic' ? PPANAME().slice(0, 30) + ' (PPA)' : 'Health centre', WORK.clinic.door, '#00897b'], ['🏢', PKIND() === 'office' ? PPANAME().slice(0, 30) + ' (PPA)' : 'Office complex', WORK.office.door, '#283593'], ['🛒', 'Mama Tolani Provisions', shopSpots.find(s => /TOLANI/.test(s.name)) || { x: 0, z: 9 }, '#ef6c00'], ['🍛', 'Buka & speaker', { x: 46, z: 9.4 }, '#ad1457'], ['⛱️', 'Umbrella stall', vendorSpots[0], '#455a64']],
};
const MAPV = { cx: 0, cz: 0, R: 70, follow: true, sel: null };
function routePts(P, T) { // walking route: along the sidewalk, cross where you need to
  if (ST.area !== 'street') return [P, T];
  const sp = P.z >= 0 ? 9.6 : -9.6, st = T.z >= 0 ? 9.6 : -9.6, pts = [{ x: P.x, z: P.z }];
  if (Math.abs(P.z) > 11) pts.push({ x: P.x, z: sp });
  pts.push({ x: T.x, z: sp }); if (sp !== st) pts.push({ x: T.x, z: st }); pts.push({ x: T.x, z: T.z }); return pts;
}
function routeLen(P, T) { const r = routePts(P, T); let d = 0; for (let i = 1; i < r.length; i++) d += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z); return d; }
function drawMap(g, W, H, cx, cz, R, full) {
  const k = W / (R * 2), X = x => W / 2 + (x - cx) * k, Z = z => H / 2 + (z - cz) * k, camp = ST.area === 'camp';
  const rect = (x0, z0, x1, z1, fill, stroke, lw = 1) => { g.beginPath(); g.rect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  const label = (t, x, z, size = 11, col = '#5f6368', bold = '600') => { g.font = `${bold} ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(t, X(x), Z(z)); g.fillStyle = col; g.fillText(t, X(x), Z(z)); };
  g.clearRect(0, 0, W, H); g.fillStyle = camp ? '#cfe3bd' : '#eceef1'; g.fillRect(0, 0, W, H);
  if (!camp) {
    rect(-HALF, -60, HALF, -11.4, '#f4efe4'); rect(-HALF, 11.4, HALF, 60, '#f4efe4'); // plots behind the sidewalks
    rect(SCH.x - 21, -41.6, SCH.x + 21, -11.6, '#fdf1c9', '#e2c877', 1.5); rect(LGA.x - 18, -44, LGA.x + 18, -11.6, '#dcebfb', '#9dbfe6', 1.5); rect(64, 11.7, 80, 23.1, '#d7f0ea', '#86c7b8', 1.5); rect(20.5, -23.8, 37.5, -11.8, '#e3e6f5', '#9fa8da', 1.5);
    rect(-HALF, -11.4, HALF, -7.8, '#dfe2e6'); rect(-HALF, 7.8, HALF, 11.4, '#dfe2e6'); // sidewalks
    rect(-HALF, -7.2, HALF, 7.2, '#b9c0c9'); rect(-HALF, -6.6, HALF, 6.6, '#ffffff'); // road with casing
    g.strokeStyle = '#f2c94c'; g.lineWidth = Math.max(1, k * 0.3); g.setLineDash([k * 3, k * 3]); g.beginPath(); g.moveTo(0, Z(0)); g.lineTo(W, Z(0)); g.stroke(); g.setLineDash([]);
  } else {
    rect(-CAMP_HALF, CZ - CAMP_HALF, CAMP_HALF, CZ + CAMP_HALF, '#dcebcb');
    rect(-CAMP_HALF - 40, CZ + CAMP_HALF + 5, CAMP_HALF + 40, CZ + CAMP_HALF + 15, '#ffffff', '#b9c0c9'); // road outside the gate
    rect(-22, CZ - 15, 22, CZ + 15, '#c9c6ba', '#a8a596'); rect(-4, CZ + 15, 4, CZ + CAMP_HALF, '#ead9bd'); rect(-36, CZ + 16, 36, CZ + 22, '#ead9bd'); rect(-22, CZ - 36, -14, CZ - 15, '#ead9bd');
  }
  for (const c of colliders) { // building footprints and walls
    if (c.x1 < cx - R * 1.2 || c.x0 > cx + R * 1.2 || c.z1 < cz - R * 1.5 || c.z0 > cz + R * 1.5) continue;
    const w = c.x1 - c.x0, d = c.z1 - c.z0; if (Math.min(w, d) < 1.2) { rect(c.x0, c.z0, c.x1, c.z1, '#a9b0ba'); continue; }
    rect(c.x0, c.z0, c.x1, c.z1, camp ? '#f3ede0' : '#d9dde3', camp ? '#b9ad95' : '#b7bdc7', 1);
  }
  if (full) {
    if (!camp) { for (let x = Math.ceil((cx - R) / 70) * 70; x < cx + R; x += 70) label('C O R P E R   C L O S E   R O A D', x + 35, 3.4, Math.max(8, Math.min(12, k * 2.6)), '#8a9099', '500'); label('Model School', SCH.x, -30, 11, '#a17800'); label('Health centre', 72, 17.4, 11, '#00796b'); label('Offices', 29, -17.8, 11, '#283593'); label('Local Govt. Secretariat', LGA.x, -30, 11, '#1a5fb4');
      if (k > 3.2) for (const s of shopSpots) if (Math.abs(s.x - cx) < R) label(s.name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).slice(0, 22), s.x, s.z + (s.side > 0 ? 5 : -5), 9, '#7a8088', '500'); }
    else { label('PARADE GROUND', 0, CZ, 10, '#77735f'); label('Camp road', 0, CZ + CAMP_HALF + 10, 10, '#8a9099', '500'); }
  }
  const P = player.o.position, T0 = ST.target;
  if (T0) { const r = routePts(P, T0); g.lineJoin = g.lineCap = 'round'; for (const [col, lw] of [['#ffffff', full ? 8 : 5], ['#1a73e8', full ? 5 : 3]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); r.forEach((p, i) => i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))); g.stroke(); } }
  const pl = POIS[ST.area] ? POIS[ST.area]() : []; MAPV.hit = []; const used = []; if (MAPV.sel) pl.sort((a, b) => (b[1] === MAPV.sel) - (a[1] === MAPV.sel));
  for (const [ic, n, p, col] of pl) { if (!p) continue; const x = X(p.x), y = Z(p.z), sel = MAPV.sel === n, r = full ? (sel ? 15 : 12) : 4;
    if (full) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + r + 4, r * 0.6, 3, 0, 0, 7); g.fill(); }
    g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = full ? 2.5 : 1.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    if (full) { g.font = `${sel ? 16 : 13}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(ic, x, y + 1); g.font = `${sel ? 700 : 600} 11px system-ui, sans-serif`; const tw = g.measureText(n).width / 2 + 4, bx = { x0: x - tw, x1: x + tw, y0: y + r + 2, y1: y + r + 16 }; if (!used.some(u => u.x0 < bx.x1 && u.x1 > bx.x0 && u.y0 < bx.y1 && u.y1 > bx.y0)) { used.push(bx); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.95)'; g.strokeText(n, x, y + r + 9); g.fillStyle = '#202124'; g.fillText(n, x, y + r + 9); } MAPV.hit.push({ n, p, x, y }); } }
  if (T0) { const x = X(T0.x), y = Z(T0.z); g.fillStyle = '#ea4335'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, full ? 7 : 5, 0, 7); g.fill(); g.stroke(); }
  const a = player.o.rotation.y, px = X(P.x), py = Z(P.z); // you: blue dot with a heading cone
  g.save(); g.translate(px, py); g.rotate(-a + Math.PI); const cr = full ? 26 : 18, gr = g.createRadialGradient(0, 0, 2, 0, 0, cr); gr.addColorStop(0, 'rgba(26,115,232,.55)'); gr.addColorStop(1, 'rgba(26,115,232,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, cr, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#1a73e8'; g.strokeStyle = '#fff'; g.lineWidth = full ? 3 : 2; g.beginPath(); g.arc(px, py, full ? 7 : 5, 0, 7); g.fill(); g.stroke();
}
let mapT = 0;
function mapOpen() { return $('phone').classList.contains('on') && PH.screen === 'map'; }
function updateMaps(dt) {
  mapT -= dt; if (mapT > 0 || !player) return; mapT = mapOpen() ? 0.1 : 0.25;
  const P = player.o.position, mm = $('minimap'); if (mm) drawMap(mm.getContext('2d'), mm.width, mm.height, P.x, P.z, 42, false);
  if (mapOpen()) { if (MAPV.follow) { MAPV.cx = P.x; MAPV.cz = ST.area === 'camp' ? P.z : clamp(P.z, -14, 14); } const c = $('pmapc'), g = c.getContext('2d'); g.save(); g.scale(2, 2); drawMap(g, c.width / 2, c.height / 2, MAPV.cx, MAPV.cz, MAPV.R, true); g.restore(); }
}
function mapSheet(n, p) {
  MAPV.sel = n; const sh = $('pmapsheet'), P = player.o.position, d = Math.round(routeLen(P, p)), walkMin = Math.max(1, Math.round(d / 75)), street = ST.area === 'street' && d >= 18;
  sh.innerHTML = `<b>${n}</b><small>${d} m away · about ${walkMin} min on foot</small><div class="modes"><button data-m="walk">🚶🏾 Trek<i>Free</i></button>${street ? `<button data-m="keke">🛺 Keke<i>${naira(200)}</i></button><button data-m="car">🚗 Ride app<i>${naira(1500)}</i></button>${ST.bg === 'car' ? `<button data-m="own">🚙 Your car<i>Fuel ${naira(300)}</i></button>` : ''}` : ''}</div>`;
  sh.hidden = false; for (const b of sh.querySelectorAll('button')) b.onclick = () => { sh.hidden = true; travelGo(b.dataset.m, { x: p.x, z: p.z }, n); };
}
function mapList() {
  const pl = POIS[ST.area] ? POIS[ST.area]() : [], P = player.o.position;
  $('pmapl').innerHTML = pl.map(([ic, n, p], i) => `<button data-i="${i}">${ic} ${n} <small>${Math.round(routeLen(P, p))} m</small></button>`).join('');
  [...$('pmapl').children].forEach((b, i) => b.onclick = () => { const [, n, p] = pl[i]; MAPV.follow = false; MAPV.cx = p.x; MAPV.cz = ST.area === 'camp' ? p.z : clamp(p.z, -14, 14); mapSheet(n, p); $('pmap').scrollTop = 0; mapT = 0; });
}
{ // map gestures: drag to pan, tap a pin, buttons to zoom and recentre
  const c = $('pmapc'); let d0 = null, moved = 0;
  c.addEventListener('pointerdown', e => { d0 = { x: e.clientX, y: e.clientY }; moved = 0; try { c.setPointerCapture(e.pointerId); } catch (er) { } });
  c.addEventListener('pointermove', e => { if (!d0) return; const s = (MAPV.R * 2) / c.clientWidth, dx = e.clientX - d0.x, dy = e.clientY - d0.y; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { MAPV.follow = false; MAPV.cx -= dx * s; MAPV.cz -= dy * s; mapT = 0; } d0 = { x: e.clientX, y: e.clientY }; });
  c.addEventListener('pointerup', e => { if (d0 && moved <= 6) { const r = c.getBoundingClientRect(), sx = (c.width / 2) / r.width, x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sx; let best = null, bd = 26; for (const h of MAPV.hit || []) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } } if (best) mapSheet(best.n, best.p); else { $('pmapsheet').hidden = true; MAPV.sel = null; } mapT = 0; } d0 = null; });
  $('mzin').onclick = () => { MAPV.R = Math.max(18, MAPV.R / 1.4); mapT = 0; }; $('mzout').onclick = () => { MAPV.R = Math.min(140, MAPV.R * 1.4); mapT = 0; }; $('mzme').onclick = () => { MAPV.follow = true; mapT = 0; };
}
$('pmapbtn').onclick = () => phShow(PH.screen === 'map' ? (thr(ST.group || 'Platoon 5 · Camp Gist').msgs.length ? 'thread' : 'home') : 'map');
for (const b of document.querySelectorAll('#phome [data-app]')) b.onclick = () => phShow(b.dataset.app);
/* ---------------- update loop ---------------- */
const clock = new THREE.Clock(); let tAcc = 0, chatT = 0, story = 0;
const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function collide(pos, r = 0.35) {
  for (const c of colliders) {
    const nx = clamp(pos.x, c.x0, c.x1), nz = clamp(pos.z, c.z0, c.z1), dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; } else { // inside: push out on shortest axis
        const ox = Math.min(pos.x - c.x0, c.x1 - pos.x), oz = Math.min(pos.z - c.z0, c.z1 - pos.z); if (ox < oz) pos.x = pos.x - c.x0 < c.x1 - pos.x ? c.x0 - r : c.x1 + r; else pos.z = pos.z - c.z0 < c.z1 - pos.z ? c.z0 - r : c.z1 + r; } }
  }
  if (ST.area === 'camp') { pos.x = clamp(pos.x, -70, 70); pos.z = clamp(pos.z, CZ - CAMP_HALF + 0.5, CZ + 70); } else { pos.x = clamp(pos.x, -PLAY, PLAY); pos.z = clamp(pos.z, -44, 30); }
}
function updatePlayer(dt) {
  if (ST.riding || ST.busy) return;
  if (ST.drill) { play(player, 'idle', .3); return; }
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  const wantRun = keys.ShiftLeft || keys.ShiftRight || runToggle, run = wantRun && ST.energy > 8;
  if (wantRun && !run && !ST.tiredMsg) { ST.tiredMsg = true; toast('Too tired to run. Buy food, drink water or rest to get energy back.', 3600); setTimeout(() => ST.tiredMsg = false, 9000); }
  const o = player.o;
  if (l > 0.08) {
    const fw = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), rt = new THREE.Vector3(-fw.z, 0, fw.x);
    const dir = rt.multiplyScalar(ix).add(fw.multiplyScalar(-iz)).normalize();
    const sp = (run ? 4.6 : 1.6) * Math.min(1, l * 1.2);
    o.position.addScaledVector(dir, sp * dt);
    const want = Math.atan2(dir.x, dir.z); let d = want - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * 10);
    play(player, run ? 'run' : 'walk', .2); player.acts.walk.timeScale = sp / 1.5;
    ST.energy = clamp(ST.energy + dt * (run ? -0.22 : 0.05), 0, run ? 100 : Math.max(ST.energy, 60));
  } else { play(player, 'idle', .3); if (ST.energy < 60) ST.energy = Math.min(60, ST.energy + dt * 0.12); }
  collide(o.position);
  if (ST.area === 'camp') { o.position.y = (Math.abs(o.position.x) < 22 && Math.abs(o.position.z - CZ) < 15) ? 0.12 : 0.02; return; }
  o.position.y = Math.abs(o.position.z) > 7.8 ? 0.18 : (Math.abs(o.position.z) > 7.0 ? 0.02 : 0);
  // traffic danger
  for (const v of traffic) {
    const dx = o.position.x - v.x, dz = o.position.z - LANES[v.lane].z;
    if (Math.abs(dx) < v.len / 2 + 0.3 && Math.abs(dz) < 1.15 && v.v > 2) {
      const s = Math.sign(dz) || 1; o.position.z = LANES[v.lane].z + s * 1.3; ST.stress = clamp(ST.stress + 8, 0, 100); ST.energy = clamp(ST.energy - 4, 0, 100);
      toast(pick(['Danfo almost jammed you! 😱 "Your papa get road?!"', 'Keke driver: "Corper, you wan die?!"', '"Use your eyes o!" — your heart is beating.']), 2600); horn(2); v.v *= 0.3;
    }
  }
}
function updateTraffic(dt) {
  for (let lane = 0; lane < 2; lane++) {
    const L = LANES[lane], vs = traffic.filter(v => v.lane === lane).sort((a, b) => (a.x - b.x) * L.dir);
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i], lead = vs[(i + 1) % vs.length];
      let gap = (lead.x - v.x) * L.dir; if (gap < 0) gap += HALF * 2; gap -= (lead.len + v.len) / 2;
      let target = v.vmax;
      if (gap < 18) target = Math.min(target, Math.max(0, (gap - 2.5) * 0.8));
      // the player in the lane ahead
      if (player && !ST.riding) { const pd = (player.o.position.x - v.x) * L.dir; if (pd > 0 && pd < 14 && Math.abs(player.o.position.z - L.z) < 1.6) { target = Math.min(target, Math.max(0, (pd - 3.5) * 0.9)); if (pd < 11 && (v.honk || 0) <= 0) { horn(pd); v.honk = 2.5; } } }
      // danfo stops
      if (v.kind === 'danfo' && lane === 0) {
        for (const sx of [BUSSTOP_X, LGA.x - 6]) { const d = sx - v.x; if (d > 0 && d < 14 && v.stop <= 0 && v.lastStop !== sx && (sx === BUSSTOP_X ? Math.random() < 1 : v.passenger || Math.random() < .5)) { target = Math.min(target, d * 0.7); if (d < 0.6 || v.v < 0.3) { v.stop = sx === BUSSTOP_X ? 9 : 4; v.lastStop = sx; v.v = 0; if (v.passenger && sx !== BUSSTOP_X) { alight(v); } } } }
      }
      if (v.ride) { const dg = (v.goal - v.x) * L.dir; target = Math.min(target, Math.max(0, dg * 0.8)); if ((dg < 0.8 || v.v < 0.05 && dg < 4) && !v.done) rideArrive(v); }
      if (v.stop > 0) { v.stop -= dt; target = 0; if (v.stop <= 0 && v.passenger === undefined) { } }
      v.honk = (v.honk || 0) - dt;
      v.v += clamp(target - v.v, -9 * dt, 3 * dt);
      v.x += v.v * dt * L.dir;
      if (v.x > HALF) { v.x -= HALF * 2; v.lastStop = null; } if (v.x < -HALF) { v.x += HALF * 2; v.lastStop = null; }
      v.g.position.x = v.x; v.g.position.y = Math.sin(performance.now() / 90 + v.x) * 0.01 * Math.min(1, v.v);
      for (const w of v.wheels) w.rotation.z -= v.v * dt / 0.36;
    }
  }
}
const CAMP_WP = [[0, 30], [-10, 30], [10, 25], [-30, 8], [30, 8], [-30, -25], [30, -25], [0, -30], [-36, 20], [-36, -15], [36, -10], [36, -30], [20, 20], [-20, -10]].map(([x, z]) => ({ x, z: CZ + z }));
const CAMP_EXIT = { x: 0, z: CZ + 62 };
function wanderStep(p, dt) {
  if (p.mode === 'wait') { p.wait -= dt; if (p.wait <= 0) { p.mode = 'walk'; p.goal = pick(CAMP_WP); play(p, 'walk'); } return; }
  if (CAMP.exodus && p.goal !== CAMP_EXIT) { p.goal = CAMP_EXIT; p.mode = 'walk'; play(p, 'walk'); }
  const g = p.goal || (p.goal = pick(CAMP_WP)), dx = g.x - p.o.position.x, dz = g.z - p.o.position.z, d = Math.hypot(dx, dz);
  if (d < 1.2 && g === CAMP_EXIT) { p.hidden = true; p.wander = false; return; }
  if (d < 1.2) { p.mode = 'wait'; p.wait = rnd(2, 8); play(p, Math.random() < .3 ? 'text' : 'idle'); return; }
  p.o.position.x += dx / d * p.sp * dt; p.o.position.z += dz / d * p.sp * dt; const want = Math.atan2(dx, dz); let a = want - p.o.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); p.o.rotation.y += a * Math.min(1, dt * 5);
  p.o.position.y = (Math.abs(p.o.position.x) < 22 && Math.abs(p.o.position.z - CZ) < 15) ? 0.12 : 0.02;
}
function updatePeople(dt) {
  const cp = camera.position;
  for (const p of people) {
    if (p === player) continue;
    const d2 = p.o.position.distanceToSquared(cp), far = d2 > 75 * 75; p.o.visible = !p.hidden && d2 < (TOUCH ? 3000 : 9025);
    const sh = !TOUCH && d2 < 26 * 26; if (sh !== p.sh) { p.sh = sh; for (const m of p.meshes) m.castShadow = sh; }
    if (!p.o.visible) { if (p.wander && !p.hidden) wanderStep(p, dt); continue; }
    const lod = d2 > 900 ? (TOUCH ? 4 : 3) : d2 > 225 && TOUCH ? 2 : 1; p.acc = (p.acc || 0) + dt; p.fr = ((p.fr || 0) + 1) % lod; const mdt = p.fr === 0 ? p.acc : 0; if (mdt) p.acc = 0;
    if (p.wander) { wanderStep(p, dt); if (!far && mdt) p.mixer.update(mdt); continue; }
    if (!p.static) {
      if (p.mode === 'wait') { p.wait -= dt; if (p.wait <= 0) { p.mode = 'walk'; play(p, 'walk'); } }
      else {
        p.o.position.x += p.dir * p.sp * dt;
        // step around the player
        if (player) { const dx = player.o.position.x - p.o.position.x, dz = player.o.position.z - p.o.position.z; if (Math.abs(dx) < 1.4 && Math.abs(dz) < 0.9 && dx * p.dir > 0) p.o.position.z += (dz > 0 ? -1 : 1) * dt * 1.5; else p.o.position.z += (p.lineZ - p.o.position.z) * dt * 0.5; }
        if (Math.abs(p.o.position.x) > PLAY + 6) { p.dir *= -1; p.o.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        if (Math.random() < dt * 0.04) { p.mode = 'wait'; p.wait = rnd(2, 7); play(p, 'idle'); }
      }
    }
    if (!far && mdt) p.mixer.update(mdt);
  }
  if (player) player.mixer.update(dt);
}
const bub = $('bubble'); let bubT = 0, bubI = 0;
function updateUI(dt) {
  // nearest interactable
  nearest = null; let best = 3.4;
  if (player && !ST.riding) for (const it of interactables()) { const d = Math.hypot(it.x - player.o.position.x, it.z - player.o.position.z); if (d < best) { best = d; nearest = it; } }
  const pr = $('prompt'); if (nearest) { pr.style.display = 'block'; $('ptext').textContent = nearest.label; } else pr.style.display = 'none';
  // conductor bubble
  let cd = null, bd = 18; for (const n of NPC) if (n.bubble && player && !n.hidden) { const d = n.o.position.distanceTo(player.o.position); if (d < bd) { bd = d; cd = n; } } bubT -= dt; if (!cd) bub.style.display = 'none';
  if (cd) { tmp.copy(cd.o.position); tmp.y += 2.15; tmp.project(camera); const vis = tmp.z < 1 && cd.o.position.distanceTo(camera.position) < 30;
    if (bubT <= 0) { bubT = 3.2; bubI++; } const btxt = cd.bubble[bubI % cd.bubble.length]; if (btxt !== bub.textContent) { bub.textContent = btxt; cd.said = cd.said || new Set(); if (ST.ready && (ST.drill || (player && cd.o.position.distanceTo(player.o.position) < 6 && !cd.said.has(btxt))) && btxt !== '…' && !DLG && !ST.busy) { cd.said.add(btxt); speak(btxt, cd.rig === 'fem', !!ST.drill); } }
    bub.style.display = vis ? 'block' : 'none'; bub.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; bub.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px'; }
  // objective arrow
  const T0 = ST.target; if (T0 && player && !ST.drill) { const d = Math.round(Math.hypot(T0.x - player.o.position.x, T0.z - player.o.position.z)); const a = Math.atan2(T0.x - player.o.position.x, T0.z - player.o.position.z) - Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw)); const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️']; const k = ((Math.round(-a / (Math.PI / 4)) % 8) + 8) % 8; const tx = `${arrows[k]} ${T0.label} · ${d} m${ST.area === 'street' && d > 18 && !ST.riding ? ' · 🛺 tap to ride' : ''}`; if ($('arrow').textContent !== tx) $('arrow').textContent = tx; }
}
function updateStory(dt) {
  if (ST.area === 'camp') { updateDrill(dt); ST.mins += dt * 0.5; return; }
  yUpdate(dt);
  chatT += dt;
  const script = [
    [3, () => chat(GRP(), 'Guys clearance has started at the Secretariat 🏃🏾‍♂️🏃🏾‍♀️')],
    [9, () => chat('Emeka', 'Is it true? Who has confirmed?')],
    [15, () => chat('Bisi', 'They said bring two passport photographs')],
    [22, () => chat(GRP(), 'Omo I am already on the queue. Number 31 😩')],
    [34, () => chat('Seyi', 'They said no clearance without CDS card. Abeg is it true??')],
    [47, () => chat('LGI (Official)', 'Clearance is ongoing at Hall B till 2pm. Come with your ID card only. Ignore rumours.', 'off')],
  ];
  while (story < script.length && chatT > script[story][0]) script[story++][1]();
  // the queue moves while you're around the secretariat
  if (ST.queue > 0 && player) {
    const near = Math.hypot(player.o.position.x - LGA.x, player.o.position.z - LGA.z) < 20;
    ST.qt = (ST.qt || 0) + dt * (near ? 1 : 0.3);
    if (ST.qt > 1.6) { ST.qt = 0; ST.queue--; ST.mins += 4; setObj(`Queue position ${ST.queue} — stay around the Secretariat`); if (ST.queue === 5) chat('Chioma (CDS Sec)', 'They are calling names from 15 to 25 now o!'); if (!near && ST.queue <= 3) { toast('They called your name while you were away! Hurry back! 🏃🏾'); } }
    if (ST.queue <= 0 && !ST.done) { if (near) { ST.done = true; ST.txn = 'NYSC allowance · FGN'; ST.cash += 77000; ST.stress = clamp(ST.stress - 12, 0, 100); setObj('Cleared ✅  Allowance is on the way'); ST.target = null; $('arrow').style.display = 'none'; toast('Thumbprint captured. Cleared! ✅  Alert: +₦77,000 allowance 🎉', 5000); chat('Naija Trust Bank', 'Credit alert: ₦77,000.00 — NYSC allowance. Bal: ' + naira(ST.cash), 'off'); setTimeout(() => { ppaGo(0); chat('Corper Close Model School', 'Corper, the principal is asking of you. Come to school after clearance.'); }, 5200); tone(523, .15, 'sine', .07); tone(659, .15, 'sine', .07, .15); tone(784, .3, 'sine', .07, .3); } else ST.queue = 1; }
  }
  if (ST.bg === 'hustler' && (ST.hustles || 0) < 5) { ST.hustleT = (ST.hustleT || 0) + dt; if (ST.hustleT > 80) { ST.hustleT = 0; ST.hustles = (ST.hustles || 0) + 1; const amt = pick([1500, 2500, 3000, 4000]); ST.cash += amt; chat(pick(['POS customer', 'Data customer', 'Aunty Kemi']), pick(['I don send the money for the 10GB. Abeg load am now now.', 'Corper, your POS charge too much o. But I don pay.', 'Thanks for the airtime. You be correct person.'])); chat('Naija Trust Bank', `Credit alert: ${naira(amt)}.00 · side hustle. Bal: ${naira(ST.cash)}`, 'off'); } }
  ST.mins += dt * 0.5; ST.stress = clamp(ST.stress + dt * 0.02, 0, 100);
}
function updateCamera(dt) {
  cam.dist += (cam.tdist - cam.dist) * Math.min(1, dt * 8);
  const tgt = ST.riding ? tmp.set(ST.riding.x, 1.4, LANES[ST.riding.lane].z) : tmp.copy(player.o.position).add({ x: 0, y: 1.55, z: 0 });
  camLook.lerp(tgt, Math.min(1, dt * 10));
  const d = ST.riding ? 9 : cam.dist;
  camPos.set(camLook.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, camLook.y + Math.sin(cam.pitch) * d, camLook.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
  camPos.y = Math.max(camPos.y, 0.6);
  camera.position.copy(camPos); camera.lookAt(camLook); sky.position.copy(camPos);
  { // keep the camera inside the room the player is in, so walls and roof stay put
    const P = player.o.position; for (const R0 of ROOMS) if (P.x > R0.x0 && P.x < R0.x1 && P.z > R0.z0 && P.z < R0.z1) {
      camPos.x = clamp(camPos.x, R0.x0 + 0.3, R0.x1 - 0.3); camPos.z = clamp(camPos.z, R0.z0 + 0.3, R0.z1 - 0.3); camPos.y = clamp(camPos.y, 0.8, R0.h - 0.35);
      camera.position.copy(camPos); camera.lookAt(camLook); break; } }
  // shadow camera follows the player
  sunL.position.copy(camLook).addScaledVector(sun, 80); sunL.target.position.copy(camLook);
}
function updateFlag(t) {
  if (CAMP.flag && ST.area === 'camp') { const q = CAMP.flag.mesh.geometry.attributes.position, b0 = CAMP.flag.base; for (let i = 0; i < q.count; i++) { const x = b0[i * 3] + 1; q.setZ(i, Math.sin(x * 3 - t * 5) * 0.1 * x); } q.needsUpdate = true; }
  const f = flagCloth.mesh; if (!f) return; const p = f.geometry.attributes.position, b = flagCloth.base;
  for (let i = 0; i < p.count; i++) { const x = b[i * 3] + 1.2; p.setZ(i, Math.sin(x * 3 - t * 5) * 0.12 * x); }
  p.needsUpdate = true; f.geometry.computeVertexNormals();
}
let hudT = 0, frames = 0, fpsT = 0;
let simT = 0;
function sim(dt) { simT += dt; updateAudio(dt); updateMaps(dt); updatePlayer(dt); updateTraffic(dt); updatePeople(dt); updateStory(dt); updateCamera(dt); updateUI(dt); updateFlag(simT); hudT -= dt; if (hudT <= 0) { hudT = .25; hudSync(); } }
window.__step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) sim(dt); renderer.render(scene, camera); };
let wall = performance.now();
function loop() {
  const now = performance.now(), raw = (now - wall) / 1000; wall = now;
  const dt = Math.min(0.05, raw);
  if (player) sim(dt);
  renderer.render(scene, camera);
  frames++; fpsT += raw; if (fpsT > 1) { window.__fps = frames / fpsT; window.__calls = renderer.info.render.calls; window.__tris = renderer.info.render.triangles; frames = 0; fpsT = 0; }
  requestAnimationFrame(loop);
}
// Merge static single-material meshes by material: far fewer draw calls (phones!)
function mergeStatic() {
  const groups = new Map(), kill = [];
  const dynamic = new Set(); for (const v of traffic) v.g.traverse(o => dynamic.add(o)); if (flagCloth.mesh) dynamic.add(flagCloth.mesh);
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || o.userData.keep || dynamic.has(o) || Array.isArray(o.material) || o.isSkinnedMesh || o.material.map === undefined && false) return;
    if (o.geometry.attributes.uv === undefined) return;
    let top = o; while (top.parent && top.parent !== scene) top = top.parent; const area = top.userData.area || 'street';
    const key = o.material.uuid + (o.castShadow ? 's' : 'n') + area;
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    groups.get(key).list.push(o);
  });
  let merged = 0;
  for (const g of groups.values()) {
    if (g.list.length < 3) continue;
    const geos = g.list.map(o => { let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); geo.applyMatrix4(o.matrixWorld); return geo; });
    const m = mergeGeometries(geos, false); if (!m) continue;
    const mesh = new THREE.Mesh(m, g.mat); mesh.castShadow = g.cast; mesh.receiveShadow = true; scene.add(mesh); merged += g.list.length; kill.push(...g.list);
  }
  for (const o of kill) o.parent.remove(o);
  return merged;
}

boot().then(T => {
  const L = $('load'), C = $('creator'), go = $('go');
  // live preview: your corper standing outside the camp gate
  let pvP = null, pvOn = true, pvTok = 0; const pvPos = new THREE.Vector3(-3, 0.02, CZ + 63), pvClock = new THREE.Clock();
  async function preview() { const tok = ++pvTok, tex = await playerTex(CH.g, 'mufti', CH.tone); if (tok !== pvTok || !pvOn) return; if (pvP) scene.remove(pvP.o);
    pvP = makePerson(CH.g === 'f' ? 'fem' : 'lewis', { tex, h: CH.g === 'f' ? 1.66 : 1.78, npc: false, anim: 'idle' }); for (const m of pvP.meshes) m.frustumCulled = false; pvP.o.position.copy(pvPos); pvP.o.rotation.y = 0.35; }
  function pvLoop() { if (!pvOn) return; const dt = Math.min(0.05, pvClock.getDelta()), narrow = innerWidth < 760, ox = narrow ? 0 : -1.0;
    if (pvP) { pvP.mixer.update(dt); pvP.o.rotation.y = 0.25 + Math.sin(performance.now() / 2600) * 0.45; }
    camera.position.set(pvPos.x + ox, narrow ? 1.5 : 1.3, pvPos.z + (narrow ? 5.2 : 3.7)); camera.lookAt(pvPos.x + ox, narrow ? 0.15 : 0.95, pvPos.z); sky.position.copy(camera.position);
    sunL.position.copy(pvPos).addScaledVector(sun, 80); sunL.target.position.copy(pvPos); renderer.render(scene, camera); requestAnimationFrame(pvLoop); }
  // creator controls
  $('cbg').innerHTML = BACKGROUNDS.map(b => `<button data-v="${b[0]}"><b>${b[1]}</b><span>${naira(b[3].cash)} · ${b[2]}</span></button>`).join('');
  const sync = () => { for (const [id, key] of [['cgender', 'g'], ['ctone', 'tone'], ['cbg', 'bg']]) for (const b of $(id).children) b.classList.toggle('on', String(CH[key]) === b.dataset.v); };
  for (const [id, key] of [['cgender', 'g'], ['ctone', 'tone'], ['cbg', 'bg']]) for (const b of $(id).children) b.onclick = () => { CH[key] = key === 'tone' ? +b.dataset.v : b.dataset.v; sync(); if (key !== 'bg') preview(); };
  $('cstate').innerHTML = `<option value="rand">🎲 Random, like the real call-up letter</option>` + STATES.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}${s.id === 'FC' ? '' : ' State'} · camp at ${s.camp.split(/[,(]/)[0]}</option>`).join('');
  $('ccourse').innerHTML = COURSES.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('');
  try { const last = JSON.parse(localStorage.getItem('nysc3d.corper') || 'null'); if (last) { Object.assign(CH, last); $('cname').value = CH.name || ''; } } catch (e) { }
  $('cstate').value = CH.pick || 'rand'; $('ccourse').value = CH.course || 'education';
  sync(); preview(); pvLoop();
  L.style.transition = 'opacity .7s'; L.style.opacity = 0; setTimeout(() => { if (pvOn) L.style.display = 'none'; }, 750); C.hidden = false;
  const start = async g => {
    if (g) CH.g = g; CH.name = ($('cname').value || '').trim().slice(0, 14); CH.pick = $('cstate').value; CH.course = $('ccourse').value;
    if (!CH.resume) CH.state = window.__state || (CH.pick === 'rand' ? STATES[(Math.random() * STATES.length) | 0].id : CH.pick);
    try { localStorage.setItem('nysc3d.corper', JSON.stringify(CH)); } catch (e) { }
    C.hidden = true; L.style.transition = ''; L.style.display = 'grid'; L.style.opacity = 1; $('lmsg').textContent = 'Taking you to camp…'; $('lbar').style.width = '100%'; audio();
    await new Promise(r => setTimeout(r, 40));
    pvOn = false; pvTok++; if (pvP) { scene.remove(pvP.o); pvP = null; }
    try { const [a, b, c] = await Promise.all(['mufti', 'white', 'khaki'].map(k => playerTex(CH.g, k, CH.tone))); T.p_mufti = a; T.p_white = b; T.p_khaki = c; } catch (e) { }
    spawnWorld(T, CH.g); themeCamp(); $('hud').style.visibility = 'visible'; hudSync(); camLook.copy(player.o.position); camLook.y += 1.55; updateCamera(0.016);
    for (const t of Object.values(T)) renderer.initTexture(t);
    try { await renderer.compileAsync(scene, camera); } catch (e) { try { renderer.compile(scene, camera); } catch (e2) { } }
    renderer.render(scene, camera); await new Promise(r => requestAnimationFrame(r));
    L.style.transition = 'opacity .9s'; L.style.opacity = 0; setTimeout(() => L.style.display = 'none', 950);
    loop(); setTimeout(() => { ST.ready = true; }, 1600); if (!CH.resume) setTimeout(callUpLetter, 900);
    setTimeout(() => { const c = renderer.getContext(); if (c && c.isContextLost && c.isContextLost()) toast('Your phone ran out of graphics memory. Close other tabs and reload.', 6000); }, 4000);
  };
  go.onclick = () => start();
  const sv = loadSave(), c = $('gocont');
  if (sv) { c.hidden = false; c.textContent = `▶ Continue ${sv.st && sv.st.name ? 'as ' + sv.st.name : ''} · ${sv.cp === 'year' ? 'Service year · Month ' + ((sv.y && sv.y.month) || 1) : sv.cp === 'ch2' ? 'Chapter 2: CDS week' : 'Chapter 1: Lagos street'}`;
    c.onclick = async () => { CH.resume = true; if (sv.st) { CH.tone = sv.st.tone ?? CH.tone; CH.bg = sv.st.bg || CH.bg; CH.state = sv.st.state || 'LA'; CH.course = sv.st.course || CH.course; if (sv.st.name) $('cname').value = sv.st.name; } await start(sv.g); resumeFrom(sv); }; }
  window.__start = start;
}).catch(e => { $('lmsg').textContent = 'Could not load: ' + e.message; console.error(e); });
