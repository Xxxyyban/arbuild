import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import "../styles/Welcome.css";
import { APP_CHECK_ON } from "../firebase/config";

// Copper "traces" running from a CPU socket out to the board edge.
const TRACES = [
  "M150 170 H90 V110 H40",
  "M150 200 H60 V200 H20",
  "M150 230 H90 V290 H40",
  "M170 150 V90 H230 V40",
  "M200 150 V60 H200 V20",
  "M230 250 V310 H170 V360",
  "M250 170 H310 V110 H360",
  "M250 200 H340 H380",
  "M250 230 H310 V290 H360",
  "M200 250 V340 H260 V380",
];

const PADS = [
  [40, 110], [20, 200], [40, 290], [230, 40], [200, 20],
  [170, 360], [360, 110], [380, 200], [360, 290], [260, 380],
];

export default function Welcome() {
  const { loginWithEmail, authError, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await loginWithEmail(email.trim(), password);
  };

  return (
    <main className="wl">
      {/* Brand side: a circuit board that "draws" itself once on load */}
      <section className="wl-brand" aria-label="About ARBuild">
        <div className="wl-brand-text">
          <p className="wl-wordmark">
            <Logo size={48} />
            ARBuild
          </p>
          <h1 className="wl-headline">Build a PC before you touch one.</h1>
          <p className="wl-sub">Practise assembly and troubleshooting in 3D and AR.</p>
        </div>

        <svg
          className="wl-board"
          viewBox="0 0 400 400"
          role="img"
          aria-label="Circuit board with a processor socket in the center"
        >
          {TRACES.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength="1"
              className="wl-trace"
              style={{ animationDelay: `${0.15 + i * 0.08}s` }}
            />
          ))}
          {PADS.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="5"
              className="wl-pad"
              style={{ animationDelay: `${0.9 + i * 0.06}s` }}
            />
          ))}
          <rect x="150" y="150" width="100" height="100" rx="6" className="wl-chip" />
          <rect x="172" y="172" width="56" height="56" rx="3" className="wl-die" />
          <circle cx="160" cy="160" r="3" className="wl-pin1" />
        </svg>

        <p className="wl-credit">Universidad de Dagupan · SITE</p>
      </section>

      {/* Form side */}
      <section className="wl-form-side">
        <div className="wl-card">
          <h2 className="wl-title">Sign in</h2>
          <p className="wl-lead">Use your school email.</p>

          {authError && (
            <div className="wl-error" role="alert">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="wl-form" noValidate={false}>
            <div className="wl-field">
              <label htmlFor="wl-email">Email address</label>
              <input
                id="wl-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@cdd.edu.ph"
                required
              />
            </div>

            <div className="wl-field">
              <label htmlFor="wl-password">Password</label>
              <div className="wl-password">
                <input
                  id="wl-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="wl-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" className="wl-submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="wl-note">
            Sign-ins are logged with time, device and rough location, for security.
            {APP_CHECK_ON && (
              <>
                {" "}This site is protected by reCAPTCHA, and the Google{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and{" "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Terms of Service</a> apply.
              </>
            )}
          </p>
        </div>

        <p className="wl-footer">© 2026 Universidad de Dagupan · ARBuild Studio</p>
      </section>
    </main>
  );
}