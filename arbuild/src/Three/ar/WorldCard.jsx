import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Info card that lives IN the 3D scene (desktop and AR).
// - It keeps a comfortable size on screen no matter how far you zoom the model,
//   so it stays readable on a phone.
// - It sits beside the part (left or right) and is kept fully on screen.
// - The "+" and "-" buttons on the card make it bigger or smaller.

const W = 1.8;
const H = 1.4;
const CW = W - 0.16;
const X0 = -W / 2 + 0.08;
const C = {
  bg: "#121a2c", edge: "#10b981", text: "#f1f5f9", muted: "#94a3b8",
  good: "#34d399", bad: "#f87171", btn: "#22304d", on: "#10b981", ok: "#15803d", no: "#b91c1c",
};
const TOP = 1000;

// How much of the screen the card may use (before the +/- buttons).
const FILL_H = 0.46;
const FILL_W = 0.62;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;

function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function Box({ w, h, r = 0.04, color, opacity = 1, z = 0, order = TOP }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(roundedShape(w, h, r)), [w, h, r]);
  return (
    <mesh geometry={geo} position={[0, 0, z]} renderOrder={order}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function T({ children, x = 0, y = 0, size = 0.07, color = C.text, ax = "left", ay = "top", maxWidth, z = 0.03 }) {
  return (
    <Text
      position={[x, y, z]} fontSize={size} color={color} anchorX={ax} anchorY={ay}
      maxWidth={maxWidth} lineHeight={1.25} renderOrder={TOP + 3}
      material-depthTest={false} material-depthWrite={false}
    >
      {children}
    </Text>
  );
}

function Btn({ x, y, w, h, label, fill = C.btn, size = 0.056, onTap }) {
  return (
    <group
      position={[x, y, 0]}
      userData={{ onTap }}
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <Box w={w} h={h} r={h / 2} color={fill} z={0.015} order={TOP + 1} />
      <T x={0} y={0} ax="center" ay="middle" size={size}>{label}</T>
    </group>
  );
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function WorldCard({ info, anchorId, rigApi, cardApi, onClose }) {
  const group = useRef();
  const body = useRef();
  const { camera } = useThree();
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const fresh = useRef(true);
  const openAt = useRef(-1);
  const side = useRef(1);
  const v = useMemo(() => ({
    a: new THREE.Vector3(), cam: new THREE.Vector3(), right: new THREE.Vector3(),
    up: new THREE.Vector3(), target: new THREE.Vector3(), ndc: new THREE.Vector3(),
    tn: new THREE.Vector3(), q: new THREE.Quaternion(),
  }), []);

  useEffect(() => {
    setTab(0); setStep(0); setPick(null);
    fresh.current = true;
    openAt.current = -1;
  }, [info.key]);

  // Taps coming from the AR ray go through here first.
  useEffect(() => {
    const ray = new THREE.Raycaster();
    cardApi.current.tap = (origin, dir) => {
      const g = body.current;
      if (!g || !group.current?.visible) return false;
      ray.set(origin, dir.clone().normalize());
      const hits = ray.intersectObject(g, true);
      for (const h of hits) {
        for (let o = h.object; o && o !== g.parent; o = o.parent) {
          if (o.userData?.onTap) { o.userData.onTap(); return true; }
        }
      }
      return hits.length > 0;
    };
    return () => { cardApi.current.tap = null; };
  }, [cardApi]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    const api = rigApi.current;
    if (!g || !api.anchorWorld) return;
    const a = api.anchorWorld(anchorId);
    if (!a) { g.visible = false; return; }
    g.visible = true;
    v.a.copy(a);

    camera.getWorldQuaternion(v.q);
    camera.getWorldPosition(v.cam);
    v.right.set(1, 0, 0).applyQuaternion(v.q);
    v.up.set(0, 1, 0).applyQuaternion(v.q);

    // World size of the visible screen at the part's distance.
    const e = camera.projectionMatrix.elements;
    const d = Math.max(0.1, v.cam.distanceTo(a));
    const visH = e[5] > 0 ? (2 * d) / e[5] : 2;
    const visW = e[0] > 0 ? (2 * d) / e[0] : 2;

    // Constant on-screen size (so zooming the model never makes the text tiny).
    const s = Math.min((FILL_H * visH) / H, (FILL_W * visW) / W) * zoomRef.current;

    // Side with more room: part on the left -> card on the right.
    v.ndc.copy(a).project(camera);
    if (fresh.current || Math.abs(v.ndc.x) > 0.3) side.current = v.ndc.x > 0 ? -1 : 1;

    const rad = api.anchorRadius?.(anchorId) ?? 0.3;
    const off = rad + (W / 2) * s + 0.04 * s;
    v.target.copy(a).addScaledVector(v.right, side.current * off);

    // Keep the whole card on screen (leave room at the bottom for the buttons).
    v.tn.copy(v.target).project(camera);
    const halfW = (W * s) / visW;
    const halfH = (H * s) / visH;
    const maxX = Math.max(0, 1 - halfW - 0.03);
    const cx = clamp(v.tn.x, -maxX, maxX);
    const lowY = -1 + halfH + 0.18;
    const highY = 1 - halfH - 0.03;
    const cy = lowY <= highY ? clamp(v.tn.y, lowY, highY) : 0;
    v.target.addScaledVector(v.right, ((cx - v.tn.x) * visW) / 2);
    v.target.addScaledVector(v.up, ((cy - v.tn.y) * visH) / 2);

    if (fresh.current) { g.position.copy(v.target); fresh.current = false; }
    else g.position.lerp(v.target, 1 - Math.exp(-Math.min(dt, 0.05) * 10));
    g.quaternion.copy(v.q);

    if (openAt.current < 0) openAt.current = clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - openAt.current) / 0.28);
    const pop = 1 - Math.pow(1 - k, 3);
    g.scale.setScalar(Math.max(0.001, s * pop));
  });

  const cur = info.tabs[Math.min(tab, info.tabs.length - 1)];
  const steps = cur.steps || [];
  const s = steps[Math.min(step, steps.length - 1)];
  const tone = s?.tone === "good" ? C.good : s?.tone === "bad" ? C.bad : C.edge;
  const switchTab = (i) => { setTab(i); setStep(0); setPick(null); };
  const FY = -H / 2 + 0.11; // footer row

  return (
    <group ref={group} visible={false}>
      <group ref={body} onClick={(e) => e.stopPropagation()}>
        <Box w={W + 0.03} h={H + 0.03} r={0.08} color={C.edge} z={-0.004} />
        <Box w={W} h={H} r={0.07} color={C.bg} opacity={0.97} />

        <T x={X0} y={H / 2 - 0.07} size={0.05} color={C.edge}>{info.tag}</T>
        <T x={X0} y={H / 2 - 0.15} size={0.09} maxWidth={CW - 0.5}>{info.title}</T>
        <Btn x={W / 2 - 0.1} y={H / 2 - 0.1} w={0.13} h={0.13} label="x" onTap={onClose} />
        <Btn x={W / 2 - 0.25} y={H / 2 - 0.1} w={0.13} h={0.13} label="+" size={0.075} onTap={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.2))} />
        <Btn x={W / 2 - 0.4} y={H / 2 - 0.1} w={0.13} h={0.13} label="-" size={0.075} onTap={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.2))} />

        {info.tabs.map((t, i) => (
          <Btn
            key={t.label}
            x={X0 + 0.19 + i * 0.41} y={H / 2 - 0.46} w={0.38} h={0.13}
            label={t.label} size={0.05} fill={i === tab ? C.on : C.btn}
            onTap={() => switchTab(i)}
          />
        ))}

        {cur.quiz ? (
          <>
            <T x={X0} y={0.12} size={0.072} maxWidth={CW}>{cur.quiz.q}</T>
            {cur.quiz.options.map((o, i) => {
              const done = pick !== null;
              const fill = !done ? C.btn : i === cur.quiz.answer ? C.ok : i === pick ? C.no : C.btn;
              return (
                <Btn
                  key={o}
                  x={0} y={-0.12 - i * 0.16} w={CW} h={0.14} label={o} size={0.056} fill={fill}
                  onTap={() => pick === null && setPick(i)}
                />
              );
            })}
            <T x={X0} y={-0.53} size={0.055} maxWidth={CW - 0.5} color={pick === cur.quiz.answer ? C.good : C.bad}>
              {pick === null ? "Tap an answer" : (pick === cur.quiz.answer ? "Nice! " : "Not quite. ") + cur.quiz.why}
            </T>
            {pick !== null && pick !== cur.quiz.answer && (
              <Btn x={W / 2 - 0.27} y={FY} w={0.42} h={0.13} label="Try again" size={0.052} onTap={() => setPick(null)} />
            )}
          </>
        ) : (
          s && (
            <>
              <T x={X0} y={0.08} size={0.085} color={tone}>{s.head}</T>
              <T x={X0} y={-0.04} size={0.072} maxWidth={CW}>{s.body}</T>
              {s.extra ? <T x={X0} y={-0.37} size={0.06} color={C.muted} maxWidth={CW}>{s.extra}</T> : null}
              {steps.length > 1 && (
                <>
                  <Btn x={X0 + 0.22} y={FY} w={0.4} h={0.13} label="< Back" size={0.052} onTap={() => setStep((step - 1 + steps.length) % steps.length)} />
                  <T x={0} y={FY} ax="center" ay="middle" size={0.058} color={C.muted}>{`${step + 1} / ${steps.length}`}</T>
                  <Btn x={W / 2 - 0.27} y={FY} w={0.42} h={0.13} label="Next >" size={0.052} fill={C.on} onTap={() => setStep((step + 1) % steps.length)} />
                </>
              )}
            </>
          )
        )}
      </group>
    </group>
  );
}