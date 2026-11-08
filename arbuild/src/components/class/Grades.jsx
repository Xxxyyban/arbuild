// A class's grades: every student against every lab activity (score, done, missed), each student's
// total, and the class's average, with search and sort. It downloads as an Excel workbook: the grade
// sheet, and a sheet with every result's details. Students taken out of the class keep their results,
// shown apart. Styles: styles/Classes.css (.grades*, .cls-grades).
import { useEffect, useMemo, useState } from "react";
import { subscribeClassLabs, subscribeRemoved, toMs } from "../../lab/Classes";
import { subscribeStudents, sessionPhase, formatMs, workLeft, labStanding, dueText } from "../../lab/Sessions";
import { cappedScore } from "../../lab/Scoring";
import { taskFor } from "../../lab/Tasks";
import { makeXlsx, download, fileName } from "../../lab/xlsx";
import useClock from "../../lab/useClock";
import Icon from "../Icon";

const SORTS = [
  { id: "name", label: "Name (A–Z)" },
  { id: "high", label: "Highest total" },
  { id: "low", label: "Lowest total" },
];

const STANDING = {
  done: "Done",
  missed: "Missed",
  overdue: "Overdue",
  todo: "In progress",
  soon: "Not started",
  closed: "Closed",
};

const shortDate = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function Grades({ cls, members, onOpenLab }) {
  const [labs, setLabs] = useState(null);
  const [rows, setRows] = useState({}); // lab code -> { uid: row }
  const [removed, setRemoved] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const fail = (err) => setError(err.code || err.message);

  useEffect(() => subscribeClassLabs(cls.id, cls.instructorUid, setLabs, fail), [cls.id, cls.instructorUid]);
  useEffect(() => subscribeRemoved(cls.id, setRemoved, () => setRemoved([])), [cls.id]);

  // one live listener per lab activity
  const codes = (labs || []).map((l) => l.code).join(",");
  useEffect(() => {
    if (!codes) return undefined;
    const offs = codes.split(",").map((code) =>
      subscribeStudents(code, (list) => setRows((r) => ({ ...r, [code]: Object.fromEntries(list.map((s) => [s.id, s])) })), fail)
    );
    return () => offs.forEach((off) => off());
  }, [codes]);

  const now = useClock();
  const ordered = useMemo(() => [...(labs || [])].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt)), [labs]); // oldest first, like a gradebook
  // A total counts every lab that has started; one a student never opened counts as 0 of its points.
  const graded = ordered.filter((l) => sessionPhase(l, now) !== "waiting");
  const cell = (code, uid) => rows[code]?.[uid] || null;
  const outOf = (lab, row) => taskFor(lab, row).points;

  // students in the class, then anyone with results who isn't: taken out, or who used a lab's code
  const gone = new Map(removed.map((r) => [r.id, r]));
  const people = new Map(
    members.map((m) => [m.id, { uid: m.id, name: m.name, studentId: m.studentId, section: m.section, joinedAt: toMs(m.joinedAt), status: "in" }])
  );
  Object.values(rows).forEach((byUid) =>
    Object.values(byUid).forEach((s) => {
      if (people.has(s.id)) return;
      const r = gone.get(s.id);
      people.set(s.id, { uid: s.id, name: s.name || r?.name, studentId: s.studentId || r?.studentId, section: s.section, joinedAt: 0, status: r ? "removed" : "outside", removedAt: toMs(r?.removedAt) });
    })
  );

  // where a student stands with a lab: done, missed, overdue... or "closed" before they joined
  const standing = (lab, p) => labStanding(lab, cell(lab.code, p.uid), now, p.joinedAt);

  // a lab that closed before a student joined was never theirs: it doesn't count against them
  const totals = new Map(
    [...people.values()].map((p) => {
      const theirs = graded.filter((l) => standing(l, p) !== "closed");
      if (!theirs.length) return [p.uid, null];
      let got = 0;
      let of = 0;
      theirs.forEach((l) => {
        const r = cell(l.code, p.uid);
        got += cappedScore(r, outOf(l, r));
        of += outOf(l, r);
      });
      return [p.uid, { got, of, pct: of ? got / of : 0 }];
    })
  );

  const q = query.trim().toLowerCase();
  const list = [...people.values()]
    .filter((p) => !q || `${p.name || ""} ${p.studentId || ""} ${p.section || ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort !== "name") {
        const d = (totals.get(a.uid)?.pct ?? -1) - (totals.get(b.uid)?.pct ?? -1);
        if (d) return sort === "high" ? -d : d;
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  const inClass = list.filter((p) => p.status === "in");
  const others = list.filter((p) => p.status !== "in");

  // the class at a glance: its students' average, and how many results are done
  const classTotals = members.map((m) => totals.get(m.id)).filter(Boolean);
  const average = classTotals.length ? classTotals.reduce((s, t) => s + t.pct, 0) / classTotals.length : null;
  const cells = members.length * graded.length;
  const done = graded.reduce((n, l) => n + members.filter((m) => cell(l.code, m.id)?.taskDone).length, 0);

  function exportXlsx() {
    const everyone = [...inClass, ...others];
    const status = (p) => (p.status === "in" ? "In class" : p.status === "removed" ? `Removed ${shortDate(p.removedAt)}` : "Not in the class");
    const grades = [
      ["Student", "Student ID", "Section", "Status", ...ordered.map((l) => `${l.title} (out of ${taskFor(l, null).points})`), "Total", "Possible", "Percent"],
      ...everyone.map((p) => {
        const t = totals.get(p.uid);
        return [
          p.name || "",
          p.studentId || "",
          p.section || "",
          status(p),
          ...ordered.map((l) => {
            const r = cell(l.code, p.uid);
            return r ? cappedScore(r, outOf(l, r)) : sessionPhase(l, now) === "waiting" || standing(l, p) === "closed" ? "" : 0;
          }),
          t ? t.got : "",
          t ? t.of : "",
          t ? t.pct : "",
        ];
      }),
    ];
    const details = [
      ["Student", "Student ID", "Lab activity", "Status", "Score", "Out of", "Time taken", "Mistakes", "Due", "Last active"],
      ...ordered.flatMap((l) =>
        everyone.map((p) => {
          const r = cell(l.code, p.uid);
          return [
            p.name || "",
            p.studentId || "",
            l.title,
            STANDING[standing(l, p)],
            r ? cappedScore(r, outOf(l, r)) : "",
            outOf(l, r),
            r?.taskDone ? formatMs(r.taskMs || 0) : "",
            r ? r.mistakes || 0 : "",
            dueText(l),
            r?.lastActive ? shortDate(Date.parse(r.lastActive)) : "",
          ];
        })
      ),
    ];
    const n = ordered.length;
    download(
      makeXlsx([
        { name: "Grades", rows: grades, widths: [28, 14, 12, 24, ...ordered.map(() => 18), 10, 10, 10], percentCols: [4 + n + 2] },
        { name: "Details", rows: details, widths: [28, 14, 28, 13, 8, 8, 12, 10, 22, 22] },
      ]),
      fileName(cls.name, "grades")
    );
  }

  const row = (p) => {
    const t = totals.get(p.uid);
    const pct = t ? Math.round(t.pct * 100) : null;
    return (
      <tr key={p.uid} className={p.status === "in" ? "" : "grades__gone"}>
        <th scope="row">
          <strong>{p.name || "A student"}</strong>
          <small>
            {[p.studentId, p.status === "removed" ? `Removed ${shortDate(p.removedAt)}` : p.status === "outside" ? "Not in the class" : null]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </th>
        {ordered.map((l) => {
          const r = cell(l.code, p.uid);
          const s = standing(l, p);
          if (!r) {
            return (
              <td key={l.code} className={`grades__cell grades__cell--${s}`}>
                {s === "missed" ? <span className="grades__tag grades__tag--missed">Missed</span> : s === "overdue" ? <span className="grades__tag grades__tag--overdue">Overdue</span> : <span className="grades__none">—</span>}
              </td>
            );
          }
          return (
            <td key={l.code} className={`grades__cell grades__cell--${s}`}>
              <b>
                {cappedScore(r, outOf(l, r))}
                <span>/{outOf(l, r)}</span>
              </b>
              <small>
                {r.taskDone ? `Done · ${formatMs(r.taskMs || 0)}` : s === "missed" ? "Missed" : s === "overdue" ? `Overdue · ${workLeft(r)}` : workLeft(r)}
                {r.mistakes ? ` · ${r.mistakes} ${r.mistakes === 1 ? "mistake" : "mistakes"}` : ""}
              </small>
            </td>
          );
        })}
        <td className="grades__total">
          {t ? (
            <>
              <b>
                {t.got}
                <span>/{t.of}</span>
              </b>
              <span className={`grades__bar ${pct >= 75 ? "is-high" : pct >= 50 ? "is-mid" : "is-low"}`} aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <small>{pct}%</small>
            </>
          ) : (
            <span className="grades__none">—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <section className="ins-panel grades">
      <div className="ins-head">
        <div className="about-head">
          <h2 className="panel-title">Grades</h2>
          <p className="ins-muted ins-small">
            Every student's score in every lab activity. Once a lab has started, one a student never opened counts as 0 (unless it closed before they joined).
          </p>
        </div>
        <button className="btn btn--primary" disabled={!people.size || !ordered.length} onClick={exportXlsx}>
          <Icon name="download" size={16} />
          <span>Download Excel</span>
        </button>
      </div>
      {error && <div className="ins-alert" role="alert">{error}</div>}

      {labs === null ? (
        <p className="ins-muted">Loading…</p>
      ) : ordered.length === 0 ? (
        <div className="cls-empty">
          <strong>No lab activities yet</strong>
          <span>Make one in Lab activities. Each student's score shows up here as they work, ready to download.</span>
        </div>
      ) : (
        <>
          <dl className="grades__stats">
            <div>
              <dt>Students</dt>
              <dd>{members.length}</dd>
            </div>
            <div>
              <dt>Lab activities</dt>
              <dd>
                {graded.length}
                {ordered.length > graded.length && <small> + {ordered.length - graded.length} not started</small>}
              </dd>
            </div>
            <div>
              <dt>Class average</dt>
              <dd>{average === null ? "—" : `${Math.round(average * 100)}%`}</dd>
            </div>
            <div>
              <dt>Results done</dt>
              <dd>
                {cells ? `${done} of ${cells}` : "—"}
                {cells > 0 && <small> ({Math.round((done / cells) * 100)}%)</small>}
              </dd>
            </div>
          </dl>

          <div className="grades__tools">
            <label className="search-field">
              <Icon name="search" size={16} />
              <input className="cls-input cls-input--sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, section…" aria-label="Search students" />
            </label>
            <label className="grades__sort">
              <span>Sort</span>
              <select className="ins-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          {list.length === 0 ? (
            <p className="ins-muted">{people.size ? "No student matches that search." : "No students yet."}</p>
          ) : (
            <div className="ins-table-wrap">
              <table className="ins-table cls-grades grades__table">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    {ordered.map((l) => {
                      const phase = sessionPhase(l, now);
                      return (
                        <th key={l.code} scope="col">
                          <button type="button" className="cls-link-btn cls-grades__lab" onClick={() => onOpenLab(l.code)} title="Open this lab">
                            {l.title}
                          </button>
                          <small>
                            {taskFor(l, null).points} pts · {phase === "running" ? "running" : phase === "waiting" ? "not started" : "closed"}
                            {dueText(l) ? ` · due ${dueText(l)}` : ""}
                          </small>
                        </th>
                      );
                    })}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inClass.map(row)}
                  {others.length > 0 && (
                    <tr className="grades__group">
                      <th scope="rowgroup" colSpan={ordered.length + 2}>Not in the class any more ({others.length}): their results are kept</th>
                    </tr>
                  )}
                  {others.map(row)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
