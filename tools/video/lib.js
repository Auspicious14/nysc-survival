// Frame-accurate capture of Kopa Life: the page clock is frozen and advanced 1/30 s per frame.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const W = 720, H = 1280, FPS = 30;
async function open({ state = 'LA', posting = 'Ikeja', name = 'Tolani', hud = false } = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.log('PE', e.message));
  await p.addInitScript(([s, po]) => { window.__fast = false; window.__state = s; if (po) window.__posting = po; window.__org = 'school'; window.__noNet = true; try { localStorage.clear(); localStorage.setItem('nysc3d.gfx', 'high'); } catch (e) { } }, [state, posting]);
  await p.goto('http://localhost:8765/__test.html', { timeout: 300000 }); await p.waitForFunction(() => window.__start, null, { timeout: 300000 });
  await p.fill('#cname', name); await p.click('#go'); await p.waitForFunction(() => window.__fps > 0, null, { timeout: 300000 }); await p.waitForTimeout(1500);
  await p.addStyleTag({ content: `
    #joy,.btns,#credits,#bubble{display:none!important}
    #phone.on{transform:scale(1.55)!important;transform-origin:50% 100%}
    ${hud ? '' : '#obj,#stats,#minimap,#arrow,#prompt,#notif{visibility:hidden!important}'}
    #vcap{position:fixed;left:0;right:0;top:15%;z-index:99;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;font-family:'Inter Display','Inter',system-ui,sans-serif}
    #vcap span{display:inline-block;max-width:88%;text-align:center;background:#fff;color:#0b1a12;font-weight:900;font-size:44px;line-height:1.08;letter-spacing:-.02em;padding:10px 20px;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
    #vcap span.g{background:#1f9d55;color:#fff}#vcap span.k{background:#0b1a12;color:#f6f1e4;font-size:30px;font-weight:700}
    #vsub{position:fixed;left:6%;right:6%;bottom:20%;z-index:99;text-align:center;font:700 30px/1.25 'Inter',system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.9);pointer-events:none}
    #vsub b{color:#ffd54f;display:block;font-size:22px;letter-spacing:.08em;text-transform:uppercase}
  `});
  await p.evaluate(() => { for (const id of ['vcap', 'vsub']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); } });
  await p.evaluate(() => { window.__hold = true; window.__rafN = 0; const r = window.requestAnimationFrame; (function c() { window.__rafN++; r(c); })(); });
  await p.clock.install(); await p.clock.pauseAt(Date.now() + 1000);
  return { b, p };
}
const ev = (p, f, a) => p.evaluate(f, a);
// caption: [{t:'text', cls:'g'|'k'}], appears with a pop at frame f0
async function caption(p, lines, prog = 1) {
  await p.evaluate(([lines, k]) => { const c = document.getElementById('vcap'); c.innerHTML = lines.map(l => `<span class="${l.cls || ''}">${l.t}</span>`).join(''); const s = 0.6 + 0.4 * Math.min(1, k) + (k < 1 ? 0.08 * Math.sin(k * Math.PI) : 0); c.style.transform = `scale(${s})`; c.style.opacity = Math.min(1, k * 2); }, [lines, prog]);
}
async function sub(p, who, text) { await p.evaluate(([w, t]) => { document.getElementById('vsub').innerHTML = t ? (w ? `<b>${w}</b>` : '') + t : ''; }, [who, text]); }
function encoder(out) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', out + '.tmp.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0;
  return {
    frame: async p => { await p.clock.runFor(1000 / FPS); await p.evaluate(() => __step(1, 1 / 30)); const buf = await p.screenshot({ type: 'jpeg', quality: 92, timeout: 300000 }); n++; if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); },
    get n() { return n; },
    done: () => new Promise((ok, bad) => { ff.on('close', c => { if (c === 0) { fs.renameSync(out + '.tmp.mp4', out); ok(n); } else bad(new Error('ffmpeg ' + c)); }); ff.stdin.end(); }),
  };
}
module.exports = { open, ev, caption, sub, encoder, FPS, W, H };
