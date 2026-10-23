// AMD Radeon RX 6700 XT. Its own component, so its size and orientation are tuned for
// gpu1.glb only. Until gpu1.glb is in public/models, the RTX 3060 Ti model (GPUModel.jsx) shows.
import GPUModel from "./GPUModel";
import FittedGLB from "./FittedGLB";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/gpu1.glb";

// ---- FIT: tune these for gpu1.glb only ----
// The file is 4.97 × 1.94 × 0.71: length along X, thin along Z (the 3060 Ti file is long on Z).
const FIT = {
  length: 1.32, // card length in scene units (267 mm; the 242 mm 3060 Ti is 1.199)
  turn: [0, Math.PI / 2, 0], // turn the raw file (radians) so it matches the 3060 Ti's orientation
  lift: 0, // raise or lower it in the PCIe slot, scene units
  // lines it up with the 3060 Ti: bracket on the same case slot, PCB in the x16 slot's groove, gold
  // fingers in the slot (file axes: X is down the card's height, Y out of the board, Z along its length)
  nudge: [-0.011, 0.064, -0.0605],
};

export default function GPUModel1({ spinX = 0, spinY = 0, spinZ = 0, ...props }) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <GPUModel spinX={spinX} spinY={spinY} spinZ={spinZ} {...props} />;
  return (
    <group {...props} rotation={[spinX, spinY, spinZ]}>
      <FittedGLB url={MODEL_PATH} length={FIT.length} turn={FIT.turn} lift={FIT.lift} nudge={FIT.nudge} />
    </group>
  );
}
