// DDR5 stick (TeamGroup T-Force). Its own component, so its size and orientation are tuned for ram1.glb only.
// Until ram1.glb is in public/models, the DDR4 stick (RAMModel.jsx) shows.
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { orientQuaternion, MM } from "./orient";
import RAMModel from "./RAMModel";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/ram1.glb";

const STICK_LENGTH = 133.35 * MM; // a DIMM is 133.35 mm long, DDR5 the same as DDR4

export default function RAMModel1({ accentColor, ...props }) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <RAMModel accentColor={accentColor} {...props} />;
  return <RealRAM {...props} />;
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
    // ram1.glb: length along X, height along Y (contacts at the bottom), thickness along Z
    cloned.rotation.set(0, 0, 0);
    cloned.quaternion.copy(orientQuaternion({ x: [0, 1, 0], y: [0, 0, -1] }));
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
