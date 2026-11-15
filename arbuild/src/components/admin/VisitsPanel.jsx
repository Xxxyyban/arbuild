// The admin dashboard's visits: how many times students and instructors opened ARBuild, by day and by
// hour of the day, over the last 7 or 30 days (lab/Visits.js). Each bar says its number when pointed
// at or focused; "Show as table" lists them all. Styles: styles/Admin.css (.visits*).
import { useEffect, useMemo, useState } from "react";
import { byDay, byHour, loadVisits } from "../../lab/Visits";

const RANGES = [7, 30];

const hourName = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const hourSpan = (h) => `${hourName(h)} to ${hourName((h + 1) % 24)}`;
const plural = (n) => `${n} visit${n === 1 ? "" : "s"}`;

/** A top for the scale: 1, 2, 5, 10, 20, 50... at or above the tallest bar. */
function niceTop(max) {
  if (max <= 4) return Math.max(1, max);
  const step = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((m) => m * step).find((v) => v >= max);
}

/**
 * Bars on a shared scale. bars: [{ key, label (under the bar, or ""), name (in the pop-up), value }].
 */
function Bars({ bars, title }) {
  const [on, setOn] = useState(null);
  const top = niceTop(Math.max(0, ...bars.map((b) => b.value)));
  const shown = on === null ? null : bars[on];
  return (
    <figure className="visits__chart">
      <figcaption>{title}</figcaption>
      <div className="visits__plot">
        <div className="visits__scale" aria-hidden="true">
          <span>{top}</span>
          <span>{top / 2 === Math.round(top / 2) ? top / 2 : ""}</span>
          <span>0</span>
        </div>
        <div className="visits__bars" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }} onMouseLeave={() => setOn(null)}>
          {bars.map((b, i) => (
            <div
              key={b.key}
              className={`visits__col ${on === i ? "is-on" : ""}`}
              tabIndex={0}
              aria-label={`${b.name}: ${plural(b.value)}`}
              onMouseEnter={() => setOn(i)}
              onFocus={() => setOn(i)}
              onBlur={() => setOn(null)}
            >
              <i style={{ height: `${top ? (b.value / top) * 100 : 0}%` }} />
              <small>{b.label}</small>
            </div>
          ))}
          {shown && (
            <div className="visits__tip" role="status" style={{ left: `${((on + 0.5) / bars.length) * 100}%` }}>
              <strong>{plural(shown.value)}</strong>
              <span>{shown.name}</span>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

export default function VisitsPanel() {
  const [entries, setEntries] = useState(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState(7);

  useEffect(() => {
    let live = true;
    loadVisits(Math.max(...RANGES))
      .then((list) => live && setEntries(list))
      .catch((err) => {
        console.error("Failed to load visits:", err);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!entries) return null;
    const days = byDay(entries, range);
    const hours = byHour(entries, range);
    const total = days.reduce((n, d) => n + d.count, 0);
    const busiestDay = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
    const busiestHour = hours.indexOf(Math.max(...hours));
    const long = range > 7;
    return {
      total,
      busiestDay,
      busiestHour,
      dayBars: days.map((d, i) => ({
        key: d.date.getTime(),
        // every day under a week's bars; every 5th (and the last) under a month's
        label: !long || i % 5 === 0 || i === days.length - 1 ? d.date.toLocaleDateString(undefined, long ? { month: "short", day: "numeric" } : { weekday: "short" }) : "",
        name: d.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
        value: d.count,
      })),
      hourBars: hours.map((v, h) => ({ key: h, label: h % 6 === 0 ? hourName(h) : "", name: hourSpan(h), value: v })),
    };
  }, [entries, range]);

  return (
    <section className="admin-panel visits">
      <div className="panel-head">
        <div>
          <h3>Visits</h3>
          <p className="visits__sub">Students and instructors opening ARBuild, counted at most once every 10 minutes each.</p>
        </div>
        <div className="visits__range" role="radiogroup" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} className={range === r ? "is-on" : ""} onClick={() => setRange(r)}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p className="panel-empty">The visits couldn't be loaded. Check the internet connection, then reload the page.</p>
      ) : !view ? (
        <p className="panel-empty">Loading visits...</p>
      ) : view.total === 0 ? (
        <p className="panel-empty">No visits counted in the last {range} days yet. Visits are counted from the day this was added.</p>
      ) : (
        <>
          <ul className="visits__facts">
            <li>
              <span>Visits</span>
              <strong>{view.total}</strong>
            </li>
            <li>
              <span>Busiest day</span>
              <strong>{view.busiestDay.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
            </li>
            <li>
              <span>Busiest hour</span>
              <strong>{hourSpan(view.busiestHour)}</strong>
            </li>
          </ul>
          <div className="visits__charts">
            <Bars title="By day" bars={view.dayBars} />
            <Bars title="By hour of the day" bars={view.hourBars} />
          </div>
          <details className="visits__table">
            <summary>Show as table</summary>
            <div>
              <table>
                <caption>By day</caption>
                <tbody>
                  {view.dayBars.map((b) => (
                    <tr key={b.key}>
                      <th scope="row">{b.name}</th>
                      <td>{b.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table>
                <caption>By hour of the day</caption>
                <tbody>
                  {view.hourBars.map((b) => (
                    <tr key={b.key}>
                      <th scope="row">{b.name}</th>
                      <td>{b.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
