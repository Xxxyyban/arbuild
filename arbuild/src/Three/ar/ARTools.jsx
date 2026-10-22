import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// WebXR (markerless AR). Works with plain react-three-fiber, no extra package.
// Needs Chrome on Android + HTTPS. iOS Safari has no WebXR, so it uses the
// camera + gyroscope mode (CamAR) at the bottom of this file instead.
// ---------------------------------------------------------------------------

export function useARSupport() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    if (navigator.xr?.isSessionSupported) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((v) => alive && setOk(!!v))
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  return ok;
}

// Must be called straight from a tap/click handler.
// "anchors" is optional: when the device supports it the placed rig is pinned
// to the real surface, so it does not drift while you walk around.
export async function startARSession(gl, overlayEl) {
  gl.xr.setReferenceSpaceType("local");
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay", "anchors"],
    domOverlay: { root: overlayEl }, // our buttons/labels stay visible in AR
  });
  await gl.xr.setSession(session);
  return session;
}

export function GLBridge({ glRef }) {
  const gl = useThree((s) => s.gl);
  glRef.current = gl;
  return null;
}

// Finds flat surfaces, shows a ring on them, and:
//  - before placing: a tap places the rig on the ring
//  - after placing:  a tap sends a ray into the scene (onRay) to pick parts
// After placing it also creates an XR anchor and keeps the placement glued to it.
export function ARHitTest({ active, placed, onPlace, onRay }) {
  const { gl } = useThree();
  const reticle = useRef();
  const sourceRef = useRef(null);
  const hit = useRef({ ok: false, m: new THREE.Matrix4(), result: null });
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const cb = useRef({ onPlace, onRay });
  cb.current = { onPlace, onRay };
  const geo = useMemo(() => new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2), []);

  // anchor state: the XRAnchor, the placement object we keep updating, and the
  // pose the anchor had the first time we saw it (so we only apply the change)
  const anchorRef = useRef(null);
  const tmp = useMemo(
    () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3() }),
    []
  );
  const yawOf = (q, v) => {
    v.set(1, 0, 0).applyQuaternion(q);
    return Math.atan2(-v.z, v.x);
  };

  // forget the anchor when the user taps "Move" or AR ends
  useEffect(() => {
    if (!placed || !active) {
      anchorRef.current?.anchor?.delete?.();
      anchorRef.current = null;
    }
  }, [placed, active]);

  useEffect(() => {
    if (!active) return;
    const session = gl.xr.getSession();
    if (!session) return;
    let dead = false;

    session
      .requestReferenceSpace("viewer")
      .then((vs) => session.requestHitTestSource({ space: vs }))
      .then((src) => {
        if (dead) src.cancel();
        else sourceRef.current = src;
      })
      .catch(() => {});

    const onSelect = (e) => {
      if (!placedRef.current) {
        if (!hit.current.ok) return;
        const pos = new THREE.Vector3().setFromMatrixPosition(hit.current.m);
        const cam = new THREE.Vector3().setFromMatrixPosition(gl.xr.getCamera().matrixWorld);
        // yaw so the open side of the case faces the viewer
        const placement = { pos, yaw: Math.atan2(cam.x - pos.x, cam.z - pos.z) };
        cb.current.onPlace(placement);

        // pin it to the real surface
        const result = hit.current.result;
        if (result?.createAnchor) {
          result
            .createAnchor()
            .then((anchor) => {
              if (dead) return anchor.delete?.();
              anchorRef.current = { anchor, placement, base: null };
            })
            .catch(() => {}); // no anchor support: placement just stays fixed
        }
        return;
      }
      const pose = e.frame.getPose(e.inputSource.targetRaySpace, gl.xr.getReferenceSpace());
      if (!pose) return;
      const t = pose.transform;
      const origin = new THREE.Vector3(t.position.x, t.position.y, t.position.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)
      );
      cb.current.onRay(origin, dir);
    };
    session.addEventListener("select", onSelect);

    return () => {
      dead = true;
      session.removeEventListener("select", onSelect);
      sourceRef.current?.cancel();
      sourceRef.current = null;
      anchorRef.current?.anchor?.delete?.();
      anchorRef.current = null;
    };
  }, [active, gl]);

  useFrame((_, __, frame) => {
    // keep the placed rig glued to its anchor (ARRoot reads placement every frame)
    const A = anchorRef.current;
    if (A && frame && placedRef.current && frame.trackedAnchors?.has(A.anchor)) {
      const pose = frame.getPose(A.anchor.anchorSpace, gl.xr.getReferenceSpace());
      if (pose) {
        const t = pose.transform;
        tmp.p.set(t.position.x, t.position.y, t.position.z);
        tmp.q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
        const yaw = yawOf(tmp.q, tmp.v);
        if (!A.base) {
          A.base = { p: tmp.p.clone(), yaw, pos0: A.placement.pos.clone(), yaw0: A.placement.yaw };
        } else {
          A.placement.pos.copy(A.base.pos0).add(tmp.p).sub(A.base.p);
          A.placement.yaw = A.base.yaw0 + (yaw - A.base.yaw);
        }
      }
    }

    const r = reticle.current;
    if (!r) return;
    if (!frame || !sourceRef.current || placedRef.current) {
      r.visible = false;
      return;
    }
    const results = frame.getHitTestResults(sourceRef.current);
    if (results.length) {
      const pose = results[0].getPose(gl.xr.getReferenceSpace());
      if (pose) {
        hit.current.m.fromArray(pose.transform.matrix);
        hit.current.ok = true;
        hit.current.result = results[0];
        r.matrix.copy(hit.current.m);
        r.visible = true;
        return;
      }
    }
    hit.current.ok = false;
    hit.current.result = null;
    r.visible = false;
  });

  return (
    <mesh ref={reticle} geometry={geo} matrixAutoUpdate={false} visible={false}>
      <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
    </mesh>
  );
}

// Wraps the whole rig. Outside AR it does nothing (identity). In AR it shrinks the
// rig to real-PC size, rests it on the tracked surface, and when `focused` it scales
// the rig up around the motherboard (the AR version of "zoom in").
const UP = new THREE.Vector3(0, 1, 0);
export function ARRoot({ inAR, placement, focused, scaleBase, caseHeight, focusScale, rigCenterY, rigApi, children }) {
  const rootRef = useRef();
  const cur = useRef(null);
  const tmp = useMemo(
    () => ({ q: new THREE.Quaternion(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }),
    []
  );

  useFrame((_, dt) => {
    const root = rootRef.current;
    if (!root) return;
    if (!inAR) {
      root.visible = true;
      root.position.set(0, 0, 0);
      root.quaternion.identity();
      root.scale.setScalar(1);
      cur.current = null;
      return;
    }
    if (!placement) {
      root.visible = false;
      cur.current = null;
      return;
    }
    root.visible = true;
    const s0 = scaleBase;
    const goal = s0 * (focused ? focusScale : 1);
    cur.current = THREE.MathUtils.lerp(cur.current ?? s0, goal, 1 - Math.exp(-7 * Math.min(dt, 0.05)));
    const s = cur.current;
    const { q, a, b, c } = tmp;
    q.setFromAxisAngle(UP, placement.yaw);

    // position that puts the rig's centre just above the tapped surface point
    a.set(0, rigCenterY, 0).multiplyScalar(s0).applyQuaternion(q);
    b.copy(placement.pos);
    b.y += (caseHeight / 2) * s0;
    b.sub(a);

    // keep the motherboard fixed in the room while the rig grows around it
    const Bl = rigApi.current?.boardInRoot?.(root);
    if (Bl && Math.abs(s - s0) > 1e-5) {
      c.copy(Bl).multiplyScalar(s0).applyQuaternion(q).add(b);
      a.copy(Bl).multiplyScalar(s).applyQuaternion(q);
      b.copy(c).sub(a);
    }
    root.position.copy(b);
    root.quaternion.copy(q);
    root.scale.setScalar(s);
  });

  return <group ref={rootRef}>{children}</group>;
}

// 3D (non-AR) camera: fits the rig to the screen shape (portrait or landscape) and
// glides in on the motherboard when it is focused.
// `disabled` leaves the camera alone (used by the camera + gyroscope mode).
export function CameraDirector({ controlsRef, rigApi, center, fitRadius, focused, disabled }) {
  const { camera, size, gl } = useThree();
  const goal = useRef({ t: new THREE.Vector3(), d: 5, n: null, on: false });

  useEffect(() => {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = size.width / Math.max(1, size.height);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const fit = (r) => r / Math.sin(Math.min(vfov, hfov) / 2);
    const g = goal.current;
    const b = focused ? rigApi.current?.board?.() : null;
    if (b) {
      g.t.copy(b.center);
      g.d = fit(b.radius);
      g.n = b.normal;
    } else {
      g.t.copy(center);
      g.d = fit(fitRadius);
      g.n = null;
    }
    g.on = true;
  }, [focused, fitRadius, size.width, size.height, camera, center, rigApi]);

  useFrame((_, dt) => {
    const c = controlsRef.current;
    const g = goal.current;
    if (!c || !g.on || disabled || gl.xr.isPresenting) return;
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.05));
    const off = camera.position.clone().sub(c.target);
    let dist = off.length();
    const dir = off.normalize();
    if (g.n) dir.lerp(g.n, k).normalize();
    dist += (g.d - dist) * k;
    c.target.lerp(g.t, k);
    camera.position.copy(c.target).addScaledVector(dir, dist);
    if (c.target.distanceTo(g.t) < 0.005 && Math.abs(dist - g.d) < 0.01 && (!g.n || dir.dot(g.n) > 0.999)) {
      g.on = false;
    }
  });
  return null;
}

// Keeps the HTML overlay in step with the 3D scene: moves every [data-anchor] chip
// onto its 3D point and draws the leader line from the active point to the info card.
// Works in AR too, because the overlay is the WebXR DOM-overlay root.
export function OverlayProjector({ overlayRef, rigApi, activeId }) {
  const { gl, camera } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const root = overlayRef.current;
    if (!root) return;
    const xr = gl.xr.isPresenting ? gl.xr.getCamera() : null;
    const cam = xr ? xr.cameras?.[0] || xr : camera;
    const w = root.clientWidth;
    const h = root.clientHeight;
    const api = rigApi.current;

    const toScreen = (id) => {
      const p = api?.anchorWorld?.(id);
      if (!p) return null;
      v.copy(p).project(cam);
      if (v.z > 1 || v.z < -1) return null;
      return [(v.x * 0.5 + 0.5) * w, (1 - (v.y * 0.5 + 0.5)) * h];
    };

    root.querySelectorAll("[data-anchor]").forEach((el) => {
      const xy = toScreen(el.dataset.anchor);
      if (!xy) {
        el.style.visibility = "hidden";
        return;
      }
      el.style.visibility = "visible";
      el.style.transform = `translate(${xy[0]}px, ${xy[1]}px) translate(-50%, -50%)`;
    });

    const line = root.querySelector("[data-leader]");
    const dot = root.querySelector("[data-leader-dot]");
    if (!line || !dot) return;
    const card = root.querySelector("[data-card]");
    const xy = activeId && card ? toScreen(activeId) : null;
    if (!xy) {
      line.style.visibility = "hidden";
      dot.style.visibility = "hidden";
      return;
    }
    const r = card.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    line.setAttribute("x1", xy[0]);
    line.setAttribute("y1", xy[1]);
    line.setAttribute("x2", r.left - rr.left + r.width / 2);
    line.setAttribute("y2", r.top - rr.top);
    dot.setAttribute("cx", xy[0]);
    dot.setAttribute("cy", xy[1]);
    line.style.visibility = "visible";
    dot.style.visibility = "visible";
  });
  return null;
}

// ---------------------------------------------------------------------------
// Camera + gyroscope AR for devices without WebXR (iPhone, desktop).
// ---------------------------------------------------------------------------

// Call this FIRST inside a tap handler (iOS only asks for motion access
// from a user gesture). Resolves true when real sensor data arrives.
export async function requestMotion() {
  const D = window.DeviceOrientationEvent;
  if (!D) return false;
  try {
    if (typeof D.requestPermission === "function") {
      if ((await D.requestPermission()) !== "granted") return false;
    }
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const on = (e) => {
      if (e.alpha == null && e.beta == null) return;
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      window.removeEventListener("deviceorientation", on);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => { cleanup(); resolve(false); }, 1200); // desktops send nothing
    window.addEventListener("deviceorientation", on);
  });
}

const DEG = Math.PI / 180;
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Turns the camera with the phone, and places the rig in front of you.
export function CamAR({ active, placeToken, onPlace, restore }) {
  const { camera } = useThree();
  const sensor = useRef({ a: 0, b: 0, g: 0, got: false });
  const alpha0 = useRef(null);
  const pending = useRef(false);
  const heading = useRef(new THREE.Vector3(0, 0, -1));
  const tmp = useMemo(
    () => ({ e: new THREE.Euler(), q: new THREE.Quaternion(), d: new THREE.Vector3(), p: new THREE.Vector3() }),
    []
  );
  const cb = useRef({ onPlace, restore });
  cb.current = { onPlace, restore };

  useEffect(() => {
    if (!active) return;
    alpha0.current = null;
    sensor.current.got = false;
    const on = (e) => {
      if (e.alpha == null) return;
      Object.assign(sensor.current, { a: e.alpha, b: e.beta, g: e.gamma, got: true });
    };
    window.addEventListener("deviceorientation", on);
    return () => {
      window.removeEventListener("deviceorientation", on);
      cb.current.restore?.(camera);
    };
  }, [active, camera]);

  useEffect(() => { if (active) pending.current = true; }, [active, placeToken]);

  useFrame(() => {
    const s = sensor.current;
    if (!active || !s.got) return;
    if (alpha0.current === null) alpha0.current = s.a;
    const screenAngle = (window.screen.orientation?.angle ?? window.orientation ?? 0) * DEG;
    camera.position.set(0, 0, 0);
    tmp.e.set(s.b * DEG, (s.a - alpha0.current) * DEG, -s.g * DEG, "YXZ");
    camera.quaternion.setFromEuler(tmp.e).multiply(Q_FLIP).multiply(tmp.q.setFromAxisAngle(Z_AXIS, -screenAngle));
    camera.updateMatrixWorld(true);

    if (pending.current) {
      pending.current = false;
      camera.getWorldDirection(tmp.d);
      tmp.d.y = 0;
      if (tmp.d.lengthSq() < 0.05) tmp.d.copy(heading.current); // phone pointing at the floor
      tmp.d.normalize();
      heading.current.copy(tmp.d);
      const pos = tmp.p.copy(tmp.d).multiplyScalar(0.9);
      pos.y = -0.45; // roughly a table below a phone held at chest height
      cb.current.onPlace({ pos: pos.clone(), yaw: Math.atan2(-tmp.d.x, -tmp.d.z) });
    }
  });
  return null;
}