import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/Main.css";

const MODES = [
  {
    key: "learn",
    icon: "◎",
    label: "Learn / Explore",
    desc: "Inspect every part up close and read what it does. No score, no pressure.",
    path: "/learn",
  },
  {
    key: "assemble",
    icon: "▣",
    label: "Assemble",
    desc: "Build a working PC from a bare case. Wrong slot? It'll show you why that matters.",
    path: "/assemble",
  },
  {
    key: "disassemble",
    icon: "▢",
    label: "Disassemble",
    desc: "Take a finished build apart correctly, part by part.",
    path: "/disassemble",
  },
];

export default function MainPage() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="main">
      <header className="main__header">
        <div className="main__identity">
          {user?.photoURL ? (
            <img className="main__avatar" src={user.photoURL} alt="" />
          ) : (
            <div className="main__avatar main__avatar--fallback">
              {(profile?.firstName || "S")[0]}
            </div>
          )}
          <div>
            <p className="eyebrow">ARBuild</p>
            <h1 className="main__greeting">
              Hi, {profile?.firstName || "Student"}
            </h1>
            {profile?.section && (
              <p className="main__section">{profile.section}</p>
            )}
          </div>
        </div>

        <div className="main__header-actions">
          <ThemeToggle />
          <Link to="/profile" className="main__icon-link focus-ring">
            Profile
          </Link>
          <Link to="/credits" className="main__icon-link focus-ring">
            Credits
          </Link>
          <button className="main__icon-link main__icon-link--danger focus-ring" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>

      <div className="pin-divider" />

      <p className="main__section-label">Choose a mode</p>

      <section className="main__modes">
        {MODES.map((mode) => (
          <Link key={mode.key} to={mode.path} className="mode-card focus-ring">
            <span className="mode-card__icon" aria-hidden="true">{mode.icon}</span>
            <span className="mode-card__label">{mode.label}</span>
            <p className="mode-card__desc">{mode.desc}</p>
            <span className="mode-card__go">Open →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}