// The profile page: the account's card and a menu beside the open section (details, classes, password).
// Styles: styles/Profile.css.
import { useId, useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import ProfileClasses from "../components/class/ProfileClasses";
import AppShell from "../components/AppShell";
import Circuit from "../components/Circuit";
import Icon from "../components/Icon";
import PolicyDialog from "../components/PolicyDialog";
import { makeThumb } from "../lab/People";
import "../styles/Profile.css";

// Simple avatar used when the account has no photo
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#d1fae5"/><circle cx="50" cy="38" r="18" fill="#6ee7b7"/><path d="M14 92c4-22 20-32 36-32s32 10 36 32z" fill="#6ee7b7"/></svg>`
  );

const TABS = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "classes", label: "Classes", icon: "users" },
  { id: "password", label: "Password", icon: "key" },
];

const ROLE_LABEL = { student: "Student", faculty: "Instructor", admin: "Admin" };

// ============================================================
// PASSWORD FIELD (label + input + show/hide toggle)
// ============================================================

function PasswordField({ label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="form-field password-field">
      <label htmlFor={id}>{label}</label>

      <div className="password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={18} />
        </button>
      </div>
    </div>
  );
}

/** The top of the open section: its icon on a tile, its name and what it's for. */
function SectionHead({ icon, title, text }) {
  return (
    <div className="section-card-header">
      <span className="icon-tile section-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

// ============================================================
// PROFILE
// ============================================================

export default function Profile() {
  // signing out is in the account menu, at the top right of every page (components/AccountMenu.jsx)
  const { profile, user, changePassword, updateUserProfile } = useAuth();
  // ?tab=classes (or password) opens that tab
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "classes" || t === "password" ? t : "profile";
  });
  const fileInputRef = useRef(null);
  const [reading, setReading] = useState(null); // the privacy notice, open to read

  // Profile form: first, middle and last name, plus optional contact number
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || "",
    middleName: profile?.middleName || "",
    lastName: profile?.lastName || "",
    contactNumber: profile?.contactNumber || "",
  });
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password form
  const [passData, setPassData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Keep the form in sync when the profile updates
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        lastName: profile.lastName || "",
        contactNumber: profile.contactNumber || "",
      });
    }
  }, [profile]);

  const accountEmail = profile?.email || user?.email || "";
  const role = profile?.role || "student";

  // "Cornelio" -> "C."
  const formatMiddleInitial = (middleName) => {
    if (!middleName || !middleName.trim()) return "";
    return `${middleName.trim().charAt(0).toUpperCase()}.`;
  };

  const fullName =
    `${profile?.firstName || ""} ${formatMiddleInitial(profile?.middleName)} ${profile?.lastName || ""}`
      .trim()
      .replace(/\s+/g, " ") ||
    (accountEmail ? accountEmail.split("@")[0].toUpperCase() : "USER");

  // Unsaved changes: lets the Save button reflect what's pending
  const dirty =
    formData.firstName.trim() !== (profile?.firstName || "") ||
    formData.middleName.trim() !== (profile?.middleName || "") ||
    formData.lastName.trim() !== (profile?.lastName || "") ||
    formData.contactNumber.trim() !== (profile?.contactNumber || "");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setProfileSuccess("");
  };

  function switchTab(tab) {
    setActiveTab(tab);
    setProfileError("");
    setProfileSuccess("");
    setPassError("");
    setPassSuccess("");
  }

  // ============================================================
  // SAVE PROFILE
  // ============================================================

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!formData.firstName.trim()) {
      setProfileError("First name is required.");
      return;
    }

    if (!formData.lastName.trim()) {
      setProfileError("Last name is required.");
      return;
    }

    setSaving(true);

    try {
      await updateUserProfile({
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        lastName: formData.lastName.trim(),
        contactNumber: formData.contactNumber.trim(),
      });
      setProfileSuccess("Profile updated successfully!");
    } catch (err) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // AVATAR (stored as base64 in the profile)
  // ============================================================

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file.");
      input.value = "";
      return;
    }

    // keep the image small so the profile document stays light
    if (file.size > 500 * 1024) {
      setProfileError("Please choose an image smaller than 500KB.");
      input.value = "";
      return;
    }

    setUploadingAvatar(true);
    setProfileError("");
    setProfileSuccess("");

    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        // only the photo is saved (with the small copy profile cards show, lab/People.js), so unsaved
        // edits in the form aren't pushed along with it
        await updateUserProfile({ photoURL: reader.result, photoThumb: await makeThumb(reader.result) });
        setProfileSuccess("Profile picture updated successfully!");
      } catch (err) {
        setProfileError(err.message || "Failed to update profile picture.");
      } finally {
        setUploadingAvatar(false);
        input.value = "";
      }
    };

    reader.onerror = () => {
      setProfileError("Failed to read the image file.");
      setUploadingAvatar(false);
      input.value = "";
    };

    reader.readAsDataURL(file);
  };

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (passData.newPassword !== passData.confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }

    if (passData.newPassword.length < 6) {
      setPassError("Password must be at least 6 characters long.");
      return;
    }

    setChangingPass(true);

    try {
      await changePassword(passData.currentPassword, passData.newPassword);
      setPassSuccess("Password updated successfully!");
      setPassData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPassError("Incorrect current password.");
      } else {
        setPassError(err.message || "Failed to update password.");
      }
    } finally {
      setChangingPass(false);
    }
  };

  // what a new password still needs, ticked off as it's typed
  const passRules = [
    { text: "At least 6 characters", met: passData.newPassword.length >= 6 },
    { text: "Both new passwords match", met: !!passData.newPassword && passData.newPassword === passData.confirmPassword },
  ];

  // ============================================================
  // UI
  // ============================================================

  return (
    <AppShell
      className="app-page--content profile-page"
      eyebrow="Account"
      title="Profile"
      subtitle={role === "faculty" ? "Your details, the classes you teach, and your password." : "Your details, your classes and to-dos, and your password."}
    >
      <div className="profile-container">
        {/* The account's card */}
        <section className="pf-card" aria-label="Your account">
          <div className="pf-card__band">
            <Circuit />
          </div>

          <div className="pf-card__photo">
            <img
              src={profile?.photoURL || user?.photoURL || FALLBACK_AVATAR}
              alt="Your profile"
              className={uploadingAvatar ? "is-uploading" : ""}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              hidden
            />

            <button
              className="pf-card__edit"
              title="Change profile picture"
              aria-label="Change profile picture"
              type="button"
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? <span className="spinner-dot" /> : <Icon name="camera" size={15} />}
            </button>
          </div>

          <div className="pf-card__who">
            <h2>{fullName}</h2>
            <span className="pf-card__role">{ROLE_LABEL[role] || role}</span>
          </div>

          <ul className="pf-card__facts">
            <li>
              <Icon name="mail" size={15} />
              <span>{accountEmail}</span>
            </li>
            {profile?.studentId && (
              <li>
                <Icon name="idCard" size={15} />
                <span>ID {profile.studentId}</span>
              </li>
            )}
            {profile?.section && (
              <li>
                <Icon name="users" size={15} />
                <span>Block {profile.section}</span>
              </li>
            )}
          </ul>
        </section>

        {/* The menu */}
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => switchTab(t.id)}
            >
              <Icon name={t.icon} size={17} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Profile */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSubmit} className="profile-form-section">
            <SectionHead icon="user" title="Personal information" text="Your name and contact details." />

            <div className="profile-form-body">
              {profileError && <div className="error-message" role="alert">{profileError}</div>}
              {profileSuccess && <div className="success-message" role="status">{profileSuccess}</div>}

              {/* Names */}
              <div className="form-row cols-3">
                <div className="form-field">
                  <label htmlFor="profile-first">
                    First name<span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="profile-first"
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profile-middle">Middle name</label>
                  <input
                    id="profile-middle"
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    autoComplete="additional-name"
                    placeholder="Optional"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="profile-last">
                    Last name<span className="required-star" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="profile-last"
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              {/* Email (read-only) + contact */}
              <div className="form-row cols-2">
                <div className="form-field readonly-field">
                  <label htmlFor="profile-email">School email</label>

                  <div className="readonly-wrap">
                    <input
                      id="profile-email"
                      type="email"
                      value={accountEmail}
                      readOnly
                      disabled
                    />

                    <svg className="readonly-lock" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>

                  <small className="field-hint">Managed by the ARBuild administrator</small>
                </div>

                <div className="form-field">
                  <label htmlFor="profile-contact">Contact number</label>
                  <input
                    id="profile-contact"
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    autoComplete="tel"
                    placeholder="Optional, e.g., 09XXXXXXXXX"
                  />
                </div>
              </div>

              {/* Data privacy notice */}
              <div className="data-privacy-notice">
                <Icon name="info" size={16} />
                <p>
                  <strong>Data privacy notice:</strong> By updating your profile, you consent to the processing of your academic information in compliance with the Data Privacy Act. Data collected is strictly utilized for institutional laboratory records, grading, and AR simulation credentials within Universidad de Dagupan.{" "}
                  <button type="button" className="policy-link" onClick={() => setReading("privacy")}>Read the full notice</button>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions">
              {dirty && <span className="form-actions__note">Unsaved changes</span>}
              <button type="submit" className="btn btn--primary" disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {/* Tab: Classes */}
        {activeTab === "classes" && (
          <section className="profile-form-section" aria-label="Classes">
            <SectionHead
              icon="users"
              title={role === "faculty" ? "Classes you teach" : "My classes"}
              text={role === "faculty" ? "Your classes, their join codes, and messages waiting for you." : "The classes you've joined, and what's new in each."}
            />

            <div className="profile-form-body">
              <ProfileClasses user={user} profile={profile} />
            </div>
          </section>
        )}

        {/* Tab: Password */}
        {activeTab === "password" && (
          <form onSubmit={handlePasswordChange} className="profile-form-section">
            <SectionHead icon="key" title="Change password" text="Choose one you don't use anywhere else." />

            <div className="profile-form-body">
              {passError && <div className="error-message" role="alert">{passError}</div>}
              {passSuccess && <div className="success-message" role="status">{passSuccess}</div>}

              <div className="password-block">
                <PasswordField
                  label="Current password"
                  value={passData.currentPassword}
                  onChange={(v) => setPassData({ ...passData, currentPassword: v })}
                  autoComplete="current-password"
                />

                <PasswordField
                  label="New password"
                  value={passData.newPassword}
                  onChange={(v) => setPassData({ ...passData, newPassword: v })}
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirm new password"
                  value={passData.confirmPassword}
                  onChange={(v) => setPassData({ ...passData, confirmPassword: v })}
                  autoComplete="new-password"
                />

                <ul className="pass-rules">
                  {passRules.map((r) => (
                    <li key={r.text} className={r.met ? "is-met" : ""}>
                      <Icon name={r.met ? "check" : "minus"} size={14} strokeWidth={2.6} />
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={changingPass}>
                {changingPass ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        )}
      </div>
      {reading && <PolicyDialog which={reading} onClose={() => setReading(null)} />}
    </AppShell>
  );
}
