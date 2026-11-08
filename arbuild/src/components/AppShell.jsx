// The frame every signed-in page shares (Rig Studio, Classes, Profile...): the ARBuild sidebar and
// the page header (title, the page's own buttons, then the calendar, notifications and the account
// menu with My Profile, dark mode and Sign out). On a phone the sidebar becomes a drawer behind the
// menu button.
// Styles: styles/Main.css (.app-shell, .app-sidebar, .main__header) and styles/AppShell.css.
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AccountMenu from "./AccountMenu";
import Icon from "./Icon";
import Logo from "./Logo";
import NotificationBell from "./class/NotificationBell";
import { graphicsChoice, setGraphicsChoice, weakDevice } from "../Three/graphics";
import "../styles/Main.css";
import "../styles/AppShell.css";

// the workspaces; the calendar sits beside the bell and the profile opens from the account menu
// (AccountMenu.jsx), both at the top right
function navFor(teacher) {
  return [
    { to: "/main", label: "Rig Studio", icon: "rig", paths: ["/main"] },
    { to: "/lab", label: "Build Lab", icon: "wrench", paths: ["/lab"] },
    { to: teacher ? "/instructor" : "/classes", label: "Classes", icon: "users", paths: ["/classes", "/instructor"] },
  ];
}

export function Sidebar({ open, onClose }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside className={`app-sidebar ${open ? "app-sidebar--open" : ""}`}>
        <div className="sidebar__top-section">
          <div className="sidebar__brand">
            <Link to="/main" className="sidebar__brand-link" onClick={onClose}>
              <Logo size={36} />
              <span className="sidebar__brand-name">ARBuild</span>
            </Link>
            <button type="button" className="sidebar__close-btn" onClick={onClose} aria-label="Close menu">
              <Icon name="x" />
            </button>
          </div>

          <nav className="sidebar__nav" aria-label="ARBuild">
            <p className="sidebar__nav-title">Workspaces</p>
            {navFor(profile?.role === "faculty").map((item) => {
              const on = item.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`sidebar__link ${on ? "active" : ""}`}
                  aria-current={on ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="sidebar__footer">
          {/* how detailed the 3D views are (Three/graphics.js); a change reloads the page */}
          <label className="sidebar__footer-row">
            <span className="sidebar__footer-label">Graphics</span>
            <select className="sidebar__select" value={graphicsChoice()} onChange={(e) => setGraphicsChoice(e.target.value)}>
              <option value="auto">Auto ({weakDevice() ? "Lite" : "Full"})</option>
              <option value="full">Full</option>
              <option value="lite">Lite</option>
            </select>
          </label>
          <Link
            to="/about"
            className={`sidebar__link sidebar__link--quiet ${pathname === "/about" ? "active" : ""}`}
            aria-current={pathname === "/about" ? "page" : undefined}
            onClick={onClose}
          >
            <Icon name="info" />
            <span>About ARBuild</span>
          </Link>
          <div className="sidebar__footer-divider" />
          <span className="sidebar__term">Computer Systems Servicing NC II</span>
        </div>
      </aside>
    </>
  );
}

/**
 * eyebrow, title, subtitle: the page header. back: { to, label } shows a back link above the title.
 * tools: the page's own buttons, before the bell and the account menu. className: extra classes on
 * <main>.
 */
export default function AppShell({ eyebrow, title, subtitle, back, tools, className = "", children }) {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const onCalendar = pathname === "/calendar";

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <main className={`app-main app-page ${className}`.trim()}>
        <header className="main__header">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Icon name="menu" />
          </button>
          <div className="main__title-group">
            {back && (
              <Link to={back.to} className="page-back">
                <Icon name="back" size={16} />
                {back.label}
              </Link>
            )}
            {eyebrow && <span className="main__badge-pill">{eyebrow}</span>}
            {title && <h1 className="main__greeting">{title}</h1>}
            {subtitle && <p className="main__section">{subtitle}</p>}
          </div>
          <div className="main__header-tools">
            {tools}
            <div className="main__me">
              {/* the calendar: class meetings, due dates and anything missed (pages/Calendar.jsx); an
                  admin has none (the shell only shows them the instructor pages) */}
              {profile?.role !== "admin" && (
                <Link
                  to="/calendar"
                  className="main__icon"
                  aria-label="Calendar"
                  title="Calendar"
                  aria-current={onCalendar ? "page" : undefined}
                >
                  <Icon name="calendar" size={22} />
                </Link>
              )}
              <NotificationBell user={user} profile={profile} />
              <AccountMenu />
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
