import type { ReactNode } from "react";
export const metadata = { title: "NYSC Survival", description: "Survive the service year. A Nigerian corper life game." };
export const viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body style={{ margin: 0, background: "#0d1b14", color: "#f4f1e8", fontFamily: "system-ui, sans-serif" }}>{children}</body></html>);
}
