// LGA1700 CPU (Intel Core i9-12900K). Its own fit; drawn by CPUModel1.jsx's FittedCPU.
// The file (cpu2.glb, by teodor088, CC BY 4.0: see pages/About.jsx) is true to size: a 45 x 37.5 mm
// package lying flat, its long side along the file's X.
import { MM } from "./orient";
import { FittedCPU } from "./CPUModel1";

const MODEL_PATH = "/models/cpu2.glb";

const FIT = {
  width: 45 * MM, // its long side: an LGA1700 package is 45 mm up the board, 37.5 mm across
  flip: false,
  turn: Math.PI / 2, // the long side up the board, the way the socket takes it
  lift: 0,
};

export default function CPUModel2(props) {
  return <FittedCPU path={MODEL_PATH} fit={FIT} {...props} />;
}
