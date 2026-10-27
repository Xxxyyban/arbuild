// Instructor pages.
//   /instructor                         your classes: make one (it gets a join code), open one
//   /instructor/c/:classId?tab=...      one class: stream, materials, lab activities, progress, students, settings
//   /instructor/c/:classId/lab/:code    a lab activity, live (LabMonitor)
//   /instructor/lab/:code               an older lab session made before classes existed
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createClass,
  subscribeMyClasses,
  subscribeClass,
  subscribeMembers,
  subscribeClassLabs,
  updateClass,
  newClassCode,
  removeMember,
  createPost,
  inviteLink,
  attachLab,
  personName,
  syncInstructorName,
  when,
  toMs,
} from "../lab/Classes";
import { createSession, listMySessions, sessionPhase, formatClock } from "../lab/Sessions";
import { instructorCard, syncInstructorCard, ensureThumb } from "../lab/People";
import { sessionTasks, taskSummary } from "../lab/Tasks";
import LabMonitor, { useNow } from "../components/instructor/LabMonitor";
import LabActivityForm from "../components/class/LabActivityForm";
import Stream from "../components/class/Stream";
import Progress from "../components/class/Progress";
import { TeachingClassCard } from "../components/class/ClassCards";
import ClassForm from "../components/class/ClassForm";
import { ClassMeta, CopyButton, Tabs } from "../components/class/ClassBits";
import PersonCard from "../components/class/PersonCard";
import Avatar from "../components/class/Avatar";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import { nextMeeting, formatRange, dayId, dayTime, CLASS_COLORS } from "../lab/Schedule";
import "../styles/BuildLab.css";
import "../styles/Instructor.css";
import "../styles/InstructorClass.css";
import "../styles/Classes.css";

function useMe() {
  const { user, profile } = useAuth();
  return useMemo(() => ({ uid: user?.uid, name: personName(profile, user, "Instructor") }), [user, profile]);
}

/**
 * Asks an instructor whose profile has no name for it (accounts set up before setup saved names): it's
 * what students see on their classes and posts. Saved, it goes onto their classes too.
 */
function NamePrompt() {
  const { updateUserProfile } = useAuth();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) return setError("Enter your first and last name.");
    setBusy(true);
    setError("");
    try {
      await updateUserProfile({ firstName: first.trim(), lastName: last.trim() });
    } catch (err) {
      setError(err.code === "permission-denied" ? "Couldn't save your name: the Firestore rules didn't allow it." : err.message);
      setBusy(false);
    }
  }

  return (
    <section className="ins-panel name-ask">
      <div className="panel-head">
        <h2 className="panel-title">
          <Icon name="user" />
          Add your name
        </h2>
        <p className="ins-muted ins-small">Your students see it on your classes and posts. Your profile doesn't have it yet.</p>
      </div>
      <form className="name-ask__form" onSubmit={save}>
        <label className="cform__field">
          <span>First name</span>
          <input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={40} required />
        </label>
        <label className="cform__field">
          <span>Last name</span>
          <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={40} required />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {error && (
        <div className="ins-alert" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

/* ====================================================================== */
/*  /instructor: your classes                                              */
/* ====================================================================== */

function Dashboard() {
  const { user, profile } = useAuth();
  const me = useMe();
  const navigate = useNavigate();
  const [classes, setClasses] = useState(null);
  const [legacy, setLegacy] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [making, setMaking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const now = useNow(30000);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyClasses(user.uid, setClasses, (err) => {
      setClasses([]); // stop "Loading…"; the error explains why
      setError(
        err.code === "permission-denied"
          ? "Couldn't load your classes: the Firestore rules don't allow classes yet. Publish firestore.rules in the Firebase console (Firestore Database > Rules)."
          : `Couldn't load your classes (${err.code || err.message}).`
      );
    });
  }, [user?.uid]);

  // lab sessions made before classes existed (still openable for their results)
  useEffect(() => {
    if (!user?.uid) return;
    listMySessions(user.uid)
      .then((list) => setLegacy(list.filter((s) => !s.classId)))
      .catch(() => {});
  }, [user?.uid]);

  async function create(values) {
    setError("");
    setCreating(true);
    try {
      const id = await createClass({ instructor: me, ...values });
      navigate(`/instructor/c/${id}`);
    } catch (err) {
      console.error(err);
      setError(err.code ? `Couldn't create the class (${err.code}). Check the Firestore rules.` : err.message);
    } finally {
      setCreating(false);
    }
  }

  const active = (classes || []).filter((c) => !c.archived);
  const archived = (classes || []).filter((c) => c.archived);
  // today's classes, at today's time (each day can have its own)
  const todayId = dayId(new Date(now));
  const today = active
    .map((c) => ({ c, next: nextMeeting(c.schedule, new Date(now)), time: dayTime(c.schedule, todayId) }))
    .filter(({ next }) => next && (next.now || next.label.startsWith("Today")))
    .sort((x, y) => x.time.start.localeCompare(y.time.start));
  const showForm = making || (classes !== null && active.length === 0);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const hello = profile?.firstName || profile?.lastName ? `${greeting}, ${me.name}` : greeting; // no name yet: NamePrompt asks
  const summary = active.length
    ? `${hello}. You teach ${active.length} ${active.length === 1 ? "class" : "classes"}${today.length ? `, ${today.length} today` : ""}.`
    : `${hello}. Make a class, give your students its code, and teach from here.`;

  return (
    <AppShell
      className="app-page--content"
      eyebrow="Teaching"
      title="Your classes"
      subtitle={summary}
      tools={
        !showForm && (
          <button type="button" className="btn btn--primary" onClick={() => setMaking(true)}>
            <Icon name="plus" size={16} />
            <span>New class</span>
          </button>
        )
      }
    >
      {error && <div className="ins-alert" role="alert">{error}</div>}

      {profile && !profile.firstName && !profile.lastName && <NamePrompt />}

      {today.length > 0 && (
        <section className="ins-panel today">
          <h2 className="panel-title">
            <Icon name="calendar" />
            Today
          </h2>
          <ul className="today__list">
            {today.map(({ c, next, time }) => (
              <li key={c.id}>
                <button type="button" style={{ "--class-color": c.color || CLASS_COLORS[0] }} onClick={() => navigate(`/instructor/c/${c.id}`)}>
                  <span className="today__time">{formatRange(time.start, time.end)}</span>
                  <span className="today__name">{c.name}</span>
                  <span className="today__meta">{[c.section, c.schedule.room].filter(Boolean).join(" · ")}</span>
                  {next.now && <span className="chip chip--live">In class now</span>}
                  <Icon name="forward" size={16} className="today__go" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <section className="ins-panel">
          <div className="panel-head">
            <h2 className="panel-title">New class</h2>
            <p className="ins-muted ins-small">It gets a join code: students enter it once and stay in the class.</p>
          </div>
          <ClassForm submitLabel="Create class" busy={creating} onSubmit={create} onCancel={active.length ? () => setMaking(false) : null} />
        </section>
      )}

      {classes === null ? (
        <div className="cgrid">
          {[0, 1, 2].map((i) => <div key={i} className="ccard ccard--skeleton" aria-hidden="true" />)}
        </div>
      ) : (
        active.length > 0 && (
          <section className="page-section" aria-label="Your classes">
            <h2 className="section-label">Classes</h2>
            <div className="cgrid">
              {active.map((c) => (
                <TeachingClassCard key={c.id} cls={c} now={now} onOpen={() => navigate(`/instructor/c/${c.id}`)} />
              ))}
            </div>
          </section>
        )
      )}

      {archived.length > 0 && (
        <section className="page-section">
          <button type="button" className="section-toggle" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Icon name="archive" size={16} />
            Archived classes ({archived.length})
            <Icon name={showArchived ? "up" : "down"} size={16} />
          </button>
          {showArchived && (
            <div className="cgrid">
              {archived.map((c) => (
                <TeachingClassCard key={c.id} cls={c} now={now} onOpen={() => navigate(`/instructor/c/${c.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}

      {legacy.length > 0 && (
        <section className="ins-panel">
          <h2 className="panel-title">Older lab sessions</h2>
          <p className="ins-muted ins-small">
            Made before classes existed. Open one to see its results, or add it to a class so it shows in that class's stream
            and progress.
          </p>
          <ul className="ins-sessions">
            {legacy.map((s) => {
              const phase = sessionPhase(s, now);
              return (
                <li key={s.id}>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.createdAt?.toDate?.().toLocaleString() || ""}</small>
                  </div>
                  <code className="ins-code-sm">{s.code}</code>
                  <span className={`ins-badge ins-badge--${phase === "ended" ? "idle" : "live"}`}>
                    {phase === "ended" ? "Ended" : phase === "running" ? "Running" : "Waiting"}
                  </span>
                  {active.length > 0 && (
                    <select
                      className="ins-select"
                      value=""
                      aria-label={`Add ${s.title} to a class`}
                      onChange={async (e) => {
                        const cls = active.find((c) => c.id === e.target.value);
                        if (!cls) return;
                        try {
                          await attachLab(s, cls, me);
                          setLegacy((l) => l.filter((x) => x.code !== s.code));
                        } catch (err) {
                          setError(`Couldn't add it to ${cls.name} (${err.code || err.message}).`);
                        }
                      }}
                    >
                      <option value="">Add to class…</option>
                      {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <button className="btn" onClick={() => navigate(`/instructor/lab/${s.code}`)}>Open</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}

/* ====================================================================== */
/*  /instructor/c/:classId: one class                                      */
/* ====================================================================== */

const TABS = [
  { id: "stream", label: "Stream", icon: "megaphone" },
  { id: "materials", label: "Materials", icon: "book" },
  { id: "labs", label: "Lab activities", icon: "wrench" },
  { id: "progress", label: "Progress", icon: "chart" },
  { id: "students", label: "Students", icon: "users" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const BACK = { to: "/instructor", label: "All classes" };

function ClassPage() {
  const { classId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const me = useMe();
  const author = { uid: me.uid, name: me.name, photo: profile?.photoThumb || "" }; // on their posts, as students see them
  const now = useNow(30000);
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "stream";
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  const [cls, setCls] = useState(undefined);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const fail = (err) => setError(err.code || err.message);

  useEffect(() => subscribeClass(classId, setCls, fail), [classId]);
  useEffect(() => subscribeMembers(classId, setMembers, fail), [classId]);

  if (cls === undefined) {
    return (
      <AppShell className="app-page--content" back={BACK} title="Loading class…">
        <div className="ins-panel ccard--skeleton" aria-hidden="true" />
      </AppShell>
    );
  }
  if (cls === null || cls.instructorUid !== me.uid) {
    return (
      <AppShell className="app-page--content" back={BACK} title="Class not found">
        <div className="ins-alert">This class doesn't exist or isn't yours.</div>
      </AppShell>
    );
  }

  const openLab = (code) => navigate(`/instructor/c/${classId}/lab/${code}`);
  const tabs = TABS.map((t) => ({ ...t, badge: t.id === "students" ? <span className="cls-count">{cls.studentCount || 0}</span> : null }));

  return (
    <AppShell
      className="app-page--content"
      back={BACK}
      eyebrow={cls.section || "Class"}
      title={cls.name}
      subtitle={cls.archived ? "Archived: students can still read it, but nobody new can join." : null}
    >
      <ClassMeta cls={cls}>
        <span className="class-meta__item">
          <Icon name="users" size={16} />
          {cls.studentCount || 0} {cls.studentCount === 1 ? "student" : "students"}
        </span>
        <span className="join-code">
          <span className="join-code__label">Join code</span>
          <code>{cls.code}</code>
          <CopyButton text={cls.code} label="Copy join code" iconOnly className="btn btn--ghost" />
          <CopyButton text={inviteLink(cls.code)} label="Invite link" className="btn btn--soft btn--sm" />
        </span>
      </ClassMeta>

      <Tabs tabs={tabs} current={tab} onChange={(t) => setTab(t)} />

      {error && <div className="ins-alert" role="alert">{error}</div>}

      {tab === "stream" && <Stream classId={classId} me={me} author={author} isInstructor onOpenLab={openLab} now={now} />}
      {tab === "materials" && <Stream classId={classId} me={me} author={author} isInstructor filter="material" onOpenLab={openLab} now={now} />}
      {tab === "labs" && <LabsTab cls={cls} me={me} onOpenLab={openLab} now={now} />}
      {tab === "progress" && <Progress cls={cls} members={members} onOpenLab={openLab} />}
      {tab === "students" && <StudentsTab cls={cls} members={members} now={now} />}
      {tab === "settings" && <SettingsTab cls={cls} me={me} />}
    </AppShell>
  );
}

/* ---------- lab activities ---------- */

function LabsTab({ cls, me, onOpenLab, now }) {
  const [labs, setLabs] = useState(null);
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeClassLabs(cls.id, cls.instructorUid, setLabs, (err) => setError(err.code || err.message)), [cls.id, cls.instructorUid]);

  async function create({ title, task }) {
    setBusy(true);
    setError("");
    try {
      const code = await createSession({ instructor: me, title, classId: cls.id, className: cls.name, task, parMin: task.parMin });
      await createPost(cls.id, { kind: "lab", title, body: task.instructions, sessionCode: code, author: me });
      setMaking(false);
      onOpenLab(code);
    } catch (err) {
      console.error(err);
      setError(`Couldn't create the lab (${err.code || err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {making ? (
        <LabActivityForm busy={busy} onCreate={create} onCancel={() => setMaking(false)} />
      ) : (
        <button type="button" className="cls-compose-open" onClick={() => setMaking(true)}>
          <Icon name="plus" />
          New lab activity: build, take apart or fix a PC in the Build Lab
        </button>
      )}
      {error && <div className="ins-alert" role="alert">{error}</div>}

      <section className="ins-panel">
        <h2 className="panel-title">Lab activities</h2>
        {labs === null ? (
          <p className="ins-muted">Loading…</p>
        ) : labs.length === 0 ? (
          <p className="ins-muted">None yet. A lab activity is a timed, scored Build Lab task your students open from this class.</p>
        ) : (
          <ul className="ins-sessions">
            {labs.map((s) => {
              const phase = sessionPhase(s, now);
              const ran = Math.max(0, now - (s.startedAt?.toMillis?.() ?? now));
              const { tasks } = sessionTasks(s);
              return (
                <li key={s.id}>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{taskSummary(tasks[0])}{tasks.length > 1 ? ` · +${tasks.length - 1} more tasks` : ""}</small>
                  </div>
                  <span className={`ins-badge ins-badge--${phase === "ended" ? "idle" : phase === "running" ? "live" : "done"}`}>
                    {phase === "waiting" ? "Waiting to start" : phase === "running" ? `Running ${formatClock(ran)}` : "Closed"}
                  </span>
                  <button className="btn btn--primary" onClick={() => onOpenLab(s.code)}>
                    {phase === "ended" ? "Results" : "Open monitor"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/* ---------- students ---------- */

function StudentsTab({ cls, members, now }) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // the student whose card is showing
  const shown = members.find((m) => m.id === open);
  const sorted = [...members]
    .filter((m) => !filter || `${m.name} ${m.studentId} ${m.section} ${m.email}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  function exportCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["Name", "Student ID", "Section", "Email", "Joined"], ...members.map((m) => [m.name, m.studentId, m.section, m.email, new Date(toMs(m.joinedAt)).toLocaleString()])]
      .map((r) => r.map(esc).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls.name.replace(/\W+/g, "_")}-students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ins-panel">
      <div className="ins-head">
        <h2 className="panel-title">Students ({members.length})</h2>
        <div className="ins-row">
          <label className="search-field">
            <Icon name="search" size={16} />
            <input className="cls-input cls-input--sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name, ID, section…" aria-label="Search students" />
          </label>
          <button className="btn" disabled={!members.length} onClick={exportCsv}>
            <Icon name="download" size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="cls-empty">
          <strong>Nobody has joined yet</strong>
          <span>
            Give your students the code <code className="ins-code-sm">{cls.code}</code> or the invite link. They enter the code once,
            in <b>Classes</b>; the link joins them straight away after they sign in.
          </span>
        </div>
      ) : (
        <div className="ins-table-wrap">
          <table className="ins-table">
            <thead>
              <tr><th>Student</th><th>Section</th><th>Joined</th><th /></tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <button type="button" className="person-link" aria-haspopup="dialog" onClick={() => setOpen(m.id)}>
                        <Avatar name={m.name} photo={m.photo} size={32} />
                        <span>
                          <strong>{m.name}</strong>
                          <small>{[m.studentId, m.email].filter(Boolean).join(" · ")}</small>
                        </span>
                      </button>
                    </td>
                    <td>{m.section || "—"}</td>
                    <td>{when(m.joinedAt, now)}</td>
                    <td className="cls-actions">
                      <button
                        className="btn btn--ghost btn--sm"
                        disabled={busy}
                        onClick={async () => {
                          if (!window.confirm(`Remove ${m.name} from ${cls.name}? Their lab results are kept.`)) return;
                          setBusy(true);
                          try {
                            await removeMember(cls.id, m.id);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shown && (
        <PersonCard
          name={shown.name}
          photo={shown.photo}
          kind="Student"
          sub={[shown.section, cls.name].filter(Boolean).join(" · ")}
          details={[
            { icon: "idCard", label: "Student ID", value: shown.studentId },
            { icon: "users", label: "Section", value: shown.section },
            { icon: "mail", label: "Email", value: shown.email, href: shown.email && `mailto:${shown.email}` },
            { icon: "phone", label: "Contact number", value: shown.contactNumber, href: shown.contactNumber && `tel:${shown.contactNumber.replace(/[^\d+]/g, "")}` },
            { icon: "calendar", label: "Joined", value: shown.joinedAt && new Date(toMs(shown.joinedAt)).toLocaleDateString() },
          ]}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

/* ---------- settings ---------- */

function SettingsTab({ cls, me }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function run(fn, done) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await fn();
      if (done) setMsg(done);
    } catch (err) {
      setError(err.code || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="ins-panel">
        <h2 className="panel-title">Class details</h2>
        <ClassForm
          initial={cls}
          submitLabel="Save changes"
          busy={busy}
          onSubmit={(values) => run(() => updateClass(cls.id, values), "Saved.")}
        />
      </section>

      <section className="ins-panel">
        <h2 className="panel-title">Joining</h2>
        <div className="cls-row cls-row--wrap">
          <span className="join-code">
            <span className="join-code__label">Join code</span>
            <code>{cls.code}</code>
          </span>
          <CopyButton text={cls.code} label="Copy code" />
          <CopyButton text={inviteLink(cls.code)} label="Copy invite link" />
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              window.confirm("Make a new code? The old one stops working; students already in the class stay in.") &&
              run(() => newClassCode(cls.id, cls.code, me.uid), "New code made.")
            }
          >
            <Icon name="refresh" size={16} />
            New code
          </button>
        </div>
        <label className="ins-check">
          <input type="checkbox" checked={cls.joinOpen !== false} disabled={busy} onChange={(e) => run(() => updateClass(cls.id, { joinOpen: e.target.checked }))} />
          <span>Let new students join with the code (turn off once everyone is in)</span>
        </label>
      </section>

      <section className="ins-panel">
        <h2 className="panel-title">Archive</h2>
        <p className="ins-muted ins-small">
          An archived class moves off your main list. Students can still read it; nobody new can join. You can bring it back any time.
        </p>
        <div>
          <button className="btn" disabled={busy} onClick={() => run(() => updateClass(cls.id, { archived: !cls.archived }), cls.archived ? "Restored." : "Archived.")}>
            <Icon name="archive" size={16} />
            {cls.archived ? "Restore class" : "Archive class"}
          </button>
        </div>
      </section>

      {msg && <div className="cls-banner" role="status">{msg}</div>}
      {error && <div className="ins-alert" role="alert">{error}</div>}
    </>
  );
}

/* ====================================================================== */
/*  lab monitor routes                                                     */
/* ====================================================================== */

function ClassLab() {
  const { classId, code } = useParams();
  return <LabMonitor code={code} back={{ to: `/instructor/c/${classId}?tab=labs`, label: "Back to class" }} />;
}

function OldLab() {
  const { code } = useParams();
  return <LabMonitor code={code} back={{ to: "/instructor", label: "Your classes" }} />;
}

/** Which instructor page the URL asks for (see the routes in App.jsx). */
/**
 * What students see of the instructor, kept the same as their profile: their whole name on each of
 * their classes, and their card (lab/People.js). Tried again on the next visit if it fails.
 */
function useMyCard() {
  const { user, profile, updateUserProfile } = useAuth();
  const card = instructorCard(profile, user);
  const key = JSON.stringify(card);
  useEffect(() => {
    if (!user?.uid) return;
    ensureThumb(profile, updateUserProfile)
      .then((saved) => {
        if (saved || !card) return; // a new thumbnail: this runs again with it
        syncInstructorName(user.uid, card.name).catch(() => {});
        syncInstructorCard(card).catch(() => {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, key]);
}

export default function Instructor({ page = "dashboard" }) {
  useMyCard();
  if (page === "class") return <ClassPage />;
  if (page === "classLab") return <ClassLab />;
  if (page === "oldLab") return <OldLab />;
  return <Dashboard />;
}
