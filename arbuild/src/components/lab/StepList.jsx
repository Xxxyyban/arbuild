// The guide card's steps: a line of numbered steps ticked off as they're done, with the step to do now
// kept in sight as the work goes on; or, for parts that can come out in any order, plain ticks.
// Styles: styles/BuildLabTask.css (.lab-steps*).
import { useEffect, useRef } from "react";
import Icon from "../Icon";

/**
 * steps     [{ label, done }]
 * now       the label of the step to do now (none: nothing's highlighted)
 * anyOrder  they aren't numbered or joined in a line
 */
export default function StepList({ steps, now = null, anyOrder = false }) {
  const nowRef = useRef(null);

  // the step to do now stays in sight, with the one before it above it
  useEffect(() => {
    const el = nowRef.current;
    const box = el?.closest(".lab-task__body");
    if (!box) return;
    const gap = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollBy({ top: gap - 48, behavior: calm ? "auto" : "smooth" });
  }, [now]);

  const List = anyOrder ? "ul" : "ol";
  return (
    <List className={`lab-steps ${anyOrder ? "lab-steps--any" : ""}`}>
      {steps.map((s, i) => {
        const isNow = s.label === now;
        return (
          <li key={s.label} ref={isNow ? nowRef : null} className={s.done ? "is-done" : isNow ? "is-next" : ""} aria-current={isNow ? "step" : undefined}>
            <span className="lab-steps__mark" aria-hidden="true">
              {s.done ? <Icon name="check" size={12} strokeWidth={3} /> : !anyOrder && i + 1}
            </span>
            <span className="lab-steps__label">
              {s.label}
              {s.done && <span className="lab-steps__hidden"> (done)</span>}
            </span>
          </li>
        );
      })}
    </List>
  );
}
