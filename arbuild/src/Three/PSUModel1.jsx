// Aerocool KCAS 500 W PSU. Its own component, so its size and orientation are tuned for psu1.glb only.
// Until psu1.glb is in public/models, the 550 W model (PSUModel.jsx) shows.
import PSUModel from "./PSUModel";
import FittedGLB from "./FittedGLB";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/psu1.glb";

// ---- FIT: tune these for psu1.glb only ----
// The file is in metres, 152 × 86 × 158 mm, oriented like psu.glb (thin along Y).
const FIT = {
  length: 0.74, // longest side in scene units (158 mm; the 550 W unit is 0.71)
  // half a turn so the power socket faces out of the case's back and the modular sockets face in
  turn: [0, Math.PI, 0],
  lift: 0,
  // it is 12 mm deeper than the 550 W unit; this keeps its back flush with the case's back panel
  nudge: [0, 0, -0.029],
};

export default function PSUModel1({ spinY = 0, ...props }) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <PSUModel spinY={spinY} {...props} />;
  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <FittedGLB url={MODEL_PATH} length={FIT.length} turn={FIT.turn} lift={FIT.lift} nudge={FIT.nudge} />
    </group>
  );
}
