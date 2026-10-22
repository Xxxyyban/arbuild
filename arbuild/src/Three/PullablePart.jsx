import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * PullablePart — the disassembly counterpart of DraggablePart.
 *
 * Wrap a part that is currently mounted. The user grabs it and drags it away:
 *  - it follows the pointer (in a plane facing the camera, or along `axis`)
 *  - dragging at least `pullPx` screen pixels and releasing pulls it free -> onPull(worldPosition)
 *  - releasing early makes it spring back into place
 *  - if `locked` (the part can't come out yet) it only budges a little, springs back,
 *    and onBlocked() fires once so the page can show a hint
 *  - a plain tap (almost no movement) calls onTap() so the page can say "drag it out"
 *
 * Put it INSIDE the group that already positions/rotates the part. The offset it applies is
 * in that parent group's local space, so existing transforms keep working.
 */

const ZERO = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();

export default function PullablePart({
  partId,
  locked = false,
  axis = null, // optional [x, y, z] in the parent's local space; null = free drag
  pullPx = 110, // how far (screen px) the part must be dragged to come out
  resist = 0.12, // how much a locked part moves compared to the pointer (0 = not at all)
  onPull,
  onBlocked,
  onTap,
  onHoverChange,
  children,
}) {
  const ref = useRef();
  const { camera, gl } = useThree();
  const get = useThree((s) => s.get);

  // always read the newest props from inside window listeners
  const latest = useRef({});
  latest.current = { locked, axis, pullPx, resist, onPull, onBlocked, onTap, onHoverChange };

  const s = useRef({
    dragging: false,
    pulled: false,
    blocked: false,
    px: 0,
    startX: 0,
    startY: 0,
    plane: new THREE.Plane(),
    grabLocal: new THREE.Vector3(),
    localStart: new THREE.Vector3(),
    target: new THREE.Vector3(),
    controls: null,
    prevEnabled: true,
    cleanup: null,
  });

  // where the pointer ray meets the drag plane
  const hit = (clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect();
    _ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    _ray.setFromCamera(_ndc, camera);
    return _ray.ray.intersectPlane(s.current.plane, new THREE.Vector3());
  };

  const onPointerDown = (e) => {
    const g = ref.current;
    const st = s.current;
    if (!g || !g.parent || st.pulled || st.dragging) return;
    if (e.nativeEvent.button > 0) return; // left button / touch only
    e.stopPropagation();

    const parent = g.parent;
    const origin = g.getWorldPosition(new THREE.Vector3());
    const normal = camera.getWorldDirection(new THREE.Vector3());
    st.plane.setFromNormalAndCoplanarPoint(normal, origin);

    const startHit = hit(e.nativeEvent.clientX, e.nativeEvent.clientY) || origin;
    parent.updateWorldMatrix(true, false);
    st.localStart.copy(parent.worldToLocal(startHit.clone()));
    st.grabLocal.copy(g.position);
    st.target.copy(g.position);
    st.startX = e.nativeEvent.clientX;
    st.startY = e.nativeEvent.clientY;
    st.px = 0;
    st.dragging = true;
    st.blocked = latest.current.locked;

    // pause orbit controls while pulling (needs <OrbitControls makeDefault />)
    const controls = get().controls;
    st.controls = controls || null;
    st.prevEnabled = controls ? controls.enabled : true;
    if (controls) controls.enabled = false;
    document.body.style.cursor = "grabbing";

    if (st.blocked) latest.current.onBlocked?.();

    const move = (ev) => {
      const p = hit(ev.clientX, ev.clientY);
      if (!p) return;
      st.px = Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY);
      parent.updateWorldMatrix(true, false);
      const delta = parent.worldToLocal(p).sub(st.localStart);
      const ax = latest.current.axis;
      if (ax) {
        const a = new THREE.Vector3(ax[0], ax[1], ax[2]).normalize();
        const along = delta.dot(a);
        delta.copy(a).multiplyScalar(along);
      }
      if (st.blocked) delta.multiplyScalar(latest.current.resist);
      st.target.copy(st.grabLocal).add(delta);
    };

    const up = () => {
      const L = latest.current;
      const px = st.px;
      st.cleanup?.();
      if (st.blocked) return; // it just springs back
      if (px >= L.pullPx) {
        st.pulled = true;
        L.onPull?.(g.getWorldPosition(new THREE.Vector3()));
      } else if (px < 6) {
        L.onTap?.();
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    st.cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (st.controls) st.controls.enabled = st.prevEnabled;
      st.controls = null;
      st.dragging = false;
      st.cleanup = null;
      document.body.style.cursor = "";
    };
  };

  const onPointerOver = (e) => {
    e.stopPropagation();
    if (!s.current.dragging) document.body.style.cursor = "grab";
    latest.current.onHoverChange?.(true);
  };

  const onPointerOut = () => {
    if (!s.current.dragging) document.body.style.cursor = "";
    latest.current.onHoverChange?.(false);
  };

  // follow the pointer while dragging, spring back to the mounted spot otherwise
  useFrame((_, dt) => {
    const g = ref.current;
    const st = s.current;
    if (!g || st.pulled) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * (st.dragging ? 25 : 9));
    g.position.lerp(st.dragging ? st.target : ZERO, k);
  });

  useEffect(() => {
    const st = s.current;
    return () => {
      st.cleanup?.();
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <group
      ref={ref}
      userData={{ partId }} // lets AR taps find which part was hit
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {children}
    </group>
  );
}