import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/motherboard.glb";
const TARGET_WIDTH = 1.1;

/**
 * Real motherboard model (.glb). Auto-scales to a consistent width and
 * centers itself regardless of source units, same pattern as CaseModel.
 * Falls back to a flat green placeholder board if the file isn't there
 * yet, so drag/snap logic stays testable in the meantime.
 */
export default function MotherboardModel(props) {
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
    return <PlaceholderBoard {...props} />;
  }
  if (modelExists === null) {
    return null;
  }
  return <RealMotherboard {...props} />;
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

function RealMotherboard(props) {
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
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const width = size.x || 1;
    const s = TARGET_WIDTH / width;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned]);

  return (
    <group {...props}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}