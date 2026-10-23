// The frame every signed-in page shares (Rig Studio, Classes, Profile...): the ARBuild sidebar and
// the page header (title, notifications, the page's own buttons). On a phone the sidebar becomes a
// drawer behind the menu button.
// Styles: styles/Main.css (.app-shell, .app-sidebar, .main__header) and styles/AppShell.css.
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./class/NotificationBell";
import "../styles/Main.css";
import "../styles/AppShell.css";

function navFor(teacher) {
  return [
    { to: "/main", label: "Rig Studio", icon: "rig", paths: ["/main"] },
    { to: "/lab", label: "Build Lab", icon: "wrench", paths: ["/lab"] },
    { to: teacher ? "/instructor" : "/classes", label: "Classes", icon: "users", paths: ["/classes", "/instructor"] },
    { to: "/profile", label: "Profile", icon: "user", paths: ["/profile"] },
  ];
}

export function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

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
          <div className="sidebar__footer-row">
            <span className="sidebar__footer-label">Appearance</span>
            <ThemeToggle />
          </div>
          <Link to="/credits" className="sidebar__link sidebar__link--quiet" onClick={onClose}>
            <Icon name="award" />
            <span>3D model credits</span>
          </Link>
          <button
            type="button"
            className="sidebar__link sidebar__link--quiet"
            onClick={async () => {
              await logout();
              navigate("/", { replace: true });
            }}
          >
            <Icon name="logout" />
            <span>Log out</span>
          </button>
          <div className="sidebar__footer-divider" />
          <span className="sidebar__term">Computer Systems Servicing NC II</span>
        </div>
      </aside>
    </>
  );
}

/**
 * eyebrow, title, subtitle: the page header. back: { to, label } shows a back link above the title.
 * tools: buttons beside the notification bell. className: extra classes on <main>.
 */
export default function AppShell({ eyebrow, title, subtitle, back, tools, className = "", children }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);

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
            <NotificationBell user={user} profile={profile} />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
