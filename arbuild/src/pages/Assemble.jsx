import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { Link } from "react-router-dom";
import { Html } from "@react-three/drei";
import Scene3D from "../Three/Scene3D";
import CameraView from "../Three/CameraView";
import CaseModel from "../Three/CaseModel";
import MotherboardModel from "../Three/MotherboardModel";
import RAMModel from "../Three/RAMModel";
import CPUModel from "../Three/CPUModel";
import PSUModel from "../Three/PSUModel"; // ✅ Fixed capitalization to match file name
import GPUModel from "../Three/GPUModel"; // ✅ GPU added
import CPUCoolerModel from "../Three/CPUCoolerModel"; // ✅ CPU cooler added
import DraggablePart from "../Three/DraggablePart";
import "../styles/Assemble.css";

// ==========================================
// 🪑 WORKBENCH (table) + PARTS LAYOUT
// ==========================================
const TABLE = {
  center: [0, 0.0, 0],
  size: [5.4, 7.4],
  thickness: 0.08,
  color: "#47290a",
  matColor: "#2e1408",
};

const TRAY_OFFSETS = {
  motherboard: [-0.05, 0.15, 3],
  cpu: [0.8, 0.01, 2.4],
  ram1: [1.2, 0.15, 2.9],
  ram2: [1.4, 0.15, 2.9],
  psu: [-1.6, 0.05, 2.7],
  gpu: [1.2, 0.15, 1.5], // ✅ new tray spot, free area on the bench
  cpu_cooler: [0.8, 0.01, 2.8], // ✅ new, near the CPU tray spot
};

const MOBO_LYING_ROTATION = [-Math.PI / 2, Math.PI, 0];
const MOBO_MOUNTED_ROTATION = [0, Math.PI, 0];
const RAM_LYING_ROTATION = [-Math.PI / 2, Math.PI, 0];
const CPU_TRAY_ROTATION = [0, Math.PI, 0];
const PSU_TRAY_ROTATION = [0, 0, 0];
const GPU_TRAY_ROTATION = [0, Math.PI, 0]; // ✅ new
const COOLER_TRAY_ROTATION = [0, 0, 0]; // ✅ new

function trayPosition(name) {
  const o = TRAY_OFFSETS[name];
  return [TABLE.center[0] + o[0], TABLE.center[1] + o[1], TABLE.center[2] + o[2]];
}

// ==========================================
// 🎛️ POSITION & PLACEMENT CONFIGURATION
// ==========================================
const MOTHERBOARD_TARGET = {
  position: [-0.30, 0.53, -0.30],
  rotation: [0, Math.PI, 0],
};
const MOTHERBOARD_TRAY_POSITION = trayPosition("motherboard");

// ✅ PSU: inside chassis, lower-left bay, fan/power face turned toward the left panel
const PSU_TARGET = {
  position: [-0.625, 0.48, 0.00005],
  rotation: [Math.PI, (3 * Math.PI) / 2, 0], // added Math.PI on X to flip upside-down
};
const PSU_TRAY_POSITION = trayPosition("psu");

// ✅ GPU: sits in the primary PCIe x16 slot, roughly below the RAM/CPU
// area on the board, I/O bracket facing the rear of the case.
// PLACEHOLDER — this is an estimate, not a calibrated value like the
// CPU/RAM sockets below. Nudge position/rotation until the card lines
// up with the case's rear PCIe slot covers.
const GPU_TARGET = {
  position: [-0.326, 1.0379, -0.449],
  rotation: [0, Math.PI, 0],
};
const GPU_TRAY_POSITION = trayPosition("gpu");

// ✅ Quick-tune knobs: GPUModel accepts spinX/spinY/spinZ props (radians)
// that spin the model in place independent of GPU_TARGET.rotation above.
// spinX tips it from standing upright to lying flat; spinY turns it left/
// right while flat; spinZ rolls it. Change these and reload to test.
// Common values to try: 0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2.
const GPU_SPIN_X = -Math.PI / 2; // lay flat, flipped (top/bottom swapped vs. +Math.PI/2)
const GPU_SPIN_Y = Math.PI / 2;
const GPU_SPIN_Z = 0;

// ✅ Same quick-tune knobs for the CPU cooler. At 0/0/0 the cooler renders
// in its raw glTF orientation, which for this model lies on its side —
// that's why it was projecting sideways into the RAM/heatsink area
// instead of sitting as a compact block directly on the CPU. spinX
// stands it upright (fan facing up), same logic as GPU_SPIN_X.
const COOLER_SPIN_X = Math.PI / 2;
const COOLER_YAW_DEGREES = 90;
const COOLER_SPIN_Y = (COOLER_YAW_DEGREES * Math.PI) / 180;
const COOLER_SPIN_Z = Math.PI;

const RAM_SLOT_1_ABS = [0.0361, 1.132, -0.291];
const RAM_SLOT_2_ABS = [0.1191, 1.132, -0.291];
const CPU_SOCKET_ABS = [-0.237, 1.456, -0.375];

const RAM_SCALE = [0.85, 0.959, 0.85];

function offsetFrom(abs, base) {
  return [abs[0] - base[0], abs[1] - base[1], abs[2] - base[2]];
}

const RAM_1_OFFSET = offsetFrom(RAM_SLOT_1_ABS, MOTHERBOARD_TARGET.position);
const RAM_2_OFFSET = offsetFrom(RAM_SLOT_2_ABS, MOTHERBOARD_TARGET.position);
const CPU_OFFSET = offsetFrom(CPU_SOCKET_ABS, MOTHERBOARD_TARGET.position);

const RAM_1_TRAY_POSITION = trayPosition("ram1");
const RAM_2_TRAY_POSITION = trayPosition("ram2");
const CPU_TRAY_POSITION = trayPosition("cpu");

// ✅ CPU Cooler sits directly on top of the CPU, same x/z as the CPU
// socket, lifted up by the cooler's height. COOLER_HEIGHT is a rough
// starting guess; COOLER_POSITION_OFFSET is a manual x/y/z nudge on top
// of that, for fine-tuning once you can see it in the scene. Adjust
// COOLER_POSITION_OFFSET first — it's the fast dial. Only touch
// COOLER_HEIGHT if the whole thing needs to move up/down as a base.
const COOLER_HEIGHT = 0.09;
const COOLER_POSITION_OFFSET = [0, 0, 0]; // [x, y, z] manual nudge — start here
const COOLER_OFFSET = [
  CPU_OFFSET[0] + COOLER_POSITION_OFFSET[0],
  CPU_OFFSET[1] + COOLER_HEIGHT + COOLER_POSITION_OFFSET[1],
  CPU_OFFSET[2] + COOLER_POSITION_OFFSET[2],
];
const COOLER_TRAY_POSITION = trayPosition("cpu_cooler");

function addRotatedOffset(base, offset, rotationY = Math.PI) {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const rx = offset[0] * cos - offset[2] * sin;
  const rz = offset[0] * sin + offset[2] * cos;
  return [base[0] + rx, base[1] + offset[1], base[2] + rz];
}

// ==========================================
// 🧱 SCENE HELPERS
// ==========================================
function Workbench() {
  const [cx, cy, cz] = TABLE.center;
  const [w, d] = TABLE.size;
  const legX = w / 2 - 0.15;
  const legZ = d / 2 - 0.15;
  const legY = -TABLE.thickness - TABLE.legHeight / 2;
  return (
    <group position={[cx, cy, cz]}>
      <mesh position={[0, -TABLE.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[w, TABLE.thickness, d]} />
        <meshStandardMaterial color={TABLE.color} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.3, d - 0.3]} />
        <meshStandardMaterial color={TABLE.matColor} roughness={0.95} />
      </mesh>
      {[[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]].map(([x, z], i) => (
        <mesh key={i} position={[x, legY, z]}>
          <boxGeometry args={[0.1, TABLE.legHeight, 0.1]} />
          <meshStandardMaterial color="#5b4630" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function TrayLabel({ name, text }) {
  const [x, y, z] = trayPosition(name);
  return (
    <Html position={[x, y + 0.35, z]} center distanceFactor={6} style={{ pointerEvents: "none" }}>
      <div
        style={{
          padding: "2px 10px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.82)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

/* Shown inside the Canvas while the GLTF parts (case, motherboard, CPU,
   RAM, PSU, GPU, CPU cooler) are still downloading. Scene3D/Canvas has no
   Suspense boundary of its own, so on a slow connection (mobile data) the
   whole bench used to just render empty with no feedback and no error. */
function BenchLoadingFallback() {
  return (
    <group position={[0, 0.4, 0]}>
      <mesh>
        <torusGeometry args={[0.4, 0.05, 16, 48]} />
        <meshStandardMaterial color="#4fd8c9" emissive="#4fd8c9" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export default function Assemble() {
  const [score, setScore] = useState(0);
  const [popups, setPopups] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [motherboardPos, setMotherboardPos] = useState(MOTHERBOARD_TRAY_POSITION);

  const [selectedPart, setSelectedPart] = useState(null);

  const [isMoboMounted, setIsMoboMounted] = useState(false);
  const [isCpuAttached, setIsCpuAttached] = useState(false);
  const [isRam1Attached, setIsRam1Attached] = useState(false);
  const [isRam2Attached, setIsRam2Attached] = useState(false);
  const [isPsuAttached, setIsPsuAttached] = useState(false);
  const [isGpuAttached, setIsGpuAttached] = useState(false); // ✅ new
  const [isCoolerAttached, setIsCoolerAttached] = useState(false); // ✅ new

  const timeoutRef = useRef(null);

  const cpuTarget = useMemo(
    () => ({ position: addRotatedOffset(motherboardPos, CPU_OFFSET, Math.PI), rotation: [0, Math.PI, 0] }),
    [motherboardPos]
  );
  const coolerTarget = useMemo(
    () => ({ position: addRotatedOffset(motherboardPos, COOLER_OFFSET, Math.PI), rotation: [0, Math.PI, 0] }),
    [motherboardPos]
  );
  const ram1Target = useMemo(
    () => ({ position: addRotatedOffset(motherboardPos, RAM_1_OFFSET, Math.PI), rotation: [0, Math.PI, 0] }),
    [motherboardPos]
  );
  const ram2Target = useMemo(
    () => ({ position: addRotatedOffset(motherboardPos, RAM_2_OFFSET, Math.PI), rotation: [0, Math.PI, 0] }),
    [motherboardPos]
  );

  function triggerPopup(points, type) {
    const id = Date.now();
    setPopups((prev) => [...prev, { id, points, type }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1200);
  }

  function handleCorrect(points, message) {
    setScore((s) => s + points);
    triggerPopup(`+${points}`, "success");
    setFeedback({ type: "success", text: message });
    clearFeedbackSoon();
  }

  function handleIncorrect(points, message) {
    setScore((s) => Math.max(0, s - points));
    triggerPopup(`-${points}`, "fail");
    setFeedback({ type: "fail", text: message });
    clearFeedbackSoon();
  }

  function clearFeedbackSoon() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFeedback(null), 2500);
  }

  function selectPart(name) {
    if (!isMoboMounted) {
      setFeedback({ type: "fail", text: "Mount the motherboard in the case first." });
      clearFeedbackSoon();
      return;
    }
    setSelectedPart(name);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
          <span className="assemble__badge-sub">Interactive Workspace</span>
          <h1>Assembly Lab</h1>
        </div>

        <div className="assemble__actions">
          {selectedPart && (
            <div className="assemble__selection-indicator">
              Selected: <strong>{selectedPart.toUpperCase()}</strong> (Click target to place)
            </div>
          )}

          <button
            className={`assemble__rotate-btn focus-ring ${showCamera ? "assemble__rotate-btn--active" : ""}`}
            onClick={() => setShowCamera((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            {showCamera ? "AR Cam ON" : "AR Cam OFF"}
          </button>

          <div className="assemble__score-card-wrapper">
            <div className="assemble__score-card">
              <span className="assemble__score-label">SCORE</span>
              <span className="assemble__score-value">{score}</span>
            </div>

            <div className="assemble__popup-container">
              {popups.map((popup) => (
                <span key={popup.id} className={`assemble__floating-popup assemble__floating-popup--${popup.type}`}>
                  {popup.points}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className={`assemble__viewport ${showCamera ? "assemble__viewport--ar" : ""}`}>
        {showCamera && <CameraView />}

        <div className="assemble__scene-container">
          <Scene3D isCameraOn={showCamera}>
            {/* Suspense is required here: all the part components use
                useGLTF, which suspends while its .glb file downloads.
                Scene3D's Canvas has no boundary of its own, so on a slow
                connection (mobile data) the bench used to render empty
                with nothing to catch the suspended load. */}
            <Suspense fallback={<BenchLoadingFallback />}>
              <CaseModel position={[0, 0, 0]} />

              <Workbench />
              {!isMoboMounted && <TrayLabel name="motherboard" text="Motherboard" />}
              {!isCpuAttached && <TrayLabel name="cpu" text="CPU" />}
              {!isRam1Attached && <TrayLabel name="ram1" text="RAM 1" />}
              {!isRam2Attached && <TrayLabel name="ram2" text="RAM 2" />}
              {!isPsuAttached && <TrayLabel name="psu" text="PSU" />}
              {!isGpuAttached && <TrayLabel name="gpu" text="GPU" />}
              {!isCoolerAttached && <TrayLabel name="cpu_cooler" text="CPU Cooler" />}

              <DraggablePart
                trayPosition={MOTHERBOARD_TRAY_POSITION}
                target={MOTHERBOARD_TARGET}
                tolerance={5}
                isClickToPlace={true}
                isSelected={selectedPart === "motherboard"}
                onClick={() => setSelectedPart("motherboard")}
                onCorrect={() => {
                  setIsMoboMounted(true);
                  handleCorrect(100, "Motherboard securely mounted.");
                  setSelectedPart(null);
                }}
                onIncorrect={() => handleIncorrect(25, "Incorrect placement position.")}
                onPositionChange={(x, y, z) => setMotherboardPos([x, y, z])}
              >
                <group
                  rotation={isMoboMounted ? MOBO_MOUNTED_ROTATION : MOBO_LYING_ROTATION}
                  scale={[0.9999999, 1.12, 1.25]}
                >
                  <MotherboardModel />

                  {isCpuAttached && (
                    <group position={[-CPU_OFFSET[0], CPU_OFFSET[1], -CPU_OFFSET[2]]} rotation={[Math.PI / 2, 0, Math.PI]}>
                      <CPUModel />
                    </group>
                  )}

                  {isCoolerAttached && (
                    <group
                      position={[-COOLER_OFFSET[0], COOLER_OFFSET[1], -COOLER_OFFSET[2]]}
                      rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}
                    >
                      <CPUCoolerModel />
                    </group>
                  )}

                  {isRam1Attached && (
                    <group position={[-RAM_1_OFFSET[0], RAM_1_OFFSET[1], -RAM_1_OFFSET[2]]} rotation={[0, 0, 0]} scale={RAM_SCALE}>
                      <RAMModel accentColor="#4fd8c9" />
                    </group>
                  )}

                  {isRam2Attached && (
                    <group position={[-RAM_2_OFFSET[0], RAM_2_OFFSET[1], -RAM_2_OFFSET[2]]} rotation={[0, 0, 0]} scale={RAM_SCALE}>
                      <RAMModel accentColor="#e8a33d" />
                    </group>
                  )}
                </group>
              </DraggablePart>

              {!isCpuAttached && (
                <DraggablePart
                  trayPosition={CPU_TRAY_POSITION}
                  target={cpuTarget}
                  tolerance={5}
                  isClickToPlace={true}
                  isSelected={selectedPart === "cpu"}
                  onClick={() => selectPart("cpu")}
                  onCorrect={() => {
                    setIsCpuAttached(true);
                    handleCorrect(75, "CPU correctly slotted.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(30, "Misaligned CPU pins detected.")}
                >
                  <group rotation={CPU_TRAY_ROTATION}>
                    <CPUModel />
                  </group>
                </DraggablePart>
              )}

              {/* ✅ CPU Cooler — requires the CPU itself to be attached first
                  (not just the motherboard mounted). `locked` disables
                  DraggablePart's pointerDown outright, same pattern as GPU. */}
              {!isCoolerAttached && (
                <DraggablePart
                  trayPosition={COOLER_TRAY_POSITION}
                  target={coolerTarget}
                  tolerance={5}
                  isClickToPlace={true}
                  locked={!isCpuAttached}
                  isSelected={selectedPart === "cpu_cooler"}
                  onClick={() => {
                    if (!isCpuAttached) {
                      setFeedback({ type: "fail", text: "Install the CPU before mounting the cooler." });
                      clearFeedbackSoon();
                      return;
                    }
                    selectPart("cpu_cooler");
                  }}
                  onCorrect={() => {
                    setIsCoolerAttached(true);
                    handleCorrect(40, "CPU cooler mounted and secured.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(15, "Cooler isn't seated on the socket correctly.")}
                >
                  <group rotation={[COOLER_SPIN_X, COOLER_SPIN_Y, COOLER_SPIN_Z]}>
                    <CPUCoolerModel />
                  </group>
                </DraggablePart>
              )}

              {!isPsuAttached && (
                <DraggablePart
                  trayPosition={PSU_TRAY_POSITION}
                  target={PSU_TARGET}
                  tolerance={5}
                  isClickToPlace={true}
                  isSelected={selectedPart === "psu"}
                  onClick={() => setSelectedPart("psu")}
                  onCorrect={() => {
                    setIsPsuAttached(true);
                    handleCorrect(60, "Power supply installed.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(20, "PSU isn't seated in the bay correctly.")}
                >
                  <group rotation={PSU_TRAY_ROTATION}>
                    <PSUModel />
                  </group>
                </DraggablePart>
              )}

              {/* ✅ Permanent PSU render once placed — mirrors CPU/RAM pattern.
                  Without this, the PSU's only render (inside DraggablePart above)
                  unmounts as soon as isPsuAttached becomes true, so it vanishes. */}
              {isPsuAttached && (
                <group position={PSU_TARGET.position} rotation={PSU_TARGET.rotation}>
                  <PSUModel />
                </group>
              )}

              {/* ✅ GPU — requires motherboard mounted first. `locked` disables
                  DraggablePart's own pointerDown handler outright, so the GPU
                  can't be picked up/dragged at all (not just blocked from
                  clicking) until the motherboard is mounted in the chassis. */}
              {!isGpuAttached && (
                <DraggablePart
                  trayPosition={GPU_TRAY_POSITION}
                  target={GPU_TARGET}
                  tolerance={5}
                  isClickToPlace={true}
                  locked={!isMoboMounted}
                  isSelected={selectedPart === "gpu"}
                  onClick={() => selectPart("gpu")}
                  onCorrect={() => {
                    setIsGpuAttached(true);
                    handleCorrect(80, "Graphics card seated in PCIe slot.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(25, "GPU not aligned with the PCIe slot.")}
                >
                  <group rotation={GPU_TRAY_ROTATION}>
                    <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
                  </group>
                </DraggablePart>
              )}

              {/* ✅ Permanent GPU render once placed — same reasoning as PSU:
                  the DraggablePart's own render unmounts once isGpuAttached flips true. */}
              {isGpuAttached && (
                <group position={GPU_TARGET.position} rotation={GPU_TARGET.rotation}>
                  <GPUModel spinX={GPU_SPIN_X} spinY={GPU_SPIN_Y} spinZ={GPU_SPIN_Z} />
                </group>
              )}

              {!isRam1Attached && (
                <DraggablePart
                  trayPosition={RAM_1_TRAY_POSITION}
                  target={ram1Target}
                  tolerance={5}
                  isClickToPlace={true}
                  isSelected={selectedPart === "ram1"}
                  onClick={() => selectPart("ram1")}
                  onCorrect={() => {
                    setIsRam1Attached(true);
                    handleCorrect(50, "RAM module 1 locked in.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(15, "Slot notch mismatch for RAM 1.")}
                >
                  <group rotation={RAM_LYING_ROTATION} scale={RAM_SCALE}>
                    <RAMModel accentColor="#4fd8c9" />
                  </group>
                </DraggablePart>
              )}

              {!isRam2Attached && (
                <DraggablePart
                  trayPosition={RAM_2_TRAY_POSITION}
                  target={ram2Target}
                  tolerance={5}
                  isClickToPlace={true}
                  isSelected={selectedPart === "ram2"}
                  onClick={() => selectPart("ram2")}
                  onCorrect={() => {
                    setIsRam2Attached(true);
                    handleCorrect(50, "RAM module 2 locked in.");
                    setSelectedPart(null);
                  }}
                  onIncorrect={() => handleIncorrect(15, "Slot notch mismatch for RAM 2.")}
                >
                  <group rotation={RAM_LYING_ROTATION} scale={RAM_SCALE}>
                    <RAMModel accentColor="#e8a33d" />
                  </group>
                </DraggablePart>
              )}
            </Suspense>
          </Scene3D>
        </div>

        {feedback && (
          <div className={`assemble__toast assemble__toast--${feedback.type}`}>
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}