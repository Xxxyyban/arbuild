// Making a lab activity inside a class: what students do in the Build Lab, and how much help they get.
// It opens as "waiting": students can open it and read the task; the instructor presses Start.
import { useState } from "react";
import { PLATFORM_LABEL, PLATFORMS } from "../../lab/Catalog";
import { defaultTitle, MAX_TASK_POINTS } from "../../lab/Tasks";
import { HELP_DEFAULTS } from "../../lab/Setup";
import { BOOT_POINTS, scenarioFaults, workingScenario } from "../../lab/Faults";
import { MAX_MINUTES } from "../../lab/Sessions";
import TroubleshootEditor from "../instructor/TroubleshootEditor";
import { HELP_OPTIONS } from "../instructor/helpOptions";

const MODES = [
  { id: "assemble", label: "Build a PC" },
  { id: "disassemble", label: "Take one apart" },
  { id: "troubleshoot", label: "Fix a faulty PC" },
];

export default function LabActivityForm({ busy, onCreate, onCancel }) {
  const [mode, setMode] = useState("assemble");
  const [platform, setPlatform] = useState("am4");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [parMin, setParMin] = useState(15);
  const [hints, setHints] = useState(true);
  const [help, setHelp] = useState({ ...HELP_DEFAULTS });
  const [autoPick, setAutoPick] = useState(false);
  const [partInfo, setPartInfo] = useState(true);
  const [points, setPoints] = useState(100);
  const [requireGpu, setRequireGpu] = useState(true);
  const [ramSticks, setRamSticks] = useState(2);
  const [mustBoot, setMustBoot] = useState(true);
  const [due, setDue] = useState(""); // "2026-11-10T17:00" from the date and time box, or "" for none
  // troubleshooting: the PC students get, and its faults' points (TroubleshootEditor)
  const [fix, setFix] = useState(() => ({ scenario: workingScenario("am4"), faultPoints: {}, bootPoints: BOOT_POINTS }));
  const trouble = mode === "troubleshoot";

  const task = {
    title: title.trim() || defaultTitle(mode, platform),
    instructions,
    mode,
    platform,
    parMin: Math.min(MAX_MINUTES, Math.max(1, Math.floor(Number(parMin)) || 15)),
    hints,
    help,
    partPicking: autoPick && mode === "assemble" ? "auto" : "student",
    partInfo,
    points: Math.min(MAX_TASK_POINTS, Math.max(1, Math.floor(Number(points)) || 100)),
    requireGpu,
    ramSticks,
    mustBoot,
    ...(trouble ? fix : {}),
  };

  // the faulty PC is built on the platform's board: a new platform starts it over from a working PC
  function choosePlatform(p) {
    if (p === platform) return;
    const faults = scenarioFaults(fix.scenario, { platform, ramSticks, requireGpu }).length;
    if (trouble && faults > 0 && !window.confirm(`Switch to ${PLATFORM_LABEL[p]}? The PC you set up starts over as a working ${PLATFORM_LABEL[p]} PC.`)) return;
    setPlatform(p);
    setFix((f) => ({ ...f, scenario: workingScenario(p), faultPoints: {} }));
  }

  function changeFix(patch) {
    const { ramSticks: sticks, requireGpu: gpu, ...rest } = patch;
    if (sticks !== undefined) setRamSticks(sticks);
    if (gpu !== undefined) setRequireGpu(gpu);
    setFix((f) => ({ ...f, ...rest }));
  }

  function submit(e) {
    e.preventDefault();
    const dueAt = due ? new Date(due) : null;
    onCreate({ title: task.title, task, dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null });
  }

  return (
    <form className="ins-panel cls-labform" onSubmit={submit}>
      <h2>New lab activity</h2>
      <p className="ins-muted ins-small">
        Students in this class see it in their stream and open it with one click. It waits until you press Start.
      </p>

      <div className="ins-grid">
        <div className="ins-field ins-field--wide">
          <span>Students will</span>
          <div className="cls-seg" role="radiogroup" aria-label="Students will">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? "is-on" : ""} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ins-field">
          <span>Platform</span>
          <div className="cls-seg" role="radiogroup" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} className={platform === p ? "is-on" : ""} onClick={() => choosePlatform(p)}>
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
            placeholder={
              trouble
                ? "e.g. This PC won't start properly. Find out why, fix it, and list what you fixed in the comments."
                : "e.g. Build a PC that boots, using dual-channel RAM. Explain your PSU choice in the comments."
            }
          />
        </label>
        <label className="ins-field">
          <span>Target time (minutes)</span>
          <input type="number" min="1" max={MAX_MINUTES} value={parMin} onChange={(e) => setParMin(e.target.value)} />
        </label>
        {!trouble && (
          <label className="ins-field">
            <span>Worth (points, up to {MAX_TASK_POINTS})</span>
            <input type="number" min="1" max={MAX_TASK_POINTS} value={points} onChange={(e) => setPoints(e.target.value)} />
          </label>
        )}
        {/* students see it in their calendar; not done by then, the bell tells them */}
        <label className="ins-field">
          <span>Due (optional)</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>

      {trouble && (
        <fieldset className="cls-switches tse-box">
          <legend>The faulty PC</legend>
          <TroubleshootEditor task={task} onChange={changeFix} />
        </fieldset>
      )}

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
        {HELP_OPTIONS.filter((o) => !o.trouble || trouble).map((o) => (
          <Switch
            key={o.key}
            on={help[o.key]}
            onChange={(on) => setHelp((h) => ({ ...h, [o.key]: on }))}
            title={o.title}
            desc={help[o.key] ? o.on : o.off}
          />
        ))}
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
