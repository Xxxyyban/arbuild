// Small pieces both class pages use (the instructor's and the student's): the line under the
// class name (schedule, room, students, join code) and the section tabs.
// Styles: styles/AppShell.css (.class-meta, .ctabs, .copy-btn).
import { useState } from "react";
import { formatDays, formatRange } from "../../lab/Schedule";
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
  const days = formatDays(s.days);
  const time = s.start ? formatRange(s.start, s.end) : "";
  return (
    <div className="class-meta">
      {(days || time) && (
        <span className="class-meta__item">
          <Icon name="calendar" size={16} />
          {[days, time].filter(Boolean).join(" · ")}
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

/** The class's sections. tabs: [{ id, label, icon, badge }] */
export function Tabs({ tabs, current, onChange }) {
  return (
    <nav className="ctabs" aria-label="Class sections">
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
