// Creating or editing a class: the subject (its name), section, schedule and card colour, with a
// live preview of the card students will see. Styles: styles/AppShell.css (.cform*).
import { useState } from "react";
import { DAYS, CLASS_COLORS, EMPTY_SCHEDULE, normalizeSchedule, formatSchedule } from "../../lab/Schedule";
import { ClassCardView } from "./ClassCards";

/**
 * initial   { name, section, schedule, color } to edit, or nothing for a new class
 * onSubmit  ({ name, section, schedule, color }) => Promise
 */
export default function ClassForm({ initial = null, submitLabel, busy, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [section, setSection] = useState(initial?.section || "");
  const [schedule, setSchedule] = useState(() => ({ ...EMPTY_SCHEDULE, ...normalizeSchedule(initial?.schedule) }));
  const [color, setColor] = useState(initial?.color || CLASS_COLORS[0]);
  const [error, setError] = useState("");

  const toggleDay = (id) =>
    setSchedule((s) => ({ ...s, days: s.days.includes(id) ? s.days.filter((d) => d !== id) : [...s.days, id] }));

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the class its subject name.");
    if (schedule.start && schedule.end && schedule.end <= schedule.start) return setError("The class has to end after it starts.");
    setError("");
    onSubmit({ name: name.trim(), section: section.trim(), schedule: normalizeSchedule(schedule), color });
  }

  const line = [section.trim(), formatSchedule(schedule)].filter(Boolean).join(" · ");

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

        <label className="cform__field">
          <span>Starts</span>
          <input type="time" value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} />
        </label>
        <label className="cform__field">
          <span>Ends</span>
          <input type="time" value={schedule.end} onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} />
        </label>

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
        <ClassCardView name={name || "Subject name"} line={line || "Section · schedule"} color={color} />
      </aside>

      {error && <div className="ins-alert cform__error" role="alert">{error}</div>}
      <div className="cform__actions">
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
