// Making a lab activity inside a class: what students do in the Build Lab, and how much help they get.
// It opens as "waiting": students can open it and read the task; the instructor presses Start.
import { useState } from "react";
import { PLATFORM_LABEL, PLATFORMS } from "../../lab/Catalog";
import { defaultTitle, MAX_TASK_POINTS } from "../../lab/Tasks";
import { MAX_MINUTES } from "../../lab/Sessions";

export default function LabActivityForm({ busy, onCreate, onCancel }) {
  const [mode, setMode] = useState("assemble");
  const [platform, setPlatform] = useState("am4");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [parMin, setParMin] = useState(15);
  const [hints, setHints] = useState(true);
  const [autoPick, setAutoPick] = useState(false);
  const [partInfo, setPartInfo] = useState(true);
  const [points, setPoints] = useState(100);
  const [requireGpu, setRequireGpu] = useState(true);
  const [ramSticks, setRamSticks] = useState(2);
  const [mustBoot, setMustBoot] = useState(true);

  function submit(e) {
    e.preventDefault();
    onCreate({
      title: title.trim() || defaultTitle(mode, platform),
      task: {
        title: title.trim() || defaultTitle(mode, platform),
        instructions,
        mode,
        platform,
        parMin: Math.min(MAX_MINUTES, Math.max(1, Math.floor(Number(parMin)) || 15)),
        hints,
        partPicking: autoPick ? "auto" : "student",
        partInfo,
        points: Math.min(MAX_TASK_POINTS, Math.max(1, Math.floor(Number(points)) || 100)),
        requireGpu,
        ramSticks,
        mustBoot,
      },
    });
  }

  return (
    <form className="ins-panel cls-labform" onSubmit={submit}>
      <h2>New lab activity</h2>
      <p className="ins-muted ins-small">
        Students in this class see it in their stream and open it with one click. It waits until you press Start.
      </p>

      <div className="ins-grid">
        <div className="ins-field">
          <span>Students will</span>
          <div className="cls-seg" role="radiogroup" aria-label="Students will">
            <button type="button" role="radio" aria-checked={mode === "assemble"} className={mode === "assemble" ? "is-on" : ""} onClick={() => setMode("assemble")}>
              Build a PC
            </button>
            <button type="button" role="radio" aria-checked={mode === "disassemble"} className={mode === "disassemble" ? "is-on" : ""} onClick={() => setMode("disassemble")}>
              Take one apart
            </button>
          </div>
        </div>
        <div className="ins-field">
          <span>Platform</span>
          <div className="cls-seg" role="radiogroup" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} className={platform === p ? "is-on" : ""} onClick={() => setPlatform(p)}>
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <label className="ins-field ins-field--wide">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle(mode, platform)} maxLength={80} />
        </label>
        <label className="ins-field ins-field--wide">
          <span>Instructions for students (optional)</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Build a PC that boots, using dual-channel RAM. Explain your PSU choice in the comments."
          />
        </label>
        <label className="ins-field">
          <span>Target time (minutes)</span>
          <input type="number" min="1" max={MAX_MINUTES} value={parMin} onChange={(e) => setParMin(e.target.value)} />
        </label>
        <label className="ins-field">
          <span>Worth (points, up to {MAX_TASK_POINTS})</span>
          <input type="number" min="1" max={MAX_TASK_POINTS} value={points} onChange={(e) => setPoints(e.target.value)} />
        </label>
      </div>

      {mode === "assemble" && (
        <fieldset className="cls-switches">
          <legend>What a complete build needs</legend>
          <Switch on={requireGpu} onChange={setRequireGpu} title="A graphics card" desc={requireGpu ? "Required: leaving it out loses marks." : "Not needed: integrated graphics is fine."} />
          <div className="cls-switch cls-switch--static">
            <span className="cls-switch__text">
              <strong>RAM sticks</strong>
              <small>{ramSticks === 2 ? "Two, in dual channel (slots 1 and 3)." : "One stick is enough."}</small>
            </span>
            <div className="cls-seg" role="radiogroup" aria-label="RAM sticks needed">
              {[1, 2].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={ramSticks === n} className={ramSticks === n ? "is-on" : ""} onClick={() => setRamSticks(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Switch on={mustBoot} onChange={setMustBoot} title="Must boot" desc={mustBoot ? "Students power it on and reach the desktop." : "Building it is enough; booting earns nothing extra."} />
        </fieldset>
      )}

      <fieldset className="cls-switches">
        <legend>How much help students get</legend>
        <Switch
          on={hints}
          onChange={setHints}
          title="Show answers"
          desc={hints ? "Hints and \"Fix:\" lines tell students what went wrong." : "Answers hidden: students troubleshoot on their own."}
        />
        {mode === "assemble" && (
          <Switch
            on={autoPick}
            onChange={setAutoPick}
            title="Auto-pick parts"
            desc={autoPick ? "The right parts are laid out for students." : "Off: students choose every part themselves."}
          />
        )}
        <Switch
          on={partInfo}
          onChange={setPartInfo}
          title="Part information"
          desc={partInfo ? "Students can open each part's info panel and specs." : "Hidden: no info panel or specs."}
        />
      </fieldset>

      <div className="cls-row cls-row--end">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Creating…" : "Create lab activity"}</button>
      </div>
    </form>
  );
}

function Switch({ on, onChange, title, desc }) {
  return (
    <label className="cls-switch">
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="cls-switch__track" aria-hidden="true" />
      <span className="cls-switch__text">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
    </label>
  );
}
