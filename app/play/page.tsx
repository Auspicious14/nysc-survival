export const metadata = { title: "Play · NYSC Survival" };
export default function Play() {
  return (<iframe src="/game3d/index.html" title="NYSC Survival 3D" allow="autoplay; fullscreen; clipboard-write" style={{ position: "fixed", inset: 0, width: "100%", height: "100dvh", border: 0 }} />);
}
