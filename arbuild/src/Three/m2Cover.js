// The M.2 cover (heatsink) that sits over a board's SSD slot, held down by two screws. Built with
// plain three.js like the cable plugs (cableStubs.js), in real millimetres scaled to the scene.
//
// It is drawn in the SSD's own frame (see Three/StorageModel.jsx fitDrive): x = 0 is the drive's
// gold pins and the drive runs along -X, +Y is up out of the board. The cover's thermal pad rests on
// top of the drive (SSD_TOP), from just over the connector to past the drive's end screw. It goes on
// every board whose file has no M.2 heatsink of its own (the AM4 board brings its own: M2_COVER in
// MotherboardModel.jsx), and each board places it at its own M.2 slot (MOUNTS.storage).
import * as THREE from "three";
import { MM } from "./cableStubs";

const LENGTH = 92; // mm, from 6 mm over the connector to 86 mm along the drive
const WIDTH = 25;
const PAD = 1.2; // thermal pad thickness
const PLATE = 2.6; // aluminium base plate thickness
const FIN = 3.2; // fin height
const X0 = 6; // the cover's end over the connector (mm, +X)
const MID = X0 - LENGTH / 2;

export const SSD_TOP = 2.6 * MM; // the tallest drive is 2.5 mm thick: the pad rests just on it
export const M2_COVER_TOP = (PAD + PLATE) * MM; // the plate's top, where the screw heads sit
// the cover's two screws (from the pad's underside), and the drive's own screw at its far end (from
// the drive's underside): a 2280 drive's notch is 1.2 mm in from its end
export const M2_COVER_SCREWS = [
  [(X0 - 3.5) * MM, M2_COVER_TOP, 0],
  [(X0 - LENGTH + 3.5) * MM, M2_COVER_TOP, 0],
];
export const SSD_SCREW = [-78.8 * MM, 0, 0];

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.7, ...opts });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/** Where a cover goes to lie on the bench at the origin: centred, its underside at y = 0. */
export function restingOffset(cover) {
  const box = new THREE.Box3().setFromObject(cover);
  const c = box.getCenter(new THREE.Vector3());
  return [-c.x, -box.min.y, -c.z];
}

/** The cover, in scene units, its pad's underside at y = 0. */
export function buildM2Cover() {
  const g = new THREE.Group();
  g.name = "m2_cover";
  const inner = new THREE.Group();
  const metal = mat("#2f343b");
  const finMetal = mat("#3b424b", { roughness: 0.35 });
  const dark = mat("#111317", { metalness: 0.2, roughness: 0.8 });

  // the grey thermal pad that presses on the drive's chips
  inner.add(box(80, PAD, WIDTH - 4, mat("#c3cbd4", { metalness: 0, roughness: 0.9 }), -40, PAD / 2, 0));
  // the base plate, with its corners eased
  const plate = box(LENGTH, PLATE, WIDTH, metal, MID, PAD + PLATE / 2, 0);
  inner.add(plate);
  // fins along the length, clear of the screw ends
  const finLen = LENGTH - 20;
  [-9, -4.5, 0, 4.5, 9].forEach((z) => inner.add(box(finLen, FIN, 1.8, finMetal, MID, PAD + PLATE + FIN / 2, z)));
  // a counterbored hole at each end for its screw
  [X0 - 3.5, X0 - LENGTH + 3.5].forEach((x) => {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 20), dark);
    hole.position.set(x, PAD + PLATE + 0.1, 0);
    inner.add(hole);
  });
  // the "M.2" marking between the fins and the connector end
  const mark = box(5, 0.2, 9, mat("#7c8794", { metalness: 0.4 }), X0 - 9, PAD + PLATE + 0.1, 0);
  inner.add(mark);

  inner.scale.setScalar(MM);
  g.add(inner);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
