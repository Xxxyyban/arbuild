import { createContext } from "react";
import { createXRStore } from "@react-three/xr";

// Markerless WebXR AR.
// hitTest finds real flat surfaces; the DOM overlay carries the HUD and buttons.
// planeDetection / depthSensing are left out on purpose: they are not used and
// can make session creation fail on some phones.
export const xrStore = createXRStore({
  hitTest: true,
  domOverlay: true,
  offerSession: false,
  emulate: false,
});

export const ARContext = createContext(false);

export async function isARSupported() {
  try {
    if (!navigator.xr) return false;
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}