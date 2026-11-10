// The student's side of a class, used by pages/BuildLab.jsx.
//
//   const labSession = useLabSession({ user, profile });
//   labSession.join(code)          -> { session, row } or { error }
//   labSession.leave()
//   labSession.phase               -> null | "waiting" | "running" | "ended"
//   labSession.me                  -> this student's row (assignedMode / assignedPlatform are what the instructor chose)
//   labSession.pushProgress({...}) -> the student's row, saved at most every 30 s (lab/rowSaver.js)
//   labSession.sink                -> pass to reporter.setSink() to store mistakes (reportEvent.js SAVED_TYPES)
//   labSession.session / .ended / .code
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { joinSession, sessionPhase, studentRef, subscribeSession, subscribeStudentRow } from "./Sessions";
import { SAVED_TYPES } from "./reportEvent";
import { createRowSaver, BEAT_CHECK } from "./rowSaver";

const FINAL_SAVE = 20000; // ms after a lab closes in which its final result is still sent (the rules allow 60 s)

export function useLabSession({ user, profile }) {
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [now, setNow] = useState(Date.now());

  const codeRef = useRef(null);
  const uidRef = useRef(null);
  const phaseRef = useRef(null);
  const endedAt = useRef(0);

  codeRef.current = code;
  uidRef.current = user?.uid || null;

  // live copy of the class (settings, phase, timer)
  useEffect(() => {
    if (!code) return undefined;
    return subscribeSession(
      code,
      (s) => setSession(s ?? { status: "closed", setup: {} }), // deleted = over
      (err) => console.error("class listener:", err)
    );
  }, [code]);

  // live copy of this student's own row (the instructor's assignment arrives here)
  useEffect(() => {
    if (!code || !user?.uid) return undefined;
    return subscribeStudentRow(code, user.uid, setMe, (err) => console.error("row listener:", err));
  }, [code, user?.uid]);

  // slow clock, only so an older class saved with a countdown still ends on time
  useEffect(() => {
    if (!code) return undefined;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [code]);

  const phase = code && session ? sessionPhase(session, now) : null;
  const ended = phase === "ended";
  phaseRef.current = phase;
  // when this lab was first seen closed here (0: it isn't): see writeRow
  if (!ended) endedAt.current = 0;
  else if (!endedAt.current) endedAt.current = Date.now();

  const writeRow = useCallback((data) => {
    const c = codeRef.current;
    const u = uidRef.current;
    if (!c || !u || !phaseRef.current) return;
    // Closed: nothing more, except the final result as it closes. Saves are spaced out, so the last
    // steps may not be in yet, and firestore.rules lets a row in for a minute after the instructor closes.
    if (phaseRef.current === "ended" && Date.now() - endedAt.current > FINAL_SAVE) return;
    setDoc(studentRef(c, u), { ...data, lastActive: new Date().toISOString() }, { merge: true }).catch((err) =>
      console.error("progress write failed:", err)
    );
  }, []);

  // when the row is saved: seldom, so a class fits the free plan's daily writes (rowSaver.js)
  const [saver] = useState(() => createRowSaver(writeRow));
  const pushProgress = useCallback(
    (data) => {
      saver.push(data);
      if (phaseRef.current === "ended") saver.flush(); // the final result: now, not at its turn
    },
    [saver]
  );

  // still here, so the instructor can tell who is: asked often, sent rarely
  useEffect(() => {
    if (!code) return undefined;
    const id = setInterval(() => phaseRef.current !== "ended" && saver.beat(), BEAT_CHECK);
    return () => clearInterval(id);
  }, [code, saver]);

  // what's waiting to be saved goes out when the lab page closes or the tab is put away
  useEffect(() => {
    const hide = () => document.hidden && saver.flush();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", saver.flush);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", saver.flush);
      saver.flush();
    };
  }, [saver]);

  // mistakes, safety, reverts, exam warnings and the finish go in the events log, while the timer is
  // running. Not every correct step: those were most of a lab's log (reportEvent.js SAVED_TYPES).
  const sink = useCallback((evt) => {
    const c = codeRef.current;
    const u = uidRef.current;
    if (!c || !u || phaseRef.current !== "running" || !SAVED_TYPES.includes(evt.type)) return;
    addDoc(collection(db, "sessions", c, "events"), { uid: u, ...evt }).catch((err) =>
      console.error("event write failed:", err)
    );
  }, []);

  const join = useCallback(
    async (rawCode) => {
      if (!user) return { error: "Sign in first." };
      const res = await joinSession(rawCode, user, profile);
      if (res.error) return res;
      setSession(res.session);
      setMe(res.row);
      setCode(res.session.code);
      return res;
    },
    [user, profile]
  );

  const leave = useCallback(() => {
    saver.flush();
    saver.stop();
    setCode(null);
    setSession(null);
    setMe(null);
  }, [saver]);

  return { code, session, me, phase, ended, join, leave, sink, pushProgress };
}