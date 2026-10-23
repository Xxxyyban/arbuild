import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import "../styles/ProfileSetup.css";

// ============================================================
// PROFILE SETUP
// Fields: School Email (read-only), First Name, Middle Name
// (optional), Last Name.
// ============================================================

export default function ProfileSetup() {
  const { user, userProfile, completeProfile } = useAuth();

  const isFaculty = userProfile?.role === "faculty";

  // Provided by the admin-created account. The user can't change it.
  const accountEmail = user?.email || userProfile?.email || "";

  // Pre-fill from the account's display name if we have one
  const guessedNames = splitGuessedName(
    user?.displayName || userProfile?.displayName || ""
  );

  const [firstName, setFirstName] = useState(
    userProfile?.firstName || guessedNames.first
  );
  const [middleName, setMiddleName] = useState(userProfile?.middleName || "");
  const [lastName, setLastName] = useState(
    userProfile?.lastName || guessedNames.last
  );

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ==========================================================
  // SUBMIT
  // ==========================================================

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    setSubmitting(true);

    try {
      await completeProfile({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
      });

      // AuthContext handles profileCompleted = true
      // and App.jsx redirects the user to /main.
    } catch (err) {
      console.error("Profile setup error:", err);
      setError(
        "Something went wrong while saving your profile. Please try again."
      );
      setSubmitting(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="setup-layout">
      {/* ======================= LEFT BRAND PANEL ======================= */}

      <div className="setup-brand-panel">
        <div className="brand-glow-orb"></div>

        <div className="brand-content animate-fade-in">
          <div className="brand-logo-badge">
            <Logo size={44} />
          </div>

          <h1>
            AR<span className="brand-highlight">BUILD</span>
          </h1>

          <p className="brand-tagline">
            {isFaculty
              ? "Confirm your name to access the ARBuild learning environment."
              : "Confirm your name to initialize your ARBuild learning workspace."}
          </p>

          <div className="setup-steps-indicator">
            <div className="step-item completed">
              <span className="step-dot">✓</span>
              Account Created by Admin
            </div>

            <div className="step-item active">
              <span className="step-dot">2</span>
              Profile Setup
            </div>

            <div className="step-item">
              <span className="step-dot">3</span>
              ARBuild Workspace
            </div>
          </div>
        </div>

        <div className="brand-footer animate-slide-up">
          <div className="developer-info">
            <span className="dev-label">INSTITUTION</span>
            <div className="dev-name">Universidad de Dagupan — SITE</div>
          </div>
        </div>
      </div>

      {/* ======================= RIGHT FORM PANEL ======================= */}

      <div className="setup-form-panel">
        <div className="setup-form-card animate-scale-in">
          <div className="form-header">
            <span className="form-tag">ONE-TIME CONFIGURATION</span>

            <h2>Complete your profile</h2>

            <p>Confirm your name before accessing the ARBuild workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="setup-form-body">
            {/* School email: automatic and read-only */}
            <div className="account-email-display">
              <span className="field__label">School Email</span>

              <div className="account-email-box">
                <span>{accountEmail || "No email available"}</span>
                <small>Managed by ARBuild Administrator</small>
              </div>
            </div>

            <div className="setup__row">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                required
              />

              <Field
                label="Middle name"
                value={middleName}
                onChange={setMiddleName}
                placeholder="Optional"
              />
            </div>

            <Field
              label="Last name"
              value={lastName}
              onChange={setLastName}
              required
            />

            {error && <div className="setup__error animate-shake">{error}</div>}

            <button
              className="setup__submit focus-ring"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="btn-spinner-content">
                  <span className="spinner-dot"></span>
                  Saving Profile...
                </span>
              ) : (
                "Continue to ARBuild Workspace →"
              )}
            </button>
          </form>
        </div>

        <div className="footer-copyright">
          <span>Secure Academic Environment</span>
          <span>•</span>
          <span>ARBuild Environment v2.6</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FIELD COMPONENT
// ============================================================

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {required && <span className="required-star">*</span>}
      </span>

      <input
        className="field__input focus-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

// ============================================================
// NAME HELPER
// ============================================================

function splitGuessedName(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };

  return { first: parts[0], last: parts[parts.length - 1] };
}