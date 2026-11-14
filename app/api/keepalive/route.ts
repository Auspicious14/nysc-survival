// Keeps the free Supabase project awake: Supabase pauses free projects after 7 days without activity.
// Vercel Cron calls this once a day (see vercel.json); it runs one tiny read against the database.
export const dynamic = "force-dynamic";
const pick = (...names: string[]) => { for (const n of names) { const v = process.env[n]; if (v) return v.trim(); } return ""; };
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const url = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL").replace(/\/$/, "");
  const key = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return Response.json({ ok: false, reason: "Supabase env vars missing" }, { status: 500 });
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const started = Date.now();
  // 1) a real query (counts as database activity); falls back to the API root if the table isn't there yet
  let r = await fetch(`${url}/rest/v1/keepalive?select=id&limit=1`, { headers, cache: "no-store" });
  let via = "keepalive table";
  if (r.status === 404 || r.status === 400) { r = await fetch(`${url}/rest/v1/`, { headers, cache: "no-store" }); via = "api root"; }
  return Response.json({ ok: r.ok, status: r.status, via, ms: Date.now() - started, at: new Date().toISOString() });
}
