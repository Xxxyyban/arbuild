// Visits: how often students and instructors open ARBuild, by the hour, for the admin's graph
// (pages/Admin.jsx, Dashboard). AuthContext counts a visit once a signed-in account's profile loads:
//
//   visits/{day}        day = days since 1 January 1970, UTC ("20407"). Fields h0 to h23: the visits in
//                       each UTC hour of that day. One small document a day, so the graph reads at most
//                       a month of them.
//   visitLast/{uid}     when the account's last visit counted. At most one visit every 10 minutes
//                       counts (firestore.rules), so nobody can inflate the graph or use up the day's writes.
//
// Only the admin reads them. Admins' own visits aren't counted.
import { collection, doc, documentId, getDocs, increment, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";

export const DAY_MS = 86400000;
const GAP_MS = 10 * 60 * 1000; // the rules' 10 minutes between counted visits

const seenKey = (uid) => `arbuild:visit:${uid}`;

/** Counts this visit, unless this browser already counted one for this account in the last 10 minutes. */
export async function recordVisit(user) {
  const now = Date.now();
  try {
    if (now - Number(localStorage.getItem(seenKey(user.uid)) || 0) < GAP_MS) return;
  } catch {
    // storage blocked: the rules still stop a second count within 10 minutes
  }
  const batch = writeBatch(db);
  batch.set(doc(db, "visits", String(Math.floor(now / DAY_MS))), { [`h${new Date(now).getUTCHours()}`]: increment(1) }, { merge: true });
  batch.set(doc(db, "visitLast", user.uid), { at: serverTimestamp() });
  await batch.commit();
  try {
    localStorage.setItem(seenKey(user.uid), String(now));
  } catch {
    // storage blocked
  }
}

/** The visits of the last `days` days (and one more, for time zones ahead of UTC): [{ at: Date, count }], one per UTC hour. */
export async function loadVisits(days) {
  const first = Math.floor(Date.now() / DAY_MS) - days;
  const snap = await getDocs(query(collection(db, "visits"), where(documentId(), ">=", String(first))));
  return snap.docs.flatMap((d) => hoursOf(Number(d.id), d.data()));
}

/** A visits document's hours as [{ at, count }]. */
export function hoursOf(day, data) {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    const count = Number(data?.[`h${h}`]) || 0;
    if (count > 0) out.push({ at: new Date(day * DAY_MS + h * 3600000), count });
  }
  return out;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Visits on each of the last `days` days, by this computer's calendar, oldest first: [{ date, count }]. */
export function byDay(entries, days, now = new Date()) {
  const today = startOfDay(now);
  const list = Array.from({ length: days }, (_, i) => ({ date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i)), count: 0 }));
  const index = new Map(list.map((d, i) => [d.date.getTime(), i]));
  for (const e of entries) {
    const i = index.get(startOfDay(e.at).getTime());
    if (i !== undefined) list[i].count += e.count;
  }
  return list;
}

/** Visits in each hour of the day (0 to 23, this computer's time), over the last `days` days. */
export function byHour(entries, days, now = new Date()) {
  const from = startOfDay(now).getTime() - (days - 1) * DAY_MS;
  const hours = Array(24).fill(0);
  for (const e of entries) if (e.at.getTime() >= from) hours[e.at.getHours()] += e.count;
  return hours;
}
