// A class's schedule: the days it meets, each day's start and end time, and its room.
//   schedule = { days: ["mon", "sat"], times: { mon: { start: "09:00", end: "11:00" }, sat: { start: "12:00", end: "15:00" } },
//                start: "09:00", end: "11:00", room: "Lab 2" }
// Each day keeps its own time (times). start and end are the first day's, and all an older schedule
// has: it met at that time on every one of its days.
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

/** The day id of a date: "mon"... */
export const dayId = (at = new Date()) => JS_DAY[at.getDay()];

// Colours a class card can have (the instructor picks one).
export const CLASS_COLORS = ["#059669", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2", "#475569"];

export const EMPTY_SCHEDULE = { days: [], times: {}, start: "", end: "", room: "" };

const NO_TIME = { start: "", end: "" };

/** Fills in and cleans a schedule (also turns an old free-text "subject" into nothing). */
export function normalizeSchedule(s) {
  const days = Array.isArray(s?.days) ? DAYS.map((d) => d.id).filter((id) => s.days.includes(id)) : [];
  const time = (t) => (typeof t === "string" && /^\d{2}:\d{2}$/.test(t) ? t : "");
  // an older schedule has one time for all its days
  const usual = { start: time(s?.start), end: time(s?.end) };
  const times = {};
  for (const d of days) {
    const own = s?.times?.[d];
    times[d] = own && typeof own === "object" ? { start: time(own.start), end: time(own.end) } : { ...usual };
  }
  const first = days.length ? times[days[0]] : usual;
  return { days, times, start: first.start, end: first.end, room: String(s?.room || "").trim().slice(0, 30) };
}

/** The time a class meets on one of its days: { start, end } (empty strings when not set). */
export const dayTime = (s, day) => normalizeSchedule(s).times[day] ?? NO_TIME;

/** The days that share a time, in week order: [{ days: ["mon", "wed", "fri"], start, end }] */
export function timeGroups(s) {
  const n = normalizeSchedule(s);
  const groups = [];
  for (const d of n.days) {
    const t = n.times[d];
    const same = groups.find((g) => g.start === t.start && g.end === t.end);
    if (same) same.days.push(d);
    else groups.push({ days: [d], ...t });
  }
  return groups;
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

/**
 * When the class meets: "MWF · 9:00–10:30 AM" when every day has the same time, else each time
 * with its days: "Mon 9:00–11:00 AM · Sat 12:00–3:00 PM".
 */
export function formatWhen(s) {
  const groups = timeGroups(s);
  if (groups.length <= 1) {
    const g = groups[0];
    return g ? [formatDays(g.days), formatRange(g.start, g.end)].filter(Boolean).join(" · ") : "";
  }
  return groups.map((g) => [formatDays(g.days), formatRange(g.start, g.end)].filter(Boolean).join(" ")).join(" · ");
}

/** The whole schedule on one line: "MWF · 9:00–10:30 AM · Lab 2" */
export function formatSchedule(s) {
  return [formatWhen(s), normalizeSchedule(s).room].filter(Boolean).join(" · ");
}

/** One line under a class's name: section, then the schedule (or the old free-text subject). */
export const classLine = (cls) => [cls?.section, formatSchedule(cls?.schedule) || cls?.subject].filter(Boolean).join(" · ");

const minutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * When the class next meets: { label, now } where now is true while it's in session.
 * "In class now", "Today, 9:00 AM", "Tomorrow, 12:00 PM", "Sat, 12:00 PM"; null without a schedule.
 */
export function nextMeeting(s, at = new Date()) {
  const n = normalizeSchedule(s);
  const nowMin = at.getHours() * 60 + at.getMinutes();
  for (let ahead = 0; ahead < 8; ahead++) {
    const day = JS_DAY[(at.getDay() + ahead) % 7];
    const t = n.times[day];
    if (!t?.start) continue; // doesn't meet that day, or no time set for it
    const start = minutes(t.start);
    const end = t.end ? minutes(t.end) : start + 60;
    if (ahead === 0 && nowMin >= end) continue; // today's meeting is over
    if (ahead === 0 && nowMin >= start) return { label: "In class now", now: true };
    const when = ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : DAYS.find((d) => d.id === day).short;
    return { label: `${when}, ${formatTime(t.start)}`, now: false };
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
