import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/gpu.glb";
// PSU's TARGET_WIDTH (0.71) was tuned against its real housing (~140mm).
// A 3060 Ti Eagle is ~242mm long, so scaled at roughly the same
// real-world:scene ratio that lands around ~1.23. Nudge this until it
// matches the PCIe slot / case scale in your scene.
const TARGET_WIDTH = 1.199;

export default function GPUModel({ spinX = 0, spinY = 0, spinZ = 0, ...props }) {
  // Wrap useGLTF safely. If the file is missing or fails, it will catch and fallback.
  let gltf = null;
  try {
    gltf = useGLTF(MODEL_PATH);
  } catch (e) {
    // File not found or load error
  }

  if (!gltf || !gltf.scene) {
    return <PlaceholderGPU {...props} rotation={[spinX, spinY, spinZ]} />;
  }

  return <RealGPU scene={gltf.scene} spinX={spinX} spinY={spinY} spinZ={spinZ} {...props} />;
}

function PlaceholderGPU(props) {
  return (
    <group {...props}>
      {/* Shroud / body */}
      <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.42]} />
        <meshStandardMaterial color="#1a1d23" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Backplate */}
      <mesh position={[0, 0.06, -0.208]}>
        <boxGeometry args={[0.27, 0.11, 0.004]} />
        <meshStandardMaterial color="#0d1117" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Fans */}
      {[-0.12, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.135, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.01, 24]} />
          <meshStandardMaterial color="#0d1117" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {/* PCIe bracket / I/O plate */}
      <mesh position={[0, 0.06, 0.2]}>
        <boxGeometry args={[0.02, 0.1, 0.02]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function RealGPU({ scene, spinX = 0, spinY = 0, spinZ = 0, ...props }) {
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