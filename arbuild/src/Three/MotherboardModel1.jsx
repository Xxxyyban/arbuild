// AM5 board (B650-PLUS). Its own component, so its size and placement are tuned
// for this file only. The AM4 board is MotherboardModel.jsx.
import { useEffect, useMemo } from "react";
import { useGLTF } from "./gltf";
import * as THREE from "three";
import MotherboardModel from "./MotherboardModel";
import { useFileExists } from "./useFileExists";
import { MM } from "./cableStubs";
import { splitTriangles } from "./cpuSocket";
import { BuiltZifLever } from "./Hardware";

const MODEL_PATH = "/models/motherboard1.glb";

// ---- FIT: tune these for motherboard1.glb only ----
// The file is in metres and true to size: a 244 × 305 mm ATX board, lying flat (thin axis Y,
// long axis Z, rear I/O on the -X edge). Unlike the AM4 file it needs no stretching.
const FIT = {
  length: 1.467, // PCB length in scene units: the same as the AM4 board's PCB, which fits the case
  turn: [0, 0, 0], // extra turn of the raw file in radians, if it comes in rotated
  // where the board's top edge sits; centres its I/O shield in the case's rear I/O cutout
  // (cutout: height 1.28 to 2.05, depth -0.40 to -0.18) at the same depth as the AM4 board's ports
  place: [0.007, 1.5455, 0.1005],
};

// ---- MOUNTS: where parts sit on this board (board space, see BASE_MOUNTS in lab/Constants) ----
// Measured by ray-casting the mounted board (case space), then converted to board space; change
// FIT.length or FIT.place and they must be measured again. PCB front -0.375; socket centre
// (-0.220, 1.595), contacts -0.351 (the CPU is 0.014 thick); DIMM slots x 0.041 / 0.084 / 0.127 / 0.170,
// y 1.276 to 1.948; M.2 connector x -0.030 to 0.006 at y 1.274, its 2280 standoff at x -0.426;
// x16 slot at y 1.1735, top -0.327. `gpu` is in case space, not board space.
export const MOUNTS = {
  scale: [1, 1, 1],
  cpu: [-0.08, 1.065, 0.051],
  cooler: [-0.08, 1.065, 0.037],
  ram: [
    [-0.341, 1.082, 0.06],
    [-0.384, 1.082, 0.06],
    [-0.427, 1.082, 0.06],
    [-0.47, 1.082, 0.06],
  ],
  storage: [-0.274, 0.744, 0.06],
  gpu: [-0.326, 1.0859, -0.419],
  // case space, measured on the mounted board: board surface, the 9 ATX screw holes (snapped to the
  // plated hole rings in the file), the two power headers
  pcbFront: -0.375,
  holes: [
    [-0.66, 1.997], [-0.047, 1.997], [0.282, 1.995],
    [-0.762, 1.26], [-0.047, 1.261], [0.283, 1.26],
    [-0.762, 0.683], [-0.047, 0.683], [0.284, 0.683],
  ],
  // the 24-pin header: a shroud 0.052 wide (x 0.263 to 0.315) and 0.248 tall (y 1.518 to 1.766),
  // standing 0.070 off the board, the floors of its pin cavities 0.014 off it: the plug centred on it and
  // pushed 0.040 into it (its face 0.030 off the board), as a plug sits when it has clicked in
  atx24: [0.289, 1.642, 0.03],
  eps8: [-0.579, 2.0],
  // the headers for the case's and fans' wires, on the file's pin rows (mm from the socket, x right, y up),
  // labelled as the file prints them along the bottom edge (HD_AUDIO1, COM1, USB_3_4, FAN1, FAN2, ARGB1,
  // ARGB2, USB_1_2, USB3_1, CHA_FAN, PANEL1). Both white headers there are 5 V ARGB: this board has no
  // 12 V RGB header. The white pair at the top are the CPU fans'.
  headers: {
    pled: { at: [76.9, -198.5] },
    pwr: { at: [82, -198.5] },
    hdd: { at: [76.9, -201] },
    rst: { at: [82, -201] },
    aafp: { at: [-83.5, -199.75], label: "HD_AUDIO1" },
    usb2: { at: [-41.9, -199.75], label: "USB_3_4" },
    u32g1: { at: [103.9, -33.6], along: "y" },
    cpu_fan: { at: [75.5, 88.6] },
    cpu_opt: { at: [92.5, 88.7] },
    cha_fan: { at: [62.5, -199.75], label: "CHA_FAN" },
    add_gen2: { at: [12.3, -199.5], label: "ARGB2" },
  },
};

export default function MotherboardModel1(props) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <MotherboardModel {...props} />; // file not added yet: show the AM4 board
  return <RealBoard {...props} />;
}

function RealBoard({ spinY = 0, ...props }) {
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      // the socket lever swings on its own (SOCKET): the board keeps the rest of its silver parts
      if (child.isMesh && child.name === LEVER_MESH) child.geometry = leverSplit(scene).rest;
    });
  }, [cloned, scene]);

  const { scale, offset } = useMemo(() => fitOf(cloned), [cloned]);

  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group position={FIT.place}>
        {/* face north, then stand upright (same as the AM4 board) */}
        <group rotation={[0, Math.PI, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <group scale={scale} position={offset}>
              <primitive object={cloned} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** The file's fit: its longest side FIT.length long, centred across, resting on y = 0. */
function fitOf(object) {
  object.rotation.set(FIT.turn[0], FIT.turn[1], FIT.turn[2]);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = FIT.length / (Math.max(size.x, size.y, size.z) || 1);
  return { scale: s, offset: [-center.x * s, -box.min.y * s, -box.min.z * s] };
}

/* ---------- the CPU socket (Three/cpuSocket.js) ---------- */
// The file's lever is a silver rod down the socket's right side, bent out at its top into a pivot
// post. It is cut out of the board's silver mesh so it can swing; the lab adds the hook it sits under
// and the cover frame with its plastic cap, which the file doesn't have. In mm in the socket's frame
// (x right, y up the board, z out; 0 = the CPU's seat).
const LEVER_MESH = "silver";
const LEVER_PIVOT = [30.01, 26.9, 3.41]; // where the rod meets the arm bent out to the post
// a triangle of the lever: right of the socket, above the board, short of the pivot post beside it
const onLever = ([x, y, z]) => x >= 28.9 && x <= 34.45 && y >= -33.5 && y <= 28.2 && z >= 2.45;

/** File -> the socket's frame: RealBoard's groups, then BuildLab's socket group undone. */
function socketFrame(scene) {
  const { scale, offset } = fitOf(scene);
  const place = (pos, turn, s = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn)), new THREE.Vector3(s, s, s));
  return place([0, 0, 0], [0, Math.PI, 0])
    .multiply(new THREE.Matrix4().makeScale(...MOUNTS.scale))
    .multiply(new THREE.Matrix4().makeTranslation(-MOUNTS.cpu[0], -MOUNTS.cpu[1], -MOUNTS.cpu[2]))
    .multiply(place(FIT.place, [0, Math.PI, 0]))
    .multiply(place([0, 0, 0], [Math.PI / 2, 0, 0]))
    .multiply(place(offset, [0, 0, 0], scale))
    .multiply(scene.matrixWorld.clone().invert());
}

const splits = new WeakMap(); // the file's silver geometry -> its lever and the rest, worked out once
function leverSplit(scene) {
  const mesh = scene.getObjectByName(LEVER_MESH);
  if (!splits.has(mesh.geometry)) {
    const frame = socketFrame(scene).multiply(mesh.matrixWorld);
    const [lever, rest] = splitTriangles(mesh.geometry, frame, onLever);
    splits.set(mesh.geometry, { lever, rest, frame, material: mesh.material });
  }
  return splits.get(mesh.geometry);
}

function OwnLever() {
  const { scene } = useGLTF(MODEL_PATH);
  const lever = useMemo(() => {
    const { lever: geometry, frame, material } = leverSplit(scene);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.makeTranslation(...LEVER_PIVOT.map((v) => -v * MM)).multiply(frame);
    mesh.matrixWorldNeedsUpdate = true; // a fixed matrix: its world matrix follows only when flagged
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, [scene]);
  return <primitive object={lever} />;
}

/** The file's own lever; the lab's built one if the file is missing (the AM4 board shows then). */
function LeverBody() {
  const ok = useFileExists(MODEL_PATH);
  if (ok === false) return <BuiltZifLever />;
  return ok ? <OwnLever /> : null;
}

export const SOCKET = {
  kind: "lga",
  lever: { Body: LeverBody, pivot: LEVER_PIVOT.map((v) => v * MM), length: 60 * MM },
  hook: { at: [28.3 * MM, -30 * MM, -0.5 * MM], height: 5.4, reach: 2 },
  // the cover frame's hinge, on the socket's left side, and the cap on the frame (in the hinge's frame)
  plate: { hinge: [-25.5 * MM, 0, 2.0 * MM], cap: { at: [26.5 * MM, 0, 0.4 * MM], size: [44, 44] } },
  cap: { size: [44, 44] },
};
