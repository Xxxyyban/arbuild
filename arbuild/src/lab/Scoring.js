import { WIRE_IDS } from "./Wires";

// Pure scoring. The ledger is { "assemble:cpu": 66, "disassemble:cpu": 66, ... }.
// Mode-prefixed keys mean each phase earns separately, and flipping modes can't farm points.
// Each phase is also timed: finishing within the target time keeps every point,
// taking longer lowers that phase's points (see timeFactor).

export const POINTS = {
  // installing
  motherboard: 100,
  cpu: 75,
  storage: 40,
  ram1: 50,
  ram2: 50,
  psu: 60,
  gpu: 80,
  cpu_cooler: 40,
  paste: 40, // the most for the right amount in the right place (lab/Paste.js)
  bootBase: 60,
  bootDualRam: 20,
  bootGpu: 40,
  skipPaste: 15,
  explosion: 30,
  // safety steps (disassemble)
  shutdown: 10,
  unplug: 10,
  discharge: 10,
  // cables and screws
  cable_atx24: 15,
  cable_eps8: 15,
  cable_pcie: 10,
  cable_pcie6: 10, // a card with a 6-pin socket as well: the 6-pin PCIe cable
  psu_atx24: 10, // a cable's PSU end: plugged into a modular PSU, or routed out of a fixed one
  psu_eps8: 10,
  psu_pcie: 10,
  psu_pcie6: 10,
  power_cord: 10, // the mains cord in at both ends, ready to power on
  screws: 20,
  psu_screws: 10, // the PSU's 4 screws, on the back of the case
  gpu_screws: 8, // the graphics card's 2 bracket screws, on the back of the case
  m2screw: 5, // the SSD's own screw
  m2cover: 10, // the M.2 cover back on and screwed down
  socket: 10, // the CPU locked in: the socket lever down (over the shut cover frame, on AM5)
  // the case's and fans' wires on the board's headers (lab/Wires.js): right header, right way round
  wire_pwr_sw: 6,
  wire_rst_sw: 4,
  wire_pled: 5,
  wire_hdd_led: 5,
  wire_hd_audio: 6,
  wire_usb3: 6,
  wire_cpu_fan: 10,
  wire_case_fans: 6,
  wire_argb: 6,
  // shared multipliers
  perfectBonus: 0.1,
  missPenalty: 0.15,
  minShare: 0.5,
};

// Removing is worth slightly less than installing the same part.
export const REMOVE_POINTS = {
  gpu: 60,
  cpu_cooler: 40,
  cpu: 60,
  ram1: 40,
  ram2: 40,
  storage: 30,
  motherboard: 80,
  psu: 50,
  paste: 20,
  shutdown: 10,
  unplug: 10,
  discharge: 10,
  cable_atx24: 10,
  cable_eps8: 10,
  cable_pcie: 10,
  cable_pcie6: 10,
  psu_atx24: 5,
  psu_eps8: 5,
  psu_pcie: 5,
  psu_pcie6: 5,
  screws: 15,
  psu_screws: 8,
  gpu_screws: 6,
  m2screw: 5, // the SSD's screw out
  m2cover: 5, // the M.2 cover off
  socket: 5, // the CPU socket opened with the CPU in it
  wire_pwr_sw: 3,
  wire_rst_sw: 3,
  wire_pled: 3,
  wire_hdd_led: 3,
  wire_hd_audio: 4,
  wire_usb3: 4,
  wire_cpu_fan: 5,
  wire_case_fans: 4,
  wire_argb: 4,
};

export const basePoints = (mode, name) =>
  (mode === "disassemble" ? REMOVE_POINTS[name] : POINTS[name]) ?? 0;

/** Same formula for installing and removing: +10% if perfect, -15% per miss, never below 50%. */
export function actionPoints(base, misses) {
  if (misses === 0) return Math.round(base * (1 + POINTS.perfectBonus));
  return Math.round(base * Math.max(POINTS.minShare, 1 - misses * POINTS.missPenalty));
}

/** The paste's points: what its quality (0-1, lab/Paste.js) earns, less for each time it was wiped and redone. */
export function pastePoints(quality, misses) {
  return Math.round(POINTS.paste * quality * Math.max(POINTS.minShare, 1 - misses * POINTS.missPenalty));
}

export const ledgerKey = (mode, name) => `${mode}:${name}`;

export const sumLedger = (ledger) => Object.values(ledger).reduce((s, n) => s + n, 0);

/** Score split by phase: { assemble, disassemble }. */
export function scoreByMode(ledger) {
  const out = { assemble: 0, disassemble: 0 };
  for (const [k, v] of Object.entries(ledger)) {
    const mode = k.split(":")[0];
    if (mode in out) out[mode] += v;
  }
  return out;
}

/* ---------- time ---------- */

export const TIME = {
  floor: 0.5, // slowest share of the points a phase can keep
  slowAfter: 2, // the floor is reached this many target-times after the target (so at 3× the target)
};

/**
 * Share of a phase's points kept after `elapsedMs`.
 * 1 up to the target time, then a straight line down to TIME.floor at 3× the target.
 */
export function timeFactor(elapsedMs, parMs) {
  if (!Number.isFinite(parMs) || parMs <= 0 || !(elapsedMs > parMs)) return 1;
  const over = (elapsedMs - parMs) / (parMs * TIME.slowAfter);
  return Math.max(TIME.floor, 1 - over * (1 - TIME.floor));
}

/**
 * The score card: each phase's points times its time factor, minus penalties (never below 0).
 * phaseMs = { assemble, disassemble } time spent in each phase.
 */
export function timedScore(ledger, penalty, phaseMs, parMs) {
  const by = scoreByMode(ledger);
  const factor = {
    assemble: timeFactor(phaseMs.assemble, parMs),
    disassemble: timeFactor(phaseMs.disassemble, parMs),
  };
  const assemble = Math.round(by.assemble * factor.assemble);
  const disassemble = Math.round(by.disassemble * factor.disassemble);
  return {
    total: Math.max(0, assemble + disassemble - penalty),
    assemble,
    disassemble,
    raw: by,
    factor,
    penalty,
  };
}

/* ---------- revert penalty ---------- */

export const REVERT = {
  flawedShare: 0.5, // fraction of the part's base points when the reverted action was a mistake
  cleanShare: 0.15, // fraction when it was a clean action
  floor: 5,
  escalate: 0.25, // +25% for each extra revert of the same part
};

// Instructor setting: "off" | "light" | "strict"
export const REVERT_LEVEL_MULT = { off: 0, light: 1, strict: 2 };

/**
 * Points to subtract when a student undoes a recent action in the opposite mode.
 * Returns 0 when the instructor turned reverts off.
 */
export function revertPenalty({ base, flawed, count, level = "light" }) {
  const mult = REVERT_LEVEL_MULT[level] ?? 1;
  if (mult === 0) return 0;
  const share = (flawed ? REVERT.flawedShare : REVERT.cleanShare) * mult;
  const raw = base * share * (1 + (count - 1) * REVERT.escalate);
  return Math.max(REVERT.floor, Math.round(raw));
}

/* ---------- the official score (class work) ---------- */

// Class work gets one official score, out of the task's points (the instructor sets them, up to
// 100): what the student earned on the task (after the time factor and penalties) against what a
// perfect, on-time run of that task earns. Only what the task asks for counts. This is the score
// the instructor reads.
export const OFFICIAL_MAX = 100;

const perfect = (base) => actionPoints(base, 0);

/**
 * What a task asks for, for grading. task: the instructor's task (lab/Tasks); socketed: the cables
 * that plug into the student's PSU (lab/Rules psuSocketed). A teardown takes apart a full PC, so it
 * always has a GPU and 2 sticks. psuEnds: the cables whose PSU end is a step: every one when building
 * (plugged into a socket, or a fixed one routed out of the bundle), only the socketed ones when
 * taking apart (fixed cables stay on the PSU).
 */
export function taskRequirements(task, socketed = []) {
  const build = task.mode !== "disassemble";
  const gpu = build ? task.requireGpu !== false : true;
  const dualRam = build ? Number(task.ramSticks) !== 1 : true;
  const slots = ["motherboard", "cpu", "ram1", ...(dualRam ? ["ram2"] : []), "cpu_cooler", "storage", "psu", ...(gpu ? ["gpu"] : [])];
  return { slots, gpu, dualRam, psuEnds: build ? ["atx24", "eps8", "pcie", "pcie6"] : socketed, boot: build ? task.mustBoot !== false : false };
}

/** The most boot points a task counts (booting with parts the task doesn't ask for earns no more). */
const bootMax = ({ gpu, dualRam }) => POINTS.bootBase + (dualRam ? POINTS.bootDualRam : 0) + (gpu ? POINTS.bootGpu : 0);

/**
 * The points that count for a task: work the task didn't ask for (a GPU it doesn't need, a second
 * stick, booting when it needn't) is left out, so extras can't make up for what's missing.
 */
export function taskLedger(ledger, req) {
  const out = {};
  for (const [k, v] of Object.entries(ledger)) {
    const name = k.slice(k.indexOf(":") + 1);
    if (!req.gpu && (name === "gpu" || name === "gpu_screws" || name === "cable_pcie" || name === "psu_pcie")) continue;
    if (!(req.gpu && req.gpu6) && (name === "cable_pcie6" || name === "psu_pcie6")) continue;
    if (!req.dualRam && name === "ram2") continue;
    if (!req.boot && name === "power_cord") continue; // only a task that has to start needs it plugged in
    if (k === "assemble:boot") {
      if (!req.boot) continue;
      out[k] = Math.min(v, bootMax(req));
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** The most points a perfect run of a task can earn (what full marks means). req: taskRequirements(). */
// gpu6: the picked card has a 6-pin socket as well, so the 6-pin PCIe cable counts too (the lab adds it to req)
export function maxPoints(mode, { slots, gpu, dualRam, gpu6 = false, psuEnds = [], boot = true }) {
  const T = mode === "disassemble" ? REMOVE_POINTS : POINTS;
  let max = slots.reduce((s, slot) => s + perfect(T[slot] ?? 0), 0);
  // cables: the board's two, the graphics card's one; their PSU ends (see taskRequirements); the screws
  const cables = ["atx24", "eps8", ...(gpu ? ["pcie"] : []), ...(gpu && gpu6 ? ["pcie6"] : [])];
  max += cables.reduce((s, c) => s + perfect(T[`cable_${c}`] ?? 0), 0);
  max += cables.filter((c) => psuEnds.includes(c)).reduce((s, c) => s + perfect(T[`psu_${c}`] ?? 0), 0);
  max += perfect(T.screws ?? 0);
  // the PSU's screws (every build has a PSU), and the card's bracket screws
  if (slots.includes("psu")) max += perfect(T.psu_screws ?? 0);
  if (gpu) max += perfect(T.gpu_screws ?? 0);
  // the M.2 slot: the SSD's screw and its cover (every build has an SSD)
  if (slots.includes("storage")) max += perfect(T.m2screw ?? 0) + perfect(T.m2cover ?? 0);
  // the CPU socket: locking the CPU in, or opening the socket to take it out
  if (slots.includes("cpu")) max += perfect(T.socket ?? 0);
  // the case's and fans' wires on the board (every build has a board, a cooler and a case)
  if (slots.includes("motherboard")) max += WIRE_IDS.reduce((s, id) => s + perfect(T[`wire_${id}`] ?? 0), 0);
  if (mode === "disassemble") {
    max += perfect(POINTS.shutdown) + perfect(POINTS.unplug) + perfect(POINTS.discharge) + perfect(REMOVE_POINTS.paste);
  } else {
    max += POINTS.paste + (boot ? bootMax({ gpu, dualRam }) + perfect(POINTS.power_cord) : 0);
  }
  return max;
}

/** The score card -> the official score (a whole number from 0 to outOf, the task's points). */
export function officialScore(card, mode, max, outOf = OFFICIAL_MAX) {
  if (!(max > 0)) return 0;
  const earned = (mode === "disassemble" ? card.disassemble : card.assemble) - card.penalty;
  return Math.max(0, Math.min(outOf, Math.round((earned / max) * outOf)));
}

/** Points -> how much of the official score they are worth ("+2.5", "+12"). */
export function officialDelta(points, max, outOf = OFFICIAL_MAX) {
  if (!(max > 0)) return "0";
  const v = (points / max) * outOf;
  return v < 10 ? v.toFixed(1).replace(/\.0$/, "") : String(Math.round(v));
}

/**
 * How a saved score reads: "43/50" (out of the task's points, never more than them), or "412 pts"
 * for a lab saved before scores were official.
 */
export function scoreText(row, outOf = OFFICIAL_MAX) {
  if (!row?.scoreScale) return `${row?.score ?? 0} pts`;
  return `${Math.min(row.score ?? 0, outOf)}/${outOf}`;
}

/** A saved official score, capped at the task's points (0 for an older, unofficial one). */
export const cappedScore = (row, outOf = OFFICIAL_MAX) => (row?.scoreScale ? Math.min(row.score ?? 0, outOf) : 0);
