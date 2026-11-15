export const metadata = {
  title: "Play the NYSC Game Free in Your Browser",
  description: "Play Kopa Life now: get your call-up letter, report to orientation camp and live the corper life on real streets in your state. Free, no download, works on phones.",
  alternates: { canonical: "/play" },
  openGraph: { title: "Play Kopa Life: the NYSC corper game", url: "/play" },
};
// Invite links like /play?state=NR&lga=Lafia are passed through to the game.
export default function Play({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const qs = new URLSearchParams();
  for (const k of ["state", "lga", "ref", "source"]) { const v = searchParams?.[k]; if (typeof v === "string" && v.length < 60) qs.set(k, v); }
  const q = qs.toString();
  return (<>
    <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Kopa Life: play the NYSC corper game</h1>
    <iframe src={"/game3d/index.html" + (q ? "?" + q : "")} title="Kopa Life: the NYSC corper game" allow="autoplay; fullscreen; clipboard-write; web-share" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", border: 0 }} />
  </>);
}
