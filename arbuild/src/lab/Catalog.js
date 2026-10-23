// Parts the student can pick from, AM4 / AM5 platforms, and the compatibility rules.
// Pure data and functions only: no React, no Three.js, no Firebase.
//
// `picks` is keyed by bench slot: { motherboard: "mb_b550", cpu: "cpu_5600x", ram1: "ram_ddr4",
// ram2: "ram_ddr4" | null, ... }. Each RAM stick is picked on its own, so a build can have one stick,
// two matching sticks, or (by mistake) a DDR4 and a DDR5 stick.
//
// Models: each option has a `variant` number that picks its own component in Three/PartModel.jsx.
// variant 0 is the base component and file (GPUModel, gpu.glb); variant 1 the numbered ones
// (GPUModel1, gpu1.glb). Each variant component has its own size and orientation settings.
// A variant whose .glb isn't in public/models yet shows the base model instead.

export const PLATFORMS = ["am4", "am5"];
export const PLATFORM_LABEL = { am4: "AM4", am5: "AM5" };
export const PLATFORM_MEMORY = { am4: "ddr4", am5: "ddr5" };
export const MEMORY_LABEL = { ddr4: "DDR4", ddr5: "DDR5" };

/** "am4" | "am5" | null. Anything else becomes null. */
export const normalizePlatform = (value) => (PLATFORMS.includes(value) ? value : null);

// Picker order. Each category lists the bench slots it fills; RAM has one pick per stick.
export const CATEGORIES = [
  { id: "motherboard", label: "Motherboard", slots: ["motherboard"] },
  { id: "cpu", label: "CPU", slots: ["cpu"] },
  { id: "ram", label: "RAM", slots: ["ram1", "ram2"] },
  { id: "cpu_cooler", label: "Cooler", slots: ["cpu_cooler"] },
  { id: "storage", label: "SSD", slots: ["storage"] },
  { id: "gpu", label: "GPU", slots: ["gpu"] },
  { id: "psu", label: "PSU", slots: ["psu"] },
];

/** The catalog category a bench slot takes its options from ("ram1" -> "ram"). */
export const categoryOf = (slot) => (slot === "ram1" || slot === "ram2" ? "ram" : slot);

// Parts every build needs. The second RAM stick and the graphics card are up to the student
// (the Ryzen 5 7600X has built-in graphics; the 5600X does not, see Rules.evaluateBoot).
export const REQUIRED_SLOTS = ["motherboard", "cpu", "ram1", "cpu_cooler", "storage", "psu"];
export const OPTIONAL_SLOTS = ["ram2", "gpu"];

export const CATALOG = {
  /* ---------- motherboards ---------- */
  mb_b550: {
    category: "motherboard",
    name: "ASUS ROG Strix B550-F",
    short: "B550",
    socket: "am4",
    memory: "ddr4",
    variant: 0, // motherboard.glb
    specs: [["Socket", "AM4"], ["Chipset", "B550"], ["Memory", "DDR4, 4 slots"], ["Size", "ATX"]],
    note: "AM4 boards have a socket full of small holes. The pins are on the CPU.",
  },
  mb_b650: {
    category: "motherboard",
    name: "B650-PLUS ATX",
    short: "B650",
    socket: "am5",
    memory: "ddr5",
    variant: 1, // motherboard1.glb
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
    variant: 0, // cpu.glb
    specs: [["Socket", "AM4"], ["Cores", "6 cores / 12 threads"], ["Heat output", "65 W"], ["Graphics", "None built in"]],
    note: "The pins are under this CPU. Bent pins mean it won't work.",
  },
  cpu_7600x: {
    category: "cpu",
    name: "AMD Ryzen 5 7600X",
    short: "7600X",
    socket: "am5",
    tdp: 105,
    igpu: true,
    variant: 1, // cpu1.glb
    specs: [["Socket", "AM5"], ["Cores", "6 cores / 12 threads"], ["Heat output", "105 W"], ["Graphics", "Basic built-in graphics"]],
    note: "This CPU has flat pads underneath. The pins are on the board's socket.",
  },

  /* ---------- memory (one stick per pick) ---------- */
  ram_ddr4: {
    category: "ram",
    name: "8 GB DDR4-3200 stick",
    short: "DDR4",
    memory: "ddr4",
    variant: 0, // ram.glb
    specs: [["Type", "DDR4"], ["Speed", "3200 MT/s"], ["Size", "8 GB"]],
    note: "Two matching sticks in slots 1 and 3 run in dual channel, which is faster than one.",
  },
  ram_ddr5: {
    category: "ram",
    name: "16 GB DDR5-6000 stick (T-Force)",
    short: "DDR5",
    memory: "ddr5",
    variant: 1, // ram1.glb
    specs: [["Type", "DDR5"], ["Speed", "6000 MT/s"], ["Size", "16 GB"]],
    note: "DDR5 has its notch in a different place from DDR4, so the two can never be mixed.",
  },

  /* ---------- coolers ---------- */
  cooler_stock: {
    category: "cpu_cooler",
    name: "AMD Wraith Stealth (stock cooler)",
    short: "Wraith",
    sockets: ["am4", "am5"],
    cooling: 65,
    variant: 0, // cpu_cooler.glb
    specs: [["Fits", "AM4 and AM5"], ["Cools up to", "65 W"], ["Type", "Low-profile, top-down fan"]],
    note: "The cooler that comes in the box with 65 W Ryzen CPUs. Too weak for hotter CPUs.",
  },
  cooler_cm: {
    category: "cpu_cooler",
    name: "Cooler Master compact tower cooler",
    short: "CM tower",
    sockets: ["am4", "am5"],
    cooling: 150,
    variant: 1, // cpu_cooler1.glb
    specs: [["Fits", "AM4 and AM5"], ["Cools up to", "150 W"], ["Type", "Tower, heat pipes"]],
    note: "Heat pipes carry heat up into the fins, so it handles hotter CPUs than a stock cooler.",
  },

  /* ---------- storage ---------- */
  ssd_nvme: {
    category: "storage",
    name: "1 TB M.2 NVMe SSD (Gen 4)",
    short: "1 TB",
    variant: 0, // ssd.glb
    specs: [["Slot", "M.2 (PCIe 4.0)"], ["Size", "1 TB"]],
  },
  ssd_nvme_2tb: {
    category: "storage",
    name: "2 TB M.2 NVMe SSD (Gen 3)",
    short: "2 TB",
    variant: 1, // ssd1.glb
    specs: [["Slot", "M.2 (PCIe 3.0)"], ["Size", "2 TB"]],
    note: "A Gen 3 drive works in a Gen 4 slot, just a little slower.",
  },

  /* ---------- graphics ---------- */
  gpu_3060ti: {
    category: "gpu",
    name: "NVIDIA RTX 3060 Ti",
    short: "3060 Ti",
    power: 200,
    variant: 0, // gpu.glb
    powerPort: [0.469, 0.071, 0.627], // PCIe power socket, from the card's mount point (case space)
    specs: [["Slot", "PCIe x16"], ["Power draw", "200 W"], ["Needs", "1 × 8-pin PCIe power"]],
  },
  gpu_6700xt: {
    category: "gpu",
    name: "AMD Radeon RX 6700 XT",
    short: "6700 XT",
    power: 230,
    variant: 1, // gpu1.glb
    powerPort: [0.447, 0.061, 0.579], // PCIe power socket, from the card's mount point (case space)
    specs: [["Slot", "PCIe x16"], ["Power draw", "230 W"], ["Needs", "8-pin + 6-pin PCIe power"]],
    note: "Draws more power than the RTX 3060 Ti. Check the PSU can handle it with your CPU.",
  },

  /* ---------- power ---------- */
  psu_500: {
    category: "psu",
    name: "Aerocool KCAS 500 W 80+ Bronze PSU",
    short: "500 W",
    watts: 500,
    variant: 1, // psu1.glb
    modular: false, // its cables are fixed to the unit
    specs: [["Output", "500 W"], ["Rating", "80+ Bronze"], ["Size", "ATX"], ["Cables", "Fixed (non-modular)"]],
    note: "Its cables are fixed to the unit, so there is nothing to plug into the PSU itself. Check the total wattage before you pick it.",
  },
  psu_550: {
    category: "psu",
    name: "550 W 80+ Bronze PSU",
    short: "550 W",
    watts: 550,
    variant: 0, // psu.glb
    modular: true, // cables plug into sockets on the unit (MB, CPU, PCI-E, SATA)
    specs: [["Output", "550 W"], ["Rating", "80+ Bronze"], ["Cables", "Modular"]],
    note: "Modular: plug each cable into its labelled socket on the PSU while it is still on the bench.",
  },
  psu_850: {
    category: "psu",
    name: "850 W 80+ Gold PSU",
    short: "850 W",
    watts: 850,
    variant: 2, // psu2.glb (shows the 550 W model until psu2.glb is added)
    modular: true,
    specs: [["Output", "850 W"], ["Rating", "80+ Gold"], ["Cables", "Modular"]],
    note: "Modular: plug each cable into its labelled socket on the PSU while it is still on the bench.",
  },
};

/** Catalog entries for one category, in catalog order. */
export const optionsFor = (category) =>
  Object.entries(CATALOG)
    .filter(([, item]) => item.category === category)
    .map(([id, item]) => ({ id, ...item }));

/** The picked catalog item for a bench slot, or null. */
export function itemFor(slot, picks) {
  const id = picks?.[slot];
  return id && CATALOG[id] ? { id, ...CATALOG[id] } : null;
}

/** The slots this build is made of: the required ones plus any optional part that was picked. */
export const buildSlots = (picks) => [...REQUIRED_SLOTS, ...OPTIONAL_SLOTS.filter((s) => picks?.[s])];

/** A working set of parts for a platform (used for a pre-built PC and "auto pick"). */
export function correctPicks(platform) {
  const p = normalizePlatform(platform) || "am4";
  return {
    motherboard: p === "am5" ? "mb_b650" : "mb_b550",
    cpu: p === "am5" ? "cpu_7600x" : "cpu_5600x",
    ram1: p === "am5" ? "ram_ddr5" : "ram_ddr4",
    ram2: p === "am5" ? "ram_ddr5" : "ram_ddr4",
    cpu_cooler: p === "am5" ? "cooler_cm" : "cooler_stock", // the 7600X is too hot for the stock cooler
    storage: "ssd_nvme",
    gpu: "gpu_3060ti",
    psu: "psu_550",
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
 * Can the picked part for `slot` go in, given the other picks?
 * `workOrder` ("am4" | "am5") is only set in a class, where the instructor's task decides
 * the platform. In free build it is null and only the real, physical fit is checked.
 * Returns null if it fits, else { msg, vague } (vague is shown when hints are off).
 */
export function fitBlock(slot, picks, workOrder = null) {
  const item = itemFor(slot, picks);
  if (!item) return null;
  const board = itemFor("motherboard", picks);
  const P = PLATFORM_LABEL;
  const M = MEMORY_LABEL;

  // physical fit: the part can't go into the board on the bench
  if (slot === "cpu" && board && board.socket !== item.socket) {
    return {
      msg: `The ${item.name} is an ${P[item.socket]} CPU. It won't fit the ${P[board.socket]} socket on the ${board.short}.`,
      vague: VAGUE,
    };
  }
  if (item.category === "ram" && board && board.memory !== item.memory) {
    const other = itemFor(slot === "ram1" ? "ram2" : "ram1", picks);
    if (other && other.memory !== item.memory) {
      // a DDR4 and a DDR5 stick picked together
      return {
        msg:
          `You picked a ${M[other.memory]} and a ${M[item.memory]} stick. They can never be mixed: this ${M[item.memory]} ` +
          `stick's notch doesn't line up with the ${M[board.memory]} slots on the ${board.short}, and pushing harder would crack ` +
          `the slot. What to do: put it back and pick a second ${M[board.memory]} stick, or choose "No second stick" and ` +
          `run on one stick.`,
        vague: "This stick won't go in. Do both of your sticks match each other and the board?",
      };
    }
    return {
      msg: `${M[item.memory]} sticks won't fit the ${M[board.memory]} slots on the ${board.short}. The notch is in a different place.`,
      vague: VAGUE,
    };
  }
  if (item.sockets && board && !item.sockets.includes(board.socket)) {
    return { msg: `This cooler has no bracket for ${P[board.socket]}.`, vague: VAGUE };
  }

  // the instructor's work order (class only)
  if (!workOrder) return null;
  const order = `Your task is an ${P[workOrder]} build.`;
  if (item.socket && item.socket !== workOrder) {
    return { msg: `${order} The ${item.name} is an ${P[item.socket]} part.`, vague: `${order} Check what you picked.` };
  }
  if (item.memory && item.category === "ram" && item.memory !== PLATFORM_MEMORY[workOrder]) {
    return {
      msg: `${order} It needs ${M[PLATFORM_MEMORY[workOrder]]} memory, this stick is ${M[item.memory]}.`,
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
  if (item.tdp) out.push(`${item.tdp} W heat`);
  if (item.cooling) out.push(`cools ${item.cooling} W`);
  return out;
}
