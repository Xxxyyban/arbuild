// The class's tasks: what students are told to do. Add, edit, remove, choose the default.
// Styles: styles/Instructor.css (.ins-task*).
import { useState } from "react";
import { PLATFORMS, PLATFORM_LABEL } from "../../lab/Catalog";
import { TASK_DEFAULTS, MAX_TASK_POINTS, defaultTitle, newTaskId, normalizeTask, taskSummary } from "../../lab/Tasks";
import { scenarioFaults, workingScenario } from "../../lab/Faults";
import { MAX_MINUTES } from "../../lab/Sessions";
import TroubleshootEditor from "./TroubleshootEditor";
import { HELP_OPTIONS } from "./helpOptions";
import Icon from "../Icon";

function TaskEditor({ initial, busy, onSave, onCancel }) {
  const [t, setT] = useState(() => ({ ...TASK_DEFAULTS, ...initial }));
  const set = (patch) => setT((p) => ({ ...p, ...patch }));
  const trouble = t.mode === "troubleshoot";

  // the faulty PC is built on the platform's board: a new platform starts it over from a working PC
  function setPlatform(platform) {
    const faults = trouble && t.scenario ? scenarioFaults(t.scenario, t).length : 0;
    if (faults > 0 && !window.confirm(`Switch to ${PLATFORM_LABEL[platform]}? The PC you set up starts over as a working ${PLATFORM_LABEL[platform]} PC.`)) return;
    set({ platform, scenario: workingScenario(platform), faultPoints: {} });
  }

  function save(e) {
    e.preventDefault();
    onSave(normalizeTask({ ...t, id: t.id || newTaskId() }));
  }

  return (
    <form className="ins-task ins-task--edit" onSubmit={save}>
      <div className="ins-grid">
        <label className="ins-field ins-field--wide">
          <span>Task name</span>
          <input
            value={t.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={defaultTitle(t.mode, t.platform)}
            maxLength={80}
          />
        </label>

        <label className="ins-field ins-field--wide">
          <span>Instructions for the students</span>
          <textarea
            rows={3}
            value={t.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder={
              trouble
                ? "e.g. This PC won't start properly. Find out why and fix it. Shut it down safely before touching anything."
                : "e.g. Pick parts that work together. Don't power on before the cooler has thermal paste."
            }
            maxLength={600}
          />
        </label>

        <label className="ins-field">
          <span>Students</span>
          <select value={t.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="assemble">Assemble (start with an empty case)</option>
            <option value="disassemble">Disassemble (start with a running PC)</option>
            <option value="troubleshoot">Troubleshoot (start with a faulty PC you set up)</option>
          </select>
        </label>

        <label className="ins-field">
          <span>Platform</span>
          <select value={t.platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
        </label>

        <div className="ins-field">
          <span>Target time</span>
          <div className="ins-time">
            <input
              type="number" min="1" max={MAX_MINUTES} step="1" inputMode="numeric"
              value={t.parMin}
              onChange={(e) => set({ parMin: e.target.value })}
              aria-label="Target minutes"
            />
            <span>minutes</span>
          </div>
        </div>
      </div>

      {trouble ? (
        <fieldset className="ins-grading tse-box">
          <legend>The faulty PC and its points</legend>
          <TroubleshootEditor task={t} onChange={set} />
        </fieldset>
      ) : (
        <fieldset className="ins-grading">
          <legend>Grading</legend>
          <div className="ins-grid">
            <label className="ins-field">
              <span>Worth (points)</span>
              <div className="ins-time">
                <input
                  type="number" min="1" max={MAX_TASK_POINTS} step="1" inputMode="numeric"
                  value={t.points}
                  onChange={(e) => set({ points: e.target.value })}
                  aria-label="Points the task is worth"
                />
                <span>out of {MAX_TASK_POINTS} max</span>
              </div>
            </label>
          </div>
          {t.mode === "assemble" && (
            <div className="ins-settings">
              <label className="ins-check">
                <input type="checkbox" checked={t.requireGpu} onChange={(e) => set({ requireGpu: e.target.checked })} />
                <span>Needs a graphics card</span>
              </label>
              <label className="ins-check">
                <input type="checkbox" checked={t.mustBoot} onChange={(e) => set({ mustBoot: e.target.checked })} />
                <span>Must boot (power it on and reach the desktop)</span>
              </label>
            </div>
          )}
          <p className="ins-muted ins-small">
            Full marks: everything the task asks for, done right, within the target time. Extra parts it doesn't ask for earn nothing.
          </p>
        </fieldset>
      )}

      <div className="ins-settings">
        {t.mode === "assemble" && (
          <label className="ins-check">
            <input type="checkbox" checked={t.partPicking === "auto"} onChange={(e) => set({ partPicking: e.target.checked ? "auto" : "student" })} />
            <span>Auto-pick parts: lay the right parts out (off: students choose every part themselves)</span>
          </label>
        )}
        <label className="ins-check">
          <input type="checkbox" checked={t.partInfo} onChange={(e) => set({ partInfo: e.target.checked })} />
          <span>Show part information (off: no info panel, no socket / memory labels when picking)</span>
        </label>
        <label className="ins-check">
          <input type="checkbox" checked={t.hints} onChange={(e) => set({ hints: e.target.checked })} />
          <span>Show answers: hints and "Fix:" lines (off: answers hidden, students troubleshoot on their own)</span>
        </label>
        {HELP_OPTIONS.filter((o) => !o.trouble || trouble).map((o) => (
          <label key={o.key} className="ins-check">
            <input type="checkbox" checked={t.help[o.key]} onChange={(e) => set({ help: { ...t.help, [o.key]: e.target.checked } })} />
            <span>{o.title}: {(t.help[o.key] ? o.on : o.off).replace(/^./, (c) => c.toLowerCase())}</span>
          </label>
        ))}
      </div>

      <div className="ins-row">
        <button type="submit" className="btn btn--primary" disabled={busy}>Save task</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/**
 * tasks, defaultTaskId   from sessionTasks(session)
 * counts                 task id -> number of students on it
 * onSave(tasks, defaultTaskId), onRemove(taskId)
 */
export default function TaskPanel({ tasks, defaultTaskId, counts, busy, onSave, onRemove }) {
  const [editing, setEditing] = useState(null); // task id, "new", or null

  function save(task) {
    const exists = tasks.some((t) => t.id === task.id);
    const next = exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task];
    onSave(next, defaultTaskId);
    setEditing(null);
  }

  return (
    <section className="ins-panel">
      <div className="ins-head">
        <h2>Tasks</h2>
        {editing !== "new" && (
          <button className="btn btn--primary" disabled={busy} onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} />
            Add task
          </button>
        )}
      </div>
      <p className="ins-muted ins-small">
        A task tells students what to do. Give different students different tasks in the class list below.
        Changing a task's mode, platform, part picking or faulty PC sends its students back to the start.
      </p>

      <div className="ins-tasks">
        {tasks.map((t) =>
          editing === t.id ? (
            <TaskEditor key={t.id} initial={t} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <article key={t.id} className={`ins-task ${t.id === defaultTaskId ? "is-default" : ""}`}>
              <div className="ins-task__top">
                <strong>{t.title}</strong>
                {t.id === defaultTaskId && <span className="ins-badge ins-badge--live">Default</span>}
                <span className="ins-badge">{counts[t.id] || 0} students</span>
              </div>
              <p className="ins-task__summary">{taskSummary(t)}</p>
              {t.instructions && <p className="ins-task__text">{t.instructions}</p>}
              <div className="ins-row ins-row--wrap">
                <button className="btn" disabled={busy} onClick={() => setEditing(t.id)}>Edit</button>
                {t.id !== defaultTaskId && (
                  <button className="btn" disabled={busy} onClick={() => onSave(tasks, t.id)}>Make default</button>
                )}
                {tasks.length > 1 && (
                  <button
                    className="btn btn--danger"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(`Remove "${t.title}"? Its students move to the default task.`) && onRemove(t.id)
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          )
        )}
        {editing === "new" && (
          <TaskEditor
            initial={{ mode: "assemble", platform: "am4" }}
            busy={busy}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
    </section>
  );
}
