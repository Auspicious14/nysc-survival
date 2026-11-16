// Online corpers. Three transports with the same small surface (lobby + join(name) → presence/peers/onPeers/leave):
//  - "room": the claude.ai artifact room capability (when the game runs as a claude.ai artifact)
//  - "supabase": Supabase Realtime broadcast channels (when the game runs on your own site; /game/config.js gives the URL + anon key)
//  - "local": BroadcastChannel between tabs of this browser (testing, or two players on one computer)
// Everything travels as each player's absolute state; nothing is stored anywhere.
export async function connectNet() {
  let room = null;
  try { if (window.claude && window.claude.use) room = await window.claude.use('room'); } catch (e) { room = null; }
  if (room) return wrapRoom(room);
  const C = window.NYSC_CONFIG;
  if (C && C.supabaseUrl && C.supabaseAnonKey && !/YOUR-/.test(C.supabaseUrl + C.supabaseAnonKey)) {
    try { return await supabaseNet(C); } catch (e) { console.warn('Supabase realtime unavailable', e); }
  }
  if (window.BroadcastChannel && !window.__noLocalNet) return pipeNet('local', name => {
    const ch = new BroadcastChannel('nysc3d.' + name);
    return { send: m => ch.postMessage(m), listen: f => { ch.onmessage = e => f(e.data); }, close: () => ch.close() };
  });
  return null;
}
function wrapRoom(room) {
  const scope = r => ({
    presence: p => r.presence(p).catch(() => { }),
    peers: () => r.peers(),
    onPeers: f => r.onPeers(f, () => { }),
    connected: () => r.connected(),
  });
  return { kind: 'room', lobby: scope(room), join: async name => { const n = await room.join(name); return { ...scope(n), name, leave: () => n.leave().catch(() => { }) }; } };
}
async function loadScript(src) {
  await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('load ' + src)); document.head.appendChild(s); });
}
async function supabaseNet(C) {
  // supabase-js is served from this site (copied from the pinned npm package at build time), never from a CDN.
  if (!window.supabase) await loadScript(new URL('vendor/supabase.js', document.baseURI).href);
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 20 } } });
  const net = pipeNet('supabase', name => {
    const ch = sb.channel('nysc3d:' + name, { config: { broadcast: { self: false, ack: false } } });
    let handler = null, ready = false; const queue = [];
    ch.on('broadcast', { event: 'p' }, ({ payload }) => handler && handler(payload));
    ch.subscribe(status => { if (status === 'SUBSCRIBED') { ready = true; while (queue.length) ch.send({ type: 'broadcast', event: 'p', payload: queue.shift() }); } });
    return {
      send: m => { if (ready) ch.send({ type: 'broadcast', event: 'p', payload: m }); else if (m.hello || m.bye || queue.length < 2) queue.push(m); },
      listen: f => { handler = f; },
      close: () => { try { sb.removeChannel(ch); } catch (e) { } },
    };
  }, { beat: 2000, minGap: 200 });
  return net;
}
// A shared "presence over messages" layer: every player sends its whole state when it changes (throttled)
// and as a heartbeat; anyone silent for a while is dropped. Peers look like the artifact room's peers.
function pipeNet(kind, open, opt = {}) {
  const me = Math.random().toString(36).slice(2, 10), BEAT = opt.beat || 1000, GAP = opt.minGap || 80, STALE = BEAT * 5;
  const mk = name => {
    const pipe = open(name), mine = {}, others = new Map(), subs = new Set();
    let snap = Object.freeze([]), lastSend = 0, pend = null;
    const rebuild = () => {
      const list = [{ peer: me, isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: Object.freeze({ ...mine }), updatedAt: Date.now() }];
      for (const [peer, v] of others) list.push({ peer, isMe: false, sameTab: false, kind: 'viewer', guest: false, by: null, presence: v.p, updatedAt: v.t });
      snap = Object.freeze(list); for (const f of subs) f({ peers: snap });
    };
    const send = hello => { lastSend = Date.now(); pipe.send({ peer: me, p: mine, hello: !!hello }); };
    pipe.listen(d => {
      if (!d || typeof d.peer !== 'string' || d.peer === me || d.peer.length > 20) return;
      if (d.bye) others.delete(d.peer);
      else { const p = d.p && typeof d.p === 'object' && JSON.stringify(d.p).length < 4096 ? d.p : {}; others.set(d.peer, { p: Object.freeze(p), t: Date.now() }); if (d.hello) setTimeout(() => send(), Math.random() * 300); }
      rebuild();
    });
    const beat = setInterval(() => { if (Date.now() - lastSend > BEAT * 0.9) send(); const now = Date.now(); let gone = false; for (const [k, v] of others) if (now - v.t > STALE) { others.delete(k); gone = true; } if (gone) rebuild(); }, BEAT);
    const bye = () => pipe.send({ peer: me, bye: 1 }); addEventListener('pagehide', bye);
    send(true); setTimeout(rebuild, 0);
    return {
      name,
      presence: p => {
        for (const [k, v] of Object.entries(p)) { if (v === null) delete mine[k]; else mine[k] = v; }
        if (!pend) pend = setTimeout(() => { pend = null; send(); rebuild(); }, Math.max(0, GAP - (Date.now() - lastSend)));
        return Promise.resolve();
      },
      peers: () => snap, onPeers: f => { subs.add(f); setTimeout(() => f({ peers: snap }), 0); return () => subs.delete(f); },
      connected: () => true,
      leave: () => { clearInterval(beat); removeEventListener('pagehide', bye); bye(); setTimeout(() => pipe.close(), 50); subs.clear(); },
    };
  };
  return { kind, lobby: mk('lobby'), join: async name => mk(name) };
}

// Player counts (website only, through Supabase): one anonymous id per device, no names.
export function statsClient() {
  const C = window.NYSC_CONFIG;
  if (!C || !C.supabaseUrl || !C.supabaseAnonKey || /YOUR-/.test(C.supabaseUrl + C.supabaseAnonKey)) return null;
  const H = { apikey: C.supabaseAnonKey, Authorization: 'Bearer ' + C.supabaseAnonKey, 'Content-Type': 'application/json' };
  const rpc = (fn, body) => fetch(`${C.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null).catch(() => null);
  let pid = null; try { pid = localStorage.getItem('nysc3d.pid'); if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('nysc3d.pid', pid); } } catch (e) { pid = 'p' + Math.random().toString(36).slice(2, 14); }
  let first = true;
  return {
    ping: (state, lga, area) => { const b = { p_uid: pid, p_state: state, p_lga: lga || '', p_area: area || '', p_new_session: first }; first = false; return rpc('track_player', b); },
    stats: state => rpc('public_stats', { p_state: state }),
    report: (target, name, text, room) => rpc('report_player', { p_uid: pid, p_target: String(target).slice(0, 40), p_name: name, p_text: text, p_room: String(room || '').slice(0, 80) }),
    survey: (state, lga, again, wants) => fetch(`${C.supabaseUrl}/rest/v1/rpc/submit_survey`, { method: 'POST', headers: H, body: JSON.stringify({ p_uid: pid, p_state: state, p_lga: lga || '', p_again: again, p_wants: wants }) }).then(r => r.ok).catch(() => false),
  };
}
