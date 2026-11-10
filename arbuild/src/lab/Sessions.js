// Classes (live lab sessions) in Firestore.
//
//   sessions/{code}                  the class: name, class rules, tasks, status
//   sessions/{code}/students/{uid}   one row per student: score, time, parts left, mistakes,
//                                    and assignedTask (the task the instructor gave them)
//   sessions/{code}/events/{id}      every mistake / safety / revert, kept after the class ends
//
// A class goes through three phases:
//   waiting  students join with the code and wait; the instructor assigns who starts with what
//   running  students work; each one's own phase clock counts up (slower = fewer points)
//   ended    the instructor closed it (results are kept)
// Older classes saved with a countdown (expiresAt) still end when it runs out.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { DEFAULT_SETUP, generateJoinCode, normalizeCode, normalizeSetup } from "./Setup";
import { taskFor, setupForTask, normalizeTask, newTaskId } from "./Tasks";
import { cappedScore } from "./Scoring";

export const MAX_MINUTES = 600;

export const sessionRef = (code) => doc(db, "sessions", code);
export const studentRef = (code, uid) => doc(db, "sessions", code, "students", uid);

/** "waiting" | "running" | "ended" */
export function sessionPhase(session, now = Date.now()) {
  if (!session || session.status === "closed") return "ended";
  if (session.status === "waiting") return "waiting";
  const expires = session.expiresAt?.toMillis?.();
  return expires != null && expires <= now ? "ended" : "running";
}

export const isEnded = (session, now) => sessionPhase(session, now) === "ended";

/** What the instructor typed -> whole minutes, or null if it isn't valid. */
export function parseMinutes(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= MAX_MINUTES ? n : null;
}

/** 95 -> "1h 35m", 45 -> "45m" */
export function formatMinutes(min) {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** 3725000 -> "1:02:05", 95000 -> "1:35" */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** One student's lab setup: the class rules plus the task they were given (or the default task). */
export function studentSetup(session, row) {
  return setupForTask(normalizeSetup(session?.setup), taskFor(session, row));
}

/* ---------- instructor ---------- */

/**
 * Creates a lab session in the "waiting" phase. Students start when the instructor presses Start.
 * classId: the class it belongs to (a lab activity); task: the first task's settings (mode, platform,
 * hints, partPicking, partInfo, parMin, instructions); dueAt: when it's due (a Date), or null. A lab
 * still open after its due date can be done late; one closed before a student finished is missed
 * (the calendar and the bell show both).
 */
export async function createSession({ instructor, title, parMin = 10, classId = null, className = "", task = {}, dueAt = null }) {
  const first = normalizeTask({ mode: "assemble", platform: "am4", parMin, ...task, id: newTaskId() });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    if ((await getDoc(sessionRef(code))).exists()) continue; // code already used

    await setDoc(sessionRef(code), {
      code,
      title: title.trim() || "Untitled class",
      instructorUid: instructor.uid,
      instructorName: instructor.name,
      classId,
      className,
      setup: normalizeSetup({ ...DEFAULT_SETUP, parMin: first.parMin }),
      tasks: [first],
      defaultTaskId: first.id,
      status: "waiting",
      createdAt: Timestamp.now(),
      startedAt: null,
      expiresAt: null,
      dueAt: dueAt ? Timestamp.fromDate(dueAt) : null,
    });
    return code;
  }
  throw new Error("Couldn't make a unique code. Try again.");
}

export async function listMySessions(uid) {
  const snap = await getDocs(query(collection(db, "sessions"), where("instructorUid", "==", uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
}

/** Lets every student start. There is no countdown: the class runs until the instructor closes it. */
export function startSession(code) {
  return updateDoc(sessionRef(code), { status: "running", startedAt: Timestamp.now(), expiresAt: null });
}

/** Reopens a closed class. */
export function reopenSession(code, session) {
  return updateDoc(sessionRef(code), {
    status: "running",
    startedAt: session?.startedAt ?? Timestamp.now(),
    expiresAt: null,
  });
}

// closedAt is the server's time, not this computer's: for a minute after it, firestore.rules still takes
// each student's final result (lab/useLabSession.js), and a clock that's off mustn't cut that short
export const closeSession = (code) =>
  updateDoc(sessionRef(code), { status: "closed", closedAt: serverTimestamp() });

/** Sets (a Date) or clears (null) when a lab activity is due. */
export const setLabDue = (code, dueAt) => updateDoc(sessionRef(code), { dueAt: dueAt ? Timestamp.fromDate(dueAt) : null });

/** When a lab closed, in ms (0 if it hasn't, or doesn't say). */
export const closedMs = (session) => session?.closedAt?.toMillis?.() ?? session?.expiresAt?.toMillis?.() ?? 0;

/**
 * Where a student stands with a lab activity: "done", "missed" (closed before they finished),
 * "overdue" (past its due date, still open), "todo" (open), "soon" (waiting to start) or "closed"
 * (it was never theirs to do: it closed without ever starting, or before they were in the class).
 * session: the lab; row: their row (or null); now: ms; joinedAt: when they joined the class, ms.
 */
export function labStanding(session, row, now = Date.now(), joinedAt = 0) {
  if (row?.taskDone) return "done";
  const phase = sessionPhase(session, now);
  if (phase === "ended") {
    if (row) return "missed"; // they started it, and it closed before they finished
    if (!session?.startedAt) return "closed"; // it closed without ever starting
    return joinedAt && closedMs(session) && closedMs(session) < joinedAt ? "closed" : "missed";
  }
  const due = session?.dueAt?.toMillis?.();
  if (due && now > due) return "overdue";
  return phase === "running" ? "todo" : "soon";
}

/** "Due Mon 10 Nov, 5:00 PM" style: a lab's due date in words ("" without one). */
export function dueText(session) {
  const due = session?.dueAt?.toMillis?.();
  if (!due) return "";
  return new Date(due).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Class settings, e.g. { hints: false }. Students pick the change up straight away. */
export function updateSetup(code, patch) {
  const fields = {};
  Object.entries(patch).forEach(([k, v]) => (fields[`setup.${k}`] = v));
  return updateDoc(sessionRef(code), fields);
}

/** Saves the class's task list and which task is the default. Students pick changes up straight away. */
export function saveTasks(code, tasks, defaultTaskId) {
  const clean = tasks.map(normalizeTask);
  const def = clean.some((t) => t.id === defaultTaskId) ? defaultTaskId : clean[0]?.id ?? null;
  return updateDoc(sessionRef(code), { tasks: clean, defaultTaskId: def });
}

/** Gives students a task (null = the class's default task). A new task sends them back to its start. */
export async function assignTask(code, uids, taskId) {
  for (let i = 0; i < uids.length; i += 400) {
    const batch = writeBatch(db);
    uids.slice(i, i + 400).forEach((uid) =>
      batch.update(studentRef(code, uid), { assignedTask: taskId || null, assignedAt: Date.now() })
    );
    await batch.commit();
  }
}

/* ---------- live listeners (each returns its unsubscribe) ---------- */

export const subscribeSession = (code, cb, onError) =>
  onSnapshot(sessionRef(code), (snap) => cb(snap.exists() ? snap.data() : null), onError);

export const subscribeStudents = (code, cb, onError) =>
  onSnapshot(
    collection(db, "sessions", code, "students"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );

export const subscribeStudentRow = (code, uid, cb, onError) =>
  onSnapshot(studentRef(code, uid), (snap) => cb(snap.exists() ? snap.data() : null), onError);

/** The students who have finished the lab's task (the instructor's bell). */
export const subscribeFinished = (code, cb, onError) =>
  onSnapshot(
    query(collection(db, "sessions", code, "students"), where("taskDone", "==", true)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );

/** Every event of the class (all students), newest first. Used for the class's common mistakes. */
export const subscribeAllEvents = (code, cb, onError) =>
  onSnapshot(
    collection(db, "sessions", code, "events"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts)),
    onError
  );

// No orderBy here so no composite index is needed. Sorted in the browser instead.
export const subscribeEvents = (code, uid, cb, onError) =>
  onSnapshot(
    query(collection(db, "sessions", code, "events"), where("uid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts)),
    onError
  );

/* ---------- student ---------- */

/** Joins (or rejoins) a class. Returns { session, row } or { error }. */
export async function joinSession(rawCode, user, profile) {
  const code = normalizeCode(rawCode);
  try {
    const snap = await getDoc(sessionRef(code));
    if (!snap.exists()) return { error: "No lab has that code. Check it with your instructor." };

    const session = snap.data();
    if (isEnded(session)) return { error: "This lab is closed. Ask your instructor to reopen it." };

    const ref = studentRef(code, user.uid);
    const prev = await getDoc(ref);
    const now = new Date().toISOString();
    const name =
      [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user.email || "Student";

    await setDoc(
      ref,
      {
        uid: user.uid,
        name,
        email: user.email || "",
        studentId: profile?.studentId || "",
        section: profile?.section || "",
        joinedAt: prev.exists() ? prev.data().joinedAt : now,
        joins: (prev.exists() ? prev.data().joins || 1 : 0) + 1, // rejoins are counted
        lastActive: now,
        // a first join starts a clean row; a rejoin keeps the old numbers until new ones arrive
        ...(prev.exists()
          ? {}
          : {
              mode: taskFor(session, null).mode,
              platform: taskFor(session, null).platform,
              score: 0,
              scoreScale: 100, // official score, out of 100 (lab/Scoring.js)
              assembleMs: 0,
              disassembleMs: 0,
              assemble: 0,
              disassemble: 0,
              penalty: 0,
              partsLeft: 0,
              mistakes: 0,
              phaseDone: false,
            }),
      },
      { merge: true }
    );
    return { session, row: prev.exists() ? prev.data() : null };
  } catch (err) {
    console.error("joinSession failed:", err);
    return { error: `Couldn't join (${err.code || err.message}).` };
  }
}

/* ---------- results export ---------- */

/** 95000 -> "1:35" (blank when there is no time yet) */
export const formatMs = (ms) => (ms > 0 ? formatClock(ms) : "");

/** What a student has left, in words: "3 of 5 faults fixed" (troubleshooting) or "4 parts left". */
export const workLeft = (row) =>
  row?.faultsTotal != null ? `${row.faultsFixed ?? 0} of ${row.faultsTotal} faults fixed` : `${row?.partsLeft ?? "?"} parts left`;

export function resultsToCsv(students, session) {
  const head = [
    "Name", "Student ID", "Section", "Task", "Platform", "Task done", "Task time", "Score", "Out of", "Assemble pts",
    "Assemble time", "Disassemble pts", "Disassemble time", "Penalties", "Parts left", "Faults fixed", "Mistakes", "Rejoins",
    "Joined", "Last active",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = students.map((s) => {
    const task = taskFor(session, s);
    return [
      s.name, s.studentId, s.section, task.title, task.platform.toUpperCase(),
      s.taskDone ? "yes" : "no", formatMs(s.taskMs),
      s.scoreScale ? cappedScore(s, task.points) : s.score, s.scoreScale ? task.points : "", s.assemble, formatMs(s.assembleMs), s.disassemble, formatMs(s.disassembleMs),
      // "3 of 5", not "3/5", which a spreadsheet would read as a date
      s.penalty, s.partsLeft, s.faultsTotal != null ? `${s.faultsFixed ?? 0} of ${s.faultsTotal}` : "", s.mistakes,
      Math.max(0, (s.joins || 1) - 1), s.joinedAt, s.lastActive,
    ].map(esc).join(",");
  });
  return [head.map(esc).join(","), ...rows].join("\n");
}