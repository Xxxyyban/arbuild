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

export const MM = 1.467 / 305; // scene units per millimetre

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
  sata: { label: "SATA power", build: () => sata() },
  psu8: { label: "PSU end, 8-pin (CPU or PCIe cable)", build: () => miniFit(PSU8) },
  psu_mb: { label: "PSU end, 24-pin cable (one of its two plugs)", build: () => miniFit(PSU_MB) },
};

/** A cable stub as a three.js group in scene units, plug face down at y = 0. */
export function buildCableStub(type) {
  const spec = CABLE_TYPES[type];
  if (!spec) throw new Error(`Unknown cable type: ${type}`);
  const inner = spec.build();
  const g = new THREE.Group();
  g.name = `cable_${type}`;
  inner.scale.setScalar(MM);
  g.add(inner);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/* ---------- motherboard screw ---------- */

/**
 * A 6-32 motherboard screw (silver, Phillips head), in scene units.
 * The underside of the head is at y = 0: the head is above, the threaded shaft below.
 */
export function buildScrew() {
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
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.5, 6, 12), steel);
  shaft.position.y = -3;
  g.add(shaft);
  // a few thread rings
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.25, 6, 16), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.2 - i * 1.3;
    g.add(ring);
  }
  g.scale.setScalar(MM);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
