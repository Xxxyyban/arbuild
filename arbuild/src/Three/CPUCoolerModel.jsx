import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/cpu_cooler.glb";
// AMD Wraith Stealth is a small stock cooler, roughly 60-70mm across.
// Tune against CPU_SCALE / the socket area once it's on screen.
const TARGET_WIDTH = 0.42;

export default function CPUCoolerModel({ spinX = 0, spinY = 0, spinZ = 0, ...props }) {
  // Wrap useGLTF safely. If the file is missing or fails, it will catch and fallback.
  let gltf = null;
  try {
    gltf = useGLTF(MODEL_PATH);
  } catch (e) {
    // File not found or load error
  }

  if (!gltf || !gltf.scene) {
    return <PlaceholderCooler {...props} rotation={[spinX, spinY, spinZ]} />;
  }

  return <RealCooler scene={gltf.scene} spinX={spinX} spinY={spinY} spinZ={spinZ} {...props} />;
}

function PlaceholderCooler(props) {
  return (
    <group {...props}>
      {/* Base plate / heatsink block */}
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 24]} />
        <meshStandardMaterial color="#7a7d82" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Fan shroud on top */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.025, 24]} />
        <meshStandardMaterial color="#1a1d23" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* AMD-style center cap */}
      <mesh position={[0, 0.105, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 16]} />
        <meshStandardMaterial color="#e8a33d" emissive="#e8a33d" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function RealCooler({ scene, spinX = 0, spinY = 0, spinZ = 0, ...props }) {
  const cloned = useMemo(() => scene.clone(true), [scene]);

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const s = TARGET_WIDTH / maxDimension;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned]);

  return (
    <group {...props} rotation={[spinX, spinY, spinZ]}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);