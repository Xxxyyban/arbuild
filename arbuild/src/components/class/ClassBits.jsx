// Small pieces both class pages use (the instructor's and the student's): the top of the page (the
// class's tile and name, then its schedule, room, students and join code) and the section tabs.
// Styles: styles/AppShell.css (.class-hero, .class-meta, .ctabs, .copy-btn).
import { useEffect, useRef, useState } from "react";
import { formatWhen, initials, CLASS_COLORS } from "../../lab/Schedule";
import Circuit from "../Circuit";
import Icon from "../Icon";

/** Copies `text` (a code or an invite link). iconOnly shows just the icon, with `label` for screen readers. */
export function CopyButton({ text, label = "Copy", iconOnly = false, className = "btn btn--soft" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`${className} ${iconOnly ? "btn--icon" : ""}`.trim()}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard not available */
        }
      }}
    >
      <Icon name={copied ? "check" : label.toLowerCase().includes("link") ? "link" : "copy"} size={16} />
      {!iconOnly && (copied ? "Copied" : label)}
    </button>
  );
}

/** Schedule, room and (for the instructor) students and the join code, as one wrapping row. */
export function ClassMeta({ cls, children }) {
  const s = cls.schedule || {};
  const when = formatWhen(s); // "MWF · 9:00–10:30 AM", or each day's own time
  return (
    <div className="class-meta">
      {when && (
        <span className="class-meta__item">
          <Icon name="calendar" size={16} />
          {when}
        </span>
      )}
      {s.room && (
        <span className="class-meta__item">
          <Icon name="room" size={16} />
          {s.room}
        </span>
      )}
      {children}
    </div>
  );
}

/** The top of a class's page, in the class's colour. eyebrow: its section; children: more for the row under the name. */
export function ClassHero({ cls, eyebrow, children }) {
  return (
    <header className="class-hero" style={{ "--class-color": cls.color || CLASS_COLORS[0] }}>
      <Circuit />
      <span className="class-hero__tile" aria-hidden="true">{initials(cls.name)}</span>
      <div className="class-hero__text">
        {eyebrow && <span className="class-hero__eyebrow">{eyebrow}</span>}
        <h1>{cls.name}</h1>
        <ClassMeta cls={cls}>{children}</ClassMeta>
      </div>
    </header>
  );
}

/**
 * The class's sections. tabs: [{ id, label, icon, badge }]. On a phone they scroll sideways; the
 * open one scrolls into view.
 */
export function Tabs({ tabs, current, onChange }) {
  const strip = useRef(null);
  useEffect(() => {
    const nav = strip.current;
    const on = nav?.querySelector(".is-on");
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    // only the strip moves, never the page
    nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
  }, [current]);
  return (
    <nav className="ctabs" aria-label="Class sections" ref={strip}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={current === t.id ? "is-on" : ""}
          aria-current={current === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <Icon name={t.icon} size={17} />
          <span>{t.label}</span>
          {t.badge}
        </button>
      ))}
    </nav>
  );
}
