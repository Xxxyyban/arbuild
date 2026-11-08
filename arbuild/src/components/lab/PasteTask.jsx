// Thermal paste by hand: the student squeezes it onto the CPU's lid with the tube, as a dot, lines or
// however they like, and it's scored on the amount and where it ends up (the numbers: lab/Paste.js).
// The tube waits in the parts rail (components/lab/PartPicker.jsx), not on the bench.
//
//   <ThermalPaste>   the paste on a lid (inside the CPU's own frame, with the CPU's model)
//   <PasteStage>     the tube following the pointer, and the paste coming out of it (same frame)
//   <PasteCapture>   a layer over the 3D view: pointers draw on the lid here, in the room in AR as well
//   <PastePanel>     instructions, the amount so far, Undo / Done / Cancel
//   <PasteResult>    how it spreads under the cooler, and its marks
// A newPasteWork() object is what these share while drawing: the drawing runs every frame, without
// re-rendering the lab.
import { useEffect, useMemo, useReducer, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MM } from "../../Three/orient";
import { renderSettings } from "../../Three/graphics";
import { buildPasteSurface, buildSyringe } from "../../Three/thermalPaste";
import {
  AMOUNT_RIGHT, FLOW, TUBE, flow, goodPaste, idealVolume, lidFor, pasteHeightAt, pasteVolume, squeeze,
} from "../../lab/Paste";

export function newPasteWork() {
  return {
    dabs: [],
    undo: [], // the paste as it was before each press
    tip: { i: null }, // the dab being fed
    pressing: false,
    aim: null, // where the pointer is on screen: [clientX, clientY]
    x: null, // where it meets the lid, mm
    y: null,
    missed: false, // pressing, but the tip is off the lid
    dirty: true,
    notify: null, // the panel, to show the new amount
    notified: 0,
  };
}

/** The paste on a CPU's lid. dabs: as drawn (null: a good pea, for a PC that came built). squeezed: the cooler has pressed it flat. work: being drawn now. */
export function ThermalPaste({ variant, dabs = null, squeezed = false, work = null }) {
  const lid = lidFor(variant);
  const surface = useMemo(() => buildPasteSurface(lid, { cell: renderSettings().lite ? 0.75 : 0.5 }), [lid]);
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => {
    if (work) return;
    const paste = dabs ?? goodPaste(lid);
    if (squeezed) surface.drawFilm(squeeze(paste, lid));
    else surface.drawDabs(paste);
  }, [surface, dabs, squeezed, work, lid]);
  useFrame(() => {
    if (!work?.dirty) return;
    work.dirty = false;
    surface.drawDabs(work.dabs);
  });
  return <primitive object={surface.mesh} />;
}

const LEAN = new THREE.Vector3(); // the way the tube leans, in the CPU's frame

/** The tube in the student's hand: its tip follows the pointer over the lid, paste comes out while pressed. Inside the CPU's own frame. */
export function PasteStage({ variant, work }) {
  const lid = lidFor(variant);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const frame = useRef();
  const tube = useMemo(() => buildSyringe(), []);
  useEffect(() => () => tube.userData.dispose(), [tube]);
  const t = useMemo(
    () => ({
      ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), inv: new THREE.Matrix4(), basis: new THREE.Matrix4(),
      o: new THREE.Vector3(), d: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3(),
      side: new THREE.Vector3(), face: new THREE.Vector3(),
    }),
    []
  );
  const raised = useRef(10); // mm between the tip and the lid

  useFrame((_, delta) => {
    const g = frame.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    g.updateWorldMatrix(true, false);
    t.inv.copy(g.matrixWorld).invert();
    const cam = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const top = lid.top * MM;

    // where the pointer's ray meets the plane of the lid
    if (work.aim) {
      const r = gl.domElement.getBoundingClientRect();
      t.ndc.set(((work.aim[0] - r.left) / r.width) * 2 - 1, -((work.aim[1] - r.top) / r.height) * 2 + 1);
      t.ray.setFromCamera(t.ndc, cam);
      t.o.copy(t.ray.ray.origin).applyMatrix4(t.inv);
      t.d.copy(t.ray.ray.direction).transformDirection(t.inv);
      if (t.d.y < -1e-3) {
        const along = (top - t.o.y) / t.d.y;
        work.x = (t.o.x + t.d.x * along) / MM;
        work.y = (t.o.z + t.d.z * along) / MM;
      }
    }
    const x = work.x ?? lid.middle[0] + 13;
    const y = work.y ?? lid.middle[1] - 13;

    if (work.pressing && work.x != null) {
      const landed = flow(work.dabs, work.tip, x, y, FLOW * dt, lid);
      if (landed) work.dirty = true;
      work.missed = !landed;
      const now = performance.now();
      if (now - work.notified > 90) {
        work.notified = now;
        work.notify?.();
      }
    }

    // the tube: tip just over the paste, barrel leaning up and to the right on screen, label to the viewer
    const want = pasteHeightAt(work.dabs, x, y) + (work.pressing ? 0.3 : 2.5);
    raised.current += (want - raised.current) * (1 - Math.exp(-dt * 22));
    tube.position.set(x * MM, top + raised.current * MM, y * MM);
    t.right.setFromMatrixColumn(cam.matrixWorld, 0).transformDirection(t.inv);
    t.up.setFromMatrixColumn(cam.matrixWorld, 1).transformDirection(t.inv);
    t.back.setFromMatrixColumn(cam.matrixWorld, 2).transformDirection(t.inv);
    LEAN.set(0, 0.5, 0).addScaledVector(t.right, 0.72).addScaledVector(t.up, 0.6).normalize();
    t.face.copy(t.back).addScaledVector(LEAN, -t.back.dot(LEAN)).normalize();
    t.side.crossVectors(LEAN, t.face);
    tube.quaternion.setFromRotationMatrix(t.basis.makeBasis(t.side, LEAN, t.face));
    tube.userData.setFill(1 - pasteVolume(work.dabs) / TUBE);
  });

  return (
    <group ref={frame}>
      <primitive object={tube} />
    </group>
  );
}

const TOUCH_LIFT = 48; // px: on a touch screen the tip is above the finger, so the finger doesn't hide it

/**
 * Over the 3D view while the paste goes on, so nothing behind it reacts. work: draws on the lid (null:
 * only stops clicks, while its marks are up). onZoom(factor): the wheel still zooms.
 */
export function PasteCapture({ work = null, onZoom }) {
  const ref = useRef();
  const held = useRef(null); // the pointer that's pressing

  useEffect(() => {
    const el = ref.current;
    if (!el || !onZoom) return undefined;
    const wheel = (e) => {
      e.preventDefault();
      onZoom(e.deltaY < 0 ? 0.9 : 1 / 0.9);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [onZoom]);

  // don't leave a press running if this goes away mid-stroke
  useEffect(
    () => () => {
      if (!work) return;
      work.pressing = false;
      work.aim = null;
    },
    [work]
  );

  const aim = (e) => {
    work.aim = [e.clientX, e.clientY - (e.pointerType === "touch" ? TOUCH_LIFT : 0)];
  };
  const release = (e) => {
    if (held.current !== e.pointerId) return;
    held.current = null;
    work.pressing = false;
    work.missed = false;
    // a press that left no paste isn't a step to undo
    const before = work.undo[work.undo.length - 1];
    if (before && pasteVolume(before) === pasteVolume(work.dabs)) work.undo.pop();
    work.notify?.();
  };
  if (!work) return <div ref={ref} className="paste-capture is-still" style={{ pointerEvents: "auto", touchAction: "none" }} />;
  return (
    <div
      ref={ref}
      className="paste-capture"
      style={{ pointerEvents: "auto", touchAction: "none" }}
      onPointerDown={(e) => {
        if (held.current != null || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        held.current = e.pointerId;
        aim(e);
        work.undo.push(work.dabs.map((d) => ({ ...d })));
        work.tip = { i: null };
        work.pressing = true;
      }}
      onPointerMove={(e) => {
        if (held.current == null || held.current === e.pointerId) aim(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    />
  );
}

/** The amount so far against the right amount (with hints on), and the buttons. */
export function PastePanel({ work, variant, hints, arLike, onDone, onCancel }) {
  const lid = lidFor(variant);
  const [, refresh] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    work.notify = refresh;
    return () => {
      work.notify = null;
    };
  }, [work]);

  const volume = pasteVolume(work.dabs);
  const full = idealVolume(lid) * 2; // the gauge's far end
  const pct = (v) => Math.min(100, (v / full) * 100);
  const [lo, hi] = AMOUNT_RIGHT.map((k) => pct(idealVolume(lid) * k));
  const where = pct(volume) < lo ? "is-low" : pct(volume) <= hi ? "is-right" : "is-high";
  const undo = () => {
    work.dabs = work.undo.pop() ?? [];
    work.tip = { i: null };
    work.dirty = true;
    refresh();
  };

  return (
    <section className={`cable-task paste-task ${arLike ? "is-ar" : ""}`} style={{ pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="cable-task__step">Thermal paste · {lid.name} CPU</span>
      <p>
        {arLike ? "Touch" : "Press"} and hold on the CPU to squeeze paste out. Hold still for a dot, or drag to draw a line.
        {hints ? " Stop in the green." : " Judge the amount by eye."}
        {work.missed && " Keep the tip over the CPU's lid."}
      </p>
      {hints && (
        <div className="paste-gauge">
          <div
            className="paste-gauge__bar"
            role="meter"
            aria-label="Paste so far"
            aria-valuemin={0}
            aria-valuemax={Math.round(full)}
            aria-valuenow={Math.round(Math.min(full, volume))}
          >
            <i className="paste-gauge__right" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
            <i className={`paste-gauge__fill ${where}`} style={{ width: `${pct(volume)}%` }} />
          </div>
          <div className="paste-gauge__marks">
            <span>Too little</span>
            <span>Right</span>
            <span>Too much</span>
          </div>
          <small>{Math.round(volume)} mm³ of paste</small>
        </div>
      )}
      <div className="cable-task__actions">
        <button type="button" className="is-primary" disabled={volume <= 0} onClick={onDone}>Done</button>
        <button type="button" disabled={!work.undo.length} onClick={undo}>Undo</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

/** The lid from above, with the paste as the cooler would press it, and what's squeezed over the edge. */
function SpreadMap({ spread, lid }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const g = spread.size;
    const px = canvas.width / g;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let j = 0; j < g; j += 1) {
      for (let i = 0; i < g; i += 1) {
        const c = j * g + i;
        const x = i * px;
        const y = j * px;
        if (spread.onCell[c]) {
          ctx.fillStyle = "#475569";
          ctx.fillRect(x, y, px + 0.5, px + 0.5);
          const wet = Math.min(1, spread.film[c] / spread.cap);
          if (wet > 0.02) {
            ctx.fillStyle = `rgba(226, 232, 240, ${wet})`;
            ctx.fillRect(x, y, px + 0.5, px + 0.5);
          }
        } else if (spread.ooze[c] > 0.02) {
          ctx.fillStyle = `rgba(251, 146, 60, ${Math.min(1, 0.45 + spread.ooze[c])})`;
          ctx.fillRect(x, y, px + 0.5, px + 0.5);
        }
      }
    }
    // the area over the chips
    const H = 12;
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect((lid.middle[0] - H + g / 2) * px, (lid.middle[1] - H + g / 2) * px, 2 * H * px, 2 * H * px);
  }, [spread, lid]);
  return <canvas ref={ref} width={138} height={138} className="paste-result__map" role="img" aria-label="How the paste spreads over the CPU's lid under the cooler" />;
}

const percent = (v) => `${Math.round(v * 100)}%`;

/**
 * After Done. grade: lab/Paste.js gradePaste. hints off: only the mark, not what's wrong with it.
 * score: whether to give a mark at all (troubleshooting scores the faults, not this). redone: how many
 * times it was wiped and done again, each of which costs points.
 */
export function PasteResult({ grade, variant, hints, arLike, score, redone, onKeep, onRedo }) {
  const lid = lidFor(variant);
  return (
    <section className={`cable-task paste-task paste-result ${arLike ? "is-ar" : ""}`} aria-live="polite" style={{ pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
      <span className="cable-task__step">Thermal paste{hints ? " · under the cooler" : ""}</span>
      {score && (
        <h3 className="paste-result__mark">
          {grade.grade} <span>{grade.score}/100</span>
        </h3>
      )}
      {hints ? (
        <>
          <div className="paste-result__body">
            <SpreadMap spread={grade.spread} lid={lid} />
            <dl className="paste-result__facts">
              <div><dt>Amount</dt><dd>{grade.word} ({Math.round(grade.volume)} mm³)</dd></div>
              <div><dt>Over the chips</dt><dd>{percent(grade.hot)} covered</dd></div>
              <div><dt>Squeezed out</dt><dd>{grade.spillShare < 0.02 ? "none" : percent(grade.spillShare)}</dd></div>
            </dl>
          </div>
          <p>{grade.advice}</p>
        </>
      ) : (
        <p>The paste is on. Keep it and mount the cooler, or wipe it off and try again.</p>
      )}
      {score && redone > 0 && <small className="paste-result__note">Wiped and redone {redone === 1 ? "once" : `${redone} times`}: each costs some of the points.</small>}
      <div className="cable-task__actions">
        <button type="button" className="is-primary" onClick={onKeep}>Keep it</button>
        <button type="button" onClick={onRedo}>Wipe and redo</button>
      </div>
    </section>
  );
}
