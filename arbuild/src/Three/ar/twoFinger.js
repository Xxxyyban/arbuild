// What two fingers on the AR view mean. A gesture is one thing from start to finish: a drag (both
// fingers going the same way) moves the model, a pinch or twist resizes and turns it. Whichever
// passes its own threshold first wins, so a drag never resizes by accident and a pinch never slides.
// Plain maths, no React (just three's vector/matrix classes): tests/lab/cordcheck.mjs runs it.
import * as THREE from "three";

export const MIN_SCALE = 0.35;
export const MAX_SCALE = 4;
export const clampScale = (v) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

const MOVE_PX = 14; // the fingers' midpoint must travel this far to count as a drag
const PINCH = 0.06; // the gap between them must change by this share to count as a pinch
const TWIST = 0.1; // or the line between them turn by this many radians (about 6 degrees)

/** Two touches as one reading: d the gap between them, a its angle, (x, y) their midpoint. */
export const fingers = (a, b) => ({
  d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
  a: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

/** An angle's change, the short way round (so crossing 180 degrees is not a full turn). */
export const turned = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** "pinch", "move", or null while the fingers have not yet done enough to tell. */
export function intent(start, now) {
  if (Math.abs(now.d / Math.max(1, start.d) - 1) >= PINCH || Math.abs(turned(start.a, now.a)) >= TWIST) return "pinch";
  if (Math.hypot(now.x - start.x, now.y - start.y) >= MOVE_PX) return "move";
  return null;
}

export const MAX_SLIDE = 3; // how far it may be slid from where it was placed (metres in the room)

const V = { at: new THREE.Vector3(), to: new THREE.Vector3(), right: new THREE.Vector3(), away: new THREE.Vector3(), tmp: new THREE.Vector3() };

/**
 * Turns a two-finger drag (s.pan, in shares of the view) into a slide of the rig along the floor:
 * sideways follows the fingers exactly at the rig's distance, and up the screen is away from the
 * camera, further the flatter the camera looks (as the floor itself runs away from it).
 */
export function slide(camera, g, s) {
  const e = camera.projectionMatrix.elements; // e[0], e[5]: 1 / tan(half the view's width, height)
  g.getWorldPosition(V.at);
  const d = V.tmp.setFromMatrixPosition(camera.matrixWorld).distanceTo(V.at);
  V.right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0);
  if (V.right.lengthSq() < 1e-6) return;
  V.right.normalize();
  V.away.set(V.right.z, 0, -V.right.x); // level, away from the camera
  const down = -camera.getWorldDirection(V.tmp).y; // how steeply the camera looks down (1 = straight down)
  const reach = 1 / Math.min(1, Math.max(0.4, down));
  V.to.copy(V.at).addScaledVector(V.right, (s.pan.x * d) / e[0]).addScaledVector(V.away, ((s.pan.y * d) / e[5]) * reach);
  // into the frame the rig sits in (the placement's, scaled to real size)
  g.parent.worldToLocal(V.at);
  g.parent.worldToLocal(V.to);
  s.target.x += V.to.x - V.at.x;
  s.target.z += V.to.z - V.at.z;
  const max = MAX_SLIDE / (g.parent.getWorldScale(V.tmp).x || 1);
  const far = Math.hypot(s.target.x, s.target.z);
  if (far > max) {
    s.target.x *= max / far;
    s.target.z *= max / far;
  }
}
