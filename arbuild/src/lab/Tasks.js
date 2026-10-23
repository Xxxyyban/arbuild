// Tasks: what the instructor tells a student to do in a class.
//
//   sessions/{code}.tasks          [{ id, title, instructions, mode, platform, partPicking, partInfo, hints, parMin,
//                                     points, requireGpu, ramSticks, mustBoot }]
//   sessions/{code}.defaultTaskId  the task a student gets unless the instructor picks another one
//   students/{uid}.assignedTask    a task id, or null for the default
//
// A student's lab setup is the class rules (session.setup) plus their task.
// Pure functions only: no React, no Firebase.
import { normalizePlatform, PLATFORM_LABEL } from "./Catalog";
import { normalizeSetup } from "./Setup";

export const MODE_LABEL = { assemble: "Assemble", disassemble: "Disassemble" };

export const TASK_DEFAULTS = {
  title: "",
  instructions: "",
  mode: "assemble", // "assemble" (empty bench) | "disassemble" (running PC)
  platform: "am4", // "am4" | "am5"
  partPicking: "student", // "student" picks every part | "auto" lays the right parts out
  partInfo: true, // part info panel and the specs on the picker cards
  hints: true, // hint toasts, "Fix:" lines and AR target markers
  parMin: 10, // target minutes; slower lowers the points
  // grading: what the task is worth, and (building) what a complete answer needs
  points: 100, // the task's score is out of this (1 to 100)
  requireGpu: true, // the build needs a graphics card
  ramSticks: 2, // RAM sticks the build needs (1 or 2)
  mustBoot: true, // the build has to boot
};

export const MAX_TASK_POINTS = 100;

export const newTaskId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** "Build an AM5 PC" / "Take apart an AM4 PC" */
export const defaultTitle = (mode, platform) =>
  `${mode === "disassemble" ? "Take apart" : "Build"} an ${PLATFORM_LABEL[normalizePlatform(platform) || "am4"]} PC`;

/** Fills in missing fields and keeps values in range, so older or hand-edited tasks keep working. */
export function normalizeTask(t = {}) {
  const out = { ...TASK_DEFAULTS, ...t };
  out.mode = out.mode === "disassemble" ? "disassemble" : "assemble";
  out.platform = normalizePlatform(out.platform) || "am4";
  out.partPicking = out.partPicking === "auto" ? "auto" : "student";
  const par = Math.floor(Number(out.parMin));
  out.parMin = Number.isFinite(par) && par >= 1 ? Math.min(par, 600) : TASK_DEFAULTS.parMin;
  const pts = Math.floor(Number(out.points));
  out.points = Number.isFinite(pts) && pts >= 1 ? Math.min(pts, MAX_TASK_POINTS) : TASK_DEFAULTS.points;
  out.requireGpu = out.requireGpu !== false;
  out.ramSticks = Number(out.ramSticks) === 1 ? 1 : 2;
  out.mustBoot = out.mustBoot !== false;
  out.title = String(out.title || "").trim() || defaultTitle(out.mode, out.platform);
  out.instructions = String(out.instructions || "");
  out.id = out.id || newTaskId();
  return out;
}

/**
 * The class's tasks and default task id. A class saved before tasks existed gets one task
 * built from its old settings (startMode, platform, hints...).
 */
export function sessionTasks(session) {
  const raw = Array.isArray(session?.tasks) ? session.tasks : [];
  if (raw.length > 0) {
    const tasks = raw.map(normalizeTask);
    const defaultTaskId = tasks.some((t) => t.id === session.defaultTaskId) ? session.defaultTaskId : tasks[0].id;
    return { tasks, defaultTaskId };
  }
  const s = normalizeSetup(session?.setup);
  const legacy = normalizeTask({
    id: "t1", mode: s.startMode, platform: s.platform, partPicking: s.partPicking,
    partInfo: s.partInfo, hints: s.hints, parMin: s.parMin,
  });
  return { tasks: [legacy], defaultTaskId: legacy.id };
}

/** The task one student is working on. */
export function taskFor(session, row) {
  const { tasks, defaultTaskId } = sessionTasks(session);
  return tasks.find((t) => t.id === row?.assignedTask) || tasks.find((t) => t.id === defaultTaskId) || tasks[0];
}

/** The lab setup for a task: class rules + the task's mode, platform and part rules. */
export function setupForTask(classSetup, task) {
  const t = normalizeTask(task);
  return normalizeSetup({
    ...classSetup,
    startMode: t.mode,
    startState: t.mode === "disassemble" ? "full" : "empty",
    platform: t.platform,
    partPicking: t.partPicking,
    partInfo: t.partInfo,
    hints: t.hints,
    parMin: t.parMin,
    task: t,
  });
}

/** One line for lists: "Assemble · AM5 · 50 pts · no GPU needed · students pick parts · 10 min" */
export function taskSummary(task) {
  const t = normalizeTask(task);
  const build = t.mode === "assemble";
  return [
    MODE_LABEL[t.mode],
    PLATFORM_LABEL[t.platform],
    `${t.points} pts`,
    build && !t.requireGpu ? "no GPU needed" : null,
    build && t.ramSticks === 1 ? "1 RAM stick" : null,
    build && !t.mustBoot ? "needn't boot" : null,
    t.mode === "assemble" ? (t.partPicking === "student" ? "students pick parts" : "parts auto-picked") : null,
    t.partInfo ? null : "part info hidden",
    t.hints ? null : "answers hidden",
    `${t.parMin} min target`,
  ]
    .filter(Boolean)
    .join(" · ");
}
