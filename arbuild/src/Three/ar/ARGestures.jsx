// src/Three/ar/ARGestures.jsx
// Touch gestures for the placed rig in AR (WebXR and camera+gyro mode):
//   1 finger drag  -> spin the model around its vertical axis
//   2 finger pinch -> resize
//   2 finger twist -> rotate
// The model stays world-locked: gestures only change a scale/yaw that is
// applied around the rig's own center, never the camera or the placement.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const DRAG_YAW_SPEED = 0.012;   // radians per pixel
const TAP_SLOP_PX = 10;         // movement under this still counts as a tap
const SUPPRESS_MS = 350;        // ignore the XR "select" that follows a gesture
const SMOOTHING = 14;           // higher = snappier

const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const angle = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);

export function useARGestures({ overlayRef, enabled }) {
  // target = what the fingers ask for, shown = smoothed value actually rendered
  const state = useRef({
    target: { scale: 1, yaw: 0 },
    shown: { scale: 1, yaw: 0 },
    suppressUntil: 0,
  });

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !enabled) return;

    const s = state.current;
    let mode = null; // "drag" | "pinch"
    let start = null;
    let moved = false;

    const begin = (e) => {
      const t = e.touches;
      if (t.length === 1) {
        mode = "drag";
        start = { x: t[0].clientX, yaw: s.target.yaw };
        moved = false;
      } else if (t.length >= 2) {
        mode = "pinch";
        start = {
          d: dist(t[0], t[1]),
          a: angle(t[0], t[1]),
          scale: s.target.scale,
          yaw: s.target.yaw,
        };
        moved = true; // two fingers is never a tap
        s.suppressUntil = performance.now() + SUPPRESS_MS;
      }
    };

    const onStart = (e) => {
      if (e.target !== el) return; // buttons and chips keep their own taps
      begin(e);
    };

    const onMove = (e) => {
      if (!mode || !start) return;
      const t = e.touches;
      if (mode === "drag" && t.length === 1) {
        const dx = t[0].clientX - start.x;
        if (Math.abs(dx) > TAP_SLOP_PX) moved = true;
        if (moved) {
          s.target.yaw = start.yaw + dx * DRAG_YAW_SPEED;
          s.suppressUntil = performance.now() + SUPPRESS_MS;
        }
      } else if (mode === "pinch" && t.length >= 2) {
        const k = dist(t[0], t[1]) / Math.max(1, start.d);
        s.target.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * k));
        s.target.yaw = start.yaw - (angle(t[0], t[1]) - start.a);
        s.suppressUntil = performance.now() + SUPPRESS_MS;
      }
      if (moved && e.cancelable) e.preventDefault();
    };

    const onEnd = (e) => {
      if (e.touches.length === 0) {
        mode = null;
        start = null;
      } else if (e.touches.length === 1 && mode === "pinch") {
        // lifted one finger of a pinch: carry on as a drag without a jump
        mode = "drag";
        start = { x: e.touches[0].clientX, yaw: s.target.yaw };
        moved = true;
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [overlayRef, enabled]);

  return useMemo(
    () => ({
      state,
      // true if a drag/pinch just happened, so the tap-to-select should be ignored
      consumeSuppress: () => performance.now() < state.current.suppressUntil,
      reset: () => {
        state.current.target = { scale: 1, yaw: 0 };
        state.current.shown = { scale: 1, yaw: 0 };
      },
    }),
    []
  );
}

// Put this INSIDE <ARRoot>, around <DesktopRig />. It scales and spins the rig
// about its own center (0, pivotY, 0) so it does not slide across the floor.
export function GestureGroup({ api, pivotY, active, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = api.state.current;
    const target = active ? s.target : { scale: 1, yaw: 0 };
    const k = 1 - Math.exp(-SMOOTHING * Math.min(dt, 0.05));
    s.shown.scale += (target.scale - s.shown.scale) * k;
    s.shown.yaw += (target.yaw - s.shown.yaw) * k;
    const sc = s.shown.scale;
    g.scale.setScalar(sc);
    g.rotation.y = s.shown.yaw;
    g.position.set(0, pivotY * (1 - sc), 0); // keeps the center fixed while scaling
  });
  return <group ref={ref}>{children}</group>;
}