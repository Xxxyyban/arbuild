// Pure rules: what may be installed / removed right now, and what happens on boot.
// No React, no Three.js. `installed` is { cpu: true, gpu: true, ... }.
import { PART_LABEL, PSU_SCREWS, GPU_SCREWS } from "./Constants";
import { itemFor, requiredWatts, buildSlots } from "./Catalog";
import { bootWires, wireSteps, anyWire } from "./Wires";

// How technicians build a PC:
//   1. On the bench, with the board on its box: CPU, then RAM, then the M.2 SSD (easy to reach here),
//      then thermal paste and the CPU cooler.
//   2. Mount the finished board in the case and drive in its 9 screws.
//   3. Install the PSU and screw it to the back of the case, then plug the 24-pin and the 8-pin CPU
//      cable into the board.
//   4. The case's wires (front panel, USB, audio) and the fans' wires onto the board's small headers
//      (lab/Wires.js), while the bottom of the board is still easy to reach.
//   5. Graphics card last (it covers the M.2 slot), its bracket screwed to the back of the case, then
//      its PCIe power cables (8-pin, and 6-pin if it has the socket).
//   6. The power cord, last: into the PSU first, then the wall (here, the power strip on the bench).
//   7. Power on.
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
export function installBlock(name, installed, picks = null, psuCables = null, m2 = null, socket = null) {
  if (picks && ON_BOARD.includes(name) && !picks.motherboard) return { key: name, msg: NO_BOARD_MSG };
  if (name === "cpu" && socket && !socketOpen(socket, socketKind(picks))) return socketShutBlock(socket, socketKind(picks));
  if (name === "cpu_cooler" && socket && installed.cpu && !socketLocked(socket)) {
    const frame = socketKind(picks) === "lga" && socket.plate === "open";
    return { key: "socket", msg: `Lock the CPU in first: ${frame ? "close the cover frame, then " : ""}push the socket lever down into its hook.` };
  }
  if (name === "storage" && m2?.cover === "on") {
    return { key: "m2cover", msg: "Take the M.2 cover off first: unscrew its 2 screws, then lift it off the slot." };
  }
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

// PSU cables: what each one plugs into. links = { cables: { atx24, eps8, pcie }, screws: [9 × bool],
// psuScrews: [4 × bool], gpuScrews: [2 × bool] }
// A cable has two ends: `cables` says the part end is in, `psuCables` the PSU end. On a modular PSU
// the PSU end is plugged into a labelled socket (psuSocket); on a PSU with fixed cables it is already
// attached, and the PSU-end step is routing the cable out of its bundle on the bench.
export const CABLES = {
  atx24: { label: "24-pin cable", needs: ["motherboard", "psu"], psuSocket: "mb" },
  eps8: { label: "8-pin CPU cable", needs: ["motherboard", "psu"], psuSocket: "cpu" },
  pcie: { label: "8-pin PCIe power cable", needs: ["gpu", "psu"], psuSocket: "pcie" },
  // a card with a 6-pin power socket as well (8-pin + 6-pin) takes a 6-pin PCIe cable for it; every PSU
  // can supply one from a PCI-E socket
  pcie6: { label: "6-pin PCIe power cable", needs: ["gpu", "psu"], psuSocket: "pcie6" },
};

/** The graphics card's power cables: the 8-pin one, and the 6-pin one when the picked card has a 6-pin socket. */
export const gpuSixPin = (picks) => !!itemFor("gpu", picks)?.powerPort6;
export const isGpuCable = (c) => c === "pcie" || c === "pcie6";

/** Does this build use the cable? The board's two always; the 8-pin PCIe with a card; the 6-pin with a card that has a 6-pin socket. */
export function cableNeeded(c, picks) {
  if (c === "pcie") return !!picks?.gpu;
  if (c === "pcie6") return gpuSixPin(picks);
  return true;
}

/** Does the picked PSU take any cables in sockets (modular or semi-modular)? */
export const psuModular = (picks) => !!itemFor("psu", picks)?.modular;

/** Is this cable fixed to the picked PSU (a non-modular PSU's, or a semi-modular one's fixed cables)? */
export function psuCableFixed(cable, picks) {
  const psu = itemFor("psu", picks);
  return !!psu && (!psu.modular || (psu.fixedCables || []).includes(cable));
}

/** The cables that plug into the picked PSU's sockets (and so come off it when taking apart). */
export const psuSocketed = (picks) => Object.keys(CABLES).filter((c) => !psuCableFixed(c, picks));

// What each of a modular PSU's sockets is wired for (both PCI-E sockets are alike). Its CPU and
// PCI-E sockets take look-alike 8-pin plugs but are wired differently: a mix-up shorts the PSU.
export const PSU_SOCKET_KIND = { mb: "MB", cpu: "CPU", pcie: "PCI-E", pcie6: "PCI-E" };

/**
 * The cables whose PSU end is plugged into another kind of socket than their own (a CPU cable in a
 * PCI-E socket). psuSockOf: the socket each socketed cable went into, when not its own.
 */
export function psuMixUps(picks, psuCables, psuSockOf) {
  return Object.keys(CABLES).filter((c) => {
    const sock = psuSockOf?.[c];
    return !!sock && !!psuCables?.[c] && !psuCableFixed(c, picks) && PSU_SOCKET_KIND[sock] !== PSU_SOCKET_KIND[CABLES[c].psuSocket];
  });
}

/** Is this cable's PSU end done: plugged into a modular PSU, or routed out of a fixed PSU's bundle? */
export const psuEndDone = (cable, picks, psuCables) => !!psuCables?.[cable];

/** The cables this build needs on its PSU: the board's two, and the PCIe one if there's a graphics card. */
export const psuCablesNeeded = (picks) => Object.keys(CABLES).filter((c) => cableNeeded(c, picks));

/** Can this cable's PSU end be plugged in now? null, or { key, msg }. */
// The PCIe cable can go into the PSU even with no graphics card picked: plugged in on the bench, it's
// ready if one is added later (a PSU's sockets are hard to reach once it's in the case).
export function psuPlugBlock(cable, picks) {
  if (!picks?.psu) return { key: `psu_${cable}`, msg: "Pick a PSU first." };
  if (cable === "pcie6" && !gpuSixPin(picks)) {
    return { key: "psu_pcie6", msg: "Only a graphics card with a 6-pin power socket (like the RX 6700 XT) needs the 6-pin PCIe cable." };
  }
  return null;
}
export const SCREW_COUNT = 9;
export const PSU_SCREW_COUNT = PSU_SCREWS.length; // through the back of the case into the PSU
export const GPU_SCREW_COUNT = GPU_SCREWS.length; // through the back of the case into the card's bracket

/** Can this cable's part end be plugged in now? null, or { key, msg }. */
export function plugBlock(cable, installed, picks = null, psuCables = null) {
  const missing = CABLES[cable].needs.filter((p) => !installed[p]);
  if (missing.length > 0) {
    const what = isGpuCable(cable) ? "the graphics card" : "the motherboard";
    return { key: `cable_${cable}`, msg: `Install ${what} and the PSU first. The ${CABLES[cable].label} runs between them.` };
  }
  if (picks && psuCables && !psuEndDone(cable, picks, psuCables)) {
    return { key: `cable_${cable}`, msg: `Plug the ${CABLES[cable].label} into the PSU first.` };
  }
  return null;
}

/** Which cables a build needs plugged in right now. */
export const neededCables = (installed) => Object.keys(CABLES).filter((c) => CABLES[c].needs.every((p) => installed[p]));

/* ---------- the mains power cord ---------- */
// cord = { psu: in the PSU's inlet, wall: in the power strip }. It goes in at the PSU first, the wall last.
export const NO_CORD = { psu: false, wall: false };
export const CORD_IN = { psu: true, wall: true };
export const cordIn = (cord) => !!cord?.psu && !!cord?.wall;

/** Can the power cord be plugged in now? null, or { key, msg }. It goes in last, once every part is in. */
export function cordBlock(installed, picks, psuScrews = []) {
  if (!picks?.psu) return { key: "power_cord", msg: "Pick a PSU first." };
  if (!installed.psu) return { key: "power_cord", msg: "Put the PSU in the case first: the cord goes into the socket on its back." };
  if (psuScrews.some((s) => !s)) return { key: "power_cord", msg: "Screw the PSU to the case first, then plug the cord into it." };
  const left = buildSlots(picks).filter((p) => !installed[p]);
  if (left.length) {
    const more = left.length > 1 ? ` (and ${left.length - 1} more part${left.length > 2 ? "s" : ""})` : "";
    return { key: "power_cord", msg: `Put the ${PART_LABEL[left[0]]} in first${more}: the power cord goes in last.` };
  }
  return null;
}

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
    const { cables = {}, screws = [], psuScrews = [], gpuScrews = [], m2 = null, wires = null } = links;
    if (name === "storage" && m2?.cover === "on") {
      return { key: "m2cover", msg: "Take the M.2 cover off first: unscrew its 2 screws, then lift it off the SSD." };
    }
    if (name === "storage" && m2?.ssdScrew) {
      return { key: "m2screw", msg: "Unscrew the SSD first: the small screw at its end holds it down." };
    }
    if (name === "gpu" && (cables.pcie || cables.pcie6)) {
      return { key: name, msg: cables.pcie && cables.pcie6 ? "Unplug the 8-pin and the 6-pin PCIe cables from the graphics card first." : `Unplug the ${cables.pcie ? "8-pin" : "6-pin"} PCIe cable from the graphics card first.` };
    }
    const cardScrews = gpuScrews.filter(Boolean).length;
    if (name === "gpu" && cardScrews > 0) {
      return { key: name, msg: `Unscrew the card's bracket first: ${cardScrews} of its ${GPU_SCREW_COUNT} screws on the back of the case are still in.` };
    }
    if (name === "motherboard" && (cables.atx24 || cables.eps8)) {
      return { key: name, msg: "Unplug the 24-pin and the 8-pin CPU cables from the board first." };
    }
    if (name === "cpu_cooler" && wires?.cpu_fan) {
      return { key: name, msg: "Unplug the cooler's fan from the board first (its wire is on CPU_FAN)." };
    }
    if (name === "motherboard" && anyWire(wires)) {
      return { key: name, msg: "Unplug the case's wires from the board first: front panel, USB, audio, fans and lights." };
    }
    const left = screws.filter(Boolean).length;
    if (name === "motherboard" && left > 0) {
      return { key: name, msg: `Unscrew the motherboard first: ${left} of ${SCREW_COUNT} screws are still in.` };
    }
    if (name === "psu" && Object.values(cables).some(Boolean)) {
      return { key: name, msg: "Unplug the PSU's cables (24-pin, 8-pin CPU, PCIe) before taking it out." };
    }
    const psuIn = psuScrews.filter(Boolean).length;
    if (name === "psu" && psuIn > 0) {
      return { key: name, msg: `Unscrew the PSU first: ${psuIn} of its ${PSU_SCREW_COUNT} screws on the back of the case are still in.` };
    }
  }
  // "removed" = not installed
  const missing = REMOVE_NEEDS[name].filter((r) => installed[r]);
  if (missing.length > 0) {
    return { key: name, msg: REMOVE_MSG[name] || `Remove the ${PART_LABEL[missing[0]]} first.` };
  }
  const socket = links?.socket;
  if (name === "cpu" && socket && !socketOpen(socket, links.socketKind)) return socketShutBlock(socket, links.socketKind, true);
  return null;
}

/**
 * Decides what the monitor shows when the student presses POWER ON.
 * state = { installed, pasteApplied, pasteThin, ramSlot: { ram1, ram2 }, picks, cables, wires, headers, psuSockOf, cord }
 * (wires: lab/Wires.js, headers: the board's MOUNTS.headers; without wires they aren't checked;
 * psuSockOf: the PSU socket each cable is in, when not its own; cord: the power cord, unchecked without it).
 * `hints` false hides the "fix" text so students must troubleshoot on their own. A running PC's
 * `symptoms` ([{ text, cause }]: a dark power light, dead front USB...) always show, they're what
 * you'd notice; only with hints on does each come with its cause.
 */
export function evaluateBoot(state, { hints = true } = {}) {
  const { installed, pasteApplied, pasteThin = false, ramSlot, picks = null, cables = null, wires = null, headers = null, psuSockOf = null, cord = null } = state;
  const ramCount = (installed.ram1 ? 1 : 0) + (installed.ram2 ? 1 : 0);
  const lowRes = !installed.gpu;
  const fix = (text) => (hints ? text : "");
  // an overheating PC: with hints off the crash screen only says it got too hot (cause: for the log)
  const hot = (cause) => ({ detail: hints ? cause : "The CPU got too hot, and the PC shut itself down to protect it.", cause });

  if (!installed.motherboard) return { status: "dead", message: "Nothing happens, there is no motherboard in the case." };
  if (!installed.psu) return { status: "dead", message: "Nothing happens, there's no power supply installed." };
  if (cord && !cordIn(cord)) {
    return {
      status: "dead", part: "power_cord",
      message: hints
        ? `Nothing happens. The power cord isn't plugged into the ${cord.psu ? "power strip" : "PSU"}, so the PC has no power. Open Cables and plug it in.`
        : "Nothing happens.",
    };
  }
  if (cables && !cables.atx24) {
    return {
      status: "dead", part: "cable_atx24",
      message: hints ? "Nothing happens. The 24-pin cable isn't plugged into the motherboard, so the board gets no power." : "Nothing happens.",
    };
  }
  // the case's power button only starts the PC through its wire on the front-panel PWR pins
  const wired = wires && installed.motherboard ? bootWires(wires, headers) : null;
  if (wired?.off) {
    return {
      status: "dead", part: "wire_pwr_sw",
      message: hints ? `You press the case's power button: nothing happens. ${wired.off}` : "You press the case's power button: nothing happens.",
    };
  }
  // a cable in the wrong kind of socket on a modular PSU, plugged in at both ends (cables are the
  // live ones): the PSU's short-circuit protection trips the moment it starts
  const mixed = cables && picks ? psuMixUps(picks, cables, psuSockOf) : [];
  if (mixed.length > 0) {
    const c = mixed[0];
    return {
      status: "dead", part: `psu_${c}`,
      message: hints
        ? `You press the power button: the PSU clicks and shuts straight off. The ${CABLES[c].label} is in the ${PSU_SOCKET_KIND[psuSockOf[c]]} socket on the PSU. Its CPU and PCI-E sockets look alike but are wired differently.`
        : "You press the power button: the PSU clicks and shuts straight off.",
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
  // no graphics card: the PC still runs, but only a CPU with built-in graphics can draw a picture
  if (!installed.gpu && cpu && cpu.igpu === false) {
    return {
      status: "nosignal", part: "gpu",
      message: hints
        ? `The PC is on, but the screen says "No signal". The ${cpu.short} has no built-in graphics, so with no graphics card nothing draws the picture.`
        : 'The PC is on, but the screen says "No signal".',
    };
  }
  if (!installed.cpu_cooler) {
    return { status: "overheat", lowRes, ramCount, ...hot("The CPU cooler is missing, so the CPU overheated."), fix: fix("Fix: install a CPU cooler (with thermal paste) before powering on.") };
  }
  if (!pasteApplied) {
    return { status: "overheat", lowRes, ramCount, ...hot("The cooler has no thermal paste, so heat could not leave the CPU."), fix: fix("Fix: power off, apply thermal paste on the CPU, then mount the cooler.") };
  }
  if (pasteThin) {
    return { status: "overheat", lowRes, ramCount, ...hot("The thermal paste doesn't cover the chips under the lid, so their heat could not reach the cooler."), fix: fix("Fix: power off, take the cooler off, wipe the paste and apply enough over the middle of the CPU.") };
  }
  // the board checks for the CPU's fan on CPU_FAN, and stops before it starts Windows if there's none
  if (wired?.fanError) {
    return {
      status: "post", lowRes, part: "wire_cpu_fan", title: "CPU Fan Error!",
      detail: fix(`${wired.fanError} With no fan there, it stops to protect the CPU.`),
      code: "Press F1 to Run SETUP",
    };
  }
  if (cables && installed.gpu && !cables.pcie) {
    return {
      status: "post", lowRes: true, title: "No signal from the graphics card",
      detail: fix("The graphics card has no power. Plug the 8-pin PCIe cable into the top edge of the card."),
      code: "GPU power missing",
    };
  }
  // a card with an 8-pin and a 6-pin socket needs both: with the 6-pin empty, it refuses to start
  if (cables && installed.gpu && gpuSixPin(picks) && !cables.pcie6) {
    return {
      status: "post", lowRes: true, title: "No signal from the graphics card",
      detail: fix("The card has an 8-pin and a 6-pin power socket, and the 6-pin is empty. Plug the 6-pin PCIe cable into it."),
      code: "GPU power missing (6-pin)",
    };
  }
  const cooler = picks ? itemFor("cpu_cooler", picks) : null;
  if (cooler && cpu && cooler.cooling < cpu.tdp) {
    return {
      status: "overheat", lowRes, ramCount,
      ...hot(`The ${cooler.short} cooler can only move ${cooler.cooling} W of heat, but the ${cpu.short} puts out ${cpu.tdp} W.`),
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
  if (!installed.gpu) notes.push("Built-in graphics: a low, blocky picture. A graphics card makes it sharp.");
  const symptoms = (wired?.symptoms ?? []).map((s) => ({ id: s.id, text: s.text, cause: hints ? s.cause : null }));
  return { status: "hello", lowRes, ramCount, note: hints ? notes[0] ?? null : null, symptoms };
}

/**
 * How long the PC takes to start, in seconds: the drive, the CPU and the memory set the pace, one
 * stick (or two in neighbouring slots) runs single channel, and built-in graphics is slower to draw
 * the screen than a graphics card. A stronger build starts faster. state as for evaluateBoot.
 */
export function bootTime({ installed, picks, ramSlot }) {
  const parts = ["storage", "cpu", "ram1"].map((slot) => itemFor(slot, picks)?.bootS ?? 3);
  const sticks = (installed.ram1 ? 1 : 0) + (installed.ram2 ? 1 : 0);
  if (sticks < 2 || Math.abs(ramSlot.ram1 - ramSlot.ram2) === 1) parts.push(1); // single channel
  if (!installed.gpu) parts.push(1); // built-in graphics
  return Math.round(parts.reduce((s, x) => s + x, 0) * 10) / 10;
}

/* ---------- the M.2 cover over the SSD slot ---------- */
// m2 = { cover: "on" | "off" (on the board, or on the bench), coverScrews: [bool, bool], ssdScrew }
// Every board's M.2 slot has a cover held by 2 screws; the SSD is held by its own screw under it.
export const M2_COVER_SCREWS = 2;

/** How a board starts: its cover on and screwed down, the SSD (if any) screwed in under it. */
export const m2Start = (storageIn) => ({ cover: "on", coverScrews: [true, true], ssdScrew: !!storageIn });

/** Can the cover be lifted off now? null, or { key, msg }. */
export function m2LiftBlock(m2) {
  const left = m2.coverScrews.filter(Boolean).length;
  if (left > 0) return { key: "m2cover", msg: `Unscrew the M.2 cover first: ${left} of ${M2_COVER_SCREWS} screws are still in.` };
  return null;
}

/** Can the cover go back on now? An SSD under it must be screwed down first. */
export function m2RefitBlock(m2, installed) {
  if (installed.storage && !m2.ssdScrew) {
    return { key: "m2cover", msg: "Screw the SSD down first (the small screw at its end), then put the cover back over it." };
  }
  return null;
}

/** The SSD slot is finished: SSD screwed in (if there is one), cover back on with both screws in. */
export const m2Done = (m2, installed) =>
  m2.cover === "on" && m2.coverScrews.every(Boolean) && (!installed.storage || m2.ssdScrew);

/* ---------- the CPU socket: its lever, and on AM5 its cover frame ---------- */
// socket = { lever: "down" | "up", plate: "closed" | "open", cap: bool }
// An AM4 socket (ZIF: the pins are on the CPU) is held by its lever alone: up slides the socket's top
// plate open so the CPU drops in, down slides it back and grips every pin. An AM5 socket (LGA: the
// pins are in the socket) has a hinged metal cover frame (the load plate) that the lever holds shut,
// with a plastic cap on it that pops off once a CPU is locked in (`cap` false: it waits on the bench,
// and can go back on an empty socket). On AM4 `plate` and `cap` are ignored. The lever only moves
// with no cooler on the CPU, so a CPU under a cooler is always locked in.
export const socketKind = (picks) => (itemFor("motherboard", picks)?.socket === "am5" ? "lga" : "zif");

/** How a board starts: lever down, frame shut, the cap on while there is no CPU in it. */
export const socketStart = (cpuIn) => ({ lever: "down", plate: "closed", cap: !cpuIn });

/** A CPU can go in or come out: lever up (and on AM5, the frame lifted). */
export const socketOpen = (s, kind) => s.lever === "up" && (kind === "zif" || s.plate === "open");

/** A CPU in it is clamped: the lever is down (on AM5 it only goes down over a shut frame). */
export const socketLocked = (s) => s.lever === "down";

/** Why a CPU can't go in (or come out) of a socket that isn't open. */
function socketShutBlock(s, kind, removing = false) {
  if (kind === "zif") {
    return {
      key: "socket",
      msg: removing
        ? "Lift the socket lever first: while it's down, the socket's top plate grips the CPU's pins."
        : "Lift the socket lever first: unhook it and raise it all the way up. That slides the socket's top plate open so the CPU drops in.",
    };
  }
  if (s.lever === "down") {
    return { key: "socket", msg: "Open the socket first: push the lever down and out of its hook, lift it, then lift the cover frame." };
  }
  return { key: "socket", msg: `Lift the cover frame on its hinge first: it ${removing ? "holds the CPU down" : "covers the socket"}.` };
}

/** Can the lever move now (up, or back down)? null, or { key, msg }. */
export function leverBlock(s, kind, installed) {
  if (s.lever === "down" && installed.cpu_cooler) {
    return { key: "socket", msg: "Take the CPU cooler off first. The lever stays locked while a cooler sits on the CPU." };
  }
  if (s.lever === "up" && kind === "lga" && s.plate === "open") {
    return { key: "socket", msg: "Close the cover frame first. The lever goes down over it and holds it shut." };
  }
  return null;
}

/** Can the AM5 cover frame move now? The lever holds it shut. */
export function plateBlock(s) {
  if (s.lever === "down") {
    return { key: "socket", msg: "Unhook the lever first (push it down and out, then lift it). It holds the cover frame shut." };
  }
  return null;
}

/** Can AM5's plastic cap go back on from the bench? Only on an empty socket. */
export function capBlock(s, installed) {
  if (!s.cap && installed.cpu) {
    return { key: "socket", msg: "The plastic cap only goes back on an empty socket. Take the CPU out first." };
  }
  return null;
}

/** The socket is finished: a CPU in it is locked in. */
export const socketDone = (s, installed) => !installed.cpu || socketLocked(s);

/** True if the PC is fully built (every part in). */
export const isFullyBuilt = (installed, picks) => buildSlots(picks).every((p) => installed[p]);

/**
 * Checklist for the lab's guide card: [{ label, done, anyOrder }].
 * Building follows the expert order. Taking apart starts with the safety steps (in order),
 * then every part can come out in any order (anyOrder: true).
 * state = { installed, picks, pasteApplied, booted, power, cord }
 */
export function expertSteps(mode, { installed, picks, pasteApplied, booted, power, cord = null, cables = {}, screws = [], psuScrews = [], gpuScrews = [], psuCables = {}, m2 = null, socket = null, wires = null }) {
  const slot = m2 || m2Start(installed.storage);
  const sock = socket || socketStart(installed.cpu);
  const lga = socketKind(picks) === "lga";
  const sockOpen = socketOpen(sock, socketKind(picks));
  const driven = screws.filter(Boolean).length;
  const psuDriven = psuScrews.filter(Boolean).length;
  const gpuDriven = gpuScrews.filter(Boolean).length;
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
      { label: "Unplug the power cord", done: power.unplugged },
      { label: "Hold the power button to drain leftover power", done: power.discharged },
      any(gpuSixPin(picks) ? "8-pin and 6-pin PCIe cables unplugged (before the graphics card comes out)" : "PCIe cable unplugged (before the graphics card comes out)", !cables.pcie && !cables.pcie6),
      any(`Card's bracket screws out, on the back of the case (${GPU_SCREW_COUNT - gpuDriven} of ${GPU_SCREW_COUNT})`, out("gpu") || gpuDriven === 0),
      any("Graphics card out (it covers the M.2 slot)", out("gpu")),
      any("24-pin and 8-pin CPU cables unplugged (before the board comes out)", !cables.atx24 && !cables.eps8),
      any("Front-panel, USB, audio and fan wires unplugged (before the cooler and the board come out)", !anyWire(wires)),
      any(`Motherboard screws out (${SCREW_COUNT - driven} of ${SCREW_COUNT})`, out("motherboard") || driven === 0),
      any(`PSU screws out, on the back of the case (${PSU_SCREW_COUNT - psuDriven} of ${PSU_SCREW_COUNT})`, out("psu") || psuDriven === 0),
      any("PSU out (its cables unplugged from the parts, its screws out)", out("psu")),
      ...(socketed.length ? [any("Cables off the PSU (once it's out)", socketed.every((c) => !psuCables[c]))] : []),
      any("Motherboard out (graphics card, cables and screws out first)", out("motherboard")),
      any("CPU cooler off", out("cpu_cooler")),
      any("Old thermal paste wiped (before the CPU comes out)", !pasteApplied),
      any(lga ? "CPU socket opened (lever up, then the cover frame)" : "CPU socket lever up", sockOpen || out("cpu")),
      any("CPU out (the cooler must be off)", out("cpu")),
      any("RAM stick(s) out", out("ram1") && out("ram2")),
      any("M.2 cover off (unscrew it, lift it off)", slot.cover === "off" || out("storage")),
      any("M.2 SSD unscrewed and out", out("storage")),
    ];
  }
  const ramDone = installed.ram1 && (!has("ram2") || installed.ram2);
  return [
    { label: "Pick parts that work together", done: buildSlots(picks).every(has) },
    { label: lga ? "Open the CPU socket: unhook the lever, lift it, lift the cover frame" : "Lift the CPU socket's lever (it slides the socket open)", done: !!installed.cpu || sockOpen },
    { label: "Seat the CPU in the socket (board on the bench)", done: !!installed.cpu },
    {
      label: lga ? "Close the cover frame and hook the lever down (the cap pops off)" : "Push the socket lever down: the socket grips the CPU's pins",
      done: !!installed.cpu && socketLocked(sock),
    },
    { label: has("ram2") ? "Click both RAM sticks into slots 1 and 3" : "Click the RAM stick into its slot", done: !!ramDone },
    { label: "Unscrew and lift off the M.2 cover", done: slot.cover === "off" || !!installed.storage },
    { label: "Screw the M.2 SSD into its slot", done: !!installed.storage && slot.ssdScrew },
    { label: "Put the M.2 cover back and screw it down", done: !!installed.storage && m2Done(slot, installed) },
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
    { label: `Screw the PSU in from the back of the case (${psuDriven} of ${PSU_SCREW_COUNT})`, done: psuDriven === PSU_SCREW_COUNT },
    { label: "Plug the 24-pin cable into the board", done: !!cables.atx24 },
    { label: "Plug the 8-pin CPU cable in (top-left)", done: !!cables.eps8 },
    // before the graphics card, which covers the bottom of the board
    ...wireSteps(wires, installed),
    ...(has("gpu")
      ? [
          { label: "Install the graphics card last", done: !!installed.gpu },
          { label: `Screw its bracket in from the back of the case (${gpuDriven} of ${GPU_SCREW_COUNT})`, done: gpuDriven === GPU_SCREW_COUNT },
          gpuSixPin(picks)
            ? { label: "Plug the 8-pin and the 6-pin PCIe cables into the graphics card", done: !!cables.pcie && !!cables.pcie6 }
            : { label: "Plug PCIe power into the graphics card", done: !!cables.pcie },
        ]
      : []),
    { label: "Plug the power cord in: the PSU first, then the power strip", done: cordIn(cord) },
    { label: "Power on and check it boots", done: !!booted },
  ];
}
/** True if every part is out (and the cables in the PSU's sockets are off it: pass only those). */
export const isFullyStripped = (installed, psuCables = {}) =>
  Object.keys(INSTALL_NEEDS).every((p) => !installed[p]) && !Object.values(psuCables).some(Boolean);