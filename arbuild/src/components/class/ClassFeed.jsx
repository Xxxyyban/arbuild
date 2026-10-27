// What's new across a student's classes, live: lab activities still to do, and new announcements,
// materials and labs. (Instructors have no feed: what they'd hear about, they post themselves.)
// <ClassFeed user profile>{(feed) => ...}</ClassFeed> hands its children
//   feed = { ready, items, todo, fresh, count, markAllSeen }
// Each item: { key, classId, className, kind, title, detail, at, unread, todo, to, who }; who: who it's
// from, { name, photo } (a student's class: the instructor, from their profile card, lab/People.js).
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
import { subscribeSession, subscribeStudentRow, sessionPhase, workLeft } from "../../lab/Sessions";
import { taskFor, progressHidden } from "../../lab/Tasks";

export default function ClassFeed({ user, profile, children }) {
  const student = profile?.role !== "faculty";
  const uid = student ? user?.uid : null;
  const [classes, setClasses] = useState(null);
  const [slices, setSlices] = useState({}); // classId -> items

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeMyMemberships(uid, (list) => setClasses(list.filter((c) => !c.archived)), () => setClasses([]));
  }, [uid]);

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
        const unseen = new Set(fresh.map((i) => i.classId));
        unseen.forEach((id) => markStreamSeen(id, uid));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, ids.join(","), classes !== null, uid]);

  return (
    <>
      {uid && (classes || []).map((c) => <StudentSource key={c.id} classId={c.id} uid={uid} report={report} />)}
      {children(feed)}
    </>
  );
}

/* ---------- a student's class ---------- */

function StudentSource({ classId, uid, report }) {
  const [cls, setCls] = useState(null);
  const [member, setMember] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [labs, setLabs] = useState({}); // code -> { phase, row }
  const [instructor, setInstructor] = useState(null); // the instructor's card: their name and photo

  useEffect(() => subscribeClass(classId, setCls, () => setCls(null)), [classId]);
  useEffect(() => subscribeMember(classId, uid, setMember, () => setMember(null)), [classId, uid]);
  useEffect(() => subscribePosts(classId, setPosts, () => setPosts([])), [classId]);
  useEffect(() => (cls?.instructorUid ? subscribeInstructorCard(cls.instructorUid, setInstructor) : undefined), [cls?.instructorUid]);
  const setLab = useCallback((code, v) => setLabs((l) => ({ ...l, [code]: v })), []);

  const inClass = !!member;
  useEffect(() => {
    if (!cls || !inClass) return report(classId, []);
    const seen = toMs(member.seenStreamAt);
    const name = cls.name;
    const who = { name: shownName(instructor?.name || cls.instructorName) || "Your instructor", photo: instructor?.photo || "" };
    const items = [];
    posts.forEach((p) => {
      const at = toMs(p.createdAt);
      const base = { classId, className: name, at, title: p.title || firstLine(p.body), who };
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
    report(classId, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, member, posts, labs, inClass, instructor]);

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

const firstLine = (text = "") => text.split("\n")[0].slice(0, 80) || "New post";
