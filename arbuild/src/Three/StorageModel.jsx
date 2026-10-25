// 1 TB M.2 2280 NVMe drive (ssd.glb), true to size. Drawn the lab's way (see STORAGE_MOUNT_ROTATION in
// lab/Constants): lying flat, chips up, gold pins at the origin, the drive running along -X.
import { useMemo } from "react";
import { useGLTF } from "./gltf";
import * as THREE from "three";
import { orientQuaternion, MM } from "./orient";

const MODEL_URL = "/models/ssd.glb";

// ---- FIT: tune these for ssd.glb only ----
// The file is 1.19 × 0.10 × 4.29: long along Z, flat on Y. Its pins are at the +Z end.
const FIT = {
  length: 80 * MM, // an M.2 2280 drive is 80 mm long
  axes: { z: [1, 0, 0], y: [0, 1, 0] }, // file Z (pins at +Z) along +X, file Y up
};

export default function StorageModel(props) {
  const { scene } = useGLTF(MODEL_URL);
  const object = useMemo(() => scene.clone(true), [scene]);
  const { scale, offset } = useMemo(() => fitDrive(object, FIT), [object]);
  return (
    <group {...props}>
      <group scale={scale} position={offset}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/** Turns a drive file the lab's way and sizes it: pins at the origin, body along -X, resting on Y = 0. */
export function fitDrive(object, fit) {
  object.rotation.set(0, 0, 0);
  object.quaternion.copy(orientQuaternion(fit.axes));
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = fit.length / (size.x || 1);
  return { scale: s, offset: [-box.max.x * s, -box.min.y * s, -center.z * s] };
}

useGLTF.preload(MODEL_URL);
