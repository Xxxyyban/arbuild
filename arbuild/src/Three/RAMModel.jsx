import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { orientQuaternion, MM } from "./orient";

const MODEL_PATH = "/models/ram.glb";
const STICK_LENGTH = 133.35 * MM; // a DIMM is 133.35 mm long

/** DDR4 stick (ram.glb), true to size. Falls back to a procedural placeholder if the file isn't found. */
export default function RAMModel({ spinY = 0, accentColor = "#34d399", ...props }) {
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
    return <PlaceholderRAM {...props} accentColor={accentColor} rotation={[0, spinY, 0]} />;
  }
  if (modelExists === null) {
    return null;
  }
  return <RealRAM {...props} spinY={spinY} />;
}

function PlaceholderRAM({ accentColor = "#34d399", ...props }) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.7, 0.03]} />
        <meshStandardMaterial color="#0d1117" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0.018]} castShadow>
        <boxGeometry args={[0.26, 0.6, 0.012]} />
        <meshStandardMaterial color="#1c2431" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0.026]}>
        <boxGeometry args={[0.26, 0.06, 0.004]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, -0.36, 0]}>
        <boxGeometry args={[0.26, 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[-0.06, -0.36, 0.012]}>
        <boxGeometry args={[0.02, 0.045, 0.01]} />
        <meshStandardMaterial color="#0a0e14" />
      </mesh>
    </group>
  );
}

function RealRAM({ spinY = 0, ...props }) {
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

  // The lab's stick: length up (+Y), standing out of the board toward -Z, gold contacts at the origin,
  // centred on its length and thickness. Every RAM component draws its stick this way, so any stick
  // seats in any board's slot from the same mount point.
  const { scale, offset } = useMemo(() => {
    // ram.glb: length along Z, height along Y (contacts at the bottom), thickness along X
    cloned.rotation.set(0, 0, 0);
    cloned.quaternion.copy(orientQuaternion({ z: [0, 1, 0], y: [0, 0, -1] }));
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = STICK_LENGTH / (size.y || 1);
    return { scale: s, offset: [-center.x * s, -center.y * s, -box.max.z * s] };
  }, [cloned]);

  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}
