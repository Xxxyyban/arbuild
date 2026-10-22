// Instructor page: create a class, give the code, assign who does what on which platform, watch live.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { normalizeSetup } from "../lab/Setup";
import { summarizeEvents } from "../lab/reportEvent";
import { PLATFORMS, PLATFORM_LABEL } from "../lab/Catalog";
import {
  MAX_MINUTES,
  createSession,
  listMySessions,
  subscribeSession,
  subscribeStudents,
  subscribeEvents,
  startSession,
  reopenSession,
  closeSession,
  updateSetup,
  assignStudent,
  assignMany,
  sessionPhase,
  parseMinutes,
  formatMinutes,
  formatClock,
  formatMs,
  resultsToCsv,
} from "../lab/Sessions";
import "../styles/BuildLab.css";
import "../styles/Instructor.css";

/* ---------- small helpers ---------- */

function useNow(ms = 1000) {
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
  if (s.phaseDone) return ["done", "Phase done"];
  const last = Date.parse(s.lastActive || "") || 0;
  return now - last < 90000 ? ["live", "Working"] : ["idle", "Idle"];
}

const MODE_LABEL = { assemble: "Assemble", disassemble: "Disassemble" };

function downloadCsv(session, students) {
  const blob = new Blob([resultsToCsv(students, session.setup)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.code}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** A number box the instructor types minutes into. */
function MinutesInput({ value, onChange, label }) {
  return (
    <div className="ins-time">
      <input
        type="number"
        min="1"
        max={MAX_MINUTES}
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      <span>minutes</span>
    </div>
  );
}

/* ---------- one class: roster, assignments, timer, live results ---------- */

function Monitor({ code, onBack }) {
  const now = useNow();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [picked, setPicked] = useState(null);
  const [events, setEvents] = useState([]);
  const [parDraft, setParDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fail = (err) => setError(err.code || err.message);

  useEffect(() => subscribeSession(code, setSession, fail), [code]);
  useEffect(() => subscribeStudents(code, setStudents, fail), [code]);
  useEffect(() => {
    if (!picked) {
      setEvents([]);
      return undefined;
    }
    return subscribeEvents(code, picked, setEvents, fail);
  }, [code, picked]);

  // fill the target-time box once, from the value saved with the class
  useEffect(() => {
    if (session && parDraft === "") setParDraft(String(normalizeSetup(session.setup).parMin));
  }, [session, parDraft]);

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

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  if (!session) {
    return (
      <div className="instructor">
        <main className="instructor__main">
          <p className="ins-muted">Loading class…</p>
          {error && <div className="ins-alert">{error}</div>}
          <button className="flow-btn" onClick={onBack}>Back</button>
        </main>
      </div>
    );
  }

  const phase = sessionPhase(session, now);
  const runningFor = Math.max(0, now - (session.startedAt?.toMillis?.() ?? now));
  const setup = normalizeSetup(session.setup);
  const change = (patch) => run(() => updateSetup(code, patch));

  const sorted = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const avg = students.length ? Math.round(students.reduce((n, s) => n + (s.score || 0), 0) / students.length) : 0;
  const mistakes = students.reduce((n, s) => n + (s.mistakes || 0), 0);
  const modeOf = (s) => s.assignedMode || setup.startMode;
  const platformOf = (s) => s.assignedPlatform || setup.platform;
  const countAssemble = students.filter((s) => modeOf(s) === "assemble").length;
  const countDisassemble = students.length - countAssemble;
  const countAm5 = students.filter((s) => platformOf(s) === "am5").length;
  const pickedStudent = students.find((s) => s.id === picked);
  const summary = summarizeEvents(events);
  const everyone = students.map((s) => s.id);

  function savePar() {
    const m = parseMinutes(parDraft);
    if (!m) return setError(`Type the target time in minutes (1 to ${MAX_MINUTES}).`);
    if (m !== setup.parMin) change({ parMin: m });
  }

  return (
    <div className="instructor">
      <header className="instructor__bar">
        <button className="flow-btn" onClick={onBack}>← All classes</button>
        <div className="instructor__title">
          <span className="instructor__badge">
            {phase === "waiting" ? "Waiting to start" : phase === "running" ? "Class running" : "Class ended"}
          </span>
          <h1>{session.title}</h1>
        </div>
      </header>

      <main className="instructor__main">
        {error && <div className="ins-alert" role="alert">{error}</div>}

        <section className="ins-panel ins-hero">
          <div>
            <span className="ins-label">Class code</span>
            <div className="ins-code">{code}</div>
            <button className="flow-btn flow-btn--tool" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button>
          </div>

          {phase === "waiting" && (
            <div>
              <span className="ins-label">Not started</span>
              <p className="ins-muted ins-small">
                Students who join now wait. Assign each one a task and a platform below, then start.
                Each student's clock starts here and counts up: finishing a phase within {setup.parMin} min keeps every
                point, slower work keeps fewer (down to half at {setup.parMin * 3} min).
              </p>
              <button className="flow-btn flow-btn--accent" disabled={busy} onClick={() => run(() => startSession(code))}>Start class</button>
            </div>
          )}

          {phase === "running" && (
            <div>
              <span className="ins-label">Running for</span>
              <div className="ins-clock">{formatClock(runningFor)}</div>
              <button
                className="flow-btn flow-btn--danger"
                disabled={busy}
                onClick={() => window.confirm("Close the class for everyone? Results are kept.") && run(() => closeSession(code))}
              >
                Close class
              </button>
            </div>
          )}

          {phase === "ended" && (
            <div>
              <span className="ins-label">Class ended</span>
              <div className="ins-clock is-ended">Closed</div>
              <button className="flow-btn" disabled={busy} onClick={() => run(() => reopenSession(code, session))}>Reopen</button>
            </div>
          )}

          <div className="ins-stats">
            <div><b>{students.length}</b><span>Joined</span></div>
            <div><b>{avg}</b><span>Avg score</span></div>
            <div><b>{mistakes}</b><span>Mistakes</span></div>
          </div>
        </section>

        <section className="ins-panel">
          <h2>Class rules</h2>
          <div className="ins-settings">
            <label className="ins-field">
              <span>Default start{phase !== "waiting" ? " (locked once started)" : ""}</span>
              <select
                value={setup.startMode}
                disabled={busy || phase !== "waiting"}
                onChange={(e) =>
                  change({ startMode: e.target.value, startState: e.target.value === "disassemble" ? "full" : "empty" })
                }
              >
                <option value="assemble">Assemble (empty bench)</option>
                <option value="disassemble">Disassemble (running PC)</option>
              </select>
            </label>

            <label className="ins-field">
              <span>Default platform{phase !== "waiting" ? " (locked once started)" : ""}</span>
              <select value={setup.platform} disabled={busy || phase !== "waiting"} onChange={(e) => change({ platform: e.target.value })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
              </select>
            </label>

            <div className="ins-field">
              <span>Target time per phase</span>
              <div className="ins-row">
                <MinutesInput value={parDraft} onChange={setParDraft} label="Target minutes per phase" />
                <button className="flow-btn" disabled={busy || parseMinutes(parDraft) === setup.parMin} onClick={savePar}>Save</button>
              </div>
            </div>

            <label className="ins-field">
              <span>Who switches modes</span>
              <select value={setup.modeControl} disabled={busy} onChange={(e) => change({ modeControl: e.target.value })}>
                <option value="student">Students</option>
                <option value="instructor">Instructor only</option>
              </select>
            </label>

            {setup.modeControl === "student" && (
              <label className="ins-field">
                <span>Students may switch</span>
                <select value={setup.toggle} disabled={busy} onChange={(e) => change({ toggle: e.target.value })}>
                  <option value="free">Any time</option>
                  <option value="afterComplete">After finishing the phase</option>
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
              <input
                type="checkbox"
                checked={setup.partPicking === "student"}
                disabled={busy}
                onChange={(e) => change({ partPicking: e.target.checked ? "student" : "auto" })}
              />
              <span>Students pick their own parts (off: the right parts are laid out for them)</span>
            </label>

            <label className="ins-check">
              <input type="checkbox" checked={setup.partInfo} disabled={busy} onChange={(e) => change({ partInfo: e.target.checked })} />
              <span>Show part information (off: no info panel and no socket / memory labels when picking)</span>
            </label>

            <label className="ins-check">
              <input type="checkbox" checked={setup.hints} disabled={busy} onChange={(e) => change({ hints: e.target.checked })} />
              <span>Show hints and fixes (turn off so students troubleshoot alone)</span>
            </label>

            <label className="ins-check">
              <input type="checkbox" checked={setup.autoPrompt} disabled={busy} onChange={(e) => change({ autoPrompt: e.target.checked })} />
              <span>Offer the next phase when a student finishes</span>
            </label>
          </div>
        </section>

        <section className="ins-panel">
          <div className="ins-head">
            <h2>Class list</h2>
            <button className="flow-btn flow-btn--tool" disabled={students.length === 0} onClick={() => downloadCsv(session, students)}>
              Export results (CSV)
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="ins-muted">Nobody has joined yet. Give students the code above.</p>
          ) : (
            <>
              <div className="ins-row ins-row--wrap ins-assignbar">
                <span className="ins-muted">
                  {countAssemble} assemble · {countDisassemble} take apart · {students.length - countAm5} AM4 · {countAm5} AM5
                </span>
                <span className="ins-spacer" />
                <span className="ins-muted">Set everyone to</span>
                <button className="flow-btn" disabled={busy} onClick={() => run(() => assignMany(code, everyone, { assignedMode: "assemble" }))}>Assemble</button>
                <button className="flow-btn" disabled={busy} onClick={() => run(() => assignMany(code, everyone, { assignedMode: "disassemble" }))}>Disassemble</button>
                {PLATFORMS.map((p) => (
                  <button key={p} className="flow-btn" disabled={busy} onClick={() => run(() => assignMany(code, everyone, { assignedPlatform: p }))}>
                    {PLATFORM_LABEL[p]}
                  </button>
                ))}
                <button
                  className="flow-btn flow-btn--tool"
                  disabled={busy}
                  onClick={() => run(() => assignMany(code, everyone, { assignedMode: null, assignedPlatform: null }))}
                >
                  Class default
                </button>
              </div>

              <div className="ins-table-wrap">
                <table className="ins-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Starts with</th><th>Platform</th><th>Now in</th><th>Score</th>
                      <th>Time</th><th>Parts left</th><th>Mistakes</th><th>Status</th><th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => {
                      const [tone, label] = studentState(s, phase, now);
                      return (
                        <tr key={s.id} className={picked === s.id ? "is-picked" : ""} onClick={() => setPicked(picked === s.id ? null : s.id)}>
                          <td>
                            <strong>{s.name}</strong>
                            <small>{[s.studentId, s.section].filter(Boolean).join(" · ")}</small>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="ins-select"
                              value={s.assignedMode || ""}
                              disabled={busy}
                              aria-label={`Start mode for ${s.name}`}
                              onChange={(e) => run(() => assignStudent(code, s.id, { assignedMode: e.target.value || null }))}
                            >
                              <option value="">Class default ({MODE_LABEL[setup.startMode]})</option>
                              <option value="assemble">Assemble</option>
                              <option value="disassemble">Disassemble</option>
                            </select>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="ins-select"
                              value={s.assignedPlatform || ""}
                              disabled={busy}
                              aria-label={`Platform for ${s.name}`}
                              onChange={(e) => run(() => assignStudent(code, s.id, { assignedPlatform: e.target.value || null }))}
                            >
                              <option value="">Default ({PLATFORM_LABEL[setup.platform]})</option>
                              {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
                            </select>
                          </td>
                          <td>{MODE_LABEL[s.mode] || "—"}</td>
                          <td className="ins-num">{s.score ?? 0}</td>
                          <td className="ins-num" title={`Assemble ${formatMs(s.assembleMs) || "0:00"} · Disassemble ${formatMs(s.disassembleMs) || "0:00"}`}>
                            {formatMs(s.mode === "disassemble" ? s.disassembleMs : s.assembleMs) || "—"}
                          </td>
                          <td className="ins-num">{s.partsLeft ?? 0}</td>
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
                Changing "Starts with" or "Platform" for a student sends them back to that start. Click a row to see their mistakes.
              </p>
            </>
          )}
        </section>

        {pickedStudent && (
          <section className="ins-panel">
            <h2>{pickedStudent.name}: mistake log</h2>
            <div className="ins-chips">
              <span>{summary.total} mistakes</span>
              <span>{summary.safety} safety</span>
              <span>{summary.reverts} reverts</span>
              <span>-{summary.pointsLost} pts</span>
            </div>
            {events.length === 0 ? (
              <p className="ins-muted">No mistakes recorded. Clean work so far.</p>
            ) : (
              <ul className="ins-log">
                {events.map((e) => (
                  <li key={e.id}>
                    <time>{new Date(e.ts).toLocaleTimeString()}</time>
                    <span className={`ins-badge ins-badge--${e.type === "safety" || e.type === "penalty" ? "danger" : "idle"}`}>{e.type}</span>
                    <b>{e.part}</b>
                    <span>{e.detail}</span>
                    {e.points ? <em>{e.points}</em> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------- main page: create a class, list your classes ---------- */

export default function Instructor() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const now = useNow();

  const [openCode, setOpenCode] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("10");

  const instructorName =
    [profile?.facultyTitle, profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user?.email || "Instructor";

  async function reload() {
    if (!user?.uid) return;
    setLoading(true);
    try {
      setList(await listMySessions(user.uid));
    } catch (err) {
      console.error(err);
      setError(`Couldn't load your classes (${err.code || err.message}). Check the Firestore rules.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function create(e) {
    e.preventDefault();
    setError("");
    const parMin = parseMinutes(minutes);
    if (!parMin) return setError(`Type the target time in minutes (1 to ${MAX_MINUTES}).`);

    setCreating(true);
    try {
      const code = await createSession({
        instructor: { uid: user.uid, name: instructorName },
        title,
        parMin,
      });
      setTitle("");
      setOpenCode(code);
    } catch (err) {
      console.error(err);
      setError(err.code ? `Couldn't create the class (${err.code}).` : err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  if (openCode) {
    return (
      <Monitor
        code={openCode}
        onBack={() => {
          setOpenCode(null);
          reload();
        }}
      />
    );
  }

  return (
    <div className="instructor">
      <header className="instructor__bar">
        <div className="instructor__title">
          <span className="instructor__badge">ARBuild</span>
          <h1>Instructor</h1>
        </div>
        <div className="ins-row">
          <Link to="/main" className="flow-btn flow-btn--tool">Rig Studio</Link>
          <Link to="/profile" className="flow-btn flow-btn--tool">Profile</Link>
          <button className="flow-btn" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="instructor__main">
        {error && <div className="ins-alert" role="alert">{error}</div>}

        <form className="ins-panel" onSubmit={create}>
          <h2>Create a class</h2>
          <p className="ins-muted">
            Students join with the code. Then you choose what each student starts with, on AM4 or AM5, and press Start.
          </p>

          <div className="ins-grid">
            <label className="ins-field ins-field--wide">
              <span>Class name</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BSIT 3A · PC assembly" maxLength={60} required />
            </label>

            <div className="ins-field">
              <span>Target time per phase</span>
              <MinutesInput value={minutes} onChange={setMinutes} label="Target minutes per phase" />
              <small className="ins-muted">
                {parseMinutes(minutes)
                  ? `Full points within ${formatMinutes(parseMinutes(minutes))}, fewer the longer it takes.`
                  : "Type the minutes"}
              </small>
            </div>
          </div>

          <button type="submit" className="flow-btn flow-btn--accent" disabled={creating}>
            {creating ? "Creating…" : "Create class and get code"}
          </button>
        </form>

        <section className="ins-panel">
          <div className="ins-head">
            <h2>Your classes</h2>
            <button className="flow-btn flow-btn--tool" onClick={reload} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
          </div>

          {list.length === 0 ? (
            <p className="ins-muted">{loading ? "Loading…" : "No classes yet. Create one above."}</p>
          ) : (
            <ul className="ins-sessions">
              {list.map((s) => {
                const phase = sessionPhase(s, now);
                const ran = Math.max(0, now - (s.startedAt?.toMillis?.() ?? now));
                return (
                  <li key={s.id}>
                    <div>
                      <strong>{s.title}</strong>
                      <small>
                        {s.createdAt?.toDate?.().toLocaleString() || ""} · target {formatMinutes(normalizeSetup(s.setup).parMin)} per phase
                      </small>
                    </div>
                    <code className="ins-code-sm">{s.code}</code>
                    <span className={`ins-badge ins-badge--${phase === "ended" ? "idle" : "live"}`}>
                      {phase === "waiting" ? "Waiting" : phase === "running" ? `Running ${formatClock(ran)}` : "Ended"}
                    </span>
                    <button className="flow-btn" onClick={() => setOpenCode(s.code)}>
                      {phase === "ended" ? "View results" : "Open"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}