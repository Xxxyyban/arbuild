// What's going on across a student's classes, live: lab activities still to do (overdue ones first),
// lab activities they missed, and new announcements, materials and labs. The bell and the calendar
// both read it. (An instructor's bell has its own: TeachingFeed.jsx.)
// Announcements, from the admin (lab/Announcements.js) and from their instructors in their classes,
// stay listed for two weeks, new ones marked; the admin's count as read once marked read in the bell.
// <ClassFeed user profile>{(feed) => ...}</ClassFeed> hands its children
//   feed = { ready, items, todo, missed, fresh, announcements, count, markAllSeen, classes }
// Each item: { key, classId, className, kind, title, detail, at, unread, todo, overdue, missed, to, who };
// who: who it's from, { name, photo } (the class's instructor, from their profile card, lab/People.js).
// classes: [{ classId, cls, member, posts, labs }] for the calendar; labs: code -> { session, row, standing }.
// A lab closed before the student finished it is missed: it shows in the bell (and pops up once)
// until they've looked; a lab past its due date and still open is overdue: still to do, marked late.
// One invisible listener component per class (and per lab activity) keeps its slice up to date.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeMyMemberships,
  subscribeClass,
  subscribeMember,
  subscribePosts,
  markStreamSeen,
  shownName,
  toMs,
} from "../../lab/Classes";
import { subscribeInstructorCard } from "../../lab/People";
import { subscribeSession, subscribeStudentRow, sessionPhase, workLeft, labStanding, closedMs, dueText } from "../../lab/Sessions";
import { taskFor, progressHidden } from "../../lab/Tasks";
import { useAnnouncements, noticeItems, ANNOUNCED_DAYS } from "../../lab/Announcements";
import { useAuth } from "../../context/AuthContext";
import useClock from "../../lab/useClock";

// missed labs stay in the bell this long after they closed
const MISSED_DAYS = 30;

export default function ClassFeed({ user, profile, children }) {
  const student = profile?.role !== "faculty";
  const uid = student ? user?.uid : null;
  const [classes, setClasses] = useState(null);
  const [slices, setSlices] = useState({}); // classId -> { items, info }
  const now = useClock();
  const { updateUserProfile } = useAuth();
  const notices = useAnnouncements(uid ? "student" : null);
  const seenNotices = profile?.announcementsSeenAt || 0;

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyMemberships(uid, (list) => setClasses(list), () => setClasses([]));
  }, [uid]);

  const report = useCallback((classId, items, info) => setSlices((s) => ({ ...s, [classId]: { items, info } })), []);

  const ids = (classes || []).map((c) => c.id);
  const feed = useMemo(() => {
    const items = [...ids.flatMap((id) => slices[id]?.items || []), ...noticeItems(notices, seenNotices, now)].sort((a, b) => b.at - a.at);
    const todo = items.filter((i) => i.todo).sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || b.at - a.at);
    const missed = items.filter((i) => i.missed);
    const fresh = items.filter((i) => i.unread);
    return {
      ready: classes !== null,
      items,
      todo,
      missed,
      fresh,
      announcements: items.filter((i) => i.announcement).slice(0, 8),
      count: new Set([...todo, ...fresh].map((i) => i.key)).size,
      markAllSeen: () => {
        const unseen = new Set(fresh.filter((i) => i.classId).map((i) => i.classId));
        unseen.forEach((id) => markStreamSeen(id, uid));
        if (fresh.some((i) => i.kind === "notice")) updateUserProfile({ announcementsSeenAt: Date.now() }).catch(() => {});
      },
      classes: ids.map((id) => slices[id]?.info).filter(Boolean),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, ids.join(","), classes !== null, uid, notices, seenNotices, now]);

  return (
    <>
      {uid && (classes || []).map((c) => <StudentSource key={c.id} classId={c.id} uid={uid} report={report} now={now} />)}
      {children(feed)}
    </>
  );
}

/* ---------- a student's class ---------- */

function StudentSource({ classId, uid, report, now }) {
  const [cls, setCls] = useState(null);
  const [member, setMember] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [labs, setLabs] = useState({}); // code -> { session, row, quiet }
  const [instructor, setInstructor] = useState(null); // the instructor's card: their name and photo

  useEffect(() => subscribeClass(classId, setCls, () => setCls(null)), [classId]);
  useEffect(() => subscribeMember(classId, uid, setMember, () => setMember(null)), [classId, uid]);
  useEffect(() => subscribePosts(classId, setPosts, () => setPosts([])), [classId]);
  useEffect(() => (cls?.instructorUid ? subscribeInstructorCard(cls.instructorUid, setInstructor) : undefined), [cls?.instructorUid]);
  const setLab = useCallback((code, v) => setLabs((l) => ({ ...l, [code]: v })), []);

  const inClass = !!member;
  useEffect(() => {
    if (!cls || !inClass) return report(classId, [], null);
    const seen = toMs(member.seenStreamAt);
    const joinedAt = toMs(member.joinedAt);
    const ended = !!cls.archived; // an ended class is a record: nothing in it calls for attention
    const name = cls.name;
    const who = { name: shownName(instructor?.name || cls.instructorName) || "Your instructor", photo: instructor?.photo || "" };
    const items = [];
    const standings = {};
    posts.forEach((p) => {
      const at = toMs(p.createdAt);
      const base = { classId, className: name, at, title: p.title || firstLine(p.body), who };
      if (p.kind === "lab" && p.sessionCode) {
        const lab = labs[p.sessionCode];
        const standing = lab ? labStanding(lab.session, lab.row, now, joinedAt) : null;
        standings[p.sessionCode] = { ...lab, standing };
        const open = standing === "todo" || standing === "overdue" || standing === "soon";
        const due = dueText(lab?.session);
        items.push({
          ...base,
          key: `${classId}/${p.id}`,
          kind: "lab",
          unread: !ended && at > seen,
          todo: !ended && open,
          overdue: standing === "overdue",
          detail: !lab
            ? ""
            : standing === "done"
            ? "Done ✓"
            : standing === "overdue"
            ? `Overdue: was due ${due}`
            : lab.row
            ? lab.quiet ? "In progress" : `In progress · ${workLeft(lab.row)}`
            : sessionPhase(lab.session, now) === "running"
            ? `Running now · not started${due ? ` · due ${due}` : ""}`
            : `Opens soon${due ? ` · due ${due}` : ""}`,
          to: open ? `/lab?lab=${p.sessionCode}&class=${classId}` : `/classes/${classId}?tab=labs`,
        });
        // missed: closed before they finished. Its own key, so it pops up once when it happens.
        const closed = closedMs(lab?.session);
        if (!ended && standing === "missed" && (!closed || now - closed < MISSED_DAYS * 864e5)) {
          const when = closed || at;
          items.push({
            ...base,
            at: when,
            key: `${classId}/${p.id}:missed`,
            kind: "lab",
            missed: true,
            unread: when > seen,
            todo: false,
            detail: lab.row ? `Closed before you finished · ${workLeft(lab.row)}` : "Closed before you opened it",
            to: `/classes/${classId}?tab=labs`,
          });
        }
      } else if (p.kind === "announcement" && !ended && (at > seen || now - at < ANNOUNCED_DAYS * 864e5)) {
        // the class's announcements stay listed for a while, read or not
        items.push({ ...base, key: `${classId}/${p.id}`, kind: p.kind, announcement: true, body: p.body, unread: at > seen, todo: false, detail: "", to: `/classes/${classId}` });
      } else if (!ended && at > seen) {
        items.push({ ...base, key: `${classId}/${p.id}`, kind: p.kind, unread: true, todo: false, detail: "", to: `/classes/${classId}` });
      }
    });
    report(classId, items, { classId, cls, member, posts, labs: standings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, member, posts, labs, inClass, instructor, now]);

  return (
    <>
      {inClass &&
        posts
          .filter((p) => p.kind === "lab" && p.sessionCode)
          .map((p) => <LabSource key={p.sessionCode} code={p.sessionCode} uid={uid} onChange={setLab} />)}
    </>
  );
}

/** One lab activity: the lab itself (open? due when?), and this student's row in it. */
function LabSource({ code, uid, onChange }) {
  const [session, setSession] = useState(undefined);
  const [row, setRow] = useState(null);
  useEffect(() => subscribeSession(code, setSession, () => setSession(null)), [code]);
  useEffect(() => subscribeStudentRow(code, uid, setRow, () => setRow(null)), [code, uid]);
  useEffect(() => {
    if (session === undefined) return;
    // quiet: the task keeps the student's progress from them until they finish
    onChange(code, { session: session || { status: "closed" }, row, quiet: !!row && progressHidden(taskFor(session, row), row) });
  }, [code, session, row, onChange]);
  return null;
}

const firstLine = (text = "") => text.split("\n")[0].slice(0, 80) || "New post";
