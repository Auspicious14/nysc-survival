import type { ReactNode } from "react";
export const metadata = {
  title: "Otondo · the corper game",
  description: "Survive the service year. A 3D Nigerian corper game: camp, CDS, clearance, PPA and the road to POP.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/otondo-mark.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Otondo", statusBarStyle: "black-translucent" },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1a12", viewportFit: "cover" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body style={{ margin: 0, background: "#0d1b14", color: "#f4f1e8", fontFamily: "system-ui, sans-serif" }}>{children}</body></html>);
}
