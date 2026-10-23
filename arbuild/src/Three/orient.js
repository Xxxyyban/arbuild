// Turning a model file so its own axes point where the lab expects, without ever mirroring it.
import * as THREE from "three";

export const MM = 1.467 / 305; // scene units per millimetre (a 305 mm ATX board is 1.467 long)

/**
 * Rotation that sends two of the file's axes to the given directions, e.g.
 * { z: [0, 1, 0], y: [0, 0, -1] } turns the file's Z up and its Y toward -Z.
 * The third axis follows (right-handed), so the model is never mirrored.
 */
export function orientQuaternion(map) {
  const [a, b] = Object.keys(map);
  const c = "xyz".replace(a, "").replace(b, "");
  const ta = new THREE.Vector3(...map[a]);
  const tb = new THREE.Vector3(...map[b]);
  const cyclic = ["xy", "yz", "zx"].includes(a + b);
  const tc = cyclic ? new THREE.Vector3().crossVectors(ta, tb) : new THREE.Vector3().crossVectors(tb, ta);
  const cols = { [a]: ta, [b]: tb, [c]: tc };
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cols.x, cols.y, cols.z));
}

