// A class's progress: every student against every lab activity (score, done or not, time,
// mistakes), with each student's average. The instructor's gradebook. Styles: styles/Classes.css.
import { useEffect, useState } from "react";
import { subscribeClassLabs, toMs } from "../../lab/Classes";
import { subscribeStudents, sessionPhase, formatMs } from "../../lab/Sessions";
import { scoreText, cappedScore } from "../../lab/Scoring";
import { taskFor } from "../../lab/Tasks";

export default function Progress({ cls, members, onOpenLab }) {
  const [labs, setLabs] = useState(null);
  const [rows, setRows] = useState({}); // lab code -> { uid: row }
  const [error, setError] = useState("");

  useEffect(() => subscribeClassLabs(cls.id, cls.instructorUid, setLabs, (err) => setError(err.code || err.message)), [cls.id, cls.instructorUid]);

  // one live listener per lab activity
  const codes = (labs || []).map((l) => l.code).join(",");
  useEffect(() => {
    if (!codes) return undefined;
    const offs = codes.split(",").map((code) =>
      subscribeStudents(
        code,
        (list) => setRows((r) => ({ ...r, [code]: Object.fromEntries(list.map((s) => [s.id, s])) })),
        (err) => setError(err.code || err.message)
      )
    );
    return () => offs.forEach((off) => off());
  }, [codes]);

  const ordered = [...(labs || [])].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt)); // oldest first, like a gradebook
  // students in the class, plus anyone who opened a lab without being in it (they used its code)
  const people = new Map(members.map((m) => [m.id, { uid: m.id, name: m.name, studentId: m.studentId, inClass: true }]));
  Object.values(rows).forEach((byUid) =>
    Object.values(byUid).forEach((s) => {
      if (!people.has(s.id)) people.set(s.id, { uid: s.id, name: s.name, studentId: s.studentId, inClass: false });
    })
  );
  const list = [...people.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const cell = (code, uid) => rows[code]?.[uid] || null;
  const outOf = (lab, row) => taskFor(lab, row).points;
  // A student's total: their scores against everything set so far (labs that have started).
  // A lab they never opened counts as 0 of its points.
  const graded = ordered.filter((l) => sessionPhase(l) !== "waiting");
  const total = (uid) => {
    if (!graded.length) return null;
    let got = 0;
    let of = 0;
    graded.forEach((l) => {
      const r = cell(l.code, uid);
      got += cappedScore(r, outOf(l, r));
      of += outOf(l, r);
    });
    return { got, of, pct: of ? Math.round((got / of) * 100) : 0 };
  };

  function exportCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = [
      "Name", "Student ID", "In class",
      ...ordered.flatMap((l) => [`${l.title} score`, `${l.title} out of`, `${l.title} done`, `${l.title} time`]),
      "Total", "Possible", "Percent",
    ];
    const body = list.map((p) => [
      p.name, p.studentId, p.inClass ? "yes" : "no",
      ...ordered.flatMap((l) => {
        const r = cell(l.code, p.uid);
        return r ? [cappedScore(r, outOf(l, r)), outOf(l, r), r.taskDone ? "yes" : "no", formatMs(r.taskMs || 0)] : ["", outOf(l, null), "", ""];
      }),
      ...(total(p.uid) ? [total(p.uid).got, total(p.uid).of, `${total(p.uid).pct}%`] : ["", "", ""]),
    ]);
    const csv = [head, ...body].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls.name.replace(/\W+/g, "_")}-progress.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ins-panel">
      <div className="ins-head">
        <h2>Progress</h2>
        <button className="btn btn--soft" disabled={!list.length || !ordered.length} onClick={exportCsv}>Export grades (CSV)</button>
      </div>
      {error && <div className="ins-alert" role="alert">{error}</div>}

      {labs === null ? (
        <p className="ins-muted">Loading…</p>
      ) : ordered.length === 0 ? (
        <div className="cls-empty">
          <strong>No lab activities yet</strong>
          <span>Make one in Lab activities. Each student's score, time and mistakes show up here as they work.</span>
        </div>
      ) : list.length === 0 ? (
        <p className="ins-muted">No students yet.</p>
      ) : (
        <div className="ins-table-wrap">
          <table className="ins-table cls-grades">
            <thead>
              <tr>
                <th>Student</th>
                {ordered.map((l) => {
                  const phase = sessionPhase(l);
                  return (
                    <th key={l.code}>
                      <button type="button" className="cls-link-btn cls-grades__lab" onClick={() => onOpenLab(l.code)} title="Open this lab">
                        {l.title}
                      </button>
                      <small>{taskFor(l, null).points} pts · {phase === "running" ? "running" : phase === "waiting" ? "not started" : "closed"}</small>
                    </th>
                  );
                })}
                <th title="Scores so far, out of the points of every lab that has started">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.uid}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>{[p.studentId, p.inClass ? null : "not in the class"].filter(Boolean).join(" · ")}</small>
                  </td>
                  {ordered.map((l) => {
                    const r = cell(l.code, p.uid);
                    if (!r) return <td key={l.code} className="cls-grades__none">—</td>;
                    return (
                      <td key={l.code} className={r.taskDone ? "cls-grades__done" : ""}>
                        <b>{scoreText(r, outOf(l, r))}</b>
                        <small>
                          {r.taskDone ? `✓ ${formatMs(r.taskMs || 0)}` : `${r.partsLeft ?? "?"} parts left`}
                          {r.mistakes ? ` · ${r.mistakes} mistakes` : ""}
                        </small>
                      </td>
                    );
                  })}
                  <td className="ins-num">
                    {total(p.uid) ? (
                      <>
                        <b>{total(p.uid).got}/{total(p.uid).of}</b>
                        <small>{total(p.uid).pct}%</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
