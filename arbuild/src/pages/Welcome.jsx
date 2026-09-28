import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Welcome.css";

export default function Welcome() {
  const { loginWithEmail, authError, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // Starts blank
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await loginWithEmail(email, password);
  };

  return (
    <div className="welcome-layout">
      {/* Left Brand Panel with Animated Gradient & Floating Elements */}
      <div className="welcome-brand-panel">
        <div className="brand-glow-orb"></div>
        <div className="brand-glow-orb-secondary"></div>
        
        <div className="brand-content animate-fade-in">
          <div className="brand-logo-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V5a1 1 0 0 1 1-1h3" />
              <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
              <path d="M4 16v3a1 1 0 0 0 1 1h3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
              <rect x="8" y="8" width="8" height="8" rx="1.5" fill="#34d399" fillOpacity="0.25" stroke="#34d399" strokeWidth="1.5" />
              <line x1="10" y1="5.5" x2="10" y2="8" stroke="#34d399" strokeWidth="1.5" />
              <line x1="14" y1="5.5" x2="14" y2="8" stroke="#34d399" strokeWidth="1.5" />
              <line x1="10" y1="16" x2="10" y2="18.5" stroke="#34d399" strokeWidth="1.5" />
              <line x1="14" y1="16" x2="14" y2="18.5" stroke="#34d399" strokeWidth="1.5" />
              <line x1="5.5" y1="10" x2="8" y2="10" stroke="#34d399" strokeWidth="1.5" />
              <line x1="5.5" y1="14" x2="8" y2="14" stroke="#34d399" strokeWidth="1.5" />
              <line x1="16" y1="10" x2="18.5" y2="10" stroke="#34d399" strokeWidth="1.5" />
              <line x1="16" y1="14" x2="18.5" y2="14" stroke="#34d399" strokeWidth="1.5" />
            </svg>
          </div>
          <h1>AR<span className="brand-highlight">BUILD</span></h1>
          <p className="brand-tagline">
            An immersive 3D and AR PC assembly and troubleshooting simulator designed for next-generation hardware mastery.
          </p>

          <div className="store-badges">
            <div className="store-badge-mock">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <span>AR WebXR Ready</span>
            </div>
            <div className="store-badge-mock">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Three.js Powered</span>
            </div>
          </div>
        </div>

        <div className="brand-footer animate-slide-up">
          <div className="developer-info">
            <span className="dev-label">DEVELOPED BY</span>
            <div className="dev-name">Universidad de Dagupan — ITE</div>
          </div>
          <div className="team-info">
            <span className="dev-label">PROJECT MODULE</span>
            <div className="team-members">Interactive PC Builder</div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="welcome-form-panel">
        <div className="welcome-form-card animate-scale-in">
          <div className="form-header">
            <h2>Welcome back</h2>
            <p>Please enter your details to sign in.</p>
          </div>

          {authError && <div className="auth-error-banner animate-shake">{authError}</div>}

          <form onSubmit={handleSubmit} className="auth-input-form" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="input-group">
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                Email Address or ID
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "14px", color: "#94a3b8" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </span>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@cdd.edu.ph"
                  required
                  style={{ width: "100%", padding: "12px 12px 12px 42px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.95rem", outline: "none", backgroundColor: "#ffffff" }}
                />
              </div>
            </div>

            <div className="input-group">
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "14px", color: "#94a3b8" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: "100%", padding: "12px 42px 12px 42px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.95rem", outline: "none", backgroundColor: "#ffffff" }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "14px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="google-signin-btn focus-ring"
              style={{ backgroundColor: "#2563eb", color: "#ffffff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontWeight: "600", padding: "14px", borderRadius: "10px", cursor: "pointer", transition: "background 0.2s" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>{loading ? "Signing in..." : "Sign in"}</span>
            </button>
          </form>
        </div>

        <div className="footer-copyright">
          <span>© 2026 Universidad de Dagupan</span>
          <span className="dot-separator">•</span>
          <span>ARBuild Studio</span>
        </div>
      </div>
    </div>
  );
}