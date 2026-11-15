// Transparent caption overlays (1080x1920 PNG): node mkov.js
const { chromium } = require('playwright'); const fs = require('fs');
const CAPS = JSON.parse(fs.readFileSync('captions.json'));
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [name, c] of Object.entries(CAPS)) {
    const top = c.pos === 'low' ? '62%' : c.pos === 'mid' ? '30%' : '13%';
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="position:fixed;left:0;right:0;top:${top};display:flex;flex-direction:column;align-items:center;gap:16px;font-family:'Inter Display','Inter',sans-serif">
      ${c.kick ? `<span style="background:#0b1a12;color:#c9b78a;font-weight:700;font-size:34px;letter-spacing:.14em;text-transform:uppercase;padding:12px 24px;border-radius:14px">${c.kick}</span>` : ''}
      ${(c.lines || []).map((l, i) => `<span style="max-width:900px;text-align:center;background:${i === 1 && c.green ? '#1f9d55' : '#fff'};color:${i === 1 && c.green ? '#fff' : '#0b1a12'};font-weight:900;font-size:${c.size || 66}px;line-height:1.08;letter-spacing:-.02em;padding:16px 30px;border-radius:24px;box-shadow:0 10px 40px rgba(0,0,0,.35)">${l}</span>`).join('')}
    </div></body></html>`);
    await p.waitForTimeout(150); await p.screenshot({ path: `ov/${name}.png`, omitBackground: true });
  }
  await p.goto('file://' + process.cwd() + '/endcard.html'); await p.waitForTimeout(800); await p.screenshot({ path: 'ov/endcard.jpg', type: 'jpeg', quality: 92 });
  await b.close(); })();
