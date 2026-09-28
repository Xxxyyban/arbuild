import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Profile.css";

const SECTION_PATTERN = /^\d{2}-[A-Z]{2,4}-\d{2}$/;

export default function Profile() {
  const { profile, user, logout, changePassword, updateUserProfile, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const fileInputRef = useRef(null);

  // Profile Form State
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || "",
    middleName: profile?.middleName || "",
    lastName: profile?.lastName || "",
    studentId: profile?.studentId || "",
    section: profile?.section || "",
    contactNumber: profile?.contactNumber || "",
  });
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password Form State & Visibility Toggles
  const [passData, setPassData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // Syncs profile state instantly when data updates
  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        lastName: profile.lastName || "",
        studentId: profile.studentId || "",
        section: profile.section || "",
        contactNumber: profile.contactNumber || "",
      });
    }
  }, [profile]);

  // Helper to convert middle name into an initial (e.g., "Cornelio" -> "C.")
  const formatMiddleInitial = (middleName) => {
    if (!middleName || !middleName.trim()) return "";
    const trimmed = middleName.trim();
    return `${trimmed.charAt(0).toUpperCase()}.`;
  };

  const formattedMiddle = formatMiddleInitial(profile?.middleName);

  const fullName = profile
    ? `${profile.firstName || ""} ${formattedMiddle} ${profile.lastName || ""}`.trim().replace(/\s+/g, " ")
    : profile?.email ? profile.email.split("@")[0].toUpperCase() : "STUDENT";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (formData.section && !SECTION_PATTERN.test(formData.section.trim().toUpperCase())) {
      setProfileError("Section format must match standard formatting (e.g. 41-ITE-04).");
      return;
    }

    try {
      await updateUserProfile({
        ...formData,
        section: formData.section.trim().toUpperCase(),
      });
      setProfileSuccess("Profile updated successfully!");
    } catch (err) {
      setProfileError(err.message || "Failed to update profile.");
    }
  };

  // Trigger hidden file input click
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Handle Base64 conversion and upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file.");
      return;
    }

    // Optional: limit image size to under 500KB to keep Firestore happy
    if (file.size > 500 * 1024) {
      setProfileError("Please choose an image smaller than 500KB.");
      return;
    }

    setUploadingAvatar(true);
    setProfileError("");
    setProfileSuccess("");

    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result;

      try {
        if (updateAvatar) {
          await updateUserProfile({ ...formData, photoURL: base64String });
        } else {
          await updateUserProfile({ ...formData, photoURL: base64String });
        }
        setProfileSuccess("Profile picture updated successfully!");
      } catch (err) {
        setProfileError(err.message || "Failed to update profile picture.");
      } finally {
        setUploadingAvatar(false);
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      setProfileError("Failed to read the image file.");
      setUploadingAvatar(false);
    };

    reader.readAsDataURL(file);
  };

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
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="profile-container">
      {/* Breadcrumb Navigation */}
      <div className="profile-breadcrumb">
        <Link to="/main" className="profile__back focus-ring">Dashboard</Link> &gt; <span>My Profile</span>
      </div>

      {/* Header Card */}
      <div className="profile-header-card">
        <div className="profile-avatar-wrapper">
          <img
            src={profile?.photoURL || user?.photoURL || "https://via.placeholder.com/100"}
            alt="Profile Avatar"
            className="profile-avatar"
            style={{ opacity: uploadingAvatar ? 0.5 : 1 }}
          />
          {/* Hidden File Input for Base64 Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png, image/jpeg, image/jpg, image/webp"
            style={{ display: "none" }}
          />
          <button 
            className="avatar-edit-btn" 
            title="Change Avatar" 
            type="button" 
            onClick={handleAvatarClick}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <span className="spinner-dot" style={{ width: "10px", height: "10px" }}></span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            )}
          </button>
        </div>
        <div className="profile-header-info">
          <h2>{fullName}</h2>
          <p className="profile-meta">
            <span>ID: {profile?.studentId || "Not Set"}</span> &bull;{" "}
            <span>Block: {profile?.section || "Not Set"}</span> &bull;{" "}
            <span>BSIT</span>
          </p>
          <p className="profile-email">Email: {profile?.email || ""}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "password" ? "active" : ""}`}
          onClick={() => setActiveTab("password")}
        >
          Password
        </button>
      </div>

      {/* Tab Content: Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="profile-form-section">
          <div className="section-card-header">
            <div className="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div>
              <h3>Personal Information</h3>
              <p>Manage your editable name, student ID, year & block, and contact details securely.</p>
            </div>
          </div>

          {profileError && <div className="error-message" style={{ color: "red", marginBottom: "1rem" }}>{profileError}</div>}
          {profileSuccess && <div className="success-message" style={{ color: "green", marginBottom: "1rem" }}>{profileSuccess}</div>}

          <div className="form-group-block">
            <h4 className="group-title">Basic Details</h4>
            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              <div className="form-field">
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label>Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                />
              </div>
              <div className="form-field">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1rem" }}>
              <div className="form-field">
                <label>Student ID Number</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="e.g., 23-1341-847"
                  required
                />
              </div>
              <div className="form-field">
                <label>Year & Block</label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  placeholder="e.g., 41-ITE-04"
                  required
                />
              </div>
              <div className="form-field">
                <label>Contact Number</label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="e.g., 09XXXXXXXXX"
                />
              </div>
            </div>
          </div>

          {/* Data Privacy Notice */}
          <div className="data-privacy-notice" style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", background: "#f8fafc", borderLeft: "3px solid #3b82f6", fontSize: "0.85rem", color: "#475569", borderRadius: "4px" }}>
            <span><strong>Data Privacy Notice:</strong> By updating your profile, you consent to the processing of your academic information in compliance with the Data Privacy Act. Data collected is strictly utilized for institutional laboratory records, grading, and AR simulation credentials within Universidad de Dagupan.</span>
          </div>

          {/* Action Footer */}
          <div className="form-actions" style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <button type="button" className="profile__logout focus-ring" onClick={handleLogout}>
              Log out
            </button>
            <button type="submit" className="save-btn">
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Tab Content: Password */}
      {activeTab === "password" && (
        <form onSubmit={handlePasswordChange} className="profile-form-section">
          <div className="section-card-header">
            <div>
              <h3>Change Password</h3>
              <p>Update your account security credentials here.</p>
            </div>
          </div>

          {passError && <div className="error-message" style={{ color: "red", marginBottom: "1rem" }}>{passError}</div>}
          {passSuccess && <div className="success-message" style={{ color: "green", marginBottom: "1rem" }}>{passSuccess}</div>}

          <div className="form-group-block">
            {/* Current Password Field */}
            <div className="form-field mb-3" style={{ marginBottom: "1rem", position: "relative" }}>
              <label>Current Password</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passData.currentPassword}
                  onChange={(e) => setPassData({ ...passData, currentPassword: e.target.value })}
                  required
                  style={{ width: "100%", paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? (
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

            {/* New Password Field */}
            <div className="form-field mb-3" style={{ marginBottom: "1rem", position: "relative" }}>
              <label>New Password</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passData.newPassword}
                  onChange={(e) => setPassData({ ...passData, newPassword: e.target.value })}
                  required
                  style={{ width: "100%", paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
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

            {/* Confirm New Password Field */}
            <div className="form-field mb-3" style={{ marginBottom: "1rem", position: "relative" }}>
              <label>Confirm New Password</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passData.confirmPassword}
                  onChange={(e) => setPassData({ ...passData, confirmPassword: e.target.value })}
                  required
                  style={{ width: "100%", paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
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
          </div>

          <div className="form-actions" style={{ marginTop: "1.5rem" }}>
            <button type="submit" className="save-btn">
              Update Password
            </button>
          </div>
        </form>
      )}
    </div>
  );
}