// The calendar: a month of everything in the person's classes.
//   A student sees when each class meets, their lab activities on the day they're due (or were
//   posted), marked done, to do, overdue or missed, and the announcements and materials posted, so
//   they can check whether they missed something. Anything missed or overdue is listed on top.
//   An instructor sees when their classes meet and the lab activities they set, on their due dates.
// Pick a day to see it in full. The week starts on Monday, like the class schedules.
// Styles: styles/Calendar.css (.cal*).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeMyClasses, subscribeClassLabs, toMs } from "../lab/Classes";
import { sessionPhase, dueText, closedMs } from "../lab/Sessions";
import { dayId, dayTime, formatRange, normalizeSchedule, CLASS_COLORS } from "../lab/Schedule";
import useClock from "../lab/useClock";
import ClassFeed from "../components/class/ClassFeed";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const dayOf = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** The 42 days a month's grid shows: from the Monday on or before the 1st. */
function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const timeOf = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const STATUS = {
  done: { label: "Done", icon: "check" },
  todo: { label: "To do", icon: "todo" },
  soon: { label: "Opens soon", icon: "clock" },
  overdue: { label: "Overdue", icon: "alert" },
  missed: { label: "Missed", icon: "alert" },
  closed: { label: "Closed", icon: "archive" },
  running: { label: "Running", icon: "play" },
  waiting: { label: "Not started", icon: "clock" },
  ended: { label: "Closed", icon: "archive" },
};

/**
 * A class's meetings on the given days: within its life (from when it was made, or the student
 * joined, to when it ended).
 */
function meetings(cls, days, from = 0) {
  const s = normalizeSchedule(cls.schedule);
  if (!s.days.length) return [];
  const start = dayOf(Math.max(toMs(cls.createdAt), from) || Date.now());
  const end = cls.archived && cls.endedAt ? dayOf(toMs(cls.endedAt)) : null;
  return days
    .filter((d) => d >= start && (!end || d <= end) && s.days.includes(dayId(d)))
    .map((d) => {
      const t = dayTime(cls.schedule, dayId(d));
      return {
        id: `meet-${cls.id}-${dayKey(d)}`,
        day: d,
        sort: t.start || "00:00",
        kind: "class",
        title: cls.name,
        time: formatRange(t.start, t.end) || "Class day",
        sub: [cls.section, s.room].filter(Boolean).join(" · "),
        color: cls.color || CLASS_COLORS[0],
      };
    });
}

export default function Calendar() {
  const { user, profile } = useAuth();
  if (profile?.role === "faculty") return <TeachingCalendar uid={user?.uid} />;
  return <ClassFeed user={user} profile={profile}>{(feed) => <StudyCalendar feed={feed} />}</ClassFeed>;
}

/* ---------- a student's ---------- */

function StudyCalendar({ feed }) {
  const build = (days) => {
    const out = [];
    for (const info of feed.classes) {
      const { cls, member, posts, labs } = info;
      const color = cls.color || CLASS_COLORS[0];
      const classTo = `/classes/${cls.id}`;
      out.push(...meetings({ ...cls, id: info.classId }, days, toMs(member.joinedAt)).map((m) => ({ ...m, to: classTo })));
      for (const p of posts) {
        if (p.kind === "lab" && p.sessionCode) {
          const lab = labs[p.sessionCode];
          if (!lab?.session) continue;
          const due = lab.session.dueAt?.toMillis?.();
          const at = due || toMs(p.createdAt);
          const open = lab.standing === "todo" || lab.standing === "overdue" || lab.standing === "soon";
          out.push({
            id: `lab-${p.id}`,
            day: dayOf(at),
            sort: due ? new Date(due).toTimeString().slice(0, 5) : "23:59",
            kind: "lab",
            title: p.title || lab.session.title || "Lab activity",
            time: due ? `Due ${timeOf(due)}` : "Posted",
            sub: cls.name,
            status: lab.standing,
            color,
            to: open && !cls.archived ? `/lab?lab=${p.sessionCode}&class=${info.classId}` : `${classTo}?tab=labs`,
            action: open && !cls.archived ? (lab.row ? "Continue lab" : "Open lab") : "View",
          });
        } else {
          const at = toMs(p.createdAt);
          out.push({
            id: `post-${p.id}`,
            day: dayOf(at),
            sort: new Date(at).toTimeString().slice(0, 5),
            kind: "post",
            title: p.title || (p.body || "").split("\n")[0].slice(0, 80) || (p.kind === "material" ? "Learning material" : "Announcement"),
            time: `${p.kind === "material" ? "Material" : "Announcement"} · ${timeOf(at)}`,
            sub: cls.name,
            color,
            to: p.kind === "material" ? `${classTo}?tab=materials` : classTo,
            action: "View",
          });
        }
      }
    }
    return out;
  };

  // everything missed or overdue, however long ago: what the student should look at first
  const late = feed.classes
    .filter((info) => !info.cls.archived)
    .flatMap((info) =>
      info.posts
        .filter((p) => p.kind === "lab" && p.sessionCode && ["missed", "overdue"].includes(info.labs[p.sessionCode]?.standing))
        .map((p) => {
          const lab = info.labs[p.sessionCode];
          return {
            id: p.id,
            title: p.title || lab.session.title,
            className: info.cls.name,
            standing: lab.standing,
            when: lab.standing === "missed" ? closedMs(lab.session) : lab.session.dueAt?.toMillis?.(),
            due: dueText(lab.session),
            to: lab.standing === "overdue" ? `/lab?lab=${p.sessionCode}&class=${info.classId}` : `/classes/${info.classId}?tab=labs`,
          };
        })
    )
    .sort((a, b) => (a.standing === "overdue" ? -1 : 1) - (b.standing === "overdue" ? -1 : 1) || (b.when || 0) - (a.when || 0));

  return (
    <CalendarPage
      subtitle="When your classes meet, when lab activities are due, and anything you missed."
      ready={feed.ready}
      empty={feed.ready && feed.classes.length === 0 ? "Join a class in Classes, and its meetings and lab activities show up here." : ""}
      build={build}
      top={late.length > 0 && <LatePanel items={late} />}
    />
  );
}

/** What a student missed (closed before they finished) and what's overdue (past due, still open). */
function LatePanel({ items }) {
  const missed = items.filter((i) => i.standing === "missed").length;
  const overdue = items.length - missed;
  const labs = (n) => `${n} lab ${n === 1 ? "activity" : "activities"}`;
  const title = missed
    ? `You missed ${labs(missed)}${overdue ? ` · ${overdue} more overdue` : ""}`
    : `${labs(overdue)} ${overdue === 1 ? "is" : "are"} overdue`;
  return (
    <section className="ins-panel cal-late" aria-label="Missed and overdue">
      <h2 className="panel-title">
        <Icon name="alert" />
        {title}
      </h2>
      <ul className="cal-late__list">
        {items.map((i) => (
          <li key={i.id}>
            <span className={`cal-tag cal-tag--${i.standing}`}>{STATUS[i.standing].label}</span>
            <span className="cal-late__text">
              <strong>{i.title}</strong>
              <small>
                {i.className}
                {i.standing === "missed" ? (i.when ? ` · closed ${new Date(i.when).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}` : "") : ` · was due ${i.due}, you can still do it`}
              </small>
            </span>
            <Link to={i.to} className={`btn btn--sm ${i.standing === "overdue" ? "btn--primary" : ""}`}>
              {i.standing === "overdue" ? "Do it now" : "View"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- an instructor's ---------- */

function TeachingCalendar({ uid }) {
  const [classes, setClasses] = useState(null);
  const [labs, setLabs] = useState({}); // classId -> labs
  useEffect(() => (uid ? subscribeMyClasses(uid, setClasses, () => setClasses([])) : undefined), [uid]);
  const ids = (classes || []).map((c) => c.id).join(",");
  useEffect(() => {
    if (!ids) return undefined;
    const offs = ids.split(",").map((id) => subscribeClassLabs(id, uid, (list) => setLabs((l) => ({ ...l, [id]: list })), () => {}));
    return () => offs.forEach((off) => off());
  }, [ids, uid]);

  const build = (days) => {
    const out = [];
    for (const cls of classes || []) {
      const color = cls.color || CLASS_COLORS[0];
      out.push(...meetings(cls, days).map((m) => ({ ...m, to: `/instructor/c/${cls.id}` })));
      for (const lab of labs[cls.id] || []) {
        const due = lab.dueAt?.toMillis?.();
        const at = due || toMs(lab.createdAt);
        const phase = sessionPhase(lab);
        out.push({
          id: `lab-${lab.code}`,
          day: dayOf(at),
          sort: due ? new Date(due).toTimeString().slice(0, 5) : "23:59",
          kind: "lab",
          title: lab.title || "Lab activity",
          time: due ? `Due ${timeOf(due)}` : "Made this day",
          sub: cls.name,
          status: phase,
          color,
          to: `/instructor/c/${cls.id}/lab/${lab.code}`,
          action: phase === "ended" ? "Results" : "Open monitor",
        });
      }
    }
    return out;
  };

  return (
    <CalendarPage
      subtitle="When your classes meet, and when the lab activities you set are due."
      ready={classes !== null}
      empty={classes?.length === 0 ? "Make a class in Classes, and its meetings and lab activities show up here." : ""}
      build={build}
    />
  );
}

/* ---------- the month, and the day picked ---------- */

function CalendarPage({ subtitle, ready, empty, build, top = null }) {
  const today = dayOf(useClock());
  const [month, setMonth] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [picked, setPicked] = useState(() => today);
  const days = useMemo(() => monthDays(month.y, month.m), [month.y, month.m]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of build(days)) {
      const k = dayKey(e.day);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    map.forEach((list) => list.sort((a, b) => a.sort.localeCompare(b.sort)));
    return map;
  }, [build, days]);

  // the picked day's events: built on their own when that day isn't in the month shown
  const pickedEvents = byDay.get(dayKey(picked)) || build([picked]).sort((a, b) => a.sort.localeCompare(b.sort));

  const go = (delta) => setMonth(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const goToday = () => {
    setMonth({ y: today.getFullYear(), m: today.getMonth() });
    setPicked(today);
  };
  const title = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <AppShell className="app-page--content" eyebrow="Calendar" title="Calendar" subtitle={subtitle}>
      {top}
      {!ready ? (
        <div className="ins-panel ccard--skeleton cal-skeleton" aria-hidden="true" />
      ) : (
        <div className="cal">
          <section className="ins-panel cal-month" aria-label={title}>
            <div className="cal-bar">
              <h2 className="cal-bar__title">{title}</h2>
              <div className="cal-bar__nav">
                <button type="button" className="btn btn--icon btn--ghost" onClick={() => go(-1)} aria-label="Previous month">
                  <Icon name="back" size={18} />
                </button>
                <button type="button" className="btn btn--sm" onClick={goToday}>Today</button>
                <button type="button" className="btn btn--icon btn--ghost" onClick={() => go(1)} aria-label="Next month">
                  <Icon name="forward" size={18} />
                </button>
              </div>
            </div>
            {empty && <p className="ins-muted ins-small">{empty}</p>}

            <div className="cal-grid" role="grid" aria-label={`${title}: pick a day`}>
              {WEEK.map((w) => (
                <span key={w} className="cal-grid__dow" role="columnheader">{w}</span>
              ))}
              {days.map((d) => {
                const list = byDay.get(dayKey(d)) || [];
                const out = d.getMonth() !== month.m;
                const isToday = d.getTime() === today.getTime();
                const isPicked = d.getTime() === picked.getTime();
                const alert = list.some((e) => e.status === "missed" || e.status === "overdue");
                return (
                  <button
                    key={dayKey(d)}
                    type="button"
                    role="gridcell"
                    aria-selected={isPicked}
                    aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${list.length ? `, ${list.length} ${list.length === 1 ? "thing" : "things"}` : ""}${alert ? ", something missed or overdue" : ""}`}
                    className={`cal-day ${out ? "is-out" : ""} ${isToday ? "is-today" : ""} ${isPicked ? "is-picked" : ""} ${alert ? "has-alert" : ""}`}
                    onClick={() => setPicked(d)}
                  >
                    <span className="cal-day__num">{d.getDate()}</span>
                    <span className="cal-day__events">
                      {list.slice(0, 3).map((e) => (
                        <span key={e.id} className={`cal-chip cal-chip--${e.kind} ${e.status ? `is-${e.status}` : ""}`} style={{ "--event-color": e.color }}>
                          {e.title}
                        </span>
                      ))}
                      {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
                    </span>
                    {/* a phone shows dots instead of names */}
                    {list.length > 0 && (
                      <span className="cal-day__dots" aria-hidden="true">
                        {list.slice(0, 4).map((e) => (
                          <i key={e.id} className={e.status ? `is-${e.status}` : ""} style={{ "--event-color": e.color }} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <ul className="cal-legend" aria-label="What the colours mean">
              <li><i className="cal-legend__class" />Class meeting</li>
              <li><i className="cal-legend__lab" />Lab activity</li>
              <li><i className="cal-legend__post" />Posted</li>
              <li><i className="cal-legend__late" />Missed or overdue</li>
            </ul>
          </section>

          <section className="ins-panel cal-agenda" aria-label="The day picked" aria-live="polite">
            <h2 className="panel-title">
              <Icon name="calendar" />
              {picked.getTime() === today.getTime() ? "Today" : picked.toLocaleDateString(undefined, { weekday: "long" })}
              <small className="cal-agenda__date">{picked.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</small>
            </h2>
            {pickedEvents.length === 0 ? (
              <p className="ins-muted ins-small">Nothing on this day.</p>
            ) : (
              <ul className="cal-agenda__list">
                {pickedEvents.map((e) => (
                  <li key={e.id} className={`cal-item cal-item--${e.kind} ${e.status ? `is-${e.status}` : ""}`} style={{ "--event-color": e.color }}>
                    <span className="cal-item__time">{e.time}</span>
                    <span className="cal-item__text">
                      <strong>{e.title}</strong>
                      {e.sub && <small>{e.sub}</small>}
                    </span>
                    {e.status && STATUS[e.status] && (
                      <span className={`cal-tag cal-tag--${e.status}`}>
                        <Icon name={STATUS[e.status].icon} size={12} />
                        {STATUS[e.status].label}
                      </span>
                    )}
                    <Link to={e.to} className="cal-item__go" aria-label={`${e.action || "Open"}: ${e.title}`}>
                      {e.action || "Open"}
                      <Icon name="forward" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
