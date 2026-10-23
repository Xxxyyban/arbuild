// Shown before the Build Lab loads, for free build: learning on your own, with no task, clock or
// points. Class work doesn't start here: students open their lab activities from their class
// (Profile → Classes), which skips this screen.
// The student doesn't choose the platform either: a teardown gets a random PC (working out what's
// inside is part of the lesson), and building means choosing every part, AM4 or AM5.
// Styles live in styles/BuildLab.css (.lab-start*).
import { Link } from "react-router-dom";
import { PLATFORMS } from "../../lab/Catalog";
import Logo from "../Logo";
import "../../styles/BuildLab.css";
import "../../styles/BuildLabParts.css";
import "../../styles/BuildLabTask.css";

const randomPlatform = () => PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];

// status: a message while a lab opened from a class loads (or why it couldn't); backTo: that class
export default function StartScreen({ onPractice, status = null, backTo = null }) {
  return (
    <div className="lab-start">
      <div className="lab-start__panel">
        <Link to="/main" className="lab-start__brand" aria-label="ARBuild home">
          <Logo size={30} name />
        </Link>
        <h1 className="lab-start__title">Build Lab</h1>
        <p className="lab-start__lead">
          Free build: no task, no timer, no score. Take a PC apart or build one, and see what works. Practise the steps
          here, then do them for real on actual hardware.
        </p>
        {status && <div className="lab-start__status" role="status">{status}</div>}
        {backTo && <Link to={backTo} className="flow-btn flow-btn--tool lab-start__back">← Back to your class</Link>}

        <div className="lab-start__cards">
          <button
            type="button"
            className="lab-start__card"
            onClick={() => onPractice({ startMode: "disassemble", startState: "full", platform: randomPlatform() })}
          >
            <span className="lab-start__card-tag">Teardown</span>
            <strong>Take it apart</strong>
            <span className="lab-start__card-desc">A running PC is on the bench. Find out what's inside as you take it apart, then rebuild it.</span>
          </button>

          <button
            type="button"
            className="lab-start__card"
            onClick={() => onPractice({ startMode: "assemble", startState: "empty", platform: randomPlatform() })}
          >
            <span className="lab-start__card-tag">Assemble</span>
            <strong>Build it</strong>
            <span className="lab-start__card-desc">Start with an empty case. Choose every part yourself and find out what fits.</span>
          </button>
        </div>

        <p className="lab-start__note">
          Class lab activities open from your class: <Link to="/profile?tab=classes">Profile → Classes</Link>.
        </p>
      </div>
    </div>
  );
}
