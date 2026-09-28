import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfileSetup.css";

const SECTION_PATTERN = /^\d{2}-[A-Z]{2,4}-\d{2}$/;

export default function ProfileSetup() {
  const { user, userProfile, completeProfile } = useAuth();

  // Auto-derived role from AuthContext
  const role = userProfile?.role || "student";
  const isFaculty = role === "faculty";

  const guessedNames = splitGuessedName(user?.displayName || "");

  // Student state
  const [firstName, setFirstName] = useState(guessedNames.first);
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState(guessedNames.last);
  const [studentId, setStudentId] = useState("");
  const [section, setSection] = useState("");

  // Faculty state
  const [facultyTitle, setFacultyTitle] = useState("Prof.");
  const [department, setDepartment] = useState("Information Technology Education");
  const [facultyId, setFacultyId] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isFaculty) {
      if (!facultyId.trim() || !department.trim()) {
        setError("Faculty ID and department are required.");
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError("First and last name are required.");
        return;
      }
      if (!studentId.trim()) {
        setError("Student ID number is required.");
        return;
      }
      if (!SECTION_PATTERN.test(section.trim().toUpperCase())) {
        setError("Section format must match standard formatting (e.g. 41-ITE-04).");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = isFaculty
        ? {
            facultyTitle: facultyTitle.trim(),
            department: department.trim(),
            facultyId: facultyId.trim(),
            role: "faculty",
          }
        : {
            firstName: firstName.trim(),
            middleName: middleName.trim(),
            lastName: lastName.trim(),
            studentId: studentId.trim(),
            section: section.trim().toUpperCase(),
            role: "student",
          };

      await completeProfile(payload);
    } catch {
      setError("Something went wrong saving your profile. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="setup-layout">
      {/* Left Brand Panel */}
      <div className="setup-brand-panel">
        <div className="brand-glow-orb"></div>
        <div className="brand-content animate-fade-in">
          <div className="brand-logo-badge">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V5a1 1 0 0 1 1-1h3" />
              <path d="M20 8V5a1 1 0 0 0-1-1h-3" />
              <path d="M4 16v3a1 1 0 0 0 1 1h3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
              <rect x="8" y="8" width="8" height="8" rx="1.5" fill="#34d399" fillOpacity="0.2" stroke="#34d399" strokeWidth="1.5" />
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
            {isFaculty
              ? "Faculty Portal: Track student simulation progress, view class standings, and manage laboratory submissions."
              : "Configure your student identity to initialize your laboratory workspace, records, and AR simulation credentials."}
          </p>

          <div className="setup-steps-indicator">
            <div className="step-item completed">
              <span className="step-dot">✓</span> Google Authentication ({isFaculty ? "Faculty Account" : "Student Account"})
            </div>
            <div className="step-item active">
              <span className="step-dot">2</span> {isFaculty ? "Faculty Profile Setup" : "Academic Profile Setup"}
            </div>
          </div>
        </div>

        <div className="brand-footer animate-slide-up">
          <div className="developer-info">
            <span className="dev-label">INSTITUTION</span>
            <div className="dev-name">Universidad de Dagupan — ITE</div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="setup-form-panel">
        <div className="setup-form-card animate-scale-in">
          <div className="form-header">
            <span className="form-tag">ONE-TIME CONFIGURATION</span>
            <h2>{isFaculty ? "Set up faculty profile" : "Complete your profile"}</h2>
            <p>
              {isFaculty
                ? "Enter your academic credentials to unlock instructor tracking tools."
                : "We use this information to label your lab scores and progress safely."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="setup-form-body">
            {isFaculty ? (
              <>
                <Field 
                  label="Title & Name" 
                  value={facultyTitle} 
                  onChange={setFacultyTitle} 
                  placeholder="e.g. Prof. / Dr." 
                  required 
                />
                <Field 
                  label="Faculty ID Number" 
                  value={facultyId} 
                  onChange={setFacultyId} 
                  placeholder="e.g. FAC-2026-001" 
                  required 
                />
                <Field 
                  label="Department / College" 
                  value={department} 
                  onChange={setDepartment} 
                  required 
                />
              </>
            ) : (
              <>
                <div className="setup__row">
                  <Field label="First name" value={firstName} onChange={setFirstName} required />
                  <Field label="Middle name" value={middleName} onChange={setMiddleName} placeholder="Optional" />
                </div>
                
                <Field label="Last name" value={lastName} onChange={setLastName} required />
                
                <Field
                  label="Student ID Number"
                  value={studentId}
                  onChange={setStudentId}
                  placeholder="e.g. 23-1341-847"
                  required
                />

                <Field
                  label="Year & Block"
                  value={section}
                  onChange={(v) => setSection(v.toUpperCase())}
                  placeholder="e.g. 41-ITE-04"
                  required
                />
              </>
            )}

            {error && <div className="setup__error animate-shake">{error}</div>}

            <button className="setup__submit focus-ring" type="submit" disabled={submitting}>
              {submitting ? (
                <span className="btn-spinner-content">
                  <span className="spinner-dot"></span> Saving Profile...
                </span>
              ) : (
                isFaculty ? "Open Faculty Dashboard →" : "Continue to ARBuild Workspace"
              )}
            </button>
          </form>
        </div>

        <div className="footer-copyright">
          <span>Secure Academic Ledger</span>
          <span>•</span>
          <span>ARBuild Environment v2.6</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <span className="required-star">*</span>}
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

function splitGuessedName(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts[parts.length - 1] };
}