import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, ContactShadows } from "@react-three/drei";

/**
 * Desktop (non-AR) 3D viewport. Mouse-drag to orbit, scroll to zoom.
 * This is the fallback rendering path for lab computers without cameras.
 * The same child content (parts, snap logic) will later be reused inside
 * the WebXR camera-passthrough path for mobile.
 */
export default function Scene3D({ children }) {
  return (
    <div style={{ width: "100%", height: "100%", touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ position: [6, 5, 7], fov: 45 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0e14"]} />
        <fog attach="fog" args={["#0a0e14", 12, 26]} />

        <ambientLight intensity={0.35} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-5, 3, -5]} intensity={0.3} color="#4fd8c9" />

        <Suspense fallback={null}>
          {children}
          <Environment preset="city" />
        </Suspense>

        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.5}
          scale={12}
          blur={2}
          far={4}
        />

        <Grid
          position={[0, -0.02, 0]}
          args={[20, 20]}
          cellColor="#22304a"
          sectionColor="#2a6b64"
          fadeDistance={20}
          fadeStrength={1}
          infiniteGrid
        />

        <OrbitControls
          makeDefault
          minDistance={3}
          maxDistance={16}
          maxPolarAngle={Math.PI / 2.05}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}