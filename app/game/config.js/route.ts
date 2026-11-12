// Serves window.NYSC_CONFIG from environment variables (anon key is public by design).
export const dynamic = "force-dynamic";
export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const body = `window.NYSC_CONFIG=${JSON.stringify({ supabaseUrl: url || "https://YOUR-PROJECT-ID.supabase.co", supabaseAnonKey: key })};`;
  return new Response(body, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
}
