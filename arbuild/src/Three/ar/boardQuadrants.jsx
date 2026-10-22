import { useMemo } from "react";
import * as THREE from "three";

// Which face of the motherboard points toward the viewer (board is rotated PI on Y).
export const BOARD_VIEW_SIGN = -1;

// The four regions the motherboard is split into. Each has a chip label (shown in
// the overlay) and the content used to build its info card.
export const QUADRANTS = {
  tl: {
    chip: "CPU & Socket",
    title: "CPU Socket Area",
    summary: "Top-left: the processor socket, VRM heatsinks and CPU power headers.",
    parts: ["CPU socket (LGA/AM)", "VRM & heatsinks", "8-pin CPU power (EPS)", "CPU fan header"],
  },
  tr: {
    chip: "Memory",
    title: "Memory (DIMM) Slots",
    summary: "Top-right: the DIMM slots where RAM modules are installed in channels.",
    parts: ["DIMM slots A1/A2/B1/B2", "Dual-channel pairing", "XMP / EXPO profiles", "Retention clips"],
  },
  bl: {
    chip: "Rear I/O & Expansion",
    title: "Expansion & Rear I/O",
    summary: "Bottom-left: the PCIe slots and the rear I/O shield for external ports.",
    parts: ["PCIe x16 (GPU)", "PCIe x1 slots", "M.2 NVMe slot", "Rear I/O panel"],
  },
  br: {
    chip: "Storage & Front Panel",
    title: "Storage & Front Panel",
    summary: "Bottom-right: SATA ports, the 24-pin power and front-panel connectors.",
    parts: ["SATA data ports", "24-pin ATX power", "Front-panel header", "USB / fan headers"],
  },
};

const QUAD_KEYS = Object.keys(QUADRANTS);

// Bounding box of `target`'s meshes expressed in `space`'s local coordinate system.
export function measureBoxInSpace(target, space) {
  space.updateWorldMatrix(true, true);
  target.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  const box = new THREE.Box3();
  target.traverse((o) => {
    if (o.isMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      box.union(o.geometry.boundingBox.clone().applyMatrix4(m));
    }
  });
  return box;
}

function centers(box) {
  return { cx: (box.min.x + box.max.x) / 2, cy: (box.min.y + box.max.y) / 2 };
}

// Maps a local point on the board to one of the four quadrant ids.
export function quadrantFromLocal(local, box) {
  if (!box) return null;
  const { cx, cy } = centers(box);
  const top = local.y >= cy;
  const left = local.x <= cx;
  if (top && left) return "tl";
  if (top && !left) return "tr";
  if (!top && left) return "bl";
  return "br";
}

// Centre (and size) of a quadrant, in the board's local space.
export function quadrantRect(id, box) {
  const { cx, cy } = centers(box);
  const z = (box.min.z + box.max.z) / 2;
  const halfW = (box.max.x - box.min.x) / 2;
  const halfH = (box.max.y - box.min.y) / 2;
  const left = id === "tl" || id === "bl";
  const top = id === "tl" || id === "tr";
  const x = cx + (left ? -halfW / 2 : halfW / 2);
  const y = cy + (top ? halfH / 2 : -halfH / 2);
  return {
    center: new THREE.Vector3(x, y, z),
    size: new THREE.Vector2(halfW, halfH),
  };
}

// Draws the dividing cross + a highlight on the active quadrant while focused.
export function QuadrantGuides({ box, visible, active }) {
  const data = useMemo(() => {
    if (!box) return null;
    const { cx, cy } = centers(box);
    const z = box.max.z + 0.01;
    const w = box.max.x - box.min.x;
    const h = box.max.y - box.min.y;
    return { cx, cy, z, w, h };
  }, [box]);

  if (!data || !visible) return null;
  const { cx, cy, z, w, h } = data;

  return (
    <group>
      {/* vertical + horizontal divider */}
      <mesh position={[cx, cy, z]}>
        <boxGeometry args={[0.006, h, 0.004]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[cx, cy, z]}>
        <boxGeometry args={[w, 0.006, 0.004]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {QUAD_KEYS.map((id) => {
        const r = quadrantRect(id, box);
        const isActive = active === id;
        return (
          <mesh key={id} position={[r.center.x, r.center.y, z]}>
            <planeGeometry args={[r.size.x * 0.96, r.size.y * 0.96]} />
            <meshBasicMaterial
              color={isActive ? "#10b981" : "#38bdf8"}
              transparent
              opacity={isActive ? 0.22 : 0.05}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
