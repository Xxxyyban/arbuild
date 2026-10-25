// The PSU cables' and the case's wires: their plugs, labels and the routes their see-through guides take
// inside the case (case space: +x the case front, +y up, +z toward the glass; the motherboard tray at
// z -0.44). Used by pages/BuildLab.jsx.
import * as THREE from "three";
import { MM } from "../Three/cableStubs";
import { PSU_TARGET } from "./Constants";
import { WIRES } from "./Wires";

// Cables are routed like a tidy build (case space): from the PSU in the shroud, back into the space
// behind the motherboard tray, along the back of it, and out through the cut-out nearest the header:
// the rubber grommets right of the board, or the cut-out above its top-left corner. Behind the tray
// they are hidden, so only each cable's last stretch shows inside the case. Measured on the case model.
export const TRAY_BACK = -0.47; // behind the motherboard tray
export const TRAY_OUT = -0.38; // just out of a cut-out, in front of the tray
export const CABLE_EXIT = {
  atx24: { x: 0.335, y: null }, // the upper grommet, level with the 24-pin header
  eps8: { x: -0.51, y: 2.08 }, // the cut-out above the board's top-left corner
  pcie: { x: 0.355, y: 0.9 }, // the lower grommet, under the graphics card
};

// Cables, case space. Every plug goes in along -Z (into the board or card); its wires leave along +Z.
export const CABLE_IDS = ["atx24", "eps8", "pcie"];
export const STUB_TYPE = { atx24: "atx24", eps8: "eps8", pcie: "pcie8" };
export const PORT_ROT = { atx24: [Math.PI / 2, Math.PI / 2, 0], eps8: [Math.PI / 2, 0, 0], pcie: [Math.PI / 2, 0, 0] };
export const PORT_LATCH = { atx24: [1, 0, 0], eps8: [0, -1, 0], pcie: [0, -1, 0] }; // which side the clip hooks over
export const GHOST_COLOR = { atx24: "#f2a33a", eps8: "#f2d24a", pcie: "#f2d24a" }; // see-through guide wires
export const PORT_LABEL = { atx24: "24-pin header", eps8: "8-pin CPU header", pcie: "GPU power socket" };
// a fixed PSU's cables: the marking on each plug, and how to tell them apart
export const FIXED_MARK = { atx24: "MB 24-pin", eps8: "CPU 4+4", pcie: "PCI-E 6+2" };
export const PLUG_LOOK = {
  atx24: "widest plug, 24 pins in 2 rows of 12",
  eps8: "8-pin plug marked CPU, which splits 4 + 4",
  pcie: "8-pin plug marked PCI-E, which splits 6 + 2",
};
export const PORT_WHERE = {
  atx24: "the long 24-pin header on the right edge of the board",
  eps8: "the 8-pin header at the top-left, next to the CPU",
  pcie: "the power socket on the top edge of the graphics card",
};
export const PSU_FIXED_OUT = [-0.3, 0.3, 0.1]; // where a non-modular PSU's cables come out (case space)

// The case's and the fans' wires (lab/Wires.js), case space. A header plug sits on its pins' plastic
// base, about 2.5 mm off the board; the see-through guide shows where its wire comes from.
export const HEADER_LIFT = 2.5 * MM;
export const WIRE_GHOST = { panel: "#cbd5e1", front: "#60a5fa", fans: "#a78bfa" };
export const FRONT_IO = [0.98, 2.1, 0.02]; // the case's front panel: power and reset buttons, LEDs, USB, audio
export const FRONT_FANS = [0.95, 1.0, 0.05]; // the front fans' hub

/** A wire's path from where it comes from to its plug's top (b), behind the tray and out of a cut-out. */
export function wireRoute(id, b, cooler) {
  const from = WIRES[id].from;
  if (from === "cooler") return [cooler, [(cooler[0] + b[0]) / 2, (cooler[1] + b[1]) / 2 + 0.02, b[2] + 0.06], b];
  const start = from === "front" ? FRONT_IO : FRONT_FANS;
  const behind = [[start[0] - 0.15, start[1] - 0.05, TRAY_BACK + 0.05], [0.62, Math.min(start[1] - 0.1, Math.max(b[1], 0.45)), TRAY_BACK]];
  // a header on the right edge or up top: out of the grommets right of the board, level with it
  if (b[1] > 1.1) return [start, ...behind, [0.62, b[1], TRAY_BACK], [0.345, b[1], TRAY_OUT], [b[0] + 0.05, b[1], b[2] - 0.01], b];
  // one along the bottom edge: under the board, up out of the PSU cover's cut-out
  return [start, ...behind, [b[0], 0.42, TRAY_BACK], [b[0], 0.5, -0.3], [b[0], b[1] - 0.05, b[2] - 0.01], b];
}

/** A cable's path from its PSU end (a) to the end of its plug's wires (b), through its cut-out. */
export function cableRoute(c, a, b) {
  const e = CABLE_EXIT[c];
  const ey = e.y ?? b[1];
  const fromPsu = [a, [a[0] + 0.06, a[1] - 0.05, a[2] - 0.15], [e.x, 0.4, TRAY_BACK], [e.x, ey, TRAY_BACK], [e.x, ey, TRAY_OUT]];
  let toPlug;
  if (c === "pcie") {
    // forward under the card, up past its front end, and along its top edge to the plug
    toPlug = [[e.x + 0.03, ey, -0.22], [0.39, ey + 0.06, 0.06], [0.37, b[1] + 0.03, b[2] - 0.06], [b[0] + 0.12, b[1] + 0.04, b[2] + 0.03]];
  } else if (c === "eps8") {
    // down from the cut-out to the header just below it
    toPlug = [[e.x - 0.02, ey + 0.01, -0.3], [b[0] + 0.01, b[1] + 0.07, b[2] - 0.04]];
  } else {
    // a short bend out of the grommet into the header beside it
    toPlug = [[e.x + 0.03, ey, -0.26], [b[0] + 0.08, b[1], b[2] - 0.02]];
  }
  return [...fromPsu, ...toPlug, b];
}
export const PSU_ROT = new THREE.Euler(...PSU_TARGET.rotation);
/** A point in the PSU's own frame, in case space (the PSU sits at PSU_TARGET when installed). */
export const psuToCase = ([x, y, z]) => {
  const v = new THREE.Vector3(x, y, z).applyEuler(PSU_ROT);
  return [PSU_TARGET.position[0] + v.x, PSU_TARGET.position[1] + v.y, PSU_TARGET.position[2] + v.z];
};
