// Floating screen. One monitor object drives every status from both modes:
// off | shuttingDown | booting | loading | hello | bsod | post | nosignal
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, createPortal } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { SCREEN_W, SCREEN_H, MONITOR_SCALE, STATION, SCREEN_RES } from "../../lab/Constants";

const TEXT_W = SCREEN_W - 0.24; // the widest a line of text gets
const TEXT_COLOR = "#e2e8f0";
const LINE_HEIGHT = 1.25;

function ScreenText({ children, x = 0, y = 0, size = 0.07, color = TEXT_COLOR, maxWidth = TEXT_W, left = false }) {
  return (
    <Text
      position={[x, y, 0.002]} fontSize={size} color={color} maxWidth={maxWidth}
      textAlign={left ? "left" : "center"} anchorX={left ? "left" : "center"} anchorY="middle"
      lineHeight={LINE_HEIGHT} raycast={() => null}
    >
      {children}
    </Text>
  );
}

/** One piece of a ScreenStack. It says how tall it came out once it's laid out. */
function StackText({ line, x, y, left, onHeight }) {
  const [scale, setScale] = useState(1);
  return (
    <Text
      position={[x, y, 0.002]}
      scale={scale}
      fontSize={line.size}
      color={line.color ?? TEXT_COLOR}
      maxWidth={line.fit ? Infinity : TEXT_W}
      whiteSpace={line.fit ? "nowrap" : "normal"}
      textAlign={left ? "left" : "center"}
      anchorX={left ? "left" : "center"}
      anchorY="top"
      lineHeight={LINE_HEIGHT}
      raycast={() => null}
      onSync={(mesh) => {
        const box = mesh.textRenderInfo?.blockBounds;
        if (!box) return;
        const shrink = line.fit ? Math.min(1, TEXT_W / (box[2] - box[0])) : 1;
        setScale(shrink);
        onHeight(line.text, (box[3] - box[1]) * shrink);
      }}
    >
      {line.text}
    </Text>
  );
}

/**
 * The screen's text, one piece under the other and centred up and down. Each starts below the one before
 * however many lines that one wrapped to, so a long name or message can't run into the next.
 * lines  [{ text, size, color, gap (above it), fit (one line, shrinking to the screen's width) }], falsy ones skipped
 */
function ScreenStack({ lines, x = 0, left = false }) {
  const [heights, setHeights] = useState({});
  const onHeight = (text, h) => setHeights((all) => (all[text] === h ? all : { ...all, [text]: h }));
  const shown = lines.filter(Boolean);
  const tall = (l) => heights[l.text] ?? l.size * LINE_HEIGHT; // one line, until it's been laid out
  const total = shown.reduce((sum, l, i) => sum + tall(l) + (i ? l.gap ?? 0 : 0), 0);
  const placed = [];
  let y = total / 2;
  shown.forEach((l, i) => {
    y -= i ? l.gap ?? 0 : 0;
    placed.push({ line: l, y });
    y -= tall(l);
  });
  return placed.map(({ line, y: top }) => <StackText key={line.text} line={line} x={x} y={top} left={left} onHeight={onHeight} />);
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
        <ScreenStack
          lines={[
            { text: `Hello, ${userName}`, size: 0.15, fit: true },
            { text: monitor.seconds ? `Your PC started in ${monitor.seconds} s.` : "Your PC is up and running.", size: 0.055, color: "#b8c4d2", gap: 0.03 },
            monitor.note && { text: monitor.note, size: 0.045, color: "#e8a33d", gap: 0.06 },
            // what you'd notice on the case (lab/Wires.js): three at most, then how many more
            monitor.symptoms?.length > 0 && { text: "Check the case:", size: 0.036, color: "#94a3b8", gap: 0.06 },
            ...(monitor.symptoms ?? []).slice(0, 3).map((s) => ({ text: s.text, size: 0.034, color: "#fbbf24", gap: 0.012 })),
            monitor.symptoms?.length > 3 && { text: `and ${monitor.symptoms.length - 3} more`, size: 0.03, color: "#94a3b8", gap: 0.012 },
          ]}
        />
      )}

      {status === "bsod" && (
        <ScreenStack
          left
          x={L}
          lines={[
            { text: ":(", size: 0.26, color: "#ffffff" },
            { text: "Your PC ran into a problem and needs to restart.", size: 0.05, color: "#ffffff", gap: 0.02 },
            { text: "100% complete", size: 0.04, color: "#dbe7f7", gap: 0.04 },
            { text: "Stop code: CPU_THERMAL_TRIP", size: 0.04, color: "#ffffff", gap: 0.04 },
            { text: `What failed: ${monitor.detail}`, size: 0.036, color: "#dbe7f7", gap: 0.03 },
            monitor.fix && { text: monitor.fix, size: 0.036, color: "#ffe58a", gap: 0.03 },
          ]}
        />
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
        <ScreenStack
          left
          x={L}
          lines={[
            { text: monitor.title, size: 0.06, color: "#fbbf24" },
            monitor.detail && { text: monitor.detail, size: 0.045, color: "#d1d5db", gap: 0.05 },
            { text: monitor.code, size: 0.04, color: "#f87171", gap: 0.06 },
            { text: "Power off, fix it, and try again.", size: 0.036, color: "#8b94a1", gap: 0.08 },
          ]}
        />
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
      {/* what's drawing the picture: at the screen's corner, where the case in front doesn't hide it */}
      <Text position={[-SCREEN_W / 2, -SCREEN_H / 2 - 0.02, 0.002]} fontSize={0.045} color="#64748b" anchorX="left" anchorY="top" raycast={() => null}>
        {monitor.status === "nosignal" ? "No graphics output" : monitor.lowRes ? "Built-in graphics" : "Graphics card"}
      </Text>
    </group>
  );
}