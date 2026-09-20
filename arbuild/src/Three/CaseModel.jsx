import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/case-meshify-c.glb";
const DEFAULT_TARGET_HEIGHT = 2.2;

/**
 * Real scanned/modeled PC case with integrated internal placeholders 
 * for the Motherboard tray and PSU shroud chamber.
 */
export default function CaseModel({ targetHeight = DEFAULT_TARGET_HEIGHT, showPlaceholders = true, ...props }) {
  const group = useRef();
  const [modelExists, setModelExists] = useState(null);
  const { scene } = useGLTF(MODEL_PATH);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_PATH, { method: "HEAD" })
      .then((res) => !cancelled && setModelExists(res.ok))
      .catch(() => !cancelled && setModelExists(false));
    return () => {
      cancelled = true;
    };
  }, []);

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

    const height = size.y || 1;
    const s = targetHeight / height;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned, targetHeight]);

  return (
    <group ref={group} {...props}>
      <group scale={scale} position={offset}>
        {modelExists === false ? (
          <PlaceholderCase />
        ) : (
          <primitive object={cloned} />
        )}

        {/* Built-in Internal Placeholders for Motherboard and PSU */}
        {showPlaceholders && (
          <group>
            {/* 1. Motherboard Tray Placeholder (Vertical Standoff Area) */}
            <mesh position={[-0.05, 0.9, -0.15]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[1.2, 1.3, 0.02]} />
              <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.3} />
            </mesh>

            {/* 2. PSU Shroud Chamber Placeholder (Bottom Rear Basement) */}
            <mesh position={[-0.3, 0.25, -0.4]}>
              <boxGeometry args={[0.9, 0.45, 0.8]} />
              <meshBasicMaterial color="#eab308" wireframe transparent opacity={0.3} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

function PlaceholderCase() {
  return (
    <group>
      {/* Outer Chassis Wireframe Box */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1.1, 2.2, 1.8]} />
        <meshStandardMaterial color="#1e293b" wireframe />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);