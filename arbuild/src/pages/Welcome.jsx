import { useAuth } from "../context/AuthContext";
import "../styles/Welcome.css";

export default function Welcome() {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="welcome">
      <div className="welcome__pins" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="pin" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>

      <main className="welcome__panel">
        <p className="eyebrow">CDD · Computer Systems Servicing</p>
        <h1 className="welcome__title">
          AR<span className="welcome__title-accent">Build</span>
        </h1>
        <p className="welcome__subtitle">
          Augmented Reality-Based Computer Assembly Learning System
        </p>

        <p className="welcome__desc">
          Practice building and taking apart a real desktop — motherboard,
          CPU, RAM, storage, PSU, and every cable in between — before you
          touch a real one. Place a part wrong here, and it teaches you why
          that mistake costs money in the lab.
        </p>

        <div className="pin-divider" role="presentation" />

        {authError && <p className="welcome__error">{authError}</p>}

        <button className="welcome__cta focus-ring" onClick={signInWithGoogle}>
          <GoogleIcon />
          Sign in with school Google account
        </button>

        <p className="welcome__hint">Restricted to @cdd.edu.ph accounts</p>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}
