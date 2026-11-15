// The CPU socket's moving parts: its lever, the hook that holds the lever down, and on AM5 the hinged
// cover frame (load plate) with its plastic cap. Built with plain three.js in real millimetres, like
// the M.2 cover (m2Cover.js).
//
// They are drawn in the socket's frame (see BuildLab): x to the right (toward the RAM slots), y up
// the board, z out of it, the origin on the CPU's seat in the middle of the socket. Each board says
// where its own pieces go (SOCKET in MotherboardModel.jsx and MotherboardModel1.jsx).
import * as THREE from "three";
import { MM } from "./cableStubs";

// The lever swings up a little past straight. Going up it first swings out from under its hook
// (LEVER_OUT), then lifts; going down it does the reverse.
export const LEVER_LIFT = (-95 * Math.PI) / 180;
export const LEVER_OUT = (3.5 * Math.PI) / 180;
export const PLATE_OPEN = (-105 * Math.PI) / 180; // the cover frame opens up and over to the left

const steel = (color = "#c9ced6") => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.3 });
const plastic = (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.7 });

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/** A rod of radius r from a to b ([x, y, z] in mm). */
function rod(a, b, r, material) {
  const from = new THREE.Vector3(...a);
  const dir = new THREE.Vector3(...b).sub(from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 16), material);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function finish(inner) {
  inner.scale.setScalar(MM);
  const g = new THREE.Group();
  g.add(inner);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/**
 * An AM4 socket lever, with its pivot at the origin: a rod `length` mm long down -Y, its short end
 * bent into the socket (-X) where the cam is, its far end bent out (+X) into a handle.
 */
export function buildZifLever(length = 42, r = 0.9) {
  const g = new THREE.Group();
  const m = steel();
  g.add(rod([-3, 0, 0], [0, 0, 0], r, m)); // into the socket's cam
  g.add(rod([0, 0, 0], [0, -length, 0], r, m));
  g.add(rod([0, -length, 0], [4, -length, 0], r, m)); // the handle, bent out
  [[0, 0, 0], [0, -length, 0], [4, -length, 0]].forEach((p) => {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
    joint.position.set(...p);
    g.add(joint);
  });
  return finish(g);
}

/**
 * The hook that holds a lever down: a post standing beside the lever, `height` mm tall from the
 * origin, with a lip at its top reaching `reach` mm out (+X) over the lever.
 */
export function buildLeverHook(height, reach) {
  const g = new THREE.Group();
  const m = steel("#b9bfc7");
  g.add(box(0.6, 2, height, m, 0.3, 0, height / 2));
  g.add(box(reach, 2, 0.5, m, reach / 2, 0, height - 0.25));
  return finish(g);
}

// The AM5 cover frame, in its hinge's frame: the hinge runs along Y at the origin, the frame
// reaches +X from it, 0.8 mm thick around z = 0. Its window shows the CPU; the tongue on its far
// side is what the lever presses down.
// A board with a socket of another size gives its own (SOCKET.plate.shape): LGA1700's is narrower and taller.
const PLATE = { from: 0.5, to: 49.5, half: 25, window: [7.5, 43.5, 18], tongue: [55.5, 4] };

export function buildLoadPlate(shape = PLATE) {
  const g = new THREE.Group();
  const { from, to, half, window: win, tongue } = shape;
  const outline = new THREE.Shape();
  outline.moveTo(from, -half);
  outline.lineTo(to, -half);
  outline.lineTo(to, -tongue[1]);
  outline.lineTo(tongue[0], -tongue[1]);
  outline.lineTo(tongue[0], tongue[1]);
  outline.lineTo(to, tongue[1]);
  outline.lineTo(to, half);
  outline.lineTo(from, half);
  outline.closePath();
  const hole = new THREE.Path();
  hole.moveTo(win[0], -win[2]);
  hole.lineTo(win[0], win[2]);
  hole.lineTo(win[1], win[2]);
  hole.lineTo(win[1], -win[2]);
  hole.closePath();
  outline.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outline, { depth: 0.8, bevelEnabled: false });
  geo.translate(0, 0, -0.4);
  const metal = steel("#aab1ba");
  g.add(new THREE.Mesh(geo, metal));
  // the hinge's two knuckles
  [-half + 7, half - 7].forEach((y) => g.add(rod([0, y - 4, 0], [0, y + 4, 0], 1.0, metal)));
  return finish(g);
}

/**
 * A socket's plastic cover (AM4's clips over the socket, AM5's cap sits on the cover frame): `w` × `d`
 * mm, 3 mm tall, hollow underneath, centred on the origin with its underside at z = 0.
 */
export function buildSocketCap(w = 44, d = 44) {
  const g = new THREE.Group();
  const black = plastic("#16181c");
  const top = 3, wall = 1, sides = top - 0.8;
  g.add(box(w, d, 0.8, black, 0, 0, top - 0.4));
  g.add(box(w, wall, sides, black, 0, d / 2 - wall / 2, sides / 2));
  g.add(box(w, wall, sides, black, 0, -d / 2 + wall / 2, sides / 2));
  g.add(box(wall, d, sides, black, w / 2 - wall / 2, 0, sides / 2));
  g.add(box(wall, d, sides, black, -w / 2 + wall / 2, 0, sides / 2));
  // a raised panel on top and the pull tab on its right edge
  g.add(box(w - 10, d - 10, 0.4, plastic("#262a31"), 0, 0, top + 0.2));
  g.add(box(3, 6, 1, black, w / 2 + 1.5, 0, top - 0.5));
  return finish(g);
}

/**
 * Splits an indexed geometry's triangles by a test on their 3 corners (moved by `matrix`, in mm):
 * returns [the triangles that pass, the rest], each a geometry sharing the original's attributes.
 */
export function splitTriangles(geometry, matrix, keep) {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const p = new THREE.Vector3();
  const corner = (i) => p.fromBufferAttribute(pos, i).applyMatrix4(matrix).divideScalar(MM).toArray();
  const yes = [], no = [];
  for (let t = 0; t < index.count; t += 3) {
    const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    (tri.every((i) => keep(corner(i))) ? yes : no).push(...tri);
  }
  const part = (list) => {
    const g = new THREE.BufferGeometry();
    Object.entries(geometry.attributes).forEach(([name, attr]) => g.setAttribute(name, attr));
    g.setIndex(list);
    return g;
  };
  return [part(yes), part(no)];
}
