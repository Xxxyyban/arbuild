// The account button at the right of every page's header: the person's picture, which opens a menu
// with their name and school email, My Profile, the dark mode switch, and Sign out.
// Styles: styles/AppShell.css (.acct*).
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fullName } from "../lab/People";
import Avatar from "./class/Avatar";
import Icon from "./Icon";

/** "Tigno, Angelo Marvan C.": last name first, as a class list writes it ("" without a name). */
function listName(profile) {
  const last = profile?.lastName?.trim() || "";
  const middle = profile?.middleName?.trim() || "";
  const given = [profile?.firstName?.trim(), middle && `${middle[0].toUpperCase()}.`].filter(Boolean).join(" ");
  return [last, given].filter(Boolean).join(", ");
}

export default function AccountMenu() {
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const button = useRef(null);
  const menuId = useId();

  const email = profile?.email || user?.email || "";
  const name = listName(profile) || email.split("@")[0] || "Your account";
  const photo = profile?.photoThumb || profile?.photoURL || user?.photoURL || "";

  // close on a press outside (a pointer event: iPhones send no mouse events for a tap on anything
  // that isn't a button or a link), or on Escape (back to the button)
  useEffect(() => {
    if (!open) return undefined;
    const press = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div
      className="acct"
      ref={box}
      // tabbing past the menu closes it
      onBlur={(e) => open && !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        className="acct__btn"
        aria-label={`Account: ${name}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={fullName(profile) || email} photo={photo} size={34} />
      </button>

      {open && (
        // focusable, so a click on the name keeps the menu open
        <div className="acct__menu" id={menuId} tabIndex={-1}>
          <div className="acct__who">
            <strong className="acct__name">{name}</strong>
            {email && <span className="acct__email">{email}</span>}
          </div>
          <Link to="/profile" className="acct__item" onClick={() => setOpen(false)}>
            <Icon name="userCircle" />
            My Profile
          </Link>
          {/* stays open, so the page can be seen changing */}
          <button type="button" className="acct__item" role="switch" aria-checked={theme === "dark"} onClick={toggleTheme}>
            <Icon name="moon" />
            Dark mode
            <span className="acct__switch" aria-hidden="true" />
          </button>
          <div className="acct__sep" role="separator" />
          <button type="button" className="acct__item acct__item--danger" onClick={signOut}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
