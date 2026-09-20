import { Link } from "react-router-dom";

export default function ModePlaceholder({ title }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
      <p className="eyebrow">Coming up next</p>
      <h1 style={{ fontFamily: "var(--font-display)" }}>{title}</h1>
      <p style={{ color: "var(--text-muted)", maxWidth: 420 }}>
        The 3D viewer and interaction logic for this mode haven't been built
        yet — this is the next milestone.
      </p>
      <Link to="/main" className="focus-ring" style={{ color: "var(--accent-cyan)" }}>
        ← Back to main menu
      </Link>
    </div>
  );
}
