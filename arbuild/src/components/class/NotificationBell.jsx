// The notification bell (students): what's new across their classes and what's still to do, each
// from their instructor (their picture and name). Something new arriving while the page is open pops
// up as a toast and, if the student turned it on, as a notification on their device. Instructors
// have none. Styles: styles/Classes.css (.nbell*).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClassFeed from "./ClassFeed";
import { when } from "../../lab/Classes";
import Icon from "../Icon";
import Avatar from "./Avatar";
import "../../styles/Classes.css";

const KIND = {
  announcement: ["megaphone", "Announcement"],
  material: ["book", "Learning material"],
  lab: ["wrench", "Lab activity"],
};

/** What a new item says, with who it's from (their name, from the item's who). */
function headline(item) {
  const who = item.who?.name;
  if (!who) return `${item.kind === "lab" ? "New task to do" : KIND[item.kind]?.[1] || "New"} · ${item.className}`;
  return {
    lab: `New task from ${who}`,
    announcement: `${who} posted an announcement`,
    material: `${who} shared a learning material`,
  }[item.kind] || who;
}

/** Who it's from, in their picture, with what it is on its corner; just what it is without a who. */
function Picture({ item, size = 34 }) {
  const icon = (KIND[item.kind] || KIND.announcement)[0];
  if (item.who) return <Avatar name={item.who.name} photo={item.who.photo} size={size} badge={icon} />;
  return (
    <span className="nbell__icon" aria-hidden="true">
      <Icon name={icon} size={16} />
    </span>
  );
}

export default function NotificationBell({ user, profile }) {
  if (profile?.role === "faculty") return null;
  return <ClassFeed user={user} profile={profile}>{(feed) => <Bell feed={feed} />}</ClassFeed>;
}

function Bell({ feed }) {
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
          const n = new Notification(headline(i), { body: i.who ? `${i.title} · ${i.className}` : i.title, tag: i.key, icon: i.who?.photo || undefined });
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
            {others.length > 0 && (
              <button type="button" className="nbell__link" onClick={feed.markAllSeen}>Mark all as read</button>
            )}
          </div>

          <h4 className="nbell__section">To do{feed.todo.length ? ` (${feed.todo.length})` : ""}</h4>
          {feed.todo.length === 0 ? (
            <p className="nbell__empty">Nothing to do right now.</p>
          ) : (
            <ul className="nbell__list">{feed.todo.map((i) => <Item key={i.key} item={i} onGo={go} />)}</ul>
          )}

          <h4 className="nbell__section">New</h4>
          {others.length === 0 ? (
            <p className="nbell__empty">You're all caught up.</p>
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
            <Picture item={i} size={38} />
            <span>
              <strong>{headline(i)}</strong>
              <small>{i.who ? `${i.title} · ${i.className}` : i.title}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Item({ item, onGo }) {
  const label = (KIND[item.kind] || KIND.announcement)[1];
  return (
    <li>
      <button type="button" className={`nbell__item ${item.unread ? "is-unread" : ""}`} onClick={() => onGo(item)}>
        <Picture item={item} />
        <span className="nbell__text">
          <span className="nbell__title">{item.title}</span>
          <span className="nbell__meta">
            {item.who ? `${item.who.name} · ` : ""}
            {label} · {item.className}
            {item.detail ? ` · ${item.detail}` : ""} · {when(item.at)}
          </span>
        </span>
      </button>
    </li>
  );
}
