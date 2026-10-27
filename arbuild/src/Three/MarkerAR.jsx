// src/Three/MarkerAR.jsx
// Marker AR with no AR.js: camera video + js-aruco2 marker detection + react-three-fiber.
// Needs: npm i js-aruco2
// Needs: HTTPS on the phone (iOS blocks the camera on plain http)
// Marker: ArUco ARUCO_MIP_36h12 (see DICTIONARY below). Any ID works.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
// js-aruco2 ships as plain browser scripts with no exports, so load the source as text
// and run it through script tags (see loadAruco below).
import cvSrc from "js-aruco2/src/cv.js?raw";
import svdSrc from "js-aruco2/src/svd.js?raw";
import arucoSrc from "js-aruco2/src/aruco.js?raw";
import positSrc from "js-aruco2/src/posit1.js?raw";
import { ARContext } from "./xrSetup";
import { renderSettings } from "./graphics";

function loadAruco() {
  // Run each file as a real classic <script>, in order, so CV / SVD / AR / POS become globals
  // exactly like in the package's own browser demos.
  if (!window.AR || !window.POS) {
    for (const src of [cvSrc, svdSrc, arucoSrc, positSrc]) {
      const el = document.createElement("script");
      el.textContent = src;
      document.head.appendChild(el);
      el.remove();
    }
  }
  if (!window.AR || !window.POS) throw new Error("js-aruco2 did not define AR / POS");
  return { AR: window.AR, POS: window.POS };
}
const { AR, POS } = loadAruco();

// Marker: dictionary ARUCO_MIP_36h12 (any ID 0-249). Make one at
// damianofalcioni.github.io/js-aruco2/samples/marker-creator/marker-creator.html?dictionary=ARUCO_MIP_36h12
// If it is never detected, try "ARUCO" (and a marker made with ?dictionary=ARUCO).
const DICTIONARY = "ARUCO_MIP_36h12";
const DETECT_W = 480;               // detection runs on a small copy of the frame
const SCALE = 0.18;                 // 1 unit = marker width; the bench is 5.4 wide (MarkerAR's scale)
// Rotates the scene so its "up" points out of the marker.
// If the PC appears lying on its side or upside down, change this.
const ORIENTATION = [Math.PI / 2, 0, 0];
const KEEP_MS = 400;                // keep showing the last pose briefly if tracking blips
const ONE = new THREE.Vector3(1, 1, 1);

/** The marker this looks for (id 0), as an SVG to print or show on another screen. */
export const markerSVG = (id = 0) => new AR.Dictionary(DICTIONARY).generateSVG(id);

function Tracker({ videoRef, onFound, scale, children }) {
  const group = useRef();
  const { camera, size } = useThree();
  const work = useMemo(() => document.createElement("canvas"), []);
  const s = useRef({
    detector: null,
    posit: null,
    frame: 0,
    has: false,
    lastSeen: 0,
    found: false,
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    tPos: new THREE.Vector3(),
    tQuat: new THREE.Quaternion(),
    m: new THREE.Matrix4(),
  });

  useFrame(() => {
    const v = videoRef.current;
    const g = group.current;
    const st = s.current;
    if (!v || !g || v.readyState < 2 || !v.videoWidth) return;

    const vw = v.videoWidth;
    const vh = v.videoHeight;

    // Match the 3D camera to the phone camera (video is shown with object-fit: cover).
    const cover = Math.max(size.width / vw, size.height / vh);
    const focalPx = vw * cover;
    const fov = (2 * Math.atan(size.height / (2 * focalPx)) * 180) / Math.PI;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const dw = DETECT_W;
    const dh = Math.round((DETECT_W * vh) / vw);
    if (work.width !== dw || work.height !== dh) {
      work.width = dw;
      work.height = dh;
      st.posit = new POS.Posit(1, dw); // model size 1 => units are marker widths
    }
    if (!st.detector) st.detector = new AR.Detector({ dictionaryName: DICTIONARY, maxHammingDistance: 5 });

    st.frame++;
    if (st.frame % 2 === 0) {
      const ctx = work.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, dw, dh);
      const markers = st.detector.detect(ctx.getImageData(0, 0, dw, dh));
      if (markers.length > 0) {
        const corners = markers[0].corners.map((c) => ({ x: c.x - dw / 2, y: dh / 2 - c.y }));
        const pose = st.posit.pose(corners);
        const R = pose.bestRotation;
        const t = pose.bestTranslation;
        // posit frame: x right, y up, z away from camera. three.js: z toward camera.
        st.m.set(
          R[0][0], R[0][1], -R[0][2], t[0],
          R[1][0], R[1][1], -R[1][2], t[1],
          -R[2][0], -R[2][1], R[2][2], -t[2],
          0, 0, 0, 1
        );
        st.m.decompose(st.tPos, st.tQuat, new THREE.Vector3());
        if (!st.has) {
          st.pos.copy(st.tPos);
          st.quat.copy(st.tQuat);
          st.has = true;
        } else {
          st.pos.lerp(st.tPos, 0.5);
          st.quat.slerp(st.tQuat, 0.5);
        }
        st.lastSeen = performance.now();
      }
    }

    const visible = st.has && performance.now() - st.lastSeen < KEEP_MS;
    g.visible = visible;
    if (visible !== st.found) {
      st.found = visible;
      onFound(visible);
    }
    if (st.has) {
      g.matrixAutoUpdate = false;
      g.matrix.compose(st.pos, st.quat, ONE);
      g.matrixWorldNeedsUpdate = true;
    }
  });

  return (
    <group ref={group} visible={false}>
      <group rotation={ORIENTATION} scale={scale}>
        {children}
      </group>
    </group>
  );
}

// scale: scene units to marker widths (the scene stands on the marker, its +Y out of it)
export default function MarkerAR({ children, overlay = null, onExit, scale = SCALE }) {
  const videoRef = useRef(null);
  const [found, setFound] = useState(false);
  const [camError, setCamError] = useState(null);

  useEffect(() => {
    let stream;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
      } catch (e) {
        setCamError(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#000", touchAction: "none" }}>
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      <Canvas
        camera={{ position: [0, 0, 0], fov: 50, near: 0.01, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={renderSettings().dpr} // fewer pixels on phones (graphics.js): the camera's tracking needs the time too
        style={{ position: "absolute", inset: 0 }}
      >
        <hemisphereLight skyColor="#ffffff" groundColor="#b0bec5" intensity={1.8} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 2, 1]} intensity={2} />
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={1.2} />
        </Suspense>
        <ARContext.Provider value={true}>
          <Tracker videoRef={videoRef} onFound={setFound} scale={scale}>
            <Suspense fallback={null}>{children}</Suspense>
          </Tracker>
        </ARContext.Provider>
      </Canvas>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
        {overlay}
      </div>

      <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "rgba(0,0,0,.6)", color: "#fff", padding: "8px 12px", borderRadius: 10, fontSize: 14 }}>
          {camError ? "Camera blocked: allow camera access and use https" : found ? "Marker found" : "Point the camera at the marker"}
        </div>
        {onExit && (
          <button onClick={onExit} style={{ pointerEvents: "auto", background: "#fff", color: "#000", border: 0, padding: "8px 14px", borderRadius: 10, fontSize: 14 }}>
            Exit AR
          </button>
        )}
      </div>
    </div>
  );
}