import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/ram.glb";
const TARGET_HEIGHT = 0.66; // world units — how tall the stick should stand

/**
 * Real RAM stick model (.glb). Auto-detects which axis is the model's
 * tallest dimension (a RAM stick standing up is taller than it is
 * wide/thick) and rotates that axis to point straight up. Falls back
 * to a procedural placeholder stick if the file isn't found yet.
 */
export default function RAMModel({ spinY = 0, accentColor = "#4fd8c9", ...props }) {
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

function PlaceholderRAM({ accentColor = "#4fd8c9", ...props }) {
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

  const { scale, offset } = useMemo(() => {
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(cloned);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);

    const dims = [
      { value: rawSize.x, normal: new THREE.Vector3(1, 0, 0) },
      { value: rawSize.y, normal: new THREE.Vector3(0, 1, 0) },
      { value: rawSize.z, normal: new THREE.Vector3(0, 0, 1) },
    ];
    dims.sort((a, b) => a.value - b.value);
    const tallAxisNormal = dims[2].normal;

    const quat = new THREE.Quaternion().setFromUnitVectors(
      tallAxisNormal,
      new THREE.Vector3(0, 1, 0)
    );
    cloned.quaternion.copy(quat);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const s = TARGET_HEIGHT / (size.y || 1);

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