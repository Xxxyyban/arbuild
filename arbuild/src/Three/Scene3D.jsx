import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, ContactShadows } from "@react-three/drei";
import { XR, XRDomOverlay, useXR, useXRHitTest } from "@react-three/xr";
import { xrStore, ARContext } from "./xrSetup";

// Your existing assembly is authored in a larger virtual coordinate system.
// 0.15 makes the PC/case roughly real-world tabletop size.
const WORLD_SCALE = 0.15;
const IDENTITY = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// Scratch objects reused every frame by the hit-test callback.
const HIT_MATRIX = new THREE.Matrix4();
const HIT_POS = new THREE.Vector3();
const HIT_QUAT = new THREE.Quaternion();
const HIT_SCALE = new THREE.Vector3();
const TMP_UP = new THREE.Vector3();

// A surface only counts if its normal points (almost) straight up,
// so walls are ignored and only floors/tables get the reticle.
const MIN_UP = 0.9;

const arButton = {
  pointerEvents: "auto",
  minHeight: 48,
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(15,23,42,0.92)",
  color: "#fff",
  font: "600 15px system-ui, sans-serif",
  boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
};

// Stops taps on overlay buttons from also being "selects" in the AR scene.
function OverlayShield({ children }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e) => {
      if (e.target !== el) e.preventDefault();
    };
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {children}
    </div>
  );
}

function SceneBody({ children, isCameraOn, overlay }) {
  const inAR = useXR((state) => state.mode === "immersive-ar");
  const camera = useThree((state) => state.camera);

  // null = AR has not placed the PC yet.
  // Once set, this transform is NOT updated by the hit-test reticle.
  // That is the world-lock part: the PC stays at this XR-world transform.
  const [placedPose, setPlacedPose] = useState(null);
  const [surfaceFound, setSurfaceFound] = useState(false);
  const reticle = useRef();

  useEffect(() => {
    if (!inAR) {
      setPlacedPose(null);
      setSurfaceFound(false);
    }
  }, [inAR]);

  // Markerless surface detection against real detected planes.
  useXRHitTest(
    inAR && !placedPose
      ? (results, getWorldMatrix) => {
          let ok = false;

          if (results.length > 0 && reticle.current) {
            getWorldMatrix(HIT_MATRIX, results[0]);
            HIT_MATRIX.decompose(HIT_POS, HIT_QUAT, HIT_SCALE);
            TMP_UP.copy(UP).applyQuaternion(HIT_QUAT);

            if (TMP_UP.y >= MIN_UP) {
              reticle.current.position.copy(HIT_POS);
              reticle.current.quaternion.copy(HIT_QUAT);
              ok = true;
            }
          }

          setSurfaceFound((previous) => (previous === ok ? previous : ok));
        }
      : undefined,
    "viewer",
    "plane"
  );

  const placePC = () => {
    if (!reticle.current || !surfaceFound) return;

    const position = reticle.current.position.clone();

    // Only keep the HEIGHT of the surface; choose the rotation ourselves so the
    // parts tray (+z side of the bench) faces the person.
    const cam = camera.getWorldPosition(new THREE.Vector3());
    const yaw = Math.atan2(cam.x - position.x, cam.z - position.z);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(UP, yaw);

    setPlacedPose({ position, quaternion });
  };

  const movePC = () => {
    setPlacedPose(null);
    setSurfaceFound(false);
  };

  const showNormalScene = !inAR && !isCameraOn;

  return (
    <>
      {showNormalScene && (
        <>
          <color attach="background" args={["#f0f4f8"]} />
          <fog attach="fog" args={["#f0f4f8", 14, 28]} />
        </>
      )}

      <hemisphereLight skyColor="#ffffff" groundColor="#b0bec5" intensity={1.8} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />

      <Suspense fallback={null}>
        {/* Virtual workbench is used only in the normal desktop 3D lab. */}
        {showNormalScene && (
          <group position={[0, -1.1, 0]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[5, 0.1, 4]} />
              <meshStandardMaterial color="#3e2723" roughness={0.4} />
            </mesh>
          </group>
        )}

        <ARContext.Provider value={inAR}>
          <group
            // Desktop: always visible. Camera fallback: hidden.
            // WebXR AR: hidden until a real surface is detected and placed.
            visible={!isCameraOn && !inAR ? true : inAR ? !!placedPose : false}
            position={inAR && placedPose ? placedPose.position : [0, -1, 0]}
            quaternion={inAR && placedPose ? placedPose.quaternion : IDENTITY}
            scale={inAR ? WORLD_SCALE : 1}
          >
            {children}

            <ContactShadows
              position={[0, inAR ? 0.002 : -0.05, 0]}
              opacity={0.3}
              scale={12}
              blur={2}
              far={4}
            />
          </group>
        </ARContext.Provider>

        {showNormalScene && <Environment preset="studio" environmentIntensity={1.5} />}
      </Suspense>

      {/* Placement reticle. Only exists before placement. */}
      {inAR && !placedPose && (
        <group ref={reticle} visible={surfaceFound}>
          <mesh rotation-x={-Math.PI / 2} raycast={() => null}>
            <ringGeometry args={[0.12, 0.15, 40]} />
            <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {showNormalScene && (
        <Grid
          position={[0, -1.11, 0]}
          args={[20, 20]}
          cellColor="#cbd5e1"
          sectionColor="#64748b"
          fadeDistance={20}
          fadeStrength={1}
          infiniteGrid
        />
      )}

      <OrbitControls
        makeDefault
        enabled={!inAR && !isCameraOn}
        minDistance={3}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Always mounted so the session is requested with a valid overlay root.
          Its contents only render while in AR. */}
      <XRDomOverlay
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {inAR && (
          <OverlayShield>
            {overlay}

            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: "max(20px, env(safe-area-inset-bottom))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              {!placedPose && !surfaceFound && (
                <div
                  style={{
                    ...arButton,
                    pointerEvents: "none",
                    maxWidth: 340,
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  Move the camera slowly over a floor or table…
                </div>
              )}

              {surfaceFound && !placedPose && (
                <div
                  style={{
                    ...arButton,
                    pointerEvents: "none",
                    maxWidth: 340,
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  Surface found — place the PC here.
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  width: "100%",
                  maxWidth: 440,
                  justifyContent: "center",
                }}
              >
                {!placedPose ? (
                  <button
                    type="button"
                    style={{
                      ...arButton,
                      opacity: surfaceFound ? 1 : 0.5,
                      flex: "1 1 0",
                      maxWidth: 200,
                    }}
                    disabled={!surfaceFound}
                    onClick={placePC}
                  >
                    Place PC
                  </button>
                ) : (
                  <button
                    type="button"
                    style={{ ...arButton, flex: "1 1 0", maxWidth: 200 }}
                    onClick={movePC}
                  >
                    Move PC
                  </button>
                )}

                <button
                  type="button"
                  style={{ ...arButton, flex: "1 1 0", maxWidth: 200 }}
                  onClick={() => xrStore.getState().session?.end()}
                >
                  Exit AR
                </button>
              </div>
            </div>
          </OverlayShield>
        )}
      </XRDomOverlay>
    </>
  );
}

export default function Scene3D({ children, isCameraOn = false, overlay = null }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        touchAction: "none",
        position: "relative",
      }}
    >
      <Canvas
        shadows="percentage" // three r185 dropped the soft type and used this one anyway, with a warning
        camera={{ position: [6, 5, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ alpha: true, preserveDrawingBuffer: true }}
      >
        <XR store={xrStore}>
          <SceneBody isCameraOn={isCameraOn} overlay={overlay}>
            {children}
          </SceneBody>
        </XR>
      </Canvas>
    </div>
  );
}