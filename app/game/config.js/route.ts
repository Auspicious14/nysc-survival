// Serves window.NYSC_CONFIG from environment variables for both games (the anon/publishable key is public by design).
// Accepts the names Vercel's Supabase integration creates as well as the NEXT_PUBLIC_ ones. Never the service-role key.
export const dynamic = "force-dynamic";
const pick = (...names: string[]) => { for (const n of names) { const v = process.env[n]; if (v) return v.trim(); } return ""; };
export function GET() {
  const url = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const key = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  // accept "https://xyz.supabase.co", with or without a trailing slash or a path like /rest/v1, or quotes pasted by mistake
  let safe = "";
  try { const u = new URL(url.replace(/^["']|["']$/g, "")); if (u.protocol === "https:" && /^[a-z0-9.-]+$/i.test(u.hostname)) safe = u.origin; } catch (e) { safe = ""; }
  const k = key.replace(/^["']|["']$/g, "");
  const body = `window.NYSC_CONFIG=${JSON.stringify({ supabaseUrl: safe || "https://YOUR-PROJECT-ID.supabase.co", supabaseAnonKey: k, online: !!(safe && k) })};`;
  // Moving players to the main domain (set MOVE_TO_DOMAIN=https://kopalife.com.ng in Vercel when ready).
  // Saves live in each address's own browser storage, so instead of a server redirect the old address
  // packs the player's saves into the link and the new address unpacks them. Nothing goes to any server.
  let moveTo = "";
  try { const m = new URL(pick("MOVE_TO_DOMAIN")); if (m.protocol === "https:") moveTo = m.origin; } catch (e) { moveTo = ""; }
  const migrate = `(function(){var TO=${JSON.stringify(moveTo)},P="kmig=",S="nysc3d.save.v1";
function prog(t){try{var o=JSON.parse(t),d=o&&o.done;return d?(d.length!=null?d.length:Object.keys(d).length):0}catch(e){return 0}}
try{var W=window.top,h=W.location.hash;if(h.indexOf("#"+P)===0){var d=JSON.parse(decodeURIComponent(escape(atob(h.slice(P.length+1)))));
for(var k in d){if(!/^nysc/.test(k)||typeof d[k]!=="string")continue;var mine=localStorage.getItem(k);
if(mine===null||(k===S&&prog(d[k])>prog(mine)))localStorage.setItem(k,d[k]);}
W.history.replaceState(null,"",W.location.pathname+W.location.search);}}catch(e){}
try{if(TO&&/\\.vercel\\.app$/.test(location.hostname)&&location.origin!==TO){var o={},n=0;
for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^nysc/.test(k)){o[k]=localStorage.getItem(k);n++}}
var t=window.top.location;t.replace(TO+t.pathname+t.search+(n?"#"+P+btoa(unescape(encodeURIComponent(JSON.stringify(o)))):""));}}catch(e){}})();`;
  return new Response(body + "\n" + migrate, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
}
