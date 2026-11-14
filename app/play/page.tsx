export const metadata = { title: "Play · Otondo" };
// Invite links like /play?state=NR&lga=Lafia are passed through to the game.
export default function Play({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const qs = new URLSearchParams();
  for (const k of ["state", "lga", "ref", "source"]) { const v = searchParams?.[k]; if (typeof v === "string" && v.length < 60) qs.set(k, v); }
  const q = qs.toString();
  return (<iframe src={"/game3d/index.html" + (q ? "?" + q : "")} title="Otondo 3D" allow="autoplay; fullscreen; clipboard-write; web-share" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", border: 0 }} />);
}
