// The Data Privacy Notice or the Terms of Use, over the page (lab/Policies.js). Drawn into <body>;
// Esc, the X or a click outside closes it. Styles: styles/Classes.css (.cdialog*, .policy*).
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { POLICIES, POLICY_VERSION } from "../lab/Policies";
import Icon from "./Icon";

/** which: "privacy" | "terms" */
export default function PolicyDialog({ which, onClose }) {
  const policy = POLICIES[which];
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
  if (!policy) return null;

  return createPortal(
    <div className="cdialog-backdrop" onClick={() => close.current()}>
      <div className="cdialog policy" role="dialog" aria-modal="true" aria-labelledby="policy-title" onClick={(e) => e.stopPropagation()}>
        <div className="policy__head">
          <h2 id="policy-title" className="cdialog__title">{policy.title}</h2>
          <button ref={closeBtn} type="button" className="policy__close" aria-label="Close" onClick={() => close.current()}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <p className="policy__intro">{policy.intro}</p>
        {policy.sections.map((s) => (
          <section key={s.heading} className="policy__section">
            <h3>{s.heading}</h3>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="policy__version">Version {POLICY_VERSION}</p>
      </div>
    </div>,
    document.body
  );
}
