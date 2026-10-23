import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BASE_MOUNTS } from "../lab/Constants";

// AM4 board (B550). The AM5 board has its own component: MotherboardModel1.jsx.
const MODEL_PATH = "/models/motherboard.glb";
const TARGET_HEIGHT = 1.5;

// ---- FIT: where this file sits ----
// The file is not true to size, so it gets one near-uniform stretch (MOUNTS.scale) that makes
// it a real 244 × 305 mm ATX board: its 9 screw holes then land on the case's standoffs, the same
// spots as the AM5 board's (which is true to size). PLACE is where the file sits inside that stretch.
const PLACE = [-0.1945, 1.434, 0.1059];
const M2_HEATSINK = "Object_25";

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
      // the first M.2 slot's heatsink: left off, so students can see the drive go in
      if (child.name === M2_HEATSINK) child.visible = false;
    });
  }, [cloned]);

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const s = TARGET_HEIGHT / maxDimension;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -box.min.z * s],
    };
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

// No preload: the AM4 board file is large, so each board loads only once it is picked.