// Kopa Life trailer scenes. node scenes.js <scene> [preview]
// Full mode writes clips/<scene>.mp4 + clips/<scene>.json (voice lines with their start frame).
const L = require('./lib'); const fs = require('fs');
const SC = process.argv[2], PREVIEW = process.argv[3] === 'preview';
fs.mkdirSync('clips', { recursive: true }); fs.mkdirSync('prev', { recursive: true });
(async () => {
  const opts = { state: 'LA', posting: 'Ikeja', hud: SC === 'clearance' || SC === 'street' };
  const { b, p } = await L.open(opts);
  const ev = (f, a) => p.evaluate(f, a);
  // log every voice clip the game plays, with the frame it starts on
  await ev(() => { window.__vf = 0; window.__vlog = []; const pl = HTMLMediaElement.prototype.play, pa = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () { if (/voice\//.test(this.src)) window.__vlog.push({ f: window.__vf, src: this.src.split('/').pop(), ev: 'play' }); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function () { if (/voice\//.test(this.src)) window.__vlog.push({ f: window.__vf, src: this.src.split('/').pop(), ev: 'stop' }); }; });
  const enc = PREVIEW ? null : L.encoder(`clips/${SC}.mp4`);
  let F = 0; const want = new Set((process.argv[4] || '').split(',').filter(Boolean).map(Number));
  const frames = async n => { for (let i = 0; i < n; i++) { await ev(f => { window.__vf = f; }, F);
      if (enc) await enc.frame(p); else { await p.clock.runFor(1000 / 30); await ev(r => __step(1, 1 / 30, !r), want.has(F)); if (want.has(F)) await p.screenshot({ path: `prev/${SC}_${F}.jpg`, type: 'jpeg', quality: 80, timeout: 600000 }); }
      F++; } };
  const tp = (x, z, ry) => ev(([x, z, ry]) => { const P = __G.player.o.position; P.x = x; P.z = z; if (ry !== undefined) __G.player.o.rotation.y = ry; }, [x, z, ry]);
  const cam = (yaw, pitch, dist) => ev(([y, pi, d]) => { __G.cam.yaw = y; __G.cam.pitch = pi; __G.cam.tdist = d; __G.cam.dist = d; }, [yaw, pitch, dist]);
  const choose = i => ev(i => __camp.choose(i), i);
  const spot = k => ev(k => { const s = __G.CAMP.spots[k] || __G.CAMP[k]; return { x: s.x, z: s.z }; }, k);
  const closeDlg = () => ev(() => { const d = document.getElementById('dlg'); if (!d.hidden) __camp.choose(0); });
  const settle = async (n = 20) => { for (let i = 0; i < n; i++) { await p.clock.runFor(33); await ev(() => __step(1, 1 / 30, true)); } };
  await closeDlg(); await settle(5);

  if (SC === 'gate') { // walk up to the soldier, call-up letter, bag check
    const g = await spot('gate'); const P = await ev(() => ({ x: __G.player.o.position.x, z: __G.player.o.position.z }));
    await tp(g.x + 0.4, g.z + 9, Math.PI); await cam(0.25, 0.14, 5.2); await settle(30);
    await p.keyboard.down('KeyW'); await frames(75); await p.keyboard.up('KeyW'); await frames(6);
    await ev(() => __camp.gateCheck()); await frames(95);       // "Corper! Where is your call-up letter?"
    await choose(0); await frames(110);                           // "Hmm. Lagos State. Okay. Open that bag..."
    await choose(0); await frames(60);                            // "Iron? Kettle?..."
  }
  if (SC === 'register') {
    const d = await spot('desk'); await tp(d.x + 1.3, d.z + 2.0, Math.PI - 0.5); await cam(1.05, 0.16, 4.6); await settle(30);
    await ev(() => __camp.register()); await frames(80); await choose(0); await frames(80);
  }
  if (SC === 'kit') {
    await ev(() => { __G.ST.cstep = 2; }); const d = await spot('kit'); await tp(d.x - 1.2, d.z + 2.2, Math.PI + 0.45); await cam(-0.95, 0.14, 4.6); await settle(30);
    await ev(() => __camp.kit()); await frames(70); await choose(1); await frames(110); await choose(0); await frames(20); await choose(0); await frames(40);
  }
  if (SC === 'social') {
    await ev(() => { __G.ST.cstep = 4; __camp.setTOD('Night'); __G.ST.mins = 20 * 60 + 15; __camp.campGo(4); }); await settle(10); await closeDlg();
    const s = await spot('stage'); await tp(s.x + 1.5, s.z + 4, Math.PI); await cam(0.15, 0.2, 8); await settle(40);
    await ev(() => __camp.dress('white')); await ev(() => __camp.socialNight()); await frames(105); await choose(1);
    for (let i = 0; i < 150; i++) { await ev(k => { __G.cam.yaw = 0.15 + k * 0.004; }, i); await frames(1); }
  }
  if (SC === 'parade') {
    await ev(() => { __G.ST.cstep = 5; __camp.setTOD('Morning'); __G.ST.mins = 5 * 60 + 30; __camp.campGo(5); for (const f of __G.CAMP.formation) f.hidden = false; }); await settle(10); await closeDlg();
    await ev(() => __camp.dress('white')); await ev(() => __camp.startDrill()); await cam(0.35, 0.22, 8.5); await settle(5);
    for (let k = 0; k < 290; k++) { await frames(1); const ph = await ev(() => __G.ST.drill && __G.ST.drill.phase + ':' + __G.ST.drill.t.toFixed(2)); if (ph && ph.startsWith('call') && parseFloat(ph.split(':')[1]) < 1.9) await ev(() => { const D = __G.ST.drill; __camp.drillAnswer(D.seq[D.i]); }); if (!ph && k > 30) break; }
  }
  if (SC === 'posting') {
    await ev(() => { __G.ST.cstep = 6; __G.ST.code = 'LA/26C/4821'; __camp.setTOD('Afternoon'); __G.ST.mins = 14 * 60; __camp.campGo(6); }); await settle(10); await closeDlg();
    const n = await spot('notice'); await tp(n.x + 0.5, n.z + 2.6, Math.PI); await cam(0.45, 0.2, 6); await settle(40);
    await ev(() => __camp.dress('white')); await ev(() => __camp.posting()); await frames(210);
  }
  if (SC === 'street') { // four weeks later: the Lagos street, a danfo, walking to the secretariat
    await ev(() => __camp.leaveCamp()); await settle(200); await closeDlg(); await settle(30);
    await tp(-26, 9.4, Math.PI / 2); await cam(-Math.PI / 2 + 0.55, 0.14, 7); await settle(20);
    for (let i = 0; i < 180; i++) { await ev(k => { __G.cam.yaw = -Math.PI / 2 + 0.55 - k * 0.0017; }, i); await frames(1); }
  }
  if (SC === 'phone') {
    await ev(() => __camp.leaveCamp()); await settle(200); await closeDlg(); await settle(20); await tp(-26, 9.4, Math.PI / 2); await cam(-Math.PI / 2 + 0.55, 0.14, 7);
    await ev(() => { __G.phone(true); }); await settle(10);
    await ev(() => { __G.ST.group = 'Ikeja LGA Corpers'; __ON.thr('Ikeja LGA Corpers', 'group'); __ON.PH.thread = 'Ikeja LGA Corpers'; __ON.phShow('thread'); }); await settle(10);
    const M = [['Emeka', 'Guys, is there CDS tomorrow? 🤔', ''], ['Chioma', 'Who has confirmed?', ''], ['Unknown number', 'They said no CDS. Stay home 😴', 'r'], ['Tolu', 'Omo I\'m already here 🏃🏾‍♀️', ''], ['Emeka', 'Wait for official announcement abeg', ''], ['LGI · OFFICIAL', 'CDS holds as scheduled. Attendance will be taken.', 'off'], ['Tolu', '😂😂 Who stayed home?', '']];
    await frames(20);
    for (const [w, t, k] of M) { await ev(([w, t, k]) => __G.chat(w, t, k), [w, t, k]); await frames(w.startsWith('LGI') ? 55 : 30); }
    await frames(30);
  }
  if (SC === 'ppa') {
    await ev(() => __camp.leaveCamp()); await settle(200); await closeDlg(); await settle(30);
    const it = await ev(() => { const s = __G.interactables().map(i => i.label); return s; }); console.log('labels', it.slice(0, 30));
    await ev(() => { __G.ST.phase = 2; __ppa.ppaGo(1); }); await settle(10); await closeDlg();
    const T = await ev(() => __G.ST.target && { x: __G.ST.target.x, z: __G.ST.target.z, l: __G.ST.target.label }); console.log('target', T);
    if (T) { await tp(T.x + 1.5, T.z + 1.5, Math.PI + 0.8); } await cam(0.8, 0.2, 4); await settle(40);
    await ev(() => __ppa.principal1()); await frames(200);
  }
  if (SC === 'clearance') {
    await ev(() => __camp.leaveCamp()); await settle(200); await closeDlg(); await settle(30);
    await ev(() => { __G.ST.phase = 1; __G.ST.mins = 11 * 60 + 40; __cq.clearance(); __G.player.o.position.set(__cq.CQ_SPOT.x, 0.18, __cq.CQ_SPOT.z); }); await closeDlg();
    await cam(Math.PI / 2, 0.3, 10.5); await settle(10); await frames(120);
    await ev(() => { const C = __cq.CQ; C.serving = C.me - 1; }); // skip to the front
    for (let k = 0; k < 200; k++) { await frames(1); const st = await ev(() => __cq.CQ.stage); const d = await ev(() => !document.getElementById('dlg').hidden); if (d) await closeDlg(); if (st === 'desk') { await ev(() => { __G.player.o.position.set(__cq.CQ_DESK.x, 0.18, __cq.CQ_DESK.z); }); } if (st === 'thumb') break; }
    await frames(15);
    // the scanner animates with requestAnimationFrame, which the frozen clock stops: draw it frame by frame
    const scan = async (n, fail) => { for (let i = 0; i <= n; i++) { await ev(([k]) => { const pr = document.getElementById('tpr'), L = 2 * Math.PI * 52; pr.style.strokeDasharray = L; pr.style.strokeDashoffset = L * (1 - k); }, [i / n]); await frames(1); }
      await ev(([fail]) => { const pr = document.getElementById('tpr'), L = 2 * Math.PI * 52; document.getElementById('tmsg').textContent = fail ? '❌ "Try again. Wipe your thumb." (Of course.)' : '✅ Captured!'; if (fail) pr.style.strokeDashoffset = L; }, [fail]); };
    await scan(45, true); await frames(40); await scan(45, false); await frames(10);
    await ev(() => { document.getElementById('thumb').hidden = true; __G.ST.cash += 77000; }); await ev(() => document.getElementById('toast') && 0);
    await frames(45);
  }
  if (SC === 'result') {
    await ev(() => { const S = __G.ST; S.code = 'LA/26C/4821'; S.drillOk = 6; S.ppaScore = 4; S.post = S.post || { lga: 'Ikeja LGA', short: 'Ikeja' }; __ppa.showSummary(1); }); await frames(75);
    await ev(() => __cq.shareResult(1)); await frames(90);
  }
  const vlog = await ev(() => window.__vlog);
  console.log(SC, 'frames', F, 'voices', JSON.stringify(vlog));
  if (enc) { await enc.done(); fs.writeFileSync(`clips/${SC}.json`, JSON.stringify({ frames: F, voices: vlog })); }
  await b.close();
})().catch(e => { console.log(SC, 'FAIL', e.stack); process.exit(1); });
