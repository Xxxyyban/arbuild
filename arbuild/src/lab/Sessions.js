// Classes (live lab sessions) in Firestore.
//
//   sessions/{code}                  the class: name, rules, timer, status
//   sessions/{code}/students/{uid}   one row per student: score, parts left, mistakes,
//                                    and assignedMode (what the instructor chose for them)
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
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { DEFAULT_SETUP, generateJoinCode, normalizeCode, normalizeSetup } from "./Setup";
import { normalizePlatform } from "./Catalog";

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

/** The lab setup for one student's starting mode (full PC to take apart, or an empty bench). */
export const startSetupFor = (setup, mode, platform) => ({
  ...normalizeSetup(setup),
  startMode: mode,
  startState: mode === "disassemble" ? "full" : "empty",
  ...(normalizePlatform(platform) ? { platform } : {}),
});

/** One student's setup: their own assignment wins, then the class default. */
export function studentSetup(session, row) {
  const setup = normalizeSetup(session?.setup);
  return startSetupFor(setup, row?.assignedMode || setup.startMode, row?.assignedPlatform || setup.platform);
}

/* ---------- instructor ---------- */

/** Creates the class in the "waiting" phase. Students start when the instructor presses Start. */
export async function createSession({ instructor, title, parMin }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    if ((await getDoc(sessionRef(code))).exists()) continue; // code already used

    await setDoc(sessionRef(code), {
      code,
      title: title.trim() || "Untitled class",
      instructorUid: instructor.uid,
      instructorName: instructor.name,
      setup: normalizeSetup({ ...DEFAULT_SETUP, parMin }),
      status: "waiting",
      createdAt: Timestamp.now(),
      startedAt: null,
      expiresAt: null,
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

export const closeSession = (code) =>
  updateDoc(sessionRef(code), { status: "closed", closedAt: Timestamp.now() });

/** Class settings, e.g. { hints: false }. Students pick the change up straight away. */
export function updateSetup(code, patch) {
  const fields = {};
  Object.entries(patch).forEach(([k, v]) => (fields[`setup.${k}`] = v));
  return updateDoc(sessionRef(code), fields);
}

/**
 * What one student gets. patch = { assignedMode?: "assemble" | "disassemble" | null,
 * assignedPlatform?: "am4" | "am5" | null }. null means "use the class default".
 */
export const assignStudent = (code, uid, patch) =>
  updateDoc(studentRef(code, uid), { ...patch, assignedAt: Date.now() });

/** The same for many students at once. */
export async function assignMany(code, uids, patch) {
  for (let i = 0; i < uids.length; i += 400) {
    const batch = writeBatch(db);
    uids.slice(i, i + 400).forEach((uid) => batch.update(studentRef(code, uid), { ...patch, assignedAt: Date.now() }));
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
    if (!snap.exists()) return { error: "Code not found. Check it with your instructor." };

    const session = snap.data();
    if (isEnded(session)) return { error: "This class has ended." };

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
              mode: session.setup?.startMode || "assemble",
              platform: normalizeSetup(session.setup).platform,
              score: 0,
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

export function resultsToCsv(students, setup) {
  const s0 = normalizeSetup(setup);
  const head = [
    "Name", "Student ID", "Section", "Assigned start", "Platform", "Mode", "Score", "Assemble pts", "Assemble time",
    "Disassemble pts", "Disassemble time", "Penalties", "Parts left", "Mistakes", "Phase done", "Rejoins", "Joined",
    "Last active",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = students.map((s) =>
    [
      s.name, s.studentId, s.section, s.assignedMode || `${s0.startMode} (class default)`,
      (s.assignedPlatform || s0.platform).toUpperCase(),
      s.mode, s.score, s.assemble, formatMs(s.assembleMs), s.disassemble, formatMs(s.disassembleMs),
      s.penalty, s.partsLeft, s.mistakes,
      s.phaseDone ? "yes" : "no", Math.max(0, (s.joins || 1) - 1), s.joinedAt, s.lastActive,
    ].map(esc).join(",")
  );
  return [head.map(esc).join(","), ...rows].join("\n");
}