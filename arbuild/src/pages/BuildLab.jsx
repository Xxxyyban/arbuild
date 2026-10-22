import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { useAuth } from "../context/AuthContext";
import MotherboardModel from "../Three/MotherboardModel";
import RAMModel from "../Three/RAMModel";
import CPUModel from "../Three/CPUModel";
import PSUModel from "../Three/PSUModel";
import GPUModel from "../Three/GPUModel";
import CPUCoolerModel from "../Three/CPUCoolerModel";
import StorageModel from "../Three/StorageModel";
import DraggablePart from "../Three/DraggablePart";
import PullablePart from "../Three/PullablePart";
import { ARContext } from "../Three/xrSetup";
import { GLBridge, ARHitTest, ARRoot, CamAR, useARSupport, startARSession, requestMotion } from "../Three/ar/ARTools";
import { useARGestures, GestureGroup } from "../Three/ar/ARGestures";
import {
  CaseWithMeasure, CaseRig, CaseFans, Workbench, TrayLabel, BenchLoadingFallback,
  ThermalPaste, TrayModel, TargetMarker, Blast, Flyer,
} from "../components/lab/BenchScene";
import MonitorStation from "../components/lab/MonitorStation";
import StartScreen from "../components/lab/StartScreen";
import PartPicker from "../components/lab/PartPicker";
import PartInfoPanel from "../components/lab/PartInfoPanel";
import {
  ALL_PARTS, PART_LABEL, trayPosition, toWorldPose, addRotatedOffset, moboLocalToWorld,
  MOTHERBOARD_TARGET, PSU_TARGET, GPU_TARGET, MOBO_LYING_ROTATION, MOBO_MOUNTED_ROTATION, MOBO_SCALE,
  RAM_SCALE, RAM_SLOTS_LOCAL, CPU_OFFSET, CPU_LOCAL, PASTE_LOCAL, COOLER_OFFSET, STORAGE_OFFSET,
  STORAGE_LOCAL, STORAGE_MOUNT_ROTATION, STORAGE_FLIP_ROTATION, STORAGE_DIMS,
  COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z,
  LAY_ANGLE, LAY_CENTER, AR_SCALE, HOME_CAM, HOME_TARGET,
} from "../lab/Constants";
import { installBlock, removeBlock, evaluateBoot, isFullyBuilt, isFullyStripped } from "../lab/Rules";
import { POINTS, basePoints, actionPoints, ledgerKey, timedScore, timeFactor, revertPenalty } from "../lab/Scoring";
import { DEFAULT_SETUP, normalizeSetup, buildStart, setupFromUrl } from "../lab/Setup";
import { createReporter, MISTAKE_TYPES } from "../lab/reportEvent";
import { CATALOG, CATEGORIES, PLATFORM_LABEL, categoryOf, itemFor, fitBlock } from "../lab/Catalog";
import { studentSetup, formatClock } from "../lab/Sessions";
import { useLabSession } from "../lab/useLabSession";
import "../styles/BuildLab.css";
import "../styles/BuildLabParts.css";

const OVERHEAT = { helloMs: 5000, loadMinMs: 3000, loadMaxMs: 5000, bsodMs: 3000, blastMs: 2200, explodeAfterBsod: true };
const SHUTDOWN_DURATION = 1800;
const SAFETY_NOTE = "Shut it down, then unplug it, before touching any part.";
const HINT_HIDDEN = "That didn't work. Think about what is missing.";
// After an explosion: everything back on the bench, the picked parts stay picked.
const EMPTY_BUILD = { mode: "assemble", installed: {}, pasteApplied: false, ramSlot: { ram1: null, ram2: null } };
const PHASE_ZERO = { assemble: 0, disassemble: 0 };

// Power + screen state for a starting build.
function powerAndMonitor(s) {
  if (s.mode !== "disassemble") return { power: { shutdown: false, unplugged: false }, monitor: { status: "off" } };
  const boot = evaluateBoot(s);
  if (boot.status === "hello") {
    return { power: { shutdown: false, unplugged: false }, monitor: { status: "hello", lowRes: boot.lowRes, note: SAFETY_NOTE } };
  }
  return { power: { shutdown: true, unplugged: false }, monitor: { status: "off" } };
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
  const [bounce, setBounce] = useState({}); // part -> count, remounts a part that didn't fit so it returns to the bench
  const [popups, setPopups] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [buildId, setBuildId] = useState(0);
  const [isLaidDown, setIsLaidDown] = useState(true);
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
  const hintsOn = cfg.hints;
  const platform = cfg.platform;
  const parMs = cfg.parMin * 60000;
  const scoreInfo = timedScore(ledger.current, penalty.current, phaseMs.current, parMs);

  const rig = useMemo(() => ({ laidDown: isLaidDown, position: casePose ?? [0, 0, 0] }), [isLaidDown, casePose]);

  const handleCaseMeasured = useCallback((box) => {
    setCaseBox(box.clone());
    const rb = box.clone().applyMatrix4(new THREE.Matrix4().makeRotationX(LAY_ANGLE));
    const c = rb.getCenter(new THREE.Vector3());
    setCasePose([LAY_CENTER[0] - c.x, -rb.min.y, LAY_CENTER[1] - c.z]);
  }, []);

  /* ---------- where each part sits right now (world pose) ---------- */
  const UPRIGHT = [0, Math.PI, 0];
  const boardMounted = !!installed.motherboard;
  const moboTarget = useMemo(() => toWorldPose(MOTHERBOARD_TARGET.position, MOTHERBOARD_TARGET.rotation, rig), [rig]);
  const psuTarget = useMemo(() => toWorldPose(PSU_TARGET.position, PSU_TARGET.rotation, rig), [rig]);
  const gpuTarget = useMemo(() => toWorldPose(GPU_TARGET.position, GPU_TARGET.rotation, rig), [rig]);
  const cpuTarget = useMemo(
    () =>
      boardMounted
        ? toWorldPose(addRotatedOffset(MOTHERBOARD_TARGET.position, CPU_OFFSET, Math.PI), UPRIGHT, rig)
        : { position: moboLocalToWorld(motherboardPos, CPU_LOCAL, MOBO_LYING_ROTATION), rotation: [0, Math.PI, 0] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig]
  );
  const storageTarget = useMemo(
    () =>
      boardMounted
        ? toWorldPose(addRotatedOffset(MOTHERBOARD_TARGET.position, STORAGE_OFFSET, Math.PI), UPRIGHT, rig)
        : { position: moboLocalToWorld(motherboardPos, STORAGE_LOCAL, MOBO_LYING_ROTATION), rotation: [0, Math.PI, 0] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [motherboardPos, boardMounted, rig]
  );
  const coolerTarget = useMemo(
    () => toWorldPose(addRotatedOffset(MOTHERBOARD_TARGET.position, COOLER_OFFSET, Math.PI), UPRIGHT, rig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rig]
  );
  const ramTargets = useMemo(
    () => RAM_SLOTS_LOCAL.map((l) => toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, l, MOBO_MOUNTED_ROTATION), UPRIGHT, rig)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rig]
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
    const shown = Math.round(gain * timeFactor(phaseMs.current[key.split(":")[0]] ?? 0, parMs));
    if (gain > 0) triggerPopup(`+${shown}`, "success");
    showHint(message, "success");
    if (part) reportEvent("success", part, message, gain);
  }

  function deduct(points, message) {
    penalty.current += points;
    syncScore();
    triggerPopup(`-${points}`, "fail");
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
  const blockType = (key) => (key === "shutdown" || key === "unplug" ? "safety" : "blocked");

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
    if (cfg.revertPenalty === "off") return;
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
    // the picked part may not match the board or the work order: it doesn't go in
    const fit = fitBlock(name, picks, platform);
    if (fit) {
      miss(name, fit.msg, "compat", fit.vague);
      bounceBack(name);
      return;
    }
    settleRevert(name);
    const k = ledgerKey(mode, name);
    let flawed = (misses.current[k] || 0) > 0;

    if (name === "motherboard") setMotherboardPos(MOTHERBOARD_TARGET.position);
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

    const b = removeBlock(name, installed, power);
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
    const b = removeBlock(name, installed, power);
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
    award(k, actionPoints(POINTS.unplug, misses.current[k] || 0), "Power unplugged. Safe to work on the PC.", "unplug");
  }

  function wipePaste() {
    if (!power.unplugged) {
      const key = !power.shutdown ? "shutdown" : "unplug";
      return miss(key, !power.shutdown ? "Shut down and unplug the PC first." : "Unplug the PC from power first.", "safety");
    }
    if (!installed.cpu) return showHint("The CPU is already out, wipe the paste before pulling it.");
    if (installed.cpu_cooler) return showHint("Remove the CPU cooler to reach the paste.");
    if (!pasteApplied) return showHint("The old paste is already wiped off.", "success");
    setPasteApplied(false);
    award(ledgerKey("disassemble", "paste"), actionPoints(POINTS.paste, 0), "Old thermal paste wiped clean.", "paste");
  }

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
    setPower({ shutdown: false, unplugged: false }); // powering on plugs it back in
    const result = evaluateBoot({ installed, pasteApplied, ramSlot, picks }, { hints: hintsOn });
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
        const message = lowRes
          ? "Booted on integrated graphics. Add a GPU for more points."
          : result.ramCount === 2
          ? "System booted. Build complete!"
          : "System booted. Add a second RAM stick for more points.";
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
    setIsLaidDown(true);
    actionLog.current = {};
    revertCount.current = {};
    setBuildId((b) => b + 1);
  }

  function switchMode(next) {
    clearTimers();
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
        setPower({ shutdown: true, unplugged: false });
      }
    } else {
      setMonitor({ status: "off" });
      setPower({ shutdown: false, unplugged: false });
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

  // Looks the code up in Firestore. The session effects below load this student's setup.
  async function joinWithCode(code) {
    const res = await labSession.join(code);
    return res.error || null;
  }

  /* ---------- class session ---------- */
  const inClass = !!labSession.code;
  const classPhase = labSession.phase; // null (practice) | "waiting" | "running" | "ended"
  const assigned = inClass && labSession.session ? studentSetup(labSession.session, labSession.me) : null;
  const assignKey = assigned ? `${assigned.startMode}|${assigned.platform}` : null;
  const lastAssign = useRef(null);

  // The instructor's assignment (start mode + platform) restarts the student on it.
  // Every other class setting (hints, part info, target time...) applies straight away.
  useEffect(() => {
    if (!assigned) return;
    if (assignKey !== lastAssign.current) {
      const first = lastAssign.current === null;
      lastAssign.current = assignKey;
      setSetup(assigned);
      resetBuild(assigned, { keepScore: false });
      if (!first) showHint(`Your instructor changed your task: ${assigned.startMode} an ${PLATFORM_LABEL[assigned.platform]} PC.`, "success");
    } else {
      setSetup(assigned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignKey, JSON.stringify(labSession.session?.setup)]);

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
    phaseActions > 0 && (mode === "disassemble" ? isFullyStripped(installed) : isFullyBuilt(installed) && booted);
  const canToggle =
    cfg.modeControl === "student" && (cfg.toggle === "free" || (cfg.toggle === "afterComplete" && phaseDone));
  const partsLeft = ALL_PARTS.filter((p) => (mode === "assemble" ? !installed[p] : installed[p])).length;

  useEffect(() => {
    if (phaseDone) commitOpenActions(); // finishing a phase locks in its actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseDone]);

  /* ---------- phase clock: counts up, slower work keeps fewer points ---------- */
  const clockOn = !!setup && !phaseDone && (!inClass || classPhase === "running");
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
      score: scoreInfo.total, assemble: scoreInfo.assemble, disassemble: scoreInfo.disassemble, penalty: scoreInfo.penalty,
      assembleMs: Math.round(phaseMs.current.assemble), disassembleMs: Math.round(phaseMs.current.disassemble),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inClass, classPhase, mode, platform, partsLeft, mistakes, phaseDone, scoreRev, timeBucket]);

  /* ---------- selection (AR taps) ---------- */
  function trySelect(name) {
    if (gestures.consumeSuppress()) return;
    inspect(name);
    const b = installBlock(name, installed, picks);
    if (b) {
      reportEvent("blocked", name, b.msg);
      showHint(b.msg);
      return;
    }
    setSelectedPart(name);
  }

  /* ---------- picking parts (Packet Tracer style drawer) ---------- */
  const lockedCats = {};
  CATEGORIES.forEach((c) => {
    if (c.slots.some((s) => installed[s])) lockedCats[c.id] = "Installed. Take it out in Disassemble mode to swap it.";
  });
  if (!lockedCats.motherboard && (installed.cpu || installed.storage)) {
    lockedCats.motherboard = "The CPU or SSD is sitting on this board. Take them off first to swap it.";
  }

  function pick(category, id) {
    if (mode !== "assemble" || exploding) return;
    if (lockedCats[category]) return showHint(lockedCats[category]);
    if (picks[category] === id) {
      if (cfg.partInfo) setInspectId(id);
      return;
    }
    const slots = CATEGORIES.find((c) => c.id === category).slots;
    setPicks((p) => ({ ...p, [category]: id }));
    setBounce((b) => Object.fromEntries([...Object.entries(b), ...slots.map((s) => [s, (b[s] || 0) + 1])]));
    if (slots.includes(selectedPart)) setSelectedPart(null);
    reportEvent("pick", category, `Picked the ${CATALOG[id].name}`);
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
      } else if (mode === "disassemble") uninstall(id);
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
    locked: !!removeBlock(name, installed, power),
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

  const boardItem = itemFor("motherboard", picks);
  const cpuItem = itemFor("cpu", picks);

  const moboBody = (
    <group rotation={boardMounted ? MOBO_MOUNTED_ROTATION : MOBO_LYING_ROTATION} scale={MOBO_SCALE}>
      <MotherboardModel path={boardItem?.model} />

      {installed.cpu && (
        <Blast active={exploding} power={1.2} outZ={-1} position={CPU_LOCAL} rotation={[Math.PI / 2, 0, Math.PI]}>
          {wrapPull("cpu", <CPUModel path={cpuItem?.model} />)}
        </Blast>
      )}

      {installed.cpu && pasteApplied && (
        <Blast active={exploding} power={1.2} outZ={-1} position={PASTE_LOCAL}>
          <ThermalPaste />
        </Blast>
      )}

      {installed.storage && (
        <Blast active={exploding} power={1.2} outZ={-1} position={STORAGE_LOCAL} rotation={STORAGE_MOUNT_ROTATION}>
          {wrapPull(
            "storage",
            <group rotation={STORAGE_FLIP_ROTATION}>
              <StorageModel {...STORAGE_DIMS} />
            </group>
          )}
        </Blast>
      )}

      {installed.cpu_cooler && (
        <Blast
          active={exploding} power={1.3} outZ={-1}
          position={[-COOLER_OFFSET[0], COOLER_OFFSET[1], -COOLER_OFFSET[2]]}
          rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}
        >
          {wrapPull("cpu_cooler", <CPUCoolerModel />)}
        </Blast>
      )}

      {installed.ram1 && (
        <Blast active={exploding} power={1.2} outZ={-1} position={RAM_SLOTS_LOCAL[ramSlot.ram1 ?? 0]}>
          {wrapPull(
            "ram1",
            <group scale={RAM_SCALE}>
              <RAMModel accentColor="#4fd8c9" />
            </group>
          )}
        </Blast>
      )}

      {installed.ram2 && (
        <Blast active={exploding} power={1.2} outZ={-1} position={RAM_SLOTS_LOCAL[ramSlot.ram2 ?? 1]}>
          {wrapPull(
            "ram2",
            <group scale={RAM_SCALE}>
              <RAMModel accentColor="#e8a33d" />
            </group>
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
  const benchParts = ALL_PARTS.filter((p) => !installed[p] && picks[categoryOf(p)]);
  const trayText = (name) => {
    const it = itemFor(name, picks);
    return it ? `${PART_LABEL[name]} · ${it.short}` : PART_LABEL[name];
  };

  const renderTrayPart = (name) => {
    const body = name === "motherboard" ? moboBody : <TrayModel name={name} item={itemFor(name, picks)} />;
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
        key={`${name}:${picks[categoryOf(name)]}:${bounce[name] || 0}`}
        trayPosition={trayPosition(name)}
        target={c.target}
        targets={c.targets}
        snapPx={c.snapPx}
        markerRadius={c.markerRadius}
        onPositionChange={c.onPositionChange}
        isClickToPlace={arLike}
        locked={!!installBlock(name, installed, picks)}
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
            key: "paste", label: pasteApplied ? "PASTE ✓" : "PASTE", color: "#4fd8c9", lit: pasteApplied,
            dim: !installed.cpu || !!installed.cpu_cooler, onPress: applyPaste,
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
            key: "wipe", label: !pasteApplied ? "PASTE WIPED" : "WIPE PASTE", color: "#4fd8c9", lit: !pasteApplied,
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
  if (!setup) return <StartScreen onPractice={startPractice} onJoin={joinWithCode} />;

  const classLocked = inClass && classPhase !== "running"; // waiting for the instructor, or class over
  const showPicker = mode === "assemble" && cfg.partPicking === "student" && !classLocked;

  const showMarkers = arLike && mode === "assemble" && selectedPart;

  return (
    <div className="assemble">
      <header className="assemble__bar">
        <Link to="/main" className="assemble__back focus-ring">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Exit Lab
        </Link>

        <div className="assemble__title-group">
          <span className="assemble__badge-sub">
            {mode === "assemble" ? "Assemble" : "Disassemble"} · {PLATFORM_LABEL[platform]} work order
            {inClass ? ` · class ${labSession.code}` : ""}
          </span>
          <h1>Build Lab</h1>
        </div>

        <div className="assemble__actions">
          <div
            className={`assemble__clock ${factorNow < 1 ? "is-slow" : ""}`}
            title={`Target ${cfg.parMin} min per phase. After that the phase's points slowly drop, down to half at ${cfg.parMin * 3} min.`}
          >
            <span className="assemble__score-label">TIME</span>
            <span className="assemble__clock-value">{formatClock(elapsed)}</span>
            <span className="assemble__clock-factor">{Math.round(factorNow * 100)}%</span>
          </div>

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

          <div className="assemble__score-card-wrapper">
            <div
              className="assemble__score-card"
              title={`Disassemble ${scoreInfo.disassemble} (${Math.round(scoreInfo.factor.disassemble * 100)}% for time) · Assemble ${scoreInfo.assemble} (${Math.round(scoreInfo.factor.assemble * 100)}% for time) · Penalties -${scoreInfo.penalty} · Mistakes ${mistakes}`}
            >
              <span className="assemble__score-label">SCORE</span>
              <span className="assemble__score-value">{scoreInfo.total}</span>
            </div>
            <div className="assemble__popup-container">
              {popups.map((p) => (
                <span key={p.id} className={`assemble__floating-popup assemble__floating-popup--${p.type}`}>{p.points}</span>
              ))}
            </div>
          </div>
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

                        {benchParts.map((name) => (
                          <TrayLabel key={name} name={name} text={trayText(name)} />
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
                            <Blast active={exploding} power={1} position={PSU_TARGET.position} rotation={PSU_TARGET.rotation}>                              {wrapPull("psu", <PSUModel />)}
                            </Blast>
                          )}

                          {installed.gpu && (
                            <Blast active={exploding} power={1.1} position={GPU_TARGET.position} rotation={GPU_TARGET.rotation}>
                              {wrapPull("gpu", <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />)}
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
              <div style={{ ...pill, top: 12, fontWeight: 700 }}>SCORE {scoreInfo.total} · PARTS LEFT {partsLeft}</div>
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
                locked={lockedCats}
                showSpecs={cfg.partInfo}
                onPick={pick}
                onInspect={(id) => setInspectId(id)}
              />
            </div>
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

          {classLocked && (
            <div className="lab-gate" role="dialog" aria-label={classPhase === "ended" ? "Class ended" : "Waiting for the class to start"}>
              {classPhase === "ended" ? (
                <>
                  <h2>Class ended</h2>
                  <p>Your instructor closed the class. Your results are saved.</p>
                  <div className="lab-gate__score">
                    <span>Final score</span>
                    <strong>{scoreInfo.total}</strong>
                    <small>
                      Assemble {scoreInfo.assemble} · Disassemble {scoreInfo.disassemble} · Penalties -{scoreInfo.penalty} · {mistakes} mistakes
                    </small>
                  </div>
                </>
              ) : (
                <>
                  <h2>Waiting for your instructor</h2>
                  <p>
                    You're in class <strong>{labSession.code}</strong>. Your task:{" "}
                    <strong>{mode === "assemble" ? "build" : "take apart"} an {PLATFORM_LABEL[platform]} PC</strong>.
                    The clock starts when the instructor starts the class.
                  </p>
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
              <h2 style={{ margin: 0 }}>{mode === "disassemble" ? "Teardown complete!" : "Build complete!"}</h2>
              <p style={{ margin: "8px 0 16px" }}>
                {mode === "disassemble" ? "Every part is on the bench." : "The PC booted."} Score so far: <strong>{scoreInfo.total}</strong>
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