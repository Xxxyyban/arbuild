import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as signOutSecondary,
} from "firebase/auth";

import { getApp, getApps, initializeApp } from "firebase/app";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { useAuth } from "../context/AuthContext";

import { auth, db, ALLOWED_DOMAINS } from "../firebase/config";

import "../styles/Admin.css";

const DEFAULT_PASSWORD = "Universidad2026";
const MAX_BULK = 200;

const VIEWS = {
  dashboard: {
    title: "Dashboard",
    text: "A quick look at your student and faculty accounts.",
  },
  create: {
    title: "Create account",
    text: "Add student or faculty accounts using their school email.",
  },
  accounts: {
    title: "Accounts",
    text: "Search accounts, activate or deactivate them, delete them, send reminders and password resets.",
  },
};

const ICONS = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  create:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6",
  accounts:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
};

function Icon({ name }) {
  return (
    <svg
      className="admin-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getDisplayName(userRecord) {
  const fullName = `${userRecord.firstName || ""} ${
    userRecord.middleName || ""
  } ${userRecord.lastName || ""}`
    .trim()
    .replace(/\s+/g, " ");

  return fullName || userRecord.email || "Unnamed user";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function checkEmail(cleanEmail) {
  if (!cleanEmail) return "School email is required.";
  if (!cleanEmail.includes("@")) return "Not a valid email.";
  const domain = cleanEmail.split("@")[1];
  if (!ALLOWED_DOMAINS.includes(domain)) return "Domain isn't approved.";
  return "";
}

function friendlyAuthError(err) {
  switch (err.code) {
    case "auth/email-already-in-use":
      return "Account already exists.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/too-many-requests":
      return "Too many requests, try again shortly.";
    default:
      return err.message || "Failed to create account.";
  }
}

function parseEmails(text) {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

const needsSetup = (u) =>
  u.role !== "admin" && u.status !== "inactive" && !u.profileCompleted;

export default function Admin() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  // ============================================================
  // VIEW (kept in the URL so refresh stays on the same tab)
  // ============================================================

  const [params, setParams] = useSearchParams();
  const requested = params.get("view");
  const view = VIEWS[requested] ? requested : "dashboard";

  function go(next) {
    setMessage("");
    setError("");
    setParams(next === "dashboard" ? {} : { view: next });
  }

  // ============================================================
  // STATE
  // ============================================================

  const [accountType, setAccountType] = useState("student");
  const [createMode, setCreateMode] = useState("single");
  const [email, setEmail] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ============================================================
  // LOAD USERS
  // ============================================================

  async function loadUsers() {
    setLoadingUsers(true);

    try {
      const snapshot = await getDocs(collection(db, "users"));

      const records = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      records.sort((a, b) =>
        getDisplayName(a).localeCompare(getDisplayName(b))
      );

      setUsers(records);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(
        "Unable to load user accounts. Check your Firestore security rules."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // ============================================================
  // CREATE ACCOUNT (single + bulk)
  // Uses a SECONDARY Firebase Auth app so the Admin stays signed in.
  // ============================================================

  function getSecondaryAuth() {
    const name = "ARBuildAdminCreator";
    const app = getApps().some((a) => a.name === name)
      ? getApp(name)
      : initializeApp(auth.app.options, name);
    return getAuth(app);
  }

  async function createOne(secondaryAuth, cleanEmail, pw, role) {
    const result = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      pw
    );

    const newUser = result.user;
    const now = new Date().toISOString();

    const baseProfile = {
      uid: newUser.uid,
      email: cleanEmail,
      displayName: cleanEmail.split("@")[0],
      role,

      firstName: "",
      middleName: "",
      lastName: "",

      studentId: "",
      section: "",

      facultyId: "",
      facultyTitle: "",
      department: "",

      contactNumber: "",
      photoURL: "",

      profileCompleted: false,
      status: "active",
      lastNotifiedAt: "",

      createdBy: auth.currentUser?.uid || profile?.uid || "",
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "users", newUser.uid), baseProfile);
    await setDoc(
      doc(db, role === "student" ? "students" : "faculty", newUser.uid),
      baseProfile
    );

    await signOutSecondary(secondaryAuth);
  }

  async function createAccount(e) {
    e.preventDefault();

    setMessage("");
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const problem = checkEmail(cleanEmail);

    if (problem) return setError(problem);
    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setCreating(true);

    try {
      await createOne(getSecondaryAuth(), cleanEmail, password, accountType);

      setMessage(
        `${accountType === "student" ? "Student" : "Faculty"} account created for ${cleanEmail}.`
      );

      setEmail("");
      setPassword(DEFAULT_PASSWORD);

      await loadUsers();
    } catch (err) {
      console.error("Create account error:", err);
      setError(friendlyAuthError(err));
    } finally {
      setCreating(false);
    }
  }

  async function createBulk(e) {
    e.preventDefault();

    setMessage("");
    setError("");
    setBulkResults(null);

    const list = parseEmails(bulkText);

    if (list.length === 0) return setError("Paste at least one email.");
    if (list.length > MAX_BULK) {
      return setError(`Please add ${MAX_BULK} accounts or fewer at a time.`);
    }
    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setCreating(true);

    const secondaryAuth = getSecondaryAuth();
    const results = [];

    for (const cleanEmail of list) {
      const problem = checkEmail(cleanEmail);

      if (problem) {
        results.push({ email: cleanEmail, ok: false, reason: problem });
        continue;
      }

      try {
        await createOne(secondaryAuth, cleanEmail, password, accountType);
        results.push({ email: cleanEmail, ok: true });
      } catch (err) {
        console.error("Bulk create error:", cleanEmail, err);
        results.push({
          email: cleanEmail,
          ok: false,
          reason: friendlyAuthError(err),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;

    setBulkResults(results);

    // keep only the failed ones in the box so they can be fixed and retried
    setBulkText(
      results
        .filter((r) => !r.ok)
        .map((r) => r.email)
        .join("\n")
    );

    if (okCount === 0) {
      setError("No accounts were created. See details below.");
    } else {
      setMessage(`${okCount} of ${list.length} ${accountType} accounts created.`);
    }

    if (okCount) await loadUsers();

    setCreating(false);
  }

  function loadEmailFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () =>
      setBulkText((prev) => `${prev}\n${reader.result}`.trim());
    reader.readAsText(file);

    e.target.value = "";
  }

  // ============================================================
  // ACTIVATE / DEACTIVATE
  // ============================================================

  async function toggleStatus(userRecord) {
    setError("");
    setMessage("");

    if (userRecord.role === "admin") {
      setError("Admin accounts cannot be changed from this page.");
      return;
    }

    const newStatus = userRecord.status === "inactive" ? "active" : "inactive";
    const patch = { status: newStatus, updatedAt: new Date().toISOString() };

    try {
      await updateDoc(doc(db, "users", userRecord.uid), patch);

      // merge = creates the doc if it's missing instead of failing
      const roleCollection =
        userRecord.role === "student" ? "students" : "faculty";
      await setDoc(doc(db, roleCollection, userRecord.uid), patch, {
        merge: true,
      });

      setMessage(
        `Account ${newStatus === "active" ? "activated" : "deactivated"}.`
      );

      await loadUsers();
    } catch (err) {
      console.error("Status update error:", err);
      setError(`Unable to update account status (${err.code || err.message}).`);
    }
  }

  // ============================================================
  // DELETE ACCOUNT
  // Removes Firestore data only. The Firebase Auth login can only be
  // removed from a server (Admin SDK / Cloud Function).
  // ============================================================

  async function deleteAccount(userRecord) {
    setError("");
    setMessage("");

    if (userRecord.role === "admin") {
      setError("Admin accounts cannot be deleted from this page.");
      return;
    }

    const ok = window.confirm(
      `Delete ${userRecord.email}?\n\nThis removes their profile and data and can't be undone.`
    );
    if (!ok) return;

    try {
      const roleCollection =
        userRecord.role === "student" ? "students" : "faculty";
      const batch = writeBatch(db);

      batch.delete(doc(db, "users", userRecord.uid));
      batch.delete(doc(db, roleCollection, userRecord.uid));
      batch.delete(doc(db, "notifications", `profile_setup_${userRecord.uid}`));

      await batch.commit();

      setMessage(`Account deleted for ${userRecord.email}.`);
      await loadUsers();
    } catch (err) {
      console.error("Delete account error:", err);
      setError(`Unable to delete account (${err.code || err.message}).`);
    }
  }

  // ============================================================
  // PASSWORD RESET EMAIL
  // ============================================================

  async function sendResetEmail(userRecord) {
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, userRecord.email);
      setMessage(`Password reset email sent to ${userRecord.email}.`);
    } catch (err) {
      console.error("Password reset error:", err);
      setError(err.message || "Unable to send password reset email.");
    }
  }

  // ============================================================
  // NOTIFY (stored only, delivery can be added later)
  // ============================================================

  function buildNotification(u, now) {
    return {
      userId: u.uid,
      email: u.email,
      role: u.role,
      type: "profile_setup",
      title: "Finish setting up your account",
      message: "Please sign in and complete your profile.",
      read: false,
      createdBy: auth.currentUser?.uid || profile?.uid || "",
      createdAt: now,
    };
  }

  async function notifyOne(userRecord) {
    setError("");
    setMessage("");

    try {
      const now = new Date().toISOString();

      // fixed id = re-notifying updates the same record, no duplicates
      await setDoc(
        doc(db, "notifications", `profile_setup_${userRecord.uid}`),
        buildNotification(userRecord, now)
      );
      await updateDoc(doc(db, "users", userRecord.uid), {
        lastNotifiedAt: now,
      });

      setMessage(`Setup reminder saved for ${userRecord.email}.`);
      await loadUsers();
    } catch (err) {
      console.error("Notify error:", err);
      setError("Unable to save notification. Check your Firestore rules.");
    }
  }

  async function notifyAllPending() {
    setError("");
    setMessage("");

    const targets = users.filter(needsSetup);

    if (targets.length === 0) {
      setMessage("Nobody needs a reminder.");
      return;
    }

    setNotifying(true);

    try {
      const now = new Date().toISOString();

      // each user = 2 writes, and a batch holds max 500 writes
      for (let i = 0; i < targets.length; i += 200) {
        const batch = writeBatch(db);

        targets.slice(i, i + 200).forEach((u) => {
          batch.set(
            doc(db, "notifications", `profile_setup_${u.uid}`),
            buildNotification(u, now)
          );
          batch.update(doc(db, "users", u.uid), { lastNotifiedAt: now });
        });

        await batch.commit();
      }

      setMessage(`Setup reminders saved for ${targets.length} accounts.`);
      await loadUsers();
    } catch (err) {
      console.error("Notify all error:", err);
      setError("Unable to save notifications. Check your Firestore rules.");
    } finally {
      setNotifying(false);
    }
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const stats = useMemo(() => {
    const managed = users.filter((item) => item.role !== "admin");

    const inactive = managed.filter((item) => item.status === "inactive");
    const active = managed.filter((item) => item.status !== "inactive");
    const ready = active.filter((item) => item.profileCompleted);
    const pending = active.filter((item) => !item.profileCompleted);

    const byNewest = [...managed].sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    return {
      total: managed.length,
      students: managed.filter((item) => item.role === "student").length,
      faculty: managed.filter((item) => item.role === "faculty").length,
      active: active.length,
      inactive: inactive.length,
      ready: ready.length,
      pending: pending.length,
      pendingList: pending.slice(0, 5),
      recent: byNewest.slice(0, 5),
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((item) => {
      if (roleFilter !== "all" && item.role !== roleFilter) return false;
      if (!query) return true;

      return (
        getDisplayName(item).toLowerCase().includes(query) ||
        String(item.email || "").toLowerCase().includes(query) ||
        String(item.studentId || "").toLowerCase().includes(query) ||
        String(item.facultyId || "").toLowerCase().includes(query)
      );
    });
  }, [users, search, roleFilter]);

  const pct = (n) => (stats.total ? (n / stats.total) * 100 : 0);

  const meta = VIEWS[view];

  // ============================================================
  // VIEW: DASHBOARD
  // ============================================================

  function renderDashboard() {
    if (loadingUsers) {
      return <div className="admin-empty">Loading dashboard...</div>;
    }

    if (stats.total === 0) {
      return (
        <section className="admin-panel admin-empty-state">
          <h3>No accounts yet</h3>
          <p>Create the first student or faculty account to get started.</p>
          <button
            type="button"
            className="admin-primary-btn"
            onClick={() => go("create")}
          >
            Create account
          </button>
        </section>
      );
    }

    return (
      <>
        <section className="admin-panel dash-progress">
          <div className="dash-progress-top">
            <div>
              <div className="dash-big">
                {stats.ready}
                <span> of {stats.total}</span>
              </div>
              <p>
                {stats.pending === 0
                  ? "Every active account has finished profile setup."
                  : `${stats.pending} active ${
                      stats.pending === 1 ? "account hasn't" : "accounts haven't"
                    } finished profile setup yet.`}
              </p>
            </div>

            <div className="dash-actions">
              <button
                type="button"
                className="admin-primary-btn"
                onClick={() => go("create")}
              >
                Create account
              </button>
              <button
                type="button"
                className="admin-ghost-btn"
                onClick={() => go("accounts")}
              >
                View accounts
              </button>
            </div>
          </div>

          <div
            className="dash-bar"
            role="img"
            aria-label={`${stats.ready} ready, ${stats.pending} pending setup, ${stats.inactive} inactive`}
          >
            <span className="seg ready" style={{ width: `${pct(stats.ready)}%` }} />
            <span className="seg pending" style={{ width: `${pct(stats.pending)}%` }} />
            <span className="seg inactive" style={{ width: `${pct(stats.inactive)}%` }} />
          </div>

          <ul className="dash-legend">
            <li>
              <i className="dot ready" /> Ready <b>{stats.ready}</b>
            </li>
            <li>
              <i className="dot pending" /> Pending setup <b>{stats.pending}</b>
            </li>
            <li>
              <i className="dot inactive" /> Inactive <b>{stats.inactive}</b>
            </li>
          </ul>
        </section>

        <section className="dash-strip">
          <div>
            <span>Students</span>
            <strong>{stats.students}</strong>
          </div>
          <div>
            <span>Faculty</span>
            <strong>{stats.faculty}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>
          <div>
            <span>Inactive</span>
            <strong>{stats.inactive}</strong>
          </div>
        </section>

        <div className="dash-columns">
          <section className="admin-panel">
            <div className="panel-head">
              <h3>Needs profile setup</h3>
              <div className="panel-head-actions">
                {stats.pending > 0 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={notifyAllPending}
                    disabled={notifying}
                  >
                    {notifying ? "Saving..." : "Notify all"}
                  </button>
                )}
                {stats.pending > 5 && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => go("accounts")}
                  >
                    See all
                  </button>
                )}
              </div>
            </div>

            {stats.pendingList.length === 0 ? (
              <p className="panel-empty">Nobody is waiting on setup.</p>
            ) : (
              <ul className="mini-list">
                {stats.pendingList.map((item) => (
                  <li key={item.id}>
                    <div className="user-avatar">
                      {(item.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="mini-text">
                      <strong>{item.email}</strong>
                      <span>
                        Added{" "}
                        {item.createdAt
                          ? formatDateTime(item.createdAt)
                          : "recently"}
                      </span>
                    </div>
                    <span className={`role-badge ${item.role}`}>{item.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-panel">
            <div className="panel-head">
              <h3>Recently added</h3>
            </div>

            <ul className="mini-list">
              {stats.recent.map((item) => (
                <li key={item.id}>
                  <div className="user-avatar">
                    {(item.firstName || item.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="mini-text">
                    <strong>{getDisplayName(item)}</strong>
                    <span>
                      {item.createdAt
                        ? formatDateTime(item.createdAt)
                        : item.email}
                    </span>
                  </div>
                  <span className={`role-badge ${item.role}`}>{item.role}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    );
  }

  // ============================================================
  // VIEW: CREATE ACCOUNT
  // ============================================================

  function renderCreate() {
    const bulkCount = parseEmails(bulkText).length;

    return (
      <section className="admin-panel create-panel">
        <div className="filter-chips create-mode" role="group" aria-label="Create mode">
          {[
            ["single", "Single"],
            ["bulk", "Bulk add"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={createMode === value ? "active" : ""}
              onClick={() => {
                setCreateMode(value);
                setBulkResults(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form
          className="admin-create-form"
          onSubmit={createMode === "bulk" ? createBulk : createAccount}
        >
          <div className="admin-role-selector">
            <button
              type="button"
              className={accountType === "student" ? "selected" : ""}
              onClick={() => setAccountType("student")}
            >
              <span className="role-icon">S</span>
              <span>
                <strong>Student</strong>
                <small>Student learning account</small>
              </span>
            </button>

            <button
              type="button"
              className={accountType === "faculty" ? "selected" : ""}
              onClick={() => setAccountType("faculty")}
            >
              <span className="role-icon">F</span>
              <span>
                <strong>Faculty</strong>
                <small>Faculty or instructor account</small>
              </span>
            </button>
          </div>

          <div className="admin-form-grid">
            {createMode === "single" ? (
              <label className="admin-field">
                <span>School email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.edu.ph"
                  required
                />
                <small>Saved as the account's official email.</small>
              </label>
            ) : (
              <div className="admin-field admin-field-wide">
                <label htmlFor="bulk-emails">
                  <span className="field-label">School emails</span>
                </label>
                <textarea
                  id="bulk-emails"
                  rows={7}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"one@school.edu.ph\ntwo@school.edu.ph"}
                />
                <small>
                  One per line, or separated by commas. Everyone will be created
                  as a {accountType} account (up to {MAX_BULK} at a time).{" "}
                  <label className="link-btn file-btn">
                    Load .csv / .txt
                    <input
                      type="file"
                      accept=".csv,.txt"
                      hidden
                      onChange={loadEmailFile}
                    />
                  </label>
                </small>
              </div>
            )}

            <label className="admin-field">
              <span>
                {createMode === "bulk" ? "Initial password (everyone)" : "Initial password"}
              </span>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <small>Default: {DEFAULT_PASSWORD}</small>
            </label>
          </div>

          <div className="admin-create-footer">
            <p className="admin-info-note">
              New accounts start with profile setup incomplete. Each user
              finishes it after signing in.
            </p>

            <button
              type="submit"
              className="admin-primary-btn"
              disabled={creating}
            >
              {creating
                ? "Creating..."
                : createMode === "bulk"
                ? `Create ${bulkCount || ""} ${accountType} accounts`.replace(/\s+/g, " ")
                : `Create ${accountType === "student" ? "student" : "faculty"} account`}
            </button>
          </div>
        </form>

        {bulkResults && (
          <ul className="bulk-results">
            {bulkResults.map((r) => (
              <li key={r.email} className={r.ok ? "ok" : "fail"}>
                <span>{r.email}</span>
                <b>{r.ok ? "Created" : r.reason}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // ============================================================
  // VIEW: ACCOUNTS
  // ============================================================

  function renderAccounts() {
    return (
      <section className="admin-panel">
        <div className="list-toolbar">
          <div className="admin-search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, student ID, or faculty ID"
            />
          </div>

          <div className="filter-chips" role="group" aria-label="Filter by role">
            {[
              ["all", "All"],
              ["student", "Students"],
              ["faculty", "Faculty"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={roleFilter === value ? "active" : ""}
                onClick={() => setRoleFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="admin-ghost-btn"
            onClick={loadUsers}
            disabled={loadingUsers}
          >
            {loadingUsers ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loadingUsers ? (
          <div className="admin-empty">Loading accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-empty">
            No accounts match. Try a different search or filter.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-account">
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(item.firstName || item.email || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div>
                          <strong>{getDisplayName(item)}</strong>
                          <span>{item.email}</span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Role">
                      <span className={`role-badge ${item.role}`}>
                        {item.role}
                      </span>
                    </td>

                    <td data-label="Profile">
                      <span
                        className={
                          item.profileCompleted
                            ? "profile-status complete"
                            : "profile-status incomplete"
                        }
                      >
                        {item.profileCompleted ? "Complete" : "Pending setup"}
                      </span>
                      {item.lastNotifiedAt && !item.profileCompleted && (
                        <small className="notified-note">
                          Notified {formatDateTime(item.lastNotifiedAt)}
                        </small>
                      )}
                    </td>

                    <td data-label="Status">
                      <span
                        className={
                          item.status === "inactive"
                            ? "status-badge inactive"
                            : "status-badge active"
                        }
                      >
                        {item.status === "inactive" ? "Inactive" : "Active"}
                      </span>
                    </td>

                    <td data-label="Created" className="date-cell">
                      {formatDateTime(item.createdAt)}
                    </td>

                    <td className="cell-actions">
                      <div className="admin-actions">
                        {item.role !== "admin" && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleStatus(item)}
                              className="action-btn"
                            >
                              {item.status === "inactive"
                                ? "Activate"
                                : "Deactivate"}
                            </button>

                            {needsSetup(item) && (
                              <button
                                type="button"
                                onClick={() => notifyOne(item)}
                                className="action-btn"
                              >
                                {item.lastNotifiedAt ? "Notify again" : "Notify"}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => sendResetEmail(item)}
                              className="action-btn secondary"
                            >
                              Reset password
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteAccount(item)}
                              className="action-btn danger"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  // ============================================================
  // LAYOUT
  // ============================================================

  const navItems = [
    ["dashboard", "Dashboard"],
    ["create", "Create account"],
    ["accounts", "Accounts"],
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">AR</div>
          <div>
            <h1>ARBuild</h1>
            <span>Admin portal</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          {navItems.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={view === key ? "active" : ""}
              aria-current={view === key ? "page" : undefined}
              onClick={() => go(key)}
            >
              <Icon name={key} />
              <span>{label}</span>
              {key === "accounts" && !loadingUsers && <em>{stats.total}</em>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-account">
            <span className="admin-account-role">Signed in as admin</span>
            <span className="admin-account-email">{profile?.email}</span>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <Icon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-view-head">
          <h2>{meta.title}</h2>
          <p>{meta.text}</p>
        </header>

        {message && <div className="admin-alert success">{message}</div>}
        {error && <div className="admin-alert error">{error}</div>}

        {view === "dashboard" && renderDashboard()}
        {view === "create" && renderCreate()}
        {view === "accounts" && renderAccounts()}
      </main>
    </div>
  );
}