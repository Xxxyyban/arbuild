// Which component draws each catalog option. Every option has a `variant` number in
// lab/Catalog.js: 0 is the base component (MotherboardModel), 1 the next one (MotherboardModel1)...
// To add a third board: make MotherboardModel2.jsx, add it to the list, give the option variant: 2.
import { Suspense } from "react";
import MotherboardModel, { MOUNTS as MOUNTS_0, M2_COVER as M2_COVER_0, SOCKET as SOCKET_0 } from "./MotherboardModel";
import MotherboardModel1, { MOUNTS as MOUNTS_1, SOCKET as SOCKET_1 } from "./MotherboardModel1";
import CPUModel from "./CPUModel";
import CPUModel1 from "./CPUModel1";
import RAMModel from "./RAMModel";
import RAMModel1 from "./RAMModel1";
import CPUCoolerModel from "./CPUCoolerModel";
import CPUCoolerModel1 from "./CPUCoolerModel1";
import StorageModel from "./StorageModel";
import StorageModel1 from "./StorageModel1";
import GPUModel from "./GPUModel";
import GPUModel1 from "./GPUModel1";
import PSUModel, { MODULAR as PSU_PANEL_0 } from "./PSUModel";
import PSUModel1, { MODULAR as PSU_PANEL_1, FIXED as PSU_FIXED_1 } from "./PSUModel1";
import PSUModel2, { MODULAR as PSU_PANEL_2 } from "./PSUModel2";

const MODELS = {
  motherboard: [MotherboardModel, MotherboardModel1],
  cpu: [CPUModel, CPUModel1],
  ram: [RAMModel, RAMModel1],
  cpu_cooler: [CPUCoolerModel, CPUCoolerModel1],
  storage: [StorageModel, StorageModel1],
  gpu: [GPUModel, GPUModel1],
  psu: [PSUModel, PSUModel1, PSUModel2],
};

// Where the CPU, RAM and SSD sit on each board, by board variant.
export const BOARD_MOUNTS = [MOUNTS_0, MOUNTS_1];
// Each board's M.2 cover, by board variant (null: the lab's built one, Hardware.jsx BUILT_M2_COVER).
export const BOARD_M2_COVERS = [M2_COVER_0, null];
// Each board's CPU socket lever, its hook, and (AM5) its cover frame, by board variant.
export const BOARD_SOCKETS = [SOCKET_0, SOCKET_1];

// Each PSU's modular sockets, by PSU variant (null: its cables are fixed to it).
export const PSU_PANELS = [PSU_PANEL_0, PSU_PANEL_1, PSU_PANEL_2];
// where a PSU with fixed cables has them (by variant): the Aerocool's grommet and coils
export const PSU_FIXED = [null, PSU_FIXED_1, null];

/** <PartModel category="cpu" variant={1} /> draws CPUModel1. Other props go to that component. */
export default function PartModel({ category, variant = 0, ...props }) {
  const list = MODELS[category];
  const Model = list[variant] || list[0];
  // its own loading boundary: a part whose file is still loading shows nothing for now, and the rest of
  // the bench stays on screen instead of all of it waiting behind the loading ring
  return (
    <Suspense fallback={null}>
      <Model {...props} />
    </Suspense>
  );
}
