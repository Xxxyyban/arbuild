// A student's profile card over the page: their instructor opens it from the class's Students list
// (lab/People.js keeps the cards). Closes with Esc, the X, or a click outside it. Drawn straight into <body>, so the page's own layout
// (its column's width, its stacking) can't clip it. Styles: styles/Classes.css (.pcard).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import Avatar from "./Avatar";

/**
 * name, photo (a thumbnail), kind ("Instructor", "Student"), sub: a line under the name,
 * details: [{ icon, label, value, href }] (empty ones are left out), action: { icon, label, onClick }.
 */
export default function PersonCard({ name, photo, kind, sub, details = [], action, onClose }) {
  const closeBtn = useRef(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="pcard-backdrop" onClick={() => close.current()}>
      <div className="pcard" role="dialog" aria-modal="true" aria-label={`${name}, ${kind}`} onClick={(e) => e.stopPropagation()}>
        <button ref={closeBtn} type="button" className="pcard__close" aria-label="Close" onClick={() => close.current()}>
          <Icon name="x" size={18} />
        </button>
        <div className="pcard__head">
          <Avatar name={name} photo={photo} size={72} />
          <div className="pcard__who">
            <span className="pcard__kind">{kind}</span>
            <h2 className="pcard__name">{name}</h2>
            {sub && <p className="pcard__sub">{sub}</p>}
          </div>
        </div>
        <dl className="pcard__details">
          {details
            .filter((d) => d.value)
            .map((d) => (
              <div key={d.label} className="pcard__row">
                <dt>
                  <Icon name={d.icon} size={16} />
                  {d.label}
                </dt>
                <dd>{d.href ? <a href={d.href}>{d.value}</a> : d.value}</dd>
              </div>
            ))}
        </dl>
        {action && (
          <button type="button" className="btn btn--primary pcard__action" onClick={action.onClick}>
            <Icon name={action.icon} size={16} />
            {action.label}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
