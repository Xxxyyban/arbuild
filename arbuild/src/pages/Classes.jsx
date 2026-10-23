// Student pages.
//   /classes                       my classes: join one with the instructor's code, open one
//   /classes/:classId?tab=...      one class: stream, materials, lab activities, messages with the instructor
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import {
  joinByCode,
  leaveClass,
  subscribeMyMemberships,
  subscribeClass,
  subscribeMember,
  subscribeThread,
  markStreamSeen,
  threadUnread,
  personName,
  toMs,
} from "../lab/Classes";
import { normalizeCode, isValidCode, CODE_LENGTH } from "../lab/Setup";
import { useNow } from "../components/instructor/LabMonitor";
import Stream from "../components/class/Stream";
import Chat from "../components/class/Chat";
import { StudentClassCard } from "../components/class/ClassCards";
import { ClassMeta, Tabs } from "../components/class/ClassBits";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import "../styles/BuildLab.css";
import "../styles/Instructor.css";
import "../styles/Classes.css";

function useMe() {
  const { user, profile } = useAuth();
  return useMemo(() => ({ uid: user?.uid, name: personName(profile, user) }), [user, profile]);
}

/* ====================================================================== */
/*  /classes                                                               */
/* ====================================================================== */

function MyClasses() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [list, setList] = useState(null);
  const [code, setCode] = useState(normalizeCode(params.get("join") || "").slice(0, CODE_LENGTH));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyMemberships(user.uid, setList, (err) => setError(`Couldn't load your classes (${err.code || err.message}).`));
  }, [user?.uid]);

  // A class code joins the class. A lab code (what an older lab, or a lab activity, shows) opens
  // that lab instead, joining its class on the way when it has one.
  async function join(e, typed = code) {
    e?.preventDefault();
    const clean = normalizeCode(typed);
    if (!isValidCode(clean)) return setError(`Enter the ${CODE_LENGTH}-character code from your instructor.`);
    setBusy(true);
    setError("");
    try {
      const res = await joinByCode(clean, user, profile);
      if (res.error) return setError(res.error);
      setCode("");
      navigate(res.to);
    } finally {
      setBusy(false);
    }
  }

  // an invite link (/classes?join=CODE) joins straight away
  const invite = normalizeCode(params.get("join") || "");
  useEffect(() => {
    try {
      sessionStorage.removeItem("arbuild.pendingJoin"); // App.jsx kept it through sign-in
    } catch {
      /* storage blocked */
    }
    if (user?.uid && isValidCode(invite)) join(null, invite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, invite]);

  const sorted = [...(list || [])].sort((a, b) => toMs(b.joinedAt) - toMs(a.joinedAt));

  return (
    <AppShell
      className="app-page--content"
      eyebrow="Classes"
      title="My classes"
      subtitle="Announcements, learning materials, lab activities and messages from your instructors."
    >
      <form className="ins-panel cls-join" onSubmit={join}>
        <div>
          <h2 className="panel-title">
            <Icon name="key" />
            Join a class
          </h2>
          <p className="ins-muted ins-small">
            Type the class code your instructor gave you (or open their invite link). You only need it once.
          </p>
        </div>
        <div className="cls-row">
          <input
            className="cls-input cls-code-input"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH))}
            placeholder="CLASS CODE"
            aria-label="Class code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Joining…" : "Join class"}</button>
        </div>
        {error && <div className="ins-alert" role="alert">{error}</div>}
      </form>

      {list === null ? (
        <p className="ins-muted">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="cls-empty cls-empty--big">
          <strong>You're not in a class yet</strong>
          <span>Enter the code from your instructor above. Then your announcements, materials, lab activities and messages are all here.</span>
        </div>
      ) : (
        <section className="page-section" aria-label="Your classes">
          <h2 className="section-label">Your classes ({sorted.length})</h2>
          <div className="cgrid">
            {sorted.map((m) => (
              <StudentClassCard key={m.id} entry={m} uid={user.uid} onOpen={() => navigate(`/classes/${m.id}`)} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

/* ====================================================================== */
/*  /classes/:classId                                                      */
/* ====================================================================== */

const TABS = [
  { id: "stream", label: "Stream", icon: "megaphone" },
  { id: "materials", label: "Materials", icon: "book" },
  { id: "labs", label: "Lab activities", icon: "wrench" },
  { id: "messages", label: "Message instructor", icon: "chat" },
];

const BACK = { to: "/classes", label: "My classes" };

function ClassPage() {
  const { classId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const now = useNow(30000);
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "stream";

  const [cls, setCls] = useState(undefined);
  const [member, setMember] = useState(undefined);
  const [thread, setThread] = useState(null);

  useEffect(() => subscribeClass(classId, setCls, () => setCls(null)), [classId]);
  useEffect(() => subscribeMember(classId, me.uid, setMember, () => setMember(null)), [classId, me.uid]);
  useEffect(() => subscribeThread(classId, me.uid, setThread, () => {}), [classId, me.uid]);

  // looking at the stream clears its "new" badge
  const lastPost = toMs(cls?.lastPostAt);
  useEffect(() => {
    if (member && (tab === "stream" || tab === "materials" || tab === "labs") && lastPost > toMs(member.seenStreamAt)) {
      markStreamSeen(classId, me.uid);
    }
  }, [classId, me.uid, member, tab, lastPost]);

  if (cls === undefined || member === undefined) {
    return (
      <AppShell className="app-page--content" back={BACK} title="Loading class…">
        <div className="ins-panel ccard--skeleton" aria-hidden="true" />
      </AppShell>
    );
  }

  if (!cls || !member) {
    return (
      <AppShell className="app-page--content" back={BACK} title={cls ? cls.name : "Class not found"}>
        <div className="cls-empty cls-empty--big">
          <strong>{cls ? `You're not in ${cls.name}` : "This class doesn't exist anymore"}</strong>
          <span>{cls ? "Your instructor may have removed you. Ask them, or join again with the class code." : "Your instructor may have deleted it."}</span>
        </div>
        <div className="cls-row">
          <button
            className="btn"
            onClick={async () => {
              await deleteDoc(doc(db, "userClasses", me.uid, "classes", classId)).catch(() => {});
              navigate("/classes");
            }}
          >
            <Icon name="trash" size={16} />
            Remove from my list
          </button>
        </div>
      </AppShell>
    );
  }

  const unread = threadUnread(thread, me.uid);
  const openLab = (code) => navigate(`/lab?lab=${code}&class=${classId}`);

  const tabs = TABS.map((t) => ({ ...t, badge: t.id === "messages" && unread ? <span className="cls-dot">new</span> : null }));

  return (
    <AppShell className="app-page--content" back={BACK} eyebrow={cls.section || "Class"} title={cls.name}>
      <ClassMeta cls={cls}>
        {cls.instructorName && (
          <span className="class-meta__item">
            <Icon name="user" size={16} />
            {cls.instructorName}
          </span>
        )}
      </ClassMeta>

      <Tabs tabs={tabs} current={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />

      {tab === "stream" && <Stream classId={classId} me={me} onOpenLab={openLab} now={now} />}
      {tab === "materials" && <Stream classId={classId} me={me} filter="material" onOpenLab={openLab} now={now} />}
      {tab === "labs" && <Stream classId={classId} me={me} filter="lab" onOpenLab={openLab} now={now} />}
      {tab === "messages" && (
        <Chat classId={classId} studentUid={me.uid} studentName={me.name} me={me} otherName={cls.instructorName || "Instructor"} now={now} />
      )}

      <div className="cls-row cls-row--end">
        <button
          className="btn btn--ghost"
          onClick={async () => {
            if (!window.confirm(`Leave ${cls.name}? You can join again with the code.`)) return;
            await leaveClass(classId, me.uid);
            navigate("/classes");
          }}
        >
          <Icon name="logout" size={16} />
          Leave class
        </button>
      </div>
    </AppShell>
  );
}

export default function Classes({ page = "list" }) {
  return page === "class" ? <ClassPage /> : <MyClasses />;
}
