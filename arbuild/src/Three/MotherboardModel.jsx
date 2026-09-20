import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/motherboard.glb";
const TARGET_WIDTH = 1.0;

// Many Sketchfab uploads are oriented for a nice camera angle, not for
// "lying flat on a tray." This rotates the raw model into a flat,
// chips-facing-up orientation before we measure/scale it.
const ORIENTATION_FIX = [-Math.PI / 2, 0, 0];

/**
 * Real motherboard model (.glb), corrected to lie flat and scaled to a
 * consistent width regardless of source units/orientation. Falls back
 * to a flat green placeholder board if the file isn't there yet.
 */
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

function PlaceholderBoard(props) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.06, 1.7]} />
        <meshStandardMaterial color="#1f5c3f" metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0.3, 0.04, -0.2]}>
        <boxGeometry args={[0.4, 0.02, 0.4]} />
        <meshStandardMaterial color="#0d1117" metalness={0.5} roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.75, 0.05, -0.15 + i * 0.13]}>
          <boxGeometry args={[0.06, 0.04, 0.1]} />
          <meshStandardMaterial color="#0d1117" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.04, 0.7]}>
        <boxGeometry args={[1.7, 0.02, 0.15]} />
        <meshStandardMaterial color="#4fd8c9" metalness={0.3} roughness={0.4} emissive="#4fd8c9" emissiveIntensity={0.1} />
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
    cloned.rotation.set(...ORIENTATION_FIX);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const horizontal = Math.max(size.x, size.z) || 1;
    const s = TARGET_WIDTH / horizontal;

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