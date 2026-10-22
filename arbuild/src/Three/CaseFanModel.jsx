import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

// Put case_fan.glb in your project's public/models/ folder
// (or change this path to wherever your other .glb files live).
const MODEL_URL = "/models/case_fan.glb";

// The raw model is 0.0962 wide, with its spin axis along Y.
const MODEL_SIZE = 0.0962;

// size      frame width in scene units (0.6 ≈ a 120 mm fan here).
// width     multiplier on the model's X direction.
// thickness multiplier along the spin axis / airflow (Y).
// length    multiplier on the model's Z direction.
// All three default to 1 (the model's original proportions).
// The fan is centred on its origin, spin axis along +Y.
export default function CaseFanModel({ size = 0.6, width = 1, thickness = 1, length = 1, ...props }) {
  const { scene } = useGLTF(MODEL_URL);
  const object = useMemo(() => scene.clone(true), [scene]);
  const k = size / MODEL_SIZE;

  return (
    <group {...props} scale={[k * width, k * thickness, k * length]}>
      <primitive object={object} position={[0, -0.0102, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);