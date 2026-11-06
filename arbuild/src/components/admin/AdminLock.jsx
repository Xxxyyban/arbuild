// The admin portal's lock (pages/Admin.jsx). After ten minutes with nobody using it, or when the admin
// locks it, none of the portal shows until their password is entered again; five wrong ones sign out.
// Styles: styles/Admin.css (.admin-lock*).
import { useEffect, useRef, useState } from "react";
import Logo from "../Logo";

export const IDLE_MINUTES = 10;
const TRIES = 5;

/** Calls onIdle once nobody has touched the page for `minutes` (a long time on another tab counts too). */
export function useIdle(onIdle, { minutes = IDLE_MINUTES, enabled = true } = {}) {
  const call = useRef(onIdle);
  call.current = onIdle;
  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const check = () => {
      if (Date.now() - last >= minutes * 60000) call.current();
    };
    const kinds = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
    kinds.forEach((k) => window.addEventListener(k, touch, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 15000);
    return () => {
      kinds.forEach((k) => window.removeEventListener(k, touch, { capture: true }));
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, [minutes, enabled]);
}

/**
 * email: whose portal. reason: "idle" (it locked itself) or "manual" (they locked it).
 * onUnlock(password): resolves when the password is right, throws when it isn't. onSignOut().
 */
export default function AdminLock({ email, reason, onUnlock, onSignOut }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tries = useRef(0);

  async function submit(e) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      await onUnlock(password);
    } catch (err) {
      tries.current += 1;
      setPassword("");
      if (tries.current >= TRIES) {
        onSignOut();
        return;
      }
      const left = TRIES - tries.current;
      setError(
        err?.code === "auth/too-many-requests"
          ? "Too many tries for now. Wait a minute, or sign out."
          : `That password isn't right. ${left} more ${left === 1 ? "try" : "tries"} before you're signed out.`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-lock" role="dialog" aria-modal="true" aria-labelledby="admin-lock-title">
      <form className="admin-lock__card" onSubmit={submit}>
        <div className="admin-lock__brand">
          <Logo size={30} />
          <span>ARBuild admin</span>
        </div>
        <h2 id="admin-lock-title">Portal locked</h2>
        <p>
          {reason === "idle"
            ? `It locked itself after ${IDLE_MINUTES} minutes with nobody using it.`
            : "You locked it."}{" "}
          Enter your password to carry on.
        </p>
        <label className="admin-field">
          <span>Signed in as</span>
          <input type="email" value={email || ""} readOnly autoComplete="username" />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {error && (
          <p className="admin-lock__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="admin-primary-btn" disabled={busy || !password}>
          {busy ? "Checking..." : "Unlock"}
        </button>
        <button type="button" className="link-btn admin-lock__out" onClick={onSignOut}>
          Sign out instead
        </button>
      </form>
    </div>
  );
}
