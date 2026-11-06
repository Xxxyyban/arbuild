// What the instructor learns from a class: one student's report, and the class's common mistakes.
// Both read the events students send while the class runs (sessions/{code}/events).
// Styles: styles/Instructor.css (.ins-report*, .ins-common*).
import { useState } from "react";
import { MISTAKE_TYPES, summarizeEvents } from "../../lab/reportEvent";
import { PART_LABEL } from "../../lab/Constants";
import { formatMs } from "../../lab/Sessions";
import { taskSummary } from "../../lab/Tasks";
import { scoreText } from "../../lab/Scoring";

export const KIND_LABEL = {
  compat: "Wrong part",
  miss: "Wrong placement",
  blocked: "Out of order",
  safety: "Safety",
  bootfail: "Didn't boot",
  revert: "Undid work",
  penalty: "Penalty",
  success: "Done",
  pick: "Picked",
  task: "Task done",
  reset: "Reset",
  integrity: "Exam",
};

const KIND_TONE = { safety: "danger", penalty: "danger", compat: "danger", success: "live", task: "done", pick: "idle", integrity: "danger" };

// Steps that aren't parts (power on, safety steps, the task itself) get a readable name too.
const STEP_LABEL = {
  post: "Power on", boot: "Power on", paste: "Thermal paste", shutdown: "Shut down", unplug: "Unplug",
  bench: "Bench", assemble: "Assemble", disassemble: "Disassemble", ram: "RAM", exam: "Exam rules",
};
const partName = (p) => PART_LABEL[p] || STEP_LABEL[p] || (p ? p.replace(/_/g, " ") : "");

/** Repeated mistakes, most common first: [{ key, type, detail, count, uids:Set }] */
function groupMistakes(events) {
  const map = new Map();
  for (const e of events) {
    if (!MISTAKE_TYPES.includes(e.type)) continue;
    const key = `${e.type}|${e.detail}`;
    const g = map.get(key) || { key, type: e.type, detail: e.detail, part: e.part, count: 0, uids: new Set() };
    g.count++;
    if (e.uid) g.uids.add(e.uid);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.uids.size - a.uids.size || b.count - a.count);
}

function KindChips({ summary }) {
  const kinds = Object.entries(summary.byType).sort((a, b) => b[1] - a[1]);
  if (kinds.length === 0) return null;
  return (
    <div className="ins-chips">
      {kinds.map(([k, n]) => (
        <span key={k}>{KIND_LABEL[k] || k}: {n}</span>
      ))}
    </div>
  );
}

/* ---------- one student ---------- */

export function StudentReport({ student, task, events, onClose }) {
  const [all, setAll] = useState(false);
  const mine = events.filter((e) => e.uid === student.id);
  const summary = summarizeEvents(mine);
  const repeated = groupMistakes(mine).filter((g) => g.count > 1).slice(0, 5);
  const shown = all ? mine : mine.filter((e) => MISTAKE_TYPES.includes(e.type) || e.type === "task" || e.type === "integrity");
  // the exam lockdown's warnings (components/lab/ExamGuard.jsx)
  const examWarnings = mine.filter((e) => e.type === "integrity");
  const timesLeft = examWarnings.filter((e) => /^Left the lab/.test(e.detail || "")).length;

  return (
    <section className="ins-panel ins-report">
      <div className="ins-head">
        <div>
          <h2>{student.name}</h2>
          <small className="ins-muted">{[student.studentId, student.section].filter(Boolean).join(" · ")}</small>
        </div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      <p className="ins-report__task">
        <b>{task.title}</b> <span className="ins-muted">{taskSummary(task)}</span>
      </p>

      <div className="ins-report__tiles">
        <div><span>Score</span><b>{scoreText(student, task?.points)}</b></div>
        <div>
          <span>Task</span>
          <b className={student.taskDone ? "is-good" : ""}>{student.taskDone ? `Done in ${formatMs(student.taskMs)}` : "Not finished"}</b>
        </div>
        {task?.mode === "troubleshoot" ? (
          // fixing a PC is scored by the faults fixed, timed as one job
          <>
            <div>
              <span>Faults fixed</span>
              <b>{student.faultsFixed ?? 0} of {student.faultsTotal ?? Object.keys(task.faultPoints).length}</b>
            </div>
            <div>
              <span>Time</span>
              <b>{formatMs((student.assembleMs || 0) + (student.disassembleMs || 0)) || "0:00"}</b>
              <small>{formatMs(student.disassembleMs) || "0:00"} of it taking apart</small>
            </div>
          </>
        ) : (
          <>
            <div><span>Assemble</span><b>{student.assemble ?? 0} pts</b><small>{formatMs(student.assembleMs) || "0:00"}</small></div>
            <div><span>Disassemble</span><b>{student.disassemble ?? 0} pts</b><small>{formatMs(student.disassembleMs) || "0:00"}</small></div>
            <div><span>Penalties</span><b className={student.penalty ? "is-bad" : ""}>-{student.penalty ?? 0}</b></div>
          </>
        )}
        <div><span>Mistakes</span><b className={summary.total ? "is-bad" : ""}>{summary.total}</b><small>{summary.safety} safety</small></div>
        {examWarnings.length > 0 && (
          <div>
            <span>Exam warnings</span>
            <b className="is-bad">{examWarnings.length}</b>
            <small>{timesLeft ? `left the lab ${timesLeft}×` : "no time away"}</small>
          </div>
        )}
      </div>

      <KindChips summary={summary} />

      {repeated.length > 0 && (
        <div className="ins-report__repeat">
          <h3>Kept doing</h3>
          <ul>
            {repeated.map((g) => (
              <li key={g.key}><b>{g.count}×</b> {g.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="ins-head">
        <h3>{all ? "Everything they did" : examWarnings.length ? "Mistakes and exam warnings" : "Mistakes"}</h3>
        <label className="ins-check ins-check--inline">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          <span>Show every step</span>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="ins-muted">{all ? "Nothing recorded yet." : "No mistakes recorded. Clean work so far."}</p>
      ) : (
        <ul className="ins-log">
          {shown.map((e) => (
            <li key={e.id}>
              <time>{new Date(e.ts).toLocaleTimeString()}</time>
              <span className={`ins-badge ins-badge--${KIND_TONE[e.type] || "idle"}`}>{KIND_LABEL[e.type] || e.type}</span>
              <b>{partName(e.part)}</b>
              <span>{e.detail}</span>
              {e.points ? <em>{e.points > 0 ? `+${e.points}` : e.points}</em> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- the whole class ---------- */

export function CommonMistakes({ events, students }) {
  const groups = groupMistakes(events).slice(0, 8);
  const summary = summarizeEvents(events);
  const nameOf = Object.fromEntries(students.map((s) => [s.id, s.name]));
  const top = groups[0]?.uids.size || 1;

  return (
    <section className="ins-panel">
      <h2>Common mistakes</h2>
      {groups.length === 0 ? (
        <p className="ins-muted">No mistakes recorded yet. They show up here as students work.</p>
      ) : (
        <>
          <KindChips summary={summary} />
          <ul className="ins-common">
            {groups.map((g) => {
              const names = [...g.uids].map((u) => nameOf[u] || "Unknown");
              return (
                <li key={g.key} title={names.join(", ")}>
                  <div className="ins-common__row">
                    <span className={`ins-badge ins-badge--${KIND_TONE[g.type] || "idle"}`}>{KIND_LABEL[g.type] || g.type}</span>
                    <span className="ins-common__detail">{g.detail}</span>
                    <span className="ins-common__count">
                      {g.uids.size} {g.uids.size === 1 ? "student" : "students"} · {g.count}×
                    </span>
                  </div>
                  <i className="ins-common__bar" style={{ width: `${Math.max(6, (g.uids.size / top) * 100)}%` }} />
                </li>
              );
            })}
          </ul>
          <p className="ins-muted ins-small">Hover a line to see who made it. Worth going over with the whole class.</p>
        </>
      )}
    </section>
  );
}
