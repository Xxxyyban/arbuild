// What's new across all of someone's classes, live.
//   students:    lab activities still to do, new announcements / materials / labs, unread messages
//   instructors: unread messages from students
// <ClassFeed user profile>{(feed) => ...}</ClassFeed> hands its children
//   feed = { ready, items, todo, fresh, count, markAllSeen }
// Each item: { key, classId, className, kind, title, detail, at, unread, todo, to }.
// One invisible listener component per class (and per lab activity) keeps its slice up to date.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  subscribeMyMemberships,
  subscribeMyClasses,
  subscribeClass,
  subscribeMember,
  subscribePosts,
  subscribeThread,
  subscribeThreads,
  threadUnread,
  markStreamSeen,
  toMs,
} from "../../lab/Classes";
import { subscribeSession, subscribeStudentRow, sessionPhase, workLeft } from "../../lab/Sessions";
import { taskFor, progressHidden } from "../../lab/Tasks";

export default function ClassFeed({ user, profile, children }) {
  const uid = user?.uid;
  const teacher = profile?.role === "faculty";
  const [classes, setClasses] = useState(null);
  const [slices, setSlices] = useState({}); // classId -> items

  useEffect(() => {
    if (!uid) return undefined;
    const sub = teacher ? subscribeMyClasses : subscribeMyMemberships;
    return sub(uid, (list) => setClasses(list.filter((c) => !c.archived)), () => setClasses([]));
  }, [uid, teacher]);

  const report = useCallback((classId, items) => setSlices((s) => ({ ...s, [classId]: items })), []);

  const ids = (classes || []).map((c) => c.id);
  const feed = useMemo(() => {
    const items = ids.flatMap((id) => slices[id] || []).sort((a, b) => b.at - a.at);
    const todo = items.filter((i) => i.todo);
    const fresh = items.filter((i) => i.unread);
    return {
      ready: classes !== null,
      items,
      todo,
      fresh,
      count: new Set([...todo, ...fresh].map((i) => i.key)).size,
      markAllSeen: () => {
        const unseen = new Set(fresh.filter((i) => i.kind !== "message").map((i) => i.classId));
        unseen.forEach((id) => markStreamSeen(id, uid));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, ids.join(","), classes !== null, uid]);

  return (
    <>
      {uid &&
        (classes || []).map((c) =>
          teacher ? (
            <TeacherSource key={c.id} cls={c} uid={uid} report={report} />
          ) : (
            <StudentSource key={c.id} classId={c.id} uid={uid} report={report} />
          )
        )}
      {children(feed)}
    </>
  );
}

/* ---------- a student's class ---------- */

function StudentSource({ classId, uid, report }) {
  const [cls, setCls] = useState(null);
  const [member, setMember] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [thread, setThread] = useState(null);
  const [labs, setLabs] = useState({}); // code -> { phase, row }

  useEffect(() => subscribeClass(classId, setCls, () => setCls(null)), [classId]);
  useEffect(() => subscribeMember(classId, uid, setMember, () => setMember(null)), [classId, uid]);
  useEffect(() => subscribePosts(classId, setPosts, () => setPosts([])), [classId]);
  useEffect(() => subscribeThread(classId, uid, setThread, () => setThread(null)), [classId, uid]);
  const setLab = useCallback((code, v) => setLabs((l) => ({ ...l, [code]: v })), []);

  const inClass = !!member;
  useEffect(() => {
    if (!cls || !inClass) return report(classId, []);
    const seen = toMs(member.seenStreamAt);
    const name = cls.name;
    const items = [];
    posts.forEach((p) => {
      const at = toMs(p.createdAt);
      const base = { classId, className: name, at, title: p.title || firstLine(p.body) };
      if (p.kind === "lab" && p.sessionCode) {
        const lab = labs[p.sessionCode];
        const open = lab && lab.phase !== "ended";
        const done = !!lab?.row?.taskDone;
        items.push({
          ...base,
          key: `${classId}/${p.id}`,
          kind: "lab",
          unread: at > seen,
          todo: !!open && !done,
          detail: !lab
            ? ""
            : done
            ? "Done ✓"
            : lab.row
            ? lab.quiet ? "In progress" : `In progress · ${workLeft(lab.row)}`
            : lab.phase === "running"
            ? "Running now · not started"
            : "Opens soon",
          to: open ? `/lab?lab=${p.sessionCode}&class=${classId}` : `/classes/${classId}?tab=labs`,
        });
      } else if (at > seen) {
        items.push({ ...base, key: `${classId}/${p.id}`, kind: p.kind, unread: true, todo: false, detail: "", to: `/classes/${classId}` });
      }
    });
    if (threadUnread(thread, uid)) {
      items.push({
        key: `${classId}/msg`, classId, className: name, kind: "message", title: thread.lastText, detail: "",
        at: toMs(thread.lastAt), unread: true, todo: false, to: `/classes/${classId}?tab=messages`,
      });
    }
    report(classId, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, member, posts, thread, labs, inClass]);

  return (
    <>
      {inClass &&
        posts
          .filter((p) => p.kind === "lab" && p.sessionCode)
          .map((p) => <LabSource key={p.sessionCode} code={p.sessionCode} uid={uid} onChange={setLab} />)}
    </>
  );
}

/** One lab activity: is it open, and has this student finished it? */
function LabSource({ code, uid, onChange }) {
  const [session, setSession] = useState(undefined);
  const [row, setRow] = useState(null);
  useEffect(() => subscribeSession(code, setSession, () => setSession(null)), [code]);
  useEffect(() => subscribeStudentRow(code, uid, setRow, () => setRow(null)), [code, uid]);
  useEffect(() => {
    if (session === undefined) return;
    // quiet: the task keeps the student's progress from them until they finish
    onChange(code, { phase: session ? sessionPhase(session) : "ended", row, quiet: !!row && progressHidden(taskFor(session, row), row) });
  }, [code, session, row, onChange]);
  return null;
}

/* ---------- an instructor's class ---------- */

function TeacherSource({ cls, uid, report }) {
  const [threads, setThreads] = useState([]);
  useEffect(() => subscribeThreads(cls.id, setThreads, () => setThreads([])), [cls.id]);
  useEffect(() => {
    report(
      cls.id,
      threads
        .filter((t) => threadUnread(t, uid))
        .map((t) => ({
          key: `${cls.id}/msg/${t.id}`, classId: cls.id, className: cls.name, kind: "message",
          title: `${t.studentName || "A student"}: ${t.lastText}`, detail: "", at: toMs(t.lastAt), unread: true, todo: false,
          to: `/instructor/c/${cls.id}?tab=messages&student=${t.id}`,
        }))
    );
  }, [cls.id, cls.name, threads, uid, report]);
  return null;
}

const firstLine = (text = "") => text.split("\n")[0].slice(0, 80) || "New post";
