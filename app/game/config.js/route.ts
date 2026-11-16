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
  // Only our own old addresses may hand saves over: the browser's Referer tells us where the visitor came from,
  // and a link from anywhere else is ignored. Only known keys in the expected shape, never over an existing save.
  const from = (pick("MOVE_FROM_HOSTS") || "kopalife.vercel.app,nysc-survival.vercel.app").split(",").map(h => h.trim().toLowerCase()).filter(h => /^[a-z0-9.-]+$/.test(h));
  const migrate = `(function(){var TO=${JSON.stringify(moveTo)},FROM=${JSON.stringify(from)},P="kmig=";
var OK={"nysc3d.save.v1":function(v){var o=JSON.parse(v);return !!(o&&typeof o==="object"&&typeof o.cp==="string"&&o.st&&typeof o.st==="object"&&v.length<60000)},
"nysc3d.pid":function(v){return /^p[a-z0-9]{10,30}$/.test(v)},"nysc3d.gfx":function(v){return /^(auto|lite|high)$/.test(v)}};
try{var W=window.top,h=W.location.hash;if(h.indexOf("#"+P)===0){W.history.replaceState(null,"",W.location.pathname+W.location.search);
var ref="";try{ref=new URL(W.document.referrer).hostname.toLowerCase()}catch(e){}
if(FROM.indexOf(ref)>=0){var d=JSON.parse(decodeURIComponent(escape(atob(h.slice(P.length+1)))));
for(var k in d){if(!OK.hasOwnProperty(k)||typeof d[k]!=="string")continue;try{if(OK[k](d[k])&&localStorage.getItem(k)===null)localStorage.setItem(k,d[k])}catch(e){}}}}}catch(e){}
try{if(TO&&FROM.indexOf(location.hostname)>=0&&location.origin!==TO){var o={},n=0;
for(var k in OK){var v=localStorage.getItem(k);if(v!==null){o[k]=v;n++}}
var t=window.top.location;t.replace(TO+t.pathname+t.search+(n?"#"+P+btoa(unescape(encodeURIComponent(JSON.stringify(o)))):""));}}catch(e){}})();`;
  return new Response(body + "\n" + migrate, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
}
