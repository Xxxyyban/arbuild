// A class's schedule: the days it meets, its start and end time, and its room.
//   schedule = { days: ["mon", "wed", "fri"], start: "09:00", end: "10:30", room: "Lab 2" }
// Pure functions only: no React, no Firebase.

export const DAYS = [
  { id: "mon", short: "Mon", letter: "M" },
  { id: "tue", short: "Tue", letter: "T" },
  { id: "wed", short: "Wed", letter: "W" },
  { id: "thu", short: "Thu", letter: "Th" },
  { id: "fri", short: "Fri", letter: "F" },
  { id: "sat", short: "Sat", letter: "Sa" },
  { id: "sun", short: "Sun", letter: "Su" },
];
const JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // Date.getDay() order

// Colours a class card can have (the instructor picks one).
export const CLASS_COLORS = ["#059669", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#475569"];

export const EMPTY_SCHEDULE = { days: [], start: "", end: "", room: "" };

/** Fills in and cleans a schedule (also turns an old free-text "subject" into nothing). */
export function normalizeSchedule(s) {
  const days = Array.isArray(s?.days) ? DAYS.map((d) => d.id).filter((id) => s.days.includes(id)) : [];
  const time = (t) => (typeof t === "string" && /^\d{2}:\d{2}$/.test(t) ? t : "");
  return { days, start: time(s?.start), end: time(s?.end), room: String(s?.room || "").trim().slice(0, 30) };
}

/** "13:30" -> { h: 1, m: "30", pm: true } */
function parts(t) {
  const [h, m] = t.split(":").map(Number);
  return { h: h % 12 || 12, m: String(m).padStart(2, "0"), pm: h >= 12 };
}

/** "13:30" -> "1:30 PM" */
export function formatTime(t) {
  if (!t) return "";
  const p = parts(t);
  return `${p.h}:${p.m} ${p.pm ? "PM" : "AM"}`;
}

/** "09:00", "10:30" -> "9:00–10:30 AM"; "11:00", "13:00" -> "11:00 AM–1:00 PM" */
export function formatRange(start, end) {
  if (!start) return "";
  if (!end) return formatTime(start);
  const a = parts(start);
  const b = parts(end);
  return a.pm === b.pm ? `${a.h}:${a.m}–${b.h}:${b.m} ${b.pm ? "PM" : "AM"}` : `${formatTime(start)}–${formatTime(end)}`;
}

/** ["mon", "wed", "fri"] -> "MWF"; one or two days read better in full: "Mon & Thu" */
export function formatDays(days = []) {
  const list = DAYS.filter((d) => days.includes(d.id));
  if (list.length === 0) return "";
  if (list.length <= 2) return list.map((d) => d.short).join(" & ");
  if (list.length === 7) return "Every day";
  return list.map((d) => d.letter).join("");
}

/** The whole schedule on one line: "MWF · 9:00–10:30 AM · Lab 2" */
export function formatSchedule(s) {
  const n = normalizeSchedule(s);
  return [formatDays(n.days), formatRange(n.start, n.end), n.room].filter(Boolean).join(" · ");
}

/** One line under a class's name: section, then the schedule (or the old free-text subject). */
export const classLine = (cls) => [cls?.section, formatSchedule(cls?.schedule) || cls?.subject].filter(Boolean).join(" · ");

const minutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * When the class next meets: { label, now } where now is true while it's in session.
 * "In class now", "Today, 9:00 AM", "Tomorrow, 9:00 AM", "Wed, 9:00 AM"; null without a schedule.
 */
export function nextMeeting(s, at = new Date()) {
  const n = normalizeSchedule(s);
  if (!n.days.length || !n.start) return null;
  const nowMin = at.getHours() * 60 + at.getMinutes();
  const start = minutes(n.start);
  const end = n.end ? minutes(n.end) : start + 60;
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = JS_DAY[(at.getDay() + ahead) % 7];
    if (!n.days.includes(day)) continue;
    if (ahead === 0 && nowMin >= end) continue; // today's meeting is over
    if (ahead === 0 && nowMin >= start) return { label: "In class now", now: true };
    const when = ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : DAYS.find((d) => d.id === day).short;
    return { label: `${when}, ${formatTime(n.start)}`, now: false };
  }
  return null;
}

/** Initials for a class card's cover: "IT Elective 01" -> "IE" */
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "C";
