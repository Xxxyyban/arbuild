import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Main.css";

const MODES = [
  {
    key: "learn",
    label: "Learn / Explore",
    desc: "Inspect every part up close and read what it does. No score, no pressure.",
    path: "/learn",
  },
  {
    key: "assemble",
    label: "Assemble",
    desc: "Build a working PC from a bare case. Wrong slot? It'll show you why that matters.",
    path: "/assemble",
  },
  {
    key: "disassemble",
    label: "Disassemble",
    desc: "Take a finished build apart correctly, part by part.",
    path: "/disassemble",
  },
];

export default function MainPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="main">
      <header className="main__header">
        <div>
          <p className="eyebrow">ARBuild</p>
          <h1 className="main__greeting">
            Hi, {profile?.firstName || "Student"}
          </h1>
        </div>
        <div className="main__header-actions">
          <Link to="/profile" className="main__icon-link focus-ring">Profile</Link>
          <button className="main__icon-link focus-ring" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <div className="pin-divider" />

      <section className="main__modes">
        {MODES.map((mode) => (
          <Link key={mode.key} to={mode.path} className="mode-card focus-ring">
            <span className="mode-card__label">{mode.label}</span>
            <p className="mode-card__desc">{mode.desc}</p>
            <span className="mode-card__go">Open →</span>
          </Link>
        ))}
      </section>

      <p style={{ textAlign: "center", marginTop: 32 }}>
        <Link to="/credits" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          3D asset credits
        </Link>
      </p>
    </div>
  );
}