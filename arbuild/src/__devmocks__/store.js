// TEMP-DEVTEST: one in-memory store shared by every tab through localStorage.
const KEY = "devClassStore9";
const t = (ms) => ({ toMillis: () => ms, _ms: ms });
export const now = () => t(Date.now());

function revive(o) {
  if (o && typeof o === "object") {
    if ("_ms" in o && Object.keys(o).length === 1) return t(o._ms);
    for (const k of Object.keys(o)) o[k] = revive(o[k]);
  }
  return o;
}

function seed() {
  const d = Date.now();
  return {
    classes: {
      c1: { name: "IT Elective 01", section: "BSIT 4", schedule: { days: ["mon","wed","fri"], start: "09:00", end: "10:30", room: "Computer Lab 2" }, color: "#2563eb", code: "K7QX2M", instructorUid: "inst1", instructorName: "Prof. Rosa Santos", joinOpen: true, archived: false, studentCount: 3, createdAt: t(d - 864e5 * 5), lastPostAt: t(d - 36e5) },
      c2: { name: "Computer Systems Servicing NC II", section: "BSIT 2B", schedule: { days: ["tue","thu","fri"], start: "13:00", end: "16:00", room: "Lab 1" }, color: "#db2777", code: "R4MW9P", instructorUid: "inst1", instructorName: "Prof. Rosa Santos", joinOpen: true, archived: false, studentCount: 0, createdAt: t(d - 864e5 * 2), lastPostAt: null },
    },
    codes: { K7QX2M: "c1", R4MW9P: "c2" },
    members: {
      c1: {
        stu1: { uid: "stu1", name: "Juan Dela Cruz", email: "jdelacruz@cdd.edu.ph", studentId: "2023-0142", section: "BSIT 3A", joinedAt: t(d - 864e5 * 4), seenStreamAt: t(d - 864e5) },
        stu2: { uid: "stu2", name: "Maria Reyes", email: "mreyes@cdd.edu.ph", studentId: "2023-0177", section: "BSIT 3A", joinedAt: t(d - 864e5 * 3), seenStreamAt: t(d) },
        stu3: { uid: "stu3", name: "Ana Bautista", email: "abautista@cdd.edu.ph", studentId: "2023-0190", section: "BSIT 3A", joinedAt: t(d - 864e5), seenStreamAt: t(d - 864e5) },
      },
      c2: {},
    },
    posts: {
      c1: {
        p1: { kind: "announcement", title: "Welcome to the lab!", body: "This week we build our first PC.", links: [], files: [], pinned: true, authorUid: "inst1", authorName: "Prof. Rosa Santos", commentCount: 1, lastCommentAt: t(d - 108e5), lastCommentByUid: "stu1", lastCommentByName: "Juan Dela Cruz", lastCommentId: "k1", createdAt: t(d - 864e5 * 2) },
        p0: { kind: "lab", title: "Identify the parts", body: "Name each part as you place it.", links: [], files: [], sessionCode: "LABOLD", pinned: false, authorUid: "inst1", authorName: "Prof. Rosa Santos", commentCount: 0, createdAt: t(d - 864e5 * 3) },
        p2: { kind: "material", title: "PC parts handout", body: "Read before Friday.", links: [], files: [], pinned: false, authorUid: "inst1", authorName: "Prof. Rosa Santos", commentCount: 0, createdAt: t(d - 864e5 * 1.5) },
        p3: { kind: "lab", title: "Build an AM4 PC", body: "Pick compatible parts and get it to boot.", links: [], files: [], sessionCode: "LABAM4", pinned: false, authorUid: "inst1", authorName: "Prof. Rosa Santos", commentCount: 0, createdAt: t(d - 18e5) },
        p4: { kind: "lab", title: "Take apart an AM5 PC", body: "Safety first.", links: [], files: [], sessionCode: "LABAM5", pinned: false, authorUid: "inst1", authorName: "Prof. Rosa Santos", commentCount: 0, createdAt: t(d - 6e5) },
      },
      c2: {},
    },
    removed: { c1: {}, c2: {} },
    log: { c1: {}, c2: {} },
    comments: { "c1/p1": { k1: { text: "Do we bring our own anti-static strap?", authorUid: "stu1", authorName: "Juan Dela Cruz", fromInstructor: false, createdAt: t(d - 108e5) } } },
    threads: { c1: {}, c2: {} },
    messages: {},
    memberships: {
      stu1: { c1: { classId: "c1", name: "IT Elective 01", section: "BSIT 4", code: "K7QX2M", instructorName: "Prof. Rosa Santos", joinedAt: t(d - 864e5 * 4) } },
      stu3: { c1: { classId: "c1", name: "IT Elective 01", section: "BSIT 4", code: "K7QX2M", instructorName: "Prof. Rosa Santos", joinedAt: t(d - 864e5) } },
      stu2: { c1: { classId: "c1", name: "IT Elective 01", section: "BSIT 4", code: "K7QX2M", instructorName: "Prof. Rosa Santos", joinedAt: t(d - 864e5 * 3) } },
    },
    labs: {
      LABAM4: { code: "LABAM4", title: "Build an AM4 PC", classId: "c1", className: "IT Elective 01", instructorUid: "inst1", status: "running", dueAt: t(d - 36e5), startedAt: t(d - 12e5), tasks: [{ id: "t1", mode: "assemble", platform: "am4", parMin: 15, hints: false, partPicking: "student" }], createdAt: t(d - 18e5) },
      LABAM5: { code: "LABAM5", title: "Take apart an AM5 PC", classId: "c1", className: "IT Elective 01", instructorUid: "inst1", status: "waiting", dueAt: t(d + 864e5 * 3 + 6e6), tasks: [{ id: "t1", mode: "disassemble", platform: "am5", parMin: 10 }], createdAt: t(d - 6e5) },
      LABOLD: { code: "LABOLD", title: "Identify the parts", classId: "c1", className: "IT Elective 01", instructorUid: "inst1", status: "closed", startedAt: t(d - 864e5 * 3 + 36e5), closedAt: t(d - 864e5 * 2), dueAt: t(d - 864e5 * 2 - 36e5), tasks: [{ id: "t1", mode: "assemble", platform: "am4", parMin: 10 }], createdAt: t(d - 864e5 * 3) },
      UPB8X6: { code: "UPB8X6", title: "BSIT 4", classId: null, instructorUid: "inst1", status: "closed", tasks: [], createdAt: t(d - 864e5 * 2) },
    },
    labRows: {
      LABOLD: { stu1: { name: "Juan Dela Cruz", studentId: "2023-0142", section: "BSIT 3A", mode: "assemble", score: 20, scoreScale: 100, taskDone: false, partsLeft: 4, mistakes: 3, lastActive: new Date(d - 864e5 * 2.2).toISOString() } },
      LABAM4: {
        stu1: { name: "Juan Dela Cruz", studentId: "2023-0142", section: "BSIT 3A", mode: "assemble", score: 88, scoreScale: 100, points: 412, taskDone: true, taskMs: 754000, assembleMs: 754000, partsLeft: 0, mistakes: 2, lastActive: new Date(d - 2e5).toISOString() },
        stu3: { name: "Ana Bautista", studentId: "2023-0190", section: "BSIT 3A", mode: "assemble", score: 35, scoreScale: 100, taskDone: false, assembleMs: 600000, partsLeft: 5, mistakes: 1, lastActive: new Date(d - 3e5).toISOString() },
        stu2: { name: "Maria Reyes", studentId: "2023-0177", section: "BSIT 3A", mode: "assemble", score: 41, scoreScale: 100, points: 188, taskDone: false, assembleMs: 905000, partsLeft: 3, mistakes: 5, lastActive: new Date(d - 6e4).toISOString() },
      },
    },
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) return revive(raw);
  } catch {
    /* fresh */
  }
  return seed();
}

export let store = load();
const listeners = new Set();
export function save() {
  localStorage.setItem(KEY, JSON.stringify(store));
  listeners.forEach((fn) => fn());
}
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    store = load();
    listeners.forEach((fn) => fn());
  }
});
export function sub(fn) {
  fn();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
