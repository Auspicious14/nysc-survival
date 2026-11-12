import Link from "next/link";
export default function Home() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 56 }}>🇳🇬</div>
        <h1 style={{ fontSize: 40, margin: "8px 0" }}>NYSC Survival</h1>
        <p style={{ opacity: 0.85, lineHeight: 1.5 }}>Camp, CDS, clearance, PPA, group-chat rumours and the road to POP. A fictional corper life game. Not an official NYSC product.</p>
        <Link href="/play" style={{ display: "inline-block", marginTop: 16, padding: "14px 28px", background: "#1f9d55", color: "#fff", borderRadius: 12, fontWeight: 700, textDecoration: "none" }}>Play now</Link>
      </div>
    </main>
  );
}
