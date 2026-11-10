// The admin's announcements (admin portal): write one to everyone, to students or to instructors; it
// shows in their bell, and pops up for anyone with ARBuild open. The ones already posted are listed
// below, newest first, each with who it went to; removing one takes it out of everyone's bell.
// Data: lab/Announcements.js. Styles: styles/Admin.css (.admin-panel, .admin-field) and .ann-*.
import { useState } from "react";
import { AUDIENCES, announcedBy, deleteAnnouncement, postAnnouncement, useAnnouncements } from "../../lab/Announcements";

const LABEL = Object.fromEntries(AUDIENCES.map((a) => [a.id, a.label]));
const fullWhen = (t) => {
  const ms = t?.toMillis?.() ?? 0;
  return ms ? new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "just now";
};

/** by: { uid, name }: the admin, as their profile names them ("" with no name: it goes out as "ARBuild Admin", never their email). onError(message) shows a problem. */
export default function Announcements({ by, onError }) {
  const posted = useAnnouncements("admin", 50);
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  async function post(e) {
    e.preventDefault();
    if (!title.trim()) return onError("Give the announcement a title.");
    setBusy(true);
    setDone("");
    try {
      await postAnnouncement({ audience, title, body, by });
      setTitle("");
      setBody("");
      setDone(`Posted to ${LABEL[audience].toLowerCase()}. It's in their bell now.`);
    } catch (err) {
      onError(`Couldn't post the announcement (${err.code || err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (!window.confirm(`Remove "${a.title}"? It disappears from everyone's bell.`)) return;
    try {
      await deleteAnnouncement(a.audience, a.id);
    } catch (err) {
      onError(`Couldn't remove it (${err.code || err.message}).`);
    }
  }

  return (
    <>
      <section className="admin-panel">
        <form className="ann-form" onSubmit={post}>
          <div className="filter-chips" role="radiogroup" aria-label="Who it's for">
            {AUDIENCES.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={audience === a.id} className={audience === a.id ? "active" : ""} onClick={() => setAudience(a.id)}>
                {a.label}
              </button>
            ))}
          </div>
          <label className="admin-field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. The lab is closed on Friday" required />
          </label>
          <label className="admin-field">
            <span>Message (optional)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} placeholder="What everyone needs to know." />
          </label>
          <div className="ann-form__foot">
            <small>Shows in the bell of {audience === "all" ? "every student and instructor" : `every ${audience === "faculty" ? "instructor" : "student"}`}, for two weeks.</small>
            <button type="submit" className="admin-primary-btn" disabled={busy}>{busy ? "Posting…" : "Post announcement"}</button>
          </div>
          {done && <p className="ann-done" role="status">{done}</p>}
        </form>
      </section>

      <section className="admin-panel">
        <h3 className="ann-head">Posted ({posted.length})</h3>
        {posted.length === 0 ? (
          <p className="ann-empty">Nothing yet. What you post shows here, newest first.</p>
        ) : (
          <ul className="ann-list">
            {posted.map((a) => (
              <li key={`${a.audience}/${a.id}`}>
                <div>
                  <strong>{a.title}</strong>
                  {a.body && <p>{a.body}</p>}
                  <small>
                    To {LABEL[a.audience].toLowerCase()} · {fullWhen(a.createdAt)}
                    {` · ${announcedBy(a)}`}
                  </small>
                </div>
                <button type="button" className="ann-remove" onClick={() => remove(a)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
