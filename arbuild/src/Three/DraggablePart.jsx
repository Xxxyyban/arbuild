import { useRef, useState, useMemo, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Wraps any 3D part (motherboard, RAM, PSU, etc.) with drag-to-place
 * behavior. Reports live position via onDrag while dragging — used as
 * a temporary debug tool to find correct snap-target coordinates.
 */
export default function DraggablePart({
  trayPosition,
  target,
  tolerance = 0.35,
  buildAreaRadius = 4,
  dragHeight = null,
  locked = false,
  onCorrect,
  onIncorrect,
  onDrag,
  children,
}) {
  const group = useRef();
  const { camera, gl, raycaster, pointer } = useThree();

  const [dragging, setDragging] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [position, setPosition] = useState(trayPosition);
  const [exploding, setExploding] = useState(false);

  const planeY = dragHeight ?? trayPosition[1];
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY),
    [planeY]
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (locked || placed) return;
      e.stopPropagation();
      gl.domElement.setPointerCapture?.(e.pointerId);
      setDragging(true);
    },
    [locked, placed, gl]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!dragging) return;
      setDragging(false);

      const current = group.current.position;
      const dx = current.x - target.position[0];
      const dz = current.z - target.position[2];
      const dy = current.y - target.position[1];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= tolerance) {
        setPosition([target.position[0], target.position[1], target.position[2]]);
        setPlaced(true);
        onCorrect?.();
        return;
      }

      const withinBuildArea = Math.sqrt(dx * dx + dz * dz) <= buildAreaRadius;

      if (withinBuildArea) {
        setExploding(true);
        onIncorrect?.();
        setTimeout(() => {
          setExploding(false);
          setPosition(trayPosition);
        }, 420);
      } else {
        setPosition(trayPosition);
      }
    },
    [dragging, target, tolerance, buildAreaRadius, trayPosition, onCorrect, onIncorrect]
  );

  useFrame(() => {
    if (!dragging || !group.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, hit);
    if (hit) {
      group.current.position.x = hit.x;
      group.current.position.z = hit.z;
      group.current.position.y = planeY;
      onDrag?.(hit.x, planeY, hit.z);
    }
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMissed={() => dragging && handlePointerUp({})}
    >
      {exploding && <ExplosionBurst />}
      <group visible={!exploding}>{children}</group>
    </group>
  );
}

function ExplosionBurst() {
  const particles = useMemo(() => {
    return Array.from({ length: 14 }).map(() => ({
      dir: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.8,
        Math.random() - 0.5
      ).normalize(),
      speed: 1.5 + Math.random() * 1.5,
    }));
  }, []);

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
          <meshStandardMaterial
            color="#e8a33d"
            emissive="#e8a33d"
            emissiveIntensity={1.5}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}