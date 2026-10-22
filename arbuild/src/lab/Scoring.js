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
  paste: 20,
  bootBase: 60,
  bootDualRam: 20,
  bootGpu: 40,
  skipPaste: 15,
  explosion: 30,
  // safety steps (disassemble)
  shutdown: 10,
  unplug: 10,
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
};

export const basePoints = (mode, name) =>
  (mode === "disassemble" ? REMOVE_POINTS[name] : POINTS[name]) ?? 0;

/** Same formula for installing and removing: +10% if perfect, -15% per miss, never below 50%. */
export function actionPoints(base, misses) {
  if (misses === 0) return Math.round(base * (1 + POINTS.perfectBonus));
  return Math.round(base * Math.max(POINTS.minShare, 1 - misses * POINTS.missPenalty));
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
