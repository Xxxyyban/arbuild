// Shared layout constants and geometry helpers for the merged BuildLab.
// Values are copied from Assemble.jsx / Disassemble.jsx (they were identical).
import * as THREE from "three";

/* ---------- parts ---------- */
export const ALL_PARTS = ["gpu", "cpu_cooler", "cpu", "ram1", "ram2", "storage", "motherboard", "psu"];

export const PART_LABEL = {
  gpu: "GPU",
  cpu_cooler: "CPU Cooler",
  cpu: "CPU",
  ram1: "RAM 1",
  ram2: "RAM 2",
  storage: "SSD",
  motherboard: "Motherboard",
  psu: "PSU",
};

/* ---------- bench ---------- */
export const TABLE = {
  center: [0, 0.0, 0],
  size: [5.4, 7.4],
  thickness: 0.08,
  legHeight: 1.2,
  color: "#47290a",
  matColor: "#2e1408",
};

// Where each part waits on the bench: PSU and SSD on the left, the board in the middle, the
// small parts in a column on the right, the graphics card behind them.
export const TRAY_OFFSETS = {
  motherboard: [-0.2, 0.15, 2.9],
  cpu: [0.95, 0.01, 2.2],
  ram1: [1.95, 0.02, 2.3],
  ram2: [1.95, 0.02, 2.75],
  psu: [-1.75, 0.05, 2.0],
  gpu: [1.55, 0.15, 1.35],
  cpu_cooler: [0.95, 0.01, 3.1],
  storage: [-1.75, 0.03, 3.15],
  m2cover: [-1.74, 0.01, 3.42], // the board's M.2 cover, once it is lifted off (its middle)
  socketcap: [0.95, 0.01, 2.62], // the AM5 socket's plastic cap once it pops off, between the CPU and the cooler
};

// [x, y, z] added on top of the tray position for the part's name tag. Default is [0, 0.3, 0].
export const LABEL_OFFSETS = { psu: [0, 0.62, 0], motherboard: [0, 0.3, -0.75], gpu: [0, 0.5, 0], cpu_cooler: [0, 0.4, 0] };

export function trayPosition(name) {
  const o = TRAY_OFFSETS[name];
  return [TABLE.center[0] + o[0], TABLE.center[1] + o[1], TABLE.center[2] + o[2]];
}

/* ---------- rotations / scales ---------- */
export const MOBO_LYING_ROTATION = [-Math.PI / 2, Math.PI, 0];
export const MOBO_MOUNTED_ROTATION = [0, Math.PI, 0];
export const MOBO_SCALE = [0.9999999, 1.12, 1.25];
export const RAM_LYING_ROTATION = [0, 0, Math.PI / 2]; // flat on the bench, label up
export const CPU_TRAY_ROTATION = [0, Math.PI, 0];
export const PSU_TRAY_ROTATION = [0, Math.PI, 0]; // modular sockets facing the student
export const GPU_TRAY_ROTATION = [0, Math.PI, 0];

export const COOLER_TRAY_YAW = 0;
export const COOLER_TRAY_LIFT = 0;
export const COOLER_SPIN_X = Math.PI / 2;
export const COOLER_SPIN_Y = (90 * Math.PI) / 180;
export const COOLER_SPIN_Z = Math.PI;

export const GPU_SPIN_X = -Math.PI / 2;
export const GPU_SPIN_Y = Math.PI / 2;
export const GPU_SPIN_Z = 0;

/* ---------- mount targets (case-local space) ---------- */
export const MOTHERBOARD_TARGET = { position: [-0.30, 0.53, -0.30], rotation: [0, Math.PI, 0] };
export const PSU_TARGET = { position: [-0.625, 0.48, 0.00005], rotation: [Math.PI, (3 * Math.PI) / 2, 0] };
export const GPU_TARGET = { position: [-0.326, 1.0379, -0.449], rotation: [0, Math.PI, 0] };

export const RAM_SLOT_1_ABS = [0.0361, 1.132, -0.291];
export const RAM_SLOT_2_ABS = [0.1191, 1.132, -0.291];
export const CPU_SOCKET_ABS = [-0.237, 1.456, -0.375];

export function offsetFrom(abs, base) {
  return [abs[0] - base[0], abs[1] - base[1], abs[2] - base[2]];
}

export const RAM_1_OFFSET = offsetFrom(RAM_SLOT_1_ABS, MOTHERBOARD_TARGET.position);
export const RAM_2_OFFSET = offsetFrom(RAM_SLOT_2_ABS, MOTHERBOARD_TARGET.position);
export const CPU_OFFSET = offsetFrom(CPU_SOCKET_ABS, MOTHERBOARD_TARGET.position);

// Four RAM slots; slots 3 and 4 continue the spacing of slots 1 and 2.
export const RAM_SLOT_STEP = RAM_SLOT_2_ABS[0] - RAM_SLOT_1_ABS[0];
export const RAM_SLOTS_LOCAL = Array.from({ length: 4 }, (_, i) => {
  const abs = [RAM_SLOT_1_ABS[0] + i * RAM_SLOT_STEP, RAM_SLOT_1_ABS[1], RAM_SLOT_1_ABS[2]];
  const off = offsetFrom(abs, MOTHERBOARD_TARGET.position);
  return [-off[0], off[1], -off[2]];
});

export const COOLER_HEIGHT = 0.09;
export const COOLER_POSITION_OFFSET = [-0.006, -0.105, -0.002];
export const COOLER_OFFSET = [
  CPU_OFFSET[0] + COOLER_POSITION_OFFSET[0],
  CPU_OFFSET[1] + COOLER_HEIGHT + COOLER_POSITION_OFFSET[1],
  CPU_OFFSET[2] + COOLER_POSITION_OFFSET[2],
];

export const CPU_LOCAL = [-CPU_OFFSET[0], CPU_OFFSET[1], -CPU_OFFSET[2]];

export const STORAGE_LOCAL = [0.14, 0.625, 0.075];
// Every SSD component draws its drive the same way: lying flat (chips up, +Y), its gold pins at the
// origin and the drive running along -X. This turns that onto the board: pins toward the board's
// right, chips facing out.
export const STORAGE_MOUNT_ROTATION = [Math.PI / 2, 0, Math.PI];
export const STORAGE_OFFSET = [-STORAGE_LOCAL[0], STORAGE_LOCAL[1], -STORAGE_LOCAL[2]];

export const PASTE_LIFT = 0.02;
export const PASTE_LOCAL = [CPU_LOCAL[0], CPU_LOCAL[1], CPU_LOCAL[2] + PASTE_LIFT];

/* ---------- per-board layout ---------- */
// Every board model has its own size and its own socket / slot positions, so each board
// component exports MOUNTS (Three/MotherboardModel.jsx, MotherboardModel1.jsx...).
// These are the AM4 board's, tuned on motherboard.glb. All points are in board space
// (the space the board model is drawn in, before `scale`).
export const BASE_MOUNTS = {
  scale: MOBO_SCALE, // stretch applied to the board and everything on it
  cpu: CPU_LOCAL, // centre of the socket, where the CPU's underside sits
  cooler: null, // centre of the CPU's top face, where a cooler's base plate sits (null: worked out from cpu)
  ram: RAM_SLOTS_LOCAL, // the 4 DIMM slots, slot 1 first
  storage: STORAGE_LOCAL, // the M.2 connector, where a drive's gold pins go
  gpu: GPU_TARGET.position, // where the graphics card sits in the case (case space), lined up with this board's x16 slot
  // Cables and screws, in case space (only used while the board is in the case), measured on motherboard.glb:
  pcbFront: -0.405, // depth of the board's front surface
  holes: [
    [-0.686, 1.995], [-0.114, 1.987], [0.188, 1.981],
    [-0.788, 1.22], [-0.122, 1.222], [0.193, 1.223],
    [-0.783, 0.622], [-0.122, 0.619], [0.19, 0.62],
  ], // the 9 ATX screw holes, measured on the hole rings in close-up
  atx24: [0.204, 1.515], // centre of the 24-pin header (vertical, on the right edge): the model's Cube014_22
  eps8: [-0.593, 1.986], // centre of the 8-pin CPU power header (top-left): the model's Cube081_89
  // the small headers for the case's and fans' wires (lab/Wires.js): { [id]: { at: [x, y] mm from the
  // socket's centre, seen from the front (x right, y up), label (as printed), along: "y" if it runs up the board } }
  headers: null,
};

/** Everything the lab needs to place parts on one board, from that board's MOUNTS. */
export function boardLayout(m = BASE_MOUNTS) {
  const cpuOffset = [-m.cpu[0], m.cpu[1], -m.cpu[2]];
  const coolerOffset = m.cooler
    ? [-m.cooler[0], m.cooler[1], -m.cooler[2]]
    : [
        cpuOffset[0] + COOLER_POSITION_OFFSET[0],
        cpuOffset[1] + COOLER_HEIGHT + COOLER_POSITION_OFFSET[1],
        cpuOffset[2] + COOLER_POSITION_OFFSET[2],
      ];
  const coolerLocal = [-coolerOffset[0], coolerOffset[1], -coolerOffset[2]];
  return {
    scale: m.scale,
    cpuLocal: m.cpu,
    cpuOffset,
    // a pea of paste on the CPU's top face (board space: out of the board is -Z)
    pasteLocal: m.cooler
      ? [m.cooler[0], m.cooler[1], m.cooler[2] - 0.003 / m.scale[2]]
      : [m.cpu[0], m.cpu[1], m.cpu[2] + PASTE_LIFT],
    coolerLocal,
    coolerOffset,
    storageLocal: m.storage,
    storageOffset: [-m.storage[0], m.storage[1], -m.storage[2]],
    ramSlots: m.ram,
    gpu: m.gpu || GPU_TARGET.position,
    pcbFront: m.pcbFront ?? BASE_MOUNTS.pcbFront,
    holes: m.holes || BASE_MOUNTS.holes,
    atx24: m.atx24 || BASE_MOUNTS.atx24,
    eps8: m.eps8 || BASE_MOUNTS.eps8,
    headers: m.headers || BASE_MOUNTS.headers,
  };
}

/* ---------- case laid down on the bench ---------- */
// LAY_CENTER: where the middle of the laid-down case goes on the bench ([x, z]), just behind the
// parts trays. It is measured from the case model itself (CaseModel.jsx, 2.2 tall).
export const LAY_ANGLE = -Math.PI / 2;
export const LAY_CENTER = [0, -0.38];

/* ---------- AR / camera ---------- */
export const AR_SCALE = 0.07;
export const HOME_CAM = [0, 6, 9.5];
export const HOME_TARGET = [0, 0.6, 0];

/* ---------- case fans ---------- */
export const FAN_CONFIG = {
  size: 0.6,
  gap: 0.02,
  margin: 0.05,
  clearance: 0.02,
  dims: { width: 1.01, thickness: 0.65, length: 0.95 },
};
export const FRONT_SIGN = 1;
export const FAN_GROUPS = {
  top: { count: 2, size: null, dims: null, nudge: [0, -0.041, 0.125], flip: false },
  front: { count: 3, size: null, dims: null, nudge: [-0.03, 0.084, 0.035], flip: false },
  rear: { count: 1, size: null, dims: null, nudge: [0, 0.225, 0.145], flip: false },
};

/* ---------- monitor ---------- */
export const SCREEN_W = 1.64;
export const SCREEN_H = 0.99;
export const MONITOR_SCALE = 5;
export const STATION = { position: [0, 4.0, -4.5], rotationY: 0 };
export const SCREEN_RES = { high: 1280, low: 240 };

/* ---------- geometry helpers ---------- */
export function addRotatedOffset(base, offset, rotationY = Math.PI) {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const rx = offset[0] * cos - offset[2] * sin;
  const rz = offset[0] * sin + offset[2] * cos;
  return [base[0] + rx, base[1] + offset[1], base[2] + rz];
}

export function moboLocalToWorld(base, local, rotation, scale = MOBO_SCALE) {
  const v = new THREE.Vector3(local[0] * scale[0], local[1] * scale[1], local[2] * scale[2]);
  v.applyEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
  return [base[0] + v.x, base[1] + v.y, base[2] + v.z];
}

export function toWorldPose(position, rotation, rig) {
  if (!rig.laidDown) return { position, rotation };
  const R = new THREE.Euler(LAY_ANGLE, 0, 0);
  const p = new THREE.Vector3(position[0], position[1], position[2])
    .applyEuler(R)
    .add(new THREE.Vector3(rig.position[0], rig.position[1], rig.position[2]));
  const q = new THREE.Quaternion()
    .setFromEuler(R)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2])));
  const e = new THREE.Euler().setFromQuaternion(q);
  return { position: [p.x, p.y, p.z], rotation: [e.x, e.y, e.z] };
}

export function measureLocalBox(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const isVisible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  root.traverse((o) => {
    const invisibleMat = o.material && !Array.isArray(o.material) && o.material.opacity === 0;
    if (o.isMesh && o.geometry && isVisible(o) && !invisibleMat) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
    }
  });
  return box;
}