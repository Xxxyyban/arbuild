import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

// Put ssd.glb in your project's public/models/ folder
// (or change this path to wherever your other .glb files live).
const MODEL_URL = "/models/ssd.glb";

// The raw model is ~4.29 units long. An M.2 2280 stick is 80 mm, and this
// scene runs at roughly 0.005 units per mm, so 0.0933 makes it ~0.4 units.
// Raise/lower this if the drive looks too big or small on the board.
const SSD_SCALE = 0.0933;

// Shape multipliers (all default to 1 = the model's original proportions):
//   length    the long side of the stick (model X)
//   width     the short side of the stick (model Z)
//   thickness how tall it stands off the board (model Y)
export default function StorageModel({ length = 1, width = 1, thickness = 1, ...props }) {
  const { scene } = useGLTF(MODEL_URL);
  const object = useMemo(() => scene.clone(true), [scene]);

  return (
    <group
      {...props}
      scale={[SSD_SCALE * length, SSD_SCALE * thickness, SSD_SCALE * width]}
    >
      {/* the offset re-centres the model on its own origin */}
      <primitive object={object} position={[0, 0.0238, -0.0016]} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);