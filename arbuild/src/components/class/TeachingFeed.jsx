// What's going on in an instructor's classes, live, for their bell (the students' is ClassFeed):
//   to check   lab activities past their due date and still open, with students who haven't finished
//   new        from the last week: students who joined, comments on posts, students who finished a
//              lab, and labs that closed before some students finished
//   announcements  the admin's, to everyone or to instructors, for two weeks (lab/Announcements.js)
// "New" is what came after the instructor last marked their alerts read (instructorSeenAt, on each of
// their classes; announcementsSeenAt, on their profile). Ended classes are left out: they're records.
// <TeachingFeed user profile>{(feed) => ...}</TeachingFeed> hands its children the shape ClassFeed does:
//   feed = { teacher: true, ready, items, todo, missed, fresh, announcements, count, markAllSeen }
// One invisible listener component per class, and per lab activity worth watching. Opened once for the
// whole visit by <TeachingFeedProvider> above the pages (FeedLayout.jsx), like the students' ClassFeed.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { subscribeMyClasses, subscribeClassLabs, subscribeRecentJoins, subscribeRecentComments, markClassAlertsSeen, toMs } from "../../lab/Classes";
import { subscribeFinished, sessionPhase, closedMs, dueText } from "../../lab/Sessions";
import { cappedScore } from "../../lab/Scoring";
import { taskFor } from "../../lab/Tasks";
import { useAnnouncements, noticeItems } from "../../lab/Announcements";
import { useAuth } from "../../context/AuthContext";
import useClock from "../../lab/useClock";

const WEEK = 7 * 864e5;

const Shared = createContext(null);

/** One feed, from one set of listeners, for every <TeachingFeed> under it. */
export function TeachingFeedProvider({ user, profile, children }) {
  return (
    <LiveFeed user={user} profile={profile}>
      {(feed) => <Shared.Provider value={feed}>{children}</Shared.Provider>}
    </LiveFeed>
  );
}

export default function TeachingFeed({ user, profile, children }) {
  const shared = useContext(Shared);
  return shared ? children(shared) : <LiveFeed user={user} profile={profile}>{children}</LiveFeed>;
}

function LiveFeed({ user, profile, children }) {
  const uid = user?.uid;
  const [classes, setClasses] = useState(null);
  const [slices, setSlices] = useState({}); // classId -> items
  const now = useClock();
  const [since] = useState(() => Date.now() - WEEK); // the last week, from when the page opened
  const { updateUserProfile } = useAuth();
  const notices = useAnnouncements(uid ? "faculty" : null);
  const seenNotices = profile?.announcementsSeenAt || 0;

  useEffect(() => (uid ? subscribeMyClasses(uid, (list) => setClasses(list.filter((c) => !c.archived)), () => setClasses([])) : undefined), [uid]);

  const report = useCallback((classId, items) => setSlices((s) => ({ ...s, [classId]: items })), []);

  const ids = (classes || []).map((c) => c.id);
  const feed = useMemo(() => {
    const items = [...ids.flatMap((id) => slices[id] || []), ...noticeItems(notices, seenNotices, now)].sort((a, b) => b.at - a.at);
    const todo = items.filter((i) => i.todo);
    const fresh = items.filter((i) => i.unread);
    return {
      teacher: true,
      ready: classes !== null,
      items,
      todo,
      missed: [],
      fresh,
      announcements: items.filter((i) => i.announcement).slice(0, 8),
      count: new Set([...todo, ...fresh].map((i) => i.key)).size,
      markAllSeen: () => {
        new Set(fresh.filter((i) => i.classId).map((i) => i.classId)).forEach((id) => markClassAlertsSeen(id).catch(() => {}));
        if (fresh.some((i) => i.kind === "notice")) updateUserProfile({ announcementsSeenAt: Date.now() }).catch(() => {});
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, ids.join(","), classes !== null, notices, seenNotices, now]);

  return (
    <>
      {(classes || []).map((c) => (
        <TeachingSource key={c.id} cls={c} uid={uid} since={since} now={now} report={report} />
      ))}
      {children(feed)}
    </>
  );
}

/* ---------- one class ---------- */

function TeachingSource({ cls, uid, since, now, report }) {
  const [joins, setJoins] = useState([]);
  const [commented, setCommented] = useState([]);
  const [labs, setLabs] = useState([]);
  const [finished, setFinished] = useState({}); // lab code -> the rows of students who finished

  useEffect(() => subscribeRecentJoins(cls.id, since, setJoins, () => setJoins([])), [cls.id, since]);
  useEffect(() => subscribeRecentComments(cls.id, since, setCommented, () => setCommented([])), [cls.id, since]);
  useEffect(() => subscribeClassLabs(cls.id, uid, setLabs, () => setLabs([])), [cls.id, uid]);
  const setRows = useCallback((code, rows) => setFinished((f) => ({ ...f, [code]: rows })), []);

  // the labs worth watching: the open ones, and those that closed in the last week
  const watched = labs.filter((l) => sessionPhase(l, now) !== "ended" || closedMs(l) > since);

  useEffect(() => {
    const seen = toMs(cls.instructorSeenAt);
    const base = { classId: cls.id, className: cls.name };
    const items = [];

    for (const m of joins) {
      const at = toMs(m.joinedAt);
      items.push({
        ...base,
        key: `join/${cls.id}/${m.id}`,
        kind: "join",
        at,
        unread: at > seen,
        who: { name: m.name || "A student", photo: m.photo || "" },
        title: "Joined the class",
        headline: `${m.name || "A student"} joined ${cls.name}`,
        to: `/instructor/c/${cls.id}?tab=students`,
      });
    }

    for (const p of commented) {
      if (p.lastCommentByUid === uid) continue; // their own
      const at = toMs(p.lastCommentAt);
      const post = p.title || (p.body || "").split("\n")[0].slice(0, 60) || "a post";
      items.push({
        ...base,
        key: `comment/${cls.id}/${p.id}/${at}`,
        kind: "comment",
        at,
        unread: at > seen,
        who: { name: p.lastCommentByName || "A student", photo: "" },
        title: `Commented on “${post}”`,
        headline: `${p.lastCommentByName || "A student"} commented on “${post}”`,
        to: `/instructor/c/${cls.id}`,
      });
    }

    for (const lab of watched) {
      const rows = finished[lab.code] || [];
      const monitor = `/instructor/c/${cls.id}/lab/${lab.code}`;
      for (const r of rows) {
        const at = Date.parse(r.lastActive || "") || 0;
        if (at <= since) continue;
        const points = taskFor(lab, r).points;
        items.push({
          ...base,
          key: `done/${lab.code}/${r.id}`,
          kind: "done",
          at,
          unread: at > seen,
          who: { name: r.name || "A student", photo: "" },
          title: `Finished “${lab.title}”`,
          detail: `${cappedScore(r, points)}/${points}`,
          headline: `${r.name || "A student"} finished “${lab.title}”`,
          to: monitor,
        });
      }

      // who hasn't finished: the class's students less those who have
      const left = Math.max(0, (cls.studentCount || 0) - rows.length);
      const phase = sessionPhase(lab, now);
      const due = lab.dueAt?.toMillis?.() || 0;
      if (phase !== "ended" && due && now > due && left > 0) {
        items.push({
          ...base,
          key: `due/${lab.code}`,
          kind: "due",
          at: due,
          todo: true,
          overdue: true,
          title: `“${lab.title}” is past its due date`,
          detail: `${left} of ${cls.studentCount} not finished · was due ${dueText(lab)} · still open`,
          headline: `“${lab.title}” is past its due date`,
          to: monitor,
        });
      }
      // A lab that closed this week, with students who didn't finish. Students who joined after it
      // closed don't count: they joined this week too, so they're among the recent joins.
      const closed = closedMs(lab);
      const inClassThen = (cls.studentCount || 0) - joins.filter((m) => toMs(m.joinedAt) > closed).length;
      const missed = Math.max(0, inClassThen - rows.length);
      if (phase === "ended" && lab.startedAt && closed > since && missed > 0) {
        items.push({
          ...base,
          key: `closed/${lab.code}`,
          kind: "closed",
          at: closed,
          unread: closed > seen,
          late: true,
          title: `“${lab.title}” closed`,
          detail: `${missed} of ${inClassThen} didn't finish`,
          headline: `“${lab.title}” closed: ${missed} didn't finish`,
          to: monitor,
        });
      }
    }

    report(cls.id, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, joins, commented, labs, finished, now]);

  return watched.map((l) => <FinishedSource key={l.code} code={l.code} onChange={setRows} />);
}

/** One lab activity: the students who have finished it. */
function FinishedSource({ code, onChange }) {
  useEffect(() => subscribeFinished(code, (rows) => onChange(code, rows), () => onChange(code, [])), [code, onChange]);
  return null;
}
