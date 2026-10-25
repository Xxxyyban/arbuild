// The case's and the fans' wires to the motherboard's small headers: the front panel's 2-pin plugs
// (power switch, reset, power LED, drive LED), front audio, front USB 3.0, the cooler's fan, the case
// fans and the fans' lights. Pure rules, no React or Three.js.
//
// They make the boot realistic to troubleshoot. A plug that fits a header goes on, right or wrong:
// the mistake shows when the PC starts (the power button does nothing, "CPU Fan Error!", a dark power
// light, dead front USB...), like on a real bench. A plug that doesn't fit (the audio plug on a USB 2.0
// header: the blocked hole is elsewhere) won't go on.
//
// Each board's MOUNTS.headers says where its headers are (mm from the CPU socket's centre, seen from
// the front of the board: x right, y up) and how they're labelled on it. A board without one (the AM5
// board has no 12 V RGB header) just doesn't offer it.

/**
 * The board's headers. kind: which plugs can go on it (WIRES.fits). polar: an LED pair, + on the left pin.
 * The front-panel header holds four 2-pin pairs, laid out as the standard front-panel block:
 *   PLED+ PLED-  PWR PWR      (inner row)
 *   HDD+  HDD-   RST RST      (row at the board's edge)
 */
export const HEADERS = {
  pled: { label: "PLED + −", kind: "pin2", panel: true, polar: true, name: "power LED pins (PLED)" },
  pwr: { label: "PWR", kind: "pin2", panel: true, name: "power switch pins (PWR)" },
  hdd: { label: "HDD + −", kind: "pin2", panel: true, polar: true, name: "drive LED pins (HDD)" },
  rst: { label: "RST", kind: "pin2", panel: true, name: "reset switch pins (RST)" },
  aafp: { label: "AAFP", kind: "audio", name: "front audio header (AAFP)" },
  usb2: { label: "USB 2.0", kind: "usb2", name: "USB 2.0 header" },
  u32g1: { label: "U32G1", kind: "usb3", name: "USB 3.0 header (U32G1)" },
  cpu_fan: { label: "CPU_FAN", kind: "fan", name: "CPU_FAN header" },
  cpu_opt: { label: "CPU_OPT", kind: "fan", name: "CPU_OPT header (a second CPU fan)" },
  cha_fan: { label: "CHA_FAN", kind: "fan", name: "chassis fan header (CHA_FAN)" },
  add_gen2: { label: "ADD_GEN2", kind: "argb", name: "5 V addressable RGB header (ADD_GEN2)" },
  rgb: { label: "RGB_HEADER", kind: "rgb", name: "12 V RGB header" },
};

/** The header's label as printed on this board (some number theirs: CHA_FAN2, U32G1_12). */
export const headerLabel = (id, headers) => headers?.[id]?.label ?? HEADERS[id].label;

/**
 * The wires, in the order the drawer lists them.
 *   colors  its wires' colours (the + wire first on an LED plug)
 *   plug    the plug's look (Three/cableStubs.js buildHeaderPlug)
 *   from    where its wire comes from: the case's front panel, the cooler, the case fans
 *   goes    the header it belongs on; fits: the header kinds it physically goes onto
 *   polar   an LED plug: its + mark has to be on the header's + pin
 *   offer   the headers that light up while it's connected: the right one and its look-alikes
 */
export const WIRES = {
  pwr_sw: { colors: ["#16a34a", "#f5f5f4"], label: "POWER SW", plug: "pin2", from: "front", goes: "pwr", fits: ["pin2"], offer: ["pled", "pwr", "hdd", "rst"], group: "panel", look: "2-pin plug marked POWER SW" },
  rst_sw: { colors: ["#2563eb", "#f5f5f4"], label: "RESET SW", plug: "pin2", from: "front", goes: "rst", fits: ["pin2"], offer: ["pled", "pwr", "hdd", "rst"], group: "panel", look: "2-pin plug marked RESET SW" },
  pled: { colors: ["#dc2626", "#f5f5f4"], label: "POWER LED + −", plug: "pin2led", from: "front", goes: "pled", fits: ["pin2"], polar: true, offer: ["pled", "pwr", "hdd", "rst"], group: "panel", look: "2-pin plug marked POWER LED, with a + mark" },
  hdd_led: { colors: ["#f59e0b", "#f5f5f4"], label: "HDD LED + −", plug: "pin2led", from: "front", goes: "hdd", fits: ["pin2"], polar: true, offer: ["pled", "pwr", "hdd", "rst"], group: "panel", look: "2-pin plug marked HDD LED, with a + mark" },
  hd_audio: { colors: ["#141414", "#dc2626", "#f5f5f4", "#16a34a", "#2563eb", "#141414"], label: "HD AUDIO", plug: "audio", from: "front", goes: "aafp", fits: ["audio"], offer: ["aafp", "usb2"], group: "front", look: "9-pin plug marked HD AUDIO" },
  usb3: { colors: ["#1e3a8a"], label: "USB 3.0 (19-pin)", plug: "usb3", from: "front", goes: "u32g1", fits: ["usb3"], offer: ["u32g1", "usb2"], group: "front", look: "wide blue 19-pin plug" },
  cpu_fan: { colors: ["#141414", "#f2c200", "#16a34a", "#2563eb"], label: "CPU cooler fan", plug: "fan4", from: "cooler", goes: "cpu_fan", fits: ["fan"], offer: ["cpu_fan", "cpu_opt", "cha_fan"], group: "fans", look: "4-pin fan plug on the cooler" },
  case_fans: { colors: ["#141414", "#f2c200", "#16a34a", "#2563eb"], label: "Case fans (hub)", plug: "fan4", from: "fans", goes: "cha_fan", fits: ["fan"], offer: ["cpu_fan", "cpu_opt", "cha_fan"], group: "fans", look: "4-pin fan plug from the case fans' hub" },
  argb: { colors: ["#dc2626", "#16a34a", "#f5f5f4"], label: "Fan lights (ARGB 5 V)", plug: "argb3", from: "fans", goes: "add_gen2", fits: ["argb", "rgb"], offer: ["add_gen2", "rgb"], group: "fans", look: "3-pin 5 V lights plug" },
};
export const WIRE_IDS = Object.keys(WIRES);

export const WIRE_GROUPS = [
  { id: "panel", label: "Front panel (2-pin)" },
  { id: "front", label: "Front USB and audio" },
  { id: "fans", label: "Fans and lights" },
];

/** Where each wire's plug goes, in words (the hint while connecting). */
export const WIRE_WHERE = {
  pwr_sw: "the PWR pins of the front-panel header (bottom right)",
  rst_sw: "the RST pins of the front-panel header (bottom right)",
  pled: "the PLED pins of the front-panel header, + on PLED+",
  hdd_led: "the HDD pins of the front-panel header, + on HDD+",
  hd_audio: "AAFP, the front audio header (bottom left)",
  usb3: "U32G1, the 19-pin USB 3.0 header on the right edge",
  cpu_fan: "CPU_FAN, at the top of the board",
  case_fans: "a CHA_FAN (chassis fan) header",
  argb: "ADD_GEN2, the 3-pin 5 V lights header",
};

/** Nothing plugged in (a new build), or a working PC's wires (every plug where it belongs). */
export const wiresStart = (full) =>
  Object.fromEntries(WIRE_IDS.map((id) => [id, full ? { at: WIRES[id].goes, flipped: false } : null]));

/** Plugged in where it belongs, the right way round. */
export const wireRight = (id, w) => !!w && w.at === WIRES[id].goes && !(WIRES[id].polar && w.flipped);

/** Any wire on the board (they hold it in: unplug them before it comes out). */
export const anyWire = (wires) => !!wires && WIRE_IDS.some((id) => wires[id]);

/** Which wire is on a header, if any. */
export const wireOn = (wires, spot) => WIRE_IDS.find((id) => wires?.[id]?.at === spot) ?? null;

/** Null if the wire can be connected now, else { key, msg }. */
export function wireBlock(id, installed) {
  if (!installed.motherboard) return { key: `wire_${id}`, msg: "Set the motherboard in the case first: these wires come from the case." };
  if (id === "cpu_fan" && !installed.cpu_cooler) return { key: `wire_${id}`, msg: "Mount the CPU cooler first: this is its fan's wire." };
  return null;
}

/** Null if the plug goes onto that header, else why not (it doesn't fit, or the header is taken). */
export function wireFitBlock(id, spot, wires) {
  const w = WIRES[id];
  const h = HEADERS[spot];
  const taken = wireOn(wires, spot);
  if (taken && taken !== id) return `The ${WIRES[taken].label} wire is already on the ${h.label} pins.`;
  if (w.fits.includes(h.kind)) return null;
  if (id === "hd_audio" && spot === "usb2") {
    return "It won't go on: the HD AUDIO plug's blocked hole is in a different place from the USB 2.0 header's missing pin. Find the AAFP header.";
  }
  if (id === "usb3") return "It won't go on: the USB 3.0 plug has 19 pins in a wider, keyed block. It only fits the U32G1 header.";
  return `The ${w.label} plug doesn't fit the ${h.label} header.`;
}

/**
 * What a plug on the wrong header (or the wrong way round) does, in words: the hint after it goes on,
 * and the cause behind a symptom at boot. Null when it's right.
 */
export function wireFault(id, w, headers) {
  if (wireRight(id, w)) return null;
  const at = w ? headerLabel(w.at, headers) : null;
  const where = WIRE_WHERE[id];
  if (!w) return `The ${WIRES[id].label} wire isn't plugged in. It goes on ${where}.`;
  if (WIRES[id].polar && w.at === WIRES[id].goes) return `The ${WIRES[id].label} plug is the wrong way round: an LED only lights with + on +.`;
  if (id === "argb" && w.at === "rgb") {
    return "The 3-pin 5 V lights are on the 4-pin 12 V RGB header. They stay dark here; on a real PC, 12 V can burn them out. They go on ADD_GEN2.";
  }
  if (id === "cpu_fan") return `The cooler's fan is on ${at}. The board watches CPU_FAN for the CPU's fan.`;
  if (id === "case_fans" && w.at === "cpu_opt") return "The case fans are on CPU_OPT, which is meant for a second CPU fan. They go on a CHA_FAN header.";
  return `The ${WIRES[id].label} wire is on the ${at} pins. It goes on ${where}.`;
}

/**
 * The wires at power on (evaluateBoot):
 *   off       the power button isn't wired to PWR: nothing happens (a message), or null
 *   fanError  no fan on CPU_FAN: the board stops at "CPU Fan Error!" (the cause), or null
 *   symptoms  what you'd notice on a running PC: [{ text, cause }]
 */
export function bootWires(wires, headers) {
  const fault = (id) => wireFault(id, wires[id], headers);
  const off = wires.pwr_sw?.at === "pwr" ? null : fault("pwr_sw");
  const onCpuFan = wireOn(wires, "cpu_fan");
  const fanError = onCpuFan ? null : fault("cpu_fan");
  const symptoms = [];
  const add = (id, text) => {
    const cause = fault(id);
    if (cause) symptoms.push({ id, text, cause });
  };
  add("pled", "The case's power light stays off.");
  add("hdd_led", "The case's drive light never blinks.");
  add("rst_sw", "The case's reset button does nothing.");
  add("usb3", "The front USB ports don't work.");
  add("hd_audio", "No sound from the front headphone jack.");
  if (onCpuFan === "case_fans") add("cpu_fan", "The cooler's fan doesn't speed up when the CPU gets hot.");
  if (!wires.case_fans) add("case_fans", "The case fans don't spin, so the PC runs hot.");
  else add("case_fans", "The case fans run, but not under the chassis fan settings.");
  add("argb", "The fan lights stay dark.");
  return { off, fanError, symptoms };
}

/** The guide card's wire steps (building), done when each group is right. */
export function wireSteps(wires, installed) {
  const right = (ids) => ids.every((id) => wireRight(id, wires?.[id]));
  return [
    { label: "Connect the front-panel wires: power switch, reset, power LED, HDD LED", done: right(["pwr_sw", "rst_sw", "pled", "hdd_led"]) },
    { label: "Plug in front USB 3.0 and HD AUDIO", done: right(["usb3", "hd_audio"]) },
    { label: "Plug the cooler's fan into CPU_FAN, the case fans into CHA_FAN", done: !!installed.cpu_cooler && right(["cpu_fan", "case_fans"]) },
    { label: "Plug the fan lights (3-pin 5 V) into ADD_GEN2", done: right(["argb"]) },
  ];
}
