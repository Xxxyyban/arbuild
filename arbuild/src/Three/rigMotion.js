// What moves and lights up in a running PC (components/rig/ShowcaseRig.jsx): a cooler's fan turning
// and the RAM's RGB light bars. Both find their meshes inside a part's model once it has loaded, by
// name, and change only that model's own copies (the lab's models stay as they are).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const tmp = { v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };

/**
 * The meshes named in `rotor` under `root` turn together about the axis of the mesh named `hub`:
 * through its bounding box's centre, along the box's thinnest side (a fan hub or frame is flat across
 * its axis). Null until all of them have loaded. update(angle) turns them to that angle.
 */
export function makeRotor(root, { rotor, hub }) {
  const found = {};
  root.traverse((o) => {
    if (o.isMesh && (rotor.includes(o.name) || o.name === hub)) found[o.name] = o;
  });
  const hubMesh = found[hub];
  if (!hubMesh || rotor.some((n) => !found[n])) return null;

  root.updateWorldMatrix(true, true);
  const g = hubMesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const size = g.boundingBox.getSize(new THREE.Vector3());
  const thin = size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2;
  const centre = g.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(hubMesh.matrixWorld);
  const axis = new THREE.Vector3().setComponent(thin, 1).transformDirection(hubMesh.matrixWorld);

  // each turning mesh: the axis in its parent's frame, and where it started
  const parts = rotor.map((name) => {
    const m = found[name];
    const inv = tmp.m.copy(m.parent.matrixWorld).invert();
    return {
      m,
      pivot: centre.clone().applyMatrix4(inv),
      axis: axis.clone().transformDirection(inv),
      pos0: m.position.clone(),
      q0: m.quaternion.clone(),
    };
  });
  return {
    update(angle) {
      for (const p of parts) {
        tmp.q.setFromAxisAngle(p.axis, angle);
        p.m.position.copy(p.pos0).sub(p.pivot).applyQuaternion(tmp.q).add(p.pivot);
        p.m.quaternion.copy(tmp.q).multiply(p.q0);
      }
    },
  };
}

/**
 * The meshes under `root` whose material's name matches `material` (a RegExp: a RAM stick's light
 * bar and its diffuser) get their own copy of it that glows in a rainbow running along the bar. Null
 * until the model has loaded. set(time, on): on (0 to 1) fades the glow in and out.
 */
export function makeRgb(root, material) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !Array.isArray(o.material) && (o.userData.rgbLit || material.test(o.material.name))) meshes.push(o);
  });
  if (!meshes.length) return null;
  const uniforms = { uTime: { value: 0 }, uOn: { value: 0 } };
  for (const m of meshes) {
    if (m.userData.rgbLit) continue; // already lit (this model's copy)
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const size = g.boundingBox.getSize(new THREE.Vector3());
    const long = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
    const along = new THREE.Vector3().setComponent(long, 1);
    const from = g.boundingBox.min.getComponent(long);
    const length = size.getComponent(long) || 1;
    const mat = m.material.clone();
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms, {
        uAlong: { value: along },
        uFrom: { value: from },
        uLength: { value: length },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vRgbPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRgbPos = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 vRgbPos;
uniform float uTime, uOn, uFrom, uLength;
uniform vec3 uAlong;
vec3 rgbHue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}`
        )
        // lit, the white plastic itself goes dim, or the colour would wash out to white
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.22, uOn);")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
float rgbAt = (dot(vRgbPos, uAlong) - uFrom) / uLength;
totalEmissiveRadiance += rgbHue(fract(rgbAt * 0.9 - uTime * 0.35)) * 1.15 * uOn;`
        );
    };
    mat.customProgramCacheKey = () => "rgb-light-bar";
    m.material = mat;
    m.userData.rgbLit = true;
  }
  return {
    set(time, on) {
      uniforms.uTime.value = time;
      uniforms.uOn.value = on;
    },
  };
}

/**
 * A part's moving and glowing bits while the PC runs. ref: the part's group. rotor: makeRotor's
 * rule ({ rotor, hub }) and turns per second; rgb: the light bar's material names (a RegExp).
 * powered: running.
 */
export function useRigMotion(ref, { rotor = null, turns = 3, rgb = null }, powered) {
  const state = useRef({ rotor: null, rgb: null, angle: 0, speed: 0, glow: 0 });
  // look for the meshes a few times a second until the model is in. Not frame by frame: the view
  // doesn't draw until its shaders are compiled (Three/WarmUp.jsx), and the lit material must be in
  // place by then
  useEffect(() => {
    const s = state.current;
    const timer = setInterval(() => {
      const root = ref.current;
      if (!root) return;
      if (rotor && !s.rotor) s.rotor = makeRotor(root, rotor);
      if (rgb && !s.rgb) s.rgb = makeRgb(root, rgb);
      if ((!rotor || s.rotor) && (!rgb || s.rgb)) clearInterval(timer);
    }, 120);
    return () => clearInterval(timer);
  }, [ref, rotor, rgb]);
  useFrame(({ clock }, dt) => {
    const s = state.current;
    const step = Math.min(dt, 0.05);
    const k = 1 - Math.exp(-step * 1.5);
    s.speed += ((powered ? turns : 0) - s.speed) * k;
    s.glow += ((powered ? 1 : 0) - s.glow) * (1 - Math.exp(-step * 3));
    if (s.rotor && s.speed > 1e-3) {
      s.angle += s.speed * Math.PI * 2 * step;
      s.rotor.update(s.angle);
    }
    s.rgb?.set(clock.elapsedTime, s.glow);
  });
}
