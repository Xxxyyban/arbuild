// 2 TB NVMe SSD (ssd1.glb), true to size, drawn the same way as StorageModel.jsx.
// Until ssd1.glb is in public/models, the 1 TB drive shows.
import { useMemo } from "react";
import { useGLTF } from "./gltf";
import StorageModel, { fitDrive } from "./StorageModel";
import { MM } from "./orient";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/ssd1.glb";

// ---- FIT: tune these for ssd1.glb only ----
// The file is in metres, 80 × 22 × 3 mm: long along X with its gold pins at -X, chips facing +Z.
const FIT = {
  length: 80 * MM, // an M.2 2280 drive is 80 mm long
  axes: { x: [-1, 0, 0], z: [0, 1, 0] }, // pins (file -X) toward +X, chips (file +Z) up
};

export default function StorageModel1(props) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <StorageModel {...props} />;
  return <RealDrive {...props} />;
}

function RealDrive(props) {
  const { scene } = useGLTF(MODEL_PATH);
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
