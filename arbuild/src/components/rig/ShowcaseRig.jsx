// The Rig Studio's PC (pages/Main.jsx): a complete AM4 or AM5 build in its case with every cable and
// wire plugged in, laid out like the Build Lab's (the same parts, mounts and cable routes; case space:
// +x the case front, +y up, +z toward the glass). With the power on its fans turn, the RAM glows and
// air flows through the case. Exploded, the parts come out toward the glass and the cables stretch
// with them. A click on a part selects it; a selected part's slots, headers and sockets get markers.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import PartModel, { BOARD_MOUNTS, BOARD_M2_COVERS, BOARD_SOCKETS, PSU_PANELS, MODEL_FILES } from "../../Three/PartModel";
import { useGLTF } from "../../Three/gltf";
import { renderSettings } from "../../Three/graphics";
import CaseFanModel from "../../Three/CaseFanModel";
import { CablePlug, HeaderPlug, BoardScrew, PSUPanel, M2Cover, SsdScrew, SocketLever, SocketPlate, LeverHook, PLUG_REACH } from "../../Three/Hardware";
import { MM, headerPlugReach } from "../../Three/cableStubs";
import { useRigMotion } from "../../Three/rigMotion";
import { CaseWithMeasure, caseFanLayout } from "../lab/BenchScene";
import { ThermalPaste } from "../lab/PasteTask";
import {
  MOTHERBOARD_TARGET, MOBO_MOUNTED_ROTATION, PSU_TARGET, GPU_TARGET, STORAGE_MOUNT_ROTATION,
  COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z, boardLayout, moboLocalToWorld,
} from "../../lab/Constants";
import { CABLES, cableNeeded } from "../../lab/Rules";
import { WIRES, WIRE_IDS, wiresStart } from "../../lab/Wires";
import { STUB_TYPE, PORT_ROT, HEADER_LIFT, FRONT_IO, cableRoute, wireRoute, psuToCase } from "../../lab/CableRoutes";
import { CATALOG, correctPicks } from "../../lab/Catalog";
import { boardHeaders } from "../../lab/Faults";

const HEADER_HEIGHT = 0.045; // a power header stands about 9 mm off the board
const SOCKET_ROTATION = [0, Math.PI, 0]; // board space -> the socket's frame (Three/cpuSocket.js)

// Exploded: how far each part comes out (case space): out through the glass side, fanned up and
// down so they don't hide each other from the front. The board's parts come out from the board, on
// top of the board's own move: the cooler furthest, then the RAM, the M.2 cover, the SSD and the CPU.
const EXPLODE = {
  gpu: [0.45, -0.75, 1.55],
  board: [0, 0.2, 0.95],
  psu: [0.55, -0.8, 1.05],
  cooler: [0.05, 0.42, 0.78],
  ram1: [0.2, 0.18, 0.5],
  ram2: [0.2, 0.18, 0.5],
  m2cover: [0.3, -0.12, 0.6],
  ssd: [0.3, -0.1, 0.35],
  cpu: [0, 0.12, 0.34],
  fans: [0, 0, 0], // each fan out of its mount, along its axis (FAN_OUT)
};
const ON_BOARD = ["cooler", "m2cover", "ram1", "ram2", "ssd", "cpu"];
const ORDER = ["gpu", "cooler", "m2cover", "ram1", "ram2", "ssd", "cpu", "board", "psu", "fans"]; // first out
const FAN_OUT = 0.3;
const FLY = 0.9; // seconds each part takes
const STAGGER = 0.07;
const ease = (t) => t * t * (3 - 2 * t);

// the build's slots and the part components that draw them (Three/PartModel.jsx MODEL_FILES)
const SLOT_CATEGORY = { motherboard: "motherboard", cpu: "cpu", ram1: "ram", cpu_cooler: "cpu_cooler", storage: "storage", gpu: "gpu", psu: "psu" };

// The parts a click selects (the guide's ids), and their sub-items
const PICK = { board: "motherboard", cpu: "cpu", cooler: "cpu_cooler", ram1: "ram", ram2: "ram", ssd: "storage", m2cover: "storage", gpu: "gpu", psu: "psu", fans: "case" };
const MODEL_PARTS = { motherboard: ["board"], cpu: ["cpu"], cpu_cooler: ["cooler"], ram: ["ram1", "ram2"], storage: ["ssd"], gpu: ["gpu"], psu: ["psu"] };

// What turns and glows, by part and model variant (rigMotion.js): the coolers' fan blades (with
// the mesh whose axis they turn about), and the RAM's light bars
const COOLER_FAN = [
  { rotor: ["Object_12", "Object_56", "Object_60"], hub: "Object_56" }, // Wraith Stealth: blades, hub, the hub's logo
  { rotor: ["Object_2"], hub: "Object_6" }, // tower: the fan's blades, in its square frame
];
const RAM_LIGHT = /^(Material\.005|Gray[ _]white[ _]plastic)$/; // the sticks' light strip, and the white diffuser over it

const FAN_TURNS = 2.4; // case fans, turns a second (slowed down to look like a fan, not a blur)
const COOLER_TURNS = 3;
const POWER_CABLE = "#2b2e35";
const WIRE_COLOR = { pwr_sw: "#16a34a", rst_sw: "#2563eb", pled: "#dc2626", hdd_led: "#f59e0b", hd_audio: "#1f2937", usb3: "#1e3a8a", cpu_fan: "#111827", case_fans: "#111827", argb: "#b91c1c" };
const WIRE_RADIUS = { usb3: 0.011, hd_audio: 0.008 };
const TUBE = renderSettings().tube; // a cable's segments along it and round it
const ZERO = [0, 0, 0];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Where a part's move puts it: on-board parts add the board's. */
const absDisp = (disp, id) => (ON_BOARD.includes(id) ? add(disp.board, disp[id]) : disp[id] || ZERO);

/**
 * Everything about the build that doesn't change while it's shown: its parts, the board's layout,
 * and the points (case space) its cables, wires and markers go to.
 */
function useBuild(platform) {
  return useMemo(() => {
    const picks = correctPicks(platform);
    const variant = (slot) => CATALOG[picks[slot]]?.variant ?? 0;
    const bv = variant("motherboard");
    const L = boardLayout(BOARD_MOUNTS[bv] || BOARD_MOUNTS[0]);
    const onBoard = (local) => moboLocalToWorld(MOTHERBOARD_TARGET.position, local, MOBO_MOUNTED_ROTATION, L.scale);
    const sock = onBoard(L.cpuLocal);
    const has = boardHeaders(picks.motherboard).filter((h) => L.headers?.[h]);
    const header = (spot, lift = HEADER_LIFT) => {
      const at = L.headers?.[spot]?.at;
      return at ? [sock[0] + at[0] * MM, sock[1] + at[1] * MM, L.pcbFront + lift] : null;
    };
    const headerRot = (spot) => (L.headers?.[spot]?.along === "y" ? [Math.PI / 2, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]);
    const gpu = CATALOG[picks.gpu];
    const ports = {
      atx24: [L.atx24[0], L.atx24[1], L.pcbFront + HEADER_HEIGHT],
      eps8: [L.eps8[0], L.eps8[1], L.pcbFront + HEADER_HEIGHT],
      pcie: gpu?.powerPort ? add(L.gpu, gpu.powerPort) : null,
      pcie6: gpu?.powerPort6 ? add(L.gpu, gpu.powerPort6) : null,
    };
    const psuVariant = variant("psu");
    const panel = PSU_PANELS[psuVariant] || null;
    const socketOf = { atx24: "mb", eps8: "cpu", pcie: "pcie", pcie6: "pcie6" };
    const cables = Object.keys(CABLES)
      .filter((c) => cableNeeded(c, picks) && ports[c] && panel?.sockets[socketOf[c]])
      .map((c) => {
        const at = panel.sockets[socketOf[c]].at;
        const x = at.reduce((s, p) => s + p[0], 0) / at.length;
        const y = at.reduce((s, p) => s + p[1], 0) / at.length;
        const from = psuToCase([x, y, panel.face - PLUG_REACH]);
        const port = ports[c];
        return { id: c, port, rot: PORT_ROT[c], points: cableRoute(c, from, [port[0], port[1], port[2] + PLUG_REACH]), to: c.startsWith("pcie") ? "gpu" : "board", socket: socketOf[c] };
      });
    const cooler = [sock[0] + 0.1, sock[1] + 0.06, L.pcbFront + 0.3];
    const wires = WIRE_IDS.map((id) => {
      const w = wiresStart(true)[id];
      if (!w || !has.includes(w.at)) return null;
      const pos = header(w.at);
      const top = [pos[0], pos[1], pos[2] + headerPlugReach(WIRES[id].plug)];
      return { id, at: w.at, pos, rot: headerRot(w.at), points: wireRoute(id, top, cooler), from: WIRES[id].from === "cooler" ? "cooler" : null };
    }).filter(Boolean);
    const avg = (pts) => [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    const holesX = Math.min(...L.holes.map((h) => h[0]));
    // the board's slots, headers and ports (BOARD_PARTS' markers), and the PSU's and card's
    const markers = {
      socket: { at: [sock[0], sock[1], L.pcbFront + 0.07], part: "board" },
      dimm: { at: [...avg(L.ramSlots.map(onBoard)).slice(0, 2), L.pcbFront + 0.06], part: "board" },
      m2: { at: [...onBoard(L.storageLocal).slice(0, 2), L.pcbFront + 0.05], part: "board" },
      pcie: { at: [L.gpu[0] + 0.25, L.gpu[1] - 0.02, L.pcbFront + 0.05], part: "board" },
      atx24: { at: add(ports.atx24, [0, 0, 0.04]), part: "board" },
      eps8: { at: add(ports.eps8, [0, 0, 0.04]), part: "board" },
      panel: { at: add(avg(["pled", "pwr", "hdd", "rst"].map((h) => header(h)).filter(Boolean)), [0, 0, 0.03]), part: "board" },
      rearIo: { at: [holesX - 0.03, 1.72, L.pcbFront + 0.07], part: "board" },
      gpuPower: ports.pcie && { at: add(ports.pcie, [0, 0.06, 0.04]), part: "gpu" },
      psuSockets: panel && { at: psuToCase([0.02, 0.215, panel.face - 0.04]), part: "psu" },
      frontIo: { at: FRONT_IO, part: null },
    };
    for (const h of has) if (!["pled", "pwr", "hdd", "rst"].includes(h)) markers[h] = { at: add(header(h), [0, 0, 0.03]), part: "board" };
    for (const c of cables) markers[`cable:${c.id}`] = { at: add(c.port, [0, 0, 0.05]), part: c.to };
    for (const w of wires) markers[`wire:${w.id}`] = { at: add(w.pos, [0, 0, 0.04]), part: "board" };
    return { picks, variant, bv, L, sock, wires, cables, panel, markers };
  }, [platform]);
}

/** A part that moves with the exploded view: its displacement (case space), or its own on the board (board space). */
function Moving({ id, disp, base = ZERO, inBoard = null, children }) {
  const ref = useRef();
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const d = disp.current[id] || ZERO;
    if (inBoard) {
      // the board turns half a turn (case +x and +z are board -x and -z) and is stretched by its fit
      g.position.set(base[0] - d[0] / inBoard[0], base[1] + d[1] / inBoard[1], base[2] - d[2] / inBoard[2]);
    } else g.position.set(base[0] + d[0], base[1] + d[1], base[2] + d[2]);
  });
  return (
    <group ref={ref} position={base}>
      {children}
    </group>
  );
}

/**
 * A cable or wire that stays plugged in at both ends while the parts move: each point of its route
 * moves with the part at its start (from) or at its end (to), blended along its length. null: the case.
 */
function FlexCable({ points, from, to, disp, radius, color, highlight, onClick }) {
  const mesh = useRef();
  const base = useMemo(() => points.map((p) => new THREE.Vector3(...p)), [points]);
  // how far along the cable each point is (0 at its start, 1 at its plug), eased so the ends hold on
  const weight = useMemo(() => {
    const d = [0];
    for (let i = 1; i < base.length; i++) d.push(d[i - 1] + base[i].distanceTo(base[i - 1]));
    const total = d[d.length - 1] || 1;
    return d.map((x) => ease(x / total));
  }, [base]);
  const last = useRef("");
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const a = from ? absDisp(disp.current, from) : ZERO;
    const b = to ? absDisp(disp.current, to) : ZERO;
    const key = [...a, ...b].map((v) => v.toFixed(3)).join();
    if (key === last.current) return;
    last.current = key;
    const pts = base.map((p, i) => {
      const w = weight[i];
      return p.clone().add(new THREE.Vector3(a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w));
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(curve, TUBE[0], radius, TUBE[1], false);
  });
  return (
    <mesh ref={mesh} userData={{ pick: "cables" }} onClick={onClick}>
      <bufferGeometry />
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        metalness={0.05}
        emissive={highlight ? "#34d399" : "#000000"}
        emissiveIntensity={highlight ? 0.55 : 0}
      />
    </mesh>
  );
}

/** Air moving through the running case: cool air in at the front, warm air out at the back and top. */
function Airflow({ fans, on }) {
  const mesh = useRef();
  const PER = 9; // streaks per fan
  const streaks = useMemo(
    () =>
      fans.flatMap((f) =>
        Array.from({ length: PER }, (_, i) => {
          const a = (i / PER) * Math.PI * 2;
          const r = f.size * (0.12 + 0.28 * ((i * 7) % PER) / PER);
          return { f, phase: i / PER, a, r, intake: f.role === "front" };
        })
      ),
    [fans]
  );
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(), side: new THREE.Vector3(), side2: new THREE.Vector3() }), []);
  const level = useRef(0);
  // each streak's colour, once: cool blue in, warm orange out
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const intake = new THREE.Color("#38bdf8");
    const exhaust = new THREE.Color("#fb923c");
    streaks.forEach((s, i) => m.setColorAt(i, s.intake ? intake : exhaust));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [streaks]);
  useFrame(({ clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    level.current += ((on ? 1 : 0) - level.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 2));
    m.visible = level.current > 0.02;
    if (!m.visible) return;
    const t = clock.elapsedTime;
    streaks.forEach((s, i) => {
      const { f } = s;
      tmp.dir.set(...f.flow).normalize();
      tmp.side.set(Math.abs(tmp.dir.y) > 0.9 ? 1 : 0, Math.abs(tmp.dir.y) > 0.9 ? 0 : 1, 0).cross(tmp.dir).normalize();
      tmp.side2.copy(tmp.dir).cross(tmp.side);
      const u = (t * 0.55 + s.phase) % 1; // 0..1 along its path
      // intake: from in front of the fan to well inside the case; exhaust: from the fan out
      const along = s.intake ? -0.45 + u * 1.1 : 0.05 + u * 0.75;
      tmp.p.set(...f.position)
        .addScaledVector(tmp.dir, along)
        .addScaledVector(tmp.side, Math.cos(s.a + t * 2) * s.r)
        .addScaledVector(tmp.side2, Math.sin(s.a + t * 2) * s.r);
      const fade = Math.sin(Math.PI * u) * level.current;
      tmp.q.setFromUnitVectors(tmp.up, tmp.dir);
      tmp.s.set(0.008 * fade + 1e-4, 0.085 * fade + 1e-4, 0.008 * fade + 1e-4);
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[null, null, streaks.length]} raycast={() => null} frustumCulled={false}>
      <capsuleGeometry args={[1, 1, 4, 8]} />
      <meshBasicMaterial transparent opacity={0.75} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

/** A case fan, popping out along its axis when exploded. */
function Fan({ f, disp, spin }) {
  const ref = useRef();
  const out = f.role === "front" ? [1, 0, 0] : f.role === "rear" ? [-1, 0, 0] : [0, 1, 0];
  useFrame(() => {
    const g = ref.current;
    const k = disp.current.fanOut || 0;
    if (g) g.position.set(f.position[0] + out[0] * k, f.position[1] + out[1] * k, f.position[2] + out[2] * k);
  });
  return (
    <group ref={ref} position={f.position} rotation={f.rotation}>
      <CaseFanModel size={f.size} width={f.dims.width} thickness={f.dims.thickness} length={f.dims.length} spin={spin} />
    </group>
  );
}

/** A box around the selected part, following it as it moves. */
function SelectionBox({ targets }) {
  const ref = useRef();
  const work = useMemo(() => ({ box: new THREE.Box3(), one: new THREE.Box3(), inv: new THREE.Matrix4() }), []);
  const geometry = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  useFrame(({ clock }) => {
    const l = ref.current;
    if (!l) return;
    const { box, one, inv } = work;
    box.makeEmpty();
    for (const t of targets) if (t?.current) box.union(one.setFromObject(t.current));
    l.visible = !box.isEmpty();
    if (!l.visible) return;
    // the box is measured in world space; draw it in the rig's own space
    box.applyMatrix4(inv.copy(l.parent.matrixWorld).invert());
    box.getCenter(l.position);
    box.getSize(l.scale).addScalar(0.04);
    l.material.opacity = 0.65 + Math.sin(clock.elapsedTime * 4) * 0.25;
  });
  return (
    <lineSegments ref={ref} geometry={geometry} renderOrder={997} raycast={() => null}>
      <lineBasicMaterial color="#34d399" transparent depthTest={false} />
    </lineSegments>
  );
}

/** A marker on a slot, header or socket: a ring, with its name while it's picked or pointed at. */
function Marker({ at, label, active, onClick }) {
  const ring = useRef();
  const [hover, setHover] = useState(false);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = (active ? 1.5 : 1) * (1 + Math.sin(clock.elapsedTime * 3.2) * 0.12);
    ring.current.scale.setScalar(s);
  });
  return (
    <group position={at}>
      <Billboard>
        <mesh
          ref={ring}
          renderOrder={998}
          userData={{ pick: "marker" }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          <ringGeometry args={[0.022, 0.034, 28]} />
          <meshBasicMaterial color={active ? "#34d399" : "#f8fafc"} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
        {(active || hover) && (
          <Text
            position={[0, 0.065, 0]}
            fontSize={0.045}
            color={active ? "#6ee7b7" : "#f8fafc"}
            outlineWidth={0.006}
            outlineColor="#0f172a"
            anchorX="center"
            anchorY="bottom"
            renderOrder={999}
            material-depthTest={false}
          >
            {label}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

/**
 * A part's name beside it (with labels on). side: where, so names don't pile up: "top" (above it),
 * "bottom" (below it), "front" (past its front end, toward the case front).
 */
function PartLabel({ target, text, side = "top", onClick }) {
  const ref = useRef();
  const work = useMemo(() => ({ box: new THREE.Box3(), inv: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    const g = ref.current;
    const t = target?.current;
    if (!g || !t) return;
    const { box, inv, p, s } = work;
    box.setFromObject(t);
    g.visible = !box.isEmpty();
    if (!g.visible) return;
    box.applyMatrix4(inv.copy(g.parent.matrixWorld).invert());
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    if (side === "bottom") g.position.set(cx, box.min.y - 0.16, cz);
    else if (side === "front") g.position.set(box.max.x + 0.08, cy, box.max.z);
    else g.position.set(cx, box.max.y + 0.08, cz);
    // the same size on screen however near the camera is (in the rig's units, so in AR too)
    g.getWorldPosition(p);
    g.parent.getWorldScale(s);
    g.scale.setScalar(THREE.MathUtils.clamp((camera.position.distanceTo(p) / (s.x || 1)) * 0.16, 0.12, 3));
  });
  return (
    <group ref={ref} visible={false}>
      <Billboard>
        <Text
          fontSize={0.1}
          color="#f8fafc"
          outlineWidth={0.01}
          outlineColor="#0f172a"
          anchorX={side === "front" ? "left" : "center"}
          anchorY={side === "bottom" ? "top" : side === "front" ? "middle" : "bottom"}
          renderOrder={999}
          material-depthTest={false}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {text}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * platform     "am4" | "am5"
 * exploded     true to take it apart (it moves there smoothly)
 * powered      fans turning, RGB on, airflow
 * labels       each part's name above it
 * selected     the guide's part id ("motherboard", "cpu"...), or null
 * markers      [{ id, label }]: the selected part's slots, headers, ports (PartGuide marker ids)
 * activeMarker the one picked
 * onPick(part, marker?)  a click on a part, or on a marker
 * apiRef       gets { tap(origin, dir), pointOf(marker), boxOf(part) } (AR taps, the camera's focus)
 */
export default function ShowcaseRig({ platform = "am4", exploded = false, powered = true, labels = false, selected = null, markers = [], activeMarker = null, onPick, apiRef }) {
  const build = useBuild(platform);
  const { L, bv, variant, wires, cables, panel } = build;
  const [caseBox, setCaseBox] = useState(null);
  const fans = useMemo(() => (caseBox ? caseFanLayout(caseBox) : []), [caseBox]);
  // the case's markers: its front fans (the middle one) and its rear fan, just outside the case
  const fanSpots = useMemo(() => {
    const front = fans.filter((f) => f.role === "front");
    const rear = fans.find((f) => f.role === "rear");
    const mid = front[Math.floor(front.length / 2)];
    return {
      ...(mid && { fansFront: { at: add(mid.position, [0.12, 0, 0]), part: null } }),
      ...(rear && { fansRear: { at: add(rear.position, [-0.12, 0, 0]), part: null } }),
    };
  }, [fans]);
  const spotOf = (id) => build.markers[id] || fanSpots[id] || null;

  // every part's model loading at once (each part on its own first asks whether its file is there)
  useEffect(() => {
    for (const [slot, category] of Object.entries(SLOT_CATEGORY)) {
      const file = MODEL_FILES[category][variant(slot)];
      if (file) useGLTF.preload(file);
    }
  }, [variant]);
  const sockLook = BOARD_SOCKETS[bv] || BOARD_SOCKETS[0];
  const m2Look = BOARD_M2_COVERS[bv] || undefined;
  const unstretch = [1 / L.scale[0], 1 / L.scale[1], 1 / L.scale[2]];

  // the exploded view: each part's progress (0 in place, 1 out) and its displacement
  const disp = useRef(Object.fromEntries([...ORDER, "fanOut"].map((id) => [id, id === "fanOut" ? 0 : [0, 0, 0]])));
  const prog = useRef(Object.fromEntries(ORDER.map((id) => [id, 0])));
  const since = useRef(0);
  const lastExploded = useRef(exploded);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    if (lastExploded.current !== exploded) {
      lastExploded.current = exploded;
      since.current = 0;
    }
    since.current += step;
    ORDER.forEach((id, i) => {
      const delay = (exploded ? i : ORDER.length - 1 - i) * STAGGER;
      if (since.current >= delay) prog.current[id] = THREE.MathUtils.clamp(prog.current[id] + (exploded ? step : -step) / FLY, 0, 1);
      const e = ease(prog.current[id]);
      if (id === "fans") disp.current.fanOut = FAN_OUT * e;
      else disp.current[id] = EXPLODE[id].map((v) => v * e);
    });
  });

  const refs = {
    board: useRef(), cpu: useRef(), cooler: useRef(), ram1: useRef(), ram2: useRef(), ssd: useRef(), m2cover: useRef(), gpu: useRef(), psu: useRef(),
  };
  const root = useRef();
  useRigMotion(refs.cooler, { rotor: COOLER_FAN[variant("cpu_cooler")], turns: COOLER_TURNS }, powered);
  useRigMotion(refs.ram1, { rgb: RAM_LIGHT }, powered);
  useRigMotion(refs.ram2, { rgb: RAM_LIGHT }, powered);

  const pick = (id) => (e) => {
    e.stopPropagation();
    onPick?.(PICK[id] || id);
  };
  const hover = {
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => (document.body.style.cursor = ""),
  };
  const cablesOn = selected === "cables";

  // re-made every render, so it always sees the latest props
  useEffect(() => {
    if (!apiRef) return;
    const ray = new THREE.Raycaster();
    apiRef.current = {
      // an AR tap: the first part the ray hits
      tap(origin, dir) {
        if (!root.current) return;
        ray.set(origin, dir.clone().normalize());
        for (const h of ray.intersectObject(root.current, true)) {
          for (let o = h.object; o; o = o.parent) {
            const p = o.userData?.pick;
            if (p && p !== "marker") return onPick?.(p);
          }
        }
      },
      // a marker's point, and a part's box (world space): where the camera looks
      pointOf(id) {
        const m = spotOf(id);
        if (!m || !root.current) return null;
        const d = m.part ? absDisp(disp.current, m.part) : ZERO;
        return root.current.localToWorld(new THREE.Vector3(...add(m.at, d)));
      },
      boxOf(part) {
        const box = new THREE.Box3();
        for (const id of MODEL_PARTS[part] || []) if (refs[id].current) box.union(new THREE.Box3().setFromObject(refs[id].current));
        return box.isEmpty() ? null : box;
      },
    };
  });

  const selTargets = (MODEL_PARTS[selected] || []).map((id) => refs[id]);

  return (
    <group ref={root}>
      {/* the case stays put; its fans come out of their mounts when exploded. Only the fans take a
          click: the case's shell would catch clicks meant for the parts inside it */}
      <CaseWithMeasure onMeasure={setCaseBox} />
      <group userData={{ pick: "case" }} onClick={pick("fans")} {...hover}>
        {fans.map((f) => (
          <Fan key={f.key} f={f} disp={disp} spin={powered ? FAN_TURNS : 0} />
        ))}
      </group>
      {/* not while a part is picked: the streaks would cross in front of it */}
      <Airflow fans={fans} on={powered && !exploded && !selected} />

      {/* the PSU, its cables' ends in its sockets */}
      <Moving id="psu" disp={disp}>
        <group ref={refs.psu} position={PSU_TARGET.position} rotation={PSU_TARGET.rotation} userData={{ pick: "psu" }} onClick={pick("psu")} {...hover}>
          <PartModel category="psu" variant={variant("psu")} />
          {panel && (
            <PSUPanel layout={panel} plugs={Object.fromEntries(cables.map((c) => [c.id, { socket: c.socket, seated: true, flipped: false, waiting: false }]))} />
          )}
        </group>
      </Moving>

      {/* the motherboard and everything on it */}
      <Moving id="board" disp={disp}>
        <group
          ref={refs.board}
          position={MOTHERBOARD_TARGET.position}
          rotation={MOBO_MOUNTED_ROTATION}
          scale={L.scale}
          userData={{ pick: "motherboard" }}
          onClick={pick("board")}
          {...hover}
        >
          <PartModel category="motherboard" variant={bv} />

          <Moving id="cpu" disp={disp} base={L.cpuLocal} inBoard={L.scale}>
            <group ref={refs.cpu} userData={{ pick: "cpu" }} onClick={pick("cpu")}>
              <group scale={unstretch}>
                <group rotation={[Math.PI / 2, 0, Math.PI]}>
                  <PartModel category="cpu" variant={variant("cpu")} />
                  <ThermalPaste variant={variant("cpu")} />
                </group>
              </group>
            </group>
          </Moving>

          {/* the socket's top plate, lever and (AM5) cover frame: part of the board */}
          {sockLook.top && (
            <group position={L.cpuLocal}>
              <group scale={unstretch}>
                <group rotation={SOCKET_ROTATION}>
                  <sockLook.top.Body />
                </group>
              </group>
            </group>
          )}
          <group position={L.cpuLocal}>
            <group scale={unstretch}>
              <group rotation={SOCKET_ROTATION}>
                <LeverHook hook={sockLook.hook} />
                <SocketLever lever={sockLook.lever} up={false} waiting={false} />
                {sockLook.plate && <SocketPlate plate={sockLook.plate} open={false} cap={false} waiting={false} />}
              </group>
            </group>
          </group>

          {/* the SSD in its M.2 slot, screwed down, under the board's cover */}
          <Moving id="ssd" disp={disp} base={L.storageLocal} inBoard={L.scale}>
            <group ref={refs.ssd} userData={{ pick: "storage" }} onClick={pick("ssd")}>
              <group scale={unstretch}>
                <group rotation={STORAGE_MOUNT_ROTATION}>
                  <PartModel category="storage" variant={variant("storage")} />
                  <SsdScrew driven waiting={false} />
                </group>
              </group>
            </group>
          </Moving>
          <Moving id="m2cover" disp={disp} base={L.storageLocal} inBoard={L.scale}>
            <group ref={refs.m2cover} userData={{ pick: "storage" }} onClick={pick("m2cover")}>
              <group scale={unstretch}>
                <group rotation={STORAGE_MOUNT_ROTATION}>
                  <M2Cover look={m2Look} screws={[true, true]} coverWaiting={false} screwsWaiting={false} />
                </group>
              </group>
            </group>
          </Moving>

          <Moving id="cooler" disp={disp} base={L.coolerLocal} inBoard={L.scale}>
            <group ref={refs.cooler} userData={{ pick: "cpu_cooler" }} onClick={pick("cooler")}>
              <group scale={unstretch}>
                <group rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
                  <PartModel category="cpu_cooler" variant={variant("cpu_cooler")} />
                </group>
              </group>
            </group>
          </Moving>

          {/* two sticks in slots 1 and 3: dual channel */}
          {["ram1", "ram2"].map((r, i) => (
            <Moving key={r} id={r} disp={disp} base={L.ramSlots[i * 2]} inBoard={L.scale}>
              <group ref={refs[r]} userData={{ pick: "ram" }} onClick={pick(r)}>
                <group scale={unstretch}>
                  <PartModel category="ram" variant={variant(r)} accentColor={i ? "#e8a33d" : "#34d399"} />
                </group>
              </group>
            </Moving>
          ))}
        </group>

        {/* the screws, the power plugs and the case's wires' plugs, on the board */}
        {L.holes.map(([x, y], i) => (
          <BoardScrew key={i} position={[x, y, L.pcbFront]} rotation={[Math.PI / 2, 0, 0]} driven waiting={false} />
        ))}
        {cables
          .filter((c) => c.to === "board")
          .map((c) => (
            <CablePlug key={c.id} type={STUB_TYPE[c.id]} position={c.port} rotation={c.rot} plugged waiting={false} onClick={() => onPick?.("cables", `cable:${c.id}`)} />
          ))}
        {wires.map((w) => (
          <HeaderPlug key={w.id} kind={WIRES[w.id].plug} colors={WIRES[w.id].colors} position={w.pos} rotation={w.rot} plugged waiting={false} onClick={() => onPick?.("cables", `wire:${w.id}`)} />
        ))}
      </Moving>

      {/* the graphics card, its power cable's plug on top */}
      <Moving id="gpu" disp={disp}>
        <group ref={refs.gpu} userData={{ pick: "gpu" }} onClick={pick("gpu")} {...hover}>
          <group position={L.gpu} rotation={GPU_TARGET.rotation}>
            <PartModel category="gpu" variant={variant("gpu")} spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
          </group>
          {cables
            .filter((c) => c.to === "gpu")
            .map((c) => (
              <CablePlug key={c.id} type={STUB_TYPE[c.id]} position={c.port} rotation={c.rot} plugged waiting={false} onClick={() => onPick?.("cables", `cable:${c.id}`)} />
            ))}
        </group>
      </Moving>

      {/* every cable and wire, plugged in at both ends */}
      {cables.map((c) => (
        <FlexCable
          key={`${platform}:${c.id}`}
          points={c.points}
          from="psu"
          to={c.to}
          disp={disp}
          radius={c.id === "atx24" ? 0.022 : 0.015}
          color={POWER_CABLE}
          highlight={cablesOn || activeMarker === `cable:${c.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick?.("cables", `cable:${c.id}`);
          }}
        />
      ))}
      {wires.map((w) => (
        <FlexCable
          key={`${platform}:${w.id}`}
          points={w.points}
          from={w.from}
          to="board"
          disp={disp}
          radius={WIRE_RADIUS[w.id] ?? 0.0055}
          color={WIRE_COLOR[w.id]}
          highlight={cablesOn || activeMarker === `wire:${w.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick?.("cables", `wire:${w.id}`);
          }}
        />
      ))}

      {selected && selTargets.length > 0 && <SelectionBox targets={selTargets} />}

      {/* the selected part's slots, headers and sockets */}
      {markers.map((m) => {
        const spot = spotOf(m.id);
        if (!spot) return null;
        return (
          <Moving key={m.id} id={spot.part || "none"} disp={disp} base={spot.at}>
            <Marker at={ZERO} label={m.label} active={activeMarker === m.id} onClick={() => onPick?.(selected, m.id)} />
          </Moving>
        );
      })}

      {/* while a part is picked its box, markers and the guide say what it is */}
      {labels && !selected && (
        <>
          {[
            ["board", "Motherboard", "motherboard", "front"],
            ["cooler", "CPU cooler", "cpu_cooler", "top"],
            ["ram1", "RAM", "ram", exploded ? "front" : "top"],
            ["gpu", "Graphics card", "gpu", exploded ? "bottom" : "front"],
            ["psu", "Power supply", "psu", "bottom"],
            ...(exploded ? [["cpu", "CPU", "cpu", "front"], ["ssd", "M.2 SSD", "storage", "front"]] : []),
          ].map(([id, text, part, side]) => (
            <PartLabel key={id} target={refs[id]} text={text} side={side} onClick={() => onPick?.(part)} />
          ))}
        </>
      )}
    </group>
  );
}
