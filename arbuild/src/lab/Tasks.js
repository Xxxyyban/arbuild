// Tasks: what the instructor tells a student to do in a class.
//
//   sessions/{code}.tasks          [{ id, title, instructions, mode, platform, partPicking, partInfo, hints, help,
//                                     parMin, points, requireGpu, ramSticks, mustBoot, scenario, faultPoints, bootPoints }]
//   sessions/{code}.defaultTaskId  the task a student gets unless the instructor picks another one
//   students/{uid}.assignedTask    a task id, or null for the default
//
// A student's lab setup is the class rules (session.setup) plus their task.
// Pure functions only: no React, no Firebase.
import { normalizePlatform, PLATFORM_LABEL } from "./Catalog";
import { DEFAULT_SETUP, HELP_DEFAULTS, normalizeHelp, normalizeSetup } from "./Setup";
import { BOOT_POINTS, MAX_FAULT_POINTS, faultPointsFor, normalizeScenario, scenarioFaults, workingScenario } from "./Faults";

export const MODES = ["assemble", "disassemble", "troubleshoot"];
export const MODE_LABEL = { assemble: "Assemble", disassemble: "Disassemble", troubleshoot: "Troubleshoot" };

export const TASK_DEFAULTS = {
  title: "",
  instructions: "",
  // "assemble" (empty bench) | "disassemble" (running PC) | "troubleshoot" (the instructor's faulty PC)
  mode: "assemble",
  platform: "am4", // "am4" | "am5"
  partPicking: "student", // "student" picks every part | "auto" lays the right parts out
  partInfo: true, // part info panel and the specs on the picker cards
  hints: true, // hint toasts, "Fix:" lines and AR target markers
  // the rest of the lab's help: the step list, the labels on the board, the RAM slot numbers, the faults left
  help: { ...HELP_DEFAULTS },
  parMin: 10, // target minutes; slower lowers the points
  // grading: what the task is worth, and (building, fixing) what a complete PC needs
  points: 100, // the task's score is out of this (1 to 100); a troubleshooting task's is its faults' points
  requireGpu: true, // the build needs a graphics card
  ramSticks: 2, // RAM sticks the build needs (1 or 2)
  mustBoot: true, // the build has to boot
  // troubleshooting: the PC the student gets (lab/Faults.js), each of its faults' points, and the
  // points for it starting at the end with nothing wrong
  scenario: null,
  faultPoints: {},
  bootPoints: BOOT_POINTS,
};

export const MAX_TASK_POINTS = 100;

export const newTaskId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** "Build an AM5 PC" / "Take apart an AM4 PC" / "Fix an AM4 PC" */
export function defaultTitle(mode, platform) {
  const p = PLATFORM_LABEL[normalizePlatform(platform) || "am4"];
  return mode === "troubleshoot" ? `Fix an ${p} PC` : `${mode === "disassemble" ? "Take apart" : "Build"} an ${p} PC`;
}

/** A troubleshooting task's points before the cap: its faults' and the start's. */
export const troubleTotal = (t) => Object.values(t.faultPoints || {}).reduce((s, n) => s + n, 0) + (t.bootPoints || 0);

/** Fills in missing fields and keeps values in range, so older or hand-edited tasks keep working. */
export function normalizeTask(t = {}) {
  const out = { ...TASK_DEFAULTS, ...t };
  out.mode = MODES.includes(out.mode) ? out.mode : "assemble";
  out.platform = normalizePlatform(out.platform) || "am4";
  out.partPicking = out.partPicking === "auto" ? "auto" : "student";
  const par = Math.floor(Number(out.parMin));
  out.parMin = Number.isFinite(par) && par >= 1 ? Math.min(par, 600) : TASK_DEFAULTS.parMin;
  const pts = Math.floor(Number(out.points));
  out.points = Number.isFinite(pts) && pts >= 1 ? Math.min(pts, MAX_TASK_POINTS) : TASK_DEFAULTS.points;
  out.requireGpu = out.requireGpu !== false;
  out.ramSticks = Number(out.ramSticks) === 1 ? 1 : 2;
  out.mustBoot = out.mustBoot !== false;
  out.hints = out.hints !== false;
  out.partInfo = out.partInfo !== false;
  out.help = normalizeHelp(t.help, out.hints);
  if (out.mode === "troubleshoot") {
    // the student picks the replacement parts; the PC's faults are worked out from its set-up
    out.partPicking = "student";
    out.scenario = normalizeScenario(out.scenario ?? workingScenario(out.platform), out.platform);
    const faults = scenarioFaults(out.scenario, out);
    out.faultPoints = faultPointsFor(faults, out.faultPoints);
    const boot = Math.floor(Number(out.bootPoints));
    // a PC with nothing wrong is still worth something: making sure it starts
    out.bootPoints = Math.min(MAX_FAULT_POINTS, Math.max(faults.length ? 0 : 1, Number.isFinite(boot) ? boot : BOOT_POINTS));
    out.points = Math.min(MAX_TASK_POINTS, Math.max(1, troubleTotal(out)));
  } else {
    out.scenario = null;
    out.faultPoints = {};
    out.bootPoints = BOOT_POINTS;
  }
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

/**
 * A student doesn't see their own progress (score, faults fixed) until they finish: a
 * troubleshooting task with "faults left" off, where it would give the fixes away.
 */
export const progressHidden = (task, row) => task.mode === "troubleshoot" && !task.help.faultsLeft && !row?.taskDone;

/** The lab setup for a task: class rules + the task's mode, platform, part rules and help. */
export function setupForTask(classSetup, task) {
  const t = normalizeTask(task);
  const trouble = t.mode === "troubleshoot";
  return normalizeSetup({
    ...classSetup,
    startMode: t.mode === "disassemble" ? "disassemble" : "assemble",
    startState: trouble ? "scenario" : t.mode === "disassemble" ? "full" : "empty",
    scenario: trouble ? t.scenario : null,
    platform: t.platform,
    partPicking: t.partPicking,
    partInfo: t.partInfo,
    hints: t.hints,
    help: t.help,
    parMin: t.parMin,
    // fixing a PC means taking parts out and putting them back as often as it takes
    ...(trouble ? { modeControl: "student", toggle: "free", revertPenalty: "off" } : {}),
    task: t,
  });
}

/** One line for lists: "Assemble · AM5 · 50 pts · no GPU needed · students pick parts · 10 min" */
export function taskSummary(task) {
  const t = normalizeTask(task);
  const build = t.mode === "assemble";
  const trouble = t.mode === "troubleshoot";
  const faults = Object.keys(t.faultPoints).length;
  return [
    MODE_LABEL[t.mode],
    PLATFORM_LABEL[t.platform],
    `${t.points} pts`,
    trouble ? (faults ? `${faults} fault${faults === 1 ? "" : "s"} to fix` : "nothing wrong with it") : null,
    (build || trouble) && !t.requireGpu ? "no GPU needed" : null,
    (build || trouble) && t.ramSticks === 1 ? "1 RAM stick" : null,
    build && !t.mustBoot ? "needn't boot" : null,
    build ? (t.partPicking === "student" ? "students pick parts" : "parts auto-picked") : null,
    t.partInfo ? null : "part info hidden",
    t.hints ? null : "answers hidden",
    t.help.steps ? null : "steps hidden",
    t.help.labels ? null : "board labels hidden",
    t.help.ramNumbers ? null : "RAM numbers hidden",
    trouble && !t.help.faultsLeft ? "faults left hidden" : null,
    `${t.parMin} min target`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ---------- the instructor's preview: /lab?preview=... ---------- */

/** A task packed into a link, to try it in the lab as a student gets it. */
export function encodeTask(task) {
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeTask(task)));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The lab setup for a preview link (nothing is saved), or null if the link is broken. */
export function previewSetup(search) {
  const code = new URLSearchParams(search).get("preview");
  if (!code) return null;
  try {
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    const task = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return { ...setupForTask(DEFAULT_SETUP, { ...task, id: "preview" }), preview: true };
  } catch {
    return null;
  }
}
