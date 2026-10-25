import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "./gltf";
import * as THREE from "three";
import { BASE_MOUNTS, STORAGE_MOUNT_ROTATION } from "../lab/Constants";
import { MM } from "./cableStubs";
import { SSD_TOP, restingOffset } from "./m2Cover";
import { BUILT_M2_COVER, BuiltZifLever } from "./Hardware";
import { splitTriangles } from "./cpuSocket";
import { useFileExists } from "./useFileExists";

// AM4 board (B550). The AM5 board has its own component: MotherboardModel1.jsx.
const MODEL_PATH = "/models/motherboard.glb";
const TARGET_HEIGHT = 1.5;

// ---- FIT: where this file sits ----
// The file is not true to size, so it gets one near-uniform stretch (MOUNTS.scale) that makes
// it a real 244 × 305 mm ATX board: its 9 screw holes then land on the case's standoffs, the same
// spots as the AM5 board's (which is true to size). PLACE is where the file sits inside that stretch.
const PLACE = [-0.1945, 1.434, 0.1059];
// The first M.2 slot's heatsink, its red trim and the dark plate under it, then its 2 screws. They are
// left off the board: the lab draws them as the M.2 cover students unscrew and lift off (M2_COVER).
const M2_COVER_PARTS = ["Object_25", "Object_224", "Object_23"];
const M2_COVER_SCREW_PARTS = "Object_213";

// ---- MOUNTS: where parts sit on this board (board space, see BASE_MOUNTS in lab/Constants) ----
// Measured on the mounted board by ray-casting its surface (case space), then converted to board
// space. Change PLACE or the scale and these must be measured again.
// Case space, measured: PCB front -0.3746; socket centre (-0.175, 1.590), top -0.366; the CPU is
// 0.022 thick; DIMM grooves at x 0.0735 / 0.1175 / 0.1615 / 0.208, slots y 1.258 to 1.926, groove floor
// -0.3675; M.2 connector end of the (hidden) M.2 heatsink at x -0.078, y 1.267.
export const MOUNTS = {
  ...BASE_MOUNTS,
  scale: [1.0707, 1.075, 1.073],
  cpu: [-0.1168, 0.9861, 0.0615],
  cooler: [-0.1168, 0.9861, 0.0401],
  ram: [
    [-0.3488, 0.9879, 0.0629],
    [-0.3899, 0.9879, 0.0629],
    [-0.431, 0.9879, 0.0629],
    [-0.4745, 0.9879, 0.0629],
  ],
  storage: [-0.2073, 0.6856, 0.0615],
  // x16 slot measured at y 1.172, x -0.616 to -0.128, top -0.340: the same spot as the AM5 board's
  gpu: [-0.326, 1.0859, -0.419],
  pcbFront: -0.375, // same standoffs as the AM5 board
  holes: [
    [-0.655, 2.003], [-0.042, 1.995], [0.281, 1.989],
    [-0.764, 1.259], [-0.051, 1.261], [0.286, 1.262],
    [-0.759, 0.685], [-0.051, 0.682], [0.283, 0.683],
  ],
  atx24: [0.298, 1.542],
  eps8: [-0.555, 1.994],
  // the headers for the case's and fans' wires, measured on the file's pins (mm from the socket, x right,
  // y up); labels as printed on this board
  headers: {
    pled: { at: [77.95, -198] },
    pwr: { at: [83, -198] },
    hdd: { at: [77.95, -200.5] },
    rst: { at: [83, -200.5] },
    aafp: { at: [-86.4, -198.8] },
    usb2: { at: [34.9, -199.3], label: "USB_E12" },
    u32g1: { at: [97.7, -48.1], label: "U32G1_12", along: "y" },
    cpu_fan: { at: [48.7, 86.5] },
    cpu_opt: { at: [38.1, 86.5] },
    cha_fan: { at: [68.8, -199.4], label: "CHA_FAN2" },
    add_gen2: { at: [-14.6, -198.8] },
    rgb: { at: [-32, -199.3], label: "RGB_HEADER2" },
  },
};

export default function MotherboardModel({ spinY = 0, ...props }) {
  const [modelExists, setModelExists] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_PATH, { method: "HEAD" })
      .then((res) => !cancelled && setModelExists(res.ok))
      .catch(() => !cancelled && setModelExists(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (modelExists === false) {
    return <PlaceholderBoard {...props} rotation={[0, spinY, 0]} />;
  }
  if (modelExists === null) {
    return null;
  }
  return <RealMotherboard {...props} spinY={spinY} />;
}

/**
 * Detailed Placeholder Motherboard featuring clear socket, chipset, 
 * and RAM slot locations so you can mount components onto it directly.
 */
function PlaceholderBoard(props) {
  return (
    <group {...props}>
      {/* Main PCB Board - Standing upright */}
      <mesh castShadow receiveShadow position={[0, TARGET_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.04, TARGET_HEIGHT, TARGET_HEIGHT * 0.9]} />
        <meshStandardMaterial color="#1b4d3e" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* CPU Socket Area (Top Center-Left) */}
      <mesh position={[-0.1, TARGET_HEIGHT * 0.65, 0.05]}>
        <boxGeometry args={[0.25, 0.03, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* RAM Slots (4 Slots to the right of CPU socket) */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.12 + (i * 0.04), TARGET_HEIGHT * 0.65, 0.05]}>
          <boxGeometry args={[0.025, 0.3, 0.08]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* Chipset Heatsink (Bottom Right) */}
      <mesh position={[0.2, TARGET_HEIGHT * 0.3, 0.2]}>
        <boxGeometry args={[0.2, 0.04, 0.2]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* PCIe Slot for Graphics Card (Lower Middle) */}
      <mesh position={[0, TARGET_HEIGHT * 0.35, -0.05]}>
        <boxGeometry args={[0.5, 0.02, 0.12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function RealMotherboard({ spinY = 0, ...props }) {
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      // the M.2 cover and its screws are drawn by the lab instead (M2_COVER). Hidden pieces still
      // catch clicks, so these take none: clicks go to the lab's cover and the SSD under it.
      if (M2_COVER_PARTS.includes(child.name) || child.name === M2_COVER_SCREW_PARTS) {
        child.visible = false;
        child.raycast = () => {};
      }
      // the socket's top plate slides with the lever (SOCKET.top): the board keeps the rest of the socket
      if (child.isMesh && SOCKET_PARTS.includes(child.name)) child.geometry = topPlateSplit(scene, child.name).rest;
    });
  }, [cloned, scene]);

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    return fitOf(cloned);
  }, [cloned]);

  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group position={PLACE}>
        {/* Face North (away from camera) */}
        <group rotation={[0, Math.PI, 0]}>
          {/* Stand Upright */}
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

/** The file's fit: its longest side TARGET_HEIGHT long, centred across, resting on y = 0. */
function fitOf(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const s = TARGET_HEIGHT / (Math.max(size.x, size.y, size.z) || 1);
  return { scale: s, offset: [-center.x * s, -box.min.y * s, -box.min.z * s] };
}

/* ---------- the board's own M.2 heatsink, as the lab's M.2 cover ---------- */
// Hardware.jsx M2Cover draws a cover in the SSD's frame raised to SSD_TOP (x = 0 the drive's pins,
// the drive along -X, +Y out of the board). This board's heatsink is moved there from where the file
// has it, so on the board it sits exactly where the model put it.
const place = (pos, turn, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn)), new THREE.Vector3(s, s, s));

/** File -> board space: RealMotherboard's groups, outermost first. */
function boardFrame(scene) {
  scene.updateMatrixWorld(true);
  const { scale, offset } = fitOf(scene);
  return place(PLACE, [0, Math.PI, 0]).multiply(place([0, 0, 0], [Math.PI / 2, 0, 0])).multiply(place(offset, [0, 0, 0], scale));
}

function bakeM2Cover(scene) {
  const toBoard = boardFrame(scene);
  // board space -> the cover's frame: undo the M.2 slot's group, its true-size wrapper and the drive's turn
  const toCover = new THREE.Matrix4()
    .makeTranslation(0, -SSD_TOP, 0)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...STORAGE_MOUNT_ROTATION)).invert())
    .multiply(new THREE.Matrix4().makeScale(...MOUNTS.scale))
    .multiply(new THREE.Matrix4().makeTranslation(-MOUNTS.storage[0], -MOUNTS.storage[1], -MOUNTS.storage[2]));
  const frame = toCover.multiply(toBoard).multiply(scene.matrixWorld.clone().invert());

  const cover = new THREE.Group();
  M2_COVER_PARTS.forEach((name) => {
    const part = scene.getObjectByName(name);
    const copy = part.clone();
    copy.matrixAutoUpdate = false;
    copy.matrix.multiplyMatrices(frame, part.matrixWorld);
    copy.matrixWorldNeedsUpdate = true; // a fixed matrix: its world matrix follows only when flagged
    copy.visible = true;
    copy.castShadow = true;
    copy.receiveShadow = true;
    cover.add(copy);
  });
  return cover;
}

function OwnM2Cover({ resting }) {
  const { scene } = useGLTF(MODEL_PATH);
  const cover = useMemo(() => bakeM2Cover(scene), [scene]);
  const lie = useMemo(() => restingOffset(cover), [cover]);
  return (
    <group position={resting ? lie : [0, 0, 0]}>
      <primitive object={cover} />
    </group>
  );
}

/** The heatsink as the M.2 cover; the lab's built one if the board file is missing. */
function M2CoverBody(props) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === false) return <BUILT_M2_COVER.Body {...props} />;
  return ok ? <OwnM2Cover {...props} /> : null;
}

// The cover's 2 screws, in the cover's frame: on top of the heatsink (6.25 mm up the SSD's frame),
// over the screws the file has under it, at its connector end and 120 mm along.
const COVER_TOP = 6.25 * MM - SSD_TOP;
export const M2_COVER = {
  Body: M2CoverBody,
  screws: [
    [-3.6 * MM, COVER_TOP, 0.7 * MM],
    [-120 * MM, COVER_TOP, 0.8 * MM],
  ],
};

/* ---------- the CPU socket: its lever and its sliding top plate (Three/cpuSocket.js) ---------- */
// The file's AM4 socket has no lever: its body (raised along the right side, where the cam is) ends at
// x 30.4 mm. The lab draws the lever beside it, pivoting at the top corner, and its hook near the
// bottom. What holds the CPU is the socket's top plate (the part with the pin holes, x -20..19 mm):
// the lever's cam slides it a little sideways, gripping every pin. It is cut out of the socket's two
// meshes so it can slide; drawn where the file has it, it is the locked position. In mm in the
// socket's frame (x right, y up the board, z out; 0 = the CPU's seat).
const SOCKET_PARTS = ["Object_64", "Object_65"];
const onTopPlate = ([x, y, z]) => x >= -20.4 && x <= 19 && y >= -20.4 && y <= 21.4 && z >= -0.65 && z <= 0.55;

/** File -> the socket's frame: board space, then BuildLab's socket group undone. */
function socketFrame(scene) {
  return place([0, 0, 0], [0, Math.PI, 0])
    .multiply(new THREE.Matrix4().makeScale(...MOUNTS.scale))
    .multiply(new THREE.Matrix4().makeTranslation(-MOUNTS.cpu[0], -MOUNTS.cpu[1], -MOUNTS.cpu[2]))
    .multiply(boardFrame(scene))
    .multiply(scene.matrixWorld.clone().invert());
}

const splits = new WeakMap(); // a socket mesh's geometry -> its top plate and the rest, worked out once
function topPlateSplit(scene, name) {
  const mesh = scene.getObjectByName(name);
  if (!splits.has(mesh.geometry)) {
    const frame = socketFrame(scene).multiply(mesh.matrixWorld);
    const [plate, rest] = splitTriangles(mesh.geometry, frame, onTopPlate);
    splits.set(mesh.geometry, { plate, rest, frame, material: mesh.material });
  }
  return splits.get(mesh.geometry);
}

function OwnTopPlate() {
  const { scene } = useGLTF(MODEL_PATH);
  const plate = useMemo(() => {
    const g = new THREE.Group();
    SOCKET_PARTS.forEach((name) => {
      const { plate: geometry, frame, material } = topPlateSplit(scene, name);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(frame);
      mesh.matrixWorldNeedsUpdate = true; // a fixed matrix: its world matrix follows only when flagged
      mesh.receiveShadow = true;
      g.add(mesh);
    });
    return g;
  }, [scene]);
  return <primitive object={plate} />;
}

/** The file's top plate; nothing to slide if the file is missing (the placeholder board shows then). */
function TopPlateBody() {
  return useFileExists(MODEL_PATH) ? <OwnTopPlate /> : null;
}

export const SOCKET = {
  kind: "zif",
  lever: { Body: BuiltZifLever, pivot: [31.6 * MM, 20.5 * MM, 0.2 * MM], length: 42 * MM },
  hook: { at: [30.3 * MM, -18 * MM, -2 * MM], height: 3.7, reach: 1.6 },
  // with the lever up the plate (and a CPU in it) sits 1.2 mm toward the cam, its holes open
  top: { Body: TopPlateBody, slide: [0, 1.2 * MM, 0] },
};

// No preload: the AM4 board file is large, so each board loads only once it is picked.