// Troubleshooting tasks (Tasks.js, mode "troubleshoot"). The instructor sets a PC up in the editor
// (components/instructor/TroubleshootEditor.jsx): the part in each slot, fitted or left on the bench,
// the RAM slots, the thermal paste, the board's screws, where each power cable is plugged in (or
// swapped at the PSU), and where every case and fan wire is. The student gets that PC, finds what's
// wrong and fixes it.
//
// findFaults() compares any PC with a working one and lists what's wrong, one entry per part or
// connection (its id: "part:cpu", "cable:atx24", "wire:pled"...). The editor gives each fault of the
// set-up points by difficulty; the lab counts a fault fixed once that part or connection is right.
// Pure functions: no React, no Firebase.
import { CATALOG, MEMORY_LABEL, PLATFORM_LABEL, categoryOf, correctPicks, itemFor, normalizePlatform, requiredWatts } from "./Catalog";
import {
  CABLES, PSU_SOCKET_KIND, SCREW_COUNT, cableNeeded, isGpuCable, m2Done, m2Start, psuCableFixed, psuMixUps, socketLocked, socketStart,
} from "./Rules";
import { HEADERS, WIRES, WIRE_IDS, headerName, wireName, wireRight, wiresStart } from "./Wires";

/* ---------- difficulty and points ---------- */

export const DIFFICULTIES = [
  { id: "easy", label: "Easy", points: 5 },
  { id: "medium", label: "Medium", points: 10 },
  { id: "hard", label: "Hard", points: 15 },
];
export const DIFFICULTY_POINTS = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.points]));
export const MAX_FAULT_POINTS = 50; // one fault is worth 1 to 50 points; the task's total stays within 100
export const BOOT_POINTS = 10; // the PC starting at the end, with nothing wrong

/** The difficulty whose preset matches these points, or "custom". */
export const difficultyOf = (points) => DIFFICULTIES.find((d) => d.points === points)?.id ?? "custom";

/* ---------- the instructor's set-up ---------- */

// the slots a set-up picks a part for, in the editor's order (the board is the platform's own; the
// board and the PSU are always in the case), and the ones whose part may wait on the bench
export const SCENARIO_SLOTS = ["cpu", "ram1", "ram2", "cpu_cooler", "storage", "gpu", "psu"];
export const BENCH_SLOTS = ["cpu", "ram1", "ram2", "cpu_cooler", "storage", "gpu"];
// where a power cable is: plugged in at both ends, or unplugged at one of them
export const CABLE_STATES = ["in", "part", "psu"];
// the two cables a swap at the PSU puts in each other's sockets
const SWAP = { eps8: "pcie", pcie: "cpu" };

/** A working PC on this platform: every part fitted and every cable and wire where it belongs. */
export function workingScenario(platform) {
  return {
    parts: correctPicks(normalizePlatform(platform) || "am4"),
    bench: [], // slots whose part waits on the bench instead of being fitted
    ramSlots: [0, 2], // RAM 1's and RAM 2's slot, 0 to 3 (slots 1 and 3: dual channel)
    paste: true,
    screws: SCREW_COUNT, // board screws driven in
    cables: { atx24: "in", eps8: "in", pcie: "in", pcie6: "in" },
    swapped: false, // the 8-pin CPU and PCIe cables in each other's socket on a modular PSU
    wires: wiresStart(true),
  };
}

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Can the 8-pin CPU and PCIe cables be swapped at this PSU (both plug into its sockets)? */
export const canSwap = (picks) =>
  !!picks.gpu && !!itemFor("psu", picks)?.modular && !psuCableFixed("eps8", picks) && !psuCableFixed("pcie", picks);

/** Fills in and checks a saved set-up, so an older or hand-edited one still loads. */
export function normalizeScenario(s, platform) {
  const base = workingScenario(platform);
  const raw = s && typeof s === "object" ? s : {};
  const parts = { ...base.parts };
  for (const slot of SCENARIO_SLOTS) {
    if (!raw.parts || !(slot in raw.parts)) continue;
    const id = raw.parts[slot];
    if (id === null && slot !== "psu") parts[slot] = null; // left out
    else if (CATALOG[id]?.category === categoryOf(slot)) parts[slot] = id;
  }
  const bench = Array.isArray(raw.bench) ? BENCH_SLOTS.filter((b) => raw.bench.includes(b) && parts[b]) : [];
  const r1 = clampInt(raw.ramSlots?.[0], 0, 3, 0);
  let r2 = clampInt(raw.ramSlots?.[1], 0, 3, 2);
  if (r2 === r1) r2 = [2, 0, 3, 1].find((n) => n !== r1);
  const cables = { ...base.cables };
  for (const c of Object.keys(cables)) {
    // a fixed cable can't come off its PSU
    if (CABLE_STATES.includes(raw.cables?.[c]) && !(raw.cables[c] === "psu" && psuCableFixed(c, parts))) cables[c] = raw.cables[c];
  }
  const swapped = !!raw.swapped && canSwap(parts) && cables.eps8 !== "psu" && cables.pcie !== "psu";
  // each wire on a header of this board that its plug fits, one wire a header; a wire the set-up
  // doesn't mention is in its place
  const wires = {};
  const used = new Set();
  for (const id of WIRE_IDS) {
    const w = raw.wires && id in raw.wires ? raw.wires[id] : base.wires[id];
    if (w && wireSpotsFor(id, parts.motherboard).includes(w.at) && !used.has(w.at)) {
      used.add(w.at);
      wires[id] = { at: w.at, flipped: !!(WIRES[id].polar && w.flipped) };
    } else wires[id] = null;
  }
  return {
    parts,
    bench,
    ramSlots: [r1, r2],
    paste: raw.paste !== false,
    screws: clampInt(raw.screws, 0, SCREW_COUNT, SCREW_COUNT),
    cables,
    swapped,
    wires,
  };
}

/** The headers a board has (the AM5 board has no 12 V RGB header). */
export const boardHeaders = (boardId) => Object.keys(HEADERS).filter((h) => !(CATALOG[boardId]?.lacksHeaders || []).includes(h));

/** The headers a wire's plug fits on this board. */
export const wireSpotsFor = (id, boardId) => boardHeaders(boardId).filter((h) => WIRES[id].fits.includes(HEADERS[h].kind));

/**
 * The parts of a set-up that can't go where it puts them, and why (the lab's fitBlock, in short).
 * They wait on the bench, as they would in real life: an AM4 CPU and an AM5 board, a DDR4 stick and
 * DDR5 slots, a cooler with no CPU under it. { slot: reason }
 */
export function benchedBy(scenario) {
  const { parts, bench } = scenario;
  const board = CATALOG[parts.motherboard];
  const fitted = (slot) => (parts[slot] && !bench.includes(slot) ? CATALOG[parts[slot]] : null);
  const out = {};
  const cpu = fitted("cpu");
  if (cpu && cpu.socket !== board.socket) out.cpu = `An ${PLATFORM_LABEL[cpu.socket]} CPU won't go in an ${PLATFORM_LABEL[board.socket]} socket.`;
  for (const r of ["ram1", "ram2"]) {
    const stick = fitted(r);
    if (stick && stick.memory !== board.memory) out[r] = `${MEMORY_LABEL[stick.memory]} won't go in ${MEMORY_LABEL[board.memory]} slots.`;
  }
  const cooler = fitted("cpu_cooler");
  if (cooler?.sockets && !cooler.sockets.includes(board.socket)) out.cpu_cooler = `This cooler has no ${PLATFORM_LABEL[board.socket]} bracket.`;
  else if (cooler && (!cpu || out.cpu)) out.cpu_cooler = "The cooler sits on the CPU, and there's no CPU in the socket.";
  return out;
}

/** The lab's start state for a set-up (Setup.buildStart's shape, and psuSockOf). */
export function scenarioStart(scenario, platform) {
  const s = normalizeScenario(scenario, platform);
  const picks = { ...s.parts };
  const blocked = benchedBy(s);
  const installed = { motherboard: true, psu: true };
  for (const slot of BENCH_SLOTS) if (picks[slot] && !s.bench.includes(slot) && !blocked[slot]) installed[slot] = true;

  const cables = {};
  const psuCables = {};
  for (const c of Object.keys(CABLES)) {
    const needed = cableNeeded(c, picks);
    const state = s.cables[c];
    const partThere = isGpuCable(c) ? !!installed.gpu : true;
    cables[c] = needed && partThere && state !== "part";
    // a fixed PSU's cables are always on it; the others may hang loose at the PSU
    psuCables[c] = needed && (psuCableFixed(c, picks) || state !== "psu");
  }

  const wires = {};
  for (const id of WIRE_IDS) {
    const w = s.wires[id];
    // the cooler's fan wire hangs from the cooler: no cooler fitted, no wire on the board
    wires[id] = w && (id !== "cpu_fan" || installed.cpu_cooler) ? { ...w } : null;
  }

  return {
    mode: "assemble",
    installed,
    picks,
    pasteApplied: !!installed.cpu && s.paste, // the paste goes on the CPU
    ramSlot: { ram1: installed.ram1 ? s.ramSlots[0] : null, ram2: installed.ram2 ? s.ramSlots[1] : null },
    power: { shutdown: false, unplugged: false, discharged: false },
    cables,
    psuCables,
    psuSockOf: s.swapped ? { ...SWAP } : {},
    screws: Array.from({ length: SCREW_COUNT }, (_, i) => i < s.screws),
    m2: m2Start(installed.storage),
    socket: socketStart(installed.cpu),
    wires,
  };
}

/* ---------- what's wrong ---------- */

// how hard each kind of fault is to find, for its default points
const KIND = {
  missing: "easy", bench: "easy", unplugged: "easy", screws: "easy",
  wrong: "medium", reversed: "medium", slots: "medium", paste: "medium", noGpu: "medium", swap: "medium",
  fit: "hard", weak: "hard",
};

/**
 * Everything wrong with a PC, compared with a working one: [{ id, area, text, difficulty }], one
 * entry per part or connection. state: the lab's state (installed, picks, pasteApplied, ramSlot,
 * cables, psuCables, psuSockOf, screws, m2, socket, wires). needs: what the fixed PC needs, from the
 * task (ramSticks: 1 or 2, requireGpu).
 */
export function findFaults(state, { ramSticks = 2, requireGpu = true } = {}) {
  const { installed = {}, picks = {}, ramSlot = {}, cables = {}, psuCables = {}, psuSockOf = {}, screws = [], m2 = null, socket = null, wires = {} } = state;
  const out = [];
  const add = (id, area, text, kind) => out.push({ id, area, text, difficulty: KIND[kind] });
  const item = (slot) => itemFor(slot, picks);
  const board = item("motherboard");
  const P = PLATFORM_LABEL;
  const M = MEMORY_LABEL;

  if (!installed.motherboard) add("part:motherboard", "parts", "Motherboard: not in the case.", "bench");

  const cpu = item("cpu");
  const cpuFits = !!cpu && (!board || cpu.socket === board.socket);
  // the cooler, the graphics and the power are judged against the CPU that goes in this board: the
  // one picked, or (if it can't go in) the platform's own
  const cpuFor = cpuFits ? cpu : board ? itemFor("cpu", correctPicks(board.socket)) : null;
  if (!cpu) add("part:cpu", "parts", "CPU: none.", "missing");
  else if (!cpuFits) add("part:cpu", "parts", `CPU: the ${cpu.name} is an ${P[cpu.socket]} CPU. It can't go in this ${P[board.socket]} board.`, "fit");
  else if (!installed.cpu) add("part:cpu", "parts", "CPU: on the bench, not in the socket.", "bench");
  else if (socket && !socketLocked(socket)) add("part:cpu", "parts", "CPU: the socket lever isn't down.", "bench");

  // RAM 1 is always needed, RAM 2 when the PC needs two sticks (a spare one is up to the student)
  const sticks = Number(ramSticks) === 1 ? 1 : 2;
  ["ram1", "ram2"].slice(0, sticks).forEach((r, i) => {
    const it = item(r);
    const n = i + 1;
    if (!it) add(`part:${r}`, "parts", `RAM stick ${n}: none (the PC needs ${sticks === 2 ? "two" : "one"}).`, "missing");
    else if (board && it.memory !== board.memory) add(`part:${r}`, "parts", `RAM stick ${n}: ${M[it.memory]} in a ${M[board.memory]} board.`, "wrong");
    else if (!installed[r]) add(`part:${r}`, "parts", `RAM stick ${n}: on the bench, not in a slot.`, "bench");
  });
  if (sticks === 2 && installed.ram1 && installed.ram2 && ramSlot.ram1 != null && ramSlot.ram2 != null && Math.abs(ramSlot.ram1 - ramSlot.ram2) === 1) {
    const [a, b] = [ramSlot.ram1, ramSlot.ram2].sort();
    add("ram:slots", "parts", `RAM in slots ${a + 1} and ${b + 1}: single channel (slots 1 and 3, or 2 and 4, run dual channel).`, "slots");
  }

  const cooler = item("cpu_cooler");
  if (!cooler) add("part:cpu_cooler", "cooling", "CPU cooler: none.", "missing");
  else if (board && cooler.sockets && !cooler.sockets.includes(board.socket)) {
    add("part:cpu_cooler", "cooling", `CPU cooler: the ${cooler.short} has no ${P[board.socket]} bracket.`, "fit");
  } else if (cpuFor && cooler.cooling < cpuFor.tdp) {
    add("part:cpu_cooler", "cooling", `CPU cooler: the ${cooler.short} (${cooler.cooling} W) is too weak for the ${cpuFor.short} (${cpuFor.tdp} W).`, "weak");
  } else if (!installed.cpu_cooler) add("part:cpu_cooler", "cooling", "CPU cooler: on the bench.", "bench");
  if (installed.cpu && !state.pasteApplied) add("paste", "cooling", "No thermal paste on the CPU.", "paste");

  const ssd = item("storage");
  if (!ssd) add("part:storage", "parts", "SSD: none.", "missing");
  else if (!installed.storage) add("part:storage", "parts", "SSD: on the bench.", "bench");
  else if (m2 && !m2Done(m2, installed)) add("part:storage", "parts", "SSD: not screwed down under its M.2 cover.", "bench");

  // a graphics card is needed when the task asks for one, or the CPU has no built-in graphics
  const gpu = item("gpu");
  const noIgpu = cpuFor?.igpu === false;
  const needGpu = requireGpu || noIgpu;
  if (!gpu) {
    if (needGpu) add("part:gpu", "parts", noIgpu ? `Graphics card: none, and the ${cpuFor.short} has no built-in graphics.` : "Graphics card: none.", "noGpu");
  } else if (!installed.gpu && needGpu) add("part:gpu", "parts", "Graphics card: on the bench.", "bench");
  const gpuIn = !!gpu && (!!installed.gpu || needGpu); // a spare card on the bench needs no cables

  const psu = item("psu");
  const need = requiredWatts({ ...picks, cpu: cpuFor?.id ?? null }, { cpu: true, gpu: gpuIn });
  if (!psu) add("part:psu", "power", "PSU: none.", "missing");
  else if (psu.watts < need) add("part:psu", "power", `PSU: ${psu.watts} W is too weak. These parts need about ${need} W.`, "weak");
  else if (!installed.psu) add("part:psu", "power", "PSU: not in the case.", "bench");

  const driven = screws.filter(Boolean).length;
  if (installed.motherboard && driven < SCREW_COUNT) add("screws", "parts", `Board screws: ${driven} of ${SCREW_COUNT} in.`, "screws");

  const mixed = psuMixUps(picks, psuCables, psuSockOf);
  for (const c of Object.keys(CABLES)) {
    if (!cableNeeded(c, picks) || (isGpuCable(c) && !gpuIn)) continue;
    const label = CABLES[c].label;
    const end = isGpuCable(c) ? "graphics card" : "board";
    if (mixed.includes(c)) add(`cable:${c}`, "power", `${label}: in the ${PSU_SOCKET_KIND[psuSockOf[c]]} socket on the PSU.`, "swap");
    else if (!cables[c] && !psuCables[c]) add(`cable:${c}`, "power", `${label}: unplugged at both ends.`, "unplugged");
    else if (!cables[c]) add(`cable:${c}`, "power", `${label}: unplugged at the ${end}.`, "unplugged");
    else if (!psuCables[c]) add(`cable:${c}`, "power", `${label}: unplugged at the PSU.`, "unplugged");
  }

  for (const id of WIRE_IDS) {
    const w = wires[id];
    if (wireRight(id, w)) continue;
    if (!w) add(`wire:${id}`, "wires", `${wireName(id)}: unplugged.`, "unplugged");
    else if (WIRES[id].polar && w.at === WIRES[id].goes) add(`wire:${id}`, "wires", `${wireName(id)}: on ${headerName(w.at)}, the wrong way round (+ on −).`, "reversed");
    else add(`wire:${id}`, "wires", `${wireName(id)}: on ${headerName(w.at)} instead of ${headerName(WIRES[id].goes)}.`, "wrong");
  }
  return out;
}

/** The faults of a set-up, as the student finds them. task: { platform, ramSticks, requireGpu }. */
export const scenarioFaults = (scenario, task) => findFaults(scenarioStart(scenario, task?.platform), task);

// A fault only counts as fixed while what it hangs on is right too: taking a stick out doesn't fix
// the RAM slots, taking the CPU out doesn't fix the paste, leaving the card out doesn't fix its cables.
const DEPENDS = {
  "ram:slots": ["part:ram1", "part:ram2"],
  paste: ["part:cpu"],
  "cable:pcie": ["part:gpu"],
  "cable:pcie6": ["part:gpu"],
  "wire:cpu_fan": ["part:cpu_cooler"],
};

/** Which of the set-up's faults (ids) are fixed in a PC with these faults now. */
export function fixedFaults(ids, faultsNow) {
  const now = new Set(faultsNow.map((f) => f.id));
  return ids.filter((id) => !now.has(id) && !(DEPENDS[id] || []).some((d) => now.has(d)));
}

/**
 * The points for each of a set-up's faults: the instructor's choice where there is one, else the
 * fault's difficulty preset. A fault the set-up no longer has drops out.
 */
export function faultPointsFor(faults, chosen = {}) {
  const out = {};
  for (const f of faults) {
    const p = Math.floor(Number(chosen?.[f.id]));
    out[f.id] = Number.isFinite(p) && p >= 1 ? Math.min(MAX_FAULT_POINTS, p) : DIFFICULTY_POINTS[f.difficulty];
  }
  return out;
}

/* ---------- random faults, for the editor ---------- */

const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

// Ways to break a part or a connection: each returns a changed set-up, or null if it doesn't apply.
function mutations(s, platform) {
  const other = correctPicks(normalizePlatform(platform) === "am5" ? "am4" : "am5");
  const set = (patch) => normalizeScenario({ ...s, ...patch }, platform);
  const wire = (id, w) => set({ wires: { ...s.wires, [id]: w } });
  const free = (h) => !Object.values(s.wires).some((w) => w?.at === h);
  return [
    // a cable left unplugged at one end, or two swapped at the PSU
    ...Object.keys(CABLES).map((c) => () => set({ cables: { ...s.cables, [c]: pickOne(["part", "psu"]) } })),
    () => set({ swapped: true }),
    // a part left on the bench, or left out
    ...BENCH_SLOTS.map((slot) => () => (s.parts[slot] ? set({ bench: [...s.bench, slot] }) : null)),
    () => set({ parts: { ...s.parts, gpu: null } }),
    () => set({ screws: 5 + Math.floor(Math.random() * 4) }),
    () => set({ paste: false }),
    // RAM of the other kind, or in neighbouring slots
    ...["ram1", "ram2"].map((r) => () => set({ parts: { ...s.parts, [r]: other.ram1 } })),
    () => set({ ramSlots: pickOne([[0, 1], [1, 2], [2, 3]]) }),
    // a wire unplugged, the wrong way round, on a free look-alike header, or swapped with another
    ...WIRE_IDS.map((id) => () => wire(id, null)),
    ...WIRE_IDS.filter((id) => WIRES[id].polar).map((id) => () => wire(id, { at: WIRES[id].goes, flipped: true })),
    ...WIRE_IDS.map((id) => () => {
      const spots = wireSpotsFor(id, s.parts.motherboard).filter((h) => h !== WIRES[id].goes && free(h));
      return spots.length ? wire(id, { at: pickOne(spots), flipped: false }) : null;
    }),
    ...[["pwr_sw", "rst_sw"], ["pled", "hdd_led"], ["cpu_fan", "case_fans"], ["pwr_sw", "pled"]].map(([a, b]) => () =>
      s.wires[a] && s.wires[b] ? set({ wires: { ...s.wires, [a]: s.wires[b], [b]: s.wires[a] } }) : null
    ),
    // parts that don't go together
    () => set({ parts: { ...s.parts, cpu: other.cpu } }),
    () => set({ parts: { ...s.parts, cpu_cooler: "cooler_stock" } }),
    () => set({ parts: { ...s.parts, psu: "psu_500" } }),
    () => set({ parts: { ...s.parts, gpu: "gpu_6700xt" } }),
  ];
}

/**
 * The set-up with another fault of this difficulty, picked at random among the ways to break a part
 * or connection that is still right; null when there's none left. It may bring easier faults along
 * (an AM4 CPU in an AM5 board leaves the cooler on the bench too), never a harder one.
 */
export function addRandomFault(scenario, task, difficulty) {
  const rank = { easy: 0, medium: 1, hard: 2 };
  const s = normalizeScenario(scenario, task?.platform);
  const before = new Set(scenarioFaults(s, task).map((f) => f.id));
  const options = [];
  for (const make of mutations(s, task?.platform)) {
    const next = make();
    if (!next) continue;
    const after = scenarioFaults(next, task);
    const added = after.filter((f) => !before.has(f.id));
    const ids = new Set(after.map((f) => f.id));
    // something new of that difficulty, and nothing that was wrong put right by accident
    if (added.length > 0 && Math.max(...added.map((f) => rank[f.difficulty])) === rank[difficulty] && [...before].every((id) => ids.has(id))) {
      options.push(next);
    }
  }
  return options.length ? pickOne(options) : null;
}

/* ---------- the student's guide ---------- */

/** The guide card's troubleshooting steps (with the step-by-step guide on). */
export function troubleSteps({ poweredOn, madeSafe, fixed }) {
  return [
    { label: "Power it on and note what happens: the screen, the fans, the case's lights", done: poweredOn || fixed },
    { label: "Shut it down, unplug it and drain the power before you touch anything", done: madeSafe || fixed },
    { label: "Check every part: the right kind for the board, seated, screwed down, strong enough", done: fixed },
    { label: "Check every cable and wire: in at both ends, on the right header, the right way round", done: fixed },
    { label: "Power it on again: it starts, with nothing odd on the case", done: fixed },
  ];
}
