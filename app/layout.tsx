import type { ReactNode } from "react";
export const metadata = {
  metadataBase: new URL("https://kopalife.com.ng"),
  title: { default: "Kopa Life: the NYSC Corper Game · Play Free", template: "%s · Kopa Life" },
  description: "Kopa Life is a free 3D NYSC game. Survive orientation camp, CDS, clearance and your PPA on real streets from all 36 states and the FCT. No download.",
  applicationName: "Kopa Life",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/kopalife-mark.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kopa Life", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "Kopa Life", locale: "en_NG", images: [{ url: "/brand/og.jpg", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/brand/og.jpg"] },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1a12", viewportFit: "cover" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en-NG"><body style={{ margin: 0, background: "#0d1b14", color: "#f4f1e8", fontFamily: "system-ui, sans-serif" }}>{children}</body></html>);
}
