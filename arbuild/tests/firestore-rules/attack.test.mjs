// Attack tests for ARBuild's Firestore rules, run against the local Firestore emulator.
// Each "BLOCKS" test is something an attacker would try; each "ALLOWS" test is normal use that
// must keep working. Run: firebase emulators:exec --only firestore "node attack.test.mjs"
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch,
  serverTimestamp, increment, Timestamp,
} from "firebase/firestore";

const RULES = process.argv[2] || "../../firestore.rules";
const env = await initializeTestEnvironment({
  projectId: "arbuild-attack-test",
  firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8080 },
});

const people = {
  admin: { role: "admin", email: "admin@udd.edu.ph" },
  profA: { role: "faculty", email: "profa@udd.edu.ph", firstName: "Rosa", lastName: "Santos", facultyTitle: "Prof.", department: "SITE", photoThumb: "data:image/jpeg;base64,cHJvZkE=", profileCompleted: true },
  profB: { role: "faculty", email: "profb@udd.edu.ph", firstName: "Ben", lastName: "Cruz", profileCompleted: true },
  juan: { role: "student", email: "juan@cdd.edu.ph", firstName: "Juan", lastName: "Dela Cruz", studentId: "2023-0142", section: "BSIT 3A", contactNumber: "0917 123 4567", photoThumb: "data:image/jpeg;base64,anVhbg==", profileCompleted: true },
  maria: { role: "student", email: "maria@cdd.edu.ph", firstName: "Maria", lastName: "Reyes", studentId: "2023-0177", section: "BSIT 3A", profileCompleted: true },
  eve: { role: "student", email: "eve@cdd.edu.ph", firstName: "Eve", lastName: "Hacker", studentId: "2023-0666", section: "BSIT 3A", contactNumber: "0999 000 1111", photoThumb: "data:image/jpeg;base64,ZXZl", profileCompleted: true },
};
const as = (uid) => env.authenticatedContext(uid, { email: people[uid].email }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, p] of Object.entries(people)) await setDoc(doc(db, "users", uid), { uid, ...p });
    await setDoc(doc(db, "classes", "c1"), { name: "PC Assembly", code: "K7QX2M", instructorUid: "profA", instructorName: "Prof. Rosa Santos", joinOpen: true, archived: false, studentCount: 1 });
    await setDoc(doc(db, "classCodes", "K7QX2M"), { classId: "c1", instructorUid: "profA" });
    await setDoc(doc(db, "classes", "closed"), { name: "Closed", code: "CLOSED", instructorUid: "profA", joinOpen: false, archived: false, studentCount: 0 });
    await setDoc(doc(db, "classes", "c1", "members", "juan"), { uid: "juan", name: "Juan Dela Cruz", email: people.juan.email, studentId: "2023-0142", section: "BSIT 3A", joinedAt: Timestamp.now(), seenStreamAt: Timestamp.now() });
    await setDoc(doc(db, "classes", "c1", "members", "maria"), { uid: "maria", name: "Maria Reyes", email: people.maria.email, studentId: "2023-0177", section: "BSIT 3A", joinedAt: Timestamp.now(), seenStreamAt: Timestamp.now() });
    await setDoc(doc(db, "classes", "c1", "posts", "p1"), { kind: "announcement", title: "Hi", body: "Welcome", authorUid: "profA", commentCount: 0, createdAt: Timestamp.now() });
    await setDoc(doc(db, "classes", "c1", "threads", "juan"), { studentUid: "juan", lastFrom: "juan", lastText: "help", lastAt: Timestamp.now(), readAt: { juan: Timestamp.now() } });
    await setDoc(doc(db, "classes", "c1", "threads", "juan", "messages", "m1"), { text: "help", from: "juan", fromName: "Juan Dela Cruz", createdAt: Timestamp.now() });
    await setDoc(doc(db, "sessions", "LAB1"), { code: "LAB1", title: "Build", instructorUid: "profA", classId: "c1", status: "running", expiresAt: null });
    await setDoc(doc(db, "sessions", "LAB1", "students", "maria"), { uid: "maria", score: 100 });
    await setDoc(doc(db, "sessions", "LAB1", "events", "e1"), { uid: "maria", type: "miss" });
  });
}

const results = [];
async function check(label, kind, fn) {
  await seed();
  try {
    await (kind === "BLOCKS" ? assertFails(fn()) : assertSucceeds(fn()));
    results.push(["PASS", kind, label]);
  } catch (err) {
    results.push(["FAIL", kind, label, err.message.split("\n")[0]]);
  }
}

const joinBatch = (db, uid, data) => {
  const b = writeBatch(db);
  b.set(doc(db, "classes", "c1", "members", uid), data);
  b.update(doc(db, "classes", "c1"), { studentCount: increment(1) });
  return b.commit();
};
const goodJoin = (uid) => ({
  uid, name: `${people[uid].firstName} ${people[uid].lastName}`, email: people[uid].email,
  studentId: people[uid].studentId, section: people[uid].section,
  contactNumber: people[uid].contactNumber || "", photo: people[uid].photoThumb || "", // their card (src/lab/People.js)
  joinedAt: serverTimestamp(), seenStreamAt: serverTimestamp(),
});

/* ---------- strangers ---------- */
await check("signed-out visitor reads a profile", "BLOCKS", () => getDoc(doc(anon(), "users", "juan")));
await check("signed-out visitor reads a class", "BLOCKS", () => getDoc(doc(anon(), "classes", "c1")));
await check("signed-out visitor reads a class's posts", "BLOCKS", () => getDocs(collection(anon(), "classes", "c1", "posts")));
await check("signed-out visitor reads lab results", "BLOCKS", () => getDocs(collection(anon(), "sessions", "LAB1", "students")));

/* ---------- profiles ---------- */
await check("student reads another student's profile", "BLOCKS", () => getDoc(doc(as("eve"), "users", "juan")));
await check("student lists every user", "BLOCKS", () => getDocs(collection(as("eve"), "users")));
await check("student makes themself admin", "BLOCKS", () => updateDoc(doc(as("eve"), "users", "eve"), { role: "admin" }));
await check("student re-activates a disabled account", "BLOCKS", () => updateDoc(doc(as("eve"), "users", "eve"), { status: "active" }));
await check("student takes another student's ID", "BLOCKS", () => updateDoc(doc(as("eve"), "users", "eve"), { studentId: "2023-0142" }));
await check("student creates a profile for someone", "BLOCKS", () => setDoc(doc(as("eve"), "users", "newbie"), { role: "faculty" }));
await check("student edits their own name", "ALLOWS", () => updateDoc(doc(as("juan"), "users", "juan"), { firstName: "Juanito" }));
await check("student sends a notification", "BLOCKS", () => setDoc(doc(as("eve"), "notifications", "n1"), { userId: "juan", text: "click this" }));

/* ---------- class codes and classes ---------- */
await check("student lists all class codes", "BLOCKS", () => getDocs(collection(as("eve"), "classCodes")));
await check("student lists all classes", "BLOCKS", () => getDocs(collection(as("eve"), "classes")));
await check("student creates a class", "BLOCKS", () => setDoc(doc(as("eve"), "classes", "fake"), { name: "x", instructorUid: "eve", studentCount: 0 }));
await check("student renames a class", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1"), { name: "pwned" }));
await check("student sets the head count to 999", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1"), { studentCount: 999 }));
await check("student bumps the head count without joining", "BLOCKS", () => updateDoc(doc(as("eve"), "classes", "c1"), { studentCount: increment(1) }));
await check("another instructor lists someone's classes", "BLOCKS", () => getDocs(query(collection(as("profB"), "classes"), where("instructorUid", "==", "profA"))));
await check("another instructor takes over a class", "BLOCKS", () => updateDoc(doc(as("profB"), "classes", "c1"), { instructorUid: "profB" }));
await check("instructor steals a class through a new code", "BLOCKS", () => setDoc(doc(as("profB"), "classCodes", "STEAL1"), { classId: "c1", instructorUid: "profB" }));
await check("instructor lists their own classes", "ALLOWS", () => getDocs(query(collection(as("profA"), "classes"), where("instructorUid", "==", "profA"))));

/* ---------- joining ---------- */
await check("student joins as themself", "ALLOWS", () => joinBatch(as("eve"), "eve", goodJoin("eve")));
await check("student joins under another student's name and ID", "BLOCKS", () =>
  joinBatch(as("eve"), "eve", { ...goodJoin("eve"), name: "Juan Dela Cruz", studentId: "2023-0142" }));
await check("student adds someone else to a class", "BLOCKS", () => joinBatch(as("eve"), "maria2", { ...goodJoin("eve"), uid: "maria2" }));
await check("student joins a class that isn't taking students", "BLOCKS", () => setDoc(doc(as("eve"), "classes", "closed", "members", "eve"), goodJoin("eve")));
await check("student backdates their join", "BLOCKS", () => joinBatch(as("eve"), "eve", { ...goodJoin("eve"), joinedAt: Timestamp.fromMillis(0) }));
await check("student reads the class roster", "BLOCKS", () => getDocs(collection(as("juan"), "classes", "c1", "members")));
await check("student removes a classmate", "BLOCKS", () => deleteDoc(doc(as("juan"), "classes", "c1", "members", "maria")));

/* ---------- stream ---------- */
await check("outsider reads a class's posts", "BLOCKS", () => getDocs(collection(as("eve"), "classes", "c1", "posts")));
await check("member reads the posts", "ALLOWS", () => getDocs(collection(as("juan"), "classes", "c1", "posts")));
await check("student posts an announcement", "BLOCKS", () => setDoc(doc(as("juan"), "classes", "c1", "posts", "fake"), { kind: "announcement", authorUid: "juan" }));
await check("student edits the instructor's post", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "posts", "p1"), { body: "pwned" }));
await check("student sets a post's comment count to 500", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "posts", "p1"), { commentCount: 500 }));
const comment = (db, data) => setDoc(doc(db, "classes", "c1", "posts", "p1", "comments", "x"), data);
const goodComment = { text: "question?", authorUid: "juan", authorName: "Juan Dela Cruz", fromInstructor: false, createdAt: serverTimestamp() };
await check("member comments", "ALLOWS", () => comment(as("juan"), goodComment));
await check("student fakes the Instructor badge", "BLOCKS", () => comment(as("juan"), { ...goodComment, fromInstructor: true }));
await check("student comments as a classmate", "BLOCKS", () => comment(as("juan"), { ...goodComment, authorUid: "maria" }));
await check("student posts a giant comment", "BLOCKS", () => comment(as("juan"), { ...goodComment, text: "x".repeat(5000) }));

/* ---------- private messages: off (classes use their own messenger) ---------- */
// The old conversations stay in the database, closed to everyone: the two people in them included.
const msg = (db, who, data) => setDoc(doc(db, "classes", "c1", "threads", who, "messages", "new"), data);
await check("student reads their old conversation", "BLOCKS", () => getDocs(collection(as("juan"), "classes", "c1", "threads", "juan", "messages")));
await check("instructor reads an old conversation", "BLOCKS", () => getDoc(doc(as("profA"), "classes", "c1", "threads", "juan")));
await check("instructor lists the old conversations", "BLOCKS", () => getDocs(collection(as("profA"), "classes", "c1", "threads")));
await check("classmate reads someone's conversation", "BLOCKS", () => getDocs(collection(as("maria"), "classes", "c1", "threads", "juan", "messages")));
await check("student sends a message", "BLOCKS", () => msg(as("juan"), "juan", { text: "hi", from: "juan", fromName: "Juan", createdAt: serverTimestamp() }));
await check("instructor sends a message", "BLOCKS", () => msg(as("profA"), "juan", { text: "hi", from: "profA", fromName: "Rosa Santos", createdAt: serverTimestamp() }));
await check("student marks a conversation read", "BLOCKS", () =>
  setDoc(doc(as("juan"), "classes", "c1", "threads", "juan"), { readAt: { juan: serverTimestamp() } }, { merge: true }));

/* ---------- labs and grades ---------- */
await check("student lists every lab session", "BLOCKS", () => getDocs(collection(as("juan"), "sessions")));
await check("another instructor lists someone's labs", "BLOCKS", () => getDocs(query(collection(as("profB"), "sessions"), where("classId", "==", "c1"))));
await check("instructor lists their class's labs", "ALLOWS", () =>
  getDocs(query(collection(as("profA"), "sessions"), where("classId", "==", "c1"), where("instructorUid", "==", "profA"))));
await check("student reads a classmate's lab result", "BLOCKS", () => getDoc(doc(as("juan"), "sessions", "LAB1", "students", "maria")));
await check("student changes a classmate's score", "BLOCKS", () => setDoc(doc(as("juan"), "sessions", "LAB1", "students", "maria"), { score: 0 }, { merge: true }));
await check("student gives themself a different task", "BLOCKS", () => setDoc(doc(as("juan"), "sessions", "LAB1", "students", "juan"), { assignedTask: "easy" }));
await check("student reads the mistake log", "BLOCKS", () => getDocs(collection(as("juan"), "sessions", "LAB1", "events")));
await check("student logs a mistake as a classmate", "BLOCKS", () => setDoc(doc(as("juan"), "sessions", "LAB1", "events", "x"), { uid: "maria", type: "miss" }));
await check("student closes the lab", "BLOCKS", () => updateDoc(doc(as("juan"), "sessions", "LAB1"), { status: "closed" }));
await check("student writes their progress in a running lab", "ALLOWS", () => setDoc(doc(as("juan"), "sessions", "LAB1", "students", "juan"), { uid: "juan", score: 40, partsLeft: 3 }));

/* ---------- the official score (out of 100) ---------- */
const myRow = (data) => setDoc(doc(as("juan"), "sessions", "LAB1", "students", "juan"), { uid: "juan", scoreScale: 100, ...data }, { merge: true });
await check("student saves an official score of 87/100", "ALLOWS", () => myRow({ score: 87 }));
await check("student saves a score of 101", "BLOCKS", () => myRow({ score: 101 }));
await check("student saves a score of 9999", "BLOCKS", () => myRow({ score: 9999 }));
await check("student saves a negative score", "BLOCKS", () => myRow({ score: -5 }));
await check("student saves a fractional score", "BLOCKS", () => myRow({ score: 87.5 }));
await check("student saves a score as text", "BLOCKS", () => myRow({ score: "100" }));
await check("student switches their row off the /100 scale", "BLOCKS", () => myRow({ score: 50, scoreScale: 1000 }));
await check("student saves 43 on a 50-point task", "ALLOWS", () => myRow({ score: 43, scoreScale: 50 }));
await check("student saves 60 on a 50-point task", "BLOCKS", () => myRow({ score: 60, scoreScale: 50 }));
await check("student sets a zero-point scale", "BLOCKS", () => myRow({ score: 0, scoreScale: 0 }));
await check("student raises an existing score past 100", "BLOCKS", async () => {
  await myRow({ score: 90 });
  return updateDoc(doc(as("juan"), "sessions", "LAB1", "students", "juan"), { score: 150 });
});
await check("instructor corrects a student's score", "ALLOWS", () => updateDoc(doc(as("profA"), "sessions", "LAB1", "students", "maria"), { score: 95 }));

/* ---------- other people's class lists ---------- */
await check("student reads another student's class list", "BLOCKS", () => getDocs(collection(as("eve"), "userClasses", "juan", "classes")));


/* ---------- the app's own writes, exactly as it makes them ---------- */
await check("app: instructor creates a class and its code", "ALLOWS", () => {
  const db = as("profA"); const b = writeBatch(db);
  b.set(doc(db, "classes", "new1"), { name: "New", section: "", subject: "", code: "NEWCDE", instructorUid: "profA", instructorName: "Prof. Rosa Santos", joinOpen: true, archived: false, studentCount: 0, createdAt: serverTimestamp(), lastPostAt: null });
  b.set(doc(db, "classCodes", "NEWCDE"), { classId: "new1", instructorUid: "profA" });
  return b.commit();
});
await check("app: instructor posts", "ALLOWS", () => {
  const db = as("profA"); const b = writeBatch(db);
  b.set(doc(db, "classes", "c1", "posts", "p9"), { kind: "material", title: "t", body: "b", links: [], files: [], sessionCode: null, pinned: false, authorUid: "profA", authorName: "Prof. Rosa Santos", commentCount: 0, createdAt: serverTimestamp() });
  b.update(doc(db, "classes", "c1"), { lastPostAt: serverTimestamp() });
  return b.commit();
});
await check("app: student comments (with the count)", "ALLOWS", () => {
  const db = as("juan"); const b = writeBatch(db);
  b.set(doc(db, "classes", "c1", "posts", "p1", "comments", "k9"), { text: "q", authorUid: "juan", authorName: "Juan Dela Cruz", fromInstructor: false, createdAt: serverTimestamp() });
  b.update(doc(db, "classes", "c1", "posts", "p1"), { commentCount: increment(1) });
  return b.commit();
});
await check("app: instructor comments with the badge", "ALLOWS", () => {
  const db = as("profA"); const b = writeBatch(db);
  b.set(doc(db, "classes", "c1", "posts", "p1", "comments", "k8"), { text: "a", authorUid: "profA", authorName: "Prof. Rosa Santos", fromInstructor: true, createdAt: serverTimestamp() });
  b.update(doc(db, "classes", "c1", "posts", "p1"), { commentCount: increment(1) });
  return b.commit();
});
await check("app: student clears the new-posts badge", "ALLOWS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { seenStreamAt: serverTimestamp() }));
await check("app: student leaves the class", "ALLOWS", () => {
  const db = as("juan"); const b = writeBatch(db);
  b.delete(doc(db, "classes", "c1", "members", "juan"));
  b.delete(doc(db, "userClasses", "juan", "classes", "c1"));
  b.update(doc(db, "classes", "c1"), { studentCount: increment(-1) });
  return b.commit();
});
await check("app: instructor removes a student", "ALLOWS", () => {
  const db = as("profA"); const b = writeBatch(db);
  b.delete(doc(db, "classes", "c1", "members", "maria"));
  b.update(doc(db, "classes", "c1"), { studentCount: increment(-1) });
  return b.commit();
});
await check("app: instructor makes a new code", "ALLOWS", () => {
  const db = as("profA"); const b = writeBatch(db);
  b.set(doc(db, "classCodes", "NEW222"), { classId: "c1", instructorUid: "profA" });
  b.delete(doc(db, "classCodes", "K7QX2M"));
  b.update(doc(db, "classes", "c1"), { code: "NEW222" });
  return b.commit();
});
await check("app: student saves the class to their list", "ALLOWS", () =>
  setDoc(doc(as("eve"), "userClasses", "eve", "classes", "c1"), { classId: "c1", name: "PC Assembly", joinedAt: serverTimestamp() }, { merge: true }));
await check("app: student joins a lab", "ALLOWS", () =>
  setDoc(doc(as("juan"), "sessions", "LAB1", "students", "juan"), { uid: "juan", name: "Juan Dela Cruz", email: "juan@cdd.edu.ph", studentId: "2023-0142", section: "BSIT 3A", joinedAt: "2026-10-23", joins: 1, lastActive: "2026-10-23", mode: "assemble", platform: "am4", score: 0, assembleMs: 0, disassembleMs: 0, assemble: 0, disassemble: 0, penalty: 0, partsLeft: 0, mistakes: 0, phaseDone: false }, { merge: true }));
await check("app: student logs a mistake in a running lab", "ALLOWS", () =>
  setDoc(doc(as("juan"), "sessions", "LAB1", "events", "e9"), { uid: "juan", type: "miss", part: "cpu", msg: "wrong socket", ts: 1 }));
await check("app: instructor watches the lab", "ALLOWS", () => getDocs(collection(as("profA"), "sessions", "LAB1", "students")));
await check("app: instructor gives a student a task", "ALLOWS", () => updateDoc(doc(as("profA"), "sessions", "LAB1", "students", "maria"), { assignedTask: "t2", assignedAt: 1 }));
await check("app: instructor adds an older lab to a class", "ALLOWS", () => updateDoc(doc(as("profA"), "sessions", "LAB1"), { classId: "c1", className: "PC Assembly" }));
await check("app: student reads their own lab result", "ALLOWS", () => getDoc(doc(as("maria"), "sessions", "LAB1", "students", "maria")));
await check("app: new student finishes first-time setup", "ALLOWS", async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", "eve"), { uid: "eve", role: "student", email: "eve@cdd.edu.ph", profileCompleted: false }));
  return updateDoc(doc(as("eve"), "users", "eve"), { firstName: "Eve", lastName: "H", studentId: "2023-0666", section: "BSIT 3A", profileCompleted: true });
});

/* ---------- profile cards (src/lab/People.js) ---------- */
// an instructor's card: anyone signed in reads it; only they write it, exactly as their profile has it
const profACard = (extra = {}) => ({ uid: "profA", name: "Rosa Santos", department: "SITE", email: people.profA.email, photo: people.profA.photoThumb, updatedAt: serverTimestamp(), ...extra });
const putProfACard = () => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "instructors", "profA"), profACard({ updatedAt: Timestamp.now() })));
await check("app: instructor puts up their card", "ALLOWS", () => setDoc(doc(as("profA"), "instructors", "profA"), profACard()));
await check("app: student opens their instructor's card", "ALLOWS", async () => {
  await putProfACard();
  return getDoc(doc(as("juan"), "instructors", "profA"));
});
await check("instructor's card under a made-up name", "BLOCKS", () => setDoc(doc(as("profA"), "instructors", "profA"), profACard({ name: "Dr. Somebody Else" })));
await check("instructor's card with a photo not in their profile", "BLOCKS", () => setDoc(doc(as("profA"), "instructors", "profA"), profACard({ photo: "data:image/jpeg;base64,ZmFrZQ==" })));
await check("instructor's card with an extra field", "BLOCKS", () => setDoc(doc(as("profA"), "instructors", "profA"), profACard({ role: "admin" })));
await check("instructor's card backdated", "BLOCKS", () => setDoc(doc(as("profA"), "instructors", "profA"), profACard({ updatedAt: Timestamp.fromMillis(0) })));
await check("instructor writes another instructor's card", "BLOCKS", () =>
  setDoc(doc(as("profA"), "instructors", "profB"), profACard({ uid: "profB", name: "Ben Cruz", department: "", email: people.profB.email, photo: "" })));
await check("student puts up an instructor's card for themself", "BLOCKS", () =>
  setDoc(doc(as("eve"), "instructors", "eve"), { uid: "eve", name: "Eve Hacker", department: "", email: people.eve.email, photo: people.eve.photoThumb, updatedAt: serverTimestamp() }));
await check("student changes their instructor's card", "BLOCKS", async () => {
  await putProfACard();
  return updateDoc(doc(as("eve"), "instructors", "profA"), { name: "Eve Hacker" });
});
await check("signed-in user lists every instructor's card", "BLOCKS", () => getDocs(collection(as("eve"), "instructors")));
await check("signed-out visitor opens an instructor's card", "BLOCKS", async () => {
  await putProfACard();
  return getDoc(doc(anon(), "instructors", "profA"));
});

// a student's card is their member record: only the class's instructor reads it; only they bring it up to date
const juanCard = { name: "Juan Dela Cruz", studentId: "2023-0142", section: "BSIT 3A", contactNumber: people.juan.contactNumber, photo: people.juan.photoThumb };
await check("app: student saves a photo with its thumbnail", "ALLOWS", () =>
  updateDoc(doc(as("juan"), "users", "juan"), { photoURL: "data:image/png;base64,QUJD", photoThumb: "data:image/jpeg;base64,QUI=" }));
await check("app: student brings their card up to date", "ALLOWS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), juanCard));
await check("app: student's card follows a new photo and number", "ALLOWS", async () => {
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "users", "juan"), { contactNumber: "0920 555 0000", photoThumb: "data:image/jpeg;base64,bmV3" }));
  return updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { ...juanCard, contactNumber: "0920 555 0000", photo: "data:image/jpeg;base64,bmV3" });
});
await check("app: instructor opens a student's card", "ALLOWS", () => getDoc(doc(as("profA"), "classes", "c1", "members", "juan")));
await check("student's card under another name", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { ...juanCard, name: "Maria Reyes" }));
await check("student's card with another student's ID", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { ...juanCard, studentId: "2023-0177" }));
await check("student's card with a photo not in their profile", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { ...juanCard, photo: "data:image/jpeg;base64,ZmFrZQ==" }));
await check("student slips a join date into a card update", "BLOCKS", () => updateDoc(doc(as("juan"), "classes", "c1", "members", "juan"), { ...juanCard, joinedAt: Timestamp.fromMillis(0) }));
await check("student changes a classmate's card", "BLOCKS", () =>
  updateDoc(doc(as("juan"), "classes", "c1", "members", "maria"), { name: "Maria Reyes", studentId: "2023-0177", section: "BSIT 3A", contactNumber: "", photo: "" }));
await check("student reads a classmate's card", "BLOCKS", () => getDoc(doc(as("juan"), "classes", "c1", "members", "maria")));
await check("another instructor reads a student's card", "BLOCKS", () => getDoc(doc(as("profB"), "classes", "c1", "members", "juan")));
await check("student joins with a photo not in their profile", "BLOCKS", () => joinBatch(as("eve"), "eve", { ...goodJoin("eve"), photo: "data:image/jpeg;base64,ZmFrZQ==" }));

/* ---------- report ---------- */
const failed = results.filter((r) => r[0] === "FAIL");
for (const r of results) console.log(`${r[0]}  ${r[1].padEnd(6)}  ${r[2]}${r[3] ? `\n        ${r[3]}` : ""}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
await env.cleanup();
process.exit(failed.length ? 1 : 0);
