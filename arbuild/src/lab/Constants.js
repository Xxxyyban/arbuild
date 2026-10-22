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

export const TRAY_OFFSETS = {
  motherboard: [-0.05, 0.15, 3],
  cpu: [0.8, 0.01, 2.4],
  ram1: [1.2, 0.15, 2.9],
  ram2: [1.4, 0.15, 2.9],
  psu: [-1.6, 0.05, 2.7],
  gpu: [1.2, 0.15, 1.5],
  cpu_cooler: [0.8, 0.01, 2.8],
  storage: [-1.2, 0.05, 1.9],
};

// [x, y, z] added on top of the tray position. Default is [0, 0.35, 0].
export const LABEL_OFFSETS = { psu: [0, 1.0, 0] };

export function trayPosition(name) {
  const o = TRAY_OFFSETS[name];
  return [TABLE.center[0] + o[0], TABLE.center[1] + o[1], TABLE.center[2] + o[2]];
}

/* ---------- rotations / scales ---------- */
export const MOBO_LYING_ROTATION = [-Math.PI / 2, Math.PI, 0];
export const MOBO_MOUNTED_ROTATION = [0, Math.PI, 0];
export const MOBO_SCALE = [0.9999999, 1.12, 1.25];
export const RAM_LYING_ROTATION = [-Math.PI / 2, Math.PI, 0];
export const CPU_TRAY_ROTATION = [0, Math.PI, 0];
export const PSU_TRAY_ROTATION = [0, 0, 0];
export const GPU_TRAY_ROTATION = [0, Math.PI, 0];
export const RAM_SCALE = [0.85, 0.959, 0.85];

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
export const STORAGE_MOUNT_ROTATION = [Math.PI / 2, (90 * Math.PI) / 180, 0];
export const STORAGE_FLIP_ROTATION = [Math.PI, 0, 0];
export const STORAGE_DIMS = { length: 0.85, width: 1, thickness: 1 };
export const STORAGE_OFFSET = [-STORAGE_LOCAL[0], STORAGE_LOCAL[1], -STORAGE_LOCAL[2]];

export const PASTE_LIFT = 0.02;
export const PASTE_LOCAL = [CPU_LOCAL[0], CPU_LOCAL[1], CPU_LOCAL[2] + PASTE_LIFT];

/* ---------- case laid down on the bench ---------- */
export const LAY_ANGLE = -Math.PI / 2;
export const LAY_CENTER = [0, -3];

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
  top: { count: 2, size: null, dims: null, nudge: [0, -5.29, 0.12], flip: false },
  front: { count: 3, size: null, dims: null, nudge: [-0.03, -2.54, 0.03], flip: false },
  rear: { count: 1, size: null, dims: null, nudge: [0, 0.225, 0.14], flip: false },
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

export function moboLocalToWorld(base, local, rotation) {
  const v = new THREE.Vector3(
    local[0] * MOBO_SCALE[0],
    local[1] * MOBO_SCALE[1],
    local[2] * MOBO_SCALE[2]
  );
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