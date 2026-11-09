// Creating or editing a class: the subject (its name), section, schedule and card colour, with a
// live preview of the card students will see. Each day it meets has its own time. Styles:
// styles/AppShell.css (.cform*).
import { useState } from "react";
import { DAYS, CLASS_COLORS, EMPTY_SCHEDULE, normalizeSchedule, formatWhen } from "../../lab/Schedule";
import { ClassCardView } from "./ClassCards";

const NO_TIME = { start: "", end: "" };

/**
 * initial   { name, section, schedule, color } to edit, or nothing for a new class
 * onSubmit  ({ name, section, schedule, color }) => Promise
 */
export default function ClassForm({ initial = null, submitLabel, busy, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [section, setSection] = useState(initial?.section || "");
  // a day's time stays here while the day is switched off, so switching it back on brings it back
  const [schedule, setSchedule] = useState(() => ({ ...EMPTY_SCHEDULE, ...normalizeSchedule(initial?.schedule) }));
  const [color, setColor] = useState(initial?.color || CLASS_COLORS[0]);
  const [error, setError] = useState("");

  const days = DAYS.filter((d) => schedule.days.includes(d.id)); // in week order
  const timeOf = (id) => schedule.times[id] || NO_TIME;

  function toggleDay(id) {
    const on = schedule.days.includes(id);
    const first = days[0];
    setSchedule({
      ...schedule,
      days: on ? schedule.days.filter((d) => d !== id) : [...schedule.days, id],
      // a day switched on takes its old time back, or the time of the first day already picked
      times: on || schedule.times[id] ? schedule.times : { ...schedule.times, [id]: { ...(first ? timeOf(first.id) : NO_TIME) } },
    });
  }

  const setTime = (id, key, value) => setSchedule((s) => ({ ...s, times: { ...s.times, [id]: { ...(s.times[id] || NO_TIME), [key]: value } } }));

  // every day at the first day's time
  const differs = days.some((d) => timeOf(d.id).start !== timeOf(days[0].id).start || timeOf(d.id).end !== timeOf(days[0].id).end);
  const sameForAll = () =>
    setSchedule((s) => ({ ...s, times: { ...s.times, ...Object.fromEntries(days.map((d) => [d.id, { ...timeOf(days[0].id) }])) } }));

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the class its subject name.");
    const clean = normalizeSchedule(schedule);
    const backwards = days.find((d) => clean.times[d.id].start && clean.times[d.id].end && clean.times[d.id].end <= clean.times[d.id].start);
    if (backwards) return setError(`On ${backwards.short}, the class has to end after it starts.`);
    setError("");
    onSubmit({ name: name.trim(), section: section.trim(), schedule: clean, color });
  }


  return (
    <form className="cform" onSubmit={submit}>
      <div className="cform__fields">
        <label className="cform__field cform__field--wide">
          <span>Subject</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="IT Elective 01" maxLength={60} autoFocus={!initial} required />
        </label>

        <label className="cform__field">
          <span>Section</span>
          <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="BSIT 4" maxLength={30} />
        </label>

        <label className="cform__field">
          <span>Room <em>optional</em></span>
          <input value={schedule.room} onChange={(e) => setSchedule({ ...schedule, room: e.target.value })} placeholder="Computer Lab 2" maxLength={30} />
        </label>

        <div className="cform__field cform__field--wide">
          <span id="cform-days">Meets on</span>
          <div className="cform__days" role="group" aria-labelledby="cform-days">
            {DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={schedule.days.includes(d.id) ? "is-on" : ""}
                aria-pressed={schedule.days.includes(d.id)}
                onClick={() => toggleDay(d.id)}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>

        <div className="cform__field cform__field--wide">
          <span id="cform-times">Time each day</span>
          {days.length === 0 ? (
            <p className="cform__hint">Pick the days it meets, then set each day's time.</p>
          ) : (
            <div className="cform__times" role="group" aria-labelledby="cform-times">
              {days.map((d) => (
                <div key={d.id} className="cform__time">
                  <span className="cform__time-day">{d.short}</span>
                  <input type="time" value={timeOf(d.id).start} aria-label={`${d.short} starts`} onChange={(e) => setTime(d.id, "start", e.target.value)} />
                  <span className="cform__time-to" aria-hidden="true">to</span>
                  <input type="time" value={timeOf(d.id).end} aria-label={`${d.short} ends`} onChange={(e) => setTime(d.id, "end", e.target.value)} />
                </div>
              ))}
              {differs && (
                <button type="button" className="btn btn--soft btn--sm cform__same" onClick={sameForAll}>
                  Use {days[0].short}'s time every day
                </button>
              )}
            </div>
          )}
        </div>

        <div className="cform__field cform__field--wide">
          <span id="cform-color">Card colour</span>
          <div className="cform__colors" role="radiogroup" aria-labelledby="cform-color">
            {CLASS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Colour ${c}`}
                className={color === c ? "is-on" : ""}
                style={{ "--swatch": c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="cform__preview" aria-label="Preview">
        <span className="cform__preview-label">Students will see</span>
        <ClassCardView
          name={name || "Subject name"}
          section={section.trim() || "Section"}
          meets={formatWhen(schedule) || "Days and times"}
          room={schedule.room?.trim()}
          color={color}
        />
      </aside>

      {error && <div className="ins-alert cform__error" role="alert">{error}</div>}
      <div className="cform__actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
