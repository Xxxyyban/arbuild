import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, ContactShadows } from "@react-three/drei";

export default function Scene3D({ children, isCameraOn = false }) {
  return (
    <div style={{ width: "100%", height: "100%", touchAction: "none" }}>
      <Canvas
        shadows
        camera={{ position: [6, 5, 7], fov: 45 }}
        dpr={[1, 2]}
        gl={{ alpha: true, preserveDrawingBuffer: true }}
      >
        {/* Only render solid background color and fog when camera is OFF */}
        {!isCameraOn && (
          <>
            <color attach="background" args={["#f0f4f8"]} />
            <fog attach="fog" args={["#f0f4f8", 14, 28]} />
          </>
        )}

        {/* Hemisphere light ensures sky and ground illumination are both bright */}
        <hemisphereLight skyColor="#ffffff" groundColor="#b0bec5" intensity={1.8} />

        <ambientLight intensity={1.5} />
        
        <directionalLight
          position={[5, 8, 5]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <Suspense fallback={null}>
          {/* Desk / Table Surface Model (Hidden in AR mode so it doesn't float in the air) */}
          {!isCameraOn && (
            <group position={[0, -1.1, 0]}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[5, 0.1, 4]} />
                <meshStandardMaterial color="#3e2723" roughness={0.4} />
              </mesh>
            </group>
          )}

          {/* Main workspace container where Case and Motherboard live */}
          <group position={[0, -1, 0]}>
            {children}
          </group>

          <Environment preset="studio" environmentIntensity={1.5} />
        </Suspense>

        <ContactShadows
          position={[0, -1.05, 0]}
          opacity={0.3}
          scale={12}
          blur={2}
          far={4}
        />

        {/* Hide floor grid when camera is on for a true AR look */}
        {!isCameraOn && (
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