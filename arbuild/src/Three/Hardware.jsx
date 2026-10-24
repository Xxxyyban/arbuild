// Cable plugs, cable runs, header markers and motherboard screws in the lab.
//
// A plug sits on its header when plugged in; otherwise it hovers a little way out along its wires.
// A screw sits flush in its hole when driven in; loose, it hovers above the hole.
// Anything waiting to be used bobs gently. Clicks go to onClick; userData.partId lets AR taps find them.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { buildCableStub, buildScrew } from "./cableStubs";

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
 * A PSU's fixed cables (non-modular), in the PSU's own frame. Each leaves through the grommet on its
 * front face. Until it is routed out it lies coiled in front of the PSU with its plug on top (and
 * the plug's marking printed beside it); once routed it runs straight out with its plug at the end.
 * layout: FIXED from the PSU's model file. cables: [{ id, type, color, label, routed }].
 * showRouted: draw the routed cables too (on the bench; in the case the guide wires show them).
 * choosing: a marker on each coiled cable while the student is picking one.
 */
export function FixedCables({ layout, cables, showRouted = true, choosing, onPick }) {
  const { face, exit, coils } = layout;
  const ex = [exit[0], exit[1], face];
  const rest = 0.03; // a cable lying on the bench
  // a press anywhere on the cables (a label too) stays here: it mustn't also pick up the PSU under them
  return (
    <group onPointerDown={(e) => e.stopPropagation()}>
      {cables.map((c) => {
        const x = coils[c.id];
        const thick = c.id === "atx24" ? 0.02 : 0.013;
        if (c.routed) {
          if (!showRouted) return null;
          const end = [x, rest, face - 0.5];
          return (
            <group key={c.id}>
              <CableRun points={[ex, [ex[0], ex[1] - 0.06, face - 0.06], [x, rest + 0.01, face - 0.22], end]} radius={thick} color={c.color} />
              <CablePlug type={c.type} partId={`psufixed:${c.id}`} position={end} rotation={[Math.PI / 2, 0, 0]} plugged onClick={() => onPick?.(c.id)} />
            </group>
          );
        }
        const at = [x, rest, face - 0.19];
        return (
          <group key={c.id}>
            <CableRun points={[ex, [ex[0], ex[1] - 0.08, face - 0.05], [(ex[0] + x) / 2, rest + 0.02, face - 0.1], [x, rest, face - 0.12]]} radius={thick} color={c.color} />
            <mesh
              position={at}
              rotation={[Math.PI / 2, 0, 0]}
              userData={{ partId: `psufixed:${c.id}` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={click(() => onPick?.(c.id))}
              {...pointer}
            >
              <torusGeometry args={[0.075, thick, 10, 40]} />
              <meshStandardMaterial color={c.color} roughness={0.75} />
            </mesh>
            <CablePlug type={c.type} partId={`psufixed:${c.id}`} position={[x, rest + 0.03, at[2]]} rotation={[Math.PI / 2, 0, 0]} plugged onClick={() => onPick?.(c.id)} />
            {/* the marking moulded on the plug, as on real cables */}
            <Billboard position={[x, rest + 0.1, at[2] - 0.09]}>
              <Text fontSize={0.026} color="#e5e7eb" outlineWidth={0.003} outlineColor="#111827" anchorX="center">
                {c.label}
              </Text>
            </Billboard>
            {choosing && <PortMarker position={[x, rest + 0.05, at[2]]} partId={`psufixed:${c.id}`} size={0.1} onClick={() => onPick?.(c.id)} />}
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
