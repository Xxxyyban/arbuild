import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Scene3D from "../Three/Scene3D";
import CameraView from "../Three/CameraView";
import CaseModel from "../Three/CaseModel";
import MotherboardModel from "../Three/MotherboardModel";
import DraggablePart from "../Three/DraggablePart";
import "../styles/Assemble.css";

const MOTHERBOARD_TARGET = {
  position: [0, 0.75, -0.4],
  rotation: [0, 0, 0],
};

const MOTHERBOARD_TRAY_POSITION = [3.4, 0.75, 1.5];

export default function Assemble() {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [spinY, setSpinY] = useState(0);
  const [livePos, setLivePos] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const timeoutRef = useRef(null);

  function handleCorrect() {
    setScore((s) => s + 100);
    setFeedback({ type: "success", text: "Motherboard seated correctly! +100pts" });
    clearFeedbackSoon();
  }

  function handleIncorrect() {
    setScore((s) => Math.max(0, s - 25));
    setFeedback({ type: "fail", text: "Wrong spot — that would've damaged a real board. -25pts" });
    clearFeedbackSoon();
  }

  function clearFeedbackSoon() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFeedback(null), 2500);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function rotatePart() {
    setSpinY((r) => r + Math.PI / 2);
  }

  return (
    <div className="assemble" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <header className="assemble__bar" style={{ position: 'relative', zIndex: 10 }}>
        <Link to="/main" className="assemble__back focus-ring">
          ← Main Menu
        </Link>
        <div className="assemble__title-group">
          <span className="eyebrow">Interactive Build</span>
          <h1>PC Assembly Simulator</h1>
        </div>
        <div className="assemble__actions">
          {/* Clickable Camera Toggle Button */}
          <button 
            className="assemble__rotate-btn focus-ring" 
            onClick={() => setShowCamera((prev) => !prev)}
            style={{
              background: showCamera ? '#059669' : 'var(--bg-panel, #1e293b)',
              borderColor: showCamera ? '#34d399' : 'var(--line-trace, rgba(255, 255, 255, 0.1))',
              color: showCamera ? '#ffffff' : 'var(--text-primary, #e2e8f0)'
            }}
          >
            {showCamera ? '📷 Camera ON' : '📷 Camera OFF'}
          </button>

          <button className="assemble__rotate-btn focus-ring" onClick={rotatePart} title="Rotate Part (90°)">
            ⟳ Rotate Part
          </button>

          <div className="assemble__score-badge">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
        </div>
      </header>

      {/* Dynamic Viewport Container: toggles transparency class when AR mode is active */}
      <div 
        className={`assemble__viewport ${showCamera ? 'assemble__viewport--ar' : ''}`} 
        style={{ position: 'relative', flex: 1, width: '100%' }}
      >
        {/* Live Camera Feed Background Layer */}
        {showCamera && <CameraView />}

        {/* 3D Scene Canvas Layer */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <Scene3D isCameraOn={showCamera}>
            <CaseModel position={[0, 0, 0]} />
            <DraggablePart
              trayPosition={MOTHERBOARD_TRAY_POSITION}
              target={MOTHERBOARD_TARGET}
              tolerance={5}
              onCorrect={handleCorrect}
              onIncorrect={handleIncorrect}
              onDrag={(x, y, z) => setLivePos([x, y, z])}
            >
              <MotherboardModel spinY={spinY} />
            </DraggablePart>
          </Scene3D>
        </div>

        {feedback && (
          <div className={`assemble__feedback assemble__feedback--${feedback.type}`} style={{ zIndex: 20 }}>
            <span className="feedback-icon">{feedback.type === "success" ? "✨" : "⚠️"}</span>
            <p>{feedback.text}</p>
          </div>
        )}

        {livePos && (
          <div className="assemble__debug" style={{ zIndex: 20 }}>
            <span className="debug-title">Live Coordinates</span>
            <div className="debug-coords">
              <span>X: <strong>{livePos[0].toFixed(2)}</strong></span>
              <span>Y: <strong>{livePos[1].toFixed(2)}</strong></span>
              <span>Z: <strong>{livePos[2].toFixed(2)}</strong></span>
            </div>
          </div>
        )}
      </div>

      <footer className="assemble__footer" style={{ position: 'relative', zIndex: 10 }}>
        <p className="assemble__hint">
          💡 <strong>Tip:</strong> Toggle the camera mode on/off. Drag the motherboard into the chassis alignment pins until it seats securely.
        </p>
      </footer>
    </div>
  );
}