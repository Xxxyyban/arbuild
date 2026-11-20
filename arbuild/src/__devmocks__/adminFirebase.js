// TEMP-DEVTEST: what the admin page imports from firebase/firestore, firebase/auth and firebase/app,
// on an in-memory list of accounts (kept in localStorage). Creating an account never reaches Firebase.
const KEY = "devAdminUsers1";
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();

function seed() {
  const s = (uid, first, last, id, section, extra = {}) => ({
    uid, role: "student", email: `${first[0]}${last.replace(/\s/g, "")}@cdd.edu.ph`.toLowerCase(),
    firstName: first, lastName: last, studentId: id, section, status: "active", profileCompleted: true, createdAt: days(30), ...extra,
  });
  const f = (uid, first, last, title, extra = {}) => ({
    uid, role: "faculty", email: `${first[0]}${last}@cdd.edu.ph`.toLowerCase(),
    firstName: first, lastName: last, facultyTitle: title, facultyId: `F-${uid.slice(-4)}`, department: "SITE", status: "active", profileCompleted: true, createdAt: days(60), ...extra,
  });
  const list = [
    f("inst1", "Rosa", "Santos", "Prof."),
    f("inst2", "Ramon", "Villanueva", "Engr."),
    s("stu1", "Juan", "Dela Cruz", "2023-0142", "BSIT 3A"),
    s("stu2", "Maria", "Reyes", "2023-0177", "BSIT 3A"),
    s("stu3", "Ana", "Bautista", "2023-0190", "BSIT 3A"),
    s("stu4", "Paolo", "Mendoza", "2023-0204", "BSIT 2B"),
    s("stu5", "Kristine", "Garcia", "2023-0219", "BSIT 2B"),
    s("stu6", "Mark", "Aquino", "2024-0031", "BSIT 2B", { status: "inactive" }),
    { uid: "stu7", role: "student", email: "lsoriano@cdd.edu.ph", firstName: "", lastName: "", studentId: "", section: "", status: "active", profileCompleted: false, createdAt: days(2) },
    { uid: "stu8", role: "student", email: "jtorres@cdd.edu.ph", firstName: "", lastName: "", studentId: "", section: "", status: "active", profileCompleted: false, createdAt: days(1), lastNotifiedAt: days(1) },
    { uid: "adm1", role: "admin", email: "admin@cdd.edu.ph", firstName: "SITE", lastName: "Administrator", status: "active", profileCompleted: true, createdAt: days(90) },
  ];
  return Object.fromEntries(list.map((u) => [u.uid, u]));
}

let users;
try {
  users = JSON.parse(localStorage.getItem(KEY)) || seed();
} catch {
  users = seed();
}
const save = () => localStorage.setItem(KEY, JSON.stringify(users));

/* firebase/firestore */
export const collection = (db, name) => ({ name });
export const doc = (db, col, id) => ({ col, id });
export async function getDocs({ name }) {
  const list = name === "users" ? Object.values(users) : [];
  return { docs: list.map((u) => ({ id: u.uid, data: () => u })) };
}
export async function setDoc(ref, data, opts) {
  if (ref.col !== "users") return;
  users[ref.id] = opts?.merge ? { ...users[ref.id], ...data } : { ...data };
  save();
}
export async function updateDoc(ref, patch) {
  if (ref.col !== "users" || !users[ref.id]) return;
  Object.assign(users[ref.id], patch);
  save();
}
export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data, opts) => ops.push(() => setDoc(ref, data, opts)),
    update: (ref, patch) => ops.push(() => updateDoc(ref, patch)),
    delete: (ref) => ops.push(() => ref.col === "users" && delete users[ref.id]),
    commit: async () => {
      for (const op of ops) await op();
      save();
    },
  };
}

/* firebase/auth */
let n = 0;
export const getAuth = () => ({});
export async function createUserWithEmailAndPassword(auth, email) {
  if (Object.values(users).some((u) => u.email === email)) throw Object.assign(new Error("exists"), { code: "auth/email-already-in-use" });
  return { user: { uid: `new${Date.now().toString(36)}${n++}`, email } };
}
export const sendPasswordResetEmail = async () => {};
export const signOut = async () => {};

/* firebase/app */
export const getApps = () => [];
export const getApp = () => ({});
export const initializeApp = () => ({});

// TEMP-DEVTEST: deleting an account's sign-in. Accounts named "fresh..." still have the starting password.
export async function signInWithEmailAndPassword(auth, email) {
  if (!/^fresh/.test(email)) { const e = new Error("wrong password"); e.code = "auth/invalid-credential"; throw e; }
  return { user: { email } };
}
export const deleteUser = async () => {};
