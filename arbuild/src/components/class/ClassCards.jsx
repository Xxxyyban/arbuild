// Class cards, used on Classes, the instructor's classes and the profile page: the class's
// initials in its colour, its section and schedule, when it next meets, and what's new.
// Each card keeps itself up to date. Styles: styles/AppShell.css (.ccard*).
import { useEffect, useState } from "react";
import { subscribeClass, subscribeMember, subscribeMyRemoval, shownName, when, toMs } from "../../lab/Classes";
import { classLine, nextMeeting, initials, CLASS_COLORS } from "../../lab/Schedule";
import Icon from "../Icon";

/** The card itself. As a button with onOpen; as a plain box without (the class form's preview). */
export function ClassCardView({ name, line, color, next, onOpen, children }) {
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button", onClick: onOpen } : {})}
      className={`ccard ${onOpen ? "" : "ccard--static"}`}
      style={{ "--class-color": color || CLASS_COLORS[0] }}
    >
      <span className="ccard__top">
        <span className="ccard__avatar" aria-hidden="true">{initials(name || "Class")}</span>
        <span className="ccard__titles">
          <strong className="ccard__name">{name || "Class"}</strong>
          <span className="ccard__line">{line || " "}</span>
        </span>
      </span>
      {next && (
        <span className={`ccard__next ${next.now ? "is-now" : ""}`}>
          <Icon name="clock" size={14} />
          {next.label}
        </span>
      )}
      {children && <span className="ccard__foot">{children}</span>}
    </Tag>
  );
}

function Card({ cls, fallbackName, onOpen, children }) {
  return (
    <ClassCardView
      name={cls?.name || fallbackName}
      line={classLine(cls)}
      color={cls?.color}
      next={cls?.archived ? null : nextMeeting(cls?.schedule)}
      onOpen={onOpen}
    >
      {children}
    </ClassCardView>
  );
}

/** A class a student is in, with what's new in it. entry: their userClasses row. */
export function StudentClassCard({ entry, uid, onOpen }) {
  const [cls, setCls] = useState(null);
  const [member, setMember] = useState(undefined);
  const [removal, setRemoval] = useState(null);
  useEffect(() => subscribeClass(entry.id, setCls, () => {}), [entry.id]);
  useEffect(() => subscribeMember(entry.id, uid, setMember, () => setMember(null)), [entry.id, uid]);
  useEffect(() => (member === null ? subscribeMyRemoval(entry.id, uid, setRemoval) : undefined), [entry.id, uid, member]);

  const newPosts = cls && member && toMs(cls.lastPostAt) > toMs(member.seenStreamAt);
  return (
    <Card cls={cls || { name: entry.name, section: entry.section }} fallbackName={entry.name} onOpen={onOpen}>
      {shownName(cls?.instructorName || entry.instructorName) && (
        <span className="ccard__who">
          <Icon name="user" size={14} />
          {shownName(cls?.instructorName || entry.instructorName)}
        </span>
      )}
      {member === null ? (
        <span className="chip chip--alert">{removal ? "Removed by your instructor" : "Not in this class"}</span>
      ) : cls?.archived ? (
        <span className="chip">Ended</span>
      ) : newPosts ? (
        <span className="chip chip--alert">New posts</span>
      ) : (
        <span className="chip">Up to date</span>
      )}
    </Card>
  );
}

/** A class an instructor teaches, with its code and when it was last posted to. */
export function TeachingClassCard({ cls, now, onOpen }) {
  return (
    <Card cls={cls} onOpen={onOpen}>
      <span className="ccard__who">
        <Icon name="users" size={14} />
        {cls.studentCount || 0} {cls.studentCount === 1 ? "student" : "students"}
        <code>{cls.code}</code>
      </span>
      {cls.archived ? (
        <span className="chip">Ended{cls.endedAt ? ` ${new Date(toMs(cls.endedAt)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
      ) : (
        <span className="chip">{cls.lastPostAt ? `Posted ${when(cls.lastPostAt, now)}` : "No posts yet"}</span>
      )}
    </Card>
  );
}
