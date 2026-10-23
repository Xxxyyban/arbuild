// A private conversation between the instructor and one student. Messages appear live on both
// sides; one typed while offline shows "Sending…" and goes out when the connection is back.
// Styles: styles/Classes.css (.cls-chat*).
import { useEffect, useRef, useState } from "react";
import { subscribeMessages, sendMessage, markThreadRead, when, toMs } from "../../lab/Classes";
import { RichText } from "./Stream";

/**
 * classId, studentUid    which conversation
 * me                     { uid, name }
 * otherName              shown in the header and the empty state
 * studentName            the student's name (kept on the conversation for the instructor's inbox)
 */
export default function Chat({ classId, studentUid, me, otherName, studentName, isInstructor, now }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const end = useRef(null);

  useEffect(
    () => subscribeMessages(classId, studentUid, setMessages, (err) => setError(`Couldn't load messages (${err.code || err.message}).`)),
    [classId, studentUid]
  );

  // reading the conversation marks it read
  const lastAt = messages?.length ? toMs(messages[messages.length - 1].createdAt) : 0;
  useEffect(() => {
    if (messages) markThreadRead(classId, studentUid, me.uid);
  }, [classId, studentUid, me.uid, lastAt, messages]);

  // (braces: newer browsers return a Promise from scrollIntoView, which an effect must not return)
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setError("");
    try {
      await sendMessage(classId, studentUid, {
        text: t,
        from: { uid: me.uid, name: me.name, student: !isInstructor, studentName },
      });
    } catch (err) {
      setText(t); // give it back so nothing is lost
      setError(`Not sent (${err.code || err.message}). Press Send to try again.`);
    }
  }

  return (
    <section className="ins-panel cls-chat" aria-label={`Messages with ${otherName}`}>
      <header className="cls-chat__head">
        <strong>{otherName}</strong>
        <span className="ins-muted ins-small">
          {isInstructor ? "Private: only you and this student see this." : "Private: only you and your instructor see this."}
        </span>
      </header>

      {!online && <div className="cls-offline">You're offline. Messages you send now go out when you're back online, as long as this page stays open.</div>}

      <div className="cls-chat__list" role="log" aria-live="polite">
        {messages === null ? (
          <p className="ins-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="cls-empty">
            <strong>No messages yet</strong>
            <span>
              {isInstructor
                ? `Send ${otherName} a note, feedback on their lab work, or a reminder.`
                : "Stuck on a step, or have a question? Ask your instructor here."}
            </span>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.from === me.uid;
            const prev = messages[i - 1];
            const showName = !prev || prev.from !== m.from;
            return (
              <div key={m.id} className={`cls-msg ${mine ? "is-mine" : ""}`}>
                {showName && !mine && <span className="cls-msg__name">{m.fromName}</span>}
                <div className="cls-msg__bubble">
                  <RichText text={m.text} />
                </div>
                <span className="cls-msg__time">{m.pending ? "Sending…" : when(m.createdAt, now)}</span>
              </div>
            );
          })
        )}
        <div ref={end} />
      </div>

      {error && <div className="ins-alert" role="alert">{error}</div>}
      <form className="cls-chat__form" onSubmit={send}>
        <textarea
          className="cls-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          placeholder={`Message ${otherName}…  (Enter to send, Shift+Enter for a new line)`}
          rows={2}
          maxLength={4000}
        />
        <button type="submit" className="btn btn--primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>
  );
}
