// Classes in Firestore. A class is a lasting group: the instructor makes it once and gets a join
// code; students join it once with that code and stay in it. Everything else happens inside it.
//
//   classes/{classId}                          name (the subject), section, schedule, color, code, instructorUid, instructorName,
//                                              joinOpen, archived, createdAt, lastPostAt, studentCount
//   classes/{classId}/members/{uid}            a student: name, email, studentId, section, contactNumber, photo (their
//                                              card, lab/People.js), joinedAt, seenStreamAt
//   classes/{classId}/posts/{postId}           the stream: kind "announcement" | "material" | "lab",
//                                              title, body, links[], files[], sessionCode (lab), pinned,
//                                              authorUid, authorName, createdAt, commentCount
//   classes/{classId}/posts/{postId}/comments  questions and answers under a post (the whole class sees them)
//   classCodes/{code}                         { classId }: finds a class from its code (read one by one only)
//   userClasses/{uid}/classes/{classId}        a student's own list of their classes
//
// Lab activities are the live lab sessions (lab/Sessions.js) made from inside a class: the session
// carries classId, and a "lab" post in the stream points to it. Students open it from the class
// with one click, without typing another code.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { generateJoinCode, normalizeCode } from "./Setup";
import { normalizeSchedule, CLASS_COLORS } from "./Schedule";
import { sessionRef, sessionPhase } from "./Sessions";
import { studentCard } from "./People";

export const classRef = (id) => doc(db, "classes", id);
export const memberRef = (id, uid) => doc(db, "classes", id, "members", uid);
export const postRef = (id, postId) => doc(db, "classes", id, "posts", postId);
const codeRef = (code) => doc(db, "classCodes", code);
const myClassRef = (uid, id) => doc(db, "userClasses", uid, "classes", id);

export const MAX_FILE_MB = 20;

/** Firestore time -> ms (pending server times read as "now"). */
export const toMs = (t) => (t?.toMillis ? t.toMillis() : typeof t === "number" ? t : t ? Date.parse(t) || 0 : 0);

// Names are shown without a title. Older classes and posts saved the instructor's name
// with one ("Prof. Rosa Santos"), or only the title ("Prof.") when setup hadn't kept their name;
// a bare title counts as no name until they add theirs (pages/Instructor.jsx NamePrompt).
const TITLE = /^(prof|professor|dr|engr|mr|mrs|ms|sir|ma'?am)\.?(\s+|$)/i;

/** A saved name as shown: without a title in front, "" when it was only a title. */
export const shownName = (name) => (name ? name.trim().replace(TITLE, "").trim() : "");

/** A person's whole name from their profile; without one, their email or `fallback`. No title ("Prof."). */
export function personName(profile, user, fallback = "Student") {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return name || user?.email || fallback;
}

// Snapshots read pending server timestamps as an estimate, so a post or comment just sent sorts in place.
const rows = (snap) =>
  snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), pending: d.metadata.hasPendingWrites }));

/* ---------- instructor: classes ---------- */

/**
 * Makes a class and reserves its code. Returns the new class id.
 * name: the subject ("IT Elective 01"); schedule: see lab/Schedule; color: the card colour.
 */
export async function createClass({ instructor, name, section = "", schedule = null, color = CLASS_COLORS[0] }) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateJoinCode();
    if ((await getDoc(codeRef(code))).exists()) continue; // taken
    const id = doc(collection(db, "classes")).id;
    const batch = writeBatch(db);
    batch.set(classRef(id), {
      name: name.trim() || "Untitled class",
      section: section.trim(),
      schedule: normalizeSchedule(schedule),
      color: CLASS_COLORS.includes(color) ? color : CLASS_COLORS[0],
      code,
      instructorUid: instructor.uid,
      instructorName: instructor.name,
      joinOpen: true,
      archived: false,
      studentCount: 0,
      createdAt: serverTimestamp(),
      lastPostAt: null,
    });
    batch.set(codeRef(code), { classId: id, instructorUid: instructor.uid });
    await batch.commit();
    return id;
  }
  throw new Error("Couldn't make a unique code. Try again.");
}

export async function listMyClasses(uid) {
  const snap = await getDocs(query(collection(db, "classes"), where("instructorUid", "==", uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export const subscribeMyClasses = (uid, cb, onError) =>
  onSnapshot(
    query(collection(db, "classes"), where("instructorUid", "==", uid)),
    (snap) => cb(rows(snap).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))),
    onError
  );

export const updateClass = (id, patch) => updateDoc(classRef(id), patch);

/**
 * Puts the instructor's name, as their profile has it now, on each of their classes that shows
 * another: one from before they changed it, or a bare "Prof." from before setup saved names.
 */
export async function syncInstructorName(uid, name) {
  const stale = (await listMyClasses(uid)).filter((c) => c.instructorName !== name);
  await Promise.all(stale.map((c) => updateClass(c.id, { instructorName: name })));
}

/** A new code (for example after the old one was shared too widely). The old code stops working. */
export async function newClassCode(id, oldCode, instructorUid) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateJoinCode();
    if ((await getDoc(codeRef(code))).exists()) continue;
    const batch = writeBatch(db);
    batch.set(codeRef(code), { classId: id, instructorUid });
    if (oldCode) batch.delete(codeRef(oldCode));
    batch.update(classRef(id), { code });
    await batch.commit();
    return code;
  }
  throw new Error("Couldn't make a unique code. Try again.");
}

/** Takes a student out of the class. Their past lab results stay in the lab sessions. */
export async function removeMember(id, uid) {
  const batch = writeBatch(db);
  batch.delete(memberRef(id, uid));
  batch.update(classRef(id), { studentCount: increment(-1) });
  await batch.commit();
}

/* ---------- students: joining ---------- */

/** Joins a class by its code. Returns { classId, cls } or { error }. Joining twice is harmless. */
export async function joinClass(rawCode, user, profile) {
  const code = normalizeCode(rawCode);
  try {
    const found = await getDoc(codeRef(code));
    if (!found.exists()) return { error: "No class has that code. Check it with your instructor." };
    const classId = found.data().classId;
    const snap = await getDoc(classRef(classId));
    if (!snap.exists()) return { error: "That class no longer exists." };
    const cls = snap.data();
    if (cls.instructorUid === user.uid) return { classId, cls }; // the instructor's own class

    const already = await getDoc(memberRef(classId, user.uid));
    if (!already.exists()) {
      if (cls.archived) return { error: "This class has been archived." };
      if (cls.joinOpen === false) return { error: "This class isn't taking new students. Ask your instructor." };
      const batch = writeBatch(db);
      batch.set(memberRef(classId, user.uid), {
        uid: user.uid,
        ...studentCard(profile), // name, student ID, section, contact number, photo: what the instructor sees
        email: user.email || "",
        joinedAt: serverTimestamp(),
        seenStreamAt: serverTimestamp(),
      });
      batch.update(classRef(classId), { studentCount: increment(1) });
      await batch.commit();
    }
    await setDoc(
      myClassRef(user.uid, classId),
      { classId, name: cls.name, section: cls.section || "", code, instructorName: cls.instructorName || "", joinedAt: serverTimestamp() },
      { merge: true }
    );
    return { classId, cls };
  } catch (err) {
    console.error("joinClass failed:", err);
    return { error: `Couldn't join (${err.code || err.message}).` };
  }
}

/** Leaves a class (the student's own choice). */
export async function leaveClass(classId, uid) {
  const batch = writeBatch(db);
  batch.delete(memberRef(classId, uid));
  batch.delete(myClassRef(uid, classId));
  batch.update(classRef(classId), { studentCount: increment(-1) });
  await batch.commit();
}

/**
 * What a typed code is: { kind: "class", classId }, { kind: "lab", code, session } (a lab activity's
 * own code, or an older lab made before classes), or null when nothing has it.
 */
export async function resolveCode(rawCode) {
  const code = normalizeCode(rawCode);
  const classId = await classIdForCode(code);
  if (classId) return { kind: "class", classId };
  try {
    const snap = await getDoc(sessionRef(code));
    if (snap.exists()) return { kind: "lab", code, session: snap.data() };
  } catch {
    /* not readable: treat as unknown */
  }
  return null;
}

/**
 * Brings a lab made before classes into a class: the lab gets the class, and a "lab" post
 * appears in the class stream so students find it there.
 */
export async function attachLab(session, cls, author) {
  await updateDoc(sessionRef(session.code), { classId: cls.id, className: cls.name });
  await createPost(cls.id, { kind: "lab", title: session.title, body: "", sessionCode: session.code, author });
}

/**
 * What a student's code box does with a code. A class code joins the class; a lab code opens
 * that lab (joining its class on the way, if it has one). Returns { to } (where to go) or { error }.
 */
export async function joinByCode(rawCode, user, profile) {
  const code = normalizeCode(rawCode);
  const found = await resolveCode(code);
  if (!found) return { error: "No class or lab has that code. Check it with your instructor." };
  if (found.kind === "class") {
    const res = await joinClass(code, user, profile);
    return res.error ? { error: res.error } : { to: `/classes/${res.classId}` };
  }
  if (sessionPhase(found.session) === "ended") {
    return { error: "That is a lab code, and that lab is closed. To join a class, use the class code from your instructor." };
  }
  const classId = found.session.classId;
  if (classId) {
    const cls = await getDoc(classRef(classId)).catch(() => null);
    if (cls?.exists()) await joinClass(cls.data().code, user, profile); // best effort: the lab opens either way
  }
  return { to: classId ? `/lab?lab=${code}&class=${classId}` : `/lab?lab=${code}` };
}

/** The link an instructor shares: opening it (and signing in) joins the class. */
export const inviteLink = (code) => `${window.location.origin}/classes?join=${code}`;

/** Is this code a class code? Returns the class id or null (used by the lab's code box). */
export async function classIdForCode(rawCode) {
  try {
    const snap = await getDoc(codeRef(normalizeCode(rawCode)));
    return snap.exists() ? snap.data().classId : null;
  } catch {
    return null;
  }
}

export const subscribeMyMemberships = (uid, cb, onError) =>
  onSnapshot(collection(db, "userClasses", uid, "classes"), (snap) => cb(rows(snap)), onError);

/* ---------- live listeners ---------- */

export const subscribeClass = (id, cb, onError) =>
  onSnapshot(classRef(id), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);

export const subscribeMembers = (id, cb, onError) =>
  onSnapshot(collection(db, "classes", id, "members"), (snap) => cb(rows(snap)), onError);

export const subscribeMember = (id, uid, cb, onError) =>
  onSnapshot(memberRef(id, uid), (snap) => cb(snap.exists() ? snap.data() : null), onError);

export const subscribePosts = (id, cb, onError) =>
  onSnapshot(query(collection(db, "classes", id, "posts"), orderBy("createdAt", "desc"), limit(100)), (snap) => cb(rows(snap)), onError);

export const subscribeComments = (id, postId, cb, onError) =>
  onSnapshot(
    query(collection(db, "classes", id, "posts", postId, "comments"), orderBy("createdAt", "asc")),
    (snap) => cb(rows(snap)),
    onError
  );

/** The lab sessions made in this class by its instructor (newest first). The rules only let an
 * instructor list their own labs, so the query says whose. */
export const subscribeClassLabs = (id, instructorUid, cb, onError) =>
  onSnapshot(
    query(collection(db, "sessions"), where("classId", "==", id), where("instructorUid", "==", instructorUid)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))),
    onError
  );

/* ---------- stream: announcements, materials, lab activities ---------- */

/**
 * Posts to the class stream. files: File objects to upload (materials). links: [{ url, label }].
 * Uploads go first, so a failed upload doesn't leave a half post behind.
 */
export async function createPost(id, { kind, title, body, links = [], files = [], sessionCode = null, author }) {
  const postId = doc(collection(db, "classes", id, "posts")).id;
  const uploaded = [];
  for (const f of files) {
    if (f.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${f.name} is larger than ${MAX_FILE_MB} MB.`);
    const path = `classes/${id}/posts/${postId}/${Date.now()}-${f.name.replace(/[^\w.\-() ]+/g, "_")}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, f, { contentType: f.type || "application/octet-stream" });
    uploaded.push({ name: f.name, size: f.size, type: f.type || "", path, url: await getDownloadURL(r) });
  }
  const batch = writeBatch(db);
  batch.set(postRef(id, postId), {
    kind,
    title: (title || "").trim(),
    body: (body || "").trim(),
    links: links.filter((l) => l.url).map((l) => ({ url: l.url.trim(), label: (l.label || "").trim() })),
    files: uploaded,
    sessionCode,
    pinned: false,
    authorUid: author.uid,
    authorName: author.name,
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  batch.update(classRef(id), { lastPostAt: serverTimestamp() });
  await batch.commit();
  return postId;
}

export const updatePost = (id, postId, patch) => updateDoc(postRef(id, postId), { ...patch, editedAt: serverTimestamp() });

export async function deletePost(id, post) {
  for (const f of post.files || []) {
    try {
      await deleteObject(storageRef(storage, f.path));
    } catch (err) {
      console.warn("couldn't delete file", f.path, err);
    }
  }
  const comments = await getDocs(collection(db, "classes", id, "posts", post.id, "comments"));
  const batch = writeBatch(db);
  comments.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(postRef(id, post.id));
  await batch.commit();
}

export async function addComment(id, postId, { text, author }) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "classes", id, "posts", postId, "comments")), {
    text: text.trim(),
    authorUid: author.uid,
    authorName: author.name,
    fromInstructor: !!author.instructor,
    createdAt: serverTimestamp(),
  });
  batch.update(postRef(id, postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(id, postId, commentId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "classes", id, "posts", postId, "comments", commentId));
  batch.update(postRef(id, postId), { commentCount: increment(-1) });
  await batch.commit();
}

/** The student has seen the stream up to now (clears the "new" badge). */
export const markStreamSeen = (id, uid) => updateDoc(memberRef(id, uid), { seenStreamAt: serverTimestamp() }).catch(() => {});

/* ---------- small helpers for the pages ---------- */

/** "just now", "5 min ago", "3 h ago", "Mon 14 Oct" */
export function when(t, now = Date.now()) {
  const ms = toMs(t);
  if (!ms) return "";
  const s = Math.round((now - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export const fileSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Adds https:// to a bare link. */
export const fixUrl = (u) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`);

export { Timestamp };
