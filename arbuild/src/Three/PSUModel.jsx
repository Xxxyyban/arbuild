import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/psu.glb";
const TARGET_WIDTH = 0.71;

export default function PSUModel({ spinY = 0, ...props }) {
  // Wrap useGLTF safely. If the file is missing or fails, it will catch and fallback.
  let gltf = null;
  try {
    gltf = useGLTF(MODEL_PATH);
  } catch (e) {
    // File not found or load error
  }

  if (!gltf || !gltf.scene) {
    return <PlaceholderPSU {...props} rotation={[0, spinY, 0]} />;
  }

  return <RealPSU scene={gltf.scene} spinY={spinY} {...props} />;
}

function PlaceholderPSU(props) {
  return (
    <group {...props}>
      {/* Main housing */}
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[0.44, 0.24, 0.34]} />
        <meshStandardMaterial color="#2a2f37" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Fan grille */}
      <mesh position={[0, 0.12, 0.172]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.01, 24]} />
        <meshStandardMaterial color="#0d1117" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Label strip */}
      <mesh position={[0, 0.036, 0.172]}>
        <boxGeometry args={[0.38, 0.05, 0.002]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}

function RealPSU({ scene, spinY = 0, ...props }) {
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
    <group {...props} rotation={[0, spinY, 0]}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);