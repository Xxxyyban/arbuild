// The notification bell: what's new across your classes and, for students, what's still to do.
// Something new arriving while the page is open pops up as a toast and, if the student turned it
// on, as a notification on their device. Styles: styles/Classes.css (.nbell*).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClassFeed from "./ClassFeed";
import { when } from "../../lab/Classes";
import Icon from "../Icon";
import "../../styles/Classes.css";

const KIND = {
  announcement: ["megaphone", "Announcement"],
  material: ["book", "Learning material"],
  lab: ["wrench", "Lab activity"],
  message: ["chat", "Message"],
};

export default function NotificationBell({ user, profile }) {
  return <ClassFeed user={user} profile={profile}>{(feed) => <Bell feed={feed} teacher={profile?.role === "faculty"} />}</ClassFeed>;
}

function Bell({ feed, teacher }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [perm, setPerm] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const known = useRef(null); // keys already shown, so only new arrivals pop up
  const box = useRef(null);

  // pop up what arrives after the first load
  useEffect(() => {
    if (!feed.ready) return;
    const keys = new Set(feed.items.map((i) => i.key));
    if (known.current === null) {
      known.current = keys;
      return;
    }
    const arrived = feed.items.filter((i) => !known.current.has(i.key) && (i.unread || i.todo));
    known.current = keys;
    if (!arrived.length) return;
    setToasts((t) => [...t, ...arrived.slice(0, 3)]);
    arrived.slice(0, 3).forEach((i) => {
      setTimeout(() => setToasts((t) => t.filter((x) => x.key !== i.key)), 7000);
      if (perm === "granted" && document.hidden) {
        try {
          const n = new Notification(`${KIND[i.kind]?.[1] || "New"} · ${i.className}`, { body: i.title, tag: i.key });
          n.onclick = () => {
            window.focus();
            navigate(i.to);
          };
        } catch {
          /* some browsers only allow this from a service worker */
        }
      }
    });
  }, [feed.items, feed.ready, perm, navigate]);

  // close the panel on an outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const click = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  function go(item) {
    setOpen(false);
    navigate(item.to);
  }

  const others = feed.fresh.filter((i) => !i.todo);

  return (
    <div className="nbell" ref={box}>
      <button
        type="button"
        className="nbell__btn"
        aria-label={feed.count ? `Notifications: ${feed.count} new` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={19} />
        {feed.count > 0 && <span className="nbell__count">{feed.count > 9 ? "9+" : feed.count}</span>}
      </button>

      {open && (
        <div className="nbell__panel" role="dialog" aria-label="Notifications">
          <div className="nbell__head">
            <strong>Notifications</strong>
            {others.some((i) => i.kind !== "message") && (
              <button type="button" className="nbell__link" onClick={feed.markAllSeen}>Mark all as read</button>
            )}
          </div>

          {!teacher && (
            <>
              <h4 className="nbell__section">To do{feed.todo.length ? ` (${feed.todo.length})` : ""}</h4>
              {feed.todo.length === 0 ? (
                <p className="nbell__empty">Nothing to do right now.</p>
              ) : (
                <ul className="nbell__list">{feed.todo.map((i) => <Item key={i.key} item={i} onGo={go} />)}</ul>
              )}
            </>
          )}

          <h4 className="nbell__section">New</h4>
          {others.length === 0 ? (
            <p className="nbell__empty">{teacher ? "No new messages from students." : "You're all caught up."}</p>
          ) : (
            <ul className="nbell__list">{others.map((i) => <Item key={i.key} item={i} onGo={go} />)}</ul>
          )}

          {perm === "default" && (
            <button
              type="button"
              className="nbell__link nbell__perm"
              onClick={async () => setPerm(await Notification.requestPermission())}
            >
              <Icon name="bell" size={15} />
              Also notify me on this device
            </button>
          )}
        </div>
      )}

      <div className="nbell__toasts" aria-live="polite">
        {toasts.map((i) => (
          <button key={i.key} type="button" className="nbell__toast" onClick={() => go(i)}>
            <span className="nbell__icon" aria-hidden="true">
              <Icon name={KIND[i.kind]?.[0] || "bell"} size={16} />
            </span>
            <span>
              <strong>{i.kind === "lab" ? "New task to do" : KIND[i.kind]?.[1]} · {i.className}</strong>
              <small>{i.title}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Item({ item, onGo }) {
  const [icon, label] = KIND[item.kind] || KIND.announcement;
  return (
    <li>
      <button type="button" className={`nbell__item ${item.unread ? "is-unread" : ""}`} onClick={() => onGo(item)}>
        <span className="nbell__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
        <span className="nbell__text">
          <span className="nbell__title">{item.title}</span>
          <span className="nbell__meta">
            {label} · {item.className}
            {item.detail ? ` · ${item.detail}` : ""} · {when(item.at)}
          </span>
        </span>
      </button>
    </li>
  );
}
