import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfileSetup.css";

const SECTION_PATTERN = /^\d{2}-[A-Z]{2,4}-\d{2}$/;

export default function ProfileSetup() {
  const { user, completeProfile } = useAuth();

  const guessedNames = splitGuessedName(user?.displayName || "");

  const [firstName, setFirstName] = useState(guessedNames.first);
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState(guessedNames.last);
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!SECTION_PATTERN.test(section.trim().toUpperCase())) {
      setError("Section must match the format 41-ITE-04.");
      return;
    }

    setSubmitting(true);
    try {
      await completeProfile({
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        section: section.trim().toUpperCase(),
      });
    } catch {
      setError("Something went wrong saving your profile. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="setup">
      <form className="setup__panel" onSubmit={handleSubmit}>
        <p className="eyebrow">One-time setup</p>
        <h1 className="setup__title">Complete your profile</h1>
        <p className="setup__subtitle">
          We use this to label your progress and scores. You won't be asked
          again.
        </p>

        <div className="pin-divider" />

        <div className="setup__row">
          <Field label="First name" value={firstName} onChange={setFirstName} required />
          <Field label="Middle name" value={middleName} onChange={setMiddleName} placeholder="Optional" />
        </div>
        <Field label="Last name" value={lastName} onChange={setLastName} required />
        <Field
          label="Year & Block"
          value={section}
          onChange={(v) => setSection(v.toUpperCase())}
          placeholder="e.g. 41-ITE-04"
          required
        />

        {error && <p className="setup__error">{error}</p>}

        <button className="setup__submit focus-ring" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Continue to ARBuild"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
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
