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

// It is semi-modular. The front face (the side that faces into the case) is z = -0.399 in the PSU's
// own frame: the file's front is 79 mm from its centre, times the fit scale, plus the nudge.
// MODULAR: its four PCI-E sockets (printed on the model, so `printed` skips our labels), measured by
// ray-casting the fitted model; like MODULAR in PSUModel.jsx. The PCI-E cable takes the top-left one.
export const MODULAR = {
  face: -0.399,
  printed: true,
  sockets: {
    pcie: { label: "PCI-E", at: [[0.041, 0.221]], spare: [[-0.04, 0.221], [0.041, 0.168], [-0.04, 0.168]] },
  },
};

// FIXED: the 24-pin and CPU cables are fixed. They leave through the grommet on the front face (the
// round hole beside the PCI-E sockets, measured the same way); until
// one is routed out it lies coiled on the bench in front of the PSU (`coils`: each cable's x).
// See FixedCables in Hardware.jsx.
export const FIXED = {
  face: -0.399,
  exit: [0.27, 0.22],
  coils: { atx24: 0.21, eps8: 0.0, pcie: -0.21 },
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
