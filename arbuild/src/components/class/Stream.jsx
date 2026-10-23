// A class's stream: announcements, learning materials and lab activities, newest first (pinned on
// top), each with its own questions-and-answers thread. The instructor posts; everyone can comment.
// Styles: styles/Classes.css (.cls-*) and styles/AppShell.css.
import { useEffect, useState } from "react";
import {
  createPost,
  deletePost,
  updatePost,
  subscribePosts,
  subscribeComments,
  addComment,
  deleteComment,
  when,
  fileSize,
  fixUrl,
  toMs,
} from "../../lab/Classes";
import { subscribeSession, subscribeStudentRow, sessionPhase, formatMs } from "../../lab/Sessions";
import { scoreText } from "../../lab/Scoring";
import { taskFor } from "../../lab/Tasks";
import Icon from "../Icon";

const KIND = {
  announcement: { label: "Announcement", icon: "megaphone" },
  material: { label: "Learning material", icon: "book" },
  lab: { label: "Lab activity", icon: "wrench" },
};

const URL_RE = /(https?:\/\/[^\s]+)/g;
const IS_URL = /^https?:\/\//;

/** Only web links open: a stored "javascript:" or "data:" link would run code, so it becomes "#". */
const safeHref = (u) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : "#");

/** Text with its links made clickable and its line breaks kept. */
export function RichText({ text }) {
  if (!text) return null;
  return (
    <p className="cls-text">
      {text.split(URL_RE).map((part, i) =>
        IS_URL.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

/**
 * classId, me ({ uid, name }), isInstructor
 * onOpenLab(code): instructor opens the lab monitor / student opens the lab
 * filter: null (everything) or a kind, e.g. "material"
 */
export default function Stream({ classId, me, isInstructor, onOpenLab, filter = null, now }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => subscribePosts(classId, setPosts, (err) => setError(err.code || err.message)), [classId]);

  const shown = (posts || [])
    .filter((p) => !filter || p.kind === filter)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || toMs(b.createdAt) - toMs(a.createdAt));

  return (
    <div className="cls-stream">
      {isInstructor && filter !== "lab" && <Composer classId={classId} me={me} defaultKind={filter || "announcement"} />}
      {error && <div className="ins-alert" role="alert">Couldn't load the stream ({error}).</div>}
      {posts === null ? (
        <p className="ins-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="cls-empty">
          <strong>{filter === "material" ? "No learning materials yet" : filter === "lab" ? "No lab activities yet" : "Nothing posted yet"}</strong>
          <span>
            {filter === "lab"
              ? "When your instructor makes a lab activity, open it here with one click."
              : isInstructor
              ? "Post an announcement or share a material above. Students see it straight away."
              : "Your instructor's announcements and materials will show up here."}
          </span>
        </div>
      ) : (
        shown.map((p) => (
          <PostCard key={p.id} classId={classId} post={p} me={me} isInstructor={isInstructor} onOpenLab={onOpenLab} now={now} />
        ))
      )}
    </div>
  );
}

/* ---------- writing a post (instructor) ---------- */

function Composer({ classId, me, defaultKind }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [links, setLinks] = useState([]);
  const [linkDraft, setLinkDraft] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setKind(defaultKind), [defaultKind]);

  function reset() {
    setTitle("");
    setBody("");
    setLinks([]);
    setLinkDraft("");
    setFiles([]);
    setError("");
    setOpen(false);
  }

  function addLink() {
    if (!linkDraft.trim()) return;
    setLinks((l) => [...l, { url: fixUrl(linkDraft), label: "" }]);
    setLinkDraft("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() && !title.trim() && links.length === 0 && files.length === 0) return setError("Write something first.");
    setBusy(true);
    setError("");
    try {
      const allLinks = linkDraft.trim() ? [...links, { url: fixUrl(linkDraft) }] : links;
      await createPost(classId, { kind, title, body, links: allLinks, files, author: me });
      reset();
    } catch (err) {
      console.error(err);
      setError(
        err.code === "storage/unauthorized"
          ? "The file couldn't be uploaded: Firebase Storage rules don't allow it yet (see storage.rules)."
          : err.message || err.code
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="cls-compose-open" onClick={() => setOpen(true)}>
        <Icon name="edit" />
        Announce something or share a learning material…
      </button>
    );
  }

  return (
    <form className="ins-panel cls-compose" onSubmit={submit}>
      <div className="cls-seg" role="radiogroup" aria-label="Kind of post">
        {["announcement", "material"].map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>
            <Icon name={KIND[k].icon} size={16} />
            {KIND[k].label}
          </button>
        ))}
      </div>
      <input
        className="cls-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === "material" ? "Title, e.g. Parts of a motherboard" : "Title (optional)"}
        maxLength={120}
      />
      <textarea
        className="cls-input cls-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === "material" ? "What should students read, watch or do?" : "Tell your class something…"}
        rows={4}
        maxLength={5000}
        autoFocus
      />

      {kind === "material" && (
        <div className="cls-attach">
          <div className="cls-row">
            <input
              className="cls-input"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              placeholder="Add a link (video, slides, article…)"
            />
            <button type="button" className="btn btn--soft" onClick={addLink}>
              <Icon name="link" size={16} />
              Add link
            </button>
            <label className="btn btn--soft cls-file-btn">
              <Icon name="clip" size={16} />
              Attach file
              <input
                type="file"
                multiple
                onChange={(e) => {
                  setFiles((f) => [...f, ...Array.from(e.target.files || [])]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {(links.length > 0 || files.length > 0) && (
            <ul className="cls-chips">
              {links.map((l, i) => (
                <li key={`l${i}`}>
                  <Icon name="link" size={14} />
                  {l.url}
                  <button type="button" aria-label="Remove link" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
              {files.map((f, i) => (
                <li key={`f${i}`}>
                  <Icon name="clip" size={14} />
                  {f.name} · {fileSize(f.size)}
                  <button type="button" aria-label="Remove file" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="ins-alert" role="alert">{error}</div>}
      <div className="cls-row cls-row--end">
        <button type="button" className="btn" onClick={reset} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? (files.length ? "Uploading…" : "Posting…") : "Post"}
        </button>
      </div>
    </form>
  );
}

/* ---------- one post ---------- */

function PostCard({ classId, post, me, isInstructor, onOpenLab, now }) {
  const [showComments, setShowComments] = useState(false);
  const k = KIND[post.kind] || KIND.announcement;
  const mine = post.authorUid === me.uid;

  return (
    <article className={`ins-panel cls-post cls-post--${post.kind} ${post.pinned ? "is-pinned" : ""}`}>
      <header className="cls-post__head">
        <span className="cls-post__icon" aria-hidden="true">
          <Icon name={k.icon} size={18} />
        </span>
        <div className="cls-post__meta">
          <span className="cls-post__kind">{k.label}{post.pinned ? " · Pinned" : ""}</span>
          <span className="ins-muted ins-small">
            {post.authorName} · {post.pending ? "posting…" : when(post.createdAt, now)}
          </span>
        </div>
        {isInstructor && mine && (
          <div className="cls-post__tools">
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-label={post.pinned ? "Unpin" : "Pin to the top"}
              title={post.pinned ? "Unpin" : "Pin to the top"}
              aria-pressed={!!post.pinned}
              onClick={() => updatePost(classId, post.id, { pinned: !post.pinned })}
            >
              <Icon name="pin" size={16} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              aria-label="Delete post"
              title="Delete post"
              onClick={() => window.confirm("Delete this post and its comments?") && deletePost(classId, post)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        )}
      </header>

      {post.title && <h3 className="cls-post__title">{post.title}</h3>}
      <RichText text={post.body} />

      {post.kind === "lab" && post.sessionCode && (
        <LabStatus code={post.sessionCode} me={me} isInstructor={isInstructor} onOpen={() => onOpenLab?.(post.sessionCode)} />
      )}

      {(post.links?.length > 0 || post.files?.length > 0) && (
        <ul className="cls-resources">
          {post.links?.map((l, i) => (
            <li key={`l${i}`}>
              <a href={safeHref(l.url)} target="_blank" rel="noopener noreferrer">
                <Icon name="link" size={16} />
                {l.label || l.url}
              </a>
            </li>
          ))}
          {post.files?.map((f, i) => (
            <li key={`f${i}`}>
              <a href={safeHref(f.url)} target="_blank" rel="noopener noreferrer">
                <Icon name="clip" size={16} />
                {f.name} <small>{fileSize(f.size)}</small>
              </a>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="cls-post__comments-toggle" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments}>
        <Icon name="chat" size={16} />
        {post.commentCount ? `${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}` : "Ask a question or comment"}
      </button>
      {showComments && <Comments classId={classId} postId={post.id} me={me} isInstructor={isInstructor} now={now} />}
    </article>
  );
}

/** Live state of a lab activity, with its button (and, for a student, how they did). */
function LabStatus({ code, me, isInstructor, onOpen }) {
  const [session, setSession] = useState(undefined);
  const [mine, setMine] = useState(null);
  useEffect(() => subscribeSession(code, setSession, () => setSession(null)), [code]);
  useEffect(() => {
    if (isInstructor || !me?.uid) return undefined;
    return subscribeStudentRow(code, me.uid, setMine, () => setMine(null));
  }, [code, me?.uid, isInstructor]);
  if (session === undefined) return <div className="cls-lab"><span className="ins-muted">Checking the lab…</span></div>;
  const phase = session ? sessionPhase(session) : "ended";
  const label = { waiting: "Open, waiting for the instructor to start", running: "Running now", ended: "Closed" }[phase];
  return (
    <div className={`cls-lab cls-lab--${phase}`}>
      <span className={`ins-badge ins-badge--${phase === "running" ? "live" : phase === "waiting" ? "done" : "idle"}`}>{label}</span>
      {session?.tasks?.[0] && <span className="ins-small ins-muted">{session.tasks.length} {session.tasks.length === 1 ? "task" : "tasks"}</span>}
      <span className="ins-spacer" />
      <button type="button" className={`btn ${phase === "ended" && !isInstructor ? "" : "btn--primary"}`} onClick={onOpen} disabled={!isInstructor && phase === "ended"}>
        {isInstructor ? (phase === "ended" ? "View results" : "Open monitor") : phase === "ended" ? "Closed" : mine ? "Continue lab" : "Open lab"}
      </button>
      {mine && (
        <div className="cls-myresult">
          <span>Your score <b>{scoreText(mine, taskFor(session, mine).points)}</b></span>
          <span>{mine.taskDone ? `Task done in ${formatMs(mine.taskMs || 0)} ✓` : `${mine.partsLeft ?? "?"} parts left`}</span>
          {mine.mistakes ? <span>{mine.mistakes} {mine.mistakes === 1 ? "mistake" : "mistakes"}</span> : null}
        </div>
      )}
    </div>
  );
}

/* ---------- questions and answers under a post ---------- */

function Comments({ classId, postId, me, isInstructor, now }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => subscribeComments(classId, postId, setList, (err) => setError(err.code || err.message)), [classId, postId]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setError("");
    try {
      await addComment(classId, postId, { text: t, author: { ...me, instructor: isInstructor } });
    } catch (err) {
      setText(t); // give it back so nothing is lost
      setError(`Not sent (${err.code || err.message}). Try again.`);
    }
  }

  return (
    <div className="cls-comments">
      {list === null ? (
        <p className="ins-muted ins-small">Loading…</p>
      ) : (
        list.map((c) => (
          <div key={c.id} className={`cls-comment ${c.fromInstructor ? "is-instructor" : ""}`}>
            <div>
              <strong>{c.authorName}</strong>
              {c.fromInstructor && <span className="cls-tag">Instructor</span>}
              <span className="ins-muted ins-small"> · {c.pending ? "sending…" : when(c.createdAt, now)}</span>
            </div>
            <RichText text={c.text} />
            {(isInstructor || c.authorUid === me.uid) && (
              <button type="button" className="cls-link-btn" onClick={() => deleteComment(classId, postId, c.id)}>Delete</button>
            )}
          </div>
        ))
      )}
      <form className="cls-row" onSubmit={send}>
        <input
          className="cls-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isInstructor ? "Reply to the class…" : "Ask a question the whole class can see…"}
          maxLength={2000}
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
          <Icon name="send" size={15} />
          Send
        </button>
      </form>
      {error && <div className="ins-alert" role="alert">{error}</div>}
    </div>
  );
}
