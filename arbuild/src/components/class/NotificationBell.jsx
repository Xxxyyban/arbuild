// The notification bell.
//   A student's (ClassFeed): lab activities they missed, what's still to do (overdue first), and
//   what's new across their classes, each from their instructor (their picture and name).
//   An instructor's (TeachingFeed): lab activities past their due date that are still open, and
//   what's new in their classes: students who joined, comments, finished labs, labs that closed
//   before some students finished.
// Something happening while the page is open pops up as a toast and, if they turned it on, as a
// notification on their device. The admin has none. Styles: styles/Classes.css (.nbell*).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClassFeed from "./ClassFeed";
import TeachingFeed from "./TeachingFeed";
import { when } from "../../lab/Classes";
import Icon from "../Icon";
import Avatar from "./Avatar";
import "../../styles/Classes.css";

const KIND = {
  announcement: ["megaphone", "Announcement"],
  material: ["book", "Learning material"],
  lab: ["wrench", "Lab activity"],
  // an instructor's
  join: ["users", "New student"],
  comment: ["chat", "Comment"],
  done: ["check", "Lab finished"],
  due: ["clock", "Past due"],
  closed: ["alert", "Lab closed"],
  // the admin's (lab/Announcements.js)
  notice: ["megaphone", "Announcement"],
};

/** What a new item says, with who it's from (their name, from the item's who). */
function headline(item) {
  if (item.headline) return item.headline;
  if (item.missed) return `You missed a lab activity · ${item.className}`;
  if (item.overdue) return `Overdue · ${item.className}`;
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
  if (profile?.role === "admin") return null;
  if (profile?.role === "faculty") return <TeachingFeed user={user} profile={profile}>{(feed) => <Bell feed={feed} />}</TeachingFeed>;
  return <ClassFeed user={user} profile={profile}>{(feed) => <Bell feed={feed} />}</ClassFeed>;
}

/** The line under a toast's headline. */
const toastLine = (i) => (i.headline ? [i.className, i.detail].filter(Boolean).join(" · ") : i.who ? `${i.title} · ${i.className}` : i.title);

function Bell({ feed }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [perm, setPerm] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const known = useRef(null); // keys already shown, so only new arrivals pop up
  const [opened] = useState(() => Date.now()); // when this page opened
  const box = useRef(null);

  // Pop up what happens while the page is open: new to the feed, and from after the page opened (a
  // minute's grace for clocks), so opening a page doesn't pop up what was already there.
  useEffect(() => {
    if (!feed.ready) return;
    const keys = new Set(feed.items.map((i) => i.key));
    if (known.current === null) {
      known.current = keys;
      return;
    }
    const arrived = feed.items.filter((i) => !known.current.has(i.key) && (i.unread || i.todo) && i.at >= opened - 60000);
    keys.forEach((k) => known.current.add(k));
    if (!arrived.length) return;
    setToasts((t) => [...t, ...arrived.slice(0, 3)]);
    arrived.slice(0, 3).forEach((i) => {
      setTimeout(() => setToasts((t) => t.filter((x) => x.key !== i.key)), 7000);
      if (perm === "granted" && document.hidden) {
        try {
          const n = new Notification(headline(i), { body: toastLine(i), tag: i.key, icon: i.who?.photo || undefined });
          n.onclick = () => {
            window.focus();
            navigate(i.to);
          };
        } catch {
          /* some browsers only allow this from a service worker */
        }
      }
    });
  }, [feed.items, feed.ready, perm, navigate, opened]);

  // close the panel on a press outside or Escape. A pointer event, because a phone sends no mouse
  // events for a swipe, and iPhones none for a tap on anything that isn't a button or a link.
  useEffect(() => {
    if (!open) return undefined;
    const press = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // to where an item points; the admin's announcements point nowhere, so they open in the panel
  function go(item) {
    if (!item.to) return setOpen(true);
    setOpen(false);
    navigate(item.to);
  }

  const others = feed.fresh.filter((i) => !i.todo && !i.missed && !i.announcement);
  const announcements = feed.announcements || [];

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
        {feed.count > 0 && <span className="nbell__count">{feed.count > 99 ? "99+" : feed.count}</span>}
      </button>

      {open && (
        <div className="nbell__panel" role="dialog" aria-label="Notifications">
          <div className="nbell__head">
            <strong>Notifications</strong>
            {feed.fresh.length > 0 && (
              <button type="button" className="nbell__link" onClick={feed.markAllSeen}>Mark all as read</button>
            )}
          </div>

          {feed.missed.length > 0 && (
            <>
              <h4 className="nbell__section nbell__section--missed">Missed ({feed.missed.length})</h4>
              <ul className="nbell__list">{feed.missed.map((i) => <Item key={i.key} item={i} onGo={go} />)}</ul>
            </>
          )}

          <h4 className="nbell__section">
            {feed.teacher ? "To check" : "To do"}
            {feed.todo.length ? ` (${feed.todo.length})` : ""}
          </h4>
          {feed.todo.length === 0 ? (
            <p className="nbell__empty">{feed.teacher ? "No lab activity is past its due date." : "Nothing to do right now."}</p>
          ) : (
            <ul className="nbell__list">{feed.todo.map((i) => <Item key={i.key} item={i} onGo={go} />)}</ul>
          )}

          {announcements.length > 0 && (
            <>
              <h4 className="nbell__section">Announcements</h4>
              <ul className="nbell__list">{announcements.map((i) => <Announcement key={i.key} item={i} onGo={go} />)}</ul>
            </>
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
              <small>{toastLine(i)}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * An announcement: the admin's or a class's, with what it says (a long one opens in full). A class's
 * opens its class; the admin's has nowhere else to go.
 */
function Announcement({ item, onGo }) {
  const [full, setFull] = useState(false);
  const long = (item.body || "").length > 140 || (item.body || "").split("\n").length > 3;
  return (
    <li>
      <div className={`nbell__item nbell__ann ${item.unread ? "is-unread" : ""}`}>
        <Picture item={item} />
        <span className="nbell__text">
          <span className="nbell__title">{item.title}</span>
          {item.body && <span className={`nbell__body ${full ? "is-full" : ""}`}>{item.body}</span>}
          <span className="nbell__meta">
            {item.who ? `${item.who.name} · ` : ""}
            {item.className} · {when(item.at)}
          </span>
          {(long || item.to) && (
            <span className="nbell__acts">
              {long && (
                <button type="button" className="nbell__link" onClick={() => setFull((f) => !f)}>
                  {full ? "Show less" : "Read all"}
                </button>
              )}
              {item.to && (
                <button type="button" className="nbell__link" onClick={() => onGo(item)}>
                  Open the class
                </button>
              )}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

function Item({ item, onGo }) {
  const label = (KIND[item.kind] || KIND.announcement)[1];
  return (
    <li>
      <button
        type="button"
        className={`nbell__item ${item.unread ? "is-unread" : ""} ${item.missed || item.overdue || item.late ? "is-late" : ""}`}
        onClick={() => onGo(item)}
      >
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
