import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/motherboard.glb";
const TARGET_HEIGHT = 1.5;

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
      {/* Added a small vertical offset [0, 0.1, 0] here to move it up */}
      <group position={[-0.14, 1.372, 0.12]}>
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

useGLTF.preload(MODEL_PATH);