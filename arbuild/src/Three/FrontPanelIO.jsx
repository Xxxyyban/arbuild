// The case's front panel buttons and ports. The case model has none, so they're built here with plain
// three.js and set on the flat strip of its top in front of the top mesh, where a Meshify C has them
// (lab/CableRoutes.js FRONT_IO_PANEL). From the glass side: the power button with its light ring, the
// reset button, the drive light, two USB 3.0 ports, and the headphone and microphone jacks. Nothing
// stands higher than the case's top, so the case measures the same with them (Constants measureLocalBox).
//   powered   the power light on, the drive light flickering
//   onPower   a press of the power button; the buttons and ports take clicks only when it's given
//   onReset   a press of the reset button
//   onSelect  a click on the ports
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MM } from "./cableStubs";
import { renderSettings } from "./graphics";
import { FRONT_IO_PANEL } from "../lab/CableRoutes";

// The layout, in mm from the panel's middle: x toward the case front, z toward the glass, y up off the top.
const POWER = { z: 34, r: 7.5 };
const RESET = { z: 21, r: 2.6 };
const DRIVE_LED = { z: 15.5, r: 1.1 };
const USB = [4, -12]; // the two ports' middles: each 13.5 mm across the case and 6.2 mm deep
const JACKS = [-27, -37]; // headphones, microphone
const PLATE = [17, 89]; // the panel's face: deep, across
const PRESS = { power: 0.5, reset: 0.35 }; // how far each button goes down, mm
const PRESS_TIME = 0.22; // s, down and back up
const BURST = 1.4; // s the drive light keeps flashing after a reset

const LED_OFF = new THREE.Color("#262c35");
const POWER_LIT = new THREE.Color("#c7ecff");
const DRIVE_LIT = new THREE.Color("#ffd27a");

const mats = {
  plate: new THREE.MeshStandardMaterial({ color: "#101318", roughness: 0.32, metalness: 0.15 }),
  bezel: new THREE.MeshStandardMaterial({ color: "#3a4049", roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide }),
  cap: new THREE.MeshStandardMaterial({ color: "#1d2128", roughness: 0.38, metalness: 0.7 }),
  icon: new THREE.MeshBasicMaterial({ color: "#9aa5b4" }),
  shell: new THREE.MeshStandardMaterial({ color: "#c3cad3", roughness: 0.25, metalness: 0.9 }),
  hole: new THREE.MeshBasicMaterial({ color: "#030405" }),
  tongue: new THREE.MeshStandardMaterial({ color: "#1d4ed8", roughness: 0.55 }), // USB 3.0's blue
  contact: new THREE.MeshStandardMaterial({ color: "#5b636e", roughness: 0.35, metalness: 0.8 }),
};

function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const [x0, y0, x1, y1] = [-w / 2, -h / 2, w / 2, h / 2];
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// a ring standing on the top, open in the middle: the button sinks into it when pressed
const bezel = (inner, outer, height, seg) =>
  new THREE.LatheGeometry([new THREE.Vector2(inner, 0), new THREE.Vector2(inner, height), new THREE.Vector2(outer, height), new THREE.Vector2(outer, 0)], seg);

// Every instance shares these: built once, for this device's graphics (fewer segments on lite).
let built = null;
function geometries() {
  if (built) return built;
  const seg = renderSettings().lite ? 20 : 36;
  // three's flat shapes lie in their x-y plane: laid on the top, x stays x and their y goes to -z
  const flat = (g, y) => g.rotateX(-Math.PI / 2).translate(0, y, 0);
  const shell = roundRect(6.2, 13.5, 0.7);
  shell.holes.push(roundRect(4.9, 12.2, 0.35));
  const gap = 1.2; // the power symbol's break, toward the back of the case: its top, seen from the front
  built = {
    plate: flat(new THREE.ShapeGeometry(roundRect(PLATE[0], PLATE[1], 2.5), 6), 0.15),
    powerBezel: bezel(6.2, POWER.r, 0.6, seg),
    powerRing: flat(new THREE.RingGeometry(6.35, 7.1, seg), 0.7),
    powerCap: new THREE.CylinderGeometry(6.1, 6.1, 0.65, seg).translate(0, 0.575, 0), // its top 0.9 mm up
    iconArc: flat(new THREE.RingGeometry(2.0, 2.65, seg, 1, Math.PI + gap / 2, 2 * Math.PI - gap), 0.98),
    iconBar: flat(new THREE.PlaneGeometry(2.7, 0.65), 0.98).translate(-1.65, 0, 0),
    powerHit: new THREE.CylinderGeometry(9.5, 9.5, 4, 12).translate(0, 1.5, 0),
    resetBezel: bezel(1.95, RESET.r, 0.35, seg),
    resetCap: new THREE.CylinderGeometry(1.85, 1.85, 0.45, seg).translate(0, 0.425, 0), // its top 0.65 mm up
    resetHit: new THREE.CylinderGeometry(4.5, 4.5, 4, 10).translate(0, 1.5, 0),
    ledRim: flat(new THREE.RingGeometry(DRIVE_LED.r, DRIVE_LED.r + 0.45, seg), 0.3),
    led: flat(new THREE.CircleGeometry(DRIVE_LED.r, seg), 0.4),
    usbHole: flat(new THREE.PlaneGeometry(4.9, 12.2), 0.25),
    usbTongue: flat(new THREE.PlaneGeometry(1.8, 10.8), 0.35).translate(-0.95, 0, 0),
    usbShell: flat(new THREE.ShapeGeometry(shell, 4), 0.45),
    jackHole: flat(new THREE.CircleGeometry(2.05, seg), 0.25),
    jackContact: flat(new THREE.RingGeometry(0.8, 1.15, seg), 0.35),
    jackRing: flat(new THREE.RingGeometry(2.05, 3.3, seg), 0.45),
  };
  return built;
}

export default function FrontPanelIO({ powered = false, onPower, onReset, onSelect }) {
  const g = geometries();
  const led = useMemo(() => ({ power: new THREE.MeshBasicMaterial({ color: LED_OFF }), drive: new THREE.MeshBasicMaterial({ color: LED_OFF }) }), []);
  useEffect(() => () => Object.values(led).forEach((m) => m.dispose()), [led]);
  const powerCap = useRef();
  const resetCap = useRef();
  const pressed = useRef({ power: -Infinity, reset: -Infinity }); // when each was last pressed, s
  const live = !!onPower;

  useFrame((_, dt) => {
    const t = performance.now() / 1000;
    const p = pressed.current;
    const down = (which) => {
      const s = t - p[which];
      return s > PRESS_TIME ? 0 : PRESS[which] * Math.sin((Math.PI * s) / PRESS_TIME);
    };
    if (powerCap.current) powerCap.current.position.y = -down("power");
    if (resetCap.current) resetCap.current.position.y = -down("reset");
    led.power.color.lerp(powered ? POWER_LIT : LED_OFF, 1 - Math.exp(-dt * 14)); // about 0.2 s, however fast the frames come
    // the drive light: the odd read and write while it's on, a burst while it starts again after a reset
    const busy = powered && (t - p.reset < BURST ? Math.sin(t * 47) > 0 : Math.sin(t * 7.3) + Math.sin(t * 17.9) + Math.sin(t * 2.1) > 1.7);
    led.drive.color.copy(busy ? DRIVE_LIT : LED_OFF);
  });

  // a press: the button goes down and back up, then its action (also from an AR tap, without an event)
  const press = (which, then) => (e) => {
    e?.stopPropagation();
    pressed.current[which] = performance.now() / 1000;
    then?.();
  };
  const select = (e) => {
    e?.stopPropagation();
    onSelect?.();
  };
  const handlers = (fn) =>
    live
      ? {
          onClick: fn,
          userData: { press: fn },
          onPointerOver: (e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          },
          onPointerOut: () => {
            document.body.style.cursor = "";
          },
        }
      : {};

  return (
    <group position={FRONT_IO_PANEL} scale={MM}>
      {/* the panel, the ports and the drive light */}
      <group {...handlers(select)}>
        <mesh geometry={g.plate} material={mats.plate} />
        {USB.map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh geometry={g.usbHole} material={mats.hole} />
            <mesh geometry={g.usbTongue} material={mats.tongue} />
            <mesh geometry={g.usbShell} material={mats.shell} />
          </group>
        ))}
        {JACKS.map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh geometry={g.jackHole} material={mats.hole} />
            <mesh geometry={g.jackContact} material={mats.contact} />
            <mesh geometry={g.jackRing} material={mats.bezel} />
          </group>
        ))}
        <group position={[0, 0, DRIVE_LED.z]}>
          <mesh geometry={g.ledRim} material={mats.bezel} />
          <mesh geometry={g.led} material={led.drive} />
        </group>
      </group>

      {/* the power button, its light ring round it */}
      <group position={[0, 0, POWER.z]} {...handlers(press("power", onPower))}>
        <mesh geometry={g.powerBezel} material={mats.bezel} />
        <mesh geometry={g.powerRing} material={led.power} />
        <group ref={powerCap}>
          <mesh geometry={g.powerCap} material={mats.cap} />
          <mesh geometry={g.iconArc} material={mats.icon} />
          <mesh geometry={g.iconBar} material={mats.icon} />
        </group>
        {/* a button is small: an easier thing to hit */}
        {live && <mesh geometry={g.powerHit} visible={false} />}
      </group>

      <group position={[0, 0, RESET.z]} {...handlers(press("reset", onReset))}>
        <mesh geometry={g.resetBezel} material={mats.bezel} />
        <group ref={resetCap}>
          <mesh geometry={g.resetCap} material={mats.cap} />
        </group>
        {live && <mesh geometry={g.resetHit} visible={false} />}
      </group>
    </group>
  );
}
