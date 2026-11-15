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
  return new Response(body, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
}
