// One lab activity, live: start and close it, write tasks, give each student a task, watch their
// progress, and read what they did (a report per student and the class's common mistakes).
import { useEffect, useState } from "react";
import { normalizeSetup } from "../../lab/Setup";
import { MODE_LABEL, sessionTasks, taskFor } from "../../lab/Tasks";
import {
  subscribeSession,
  subscribeStudents,
  subscribeAllEvents,
  startSession,
  reopenSession,
  closeSession,
  updateSetup,
  saveTasks,
  assignTask,
  sessionPhase,
  formatClock,
  formatMs,
  resultsToCsv,
} from "../../lab/Sessions";
import TaskPanel from "./TaskPanel";
import { StudentReport, CommonMistakes } from "./Feedback";
import { scoreText, cappedScore } from "../../lab/Scoring";
import AppShell from "../AppShell";
import Icon from "../Icon";
import { CopyButton } from "../class/ClassBits";

/* ---------- small helpers ---------- */

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function ago(iso, now) {
  const t = Date.parse(iso || "");
  if (!t) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function studentState(s, phase, now) {
  if (phase === "waiting") return ["live", "Joined"];
  if (s.taskDone) return ["done", "Task done"];
  const last = Date.parse(s.lastActive || "") || 0;
  return now - last < 90000 ? ["live", "Working"] : ["idle", "Idle"];
}

function downloadCsv(session, students) {
  const blob = new Blob([resultsToCsv(students, session)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.code}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- one lab: tasks, roster, live results, feedback ---------- */

/** back: { to, label }, the page the back link goes to. */
export default function LabMonitor({ code, back }) {
  const now = useNow();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [picked, setPicked] = useState(null); // student whose report is open
  const [selected, setSelected] = useState(() => new Set()); // students ticked for a bulk task change
  const [bulkTask, setBulkTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fail = (err) => setError(err.code || err.message);

  useEffect(() => subscribeSession(code, setSession, fail), [code]);
  useEffect(() => subscribeStudents(code, setStudents, fail), [code]);
  useEffect(() => subscribeAllEvents(code, setEvents, fail), [code]);

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <AppShell className="app-page--content" back={back} title={error ? "Lab not found" : "Loading lab…"}>
        {error && <div className="ins-alert">{error}</div>}
      </AppShell>
    );
  }

  const phase = sessionPhase(session, now);
  const runningFor = Math.max(0, now - (session.startedAt?.toMillis?.() ?? now));
  const setup = normalizeSetup(session.setup);
  const change = (patch) => run(() => updateSetup(code, patch));
  const { tasks, defaultTaskId } = sessionTasks(session);

  const sorted = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  // average share of their task's points, among students with an official score
  const graded = students.filter((s) => s.scoreScale);
  const avg = graded.length
    ? Math.round((graded.reduce((n, s) => n + cappedScore(s, taskFor(session, s).points) / taskFor(session, s).points, 0) / graded.length) * 100)
    : 0;
  const mistakes = students.reduce((n, s) => n + (s.mistakes || 0), 0);
  const doneCount = students.filter((s) => s.taskDone).length;
  const counts = {};
  students.forEach((s) => {
    const t = taskFor(session, s);
    counts[t.id] = (counts[t.id] || 0) + 1;
  });
  const pickedStudent = students.find((s) => s.id === picked);
  const allTicked = students.length > 0 && selected.size === students.length;

  function toggle(uid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function giveSelected() {
    if (selected.size === 0 || !bulkTask) return;
    const uids = [...selected];
    run(async () => {
      await assignTask(code, uids, bulkTask === "default" ? null : bulkTask);
      setSelected(new Set());
    });
  }

  function removeTask(taskId) {
    const left = tasks.filter((t) => t.id !== taskId);
    const def = taskId === defaultTaskId ? left[0].id : defaultTaskId;
    const theirs = students.filter((s) => s.assignedTask === taskId).map((s) => s.id);
    run(async () => {
      await saveTasks(code, left, def);
      if (theirs.length) await assignTask(code, theirs, null);
    });
  }

  return (
    <AppShell
      className="app-page--content lab-monitor"
      back={back}
      eyebrow={`${session.className ? `${session.className} · ` : ""}${phase === "waiting" ? "Waiting to start" : phase === "running" ? "Lab running" : "Lab closed"}`}
      title={session.title}
      subtitle="Lab activity monitor: start and close the lab, set tasks, and follow every student live."
    >
      {error && <div className="ins-alert" role="alert">{error}</div>}

      <section className="ins-panel ins-hero">
        <div>
          <span className="ins-label">{session.classId ? "Lab code" : "Class code"}</span>
          <div className="ins-code">{code}</div>
          <CopyButton text={code} label="Copy code" />
          {session.classId && (
            <p className="ins-muted ins-small">Students in the class open this lab from their class page. No code needed.</p>
          )}
        </div>

        {phase === "waiting" && (
          <div>
            <span className="ins-label">Not started</span>
            <p className="ins-muted ins-small">
              Students who join now wait and can read their task. Each student's clock starts when you press Start.
              Finishing within a task's target time keeps every point; slower work keeps fewer, down to half at
              three times the target.
            </p>
            <button className="btn btn--primary" disabled={busy} onClick={() => run(() => startSession(code))}>
              <Icon name="play" size={15} />
              Start lab
            </button>
          </div>
        )}

        {phase === "running" && (
          <div>
            <span className="ins-label">Running for</span>
            <div className="ins-clock">{formatClock(runningFor)}</div>
            <button
              className="btn btn--danger"
              disabled={busy}
              onClick={() => window.confirm("Close the lab for everyone? Results are kept.") && run(() => closeSession(code))}
            >
              Close lab
            </button>
          </div>
        )}

        {phase === "ended" && (
          <div>
            <span className="ins-label">Lab closed</span>
            <div className="ins-clock is-ended">Closed</div>
            <button className="btn" disabled={busy} onClick={() => run(() => reopenSession(code, session))}>
              <Icon name="refresh" size={15} />
              Reopen
            </button>
          </div>
        )}

        <div className="ins-stats">
          <div><b>{students.length}</b><span>Joined</span></div>
          <div><b>{doneCount}</b><span>Task done</span></div>
          <div><b>{avg}%</b><span>Avg score</span></div>
          <div><b>{mistakes}</b><span>Mistakes</span></div>
        </div>
      </section>

      <TaskPanel
        tasks={tasks}
        defaultTaskId={defaultTaskId}
        counts={counts}
        busy={busy}
        onSave={(next, def) => run(() => saveTasks(code, next, def))}
        onRemove={removeTask}
      />

      <section className="ins-panel">
        <div className="ins-head">
          <h2 className="panel-title">Class list</h2>
          <button className="btn" disabled={students.length === 0} onClick={() => downloadCsv(session, students)}>
            <Icon name="download" size={16} />
            Export results (CSV)
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="ins-muted">
            {session.classId
              ? "Nobody has opened this lab yet. Students in the class find it on their class page."
              : "Nobody has joined yet. Give students the code above."}
          </p>
        ) : (
          <>
            <div className="ins-row ins-row--wrap ins-assignbar">
              <span className="ins-muted">
                {selected.size > 0 ? `${selected.size} selected` : "Tick students to give them a task together"}
              </span>
              <span className="ins-spacer" />
              <select
                className="ins-select"
                value={bulkTask}
                onChange={(e) => setBulkTask(e.target.value)}
                aria-label="Task to give the selected students"
              >
                <option value="">Choose a task…</option>
                <option value="default">Class default</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <button className="btn btn--primary" disabled={busy || selected.size === 0 || !bulkTask} onClick={giveSelected}>
                Give task
              </button>
            </div>

            <div className="ins-table-wrap">
              <table className="ins-table">
                <thead>
                  <tr>
                    <th className="ins-tick">
                      <input
                        type="checkbox"
                        aria-label="Select everyone"
                        checked={allTicked}
                        onChange={() => setSelected(allTicked ? new Set() : new Set(students.map((s) => s.id)))}
                      />
                    </th>
                    <th>Student</th><th>Task</th><th>Progress</th><th title="Official score, out of the task's points">Score</th>
                    <th>Time</th><th>Mistakes</th><th>Status</th><th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => {
                    const [tone, label] = studentState(s, phase, now);
                    const time = s.mode === "disassemble" ? s.disassembleMs : s.assembleMs;
                    return (
                      <tr key={s.id} className={picked === s.id ? "is-picked" : ""} onClick={() => setPicked(picked === s.id ? null : s.id)}>
                        <td className="ins-tick" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                        </td>
                        <td>
                          <strong>{s.name}</strong>
                          <small>{[s.studentId, s.section].filter(Boolean).join(" · ")}</small>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="ins-select"
                            value={s.assignedTask && tasks.some((t) => t.id === s.assignedTask) ? s.assignedTask : ""}
                            disabled={busy}
                            aria-label={`Task for ${s.name}`}
                            onChange={(e) => run(() => assignTask(code, [s.id], e.target.value || null))}
                          >
                            <option value="">Default ({tasks.find((t) => t.id === defaultTaskId)?.title})</option>
                            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </select>
                        </td>
                        <td>
                          {s.taskDone ? (
                            <span className="ins-badge ins-badge--done">Done · {formatMs(s.taskMs)}</span>
                          ) : (
                            <>{MODE_LABEL[s.mode] || "—"}{s.partsLeft != null ? ` · ${s.partsLeft} parts left` : ""}</>
                          )}
                        </td>
                        <td className="ins-num">{scoreText(s, taskFor(session, s).points)}</td>
                        <td className="ins-num" title={`Assemble ${formatMs(s.assembleMs) || "0:00"} · Disassemble ${formatMs(s.disassembleMs) || "0:00"}`}>
                          {formatMs(time) || "—"}
                        </td>
                        <td className="ins-num">{s.mistakes ?? 0}</td>
                        <td><span className={`ins-badge ins-badge--${tone}`}>{label}</span></td>
                        <td>{ago(s.lastActive, now)}{(s.joins || 1) > 1 ? ` · rejoined ${s.joins - 1}×` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="ins-muted ins-hint">
              A new task sends the student back to its start. Click a row to open that student's report.
            </p>
          </>
        )}
      </section>

      {pickedStudent && (
        <StudentReport
          student={pickedStudent}
          task={taskFor(session, pickedStudent)}
          events={events}
          onClose={() => setPicked(null)}
        />
      )}

      <CommonMistakes events={events} students={students} />

      <section className="ins-panel">
        <h2 className="panel-title">Lab rules</h2>
        <div className="ins-settings">
          <label className="ins-field">
            <span>Who switches between assemble and disassemble</span>
            <select value={setup.modeControl} disabled={busy} onChange={(e) => change({ modeControl: e.target.value })}>
              <option value="student">Students</option>
              <option value="instructor">Nobody (stay on the task)</option>
            </select>
          </label>

          {setup.modeControl === "student" && (
            <label className="ins-field">
              <span>Students may switch</span>
              <select value={setup.toggle} disabled={busy} onChange={(e) => change({ toggle: e.target.value })}>
                <option value="free">Any time</option>
                <option value="afterComplete">After finishing the task</option>
                <option value="locked">Never</option>
              </select>
            </label>
          )}

          <label className="ins-field">
            <span>Penalty for undoing work</span>
            <select value={setup.revertPenalty} disabled={busy} onChange={(e) => change({ revertPenalty: e.target.value })}>
              <option value="off">Off</option>
              <option value="light">Light</option>
              <option value="strict">Strict</option>
            </select>
          </label>

          <label className="ins-check">
            <input type="checkbox" checked={setup.autoPrompt} disabled={busy} onChange={(e) => change({ autoPrompt: e.target.checked })} />
            <span>Offer the next step when a student finishes</span>
          </label>
        </div>
      </section>
    </AppShell>
  );
}

