// Phone games for NYSC Survival: Naija Whot (vs Emeka) and Danfo Dash (endless dodger).
// Each mount(el, api) builds its UI inside el and returns a stop() function.
// api: { onEnd(result), name } — result: { win, score, label }

/* ---------------- Whot! ---------------- */
// 54-card deck: circle/triangle/cross/square/star with the usual numbers, plus five WHOT 20s.
const SHAPES = { circle: '●', triangle: '▲', cross: '✚', square: '■', star: '★' };
const NUMS = { circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14], triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14], cross: [1, 2, 3, 5, 7, 10, 11, 13, 14], square: [1, 2, 3, 5, 7, 10, 11, 13, 14], star: [1, 2, 3, 4, 5, 7, 8] };
const RULES = { 1: 'Hold on: play again', 2: 'Pick two', 8: 'Suspension', 14: 'General market', 20: 'WHOT: call any shape' };
function deck() { const d = []; for (const [s, ns] of Object.entries(NUMS)) for (const n of ns) d.push({ s, n }); for (let i = 0; i < 5; i++) d.push({ s: 'whot', n: 20 }); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[d[i], d[j]] = [d[j], d[i]]; } return d; }
const cardHTML = (c, i, cls = '') => `<button class="wc ${c.s} ${cls}" data-i="${i ?? ''}" aria-label="${c.s === 'whot' ? 'Whot 20' : c.s + ' ' + c.n}"><b>${c.s === 'whot' ? 'WHOT' : c.n}</b><i>${c.s === 'whot' ? '20' : SHAPES[c.s]}</i><small>${c.s === 'whot' ? '' : c.n}</small></button>`;
export function mountWhot(el, api) {
  let D = deck(), you = D.splice(0, 5), cpu = D.splice(0, 5), pile = [D.shift()], need = null, turn = 'you', pickN = 0, over = false, msg = 'Match the shape or the number. 20 is WHOT.';
  while (pile[0].s === 'whot' || RULES[pile[0].n]) { D.push(pile.shift()); pile.unshift(D.shift()); }
  const top = () => pile[pile.length - 1];
  const fits = c => pickN ? c.n === 2 : c.s === 'whot' || (need ? c.s === need : c.s === top().s || c.n === top().n);
  const draw = (hand, n) => { for (let i = 0; i < n; i++) { if (!D.length) { const t = pile.pop(); D = pile.sort(() => Math.random() - .5); pile = [t]; } if (D.length) hand.push(D.shift()); } };
  const render = () => {
    el.innerHTML = `<div class="whot"><div class="wopp"><span>🧑🏾 Emeka</span><div class="wback">${cpu.map(() => '<i></i>').join('')}</div><em>${cpu.length} card${cpu.length === 1 ? '' : 's'}${cpu.length === 1 ? ' · LAST CARD!' : ''}</em></div>
      <div class="wmid"><button class="wmarket" ${turn !== 'you' || over ? 'disabled' : ''} aria-label="Go to market">${D.length}<small>MARKET</small></button>${cardHTML(top(), null, 'pile')}<div class="wneed">${need ? 'Needs ' + SHAPES[need] + ' ' + need : pickN ? 'Pick ' + pickN + '!' : ''}</div></div>
      <p class="wmsg" aria-live="polite">${msg}</p><div class="whand">${you.map((c, i) => cardHTML(c, i, turn === 'you' && !over && fits(c) ? 'ok' : 'no')).join('')}</div>
      <div class="wshape" hidden>${Object.entries(SHAPES).map(([k, v]) => `<button data-s="${k}">${v}<small>${k}</small></button>`).join('')}</div>${over ? '<button class="wagain">Play again</button>' : ''}</div>`;
    el.querySelectorAll('.whand .wc').forEach(b => b.onclick = () => play(+b.dataset.i));
    const m = el.querySelector('.wmarket'); if (m) m.onclick = () => { if (turn !== 'you' || over) return; draw(you, pickN || 1); msg = pickN ? `You picked ${pickN}.` : 'You went to market.'; pickN = 0; endTurn('you', null); };
    const a = el.querySelector('.wagain'); if (a) a.onclick = () => { stop(); Object.assign(api, {}); const s2 = mountWhot(el, api); stopRef = s2; };
  };
  const finish = who => { over = true; msg = who === 'you' ? 'CHECK UP! You won. Emeka is asking for rematch. 🎉' : 'Emeka checks up. "Corper, you fall my hand." 😅'; render(); api.onEnd && api.onEnd({ win: who === 'you', label: 'Whot' }); };
  const apply = (who, c) => { // card effects
    const other = who === 'you' ? cpu : you; need = null;
    if (c.n === 1) return 'again';
    if (c.n === 2) { pickN += 2; return 'next'; }
    if (c.n === 8) return 'again';
    if (c.n === 14) { draw(other, 1); return 'again'; }
    return 'next';
  };
  const endTurn = (who, eff) => { if (over) return; turn = eff === 'again' ? who : who === 'you' ? 'cpu' : 'you'; render(); if (turn === 'cpu') setTimeout(cpuMove, 900); };
  const play = i => {
    if (turn !== 'you' || over) return; const c = you[i]; if (!fits(c)) { msg = 'That card no fit. Match the shape or number, or go to market.'; render(); return; }
    you.splice(i, 1); pile.push(c);
    if (!you.length) return finish('you');
    if (c.s === 'whot') { msg = 'WHOT! Call a shape.'; render(); const box = el.querySelector('.wshape'); box.hidden = false; box.querySelectorAll('button').forEach(b => b.onclick = () => { need = b.dataset.s; msg = `You need ${SHAPES[need]} ${need}.`; endTurn('you', 'next'); }); return; }
    const eff = apply('you', c); msg = RULES[c.n] && c.n !== 20 ? 'You: ' + RULES[c.n] + (c.n === 14 ? ' (Emeka picks one)' : '') : 'Your turn done.'; endTurn('you', eff);
  };
  const cpuMove = () => {
    if (over) return; const opts = cpu.map((c, i) => [c, i]).filter(([c]) => fits(c));
    if (!opts.length) { draw(cpu, pickN || 1); msg = pickN ? `Emeka picks ${pickN}. "Ehn!"` : 'Emeka goes to market.'; pickN = 0; return endTurn('cpu', null); }
    opts.sort((a, b) => (b[0].s === 'whot' ? -1 : RULES[b[0].n] ? 1 : 0) - (a[0].s === 'whot' ? -1 : RULES[a[0].n] ? 1 : 0)); // specials first, Whot last
    const [c, i] = opts[0]; cpu.splice(i, 1); pile.push(c);
    if (!cpu.length) return finish('cpu');
    if (c.s === 'whot') { const cnt = {}; for (const k of cpu) if (k.s !== 'whot') cnt[k.s] = (cnt[k.s] || 0) + 1; need = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'circle'; msg = `Emeka: "WHOT! I need ${need}."`; return endTurn('cpu', 'next'); }
    const eff = apply('cpu', c); msg = RULES[c.n] ? `Emeka: "${RULES[c.n]}!"` : `Emeka played ${c.n} ${c.s}.`; endTurn('cpu', eff);
  };
  let stopRef = null; const stop = () => { over = true; if (stopRef) stopRef(); };
  render(); return () => stop();
}

/* ---------------- Danfo Dash ---------------- */
// Three lanes, your danfo, potholes, okadas and goats. Collect ₦ coins. Tap left/right or use arrow keys / A-D.
export function mountDash(el, api) {
  el.innerHTML = `<div class="dash"><canvas width="360" height="560" aria-label="Danfo Dash game"></canvas><div class="dhud"><b>₦<span class="dc">0</span></b><span class="ds">0 m</span></div><div class="dover" hidden><h3>JAMMED!</h3><p class="dres"></p><button>Drive again</button></div><div class="dtip">Tap left or right side to change lane</div></div>`;
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, LX = [W * 0.2, W * 0.5, W * 0.8];
  let lane = 1, px = LX[1], obs = [], coins = 0, dist = 0, sp = 260, t = 0, alive = true, raf = 0, last = performance.now(), spawnT = 0, best = 0;
  try { best = +localStorage.getItem('nysc3d.dash') || 0; } catch (e) { }
  const KINDS = [{ k: 'pothole', w: 70, h: 34 }, { k: 'okada', w: 34, h: 64 }, { k: 'goat', w: 40, h: 40 }, { k: 'coin', w: 30, h: 30 }, { k: 'coin', w: 30, h: 30 }];
  const move = d => { if (!alive) return; lane = Math.max(0, Math.min(2, lane + d)); el.querySelector('.dtip').hidden = true; };
  const key = e => { if (!el.isConnected) return; if (['ArrowLeft', 'a', 'A'].includes(e.key)) { move(-1); e.preventDefault(); e.stopImmediatePropagation(); } if (['ArrowRight', 'd', 'D'].includes(e.key)) { move(1); e.preventDefault(); e.stopImmediatePropagation(); } };
  window.addEventListener('keydown', key, true);
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); move(e.clientX - r.left < r.width / 2 ? -1 : 1); });
  const drawBus = (x, y) => { g.fillStyle = '#f6c21c'; g.beginPath(); g.roundRect(x - 26, y - 46, 52, 92, 10); g.fill(); g.fillStyle = '#1b1b1b'; g.fillRect(x - 26, y - 6, 52, 6); g.fillRect(x - 26, y + 14, 52, 4); g.fillStyle = '#9fd3ff'; g.beginPath(); g.roundRect(x - 20, y - 40, 40, 16, 4); g.fill(); g.fillStyle = '#222'; g.fillRect(x - 30, y - 30, 5, 14); g.fillRect(x + 25, y - 30, 5, 14); g.fillRect(x - 30, y + 22, 5, 14); g.fillRect(x + 25, y + 22, 5, 14); };
  const drawObs = o => {
    if (o.k === 'pothole') { g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(o.x, o.y, 34, 15, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(80,140,200,.5)'; g.beginPath(); g.ellipse(o.x - 4, o.y - 2, 22, 8, 0, 0, 7); g.fill(); }
    if (o.k === 'okada') { g.fillStyle = '#c62828'; g.beginPath(); g.roundRect(o.x - 10, o.y - 30, 20, 60, 8); g.fill(); g.fillStyle = '#5d4037'; g.beginPath(); g.arc(o.x, o.y - 6, 11, 0, 7); g.fill(); g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(o.x, o.y + 12, 9, 0, 7); g.fill(); }
    if (o.k === 'goat') { g.fillStyle = '#e0e0e0'; g.beginPath(); g.ellipse(o.x, o.y, 16, 22, 0, 0, 7); g.fill(); g.fillStyle = '#9e9e9e'; g.beginPath(); g.arc(o.x, o.y - 22, 8, 0, 7); g.fill(); g.font = '20px sans-serif'; g.fillText('🐐', o.x - 12, o.y + 6); }
    if (o.k === 'coin') { g.fillStyle = '#ffca28'; g.beginPath(); g.arc(o.x, o.y, 14, 0, 7); g.fill(); g.fillStyle = '#8d6e00'; g.font = '700 16px sans-serif'; g.textAlign = 'center'; g.fillText('₦', o.x, o.y + 6); g.textAlign = 'left'; }
  };
  const over = () => { alive = false; const earned = Math.floor(coins); if (dist > best) { best = Math.floor(dist); try { localStorage.setItem('nysc3d.dash', String(best)); } catch (e) { } }
    const o = el.querySelector('.dover'); o.hidden = false; o.querySelector('.dres').textContent = `${Math.floor(dist)} m · ₦${earned * 10} collected · Best ${best} m`;
    o.querySelector('button').onclick = () => { stop(); const s2 = mountDash(el, api); stopRef = s2; };
    api.onEnd && api.onEnd({ win: dist > 400, score: Math.floor(dist), label: 'Danfo Dash' }); };
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (alive) { sp = Math.min(620, sp + dt * 9); dist += sp * dt / 10; spawnT -= dt; px += (LX[lane] - px) * Math.min(1, dt * 14);
      if (spawnT <= 0) { spawnT = Math.max(0.42, 1.1 - dist / 2400); const K = KINDS[(Math.random() * KINDS.length) | 0]; const l = (Math.random() * 3) | 0; obs.push({ ...K, x: LX[l], y: -60 }); if (Math.random() < 0.25 && dist > 300) { const K2 = KINDS[(Math.random() * 3) | 0]; obs.push({ ...K2, x: LX[(l + 1 + ((Math.random() * 2) | 0)) % 3], y: -60 }); } }
      for (const o of obs) o.y += sp * dt;
      for (const o of obs) if (!o.hit && Math.abs(o.y - (H - 110)) < (o.h / 2 + 40) && Math.abs(o.x - px) < o.w / 2 + 22) { o.hit = true; if (o.k === 'coin') { coins++; o.gone = true; } else over(); }
      obs = obs.filter(o => o.y < H + 80 && !o.gone); }
    // road
    g.fillStyle = '#3a3d40'; g.fillRect(0, 0, W, H); g.fillStyle = '#5e8c3a'; g.fillRect(0, 0, 18, H); g.fillRect(W - 18, 0, 18, H);
    g.fillStyle = '#d9d9d9'; const off = (t * sp) % 60; for (const x of [W / 3, 2 * W / 3]) for (let y = -60 + off; y < H; y += 60) g.fillRect(x - 3, y, 6, 32);
    for (const o of obs) drawObs(o); drawBus(px, H - 110);
    el.querySelector('.dc').textContent = coins * 10; el.querySelector('.ds').textContent = Math.floor(dist) + ' m';
    if (el.isConnected) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  let stopRef = null;
  const stop = () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key, true); if (stopRef) stopRef(); };
  return stop;
}
