// Parts the student can pick from, AM4 / AM5 platforms, and the compatibility rules.
// Pure data and functions only: no React, no Three.js, no Firebase.
//
// `picks` is keyed by category: { motherboard: "mb_b550", cpu: "cpu_5600x", ram: "ram_ddr4", ... }.
// Bench slots (ram1, ram2, ...) map to a category with categoryOf().

export const PLATFORMS = ["am4", "am5"];
export const PLATFORM_LABEL = { am4: "AM4", am5: "AM5" };
export const PLATFORM_MEMORY = { am4: "ddr4", am5: "ddr5" };
export const MEMORY_LABEL = { ddr4: "DDR4", ddr5: "DDR5" };

/** "am4" | "am5" | null. Anything else becomes null. */
export const normalizePlatform = (value) => (PLATFORMS.includes(value) ? value : null);

// Picker order. "ram" is one kit that fills both RAM slots.
export const CATEGORIES = [
  { id: "motherboard", label: "Motherboard", slots: ["motherboard"] },
  { id: "cpu", label: "CPU", slots: ["cpu"] },
  { id: "ram", label: "RAM", slots: ["ram1", "ram2"] },
  { id: "cpu_cooler", label: "Cooler", slots: ["cpu_cooler"] },
  { id: "storage", label: "SSD", slots: ["storage"] },
  { id: "gpu", label: "GPU", slots: ["gpu"] },
  { id: "psu", label: "PSU", slots: ["psu"] },
];

export const categoryOf = (slot) => (slot === "ram1" || slot === "ram2" ? "ram" : slot);

export const CATALOG = {
  /* ---------- motherboards ---------- */
  mb_b550: {
    category: "motherboard",
    name: "ASUS ROG Strix B550-F",
    short: "B550",
    socket: "am4",
    memory: "ddr4",
    model: "/models/motherboard.glb",
    specs: [["Socket", "AM4"], ["Chipset", "B550"], ["Memory", "DDR4, 4 slots"], ["Size", "ATX"]],
    note: "AM4 boards have a socket full of small holes. The pins are on the CPU.",
  },
  mb_b650: {
    category: "motherboard",
    name: "B650-PLUS ATX",
    short: "B650",
    socket: "am5",
    memory: "ddr5",
    model: "/models/motherboard1.glb",
    specs: [["Socket", "AM5 (LGA 1718)"], ["Chipset", "B650"], ["Memory", "DDR5, 4 slots"], ["Size", "ATX"]],
    note: "AM5 boards have the pins in the socket. Keep the plastic cover on until the CPU goes in.",
  },

  /* ---------- CPUs ---------- */
  cpu_5600x: {
    category: "cpu",
    name: "AMD Ryzen 5 5600X",
    short: "5600X",
    socket: "am4",
    tdp: 65,
    igpu: false,
    model: "/models/cpu.glb",
    specs: [["Socket", "AM4"], ["Cores", "6 cores / 12 threads"], ["Power", "65 W"], ["Graphics", "None built in"]],
    note: "The pins are under this CPU. Bent pins mean it won't work.",
  },
  cpu_7600x: {
    category: "cpu",
    name: "AMD Ryzen 5 7600X",
    short: "7600X",
    socket: "am5",
    tdp: 105,
    igpu: true,
    model: "/models/cpu1.glb",
    specs: [["Socket", "AM5"], ["Cores", "6 cores / 12 threads"], ["Power", "105 W"], ["Graphics", "Basic built-in graphics"]],
    note: "This CPU has flat pads underneath. The pins are on the board's socket.",
  },

  /* ---------- memory (one kit = two sticks) ---------- */
  ram_ddr4: {
    category: "ram",
    name: "16 GB DDR4-3200 kit (2 × 8 GB)",
    short: "DDR4",
    memory: "ddr4",
    specs: [["Type", "DDR4"], ["Speed", "3200 MT/s"], ["Kit", "2 × 8 GB"]],
    note: "DDR4 and DDR5 notches sit in different places, so one can't go in the other's slot.",
  },
  ram_ddr5: {
    category: "ram",
    name: "32 GB DDR5-6000 kit (2 × 16 GB)",
    short: "DDR5",
    memory: "ddr5",
    specs: [["Type", "DDR5"], ["Speed", "6000 MT/s"], ["Kit", "2 × 16 GB"]],
    note: "DDR4 and DDR5 notches sit in different places, so one can't go in the other's slot.",
  },

  /* ---------- the rest ---------- */
  cooler_tower: {
    category: "cpu_cooler",
    name: "Tower air cooler",
    short: "Tower",
    sockets: ["am4", "am5"],
    specs: [["Fits", "AM4 and AM5"], ["Cooling", "Up to 150 W"]],
    note: "Comes with mounting brackets for both AM4 and AM5.",
  },
  ssd_nvme: {
    category: "storage",
    name: "1 TB M.2 NVMe SSD",
    short: "NVMe",
    specs: [["Slot", "M.2 (PCIe)"], ["Size", "1 TB"]],
  },
  gpu_3060ti: {
    category: "gpu",
    name: "NVIDIA RTX 3060 Ti",
    short: "3060 Ti",
    power: 200,
    specs: [["Slot", "PCIe x16"], ["Power", "200 W"], ["Needs", "8-pin PCIe power"]],
  },
  psu_450: {
    category: "psu",
    name: "450 W 80+ Bronze PSU",
    short: "450 W",
    watts: 450,
    specs: [["Output", "450 W"], ["Rating", "80+ Bronze"]],
  },
  psu_650: {
    category: "psu",
    name: "650 W 80+ Gold PSU",
    short: "650 W",
    watts: 650,
    specs: [["Output", "650 W"], ["Rating", "80+ Gold"]],
  },
};

/** Catalog entries for one category, in catalog order. */
export const optionsFor = (category) =>
  Object.entries(CATALOG)
    .filter(([, item]) => item.category === category)
    .map(([id, item]) => ({ id, ...item }));

/** The picked catalog item for a bench slot, or null. */
export function itemFor(slot, picks) {
  const id = picks?.[categoryOf(slot)];
  return id && CATALOG[id] ? { id, ...CATALOG[id] } : null;
}

/** The right part in every category for a platform (used for a pre-built PC and "auto pick"). */
export function correctPicks(platform) {
  const p = normalizePlatform(platform) || "am4";
  return {
    motherboard: p === "am5" ? "mb_b650" : "mb_b550",
    cpu: p === "am5" ? "cpu_7600x" : "cpu_5600x",
    ram: p === "am5" ? "ram_ddr5" : "ram_ddr4",
    cpu_cooler: "cooler_tower",
    storage: "ssd_nvme",
    gpu: "gpu_3060ti",
    psu: "psu_650",
  };
}

const BASE_WATTS = 100; // board, drive, fans
const HEADROOM = 1.3;

/** Watts the picked parts need, with headroom. */
export function requiredWatts(picks, installed = null) {
  const on = (slot) => !installed || installed[slot];
  const cpu = on("cpu") ? itemFor("cpu", picks) : null;
  const gpu = on("gpu") ? itemFor("gpu", picks) : null;
  return Math.round(((cpu?.tdp || 0) + (gpu?.power || 0) + BASE_WATTS) * HEADROOM);
}

const VAGUE = "It won't go in. Check that this part matches the rest of your build.";

/**
 * Can the picked part for `slot` go in, given the other picks and the work order platform?
 * Returns null if it fits, else { msg, vague } (vague is shown when hints are off).
 */
export function fitBlock(slot, picks, platform) {
  const item = itemFor(slot, picks);
  if (!item) return null;
  const board = itemFor("motherboard", picks);
  const P = PLATFORM_LABEL;
  const M = MEMORY_LABEL;

  // physical fit first: the part can't go into the board on the bench
  if (slot === "cpu" && board && board.socket !== item.socket) {
    return {
      msg: `The ${item.name} is an ${P[item.socket]} CPU. It won't fit the ${P[board.socket]} socket on the ${board.short}.`,
      vague: VAGUE,
    };
  }
  if (item.category === "ram" && board && board.memory !== item.memory) {
    return {
      msg: `${M[item.memory]} sticks won't fit the ${M[board.memory]} slots on the ${board.short}. The notch is in a different place.`,
      vague: VAGUE,
    };
  }
  if (item.sockets && !item.sockets.includes(platform)) {
    return { msg: `This cooler has no bracket for ${P[platform]}.`, vague: VAGUE };
  }

  // then the work order from the instructor
  const order = `Your work order is an ${P[platform]} build.`;
  if (item.socket && item.socket !== platform) {
    return { msg: `${order} The ${item.name} is an ${P[item.socket]} part.`, vague: `${order} Check what you picked.` };
  }
  if (item.memory && item.category === "ram" && item.memory !== PLATFORM_MEMORY[platform]) {
    return {
      msg: `${order} It needs ${M[PLATFORM_MEMORY[platform]]} memory, this kit is ${M[item.memory]}.`,
      vague: `${order} Check what you picked.`,
    };
  }
  return null;
}

/** Short badges for a picker card, e.g. ["AM4", "DDR4"]. Hidden when part info is off. */
export function badgesFor(item) {
  const out = [];
  if (item.socket) out.push(PLATFORM_LABEL[item.socket]);
  if (item.sockets) out.push(item.sockets.map((s) => PLATFORM_LABEL[s]).join(" / "));
  if (item.memory) out.push(MEMORY_LABEL[item.memory]);
  if (item.watts) out.push(`${item.watts} W`);
  if (item.power) out.push(`${item.power} W draw`);
  if (item.tdp) out.push(`${item.tdp} W`);
  return out;
}
