// Class cards, used on Classes, the instructor's classes and the profile page: the class's
// initials in its colour, its section and schedule, when it next meets, and what's new.
// Each card keeps itself up to date. Styles: styles/AppShell.css (.ccard*).
import { useEffect, useState } from "react";
import { subscribeClass, subscribeMember, subscribeThread, subscribeThreads, threadUnread, when, toMs } from "../../lab/Classes";
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
      next={nextMeeting(cls?.schedule)}
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
  const [thread, setThread] = useState(null);
  useEffect(() => subscribeClass(entry.id, setCls, () => {}), [entry.id]);
  useEffect(() => subscribeMember(entry.id, uid, setMember, () => setMember(null)), [entry.id, uid]);
  useEffect(() => subscribeThread(entry.id, uid, setThread, () => {}), [entry.id, uid]);

  const newPosts = cls && member && toMs(cls.lastPostAt) > toMs(member.seenStreamAt);
  const newMsg = threadUnread(thread, uid);
  return (
    <Card cls={cls || { name: entry.name, section: entry.section }} fallbackName={entry.name} onOpen={onOpen}>
      <span className="ccard__who">
        <Icon name="user" size={14} />
        {cls?.instructorName || entry.instructorName}
      </span>
      {member === null ? (
        <span className="chip">Not in this class</span>
      ) : (
        <>
          {newPosts && <span className="chip chip--alert">New posts</span>}
          {newMsg && <span className="chip chip--alert">New message</span>}
          {!newPosts && !newMsg && <span className="chip">Up to date</span>}
        </>
      )}
    </Card>
  );
}

/** A class an instructor teaches, with its code and how many students wrote to them. */
export function TeachingClassCard({ cls, uid, now, onOpen }) {
  const [threads, setThreads] = useState([]);
  useEffect(() => subscribeThreads(cls.id, setThreads, () => {}), [cls.id]);
  const unread = threads.filter((t) => threadUnread(t, uid)).length;
  return (
    <Card cls={cls} onOpen={onOpen}>
      <span className="ccard__who">
        <Icon name="users" size={14} />
        {cls.studentCount || 0} {cls.studentCount === 1 ? "student" : "students"}
        <code>{cls.code}</code>
      </span>
      {unread > 0 ? (
        <span className="chip chip--alert">{unread} new {unread === 1 ? "message" : "messages"}</span>
      ) : (
        <span className="chip">{cls.lastPostAt ? `Posted ${when(cls.lastPostAt, now)}` : "No posts yet"}</span>
      )}
    </Card>
  );
}
