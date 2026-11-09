// 850 W 80+ Gold PSU. Its own component, so its size and orientation are tuned for psu2.glb only.
// Until psu2.glb is in public/models, the 550 W model (PSUModel.jsx) shows.
import PSUModel, { MODULAR as BASE_MODULAR, INLET as BASE_INLET } from "./PSUModel";
import FittedGLB from "./FittedGLB";
import { useFileExists } from "./useFileExists";

const MODEL_PATH = "/models/psu2.glb";

// ---- FIT: tune these for psu2.glb only ----
// No model file yet: add public/models/psu2.glb, then tune FIT for it.
// Its modular sockets. Until psu2.glb is added it shows the 550 W model, so it uses that one's;
// measure this file's own sockets when it arrives.
export const MODULAR = BASE_MODULAR;
// Its mains inlet, for the power cord: the same goes for this one.
export const INLET = BASE_INLET;

const FIT = {
  length: 0.76, // longest side in scene units (about 160 mm; the 550 W unit is 0.71)
  turn: [0, 0, 0], // turn the raw file (radians) so the fan faces the same way as the 550 W unit
  lift: 0,
};

export default function PSUModel2({ spinY = 0, ...props }) {
  const ok = useFileExists(MODEL_PATH);
  if (ok === null) return null;
  if (!ok) return <PSUModel spinY={spinY} {...props} />;
  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <FittedGLB url={MODEL_PATH} length={FIT.length} turn={FIT.turn} lift={FIT.lift} />
    </group>
  );
}
