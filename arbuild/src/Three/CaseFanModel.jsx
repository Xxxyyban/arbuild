import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "./gltf";

// Put case_fan.glb in your project's public/models/ folder
// (or change this path to wherever your other .glb files live).
const MODEL_URL = "/models/case_fan.glb";

// The raw model is 0.0962 wide, with its spin axis along Y.
const MODEL_SIZE = 0.0962;

// The model is one mesh. Its blades and hub turn on their own: every triangle within ROTOR_R of the
// spin axis (the mesh's own units; its frame is about 9.3 across) is the rotor, the rest the frame.
// Measured on case_fan.glb: the cut that crosses the fewest triangles, just inside the frame's ring.
const ROTOR_R = 4.62;
const split = new WeakMap(); // geometry -> { rotor, frame }, made once and shared by every fan

function splitFan(geometry) {
  if (split.has(geometry)) return split.get(geometry);
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const at = (k) => (index ? index.getX(k) : k);
  const inside = (i) => Math.hypot(pos.getX(i), pos.getZ(i)) < ROTOR_R;
  const rotor = [];
  const frame = [];
  for (let k = 0; k < count; k += 3) {
    const tri = [at(k), at(k + 1), at(k + 2)];
    (tri.every(inside) ? rotor : frame).push(...tri);
  }
  const part = (list) => {
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geometry.attributes)) g.setAttribute(name, attr);
    g.setIndex(list);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };
  const out = { rotor: part(rotor), frame: part(frame) };
  split.set(geometry, out);
  return out;
}

// size      frame width in scene units (0.6 ≈ a 120 mm fan here).
// width     multiplier on the model's X direction.
// thickness multiplier along the spin axis / airflow (Y).
// length    multiplier on the model's Z direction.
// spin      turns per second of the blades (its sign sets the direction); 0 stands still. They
//           speed up and slow down smoothly.
// All three size multipliers default to 1 (the model's original proportions).
// The fan is centred on its origin, spin axis along +Y.
export default function CaseFanModel({ size = 0.6, width = 1, thickness = 1, length = 1, spin = 0, ...props }) {
  const { scene } = useGLTF(MODEL_URL);
  const speed = useRef(0);
  const fan = useMemo(() => {
    const clone = scene.clone(true);
    const meshes = [];
    clone.traverse((o) => o.isMesh && meshes.push(o));
    const rotors = meshes.map((o) => {
      const parts = splitFan(o.geometry);
      o.geometry = parts.frame;
      const blades = new THREE.Mesh(parts.rotor, o.material); // a child: it turns about the mesh's own Y axis
      o.add(blades);
      return blades;
    });
    return { object: clone, rotors };
  }, [scene]);
  const k = size / MODEL_SIZE;

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    speed.current += (spin - speed.current) * (1 - Math.exp(-step * 1.5)); // spins up over a second or two
    if (Math.abs(speed.current) < 1e-3) return;
    for (const r of fan.rotors) r.rotation.y += speed.current * Math.PI * 2 * step;
  });

  return (
    <group {...props} scale={[k * width, k * thickness, k * length]}>
      <primitive object={fan.object} position={[0, -0.0102, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
