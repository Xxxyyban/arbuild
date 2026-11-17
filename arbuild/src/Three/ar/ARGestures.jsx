// src/Three/ar/ARGestures.jsx
// Touch gestures for the placed rig in AR (WebXR and camera+gyro mode):
//   1 finger drag  -> spin the model around its vertical axis
//   2 finger drag  -> slide it along the floor (both fingers going the same way)
//   2 finger pinch -> resize
//   2 finger twist -> rotate
// The size can also be set from buttons (setScale), for anyone who finds a pinch awkward.
// The placement itself is never touched (in WebXR it stays glued to its anchor): gestures change a
// size, a turn and a slide that are applied to the rig on top of it.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { clampScale, fingers, intent, turned, slide } from "./twoFinger";

const DRAG_YAW_SPEED = 0.012;   // radians per pixel
const TAP_SLOP_PX = 10;         // movement under this still counts as a tap
const SUPPRESS_MS = 350;        // ignore the XR "select" that follows a gesture
const SMOOTHING = 14;           // higher = snappier

const still = () => ({ scale: 1, yaw: 0, x: 0, z: 0 });

// onScale(scale) hears the new size when a pinch ends, so a size readout can follow it.
export function useARGestures({ overlayRef, enabled, onScale }) {
  const onScaleRef = useRef(onScale);
  onScaleRef.current = onScale;
  // target = what the fingers ask for, shown = smoothed value actually rendered.
  // pan = a two-finger drag not yet turned into a slide: GestureGroup does that, as it has the camera
  // (in shares of the view: x right, y up, the whole view being 2 across).
  const state = useRef({ target: still(), shown: still(), pan: { x: 0, y: 0 }, suppressUntil: 0 });

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !enabled) return;

    const s = state.current;
    let mode = null; // "drag" (one finger) | "two"
    let start = null;
    let moved = false;

    const begin = (e) => {
      const t = e.touches;
      if (t.length === 1) {
        mode = "drag";
        start = { x: t[0].clientX, yaw: s.target.yaw };
        moved = false;
      } else if (t.length >= 2) {
        mode = "two";
        // kind: "pinch" or "move", once the fingers have shown which (twoFinger.js)
        start = { ...fingers(t[0], t[1]), kind: null, scale: s.target.scale, yaw: s.target.yaw, box: el.getBoundingClientRect() };
        moved = true; // two fingers is never a tap
        s.suppressUntil = performance.now() + SUPPRESS_MS;
      }
    };

    const onStart = (e) => {
      // the view itself (this element, the 3D canvas under it, or a marked surface): buttons and chips keep their own taps
      const t = e.target;
      if (t !== el && t.tagName !== "CANVAS" && t.dataset?.arSurface == null) return;
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
      } else if (mode === "two" && t.length >= 2) {
        const now = fingers(t[0], t[1]);
        if (!start.kind) {
          start.kind = intent(start, now);
          if (start.kind) Object.assign(start, now); // measured from here, so nothing jumps
        }
        if (start.kind === "pinch") {
          s.target.scale = clampScale((start.scale * now.d) / Math.max(1, start.d));
          s.target.yaw = start.yaw - turned(start.a, now.a);
        } else if (start.kind === "move") {
          s.pan.x += ((now.x - start.x) * 2) / Math.max(1, start.box.width);
          s.pan.y -= ((now.y - start.y) * 2) / Math.max(1, start.box.height);
          start.x = now.x;
          start.y = now.y;
        }
        s.suppressUntil = performance.now() + SUPPRESS_MS;
      }
      if (moved && e.cancelable) e.preventDefault();
    };

    const onEnd = (e) => {
      if (mode === "two" && start?.kind === "pinch") onScaleRef.current?.(s.target.scale);
      if (e.touches.length === 0) {
        mode = null;
        start = null;
      } else if (e.touches.length === 1 && mode === "two") {
        // lifted one of two fingers: carry on as a one-finger drag without a jump
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
        Object.assign(state.current, { target: still(), shown: still(), pan: { x: 0, y: 0 } });
      },
      // back to where it was placed (it eases there): for when it is about to be placed again
      recenter: () => {
        state.current.target.x = 0;
        state.current.target.z = 0;
      },
      // sets the size (the rig eases to it); returns it, kept between MIN_SCALE and MAX_SCALE
      setScale: (scale) => {
        const v = clampScale(scale);
        state.current.target.scale = v;
        return v;
      },
    }),
    []
  );
}

// Put this INSIDE <ARRoot>, around <DesktopRig />. It scales and spins the rig about its own
// center (0, pivotY, 0), so that neither moves it, and slides it by the two-finger drags.
export function GestureGroup({ api, pivotY, active, children }) {
  const ref = useRef();
  useFrame((three, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = api.state.current;
    if (s.pan.x || s.pan.y) {
      if (active && g.parent) slide(three.camera, g, s);
      s.pan.x = 0;
      s.pan.y = 0;
    }
    const target = active ? s.target : still();
    const k = 1 - Math.exp(-SMOOTHING * Math.min(dt, 0.05));
    for (const key of ["scale", "yaw", "x", "z"]) s.shown[key] += (target[key] - s.shown[key]) * k;
    const sc = s.shown.scale;
    g.scale.setScalar(sc);
    g.rotation.y = s.shown.yaw;
    g.position.set(s.shown.x, pivotY * (1 - sc), s.shown.z); // the center stays put while scaling
  });
  return <group ref={ref}>{children}</group>;
}
