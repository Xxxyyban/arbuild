// Shown before the lab loads. Practice starts a local session; "Join class" uses the
// instructor's code (onJoin), and the instructor then decides each student's start and platform.
// Styles live in styles/BuildLab.css (.lab-start*).
import { useState } from "react";
import { normalizeCode, isValidCode, CODE_LENGTH } from "../../lab/Setup";
import { PLATFORMS, PLATFORM_LABEL } from "../../lab/Catalog";
import "../../styles/BuildLab.css";
import "../../styles/BuildLabParts.css";

export default function StartScreen({ onPractice, onJoin }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState("am4");

  async function join(e) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (!isValidCode(clean)) return setError(`Enter the ${CODE_LENGTH}-character code from your instructor.`);
    setBusy(true);
    setError("");
    try {
      const msg = await onJoin(clean); // returns an error string, or nothing on success
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lab-start">
      <div className="lab-start__panel">
        <span className="lab-start__badge">ARBuild</span>
        <h1 className="lab-start__title">Build Lab</h1>
        <p className="lab-start__lead">
          Take a PC apart or build one, and switch between the two as you go.
        </p>

        <form className="lab-start__join" onSubmit={join}>
          <input
            className="lab-start__code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH))}
            placeholder="CLASS CODE"
            aria-label="Class code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="flow-btn flow-btn--accent lab-start__join-btn" disabled={busy}>
            {busy ? "Joining…" : "Join class"}
          </button>
        </form>
        <div className="lab-start__error" role="alert">{error}</div>

        <div className="lab-start__divider"><span>or practice on your own</span></div>

        <div className="lab-start__platform" role="radiogroup" aria-label="Platform to practice">
          <span>Work order</span>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={platform === p}
              className={platform === p ? "is-on" : ""}
              onClick={() => setPlatform(p)}
            >
              {PLATFORM_LABEL[p]} build
            </button>
          ))}
        </div>

        <div className="lab-start__cards">
          <button
            type="button"
            className="lab-start__card"
            onClick={() => onPractice({ startMode: "disassemble", startState: "full", platform })}
          >
            <span className="lab-start__card-tag">Teardown</span>
            <strong>Take it apart</strong>
            <span className="lab-start__card-desc">Start with a running {PLATFORM_LABEL[platform]} PC. Rebuild it afterwards.</span>
          </button>

          <button
            type="button"
            className="lab-start__card"
            onClick={() => onPractice({ startMode: "assemble", startState: "empty", platform })}
          >
            <span className="lab-start__card-tag">Assemble</span>
            <strong>Build it</strong>
            <span className="lab-start__card-desc">Start with an empty case. Pick every {PLATFORM_LABEL[platform]} part yourself.</span>
          </button>
        </div>
      </div>
    </div>
  );
}