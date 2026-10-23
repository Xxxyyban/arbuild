// AM5 board (B650-PLUS). Its own component, so its size and placement are tuned
// for this file only. The AM4 board is MotherboardModel.jsx.
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import MotherboardModel from "./MotherboardModel";
import { useFileExists } from "./useFileExists";

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
  atx24: [0.294, 1.663],
  eps8: [-0.579, 2.0],
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
    });
  }, [cloned]);

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(FIT.turn[0], FIT.turn[1], FIT.turn[2]);
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = FIT.length / (Math.max(size.x, size.y, size.z) || 1);
    return { scale: s, offset: [-center.x * s, -box.min.y * s, -box.min.z * s] };
  }, [cloned]);

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
