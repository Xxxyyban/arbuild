// TEMP-DEVTEST: the Build Lab's link to a class lab (lab/useLabSession.js) on the shared in-memory
// store, so a student's progress shows on the instructor's monitor in another tab.
import { useCallback, useEffect, useRef, useState } from "react";
import { sessionPhase, subscribeSession, subscribeStudentRow } from "./Sessions.js";
import { taskFor } from "/src/lab/Tasks.js";
import { store, save } from "./store.js";

export function useLabSession({ user, profile }) {
  const [code, setCode] = useState(null);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const codeRef = useRef(null);
  const phaseRef = useRef(null);
  codeRef.current = code;

  useEffect(() => (code ? subscribeSession(code, (s) => setSession(s ?? { status: "closed", setup: {} })) : undefined), [code]);
  useEffect(() => (code && user?.uid ? subscribeStudentRow(code, user.uid, setMe) : undefined), [code, user?.uid]);

  const phase = code && session ? sessionPhase(session) : null;
  phaseRef.current = phase;

  const writeRow = useCallback(
    (data) => {
      const c = codeRef.current;
      if (!c || !user?.uid || !phaseRef.current || phaseRef.current === "ended") return;
      const rows = (store.labRows[c] ||= {});
      rows[user.uid] = { ...rows[user.uid], ...data, lastActive: new Date().toISOString() };
      save();
    },
    [user?.uid]
  );
  const timer = useRef(null);
  const pushProgress = useCallback(
    (data) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => writeRow(data), 800);
    },
    [writeRow]
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const sink = useCallback(
    (evt) => {
      const c = codeRef.current;
      if (!c || !user?.uid || phaseRef.current !== "running") return;
      ((store.events ||= {})[c] ||= []).push({ id: `ev${Date.now()}${Math.random()}`, uid: user.uid, ...evt });
      save();
    },
    [user?.uid]
  );

  const join = useCallback(
    async (rawCode) => {
      if (!user) return { error: "Sign in first." };
      const c = String(rawCode).toUpperCase();
      const s = store.labs[c];
      if (!s) return { error: "No lab has that code. Check it with your instructor." };
      if (sessionPhase(s) === "ended") return { error: "This lab is closed. Ask your instructor to reopen it." };
      const rows = (store.labRows[c] ||= {});
      const prev = rows[user.uid] || null;
      const t = taskFor(s, null);
      rows[user.uid] = {
        ...(prev || { mode: t.mode, platform: t.platform, score: 0, scoreScale: 100, partsLeft: 0, mistakes: 0 }),
        uid: user.uid,
        name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user.email,
        email: user.email,
        studentId: profile?.studentId || "",
        section: profile?.section || "",
        joins: (prev?.joins || 0) + 1,
        lastActive: new Date().toISOString(),
      };
      save();
      setSession({ ...s });
      setMe(prev);
      setCode(c);
      return { session: s, row: prev };
    },
    [user, profile]
  );

  const leave = useCallback(() => {
    setCode(null);
    setSession(null);
    setMe(null);
  }, []);

  return { code, session, me, phase, ended: phase === "ended", join, leave, sink, pushProgress };
}
