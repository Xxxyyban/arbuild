import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { useAuth } from "../context/AuthContext";
import PartModel, { BOARD_MOUNTS, BOARD_M2_COVERS, BOARD_SOCKETS, PSU_PANELS, PSU_FIXED, PSU_INLETS } from "../Three/PartModel";
import { renderSettings } from "../Three/graphics";
import { CablePlug, HeaderPlug, CableRun, PortMarker, LatchTab, BoardScrew, PSUPanel, FixedCables, M2Cover, M2CoverOnBench, SsdScrew, SocketLever, SocketPlate, SocketSlide, SocketCapOnBench, LeverHook, PLUG_REACH } from "../Three/Hardware";
import { PowerCord, PowerStrip } from "../Three/PowerCord";
import CableDrawer from "../components/lab/CableDrawer";
import { ThermalPaste, PasteStage, PasteCapture, PastePanel, PasteResult, newPasteWork } from "../components/lab/PasteTask";
import { gradePaste, lidFor } from "../lab/Paste";
import { MM, STRIP_SOCKET, headerPlugReach } from "../Three/cableStubs";
import DraggablePart from "../Three/DraggablePart";
import PullablePart from "../Three/PullablePart";
import { ARContext } from "../Three/xrSetup";
import { GLBridge, ARHitTest, ARRoot, CamAR, useARSupport, startARSession, requestMotion } from "../Three/ar/ARTools";
import { useARGestures, GestureGroup, MIN_SCALE, MAX_SCALE } from "../Three/ar/ARGestures";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import StepList from "../components/lab/StepList";
import {
  CaseWithMeasure, CaseRig, CaseFans, Workbench, TrayLabel, BenchLoadingFallback, CameraFocus, ViewControls, FitFov,
  TrayModel, TargetMarker, RamSlotMarker, Blast, Flyer,
} from "../components/lab/BenchScene";
import MonitorStation from "../components/lab/MonitorStation";
import StartScreen from "../components/lab/StartScreen";
import PartPicker from "../components/lab/PartPicker";
import PartInfoPanel from "../components/lab/PartInfoPanel";
import { useSizeVar } from "../components/lab/useSizeVar";
import {
  ALL_PARTS, PART_LABEL, trayPosition, toWorldPose, moboLocalToWorld,
  MOTHERBOARD_TARGET, PSU_TARGET, GPU_TARGET, PSU_SCREWS, GPU_SCREWS, GPU_SCREW_ROTATION, GPU_SCREW_SHANK, BACK_SCREW_SIZE, MOBO_LYING_ROTATION, MOBO_MOUNTED_ROTATION,
  boardLayout, STORAGE_MOUNT_ROTATION,
  COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z, GPU_SPIN_X, GPU_SPIN_Y, GPU_SPIN_Z,
  LAY_ANGLE, LAY_CENTER, AR_SCALE, HOME_CAM, HOME_TARGET, PART_DOT,
} from "../lab/Constants";
import {
  installBlock, removeBlock, evaluateBoot, bootTime, isFullyBuilt, isFullyStripped, expertSteps,
  CABLES, SCREW_COUNT, PSU_SCREW_COUNT, GPU_SCREW_COUNT, plugBlock, safetyBlock, psuModular, psuEndDone, psuPlugBlock, psuCableFixed, psuSocketed,
  M2_COVER_SCREWS, m2Start, m2LiftBlock, m2RefitBlock, m2Done, cableNeeded, isGpuCable, gpuSixPin,
  socketKind, socketStart, leverBlock, plateBlock, capBlock, socketDone, NO_CORD, cordIn, cordBlock,
} from "../lab/Rules";
import { screenSays, screenStatus } from "../lab/Screen";
import {
  POINTS, REMOVE_POINTS, pastePoints, basePoints, actionPoints, ledgerKey, timedScore, timeFactor, revertPenalty,
  maxPoints, officialScore, officialDelta, taskRequirements, taskLedger, OFFICIAL_MAX,
} from "../lab/Scoring";
import { DEFAULT_SETUP, normalizeSetup, buildStart, setupFromUrl } from "../lab/Setup";
import { previewSetup, troubleTotal } from "../lab/Tasks";
import { findFaults, fixedFaults, scenarioFaults, troubleSteps } from "../lab/Faults";
import {
  CABLE_IDS, STUB_TYPE, PORT_ROT, PORT_LATCH, GHOST_COLOR, PORT_LABEL, FIXED_MARK, PLUG_LOOK, PORT_WHERE, PSU_FIXED_OUT, HEADER_LIFT, WIRE_GHOST, wireRoute, coolerWireStart, cableRoute, psuToCase,
} from "../lab/CableRoutes";
import {
  WIRES, WIRE_IDS, WIRE_WHERE, HEADERS, headerLabel, headerName, wireName, wiresStart, wireBlock, wireFitBlock, wireFault, wireRight, wireOn,
} from "../lab/Wires";
import { createReporter, MISTAKE_TYPES } from "../lab/reportEvent";
import { CATALOG, PLATFORM_LABEL, itemFor, fitBlock, buildSlots, correctPicks } from "../lab/Catalog";
import { studentSetup, formatClock } from "../lab/Sessions";
import { useLabSession } from "../lab/useLabSession";
import ExamGuard from "../components/lab/ExamGuard";
import Watermark from "../components/Watermark";
import "../styles/BuildLab.css";
import "../styles/BuildLabParts.css";
import "../styles/BuildLabTask.css";
import "../styles/BuildLabPhone.css"; // every phone rule, after the rest

const OVERHEAT = { helloMs: 5000, loadMinMs: 3000, loadMaxMs: 5000, bsodMs: 3000, blastMs: 2200, explodeAfterBsod: true };
const SHUTDOWN_DURATION = 1800;
const SAFETY_NOTE = "Shut it down, unplug it and drain it before touching any part.";
const HINT_HIDDEN = "That didn't work. Think about what is missing.";
// After an explosion: everything back on the bench, the picked parts stay picked.
const NO_CABLES = { atx24: false, eps8: false, pcie: false, pcie6: false }; // also the PSU ends (psuCables)
const NO_SCREWS = Array.from({ length: SCREW_COUNT }, () => false);
const NO_PSU_SCREWS = Array.from({ length: PSU_SCREW_COUNT }, () => false);
const NO_GPU_SCREWS = Array.from({ length: GPU_SCREW_COUNT }, () => false);
const EMPTY_BUILD = {
  mode: "assemble", installed: {}, pasteApplied: false, ramSlot: { ram1: null, ram2: null },
  cables: NO_CABLES, psuCables: NO_CABLES, screws: NO_SCREWS, psuScrews: NO_PSU_SCREWS, gpuScrews: NO_GPU_SCREWS, wires: wiresStart(false),
};
// The PSU's screws and the card's, both on the back of the case: their step, what one is called,
// and what's said once they're all in or all out.
const PART_SCREWS = {
  psu: {
    key: "psu_screws", count: PSU_SCREW_COUNT, one: "PSU screw",
    allIn: `All ${PSU_SCREW_COUNT} PSU screws in. The PSU is held to the case.`, allOut: "All PSU screws out. The PSU can come out now.",
  },
  gpu: {
    key: "gpu_screws", count: GPU_SCREW_COUNT, one: "card screw",
    allIn: "Both card screws in. Its bracket is held to the case.", allOut: "Both card screws out. The card can come out now.",
  },
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
const SOCKET_ROTATION = [0, Math.PI, 0]; // board space -> the socket's frame (Three/cpuSocket.js)

const PHASE_ZERO = { assemble: 0, disassemble: 0 };
const HOME_VIEW = { position: HOME_CAM, target: HOME_TARGET }; // the whole bench, where the camera starts
const POWER_ON = { shutdown: false, unplugged: false, discharged: false };

// Power + screen state for a starting build.
function powerAndMonitor(s) {
  if (s.mode !== "disassemble") return { power: { ...POWER_ON }, monitor: { status: "off" } };
  const boot = evaluateBoot(s);
  if (boot.status === "hello") {
    return { power: { ...POWER_ON }, monitor: { status: "hello", lowRes: boot.lowRes, safety: SAFETY_NOTE } };
  }
  return { power: { ...POWER_ON, shutdown: true }, monitor: { status: "off" } };
}

/** The bench's buttons: what's always there, then the work of this mode. */
function ControlPanel({ buttons }) {
  const panelRef = useSizeVar("--lab-ctrl-h"); // what sits above the panel clears its rows
  const work = buttons.filter((b) => b.work);
  const one = (b) => (
    <button
      key={b.key}
      type="button"
      title={b.title}
      className={["lab-tools__btn", b.lit ? "is-on" : "", b.accent ? "is-accent" : "", b.danger ? "is-danger" : "", b.dim ? "is-dim" : ""].join(" ").trim()}
      aria-pressed={b.lit === undefined ? undefined : !!b.lit}
      aria-disabled={b.dim ? true : undefined}
      disabled={b.disabled || false}
      onClick={b.onPress}
    >
      <Icon name={b.done ? "check" : b.icon} size={17} className={b.turned ? "is-turned" : ""} />
      <span>{b.label}</span>
    </button>
  );
  return (
    <div className="assemble__control-panel" ref={panelRef}>
      <div className={`lab-tools ${work.length > 1 ? "is-many" : ""}`} role="toolbar" aria-label="Bench">
        <div className="lab-tools__group">{buttons.filter((b) => !b.work).map(one)}</div>
        <div className="lab-tools__group is-work">{work.map(one)}</div>
      </div>
    </div>
  );
}

export default function BuildLab() {
  const { user, profile } = useAuth();
  const userName = profile?.firstName || "Builder";
  const labSession = useLabSession({ user, profile });

  // null = start screen. ?start=build|teardown (old-route redirects) skips it, and so does an
  // instructor's ?preview= link (a task tried out as a student gets it; nothing is saved).
  const [setup, setSetup] = useState(() => {
    const search = window.location.search;
    const q = new URLSearchParams(search);
    if (q.get("preview")) return previewSetup(search);
    return q.get("start") ? setupFromUrl(search) : null;
  });
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
  const [paste, setPaste] = useState(null); // what the student put on the CPU: { dabs, grade, squeezed } (null: none, or it came with the PC)
  const [pasteTask, setPasteTask] = useState(null); // putting it on: "draw", then "result"
  const [pasteWork, setPasteWork] = useState(null); // the drawing in progress (components/lab/PasteTask.jsx)
  const [ramSlot, setRamSlot] = useState(init.ramSlot);
  const [cables, setCables] = useState(init.cables ?? NO_CABLES); // cables' part ends plugged in
  const [psuCables, setPsuCables] = useState(init.psuCables ?? NO_CABLES); // their PSU ends (modular PSU)
  const [screws, setScrews] = useState(init.screws ?? NO_SCREWS); // motherboard screws driven in
  const [psuScrews, setPsuScrews] = useState(init.psuScrews ?? NO_PSU_SCREWS); // the PSU's, on the back of the case
  const [gpuScrews, setGpuScrews] = useState(init.gpuScrews ?? NO_GPU_SCREWS); // the card's, on the back of the case
  // the board's M.2 slot: its cover (on the board or the bench), the cover's 2 screws, the SSD's screw
  const [m2, setM2] = useState(init.m2 ?? m2Start(init.installed.storage));
  // the CPU socket: its lever, AM5's cover frame and the plastic cap on it
  const [socket, setSocket] = useState(init.socket ?? socketStart(init.installed.cpu));
  const [cableTask, setCableTask] = useState(null); // connecting one end of a cable: { cable, end: "psu" | "part", port, flipped }
  // the case's and fans' wires on the board's headers ({ [wire]: { at, flipped } | null }), and the one
  // being connected: { wire, at (the header picked), flipped (an LED plug's + on the wrong pin) }
  const [wires, setWires] = useState(init.wires ?? wiresStart(false));
  const [wireTask, setWireTask] = useState(null);
  const [cableDrawer, setCableDrawer] = useState(false);
  // the PSU socket each socketed cable went into, when not its own (either PCI-E socket takes either PCIe cable)
  const [psuSockOf, setPsuSockOf] = useState(init.psuSockOf ?? {});
  const [power, setPower] = useState(init.power);
  const [monitor, setMonitor] = useState(init.monitor);
  // the mains power cord: in the PSU's inlet, in the power strip; and it being plugged in: { end: "psu" | "wall", ready (the plug is at its socket) }
  const [cord, setCord] = useState(init.cord ?? NO_CORD);
  const [cordTask, setCordTask] = useState(null);
  const cordInlet = useRef(null); // in the case, at the PSU's inlet: the cord's plug follows it (Three/PowerCord.jsx)
  const [flights, setFlights] = useState({}); // name -> { position, rotation } where a pulled part was let go
  const [motherboardPos, setMotherboardPos] = useState(
    init.installed.motherboard ? MOTHERBOARD_TARGET.position : trayPosition("motherboard")
  );
  const [booted, setBooted] = useState(false);
  // troubleshooting: the PC started with nothing wrong (the task is done), and the guide's first steps
  const [troubleOk, setTroubleOk] = useState(false);
  const [troubleLog, setTroubleLog] = useState({ poweredOn: false, madeSafe: false });
  const [phaseActions, setPhaseActions] = useState(0);
  const [promptDismissed, setPromptDismissed] = useState(false);

  /* ---------- UI state ---------- */
  const [scoreRev, setScoreRev] = useState(0); // bumped when the ledger changes, the score is derived below
  const [, setClockTick] = useState(0); // one tick a second while the phase clock runs
  const [mistakes, setMistakes] = useState(0);
  const [inspectId, setInspectId] = useState(null); // catalog id shown in the part info panel
  const [taskDone, setTaskDone] = useState(null); // class only: { ms } once the task's phase was finished
  // the guide card starts open on a computer, and closed on a phone, where it would cover the bench
  const [taskOpen, setTaskOpen] = useState(() => !window.matchMedia?.("(max-width: 720px), (max-height: 500px)").matches);
  const taskRef = useSizeVar("--lab-task-h"); // messages on a phone sit above the card
  const [bounce, setBounce] = useState({}); // part -> count, remounts a part that didn't fit so it returns to the bench
  const [popups, setPopups] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [buildId, setBuildId] = useState(0);
  // the case starts standing upright; Lay down puts it on its side
  const [isLaidDown, setIsLaidDown] = useState(false);
  const [casePose, setCasePose] = useState(null);
  const [caseBox, setCaseBox] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  // RAM on a computer: the stick being dragged (its slots show)
  const [ramDrag, setRamDrag] = useState(null);
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
  // AR: the bench's size (1 = as placed), from a pinch or the size buttons
  const [arSize, setArSize] = useState(1);
  const gestures = useARGestures({ overlayRef, enabled: arLike && !pasteTask, onScale: setArSize });
  const resetGestures = () => {
    gestures.reset();
    setArSize(1);
  };
  const sizeBy = (factor) => setArSize(gestures.setScale(gestures.state.current.target.scale * factor));
  const viewRef = useRef(null); // the view buttons on a computer (ViewControls)

  const cfg = normalizeSetup(setup ?? DEFAULT_SETUP);
  // In a class the instructor's task sets the work, and there is a clock and points.
  // Free build (no class) is for learning: no task, no clock, no points.
  const inClass = !!labSession.code;
  // an instructor trying a task out (?preview=): scored and timed like the class, nothing saved
  const preview = !inClass && !!cfg.preview;
  const scored = inClass || preview;
  const task = scored ? cfg.task : null;
  const trouble = task?.mode === "troubleshoot"; // fixing the instructor's faulty PC
  const hintsOn = cfg.hints;
  const help = cfg.help; // the step list, the board's labels, the RAM slot numbers, the faults left
  const platform = cfg.platform;
  const parMs = cfg.parMin * 60000;
  const scoreInfo = timedScore(ledger.current, penalty.current, phaseMs.current, parMs);
  // The official score (what the instructor reads), out of the task's points: only the work the
  // task asks for counts (taskLedger), against a perfect, on-time run of it. Leaving a required part
  // out costs marks; adding one it doesn't ask for earns none. PSU cable points count only when the
  // student's PSU takes cables.
  const taskMode = task?.mode ?? cfg.startMode;
  const outOf = task?.points ?? OFFICIAL_MAX;
  const req = { ...taskRequirements(task ?? { mode: taskMode }, psuSocketed(picks.psu ? picks : correctPicks(platform))), gpu6: gpuSixPin(picks) };
  const maxPts = maxPoints(taskMode, req);
  const officialCard = timedScore(taskLedger(ledger.current, req), penalty.current, phaseMs.current, parMs);
  // Troubleshooting: what's wrong with the PC now and which of the set-up's faults are fixed. The
  // score is the fixed faults' points, and the start's once it starts with nothing wrong, for the
  // time taken (building and taking apart together), out of the task's points.
  const cpuLid = lidFor(itemFor("cpu", picks)?.variant ?? 0);
  const pasteThin = pasteApplied && !!paste?.grade?.thin; // so little over the chips that the CPU overheats
  const faultsNow = trouble
    ? findFaults({ installed, picks, pasteApplied, pasteThin, ramSlot, cables, psuCables, psuSockOf, screws, m2, socket, wires }, task)
    : [];
  const faultIds = trouble ? Object.keys(task.faultPoints) : [];
  const fixedIds = trouble ? fixedFaults(faultIds, faultsNow) : [];
  const startFaults = useMemo(() => (trouble ? scenarioFaults(task.scenario, task) : []), [trouble, task]);
  const troubleMs = phaseMs.current.assemble + phaseMs.current.disassemble;
  const troubleScore = (earned, ms) =>
    Math.max(0, Math.min(outOf, Math.round((earned * timeFactor(ms, parMs) * outOf) / Math.max(1, troubleTotal(task)))));
  const official = !trouble
    ? officialScore(officialCard, taskMode, maxPts, outOf)
    : taskDone
    ? troubleScore(taskDone.earned, taskDone.ms)
    : troubleScore(fixedIds.reduce((s, id) => s + task.faultPoints[id], 0), troubleMs);
  // with "faults left" hidden, the score would give a fix away: it shows once the PC is fixed
  const scoreShown = !trouble || help.faultsLeft || !!taskDone;

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
  const m2Look = BOARD_M2_COVERS[boardVariant] || undefined; // the board's own M.2 cover, if it has one
  const sockLook = BOARD_SOCKETS[boardVariant] || BOARD_SOCKETS[0]; // where the board's socket lever (and frame) go
  const sockKind = socketKind(picks); // "zif" (AM4: lever only) or "lga" (AM5: lever and cover frame)
  // what holds a part in when taking it apart (Rules removeBlock)
  const links = { cables, screws, psuScrews, gpuScrews, m2, socket, socketKind: sockKind, wires };
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
  // Each DIMM slot's middle, the way it runs (up the board) and the way out of the board, in world space:
  // where its click target goes when a stick is picked up.
  const ramSlotMarks = useMemo(() => {
    const world = (l) =>
      boardMounted
        ? toWorldPose(moboLocalToWorld(MOTHERBOARD_TARGET.position, l, MOBO_MOUNTED_ROTATION, L.scale), UPRIGHT, rig).position
        : moboLocalToWorld(motherboardPos, l, MOBO_LYING_ROTATION, L.scale);
    const from = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    return L.ramSlots.map((l) => {
      const center = world(l);
      return { center, along: from(world([l[0], l[1] + 0.1, l[2]]), center), up: from(world([l[0], l[1], l[2] - 0.1]), center) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motherboardPos, boardMounted, rig, L]);
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
    if (!scored || trouble) return; // troubleshooting: the points come with each fault fixed
    pushPopup(points, type);
  }

  function pushPopup(points, type) {
    const id = Date.now() + Math.random();
    setPopups((p) => [...p, { id, points, type }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1200);
  }

  // With hints off, failure toasts stay vague (`vague`, or a generic line). reportEvent still gets the full text.
  function showHint(text, type = "fail", vague = HINT_HIDDEN) {
    setFeedback({ type, text: type !== "success" && !hintsOn ? vague : text });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), type === "safety" ? 4500 : 2800); // a safety warning stays longer
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
    showHint(message, type === "safety" ? "safety" : "fail", vague);
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
    const isRam = name === "ram1" || name === "ram2";
    let ramMsg = "";
    if (isRam) {
      const free = name === "ram1" ? ram1Free : ram2Free;
      const s = slot ?? free[0].slot;
      const other = ramSlot[name === "ram1" ? "ram2" : "ram1"];
      ramMsg = `${PART_LABEL[name]} pushed into slot ${s + 1} until both latches clicked.`;
      if (other != null && Math.abs(other - s) === 1) {
        flawed = true; // neighbouring slots, no dual channel
        if (hintsOn) ramMsg += ` It's right next to the other stick (slot ${other + 1}), so they run in single channel: slots 1+3 or 2+4 give dual channel.`;
      }
      setRamSlot((p) => ({ ...p, [name]: s }));
    }

    // in the case: their screws still have to go in
    if (name === "psu") setPsuScrews(NO_PSU_SCREWS);
    if (name === "gpu") setGpuScrews(NO_GPU_SCREWS);
    if (name === "storage") setM2((p) => ({ ...p, ssdScrew: false }));
    if (name === "cpu_cooler") setPaste((p) => p && { ...p, squeezed: true }); // the cooler presses it flat
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
      // troubleshooting scores the faults, not these points: no number in the message
      deduct(POINTS.skipPaste, `Cooler mounted without thermal paste.${trouble ? "" : ` -${POINTS.skipPaste}`}`);
      reportEvent("penalty", name, "Cooler mounted without thermal paste", -POINTS.skipPaste);
      return;
    }

    logAction(name, k, flawed);
    const missCount = misses.current[k] || 0;
    // what comes next for the PSU and the card: their screws, round the back of the case (out of sight)
    const then = hintsOn
      ? { psu: ` Now screw it in from the back of the case: ${PSU_SCREW_COUNT} screws.`, gpu: ` Now screw its bracket in from the back of the case: ${GPU_SCREW_COUNT} screws.` }[name] || ""
      : "";
    const msg = `${isRam ? ramMsg : `${PART_LABEL[name]} installed.`}${missCount === 0 && !flawed ? " Perfect placement!" : ""}${then}`;
    award(k, actionPoints(basePoints(mode, name), missCount), msg, name);
  }

  function applyPaste() {
    if (installed.cpu_cooler) return showHint("Too late, the cooler is already on. Paste goes on first.");
    if (!installed.cpu) return showHint("Install the CPU first, the paste goes on top of it.");
    if (pasteApplied) {
      // their own paste: its marks again, with the choice to wipe it off and start over
      if (paste?.grade) return setPasteTask("result");
      return showHint("Thermal paste is already applied.", "success");
    }
    startPaste();
  }

  // The tube in hand, the lid clean, the camera over the CPU.
  function startPaste() {
    setCableTask(null);
    setWireTask(null);
    setCordTask(null);
    setCableDrawer(false);
    setSelectedPart(null);
    setInspectId(null);
    setPaste(null);
    setPasteWork(newPasteWork());
    setPasteTask("draw");
  }

  function donePaste() {
    const dabs = pasteWork.dabs;
    setPaste({ dabs, grade: gradePaste(dabs, cpuLid), squeezed: false });
    setPasteTask("result");
  }

  function keepPaste() {
    setPasteTask(null);
    if (pasteApplied) return; // it was on already, they only looked at it again
    setPasteApplied(true);
    const k = ledgerKey("assemble", "paste");
    award(k, pastePoints(paste.grade.quality, misses.current[k] || 0), "Thermal paste on. The cooler can go on now.", "paste");
    if (paste.grade.fault) reportEvent("miss", "paste", paste.grade.fault);
  }

  // Wiping it off costs some of the points; the next try's mark is what counts, even if it's lower.
  function redoPaste() {
    const k = ledgerKey("assemble", "paste");
    misses.current[k] = (misses.current[k] || 0) + 1;
    delete ledger.current[k];
    syncScore();
    reportEvent("revert", "paste", "Wiped the thermal paste off to do it again");
    setPasteApplied(false);
    startPaste();
  }

  function cancelPaste() {
    setPasteTask(null);
    setPaste(null);
  }

  /* ---------- disassemble: remove a part ---------- */
  function uninstall(name, fromWorld) {
    document.body.style.cursor = "";
    setHovered(null);
    if (!installed[name]) return;
    if (gestures.consumeSuppress()) return; // a drag/pinch/twist just happened, not a real tap

    const b = removeBlock(name, installed, power, links);
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
    if (name === "cpu") {
      setPasteApplied(false); // the paste goes with it
      setPaste(null);
    }
    if (name === "ram1" || name === "ram2") setRamSlot((p) => ({ ...p, [name]: null }));
    if (name === "motherboard") setMotherboardPos(trayPosition("motherboard"));
    setBooted(false);
    setPhaseActions((n) => n + 1);

    logAction(name, k, flawed);
    const missCount = misses.current[k] || 0;
    award(k, actionPoints(basePoints(mode, name), missCount), `${PART_LABEL[name]} removed.${missCount === 0 ? " Clean removal!" : ""}${name === "cpu" && sockKind === "lga" ? " Put the socket's plastic cap back on to protect its pins." : ""}`, name);
  }

  function reportBlocked(name) {
    const b = removeBlock(name, installed, power, links);
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
    // out of the wall first, then out of the PSU, and the cord goes back in its coil
    setCord((c) => ({ ...c, wall: false }));
    later(() => setCord(NO_CORD), 350);
    const k = ledgerKey("disassemble", "unplug");
    award(k, actionPoints(POINTS.unplug, misses.current[k] || 0), "Unplugged. Now hold the power button to drain leftover power.", "unplug");
  }

  // Holding the power button with the cord out empties the capacitors: the last safety step.
  function discharge() {
    if (power.discharged) return;
    if (!power.unplugged) {
      const key = !power.shutdown ? "shutdown" : "unplug";
      return miss(key, "Shut down and unplug the PC first, then hold the power button to drain it.", "safety");
    }
    setPower((p) => ({ ...p, discharged: true }));
    setTroubleLog((l) => ({ ...l, madeSafe: true }));
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
    setPaste(null);
    award(ledgerKey("disassemble", "paste"), actionPoints(REMOVE_POINTS.paste, 0), "Old thermal paste wiped clean.", "paste");
  }

  /* ---------- the mains power cord (Three/PowerCord.jsx) ---------- */
  // Last thing before powering on, Packet Tracer style like the other cables: pick it in the Cables
  // drawer, click the PSU's inlet at the back of the case, push the plug in; then the same at the power
  // strip. PSU first, wall last. Every PSU model has its own inlet (PSU_INLETS).
  const psuInlet = PSU_INLETS[itemFor("psu", picks)?.variant ?? 0] || PSU_INLETS[0];
  const cordNext = cordBlock(installed, picks, psuScrews);

  function startCord() {
    if (mode !== "assemble" || exploding) return;
    if (cordIn(cord)) return showHint("The power cord is plugged in at both ends.", "success");
    if (cordNext) return showHint(cordNext.msg);
    setCableDrawer(false);
    setCableTask(null);
    setWireTask(null);
    setInspectId(null); // on a phone a part's info would cover what's to be clicked
    setCordTask({ end: cord.psu ? "wall" : "psu", ready: false });
  }

  function chooseCordPort(end) {
    if (cordTask?.end !== end) return showHint("Open Cables and pick the power cord first.");
    setCordTask({ ...cordTask, ready: true });
  }

  function pushCord() {
    if (!cordTask?.ready) return;
    if (cordTask.end === "psu") {
      setCord((c) => ({ ...c, psu: true }));
      setCordTask({ end: "wall", ready: false });
      return showHint("In the PSU. The other end goes into the power strip, always last.", "success");
    }
    setCord({ psu: true, wall: true });
    setCordTask(null);
    const k = ledgerKey(mode, "power_cord");
    award(k, actionPoints(basePoints(mode, "power_cord"), misses.current[k] || 0), "Power cord plugged in. The PC has power now.", "power_cord");
  }

  // Clicking a plug: push it in while connecting; taking the PC apart, it's the Unplug button.
  function clickCord(end) {
    if (exploding) return;
    if (mode === "disassemble") return power.unplugged ? showHint("The power cord is already out.", "success") : unplug();
    if (cordTask?.end === end && cordTask.ready) return pushCord();
    if (cord[end]) return showHint(`The power cord is plugged into the ${end === "psu" ? "PSU" : "power strip"}.`, "success");
    showHint("Open Cables and pick the power cord first.");
  }

  /* ---------- cables and screws ---------- */
  const gpuPort = itemFor("gpu", picks)?.powerPort;
  const gpuPort6 = itemFor("gpu", picks)?.powerPort6; // a card's 6-pin power socket, if it has one
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
    setCordTask(null);
    setInspectId(null); // on a phone a part's info would cover what's to be clicked
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

  // the PSU end: which labelled socket (a socket with the same label as its own does too, if it's free)
  const sockOf = (c) => psuSockOf[c] ?? CABLES[c].psuSocket;
  function chooseSocket(sock) {
    if (cableTask?.end !== "psu") return showHint("Open Cables and pick a cable first, then click the socket it goes into.");
    const c = cableTask.cable;
    const want = CABLES[c].psuSocket;
    const taken = CABLE_IDS.find((o) => o !== c && psuCables[o] && !isFixed(o) && sockOf(o) === sock);
    if (taken) return showHint(`The ${CABLES[taken].label} is already in that socket. Use the other ${psuPanel.sockets[sock].label} socket.`);
    if (sock !== want && psuPanel.sockets[sock].label !== psuPanel.sockets[want].label) {
      const mixUp = (sock === "cpu" && isGpuCable(c)) || (isGpuCable(sock) && want === "cpu");
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
    if (cableTask?.end !== "psu") return showHint("Open Cables and pick a cable first, then click it in the PSU's bundle.");
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
      `${label} routed out of the bundle. Its plug waits for the ${isGpuCable(c) ? "graphics card" : "motherboard"}.`,
      key
    );
  }

  // the part end: which header
  function choosePort(p) {
    if (cableTask?.end !== "part") return showHint("Open Cables and pick a cable first, then click where it goes.");
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
      setPsuSockOf((prev) => ({ ...prev, [c]: cableTask.port }));
      if (c === "pcie" && !picks.gpu) {
        return showHint("8-pin PCIe cable plugged into the PSU. There's no graphics card yet: tuck it aside, it's ready if you add one.", "success");
      }
      return award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${CABLES[c].label} plugged into the PSU. Its other end waits for the ${isGpuCable(c) ? "graphics card" : "motherboard"}.`, key);
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
    if (cables[c]) return miss(key, `Unplug the ${label} from the ${isGpuCable(c) ? "graphics card" : "motherboard"} first, then from the PSU.`, "blocked");
    const s = safetyBlock(power);
    if (s) return miss(s.key, s.msg, "safety");
    setPsuCables((p) => ({ ...p, [c]: false }));
    award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${label} unplugged from the PSU.`, key);
  }

  /* ---------- the case's and fans' wires on the board's small headers (lab/Wires.js) ---------- */
  // Like a cable's part end: pick the wire in Cables, click the header, turn an LED plug + to +, push
  // it on. A plug that fits goes on even on the wrong header: power on shows the mistake.
  const headers = L.headers;
  const sockCase = useMemo(() => moboLocalToWorld(MOTHERBOARD_TARGET.position, L.cpuLocal, MOBO_MOUNTED_ROTATION, L.scale), [L]);
  const headerPos = (spot, lift = HEADER_LIFT) => {
    const at = headers?.[spot]?.at;
    return at ? [sockCase[0] + at[0] * MM, sockCase[1] + at[1] * MM, L.pcbFront + lift] : null;
  };
  // a plug's long way along the header: across the board, or up it (the USB 3.0 header on the right edge)
  const headerRot = (spot) => (headers?.[spot]?.along === "y" ? [Math.PI / 2, Math.PI / 2, 0] : [Math.PI / 2, 0, 0]);

  function startWire(id) {
    if (mode !== "assemble" || exploding) return;
    const b = wireBlock(id, installed);
    if (b) return showHint(b.msg);
    setCableDrawer(false);
    setCableTask(null);
    setCordTask(null);
    setInspectId(null);
    setWireTask({ wire: id, at: null, flipped: false });
  }

  function chooseHeader(spot) {
    if (!wireTask) return;
    const id = wireTask.wire;
    const no = wireFitBlock(id, spot, wires);
    if (no) return miss(`wire_${id}`, no, "miss", "It won't go on there. Look at the plug and read the labels on the board.");
    // an LED plug can arrive either way round; the others only fit one way
    setWireTask({ ...wireTask, at: spot, flipped: !!WIRES[id].polar && Math.random() < 0.5 });
  }

  function turnWire() {
    setWireTask((t) => (t ? { ...t, flipped: !t.flipped } : t));
  }

  function pushWire() {
    if (!wireTask?.at) return;
    const { wire: id, at, flipped } = wireTask;
    const key = `wire_${id}`;
    const k = ledgerKey(mode, key);
    const w = { at, flipped };
    setWireTask(null);
    setWires((p) => ({ ...p, [id]: w }));
    setPhaseActions((n) => n + 1);
    setBooted(false); // a changed wire is checked at the next power on
    const fault = wireFault(id, w, headers);
    if (fault) {
      // it goes on, so it's a mistake to find at power on (hints on: said now)
      misses.current[k] = (misses.current[k] || 0) + 1;
      reportEvent("miss", key, fault);
      return showHint(hintsOn ? `${wireName(id)} is on, but: ${fault}` : `${wireName(id)} plugged in.`, hintsOn ? "fail" : "success");
    }
    award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${wireName(id)} plugged onto ${headerName(at, headers)}${WIRES[id].polar ? ", + on +" : ""}.`, key);
  }

  // Clicking a wire's plug: push it on while connecting; otherwise pull it off (to fix it, or taking apart).
  function clickWire(id) {
    if (exploding) return;
    if (wireTask?.wire === id && wireTask.at) return pushWire();
    const w = wires[id];
    if (!w) return;
    const key = `wire_${id}`;
    const label = wireName(id);
    if (mode === "disassemble") {
      const s = safetyBlock(power);
      if (s) return miss(s.key, s.msg, "safety");
      setWires((p) => ({ ...p, [id]: null }));
      const k = ledgerKey(mode, key);
      return award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), `${label} unplugged from ${headerName(w.at, headers)}.`, key);
    }
    if (monitor.status !== "off") return showHint("Press POWER to turn the PC off before you pull a wire off.");
    setWires((p) => ({ ...p, [id]: null }));
    setBooted(false);
    showHint(`${label} pulled off ${headerName(w.at, headers)}. Pick it in Cables to plug it in again.`, "success");
  }

  // A wire's plug: on its header, or hovering over the one picked; its guide wire runs back to where it comes from.
  function wirePose(id) {
    const w = wires[id];
    let pose = null;
    if (w && headers?.[w.at]) pose = { spot: w.at, seated: true, flipped: !!w.flipped };
    else if (wireTask?.wire === id && wireTask.at) pose = { spot: wireTask.at, seated: false, flipped: wireTask.flipped };
    if (!pose) return null;
    const pos = headerPos(pose.spot);
    const top = [pos[0], pos[1], pos[2] + headerPlugReach(WIRES[id].plug) + (pose.seated ? 0 : 0.05)];
    const cooler = coolerWireStart(sockCase, L.pcbFront);
    return { ...pose, pos, rot: headerRot(pose.spot), ghost: wireRoute(id, top, cooler) };
  }
  const wireWaiting = (id) => (mode === "assemble" ? wireTask?.wire === id && !!wireTask.at : !!wires[id] && power.discharged);
  // the headers that light up for the wire being connected: the right one and its look-alikes, if free
  const wireSpots = wireTask && !wireTask.at ? WIRES[wireTask.wire].offer.filter((sp) => headers?.[sp] && !wireOn(wires, sp)) : [];

  // The camera glides in on the free headers the wire might go on, then on the one picked.
  const wireFocus = useMemo(() => {
    if (!wireTask || !headers) return null;
    const free = WIRES[wireTask.wire].offer.filter((sp) => headers[sp] && !wireOn(wires, sp));
    const spots = wireTask.at ? [wireTask.at] : free.length ? free : WIRES[wireTask.wire].offer.filter((sp) => headers[sp]);
    const pts = spots.map((sp) => headerPos(sp));
    const c = [0, 1, 2].map((k) => pts.reduce((sum, p) => sum + p[k], 0) / pts.length);
    const span = Math.max(0.05, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
    const target = toWorldPose(c, [0, 0, 0], rig).position;
    // headers along the board's top edge (the fans') are seen from a little below, clear of the case's top rail
    const top = c[1] > 1.85;
    const dir = rig.laidDown ? [0.12, 1, 0.3] : top ? [0.19, -0.11, 1] : [0.2, 0.15, 1];
    const n = Math.hypot(...dir);
    const d = Math.max(top ? 0.55 : 0.3, span * 2.6 + 0.15); // close on one header or a tight group, back for spread ones
    return { key: `wire:${wireTask.wire}:${wireTask.at ?? ""}`, target, position: target.map((v, k) => v + (dir[k] / n) * d) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireTask?.wire, wireTask?.at, headers, rig, sockCase, wires]);

  /* ---------- the M.2 cover and the SSD's screw ---------- */
  // Every board's M.2 slot has a cover held by 2 screws, and the SSD has its own screw under it.
  // Building: cover screws out, cover off, SSD in, SSD screw in, cover back on, cover screws in.
  // Taking apart: the same in reverse. A screw turns with one click, either way.
  function unsafe() {
    const s = safetyBlock(power);
    if (s) miss(s.key, s.msg, "safety");
    return !!s;
  }

  function clickCoverScrew(i) {
    if (exploding || m2.cover !== "on") return;
    if (mode === "disassemble" && unsafe()) return;
    const coverScrews = m2.coverScrews.map((d, j) => (j === i ? !d : d));
    const next = { ...m2, coverScrews };
    setM2(next);
    const n = coverScrews.filter(Boolean).length;
    if (coverScrews[i]) {
      if (mode === "assemble" && installed.storage && m2Done(next, installed)) {
        const k = ledgerKey(mode, "m2cover");
        return award(k, actionPoints(basePoints(mode, "m2cover"), misses.current[k] || 0), "M.2 cover screwed down over the SSD.", "m2cover");
      }
      return showHint(`M.2 cover screw in: ${n} of ${M2_COVER_SCREWS}.`, "success");
    }
    showHint(n === 0 ? "Both cover screws out. Lift the cover off." : `M.2 cover screw out: ${n} still in.`, "success");
  }

  function clickM2Cover() {
    if (exploding) return;
    if (m2.cover === "on") {
      if (mode === "disassemble" && unsafe()) return;
      const b = m2LiftBlock(m2);
      if (b) return miss(b.key, b.msg, "blocked");
      setM2((p) => ({ ...p, cover: "off" }));
      if (mode === "disassemble") {
        const k = ledgerKey(mode, "m2cover");
        return award(k, actionPoints(basePoints(mode, "m2cover"), misses.current[k] || 0), "M.2 cover off. Now unscrew the SSD.", "m2cover");
      }
      return showHint(installed.storage ? "M.2 cover off." : "M.2 cover off. Now the SSD can go into the slot.", "success");
    }
    // on the bench: back onto the board, its screws still to go in
    const b = m2RefitBlock(m2, installed);
    if (b) return miss(b.key, b.msg, "blocked");
    setM2((p) => ({ ...p, cover: "on", coverScrews: [false, false] }));
    showHint("M.2 cover back on. Now screw it down (2 screws).", "success");
  }

  function clickSsdScrew() {
    if (exploding || !installed.storage) return;
    if (m2.cover === "on") return showHint("The SSD's screw is under the M.2 cover. Take the cover off first.");
    if (mode === "disassemble" && unsafe()) return;
    const k = ledgerKey(mode, "m2screw");
    if (!m2.ssdScrew) {
      setM2((p) => ({ ...p, ssdScrew: true }));
      if (mode === "assemble") {
        return award(k, actionPoints(basePoints(mode, "m2screw"), misses.current[k] || 0), "SSD screwed down. Now put the M.2 cover back over it.", "m2screw");
      }
      return showHint("SSD screw back in.", "success");
    }
    setM2((p) => ({ ...p, ssdScrew: false }));
    if (mode === "disassemble") {
      return award(k, actionPoints(basePoints(mode, "m2screw"), misses.current[k] || 0), "SSD unscrewed. Its end lifts up, then it slides out of the slot.", "m2screw");
    }
    showHint("SSD screw out.", "success");
  }

  /* ---------- the CPU socket's lever (and AM5's cover frame) ---------- */
  // AM4: lever up, CPU in, lever down. AM5: lever up, cover frame up, CPU in, frame down, lever down
  // (the plastic cap pops off). Taking apart is the reverse, once the cooler is off.
  function socketOpened() {
    const k = ledgerKey(mode, "socket");
    award(k, actionPoints(basePoints(mode, "socket"), misses.current[k] || 0), "Socket open: the CPU lifts straight out now.", "socket");
  }

  function clickLever() {
    if (exploding) return;
    if (mode === "disassemble" && unsafe()) return;
    const b = leverBlock(socket, sockKind, installed);
    if (b) return miss(b.key, b.msg, "blocked");
    const cpuIn = !!installed.cpu;
    if (socket.lever === "down") {
      setSocket((p) => ({ ...p, lever: "up" }));
      if (mode === "disassemble" && cpuIn && sockKind === "zif") return socketOpened();
      if (sockKind === "lga") return showHint("Lever up. Now lift the cover frame.", "success");
      return showHint(
        cpuIn
          ? "Lever up: the socket's top plate slides back and lets go of the CPU's pins."
          : "Lever up: the socket's top plate has slid open. Line the CPU's gold triangle up with the socket's and drop it in.",
        "success"
      );
    }
    const popCap = sockKind === "lga" && cpuIn && socket.cap;
    setSocket((p) => ({ ...p, lever: "down", cap: popCap ? false : p.cap }));
    if (mode === "assemble" && cpuIn) {
      const k = ledgerKey(mode, "socket");
      const msg = popCap
        ? "CPU locked in. The plastic cap pops off: keep it, it goes back on if the CPU ever comes out."
        : "CPU locked in: the lever slid the socket's top plate over, and it grips every pin.";
      return award(k, actionPoints(basePoints(mode, "socket"), misses.current[k] || 0), msg, "socket");
    }
    showHint("Lever down and hooked.", "success");
  }

  // AM5's plastic cap pops off when the lever locks a CPU in and waits on the bench; after a
  // teardown it goes back on the empty socket.
  function clickCap() {
    if (exploding) return;
    if (mode === "disassemble" && unsafe()) return;
    const b = capBlock(socket, installed);
    if (b) return miss(b.key, b.msg, "blocked");
    setSocket((p) => ({ ...p, cap: true }));
    showHint("Plastic cap back on: it keeps the empty socket's pins safe.", "success");
  }

  function clickPlate() {
    if (exploding || sockKind !== "lga") return;
    if (mode === "disassemble" && unsafe()) return;
    const b = plateBlock(socket);
    if (b) return miss(b.key, b.msg, "blocked");
    if (socket.plate === "closed") {
      setSocket((p) => ({ ...p, plate: "open" }));
      if (mode === "disassemble" && installed.cpu) return socketOpened();
      return showHint(installed.cpu ? "Cover frame up." : "Cover frame up. Line the CPU's gold triangle up with the socket's and set it in.", "success");
    }
    setSocket((p) => ({ ...p, plate: "closed" }));
    showHint(installed.cpu ? "Cover frame down. Now push the lever down into its hook." : "Cover frame down.", "success");
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

  // The PSU's screws and the card's, one click each, like the board's.
  function clickPartScrew(part, i) {
    if (exploding || !installed[part]) return;
    const { key, count, one, allIn, allOut } = PART_SCREWS[part];
    const [list, setList] = part === "psu" ? [psuScrews, setPsuScrews] : [gpuScrews, setGpuScrews];
    const One = one[0].toUpperCase() + one.slice(1);
    const k = ledgerKey(mode, key);
    if (mode === "assemble") {
      if (list[i]) return showHint(`That ${one} is already in.`, "success");
      const next = list.map((s, j) => s || j === i);
      setList(next);
      const n = next.filter(Boolean).length;
      if (n === count) return award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), allIn, key);
      return showHint(`${One} in: ${n} of ${count}.`, "success");
    }
    if (!list[i]) return showHint(`That ${one} is already out.`, "success");
    const s = safetyBlock(power);
    if (s) return miss(s.key, s.msg, "safety");
    const next = list.map((s2, j) => s2 && j !== i);
    setList(next);
    const left = next.filter(Boolean).length;
    if (left === 0) return award(k, actionPoints(basePoints(mode, key), misses.current[k] || 0), allOut, key);
    showHint(`${One} out: ${left} still in.`, "success");
  }

  // Where each header is right now (case space), and which ones exist.
  const portPos = {
    atx24: [L.atx24[0], L.atx24[1], L.pcbFront + (L.atx24[2] ?? HEADER_HEIGHT)], // a board can seat it deeper (MOUNTS.atx24[2])
    eps8: [L.eps8[0], L.eps8[1], L.pcbFront + HEADER_HEIGHT],
    pcie: gpuPort ? [L.gpu[0] + gpuPort[0], L.gpu[1] + gpuPort[1], L.gpu[2] + gpuPort[2]] : null,
    pcie6: gpuPort6 ? [L.gpu[0] + gpuPort6[0], L.gpu[1] + gpuPort6[1], L.gpu[2] + gpuPort6[2]] : null,
  };
  const portOpen = (p) => (p === "pcie" ? installed.gpu && !!gpuPort : p === "pcie6" ? installed.gpu && !!gpuPort6 : !!installed.motherboard);

  // Where a cable's PSU end leaves the PSU in the case: the end of its plug's wires (case space).
  function psuWireEnd(c) {
    const fixedOut = psuFixed && isFixed(c) ? psuFixed.cables[c]?.out : null;
    if (fixedOut) return psuToCase([fixedOut[0], fixedOut[1], psuFixed.face - 0.05]);
    if (!psuPanel || !psuPanel.sockets[sockOf(c)]) return PSU_FIXED_OUT;
    const at = psuPanel.sockets[sockOf(c)].at;
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
    pose.ghost = cableRoute(c, psuWireEnd(c), [pose.pos[0], pose.pos[1], pose.pos[2] + out]);
    return pose;
  }

  // The PSU ends to draw in the PSU's sockets: plugged in, or on their way in.
  const psuPlugs = {};
  if (psuPanel) {
    CABLE_IDS.filter((c) => !isFixed(c) && psuPanel.sockets[CABLES[c].psuSocket]).forEach((c) => {
      const connecting = cableTask?.cable === c && cableTask.end === "psu" && cableTask.port;
      if (psuCables[c]) {
        const unplugNow = mode === "disassemble" && !cables[c] && power.discharged;
        psuPlugs[c] = { socket: sockOf(c), seated: true, flipped: false, waiting: unplugNow };
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
        cables={CABLE_IDS.filter((c) => isFixed(c) && cableNeeded(c, picks)).map((c) => ({
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
      if (isFixed(cableTask.cable)) return { key, target: [x - 0.1, y + 0.1, z + 0.5], position: [x - 0.05, y + 1.25, z + 2.05] };
      return { key, target: [x, y + 0.2, z + 0.3], position: [x + 0.25, y + 0.75, z + 1.55] };
    }
    const p = portPos[cableTask.cable];
    if (!p) return null;
    const at = toWorldPose(p, [0, 0, 0], rig).position;
    const off = rig.laidDown ? [0.2, 1.5, 0.35] : [0.3, 0.25, 1.5];
    return { key, target: at, position: [at[0] + off[0], at[1] + off[1], at[2] + off[2]] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cableTask?.cable, cableTask?.end, installed.psu, rig, L]);

  // The power cord: the camera goes round to the back of the case, then to the power strip.
  const cordFocus = useMemo(() => {
    if (!cordTask) return null;
    if (cordTask.end === "wall") {
      const [x, y, z] = STRIP_SOCKET;
      return { key: "cord:wall", target: [x - 0.1, y + 0.1, z + 0.1], position: [x + 0.3, y + 1.15, z + 1.35] };
    }
    const at = toWorldPose(psuToCase([psuInlet.at[0], psuInlet.at[1], psuInlet.rim]), [0, 0, 0], rig).position;
    return { key: "cord:psu", target: at, position: [at[0] - 1.45, at[1] + 0.5, at[2] + 0.7] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cordTask?.end, rig, psuInlet]);

  // A RAM stick picked up with a click moves the camera in on the DIMM slots; once it is in (or put
  // down) the camera glides back to the bench, where the next stick is.
  const ramHeld = !arLike && mode === "assemble" && (selectedPart === "ram1" || selectedPart === "ram2") ? selectedPart : null;
  const ramFocus = useMemo(() => {
    if (!ramHeld) return null;
    // the slots' middle, moved a little toward their numbered (lower) ends so those stay in view
    const along = ramSlotMarks[0].along;
    const len = Math.hypot(...along) || 1;
    const c = [0, 1, 2].map((k) => ramTargets.reduce((sum, t) => sum + t.position[k], 0) / ramTargets.length - (along[k] / len) * 0.1);
    const off = !boardMounted ? [0.05, 0.85, 0.5] : rig.laidDown ? [0.1, 1.0, 0.3] : [0.25, 0.2, 1.05];
    return { key: `ram:${ramHeld}`, target: c, position: [c[0] + off[0], c[1] + off[1], c[2] + off[2]] };
  }, [ramHeld, ramTargets, ramSlotMarks, boardMounted, rig]);

  // Putting the paste on: the camera looks straight down at the CPU's lid.
  const pasteFocus = useMemo(() => {
    if (!pasteTask || !installed.cpu) return null;
    const c = cpuTarget.position;
    const d = window.innerWidth < window.innerHeight ? 0.5 : 0.42; // a narrow screen stands back, to fit the lid across
    const off = !boardMounted || rig.laidDown ? [0, d, d * 0.25] : [0, d * 0.25, d];
    return { key: "paste", target: c, position: [c[0] + off[0], c[1] + off[1], c[2] + off[2]] };
  }, [!!pasteTask, !!installed.cpu, cpuTarget, boardMounted, rig]); // eslint-disable-line react-hooks/exhaustive-deps
  const pasteZoom = useCallback((factor) => viewRef.current?.zoom(factor), []);

  // every case and fan wire is on its header, the right way round
  const wiresDone = WIRE_IDS.every((id) => wireRight(id, wires[id]));

  // every cable this build needs is in at both ends
  const cablesDone =
    !!picks.psu &&
    CABLE_IDS.filter((c) => cableNeeded(c, picks)).every((c) => psuEndDone(c, picks, psuCables) && cables[c]);

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
        if (trouble) return; // troubleshooting: the crash is the clue, the PC stays as it was
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
    setTroubleLog((l) => (l.poweredOn ? l : { ...l, poweredOn: true }));
    if (installed.motherboard && screws.some((s) => !s)) {
      return miss(
        "screws",
        "Screw the motherboard down before powering on. A loose board can flex and short against the case.",
        "safety"
      );
    }
    if (installed.psu && psuScrews.some((s) => !s)) {
      return miss("psu_screws", "Screw the PSU to the case before powering on. A loose PSU can shift and pull on its cables.", "safety");
    }
    if (installed.gpu && gpuScrews.some((s) => !s)) {
      return miss("gpu_screws", "Screw the graphics card's bracket to the case before powering on. A loose card can rock out of its slot.", "safety");
    }
    setPower({ ...POWER_ON }); // a teardown's safety steps start over
    const result = evaluateBoot({ installed, pasteApplied, pasteThin, ramSlot, picks, cables: liveCables, wires, headers, psuSockOf, cord }, { hints: hintsOn });
    // troubleshooting: the task is done when the PC starts with nothing wrong
    const clean = trouble && faultsNow.length === 0;
    if (result.status === "dead") {
      reportEvent("bootfail", result.part || "psu", result.message);
      showHint(result.message);
      return;
    }
    clearTimers();
    // no graphics card and none built into the CPU: the PC runs, the monitor gets no picture
    if (result.status === "nosignal") {
      reportEvent("bootfail", result.part, result.message);
      setMonitor({ status: "nosignal" });
      showHint(result.message);
      return;
    }
    const { lowRes } = result;
    // a stronger build starts faster (it shows on the screen, and the wait is that much shorter)
    const seconds = bootTime({ installed, picks, ramSlot });
    setMonitor({ status: "booting", lowRes });
    later(() => {
      if (result.status === "overheat") {
        reportEvent("bootfail", "cpu_cooler", result.cause);
        runOverheat(lowRes, result.detail, result.fix);
        return;
      }
      setMonitor(result.status === "hello" ? { ...result, seconds } : result);
      if (result.status === "post") reportEvent("bootfail", "post", `${result.title}: ${result.code}`);
      if (result.status === "hello") {
        setBooted(true);
        if (clean) setTroubleOk(true);
        const points = POINTS.bootBase + (result.ramCount === 2 ? POINTS.bootDualRam : 0) + (lowRes ? 0 : POINTS.bootGpu);
        const more = scored && !trouble ? " for more points" : " for a faster PC";
        // what's off on the case (a dark power light, dead front USB...) comes first: something to fix
        const odd = result.symptoms?.[0];
        const left = faultsNow.length;
        const message = clean
          ? `Started in ${seconds} s, with nothing odd on the case. The PC is fixed!`
          : odd
          ? `Started in ${seconds} s, but check the case: ${odd.text}${odd.cause ? ` ${odd.cause}` : ""}`
          : trouble
          ? `Started in ${seconds} s.${help.faultsLeft ? ` Still ${left} thing${left === 1 ? "" : "s"} to fix.` : ""}`
          : lowRes
          ? `Started in ${seconds} s on the CPU's built-in graphics: the picture is low and blocky. Add a graphics card${more}.`
          : result.ramCount === 2
          ? `Started in ${seconds} s. Build complete!`
          : `Started in ${seconds} s. Add a second RAM stick${more}.`;
        if (odd) reportEvent("bootfail", "wires", result.symptoms.map((x) => x.text).join(" "));
        award(ledgerKey("assemble", "boot"), points, message, "boot");
      }
    }, result.status === "hello" ? 700 + seconds * 330 : 2200);
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
    setPaste(null);
    setPasteTask(null);
    setRamSlot(s.ramSlot);
    setCables(s.cables ?? NO_CABLES);
    setPsuCables(s.psuCables ?? NO_CABLES);
    setScrews(s.screws ?? NO_SCREWS);
    setPsuScrews(s.psuScrews ?? NO_PSU_SCREWS);
    setGpuScrews(s.gpuScrews ?? NO_GPU_SCREWS);
    setM2(s.m2 ?? m2Start(s.installed.storage));
    setSocket(s.socket ?? socketStart(s.installed.cpu));
    setCableTask(null);
    setCableDrawer(false);
    setPsuSockOf(s.psuSockOf ?? {});
    setWires(s.wires ?? wiresStart(false));
    setWireTask(null);
    setCord(s.cord ?? NO_CORD);
    setCordTask(null);
    setPower(pm.power);
    setMonitor(pm.monitor);
    setMotherboardPos(s.installed.motherboard ? MOTHERBOARD_TARGET.position : trayPosition("motherboard"));
    setFlights({});
    setBooted(false);
    setTroubleOk(false);
    setTroubleLog({ poweredOn: false, madeSafe: false });
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
    setPasteTask(null);
    if (!pasteApplied) setPaste(null); // left half way: no paste
    setCableTask(null);
    setCordTask(null);
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
      if (monitor.status === "hello") setMonitor((m) => ({ ...m, safety: SAFETY_NOTE }));
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
  // A graded lab run as an exam, under the instructor's lockdown rule (components/lab/ExamGuard.jsx):
  // full screen, leaving it reported, no copy or print, the student's name and ID across the view.
  const exam = inClass && classPhase === "running" && !!cfg.lockdown;
  const examWho = [
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email,
    [profile?.studentId, profile?.section].filter(Boolean).join(" · "),
  ];
  const assigned = inClass && labSession.session ? studentSetup(labSession.session, labSession.me) : null;
  // A new task, or a change to what the task starts with, sends the student back to its start.
  const assignKey = assigned
    ? `${assigned.task.id}|${assigned.startMode}|${assigned.platform}|${assigned.partPicking}|${JSON.stringify(assigned.scenario ?? null)}`
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
  const phaseDone = trouble
    ? troubleOk
    : phaseActions > 0 &&
    (mode === "disassemble" ? isFullyStripped(installed, Object.fromEntries(psuSocketed(picks).map((c) => [c, psuCables[c]]))) : isFullyBuilt(installed, picks) && m2Done(m2, installed) && socketDone(socket, installed) && wiresDone && booted);
  const canToggle =
    cfg.modeControl === "student" && (cfg.toggle === "free" || (cfg.toggle === "afterComplete" && phaseDone));
  // a build is the required parts plus any optional ones picked (second RAM stick, graphics card)
  const partsLeft =
    mode === "assemble" ? buildSlots(picks).filter((p) => !installed[p]).length : ALL_PARTS.filter((p) => installed[p]).length;

  useEffect(() => {
    if (phaseDone) commitOpenActions(); // finishing a phase locks in its actions
    // The task is done the first time its own phase (build + boot, or full teardown) is finished, or
    // (troubleshooting) the PC starts with nothing wrong: every fault fixed, and the start's points.
    if (phaseDone && task && (trouble || mode === task.mode) && !taskDone) {
      setTaskDone(trouble ? { ms: Math.round(troubleMs), earned: troubleTotal(task) } : { ms: Math.round(phaseMs.current[mode]) });
      setTaskOpen(true);
      reportEvent("task", task.mode, `Finished the task: ${task.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseDone]);

  /* ---------- phase clock (class only): counts up, slower work keeps fewer points ---------- */
  const clockOn = scored && !!setup && !phaseDone && (classPhase === "running" || preview);
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

  // troubleshooting counts the whole job, building and taking apart together
  const elapsed = trouble ? troubleMs : phaseMs.current[mode];
  const factorNow = trouble ? timeFactor(troubleMs, parMs) : scoreInfo.factor[mode];

  // a fault fixed (or undone) shows on the score, when the student may see how many are left
  const fixedKey = fixedIds.join(",");
  const lastFixed = useRef(null);
  useEffect(() => {
    const before = lastFixed.current;
    lastFixed.current = fixedIds;
    if (!trouble || !before || !help.faultsLeft || taskDone) return;
    const pts = (list) => Math.round((list.reduce((s, id) => s + task.faultPoints[id], 0) * outOf) / Math.max(1, troubleTotal(task)));
    const gained = pts(fixedIds.filter((id) => !before.includes(id)));
    const lost = pts(before.filter((id) => !fixedIds.includes(id)));
    if (gained) pushPopup(`+${gained}`, "success");
    if (lost) pushPopup(`-${lost}`, "fail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedKey]);

  // The instructor's live table. Time is sent in 15 s steps so a class doesn't flood Firestore.
  const timeBucket = `${Math.floor(phaseMs.current.assemble / 15000)}:${Math.floor(phaseMs.current.disassemble / 15000)}`;
  useEffect(() => {
    if (!inClass || classPhase !== "running") return;
    labSession.pushProgress({
      mode, platform, partsLeft, mistakes, phaseDone,
      taskId: task?.id ?? null, taskDone: !!taskDone, taskMs: taskDone?.ms ?? 0,
      faultsFixed: trouble ? fixedIds.length : null, faultsTotal: trouble ? faultIds.length : null,
      score: official, scoreScale: outOf, points: scoreInfo.total,
      assemble: scoreInfo.assemble, disassemble: scoreInfo.disassemble, penalty: scoreInfo.penalty,
      assembleMs: Math.round(phaseMs.current.assemble), disassembleMs: Math.round(phaseMs.current.disassemble),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inClass, classPhase, mode, platform, partsLeft, mistakes, phaseDone, scoreRev, timeBucket, taskDone, fixedKey]);

  /* ---------- selection (AR taps) ---------- */
  function trySelect(name) {
    if (gestures.consumeSuppress()) return;
    inspect(name);
    const b = installBlock(name, installed, picks, psuCables, m2, socket);
    if (b) {
      reportEvent("blocked", name, b.msg);
      showHint(b.msg);
      return;
    }
    setSelectedPart(name);
  }

  // RAM on a computer: a click picks the stick up (another click puts it down); its free slots then
  // show their numbers. Two sticks run in dual channel in slots 1+3 or 2+4.
  const dualSlot = (name, slot) => {
    const other = ramSlot[name === "ram1" ? "ram2" : "ram1"];
    return other != null ? Math.abs(other - slot) === 2 : slot === 0 || slot === 2;
  };
  function tapRam(name) {
    if (selectedPart === name) {
      setSelectedPart(null);
      return showHint(`${PART_LABEL[name]} put down.`, "success");
    }
    const b = installBlock(name, installed, picks, psuCables, m2, socket);
    if (b) {
      reportEvent("blocked", name, b.msg);
      return showHint(b.msg);
    }
    setSelectedPart(name);
    const other = ramSlot[name === "ram1" ? "ram2" : "ram1"];
    const pair =
      other != null
        ? `slot ${other < 2 ? other + 3 : other - 1} pairs with the stick in slot ${other + 1} for dual channel`
        : "slots 1 and 3 together run in dual channel";
    showHint(`${PART_LABEL[name]} picked up. Click a slot to push it in${hintsOn ? `: ${pair}` : ""}.`, "success");
  }
  const ramPicking = selectedPart === "ram1" || selectedPart === "ram2" ? selectedPart : ramDrag;

  useEffect(() => {
    if (!selectedPart || arLike) return;
    const onKey = (e) => e.key === "Escape" && setSelectedPart(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPart, arLike]);

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
        resetGestures();
      });
      setPlacement(null);
      resetGestures();
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
      resetGestures();
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
    resetGestures();
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
    if (!root || exploding || pasteTask) return;
    raycaster.current.set(origin, dir.normalize());
    for (const h of raycaster.current.intersectObject(root, true)) {
      let o = h.object;
      let id = null;
      while (o && !id) {
        id = o.userData?.partId || null;
        o = o.parent;
      }
      if (!id) continue;
      if (id.startsWith("wire:") && wireSpots.length) continue; // choosing a header: plugs let the tap through
      if (id.startsWith("target:")) {
        const [n, sl] = id.slice(7).split(":");
        install(n, sl === undefined ? undefined : Number(sl));
      } else if (id.startsWith("cable:")) clickCable(id.slice(6));
      else if (id.startsWith("wire:")) clickWire(id.slice(5));
      else if (id.startsWith("header:")) chooseHeader(id.slice(7));
      else if (id.startsWith("psucable:")) clickPsuCable(id.slice(9));
      else if (id.startsWith("psuport:")) chooseSocket(id.slice(8));
      else if (id.startsWith("psufixed:")) routeFixed(id.slice(9));
      else if (id.startsWith("cordport:")) chooseCordPort(id.slice(9));
      else if (id.startsWith("cord:")) clickCord(id.slice(5));
      else if (id === "m2cover") clickM2Cover();
      else if (id === "socketlever") clickLever();
      else if (id === "socketplate") clickPlate();
      else if (id === "socketcap") clickCap();
      else if (id.startsWith("m2coverscrew:")) clickCoverScrew(Number(id.slice(13)));
      else if (id === "m2screw") clickSsdScrew();
      else if (id.startsWith("port:")) choosePort(id.slice(5));
      else if (id.startsWith("screw:")) clickScrew(Number(id.slice(6)));
      else if (id.startsWith("psuscrew:")) clickPartScrew("psu", Number(id.slice(9)));
      else if (id.startsWith("gpuscrew:")) clickPartScrew("gpu", Number(id.slice(9)));
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
    locked: !!removeBlock(name, installed, power, links),
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

  // The M.2 slot's next step bobs: the cover's screws, the cover, the SSD's screw, the cover on the bench.
  const handsOn = mode === "assemble" || power.discharged;
  const m2Wait = (() => {
    const screwsIn = m2.coverScrews.filter(Boolean).length;
    const ssdIn = !!installed.storage;
    if (!handsOn || m2.cover === "off") {
      return {
        ssdScrew: handsOn && ssdIn && (mode === "assemble" ? !m2.ssdScrew : m2.ssdScrew),
        bench: handsOn && mode === "assemble" && ssdIn && m2.ssdScrew,
      };
    }
    // the cover is on: building, it comes off for a new SSD and goes back down over a screwed one
    const coverOff = mode === "assemble" ? !ssdIn : ssdIn;
    return {
      coverScrews: coverOff ? screwsIn > 0 : ssdIn && m2.ssdScrew && screwsIn < M2_COVER_SCREWS,
      cover: coverOff && screwsIn === 0,
    };
  })();

  // The socket's next move nudges: open it for a CPU (or, taking apart, to free one once the cooler
  // is off), then close the frame and lock the lever over a new CPU.
  const socketWait = (() => {
    if (!handsOn) return {};
    const lga = sockKind === "lga";
    const opening = mode === "assemble" ? !installed.cpu : installed.cpu && !installed.cpu_cooler;
    if (opening) return { lever: socket.lever === "down", plate: lga && socket.lever === "up" && socket.plate === "closed" };
    // taken apart: AM5's cap goes back on the empty socket
    if (mode !== "assemble") return { bench: lga && !installed.cpu && !socket.cap };
    return { plate: lga && socket.plate === "open", lever: socket.lever === "up" && (!lga || socket.plate === "closed") };
  })();

  // The board group is stretched by the board's own fit (L.scale); the parts on it are wrapped in
  // <TrueSize unstretch={unstretch}> so they keep their real proportions instead of stretching with it.
  const unstretch = [1 / L.scale[0], 1 / L.scale[1], 1 / L.scale[2]];
  // AM4: the CPU slides with the socket's top plate (socket frame y is board y; board units are stretched)
  const cpuSlide = sockLook.top ? [0, sockLook.top.slide[1] * unstretch[1], 0] : [0, 0, 0];
  const moboBody = (
    <group rotation={boardMounted ? MOBO_MOUNTED_ROTATION : MOBO_LYING_ROTATION} scale={L.scale}>
      <PartModel category="motherboard" variant={variantOf("motherboard")} />

      {installed.cpu && (
        <Blast active={exploding} power={1.2} outZ={-1} position={L.cpuLocal}>
          <SocketSlide open={socket.lever === "up"} offset={cpuSlide}>
            {wrapPull(
              "cpu",
              <TrueSize unstretch={unstretch} rotation={[Math.PI / 2, 0, Math.PI]}>
                <PartModel category="cpu" variant={variantOf("cpu")} />
                {pasteTask === "draw" && pasteWork ? (
                  <>
                    <ThermalPaste variant={variantOf("cpu")} work={pasteWork} />
                    <PasteStage variant={variantOf("cpu")} work={pasteWork} />
                  </>
                ) : (
                  (pasteApplied || paste) && (
                    <ThermalPaste variant={variantOf("cpu")} dabs={paste?.dabs ?? null} squeezed={paste ? paste.squeezed : true} />
                  )
                )}
              </TrueSize>
            )}
          </SocketSlide>
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

      {sockLook.top && (
        <group position={L.cpuLocal}>
          <TrueSize unstretch={unstretch} rotation={SOCKET_ROTATION}>
            <SocketSlide open={socket.lever === "up"} offset={sockLook.top.slide}>
              {/* parts drawn from the board file load with it: their own boundary, so the bench stays up */}
              <Suspense fallback={null}>
                <sockLook.top.Body />
              </Suspense>
            </SocketSlide>
          </TrueSize>
        </group>
      )}

      {/* the CPU socket's lever and its hook, and AM5's cover frame (x right, y up the board, z out) */}
      {!exploding && (
        <group position={L.cpuLocal}>
          <TrueSize unstretch={unstretch} rotation={SOCKET_ROTATION}>
            <LeverHook hook={sockLook.hook} />
            <Suspense fallback={null}>
              <SocketLever lever={sockLook.lever} up={socket.lever === "up"} waiting={socketWait.lever} onClick={clickLever} />
            </Suspense>
            {sockLook.plate && (
              <SocketPlate
                plate={sockLook.plate}
                open={socket.plate === "open"}
                cap={socket.cap}
                waiting={socketWait.plate}
                onClick={clickPlate}
              />
            )}
          </TrueSize>
        </group>
      )}

      {/* the M.2 slot: the SSD's own screw, and the cover over it while the cover is on the board */}
      {!exploding && (
        <group position={L.storageLocal}>
          <TrueSize unstretch={unstretch} rotation={STORAGE_MOUNT_ROTATION}>
            {installed.storage && (
              <SsdScrew driven={m2.ssdScrew} waiting={m2Wait.ssdScrew} onClick={clickSsdScrew} />
            )}
            {m2.cover === "on" && (
              <Suspense fallback={null}>
                <M2Cover
                  look={m2Look}
                  screws={m2.coverScrews}
                  coverWaiting={m2Wait.cover}
                  screwsWaiting={m2Wait.coverScrews}
                  onCover={clickM2Cover}
                  onScrew={clickCoverScrew}
                />
              </Suspense>
            )}
          </TrueSize>
        </group>
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
        locked={!!installBlock(name, installed, picks, psuCables, m2, socket)}
        isSelected={selectedPart === name}
        onClick={() => trySelect(name)}
        onCorrect={(k) => install(name, isRam ? free[k ?? 0].slot : undefined)}
        onIncorrect={() => miss(name, c.wrong, "miss")}
        snapByPointer={isRam}
        onTap={isRam && !arLike ? () => tapRam(name) : undefined}
        onDragChange={isRam ? (on) => setRamDrag(on ? name : null) : undefined}
      >
        <group userData={{ partId: name }} onPointerDown={() => inspect(name)}>{body}</group>
      </DraggablePart>
    );
  };

  /* ---------- control buttons ---------- */
  const modeButton = {
    key: "mode",
    icon: "swap",
    label: cfg.modeControl === "instructor" ? `Mode: ${mode === "assemble" ? "Assemble" : "Disassemble"}` : mode === "assemble" ? "Switch to disassemble" : "Switch to assemble",
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

  // the thermal paste and the cables are in the parts rail (components/lab/PartPicker.jsx). work: this
  // mode's job, after the ones that are always there; a teardown's safety steps show which comes next
  const shuttingDown = monitor.status === "shuttingDown";
  const buttons = [
    {
      key: "reset", icon: "undo", label: "Reset", danger: true, disabled: exploding,
      title: inClass ? "Starts the bench over. Your score and time are kept." : "Start over",
      onPress: () => {
        if (inClass) reportEvent("reset", "bench", "Reset the bench");
        resetBuild();
      },
    },
    modeButton,
    { key: "tilt", icon: "pcCase", turned: !isLaidDown, label: isLaidDown ? "Stand up" : "Lay down", onPress: () => setIsLaidDown((v) => !v) },
    ...(mode === "assemble"
      ? [
          {
            key: "power", work: true, icon: "power", label: monitor.status !== "off" ? "Power off" : "Power on",
            lit: monitor.status !== "off", accent: monitor.status === "off", disabled: exploding, onPress: pressPower,
          },
        ]
      : [
          {
            key: "shutdown", work: true, icon: "power",
            label: shuttingDown ? "Shutting down…" : "Shut down",
            lit: power.shutdown, done: power.shutdown, dim: shuttingDown,
            accent: hintsOn && !power.shutdown && !shuttingDown, onPress: doShutdown,
          },
          {
            key: "unplug", work: true, icon: "cable", label: power.unplugged ? "Unplugged" : "Unplug",
            lit: power.unplugged, done: power.unplugged, dim: !power.shutdown && !power.unplugged,
            accent: hintsOn && power.shutdown && !power.unplugged, onPress: unplug,
          },
          {
            key: "discharge", work: true, icon: "bolt", label: power.discharged ? "Drained" : "Drain power",
            title: "Hold the power button for a few seconds with the cord out",
            lit: power.discharged, done: power.discharged, dim: !power.unplugged && !power.discharged,
            accent: hintsOn && power.unplugged && !power.discharged, onPress: discharge,
          },
          {
            key: "wipe", work: true, icon: "paste", label: !pasteApplied ? "Paste wiped" : "Wipe paste",
            lit: !pasteApplied, done: !pasteApplied, dim: pasteApplied && (!!installed.cpu_cooler || !installed.cpu),
            accent: hintsOn && power.discharged && pasteApplied && !installed.cpu_cooler && !!installed.cpu, onPress: wipePaste,
          },
        ]),
  ];

  /* ---------- render ---------- */
  if (!setup) {
    return (
      <StartScreen
        onPractice={startPractice}
        opening={autoJoin === "joining"}
        status={autoJoin === "joining" ? null : autoJoin}
        backTo={fromClass ? `/classes/${fromClass}` : null}
      />
    );
  }

  const classLocked = inClass && classPhase !== "running"; // waiting for the instructor, or class over
  const steps = expertSteps(mode, { installed, picks, pasteApplied, booted, power, cord, cables, screws, psuScrews, gpuScrews, psuCables, m2, socket, wires });
  // only steps that must happen in order get a "next" highlight (a teardown's parts can go in any order)
  const nextStep = steps.findIndex((s) => !s.done && !s.anyOrder);
  const stepsDone = steps.filter((s) => s.done).length;
  // the guide card's headline: the step to do now (all a closed card shows)
  const nowStep =
    nextStep >= 0 ? steps[nextStep].label : stepsDone < steps.length ? "Take the parts out in any order" : "Every step done";
  const orderedSteps = steps.filter((s) => !s.anyOrder);
  const anyOrderSteps = steps.filter((s) => s.anyOrder);
  const showStepCount = !task || (help.steps && !trouble); // the guide card's count and bar
  // the parts rail, with the thermal paste and the cables docked at its end (when the parts come laid out, those alone)
  const showPicker = mode === "assemble" && !classLocked && !pasteTask;

  const showMarkers = arLike && mode === "assemble" && selectedPart;

  // where the power cord's plugs are: out, on their way in (they bob, and take the next click), or in
  const iecAt = !installed.psu || exploding ? "out" : cord.psu ? "in" : cordTask?.end === "psu" && cordTask.ready ? "hover" : "out";
  const wallAt = exploding ? "out" : cord.wall ? "in" : cordTask?.end === "wall" && cordTask.ready ? "hover" : "out";
  const tagsOn = !cableTask && !cordTask && !pasteTask; // name tags are hidden while the camera is up close
  // a teardown isn't safe until the PC is off, unplugged and drained (with hints off, working that out is the test)
  const notSafeYet = mode === "disassemble" && hintsOn && !power.discharged && !classLocked && !pasteTask && !exploding;
  const safetyStrip = notSafeYet && (
    <p className="lab-safety" role="alert">
      <Icon name="alert" size={16} strokeWidth={2.4} />
      <span>
        <strong>Not safe to touch yet.</strong> {!power.shutdown ? "Shut it down first." : !power.unplugged ? "Unplug it next." : "Drain the power next."}
      </span>
    </p>
  );
  const screen = screenStatus(monitor);
  const screenLine = screenSays(monitor, userName);

  return (
    <div className="assemble">
      <header className="assemble__bar">
        <Link to={fromClass ? `/classes/${fromClass}?tab=labs` : "/main"} className="assemble__back focus-ring" aria-label="Exit lab">
          <Icon name="back" size={16} />
          <span className="assemble__back-label">Exit Lab</span>
        </Link>

        <span className="assemble__logo">
          <Logo size={32} />
        </span>
        <div className="assemble__title-group">
          <h1>Build Lab</h1>
          <span className="assemble__badge-sub">
            {`${inClass ? "" : preview ? "Preview · " : "Free build · "}${trouble ? "Troubleshoot · " : ""}${mode === "assemble" ? "Assemble" : "Disassemble"}${inClass ? ` · class ${labSession.code}` : ""}`}
          </span>
        </div>

        <div className={`assemble__actions ${scored ? "is-scored" : ""}`}>
          <div className="assemble__selection-indicator">
            {mode === "assemble" && arLike && selectedPart ? (
              <>Selected: <strong>{selectedPart.toUpperCase()}</strong> (tap the green marker)</>
            ) : mode === "disassemble" && hovered ? (
              <>{arLike ? "Tap to remove" : "Drag to pull out"}: <strong>{PART_LABEL[hovered].toUpperCase()}</strong></>
            ) : trouble ? (
              help.faultsLeft ? <>Fixed: <strong>{fixedIds.length} of {faultIds.length}</strong></> : <>Find what's wrong</>
            ) : (
              <>Parts left: <strong>{partsLeft}</strong></>
            )}
          </div>

          {scored && (
          <div
            className={`assemble__clock ${factorNow < 1 ? "is-slow" : ""}`}
            title={
              trouble
                ? `Target ${cfg.parMin} min for the whole job. After that the points slowly drop, down to half at ${cfg.parMin * 3} min.`
                : `Target ${cfg.parMin} min per phase. After that the phase's points slowly drop, down to half at ${cfg.parMin * 3} min.`
            }
          >
            <span className="assemble__score-label">Time</span>
            <span className="assemble__clock-value">{formatClock(elapsed)}</span>
            <span className="assemble__clock-factor">{Math.round(factorNow * 100)}%</span>
          </div>
          )}

          {scored && (
          <div className="assemble__score-card-wrapper">
            <div
              className="assemble__score-card"
              title={
                trouble
                  ? scoreShown
                    ? `Score ${official} out of ${outOf}: ${fixedIds.length} of ${faultIds.length} faults fixed, ${Math.round(factorNow * 100)}% for time · Mistakes ${mistakes}`
                    : "Your score shows once the PC is fixed."
                  : `Official score ${official} out of ${outOf}. Points for the task: ${officialCard[taskMode]} of ${maxPts} (${Math.round(officialCard.factor[taskMode] * 100)}% for time) · Penalties -${scoreInfo.penalty} · Mistakes ${mistakes}`
              }
            >
              <span className="assemble__score-label">Score</span>
              <span className="assemble__score-value">{scoreShown ? official : "?"}<small className="assemble__score-max">/{outOf}</small></span>
            </div>
            <div className="assemble__popup-container">
              {popups.map((p) => (
                <span key={p.id} className={`assemble__floating-popup assemble__floating-popup--${p.type}`}>{p.points}</span>
              ))}
            </div>
          </div>
          )}
          <button
            type="button"
            className={`assemble__rotate-btn focus-ring ${inAR || camMode ? "assemble__rotate-btn--active" : ""}`}
            aria-label={inAR || camMode ? "Exit AR" : "Show the bench in AR"}
            onClick={toggleAR}
          >
            <Icon name={inAR || camMode ? "x" : "cube"} size={16} />
            <span>{inAR || camMode ? "Exit AR" : "AR"}</span>
          </button>

        </div>
      </header>

      <div className="assemble__viewport">
        {/* The screen is only pixels in the 3D view: what it says, for screen readers. Both stay in the page,
            as a change only gets read out in a region that was already there; a good message is read out
            here too, an error by its toast below. */}
        <p className="lab-sr-only" role="status">
          {screen?.level === "bad" ? "" : screenLine} {feedback?.type === "success" ? feedback.text : ""}
        </p>
        <p className="lab-sr-only" role="alert">{screen?.level === "bad" ? screenLine : ""}</p>
        <div className="assemble__scene-container">
          <div
            role="img"
            aria-label={`3D view of the bench, with the PC ${mode === "assemble" ? "being built" : "being taken apart"}. ${screenLine}`}
            style={{ position: "relative", width: "100%", height: "100%", background: camMode ? "transparent" : "#d9dbe0" }}
          >
            {camMode && (
              <video
                ref={videoRef} playsInline muted autoPlay
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
              />
            )}

            <Canvas
              style={{ position: "absolute", inset: 0, zIndex: 1, touchAction: "none" }}
              dpr={renderSettings().dpr} // fewer pixels on phones and weak computers (Three/graphics.js)
              gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
              camera={{ position: HOME_CAM, fov: 45, near: 0.02, far: 200 }}
              onCreated={({ gl }) => gl.setClearAlpha(0)}
            >
              <FitFov enabled={!inAR} />
              <ARContext.Provider value={arLike}>
                <GLBridge glRef={glRef} />
                {!arLike && <CameraFocus focus={pasteFocus || cableFocus || cordFocus || wireFocus || ramFocus} home={HOME_VIEW} />}
                {!arLike && <ViewControls apiRef={viewRef} home={HOME_VIEW} />}
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
                        {tagsOn && benchParts.map((name) => (
                          <TrayLabel key={name} name={name} text={PART_LABEL[name]} sub={traySub(name)} />
                        ))}

                        <CaseRig laidDown={isLaidDown} pose={casePose}>
                          {/* the case's own screws on the card's two slots give way to the card's; its
                              power light shows while the PC is on */}
                          <CaseWithMeasure
                            onMeasure={handleCaseMeasured}
                            hideSlotScrews={!!installed.gpu && !exploding}
                            io={{ powered: monitor.status !== "off" }}
                          />
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

                          {/* the PSU's mains inlet, wherever this model has it: the power cord's plug follows this */}
                          {installed.psu && !exploding && (
                            <group position={PSU_TARGET.position} rotation={PSU_TARGET.rotation}>
                              <group ref={cordInlet} position={[psuInlet.at[0], psuInlet.at[1], psuInlet.rim]} rotation={[Math.PI / 2, 0, 0]} />
                              {cordTask?.end === "psu" && !cordTask.ready && (
                                <PortMarker
                                  partId="cordport:psu"
                                  position={[psuInlet.at[0], psuInlet.at[1], psuInlet.rim + 0.03]}
                                  size={0.085}
                                  pill
                                  dot={PART_DOT.power}
                                  fontSize={0.03}
                                  label={hintsOn && help.labels ? "Power socket" : null}
                                  labelAt={[0, -0.135, 0.05]}
                                  onClick={() => chooseCordPort("psu")}
                                />
                              )}
                            </group>
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

                          {/* the PSU's screws, through the back of the case into the PSU */}
                          {installed.psu &&
                            !exploding &&
                            PSU_SCREWS.map((p, i) => (
                              <BoardScrew
                                key={`psuscrew${i}`}
                                partId={`psuscrew:${i}`}
                                position={p}
                                rotation={[0, 0, Math.PI / 2]}
                                size={BACK_SCREW_SIZE}
                                driven={psuScrews[i]}
                                waiting={mode === "assemble" ? !psuScrews[i] : psuScrews[i] && power.discharged}
                                onClick={() => clickPartScrew("psu", i)}
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
                                    onTop={mode === "assemble" && cableWaiting(c)}
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
                                label={hintsOn && help.labels ? PORT_LABEL[p] : null}
                                pill
                                dot={PART_DOT[p === "pcie" || p === "pcie6" ? "gpu" : "motherboard"]}
                                onClick={() => choosePort(p)}
                              />
                            ))}
                          {cableTask?.end === "part" && cableTask.port && <LatchTab position={latchTab(cableTask.port)} />}

                          {/* the case's and fans' wires on the board's small headers */}
                          {installed.motherboard &&
                            !exploding &&
                            WIRE_IDS.map((id) => {
                              const pose = wirePose(id);
                              if (!pose) return null;
                              return (
                                <group key={`wire-${id}`}>
                                  <CableRun points={pose.ghost} radius={0.005} color={WIRE_GHOST[WIRES[id].group]} ghost />
                                  <HeaderPlug
                                    kind={WIRES[id].plug} colors={WIRES[id].colors} partId={`wire:${id}`}
                                    position={pose.pos} rotation={pose.rot}
                                    plugged={pose.seated} flipped={pose.flipped}
                                    waiting={wireWaiting(id)}
                                    inert={wireSpots.length > 0}
                                    onTop={mode === "assemble" && wireWaiting(id)}
                                    onClick={() => clickWire(id)}
                                  />
                                </group>
                              );
                            })}
                          {installed.motherboard &&
                            wireSpots.map((sp) => {
                              // the front panel's pairs are 2.5 mm apart: small rings, labels above the inner row, below the edge row;
                              // the others' labels go toward the middle of the board, clear of the case and each other
                              const panel = HEADERS[sp].panel;
                              const below = sp === "hdd" || sp === "rst";
                              const hy = headers[sp].at[1];
                              const side = headers[sp].along === "y" ? [-0.04, 0, 0.01] : [0, hy > 0 ? -0.026 : 0.026, 0.01];
                              return (
                                <PortMarker
                                  key={`header-${sp}`} partId={`header:${sp}`}
                                  position={headerPos(sp, 0.014)}
                                  size={panel ? 0.0085 : 0.016}
                                  label={help.labels ? headerLabel(sp, headers) : null}
                                  labelAt={panel ? [0, below ? -0.012 : 0.012, 0.004] : side}
                                  fontSize={panel ? 0.0055 : 0.0085}
                                  hit={panel ? [0.022, 0.0115] : null}
                                  onClick={() => chooseHeader(sp)}
                                />
                              );
                            })}

                          {installed.gpu && (
                            <Blast active={exploding} power={1.1} position={L.gpu} rotation={GPU_TARGET.rotation}>
                              {wrapPull("gpu", <PartModel category="gpu" variant={variantOf("gpu")} spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />)}
                            </Blast>
                          )}

                          {/* the card's screws, in the notches of its bracket's side tab */}
                          {installed.gpu &&
                            !exploding &&
                            GPU_SCREWS.map((p, i) => (
                              <BoardScrew
                                key={`gpuscrew${i}`}
                                partId={`gpuscrew:${i}`}
                                position={p}
                                rotation={GPU_SCREW_ROTATION}
                                size={BACK_SCREW_SIZE}
                                shank={GPU_SCREW_SHANK}
                                driven={gpuScrews[i]}
                                waiting={mode === "assemble" ? !gpuScrews[i] : gpuScrews[i] && power.discharged}
                                onClick={() => clickPartScrew("gpu", i)}
                              />
                            ))}
                        </CaseRig>

                        {/* the mains power: the strip on the bench; the cord only once it's out of the Cables compartment */}
                        <PowerStrip />
                        <PowerCord
                          anchor={cordInlet}
                          iec={iecAt}
                          wall={wallAt}
                          stored={exploding || (!cord.psu && !cord.wall && !cordTask)}
                          onIec={() => clickCord("psu")}
                          onWall={() => clickCord("wall")}
                        />
                        {cordTask?.end === "wall" && !cordTask.ready && (
                          <group position={STRIP_SOCKET} rotation={[-Math.PI / 2, 0, 0]}>
                            <PortMarker
                              partId="cordport:wall"
                              position={[0, 0, 0.02]}
                              size={0.11}
                              pill
                              dot={PART_DOT.power}
                              fontSize={0.035}
                              label={hintsOn && help.labels ? "Socket" : null}
                              labelAt={[0, 0.15, 0.13]}
                              onClick={() => chooseCordPort("wall")}
                            />
                          </group>
                        )}

                        {/* the thermal paste isn't on the bench: it's docked in the parts rail (PartPicker) */}
                        {benchParts.map(renderTrayPart)}
                        {sockLook.cap && !socket.cap && !!picks.motherboard && !exploding && (
                          <SocketCapOnBench
                            size={sockLook.cap.size}
                            position={trayPosition("socketcap")}
                            label={hintsOn ? "Socket cover" : null}
                            waiting={socketWait.bench}
                            onClick={clickCap}
                          />
                        )}
                        {m2.cover === "off" && !exploding && (
                          <Suspense fallback={null}>
                            <M2CoverOnBench
                              look={m2Look}
                              position={trayPosition("m2cover")}
                              label={hintsOn ? "M.2 cover" : null}
                              waiting={m2Wait.bench}
                              onClick={clickM2Cover}
                            />
                          </Suspense>
                        )}

                        {!arLike && mode === "assemble" && !exploding && ramPicking && !installed[ramPicking] &&
                          (ramPicking === "ram1" ? ram1Free : ram2Free).map((t) => (
                            <RamSlotMarker
                              key={t.slot}
                              number={t.slot + 1}
                              showNumber={help.ramNumbers}
                              mark={ramSlotMarks[t.slot]}
                              good={hintsOn && dualSlot(ramPicking, t.slot)}
                              onPlace={selectedPart === ramPicking ? () => install(ramPicking, t.slot) : undefined}
                            />
                          ))}
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
                    minDistance={0.2} maxDistance={25} maxPolarAngle={Math.PI / 2.05}
                    zoomToCursor zoomSpeed={1.3}
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
          {/* first, so everything else stays on top of it */}
          {pasteTask && !classLocked && <PasteCapture work={pasteTask === "draw" ? pasteWork : null} onZoom={arLike ? null : pasteZoom} />}

          {/* AR: the status, Move / Exit AR and any AR error, in one row under the parts strip */}
          {(inAR || camMode || arError) && (
            <div className={`lab-ar-top ${showPicker ? "is-beside-picker" : ""}`}>
              {arLike && (
                <div className="lab-ar-top__status">
                  <span className="lab-pill is-strong">
                    {scored && scoreShown ? `SCORE ${official}/${outOf} · ` : ""}
                    {trouble ? (help.faultsLeft ? `FIXED ${fixedIds.length}/${faultIds.length}` : "FIND WHAT'S WRONG") : `PARTS LEFT ${partsLeft}`}
                  </span>
                  <span className="lab-pill">
                    {mode === "disassemble"
                      ? "Tap a part to remove it"
                      : selectedPart
                      ? `Selected ${selectedPart.toUpperCase()}: tap the green marker`
                      : "Tap a part to pick it up"}
                  </span>
                </div>
              )}
              {(inAR || arLite) && (
                <div className="lab-ar-top__actions">
                  {inAR && placement && (
                    <button type="button" className="flow-btn flow-btn--tool" onClick={() => { setPlacement(null); resetGestures(); }}><Icon name="pin" size={15} />Move</button>
                  )}
                  {arLite && (
                    <button type="button" className="flow-btn flow-btn--tool" onClick={() => { setPlaceToken((t) => t + 1); resetGestures(); }}><Icon name="pin" size={15} />Move</button>
                  )}
                  {/* WebXR shows only this overlay; with the camera, the header's Exit AR is on screen */}
                  {inAR && <button type="button" className="flow-btn flow-btn--tool" onClick={exitAR}><Icon name="x" size={15} />Exit AR</button>}
                </div>
              )}
              {arError && <p className="lab-ar-top__error" role="alert">{arError}</p>}
              {arLike && safetyStrip}
            </div>
          )}

          {inAR && !placement && (
            <div className="lab-ar-hint is-boxed">Move your phone slowly to find a flat surface, then tap the ring to place the bench.</div>
          )}

          {arLike && (placement || arLite) && (
            <div className="lab-ar-hint">Drag to spin · pinch or use + and − to resize · twist to rotate</div>
          )}

          {arLike && (placement || arLite) && (
            <div className="ar-size" role="group" aria-label="Bench size">
              <button type="button" aria-label="Make it bigger" disabled={arSize >= MAX_SCALE} onClick={() => sizeBy(1.25)}>
                <Icon name="plus" size={20} />
              </button>
              <span className="ar-size__value" aria-live="polite">{Math.round(arSize * 100)}%</span>
              <button type="button" aria-label="Make it smaller" disabled={arSize <= MIN_SCALE} onClick={() => sizeBy(0.8)}>
                <Icon name="minus" size={20} />
              </button>
              <button type="button" aria-label="Back to the placed size" disabled={arSize === 1} onClick={() => setArSize(gestures.setScale(1))}>
                <Icon name="fit" size={18} />
              </button>
            </div>
          )}

          {!arLike && (
            <div className="lab-view" role="toolbar" aria-label="View" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" className="lab-view__btn" title="Zoom in (or scroll)" aria-label="Zoom in" onClick={() => viewRef.current?.zoom(0.7)}>
                <Icon name="zoomIn" />
              </button>
              <button type="button" className="lab-view__btn" title="Zoom out (or scroll)" aria-label="Zoom out" onClick={() => viewRef.current?.zoom(1 / 0.7)}>
                <Icon name="zoomOut" />
              </button>
              <button type="button" className="lab-view__btn" title="Show the whole bench" aria-label="Show the whole bench" onClick={() => viewRef.current?.home()}>
                <Icon name="fit" />
              </button>
            </div>
          )}

          {showPicker && (
            <div style={{ pointerEvents: "auto" }}>
              <PartPicker
                parts={cfg.partPicking === "student"}
                picks={picks}
                locked={lockedSlots}
                showSpecs={cfg.partInfo}
                onPick={pick}
                onInspect={(id) => setInspectId(id)}
                paste={{
                  applied: pasteApplied,
                  ready: !!installed.cpu && !installed.cpu_cooler,
                  waiting: hintsOn && !!installed.cpu && !pasteApplied && !installed.cpu_cooler,
                  disabled: exploding,
                }}
                onPaste={applyPaste}
                cables={{
                  open: cableDrawer || !!cableTask || !!wireTask || !!cordTask,
                  done: cablesDone && wiresDone && cordIn(cord),
                  dim: !picks.psu && !installed.motherboard,
                  disabled: exploding,
                }}
                onCables={() => {
                  setCableTask(null);
                  setWireTask(null);
                  setCordTask(null);
                  setCableDrawer((o) => !o);
                }}
                onOpenPart={() => setCableDrawer(false)}
              />
            </div>
          )}

          {cableDrawer && mode === "assemble" && !classLocked && (
            <div style={{ pointerEvents: "auto" }}>
              <CableDrawer
                cables={cables} psuCables={psuCables} installed={installed} picks={picks} active={cableTask?.cable}
                besidePicker={showPicker}
                onPick={startCable} onClose={() => setCableDrawer(false)}
                wires={wires} headers={headers} activeWire={wireTask?.wire} onPickWire={startWire} labels={help.labels}
                cord={cord} cordActive={!!cordTask} cordNext={cordNext} onPickCord={startCord}
              />
            </div>
          )}

          {pasteTask === "draw" && pasteWork && !classLocked && (
            <PastePanel work={pasteWork} variant={variantOf("cpu")} hints={hintsOn} arLike={arLike} onDone={donePaste} onCancel={cancelPaste} />
          )}
          {pasteTask === "result" && paste?.grade && !classLocked && (
            <PasteResult
              grade={paste.grade}
              variant={variantOf("cpu")}
              hints={hintsOn}
              arLike={arLike}
              score={!trouble}
              redone={misses.current[ledgerKey("assemble", "paste")] || 0}
              onKeep={keepPaste}
              onRedo={redoPaste}
            />
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

          {cordTask && mode === "assemble" && !classLocked && (
            <section className={`cable-task ${showPicker ? "is-beside-picker" : ""}`} aria-live="polite" style={{ pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
              <span className="cable-task__step">
                Power cord · {cordTask.end === "psu" ? "PSU end" : "power strip"} · step {(cordTask.end === "psu" ? 1 : 3) + (cordTask.ready ? 1 : 0)} of 4
              </span>
              {cordTask.end === "psu" ? (
                <p>
                  {cordTask.ready
                    ? "Push the plug into the socket. Its cut corners match the socket's, so it only fits one way."
                    : `${arLike ? "Tap" : "Click"} the power socket on the back of the PSU, at the back of the case.`}
                  {hintsOn && !cordTask.ready && " It's the 3-pin socket beside the I/O switch."}
                </p>
              ) : (
                <p>
                  {cordTask.ready ? "Push the plug into the socket, all the way in." : `${arLike ? "Tap" : "Click"} a socket on the power strip.`}
                  {hintsOn && !cordTask.ready && " The wall end always goes in last, so the PC never gets power while you're still handling the cord."}
                </p>
              )}
              <div className="cable-task__actions">
                {cordTask.ready && <button type="button" className="is-primary" onClick={pushCord}>Push in</button>}
                <button type="button" onClick={() => setCordTask(null)}>Cancel</button>
              </div>
            </section>
          )}

          {wireTask && mode === "assemble" && !classLocked && (
            <section className={`cable-task ${showPicker ? "is-beside-picker" : ""}`} aria-live="polite" style={{ pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
              <span className="cable-task__step">
                {WIRES[wireTask.wire].label} · step {wireTask.at ? 2 : 1} of 2
              </span>
              {wireTask.at ? (
                <p>
                  {WIRES[wireTask.wire].polar
                    ? "Line the + mark on the plug up with + on the board, then push it on."
                    : `Push it straight down onto the ${headerName(wireTask.at, headers)} pins.`}
                  {hintsOn && WIRES[wireTask.wire].polar && (wireTask.flipped ? " The + mark is over the − pin right now." : " The + mark is over the + pin.")}
                </p>
              ) : (
                <p>
                  {arLike ? "Tap" : "Click"} the header this plug goes on. Read the labels printed on the board.
                  {hintsOn && ` It goes on ${WIRE_WHERE[wireTask.wire]}.`}
                </p>
              )}
              <div className="cable-task__actions">
                {wireTask.at && WIRES[wireTask.wire].polar && <button type="button" onClick={turnWire}>Turn plug</button>}
                {wireTask.at && <button type="button" className="is-primary" onClick={pushWire}>Push on</button>}
                {wireTask.at && <button type="button" onClick={() => setWireTask((t) => ({ ...t, at: null }))}>Pick another header</button>}
                <button type="button" onClick={() => setWireTask(null)}>Cancel</button>
              </div>
            </section>
          )}

          {cfg.partInfo && inspectId && (
            <div style={{ pointerEvents: "auto" }}>
              <PartInfoPanel itemId={inspectId} mode={mode} onClose={() => setInspectId(null)} />
            </div>
          )}

          {!classLocked && !pasteTask && (
            <div style={{ pointerEvents: "auto" }}>
              <ControlPanel buttons={buttons} />
            </div>
          )}

          {(task || hintsOn) && !classLocked && !arLike && !pasteTask && (
            <section
              ref={taskRef}
              className={`lab-task ${taskOpen ? "is-open" : ""} ${taskDone ? "is-done" : ""}`}
              aria-label={task ? "Your task" : "Steps"}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button type="button" className="lab-task__head" aria-expanded={taskOpen} onClick={() => setTaskOpen((o) => !o)}>
                <span className="lab-task__tag">
                  <span>{task ? (taskDone ? "Task done" : "Your task") : mode === "assemble" ? "How experts build it" : "Safety first, then any order"}</span>
                  {showStepCount && <span className="lab-task__count">{stepsDone} of {steps.length}</span>}
                </span>
                <strong>{task ? task.title : nowStep}</strong>
                <span className="lab-task__chev" aria-hidden="true">
                  <Icon name={taskOpen ? "up" : "down"} size={16} />
                </span>
              </button>
              {safetyStrip}
              {showStepCount && (
                <div className="lab-task__bar" role="progressbar" aria-label="Steps done" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stepsDone}>
                  <i style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
                </div>
              )}
              {taskOpen && (
                <div className="lab-task__body">
                  {task?.instructions && <p className="lab-task__text">{task.instructions}</p>}
                  {help.steps && trouble && <StepList steps={troubleSteps({ ...troubleLog, fixed: !!taskDone })} />}
                  {help.steps && !trouble && (
                    <>
                      <StepList steps={orderedSteps} now={nextStep >= 0 ? steps[nextStep].label : null} />
                      {anyOrderSteps.length > 0 && (
                        <>
                          <p className="lab-steps__note">Then take parts out in any order, as long as nothing is in the way:</p>
                          <StepList steps={anyOrderSteps} anyOrder />
                        </>
                      )}
                    </>
                  )}
                  {task && (
                  <ul className="lab-task__chips">
                    <li>
                      {trouble
                        ? "Find what's wrong, fix it, power it on"
                        : task.mode === "assemble"
                        ? "Build it and power it on"
                        : "Shut down, unplug, take every part out"}
                    </li>
                    <li>{PLATFORM_LABEL[task.platform]} parts</li>
                    <li>Target {task.parMin} min</li>
                  </ul>
                  )}
                  {trouble && help.faultsLeft && !taskDone && (
                    <p className="lab-task__faults">
                      {faultIds.length
                        ? `Fixed ${fixedIds.length} of ${faultIds.length} faults.`
                        : "Check it over: some PCs have nothing wrong. Power it on to see."}
                    </p>
                  )}
                  {preview && trouble && (
                    <div className="lab-preview">
                      <p className="lab-preview__head">Instructor preview: what's wrong (students don't see this)</p>
                      <ul className="lab-preview__list">
                        {startFaults.map((f) => (
                          <li key={f.id} className={fixedIds.includes(f.id) ? "is-done" : ""}>
                            <span>{f.text}</span>
                            <b>{task.faultPoints[f.id]} pts</b>
                          </li>
                        ))}
                        {faultsNow.filter((f) => !faultIds.includes(f.id)).map((f) => (
                          <li key={f.id} className="is-new">
                            <span>New: {f.text}</span>
                            <b>0 pts</b>
                          </li>
                        ))}
                        <li className={taskDone ? "is-done" : ""}>
                          <span>Starts with nothing wrong</span>
                          <b>{task.bootPoints} pts</b>
                        </li>
                      </ul>
                    </div>
                  )}
                  {taskDone && (
                    <p className="lab-task__done">
                      Finished in {formatClock(taskDone.ms)} · score {official}/{outOf}.{" "}
                      {preview ? "This is a preview: nothing was saved." : "Your instructor can see your result."}
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
                      {trouble
                        ? `${fixedIds.length} of ${faultIds.length} faults fixed · ${mistakes} mistakes`
                        : `${officialCard[taskMode]} of ${maxPts} points · Penalties -${scoreInfo.penalty} · ${mistakes} mistakes`}
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
              <button type="button" className="flow-btn flow-btn--tool focus-ring" onClick={leaveClass} title="Back to free practice: you stay in your class">Exit lab activity</button>
            </div>
          )}

          <ExamGuard
            active={exam}
            paused={arLike}
            report={(detail) => reportEvent("integrity", "exam", detail)}
            warn={(text) => showHint(text, "fail", text)}
          />
          {exam && <Watermark lines={examWho} />}

          {phaseDone && cfg.autoPrompt && !promptDismissed && (
            <div
              role="dialog"
              aria-label="Phase complete"
              className="lab-done"
            >
              <span className="lab-done__icon" aria-hidden="true">
                <Icon name="check" size={24} strokeWidth={2.5} />
              </span>
              <h2>
                {trouble ? "PC fixed!" : task && taskDone && mode === task.mode ? "Task complete!" : mode === "disassemble" ? "Teardown complete!" : "Build complete!"}
              </h2>
              <p>
                {trouble
                  ? `It starts and everything works${faultIds.length ? `: all ${faultIds.length} faults fixed` : ""}.`
                  : mode === "disassemble"
                  ? "Every part is on the bench."
                  : "The PC booted."}
                {scored ? <> {trouble ? "Score" : "Score so far"}: <strong>{official}/{outOf}</strong></> : " Nice work."}
              </p>
              <div className="lab-done__actions">
                {cfg.modeControl === "student" && !trouble && (
                  <button type="button" className="flow-btn flow-btn--primary focus-ring" onClick={() => forceMode(mode === "disassemble" ? "assemble" : "disassemble")}>
                    {mode === "disassemble" ? "Start rebuilding" : "Take it apart"}
                  </button>
                )}
                <button type="button" className="flow-btn flow-btn--tool focus-ring" onClick={() => setPromptDismissed(true)}>Stay here</button>
              </div>
            </div>
          )}

          {feedback && (
            <div className={`assemble__toast assemble__toast--${feedback.type}`} role={feedback.type === "success" ? undefined : "alert"}>
              {feedback.type === "safety" && <Icon name="alert" size={17} strokeWidth={2.4} />}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}