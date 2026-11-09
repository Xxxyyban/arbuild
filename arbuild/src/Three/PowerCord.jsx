// The Build Lab's mains power: a power strip on the bench and a cord with an IEC plug at one end and a wall
// plug at the other. (The Rig Studio has none: it never unplugs anything.)
//
// The IEC plug seats in the PSU's inlet, wherever that model has it: BuildLab.jsx puts an anchor there,
// inside the case, and the plug follows it, so the case can be laid down with the cord in. Both plugs and
// the cord are drawn in the bench's space.
//
// The cord is kept in the Cables compartment, not on the bench: picked there, it comes out in a coil beside
// the strip; with one end in, it runs across the bench; unplugged, it coils up and goes back. It moves
// smoothly between these, and is only rebuilt while it moves.
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ARContext } from "./xrSetup";
import { CableRun, click, pointer, raycastOnTop } from "./Hardware";
import {
  CORD_RADIUS, MM, PLUG_REACH_MAINS, STRIP_SIZE, STRIP_SOCKET, buildIecPlug, buildMainsPlug, buildPowerStrip,
} from "./cableStubs";
import { CORD_COIL, POWER_STRIP, TABLE } from "../lab/Constants";

const SAMPLES = 72; // points along the cord
const IEC_OUT = 0.13; // how far a plug on its way in hovers out of its socket
const WALL_OUT = 0.17; // (the wall plug's blades are longer)
const IEC_LYING = 0.056; // how high each plug's middle is, lying on the bench
const WALL_LYING = 0.075;
const REST_Y = CORD_RADIUS + 0.002;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);
const NO_TURN = new THREE.Quaternion();
const lyingTurn = (axis) => {
  // a plug lying on the bench: its cord along `axis`, its narrow side up
  const y = axis.clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, UP).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, UP));
};

/** The cord lying coiled beside the strip, its ends where the plugs lie: { points, iec, wall }. */
function coilLayout() {
  const { center, radius, turns } = CORD_COIL;
  const [cx, cz] = center;
  const start = -0.6; // the angle round the coil where the cord starts
  const points = [];
  for (let i = 0; i < SAMPLES; i++) {
    const s = i / (SAMPLES - 1);
    const a = start + s * turns * Math.PI * 2;
    const r = radius * (1 - 0.07 * s) * (1 + 0.025 * Math.sin(a * 5));
    points.push(v3(cx + r * Math.cos(a), CORD_RADIUS * (1 + 1.6 * s * (turns - 0.3)), cz + r * Math.sin(a)));
  }
  const tangent = (a) => v3(-Math.sin(a), 0, Math.cos(a));
  const endA = start + turns * Math.PI * 2;
  const inTail = points[0].clone().setY(IEC_LYING);
  const inAxis = tangent(start);
  const wallTail = points[SAMPLES - 1].clone().setY(WALL_LYING);
  const wallAxis = tangent(endA).negate();
  return {
    points,
    iec: { pos: inTail.clone().addScaledVector(inAxis, -PLUG_REACH_MAINS), quat: lyingTurn(inAxis) },
    wall: { pos: wallTail.clone().addScaledVector(wallAxis, -PLUG_REACH_MAINS), quat: lyingTurn(wallAxis) },
  };
}

// the wall plug with the cord's other end in the PSU: lying in front of the strip, pointing at its socket
const REST_AXIS = v3(0.5, 0, 0.86).normalize();
const WALL_REST = {
  pos: v3(STRIP_SOCKET[0], WALL_LYING, STRIP_SOCKET[2] + 0.34),
  quat: lyingTurn(REST_AXIS),
};
const SEAT_TURN = new THREE.Quaternion(); // the wall plug in its socket: upright, as the strip's top faces up

/** The cord's way from the IEC plug's tail (a, its cord along da) to the wall plug's tail (b, along db). */
function routeThrough(a, da, b, db) {
  const keys = [a.clone(), a.clone().addScaledVector(da, 0.06)];
  // out of the back of the PC and down onto the bench
  const fall = (k, drop) => {
    const p = a.clone().addScaledVector(da, k);
    p.y = THREE.MathUtils.lerp(a.y, REST_Y, drop);
    return p;
  };
  keys.push(fall(0.18, 0.42), fall(0.34, 1));
  const down = keys[keys.length - 1];
  const toward = v3(down.x - b.x, 0, down.z - b.z);
  const gap = toward.length() || 1;
  toward.divideScalar(gap);
  const side = v3(-toward.z, 0, toward.x);
  const end = [];
  if (Math.abs(db.y) > 0.5) {
    // standing in its socket: up out of the plug, over and down off the strip
    end.push(
      b.clone().addScaledVector(db, 0.05),
      b.clone().addScaledVector(db, 0.11).addScaledVector(toward, 0.07),
      b.clone().add(v3(0, 0.03, 0)).addScaledVector(toward, 0.22),
      v3(b.x, 0.11, b.z).addScaledVector(toward, 0.38),
      v3(b.x, REST_Y, b.z).addScaledVector(toward, Math.min(0.58, gap * 0.7)),
    );
  } else {
    // lying on the bench: straight back out of the plug
    const out = b.clone().addScaledVector(db, 0.09);
    out.y = (b.y + REST_Y) / 2;
    const flat = b.clone().addScaledVector(db, 0.22);
    flat.y = REST_Y;
    end.push(out, flat);
  }
  const last = end[end.length - 1];
  // a lazy bend in the middle of the run, as a real cord lies
  const mid = down.clone().lerp(last, 0.5).addScaledVector(side, Math.min(0.1, gap * 0.08));
  mid.y = REST_Y;
  keys.push(mid, ...end.reverse(), b.clone());
  const pts = new THREE.CatmullRomCurve3(keys, false, "centripetal").getSpacedPoints(SAMPLES - 1);
  pts.forEach((p) => {
    p.y = Math.max(p.y, CORD_RADIUS);
  });
  return pts;
}

/**
 * One plug's pose: it goes to where it's told, easing there, then stays exactly on it even if that place
 * moves (the case being laid down with the plug in).
 */
function follow(f, key, pos, quat, dt) {
  if (f.key === null) {
    f.pos.copy(pos);
    f.quat.copy(quat);
    f.key = key;
    return;
  }
  if (f.key !== key) {
    f.key = key;
    f.offset.copy(f.pos).sub(pos);
    f.turn.copy(quat).invert().multiply(f.quat);
  }
  const k = Math.exp(-Math.min(dt, 0.05) * 7);
  f.offset.multiplyScalar(k);
  f.turn.slerp(NO_TURN, 1 - k);
  f.pos.copy(pos).add(f.offset);
  f.quat.copy(quat).multiply(f.turn);
}
const newFollower = () => ({ key: null, pos: v3(), quat: new THREE.Quaternion(), offset: v3(), turn: new THREE.Quaternion() });

/** The strip on the bench, and its own cord going off the bench's edge (not in AR: there's no bench). */
export function PowerStrip() {
  const inAR = useContext(ARContext);
  const object = useMemo(() => buildPowerStrip(), []);
  const [x, y, z] = POWER_STRIP.position;
  const leftEnd = x - (STRIP_SIZE.w / 2) * MM;
  const edge = TABLE.center[0] - TABLE.size[0] / 2;
  return (
    <group>
      <primitive object={object} position={POWER_STRIP.position} />
      {!inAR && (
        <CableRun
          radius={CORD_RADIUS * 0.85}
          color="#d4d6db"
          points={[
            [leftEnd + 0.01, y + 0.06, z],
            [leftEnd - 0.03, y + 0.045, z],
            [edge + 0.03, y + CORD_RADIUS, z - 0.04],
            [edge - 0.03, y - 0.03, z - 0.05],
            [edge - 0.05, y - 0.3, z - 0.05],
            [edge - 0.05, y - TABLE.legHeight, z - 0.05],
          ]}
        />
      )}
    </group>
  );
}

/**
 * The cord and its two plugs.
 *   anchor   ref to a group in the PSU's inlet: at the rim, its +Y out of the PSU (null while there's no PSU in the case)
 *   iec, wall  where each plug is: "out", "hover" (on its way in: it bobs, and takes the next click) or "in"
 *   stored   it's in the Cables compartment: it finishes coiling up, then it's gone from the bench
 *   onIec, onWall  a click on that plug
 */
export function PowerCord({ anchor, iec, wall, stored, onIec, onWall }) {
  const iecPlug = useMemo(() => buildIecPlug(), []);
  const wallPlug = useMemo(() => buildMainsPlug(), []);
  const coil = useMemo(() => coilLayout(), []);
  const [away, setAway] = useState(stored); // stored, and finished going
  const root = useRef();
  const pivot = useRef(); // shrinks it into the middle of its coil as it goes, and grows it back
  const tube = useRef();
  const iecRef = useRef();
  const wallRef = useRef();
  const state = useRef({
    iec: newFollower(),
    wall: newFollower(),
    coiled: stored ? 1 : 0, // a cord that starts plugged in has no coil to unwind
    size: stored ? 0 : 1,
    last: null,
    geometry: null,
    seatPos: v3(),
    seatQuat: new THREE.Quaternion(),
    rootQuat: new THREE.Quaternion(),
    target: v3(),
    aim: new THREE.Quaternion(),
  });

  useEffect(() => {
    iecPlug.traverse((o) => {
      if (o.isMesh) o.raycast = iec === "hover" ? raycastOnTop : THREE.Mesh.prototype.raycast;
    });
    wallPlug.traverse((o) => {
      if (o.isMesh) o.raycast = wall === "hover" ? raycastOnTop : THREE.Mesh.prototype.raycast;
    });
  }, [iecPlug, wallPlug, iec, wall]);

  useEffect(() => {
    const s = state.current;
    return () => s.geometry?.dispose();
  }, []);

  useFrame((frame, dt) => {
    if (!stored && away) setAway(false); // taken out again
    const s = state.current;
    const g = root.current;
    const seat = anchor?.current;
    if (!g || !tube.current) return;

    // the IEC plug: in the PSU's inlet, or on the coil
    const iecAt = seat ? iec : "out";
    if (iecAt === "out") {
      follow(s.iec, "out", coil.iec.pos, coil.iec.quat, dt);
    } else {
      g.updateWorldMatrix(true, false);
      seat.updateWorldMatrix(true, false);
      seat.getWorldPosition(s.seatPos);
      g.worldToLocal(s.seatPos);
      seat.getWorldQuaternion(s.seatQuat);
      g.getWorldQuaternion(s.rootQuat);
      s.aim.copy(s.rootQuat).invert().multiply(s.seatQuat);
      s.target.copy(s.seatPos);
      if (iecAt === "hover") s.target.addScaledVector(v3(0, 1, 0).applyQuaternion(s.aim), IEC_OUT);
      follow(s.iec, iecAt, s.target, s.aim, dt);
    }

    // the wall plug: in the strip, on its way, on the bench in front of it, or on the coil
    if (wall === "in" || wall === "hover") {
      s.target.set(...STRIP_SOCKET);
      if (wall === "hover") s.target.y += WALL_OUT;
      follow(s.wall, wall, s.target, SEAT_TURN, dt);
    } else if (iecAt !== "out") {
      follow(s.wall, "rest", WALL_REST.pos, WALL_REST.quat, dt);
    } else {
      follow(s.wall, "out", coil.wall.pos, coil.wall.quat, dt);
    }

    const wantCoil = iecAt === "out" && wall === "out" ? 1 : 0;
    s.coiled += (wantCoil - s.coiled) * (1 - Math.exp(-Math.min(dt, 0.05) * 5));
    if (Math.abs(wantCoil - s.coiled) < 0.002) s.coiled = wantCoil;

    // back into the compartment once it has coiled up, and out of it again
    const wantSize = stored && s.coiled > 0.95 ? 0 : 1;
    s.size += (wantSize - s.size) * (1 - Math.exp(-Math.min(dt, 0.05) * 10));
    if (wantSize === 1 && s.size > 0.995) s.size = 1;
    if (wantSize === 0 && s.size < 0.01) setAway(true);
    pivot.current.scale.setScalar(Math.max(s.size, 0.001));

    iecRef.current.position.copy(s.iec.pos);
    iecRef.current.quaternion.copy(s.iec.quat);
    wallRef.current.position.copy(s.wall.pos);
    wallRef.current.quaternion.copy(s.wall.quat);
    // a plug waiting to go in bobs by itself, out over the cord's end (no gap), so the cord isn't rebuilt for it
    const bob = (Math.sin(frame.clock.elapsedTime * 4) + 1) * 0.006;
    if (iecAt === "hover") iecRef.current.translateY(bob);
    if (wall === "hover") wallRef.current.translateY(bob);

    // the cord, rebuilt only when it moved
    const stamp = [s.iec.pos, s.wall.pos].flatMap((p) => [p.x, p.y, p.z]).concat(s.iec.quat.x, s.iec.quat.y, s.iec.quat.z, s.iec.quat.w, s.wall.quat.x, s.wall.quat.y, s.wall.quat.z, s.wall.quat.w, s.coiled);
    if (s.last && tube.current.geometry === s.geometry && stamp.every((n, i) => Math.abs(n - s.last[i]) < 2e-4)) return;
    s.last = stamp;
    const da = v3(0, 1, 0).applyQuaternion(s.iec.quat);
    const db = v3(0, 1, 0).applyQuaternion(s.wall.quat);
    const a = s.iec.pos.clone().addScaledVector(da, PLUG_REACH_MAINS);
    const b = s.wall.pos.clone().addScaledVector(db, PLUG_REACH_MAINS);
    const route = routeThrough(a, da, b, db);
    const pts = route.map((p, i) => p.lerp(coil.points[i], s.coiled));
    // whatever the blend, the cord stays joined to both plugs
    const fix0 = a.clone().sub(pts[0]);
    const fix1 = b.clone().sub(pts[SAMPLES - 1]);
    const REACH = 10;
    for (let i = 0; i < REACH; i++) {
      const w = (1 - i / REACH) ** 2;
      pts[i].addScaledVector(fix0, w);
      pts[SAMPLES - 1 - i].addScaledVector(fix1, w);
    }
    s.geometry?.dispose();
    s.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 180, CORD_RADIUS, 8, false);
    tube.current.geometry = s.geometry;
  });

  if (stored && away) return null;

  const [coilX, coilZ] = CORD_COIL.center;
  const hit = (position) => (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 10, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
  return (
    <group ref={pivot} position={[coilX, 0, coilZ]}>
      <group position={[-coilX, 0, -coilZ]}>
        <group ref={root}>
          <mesh ref={tube} castShadow raycast={() => null}>
            <meshStandardMaterial color="#141518" roughness={0.68} metalness={0.05} />
          </mesh>
          <group ref={iecRef} userData={{ partId: "cord:psu" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onIec)} {...pointer}>
            <primitive object={iecPlug} />
            {hit([0, 0.09, 0])}
          </group>
          <group ref={wallRef} userData={{ partId: "cord:wall" }} onPointerDown={(e) => e.stopPropagation()} onClick={click(onWall)} {...pointer}>
            <primitive object={wallPlug} />
            {hit([0, 0.09, 0])}
          </group>
        </group>
      </group>
    </group>
  );
}
