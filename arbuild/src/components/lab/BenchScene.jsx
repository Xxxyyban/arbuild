// 3D pieces shared by both modes (moved out of Assemble.jsx / Disassemble.jsx).
import { useRef, useMemo, useLayoutEffect, useContext } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import CaseModel from "../../Three/CaseModel";
import RAMModel from "../../Three/RAMModel";
import CPUModel from "../../Three/CPUModel";
import PSUModel from "../../Three/PSUModel";
import GPUModel from "../../Three/GPUModel";
import CPUCoolerModel from "../../Three/CPUCoolerModel";
import StorageModel from "../../Three/StorageModel";
import CaseFanModel from "../../Three/CaseFanModel";
import { ARContext } from "../../Three/xrSetup";
import {
  TABLE, LABEL_OFFSETS, trayPosition, LAY_ANGLE, measureLocalBox,
  FAN_CONFIG, FRONT_SIGN, FAN_GROUPS, CPU_SOCKET_ABS,
  MOBO_LYING_ROTATION, RAM_LYING_ROTATION, RAM_SCALE, CPU_TRAY_ROTATION,
  PSU_TRAY_ROTATION, GPU_TRAY_ROTATION, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z,
  COOLER_TRAY_LIFT, COOLER_TRAY_YAW, COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z, STORAGE_DIMS,
} from "../../lab/Constants";

export function CaseWithMeasure({ onMeasure }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    const box = measureLocalBox(ref.current);
    if (!box.isEmpty()) onMeasure(box);
  }, [onMeasure]);
  return (
    <group ref={ref}>
      <CaseModel position={[0, 0, 0]} />
    </group>
  );
}

export function CaseRig({ laidDown, pose, children }) {
  const ref = useRef();
  const placed = useRef(false);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g || !pose) return;
    const tx = laidDown ? pose[0] : 0;
    const ty = laidDown ? pose[1] : 0;
    const tz = laidDown ? pose[2] : 0;
    const tr = laidDown ? LAY_ANGLE : 0;
    if (!placed.current) {
      g.position.set(tx, ty, tz);
      g.rotation.x = tr;
      placed.current = true;
      return;
    }
    const k = 1 - Math.exp(-dt * 7);
    g.position.x += (tx - g.position.x) * k;
    g.position.y += (ty - g.position.y) * k;
    g.position.z += (tz - g.position.z) * k;
    g.rotation.x += (tr - g.rotation.x) * k;
  });
  return (
    <group ref={ref} rotation={[LAY_ANGLE, 0, 0]}>
      {children}
    </group>
  );
}

// A removed part: starts where it was released, glides to its tray spot.
export function Flyer({ from, to, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5);
    g.position.x += (to[0] - g.position.x) * k;
    g.position.y += (to[1] - g.position.y) * k;
    g.position.z += (to[2] - g.position.z) * k;
    g.rotation.x += (0 - g.rotation.x) * k;
    g.rotation.y += (0 - g.rotation.y) * k;
    g.rotation.z += (0 - g.rotation.z) * k;
  });
  return (
    <group ref={ref} position={from.position} rotation={from.rotation}>
      {children}
    </group>
  );
}

// Flies a part away when the PC overheats.
export function Blast({ active, position = [0, 0, 0], rotation = [0, 0, 0], outZ = 1, power = 1, children }) {
  const outer = useRef();
  const spinner = useRef();
  const elapsed = useRef(0);
  const motion = useMemo(
    () => ({
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1 + Math.random() * 2),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(10),
    }),
    []
  );
  useFrame((_, dt) => {
    const o = outer.current;
    const s = spinner.current;
    if (!o || !s) return;
    if (active) elapsed.current += Math.min(dt, 0.05);
    else elapsed.current = 0;
    const t = elapsed.current;
    o.position.set(
      position[0] + motion.vel.x * t * power,
      position[1] + motion.vel.y * t * power,
      position[2] + motion.vel.z * outZ * t * power
    );
    s.rotation.set(motion.spin.x * t, motion.spin.y * t, motion.spin.z * t);
  });
  return (
    <group ref={outer} position={position}>
      <group ref={spinner}>
        <group rotation={rotation}>{children}</group>
      </group>
    </group>
  );
}

export function CaseFans({ box }) {
  const fans = useMemo(() => {
    const { min, max } = box;
    const lenX = max.x - min.x;
    const lenY = max.y - min.y;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const cz = (min.z + max.z) / 2;
    const { gap, margin, clearance } = FAN_CONFIG;

    const dimsOf = (g) => ({ ...FAN_CONFIG.dims, ...(g.dims || {}) });
    const fitSize = (want, len, count, w) =>
      Math.max(0.15, Math.min(want, (len - 2 * margin - (count - 1) * gap) / (count * w)));
    const centered = (i, count) => i - (count - 1) / 2;
    const inset = (size, d) => size * 0.104 * d.thickness + clearance;
    const sideRot = (flip) => {
      const a = FRONT_SIGN > 0 ? Math.PI / 2 : -Math.PI / 2;
      return [0, 0, flip ? a + Math.PI : a];
    };
    const list = [];

    {
      const g = FAN_GROUPS.top;
      const d = dimsOf(g);
      const size = fitSize(g.size ?? FAN_CONFIG.size, lenX, g.count, d.width);
      for (let i = 0; i < g.count; i++) {
        list.push({
          key: `top${i}`, size, dims: d,
          position: [cx + centered(i, g.count) * (size * d.width + gap) + g.nudge[0], max.y - inset(size, d) + g.nudge[1], cz + g.nudge[2]],
          rotation: [g.flip ? Math.PI : 0, 0, 0],
        });
      }
    }
    {
      const g = FAN_GROUPS.front;
      const d = dimsOf(g);
      const size = fitSize(g.size ?? FAN_CONFIG.size, lenY, g.count, d.width);
      const x = FRONT_SIGN > 0 ? max.x - inset(size, d) : min.x + inset(size, d);
      for (let i = 0; i < g.count; i++) {
        list.push({
          key: `front${i}`, size, dims: d,
          position: [x + g.nudge[0], cy + centered(i, g.count) * (size * d.width + gap) + g.nudge[1], cz + g.nudge[2]],
          rotation: sideRot(g.flip),
        });
      }
    }
    {
      const g = FAN_GROUPS.rear;
      const d = dimsOf(g);
      const size = fitSize(g.size ?? FAN_CONFIG.size, lenY, g.count, d.width);
      const x = FRONT_SIGN > 0 ? min.x + inset(size, d) : max.x - inset(size, d);
      const step = size * d.width + gap;
      const span = ((g.count - 1) * step) / 2;
      const lo = min.y + margin + (size * d.width) / 2 + span;
      const hi = max.y - margin - (size * d.width) / 2 - span;
      const y0 = Math.min(hi, Math.max(lo, CPU_SOCKET_ABS[1]));
      for (let i = 0; i < g.count; i++) {
        list.push({
          key: `rear${i}`, size, dims: d,
          position: [x + g.nudge[0], y0 + centered(i, g.count) * step + g.nudge[1], cz + g.nudge[2]],
          rotation: sideRot(g.flip),
        });
      }
    }
    return list;
  }, [box]);

  return (
    <>
      {fans.map((f) => (
        <group key={f.key} position={f.position} rotation={f.rotation}>
          <CaseFanModel size={f.size} width={f.dims.width} thickness={f.dims.thickness} length={f.dims.length} />
        </group>
      ))}
    </>
  );
}

export function Workbench() {
  const inAR = useContext(ARContext);
  const [cx, cy, cz] = TABLE.center;
  const [w, d] = TABLE.size;
  const legX = w / 2 - 0.15;
  const legZ = d / 2 - 0.15;
  const legY = -TABLE.thickness - TABLE.legHeight / 2;
  if (inAR) return null; // the real table is the surface in AR
  return (
    <group position={[cx, cy, cz]}>
      <mesh position={[0, -TABLE.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[w, TABLE.thickness, d]} />
        <meshStandardMaterial color={TABLE.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.3, d - 0.3]} />
        <meshStandardMaterial color={TABLE.matColor} roughness={0.95} />
      </mesh>
      {[[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]].map(([x, z], i) => (
        <mesh key={i} position={[x, legY, z]}>
          <boxGeometry args={[0.1, TABLE.legHeight, 0.1]} />
          <meshStandardMaterial color="#5b4630" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Always faces the camera and always draws on top of models.
export function TrayLabel({ name, text, offset = LABEL_OFFSETS[name] ?? [0, 0.35, 0] }) {
  const [x, y, z] = trayPosition(name);
  const w = text.length * 0.075 + 0.22;
  return (
    <Billboard position={[x + offset[0], y + offset[1], z + offset[2]]}>
      <mesh raycast={() => null} renderOrder={999}>
        <planeGeometry args={[w, 0.17]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.85} depthTest={false} />
      </mesh>
      <Text
        position={[0, 0, 0.001]} fontSize={0.085} color="#ffffff" anchorX="center" anchorY="middle"
        renderOrder={1000} material-depthTest={false} raycast={() => null}
      >
        {text}
      </Text>
    </Billboard>
  );
}

export function BenchLoadingFallback() {
  return (
    <group position={[0, 0.4, 0]}>
      <mesh>
        <torusGeometry args={[0.4, 0.05, 16, 48]} />
        <meshStandardMaterial color="#4fd8c9" emissive="#4fd8c9" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function ThermalPaste() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.028, 0.028, 0.006, 24]} />
      <meshStandardMaterial color="#c9ced6" roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

// Green pulsing marker shown in AR at the selected part's slot. Tap it to place the part.
export function TargetMarker({ name, pose, onPlace, radius = 0.22 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.15);
  });
  return (
    <group position={pose.position}>
      <mesh
        ref={ref}
        userData={{ partId: `target:${name}` }}
        renderOrder={998}
        onClick={(e) => {
          e.stopPropagation();
          onPlace();
        }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color="#3ddc84" transparent opacity={0.55} depthTest={false} />
      </mesh>
    </group>
  );
}

// What each non-motherboard part looks like lying on the bench tray.
// `item` is the picked catalog entry; parts with several models (CPU) use its file.
export function TrayModel({ name, item }) {
  switch (name) {
    case "cpu":
      return (
        <group rotation={CPU_TRAY_ROTATION}>
          <CPUModel path={item?.model} />
        </group>
      );
    case "storage":
      return <StorageModel {...STORAGE_DIMS} />;
    case "cpu_cooler":
      return (
        <group position={[0, COOLER_TRAY_LIFT, 0]} rotation={[0, COOLER_TRAY_YAW, 0]}>
          <group rotation={MOBO_LYING_ROTATION}>
            <group rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
              <CPUCoolerModel />
            </group>
          </group>
        </group>
      );
    case "ram1":
      return (
        <group rotation={RAM_LYING_ROTATION} scale={RAM_SCALE}>
          <RAMModel accentColor="#4fd8c9" />
        </group>
      );
    case "ram2":
      return (
        <group rotation={RAM_LYING_ROTATION} scale={RAM_SCALE}>
          <RAMModel accentColor="#e8a33d" />
        </group>
      );
    case "psu":
      return (
        <group rotation={PSU_TRAY_ROTATION}>
          <PSUModel />
        </group>
      );
    case "gpu":
      return (
        <group rotation={GPU_TRAY_ROTATION}>
          <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
        </group>
      );
    default:
      return null;
  }
}