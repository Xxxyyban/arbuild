// Floating screen. One monitor object drives every status from both modes:
// off | shuttingDown | booting | loading | hello | bsod | post | nosignal
// Each new screen fades in. A badge in its corner gives the status as a colour and a word (lab/Screen.js),
// and a teardown's safety warning is a slowly pulsing strip along the bottom.
import { useRef, useMemo, useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, createPortal } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { SCREEN_W, SCREEN_H, MONITOR_SCALE, STATION, SCREEN_RES, PART_DOT } from "../../lab/Constants";
import { greetingFor, screenStatus, STATUS_COLOR } from "../../lab/Screen";
import { PillLabel, pillGeometry } from "../../Three/Hardware";

const TEXT_W = SCREEN_W - 0.24; // the widest a line of text gets
const TEXT_COLOR = "#e2e8f0";
const LINE_HEIGHT = 1.25;
const noRay = () => null;
/** The student's system asks for less motion: nothing fades or pulses. */
const calm = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function ScreenText({ children, x = 0, y = 0, size = 0.07, color = TEXT_COLOR, maxWidth = TEXT_W, left = false }) {
  return (
    <Text
      position={[x, y, 0.002]} fontSize={size} color={color} maxWidth={maxWidth}
      textAlign={left ? "left" : "center"} anchorX={left ? "left" : "center"} anchorY="middle"
      lineHeight={LINE_HEIGHT} raycast={noRay}
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
      raycast={noRay}
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

const FADE_S = 0.5;

/** Each new screen comes up out of its own background colour: a sheet over everything that clears. */
function ScreenFade({ status, color }) {
  const sheet = useRef();
  const t = useRef(FADE_S);
  useLayoutEffect(() => {
    t.current = calm() ? FADE_S : 0;
  }, [status]);
  useFrame((_, dt) => {
    const m = sheet.current;
    if (!m) return;
    t.current = Math.min(FADE_S, t.current + dt);
    const k = t.current / FADE_S;
    m.material.opacity = 1 - k * k * (3 - 2 * k);
    m.visible = m.material.opacity > 0.002;
  });
  return (
    <mesh ref={sheet} position={[0, 0, 0.02]} raycast={noRay}>
      <planeGeometry args={[SCREEN_W, SCREEN_H]} />
      <meshBasicMaterial color={color} transparent opacity={0} toneMapped={false} />
    </mesh>
  );
}

/** The status in the screen's top right corner: a coloured dot and a word, on a dark pill so they read on any screen. */
function StatusBadge({ level, label, big }) {
  const [wide, setWide] = useState(null);
  const size = big ? 0.052 : 0.034;
  const pad = size * 0.72;
  const dot = size * 0.62;
  const gap = size * 0.48;
  const w = pad * 2 + dot + gap + (wide ?? label.length * size * 0.54);
  const h = size * 1.8;
  const edge = size * 0.07;
  return (
    <group position={[SCREEN_W / 2 - 0.055 - w / 2, SCREEN_H / 2 - 0.055 - h / 2, 0.004]}>
      <mesh geometry={pillGeometry(w + edge * 2, h + edge * 2)} raycast={noRay}>
        <meshBasicMaterial color="#475569" toneMapped={false} />
      </mesh>
      <mesh geometry={pillGeometry(w, h)} position={[0, 0, 0.001]} raycast={noRay}>
        <meshBasicMaterial color="#0b1220" toneMapped={false} />
      </mesh>
      <mesh position={[-w / 2 + pad + dot / 2, 0, 0.002]} raycast={noRay}>
        <circleGeometry args={[dot / 2, 20]} />
        <meshBasicMaterial color={STATUS_COLOR[level]} toneMapped={false} />
      </mesh>
      <Text
        position={[-w / 2 + pad + dot + gap, 0, 0.002]} fontSize={size} fontWeight={600} color="#f8fafc" anchorX="left" anchorY="middle" raycast={noRay}
        onSync={(mesh) => {
          const box = mesh.textRenderInfo?.blockBounds;
          if (box) setWide(box[2] - box[0]);
        }}
      >
        {label}
      </Text>
    </group>
  );
}

const STRIP_W = SCREEN_W - 0.16;
const STRIP_H = 0.135;
const STRIP_Y = -SCREEN_H / 2 + 0.115;
const STRIP_LIFT = 0.1; // how far the screen's text moves up to leave it room

const warningShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.05);
  s.lineTo(0.052, -0.04);
  s.quadraticCurveTo(0.056, -0.05, 0.046, -0.05);
  s.lineTo(-0.046, -0.05);
  s.quadraticCurveTo(-0.056, -0.05, -0.052, -0.04);
  s.closePath();
  return s;
})();

/**
 * A teardown's safety warning along the bottom of the screen: an icon and bold dark words on steady
 * amber (10:1), with a glow round it that breathes slowly, far from anything like a flash. Just the
 * glow moves, and it holds still when the student's system asks for less motion.
 */
function SafetyStrip({ text }) {
  const glow = useRef();
  const still = useMemo(() => calm(), []);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.material.opacity = still ? 0.3 : 0.14 + 0.32 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4));
  });
  return (
    <group position={[0, STRIP_Y, 0.004]}>
      <mesh ref={glow} geometry={pillGeometry(STRIP_W + 0.04, STRIP_H + 0.04, 0.036)} raycast={noRay}>
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} toneMapped={false} />
      </mesh>
      <mesh geometry={pillGeometry(STRIP_W, STRIP_H, 0.026)} position={[0, 0, 0.001]} raycast={noRay}>
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>
      <group position={[-STRIP_W / 2 + 0.068, 0, 0.002]}>
        <mesh raycast={noRay}>
          <shapeGeometry args={[warningShape]} />
          <meshBasicMaterial color="#111827" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.006, 0.001]} raycast={noRay}>
          <planeGeometry args={[0.011, 0.038]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.031, 0.001]} raycast={noRay}>
          <planeGeometry args={[0.011, 0.011]} />
          <meshBasicMaterial color="#fbbf24" toneMapped={false} />
        </mesh>
      </group>
      <Text
        position={[-STRIP_W / 2 + 0.135, 0, 0.002]} fontSize={0.0425} fontWeight={700} color="#111827" maxWidth={STRIP_W - 0.17}
        anchorX="left" anchorY="middle" lineHeight={1.15} raycast={noRay}
      >
        {text}
      </Text>
    </group>
  );
}

function ScreenContent({ monitor, userName }) {
  const { status } = monitor;
  const L = -SCREEN_W / 2 + 0.14;
  const bg = BG[status] ?? "#0a1620";
  const badge = screenStatus(monitor);
  return (
    <group>
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshBasicMaterial color={bg} toneMapped={false} />
      </mesh>

      {status === "off" && <ScreenText y={0} size={0.07} color="#94a3b8">Powered off</ScreenText>}

      {status === "shuttingDown" && <ScreenText y={0} size={0.1} color="#b8c4d2">Shutting down…</ScreenText>}

      {(status === "booting" || status === "loading") && (
        <>
          <Spinner />
          <ScreenText y={-0.12} size={0.06}>{status === "booting" ? "Starting up…" : "Working on it…"}</ScreenText>
        </>
      )}

      {status === "hello" && (
        <group position={[0, monitor.safety ? STRIP_LIFT : 0, 0]}>
          <ScreenStack
            lines={[
              { text: `${greetingFor()}, ${userName}`, size: 0.15, fit: true },
              { text: monitor.seconds ? `Your PC started in ${monitor.seconds} s.` : "Your PC is up and running.", size: 0.055, color: "#b8c4d2", gap: 0.03 },
              monitor.note && { text: monitor.note, size: 0.045, color: "#e8a33d", gap: 0.06 },
              // what you'd notice on the case (lab/Wires.js): three at most, then how many more
              monitor.symptoms?.length > 0 && { text: "Check the case:", size: 0.036, color: "#94a3b8", gap: 0.06 },
              ...(monitor.symptoms ?? []).slice(0, 3).map((s) => ({ text: s.text, size: 0.034, color: "#fbbf24", gap: 0.012 })),
              monitor.symptoms?.length > 3 && { text: `and ${monitor.symptoms.length - 3} more`, size: 0.03, color: "#94a3b8", gap: 0.012 },
            ]}
          />
        </group>
      )}
      {status === "hello" && monitor.safety && <SafetyStrip text={monitor.safety} />}

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

      {badge && <StatusBadge key={badge.label} level={badge.level} label={badge.label} big={!!monitor.lowRes} />}
      <ScreenFade status={status} color={bg} />
    </group>
  );
}

export default function MonitorStation({ monitor, userName }) {
  const output = monitor.status === "nosignal"
    ? { text: "No graphics output", dot: STATUS_COLOR.bad }
    : monitor.lowRes
    ? { text: "Built-in graphics", dot: PART_DOT.cpu }
    : { text: "Graphics card", dot: PART_DOT.gpu };
  return (
    <group position={STATION.position} rotation={[0, STATION.rotationY, 0]} scale={MONITOR_SCALE}>
      <ScreenSurface lowRes={!!monitor.lowRes}>
        <ScreenContent monitor={monitor} userName={userName} />
      </ScreenSurface>
      {/* what's drawing the picture: at the screen's corner, where the case in front doesn't hide it */}
      <PillLabel key={output.text} text={output.text} dot={output.dot} size={0.04} billboard={false} position={[-SCREEN_W / 2, -SCREEN_H / 2 - 0.052, 0.002]} />
    </group>
  );
}
