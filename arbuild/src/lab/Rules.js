// Pure rules: what may be installed / removed right now, and what happens on boot.
// No React, no Three.js. `installed` is { cpu: true, gpu: true, ... }.
import { PART_LABEL } from "./Constants";
import { itemFor, requiredWatts, buildSlots } from "./Catalog";

// How technicians build a PC:
//   1. On the bench, with the board on its box: CPU, then RAM, then the M.2 SSD (easy to reach here),
//      then thermal paste and the CPU cooler.
//   2. Mount the finished board in the case and drive in its 9 screws.
//   3. Install the PSU, then plug the 24-pin and the 8-pin CPU cable into the board.
//   4. Graphics card last (it covers the M.2 slot), then plug in its PCIe power cable.
//   5. Power on.
// A teardown has no fixed order: after power off, unplug and drain, parts can come out in any order
// as long as nothing is physically in the way (REMOVE_NEEDS). The board may come out with its
// CPU, cooler, RAM and SSD still on it, the way technicians usually do it.

// Assemble: part -> parts that must already be installed.
export const INSTALL_NEEDS = {
  cpu: [],
  ram1: [],
  ram2: [],
  storage: [],
  cpu_cooler: ["cpu"],
  motherboard: ["cpu"],
  psu: ["motherboard"],
  gpu: ["motherboard", "psu"],
};

export const INSTALL_MSG = {
  cpu_cooler: "The cooler sits on the CPU. Install the CPU first.",
  motherboard: "Put the CPU in the socket while the board is still on the bench. It's much harder (and riskier for the pins) once the board is in the case.",
  psu: "Mount the motherboard in the case first, then the PSU.",
  gpu: "The graphics card goes in last: mount the motherboard and install the PSU first, so its power cable can reach it.",
};

// Disassemble: part -> parts that physically block it. Only real obstacles, no fixed order.
export const REMOVE_NEEDS = {
  gpu: [],
  motherboard: ["gpu"], // the card is screwed to the case through the board's slot
  psu: [],
  cpu_cooler: [],
  cpu: ["cpu_cooler"], // the cooler sits on top of the CPU
  ram1: [],
  ram2: [],
  storage: ["gpu"], // the card covers the M.2 slot
};

export const REMOVE_MSG = {
  motherboard: "Take the graphics card out first. It's screwed to the case and plugged into the board.",
  cpu: "Remove the CPU cooler first, it sits right on top of the CPU.",
  storage: "The graphics card covers the M.2 slot. Take the graphics card out first.",
};

// These go onto the board, so a board has to be on the bench (picked) first.
const ON_BOARD = ["cpu", "ram1", "ram2", "storage"];
const NO_BOARD_MSG = "Pick a motherboard first. This part goes onto the board.";

/** Returns null if the part can be installed, else { key, msg }. `picks` = what is on the bench. */
export function installBlock(name, installed, picks = null, psuCables = null) {
  if (picks && ON_BOARD.includes(name) && !picks.motherboard) return { key: name, msg: NO_BOARD_MSG };
  // a PSU's cables are sorted on the bench: a modular one's sockets, or a fixed one's tangled
  // bundle, are hard to reach once it is in the case
  if (name === "psu" && picks && psuCables) {
    const loose = psuCablesNeeded(picks).filter((c) => !psuEndDone(c, picks, psuCables));
    if (loose.length > 0) {
      const list = loose.map((c) => CABLES[c].label).join(", ");
      const fixed = loose.filter((c) => psuCableFixed(c, picks)).length;
      return {
        key: "psu",
        msg:
          fixed === 0
            ? `Plug the cables into the PSU first, while it's on the bench: ${list}. Its sockets are hard to reach once it's in the case.`
            : fixed === loose.length
            ? `Route the PSU's fixed cables out of their bundle first, while it's on the bench: ${list}. They're hard to sort out once it's in the case.`
            : `Get the PSU's cables ready first, while it's on the bench: ${list}. Route the fixed ones out of the bundle and plug the others into their sockets.`,
      };
    }
  }
  if (name === "storage" && installed.gpu) {
    return { key: name, msg: "The graphics card covers the M.2 slot. Fit the SSD before the graphics card." };
  }
  const missing = INSTALL_NEEDS[name].filter((r) => !installed[r]);
  if (missing.length === 0) return null;
  return { key: name, msg: INSTALL_MSG[name] || `Install the ${PART_LABEL[missing[0]]} first.` };
}

/* ---------- cables and screws ---------- */

// PSU cables: what each one plugs into. links = { cables: { atx24, eps8, pcie }, screws: [9 × bool] }
// A cable has two ends: `cables` says the part end is in, `psuCables` the PSU end. On a modular PSU
// the PSU end is plugged into a labelled socket (psuSocket); on a PSU with fixed cables it is already
// attached, and the PSU-end step is routing the cable out of its bundle on the bench.
export const CABLES = {
  atx24: { label: "24-pin cable", needs: ["motherboard", "psu"], psuSocket: "mb" },
  eps8: { label: "8-pin CPU cable", needs: ["motherboard", "psu"], psuSocket: "cpu" },
  pcie: { label: "PCIe power cable", needs: ["gpu", "psu"], psuSocket: "pcie" },
};

/** Does the picked PSU take any cables in sockets (modular or semi-modular)? */
export const psuModular = (picks) => !!itemFor("psu", picks)?.modular;

/** Is this cable fixed to the picked PSU (a non-modular PSU's, or a semi-modular one's fixed cables)? */
export function psuCableFixed(cable, picks) {
  const psu = itemFor("psu", picks);
  return !!psu && (!psu.modular || (psu.fixedCables || []).includes(cable));
}

/** The cables that plug into the picked PSU's sockets (and so come off it when taking apart). */
export const psuSocketed = (picks) => Object.keys(CABLES).filter((c) => !psuCableFixed(c, picks));

/** Is this cable's PSU end done: plugged into a modular PSU, or routed out of a fixed PSU's bundle? */
export const psuEndDone = (cable, picks, psuCables) => !!psuCables?.[cable];

/** The cables this build needs on its PSU: the board's two, and the PCIe one if there's a graphics card. */
export const psuCablesNeeded = (picks) => Object.keys(CABLES).filter((c) => c !== "pcie" || !!picks?.gpu);

/** Can this cable's PSU end be plugged in now? null, or { key, msg }. */
export function psuPlugBlock(cable, picks) {
  if (!picks?.psu) return { key: `psu_${cable}`, msg: "Pick a PSU first." };
  if (cable === "pcie" && !picks.gpu) return { key: "psu_pcie", msg: "This build has no graphics card, so it needs no PCIe power cable." };
  return null;
}
export const SCREW_COUNT = 9;

/** Can this cable's part end be plugged in now? null, or { key, msg }. */
export function plugBlock(cable, installed, picks = null, psuCables = null) {
  const missing = CABLES[cable].needs.filter((p) => !installed[p]);
  if (missing.length > 0) {
    const what = cable === "pcie" ? "the graphics card" : "the motherboard";
    return { key: `cable_${cable}`, msg: `Install ${what} and the PSU first. The ${CABLES[cable].label} runs between them.` };
  }
  if (picks && psuCables && !psuEndDone(cable, picks, psuCables)) {
    return { key: `cable_${cable}`, msg: `Plug the ${CABLES[cable].label} into the PSU first.` };
  }
  return null;
}

/** Which cables a build needs plugged in right now. */
export const neededCables = (installed) => Object.keys(CABLES).filter((c) => CABLES[c].needs.every((p) => installed[p]));

/** The safety steps every hands-on step needs first (null when safe). */
export function safetyBlock(power) {
  if (!power.unplugged) {
    return !power.shutdown
      ? { key: "shutdown", msg: "Shut the PC down, then unplug it, before touching any part." }
      : { key: "unplug", msg: "Unplug the PC from power before touching any part." };
  }
  if (!power.discharged) {
    return { key: "discharge", msg: "Press and hold the power button for a few seconds to drain the power left in the PC." };
  }
  return null;
}

/** Returns null if the part can be removed, else { key, msg }. Needs the safety steps first. */
export function removeBlock(name, installed, power, links = null) {
  const safety = safetyBlock(power);
  if (safety) return safety;
  if (links) {
    const { cables = {}, screws = [] } = links;
    if (name === "gpu" && cables.pcie) {
      return { key: name, msg: "Unplug the PCIe power cable from the graphics card first." };
    }
    if (name === "motherboard" && (cables.atx24 || cables.eps8)) {
      return { key: name, msg: "Unplug the 24-pin and the 8-pin CPU cables from the board first." };
    }
    const left = screws.filter(Boolean).length;
    if (name === "motherboard" && left > 0) {
      return { key: name, msg: `Unscrew the motherboard first: ${left} of ${SCREW_COUNT} screws are still in.` };
    }
    if (name === "psu" && Object.values(cables).some(Boolean)) {
      return { key: name, msg: "Unplug the PSU's cables (24-pin, 8-pin CPU, PCIe) before taking it out." };
    }
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
  const { installed, pasteApplied, ramSlot, picks = null, cables = null } = state;
  const ramCount = (installed.ram1 ? 1 : 0) + (installed.ram2 ? 1 : 0);
  const lowRes = !installed.gpu;
  const fix = (text) => (hints ? text : "");

  if (!installed.motherboard) return { status: "dead", message: "Nothing happens, there is no motherboard in the case." };
  if (!installed.psu) return { status: "dead", message: "Nothing happens, there's no power supply installed." };
  if (cables && !cables.atx24) {
    return {
      status: "dead", part: "cable_atx24",
      message: hints ? "Nothing happens. The 24-pin cable isn't plugged into the motherboard, so the board gets no power." : "Nothing happens.",
    };
  }
  if (!installed.cpu) {
    return { status: "post", lowRes, title: "CPU not detected", detail: "The board has power but can't start without a processor.", code: "Error: CPU-00" };
  }
  if (cables && !cables.eps8) {
    return {
      status: "post", lowRes, title: "Fans spin, but nothing starts",
      detail: fix("The CPU has no power. Plug the 8-pin CPU cable into the header at the top-left of the board."),
      code: "Error: CPU power missing",
    };
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
  if (cables && installed.gpu && !cables.pcie) {
    return {
      status: "post", lowRes: true, title: "No signal from the graphics card",
      detail: fix("The graphics card has no power. Plug the PCIe power cable into the top edge of the card."),
      code: "GPU power missing",
    };
  }
  const cooler = picks ? itemFor("cpu_cooler", picks) : null;
  if (cooler && cpu && cooler.cooling < cpu.tdp) {
    return {
      status: "overheat", lowRes, ramCount,
      detail: `The ${cooler.short} cooler can only move ${cooler.cooling} W of heat, but the ${cpu.short} puts out ${cpu.tdp} W.`,
      fix: fix("Fix: power off and fit a cooler rated for this CPU's heat output."),
    };
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
  if (ramCount === 1) notes.push("One RAM stick works, but it runs in single channel. A matching second stick in slot 3 makes memory about twice as fast.");
  if (ramCount === 2 && Math.abs(ramSlot.ram1 - ramSlot.ram2) === 1) {
    notes.push("RAM sticks are in neighbouring slots, try slots 1+3 or 2+4 for dual channel.");
  }
  if (!installed.gpu) notes.push("Integrated graphics, add a GPU for a sharper picture.");
  return { status: "hello", lowRes, ramCount, note: hints ? notes[0] ?? null : null };
}

/** True if the PC is fully built (every part in). */
export const isFullyBuilt = (installed, picks) => buildSlots(picks).every((p) => installed[p]);

/**
 * Checklist for the lab's guide card: [{ label, done, anyOrder }].
 * Building follows the expert order. Taking apart starts with the safety steps (in order),
 * then every part can come out in any order (anyOrder: true).
 * state = { installed, picks, pasteApplied, booted, power }
 */
export function expertSteps(mode, { installed, picks, pasteApplied, booted, power, cables = {}, screws = [], psuCables = {} }) {
  const driven = screws.filter(Boolean).length;
  const has = (slot) => !!picks?.[slot];
  const modular = psuModular(picks);
  const psuEndsIn = psuCablesNeeded(picks).every((c) => psuEndDone(c, picks, psuCables));
  // the cables in the PSU's sockets (the fixed ones stay on it)
  const socketed = psuCablesNeeded(picks).filter((c) => !psuCableFixed(c, picks));
  const anyFixed = psuCablesNeeded(picks).some((c) => psuCableFixed(c, picks));
  if (mode === "disassemble") {
    const out = (slot) => !installed[slot];
    const any = (label, done) => ({ label, done, anyOrder: true });
    return [
      { label: "Shut the PC down", done: power.shutdown },
      { label: "Unplug the power cable", done: power.unplugged },
      { label: "Hold the power button to drain leftover power", done: power.discharged },
      any("PCIe cable unplugged (before the graphics card comes out)", !cables.pcie),
      any("Graphics card out (it covers the M.2 slot)", out("gpu")),
      any("24-pin and 8-pin CPU cables unplugged (before the board comes out)", !cables.atx24 && !cables.eps8),
      any(`Motherboard screws out (${SCREW_COUNT - driven} of ${SCREW_COUNT})`, out("motherboard") || driven === 0),
      any("PSU out (its cables unplugged from the parts)", out("psu")),
      ...(socketed.length ? [any("Cables off the PSU (once it's out)", socketed.every((c) => !psuCables[c]))] : []),
      any("Motherboard out (graphics card, cables and screws out first)", out("motherboard")),
      any("CPU cooler off", out("cpu_cooler")),
      any("Old thermal paste wiped (before the CPU comes out)", !pasteApplied),
      any("CPU out (the cooler must be off)", out("cpu")),
      any("RAM stick(s) out", out("ram1") && out("ram2")),
      any("M.2 SSD out", out("storage")),
    ];
  }
  const ramDone = installed.ram1 && (!has("ram2") || installed.ram2);
  return [
    { label: "Pick parts that work together", done: buildSlots(picks).every(has) },
    { label: "Seat the CPU in the socket (board on the bench)", done: !!installed.cpu },
    { label: has("ram2") ? "Click both RAM sticks into slots 1 and 3" : "Click the RAM stick into its slot", done: !!ramDone },
    { label: "Screw the M.2 SSD into its slot", done: !!installed.storage },
    { label: "Add a pea-sized dot of thermal paste", done: pasteApplied || !!installed.cpu_cooler },
    { label: "Mount the CPU cooler", done: !!installed.cpu_cooler },
    { label: "Set the motherboard in the case", done: !!installed.motherboard },
    { label: `Drive in the motherboard screws (${driven} of ${SCREW_COUNT})`, done: driven === SCREW_COUNT },
    {
      label: !anyFixed
        ? "Plug the cables into the PSU (still on the bench)"
        : modular
        ? "Route the fixed cables out, plug PCI-E into the PSU (on the bench)"
        : "Route the PSU's fixed cables out (still on the bench)",
      done: psuEndsIn,
    },
    { label: "Install the PSU", done: !!installed.psu },
    { label: "Plug the 24-pin cable into the board", done: !!cables.atx24 },
    { label: "Plug the 8-pin CPU cable in (top-left)", done: !!cables.eps8 },
    ...(has("gpu")
      ? [
          { label: "Install the graphics card last", done: !!installed.gpu },
          { label: "Plug PCIe power into the graphics card", done: !!cables.pcie },
        ]
      : []),
    { label: "Power on and check it boots", done: !!booted },
  ];
}
/** True if every part is out (and the cables in the PSU's sockets are off it: pass only those). */
export const isFullyStripped = (installed, psuCables = {}) =>
  Object.keys(INSTALL_NEEDS).every((p) => !installed[p]) && !Object.values(psuCables).some(Boolean);