// The Classes section of the profile page. Students: join a class and see the classes they're in.
// Instructors: the classes they teach. Styles: styles/Classes.css (.profile-classes, .cls-*).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { joinByCode, subscribeMyMemberships, subscribeMyClasses, toMs } from "../../lab/Classes";
import { normalizeCode, isValidCode, CODE_LENGTH } from "../../lab/Setup";
import { StudentClassCard, TeachingClassCard } from "./ClassCards";
import ClassFeed from "./ClassFeed";
import Avatar from "./Avatar";
import Icon from "../Icon";
import "../../styles/Classes.css";

/** Lab activities still to do, each from its instructor. items: ClassFeed's todo. */
export function TodoList({ items }) {
  const navigate = useNavigate();
  return (
    <ul className="profile-todo">
      {items.map((i) => (
        <li key={i.key}>
          <button type="button" onClick={() => navigate(i.to)}>
            {/* from their instructor: their picture, with the task's wrench on it */}
            <Avatar name={i.who?.name} photo={i.who?.photo} size={38} badge="wrench" />
            <span>
              {i.title}
              <small>{[i.who && `From ${i.who.name}`, i.className, i.detail].filter(Boolean).join(" · ")}</small>
            </span>
            <Icon name="forward" size={16} className="profile-todo__go" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ProfileClasses({ user, profile }) {
  return profile?.role === "faculty" ? <Teaching user={user} /> : <Enrolled user={user} profile={profile} />;
}

/* ---------- students ---------- */

function Enrolled({ user, profile }) {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyMemberships(user.uid, setList, (err) => {
      setList([]);
      setError(`Couldn't load your classes (${err.code || err.message}).`);
    });
  }, [user?.uid]);

  async function join(e) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (!isValidCode(clean)) return setError(`Enter the ${CODE_LENGTH}-character code from your instructor.`);
    setBusy(true);
    setError("");
    try {
      const res = await joinByCode(clean, user, profile);
      if (res.error) return setError(res.error);
      navigate(res.to);
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...(list || [])].sort((a, b) => toMs(b.joinedAt) - toMs(a.joinedAt));

  return (
    <div className="profile-classes">
      <form className="profile-classes__join" onSubmit={join}>
        <label htmlFor="profile-class-code">
          <Icon name="key" size={15} />
          Join a class
        </label>
        <div className="cls-row">
          <input
            id="profile-class-code"
            className="cls-input cls-code-input"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, CODE_LENGTH))}
            placeholder="CLASS CODE"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Joining…" : "Join"}</button>
        </div>
        <small className="field-hint">Type the code your instructor gave you, or open their invite link. You only need it once.</small>
        {error && <div className="error-message" role="alert">{error}</div>}
      </form>

      <ClassFeed user={user} profile={profile}>
        {(feed) =>
          feed.todo.length > 0 && (
            <section>
              <div className="profile-classes__head">
                <h4>
                  To do
                  <span className="section-count">{feed.todo.length}</span>
                </h4>
              </div>
              <TodoList items={feed.todo} />
            </section>
          )
        }
      </ClassFeed>

      <div className="profile-classes__head">
        <h4>
          Your classes
          {sorted.length > 0 && <span className="section-count">{sorted.length}</span>}
        </h4>
        {sorted.length > 0 && (
          <Link to="/classes" className="text-link">
            Open Classes
            <Icon name="forward" size={14} />
          </Link>
        )}
      </div>
      {list === null ? (
        <p className="field-hint">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="cls-empty">
          <strong>You're not in a class yet</strong>
          <span>Join one with the code above. Its announcements, materials and lab activities will be here.</span>
        </div>
      ) : (
        <div className="cgrid">
          {sorted.map((m) => (
            <StudentClassCard key={m.id} entry={m} uid={user.uid} onOpen={() => navigate(`/classes/${m.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- instructors ---------- */

function Teaching({ user }) {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const now = Date.now();

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeMyClasses(user.uid, setList, (err) => {
      setList([]);
      setError(`Couldn't load your classes (${err.code || err.message}).`);
    });
  }, [user?.uid]);

  const active = (list || []).filter((c) => !c.archived);
  const archived = (list || []).length - active.length;

  return (
    <div className="profile-classes">
      <div className="profile-classes__head">
        <h4>
          Classes you teach
          {active.length > 0 && <span className="section-count">{active.length}</span>}
        </h4>
        <Link to="/instructor" className="text-link">
          Manage classes
          <Icon name="forward" size={14} />
        </Link>
      </div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {list === null ? (
        <p className="field-hint">Loading…</p>
      ) : active.length === 0 ? (
        <div className="cls-empty">
          <strong>No classes yet</strong>
          <span>
            Create one on the <Link to="/instructor">instructor page</Link>. Each class gets a code your students use to join.
          </span>
        </div>
      ) : (
        <div className="cgrid">
          {active.map((c) => (
            <TeachingClassCard key={c.id} cls={c} now={now} onOpen={() => navigate(`/instructor/c/${c.id}`)} />
          ))}
        </div>
      )}
      {archived > 0 && <small className="field-hint">{archived} archived {archived === 1 ? "class" : "classes"} on the instructor page.</small>}
    </div>
  );
}
