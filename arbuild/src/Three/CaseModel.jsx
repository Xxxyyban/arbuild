import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "./gltf";
import * as THREE from "three";
import { splitTriangles } from "./cpuSocket";
import { MM } from "./cableStubs";
import FrontPanelIO from "./FrontPanelIO";

const MODEL_PATH = "/models/case-meshify-c.glb";
const DEFAULT_TARGET_HEIGHT = 2.2;

// Round the case's own thumbscrews on the graphics card's two slots (case space: x -0.8997, the slots'
// rows y 1.1165 and 1.0173): each head, 8.1 mm across and 8.5 mm tall toward the glass from z 0.1469,
// and its shank, out through the card's bracket tab.
const SLOT_SCREW_BOXES = [1.1165, 1.0173].map(
  (y) => new THREE.Box3(new THREE.Vector3(-0.9217, y - 0.022, 0.1129), new THREE.Vector3(-0.8777, y + 0.022, 0.1909))
);
const slotSplits = new WeakMap(); // a mesh's geometry -> its thumbscrews' triangles and the rest, worked out once

/**
 * The case's thumbscrews on the graphics card's two slots, split off each mesh into meshes of their
 * own (the full model has them as their own nodes, the lite one inside bigger meshes), so the lab can
 * hide them while the card's own screws hold its bracket. root: the clone; toCase: the file's fit.
 */
function splitSlotScrews(root, toCase) {
  root.updateMatrixWorld(true);
  const fromRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse((o) => o.isMesh && !o.userData.slotScrew && meshes.push(o));
  for (const mesh of meshes) {
    const frame = toCase.clone().multiply(root.matrix).multiply(fromRoot).multiply(mesh.matrixWorld);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(frame);
    if (!SLOT_SCREW_BOXES.some((b) => b.intersectsBox(box)) || !mesh.geometry.index) continue;
    if (!slotSplits.has(mesh.geometry)) {
      // splitTriangles hands each corner over in millimetres
      const inMm = SLOT_SCREW_BOXES.map((b) => new THREE.Box3(b.min.clone().divideScalar(MM), b.max.clone().divideScalar(MM)));
      const p = new THREE.Vector3();
      const [screws, rest] = splitTriangles(mesh.geometry, frame, (c) => inMm.some((b) => b.containsPoint(p.fromArray(c))));
      slotSplits.set(mesh.geometry, { screws, rest });
    }
    const { screws, rest } = slotSplits.get(mesh.geometry);
    if (!screws.index.count) continue;
    mesh.geometry = rest;
    const part = new THREE.Mesh(screws, mesh.material);
    part.userData.slotScrew = true;
    part.castShadow = true;
    part.receiveShadow = true;
    mesh.add(part);
  }
  const parts = [];
  root.traverse((o) => o.userData.slotScrew && parts.push(o));
  return parts;
}

/**
 * Real scanned/modeled PC case with integrated internal placeholders 
 * for the Motherboard tray and PSU shroud chamber.
 * hideSlotScrews: hide the case's thumbscrews on the graphics card's two slots (the card's own screws hold it).
 * io: its front panel buttons and ports' props (FrontPanelIO.jsx: powered, onPower, onReset, onSelect).
 */
export default function CaseModel({ targetHeight = DEFAULT_TARGET_HEIGHT, showPlaceholders = false, hideSlotScrews = false, io = null, ...props }) {
  const group = useRef();
  const [modelExists, setModelExists] = useState(null);
  const { scene } = useGLTF(MODEL_PATH);

  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_PATH, { method: "HEAD" })
      .then((res) => !cancelled && setModelExists(res.ok))
      .catch(() => !cancelled && setModelExists(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [cloned]);

  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const height = size.y || 1;
    const s = targetHeight / height;

    return {
      scale: s,
      offset: [-center.x * s, -box.min.y * s, -center.z * s],
    };
  }, [cloned, targetHeight]);

  const slotScrews = useMemo(
    () => splitSlotScrews(cloned, new THREE.Matrix4().compose(new THREE.Vector3(...offset), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale))),
    [cloned, scale, offset]
  );
  useEffect(() => {
    slotScrews.forEach((m) => {
      m.visible = !hideSlotScrews;
      // a hidden mesh still takes clicks: these leave theirs to the card's screws
      m.raycast = hideSlotScrews ? () => {} : THREE.Mesh.prototype.raycast;
    });
  }, [slotScrews, hideSlotScrews]);

  return (
    <group ref={group} {...props}>
      <group scale={scale} position={offset}>
        {modelExists === false ? (
          <PlaceholderCase />
        ) : (
          <primitive object={cloned} />
        )}

        {/* Built-in Internal Placeholders for Motherboard and PSU */}
        {showPlaceholders && (
          <group>
            {/* 1. Motherboard Tray Placeholder (Vertical Standoff Area) */}
            <mesh position={[-0.05, 0.9, -0.15]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[1.2, 1.3, 0.02]} />
              <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.3} />
            </mesh>

            {/* 2. PSU Shroud Chamber Placeholder (Bottom Rear Basement) */}
            <mesh position={[-0.3, 0.25, -0.4]}>
              <boxGeometry args={[0.9, 0.45, 0.8]} />
              <meshBasicMaterial color="#eab308" wireframe transparent opacity={0.3} />
            </mesh>
          </group>
        )}
      </group>

      {/* its front panel buttons and ports: the model has none (laid out for the case 2.2 tall) */}
      {modelExists !== false && (
        <group scale={targetHeight / DEFAULT_TARGET_HEIGHT}>
          <FrontPanelIO {...io} />
        </group>
      )}
    </group>
  );
}

function PlaceholderCase() {
  return (
    <group>
      {/* Outer Chassis Wireframe Box */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[1.1, 2.2, 1.8]} />
        <meshStandardMaterial color="#1e293b" wireframe />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);