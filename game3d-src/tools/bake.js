const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('PE', e.message)); p.on('console', m => { if (m.type() === 'error') console.log(m.text()); });
  await p.goto((process.argv[3] || 'http://localhost:8765/index.html') + '#bake');
  await p.waitForFunction(() => window.__bake, null, { timeout: 300000 });
  const r = await p.evaluate(() => window.__bake());
  const D = (process.argv[2] || '.') + '/models/'; fs.mkdirSync(D + 'tex', { recursive: true });
  // trim clip precision
  // pack: dedupe tracks, 15 fps for long clips, int16 quaternions in base64 (unpackClip() in game.js)
  for (const cs of Object.values(r.clips)) for (const j of Object.values(cs)) {
    const step = j.duration > 8 ? 2 : 1, seen = new Set(), tr = [];
    for (const t of j.tracks) { if (seen.has(t.name)) continue; seen.add(t.name); const fr = []; for (let i = 0; i < t.values.length / 4; i++) fr.push(t.values.slice(i * 4, i * 4 + 4));
      let keep = fr.filter((_, i) => i % step === 0); if ((fr.length - 1) % step) keep.push(fr[fr.length - 1]);
      const q = Int16Array.from(keep.flat().map(x => Math.max(-32767, Math.min(32767, Math.round(x * 32767))))); tr.push([t.name, Buffer.from(q.buffer).toString('base64')]); }
    j.tracks = tr; j.step = step; delete j.uuid; delete j.blendMode;
  }
  fs.writeFileSync(D + 'clips.json', JSON.stringify(r.clips));
  for (const [k, u] of Object.entries(r.tex)) fs.writeFileSync(D + 'tex/' + k + '.jpg', Buffer.from(u.split(',')[1], 'base64'));
  fs.writeFileSync(D + 'tex/index.json', JSON.stringify(Object.keys(r.tex)));
  console.log('baked', Object.keys(r.tex).length, 'textures');
  await b.close();
})();
