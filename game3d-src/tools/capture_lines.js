// Collect every line the game can speak (with speaker + gender) by driving the dialogues headlessly.
// Usage: serve the game folder (python3 -m http.server 8765), then: node tools/capture_lines.js http://localhost:8765/__test.html out.json
// Names that change per state/LGA come out as {PRN} {TCH} {BOSS} {STATE} {LGA} {PPA}; tools/make_voice_script.py expands them.
const { chromium } = require('playwright'); const fs = require('fs');
const URL = process.argv[2] || 'http://localhost:8765/__test.html', OUT = process.argv[3] || 'captured_lines.json';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  await p.addInitScript(() => { window.__fast = true; window.__tokens = true; window.__said = new Map(); window.__state = 'LA'; window.__posting = 'Ikeja'; window.__org = 'school'; try { localStorage.clear(); } catch (e) { } });
  p.on('pageerror', e => console.log('PE', e.message));
  const ev = (f, a) => p.evaluate(f, a), wait = ms => p.waitForTimeout(ms);
  await p.goto(URL); await p.waitForFunction(() => window.__start, null, { timeout: 150000 });
  await p.fill('#cname', '{NAME}'); await p.click('#go'); await p.waitForFunction(() => window.__fps > 0, null, { timeout: 200000 }); await wait(800);
  const walk = async (fn, depth = 5, tries = 3) => { // call an entry point, then click random choices down the tree
    for (let t = 0; t < tries; t++) {
      try { await ev(fn); } catch (e) { console.log('entry failed', String(e).slice(0, 120)); break; }
      for (let d = 0; d < depth; d++) {
        await wait(220);
        const r = await ev(t => { const bs = [...document.querySelectorAll('#dlg button')]; if (!bs.length || document.getElementById('dlg').hidden) return 0; bs[(t + Math.floor(Math.random() * bs.length)) % bs.length].click(); return bs.length; }, t);
        if (!r) { await wait(1900); const more = await ev(() => !document.getElementById('dlg').hidden); if (!more) break; }
      }
      await ev(() => { const d = document.getElementById('dlg'); if (!d.hidden) d.querySelector('button')?.click(); });
    }
  };
  const C = '__camp', V = '__vc';
  // camp
  for (const f of ['gateCheck', 'register', 'kit', 'bunk', 'socialNight', 'startDrill', 'posting']) await walk(new Function(`return window.${C}.${f}()`), 6, f === 'register' || f === 'kit' ? 4 : 3);
  for (const n of ['MAMA CHIDINMA', 'AUNTY BISI', 'KHAKI TAILOR', 'PHOTO', 'CHARGING']) await walk(new Function(`return window.${V}.market('${n}')`), 2, 2);
  await walk(new Function(`return window.${V}.callUpLetter()`), 1, 1);
  await ev(() => { for (let i = 0; i < 60; i++) window.__step && __step(2); });
  // street + PPA (school)
  await ev(() => __camp.leaveCamp()); await wait(1500);
  for (const f of ['principal1', 'staffRoom', 'principal2']) await walk(new Function(`return window.__ppa.${f}()`), 4, 3);
  await walk(() => __ppa.startLesson(), 6, 1);
  // clinic + office chapter 1
  for (const kind of ['clinic', 'office']) {
    await ev(k => { __G.ST.post = { ...__G.ST.post, kind: k, sector: k === 'office' ? 'priv' : 'health' }; }, kind);
    for (const f of ['work1', kind === 'clinic' ? 'triage' : 'reportFix', kind === 'clinic' ? 'recordsEthics' : 'printerEthics', 'work2']) await walk(new Function(`return window.__vc.${f}()`), 5, 3);
  }
  await ev(() => { __G.ST.post = { ...__G.ST.post, kind: 'school', sector: 'edu' }; });
  // CDS week
  for (const truth of [true, false]) {
    await ev(t => { __cds.startChapter2(); __cds.CDS.truth = t; }, truth); await wait(1500);
    await walk(() => __cds.lodgeSleep(), 2, 2); await walk(() => { __cds.CDS.go = true; __cds.cdsArrive(); }, 2, 1); await walk(() => __cds.signRegister(), 2, 1); await walk(() => __cds.officialVerdict(), 2, 1); await wait(2500);
  }
  // service year: events, jobs, days
  const nev = await ev(() => __vc.YEVENTS.length);
  for (let i = 0; i < nev; i++) await walk(new Function(`return window.__vc.YEVENTS[${i}]()`), 3, 2);
  for (const kind of ['school', 'clinic', 'office']) {
    await ev(k => { __G.ST.post = { ...__G.ST.post, kind: k }; }, kind);
    const jobs = await ev(k => Object.entries(__vc.PPA_JOBS).filter(([, j]) => (j.kind || 'school') === k).map(([n]) => n), kind);
    for (const j of jobs) await walk(new Function(`return window.__vc.PPA_JOBS['${j}'].act()`), 4, 2);
    await walk(() => __year.ySignPPA(), 2, 1);
  }
  for (const f of ['ySignCDS', 'yClearance', 'yPOP']) await walk(new Function(`return window.__year.${f}()`), 2, 1);
  await wait(3000);
  const said = await ev(() => [...window.__said.entries()].map(([text, v]) => ({ text, ...v })));
  fs.writeFileSync(OUT, JSON.stringify(said, null, 1));
  console.log('captured', said.length, 'lines →', OUT);
  await b.close();
})();
