// LGA1700 board (ASUS ROG STRIX Z790-E GAMING WIFI II). It has no file: z790Board.js builds it, and
// its LAYOUT table (millimetres on the board) gives both the model and the mounts below, so the CPU,
// the memory, the plugs and the printed labels all come from the same numbers.
import { useMemo } from "react";
import { MM } from "./cableStubs";
import { buildZifLever } from "./cpuSocket";
import { isLite } from "./graphics";
import { BOARD, LAYOUT, buildZ790Board } from "./z790Board";
import { MOTHERBOARD_TARGET } from "../lab/Constants";

// ---- FIT: where the board sits in the case (case space: +x the case front, +y up, +z the glass) ----
// True size, on the AM5 board's footprint (its PCB measured in the case: left edge -0.8577, bottom
// edge 0.6085, front face -0.375). That puts the rear panel in the case's I/O opening, where the AM5
// board's shield is, and the top edge level with the other boards'.
const CORNER = [-0.8577, 0.6085]; // its bottom-left corner (rear, bottom) in the case
const PCB_FRONT = -0.375; // its front face: the same standoffs as the other boards

/** A spot on the board (x mm from its left edge, t mm down from its top, z mm off its front) in case space. */
const inCase = (x, t, z = 0) => [CORNER[0] + x * MM, CORNER[1] + (BOARD.h - t) * MM, PCB_FRONT + z * MM];
/** The same spot in board space (what MOUNTS is in: see BASE_MOUNTS in lab/Constants). */
const onBoard = (x, t, z = 0) => {
  const c = inCase(x, t, z);
  const m = MOTHERBOARD_TARGET.position;
  return [m[0] - c[0], c[1] - m[1], m[2] - c[2]];
};

const S = LAYOUT.socket;
const LID_TOP = 4.84; // the CPU's lid above its underside, mm (cpu2.glb; lab/Paste.js LIDS)
const sock = inCase(S.x, S.t);
/** A header's place the way the lab reads it: mm from the socket's centre, x right, y up (in true MM). */
const header = ({ x, t, label, along }) => {
  const c = inCase(x, t);
  return { at: [(c[0] - sock[0]) / MM, (c[1] - sock[1]) / MM], ...(label && { label }), ...(along && { along }) };
};

// ---- MOUNTS: where parts sit on this board ----
export const MOUNTS = {
  scale: [1, 1, 1],
  cpu: onBoard(S.x, S.t, S.seat),
  cooler: onBoard(S.x, S.t, S.seat + LID_TOP),
  ram: LAYOUT.dimm.x.map((x) => onBoard(x, LAYOUT.dimm.t, LAYOUT.dimm.floor)),
  storage: onBoard(LAYOUT.m2.x, LAYOUT.m2.t, LAYOUT.m2.z),
  gpu: [-0.326, 1.0859, -0.419], // case space: the first x16 slot is where the other boards' is (LAYOUT.pcie[0], z790Board.js pcieSlots)
  pcbFront: PCB_FRONT,
  holes: LAYOUT.holes.map(([x, t]) => inCase(x, t).slice(0, 2)),
  atx24: inCase(LAYOUT.atx24.x, LAYOUT.atx24.t).slice(0, 2),
  eps8: inCase(LAYOUT.eps8[0].x, LAYOUT.eps8[0].t).slice(0, 2),
  headers: Object.fromEntries(Object.entries(LAYOUT.headers).map(([id, h]) => [id, header(h)])),
};

let built = null; // the board, built once; each one shown is a copy sharing its shapes and textures
const board = () => (built ||= buildZ790Board({ lite: isLite() }));

export default function MotherboardModel2({ spinY = 0, ...props }) {
  const object = useMemo(() => board().clone(true), []);
  // the board's own frame (mm, seen from the front) turned to face the way board space does
  const corner = onBoard(0, BOARD.h, 0);
  return (
    <group {...props} rotation={[0, spinY, 0]}>
      <group position={corner} rotation={[0, Math.PI, 0]} scale={MM}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/* ---------- the CPU socket (Three/cpuSocket.js) ---------- */
// An LGA1700 socket: the pins are in it, and a steel cover frame (the load plate) presses the CPU onto
// them. The lever down its right side holds the frame shut. In mm in the socket's frame (x right,
// y up the board, z out; 0 = the CPU's seat). The real frame hinges at the socket's top end; here it
// swings on its left side like the AM5 board's, so both LGA sockets work the same way in the lab.
const LEVER_LENGTH = 56;
function LeverBody() {
  const object = useMemo(() => buildZifLever(LEVER_LENGTH), []);
  return <primitive object={object} />;
}

const CAP = [38, 50]; // its plastic cap: over a 37.5 x 45 mm socket
export const SOCKET = {
  kind: "lga",
  lever: { Body: LeverBody, pivot: [25.5 * MM, 27 * MM, 3.4 * MM], length: LEVER_LENGTH * MM },
  hook: { at: [23.8 * MM, -27 * MM, -0.5 * MM], height: 5.2, reach: 2 },
  plate: {
    hinge: [-22 * MM, 0, 2.9 * MM],
    // narrower and taller than AM5's: its window shows the lid, and it presses on the lid's two long shoulders
    shape: { from: 0.5, to: 44, half: 27, window: [6.5, 37.5, 20.5], tongue: [47.5, 4] },
    cap: { at: [22 * MM, 0, 0.4 * MM], size: CAP },
  },
  cap: { size: CAP },
};
