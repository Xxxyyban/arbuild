import { useMemo, Suspense } from "react";
import { useGLTF } from "./gltf";
import { useFileExists } from "./useFileExists";
import * as THREE from "three";

const MODEL_PATH = "/models/psu.glb";
const TARGET_WIDTH = 0.71;

// The modular sockets on psu.glb's front face (two rows of four: three 8-pin columns and a 6-pin one),
// measured by ray-casting the fitted model. Points are in the PSU's own frame (the group PSUModel is
// drawn in): the face is the plane z = face, and plugs go in along +Z. Each socket name lists the
// sockets of that label; the 24-pin cable's PSU end takes both MB sockets.
export const MODULAR = {
  face: -0.3406,
  sockets: {
    mb: { label: "MB", at: [[0.1425, 0.181], [0.1425, 0.251]] },
    cpu: { label: "CPU", at: [[0.02, 0.181]], spare: [[0.02, 0.251]] },
    pcie: { label: "PCI-E", at: [[-0.1, 0.181]] },
    pcie6: { label: "PCI-E", at: [[-0.1, 0.251]], unlabelled: true }, // the 6-pin PCIe cable's
    sata: { label: "SATA", at: [[-0.2325, 0.181]], spare: [[-0.2325, 0.251]] },
  },
};

export default function PSUModel({ spinY = 0, ...props }) {
  // the placeholder while the file is checked and loading (or if it's missing), then the model
  const placeholder = <PlaceholderPSU {...props} rotation={[0, spinY, 0]} />;
  if (!useFileExists(MODEL_PATH)) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <LoadedPSU spinY={spinY} {...props} />
    </Suspense>
  );
}

function LoadedPSU({ spinY, ...props }) {
  const { scene } = useGLTF(MODEL_PATH);
  return <RealPSU scene={scene} spinY={spinY} {...props} />;
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