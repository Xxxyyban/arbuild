// The student's side of a class, used by pages/BuildLab.jsx.
//
//   const labSession = useLabSession({ user, profile });
//   labSession.join(code)          -> { session, row } or { error }
//   labSession.leave()
//   labSession.phase               -> null | "waiting" | "running" | "ended"
//   labSession.me                  -> this student's row (assignedMode / assignedPlatform are what the instructor chose)
//   labSession.pushProgress({...}) -> debounced write of the student's row
//   labSession.sink                -> pass to reporter.setSink() to store every event
//   labSession.session / .ended / .code
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { joinSession, sessionPhase, studentRef, subscribeSession, subscribeStudentRow } from "./Sessions";

const PUSH_DELAY = 800; // ms, so a burst of changes is one write
const HEARTBEAT = 30000; // ms, so the instructor can tell who is still there

export function useLabSession({ user, profile }) {
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [now, setNow] = useState(Date.now());

  const codeRef = useRef(null);
  const uidRef = useRef(null);
  const phaseRef = useRef(null);
  const timer = useRef(null);
  const latest = useRef(null);

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

  const writeRow = useCallback((data) => {
    const c = codeRef.current;
    const u = uidRef.current;
    if (!c || !u || !phaseRef.current || phaseRef.current === "ended") return;
    setDoc(studentRef(c, u), { ...data, lastActive: new Date().toISOString() }, { merge: true }).catch((err) =>
      console.error("progress write failed:", err)
    );
  }, []);

  const pushProgress = useCallback(
    (data) => {
      latest.current = data;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => writeRow(latest.current), PUSH_DELAY);
    },
    [writeRow]
  );

  // heartbeat
  useEffect(() => {
    if (!code) return undefined;
    const id = setInterval(() => writeRow({}), HEARTBEAT);
    return () => clearInterval(id);
  }, [code, writeRow]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // every mistake / safety / revert goes in the events log (only while the timer is running)
  const sink = useCallback((evt) => {
    const c = codeRef.current;
    const u = uidRef.current;
    if (!c || !u || phaseRef.current !== "running") return;
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
    clearTimeout(timer.current);
    setCode(null);
    setSession(null);
    setMe(null);
  }, []);

  return { code, session, me, phase, ended, join, leave, sink, pushProgress };
}