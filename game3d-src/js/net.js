// Online corpers. Two transports with the same small surface:
//  - "room": the claude.ai artifact room capability (everyone viewing the game right now)
//  - "local": BroadcastChannel between tabs of this browser (testing, or two players on one computer)
// Everything travels as presence (absolute state), so any viewer can take part; nothing is stored.
export async function connectNet() {
  let room = null;
  try { if (window.claude && window.claude.use) room = await window.claude.use('room'); } catch (e) { room = null; }
  if (room) return wrapRoom(room);
  if (window.BroadcastChannel && !window.__noLocalNet) return localNet();
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
// BroadcastChannel stand-in with the same shape (peers carry .peer, .isMe, .presence, .updatedAt)
function localNet() {
  const me = Math.random().toString(36).slice(2, 10);
  const mk = name => {
    const ch = new BroadcastChannel('nysc3d.' + name), mine = {}, others = new Map(), subs = new Set();
    let snap = Object.freeze([]);
    const rebuild = () => { const list = [{ peer: me, isMe: true, sameTab: true, kind: 'viewer', guest: false, by: null, presence: Object.freeze({ ...mine }), updatedAt: Date.now() }]; for (const [peer, v] of others) list.push({ peer, isMe: false, sameTab: false, kind: 'viewer', guest: false, by: null, presence: v.p, updatedAt: v.t }); snap = Object.freeze(list); for (const f of subs) f({ peers: snap }); };
    ch.onmessage = e => { const d = e.data || {}; if (d.peer === me) return; if (d.bye) others.delete(d.peer); else { others.set(d.peer, { p: Object.freeze(d.p || {}), t: Date.now() }); if (d.hello) send(); } rebuild(); };
    const send = hello => ch.postMessage({ peer: me, p: mine, hello });
    const beat = setInterval(() => { send(); const now = Date.now(); let ch2 = false; for (const [k, v] of others) if (now - v.t > 5000) { others.delete(k); ch2 = true; } if (ch2) rebuild(); }, 1000);
    addEventListener('pagehide', () => ch.postMessage({ peer: me, bye: 1 }));
    send(true); setTimeout(rebuild, 0);
    let pend = null;
    return {
      name,
      presence: p => { for (const [k, v] of Object.entries(p)) { if (v === null) delete mine[k]; else mine[k] = v; } if (!pend) pend = setTimeout(() => { pend = null; send(); rebuild(); }, 80); return Promise.resolve(); },
      peers: () => snap, onPeers: f => { subs.add(f); setTimeout(() => f({ peers: snap }), 0); return () => subs.delete(f); },
      connected: () => true,
      leave: () => { clearInterval(beat); ch.postMessage({ peer: me, bye: 1 }); ch.close(); subs.clear(); },
    };
  };
  const lobby = mk('lobby');
  return { kind: 'local', lobby, join: async name => mk(name) };
}
