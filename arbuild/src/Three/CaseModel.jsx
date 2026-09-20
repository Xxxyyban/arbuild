import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/models/case-meshify-c.glb";
const TARGET_HEIGHT = 3.2; // world units — matches the height our old placeholder used

/**
 * Real scanned/modeled PC case (Fractal Design Meshify C, user-supplied
 * .glb). Auto-centers and auto-scales itself to a consistent height
 * regardless of the units the source file was exported in, so it drops
 * into the scene at a predictable size without manual tuning.
 */
export default function CaseModel(props) {
  const group = useRef();
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

    const height = size.y || 1;
    const s = TARGET_HEIGHT / height;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned]);

  return (
    <group ref={group} {...props}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);