// A graded lab run as an exam (the instructor's "Exam lockdown" rule, lab/Setup.js). The lab runs in
// full screen; leaving it, for another tab or app or out of full screen, goes into the instructor's
// report with how long; copying, the right-click menu and printing are off; and Print Screen is
// reported. A web page can't stop a screenshot or a screen recording itself (the computer or phone
// takes it): the watermark (components/Watermark.jsx) makes one that gets out show whose it was.
// Styles: styles/BuildLabParts.css (.exam-gate, body.exam-lockdown).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const fullscreenNow = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const canFullscreen = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

function enterFullscreen() {
  const el = document.documentElement;
  const go = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!go) return Promise.reject(new Error("No full screen here"));
  try {
    return Promise.resolve(go.call(el, { navigationUI: "hide" }));
  } catch (err) {
    return Promise.reject(err);
  }
}

function exitFullscreen() {
  const go = document.exitFullscreen || document.webkitExitFullscreen;
  if (go && fullscreenNow()) Promise.resolve(go.call(document)).catch(() => {});
}

/** "45 s", "2 min 5 s" */
export function awayText(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
}

/**
 * active: the exam is on (a graded lab, running, with the lockdown rule). paused: don't watch for now
 * (AR has the screen). report(detail): into the instructor's report. warn(text): tell the student.
 * Shows the full-screen gate: before the start, and when full screen is left.
 */
export default function ExamGuard({ active, paused, report, warn }) {
  const [gate, setGate] = useState(null); // null | "start" | "back"
  const started = useRef(false);
  const ours = useRef(false); // the page is in full screen because the exam put it there
  const awayFrom = useRef(null); // when they left the lab
  const times = useRef(0); // how often they left
  const lastSaid = useRef({}); // detail -> when it was last reported: a held key isn't forty reports
  const out = useRef({ report, warn });
  out.current = { report, warn };

  // on: the gate first. Off (the lab ended, or the rule was turned off): out of full screen.
  useEffect(() => {
    if (active) {
      if (!started.current) setGate("start");
      return;
    }
    setGate(null);
    started.current = false;
    if (ours.current) {
      ours.current = false;
      exitFullscreen();
    }
  }, [active]);

  // back from AR, which may have taken the page out of full screen: back in, without a report
  useEffect(() => {
    if (active && !paused && ours.current && !fullscreenNow()) {
      ours.current = false;
      setGate("back");
    }
  }, [active, paused]);

  useEffect(() => {
    if (!active || paused) return undefined;
    const say = (detail, every = 5000) => {
      const now = Date.now();
      if (now - (lastSaid.current[detail] || 0) < every) return;
      lastSaid.current[detail] = now;
      out.current.report(detail);
    };
    const leave = () => {
      if (awayFrom.current == null) awayFrom.current = Date.now();
    };
    const back = () => {
      if (awayFrom.current == null) return;
      const ms = Date.now() - awayFrom.current;
      awayFrom.current = null;
      if (ms < 800) return; // a flicker: a permission bubble, a notification
      times.current += 1;
      out.current.report(`Left the lab for ${awayText(ms)}`);
      out.current.warn(`You left the lab for ${awayText(ms)} (${times.current} ${times.current === 1 ? "time" : "times"}). Your instructor can see this.`);
    };
    const onVisibility = () => (document.hidden ? leave() : back());
    const onFocus = () => {
      if (!document.hidden) back();
    };
    const onFullscreen = () => {
      if (!ours.current || fullscreenNow()) return;
      ours.current = false;
      say("Left full screen", 1000);
      setGate("back");
    };
    const stop = (e) => e.preventDefault();
    const onCopy = (e) => {
      e.preventDefault();
      say("Tried to copy");
    };
    const onKeyDown = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["p", "s", "u", "c", "x"].includes(k)) {
        e.preventDefault();
        if (k === "p") say("Tried to print");
        if (k === "c" || k === "x") say("Tried to copy");
      }
    };
    // Windows only tells the page about Print Screen as the key comes up, after the picture is taken:
    // the report says it happened, and the picture is wiped from the clipboard where the browser allows
    const onKeyUp = (e) => {
      if (e.key !== "PrintScreen") return;
      say("Pressed Print Screen");
      navigator.clipboard?.writeText?.("").catch(() => {});
    };
    const onPrint = () => say("Tried to print");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("webkitfullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("contextmenu", stop, true);
    document.addEventListener("dragstart", stop, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("beforeprint", onPrint);
    document.body.classList.add("exam-lockdown");
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("webkitfullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("contextmenu", stop, true);
      document.removeEventListener("dragstart", stop, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("beforeprint", onPrint);
      document.body.classList.remove("exam-lockdown");
      awayFrom.current = null;
    };
  }, [active, paused]);

  if (!active || paused || !gate) return null;

  const full = canFullscreen();
  const go = () => {
    started.current = true;
    if (!full) {
      setGate(null); // an iPhone: no full screen for a page, the rest still applies
      return;
    }
    enterFullscreen()
      .then(() => {
        ours.current = true;
        setGate(null);
      })
      .catch(() => setGate(null)); // the browser said no: carry on without it
  };

  return createPortal(
    <div className="exam-gate" role="dialog" aria-modal="true" aria-labelledby="exam-gate-title">
      <div className="exam-gate__card">
        <span className="exam-gate__tag">Exam</span>
        {gate === "start" ? (
          <>
            <h2 id="exam-gate-title">This lab is an exam</h2>
            <ul>
              {full && <li>It runs in full screen.</li>}
              <li>Leaving it, for another tab or app{full ? " or out of full screen" : ""}, is reported to your instructor, with how long.</li>
              <li>Copying and printing are off, and your name and ID are shown across the screen.</li>
            </ul>
          </>
        ) : (
          <>
            <h2 id="exam-gate-title">Back to full screen</h2>
            <p>You left full screen, and that's in your instructor's report. The timer is still running.</p>
          </>
        )}
        <button type="button" className="exam-gate__go" onClick={go}>
          {!full ? "Start" : gate === "start" ? "Start in full screen" : "Return to full screen"}
        </button>
      </div>
    </div>,
    document.body
  );
}
