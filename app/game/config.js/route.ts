// Serves window.NYSC_CONFIG from environment variables for both games (the anon/publishable key is public by design).
// Accepts the names Vercel's Supabase integration creates as well as the NEXT_PUBLIC_ ones. Never the service-role key.
export const dynamic = "force-dynamic";
const pick = (...names: string[]) => { for (const n of names) { const v = process.env[n]; if (v) return v.trim(); } return ""; };
export function GET() {
  const url = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const key = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  const safe = /^https:\/\/[a-z0-9.-]+$/i.test(url.replace(/\/$/, "")) ? url.replace(/\/$/, "") : "";
  const body = `window.NYSC_CONFIG=${JSON.stringify({ supabaseUrl: safe || "https://YOUR-PROJECT-ID.supabase.co", supabaseAnonKey: key, online: !!(safe && key) })};`;
  return new Response(body, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
}
