// Cooler Master compact tower cooler. Its own component, so its size and orientation are tuned
// for cpu_cooler1.glb only. Until that file is in public/models, the stock cooler (CPUCoolerModel.jsx) shows.
import CPUCoolerModel from "./CPUCoolerModel";
import FittedGLB from "./FittedGLB";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/cpu_cooler1.glb";

// ---- FIT: tune these for cpu_cooler1.glb only ----
// The file is 2.93 × 4.48 × 2.53, standing up (tallest along Y, base plate at the bottom).
const FIT = {
  length: 0.62, // height in scene units (about 128 mm)
  turn: [0, 0, 0], // turn the raw file (radians) so the base faces the CPU like the stock cooler
  lift: 0, // raise or lower it on the CPU, scene units
  // its fan hangs off one side, so the box centre is not the base plate's: this centres the base
  // plate (copper block) on the CPU. File Z runs across the CPU, toward the RAM.
  nudge: [0, 0, -0.049],
};

export default function CPUCoolerModel1({ spinX = 0, spinY = 0, spinZ = 0, ...props }) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <CPUCoolerModel spinX={spinX} spinY={spinY} spinZ={spinZ} {...props} />;
  return (
    <group {...props} rotation={[spinX, spinY, spinZ]}>
      <FittedGLB url={MODEL_PATH} length={FIT.length} turn={FIT.turn} lift={FIT.lift} nudge={FIT.nudge} />
    </group>
  );
}
