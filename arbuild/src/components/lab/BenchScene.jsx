// 3D pieces shared by both modes (moved out of Assemble.jsx / Disassemble.jsx).
import { useRef, useMemo, useLayoutEffect, useContext, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import CaseModel from "../../Three/CaseModel";
import PartModel from "../../Three/PartModel";
import CaseFanModel from "../../Three/CaseFanModel";
import { PillLabel } from "../../Three/Hardware";
import { ARContext } from "../../Three/xrSetup";
import {
  TABLE, LABEL_OFFSETS, PART_DOT, trayPosition, LAY_ANGLE, measureLocalBox,
  FAN_CONFIG, FRONT_SIGN, FAN_GROUPS, CPU_SOCKET_ABS,
  MOBO_LYING_ROTATION, RAM_LYING_ROTATION, CPU_TRAY_ROTATION,
  PSU_TRAY_ROTATION, GPU_TRAY_ROTATION, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z,
  COOLER_TRAY_LIFT, COOLER_TRAY_YAW, COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z,
} from "../../lab/Constants";

export function CaseWithMeasure({ onMeasure, hideSlotScrews = false, io = null }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    const box = measureLocalBox(ref.current);
    if (!box.isEmpty()) onMeasure(box);
  }, [onMeasure]);
  return (
    <group ref={ref}>
      <CaseModel position={[0, 0, 0]} hideSlotScrews={hideSlotScrews} io={io} />
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

/**
 * Where the case's fans go, from the case's measured box (case space): two on top, three at the front,
 * one at the back. Each: { key, role (top | front | rear), size, dims, position, rotation, flow }, flow
 * being the way its air moves (the front fans pull it in, the others push it out).
 */
export function caseFanLayout(box) {
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
  const back = [-FRONT_SIGN, 0, 0]; // from the front of the case toward its back
  const list = [];

  {
    const g = FAN_GROUPS.top;
    const d = dimsOf(g);
    const size = fitSize(g.size ?? FAN_CONFIG.size, lenX, g.count, d.width);
    for (let i = 0; i < g.count; i++) {
      list.push({
        key: `top${i}`, role: "top", size, dims: d, flow: [0, 1, 0],
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
        key: `front${i}`, role: "front", size, dims: d, flow: back,
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
        key: `rear${i}`, role: "rear", size, dims: d, flow: back,
        position: [x + g.nudge[0], y0 + centered(i, g.count) * step + g.nudge[1], cz + g.nudge[2]],
        rotation: sideRot(g.flip),
      });
    }
  }
  return list;
}

/** The case's fans. spin: turns per second of their blades (0: still). */
export function CaseFans({ box, spin = 0 }) {
  const fans = useMemo(() => caseFanLayout(box), [box]);
  return (
    <>
      {fans.map((f) => (
        <group key={f.key} position={f.position} rotation={f.rotation}>
          <CaseFanModel size={f.size} width={f.dims.width} thickness={f.dims.thickness} length={f.dims.length} spin={spin} />
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

// A part's name tag on the bench: faces the camera and draws on top of the models. `sub` (the model, e.g.
// "DDR4") is a second, dimmer line. Up close a tag would fill the screen, so it hides when the camera comes near.
export function TrayLabel({ name, text, sub = null, offset = LABEL_OFFSETS[name] ?? [0, 0.3, 0] }) {
  const [x, y, z] = trayPosition(name);
  return <PillLabel text={text} sub={sub} dot={PART_DOT[name]} position={[x + offset[0], y + offset[1], z + offset[2]]} hideNear={2.4} />;
}

/**
 * Glides the camera to `focus` ({ key, target, position }, world space) whenever its key changes,
 * then hands the view back to the student. Used to show where a cable goes.
 */
// Glides the camera to `focus` ({ key, position, target }) when it changes; when the focus ends
// (null again), back to `home` ({ position, target }), so the student sees the whole bench.
export function CameraFocus({ focus, home }) {
  const { camera, controls } = useThree();
  const anim = useRef(null);
  const focused = useRef(false);
  const key = focus?.key;
  useEffect(() => {
    if (!controls) return;
    const to = focus || (focused.current ? home : null);
    focused.current = !!focus;
    if (!to) return;
    anim.current = {
      t: 0,
      fromP: camera.position.clone(),
      fromT: controls.target.clone(),
      toP: new THREE.Vector3(...to.position),
      toT: new THREE.Vector3(...to.target),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, controls]);
  useFrame((_, dt) => glide(anim, camera, controls, dt, 0.8));
  return null;
}

/** One frame of a camera glide ({ t, fromP, fromT, toP, toT }) lasting `seconds`, eased at both ends. */
function glide(anim, camera, controls, dt, seconds) {
  const a = anim.current;
  if (!a || !controls) return;
  a.t = Math.min(1, a.t + dt / seconds);
  const k = a.t * a.t * (3 - 2 * a.t);
  camera.position.lerpVectors(a.fromP, a.toP, k);
  controls.target.lerpVectors(a.fromT, a.toT, k);
  controls.update();
  if (a.t >= 1) anim.current = null;
}

/**
 * A phone held upright sees the bench through a tall, narrow window, so at the 45° view the bench's
 * ends are cut off. Below FIT wide-to-tall the view opens up until it shows as much across as a
 * FIT-shaped screen would (to MAX_FOV). Off in WebXR, which sets its own camera.
 */
const FIT = 0.75;
const MAX_FOV = 64;
export function FitFov({ base = 45, enabled = true }) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useEffect(() => {
    if (!enabled || !camera.isPerspectiveCamera || !height) return;
    const aspect = width / height;
    const open = (2 * Math.atan((Math.tan((base * Math.PI) / 360) * FIT) / aspect) * 180) / Math.PI;
    camera.fov = aspect >= FIT ? base : Math.min(open, MAX_FOV);
    camera.updateProjectionMatrix();
  }, [camera, width, height, base, enabled]);
  return null;
}

/**
 * The view buttons on a computer: apiRef.current gets { zoom(factor), home() }. zoom moves the camera
 * toward the point it orbits (factor < 1) or away from it, within the controls' distance limits;
 * home glides back to the whole bench. The mouse wheel and a trackpad pinch zoom as well.
 */
export function ViewControls({ apiRef, home }) {
  const { camera, controls } = useThree();
  const anim = useRef(null);
  useEffect(() => {
    const start = (toP, toT) => {
      anim.current = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP, toT };
    };
    apiRef.current = {
      zoom: (factor) => {
        if (!controls) return;
        const target = controls.target.clone();
        const offset = camera.position.clone().sub(target);
        const d = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
        start(target.clone().add(offset.setLength(d)), target);
      },
      home: () => controls && start(new THREE.Vector3(...home.position), new THREE.Vector3(...home.target)),
    };
    return () => {
      apiRef.current = null;
    };
  }, [camera, controls, apiRef, home]);
  useFrame((_, dt) => glide(anim, camera, controls, dt, 0.35));
  return null;
}

export function BenchLoadingFallback() {
  return (
    <group position={[0, 0.4, 0]}>
      <mesh>
        <torusGeometry args={[0.4, 0.05, 16, 48]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.4} />
      </mesh>
    </group>
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

const RAM_SLOT_LENGTH = 0.6; // a DIMM slot, about 130 mm
// the click box: the slot and the space just above it, up past its walls (so it is hit before them),
// nearly as wide as the gap to the next slot
const RAM_SLOT_HIT = [0.042, 0.07];
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/**
 * A DIMM slot to put the picked-up RAM stick into: a see-through bar on the slot with the slot's
 * number at its lower end. mark = { center, along, up } in world space (along: up the board, up: out
 * of it). `good` (hints on) marks the slots that run in dual channel. With onPlace the whole slot
 * takes the click; without it (while a stick is dragged) the bar only shows the way.
 */
export function RamSlotMarker({ number, showNumber = true, mark, good, onPlace }) {
  const [hover, setHover] = useState(false);
  const quaternion = useMemo(() => {
    _y.set(...mark.along).normalize();
    _z.set(...mark.up).normalize();
    _x.crossVectors(_y, _z).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(_x, _y, _z));
  }, [mark]);
  const color = good ? "#10b981" : "#e5e7eb";
  const handlers = onPlace
    ? {
        onClick: (e) => {
          e.stopPropagation();
          onPlace();
        },
        onPointerDown: (e) => e.stopPropagation(),
        onPointerOver: (e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHover(false);
          document.body.style.cursor = "";
        },
      }
    : {};
  return (
    <group position={mark.center} quaternion={quaternion}>
      <mesh position={[0, 0, 0.012]} renderOrder={998}>
        <boxGeometry args={[0.03, RAM_SLOT_LENGTH, 0.008]} />
        <meshBasicMaterial color={color} transparent opacity={hover ? 0.7 : 0.35} depthTest={false} depthWrite={false} />
      </mesh>
      {onPlace && (
        <mesh position={[0, 0, RAM_SLOT_HIT[1] / 2]} userData={{ partId: `ramslot:${number}` }} {...handlers}>
          <boxGeometry args={[RAM_SLOT_HIT[0], RAM_SLOT_LENGTH, RAM_SLOT_HIT[1]]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {showNumber && (
        <Billboard position={[0, -RAM_SLOT_LENGTH / 2 - 0.045, 0.02]}>
          <Text fontSize={0.05} color={color} outlineWidth={0.005} outlineColor="#111827" anchorX="center" anchorY="middle" renderOrder={999}>
            {String(number)}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// What each non-motherboard part looks like lying on the bench tray.
// `item` is the picked catalog entry; its `variant` picks the component (CPUModel, CPUModel1...).
// `extra` is drawn in the part's own frame (the PSU's socket panel, for one).
export function TrayModel({ name, item, extra = null }) {
  switch (name) {
    case "cpu":
      return (
        <group rotation={CPU_TRAY_ROTATION}>
          <PartModel category="cpu" variant={item?.variant} />
        </group>
      );
    case "storage":
      return <PartModel category="storage" variant={item?.variant} />;
    case "cpu_cooler":
      return (
        <group position={[0, COOLER_TRAY_LIFT, 0]} rotation={[0, COOLER_TRAY_YAW, 0]}>
          <group rotation={MOBO_LYING_ROTATION}>
            <group rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
              <PartModel category="cpu_cooler" variant={item?.variant} />
            </group>
          </group>
        </group>
      );
    case "ram1":
      return (
        <group rotation={RAM_LYING_ROTATION}>
          <PartModel category="ram" variant={item?.variant} accentColor="#34d399" />
        </group>
      );
    case "ram2":
      return (
        <group rotation={RAM_LYING_ROTATION}>
          <PartModel category="ram" variant={item?.variant} accentColor="#e8a33d" />
        </group>
      );
    case "psu":
      return (
        <group rotation={PSU_TRAY_ROTATION}>
          <PartModel category="psu" variant={item?.variant} />
          {extra}
        </group>
      );
    case "gpu":
      return (
        <group rotation={GPU_TRAY_ROTATION}>
          <PartModel category="gpu" variant={item?.variant} spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
        </group>
      );
    default:
      return null;
  }
}