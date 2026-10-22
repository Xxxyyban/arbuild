import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Profile.css";

// Simple avatar used when the account has no photo
const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#d1fae5"/><circle cx="50" cy="38" r="18" fill="#6ee7b7"/><path d="M14 92c4-22 20-32 36-32s32 10 36 32z" fill="#6ee7b7"/></svg>`
  );

// ============================================================
// PASSWORD FIELD (label + input + show/hide toggle)
// ============================================================

function PasswordField({ label, value, onChange }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-field password-field">
      <label>{label}</label>

      <div className="password-wrap">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// PROFILE
// ============================================================

export default function Profile() {
  const { profile, user, logout, changePassword, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const fileInputRef = useRef(null);

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

  // Show ID / block only if the account has them
  const metaParts = [
    profile?.studentId && `ID: ${profile.studentId}`,
    profile?.section && `Block: ${profile.section}`,
  ].filter(Boolean);

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
        // only the photo is saved, so unsaved edits in the form aren't pushed along with it
        await updateUserProfile({ photoURL: reader.result });
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

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="profile-container">
      {/* Breadcrumb */}
      <div className="profile-breadcrumb">
        <Link to="/main" className="profile__back focus-ring">Dashboard</Link> &gt; <span>My Profile</span>
      </div>

      {/* Header card */}
      <div className="profile-header-card">
        <div className="profile-avatar-wrapper">
          <img
            src={profile?.photoURL || user?.photoURL || FALLBACK_AVATAR}
            alt="Profile Avatar"
            className={`profile-avatar ${uploadingAvatar ? "is-uploading" : ""}`}
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            hidden
          />

          <button
            className="avatar-edit-btn"
            title="Change Avatar"
            aria-label="Change profile picture"
            type="button"
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <span className="spinner-dot"></span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            )}
          </button>
        </div>

        <div className="profile-header-info">
          <div className="profile-name-row">
            <h2>{fullName}</h2>
            <span className={`profile-role-badge ${role}`}>{role}</span>
          </div>

          {metaParts.length > 0 && (
            <p className="profile-meta">{metaParts.join(" • ")}</p>
          )}

          <p className="profile-email">{accountEmail}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "profile"}
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => switchTab("profile")}
        >
          Profile
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "password"}
          className={`tab-btn ${activeTab === "password" ? "active" : ""}`}
          onClick={() => switchTab("password")}
        >
          Password
        </button>
      </div>

      {/* Tab: Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="profile-form-section">
          <div className="section-card-header">
            <div className="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>

            <div>
              <h3>Personal Information</h3>
              <p>Manage your name and contact details.</p>
            </div>
          </div>

          <div className="profile-form-body">
            {profileError && <div className="error-message">{profileError}</div>}
            {profileSuccess && <div className="success-message">{profileSuccess}</div>}

            {/* Names */}
            <div className="form-row cols-3">
              <div className="form-field">
                <label htmlFor="profile-first">
                  First Name<span className="required-star">*</span>
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
                <label htmlFor="profile-middle">Middle Name</label>
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
                  Last Name<span className="required-star">*</span>
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
                <label htmlFor="profile-email">School Email</label>

                <div className="readonly-wrap">
                  <input
                    id="profile-email"
                    type="email"
                    value={accountEmail}
                    readOnly
                    disabled
                  />

                  <svg className="readonly-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>

                <small className="field-hint">Managed by ARBuild Administrator</small>
              </div>

              <div className="form-field">
                <label htmlFor="profile-contact">Contact Number</label>
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
              <strong>Data Privacy Notice:</strong> By updating your profile, you consent to the processing of your academic information in compliance with the Data Privacy Act. Data collected is strictly utilized for institutional laboratory records, grading, and AR simulation credentials within Universidad de Dagupan.
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="profile__logout focus-ring" onClick={handleLogout}>
              Log out
            </button>

            <button type="submit" className="save-btn" disabled={saving || !dirty}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Tab: Password */}
      {activeTab === "password" && (
        <form onSubmit={handlePasswordChange} className="profile-form-section">
          <div className="section-card-header">
            <div className="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>

            <div>
              <h3>Change Password</h3>
              <p>Update your account security credentials here.</p>
            </div>
          </div>

          <div className="profile-form-body">
            {passError && <div className="error-message">{passError}</div>}
            {passSuccess && <div className="success-message">{passSuccess}</div>}

            <div className="password-block">
              <PasswordField
                label="Current Password"
                value={passData.currentPassword}
                onChange={(v) => setPassData({ ...passData, currentPassword: v })}
              />

              <PasswordField
                label="New Password"
                value={passData.newPassword}
                onChange={(v) => setPassData({ ...passData, newPassword: v })}
              />

              <PasswordField
                label="Confirm New Password"
                value={passData.confirmPassword}
                onChange={(v) => setPassData({ ...passData, confirmPassword: v })}
              />

              <small className="field-hint">At least 6 characters.</small>
            </div>
          </div>

          <div className="form-actions form-actions-end">
            <button type="submit" className="save-btn" disabled={changingPass}>
              {changingPass ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}