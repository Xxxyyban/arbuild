// TEMP-DEVTEST: the profile cards (lab/People.js) on the shared in-memory store.
export { fullName, instructorCard, studentCard, makeThumb, ensureThumb } from "/src/lab/People.js?real";
import { store, sub, save } from "./store.js";

export async function syncInstructorCard(card) {
  store.instructors = store.instructors || {};
  const now = store.instructors[card.uid];
  if (now && Object.keys(card).every((k) => now[k] === card[k])) return;
  store.instructors[card.uid] = { ...card };
  save();
}

export const subscribeInstructorCard = (uid, cb) => sub(() => cb(store.instructors?.[uid] || null));

export async function syncStudentCard(classId, uid, card) {
  const m = store.members?.[classId]?.[uid];
  if (!m || Object.keys(card).every((k) => (m[k] ?? "") === card[k])) return;
  Object.assign(m, card);
  save();
}
