// Which component draws each catalog option. Every option has a `variant` number in
// lab/Catalog.js: 0 is the base component (MotherboardModel), 1 the next one (MotherboardModel1)...
// To add a third board: make MotherboardModel2.jsx, add it to the list, give the option variant: 2.
import MotherboardModel, { MOUNTS as MOUNTS_0 } from "./MotherboardModel";
import MotherboardModel1, { MOUNTS as MOUNTS_1 } from "./MotherboardModel1";
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
import PSUModel1 from "./PSUModel1";
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

// Each PSU's modular sockets, by PSU variant (null: its cables are fixed to it).
export const PSU_PANELS = [PSU_PANEL_0, null, PSU_PANEL_2];

/** <PartModel category="cpu" variant={1} /> draws CPUModel1. Other props go to that component. */
export default function PartModel({ category, variant = 0, ...props }) {
  const list = MODELS[category];
  const Model = list[variant] || list[0];
  return <Model {...props} />;
}
