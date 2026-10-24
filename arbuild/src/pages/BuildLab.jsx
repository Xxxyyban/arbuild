import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { useAuth } from "../context/AuthContext";
import PartModel, { BOARD_MOUNTS, PSU_PANELS, PSU_FIXED } from "../Three/PartModel";
import { CablePlug, CableRun, PortMarker, LatchTab, BoardScrew, PSUPanel, FixedCables, PLUG_REACH } from "../Three/Hardware";
import CableDrawer from "../components/lab/CableDrawer";
import DraggablePart from "../Three/DraggablePart";
import PullablePart from "../Three/PullablePart";
import { ARContext } from "../Three/xrSetup";
import { GLBridge, ARHitTest, ARRoot, CamAR, useARSupport, startARSession, requestMotion } from "../Three/ar/ARTools";
import { useARGestures, GestureGroup } from "../Three/ar/ARGestures";
import {
  CaseWithMeasure, CaseRig, CaseFans, Workbench, TrayLabel, BenchLoadingFallback, CameraFocus,
  ThermalPaste, TrayModel, TargetMarker, Blast, Flyer,
} from "../components/lab/BenchScene";
import MonitorStation from "../components/lab/MonitorStation";
import StartScreen from "../components/lab/StartScreen";
import PartPicker from "../components/lab/PartPicker";
import PartInfoPanel from "../components/lab/PartInfoPanel";
import {
  ALL_PARTS, PART_LABEL, trayPosition, toWorldPose, moboLocalToWorld,
  MOTHERBOARD_TARGET, PSU_TARGET, GPU_TARGET, MOBO_LYING_ROTATION, MOBO_MOUNTED_ROTATION,
  boardLayout, STORAGE_MOUNT_ROTATION,
  COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z,
  LAY_ANGLE, LAY_CENTER, AR_SCALE, HOME_CAM, HOME_TARGET,
} from "../lab/Constants";
import {
  installBlock, removeBlock, evaluateBoot, isFullyBuilt, isFullyStripped, expertSteps,
  CABLES, SCREW_COUNT, plugBlock, safetyBlock, psuModular, psuEndDone, psuPlugBlock, psuCableFixed, psuSocketed,
} from "../lab/Rules";
import {
  POINTS, basePoints, actionPoints, ledgerKey, timedScore, timeFactor, revertPenalty,
  maxPoints, officialScore, officialDelta, taskRequirements, taskLedger, OFFICIAL_MAX,
} from "../lab/Scoring";
import { DEFAULT_SETUP, normalizeSetup, buildStart, setupFromUrl } from "../lab/Setup";
import { createReporter, MISTAKE_TYPES } from "../lab/reportEvent";
import { CATALOG, PLATFORM_LABEL, itemFor, fitBlock, buildSlots, correctPicks } from "../lab/Catalog";
import { studentSetup, formatClock } from "../lab/Sessions";
import { useLabSession } from "../lab/useLabSession";
import "../styles/BuildLab.css";
import "../styles/BuildLabParts.css";
import "../styles/BuildLabTask.css";

const OVERHEAT = { helloMs: 5000, loadMinMs: 3000, loadMaxMs: 5000, bsodMs: 3000, blastMs: 2200, explodeAfterBsod: true };
const SHUTDOWN_DURATION = 1800;
const SAFETY_NOTE = "Shut it down, unplug it and drain it before touching any part.";
const HINT_HIDDEN = "That didn't work. Think about what is missing.";
// After an explosion: everything back on the bench, the picked parts stay picked.
const NO_CABLES = { atx24: false, eps8: false, pcie: false }; // also the PSU ends (psuCables)
const NO_SCREWS = Array.from({ length: SCREW_COUNT }, () => false);
const EMPTY_BUILD = {
  mode: "assemble", installed: {}, pasteApplied: false, ramSlot: { ram1: null, ram2: null },
  cables: NO_CABLES, psuCables: NO_CABLES, screws: NO_SCREWS,
};
// A part on the board: undoes the board's stretch so the part keeps its real proportions.
function TrueSize({ unstretch, rotation, children }) {
  return (
    <group scale={unstretch}>
      <group rotation={rotation}>{children}</group>
    </group>
  );
}

const HEADER_HEIGHT = 0.045; // a power header stands about 9 mm off the board

// Cables, case space. Every plug goes in along -Z (into the board or card); its wires leave along +Z.
const CABLE_IDS = ["atx24", "eps8", "pcie"];
const STUB_TYPE = { atx24: "atx24", eps8: "eps8", pcie: "pcie8" };
const PORT_ROT = { atx24: [Math.PI / 2, Math.PI / 2, 0], eps8: [Math.PI / 2, 0, 0], pcie: [Math.PI / 2, 0, 0] };
const PORT_LATCH = { atx24: [1, 0, 0], eps8: [0, -1, 0], pcie: [0, -1, 0] }; // which side the clip hooks over
const GHOST_COLOR = { atx24: "#f2a33a", eps8: "#f2d24a", pcie: "#f2d24a" }; // see-through guide wires
const PORT_LABEL = { atx24: "24-pin header", eps8: "8-pin CPU header", pcie: "GPU power socket" };
// a fixed PSU's cables: the marking on each plug, and how to tell them apart
const FIXED_MARK = { atx24: "MB 24-pin", eps8: "CPU 4+4", pcie: "PCI-E 6+2" };
const PLUG_LOOK = {
  atx24: "widest plug, 24 pins in 2 rows of 12",
  eps8: "8-pin plug marked CPU, which splits 4 + 4",
  pcie: "8-pin plug marked PCI-E, which splits 6 + 2",
};
const PORT_WHERE = {
  atx24: "the long 24-pin header on the right edge of the board",
  eps8: "the 8-pin header at the top-left, next to the CPU",
  pcie: "the power socket on the top edge of the graphics card",
};
const PSU_FIXED_OUT = [-0.3, 0.3, 0.1]; // where a non-modular PSU's cables come out (case space)
const PSU_ROT = new THREE.Euler(...PSU_TARGET.rotation);
/** A point in the PSU's own frame, in case space (the PSU sits at PSU_TARGET when installed). */
const psuToCase = ([x, y, z]) => {
  const v = new THREE.Vector3(x, y, z).applyEuler(PSU_ROT);
  return [PSU_TARGET.position[0] + v.x, PSU_TARGET.position[1] + v.y, PSU_TARGET.position[2] + v.z];
};
const PHASE_ZERO = { assemble: 0, disassemble: 0 };
const HOME_VIEW = { position: HOME_CAM, target: HOME_TARGET }; // the whole bench, where the camera starts
const POWER_ON = { shutdown: false, unplugged: false, discharged: false };

// Power + screen state for a starting build.
function powerAndMonitor(s) {
  if (s.mode !== "disassemble") return { power: { ...POWER_ON }, monitor: { status: "off" } };
  const boot = evaluateBoot(s);
  if (boot.status === "hello") {
    return { power: { ...POWER_ON }, monitor: { status: "hello", lowRes: boot.lowRes, note: SAFETY_NOTE } };
  }
  return { power: { ...POWER_ON, shutdown: true }, monitor: { status: "off" } };
}

function ControlPanel({ buttons }) {
  return (
    <div className="assemble__control-panel">
      {buttons.map((b) => (
        <button
          key={b.key}
          title={b.title}
          className={["assemble__ctrl-btn", b.lit ? "assemble__ctrl-btn--lit" : "", b.dim ? "assemble__ctrl-btn--dim" : ""].join(" ").trim()}
          style={{ "--btn-color": b.color }}
          disabled={b.disabled || false}
          onClick={b.onPress}
        >
          {b.lit && <span className="assemble__ctrl-dot" />}
          {b.label}
        </button>
      ))}
    </div>
  );
}

const pill = {
  position: "absolute", left: 12, padding: "6px 14px", borderRadius: 999,
  background: "rgba(15,23,42,0.85)", color: "#fff", fontSize: 14,
};

export default function BuildLab() {
  const { user, profile } = useAuth();
  const userName = profile?.firstName || "Builder";
  const labSession = useLabSession({ user, profile });

  // null = start screen. ?start=build|teardown (old-route redirects) skips it.
  const [setup, setSetup] = useState(() =>
    new URLSearchParams(window.location.search).get("start") ? setupFromUrl(window.location.search) : null
  );
  const initial = useRef(null);
  if (!initial.current) {
    const s = buildStart(setup ?? DEFAULT_SETUP);
    initial.current = { ...s, ...powerAndMonitor(s) };
  }
  const init = initial.current;

  /* ---------- build state (one source of truth for both modes) ---------- */
  const [mode, setMode] = useState(init.mode);
  const [installed, setInstalled] = useState(init.installed);
  const [picks, setPicks] = useState(init.picks); // category -> catalog id of the part on the bench
  const [pasteApplied, setPasteApplied] = useState(init.pasteApplied);
  const [ramSlot, setRamSlot] = useState(init.ramSlot);
  const [cables, setCables] = useState(init.cables ?? NO_CABLES); // cables' part ends plugged in
  const [psuCables, setPsuCables] = useState(init.psuCables ?? NO_CABLES); // their PSU ends (modular PSU)
  const [screws, setScrews] = useState(init.screws ?? NO_SCREWS); // motherboard screws driven in
  const [cableTask, setCableTask] = useState(null); // connecting one end of a cable: { cable, end: "psu" | "part", port, flipped }
  const [cableDrawer, setCableDrawer] = useState(false);
  const [power, setPower] = useState(init.power);
  const [monitor, setMonitor] = useState(init.monitor);
  const [flights, setFlights] = useState({}); // name -> { position, rotation } where a pulled part was let go
  const [motherboardPos, setMotherboardPos] = useState(
    init.installed.motherboard ? MOTHERBOARD_TARGET.position : trayPosition("motherboard")
  );
  const [booted, setBooted] = useState(false);
  const [phaseActions, setPhaseActions] = useState(0);
  const [promptDismissed, setPromptDismissed] = useState(false);

  /* ---------- UI state ---------- */
  const [scoreRev, setScoreRev] = useState(0); // bumped when the ledger changes, the score is derived below
  const [, setClockTick] = useState(0); // one tick a second while the phase clock runs
  const [mistakes, setMistakes] = useState(0);
  const [inspectId, setInspectId] = useState(null); // catalog id shown in the part info panel
  const [taskDone, setTaskDone] = useState(null); // class only: { ms } once the task's phase was finished
  const [taskOpen, setTaskOpen] = useState(true); // class only: the task card is expanded
  const [bounce, setBounce] = useState({}); // part -> count, remounts a part that didn't fit so it returns to the bench
  const [popups, setPopups] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [buildId, setBuildId] = useState(0);
  // the case starts standing upright; LAY DOWN puts it on its side
  const [isLaidDown, setIsLaidDown] = useState(false);
  const [casePose, setCasePose] = useState(null);
  const [caseBox, setCaseBox] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [exploding, setExploding] = useState(false);

  /* ---------- AR state ---------- */
  const [inAR, setInAR] = useState(false);
  const [camMode, setCamMode] = useState(false);
  const [gyro, setGyro] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [placeToken, setPlaceToken] = useState(0);
  const [arError, setArError] = useState("");
  const arSupported = useARSupport();
  const arLite = camMode && gyro;
  const arLike = inAR || arLite;

  const feedbackTimer = useRef(null);
  const timers = useRef([]);
  const ledger = useRef({});
  const penalty = useRef(0);
  const misses = useRef({});
  const actionLog = useRef({}); // part -> { mode, key, flawed, committed }
  const revertCount = useRef({});
  const phaseMs = useRef({ ...PHASE_ZERO }); // time spent in each phase
  const reporter = useRef(createReporter()).current;

  const glRef = useRef(null);
  const sessionRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const contentRef = useRef(null);
  const rigApi = useRef({});
  const raycaster = useRef(new THREE.Raycaster());
  const gestures = useARGestures({ overlayRef, enabled: arLike });

  const cfg = normalizeSetup(setup ?? DEFAULT_SETUP);
  // In a class the instructor's task sets the work, and there is a clock and points.
  // Free build (no class) is for learning: no task, no clock, no points.
  const inClass = !!labSession.code;
  const scored = inClass;
  const task = inClass ? cfg.task : null;
  const hintsOn = cfg.hints;
  const platform = cfg.platform;
  const parMs = cfg.parMin * 60000;
  const scoreInfo = timedScore(ledger.current, penalty.current, phaseMs.current, parMs);
  // The official score (what the instructor reads), out of the task's points: only the work the
  // task asks for counts (taskLedger), against a perfect, on-time run of it. Leaving a required part
  // out costs marks; adding one it doesn't ask for earns none. PSU cable points count only when the
  // student's PSU takes cables.
  const taskMode = task?.mode ?? cfg.startMode;
  const outOf = task?.points ?? OFFICIAL_MAX;
  const req = taskRequirements(task ?? { mode: taskMode }, psuSocketed(picks.psu ? picks : correctPicks(platform)));
  const maxPts = maxPoints(taskMode, req);
  const officialCard = timedScore(taskLedger(ledger.current, req), penalty.current, phaseMs.current, parMs);
  const official = officialScore(officialCard, taskMode, maxPts, outOf);

  const rig = useMemo(() => ({ laidDown: isLaidDown, position: casePose ?? [0, 0, 0] }), [isLaidDown, casePose]);

  const handleCaseMeasured = useCallback((box) => {
    setCaseBox(box.clone());
    const rb = box.clone().applyMatrix4(new THREE.Matrix4().makeRotationX(LAY_ANGLE));
    const c = rb.getCenter(new THREE.Vector3());
    setCasePose([LAY_CENTER[0] - c.x, -rb.min.y, LAY_CENTER[1] - c.z]);
  }, []);

  /* ---------- where each part sits right now (world pose) ---------- */
  // Each board has its own scale and socket / slot positions (MOUNTS in its model file).
  const boardVariant = CATALOG[picks.motherboard]?.variant ?? 0;
  const L = useMemo(() => boardLayout(BOARD_MOUNTS[boardVariant] || BOARD_MOUNTS[0]), [boardVariant]);
  const UPRIGHT = [0, Math.PI, 0];
  const boardMounted = !!installed.motherboard;
  const moboTarget = useMemo(() => toWorldPose(MOTHERBOARD_TARGET.position, MOTHERBOARD_TARGET.rotation, rig), [rig]);
  const psuTarget = useMemo(() => toWorldPose(PSU_TARGET.position, PSU_TARGET.rotation, rig), [rig]);
  const gpuTarget = useMemo(() => toWorldPose(L.gpu, GPU_TARGET.rotation, rig), [rig, L]);
  const cpuTarget = useMemo(
    () =>
      boardMounted
        ? toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, L.cpuLocal, MOBO_MOUNTED_ROTATION, L.scale), UPRIGHT, rig)
        : { position: moboLocalToWorld(motherboardPos, L.cpuLocal, MOBO_LYING_ROTATION, L.scale), rotation: [0, Math.PI, 0] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig, L]
  );
  const storageTarget = useMemo(
    () =>
      boardMounted
        ? toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, L.storageLocal, MOBO_MOUNTED_ROTATION, L.scale), UPRIGHT, rig)
        : { position: moboLocalToWorld(motherboardPos, L.storageLocal, MOBO_LYING_ROTATION, L.scale), rotation: [0, Math.PI, 0] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig, L]
  );
  // The cooler and RAM can go on while the board is still on the bench (the expert way) or after.
  const coolerTarget = useMemo(
    () =>
      boardMounted
        ? toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, L.coolerLocal, MOBO_MOUNTED_ROTATION, L.scale), UPRIGHT, rig)
        : { position: moboLocalToWorld(motherboardPos, L.coolerLocal, MOBO_LYING_ROTATION, L.scale), rotation: [0, Math.PI, 0] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig, L]
  );
  const ramTargets = useMemo(
    () =>
      L.ramSlots.map((l) =>
        boardMounted
          ? toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, l, MOBO_MOUNTED_ROTATION, L.scale), UPRIGHT, rig)
          : { position: moboLocalToWorld(motherboardPos, l, MOBO_LYING_ROTATION, L.scale), rotation: [0, Math.PI, 0] }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig, L]
  );
  const ram1Free = ramTargets.map((t, i) => ({ ...t, slot: i })).filter((t) => ramSlot.ram2 !== t.slot);
  const ram2Free = ramTargets.map((t, i) => ({ ...t, slot: i })).filter((t) => ramSlot.ram1 !== t.slot);

  // Where a part is while installed (an AR tap pulls it from here).
  const poseNow = {
    motherboard: moboTarget, psu: psuTarget, gpu: gpuTarget, cpu: cpuTarget, storage: storageTarget,
    cpu_cooler: coolerTarget, ram1: ramTargets[ramSlot.ram1 ?? 0], ram2: ramTargets[ramSlot.ram2 ?? 1],
  };
  // Where an uninstalled part goes when placed (AR marker).
  const targetOf = { ...poseNow, ram1: ram1Free[0], ram2: ram2Free[0] };

  /* ---------- reporting, score, hints ---------- */
  function reportEvent(type, part, detail, points = 0) {
    reporter.report({ mode, type, part, detail, points });
    if (MISTAKE_TYPES.includes(type)) setMistakes((n) => n + 1);
  }

  function syncScore() {
    setScoreRev((r) => r + 1);
  }

  function triggerPopup(points, type) {
    if (!scored) return;
    const id = Date.now() + Math.random();
    setPopups((p) => [...p, { id, points, type }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1200);
  }

  // With hints off, failure toasts stay vague (`vague`, or a generic line). reportEvent still gets the full text.
  function showHint(text, type = "fail", vague = HINT_HIDDEN) {
    setFeedback({ type, text: type === "fail" && !hintsOn ? vague : text });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2800);
  }

  function award(key, points, message, part) {
    const previous = ledger.current[key] || 0;
    const gain = Math.max(0, points - previous);
    ledger.current[key] = Math.max(previous, points);
    syncScore();
    // the popup shows what the score card actually gains at the current pace
    const shown = gain * timeFactor(phaseMs.current[key.split(":")[0]] ?? 0, parMs);
    if (gain > 0) triggerPopup(`+${officialDelta(shown, maxPts, outOf)}`, "success");
    showHint(message, "success");
    if (part) reportEvent("success", part, message, gain);
  }

  function deduct(points, message) {
    penalty.current += points;
    syncScore();
    triggerPopup(`-${officialDelta(points, maxPts, outOf)}`, "fail");
    showHint(message, "fail");
  }

  // A mistake: counts against the part's points in the current mode and is reported.
  function miss(name, message, type = "miss", vague) {
    const k = ledgerKey(mode, name);
    misses.current[k] = (misses.current[k] || 0) + 1;
    reportEvent(type, name, message);
    showHint(message, "fail", vague);
  }

  // Sends a part that was let go over its slot back to the bench (DraggablePart keeps it "placed" otherwise).
  function bounceBack(name) {
    setBounce((b) => ({ ...b, [name]: (b[name] || 0) + 1 }));
    setSelectedPart(null);
  }
  const blockType = (key) => (key === "shutdown" || key === "unplug" || key === "discharge" ? "safety" : "blocked");

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }
  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  /* ---------- revert penalty ---------- */
  function logAction(name, key, flawed) {
    actionLog.current[name] = { mode, key, flawed, committed: false };
  }

  function commitOpenActions() {
    Object.values(actionLog.current).forEach((a) => (a.committed = true));
  }

  // Undoing, in the other mode, something done earlier in this phase costs points.
  function settleRevert(name) {
    const last = actionLog.current[name];
    if (!last || last.committed || last.mode === mode) return;
    delete actionLog.current[name];
    if (!scored || cfg.revertPenalty === "off") return;
    const count = (revertCount.current[name] = (revertCount.current[name] || 0) + 1);
    const pts = revertPenalty({ base: basePoints(last.mode, name), flawed: last.flawed, count, level: cfg.revertPenalty });
    ledger.current[last.key] = 0; // take back what the original action earned
    const msg = last.flawed
      ? `Reverted a mistake on the ${PART_LABEL[name]}. -${pts}`
      : `Undid the ${PART_LABEL[name]}. -${pts}`;
    deduct(pts, msg);
    reportEvent("revert", name, msg, -pts);
  }

  /* ---------- assemble: install a part ---------- */
  function install(name, slot) {
    // the picked part may not fit the board (or, in a class, the task's platform): it doesn't go in
    const fit = fitBlock(name, picks, scored ? platform : null);
    if (fit) {
      miss(name, fit.msg, "compat", fit.vague);
      bounceBack(name);
      return;
    }
    settleRevert(name);
    const k = ledgerKey(mode, name);
    let flawed = (misses.current[k] || 0) > 0;

    if (name === "motherboard") {
      setMotherboardPos(MOTHERBOARD_TARGET.position);
      setScrews(NO_SCREWS); // set in the case; the screws still have to go in
    }
    if (name === "ram1" || name === "ram2") {
      const free = name === "ram1" ? ram1Free : ram2Free;
      const s = slot ?? free[0].slot;
      const other = ramSlot[name === "ram1" ? "ram2" : "ram1"];
      if (other != null && Math.abs(other - s) === 1) flawed = true; // neighbouring slots, no dual channel
      setRamSlot((p) => ({ ...p, [name]: s }));
    }

    setInstalled((p) => ({ ...p, [name]: true }));
    setFlights((p) => {
      const n = { ...p };
      delete n[name];
      return n;
    });
    setPhaseActions((n) => n + 1);
    setSelectedPart(null);

    if (name === "cpu_cooler" && !pasteApplied) {
      flawed = true;
      ledger.current[k] = 0;
      logAction(name, k, flawed);
      deduct(POINTS.skipPaste, `Cooler mounted without thermal paste. -${POINTS.skipPaste}`);
      reportEvent("penalty", name, "Cooler mounted without thermal paste", -POINTS.skipPaste);
      return;
    }

    logAction(name, k, flawed);
    const missCount = misses.current[k] || 0;
    const msg = `${PART_LABEL[name]} installed.${missCount === 0 ? " Perfect placement!" : ""}`;
    award(k, actionPoints(basePoints(mode, name), missCount), msg, name);
  }

  function applyPaste() {
    if (installed.cpu_cooler) return showHint("Too late, the cooler is already on. Paste goes on first.");
    if (!installed.cpu) return showHint("Install the CPU first, the paste goes on top of it.");
    if (pasteApplied) return showHint("Thermal paste is already applied.", "success");
    setPasteApplied(true);
    award(ledgerKey("assemble", "paste"), POINTS.paste, "Thermal paste applied. The cooler can go on now.", "paste");
  }

  /* ---------- disassemble: remove a part ---------- */
  function uninstall(name, fromWorld) {
    document.body.style.cursor = "";
    setHovered(null);
    if (!installed[name]) return;
    if (gestures.consumeSuppress()) return; // a drag/pinch/twist just happened, not a real tap

    const b = removeBlock(name, installed, power, { cables, screws });
    if (b) {
      miss(b.key, b.msg, blockType(b.key));
      return;
    }
    settleRevert(name);
    const k = ledgerKey(mode, name);
    let flawed = (misses.current[k] || 0) > 0;
    if (name === "cpu" && pasteApplied) {
      misses.current[k] = (misses.current[k] || 0) + 1; // pulled with the old paste still on
      flawed = true;
      reportEvent("miss", name, "Pulled the CPU with the old thermal paste still on");
    }

    const base = poseNow[name];
    const from =
      fromWorld && contentRef.current
        ? { position: contentRef.current.worldToLocal(fromWorld.clone()).toArray(), rotation: base.rotation }
        : base;

    setFlights((p) => ({ ...p, [name]: from }));
    setInstalled((p) => {
      const n = { ...p };
      delete n[name];
      return n;
    });
    if (name === "cpu") setPasteApplied(false); // the paste goes with it
    if (name === "ram1" || name === "ram2") setRamSlot((p) => ({ ...p, [name]: null }));
    if (name === "motherboard") setMotherboardPos(trayPosition("motherboard"));
    setBooted(false);
    setPhaseActions((n) => n + 1);

    logAction(name, k, flawed);
    const missCount = misses.current[k] || 0;
    award(k, actionPoints(basePoints(mode, name), missCount), `${PART_LABEL[name]} removed.${missCount === 0 ? " Clean removal!" : ""}`, name);
  }

  function reportBlocked(name) {
    const b = removeBlock(name, installed, power, { cables, screws });
    if (b) miss(b.key, b.msg, blockType(b.key));
  }

  function doShutdown() {
    if (power.shutdown || monitor.status === "shuttingDown") return;
    const k = ledgerKey("disassemble", "shutdown");
    setMonitor({ status: "shuttingDown", lowRes: monitor.lowRes });
    award(k, actionPoints(POINTS.shutdown, misses.current[k] || 0), "Shutting down…", "shutdown");
    later(() => {
      setMonitor({ status: "off" });
      setPower((p) => ({ ...p, shutdown: true }));
      showHint("PC is off. Now unplug it from power.", "success");
    }, SHUTDOWN_DURATION);
  }

  function unplug() {
    if (power.unplugged) return;
    if (monitor.status === "shuttingDown") return showHint("Wait for the PC to finish shutting down.");
    if (!power.shutdown) return miss("shutdown", "Shut the PC down first, then unplug it.", "safety");
    setPower((p) => ({ ...p, unplugged: true }));
    const k = ledgerKey("disassemble", "unplug");
    award(k, actionPoints(POINTS.unplug, misses.current[k] || 0), "Unplugged. Now hold the power button to drain leftover power.", "unplug");
  }

  // Holding the power button with the cable out empties the capacitors: the last safety step.
  function discharge() {
    if (power.discharged) return;
    if (!power.unplugged) {
      const key = !power.shutdown ? "shutdown" : "unplug";
      return miss(key, "Shut down and unplug the PC first, then hold the power button to drain it.", "safety");
    }
    setPower((p) => ({ ...p, discharged: true }));
    const k = ledgerKey("disassemble", "discharge");
    award(k, actionPoints(POINTS.discharge, misses.current[k] || 0), "Leftover power drained. Now it's safe to take parts out.", "discharge");
  }

  function wipePaste() {
    if (!power.discharged) {
      const key = !power.shutdown ? "shutdown" : !power.unplugged ? "unplug" : "discharge";
      return miss(key, "Shut down, unplug and drain the PC before touching any part.", "safety");
    }
    if (!installed.cpu) return showHint("The CPU is already out, wipe the paste before pulling it.");
    if (installed.cpu_cooler) return showHint("Remove the CPU cooler to reach the paste.");
    if (!pasteApplied) return showHint("The old paste is already wiped off.", "success");
    setPasteApplied(false);
    award(ledgerKey("disassemble", "paste"), actionPoints(POINTS.paste, 0), "Old thermal paste wiped clean.", "paste");
  }

  /* ---------- cables and screws ---------- */
  const gpuPort = itemFor("gpu", picks)?.powerPort;
  const modularPsu = psuModular(picks);
  const psuPanel = modularPsu ? PSU_PANELS[itemFor("psu", picks)?.variant ?? 0] : null;
  // a PSU with fixed cables (all of them, or some on a semi-modular one): where they leave it, and
  // where they lie coiled on the bench
  const isFixed = (c) => psuCableFixed(c, picks);
  const psuFixed = CABLE_IDS.some(isFixed) ? PSU_FIXED[itemFor("psu", picks)?.variant ?? 1] || PSU_FIXED[1] : null;
  // a cable carries power only with both ends in (plugged into the PSU, or routed out of a fixed one)
  const liveCables = Object.fromEntries(CABLE_IDS.map((c) => [c, cables[c] && psuEndDone(c, picks, psuCables)]));

  // Connecting a cable, Packet Tracer style. The PSU end comes first, on the bench:
  //   1. pick the cable in the Cables drawer
  //   2. click where its end goes: the labelled socket on a modular PSU (or, on a PSU with fixed
  //      cables, the cable itself in the bundle, which routes it out), later the header on the part
  //      (a wrong one is a mistake)
  //   3. line the clip up with the yellow tab (turn the plug if needed), then push it in
  function startCable(c) {
    if (mode !== "assemble" || exploding) return;
    const label = CABLES[c].label;
    if (!psuEndDone(c, picks, psuCables)) {
      const b = psuPlugBlock(c, picks);
      if (b) return showHint(b.msg);
      setCableDrawer(false);
      setCableTask({ cable: c, end: "psu", port: null, flipped: false });
      if (installed.psu) {
        showHint(
          isFixed(c)
            ? "Tip: a PSU's fixed cables are easier to sort out before it goes in the case."
            : "Tip: a PSU's sockets are easier to reach before it goes in the case."
        );
      }
      return;
    }
    if (cables[c]) return showHint(`The ${label} is plugged in at both ends.`, "success");
    const b = plugBlock(c, installed, picks, psuCables);
    if (b) return showHint(b.msg);
    setCableDrawer(false);
    setCableTask({ cable: c, end: "part", port: null, flipped: false });
  }

  // the PSU end: which labelled socket
  function chooseSocket(sock) {
    if (cableTask?.end !== "psu") return showHint("Pick a cable in CABLES first, then click the socket it goes into.");
    const c = cableTask.cable;
    const want = CABLES[c].psuSocket;
    if (sock !== want) {
      const mixUp = (sock === "cpu" && want === "pcie") || (sock === "pcie" && want === "cpu");
      return miss(
        `psu_${c}`,
        `That's the ${psuPanel.sockets[sock].label} socket. The ${CABLES[c].label} goes into the ${psuPanel.sockets[want].label} socket.` +
          (mixUp ? " CPU and PCI-E sockets look alike but are wired differently: the wrong one can damage parts. Always read the label." : ""),
        "miss",
        "Wrong socket. Read the labels on the PSU."
      );
    }
    setCableTask({ ...cableTask, port: sock, flipped: Math.random() < 0.5 });
  }

  // a fixed PSU's cable: routing it out of the bundle is its PSU end (it is already attached)
  function routeFixed(c) {
    if (exploding) return;
    const label = CABLES[c].label;
    if (mode !== "assemble") return showHint(`The ${label} is fixed to this PSU, so it stays on it.`, "success");
    if (psuCables[c]) return showHint(`The ${label} is already routed out.`, "success");
    if (cableTask?.end !== "psu") return showHint("Pick a cable in CABLES first, then click it in the PSU's bundle.");
    const want = cableTask.cable;
    const key = `psu_${want}`;
    if (!isFixed(want)) {
      return miss(
        key,
        `That cable is fixed to the PSU. The ${CABLES[want].label} isn't: it plugs into a ${psuPanel?.sockets[CABLES[want].psuSocket]?.label || "labelled"} socket on the PSU's face.`,
        "miss",
        "That one is fixed to the PSU. Find the socket instead."
      );
    }
    if (c !== want) {
      return miss(
        key,
        `That's the ${label}. The ${CABLES[want].label} is the one with the ${PLUG_LOOK[want]}.`,
        "miss",
        "Wrong cable. Look at the plug on its end."
      );
    }
    const k = ledgerKey(mode, key);
    setCableTask(null);
    setPsuCables((prev) => ({ ...prev, [c]: true }));
    award(
      k,
      actionPoints(basePoints(mode, key), misses.current[k] || 0),
      `${label} routed out of the bundle. Its plug waits for the ${c === "pcie" ? "graphics card" : "motherboard"}.`,
      key
    );
  }

  // the part end: which header
  function choosePort(p) {
    if (cableTask?.end !== "part") return showHint("Pick a cable in CABLES first, then click where it goes.");
    const c = cableTask.cable;
    if (p !== c) {
      return miss(
        `cable_${c}`,
        `That's the ${PORT_LABEL[p]}. The ${CABLES[c].label} goes into ${PORT_WHERE[c]}.`,
        "miss",
        "That plug doesn't fit there. Count the pins and look at the shape."
      );
    }
    // the plug arrives the way it was hanging: half the time with its clip on the wrong side
    setCableTask({ ...cableTask, port: p, flipped: Math.random() < 0.5 });
  }

  function turnPlug() {
    setCableTask((t) => (t ? { ...t, flipped: !t.flipped } : t));
  }

  function pushPlug() {
    if (!cableTask?.port) return;
    const c = cableTask.cable;
    const atPsu = cableTask.end === "psu";
    const key = atPsu ? `psu_${c}` : `cable_${c}`;
    const k = ledgerKey(mode, key);
    if (cableTask.flipped) {
      return miss(
        key,
        "The clip is on the wrong side, so it won't go in. Turn the plug round: it only fits one way, clip over the tab.",
        "miss",
        "It won't go in this way round."
      );
    }
    setCableTask(null);
    if (atPsu) {
      setPsuCables((prev) => ({ ...prev, [c]: true }));
      return award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${CABLES[c].label} plugged into the PSU. Its other end waits for the ${c === "pcie" ? "graphics card" : "motherboard"}.`, key);
    }
    setCables((prev) => ({ ...prev, [c]: true }));
    award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${CABLES[c].label} plugged in. The clip clicked over the tab.`, key);
  }

  // Clicking a plug in the PSU: push it in while connecting; when taking apart, unplug it (part end first).
  function clickPsuCable(c) {
    if (exploding) return;
    const label = CABLES[c].label;
    const key = `psu_${c}`;
    const k = ledgerKey(mode, key);
    if (mode === "assemble") {
      if (cableTask?.cable === c && cableTask.end === "psu" && cableTask.port) return pushPlug();
      return showHint(`The ${label} is plugged into the PSU.`, "success");
    }
    if (!psuCables[c]) return showHint(`The ${label} is already off the PSU.`, "success");
    if (cables[c]) return miss(key, `Unplug the ${label} from the ${c === "pcie" ? "graphics card" : "motherboard"} first, then from the PSU.`, "blocked");
    const s = safetyBlock(power);
    if (s) return miss(s.key, s.msg, "safety");
    setPsuCables((p) => ({ ...p, [c]: false }));
    award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${label} unplugged from the PSU.`, key);
  }

  // Clicking a plug: push it in while connecting, unplug it when taking apart (after the safety steps).
  function clickCable(c) {
    if (exploding) return;
    const label = CABLES[c].label;
    const key = `cable_${c}`;
    const k = ledgerKey(mode, key);
    if (mode === "assemble") {
      if (cableTask?.cable === c && cableTask.end === "part" && cableTask.port) return pushPlug();
      if (cables[c]) return showHint(`The ${label} is already plugged in.`, "success");
      return showHint("Click the header it plugs into.", "success");
    }
    if (!cables[c]) return showHint(`The ${label} is already unplugged.`, "success");
    const s = safetyBlock(power);
    if (s) return miss(s.key, s.msg, "safety");
    setCables((p) => ({ ...p, [c]: false }));
    award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${label} unplugged. Squeeze the clip, then pull straight out.`, key);
  }

  // One click per screw: in when assembling, out when taking apart.
  function clickScrew(i) {
    if (exploding || !installed.motherboard) return;
    const k = ledgerKey(mode, "screws");
    if (mode === "assemble") {
      if (screws[i]) return showHint("That screw is already in.", "success");
      const next = screws.map((s, j) => s || j === i);
      setScrews(next);
      const n = next.filter(Boolean).length;
      if (n === SCREW_COUNT) {
        return award(k, actionPoints(basePoints(mode, "screws"), misses.current[k] || 0), "All 9 screws in. The board is secure.", "screws");
      }
      return showHint(`Screw in: ${n} of ${SCREW_COUNT}. Snug, not tight.`, "success");
    }
    if (!screws[i]) return showHint("That screw is already out.", "success");
    const s = safetyBlock(power);
    if (s) return miss(s.key, s.msg, "safety");
    const next = screws.map((s2, j) => s2 && j !== i);
    setScrews(next);
    const left = next.filter(Boolean).length;
    if (left === 0) {
      return award(k, actionPoints(basePoints(mode, "screws"), misses.current[k] || 0), "All screws out. The board can come out now.", "screws");
    }
    showHint(`Screw out: ${left} still in.`, "success");
  }

  // Where each header is right now (case space), and which ones exist.
  const portPos = {
    atx24: [L.atx24[0], L.atx24[1], L.pcbFront + HEADER_HEIGHT],
    eps8: [L.eps8[0], L.eps8[1], L.pcbFront + HEADER_HEIGHT],
    pcie: gpuPort ? [L.gpu[0] + gpuPort[0], L.gpu[1] + gpuPort[1], L.gpu[2] + gpuPort[2]] : null,
  };
  const portOpen = (p) => (p === "pcie" ? installed.gpu && !!gpuPort : !!installed.motherboard);

  // Where a cable's PSU end leaves the PSU in the case: the end of its plug's wires (case space).
  function psuWireEnd(c) {
    if (psuFixed && isFixed(c)) return psuToCase([psuFixed.exit[0], psuFixed.exit[1], psuFixed.face - 0.05]);
    if (!psuPanel || !psuPanel.sockets[CABLES[c].psuSocket]) return PSU_FIXED_OUT;
    const at = psuPanel.sockets[CABLES[c].psuSocket].at;
    const x = at.reduce((s, p) => s + p[0], 0) / at.length;
    const y = at.reduce((s, p) => s + p[1], 0) / at.length;
    return psuToCase([x, y, psuPanel.face - PLUG_REACH]);
  }

  // The part end of each cable: plugged in, or on its way into a header. Its wire to the PSU is a
  // see-through "ghost" guide: it shows where the cable runs without modelling the whole cable.
  function cablePose(c) {
    let pose = null;
    if (cables[c] && portOpen(c)) pose = { pos: portPos[c], rot: PORT_ROT[c], seated: true, flipped: false };
    else if (cableTask?.cable === c && cableTask.end === "part" && cableTask.port) {
      pose = { pos: portPos[cableTask.port], rot: PORT_ROT[cableTask.port], seated: false, flipped: cableTask.flipped };
    }
    if (!pose) return null;
    const out = PLUG_REACH + (pose.seated ? 0 : 0.11);
    const a = psuWireEnd(c);
    const b = [pose.pos[0], pose.pos[1], pose.pos[2] + out];
    const lift = Math.max(a[2], b[2]) + 0.08;
    pose.ghost = [a, [a[0] + 0.14, a[1] + 0.04, a[2] + 0.06], [(a[0] + b[0]) / 2 + 0.1, (a[1] + b[1]) / 2, lift], [b[0], b[1], b[2] + 0.04], b];
    return pose;
  }

  // The PSU ends to draw in the PSU's sockets: plugged in, or on their way in.
  const psuPlugs = {};
  if (psuPanel) {
    CABLE_IDS.filter((c) => !isFixed(c) && psuPanel.sockets[CABLES[c].psuSocket]).forEach((c) => {
      const connecting = cableTask?.cable === c && cableTask.end === "psu" && cableTask.port;
      if (psuCables[c]) {
        const unplugNow = mode === "disassemble" && !cables[c] && power.discharged;
        psuPlugs[c] = { socket: CABLES[c].psuSocket, seated: true, flipped: false, waiting: unplugNow };
      } else if (connecting) {
        psuPlugs[c] = { socket: cableTask.port, seated: false, flipped: cableTask.flipped, waiting: true };
      }
    });
  }
  const choosingSocket = cableTask?.end === "psu" && !cableTask.port && !isFixed(cableTask.cable);
  const psuPanelNode = psuPanel && !exploding && (
    <PSUPanel
      layout={psuPanel}
      plugs={psuPlugs}
      choosing={choosingSocket}
      latch={cableTask?.end === "psu" ? cableTask.port : null}
      onSocket={chooseSocket}
      onPlug={clickPsuCable}
    />
  );

  const fixedCables = (onBench) =>
    psuFixed &&
    !exploding && (
      <FixedCables
        layout={psuFixed}
        cables={CABLE_IDS.filter((c) => isFixed(c) && (c !== "pcie" || !!picks.gpu)).map((c) => ({
          id: c,
          type: STUB_TYPE[c],
          color: GHOST_COLOR[c],
          label: FIXED_MARK[c],
          routed: !!psuCables[c],
        }))}
        showRouted={onBench}
        choosing={mode === "assemble" && cableTask?.end === "psu" && isFixed(cableTask.cable)}
        onPick={routeFixed}
      />
    );

  // the yellow tab beside a header, on the side the clip has to go
  const latchTab = (p) => {
    const [x, y, z] = portPos[p];
    const d = PORT_LATCH[p];
    return [x + d[0] * 0.04, y + d[1] * 0.04, z + 0.01];
  };

  // While a cable end is being connected, the camera glides to where it goes: the PSU's sockets (or
  // a fixed PSU's coiled cables) on the bench, or the header on the board / graphics card in the
  // case. When the step ends it glides back to the whole bench (CameraFocus).
  const cableFocus = useMemo(() => {
    if (!cableTask) return null; // kept through the clip step, so the plug stays in view
    const key = `${cableTask.cable}:${cableTask.end}`;
    if (cableTask.end === "psu") {
      if (installed.psu) return null; // under the case's PSU cover: nothing better to show
      const [x, y, z] = trayPosition("psu");
      if (isFixed(cableTask.cable)) return { key, target: [x, y + 0.05, z + 0.55], position: [x + 0.2, y + 1.0, z + 1.8] };
      return { key, target: [x, y + 0.2, z + 0.3], position: [x + 0.25, y + 0.75, z + 1.55] };
    }
    const p = portPos[cableTask.cable];
    if (!p) return null;
    const at = toWorldPose(p, [0, 0, 0], rig).position;
    const off = rig.laidDown ? [0.2, 1.5, 0.35] : [0.3, 0.25, 1.5];
    return { key, target: at, position: [at[0] + off[0], at[1] + off[1], at[2] + off[2]] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cableTask?.cable, cableTask?.end, installed.psu, rig, L]);

  // every cable this build needs is in at both ends
  const cablesDone =
    !!picks.psu &&
    CABLE_IDS.filter((c) => c !== "pcie" || !!picks.gpu).every((c) => psuEndDone(c, picks, psuCables) && cables[c]);

  // a plug bobs when it's the student's move: push it in (assemble) or unplug it (disassemble, once safe)
  const cableWaiting = (c) =>
    mode === "assemble" ? cableTask?.cable === c && cableTask.end === "part" && !!cableTask.port : cables[c] && power.discharged;

  /* ---------- assemble: power on, overheating ---------- */
  function runOverheat(lowRes, detail, fix) {
    const loadMs = OVERHEAT.loadMinMs + Math.random() * (OVERHEAT.loadMaxMs - OVERHEAT.loadMinMs);
    setMonitor({ status: "hello", lowRes, note: null });
    later(() => {
      setMonitor({ status: "loading", lowRes });
      later(() => {
        setMonitor({ status: "bsod", lowRes, detail, fix });
        if (OVERHEAT.explodeAfterBsod) later(explode, OVERHEAT.bsodMs);
        else {
          deduct(POINTS.explosion, "The PC crashed from overheating. Power off, fix it, and try again.");
          reportEvent("penalty", "cpu", detail, -POINTS.explosion);
        }
      }, loadMs);
    }, OVERHEAT.helloMs);
  }

  function explode() {
    setMonitor({ status: "off" });
    setExploding(true);
    deduct(POINTS.explosion, "The CPU overheated and the build blew apart. Rebuild it and add paste and a cooler.");
    reportEvent("penalty", "cpu", "Overheated and exploded", -POINTS.explosion);
    later(() => applyState(EMPTY_BUILD), OVERHEAT.blastMs);
  }

  function pressPower() {
    if (mode !== "assemble") return;
    if (monitor.status !== "off") {
      clearTimers();
      setMonitor({ status: "off" });
      return;
    }
    if (installed.motherboard && screws.some((s) => !s)) {
      return miss(
        "screws",
        "Screw the motherboard down before powering on. A loose board can flex and short against the case.",
        "safety"
      );
    }
    setPower({ ...POWER_ON }); // powering on plugs it back in
    const result = evaluateBoot({ installed, pasteApplied, ramSlot, picks, cables: liveCables }, { hints: hintsOn });
    if (result.status === "dead") {
      reportEvent("bootfail", result.part || "psu", result.message);
      showHint(result.message);
      return;
    }
    const { lowRes } = result;
    clearTimers();
    setMonitor({ status: "booting", lowRes });
    later(() => {
      if (result.status === "overheat") {
        reportEvent("bootfail", "cpu_cooler", result.detail);
        runOverheat(lowRes, result.detail, result.fix);
        return;
      }
      setMonitor(result);
      if (result.status === "post") reportEvent("bootfail", "post", `${result.title}: ${result.code}`);
      if (result.status === "hello") {
        setBooted(true);
        const points = POINTS.bootBase + (result.ramCount === 2 ? POINTS.bootDualRam : 0) + (lowRes ? 0 : POINTS.bootGpu);
        const more = scored ? " for more points" : " for a faster PC";
        const message = lowRes
          ? `Booted on integrated graphics. Add a GPU${more}.`
          : result.ramCount === 2
          ? "System booted. Build complete!"
          : `System booted. Add a second RAM stick${more}.`;
        award(ledgerKey("assemble", "boot"), points, message, "boot");
      }
    }, 2200);
  }

  /* ---------- mode switching ---------- */
  function applyState(s) {
    clearTimers();
    const pm = powerAndMonitor(s);
    setMode(s.mode);
    setInstalled(s.installed);
    if (s.picks) setPicks(s.picks);
    setBounce({});
    setInspectId(null);
    setPasteApplied(s.pasteApplied);
    setRamSlot(s.ramSlot);
    setCables(s.cables ?? NO_CABLES);
    setPsuCables(s.psuCables ?? NO_CABLES);
    setScrews(s.screws ?? NO_SCREWS);
    setCableTask(null);
    setCableDrawer(false);
    setPower(pm.power);
    setMonitor(pm.monitor);
    setMotherboardPos(s.installed.motherboard ? MOTHERBOARD_TARGET.position : trayPosition("motherboard"));
    setFlights({});
    setBooted(false);
    setPhaseActions(0);
    setPromptDismissed(false);
    setSelectedPart(null);
    setHovered(null);
    setExploding(false);
    setIsLaidDown(false);
    actionLog.current = {};
    revertCount.current = {};
    setBuildId((b) => b + 1);
  }

  function switchMode(next) {
    clearTimers();
    setCableTask(null);
    setCableDrawer(false);
    setSelectedPart(null);
    setPromptDismissed(false);
    setPhaseActions(0);
    if (next === "disassemble") {
      // Nothing built yet: load a complete PC so the student can start taking it apart.
      if (Object.keys(installed).length === 0) {
        applyState(buildStart({ ...cfg, startMode: "disassemble", startState: "full" }));
        return;
      }
      if (monitor.status === "hello") setMonitor((m) => ({ ...m, note: SAFETY_NOTE }));
      else {
        setMonitor({ status: "off" });
        setPower({ ...POWER_ON, shutdown: true });
      }
    } else {
      setMonitor({ status: "off" });
      setPower({ ...POWER_ON });
    }
    setMode(next);
  }

  // The student's own button, if the rules allow it.
  function toggleMode() {
    if (!canToggle) return;
    switchMode(mode === "assemble" ? "disassemble" : "assemble");
  }

  // Instructor switch or the "phase finished" prompt. Never counts as a student revert.
  // Step 4 calls this when the session's mode changes.
  function forceMode(next) {
    if (next === mode) return;
    commitOpenActions();
    switchMode(next);
  }

  // Score, time and mistakes start over. In a class only the bench starts over (RESET can't wipe a grade).
  function resetBuild(next = cfg, { keepScore = !!labSession.code } = {}) {
    if (!keepScore) {
      ledger.current = {};
      misses.current = {};
      penalty.current = 0;
      phaseMs.current = { ...PHASE_ZERO };
      setMistakes(0);
      setTaskDone(null);
      reporter.clear();
    }
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(null);
    setPopups([]);
    syncScore();
    document.body.style.cursor = "";
    applyState(buildStart(next));
  }

  function startPractice(partial) {
    const s = normalizeSetup({ ...DEFAULT_SETUP, ...partial });
    setSetup(s);
    resetBuild(s, { keepScore: false });
  }

  // Opened from a class ("Open lab"): /lab?lab=CODE&class=ID joins that lab straight away.
  // The session effects below load this student's setup.
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const fromClass = urlParams.get("class");
  const [autoJoin, setAutoJoin] = useState(() => (urlParams.get("lab") ? "joining" : null));
  useEffect(() => {
    const code = urlParams.get("lab");
    if (!code || !user?.uid) return;
    labSession.join(code).then((res) => setAutoJoin(res.error || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* ---------- class session ---------- */
  const classPhase = labSession.phase; // null (free build) | "waiting" | "running" | "ended"
  const assigned = inClass && labSession.session ? studentSetup(labSession.session, labSession.me) : null;
  // A new task, or a change to what the task starts with, sends the student back to its start.
  const assignKey = assigned
    ? `${assigned.task.id}|${assigned.startMode}|${assigned.platform}|${assigned.partPicking}`
    : null;
  const assignedJson = assigned ? JSON.stringify(assigned) : "";
  const lastAssign = useRef(null);

  // Everything else about the task (instructions, hints, part info, target time) applies straight away.
  useEffect(() => {
    if (!assigned) return;
    if (assignKey !== lastAssign.current) {
      const first = lastAssign.current === null;
      lastAssign.current = assignKey;
      setSetup(assigned);
      resetBuild(assigned, { keepScore: false });
      setTaskOpen(true);
      if (!first) showHint(`Your instructor gave you a new task: ${assigned.task.title}`, "success");
    } else {
      setSetup(assigned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignKey, assignedJson]);

  // Every mistake goes to the class log while in a class.
  useEffect(() => {
    reporter.setSink(inClass ? labSession.sink : null);
  }, [inClass, labSession.sink, reporter]);

  // The class starting is the real start: the waiting time doesn't count.
  const prevPhase = useRef(null);
  useEffect(() => {
    if (prevPhase.current === "waiting" && classPhase === "running") resetBuild(cfg, { keepScore: false });
    prevPhase.current = classPhase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classPhase]);

  function leaveClass() {
    labSession.leave();
    lastAssign.current = null;
    setSetup(null);
  }

  /* ---------- phase status ---------- */
  const phaseDone =
    phaseActions > 0 &&
    (mode === "disassemble" ? isFullyStripped(installed, Object.fromEntries(psuSocketed(picks).map((c) => [c, psuCables[c]]))) : isFullyBuilt(installed, picks) && booted);
  const canToggle =
    cfg.modeControl === "student" && (cfg.toggle === "free" || (cfg.toggle === "afterComplete" && phaseDone));
  // a build is the required parts plus any optional ones picked (second RAM stick, graphics card)
  const partsLeft =
    mode === "assemble" ? buildSlots(picks).filter((p) => !installed[p]).length : ALL_PARTS.filter((p) => installed[p]).length;

  useEffect(() => {
    if (phaseDone) commitOpenActions(); // finishing a phase locks in its actions
    // The task is done the first time its own phase (build + boot, or full teardown) is finished.
    if (phaseDone && task && mode === task.mode && !taskDone) {
      setTaskDone({ ms: Math.round(phaseMs.current[mode]) });
      setTaskOpen(true);
      reportEvent("task", task.mode, `Finished the task: ${task.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseDone]);

  /* ---------- phase clock (class only): counts up, slower work keeps fewer points ---------- */
  const clockOn = scored && !!setup && !phaseDone && classPhase === "running";
  useEffect(() => {
    if (!clockOn) return undefined;
    const m = mode;
    let last = Date.now();
    const flush = () => {
      const n = Date.now();
      phaseMs.current[m] += n - last;
      last = n;
    };
    const id = setInterval(() => {
      flush();
      setClockTick((t) => t + 1);
    }, 1000);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [clockOn, mode]);

  const elapsed = phaseMs.current[mode];
  const factorNow = scoreInfo.factor[mode];

  // The instructor's live table. Time is sent in 15 s steps so a class doesn't flood Firestore.
  const timeBucket = `${Math.floor(phaseMs.current.assemble / 15000)}:${Math.floor(phaseMs.current.disassemble / 15000)}`;
  useEffect(() => {
    if (!inClass || classPhase !== "running") return;
    labSession.pushProgress({
      mode, platform, partsLeft, mistakes, phaseDone,
      taskId: task?.id ?? null, taskDone: !!taskDone, taskMs: taskDone?.ms ?? 0,
      score: official, scoreScale: outOf, points: scoreInfo.total,
      assemble: scoreInfo.assemble, disassemble: scoreInfo.disassemble, penalty: scoreInfo.penalty,
      assembleMs: Math.round(phaseMs.current.assemble), disassembleMs: Math.round(phaseMs.current.disassemble),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inClass, classPhase, mode, platform, partsLeft, mistakes, phaseDone, scoreRev, timeBucket, taskDone]);

  /* ---------- selection (AR taps) ---------- */
  function trySelect(name) {
    if (gestures.consumeSuppress()) return;
    inspect(name);
    const b = installBlock(name, installed, picks, psuCables);
    if (b) {
      reportEvent("blocked", name, b.msg);
      showHint(b.msg);
      return;
    }
    setSelectedPart(name);
  }

  /* ---------- picking parts (Packet Tracer style drawer) ---------- */
  // A part that is installed can't be swapped; neither can a board with parts on it.
  const lockedSlots = {};
  ALL_PARTS.forEach((s) => {
    if (installed[s]) lockedSlots[s] = "Installed. Take it out in Disassemble mode to swap it.";
  });
  if (!lockedSlots.motherboard && ["cpu", "ram1", "ram2", "storage", "cpu_cooler"].some((s) => installed[s])) {
    lockedSlots.motherboard = "Parts are sitting on this board. Take them off first to swap it.";
  }

  // slot = the bench slot ("cpu", "ram2"...); id = a catalog id, or null for "none" (second RAM stick, GPU)
  function pick(slot, id) {
    if (mode !== "assemble" || exploding) return;
    if (lockedSlots[slot]) return showHint(lockedSlots[slot]);
    if (picks[slot] === id) {
      if (id && cfg.partInfo) setInspectId(id);
      return;
    }
    setPicks((p) => ({ ...p, [slot]: id }));
    setBounce((b) => ({ ...b, [slot]: (b[slot] || 0) + 1 }));
    if (selectedPart === slot) setSelectedPart(null);
    if (!id) {
      reportEvent("pick", slot, `Left out the ${PART_LABEL[slot]}`);
      return showHint(`No ${PART_LABEL[slot]} in this build.`, "success");
    }
    reportEvent("pick", slot, `Picked the ${CATALOG[id].name}`);
    if (cfg.partInfo) setInspectId(id);
    showHint(`${CATALOG[id].name} is on the bench.`, "success");
  }

  // Clicking a part opens its info panel, unless the instructor turned part info off.
  function inspect(name) {
    if (!cfg.partInfo) return;
    const it = itemFor(name, picks);
    if (it) setInspectId(it.id);
  }

  /* ---------- AR ---------- */
  const startAR = async () => {
    setArError("");
    try {
      const session = await startARSession(glRef.current, overlayRef.current);
      sessionRef.current = session;
      session.addEventListener("end", () => {
        sessionRef.current = null;
        setInAR(false);
        setPlacement(null);
        gestures.reset();
      });
      setPlacement(null);
      gestures.reset();
      setInAR(true);
    } catch (err) {
      console.error(err);
      setArError("Couldn't start AR here. Use Chrome on Android, over HTTPS.");
    }
  };

  const startCamAR = async () => {
    setArError("");
    const motionP = requestMotion(); // must be called first, straight from the tap
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setGyro(await motionP);
      setPlacement(null);
      gestures.reset();
      setCamMode(true);
      setPlaceToken((t) => t + 1);
    } catch (err) {
      console.error(err);
      setArError("Camera unavailable. Allow camera access and open the page over HTTPS.");
    }
  };

  const stopCamAR = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamMode(false);
    setGyro(false);
    setPlacement(null);
    gestures.reset();
  };

  const exitAR = () => {
    sessionRef.current?.end();
    stopCamAR();
  };
  const toggleAR = () => (inAR || camMode ? exitAR() : arSupported ? startAR() : startCamAR());

  const resetCamera = (cam) => {
    cam.position.set(...HOME_CAM);
    cam.up.set(0, 1, 0);
    cam.lookAt(...HOME_TARGET);
  };

  // WebXR taps don't trigger R3F onClick, so the ray is cast by hand.
  // Assemble: a part selects it, the green marker places it. Disassemble: a part removes it.
  const pickPart = (origin, dir) => {
    if (gestures.consumeSuppress()) return;
    const root = contentRef.current;
    if (!root || exploding) return;
    raycaster.current.set(origin, dir.normalize());
    for (const h of raycaster.current.intersectObject(root, true)) {
      let o = h.object;
      let id = null;
      while (o && !id) {
        id = o.userData?.partId || null;
        o = o.parent;
      }
      if (!id) continue;
      if (id.startsWith("target:")) {
        const [n, sl] = id.slice(7).split(":");
        install(n, sl === undefined ? undefined : Number(sl));
      } else if (id.startsWith("cable:")) clickCable(id.slice(6));
      else if (id.startsWith("psucable:")) clickPsuCable(id.slice(9));
      else if (id.startsWith("psuport:")) chooseSocket(id.slice(8));
      else if (id.startsWith("psufixed:")) routeFixed(id.slice(9));
      else if (id.startsWith("port:")) choosePort(id.slice(5));
      else if (id.startsWith("screw:")) clickScrew(Number(id.slice(6)));
      else if (mode === "disassemble") uninstall(id);
      else trySelect(id);
      return;
    }
  };

  useEffect(() => {
    if (camMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camMode]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const block = (e) => {
      if (e.target !== el) e.preventDefault();
    };
    el.addEventListener("beforexrselect", block);
    return () => el.removeEventListener("beforexrselect", block);
  }, [setup]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      timers.current.forEach(clearTimeout);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      sessionRef.current?.end();
      document.body.style.cursor = "";
    };
  }, []);

  /* ---------- parts in the scene ---------- */
  const pullable = mode === "disassemble" && !exploding;

  const pull = (name) => ({
    partId: name,
    locked: !!removeBlock(name, installed, power, { cables, screws }),
    onBlocked: () => reportBlocked(name),
    onPull: (worldPos) => uninstall(name, worldPos),
    onTap: () => {
      inspect(name);
      showHint(`Drag the ${PART_LABEL[name]} out to pull it free.`, "success");
    },
    onHoverChange: (h) => setHovered((cur) => (h ? name : cur === name ? null : cur)),
  });
  const onClickInspect = (name) => (e) => {
    e.stopPropagation();
    inspect(name);
  };
  const wrapPull = (name, node) =>
    pullable ? <PullablePart {...pull(name)}>{node}</PullablePart> : <group onClick={onClickInspect(name)}>{node}</group>;

  // each picked option has its own model component (see Three/PartModel.jsx)
  const variantOf = (slot) => itemFor(slot, picks)?.variant ?? 0;

  // The board group is stretched by the board's own fit (L.scale); the parts on it are wrapped in
  // <TrueSize unstretch={unstretch}> so they keep their real proportions instead of stretching with it.
  const unstretch = [1 / L.scale[0], 1 / L.scale[1], 1 / L.scale[2]];
  const moboBody = (
    <group rotation={boardMounted ? MOBO_MOUNTED_ROTATION : MOBO_LYING_ROTATION} scale={L.scale}>
      <PartModel category="motherboard" variant={variantOf("motherboard")} />

      {installed.cpu && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.cpuLocal}>
          {wrapPull(
            "cpu",
            <TrueSize unstretch={unstretch} rotation={[Math.PI / 2, 0, Math.PI]}>
              <PartModel category="cpu" variant={variantOf("cpu")} />
            </TrueSize>
          )}
        </Blast>
      )}

      {installed.cpu && pasteApplied && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.pasteLocal}>
          <TrueSize unstretch={unstretch}>
            <ThermalPaste />
          </TrueSize>
        </Blast>
      )}

      {installed.storage && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.storageLocal}>
          {wrapPull(
            "storage",
            <TrueSize unstretch={unstretch} rotation={STORAGE_MOUNT_ROTATION}>
              <PartModel category="storage" variant={variantOf("storage")} />
            </TrueSize>
          )}
        </Blast>
      )}

      {installed.cpu_cooler && (
        <Blast active={exploding} power={1.3} outZ={-1} position={L.coolerLocal}>
          {wrapPull(
            "cpu_cooler",
            <TrueSize unstretch={unstretch} rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
              <PartModel category="cpu_cooler" variant={variantOf("cpu_cooler")} />
            </TrueSize>
          )}
        </Blast>
      )}

      {installed.ram1 && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.ramSlots[ramSlot.ram1 ?? 0]}>
          {wrapPull(
            "ram1",
            <TrueSize unstretch={unstretch}>
              <PartModel category="ram" variant={variantOf("ram1")} accentColor="#34d399" />
            </TrueSize>
          )}
        </Blast>
      )}

      {installed.ram2 && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.ramSlots[ramSlot.ram2 ?? 1]}>
          {wrapPull(
            "ram2",
            <TrueSize unstretch={unstretch}>
              <PartModel category="ram" variant={variantOf("ram2")} accentColor="#e8a33d" />
            </TrueSize>
          )}
        </Blast>
      )}
    </group>
  );

  // Props for each part waiting on the tray in Assemble mode.
  const trayCfg = {
    motherboard: {
      target: moboTarget, snapPx: 80,
      onPositionChange: (x, y, z) => setMotherboardPos([x, y, z]),
      wrong: "Not quite, line the board up with the standoffs.",
    },
    cpu: { target: cpuTarget, wrong: "Line up the CPU with the socket, check the pin corner." },
    storage: { target: storageTarget, wrong: "The drive needs to sit in its slot on the board." },
    cpu_cooler: { target: coolerTarget, wrong: "The cooler isn't seated on the socket yet." },
    ram1: { target: ram1Free[0], targets: ram1Free, markerRadius: 0.04, wrong: "Check the notch, RAM 1 only fits one way." },
    ram2: { target: ram2Free[0], targets: ram2Free, markerRadius: 0.04, wrong: "Check the notch, RAM 2 only fits one way." },
    psu: { target: psuTarget, wrong: "The PSU needs to sit in the bay, fan facing the side panel." },
    gpu: { target: gpuTarget, wrong: "Line the GPU up with the PCIe slot." },
  };

  // Parts on the bench: picked, and not in the PC.
  const benchParts = ALL_PARTS.filter((p) => !installed[p] && picks[p]);
  const traySub = (name) => itemFor(name, picks)?.short ?? null;

  const renderTrayPart = (name) => {
    const body =
      name === "motherboard" ? moboBody : <TrayModel name={name} item={itemFor(name, picks)} extra={name === "psu" ? <>{psuPanelNode}{fixedCables(true)}</> : null} />;
    if (mode === "disassemble") {
      // Removed parts glide from where they were let go to their tray spot.
      const to = trayPosition(name);
      return (
        <Flyer key={name} from={flights[name] ?? { position: to, rotation: [0, 0, 0] }} to={to}>
          <group onClick={onClickInspect(name)}>{body}</group>
        </Flyer>
      );
    }
    const c = trayCfg[name];
    const isRam = name === "ram1" || name === "ram2";
    const free = name === "ram1" ? ram1Free : ram2Free;
    return (
      <DraggablePart
        key={`${name}:${picks[name]}:${bounce[name] || 0}`}
        trayPosition={trayPosition(name)}
        target={c.target}
        targets={c.targets}
        snapPx={c.snapPx}
        markerRadius={c.markerRadius}
        onPositionChange={c.onPositionChange}
        isClickToPlace={arLike}
        locked={!!installBlock(name, installed, picks, psuCables)}
        isSelected={selectedPart === name}
        onClick={() => trySelect(name)}
        onCorrect={(k) => install(name, isRam ? free[k ?? 0].slot : undefined)}
        onIncorrect={() => miss(name, c.wrong, "miss")}
      >
        <group userData={{ partId: name }} onPointerDown={() => inspect(name)}>{body}</group>
      </DraggablePart>
    );
  };

  /* ---------- control buttons ---------- */
  const modeButton = {
    key: "mode",
    label: cfg.modeControl === "instructor" ? `MODE: ${mode.toUpperCase()}` : mode === "assemble" ? "SWITCH TO DISASSEMBLE" : "SWITCH TO ASSEMBLE",
    color: "#a78bfa",
    disabled: !canToggle,
    dim: !canToggle,
    title:
      cfg.modeControl === "instructor"
        ? "Your instructor controls the mode"
        : !canToggle
        ? "Finish this phase first"
        : cfg.revertPenalty !== "off"
        ? "Undoing recent work costs points"
        : "",
    onPress: toggleMode,
  };

  const buttons = [
    modeButton,
    { key: "tilt", label: isLaidDown ? "STAND UP" : "LAY DOWN", color: "#4f7cff", onPress: () => setIsLaidDown((v) => !v) },
    ...(mode === "assemble"
      ? [
          {
            key: "paste", label: pasteApplied ? "PASTE ✓" : "PASTE", color: "#34d399", lit: pasteApplied,
            dim: !installed.cpu || !!installed.cpu_cooler, onPress: applyPaste,
          },
          {
            key: "cables",
            label: cablesDone ? "CABLES ✓" : "CABLES",
            color: "#f0c419", lit: cableDrawer || !!cableTask, dim: !picks.psu, disabled: exploding,
            title: "Connect the PSU cables",
            onPress: () => {
              setCableTask(null);
              setCableDrawer((o) => !o);
            },
          },
          {
            key: "power", label: monitor.status !== "off" ? "POWER OFF" : "POWER ON", color: "#3ddc84",
            lit: monitor.status !== "off", disabled: exploding, onPress: pressPower,
          },
        ]
      : [
          {
            key: "shutdown",
            label: power.shutdown ? "SHUT DOWN" : monitor.status === "shuttingDown" ? "SHUTTING DOWN…" : "SHUTDOWN",
            color: "#ff9f43", lit: power.shutdown, dim: power.shutdown || monitor.status === "shuttingDown", onPress: doShutdown,
          },
          {
            key: "unplug", label: power.unplugged ? "UNPLUGGED" : "UNPLUG", color: "#f5a524",
            lit: power.unplugged, dim: !power.shutdown && !power.unplugged, onPress: unplug,
          },
          {
            key: "discharge", label: power.discharged ? "DRAINED" : "DRAIN POWER", color: "#f0c419",
            title: "Hold the power button for a few seconds with the cable out",
            lit: power.discharged, dim: !power.unplugged && !power.discharged, onPress: discharge,
          },
          {
            key: "wipe", label: !pasteApplied ? "PASTE WIPED" : "WIPE PASTE", color: "#34d399", lit: !pasteApplied,
            dim: !!installed.cpu_cooler || !installed.cpu, onPress: wipePaste,
          },
        ]),
    {
      key: "reset", label: "RESET", color: "#ff6b6b", disabled: exploding,
      title: inClass ? "Starts the bench over. Your score and time are kept." : "Start over",
      onPress: () => {
        if (inClass) reportEvent("reset", "bench", "Reset the bench");
        resetBuild();
      },
    },
  ];

  /* ---------- render ---------- */
  if (!setup) {
    return (
      <StartScreen
        onPractice={startPractice}
        status={autoJoin === "joining" ? "Opening your lab…" : autoJoin}
        backTo={fromClass ? `/classes/${fromClass}` : null}
      />
    );
  }

  const classLocked = inClass && classPhase !== "running"; // waiting for the instructor, or class over
  const steps = expertSteps(mode, { installed, picks, pasteApplied, booted, power, cables, screws, psuCables });
  // only steps that must happen in order get a "next" highlight (a teardown's parts can go in any order)
  const nextStep = steps.findIndex((s) => !s.done && !s.anyOrder);
  const orderedSteps = steps.filter((s) => !s.anyOrder);
  const anyOrderSteps = steps.filter((s) => s.anyOrder);
  const showPicker = mode === "assemble" && cfg.partPicking === "student" && !classLocked;

  const showMarkers = arLike && mode === "assemble" && selectedPart;

  return (
    <div className="assemble">
      <header className="assemble__bar">
        <Link to={fromClass ? `/classes/${fromClass}?tab=labs` : "/main"} className="assemble__back focus-ring">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Exit Lab
        </Link>

        <div className="assemble__title-group">
          <span className="assemble__badge-sub">
            {inClass
              ? `${mode === "assemble" ? "Assemble" : "Disassemble"} · class ${labSession.code}`
              : `Free build · ${mode === "assemble" ? "Assemble" : "Disassemble"}`}
          </span>
          <h1>Build Lab</h1>
        </div>

        <div className="assemble__actions">
          {scored && (
          <div
            className={`assemble__clock ${factorNow < 1 ? "is-slow" : ""}`}
            title={`Target ${cfg.parMin} min per phase. After that the phase's points slowly drop, down to half at ${cfg.parMin * 3} min.`}
          >
            <span className="assemble__score-label">TIME</span>
            <span className="assemble__clock-value">{formatClock(elapsed)}</span>
            <span className="assemble__clock-factor">{Math.round(factorNow * 100)}%</span>
          </div>
          )}

          <div className="assemble__selection-indicator">
            {mode === "assemble" && arLike && selectedPart ? (
              <>Selected: <strong>{selectedPart.toUpperCase()}</strong> (tap the green marker)</>
            ) : mode === "disassemble" && hovered ? (
              <>{arLike ? "Tap to remove" : "Drag to pull out"}: <strong>{PART_LABEL[hovered].toUpperCase()}</strong></>
            ) : (
              <>Parts left: <strong>{partsLeft}</strong></>
            )}
          </div>

          <button className="assemble__rotate-btn focus-ring" onClick={toggleAR}>
            {inAR || camMode ? "EXIT AR" : "AR"}
          </button>

          {scored && (
          <div className="assemble__score-card-wrapper">
            <div
              className="assemble__score-card"
              title={`Official score ${official} out of ${outOf}. Points for the task: ${officialCard[taskMode]} of ${maxPts} (${Math.round(officialCard.factor[taskMode] * 100)}% for time) · Penalties -${scoreInfo.penalty} · Mistakes ${mistakes}`}
            >
              <span className="assemble__score-label">SCORE</span>
              <span className="assemble__score-value">{official}<small className="assemble__score-max">/{outOf}</small></span>
            </div>
            <div className="assemble__popup-container">
              {popups.map((p) => (
                <span key={p.id} className={`assemble__floating-popup assemble__floating-popup--${p.type}`}>{p.points}</span>
              ))}
            </div>
          </div>
          )}
        </div>
      </header>

      <div className="assemble__viewport">
        <div className="assemble__scene-container">
          <div style={{ position: "relative", width: "100%", height: "100%", background: camMode ? "transparent" : "#d9dbe0" }}>
            {camMode && (
              <video
                ref={videoRef} playsInline muted autoPlay
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
              />
            )}

            <Canvas
              style={{ position: "absolute", inset: 0, zIndex: 1, touchAction: "none" }}
              dpr={[1, 2]}
              gl={{ alpha: true, antialias: true }}
              camera={{ position: HOME_CAM, fov: 45 }}
              onCreated={({ gl }) => gl.setClearAlpha(0)}
            >
              <ARContext.Provider value={arLike}>
                <GLBridge glRef={glRef} />
                {!arLike && <CameraFocus focus={cableFocus} home={HOME_VIEW} />}
                <ambientLight intensity={2.0} />
                <hemisphereLight skyColor="#ffffff" groundColor="#666666" intensity={1.2} />
                <directionalLight position={[6, 8, 6]} intensity={2.4} />
                <directionalLight position={[-6, 4, -4]} intensity={1.6} />
                <Environment resolution={256}>
                  <Lightformer form="rect" intensity={4} position={[0, 5, 5]} scale={[10, 6, 1]} />
                  <Lightformer form="rect" intensity={3} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 5, 1]} />
                  <Lightformer form="rect" intensity={3} position={[5, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 5, 1]} />
                </Environment>

                <ARRoot
                  inAR={arLike} placement={placement} focused={false} scaleBase={AR_SCALE}
                  caseHeight={0} focusScale={1} rigCenterY={0} rigApi={rigApi}
                >
                  <GestureGroup api={gestures} pivotY={0} active={arLike}>
                    <group ref={contentRef}>
                      <Suspense key={buildId} fallback={<BenchLoadingFallback />}>
                        <Workbench />

                        {/* name tags (hidden while a cable is connected: the camera is up close then) */}
                        {!cableTask && benchParts.map((name) => (
                          <TrayLabel key={name} name={name} text={PART_LABEL[name]} sub={traySub(name)} />
                        ))}

                        <CaseRig laidDown={isLaidDown} pose={casePose}>
                          <CaseWithMeasure onMeasure={handleCaseMeasured} />
                          {caseBox && <CaseFans box={caseBox} />}

                          {installed.motherboard && (
                            <Blast active={exploding} power={0.8} position={MOTHERBOARD_TARGET.position}>
                              {wrapPull("motherboard", moboBody)}
                            </Blast>
                          )}

                          {installed.psu && (
                            <Blast active={exploding} power={1} position={PSU_TARGET.position} rotation={PSU_TARGET.rotation}>
                              {wrapPull(
                                "psu",
                                <group>
                                  <PartModel category="psu" variant={variantOf("psu")} />
                                  {psuPanelNode}
                                  {fixedCables(false)}
                                </group>
                              )}
                            </Blast>
                          )}

                          {/* motherboard screws, at this board's 9 ATX holes */}
                          {installed.motherboard &&
                            !exploding &&
                            L.holes.map(([x, y], i) => (
                              <BoardScrew
                                key={`screw${i}`}
                                partId={`screw:${i}`}
                                position={[x, y, L.pcbFront]}
                                rotation={[Math.PI / 2, 0, 0]}
                                driven={screws[i]}
                                waiting={mode === "assemble" ? !screws[i] : screws[i] && power.discharged}
                                onClick={() => clickScrew(i)}
                              />
                            ))}

                          {/* the cables' part ends, each with a see-through guide wire back to the PSU */}
                          {installed.psu &&
                            !exploding &&
                            CABLE_IDS.map((c) => {
                              const pose = cablePose(c);
                              if (!pose) return null;
                              return (
                                <group key={`cable-${c}`}>
                                  <CableRun points={pose.ghost} radius={0.012} color={GHOST_COLOR[c]} ghost />
                                  <CablePlug
                                    type={STUB_TYPE[c]} partId={`cable:${c}`}
                                    position={pose.pos} rotation={pose.rot}
                                    plugged={pose.seated} flipped={pose.flipped}
                                    waiting={cableWaiting(c)}
                                    onClick={() => clickCable(c)}
                                  />
                                </group>
                              );
                            })}

                          {/* while connecting: every open header lights up; then the clip's tab shows */}
                          {cableTask?.end === "part" && !cableTask.port &&
                            CABLE_IDS.filter((p) => portOpen(p) && !cables[p]).map((p) => (
                              <PortMarker
                                key={`port-${p}`} partId={`port:${p}`}
                                position={[portPos[p][0], portPos[p][1], portPos[p][2] + 0.03]}
                                label={hintsOn ? PORT_LABEL[p] : null}
                                onClick={() => choosePort(p)}
                              />
                            ))}
                          {cableTask?.end === "part" && cableTask.port && <LatchTab position={latchTab(cableTask.port)} />}

                          {installed.gpu && (
                            <Blast active={exploding} power={1.1} position={L.gpu} rotation={GPU_TARGET.rotation}>
                              {wrapPull("gpu", <PartModel category="gpu" variant={variantOf("gpu")} spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />)}
                            </Blast>
                          )}
                        </CaseRig>

                        {benchParts.map(renderTrayPart)}

                        {showMarkers &&
                          (selectedPart === "ram1" || selectedPart === "ram2") &&
                          (selectedPart === "ram1" ? ram1Free : ram2Free).map((t) => (
                            <TargetMarker
                              key={t.slot} name={`${selectedPart}:${t.slot}`} pose={t} radius={0.04}
                              onPlace={() => install(selectedPart, t.slot)}
                            />
                          ))}
                        {showMarkers && selectedPart !== "ram1" && selectedPart !== "ram2" && targetOf[selectedPart] && (
                          <TargetMarker name={selectedPart} pose={targetOf[selectedPart]} onPlace={() => install(selectedPart)} />
                        )}
                      </Suspense>

                      <Suspense fallback={null}>
                        <MonitorStation monitor={monitor} userName={userName} />
                      </Suspense>
                    </group>
                  </GestureGroup>
                </ARRoot>

                <ARHitTest active={inAR} placed={!!placement} onPlace={setPlacement} onRay={pickPart} />
                <CamAR active={arLite} placeToken={placeToken} onPlace={setPlacement} restore={resetCamera} />

                {!arLite && (
                  <OrbitControls
                    makeDefault enabled={!inAR} target={HOME_TARGET} enableDamping dampingFactor={0.08}
                    minDistance={1} maxDistance={25} maxPolarAngle={Math.PI / 2.05}
                  />
                )}
              </ARContext.Provider>
            </Canvas>
          </div>
        </div>

        {/* Overlay (also the WebXR dom-overlay root). Receives touches in AR for the gesture hook. */}
        <div
          ref={overlayRef}
          style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: arLike ? "auto" : "none", touchAction: "none" }}
        >
          {arLike && (
            <>
              <div style={{ ...pill, top: 12, fontWeight: 700 }}>{scored ? `SCORE ${official}/${outOf} · ` : ""}PARTS LEFT {partsLeft}</div>
              <div style={{ ...pill, top: 52, maxWidth: "60%" }}>
                {mode === "disassemble"
                  ? "Tap a part to remove it"
                  : selectedPart
                  ? `Selected ${selectedPart.toUpperCase()}: tap the green marker`
                  : "Tap a part to pick it up"}
              </div>
            </>
          )}

          {inAR && !placement && (
            <div style={{ position: "absolute", bottom: 90, left: 12, right: 12, textAlign: "center", color: "#fff", background: "rgba(15,23,42,0.85)", padding: "8px 12px", borderRadius: 12, fontSize: 14 }}>
              Move your phone slowly to find a flat surface, then tap the ring to place the bench.
            </div>
          )}

          {arLike && (placement || arLite) && (
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, textAlign: "center", color: "#cbd5e1", fontSize: 12, pointerEvents: "none" }}>
              Drag to spin · pinch to resize · twist to rotate
            </div>
          )}

          {arError && (
            <div style={{ position: "absolute", top: 56, left: 12, right: 12, textAlign: "center", color: "#fff", background: "rgba(153,27,27,0.92)", padding: "8px 12px", borderRadius: 12, fontSize: 14 }}>
              {arError}
            </div>
          )}

          {showPicker && (
            <div style={{ pointerEvents: "auto" }}>
              <PartPicker
                picks={picks}
                locked={lockedSlots}
                showSpecs={cfg.partInfo}
                onPick={pick}
                onInspect={(id) => setInspectId(id)}
              />
            </div>
          )}

          {cableDrawer && mode === "assemble" && !classLocked && (
            <div style={{ pointerEvents: "auto" }}>
              <CableDrawer
                cables={cables} psuCables={psuCables} installed={installed} picks={picks} active={cableTask?.cable}
                besidePicker={showPicker}
                onPick={startCable} onClose={() => setCableDrawer(false)}
              />
            </div>
          )}

          {cableTask && mode === "assemble" && !classLocked && (
            <section className={`cable-task ${showPicker ? "is-beside-picker" : ""}`} aria-live="polite" style={{ pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
              <span className="cable-task__step">
                {CABLES[cableTask.cable].label} ·{" "}
                {cableTask.end === "psu" && isFixed(cableTask.cable) ? "route it out" : `${cableTask.end === "psu" ? "PSU end" : "part end"} · step ${cableTask.port ? 2 : 1} of 2`}
              </span>
              {cableTask.port ? (
                <p>
                  Line the clip up with the yellow tab on the {cableTask.end === "psu" ? "socket" : "header"}, then push it in.
                  {hintsOn && (cableTask.flipped ? " The clip is facing away from the tab right now." : " The clip is over the tab.")}
                </p>
              ) : cableTask.end === "psu" && isFixed(cableTask.cable) ? (
                <p>
                  This cable is fixed to the PSU. {arLike ? "Tap" : "Click"} this cable in the bundle in front of the PSU to
                  route it out. Check the plug on its end.
                  {hintsOn && ` The ${CABLES[cableTask.cable].label} has the ${PLUG_LOOK[cableTask.cable]}.`}
                </p>
              ) : cableTask.end === "psu" ? (
                <p>
                  {arLike ? "Tap" : "Click"} the socket on the PSU this cable goes into. Read the labels printed on the PSU.
                  {hintsOn && ` Look for ${psuPanel?.sockets[CABLES[cableTask.cable].psuSocket]?.label}.`}
                </p>
              ) : (
                <p>
                  {arLike ? "Tap" : "Click"} the header this cable plugs into.
                  {hintsOn && ` It goes into ${PORT_WHERE[cableTask.cable]}.`}
                </p>
              )}
              <div className="cable-task__actions">
                {cableTask.port && (
                  <>
                    <button type="button" onClick={turnPlug}>Turn plug</button>
                    <button type="button" className="is-primary" onClick={pushPlug}>Push in</button>
                  </>
                )}
                {cableTask.port && (
                  <button type="button" onClick={() => setCableTask((t) => ({ ...t, port: null }))}>
                    {cableTask.end === "psu" ? "Pick another socket" : "Pick another header"}
                  </button>
                )}
                <button type="button" onClick={() => setCableTask(null)}>Cancel</button>
              </div>
            </section>
          )}

          {cfg.partInfo && inspectId && (
            <div style={{ pointerEvents: "auto" }}>
              <PartInfoPanel itemId={inspectId} mode={mode} onClose={() => setInspectId(null)} />
            </div>
          )}

          {!classLocked && (
            <div style={{ pointerEvents: "auto" }}>
              <ControlPanel buttons={buttons} />
            </div>
          )}

          {(task || hintsOn) && !classLocked && !arLike && (
            <section
              className={`lab-task ${taskOpen ? "is-open" : ""} ${taskDone ? "is-done" : ""}`}
              aria-label={task ? "Your task" : "Steps"}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button type="button" className="lab-task__head" aria-expanded={taskOpen} onClick={() => setTaskOpen((o) => !o)}>
                <span className="lab-task__tag">
                  {task ? (taskDone ? "Task done ✓" : "Your task") : mode === "assemble" ? "How experts build it" : "Safety first, then any order"}
                </span>
                <strong>{task ? task.title : `${steps.filter((s) => s.done).length} of ${steps.length} steps done`}</strong>
                <span className="lab-task__chev" aria-hidden="true">{taskOpen ? "–" : "+"}</span>
              </button>
              {taskOpen && (
                <div className="lab-task__body">
                  {task?.instructions && <p className="lab-task__text">{task.instructions}</p>}
                  {hintsOn && (
                    <>
                      <ol className="lab-steps">
                        {orderedSteps.map((s) => (
                          <li key={s.label} className={s.done ? "is-done" : steps.indexOf(s) === nextStep ? "is-next" : ""}>
                            {s.label}
                          </li>
                        ))}
                      </ol>
                      {anyOrderSteps.length > 0 && (
                        <>
                          <p className="lab-steps__note">Then take parts out in any order, as long as nothing is in the way:</p>
                          <ul className="lab-steps lab-steps--any">
                            {anyOrderSteps.map((s) => (
                              <li key={s.label} className={s.done ? "is-done" : ""}>{s.label}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                  {task && (
                  <ul className="lab-task__chips">
                    <li>{task.mode === "assemble" ? "Build it and power it on" : "Shut down, unplug, take every part out"}</li>
                    <li>{PLATFORM_LABEL[task.platform]} parts</li>
                    <li>Target {task.parMin} min</li>
                  </ul>
                  )}
                  {taskDone && (
                    <p className="lab-task__done">
                      Finished in {formatClock(taskDone.ms)} · score {official}/{outOf}. Your instructor can see your result.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {classLocked && (
            <div className="lab-gate" role="dialog" aria-label={classPhase === "ended" ? "Class ended" : "Waiting for the class to start"}>
              {classPhase === "ended" ? (
                <>
                  <h2>Class ended</h2>
                  <p>Your instructor closed the class. Your results are saved.</p>
                  <div className="lab-gate__score">
                    <span>Final score</span>
                    <strong>{official}/{outOf}</strong>
                    <small>
                      {officialCard[taskMode]} of {maxPts} points · Penalties -{scoreInfo.penalty} · {mistakes} mistakes
                    </small>
                  </div>
                </>
              ) : (
                <>
                  <h2>Waiting for your instructor</h2>
                  <p>
                    You're in class <strong>{labSession.code}</strong>. The clock starts when the instructor starts the class.
                  </p>
                  {task && (
                    <div className="lab-gate__task">
                      <span>Your task</span>
                      <strong>{task.title}</strong>
                      {task.instructions && <p>{task.instructions}</p>}
                    </div>
                  )}
                </>
              )}
              <button type="button" className="flow-btn flow-btn--tool focus-ring" onClick={leaveClass}>Leave class</button>
            </div>
          )}

          {(inAR || camMode) && (
            <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, pointerEvents: "auto" }}>
              {(inAR && placement) && (
                <button type="button" className="flow-btn flow-btn--tool" onClick={() => { setPlacement(null); gestures.reset(); }}>Move</button>
              )}
              {arLite && (
                <button type="button" className="flow-btn flow-btn--tool" onClick={() => { setPlaceToken((t) => t + 1); gestures.reset(); }}>Move</button>
              )}
              <button type="button" className="flow-btn flow-btn--tool" onClick={exitAR}>Exit AR</button>
            </div>
          )}

          {phaseDone && cfg.autoPrompt && !promptDismissed && (
            <div
              role="dialog"
              aria-label="Phase complete"
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", padding: "24px 32px", borderRadius: 16, background: "rgba(15, 23, 42, 0.92)", color: "#fff", textAlign: "center", pointerEvents: "auto", maxWidth: 340 }}
            >
              <h2 style={{ margin: 0 }}>
                {task && taskDone && mode === task.mode ? "Task complete!" : mode === "disassemble" ? "Teardown complete!" : "Build complete!"}
              </h2>
              <p style={{ margin: "8px 0 16px" }}>
                {mode === "disassemble" ? "Every part is on the bench." : "The PC booted."}
                {scored ? <> Score so far: <strong>{official}/{outOf}</strong></> : " Nice work."}
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {cfg.modeControl === "student" && (
                  <button type="button" className="flow-btn flow-btn--tool focus-ring" onClick={() => forceMode(mode === "disassemble" ? "assemble" : "disassemble")}>
                    {mode === "disassemble" ? "Start rebuilding" : "Take it apart"}
                  </button>
                )}
                <button type="button" className="flow-btn flow-btn--tool focus-ring" onClick={() => setPromptDismissed(true)}>Stay here</button>
              </div>
            </div>
          )}

          {feedback && (
            <div className={`assemble__toast assemble__toast--${feedback.type}`} role="status" aria-live="polite">
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}