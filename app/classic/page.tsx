export const metadata = { title: "Classic version", robots: { index: false } };
export default function Classic() {
  return (<iframe src="/game/index.html" title="Kopa Life (classic)" allow="autoplay; fullscreen; clipboard-write" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", border: 0 }} />);
}
