import { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Center, Environment, Lightformer } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import CaseModel from "../Three/CaseModel";
import MotherboardModel, { MOUNTS as AM4_MOUNTS } from "../Three/MotherboardModel";
import CPUModel from "../Three/CPUModel";
import CPUCoolerModel from "../Three/CPUCoolerModel";
import RAMModel from "../Three/RAMModel";
import PSUModel from "../Three/PSUModel";
import GPUModel from "../Three/GPUModel";
import StorageModel from "../Three/StorageModel";
import CaseFanModel from "../Three/CaseFanModel";
import {
  GLBridge,
  ARHitTest,
  ARRoot,
  CameraDirector,
  OverlayProjector,
  CamAR,
  useARSupport,
  startARSession,
  requestMotion,
} from "../Three/ar/ARTools";
import {
  QUADRANTS,
  QuadrantGuides,
  quadrantFromLocal,
  quadrantRect,
  measureBoxInSpace,
  BOARD_VIEW_SIGN,
} from "../Three/ar/boardQuadrants";
import WorldCard from "../Three/ar/WorldCard";
import { PARTS, buildPartInfo, buildQuadInfo } from "../Three/ar/partInfo";
import { boardLayout, moboLocalToWorld, STORAGE_MOUNT_ROTATION, CPU_SOCKET_ABS } from "../lab/Constants";
import "../styles/Main.css";
import "../styles/ar.css";

const MOTHERBOARD_POSITION = [-0.3, 0.53, -0.3];
const MOTHERBOARD_ROTATION = [0, Math.PI, 0];
// The AM4 board and where its parts sit: the same fit and mount points as the Build Lab
// (MOUNTS in Three/MotherboardModel.jsx). Parts on the board undo its stretch (UNSTRETCH) so they
// keep their real proportions.
const AM4 = boardLayout(AM4_MOUNTS);
const MOTHERBOARD_SCALE = AM4.scale;
const UNSTRETCH = MOTHERBOARD_SCALE.map((v) => 1 / v);
const onBoard = (local) => moboLocalToWorld(MOTHERBOARD_POSITION, local, MOTHERBOARD_ROTATION, MOTHERBOARD_SCALE);
const RAM_SLOTS = [AM4.ramSlots[0], AM4.ramSlots[2]]; // slots 1 and 3: dual channel

const PSU_POSITION = [-0.625, 0.48, 0.00005];
const PSU_ROTATION = [Math.PI, (3 * Math.PI) / 2, 0];
const PSU_SCALE = [1, 1, 1];

const GPU_POSITION = AM4_MOUNTS.gpu;
const GPU_ROTATION = [0, Math.PI, 0];
const GPU_SCALE = [1, 1, 1];
const GPU_SPIN_X = -Math.PI / 2;
const GPU_SPIN_Y = Math.PI / 2;
const GPU_SPIN_Z = 0;

const COOLER_SPIN_X = Math.PI / 2;
const COOLER_YAW_DEGREES = 90;
const COOLER_SPIN_Y = (COOLER_YAW_DEGREES * Math.PI) / 180;
const COOLER_SPIN_Z = Math.PI;

const FAN_CONFIG = {
  size: 0.6,
  gap: 0.02,
  margin: 0.05,
  clearance: 0.02,
  dims: { width: 1.01, thickness: 0.65, length: 0.95 },
};
const FRONT_SIGN = 1;
const FAN_GROUPS = {
  top:   { count: 2, size: null, dims: null, nudge: [0, -0.041, 0.125], flip: false },
  front: { count: 3, size: null, dims: null, nudge: [-0.03, 0.084, 0.035], flip: false },
  rear:  { count: 1, size: null, dims: null, nudge: [0, 0.225, 0.145], flip: false },
};

const RIG_Y_OFFSET = 2.0;
const CALIBRATE = false;
const REAR_MESH_HINT = /(i\/?o[\s_-]?shield|back[\s_-]?(panel|plate)|rear)/i;

const REAR_IO_ZONE = { position: [0.5, 1.0, 0.0], size: [0.2, 0.5, 0.1] };
const REAR_ZONE_PAD = 0.02;

// ---------------------------------------------------------------------------
// AR / camera settings
// ---------------------------------------------------------------------------
const RIG_CENTER = new THREE.Vector3(0, RIG_Y_OFFSET, 0);
const AR_TARGET_HEIGHT = 0.4; // how tall the case is in the real room (metres)
const AR_FOCUS_SCALE = 1.8;   // how much the rig grows when you tap the board in AR
const CARD_UNIT = 0.55;       // size of the in-scene info card (bigger = bigger card)

// Scatter view: each part floats out to its own spot around the chassis.
const EXPLODE_SCALE = 1;
const EXPLODE = {
  psu:    [-0.4, -0.6, -1.8],
  gpu:    [1.8, 0.3, 1.5],
  board:  [-1.8, 0.4, 1.4],
  cpu:    [0.2, 2.2, 0.2],
  cooler: [1.2, 2.8, -1.2],
  ram1:   [-1.6, 1.9, -1.4],
  ram2:   [1.9, 1.0, -1.6],
  ssd:    [-0.2, -0.9, 1.9],
};

// Iron Man style reassembly.
const ASSEMBLE_ORDER = ["psu", "board", "ssd", "cpu", "ram1", "ram2", "cooler", "gpu"];
const FLY_DURATION = 0.45;
const ASSEMBLE_STAGGER = 0.22;
const SCATTER_STAGGER = 0.03;
const FLOAT_BOB = 0.02;

const SHAKE_AMOUNT = 0.05;
const SHAKE_DECAY = 4;
const SHAKE_FREQ = 70;
const SHAKE_FLY_JITTER = 0.015;

const KICK_IMPULSE = 2.4;
const KICK_STIFFNESS = 90;
const KICK_DAMPING = 8;
const KICK_WEIGHT = {
  psu: 1.2,
  gpu: 1.0,
  board: 1.4,
  cpu: 0.5,
  cooler: 0.6,
  ram1: 0.4,
  ram2: 0.4,
  ssd: 0.5,
};

const OPEN_SIDE = 1;
const GATE_MARGIN = 0.35;
const LIFT_MARGIN = 0.45;

const HOME = {
  psu: PSU_POSITION,
  gpu: GPU_POSITION,
  board: MOTHERBOARD_POSITION,
  cpu: onBoard(AM4.cpuLocal),
  cooler: onBoard(AM4.coolerLocal),
  ram1: onBoard(RAM_SLOTS[0]),
  ram2: onBoard(RAM_SLOTS[1]),
  ssd: onBoard(AM4.storageLocal),
};

const toBoardLocal = (w) => [
  -w[0] / MOTHERBOARD_SCALE[0],
  w[1] / MOTHERBOARD_SCALE[1],
  -w[2] / MOTHERBOARD_SCALE[2],
];

function buildPath(id, box) {
  const d = EXPLODE[id].map((v) => v * EXPLODE_SCALE);
  const H = HOME[id];
  const gz = box
    ? (OPEN_SIDE > 0 ? box.max.z + GATE_MARGIN : box.min.z - GATE_MARGIN) - H[2]
    : OPEN_SIDE * 1.0;
  const gate = [0, 0, gz];
  const home = [0, 0, 0];
  if (d[2] * OPEN_SIDE >= gz * OPEN_SIDE) return [d, gate, home];
  const topY = box ? box.max.y + LIFT_MARGIN - H[1] : 2;
  const upY = Math.max(d[1], topY);
  return [d, [d[0], upY, d[2]], [d[0], upY, gz], gate, home];
}

function pathAt(pts, u) {
  const lens = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    lens.push(l);
    total += l;
  }
  let remaining = (1 - u) * total;
  for (let i = 0; i < lens.length; i++) {
    if (remaining <= lens[i] || i === lens.length - 1) {
      const f = lens[i] > 0 ? Math.min(1, remaining / lens[i]) : 1;
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
        pts[i][2] + (pts[i + 1][2] - pts[i][2]) * f,
      ];
    }
    remaining -= lens[i];
  }
  return pts[pts.length - 1];
}

const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function isInsideRearZone(p) {
  if (!p) return false;
  const [cx, cy] = REAR_IO_ZONE.position;
  const [w, h] = REAR_IO_ZONE.size;
  return Math.abs(p.x - cx) <= w / 2 + REAR_ZONE_PAD && Math.abs(p.y - cy) <= h / 2 + REAR_ZONE_PAD;
}

// Only used while CALIBRATE is true (hotspots with no info card are ignored).
const HOTSPOTS = [
  { id: "motherboard_rear", position: [0.5, 1.0, 0.0], size: [0.2, 0.5, 0.1], calibrated: false },
  { id: "io_usb", position: [0.35, 1.05, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_video", position: [0.35, 0.9, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_lan", position: [0.35, 0.75, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "io_audio", position: [0.35, 0.6, 0.05], size: [0.08, 0.08, 0.05], calibrated: false },
  { id: "pcie", position: [0.0, 0.3, 0.05], size: [0.2, 0.05, 0.05], calibrated: false },
  { id: "sata", position: [-0.4, 0.3, 0.05], size: [0.1, 0.05, 0.05], calibrated: false },
  { id: "atx_power", position: [-0.45, 0.6, 0.05], size: [0.05, 0.12, 0.05], calibrated: false },
  { id: "front_panel", position: [-0.3, 0.2, 0.05], size: [0.1, 0.04, 0.05], calibrated: false },
];

function Hotspot({ position, size, onSelect }) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={position}
      onClick={(e) => {
        if (CALIBRATE && e.nativeEvent.shiftKey) return;
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial
        color={CALIBRATE ? "#ff3b8d" : "#ffffff"}
        transparent
        opacity={CALIBRATE ? 0.35 : hovered ? 0.14 : 0}
        depthWrite={false}
      />
    </mesh>
  );
}


function measureLocalBox(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const isVisible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  root.traverse((o) => {
    const invisibleMat = o.material && !Array.isArray(o.material) && o.material.opacity === 0;
    if (o.isMesh && o.geometry && isVisible(o) && !invisibleMat) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
    }
  });
  return box;
}

function CaseWithMeasure({ onMeasure }) {
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

function CaseFans({ box }) {
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
          key: `top${i}`,
          size,
          dims: d,
          position: [
            cx + centered(i, g.count) * (size * d.width + gap) + g.nudge[0],
            max.y - inset(size, d) + g.nudge[1],
            cz + g.nudge[2],
          ],
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
          key: `front${i}`,
          size,
          dims: d,
          position: [
            x + g.nudge[0],
            cy + centered(i, g.count) * (size * d.width + gap) + g.nudge[1],
            cz + g.nudge[2],
          ],
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
          key: `rear${i}`,
          size,
          dims: d,
          position: [
            x + g.nudge[0],
            y0 + centered(i, g.count) * step + g.nudge[1],
            cz + g.nudge[2],
          ],
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
          <CaseFanModel
            size={f.size}
            width={f.dims.width}
            thickness={f.dims.thickness}
            length={f.dims.length}
          />
        </group>
      ))}
    </>
  );
}

function RigLoadingFallback() {
  const ref = useRef();
  return (
    <group position={[0, RIG_Y_OFFSET, 0]}>
      <mesh ref={ref}>
        <torusGeometry args={[0.4, 0.05, 16, 48]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

// Places its children at the displacement the sequencer computed for `id`.
function Floaty({ id, parentId, disp, children }) {
  const ref = useRef();
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const d = disp.current[id];
    if (parentId) {
      const b = disp.current[parentId];
      const l = toBoardLocal([d[0] - b[0], d[1] - b[1], d[2] - b[2]]);
      g.position.set(l[0], l[1], l[2]);
    } else {
      g.position.set(d[0], d[1], d[2]);
    }
  });
  return <group ref={ref}>{children}</group>;
}

// Maps the info ids to the scene node (userData.partId).
const PART_NODE = {
  cpu: "cpu",
  cpu_cooler: "cooler",
  storage: "ssd",
  ram: "ram1",
  psu: "psu",
  gpu: "gpu",
  motherboard: "board",
  motherboard_rear: "board",
};
const MODAL_FOR = {
  psu: "psu",
  gpu: "gpu",
  cpu: "cpu",
  cooler: "cpu_cooler",
  ssd: "storage",
  ram1: "ram",
  ram2: "ram",
};

function DesktopRig({ onOpenModal, onBoardTap, onCalibrate, onMeasureCase, caseBox, exploded, rigApi, focused, activeQuad }) {
  const mbRef = useRef();
  const cornerA = useRef(null);
  const rigRef = useRef();
  const caseRef = useRef();
  const boardMeshRef = useRef();
  const partCache = useRef({});
  const [boardBox, setBoardBox] = useState(null);

  // Measure the bare motherboard model so we can cut it into 4 quadrants.
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (mbRef.current && boardMeshRef.current) {
        const b = measureBoxInSpace(boardMeshRef.current, mbRef.current);
        if (!b.isEmpty()) {
          setBoardBox(b);
          clearInterval(id);
        }
      }
      if (tries > 30) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const findNode = (id) => {
    if (!partCache.current[id]) {
      rigRef.current?.traverse((o) => {
        if (!partCache.current[id] && o.userData?.partId === id) partCache.current[id] = o;
      });
    }
    return partCache.current[id];
  };

  const handleBoard = (worldPoint, obj) => {
    const local = mbRef.current.worldToLocal(worldPoint.clone());
    const name = `${obj?.name || ""} ${obj?.parent?.name || ""}`;
    onBoardTap({
      rear: REAR_MESH_HINT.test(name) || isInsideRearZone(local),
      quadrant: boardBox ? quadrantFromLocal(local, boardBox) : null,
    });
  };

  // Re-created every render so it always sees the latest props.
  useEffect(() => {
    const ray = new THREE.Raycaster();
    rigApi.current = {
      anchorWorld(id) {
        const mb = mbRef.current;
        if (!mb) return null;
        if (QUADRANTS[id]) {
          return boardBox ? mb.localToWorld(quadrantRect(id, boardBox).center) : null;
        }
        const node = PART_NODE[id] && findNode(PART_NODE[id]);
        return node ? new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()) : null;
      },
      // How far the info card should sit from the anchor so it does not cover the part.
      anchorRadius(id) {
        if (QUADRANTS[id]) {
          const b = rigApi.current.board();
          return b ? b.radius * 0.28 : 0.3;
        }
        const node = PART_NODE[id] && findNode(PART_NODE[id]);
        return node
          ? new THREE.Box3().setFromObject(node).getBoundingSphere(new THREE.Sphere()).radius * 0.7
          : 0.3;
      },
      board() {
        const mb = mbRef.current;
        if (!mb || !boardBox) return null;
        const s = boardBox.getSize(new THREE.Vector3());
        return {
          center: mb.localToWorld(boardBox.getCenter(new THREE.Vector3())),
          normal: new THREE.Vector3(0, 0, BOARD_VIEW_SIGN).transformDirection(mb.matrixWorld),
          radius: 0.5 * Math.hypot(s.x * MOTHERBOARD_SCALE[0], s.y * MOTHERBOARD_SCALE[1]) * 1.35,
        };
      },
      boardInRoot(root) {
        const mb = mbRef.current;
        if (!mb || !boardBox) return null;
        return root.worldToLocal(mb.localToWorld(boardBox.getCenter(new THREE.Vector3())));
      },
      // AR tap: the ray comes from the phone, the first hit that belongs to a part wins.
      tap(origin, dir) {
        ray.set(origin, dir.normalize());
        for (const h of ray.intersectObject(rigRef.current, true)) {
          let o = h.object;
          let id = null;
          while (o && !id) {
            id = o.userData?.partId || null;
            o = o.parent;
          }
          if (!id) continue;
          if (id === "board") handleBoard(h.point, h.object);
          else onOpenModal(MODAL_FOR[id]);
          return;
        }
      },
    };
  });

  // Chassis recoil state (spring-damper) and which parts have already kicked it.
  const kickPos = useRef(new THREE.Vector3());
  const kickVel = useRef(new THREE.Vector3());
  const kicked = useRef(Object.fromEntries(ASSEMBLE_ORDER.map((id) => [id, false])));
  const kickDirs = useMemo(
    () =>
      Object.fromEntries(
        ASSEMBLE_ORDER.map((id) => [id, new THREE.Vector3(...EXPLODE[id]).normalize()])
      ),
    []
  );

  const paths = useMemo(
    () => Object.fromEntries(ASSEMBLE_ORDER.map((id) => [id, buildPath(id, caseBox)])),
    [caseBox]
  );
  const prog = useRef(Object.fromEntries(ASSEMBLE_ORDER.map((id) => [id, 0])));
  const disp = useRef(Object.fromEntries(ASSEMBLE_ORDER.map((id) => [id, [0, 0, 0]])));
  const toggledAt = useRef(0);
  const lastExploded = useRef(exploded);
  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;
    if (lastExploded.current !== exploded) {
      lastExploded.current = exploded;
      toggledAt.current = now;
      ASSEMBLE_ORDER.forEach((id) => { kicked.current[id] = false; });
    }
    const elapsed = now - toggledAt.current;
    const step = Math.min(dt, 0.05) / FLY_DURATION;

    const burst = exploded ? Math.exp(-elapsed * SHAKE_DECAY) : 0;
    if (rigRef.current) {
      const t = now * SHAKE_FREQ;
      rigRef.current.position.set(
        Math.sin(t) * SHAKE_AMOUNT * burst,
        RIG_Y_OFFSET + Math.sin(t * 1.3 + 1) * SHAKE_AMOUNT * 0.6 * burst,
        Math.cos(t * 0.9) * SHAKE_AMOUNT * burst
      );
    }
    ASSEMBLE_ORDER.forEach((id, i) => {
      const delay = exploded
        ? (ASSEMBLE_ORDER.length - 1 - i) * SCATTER_STAGGER
        : i * ASSEMBLE_STAGGER;
      if (elapsed >= delay) {
        const next = prog.current[id] + (exploded ? step : -step);
        prog.current[id] = Math.min(1, Math.max(0, next));
        if (exploded && !kicked.current[id]) {
          kicked.current[id] = true;
          kickVel.current.addScaledVector(kickDirs[id], KICK_IMPULSE * (KICK_WEIGHT[id] ?? 1));
        }
      }
      const p = prog.current[id];
      const d = pathAt(paths[id], easeInOutCubic(p));
      const settle = Math.min(1, Math.max(0, (p - 0.85) / 0.15));
      const bob = Math.sin(now * 1.2 + i) * FLOAT_BOB * settle;
      const moving = 4 * p * (1 - p);
      const jt = now * SHAKE_FREQ + i * 2.1;
      const jx = Math.sin(jt) * SHAKE_FLY_JITTER * moving;
      const jy = Math.sin(jt * 1.17 + 2) * SHAKE_FLY_JITTER * moving;
      const jz = Math.cos(jt * 0.83) * SHAKE_FLY_JITTER * moving;
      disp.current[id] = [d[0] + jx, d[1] + bob + jy, d[2] + jz];
    });

    const h = Math.min(dt, 0.05);
    const kp = kickPos.current;
    const kv = kickVel.current;
    kv.x += (-KICK_STIFFNESS * kp.x - KICK_DAMPING * kv.x) * h;
    kv.y += (-KICK_STIFFNESS * kp.y - KICK_DAMPING * kv.y) * h;
    kv.z += (-KICK_STIFFNESS * kp.z - KICK_DAMPING * kv.z) * h;
    kp.addScaledVector(kv, h);
    if (caseRef.current) caseRef.current.position.copy(kp);
  });
  return (
    <group ref={rigRef} position={[0, RIG_Y_OFFSET, 0]}>
      <pointLight position={[0, 1.2, 1.4]} intensity={25} decay={2} />
      <pointLight position={[0, 1.2, -1.4]} intensity={20} decay={2} />
      <pointLight position={[0, 2.2, 0]} intensity={15} decay={2} />
      <Center>
        <group ref={caseRef}>
          <CaseWithMeasure onMeasure={onMeasureCase} />
          {caseBox && <CaseFans box={caseBox} />}
        </group>

        <Floaty id="psu" disp={disp}>
          <group
            userData={{ partId: "psu" }}
            position={PSU_POSITION}
            rotation={PSU_ROTATION}
            scale={PSU_SCALE}
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal("psu");
            }}
          >
            <PSUModel />
          </group>
        </Floaty>

        <Floaty id="gpu" disp={disp}>
          <group
            userData={{ partId: "gpu" }}
            position={GPU_POSITION}
            rotation={GPU_ROTATION}
            scale={GPU_SCALE}
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal("gpu");
            }}
          >
            <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
          </group>
        </Floaty>

        <Floaty id="board" disp={disp}>
          <group
            ref={mbRef}
            userData={{ partId: "board" }}
            position={MOTHERBOARD_POSITION}
            rotation={MOTHERBOARD_ROTATION}
            scale={MOTHERBOARD_SCALE}
            onClick={(e) => {
              e.stopPropagation();
              if (CALIBRATE && e.nativeEvent.shiftKey && mbRef.current) {
                const meshName = `${e.object?.name || ""} ${e.object?.parent?.name || ""}`.trim();
                const p = mbRef.current.worldToLocal(e.point.clone());
                if (!cornerA.current) {
                  cornerA.current = p;
                  onCalibrate(`Corner 1 saved (mesh: ${meshName || "unnamed"}). Now Shift+click the opposite corner.`);
                } else {
                  const a = cornerA.current;
                  const r = (n) => Number(n.toFixed(3));
                  const position = [(a.x + p.x) / 2, (a.y + p.y) / 2, (a.z + p.z) / 2].map(r);
                  const size = [Math.abs(a.x - p.x), Math.abs(a.y - p.y), Math.abs(a.z - p.z)].map((n) => r(Math.max(n, 0.05)));
                  const line = `position: [${position.join(", ")}], size: [${size.join(", ")}]`;
                  onCalibrate(line);
                  cornerA.current = null;
                }
                return;
              }
              handleBoard(e.point, e.object);
            }}
          >
            <group ref={boardMeshRef}>
              <MotherboardModel />
            </group>

            <QuadrantGuides box={boardBox} visible={focused && !exploded} active={activeQuad} />

            {HOTSPOTS.filter((h) => CALIBRATE || h.calibrated).map((h) => (
              <Hotspot key={h.id} position={h.position} size={h.size} onSelect={() => onOpenModal(h.id)} />
            ))}

            {CALIBRATE && (
              <mesh position={REAR_IO_ZONE.position} raycast={() => null}>
                <boxGeometry args={[REAR_IO_ZONE.size[0], REAR_IO_ZONE.size[1], 0.02]} />
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} />
              </mesh>
            )}

            <Floaty id="cpu" parentId="board" disp={disp}>
              <group
                userData={{ partId: "cpu" }}
                position={AM4.cpuLocal}
                scale={UNSTRETCH}
                onClick={(e) => { e.stopPropagation(); onOpenModal("cpu"); }}
              >
                <group rotation={[Math.PI / 2, 0, Math.PI]}>
                  <CPUModel />
                </group>
              </group>
            </Floaty>

            <Floaty id="cooler" parentId="board" disp={disp}>
              <group
                userData={{ partId: "cooler" }}
                position={AM4.coolerLocal}
                scale={UNSTRETCH}
                onClick={(e) => { e.stopPropagation(); onOpenModal("cpu_cooler"); }}
              >
                <group rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
                  <CPUCoolerModel />
                </group>
              </group>
            </Floaty>

            <Floaty id="ssd" parentId="board" disp={disp}>
              <group
                userData={{ partId: "ssd" }}
                position={AM4.storageLocal}
                scale={UNSTRETCH}
                onClick={(e) => { e.stopPropagation(); onOpenModal("storage"); }}
              >
                <group rotation={STORAGE_MOUNT_ROTATION}>
                  <StorageModel />
                </group>
              </group>
            </Floaty>

            <Floaty id="ram1" parentId="board" disp={disp}>
              <group
                userData={{ partId: "ram1" }}
                position={RAM_SLOTS[0]}
                scale={UNSTRETCH}
                onClick={(e) => { e.stopPropagation(); onOpenModal("ram"); }}
              >
                <RAMModel accentColor="#34d399" />
              </group>
            </Floaty>

            <Floaty id="ram2" parentId="board" disp={disp}>
              <group
                userData={{ partId: "ram2" }}
                position={RAM_SLOTS[1]}
                scale={UNSTRETCH}
                onClick={(e) => { e.stopPropagation(); onOpenModal("ram"); }}
              >
                <RAMModel accentColor="#e8a33d" />
              </group>
            </Floaty>
          </group>
        </Floaty>
      </Center>
    </group>
  );
}

export default function MainPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [modalPart, setModalPart] = useState(null);
  const [activeQuad, setActiveQuad] = useState(null);
  const [calibPoint, setCalibPoint] = useState(null);
  const [exploded, setExploded] = useState(false);
  const [caseBox, setCaseBox] = useState(null);
  const [boardFocus, setBoardFocus] = useState(false);

  // /main?ar=1 opens straight into the full-screen "tap to start AR" screen.
  const deepLink = new URLSearchParams(window.location.search).get("ar") === "1";
  const [focusMode, setFocusMode] = useState(deepLink);
  const [splash, setSplash] = useState(deepLink);
  const [inAR, setInAR] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [arError, setArError] = useState("");

  // Camera (+ gyroscope) AR for devices without WebXR.
  const [camMode, setCamMode] = useState(false);
  const [gyro, setGyro] = useState(false);
  const [placeToken, setPlaceToken] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const arLite = camMode && gyro; // camera + gyroscope (iPhone)
  const arLike = inAR || arLite;  // anything that behaves like AR

  const arSupported = useARSupport();
  const glRef = useRef(null);
  const sessionRef = useRef(null);
  const overlayRef = useRef(null);
  const controlsRef = useRef(null);
  const rigApi = useRef({});
  const cardApi = useRef({});

  const closeInfo = () => { setModalPart(null); setActiveQuad(null); };
  const openPart = (id) => {
    if (!PARTS[id]) return;
    setActiveQuad(null);
    setModalPart(id);
  };

  // 1st tap on the board zooms in, 2nd tap opens the card for the tapped quadrant.
  const onBoardTap = ({ rear, quadrant }) => {
    if (exploded) return openPart("motherboard");
    if (rear) return openPart("motherboard_rear");
    if (!boardFocus) return setBoardFocus(true);
    if (quadrant) {
      setModalPart(null);
      setActiveQuad(quadrant);
    }
  };

  const toggleExploded = () => {
    setBoardFocus(false);
    closeInfo();
    setExploded((p) => !p);
  };
  const unfocus = () => { setBoardFocus(false); closeInfo(); };

  const startAR = async () => {
    setArError("");
    try {
      setFocusMode(true);
      setSplash(false);
      const session = await startARSession(glRef.current, overlayRef.current);
      sessionRef.current = session;
      session.addEventListener("end", () => {
        sessionRef.current = null;
        setInAR(false);
        setPlacement(null);
        setBoardFocus(false);
      });
      setPlacement(null);
      setInAR(true);
    } catch (err) {
      console.error(err);
      setArError("Couldn't start AR here. Use Chrome on Android, over HTTPS.");
    }
  };
  const endAR = () => sessionRef.current?.end();

  const startCamAR = async () => {
    setArError("");
    const motionP = requestMotion(); // must be called first, straight from the tap
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setGyro(await motionP);
      setPlacement(null);
      setFocusMode(true);
      setSplash(false);
      setCamMode(true);
      setPlaceToken((t) => t + 1);
    } catch (err) {
      console.error(err);
      setArError("Camera unavailable. Allow camera access and open the page over HTTPS.");
    }
  };

  const stopCamAR = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamMode(false);
    setGyro(false);
    setPlacement(null);
    setBoardFocus(false);
  };

  // Hook the camera stream up to the <video> once it exists.
  useEffect(() => {
    if (camMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camMode]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // Puts the normal 3D camera back when the gyroscope mode ends.
  const resetCamera = (cam) => {
    cam.position.set(3, RIG_Y_OFFSET + 1.6, 3.5);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, RIG_Y_OFFSET, 0);
  };

  const goLab = async (path) => {
    stopCamAR();
    try { await sessionRef.current?.end(); } catch { /* already ended */ }
    navigate(path);
  };

  // Taps on our buttons must not also count as a tap in the AR scene.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const block = (e) => { if (e.target !== el) e.preventDefault(); };
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, []);

  useEffect(() => {
    document.body.style.overflow = focusMode ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [focusMode]);

  // What the in-scene card shows: one card per quadrant, or one per part.
  const info = useMemo(() => {
    if (activeQuad) return buildQuadInfo(activeQuad, QUADRANTS[activeQuad]);
    if (modalPart) return buildPartInfo(modalPart);
    return null;
  }, [activeQuad, modalPart]);

  const fitRadius = useMemo(
    () => (exploded ? 3.4 : caseBox ? caseBox.getBoundingSphere(new THREE.Sphere()).radius * 1.1 : 1.6),
    [exploded, caseBox]
  );
  const caseHeight = caseBox ? caseBox.max.y - caseBox.min.y : 1.3;
  const scaleBase = AR_TARGET_HEIGHT / caseHeight;
  // The card shrinks with the rig in AR so it stays the same size relative to the case.
  const cardUnit = CARD_UNIT * (arLike ? scaleBase * (boardFocus ? AR_FOCUS_SCALE : 1) : 1);

  let hint = "Tap the motherboard to zoom in. Tap any part for details.";
  if (inAR && !placement) hint = "Move your phone slowly to find a flat surface, then tap the ring to place the rig.";
  else if (arLite) hint = boardFocus && !info ? "Tap a quadrant on the board to see its parts."
    : "Turn your phone to look around. Tap any part. Use Move to re-place the rig.";
  else if (boardFocus && !info) hint = "Tap a quadrant on the board to see its parts.";

  return (
    <AppShell
      eyebrow="Rig Studio · 3D and AR"
      title="Workstation Explorer"
      subtitle="Look inside a working PC in 3D or augmented reality. Tap any part to learn what it does."
    >
      <section className="immersive-learn-section">
        <div className={`viewport-3d buildcores-viewport ${focusMode ? "viewport--focus" : ""} ${camMode ? "viewport--cam" : ""}`}>
          {camMode && <video ref={videoRef} className="cam-feed" playsInline muted autoPlay />}
          <Canvas
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [3, RIG_Y_OFFSET + 1.6, 3.5], fov: 50 }}
            onCreated={({ gl }) => gl.setClearAlpha(0)}
          >
            <GLBridge glRef={glRef} />
            <ambientLight intensity={2.0} />
            <hemisphereLight skyColor="#ffffff" groundColor="#666666" intensity={1.2} />
            <directionalLight position={[6, 8, 6]} intensity={2.4} />
            <directionalLight position={[-6, 4, -4]} intensity={1.6} />
            <directionalLight position={[0, 3, 8]} intensity={1.6} />
            <Environment resolution={256}>
              <Lightformer form="rect" intensity={4} position={[0, 5, 5]} scale={[10, 6, 1]} />
              <Lightformer form="rect" intensity={3} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 5, 1]} />
              <Lightformer form="rect" intensity={3} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 5, 1]} />
              <Lightformer form="rect" intensity={2} position={[0, 2, -5]} rotation-y={Math.PI} scale={[10, 5, 1]} />
            </Environment>

            <Suspense fallback={<RigLoadingFallback />}>
              <ARRoot
                inAR={arLike}
                placement={placement}
                focused={boardFocus && !exploded}
                scaleBase={scaleBase}
                caseHeight={caseHeight}
                focusScale={AR_FOCUS_SCALE}
                rigCenterY={RIG_Y_OFFSET}
                rigApi={rigApi}
              >
                <DesktopRig
                  onOpenModal={openPart}
                  onBoardTap={onBoardTap}
                  onCalibrate={setCalibPoint}
                  onMeasureCase={setCaseBox}
                  caseBox={caseBox}
                  exploded={exploded}
                  rigApi={rigApi}
                  focused={boardFocus}
                  activeQuad={activeQuad}
                />
              </ARRoot>

              {/* The info card lives in the 3D scene, beside the part (also in AR). */}
              {info && (
                <WorldCard
                  info={info}
                  anchorId={activeQuad || modalPart}
                  rigApi={rigApi}
                  cardApi={cardApi}
                  onClose={closeInfo}
                  unit={cardUnit}
                />
              )}
            </Suspense>

            <ARHitTest
              active={inAR}
              placed={!!placement}
              onPlace={setPlacement}
              onRay={(o, d) => {
                // Card buttons get the tap first, then the parts.
                if (!cardApi.current.tap?.(o, d)) rigApi.current.tap?.(o, d);
              }}
            />
            <CamAR active={arLite} placeToken={placeToken} onPlace={setPlacement} restore={resetCamera} />
            <CameraDirector
              controlsRef={controlsRef}
              rigApi={rigApi}
              center={RIG_CENTER}
              fitRadius={fitRadius}
              focused={boardFocus && !exploded}
              disabled={arLite}
            />
            <OverlayProjector overlayRef={overlayRef} rigApi={rigApi} activeId={null} />
            {!arLite && (
              <OrbitControls
                ref={controlsRef}
                enabled={!inAR}
                target={[0, RIG_Y_OFFSET, 0]}
                enablePan
                enableZoom
                enableRotate
                enableDamping
                dampingFactor={0.08}
                minDistance={0.4}
                maxDistance={20}
              />
            )}
          </Canvas>

          {/* Everything below is also visible inside AR (it is the WebXR dom-overlay root) */}
          <div className="ar-overlay" ref={overlayRef}>
            <svg className="ar-leader">
              <line data-leader />
              <circle data-leader-dot r="5" />
            </svg>

            {!splash && !info && <div className="ar-hint">{hint}</div>}
            {focusMode && !inAR && (
              <button
                className="ar-close"
                onClick={() => { setFocusMode(false); stopCamAR(); }}
                aria-label="Exit full screen"
              >
                ×
              </button>
            )}

            {boardFocus && !exploded && Object.entries(QUADRANTS).map(([id, q]) => (
              <button
                key={id}
                data-anchor={id}
                className={`ar-chip ${activeQuad === id ? "is-active" : ""}`}
                onClick={() => { setModalPart(null); setActiveQuad(id); }}
              >
                {q.chip}
              </button>
            ))}

            {splash && (
              <div className="ar-splash">
                <button className="ar-btn ar-btn--accent" onClick={arSupported ? startAR : startCamAR}>Tap to start AR</button>
                <button className="ar-btn" onClick={() => setSplash(false)}>Use 3D view instead</button>
              </div>
            )}

            {arError && <div className="ar-note">{arError}</div>}

            {CALIBRATE && calibPoint && (
              <div style={{ position: "absolute", top: 12, left: 12, zIndex: 5, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "6px 10px", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }}>
                {calibPoint}
              </div>
            )}

            <div className="ar-toolbar">
              {!inAR && !camMode && (
                <button className="ar-btn ar-btn--accent" onClick={arSupported ? startAR : startCamAR}>
                  Start AR
                </button>
              )}
              {!inAR && !focusMode && !camMode && (
                <button className="ar-btn" onClick={() => setFocusMode(true)}>Full screen</button>
              )}
              {inAR && placement && (
                <button className="ar-btn" onClick={() => { setPlacement(null); unfocus(); }}>Move</button>
              )}
              {arLite && (
                <button className="ar-btn" onClick={() => { unfocus(); setPlaceToken((t) => t + 1); }}>Move</button>
              )}
              {boardFocus && <button className="ar-btn" onClick={unfocus}>Back</button>}
              <button className="ar-btn" onClick={toggleExploded}>
                {exploded ? "Reassemble" : "Exploded view"}
              </button>
              <button className="ar-btn" onClick={() => goLab("/lab")}>Build Lab</button>
              <button className="ar-btn" onClick={() => goLab(profile?.role === "faculty" ? "/instructor" : "/classes")}>Classes</button>
              {inAR && <button className="ar-btn ar-btn--danger" onClick={endAR}>Exit AR</button>}
              {camMode && <button className="ar-btn ar-btn--danger" onClick={stopCamAR}>Exit AR</button>}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}