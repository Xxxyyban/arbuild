// Cable plugs, cable runs, header markers, motherboard screws, the M.2 cover and the CPU socket's
// lever and cover frame in the lab.
//
// A plug sits on its header when plugged in; otherwise it hovers a little way out along its wires.
// A screw sits flush in its hole when driven in; loose, it hovers above the hole.
// Anything waiting to be used bobs gently. Clicks go to onClick; userData.partId lets AR taps find them.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { buildCableStub, buildScrew, MM } from "./cableStubs";
import { buildM2Cover, restingOffset, M2_COVER_SCREWS, SSD_SCREW, SSD_TOP } from "./m2Cover";
import { buildZifLever, buildLeverHook, buildLoadPlate, buildSocketCap, LEVER_LIFT, LEVER_OUT, PLATE_OPEN } from "./cpuSocket";

const PLUG_OUT = 0.11; // how far an unplugged plug hovers out from its socket (scene units)
const SCREW_OUT = 0.035; // how far a loose screw hovers above its hole
export const PLUG_REACH = 0.255; // plug body plus its stub of wire: where the cable run joins the plug

function useSlide(ref, out, waiting, spin = false) {
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const bob = waiting ? Math.sin(state.clock.elapsedTime * 4) * 0.006 : 0;
    const target = out + bob;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 10);
    const before = g.position.y;
    g.position.y += (target - g.position.y) * k;
    if (spin) g.rotation.y += (before - g.position.y) * 140; // screws turn as they go in or out
  });
}

const pointer = {
  onPointerOver: (e) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  },
  onPointerOut: () => {
    document.body.style.cursor = "";
  },
};

const click = (fn) => (e) => {
  e.stopPropagation();
  fn?.();
};

/**
 * A cable plug: type atx24 | eps8 | pcie8. `rotation` turns its wires (+Y) to face out of the socket.
 * `flipped` turns it half a turn about its wires, putting the clip on the other side.
 */
export function CablePlug({ type, position, rotation, plugged, flipped = false, waiting, onClick, partId }) {
  const object = useMemo(() => buildCableStub(type), [type]);
  const slide = useRef();
  const turn = useRef();
  useSlide(slide, plugged ? 0 : PLUG_OUT, waiting);
  useFrame((_, dt) => {
    const g = turn.current;
    if (!g) return;
    const target = flipped ? Math.PI : 0;
    g.rotation.y += (target - g.rotation.y) * (1 - Math.exp(-Math.min(dt, 0.05) * 9));
  });
  return (
    <group position={position} rotation={rotation}>
      <group
        ref={slide}
        position={[0, plugged ? 0 : PLUG_OUT, 0]}
        userData={{ partId }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={click(onClick)}
        {...pointer}
      >
        <group ref={turn} rotation={[0, flipped ? Math.PI : 0, 0]}>
          <primitive object={object} />
        </group>
      </group>
    </group>
  );
}

/** A cable from the PSU to a plug along a smooth curve through `points`. `ghost`: see-through, a guide only. */
export function CableRun({ points, radius = 0.014, color = "#16171a", ghost = false }) {
  const key = points.map((p) => p.map((v) => v.toFixed(3)).join(",")).join("|");
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    return new THREE.TubeGeometry(curve, 80, radius, 10, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, radius]);
  return (
    <mesh geometry={geometry} castShadow={!ghost} raycast={() => null} renderOrder={ghost ? 2 : 0}>
      {ghost ? (
        <meshBasicMaterial color={color} transparent opacity={0.32} depthWrite={false} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
      )}
    </mesh>
  );
}

/** A header the student can click while connecting a cable: a pulsing ring, with a name when hints are on. */
export function PortMarker({ position, label, onClick, partId, size = 0.06 }) {
  const ring = useRef();
  useFrame((state) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.12);
  });
  return (
    <group position={position}>
      <mesh
        ref={ring}
        userData={{ partId }}
        renderOrder={998}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={click(onClick)}
        {...pointer}
      >
        <torusGeometry args={[size, size * 0.13, 10, 36]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.9} depthTest={false} />
      </mesh>
      {/* bigger invisible target inside the ring, clickable from either side */}
      <mesh userData={{ partId }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onClick)} {...pointer}>
        <circleGeometry args={[size, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {label && (
        <Billboard position={[0, 0.1, 0.04]}>
          <Text fontSize={0.035} color="#ffffff" outlineWidth={0.004} outlineColor="#0f172a" anchorX="center" renderOrder={999} material-depthTest={false}>
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/** The tab on a header that the plug's clip has to hook over: a small bright block beside the header. */
export function LatchTab({ position }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.material.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 6) * 0.35;
  });
  return (
    <mesh ref={ref} position={position} renderOrder={997}>
      <boxGeometry args={[0.016, 0.016, 0.03]} />
      <meshBasicMaterial color="#f0c419" transparent opacity={0.9} depthTest={false} />
    </mesh>
  );
}

/**
 * A modular PSU's sockets, drawn in the PSU's own frame: the printed labels, the plugs in them,
 * and while a cable's PSU end is being connected, a ring on every socket (then the clip's tab).
 *   layout   the PSU model's MODULAR (sockets, face)
 *   plugs    { [cable]: { socket, seated, flipped, waiting } } for each PSU end to draw
 *   choosing true while the student picks a socket; latch: the socket whose tab to show
 */
export function PSUPanel({ layout, plugs, choosing, latch, onSocket, onPlug }) {
  const { face, sockets } = layout;
  const out = face - 0.001; // just in front of the face
  // a press anywhere on the panel (a label too) stays here: it mustn't also pick up the PSU under it
  return (
    <group onPointerDown={(e) => e.stopPropagation()}>
      {Object.entries(sockets).map(([id, s]) => {
        const [x, y] = s.at.length > 1 ? [s.at[0][0], (s.at[0][1] + s.at[1][1]) / 2] : s.at[0];
        return (
          <group key={id}>
            {/* the label printed on the PSU (unless the model has it printed already) */}
            {!layout.printed && (
              <Billboard position={[x, s.at[0][1] - 0.05, out - 0.01]}>
                <Text fontSize={0.026} color="#e5e7eb" outlineWidth={0.003} outlineColor="#111827" anchorX="center">
                  {s.label}
                </Text>
              </Billboard>
            )}
            {choosing && (
              <PortMarker
                position={[x, y, out - 0.02]}
                partId={`psuport:${id}`}
                size={0.042}
                onClick={() => onSocket?.(id)}
              />
            )}
          </group>
        );
      })}
      {Object.entries(plugs).map(([cable, p]) =>
        sockets[p.socket].at.map(([x, y], i) => (
          <CablePlug
            key={`${cable}${i}`}
            type={cable === "atx24" ? "psu_mb" : "psu8"}
            partId={`psucable:${cable}`}
            position={[x, y, face]}
            rotation={[-Math.PI / 2, 0, 0]}
            plugged={p.seated}
            flipped={p.flipped}
            waiting={p.waiting}
            onClick={() => onPlug?.(cable)}
          />
        ))
      )}
      {latch && <LatchTab position={[sockets[latch].at[0][0], sockets[latch].at[0][1] + 0.034, face - 0.012]} />}
    </group>
  );
}

/**
 * A PSU's fixed cables, in the PSU's own frame. Each comes straight out of the grommet on its front
 * face (layout.cables[id].out) and down to the bench. Until it is routed out it lies in a loose coil
 * in front of the PSU, its plug resting on the front of the coil with the pins towards you and the
 * plug's marking in front; routed, it runs straight out along the bench with its plug at the end.
 * layout: FIXED from the PSU's model file. cables: [{ id, type, color, label, routed }].
 * showRouted: draw the routed cables too (on the bench; in the case the guide wires show them).
 * choosing: a marker on each coiled cable's plug while the student is picking one.
 */
export function FixedCables({ layout, cables, showRouted = true, choosing, onPick }) {
  const { face } = layout;
  const R = 0.15; // coil radius: a loose loop about 7 cm across
  const PLUG_HALF = 0.026; // half a plug's housing, so it rests on what is under it
  // a press anywhere on the cables (a label too) stays here: it mustn't also pick up the PSU under them
  return (
    <group onPointerDown={(e) => e.stopPropagation()}>
      {cables.map((c) => {
        const spec = layout.cables[c.id];
        if (!spec) return null;
        const thick = c.id === "atx24" ? 0.022 : 0.014;
        const [ox, oy] = spec.out;
        // out of the hole square to the face, then straight down towards the bench (thick = lying on
        // it), before turning towards where it lies, so it never bows up over the hole
        const leave = [
          [ox, oy, face + 0.01],
          [ox, oy - 0.004, face - 0.05],
          [ox, 0.1, face - 0.08],
        ];
        // the plug, pins forward, its wires (+Y) running back along +Z into the cable
        const plug = (at) => (
          <CablePlug type={c.type} partId={`psufixed:${c.id}`} position={at} rotation={[Math.PI / 2, 0, 0]} plugged onClick={() => onPick?.(c.id)} />
        );

        if (c.routed) {
          if (!showRouted) return null;
          const x = spec.routed;
          const plugZ = face - 0.6;
          return (
            <group key={c.id}>
              <CableRun
                points={[...leave, [x, thick + 0.005, face - 0.17], [x, thick, plugZ + PLUG_REACH]]}
                radius={thick}
                color={c.color}
              />
              {plug([x, PLUG_HALF, plugZ])}
            </group>
          );
        }

        const [cx, cz] = spec.coil;
        const plugAt = [cx, 2 * thick + PLUG_HALF, cz - R];
        return (
          <group key={c.id}>
            <CableRun
              points={[...leave, [(ox + cx) / 2, thick + 0.01, face - 0.14], [cx, thick, cz + R]]}
              radius={thick}
              color={c.color}
            />
            <mesh
              position={[cx, thick, cz]}
              rotation={[Math.PI / 2, 0, 0]}
              userData={{ partId: `psufixed:${c.id}` }}
              onClick={click(() => onPick?.(c.id))}
              {...pointer}
            >
              <torusGeometry args={[R, thick, 10, 48]} />
              <meshStandardMaterial color={c.color} roughness={0.75} />
            </mesh>
            {plug(plugAt)}
            {/* the marking moulded on the plug, as on real cables */}
            <Billboard position={[cx, 0.03, cz - R - 0.13]}>
              <Text fontSize={0.03} color="#e5e7eb" outlineWidth={0.003} outlineColor="#111827" anchorX="center">
                {c.label}
              </Text>
            </Billboard>
            {choosing && (
              <PortMarker position={[cx, plugAt[1], plugAt[2] - 0.02]} partId={`psufixed:${c.id}`} size={0.09} onClick={() => onPick?.(c.id)} />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** A motherboard screw at a hole; `rotation` turns its head (+Y) to face out of the board. */
export function BoardScrew({ position, rotation, driven, waiting, onClick, partId }) {
  const object = useMemo(() => buildScrew(), []);
  const slide = useRef();
  useSlide(slide, driven ? 0 : SCREW_OUT, waiting, true);
  return (
    <group position={position} rotation={rotation}>
      <group
        ref={slide}
        position={[0, driven ? 0 : SCREW_OUT, 0]}
        userData={{ partId }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={click(onClick)}
        {...pointer}
      >
        <primitive object={object} />
        {/* bigger invisible target: a screw head is only a few pixels across */}
        <mesh>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

const M2_SCREW_SIZE = 0.7; // M.2 screws are smaller than the board's 6-32 screws

/** The cover the lab builds itself (Three/m2Cover.js). resting: lying on the bench at the origin. */
function BuiltM2Cover({ resting }) {
  const object = useMemo(() => buildM2Cover(), []);
  const lie = useMemo(() => restingOffset(object), [object]);
  return (
    <group position={resting ? lie : [0, 0, 0]}>
      <primitive object={object} />
    </group>
  );
}

// An M.2 cover's look and its 2 screw spots, in the cover's frame (the SSD's frame raised to SSD_TOP).
// This one is for boards whose file has no M.2 heatsink of its own (see PartModel BOARD_M2_COVERS).
export const BUILT_M2_COVER = { Body: BuiltM2Cover, screws: M2_COVER_SCREWS };

/**
 * The M.2 cover over the SSD slot, with its two screws, in the SSD's frame. look: the board's cover
 * (BUILT_M2_COVER or the board's own). screws: [bool, bool] driven in. waiting: which of the cover
 * and its screws can be used now. Clicking the cover lifts it off (or tells the student why not);
 * clicking a screw turns it.
 */
export function M2Cover({ look = BUILT_M2_COVER, screws, coverWaiting, screwsWaiting, onCover, onScrew }) {
  const lift = useRef();
  useSlide(lift, SSD_TOP, coverWaiting);
  return (
    <group>
      <group ref={lift} position={[0, SSD_TOP, 0]}>
        <group userData={{ partId: "m2cover" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onCover)} {...pointer}>
          <look.Body />
        </group>
        {look.screws.map((p, i) => (
          <group key={i} position={p} scale={M2_SCREW_SIZE}>
            <BoardScrew partId={`m2coverscrew:${i}`} driven={screws[i]} waiting={screwsWaiting} onClick={() => onScrew?.(i)} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** The M.2 cover lying on the bench, pad down, centred on position; clicking it puts it back on the board. */
export function M2CoverOnBench({ look = BUILT_M2_COVER, position, label, waiting, onClick }) {
  const lift = useRef();
  useSlide(lift, 0, waiting);
  return (
    <group position={position}>
      <group ref={lift} userData={{ partId: "m2cover" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onClick)} {...pointer}>
        <look.Body resting />
      </group>
      {label && (
        <Billboard position={[0, 0.09, 0]}>
          <Text fontSize={0.05} color="#e5e7eb" outlineWidth={0.004} outlineColor="#111827" anchorX="center">
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/** The small screw that holds an M.2 SSD down at its far end, in the SSD's frame. */
export function SsdScrew({ driven, waiting, onClick }) {
  return (
    <group position={[SSD_SCREW[0], SSD_TOP, SSD_SCREW[2]]} scale={M2_SCREW_SIZE}>
      <BoardScrew partId="m2screw" driven={driven} waiting={waiting} onClick={onClick} />
    </group>
  );
}

/* ---------- the CPU socket's lever, its hook, and AM5's cover frame (Three/cpuSocket.js) ---------- */
// All in the socket's frame: x to the right, y up the board, z out of it. A waiting lever or frame
// nudges the way it is about to move instead of bobbing.

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const nudge = (state, waiting, size) => (waiting ? ((Math.sin(state.clock.elapsedTime * 4) + 1) / 2) * size : 0);
const ease = (ref, target, dt, speed = 6) => {
  ref.current += (target - ref.current) * (1 - Math.exp(-Math.min(dt, 0.05) * speed));
  return ref.current;
};

/** An AM4 socket lever the lab builds (for a board file without one), its pivot at the origin. */
export function BuiltZifLever() {
  const object = useMemo(() => buildZifLever(), []);
  return <primitive object={object} />;
}

/**
 * A socket lever. lever = { Body, pivot, length }: Body draws it with its pivot at the origin and its
 * arm down -Y. up: lifted. Going up it swings out from under its hook first, then lifts.
 */
export function SocketLever({ lever, up, waiting, onClick }) {
  const turn = useRef();
  const a = useRef(up ? 1 : 0);
  useFrame((state, dt) => {
    if (!turn.current) return;
    const w = nudge(state, waiting, 0.08);
    const t = ease(a, up ? 1 - w : w, dt);
    turn.current.rotation.set(LEVER_LIFT * clamp01((t - 0.15) / 0.85), 0, LEVER_OUT * clamp01(t / 0.15), "ZXY");
  });
  return (
    <group position={lever.pivot}>
      <group ref={turn} userData={{ partId: "socketlever" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onClick)} {...pointer}>
        <lever.Body />
        {/* bigger invisible target: the lever is only 2 mm thick */}
        <mesh position={[0, -lever.length / 2, 0]}>
          <boxGeometry args={[7 * MM, lever.length, 7 * MM]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/** The hook a lever sits under when it's down. hook = { at, height, reach } (mm for the last two). */
export function LeverHook({ hook }) {
  const object = useMemo(() => buildLeverHook(hook.height, hook.reach), [hook]);
  return <primitive object={object} position={hook.at} />;
}

/** AM5's cover frame on its hinge (plate = { hinge }), with the plastic cap on it while `cap`. */
export function SocketPlate({ plate, open, cap, waiting, onClick }) {
  const frame = useMemo(() => buildLoadPlate(), []);
  const capObject = useMemo(() => buildSocketCap(), []);
  const turn = useRef();
  const b = useRef(open ? 1 : 0);
  useFrame((state, dt) => {
    if (!turn.current) return;
    const w = nudge(state, waiting, 0.05);
    turn.current.rotation.y = PLATE_OPEN * ease(b, open ? 1 - w : w, dt);
  });
  return (
    <group position={plate.hinge}>
      <group ref={turn} userData={{ partId: "socketplate" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onClick)} {...pointer}>
        <primitive object={frame} />
        {cap && <primitive object={capObject} />}
      </group>
    </group>
  );
}
