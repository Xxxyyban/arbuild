// "Cut-off" power cables (the plug and a few centimetres of wire, cut clean with the copper showing)
// and the motherboard screw. Built with plain three.js (no React), so the same code draws them in
// the lab (CableStub.jsx, Hardware.jsx) and exports them as .glb files.
//
// Sizes are real millimetres, then scaled to the scene (a 305 mm ATX board is 1.467 units long).
// The plug's mating face (the pin holes) points down (-Y); the wires leave from the top (+Y).
//
//   24-pin ATX     2 × 12, Mini-Fit Jr (4.2 mm pitch), to the motherboard
//   8-pin CPU      4 + 4 EPS, to the CPU power header near the socket
//   8-pin PCIe     6 + 2, to the graphics card
//   SATA power     15-pin flat plug, to SATA drives
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { POWER_STRIP } from "../lab/Constants";

export const MM = 1.467 / 305; // scene units per millimetre

/**
 * The same look as one mesh per material, every little box and cylinder baked in place: a 24-pin plug
 * is a hundred meshes otherwise, each its own draw call. Keeps the group's name and transform; the
 * group as it was if its pieces can't be merged.
 */
function merged(group) {
  group.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMaterial = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toGroup, o.matrixWorld));
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(g);
  });
  const out = new THREE.Group();
  out.name = group.name;
  out.position.copy(group.position);
  out.quaternion.copy(group.quaternion);
  out.scale.copy(group.scale);
  for (const [material, parts] of byMaterial) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (!geometry) return group;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

// ATX wire colours
const C = {
  yellow: "#f2c200", // +12 V
  red: "#d42020", // +5 V
  orange: "#f07c00", // +3.3 V
  black: "#141414", // ground
  purple: "#7a3fb0", // +5 V standby
  green: "#1f9d45", // power on
  grey: "#8a8a8a", // power good
  blue: "#2457c5", // -12 V
  white: "#e8e8e8",
};

// pin colours, row by row as seen from the wire side
const ATX24 = [
  ["orange", "orange", "black", "red", "black", "red", "black", "grey", "purple", "yellow", "yellow", "orange"],
  ["orange", "blue", "black", "green", "black", "black", "black", "white", "red", "red", "red", "black"],
];
const EPS4 = [
  ["black", "black"],
  ["yellow", "yellow"],
];
const PCIE6 = [
  ["yellow", "yellow", "yellow"],
  ["black", "black", "black"],
];
const PCIE2 = [["black"], ["black"]];
// a modular PSU's sockets are all 8-pin (2 × 4); the 24-pin cable's PSU end splits over two of them
const PSU8 = [
  ["yellow", "yellow", "yellow", "yellow"],
  ["black", "black", "black", "black"],
];
const PSU_MB = [
  ["orange", "red", "black", "purple"],
  ["green", "black", "grey", "red"],
];

// Mini-Fit Jr cavities are either square or square with cut corners, so a plug fits one way only.
// true = rounded (cut corners) cavity
const keyed = (row, col) => (row + col) % 3 === 0;

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts }));
  return mats.get(key);
}
const HOUSING = () => mat("#1b1b1d", { roughness: 0.75 });
const HOLE = () => mat("#050505", { roughness: 1 });
const PIN = () => mat("#c9c2b0", { metalness: 0.85, roughness: 0.3 });
const COPPER = () => mat("#c87533", { metalness: 0.9, roughness: 0.35 });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/**
 * One Mini-Fit Jr housing with its wires.
 * rows: wire colours per row; returns a group in millimetres with the mating face at y = 0.
 */
function miniFit(rows, { pitch = 4.2, height = 13, wire = 3.0, stub = 40, latch = true, label = null } = {}) {
  const g = new THREE.Group();
  const cols = rows[0].length;
  const w = cols * pitch + 1.6;
  const d = rows.length * pitch + 1.6;

  // housing
  g.add(box(w, height, d, HOUSING(), 0, height / 2, 0));

  // pin cavities on the mating face (bottom), each with the metal terminal inside
  rows.forEach((row, r) => {
    row.forEach((_, c) => {
      const x = (c - (cols - 1) / 2) * pitch;
      const z = (r - (rows.length - 1) / 2) * pitch;
      const hole = keyed(r, c)
        ? new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.4, 8), HOLE())
        : new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.4, 3.3), HOLE());
      if (keyed(r, c)) hole.rotation.y = Math.PI / 8;
      hole.position.set(x, -0.15, z);
      g.add(hole);
      g.add(box(1.1, 0.3, 1.1, PIN(), x, -0.3, z));
    });
  });

  // latch: the clip that snaps over the header's ramp, on one long side
  if (latch) {
    const side = d / 2 + 0.9;
    g.add(box(3.2, 9, 1.4, HOUSING(), 0, height * 0.55, side));
    g.add(box(3.2, 1.6, 2.4, HOUSING(), 0, 2.0, side + 0.5)); // hook
    g.add(box(3.6, 1.2, 2.2, HOUSING(), 0, height - 0.6, side + 0.4)); // press tab
  }

  // wires: straight out of the top, then cut clean with the copper core showing
  rows.forEach((row, r) => {
    row.forEach((color, c) => {
      const x = (c - (cols - 1) / 2) * pitch;
      const z = (r - (rows.length - 1) / 2) * pitch;
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(wire / 2, wire / 2, stub, 12), mat(C[color]));
      ins.position.set(x, height + stub / 2, z);
      g.add(ins);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(wire * 0.27, wire * 0.27, 1.6, 10), COPPER());
      core.position.set(x, height + stub + 0.6, z);
      g.add(core);
    });
  });

  if (label) g.name = label;
  return g;
}

/** The 15-pin SATA power plug: a flat L-shaped housing, five wires out of the back. */
function sata({ stub = 40 } = {}) {
  const g = new THREE.Group();
  const w = 21.3;
  const d = 5.6;
  const h = 10;
  g.add(box(w, h, d, HOUSING(), 0, h / 2, 0));
  // the L-shaped slot on the mating face
  g.add(box(w - 3.2, 0.4, 1.4, HOLE(), 0.6, -0.15, -0.6));
  g.add(box(1.4, 0.4, 3.0, HOLE(), -w / 2 + 2.6, -0.15, 0.2));
  for (let i = 0; i < 15; i++) g.add(box(0.7, 0.3, 0.5, PIN(), -w / 2 + 3.4 + i * 1.27, -0.3, -0.6));
  ["yellow", "black", "red", "black", "orange"].forEach((color, i) => {
    const x = (i - 2) * 3.6;
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, stub, 12), mat(C[color]));
    ins.position.set(x, h + stub / 2, 0);
    g.add(ins);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), COPPER());
    core.position.set(x, h + stub + 0.6, 0);
    g.add(core);
  });
  return g;
}

/** Two plugs side by side (4 + 4 CPU, 6 + 2 PCIe), as they are on real split cables. */
function pair(a, b, gap = 0.6) {
  const g = new THREE.Group();
  const boxA = new THREE.Box3().setFromObject(a);
  const boxB = new THREE.Box3().setFromObject(b);
  const wa = boxA.max.x - boxA.min.x;
  const wb = boxB.max.x - boxB.min.x;
  a.position.x = -(wb + gap) / 2;
  b.position.x = (wa + gap) / 2;
  g.add(a, b);
  return g;
}

export const CABLE_TYPES = {
  atx24: { label: "24-pin ATX power", build: () => miniFit(ATX24) },
  eps8: { label: "8-pin CPU power (4 + 4)", build: () => pair(miniFit(EPS4), miniFit(EPS4)) },
  pcie8: { label: "8-pin PCIe power (6 + 2)", build: () => pair(miniFit(PCIE6), miniFit(PCIE2, { latch: false })) },
  pcie6: { label: "6-pin PCIe power (a 6 + 2 cable's 6)", build: () => miniFit(PCIE6) },
  sata: { label: "SATA power", build: () => sata() },
  psu8: { label: "PSU end, 8-pin (CPU or PCIe cable)", build: () => miniFit(PSU8) },
  psu_mb: { label: "PSU end, 24-pin cable (one of its two plugs)", build: () => miniFit(PSU_MB) },
};

/**
 * The 8-pin PCIe power socket on a graphics card, sized round the pcie8 plug (6 + 2 side by side,
 * 20.6 × 10 mm, clip on its +Z side): a black housing whose floor is at the plug's mating face
 * (y = 0), its walls rising 6 mm round the plug, with a slot in the +Z wall for the clip. Scene units.
 */
export function buildPcieSocket() {
  const g = new THREE.Group();
  const black = mat("#2c2d31", { roughness: 0.6 }); // a shade lighter than the plug, so its edge shows
  const inner = [10.6, 5.3]; // half the cavity: x, z
  const wall = 1.2;
  const top = 6;
  const base = -3; // sunk a little into the card's edge
  const h = top - base;
  const ox = inner[0] + wall;
  const oz = inner[1] + wall;
  g.add(box(ox * 2, 1, oz * 2, black, 0, base + 0.5, 0)); // floor under the plug
  g.add(box(wall, h, oz * 2, black, -ox + wall / 2, base + h / 2, 0));
  g.add(box(wall, h, oz * 2, black, ox - wall / 2, base + h / 2, 0));
  g.add(box(ox * 2, h, wall, black, 0, base + h / 2, -oz + wall / 2));
  // the clip side: a slot over the 6-pin half (x -5..-1.4) where the clip hooks over the ramp
  const slot = [-5, -1.4];
  g.add(box(slot[0] + ox, h, wall, black, (-ox + slot[0]) / 2, base + h / 2, oz - wall / 2));
  g.add(box(ox - slot[1], h, wall, black, (slot[1] + ox) / 2, base + h / 2, oz - wall / 2));
  g.add(box(slot[1] - slot[0], 1.6, 1.4, black, (slot[0] + slot[1]) / 2, 2.4, oz + 0.2)); // the ramp
  g.scale.setScalar(MM);
  return merged(g);
}

/* ---------- plugs for the board's small headers (lab/Wires.js) ---------- */
// 2.54 mm pin headers, mating face down (-Y) at y = 0, wires up (+Y), centred on the pins they cover,
// the header's long way along X. Each `kind` is one plug look; `colors` are its wires' colours.
const HEADER_PLUGS = {
  // a front-panel 2-pin plug: power switch, reset
  pin2: { size: [5.08, 12, 2.54], wires: 2 },
  // a front-panel LED plug: the same, with a + mark over the + pin (the -X end)
  pin2led: { size: [5.08, 12, 2.54], wires: 2, plus: true },
  // HD AUDIO: 2 × 5, one hole blocked (the key)
  audio: { size: [12.7, 12, 5.08], wires: 6, label: true },
  // USB 3.0: 2 × 10 at 2 mm in a wide blue housing with a pull tab, one thick round cable
  usb3: { size: [21, 9.5, 9], color: "#1d4ed8", cable: 5.2, tab: true },
  // a 4-pin fan plug with the ridge that slides behind the header's wall
  fan4: { size: [10.2, 6.5, 5], wires: 4, ridge: true },
  // a 3-pin 5 V lights plug: 4 places, one blocked
  argb3: { size: [10.2, 7.5, 2.6], color: "#e5e7eb", wires: 3 },
};

/** A small header plug with a stub of its wires, in scene units (see HEADER_PLUGS). */
export function buildHeaderPlug(kind, colors = []) {
  const spec = HEADER_PLUGS[kind];
  if (!spec) throw new Error(`Unknown header plug: ${kind}`);
  const [w, h, d] = spec.size;
  const g = new THREE.Group();
  g.name = `plug_${kind}`;
  const body = spec.color ? mat(spec.color, { roughness: 0.6 }) : HOUSING();
  g.add(box(w, h, d, body, 0, h / 2, 0));
  g.add(box(w - 0.8, 0.3, d - 0.8, HOLE(), 0, -0.1, 0)); // the holes' face
  if (spec.plus) {
    // a white triangle on the + end of the top, and a + printed on the side
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.4, 3), mat("#f5f5f4"));
    tri.position.set(-w / 4, h + 0.2, 0);
    g.add(tri);
    g.add(box(1.6, 0.35, 0.2, mat("#f5f5f4"), -w / 4, h * 0.6, d / 2 + 0.05));
    g.add(box(0.35, 1.6, 0.2, mat("#f5f5f4"), -w / 4, h * 0.6, d / 2 + 0.05));
  }
  if (spec.label) g.add(box(w * 0.7, 1.2, 0.2, mat("#d4d4d8"), 0, h * 0.62, d / 2 + 0.05)); // the printed name
  if (spec.ridge) g.add(box(w * 0.8, h * 0.7, 0.9, body, 0, h * 0.4, d / 2 + 0.45));
  if (spec.tab) g.add(box(w * 0.5, 4, 1.4, body, 0, h + 2, 0));
  const stub = 22;
  if (spec.cable) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(spec.cable / 2, spec.cable / 2, stub, 14), mat(colors[0] || "#1e3a8a"));
    c.position.set(w * 0.25, h + stub / 2, 0);
    g.add(c);
  } else {
    for (let i = 0; i < spec.wires; i++) {
      const x = spec.wires === 1 ? 0 : (i / (spec.wires - 1) - 0.5) * (w - 2.2);
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, stub, 8), mat(colors[i % colors.length] || C.black));
      wire.position.set(x, h + stub / 2, 0);
      g.add(wire);
    }
  }
  g.scale.setScalar(MM);
  return merged(g);
}

/** How far a header plug's wires reach out of the board (scene units): where its run starts. */
export const headerPlugReach = (kind) => ((HEADER_PLUGS[kind]?.size[1] ?? 10) + 22) * MM;

/** A cable stub as a three.js group in scene units, plug face down at y = 0. */
export function buildCableStub(type) {
  const spec = CABLE_TYPES[type];
  if (!spec) throw new Error(`Unknown cable type: ${type}`);
  const inner = spec.build();
  const g = new THREE.Group();
  g.name = `cable_${type}`;
  inner.scale.setScalar(MM);
  g.add(inner);
  return merged(g);
}

/* ---------- the mains power cord and the power strip (Three/PowerCord.jsx) ---------- */
// Real sizes again. Each plug: what goes in points down (-Y), its cord leaves up (+Y), and y = 0 is its
// shoulder, the place that meets what it plugs into.

export const CORD_RADIUS = 3.6 * MM; // a 7 mm mains cord
const SHOULDER_TO_CORD = 46; // the plug's body and its ribbed sleeve, mm
export const PLUG_REACH_MAINS = SHOULDER_TO_CORD * MM; // where the cord leaves either plug
const SHROUD = 6.2; // how deep an IEC plug goes into the PSU's inlet, mm (the shallowest inlet is 7.4 mm)
export const STRIP_SIZE = { w: 232, d: 58, h: 34 };
const STRIP_SOCKETS = [78, 20, -38]; // each socket's x, mm from the strip's middle, the case's end first
const STRIP_SWITCH = -88;
/** Where the strip's first socket is, on the bench: the wall plug's shoulder when it's in. */
export const STRIP_SOCKET = [
  POWER_STRIP.position[0] + STRIP_SOCKETS[0] * MM,
  POWER_STRIP.position[1] + (STRIP_SIZE.h + 0.5) * MM,
  POWER_STRIP.position[2],
];

/** An outline in the XZ plane ([x, z], mm) standing from y0 to y1, its top and bottom edges softened. */
function prism(outline, y0, y1, material, bevel = 0) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0 - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0 + bevel, 0);
  // merged() needs every piece indexed, as boxes and cylinders are
  geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
  return new THREE.Mesh(geometry, material);
}

/** The outline of a rounded rectangle, w × d mm, for prism. */
function roundedRect(w, d, r) {
  const out = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], q) => {
    for (let i = 0; i <= 4; i++) {
      const a = ((q + i / 4) * Math.PI) / 2;
      out.push([sx * (w / 2 - r) + r * Math.cos(a), sz * (d / 2 - r) + r * Math.sin(a)]);
    }
  });
  return out;
}

/** The ribbed sleeve where a cord leaves a moulded plug: from y0 to y1, tapering from radius r0 to r1. */
function strainRelief(g, y0, y1, r0, r1, material) {
  const RIBS = 5;
  const step = (y1 - y0) / RIBS;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 0.86, r0 * 0.86, y1 - y0 + 2, 14), material);
  core.position.y = (y0 + y1) / 2 + 1;
  g.add(core);
  for (let i = 0; i < RIBS; i++) {
    const r = r0 + ((r1 - r0) * i) / (RIBS - 1);
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(r, r, step * 0.6, 16), material);
    rib.position.y = y0 + step * (i + 0.5);
    g.add(rib);
  }
}

/**
 * The cord's PSU end, an IEC C13 plug, in scene units. What goes into the inlet has its corners cut on
 * one side (+Z), so it only fits one way; its three holes are in the end of it.
 */
export function buildIecPlug() {
  const g = new THREE.Group();
  g.name = "plug_iec";
  const black = mat("#17181b", { roughness: 0.62 });
  const groove = mat("#0d0e10", { roughness: 0.8 });
  const [W, D, CUT] = [22, 15.4, 4];
  g.add(prism([[W / 2, -D / 2], [W / 2, D / 2 - CUT], [W / 2 - CUT, D / 2], [-W / 2 + CUT, D / 2], [-W / 2, D / 2 - CUT], [-W / 2, -D / 2]], -SHROUD, 0, black));
  g.add(box(2.2, 0.3, 4.8, HOLE(), -6.6, -SHROUD - 0.1, -2.8));
  g.add(box(2.2, 0.3, 4.8, HOLE(), 6.6, -SHROUD - 0.1, -2.8));
  g.add(box(2.2, 0.3, 4.8, HOLE(), 0, -SHROUD - 0.1, 3.2));
  // the grip: a broad shoulder, narrowing toward the cord, with ribs for the fingers
  g.add(prism(roundedRect(31, 23, 4), 0, 14, black, 1.2));
  g.add(prism(roundedRect(26, 19, 4), 13, 25, black, 1.2));
  for (let i = 0; i < 3; i++) {
    g.add(box(25, 0.8, 0.5, groove, 0, 4 + i * 3.2, 11.6));
    g.add(box(25, 0.8, 0.5, groove, 0, 4 + i * 3.2, -11.6));
  }
  strainRelief(g, 25, 44, 6.4, 4.4, black);
  g.scale.setScalar(MM);
  return merged(g);
}

/** The cord's wall plug, in scene units: two flat brass blades and a round earth pin (Philippine and US sockets). */
export function buildMainsPlug() {
  const g = new THREE.Group();
  g.name = "plug_mains";
  const black = mat("#17181b", { roughness: 0.62 });
  const brass = mat("#d8bd7f", { metalness: 0.85, roughness: 0.35 });
  g.add(prism(roundedRect(30, 30, 7), 0, 20, black, 1.6));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 13.5, 9, 20), black);
  neck.position.y = 24.5;
  g.add(neck);
  strainRelief(g, 28, 44, 6.4, 4.4, black);
  g.add(box(1.5, 16, 6.3, brass, -6.35, -8, -3));
  g.add(box(1.5, 16, 6.3, brass, 6.35, -8, -3));
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 17, 14), brass);
  pin.position.set(0, -8.5, 9);
  g.add(pin);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), brass);
  tip.position.set(0, -17, 9);
  g.add(tip);
  g.scale.setScalar(MM);
  return merged(g);
}

/**
 * A power strip, in scene units, standing on the bench at y = 0, long way along X: three sockets for the
 * wall plug (their middle at the plug's origin: blades 3 mm behind, the earth hole 9 mm in front) and a
 * lit rocker switch at the far end.
 */
export function buildPowerStrip() {
  const g = new THREE.Group();
  g.name = "power_strip";
  const { w, d, h } = STRIP_SIZE;
  // greyer than they look: the lab's lights are bright, and paler ones wash out to plain white
  const shell = mat("#a9adb6", { roughness: 0.62 });
  const plate = mat("#7d828d", { roughness: 0.7 });
  g.add(prism(roundedRect(w, d, 10), 0, h, shell, 2));
  STRIP_SOCKETS.forEach((x) => {
    const p = prism(roundedRect(42, 42, 8), h - 0.2, h + 0.5, plate);
    p.position.x = x;
    g.add(p);
    g.add(box(1.9, 0.3, 7.4, HOLE(), x - 6.35, h + 0.55, -3));
    g.add(box(1.9, 0.3, 7.4, HOLE(), x + 6.35, h + 0.55, -3));
    const earth = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.3, 14), HOLE());
    earth.position.set(x, h + 0.55, 9);
    g.add(earth);
  });
  g.add(box(19, 1, 31, mat("#2a2b2f", { roughness: 0.7 }), STRIP_SWITCH, h + 0.4, 0));
  g.add(box(15, 3, 26, mat("#b91c1c", { emissive: "#991b1b", emissiveIntensity: 0.55, roughness: 0.4 }), STRIP_SWITCH, h + 2.2, 0));
  g.scale.setScalar(MM);
  return merged(g);
}

/* ---------- motherboard screw ---------- */

/**
 * A 6-32 motherboard screw (silver, Phillips head), in scene units.
 * The underside of the head is at y = 0: the head is above, the threaded shaft below, `shank` mm long.
 */
export function buildScrew(shank = 6) {
  const g = new THREE.Group();
  g.name = "screw";
  const steel = mat("#c8ccd2", { metalness: 0.9, roughness: 0.3 });
  const dark = mat("#3a3d42", { metalness: 0.6, roughness: 0.5 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.0, 2.4, 20), steel);
  head.position.y = 1.2;
  g.add(head);
  // Phillips cross
  g.add(box(3.4, 0.6, 0.7, dark, 0, 2.2, 0));
  g.add(box(0.7, 0.6, 3.4, dark, 0, 2.2, 0));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.5, shank, 12), steel);
  shaft.position.y = -shank / 2;
  g.add(shaft);
  // a few thread rings
  for (let i = 0; i < 4 && 1.2 + i * 1.3 < shank - 0.4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.25, 6, 16), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2 - i * 1.3;
    g.add(ring);
  }
  g.scale.setScalar(MM);
  return merged(g);
}
