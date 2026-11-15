// AM5 CPU (Ryzen 5 7600X). Its own component, so its size and orientation are tuned
// for this file only. The AM4 CPU is CPUModel.jsx.
import { useEffect, useMemo } from "react";
import { useGLTF } from "./gltf";
import * as THREE from "three";
import { MM } from "./orient";
import CPUModel from "./CPUModel";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/cpu1.glb";

// ---- FIT: tune these for cpu1.glb only ----
// The file is 0.040 × 0.0057 × 0.040 (metres: a 40 mm chip), already lying flat (thin axis Y).
const FIT = {
  width: 40 * MM, // side length: a 40 × 40 mm AM5 package, the same as AM4
  flip: false, // true if it shows the pads side up
  turn: 0, // extra turn around the up axis in radians (to line the gold triangle up)
  lift: 0, // raise or lower it in the socket, scene units
};

export default function CPUModel1(props) {
  return <FittedCPU path={MODEL_PATH} fit={FIT} {...props} />;
}

/**
 * A CPU file lying flat, fitted by fit = { width (its longest side), flip, turn, lift }: this one and
 * the LGA1700 CPU (CPUModel2.jsx). The AM4 CPU shows while the file isn't there.
 */
export function FittedCPU({ path, ...props }) {
  const ok = useFileExists(path);
  if (ok === null) return null;
  if (!ok) return <CPUModel {...props} />; // file not added yet: show the AM4 CPU
  return <RealCPU path={path} {...props} />;
}

function RealCPU({ path, fit: FIT, spinY = 0, ...props }) {
  const { scene } = useGLTF(path);
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
    // point the thinnest side up so the chip lies flat, then apply this file's own fixes
    cloned.rotation.set(0, 0, 0);
    cloned.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(cloned).getSize(new THREE.Vector3());
    const axes = [
      [raw.x, new THREE.Vector3(1, 0, 0)],
      [raw.y, new THREE.Vector3(0, 1, 0)],
      [raw.z, new THREE.Vector3(0, 0, 1)],
    ].sort((a, b) => a[0] - b[0]);
    const up = new THREE.Vector3(0, FIT.flip ? -1 : 1, 0);
    cloned.quaternion
      .setFromUnitVectors(axes[0][1], up)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), FIT.turn));
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = FIT.width / (Math.max(size.x, size.z) || 1);
    return { scale: s, offset: [-center.x * s, -box.min.y * s + FIT.lift, -center.z * s] };
  }, [cloned, FIT]);

  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group scale={scale} position={offset}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}
