import { useRef, useState, useMemo, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const CLICK_SLOP = 0.03; // world units the part must move before a release counts as a drop

/**
 * isClickToPlace=true  (AR): tap the part, then tap a green marker.
 * isClickToPlace=false:      drag the part anywhere. The camera is locked while
 *                            you hold it. Release over a slot to snap it in.
 *                            A click without moving it calls onTap (RAM: pick it
 *                            up, then click a slot), and a selected part bobs.
 *
 * `targets` (optional) = several valid slots (e.g. 4 RAM slots). The part snaps
 * to the NEAREST one and onCorrect(index) receives that slot's index in `targets`.
 * Without `targets`, the single `target` is used and onCorrect(0) is called.
 *
 * Needs <OrbitControls makeDefault /> so `controls` is available here.
 */
export default function DraggablePart({
  trayPosition,
  target,
  targets,
  snapPx = 56, // release within this many screen pixels of a slot = correct
  missPx = 140, // released closer than this (but not on a slot) = counted as a miss
  snapByPointer = false, // measure from the pointer, not the part's origin (a long RAM stick held by one end)
  locked = false,
  isClickToPlace = false,
  isSelected = false,
  onClick,
  markerRadius = 0.2,
  hitRadius = 0.12,
  onCorrect,
  onIncorrect,
  onTap,
  onDragChange, // (true) when a drag starts, (false) when it ends
  onDrag,
  onPositionChange,
  children,
}) {
  const group = useRef();
  const { camera, controls, size } = useThree();

  const slots = targets && targets.length ? targets : [target];

  const [placed, setPlaced] = useState(false);
  const [position, setPosition] = useState(trayPosition);
  const [exploding, setExploding] = useState(false);

  const drag = useRef(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const latest = useRef({});
  latest.current = { isClickToPlace, isSelected, position, exploding, onDrag, onPositionChange };
  const finishRef = useRef(() => {});

  useEffect(() => {
    onPositionChange?.(position[0], position[1], position[2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // ---------- AR click mode ----------
  const handleSelect = (e) => {
    e.stopPropagation();
    onClick?.();
  };
  const handlePlace = (e, index = 0) => {
    e.stopPropagation();
    if (placed) return;
    setPlaced(true);
    onCorrect?.(index);
  };

  // ---------- drag ----------
  const handlePointerDown = (e) => {
    if (placed || exploding) return;
    e.stopPropagation();
    if (locked) {
      onClick?.(); // parent shows "mount the motherboard first"
      return;
    }
    const g = group.current;
    // plane facing the camera, through the grabbed point => free movement in all directions
    const normal = camera.getWorldDirection(new THREE.Vector3());
    const grab = e.point.clone();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, grab);
    const offset = g.getWorldPosition(new THREE.Vector3()).sub(grab);

    const up = () => finishRef.current();
    drag.current = { plane, offset, up, start: g.position.clone(), pointer: null };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    if (controls) controls.enabled = false; // lock the camera
    document.body.style.cursor = "grabbing";
    onDragChange?.(true);
  };

  const finishDrag = () => {
    const d = drag.current;
    if (!d) return;
    window.removeEventListener("pointerup", d.up);
    window.removeEventListener("pointercancel", d.up);
    drag.current = null;
    if (controls) controls.enabled = true; // unlock the camera
    document.body.style.cursor = "";
    onDragChange?.(false);

    const g = group.current;
    if (!g) return;

    // a click without moving the part (e.g. to read its info) is not a placement attempt
    if (g.position.distanceTo(d.start) < CLICK_SLOP) {
      g.position.copy(d.start);
      onTap?.();
      return;
    }

    // keep the part exactly where it was dropped
    setPosition([g.position.x, g.position.y, g.position.z]);

    // nearest slot, measured in screen pixels
    const toScreen = (world) => {
      const p = world.clone().project(camera);
      return new THREE.Vector2((p.x * size.width) / 2, (p.y * size.height) / 2);
    };
    const partScreen =
      snapByPointer && d.pointer
        ? new THREE.Vector2((d.pointer.x * size.width) / 2, (d.pointer.y * size.height) / 2)
        : toScreen(g.getWorldPosition(new THREE.Vector3()));
    let best = -1;
    let bestDist = Infinity;
    slots.forEach((t, i) => {
      const slotWorld = g.parent.localToWorld(new THREE.Vector3(...t.position));
      const dist = partScreen.distanceTo(toScreen(slotWorld));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    if (best >= 0 && bestDist <= snapPx) {
      const p = slots[best].position;
      setPosition([p[0], p[1], p[2]]);
      setPlaced(true);
      onCorrect?.(best);
    } else if (bestDist <= missPx) {
      onIncorrect?.(); // close but wrong: counts a miss, part stays put
    }
  };
  finishRef.current = finishDrag;

  // release controls if unmounted mid-drag
  useEffect(
    () => () => {
      const d = drag.current;
      if (d) {
        window.removeEventListener("pointerup", d.up);
        window.removeEventListener("pointercancel", d.up);
        drag.current = null;
      }
      if (controls) controls.enabled = true;
      document.body.style.cursor = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const L = latest.current;

    if (L.isClickToPlace) {
      // the selected part hovers and bobs so you can see what you picked
      const lift = L.isSelected ? 0.04 + Math.sin(state.clock.elapsedTime * 4) * 0.015 : 0;
      g.position.set(L.position[0], L.position[1] + lift, L.position[2]);
      return;
    }

    const d = drag.current;
    if (d) {
      d.pointer = state.pointer.clone();
      raycaster.setFromCamera(state.pointer, camera);
      if (raycaster.ray.intersectPlane(d.plane, tmp)) {
        const local = g.parent.worldToLocal(tmp.add(d.offset));
        g.position.copy(local);
        L.onDrag?.(local.x, local.y, local.z);
        L.onPositionChange?.(local.x, local.y, local.z);
      }
      return;
    }

    // not dragging: settle onto the stored position (smooth snap into the slot); a part picked up
    // with a click hovers and bobs there
    const lift = L.isSelected ? 0.04 + Math.sin(state.clock.elapsedTime * 4) * 0.015 : 0;
    const k = 1 - Math.exp(-dt * 12);
    g.position.lerp(tmp.set(L.position[0], L.position[1] + lift, L.position[2]), k);
  });

  const handlers = isClickToPlace
    ? { onClick: handleSelect }
    : {
        onPointerDown: handlePointerDown,
        onPointerOver: (e) => {
          e.stopPropagation();
          if (!drag.current) document.body.style.cursor = locked ? "not-allowed" : "grab";
        },
        onPointerOut: () => {
          if (!drag.current) document.body.style.cursor = "";
        },
      };

  return (
    <>
      <group ref={group} position={position} {...handlers}>
        {exploding && <ExplosionBurst />}
        <group visible={!exploding}>{children}</group>
        {/* invisible grab area so thin parts are easy to pick up */}
        <mesh>
          <sphereGeometry args={[hitRadius, 12, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {isClickToPlace &&
        isSelected &&
        !placed &&
        slots.map((t, i) => (
          <TargetMarker
            key={i}
            position={t.position}
            radius={markerRadius}
            onPlace={(e) => handlePlace(e, i)}
          />
        ))}
    </>
  );
}

// Glowing tap target shown where the selected part can go (AR mode).
function TargetMarker({ position, radius, onPlace }) {
  const ref = useRef();
  useFrame((s) => {
    ref.current?.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 5) * 0.12);
  });
  return (
    <group position={position}>
      <mesh ref={ref} renderOrder={998} onClick={onPlace}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.35} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ExplosionBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => ({
        dir: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize(),
        speed: 1.5 + Math.random() * 1.5,
      })),
    []
  );
  const ref = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    ref.current.children.forEach((mesh, i) => {
      const p = particles[i];
      mesh.position.addScaledVector(p.dir, p.speed * delta);
      mesh.material.opacity = Math.max(0, 1 - t.current * 2.2);
    });
  });
  return (
    <group ref={ref}>
      {particles.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial color="#e8a33d" emissive="#e8a33d" emissiveIntensity={1.5} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}