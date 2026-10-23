// Loads a .glb and fits it: optional turn of the raw file, longest side scaled to `length`,
// centred on X/Z and resting on Y = 0, then moved by `nudge`. Used by the variant components
// (GPUModel1, PSUModel1...), which each pass their own FIT values.
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function FittedGLB({ url, length, turn = [0, 0, 0], lift = 0, nudge = [0, 0, 0] }) {
  const { scene } = useGLTF(url);
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
    cloned.rotation.set(turn[0], turn[1], turn[2]);
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = length / (Math.max(size.x, size.y, size.z) || 1);
    return { scale: s, offset: [-center.x * s + nudge[0], -box.min.y * s + lift + nudge[1], -center.z * s + nudge[2]] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, length, turn[0], turn[1], turn[2], lift, nudge[0], nudge[1], nudge[2]]);

  return (
    <group scale={scale} position={offset}>
      <primitive object={cloned} />
    </group>
  );
}
