// Pure rules: what may be installed / removed right now, and what happens on boot.
// No React, no Three.js. `installed` is { cpu: true, gpu: true, ... }.
import { PART_LABEL } from "./Constants";
import { itemFor, requiredWatts } from "./Catalog";

// Assemble: part -> parts that must already be installed.
// (cpu and storage sit on the board while it is still on the bench, so they have no requirement.)
// cooler needs cpu: fixes the "cooler placed before CPU" bug in the old Assemble.jsx.
export const INSTALL_NEEDS = {
  motherboard: [],
  cpu: [],
  storage: [],
  ram1: ["motherboard"],
  ram2: ["motherboard"],
  psu: ["motherboard"],
  gpu: ["motherboard"],
  cpu_cooler: ["motherboard", "cpu"],
};

// Disassemble: part -> parts that must already be removed (from the old Disassemble.jsx).
export const REMOVE_NEEDS = {
  gpu: [],
  cpu_cooler: [],
  ram1: [],
  ram2: [],
  storage: [],
  cpu: ["cpu_cooler"],
  motherboard: ["gpu", "cpu_cooler", "cpu", "ram1", "ram2", "storage"],
  psu: ["motherboard"],
};

export const INSTALL_MSG = {
  cpu_cooler: "Install the CPU first, and mount the motherboard, before the cooler.",
  default: "Mount the motherboard in the case first.",
};

// These go onto the board while it lies on the bench, so a board has to be picked first.
const ON_BOARD = ["cpu", "storage"];
const NO_BOARD_MSG = "Pick a motherboard first. This part goes onto the board.";

export const REMOVE_MSG = {
  cpu: "Remove the CPU cooler first, it sits right on top of the CPU.",
  motherboard: "Clear the board first: GPU, cooler, CPU, RAM and drive must all be out.",
  psu: "Take the motherboard out first, the PSU cables run to it.",
};

/** Returns null if the part can be installed, else { key, msg }. `picks` = what is on the bench. */
export function installBlock(name, installed, picks = null) {
  if (picks && ON_BOARD.includes(name) && !picks.motherboard) return { key: name, msg: NO_BOARD_MSG };
  const missing = INSTALL_NEEDS[name].filter((r) => !installed[r]);
  if (missing.length === 0) return null;
  return { key: name, msg: INSTALL_MSG[name] || INSTALL_MSG.default };
}

/** Returns null if the part can be removed, else { key, msg }. Needs the safety steps first. */
export function removeBlock(name, installed, power) {
  if (!power.unplugged) {
    return !power.shutdown
      ? { key: "shutdown", msg: "Shut the PC down, then unplug it, before touching any part." }
      : { key: "unplug", msg: "Unplug the PC from power before touching any part." };
  }
  // "removed" = not installed
  const missing = REMOVE_NEEDS[name].filter((r) => installed[r]);
  if (missing.length > 0) {
    return { key: name, msg: REMOVE_MSG[name] || `Remove the ${PART_LABEL[missing[0]]} first.` };
  }
  return null;
}

/**
 * Decides what the monitor shows when the student presses POWER ON.
 * state = { installed, pasteApplied, ramSlot: { ram1, ram2 }, picks }
 * `hints` false hides the "fix" text so students must troubleshoot on their own.
 */
export function evaluateBoot(state, { hints = true } = {}) {
  const { installed, pasteApplied, ramSlot, picks = null } = state;
  const ramCount = (installed.ram1 ? 1 : 0) + (installed.ram2 ? 1 : 0);
  const lowRes = !installed.gpu;
  const fix = (text) => (hints ? text : "");

  if (!installed.motherboard) return { status: "dead", message: "Nothing happens, there is no motherboard in the case." };
  if (!installed.psu) return { status: "dead", message: "Nothing happens, there's no power supply installed." };
  if (!installed.cpu) {
    return { status: "post", lowRes, title: "CPU not detected", detail: "The board has power but can't start without a processor.", code: "Error: CPU-00" };
  }
  if (ramCount === 0) {
    return { status: "post", lowRes, title: "No memory detected", detail: fix("Install at least one RAM stick."), code: "Error: MEM-01 (long continuous beeps)" };
  }
  if (!installed.storage) {
    return { status: "post", lowRes, title: "No bootable device", detail: fix("No drive found. Install an SSD or HDD, then restart."), code: "Error: BOOT-02" };
  }
  const cpu = picks ? itemFor("cpu", picks) : null;
  if (!installed.gpu && cpu && cpu.igpu === false) {
    return { status: "dead", part: "gpu", message: hints ? `The PC runs but the screen stays black. The ${cpu.short} has no built-in graphics, so it needs a GPU.` : "The PC runs but the screen stays black." };
  }
  if (!installed.cpu_cooler) {
    return { status: "overheat", lowRes, ramCount, detail: "The CPU cooler is missing, so the CPU overheated.", fix: fix("Fix: install a CPU cooler (with thermal paste) before powering on.") };
  }
  if (!pasteApplied) {
    return { status: "overheat", lowRes, ramCount, detail: "The cooler has no thermal paste, so heat could not leave the CPU.", fix: fix("Fix: power off, apply thermal paste on the CPU, then mount the cooler.") };
  }
  const psu = picks ? itemFor("psu", picks) : null;
  const need = picks ? requiredWatts(picks, installed) : 0;
  if (psu && psu.watts < need) {
    return {
      status: "post", lowRes, title: "Power shut off under load",
      detail: fix(`The ${psu.short} PSU is too weak for these parts. They need about ${need} W.`),
      code: "Error: PSU-OCP",
    };
  }

  const notes = [];
  if (ramCount === 1) notes.push("Single RAM stick, two would run faster.");
  if (ramCount === 2 && Math.abs(ramSlot.ram1 - ramSlot.ram2) === 1) {
    notes.push("RAM sticks are in neighbouring slots, try slots 1+3 or 2+4 for dual channel.");
  }
  if (!installed.gpu) notes.push("Integrated graphics, add a GPU for a sharper picture.");
  return { status: "hello", lowRes, ramCount, note: hints ? notes[0] ?? null : null };
}

/** True if the PC is fully built (every part in). */
export const isFullyBuilt = (installed) => Object.keys(INSTALL_NEEDS).every((p) => installed[p]);
/** True if every part is out. */
export const isFullyStripped = (installed) => Object.keys(INSTALL_NEEDS).every((p) => !installed[p]);