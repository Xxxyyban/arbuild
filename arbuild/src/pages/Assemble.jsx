import { useState } from "react";
import { Link } from "react-router-dom";
import Scene3D from "../three/Scene3D";
import CaseModel from "../three/CaseModel";
import MotherboardModel from "../three/MotherboardModel";
import DraggablePart from "../three/DraggablePart";
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

  function handleCorrect() {
    setScore((s) => s + 100);
    setFeedback({ type: "success", text: "Motherboard seated correctly! +100" });
    clearFeedbackSoon();
  }

  function handleIncorrect() {
    setScore((s) => Math.max(0, s - 25));
    setFeedback({ type: "fail", text: "Wrong spot — that would've damaged a real board. -25" });
    clearFeedbackSoon();
  }

  function clearFeedbackSoon() {
    window.clearTimeout(clearFeedbackSoon._t);
    clearFeedbackSoon._t = window.setTimeout(() => setFeedback(null), 2200);
  }

  function rotatePart() {
    setSpinY((r) => r + Math.PI / 2);
  }

  return (
    <div className="assemble">
      <header className="assemble__bar">
        <Link to="/main" className="assemble__back focus-ring">← Main menu</Link>
        <p className="eyebrow">Assemble</p>
        <button className="assemble__rotate-btn focus-ring" onClick={rotatePart}>
          ⟳ Rotate part
        </button>
        <span className="assemble__part-label">Score: {score}</span>
      </header>

      <div className="assemble__viewport">
        <Scene3D>
          <CaseModel position={[0, 0, 0]} />
          <DraggablePart
            trayPosition={MOTHERBOARD_TRAY_POSITION}
            target={MOTHERBOARD_TARGET}
            tolerance={0.4}
            onCorrect={handleCorrect}
            onIncorrect={handleIncorrect}
          >
            <MotherboardModel spinY={spinY} />
          </DraggablePart>
        </Scene3D>

        {feedback && (
          <div className={`assemble__feedback assemble__feedback--${feedback.type}`}>
            {feedback.text}
          </div>
        )}
      </div>

      <p className="assemble__hint">
        Drag the motherboard from the tray into the case · Click "Rotate part"
        to spin it 90° · Drag empty space to orbit the camera · Scroll to zoom
      </p>
    </div>
  );
}