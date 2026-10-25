// Floating screen. One monitor object drives every status from both modes:
// off | shuttingDown | booting | loading | hello | bsod | post | nosignal
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, createPortal } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { SCREEN_W, SCREEN_H, MONITOR_SCALE, STATION, SCREEN_RES } from "../../lab/Constants";

function ScreenText({ children, x = 0, y = 0, size = 0.07, color = "#e2e8f0", maxWidth = SCREEN_W - 0.24, left = false }) {
  return (
    <Text
      position={[x, y, 0.002]} fontSize={size} color={color} maxWidth={maxWidth}
      textAlign={left ? "left" : "center"} anchorX={left ? "left" : "center"} anchorY="middle"
      lineHeight={1.25} raycast={() => null}
    >
      {children}
    </Text>
  );
}

function Spinner({ y = 0.08 }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= dt * 6;
  });
  return (
    <mesh ref={ref} position={[0, y, 0.002]}>
      <torusGeometry args={[0.09, 0.014, 8, 32, Math.PI * 1.5]} />
      <meshBasicMaterial color="#34d399" />
    </mesh>
  );
}

// Without a GPU the screen is drawn at low resolution and stretched without smoothing.
function ScreenSurface({ lowRes, children }) {
  const w = lowRes ? SCREEN_RES.low : SCREEN_RES.high;
  const h = Math.round((w * SCREEN_H) / SCREEN_W);

  const target = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(w, h, {
      minFilter: lowRes ? THREE.NearestFilter : THREE.LinearFilter,
      magFilter: lowRes ? THREE.NearestFilter : THREE.LinearFilter,
      generateMipmaps: false,
      samples: lowRes ? 0 : 4,
    });
    t.texture.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [w, h, lowRes]);
  useEffect(() => () => target.dispose(), [target]);

  const scene = useMemo(() => new THREE.Scene(), []);
  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera(-SCREEN_W / 2, SCREEN_W / 2, SCREEN_H / 2, -SCREEN_H / 2, 0.1, 10);
    c.position.set(0, 0, 2);
    return c;
  }, []);

  useFrame(({ gl }) => {
    const prevTarget = gl.getRenderTarget();
    const prevXR = gl.xr.enabled;
    gl.xr.enabled = false; // draw flat, not through the AR camera
    gl.setRenderTarget(target);
    gl.render(scene, cam);
    gl.setRenderTarget(prevTarget);
    gl.xr.enabled = prevXR;
  });

  return (
    <>
      {createPortal(children, scene)}
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial map={target.texture} toneMapped={false} />
      </mesh>
    </>
  );
}

const BG = {
  off: "#05080c",
  shuttingDown: "#10181f",
  bsod: "#0a5ab8",
  post: "#000000",
  hello: "#0c2229",
  nosignal: "#000000",
};

function ScreenContent({ monitor, userName }) {
  const { status } = monitor;
  const L = -SCREEN_W / 2 + 0.14;
  const bg = BG[status] ?? "#0a1620";
  return (
    <group>
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial color={bg} toneMapped={false} />
      </mesh>

      {status === "off" && <ScreenText y={0} size={0.07} color="#6b7a90">Powered off</ScreenText>}

      {status === "shuttingDown" && <ScreenText y={0} size={0.1} color="#b8c4d2">Shutting down…</ScreenText>}

      {(status === "booting" || status === "loading") && (
        <>
          <Spinner />
          <ScreenText y={-0.12} size={0.06}>{status === "booting" ? "Starting up…" : "Working on it…"}</ScreenText>
        </>
      )}

      {status === "hello" && (
        <>
          <ScreenText y={0.1} size={0.15}>{`Hello, ${userName}`}</ScreenText>
          <ScreenText y={-0.06} size={0.055} color="#b8c4d2">
            {monitor.seconds ? `Your PC started in ${monitor.seconds} s.` : "Your PC is up and running."}
          </ScreenText>
          {monitor.note && <ScreenText y={-0.2} size={0.045} color="#e8a33d">{monitor.note}</ScreenText>}
          {/* what you'd notice on the case (lab/Wires.js): three at most, then how many more */}
          {monitor.symptoms?.length > 0 && (
            <>
              <ScreenText y={-0.29} size={0.036} color="#94a3b8">Check the case:</ScreenText>
              {monitor.symptoms.slice(0, 3).map((s, i) => (
                <ScreenText key={s.text} y={-0.345 - i * 0.05} size={0.034} color="#fbbf24">{s.text}</ScreenText>
              ))}
              {monitor.symptoms.length > 3 && (
                <ScreenText y={-0.455} size={0.03} color="#94a3b8">{`and ${monitor.symptoms.length - 3} more`}</ScreenText>
              )}
            </>
          )}
        </>
      )}

      {status === "bsod" && (
        <>
          <ScreenText left x={L} y={0.3} size={0.26} color="#ffffff">:(</ScreenText>
          <ScreenText left x={L} y={0.1} size={0.05} color="#ffffff">Your PC ran into a problem and needs to restart.</ScreenText>
          <ScreenText left x={L} y={-0.02} size={0.04} color="#dbe7f7">100% complete</ScreenText>
          <ScreenText left x={L} y={-0.13} size={0.04} color="#ffffff">Stop code: CPU_THERMAL_TRIP</ScreenText>
          <ScreenText left x={L} y={-0.24} size={0.036} color="#dbe7f7">{`What failed: ${monitor.detail}`}</ScreenText>
          {monitor.fix && <ScreenText left x={L} y={-0.36} size={0.036} color="#ffe58a">{monitor.fix}</ScreenText>}
        </>
      )}

      {/* the PC is on, but nothing draws a picture: the monitor's own message */}
      {status === "nosignal" && (
        <group position={[0, -0.05, 0]}>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.62, 0.2]} />
            <meshBasicMaterial color="#1f2937" toneMapped={false} />
          </mesh>
          <ScreenText y={0.03} size={0.055} color="#e5e7eb">No signal</ScreenText>
          <ScreenText y={-0.045} size={0.034} color="#9ca3af">HDMI 1</ScreenText>
        </group>
      )}

      {status === "post" && (
        <>
          <ScreenText left x={L} y={0.25} size={0.06} color="#fbbf24">{monitor.title}</ScreenText>
          {monitor.detail && <ScreenText left x={L} y={0.08} size={0.045} color="#d1d5db">{monitor.detail}</ScreenText>}
          <ScreenText left x={L} y={-0.1} size={0.04} color="#f87171">{monitor.code}</ScreenText>
          <ScreenText left x={L} y={-0.3} size={0.036} color="#8b94a1">Power off, fix it, and try again.</ScreenText>
        </>
      )}
    </group>
  );
}

export default function MonitorStation({ monitor, userName }) {
  return (
    <group position={STATION.position} rotation={[0, STATION.rotationY, 0]} scale={MONITOR_SCALE}>
      <ScreenSurface lowRes={!!monitor.lowRes}>
        <ScreenContent monitor={monitor} userName={userName} />
      </ScreenSurface>
      <Text position={[0, -SCREEN_H / 2 - 0.08, 0.002]} fontSize={0.05} color="#9fb0c3" anchorX="center" anchorY="top" raycast={() => null}>
        {monitor.status === "nosignal" ? "No graphics output" : monitor.lowRes ? "Built-in graphics" : "Graphics card"}
      </Text>
    </group>
  );
}