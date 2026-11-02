// The PSU cables' and the case's wires: their plugs, labels and the routes their see-through guides take
// inside the case (case space: +x the case front, +y up, +z toward the glass; the motherboard tray at
// z -0.44). Used by pages/BuildLab.jsx.
import * as THREE from "three";
import { MM } from "../Three/cableStubs";
import { PSU_TARGET } from "./Constants";
import { WIRES } from "./Wires";

// Cables are routed like a tidy build (case space): from the PSU under its cover, into the space behind
// the motherboard tray, along the back of it, and out through the opening nearest the header. Behind the
// tray and under the cover they are hidden, so only each cable's last stretch shows inside the case.
// Measured on the case model:
//   The rear panel's inside face is at z -0.50. Behind the main part of the tray (x up to 0.3) there are
//   only 11 mm, from z -0.495 to -0.445; beside the board is a wide channel (x 0.37 to 0.78, back to z -0.36).
//   The tray stops above y 0.55, and the space behind it runs down into the room under the PSU cover.
//   The openings: two rubber grommets in the sloped wall right of the board (y 0.8 to 1.1, y 1.3 to 1.65);
//   a slot over the tray's top edge (y 2.15 to 2.19); two cut-outs in the PSU cover right under the board
//   (x -0.42 to -0.27, x 0.145 to 0.265, both at z -0.39); and past the tray's front edge (x 0.8, z -0.4).
const TRAY_GAP = -0.476; // the middle of the 11 mm behind the tray
const TRAY_RIGHT = 0.34; // where the 11 mm opens into the wide channel
const CHANNEL_Z = -0.44; // in the wide channel
const CHANNEL_X = 0.76; // the case's wires' side of it (the power cables take the side nearest the board)
const GROMMET_X = 0.352; // just past the board's right edge
const GROMMET_Z = -0.365; // just out of the sloped wall
const TOP_SLOT_Y = 2.168;
const UNDER_COVER_Y = 0.47; // under the PSU cover (its top is at y 0.52), and below the tray
const UNDER_BOARD_Y = 0.535; // lying on the cover, under the board's bottom edge (y 0.61)
const COVER_CUT_Z = -0.39;
const FRONT_SLOT_X = 0.81;
const FRONT_SLOT_Z = -0.4;
const GLASS_ROOM = 0.472; // nothing's centre further toward the side glass (at z 0.5) than this
/** Which grommet a cable at height y comes out of, and how high in it. */
const grommetY = (y) => (y < 1.2 ? Math.min(1.07, Math.max(0.83, y)) : Math.min(1.6, Math.max(1.34, y)));

// Cables, case space. Every plug goes in along -Z (into the board or card); its wires leave along +Z.
export const CABLE_IDS = ["atx24", "eps8", "pcie", "pcie6"];
export const STUB_TYPE = { atx24: "atx24", eps8: "eps8", pcie: "pcie8", pcie6: "pcie6" };
export const PORT_ROT = { atx24: [Math.PI / 2, Math.PI / 2, 0], eps8: [Math.PI / 2, 0, 0], pcie: [Math.PI / 2, 0, 0], pcie6: [Math.PI / 2, 0, 0] };
export const PORT_LATCH = { atx24: [1, 0, 0], eps8: [0, -1, 0], pcie: [0, -1, 0], pcie6: [0, -1, 0] }; // which side the clip hooks over
export const GHOST_COLOR = { atx24: "#f2a33a", eps8: "#f2d24a", pcie: "#f2d24a", pcie6: "#f2d24a" }; // see-through guide wires
export const PORT_LABEL = { atx24: "24-pin header", eps8: "8-pin CPU header", pcie: "GPU power socket (8-pin)", pcie6: "GPU power socket (6-pin)" };
// a fixed PSU's cables: the marking on each plug, and how to tell them apart
export const FIXED_MARK = { atx24: "MB 24-pin", eps8: "CPU 4+4", pcie: "PCI-E 6+2", pcie6: "PCI-E 6" };
export const PLUG_LOOK = {
  atx24: "widest plug, 24 pins in 2 rows of 12",
  eps8: "8-pin plug marked CPU, which splits 4 + 4",
  pcie: "8-pin plug marked PCI-E, which splits 6 + 2",
  pcie6: "6-pin plug marked PCI-E (2 rows of 3)",
};
export const PORT_WHERE = {
  atx24: "the long 24-pin header on the right edge of the board",
  eps8: "the 8-pin header at the top-left, next to the CPU",
  pcie: "the 8-pin power socket on the top edge of the graphics card",
  pcie6: "the 6-pin power socket beside the 8-pin one, toward the end of the card",
};
export const PSU_FIXED_OUT = [-0.3, 0.3, 0.1]; // where a non-modular PSU's cables come out (case space)

// The case's and the fans' wires (lab/Wires.js), case space. A header plug sits on its pins' plastic
// base, about 2.5 mm off the board; the see-through guide shows where its wire comes from.
export const HEADER_LIFT = 2.5 * MM;
export const WIRE_GHOST = { panel: "#cbd5e1", front: "#60a5fa", fans: "#a78bfa" };
export const FRONT_IO = [0.98, 2.1, 0.02]; // the case's front panel: power and reset buttons, LEDs, USB, audio
const FRONT_BOARD = [FRONT_SLOT_X, 2.125, FRONT_SLOT_Z]; // where its wires come out, under the block they're in at the top of the front
const FRONT_FANS = [0.845, 1.0, -0.335]; // where the fans' wires leave the middle front fan's frame

/**
 * The points of a route with these corners: straight runs and rounded bends. The curve drawn through a
 * route is a spline, and a spline through points far apart swings wide of them, out through the case's
 * panels. With points close together on both sides of each bend, the runs between bends stay straight.
 */
function bends(corners, radius = 0.045) {
  const points = [corners[0]];
  const along = (c, to, d) => [0, 1, 2].map((k) => c[k] + to[k] * d);
  for (let i = 1; i < corners.length - 1; i += 1) {
    const c = corners[i];
    const dirs = [corners[i - 1], corners[i + 1]].map((p) => {
      const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const len = Math.hypot(...d) || 1;
      return { to: d.map((v) => v / len), len };
    });
    const [back, on] = dirs;
    const r = Math.min(radius, back.len * 0.4, on.len * 0.4);
    if (back.len > 5 * r) points.push(along(c, back.to, 2 * r));
    points.push(along(c, back.to, r));
    points.push([0, 1, 2].map((k) => c[k] + (back.to[k] + on.to[k]) * r * 0.27));
    points.push(along(c, on.to, r));
    if (on.len > 5 * r) points.push(along(c, on.to, 2 * r));
  }
  points.push(corners[corners.length - 1]);
  return points;
}

// The case's wires, each in its own place across the wide channel.
const WIRE_LANE = { pwr_sw: 0, rst_sw: 1, pled: 2, hdd_led: 3, hd_audio: 4, usb3: 5, case_fans: 6, argb: 7 };

/** Where the CPU fan's wire leaves the cooler: its rim, on the side toward the board's top edge. */
export const coolerWireStart = (sock, pcbFront) => [sock[0] + 0.1, sock[1] + 0.18, pcbFront + 0.19];

/** A wire's path from where it comes from to its plug's top (b), behind the tray and out of an opening. */
export function wireRoute(id, b, cooler) {
  const from = WIRES[id].from;
  if (from === "cooler") {
    return [cooler, [(cooler[0] + b[0]) / 2, (cooler[1] + b[1]) / 2 + 0.02, b[2] + 0.06], [b[0], b[1] - 0.015, b[2] + 0.03], b];
  }
  const lane = WIRE_LANE[id] ?? 0;
  const x = CHANNEL_X - lane * 0.014;
  // out from under the case's front panel board, or off the middle front fan's frame, past the tray's front edge
  const start = from === "front"
    ? [FRONT_BOARD, [x, FRONT_BOARD[1] - 0.07, CHANNEL_Z]]
    : [FRONT_FANS, [FRONT_SLOT_X, FRONT_FANS[1] - 0.02, FRONT_SLOT_Z], [x, FRONT_FANS[1] - 0.05, CHANNEL_Z]];
  const plug = [b[0], b[1], b[2] + 0.035]; // its wires leave the plug straight, along +z

  // up top: along behind the tray and out of the slot over it
  if (b[1] > 1.85) {
    return bends([...start, [TRAY_RIGHT, TOP_SLOT_Y, TRAY_GAP], [b[0], TOP_SLOT_Y, TRAY_GAP], [b[0], TOP_SLOT_Y - 0.03, -0.38], [b[0], b[1] + 0.03, -0.29], [b[0], b[1] + 0.03, plug[2]], b], 0.03);
  }
  // on the board's right edge: out of the upper grommet (or the lower one, if it's nearer)
  if (b[1] > 1.1) {
    const y = grommetY(b[1]);
    return bends([...start, [x, y, CHANNEL_Z], [0.39, y, CHANNEL_Z + 0.02], [GROMMET_X, y, GROMMET_Z], [GROMMET_X, b[1], plug[2]], plug, b], 0.03);
  }
  // along the bottom edge: under the PSU cover, up its cut-out, and forward under the board
  const side = lane % 2 ? 0.006 : -0.006; // a pair on the same pins' column run side by side
  const cut = b[0] < -0.05 ? Math.min(-0.29, Math.max(-0.4, b[0])) : Math.min(0.25, Math.max(0.16, b[0]));
  return bends([
    ...start,
    [x, UNDER_COVER_Y, CHANNEL_Z],
    [cut + side, UNDER_COVER_Y, COVER_CUT_Z],
    [cut + side, UNDER_BOARD_Y, COVER_CUT_Z],
    [b[0] + side, UNDER_BOARD_Y, COVER_CUT_Z + 0.05],
    [b[0] + side, UNDER_BOARD_Y, plug[2]],
    [b[0], b[1], plug[2]],
    b,
  ], 0.03);
}

/** A cable's path from its PSU end (a) to the end of its plug's wires (b), through its opening. */
export function cableRoute(c, a, b) {
  const plug = [b[0], b[1], b[2] + 0.04]; // its wires leave the plug straight, along +z
  const leave = [a, [a[0] + 0.07, a[1], a[2]]]; // and out of the PSU's socket
  if (c === "eps8") {
    // behind the tray right up to its top, over it, and back down to the header just below
    const x = -0.64;
    const over = [x, b[1] + 0.04, -0.27]; // under the top fans
    return bends([...leave, [0, 0.36, -0.33], [-0.15, UNDER_COVER_Y, TRAY_GAP], [x, UNDER_COVER_Y, TRAY_GAP], [x, TOP_SLOT_Y, TRAY_GAP], [x, TOP_SLOT_Y - 0.03, -0.38], over, [x, over[1], plug[2]], plug, b]);
  }
  if (c === "atx24") {
    // up the channel, out of the upper grommet, along the board's edge and into the end of the plug
    const y = grommetY(b[1]);
    return bends([...leave, [0.4, 0.3, -0.28], [0.43, UNDER_COVER_Y, CHANNEL_Z], [0.43, y, CHANNEL_Z], [GROMMET_X, y, GROMMET_Z], [GROMMET_X, b[1], plug[2]], plug, b]);
  }
  // the graphics card's: out of the lower grommet, forward under the card, up past its end, along its top edge
  const lane = c === "pcie6" ? 1 : 0;
  const x = 0.5 + lane * 0.04;
  const y = 0.97 - lane * 0.04;
  const top = Math.min(plug[2], GLASS_ROOM);
  return bends([
    ...leave,
    [x - 0.04, 0.31, -0.25],
    [x, UNDER_COVER_Y, CHANNEL_Z],
    [x, y, CHANNEL_Z],
    [GROMMET_X, y, GROMMET_Z],
    [GROMMET_X, y, 0.02],
    [GROMMET_X - 0.02, b[1] + 0.06, 0.28],
    [b[0] + 0.14, b[1] + 0.04, top],
    [b[0], b[1], top],
    b,
  ]);
}
export const PSU_ROT = new THREE.Euler(...PSU_TARGET.rotation);
/** A point in the PSU's own frame, in case space (the PSU sits at PSU_TARGET when installed). */
export const psuToCase = ([x, y, z]) => {
  const v = new THREE.Vector3(x, y, z).applyEuler(PSU_ROT);
  return [PSU_TARGET.position[0] + v.x, PSU_TARGET.position[1] + v.y, PSU_TARGET.position[2] + v.z];
};
