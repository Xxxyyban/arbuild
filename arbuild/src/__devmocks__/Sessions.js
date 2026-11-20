// TEMP-DEVTEST: lab sessions on the shared in-memory store (see Classes.js mock). The live monitor's
// buttons (start, close, tasks, rules) change the store, so the showcase works without Firebase.
export * from "/src/lab/Sessions.js?real";
import { normalizeTask } from "/src/lab/Tasks.js";
import { store, sub, save, now } from "./store.js";

const list = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
const lab = (code) => store.labs[code];

export const subscribeSession = (code, cb) => sub(() => cb(store.labs[code] ? { ...store.labs[code] } : null));
export const subscribeStudents = (code, cb) => sub(() => cb(list(store.labRows[code])));
export const subscribeStudentRow = (code, uid, cb) => sub(() => cb(store.labRows[code]?.[uid] || null));
export const listMySessions = async (uid) => list(store.labs).filter((s) => s.instructorUid === uid);

// a few things students did, so the reports and "common mistakes" have something to show
function events(code) {
  const t = Date.now();
  const live = store.events?.[code] || [];
  return code !== "LABAM4"
    ? live
    : [
        ...live,
        { id: "e1", uid: "stu1", type: "safety", part: "esd", detail: "Touched parts without the wrist strap", ts: t - 9e5 },
        { id: "e2", uid: "stu1", type: "compat", part: "ram", detail: "DDR5 stick in an AM4 board", ts: t - 8e5 },
        { id: "e3", uid: "stu2", type: "compat", part: "ram", detail: "DDR5 stick in an AM4 board", ts: t - 7e5 },
        { id: "e4", uid: "stu2", type: "blocked", part: "gpu", detail: "Graphics card before the motherboard", ts: t - 6e5 },
        { id: "e5", uid: "stu2", type: "miss", part: "cpu", detail: "CPU turned the wrong way", ts: t - 5e5 },
        { id: "e6", uid: "stu1", type: "task", part: "task", detail: "Task done", ts: t - 2e5 },
      ];
}
const sorted = (code) => events(code).sort((a, b) => (b.ts || 0) - (a.ts || 0));
export const subscribeAllEvents = (code, cb) => sub(() => cb(sorted(code)));
export const subscribeEvents = (code, uid, cb) => sub(() => cb(sorted(code).filter((e) => e.uid === uid)));

export async function startSession(code) {
  Object.assign(lab(code), { status: "running", startedAt: now(), expiresAt: null });
  save();
}
export async function reopenSession(code) {
  Object.assign(lab(code), { status: "running", expiresAt: null });
  save();
}
export async function closeSession(code) {
  Object.assign(lab(code), { status: "closed", closedAt: now() });
  save();
}
export async function updateSetup(code, patch) {
  lab(code).setup = { ...(lab(code).setup || {}), ...patch };
  save();
}
export async function saveTasks(code, tasks, defaultTaskId) {
  const clean = tasks.map(normalizeTask);
  Object.assign(lab(code), { tasks: clean, defaultTaskId: clean.some((t) => t.id === defaultTaskId) ? defaultTaskId : clean[0]?.id ?? null });
  save();
}
export async function assignTask(code, uids, taskId) {
  uids.forEach((uid) => {
    const row = store.labRows[code]?.[uid];
    if (row) Object.assign(row, { assignedTask: taskId || null, assignedAt: Date.now() });
  });
  save();
}

export async function createSession({ title, classId, className, task, dueAt = null }) {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  store.labs[code] = { code, title, classId, className, instructorUid: "inst1", status: "waiting", tasks: [{ id: "t1", ...task }], createdAt: now(), dueAt: dueAt ? { toMillis: () => dueAt.getTime(), _ms: dueAt.getTime() } : null };
  save();
  return code;
}

export async function setLabDue(code, dueAt) {
  lab(code).dueAt = dueAt ? { toMillis: () => dueAt.getTime(), _ms: dueAt.getTime() } : null;
  save();
}

export const subscribeFinished = (code, cb) => sub(() => cb(list(store.labRows[code]).filter((r) => r.taskDone)));
